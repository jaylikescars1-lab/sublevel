/* Drawn car: a coupe side profile at 0.2 px/mm, wheels and ride height follow the real numbers. */
(function () {
  const NS = window.NS;
  const SCALE = 0.2;
  const GROUND = 330;
  const FX = 245, RX = 769;           // axle x (2620 mm wheelbase)
  const STOCK_OD = 596;                // 185/65R14

  NS.tireOD = (dia, tw, ar) => dia * 25.4 + 2 * tw * (ar / 100);
  NS.parseTire = (s) => { const m = String(s || "").match(/(\d{3})\s*\/\s*(\d{2})\s*R?\s*(\d{2})/i); return m ? { tw: +m[1], ar: +m[2], dia: +m[3] } : null; };

  /* Body styles, drawn in the stock frame with the car facing left. ARCHES is filled in per style. */
  const BODIES = {
    coupe: { archR: 70,
      outline: "M78 282 C70 270 67 252 72 234 C75 224 86 218 104 215 L320 198 C350 195 372 192 388 188 L498 116 C540 100 630 96 688 106 C740 118 790 150 832 178 C860 182 910 183 938 185 C954 186 964 192 966 204 L968 252 C968 268 964 278 956 284 ARCHES L92 290 C86 288 80 286 78 282 Z",
      top: "M104 215 L320 198 C350 195 372 192 388 188 L498 116 C540 100 630 96 688 106 C740 118 790 150 832 178 C860 182 910 183 938 185 C954 186 964 192 966 204",
      glassA: "M418 186 L503 128 C540 114 600 110 650 114 L652 183 Z", glassB: "M666 116 C716 124 760 150 798 180 L668 184 Z", pillar: "M652 114 L666 116 L668 184 L652 183 Z",
      doors: "M398 190 L404 288 M664 186 L668 290", crease: "M96 242 C300 236 600 232 960 226", handle: [610, 206],
      mirror: "M418 186 L436 172 L462 172 L462 192 L424 194 Z", lamp: "M76 232 L128 222 L132 234 L80 244 Z", lampLine: "M80 236 L126 228", dots: [[96, 234], [114, 230]],
      tail: "M944 192 L966 204 L967 230 L942 226 Z", tailLine: "M946 198 L964 207" },
    sedan: { archR: 70,
      outline: "M78 282 C70 270 67 252 72 234 C75 224 86 218 104 215 L330 196 C352 194 372 191 386 187 L492 118 C530 104 610 98 690 102 C740 106 782 128 822 162 C838 170 852 172 882 173 C922 174 944 176 955 181 C963 186 966 194 966 204 L968 252 C968 268 964 278 956 284 ARCHES L92 290 C86 288 80 286 78 282 Z",
      top: "M104 215 L330 196 C352 194 372 191 386 187 L492 118 C530 104 610 98 690 102 C740 106 782 128 822 162 C838 170 852 172 882 173 C922 174 944 176 955 181 C963 186 966 194 966 204",
      glassA: "M414 186 L497 128 C534 115 590 110 638 110 L640 183 Z", glassB: "M654 110 C705 112 748 130 786 160 L788 182 L656 184 Z", pillar: "M638 110 L654 110 L656 184 L640 183 Z",
      doors: "M398 190 L404 288 M647 184 L650 290 M806 172 L800 262", crease: "M96 242 C300 236 600 232 960 226", handle: [596, 206],
      mirror: "M414 186 L432 172 L458 172 L458 192 L420 194 Z", lamp: "M76 232 L128 222 L132 234 L80 244 Z", lampLine: "M80 236 L126 228", dots: [[96, 234], [114, 230]],
      tail: "M944 184 L966 196 L967 226 L942 222 Z", tailLine: "M946 190 L964 199" },
    hatch: { archR: 70,
      outline: "M78 282 C70 270 67 252 72 234 C75 224 86 218 104 215 L330 196 C352 194 372 191 386 187 L492 118 C530 104 610 98 700 99 C780 100 856 104 896 112 C918 118 930 132 938 152 L956 186 C962 196 966 206 966 216 L968 252 C968 268 964 278 956 284 ARCHES L92 290 C86 288 80 286 78 282 Z",
      top: "M104 215 L330 196 C352 194 372 191 386 187 L492 118 C530 104 610 98 700 99 C780 100 856 104 896 112 C918 118 930 132 938 152 L956 186 C962 196 966 206 966 216",
      glassA: "M414 186 L497 128 C534 115 590 110 638 110 L640 183 Z", glassB: "M654 110 C740 106 828 108 870 118 C886 124 896 146 902 176 L656 184 Z", pillar: "M638 110 L654 110 L656 184 L640 183 Z",
      doors: "M398 190 L404 288 M647 184 L650 290", crease: "M96 242 C300 236 600 232 960 226", handle: [596, 206],
      mirror: "M414 186 L432 172 L458 172 L458 192 L420 194 Z", lamp: "M76 232 L128 222 L132 234 L80 244 Z", lampLine: "M80 236 L126 228", dots: [[96, 234], [114, 230]],
      tail: "M928 172 L952 182 L958 214 L932 210 Z", tailLine: "M930 178 L950 186" },
    suv: { archR: 84,
      outline: "M74 290 C66 276 64 250 68 226 C72 210 84 202 104 198 L300 184 C330 182 350 178 370 172 L470 96 C500 82 560 78 700 78 C800 78 880 82 912 90 C930 96 942 112 950 140 L960 186 C966 200 968 212 968 226 L968 262 C968 276 962 286 952 290 ARCHES L92 294 C84 294 78 292 74 290 Z",
      top: "M104 198 L300 184 C330 182 350 178 370 172 L470 96 C500 82 560 78 700 78 C800 78 880 82 912 90 C930 96 942 112 950 140 L960 186 C966 200 968 212 968 226",
      glassA: "M398 172 L476 108 C506 96 570 92 620 92 L622 168 Z", glassB: "M638 92 C760 90 858 92 898 98 C912 104 920 128 924 166 L640 170 Z", pillar: "M620 92 L638 92 L640 170 L622 168 Z",
      doors: "M382 176 L388 290 M630 172 L632 292 M826 170 L820 262", crease: "M92 236 C300 230 600 226 962 220", handle: [586, 196],
      mirror: "M398 172 L416 158 L442 158 L442 178 L404 180 Z", lamp: "M70 214 L124 202 L128 216 L74 226 Z", lampLine: "M74 218 L122 208", dots: [[90, 216], [108, 212]],
      tail: "M944 146 L962 158 L966 198 L944 194 Z", tailLine: "M946 152 L962 162" },
  };
  NS.bodyStyles = [["coupe", "Coupe"], ["sedan", "Sedan"], ["hatch", "Hatchback"], ["wagon", "Wagon"], ["suv", "SUV"], ["truck", "Truck"]];
  const bodyOf = (k) => BODIES[{ wagon: "hatch", truck: "suv", van: "suv", convertible: "coupe" }[k] || k] || BODIES.coupe;

  function bodyPath(kind) {
    const B = bodyOf(kind); const R = B.archR;
    const sill = 292;
    const axleY = GROUND - (STOCK_OD / 2) * SCALE; // 270.4
    const half = Math.sqrt(R * R - (sill - axleY) ** 2);
    const fa = [FX + half, FX - half], ra = [RX + half, RX - half];
    const arches = `L${ra[0].toFixed(1)} ${sill} A${R} ${R} 0 1 0 ${ra[1].toFixed(1)} ${sill} L${fa[0].toFixed(1)} ${sill} A${R} ${R} 0 1 0 ${fa[1].toFixed(1)} ${sill}`;
    return { B, R, sill, axleY, half, d: B.outline.replace("ARCHES", arches) };
  }

  /* Hex shading helper for colored rims and paint. */
  const shade = (hex, amt) => {
    const h = String(hex || "#888").replace("#", ""); const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
    const f = (c) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
    return "#" + [n >> 16, (n >> 8) & 255, n & 255].map(f).map((c) => c.toString(16).padStart(2, "0")).join("");
  };
  NS.shade = shade;
  NS.wheelStyles = [["6", "6-spoke"], ["5", "5-spoke"], ["10", "10-spoke"], ["mesh", "Mesh"], ["dish", "Deep dish"], ["steelie", "Steelie"]];

  /* Wheel face: spokes by style. Used on the car and on the style board. */
  function face(cx, cy, rr, style, grad, accent) {
    const line = (a, r1, r2, w) => `<line x1="${(cx + Math.cos(a) * r1).toFixed(1)}" y1="${(cy + Math.sin(a) * r1).toFixed(1)}" x2="${(cx + Math.cos(a) * r2).toFixed(1)}" y2="${(cy + Math.sin(a) * r2).toFixed(1)}" stroke="${grad}" stroke-width="${w.toFixed(2)}" stroke-linecap="round"/>`;
    let sp = "";
    if (style === "mesh") {
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; sp += line(a, rr * 0.24, rr * 0.88, rr * 0.05); sp += line(a + 0.35, rr * 0.24, rr * 0.88, rr * 0.035); }
      sp += `<circle cx="${cx}" cy="${cy}" r="${(rr * 0.56).toFixed(1)}" fill="none" stroke="${grad}" stroke-width="${(rr * 0.04).toFixed(2)}" opacity=".7"/>`;
    } else if (style === "10") {
      for (let i = 0; i < 10; i++) sp += line((i / 10) * Math.PI * 2 + 0.2, rr * 0.24, rr * 0.9, rr * 0.08);
    } else if (style === "dish") {
      sp += `<circle cx="${cx}" cy="${cy}" r="${(rr * 0.8).toFixed(1)}" fill="none" stroke="${grad}" stroke-width="${(rr * 0.24).toFixed(2)}" opacity=".9"/>`;
      for (let i = 0; i < 5; i++) sp += line((i / 5) * Math.PI * 2 + 0.3, rr * 0.22, rr * 0.66, rr * 0.11);
    } else if (style === "steelie") {
      sp += `<circle cx="${cx}" cy="${cy}" r="${(rr * 0.86).toFixed(1)}" fill="${grad}" opacity=".85"/>`;
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; sp += `<ellipse cx="${(cx + Math.cos(a) * rr * 0.6).toFixed(1)}" cy="${(cy + Math.sin(a) * rr * 0.6).toFixed(1)}" rx="${(rr * 0.11).toFixed(1)}" ry="${(rr * 0.07).toFixed(1)}" transform="rotate(${(a * 180) / Math.PI} ${(cx + Math.cos(a) * rr * 0.6).toFixed(1)} ${(cy + Math.sin(a) * rr * 0.6).toFixed(1)})" fill="#0b0a0f"/>`; }
    } else {
      const n = style === "5" ? 5 : 6;
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + 0.3; sp += line(a, rr * 0.24, rr * 0.9, rr * (n === 5 ? 0.22 : 0.17)); if (n === 6) sp += line(a, rr * 0.3, rr * 0.86, rr * 0.05).replace(grad, "rgba(0,0,0,.35)"); }
    }
    return sp + `<circle cx="${cx}" cy="${cy}" r="${(rr * 0.2).toFixed(1)}" fill="#1a1922" stroke="${grad}" stroke-width="${Math.max(1, rr * 0.03).toFixed(2)}"/><circle cx="${cx}" cy="${cy}" r="${(rr * 0.07).toFixed(1)}" fill="${accent || "#a98cff"}" opacity=".85"/>`;
  }

  function wheel(cx, cy, o, id) {
    const r = (o.od / 2) * SCALE;
    const rr = ((o.dia * 25.4) / 2) * SCALE;
    return `<g>
      <circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="#0a0a0d" stroke="#25232c" stroke-width="1.2"/>
      <circle cx="${cx}" cy="${cy}" r="${(r - 3).toFixed(1)}" fill="none" stroke="#141319" stroke-width="2"/>
      <circle cx="${cx}" cy="${cy}" r="${rr.toFixed(1)}" fill="#0f0e14" stroke="url(#${id}-rim)" stroke-width="2.2"/>
      <circle cx="${cx}" cy="${cy}" r="${(rr * 0.92).toFixed(1)}" fill="none" stroke="${o.rimColor || "#6c6a78"}" stroke-width=".8" opacity=".6"/>
      ${face(cx, cy, rr, o.style || "6", `url(#${id}-rim)`, o.accent)}
    </g>`;
  }

  /* A single wheel and tire, face on. */
  NS.wheelFaceSVG = function ({ style = "6", color = "#d6d5de", dia = 15, label = "" } = {}) {
    const id = "wf" + Math.random().toString(36).slice(2, 7);
    const rr = 58 + (dia - 14) * 4;
    return `<svg viewBox="0 0 200 200" role="img" aria-label="${NS.esc(label || "Wheel")}"><defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(color, 0.45)}"/><stop offset=".5" stop-color="${shade(color, -0.35)}"/><stop offset="1" stop-color="${shade(color, 0.2)}"/></linearGradient>
      <radialGradient id="${id}b" cx=".5" cy=".45" r=".6"><stop offset="0" stop-color="#1b1726"/><stop offset="1" stop-color="#07060b"/></radialGradient></defs>
      <rect width="200" height="200" fill="url(#${id}b)"/>
      <circle cx="100" cy="100" r="92" fill="#0b0b0e" stroke="#26242d" stroke-width="2"/>
      <circle cx="100" cy="100" r="88" fill="none" stroke="#16151b" stroke-width="5" stroke-dasharray="3 5"/>
      <circle cx="100" cy="100" r="${rr}" fill="#0e0d13" stroke="url(#${id})" stroke-width="4"/>
      <circle cx="100" cy="100" r="${rr - 5}" fill="none" stroke="${shade(color, -0.5)}" stroke-width="1"/>
      ${face(100, 100, rr - 2, style, `url(#${id})`)}
      <path d="M40 60 A70 70 0 0 1 120 32" stroke="#fff" stroke-opacity=".08" stroke-width="6" fill="none" stroke-linecap="round"/>
    </svg>`;
  };

  /* o: {dia, od, drop(in), paint, rimColor, spokes, id, reflection, glow, labels} */
  NS.carSVG = function (o = {}) {
    const id = o.id || "car" + Math.random().toString(36).slice(2, 6);
    const dia = o.dia || 14;
    const od = o.od || STOCK_OD;
    const drop = (o.drop || 0) * 25.4;
    const b = bodyPath(o.body || (NS.veh && NS.veh() && NS.veh().specs && NS.veh().specs.body));
    const bodyDy = (-(od - STOCK_OD) / 2 + drop) * SCALE;
    const wy = GROUND - (od / 2) * SCALE;
    const paint = o.paint || "#15141a";
    const w = { od, dia, style: o.wheelStyle, rimColor: o.rimColor, accent: o.accent };
    const smoked = o.lights === "smoked";
    const lip = o.lip ? `<path d="M80 286 L84 294 L190 296 L196 290 Z" fill="#08080b"/><path d="M84 294 L190 296" stroke="#fff" stroke-opacity=".12" stroke-width=".8"/>` : "";
    const B = b.B;
    const car = `
      <g transform="translate(0 ${bodyDy.toFixed(2)})">
        <path d="${b.d}" fill="url(#${id}-paint)"/>
        <path d="${b.d}" fill="url(#${id}-shade)"/>
        <path d="${B.top}" fill="none" stroke="url(#${id}-chrome)" stroke-width="1.4" opacity=".9"/>
        <path d="${B.glassA}" fill="url(#${id}-glass)"/>
        <path d="${B.glassB}" fill="url(#${id}-glass)"/>
        <path d="${B.glassA}" fill="none" stroke="#3a3747" stroke-width="1"/>
        <path d="${B.pillar}" fill="${paint}"/>
        <path d="${B.doors}" stroke="#000" stroke-opacity=".55" stroke-width="1.2" fill="none"/>
        <path d="${B.doors}" stroke="#fff" stroke-opacity=".06" stroke-width="1" fill="none" transform="translate(1 0)"/>
        <path d="${B.crease}" stroke="#fff" stroke-opacity=".10" stroke-width="1.2" fill="none"/>
        <path d="${B.crease}" stroke="#000" stroke-opacity=".5" stroke-width="1" fill="none" transform="translate(0 1.5)"/>
        <rect x="${B.handle[0]}" y="${B.handle[1]}" width="26" height="4" rx="2" fill="#2b2935"/>
        <path d="${B.mirror}" fill="${paint}" stroke="#2c2a36" stroke-width=".8"/>
        <path d="${B.lamp}" fill="url(#${id}-lamp)"/>
        <path d="${B.lampLine}" stroke="#fff" stroke-opacity="${smoked ? ".25" : ".5"}" stroke-width=".8"/>
        ${smoked ? B.dots.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="4.5" fill="#cfd6ff" opacity="${i ? ".45" : ".55"}"/>`).join("") : ""}
        <path d="${B.tail}" fill="${smoked ? "#2a0b12" : "#5e1424"}"/>
        ${lip}
        <path d="${B.tailLine}" stroke="#ff6b84" stroke-opacity=".45" stroke-width="1"/>
        <path d="M76 268 L150 272" stroke="#000" stroke-opacity=".6" stroke-width="2"/>
      </g>`;
    const wheels = wheel(FX, wy, w, id) + wheel(RX, wy, w, id);
    const well = (x) => `<path d="M${(x + b.half).toFixed(1)} ${b.sill} A${b.R} ${b.R} 0 1 0 ${(x - b.half).toFixed(1)} ${b.sill} Z" fill="#050407"/>`;
    const wells = `<g transform="translate(0 ${bodyDy.toFixed(2)})">${well(FX)}${well(RX)}</g>`;
    const glow = o.glow === false ? "" : `<ellipse cx="507" cy="${GROUND + 2}" rx="470" ry="26" fill="url(#${id}-pool)"/>`;
    const refl = o.reflection === false ? "" : `<g transform="translate(0 ${GROUND * 2 + 2}) scale(1 -1)" opacity=".16" mask="url(#${id}-fade)">${wells}${wheels}${car}</g>`;
    const labels = o.labels ? `<g font-family="JetBrains Mono, monospace" font-size="11" fill="#716c84" letter-spacing="1">
        <line x1="${FX}" y1="${GROUND + 24}" x2="${RX}" y2="${GROUND + 24}" stroke="#48445a" stroke-dasharray="2 4"/>
        <text x="${(FX + RX) / 2}" y="${GROUND + 40}" text-anchor="middle">WB 2620 MM</text>
        <text x="${FX}" y="${GROUND + 40}" text-anchor="middle">F</text><text x="${RX}" y="${GROUND + 40}" text-anchor="middle">R</text></g>` : "";
    const vb = o.view === "front" ? "40 160 360 180" : o.crop ? "0 70 1040 300" : "0 40 1040 400";
    return `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${NS.esc(o.alt || "Side profile of the car")}" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="${id}-paint" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${paint}" stop-opacity="1"/><stop offset=".55" stop-color="${paint}"/><stop offset="1" stop-color="#050507"/></linearGradient>
        <linearGradient id="${id}-shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".10"/><stop offset=".35" stop-color="#fff" stop-opacity=".02"/><stop offset=".62" stop-color="#a98cff" stop-opacity=".05"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></linearGradient>
        <linearGradient id="${id}-chrome" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset=".3" stop-color="#e9e8ef" stop-opacity=".75"/><stop offset=".55" stop-color="#a98cff" stop-opacity=".6"/><stop offset="1" stop-color="#fff" stop-opacity=".15"/></linearGradient>
        <linearGradient id="${id}-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a2340"/><stop offset=".45" stop-color="#0c0b12"/><stop offset=".5" stop-color="#1d1830"/><stop offset="1" stop-color="#07060b"/></linearGradient>
        <linearGradient id="${id}-lamp" x1="0" y1="0" x2="1" y2="0">${smoked ? '<stop offset="0" stop-color="#4a4858"/><stop offset=".6" stop-color="#1a1920"/><stop offset="1" stop-color="#0a0a0e"/>' : '<stop offset="0" stop-color="#e8e6f2"/><stop offset=".6" stop-color="#8f8ca0"/><stop offset="1" stop-color="#2a2833"/>'}</linearGradient>
        <linearGradient id="${id}-rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${o.rimColor ? shade(o.rimColor, 0.45) : "#f2f2f6"}"/><stop offset=".5" stop-color="${o.rimColor ? shade(o.rimColor, -0.35) : "#77758a"}"/><stop offset="1" stop-color="${o.rimColor ? shade(o.rimColor, 0.2) : "#d6d5de"}"/></linearGradient>
        <radialGradient id="${id}-pool" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#6a3df0" stop-opacity=".38"/><stop offset=".6" stop-color="#6a3df0" stop-opacity=".08"/><stop offset="1" stop-color="#6a3df0" stop-opacity="0"/></radialGradient>
        <linearGradient id="${id}-fadeg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="1"/></linearGradient>
        <mask id="${id}-fade"><rect x="0" y="0" width="1040" height="400" fill="url(#${id}-fadeg)"/></mask>
      </defs>
      ${o.scene ? NS.sceneSVG(o.scene, id) : ""}
      ${glow}
      <line x1="20" y1="${GROUND}" x2="1020" y2="${GROUND}" stroke="#fff" stroke-opacity=".06"/>
      ${refl}
      <ellipse cx="507" cy="${GROUND}" rx="430" ry="7" fill="#000" opacity=".8"/>
      ${wells}${wheels}${car}${labels}
    </svg>`;
  };

  /* Backdrops behind the car. Unlocked by rank. */
  NS.scenes = [
    { id: "studio", n: "Studio", lvl: 1, d: "Black void, one light." },
    { id: "b2", n: "Level B2", lvl: 2, d: "Underground parking, 1am." },
    { id: "wangan", n: "Wangan", lvl: 4, d: "Elevated highway, city at night." },
    { id: "touge", n: "Touge", lvl: 6, d: "Mountain pass, fog, moon." },
    { id: "rooftop", n: "Rooftop", lvl: 8, d: "Top deck at dawn." },
  ];
  NS.sceneSVG = function (name, id) {
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    if (name === "b2") {
      let s = `<defs><linearGradient id="${id}-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#121019"/><stop offset="1" stop-color="#191623"/></linearGradient><filter id="${id}-bl" x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="6"/></filter></defs>
        <rect x="0" y="40" width="1040" height="290" fill="url(#${id}-wall)"/>
        <rect x="0" y="40" width="1040" height="34" fill="#0a090e"/>
        <rect x="0" y="236" width="1040" height="9" fill="#6a3df0" opacity=".28"/>
        <rect x="0" y="330" width="1040" height="110" fill="#0b0a0e"/>`;
      [140, 420, 700, 960].forEach((x) => { s += `<rect x="${x - 56}" y="62" width="112" height="5" rx="2" fill="#e9e4ff" filter="url(#${id}-bl)" opacity=".75"/><rect x="${x - 50}" y="62" width="100" height="3" rx="1.5" fill="#f4f2ff"/>`; });
      [{ x: 16, w: 46 }, { x: 540, w: 40 }, { x: 990, w: 46 }].forEach((p, i) => { s += `<rect x="${p.x}" y="74" width="${p.w}" height="256" fill="#1c1a25"/><rect x="${p.x}" y="74" width="5" height="256" fill="#fff" opacity=".05"/>` + (i === 0 ? `<rect x="${p.x + 6}" y="140" width="34" height="24" rx="2" fill="#e9e6f4"/><text x="${p.x + 23}" y="157" font-family="Michroma, Arial Black, sans-serif" font-size="12" text-anchor="middle" fill="#0b0a10">B2</text><rect x="${p.x}" y="296" width="${p.w}" height="34" fill="#e9b64e" opacity=".55"/><path d="M${p.x} 296 l12 0 l-12 12z M${p.x + 22} 296 l12 0 l-34 34 l0 -12z" fill="#0b0a10" opacity=".7"/>` : ""); });
      for (let x = -40; x < 1100; x += 150) s += `<path d="M${x} 330 L${x - 60} 440" stroke="#e9e6f4" stroke-opacity=".1" stroke-width="3"/>`;
      return s;
    }
    if (name === "wangan") {
      let s = `<defs><linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05040a"/><stop offset="1" stop-color="#1a1035"/></linearGradient><linearGradient id="${id}-streak" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff5a7a" stop-opacity="0"/><stop offset="1" stop-color="#ff5a7a" stop-opacity=".8"/></linearGradient><linearGradient id="${id}-streak2" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#eae6ff" stop-opacity="0"/><stop offset="1" stop-color="#eae6ff" stop-opacity=".7"/></linearGradient></defs>
        <rect x="0" y="40" width="1040" height="400" fill="url(#${id}-sky)"/>`;
      let x = 0; while (x < 1040) { const w = 26 + rnd() * 50, h = 40 + rnd() * 120; s += `<rect x="${x.toFixed(0)}" y="${(290 - h).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="#0d0b16"/>`; for (let k = 0; k < h / 14; k++) if (rnd() > 0.55) s += `<rect x="${(x + 4 + rnd() * (w - 8)).toFixed(0)}" y="${(296 - h + k * 14).toFixed(0)}" width="3" height="3" fill="${rnd() > 0.7 ? "#e9b64e" : "#a98cff"}" opacity=".55"/>`; x += w + 4; }
      s += `<rect x="0" y="290" width="1040" height="20" fill="#14121b"/><rect x="0" y="290" width="1040" height="1.5" fill="#d6d5de" opacity=".35"/>`;
      for (let p = 60; p < 1040; p += 240) s += `<rect x="${p}" y="150" width="3" height="140" fill="#1c1a24"/><path d="M${p + 1} 150 l26 -6" stroke="#1c1a24" stroke-width="3"/><circle cx="${p + 27}" cy="146" r="16" fill="#e9b64e" opacity=".14"/><circle cx="${p + 27}" cy="146" r="3" fill="#ffd27a"/>`;
      s += `<rect x="0" y="298" width="520" height="2" fill="url(#${id}-streak)"/><rect x="420" y="303" width="620" height="2" fill="url(#${id}-streak2)"/><rect x="0" y="330" width="1040" height="110" fill="#09080c"/>`;
      return s;
    }
    if (name === "touge") {
      return `<defs><linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#06050b"/><stop offset="1" stop-color="#1b1430"/></linearGradient><linearGradient id="${id}-fog" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfc8ff" stop-opacity="0"/><stop offset="1" stop-color="#cfc8ff" stop-opacity=".12"/></linearGradient></defs>
        <rect x="0" y="40" width="1040" height="400" fill="url(#${id}-sky)"/>
        <circle cx="850" cy="100" r="40" fill="#eae6ff" opacity=".08"/><circle cx="850" cy="100" r="20" fill="#eae6ff" opacity=".85"/>
        <path d="M0 230 L120 160 L210 200 L330 120 L470 210 L560 170 L700 230 L820 150 L940 210 L1040 180 L1040 330 L0 330Z" fill="#100d1a"/>
        <path d="M0 270 L160 220 L300 260 L420 215 L600 270 L760 225 L900 265 L1040 235 L1040 330 L0 330Z" fill="#0b0912"/>
        <rect x="0" y="230" width="1040" height="100" fill="url(#${id}-fog)"/>
        <path d="M0 304 L1040 296" stroke="#d6d5de" stroke-opacity=".3" stroke-width="2"/>${Array.from({ length: 14 }, (_, i) => `<rect x="${i * 80 + 10}" y="${303 - i * 0.6}" width="3" height="16" fill="#2a2734"/>`).join("")}
        <rect x="0" y="330" width="1040" height="110" fill="#08070b"/><path d="M0 385 L1040 385" stroke="#e9e6f4" stroke-opacity=".12" stroke-width="3" stroke-dasharray="40 30"/>`;
    }
    if (name === "rooftop") {
      let s = `<defs><linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#140c26"/><stop offset=".55" stop-color="#4a2a8a"/><stop offset=".85" stop-color="#c76a8a"/><stop offset="1" stop-color="#f0a46e"/></linearGradient></defs>
        <rect x="0" y="40" width="1040" height="290" fill="url(#${id}-sky)"/>`;
      let x = 0; while (x < 1040) { const w = 30 + rnd() * 60, h = 30 + rnd() * 90; s += `<rect x="${x.toFixed(0)}" y="${(312 - h).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="#1a1028" opacity=".9"/>`; x += w + 6; }
      s += `<rect x="0" y="306" width="1040" height="24" fill="#0e0b15"/><rect x="0" y="306" width="1040" height="1.5" fill="#f0a46e" opacity=".5"/><rect x="0" y="330" width="1040" height="110" fill="#0a090d"/>`;
      for (let k = 0; k < 7; k++) s += `<path d="M${k * 170 + 40} 330 L${k * 170 + 10} 440" stroke="#f0d36e" stroke-opacity=".22" stroke-width="4"/>`;
      return s;
    }
    return "";
  };

  /* Small silhouette for listing cards */
  NS.silSVG = function (body) {
    const b = bodyPath(body);
    return `<svg class="sil" viewBox="60 90 920 230" aria-hidden="true"><path d="${b.d}" fill="none" stroke="rgba(214,206,240,.35)" stroke-width="2"/><circle cx="${FX}" cy="${b.axleY}" r="58" fill="none" stroke="rgba(214,206,240,.25)" stroke-width="2"/><circle cx="${RX}" cy="${b.axleY}" r="58" fill="none" stroke="rgba(214,206,240,.25)" stroke-width="2"/></svg>`;
  };
})();
