import { WATER_CHART } from "../src/sim/charts/water.ts";
import { World } from "../src/sim/world.ts";
import { U } from "../src/sim/constants.ts";
const w = new World(WATER_CHART); w.windowed = true;
w.x = 481 * U; w.y = 6 * U; w.vy = 0; w.onGround = true; w.mode = "spider"; w.speedIdx = 0;
const must = (w as never as { portals: Array<{ o: { kind: string; b: number; to?: string }; x0: number; x1: number }> }).portals
  .filter((b) => ["portal", "gravity", "speed", "size"].includes(b.o.kind) && b.x1 > 481 * U)
  .sort((a, b) => a.x1 - b.x1);
console.log("必过门 " + must.length + " 个,最近 " + (must[0].x1 / U).toFixed(2) + "(" + must[0].o.kind + (must[0].o.to ? "→" + must[0].o.to : "") + ")");
const armed = (w as never as { armedPortals: Set<unknown> }).armedPortals;
for (let i = 0; i < 80; i++) {
  if (w.dead) break;
  w.frame(false);
  for (const b of must) {
    if (w.x < b.x1) break;
    if (armed.has(b)) continue;
    console.log("★ 第 " + i + " 帧 x=" + (w.x/U).toFixed(2) + " y=" + (w.y/U).toFixed(2)
      + " 越过了门 " + b.o.kind + (b.o.to ? "→" + b.o.to : "") + "@x=" + (b.x0/U).toFixed(2)
      + " y=[" + (b.y0/U).toFixed(2) + "," + (b.y1/U).toFixed(2) + "] 却没碰到(玩家外框 y=[" + (w.y/U).toFixed(2) + "," + ((w.y+w.box)/U).toFixed(2) + "])");
    (w as never as { dead: boolean }).dead = true;
    break;
  }
}
console.log("结束:x=" + (w.x/U).toFixed(2) + " dead=" + w.dead + " armed=" + armed.size);
