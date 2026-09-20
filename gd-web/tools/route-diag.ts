import fs from "node:fs";
import { WATER_CHART } from "../src/sim/charts/water.ts";
import { World } from "../src/sim/world.ts";
import { U } from "../src/sim/constants.ts";
const raw = JSON.parse(fs.readFileSync("../../.tmp/gd/water-route.best.json", "utf8"));
console.log("合法路线前缀 x=" + raw.x.toFixed(1) + " 块 · " + raw.tape.length + " 帧");
const w = new World(WATER_CHART); w.windowed = true;
let last = "";
for (let i = 0; i < raw.tape.length; i++) {
  if (w.dead) { console.log("第 " + i + " 帧死了"); break; }
  w.frame(raw.tape[i]);
  const x = w.x / U;
  if (x < 486) continue;
  const key = w.mode + (w.gdir < 0 ? "↑" : "↓");
  if (key !== last) { console.log("  帧 " + i + " x=" + x.toFixed(1) + " y=" + (w.y/U).toFixed(2) + " → " + key + " vy=" + w.vy.toFixed(2)); last = key; }
  if (i % 25 === 0) console.log("    帧 " + i + " x=" + x.toFixed(2) + " y=" + (w.y/U).toFixed(2) + " " + key + " vy=" + w.vy.toFixed(2));
}
console.log("结束:x=" + (w.x/U).toFixed(2) + " y=" + (w.y/U).toFixed(2) + " " + w.mode + " gdir=" + w.gdir);
