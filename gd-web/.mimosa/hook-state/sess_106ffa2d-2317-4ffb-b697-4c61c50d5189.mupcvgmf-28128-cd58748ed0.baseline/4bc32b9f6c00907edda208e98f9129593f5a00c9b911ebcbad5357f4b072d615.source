import fs from "node:fs";
import { WATER_CHART } from "../src/sim/charts/water.ts";
import { World } from "../src/sim/world.ts";
import { U } from "../src/sim/constants.ts";
const raw = JSON.parse(fs.readFileSync("../../.tmp/gd/water-route.best.json", "utf8"));
const w = new World(WATER_CHART); w.windowed = true;
for (const h of raw.tape) { if (w.dead || w.done || w.x >= 439.5 * U) break; w.frame(h); }
console.log("x=439.5 处:mode=" + w.mode + " y=" + (w.y/U).toFixed(2) + " vy=" + w.vy.toFixed(2)
  + " onGround=" + w.onGround + " gdir=" + w.gdir + " speedIdx=" + w.speedIdx);
const w2 = new World(WATER_CHART); w2.windowed = true;
for (const h of raw.tape) { if (w2.dead || w2.done || w2.x >= 470 * U) break; w2.frame(h); }
console.log("x=470 处:mode=" + w2.mode + " y=" + (w2.y/U).toFixed(2) + " vy=" + w2.vy.toFixed(2) + " onGround=" + w2.onGround + " gdir=" + w2.gdir);
const w3 = new World(WATER_CHART); w3.windowed = true;
let n = 0;
for (const h of raw.tape) { if (w3.dead || w3.done || w3.x >= 484 * U) break; w3.frame(h); n++; }
console.log("x=484 处:mode=" + w3.mode + " y=" + (w3.y/U).toFixed(2) + " vy=" + w3.vy.toFixed(2) + " onGround=" + w3.onGround + " · 共 " + n + " 帧");
