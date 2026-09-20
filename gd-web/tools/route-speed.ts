import fs from "node:fs";
import { WATER_CHART } from "../src/sim/charts/water.ts";
import { World } from "../src/sim/world.ts";
import { U } from "../src/sim/constants.ts";
const raw = JSON.parse(fs.readFileSync("../../.tmp/gd/water-route.best.json", "utf8"));
const w = new World(WATER_CHART); w.windowed = true;
const marks = [50, 100, 150, 200, 250, 300, 350, 400, 439];
let mi = 0;
for (const h of raw.tape) {
  if (w.dead || w.done) break;
  w.frame(h);
  if (mi < marks.length && w.x / U >= marks[mi]) {
    console.log("x=" + marks[mi] + " → speedIdx=" + w.speedIdx + " mode=" + w.mode + " y=" + (w.y/U).toFixed(2));
    mi++;
  }
}
console.log("末尾 speedIdx=" + w.speedIdx);
