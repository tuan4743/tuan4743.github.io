/* 渲染层:Phaser 4 只做"画"和"收输入",所有判定都来自 sim/。
 * 风格:本站的 holo / 显示器语言 —— 深底、青色描边、细网格、发光圆环、等宽字。
 *
 * 这一版修的三件大事(都是用户实测反馈):
 *   ① 【上下翻转】世界坐标 y 向上,而 Phaser 相机 y 向下 —— 所有 y 现在统一过 Y() 转换,
 *      于是"下落"看着是下落、尖刺朝上、地面在底部;
 *   ② 【一屏多高】原版口径是一屏 10 格高(VIEW_H_BLOCKS),纵向靠跟随镜头看;
 *   ③ 【按拍子走】铺面是按 onset 放的,所以画面的时间轴【由音乐驱动】:
 *      每帧读 audio.currentTime,模拟推进到对应的那一帧;复活时把音乐 seek 到存档点的时间。
 */

import Phaser from 'phaser';
import { generateLevel, tOfX, type Level, type Mode } from './sim/level.ts';
import { World, botThink, type RunState } from './sim/world.ts';
import { frameRects } from './sim/gdids.ts';
import { fingerprint } from './sim/replay.ts';
import { P, U, Y_TIME_SCALE } from './sim/constants.ts';
import { WATER_CHART } from './sim/charts/water.ts';

const HL = '#7ff0ff';
/* 每段一个强调色:网格、地面、门的颜色都跟着走,一眼知道跑到第几段 */
const PAL = [0x7ff0ff, 0xffe17a, 0xa0ffd0, 0xc6a0ff, 0xff9fd0];
const HLD = 0x7ff0ff;
const WARN = 0xff9a6b;
/** 视口高度(块)。★ 原版口径:设计分辨率 480×320、1 块 = 30 单位 → 10.67 格;
 *  用户在原版里数到的是 11 格(取整),所以这里按 11 来 —— 一屏至少别比原版少。 */
const VIEW_H_BLOCKS = 11;
/* 相机纵向的原版常量(单位、朝上;出自 OpenGD 的 PlayLayer::updateCamera —— 用户要求照搬):
 *   方块形态:人被困在视野里的一条带子里 —— 下沿(cam + unk3)、上沿(cam + 屏幕高 − unk2),
 *             只有越出这条带子相机才动,一动就把人贴回带子边缘;
 *   跑在【地面】(不是方块)上时:相机回落到地面高度(cam.y = 0 → 视野下边 = −90 单位);
 *   飞行类 / 球:进门那一刻把视口中心钉死(m_fCameraYCenter)。 */
const CAM_LOW = 90;                       // 上沿余量 3 格
const CAM_MID = 120;                      // 下沿余量 4 格
const CAM_GROUND_BOTTOM = -90;            // 站在地面上:视野下边(地面之上 3 格)
const CAM_FLY_BELOW = 180;                // 进门时算"低空"的阈值(6 格)
const CAM_FLY_CENTER = 150;               // 低空进门 → 视口中心固定在 5 格
const CAM_BALL_BELOW = 150;
const CAM_BALL_CENTER = 120;
/** 视口【钉死】的形态(原版:除方块外都固定;用户点名 Wave/UFO 就是这样)。
 *  ★ 机器人 / 蜘蛛:OpenGD 没给它们设中心(沿用上一个值),但用户那关这两段要纵爬 5~16 格,
 *    钉死会把人拍出画外 —— 所以这两种按方块跟随。这两行是我们自己定的,已写进文档。 */
const CAM_FIXED_MODES = new Set(['ship', 'ufo', 'wave', 'ball']);

/** 从页面上挑这一局用哪张铺面:window.__GD_CHART = 'gen' 用老的自动铺面,其它用真实铺面 */
function pickLevel(): Level {
  const want = (window as unknown as { __GD_CHART?: string }).__GD_CHART;
  if (want === 'gen') return generateLevel({ seed: 20260913 });
  return WATER_CHART;                       // 第三张盘:用户自己铺的 WATER
}
const LEVEL: Level = pickLevel();

/* 跳环 / 弹簧的配色(和游戏里的常识一致:黄=跳,粉=小跳,蓝=翻重力,绿=翻重力+跳) */
const ORB_COL: Record<string, number> = {
  yellow: 0xffe17a, pink: 0xff9fd0, red: 0xff8a8a, blue: 0x9fd8ff, green: 0xa0ffd0, black: 0xb9a7ff,
};
const PAD_COL: Record<string, number> = {
  yellow: 0xffe17a, pink: 0xff9fd0, red: 0xff8a8a, blue: 0x9fd8ff, purple: 0xc6a0ff,
};

/** 终末之诗:通关之后向上滚动的文本。
 *  ★ 内容留白给用户填 —— 一行一个字符串,空字符串 = 空行(段落间隔)。
 *    滚动速度按行算,按住空格(或点住画面)会加速。 */
const POEM: string[] = [
  '',
  '(终末之诗 · 内容待填)',
  '',
  '把要放的文字填进 src/main.ts 里的 POEM 数组,',
  '一行一个字符串,空字符串表示空行。',
  '',
];

/** 彩蛋解锁标记(localStorage):CD 页面靠它显示"切换游玩模式"按钮 */
const EASTER_KEY = 'tuagfey-gd-easter';
const POEM_SPEED = 26;      // 滚动速度(世界单位/秒,约每秒 0.7 行)
const POEM_LINE_H = 36;     // 一行占多高(用来判断滚完了没有)

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
type Phase = 'idle' | 'running' | 'dead' | 'done' | 'poem';

class Scene extends Phaser.Scene {
  world = new World(LEVEL);
  g!: Phaser.GameObjects.Graphics;
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  acc = 0;
  prevY = 0;
  fps = 0;
  fixed = false;
  camX = 0;
  camY = 0;                        // (旧字段,留作兼容)
  camInit = false;                 // 第一帧直接贴到玩家身上(不然开场会从 0 滑过去)
  camWorldY = 0;                   // 本帧实际用的镜头中心(绘图空间,夹取之后)
  camBottom = 0;                   // 视野【下边】的世界 y(单位)—— 原版相机算的就是这个
  camCenter = 0;                   // 视口中心的世界 y:飞行类进门那一刻钉死(m_fCameraYCenter)
  camMode: Mode = 'cube';          // 上一帧的形态:用来抓"刚进门"那一刻
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
  /** 调试/出图用:冻住模拟(只渲染,不推进) —— 自动化截图不会因为"瞬移到墙里"当场摔死 */
  dbgPause = false;
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
  poemText!: Phaser.GameObjects.Text;
  poemT = 0;                       // 终末之诗滚了多久(秒)
  egg = false;                     // 彩蛋窗口是否已弹出

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
    this.camInit = false;
    /* ★ 每局开始时再读一次页面指定的歌:换盘之后开跑就会用新歌 */
    const forced = (window as unknown as { __GD_SONG?: string }).__GD_SONG;
    if (forced && forced !== LEVEL.song) { LEVEL.song = forced; if (this.audio) this.audio.src = forced; }
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

  /** 彩蛋解锁:写进 localStorage,CD 页面据此显示「切换游玩模式」按钮 */
  private unlockEaster() {
    try { localStorage.setItem(EASTER_KEY, '1'); } catch { /* 无痕模式就算了 */ }
  }

  /** 从存档点重来(死亡界面按确认) */
  retry() {
    const w = this.world;
    w.respawn();
    this.baseTick = Math.floor(tOfX(LEVEL, w.checkX) * 60);
    this.airT = 0;
    this.acc = 0;
    this.deathT = 0;
    this.prevY = w.y;
    this.camInit = false;                 // 复活:镜头立刻贴到存档点(不然要从死亡点滑过来)
    this.phase = 'running';
    this.playMusicAt(tOfX(LEVEL, w.checkX));
  }

  /** 从头来(R 键,死亡界面与通关界面都能用) */
  restartFromZero() {
    this.world.resetToStart();          // ★ 回到铺面的出生点(Level.start),不是硬编码的 (0,0)
    this.baseTick = 0;
    this.airT = 0;
    this.acc = 0;
    this.deathT = 0;
    this.prevY = 0;
    this.camInit = false;
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
    this.poemText = this.add.text(0, 0, POEM.join('\n'), { ...ui, fontSize: '26px', color: '#e2f6ff', lineSpacing: 10 }).setOrigin(0.5, 0).setDepth(19).setVisible(false);
    /* 功能块(text 物件)做成场上的文字(旧版那种段落旁白水印已删) */
    for (const o of LEVEL.objects) {
      if (o.kind !== 'text' || !o.text) continue;
      const t = this.add.text(o.b * U, 0, o.text, {
        fontFamily: 'ui-monospace, Consolas, monospace',
        fontSize: Math.round(30 * (o.size ?? 1)) + 'px', color: '#e2f6ff',
      });
      t.setOrigin(0.5, 0.5).setAlpha(0.95);
      t.setData('isText', true);
      t.setY(LEVEL.rows * U - (o.r + 0.5) * U);          // 功能块自己定在它那一格
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

  /** 可见高度 = VIEW_H_BLOCKS 块 **在真正的窗口里**(不是整块画布)。
   *  ★ 用户实测:"可见 11 格,窗口只露 6.8 格" —— 画布比外框的透明窗口高,多出来的部分被
   *    金属边框挡住。上一版我的做法是"把缩放调小、让窗口里凑够 11 格",结果相机是按整块画布
   *    定位的,人直接被挤到窗口外面去了("cube 底下不再显示")。
   *    正确做法:**把相机的取景框(viewport)直接设成露出来的那一条**,再让那一条里正好 11 格
   *    —— 相机逻辑、人物位置、判定全都跟着这条走,窗口外画什么都不影响。 */
  viewFrac = 1;
  /** 露出来的那一条在画布里的位置(buffer 像素) */
  viewTop = 0;
  viewH = 720;
  private fracT = 0;

  private measureFrac() {
    const cv = document.getElementById('gd-canvas') as HTMLCanvasElement | null;
    const r = cv?.getBoundingClientRect();
    const host = cv?.parentElement?.getBoundingClientRect();
    if (!cv || !r || !host || r.height <= 0 || r.width <= 0) { this.viewFrac = 1; this.viewTop = 0; this.viewH = 720; return; }
    this.viewFrac = 1;
    this.viewTop = 0;
    this.viewH = 720;                 // ★ 回到固定 16:9 缓冲:上一版按盒子长宽比算,
                                      //   结果块变得比原版大一圈(用户:"cube 怎么这么大")
  }

  /** 可见宽度 = 由 VIEW_H_BLOCKS 与画幅比例决定;取景框只覆盖"露出来的那一条" */
  zoomOf() {
    return this.viewH / (VIEW_H_BLOCKS * U);
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
        if (!this.botMode) { this.phase = 'poem'; this.poemT = 0; this.egg = false; this.pauseMusic(); }
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
        this.world.y = Math.max(0, Math.min(this.world.y, LEVEL.rows * U - P.box));
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
    if (this.phase === 'poem') {
      /* 终末之诗:向上滚,按住空格(或点住画面)加速到 3 倍 */
      const fast = !!(this.keys.SPACE?.isDown || this.keys.UP?.isDown || this.keys.W?.isDown);
      this.poemT += (dtMs / 1000) * (fast ? 3 : 1);
      const camVH = this.cameras.main.height / this.cameras.main.zoom;
      const total = POEM.length * POEM_LINE_H + camVH;      // 从屏幕下方一直滚到完全出去
      if (!this.egg && this.poemT * POEM_SPEED > total) { this.egg = true; this.unlockEaster(); }
      if (this.egg && confirm) { this.phase = 'idle'; this.egg = false; this.poemT = 0; }
      this.followCamera(); this.draw(); this.paintUi(); return;
    }
    if (this.phase === 'done') {
      this.deathT += dtMs / 1000;
      if (restart || (this.deathT > 0.5 && confirm)) this.restartFromZero();
      this.followCamera(); this.draw(); this.paintUi(); return;
    }

    if (this.botMode) {
      this.pump(8);                                    // 机器人验收:加速跑完(物理仍是定点步长)
    } else if (this.dbgPause) {
      /* 冻住:只画不推(出图/调试用) */
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
    /* ★ 可见格数 + 取景框被外框挡掉的比例:和原版对不上时,一眼看出是缩放还是裁切问题 */
    const cam = this.cameras.main;
    const vhBlocks = (cam.height / cam.zoom) / U;
    parts.push('可见 ' + vhBlocks.toFixed(1) + ' 格');
    /* ★ 黑边自查:把"游戏盒子"和"外框图"两个矩形直接打在 HUD 上 ——
       不用 DevTools,一眼看出盒子矮了多少/被顶上去了多少(黑边 = 盒子比外框窗口矮)。 */
    const lostEl = document.querySelector('.lost');
    const frEl = document.querySelector('.screen-frame');
    if (lostEl && frEl) {
      const a = lostEl.getBoundingClientRect(), f = frEl.getBoundingClientRect();
      parts.push('盒 ' + Math.round(a.width) + '×' + Math.round(a.height) + '@' + Math.round(a.top) + ' 框 ' + Math.round(f.width) + '×' + Math.round(f.height) + '@' + Math.round(f.top));
    }
    if (this.viewFrac < 0.995) parts.push('画布被挡 ' + Math.round((1 - this.viewFrac) * 100) + '%');
    parts.push(Math.round(this.fps) + ' fps');
    parts.push(this.audio && !this.audio.paused ? '♪ ' + this.audio.currentTime.toFixed(1) + 's' : '暂停');
    hud.textContent = parts.filter(Boolean).join(' · ');
    hud.classList.toggle('is-dead', this.phase === 'dead');
  }

  /** 取景:照搬原版(OpenGD PlayLayer::updateCamera)——
   *  ★ 横向:相机左边缘 = 玩家 x − 屏宽/2.5(即人站在屏幕左侧 40% 处);
   *  ★ 方块形态:人被困在视野里的一条带子 [下边+120, 下边+屏高−90] 单位里,
   *    越出下沿 → 下边 = 人 − 120;越出上沿 → 下边 = 人 − 屏高 + 90;跑在地面上 → 回落到 −90;
   *  ★ 飞行类 / 球:进门那一刻把视口中心钉死(原版 m_fCameraYCenter),这就是"视口被固定";
   *  ★ 最后夹在 [−90, 关卡高 − 屏高] 里,不会拍到关卡外面。
   *  坐标:世界 y 朝上,Phaser 相机 y 是【绘图空间】(朝下、0 在关卡顶),最后换算一次。 */
  private followCamera() {
    const cam = this.cameras.main;
    const vw = cam.width / cam.zoom;
    const vh = cam.height / cam.zoom;
    const rowsU = LEVEL.rows * U;
    const w = this.world;

    /* ---- 横向 ---- */
    const left = Math.max(0, w.x - vw * 0.4);
    this.camX = left + vw / 2;

    /* ---- 形态切换:记下"进门时的视口中心"(原版 m_fCameraYCenter) ---- */
    if (w.mode !== this.camMode) {
      if (CAM_FIXED_MODES.has(w.mode)) {
        const portalY = w.portalY;                       // 门的位置(世界 y)
        if (w.mode === 'ball') {
          this.camCenter = portalY < CAM_BALL_BELOW ? CAM_BALL_CENTER
            : Math.floor((portalY + CAM_LOW) / U) * U - CAM_LOW;
        } else {
          this.camCenter = portalY < CAM_FLY_BELOW ? CAM_FLY_CENTER
            : Math.floor((portalY + CAM_LOW) / U) * U - CAM_LOW;
        }
      }
      this.camMode = w.mode;
    }

    /* ---- 纵向:视野下边(世界 y、单位) ---- */
    const py = w.y + (P.box * w.sizeMul) / 2;            // 人中心
    let bottom: number;
    if (CAM_FIXED_MODES.has(w.mode)) {
      bottom = this.camCenter - vh / 2;                  // 钉死:视口中心 = 进门时的高度
    } else {
      const flip = w.gdir < 0;
      const unk2 = flip ? CAM_MID : CAM_LOW;             // 上沿余量
      const unk3 = flip ? CAM_LOW : CAM_MID;             // 下沿余量
      let c = this.camBottom;
      if (py <= vh + c - unk2) {
        if (py < unk3 + c) c = py - unk3;                // 掉出下沿 → 贴回下沿
      } else {
        c = py - vh + unk2;                              // 冲出上沿 → 贴回上沿
      }
      /* 跑在【地面】上(不是站在方块上):相机回落到地面高度(原版 cam.y = 0) */
      if (!flip && w.onGround && w.y <= 0.001) c = CAM_GROUND_BOTTOM;
      bottom = c;
    }
    if (!this.camInit) { this.camBottom = bottom; this.camCenter = bottom + vh / 2; this.camInit = true; }
    const lo = Math.min(CAM_GROUND_BOTTOM, rowsU - vh);
    const hi = Math.max(lo, rowsU - vh);
    bottom = Math.max(lo, Math.min(hi, bottom));
    this.camBottom = bottom;
    this.camCenter = bottom + vh / 2;
    this.camWorldY = rowsU - this.camCenter;             // 换算成 Phaser 相机的绘图空间 y
    cam.centerOn(this.camX, this.camWorldY);
  }

  /** 三个界面(开场 / 死亡 / 通关)+ 终末之诗 + 彩蛋窗口:位置跟着相机取景走 */
  private paintUi() {
    const cam = this.cameras.main;
    const vw = cam.width / cam.zoom;
    const vh = cam.height / cam.zoom;
    const ux = Math.max(vw / 2, this.camX);
    /* ★ 界面文字跟着【镜头】走:铺面高 125 格,再用"场地中心"就会把面板画到画外去 */
    const uy = this.camWorldY;
    const w = this.world;
    /* 终末之诗:单独一条长文本,从取景下方向上滚 */
    const inPoem = this.phase === 'poem';
    this.poemText.setVisible(inPoem);
    if (inPoem) {
      this.uiTitle.setVisible(this.egg);
      this.uiHint.setVisible(this.egg);
      const poemLines = POEM.length * POEM_LINE_H;
      this.poemText.setPosition(ux, uy + vh / 2 + poemLines - this.poemT * POEM_SPEED);
      if (this.egg) {
        this.uiTitle.setText('彩蛋已解锁');
        this.uiHint.setText('可前往 CD 页面查看(左下角会多出一个按钮)\n按空格 / 点一下 回到开头');
        this.uiTitle.setPosition(ux, uy - 26);
        this.uiHint.setPosition(ux, uy + 34);
      }
      return;
    }
    const show = this.phase !== 'running';
    this.uiTitle.setVisible(show);
    this.uiHint.setVisible(show);
    if (!show) return;
    if (this.phase === 'idle') {
      this.uiTitle.setText('第三张盘 · 迷茫');
      this.uiHint.setText('按 空格 开始(也可以点一下画面)\n按住 = 连跳 · 弹簧碰到就弹、不用按 · 跳环要按一下 · R = 重来');
    } else if (this.phase === 'dead') {
      this.uiTitle.setText('摔了 · ' + Math.round(w.progress * 100) + '%');
      const at = LEVEL.length > 0 ? Math.round(w.checkX / U / LEVEL.length * 100) : 0;
      this.uiHint.setText('空格 / 点一下 = 从上一处存档点(' + at + '% 处)重来 · R = 从头开始');
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

  /** 把相机的取景框设成"画布里真正露出来的那一条"(被外框挡住的部分干脆不渲染)。
   *  ★ 另外把画布的 CSS 尺寸按回 100%×100%:Phaser 的 ScaleManager(mode: NONE)会把
   *    canvas 的行内样式写成 1280px×720px —— 于是画布固定 720 px 高,而外框窗口只有
   *    ~525 px,多出来的 38% 就被金属边框挡住(用户截图:HUD 写着"画布被挡 38%",
   *    底下还露出一条黑条,关卡底部的刺全被裁掉)。这一句才是真正的病根。 */
  private applyViewport(cam: Phaser.Cameras.Scene2D.Camera) {
    /* ★ 先让缓冲跟着盒子的长宽比走,再把画布的 CSS 尺寸按回 100%×100% ——
       顺序不能反:Phaser 的 ScaleManager 会在 resize 时把 canvas 的行内样式又写成
       "1280px/xxx px",那正是底部那条黑条(画布固定高、装不下窗口)的来源。 */
    if (this.scale.height !== this.viewH || this.scale.width !== 1280) this.scale.resize(1280, this.viewH);
    const cv = document.getElementById('gd-canvas') as HTMLCanvasElement | null;
    if (cv) {
      cv.style.width = '100%';
      cv.style.height = '100%';
    }
    cam.setViewport(0, 0, 1280, this.viewH);
    cam.setSize(1280, this.viewH);
    cam.setZoom(this.zoomOf());
  }

  draw() {
    const g = this.g, w = this.world, cam = this.cameras.main;
    /* ★ 真正的病根在【viewport】:create() 时父容器还没量到尺寸,相机的 viewport 被定成
       320×180(恰好四分之一),渲染就被裁在左上角一小块里 —— 只改 setSize 没用,得设 viewport。 */
    if (!this.fixed) {
      this.fixed = true;
      this.measureFrac();
      this.applyViewport(cam);
      window.addEventListener('resize', () => { this.measureFrac(); this.applyViewport(cam); });
    }
    /* 每 20 帧(或刚开局)重新量一次:露出来的那一条变了就跟着改取景框 */
    if (this.fixed && (this.fracT++ % 20 === 0)) {
      const before = [this.viewTop, this.viewH];
      this.measureFrac();
      if (before[0] !== this.viewTop || before[1] !== this.viewH) this.applyViewport(cam);
    }
    const bx = w.x / U;
    const seg = LEVEL.segments.find((sg) => bx >= sg.from && bx < sg.to) || LEVEL.segments[0];
    /* color 触发器可以整体换色(它压过段落配色) */
    const tint = w.tint != null ? w.tint : PAL[LEVEL.segments.indexOf(seg) % PAL.length];
    const vw = cam.width / cam.zoom, vh = cam.height / cam.zoom;
    const x0 = this.camX - vw / 2, x1 = x0 + vw;
    const rowsU = LEVEL.rows * U;
    /* ★ 绘图空间:y 向下,世界 y=0(地面)画在 rowsU 处 —— 世界坐标过来一律走它,整幅画就不会倒。
       视口上下边由【纵向跟随镜头】给出:camWorldY ± 半屏。 */
    const Y = (wy: number) => rowsU - wy;
    const dy0 = this.camWorldY - vh / 2, dy1 = dy0 + vh;
    const lowY = rowsU - dy1, highY = rowsU - dy0;      // 可见的世界 y 范围(单位)
    const groundY = Y(0), ceilY = Y(rowsU);
    const tick = this.world.tick;
    g.clear();

    /* 场地之外压暗(地面以下 / 关卡顶以上;铺面高的时候这两块基本都在画外) */
    g.fillStyle(0x03050a, 0.72);
    g.fillRect(x0, dy0, vw, Math.max(0, groundY + U - dy0));
    g.fillRect(x0, ceilY - U, vw, Math.max(0, dy1 - (ceilY - U)));

    // 场地网格(每块一条细线;只画看得见的那几行)
    g.lineStyle(1, tint, 0.09);
    for (let gx = Math.floor(x0 / U); gx <= x1 / U; gx++) g.lineBetween(gx * U, dy0, gx * U, dy1);
    const r0 = Math.max(0, Math.floor(lowY / U)), r1 = Math.min(LEVEL.rows, Math.ceil(highY / U));
    for (let r = r0; r <= r1; r++) g.lineBetween(x0, Y(r * U), x1, Y(r * U));
    // 地面线与天花板线(跑道的上下边)
    g.lineStyle(2, tint, 0.6).lineBetween(x0, groundY, x1, groundY);
    g.lineStyle(1, tint, 0.42).lineBetween(x0, ceilY, x1, ceilY);
    /* 地面以下:几条越来越淡的横线,做出"地下"的厚度感 */
    g.lineStyle(1, tint, 0.18);
    for (let k = 1; k <= 4; k++) g.lineBetween(x0, groundY + k * 22, x1, groundY + k * 22);

    /* 物件:两遍 —— 先装饰(deco 是背景贴片,不该盖在方块上),再玩法物件 */
    for (let pass = 0; pass < 2; pass++) {
    for (const o of LEVEL.objects) {
      if ((o.kind === 'deco') !== (pass === 0)) continue;
      /* ★ 会动的东西(触发器推的)按运行时偏移画;判定盒在 sim 里已经同步过了 */
      const off = w.offsetOf(o);
      const obx = (o.b + off.dx) * U, obw = o.w * U, obh = o.h * U;
      const oTop = Y((o.r + o.h + off.dy) * U);   // 格子上边(绘图空间)
      const oBot = Y((o.r + off.dy) * U);         // 格子下边
      if (obx + obw < x0 || obx > x1) continue;
      if ((o.r + o.h + off.dy) * U < lowY || (o.r + off.dy) * U > highY) continue;
      if (o.kind === 'trigger') continue;         // 触发器是个逻辑物件,不画
      switch (o.kind) {
        case 'platform':
          if (o.r < 0) {
            /* 地面:厚条 + 顶部亮线 + 斜纹。★ 填得实一点(0.72)—— 原版地面是【不透明】的,
               y<0 的东西(比如这关里放在 y=−0.1 的那个 67)是被地面挡住的、玩家看不见;
               我们以前用 0.13 的淡填,底下那一排"蓝色跳点"就透出来了。 */
            g.fillStyle(0x0a0f18, 0.92).fillRect(obx, oTop, obw, obh);
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
        case 'spike': {
          /* 尖刺:底边在格子下沿、尖朝上;高度按 o.h 缩放(小刺 0.5 / 大刺 1.5)。
             ★ 方向只有一条规则:先画"朝上"的基础形状,再套【旋转】(屏幕上顺时针)。
               —— 之前写成"rot180 先镜像、又转 180°",等于翻了两次,倒挂的刺画成了正的
               (用户一眼就看出"刺的方向还没修")。flipY 才是真正的镜像,单独乘一次。
               判定那侧是同一条口径:rot 180 / flipY → 判定盒挂在格子【顶面】。 */
          const rot = (((o.rot ?? 0) % 360) + 360) % 360;
          const side = rot === 90 || rot === 270;      // 横着的刺:整格只画一个
          const mirror = o.flipY ? -1 : 1;             // flipY = 上下镜像(不转的时候用)
          const theta = (rot * Math.PI) / 180;
          const cs = Math.cos(theta), sn = Math.sin(theta);
          const n = side ? 1 : Math.max(1, Math.round(o.w));
          for (let k = 0; k < n; k++) {
            const ccx = side ? obx + obw / 2 : obx + (k + 0.5) * U;
            const ccy = oBot - obh / 2;                // 格子中心(绘图空间)
            const hw = U * 0.47;                       // 基础形状:一格宽
            const hh = (U * 0.9 * o.h) / 2;            // 高 = 0.9 × 刺高
            const yb = hh * mirror, yt = -hh * mirror; // 底边 / 尖端
            const P = (lx: number, ly: number): [number, number] =>
              [ccx + lx * cs - ly * sn, ccy + lx * sn + ly * cs];
            const p1 = P(-hw, yb), p2 = P(0, yt), p3 = P(hw, yb);
            g.fillStyle(0x2a1408, 0.95).fillTriangle(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
            g.lineStyle(2, WARN, 0.95);
            g.beginPath();
            g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.lineTo(p3[0], p3[1]);
            g.strokePath();
          }
          break;
        }
        case 'saw': {
          /* 锯片:一个带齿的圆锯,按时间转(纯视觉,判定是整格) */
          const scx = obx + obw / 2, scy = oBot - obh / 2;
          const r = Math.min(obw, obh) * 0.42;
          const spin = tick * 0.12;
          g.fillStyle(0x2a1408, 0.9).fillCircle(scx, scy, r);
          g.lineStyle(2, WARN, 0.95).strokeCircle(scx, scy, r);
          for (let k = 0; k < 8; k++) {
            const a = spin + k * Math.PI / 4;
            g.fillStyle(WARN, 0.9).fillTriangle(
              scx + Math.cos(a) * r, scy + Math.sin(a) * r,
              scx + Math.cos(a + 0.28) * r * 1.35, scy + Math.sin(a + 0.28) * r * 1.35,
              scx + Math.cos(a - 0.28) * r * 1.35, scy + Math.sin(a - 0.28) * r * 1.35,
            );
          }
          g.fillStyle(0x05070d, 1).fillCircle(scx, scy, r * 0.3);
          break;
        }
        case 'pad': {
          /* 弹簧(跳板):★ 画成【薄薄一块贴在底边】—— 原版跳点视觉上只有小半格高。
             以前我画的是"0.95 格高的底座 + 两道大箭头",看着像一块大板子,
             而且箭头还往上戳出物件盒 —— 用户把地面线上那块(67 放在 y=−0.1、被地面挡住的)
             当成了"多出来的蓝色跳点"。 */
          const col = PAD_COL[o.pad ?? 'yellow'] ?? 0xffe17a;
          const th = Math.max(6, obh);                       // 贴图厚度 = 物件盒(0.2 格 = 6 单位)
          g.fillStyle(col, 0.85).fillRect(obx + 1, oBot - th, obw - 2, th);
          g.lineStyle(1, col, 0.9).strokeRect(obx + 1.5, oBot - th + 0.5, obw - 3, th - 1);
          /* 一道朝上的箭头(倒挂的朝下),压在底座上,不出物件盒 */
          const up = ((o.rot ?? 0) % 360 + 360) % 360 !== 180;
          g.lineStyle(2, col, 0.95);
          g.beginPath();
          const cy0 = oBot - th / 2;
          if (up) { g.moveTo(obx + 5, cy0 + 2); g.lineTo(obx + obw / 2, cy0 - 3); g.lineTo(obx + obw - 5, cy0 + 2); }
          else { g.moveTo(obx + 5, cy0 - 2); g.lineTo(obx + obw / 2, cy0 + 3); g.lineTo(obx + obw - 5, cy0 - 2); }
          g.strokePath();
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
          } else if (o.orb === 'black') {                       // 冲刺:向下的双箭头(它把人往下"砸")
            g.beginPath();
            g.moveTo(ccx - 7, ccy - 6); g.lineTo(ccx, ccy + 1); g.lineTo(ccx + 7, ccy - 6);
            g.moveTo(ccx - 7, ccy + 1); g.lineTo(ccx, ccy + 8); g.lineTo(ccx + 7, ccy + 1);
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
        case 'gravity': {
          /* 重力门:向下 = 常重力(实心三角朝下),向上 = 反重力(空心三角朝上) */
          const up = (o.gdir ?? 1) < 0;
          const gcx = obx + U / 2, gcy = Y((o.r + o.h / 2) * U);
          g.lineStyle(3, 0xc6a0ff, 0.95);
          g.beginPath();
          if (up) { g.moveTo(gcx - 9, gcy + 6); g.lineTo(gcx, gcy - 7); g.lineTo(gcx + 9, gcy + 6); }
          else { g.moveTo(gcx - 9, gcy - 6); g.lineTo(gcx, gcy + 7); g.lineTo(gcx + 9, gcy - 6); }
          g.strokePath();
          g.fillStyle(0xc6a0ff, 0.18).fillCircle(gcx, gcy, U * 0.5);
          break;
        }
        case 'size': {
          /* 尺寸门:迷你 = 小方框里一个小人,恢复 = 大方框 */
          const mini = o.mini !== false;
          const scx2 = obx + U / 2, scy2 = Y((o.r + o.h / 2) * U);
          g.lineStyle(2, mini ? 0xff9fd0 : 0xa0ffd0, 0.9).strokeCircle(scx2, scy2, U * 0.45);
          g.fillStyle(mini ? 0xff9fd0 : 0xa0ffd0, 0.9)
            .fillRect(scx2 - (mini ? 4 : 8), scy2 - (mini ? 4 : 8), mini ? 8 : 16, mini ? 8 : 16);
          break;
        }
        case 'frame': {
          /* 线框:判定就是这几根细杆(见 sim/gdids.ts 的 frameRects)—— 画的和判定的是同一份几何 */
          g.lineStyle(2, tint, 0.9);
          for (const r of frameRects({ ...o, b: o.b + off.dx, r: o.r + off.dy })) {
            g.strokeRect(r.x0, Y(r.y1), r.x1 - r.x0, r.y1 - r.y0);
          }
          break;
        }
        case 'breakable': {
          /* 可破坏砖块:橙色的裂纹砖 —— 撞上去会碎(碎了就不画了) */
          if (w.isBroken(o)) break;
          g.fillStyle(0xffb066, 0.16).fillRect(obx, oTop, obw, obh);
          g.lineStyle(2, 0xffb066, 0.9).strokeRect(obx + 1, oTop + 1, obw - 2, obh - 2);
          g.lineStyle(1, 0xffb066, 0.7);
          g.lineBetween(obx + 3, oTop + obh - 3, obx + obw - 3, oTop + 3);
          g.lineBetween(obx + obw * 0.3, oTop + 2, obx + obw * 0.55, oTop + obh * 0.55);
          break;
        }
        case 'coin': {
          /* 硬币:金色圆片(收过了就不画) */
          if (w.isCoinTaken(o)) break;
          const ccx3 = obx + obw / 2, ccy3 = Y((o.r + o.h / 2) * U);
          const wob = Math.abs(Math.cos(tick * 0.05));
          g.fillStyle(0xffd76a, 0.9).fillRect(ccx3 - obw * 0.3 * wob, ccy3 - obh * 0.3, obw * 0.6 * wob, obh * 0.6);
          g.lineStyle(2, 0xffe9a8, 0.95).strokeRect(ccx3 - obw * 0.3 * wob, ccy3 - obh * 0.3, obw * 0.6 * wob, obh * 0.6);
          break;
        }
        case 'arrow': {
          /* 冲刺箭头(绿/粉)/ 紫色上跳箭头:一个环 + 一支按旋转角指的箭头 */
          const acx = obx + obw / 2, acy = Y((o.r + o.h / 2) * U);
          const acol = o.tp ? 0xc6a0ff : (o.arrow === 'pink' ? 0xff9fd0 : 0xa0ffd0);
          g.fillStyle(acol, 0.12).fillCircle(acx, acy, U * 0.55);
          g.lineStyle(3, acol, 0.95).strokeCircle(acx, acy, U * 0.42);
          /* rot 0 = 朝上,顺时针(和线框的旋转口径一致) */
          const a = -((o.rot ?? 0) * Math.PI) / 180 + Math.PI / 2;
          const L = U * 0.5;
          g.lineStyle(3, acol, 0.95);
          g.beginPath();
          g.moveTo(acx - Math.sin(a) * 0 - Math.cos(a) * L * 0.6, acy + Math.sin(a) * L * 0.6);
          g.lineTo(acx + Math.cos(a) * L * 0.6, acy - Math.sin(a) * L * 0.6);
          g.moveTo(acx + Math.cos(a) * L * 0.6, acy - Math.sin(a) * L * 0.6);
          g.lineTo(acx + Math.cos(a + 2.5) * L * 0.5, acy - Math.sin(a + 2.5) * L * 0.5);
          g.moveTo(acx + Math.cos(a) * L * 0.6, acy - Math.sin(a) * L * 0.6);
          g.lineTo(acx + Math.cos(a - 2.5) * L * 0.5, acy - Math.sin(a - 2.5) * L * 0.5);
          g.strokePath();
          break;
        }
        case 'clone': {
          /* 克隆门:只标记、不生效 —— 画成灰色虚线环,一眼知道"这里我们没做" */
          const kcx = obx + obw / 2, kcy = Y((o.r + o.h / 2) * U);
          g.lineStyle(2, 0x8b93a7, 0.75).strokeCircle(kcx, kcy, U * 0.5);
          g.lineStyle(2, 0x8b93a7, 0.45).strokeCircle(kcx, kcy, U * 0.34);
          break;
        }
        case 'teleport': {
          /* 传送门:蓝 = 入口(747),橙 = 出口(748) —— 原版就是"蓝进橙出" */
          const tcx = obx + U / 2, tcy = Y(o.r * U + U / 2);
          const tcol = o.exit ? 0xffa04d : 0x6fc8ff;
          const spinT = tick * 0.06;
          g.lineStyle(3, tcol, 0.95).strokeCircle(tcx, tcy, U * 0.95);
          g.fillStyle(tcol, 0.12).fillCircle(tcx, tcy, U * 0.95);
          g.lineStyle(2, tcol, 0.8);
          for (let k = 0; k < 3; k++) {
            const a0 = spinT + k * (Math.PI * 2 / 3);
            g.beginPath();
            g.arc(tcx, tcy, U * 0.35 + k * 6, a0, a0 + 1.6, false);
            g.strokePath();
          }
          g.fillStyle(tcol, 0.95).fillCircle(tcx, tcy, 4);
          break;
        }
        case 'force': {
          /* 力场:半透明带 + 一排箭头(往上推就是朝上的箭头) */
          const up = (o.fy ?? 0) >= 0;
          g.fillStyle(up ? 0xa0ffd0 : 0xff9fd0, 0.10).fillRect(obx, oTop, obw, oBot - oTop);
          g.lineStyle(1, up ? 0xa0ffd0 : 0xff9fd0, 0.45).strokeRect(obx + 1, oTop + 1, obw - 2, oBot - oTop - 2);
          g.lineStyle(2, up ? 0xa0ffd0 : 0xff9fd0, 0.7);
          const step = 26, drift = (tick * 1.6) % step;
          for (let yy = oBot - step + drift; yy > oTop; yy -= step) {
            g.beginPath();
            if (up) { g.moveTo(obx + obw / 2 - 7, yy + 7); g.lineTo(obx + obw / 2, yy - 3); g.lineTo(obx + obw / 2 + 7, yy + 7); }
            else { g.moveTo(obx + obw / 2 - 7, yy - 3); g.lineTo(obx + obw / 2, yy + 7); g.lineTo(obx + obw / 2 + 7, yy - 3); }
            g.strokePath();
          }
          break;
        }
        case 'deco':
          /* 装饰:只画不判定。3638 是背景黑块(用户拿它做"画面逐渐清晰"的遮罩),
             其余几个是指示用的小图形(感叹号 / 箭头 / 笑脸 / 叉 / 点赞 / 锁链)。 */
          this.drawDeco(g, o, obx, obw, oBot, Y, tick);
          break;
      }
    }
    }

    // 玩家:方块 = 描边正方形(空中自转 90°),飞机 = 三角(按 vy 倾斜)
    const B = P.box * w.sizeMul;   // ★ 迷你门:人也要画小
    const py = this.prevY + (w.y - this.prevY) * Math.min(1, this.acc * 60);   // 渲染插值
    const cxw = w.x + B / 2, cyw = py + B / 2;
    if (w.mode === 'ship') {
      /* 手动画三角:Phaser 4 里没有 Phaser.Geom.Point(v3 的写法会直接抛错) */
      const rot = Math.max(-0.55, Math.min(0.55, w.vy / P.shipVyMax * 0.55));
      const s = Math.sin(rot), c = Math.cos(rot);
      const vx2 = (a: number, b: number) => cxw + a * c - b * s;
      const vy2 = (a: number, b: number) => Y(cyw + a * s + b * c);
      g.fillStyle(w.dead ? 0xff9a6b : 0xe2f6ff, 0.95);
      g.beginPath();
      g.moveTo(vx2(B * 0.6, 0), vy2(B * 0.6, 0));
      g.lineTo(vx2(-B * 0.45, -B * 0.3), vy2(-B * 0.45, -B * 0.3));
      g.lineTo(vx2(-B * 0.45, B * 0.3), vy2(-B * 0.45, B * 0.3));
      g.closePath();
      g.fillPath();
    } else if (w.mode === 'ball') {
      /* 球:一个圆 + 里面一条随滚动转的线(不然看不出它在滚) */
      const r = B * 0.5;
      g.fillStyle(w.dead ? 0xff9a6b : 0xe2f6ff, 0.96).fillCircle(cxw, Y(cyw), r);
      g.lineStyle(2, HLD, 0.9).strokeCircle(cxw, Y(cyw), r);
      const ang = w.x / U * 1.2;
      g.lineStyle(2, HLD, 0.75).lineBetween(
        cxw - Math.cos(ang) * r * 0.65, Y(cyw) - Math.sin(ang) * r * 0.65,
        cxw + Math.cos(ang) * r * 0.65, Y(cyw) + Math.sin(ang) * r * 0.65,
      );
    } else if (w.mode === 'ufo') {
      /* UFO:一个圆顶 + 一条底盘 */
      const base = Y(cyw - B * 0.35);
      g.fillStyle(w.dead ? 0xff9a6b : 0xe2f6ff, 0.95);
      g.beginPath();
      g.moveTo(cxw - B * 0.5, base);
      g.lineTo(cxw, Y(cyw + B * 0.55));
      g.lineTo(cxw + B * 0.5, base);
      g.closePath();
      g.fillPath();
      g.fillStyle(HLD, 0.9).fillRect(cxw - B * 0.62, base, B * 1.24, 4);
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
      const hw = B * 0.42, hh = B * 0.72;
      const rtop = Y(cyw + hh), rbot = Y(cyw - hh);
      g.fillStyle(w.dead ? 0xff9a6b : 0xe2f6ff, 0.96).fillRect(cxw - hw, rtop, hw * 2, rbot - rtop);
      g.lineStyle(2, HLD, 0.9).strokeRect(cxw - hw, rtop, hw * 2, rbot - rtop);
      g.fillStyle(HLD, 0.9).fillRect(cxw - hw + 3, rtop + 4, hw * 2 - 6, 3);
      g.lineStyle(3, HLD, 0.9);
      g.lineBetween(cxw - hw * 0.6, rbot, cxw - hw * 0.6, rbot + 6);
      g.lineBetween(cxw + hw * 0.6, rbot, cxw + hw * 0.6, rbot + 6);
    } else if (w.mode === 'spider') {
      /* 蜘蛛:方块 + 四条短腿 */
      const sw = B * 0.42;
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
      const pts: Array<[number, number]> = [[-B / 2, -B / 2], [B / 2, -B / 2], [B / 2, B / 2], [-B / 2, B / 2]];
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
    g.lineStyle(1, 0xffffff, 0.28).strokeRect(w.x + w.innerOff, Y(py + w.innerOff + w.innerSize), w.innerSize, w.innerSize);

    // 终点
    const endX = LEVEL.length * U;
    if (endX > x0 && endX < x1) {
      g.lineStyle(3, HLD, 0.8).lineBetween(endX, groundY, endX, ceilY);
    }
    // 死了就压一层暗红
    if (w.dead) g.fillStyle(0xff6b5a, 0.10).fillRect(x0, dy0, vw, dy1 - dy0);
    /* pulse 触发器:全屏闪一下 */
    if (w.flash > 0) g.fillStyle(w.tint ?? 0xffffff, 0.34 * w.flash).fillRect(x0, dy0, vw, dy1 - dy0);
    /* 开场 / 死亡 / 通关界面:半透明面板(文字是 Text 对象,这里只画底板) */
    if (this.phase !== 'running') {
      const px = Math.max(vw / 2, this.camX), py = this.camWorldY;
      g.fillStyle(0x03050a, 0.82).fillRect(px - 470, py - 120, 940, 240);
      g.lineStyle(2, HLD, 0.55).strokeRect(px - 470, py - 120, 940, 240);
      g.lineStyle(1, HLD, 0.25).strokeRect(px - 462, py - 112, 924, 224);
    }
  }

  /** 装饰贴片:只画不判定(3638 = 背景黑块,其余是几个指示图形) */
  private drawDeco(
    g: Phaser.GameObjects.Graphics, o: Level['objects'][number],
    obx: number, obw: number, oBot: number,
    Y: (wy: number) => number, tick: number,
  ) {
    const cx = obx + obw / 2, cy = Y((o.r + o.h / 2) * U);
    const rot = (((o.rot ?? 0) % 360) + 360) % 360;
    switch (o.art) {
      case 3638:
        /* 黑色背景块(图层 8):极淡的一层,主要是"遮罩"用途;太黑会盖掉整个画面 */
        g.fillStyle(0x000000, 0.10).fillRect(obx, Y((o.r + o.h) * U), obw, o.h * U);
        break;
      case 3810: {
        /* 感叹号(通常是"注意/警告"的指示)*/
        const th = (tick * 0) + 0;
        g.fillStyle(0xffe17a, 0.85);
        g.fillRect(cx - obw * 0.08, cy - obw * 0.45 + th, obw * 0.16, obw * 0.6);
        g.fillCircle(cx, cy + obw * 0.32, obw * 0.1);
        break;
      }
      case 3812: {
        /* 箭头:显示关卡想让你往哪走(旋转角就是这个方向) */
        const a = -((rot * Math.PI) / 180) + Math.PI / 2;
        const L = obw * 0.5;
        g.lineStyle(3, 0xe2f6ff, 0.75);
        g.beginPath();
        g.moveTo(cx - Math.cos(a) * L, cy - Math.sin(a) * L);
        g.lineTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L);
        g.moveTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L);
        g.lineTo(cx + Math.cos(a + 2.5) * L * 0.8, cy + Math.sin(a + 2.5) * L * 0.8);
        g.moveTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L);
        g.lineTo(cx + Math.cos(a - 2.5) * L * 0.8, cy + Math.sin(a - 2.5) * L * 0.8);
        g.strokePath();
        break;
      }
      case 3823:
        /* 笑脸 */
        g.lineStyle(2, 0xffe17a, 0.8).strokeCircle(cx, cy, obw * 0.4);
        g.fillStyle(0xffe17a, 0.8).fillCircle(cx - obw * 0.15, cy - obw * 0.1, 2);
        g.fillStyle(0xffe17a, 0.8).fillCircle(cx + obw * 0.15, cy - obw * 0.1, 2);
        g.lineStyle(2, 0xffe17a, 0.8);
        g.beginPath();
        g.arc(cx, cy + obw * 0.05, obw * 0.2, 0.3, Math.PI - 0.3, false);
        g.strokePath();
        break;
      case 3818:
        /* 叉 */
        g.lineStyle(3, 0xff9a6b, 0.8);
        g.lineBetween(cx - obw * 0.3, cy - obw * 0.3, cx + obw * 0.3, cy + obw * 0.3);
        g.lineBetween(cx + obw * 0.3, cy - obw * 0.3, cx - obw * 0.3, cy + obw * 0.3);
        break;
      case 3848:
        /* 点赞:一个简化的手势(拇指朝上) */
        g.fillStyle(0xa0ffd0, 0.7).fillRect(cx - obw * 0.25, cy - obw * 0.1, obw * 0.5, obw * 0.45);
        g.fillRect(cx - obw * 0.1, cy - obw * 0.45, obw * 0.2, obw * 0.35);
        break;
      case 41: case 106:
        /* 锁链:几个小环 */
        g.lineStyle(2, 0x8b93a7, 0.7);
        for (let k = -1; k <= 1; k++) g.strokeCircle(cx, cy + k * obw * 0.4, obw * 0.22);
        break;
      default:
        break;      // 31 / 1007 这类"占位空白"什么都不画
    }
  }
}

export function boot(target: string | HTMLCanvasElement, opts: { song?: string } = {}) {
  const useCanvas = typeof target !== 'string';
  if (opts.song) LEVEL.song = opts.song;   // 游玩模式插盘时由页面指定这一局用哪首歌
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
