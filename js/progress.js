/* Progress: XP, rank, badges, streaks, garage sessions, celebrations, boot screen, build card. */
(function () {
  const NS = window.NS, D = window.NS_DATA;
  const { esc, money, num, icon, clamp } = NS;

  /* ---------- XP (derived from the garage, never stored) ---------- */
  NS.xpBreakdown = function () {
    const S = NS.S;
    const p = { Sessions: 0, Mods: 0, Service: 0, Learning: 0, Hunting: 0, Money: 0, Style: 0 };
    for (const v of Object.values(S.vehicles)) {
      v.log.forEach((l) => { p.Sessions += 10 + (l.type === "maint" ? 15 : 0) + Math.min(60, Math.floor((l.minutes || 0) / 6)); });
      v.mods.filter((m) => m.status === "done").forEach((m) => { p.Mods += 30 + (m.diff || 0) * 6; });
      NS.serviceStatus(v).forEach((x) => { if (x.last) p.Service += 10; });
      v.expenses.forEach((e) => { if (e.worth) p.Money += 3; });
    }
    p.Learning += (S.meta.learned || []).length * 40;
    p.Hunting += S.hunt.items.length * 5;
    const total = D.inspection.reduce((a, c) => a + c.items.length, 0);
    Object.values(S.checklist.marks || {}).forEach((m) => { if (Object.keys(m).length >= total * 0.6) p.Hunting += 30; });
    p.Style += S.style.items.length * 2;
    return { total: Object.values(p).reduce((a, b) => a + b, 0), parts: p };
  };
  NS.modXP = (m) => 30 + (m.diff || 0) * 6;
  NS.level = function (xp) {
    const L = D.levels; let i = 0;
    while (i < L.length - 1 && xp >= L[i + 1][0]) i++;
    const floor = L[i][0], next = L[i + 1] ? L[i + 1][0] : null;
    return { n: i + 1, name: L[i][1], floor, next, nextName: L[i + 1] ? L[i + 1][1] : null, pct: next ? (xp - floor) / (next - floor) : 1, toNext: next ? next - xp : 0 };
  };

  /* ---------- streaks + activity ---------- */
  const EPOCH = new Date(1970, 0, 5).getTime(); // a Monday
  const weekKey = (d) => Math.floor((d.getTime() - EPOCH) / 6048e5);
  NS.allLogs = () => Object.values(NS.S.vehicles).flatMap((v) => v.log);
  NS.streak = function () {
    const weeks = new Set(NS.allLogs().map((l) => weekKey(NS.parseDate(l.date))));
    const cur = weekKey(new Date());
    const atRisk = !weeks.has(cur);
    let k = atRisk ? cur - 1 : cur, n = 0;
    while (weeks.has(k)) { n++; k--; }
    return { n, atRisk: atRisk && n > 0 };
  };
  NS.heatmap = function (weeks = 16) {
    const counts = {};
    NS.allLogs().forEach((l) => { counts[l.date] = (counts[l.date] || 0) + 1 + (l.minutes ? Math.min(2, l.minutes / 90) : 0); });
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(today); start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - (weeks - 1) * 7);
    let cells = "";
    for (let w = 0; w < weeks; w++) for (let d = 0; d < 7; d++) {
      const t = new Date(start); t.setDate(start.getDate() + w * 7 + d);
      const key = t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0");
      const c = counts[key] || 0; const lvl = c === 0 ? 0 : c < 1.5 ? 1 : c < 2.5 ? 2 : 3;
      cells += `<i class="h${t > today ? " fut" : ""}" data-l="${lvl}" style="grid-column:${w + 1};grid-row:${d + 1}" title="${NS.fmtDate(key)}${c ? " · garage session" : ""}"></i>`;
    }
    return `<div class="heat" style="--w:${weeks}" role="img" aria-label="Garage activity, last ${weeks} weeks">${cells}</div>`;
  };
  NS.hoursWrenched = () => NS.allLogs().reduce((a, l) => a + (l.minutes || 0), 0) / 60;
  NS.daysOwned = (v) => Math.max(0, Math.round((new Date().setHours(0, 0, 0, 0) - NS.parseDate(v.purchaseDate || NS.today())) / 864e5));
  NS.nextMilestone = (v) => { const step = v.mileage >= 100000 ? 5000 : 1000; const at = Math.ceil((v.mileage + 1) / step) * step; return { at, left: at - v.mileage }; };
  NS.etaDate = (v, miles) => { const d = new Date(); d.setDate(d.getDate() + Math.round(miles / NS.pace(v))); return NS.MON[d.getMonth()] + " " + d.getDate(); };

  /* ---------- badges ---------- */
  const doneMod = (v, re) => v.mods.some((m) => m.status === "done" && re.test(m.title + " " + (m.short || "")));
  NS.badges = [
    { id: "first-oil", n: "FIRST OIL", d: "Changed your own oil.", g: "oil", t: (c) => c.logs.some((l) => (l.tags || []).includes("oil")) },
    { id: "torque", n: "TORQUE SPEC", d: "Wrote a torque spec in the log.", g: "torque", t: (c) => c.logs.some((l) => /lb-?ft|n·?m\b/i.test(l.notes || "")) },
    { id: "hands", n: "HANDS DIRTY", d: "Logged 5 garage sessions.", g: "hands", t: (c) => c.logs.length >= 5, p: (c) => `${Math.min(5, c.logs.length)}/5` },
    { id: "regular", n: "REGULAR", d: "Logged 25 garage sessions.", g: "hands", t: (c) => c.logs.length >= 25, p: (c) => `${Math.min(25, c.logs.length)}/25` },
    { id: "night", n: "NIGHT SHIFT", d: "Started a session after 10pm.", g: "moon", t: (c) => c.logs.some((l) => l.startHour != null && (l.startHour >= 22 || l.startHour < 4)) },
    { id: "stopping", n: "STOPPING POWER", d: "Did your own brake job.", g: "brake", t: (c) => doneMod(c.v, /brake/i) },
    { id: "safety", n: "SAFETY FIRST", d: "Closed every safety item.", g: "shield", t: (c) => c.v.mods.filter((m) => m.safety).every((m) => m.status === "done") },
    { id: "phase1", n: "PHASE 01 CLEAR", d: "The car is reliable. Now it gets fun.", g: "check", t: (c) => NS.phasePct(c.v, 1) === 100 },
    { id: "stance", n: "STANCE", d: "Wheels and lowering done.", g: "wheel", t: (c) => doneMod(c.v, /wheels?:/i) && doneMod(c.v, /lower|coilover/i) },
    { id: "sound", n: "SOUND CHECK", d: "Every audio mod installed.", g: "sound", t: (c) => { const a = c.v.mods.filter((m) => m.system === "AUDIO"); return a.length > 0 && a.every((m) => m.status === "done"); } },
    { id: "miles", n: "1,000 MILES", d: "Drove 1,000 miles since you bought it.", g: "road", t: (c) => c.miles >= 1000, p: (c) => `${num(Math.min(1000, c.miles))}/1,000` },
    { id: "miles10", n: "10K CLUB", d: "10,000 miles since you bought it.", g: "road", t: (c) => c.miles >= 10000, p: (c) => `${num(Math.min(10000, c.miles))}/10,000` },
    { id: "streak4", n: "FOUR WEEKS", d: "A 4-week garage streak.", g: "streak", t: (c) => c.streak >= 4, p: (c) => `${Math.min(4, c.streak)}/4` },
    { id: "streak12", n: "SEASON", d: "A 12-week garage streak.", g: "streak", t: (c) => c.streak >= 12, p: (c) => `${Math.min(12, c.streak)}/12` },
    { id: "budget", n: "UNDER BUDGET", d: "10+ purchases and still under budget.", g: "money", t: (c) => c.v.expenses.length >= 10 && NS.spent(c.v) <= c.v.budget },
    { id: "noregret", n: "NO REGRETS", d: "Five purchases rated 4 or better.", g: "star", t: (c) => c.v.expenses.filter((e) => e.worth >= 4).length >= 5 },
    { id: "hoarder", n: "PARTS HOARDER", d: "Three parts bought and not installed. Go install them.", g: "box", t: (c) => NS.partsWaiting(NS.S).length >= 3 },
    { id: "scholar", n: "SCHOLAR", d: "Learned 5 DIY jobs.", g: "book", t: (c) => c.learned >= 5, p: (c) => `${Math.min(5, c.learned)}/5` },
    { id: "master", n: "MASTER TECH", d: "Learned every DIY job.", g: "book", t: (c) => c.learned >= D.diy.length, p: (c) => `${c.learned}/${D.diy.length}` },
    { id: "hunter", n: "HUNTER", d: "Tracked 10 listings.", g: "hunt", t: (c) => NS.S.hunt.items.length >= 10, p: () => `${Math.min(10, NS.S.hunt.items.length)}/10` },
    { id: "walk", n: "WALKED AWAY", d: "An inspection told you to walk. You listened.", g: "walk", t: () => Object.entries(NS.S.checklist.marks || {}).some(([id, m]) => { const car = NS.S.hunt.items.find((h) => h.id === id); return NS.inspection(m, car ? car.price : 0).call === "WALK AWAY"; }) },
    { id: "deal", n: "DEAL DONE", d: "Bought a car off the hunt list.", g: "key", t: () => NS.S.hunt.items.some((h) => h.status === "bought") },
    { id: "booked", n: "ON SCHEDULE", d: "Every service item has a record.", g: "clock", t: (c) => NS.serviceStatus(c.v).every((x) => x.last) },
    { id: "shot", n: "PHOTO DAY", d: "Added a photo of your car.", g: "camera", t: (c) => !!c.v.photo || c.logs.some((l) => (l.photos || []).length) },
  ];
  NS.badgeCtx = function () {
    const v = NS.veh(); const logs = NS.allLogs();
    const first = v.log.reduce((a, l) => (l.mileage && l.mileage < a ? l.mileage : a), v.mileage);
    return { v, logs, miles: v.mileage - first, streak: NS.streak().n, learned: (NS.S.meta.learned || []).length };
  };
  NS.unlocked = () => { const c = NS.badgeCtx(); return NS.badges.filter((b) => { try { return !!b.t(c); } catch (e) { return false; } }).map((b) => b.id); };
  const G = {
    oil: '<path d="M12 4c3 4 5 6.5 5 9a5 5 0 0 1-10 0c0-2.5 2-5 5-9z"/>',
    torque: '<path d="M4 20 14 10"/><circle cx="17" cy="7" r="3.5"/><path d="M17 5.5v3"/>',
    hands: '<path d="M7 12V6a1.5 1.5 0 0 1 3 0v5M10 11V4.5a1.5 1.5 0 0 1 3 0V11M13 11V6a1.5 1.5 0 0 1 3 0v7a6 6 0 0 1-6 6 5 5 0 0 1-4.5-3L4 12.5a1.5 1.5 0 0 1 2.6-1.4L7 12"/>',
    moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
    brake: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/><path d="M5 8.5c1.5-2.5 4-4 7-4"/>',
    shield: '<path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6z"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    wheel: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2"/><path d="M12 3.5v6.5M12 14v6.5M3.5 12H10M14 12h6.5"/>',
    sound: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 9a4 4 0 0 1 0 6"/>',
    road: '<path d="M9 3 6 21M15 3l3 18M12 4v2M12 10v3M12 17v3"/>',
    streak: '<path d="M4 18h3V9H4zM10.5 18h3V5h-3zM17 18h3v-6h-3z"/>',
    money: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
    star: '<path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z"/>',
    box: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="m3 7.5 9 4.5 9-4.5M12 12v9"/>',
    book: '<path d="M4 5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6z"/>',
    hunt: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    walk: '<path d="M13 4a1.5 1.5 0 1 0 0 .1M10 21l2-6 3 3v3M8 12l3-4 3 2 3 1M11 8l-1 5"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M16 7l2 2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  };
  NS.badgeIcon = (g) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${G[g] || G.star}</svg>`;

  /* ---------- after every edit: XP gains, level ups, new badges ---------- */
  NS.progressInit = function () {
    NS._xp = NS.xpBreakdown().total;
    NS._seen = new Set(NS.S.meta.seenBadges || NS.unlocked());
  };
  NS.progressCheck = function () {
    if (NS._xp == null) return NS.progressInit();
    const xp = NS.xpBreakdown().total; const before = NS._xp; NS._xp = xp;
    const L0 = NS.level(before), L1 = NS.level(xp);
    const now = NS.unlocked(); const fresh = now.filter((id) => !NS._seen.has(id));
    const cel = NS._celebrate; NS._celebrate = null;
    if (fresh.length || !NS.S.meta.seenBadges) {
      fresh.forEach((id) => NS._seen.add(id));
      NS.S.meta.seenBadges = Array.from(NS._seen);
      NS.commit("meta", { silent: true, noProgress: true });
    }
    const badges = fresh.map((id) => NS.badges.find((b) => b.id === id));
    if (cel || L1.n > L0.n) NS.celebrate({ title: cel ? cel.title : "LEVEL UP", kicker: cel ? cel.kicker : "RANK", xp: xp - before, level: L1.n > L0.n ? L1 : null, badges });
    else if (badges.length) NS.celebrate({ title: badges[0].n, kicker: "BADGE UNLOCKED", xp: xp - before, badges, small: true });
    else if (xp > before) NS.xpFloat(xp - before);
  };
  NS.xpFloat = function (n) {
    const el = document.createElement("div"); el.className = "xp-float"; el.textContent = `+${n} XP`;
    document.body.appendChild(el); setTimeout(() => el.remove(), 1600);
  };
  NS.celebrate = function ({ title, kicker, xp, level, badges = [], small }) {
    const el = document.createElement("div");
    el.className = "cele" + (small ? " small" : "");
    el.innerHTML = `<div class="cele-card">
      <div class="px vio">${esc(kicker || "")}</div>
      <div class="cele-title">${esc(title)}</div>
      ${xp > 0 ? `<div class="cele-xp">+${xp} XP</div>` : ""}
      ${level ? `<div class="cele-lvl">LEVEL ${level.n} · ${esc(level.name)}</div>` : ""}
      ${badges.length ? `<div class="cele-badges">${badges.map((b) => `<span class="badge on">${NS.badgeIcon(b.g)}<b>${esc(b.n)}</b></span>`).join("")}</div>` : ""}
      <div class="px dim" style="margin-top:14px">TAP TO CONTINUE</div></div>`;
    el.addEventListener("click", () => el.remove());
    document.body.appendChild(el);
    setTimeout(() => el.classList.add("out"), small ? 2200 : 3200);
    setTimeout(() => el.remove(), small ? 2700 : 3700);
  };

  /* ---------- garage session timer ---------- */
  const fmtDur = (ms) => { const s = Math.floor(ms / 1000); return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((x) => String(x).padStart(2, "0")).join(":"); };
  NS.acts["session-start"] = () => {
    NS.S.meta.session = { start: Date.now(), vid: NS.veh().id };
    NS.commit("meta", { silent: true }); NS.render({ quiet: true }); NS.toast("Session started. Go wrench.");
  };
  NS.acts["session-stop"] = () => {
    const s = NS.S.meta.session; if (!s) return;
    const minutes = Math.max(1, Math.round((Date.now() - s.start) / 60000));
    const startHour = new Date(s.start).getHours();
    if (s.vid && NS.S.vehicles[s.vid]) NS.S.meta.active = s.vid;
    NS.logForm({ prefill: { title: "", type: "maint", minutes, startHour, notes: "" }, onDone: (e) => {
      NS.S.meta.session = null; NS.commit("meta", { silent: true, noProgress: true });
      NS._celebrate = { title: e.title, kicker: `SESSION COMPLETE · ${minutes >= 60 ? Math.floor(minutes / 60) + "H " : ""}${minutes % 60}M` };
    } });
  };
  NS.acts["session-cancel"] = () => { NS.S.meta.session = null; NS.commit("meta", { silent: true }); NS.render({ quiet: true }); };
  setInterval(() => {
    const s = NS.S.meta.session; const el = document.getElementById("sess-t");
    if (s && el) el.textContent = fmtDur(Date.now() - s.start);
  }, 1000);

  /* ---------- chrome: level chip, session chip, sidebar rank ---------- */
  NS.chrome = function () {
    const xp = NS.xpBreakdown().total; const L = NS.level(xp); const s = NS.S.meta.session;
    const chip = document.getElementById("lvl");
    if (chip) chip.innerHTML = `<span class="ring sm" style="--p:${Math.round(L.pct * 100)}"></span><span>LV${L.n}</span>`;
    const sess = document.getElementById("sess");
    if (sess) { sess.hidden = !s; if (s) sess.innerHTML = `<i></i><span id="sess-t">${fmtDur(Date.now() - s.start)}</span>`; }
    const sb = document.getElementById("sb-rank");
    if (sb) sb.innerHTML = `<button class="sb-rank" data-act="go" data-r="rank"><span class="px">LV ${L.n} · ${esc(L.name)}</span><span class="meter"><b style="width:${L.pct * 100}%"></b></span><span class="px dim">${L.next ? num(L.toNext) + " XP TO " + esc(L.nextName) : "MAX RANK"}</span></button>`;
  };

  /* ---------- rank view ---------- */
  NS.views.rank = function () {
    const xb = NS.xpBreakdown(); const L = NS.level(xb.total); const st = NS.streak(); const v = NS.veh();
    const un = new Set(NS.unlocked()); const c = NS.badgeCtx();
    const ms = NS.nextMilestone(v);
    const saved = v.mods.filter((m) => m.status === "done" && (m.actual || m.est) > 0).reduce((a, m) => a + (m.diff || 0) * 0.5 * 120, 0);
    const nm = NS.nextMoves(v)[0];
    const nextXP = nm && nm.mod ? NS.modXP(nm.mod) + 25 : 25;
    const order = NS.badges.slice().sort((a, b) => (un.has(b.id) ? 1 : 0) - (un.has(a.id) ? 1 : 0));
    return `${NS.subnav()}
    <div class="page-head"><div><div class="eyebrow">GARAGE RANK</div><h1 class="h1" style="margin-top:6px">Level ${L.n}: ${esc(L.name)}</h1><p class="lede">XP comes from real work: sessions logged, mods installed, service kept up, jobs learned. It can't be farmed.</p></div>
      <button class="btn" data-act="build-card">${icon("share")}Build card</button></div>
    <div class="home-grid" style="margin-top:0">
      <section class="rank-card">
        <div class="row between"><span class="px vio">CURRENT RANK</span><span class="mono dim" style="font-size:12px">${num(xb.total)} XP</span></div>
        <div class="rank-big"><span class="num">${L.n}</span><div><div class="h-display" style="font-size:clamp(18px,4.6vw,26px)">${esc(L.name)}</div><div class="muted" style="font-size:14px;margin-top:4px">${L.next ? `${num(L.toNext)} XP to <b style="color:var(--fg)">${esc(L.nextName)}</b>` : "Top rank. Respect."}</div></div></div>
        <div class="meter" style="height:8px;margin-top:14px"><b style="width:${L.pct * 100}%"></b></div>
        ${nm && L.next ? `<p class="muted" style="font-size:14px;margin:12px 0 0">Fastest way up: <b style="color:var(--fg)">${esc(nm.title.replace(/\.$/, ""))}</b> is worth about +${nextXP} XP.</p>` : ""}
        <div class="xp-parts">${Object.entries(xb.parts).filter(([, n]) => n > 0).map(([k, n]) => `<span><b class="num">${num(n)}</b> ${k.toUpperCase()}</span>`).join("")}</div>
      </section>
      <section class="panel">
        <div class="sec-head"><h2 class="h2">${st.n}-week streak</h2><span class="px ${st.atRisk ? "warn" : "dim"}">${st.atRisk ? "LOG SOMETHING THIS WEEK" : st.n ? "ACTIVE" : "START ONE"}</span></div>
        ${NS.heatmap(16)}
        <div class="row between" style="margin-top:8px"><span class="px dim">16 WEEKS AGO</span><span class="px dim">THIS WEEK</span></div>
        <div class="grid g2" style="margin-top:16px">
          <div class="stat"><div class="k">Hours wrenched</div><div class="v">${NS.hoursWrenched().toFixed(1)}</div><div class="s">from timed sessions</div></div>
          <div class="stat"><div class="k">Shop labor saved</div><div class="v">≈${money(saved)}</div><div class="s">at a $120/hr shop rate</div></div>
          <div class="stat"><div class="k">Days with the ${esc(v.chassis || v.model)}</div><div class="v">${NS.daysOwned(v)}</div><div class="s">since ${NS.fmtDate(v.purchaseDate || NS.today())}</div></div>
          <div class="stat"><div class="k">Next milestone</div><div class="v">${num(ms.at)}</div><div class="s">${num(ms.left)} mi · around ${NS.etaDate(v, ms.left)}</div></div>
        </div>
      </section>
    </div>
    <section class="section">
      <div class="sec-head"><h2 class="h2">Badges</h2><span class="px dim">${un.size} / ${NS.badges.length} UNLOCKED</span></div>
      <div class="badges">${order.map((b) => { const on = un.has(b.id); return `<div class="badge${on ? " on" : ""}">${NS.badgeIcon(b.g)}<b>${esc(b.n)}</b><span>${esc(b.d)}</span>${!on && b.p ? `<em class="mono">${b.p(c)}</em>` : ""}</div>`; }).join("")}</div>
    </section>`;
  };

  /* ---------- boot screen (once per visit) ---------- */
  NS.boot = function () {
    let seen = true;
    try { seen = sessionStorage.getItem("sublevel.boot") === "1"; sessionStorage.setItem("sublevel.boot", "1"); } catch (e) { seen = true; }
    if (seen || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const v = NS.veh(); const L = NS.level(NS.xpBreakdown().total); const nm = NS.nextMoves(v)[0];
    const lines = [
      "SUBLEVEL OS 1.0 · LEVEL B2",
      "> MOUNTING GARAGE ............ OK",
      `> ${NS.vehLabel(v).toUpperCase()} ... ONLINE`,
      `> ${v.engine} · ${num(v.mileage)} MI · RANK LV${L.n}`,
      `> NEXT MOVE: ${(nm ? nm.title : "ALL CLEAR").toUpperCase()}`,
    ];
    const el = document.createElement("div"); el.className = "boot"; el.setAttribute("aria-hidden", "true");
    el.innerHTML = `<pre></pre>`; document.body.appendChild(el);
    const pre = el.firstChild; let i = 0;
    const step = () => { if (i < lines.length) { pre.textContent += (i ? "\n" : "") + lines[i++]; setTimeout(step, 190); } else { setTimeout(() => el.classList.add("out"), 380); setTimeout(() => el.remove(), 800); } };
    el.addEventListener("click", () => el.remove());
    setTimeout(step, 80);
  };

  /* ---------- build card (PNG for stories) ---------- */
  NS.acts["build-card"] = async () => {
    NS.sheet(NS.sheetHead("SHARE", "Build card") + `<div id="card-out" class="empty">Rendering…</div>`);
    try {
      const blob = await renderCard();
      const url = URL.createObjectURL(blob);
      const out = document.getElementById("card-out"); if (!out) return;
      out.className = ""; out.innerHTML = `<img src="${url}" alt="Build card" style="width:100%;border-radius:14px;border:1px solid var(--line-2)">
        <div class="sheet-foot">${NS.downloads ? `<button class="btn primary grow" data-act="card-save">${icon("share")}Save image</button>` : `<p class="dim" style="font-size:13px;margin:0">Press and hold the image to save it.</p>`}</div>`;
      NS._card = blob;
    } catch (e) { const out = document.getElementById("card-out"); if (out) out.textContent = "Couldn't render the card on this device."; }
  };
  NS.acts["card-save"] = async () => {
    try { await NS.downloads.save({ filename: "sublevel-build-card.png", data: NS._card }); } catch (e) { if (e && e.code !== "cancelled") NS.toast("Save was blocked. Press and hold the image instead."); }
  };
  async function renderCard() {
    const v = NS.veh(); const W = 1080, H = 1350;
    try { await document.fonts.ready; } catch (e) {}
    const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
    x.fillStyle = "#060609"; x.fillRect(0, 0, W, H);
    let g = x.createRadialGradient(820, 80, 20, 820, 80, 700); g.addColorStop(0, "rgba(106,61,240,.35)"); g.addColorStop(1, "rgba(106,61,240,0)"); x.fillStyle = g; x.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 3) { x.fillStyle = "rgba(255,255,255,.012)"; x.fillRect(0, y, W, 1); }
    const chrome = (y0, y1) => { const cg = x.createLinearGradient(0, y0, 0, y1); cg.addColorStop(0, "#f5f5f8"); cg.addColorStop(.45, "#cfcdd8"); cg.addColorStop(.52, "#5c5a68"); cg.addColorStop(1, "#e9e8ef"); return cg; };
    x.textBaseline = "alphabetic";
    x.font = '64px Michroma, "Arial Black", sans-serif'; x.fillStyle = chrome(70, 140); x.fillText("SUBLEVEL", 72, 140);
    x.font = '500 22px "JetBrains Mono", monospace'; x.fillStyle = "#aaa6b8"; x.fillText("BUILD  /  TRACK  /  LEARN  /  HUNT", 76, 186);
    x.font = '400 18px Silkscreen, monospace'; x.fillStyle = "#a98cff"; x.fillText(`PROJECT · ${v.chassis || ""} · ${new Date().getFullYear()}`, 76, 268);
    x.font = '40px Michroma, sans-serif'; x.fillStyle = "#ecebf2"; const ty = wrap(x, NS.vehLabel(v).toUpperCase(), 76, 322, 930, 52);
    x.font = '500 26px "Barlow Semi Condensed", sans-serif'; x.fillStyle = "#aaa6b8"; x.fillText(`${v.engine} · ${num(v.mileage)} MI · ${v.status || "IN PROGRESS"}`, 76, ty + 48);
    // car
    const img = await loadImg(v.photo ? NS.img(v.photo) : URL.createObjectURL(new Blob([NS.carSVG({ id: "card", dia: v.wheel?.dia || 14, od: odOf(v), drop: v.wheel?.drop || 0, paint: v.paintHex })], { type: "image/svg+xml" })));
    if (v.photo) { const r = Math.max(W / img.width, 420 / img.height); x.save(); x.beginPath(); x.rect(0, 470, W, 420); x.clip(); x.drawImage(img, (W - img.width * r) / 2, 470 + (420 - img.height * r) / 2, img.width * r, img.height * r); x.restore(); }
    else x.drawImage(img, 20, 460, 1040, 400);
    // stats
    const L = NS.level(NS.xpBreakdown().total);
    const stats = [["BUILD", NS.buildPct(v) + "%"], ["INVESTED", money(NS.invested(v))], ["RANK", "LV" + L.n]];
    stats.forEach(([k, val], i) => {
      const sx = 76 + i * 320;
      x.font = '400 16px Silkscreen, monospace'; x.fillStyle = "#716c84"; x.fillText(k, sx, 940);
      x.font = '600 64px "Barlow Semi Condensed", sans-serif'; x.fillStyle = "#ecebf2"; x.fillText(val, sx, 1004);
    });
    const sys = NS.systemPct(v);
    D.systems.forEach((s, i) => {
      const y = 1060 + i * 34; x.font = '500 18px "JetBrains Mono", monospace'; x.fillStyle = "#aaa6b8"; x.fillText(s, 76, y + 15);
      for (let k = 0; k < 10; k++) { x.fillStyle = k < Math.round(sys[s] / 10) ? "#8b6cff" : "rgba(255,255,255,.07)"; roundRect(x, 270 + k * 52, y, 46, 18, 3); }
      x.fillStyle = "#ecebf2"; x.textAlign = "right"; x.fillText(sys[s] + "%", 1004, y + 15); x.textAlign = "left";
    });
    x.strokeStyle = "rgba(214,206,240,.16)"; x.beginPath(); x.moveTo(76, 1278); x.lineTo(1004, 1278); x.stroke();
    x.font = '400 16px Silkscreen, monospace'; x.fillStyle = "#716c84"; x.fillText("LEVEL B2 · PRIVATE GARAGE", 76, 1312);
    x.textAlign = "right"; x.fillText(NS.fmtDate(NS.today()) + " " + new Date().getFullYear(), 1004, 1312); x.textAlign = "left";
    return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej()), "image/png"));
  }
  const odOf = (v) => { const t = NS.parseTire(v.wheel?.tire); return t ? NS.tireOD(t.dia, t.tw, t.ar) : 596; };
  const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  function roundRect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.fill(); }
  function wrap(x, text, a, b, maxW, lh) {
    const words = text.split(" "); let line = ""; let y = b;
    for (const w of words) { const t = line ? line + " " + w : w; if (x.measureText(t).width > maxW && line) { x.fillText(line, a, y); line = w; y += lh; } else line = t; }
    x.fillText(line, a, y);
    return y;
  }
})();
