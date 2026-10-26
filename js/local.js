/* Phone app mode: everything stays on this device. Data in localStorage, photos in IndexedDB, offline via service worker. */
(function () {
  const NS = window.NS;
  NS.standalone = true;
  const firstRun = (() => { try { return !localStorage.getItem("sublevel.v1"); } catch (e) { return false; } })();

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
  /* ---------- AI: Claude through the user's own Anthropic API key, kept only on this phone ---------- */
  const MODEL = "claude-opus-5-5";
  const KEY = "sublevel.apikey";
  const getKey = () => { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } };
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
    const client = new window.Anthropic({ apiKey: getKey(), dangerouslyAllowBrowser: true });
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
    NS.sample = getKey() && window.Anthropic ? makeSample() : null;
    NS.sampleImages = !!NS.sample; NS.downloads = NS.downloads || null;
    NS.render({ quiet: true });
  };
  NS.aiSettingsHTML = () => {
    const k = getKey();
    return `<div class="infobox"><h4>AI · CLAUDE</h4>${k
      ? `<p style="margin:0;color:var(--fg-2);font-size:14.5px"><b class="ok">On.</b> Uses your Anthropic API key, saved only on this phone (it's never in backups). Model: Claude Opus 5.5. A full car setup costs about 15–30¢, a question or estimate a few cents.</p>
         <div id="ai-msg" class="muted" style="font-size:13.5px;margin-top:8px"></div>
         <div class="row" style="margin-top:10px"><button class="btn sm" data-act="ai-test">${NS.icon("spark")}Test it</button><button class="btn sm danger" data-act="ai-key-clear">Remove key</button></div>`
      : `<p style="margin:0;color:var(--fg-2);font-size:14.5px"><b style="color:var(--fg)">Off.</b> Add an Anthropic API key to have SUBLEVEL set up any car, fill in spec sheets, estimate mods, score listings, read receipts and answer questions. Get one at <b style="color:var(--fg)">console.anthropic.com</b> → API Keys (needs a few dollars of credit). It's saved only on this phone and only sent to Anthropic.</p>
         <div class="row" style="margin-top:10px;flex-wrap:nowrap"><input class="input" id="ai-key" type="password" placeholder="sk-ant-…" autocomplete="off" style="flex:1"><button class="btn primary sm" data-act="ai-key-save">Save</button></div>
         <div id="ai-msg" class="muted" style="font-size:13.5px;margin-top:8px"></div>`}</div>`;
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
