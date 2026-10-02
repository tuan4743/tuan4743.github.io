import fs from "node:fs";
import { WATER_CHART } from "../src/sim/charts/water.ts";
import { World } from "../src/sim/world.ts";
import { U } from "../src/sim/constants.ts";
const raw = JSON.parse(fs.readFileSync("../../.tmp/gd/water.best.tape.json", "utf8"));
console.log("best tape: x=" + raw.x.toFixed(1) + " · " + raw.tape.length + " 帧");
const w = new World(WATER_CHART); w.windowed = true;
for (const h of raw.tape) { if (w.dead || w.done) break; w.frame(h); }
console.log("回放: x=" + (w.x / U).toFixed(2) + " y=" + (w.y / U).toFixed(2) + " mode=" + w.mode
  + " vy=" + w.vy.toFixed(2) + " gdir=" + w.gdir + " dead=" + w.dead);
/* 谁杀的 */
const i0 = w.x + w.innerOff, i1 = i0 + w.innerSize, j0 = w.y + w.innerOff, j1 = j0 + w.innerSize;
const hit = [...w.nearHazards, ...w.nearSolids].filter((b) => i1 > b.x0 && i0 < b.x1 && j1 > b.y0 && j0 < b.y1);
console.log("内框 x=[" + (i0/U).toFixed(2) + "," + (i1/U).toFixed(2) + "] y=[" + (j0/U).toFixed(2) + "," + (j1/U).toFixed(2) + "]");
for (const b of hit.slice(0, 6)) {
  const o = b.o;
  console.log("  撞到 " + o.kind + (o.id != null ? "#" + o.id : "") + (o.rot ? " rot" + o.rot : "")
    + " b=" + o.b.toFixed(2) + " r=" + o.r.toFixed(2) + " 盒=[" + (b.x0/U).toFixed(2) + "," + (b.x1/U).toFixed(2)
    + "]x[" + (b.y0/U).toFixed(2) + "," + (b.y1/U).toFixed(2) + "]");
}
if (!hit.length) console.log("  (没有相交盒子 → 掉出世界或被判出界)");
