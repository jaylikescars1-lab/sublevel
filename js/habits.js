/* Habits: a one-line build goal, picking a day for the next move, nightly quick wins, weekly recap, unlockable scenes. */
(function () {
  const NS = window.NS;
  const { esc, num, money, icon } = NS;
  const DAY = 864e5;
  const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const label = (s) => { const d = NS.parseDate(s); return `${DOW[d.getDay()]} ${NS.fmtDate(s)}`; };

  /* ---------- scenes ---------- */
  NS.currentScene = function () {
    const L = NS.level(NS.xpBreakdown().total);
    const pick = NS.S.meta.scene; const sc = NS.scenes.find((x) => x.id === pick);
    if (sc && L.n >= sc.lvl) return sc.id;
    return L.n >= 2 ? "b2" : "studio";
  };
  NS.acts["scene-pick"] = () => {
    const L = NS.level(NS.xpBreakdown().total); const cur = NS.currentScene(); const v = NS.veh();
    NS.sheet(NS.sheetHead("GARAGE SCENE", "Where the car sits") + `<div class="scene-grid">${NS.scenes.map((sc) => {
      const open = L.n >= sc.lvl;
      return `<button class="scene-tile${sc.id === cur ? " on" : ""}" ${open ? `data-act="scene-set" data-id="${sc.id}"` : "disabled"} aria-label="${esc(sc.n)}">
        <div class="scene-art">${NS.carSVG({ id: "sc" + sc.id, crop: true, scene: sc.id === "studio" ? null : sc.id, paint: v.paintHex, reflection: false, dia: v.wheel?.dia || 14 })}${open ? "" : `<div class="lock"><span class="px">UNLOCKS AT LV ${sc.lvl}</span></div>`}</div>
        <div class="row between" style="padding:8px 10px"><span class="h-display" style="font-size:11px">${esc(sc.n.toUpperCase())}</span><span class="px dim">${open ? (sc.id === cur ? "ACTIVE" : "LV " + sc.lvl) : "LOCKED"}</span></div>
        <div class="dim" style="font-size:12.5px;padding:0 10px 10px;text-align:left">${esc(sc.d)}</div></button>`;
    }).join("")}</div><p class="dim" style="font-size:13px;margin:12px 0 0">New scenes unlock as your garage rank goes up.</p>`);
  };
  NS.acts["scene-set"] = (el) => { NS.S.meta.scene = el.dataset.id; NS.closeSheet(); NS.commit("meta"); };
  NS.acts["hero-view"] = (el) => { NS.ui.heroView = el.dataset.k; NS.render({ quiet: true, keepScroll: true }); };

  /* ---------- the one-line build goal ---------- */
  NS.thesisHTML = (v) => v.thesis
    ? `<button class="thesis" data-act="thesis-edit" title="Edit your build goal">“${esc(v.thesis)}”</button>`
    : `<button class="thesis-empty" data-act="thesis-edit">${icon("edit")}Write the one-line plan for this car</button>`;
  NS.acts["thesis-edit"] = () => {
    const v = NS.veh();
    NS.form({ eyebrow: "BUILD GOAL", title: "What is this car going to be?", value: { thesis: v.thesis || "" },
      fields: [{ k: "thesis", l: "One sentence. You'll see it every time you open the garage.", t: "textarea", ph: "Clean black EJ on bronze 15s. Low, quiet, and reliable enough to drive every day." }],
      onSave: (o) => { v.thesis = o.thesis.slice(0, 180); NS.commitVeh(); } });
  };

  /* ---------- pick a day for the next move ---------- */
  NS.commitHTML = function (m, v) {
    const c = v.commit && v.commit.target === m.id ? v.commit : null;
    if (!c) return `<button class="btn" data-act="commit-pick" data-id="${m.id}">${icon("clock")}Pick a day</button>`;
    const days = Math.round((NS.parseDate(c.date) - new Date().setHours(0, 0, 0, 0)) / DAY);
    if (days < 0) return `<span class="commit missed">${icon("clock")}PLANNED FOR ${label(c.date)} · MISSED</span><button class="btn sm" data-act="commit-pick" data-id="${m.id}">Move it</button>`;
    const when = days === 0 ? (new Date().getHours() >= 16 ? "TONIGHT" : "TODAY") : days === 1 ? "TOMORROW" : `IN ${days} DAYS`;
    return `<button class="commit" data-act="commit-pick" data-id="${m.id}" title="Change the day">${icon("check")}LOCKED IN · ${label(c.date)} · ${when}</button>`;
  };
  NS.acts["commit-pick"] = (el) => {
    const id = el.dataset.id; const t = new Date(); t.setHours(0, 0, 0, 0);
    const opts = []; const add = (l, d) => opts.push([l, iso(d)]);
    add(new Date().getHours() >= 16 ? "Tonight" : "Today", t);
    const tm = new Date(t.getTime() + DAY); add("Tomorrow", tm);
    for (const [name, dow] of [["Saturday", 6], ["Sunday", 0]]) { const d = new Date(t); d.setDate(d.getDate() + (((dow - d.getDay()) + 7) % 7 || 7)); if (!opts.some((o) => o[1] === iso(d))) add("This " + name, d); }
    const ns = new Date(t); ns.setDate(ns.getDate() + (((6 - ns.getDay()) + 7) % 7 || 7) + 7); add("Next Saturday", ns);
    NS.sheet(NS.sheetHead("PICK A DAY", "When are you doing it?") + `<p class="muted" style="margin:0 0 14px;font-size:14.5px">A job with a day on it gets done. Pick one and it shows up in the garage as a promise to yourself.</p>
      <div class="day-grid">${opts.map(([l, d]) => `<button class="day" data-act="commit-set" data-id="${id}" data-date="${d}"><b>${esc(l)}</b><span class="mono">${label(d)}</span></button>`).join("")}</div>
      <div class="field" style="margin-top:12px"><label for="commit-date">Or pick a date</label><input class="input" type="date" id="commit-date" min="${iso(t)}"></div>
      <div class="sheet-foot">${NS.veh().commit ? `<button class="btn ghost" data-act="commit-clear">Clear</button>` : ""}<span class="grow"></span><button class="btn primary" data-act="commit-set" data-id="${id}" data-from="input">Lock it in</button></div>`);
  };
  NS.acts["commit-set"] = (el) => {
    const date = el.dataset.from === "input" ? document.getElementById("commit-date").value : el.dataset.date;
    if (!date) { NS.toast("Pick a day first"); return; }
    NS.veh().commit = { target: el.dataset.id, date, set: NS.today() };
    NS.closeSheet(); NS.commitVeh(); NS.toast(`Locked in for ${label(date)}.`);
  };
  NS.acts["commit-clear"] = () => { NS.veh().commit = null; NS.closeSheet(); NS.commitVeh(); };

  /* ---------- quick wins: three five-minute checks a day ---------- */
  const POOL = [
    ["tires", "Check tire pressures", "Spec is on the driver door jamb. Check them cold.", "Checked tire pressures"],
    ["oil", "Check the oil level", "Engine off five minutes, level ground. Between the dots.", "Checked oil level"],
    ["coolant", "Check the coolant overflow", "Cold engine only. Between MIN and MAX.", "Checked coolant level"],
    ["lights", "Walk-around light check", "Headlights, brakes, signals, reverse. Use a wall or a friend.", "Checked all lights"],
    ["drips", "Look under the car for drips", "Fresh spots? Note the color: brown oil, green or blue coolant, red ATF.", "Checked for leaks"],
    ["wipers", "Check the wiper blades", "Streaks or chatter means replace them.", "Checked wiper blades"],
    ["brakefl", "Check brake fluid level and color", "Clear to amber is fine. Dark means it's due for a flush.", "Checked brake fluid"],
    ["washer", "Top off washer fluid", "Cheap, and you'll want it on the next dirty night.", "Topped off washer fluid"],
    ["glass", "Clean the inside of the glass", "A hazy windshield is half of night-driving glare.", "Cleaned inside glass"],
    ["mats", "Shake out the floor mats", "Five minutes, feels like a different car.", "Cleaned floor mats"],
    ["battery", "Check the battery terminals", "White crust means a baking soda and brush job.", "Checked battery terminals"],
    ["belts", "Look over the belts", "Cracks across the ribs or a shiny glaze means plan a replacement.", "Inspected belts"],
    ["photo", "Photograph the engine bay", "Before photos are what make the after photos hit.", "Photographed the engine bay"],
    ["tread", "Penny-test the tread", "Lincoln's whole head visible means the tires are done.", "Checked tread depth"],
    ["lugs", "Check lug nut torque", "Especially after wheel work. 80 lb-ft in a star pattern.", "Checked lug torque"],
    ["air", "Look at the air filter", "Hold it up to a light. No light through it means replace it.", "Checked air filter"],
    ["dash", "Wipe down the dash and gauges", "Detail work counts. It's your office.", "Detailed the dash"],
    ["read", "Read one DIY guide", "Ten minutes of reading saves an hour of wrenching.", "Read a DIY guide"],
  ];
  const pick3 = (day, vid) => {
    let h = 2166136261; for (const ch of day + vid) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    let seed = (h >>> 0) || 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const idx = POOL.map((_, i) => i); for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    return idx.slice(0, 3).map((i) => POOL[i]);
  };
  NS.quickWins = function (v) {
    const day = NS.today();
    return pick3(day, v.id).map(([id, t, why, log]) => ({ id, t, why, log, done: v.log.some((l) => l.date === day && (l.tags || []).includes("q-" + id)) }));
  };
  NS.quickHTML = function (v) {
    const q = NS.quickWins(v); const n = q.filter((x) => x.done).length; const h = new Date().getHours();
    const when = h >= 17 || h < 4 ? "TONIGHT'S" : "TODAY'S";
    return `<section class="panel quick" aria-label="Quick wins">
      <div class="sec-head" style="margin-bottom:10px"><h2 class="h2">${when} quick wins</h2><span class="px ${n === 3 ? "ok" : "dim"}">${n}/3 · 5 MIN EACH</span></div>
      <div class="qw">${q.map((x) => `<button class="qw-row${x.done ? " done" : ""}" data-act="quick-do" data-id="${x.id}" ${x.done ? 'aria-pressed="true"' : ""}>
        <span class="qw-box">${x.done ? icon("check") : ""}</span><span style="min-width:0"><b>${esc(x.t)}</b><small>${esc(x.why)}</small></span><span class="px ${x.done ? "ok" : "vio"}">${x.done ? "DONE" : "+10 XP"}</span></button>`).join("")}</div>
      <div class="meter" style="margin-top:12px"><b style="width:${(n / 3) * 100}%"></b></div>
      <p class="dim" style="font-size:12.5px;margin:8px 0 0">${n === 3 ? "Clean sweep. New ones tomorrow." : "Short on time? These still count toward your streak."}</p>
    </section>`;
  };
  NS.acts["quick-do"] = (el) => {
    const v = NS.veh(); const id = el.dataset.id; const day = NS.today();
    const q = NS.quickWins(v).find((x) => x.id === id); if (!q) return;
    if (q.done) { v.log = v.log.filter((l) => !(l.date === day && (l.tags || []).includes("q-" + id))); NS.commitVeh(); return; }
    v.log.push({ id: NS.uid("l"), date: day, title: q.log, type: "note", mileage: v.mileage, cost: 0, minutes: 5, notes: "", photos: [], tags: ["quick", "q-" + id] });
    if (NS.quickWins(v).every((x) => x.done)) NS._celebrate = { title: "CLEAN SWEEP", kicker: "ALL THREE QUICK WINS" };
    NS.commitVeh();
  };

  /* ---------- weekly recap (this week vs last) ---------- */
  NS.weekStats = function (v, offset = 0) {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const mon = new Date(t); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7) - offset * 7);
    const end = new Date(mon.getTime() + 7 * DAY);
    const inW = (s) => { const d = NS.parseDate(s); return d >= mon && d < end; };
    const logs = v.log.filter((l) => inW(l.date));
    const mods = v.mods.filter((m) => m.status === "done" && m.doneDate && inW(m.doneDate));
    const xp = logs.reduce((a, l) => a + 10 + (l.type === "maint" ? 15 : 0) + Math.min(60, Math.floor((l.minutes || 0) / 6)), 0) + mods.reduce((a, m) => a + NS.modXP(m), 0);
    return { sessions: logs.length, minutes: logs.reduce((a, l) => a + (l.minutes || 0), 0), spent: v.expenses.filter((e) => inW(e.date)).reduce((a, e) => a + (+e.amount || 0), 0), xp, mods: mods.length, mon };
  };
  NS.recapHTML = function (v) {
    const a = NS.weekStats(v, 0), b = NS.weekStats(v, 1);
    const d = new Date(); const fresh = d.getDay() === 1 || d.getDate() <= 2;
    const delta = (x, y, invert) => { if (x === y) return `<span class="dim">same as last week</span>`; const up = x > y; const good = invert ? !up : up; return `<span class="${good ? "ok" : "warn"}">${up ? "↑" : "↓"} ${invert ? money(Math.abs(x - y)) : num(Math.abs(x - y))} vs last week</span>`; };
    const h = Math.floor(a.minutes / 60), m = a.minutes % 60;
    return `<section class="panel recap" aria-label="This week">
      <div class="sec-head" style="margin-bottom:12px"><h2 class="h2">${fresh ? "New week" : "This week"}</h2><span class="px ${fresh ? "vio" : "dim"}">${fresh ? "FRESH START · " : ""}WEEK OF ${NS.fmtDate(iso(a.mon))}</span></div>
      <div class="grid g2">
        <div class="stat"><div class="k">XP earned</div><div class="v vio">+${num(a.xp)}</div><div class="s">${delta(a.xp, b.xp)}</div></div>
        <div class="stat"><div class="k">Sessions</div><div class="v">${a.sessions}</div><div class="s">${delta(a.sessions, b.sessions)}</div></div>
        <div class="stat"><div class="k">Garage time</div><div class="v">${h ? h + "h " : ""}${m}m</div><div class="s">${a.mods ? `${a.mods} mod${a.mods > 1 ? "s" : ""} finished` : "No mods finished yet"}</div></div>
        <div class="stat"><div class="k">Spent</div><div class="v">${money(a.spent)}</div><div class="s">${delta(a.spent, b.spent, true)}</div></div>
      </div>
      ${fresh && !a.sessions ? `<p class="muted" style="font-size:14px;margin:12px 0 0">Clean slate. One logged session this week keeps your streak alive.</p>` : ""}
    </section>`;
  };
})();
