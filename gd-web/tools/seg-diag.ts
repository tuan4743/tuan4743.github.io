import { WATER_CHART } from "../src/sim/charts/water.ts";
import { hitboxOf } from "../src/sim/gdids.ts";
for (const o of WATER_CHART.objects.filter((o) => o.b >= 548 && o.b <= 576).sort((a, b) => a.b - b.b)) {
  const hb = hitboxOf(o);
  console.log("  " + o.kind + (o.id != null ? "#" + o.id : "") + (o.to ? "→" + o.to : "") + (o.pad ? "(" + o.pad + ")" : "")
    + (o.orb ? "(" + o.orb + ")" : "") + (o.gdir != null ? " g" + o.gdir : "") + (o.rot ? " rot" + o.rot : "")
    + " b=" + o.b.toFixed(1) + " r=" + o.r.toFixed(1) + " w=" + o.w + " h=" + o.h
    + (hb ? " 判定=" + hb[0].toFixed(0) + "×" + hb[1].toFixed(0) : ""));
}
