/* Sample cleanup: the '97 Civic ships with made-up history so the app isn't empty on first open.
   Once the garage is clearly someone's real car, strip that history out (only entries still exactly as shipped). */
(function () {
  const NS = window.NS;
  const D = window.NS_DATA;
  const { esc, icon } = NS;
  const VID = "civic-97";
  const STASH = "sublevel.sampleStash";
  const SEED = window.NS_SEED;
  const SV = SEED.vehicles[VID];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  /* What a reset mod or setup line says once its invented backstory is gone. */
  const MOD_NOTES = {
    m1: "Every 5k. Check the level on the dipstick first.",
    m2: "Honda MTF only.",
    m3: "No record yet. Honda says every 105k mi or 7 years. Without a receipt, assume it's due.",
    m4: "Replace if they're glazed, cracked or chirp on cold starts.",
    m5: "Honda Type 2 coolant. Bleed at the bleeder bolt.",
    m7: "NGK ZFR5F-11, gap 1.1 mm, 13 lb-ft.",
  };
  const MOD_EST = { m3: 150 };
  const SETUP = {
    s1: { v: "D16Y8 1.6L SOHC VTEC", note: "127 hp stock." },
    s2: { v: "5-speed manual", note: "" },
    s3: { v: "Stock struts", note: "" },
    s4: { v: "Front disc / rear drum", note: "" },
    s5: { v: "OEM 14x5.5 +45 alloys", note: "" },
    s6: { v: "185/65R14", note: "" },
    s7: { v: "Stock cat-back", note: "" },
    s8: { v: "Stock airbox", note: "" },
    s9: { v: "Stock", note: "" },
    s10: { v: "Gray cloth", note: "" },
    s11: { v: "Black", note: "" },
  };

  /* Has anyone actually used this car, or is it still the untouched demo? */
  function inUse(v) {
    const logIds = new Set(SV.log.map((l) => l.id)), modIds = new Set(SV.mods.map((m) => m.id));
    return v.mileage !== SV.mileage || v.purchasePrice !== SV.purchasePrice || v.budget !== SV.budget || v.status !== SV.status || !!v.photo ||
      v.log.some((l) => !logIds.has(l.id)) || v.mods.some((m) => !modIds.has(m.id));
  }

  /* Returns what would change, and applies it when apply is true. */
  function scrub(v, apply) {
    const out = { log: 0, exp: 0, expTotal: 0, svc: 0, mods: [], dupes: 0, setup: 0, learned: 0 };
    const seedLog = Object.fromEntries(SV.log.map((l) => [l.id, l]));
    const seedExp = Object.fromEntries(SV.expenses.map((e) => [e.id, e]));
    const seedMod = Object.fromEntries(SV.mods.map((m) => [m.id, m]));
    const seedSet = Object.fromEntries(SV.setup.map((s) => [s.id, s]));

    const keepLog = v.log.filter((l) => { const s = seedLog[l.id]; return !(s && s.title === l.title && s.date === l.date); });
    out.log = v.log.length - keepLog.length;
    const keepExp = v.expenses.filter((e) => { const s = seedExp[e.id]; const fake = s && s.item === e.item && +s.amount === +e.amount; if (fake) out.expTotal += +e.amount || 0; return !fake; });
    out.exp = v.expenses.length - keepExp.length;

    const known = D.serviceKnown[VID] || {};
    const svc = (v.service || []).map((x) => (x.known && known[x.id] && same(x.known.mi, known[x.id].mi) && x.known.date === known[x.id].date ? (out.svc++, { ...x, known: null }) : x));

    const userTitles = new Set(v.mods.filter((m) => !seedMod[m.id]).map((m) => (m.title || "").trim().toLowerCase()));
    let mods = v.mods.map((m) => {
      const s = seedMod[m.id];
      if (!s || s.status === "planned" || s.status === "researching" || m.status !== s.status || +m.actual !== +s.actual) return m;
      out.mods.push(m.title);
      const n = { ...m, status: "planned", actual: 0 };
      delete n.doneDate;
      if (m.notes === s.notes) n.notes = MOD_NOTES[m.id] || "";
      if (MOD_EST[m.id] && !+m.est) n.est = MOD_EST[m.id];
      return n;
    });
    // a sample mod you've since re-added yourself (same name) is a duplicate
    mods = mods.filter((m) => { const dupe = seedMod[m.id] && out.mods.includes(m.title) && userTitles.has((m.title || "").trim().toLowerCase()); if (dupe) out.dupes++; return !dupe; });

    const setup = (v.setup || []).map((x) => { const s = seedSet[x.id]; if (!s || !SETUP[x.id] || s.v !== x.v || s.note !== x.note || same(SETUP[x.id], { v: x.v, note: x.note })) return x; out.setup++; return { ...x, ...SETUP[x.id] }; });

    const learned = NS.S.meta.learned || [];
    const fakeLearned = learned.length && same([...learned].sort(), [...SEED.meta.learned].sort());
    if (fakeLearned) out.learned = learned.length;

    out.any = out.log + out.exp + out.svc + out.mods.length + out.setup + out.learned > 0;
    if (apply) {
      v.log = keepLog; v.expenses = keepExp; v.service = svc; v.mods = mods; v.setup = setup;
      if (fakeLearned) NS.S.meta.learned = [];
    }
    return out;
  }

  function run(manual) {
    const v = NS.S.vehicles[VID];
    if (!v || (v.sampleCleaned && !(manual && v.sampleCleaned === "kept"))) return null;
    if (!manual && !inUse(v)) return null;
    const preview = scrub(NS.clone(v), false);
    if (!preview.any) { v.sampleCleaned = NS.today(); NS.commit("v:" + VID, { silent: true, noProgress: true }); return null; }
    try { localStorage.setItem(STASH, JSON.stringify({ at: new Date().toISOString(), vehicle: v, learned: NS.S.meta.learned || [], seen: NS.S.meta.seenBadges || null })); } catch (e) {}
    const r = scrub(v, true);
    v.sampleCleaned = NS.today();
    NS.S.meta.seenBadges = NS.unlocked();
    NS.commit("v:" + VID, { silent: true, noProgress: true });
    NS.commit("meta", { silent: true, noProgress: true });
    NS.progressInit();
    NS.render({ quiet: true });
    return r;
  }

  function report(r) {
    const li = [];
    if (r.log) li.push(`<b>${r.log}</b> sample log entries`);
    if (r.exp) li.push(`<b>${r.exp}</b> sample expenses (${NS.money(r.expTotal)})`);
    if (r.svc) li.push(`<b>${r.svc}</b> made-up service records (timing belt, air filter)`);
    if (r.mods.length) li.push(`<b>${r.mods.length}</b> roadmap items the sample had marked done or bought, now back to planned${r.dupes ? ` (and ${r.dupes} duplicate you'd already re-added)` : ""}`);
    if (r.setup) li.push(`<b>${r.setup}</b> setup notes that described a car that isn't yours`);
    if (r.learned) li.push(`<b>${r.learned}</b> DIY skills the sample said you'd learned`);
    NS.sheet(NS.sheetHead("CLEANED UP", "Your Civic, minus the made-up history") + `
      <p class="muted" style="margin:0 0 12px;font-size:15px">SUBLEVEL came with fake history so the app wasn't empty. You're using it for real now, so it's gone:</p>
      <ul class="clean-list">${li.map((x) => `<li>${x}</li>`).join("")}</ul>
      <p class="muted" style="margin:12px 0 0;font-size:14px">Anything you added or changed yourself was kept. Your rank and Next Move now come only from your own work.</p>
      <div class="sheet-foot"><button class="btn ghost" data-act="sample-undo">Undo</button><span class="grow"></span><button class="btn primary" data-act="close-sheet">${icon("check")}Looks right</button></div>`);
  }

  NS.scrubSample = (v) => scrub(v, true);
  NS.cleanSample = function () {
    const r = run(false);
    if (r) setTimeout(() => report(r), NS.standalone ? 900 : 300);
  };
  NS.onRemote = NS.cleanSample;

  /* Settings: lets someone still on the untouched demo clear it by hand. */
  NS.sampleClearHTML = function () {
    const v = NS.S.vehicles[VID];
    if (!v || (v.sampleCleaned && v.sampleCleaned !== "kept") || !scrub(NS.clone(v), false).any) return "";
    return `<div class="infobox" style="margin-top:14px"><h4>SAMPLE HISTORY</h4><p style="margin:0;color:var(--fg-2);font-size:14.5px">The '97 Civic still has the made-up log, expenses and service records it shipped with.</p>
      <div class="row" style="margin-top:10px"><button class="btn sm" data-act="sample-clear">${icon("trash")}Clear sample history</button></div></div>`;
  };
  NS.acts["sample-clear"] = () => { NS.closeSheet(); const r = run(true); if (r) report(r); };
  NS.acts["sample-undo"] = () => {
    let st = null; try { st = JSON.parse(localStorage.getItem(STASH) || "null"); } catch (e) {}
    if (!st || !st.vehicle) { NS.toast("Nothing to undo"); return; }
    NS.S.vehicles[VID] = { ...st.vehicle, sampleCleaned: "kept" };
    NS.S.meta.learned = st.learned; if (st.seen) NS.S.meta.seenBadges = st.seen;
    NS.commit("v:" + VID, { silent: true, noProgress: true }); NS.commit("meta", { silent: true, noProgress: true });
    NS.progressInit(); NS.closeSheet(); NS.render({ quiet: true }); NS.toast("Put the sample history back");
  };
})();
