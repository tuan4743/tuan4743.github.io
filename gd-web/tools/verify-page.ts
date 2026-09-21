/* 页面回归门:验【博客那一页真的会放 bot 通关】。
 * ─────────────────────────────────────────────────────────────
 * verify-run.ts 管的是"这卷输入在当前物理下还能不能通关";
 * 本工具管的是另一半 —— 【从仓库文件到浏览器真正拿到的东西】这一段有没有断:
 *   1. 模板 layouts/partials/pages/lost.html 引了 /assets/gd/gd.js?v=NN;
 *   2. 那份 gd.js 就是当前源码构建出来的(和 static/ 里的哈希一致);
 *   3. 站点目录 public/ 里发布的 gd.js / gd-tape.json / index.html 与 static/ 一致
 *      (hugo 是另一个进程在跑,改了模板忘了重建就会在这里露馅);
 *   4. 页面上的五个挂载点(canvas/HUD/三个按钮)在 gd.js 里都找得到;
 *   5. gd.js 里写死的输入卷路径与模板同目录的那份文件对得上;
 *   6. 浏览器真正会拿到的那份 gd-tape.json(public/ 里的)解码后帧数自洽,
 *      并且在当前物理下 0 死亡通关 —— 页面拿到的不是"另一份旧卷子"。
 * 跑法:cd gd-web && node tools/verify-page.ts
 * ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';

const ROOT = path.resolve('..');                       // tuagfey-blog/
const LAYOUT = path.join(ROOT, 'layouts/partials/pages/lost.html');
const STATIC_JS = path.join(ROOT, 'static/assets/gd/gd.js');
const STATIC_TAPE = path.join(ROOT, 'static/assets/gd-tape.json');
const PUB_JS = path.join(ROOT, 'public/assets/gd/gd.js');
const PUB_TAPE = path.join(ROOT, 'public/assets/gd-tape.json');
const PUB_HTML = path.join(ROOT, 'public/index.html');

const res: string[] = [];
const ok = (c: boolean, m: string) => { res.push((c ? '✓ ' : '✗ ') + m); return c; };
const sha = (f: string) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 12);
const need = (f: string, what: string) => fs.existsSync(f) ? fs.readFileSync(f, 'utf8')
  : (ok(false, '缺文件:' + what + '(' + f + ')'), '');

/* --- 1. 模板引用的包 --- */
const html = need(LAYOUT, '关卡页模板');
const m = /src=["']?\/assets\/gd\/gd\.js\?v=(g\d+)/.exec(html);
ok(!!m, '模板引用了 /assets/gd/gd.js' + (m ? '?v=' + m[1] : '(没找到 ?v= 版本戳)'));

/* --- 2/3. 构建产物与发布目录 --- */
const js = need(STATIC_JS, '构建产物 gd.js');
ok(js.length > 100000, 'gd.js 有内容(' + (js.length / 1024).toFixed(0) + ' KB)');
ok(fs.existsSync(PUB_JS) && sha(PUB_JS) === sha(STATIC_JS),
  'public/ 里发布的 gd.js 与 static/ 一致(' + sha(STATIC_JS) + ')');
ok(fs.existsSync(PUB_TAPE) && sha(PUB_TAPE) === sha(STATIC_TAPE),
  'public/ 里发布的 gd-tape.json 与 static/ 一致(' + sha(STATIC_TAPE) + ')');
const pubHtml = need(PUB_HTML, '站点首页');
ok(m ? pubHtml.includes('gd.js?v=' + m[1]) : false,
  '站点首页里的版本戳与模板一致' + (m ? '(v=' + m[1] + ')' : '') + ' —— hugo 确实重建过');

/* --- 4. 挂载点 --- */
const mounts = ['gd-canvas', 'gd-hud', 'gd-demo', 'gd-god', 'gd-restart'];
const missMount = mounts.filter((id) => !js.includes(id));
ok(missMount.length === 0, '页面上要挂的东西 gd.js 里都有(' + mounts.join('/') + ')'
  + (missMount.length ? ' 缺:' + missMount.join(',') : ''));

/* --- 5. 输入卷路径 --- */
ok(js.includes('/assets/gd-tape.json'), 'gd.js 里写死的输入卷路径是 /assets/gd-tape.json');

/* --- 6. 浏览器拿到的那份卷子:解码 + 通关 --- */
const raw = JSON.parse(fs.readFileSync(PUB_TAPE, 'utf8')) as {
  level: string; frames: number; first: boolean; rle: number[]; done: boolean; deaths: number;
};
const tape: boolean[] = (() => {
  const out: boolean[] = [];
  let cur = raw.first;
  for (const n of raw.rle) { for (let i = 0; i < n; i++) out.push(cur); cur = !cur; }
  return out;
})();
ok(tape.length === raw.frames, 'RLE 解码帧数与声明一致(' + tape.length + ' 帧 = ' + (tape.length / 60).toFixed(1) + 's)');
const w = new World(WATER_CHART);
let deaths = 0;
for (const hold of tape) {
  if (w.dead) { deaths++; w.respawn(); }
  w.frame(hold);
  if (w.done) break;
}
ok(w.done && deaths === 0, '浏览器拿到的那份卷子:0 死亡通关(终点 x=' + (w.x / U).toFixed(1)
  + '/' + WATER_CHART.length + ' 块 · done=' + w.done + ' · 死了 ' + deaths + ' 次)');
ok(raw.done === true, '卷子自己记着 done=true · 打包时死亡 ' + raw.deaths + ' 次');

console.log(res.join('\n'));
const bad = res.filter((r) => r.startsWith('✗')).length;
console.log(bad ? '\n不合格:' + bad + ' 项' : '\n全部通过:这一页【现在】打开就能看到 bot 通关');
process.exit(bad ? 1 : 0);
