/* GARAGE: the dashboard. */
(function () {
  const NS = window.NS, D = window.NS_DATA;
  const { esc, money, num, icon } = NS;

  NS.jobFor = function (m) {
    const t = ((m && (m.title + " " + (m.short || ""))) || "").toLowerCase();
    const map = [["brake", "brakes"], ["oil", "oil"], ["plug", "plugs"], ["coilover", "coilovers"], ["lowering", "coilovers"], ["speaker", "speakers"], ["head unit", "stereo"], ["stereo", "stereo"], ["thermostat", "thermostat"], ["radiator", "bleed"], ["coolant", "bleed"], ["timing", "timing"], ["strut", "suspension"], ["shock", "suspension"], ["code", "cel"]];
    const hit = map.find(([k]) => t.includes(k));
    return hit ? hit[1] : null;
  };

  function heroStage(v) {
    const scene = NS.currentScene();
    const sc = scene === "studio" ? null : scene;
    const plan = NS.ui.heroView === "plan" && v.plan;
    const vis = plan
      ? NS.lookCar(NS.lookOf(v, "plan"), { id: "hero", scene: sc, alt: "The plan for " + NS.vehLabel(v) })
      : v.photo
        ? `<img class="photo" src="${NS.img(v.photo)}" alt="${esc(NS.vehLabel(v))}">`
        : NS.carSVG({ id: "hero", dia: v.wheel?.dia || 14, od: tireOD(v), drop: v.wheel?.drop || 0, paint: v.paintHex, scene: sc, alt: NS.vehLabel(v) + " side profile" });
    const btn = NS.assets && !plan ? `<button class="btn sm photo-btn" data-act="hero-photo">${icon("camera")}${v.photo ? "Change photo" : "Add your photo"}</button>` : "";
    const sceneName = (NS.scenes.find((x) => x.id === scene) || {}).n || "Studio";
    const bar = `<div class="stage-bar">${v.plan ? `<div class="seg mini">${[["now", "NOW"], ["plan", "THE PLAN"]].map(([k, l]) => `<button data-act="hero-view" data-k="${k}" aria-pressed="${(plan ? "plan" : "now") === k}">${l}</button>`).join("")}</div>` : `<button class="btn sm" data-act="go" data-r="style">${icon("spark")}Design the plan</button>`}<button class="btn sm" data-act="scene-pick">${icon("board")}${esc(sceneName)}</button></div>`;
    const cap = plan ? `<div class="plan-cap"><span class="px vio">THE PLAN</span><span>${esc(NS.lookLine(NS.lookOf(v, "plan")))}</span><span class="px">${NS.buildPct(v)}% THERE</span></div>` : "";
    return `<div class="stage${plan ? " is-plan" : ""}">${vis}<div class="scan"></div>${v.photo && !plan ? '<div class="floor"></div>' : ""}${bar}${btn}</div>${cap}`;
  }
  function tireOD(v) {
    const t = NS.parseTire(v.wheel?.tire);
    return t ? NS.tireOD(t.dia, t.tw, t.ar) : 596;
  }

  function nextMove(v) {
    const moves = NS.nextMoves(v);
    if (!moves.length) return `<section class="next"><div class="label">NEXT MOVE<i></i></div><h3>Nothing open on the roadmap.</h3><p class="why">Add the next mod in My Build and it shows up here.</p></section>`;
    const m = moves[0];
    const job = NS.jobFor(m.mod) || m.job;
    return `<section class="next" aria-label="Next move">
      <div class="label">NEXT MOVE<i></i><span class="px dim">SAFETY → RELIABILITY → LOOKS</span></div>
      <h3>${esc(m.title)}</h3>
      <p class="why">${m.why}</p>
      <div class="next-stats">
        <div><div class="stat"><div class="k">Est. cost</div><div class="v">${m.cost ? money(m.cost) : "$0"}</div></div></div>
        <div><div class="stat"><div class="k">Difficulty</div><div class="v">${m.diff || "–"}<span class="dim" style="font-size:15px">/10</span></div></div></div>
        <div><div class="stat"><div class="k">Priority</div><div class="v prio ${m.level}">${m.level}</div></div></div>
      </div>
      ${m.need && m.need.length ? `<div class="need"><span class="px warn">STILL NEED</span>&nbsp; ${m.need.map(esc).join(" · ")}</div>` : ""}
      <div class="row" style="margin-top:16px">${NS.commitHTML(m, v)}</div>
      <div class="row" style="margin-top:10px">
        ${job ? `<button class="btn primary" data-act="open-job" data-id="${job}">${icon("learn")}Open the guide</button>` : ""}
        ${m.mod ? `<button class="btn" data-act="finish-mod" data-id="${m.mod.id}">${icon("check")}Done, log it</button>` : m.svc ? `<button class="btn" data-act="log-new" data-preset="${m.svc}">${icon("check")}Done, log it</button>` : m.go ? `<button class="btn" data-act="go" data-r="${m.go}">${icon("clock")}Open schedule</button>` : ""}
        ${m.mod ? `<span class="px vio" style="margin-left:auto">+${NS.modXP(m.mod) + 25} XP</span>` : ""}
      </div>
      ${moves.length > 1 ? `<div class="then"><span class="px dim">THEN</span>${moves.slice(1, 3).map((x, i) => `<button data-act="${x.mod ? "open-mod" : x.svc || x.go ? "go" : "noop"}" data-r="service" data-id="${x.mod ? x.mod.id : ""}"><span class="mono">0${i + 2}</span><span>${esc(x.title)} <span class="dim">${x.cost ? money(x.cost) : ""}</span></span></button>`).join("")}</div>` : ""}
    </section>`;
  }

  function statusLine(v, last) {
    const st = NS.streak(); const ms = NS.nextMilestone(v);
    const hr = new Date().getHours();
    const bits = [
      hr >= 22 || hr < 4 ? `<span class="vio">LATE SHIFT</span>` : "",
      `DAY ${NS.daysOwned(v)} WITH THE ${esc((v.chassis || v.model).toUpperCase())}`,
      last ? `LAST SESSION ${NS.daysAgo(last.date).toUpperCase()}` : "NO SESSIONS YET",
      st.n ? `<span class="${st.atRisk ? "warn" : "vio"}">${st.n}-WEEK STREAK${st.atRisk ? " · AT RISK" : ""}</span>` : "",
      `${num(ms.at)} IN ${num(ms.left)} MI`,
    ].filter(Boolean);
    return bits.map((b) => `<span>${b}</span>`).join("<i>·</i>");
  }
  function rankMini() {
    const xb = NS.xpBreakdown(); const L = NS.level(xb.total);
    const un = NS.unlocked(); const recent = un.slice(-4).map((id) => NS.badges.find((b) => b.id === id));
    return `<button class="rank-mini" data-act="go" data-r="rank">
      <div class="row between"><span class="px vio">RANK · LV ${L.n}</span><span class="px dim">${un.length}/${NS.badges.length} BADGES</span></div>
      <div class="row between" style="margin-top:6px;flex-wrap:nowrap"><span class="h-display" style="font-size:15px">${esc(L.name)}</span><span class="row" style="gap:4px;flex-wrap:nowrap">${recent.map((b) => `<span class="badge-dot" title="${esc(b.n)}">${NS.badgeIcon(b.g)}</span>`).join("")}</span></div>
      <div class="meter" style="margin-top:10px"><b style="width:${L.pct * 100}%"></b></div>
      <div class="px dim" style="margin-top:6px">${L.next ? `${num(L.toNext)} XP TO ${esc(L.nextName)}` : "MAX RANK"}</div>
    </button>`;
  }

  NS.phoneURL = "https://jaylikescars1-lab.github.io/sublevel/";
  function handoff() {
    return `<section class="handoff" aria-label="Phone app">
      <div><span class="px vio">CLAUDE.AI COPY</span><p><b>Your garage lives in the phone app now.</b> Anything you change here stays here until you send it over.</p></div>
      <div class="row"><a class="btn sm" href="${NS.phoneURL}" target="_blank" rel="noopener">${icon("arrow")}Open phone app</a><button class="btn sm primary" data-act="handoff-open">${icon("share")}Send to phone</button></div>
    </section>`;
  }
  NS.acts["handoff-open"] = () => {
    NS.sheet(NS.sheetHead("ONE GARAGE", "Send this garage to your phone") + `
      <ol class="handoff-steps">
        <li><b>Export it.</b> Saves one file with your whole garage and its photos.<div class="row" style="margin-top:8px"><button class="btn primary sm" data-act="backup-export">${icon("share")}Export backup</button></div><div id="bk-msg" class="muted" style="font-size:13.5px;margin-top:6px"></div></li>
        <li><b>Get the file onto your phone.</b> Files, iCloud Drive, AirDrop or email all work.</li>
        <li><b>Open SUBLEVEL on your phone</b> → More → Settings → Import a backup → <b>Merge it in</b>. It adds what's new and keeps everything already there.</li>
      </ol>
      <p class="dim" style="font-size:13.5px;margin:12px 0 0">Phone app: <span class="mono" style="color:var(--fg-2);word-break:break-all;font-size:12.5px">${NS.phoneURL}</span>. Going the other way works the same: export on the phone, merge here.</p>`);
  };
  NS.acts["tiles-more"] = () => { NS.ui.allTiles = !NS.ui.allTiles; NS.render({ quiet: true }); };

  NS.views.garage = function () {
    const S = NS.S, v = NS.veh();
    const rel = NS.reliability(v);
    const pct = NS.buildPct(v);
    const sys = NS.systemPct(v);
    const log = NS.sortedLog(v).filter((l) => !(l.tags || []).includes("quick"));
    const last = log[0];
    const svc = NS.lastService(v);
    const nmaint = NS.nextMaint(v);
    const phase = NS.currentPhase(v);
    const waiting = NS.partsWaiting(S);
    const monthN = v.expenses.filter((e) => String(e.date).startsWith(NS.today().slice(0, 7))).length;
    const vehicles = Object.values(S.vehicles);
    const hunts = (S.hunt.items || []).filter((h) => h.saved).sort((a, b) => NS.huntScore(b) - NS.huntScore(a)).slice(0, 2);

    return `
    <section class="mast">
      <div class="row" style="gap:12px;flex-wrap:nowrap;align-items:center"><div class="wordmark">SUBLEVEL</div><span class="lvl-sign big">B2</span></div>
      <div class="tagline">BUILD <b>/</b> TRACK <b>/</b> LEARN <b>/</b> HUNT</div>
      <div class="statusline" aria-label="Garage status">${statusLine(v, last)}</div>
    </section>
    ${NS.standalone ? "" : handoff()}
    ${vehicles.length > 1 ? `<div class="chips" style="margin-bottom:12px">${vehicles.map((x) => `<button class="chip" data-act="switch-veh" data-id="${x.id}" aria-pressed="${x.id === v.id}">${esc(x.year + " " + x.model)}</button>`).join("")}</div>` : ""}

    <article class="panel hero brackets">
      <div class="hero-top">
        <div style="min-width:0">
          <div class="eyebrow">PROJECT CAR · ${esc(v.chassis || "")}</div>
          <h1 class="hero-title" style="margin-top:8px">${esc(NS.vehLabel(v))}</h1>
          <div class="hero-sub"><span class="tag solid">${esc(v.engine)}</span><span class="live"><i></i>BUILD STATUS: ${esc(v.status || "IN PROGRESS")}</span></div>
          ${NS.thesisHTML(v)}
        </div>
        <div class="ring-wrap" title="Overall build"><div class="ring" style="--p:${pct}"></div><div class="ring-v"><span>${pct}<span style="font-size:10px">%</span></span></div></div>
      </div>
      ${heroStage(v)}
      <div class="hero-stats">
        <button data-act="edit-mileage"><div class="stat"><div class="k">Mileage</div><div class="v">${num(v.mileage)}</div><div class="s">Tap to update</div></div></button>
        <button data-act="go" data-r="build"><div class="stat"><div class="k">Reliability</div><div class="v ${rel.score >= 85 ? "ok" : rel.score >= 55 ? "warn" : "bad"}">${rel.score}<span style="font-size:14px" class="dim"> /100</span></div><div class="s">${rel.label}${rel.issues.length ? " · " + esc(rel.issues.slice(0, 2).join(", ")) + " open" : ""}</div></div></button>
        <button data-act="go" data-r="money"><div class="stat"><div class="k">Money invested</div><div class="v">${money(NS.invested(v))}</div><div class="s">Car ${money(v.purchasePrice)} + build ${money(NS.spent(v))}</div></div></button>
        <button data-act="edit-vehicle"><div class="stat"><div class="k">Est. value</div><div class="v">${money(v.value)}</div><div class="s">${v.value >= NS.invested(v) ? '<span class="ok">Above</span>' : '<span class="warn">Under</span>'} what you've put in</div></div></button>
      </div>
      <div class="hero-cta">
        <button class="enter" data-act="go" data-r="build">ENTER GARAGE ${icon("arrow")}</button>
        ${S.meta.session ? `<button class="sess-btn on" data-act="session-stop" aria-label="End garage session">${icon("stop")}<span>END</span></button>` : `<button class="sess-btn" data-act="session-start" aria-label="Start garage session timer">${icon("play")}<span>TIMER</span></button>`}
        <button class="sess-btn" data-act="build-card" aria-label="Share build card">${icon("share")}<span>SHARE</span></button>
      </div>
    </article>
    ${NS.backupNudge ? NS.backupNudge() : ""}

    <div class="home-grid">
      ${nextMove(v)}
      <section class="panel" aria-label="Build status">
        <div class="sec-head" style="margin-bottom:16px"><h2 class="h2">Build status</h2><span class="px dim">LIVE · ${esc(v.chassis)}</span></div>
        <div class="bars">
          ${D.systems.map((s) => `<div class="bar-row"><span class="n">${s}</span><div class="seg-wrap" data-p="${sys[s]}">${NS.segBar(sys[s])}</div><span class="p">${sys[s]}%</span></div>`).join("")}
        </div>
        <div class="ascii">SYS.CHK ▸ ${D.systems.length} SYSTEMS ▸ ${pct}% ▸ PHASE 0${phase.id} ▸ ${esc((phase.title || "").toUpperCase())}</div>
        ${rankMini()}
      </section>
    </div>

    <div class="home-grid">${NS.quickHTML(v)}${NS.recapHTML(v)}</div>

    <section class="section" aria-label="Garage telemetry">
      <div class="sec-head"><h2 class="h2">Telemetry</h2><button class="btn sm ghost" data-act="tiles-more">${NS.ui.allTiles ? "Less" : "All 8"} ${icon("chev")}</button></div>
      <div class="tiles">
        <button class="tile" data-act="go" data-r="log"><span class="k">Last garage session</span><span class="v">${last ? NS.daysAgo(last.date) : "—"}</span><span class="s">${last ? esc(last.title) : "Nothing logged yet"}</span></button>
        <button class="tile" data-act="go" data-r="service"><span class="k">Next maintenance</span><span class="v ${nmaint.left < 500 ? "warn" : ""}">${nmaint.at ? num(Math.max(0, nmaint.left)) : "Now"}<span class="dim" style="font-size:13px">${nmaint.at ? " mi" : ""}</span></span><span class="s">${esc(nmaint.label)}${nmaint.at ? " at " + num(nmaint.at) : ""}</span></button>
        <button class="tile" data-act="go" data-r="money"><span class="k">Spent this month</span><span class="v">${money(NS.monthSpent(v))}</span><span class="s">${monthN} purchase${monthN === 1 ? "" : "s"}</span></button>
        <button class="tile" data-act="go" data-r="rank"><span class="k">Hours wrenched</span><span class="v">${NS.hoursWrenched().toFixed(1)}<span class="dim" style="font-size:13px"> h</span></span><span class="s">${S.meta.session ? '<span class="warn">Session running</span>' : "Use the timer to count them"}</span></button>
        ${NS.ui.allTiles ? `
        <button class="tile" data-act="go" data-r="log"><span class="k">Miles since last service</span><span class="v">${svc ? num(v.mileage - svc.mileage) : "—"}<span class="dim" style="font-size:13px"> mi</span></span><span class="s">${svc ? esc(svc.title) + " · " + NS.fmtDate(svc.date) : "No service logged"}</span></button>
        <button class="tile" data-act="go" data-r="build"><span class="k">Current build level</span><span class="v">PHASE 0${phase.id}</span><span class="s">${esc(phase.title)} · ${NS.phasePct(v, phase.id)}%</span></button>
        <button class="tile" data-act="go" data-r="inventory"><span class="k">Parts waiting to install</span><span class="v">${waiting.length}</span><span class="s">${waiting.length ? esc(waiting.map((p) => p.name.replace(/^Audio: /, "")).join(", ")) : "All installed"}</span></button>
        <button class="tile" data-act="go" data-r="rank"><span class="k">Days with the ${esc(v.chassis || v.model)}</span><span class="v">${NS.daysOwned(v)}</span><span class="s">Since ${NS.fmtDate(v.purchaseDate || NS.today())} ${String(v.purchaseDate || "").slice(0, 4)}</span></button>` : ""}
      </div>
    </section>

    <div class="home-grid section">
      <section class="panel flat">
        <div class="sec-head"><h2 class="h2">Garage log</h2><button class="btn sm" data-act="log-new">${icon("plus")}Log</button></div>
        <div class="feed">${log.slice(0, 5).map((l) => `<button class="feed-row" data-act="log-edit" data-id="${l.id}" style="text-align:left;width:100%"><span class="d">${NS.fmtDate(l.date)}</span><span>${esc(l.title)}</span><span class="mono dim" style="font-size:12px">${l.cost ? money(l.cost) : ""}</span></button>`).join("") || '<div class="empty">Log your first garage session.</div>'}</div>
      </section>
      <section class="panel flat">
        <div class="sec-head"><h2 class="h2">On the hunt</h2><button class="btn sm ghost" data-act="go" data-r="hunt">All ${icon("chev")}</button></div>
        ${hunts.length ? hunts.map((h) => { const s = NS.huntScore(h); return `<button class="feed-row" data-act="go" data-r="hunt" style="text-align:left;width:100%;grid-template-columns:48px 1fr auto"><span class="big" style="font-size:26px;color:${NS.scoreColor(s)}">${s}</span><span>${esc(h.year + " " + h.title)}<br><span class="dim" style="font-size:12.5px">${money(h.price)} · ${num(h.miles / 1000)}k mi · ${esc(h.location)}</span></span><span class="px dim">${esc(NS.verdict(s).short)}</span></button>`; }).join("") : '<div class="empty">Save listings to your hunt list and the best ones show up here.</div>'}
      </section>
    </div>

    <footer class="foot"><span>SL-OS 1.0 · LEVEL B2 · ${esc(v.chassis)} · ${esc(v.engine)}</span><button data-act="backup-open" class="px" style="color:inherit;letter-spacing:inherit">DATA SAVED ${esc(NS.where().toUpperCase())} · BACKUP</button></footer>`;
  };

  NS.after.garage = function (opts) {
    if (opts && opts.quiet) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    NS.$$(".seg-wrap").forEach((w, row) => {
      const cells = NS.$$(".seg-bar i", w);
      const cls = cells.map((c) => c.className);
      cells.forEach((c) => (c.className = ""));
      cls.forEach((k, i) => setTimeout(() => (cells[i].className = k), 180 + row * 70 + i * 45));
    });
  };

  /* ---------- actions ---------- */
  NS.acts.noop = () => {};
  NS.acts["switch-veh"] = (el) => { NS.S.meta.active = el.dataset.id; NS.commit("meta"); };
  NS.acts["hero-photo"] = async () => {
    const id = await NS.pickPhoto(); if (!id) return;
    NS.veh().photo = id; NS.commitVeh(); NS.toast("Photo saved");
  };
  NS.acts["edit-mileage"] = () => {
    const v = NS.veh();
    NS.form({ eyebrow: "ODOMETER", title: "Update mileage", value: { mileage: v.mileage }, saveLabel: "Update",
      fields: [{ k: "mileage", l: "Current mileage", t: "number", full: true, min: 0, step: 1 }],
      onSave: (o) => {
        if (o.mileage < v.mileage - 1000) { NS.toast("That's lower than before. Check the number."); }
        v.mileage = Math.round(o.mileage); NS.commitVeh(); NS.toast("Mileage updated");
      } });
  };
  NS.acts["open-job"] = (el) => { NS.ui.openJob = el.dataset.id; NS.go("diy"); };
  NS.acts["open-mod"] = (el) => { if (!el.dataset.id) return; NS.ui.openMods[el.dataset.id] = true; NS.go("build"); setTimeout(() => { const m = document.getElementById("mod-" + el.dataset.id); if (m) m.scrollIntoView({ block: "center" }); }, 60); };
})();
