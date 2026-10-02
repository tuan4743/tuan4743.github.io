import fs from "node:fs";
import { WATER_CHART } from "../src/sim/charts/water.ts";
import { World } from "../src/sim/world.ts";
import { U } from "../src/sim/constants.ts";
const raw = JSON.parse(fs.readFileSync("../../.tmp/gd/water-route.best.json", "utf8"));
console.log("文件里 x=" + raw.x.toFixed(1) + " 块 · tape " + raw.tape.length + " 帧");
const w = new World(WATER_CHART); w.windowed = true;
/* 不带约束地回放(纯物理),看它自己走到哪 */
let maxX = 0, diedAt = -1;
for (let i = 0; i < raw.tape.length; i++) {
  if (w.dead || w.done) { diedAt = i; break; }
  w.frame(raw.tape[i]);
  maxX = Math.max(maxX, w.x);
}
console.log("不带约束回放:最远 " + (maxX / U).toFixed(1) + " 块 · " + (diedAt >= 0 ? "第 " + diedAt + " 帧死" : "没死,走到 " + (w.x / U).toFixed(1) + " 块"));
/* 每 200 帧打个点,看在哪分岔 */
const w2 = new World(WATER_CHART); w2.windowed = true;
let last = 0;
for (let i = 0; i < raw.tape.length; i++) {
  if (w2.dead || w2.done) break;
  w2.frame(raw.tape[i]);
  if (i - last >= 400) { last = i; console.log("  帧 " + i + " → x=" + (w2.x / U).toFixed(0) + " y=" + (w2.y / U).toFixed(1) + " " + w2.mode); }
}
