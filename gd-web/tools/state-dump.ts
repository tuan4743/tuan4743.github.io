import fs from "node:fs";
import { WATER_CHART } from "../src/sim/charts/water.ts";
import { World } from "../src/sim/world.ts";
import { U } from "../src/sim/constants.ts";
const raw = JSON.parse(fs.readFileSync("../../.tmp/gd/water-route.best.json", "utf8"));
const w = new World(WATER_CHART); w.windowed = true;
for (const h of raw.tape) { if (w.dead || w.done) break; w.frame(h); }
const tr = [];
for (let i = 0; i < 120; i++) {
  if (w.dead) break;
  w.frame(false);
  if (i % 6 === 0) tr.push((w.x/U).toFixed(2) + "/" + (w.y/U).toFixed(2) + (w.onGround?"地":"空"));
}
console.log("从种子末端不按键:" + (w.dead ? "死" : "活") + " x=" + (w.x/U).toFixed(2) + " y=" + (w.y/U).toFixed(2) + " " + w.mode + " g=" + w.gdir);
console.log("  " + tr.join("  "));
const i0 = w.x + w.innerOff, i1 = i0 + w.innerSize, j0 = w.y + w.innerOff, j1 = j0 + w.innerSize;
for (const b of [...w.nearHazards, ...w.nearSolids]) {
  if (i1 > b.x0 && i0 < b.x1 && j1 > b.y0 && j0 < b.y1) console.log("  内框撞到 " + b.o.kind + (b.o.id != null ? "#" + b.o.id : "") + (b.o.rot ? " rot" + b.o.rot : "")
    + " 盒=[" + (b.x0/U).toFixed(2) + "," + (b.x1/U).toFixed(2) + "]x[" + (b.y0/U).toFixed(2) + "," + (b.y1/U).toFixed(2) + "]");
}
