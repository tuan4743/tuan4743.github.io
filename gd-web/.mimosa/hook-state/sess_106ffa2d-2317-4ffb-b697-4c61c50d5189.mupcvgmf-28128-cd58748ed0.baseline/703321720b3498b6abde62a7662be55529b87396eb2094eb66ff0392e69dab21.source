import fs from "node:fs";
import { WATER_CHART } from "../src/sim/charts/water.ts";
import { World } from "../src/sim/world.ts";
import { U } from "../src/sim/constants.ts";
const raw = JSON.parse(fs.readFileSync("../../.tmp/gd/free-probe.bad.json", "utf8"));
console.log("坏卷:" + raw.tape.length + " 帧,声称到 x=" + raw.x.toFixed(1));
const w = new World(WATER_CHART); w.windowed = true;
for (let i = 0; i < raw.tape.length; i++) {
  if (w.dead || w.done) { console.log("第 " + i + " 帧就死了(x=" + (w.x/U).toFixed(1) + ")"); break; }
  w.frame(raw.tape[i]);
  if (i > 3550 && i % 20 === 0) console.log("  帧 " + i + " x=" + (w.x/U).toFixed(1) + " y=" + (w.y/U).toFixed(2) + " " + w.mode + (w.onGround?"地":"空"));
}
console.log("末尾:x=" + (w.x/U).toFixed(1) + " dead=" + w.dead);
