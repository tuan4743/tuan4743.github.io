/* 修:__gd 的赋值必须在"出闸前冻结"的 return 之前,否则页面没开跑时验收脚本连不上 */
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

/* ① 闸门那行改成"先暴露再返回" */
rep(`    if (!this.started) { this.draw(); return; }        // 没开跑:画面停在起点,音乐也不响`,
`    this.expose();
    if (!this.started) { this.draw(); return; }        // 没开跑:画面停在起点,音乐也不响`,
  '① 闸门前暴露');

/* ② 把原来 update 末尾的暴露抽成方法,并去掉重复 */
rep(`    (window as unknown as { __gd?: unknown }).__gd = {
      world: w, scene: this, level: LEVEL,
      audio: this.audio ? { t: this.audio.currentTime, paused: this.audio.paused, src: this.audio.src } : null,
      started: this.started,
    };
  }`,
`    this.expose();
  }

  /** 对外暴露给验收脚本(每帧刷新,验收随时读到的都是当前状态) */
  expose() {
    (window as unknown as { __gd?: unknown }).__gd = {
      world: this.world, scene: this, level: LEVEL,
      audio: this.audio ? { t: this.audio.currentTime, paused: this.audio.paused, src: this.audio.src } : null,
      started: this.started,
    };
  }`,
  '② 抽成 expose()');

/* ③ HUD 加音乐指示(用更松的锚点) */
rep(`Math.round(this.fps)`,
  `Math.round(this.fps) + (this.audio && !this.audio.paused ? ' · ♪ ' + this.audio.currentTime.toFixed(1) + 's' : ' · 按一下开始')`,
  '③ HUD 音乐指示');

fs.writeFileSync(F, s);
console.log('✓ 已写盘;应用:', done.join(' / ') || '(无)');
if (skip.length) console.log('  跳过:', skip.join(' / '));
