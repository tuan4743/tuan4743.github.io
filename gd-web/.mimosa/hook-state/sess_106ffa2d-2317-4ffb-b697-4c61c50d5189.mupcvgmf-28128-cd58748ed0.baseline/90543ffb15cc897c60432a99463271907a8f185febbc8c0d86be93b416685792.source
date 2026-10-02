import { World } from "../src/sim/world.ts";
import { U } from "../src/sim/constants.ts";
import type { Level } from "../src/sim/level.ts";
const base = {
  name: "snap-test", length: 40, rows: 20, fromGD: true, start: { b: 0, r: 0 },
  objects: [
    { kind: "platform", b: -5, r: -1, w: 50, h: 1 },
    { kind: "block", b: 0, r: 0, w: 1, h: 1 },
    { kind: "block", b: 4, r: 1, w: 1, h: 1 },
  ],
} as unknown as Level;
function run(off: number, drop: number) {
  const w = new World(base);
  w.mode = "cube"; w.speedIdx = 1;
  w.x = 5; w.y = 1 * U; w.vy = 0; w.onGround = true; w.checkX = w.x; w.checkY = w.y;
  for (let i = 0; i < 3; i++) w.frame(false);
  const d0 = (w as never as { snapDist: number }).snapDist;
  const x0 = 4 * U + off;
  w.x = x0; w.y = 2 * U; w.vy = -0.5; w.onGround = false;    // 正贴在 B 顶面上方
  w.frame(false); w.frame(false);
  return { d0, x0, x: w.x, y: w.y / U, ground: w.onGround, dead: w.dead };
}
for (const off of [5, 12, 20]) {
  const r = run(off, 2);
  const target = 4 * U + r.d0;
  console.log("B 左沿+" + off + ":x " + r.x0 + " → " + r.x.toFixed(2) + " (y=" + r.y.toFixed(2) + " 地=" + r.ground + ")"
    + " · 吸附目标 " + target.toFixed(2) + " · 差 " + (r.x - r.x0).toFixed(2)
    + " → " + (Math.abs(r.x - r.x0) > 0.4 ? "✓ 吸附生效(最多挪 1 单位)" : "✗ 没吸附"));
}
