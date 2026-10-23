/* Phone app mode: everything stays on this device. Data in localStorage, photos in IndexedDB, offline via service worker. */
(function () {
  const NS = window.NS;
  NS.standalone = true;
  const firstRun = (() => { try { return !localStorage.getItem("sublevel.v1"); } catch (e) { return false; } })();

  /* ---------- photos in IndexedDB ---------- */
  let dbp = null;
  const db = () => (dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open("sublevel", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("photos");
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const put = async (id, blob) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction("photos", "readwrite"); t.objectStore("photos").put(blob, id); t.oncomplete = res; t.onerror = () => rej(t.error); }); };
  const loadAll = async () => { const d = await db(); return new Promise((res) => { const req = d.transaction("photos").objectStore("photos").openCursor(); req.onsuccess = () => { const c = req.result; if (c) { NS.photoURL[c.key] = URL.createObjectURL(c.value); c.continue(); } else res(); }; req.onerror = () => res(); }); };
  NS.photoURL = {};
  NS.img = (id) => (id ? NS.photoURL[id] || "" : "");

  /* ---------- replace the claude.ai connections ---------- */
  NS.connect = async () => { NS.setSync("local", "ON THIS PHONE"); };
  NS.connectAI = async () => { NS.sample = null; NS.sampleImages = false; };
  NS.connectAssets = async () => {
    NS.assets = {
      upload: async (blob, opts = {}) => { const id = opts.id || NS.uid("p"); await put(id, blob); NS.photoURL[id] = URL.createObjectURL(blob); return { id, url: NS.photoURL[id] }; },
    };
    try { await loadAll(); } catch (e) {}
    NS.render({ quiet: true });
  };
  NS.downloads = {
    save: async ({ filename, data }) => {
      const file = new File([data], filename, { type: data.type || "application/octet-stream" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return { status: "saved" }; }
      const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      return { status: "saved" };
    },
  };

  /* Ask the Garage needs a Claude account; the phone app leaves it out. */
  const learn = NS.groups.find((g) => g.key === "LEARN");
  if (learn) learn.routes = learn.routes.filter((r) => r.r !== "ask");
  delete NS.views.ask;

  /* ---------- offline + keep my data ---------- */
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  /* ---------- first run + install hint ---------- */
  const installed = window.navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  window.addEventListener("load", () => {
    let dismissed = false; try { dismissed = localStorage.getItem("sublevel.installHint") === "no"; } catch (e) {}
    if (!installed && ios && !dismissed) {
      const el = document.createElement("div"); el.className = "install";
      el.innerHTML = `${NS.icon("share")}<span><b>Install SUBLEVEL:</b> tap the Share button in Safari, then <b>Add to Home Screen</b>.</span><button class="iconbtn" aria-label="Dismiss">${NS.icon("x")}</button>`;
      el.querySelector("button").onclick = () => { el.remove(); try { localStorage.setItem("sublevel.installHint", "no"); } catch (e) {} };
      document.body.appendChild(el);
    }
    if (firstRun) setTimeout(() => {
      NS.sheet(NS.sheetHead("WELCOME TO SUBLEVEL", "Your garage lives on this phone") + `
        <p class="muted" style="margin:0 0 14px;font-size:15px">Nothing gets uploaded. Your build, log, money and photos stay on this device and work with no signal.</p>
        <div class="day-grid" style="grid-template-columns:1fr">
          <button class="day" data-act="welcome-import"><b>Bring my garage over</b><span>Import the backup you exported from SUBLEVEL on claude.ai</span></button>
          <button class="day" data-act="close-sheet"><b>Look around first</b><span>Start with the sample '97 Civic build. You can import later from Backup.</span></button>
        </div>`);
    }, 1900);
  });
  NS.acts["welcome-import"] = () => NS.acts["backup-open"]();
})();
