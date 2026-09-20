import fs from "node:fs";
import { WATER_CHART } from "../src/sim/charts/water.ts";
import { World } from "../src/sim/world.ts";
import { U } from "../src/sim/constants.ts";
const raw = JSON.parse(fs.readFileSync("../../.tmp/gd/probe.best.json", "utf8"));
const w = new World(WATER_CHART); w.windowed = true;
const tr = [];
for (const h of raw.tape) { if (w.dead) break; w.frame(h); if (w.x/U > 474) tr.push((w.x/U).toFixed(1) + "/" + (w.y/U).toFixed(2) + (w.onGround?"地":"空")); }
console.log("末尾 24 个采样:"); console.log("  " + tr.slice(-24).join("  "));
console.log("末态:x=" + (w.x/U).toFixed(2) + " y=" + (w.y/U).toFixed(2) + " vy=" + w.vy.toFixed(2) + " " + w.mode + " 地=" + w.onGround);
