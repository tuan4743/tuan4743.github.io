/* 渲染层:Phaser 4 只做"画"和"收输入",所有判定都来自 sim/。
 * 风格:本站的 holo / 显示器语言 —— 深底、青色描边、细网格、发光圆环、等宽字。
 *
 * 这一版修的三件大事(都是用户实测反馈):
 *   ① 【上下翻转】世界坐标 y 向上,而 Phaser 相机 y 向下 —— 所有 y 现在统一过 Y() 转换,
 *      于是"下落"看着是下落、尖刺朝上、地面在底部;
 *   ② 【画面太大】可见宽度从 17.8 块放大到 36 块(VIEW_W_BLOCKS 一个常量就能再调);
 *   ③ 【按拍子走】铺面是按 onset 放的,所以画面的时间轴【由音乐驱动】:
 *      每帧读 audio.currentTime,模拟推进到对应的那一帧;复活时把音乐 seek 到存档点的时间。
 */

import Phaser from 'phaser';
import { generateLevel, tOfX, type Level, type Mode } from './sim/level.ts';
import { World, botThink, type RunState } from './sim/world.ts';
import { fingerprint } from './sim/replay.ts';
import { P, U, ROWS, Y_TIME_SCALE } from './sim/constants.ts';

const HL = '#7ff0ff';
/* 每段一个强调色:网格、地面、门的颜色都跟着走,一眼知道跑到第几段 */
const PAL = [0x7ff0ff, 0xffe17a, 0xa0ffd0, 0xc6a0ff, 0xff9fd0];
const HLD = 0x7ff0ff;
const WARN = 0xff9a6b;
/** 可见宽度(块)。★用户反馈"画面特别大,整体缩小一倍":从 17.8 块 → 36 块。想再调就改这一条 */
const VIEW_W_BLOCKS = 36;
const LEVEL: Level = generateLevel({ seed: 20260913 });

/* 跳环 / 弹簧的配色(和游戏里的常识一致:黄=跳,粉=小跳,蓝=翻重力,绿=翻重力+跳) */
const ORB_COL: Record<string, number> = {
  yellow: 0xffe17a, pink: 0xff9fd0, red: 0xff8a8a, blue: 0x9fd8ff, green: 0xa0ffd0,
};
const PAD_COL: Record<string, number> = {
  yellow: 0xffe17a, pink: 0xff9fd0, red: 0xff8a8a, blue: 0x9fd8ff, purple: 0xc6a0ff,
};

/** 调试用:按 1~7 现场换形态,方便一个个试手感(1 方块 2 飞机 3 球 4 UFO 5 波浪 6 机器人 7 蜘蛛) */
const MODE_ORDER: Mode[] = ['cube', 'ship', 'ball', 'ufo', 'wave', 'robot', 'spider'];
/** HUD 里的形态名 */
const MODE_NAME: Record<string, string> = {
  cube: '方块', ship: '飞机', ball: '球', ufo: 'UFO', wave: '波浪', robot: '机器人', spider: '蜘蛛',
};

/** 当前所在段落的名字(只是给 HUD 看的,不影响判定) */
function segOf(x: number): string {
  const b = x / U;
  const sg = LEVEL.segments.find((s) => b >= s.from && b < s.to);
  return sg ? (sg.label || sg.mode) : '';
}

/** 界面阶段。★ 以前"任何按键/点击"都会开跑,于是面板一加载、加载动画还在放,游戏就开始了 ——
 *  现在只有"明确的确认键(空格/上/W)或点画布"才开始,死亡/通关也会停下来等人。 */
type Phase = 'idle' | 'running' | 'dead' | 'done';

class Scene extends Phaser.Scene {
  world = new World(LEVEL);
  g!: Phaser.GameObjects.Graphics;
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  acc = 0;
  prevY = 0;
  fps = 0;
  fixed = false;
  camX = 0;
  audio: HTMLAudioElement | null = null;
  started = false;                  // 起跑闸门:按了确认键才开跑
  audioErr = '';                    // play() 失败的原因(验收要看)
  botStates: RunState[] = [];
  fp = '';
  botMode = false;
  botStarted = false;
  baseTick = 0;                     // 这一条命的起点在音乐时间轴上的帧号(复活时跟着存档点走)
  airT = 0;                         // 空中停留了多久(给方块自转用)
  labels: Phaser.GameObjects.Text[] = [];
  phase: Phase = 'idle';
  deathT = 0;                       // 死亡后过了多久(先停一拍再出菜单)
  clicked = false;                  // 画布上被点过一下
  private prevHeld = false;         // 上一帧有没有按着确认键(用来算"按下"的边沿)
  private prevR = false;
  private restartPressed = false;
  private confirmLatch = false;     // 真实的 keydown 事件(比"每帧查 isDown"可靠:极短的一下也收得到)
  private restartLatch = false;
  private modeLatch = 0;            // 数字键 1~7:调试用的现场换形态
  uiTitle!: Phaser.GameObjects.Text;
  uiHint!: Phaser.GameObjects.Text;

  /** 第一次确认:开跑(音乐和模拟同时从 0 开始 —— 铺面贴着音乐,不能有"准备时间") */
  startRun() {
    if (this.phase !== 'idle') return;
    this.phase = 'running';
    this.started = true;
    this.world = new World(LEVEL);
    this.baseTick = 0;
    this.prevY = 0;
    this.acc = 0;
    this.airT = 0;
    this.deathT = 0;
    if (!this.audio) {
      const a = document.createElement('audio');
      a.src = LEVEL.song;
      a.preload = 'auto';
      a.volume = 0.85;
      this.audio = a;
    }
    this.playMusicAt(0);
  }

  private playMusicAt(t: number) {
    const a = this.audio;
    if (!a) return;
    try { a.currentTime = t; } catch { /* seek 失败就从头放 */ }
    a.play().catch((e) => { this.audioErr = String((e && e.message) || e); });   // 失败原因留着,别静默吞
  }

  private pauseMusic() { if (this.audio && !this.audio.paused) this.audio.pause(); }

  /** 从存档点重来(死亡界面按确认) */
  retry() {
    const w = this.world;
    w.respawn();
    this.baseTick = Math.floor(tOfX(LEVEL, w.checkX) * 60);
    this.airT = 0;
    this.acc = 0;
    this.deathT = 0;
    this.prevY = w.y;
    this.phase = 'running';
    this.playMusicAt(tOfX(LEVEL, w.checkX));
  }

  /** 从头来(R 键,死亡界面与通关界面都能用) */
  restartFromZero() {
    this.world.reset(0, 'cube');
    this.baseTick = 0;
    this.airT = 0;
    this.acc = 0;
    this.deathT = 0;
    this.prevY = 0;
    this.phase = 'running';
    this.playMusicAt(0);
  }

  create() {
    this.g = this.add.graphics();
    this.keys = this.input.keyboard!.addKeys('SPACE,UP,W,R') as Record<string, Phaser.Input.Keyboard.Key>;
    this.cameras.main.setBackgroundColor('#05070d');
    this.cameras.main.setZoom(this.zoomOf());
    /* ★ 只在【画布上】点才算确认 —— 以前监听 window,点导航、点 CD 面板都会顺手把游戏开起来 */
    this.input.on('pointerdown', () => { this.clicked = true; });
    /* 空格 / 上 / W 才算"确认",其它按键一概不理(以前任何按键都会开跑);
       数字键 1~7 是调试用的"现场换形态" */
    window.addEventListener('keydown', (ev: KeyboardEvent) => {
      if (ev.code === 'Space' || ev.code === 'ArrowUp' || ev.code === 'KeyW') this.confirmLatch = true;
      if (ev.code === 'KeyR') this.restartLatch = true;
      if (/^Digit[1-7]$/.test(ev.code)) this.modeLatch = Number(ev.code.slice(5));
    });
    const ui = { fontFamily: 'ui-monospace, Consolas, monospace', align: 'center' as const };
    this.uiTitle = this.add.text(0, 0, '', { ...ui, fontSize: '44px', color: '#e2f6ff' }).setOrigin(0.5).setDepth(20).setVisible(false);
    this.uiHint = this.add.text(0, 0, '', { ...ui, fontSize: '24px', color: HL }).setOrigin(0.5).setDepth(20).setVisible(false);
    /* 段落名做成场上的水印(以前只画了个空框,字根本没出来) */
    for (const sg of LEVEL.segments) {
      if (!sg.label) continue;
      const t = this.add.text(sg.from * U + 13 * U, 0, sg.label, {
        fontFamily: 'ui-monospace, Consolas, monospace',
        fontSize: '30px', color: HL,
      });
      t.setOrigin(0, 0.5).setAlpha(0.22);
      this.labels.push(t);
    }
  }

  /** 这一帧有没有"确认"输入(空格 / 上 / W / 在画布上点一下)。
   *  ★ 用"自己记上一帧"的边沿判定,不用 Phaser.Input.Keyboard.JustDown ——
   *    实测在这个页面里 JustDown 收不到(按键的 isDown 是好的),于是按空格开不了局。 */
  private confirmDown(): boolean {
    const k = this.keys;
    const held = !!(k.SPACE?.isDown || k.UP?.isDown || k.W?.isDown);
    const edge = held && !this.prevHeld;
    const rEdge = (!!k.R?.isDown && !this.prevR) || this.restartLatch;
    this.prevHeld = held;
    this.prevR = !!k.R?.isDown;
    this.restartPressed = rEdge;
    this.restartLatch = false;
    if (this.confirmLatch) { this.confirmLatch = false; this.clicked = false; return true; }
    if (edge) { this.clicked = false; return true; }
    if (this.clicked) { this.clicked = false; return true; }
    return false;
  }

  /** 可见宽度 = VIEW_W_BLOCKS 块 */
  zoomOf() {
    return 1280 / (VIEW_W_BLOCKS * U);
  }

  /** 推进 n 帧模拟(输入按当前模式取:机器人 / 键盘) */
  pump(n: number) {
    for (let i = 0; i < n; i++) {
      const w0 = this.world;
      if (w0.dead) {
        if (this.botMode) {
          /* 机器人验收:立刻复活,和 Node 侧一致 */
          const wasX = w0.checkX;
          w0.respawn();
          this.baseTick = Math.floor(tOfX(LEVEL, wasX) * 60);
          this.airT = 0;
        } else {
          this.phase = 'dead';                  // 真人:停下来出死亡界面,不再自动复活
          this.deathT = 0;
          this.pauseMusic();
          return;
        }
      }
      const hold = this.botMode ? botThink(w0)
        : !!(this.keys.SPACE?.isDown || this.keys.UP?.isDown || this.keys.W?.isDown);
      if (this.botMode && !this.botStarted) {       // 开机器人 = 从干净的一局开始,方便和 Node 侧对指纹
        this.botStarted = true;
        this.started = true;
        this.world = new World(LEVEL);
        this.botStates = [];
        this.fp = '';
        this.prevY = 0;
        this.airT = 0;
        this.baseTick = 0;
        continue;
      }
      this.prevY = w0.y;
      w0.frame(hold);
      this.airT = w0.onGround ? 0 : this.airT + 1 / 60;
      if (this.botMode) {
        this.botStates.push(w0.state);
        if (w0.done && !this.fp) this.fp = fingerprint(this.botStates);
      }
      if (w0.done) {
        if (!this.botMode) { this.phase = 'done'; this.pauseMusic(); }
        break;
      }
    }
  }

  update(_t: number, dtMs: number) {
    this.expose();
    this.fps = this.game.loop.actualFps;
    this.paintHud();
    /* 确认键每帧只读一次(边沿判定要按帧消费) */
    const confirm = this.confirmDown();
    const restart = this.restartPressed;
    if (this.botMode && this.phase !== 'running') { this.phase = 'running'; this.started = true; }
    /* 调试:数字键现场换形态(1 方块 2 飞机 3 球 4 UFO 5 波浪 6 机器人 7 蜘蛛) */
    if (this.modeLatch) {
      const m = MODE_ORDER[this.modeLatch - 1];
      if (m) {
        this.world.mode = m;
        this.world.gdir = 1;
        this.world.vy = 0;
        this.world.y = Math.max(0, Math.min(this.world.y, ROWS * U - P.box));
      }
      this.modeLatch = 0;
    }

    if (this.phase === 'idle') {
      if (confirm) this.startRun();
      this.followCamera(); this.draw(); this.paintUi(); return;
    }
    if (this.phase === 'dead') {
      this.deathT += dtMs / 1000;
      /* 停半拍再收输入,免得"死亡瞬间还按着的手"直接把菜单点掉 */
      if (this.deathT > 0.35) {
        if (restart) this.restartFromZero();
        else if (confirm) this.retry();
      }
      this.followCamera(); this.draw(); this.paintUi(); return;
    }
    if (this.phase === 'done') {
      this.deathT += dtMs / 1000;
      if (restart || (this.deathT > 0.5 && confirm)) this.restartFromZero();
      this.followCamera(); this.draw(); this.paintUi(); return;
    }

    if (this.botMode) {
      this.pump(8);                                    // 机器人验收:加速跑完(物理仍是定点步长)
    } else {
      const a = this.audio;
      const live = !!a && !a.paused && isFinite(a.duration) && a.duration > 0;
      const step = 1 / 60;
      if (live) {
        /* ★ 由音乐驱动:画面里的障碍正好落在它对应的那一拍上 */
        const target = Math.max(0, Math.floor(a!.currentTime * 60) - this.baseTick);
        let n = 0;
        while (this.world.tick < target && n < 8) { this.pump(1); n++; }
      } else {
        this.acc += Math.min(dtMs / 1000, 0.5);
        let n = 0;
        while (this.acc >= step && n < 5) { this.acc -= step; this.pump(1); n++; }
      }
    }
    if (this.phase !== 'running') { this.followCamera(); this.draw(); this.paintUi(); return; }   // pump 里可能刚死/刚通关
    this.followCamera();
    this.draw();
    this.paintUi();
    this.expose();
  }

  /** HUD(DOM 里那条):每帧都刷 —— 以前只在"跑着"的分支里刷,死亡界面上的 HUD 是残留的旧值 */
  private paintHud() {
    const hud = document.getElementById('gd-hud');
    if (!hud) return;
    const w = this.world;
    const parts = [
      MODE_NAME[w.mode] ?? w.mode,
      segOf(w.x) || '',
      Math.round(w.progress * 100) + '%',
      '尝试 ' + String(w.attempts).padStart(2, '0'),
    ];
    if (this.phase === 'dead') parts.push('摔了');
    if (this.phase === 'idle') parts.push('按空格开始');
    if (this.phase === 'done') parts.push('通关');
    if (w.mode === 'ship') parts.push('按住 = 上升');
    parts.push(Math.round(this.fps) + ' fps');
    parts.push(this.audio && !this.audio.paused ? '♪ ' + this.audio.currentTime.toFixed(1) + 's' : '暂停');
    hud.textContent = parts.filter(Boolean).join(' · ');
    hud.classList.toggle('is-dead', this.phase === 'dead');
  }

  /** 取景:横向让玩家落在左侧 22% 处,纵向固定居中于场地(所有阶段都要跑,否则开场画面还停在左上角) */
  private followCamera() {
    const cam = this.cameras.main;
    const vw = cam.width / cam.zoom;
    this.camX = Math.max(vw / 2, this.world.x + vw * 0.22);
    cam.centerOn(this.camX, ROWS * U / 2);
  }

  /** 三个界面(开场 / 死亡 / 通关)的文字:位置跟着相机取景走 */
  private paintUi() {
    const cam = this.cameras.main;
    const vw = cam.width / cam.zoom;
    const ux = Math.max(vw / 2, this.camX);
    const uy = ROWS * U / 2;
    const w = this.world;
    const show = this.phase !== 'running';
    this.uiTitle.setVisible(show);
    this.uiHint.setVisible(show);
    if (!show) return;
    if (this.phase === 'idle') {
      this.uiTitle.setText('第三张盘 · 迷茫');
      this.uiHint.setText('按 空格 开始(也可以点一下画面)\n按住 = 连跳 · 弹簧碰到就弹、不用按 · 跳环要按一下 · R = 重来');
    } else if (this.phase === 'dead') {
      this.uiTitle.setText('摔了 · ' + Math.round(w.progress * 100) + '%');
      this.uiHint.setText('空格 / 点一下 = 从上一处存档点(' + Math.round(tOfX(LEVEL, w.checkX) / tOfX(LEVEL, LEVEL.length) * 100) + '% 处)重来 · R = 从头开始');
    } else {
      this.uiTitle.setText('通关 · ' + Math.round(w.progress * 100) + '%');
      this.uiHint.setText('你跑完了这一张盘 · 按 R 再来一遍');
    }
    this.uiTitle.setPosition(ux, uy - 26);
    this.uiHint.setPosition(ux, uy + 34);
  }

  /** 对外暴露给验收脚本(每帧刷新,验收随时读到的都是当前状态) */
  expose() {
    (window as unknown as { __gd?: unknown }).__gd = {
      world: this.world, scene: this, level: LEVEL,
      audio: this.audio ? { t: this.audio.currentTime, paused: this.audio.paused, duration: this.audio.duration || 0, err: this.audioErr, src: this.audio.src } : null,
      started: this.started,
      phase: this.phase,
    };
  }

  draw() {
    const g = this.g, w = this.world, cam = this.cameras.main;
    /* ★ 真正的病根在【viewport】:create() 时父容器还没量到尺寸,相机的 viewport 被定成
       320×180(恰好四分之一),渲染就被裁在左上角一小块里 —— 只改 setSize 没用,得设 viewport。 */
    if (!this.fixed) {
      this.fixed = true;
      cam.setViewport(0, 0, 1280, 720);
      cam.setSize(1280, 720);
      cam.setZoom(this.zoomOf());
    }
    const bx = w.x / U;
    const seg = LEVEL.segments.find((sg) => bx >= sg.from && bx < sg.to) || LEVEL.segments[0];
    const tint = PAL[LEVEL.segments.indexOf(seg) % PAL.length];
    const vw = cam.width / cam.zoom, vh = cam.height / cam.zoom;
    const x0 = this.camX - vw / 2, x1 = x0 + vw;
    /* ★ 绘图空间:y 向下,地面在 ROWS*U 处 —— 世界坐标过来一律走它,整幅画就不会再倒过来 */
    const Y = (wy: number) => ROWS * U - wy;
    const dy0 = ROWS * U / 2 - vh / 2, dy1 = dy0 + vh;
    const groundY = Y(0), ceilY = Y(ROWS * U);
    const tick = this.world.tick;
    g.clear();

    /* 场地之外压暗(10 行的场地只占屏幕中间一半,压暗之后一眼知道哪里是"跑道") */
    g.fillStyle(0x03050a, 0.72);
    g.fillRect(x0, dy0, vw, Math.max(0, groundY + U - dy0));
    g.fillRect(x0, ceilY - U, vw, Math.max(0, dy1 - (ceilY - U)));
    /* 跑道本身给一层极淡的底色 + 上下边框,和"场地外"分开 */
    g.fillStyle(tint, 0.025).fillRect(x0, ceilY, vw, groundY - ceilY);

    // 场地网格(每块一条细线)
    g.lineStyle(1, tint, 0.09);
    for (let gx = Math.floor(x0 / U); gx <= x1 / U; gx++) g.lineBetween(gx * U, dy0, gx * U, dy1);
    for (let r = 0; r <= ROWS; r++) g.lineBetween(x0, Y(r * U), x1, Y(r * U));
    // 地面线与天花板线(跑道的上下边)
    g.lineStyle(2, tint, 0.6).lineBetween(x0, groundY, x1, groundY);
    g.lineStyle(1, tint, 0.42).lineBetween(x0, ceilY, x1, ceilY);
    /* 地面以下:几条越来越淡的横线,做出"地下"的厚度感 */
    g.lineStyle(1, tint, 0.18);
    for (let k = 1; k <= 4; k++) g.lineBetween(x0, groundY + k * 22, x1, groundY + k * 22);

    // 物件
    for (const o of LEVEL.objects) {
      const obx = o.b * U, obw = o.w * U, obh = o.h * U;
      const oTop = Y((o.r + o.h) * U);          // 格子上边(绘图空间)
      const oBot = Y(o.r * U);                  // 格子下边
      if (obx + obw < x0 || obx > x1) continue;
      switch (o.kind) {
        case 'platform':
          if (o.r < 0) {
            /* 地面:厚条 + 顶部亮线 + 斜纹(和平台、方块一眼分开) */
            g.fillStyle(tint, 0.13).fillRect(obx, oTop, obw, obh);
            g.lineStyle(2, tint, 0.9).lineBetween(obx, oTop + 1, obx + obw, oTop + 1);
            g.lineStyle(1, tint, 0.22);
            for (let hx = obx + 10; hx < obx + obw; hx += 18) g.lineBetween(hx, oTop + 4, hx - 6, oTop + obh - 2);
          } else {
            /* 平台:薄板贴在格子顶面(碰撞面就是顶面),两端小竖线 */
            const th = U * 0.34;
            g.fillStyle(tint, 0.18).fillRect(obx, oTop, obw, th);
            g.lineStyle(2, tint, 0.8).strokeRect(obx + 1, oTop + 1, obw - 2, th - 2);
          }
          break;
        case 'block': {
          /* 方块:实心 + 顶部高光 + 右上缺角,和地面/平台都不同 */
          g.fillStyle(tint, 0.20).fillRect(obx, oTop, obw, obh);
          g.lineStyle(2, tint, 0.85).strokeRect(obx + 1, oTop + 1, obw - 2, obh - 2);
          g.fillStyle(tint, 0.6).fillRect(obx + 3, oTop + 3, obw - 6, 2);
          g.fillStyle(tint, 0.55).fillTriangle(obx + obw, oTop, obx + obw - 9, oTop, obx + obw, oTop + 9);
          break;
        }
        case 'spike':
          /* 尖刺:底边在格子下沿、尖朝上;亮描边 + 暗填充,一眼看出是"要跳过去"的东西 */
          for (let k = 0; k < o.w; k++) {
            const sx = obx + k * U;
            g.fillStyle(0x2a1408, 0.95).fillTriangle(sx + 2, oBot, sx + U / 2, oBot - U * 0.9, sx + U - 2, oBot);
            g.lineStyle(2, WARN, 0.95);
            g.beginPath();
            g.moveTo(sx + 2, oBot); g.lineTo(sx + U / 2, oBot - U * 0.9); g.lineTo(sx + U - 2, oBot);
            g.strokePath();
          }
          break;
        case 'pad': {
          /* 弹簧(跳板):底座 + 两层朝上的箭形 —— 不用猜它会不会弹你 */
          const col = PAD_COL[o.pad ?? 'yellow'] ?? 0xffe17a;
          g.fillStyle(col, 0.22).fillRect(obx + 1, oBot - U * 0.95, obw - 2, U * 0.95);
          g.fillStyle(col, 0.95).fillRect(obx + 2, oBot - 7, obw - 4, 7);
          g.lineStyle(3, col, 0.95);
          for (let i = 0; i < 2; i++) {
            const yy = oBot - 11 - i * 9;
            g.beginPath();
            g.moveTo(obx + 6, yy); g.lineTo(obx + U / 2, yy - 8); g.lineTo(obx + obw - 6, yy);
            g.strokePath();
          }
          break;
        }
        case 'orb': {
          /* 跳环:外圈 + 内圈 + 中间一个符号(黄=上箭头 / 蓝=翻重力 / 粉=小箭头) */
          const col = ORB_COL[o.orb ?? 'yellow'] ?? 0xffe17a;
          const ccx = obx + U / 2, ccy = Y(o.r * U + U / 2);
          const pulse = 0.5 + 0.5 * Math.sin(tick * 0.08);
          g.fillStyle(col, 0.10 + 0.06 * pulse).fillCircle(ccx, ccy, U * 0.62);
          g.lineStyle(3, col, 0.95).strokeCircle(ccx, ccy, U * 0.44);
          g.lineStyle(1, col, 0.35 + 0.3 * pulse).strokeCircle(ccx, ccy, U * 0.66);
          g.lineStyle(3, col, 0.95);
          if (o.orb === 'blue' || o.orb === 'green') {          // 翻重力:上下双箭头
            g.beginPath();
            g.moveTo(ccx - 6, ccy - 4); g.lineTo(ccx, ccy - 9); g.lineTo(ccx + 6, ccy - 4);
            g.moveTo(ccx - 6, ccy + 4); g.lineTo(ccx, ccy + 9); g.lineTo(ccx + 6, ccy + 4);
            g.strokePath();
          } else {                                              // 跳:上箭头
            const h = o.orb === 'pink' ? 6 : 10;
            g.beginPath();
            g.moveTo(ccx - 7, ccy + h / 2); g.lineTo(ccx, ccy - h); g.lineTo(ccx + 7, ccy + h / 2);
            g.strokePath();
          }
          break;
        }
        case 'pit': {
          /* 坑:地板断口 —— 深色缺口 + 两侧锯齿断崖(以前这里画了个半圆警示灯,完全看不出是坑) */
          const depth = U * 2.4;
          g.fillStyle(0x000000, 0.75).fillRect(obx, oBot - depth + U, obw, depth);
          g.fillStyle(0x05070d, 0.9).fillRect(obx, oBot - depth + U, obw, 6);
          g.lineStyle(2, WARN, 0.8);
          g.beginPath();
          g.moveTo(obx, oBot); g.lineTo(obx, oBot + U * 0.9); g.lineTo(obx + 7, oBot + U * 1.5); g.lineTo(obx, oBot + U * 2.1);
          g.moveTo(obx + obw, oBot); g.lineTo(obx + obw, oBot + U * 0.9); g.lineTo(obx + obw - 7, oBot + U * 1.5); g.lineTo(obx + obw, oBot + U * 2.1);
          g.strokePath();
          break;
        }
        case 'portal': {
          const ccx = obx + U / 2, ccy = Y(o.r * U + U / 2);
          g.lineStyle(3, 0xffe17a, 0.95).strokeCircle(ccx, ccy, U * 0.95);
          g.lineStyle(1, 0xffe17a, 0.45).strokeCircle(ccx, ccy, U * 0.74);
          g.fillStyle(0xffe17a, 0.12).fillCircle(ccx, ccy, U * 0.74);
          /* 环里画目标形态:方块 = 小方,飞机 = 小三角(不用猜这个环切什么) */
          if (o.to === 'ship') {
            g.fillStyle(0xffe17a, 0.95);
            g.fillTriangle(ccx + 7, ccy, ccx - 5, ccy - 6, ccx - 5, ccy + 6);
          } else {
            g.fillStyle(0xffe17a, 0.95).fillRect(ccx - 6, ccy - 6, 12, 12);
          }
          break;
        }
        case 'check':
          g.lineStyle(2, 0xffcc66, 0.9).lineBetween(obx + U * 0.2, oBot, obx + U * 0.2, oTop - U * 0.1);
          g.fillStyle(0xffcc66, 0.9).fillTriangle(obx + U * 0.2, oTop - U * 0.1, obx + U * 1.05, oTop + U * 0.15, obx + U * 0.2, oTop + U * 0.4);
          break;
        case 'speed': {
          const ccy = Y(o.r * U + U / 2);
          g.lineStyle(3, 0x9fd8ff, 0.9);
          g.beginPath();
          g.moveTo(obx + 6, ccy - 8); g.lineTo(obx + 15, ccy); g.lineTo(obx + 6, ccy + 8);
          g.moveTo(obx + 16, ccy - 8); g.lineTo(obx + 25, ccy); g.lineTo(obx + 16, ccy + 8);
          g.strokePath();
          break;
        }
        case 'gravity':
          g.fillStyle(0xc6a0ff, 0.9).fillTriangle(obx, oTop, obx + U / 2, oBot, obx + U, oTop);
          break;
        case 'deco':
          if (o.deco === 'light') g.fillStyle(0xffe9a8, 0.10).fillCircle(obx + obw / 2, Y(o.r * U + U / 2), obw * 1.6);
          break;
      }
    }

    // 玩家:方块 = 描边正方形(空中自转 90°),飞机 = 三角(按 vy 倾斜)
    const py = this.prevY + (w.y - this.prevY) * Math.min(1, this.acc * 60);   // 渲染插值
    const cxw = w.x + P.box / 2, cyw = py + P.box / 2;
    if (w.mode === 'ship') {
      /* 手动画三角:Phaser 4 里没有 Phaser.Geom.Point(v3 的写法会直接抛错) */
      const rot = Math.max(-0.55, Math.min(0.55, w.vy / P.shipVyMax * 0.55));
      const s = Math.sin(rot), c = Math.cos(rot);
      const vx2 = (a: number, b: number) => cxw + a * c - b * s;
      const vy2 = (a: number, b: number) => Y(cyw + a * s + b * c);
      g.fillStyle(w.dead ? 0xff9a6b : 0xe2f6ff, 0.95);
      g.beginPath();
      g.moveTo(vx2(P.box * 0.6, 0), vy2(P.box * 0.6, 0));
      g.lineTo(vx2(-P.box * 0.45, -P.box * 0.3), vy2(-P.box * 0.45, -P.box * 0.3));
      g.lineTo(vx2(-P.box * 0.45, P.box * 0.3), vy2(-P.box * 0.45, P.box * 0.3));
      g.closePath();
      g.fillPath();
    } else if (w.mode === 'ball') {
      /* 球:一个圆 + 里面一条随滚动转的线(不然看不出它在滚) */
      const r = P.box * 0.5;
      g.fillStyle(w.dead ? 0xff9a6b : 0xe2f6ff, 0.96).fillCircle(cxw, Y(cyw), r);
      g.lineStyle(2, HLD, 0.9).strokeCircle(cxw, Y(cyw), r);
      const ang = w.x / U * 1.2;
      g.lineStyle(2, HLD, 0.75).lineBetween(
        cxw - Math.cos(ang) * r * 0.65, Y(cyw) - Math.sin(ang) * r * 0.65,
        cxw + Math.cos(ang) * r * 0.65, Y(cyw) + Math.sin(ang) * r * 0.65,
      );
    } else if (w.mode === 'ufo') {
      /* UFO:一个圆顶 + 一条底盘 */
      const base = Y(cyw - P.box * 0.35);
      g.fillStyle(w.dead ? 0xff9a6b : 0xe2f6ff, 0.95);
      g.beginPath();
      g.moveTo(cxw - P.box * 0.5, base);
      g.lineTo(cxw, Y(cyw + P.box * 0.55));
      g.lineTo(cxw + P.box * 0.5, base);
      g.closePath();
      g.fillPath();
      g.fillStyle(HLD, 0.9).fillRect(cxw - P.box * 0.62, base, P.box * 1.24, 4);
    } else if (w.mode === 'wave') {
      /* 波浪:一枚小飞镖,朝当前运动方向 */
      const dirw = w.vy >= 0 ? 1 : -1;
      g.fillStyle(w.dead ? 0xff9a6b : 0xe2f6ff, 0.95);
      g.beginPath();
      g.moveTo(cxw + 11, Y(cyw + dirw * 11));
      g.lineTo(cxw - 9, Y(cyw - dirw * 9));
      g.lineTo(cxw - 3, Y(cyw + dirw * 3));
      g.closePath();
      g.fillPath();
      g.lineStyle(2, HLD, 0.85);
      g.strokePath();
    } else if (w.mode === 'robot') {
      /* 机器人:比方块高一点 + 一条面罩线 + 两条腿 */
      const hw = P.box * 0.42, hh = P.box * 0.72;
      const rtop = Y(cyw + hh), rbot = Y(cyw - hh);
      g.fillStyle(w.dead ? 0xff9a6b : 0xe2f6ff, 0.96).fillRect(cxw - hw, rtop, hw * 2, rbot - rtop);
      g.lineStyle(2, HLD, 0.9).strokeRect(cxw - hw, rtop, hw * 2, rbot - rtop);
      g.fillStyle(HLD, 0.9).fillRect(cxw - hw + 3, rtop + 4, hw * 2 - 6, 3);
      g.lineStyle(3, HLD, 0.9);
      g.lineBetween(cxw - hw * 0.6, rbot, cxw - hw * 0.6, rbot + 6);
      g.lineBetween(cxw + hw * 0.6, rbot, cxw + hw * 0.6, rbot + 6);
    } else if (w.mode === 'spider') {
      /* 蜘蛛:方块 + 四条短腿 */
      const sw = P.box * 0.42;
      g.fillStyle(w.dead ? 0xff9a6b : 0xe2f6ff, 0.96).fillRect(cxw - sw, Y(cyw + sw), sw * 2, sw * 2);
      g.lineStyle(2, HLD, 0.9).strokeRect(cxw - sw, Y(cyw + sw), sw * 2, sw * 2);
      g.lineStyle(2, HLD, 0.85);
      for (const sx of [-1, 1]) {
        g.lineBetween(cxw + sx * sw, Y(cyw + sw * 0.5), cxw + sx * (sw + 7), Y(cyw + sw * 0.5) - 8);
        g.lineBetween(cxw + sx * sw, Y(cyw - sw * 0.5), cxw + sx * (sw + 7), Y(cyw - sw * 0.5) + 8);
      }
    } else {
      /* 方块在空中转 90°(原版手感):用滞空时间当旋转进度 */
      const spin = Math.min(1, this.airT / (2 * P.jump / (P.gravity * Y_TIME_SCALE) / 60)) * (Math.PI / 2);
      const s = Math.sin(spin), c = Math.cos(spin);
      const pts: Array<[number, number]> = [[-P.box / 2, -P.box / 2], [P.box / 2, -P.box / 2], [P.box / 2, P.box / 2], [-P.box / 2, P.box / 2]];
      g.fillStyle(w.dead ? 0xff9a6b : 0xe2f6ff, 0.96);
      g.beginPath();
      pts.forEach(([a, b], i) => {
        const px2 = cxw + a * c - b * s, py2 = Y(cyw + a * s + b * c);
        if (i === 0) g.moveTo(px2, py2); else g.lineTo(px2, py2);
      });
      g.closePath();
      g.fillPath();
      g.lineStyle(2, w.dead ? 0xff9a6b : HLD, 0.9);
      g.strokePath();
    }
    // 判定内框(自己看得见,方便调手感)
    g.lineStyle(1, 0xffffff, 0.28).strokeRect(w.x + P.innerOff, Y(py + P.innerOff + P.inner), P.inner, P.inner);

    // 终点
    const endX = LEVEL.length * U;
    if (endX > x0 && endX < x1) {
      g.lineStyle(3, HLD, 0.8).lineBetween(endX, groundY, endX, ceilY);
    }
    // 死了就压一层暗红
    if (w.dead) g.fillStyle(0xff6b5a, 0.10).fillRect(x0, dy0, vw, dy1 - dy0);
    /* 开场 / 死亡 / 通关界面:半透明面板(文字是 Text 对象,这里只画底板) */
    if (this.phase !== 'running') {
      const px = Math.max(vw / 2, this.camX), py = ROWS * U / 2;
      g.fillStyle(0x03050a, 0.82).fillRect(px - 470, py - 120, 940, 240);
      g.lineStyle(2, HLD, 0.55).strokeRect(px - 470, py - 120, 940, 240);
      g.lineStyle(1, HLD, 0.25).strokeRect(px - 462, py - 112, 924, 224);
    }

    // 段落水印跟着场地高度放
    for (const t of this.labels) t.setY(Y(7.5 * U));
  }
}

export function boot(target: string | HTMLCanvasElement) {
  const useCanvas = typeof target !== 'string';
  return new Phaser.Game({
    /* 传自己的 canvas 时,Phaser 4 要求显式 renderType(否则报 Must set explicit renderType in custom environment) */
    type: useCanvas ? Phaser.WEBGL : Phaser.AUTO,
    ...(useCanvas ? { canvas: target as HTMLCanvasElement } : { parent: target as string }),
    backgroundColor: '#05070d',
    /* ★ 用 NONE + 固定尺寸:之前用 FIT/RESIZE,Phaser 量出来的父容器宽度不对
       (相机视口被算成 320×720,画面只在左边一条里),干脆不让它去量 ——
       画幅由页面 CSS 决定,内部分辨率固定 1280×720。 */
    scale: {
      mode: Phaser.Scale.NONE,
      width: 1280,
      height: 720,
    },
    scene: [Scene],
    /* ★ 截图要靠它:WebGL 默认不保留绘制缓冲,自动化截图会抓到"半张帧" */
    render: { preserveDrawingBuffer: true },
    audio: { noAudio: true },     // 音乐由页面层的音频模块负责(和站点共用)
  });
}
