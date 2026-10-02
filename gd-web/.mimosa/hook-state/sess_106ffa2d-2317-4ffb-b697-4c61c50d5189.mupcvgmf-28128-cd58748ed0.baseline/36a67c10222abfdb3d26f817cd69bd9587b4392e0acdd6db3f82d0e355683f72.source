import fs from "node:fs";
import { WATER_CHART } from "../src/sim/charts/water.ts";
import { World } from "../src/sim/world.ts";
import { U } from "../src/sim/constants.ts";
import { hitboxOf } from "../src/sim/gdids.ts";
console.log("x=328~344 的物件:");
for (const o of WATER_CHART.objects.filter((o) => o.b >= 328 && o.b <= 344).sort((a, b) => a.b - b.b)) {
  const hb = hitboxOf(o);
  console.log("  " + o.kind + (o.id != null ? "#" + o.id : "") + (o.to ? "→" + o.to : "") + (o.pad ? "(" + o.pad + ")" : "")
    + (o.orb ? "(" + o.orb + ")" : "") + (o.gdir != null ? " g" + o.gdir : "") + (o.rot ? " rot" + o.rot : "")
    + " b=" + o.b.toFixed(1) + " r=" + o.r.toFixed(1) + (hb ? " 判定=" + hb[0].toFixed(0) + "×" + hb[1].toFixed(0) : ""));
}
const raw = JSON.parse(fs.readFileSync("../../.tmp/gd/water-route.best.json", "utf8"));
const w = new World(WATER_CHART); w.windowed = true;
const marks = [325, 328, 330, 332, 333];
let mi = 0;
for (const h of raw.tape) { if (w.dead || w.done) break; w.frame(h); if (mi < marks.length && w.x / U >= marks[mi]) { console.log("前缀 x=" + marks[mi] + " → y=" + (w.y/U).toFixed(2) + " vy=" + w.vy.toFixed(2) + " " + w.mode + " g=" + w.gdir + (w.onGround?"地":"空")); mi++; } }
console.log("前缀末态:x=" + (w.x/U).toFixed(2) + " y=" + (w.y/U).toFixed(2) + " " + w.mode);
