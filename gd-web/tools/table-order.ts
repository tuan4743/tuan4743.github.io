import fs from "node:fs";
import { GD_HITBOX } from "../src/sim/gdids.ts";
const src = fs.readFileSync("../../.tmp/longdata.cpp", "utf8");
const table = new Map<number, number[]>();
for (const m of src.matchAll(/\{(\d+), \{([\d.]+), ([\d.]+), (-?[\d.]+), (-?[\d.]+)\}\}/g)) table.set(Number(m[1]), [Number(m[2]), Number(m[3])]);
console.log("我们表里的值(想清形状就知道哪边是宽):");
console.log("  portal(门, 竖高)" + JSON.stringify(GD_HITBOX.portal) + "  gravity " + JSON.stringify(GD_HITBOX.gravity)
  + "  orb(环, 方) " + JSON.stringify(GD_HITBOX.orb) + "  pad.blue(板, 横扁平) " + JSON.stringify(GD_HITBOX.pad.blue));
/* GD 里的门 id:12/13/47/111 等;蓝色跳板 67;黄环 36 */
for (const id of [12, 13, 47, 111, 67, 35, 36, 140, 8, 39]) console.log("  原表 id " + id + " = " + JSON.stringify(table.get(id)));
