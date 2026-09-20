import { WATER_CHART } from "../src/sim/charts/water.ts";
const ps = WATER_CHART.objects.filter((o) => o.kind === "portal" || o.kind === "gravity" || o.kind === "speed" || o.kind === "size")
  .sort((a, b) => a.b - b.b);
for (const o of ps) {
  const what = o.kind === "portal" ? "形态→" + o.to : o.kind === "gravity" ? "重力" + (o.gdir < 0 ? "↑" : "↓")
    : o.kind === "speed" ? "速度" + o.speed : "尺寸" + (o.size ?? "");
  console.log("  x=" + o.b.toFixed(1).padStart(7) + " y=" + o.r.toFixed(1).padStart(5) + "  " + what);
}
