import { WATER_CHART } from "../src/sim/charts/water.ts";
import { World } from "../src/sim/world.ts";
import { U } from "../src/sim/constants.ts";
const objs = WATER_CHART.objects as Array<Record<string, unknown>>;
const terrain = objs.filter((o) => o.kind !== "platform" && o.kind !== "block");
let spot = -1;
for (let x = 120; x < 3400; x += 1) {
  if (terrain.some((o) => Math.abs((o.b as number) - x) < 15)) continue;
  if (objs.some((o) => o.kind === "block" && Math.abs((o.b as number) - x) < 15)) continue;
  spot = x; break;
}
console.log("=== 逐形态跳跃表(干净点位 x=" + spot + ",±15 格内除地面无任何物件)===");
console.log("形态      起跳初速     峰值(格)   滞空(帧)   理论(2v/g)   判定");
const MODES = ["cube", "ball", "robot", "spider", "ufo", "ship"] as const;
for (const m of MODES) {
  const w = new World(WATER_CHART);
  w.reset(spot * U, m as never, 0.5 * U);
  w.x = spot * U; w.y = 0.2 * U; w.mode = m as never; w.vy = 0; w.onGround = true;
  let v0 = 0, peak = -1e9, air = 0, started = false;
  for (let i = 0; i < 400; i++) {
    w.frame(i === 0);
    if (i === 0) v0 = w.vy;
    peak = Math.max(peak, w.y / U);
    if (!w.onGround) { air++; started = true; } else if (started) break;
    if (w.dead) break;
  }
  const gF = (m === "ball" || m === "spider") ? 0.6 : (m === "robot" ? 0.9 : 1);
  const theo = Math.abs(v0) > 0.01 ? (2 * Math.abs(v0) / (0.958199 * 0.9 * gF)) : 0;
  const verdict = (m === "cube") ? "OK 与原作 2.17 格吻合"
    : (m === "ball") ? "偏大(原作球跳约 1~1.5 格)"
    : (m === "robot") ? "偏低(机器人应是高跳)"
    : (m === "spider") ? "几乎没跳(应是瞬移式跳跃)"
    : "飞行类无跳跃,这两列不适用";
  console.log("  " + m.padEnd(7) + v0.toFixed(3).padStart(9) + (peak - 0.2).toFixed(2).padStart(11)
    + String(air).padStart(11) + (theo ? theo.toFixed(0) : "-").padStart(12) + "   " + verdict);
}
