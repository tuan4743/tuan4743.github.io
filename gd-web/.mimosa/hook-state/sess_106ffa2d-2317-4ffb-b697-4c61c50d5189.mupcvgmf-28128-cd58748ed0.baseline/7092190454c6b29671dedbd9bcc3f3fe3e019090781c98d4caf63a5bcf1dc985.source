import { WATER_CHART } from "../src/sim/charts/water.ts";
import { U } from "../src/sim/constants.ts";
const N = Math.ceil(WATER_CHART.length) + 4;
const arr = new Float64Array(N);
for (const o of WATER_CHART.objects) {
  if (o.kind === "deco" || o.kind === "text") continue;
  const top = (o.r ?? 0) + (o.h ?? 0);
  const x0 = Math.max(0, Math.floor(o.b - 10)), x1 = Math.min(N - 1, Math.ceil(o.b + o.w + 25));
  for (let i = x0; i <= x1; i++) if (top > arr[i]) arr[i] = top;
}
for (let i = 0; i < N; i++) arr[i] += 4;
const marks = [420, 440, 460, 470, 480, 490, 495, 500, 505, 510, 515, 520, 525, 530, 540];
console.log("x → 天花板(块):");
console.log(marks.map((m) => m + ":" + arr[m].toFixed(1)).join("  "));
console.log("整关天花板范围 " + Math.min(...arr).toFixed(1) + " ~ " + Math.max(...arr).toFixed(1));
