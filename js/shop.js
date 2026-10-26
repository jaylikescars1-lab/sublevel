/* Shop parts: Amazon and eBay searches for the parts a job needs.
   Affiliate IDs go in AFF once the accounts exist; until then the links are plain searches. */
(function () {
  const NS = window.NS;
  const { esc, icon } = NS;
  const AFF = {
    amazon: "", // Amazon Associates tracking ID, like "sublevel-20"
    ebay: "",   // eBay Partner Network campaign ID, like "5339012345"
  };

  NS.shopURL = function (where, q) {
    const k = encodeURIComponent(q);
    if (where === "amazon") return `https://www.amazon.com/s?k=${k}${AFF.amazon ? "&tag=" + encodeURIComponent(AFF.amazon) : ""}`;
    return `https://www.ebay.com/sch/i.html?_nkw=${k}${AFF.ebay ? `&mkcid=1&mkrid=711-53200-19255-0&siteid=0&campid=${encodeURIComponent(AFF.ebay)}&toolid=10001&mkevt=1` : ""}`;
  };
  const carQ = (v, engine) => [v.year, v.make, v.model, engine && v.engine].filter(Boolean).join(" ");
  const clean = (s) => String(s || "").replace(/\((?:x?\d+[^)]*|pair|borrow|rent|later)\)/gi, "").replace(/\s+/g, " ").trim();

  function sheet(title, rows) {
    const links = (q) => `<a class="btn sm" href="${esc(NS.shopURL("amazon", q))}" target="_blank" rel="noopener sponsored">Amazon</a><a class="btn sm" href="${esc(NS.shopURL("ebay", q))}" target="_blank" rel="noopener sponsored">eBay</a>`;
    NS.sheet(NS.sheetHead("SHOP", title) + `
      <div class="shop-list">${rows.map((r) => `<div class="shop-row"><span>${esc(r.label)}</span><span class="row" style="gap:6px;flex-wrap:nowrap">${links(r.q)}</span></div>`).join("")}</div>
      <p class="dim" style="font-size:13px;margin:12px 0 0">Opens a search. Check that it fits your exact car before you buy.${AFF.amazon || AFF.ebay ? " SUBLEVEL may earn a small commission on purchases, at no cost to you." : ""}</p>`);
  }

  /* Parts for one roadmap item (or the item itself when it has no parts list). */
  NS.acts["shop-mod"] = (el) => {
    const v = NS.veh(); const m = v.mods.find((x) => x.id === el.dataset.id); if (!m) return;
    const engine = m.system === "ENGINE";
    const items = (m.parts || []).length ? m.parts : [m.title.replace(/^[^:]+:\s*/, "") || m.title];
    sheet(m.title, items.map((p) => ({ label: p, q: `${carQ(v, engine)} ${clean(p)}` })));
  };
  /* Whatever the Next Move still needs: parts are car-specific, tools aren't. */
  NS.acts["shop-next"] = () => {
    const v = NS.veh(); const m = NS.nextMoves(v)[0]; if (!m || !(m.need || []).length) return;
    const parts = new Set((m.mod && m.mod.parts) || []);
    sheet(m.title, m.need.map((p) => ({ label: p, q: parts.has(p) ? `${carQ(v, m.mod && m.mod.system === "ENGINE")} ${clean(p)}` : clean(p) })));
  };
  /* The wheel and tire setup on the Fitment page. */
  NS.acts["shop-fit"] = () => {
    const s = NS.fitState(); const v = NS.veh(); const bolt = v.specs && v.specs.wheels && v.specs.wheels.bolt;
    const off = (s.offset >= 0 ? "+" : "") + s.offset;
    sheet(`${s.dia}x${s.width} ${off} · ${s.tw}/${s.ar}R${s.dia}`, [
      { label: `Wheels ${s.dia}x${s.width} ${off}${bolt ? " · " + bolt : ""}`, q: `${s.dia}x${s.width} ${off} ${bolt || carQ(v)} wheels` },
      { label: `Tires ${s.tw}/${s.ar}R${s.dia}`, q: `${s.tw}/${s.ar}R${s.dia} tires` },
      { label: "Lug nuts", q: `${carQ(v)} lug nuts` },
    ]);
  };
})();
