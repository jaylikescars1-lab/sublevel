/* Builds everything the Etsy shop needs from src/pages.html:
     dist/<Product>_US-Letter.pdf and _A4.pdf   the files buyers download (not committed: see README)
     listing/<product>/1-5.jpg                  listing photos, in upload order
     listing/pins/<product>.jpg                 Pinterest pins
   Run: node binder/build.cjs   (needs Node and Playwright with Chromium) */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const SRC = "file://" + path.join(ROOT, "src", "pages.html");
const DIST = path.join(ROOT, "dist");
const TMP = path.join(DIST, ".tmp");
const LISTING = path.join(ROOT, "listing");
const FONTS = "file://" + path.join(ROOT, "fonts", "fonts.css");

const slug = (name) => name.replace(/[^A-Za-z0-9]+/g, "-");
const mkdir = (d) => fs.mkdirSync(d, { recursive: true });

/* Which page each product leads with, and the selling points on its photos. */
const SELL = {
  binder: {
    hero: ["cover", "maint", "track"], detail: "inspect",
    points: ["Maintenance & service log", "Build plan & budget", "Parts & shopping lists", "Track day log & prep", "Used car inspection"],
  },
  maintenance: {
    hero: ["cover", "schedule", "maint"], detail: "schedule",
    points: ["Spec sheet: fluids, parts, torque", "Service schedule", "Maintenance log", "Fuel log & MPG", "Problems & fixes"],
  },
  inspection: {
    hero: ["inspect", "compare"], detail: "inspect",
    points: ["38-point inspection checklist", "Test drive checks", "Compare up to 3 cars", "Find the real price", "Know when to walk away"],
  },
  track: {
    hero: ["trackprep", "track"], detail: "track",
    points: ["Car prep checklist", "What to pack", "Session log with lap times", "Hot & cold tire pressures", "Setup notes"],
  },
};
const LABEL = { cover: "Cover", specs: "Spec sheet", schedule: "Service schedule", maint: "Maintenance log", fuel: "Fuel log", problems: "Problems & fixes", build: "Build plan", parts: "Parts inventory", budget: "Budget tracker", shopping: "Shopping list", torque: "Torque specs", trackprep: "Track day prep", track: "Track day log", inspect: "Used car inspection", compare: "Compare cars", journal: "Build journal" };

const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { width: var(--w); height: var(--h); overflow: hidden; background: #f2eee6; color: #121212; font-family: 'Barlow', sans-serif; font-weight: 500; position: relative; }
  .cond { font-family: 'Barlow Semi Condensed', sans-serif; font-weight: 700; text-transform: uppercase; }
  .kick { font: 700 15px 'Barlow', sans-serif; letter-spacing: .22em; text-transform: uppercase; color: #e4572e; }
  .pg { position: absolute; background: #fff; box-shadow: 0 18px 40px rgba(40,30,20,.22), 0 2px 6px rgba(40,30,20,.14); }
  .pg img { display: block; width: 100%; }
  .stripes { position: absolute; display: flex; gap: 10px; transform: skewX(-18deg); }
  .stripes i { display: block; height: 100%; }
  ul { list-style: none; }
  li { display: flex; align-items: center; gap: 12px; }
  li::before { content: ""; width: 10px; height: 10px; background: #e4572e; flex: none; }`;
const stripes = (style) => `<div class="stripes" style="${style}"><i style="width:22px;background:#e4572e"></i><i style="width:14px;background:#121212"></i><i style="width:8px;background:#121212"></i></div>`;

async function shot(browser, html, w, h, out) {
  const file = path.join(TMP, "compose.html");
  fs.writeFileSync(file, `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${FONTS}"><style>:root{--w:${w}px;--h:${h}px}${CSS}</style></head><body>${html}</body></html>`);
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await p.goto("file://" + file);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
  await p.screenshot({ path: out, type: "jpeg", quality: 90 });
  await p.close();
}

(async () => {
  mkdir(TMP);
  const browser = await chromium.launch();
  const probe = await browser.newPage();
  await probe.goto(SRC);
  const PRODUCTS = await probe.evaluate(() => window.PRODUCTS);
  await probe.close();

  for (const [key, prod] of Object.entries(PRODUCTS)) {
    const n = prod.pages.length;
    const ratio = 11 / 8.5;

    /* 1. the PDFs */
    for (const [size, label, format] of [["letter", "US-Letter", "Letter"], ["a4", "A4", "A4"]]) {
      const p = await browser.newPage();
      await p.goto(`${SRC}?product=${key}&size=${size}`);
      await p.waitForFunction(() => window.READY);
      const bad = await p.evaluate(() => [...document.querySelectorAll(".page, .pb, .ckcol")].filter((el) => el.scrollHeight > el.clientHeight + 1).length);
      if (bad) throw new Error(`${key} ${size}: content overflows a page`);
      const out = path.join(DIST, `${slug(prod.name)}_${label}.pdf`);
      await p.pdf({ path: out, format, printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
      await p.close();
      console.log("pdf ", path.relative(ROOT, out));
    }

    /* 2. page images for the photos */
    const pimg = {};
    {
      const p = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 2 });
      await p.goto(`${SRC}?product=${key}&size=letter&screen=1`);
      await p.waitForFunction(() => window.READY);
      for (const el of await p.$$(".page")) {
        const id = await el.getAttribute("data-id");
        pimg[id] = path.join(TMP, `${key}-${id}.png`);
        await el.screenshot({ path: pimg[id] });
      }
      await p.close();
    }
    const img = (id) => `<img src="file://${pimg[id]}">`;
    const dir = path.join(LISTING, key);
    mkdir(dir);
    const sell = SELL[key];
    const sizeLine = `${n} printable page${n > 1 ? "s" : ""} · US Letter + A4`;
    const titleWords = (prod.cover || prod.name.split(" ")).map((w) => `<div>${w}</div>`).join("");

    /* photo 1: hero */
    const fan = sell.hero.length === 3
      ? [[-7, 585, 215], [6, 815, 165], [0, 705, 255]]
      : [[-5, 610, 190], [4, 805, 225]];
    const longest = Math.max(...(prod.cover || prod.name.split(" ")).map((w) => w.length));
    const heroSize = Math.min(104, Math.floor(470 / (longest * 0.56)));
    await shot(browser, `
      <div style="position:absolute;left:70px;top:0;bottom:0;width:490px;display:flex;flex-direction:column;justify-content:center">
        <div class="kick">Printable PDF · Instant download</div>
        <div class="cond" style="font-size:${heroSize}px;line-height:.86;margin-top:22px">${titleWords}</div>
        <div style="font:600 22px 'Barlow';margin-top:24px;color:#5a554d">${sizeLine}</div>
        <ul style="margin-top:28px;display:flex;flex-direction:column;gap:12px;font:600 21px 'Barlow'">${sell.points.map((t) => `<li>${t}</li>`).join("")}</ul>
      </div>
      ${stripes("left:80px;bottom:-10px;height:90px")}
      ${sell.hero.map((id, i) => `<div class="pg" style="width:360px;left:${fan[i][1]}px;top:${fan[i][2]}px;transform:rotate(${fan[i][0]}deg)">${img(id)}</div>`).join("")}`,
      1200, 900, path.join(dir, "1-main.jpg"));

    /* photo 2: everything that's included */
    let cols = 1, tw = 0;
    for (let c = 1; c <= n; c++) {
      const w = Math.min(1100 / c - 22, (660 / Math.ceil(n / c) - 40) / ratio, 330);
      if (w > tw) { tw = w; cols = c; }
    }
    await shot(browser, `
      <div style="height:100%;display:flex;flex-direction:column;justify-content:center;padding-bottom:20px">
      <div style="text-align:center">
        <div class="kick">What's inside</div>
        <div class="cond" style="font-size:58px;line-height:1;margin-top:10px">${n} pages, ready to print</div>
      </div>
      <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:24px 22px;margin:36px auto 0;width:${cols * (tw + 22)}px">
        ${prod.pages.map((id) => `<div style="width:${tw}px"><div style="background:#fff;box-shadow:0 6px 16px rgba(40,30,20,.18)">${img(id).replace("<img", '<img style="width:100%;display:block"')}</div>
          <div style="font:700 ${n > 6 ? 13 : 17}px 'Barlow';text-align:center;margin-top:9px;text-transform:uppercase;letter-spacing:.06em">${LABEL[id]}</div></div>`).join("")}
      </div></div>`,
      1200, 900, path.join(dir, "2-inside.jpg"));

    /* photo 3: close-up of one page */
    await shot(browser, `
      <div class="pg" style="width:800px;left:390px;top:80px;transform:rotate(-4deg)">${img(sell.detail)}</div>
      <div style="position:absolute;left:0;top:0;width:380px;height:100%;background:linear-gradient(90deg,#f2eee6 85%,rgba(242,238,230,0))"></div>
      <div style="position:absolute;left:64px;top:0;bottom:0;width:290px;z-index:3;display:flex;flex-direction:column;justify-content:center">
        <div class="kick">Made to be used</div>
        <ul style="margin-top:22px;display:flex;flex-direction:column;gap:18px;font:600 22px/1.25 'Barlow'">
          <li>Big boxes for real handwriting</li><li>Easy on printer ink</li><li>Clean on paper or a tablet</li><li>Print it again whenever you need</li>
        </ul>
      </div>`,
      1200, 900, path.join(dir, "3-closeup.jpg"));

    /* photo 4: how it works */
    const step = (num, head, body) => `<div style="flex:1;background:#fff;padding:34px 30px;border-top:6px solid #121212;position:relative">
      <div class="cond" style="font-size:84px;line-height:.9;color:#e4572e">${num}</div>
      <div class="cond" style="font-size:34px;margin-top:14px">${head}</div>
      <div style="font:500 20px/1.4 'Barlow';margin-top:10px;color:#4a463f">${body}</div></div>`;
    await shot(browser, `
      <div style="padding:0 70px 30px;height:100%;display:flex;flex-direction:column;justify-content:center">
        <div class="kick">How it works</div>
        <div class="cond" style="font-size:64px;line-height:1;margin-top:10px">Download, print, done</div>
        <div style="display:flex;gap:26px;margin-top:46px">
          ${step(1, "Buy", "Checkout on Etsy like any other item.")}
          ${step(2, "Download", "Your PDFs are ready right away under Purchases. US Letter and A4 sizes are both included.")}
          ${step(3, "Print", "At home or at any print shop. Print as many copies as you need, for every car you own.")}
        </div>
        <div style="margin-top:40px;font:600 20px 'Barlow';color:#5a554d">This is a digital download. Nothing is shipped.${key === "binder" || key === "maintenance" ? " Tip: three-hole punch it and keep it in a binder in the car." : ""}</div>
      </div>
      ${stripes("right:70px;bottom:-10px;height:110px")}`,
      1200, 900, path.join(dir, "4-how-it-works.jpg"));

    /* Pinterest pin, 2:3 */
    mkdir(path.join(LISTING, "pins"));
    const pinFan = sell.hero.length === 3 ? [[-8, 20, 330], [7, 210, 300], [0, 115, 360]] : [[-6, 40, 330], [5, 190, 360]];
    await shot(browser, `
      <div style="padding:44px 36px 0">
        <div class="kick" style="font-size:12px">Printable · Instant download</div>
        <div class="cond" style="font-size:${prod.name.length > 18 ? 58 : 66}px;line-height:.88;margin-top:14px">${titleWords}</div>
        <div style="font:600 15px 'Barlow';margin-top:14px;color:#5a554d">${sizeLine}</div>
      </div>
      ${sell.hero.map((id, i) => `<div class="pg" style="width:250px;left:${pinFan[i][1]}px;top:${pinFan[i][2]}px;transform:rotate(${pinFan[i][0]}deg)">${img(id)}</div>`).join("")}
      ${stripes("right:36px;top:50px;height:90px")}`,
      500, 750, path.join(LISTING, "pins", `${key}.jpg`));

    console.log("pics", path.relative(ROOT, dir));
  }

  await browser.close();
  fs.rmSync(TMP, { recursive: true, force: true });
})().catch((e) => { console.error(e); process.exit(1); });
