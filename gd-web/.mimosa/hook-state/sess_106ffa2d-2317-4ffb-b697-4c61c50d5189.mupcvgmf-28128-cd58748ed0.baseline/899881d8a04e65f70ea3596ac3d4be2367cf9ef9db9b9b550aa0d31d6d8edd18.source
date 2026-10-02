import fs from "node:fs";
import { GD_HITBOX } from "../src/sim/gdids.ts";
console.log("我们的刺表(按高度键):" + JSON.stringify(GD_HITBOX.spike));
const src = fs.readFileSync("../../.tmp/longdata.cpp", "utf8");
const table = new Map<number, number[]>();
for (const m of src.matchAll(/\{(\d+), \{([\d.]+), ([\d.]+), (-?[\d.]+), (-?[\d.]+)\}\}/g)) {
  table.set(Number(m[1]), [Number(m[2]), Number(m[3])]);
}
console.log("\n原表里所有 12 单位以下的小盒子(刺族常见值):");
const seen = new Set<string>();
for (const [id, v] of [...table.entries()].sort((a, b) => a[0] - b[0])) {
  if (v[0] <= 16 && v[1] <= 16) {
    const k = v[0] + "×" + v[1];
    if (seen.has(k)) continue;
    seen.add(k);
    console.log("  " + k + "  ← id " + id + (id === 8 ? "(标准刺)" : id === 39 ? "(矮刺)" : id === 103 ? "(小刺)" : id === 392 ? "(迷你刺)" : id === 9 ? "(中刺)" : ""));
  }
}
