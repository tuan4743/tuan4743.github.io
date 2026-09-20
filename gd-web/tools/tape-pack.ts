/* 把搜索出来的【通关输入卷】打包成可入库的紧凑格式(RLE)。
 * 原始一卷是 21187 个 true/false(JSON 里 123 KB),压缩成"按住 N 帧 / 松手 M 帧"的数字对,
 * 只留 ~25 KB —— 这份文件同时给两处用:
 *   1. `tools/verify-run.ts` —— Node 侧的回归门:每次改物理都回放一遍,必须还是 0 死亡通关;
 *   2. 页面上的【看 bot 通关】演示 —— 直接 fetch 这份 JSON 喂给模拟。
 * 跑法:cd gd-web && node tools/tape-pack.ts [源文件] [目标文件]
 *   默认:../../.tmp/gd/water.solution.json → ../static/assets/gd-tape.json
 *   ★ 不能放进 static/assets/gd/ —— 那是 vite.lib.config.ts 的 outDir,而且 emptyOutDir: true,
 *     每次 npm run build:embed 都会把那个目录清空(踩过:打包好的卷子被构建顺手删了)。
 *   ★ 搜索的输出统一放工作区根目录的 .tmp/(在 git 仓库外面,免得误提交)。
 * ============================================================ */
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2] ?? '../../.tmp/gd/water.solution.json';
const DST = process.argv[3] ?? '../static/assets/gd-tape.json';

const raw = JSON.parse(fs.readFileSync(SRC, 'utf8')) as {
  level: string; tape: boolean[]; done: boolean; deaths: number;
};
const t = raw.tape;
if (!t?.length) throw new Error('源文件里没有 tape:' + SRC);

/* RLE:先记第一帧的值,然后交替记"这一段有多长" */
const rle: number[] = [];
let cur = t[0], n = 0;
for (const h of t) {
  if (h === cur) n++;
  else { rle.push(n); cur = h; n = 1; }
}
rle.push(n);
const sum = rle.reduce((a, b) => a + b, 0);
if (sum !== t.length) throw new Error('RLE 长度对不上:' + sum + ' ≠ ' + t.length);

const out = {
  level: raw.level,
  frames: t.length,
  seconds: +(t.length / 60).toFixed(2),
  first: t[0],
  rle,
  done: raw.done,
  deaths: raw.deaths,
  /* 出处:哪一版搜索、什么参数搜出来的 —— 以后换了参数要能说清这份卷子是哪来的 */
  from: 'tools/autoplay.ts v3(宏动作最优优先树搜索)',
};
fs.mkdirSync(path.dirname(DST), { recursive: true });
fs.writeFileSync(DST, JSON.stringify(out));
const kb = (f: string) => (fs.statSync(f).size / 1024).toFixed(1) + ' KB';
console.log('源 ' + SRC + '(' + kb(SRC) + ')→ 目标 ' + DST + '(' + kb(DST) + ')');
console.log('帧 ' + t.length + '(' + (t.length / 60).toFixed(1) + 's)· RLE ' + rle.length + ' 段 · 按住 '
  + t.filter(Boolean).length + ' 帧 · done=' + raw.done + ' · deaths=' + raw.deaths);
