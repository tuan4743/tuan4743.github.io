#!/usr/bin/env node
/* ============================================================
   世界观数据库 · 同步脚本
   ─────────────────────────────────────────────────────────────
   单一真值 = world/碎片/*.md(手写稿,顺带给人读的)
              ★ 这个文件夹【在仓库根】,不在 static/ 下面 ——
                它不发布(详见 hugo.toml 顶部那段说明)。
   本脚本把它编译成 content/world/*.md(Hugo 页面):

     · H1            -> front matter 的 title
     · 著录项那段     -> front matter 的 archive.*(目录/侧栏要用)
     · 正文其余部分   -> 原样保留

   然后重建 content/world/_index.md 里那一段目录(夹在
   <!-- WORLD-CATALOG:BEGIN --> / END 之间),别的地方一个字不动。

   用法:  node scripts/sync-world.mjs
   ★ 改文案请改 world/碎片/,改完重跑本脚本 —— 别直接改 content/world/。
   ============================================================ */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "world", "碎片");
const HINTS = path.join(ROOT, "world", "提示.md");
const OUT = path.join(ROOT, "content", "world");
const INDEX = path.join(OUT, "_index.md");

/* ---------- ECHO 的提示(world/提示.md)----------
   格式:| 编号 | 提示 |
   用途:写进每一页的 archive.hint,再由 page-hud.html 交给 hud-echo.js ——
   读者在档案页上一直戳左上角那个摄像头,ECHO 会不情愿地把这一句吐出来。
   ★ 这个文件不在 content/ 里,所以提示本身不会被当成正文发出去。 */
function readHints() {
  const map = {};
  if (!fs.existsSync(HINTS)) return map;
  for (const line of fs.readFileSync(HINTS, "utf8").replace(/\r\n/g, "\n").split("\n")) {
    const m = /^\s*\|\s*(\d{2})\s*\|\s*(.+?)\s*\|\s*$/.exec(line);
    if (m) map[m[1]] = m[2];
  }
  return map;
}

/* 幕 —— 编号落在哪一段,归属哪一幕。目录(/world/)和 HUD 面板都按这个分组。 */
const ACTS = [
  { from: 1, to: 7, name: "第一幕 · 源点(澜)", note: "T−06:11 → T+146 天" },
  { from: 8, to: 18, name: "第二幕 · 回声(合流体)", note: "T+1,000 → T+1,100 年" },
  { from: 19, to: 23, name: "第三幕 · 接收者", note: "T+1,100 → T+1,556 年" },
  { from: 24, to: 26, name: "第四幕 · 方舟 · 醒来", note: "开机后 0 → 44 年" },
  { from: 27, to: 35, name: "第五幕 · 方舟 · 繁衍", note: "开机后 58 → 118 年" },
  { from: 36, to: 48, name: "第六幕 · 方舟 · 长久", note: "开机后 118 年起" },
];

/* 著录项里各栏的取值优先级(不同碎片的字段不一样:接收方有"收到",考古有"记录于"……) */
const TIME_KEYS = ["记录于", "收到", "观测点", "统计期", "年度", "公布", "场次", "类型"];
const CARRIER_KEYS = ["载体", "类型"];

const actOf = (n) => ACTS.find((a) => n >= a.from && n <= a.to);
const clean = (s) => String(s == null ? "" : s).replace(/[`*]/g, "").replace(/\s+/g, " ").trim();

/* 著录项:开头的连续 `>` 行(前面可能先有一个空行)。返回 {fields, endLine} */
function readHeader(lines) {
  const fields = {};
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;          /* ★ 先吃掉 H1 后面那个空行 */
  for (; i < lines.length; i++) {
    const L = lines[i];
    if (!L.startsWith(">")) break;
    for (const part of L.replace(/^>\s?/, "").split("｜")) {
      const m = /^\s*\*\*(.+?)\*\*\s*(.*)$/.exec(part);
      if (m && !fields[m[1]]) fields[m[1]] = clean(m[2]);
    }
  }
  /* 空行跳过 */
  while (i < lines.length && !lines[i].trim()) i++;
  return { fields, endLine: i };
}

function yamlStr(s) {
  return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

/* ---------------- 1. 编译每一份碎片 ---------------- */
fs.mkdirSync(OUT, { recursive: true });
const files = fs.readdirSync(SRC).filter((f) => f.endsWith(".md")).sort();
const hints = readHints();
const rows = [];

for (const f of files) {
  const num = Number(f.slice(0, 2));
  if (!Number.isInteger(num)) throw new Error("文件名要以两位编号开头: " + f);
  const raw = fs.readFileSync(path.join(SRC, f), "utf8").replace(/\r\n/g, "\n");
  const lines = raw.split("\n");
  const h1 = lines.findIndex((L) => L.startsWith("# "));
  if (h1 !== 0) throw new Error("第一行必须是 H1: " + f);
  const title = lines[0].slice(2).trim();
  const rest = lines.slice(1);
  /* ★ 著录项只用来填 front matter;正文 = H1 之后的【全部】内容(著录项本身要留在正文里) */
  const { fields } = readHeader(rest);
  const body = rest.join("\n").replace(/^\n+/, "").replace(/\s+$/, "") + "\n";

  const act = actOf(num);
  if (!act) throw new Error("编号没有归属的幕: " + f);
  const time = TIME_KEYS.map((k) => fields[k]).find(Boolean) || "";
  const carrier = CARRIER_KEYS.map((k) => fields[k]).find(Boolean) || "";
  const eid = fields["源事件"] || "";
  const integrity = fields["完整性"] || "";
  const no = String(num).padStart(2, "0");

  const fm = [
    "---",
    "title: " + yamlStr(title),
    "weight: " + num,
    "date: 2025-01-01T" + String(Math.floor(num / 60)).padStart(2, "0") + ":" + String(num % 60).padStart(2, "0") + ":00+08:00",
    "hideMeta: true",
    "ShowShareButtons: false",
    "archive:",
    "  no: " + yamlStr(no),
    "  act: " + yamlStr(act.name),
    "  time: " + yamlStr(time),
    "  carrier: " + yamlStr(carrier),
    "  integrity: " + yamlStr(integrity),
    "  eid: " + yamlStr(eid),
    "  hint: " + yamlStr(hints[no] || ""),      /* ECHO 戳摄像头时吐的那一句 */
    "---",
    "",
  ].join("\n");

  fs.writeFileSync(path.join(OUT, no + ".md"), fm + body, "utf8");
  rows.push({ no, num, title, time, carrier, integrity, act });
}

/* ---------------- 2. 重建 _index.md 里的目录 ---------------- */
const BEGIN = "<!-- WORLD-CATALOG:BEGIN -->";
const END = "<!-- WORLD-CATALOG:END -->";

let catalog = "";
for (const act of ACTS) {
  const inAct = rows.filter((r) => r.act.name === act.name);
  if (!inAct.length) continue;
  catalog += "\n### " + act.name + "\n\n";
  catalog += '<p class="arc-actnote">' + act.note + " · " + inAct.length + " 份</p>\n\n";
  catalog += "| # | 档案 | 记录 | 载体 |\n|---|---|---|---|\n";
  for (const r of inAct) {
    catalog +=
      "| [" + r.no + "](/world/" + r.no + "/) | **" + r.title + "** | " +
      (r.time || "—") + " | " + (r.carrier || "—") + " |\n";
  }
}

let idx = fs.readFileSync(INDEX, "utf8");
const b = idx.indexOf(BEGIN);
const e = idx.indexOf(END);
if (b < 0 || e < 0) throw new Error("_index.md 里找不到 " + BEGIN + " / " + END + " 标记");
idx = idx.slice(0, b + BEGIN.length) + "\n" + catalog + "\n" + idx.slice(e);
idx = idx.replace(/共 \d+ 份(?:回收)?档案/g, "共 " + rows.length + " 份回收档案");
idx = idx.replace(/共 \d+ 份碎片/g, "共 " + rows.length + " 份碎片");
fs.writeFileSync(INDEX, idx, "utf8");

console.log("同步完成:" + rows.length + " 份 → " + path.relative(ROOT, OUT));
const withHint = rows.filter((r) => hints[r.no]).length;
console.log("  提示 " + withHint + "/" + rows.length + " 份(来自 world/提示.md)");
for (const act of ACTS) {
  const n = rows.filter((r) => r.act.name === act.name).length;
  console.log("  " + act.name.padEnd(24, " ") + n + " 份");
}
