// The phone app in a real browser at iPhone size: first run, every page, fitment, service, backups, earlier versions.
// Needs Playwright: `cd tests && npm install && npx playwright install chromium && npm test`.
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const ORIGIN = "https://sublevel.test";
const MIME = { html: "text/html", js: "text/javascript", css: "text/css", json: "application/json", webmanifest: "application/manifest+json", png: "image/png", woff2: "font/woff2" };
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? "PASS " : "FAIL ") + msg); };
const ROUTES = ["garage", "build", "fitment", "style", "log", "service", "money", "hunt", "inspect", "ask", "diy", "calc", "sound", "inventory", "rank"];

async function open(browser, seed) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: "block", acceptDownloads: true });
  await ctx.route(ORIGIN + "/**", (route) => {
    const f = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//, "") || "index.html";
    const fp = path.join(ROOT, f);
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, headers: { "content-type": MIME[f.split(".").pop()] || "application/octet-stream" }, body: fs.readFileSync(fp) });
  });
  await ctx.addInitScript((s) => { sessionStorage.setItem("sublevel.boot", "1"); if (s && !localStorage.getItem("sublevel.v1")) localStorage.setItem("sublevel.v1", s); }, seed || null);
  const p = await ctx.newPage(); p.errors = [];
  p.on("pageerror", (e) => p.errors.push(e.message));
  await p.goto(ORIGIN + "/", { waitUntil: "networkidle" }); await p.waitForTimeout(2300);
  return p;
}
const go = async (p, r) => { await p.evaluate((r) => NS.go(r), r); await p.waitForTimeout(200); };
const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);

(async () => {
  const browser = await chromium.launch();

  /* First run: welcome, sample car, simple mode */
  let p = await open(browser);
  const welcome = await p.$$eval("#sheet-root .day b", (x) => x.map((e) => e.textContent));
  check(welcome.join("|") === "Add my car|Look around first|Restore a backup", "welcome offers add / look around / restore");
  await p.click("#sheet-root .day[data-act=close-sheet]"); await p.waitForTimeout(300);
  check(!!(await p.$("button.nudge[data-act=add-vehicle]")), "sample car banner while looking around");
  check(await p.evaluate(() => NS.simple()), "new people start in simple mode");
  for (const m of ["simple", "full"]) {
    await p.evaluate((m) => { NS.S.meta.mode = m; NS.render(); }, m);
    let bad = [];
    for (const r of ROUTES) { await go(p, r); if ((await overflow(p)) > 0) bad.push(r); }
    check(bad.length === 0, `${m} mode: every page fits a 390px screen ${bad.join(",")}`);
  }
  check(p.errors.length === 0, "no script errors on any page " + JSON.stringify(p.errors));

  /* Fitment: presets, rear axle, measuring */
  await go(p, "fitment");
  await p.click('[data-act=fit-preset][data-i="2"]'); await p.waitForTimeout(300);
  check(/Rear/.test(await p.textContent("#fit-risk")), "15x8 +28 preset is limited by the rear");
  await p.click("[data-act=fit-axle][data-v=front]"); await p.waitForTimeout(150);
  check(/FRONT SECTION/.test(await p.textContent("#fit-front svg")), "drawing switches to the front axle");
  await p.click("[data-act=fit-measure]"); await p.waitForTimeout(300);
  await p.fill("#f_f_lip", "36"); await p.fill("#f_f_inner", "24"); await p.fill("#f_f_gap", "52");
  await p.click("[data-act=form-save]"); await p.waitForTimeout(400);
  const fit = await p.evaluate(() => NS.veh().specs.fitment);
  check(Math.abs(fit.lipOut - 74) <= 1 && Math.abs(fit.innerLimit - 161) <= 1 && fit.stockGap === 52, "stock-car measurements give the built-in numbers back " + JSON.stringify(fit));

  /* Service: Honda schedule, normal vs severe */
  await go(p, "service");
  const oil = () => p.evaluate(() => NS.veh().service.find((x) => x.id === "oil").everyMi);
  check((await oil()) === 3750, "severe schedule by default: oil every 3,750 mi");
  await p.click("[data-act=svc-driving][data-v=normal]"); await p.waitForTimeout(300);
  check((await oil()) === 7500, "normal schedule: oil every 7,500 mi");

  /* Add a real car by hand: the sample goes away */
  await p.evaluate(() => NS.acts["add-vehicle"]()); await p.waitForTimeout(300);
  await p.fill("#nc-text", "2002 Acura RSX Type-S"); await p.fill("#nc-miles", "140000");
  await p.click("[data-act=nc-manual]"); await p.waitForTimeout(1200);
  const cars = await p.evaluate(() => Object.values(NS.S.vehicles).map((v) => v.make + " " + v.model));
  check(cars.length === 1 && /Acura/.test(cars[0]), "adding a car replaces the sample: " + cars.join(", "));
  await p.evaluate(() => NS.closeSheet && NS.closeSheet());

  /* Log a session; stats and list agree */
  await go(p, "log");
  await p.click("[data-act=log-new]"); await p.waitForTimeout(300);
  await p.fill("#f_title", "Changed oil"); await p.click("[data-act=form-save]"); await p.waitForTimeout(400);
  const n = await p.evaluate(() => [document.querySelector(".kv .v").textContent, document.querySelectorAll(".timeline .entry").length]);
  check(n[0] === "1" && n[1] === 1, "log stats match the list: " + n.join("/"));

  /* Backup export, then earlier versions */
  await p.evaluate(() => NS.acts["settings-open"]()); await p.waitForTimeout(800);
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 8000 }).catch(() => null), p.click("[data-act=backup-export]")]);
  let backup = null; if (dl) { try { backup = JSON.parse(fs.readFileSync(await dl.path(), "utf8")); } catch (e) {} }
  check(backup && backup.app === "SUBLEVEL" && Object.keys(backup.state.vehicles).length === 1, "backup exports the whole garage as one file");
  const snaps = await p.evaluate(async () => (await NS.snapshots.list()).length);
  check(snaps >= 1, "an earlier version was saved before today's first change");
  check(p.errors.length === 0, "no script errors through the flows " + JSON.stringify(p.errors));
  await p.context().close();

  /* Restore that backup on a fresh phone */
  p = await open(browser);
  await p.evaluate(() => NS.closeSheet && NS.closeSheet());
  if (backup) {
    const file = path.join(require("os").tmpdir(), "sublevel-test-backup.json"); fs.writeFileSync(file, JSON.stringify(backup));
    await p.evaluate(() => NS.acts["settings-open"]()); await p.waitForTimeout(600);
    const [fc] = await Promise.all([p.waitForEvent("filechooser"), p.click("[data-act=backup-import]")]);
    await fc.setFiles(file); await p.waitForTimeout(800);
    await p.click("[data-act=backup-apply]"); await p.waitForTimeout(150); await p.click("[data-act=backup-apply]"); await p.waitForTimeout(1500);
    const restored = await p.evaluate(() => Object.values(NS.S.vehicles).map((v) => v.make));
    check(restored.length === 1 && restored[0] === "Acura", "restoring the backup brings the garage back: " + restored.join(","));
  }
  check(p.errors.length === 0, "no script errors on restore " + JSON.stringify(p.errors));
  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
