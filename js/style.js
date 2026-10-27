/* BUILD › Style Board: every pin is drawn as the real thing, and the visualizer puts it on your car. */
(function () {
  const NS = window.NS, D = window.NS_DATA;
  const { esc, icon } = NS;
  const ON_CAR = ["Paint colors", "Wheels", "Headlights", "Body parts"];

  /* ---------- what a pin means for the car ---------- */
  NS.wheelStyleOf = (p) => {
    if (p.wheelStyle) return p.wheelStyle;
    const t = (p.title || "").toLowerCase();
    return /mesh|bbs|rs-?\b/.test(t) ? "mesh" : /5[- ]?spoke|five/.test(t) ? "5" : /10[- ]?spoke|multi/.test(t) ? "10" : /dish/.test(t) ? "dish" : /steel/.test(t) ? "steelie" : "6";
  };
  const diaOf = (p) => { const m = String(p.title || "").match(/\b(1[3-8])(?:x|"|in)/i); return m ? +m[1] : p.dia || 15; };
  const sceneOf = (p) => { const t = (p.title + " " + (p.note || "")).toLowerCase(); return /highway|wangan|city|freeway/.test(t) ? "wangan" : /mountain|touge|pass|fog/.test(t) ? "touge" : /roof|dawn|sunrise/.test(t) ? "rooftop" : "b2"; };

  /* ---------- illustrations ---------- */
  const uid = () => "i" + Math.random().toString(36).slice(2, 7);
  const bg = (id) => `<radialGradient id="${id}bg" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#1b1726"/><stop offset="1" stop-color="#07060b"/></radialGradient>`;
  const ART = {
    "Steering wheels": (p) => { const id = uid(), c = p.hex || "#2a2a2e"; return `<svg viewBox="0 0 200 200" role="img" aria-label="${esc(p.title)}"><defs>${bg(id)}<linearGradient id="${id}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9e8ef"/><stop offset=".5" stop-color="#6c6a78"/><stop offset="1" stop-color="#c9c8d2"/></linearGradient></defs>
      <rect width="200" height="200" fill="url(#${id}bg)"/>
      <circle cx="100" cy="100" r="74" fill="none" stroke="${NS.shade(c, -0.3)}" stroke-width="20"/>
      <circle cx="100" cy="100" r="74" fill="none" stroke="${c}" stroke-width="16"/>
      <circle cx="100" cy="100" r="74" fill="none" stroke="#fff" stroke-opacity=".06" stroke-width="16" stroke-dasharray="1 3"/>
      <rect x="96" y="18" width="8" height="18" rx="2" fill="#e9e6f4"/>
      <path d="M30 104 C60 100 74 112 86 116 L86 128 C70 126 54 120 30 122Z M170 104 C140 100 126 112 114 116 L114 128 C130 126 146 120 170 122Z M92 126 L108 126 L114 172 L86 172Z" fill="url(#${id}m)"/>
      <circle cx="56" cy="113" r="4" fill="#0b0a10"/><circle cx="144" cy="113" r="4" fill="#0b0a10"/><circle cx="100" cy="152" r="4" fill="#0b0a10"/>
      <circle cx="100" cy="112" r="24" fill="#121118" stroke="url(#${id}m)" stroke-width="3"/><circle cx="100" cy="112" r="9" fill="#a98cff" opacity=".7"/></svg>`; },
    Gauges: (p) => { const id = uid(), c = p.hex || "#d9dbe2"; let t = ""; for (let i = 0; i <= 12; i++) { const a = (-225 + i * 22.5) * Math.PI / 180, r1 = i % 2 ? 54 : 50; t += `<line x1="${100 + Math.cos(a) * r1}" y1="${100 + Math.sin(a) * r1}" x2="${100 + Math.cos(a) * 60}" y2="${100 + Math.sin(a) * 60}" stroke="#14121a" stroke-width="${i % 2 ? 1.5 : 3}"/>`; } const na = (-225 + 7.5 * 22.5) * Math.PI / 180;
      return `<svg viewBox="0 0 200 200" role="img" aria-label="${esc(p.title)}"><defs>${bg(id)}<linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f4f8"/><stop offset=".5" stop-color="#5c5a68"/><stop offset="1" stop-color="#d6d5de"/></linearGradient><radialGradient id="${id}f" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="${NS.shade(c, 0.15)}"/><stop offset="1" stop-color="${NS.shade(c, -0.2)}"/></radialGradient></defs>
      <rect width="200" height="200" fill="url(#${id}bg)"/><circle cx="100" cy="100" r="76" fill="#0b0a10" stroke="url(#${id}b)" stroke-width="6"/><circle cx="100" cy="100" r="66" fill="url(#${id}f)"/>${t}
      <path d="M${100 + Math.cos(-0.35) * 58} ${100 + Math.sin(-0.35) * 58} A58 58 0 0 1 ${100 + Math.cos(0.79) * 58} ${100 + Math.sin(0.79) * 58}" stroke="#f0566e" stroke-width="4" fill="none"/>
      <line x1="100" y1="100" x2="${100 + Math.cos(na) * 52}" y2="${100 + Math.sin(na) * 52}" stroke="#ff6a3d" stroke-width="3" stroke-linecap="round"/><circle cx="100" cy="100" r="8" fill="#14121a"/>
      <text x="100" y="138" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="12" fill="#14121a" letter-spacing="1">OIL °C</text></svg>`; },
    Seats: (p) => { const id = uid(), c = p.hex || "#18181c"; return `<svg viewBox="0 0 200 200" role="img" aria-label="${esc(p.title)}"><defs>${bg(id)}<linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${NS.shade(c, 0.25)}"/><stop offset="1" stop-color="${NS.shade(c, -0.3)}"/></linearGradient></defs>
      <rect width="200" height="200" fill="url(#${id}bg)"/>
      <path d="M118 22 C138 20 146 30 146 46 L140 120 C139 132 132 138 120 140 L76 146 C64 148 56 140 58 128 L62 116 C64 108 72 104 82 104 L104 102 L104 40 C104 30 108 23 118 22Z" fill="url(#${id}s)" stroke="${NS.shade(c, 0.4)}" stroke-width="1.5"/>
      <path d="M110 30 L110 100" stroke="#fff" stroke-opacity=".12" stroke-width="2"/><rect x="118" y="40" width="14" height="22" rx="5" fill="#07060b"/><rect x="118" y="88" width="10" height="16" rx="4" fill="#07060b"/>
      <rect x="62" y="152" width="84" height="6" rx="2" fill="#2a2734"/><rect x="70" y="146" width="6" height="10" fill="#2a2734"/><rect x="128" y="146" width="6" height="10" fill="#2a2734"/>
      <text x="100" y="186" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#8a86a0" letter-spacing="1">SIDE VIEW</text></svg>`; },
    Interiors: (p) => { const id = uid(), c = p.hex || "#4a4a52"; return `<svg viewBox="0 0 200 200" role="img" aria-label="${esc(p.title)}"><defs>${bg(id)}<pattern id="${id}w" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="${c}"/><rect width="4" height="4" fill="${NS.shade(c, -0.18)}"/><rect x="4" y="4" width="4" height="4" fill="${NS.shade(c, -0.18)}"/><rect x="1" y="1" width="2" height="1" fill="${NS.shade(c, 0.15)}"/></pattern></defs>
      <rect width="200" height="200" fill="url(#${id}bg)"/>
      <rect x="22" y="26" width="156" height="110" rx="14" fill="url(#${id}w)"/><rect x="22" y="26" width="156" height="110" rx="14" fill="none" stroke="#000" stroke-opacity=".4" stroke-width="2"/>
      <path d="M34 38 H166 V124 H34Z" fill="none" stroke="#e9e6f4" stroke-opacity=".35" stroke-dasharray="3 3"/>
      <path d="M78 136 L82 112 C82 104 118 104 118 112 L122 136Z" fill="#141218"/><ellipse cx="100" cy="100" rx="16" ry="14" fill="#0b0a10" stroke="#3a3747" stroke-width="2"/><ellipse cx="96" cy="96" rx="5" ry="3" fill="#fff" opacity=".12"/>
      <rect x="22" y="150" width="156" height="28" rx="8" fill="#121118"/><text x="100" y="168" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#aaa6b8" letter-spacing="1">CLOTH + KNOB</text></svg>`; },
    "Exhaust tips": (p) => { const id = uid(), c = p.hex || "#8d8f98"; const ti = /burn|titan|blue/i.test(p.title + p.note); return `<svg viewBox="0 0 200 200" role="img" aria-label="${esc(p.title)}"><defs>${bg(id)}<linearGradient id="${id}t" x1="0" y1="0" x2="1" y2="1">${ti ? '<stop offset="0" stop-color="#e3c27a"/><stop offset=".4" stop-color="#7a4fd6"/><stop offset=".7" stop-color="#2f5fd0"/><stop offset="1" stop-color="#c9a3ff"/>' : `<stop offset="0" stop-color="${NS.shade(c, 0.6)}"/><stop offset=".5" stop-color="${NS.shade(c, -0.4)}"/><stop offset="1" stop-color="${NS.shade(c, 0.3)}"/>`}</linearGradient><radialGradient id="${id}h" cx=".55" cy=".55" r=".5"><stop offset="0" stop-color="#000"/><stop offset=".7" stop-color="#121018"/><stop offset="1" stop-color="#2a2733"/></radialGradient></defs>
      <rect width="200" height="200" fill="url(#${id}bg)"/><rect x="0" y="140" width="200" height="60" fill="#0d0c12"/>
      <circle cx="100" cy="100" r="62" fill="url(#${id}t)"/><circle cx="100" cy="100" r="50" fill="${NS.shade(c, -0.55)}"/><circle cx="102" cy="102" r="46" fill="url(#${id}h)"/>
      <path d="M54 76 A52 52 0 0 1 96 46" stroke="#fff" stroke-opacity=".5" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`; },
  };

  NS.pinArt = function (p, v) {
    if (p.photo) return `<img src="${NS.img(p.photo)}" alt="${esc(p.title)}" loading="lazy">`;
    const id = "pin" + p.id.replace(/[^a-z0-9]/gi, "");
    if (p.cat === "Wheels") return NS.wheelFaceSVG({ style: NS.wheelStyleOf(p), color: p.hex, dia: diaOf(p), label: p.title });
    if (p.cat === "Paint colors") return NS.carSVG({ id, paint: p.hex, crop: true, reflection: false, glow: false, dia: v.wheel?.dia || 14, alt: `Your car in ${p.title}` });
    if (p.cat === "Headlights") return NS.carSVG({ id, view: "front", paint: v.paintHex, lights: /smok|black|dark/i.test(p.title) ? "smoked" : null, reflection: false, glow: false, alt: p.title });
    if (p.cat === "Body parts") return NS.carSVG({ id, view: "front", paint: v.paintHex, lip: true, lights: v.plan?.lights, reflection: false, glow: false, alt: p.title });
    if (ART[p.cat]) return ART[p.cat](p);
    return NS.carSVG({ id, crop: true, scene: sceneOf(p), paint: v.paintHex, reflection: false, alt: p.title });
  };

  /* ---------- the look: current car vs the plan ---------- */
  NS.lookOf = function (v, which) {
    const tire = NS.parseTire(v.wheel?.tire);
    const now = { paint: v.paintHex, paintName: v.color, wheelStyle: "6", rimColor: null, wheelName: "Factory wheels", dia: v.wheel?.dia || 14, od: tire ? NS.tireOD(tire.dia, tire.tw, tire.ar) : 596, lights: null, lip: false, drop: v.wheel?.drop || 0 };
    if (which === "now") return now;
    return { ...now, ...(v.plan || {}) };
  };
  const TIRE = { 13: [175, 70], 14: [185, 65], 15: [195, 50], 16: [205, 45], 17: [215, 40], 18: [225, 35] };
  NS.lookCar = function (look, o = {}) {
    const od = look.od || NS.tireOD(look.dia, ...(TIRE[look.dia] || [195, 50]));
    return NS.carSVG({ dia: look.dia, od, drop: look.drop, paint: look.paint, wheelStyle: look.wheelStyle, rimColor: look.rimColor, lights: look.lights, lip: look.lip, ...o });
  };
  NS.lookLine = (L) => [L.paintName, L.wheelName + (L.dia ? ` ${L.dia}"` : ""), L.lights === "smoked" ? "smoked lights" : "", L.lip ? "front lip" : "", L.drop ? `−${L.drop} in` : "stock height"].filter(Boolean).join(" · ");

  const look = () => {
    const v = NS.veh();
    if (!NS.ui.look || NS.ui.lookFor !== v.id) { NS.ui.look = NS.lookOf(v, "plan"); NS.ui.lookFor = v.id; }
    return NS.ui.look;
  };

  NS.views.style = function () {
    const v = NS.veh(); const S = NS.S; const L = look();
    const items = S.style.items; const cat = NS.ui.styleCat, tag = NS.ui.styleTag;
    const list = items.filter((i) => (cat === "all" || i.cat === cat) && (tag === "all" || (i.tags || []).includes(tag)));
    const cats = D.styleCats.filter((c) => items.some((i) => i.cat === c));
    const paints = items.filter((i) => i.cat === "Paint colors"), wheels = items.filter((i) => i.cat === "Wheels");
    const now = NS.ui.styleView === "now";
    const dirty = JSON.stringify(L) !== JSON.stringify(NS.lookOf(v, "plan"));
    const chip = (act, val, label, on, swatch) => `<button class="chip" data-act="${act}" data-v="${esc(val)}" aria-pressed="${on}">${swatch ? `<i class="dot" style="background:${esc(swatch)}"></i>` : ""}${esc(label)}</button>`;
    return `${NS.subnav()}
    <div class="page-head"><div><div class="eyebrow">STYLE BOARD · VISUALIZER</div><h1 class="h1" style="margin-top:6px">The look</h1><p class="lede">Save what you like, then put it on your car. The plan you save here shows up in the garage next to the car as it is today.</p></div>
      <button class="btn primary" data-act="pin-add">${icon("plus")}Add inspiration</button></div>

    <section class="viz-hero">
      <div class="row between" style="padding:14px 14px 0">
        <div class="seg" style="min-width:180px">${[["plan", "THE PLAN"], ["now", "NOW"]].map(([k, l]) => `<button data-act="style-view" data-k="${k}" aria-pressed="${(now ? "now" : "plan") === k}">${l}</button>`).join("")}</div>
        <span class="px dim">${now ? "AS IT SITS TODAY" : dirty ? "UNSAVED CHANGES" : v.plan ? "SAVED PLAN" : "NOT SAVED YET"}</span>
      </div>
      <div class="viz-stage" id="look-stage">${now ? NS.lookCar(NS.lookOf(v, "now"), { id: "look", scene: NS.currentScene() }) : NS.lookCar(L, { id: "look", scene: NS.currentScene() })}</div>
      <div class="look-line">${esc(NS.lookLine(now ? NS.lookOf(v, "now") : L))}</div>
      ${now ? "" : `<div class="slots">
        <div class="slot"><span class="lbl">Paint</span><div class="chips">${chip("look-paint", "", "Factory " + (v.color || ""), !L.paintPin, v.paintHex)}${paints.map((p) => chip("look-paint", p.id, p.title, L.paintPin === p.id, p.hex)).join("")}</div></div>
        <div class="slot"><span class="lbl">Wheels</span><div class="chips">${chip("look-wheel", "", "Factory", !L.wheelPin)}${wheels.map((p) => chip("look-wheel", p.id, p.title, L.wheelPin === p.id, p.hex)).join("")}</div></div>
        <div class="slot"><span class="lbl">Lights</span><div class="chips">${chip("look-lights", "", "Factory", !L.lights)}${chip("look-lights", "smoked", "Smoked", L.lights === "smoked")}</div></div>
        <div class="slot"><span class="lbl">Body</span><div class="chips">${chip("look-lip", "", "Factory", !L.lip)}${chip("look-lip", "1", "Front lip", !!L.lip)}</div></div>
        <div class="slot"><div class="ctrl"><label class="lbl" for="look-drop">Ride height</label><output id="look-drop-o">${L.drop ? "−" + L.drop + " in" : "Stock"}</output><input type="range" id="look-drop" data-in="look-drop" min="0" max="3" step="0.25" value="${L.drop || 0}"></div></div>
        <div class="row" style="gap:8px"><button class="btn primary" data-act="look-save">${icon("check")}Save as the plan</button>${dirty ? `<button class="btn ghost" data-act="look-reset">Undo changes</button>` : ""}</div>
      </div>`}
    </section>

    <div class="chips" style="margin:22px 0 8px">${["all"].concat(cats).map((c) => `<button class="chip" data-act="style-cat" data-k="${esc(c)}" aria-pressed="${cat === c}">${c === "all" ? "Everything" : esc(c)}</button>`).join("")}</div>
    <div class="chips" style="margin-bottom:16px">${["all"].concat(D.aesthetics).map((t) => `<button class="chip" data-act="style-tag" data-k="${t}" aria-pressed="${tag === t}" style="font-family:var(--f-pixel);font-size:11px;letter-spacing:.06em">${t === "all" ? "ALL STYLES" : t}</button>`).join("")}</div>
    <div class="board">${list.map((p) => `<article class="pin">
      <button class="pin-art" data-act="pin-edit" data-id="${p.id}" aria-label="Edit ${esc(p.title)}">${NS.pinArt(p, v)}<span class="pin-cat">${esc(p.cat.toUpperCase())}</span></button>
      <div class="cap"><div class="t">${esc(p.title)}</div>${p.note ? `<div class="dim" style="font-size:12.5px;margin-top:3px">${esc(p.note)}</div>` : ""}
        <div class="row" style="justify-content:space-between;margin-top:8px"><span class="row" style="gap:4px">${(p.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</span>
        ${ON_CAR.includes(p.cat) && !p.photo ? `<button class="btn sm" data-act="try-on" data-id="${p.id}">${icon("car")}Try on</button>` : ""}</div></div>
    </article>`).join("")}</div>
    ${list.length ? "" : '<div class="empty">Nothing saved in this category yet.</div>'}`;
  };

  const redraw = () => {
    const L = look(); const st = document.getElementById("look-stage");
    if (st) st.innerHTML = NS.lookCar(L, { id: "look", scene: NS.currentScene() });
    const ln = document.querySelector(".look-line"); if (ln) ln.textContent = NS.lookLine(L);
  };
  const applyPin = (p) => {
    const L = look();
    if (p.cat === "Paint colors") Object.assign(L, { paint: p.hex, paintName: p.title, paintPin: p.id });
    if (p.cat === "Wheels") Object.assign(L, { wheelStyle: NS.wheelStyleOf(p), rimColor: p.hex, wheelName: p.title.replace(/,?\s*\b1[3-8]x[\d.]+.*$/i, ""), dia: diaOf(p), od: null, wheelPin: p.id });
    if (p.cat === "Headlights") L.lights = "smoked";
    if (p.cat === "Body parts") L.lip = true;
  };
  NS.acts["style-view"] = (el) => { NS.ui.styleView = el.dataset.k; NS.render({ quiet: true, keepScroll: true }); };
  NS.acts["look-paint"] = (el) => { const L = look(); const v = NS.veh(); if (!el.dataset.v) Object.assign(L, { paint: v.paintHex, paintName: v.color, paintPin: null }); else applyPin(NS.S.style.items.find((x) => x.id === el.dataset.v)); NS.render({ quiet: true }); };
  NS.acts["look-wheel"] = (el) => { const L = look(); const n = NS.lookOf(NS.veh(), "now"); if (!el.dataset.v) Object.assign(L, { wheelStyle: n.wheelStyle, rimColor: null, wheelName: n.wheelName, dia: n.dia, od: n.od, wheelPin: null }); else applyPin(NS.S.style.items.find((x) => x.id === el.dataset.v)); NS.render({ quiet: true }); };
  NS.acts["look-lights"] = (el) => { look().lights = el.dataset.v || null; NS.render({ quiet: true }); };
  NS.acts["look-lip"] = (el) => { look().lip = !!el.dataset.v; NS.render({ quiet: true }); };
  NS.inputs["look-drop"] = (el) => { const L = look(); L.drop = +el.value; document.getElementById("look-drop-o").textContent = L.drop ? "−" + L.drop + " in" : "Stock"; cancelAnimationFrame(NS._lr); NS._lr = requestAnimationFrame(redraw); };
  NS.acts["look-reset"] = () => { NS.ui.look = null; NS.render({ quiet: true }); };
  NS.acts["look-save"] = () => {
    const v = NS.veh(); const L = { ...look() }; delete L.od;
    v.plan = L; NS.ui.look = null; NS.commitVeh(); NS.toast("Saved. The garage now shows THE PLAN next to NOW.");
  };
  NS.acts["try-on"] = (el) => {
    const p = NS.S.style.items.find((x) => x.id === el.dataset.id); if (!p) return;
    NS.ui.styleView = "plan"; applyPin(p); NS.render({ quiet: true });
    const h = document.querySelector(".viz-hero"); if (h) h.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* ---------- pins ---------- */
  const pinFields = [
    { k: "title", l: "What is it", t: "text", full: true, ph: "Bronze 6-spoke, 15x8" }, { k: "cat", l: "Category", t: "select", o: D.styleCats },
    { k: "hex", l: "Color", t: "color" }, { k: "wheelStyle", l: "Wheel design (wheels only)", t: "select", o: [{ v: "", l: "Guess from the name" }].concat(NS.wheelStyles.map(([v, l]) => ({ v, l }))) },
    { k: "tags", l: "Aesthetic", t: "multi", o: D.aesthetics },
    { k: "note", l: "Why you like it", t: "textarea" }, { k: "link", l: "Link", t: "text", full: true }, { k: "photo", l: "Your own photo (replaces the drawing)", t: "photos", single: true },
  ];
  NS.acts["style-cat"] = (el) => { NS.ui.styleCat = el.dataset.k; NS.render({ quiet: true, keepScroll: true }); };
  NS.acts["style-tag"] = (el) => { NS.ui.styleTag = el.dataset.k; NS.render({ quiet: true, keepScroll: true }); };
  NS.acts["pin-add"] = () => NS.form({ eyebrow: "STYLE BOARD", title: "Save inspiration", fields: pinFields, value: { cat: NS.ui.styleCat !== "all" ? NS.ui.styleCat : "Wheels", hex: "#9b7a46", tags: [], wheelStyle: "" },
    onSave: (o) => { if (!o.title) return false; if (!o.wheelStyle) delete o.wheelStyle; NS.S.style.items.unshift({ id: NS.uid("st"), ...o }); NS.commit("style"); } });
  NS.acts["pin-edit"] = (el) => { const p = NS.S.style.items.find((x) => x.id === el.dataset.id);
    NS.form({ eyebrow: "STYLE BOARD", title: p.title, fields: pinFields, value: { wheelStyle: "", ...p }, onSave: (o) => { if (!o.wheelStyle) { delete o.wheelStyle; delete p.wheelStyle; } Object.assign(p, o); NS.commit("style"); },
      onDelete: () => { NS.S.style.items = NS.S.style.items.filter((x) => x !== p); NS.commit("style"); } }); };
})();
