/* 把一份 .gmd(或关卡字符串)跑成"哪些能用、哪些不能用"的报告。
 *
 * 用法:
 *   node tools/gmd-report.ts <文件路径>          # .gmd / .txt / 纯字符串文件都行
 *   node tools/gmd-report.ts --demo              # 没有文件时先看个示例(自造的小关卡)
 *
 * 说明:解压用 Node 的 zlib;浏览器侧用 DecompressionStream(见 src/sim/gmd.ts 的 Inflate)。
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { decodeGmd, encodeGmdText, type GmdLevel } from '../src/sim/gmd.ts';
import { coverage, formatReport } from '../src/sim/gdmap.ts';

const inflate = async (bytes: Uint8Array): Promise<string> => {
  /* GD 的关卡串是 gzip;偶尔是明文(未压缩),那就直接当文本用 */
  try {
    return gunzipSync(Buffer.from(bytes)).toString('utf8');
  } catch {
    return Buffer.from(bytes).toString('utf8');
  }
};

function demoString(): string {
  /* 自造一份"像真的一样"的小关卡:几个方块 + 刺 + 一个环 + 一堆装饰/触发器
     —— 用来演示报告长什么样,不代表任何真实关卡 */
  const objs: GmdLevel['objects'] = [];
  for (let i = 0; i < 12; i++) objs.push({ id: 1, x: 30 + i * 90, y: 0, flipY: false, flipX: false, rot: 0, scale: 1, groups: [], raw: [] });
  for (let i = 0; i < 6; i++) objs.push({ id: 8, x: 120 + i * 150, y: 0, flipY: false, flipX: false, rot: 0, scale: 1, groups: [], raw: [] });
  for (let i = 0; i < 4; i++) objs.push({ id: 39, x: 200 + i * 150, y: 0, flipY: false, flipX: false, rot: 0, scale: 1, groups: [], raw: [] });
  objs.push({ id: 103, x: 700, y: 0, flipY: false, flipX: false, rot: 0, scale: 1, groups: [], raw: [] });
  for (let i = 0; i < 40; i++) objs.push({ id: 999 + i, x: 100 + i * 60, y: 120, flipY: false, flipX: false, rot: 0, scale: 1, groups: [], raw: [] });
  for (let i = 0; i < 9; i++) objs.push({ id: 1400 + i, x: 60 + i * 200, y: 60, flipY: false, flipX: false, rot: 0, scale: 1, groups: [], raw: [] });
  return encodeGmdText({ name: 'demo', objectCount: objs.length, objects: objs, header: {}, song: '', songOffset: 0 });
}

const arg = process.argv[2];
let level: GmdLevel;
if (!arg || arg === '--demo') {
  level = await decodeGmd(Buffer.from(demoString(), 'utf8').toString('base64'), inflate);
  console.log('(示例数据 —— 自造的小关卡,只用来看报告长什么样)');
} else {
  const rawText = readFileSync(arg, 'utf8').trim();
  /* 优先当成 .gmd/关卡字符串(可能带文件头);不是的话按明文解析 */
  const b64 = rawText.replace(/^.*?<d>|<k>.*$/gs, '').trim();
  level = await decodeGmd(b64, inflate).catch(() => decodeGmd(rawText, inflate));
}

console.log('关卡名:' + (level.name || '(无名)') + ' · 头部声明物件数 ' + level.objectCount + ' · 实际解析 ' + level.objects.length);
console.log('');
console.log(formatReport(coverage(level.objects)));
