// Wheel fitment engine against real-world EK/EJ Civic setups. Plain Node, no dependencies: `node tests/fit.test.cjs`.
// Uses the numbers the app ships (js/data.js), so a change to those constants is checked here too.
const path = require("path");
global.window = global;
require(path.join(__dirname, "..", "js", "data.js"));
require(path.join(__dirname, "..", "js", "fit.js"));
const F = window.NS.fit, D = window.NS_DATA.fit;
const front = { stock: D.stock, lipOut: D.lipOut, innerLimit: D.innerLimit, stockGap: D.stockGap, suspension: D.suspension, stockCamber: D.stockCamber, bump: D.bump };
const rear = { ...front, ...D.rear };
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? "PASS " : "FAIL ") + msg); };
const IN = 25.4;

// 1. Owner reports the front constants were calibrated on (all must match).
const tuned = [
  ["Stock 14x5.5 +45 185/65", { dia: 14, width: 5.5, offset: 45, tw: 185, ar: 65, drop: 0 }, (r) => r.margin >= 5 && r.innerClear >= 10 && r.poke < -15],
  ["15x7 +38 205/50, 1.5in: common no-roll", { dia: 15, width: 7, offset: 38, tw: 205, ar: 50, drop: 1.5 }, (r) => r.margin >= 0 && r.innerClear >= 5],
  ["15x7 +35 205/50, 1in", { dia: 15, width: 7, offset: 35, tw: 205, ar: 50, drop: 1 }, (r) => r.margin >= 0 && r.innerClear >= 5],
  ["15x7 +40 195/50, 1in", { dia: 15, width: 7, offset: 40, tw: 195, ar: 50, drop: 1 }, (r) => r.margin >= 5 && r.innerClear >= 5],
  ["16x7 +40 205/45, 1in", { dia: 16, width: 7, offset: 40, tw: 205, ar: 45, drop: 1 }, (r) => r.margin >= 0 && r.innerClear >= 5],
  ["16x7 +45 205/45, 1in: inner OK", { dia: 16, width: 7, offset: 45, tw: 205, ar: 45, drop: 1 }, (r) => r.innerClear >= 3],
  ["16x8 +22 215/40, stock height: pokes, late rub", { dia: 16, width: 8, offset: 22, tw: 215, ar: 40, drop: 0 }, (r) => r.poke > 0 && r.margin < 0 && r.rubAt > r.travel * 0.6],
  ["15x8 +25 195/50, 2in, stock lip: tight", { dia: 15, width: 8, offset: 25, tw: 195, ar: 50, drop: 2 }, (r) => r.margin < 3],
  ["15x8 +25 195/50, 2in, rolled: fits", { dia: 15, width: 8, offset: 25, tw: 195, ar: 50, drop: 2, fenders: "rolled" }, (r) => r.margin >= 0],
  ["15x8 +45 205/50, 1in: too close to the strut", { dia: 15, width: 8, offset: 45, tw: 205, ar: 50, drop: 1 }, (r) => r.innerClear < 5],
  ["15x8 +0 195/50, 2in: way out", { dia: 15, width: 8, offset: 0, tw: 195, ar: 50, drop: 2 }, (r) => r.margin < 0 && r.poke > 20],
];
tuned.forEach(([n, s, t]) => check(t(F.calc(front, s)), "front, tuned on: " + n));

// 2. Holdout: front reports the constants were NOT tuned on. One is a known near-miss (poke 9 mm vs "flush"), so require 5 of 6.
const holdout = [
  ["16x7 +42 205/45, stock: no rub, near flush", { dia: 16, width: 7, offset: 42, tw: 205, ar: 45, drop: 0 }, (r) => r.margin >= 3 && r.innerClear >= 3 && r.poke < 3],
  ["15x7 +40 185/55, ~1.5in: no rub", { dia: 15, width: 7, offset: 40, tw: 185, ar: 55, drop: 1.5 }, (r) => r.margin >= 0 && r.innerClear >= 0],
  ["16x8 +20 215/40, 1.5in, stock lips: needs a roll", { dia: 16, width: 8, offset: 20, tw: 215, ar: 40, drop: 1.5 }, (r) => r.margin < 3],
  ["16x8 +20 215/40, 1.5in, rolled: a squeeze", { dia: 16, width: 8, offset: 20, tw: 215, ar: 40, drop: 1.5, fenders: "rolled" }, (r) => r.margin > -4 && r.innerClear > 0],
  ["15x8 +25 195/50, 2in, rolled, -2°: flush", { dia: 15, width: 8, offset: 25, tw: 195, ar: 50, drop: 2, fenders: "rolled", camber: -2 }, (r) => r.margin >= 0 && Math.abs(r.poke) <= 8],
  ["15x8 +0, stock lips: way past the fenders", { dia: 15, width: 8, offset: 0, tw: 195, ar: 50, drop: 1 }, (r) => r.poke > 20],
];
const hold = holdout.map(([n, s, t]) => { const ok = t(F.calc(front, s)); console.log((ok ? "  ok   " : "  miss ") + "front, holdout: " + n); return ok; }).filter(Boolean).length;
check(hold >= 5, `front holdout: ${hold}/6 match (5 needed)`);

// 3. Rear axle against owner reports.
const rearCases = [
  ["16x7 +42 205/45, stock: clears", { dia: 16, width: 7, offset: 42, tw: 205, ar: 45, drop: 0 }, (r) => r.margin >= 5],
  ["15x7 +40 185/55, 1in: clears", { dia: 15, width: 7, offset: 40, tw: 185, ar: 55, drop: 1 }, (r) => r.margin >= 5],
  ["15x8 +25 205/50, 2in, rolled: at the edge", { dia: 15, width: 8, offset: 25, tw: 205, ar: 50, drop: 2, fenders: "rolled" }, (r) => r.margin > -4 && r.margin < 6],
  ["15x8 +25 195/50, 2in, stock: needs a roll", { dia: 15, width: 8, offset: 25, tw: 195, ar: 50, drop: 2 }, (r) => r.margin < 3],
  ["16x8 +20 215/40, 1.5in, rolled: a squeeze", { dia: 16, width: 8, offset: 20, tw: 215, ar: 40, drop: 1.5, fenders: "rolled" }, (r) => r.margin > -3 && r.margin < 10],
];
rearCases.forEach(([n, s, t]) => check(t(F.calc(rear, s)), "rear: " + n));

// 4. Physics rules the engine is built on.
const t15 = (w) => F.tire(205, 50, 15, w);
check(Math.abs(t15(7.5).S - t15(6.5).S - 0.4 * IN) < 0.01, "section width grows 0.4 mm per mm of rim (ETRTO)");
check(Math.abs(F.tire(185, 65, 14, 5.5).OD - (14 * IN + 2 * 185 * 0.65)) < 0.01, "overall diameter = rim + 2 sidewalls");
const cam = (c) => F.calc(front, { dia: 15, width: 8, offset: 25, tw: 195, ar: 50, drop: 2, fenders: "rolled", camber: c }).margin;
check(cam(-3) > cam(-1), "more negative camber adds lip clearance");
const off = (o) => F.calc(front, { dia: 15, width: 7, offset: o, tw: 205, ar: 50, drop: 1.5 });
check(off(45).innerClear < off(35).innerClear && off(45).margin > off(35).margin, "higher offset: less strut room, more lip room");

// 5. Tape measurements turn back into the car's numbers.
[["front", front], ["rear", rear]].forEach(([name, b]) => {
  const s = { dia: 15, width: 7, offset: 38, tw: 205, ar: 50, drop: 1.5 };
  const r = F.calc(b, { ...s, fenders: "stock" }); const w = F.wheel(15, 7), tl = (r.tilt0 * Math.PI) / 180;
  const back = F.fromMeasure({ ...s, stock: b.stock, camber: r.camber, suspension: b.suspension, lip: r.lipX - (-s.offset + (w.Wo / 2) * Math.cos(tl) - w.Rf * Math.sin(tl)), inner: r.innerClear, gap: r.gap });
  check(Math.abs(back.lipOut - b.lipOut) <= 1 && Math.abs(back.innerLimit - b.innerLimit) <= 1 && Math.abs(back.stockGap - b.stockGap) <= 1, `${name}: measurements round-trip to lip ${back.lipOut}, strut ${back.innerLimit}, gap ${back.stockGap}`);
});

console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
process.exit(fails ? 1 : 0);
