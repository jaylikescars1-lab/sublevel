/* Core: state, persistence, routing, sheets, shared helpers, build math. */
(function () {
  const NS = (window.NS = window.NS || {});
  const D = window.NS_DATA;
  NS.views = {};
  NS.after = {};
  NS.acts = {};
  NS.inputs = {};
  NS.ui = { huntFilters: [], huntSort: "score", invKind: "tool", invFilter: "all", diyQ: "", diyDiff: "all", styleCat: "all", styleTag: "all", openMods: {}, modFilter: "all" };

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const uid = (p = "x") => p + Math.random().toString(36).slice(2, 9);
  const money = (n) => (n < 0 ? "−$" : "$") + Math.abs(Math.round(n || 0)).toLocaleString("en-US");
  const num = (n) => Math.round(n || 0).toLocaleString("en-US");
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const parseDate = (s) => { const [y, m, d] = String(s || "").split("-").map(Number); return new Date(y || 2000, (m || 1) - 1, d || 1); };
  const fmtDate = (s) => { const d = parseDate(s); return MON[d.getMonth()] + " " + String(d.getDate()).padStart(2, "0"); };
  const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const daysAgo = (s) => {
    const n = Math.round((new Date().setHours(0, 0, 0, 0) - parseDate(s).getTime()) / 864e5);
    return n <= 0 ? "today" : n === 1 ? "yesterday" : n + " days ago";
  };
  Object.assign(NS, { $, $$, esc, clone, uid, money, num, clamp, MON, parseDate, fmtDate, today, daysAgo });

  /* ---------- icons (stroke, 24 grid) ---------- */
  const P = {
    garage: '<path d="M3 10.5 12 4l9 6.5V20H3z"/><path d="M7 20v-6h10v6M7 17h10"/>',
    build: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    track: '<path d="M4 19V5M4 19h16"/><path d="m7 14 4-4 3 3 5-6"/>',
    learn: '<path d="M14.7 6.3a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3z"/><path d="m3 21 3-3"/>',
    hunt: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4M11 8v6M8 11h6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    chev: '<path d="m9 6 6 6-6 6"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    star: '<path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    wheel: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/>',
    calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M14 11h2M8 15h2M14 15h2M8 18h2M14 18h2"/>',
    sound: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
    board: '<rect x="3" y="3" width="8" height="10" rx="1"/><rect x="13" y="3" width="8" height="6" rx="1"/><rect x="13" y="11" width="8" height="10" rx="1"/><rect x="3" y="15" width="8" height="6" rx="1"/>',
    log: '<path d="M6 3h12v18H6z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
    money: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9v.01M18 15v.01"/>',
    box: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="m3 7.5 9 4.5 9-4.5M12 12v9"/>',
    clip: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10l2 2 4-4M9 16h6"/>',
    car: '<path d="M3 15v-3l2-4h10l4 4h2v3z"/><circle cx="7" cy="16" r="2"/><circle cx="17" cy="16" r="2"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    rank: '<path d="M12 3 4 7v6c0 4 3.5 7 8 8 4.5-1 8-4 8-8V7z"/><path d="m9 12 2 2 4-4"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    play: '<path d="M7 5v14l11-7z"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
    share: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v7h14v-7"/>',
    dots: '<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>',
    cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M3 4h2l2.4 11h10.8L21 8H6.2"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  };
  NS.icon = (n, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ""}</svg>`;

  /* ---------- state + persistence ---------- */
  const LS = "sublevel.v1";
  const DOCS = ["meta", "hunt", "inventory", "style", "checklist"];
  let S;
  try { const raw = localStorage.getItem(LS) || localStorage.getItem("nightshift.v1"); S = raw ? JSON.parse(raw) : null; } catch (e) { S = null; }
  if (!S || !S.vehicles || !S.meta) S = clone(window.NS_SEED);
  NS.S = S;

  /* The 1996–2000 Civic (EK coupe/hatch, EJ coupe, EM Si): Honda's schedule, specs and calibrated fitment apply. */
  NS.isEK = (v) => /^(EK|EJ|EM)\d?$/i.test((v && v.chassis) || "") || (/honda/i.test((v && v.make) || "") && /^D16Y[578]\b/i.test((v && v.engine) || ""));
  /* Fill in fields newer versions added, without writing anything until the next real edit. */
  NS.migrate = function () {
    for (const v of Object.values(S.vehicles)) {
      if (!Array.isArray(v.service)) {
        const known = D.serviceKnown[v.id] || {};
        v.service = D.service.map((x) => ({ id: x.id, everyMi: x.everyMi, everyMo: x.everyMo, known: known[x.id] || null }));
        if (NS.isEK(v)) { v.driving = "severe"; v.svcVer = 2; }
      }
      if (NS.isEK(v) && (v.svcVer || 0) < 2) factorySchedule(v);
      if (NS.isEK(v) && !(v.specs && v.specs.oil)) v.specs = { ...clone(D.ekSpecs), ...(v.specs || {}) };
      v.log = v.log || []; v.expenses = v.expenses || []; v.mods = v.mods || [];
    }
    S.meta = S.meta || {}; S.meta.learned = S.meta.learned || [];
    S.hunt = S.hunt || { items: [] }; S.inventory = S.inventory || { items: [] }; S.style = S.style || { items: [] };
    S.checklist = S.checklist || { active: "adhoc", marks: {} };
  };
  /* Move intervals still at the old app defaults to Honda's factory schedule; anything the owner edited stays. */
  function factorySchedule(v) {
    v.driving = v.driving || "severe";
    v.service.forEach((it) => {
      const def = D.service.find((x) => x.id === it.id), old = D.serviceOld[it.id];
      if (def && def.factory && old && it.everyMi === old[0] && it.everyMo === old[1]) [it.everyMi, it.everyMo] = def.factory[v.driving];
    });
    if (!v.service.some((x) => x.id === "brakes")) { const b = D.service.find((x) => x.id === "brakes"); v.service.splice(1, 0, { id: "brakes", everyMi: b.factory[v.driving][0], everyMo: b.factory[v.driving][1], known: null }); }
    v.svcVer = 2;
  }
  NS.migrate();

  NS.veh = () => S.vehicles[S.meta.active] || Object.values(S.vehicles)[0];

  const pending = new Map();   // key -> timer
  const inflight = new Map();  // key -> promise
  const dirtyAgain = new Set();
  NS.db = null;

  function setSync(s, label) {
    const el = $("#sync"); if (!el) return;
    el.dataset.s = s; el.querySelector("span").textContent = label;
  }
  NS.setSync = setSync;

  function saveLocal() { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} }

  function docRef(key) {
    if (key.startsWith("v:")) return NS.db.collection("vehicles").doc(key.slice(2));
    return NS.db.collection("ns").doc(key);
  }
  function docData(key) {
    if (key.startsWith("v:")) return S.vehicles[key.slice(2)];
    return S[key];
  }
  async function writeDoc(key) {
    if (!NS.db) return;
    if (inflight.has(key)) { dirtyAgain.add(key); return; }
    const data = docData(key);
    setSync("saving", "SAVING");
    const p = (data ? docRef(key).set(clone(data)) : docRef(key).delete())
      .then(() => setSync("live", "SYNCED"))
      .catch((e) => {
        if (e && e.code === "unavailable") return new Promise((r) => setTimeout(r, 800 + Math.random() * 800)).then(() => docRef(key).set(clone(docData(key)))).then(() => setSync("live", "SYNCED"));
        setSync("local", "ON DEVICE");
        if (e && e.code === "invalid_argument") NS.toast("Can't save to the shared garage from this view");
        else if (e && e.code === "quota_exceeded") NS.toast("Storage is full. Delete some photos or entries.");
      })
      .catch(() => setSync("local", "ON DEVICE"))
      .finally(() => {
        inflight.delete(key);
        if (dirtyAgain.has(key)) { dirtyAgain.delete(key); writeDoc(key); }
      });
    inflight.set(key, p);
  }

  /* Save one document: device immediately, shared store after a short pause. */
  NS.commit = function (key, opts = {}) {
    saveLocal();
    if (NS.db) {
      clearTimeout(pending.get(key));
      pending.set(key, setTimeout(() => { pending.delete(key); writeDoc(key); }, 600));
      setSync("saving", "SAVING");
    }
    if (!opts.silent) NS.render();
    if (NS.progressCheck && !opts.noProgress) NS.progressCheck();
  };
  NS.commitVeh = (opts) => NS.commit("v:" + NS.veh().id, opts);

  /* Shared store: subscribe once per collection, apply remote docs unless we have a local write queued. */
  NS.connect = async function () {
    if (!window.claude || !window.claude.use) { setSync("local", "ON DEVICE"); return; }
    let db = null;
    try { db = await window.claude.use("db"); } catch (e) { db = null; }
    if (!db) { setSync("local", "ON DEVICE"); return; }
    NS.db = db;
    setSync("live", "SYNCED");
    const busy = (key) => pending.has(key) || inflight.has(key);
    const apply = (changed) => {
      if (!changed) return;
      saveLocal();
      const a = document.activeElement;
      if (a && a.closest && a.closest("#view") && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) { NS._deferRender = true; return; }
      NS.render({ quiet: true });
    };
    db.collection("ns").onSnapshot((snap) => {
      let changed = false;
      snap.docs.forEach((d) => {
        if (!DOCS.includes(d.id) || busy(d.id) || d.metadata.hasPendingWrites) return;
        const next = d.data();
        if (JSON.stringify(next) !== JSON.stringify(S[d.id])) { S[d.id] = clone(next); changed = true; }
      });
      if (changed) { NS.migrate(); if (NS.onRemote) NS.onRemote(); }
      apply(changed);
    }, () => setSync("local", "ON DEVICE"));
    db.collection("vehicles").onSnapshot((snap) => {
      let changed = false;
      snap.docs.forEach((d) => {
        const key = "v:" + d.id;
        if (busy(key) || d.metadata.hasPendingWrites) return;
        const next = d.data();
        if (JSON.stringify(next) !== JSON.stringify(S.vehicles[d.id])) { S.vehicles[d.id] = clone(next); changed = true; }
      });
      if (changed) { NS.migrate(); if (NS.onRemote) NS.onRemote(); }
      apply(changed);
    }, () => setSync("local", "ON DEVICE"));
  };
  document.addEventListener("focusout", () => setTimeout(() => {
    if (NS._deferRender && !(document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) { NS._deferRender = false; NS.render({ quiet: true }); }
  }, 50));

  /* Photos: uploaded through the artifact's asset store; rows keep the id. */
  NS.assets = null;
  NS.connectAssets = async function () {
    if (!window.claude || !window.claude.use) return;
    try { NS.assets = await window.claude.use("assets"); } catch (e) { NS.assets = null; }
    if (NS.assets) NS.render({ quiet: true });
  };
  NS.img = (id) => (id ? "/_blob/" + id : "");
  NS.pickPhoto = function () {
    return new Promise((resolve) => {
      if (!NS.assets) { NS.toast("Photo uploads need edit access to this garage"); return resolve(null); }
      const inp = document.createElement("input");
      inp.type = "file"; inp.accept = "image/*";
      inp.onchange = async () => {
        const f = inp.files && inp.files[0]; if (!f) return resolve(null);
        NS.toast("Uploading photo…");
        try {
          const blob = await downscale(f, 2000);
          const r = await NS.assets.upload(blob, { type: blob.type || "image/jpeg" });
          resolve(r.id);
        } catch (e) { NS.toast("Upload failed. Try a smaller photo."); resolve(null); }
      };
      inp.click();
    });
  };
  function downscale(file, max) {
    return new Promise((res) => {
      if (!/^image\/(jpeg|png|webp)/.test(file.type)) return res(file);
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        if (s === 1 && file.size < 2.5e6) return res(file);
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        c.toBlob((b) => res(b || file), "image/jpeg", 0.86);
      };
      img.onerror = () => res(file);
      img.src = URL.createObjectURL(file);
    });
  }

  /* ---------- routing + nav ---------- */
  /* Four sections up front. Routes marked x are the expert tools: one tap deeper, in the More drawer. */
  NS.groups = [
    { key: "GARAGE", icon: "garage", routes: [{ r: "garage", l: "Garage", i: "garage" },
      { r: "ask", l: "Ask the Garage", i: "chat", x: 1, d: "Ask Claude anything about your car" }] },
    { key: "BUILD", icon: "build", routes: [
      { r: "build", l: "My Build", i: "car" }, { r: "fitment", l: "Fitment", i: "wheel" }, { r: "style", l: "Style Board", i: "board" },
      { r: "diy", l: "DIY Garage", i: "learn", x: 1, d: "Step-by-step jobs, with tools and torque specs" },
      { r: "calc", l: "Mod Calculator", i: "calc", x: 1, d: "What a mod really costs, all in" },
      { r: "sound", l: "Sound Lab", i: "sound", x: 1, d: "Exhaust and audio, planned before you buy" }] },
    { key: "TRACK", icon: "track", routes: [{ r: "log", l: "Log", i: "log" }, { r: "service", l: "Service", i: "clock" }, { r: "money", l: "Money", i: "money" },
      { r: "inventory", l: "Inventory", i: "box", x: 1, d: "Tools you own, parts waiting to go on" },
      { r: "rank", l: "Rank", i: "rank", x: 1, d: "XP, levels, badges and your streak" }] },
    { key: "HUNT", icon: "hunt", routes: [{ r: "hunt", l: "Hunt List", i: "hunt" }, { r: "inspect", l: "Inspection", i: "clip" }] },
  ];
  const ALL = NS.groups.flatMap((g) => g.routes.map((x) => ({ ...x, g: g.key })));
  NS.route = "garage";
  NS.lastIn = {};
  NS.groupOf = (r) => (ALL.find((x) => x.r === r) || ALL[0]).g;
  /* Simple mode (new people start here): no rank or streaks, and the hunt and style tools move into More. */
  NS.simple = () => NS.S.meta.mode === "simple";
  const SIMPLE_MORE = ["style", "hunt", "inspect"], SIMPLE_HIDE = ["rank"];
  const isX = (r) => !!(ALL.find((x) => x.r === r) || {}).x || (NS.simple() && SIMPLE_MORE.includes(r));
  const shown = (r) => !(NS.simple() && SIMPLE_HIDE.includes(r));

  NS.go = function (r, opts = {}) {
    if (!NS.views[r]) r = "garage";
    NS.route = r;
    if (!isX(r)) NS.lastIn[NS.groupOf(r)] = r;
    try { if (location.hash.slice(1) !== r) history.replaceState(null, "", "#" + r); } catch (e) {}
    NS.render();
    if (!opts.keepScroll) window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  };

  function renderNav() {
    const g = NS.groupOf(NS.route), x = isX(NS.route);
    const tabs = NS.groups.filter((t) => t.routes.some((rt) => !isX(rt.r)));
    $("#tabbar").innerHTML = tabs.map((t) =>
      `<button data-act="tab" data-g="${t.key}" aria-current="${!x && t.key === g}">${NS.icon(t.icon)}<span>${t.key}</span></button>`).join("") +
      `<button data-act="more-open" aria-current="${x}">${NS.icon("dots")}<span>MORE</span></button>`;
    const link = (rt) => `<button data-act="go" data-r="${rt.r}" aria-current="${rt.r === NS.route}">${NS.icon(rt.i)}${rt.l}</button>`;
    $("#sidebar").innerHTML = `<div class="sb-brand"><div class="row" style="gap:8px;flex-wrap:nowrap"><div class="wordmark">SUBLEVEL</div><span class="lvl-sign">B2</span></div><span class="px">BUILD / TRACK / HUNT</span><div id="sb-rank"></div></div>` +
      tabs.map((t) => `<h6>${t.key}</h6>` + t.routes.filter((rt) => !isX(rt.r)).map(link).join("")).join("") +
      `<h6>MORE</h6>` + ALL.filter((rt) => isX(rt.r) && shown(rt.r)).map(link).join("") +
      `<div class="sb-foot"><button data-act="settings-open" style="padding:6px 0;margin-bottom:8px">${NS.icon("build")}Settings</button><span class="px dim">SL-OS 1.0 · ${esc(vehLabel(NS.veh()))}</span></div>`;
    const cur = ALL.find((r) => r.r === NS.route);
    $("#crumb").textContent = "/ " + (cur ? cur.l.toUpperCase() : "");
  }
  NS.subnav = function () {
    const g = NS.groups.find((t) => t.key === NS.groupOf(NS.route));
    if (!g) return "";
    const items = g.routes.filter((rt) => (!isX(rt.r) || rt.r === NS.route) && shown(rt.r));
    if (items.length < 2) return "";
    return `<nav class="subnav" aria-label="${g.key}">${items.map((rt) => `<button data-act="go" data-r="${rt.r}" aria-current="${rt.r === NS.route}">${rt.l.toUpperCase()}</button>`).join("")}</nav>`;
  };

  /* The More drawer: every expert tool, plus settings. */
  NS.acts["more-open"] = () => {
    const row = (rt) => `<button class="more-row" data-act="more-go" data-r="${rt.r}">${NS.icon(rt.i)}<span><b>${esc(rt.l)}</b><span>${esc(rt.d || "")}</span></span>${NS.icon("chev")}</button>`;
    const desc = { style: "Pin wheels, colors and parts, then see the plan on your car", hunt: "Score cars for sale before you buy", inspect: "A checklist for looking at a car in person" };
    const list = ALL.filter((rt) => isX(rt.r) && shown(rt.r)).map((rt) => ({ ...rt, d: rt.d || desc[rt.r] }));
    NS.sheet(NS.sheetHead("MORE", "Tools") + `<div class="more-list">${list.map(row).join("")}
      <button class="more-row" data-act="settings-open">${NS.icon("build")}<span><b>Settings</b><span>AI, backup, import and export</span></span>${NS.icon("chev")}</button>
      ${NS.simple()
        ? `<button class="more-row" data-act="mode-set" data-m="full">${NS.icon("board")}<span><b>Show everything</b><span>Adds rank, streaks, quick wins, telemetry and the hunt tab</span></span>${NS.icon("chev")}</button>`
        : `<button class="more-row" data-act="mode-set" data-m="simple">${NS.icon("board")}<span><b>Simple mode</b><span>Just your garage, build, log, service and money</span></span>${NS.icon("chev")}</button>`}</div>`);
  };
  NS.acts["mode-set"] = (el) => {
    NS.S.meta.mode = el.dataset.m === "simple" ? "simple" : "full";
    NS.commit("meta", { silent: true, noProgress: true });
    NS.closeSheet(); NS.progressInit && NS.progressInit();
    NS.go(shown(NS.route) ? NS.route : "garage");
    NS.toast(NS.simple() ? "Simple mode on" : "Showing everything");
  };
  NS.acts["more-go"] = (el) => { NS.closeSheet(); NS.go(el.dataset.r); };

  NS.render = function (opts = {}) {
    renderNav();
    const v = $("#view");
    const html = NS.views[NS.route]();
    v.innerHTML = `<div class="view"${opts.quiet ? ' style="animation:none"' : ""}>${html}</div>`;
    if (NS.after[NS.route]) NS.after[NS.route](opts);
    if (NS.chrome) NS.chrome();
  };

  /* ---------- events ---------- */
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const fn = NS.acts[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  document.addEventListener("input", (e) => {
    const el = e.target.closest("[data-in]");
    if (el && NS.inputs[el.dataset.in]) NS.inputs[el.dataset.in](el, e);
  });
  document.addEventListener("change", (e) => {
    const el = e.target.closest("[data-ch]");
    if (el && NS.inputs[el.dataset.ch]) NS.inputs[el.dataset.ch](el, e);
  });
  NS.acts.go = (el) => NS.go(el.dataset.r);
  NS.acts.tab = (el) => {
    const g = NS.groups.find((x) => x.key === el.dataset.g);
    NS.go(NS.lastIn[g.key] || g.routes[0].r);
  };

  NS.toast = function (msg) {
    // Long enough to read: about 60 ms a character, between 2.4 and 7 seconds.
    const ms = Math.min(7000, Math.max(2400, String(msg).length * 60));
    const t = $("#toast"); t.setAttribute("role", "status"); t.innerHTML = ""; const d = document.createElement("div"); d.textContent = msg; d.style.animationDuration = ms + "ms"; t.appendChild(d);
    clearTimeout(NS._tt); NS._tt = setTimeout(() => (t.innerHTML = ""), ms + 100);
  };

  /* ---------- sheets + generic form ---------- */
  NS.sheet = function (inner, opts = {}) {
    const root = $("#sheet-root");
    root.innerHTML = `<div class="sheet-wrap" role="dialog" aria-modal="true"><div class="sheet-bg" data-act="close-sheet"></div><div class="sheet">${opts.noGrab ? "" : '<div class="grab"></div>'}${inner}</div></div>`;
    document.body.style.overflow = "hidden";
    const first = root.querySelector("input,select,textarea");
    if (first && opts.focus && matchMedia("(min-width:720px)").matches) first.focus();
    return root.querySelector(".sheet");
  };
  NS.closeSheet = () => { $("#sheet-root").innerHTML = ""; document.body.style.overflow = ""; NS._form = null; };
  NS.acts["close-sheet"] = () => NS.closeSheet();
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#sheet-root").innerHTML) NS.closeSheet(); });

  NS.sheetHead = (eyebrow, title) => `<div class="sheet-head"><div><div class="eyebrow">${esc(eyebrow)}</div><div class="h3" style="margin-top:4px">${esc(title)}</div></div><button class="iconbtn" data-act="close-sheet" aria-label="Close">${NS.icon("x")}</button></div>`;

  /* fields: [{k, l, t:'text|textarea|number|money|date|select|range|list|color|photos|check|seg', o:options, full, min, max, step, ph}] */
  NS.form = function ({ eyebrow = "EDIT", title, intro = "", fields, value = {}, onSave, onDelete, saveLabel = "Save" }) {
    const v = clone(value);
    const state = { photos: {} };
    const fid = (k) => "f_" + k;
    const opt = (o) => (typeof o === "string" ? { v: o, l: o } : o);
    const field = (f) => {
      if (f.t === "note") return `<div class="field full form-note">${f.html}</div>`;
      const val = v[f.k];
      const cls = f.full || ["textarea", "list", "photos", "seg", "range", "check"].includes(f.t) ? "field full" : "field";
      let input = "";
      switch (f.t) {
        case "textarea": input = `<textarea class="textarea" id="${fid(f.k)}" placeholder="${esc(f.ph || "")}">${esc(val)}</textarea>`; break;
        case "list": input = `<textarea class="textarea" id="${fid(f.k)}" placeholder="One per line">${esc((val || []).join("\n"))}</textarea>`; break;
        case "money": input = `<div class="prefix"><span>$</span><input class="input money" inputmode="decimal" type="number" step="any" id="${fid(f.k)}" value="${esc(val ?? "")}"></div>`; break;
        case "number": input = `<input class="input num" inputmode="decimal" type="number" step="${f.step || "any"}" id="${fid(f.k)}" value="${esc(val ?? "")}" ${f.min != null ? `min="${f.min}"` : ""}>`; break;
        case "date": input = `<input class="input" type="date" id="${fid(f.k)}" value="${esc(val || today())}">`; break;
        case "color": input = `<div class="row"><input type="color" id="${fid(f.k)}" value="${esc(val || "#6a3df0")}" style="width:52px;height:42px;border:1px solid var(--line-2);border-radius:10px;background:none;padding:3px"><span class="dim mono" style="font-size:12px">Swatch</span></div>`; break;
        case "select": input = `<select class="select" id="${fid(f.k)}">${f.o.map(opt).map((o) => `<option value="${esc(o.v)}"${String(o.v) === String(val) ? " selected" : ""}>${esc(o.l)}</option>`).join("")}</select>`; break;
        case "range": input = `<div class="ctrl"><span class="lbl">${esc(f.l)}</span><output id="${fid(f.k)}_o">${esc(val ?? f.min)}</output><input type="range" id="${fid(f.k)}" min="${f.min}" max="${f.max}" step="${f.step || 1}" value="${esc(val ?? f.min)}" oninput="this.previousElementSibling.textContent=this.value"></div>`; break;
        case "check": input = `<label class="check"><input type="checkbox" id="${fid(f.k)}"${val ? " checked" : ""}> ${esc(f.l)}</label>`; break;
        case "seg": input = `<div class="seg" id="${fid(f.k)}" data-val="${esc(val ?? "")}">${f.o.map(opt).map((o) => `<button type="button" aria-pressed="${String(o.v) === String(val)}" data-v="${esc(o.v)}" onclick="for(const b of this.parentNode.children)b.setAttribute('aria-pressed',b===this);this.parentNode.dataset.val=this.dataset.v">${esc(o.l)}</button>`).join("")}</div>`; break;
        case "multi": input = `<div class="chips wrap" id="${fid(f.k)}">${f.o.map((o) => `<button type="button" class="chip" aria-pressed="${(val || []).includes(o)}" data-v="${esc(o)}" onclick="this.setAttribute('aria-pressed',this.getAttribute('aria-pressed')!=='true')">${esc(o)}</button>`).join("")}</div>`; break;
        case "photos": {
          state.photos[f.k] = Array.isArray(val) ? val.slice() : val ? [val] : [];
          input = `<div class="photos" id="${fid(f.k)}"></div>`; break;
        }
        default: input = `<input class="input" type="text" id="${fid(f.k)}" value="${esc(val ?? "")}" placeholder="${esc(f.ph || "")}">`;
      }
      const lab = f.t === "range" || f.t === "check" ? "" : `<label for="${fid(f.k)}">${esc(f.l)}</label>`;
      return `<div class="${cls}">${lab}${input}</div>`;
    };
    const html = NS.sheetHead(eyebrow, title) +
      (intro ? `<div class="form-intro">${intro}</div>` : "") +
      `<form id="ns-form" class="form-grid" autocomplete="off">${fields.map(field).join("")}</form>` +
      `<div class="sheet-foot">${onDelete ? `<button class="btn danger" data-act="form-del">${NS.icon("trash")}Delete</button>` : ""}<span class="grow"></span><button class="btn ghost" data-act="close-sheet">Cancel</button><button class="btn primary" data-act="form-save">${esc(saveLabel)}</button></div>`;
    NS.sheet(html, { focus: true });
    NS._form = { fields, v, onSave, onDelete, state, single: {} };
    fields.filter((f) => f.t === "photos").forEach((f) => { NS._form.single[f.k] = !!f.single; drawPhotos(f.k); });
    $("#ns-form").addEventListener("submit", (e) => { e.preventDefault(); NS.acts["form-save"](); });
  };
  function drawPhotos(k) {
    const F = NS._form; if (!F) return;
    const box = $("#f_" + k); const arr = F.state.photos[k];
    box.innerHTML = arr.map((id, i) => `<div style="position:relative"><img src="${NS.img(id)}" alt="" loading="lazy"><button type="button" class="iconbtn" style="position:absolute;top:-8px;right:-8px;width:24px;height:24px;background:var(--bg-2)" data-act="photo-rm" data-k="${k}" data-i="${i}" aria-label="Remove photo">${NS.icon("x")}</button></div>`).join("") +
      (NS.assets ? (F.single[k] && arr.length ? "" : `<button type="button" class="ph" data-act="photo-add" data-k="${k}" style="display:grid;place-items:center;color:var(--fg-3)" aria-label="Add photo">${NS.icon("camera")}</button>`)
        : `<span class="dim" style="font-size:13px">Photo uploads are available to editors of this garage in the claude.ai viewer.</span>`);
  }
  NS.acts["photo-add"] = async (el) => {
    const k = el.dataset.k; const id = await NS.pickPhoto();
    if (id && NS._form) { NS._form.state.photos[k].push(id); drawPhotos(k); }
  };
  NS.acts["photo-rm"] = (el) => { const F = NS._form; F.state.photos[el.dataset.k].splice(+el.dataset.i, 1); drawPhotos(el.dataset.k); };
  NS.acts["form-save"] = () => {
    const F = NS._form; if (!F) return;
    const out = clone(F.v);
    for (const f of F.fields) {
      const el = $("#f_" + f.k);
      if (!el && f.t !== "photos") continue;
      switch (f.t) {
        case "number": case "money": case "range": out[f.k] = el.value === "" ? (f.blank ? null : 0) : Number(el.value); break;
        case "list": out[f.k] = el.value.split("\n").map((s) => s.trim()).filter(Boolean); break;
        case "check": out[f.k] = el.checked; break;
        case "seg": out[f.k] = el.dataset.val; break;
        case "multi": out[f.k] = $$("button[aria-pressed=true]", el).map((b) => b.dataset.v); break;
        case "photos": out[f.k] = F.single[f.k] ? F.state.photos[f.k][0] || null : F.state.photos[f.k]; break;
        default: out[f.k] = el.value.trim();
      }
    }
    const keep = F.onSave(out);
    if (keep !== false) NS.closeSheet();
  };
  NS.acts["form-del"] = (el) => {
    if (!el.classList.contains("armed")) { el.classList.add("armed"); el.lastChild.textContent = "Tap again to delete"; return; }
    const F = NS._form; NS.closeSheet(); F.onDelete();
  };

  /* ---------- build math ---------- */
  const W = { done: 1, "in-progress": 0.6, bought: 0.35, researching: 0.1, planned: 0 };
  NS.modW = (m) => W[m.status] ?? 0;
  NS.vehLabel = vehLabel;
  function vehLabel(v) { return v ? `${v.year} ${v.make} ${v.model}${v.trim ? " " + v.trim : ""}` : ""; }

  NS.systemPct = function (v) {
    const out = {};
    for (const s of D.systems) {
      const ms = v.mods.filter((m) => m.system === s);
      out[s] = ms.length ? Math.round((ms.reduce((a, m) => a + NS.modW(m), 0) / ms.length) * 100) : 0;
    }
    return out;
  };
  NS.buildPct = (v) => (v.mods.length ? Math.round((v.mods.reduce((a, m) => a + NS.modW(m), 0) / v.mods.length) * 100) : 0);
  NS.phasePct = (v, p) => { const ms = v.mods.filter((m) => m.phase === p); return ms.length ? Math.round((ms.reduce((a, m) => a + NS.modW(m), 0) / ms.length) * 100) : 0; };
  NS.currentPhase = (v) => { for (const p of v.phases) if (v.mods.some((m) => m.phase === p.id && m.status !== "done")) return p; return v.phases[v.phases.length - 1]; };
  NS.spent = (v) => v.expenses.reduce((a, e) => a + (+e.amount || 0), 0);
  NS.invested = (v) => (+v.purchasePrice || 0) + NS.spent(v);
  NS.monthSpent = (v) => { const d = new Date(); const pre = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); return v.expenses.filter((e) => String(e.date).startsWith(pre)).reduce((a, e) => a + (+e.amount || 0), 0); };
  NS.sortedLog = (v) => v.log.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.mileage || 0) - (a.mileage || 0)));
  NS.lastService = (v) => NS.sortedLog(v).find((l) => l.type === "maint");
  NS.lastOil = (v) => NS.sortedLog(v).find((l) => (l.tags || []).includes("oil") || /oil change|changed oil/i.test(l.title));

  /* A car's service items with names and costs, whether they came from the built-in list or from AI. */
  NS.svcDefs = (v) => (v.service || []).map((it) => ({ ...(D.service.find((x) => x.id === it.id) || { name: it.id, cost: 0, diff: 3 }), ...it }));

  /* Fitment baseline for a car: its own specs when it has them, the built-in EK chassis numbers otherwise. */
  NS.fitBase = function (v) {
    const sp = (v && v.specs) || {}; const st = sp.wheels && sp.wheels.stock; const t = st && NS.parseTire && NS.parseTire(st.tire);
    const builtin = !st && /^(EK|EJ|EM)\d?$/i.test((v && v.chassis) || "");
    const stock = st && t ? { dia: +st.dia || t.dia, width: +st.width || 6, offset: +st.offset || 0, tw: t.tw, ar: t.ar } : D.fit.stock;
    const fit = sp.fitment || {};
    const label = (x) => `${x.dia}x${x.width} ${x.offset >= 0 ? "+" : ""}${x.offset}`;
    const presets = (sp.fitPresets && sp.fitPresets.length ? sp.fitPresets.map((p) => ({ ...p, n: p.n || label(p) })) : builtin ? D.fit.presets.filter((p) => !/^Stock/.test(p.n)) : [])
      .concat([{ n: "Stock " + label(stock), ...stock, note: "Factory setup." }]);
    // Without a spec sheet, non-EK cars get generic numbers; EK/EJ/EM get the calibrated ones.
    const susp = fit.suspension || (builtin || !st ? D.fit.suspension : "strut");
    return { stock, lipOut: +fit.lipOut || D.fit.lipOut, innerLimit: +fit.innerLimit || D.fit.innerLimit, stockGap: +fit.stockGap || D.fit.stockGap,
      suspension: susp, stockCamber: fit.stockCamber != null && fit.stockCamber !== "" ? +fit.stockCamber : builtin || !st ? D.fit.stockCamber : -0.5, bump: +fit.bump || D.fit.bump,
      presets, tires: D.fit.tires, own: !!st,
      // Rear: the calibrated EK numbers, or for other cars an estimate from the front (lip a little further in, -1° camber).
      rear: fit.rear ? { ...(builtin || !st ? D.fit.rear : {}), ...fit.rear } : builtin || !st ? D.fit.rear : { lipOut: (+fit.lipOut || D.fit.lipOut) - 6, innerLimit: +fit.innerLimit || D.fit.innerLimit, stockGap: (+fit.stockGap || D.fit.stockGap) + 3, stockCamber: -1, flange: 12, bump: +fit.bump || D.fit.bump },
      rearEst: !(builtin || !st) && !fit.rear, measured: fit.measured || null };
  };

  /* Service schedule status: last done from tagged log entries, else a known record (receipts). */
  const addMonths = (s, n) => { const d = parseDate(s); d.setMonth(d.getMonth() + n); return d; };
  NS.serviceStatus = function (v) {
    const log = NS.sortedLog(v);
    const nowT = new Date().setHours(0, 0, 0, 0);
    return (v.service || []).map((it) => {
      const def = D.service.find((x) => x.id === it.id) || { name: it.id, cost: 0, diff: 3 };
      const hit = log.find((l) => (l.tags || []).includes(it.id) || (it.id === "oil" && /oil change|changed oil/i.test(l.title)));
      const last = hit ? { mi: hit.mileage, date: hit.date, src: "log", title: hit.title } : it.known ? { mi: it.known.mi, date: it.known.date, src: "record", note: it.known.note } : null;
      const out = { ...def, ...it, name: it.name || def.name, last };
      if (!last) return { ...out, state: "unknown", pct: 1 };
      const dueMi = last.mi + it.everyMi, dueDate = addMonths(last.date, it.everyMo);
      const leftMi = dueMi - v.mileage, leftDays = Math.round((dueDate - nowT) / 864e5);
      const pct = Math.max((v.mileage - last.mi) / it.everyMi, (nowT - parseDate(last.date)) / (dueDate - parseDate(last.date)));
      const state = pct >= 1 ? "overdue" : pct >= 0.85 ? "soon" : "ok";
      return { ...out, dueMi, dueDate, leftMi, leftDays, pct: clamp(pct, 0, 1.5), state };
    });
  };
  NS.partsWaiting = (S) => S.inventory.items.filter((i) => i.kind === "part" && i.status === "bought");

  NS.reliability = function (v) {
    let score = 100; const issues = [];
    v.mods.filter((m) => m.safety && m.status !== "done").forEach((m) => { score -= 13; issues.push(m.short || m.title); });
    v.mods.filter((m) => m.phase === 1 && !m.safety && m.status !== "done").forEach((m) => { score -= 4; });
    NS.serviceStatus(v).filter((x) => x.state === "overdue").forEach((x) => { score -= x.crit ? 25 : x.id === "oil" ? 15 : 6; issues.unshift(x.name.toLowerCase()); });
    score = clamp(score, 5, 100);
    const label = score >= 85 ? "SOLID" : score >= 70 ? "DECENT" : score >= 55 ? "NEEDS ATTENTION" : "SKETCHY";
    return { score, label, issues };
  };

  const ownedTool = (name) => {
    const n = name.toLowerCase();
    const hit = S.inventory.items.find((i) => i.name.toLowerCase().includes(n) || n.includes(i.name.toLowerCase().replace(/\s*\(.*\)/, "")));
    return hit ? ["owned", "installed", "bought"].includes(hit.status) : null;
  };

  /* Safety → reliability → parts you already own → the rest of the plan. One answer, plus what follows. */
  NS.nextMoves = function (v) {
    const c = [];
    const remaining = (v.budget || 0) - NS.spent(v);
    const open = v.mods.filter((m) => m.status !== "done");
    const byOrder = (a, b) => a.phase - b.phase || a.order - b.order;
    const svc = NS.serviceStatus(v);
    svc.forEach((x) => {
      const isOil = x.id === "oil";
      if (x.state === "overdue") {
        const late = x.leftMi < 0 ? `<b>${num(-x.leftMi)} miles past due</b>` : `<b>${-x.leftDays} days past due</b>`;
        c.push({ id: "svc-" + x.id, svc: x.id, pri: x.crit ? 99 : isOil ? 100 : x.safety ? 88 : 62, level: x.crit || isOil ? "CRITICAL" : x.safety ? "HIGH" : "MED",
          title: isOil ? "Change the oil before anything else." : `${x.name} is overdue.`, then: isOil ? "Oil change, overdue" : `${x.name}, overdue`,
          why: `${x.name} is ${late} (every ${num(x.everyMi)} mi or ${x.everyMo} months).${x.crit ? " If this one fails, it can take the engine with it." : ""}`, cost: x.cost, diff: x.diff, job: x.job });
      } else if (x.state === "soon") {
        c.push({ id: "svc-" + x.id, svc: x.id, pri: isOil ? 82 : 46, level: isOil ? "HIGH" : "LOW", title: isOil ? "Oil change is coming up." : `${x.name} is coming up.`,
          why: `Due in <b>${num(Math.max(0, x.leftMi))} miles</b> or ${Math.max(0, x.leftDays)} days, whichever comes first.`, cost: x.cost, diff: x.diff, job: x.job });
      }
    });
    if (!svc.some((x) => x.id === "oil" && x.last)) c.push({ id: "svc-oil", svc: "oil", pri: 100, level: "CRITICAL", title: "Change the oil before anything else.", then: "Oil change", why: "There's no oil change in your log. Treat it as overdue.", cost: 40, diff: 2, job: "oil" });
    const unknown = svc.filter((x) => x.state === "unknown" && x.id !== "oil");
    if (unknown.length) c.push({ id: "svc-unknown", pri: 50, level: "MED", title: `No record: ${unknown.map((x) => x.name.toLowerCase()).slice(0, 3).join(", ")}.`, why: `Find the receipts or do them, so the schedule can track them. Unknown history counts as due.`, cost: unknown.reduce((a, x) => a + (x.cost || 0), 0), diff: Math.max(...unknown.map((x) => x.diff || 2)), go: "service" });

    const later = open.filter((m) => m.phase > 1 && ["SUSPENSION", "WHEELS", "EXTERIOR"].includes(m.system)).sort(byOrder);
    const pref = (arr, systems) => systems.map((sy) => arr.find((m) => m.system === sy)).find(Boolean) || arr[0];
    const boughtLater = pref(later.filter((m) => m.status === "bought"), ["SUSPENSION", "WHEELS", "EXTERIOR"]);
    const plannedLook = pref(later.filter((m) => m.status !== "bought" && m.est > 0), ["WHEELS", "SUSPENSION", "EXTERIOR"]);
    open.filter((m) => m.safety).sort(byOrder).forEach((m, i) => {
      const short = m.short || m.title.toLowerCase();
      let why = "";
      if (boughtLater || plannedLook) {
        const sys = (boughtLater || plannedLook).system.toLowerCase();
        why = `Your ${sys} is planned${boughtLater ? ` and the <b>${esc(boughtLater.short || boughtLater.title)}</b> are already in the garage` : ""}, but your <b>${esc(short)} ${esc(m.nag || "aren't done")}</b>.`;
      } else why = `Your <b>${esc(short)} ${esc(m.nag || "aren't done")}</b>, and they're safety items.`;
      const look = plannedLook ? esc(plannedLook.short || plannedLook.title.toLowerCase()) : "";
      const before = !plannedLook || plannedLook.id === m.id ? "" : plannedLook.system === m.system ? ` Buy the ${esc(short)} together with the ${look}. Check the pressures weekly until then.` : ` Do the ${esc(short)} before buying ${look}.`;
      c.push({ id: m.id, mod: m, pri: 90 - i * 3, level: "HIGH", title: `Do the ${short} first.`, then: m.title, why: why + before, cost: m.est, diff: m.diff });
    });

    open.filter((m) => m.phase === 1 && !m.safety).sort(byOrder).forEach((m, i) => {
      c.push({ id: m.id, mod: m, pri: 70 - i * 2, level: "MED", title: `${m.title}.`, why: `It's still open in <b>Phase 01: ${esc(v.phases[0].title)}</b>. Finish the reliability list before the fun list.${m.notes ? " " + esc(m.notes) : ""}`, cost: m.est, diff: m.diff });
    });

    open.filter((m) => m.status === "bought").sort(byOrder).forEach((m, i) => {
      const blocked = open.some((x) => x.safety);
      c.push({ id: m.id, mod: m, pri: (blocked ? 52 : 66) - i * 2, level: "MED", title: `Install the ${m.short || m.title.toLowerCase()} you already own.`, why: `You paid ${money(m.actual || m.est)} and it's sitting in the garage. Installing it costs time, not money.`, cost: 0, diff: m.diff });
    });

    open.filter((m) => m.status !== "bought" && m.phase > 1 && m.status !== "researching").sort(byOrder).slice(0, 4).forEach((m, i) => {
      c.push({ id: m.id, mod: m, pri: 40 - m.phase * 3 - i, level: "LOW", title: `${m.title}.`, why: `Next on the roadmap in <b>Phase 0${m.phase}</b>.`, cost: m.est, diff: m.diff });
    });

    c.forEach((x) => {
      if (x.cost > remaining && x.cost > 0) { x.pri -= x.level === "CRITICAL" ? 0 : 18; x.over = true; x.why += ` It costs more than the ${money(Math.max(0, remaining))} left in the budget.`; }
      if (x.mod) {
        const needTools = (x.mod.tools || []).filter((t) => ownedTool(t) === false);
        const needParts = (x.mod.parts || []).filter((p) => ownedTool(p) === false);
        x.need = needTools.concat(needParts);
      }
    });
    c.sort((a, b) => b.pri - a.pri);
    const seen = new Set();
    return c.filter((x) => (seen.has(x.id) ? false : seen.add(x.id)));
  };

  NS.nextMaint = function (v) {
    const known = NS.serviceStatus(v).filter((x) => x.last).sort((a, b) => a.leftMi - b.leftMi);
    const x = known[0];
    if (!x) return { label: "Oil change", left: 0 };
    return { label: x.name, at: x.dueMi, left: x.leftMi, id: x.id };
  };
  /* Miles per day from the log, for "about when" estimates. */
  NS.pace = function (v) {
    const l = NS.sortedLog(v).filter((x) => x.mileage);
    if (l.length < 2) return 30;
    const a = l[l.length - 1], b = l[0];
    const days = Math.max(1, (parseDate(b.date) - parseDate(a.date)) / 864e5);
    return Math.max(1, (Math.max(v.mileage, b.mileage) - a.mileage) / (days + Math.max(0, (new Date() - parseDate(b.date)) / 864e5)));
  };

  NS.segBar = (pct) => {
    const on = Math.floor(pct / 10); const half = pct % 10 >= 5 && on < 10;
    let s = ""; for (let i = 0; i < 10; i++) s += `<i class="${i < on ? "on" : i === on && half ? "half" : ""}"></i>`;
    return `<div class="seg-bar" role="img" aria-label="${pct}%">${s}</div>`;
  };
  NS.pips = (n, max = 10, cls = "") => { let s = ""; for (let i = 1; i <= max; i++) s += `<i class="${i <= n ? "on" : ""}"></i>`; return `<span class="pips ${cls || (n >= 7 ? "red" : n >= 5 ? "hot" : "")}" aria-label="${n} of ${max}">${s}</span>`; };
  NS.statusChip = (s, btn, id) => {
    const l = (D.statuses.find((x) => x.v === s) || D.statuses[0]).l.toUpperCase();
    return btn ? `<button class="status" data-s="${s}" data-act="cycle-status" data-id="${id}" title="Change status"><i></i>${l}</button>` : `<span class="status" data-s="${s}"><i></i>${l}</span>`;
  };
})();
