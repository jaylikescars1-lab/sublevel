/* Boot: clock, first route, then light up the shared store and photo uploads. */
(function () {
  const NS = window.NS;
  const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  function tick() {
    const d = new Date();
    const h = String(d.getHours()).padStart(2, "0"), m = String(d.getMinutes()).padStart(2, "0");
    NS.$("#clock-t").innerHTML = `${h}<b>:</b>${m}`;
    NS.$("#clock-d").textContent = `${DAYS[d.getDay()]} ${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  }
  tick(); setInterval(tick, 10000);

  let start = (location.hash || "").slice(1);
  if (!NS.views[start]) start = "garage";
  NS.go(start);
  window.addEventListener("hashchange", () => { const r = location.hash.slice(1); if (NS.views[r] && r !== NS.route) NS.go(r); });

  NS.progressInit();
  NS.cleanSample();
  NS.boot();
  NS.connect();
  NS.connectAssets();
  NS.connectAI();
})();
