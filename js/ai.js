/* Claude inside the garage: listing scorer, receipt scanner, Ask the Garage. Runs on the viewer's own Claude account. */
(function () {
  const NS = window.NS, D = window.NS_DATA;
  const { esc, money, num, icon } = NS;
  NS.sample = null; NS.sampleImages = false;
  NS.aiSettingsHTML = () => `<div class="infobox"><h4>AI · CLAUDE</h4><p style="margin:0;color:var(--fg-2);font-size:14.5px">${NS.sample ? "On. Here it runs on your claude.ai account: car setup, spec sheets, mod estimates, listing scores, receipts and Ask the Garage." : "Off in this view. It works when SUBLEVEL is open in the claude.ai viewer."}</p></div>`;

  NS.connectAI = async function () {
    if (!window.claude || !window.claude.use) return;
    try { NS.sample = await window.claude.use("sample"); } catch (e) { NS.sample = null; }
    try { NS.downloads = await window.claude.use("downloads"); } catch (e) { NS.downloads = null; }
    if (NS.sample) { try { const l = await NS.sample.limits(); NS.sampleImages = !!(l && l.images); } catch (e) { NS.sampleImages = false; } }
    NS.render({ quiet: true });
  };
  const errCopy = (NS.aiErrCopy = (e) => {
    const c = e && e.code;
    if (c === "bad_key") return "That API key didn't work. Check it in Settings.";
    if (c === "offline") return "No connection. AI needs the internet.";
    if (c === "bad_request") return "Claude couldn't take that request. Try again with less text.";
    if (c === "not_granted" || c === "sampling_disabled" || c === "not_declared" || c === "capability_disabled") { NS.sample = null; return "Claude isn't allowed for this page. Turn it on from the page's permissions to use this."; }
    if (c === "bad_code") return "That access code didn't work. Check it in Settings.";
    if (c === "credit_out") return "Your AI credit is used up. Add more in Settings.";
    if (c === "ai_paused") return "SUBLEVEL's AI is paused right now. Try again later.";
    if (c === "ai_server") return "SUBLEVEL's AI is having a problem on our end. Try again later.";
    if (c === "no_credit") return "Your Anthropic account is out of credit. Add some at console.anthropic.com → Billing, then try again.";
    if (c === "spend_limit") return "Your Anthropic account hit its monthly spend limit. Raise it at console.anthropic.com → Limits, or wait for it to reset.";
    if (c === "no_access") return "That key isn't allowed to use Claude Opus 5.5. Check the key's workspace at console.anthropic.com.";
    if (c === "no_model") return "Your Anthropic account can't use Claude Opus 5.5 yet. Check console.anthropic.com → Limits.";
    if (c === "overloaded") return "Claude is busy right now. Try again in a minute.";
    if (c === "too_large") return "That was too big to send. Try a smaller photo or less text.";
    if (c === "rate_limited") return "You hit your account's rate limit. New accounts start low. Wait a minute and try again.";
    if (c === "invalid_json") return "Couldn't read that one. Try again, or paste less text.";
    if (c === "refused") return "Claude wouldn't answer that one. Try rephrasing.";
    if (c === "image_rejected") return "That image didn't work. Try a clearer photo.";
    if (c === "session_expired") return "Sign in again to use this.";
    if (c === "cancelled") return "";
    return "Something went wrong. Try again.";
  });

  function garageContext() {
    const v = NS.veh(); const svc = NS.serviceStatus(v);
    const open = v.mods.filter((m) => m.status !== "done").sort((a, b) => a.phase - b.phase || a.order - b.order).slice(0, 10);
    const log = NS.sortedLog(v).slice(0, 8);
    const nm = NS.nextMoves(v)[0];
    return [
      `CAR: ${NS.vehLabel(v)} (${v.chassis}), engine ${v.engine}, ${num(v.mileage)} miles. Status: ${v.status}.`,
      `CURRENT SETUP: ${v.setup.map((s) => `${s.k}: ${s.v}${s.note ? " (" + s.note + ")" : ""}`).join("; ")}`,
      `OPEN MODS: ${open.map((m) => `[Phase ${m.phase}] ${m.title} (${m.status}, ~$${m.est})`).join("; ")}`,
      `RECENT LOG: ${log.map((l) => `${l.date} ${l.title} @${l.mileage}mi${l.notes ? " — " + l.notes : ""}`).join(" | ")}`,
      `SERVICE: ${svc.map((x) => `${x.name}: ${x.state}${x.last ? ` (last ${x.last.mi} mi)` : ""}`).join("; ")}`,
      `BUDGET LEFT: $${Math.round((v.budget || 0) - NS.spent(v))}. Current recommended next move: ${nm ? nm.title : "none"}.`,
      `OWNER: learning automotive service; DIY jobs already learned: ${(NS.S.meta.learned || []).join(", ") || "none"}.`,
      v.specs && v.specs.oil ? `SPEC SHEET: oil ${v.specs.oil.spec} (${v.specs.oil.capacity}); plugs ${v.specs.plugs ? v.specs.plugs.part + " gap " + v.specs.plugs.gap : "?"}; timing ${v.specs.timing ? v.specs.timing.type + " " + v.specs.timing.interval : "?"}; lug torque ${v.specs.wheels ? v.specs.wheels.lugTorque : "?"}; known issues: ${(v.specs.knownIssues || []).map((k) => k.title).join(", ")}.` : "",
    ].join("\n");
  }

  /* ---------- Hunt: paste a listing ---------- */
  NS.acts["hunt-paste"] = () => {
    NS.sheet(NS.sheetHead("PASTE A LISTING", "Score it with Claude") + `
      <div class="field"><label for="paste-txt">Listing text</label><textarea class="textarea" id="paste-txt" style="min-height:180px" placeholder="Paste the whole Marketplace or Craigslist ad: title, price, description…"></textarea></div>
      <p class="dim" style="font-size:13px;margin:10px 0 0">Claude reads it, fills in the card, scores it the same way as everything else, and lists questions to ask the seller.</p>
      <div id="paste-out" class="muted" style="margin-top:10px;font-size:14px"></div>
      <div class="sheet-foot"><span class="grow"></span><button class="btn ghost" data-act="close-sheet">Cancel</button><button class="btn primary" data-act="paste-go">${icon("spark")}Score it</button></div>`, { focus: true });
  };
  NS.acts["paste-go"] = async (el) => {
    const txt = (document.getElementById("paste-txt").value || "").trim().slice(0, 12000);
    const out = document.getElementById("paste-out");
    if (txt.length < 20) { out.textContent = "Paste the listing text first."; return; }
    el.disabled = true; out.innerHTML = `<span class="thinking">Reading the listing</span>`;
    const v = NS.veh();
    const prompt = `You score used-car listings for an enthusiast who loves older Japanese cars, manual transmissions, Y2K/JDM builds and DIY repair. Their current project is a ${NS.vehLabel(v)} and their build budget is about $${v.budget}.
Read the listing and reply with ONLY this JSON (use null when the listing doesn't say):
{"year":1999,"title":"Civic Si","make":"Honda","price":5800,"miles":142000,"location":"Denver, CO","trans":"Manual","drive":"FWD","tags":["jdm"],"scores":{"price":7,"reliability":8,"fun":9,"mod":9,"risk":3},"summary":"one plain sentence","redFlags":["..."],"questions":["..."]}
Rules: trans is "Manual" or "Auto". drive is "FWD", "RWD" or "AWD". tags may include "jdm" (Japanese make) and "turbo". Each score is 0-10: price (10 = well under typical market for that car and mileage), reliability (model reputation adjusted for miles and condition clues), fun, mod (aftermarket support), risk (10 = scary: vague ad, title problems, rust, mods with no receipts, "needs TLC", no cold start). At most 4 redFlags quoting or naming what in the ad worries you, and at most 4 specific questions to ask the seller.

LISTING:
"""
${txt}
"""`;
    try {
      const r = await NS.sample.json(prompt, { modelTier: "default" });
      if (!r || typeof r !== "object") throw { code: "invalid_json" };
      const s = r.scores || {};
      const cl = (n) => Math.max(0, Math.min(10, Math.round(+n || 5)));
      const notes = [r.summary, r.redFlags && r.redFlags.length ? "Red flags: " + r.redFlags.join("; ") : "", r.questions && r.questions.length ? "Ask: " + r.questions.join(" / ") : ""].filter(Boolean).join("\n");
      NS.closeSheet();
      NS.huntForm({
        year: +r.year || new Date().getFullYear() - 25, title: r.title || "", make: r.make || "", price: +r.price || 0, miles: +r.miles || 0,
        location: r.location || "", trans: r.trans === "Auto" ? "Auto" : "Manual", drive: ["FWD", "RWD", "AWD"].includes(r.drive) ? r.drive : "FWD",
        tags: Array.isArray(r.tags) ? r.tags.filter((t) => ["jdm", "turbo"].includes(t)) : [], source: "Marketplace", status: "new", listed: NS.today(),
        scores: { price: cl(s.price), reliability: cl(s.reliability), fun: cl(s.fun), mod: cl(s.mod), risk: cl(s.risk) }, notes,
      }, "SCORED BY CLAUDE");
    } catch (e) { out.textContent = errCopy(e); el.disabled = false; }
  };

  /* ---------- Money: scan a receipt ---------- */
  NS.acts["receipt-scan"] = () => {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*";
    inp.onchange = async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      NS.sheet(NS.sheetHead("RECEIPT", "Reading your receipt") + `<div class="empty"><span class="thinking">Reading the receipt</span></div>`);
      try {
        const r = await NS.sample.json(`This photo is a receipt for car parts, tools or service. Reply with ONLY JSON: {"item":"what was bought, 6 words max","amount":12.34,"date":"YYYY-MM-DD or null","cat":"one of ${D.expenseCats.join(", ")}"}. amount is the total paid including tax.`, { images: [f], modelTier: "default" });
        NS.closeSheet();
        NS.expenseForm({ item: r.item || "", amount: Math.round((+r.amount || 0) * 100) / 100, date: /^\d{4}-\d{2}-\d{2}$/.test(r.date || "") ? r.date : NS.today(), cat: D.expenseCats.includes(r.cat) ? r.cat : "Maintenance", worth: 0 });
      } catch (e) { NS.closeSheet(); NS.toast(errCopy(e) || "Cancelled"); }
    };
    inp.click();
  };

  /* ---------- LEARN › Ask the Garage ---------- */
  const SUGGEST = ["What should I check before I start the brake job?", "Why does my idle hunt on cold starts?", "Explain how VTEC works on the D16Y8.", "Will 15x8 +28 rub if I lower it 2 inches?", "What tools should I buy next, in order?"];
  const chat = () => { if (!NS.ui.chat) { try { NS.ui.chat = JSON.parse(localStorage.getItem("sublevel.chat") || "[]"); } catch (e) { NS.ui.chat = []; } } return NS.ui.chat; };
  const saveChat = () => { try { localStorage.setItem("sublevel.chat", JSON.stringify(chat().slice(-20))); } catch (e) {} };
  const fmt = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/^#+\s*(.+)$/gm, "<b>$1</b>").replace(/^\s*[-*]\s+/gm, "• ");

  NS.views.ask = function () {
    const c = chat();
    if (!NS.sample) return `${NS.subnav()}
      <div class="page-head"><div><div class="eyebrow">ASK THE GARAGE</div><h1 class="h1" style="margin-top:6px">A mechanic who knows your car</h1><p class="lede">Ask anything about your build. It already knows your car, your mods, your log and what's due.</p></div></div>
      <div class="empty">${NS.standalone ? `Ask the Garage needs AI turned on. <button class="vio" data-act="settings-open" style="text-decoration:underline">Turn it on in Settings</button>.` : "Ask the Garage uses your Claude account, so it only works when SUBLEVEL is open in the claude.ai viewer."}</div>`;
    return `${NS.subnav()}
    <div class="page-head"><div><div class="eyebrow">ASK THE GARAGE · ${esc(NS.veh().chassis)}</div><h1 class="h1" style="margin-top:6px">A mechanic who knows your car</h1><p class="lede">It already knows your car, your mods, your log and what's due. Safety first, and it'll tell you when to stop.</p></div>
      ${c.length ? `<button class="btn ghost sm" data-act="ask-clear">${icon("trash")}Clear</button>` : ""}</div>
    <div class="chat" id="chat">${c.map((m) => `<div class="msg ${m.role}">${m.role === "assistant" ? fmt(m.content) : esc(m.content)}</div>`).join("") || `<div class="chips wrap">${SUGGEST.map((q) => `<button class="chip" data-act="ask-suggest">${esc(q)}</button>`).join("")}</div>`}</div>
    <form class="ask-bar" id="ask-form" onsubmit="return false">
      <textarea class="textarea" id="ask-q" rows="1" placeholder="Ask about your car…" aria-label="Your question"></textarea>
      <button class="btn primary" data-act="ask-send" id="ask-send">${icon("arrow")}</button>
    </form>
    <p class="dim" style="font-size:12.5px;margin-top:8px">Answers can be wrong. Verify torque specs and procedures in a service manual before you wrench.</p>`;
  };
  NS.after.ask = () => { const el = document.getElementById("chat"); if (el) el.scrollTop = el.scrollHeight; const q = document.getElementById("ask-q"); if (q) q.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); NS.acts["ask-send"](); } }); };
  NS.acts["ask-suggest"] = (el) => { document.getElementById("ask-q").value = el.textContent; NS.acts["ask-send"](); };
  NS.acts["ask-clear"] = () => { NS.ui.chat = []; saveChat(); NS.render({ quiet: true }); };
  NS.acts["ask-send"] = async () => {
    if (NS._askCtl) { NS._askCtl.abort(); return; }
    const q = document.getElementById("ask-q"); const text = (q.value || "").trim(); if (!text) return;
    const c = chat(); c.push({ role: "user", content: text }); q.value = "";
    NS.render({ quiet: true });
    const box = document.getElementById("chat");
    const bubble = document.createElement("div"); bubble.className = "msg assistant"; bubble.innerHTML = `<span class="thinking">Thinking</span>`; box.appendChild(bubble); box.scrollTop = box.scrollHeight;
    const btn = document.getElementById("ask-send"); btn.innerHTML = icon("stop");
    const rules = `You are the garage assistant inside SUBLEVEL, a private car-build app. The owner is a young enthusiast learning automotive service on their own car. Here is everything the app knows about the car:\n\n${garageContext()}\n\nAnswer like an experienced, friendly mechanic: direct, practical, plain language, no fluff. Safety and reliability before cosmetics. Say clearly when a job needs a professional or a lift. Give torque specs or part numbers only with "verify in the service manual". Keep answers under 180 words unless asked for detail. Use short lists when listing steps. No markdown headings.`;
    const turns = [{ role: "user", content: rules }, ...c.slice(-10)];
    NS._askCtl = new AbortController();
    try {
      const r = await NS.sample(turns, { signal: NS._askCtl.signal, cache: false, onText: ({ text: t }) => { bubble.innerHTML = fmt(t); box.scrollTop = box.scrollHeight; } });
      c.push({ role: "assistant", content: r.text });
    } catch (e) {
      const keep = e && e.text; const msg = errCopy(e);
      if (keep) c.push({ role: "assistant", content: keep + (msg ? "\n\n(" + msg + ")" : "") });
      else if (msg) c.push({ role: "assistant", content: msg });
      else c.pop();
    } finally {
      NS._askCtl = null; saveChat(); if (NS.route === "ask") NS.render({ quiet: true });
    }
  };
})();
