/* BUILD tools: Wheel Fitment Lab, Mod Calculator, Sound Lab. */
(function () {
  const NS = window.NS, D = window.NS_DATA;
  /* F reads the current car's fitment baseline (its own specs, or the built-in EK numbers). */
  const F = new Proxy({}, { get: (_, k) => NS.fitBase(NS.veh())[k] });
  const { esc, money, num, icon, clamp } = NS;

  /* ================= FITMENT ================= */
  const fitState = () => {
    if (!NS.ui.fit || NS.ui.fitFor !== NS.veh().id) {
      NS.ui.fitFor = NS.veh().id;
      const w = NS.veh().wheel || {};
      const t = NS.parseTire(w.tire) || { tw: 185, ar: 65 };
      NS.ui.fit = { dia: w.dia || 14, width: w.width || 5.5, offset: w.offset ?? 45, tw: t.tw, ar: t.ar, drop: w.drop || 0 };
    }
    return NS.ui.fit;
  };

  NS.fitCalc = function (s) {
    const st = F.stock;
    const rimW = s.width * 25.4;
    const od = NS.tireOD(s.dia, s.tw, s.ar);
    const stockOD = NS.tireOD(st.dia, st.tw, st.ar);
    const half = Math.max(s.tw / 2, rimW / 2 + 6);           // widest point: tire sidewall or rim flange
    const bulge = half - rimW / 2;
    const inner = half + s.offset;                            // inboard extent from hub face
    const outer = half - s.offset;                            // outboard extent from hub face
    const camber = -(0.5 + s.drop * 0.75);                    // degrees, rough EK geometry
    const tuck = (od / 2) * Math.sin(Math.abs(camber) * Math.PI / 180) - (stockOD / 2) * Math.sin(0.5 * Math.PI / 180);
    const poke = outer - tuck - F.lipOut;                     // + = past the fender lip at the top of the tire
    const innerClear = F.innerLimit - inner;
    const rideChange = (od - stockOD) / 2 / 25.4 - s.drop;    // inches, body vs ground
    const gap = F.stockGap + (stockOD - od) / 2 - s.drop * 25.4;
    const speedo = (od / stockOD - 1) * 100;
    const ratio = s.tw / 25.4 / s.width;                      // tire width ÷ rim width
    const stretch = ratio < 0.98 ? "Stretched" : ratio > 1.22 ? "Meaty" : "Square";

    let rPoke = poke > 0 ? clamp(45 + poke * 4, 0, 100) : poke > -8 ? (poke + 8) * 4 : 0;
    if (gap < 25) rPoke = clamp(rPoke * (1 + (25 - gap) / 25), 0, 100);
    const rInner = innerClear < 0 ? 100 : innerClear < 4 ? 70 - innerClear * 6 : innerClear < 10 ? 30 - (innerClear - 4) * 4 : 0;
    const rGap = gap < 0 ? clamp(60 - gap, 0, 100) : gap < 15 ? (15 - gap) * 3 : 0;
    const rStretch = ratio < 0.9 ? 20 : 0;
    const risk = Math.round(100 * (1 - (1 - rPoke / 100) * (1 - rInner / 100) * (1 - rGap / 100) * (1 - rStretch / 100)));
    const level = risk < 25 ? ["LOW", "ok", "Daily-able."] : risk < 55 ? ["MEDIUM", "warn", "Roll the fenders and it should live."] : risk < 80 ? ["HIGH", "bad", "It will rub. You know it will."] : ["GRINDING", "bad", "Fender work and camber, or pick another offset."];

    const fixes = [];
    if (poke > 0) fixes.push(`Pokes ${poke.toFixed(0)} mm past the lip. Roll the fenders, add camber, or go about ${Math.ceil(poke / 5) * 5} mm higher offset.`);
    else if (poke > -6) fixes.push("Near flush. Rolled fenders recommended at this height.");
    if (innerClear < 4) fixes.push(`Only ${Math.max(0, innerClear).toFixed(0)} mm to the strut. Lower the offset or run a narrower tire.`);
    if (gap < 10) fixes.push("Tire top sits at or above the fender lip. Expect rub over bumps without more camber.");
    if (Math.abs(speedo) > 3) fixes.push(`Speedo will read ${speedo > 0 ? "slow" : "fast"} by ${Math.abs(speedo).toFixed(1)}%.`);
    if (!fixes.length) fixes.push("Clean fit. No modifications needed.");

    const tires = (F.tires[s.dia] || []).map((t) => {
      const p = NS.parseTire(t); const o = NS.tireOD(p.dia, p.tw, p.ar);
      const r = p.tw / 25.4 / s.width;
      return { t, od: o, diff: (o / stockOD - 1) * 100, fit: r < 0.98 ? "stretch" : r > 1.22 ? "meaty" : "square", ok: r >= 0.86 && r <= 1.35, p };
    }).filter((x) => x.ok).sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff)).slice(0, 4);

    return { od, stockOD, inner, outer, poke, innerClear, rideChange, gap, speedo, camber, risk, level, fixes, tires, stretch, bulge, rimW };
  };

  function frontView(s, r) {
    /* Section through the top of the tire, looking from the front. 1 mm = 1.1 px. Car's outside is to the right. */
    const k = 1.1, X0 = 230, TOP = 150;
    const x = (mm) => X0 + mm * k;
    const camberShift = -(r.od / 2) * Math.sin(Math.abs(r.camber) * Math.PI / 180) * k;
    const centerMm = -s.offset;                    // tire centerline vs hub face (+ outward)
    const side = s.tw * s.ar / 100;
    const tl = x(centerMm - s.tw / 2) + camberShift, tr = x(centerMm + s.tw / 2) + camberShift;
    const rimL = x(centerMm - r.rimW / 2), rimR = x(centerMm + r.rimW / 2);
    const rimY = TOP + side * k;
    const lipX = x(F.lipOut), lipY = TOP - r.gap * k;
    const strutX = x(-F.innerLimit);
    const ok = r.level[1];
    const col = ok === "ok" ? "#6fd3a0" : ok === "warn" ? "#e9b64e" : "#f0566e";
    return `<svg viewBox="0 0 440 330" role="img" aria-label="Front section view of tire, wheel and fender">
      <defs>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#2c2838" stroke-width="2"/></pattern>
        <linearGradient id="tread" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#26242e"/><stop offset="1" stop-color="#0d0c11"/></linearGradient>
        <linearGradient id="rimg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#bdbcc8"/><stop offset=".5" stop-color="#f4f4f8"/><stop offset="1" stop-color="#8d8b9a"/></linearGradient>
      </defs>
      <g font-family="JetBrains Mono, monospace" font-size="10" fill="#716c84" letter-spacing=".5">
        <line x1="${X0}" y1="20" x2="${X0}" y2="320" stroke="#a98cff" stroke-opacity=".5" stroke-dasharray="3 4"/>
        <text x="${X0 + 4}" y="316">HUB FACE</text>
        <rect x="${strutX - 26}" y="10" width="26" height="${rimY - 10}" fill="url(#hatch)" stroke="#48445a"/>
        <text x="${strutX - 13}" y="${rimY + 14}" text-anchor="middle">STRUT</text>
        <path d="M${strutX} ${lipY - 46} L${lipX - 12} ${lipY - 46} C${lipX + 4} ${lipY - 46} ${lipX + 8} ${lipY - 38} ${lipX + 8} ${lipY - 22} L${lipX + 8} ${lipY - 2} C${lipX + 8} ${lipY + 3} ${lipX + 2} ${lipY + 4} ${lipX - 2} ${lipY}" fill="none" stroke="#d6d5de" stroke-width="2.4"/>
        <path d="M${lipX + 8} ${lipY - 22} L430 ${lipY - 30}" stroke="#d6d5de" stroke-width="2.4" fill="none"/>
        <text x="${lipX + 14}" y="${lipY - 36}">FENDER</text>
        <line x1="${lipX}" y1="${lipY}" x2="${lipX}" y2="${rimY + 8}" stroke="#d6d5de" stroke-opacity=".35" stroke-dasharray="2 3"/>
        <path d="M${tl + 8} ${TOP} L${tr - 8} ${TOP} Q${tr} ${TOP} ${tr} ${TOP + 10} C${tr} ${TOP + side * k * 0.5} ${rimR} ${rimY - 14} ${rimR} ${rimY} L${rimL} ${rimY} C${rimL} ${rimY - 14} ${tl} ${TOP + side * k * 0.5} ${tl} ${TOP + 10} Q${tl} ${TOP} ${tl + 8} ${TOP} Z" fill="url(#tread)" stroke="#3a3747" stroke-width="1.2"/>
        ${Array.from({ length: Math.max(3, Math.floor(s.tw / 40)) }, (_, i) => { const n = Math.max(3, Math.floor(s.tw / 40)); const xx = tl + 10 + (i + 0.5) * ((tr - tl - 20) / n); return `<line x1="${xx}" y1="${TOP + 1}" x2="${xx}" y2="${TOP + 9}" stroke="#05050a" stroke-width="3"/>`; }).join("")}
        <rect x="${rimL - 3}" y="${rimY - 6}" width="${rimR - rimL + 6}" height="8" rx="3" fill="url(#rimg)"/>
        <rect x="${rimL}" y="${rimY + 2}" width="${rimR - rimL}" height="${320 - rimY}" fill="#121119" stroke="#5c5a68"/>
        <line x1="${X0}" y1="${rimY + 2}" x2="${X0}" y2="320" stroke="#a98cff" stroke-width="3" stroke-opacity=".7"/>
        <text x="${(rimL + rimR) / 2}" y="${rimY + 40}" text-anchor="middle" fill="#aaa6b8">${s.dia}x${s.width} ${s.offset >= 0 ? "+" : ""}${s.offset}</text>
        <text x="${(tl + tr) / 2}" y="${TOP + side * k / 2 + 4}" text-anchor="middle" fill="#aaa6b8">${s.tw}/${s.ar}</text>
        <g stroke="${r.innerClear < 4 ? "#f0566e" : "#6fd3a0"}" fill="${r.innerClear < 4 ? "#f0566e" : "#6fd3a0"}">
          <line x1="${strutX}" y1="${rimY - 30}" x2="${Math.min(tl, rimL)}" y2="${rimY - 30}" stroke-width="1"/>
          <text x="${(strutX + Math.min(tl, rimL)) / 2}" y="${rimY - 36}" text-anchor="middle" stroke="none">${r.innerClear.toFixed(0)}mm</text>
        </g>
        <g stroke="${col}" fill="${col}">
          <line x1="${lipX}" y1="${TOP - 12}" x2="${tr}" y2="${TOP - 12}" stroke-width="1.4"/>
          <circle cx="${tr}" cy="${TOP - 12}" r="2.2" stroke="none"/>
          <text x="${Math.max(lipX, tr) + 6}" y="${TOP - 16}" stroke="none">${r.poke > 0 ? "+" : ""}${r.poke.toFixed(0)}mm</text>
        </g>
        <text x="12" y="22" fill="#a98cff" font-family="Silkscreen, monospace" font-size="9">FRONT SECTION · CAMBER ${r.camber.toFixed(1)}°</text>
      </g>
    </svg>`;
  }

  NS.views.fitment = function () {
    const s = fitState();
    const ctrl = (k, l, min, max, step, fmt) => `<div class="ctrl"><label class="lbl" for="fit-${k}">${l}</label><output id="fit-${k}-o">${fmt(s[k])}</output><input type="range" id="fit-${k}" data-in="fit" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${s[k]}"></div>`;
    const presetActive = (p) => p.dia === s.dia && p.width === s.width && p.offset === s.offset;
    return `${NS.subnav()}
    <div class="page-head"><div><div class="eyebrow">WHEEL FITMENT LAB · ${esc(NS.veh().chassis)}</div><h1 class="h1" style="margin-top:6px">Will it fit, and will it rub?</h1><p class="lede">Compared to the factory ${F.stock.dia}x${F.stock.width} ${F.stock.offset >= 0 ? "+" : ""}${F.stock.offset} with ${F.stock.tw}/${F.stock.ar}R${F.stock.dia}${F.own ? " from this car's spec sheet" : ""}. Estimates for planning. Test-fit before you buy.</p></div></div>
    <div class="chips" style="margin-bottom:14px">${F.presets.map((p, i) => `<button class="chip" data-act="fit-preset" data-i="${i}" aria-pressed="${presetActive(p)}">${esc(p.n)}</button>`).join("")}</div>
    <div class="lab">
      <div class="stack">
        <div class="viz" id="fit-side"></div>
        <div class="viz" id="fit-front"></div>
      </div>
      <div class="stack">
        <div class="risk" id="fit-risk"></div>
        <div class="readouts" id="fit-readouts"></div>
        <div class="panel tight stack" style="gap:16px">
          ${ctrl("dia", "Wheel diameter", 13, 20, 1, (v) => v + '"')}
          ${ctrl("width", "Wheel width", 5, 11, 0.5, (v) => v + '"')}
          ${ctrl("offset", "Offset", -25, 60, 1, (v) => (v >= 0 ? "+" : "") + v)}
          ${ctrl("tw", "Tire width", 165, 305, 5, (v) => v + "mm")}
          ${ctrl("ar", "Tire aspect", 30, 75, 5, (v) => v)}
          ${ctrl("drop", "Suspension drop", 0, 4, 0.25, (v) => (v ? "−" + v : "0") + " in")}
        </div>
        <div class="infobox" id="fit-fixes"></div>
        <div class="panel tight"><div class="lbl" style="margin-bottom:8px">Recommended tire sizes</div><div id="fit-tires" class="stack" style="gap:6px"></div></div>
        <button class="btn" data-act="fit-save">${icon("check")}Save as my planned wheel setup</button>
      </div>
    </div>`;
  };
  NS.after.fitment = () => drawFit();
  function drawFit() {
    const s = fitState(); const r = NS.fitCalc(s);
    const v = NS.veh();
    NS.$("#fit-side").innerHTML = NS.carSVG({ id: "fit", dia: s.dia, od: r.od, drop: s.drop, paint: v.paintHex, reflection: false, labels: true, alt: "Side view with this wheel setup" }) +
      `<div class="viz-cap"><span>SIDE · ${s.dia}x${s.width} ${s.offset >= 0 ? "+" : ""}${s.offset} · ${s.tw}/${s.ar}R${s.dia}</span><span>RIDE ${r.rideChange >= 0 ? "+" : "−"}${Math.abs(r.rideChange).toFixed(2)} IN</span></div>`;
    NS.$("#fit-front").innerHTML = frontView(s, r) + `<div class="viz-cap"><span>FENDER LIP ${F.lipOut}MM OUT · STRUT ${F.innerLimit}MM IN</span><span>${r.stretch.toUpperCase()} · OD ${r.od.toFixed(0)}MM</span></div>`;
    const lv = r.level;
    const col = lv[1] === "ok" ? "#6fd3a0" : lv[1] === "warn" ? "#e9b64e" : "#f0566e";
    const a = (r.risk / 100) * 270;
    const arc = (deg) => { const t = ((deg - 225) * Math.PI) / 180; return [37 + 30 * Math.cos(t), 37 + 30 * Math.sin(t)]; };
    const [sx, sy] = arc(0), [ex, ey] = arc(Math.max(0.1, a)), [fx, fy] = arc(270);
    NS.$("#fit-risk").innerHTML = `<svg class="gauge" viewBox="0 0 74 74" aria-hidden="true"><path d="M${sx} ${sy} A30 30 0 1 1 ${fx} ${fy}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="6" stroke-linecap="round"/><path d="M${sx} ${sy} A30 30 0 ${a > 180 ? 1 : 0} 1 ${ex} ${ey}" fill="none" stroke="${col}" stroke-width="6" stroke-linecap="round"/><text x="37" y="42" text-anchor="middle" font-family="Barlow Semi Condensed, sans-serif" font-weight="600" font-size="17" fill="${col}">${r.risk}</text></svg>
      <div style="min-width:0"><div class="lbl">Rubbing risk</div><div class="big ${lv[1]}" style="font-size:28px;margin-top:4px">${lv[0]}</div><div class="muted" style="font-size:14px;margin-top:2px">${lv[2]}</div></div>`;
    const ro = (k, v, s2, cls = "") => `<div class="readout"><div class="k">${k}</div><div class="v ${cls}">${v}</div><div class="s">${s2}</div></div>`;
    NS.$("#fit-readouts").innerHTML =
      ro("INNER CLEARANCE", r.innerClear.toFixed(0) + '<span class="dim" style="font-size:14px"> mm</span>', "to strut / perch", r.innerClear < 4 ? "bad" : r.innerClear < 10 ? "warn" : "ok") +
      ro("FENDER POKE", (r.poke > 0 ? "+" : "") + r.poke.toFixed(0) + '<span class="dim" style="font-size:14px"> mm</span>', r.poke > 0 ? "past the lip" : "tucked behind the lip", r.poke > 0 ? "bad" : r.poke > -6 ? "warn" : "") +
      ro("RIDE HEIGHT", (r.rideChange >= 0 ? "+" : "−") + Math.abs(r.rideChange).toFixed(2) + '<span class="dim" style="font-size:14px"> in</span>', "vs. stock, approx.") +
      ro("FENDER GAP", Math.max(0, r.gap / 25.4).toFixed(2) + '<span class="dim" style="font-size:14px"> in</span>', r.gap < 0 ? "tire above lip (tuck)" : "tire to lip, front") +
      ro("DIAMETER", (r.speedo >= 0 ? "+" : "") + r.speedo.toFixed(1) + '<span class="dim" style="font-size:14px"> %</span>', "speedo error vs. stock", Math.abs(r.speedo) > 3 ? "warn" : "") +
      ro("SIDEWALL", r.stretch.toUpperCase(), `${s.tw}mm tire on ${s.width}" rim`, r.stretch === "Stretched" ? "warn" : "");
    NS.$("#fit-fixes").innerHTML = `<h4>WHAT IT NEEDS</h4><ul>${r.fixes.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>`;
    NS.$("#fit-tires").innerHTML = r.tires.length ? r.tires.map((t) => `<button class="row between card hover" style="padding:9px 12px" data-act="fit-tire" data-t="${t.t}"><span class="mono">${t.t}</span><span class="row" style="gap:8px"><span class="tag ${t.fit === "square" ? "ok" : "warn"}">${t.fit.toUpperCase()}</span><span class="mono dim" style="font-size:12px">${t.diff >= 0 ? "+" : ""}${t.diff.toFixed(1)}%</span></span></button>`).join("")
      : '<span class="dim" style="font-size:14px">No common sizes for this width. Try a different width or diameter.</span>';
  }
  NS.inputs.fit = (el) => {
    const s = fitState(); s[el.dataset.k] = Number(el.value);
    const fmt = { dia: (v) => v + '"', width: (v) => v + '"', offset: (v) => (v >= 0 ? "+" : "") + v, tw: (v) => v + "mm", ar: (v) => v, drop: (v) => (v ? "−" + v : "0") + " in" }[el.dataset.k];
    NS.$("#fit-" + el.dataset.k + "-o").textContent = fmt(s[el.dataset.k]);
    NS.$$("[data-act=fit-preset]").forEach((b) => { const p = F.presets[+b.dataset.i]; b.setAttribute("aria-pressed", p.dia === s.dia && p.width === s.width && p.offset === s.offset); });
    cancelAnimationFrame(NS._fitRaf); NS._fitRaf = requestAnimationFrame(drawFit);
  };
  NS.acts["fit-preset"] = (el) => {
    const p = F.presets[+el.dataset.i]; const s = fitState();
    Object.assign(s, { dia: p.dia, width: p.width, offset: p.offset, tw: p.tw, ar: p.ar });
    if (p.dia > 14 && s.drop === 0) s.drop = 2;
    if (p.dia === 14) s.drop = 0;
    NS.render({ quiet: true }); NS.toast(p.note);
  };
  NS.acts["fit-tire"] = (el) => {
    const p = NS.parseTire(el.dataset.t); const s = fitState(); s.tw = p.tw; s.ar = p.ar; NS.render({ quiet: true });
  };
  NS.acts["fit-save"] = () => {
    const s = fitState(); const v = NS.veh();
    const tire = `${s.tw}/${s.ar}R${s.dia}`;
    v.wheel = { dia: s.dia, width: s.width, offset: s.offset, tire, drop: s.drop };
    const m = v.mods.find((x) => x.system === "WHEELS" && /wheel/i.test(x.title) && x.status !== "done");
    if (m) { m.title = `Wheels: ${s.dia}x${s.width} ${s.offset >= 0 ? "+" : ""}${s.offset}`; m.notes = `Plan on ${tire}. ` + (NS.fitCalc(s).fixes[0] || ""); }
    NS.commitVeh({ silent: true }); NS.toast("Saved. The garage drawing now shows this setup.");
  };

  /* ================= MOD CALCULATOR ================= */
  const FORGET = [
    { k: "align", l: "Alignment after suspension work", a: 110 },
    { k: "hardware", l: "New bolts, clips, hardware", a: 18 },
    { k: "fluid", l: "Fluid you didn't plan to replace", a: 15 },
    { k: "snap", l: "The bolt that snaps", a: 25 },
    { k: "trip", l: "Second trip to the parts store", a: 12 },
    { k: "tax", l: "Sales tax (8%) on parts", a: "tax" },
  ];
  const calcState = () => (NS.ui.calc ||= { name: "Coilovers", part: 300, labor: 0, support: 60, tools: 45, ship: 25, forget: { align: true, hardware: true, tax: true } });
  function calcTotals(c) {
    const base = [c.part, c.labor, c.support, c.tools, c.ship].map((x) => +x || 0);
    let hidden = 0;
    FORGET.forEach((f) => { if (c.forget[f.k]) hidden += f.a === "tax" ? ((+c.part || 0) + (+c.support || 0)) * 0.08 : f.a; });
    const total = base.reduce((a, b) => a + b, 0) + hidden;
    return { base, hidden, total, ratio: c.part ? total / c.part : 1 };
  }
  const quip = (r) => r < 1.15 ? "Suspiciously honest. Check again." : r < 1.4 ? "Classic. The bolts always cost extra." : r < 1.8 ? "This is how it starts." : r < 2.5 ? "The part was the cheap part." : "At this point the part is a rounding error.";

  NS.views.calc = function () {
    const c = calcState(); const v = NS.veh();
    const mods = v.mods.filter((m) => m.status !== "done");
    const f = (k, l) => `<div class="field"><label for="calc-${k}">${l}</label><div class="prefix"><span>$</span><input class="input money" type="number" inputmode="decimal" id="calc-${k}" data-in="calc" data-k="${k}" value="${c[k]}"></div></div>`;
    return `${NS.subnav()}
    <div class="page-head"><div><div class="eyebrow">MOD CALCULATOR</div><h1 class="h1" style="margin-top:6px">What it really costs</h1><p class="lede">The part price is the number you remember. This is the number your bank account sees.</p></div></div>
    <div class="lab">
      <div class="stack">
        <div class="calc-out" id="calc-out"></div>
        <div class="panel tight">
          <div class="lbl" style="margin-bottom:10px">Things people forget</div>
          <div class="forget">${FORGET.map((x) => `<label><span><input type="checkbox" data-ch="calc-forget" data-k="${x.k}"${c.forget[x.k] ? " checked" : ""}>${x.l}</span><span class="mono dim">${x.a === "tax" ? "8%" : money(x.a)}</span></label>`).join("")}</div>
        </div>
      </div>
      <div class="stack">
        <div class="panel tight stack">
          <div class="field"><label for="calc-from">Start from a planned mod</label><select class="select" id="calc-from" data-ch="calc-from"><option value="">Custom</option>${mods.map((m) => `<option value="${m.id}"${c.modId === m.id ? " selected" : ""}>${esc(m.title)} (~${money(m.est)})</option>`).join("")}</select></div>
          <div class="field"><label for="calc-name">What is it</label><input class="input" id="calc-name" data-in="calc" data-k="name" value="${esc(c.name)}"></div>
          <div class="form-grid">
            ${f("part", "Part price")}${f("labor", "Labor")}${f("support", "Supporting parts")}${f("tools", "Tools")}${f("ship", "Shipping")}
          </div>
        </div>
        <div class="row">
          <button class="btn primary" data-act="calc-apply">${icon("check")}${c.modId ? "Update mod estimate" : "Add to roadmap"}</button>
          <button class="btn" data-act="calc-expense">${icon("money")}Log as expense</button>
        </div>
      </div>
    </div>`;
  };
  NS.after.calc = () => drawCalc();
  function drawCalc() {
    const c = calcState(); const t = calcTotals(c); const v = NS.veh();
    const remaining = (v.budget || 0) - NS.spent(v);
    const cols = ["#a98cff", "#6a3df0", "#8ab4ff", "#d6d5de", "#5c5a68", "#e9b64e"];
    const parts = [["Part", t.base[0]], ["Labor", t.base[1]], ["Supporting", t.base[2]], ["Tools", t.base[3]], ["Shipping", t.base[4]], ["Forgotten", t.hidden]];
    NS.$("#calc-out").innerHTML = `
      <div class="eyebrow">${esc(c.name || "This mod")}</div>
      <div class="thought" style="margin-top:12px">You thought this was <s>${money(c.part)}</s>.</div>
      <div class="lbl" style="margin-top:14px">Actual cost</div>
      <div class="actual">${money(t.total)}</div>
      <div class="quip">${quip(t.ratio)}<br><span class="dim">${t.ratio.toFixed(2)}× the sticker price</span></div>
      <div class="stackbar" aria-hidden="true">${parts.filter((p) => p[1] > 0).map((p, i) => `<i style="flex-grow:${p[1]};background:${cols[parts.indexOf(p)]}"></i>`).join("")}</div>
      <div class="legend">${parts.filter((p) => p[1] > 0).map((p) => `<span><i style="background:${cols[parts.indexOf(p)]}"></i>${p[0]} ${money(p[1])}</span>`).join("")}</div>
      <div class="divider"></div>
      <div class="grid g3">
        <div class="stat"><div class="k">Of budget left</div><div class="v ${t.total > remaining ? "bad" : ""}">${remaining > 0 ? Math.round((t.total / remaining) * 100) + "%" : "Over"}</div><div class="s">${money(Math.max(0, remaining))} remaining</div></div>
        <div class="stat"><div class="k">In oil changes</div><div class="v">${(t.total / 40).toFixed(1)}</div><div class="s">at about $40 each</div></div>
        <div class="stat"><div class="k">Surprise tax</div><div class="v warn">+${money(t.total - (+c.part || 0))}</div><div class="s">beyond the part</div></div>
      </div>`;
  }
  NS.inputs.calc = (el) => { const c = calcState(); c[el.dataset.k] = el.dataset.k === "name" ? el.value : Number(el.value); drawCalc(); };
  NS.inputs["calc-forget"] = (el) => { calcState().forget[el.dataset.k] = el.checked; drawCalc(); };
  NS.inputs["calc-from"] = (el) => {
    const c = calcState(); const m = NS.veh().mods.find((x) => x.id === el.value);
    if (!m) { c.modId = null; NS.render({ quiet: true }); return; }
    Object.assign(c, { modId: m.id, name: m.title, part: m.actual || m.est || 0, labor: 0, support: Math.round((m.est || 0) * 0.12), tools: 0, ship: 0 });
    c.forget = { hardware: true, tax: true, align: m.system === "SUSPENSION" || m.system === "WHEELS" };
    NS.render({ quiet: true });
  };
  NS.acts["calc-from"] = (el) => { NS.inputs["calc-from"]({ value: el.dataset.id }); NS.go("calc"); };
  NS.acts["calc-apply"] = () => {
    const c = calcState(); const t = calcTotals(c); const v = NS.veh();
    if (c.modId) { const m = v.mods.find((x) => x.id === c.modId); if (m) { m.est = Math.round(t.total); NS.commitVeh({ silent: true }); NS.toast(`Estimate updated to ${money(t.total)}`); } return; }
    const ph = NS.currentPhase(v).id;
    const id = NS.uid("m");
    v.mods.push({ id, phase: ph, order: 99, title: c.name || "New mod", system: "ENGINE", status: "planned", est: Math.round(t.total), actual: 0, diff: 3, tools: [], parts: [], notes: `Part ${money(c.part)} + everything else.`, photos: [] });
    c.modId = id; NS.commitVeh(); NS.toast(`Added to Phase 0${ph}`);
  };
  NS.acts["calc-expense"] = () => {
    const c = calcState(); const t = calcTotals(c);
    NS.expenseForm({ item: c.name, amount: Math.round(t.total), date: NS.today(), cat: "Maintenance", worth: 0 });
  };

  /* ================= SOUND LAB ================= */
  const AUD = [
    ["headUnit", "Head unit"], ["front", "Front speakers"], ["rear", "Rear speakers"], ["sub", "Subwoofer"],
    ["amp", "Amplifier"], ["wiring", "Wiring"], ["enclosure", "Enclosure"], ["extras", "Extras"],
  ];
  function audioCalc(a) {
    const total = AUD.reduce((s, [k]) => s + (+(a[k]?.price) || 0), 0);
    const amp = +a.amp?.rms || 0, sub = +a.sub?.rms || 0;
    const current = amp / (13.8 * 0.7);
    const gauge = current <= 30 ? "8" : current <= 60 ? "4" : current <= 120 ? "1/0" : "1/0 + big three";
    const match = !amp || !sub ? null : amp > sub * 1.25 ? ["warn", "Amp is a lot stronger than the sub. Set gain carefully or you'll cook it."] : amp < sub * 0.6 ? ["warn", "Amp is weak for this sub. It'll work, just not loud."] : ["ok", "Amp and sub are well matched."];
    const wireOk = a.wiring?.gauge && (gauge === a.wiring.gauge || (gauge === "8" && ["4", "1/0"].includes(a.wiring.gauge)) || (gauge === "4" && a.wiring.gauge === "1/0"));
    const vol = a.sub?.size >= 12 ? (a.enclosure?.type === "ported" ? 2.2 : 1.25) : a.sub?.size >= 10 ? (a.enclosure?.type === "ported" ? 1.5 : 0.9) : (a.enclosure?.type === "ported" ? 0.9 : 0.5);
    return { total, current, gauge, match, wireOk, vol };
  }

  function trunkSVG(a, r) {
    const e = a.enclosure || {}; const size = +a.sub?.size || 10;
    const bw = size * 11 + 40, bd = e.type === "ported" ? 112 : 92;
    const cx = e.pos === "left" ? 155 : e.pos === "right" ? 345 : 250;
    const by = 110;
    const fire = e.fire || "rear";
    const subR = size * 4.3;
    const subCy = fire === "rear" ? by + bd - 6 : fire === "forward" ? by + 6 : by + bd / 2;
    const ampX = a.ampPos === "seat" ? 250 : a.ampPos === "side" ? (cx > 250 ? 82 : 418) : 250;
    const ampY = a.ampPos === "seat" ? 72 : a.ampPos === "side" ? 150 : 256;
    const ampRot = a.ampPos === "side" ? 90 : 0;
    const pwrSide = 30;
    return `<svg viewBox="0 0 500 300" role="img" aria-label="Top-down trunk layout">
      <defs><pattern id="carpet" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#0d0c12"/><circle cx="1" cy="1" r=".6" fill="#16141e"/></pattern></defs>
      <g font-family="JetBrains Mono, monospace" font-size="9.5" fill="#716c84" letter-spacing=".5">
        <path d="M40 52 L460 52 L470 250 Q470 282 440 284 L60 284 Q30 282 30 250 Z" fill="url(#carpet)" stroke="#48445a"/>
        <path d="M30 120 Q30 90 70 92 L100 92 L100 210 L70 210 Q30 210 30 180 Z" fill="#141219" stroke="#2c2838"/>
        <path d="M470 120 Q470 90 430 92 L400 92 L400 210 L430 210 Q470 210 470 180 Z" fill="#141219" stroke="#2c2838"/>
        <text x="65" y="155" text-anchor="middle">WELL</text><text x="435" y="155" text-anchor="middle">WELL</text>
        <rect x="40" y="36" width="420" height="16" rx="3" fill="#1a1724" stroke="#2c2838"/>
        <text x="250" y="47.5" text-anchor="middle" font-size="8">REAR SEATBACK · CABIN AHEAD</text>
        <text x="250" y="298" text-anchor="middle">TRUNK LID / BUMPER</text>
        <path d="M${pwrSide} 8 L${pwrSide} 40 Q${pwrSide} 46 ${pwrSide + 10} 46 L${ampX - 30} 46 L${ampX - 30} ${ampY - 8}" fill="none" stroke="#f0566e" stroke-width="2" stroke-dasharray="${a.wiring?.price ? "0" : "4 3"}"/>
        <text x="${pwrSide + 4}" y="20" fill="#f0566e">+12V ${esc(a.wiring?.gauge || r.gauge)} AWG · FUSE AT BATTERY</text>
        <path d="M470 8 L470 40 Q470 46 460 46 L${ampX + 30} 46 L${ampX + 30} ${ampY - 8}" fill="none" stroke="#8ab4ff" stroke-width="1.5" stroke-dasharray="2 3"/>
        <text x="466" y="20" fill="#8ab4ff" text-anchor="end">RCA + REMOTE (OTHER SIDE)</text>
        <g transform="rotate(${ampRot} ${ampX} ${ampY})"><rect x="${ampX - 46}" y="${ampY - 16}" width="92" height="32" rx="4" fill="#1d1929" stroke="#a98cff"/>
        ${Array.from({ length: 9 }, (_, i) => `<line x1="${ampX - 38 + i * 9.5}" y1="${ampY - 10}" x2="${ampX - 38 + i * 9.5}" y2="${ampY + 10}" stroke="#3a3450"/>`).join("")}
        <text x="${ampX}" y="${ampY + 4}" text-anchor="middle" fill="#ecebf2">AMP ${a.amp?.rms || "?"}W</text></g>
        <rect x="${cx - bw / 2}" y="${by}" width="${bw}" height="${bd}" rx="5" fill="#121119" stroke="#d6d5de" stroke-opacity=".6"/>
        ${e.type === "ported" ? `<rect x="${cx + bw / 2 - 22}" y="${by + 8}" width="12" height="${bd - 16}" fill="#050407" stroke="#48445a"/>` : ""}
        ${fire === "up" ? `<circle cx="${cx - (e.type === "ported" ? 10 : 0)}" cy="${subCy}" r="${subR}" fill="#0a090e" stroke="#a98cff"/><circle cx="${cx - (e.type === "ported" ? 10 : 0)}" cy="${subCy}" r="${subR * 0.35}" fill="#1d1929" stroke="#5c5a68"/>`
          : `<rect x="${cx - subR - (e.type === "ported" ? 10 : 0)}" y="${subCy - 5}" width="${subR * 2}" height="10" rx="3" fill="#a98cff" opacity=".8"/>`}
        <text x="${cx}" y="${by + bd + 16}" text-anchor="middle" fill="#aaa6b8">${size}" ${String(e.type || "sealed").toUpperCase()} · ${r.vol.toFixed(1)} FT³ · FIRES ${fire.toUpperCase()}</text>
        <path d="M${ampX} ${ampY + (ampRot ? 0 : 16)} L${cx} ${by}" stroke="#a98cff" stroke-width="1.2" stroke-opacity=".7" fill="none"/>
      </g>
    </svg>`;
  }

  NS.views.sound = function () {
    const v = NS.veh(); const a = v.audio; const r = audioCalc(a);
    const row = ([k, l]) => {
      const x = a[k] || {};
      const extra = k === "sub" ? `<div class="field"><label for="au-${k}-size">Size</label><select class="select" id="au-${k}-size" data-ch="audio" data-k="${k}" data-f="size">${[8, 10, 12, 15].map((n) => `<option${+x.size === n ? " selected" : ""}>${n}</option>`).join("")}</select></div><div class="field"><label for="au-${k}-rms">RMS watts</label><input class="input num" type="number" id="au-${k}-rms" data-ch="audio" data-k="${k}" data-f="rms" value="${x.rms || 0}"></div>`
        : k === "amp" ? `<div class="field"><label for="au-${k}-rms">RMS watts</label><input class="input num" type="number" id="au-${k}-rms" data-ch="audio" data-k="${k}" data-f="rms" value="${x.rms || 0}"></div><div class="field"><label for="au-amppos">Mount</label><select class="select" id="au-amppos" data-ch="audio" data-k="_" data-f="ampPos">${[["floor", "Trunk floor"], ["seat", "Seatback"], ["side", "Side wall"]].map(([v2, l2]) => `<option value="${v2}"${(a.ampPos || "floor") === v2 ? " selected" : ""}>${l2}</option>`).join("")}</select></div>`
        : k === "wiring" ? `<div class="field"><label for="au-${k}-g">Gauge</label><select class="select" id="au-${k}-g" data-ch="audio" data-k="${k}" data-f="gauge">${["8", "4", "1/0"].map((g) => `<option${x.gauge === g ? " selected" : ""}>${g}</option>`).join("")}</select></div>`
        : k === "enclosure" ? `<div class="field"><label for="au-enc-type">Type</label><select class="select" id="au-enc-type" data-ch="audio" data-k="${k}" data-f="type">${["sealed", "ported"].map((g) => `<option${x.type === g ? " selected" : ""}>${g}</option>`).join("")}</select></div><div class="field"><label for="au-enc-pos">Position</label><select class="select" id="au-enc-pos" data-ch="audio" data-k="${k}" data-f="pos">${["left", "center", "right"].map((g) => `<option${x.pos === g ? " selected" : ""}>${g}</option>`).join("")}</select></div><div class="field"><label for="au-enc-fire">Fires</label><select class="select" id="au-enc-fire" data-ch="audio" data-k="${k}" data-f="fire">${["rear", "up", "forward"].map((g) => `<option${x.fire === g ? " selected" : ""}>${g}</option>`).join("")}</select></div>` : "";
      return `<div class="card" style="padding:12px">
        <div class="row between" style="margin-bottom:8px"><span class="lbl">${l}</span>${x.owned ? '<span class="tag ok">OWNED</span>' : ""}</div>
        <div class="form-grid">
          <div class="field"><label for="au-${k}-name">Model</label><input class="input" id="au-${k}-name" data-ch="audio" data-k="${k}" data-f="name" value="${esc(x.name || "")}"></div>
          <div class="field"><label for="au-${k}-price">Price</label><div class="prefix"><span>$</span><input class="input money" type="number" id="au-${k}-price" data-in="audio-price" data-ch="audio" data-k="${k}" data-f="price" value="${x.price || 0}"></div></div>
          ${extra}
        </div></div>`;
    };
    return `${NS.subnav()}
    <div class="page-head"><div><div class="eyebrow">SOUND LAB · ${esc(v.chassis)}</div><h1 class="h1" style="margin-top:6px">Audio system planner</h1><p class="lede">Plan the whole system before buying any of it. The trunk still has to hold groceries.</p></div></div>
    <div class="lab">
      <div class="stack">
        <div class="viz" id="au-viz">${trunkSVG(a, r)}<div class="viz-cap"><span>TOP VIEW · TRUNK</span><span>POWER ONE SIDE · SIGNAL THE OTHER</span></div></div>
        <div class="readouts" id="au-out"></div>
      </div>
      <div class="stack">${AUD.map(row).join("")}</div>
    </div>`;
  };
  NS.after.sound = () => drawAudio();
  function drawAudio() {
    const a = NS.veh().audio; const r = audioCalc(a);
    const owned = AUD.reduce((s, [k]) => s + (a[k]?.owned ? +a[k].price || 0 : 0), 0);
    NS.$("#au-out").innerHTML = `
      <div class="readout" style="grid-column:1/-1"><div class="k">APPROX. SYSTEM COST</div><div class="v" style="font-size:40px">${money(r.total)}</div><div class="s">${money(owned)} already owned · ${money(r.total - owned)} to go</div></div>
      <div class="readout"><div class="k">AMP CURRENT DRAW</div><div class="v">${r.current.toFixed(0)}<span class="dim" style="font-size:14px"> A</span></div><div class="s">at full output, approx.</div></div>
      <div class="readout"><div class="k">POWER WIRE</div><div class="v ${r.wireOk ? "ok" : "warn"}">${r.gauge}<span class="dim" style="font-size:14px"> AWG</span></div><div class="s">${r.wireOk ? "Your kit is big enough" : "Upgrade the wiring kit"}</div></div>
      ${r.match ? `<div class="readout" style="grid-column:1/-1"><div class="k">AMP ↔ SUB</div><div class="s ${r.match[0]}" style="font-size:14.5px;margin-top:6px">${r.match[1]}</div></div>` : ""}`;
  }
  NS.inputs.audio = (el) => {
    const v = NS.veh(); const a = v.audio; const k = el.dataset.k, f = el.dataset.f;
    let val = el.value; if (["price", "rms", "size"].includes(f)) val = Number(val) || 0;
    if (k === "_") a[f] = val; else { a[k] = a[k] || {}; a[k][f] = val; }
    NS.commitVeh({ silent: true });
    const viz = NS.$("#au-viz"); if (viz) viz.firstElementChild.outerHTML = trunkSVG(a, audioCalc(a));
    drawAudio();
  };
  NS.inputs["audio-price"] = (el) => { const a = NS.veh().audio; a[el.dataset.k] = a[el.dataset.k] || {}; a[el.dataset.k].price = Number(el.value) || 0; drawAudio(); };
})();
