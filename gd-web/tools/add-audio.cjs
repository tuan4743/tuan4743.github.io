/* 音乐 + 起跑闸门:
   · 页面加载后世界先冻结、音乐不播 —— 第一次按键/点击才"开跑 + 起音乐"(GD 就是这么起的)
   · 复活时把音乐拨回开头(不带节拍判定,纯粹是手感的仪式感)
   · 音频走页面层的 <audio>,不塞进 Phaser(以后接站点音频模块也方便) */
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

/* ① 字段 */
rep(`  botStates: RunState[] = [];`,
`  audio: HTMLAudioElement | null = null;
  started = false;                  // 起跑闸门:第一次按键/点击才开跑
  botStates: RunState[] = [];`,
  '① 字段');

/* ② 起跑:同一处做三件事 —— 开闸、把世界重置到起点、起音乐 */
rep(`  create() {
    this.g = this.add.graphics();`,
`  /** 第一次交互:开跑 */
  startRun() {
    if (this.started) return;
    this.started = true;
    this.world = new World(LEVEL);
    this.prevY = 0;
    this.acc = 0;
    if (!this.audio) {
      const a = document.createElement('audio');
      a.src = LEVEL.song;
      a.preload = 'auto';
      a.volume = 0.85;
      this.audio = a;
    }
    void this.audio.play().catch(() => { /* 没有音频权限就算了,画面照跑 */ });
  }

  create() {
    this.g = this.add.graphics();`,
  '② startRun');

/* ③ 第一次按键/点击触发起跑 */
rep(`    window.addEventListener('keydown', () => { this.started = true; }, { once: true });`,
`    window.addEventListener('keydown', () => this.startRun(), { once: true });
    window.addEventListener('pointerdown', () => this.startRun(), { once: true });`,
  '③ 起跑触发');

/* ④ 出闸前不推进世界 */
rep(`    this.acc += Math.min(dtMs / 1000, 0.5);
    const step = 1 / 60;`,
`    if (!this.started) { this.draw(); return; }        // 没开跑:画面停在起点,音乐也不响
    this.acc += Math.min(dtMs / 1000, 0.5);
    const step = 1 / 60;`,
  '④ 出闸前冻结');

/* ⑤ 机器人模式自动开闸(验收用) */
rep(`        this.botStarted = true;
        this.world = new World(LEVEL);`,
`        this.botStarted = true;
        this.started = true;
        this.world = new World(LEVEL);`,
  '⑤ 机器人自动开闸');

/* ⑥ 复活时音乐回开头 */
rep(`      if (w0.dead && (this.botMode || w0.deadT >= P.deadPause)) w0.respawn();`,
`      if (w0.dead && (this.botMode || w0.deadT >= P.deadPause)) {
        w0.respawn();
        if (this.audio && !this.audio.paused) this.audio.currentTime = 0;   // 重来 = 音乐也回开头
      }`,
  '⑥ 复活重放音乐');

/* ⑦ HUD 显示音乐状态 + 对外暴露 */
rep(`        ' · ' + Math.round(this.fps) + ' fps';`,
`        ' · ' + Math.round(this.fps) + ' fps' +
        (this.audio && !this.audio.paused ? ' · ♪ ' + this.audio.currentTime.toFixed(1) + 's' : ' · 按一下开始');`,
  '⑦ HUD');
rep(`    (window as unknown as { __gd?: unknown }).__gd = { world: w, scene: this, level: LEVEL };`,
`    (window as unknown as { __gd?: unknown }).__gd = {
      world: w, scene: this, level: LEVEL,
      audio: this.audio ? { t: this.audio.currentTime, paused: this.audio.paused, src: this.audio.src } : null,
      started: this.started,
    };`,
  '⑧ 对外暴露');

/* ⑨ 关卡音乐路径(站点里的第三张盘曲子) */
rep(`song: opts.song ?? '/assets/cd/lost.mp3',`, `song: opts.song ?? '/assets/cd/lost.mp3',`, '⑨ 音乐路径(保持)');

fs.writeFileSync(F, s);
console.log('✓ 已写盘;应用:', done.join(' / ') || '(无)');
if (skip.length) console.log('  跳过:', skip.join(' / '));
