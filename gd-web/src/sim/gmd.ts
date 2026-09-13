/* GD 关卡数据(.gmd / 关卡字符串)的解码与解析。
 *
 * 格式(社区文档口径):
 *   整个关卡 = base64( gzip( "头部设置;物件列表" ) )
 *   头部是一条条 "k...,v...;" 的设置(比如 k1 = 物件数、k2 = 关卡名、k4 = 歌曲…)
 *   物件列表里每个物件写成 "1,<物件ID>,2,<x>,3,<y>,4,<是否翻转>,...;" —— x/y 的单位是 1/30 块,y 向上
 *
 * 这一层【不依赖任何环境】:解压那一步由调用方注入(浏览器用 DecompressionStream,
 * Node 用 zlib),所以 sim/ 里不会出现 window / 进程相关的东西。
 */

/** 解压回调:给 gzip 的字节,还一段文本(浏览器/Node 各自实现) */
export type Inflate = (bytes: Uint8Array) => Promise<string>;

export interface GmdObject {
  id: number;
  x: number;          // 单位(1 块 = 30)
  y: number;
  flipY: boolean;
  flipX: boolean;
  rot: number;        // 度
  scale: number;
  groups: number[];   // 物件所属分组(触发器靠它找目标)
  raw: number[];      // 原始数字串(没认出来的键丢不了)
}

export interface GmdLevel {
  name: string;
  objectCount: number;
  objects: GmdObject[];
  /** 头部里其它 k/v(k 是数字键);认不出来的键都留在这儿,便于以后补 */
  header: Record<string, string>;
  song: string;
  songOffset: number;
}

/** base64 → 字节(浏览器和 Node 都有 atob;没有就自己解) */
export function b64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/=]/g, '');
  if (typeof atob === 'function') {
    const bin = atob(clean);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  /* 没有 atob 就手写一份(Node 旧版本/worker 里也稳) */
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Map<string, number>();
  for (let i = 0; i < chars.length; i++) lookup.set(chars[i], i);
  const out: number[] = [];
  let buf = 0, bits = 0;
  for (const c of clean) {
    if (c === '=') break;
    const v = lookup.get(c);
    if (v == null) continue;
    buf = (buf << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; out.push((buf >> bits) & 0xff); }
  }
  return new Uint8Array(out);
}

/** 把一条"头部设置 + 物件列表"的明文解析成结构化数据。
 *  ★ 格式要点:整串是 `头部;物件;物件;…` —— **第一段是头部**(一条扁平的 k,v 列表,
 *    比如 1,<物件数>,2,<关卡名>,4,<歌曲>),从第二段起每段才是一个物件。
 *    (一开始我按"每段都可能是头部"来判,结果 id 小于 100 的物件 —— 比如方块 id=1 ——
 *     全被当成头部设置吃掉了,物件数直接对不上。) */
export function parseGmdText(text: string): GmdLevel {
  const sections = text.split(';').filter((s) => s.length > 0);
  const header: Record<string, string> = {};
  const objects: GmdObject[] = [];
  if (sections.length) {
    /* ★ 头部的值里有字符串(关卡名、歌曲名),不能整段 Number() —— 那样会把名字变成 NaN */
    const h = sections[0].split(',');
    for (let i = 0; i + 1 < h.length; i += 2) header[h[i]] = h[i + 1];
  }
  for (let si = 1; si < sections.length; si++) {
    const nums = sections[si].split(',').map((s) => Number(s));
    if (nums.length < 3 || Number.isNaN(nums[1])) continue;
    const o: GmdObject = {
      id: nums[1], x: nums[3] ?? 0, y: nums[5] ?? 0,
      flipY: false, flipX: false, rot: 0, scale: 1, groups: [], raw: nums,
    };
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const k = nums[i], v = nums[i + 1];
      if (k === 4) o.flipY = v === 1;
      else if (k === 5) o.flipX = v === 1;
      else if (k === 6) o.rot = v;
      else if (k === 7) o.scale = v / 100 || 1;
      else if (k === 57) o.groups.push(v);
    }
    objects.push(o);
  }
  return {
    name: safeDecode(header['2'] ?? ''),
    objectCount: Number(header['1'] ?? objects.length),
    objects,
    header,
    song: header['4'] ? safeDecode(header['4']) : '',
    songOffset: Number(header['13'] ?? 0),
  };
}

/** 关卡名/歌名是 URL 编码的,但坏数据里可能有非法序列(别让一个 % 把整份文件搞崩) */
function safeDecode(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}

/** 完整解码:base64 → 解压 → 解析。inflate 由调用方给(浏览器/Node 各自实现) */
export async function decodeGmd(b64: string, inflate: Inflate): Promise<GmdLevel> {
  const text = await inflate(b64ToBytes(b64));
  return parseGmdText(text);
}

/** 反向:把物件列表编回明文(导出用;压缩与 base64 交给调用方)。
 *  ★ 头部必须是【一段】扁平的 k,v 列表,不能拆成多段。 */
export function encodeGmdText(level: GmdLevel): string {
  const head: string[] = ['1', String(level.objects.length)];
  if (level.name) head.push('2', encodeURIComponent(level.name));
  if (level.song) head.push('4', encodeURIComponent(level.song));
  const body = level.objects.map((o) => {
    const kv: number[] = [1, o.id, 2, o.x, 3, o.y];
    if (o.flipY) kv.push(4, 1);
    if (o.flipX) kv.push(5, 1);
    if (o.rot) kv.push(6, o.rot);
    if (o.scale !== 1) kv.push(7, Math.round(o.scale * 100));
    for (const g of o.groups) kv.push(57, g);
    return kv.join(',');
  });
  return [head.join(','), ...body].join(';') + ';';
}
