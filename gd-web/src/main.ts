/* 渲染层:Phaser 4 只做"画"和"收输入",所有判定都来自 sim/。
 * 风格:本站的 holo / 显示器语言 —— 深底、青色描边、细网格、发光圆环、等宽字。
 *
 * 这一版先不引入任何贴图:全部用 Graphics 画(矩形 + 描边 + 圆环),
 * 好处是"能立刻跑起来验证手感",美术细化放后面单独一轮。
 */

import Phaser from 'phaser';
import { generateLevel, type Level } from './sim/level.ts';
import { World, botThink, type RunState } from './sim/world.ts';
import { fingerprint } from './sim/replay.ts';
import { P, U, ROWS } from './sim/constants.ts';

const HL = '#7ff0ff';
const HLD = 0x7ff0ff;
const WARN = 0xff9a6b;
const LEVEL: Level = generateLevel({ seed: 20260913 });

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
  started = false;                  // 起跑闸门:第一次按键/点击才开跑
  audioErr = '';                    // play() 失败的原因(验收要看)
  botStates: RunState[] = [];
  fp = '';
  botStarted = false;
  started = false;

  /** 第一次交互:开跑 */
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
    this.audio.play().catch((e) => { this.audioErr = String((e && e.message) || e); });   // 失败原因留着,别静默吞
  }

  create() {
    this.g = this.add.graphics();
    this.keys = this.input.keyboard!.addKeys('SPACE,UP,W,R') as Record<string, Phaser.Input.Keyboard.Key>;
    this.cameras.main.setBackgroundColor('#05070d');
    // 让 10 行正好铺满画布高度
    const zoom = this.scale.height / (ROWS * U);
    this.cameras.main.setZoom(zoom);
    const el = document.getElementById('gd-hud');
    if (el) el.addEventListener('click', () => { this.started = true; });
    window.addEventListener('keydown', () => this.startRun(), { once: true });
    window.addEventListener('pointerdown', () => this.startRun(), { once: true });
  }

  update(_t: number, dtMs: number) {
    // 固定步长:每 1/60 秒推进一帧,最多补 5 帧(切标签回来不会瞬移)
    this.expose();
    if (!this.started) { this.draw(); return; }        // 没开跑:画面停在起点,音乐也不响
    this.acc += Math.min(dtMs / 1000, 0.5);
    const step = 1 / 60;
    let n = 0;
    while (this.acc >= step && n < 5) {
      this.acc -= step; n++;
      /* 输入只来自按键 —— 之前把"点过画面"也当成按住,结果玩家一路自动连跳。
         botMode 给验收用:让机器人接管输入,在真实页面里跑完整关。 */
      const hold = this.botMode ? botThink(this.world)
        : !!(this.keys.SPACE?.isDown || this.keys.UP?.isDown || this.keys.W?.isDown);
      if (this.keys.R?.isDown) { this.world.reset(0, 'cube'); }
      if (this.botMode && !this.botStarted) {       // 开机器人 = 从干净的一局开始,方便和 Node 侧对指纹
        this.botStarted = true;
        this.started = true;
        this.world = new World(LEVEL);
        this.botStates = [];
        this.fp = '';
        this.prevY = 0;
      }
      const w0 = this.world;
      if (w0.dead && (this.botMode || w0.deadT >= P.deadPause)) {
        w0.respawn();
        if (this.audio && !this.audio.paused) this.audio.currentTime = 0;   // 重来 = 音乐也回开头
      }   // 机器人模式立刻复活,和 Node 侧一致     // 死后短暂停顿再从存档点重来
      this.prevY = w0.y;
      w0.frame(hold);
      if (this.botMode) {
        this.botStates.push(w0.state);
        if (w0.done && !this.fp) this.fp = fingerprint(this.botStates);
      }
    }
    const w = this.world;
    /* 取景交给相机 API:横向让玩家落在左侧 22% 处,纵向固定居中于场地 */
    const cam = this.cameras.main;
    const vw = cam.width / cam.zoom;
    this.camX = Math.max(vw / 2, w.x + vw * 0.22);
    cam.centerOn(this.camX, ROWS * U / 2);
    this.fps = this.game.loop.actualFps;
    this.draw();
    const hud = document.getElementById('gd-hud');
    if (hud) {
      hud.textContent =
        (w.mode === 'ship' ? '飞机' : '方块') + ' · ' + Math.round(w.progress * 100) + '%' +
        ' · 尝试 ' + String(w.attempts).padStart(2, '0') +
        ' · ' + (w.dead ? '摔了(R 重来)' : '') + ' · ' + Math.round(this.fps) + (this.audio && !this.audio.paused ? ' · ♪ ' + this.audio.currentTime.toFixed(1) + 's' : ' · 按一下开始') + ' fps';
    }
    this.expose();
  }

  /** 对外暴露给验收脚本(每帧刷新,验收随时读到的都是当前状态) */
  expose() {
    (window as unknown as { __gd?: unknown }).__gd = {
      world: this.world, scene: this, level: LEVEL,
      audio: this.audio ? { t: this.audio.currentTime, paused: this.audio.paused, duration: this.audio.duration || 0, err: this.audioErr, src: this.audio.src } : null,
      started: this.started,
    };
  }

  draw() {
    const g = this.g, w = this.world, cam = this.cameras.main;
    /* ★ 真正的病根在【viewport】:create() 时父容器还没量到尺寸,相机的 viewport 被定成
       320×180(恰好四分之一),渲染就被裁在左上角一小块里 —— 只改 setSize 没用,得设 viewport。
       只做一次,且不去读可能有兼容问题的属性(上一版读 cam.viewport.width 直接把页面搞崩了)。 */
    if (!this.fixed) {
      this.fixed = true;
      cam.setViewport(0, 0, 1280, 720);
      cam.setSize(1280, 720);
      cam.setZoom(720 / (ROWS * U));
    }
    /* ★ 两个坑(都是验收截图抓出来的):
       ① 绘制范围必须用【相机自己的尺寸】,用 this.scale.* 会和实际视口对不上,画出来只有一小块;
       ② 世界是 y 向上的,而屏幕 y 向下 —— 把相机 scrollY 设成 -ROWS*U,地面就落在屏幕底部。 */
    const vw = cam.width / cam.zoom, vh = cam.height / cam.zoom;
    const x0 = this.camX - vw / 2, x1 = x0 + vw;
    const y0 = ROWS * U / 2 - vh / 2, y1 = y0 + vh;
    g.clear();

    // 场地网格(每块一条细线)—— 本站的"观察窗"感
    g.lineStyle(1, HLD, 0.06);
    for (let bx = Math.floor(x0 / U); bx <= x1 / U; bx++) g.lineBetween(bx * U, y0, bx * U, y1);
    for (let r = 0; r <= ROWS; r++) g.lineBetween(x0, r * U, x1, r * U);

    // 物件
    for (const o of LEVEL.objects) {
      const bx = o.b * U, by = o.r * U, bw = o.w * U, bh = o.h * U;
      if (bx + bw < x0 || bx > x1) continue;
      switch (o.kind) {
        case 'platform':
          g.fillStyle(HLD, 0.10).fillRect(bx, by, bw, bh);
          g.lineStyle(2, HLD, 0.75).strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
          break;
        case 'block':
          g.fillStyle(HLD, 0.16).fillRect(bx, by, bw, bh);
          g.lineStyle(2, HLD, 0.75).strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
          break;
        case 'spike':
          g.fillStyle(WARN, 0.9);
          for (let k = 0; k < o.w; k++) {
            g.fillTriangle(bx + k * U, by, bx + k * U + U / 2, by + U * 0.88, bx + k * U + U, by);
          }
          break;
        case 'portal':
          g.lineStyle(3, 0xffe17a, 0.95).strokeCircle(bx + U / 2, by + U / 2, U * 0.95);
          g.fillStyle(0xffe17a, 0.14).fillCircle(bx + U / 2, by + U / 2, U * 0.8);
          break;
        case 'check':
          g.lineStyle(2, 0xffcc66, 0.9).lineBetween(bx + U * 0.2, by + U, bx + U * 0.2, by - U * 0.1);
          g.fillStyle(0xffcc66, 0.9).fillTriangle(bx + U * 0.2, by - U * 0.1, bx + U * 1.05, by + U * 0.15, bx + U * 0.2, by + U * 0.4);
          break;
        case 'speed':
          g.lineStyle(2, 0x9fd8ff, 0.9).strokeRect(bx + 2, by + 2, bw - 4, bh - 4);
          break;
        case 'gravity':
          g.fillStyle(0xc6a0ff, 0.9).fillTriangle(bx, by + U * 0.8, bx + U / 2, by, bx + U, by + U * 0.8);
          break;
        case 'deco':
          if (o.deco === 'text') {
            g.lineStyle(1, HLD, 0.25).strokeRect(bx, by, bw, bh);
          } else {
            g.fillStyle(0xffe9a8, 0.10).fillCircle(bx + bw / 2, by + bh / 2, bw * 1.6);
          }
          break;
      }
    }

    // 玩家:方块 = 描边正方形,飞机 = 三角(按 vy 倾斜)
    const py = this.prevY + (w.y - this.prevY) * Math.min(1, this.acc * 60);   // 渲染插值
    const cx = w.x + P.box / 2, cy = py + P.box / 2;
    if (w.mode === 'ship') {
      /* 手动画三角:Phaser 4 里没有 Phaser.Geom.Point(v3 的写法会直接抛错,
         一进飞机形态整个 update 就崩 —— 验收抓到的) */
      const rot = Math.max(-0.55, Math.min(0.55, -w.vy / P.shipVyMax * 0.55));
      const s = Math.sin(rot), c = Math.cos(rot);
      const px = (a: number, b: number) => cx + a * c - b * s;
      const py2 = (a: number, b: number) => cy + a * s + b * c;
      g.fillStyle(w.dead ? 0xff9a6b : 0xe2f6ff, 0.95);
      g.beginPath();
      g.moveTo(px(P.box * 0.6, 0), py2(P.box * 0.6, 0));
      g.lineTo(px(-P.box * 0.45, -P.box * 0.3), py2(-P.box * 0.45, -P.box * 0.3));
      g.lineTo(px(-P.box * 0.45, P.box * 0.3), py2(-P.box * 0.45, P.box * 0.3));
      g.closePath();
      g.fillPath();
    } else {
      g.fillStyle(w.dead ? 0xff9a6b : 0xe2f6ff, 0.96)
        .fillRect(cx - P.box / 2, cy - P.box / 2, P.box, P.box);
      g.lineStyle(2, HLD, 0.9).strokeRect(cx - P.box / 2 + 1, cy - P.box / 2 + 1, P.box - 2, P.box - 2);
    }
    // 判定内框(自己看得见,方便调手感)
    g.lineStyle(1, 0xffffff, 0.35).strokeRect(w.x + P.innerOff, py + P.innerOff, P.inner, P.inner);

    // 终点
    const endX = LEVEL.length * U;
    if (endX > x0 && endX < x1) {
      g.lineStyle(3, HLD, 0.8).lineBetween(endX, 0, endX, ROWS * U);
    }
    // 出屏提示:死了就压一层暗红
    if (w.dead) g.fillStyle(0xff6b5a, 0.10).fillRect(x0, 0, x1 - x0, ROWS * U);
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
    /* ★ 截图要靠它:WebGL 默认不保留绘制缓冲,自动化截图会抓到"半张帧"
       (之前一直以为画面只画了左边四分之一,查了半天尺寸,其实是截图的问题) */
    render: { preserveDrawingBuffer: true },
    audio: { noAudio: true },     // 音乐由页面层的音频模块负责(和站点共用)
  });
}
