import fs from "node:fs";
const src = fs.readFileSync("../../.tmp/longdata.cpp", "utf8");
const table = new Map<number, number[]>();
for (const m of src.matchAll(/\{(\d+), \{([\d.]+), ([\d.]+), (-?[\d.]+), (-?[\d.]+)\}\}/g)) table.set(Number(m[1]), [Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])]);
console.log("冲刺箭头/传送箭头/硬币 的原始表项({高,宽,x,y}):");
for (const id of [1704, 1751, 3004, 3005, 1329, 1420, 1330, 84, 1022, 141, 36]) {
  const t = table.get(id);
  console.log("  id " + String(id).padEnd(5) + (t ? JSON.stringify(t) + "  → 宽 " + t[1] + " 高 " + t[0] : "(表里没有)"));
}
