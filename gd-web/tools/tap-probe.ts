import fs from "node:fs";
import { WATER_CHART } from "../src/sim/charts/water.ts";
import { World } from "../src/sim/world.ts";
import { U } from "../src/sim/constants.ts";
const raw = JSON.parse(fs.readFileSync("../../.tmp/gd/water-route.best.json", "utf8"));
function run(tapAt: number, taps = 1) {
  const w = new World(WATER_CHART); w.windowed = true;
  for (const h of raw.tape) { if (w.dead || w.done) break; w.frame(h); }
  const x0 = w.x / U, g0 = w.gdir;
  for (let i = 0; i < 200; i++) {
    if (w.dead || w.done) break;
    const hold = i >= tapAt && i < tapAt + taps;
    w.frame(hold);
    if (w.x / U > 530) break;
  }
  return { x0, g0, x: w.x / U, y: w.y / U, g: w.gdir, mode: w.mode, dead: w.dead };
}
console.log("种子末端:x=" + run(0, 0).x0.toFixed(2) + " 重力=" + run(0, 0).g0);
for (const t of [0, 2, 5, 10]) {
  const r = run(t, 1);
  console.log("第 " + t + " 帧点一下(1 帧):到 x=" + r.x.toFixed(1) + " y=" + r.y.toFixed(1)
    + " 重力=" + r.g + " " + r.mode + (r.dead ? " 死" : "") + (r.x > 527 ? "  ✓ 过了 cube 门" : "  ✗ 没过去"));
}
