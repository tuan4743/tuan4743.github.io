import fs from "node:fs";
import { WATER_CHART } from "../src/sim/charts/water.ts";
import { World } from "../src/sim/world.ts";
import { U } from "../src/sim/constants.ts";
const raw = JSON.parse(fs.readFileSync("../../.tmp/gd/water-route.best.json", "utf8"));
const w = new World(WATER_CHART); w.windowed = true;
const marks = [330, 335, 340, 343, 345, 346, 347];
let mi = 0;
for (const h of raw.tape) { if (w.dead || w.done) break; w.frame(h); if (mi < marks.length && w.x / U >= marks[mi]) { console.log("前缀 x=" + marks[mi] + " → y=" + (w.y/U).toFixed(2) + " vy=" + w.vy.toFixed(2) + " " + w.mode + " g=" + w.gdir + (w.onGround?"地":"空")); mi++; } }
console.log("末态:x=" + (w.x/U).toFixed(2) + " y=" + (w.y/U).toFixed(2) + " vy=" + w.vy.toFixed(2) + " dead=" + w.dead);
