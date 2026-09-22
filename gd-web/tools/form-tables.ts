import { WATER_CHART } from "../src/sim/charts/water.ts";
import { World } from "../src/sim/world.ts";
import { U } from "../src/sim/constants.ts";
let best = -1, bestAir = 0;
for (let x = 100; x < 3400; x += 7) {
  const w = new World(WATER_CHART);
  w.reset(x * U, "cube", 0.5 * U);
  w.x = x * U; w.y = 0.2 * U; w.vy = 0; w.onGround = true;
  let air = 0, started = false;
  for (let i = 0; i < 300; i++) {
    w.frame(i === 0);
    if (!w.onGround) { air++; started = true; } else if (started) break;
    if (w.dead) { air = -1; break; }
  }
  if (air >= 20 && air <= 45) { best = x; bestAir = air; break; }
}
const MODES = ["cube", "ball", "robot", "spider", "ufo", "ship"] as const;
console.log("干净平地 x=" + best + "(cube 滞空 " + bestAir + " 帧自证)");
console.log("形态      起跳初速     峰值(格)   滞空(帧)   理论滞空");
for (const m of MODES) {
  const w = new World(WATER_CHART);
  w.reset(best * U, m as never, 0.5 * U);
  w.x = best * U; w.y = 0.2 * U; w.mode = m as never; w.vy = 0; w.onGround = true;
  let v0 = 0, peak = -1e9, air = 0, started = false;
  for (let i = 0; i < 400; i++) {
    w.frame(i === 0);
    if (i === 0) v0 = w.vy;
    peak = Math.max(peak, w.y / U);
    if (!w.onGround) { air++; started = true; } else if (started) break;
    if (w.dead) break;
  }
  const gFac = m === "ball" || m === "spider" ? 0.6 : (m === "robot" ? 0.9 : 1);
  const theo = Math.abs(v0) > 0.01 ? (2 * Math.abs(v0) / (0.958199 * 0.9 * gFac)).toFixed(0) : "-";
  console.log("  " + m.padEnd(7) + v0.toFixed(3).padStart(9) + (peak - 0.2).toFixed(2).padStart(11) + String(air).padStart(11) + String(theo).padStart(12));
}
