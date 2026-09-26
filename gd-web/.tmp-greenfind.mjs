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
const checks = objs.filter((o) => o.id === 2063).sort((a, b) => a.x - b.x);
console.log("存档点 " + checks.length + " 个: " + checks.map((o) => o.x + "@" + o.r).join(" · "));
const c2 = checks[1].x;
const portals = objs.filter((o) => o.id === 12 && o.x > c2 - 5).sort((a, b) => a.x - b.x);
console.log("第二个存档点 x=" + c2 + " 附近的 cube 门: " + portals.slice(0, 3).map((o) => o.x + "@" + o.r).join(" · "));
const doors = objs.filter((o) => o.id === 11).sort((a, b) => a.x - b.x);
console.log("重力门 " + doors.length + " 个: " + doors.map((o) => o.x + "@" + o.r).join(" · "));
const greens = objs.filter((o) => o.id === 1022);
for (const g of greens) {
  const d = doors.find((d) => Math.abs(d.x - g.x) < 0.8 && d.r < g.r + 0.5 && g.r - d.r < 3.5);
  if (d) console.log("★ 绿环 x=" + g.x + " r=" + g.r + " —— 下方/近旁重力门 x=" + d.x + " r=" + d.r);
}
const zone = objs.filter((o) => o.x > c2 - 2 && o.x < 760 && o.id !== null);
const byId = new Map();
for (const o of zone) byId.set(o.id, (byId.get(o.id) ?? 0) + 1);
console.log("第二存档点~760 之间物件: " + [...byId.entries()].map(([k, v]) => "id" + k + "×" + v).join(" · "));
const gr = objs.filter((o) => o.x > 700 && o.x < 736).sort((a, b) => a.x - b.x || a.r - b.r);
console.log("--- 700~736 全部物件 ---");
for (const o of gr) console.log("  " + o.line);
