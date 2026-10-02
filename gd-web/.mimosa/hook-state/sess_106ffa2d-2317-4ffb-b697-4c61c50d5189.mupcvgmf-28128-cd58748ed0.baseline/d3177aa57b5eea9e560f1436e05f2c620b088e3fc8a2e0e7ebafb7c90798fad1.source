/* CCLocalLevels.dat 的解析(给 dat-report / dat-to-chart 共用)。
 *
 * 格式(实测):
 *   文件 = 每个字节 XOR 0x0B → base64 文本 → gzip → plist(XML)
 *   plist 用的是 GD 自己的紧凑标签:<k>键</k> <d>字典</d> <s>串</s> <i>整数</i> <t/> <f/>
 *   每关一份 dict,其中 k2 = 关卡名,k4 = 关卡数据
 *   关卡数据 = base64(gzip("头部k,v,k,v…;物件;物件…"))
 *   物件 = "1,id,2,x,3,y,4,flipY,5,flipX,6,rot,128,scaleX,129,scaleY,155,layer,…"
 *
 * 踩过的坑(都写在这儿,别再踩):
 *   ① 开头的 <?xml …?> 会让自写的标签解析器卡死 → 先 replace 掉;
 *   ② 字典循环必须带 pos < xml.length 的条件,否则读到末尾会空转跑不完。
 */
import fs from 'node:fs';
import zlib from 'node:zlib';

export type Val = Dict | Val[] | string | number | boolean;
export type Dict = Record<string, Val>;

/** ① XOR → base64 → gunzip → XML 文本 */
export function unwrapSave(path: string): string {
  const raw = fs.readFileSync(path);
  const xored = Buffer.from(raw.map((b) => b ^ 0x0b));
  const text = xored.toString('utf8').trim();
  const gz = Buffer.from(text, 'base64');
  return zlib.gunzipSync(gz).toString('utf8').replace(/^\uFEFF/, '').replace(/<\?xml[^>]*\?>/g, '').trim();
}

/** ② GD 的紧凑 plist 解析(标签递归下降) */
export function parseNode(xml: string, pos: number): [Val, number] {
  const tag = /^<([a-z]+)[^>]*?(\/)?>/.exec(xml.slice(pos, pos + 200));
  if (!tag) {
    if (!warned) {
      warned = true;
      console.warn('  ⚠ 解析器在 ' + pos + ' 处认不出标签: ' + JSON.stringify(xml.slice(pos, pos + 40)));
    }
    return ['', pos + 1];
  }
  const name = tag[1];
  const selfClosing = !!tag[2];
  pos += tag[0].length;
  if (name === 'plist' || name === 'dict' || name === 'd' || name === 'a') {
    if (name === 'plist') {
      const [v, p] = parseNode(xml, pos);
      return [v, xml.startsWith('</plist>', p) ? p + 8 : p];
    }
    if (name === 'a') {
      const arr: Val[] = [];
      while (pos < xml.length && !xml.startsWith('</a>', pos)) {
        const [v, p] = parseNode(xml, pos);
        arr.push(v);
        pos = p;
      }
      return [arr, pos < xml.length ? pos + 4 : pos];
    }
    const dict: Dict = {};
    while (pos < xml.length && !xml.startsWith('</d>', pos) && !xml.startsWith('</dict>', pos) && !xml.startsWith('</plist>', pos)) {
      if (xml.startsWith('<k>', pos)) {
        const end = xml.indexOf('</k>', pos);
        const key = xml.slice(pos + 3, end);
        pos = end + 4;
        const [v, p] = parseNode(xml, pos);
        dict[key] = v;
        pos = p;
      } else {
        const [v, p] = parseNode(xml, pos);
        dict[String(Object.keys(dict).length)] = v;
        pos = p;
      }
    }
    if (pos >= xml.length) return [dict, pos];
    return [dict, pos + (xml.startsWith('</d>', pos) ? 4 : 7)];
  }
  if (selfClosing) return [name === 't', pos];
  const close = `</${name}>`;
  const end = xml.indexOf(close, pos);
  if (end < 0) return ['', pos + 1];
  const text = xml.slice(pos, end)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return [name === 'i' || name === 'r' ? Number(text) : text, end + close.length];
}
let warned = false;

/** 递归找出所有"带 k4 的字典" = 一关 */
export function findLevels(node: Val, out: Dict[] = []): Dict[] {
  if (Array.isArray(node)) { node.forEach((n) => findLevels(n, out)); return out; }
  if (node && typeof node === 'object') {
    const d = node as Dict;
    if (typeof d.k4 === 'string' && String(d.k4).startsWith('H4sI')) out.push(d);
    Object.values(d).forEach((v) => findLevels(v, out));
  }
  return out;
}

export interface RawLevel {
  name: string;
  header: Record<string, string>;
  lines: string[];        // 每个物件的原始串
}

/** ③ 关卡数据:base64(gzip("头;物件…")) → 头部字段 + 物件串 */
export function decodeLevel(b64: string, name = ''): RawLevel {
  const data = zlib.gunzipSync(Buffer.from(b64, 'base64')).toString('utf8');
  const parts = data.split(';');
  const header: Record<string, string> = {};
  const h = parts[0].split(',');
  for (let i = 0; i + 1 < h.length; i += 2) header[h[i]] = h[i + 1];
  return { name, header, lines: parts.slice(1).filter((s) => s.length > 1) };
}

/** 一行物件 → 字段表(键值交替) */
export function fieldsOf(line: string): Record<string, string> {
  const out: Record<string, string> = {};
  const f = line.split(',');
  for (let i = 0; i + 1 < f.length; i += 2) out[f[i]] = f[i + 1];
  return out;
}

/** 一把梭:读文件 → 所有关卡(按存档里的顺序) */
export function loadSave(path: string): RawLevel[] {
  const xml = unwrapSave(path);
  const [tree] = parseNode(xml, 0);
  return findLevels(tree).map((d) => {
    const name = typeof d.k2 === 'string' ? d.k2 : '(无名)';
    return decodeLevel(typeof d.k4 === 'string' ? d.k4 : '', name);
  });
}
