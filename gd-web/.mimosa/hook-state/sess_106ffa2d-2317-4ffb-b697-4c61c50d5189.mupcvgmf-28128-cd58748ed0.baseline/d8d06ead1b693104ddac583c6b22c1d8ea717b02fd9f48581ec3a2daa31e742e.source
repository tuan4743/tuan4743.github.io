import fs from "node:fs";
import { WATER_CHART } from "../src/sim/charts/water.ts";
import { World } from "../src/sim/world.ts";
const raw = JSON.parse(fs.readFileSync("../../.tmp/gd/water-noskip.best.json", "utf8"));
console.log("活着的最远前缀:x=" + raw.x + " 块 · " + raw.tape.length + " 帧");
const w = new World(WATER_CHART);
let last = [];
for (const h of raw.tape) { if (w.dead) break; w.frame(h); }
console.log("回放到头:mode=" + w.mode + " y=" + (w.y / 30).toFixed(1) + " 块 gdir=" + w.gdir + " vy=" + w.vy.toFixed(2) + " dead=" + w.dead);
/* 最后 40 帧的高度轨迹 */
const w2 = new World(WATER_CHART);
const t = raw.tape; const traj = [];
for (let i = 0; i < t.length; i++) { if (w2.dead) break; w2.frame(t[i]); if (i > t.length - 40) traj.push((w2.y / 30).toFixed(1)); }
console.log("最后 40 帧高度(块):" + traj.join(" "));
