import fs from "node:fs";
import { WATER_CHART } from "../src/sim/charts/water.ts";
import { World } from "../src/sim/world.ts";
import { U } from "../src/sim/constants.ts";
import { hitboxOf } from "../src/sim/gdids.ts";
const raw = JSON.parse(fs.readFileSync("../static/assets/gd-tape.json", "utf8"));
const tape = []; let cur = raw.first;
for (const n of raw.rle) { for (let i = 0; i < n; i++) tape.push(cur); cur = !cur; }
const w = new World(WATER_CHART);
/* 记下每一帧玩家过门时的位置,门是"跨 x 触发"的 */
const ports = WATER_CHART.objects.filter((o) => o.kind === "portal");
const seen = new Map();
let prevX = w.x;
for (let i = 0; i < tape.length; i++) {
  if (w.dead) break;
  prevX = w.x;
  w.frame(tape[i]);
  for (const p of ports) {
    const px = (p.b + p.w / 2) * U;
    if (prevX < px && w.x >= px && !seen.has(p)) {
      const hb = hitboxOf(p);
      const cy = (p.r + p.h / 2) * U;
      seen.set(p, { y: w.y / U, mode: w.mode, cy: cy / U, h: (hb ? hb[1] : p.h * U) / U, id: p.id, to: p.to });
    }
  }
  if (w.done) break;
}
const missed = [...seen.entries()].filter(([, v]) => v.mode !== v.to);
console.log("总共跨过 " + seen.size + "/" + ports.length + " 个门;其中【穿过却没生效】或【跨 x 时形态不是它】的 " + missed.length + " 个:");
for (const [p, v] of missed.slice(0, 14)) {
  console.log("  门 x=" + (p.b + p.w / 2).toFixed(1) + " → 想去 " + v.to + " · 跨过时 y=" + v.y.toFixed(2)
    + " 门中心 y=" + v.cy.toFixed(2) + " 门高=" + v.h.toFixed(2) + " · 当时形态=" + v.mode);
}
const never = ports.filter((p) => !seen.has(p));
console.log("整卷都没跨过的门 " + never.length + " 个:" + never.slice(0, 10).map((p) => (p.to ?? "?") + "@" + (p.b + p.w / 2).toFixed(0)).join(" "));
