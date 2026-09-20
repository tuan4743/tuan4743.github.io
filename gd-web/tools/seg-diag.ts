import { WATER_CHART } from "../src/sim/charts/water.ts";
import { hitboxOf } from "../src/sim/gdids.ts";
for (const o of WATER_CHART.objects.filter((o) => o.b >= 596 && o.b <= 612).sort((a, b) => a.b - b.b)) {
  const hb = hitboxOf(o);
  console.log("  " + o.kind + (o.id != null ? "#" + o.id : "") + (o.to ? "→" + o.to : "") + (o.pad ? "(" + o.pad + ")" : "")
    + (o.orb ? "(" + o.orb + ")" : "") + (o.gdir != null ? " g" + o.gdir : "") + (o.speed != null ? " sp" + o.speed : "")
    + (o.rot ? " rot" + o.rot : "") + " b=" + o.b.toFixed(2) + " r=" + o.r.toFixed(2) + " w=" + o.w + " h=" + o.h
    + (hb ? " 判定=" + hb[0].toFixed(0) + "×" + hb[1].toFixed(0) : ""));
}
