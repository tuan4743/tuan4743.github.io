/* ============================================================
   CCLocalLevels.dat 报告:存档里有哪些关 / 尺寸 / 用到的物件 ID 直方图
   ─────────────────────────────────────────────────────────────
   跑法:cd gd-web && node tools/dat-report.ts <文件> [--level=N]
        node tools/dat-report.ts ../../tuagfey-blog/static/levels/CCLocalLevels.dat

   格式(实测):
     文件 = 每个字节 XOR 0x0B → base64 文本 → gzip → plist(XML)
     plist 里每个关卡一份 <dict>,其中 k2 = 关卡名,k4 = 关卡数据
     关卡数据 = base64(gzip("头部k,v,k,v…;物件;物件…"))
     物件 = "1,id,2,x,3,y,4,flipY,5,flipX,6,rot,7,scale,57,group,…"
     (0.1 单位制:x/y 都是 30 的倍数才落在格子线上;1 格 = 30)
   ============================================================ */
import fs from "node:fs";
import zlib from "node:zlib";

const FILE = process.argv[2];
const wantLevel = Number((process.argv.find((a) => a.startsWith("--level=")) || "").split("=")[1] ?? NaN);
if (!FILE) {
  console.error("用法: node tools/dat-report.ts <CCLocalLevels.dat> [--level=N]");
  process.exit(1);
}

/* ---------- ① XOR 0x0B → base64 → gzip → XML ---------- */
function unwrapSave(path: string): string {
  const raw = fs.readFileSync(path);
  const xored = Buffer.from(raw.map((b) => b ^ 0x0b));
  const text = xored.toString("utf8").trim();
  const gz = Buffer.from(text, "base64");
  /* 开头那句 <?xml version="1.0"?> 要去掉 —— 解析器只认 <标签>,带 ? 的会卡住(踩过)*/
  return zlib.gunzipSync(gz).toString("utf8").replace(/^\uFEFF/, "").replace(/<\?xml[^>]*\?>/g, "").trim();
}

/* ---------- ② GD 的紧凑 plist: <k>键</k><d>字典</d><s>串</s><i>整数</i><r>小数</r><t/><f/><a>数组</a> ---------- */
type Val = Dict | Val[] | string | number | boolean;
type Dict = Record<string, Val>;

function parseNode(xml: string, pos: number): [Val, number] {
  /* 开标签可能带属性(<plist version="1.0" gjver="2.0">),所以要允许 [^>]* */
  const tag = /^<([a-z]+)[^>]*?(\/)?>/.exec(xml.slice(pos, pos + 200));
  if (!tag) {
    /* 认不出来的地方:跳过 1 个字符继续(顺便报一次,便于发现格式差异),
       绝不能原地不动 —— 否则外层 while 会死循环(踩过) */
    if (!parseNode._warned) {
      parseNode._warned = true;
      console.warn("  ⚠ 解析器在 " + pos + " 处认不出标签: " + JSON.stringify(xml.slice(pos, pos + 40)));
    }
    return ["", pos + 1];
  }
  const name = tag[1];
  const selfClosing = !!tag[2];
  pos += tag[0].length;
  if (name === "plist" || name === "dict" || name === "d" || name === "a") {
    if (name === "plist") {
      const [v, p] = parseNode(xml, pos);
      const tail = xml.startsWith("</plist>", p) ? 8 : 0;
      return [v, p + tail];
    }
    if (name === "a") {
      const arr: Val[] = [];
      while (pos < xml.length && !xml.startsWith("</a>", pos)) {
        const [v, p] = parseNode(xml, pos);
        arr.push(v);
        pos = p;
      }
      return [arr, pos < xml.length ? pos + 4 : pos];
    }
    const dict: Dict = {};
    let lastKey: string | null = null;
    /* ★ pos < xml.length 这个条件必须有:否则读到文档末尾以后 startsWith 永远为假,
       外层 while 会一直空转(踩过,表现为"跑不完") */
    while (pos < xml.length && !xml.startsWith("</d>", pos) && !xml.startsWith("</dict>", pos)) {
      if (xml.startsWith("<k>", pos)) {
        const end = xml.indexOf("</k>", pos);
        lastKey = xml.slice(pos + 3, end);
        pos = end + 4;
        const [v, p] = parseNode(xml, pos);
        dict[lastKey] = v;
        pos = p;
      } else {
        const [v, p] = parseNode(xml, pos);        /* 数组形式:没有键的值 */
        dict[String(Object.keys(dict).length)] = v;
        pos = p;
      }
    }
    if (pos >= xml.length) return [dict, pos];
    return [dict, pos + (xml.startsWith("</d>", pos) ? 4 : 7)];
  }
  if (selfClosing) return [name === "t", pos];     /* <t /> = true,<f /> = false */
  const close = `</${name}>`;
  const end = xml.indexOf(close, pos);
  if (end < 0) return ["", pos + 1];               /* 没有闭合:跳过,别卡住 */
  const text = xml.slice(pos, end)
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  const value: Val = name === "i" || name === "r" ? Number(text) : text;
  return [value, end + close.length];
}

/* 递归找出所有"带 k4 的字典" = 一关(格式细节变了也还能找到)*/
function findLevels(node: Val, out: Dict[] = []): Dict[] {
  if (Array.isArray(node)) { node.forEach((n) => findLevels(n, out)); return out; }
  if (node && typeof node === "object") {
    const d = node as Dict;
    if (typeof d.k4 === "string" && String(d.k4).startsWith("H4sI")) out.push(d);
    Object.values(d).forEach((v) => findLevels(v, out));
  }
  return out;
}

/* ---------- ③ 关卡数据:base64(gzip("头;物件…")) ---------- */
function decodeLevel(b64: string): { header: Record<string, string>; objects: string[] } {
  const data = zlib.gunzipSync(Buffer.from(b64, "base64")).toString("utf8");
  const parts = data.split(";");
  const header: Record<string, string> = {};
  const h = parts[0].split(",");
  for (let i = 0; i + 1 < h.length; i += 2) header[h[i]] = h[i + 1];
  return { header, objects: parts.slice(1).filter((s) => s.length > 1) };
}

function fieldsOf(obj: string): Record<string, string> {
  const out: Record<string, string> = {};
  const f = obj.split(",");
  for (let i = 0; i + 1 < f.length; i += 2) out[f[i]] = f[i + 1];
  return out;
}

/* ---------- 跑 ---------- */
const jsonOut = (process.argv.find((a) => a.startsWith("--json=")) || "").split("=")[1];
const summary: any[] = [];
const xml = unwrapSave(FILE);
console.log(`存档 ${FILE}`);
console.log(`  解出来 ${xml.length} 字符的 plist;含 <plist> ? ${xml.includes("<plist")}`);
const [tree] = parseNode(xml, 0);
const levels = findLevels(tree);
console.log(`  找到 ${levels.length} 关`);

levels.forEach((d, idx) => {
  if (!Number.isNaN(wantLevel) && idx + 1 !== wantLevel) return;
  const name = typeof d.k2 === "string" ? d.k2 : "(无名)";
  const data = typeof d.k4 === "string" ? d.k4 : "";
  console.log(`\n===== [${idx + 1}] ${name} =====`);
  console.log(`  其它字段: ${Object.keys(d).join(" ")}`);
  if (!data) { console.log("  没有 k4(关卡数据)"); return; }
  let lv;
  try { lv = decodeLevel(data); } catch (e) { console.log("  k4 解不开: " + (e as Error).message); return; }
  const H = lv.header;
  const ids: Record<string, number> = {};
  const keyUse: Record<string, number> = {};
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  lv.objects.forEach((o) => {
    const f = fieldsOf(o);
    const id = f["1"] ?? "?";
    ids[id] = (ids[id] || 0) + 1;
    Object.keys(f).forEach((k) => { keyUse[k] = (keyUse[k] || 0) + 1; });
    const x = Number(f["2"]), y = Number(f["3"]);
    if (isFinite(x)) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
    if (isFinite(y)) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  });
  const len = H.k12 ? Number(H.k12) : NaN;
  console.log(`  物件 ${lv.objects.length} 个 · 头部 ${Object.keys(H).length} 个字段`);
  console.log(`  关卡长(k12): ${isFinite(len) ? len : "?"} 格 · 物件范围 x ${minX / 30}~${maxX / 30} 格, y ${minY / 30}~${maxY / 30} 格`);
  const head = Object.entries(H).slice(0, 24).map(([k, v]) => `${k}=${String(v).slice(0, 18)}`).join("  ");
  console.log(`  头部: ${head}`);
  console.log(`  用到的键: ${Object.entries(keyUse).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}×${n}`).join(" ")}`);
  const hist = Object.entries(ids).sort((a, b) => b[1] - a[1]);
  if (jsonOut) summary.push({ index: idx + 1, name, header: H, objects: lv.objects.length, range: [minX / 30, maxX / 30, minY / 30, maxY / 30], ids, keyUse, samples: (() => { const s: Record<string, string> = {}; lv.objects.forEach((o) => { const f = fieldsOf(o); if (!s[f["1"] ?? "?"]) s[f["1"] ?? "?"] = o; }); return s; })() });
  console.log(`  物件 ID 直方图(${hist.length} 种):`);
  hist.forEach(([id, n]) => console.log(`    id ${id.padStart(6)} × ${String(n).padStart(5)}`));
  /* 每个 ID 的几何特征:有助于判断它是方块/尖刺/跳板/门 */
  console.log("  各 ID 的几何(第一个物件的字段):");
  const seen: Record<string, string> = {};
  lv.objects.forEach((o) => {
    const f = fieldsOf(o);
    const id = f["1"] ?? "?";
    if (!seen[id]) seen[id] = o;
  });
  hist.slice(0, 30).forEach(([id]) => console.log(`    id ${id.padStart(6)}: ${seen[id]}`));
});

if (jsonOut) {
  fs.writeFileSync(jsonOut, JSON.stringify(summary, null, 1));
  console.log(`\nJSON 摘要写到 ${jsonOut}`);
}
