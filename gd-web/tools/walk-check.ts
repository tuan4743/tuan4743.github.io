import { WATER_CHART } from "../src/sim/charts/water.ts";
import { World } from "../src/sim/world.ts";
import { U } from "../src/sim/constants.ts";
const SX = Number(process.argv[2] ?? 481), SY = Number(process.argv[3] ?? 6);
const w = new World(WATER_CHART); w.windowed = true;
w.x = SX * U; w.y = SY * U; w.vy = 0; w.onGround = true; w.mode = "spider"; w.speedIdx = 0;
w.checkX = w.x; w.checkY = w.y;
const tr = [];
for (let i = 0; i < 120; i++) { if (w.dead) break; w.frame(false); if (i % 4 === 0) tr.push((w.x/U).toFixed(2)+"/"+(w.y/U).toFixed(2)); }
console.log("从 " + SX + " 不按键:" + (w.dead ? "死" : "活") + " x=" + (w.x/U).toFixed(2) + " y=" + (w.y/U).toFixed(2));
console.log("  " + tr.join(" "));
const i0 = w.x + w.innerOff, i1 = i0 + w.innerSize, j0 = w.y + w.innerOff, j1 = j0 + w.innerSize;
const o0 = w.x, o1 = w.x + w.box, p0 = w.y, p1 = w.y + w.box;
console.log("  内框 x=[" + (i0/U).toFixed(2) + "," + (i1/U).toFixed(2) + "] y=[" + (j0/U).toFixed(2) + "," + (j1/U).toFixed(2) + "]");
console.log("  外框 x=[" + (o0/U).toFixed(2) + "," + (o1/U).toFixed(2) + "] y=[" + (p0/U).toFixed(2) + "," + (p1/U).toFixed(2) + "]");
for (const b of [...w.nearHazards, ...w.nearSolids]) {
  const hitIn = i1 > b.x0 && i0 < b.x1 && j1 > b.y0 && j0 < b.y1;
  const hitOut = o1 > b.x0 && o0 < b.x1 && p1 > b.y0 && p0 < b.y1;
  if (hitIn || hitOut) console.log("  " + (hitIn ? "内框" : "外框") + "相交 " + b.o.kind + (b.o.id != null ? "#" + b.o.id : "") + (b.o.rot ? " rot" + b.o.rot : "")
    + " 盒=[" + (b.x0/U).toFixed(2) + "," + (b.x1/U).toFixed(2) + "]x[" + (b.y0/U).toFixed(2) + "," + (b.y1/U).toFixed(2) + "]");
}
