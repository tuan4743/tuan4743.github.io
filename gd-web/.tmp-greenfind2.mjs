import fs from "node:fs";
const lines = fs.readFileSync("src/sim/charts/water.ts", "utf8").split("\n");
const objs = [];
for (const l of lines) {
  const t = l.trim();
  const m = /^([A-Z]) (-?[\d.]+) (-?[\d.]+)(?: (-?[\d.]+) (-?[\d.]+))?(.*)$/.exec(t);
  if (!m) continue;
  const idm = /id=(\d+)/.exec(m[6] || "");
  objs.push({ code: m[1], x: +m[2], r: +m[3], w: m[4] ? +m[4] : 1, h: m[5] ? +m[5] : 1, id: idm ? +idm[1] : null, line: t });
}
const orb = objs.find((o) => o.id === 1022 && o.x > 513 && o.x < 760);
console.log("绿环: " + (orb ? orb.line : "没找到") + "  ⇒ 中心约 (" + (orb.x + orb.w / 2) + ", " + (orb.r + orb.h / 2) + ") 格");
const near = objs.filter((o) => Math.abs(o.x - orb.x) < 4 && o.r > orb.r - 6 && o.r < orb.r + 4).sort((a, b) => b.r - a.r || a.x - b.x);
console.log("--- 绿环周围(从上到下) ---");
for (const o of near) console.log("  r=" + o.r + " x=" + o.x + "  " + o.line);
