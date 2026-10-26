/* SUBLEVEL AI: a small Cloudflare Worker that lets the phone app use Claude without each person
   needing their own Anthropic key. Your key stays here as a secret; people get in with an access code.

   Two kinds of code:
     - unlimited codes you list in ACCESS_CODES (you, friends, testers)
     - paid codes, each with its own prepaid credit, kept in the Ledger below. People get one by
       paying in USDC, checked on the blockchain and issued instantly: on Solana (one tap from
       Phantom, via a Solana Pay link) or on Base. Cash App codes can be made by hand on /admin.

   Secrets and variables (Cloudflare dashboard → this Worker → Settings → Variables and Secrets):
     ANTHROPIC_API_KEY  your Anthropic API key
     ACCESS_CODES       optional; comma-separated unlimited codes, like "JAY-7Q2K,MIKE-91XD"
     ADMIN_TOKEN        a long password for the /admin page
     SOL_ADDRESS        optional; your Solana wallet address (Phantom), to sell credit for USDC on Solana
     USDC_ADDRESS       optional; your wallet address on Base, to sell credit for USDC on Base
     CASHTAG            optional; your Cash App $cashtag without the $, to sell credit on Cash App
     PRICE_USD          optional; price of one credit pack in dollars (default 3)
     CREDIT_CENTS       optional; AI credit in one pack, in cents (default 200)
     PAUSED             optional; set to 1 to turn AI off for everyone */
import Anthropic from "@anthropic-ai/sdk";
import { DurableObject } from "cloudflare:workers";

const ORIGINS = ["https://jaylikescars1-lab.github.io"];
const MODEL = "claude-opus-5-5";
const MAX_TOKENS = 32000;
const EFFORTS = ["low", "medium", "high"];
const MAX_BODY = 8_000_000; // bytes; a few phone photos fit, a video doesn't
// Credit is metered in millionths of a dollar, at a little above Claude Opus 5.5's list price
// ($4 / $20 per million input / output tokens) so a fallback to a pricier model is still covered.
const MICROS_PER_IN = 5, MICROS_PER_OUT = 25;
const USDC_BASE = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"; // Circle's native USDC on Base
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"; // Transfer(address,address,uint256)
const USDC_SOL = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // Circle's USDC mint on Solana

export default {
  async fetch(req, env) {
    const cors = corsFor(req);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const url = new URL(req.url), path = url.pathname;
    if (req.method === "GET" && path === "/") return json(200, { ok: true, service: "SUBLEVEL AI" }, cors);
    if (req.method === "GET" && path === "/buy/info") return buyInfo(env, cors);
    if (req.method === "POST" && path === "/buy/usdc") return buyUSDC(req, env, cors);
    if (req.method === "POST" && path === "/buy/sol/start") return solStart(req, env, cors);
    if (req.method === "POST" && path === "/buy/sol/claim") return solClaim(req, env, cors);
    if (req.method === "POST" && path === "/buy/sol") return solManual(req, env, cors);
    if (req.method === "GET" && path === "/balance") return balance(req, env, cors);
    if (path === "/admin" || path.startsWith("/admin/")) return admin(req, env, path);
    if (req.method !== "POST" || path !== "/v1/messages") return fail(404, "not_found_error", "Not found.", cors);

    const code = readCode(req);
    const unlimited = listed(env, code);
    let row = null;
    if (!unlimited) {
      row = code && env.LEDGER ? await ledger(env).find(code) : null;
      if (!row) return fail(401, "authentication_error", "That access code isn't valid.", cors, "sublevel_code_invalid");
    }
    if (String(env.PAUSED || "") === "1") return fail(503, "overloaded_error", "SUBLEVEL AI is paused right now.", cors, "sublevel_paused");
    if (row && row.used >= row.credit) return fail(402, "billing_error", "This code's AI credit is used up.", cors, "sublevel_no_credit");
    if (!env.ANTHROPIC_API_KEY) return fail(500, "api_error", "The server has no Anthropic key set.", cors);

    if (+(req.headers.get("content-length") || 0) > MAX_BODY) return fail(413, "request_too_large", "That request is too big.", cors);
    let body;
    try { body = await req.json(); } catch (e) { return fail(400, "invalid_request_error", "Couldn't read the request.", cors); }
    const params = clean(body);
    if (typeof params === "string") return fail(400, "invalid_request_error", params, cors);

    // The app already retries; retrying here too would multiply requests.
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, baseURL: env.ANTHROPIC_BASE_URL || undefined, maxRetries: 0 });
    try {
      const upstream = await client.beta.messages.create(params).asResponse();
      const out = row ? meter(upstream.body, (inTok, outTok) => ledger(env).charge(code, inTok * MICROS_PER_IN + outTok * MICROS_PER_OUT)) : upstream.body;
      return new Response(out, { status: upstream.status, headers: { ...cors, "content-type": upstream.headers.get("content-type") || "text/event-stream", "cache-control": "no-store" } });
    } catch (e) {
      if (e instanceof Anthropic.APIError && e.status) return json(e.status, e.error || { type: "error", error: { type: "api_error", message: "Claude returned an error." } }, cors);
      return fail(502, "api_error", "Couldn't reach Claude.", cors);
    }
  },
};

/* ---------- the ledger: paid codes and the payments that funded them ---------- */
export class Ledger extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec("CREATE TABLE IF NOT EXISTS codes (code TEXT PRIMARY KEY, credit INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0, source TEXT, note TEXT, created TEXT)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS payments (ref TEXT PRIMARY KEY, code TEXT, credit INTEGER, created TEXT)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS pending (ref TEXT PRIMARY KEY, claim TEXT NOT NULL, code TEXT, created TEXT)");
  }
  /* A Solana Pay payment the app is about to make: its public reference, and a hash of a secret only that phone knows. */
  startRef(ref, claim) {
    if (this.sql.exec("SELECT ref FROM pending WHERE ref = ?", ref).toArray().length) return { error: "exists" };
    this.sql.exec("INSERT INTO pending (ref, claim, created) VALUES (?, ?, ?)", ref, claim, new Date().toISOString());
    return { ok: true };
  }
  refInfo(ref) { return this.sql.exec("SELECT ref, claim, code FROM pending WHERE ref = ?", ref).toArray()[0] || null; }
  refDone(ref, code) { this.sql.exec("UPDATE pending SET code = ? WHERE ref = ?", code, ref); }
  spent(ref) { return this.sql.exec("SELECT ref FROM payments WHERE ref = ?", ref).toArray().length > 0; }
  find(code) { return this.sql.exec("SELECT code, credit, used, source, note, created FROM codes WHERE code = ?", code).toArray()[0] || null; }
  create(credit, source, note) {
    let code; do { code = newCode(); } while (this.find(code));
    this.sql.exec("INSERT INTO codes (code, credit, used, source, note, created) VALUES (?, ?, 0, ?, ?, ?)", code, credit, source, String(note || "").slice(0, 200), new Date().toISOString());
    return this.find(code);
  }
  charge(code, micros) { if (micros > 0) this.sql.exec("UPDATE codes SET used = used + ? WHERE code = ?", Math.ceil(micros), code); }
  /* One payment funds one code, once. Tops up the buyer's code if they sent it, otherwise makes a new one. */
  redeem(ref, credit, source, code) {
    if (this.sql.exec("SELECT ref FROM payments WHERE ref = ?", ref).toArray().length) return { error: "used" };
    const row = code && this.find(code);
    let target;
    if (row) { this.sql.exec("UPDATE codes SET credit = credit + ? WHERE code = ?", credit, row.code); target = row.code; }
    else target = this.create(credit, source, ref).code;
    this.sql.exec("INSERT INTO payments (ref, code, credit, created) VALUES (?, ?, ?, ?)", ref, target, credit, new Date().toISOString());
    return this.find(target);
  }
  recent(n) { return this.sql.exec("SELECT code, credit, used, source, note, created FROM codes ORDER BY created DESC LIMIT ?", n).toArray(); }
}
const ledger = (env) => env.LEDGER.get(env.LEDGER.idFromName("ledger"));
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I
function newCode() {
  const b = crypto.getRandomValues(new Uint8Array(8));
  return "SL-" + Array.from(b, (x) => ALPHABET[x % 32]).join("");
}
const price = (env) => +env.PRICE_USD || 3;
const packMicros = (env) => (+env.CREDIT_CENTS || 200) * 10_000;
const cents = (micros) => Math.max(0, Math.floor(micros / 10_000));

/* ---------- buying credit ---------- */
function buyInfo(env, cors) {
  return json(200, {
    price_usd: price(env), credit_cents: cents(packMicros(env)),
    sol: env.SOL_ADDRESS && env.LEDGER ? { address: env.SOL_ADDRESS, network: "Solana", mint: USDC_SOL, amount: price(env) } : null,
    usdc: env.USDC_ADDRESS && env.LEDGER ? { address: env.USDC_ADDRESS, network: "Base", amount: price(env) } : null,
    cashapp: env.CASHTAG ? { cashtag: String(env.CASHTAG).replace(/^\$/, ""), amount: price(env) } : null,
  }, cors);
}
async function buyUSDC(req, env, cors) {
  if (!env.USDC_ADDRESS || !env.LEDGER) return fail(404, "not_found_error", "Crypto payments aren't set up.", cors);
  let b; try { b = await req.json(); } catch (e) { b = {}; }
  const tx = String(b.tx || "").trim().toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(tx)) return fail(400, "invalid_request_error", "That isn't a transaction ID. It starts with 0x and is 66 characters long.", cors, "sublevel_bad_tx");
  if (await ledger(env).spent("base:" + tx)) return fail(409, "invalid_request_error", "That transaction was already used for a code.", cors, "sublevel_tx_used");
  let paid;
  try { paid = await paidUSDC(env, tx); } catch (e) { return fail(502, "api_error", "Couldn't check the Base network right now. Try again in a minute.", cors, "sublevel_chain_down"); }
  if (paid.error === "not_found") return fail(404, "not_found_error", "That transaction isn't on Base yet. If you just sent it, wait a minute and try again.", cors, "sublevel_tx_not_found");
  if (paid.error === "failed") return fail(400, "invalid_request_error", "That transaction failed on Base, so nothing was sent.", cors, "sublevel_tx_failed");
  if (paid.error === "pending") return fail(409, "invalid_request_error", "Almost there. Wait a few seconds and try again.", cors, "sublevel_tx_pending");
  const unit = BigInt(Math.round(price(env) * 1e6)); // USDC has 6 decimals
  const packs = Number(paid.units / unit);
  if (packs < 1) return fail(400, "invalid_request_error", `That transaction didn't send at least ${price(env)} USDC on Base to SUBLEVEL's address.`, cors, "sublevel_tx_short");
  const row = await ledger(env).redeem("base:" + tx, packs * packMicros(env), "usdc", readCode(req) || String(b.code || "").trim().toUpperCase());
  if (row.error === "used") return fail(409, "invalid_request_error", "That transaction was already used for a code.", cors, "sublevel_tx_used");
  return json(200, { code: row.code, remaining_cents: cents(row.credit - row.used), added_cents: cents(packs * packMicros(env)) }, cors);
}
/* Sums USDC sent to USDC_ADDRESS in one Base transaction, in USDC's smallest unit. */
async function paidUSDC(env, tx) {
  const rc = await rpc(env, "eth_getTransactionReceipt", [tx]);
  if (!rc) return { error: "not_found" };
  if (rc.status !== "0x1") return { error: "failed" };
  const head = parseInt(await rpc(env, "eth_blockNumber", []), 16);
  if (head - parseInt(rc.blockNumber, 16) < 2) return { error: "pending" };
  const to = "0x" + String(env.USDC_ADDRESS).toLowerCase().replace(/^0x/, "").padStart(64, "0");
  let units = 0n;
  for (const l of rc.logs || []) {
    if (String(l.address).toLowerCase() === USDC_BASE && l.topics && l.topics[0] === TRANSFER && String(l.topics[2]).toLowerCase() === to) units += BigInt(l.data);
  }
  return { units };
}
async function rpc(env, method, params) {
  const r = await fetch(env.BASE_RPC || "https://mainnet.base.org", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "rpc error");
  return j.result;
}
/* ---------- USDC on Solana (Phantom) ---------- */
/* One tap: the app registers a random reference, opens a Solana Pay link in Phantom with it, and then
   claims with a secret. The reference finds the payment on-chain; the secret means only that phone can
   claim it, even though anyone can see the payment. */
async function solStart(req, env, cors) {
  if (!env.SOL_ADDRESS || !env.LEDGER) return fail(404, "not_found_error", "Solana payments aren't set up.", cors);
  const b = await req.json().catch(() => ({}));
  if (!isKey(b.ref) || !/^[0-9a-f]{64}$/.test(String(b.claim || ""))) return fail(400, "invalid_request_error", "Bad payment request.", cors);
  const r = await ledger(env).startRef(b.ref, b.claim);
  if (r.error) return fail(409, "invalid_request_error", "That payment was already started.", cors);
  return json(200, { ok: true }, cors);
}
async function solClaim(req, env, cors) {
  if (!env.SOL_ADDRESS || !env.LEDGER) return fail(404, "not_found_error", "Solana payments aren't set up.", cors);
  const b = await req.json().catch(() => ({}));
  const info = isKey(b.ref) ? await ledger(env).refInfo(b.ref) : null;
  if (!info) return fail(404, "not_found_error", "We don't know that payment.", cors, "sublevel_ref_unknown");
  if ((await sha256(String(b.secret || ""))) !== info.claim) return fail(403, "permission_error", "That payment belongs to another phone.", cors, "sublevel_ref_secret");
  if (info.code) { const row = await ledger(env).find(info.code); return json(200, { code: row.code, remaining_cents: cents(row.credit - row.used), added_cents: 0, already: true }, cors); }
  let sigs;
  try { sigs = await solRpc(env, "getSignaturesForAddress", [b.ref, { limit: 10, commitment: "confirmed" }]); } catch (e) { return fail(502, "api_error", "Couldn't check Solana right now.", cors, "sublevel_chain_down"); }
  for (const s of sigs || []) {
    if (s.err) continue;
    const out = await creditSOL(env, s.signature, readCode(req) || String(b.code || "").trim().toUpperCase(), cors);
    if (out.row) { await ledger(env).refDone(b.ref, out.row.code); return json(200, out.body, cors); }
    if (out.res && out.res.status !== 409) return out.res;
  }
  return fail(404, "not_found_error", "Not seen yet. If you just paid, it shows up within a few seconds.", cors, "sublevel_tx_not_found");
}
/* Fallback: the buyer sent USDC on their own and pastes the transaction signature. */
async function solManual(req, env, cors) {
  if (!env.SOL_ADDRESS || !env.LEDGER) return fail(404, "not_found_error", "Solana payments aren't set up.", cors);
  const b = await req.json().catch(() => ({}));
  const sig = String(b.sig || "").trim();
  if (b58len(sig) !== 64) return fail(400, "invalid_request_error", "That isn't a Solana transaction signature. Copy it from the payment in Phantom.", cors, "sublevel_bad_tx");
  const out = await creditSOL(env, sig, readCode(req) || String(b.code || "").trim().toUpperCase(), cors);
  return out.row ? json(200, out.body, cors) : out.res;
}
async function creditSOL(env, sig, code, cors) {
  const used = () => ({ res: fail(409, "invalid_request_error", "That transaction was already used for a code.", cors, "sublevel_tx_used") });
  if (await ledger(env).spent("sol:" + sig)) return used();
  let paid;
  try { paid = await paidSOL(env, sig); } catch (e) { return { res: fail(502, "api_error", "Couldn't check Solana right now. Try again in a minute.", cors, "sublevel_chain_down") }; }
  if (paid.error === "not_found") return { res: fail(404, "not_found_error", "That transaction isn't on Solana yet. If you just sent it, wait a few seconds and try again.", cors, "sublevel_tx_not_found") };
  if (paid.error === "failed") return { res: fail(400, "invalid_request_error", "That transaction failed on Solana, so nothing was sent.", cors, "sublevel_tx_failed") };
  const packs = Number(paid.units / BigInt(Math.round(price(env) * 1e6))); // USDC has 6 decimals
  if (packs < 1) return { res: fail(400, "invalid_request_error", `That transaction didn't send at least ${price(env)} USDC on Solana to SUBLEVEL's wallet.`, cors, "sublevel_tx_short") };
  const row = await ledger(env).redeem("sol:" + sig, packs * packMicros(env), "usdc-sol", code);
  if (row.error === "used") return used();
  return { row, body: { code: row.code, remaining_cents: cents(row.credit - row.used), added_cents: cents(packs * packMicros(env)) } };
}
/* USDC that SOL_ADDRESS gained in one Solana transaction, from the token balances before and after. */
async function paidSOL(env, sig) {
  const tx = await solTx(env, sig);
  if (!tx) return { error: "not_found" };
  if (!tx.meta || tx.meta.err) return { error: "failed" };
  const mine = (list) => (list || []).filter((t) => t.mint === USDC_SOL && t.owner === env.SOL_ADDRESS).reduce((a, t) => a + BigInt(t.uiTokenAmount.amount), 0n);
  const units = mine(tx.meta.postTokenBalances) - mine(tx.meta.preTokenBalances);
  return { units: units > 0n ? units : 0n };
}
/* Solana keeps adding transaction versions; ask for the newest the node says it needs. */
async function solTx(env, sig) {
  let v = 1;
  for (let i = 0; i < 4; i++) {
    try { return await solRpc(env, "getTransaction", [sig, { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: v }]); }
    catch (e) { const m = /maxSupportedTransactionVersion\\?"?\s*:\s*(\d+)/.exec(e.message); if (m && +m[1] > v) { v = +m[1]; continue; } throw e; }
  }
  throw new Error("unsupported transaction version");
}
async function solRpc(env, method, params) {
  const r = await fetch(env.SOLANA_RPC || "https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "rpc error");
  return j.result;
}
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
/* Bytes in a base58 string, or -1 if it isn't base58. Solana keys are 32 bytes, signatures 64. */
function b58len(s) {
  s = String(s || ""); if (!s || s.length > 100) return -1;
  let n = 0n; for (const c of s) { const i = B58.indexOf(c); if (i < 0) return -1; n = n * 58n + BigInt(i); }
  let len = 0; while (n > 0n) { n >>= 8n; len++; }
  for (const c of s) { if (c === "1") len++; else break; }
  return len;
}
const isKey = (s) => b58len(s) === 32;
async function sha256(s) { const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, "0")).join(""); }

async function balance(req, env, cors) {
  const code = readCode(req);
  if (listed(env, code)) return json(200, { unlimited: true }, cors);
  const row = code && env.LEDGER ? await ledger(env).find(code) : null;
  if (!row) return fail(401, "authentication_error", "That access code isn't valid.", cors, "sublevel_code_invalid");
  return json(200, { remaining_cents: cents(row.credit - row.used), used_cents: cents(row.used) }, cors);
}

/* ---------- /admin: make codes for Cash App buyers, see who has what ---------- */
async function admin(req, env, path) {
  if (req.method === "GET" && path === "/admin") return new Response(ADMIN_PAGE, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  const h = { "cache-control": "no-store" };
  if (!env.ADMIN_TOKEN || !sameText(req.headers.get("x-admin-token") || "", env.ADMIN_TOKEN)) return json(401, { error: "Wrong admin password." }, h);
  if (!env.LEDGER) return json(500, { error: "The ledger isn't set up." }, h);
  if (req.method === "POST" && path === "/admin/create") {
    let b; try { b = await req.json(); } catch (e) { b = {}; }
    const dollars = +b.dollars || price(env);
    const credit = Math.round((dollars / price(env)) * packMicros(env));
    if (!(credit > 0) || dollars > 1000) return json(400, { error: "Enter what they paid, in dollars." }, h);
    const row = await ledger(env).create(credit, "cashapp", b.note);
    return json(200, { code: row.code, credit_cents: cents(row.credit) }, h);
  }
  if (req.method === "GET" && path === "/admin/codes") {
    const rows = await ledger(env).recent(50);
    return json(200, { codes: rows.map((r) => ({ code: r.code, source: r.source, note: r.note, created: r.created, remaining_cents: cents(r.credit - r.used), used_cents: cents(r.used) })) }, h);
  }
  return json(404, { error: "Not found." }, h);
}
function sameText(a, b) {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const ADMIN_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SUBLEVEL Admin</title>
<style>:root{color-scheme:dark}body{margin:0;background:#060609;color:#ecebf2;font:16px/1.5 system-ui,sans-serif}main{max-width:560px;margin:0 auto;padding:24px 16px 60px}
h1{font-size:22px;margin:0 0 4px}p{color:#b4b2c0;margin:0 0 16px}label{display:block;font-size:13px;color:#7d7a8c;margin:14px 0 6px}
input{width:100%;box-sizing:border-box;padding:12px;border-radius:10px;border:1px solid #2a2836;background:#0e0d14;color:#ecebf2;font:inherit}
button{margin-top:14px;padding:12px 16px;border:0;border-radius:10px;background:#6a3df0;color:#fff;font:inherit;font-weight:600;width:100%}
.code{font:600 26px ui-monospace,monospace;letter-spacing:.06em;margin:16px 0 4px}.dim{color:#7d7a8c;font-size:13px}
table{width:100%;border-collapse:collapse;margin-top:10px;font-size:13.5px}td{padding:8px 4px;border-top:1px solid #1d1b26;vertical-align:top}td.m{font-family:ui-monospace,monospace}</style></head>
<body><main><h1>SUBLEVEL Admin</h1><p>Make a code for someone who paid on Cash App, then send it to them.</p>
<label for="t">Admin password</label><input id="t" type="password" autocomplete="current-password">
<label for="d">What they paid ($)</label><input id="d" type="number" inputmode="decimal" step="0.01">
<label for="n">Who it's for (Cash App name, Instagram or email)</label><input id="n">
<button id="go">Make code</button><div id="out"></div>
<h1 style="margin-top:34px;font-size:18px">Recent codes</h1><div id="list" class="dim">Enter your password to see them.</div></main>
<script>
const $=(s)=>document.querySelector(s);try{$("#t").value=localStorage.getItem("t")||""}catch(e){}
const call=async(p,o={})=>{const r=await fetch(p,{...o,headers:{"content-type":"application/json","x-admin-token":$("#t").value}});const j=await r.json();if(!r.ok)throw new Error(j.error||"Error");try{localStorage.setItem("t",$("#t").value)}catch(e){}return j};
const esc=(s)=>String(s??"").replace(/[&<>"]/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const money=(c)=>"$"+(c/100).toFixed(2);
async function list(){try{const j=await call("/admin/codes");$("#list").innerHTML=j.codes.length?"<table>"+j.codes.map((c)=>"<tr><td class=m>"+esc(c.code)+"</td><td>"+esc(c.note)+"<div class=dim>"+esc(c.source)+" · "+esc(c.created.slice(0,10))+"</div></td><td>"+money(c.remaining_cents)+" left</td></tr>").join("")+"</table>":"No codes yet."}catch(e){$("#list").textContent=e.message}}
$("#go").onclick=async()=>{$("#out").innerHTML="";try{const j=await call("/admin/create",{method:"POST",body:JSON.stringify({dollars:+$("#d").value||0,note:$("#n").value})});$("#out").innerHTML='<div class="code">'+esc(j.code)+'</div><div class="dim">'+money(j.credit_cents)+' of AI credit. Send them this code; they enter it in SUBLEVEL → More → Settings.</div>';$("#n").value="";list()}catch(e){$("#out").innerHTML='<p style="color:#f0566e;margin-top:12px">'+esc(e.message)+'</p>'}};
if($("#t").value)list();
</script></body></html>`;

/* ---------- metering: count the tokens in Claude's streamed answer, then charge the code ---------- */
function meter(body, done) {
  const dec = new TextDecoder();
  let buf = "", inTok = 0, outTok = 0;
  const scan = (text) => {
    for (const line of text.split("\n")) {
      if (!line.startsWith("data:")) continue;
      let d; try { d = JSON.parse(line.slice(5)); } catch (e) { continue; }
      const u = d.usage || (d.message && d.message.usage);
      if (!u) continue;
      inTok = Math.max(inTok, (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0));
      outTok = Math.max(outTok, u.output_tokens || 0);
    }
  };
  return body.pipeThrough(new TransformStream({
    transform(chunk, ctl) {
      ctl.enqueue(chunk);
      buf += dec.decode(chunk, { stream: true });
      const i = buf.lastIndexOf("\n");
      if (i >= 0) { scan(buf.slice(0, i)); buf = buf.slice(i + 1); }
    },
    async flush() { scan(buf + dec.decode()); await done(inTok, outTok); },
  }));
}

/* ---------- request checks ---------- */
const readCode = (req) => (req.headers.get("x-sublevel-code") || "").trim().toUpperCase();
const listed = (env, code) => !!code && String(env.ACCESS_CODES || "").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean).includes(code);

/* Rebuild the request from scratch: only the model, sizes and features the app uses get through. */
function clean(b) {
  if (!b || !Array.isArray(b.messages) || !b.messages.length || b.messages.length > 60) return "messages: expected 1 to 60 turns.";
  const messages = [];
  for (const m of b.messages) {
    if (!m || (m.role !== "user" && m.role !== "assistant")) return "messages: role must be user or assistant.";
    if (typeof m.content === "string") { messages.push({ role: m.role, content: m.content }); continue; }
    if (!Array.isArray(m.content)) return "messages: content must be text or blocks.";
    const blocks = [];
    for (const c of m.content) {
      if (c && c.type === "text" && typeof c.text === "string") blocks.push({ type: "text", text: c.text });
      else if (c && c.type === "image" && c.source && c.source.type === "base64" && /^image\/(jpeg|png|webp|gif)$/.test(c.source.media_type)) {
        if (blocks.filter((x) => x.type === "image").length >= 4) return "Up to 4 photos per request.";
        blocks.push({ type: "image", source: { type: "base64", media_type: c.source.media_type, data: String(c.source.data) } });
      } else return "messages: only text and image blocks are allowed.";
    }
    messages.push({ role: m.role, content: blocks });
  }
  const p = { model: MODEL, max_tokens: Math.max(1, Math.min(+b.max_tokens || 16000, MAX_TOKENS)), messages, stream: true };
  const oc = b.output_config || {};
  p.output_config = { effort: EFFORTS.includes(oc.effort) ? oc.effort : "medium" };
  if (oc.format && oc.format.type === "json_schema" && oc.format.schema && typeof oc.format.schema === "object") p.output_config.format = { type: "json_schema", schema: oc.format.schema };
  if (b.fallbacks === "default") Object.assign(p, { fallbacks: "default", betas: ["server-side-fallback-2026-07-01"] });
  return p;
}

function corsFor(req) {
  const origin = req.headers.get("origin") || "";
  return {
    "access-control-allow-origin": ORIGINS.includes(origin) ? origin : ORIGINS[0],
    "access-control-allow-methods": "POST, GET, OPTIONS",
    "access-control-allow-headers": req.headers.get("access-control-request-headers") || "content-type, x-sublevel-code",
    "access-control-expose-headers": "request-id",
    "access-control-max-age": "600",
    vary: "Origin",
  };
}
const json = (status, data, headers) => new Response(JSON.stringify(data), { status, headers: { ...headers, "content-type": "application/json" } });
const fail = (status, type, message, cors, error_code) => json(status, { type: "error", error: { type, message, ...(error_code ? { details: { error_code } } : {}) } }, cors);
