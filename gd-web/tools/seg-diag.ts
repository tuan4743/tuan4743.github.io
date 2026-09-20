import { WATER_CHART } from "../src/sim/charts/water.ts";
import { hitboxOf } from "../src/sim/gdids.ts";
const seg = WATER_CHART.objects.filter((o) => o.b >= 566 && o.b <= 600).sort((a, b) => a.b - b.b);
const hi = seg.filter((o) => (o.r ?? 0) > 8);
console.log("x=566~600 里 r>8 的物件 " + hi.length + "/" + seg.length + " 个:");
for (const o of hi) {
  const hb = hitboxOf(o);
  console.log("  " + o.kind + (o.id != null ? "#" + o.id : "") + (o.to ? "→" + o.to : "") + (o.pad ? "(" + o.pad + ")" : "")
    + (o.orb ? "(" + o.orb + ")" : "") + (o.gdir != null ? " g" + o.gdir : "") + (o.rot ? " rot" + o.rot : "")
    + " b=" + o.b.toFixed(1) + " r=" + o.r.toFixed(1) + (hb ? " 判定=" + hb[0].toFixed(0) + "×" + hb[1].toFixed(0) : ""));
}
