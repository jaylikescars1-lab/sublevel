/* Phone app mode: everything stays on this device. Data in localStorage, photos in IndexedDB, offline via service worker. */
(function () {
  const NS = window.NS;
  NS.standalone = true;
  const firstRun = (() => { try { return !localStorage.getItem("sublevel.v1"); } catch (e) { return false; } })();
  if (firstRun) NS.S.meta.mode = "simple"; // new people start simple; Settings or More can show everything

  /* ---------- photos in IndexedDB ---------- */
  let dbp = null;
  const db = () => (dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open("sublevel", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("photos");
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const put = async (id, blob) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction("photos", "readwrite"); t.objectStore("photos").put(blob, id); t.oncomplete = res; t.onerror = () => rej(t.error); }); };
  const loadAll = async () => { const d = await db(); return new Promise((res) => { const req = d.transaction("photos").objectStore("photos").openCursor(); req.onsuccess = () => { const c = req.result; if (c) { NS.photoURL[c.key] = URL.createObjectURL(c.value); c.continue(); } else res(); }; req.onerror = () => res(); }); };
  NS.photoURL = {};
  NS.img = (id) => (id ? NS.photoURL[id] || "" : "");

  /* ---------- replace the claude.ai connections ---------- */
  NS.connect = async () => { NS.setSync("local", "ON THIS PHONE"); };
  /* ---------- AI: Claude through SUBLEVEL's server with an access code, or the person's own Anthropic key ---------- */
  const MODEL = "claude-opus-5-5";
  const HOSTED_URL = ""; // the deployed worker/ (see worker/README.md), like "https://sublevel-ai.yourname.workers.dev"
  const KEY = "sublevel.apikey";
  const CODE = "sublevel.aicode";
  const getKey = () => { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } };
  const getCode = () => { try { return localStorage.getItem(CODE) || ""; } catch (e) { return ""; } };
  const aiMode = () => (getKey() ? "key" : HOSTED_URL && getCode() ? "hosted" : null);
  const toB64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(blob); });
  const shrink = (file) => new Promise((res) => {
    const img = new Image();
    img.onload = () => { const s = Math.min(1, 1568 / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); c.toBlob((b) => res(b || file), "image/jpeg", 0.85); };
    img.onerror = () => res(file); img.src = URL.createObjectURL(file);
  });
  const parseLoose = (t) => { try { return JSON.parse(t); } catch (e) {} const f = t.match(/```(?:json)?\s*([\s\S]*?)```/); if (f) return JSON.parse(f[1]); const i = t.search(/[[{]/), j = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]")); return JSON.parse(t.slice(i, j + 1)); };
  /* Turn an SDK error into one of SUBLEVEL's codes, keeping the raw details so Settings → Test can show them. */
  const mapErr = (e) => {
    const A = window.Anthropic;
    if (A && e instanceof A.APIUserAbortError || (e && e.name === "AbortError")) return { code: "cancelled" };
    const body = (e && e.error && e.error.error) || {};
    const status = e && e.status, type = (e && e.type) || body.type || "", message = body.message || (e && e.message) || "";
    const raw = { status, type, message: String(message).slice(0, 300), id: e && e.requestID };
    const is = (re) => re.test(message);
    if (A && e instanceof A.APIConnectionError) return { ...raw, code: "offline" };
    const ec = body.details && body.details.error_code;
    if (ec === "sublevel_code_invalid") return { ...raw, code: "bad_code" };
    if (ec === "sublevel_paused") return { ...raw, code: "ai_paused" };
    if (ec === "sublevel_no_credit") return { ...raw, code: "credit_out" };
    // On SUBLEVEL's server, account problems are the server's, not this person's.
    if (aiMode() === "hosted" && (type === "billing_error" || status === 401 || status === 402 || status === 403 || status === 404 || is(/credit balance|usage limits|spend limit/i))) return { ...raw, code: "ai_server" };
    if (type === "billing_error" || status === 402 || is(/credit balance/i)) return { ...raw, code: "no_credit" };
    if ((body.details && body.details.error_code === "enforced_spend_limit_reached") || is(/usage limits|spend limit/i)) return { ...raw, code: "spend_limit" };
    if (status === 401 || type === "authentication_error") return { ...raw, code: "bad_key" };
    if (status === 403 || type === "permission_error") return { ...raw, code: "no_access" };
    if (status === 404 || type === "not_found_error") return { ...raw, code: "no_model" };
    if (status === 413 || type === "request_too_large") return { ...raw, code: "too_large" };
    if (status === 429 || type === "rate_limit_error") return { ...raw, code: "rate_limited" };
    if (status === 529 || type === "overloaded_error") return { ...raw, code: "overloaded" };
    if (status === 400 || type === "invalid_request_error") return { ...raw, code: "bad_request" };
    return { ...raw, code: "upstream_error" };
  };
  /* Features this key's account has turned down this session (a 400 that went away once they were dropped). */
  const off = { fallbacks: false, schema: false, effort: false };
  NS.aiOff = off;
  function makeSample() {
    const client = aiMode() === "key"
      ? new window.Anthropic({ apiKey: getKey(), dangerouslyAllowBrowser: true })
      : new window.Anthropic({ apiKey: "sublevel-hosted", baseURL: HOSTED_URL, dangerouslyAllowBrowser: true, defaultHeaders: { "x-sublevel-code": getCode() } });
    async function run(input, opts = {}, schema) {
      const turns = typeof input === "string" ? [{ role: "user", content: input }] : input.map((t) => ({ role: t.role, content: t.content }));
      const merged = []; turns.forEach((t) => { const last = merged[merged.length - 1]; if (last && last.role === t.role) last.content += "\n\n" + t.content; else merged.push({ ...t }); });
      const images = opts.images && opts.images.length ? await Promise.all([...opts.images].map(async (f) => { const b = await shrink(f); return { type: "image", source: { type: "base64", media_type: "image/jpeg", data: await toB64(b) } }; })) : null;
      // Try the full request first; on a 400, drop one optional feature at a time and try again.
      for (let attempt = 0; attempt < 4; attempt++) {
        const msgs = merged.map((m) => ({ ...m }));
        const last = msgs[msgs.length - 1];
        if (schema && off.schema) last.content += "\n\nReply with only a JSON object (no prose, no code fences) that matches this JSON Schema:\n" + JSON.stringify(schema);
        if (images) last.content = [...images, { type: "text", text: last.content }];
        const params = { model: MODEL, max_tokens: 64000, messages: msgs };
        if (!off.effort) params.output_config = { effort: opts.effort || "medium" };
        if (schema && !off.schema) params.output_config = { ...(params.output_config || {}), format: { type: "json_schema", schema } };
        if (!off.fallbacks) Object.assign(params, { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
        try {
          const stream = client.beta.messages.stream(params, { signal: opts.signal });
          if (opts.onText) { let text = ""; stream.on("text", (d) => { text += d; opts.onText({ text, delta: d }); }); }
          const msg = await stream.finalMessage();
          if (msg.stop_reason === "refusal") throw { code: "refused" };
          const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
          if (!text.trim()) throw { code: "empty_completion" };
          return { text, truncated: msg.stop_reason === "max_tokens" };
        } catch (e) {
          if (e && e.code) throw e;
          const m = mapErr(e);
          if (m.code !== "bad_request") throw m;
          const hint = m.message.toLowerCase();
          const next = !off.fallbacks && (/fallback|beta/.test(hint) || !/schema|format|effort/.test(hint)) ? "fallbacks"
            : schema && !off.schema && /schema|format|output_config|json/.test(hint) ? "schema"
            : !off.effort && /effort|output_config/.test(hint) ? "effort"
            : schema && !off.schema ? "schema" : null;
          if (!next) throw m;
          off[next] = true;
        }
      }
      throw { code: "bad_request" };
    }
    const sample = (input, opts) => run(input, opts);
    sample.json = async (input, opts = {}) => { const r = await run(input, opts, opts.schema); try { return parseLoose(r.text); } catch (e) { throw { code: "invalid_json", text: r.text }; } };
    sample.limits = async () => ({ maxPromptBytes: 262144, images: { maxCount: 4, mediaTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] } });
    return sample;
  }
  NS.connectAI = async () => {
    NS.sample = aiMode() && window.Anthropic ? makeSample() : null;
    NS.sampleImages = !!NS.sample; NS.downloads = NS.downloads || null;
    NS.render({ quiet: true });
  };
  NS.aiSettingsHTML = () => {
    const mode = aiMode();
    const p = (html) => `<p style="margin:0;color:var(--fg-2);font-size:14.5px">${html}</p>`;
    const msg = `<div id="ai-msg" class="muted" style="font-size:13.5px;margin-top:8px"></div>`;
    const keyRow = `<div class="row" style="margin-top:10px;flex-wrap:nowrap"><input class="input" id="ai-key" type="password" placeholder="sk-ant-…" autocomplete="off" style="flex:1"><button class="btn primary sm" data-act="ai-key-save">Save</button></div>`;
    const what = "set up any car, fill in spec sheets, estimate mods, score listings, read receipts and answer questions";
    let body;
    if (mode === "key") body = p(`<b class="ok">On.</b> Uses your Anthropic API key, saved only on this phone (it's never in backups). Model: Claude Opus 5.5. A full car setup costs about 15–30¢, a question or estimate a few cents.`) + msg +
      `<div class="row" style="margin-top:10px"><button class="btn sm" data-act="ai-test">${NS.icon("spark")}Test it</button><button class="btn sm danger" data-act="ai-key-clear">Remove key</button></div>`;
    else if (mode === "hosted") body = p(`<b class="ok">On.</b> Using SUBLEVEL AI with access code <span class="mono" style="color:var(--fg)">${NS.esc(getCode())}</span>. Model: Claude Opus 5.5.`) +
      `<div id="ai-credit" class="muted" style="font-size:14px;margin-top:6px"></div>` + msg +
      `<div class="row" style="margin-top:10px"><button class="btn sm" data-act="ai-test">${NS.icon("spark")}Test it</button><button class="btn sm" data-act="ai-buy">${NS.icon("plus")}Add credit</button><button class="btn sm danger" data-act="ai-code-clear">Remove code</button></div>`;
    else if (HOSTED_URL) body = p(`<b style="color:var(--fg)">Off.</b> Turn it on and SUBLEVEL can ${what}.`) +
      `<div class="row" style="margin-top:10px"><button class="btn primary sm" data-act="ai-buy">${NS.icon("spark")}Get AI credit</button></div>` +
      `<div class="lbl" style="margin:14px 0 0">Have a code?</div><div class="row" style="margin-top:8px;flex-wrap:nowrap"><input class="input mono" id="ai-code" placeholder="ACCESS CODE" autocomplete="off" autocapitalize="characters" spellcheck="false" style="flex:1;text-transform:uppercase"><button class="btn primary sm" data-act="ai-code-save">Turn on</button></div>` + msg +
      `<details class="more" style="margin-top:12px"><summary class="lbl">Use your own Anthropic key instead</summary><p class="dim" style="font-size:13.5px;margin:8px 0 0">Get one at console.anthropic.com → API Keys. It's saved only on this phone and only sent to Anthropic.</p>${keyRow}</details>`;
    else body = p(`<b style="color:var(--fg)">Off.</b> Add an Anthropic API key to have SUBLEVEL ${what}. Get one at <b style="color:var(--fg)">console.anthropic.com</b> → API Keys (needs a few dollars of credit). It's saved only on this phone and only sent to Anthropic.`) + keyRow + msg;
    return `<div class="infobox"><h4>AI · CLAUDE</h4>${body}</div>`;
  };
  /* ---------- buying AI credit (SUBLEVEL's server checks the payment and hands back a code) ---------- */
  const hosted = async (path, opts = {}) => {
    const r = await fetch(HOSTED_URL + path, { ...opts, headers: { "content-type": "application/json", ...(getCode() ? { "x-sublevel-code": getCode() } : {}), ...(opts.headers || {}) } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw { status: r.status, message: (j.error && j.error.message) || "Something went wrong. Try again.", ec: j.error && j.error.details && j.error.details.error_code };
    return j;
  };
  const usd = (c) => "$" + (c / 100).toFixed(2);
  NS.aiSettingsAfter = async () => {
    if (HOSTED_URL && pending()) pollSol(30);
    const el = document.getElementById("ai-credit"); if (!el || aiMode() !== "hosted") return;
    try { const b = await hosted("/balance"); el.innerHTML = b.unlimited ? "Unlimited access." : `<b style="color:var(--fg)">${usd(b.remaining_cents)}</b> of AI credit left.`; }
    catch (e) { el.textContent = ""; }
  };
  NS.acts["ai-buy"] = async () => {
    NS.sheet(NS.sheetHead("AI CREDIT", "Turn on AI") + `<div id="buy-body" class="muted">Loading…</div>`);
    let info;
    try { info = await hosted("/buy/info"); } catch (e) { document.getElementById("buy-body").textContent = "Couldn't reach SUBLEVEL's server. Check your connection and try again."; return; }
    NS._buyInfo = info;
    const credit = usd(info.credit_cents), price = "$" + info.price_usd;
    const parts = [`<p style="margin:0 0 14px;font-size:15px;color:var(--fg-2)"><b style="color:var(--fg)">${price} gets ${credit} of AI credit.</b> That's roughly ${Math.max(1, Math.round(info.credit_cents / 35))} car setups or ${Math.round(info.credit_cents / 8)} questions. It doesn't expire. ${getCode() ? "It's added to your code." : "You get your own access code."}</p>`];
    if (info.sol) parts.push(`<div class="infobox"><h4>PAY WITH PHANTOM · INSTANT</h4>
      <p style="margin:0;color:var(--fg-2);font-size:14.5px">Pays <b style="color:var(--fg)">${info.sol.amount} USDC on Solana</b>. Phantom opens with the payment filled in. Approve it, then come back here.</p>
      <div class="row" style="margin-top:10px"><button class="btn primary" data-act="buy-sol-start">${NS.icon("spark")}Pay ${info.sol.amount} USDC in Phantom</button></div>
      <div id="sol-msg" style="font-size:14px;margin-top:8px"></div>
      <details class="more" style="margin-top:10px"><summary class="lbl">Phantom didn't open?</summary>
        <p class="dim" style="font-size:13.5px;margin:8px 0 0">Send exactly ${info.sol.amount} USDC on Solana to:</p>
        <div class="row" style="margin-top:6px;flex-wrap:nowrap"><span class="mono" id="buy-addr" style="flex:1;min-width:0;word-break:break-all;font-size:13px;color:var(--fg)">${NS.esc(info.sol.address)}</span><button class="btn sm" data-act="buy-copy">Copy</button></div>
        <p class="dim" style="font-size:13.5px;margin:8px 0 0">Then open that payment in Phantom's activity, copy its transaction signature (or view it on Solscan and copy it there), and paste it here:</p>
        <div class="row" style="margin-top:6px;flex-wrap:nowrap"><input class="input mono" id="sol-sig" placeholder="Transaction signature" autocomplete="off" spellcheck="false" style="flex:1"><button class="btn sm primary" data-act="buy-sol-sig">Get my code</button></div>
      </details></div>`);
    if (info.usdc) parts.push(`<div class="infobox" style="margin-top:12px"><h4>PAY WITH USDC ON BASE · INSTANT</h4>
      <p style="margin:0;color:var(--fg-2);font-size:14.5px">Send <b style="color:var(--fg)">${info.usdc.amount} USDC on the Base network</b> to:</p>
      <div class="row" style="margin-top:8px;flex-wrap:nowrap"><span class="mono" id="buy-addr" style="flex:1;min-width:0;word-break:break-all;font-size:13px;color:var(--fg)">${NS.esc(info.usdc.address)}</span><button class="btn sm" data-act="buy-copy">Copy</button></div>
      <p class="dim" style="font-size:13px;margin:8px 0 0">Only USDC, and only on Base. Other coins or networks can't be credited. Then paste the transaction ID (it starts with 0x) from your wallet:</p>
      <div class="row" style="margin-top:8px;flex-wrap:nowrap"><input class="input mono" id="buy-tx" placeholder="0x…" autocomplete="off" spellcheck="false" style="flex:1"><button class="btn primary sm" data-act="buy-usdc">Get my code</button></div>
      <div id="buy-msg" style="font-size:14px;margin-top:8px"></div></div>`);
    if (info.cashapp) parts.push(`<div class="infobox" style="margin-top:12px"><h4>PAY WITH CASH APP</h4>
      <p style="margin:0;color:var(--fg-2);font-size:14.5px">Pay ${price} to <b style="color:var(--fg)">$${NS.esc(info.cashapp.cashtag)}</b>. In the note, put your Instagram or email so your code can be sent to you, usually within a day. Then enter it under <b style="color:var(--fg)">Have a code?</b> in Settings.</p>
      <div class="row" style="margin-top:10px"><a class="btn sm" href="https://cash.app/$${encodeURIComponent(info.cashapp.cashtag)}/${info.cashapp.amount}" target="_blank" rel="noopener">Open Cash App</a></div></div>`);
    if (!info.sol && !info.usdc && !info.cashapp) parts.push(`<p class="dim">Buying credit isn't set up yet. If someone gave you a code, enter it in Settings.</p>`);
    document.getElementById("buy-body").innerHTML = parts.join("");
  };
  /* Phantom: register a random reference with a hash of a secret, open a Solana Pay link, then claim with the secret.
     The pending payment is kept on the phone so the app picks it up again after switching back from Phantom. */
  const PENDING = "sublevel.solpay";
  const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const b58 = (bytes) => { let n = 0n; for (const x of bytes) n = n * 256n + BigInt(x); let s = ""; while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; } for (const x of bytes) { if (x === 0) s = "1" + s; else break; } return s; };
  const hex = (bytes) => Array.from(bytes, (x) => x.toString(16).padStart(2, "0")).join("");
  const sha256 = async (s) => hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))));
  const pending = () => { try { const p = JSON.parse(localStorage.getItem(PENDING) || "null"); return p && Date.now() - p.at < 864e5 ? p : null; } catch (e) { return null; } };
  const setPending = (p) => { try { p ? localStorage.setItem(PENDING, JSON.stringify(p)) : localStorage.removeItem(PENDING); } catch (e) {} };
  function paidHTML(r, isNew) {
    return `<span class="ok">Paid.</span> ${usd(r.added_cents)} added, ${usd(r.remaining_cents)} total.` + (isNew ? `<div style="margin-top:8px">Your code is <b class="mono" style="color:var(--fg);font-size:16px">${NS.esc(r.code)}</b>. Write it down: it's how you get your credit back on a new phone. AI is on.</div>` : " AI is on.");
  }
  async function paid(r, el) {
    const isNew = r.code !== getCode();
    try { localStorage.setItem(CODE, r.code); } catch (e) {}
    await NS.connectAI();
    if (el) el.innerHTML = paidHTML(r, isNew);
    else NS.sheet(NS.sheetHead("AI CREDIT", "Payment received") + `<div style="font-size:15px">${paidHTML(r, isNew)}</div><div class="sheet-foot"><span class="grow"></span><button class="btn primary" data-act="close-sheet">Done</button></div>`);
  }
  async function pollSol(seconds) {
    if (NS._solPolling) return; NS._solPolling = true;
    const end = Date.now() + seconds * 1000;
    try {
      while (Date.now() < end) {
        const p = pending(); if (!p) return;
        const el = document.getElementById("sol-msg");
        try {
          const r = await hosted("/buy/sol/claim", { method: "POST", body: JSON.stringify({ ref: p.ref, secret: p.secret }) });
          setPending(null); await paid(r, el); return;
        } catch (e) {
          if (e.ec === "sublevel_ref_unknown" || e.ec === "sublevel_ref_secret") { setPending(null); if (el) el.innerHTML = `<span class="warn">${NS.esc(e.message)}</span>`; return; }
          if (e.ec !== "sublevel_tx_not_found" && el) el.innerHTML = `<span class="warn">${NS.esc(e.message)}</span>`;
        }
        await new Promise((res) => setTimeout(res, 4000));
      }
      const el = document.getElementById("sol-msg");
      if (el && pending()) el.innerHTML = `Haven't seen the payment yet. If you paid, it'll show up next time you open Settings.`;
    } finally { NS._solPolling = false; }
  }
  NS.acts["buy-sol-start"] = async (el) => {
    const info = NS._buyInfo; const msg = document.getElementById("sol-msg"); if (!info || !info.sol) return;
    const ref = b58(crypto.getRandomValues(new Uint8Array(32))), secret = hex(crypto.getRandomValues(new Uint8Array(32)));
    el.disabled = true;
    try { await hosted("/buy/sol/start", { method: "POST", body: JSON.stringify({ ref, claim: await sha256(secret) }) }); }
    catch (e) { msg.innerHTML = `<span class="warn">${NS.esc(e.message)}</span>`; el.disabled = false; return; }
    setPending({ ref, secret, at: Date.now() });
    msg.innerHTML = `<span class="thinking">Waiting for your payment</span><div class="dim" style="font-size:13px;margin-top:4px">Approve it in Phantom, then switch back. This updates by itself.</div>`;
    el.disabled = false;
    pollSol(180);
    location.href = NS.solPayURL(info.sol, ref);
  };
  /* A Solana Pay transfer request: Phantom opens it with the amount, token and reference filled in. */
  NS.solPayURL = (sol, ref) => `solana:${sol.address}?amount=${sol.amount}&spl-token=${sol.mint}&reference=${ref}&label=SUBLEVEL&message=${encodeURIComponent("SUBLEVEL AI credit")}`;
  NS.acts["buy-sol-sig"] = async (el) => {
    const sig = (document.getElementById("sol-sig").value || "").trim(); const msg = document.getElementById("sol-msg");
    if (!/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(sig)) { msg.innerHTML = `<span class="warn">That isn't a Solana transaction signature. It's a long string of letters and numbers from the payment in Phantom.</span>`; return; }
    el.disabled = true; msg.innerHTML = `<span class="thinking">Checking the payment</span>`;
    try { await paid(await hosted("/buy/sol", { method: "POST", body: JSON.stringify({ sig }) }), msg); }
    catch (e) { msg.innerHTML = `<span class="warn">${NS.esc(e.message)}</span>`; }
    finally { el.disabled = false; }
  };
  // Back from Phantom (or a fresh open): keep looking for a payment that was started.
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && HOSTED_URL && pending()) pollSol(90); });
  window.addEventListener("load", () => { if (HOSTED_URL && pending()) setTimeout(() => pollSol(90), 2500); });
  NS.acts["buy-copy"] = async (el) => {
    const t = document.getElementById("buy-addr").textContent;
    try { await navigator.clipboard.writeText(t); el.textContent = "Copied"; } catch (e) { el.textContent = "Select it"; }
  };
  NS.acts["buy-usdc"] = async (el) => {
    const tx = (document.getElementById("buy-tx").value || "").trim(); const msg = document.getElementById("buy-msg");
    if (!/^0x[0-9a-fA-F]{64}$/.test(tx)) { msg.innerHTML = `<span class="warn">That isn't a transaction ID. It starts with 0x and is 66 characters long.</span>`; return; }
    el.disabled = true; msg.innerHTML = `<span class="thinking">Checking the payment</span>`;
    try {
      const r = await hosted("/buy/usdc", { method: "POST", body: JSON.stringify({ tx }) });
      const isNew = r.code !== getCode();
      try { localStorage.setItem(CODE, r.code); } catch (e) {}
      await NS.connectAI();
      msg.innerHTML = `<span class="ok">Paid.</span> ${usd(r.added_cents)} added, ${usd(r.remaining_cents)} total.` + (isNew ? `<div style="margin-top:8px">Your code is <b class="mono" style="color:var(--fg);font-size:16px">${NS.esc(r.code)}</b>. Write it down: it's how you get your credit back on a new phone. AI is on.</div>` : "");
    } catch (e) { msg.innerHTML = `<span class="warn">${NS.esc(e.message)}</span>`; }
    finally { el.disabled = false; }
  };
  NS.acts["ai-code-save"] = async () => {
    const v = (document.getElementById("ai-code").value || "").trim().toUpperCase(); const msg = document.getElementById("ai-msg");
    if (!/^[A-Z0-9-]{4,40}$/.test(v)) { msg.textContent = "Access codes are letters, numbers and dashes, like JAY-7Q2K."; return; }
    try { localStorage.setItem(CODE, v); } catch (e) { msg.textContent = "Couldn't save it on this phone."; return; }
    await NS.connectAI(); NS.acts["settings-open"](); NS.acts["ai-test"]();
  };
  NS.acts["ai-code-clear"] = async (el) => {
    if (!el.classList.contains("armed")) { el.classList.add("armed"); el.textContent = "Tap again to remove"; return; }
    try { localStorage.removeItem(CODE); } catch (e) {}
    await NS.connectAI(); NS.acts["settings-open"]();
  };
  NS.acts["ai-key-save"] = async () => {
    const v = (document.getElementById("ai-key").value || "").trim(); const msg = document.getElementById("ai-msg");
    if (!/^sk-ant-/.test(v)) { msg.textContent = "That doesn't look like an Anthropic key. It starts with sk-ant-."; return; }
    try { localStorage.setItem(KEY, v); } catch (e) { msg.textContent = "Couldn't save it on this phone."; return; }
    await NS.connectAI(); NS.acts["settings-open"](); NS.acts["ai-test"]();
  };
  NS.acts["ai-key-clear"] = async (el) => {
    if (!el.classList.contains("armed")) { el.classList.add("armed"); el.textContent = "Tap again to remove"; return; }
    try { localStorage.removeItem(KEY); } catch (e) {}
    await NS.connectAI(); NS.acts["settings-open"]();
  };
  NS.acts["ai-test"] = async () => {
    const msg = document.getElementById("ai-msg"); if (!msg || !NS.sample) return;
    msg.innerHTML = `<span class="thinking">Checking</span>`;
    const t0 = performance.now();
    try {
      const r = await NS.sample.json("This is a connection test. Set ok to true.", { effort: "low", schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false } });
      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      const dropped = Object.keys(off).filter((k) => off[k]);
      msg.innerHTML = r && r.ok === true
        ? `<span class="ok">Working.</span> Claude answered in ${secs}s.${dropped.length ? ` <span class="dim">(Running without: ${NS.esc(dropped.join(", "))}.)</span>` : ""}`
        : `<span class="warn">Connected, but the answer came back odd.</span> Setup might still work. Try adding a car.`;
    } catch (e) {
      const raw = [e.status ? "HTTP " + e.status : "", e.type, e.message, e.id].filter(Boolean).join(" · ");
      msg.innerHTML = `${NS.esc(NS.aiErrCopy ? NS.aiErrCopy(e) : "That didn't work.")}${raw ? `<div class="mono dim" style="font-size:11.5px;margin-top:6px;word-break:break-word;user-select:text">${NS.esc(raw)}</div>` : ""}`;
    }
  };
  NS.connectAssets = async () => {
    NS.assets = {
      upload: async (blob, opts = {}) => { const id = opts.id || NS.uid("p"); await put(id, blob); NS.photoURL[id] = URL.createObjectURL(blob); return { id, url: NS.photoURL[id] }; },
    };
    try { await loadAll(); } catch (e) {}
    NS.render({ quiet: true });
  };
  NS.downloads = {
    save: async ({ filename, data }) => {
      const file = new File([data], filename, { type: data.type || "application/octet-stream" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return { status: "saved" }; }
      const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      return { status: "saved" };
    },
  };


  /* ---------- offline + keep my data ---------- */
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  /* ---------- first run + install hint ---------- */
  const installed = window.navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  window.addEventListener("load", () => {
    let dismissed = false; try { dismissed = localStorage.getItem("sublevel.installHint") === "no"; } catch (e) {}
    if (!installed && ios && !dismissed) {
      const el = document.createElement("div"); el.className = "install";
      el.innerHTML = `${NS.icon("share")}<span><b>Install SUBLEVEL:</b> tap the Share button in Safari, then <b>Add to Home Screen</b>.</span><button class="iconbtn" aria-label="Dismiss">${NS.icon("x")}</button>`;
      el.querySelector("button").onclick = () => { el.remove(); try { localStorage.setItem("sublevel.installHint", "no"); } catch (e) {} };
      document.body.appendChild(el);
    }
    if (firstRun) setTimeout(() => {
      NS.sheet(NS.sheetHead("WELCOME TO SUBLEVEL", "Your build, on your phone") + `
        <p class="muted" style="margin:0 0 14px;font-size:15px">Plan the build, log the work, track the money. Everything stays on this phone and works with no signal.</p>
        <div class="day-grid" style="grid-template-columns:1fr">
          <button class="day" data-act="welcome-add"><b>Add my car</b><span>Type what you drive. You get a roadmap, a service schedule and wheel fitment for it.</span></button>
          <button class="day" data-act="close-sheet"><b>Look around first</b><span>Explore a sample '97 Civic build. It goes away when you add your car.</span></button>
          <button class="day" data-act="welcome-import"><b>Restore a backup</b><span>Bring your garage over from another phone or from claude.ai.</span></button>
        </div>`);
    }, 1900);
  });
  NS.acts["welcome-import"] = () => NS.acts["backup-open"]();
  NS.acts["welcome-add"] = () => NS.acts["add-vehicle"]();
})();
