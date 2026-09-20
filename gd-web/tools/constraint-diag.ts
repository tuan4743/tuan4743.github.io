import fs from "node:fs";
import { WATER_CHART } from "../src/sim/charts/water.ts";
import { World } from "../src/sim/world.ts";
import { U } from "../src/sim/constants.ts";
const raw = JSON.parse(fs.readFileSync("../../.tmp/gd/water-route.best.json", "utf8"));
console.log("卷子 x=" + raw.x.toFixed(1) + " maxX=" + (raw.maxX ?? 0).toFixed(1) + " · " + raw.tape.length + " 帧");
const w = new World(WATER_CHART); w.windowed = true;
const must = (w as never as { portals: Array<{ o: { kind: string; b: number; to?: string; speed?: number; gdir?: number }; x0: number; x1: number }> }).portals
  .filter((b) => ["portal", "gravity", "speed", "size"].includes(b.o.kind))
  .sort((a, b) => a.x1 - b.x1);
const armed = (w as never as { armedPortals: Set<unknown> }).armedPortals;
let hit = false;
for (let i = 0; i < raw.tape.length; i++) {
  if (w.dead || w.done) { console.log("第 " + i + " 帧死(x=" + (w.x/U).toFixed(2) + ")"); hit = true; break; }
  w.frame(raw.tape[i]);
  for (const b of must) {
    if (w.x < b.x1) break;
    if (armed.has(b)) continue;
    const o = b.o;
    const satisfied = o.kind === "portal" ? w.mode === o.to
      : o.kind === "gravity" ? w.gdir === (o.gdir ?? 1)
      : o.kind === "speed" ? w.speedIdx === (o.speed ?? 1) : w.sizeMul !== 1;
    if (satisfied) continue;
    console.log("★ 第 " + i + " 帧 x=" + (w.x/U).toFixed(2) + " 越过了 " + o.kind + (o.to ? "→" + o.to : "")
      + "@x=" + (b.x0/U).toFixed(2) + " 却没生效 —— 当时 mode=" + w.mode + " gdir=" + w.gdir
      + " speed=" + w.speedIdx + " mini=" + (w.sizeMul !== 1));
    hit = true; break;
  }
  if (hit) break;
}
console.log("回放结束:x=" + (w.x/U).toFixed(2));
