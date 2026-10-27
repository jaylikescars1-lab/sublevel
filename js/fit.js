/* Wheel fitment engine. Pure math, no page code, so it can be checked on its own.

   All distances in mm. Lateral X is measured from the hub mounting face, positive = outward.
   Heights are measured up from the hub centre. Camber "tilt" is in degrees, positive = top of the tire leans in.

   Sources for the rules used here:
   - Section width grows ~0.4 mm per 1 mm of rim width beyond the tire's measuring rim (ETRTO; Tire Rack's
     "0.2 in per 0.5 in" rule). Overall diameter barely changes with rim width.
   - A wheel's overall width is ~1 in more than its stated (bead seat) width, because of the flanges.
   - A point h above the hub moves inward h × sin(camber) when the wheel tilts.
   - Car-specific numbers (lip position, strut position, fender gap, travel, camber gain) come from the spec
     sheet or the built-in EK numbers, calibrated against owner fitment reports. */
(function () {
  const NS = (window.NS = window.NS || {});
  const IN = 25.4;
  const rad = (d) => (d * Math.PI) / 180;
  const roundHalf = (x) => Math.round(x * 2) / 2;

  /* Tire: section width on the actual rim, the rim range the tire is approved for, and its cross-section. */
  function tire(tw, ar, dia, rimIn) {
    const k = ar >= 70 ? 0.7 : ar >= 60 ? 0.75 : ar >= 50 ? 0.8 : ar >= 45 ? 0.85 : 0.9;
    const mrw = roundHalf((tw * k) / IN);                                  // measuring rim width, in
    const range = [mrw - (ar >= 50 ? 1 : 0.5), mrw + (ar >= 55 ? 1.5 : 1)]; // approved rim widths, in (approx.)
    const S = tw + 0.4 * (rimIn - mrw) * IN;                               // section width on this rim
    const SH = (tw * ar) / 100;                                            // sidewall height
    const OD = dia * IN + 2 * SH;
    const TW = 0.8 * tw;                                                   // tread width, typical
    return { tw, ar, dia, mrw, range, S, SH, OD, TW };
  }

  /* Wheel: stated width, overall width across the flanges, flange top radius. */
  function wheel(dia, widthIn) {
    const W = widthIn * IN;
    return { dia, widthIn, W, Wo: W + IN, R: (dia * IN) / 2, Rf: (dia * IN) / 2 + 17.5 };
  }

  /* Half-width of the tire+rim cross-section at radius r from the hub centre. */
  function halfWidth(t, w, r) {
    const Rtop = t.OD / 2, vb = w.R + 0.5 * t.SH, xr = w.W / 2 + 8;
    if (r <= w.Rf) return w.Wo / 2;                                         // rim flange
    if (r <= vb) return xr + (t.S / 2 - xr) * Math.sin((Math.PI / 2) * ((r - w.Rf) / Math.max(1, vb - w.Rf)));
    if (r >= Rtop) return t.TW / 2;
    const q = (r - vb) / (Rtop - vb);                                       // rounded shoulder up to the tread
    return t.TW / 2 + (t.S / 2 - t.TW / 2) * Math.sqrt(Math.max(0, 1 - q * q));
  }

  /* Car numbers with defaults. Camber gain is per inch of drop or compression. */
  const GAIN = { strut: 0.5, double_wishbone: 0.9, multilink: 0.7 };
  function car(base) {
    const susp = base.suspension || "strut";
    return {
      stock: base.stock, lipOut: base.lipOut, innerLimit: base.innerLimit, stockGap: base.stockGap,
      suspension: susp, gain: base.camberGain ?? GAIN[susp] ?? 0.6, stockCamber: base.stockCamber ?? -0.5,
      bump: base.bump ?? 75, flange: base.flange ?? 10,
    };
  }

  /* Everything about one setup. s: { dia, width, offset, tw, ar, drop (in), camber (deg, null = auto), spacer (mm), fenders } */
  function calc(base, s) {
    const C = car(base);
    const t = tire(s.tw, s.ar, s.dia, s.width), w = wheel(s.dia, s.width);
    const st = C.stock, ts = tire(st.tw, st.ar, st.dia, st.width), ws = wheel(st.dia, st.width);
    const drop = (s.drop || 0) * IN;
    const off = s.offset - (s.spacer || 0);                                 // spacers push the wheel out
    const xc = -off;                                                        // wheel centreline
    const autoCamber = C.stockCamber - C.gain * (s.drop || 0);
    const camber = s.camber == null || s.camber === "" ? autoCamber : +s.camber;
    const tilt0 = -camber;                                                  // + = top in
    const fend = s.fenders || "stock";
    const lipX = C.lipOut + (fend === "pulled" ? 12 : 0);                   // outer skin of the lip
    const lipEff = lipX - (fend === "stock" ? C.flange : 0);                // the inward fold is what a tire hits

    // Ride height: hub-to-lip distance is set by the springs; the tire only changes how much of it it fills.
    const H0 = ts.OD / 2 + C.stockGap - drop;                               // lip height above hub, at rest
    const gap = H0 - t.OD / 2;                                              // tread to lip, at rest
    const travel = Math.max(25, C.bump - 0.5 * drop);                       // bump travel left after lowering

    // Fender poke: the outermost point of the upper half, at static camber, past the lip. This is what "flush" means
    // to people (negative camber tucks the top in) and what tire-coverage rules look at from above.
    const top = (tt, ww, x0, tl) => { let m = -Infinity; for (let r = ww.R; r <= tt.OD / 2; r += 2) m = Math.max(m, x0 + halfWidth(tt, ww, r) * Math.cos(rad(tl)) - r * Math.sin(rad(tl))); return m; };
    const poke = top(t, w, xc, tilt0) - lipX;
    const pokeStock = top(ts, ws, -st.offset, -C.stockCamber) - C.lipOut;

    // Rub check: compress to the bump stop. At each step the lip (an arc around the hub) drops by c·cos(a)
    // and camber grows. Any part of the tire outboard of the lip's fold at the lip's height is a rub.
    let margin = Infinity, rubAt = null, worst = null;
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const c = (travel * i) / steps;
      const tilt = tilt0 + C.gain * (c / IN);
      const sn = Math.sin(rad(tilt)), cs = Math.cos(rad(tilt));
      let stepMin = Infinity, stepPt = null;
      for (let a = 0; a <= 60; a += 5) {
        const Hlip = H0 - c * Math.cos(rad(a));                            // lip's distance from hub at this angle
        for (let r = Math.max(w.R, Hlip); r <= t.OD / 2; r += 2) {
          const Y = r * Math.cos(rad(a));
          const X = xc + halfWidth(t, w, r) * cs - Y * sn;
          const m = lipEff - X;
          if (m < stepMin) { stepMin = m; stepPt = { c, a, r, X, Y }; }
        }
      }
      if (stepMin < margin) { margin = stepMin; worst = stepPt; }
      if (stepMin < 0 && rubAt == null) rubAt = c;
    }
    if (margin === Infinity) margin = 99;                                  // the lip never reaches the tire

    // Inner clearance: widest inner point of the upper half. On a strut car the strut tilts with the wheel.
    const tiltIn = C.suspension === "strut" ? 0 : Math.max(0, tilt0);
    let inner = 0;
    for (let r = w.R; r <= t.OD / 2; r += 2) inner = Math.max(inner, off + halfWidth(t, w, r) * Math.cos(rad(tiltIn)) + r * Math.sin(rad(tiltIn)));
    const innerClear = C.innerLimit - inner;
    let innerStock = 0;
    for (let r = ws.R; r <= ts.OD / 2; r += 2) innerStock = Math.max(innerStock, st.offset + halfWidth(ts, ws, r));

    // Inner fender liner: a tucked tire keeps rising past the lip until it meets the liner (~40 mm up).
    const linerHit = travel > gap + 40;

    // Offset window: inner clearance and lip margin both move 1:1 with offset.
    const win = { min: Math.ceil(s.offset - (margin - 3)), max: Math.floor(s.offset + (innerClear - 5)) };
    if (margin === 99) win.min = -99;

    const speedo = (t.OD / ts.OD - 1) * 100;
    const ride = (t.OD - ts.OD) / 2 - drop;                                  // body height change, mm
    const track = 2 * (st.offset - off);                                    // track width change, mm
    const rim = s.width;
    const fit = rim > t.range[1] ? "stretched" : rim < t.range[0] ? "pinched" : "in range";
    const lock = inner - innerStock > 10 || speedo > 3;

    // Risk: each problem on its own scale, combined.
    // A rub only in the last of the travel (big bumps, a full car) is a nuisance; one at rest is a grinder.
    const late = rubAt == null ? 1 : rubAt / travel;
    const r1 = margin < 0 ? Math.min(100, (rubAt === 0 ? 85 : late < 0.4 ? 70 : late < 0.75 ? 55 : 35) + -margin * 3) : margin < 5 ? (5 - margin) * 6 : 0;
    const r2 = innerClear < 0 ? 100 : innerClear < 5 ? 75 - innerClear * 8 : innerClear < 10 ? (10 - innerClear) * 6 : 0;
    const r3 = linerHit ? 15 : 0;
    const r4 = fit === "stretched" ? Math.min(35, 10 + (rim - t.range[1]) * 20) : fit === "pinched" ? 10 : 0;
    const r5 = poke > 5 ? Math.min(25, (poke - 5) * 2) : 0;
    const risk = Math.round(100 * (1 - [r1, r2, r3, r4, r5].reduce((p, x) => p * (1 - Math.min(100, x) / 100), 1)));

    return {
      t, w, ts, C, off, camber, autoCamber, tilt0, lipX, lipEff, gap, travel, poke, pokeStock, margin, rubAt, worst,
      inner, innerClear, innerStock, linerHit, win, speedo, ride, track, fit, lock, risk, H0,
      od: t.OD, stockOD: ts.OD, S: t.S, mrw: t.mrw, range: t.range,
    };
  }

  /* Tape measurements -> car numbers, at ride height with the wheels on the car now.
     m: { dia, width, offset, tw, ar, drop (in), camber (deg), suspension, stock, lip, inner, gap } where
     lip = how far the fender lip sits outboard of the rim edge at the top (mm, negative if the rim sticks out),
     inner = inside of the tire to the nearest suspension part, gap = top of the tread straight up to the lip. */
  function fromMeasure(m) {
    const t = tire(m.tw, m.ar, m.dia, m.width), w = wheel(m.dia, m.width), st = m.stock, ts = tire(st.tw, st.ar, st.dia, st.width);
    const tl = -m.camber, tIn = m.suspension === "strut" ? 0 : Math.max(0, tl), out = {};
    if (m.lip != null) out.lipOut = Math.round(-m.offset + (w.Wo / 2) * Math.cos(rad(tl)) - w.Rf * Math.sin(rad(tl)) + m.lip);
    if (m.inner != null) {
      let i = 0; for (let r = w.R; r <= t.OD / 2; r += 2) i = Math.max(i, m.offset + halfWidth(t, w, r) * Math.cos(rad(tIn)) + r * Math.sin(rad(tIn)));
      out.innerLimit = Math.round(i + m.inner);
    }
    if (m.gap != null) out.stockGap = Math.round(m.gap + t.OD / 2 - ts.OD / 2 + (m.drop || 0) * IN);
    return out;
  }

  NS.fit = { tire, wheel, halfWidth, calc, car, fromMeasure, GAIN };
})();
