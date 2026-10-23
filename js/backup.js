/* Backup + restore: one JSON file with the whole garage and its photos. Works on claude.ai and in the phone app. */
(function () {
  const NS = window.NS;
  const { esc, icon } = NS;
  const DOCS = ["meta", "hunt", "inventory", "style", "checklist"];

  const photoIds = (S) => {
    const ids = new Set();
    for (const v of Object.values(S.vehicles)) {
      if (v.photo) ids.add(v.photo);
      v.mods.forEach((m) => (m.photos || []).forEach((p) => ids.add(p)));
      v.log.forEach((l) => (l.photos || []).forEach((p) => ids.add(p)));
    }
    S.style.items.forEach((p) => p.photo && ids.add(p.photo));
    S.hunt.items.forEach((h) => h.photo && ids.add(h.photo));
    return Array.from(ids);
  };
  const toDataURL = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
  const fromDataURL = async (u) => (await fetch(u)).blob();

  NS.where = () => (NS.standalone ? "on this phone" : NS.db ? "in your claude.ai garage" : "in this browser");
  const daysSince = (iso) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 864e5) : null);

  NS.acts["backup-open"] = () => {
    const last = NS.S.meta.lastBackup; const d = daysSince(last);
    NS.sheet(NS.sheetHead("YOUR DATA", "Backup + restore") + `
      <div class="infobox"><h4>WHERE IT LIVES</h4><p style="margin:0;color:var(--fg-2);font-size:14.5px">Everything is saved <b style="color:var(--fg)">${esc(NS.where())}</b>.${NS.standalone ? " Nothing is uploaded anywhere. If you delete the app or clear Safari's website data, it's gone, so keep a backup in Files or iCloud Drive." : ""}</p></div>
      <div class="grid g2" style="margin-top:14px">
        <div class="stat"><div class="k">Last backup</div><div class="v" style="font-size:20px">${last ? (d === 0 ? "Today" : d + "d ago") : "Never"}</div></div>
        <div class="stat"><div class="k">Photos</div><div class="v" style="font-size:20px">${photoIds(NS.S).length}</div></div>
      </div>
      <div id="bk-msg" class="muted" style="font-size:14px;margin-top:12px"></div>
      <div class="sheet-foot">
        <button class="btn" data-act="backup-import">${icon("box")}Import a backup</button>
        <span class="grow"></span>
        <button class="btn primary" data-act="backup-export">${icon("share")}Export backup</button>
      </div>`);
  };

  NS.acts["backup-export"] = async (el) => {
    const msg = document.getElementById("bk-msg"); el.disabled = true; msg.textContent = "Packing your garage…";
    try {
      const S = NS.clone(NS.S); const photos = {};
      for (const id of photoIds(S)) {
        try { const src = NS.img(id); if (!src) continue; const b = await (await fetch(src)).blob(); if (b.size) photos[id] = await toDataURL(b); } catch (e) { /* skip unreadable photo */ }
      }
      const file = { app: "SUBLEVEL", version: 1, exportedAt: new Date().toISOString(), state: S, photos };
      const blob = new Blob([JSON.stringify(file)], { type: "application/json" });
      const name = `sublevel-backup-${NS.today()}.json`;
      if (!NS.downloads) throw { code: "unavailable" };
      await NS.downloads.save({ filename: name, data: blob });
      NS.S.meta.lastBackup = new Date().toISOString(); NS.commit("meta", { silent: true });
      msg.innerHTML = `<span class="ok">Backup saved.</span> ${Object.keys(photos).length} photo${Object.keys(photos).length === 1 ? "" : "s"} included.`;
    } catch (e) {
      msg.textContent = e && e.code === "cancelled" ? "" : e && e.name === "AbortError" ? "" : "Couldn't save the backup here. Try again, or export from the other version of SUBLEVEL.";
    } finally { el.disabled = false; }
  };

  NS.acts["backup-import"] = () => {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = "application/json,.json";
    inp.onchange = async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      const msg = document.getElementById("bk-msg");
      try {
        const data = JSON.parse(await f.text());
        const st = data && data.state;
        if (!st || !st.vehicles || !st.meta || !Object.keys(st.vehicles).length) throw new Error("bad");
        NS._pendingImport = data;
        const v = Object.values(st.vehicles)[0];
        msg.innerHTML = `Backup from <b style="color:var(--fg)">${esc(new Date(data.exportedAt || Date.now()).toLocaleDateString())}</b>: ${Object.keys(st.vehicles).length} car${Object.keys(st.vehicles).length > 1 ? "s" : ""} (${esc(NS.vehLabel(v))}), ${v.log.length} log entries, ${Object.keys(data.photos || {}).length} photos.
          <div class="row" style="margin-top:10px"><button class="btn danger" data-act="backup-apply">${icon("check")}Replace everything with this</button></div>`;
      } catch (e) { msg.textContent = "That file isn't a SUBLEVEL backup."; }
    };
    inp.click();
  };

  NS.acts["backup-apply"] = async (el) => {
    if (!el.classList.contains("armed")) { el.classList.add("armed"); el.lastChild.textContent = "Tap again to replace"; return; }
    const data = NS._pendingImport; if (!data) return;
    const msg = document.getElementById("bk-msg"); msg.textContent = "Restoring…";
    const st = NS.clone(data.state);
    // photos first, so ids can be remapped if this store hands out new ones
    const remap = {};
    for (const [id, url] of Object.entries(data.photos || {})) {
      try { const b = await fromDataURL(url); if (NS.assets && NS.assets.upload) { const r = await NS.assets.upload(b, NS.standalone ? { id } : { type: b.type || "image/jpeg" }); remap[id] = r.id; } } catch (e) {}
    }
    const fix = (id) => (id && remap[id]) || id;
    for (const v of Object.values(st.vehicles)) {
      v.photo = fix(v.photo);
      v.mods.forEach((m) => (m.photos = (m.photos || []).map(fix)));
      v.log.forEach((l) => (l.photos = (l.photos || []).map(fix)));
    }
    st.style.items.forEach((p) => (p.photo = fix(p.photo)));
    st.hunt.items.forEach((h) => (h.photo = fix(h.photo)));
    const S = NS.S; const old = Object.keys(S.vehicles);
    DOCS.forEach((k) => (S[k] = st[k] || S[k]));
    S.vehicles = st.vehicles;
    if (!S.vehicles[S.meta.active]) S.meta.active = Object.keys(S.vehicles)[0];
    NS.migrate();
    old.filter((id) => !S.vehicles[id]).forEach((id) => NS.commit("v:" + id, { silent: true, noProgress: true }));
    Object.keys(S.vehicles).forEach((id) => NS.commit("v:" + id, { silent: true, noProgress: true }));
    DOCS.forEach((k) => NS.commit(k, { silent: true, noProgress: true }));
    NS._pendingImport = null; NS.progressInit && NS.progressInit();
    NS.closeSheet(); NS.go("garage"); NS.toast("Garage restored");
  };

  /* Gentle reminder on the phone app: the only copy of your garage is on this device. */
  NS.backupNudge = function () {
    if (!NS.standalone) return "";
    const d = daysSince(NS.S.meta.lastBackup);
    if (d != null && d < 14) return "";
    return `<button class="nudge" data-act="backup-open">${icon("box")}<span><b>${d == null ? "No backup yet." : `Last backup ${d} days ago.`}</b> Your garage only lives on this phone. Save a copy to Files.</span>${icon("chev")}</button>`;
  };
})();
