/* TRACK (log, money, inventory), LEARN (DIY), BUILD style board. */
(function () {
  const NS = window.NS, D = window.NS_DATA;
  const { esc, money, num, icon } = NS;
  const TYPES = [{ v: "maint", l: "SERVICE" }, { v: "mod", l: "MOD" }, { v: "buy", l: "PURCHASE" }, { v: "note", l: "NOTE" }];

  /* ================= LOG ================= */
  NS.logForm = function ({ prefill = {}, entry = null, expenseCat = "Maintenance", onDone } = {}) {
    const v = NS.veh();
    const svcName = (id) => (D.service.find((x) => x.id === id) || {}).name;
    const base = entry ? { ...entry } : { date: NS.today(), type: "maint", mileage: v.mileage, cost: 0, notes: "", photos: [], addExpense: true, cat: expenseCat, minutes: 0, ...prefill };
    const value = { ...base, svc: (base.tags || []).map(svcName).filter(Boolean) };
    const fields = [
      { k: "title", l: "What did you do", t: "text", full: true, ph: "Changed oil" },
      { k: "type", l: "Type", t: "seg", o: TYPES },
      { k: "date", l: "Date", t: "date" }, { k: "mileage", l: "Mileage", t: "number", step: 1 },
      { k: "cost", l: "Cost", t: "money" }, { k: "minutes", l: "Time in the garage (min)", t: "number", step: 5 },
      { k: "svc", l: "Service covered (resets the schedule)", t: "multi", o: D.service.map((x) => x.name) },
      { k: "notes", l: "Notes", t: "textarea", ph: "Torque specs, what went wrong, what you'd do differently" },
      { k: "photos", l: "Photos", t: "photos" },
    ];
    if (!entry) fields.splice(6, 0, { k: "addExpense", l: "Also add the cost to the Money tracker", t: "check" }, { k: "cat", l: "Money category", t: "select", o: D.expenseCats });
    NS.form({ eyebrow: entry ? "GARAGE LOG" : "NEW LOG ENTRY", title: entry ? entry.title : "Log a garage session", fields, value,
      onSave: (o) => {
        if (!o.title) { NS.toast("Say what you did"); return false; }
        const svcIds = (o.svc || []).map((n) => (D.service.find((x) => x.name === n) || {}).id).filter(Boolean);
        const rec = { id: entry ? entry.id : NS.uid("l"), date: o.date, title: o.title, type: o.type || "note", mileage: Math.round(o.mileage) || 0, cost: o.cost || 0, minutes: Math.round(o.minutes) || 0, notes: o.notes, photos: o.photos || [],
          tags: (entry?.tags || []).filter((t) => !D.service.some((x) => x.id === t)).concat(svcIds) };
        if (base.startHour != null) rec.startHour = base.startHour;
        if (entry) Object.assign(entry, rec); else v.log.push(rec);
        if (rec.mileage > v.mileage) v.mileage = rec.mileage;
        if (!entry && o.addExpense && rec.cost > 0) v.expenses.push({ id: NS.uid("e"), date: rec.date, item: rec.title, amount: rec.cost, cat: o.cat, worth: 0 });
        if (onDone) onDone(rec);
        NS.commitVeh(); NS.toast(entry ? "Entry saved" : "Logged");
      },
      onDelete: entry ? () => { v.log = v.log.filter((x) => x !== entry); NS.commitVeh(); NS.toast("Entry deleted"); } : null });
  };
  NS.acts["log-new"] = (el) => {
    const preset = el && el.dataset && el.dataset.preset;
    const d = preset && D.service.find((x) => x.id === preset);
    if (preset === "oil") NS.logForm({ prefill: { title: "Changed oil", type: "maint", cost: 40, tags: ["oil"], notes: "" } });
    else if (d) NS.logForm({ prefill: { title: d.name, type: "maint", cost: d.cost || 0, tags: [d.id], notes: "" } });
    else NS.logForm();
  };
  NS.acts["log-edit"] = (el) => { const e = NS.veh().log.find((x) => x.id === el.dataset.id); if (e) NS.logForm({ entry: e }); };

  NS.views.log = function () {
    const v = NS.veh(); const log = NS.sortedLog(v);
    const f = NS.ui.logType || "all";
    const quick = (l) => (l.tags || []).includes("quick");
    const list = log.filter((l) => (f === "checks" ? quick(l) : !quick(l) && (f === "all" || l.type === f)));
    let lastMonth = "";
    const total = log.reduce((a, l) => a + (l.type === "buy" && /bought the car/i.test(l.title) ? 0 : +l.cost || 0), 0);
    return `${NS.subnav()}
    <div class="page-head"><div><div class="eyebrow">GARAGE LOG · ${esc(v.chassis)}</div><h1 class="h1" style="margin-top:6px">Build journal</h1><p class="lede">Every session, every mile, every receipt. Future you will want to know the torque spec you used.</p></div>
      <div class="row">${NS.S.meta.session ? `<button class="btn" data-act="session-stop">${icon("stop")}End session</button>` : `<button class="btn" data-act="session-start">${icon("play")}Start timer</button>`}<button class="btn primary" data-act="log-new">${icon("plus")}Log session</button></div></div>
    <div class="kv" style="margin-bottom:16px">
      <div><div class="k">ENTRIES</div><div class="v">${log.length}</div></div>
      <div><div class="k">MILES LOGGED</div><div class="v">${log.length ? num(v.mileage - Math.min(...log.map((l) => l.mileage || v.mileage))) : 0}</div></div>
      <div><div class="k">LOGGED SPEND</div><div class="v">${money(total)}</div></div>
      <div><div class="k">LAST SESSION</div><div class="v" style="font-size:15px;padding-top:4px">${log[0] ? NS.daysAgo(log[0].date).toUpperCase() : "—"}</div></div>
    </div>
    <div class="chips">${[["all", "All"]].concat(TYPES.map((t) => [t.v, t.l[0] + t.l.slice(1).toLowerCase()])).concat([["checks", "Quick checks"]]).map(([k, l]) => `<button class="chip" data-act="log-type" data-k="${k}" aria-pressed="${f === k}">${l}</button>`).join("")}</div>
    <div class="timeline">${list.map((l) => {
      const d = NS.parseDate(l.date); const mk = NS.MON[d.getMonth()] + " " + d.getFullYear();
      const head = mk !== lastMonth ? `<div class="month">${mk}</div>` : ""; lastMonth = mk;
      return `${head}<button class="entry" data-type="${l.type}" data-act="log-edit" data-id="${l.id}" style="text-align:left;width:100%">
        <div class="date"><div class="mm">${NS.MON[d.getMonth()]}</div><div class="dd num">${String(d.getDate()).padStart(2, "0")}</div></div>
        <div class="body"><div class="row between" style="gap:8px"><span class="t">${esc(l.title)}</span><span class="tag">${(TYPES.find((t) => t.v === l.type) || TYPES[3]).l}</span></div>
          <div class="m">${l.mileage ? `<span>${num(l.mileage)} MI</span>` : ""}${l.cost ? `<span>${money(l.cost)}</span>` : ""}${l.minutes ? `<span>${l.minutes >= 60 ? Math.floor(l.minutes / 60) + "H " : ""}${l.minutes % 60}M</span>` : ""}${(l.tags || []).map((t) => (D.service.find((x) => x.id === t) || {}).name).filter(Boolean).map((n) => `<span class="vio">${esc(n.toUpperCase())}</span>`).join("")}</div>
          ${l.notes ? `<div class="n">${esc(l.notes)}</div>` : ""}
          ${(l.photos || []).length ? `<div class="photos" style="margin-top:8px">${l.photos.map((p) => `<img src="${NS.img(p)}" alt="" loading="lazy">`).join("")}</div>` : ""}
        </div></button>`;
    }).join("") || '<div class="empty" style="margin-top:16px">No entries yet. Log what you did today, even if it was just checking the oil.</div>'}</div>`;
  };
  NS.acts["log-type"] = (el) => { NS.ui.logType = el.dataset.k; NS.render({ quiet: true }); };

  /* ================= MONEY ================= */
  NS.expenseForm = function (value, existing) {
    const v = NS.veh();
    NS.form({ eyebrow: "MONEY", title: existing ? existing.item : "Add expense", value,
      fields: [
        { k: "item", l: "What did you buy", t: "text", full: true }, { k: "amount", l: "Amount", t: "money" },
        { k: "date", l: "Date", t: "date" }, { k: "cat", l: "Category", t: "select", o: D.expenseCats, full: true },
        { k: "worth", l: "Was it actually worth it? (0 = not sure yet)", t: "range", min: 0, max: 5 },
        { k: "note", l: "Notes", t: "textarea" },
      ],
      onSave: (o) => {
        if (!o.item) return false;
        if (existing) Object.assign(existing, o); else v.expenses.push({ id: NS.uid("e"), ...o });
        NS.commitVeh(); NS.toast(existing ? "Expense saved" : `${money(o.amount)} logged`);
      },
      onDelete: existing ? () => { v.expenses = v.expenses.filter((x) => x !== existing); NS.commitVeh(); } : null });
  };
  NS.views.money = function () {
    const v = NS.veh(); const spent = NS.spent(v); const rem = (v.budget || 0) - spent;
    const by = Object.fromEntries(D.expenseCats.map((c) => [c, 0]));
    v.expenses.forEach((e) => { by[e.cat] = (by[e.cat] || 0) + (+e.amount || 0); });
    const max = Math.max(1, ...Object.values(by));
    const rated = v.expenses.filter((e) => e.worth > 0);
    const avg = rated.length ? rated.reduce((a, e) => a + e.worth, 0) / rated.length : 0;
    const regrets = rated.filter((e) => e.worth <= 2);
    const list = v.expenses.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    const pct = v.budget ? Math.min(100, (spent / v.budget) * 100) : 0;
    return `${NS.subnav()}
    <div class="page-head"><div><div class="eyebrow">MONEY TRACKER</div><h1 class="h1" style="margin-top:6px">Build budget</h1><p class="lede">Purchase price not included. This is what the build has cost so far.</p></div>
      <div class="row"><button class="btn" data-act="budget-edit">${icon("edit")}Budget</button>${NS.sampleImages ? `<button class="btn" data-act="receipt-scan">${icon("receipt")}Scan receipt</button>` : ""}<button class="btn primary" data-act="exp-add">${icon("plus")}Expense</button></div></div>
    <div class="budget-hero">
      <button data-act="budget-edit" style="text-align:left"><div class="lbl">Build budget</div><div class="big">${money(v.budget)}</div></button>
      <div><div class="lbl">Spent</div><div class="big">${money(spent)}</div></div>
      <div><div class="lbl">Remaining</div><div class="big ${rem < 0 ? "bad" : rem < (v.budget || 0) * 0.2 ? "warn" : "ok"}">${money(rem)}</div></div>
    </div>
    <div class="meter ${pct > 90 ? "bad" : pct > 75 ? "warn" : ""}" style="margin-top:12px;height:8px"><b style="width:${pct}%"></b></div>
    <div class="row between" style="margin-top:6px"><span class="px dim">${Math.round(pct)}% USED</span><span class="px dim">THIS MONTH ${money(NS.monthSpent(v))}</span></div>

    <div class="home-grid section">
      <section class="panel">
        <div class="sec-head"><h2 class="h2">Where it went</h2></div>
        ${D.expenseCats.map((c) => `<div class="cat-row"><span class="n">${c.toUpperCase()}</span><div class="meter"><b style="width:${(by[c] / max) * 100}%"></b></div><span class="a">${money(by[c])}</span></div>`).join("")}
      </section>
      <section class="panel">
        <div class="sec-head"><h2 class="h2">Worth it?</h2><span class="px dim">${rated.length}/${v.expenses.length} RATED</span></div>
        <div class="grid g2">
          <div class="stat"><div class="k">Average rating</div><div class="v">${avg ? avg.toFixed(1) : "—"}<span class="dim" style="font-size:14px"> /5</span></div><div class="s">${avg >= 4 ? "You buy smart." : avg >= 3 ? "Mostly good calls." : avg ? "Some regret in here." : "Rate purchases below."}</div></div>
          <div class="stat"><div class="k">Regrets</div><div class="v ${regrets.length ? "bad" : ""}">${regrets.length}</div><div class="s">${regrets.length ? esc(regrets.map((r) => r.item).join(", ")) : "None yet"}</div></div>
        </div>
        <p class="dim" style="font-size:13px;margin:14px 0 0">Rate after you've lived with it for a week, not the day it arrives.</p>
      </section>
    </div>

    <section class="section">
      <div class="sec-head"><h2 class="h2">Every purchase</h2></div>
      ${list.map((e) => `<div class="exp">
        <span class="d">${NS.fmtDate(e.date)}</span>
        <div style="min-width:0"><button data-act="exp-edit" data-id="${e.id}" style="text-align:left;font-weight:600;font-size:15px">${esc(e.item)}</button><div class="dim" style="font-size:12.5px">${esc(e.cat)}</div>
          <div class="worth" role="group" aria-label="Was it worth it?">${[1, 2, 3, 4, 5].map((n) => `<button class="${e.worth >= n ? "on" + (e.worth <= 2 ? " lo" : "") : ""}" data-act="worth" data-id="${e.id}" data-n="${n}" aria-label="${D.worthLabels[n]}">${n}</button>`).join("")}<span>${e.worth ? D.worthLabels[e.worth] : "Worth it?"}</span></div></div>
        <span class="a">${money(e.amount)}</span>
      </div>`).join("") || '<div class="empty">No expenses yet.</div>'}
    </section>`;
  };
  NS.acts["exp-add"] = () => NS.expenseForm({ date: NS.today(), cat: "Maintenance", amount: 0, worth: 0 });
  NS.acts["exp-edit"] = (el) => { const e = NS.veh().expenses.find((x) => x.id === el.dataset.id); NS.expenseForm(e, e); };
  NS.acts.worth = (el) => { const e = NS.veh().expenses.find((x) => x.id === el.dataset.id); const n = +el.dataset.n; e.worth = e.worth === n ? 0 : n; NS.commitVeh({ silent: true }); NS.render({ quiet: true, keepScroll: true }); };
  NS.acts["budget-edit"] = () => {
    const v = NS.veh();
    NS.form({ eyebrow: "MONEY", title: "Build budget", value: { budget: v.budget }, fields: [{ k: "budget", l: "Total build budget", t: "money", full: true }], onSave: (o) => { v.budget = o.budget; NS.commitVeh(); } });
  };

  /* ================= INVENTORY ================= */
  const INV = [["owned", "OWNED"], ["need", "NEED"], ["bought", "BOUGHT"], ["installed", "INSTALLED"]];
  NS.views.inventory = function () {
    const items = NS.S.inventory.items;
    const kind = NS.ui.invKind, f = NS.ui.invFilter;
    const list = items.filter((i) => i.kind === kind && (f === "all" || i.status === f));
    const need = items.filter((i) => i.status === "need");
    const needCost = need.reduce((a, i) => a + (+i.price || 0), 0);
    const count = (k, s) => items.filter((i) => i.kind === k && i.status === s).length;
    return `${NS.subnav()}
    <div class="page-head"><div><div class="eyebrow">GARAGE INVENTORY</div><h1 class="h1" style="margin-top:6px">Tools + parts</h1><p class="lede">What you own, what you need, and what's sitting in a box waiting to go on the car.</p></div>
      <button class="btn primary" data-act="inv-add">${icon("plus")}Add item</button></div>
    <div class="kv" style="margin-bottom:16px">
      <div><div class="k">TOOLS OWNED</div><div class="v">${count("tool", "owned")}</div></div>
      <div><div class="k">PARTS WAITING</div><div class="v vio">${count("part", "bought")}</div></div>
      <div><div class="k">SHOPPING LIST</div><div class="v ${need.length ? "bad" : ""}">${need.length}</div></div>
      <div><div class="k">TO BUY</div><div class="v">${money(needCost)}</div></div>
    </div>
    <div class="row between" style="margin-bottom:12px">
      <div class="seg" style="min-width:200px">${[["tool", "TOOLS"], ["part", "PARTS"]].map(([k, l]) => `<button data-act="inv-kind" data-k="${k}" aria-pressed="${kind === k}">${l}</button>`).join("")}</div>
      <div class="chips">${[["all", "All"]].concat(INV.map(([k, l]) => [k, l[0] + l.slice(1).toLowerCase()])).map(([k, l]) => `<button class="chip" data-act="inv-filter" data-k="${k}" aria-pressed="${f === k}">${l}</button>`).join("")}</div>
    </div>
    <div class="inv">${list.map((i) => `<div class="inv-row">
      <button class="n" data-act="inv-edit" data-id="${i.id}" style="text-align:left;min-width:0">${esc(i.name)}<small>${[i.note, i.price ? money(i.price) : ""].filter(Boolean).map(esc).join(" · ") || "&nbsp;"}</small></button>
      <div class="inv-seg" role="group" aria-label="Status">${INV.map(([s, l]) => `<button data-act="inv-status" data-id="${i.id}" data-v="${s}" aria-pressed="${i.status === s}">${l}</button>`).join("")}</div>
    </div>`).join("") || `<div class="empty" style="margin-top:8px">Nothing here yet.</div>`}</div>`;
  };
  NS.acts["inv-kind"] = (el) => { NS.ui.invKind = el.dataset.k; NS.render({ quiet: true }); };
  NS.acts["inv-filter"] = (el) => { NS.ui.invFilter = el.dataset.k; NS.render({ quiet: true }); };
  NS.acts["inv-status"] = (el) => {
    const i = NS.S.inventory.items.find((x) => x.id === el.dataset.id); i.status = el.dataset.v; NS.commit("inventory", { silent: true });
    NS.$$(`[data-act=inv-status][data-id="${i.id}"]`).forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === i.status));
  };
  const invFields = [
    { k: "name", l: "Item", t: "text", full: true }, { k: "kind", l: "Type", t: "seg", o: [{ v: "tool", l: "TOOL" }, { v: "part", l: "PART" }] },
    { k: "status", l: "Status", t: "seg", o: INV.map(([v, l]) => ({ v, l })) }, { k: "price", l: "Price", t: "money" }, { k: "note", l: "Note", t: "text" },
  ];
  NS.acts["inv-add"] = () => NS.form({ eyebrow: "INVENTORY", title: "Add item", fields: invFields, value: { kind: NS.ui.invKind, status: "need", price: 0 },
    onSave: (o) => { if (!o.name) return false; NS.S.inventory.items.push({ id: NS.uid("i"), ...o }); NS.commit("inventory"); } });
  NS.acts["inv-edit"] = (el) => { const i = NS.S.inventory.items.find((x) => x.id === el.dataset.id);
    NS.form({ eyebrow: "INVENTORY", title: i.name, fields: invFields, value: i, onSave: (o) => { Object.assign(i, o); NS.commit("inventory"); },
      onDelete: () => { NS.S.inventory.items = NS.S.inventory.items.filter((x) => x !== i); NS.commit("inventory"); } }); };

  /* ================= DIY ================= */
  const diffBand = (d) => (d <= 3 ? "beginner" : d <= 6 ? "intermediate" : "advanced");
  NS.views.diy = function () {
    if (NS.ui.openJob) return jobView(D.diy.find((j) => j.id === NS.ui.openJob));
    const q = NS.ui.diyQ.toLowerCase(); const fd = NS.ui.diyDiff;
    const learned = NS.S.meta.learned || [];
    const list = D.diy.filter((j) => (fd === "all" || diffBand(j.diff) === fd) && (!q || (j.title + " " + j.tags.join(" ") + " " + j.parts.join(" ") + " " + j.tools.join(" ")).toLowerCase().includes(q)));
    return `
    <div class="page-head"><div><div class="eyebrow">DIY GARAGE · LEARN</div><h1 class="h1" style="margin-top:6px">Learn it on your own car</h1><p class="lede">Every job lists what goes wrong and when to stop. Knowing when to stop is part of the skill.</p></div></div>
    <div class="kv" style="margin-bottom:16px">
      <div><div class="k">JOBS</div><div class="v">${D.diy.length}</div></div>
      <div><div class="k">LEARNED</div><div class="v ok">${learned.length}</div></div>
      <div><div class="k">SKILL LEVEL</div><div class="v" style="font-size:15px;padding-top:4px">${learned.length >= 8 ? "SHOP-READY" : learned.length >= 5 ? "WEEKEND WRENCH" : learned.length >= 2 ? "APPRENTICE" : "ROOKIE"}</div></div>
      <div><div class="k">NEXT TO LEARN</div><div class="v" style="font-size:15px;padding-top:4px">${esc((D.diy.filter((j) => !learned.includes(j.id)).sort((a, b) => a.diff - b.diff)[0] || {}).title || "All done")}</div></div>
    </div>
    <div class="search" style="margin-bottom:10px">${icon("search")}<input class="input" id="diy-q" type="search" placeholder="Search jobs, tools, parts…" value="${esc(NS.ui.diyQ)}" data-in="diy-q" aria-label="Search repair guides"></div>
    <div class="chips" style="margin-bottom:14px">${[["all", "All"], ["beginner", "Beginner"], ["intermediate", "Intermediate"], ["advanced", "Advanced"]].map(([k, l]) => `<button class="chip" data-act="diy-diff" data-k="${k}" aria-pressed="${fd === k}">${l}</button>`).join("")}</div>
    <div class="jobs" id="diy-list">${jobsHTML(list, learned)}</div>`;
  };
  function jobsHTML(list, learned) {
    return list.map((j) => `<button class="job" data-act="job-open" data-id="${j.id}">
      <div class="dial" style="color:${j.diff >= 7 ? "var(--bad)" : j.diff >= 5 ? "var(--warn)" : "var(--ok)"}">${j.diff}<small>/10</small></div>
      <div style="min-width:0"><div class="t">${esc(j.title)} ${learned.includes(j.id) ? '<span class="tag ok">LEARNED</span>' : ""}</div><div class="m"><span>${esc(j.time)}</span><span>${j.tools.length} tools</span><span>${diffBand(j.diff)}</span></div></div>
    </button>`).join("") || '<div class="empty" style="grid-column:1/-1">No jobs match. Try "brake", "coolant", or "audio".</div>';
  }
  NS.inputs["diy-q"] = (el) => {
    NS.ui.diyQ = el.value; const q = el.value.toLowerCase(); const fd = NS.ui.diyDiff;
    const list = D.diy.filter((j) => (fd === "all" || diffBand(j.diff) === fd) && (!q || (j.title + " " + j.tags.join(" ") + " " + j.parts.join(" ") + " " + j.tools.join(" ")).toLowerCase().includes(q)));
    NS.$("#diy-list").innerHTML = jobsHTML(list, NS.S.meta.learned || []);
  };
  NS.acts["diy-diff"] = (el) => { NS.ui.diyDiff = el.dataset.k; NS.render({ quiet: true }); };
  NS.acts["job-open"] = (el) => { NS.ui.openJob = el.dataset.id; NS.render(); window.scrollTo(0, 0); };
  NS.acts["job-back"] = () => { NS.ui.openJob = null; NS.render(); };

  function jobView(j) {
    if (!j) { NS.ui.openJob = null; return NS.views.diy(); }
    const learned = (NS.S.meta.learned || []).includes(j.id);
    const done = (NS.ui.steps ||= {})[j.id] || [];
    const inv = NS.S.inventory.items;
    const owns = (t) => { const n = t.toLowerCase(); const hit = inv.find((i) => n.includes(i.name.toLowerCase().replace(/\s*\(.*\)/, "")) || i.name.toLowerCase().includes(n)); return hit ? hit.status : null; };
    return `
    <button class="btn ghost sm" data-act="job-back" style="margin-bottom:10px;padding-left:4px">${icon("chev").replace("<svg", '<svg style="transform:rotate(180deg)"')}All jobs</button>
    <div class="page-head"><div><div class="eyebrow">DIY GARAGE · ${diffBand(j.diff).toUpperCase()}</div><h1 class="h1" style="margin-top:6px">${esc(j.title)}</h1></div>
      <div class="row"><button class="btn ${learned ? "" : "primary"}" data-act="job-learned" data-id="${j.id}">${icon("check")}${learned ? "Learned" : "Mark as learned"}</button><button class="btn" data-act="job-log" data-id="${j.id}">${icon("log")}Log this job</button></div></div>
    <div class="kv" style="margin-bottom:18px">
      <div><div class="k">DIFFICULTY</div><div class="v">${j.diff}<span class="dim" style="font-size:12px">/10</span></div></div>
      <div><div class="k">EST. TIME</div><div class="v">${esc(j.time)}</div></div>
      <div><div class="k">TOOLS</div><div class="v">${j.tools.length}</div></div>
      <div><div class="k">PROGRESS</div><div class="v">${done.length}/${j.steps.length}</div></div>
    </div>
    <div class="lab">
      <div class="stack">
        <section class="panel"><div class="sec-head"><h2 class="h2">Steps</h2><span class="px dim">TAP TO CHECK OFF</span></div>
          <ol class="steps">${j.steps.map((s, i) => `<li data-act="job-step" data-id="${j.id}" data-i="${i}" class="${done.includes(i) ? "done" : ""}">${esc(s)}</li>`).join("")}</ol></section>
        <div class="infobox"><h4>COMMON MISTAKES</h4><ul>${j.mistakes.map((m) => `<li>${esc(m)}</li>`).join("")}</ul></div>
        <div class="infobox"><h4>WHAT CAN GO WRONG</h4><ul>${j.wrong.map((m) => `<li>${esc(m)}</li>`).join("")}</ul></div>
      </div>
      <div class="stack">
        <div class="warnbox"><h4>STOP AND CALL A PRO IF</h4><ul>${j.stop.map((m) => `<li>${esc(m)}</li>`).join("")}</ul></div>
        <section class="panel tight"><div class="lbl" style="margin-bottom:8px">Tools</div><div class="inv">${j.tools.map((t) => { const s = owns(t); return `<div class="inv-row" style="padding:8px 0"><span>${esc(t)}</span>${s ? `<span class="tag ${s === "need" ? "bad" : "ok"}">${s === "need" ? "NEED" : "HAVE"}</span>` : '<span class="tag">?</span>'}</div>`; }).join("")}</div></section>
        ${j.parts.length ? `<section class="panel tight"><div class="lbl" style="margin-bottom:8px">Parts</div><ul style="margin:0;padding-left:18px;color:var(--fg-2);display:flex;flex-direction:column;gap:5px">${j.parts.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></section>` : ""}
        <p class="dim" style="font-size:12.5px;margin:0">Specs here are typical for this platform. Confirm torque values in a factory service manual for your exact car.</p>
      </div>
    </div>`;
  }
  NS.acts["job-step"] = (el) => {
    const id = el.dataset.id, i = +el.dataset.i; const arr = ((NS.ui.steps ||= {})[id] ||= []);
    const k = arr.indexOf(i); if (k >= 0) arr.splice(k, 1); else arr.push(i);
    el.classList.toggle("done");
  };
  NS.acts["job-learned"] = (el) => { const L = (NS.S.meta.learned ||= []); const id = el.dataset.id; NS.S.meta.learned = L.includes(id) ? L.filter((x) => x !== id) : L.concat(id); NS.commit("meta"); };
  NS.acts["job-log"] = (el) => { const j = D.diy.find((x) => x.id === el.dataset.id); const tags = { oil: ["oil"], plugs: ["plugs"], bleed: ["coolant"], thermostat: ["coolant"], timing: ["timing"], brakes: ["brakefluid"] }[j.id] || []; NS.logForm({ prefill: { title: j.title, type: "maint", tags, notes: "" } }); };

})();
