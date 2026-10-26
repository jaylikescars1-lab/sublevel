/* HUNT: listing tracker with scoring, and the buying inspection. */
(function () {
  const NS = window.NS, D = window.NS_DATA;
  const { esc, money, num, icon } = NS;

  const WEIGHTS = { price: 2.2, reliability: 2.4, fun: 1.8, mod: 1.6, risk: 2.0 };
  NS.huntScore = (h) => {
    const s = h.scores || {};
    return Math.round((s.price || 0) * WEIGHTS.price + (s.reliability || 0) * WEIGHTS.reliability + (s.fun || 0) * WEIGHTS.fun + (s.mod || 0) * WEIGHTS.mod + (10 - (s.risk ?? 10)) * WEIGHTS.risk);
  };
  NS.verdict = (n) => n >= 90 ? { t: "Drive there tonight.", short: "GO NOW" } : n >= 80 ? { t: "Actually worth looking at.", short: "LOOK" } : n >= 70 ? { t: "Worth a message.", short: "MESSAGE" } : n >= 60 ? { t: "Only if the price drops.", short: "MAYBE" } : n >= 45 ? { t: "Project car energy. Be honest with yourself.", short: "RISKY" } : { t: "Scroll past.", short: "PASS" };
  NS.scoreColor = (n) => (n >= 80 ? "var(--ok)" : n >= 65 ? "var(--violet-hi)" : n >= 50 ? "var(--warn)" : "var(--bad)");

  const FILTERS = [
    ["u5", "Under $5,000", (h) => h.price < 5000], ["u7", "Under $7,000", (h) => h.price < 7000],
    ["man", "Manual", (h) => h.trans === "Manual"], ["rwd", "RWD", (h) => h.drive === "RWD"],
    ["honda", "Honda", (h) => /honda|acura/i.test(h.make)], ["lexus", "Lexus", (h) => /lexus/i.test(h.make)],
    ["bmw", "BMW", (h) => /bmw/i.test(h.make)], ["jdm", "JDM", (h) => (h.tags || []).includes("jdm")],
    ["turbo", "Turbo", (h) => (h.tags || []).includes("turbo")], ["150", "Under 150k miles", (h) => h.miles < 150000],
    ["saved", "Hunt list only", (h) => h.saved],
  ];
  const SCORE_KEYS = [["price", "PRICE"], ["reliability", "RELIABILITY"], ["fun", "FUN"], ["mod", "MOD POTENTIAL"], ["risk", "RISK"]];

  const drop = (h) => { const p0 = h.priceHistory && h.priceHistory[0] ? h.priceHistory[0].price : h.price; return p0 > h.price ? `<span class="tag ok">↓ ${money(p0 - h.price)}</span>` : p0 < h.price ? `<span class="tag bad">↑ ${money(h.price - p0)}</span>` : ""; };
  function card(h) {
    const s = NS.huntScore(h); const vd = NS.verdict(s);
    return `<article class="listing${h.saved ? " saved" : ""}">
      <div class="l-plate">
        ${h.photo ? `<img src="${NS.img(h.photo)}" alt="${esc(h.year + " " + h.title)}" loading="lazy">` : NS.silSVG() + `<div class="yr">${esc(h.year)}</div>`}
        <span class="src tag">${esc((h.source || "LISTING").toUpperCase())}${h.status && h.status !== "new" ? " · " + esc(h.status.toUpperCase()) : ""}</span>
        <div class="score"><span class="big" style="color:${NS.scoreColor(s)}">${s}</span><small>/100</small></div>
      </div>
      <div class="l-body">
        <div><div class="l-title">${esc(h.year + " " + h.title)}</div><div class="row" style="gap:8px;margin-top:4px"><span class="l-price">${money(h.price)}</span>${drop(h)}<span class="px dim">${h.listed ? "LISTED " + NS.daysAgo(h.listed).toUpperCase() : ""}</span></div></div>
        <div class="l-facts"><span>${num(h.miles / 1000)}k miles</span><span>${esc(h.location)}</span><span>${esc(h.trans)}</span><span>${esc(h.drive)}</span>${(h.tags || []).includes("turbo") ? "<span>Turbo</span>" : ""}</div>
        <div class="verdict" style="color:${NS.scoreColor(s)}">“${esc(vd.t)}”</div>
        <div class="sbars">${SCORE_KEYS.map(([k, l]) => { const v = h.scores?.[k] ?? 0; const bad = k === "risk"; return `<div class="sbar"><span>${l}</span><div class="meter ${bad && v >= 7 ? "bad" : bad && v >= 5 ? "warn" : ""}"><b style="width:${v * 10}%"></b></div><b>${v}</b></div>`; }).join("")}</div>
        ${h.notes ? `<p class="muted" style="margin:0;font-size:13.5px">${esc(h.notes)}</p>` : ""}
        <div class="l-actions">
          <button class="btn ${h.saved ? "" : "primary"} sm" data-act="hunt-save" data-id="${h.id}">${icon(h.saved ? "check" : "star")}${h.saved ? "On hunt list" : "Save to hunt list"}</button>
          <button class="iconbtn" data-act="hunt-inspect" data-id="${h.id}" aria-label="Inspect" title="Inspection checklist">${icon("clip")}</button>
          <button class="iconbtn" data-act="hunt-edit" data-id="${h.id}" aria-label="Edit listing">${icon("edit")}</button>
        </div>
      </div>
    </article>`;
  }

  NS.views.hunt = function () {
    const items = NS.S.hunt.items || [];
    const act = NS.ui.huntFilters;
    const fs = FILTERS.filter((f) => act.includes(f[0]));
    let list = items.filter((h) => fs.every((f) => f[2](h)));
    const sort = NS.ui.huntSort;
    list.sort((a, b) => sort === "price" ? a.price - b.price : sort === "miles" ? a.miles - b.miles : sort === "new" ? String(b.listed).localeCompare(String(a.listed)) : NS.huntScore(b) - NS.huntScore(a));
    const saved = items.filter((h) => h.saved);
    const best = items.slice().sort((a, b) => NS.huntScore(b) - NS.huntScore(a))[0];
    return `${NS.subnav()}
    <div class="page-head">
      <div><div class="eyebrow">HUNT · MARKETPLACE + CRAIGSLIST</div><h1 class="h1" style="margin-top:6px">The hunt list</h1><p class="lede">Every car you're watching, scored the same way: price, reliability, fun, mod potential, and risk.</p></div>
      <div class="row">${NS.sample ? `<button class="btn" data-act="hunt-paste">${icon("spark")}Paste a listing</button>` : ""}<button class="btn primary" data-act="hunt-add">${icon("plus")}Add listing</button></div>
    </div>
    <div class="kv" style="margin-bottom:16px">
      <div><div class="k">TRACKING</div><div class="v">${items.length}</div></div>
      <div><div class="k">ON HUNT LIST</div><div class="v">${saved.length}</div></div>
      <div><div class="k">TOP SCORE</div><div class="v" style="color:${best ? NS.scoreColor(NS.huntScore(best)) : ""}">${best ? NS.huntScore(best) : "—"}</div></div>
      <div><div class="k">AVG PRICE</div><div class="v">${items.length ? money(items.reduce((a, h) => a + h.price, 0) / items.length) : "—"}</div></div>
    </div>
    <div class="chips" style="margin-bottom:8px">${FILTERS.map(([k, l]) => `<button class="chip" data-act="hunt-filter" data-k="${k}" aria-pressed="${act.includes(k)}">${l}</button>`).join("")}</div>
    <div class="row between" style="margin:10px 0 14px"><span class="px dim">${list.length} OF ${items.length} LISTINGS</span>
      <div class="seg" style="min-width:260px">${[["score", "SCORE"], ["price", "PRICE"], ["miles", "MILES"], ["new", "NEWEST"]].map(([k, l]) => `<button data-act="hunt-sort" data-k="${k}" aria-pressed="${sort === k}">${l}</button>`).join("")}</div></div>
    <div class="listings">${list.map(card).join("") || `<div class="empty" style="grid-column:1/-1">${(NS.S.hunt.items || []).length ? "No listings match these filters." : "Nothing on the list yet. Add a car you're watching and it gets scored."}</div>`}</div>
    <p class="dim" style="font-size:13px;margin-top:18px;max-width:70ch">Score = price ×2.2 + reliability ×2.4 + fun ×1.8 + mod potential ×1.6 + (10 − risk) ×2.0. Each rated 0–10 by you.</p>`;
  };

  NS.acts["hunt-filter"] = (el) => { const a = NS.ui.huntFilters; const k = el.dataset.k; NS.ui.huntFilters = a.includes(k) ? a.filter((x) => x !== k) : a.concat(k); NS.render({ quiet: true }); };
  NS.acts["hunt-sort"] = (el) => { NS.ui.huntSort = el.dataset.k; NS.render({ quiet: true }); };
  NS.acts["hunt-save"] = (el) => { const h = NS.S.hunt.items.find((x) => x.id === el.dataset.id); h.saved = !h.saved; NS.commit("hunt", { silent: true }); NS.render({ quiet: true }); NS.toast(h.saved ? "Saved to hunt list" : "Removed from hunt list"); };
  NS.acts["hunt-inspect"] = (el) => { NS.S.checklist.active = el.dataset.id; NS.commit("checklist", { silent: true }); NS.go("inspect"); };

  const huntFields = [
    { k: "year", l: "Year", t: "number", step: 1 }, { k: "title", l: "Car", t: "text", ph: "Civic Si" },
    { k: "make", l: "Make", t: "text" }, { k: "price", l: "Asking price", t: "money" },
    { k: "miles", l: "Miles", t: "number", step: 1000 }, { k: "location", l: "Location", t: "text" },
    { k: "trans", l: "Transmission", t: "seg", o: ["Manual", "Auto"] }, { k: "drive", l: "Drivetrain", t: "seg", o: ["FWD", "RWD", "AWD"] },
    { k: "tags", l: "Tags", t: "multi", o: ["jdm", "turbo"] },
    { k: "source", l: "Source", t: "select", o: ["Marketplace", "Craigslist", "OfferUp", "Forum", "Dealer", "Friend"] },
    { k: "status", l: "Status", t: "select", o: ["new", "messaged", "seen", "passed", "bought"] },
    { k: "listed", l: "Listed", t: "date" },
    { k: "s_price", l: "Price (0 = overpriced, 10 = steal)", t: "range", min: 0, max: 10 },
    { k: "s_reliability", l: "Reliability", t: "range", min: 0, max: 10 },
    { k: "s_fun", l: "Fun", t: "range", min: 0, max: 10 },
    { k: "s_mod", l: "Mod potential", t: "range", min: 0, max: 10 },
    { k: "s_risk", l: "Risk (10 = scary)", t: "range", min: 0, max: 10 },
    { k: "link", l: "Listing link", t: "text", full: true },
    { k: "notes", l: "Notes", t: "textarea" },
    { k: "photo", l: "Photo", t: "photos", single: true },
  ];
  const flat = (h) => ({ ...h, s_price: h.scores.price, s_reliability: h.scores.reliability, s_fun: h.scores.fun, s_mod: h.scores.mod, s_risk: h.scores.risk });
  const unflat = (o) => { const scores = { price: o.s_price, reliability: o.s_reliability, fun: o.s_fun, mod: o.s_mod, risk: o.s_risk }; ["s_price", "s_reliability", "s_fun", "s_mod", "s_risk"].forEach((k) => delete o[k]); o.scores = scores; o.year = Math.round(o.year); return o; };
  NS.huntForm = (value, eyebrow = "NEW LISTING") => {
    NS.form({ eyebrow, title: value.title ? `${value.year} ${value.title}` : "Add a car to the hunt", fields: huntFields, value: flat(value),
      onSave: (o) => { if (!o.title) { NS.toast("Name the car"); return false; } o = unflat(o); o.id = NS.uid("h"); o.saved = true; o.priceHistory = [{ date: o.listed || NS.today(), price: o.price }]; NS.S.hunt.items.unshift(o); NS.commit("hunt"); NS.toast(`Scored ${NS.huntScore(o)}/100. ${NS.verdict(NS.huntScore(o)).t}`); } });
  };
  NS.acts["hunt-add"] = () => NS.huntForm({ year: 2000, trans: "Manual", drive: "FWD", tags: ["jdm"], source: "Marketplace", status: "new", listed: NS.today(), price: 5000, miles: 150000, location: "Denver, CO", scores: { price: 5, reliability: 5, fun: 5, mod: 5, risk: 5 } });
  NS.acts["hunt-edit"] = (el) => {
    const h = NS.S.hunt.items.find((x) => x.id === el.dataset.id);
    NS.form({ eyebrow: "LISTING", title: h.year + " " + h.title, fields: huntFields, value: flat(h),
      onSave: (o) => {
        o = unflat(o);
        if (o.price !== h.price) { h.priceHistory = h.priceHistory || [{ date: h.listed || NS.today(), price: h.price }]; h.priceHistory.push({ date: NS.today(), price: o.price }); }
        Object.assign(h, o); NS.commit("hunt");
        if (h.priceHistory && o.price < h.priceHistory[0].price) NS.toast(`Price dropped ${money(h.priceHistory[0].price - o.price)} since you found it`);
      },
      onDelete: () => { NS.S.hunt.items = NS.S.hunt.items.filter((x) => x !== h); NS.commit("hunt"); NS.toast("Listing removed"); } });
  };

  /* ================= INSPECTION ================= */
  NS.inspection = function (marks, price) {
    let good = 0, q = 0, bad = 0, cost = 0, total = 0; const crits = []; const bads = [];
    D.inspection.forEach((c) => c.items.forEach((it) => {
      total++;
      const m = marks[it.id];
      if (m === "good") good++;
      if (m === "q") { q++; cost += it.cost * 0.4; }
      if (m === "bad") { bad++; cost += it.cost; bads.push(it.q); if (it.crit) crits.push(it.q); }
    }));
    const answered = good + q + bad;
    let call, why;
    if (crits.length) { call = "WALK AWAY"; why = `Deal-breaker: ${crits[0].toLowerCase()}. No price fixes that.`; }
    else if (bad >= 4 || (price && cost > price * 0.35)) { call = "WALK AWAY"; why = `About ${money(cost)} in known problems${price ? ` on a ${money(price)} car` : ""}. That's a parts car with a title.`; }
    else if (bad >= 1 || q >= 3) { call = "NEGOTIATE"; why = `Ask for about ${money(Math.round(cost / 50) * 50)} off and show them the list.`; }
    else if (answered < total * 0.6) { call = "KEEP CHECKING"; why = `${total - answered} checks left. Don't decide on half an inspection.`; }
    else { call = "BUY"; why = "Nothing scary. Bring cash, check the title, drive it home."; }
    if (call !== "WALK AWAY" && call !== "NEGOTIATE" && answered < total * 0.6 && (bad || q)) { call = "KEEP CHECKING"; }
    return { good, q, bad, cost, total, answered, call, why, bads };
  };

  NS.views.inspect = function () {
    const C = NS.S.checklist; const items = NS.S.hunt.items;
    const act = C.active || "adhoc";
    const marks = (C.marks[act] ||= {});
    const car = items.find((h) => h.id === act);
    const price = car ? car.price : +(C.adhocPrice || 0);
    const r = NS.inspection(marks, price);
    return `${NS.subnav()}
    <div class="page-head"><div><div class="eyebrow">BUYING INSPECTION · CARFAX MINDSET</div><h1 class="h1" style="margin-top:6px">Inspect before you fall in love</h1><p class="lede">Go through every item in person. Mark it good, questionable, or bad, and get a straight answer.</p></div></div>
    <div class="lab">
      <div class="stack">
        <div class="form-grid">
          <div class="field"><label for="insp-car">Car being inspected</label><select class="select" id="insp-car" data-ch="insp-car">${items.map((h) => `<option value="${h.id}"${h.id === act ? " selected" : ""}>${esc(h.year + " " + h.title)} · ${money(h.price)}</option>`).join("")}<option value="adhoc"${act === "adhoc" ? " selected" : ""}>A car not on my list</option></select></div>
          ${car ? `<div class="field"><span class="lbl">Asking</span><div class="big" style="font-size:30px;padding-top:6px">${money(car.price)}</div></div>` : `<div class="field"><label for="insp-price">Asking price</label><div class="prefix"><span>$</span><input class="input money" type="number" id="insp-price" data-ch="insp-price" value="${esc(C.adhocPrice || "")}"></div></div>`}
        </div>
        ${D.inspection.map((c, ci) => {
          const done = c.items.filter((i) => marks[i.id]).length;
          const hasBad = c.items.some((i) => marks[i.id] === "bad");
          return `<details class="insp-cat"${(NS.ui["insp-" + c.cat] ?? ci < 2) ? " open" : ""} data-cat="${c.cat}">
            <summary><span class="ttl">${c.cat}</span><span class="row" style="gap:8px">${hasBad ? '<span class="tag bad">ISSUE</span>' : ""}<span class="mono dim" style="font-size:12px">${done}/${c.items.length}</span>${icon("chev").replace("<svg", '<svg style="width:14px;height:14px;transform:rotate(90deg)"')}</span></summary>
            ${c.items.map((it) => `<div class="insp-item"><div><div class="q">${esc(it.q)}${it.crit ? ' <span class="tag bad">DEAL-BREAKER</span>' : ""}</div><div class="h">${esc(it.h)}</div></div>
              <div class="tri" role="group" aria-label="${esc(it.q)}">${[["good", "GOOD"], ["q", "QUESTIONABLE"], ["bad", "BAD"]].map(([v, l]) => `<button data-act="insp-mark" data-id="${it.id}" data-v="${v}" aria-pressed="${marks[it.id] === v}">${l}</button>`).join("")}</div></div>`).join("")}
          </details>`;
        }).join("")}
        <button class="btn danger" data-act="insp-reset" style="align-self:flex-start">${icon("trash")}Clear this inspection</button>
      </div>
      <div class="stack" style="align-self:start;position:sticky;top:calc(64px + env(safe-area-inset-top,0px))">
        <div class="verdict-card" data-v="${r.call}" id="insp-verdict">${verdictInner(r, car)}</div>
      </div>
    </div>
    <section class="section">
      <div class="sec-head"><div><div class="eyebrow">RED FLAGS</div><h2 class="h2" style="margin-top:4px">Things the seller is probably not telling you</h2></div></div>
      <div class="flags">${D.redFlags.map((f) => `<div class="flag"><div class="say">${esc(f.say)}</div><div class="real">${f.real}</div></div>`).join("")}</div>
    </section>`;
  };
  function verdictInner(r, car) {
    return `<span class="lbl">${car ? esc(car.year + " " + car.title) : "Verdict"}</span>
      <div class="call">${r.call}</div>
      <p class="muted" style="margin:8px 0 0">${esc(r.why)}</p>
      <div class="meter" style="margin-top:14px"><b style="width:${(r.answered / r.total) * 100}%"></b></div>
      <div class="row between" style="margin-top:6px"><span class="px dim">${r.answered}/${r.total} CHECKED</span><span class="px dim">EST. ISSUES ${money(r.cost)}</span></div>
      <div class="grid g3" style="margin-top:14px">
        <div class="stat"><div class="k">Good</div><div class="v ok">${r.good}</div></div>
        <div class="stat"><div class="k">Questionable</div><div class="v warn">${r.q}</div></div>
        <div class="stat"><div class="k">Bad</div><div class="v bad">${r.bad}</div></div>
      </div>
      ${r.bads.length ? `<div class="divider"></div><span class="lbl">Bring these up</span><ul style="margin:8px 0 0;padding-left:18px;color:var(--fg-2);font-size:14px">${r.bads.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}`;
  }
  NS.acts["insp-mark"] = (el) => {
    const C = NS.S.checklist; const act = C.active || "adhoc"; const marks = (C.marks[act] ||= {});
    const id = el.dataset.id, v = el.dataset.v;
    marks[id] = marks[id] === v ? undefined : v; if (!marks[id]) delete marks[id];
    NS.commit("checklist", { silent: true });
    NS.$$(`[data-act=insp-mark][data-id="${id}"]`).forEach((b) => b.setAttribute("aria-pressed", marks[id] === b.dataset.v));
    const car = NS.S.hunt.items.find((h) => h.id === act);
    const r = NS.inspection(marks, car ? car.price : +(C.adhocPrice || 0));
    const vc = NS.$("#insp-verdict"); vc.dataset.v = r.call; vc.innerHTML = verdictInner(r, car);
    const det = el.closest("details"); const cat = D.inspection.find((c) => c.cat === det.dataset.cat);
    det.querySelector("summary .mono").textContent = cat.items.filter((i) => marks[i.id]).length + "/" + cat.items.length;
  };
  NS.inputs["insp-car"] = (el) => { NS.S.checklist.active = el.value; NS.commit("checklist", { silent: true }); NS.render({ quiet: true }); };
  NS.inputs["insp-price"] = (el) => { NS.S.checklist.adhocPrice = Number(el.value) || 0; NS.commit("checklist", { silent: true }); NS.render({ quiet: true }); };
  NS.acts["insp-reset"] = (el) => {
    if (!el.classList.contains("armed")) { el.classList.add("armed"); el.lastChild.textContent = "Tap again to clear"; return; }
    const C = NS.S.checklist; C.marks[C.active || "adhoc"] = {}; NS.commit("checklist");
  };
  document.addEventListener("toggle", (e) => { const t = e.target; if (t && t.matches && t.matches("details.insp-cat")) NS.ui["insp-" + t.dataset.cat] = t.open; }, true);
})();
