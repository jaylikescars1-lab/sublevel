/* Any car: one-line setup, AI fills in specs / fitment / service / roadmap. Spec sheet for people who want the numbers. */
(function () {
  const NS = window.NS, D = window.NS_DATA;
  const { esc, money, num, icon, clamp } = NS;
  const GOALS = [["daily", "Daily"], ["street", "Street"], ["track", "Track"], ["show", "Show"], ["restore", "Restore"]];
  const GOAL_TXT = { daily: "daily driver: reliable, comfortable, cheap to run", street: "street build: handling, stance and looks", track: "track car: brakes, cooling, safety gear, suspension", show: "show car: paint, wheels, stance, interior", restore: "restoration: factory-correct parts" };
  NS.aiReady = () => !!NS.sample;

  /* ---------- structured output schema (strict: every object closed, every key required) ---------- */
  const obj = (props) => ({ type: "object", properties: props, required: Object.keys(props), additionalProperties: false });
  const str = { type: "string" }, int = { type: "integer" }, numb = { type: "number" }, bool = { type: "boolean" };
  const arr = (items) => ({ type: "array", items });
  const SYSTEMS = { type: "string", enum: D.systems };
  const SPECS = obj({
    oil: obj({ spec: str, capacity: str, filter: str }), coolant: str,
    plugs: obj({ part: str, gap: str, torque: str }),
    timing: obj({ type: { type: "string", enum: ["belt", "chain"] }, interval: str, interference: { type: "string", enum: ["yes", "no", "unknown"] } }),
    wheels: obj({ bolt: str, centerBore: str, lugTorque: str, lugThread: str, stock: obj({ dia: int, width: numb, offset: int, tire: str }) }),
    fitment: obj({ lipOut: int, innerLimit: int, stockGap: int, suspension: { type: "string", enum: ["strut", "double_wishbone", "multilink"] }, stockCamber: numb, bump: int }),
    fluids: arr(obj({ name: str, spec: str })), torques: arr(obj({ name: str, spec: str })),
    notes: str,
  });
  const CAR = obj({ year: int, make: str, model: str, trim: str, chassis: str, engine: str, color: str, paintHex: str,
    body: { type: "string", enum: ["coupe", "sedan", "hatch", "wagon", "suv", "truck"] }, drivetrain: str, transmission: str, hp: int, torque: int, weightLb: int, valueEstimate: int });
  const ISSUES = arr(obj({ title: str, detail: str, severity: { type: "string", enum: ["low", "med", "high"] } }));
  const PRESETS = arr(obj({ n: str, dia: int, width: numb, offset: int, tw: int, ar: int, note: str }));
  const SETUP_SCHEMA = obj({
    car: CAR, specs: SPECS, knownIssues: ISSUES, fitPresets: PRESETS,
    setup: arr(obj({ k: str, v: str, note: str })),
    service: arr(obj({ id: str, name: str, everyMi: int, everyMo: int, cost: int, diff: int, safety: bool, crit: bool })),
    phases: arr(obj({ title: str, blurb: str })),
    mods: arr(obj({ phase: int, title: str, short: str, system: SYSTEMS, est: int, diff: int, safety: bool, tools: arr(str), parts: arr(str), notes: str, status: { type: "string", enum: ["planned", "done"] } })),
  });
  const SPECS_ONLY = obj({ car: CAR, specs: SPECS, knownIssues: ISSUES, fitPresets: PRESETS });
  const MOD_SCHEMA = obj({ short: str, system: SYSTEMS, est: int, diff: int, safety: bool, tools: arr(str), parts: arr(str), notes: str });

  const setupPrompt = (q, full) => `You are setting up a car in SUBLEVEL, a build-planning app for enthusiasts who do their own work. These numbers drive torque specs, wheel fitment and maintenance, so be accurate for this exact car. If you are unsure of a value, give the typical value for this car and say so in specs.notes. Don't invent part numbers; describe parts generically when unsure.

CAR: "${q.text}"
MILEAGE: ${q.miles ? num(q.miles) : "unknown"}
OWNER'S GOAL: ${GOAL_TXT[q.goal] || GOAL_TXT.daily}
BUILD BUDGET: ${q.budget ? "$" + num(q.budget) : "not set"}
ALREADY DONE / NOTES FROM THE OWNER: ${q.notes || "none"}

Return JSON:
- car: the exact car. body is coupe, sedan, hatch, wagon, suv or truck. paintHex: a typical factory color for it${q.color ? ` (owner says: ${q.color})` : ""}. valueEstimate: rough private-party value in USD at this mileage, average condition.
- specs: oil (viscosity spec, capacity with filter, filter), coolant type, spark plugs (type, gap, torque), timing (belt or chain, replacement interval, interference yes/no/unknown), wheels (bolt pattern, center bore, lug torque, lug thread, factory wheel and tire for this trim). fitment, in mm, front corner at stock height: lipOut = hub face out to the fender lip, innerLimit = hub face in to the nearest suspension part, stockGap = top of tire to fender lip, bump = suspension travel from rest to the bump stop; plus suspension = front suspension type, stockCamber = factory front camber in degrees (negative = top leans in). fluids: transmission fluid type and capacity, brake fluid, cold tire pressures, valve clearance if adjustable. torques: wheel nuts, oil drain plug, spark plugs, front caliper and bracket bolts, crank pulley bolt, axle nut, each in lb-ft with N·m.
- knownIssues: 3-6 well-known problems for this platform or engine, each with what to check.
- fitPresets: 4-5 popular aftermarket wheel setups for this car (diameter, width, offset, tire width tw and aspect ar) with what each needs.${full ? `
- setup: 10-12 rows for what's on the car now (Engine, Transmission, Suspension, Brakes, Wheels, Tires, Exhaust, Intake, Audio, Interior, Exterior). Stock unless the owner said otherwise.
- service: 8-12 maintenance items with real intervals for this car (miles and months), DIY parts cost in USD, difficulty 1-10. id is short lowercase (oil, timing, plugs, coolant, brakefluid, mtf, valves...). Mark brake items safety; mark the timing belt crit if the engine is interference.
- phases: exactly 4, in this order: make it reliable, make it look good, make it feel good, performance. Titles and blurbs written for this car and goal.
- mods: 20-26 mods across phases 1-4, specific to this car and goal. est = DIY parts cost in USD. diff 1-10. tools and parts lists. notes = one car-specific tip. Phase 1 must cover the known issues and anything due at this mileage. Mark brakes, tires and steering as safety. status "done" only for things the owner said are done. short is 1-2 lowercase words.` : ""}
Reply with only the JSON.`;

  /* ---------- parse "2004 Lexus IS300 5-speed" without AI ---------- */
  const parseCar = (text) => {
    const t = String(text || "").trim(); const m = t.match(/\b(19[5-9]\d|20[0-4]\d)\b/);
    const year = m ? +m[1] : new Date().getFullYear() - 20;
    const rest = t.replace(m ? m[0] : "", "").trim().split(/\s+/);
    return { year, make: rest[0] || "Car", model: rest.slice(1, 3).join(" ") || "Project", trim: rest.slice(3).join(" ") };
  };

  /* ---------- turn a setup into a garage vehicle ---------- */
  const blankAudio = () => ({ headUnit: { name: "", price: 0 }, front: { name: "", price: 0, rms: 0 }, rear: { name: "", price: 0, rms: 0 }, sub: { name: "", price: 0, size: 10, rms: 0 }, amp: { name: "", price: 0, rms: 0 }, wiring: { name: "", price: 0, gauge: "4" }, enclosure: { name: "", price: 0, type: "sealed", pos: "center", fire: "rear" }, extras: { name: "", price: 0 } });
  const SYS_OK = (s) => (D.systems.includes(s) ? s : "ENGINE");
  function vehicleFromAI(r, q) {
    const c = r.car || {}; const sp = r.specs || {}; const st = (sp.wheels && sp.wheels.stock) || {};
    const id = NS.uid("car-");
    const phases = (r.phases || []).slice(0, 4); while (phases.length < 4) phases.push(GENERIC.phases[phases.length]);
    const order = {};
    const mods = (r.mods || []).map((m) => {
      const ph = clamp(Math.round(m.phase) || 1, 1, 4); order[ph] = (order[ph] || 0) + 1;
      return { id: NS.uid("m"), phase: ph, order: order[ph], title: m.title, short: m.short, system: SYS_OK(m.system), status: m.status === "done" ? "done" : "planned", est: Math.max(0, Math.round(m.est) || 0), actual: 0, diff: clamp(Math.round(m.diff) || 3, 1, 10), safety: !!m.safety, tools: m.tools || [], parts: m.parts || [], notes: m.notes || "", photos: [] };
    });
    const oil = (r.service || []).find((x) => x.id === "oil");
    return {
      id, year: c.year || parseCar(q.text).year, make: c.make || "", model: c.model || "", trim: c.trim || "", chassis: c.chassis || "", engine: c.engine || "",
      color: q.color || c.color || "", paintHex: /^#[0-9a-f]{6}$/i.test(c.paintHex || "") ? c.paintHex : "#1b1a22",
      mileage: Math.round(q.miles) || 0, value: c.valueEstimate || 0, purchasePrice: Math.round(q.price) || 0, purchaseDate: NS.today(), budget: Math.round(q.budget) || 1500,
      status: "IN PROGRESS", photo: null, oilInterval: oil ? oil.everyMi : 5000, goal: q.goal,
      wheel: { dia: st.dia || 15, width: st.width || 6, offset: st.offset ?? 40, tire: st.tire || "195/55R15", drop: 0 },
      specs: { ...sp, body: c.body || "coupe", drivetrain: c.drivetrain || "", transmission: c.transmission || "", hp: c.hp || 0, torque: c.torque || 0, weightLb: c.weightLb || 0, knownIssues: r.knownIssues || [], fitPresets: r.fitPresets || [], ai: NS.today() },
      setup: (r.setup || []).map((s, i) => ({ id: "s" + i, k: s.k, v: s.v, note: s.note || "" })),
      phases: phases.map((p, i) => ({ id: i + 1, title: p.title, blurb: p.blurb || "" })),
      mods, log: [], expenses: [], audio: blankAudio(), plan: null,
      service: (r.service || []).map((x) => ({ id: String(x.id || NS.uid("sv")).toLowerCase().replace(/[^a-z0-9-]/g, ""), name: x.name, everyMi: Math.max(500, x.everyMi || 5000), everyMo: Math.max(1, x.everyMo || 12), cost: x.cost || 0, diff: x.diff || 3, safety: !!x.safety, crit: !!x.crit, known: null })),
    };
  }
  const GENERIC = {
    phases: [
      { title: "Make It Reliable", blurb: "Fluids, brakes, tires, belts, warning lights. Boring, and it comes first." },
      { title: "Make It Look Good", blurb: "Paint, lights, wheels, stance." },
      { title: "Make It Feel Good", blurb: "Suspension, bushings, alignment, sound." },
      { title: "Performance", blurb: "Only once it's boring-reliable. Research before parts." },
    ],
    mods: [
      [1, "Oil + filter change", "oil", "ENGINE", 45, 2, false], [1, "Transmission + diff fluids", "fluids", "ENGINE", 60, 3, false],
      [1, "Brake inspection: pads, rotors, fluid", "brakes", "SUSPENSION", 180, 4, true], [1, "Tires: check age and tread, replace if needed", "tires", "WHEELS", 400, 2, true],
      [1, "Coolant, hoses and belts", "cooling", "ENGINE", 90, 3, false], [1, "Battery and charging test", "battery", "ENGINE", 0, 1, false],
      [1, "Scan and fix warning lights", "codes", "ENGINE", 30, 3, false],
      [2, "Paint correction + headlight restore", "paint", "EXTERIOR", 120, 4, false], [2, "Wheels", "wheels", "WHEELS", 800, 2, false], [2, "Interior deep clean", "interior", "INTERIOR", 40, 2, false],
      [3, "Shocks/struts refresh", "suspension", "SUSPENSION", 500, 6, false], [3, "Alignment", "alignment", "SUSPENSION", 120, 3, false], [3, "Exhaust", "exhaust", "ENGINE", 400, 4, false],
      [4, "Compression + leak-down test", "compression", "ENGINE", 40, 4, false], [4, "Intake + tune research", "tune", "ENGINE", 0, 6, false],
    ],
  };
  function vehicleManual(q) {
    const p = parseCar(q.text); const id = NS.uid("car-"); const order = {};
    return {
      id, ...p, chassis: "", engine: "", color: q.color || "", paintHex: "#1b1a22", mileage: Math.round(q.miles) || 0, value: 0, purchasePrice: Math.round(q.price) || 0,
      purchaseDate: NS.today(), budget: Math.round(q.budget) || 1500, status: "IN PROGRESS", photo: null, oilInterval: 5000, goal: q.goal,
      wheel: { dia: 15, width: 6, offset: 40, tire: "195/55R15", drop: 0 }, specs: { body: "coupe" },
      setup: ["Engine", "Transmission", "Suspension", "Brakes", "Wheels", "Tires", "Exhaust", "Intake", "Audio", "Interior", "Exterior"].map((k, i) => ({ id: "s" + i, k, v: "Stock", note: "" })),
      phases: NS.clone(GENERIC.phases).map((x, i) => ({ id: i + 1, ...x })),
      mods: GENERIC.mods.map(([ph, title, short, system, est, diff, safety]) => ({ id: NS.uid("m"), phase: ph, order: (order[ph] = (order[ph] || 0) + 1), title, short, system, status: "planned", est, actual: 0, diff, safety, tools: [], parts: [], notes: "", photos: [] })),
      log: [], expenses: [], audio: blankAudio(), plan: null,
    };
  }
  function addVehicle(v) {
    if (NS.dropSample) NS.dropSample();
    const S = NS.S; S.vehicles[v.id] = v; S.meta.active = v.id; NS.migrate();
    NS._celebrate = { title: NS.vehLabel(v), kicker: "NEW PROJECT" };
    NS.commit("v:" + v.id, { silent: true, noProgress: true }); NS.commit("meta", { silent: true });
    NS.closeSheet(); NS.ui.look = null; NS.progressInit && NS.progressInit(); NS.go("garage");
  }

  /* ---------- the add-a-car sheet ---------- */
  NS.acts["add-vehicle"] = () => {
    const q = NS.ui.newCar || (NS.ui.newCar = { text: "", miles: "", budget: 1500, goal: "daily", notes: "", price: "", color: "" });
    NS.sheet(NS.sheetHead("NEW PROJECT", "Add a car") + `
      <div class="field"><label for="nc-text">What are you driving?</label><input class="input" id="nc-text" value="${esc(q.text)}" placeholder="2004 Lexus IS300 5-speed" autocomplete="off"></div>
      <div class="form-grid" style="margin-top:12px">
        <div class="field"><label for="nc-miles">Miles</label><input class="input num" id="nc-miles" type="number" inputmode="numeric" value="${esc(q.miles)}" placeholder="160000"></div>
        <div class="field"><label for="nc-budget">Build budget</label><div class="prefix"><span>$</span><input class="input money" id="nc-budget" type="number" inputmode="numeric" value="${esc(q.budget)}"></div></div>
      </div>
      <div class="field" style="margin-top:12px"><span class="lbl">What's it for?</span><div class="seg" id="nc-goal" data-val="${q.goal}">${GOALS.map(([k, l]) => `<button type="button" data-v="${k}" aria-pressed="${q.goal === k}" onclick="for(const b of this.parentNode.children)b.setAttribute('aria-pressed',b===this);this.parentNode.dataset.val=this.dataset.v">${l.toUpperCase()}</button>`).join("")}</div></div>
      <details class="more" style="margin-top:12px"><summary class="lbl">Tell it more (optional)</summary>
        <div class="field" style="margin-top:10px"><label for="nc-notes">What's already done to it?</label><textarea class="textarea" id="nc-notes" placeholder="K24 swap, coilovers, 17x9 +35, new clutch at 140k. Rear main seal leaks.">${esc(q.notes)}</textarea></div>
        <div class="form-grid" style="margin-top:12px">
          <div class="field"><label for="nc-price">What you paid</label><div class="prefix"><span>$</span><input class="input money" id="nc-price" type="number" inputmode="numeric" value="${esc(q.price)}"></div></div>
          <div class="field"><label for="nc-color">Color</label><input class="input" id="nc-color" value="${esc(q.color)}" placeholder="Silver"></div>
        </div>
      </details>
      <div id="nc-msg" class="muted" style="font-size:13.5px;margin-top:12px">${NS.aiReady() ? "Claude looks up the specs, fitment, service schedule and a full build roadmap for your exact car. You can change anything after." : `AI is off, so you'll start from a general template. ${NS.standalone ? '<button class="vio" data-act="settings-open" style="text-decoration:underline">Turn on AI in Settings</button> to have it fill everything in.' : ""}`}</div>
      <div class="sheet-foot"><button class="btn${NS.aiReady() ? " ghost" : " primary"}" data-act="nc-manual">${NS.aiReady() ? "Set up by hand" : "Add car"}</button><span class="grow"></span>${NS.aiReady() ? `<button class="btn primary" data-act="nc-ai">${icon("spark")}Set it up with AI</button>` : ""}</div>`, { focus: true });
  };
  const readQ = () => {
    const g = (id) => (document.getElementById(id) || {}).value || "";
    const q = { text: g("nc-text").trim(), miles: +g("nc-miles") || 0, budget: +g("nc-budget") || 0, goal: (document.getElementById("nc-goal") || {}).dataset?.val || "daily", notes: g("nc-notes").trim(), price: +g("nc-price") || 0, color: g("nc-color").trim() };
    NS.ui.newCar = q; return q;
  };
  NS.acts["nc-manual"] = () => {
    const q = readQ(); if (!q.text) { document.getElementById("nc-msg").textContent = "Type the car first, like \"2004 Lexus IS300\"."; return; }
    addVehicle(vehicleManual(q)); NS.ui.newCar = null; NS.toast("Added. Fill in the spec sheet in My Build when you're ready.");
  };

  /* AI run with a live progress readout; sections light up as Claude writes them. */
  const SECTIONS = [["car", "Identifying the car"], ["specs", "Specs + fluids"], ["knownIssues", "Known issues"], ["fitPresets", "Wheel fitment"], ["setup", "Current setup"], ["service", "Service schedule"], ["phases", "Roadmap phases"], ["mods", "Mods, costs + tools"]];
  async function runWithProgress(title, prompt, schema, sections, expect) {
    const ctl = new AbortController(); NS._aiCtl = ctl; const t0 = Date.now();
    NS.sheet(NS.sheetHead("SETTING UP", title) + `<div class="ai-run">
      <div class="meter" style="height:8px"><b id="ai-bar" style="width:3%"></b></div>
      <ul class="ai-steps">${sections.map(([k, l], i) => `<li data-k="${k}"${i === 0 ? ' class="on"' : ""}><i></i>${l}</li>`).join("")}</ul>
      <div class="row between"><span class="px dim" id="ai-time">0s</span><span class="px dim">CLAUDE IS RESEARCHING YOUR CAR</span></div></div>
      <div class="sheet-foot"><span class="grow"></span><button class="btn ghost" data-act="ai-cancel">Cancel</button></div>`, { noGrab: true });
    const tick = setInterval(() => { const el = document.getElementById("ai-time"); if (el) el.textContent = Math.round((Date.now() - t0) / 1000) + "s"; }, 1000);
    const onText = ({ text }) => {
      const bar = document.getElementById("ai-bar"); if (bar) bar.style.width = Math.min(96, 4 + (text.length / expect) * 92) + "%";
      let last = -1; sections.forEach(([k], i) => { if (text.includes(`"${k}"`)) last = i; });
      document.querySelectorAll(".ai-steps li").forEach((li, i) => { li.className = i < last ? "done" : i === last ? "on" : ""; });
    };
    // High effort: these answers become torque specs, fluids and fitment numbers, so accuracy beats speed.
    try { return await NS.sample.json(prompt, { schema, onText, signal: ctl.signal, effort: "high", modelTier: "default" }); }
    finally { clearInterval(tick); NS._aiCtl = null; }
  }
  NS.acts["ai-cancel"] = () => { if (NS._aiCtl) NS._aiCtl.abort(); NS.closeSheet(); };
  const aiError = (e) => (NS.aiErrCopy ? NS.aiErrCopy(e) : "Something went wrong. Try again.") || "Cancelled.";

  NS.acts["nc-ai"] = async () => {
    const q = readQ(); if (!q.text) { document.getElementById("nc-msg").textContent = "Type the car first, like \"2004 Lexus IS300\"."; return; }
    try {
      const r = await runWithProgress(q.text, setupPrompt(q, true), SETUP_SCHEMA, SECTIONS, 15000);
      if (!r || !r.car || !Array.isArray(r.mods)) throw { code: "invalid_json" };
      NS._pendingCar = vehicleFromAI(r, q); preview();
    } catch (e) {
      if (e && e.code === "cancelled") return;
      NS.acts["add-vehicle"](); const m = document.getElementById("nc-msg"); if (m) m.innerHTML = `<span class="bad">${esc(aiError(e))}</span>`;
    }
  };

  function preview() {
    const v = NS._pendingCar; const sp = v.specs;
    const total = v.mods.reduce((a, m) => a + (m.status === "done" ? 0 : m.est), 0);
    NS.sheet(NS.sheetHead("FOUND IT", NS.vehLabel(v)) + `
      <div class="preview-car">${NS.carSVG({ id: "pv", body: sp.body, paint: v.paintHex, dia: v.wheel.dia, crop: true, reflection: false, scene: NS.currentScene() === "studio" ? null : NS.currentScene() })}</div>
      <p class="muted" style="margin:10px 0 0;font-size:14.5px">${esc([v.chassis, v.engine, sp.hp ? sp.hp + " hp" : "", sp.drivetrain, sp.transmission].filter(Boolean).join(" · "))}</p>
      <div class="kv" style="margin-top:12px">
        <div><div class="k">ROADMAP</div><div class="v">${v.mods.length}<span class="dim" style="font-size:12px"> mods</span></div></div>
        <div><div class="k">PLANNED</div><div class="v">${money(total)}</div></div>
        <div><div class="k">SERVICE</div><div class="v">${v.service.length}<span class="dim" style="font-size:12px"> items</span></div></div>
        <div><div class="k">EST. VALUE</div><div class="v">${v.value ? money(v.value) : "—"}</div></div>
      </div>
      ${(sp.knownIssues || []).length ? `<div class="infobox" style="margin-top:12px"><h4>KNOWN ISSUES TO CHECK</h4><ul>${sp.knownIssues.slice(0, 4).map((k) => `<li><b style="color:var(--fg)">${esc(k.title)}.</b> ${esc(k.detail)}</li>`).join("")}</ul></div>` : ""}
      <details class="more" style="margin-top:12px"><summary class="lbl">Everything it found</summary>${specGrid(v)}
        ${v.phases.map((p) => `<div style="margin-top:12px"><span class="px vio">PHASE 0${p.id} · ${esc(p.title.toUpperCase())}</span><ul style="margin:6px 0 0;padding-left:18px;color:var(--fg-2);font-size:14px">${v.mods.filter((m) => m.phase === p.id).map((m) => `<li>${esc(m.title)} <span class="dim">~${money(m.est)}</span></li>`).join("")}</ul></div>`).join("")}
      </details>
      <p class="dim" style="font-size:12.5px;margin:12px 0 0">AI-researched. Double-check torque specs and part fitment before you buy or wrench.</p>
      <div class="sheet-foot"><button class="btn ghost" data-act="add-vehicle">Back</button><span class="grow"></span><button class="btn primary" data-act="nc-confirm">${icon("check")}Add to my garage</button></div>`);
  }
  NS.acts["nc-confirm"] = () => { const v = NS._pendingCar; if (!v) return; NS._pendingCar = null; NS.ui.newCar = null; addVehicle(v); };

  /* ---------- spec sheet (My Build) ---------- */
  const val = (x) => (x == null || x === "" ? "—" : esc(x));
  // Built-in specs store [name, spec] pairs; AI returns { name, spec } objects.
  const pairs = (a) => (a || []).map((x) => (Array.isArray(x) ? x : [x.name, x.spec])).filter(([k]) => k);
  function specGrid(v) {
    const sp = v.specs || {}; const w = sp.wheels || {}; const st = w.stock || {};
    const rows = [
      ["Engine", v.engine], ["Power", sp.hp ? `${sp.hp} hp / ${sp.torque || "?"} lb-ft` : ""], ["Drivetrain", [sp.drivetrain, sp.transmission].filter(Boolean).join(" · ")], ["Weight", sp.weightLb ? num(sp.weightLb) + " lb" : ""],
      ["Oil", sp.oil ? `${sp.oil.spec} · ${sp.oil.capacity}` : ""], ["Oil filter", sp.oil && sp.oil.filter], ["Coolant", sp.coolant],
      ["Spark plugs", sp.plugs ? `${sp.plugs.part} · gap ${sp.plugs.gap} · ${sp.plugs.torque}` : ""],
      ["Timing", sp.timing ? `${sp.timing.type} · ${sp.timing.interval}${sp.timing.interference === "yes" ? " · interference" : ""}` : ""],
      ["Bolt pattern", w.bolt], ["Center bore", w.centerBore], ["Lug nuts", [w.lugThread, w.lugTorque].filter(Boolean).join(" · ")],
      ["Factory wheel", st.dia ? `${st.dia}x${st.width} ${st.offset >= 0 ? "+" : ""}${st.offset} · ${st.tire}` : NS.isEK(v) ? `${D.fit.stock.dia}x${D.fit.stock.width} +${D.fit.stock.offset} · ${D.fit.stock.tw}/${D.fit.stock.ar}R${D.fit.stock.dia}` : ""],
    ].concat(pairs(sp.fluids));
    const tq = pairs(sp.torques);
    return `<div class="spec-grid">${rows.map(([k, x]) => `<div><span class="lbl">${esc(k)}</span><span>${val(x)}</span></div>`).join("")}</div>
      ${tq.length ? `<div class="lbl" style="margin:16px 0 8px">Torque specs</div><div class="spec-grid">${tq.map(([k, x]) => `<div><span class="lbl">${esc(k)}</span><span>${val(x)}</span></div>`).join("")}</div>` : ""}${sp.notes ? `<p class="dim" style="font-size:13px;margin:10px 0 0">${esc(sp.notes)}</p>` : ""}`;
  }
  NS.specSheetHTML = function (v) {
    const sp = v.specs || {}; const has = !!(sp.oil || sp.wheels || sp.hp);
    if (!has) return `<section class="section"><div class="spec-empty">
      <div><div class="eyebrow">SPEC SHEET</div><p class="muted" style="margin:6px 0 0;font-size:14px">Fluids, plugs, timing, bolt pattern, lug torque, factory wheel and known issues for this car.${NS.aiReady() ? " Claude can fill it in." : ""}</p></div>
      <div class="row">${NS.aiReady() ? `<button class="btn primary sm" data-act="spec-ai">${icon("spark")}Fill in with AI</button>` : ""}<button class="btn sm" data-act="spec-edit">${icon("edit")}Enter by hand</button></div></div></section>`;
    return `<section class="section"><details class="spec-sheet"${NS.ui.specOpen ? " open" : ""}>
      <summary><div><div class="eyebrow">SPEC SHEET${sp.src ? " · " + esc(sp.src.toUpperCase()) : sp.ai ? " · AI " + NS.fmtDate(sp.ai) : ""}</div><div class="spec-line">${esc([v.engine, sp.hp ? sp.hp + " HP" : "", sp.drivetrain, sp.wheels && sp.wheels.bolt].filter(Boolean).join(" · ") || "Tap to see")}</div></div>${icon("chev")}</summary>
      ${specGrid(v)}
      ${(sp.knownIssues || []).length ? `<div class="infobox" style="margin-top:12px"><h4>KNOWN ISSUES</h4><ul>${sp.knownIssues.map((k) => `<li><span class="tag ${k.severity === "high" ? "bad" : k.severity === "med" ? "warn" : ""}">${esc((k.severity || "").toUpperCase())}</span> <b style="color:var(--fg)">${esc(k.title)}.</b> ${esc(k.detail)}</li>`).join("")}</ul></div>` : ""}
      <div class="row" style="margin-top:12px"><button class="btn sm" data-act="spec-edit">${icon("edit")}Edit specs</button>${NS.aiReady() ? `<button class="btn sm" data-act="spec-ai">${icon("spark")}Refresh with AI</button>` : ""}</div>
    </details></section>`;
  };
  document.addEventListener("toggle", (e) => { if (e.target && e.target.matches && e.target.matches("details.spec-sheet")) NS.ui[e.target.dataset.k || "specOpen"] = e.target.open; }, true);

  NS.acts["spec-ai"] = async () => {
    const v = NS.veh();
    const q = { text: `${NS.vehLabel(v)}${v.engine ? ", " + v.engine : ""}${v.chassis ? " (" + v.chassis + ")" : ""}`, miles: v.mileage, budget: v.budget, goal: v.goal || "daily", notes: v.setup.filter((s) => s.v && !/^stock/i.test(s.v)).map((s) => `${s.k}: ${s.v}`).join("; "), color: v.color };
    try {
      const r = await runWithProgress(NS.vehLabel(v), setupPrompt(q, false), SPECS_ONLY, SECTIONS.slice(0, 4), 5000);
      const c = r.car || {};
      v.specs = { ...(v.specs || {}), ...r.specs, body: c.body || (v.specs && v.specs.body), drivetrain: c.drivetrain, transmission: c.transmission, hp: c.hp, torque: c.torque, weightLb: c.weightLb, knownIssues: r.knownIssues || [], fitPresets: r.fitPresets || [], ai: NS.today(), src: undefined };
      if (!v.chassis && c.chassis) v.chassis = c.chassis; if (!v.engine && c.engine) v.engine = c.engine;
      NS.ui.specOpen = true; NS.closeSheet(); NS.commitVeh(); NS.toast("Spec sheet updated");
    } catch (e) { if (e && e.code === "cancelled") return; NS.closeSheet(); NS.toast(aiError(e)); }
  };

  const SPEC_FIELDS = [
    { k: "body", l: "Body", t: "select", o: NS.bodyStyles.map(([v, l]) => ({ v, l })) }, { k: "drivetrain", l: "Drivetrain", t: "text", ph: "FWD" },
    { k: "transmission", l: "Transmission", t: "text" }, { k: "hp", l: "Horsepower", t: "number", step: 1 }, { k: "torque", l: "Torque (lb-ft)", t: "number", step: 1 }, { k: "weightLb", l: "Weight (lb)", t: "number", step: 10 },
    { k: "oil_spec", l: "Oil", t: "text", ph: "5W-30" }, { k: "oil_capacity", l: "Oil capacity", t: "text", ph: "3.6 qt with filter" }, { k: "oil_filter", l: "Oil filter", t: "text" }, { k: "coolant", l: "Coolant", t: "text" },
    { k: "plugs_part", l: "Spark plugs", t: "text" }, { k: "plugs_gap", l: "Plug gap", t: "text" }, { k: "plugs_torque", l: "Plug torque", t: "text" },
    { k: "timing_type", l: "Timing", t: "select", o: ["belt", "chain"] }, { k: "timing_interval", l: "Timing interval", t: "text" }, { k: "timing_interference", l: "Interference engine", t: "select", o: ["unknown", "yes", "no"] },
    { k: "w_bolt", l: "Bolt pattern", t: "text", ph: "4x100" }, { k: "w_centerBore", l: "Center bore", t: "text" }, { k: "w_lugThread", l: "Lug thread", t: "text" }, { k: "w_lugTorque", l: "Lug torque", t: "text" },
    { k: "st_dia", l: "Factory wheel diameter", t: "number", step: 1 }, { k: "st_width", l: "Factory wheel width", t: "number", step: 0.5 }, { k: "st_offset", l: "Factory offset", t: "number", step: 1 }, { k: "st_tire", l: "Factory tire", t: "text", ph: "195/55R15" },
    { k: "f_lipOut", l: "Fitment: lip out (mm)", t: "number", step: 1 }, { k: "f_innerLimit", l: "Fitment: inner limit (mm)", t: "number", step: 1 }, { k: "f_stockGap", l: "Fitment: stock gap (mm)", t: "number", step: 1 },
    { k: "f_suspension", l: "Fitment: front suspension", t: "select", o: [{ v: "strut", l: "MacPherson strut" }, { v: "double_wishbone", l: "Double wishbone" }, { v: "multilink", l: "Multi-link" }] },
    { k: "f_stockCamber", l: "Fitment: factory camber (°)", t: "number", step: 0.1 }, { k: "f_bump", l: "Fitment: bump travel (mm)", t: "number", step: 1 },
    { k: "notes", l: "Notes", t: "textarea" },
  ];
  NS.acts["spec-edit"] = () => {
    const v = NS.veh(); const sp = v.specs || {}; const o = sp.oil || {}, p = sp.plugs || {}, t = sp.timing || {}, w = sp.wheels || {}, st = w.stock || {}, f = sp.fitment || {};
    const value = { body: sp.body || "coupe", drivetrain: sp.drivetrain, transmission: sp.transmission, hp: sp.hp, torque: sp.torque, weightLb: sp.weightLb, oil_spec: o.spec, oil_capacity: o.capacity, oil_filter: o.filter, coolant: sp.coolant,
      plugs_part: p.part, plugs_gap: p.gap, plugs_torque: p.torque, timing_type: t.type || "belt", timing_interval: t.interval, timing_interference: t.interference || "unknown",
      w_bolt: w.bolt, w_centerBore: w.centerBore, w_lugThread: w.lugThread, w_lugTorque: w.lugTorque, st_dia: st.dia, st_width: st.width, st_offset: st.offset, st_tire: st.tire, f_lipOut: f.lipOut, f_innerLimit: f.innerLimit, f_stockGap: f.stockGap, f_suspension: f.suspension || "strut", f_stockCamber: f.stockCamber ?? "", f_bump: f.bump || "", notes: sp.notes };
    NS.form({ eyebrow: "SPEC SHEET", title: NS.vehLabel(v), fields: SPEC_FIELDS, value,
      onSave: (x) => {
        v.specs = { ...sp, body: x.body, drivetrain: x.drivetrain, transmission: x.transmission, hp: x.hp, torque: x.torque, weightLb: x.weightLb, coolant: x.coolant, notes: x.notes,
          oil: { spec: x.oil_spec, capacity: x.oil_capacity, filter: x.oil_filter }, plugs: { part: x.plugs_part, gap: x.plugs_gap, torque: x.plugs_torque },
          timing: { type: x.timing_type, interval: x.timing_interval, interference: x.timing_interference },
          wheels: { bolt: x.w_bolt, centerBore: x.w_centerBore, lugThread: x.w_lugThread, lugTorque: x.w_lugTorque, stock: x.st_dia && x.st_tire ? { dia: x.st_dia, width: x.st_width, offset: x.st_offset, tire: x.st_tire } : undefined },
          fitment: { lipOut: x.f_lipOut, innerLimit: x.f_innerLimit, stockGap: x.f_stockGap, suspension: x.f_suspension, stockCamber: x.f_stockCamber, bump: x.f_bump } };
        if (!v.specs.wheels.stock) delete v.specs.wheels.stock;
        NS.ui.specOpen = true; NS.commitVeh(); NS.toast("Specs saved");
      } });
  };

  /* ---------- mod form: fill it in with AI ---------- */
  const setField = (k, x) => {
    const el = document.getElementById("f_" + k); if (!el) return;
    if (el.type === "checkbox") el.checked = !!x;
    else if (el.tagName === "TEXTAREA" && Array.isArray(x)) el.value = x.join("\n");
    else { el.value = x; if (el.type === "range" && el.previousElementSibling) el.previousElementSibling.textContent = x; }
  };
  function injectModAI() {
    if (!NS.aiReady()) return;
    const form = document.getElementById("ns-form"); if (!form) return;
    const bar = document.createElement("div"); bar.className = "full row"; bar.style.cssText = "grid-column:1/-1";
    bar.innerHTML = `<button type="button" class="btn sm" data-act="mod-ai">${icon("spark")}Fill in cost, tools + parts with AI</button><span class="dim" id="mod-ai-msg" style="font-size:13px"></span>`;
    form.insertBefore(bar, form.children[1]);
  }
  ["mod-add", "mod-edit"].forEach((k) => { const orig = NS.acts[k]; NS.acts[k] = (el) => { orig(el); injectModAI(); }; });
  NS.acts["mod-ai"] = async (el) => {
    const v = NS.veh(); const title = (document.getElementById("f_title") || {}).value || ""; const msg = document.getElementById("mod-ai-msg");
    if (!title.trim()) { msg.textContent = "Name the mod first."; return; }
    el.disabled = true; msg.innerHTML = `<span class="thinking">Estimating</span>`;
    const car = `${NS.vehLabel(v)}${v.chassis ? " (" + v.chassis + ")" : ""}, ${v.engine || "engine unknown"}, ${num(v.mileage)} miles, goal: ${GOAL_TXT[v.goal] || "daily driver"}`;
    try {
      const r = await NS.sample.json(`Estimate this modification for a DIY owner. Car: ${car}. Current setup: ${v.setup.map((s) => `${s.k}: ${s.v}`).join("; ")}.
Mod: "${title.trim()}".
Reply with only JSON: short (1-2 lowercase words), system (one of ${D.systems.join(", ")}), est (DIY parts cost in USD for this car), diff (1-10 for a home mechanic), safety (true for brakes, tires, steering), tools (list), parts (list, specific to this car, no invented part numbers), notes (one car-specific tip, 1-2 sentences).`, { schema: MOD_SCHEMA, effort: "low", modelTier: "default" });
      ["short", "system", "est", "diff", "safety", "tools", "parts", "notes"].forEach((k) => r[k] != null && setField(k, r[k]));
      msg.innerHTML = `<span class="ok">Filled in.</span> Check it, then save.`;
    } catch (e) { msg.textContent = aiError(e); } finally { el.disabled = false; }
  };
})();
