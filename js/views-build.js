/* BUILD: vehicle profile, current setup, roadmap. */
(function () {
  const NS = window.NS, D = window.NS_DATA;
  const { esc, money, num, icon } = NS;
  const ORDER = ["planned", "researching", "bought", "in-progress", "done"];

  function modRow(m, v) {
    const open = !!NS.ui.openMods[m.id];
    const job = NS.jobFor(m);
    const inv = NS.S.inventory.items;
    const have = (name) => {
      const n = name.toLowerCase();
      const hit = inv.find((i) => i.name.toLowerCase().includes(n) || n.includes(i.name.toLowerCase().replace(/\s*\(.*\)/, "")));
      return hit ? hit.status : null;
    };
    const li = (arr) => arr.length ? `<ul>${arr.map((t) => { const h = have(t); return `<li>${esc(t)}${h === "need" ? ' <span class="tag bad">NEED</span>' : h ? ' <span class="tag">' + h.toUpperCase() + "</span>" : ""}</li>`; }).join("")}</ul>` : '<p class="dim" style="margin:6px 0 0;font-size:14px">None listed</p>';
    const over = m.actual && m.est && m.actual > m.est;
    return `<details class="mod" id="mod-${m.id}" data-id="${m.id}"${open ? " open" : ""}>
      <summary>
        <div style="min-width:0">
          <div class="t">${esc(m.title)}${m.safety ? ' <span class="tag bad" title="Safety item">SAFETY</span>' : ""}</div>
          <div class="meta"><span class="px">${esc(m.system)}</span>${m.status === "done" && m.doneDate ? `<span class="px ok">DONE ${NS.fmtDate(m.doneDate)}</span>` : ""}<span class="mono">${m.actual ? money(m.actual) : m.est ? "~" + money(m.est) : "$0"}</span>${NS.pips(m.diff)}${(m.photos || []).length ? `<span>${icon("camera", "").replace("<svg", '<svg style="width:13px;height:13px;vertical-align:-2px"')} ${m.photos.length}</span>` : ""}</div>
        </div>
        ${NS.statusChip(m.status, true, m.id)}
      </summary>
      <div class="mod-body">
        <div class="kv">
          <div><div class="k">ESTIMATED</div><div class="v">${money(m.est)}</div></div>
          <div><div class="k">ACTUAL</div><div class="v ${over ? "warn" : ""}">${m.actual ? money(m.actual) : "—"}</div></div>
          <div><div class="k">DIFFICULTY</div><div class="v">${m.diff}<span class="dim" style="font-size:12px">/10</span></div></div>
          <div><div class="k">PHASE</div><div class="v">0${m.phase}</div></div>
        </div>
        <div class="cols">
          <div><span class="lbl">Required tools</span>${li(m.tools || [])}</div>
          <div><span class="lbl">Parts</span>${li(m.parts || [])}</div>
        </div>
        ${m.notes ? `<div><span class="lbl">Notes</span><p style="margin:6px 0 0;color:var(--fg-2)">${esc(m.notes)}</p></div>` : ""}
        ${(m.photos || []).length ? `<div class="photos">${m.photos.map((p) => `<img src="${NS.img(p)}" alt="" loading="lazy">`).join("")}</div>` : ""}
        <div class="row">
          <button class="btn sm" data-act="mod-edit" data-id="${m.id}">${icon("edit")}Edit</button>
          ${job ? `<button class="btn sm" data-act="open-job" data-id="${job}">${icon("learn")}Guide</button>` : ""}
          <button class="btn sm" data-act="calc-from" data-id="${m.id}">${icon("calc")}Real cost</button>
          ${m.status !== "done" ? `<button class="btn sm primary" data-act="finish-mod" data-id="${m.id}">${icon("check")}Done, log it</button>` : ""}
        </div>
      </div>
    </details>`;
  }

  NS.views.build = function () {
    const S = NS.S, v = NS.veh();
    const pct = NS.buildPct(v);
    const spent = NS.spent(v);
    const vehicles = Object.values(S.vehicles);
    const cur = NS.currentPhase(v);
    const f = NS.ui.modFilter;
    const show = (m) => f === "all" || (f === "open" && m.status !== "done") || m.status === f;
    const planned = v.mods.reduce((a, m) => a + (m.status === "done" ? 0 : m.est || 0), 0);

    return `${NS.subnav()}
    <div class="page-head">
      <div>
        <div class="eyebrow">MY BUILD · ${esc(v.chassis)}</div>
        <h1 class="h1" style="margin-top:6px">${esc(NS.vehLabel(v))}</h1>
        <p class="lede">${esc(v.engine)} · ${esc(v.color || "")} · ${num(v.mileage)} mi · ${v.purchasePrice ? "bought" : "added"} ${NS.fmtDate(v.purchaseDate || NS.today())} ${String(v.purchaseDate || "").slice(0, 4)}${v.purchasePrice ? " for " + money(v.purchasePrice) : ""}</p>
      </div>
      <div class="row"><button class="btn" data-act="edit-vehicle">${icon("edit")}Edit car</button><button class="btn" data-act="add-vehicle">${icon("plus")}Add car</button></div>
    </div>
    ${vehicles.length > 1 ? `<div class="chips" style="margin-bottom:16px">${vehicles.map((x) => `<button class="chip" data-act="switch-veh" data-id="${x.id}" aria-pressed="${x.id === v.id}">${esc(x.year + " " + x.make + " " + x.model)}</button>`).join("")}</div>` : ""}

    <div class="kv" style="margin-bottom:8px">
      <div><div class="k">BUILD</div><div class="v">${pct}%</div></div>
      <div><div class="k">SPENT / BUDGET</div><div class="v">${money(spent)}<span class="dim" style="font-size:13px"> / ${money(v.budget)}</span></div></div>
      <div><div class="k">STILL PLANNED</div><div class="v">${money(planned)}</div></div>
      <div><div class="k">PHASE</div><div class="v">0${cur.id}</div></div>
    </div>

    ${NS.specSheetHTML ? NS.specSheetHTML(v) : ""}

    <section class="section"><details class="spec-sheet" data-k="setupOpen"${NS.ui.setupOpen ? " open" : ""}>
      <summary><div><div class="eyebrow">CURRENT SETUP · ${v.setup.length}</div><div class="spec-line">What's on the car right now</div></div>${icon("chev")}</summary>
      <div class="setup">${v.setup.map((s) => `<button class="setup-row" data-act="setup-edit" data-id="${s.id}"><span class="k">${esc(s.k)}</span><span class="v">${esc(s.v || "—")}${s.note ? `<small>${esc(s.note)}</small>` : ""}</span>${icon("edit")}</button>`).join("")}</div>
      <div class="row" style="margin-top:12px"><button class="btn sm" data-act="setup-add">${icon("plus")}Component</button></div>
    </details></section>

    <section class="section">
      <div class="sec-head"><div><div class="eyebrow">BUILD ROADMAP</div><h2 class="h2" style="margin-top:4px">Phase by phase</h2></div>
        <div class="chips">${[["all", "All"], ["open", "Open"], ["bought", "Bought"], ["in-progress", "In progress"], ["done", "Done"]].map(([k, l]) => `<button class="chip" data-act="mod-filter" data-f="${k}" aria-pressed="${f === k}">${l}</button>`).join("")}</div>
      </div>
      ${v.phases.map((p) => {
        const ms = v.mods.filter((m) => m.phase === p.id).sort((a, b) => a.order - b.order);
        const pp = NS.phasePct(v, p.id);
        const vis = ms.filter(show);
        const cls = pp === 100 ? "complete" : p.id === cur.id ? "active" : "";
        const est = ms.reduce((a, m) => a + (m.actual || m.est || 0), 0);
        return `<div class="phase ${cls}">
          <div class="phase-num">0${p.id}</div>
          <div class="phase-head">
            <div style="min-width:0"><span class="px">PHASE 0${p.id} · ${pp}% · ${money(est)}</span><div class="phase-title">${esc(p.title.toUpperCase())}</div><p class="muted" style="margin:4px 0 0;font-size:14px;max-width:60ch">${esc(p.blurb || "")}</p></div>
            <div class="row"><button class="iconbtn" data-act="phase-edit" data-id="${p.id}" aria-label="Edit phase">${icon("edit")}</button><button class="btn sm" data-act="mod-add" data-phase="${p.id}">${icon("plus")}Mod</button></div>
          </div>
          <div class="meter" style="margin-top:10px;max-width:420px"><b style="width:${pp}%"></b></div>
          <div class="mods">${vis.map((m) => modRow(m, v)).join("") || `<div class="empty" style="padding:16px">${ms.length ? "Nothing matches this filter." : "No mods in this phase yet."}</div>`}</div>
        </div>`;
      }).join("")}
    </section>`;
  };

  document.addEventListener("toggle", (e) => {
    const t = e.target;
    if (t && t.matches && t.matches("details.mod")) NS.ui.openMods[t.dataset.id] = t.open;
  }, true);

  /* ---------- actions ---------- */
  NS.acts["mod-filter"] = (el) => { NS.ui.modFilter = el.dataset.f; NS.render({ quiet: true }); };
  NS.acts["cycle-status"] = (el) => {
    const v = NS.veh(); const m = v.mods.find((x) => x.id === el.dataset.id); if (!m) return;
    m.status = ORDER[(ORDER.indexOf(m.status) + 1) % ORDER.length];
    if (m.status === "done") { m.doneDate = NS.today(); NS._celebrate = { title: m.title, kicker: "MOD INSTALLED" }; }
    NS.commitVeh({ silent: true });
    el.dataset.s = m.status;
    el.innerHTML = "<i></i>" + (D.statuses.find((x) => x.v === m.status).l.toUpperCase());
    if (NS.route !== "build") NS.render({ quiet: true });
  };

  const modFields = (v) => [
    { k: "title", l: "Modification", t: "text", full: true },
    { k: "phase", l: "Phase", t: "select", o: v.phases.map((p) => ({ v: p.id, l: `0${p.id} · ${p.title}` })) },
    { k: "system", l: "System", t: "select", o: D.systems },
    { k: "status", l: "Status", t: "select", o: D.statuses },
    { k: "short", l: "Short name", t: "text", ph: "e.g. brakes" },
    { k: "est", l: "Estimated price", t: "money" },
    { k: "actual", l: "Actual price", t: "money" },
    { k: "diff", l: "Difficulty (1–10)", t: "range", min: 1, max: 10 },
    { k: "safety", l: "Safety item (brakes, tires, steering). Gets priority in Next Move.", t: "check" },
    { k: "tools", l: "Required tools", t: "list" },
    { k: "parts", l: "Parts", t: "list" },
    { k: "notes", l: "Notes", t: "textarea" },
    { k: "photos", l: "Photos", t: "photos" },
  ];
  NS.acts["mod-add"] = (el) => {
    const v = NS.veh(); const phase = +el.dataset.phase || 1;
    NS.form({ eyebrow: "NEW MOD", title: "Add to roadmap", fields: modFields(v),
      value: { phase, system: "ENGINE", status: "planned", est: 0, actual: 0, diff: 3, tools: [], parts: [], photos: [] },
      onSave: (o) => {
        if (!o.title) { NS.toast("Give the mod a name"); return false; }
        o.phase = +o.phase; o.id = NS.uid("m");
        o.order = Math.max(0, ...v.mods.filter((m) => m.phase === o.phase).map((m) => m.order)) + 1;
        v.mods.push(o); NS.ui.openMods[o.id] = true; NS.commitVeh(); NS.toast("Added to Phase 0" + o.phase);
      } });
  };
  NS.acts["mod-edit"] = (el) => {
    const v = NS.veh(); const m = v.mods.find((x) => x.id === el.dataset.id); if (!m) return;
    NS.form({ eyebrow: "EDIT MOD", title: m.title, fields: modFields(v), value: m,
      onSave: (o) => { o.phase = +o.phase; Object.assign(m, o); NS.commitVeh(); NS.toast("Saved"); },
      onDelete: () => { v.mods = v.mods.filter((x) => x !== m); NS.commitVeh(); NS.toast("Mod removed"); } });
  };
  NS.acts["finish-mod"] = (el) => {
    const v = NS.veh(); const m = v.mods.find((x) => x.id === el.dataset.id); if (!m) return;
    NS.logForm({
      prefill: { title: m.title, type: m.phase === 1 ? "maint" : "mod", cost: m.actual || m.est || 0, notes: "", mileage: v.mileage, tags: svcTags(m) },
      expenseCat: catFor(m),
      onDone: (entry) => { m.status = "done"; m.doneDate = entry.date; if (!m.actual && entry.cost) m.actual = entry.cost; NS._celebrate = { title: m.title, kicker: "MOD INSTALLED" }; },
    });
  };
  function svcTags(m) {
    const t = (m.title + " " + (m.short || "")).toLowerCase();
    const map = [[/brake/, "brakefluid"], [/oil/, "oil"], [/plug/, "plugs"], [/coolant|thermostat/, "coolant"], [/timing/, "timing"], [/valve/, "valves"], [/tire/, "rotation"], [/belt/, "belts"], [/mtf|transmission fluid/, "mtf"], [/intake|air filter/, "airfilter"]];
    return map.filter(([re]) => re.test(t)).map(([, id]) => id).filter((id, i, a) => a.indexOf(id) === i && !(id === "belts" && /timing/.test(t)));
  }
  function catFor(m) {
    if (m.phase === 1 && m.system !== "WHEELS") return "Maintenance";
    return { ENGINE: "Performance", SUSPENSION: "Suspension", WHEELS: "Wheels", INTERIOR: "Interior", AUDIO: "Audio", EXTERIOR: "Exterior" }[m.system] || "Maintenance";
  }
  NS.catFor = catFor;

  NS.acts["phase-edit"] = (el) => {
    const v = NS.veh(); const p = v.phases.find((x) => x.id === +el.dataset.id);
    NS.form({ eyebrow: "PHASE 0" + p.id, title: "Edit phase", value: p,
      fields: [{ k: "title", l: "Title", t: "text", full: true }, { k: "blurb", l: "What this phase is about", t: "textarea" }],
      onSave: (o) => { Object.assign(p, o); NS.commitVeh(); } });
  };

  NS.acts["setup-edit"] = (el) => {
    const v = NS.veh(); const s = v.setup.find((x) => x.id === el.dataset.id);
    NS.form({ eyebrow: "CURRENT SETUP", title: s.k, value: s,
      fields: [{ k: "k", l: "Component", t: "text" }, { k: "v", l: "What's installed", t: "text" }, { k: "note", l: "Notes", t: "textarea" }],
      onSave: (o) => { Object.assign(s, o); NS.commitVeh(); NS.toast("Setup updated"); },
      onDelete: () => { v.setup = v.setup.filter((x) => x !== s); NS.commitVeh(); } });
  };
  NS.acts["setup-add"] = () => {
    const v = NS.veh();
    NS.form({ eyebrow: "CURRENT SETUP", title: "Add component", value: {},
      fields: [{ k: "k", l: "Component", t: "text", ph: "e.g. Clutch" }, { k: "v", l: "What's installed", t: "text" }, { k: "note", l: "Notes", t: "textarea" }],
      onSave: (o) => { if (!o.k) return false; o.id = NS.uid("s"); v.setup.push(o); NS.commitVeh(); } });
  };

  const vehFields = [
    { k: "year", l: "Year", t: "number", step: 1 }, { k: "make", l: "Make", t: "text" },
    { k: "model", l: "Model", t: "text" }, { k: "trim", l: "Trim", t: "text" },
    { k: "chassis", l: "Chassis code", t: "text" }, { k: "engine", l: "Engine", t: "text" },
    { k: "color", l: "Color", t: "text" }, { k: "paintHex", l: "Paint (for the drawing)", t: "color" },
    { k: "mileage", l: "Mileage", t: "number", step: 1 }, { k: "value", l: "Estimated value", t: "money" },
    { k: "purchasePrice", l: "Purchase price", t: "money" }, { k: "purchaseDate", l: "Purchase date", t: "date" },
    { k: "budget", l: "Build budget", t: "money" }, { k: "oilInterval", l: "Oil interval (mi)", t: "number", step: 500 },
    { k: "status", l: "Build status", t: "select", o: ["PLANNING", "IN PROGRESS", "ON JACK STANDS", "DAILY", "DONE (LOL)"] },
    { k: "photo", l: "Hero photo", t: "photos", single: true },
  ];
  NS.acts["edit-vehicle"] = () => {
    const S = NS.S, v = NS.veh();
    const many = Object.keys(S.vehicles).length > 1;
    NS.form({ eyebrow: "VEHICLE PROFILE", title: NS.vehLabel(v), fields: vehFields, value: v,
      onSave: (o) => { o.year = Math.round(o.year); Object.assign(v, o); NS.commitVeh(); NS.toast("Vehicle saved"); },
      onDelete: many ? () => {
        delete S.vehicles[v.id]; S.meta.active = Object.keys(S.vehicles)[0];
        NS.commit("v:" + v.id, { silent: true }); NS.commit("meta"); NS.toast("Vehicle removed");
      } : null });
  };
  NS.acts["add-vehicle"] = () => {
    const S = NS.S;
    NS.form({ eyebrow: "NEW PROJECT", title: "Add a car", fields: vehFields.filter((f) => f.k !== "photo"),
      value: { year: 2000, status: "PLANNING", budget: 1500, oilInterval: 5000, paintHex: "#1b1a22", purchaseDate: NS.today() },
      onSave: (o) => {
        if (!o.make || !o.model) { NS.toast("Make and model are required"); return false; }
        const id = NS.uid("car-");
        const base = window.NS_SEED.vehicles["civic-97"];
        S.vehicles[id] = Object.assign({
          id, photo: null, wheel: { dia: 15, width: 7, offset: 40, tire: "195/55R15", drop: 0 },
          setup: ["Engine", "Transmission", "Suspension", "Brakes", "Wheels", "Tires", "Exhaust", "Intake", "Audio", "Interior", "Exterior"].map((k, i) => ({ id: "s" + i, k, v: "", note: "" })),
          phases: NS.clone(base.phases), mods: [], log: [], expenses: [],
          audio: NS.clone(base.audio),
        }, o, { year: Math.round(o.year) });
        S.meta.active = id;
        NS.commit("v:" + id, { silent: true }); NS.commit("meta"); NS.toast("New project added");
      } });
  };
})();
