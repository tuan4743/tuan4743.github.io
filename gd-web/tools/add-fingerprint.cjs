/* 给预览场景加"机器人自检指纹":开启 botMode 时先重置世界,再把每一步的状态攒起来,
   结束时算出和 Node 侧一模一样的指纹 —— 这样"浏览器跑的和 Node 跑的是不是同一条轨迹"
   就能直接比,分岔的那一帧也能立刻定位。 */
const fs = require('fs');
const path = require('path');
const F = path.resolve(__dirname, '..', 'src', 'main.ts');
let s = fs.readFileSync(F, 'utf8');
const done = [], skip = [];
function rep(from, to, label) {
  const n = s.split(from).length - 1;
  if (n !== 1) { skip.push(label + ' (匹配 ' + n + ' 次)'); return; }
  s = s.replace(from, to); done.push(label);
}

/* ① 引入指纹工具与状态类型 */
rep(`import { World, botThink } from './sim/world.ts';`,
  `import { World, botThink, type RunState } from './sim/world.ts';
import { fingerprint } from './sim/replay.ts';`,
  '① 引入指纹');

/* ② 字段 */
rep(`  fixed = false;
  camX = 0;`,
  `  fixed = false;
  camX = 0;
  botStates: RunState[] = [];
  fp = '';
  botStarted = false;`,
  '② 字段');

/* ③ 开启 botMode 时重置世界并开始记录 */
rep(`      const w0 = this.world;`,
  `      const w0 = this.world;
      if (this.botMode && !this.botStarted) {       // 开机器人 = 从干净的一局开始,方便和 Node 侧对指纹
        this.botStarted = true;
        this.world = new World(LEVEL);
        this.botStates = [];
        this.fp = '';
        this.prevY = 0;
      }`,
  '③ 机器人开局重置');

/* ④ 每步记录状态;跑完算指纹 */
rep(`      this.prevY = w0.y;
      w0.frame(hold);`,
  `      this.prevY = w0.y;
      w0.frame(hold);
      if (this.botMode) {
        this.botStates.push(w0.state);
        if (w0.done && !this.fp) this.fp = fingerprint(this.botStates);
      }`,
  '④ 记录状态');

fs.writeFileSync(F, s);
console.log('✓ 已写盘;应用:', done.join(' / ') || '(无)');
if (skip.length) console.log('  跳过:', skip.join(' / '));
