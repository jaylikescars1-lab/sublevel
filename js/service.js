/* TRACK › Service: maintenance intervals, last done, what's due. */
(function () {
  const NS = window.NS, D = window.NS_DATA;
  const { esc, num, money, icon } = NS;
  const STATE = { overdue: ["OVERDUE", "bad"], soon: ["DUE SOON", "warn"], ok: ["OK", "ok"], unknown: ["NO RECORD", ""] };

  NS.views.service = function () {
    const v = NS.veh(); const list = NS.serviceStatus(v);
    const order = { overdue: 0, unknown: 1, soon: 2, ok: 3 };
    list.sort((a, b) => order[a.state] - order[b.state] || (a.leftMi ?? 0) - (b.leftMi ?? 0));
    const nm = NS.nextMaint(v); const pace = NS.pace(v);
    const counts = { overdue: 0, soon: 0, ok: 0, unknown: 0 }; list.forEach((x) => counts[x.state]++);
    return `${NS.subnav()}
    <div class="page-head"><div><div class="eyebrow">SERVICE SCHEDULE · ${esc(v.chassis)}</div><h1 class="h1" style="margin-top:6px">What's due</h1><p class="lede">Each item resets when you log a session that covers it. Unknown history counts as due.</p></div></div>
    <div class="kv" style="margin-bottom:18px">
      <div><div class="k">NEXT DUE</div><div class="v" style="font-size:15px;padding-top:4px">${esc(nm.label.toUpperCase())}</div></div>
      <div><div class="k">IN</div><div class="v">${num(Math.max(0, nm.left))}<span class="dim" style="font-size:12px"> mi</span></div></div>
      <div><div class="k">AROUND</div><div class="v">${nm.left > 0 ? NS.etaDate(v, nm.left) : "NOW"}</div></div>
      <div><div class="k">YOUR PACE</div><div class="v">${num(pace * 7)}<span class="dim" style="font-size:12px"> mi/wk</span></div></div>
    </div>
    ${(() => { const bad = v.log.filter((l) => l.mileage > v.mileage + 50); return bad.length ? `<div class="warnbox" style="margin-bottom:14px"><h4>CHECK YOUR LOG MILEAGE</h4><p style="margin:0;color:var(--fg-2);font-size:14px">${bad.length} log ${bad.length === 1 ? "entry has" : "entries have"} more miles than your odometer (${num(v.mileage)}). Edit ${bad.length === 1 ? "it" : "them"} in the Garage Log so these countdowns are right.</p><button class="btn sm" data-act="go" data-r="log" style="margin-top:10px">Open the log</button></div>` : ""; })()}
    <div class="chips wrap" style="margin-bottom:14px">${Object.entries(counts).filter(([, n]) => n).map(([k, n]) => `<span class="tag ${STATE[k][1]}">${n} ${STATE[k][0]}</span>`).join("")}</div>
    <div class="svc-list">${list.map((x) => {
      const [label, cls] = STATE[x.state];
      const pct = x.state === "unknown" ? 100 : Math.min(100, x.pct * 100);
      return `<div class="svc" data-state="${x.state}">
        <div class="svc-top">
          <div style="min-width:0"><div class="t">${esc(x.name)}${x.crit ? ' <span class="tag bad">ENGINE-CRITICAL</span>' : ""}${x.safety ? ' <span class="tag bad">SAFETY</span>' : ""}</div>
            <div class="m">Every ${num(x.everyMi)} mi or ${x.everyMo} mo · ${x.last ? `last ${NS.fmtDate(x.last.date)} ${String(x.last.date).slice(0, 4)} at ${num(x.last.mi)} mi${x.last.src === "record" ? " (" + esc(x.last.note || "record") + ")" : ""}` : "no record yet"}</div></div>
          <span class="tag ${cls}">${label}</span>
        </div>
        <div class="meter ${x.state === "overdue" ? "bad" : x.state === "soon" || x.state === "unknown" ? "warn" : ""}" style="margin-top:10px"><b style="width:${pct}%"></b></div>
        <div class="row between" style="margin-top:8px">
          <span class="mono dim" style="font-size:12px">${x.last ? (x.leftMi >= 0 ? `${num(x.leftMi)} mi left · due ${num(x.dueMi)}` : `${num(-x.leftMi)} mi over`) : "Log it or add the receipt"}</span>
          <span class="row" style="gap:6px">${x.job ? `<button class="btn sm ghost" data-act="open-job" data-id="${x.job}">Guide</button>` : ""}<button class="iconbtn" data-act="svc-edit" data-id="${x.id}" aria-label="Edit ${esc(x.name)}">${icon("edit")}</button><button class="btn sm" data-act="svc-log" data-id="${x.id}">${icon("check")}Done</button></span>
        </div>
      </div>`;
    }).join("")}</div>
    <p class="dim" style="font-size:13px;margin-top:16px;max-width:70ch">Intervals are conservative for an older, high-mileage car. Adjust any of them to match your owner's manual.</p>`;
  };

  NS.acts["svc-log"] = (el) => {
    const d = NS.svcDefs(NS.veh()).find((x) => x.id === el.dataset.id);
    NS.logForm({ prefill: { title: d.name, type: "maint", cost: d.cost || 0, tags: [d.id] } });
  };
  NS.acts["svc-edit"] = (el) => {
    const v = NS.veh(); const it = v.service.find((x) => x.id === el.dataset.id); const d = NS.svcDefs(v).find((x) => x.id === it.id);
    NS.form({ eyebrow: "SERVICE INTERVAL", title: d.name,
      value: { everyMi: it.everyMi, everyMo: it.everyMo, kmi: it.known?.mi || "", kdate: it.known?.date || "", knote: it.known?.note || "" },
      fields: [
        { k: "everyMi", l: "Every (miles)", t: "number", step: 500 }, { k: "everyMo", l: "Every (months)", t: "number", step: 1 },
        { k: "kmi", l: "Last done at (mi), if not in the log", t: "number", step: 1 }, { k: "kdate", l: "Last done on", t: "date" },
        { k: "knote", l: "Where that came from", t: "text", full: true, ph: "Receipt, previous owner, shop invoice" },
      ],
      onSave: (o) => {
        it.everyMi = Math.max(500, o.everyMi || it.everyMi); it.everyMo = Math.max(1, o.everyMo || it.everyMo);
        it.known = o.kmi ? { mi: Math.round(o.kmi), date: o.kdate || NS.today(), note: o.knote } : null;
        NS.commitVeh(); NS.toast("Schedule updated");
      } });
  };
})();
