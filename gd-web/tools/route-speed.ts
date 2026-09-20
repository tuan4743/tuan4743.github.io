import fs from "node:fs";
import { WATER_CHART } from "../src/sim/charts/water.ts";
import { World } from "../src/sim/world.ts";
import { U } from "../src/sim/constants.ts";
const raw = JSON.parse(fs.readFileSync("../../.tmp/gd/water-route.best.json", "utf8"));
const w = new World(WATER_CHART); w.windowed = true;
const marks = [530, 545, 555, 562, 570, 580, 590, 600, 607];
let mi = 0;
for (const h of raw.tape) { if (w.dead || w.done) break; w.frame(h); if (mi < marks.length && w.x / U >= marks[mi]) { console.log("前缀 x=" + marks[mi] + " → y=" + (w.y/U).toFixed(2) + " " + w.mode + " g=" + w.gdir + (w.onGround?"地":"空")); mi++; } }
