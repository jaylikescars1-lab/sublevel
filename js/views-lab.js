/* BUILD tools: Wheel Fitment Lab, Mod Calculator, Sound Lab. */
(function () {
  const NS = window.NS, D = window.NS_DATA;
  /* F reads the current car's fitment baseline (its own specs, or the built-in EK numbers). */
  const F = new Proxy({}, { get: (_, k) => NS.fitBase(NS.veh())[k] });
  const { esc, money, num, icon, clamp } = NS;

  /* ================= FITMENT ================= */
  /* The math lives in fit.js (NS.fit). This is the page: state, readouts, fixes, drawings. */
  const fitState = () => {
    if (!NS.ui.fit || NS.ui.fitFor !== NS.veh().id) {
      NS.ui.fitFor = NS.veh().id;
      const w = NS.veh().wheel || {}, st = F.stock;
      const t = NS.parseTire(w.tire) || { tw: st.tw, ar: st.ar };
      NS.ui.fit = { dia: w.dia || st.dia, width: w.width || st.width, offset: w.offset ?? st.offset, tw: t.tw, ar: t.ar, drop: w.drop || 0,
        camber: w.camber ?? null, rcamber: w.rcamber ?? null, spacer: w.spacer || 0, fenders: w.fenders || "stock", rfenders: w.rfenders || w.fenders || "stock" };
    }
    return NS.ui.fit;
  };
  NS.fitState = fitState;
  const IN = 25.4, inch = (mm) => (mm / IN).toFixed(1);
  const sgn = (n, d = 0) => (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(d);

  /* Both axles. The front uses the slider camber and fender setting; the rear has its own (most people roll the rear first). */
  const headOf = (r, part = "strut") => r.margin < 0 ? (r.rubAt === 0 ? "Rubs at ride height." : r.rubAt / r.travel > 0.75 ? "Rubs over big bumps." : "Rubs over bumps.")
    : r.innerClear < 0 ? `Hits the ${part}.` : r.innerClear < 5 ? `Too close to the ${part}.` : r.margin < 5 ? "Clears, barely."
    : r.fit === "stretched" ? "Fits, on a stretched tire." : r.poke > 3 ? "Fits, but sticks out." : r.linerHit ? "Fits. May touch the liner over big bumps." : "Clean fit. Daily-able.";
  const rearOf = (s) => ({ ...s, camber: s.rcamber, fenders: s.rfenders || "stock" });
  // Lines about the lip and the suspension for one axle. `who` is "" when only one axle has something to say.
  function axleFixes(r, s, who, part) {
    const out = [], P = (t) => (who ? who + ": " + t[0].toLowerCase() + t.slice(1) : t);
    if (r.margin < 0) {
      const need = Math.ceil(-r.margin + 3);
      const deg = r.worst && r.worst.Y > 0 ? need / (r.worst.Y * Math.sin(Math.PI / 180)) : 0;
      const ways = [];
      if (s.offset + need <= r.win.max) ways.push(`+${s.offset + need} offset or higher`);
      if (deg > 0 && deg < 4) ways.push(`about ${deg.toFixed(1)}° more negative camber`);
      if (s.fenders === "stock") ways.push(need <= 10 ? "rolled fenders (about 10 mm)" : "rolled and pulled fenders");
      else if (s.fenders === "rolled") ways.push("pulled fenders (about 12 mm more)");
      out.push(P((r.rubAt === 0 ? "Rubs the fender lip at ride height." : `Rubs the fender lip after ${inch(r.rubAt)} in of compression: big bumps, dips, a full car.`) + (ways.length ? " Fix: " + ways.join(", or ") + "." : "")));
    } else if (r.margin < 5) out.push(P(`Clears the lip by only ${r.margin.toFixed(0)} mm at full bump. Tires vary a few mm by brand, so rolled fenders are cheap insurance.`));
    if (r.innerClear < 5) out.push(P(r.innerClear < 0 ? `Hits the ${part} by ${(-r.innerClear).toFixed(0)} mm. Go at least ${Math.ceil(5 - r.innerClear)} mm lower offset (or a spacer that size), or a narrower tire.` : `Only ${r.innerClear.toFixed(0)} mm to the ${part}. A ${Math.ceil(5 - r.innerClear)} mm lower offset or a spacer that size gives safe room.`));
    if (r.linerHit) out.push(P("Over big bumps the tread can reach the inner fender liner. Trim or heat the liner, or keep a little more ride height."));
    if (r.poke > 3) out.push(P(`Sticks out ${r.poke.toFixed(0)} mm past the fender lip at the top. It throws water and grit on the paint, and some places ticket uncovered tires.`));
    return out;
  }
  NS.fitCalc = function (s) {
    const base = NS.fitBase(NS.veh()), rb = { ...base, ...base.rear };
    const r = NS.fit.calc(base, s), rear = NS.fit.calc(rb, rearOf(s));
    const risk = Math.max(r.risk, rear.risk), worse = rear.risk > r.risk ? "rear" : "front";
    // Headline names the biggest problem on the worse axle; the colour comes from the overall risk.
    const hf = headOf(r), hr = headOf(rear, "suspension");
    const head = worse === "rear" && hr !== hf ? "Rear " + hr[0].toLowerCase() + hr.slice(1) : hf;
    const level = [risk < 25 ? "LOW" : risk < 55 ? "MEDIUM" : risk < 80 ? "HIGH" : "GRINDING", risk < 25 ? "ok" : risk < 55 ? "warn" : "bad", head];

    const fFix = axleFixes(r, s, "", "strut"), rFix = axleFixes(rear, rearOf(s), "", "rear suspension");
    const both = fFix.length && rFix.length;
    const fixes = both ? axleFixes(r, s, "Front", "strut").concat(axleFixes(rear, rearOf(s), "Rear", "rear suspension")) : rFix.length ? axleFixes(rear, rearOf(s), "Rear", "rear suspension") : fFix;
    if (r.fit === "stretched") fixes.push(`${s.tw} on a ${s.width}" rim is a stretch (this size is made for ${r.range[0]}–${r.range[1]}"). It tucks better, but the bead can unseat at low pressure or in a hard corner, and some shops won't mount it.`);
    else if (r.fit === "pinched") fixes.push(`${s.width}" is narrower than this tire wants (${r.range[0]}–${r.range[1]}"). The sidewall bulges out and steering feels soft.`);
    if (s.spacer >= 10) fixes.push(`A ${s.spacer} mm spacer needs bolt-on spacers or longer studs: keep at least 8 full turns of thread on every lug nut.`);
    else if (s.spacer > 0) fixes.push(`Slip-on spacers eat thread. Make sure every lug nut still gets 8 full turns.`);
    if (Math.abs(r.track) >= 16) fixes.push(r.track > 0 ? `Track is ${r.track.toFixed(0)} mm wider than stock: more grip and stance, but heavier steering and more kickback over bumps.` : `Track is ${(-r.track).toFixed(0)} mm narrower than stock.`);
    if (r.lock) fixes.push("Bigger or further in than stock: turn to full lock both ways and check the frame rail and liner.");
    if (Math.abs(r.speedo) > 3) fixes.push(`Speedo will read ${r.speedo > 0 ? "slow" : "fast"} by ${Math.abs(r.speedo).toFixed(1)}%.`);
    if (!fixes.length) fixes.push("Clean fit front and rear. No modifications needed.");

    const win = { min: Math.max(r.win.min, rear.win.min), max: Math.min(r.win.max, rear.win.max) };
    const tires = (F.tires[s.dia] || []).map((ts) => {
      const p = NS.parseTire(ts); const x = NS.fit.calc(base, { ...s, tw: p.tw, ar: p.ar }), y = NS.fit.calc(rb, rearOf({ ...s, tw: p.tw, ar: p.ar }));
      const k = Math.max(x.risk, y.risk);
      return { t: ts, p, diff: x.speedo, risk: k, fit: x.fit, tag: k < 25 ? "FITS" : k < 55 ? "TIGHT" : "RUBS" };
    }).filter((x) => Math.abs(x.diff) <= 4 && x.fit !== "pinched").sort((a, b) => a.risk - b.risk || Math.abs(a.diff) - Math.abs(b.diff)).slice(0, 4);

    return { ...r, front: r, rear, risk, worse, win, level, fixes, tires, rideChange: r.ride / IN, rearEst: !!base.rearEst };
  };

  /* Cross-section of the top of the wheel, looking from the front. Outside of the car is to the right.
     Solid fender = at rest; dashed = at full bump. Fixed scale per car, so the sliders move the parts, not the frame. */
  function frontView(s, r, axle = "front") {
    const W = 440, Hh = 330, C = r.C, w = r.w, t = r.t;
    const xMin = -C.innerLimit - 46, xMax = C.lipOut + 80;
    const stockH0 = r.ts.OD / 2 + C.stockGap, yMin = stockH0 - 230, yMax = stockH0 + 46;
    const k = Math.min(W / (xMax - xMin), Hh / (yMax - yMin));
    const X = (x) => ((x - xMin) * k).toFixed(1), Y = (y) => (Hh - (y - yMin) * k).toFixed(1);
    const tl = (r.tilt0 * Math.PI) / 180, cs = Math.cos(tl), sn = Math.sin(tl), xc = -r.off;
    const P = (u, v) => [xc + u * cs - v * sn, u * sn + v * cs];
    const pts = (arr) => arr.map(([u, v]) => { const [x, y] = P(u, v); return X(x) + "," + Y(y); }).join(" ");
    const prof = []; for (let rr = w.Rf; rr <= t.OD / 2; rr += 3) prof.push(rr); prof.push(t.OD / 2);
    const tireP = pts([...prof.map((rr) => [NS.fit.halfWidth(t, w, rr), rr]), ...prof.slice().reverse().map((rr) => [-NS.fit.halfWidth(t, w, rr), rr])]);
    const rimP = pts([[-w.Wo / 2, w.R - 60], [-w.Wo / 2, w.Rf], [-w.Wo / 2 + 9, w.Rf], [-w.Wo / 2 + 9, w.R], [w.Wo / 2 - 9, w.R], [w.Wo / 2 - 9, w.Rf], [w.Wo / 2, w.Rf], [w.Wo / 2, w.R - 60]]);
    const fender = (dy) => {
      const H = r.H0 - dy, lx = r.lipX, fold = s.fenders === "stock" ? `L${X(r.lipEff)} ${Y(H + 3)}` : s.fenders === "rolled" ? `Q${X(lx - 4)} ${Y(H - 2)} ${X(lx - 6)} ${Y(H + 4)}` : "";
      return `M${X(-C.innerLimit + 6)} ${Y(H + 40)} L${X(lx - 22)} ${Y(H + 40)} Q${X(lx)} ${Y(H + 40)} ${X(lx)} ${Y(H + 14)} L${X(lx)} ${Y(H)} ${fold} M${X(lx)} ${Y(H + 14)} Q${X(lx + 4)} ${Y(H + 40)} ${X(xMax)} ${Y(H + 44)}`;
    };
    const rub = r.margin < 0, col = rub ? "#f0566e" : r.margin < 5 ? "#e9b64e" : "#6fd3a0";
    const icol = r.innerClear < 0 ? "#f0566e" : r.innerClear < 5 ? "#e9b64e" : "#6fd3a0";
    let inY = w.Rf, inX = 0;
    for (let rr = w.R; rr <= t.OD / 2; rr += 2) { const [x, y] = P(-NS.fit.halfWidth(t, w, rr), rr); if (-x > inX) { inX = -x; inY = y; } }
    // The contact can be part-way round the arch; draw it on this section at the same distance from the hub.
    const mark = rub && r.worst ? `<circle cx="${X(r.worst.X)}" cy="${Y(r.worst.r)}" r="5" fill="none" stroke="#f0566e" stroke-width="2"/>` : "";
    return `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Front section: tire, wheel, strut and fender lip at rest and at full bump">
      <defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#2c2838" stroke-width="2"/></pattern>
        <linearGradient id="tread" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2832"/><stop offset="1" stop-color="#0d0c11"/></linearGradient>
        <linearGradient id="rimg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8d8b9a"/><stop offset=".5" stop-color="#e9e8ef"/><stop offset="1" stop-color="#8d8b9a"/></linearGradient></defs>
      <g font-family="JetBrains Mono, monospace" font-size="12.5" fill="#8a86a0">
        <line x1="${X(0)}" y1="${Y(yMax)}" x2="${X(0)}" y2="${Hh}" stroke="#a98cff" stroke-opacity=".45" stroke-dasharray="3 4"/>
        <text x="${+X(0) + 4}" y="${Hh - 6}">HUB FACE</text>
        <rect x="${X(-C.innerLimit - 24)}" y="${Y(yMax - 18)}" width="${(24 * k).toFixed(1)}" height="${(+Y(yMin + 20) - +Y(yMax - 18)).toFixed(1)}" fill="url(#hatch)" stroke="#48445a"/>
        <text x="${X(-C.innerLimit - 12)}" y="${Hh - 6}" text-anchor="middle">${axle === "rear" ? "ARM" : "STRUT"}</text>
        <polygon points="${rimP}" fill="url(#rimg)" opacity=".85"/>
        <polygon points="${tireP}" fill="url(#tread)" stroke="#3a3747" stroke-width="1.2"/>
        <path d="${fender(0)}" fill="none" stroke="#d6d5de" stroke-width="2.4"/>
        <path d="${fender(r.travel)}" fill="none" stroke="${col}" stroke-width="1.6" stroke-dasharray="5 4" opacity=".9"/>
        <text x="${W - 4}" y="${+Y(r.H0 - r.travel + 44) - 6}" text-anchor="end" fill="${col}">FULL BUMP ${inch(r.travel)}"</text>
        ${mark}
        <g stroke="${icol}" fill="${icol}"><line x1="${X(-C.innerLimit)}" y1="${Y(inY)}" x2="${X(-inX)}" y2="${Y(inY)}" stroke-width="1"/>
          <text x="${((+X(-C.innerLimit) + +X(-inX)) / 2).toFixed(1)}" y="${+Y(inY) - 6}" text-anchor="middle" stroke="none">${r.innerClear.toFixed(0)}mm</text></g>
        <text x="${(+X(xc)).toFixed(1)}" y="${(+Y(w.R - 30)).toFixed(1)}" text-anchor="middle" fill="#aaa6b8">${s.dia}x${s.width} ${sgn(s.offset)}${s.spacer ? " +" + s.spacer + "mm spacer" : ""}</text>
        <text x="12" y="22" fill="#a98cff" font-family="Silkscreen, monospace" font-size="11.5">${axle === "rear" ? "REAR" : "FRONT"} SECTION · CAMBER ${r.camber.toFixed(1)}°</text>
        <text x="12" y="40" font-size="12">${rub ? `<tspan fill="#f0566e">RUBS ${r.rubAt === 0 ? "AT REST" : "AT " + inch(r.rubAt) + "\" BUMP"}</tspan>` : r.margin === 99 ? "LIP NEVER REACHES THE TIRE" : `CLEARS BY ${r.margin.toFixed(0)}MM AT FULL BUMP`}</text>
      </g>
    </svg>`;
  }

  NS.views.fitment = function () {
    const s = fitState();
    const ctrl = (k, l, min, max, step, fmt, val = s[k]) => `<div class="ctrl"><label class="lbl" for="fit-${k}">${l}</label><output id="fit-${k}-o">${fmt(val)}</output><input type="range" id="fit-${k}" data-in="fit" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${val}"></div>`;
    const presetActive = (p) => p.dia === s.dia && p.width === s.width && p.offset === s.offset && p.tw === s.tw;
    const r = NS.fitCalc(s); const v = NS.veh(); const wh = (v.specs && v.specs.wheels) || {};
    return `${NS.subnav()}
    <div class="page-head"><div><div class="eyebrow">WHEEL FITMENT LAB · ${esc(v.chassis)}</div><h1 class="h1" style="margin-top:6px">Will it fit, and will it rub?</h1><p class="lede">Compared to the factory ${F.stock.dia}x${F.stock.width} ${sgn(F.stock.offset)} with ${F.stock.tw}/${F.stock.ar}R${F.stock.dia}${F.own ? " from this car's spec sheet" : ""}. It checks the strut, the fender at rest and all the way to the bump stop.</p></div></div>
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
          ${ctrl("dia", "Wheel diameter", 13, 20, 1, (x) => x + '"')}
          ${ctrl("width", "Wheel width", 5, 11, 0.5, (x) => x + '"')}
          ${ctrl("offset", "Offset", -25, 60, 1, (x) => sgn(x))}
          ${ctrl("tw", "Tire width", 165, 305, 5, (x) => x + "mm")}
          ${ctrl("ar", "Tire aspect", 30, 75, 5, (x) => x)}
          ${ctrl("drop", "Suspension drop", 0, 4, 0.25, (x) => (+x ? "−" + x : "0") + " in")}
          <details class="more"${NS.ui.fitMore ? " open" : ""} id="fit-more"><summary class="lbl">Camber, spacers, fenders, front and rear</summary>
            <div class="stack" style="gap:16px;margin-top:12px">
              ${ctrl("camber", "Front camber", -5, 1, 0.25, (x) => (+x).toFixed(2) + "°" + (s.camber == null ? " · auto" : ""), s.camber == null ? +r.autoCamber.toFixed(2) : s.camber)}
              ${ctrl("rcamber", "Rear camber", -5, 1, 0.25, (x) => (+x).toFixed(2) + "°" + (s.rcamber == null ? " · auto" : ""), s.rcamber == null ? +r.rear.autoCamber.toFixed(2) : s.rcamber)}
              <p class="dim" id="fit-camber-note" style="font-size:13px;margin:-8px 0 0"${s.camber == null && s.rcamber == null ? "" : " hidden"}>Estimated from the drop. Move them if you know your alignment.</p>
              <button class="btn sm ghost" id="fit-camber-auto" data-act="fit-camber-auto" style="margin-top:-8px;justify-self:start"${s.camber == null && s.rcamber == null ? " hidden" : ""}>Back to auto</button>
              ${ctrl("spacer", "Wheel spacer", 0, 25, 1, (x) => x + " mm")}
              ${[["fenders", "Front fender lips"], ["rfenders", "Rear fender lips"]].map(([fk, fl]) => `<div><span class="lbl">${fl}</span><div class="seg" style="margin-top:6px">${[["stock", "Stock"], ["rolled", "Rolled"], ["pulled", "Pulled"]].map(([k2, l]) => `<button type="button" data-act="fit-fenders" data-k="${fk}" data-v="${k2}" aria-pressed="${s[fk] === k2}">${l}</button>`).join("")}</div></div>`).join("")}
            </div></details>
        </div>
        <div class="infobox" id="fit-fixes"></div>
        <div class="panel tight"><div class="lbl" style="margin-bottom:8px">Tire sizes for this wheel</div><div id="fit-tires" class="stack" style="gap:6px"></div></div>
        <div class="panel tight row between" style="gap:12px;flex-wrap:wrap"><div style="min-width:0;flex:1 1 200px"><div class="lbl">${F.measured ? "Your measurements" : "Make it exact"}</div><p class="muted" style="font-size:13.5px;margin:4px 0 0">${F.measured ? `Using your car's own numbers from ${NS.fmtDate(F.measured)} ${String(F.measured).slice(0, 4)}.` : "Six tape measurements replace the averages with your car's real numbers. About 10 minutes."}</p></div><button class="btn sm" data-act="fit-measure">${icon("edit")}${F.measured ? "Measure again" : "Measure my car"}</button></div>
        <button class="btn" data-act="fit-save">${icon("check")}Save as my planned wheel setup</button>
        <button class="btn" data-act="shop-fit">${icon("cart")}Shop this setup</button>
        <details class="spec-sheet"><summary><div><div class="eyebrow">HOW THIS IS CALCULATED</div><div class="spec-line">The math, and what to check before you buy</div></div>${icon("chev")}</summary>
          <ul class="clean-list" style="margin-top:12px;font-size:13.5px">
            <li><b>Tire width on your rim.</b> A tire's listed width is on its measuring rim. Every 1 mm of extra rim adds about 0.4 mm of section width (ETRTO, Tire Rack's 0.2"-per-0.5" rule). Real tires vary a few mm by brand.</li>
            <li><b>Wheel width.</b> A wheel is about 1" wider overall than its stated width, because of the flanges.</li>
            <li><b>Camber.</b> Negative camber pulls the top of the tire in by height × sin(angle), about 5 mm per degree at the top. It's estimated from the drop (${NS.fit.car(NS.fitBase(v)).gain}° per inch on this ${NS.fitBase(v).suspension.replace("_", " ")} front end) unless you set it.</li>
            <li><b>Rubbing.</b> The fender lip is moved down through the suspension's travel to the bump stop, with camber changing as it goes, and checked against the tire's real cross-section. A stock lip folds inward about 10 mm. Rolling removes that fold; pulling moves the lip out about 12 mm.</li>
            <li><b>Strut.</b> The widest inner part of the tire's upper half, with camber, against the nearest suspension part.</li>
            <li><b>Rear.</b> Checked the same way with its own numbers: ${r.rearEst ? "estimated from the front for this car, so treat the rear as rougher" : "Honda's −1° factory rear camber, and a lip fitted to EK owner reports. There are fewer rear reports than front ones"}.</li>
            <li><b>Poke.</b> How far the wheel or tire sticks out past the lip at the top, with camber. That's what "flush" means, and what tire-coverage rules look at.</li>
            <li><b>Before you buy:</b> bolt pattern ${esc(wh.bolt || "matches your hubs")}; hub bore ${esc(wh.centerBore || "same or bigger than your hub")} (bigger needs hub-centric rings); lug nuts with the seat the wheel maker specifies (usually 60° conical); load index at least as high as stock; and that the spokes clear your brake calipers.</li>
          </ul>
          <p class="dim" style="font-size:12.5px;margin:10px 0 0">Planning numbers. On the EK the front matches 11 of 11 owner reports it was tuned on and 5 of 6 it wasn't. Test-fit one wheel at full lock and with weight on the car before you buy a set.</p>
        </details>
      </div>
    </div>`;
  };
  NS.after.fitment = () => drawFit();
  function drawFit() {
    const s = fitState(); const r = NS.fitCalc(s);
    const v = NS.veh();
    NS.$("#fit-side").innerHTML = NS.carSVG({ id: "fit", dia: s.dia, od: r.od, drop: s.drop, paint: v.paintHex, reflection: false, labels: true, alt: "Side view with this wheel setup" }) +
      `<div class="viz-cap"><span>SIDE · ${s.dia}x${s.width} ${sgn(s.offset)} · ${s.tw}/${s.ar}R${s.dia}</span><span>RIDE ${sgn(r.rideChange, 2)} IN</span></div>`;
    const axle = NS.ui.fitAxle || r.worse, ax = axle === "rear" ? r.rear : r.front;
    NS.$("#fit-front").innerHTML = `<div class="row" style="padding:10px 12px 0;justify-content:flex-end">
      <div class="seg mini" role="group" aria-label="Axle">${[["front", "Front"], ["rear", "Rear"]].map(([k2, l]) => `<button type="button" data-act="fit-axle" data-v="${k2}" aria-pressed="${axle === k2}">${l}${(k2 === "rear" ? r.rear : r.front).margin < 0 ? " ●" : ""}</button>`).join("")}</div></div>` +
      frontView(axle === "rear" ? rearOf(s) : s, ax, axle) + `<div class="viz-cap"><span>LIP ${ax.lipX.toFixed(0)}MM OUT · ${axle === "rear" ? "SUSPENSION" : "STRUT"} ${ax.C.innerLimit}MM IN · TRAVEL ${inch(ax.travel)}"</span><span>${ax.fit.toUpperCase()} · OD ${ax.od.toFixed(0)}MM</span></div>`;
    const lv = r.level;
    const col = lv[1] === "ok" ? "#6fd3a0" : lv[1] === "warn" ? "#e9b64e" : "#f0566e";
    const a = (r.risk / 100) * 270;
    const arc = (deg) => { const t = ((deg - 225) * Math.PI) / 180; return [37 + 30 * Math.cos(t), 37 + 30 * Math.sin(t)]; };
    const [sx, sy] = arc(0), [ex, ey] = arc(Math.max(0.1, a)), [fx, fy] = arc(270);
    NS.$("#fit-risk").innerHTML = `<svg class="gauge" viewBox="0 0 74 74" aria-hidden="true"><path d="M${sx} ${sy} A30 30 0 1 1 ${fx} ${fy}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="6" stroke-linecap="round"/><path d="M${sx} ${sy} A30 30 0 ${a > 180 ? 1 : 0} 1 ${ex} ${ey}" fill="none" stroke="${col}" stroke-width="6" stroke-linecap="round"/><text x="37" y="42" text-anchor="middle" font-family="Barlow Semi Condensed, sans-serif" font-weight="600" font-size="17" fill="${col}">${r.risk}</text></svg>
      <div style="min-width:0"><div class="lbl">Fitment risk</div><div class="big ${lv[1]}" style="font-size:28px;margin-top:4px">${lv[0]}</div><div class="muted" style="font-size:14px;margin-top:2px">${lv[2]}</div></div>`;
    const mm = '<span class="dim" style="font-size:14px"> mm</span>';
    const ro = (k, val, sub, cls = "") => `<div class="readout"><div class="k">${k}</div><div class="v ${cls}">${val}</div><div class="s">${sub}</div></div>`;
    const inWin = s.offset >= r.win.min && s.offset <= r.win.max;
    // Each readout shows the worse axle big and the other one underneath.
    const F_ = r.front, R_ = r.rear;
    const pick = (f) => (f(R_) < f(F_) ? ["REAR", R_, "front", F_] : ["FRONT", F_, "rear", R_]);
    const rubV = (x) => (x.margin < 0 ? (x.rubAt === 0 ? "RUBS" : `RUBS @${inch(x.rubAt)}"`) : x.margin === 99 ? "CLEAR" : "+" + x.margin.toFixed(0) + mm);
    const rubS = (x) => (x.margin < 0 ? "rubs" : x.margin === 99 ? "clear" : "+" + x.margin.toFixed(0) + " mm");
    const [ia, ix, ib, iy] = pick((x) => x.innerClear), [pa, px, pb, py] = pick((x) => -x.poke), [ma, mx, mb, my] = pick((x) => x.margin);
    NS.$("#fit-readouts").innerHTML =
      ro("INNER CLEARANCE", ix.innerClear.toFixed(0) + mm, `${ia.toLowerCase()} · ${ib} ${iy.innerClear.toFixed(0)} mm`, ix.innerClear < 0 ? "bad" : ix.innerClear < 5 ? "warn" : "ok") +
      ro("FENDER POKE", sgn(px.poke) + mm, `${pa.toLowerCase()}, ${px.poke > 3 ? "sticks out" : px.poke > -5 ? "flush" : "tucked in"} · ${pb} ${sgn(py.poke)}`, px.poke > 3 ? "bad" : px.poke > -5 ? "warn" : "") +
      ro("RUB CHECK", rubV(mx), `${ma.toLowerCase()}, ${inch(mx.travel)}" of bump · ${mb} ${rubS(my)}`, mx.margin < 0 ? "bad" : mx.margin < 5 ? "warn" : "ok") +
      ro("OFFSET WINDOW", r.win.min > r.win.max ? "NONE" : `${sgn(r.win.min)}…${sgn(r.win.max)}`, r.win.min > r.win.max ? "no offset fits this setup" : "offsets that fit this setup", inWin ? "ok" : "warn") +
      ro("RIDE HEIGHT", sgn(r.rideChange, 2) + '<span class="dim" style="font-size:14px"> in</span>', "vs. stock, approx.") +
      ro("DIAMETER", sgn(r.speedo, 1) + '<span class="dim" style="font-size:14px"> %</span>', "speedo error vs. stock", Math.abs(r.speedo) > 3 ? "warn" : "") +
      ro("SIDEWALL", r.fit.toUpperCase(), `made for ${r.range[0]}–${r.range[1]}" rims`, r.fit === "in range" ? "" : "warn") +
      ro("CAMBER", r.camber.toFixed(1) + '<span class="dim" style="font-size:14px">°</span>', `front · rear ${R_.camber.toFixed(1)}°${s.camber == null && s.rcamber == null ? " · from the drop" : ""}`);
    NS.$("#fit-fixes").innerHTML = `<h4>WHAT IT NEEDS</h4><ul>${r.fixes.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>`;
    NS.$("#fit-tires").innerHTML = r.tires.length ? r.tires.map((x) => `<button class="row between card hover" style="padding:9px 12px" data-act="fit-tire" data-t="${x.t}"><span class="mono">${x.t}</span><span class="row" style="gap:8px"><span class="tag ${x.tag === "FITS" ? "ok" : x.tag === "TIGHT" ? "warn" : "bad"}">${x.tag}${x.fit === "stretched" ? " · STRETCH" : ""}</span><span class="mono dim" style="font-size:12px">${sgn(x.diff, 1)}%</span></span></button>`).join("")
      : '<span class="dim" style="font-size:14px">No common sizes for this wheel. Try a different width or diameter.</span>';
  }
  const FMT = { dia: (x) => x + '"', width: (x) => x + '"', offset: (x) => sgn(x), tw: (x) => x + "mm", ar: (x) => x, drop: (x) => (x ? "−" + x : "0") + " in", spacer: (x) => x + " mm", camber: (x) => x.toFixed(2) + "°", rcamber: (x) => x.toFixed(2) + "°" };
  NS.inputs.fit = (el) => {
    const s = fitState(), k = el.dataset.k; s[k] = Number(el.value);
    const out = NS.$("#fit-" + k + "-o"); if (out) out.textContent = FMT[k](s[k]);
    NS.$$("[data-act=fit-preset]").forEach((b) => { const p = F.presets[+b.dataset.i]; b.setAttribute("aria-pressed", p.dia === s.dia && p.width === s.width && p.offset === s.offset && p.tw === s.tw); });
    if (k === "camber" || k === "rcamber") { const n = NS.$("#fit-camber-note"), b = NS.$("#fit-camber-auto"); if (n) n.hidden = true; if (b) b.hidden = false; }
    cancelAnimationFrame(NS._fitRaf); NS._fitRaf = requestAnimationFrame(drawFit);
  };
  document.addEventListener("toggle", (e) => { if (e.target && e.target.id === "fit-more") NS.ui.fitMore = e.target.open; }, true);
  NS.acts["fit-camber-auto"] = () => { const s = fitState(); s.camber = null; s.rcamber = null; NS.render({ quiet: true }); };
  NS.acts["fit-fenders"] = (el) => { fitState()[el.dataset.k || "fenders"] = el.dataset.v; NS.render({ quiet: true }); };
  NS.acts["fit-axle"] = (el) => { NS.ui.fitAxle = el.dataset.v; drawFit(); };
  NS.acts["fit-preset"] = (el) => {
    const p = F.presets[+el.dataset.i]; const s = fitState();
    Object.assign(s, { dia: p.dia, width: p.width, offset: p.offset, tw: p.tw, ar: p.ar, spacer: 0 });
    if (p.drop != null) s.drop = p.drop; else if (p.dia > F.stock.dia && s.drop === 0) s.drop = 1.5;
    if (/^Stock/.test(p.n)) { s.drop = 0; s.fenders = s.rfenders = "stock"; s.camber = s.rcamber = null; }
    if (p.fenders) s.fenders = s.rfenders = p.fenders;
    NS.render({ quiet: true }); NS.toast(p.note);
  };
  /* Tape measurements -> this car's own lip, strut and gap numbers, front and rear. */
  NS.acts["fit-measure"] = () => {
    const v = NS.veh(); const base = NS.fitBase(v), st = base.stock;
    const sp = v.specs || {}; const prev = sp.fitment || {};
    const mm = (k, l) => ({ k, l, t: "number", step: 1, blank: true });
    NS.form({ eyebrow: "MEASURE MY CAR", title: "Your car's real numbers", saveLabel: "Use these numbers",
      intro: `Car on level ground at its normal height, steering straight, nobody in it. Measure at the top of each wheel, in millimeters. Skip anything you can't reach.
        <ol><li><b>Lip to rim:</b> hold a straight edge down from the fender lip and measure across to the outer edge of the wheel rim. Negative if the rim sticks out past the lip.</li>
        <li><b>Tire to suspension:</b> the smallest gap between the inside of the tire and the strut or arm.</li>
        <li><b>Tire to lip:</b> from the top of the tread straight up to the fender lip.</li></ol>`,
      value: { dia: st.dia, width: st.width, offset: st.offset, tire: `${st.tw}/${st.ar}R${st.dia}`, drop: 0 },
      fields: [
        { t: "note", html: "Wheels on the car right now" },
        { k: "dia", l: "Wheel diameter (in)", t: "number", step: 1 }, { k: "width", l: "Wheel width (in)", t: "number", step: 0.5 },
        { k: "offset", l: "Offset (mm)", t: "number", step: 1 }, { k: "tire", l: "Tire size", t: "text", ph: "185/65R14" },
        { k: "drop", l: "Lowered by (in)", t: "number", step: 0.25 },
        { t: "note", html: "Front wheel" }, mm("f_lip", "Lip to rim (mm)"), mm("f_inner", "Tire to strut (mm)"), mm("f_gap", "Tire to lip (mm)"),
        { t: "note", html: "Rear wheel" }, mm("r_lip", "Lip to rim (mm)"), mm("r_inner", "Tire to arm (mm)"), mm("r_gap", "Tire to lip (mm)"),
      ],
      onSave: (o) => {
        const t = NS.parseTire(o.tire); if (!t) { NS.toast("Check the tire size, like 185/65R14."); return false; }
        const common = { dia: o.dia, width: o.width, offset: o.offset, tw: t.tw, ar: t.ar, drop: o.drop || 0, stock: st };
        const front = NS.fit.fromMeasure({ ...common, camber: base.stockCamber - NS.fit.car(base).gain * (o.drop || 0), suspension: base.suspension, lip: o.f_lip, inner: o.f_inner, gap: o.f_gap });
        const rb = { ...base, ...base.rear };
        const rear = NS.fit.fromMeasure({ ...common, camber: rb.stockCamber - NS.fit.car(rb).gain * (o.drop || 0), suspension: base.suspension, lip: o.r_lip, inner: o.r_inner, gap: o.r_gap });
        if (!Object.keys(front).length && !Object.keys(rear).length) { NS.toast("Nothing measured yet."); return false; }
        v.specs = { ...sp, fitment: { ...prev, ...front, rear: { ...(prev.rear || {}), ...rear }, measured: NS.today() } };
        NS.commitVeh(); NS.toast("Saved. Fitment now uses your car's own numbers.");
      } });
  };
  NS.acts["fit-tire"] = (el) => {
    const p = NS.parseTire(el.dataset.t); const s = fitState(); s.tw = p.tw; s.ar = p.ar; NS.render({ quiet: true });
  };
  NS.acts["fit-save"] = () => {
    const s = fitState(); const v = NS.veh();
    const tire = `${s.tw}/${s.ar}R${s.dia}`;
    v.wheel = { dia: s.dia, width: s.width, offset: s.offset, tire, drop: s.drop, camber: s.camber, rcamber: s.rcamber, spacer: s.spacer, fenders: s.fenders, rfenders: s.rfenders };
    const m = v.mods.find((x) => x.system === "WHEELS" && /wheel/i.test(x.title) && x.status !== "done");
    if (m) { m.title = `Wheels: ${s.dia}x${s.width} ${sgn(s.offset)}`; m.notes = `Plan on ${tire}. ` + (NS.fitCalc(s).fixes[0] || ""); }
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
  /* Power wire: pick the gauge that keeps the voltage drop under 0.5 V at full draw over the whole loop
     (battery to trunk plus a short ground), and under the wire's heat limit. Copper resistance per AWG at 20 °C;
     copper-clad aluminum (CCA, what most budget kits are) has about 1.6× the resistance of pure copper (OFC). */
  const WIRE = { "8": { ohmPerFt: 0.0006282, limit: 50 }, "4": { ohmPerFt: 0.0002485, limit: 125 }, "1/0": { ohmPerFt: 0.0000983, limit: 250 } };
  const wireMax = (g, mat, ft) => { const w = WIRE[g]; if (!w) return 0; const k = mat === "OFC" ? 1 : 1.6; return Math.min(0.5 / (w.ohmPerFt * k * ft), w.limit / (mat === "OFC" ? 1 : 1.25)); };
  // Typical box volumes (ft³) from sub makers' ranges; the sub's own manual has the exact number.
  const BOX = { 8: [0.4, 0.7], 10: [0.9, 1.5], 12: [1.25, 2.2], 15: [2.5, 3.75] };
  function audioCalc(a) {
    const total = AUD.reduce((s, [k]) => s + (+(a[k]?.price) || 0), 0);
    const amp = +a.amp?.rms || 0, sub = +a.sub?.rms || 0;
    const current = amp / (13.8 * 0.7);                      // 70% efficiency: between class AB and class D
    const mat = a.wiring?.material || "CCA", ft = 19;          // ~17 ft battery to trunk + 2 ft ground on a compact car
    const gauge = ["8", "4", "1/0"].find((g) => wireMax(g, mat, ft) >= current) || "1/0 + big three";
    const match = !amp || !sub ? null : amp > sub * 1.25 ? ["warn", "Amp is a lot stronger than the sub. Set gain carefully or you'll cook it."] : amp < sub * 0.6 ? ["warn", "Amp is weak for this sub. It'll work, just not loud."] : ["ok", "Amp and sub are well matched."];
    const have = a.wiring?.gauge, haveMax = wireMax(have, mat, ft);
    const wireOk = !!have && haveMax >= current;
    const size = [8, 10, 12, 15].reduce((b, n) => (Math.abs(n - (+a.sub?.size || 10)) < Math.abs(b - (+a.sub?.size || 10)) ? n : b), 10);
    const vol = BOX[size][a.enclosure?.type === "ported" ? 1 : 0];
    return { total, current, gauge, match, wireOk, vol, mat, haveMax, have };
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
      <g font-family="JetBrains Mono, monospace" font-size="13" fill="#8a86a0" letter-spacing=".5">
        <path d="M40 52 L460 52 L470 250 Q470 282 440 284 L60 284 Q30 282 30 250 Z" fill="url(#carpet)" stroke="#48445a"/>
        <path d="M30 120 Q30 90 70 92 L100 92 L100 210 L70 210 Q30 210 30 180 Z" fill="#141219" stroke="#2c2838"/>
        <path d="M470 120 Q470 90 430 92 L400 92 L400 210 L430 210 Q470 210 470 180 Z" fill="#141219" stroke="#2c2838"/>
        <text x="65" y="155" text-anchor="middle">WELL</text><text x="435" y="155" text-anchor="middle">WELL</text>
        <rect x="40" y="36" width="420" height="16" rx="3" fill="#1a1724" stroke="#2c2838"/>
        <text x="250" y="47.5" text-anchor="middle" font-size="11">REAR SEATBACK · CABIN AHEAD</text>
        <text x="250" y="298" text-anchor="middle">TRUNK LID / BUMPER</text>
        <path d="M${pwrSide} 8 L${pwrSide} 52 Q${pwrSide} 58 ${pwrSide + 10} 58 L${ampX - 30} 58 L${ampX - 30} ${ampY - 8}" fill="none" stroke="#f0566e" stroke-width="2" stroke-dasharray="${a.wiring?.price ? "0" : "4 3"}"/>
        <text x="${pwrSide + 4}" y="20" fill="#f0566e">+12V ${esc(a.wiring?.gauge || r.gauge)} AWG · FUSED</text>
        <path d="M470 8 L470 52 Q470 58 460 58 L${ampX + 30} 58 L${ampX + 30} ${ampY - 8}" fill="none" stroke="#8ab4ff" stroke-width="1.5" stroke-dasharray="2 3"/>
        <text x="466" y="20" fill="#8ab4ff" text-anchor="end">RCA + REMOTE</text>
        <g transform="rotate(${ampRot} ${ampX} ${ampY})"><rect x="${ampX - 46}" y="${ampY - 16}" width="92" height="32" rx="4" fill="#1d1929" stroke="#a98cff"/>
        ${Array.from({ length: 9 }, (_, i) => `<line x1="${ampX - 38 + i * 9.5}" y1="${ampY - 10}" x2="${ampX - 38 + i * 9.5}" y2="${ampY + 10}" stroke="#3a3450"/>`).join("")}
        <text x="${ampX}" y="${ampY + 4}" text-anchor="middle" fill="#ecebf2">AMP ${a.amp?.rms || "?"}W</text></g>
        <rect x="${cx - bw / 2}" y="${by}" width="${bw}" height="${bd}" rx="5" fill="#121119" stroke="#d6d5de" stroke-opacity=".6"/>
        ${e.type === "ported" ? `<rect x="${cx + bw / 2 - 22}" y="${by + 8}" width="12" height="${bd - 16}" fill="#050407" stroke="#48445a"/>` : ""}
        ${fire === "up" ? `<circle cx="${cx - (e.type === "ported" ? 10 : 0)}" cy="${subCy}" r="${subR}" fill="#0a090e" stroke="#a98cff"/><circle cx="${cx - (e.type === "ported" ? 10 : 0)}" cy="${subCy}" r="${subR * 0.35}" fill="#1d1929" stroke="#5c5a68"/>`
          : `<rect x="${cx - subR - (e.type === "ported" ? 10 : 0)}" y="${subCy - 5}" width="${subR * 2}" height="10" rx="3" fill="#a98cff" opacity=".8"/>`}
        <path d="M${ampX} ${ampY + (ampRot ? 0 : 16)} L${cx} ${by}" stroke="#a98cff" stroke-width="1.2" stroke-opacity=".7" fill="none"/>
        <text x="${cx}" y="${by + bd + 16}" text-anchor="middle" fill="#aaa6b8" stroke="#0d0c12" stroke-width="5" paint-order="stroke">${size}" ${String(e.type || "sealed").toUpperCase()} · ${r.vol.toFixed(1)} FT³ · FIRES ${fire.toUpperCase()}</text>
      </g>
    </svg>`;
  }

  NS.views.sound = function () {
    const v = NS.veh(); const a = v.audio; const r = audioCalc(a);
    const row = ([k, l]) => {
      const x = a[k] || {};
      const extra = k === "sub" ? `<div class="field"><label for="au-${k}-size">Size</label><select class="select" id="au-${k}-size" data-ch="audio" data-k="${k}" data-f="size">${[8, 10, 12, 15].map((n) => `<option${+x.size === n ? " selected" : ""}>${n}</option>`).join("")}</select></div><div class="field"><label for="au-${k}-rms">RMS watts</label><input class="input num" type="number" id="au-${k}-rms" data-ch="audio" data-k="${k}" data-f="rms" value="${x.rms || 0}"></div>`
        : k === "amp" ? `<div class="field"><label for="au-${k}-rms">RMS watts</label><input class="input num" type="number" id="au-${k}-rms" data-ch="audio" data-k="${k}" data-f="rms" value="${x.rms || 0}"></div><div class="field"><label for="au-amppos">Mount</label><select class="select" id="au-amppos" data-ch="audio" data-k="_" data-f="ampPos">${[["floor", "Trunk floor"], ["seat", "Seatback"], ["side", "Side wall"]].map(([v2, l2]) => `<option value="${v2}"${(a.ampPos || "floor") === v2 ? " selected" : ""}>${l2}</option>`).join("")}</select></div>`
        : k === "wiring" ? `<div class="field"><label for="au-${k}-g">Gauge</label><select class="select" id="au-${k}-g" data-ch="audio" data-k="${k}" data-f="gauge">${["8", "4", "1/0"].map((g) => `<option${x.gauge === g ? " selected" : ""}>${g}</option>`).join("")}</select></div><div class="field"><label for="au-${k}-mat">Wire</label><select class="select" id="au-${k}-mat" data-ch="audio" data-k="${k}" data-f="material">${[["CCA", "CCA (aluminum)"], ["OFC", "OFC (pure copper)"]].map(([g, l]) => `<option value="${g}"${(x.material || "CCA") === g ? " selected" : ""}>${l}</option>`).join("")}</select></div>`
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
      <div class="readout"><div class="k">POWER WIRE</div><div class="v ${r.wireOk ? "ok" : "warn"}">${r.gauge}<span class="dim" style="font-size:14px"> AWG</span></div><div class="s">${r.have ? (r.wireOk ? `Your ${r.have} AWG ${r.mat} is good to ${Math.floor(r.haveMax)} A` : `Your ${r.have} AWG ${r.mat} tops out at ${Math.floor(r.haveMax)} A`) : `${r.mat} wire, battery to trunk`}</div></div>
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
