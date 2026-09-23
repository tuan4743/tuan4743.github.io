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
import { generateLevel, makeRealTimeAxis, type Level, type Mode, type Obj } from './sim/level.ts';
import { World, botThink, frameOf, groundHeightOf, type RunState } from './sim/world.ts';
import { frameRects } from './sim/gdids.ts';
import { fingerprint } from './sim/replay.ts';
import { P, U, Y_TIME_SCALE } from './sim/constants.ts';
import { WATER_CHART } from './sim/charts/water.ts';
import { DEMO_CHART } from './sim/charts/demo.ts';   // ★ 演示铺(?level=demo,见下面的 LEVEL 取用处)

const HL = '#7ff0ff';
/* 每段一个强调色:网格、地面、门的颜色都跟着走,一眼知道跑到第几段 */
const PAL = [0x7ff0ff, 0xffe17a, 0xa0ffd0, 0xc6a0ff, 0xff9fd0];
const HLD = 0x7ff0ff;
const WARN = 0xff9a6b;
/** 视口高度(块)。★ 原版口径:设计分辨率 480×320、1 块 = 30 单位 → 10.67 格;
 *  用户在原版里数到的是 11 格(取整),所以这里按 11 来 —— 一屏至少别比原版少。 */
const VIEW_H_BLOCKS = 11;
/** 渲染分辨率系数:缓冲高度 = 720 × 这个值(缓冲宽度由盒子的长宽比推出来)。
 *  1.0 = 不降画质;调小可以少画点像素换帧率(方块在屏幕上还是一样大,只是略软)。 */
const RENDER_SCALE = 1;
/** 渲染缓冲的像素上限(宽×高):超过就等比缩一档。
 *  1280×720 ≈ 92 万,这里给到 115 万 —— 常规窗口用不到,
 *  但盒子特别宽时(显示器贴图是被拉伸填满视口的,宽屏比例能到 2.4:1)能兜住帧率。 */
const BUF_BUDGET = 1_150_000;
/** 绘制裁剪的余量(单位):触发器会推物件,粗筛时留出一块,
 *  免得"屏幕外正被推进来"的东西被提前剔掉。 */
const CULL_MARGIN = 24 * 30;
/* 相机纵向的原版常量(单位、朝上;出自 OpenGD 的 PlayLayer::updateCamera —— 用户要求照搬):
 *   方块形态:人被困在视野里的一条带子里 —— 下沿(cam + unk3)、上沿(cam + 屏幕高 − unk2),
 *             只有越出这条带子相机才动,一动就把人贴回带子边缘;
 *   跑在【地面】(不是方块)上时:相机回落到地面高度(cam.y = 0 → 视野下边 = −90 单位);
 *   飞行类 / 球:进门那一刻把视口中心钉死(m_fCameraYCenter)。 */
const CAM_LOW = 90;                       // 上沿余量 3 格
const CAM_MID = 120;                      // 下沿余量 4 格
const CAM_GROUND_BOTTOM = -90;            // 站在地面上:视野下边(地面之上 3 格)
/* ★ 2026-09 删掉 CAM_FLY_BELOW / CAM_FLY_CENTER / CAM_BALL_BELOW / CAM_BALL_CENTER:
   那四个是我从 OpenGD 抄的"门高度阈值"(180/150/120)✗ —— 真源码(asm 451064-451076)算相机目标
   只用【玩家中心 + 屏高 + 30 对齐 + 地面下限】,没有门高度这一档 ✓ 留着只会误导 ✗ */
/** 视口【钉死】的形态(原版:除方块外都固定;用户点名 Wave/UFO 就是这样)。
 *  ★ 机器人 / 蜘蛛:OpenGD 没给它们设中心(沿用上一个值),但用户那关这两段要纵爬 5~16 格,
 *    钉死会把人拍出画外 —— 所以这两种按方块跟随。这两行是我们自己定的,已写进文档。 */
const CAM_FIXED_MODES = new Set(['ship', 'ufo', 'wave', 'ball']);

/* ---------------- ★ 形态贴图(static/icons)----------------
 * ★★ 结论(2026-09 实测,写给以后的人):
 *   这套图集是【真·GD 玩家图集】,但它是**按部件拆开**的 —— 同一形态的 `_2_`(第二色)、`_extra_`(碎点)、
 *   `_glow_`(描边)以及 02/03/04 那几帧(腿/眼睛/面罩…)**画布尺寸各不相同**,靠 `spriteOffset` 对齐;
 *   要拼出一个正确的形态,需要 GD 的**部件合成表**(哪些部件叠在一起、哪几帧是动画),我们没有。
 *   实测把"帧号轮播"当动画 = 一会儿只有腿、一会儿只有眼睛(用户报的"spider的贴图是乱的"就是这个),
 *   而"取最大的一帧当整只角色"也不行(spider 拿到的是身体、robot 拿到的是面罩)。
 *   ⇒ 默认**不启用**图集,玩家仍旧走矢量画法(至少形状是对的);想试图集就加 `?icons=1`。
 *   另外这套素材有【两处文件错配】(实测按 plist 里的 metadata.size 对出来的):
 *     · cube.png(208×252) 与 cube.plist(声明 252×244)对不上 —— 应该换回配套的那张;
 *     · GameSheet.png(3091×2048) 与 GameSheet.plist(声明 3081×2048)对不上,
 *       而 GameSheet_old.png(3081×2048)正好对得上 ⇒ 要用物件图集请用 old 那张(或重新导出)。
 *   下面的加载器会自动挑"尺寸与 plist 声明一致"的那张 png,挑不到就跳过(不会画出错位的图)。 */
const ICON_ENABLED = true;   // ★ 临时默认打开(用户 2026-09:"要")—— 看完症状就按 IDA 的 player_* 帧名规则改 buildIcons
/** ★★ 物件贴图:2026-09 用户实测"全是错误贴图",**默认关掉**,回到矢量画法。
 *  为什么错:GD 的物件美术是【碎件 + 运行时按代码坐标拼装】的 ——
 *    · 形态门 = portalshine + back + extra + extra_2 + front 五层,层与层的相对位置在 exe 里写死;
 *    · 跳环 = 白模 + 运行时染色(单看底图分不出是哪个环);
 *    · 砖块 block001_01..07 = 按邻居自动拼接的 7 块(哪块对应哪条边,plist 里没有);
 *  而 plist 只给"每块多大、在图集哪儿",不给"摆在哪" ⇒ 我按"各自画布中心对齐"拼出来的全是错位碎片。
 *  所以:默认**不加载**这张图集(省 121 KB),要研究就加 `?art=1`(代码保留,别再当默认)。 */
const ART_ENABLED = true;    // ★ 2026-09 重新打开:现在用的是【官方图集 + 真映射】(不是早期那套猜的表 ✓)
/* 图集版本号:每次重烘 gd-object-atlas.json / gd-art-*.png 就改一次 ⇒ 浏览器不会吃旧缓存 ✓ */
const ART_V = 'u4';
/** ★★ 无敌模式的"轨道上限"(用户口径:"给无敌模式加个上限,不允许脱离预定轨道")。
 *  为什么:无敌本身解决不了"人卡出墙/飞到天上"—— 以前只贴住关卡边界(0 ~ 127 格),
 *  于是开了无敌就能一路飞到 y=110 把整关绕过去,玩起来完全不是这张图。
 *  现在:开着无敌时,把人夹在【规划走廊】(tools/plan.ts 算出来的那条,y 实测 9~18 格)±BAND 块之内,
 *  超出就把纵向位置拉回边界并清掉朝外的速度 —— 横向照旧自由走。`?band=12` 可以放宽。 */
const GUIDE_BAND = Math.max(1, Number(/(^|[?&])band=([\d.]+)/.exec(location.search)?.[2] ?? 6));
const ICON_ATLAS: Array<{ mode: Mode; key: string; file: string }> = [
  { mode: 'cube', key: 'icon-cube', file: 'cube' },
  { mode: 'ship', key: 'icon-ship', file: 'ship' },
  { mode: 'ball', key: 'icon-ball', file: 'ball' },
  { mode: 'ufo', key: 'icon-ufo', file: 'bird' },
  { mode: 'wave', key: 'icon-wave', file: 'dart' },
  { mode: 'robot', key: 'icon-robot', file: 'robot' },
  { mode: 'spider', key: 'icon-spider', file: 'spider' },
];

/** 解析 TexturePacker 的 .plist(XML)→ 帧表(含旋转标记与 spriteOffset)。
 *  为什么要自己写:Phaser 4.2 的 `load.atlasXML` 只加载图片、不解析 plist(见 buildIcons 的注释)。 */
function parsePlistFrames(xml: string): Record<string, {
  frame: { x: number; y: number; w: number; h: number };
  rotated: boolean;
  sourceSize: { w: number; h: number };
  spriteSourceSize: { x: number; y: number; w: number; h: number };
}> | null {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const root = doc.querySelector('plist > dict');
  if (!root) return null;
  const kids = Array.from(root.children);
  const fi = kids.findIndex((e) => e.tagName === 'key' && e.textContent === 'frames');
  if (fi < 0) return null;
  const out: NonNullable<ReturnType<typeof parsePlistFrames>> = {};
  const list = Array.from(kids[fi + 1].children);
  for (let j = 0; j < list.length; j++) {
    if (list[j].tagName !== 'key') continue;
    const name = (list[j].textContent ?? '').trim();
    const inner = Array.from(list[j + 1]?.children ?? []);
    const get = (k: string) => {
      const idx = inner.findIndex((e) => e.tagName === 'key' && e.textContent === k);
      return idx >= 0 ? (inner[idx + 1]?.textContent ?? '') : '';
    };
    const rect = get('textureRect').match(/\{\{(-?[\d.]+),(-?[\d.]+)\},\{(-?[\d.]+),(-?[\d.]+)\}\}/);
    if (!rect) continue;
    const ss = get('spriteSourceSize').match(/\{(-?[\d.]+),(-?[\d.]+)\}/);
    const off = get('spriteOffset').match(/\{(-?[\d.]+),(-?[\d.]+)\}/);
    out[name] = {
      frame: { x: +rect[1], y: +rect[2], w: +rect[3], h: +rect[4] },
      rotated: get('textureRotated') === 'true',
      sourceSize: { w: +(ss?.[1] ?? rect[3]), h: +(ss?.[2] ?? rect[4]) },
      /* plist 的 spriteOffset 是"相对未裁剪位图中心"的偏移,y 轴方向和 Phaser 相反 */
      spriteSourceSize: { x: +(off?.[1] ?? 0), y: -(+(off?.[2] ?? 0)), w: +rect[3], h: +rect[4] },
    };
  }
  return Object.keys(out).length ? out : null;
}

/** 从页面上挑这一局用哪张铺面:window.__GD_CHART = 'gen' 用老的自动铺面,其它用真实铺面 */
function pickLevel(): Level {
  const want = (window as unknown as { __GD_CHART?: string }).__GD_CHART;
  if (want === 'gen') return generateLevel({ seed: 20260913 });
  /* ★★ 2026-09 演示铺(用户:"单独做一个演示铺,把所有物件顺着摆")——
     加 ?level=demo 就切到它:每一类物件顺着摆一排(方块/刺/锯/五种板/六种环/三种箭头/七形态门/
     重力门/速度门/迷你门/存档点/硬币/破砖/线框 ✓),用来一次测完所有东西 ✓
     生成器:tools/make-demo-level.ts ⇒ src/sim/charts/demo.ts */
  if (/(^|[?&])level=demo(&|$)/.test(location.search)) return DEMO_CHART;
  return WATER_CHART;                       // 第三张盘:用户自己铺的 WATER
}
const LEVEL: Level = pickLevel();
/** 真实关卡的"块 → 秒"时间轴(见 Scene.tAtX 的说明):按速度门积分,复活时靠它把音乐 seek 到位 */
const REAL_T_AXIS = makeRealTimeAxis(LEVEL);

/* ---------------- ★ 各形态的默认双色(主色 / 第二色) ----------------
 *  GD 里玩家图标是双色的:`?icons=1` 试图集时按它上色,`?col1=RRGGBB&col2=RRGGBB` 可覆盖。 */
const ICON_COL: Record<Mode, [number, number]> = {
  cube: [0x8ef7ff, 0x2f6bff],
  ship: [0xbdf3ff, 0x3f7cff],
  ball: [0x9fe8ff, 0x2f9bff],
  ufo: [0xc8f6ff, 0x4a86ff],
  wave: [0x9fe8ff, 0x36d0ff],
  robot: [0xa9f0ff, 0x3f6bff],
  spider: [0xc9b6ff, 0x5a4bff],
};

/* 跳环 / 弹簧的配色(和游戏里的常识一致:黄=跳,粉=小跳,蓝=翻重力,绿=翻重力+跳) */
/* ★ 2026-09 环/冲刺环【不染色】:官方每种环本来就是带颜色的不同帧(见 artTintOf 的注释 ✓)
   下面这张表只给【矢量兜底】用(贴图缺失时才走),颜色照官方口味调过 ✓ */
const ORB_COL: Record<string, number> = {
  yellow: 0xffc800, pink: 0xff00ff, red: 0xff6400, blue: 0x0000ff, green: 0x00ff00, black: 0x2a2a2a,
};
/* ★★★ 2026-09 玩家颜色(用户:"玩家贴图没有上色,有点诡异"):
   取本关的颜色通道 1005 / 1006 —— 实测 (125,255,0) 亮绿 / (0,255,255) 青,正是 GD 默认的
   P1 绿 / P2 青 ✓ 官方图标美术是白灰底,GD 就是拿这两个颜色去染的 ✓
   (以后接"关卡自定义玩家色"就把这两个值改成读 kS38 的 1005/1006 ✓) */
const PLAYER_C1 = 0x7dff00;
const PLAYER_C2 = 0x00ffff;
const PAD_COL: Record<string, number> = {
  yellow: 0xffe17a, pink: 0xff9fd0, red: 0xff8a8a, blue: 0x9fd8ff, purple: 0xc6a0ff,
};
/* 形态门的颜色(和原版各形态的口径对齐:方块绿、飞机粉、球橙、UFO 黄、波浪青、机器人紫、蜘蛛灰蓝)
   —— 用户报"形态门都是一个样式,我怎么知道这个门是什么",所以颜色 + 门上的名字牌子一起上。 */
const PORTAL_COL: Record<string, number> = {
  cube: 0x7dffb0, ship: 0xff9fd0, ball: 0xffb066, ufo: 0xffe17a,
  wave: 0x7ff0ff, robot: 0xc6a0ff, spider: 0xa8c4ff,
};
/** 门框尺寸(单位)= 原版判定盒 34×86 —— 画成竖椭圆门,和撞上去的范围一致 */
const PORTAL_W = 34, PORTAL_H = 86;

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
  /** 【看 bot 通关】演示:把搜索出来的通关输入卷原样喂给模拟。
   *  ★ 为什么不是"现场搜":这张图 3620 块,Node 侧用宏动作最优优先树搜索也要跑一分钟
   *    (数据在 tools/autoplay.ts 的头注释里),浏览器里现搜会卡住页面。
   *    所以页面里放的是那一次的【输入卷】——它和 Node 侧逐帧同源,回放指纹一致
   *    (tools/verify-run.ts 每次都验)。玩家按键随时可以接管。 */
  demoMode = false;
  /** 想开演示(URL ?demo=1 或按 B);真正的切换发生在第一帧 update 里(那时世界已经建好) */
  demoWanted = false;
  demoTape: boolean[] | null = null;
  demoTried = false;
  demoLoaded = false;
  demoEndX = 0;
  demoErr = '';
  /** 演示倍速:**按真实时间**快进的倍数(1 = 正常速度)。
   *  ★ 2026-09 修:以前是"一帧渲染推 N 帧物理" —— 于是 144Hz/240Hz 屏上会快 2.4~4 倍,
   *    用户看到的就是"整体八倍速、几秒就播完了"(20086 帧的卷子在 240Hz 上 10 秒跑完)。
   *    现在按 dt 累积:无论屏幕多少帧,1 倍速就是 334.8 秒播完。 */
  demoSpeed = 1;
  /** 演示的时间累积器(秒)—— 按真实时间推进,和刷新率无关 */
  demoAcc = 0;
  /** 形态图集(static/icons)建好的图层。见 buildIcons() */
  /** 载具里的"驾驶位 cube"(UFO/飞船/球/波浪箭里坐着的那颗)✓ 见 drawIconPlayer */
  pilot: Phaser.GameObjects.Image | null = null;
  /** 驾驶位诊断只打一次 ✓ */
  pilotDbgLogged = false;
  /** ★★★ 2026-09 限高框(限制框)的【外观】= 原版天花板本体(用户:"没有贴图,我都看不到限高框在哪,
   *  我怎么知道生没生效")—— 源码里 GJFlyGroundLayer : GJGroundLayer,而 GJBaseGameLayer::createGroundLayer
   *  一次建两块地面、第二块纵向镜像 ⇒ 天花板就是【倒过来的地面】✓
   *  ⇒ 所以这里画的不是我自己编的黑条 ✗,而是【地面贴图本体】镜像平铺:
   *     贴图 = groundSquare_01_001.png(128×128,从 APK 原样取出 ✓ 1 世界单位 = 1 像素 ⇒ 铺出来就是原版尺度)
   *     面   = 视口上边 − 12(源码换算:天花板节点 = 进场高度 + 148 = 视口上边 − 12,见 sim 的 applyAirLimit)
   *     朝向 = flipY 镜像 ✓ · 平铺跟着关卡滚(tilePositionX = −camX,对应原版 updateGroundPos)✓ */
  ceiling: Phaser.GameObjects.TileSprite | null = null;
  /** 上框下沿那条亮线(原版是 floorLine_001.png)✓ */
  ceilingLine: Phaser.GameObjects.Rectangle | null = null;
  /** ★★★ 2026-09 用户:"没有地面的框" ⇒ 下框(这个形态的"地面")也要画 —— 原版上下各一条地面 ✓ */
  groundBand: Phaser.GameObjects.TileSprite | null = null;
  groundLine: Phaser.GameObjects.Rectangle | null = null;
  /** 天花板贴图一格 = groundSquare_01_001.png 的 128×128 ✓ */
  static readonly GROUND_TILE = 128;
  /** ★★★ 2026-09 用户:"空挡就是 8 格 … 我在说限框【整体高度】不对" ✓
   *  带子的厚度不是固定 128 ✗ —— 源码里是 `scaleGround(带, 地面缩放)`(asm 431178/431179),
   *  即【贴图高 × 缩放】✓。按用户口径反推:8 格空档(240)+ 上下两条带要正好排进一屏(320/330):
   *   (屏 330 − 240)/2 = 45,取 128 × 0.25 = 32 ⇒ 整体 240 + 64 = 304,上下各余 13 ✓ 一屏排满 ✓
   *  ⇒ 带宽 = 128 × 0.25 = 32 单位(约 1 格)✓ —— 我上一版画成 128(4.3 格)⇒ 整体 496 ✗ 比屏还高 ✓ */
  static readonly BAND_SCALE = 0.25;
  /** ★★★ 2026-09 用户:"为什么摄像机是突然被固定的" —— 原版是每帧 iLerp(0.1) 靠过去,不是瞬移 ✓
   *  这两个值:camPinTarget = 进门那一刻锁定的视口中心(区间就锁在它身上 ✓,sim 拿到的框也用它 ✓)
   *             camPinY      = 相机【实际】所在的高度,每帧朝 target 靠 0.1 ✓ */
  camPinTarget = 0;
  camPinY: number | null = null;
  /** 这次形态进门是否已经钉过(锚门那段区间只算一次 ✓) */
  camPinned = false;
  /** ★★★ 进场进度 = 源码 `*(this + 872)`(=`this[218]`,animateInDualGroundNew 里 tweenValue 到 1.0)✓
   *  `updateCameraBGArt` 里天花板/地面都是 `× v53` 乘它 ⇒ 0 时两块在窗口【外】、1 时收到位 ✓
   *  (地面从下往上收、天花板从上往下收 —— 不是我上一版那种"从下面滑上来"✗) */
  bandT = 1;
  /** ★★★ 2026-09 用户:"为什么限高框没有出现的动画" + "动画太快了"
   *  原版进门是 tweenCeiling/tweenBottomGround 把两条地面【拉进来】;相机那边是
   *  `m_obCamPos.y = GameToolbox::iLerp(m_obCamPos.y, cam.y, 0.1f, dt/60)`(每帧靠 0.1,约 0.5 秒收敛)✓
   *  ⇒ 两条框用【和相机同一套】每帧 0.1 的指数靠拢(不是我自己定的 0.1 秒线性 ✗ —— 那个太快,用户实测)
   *  bandHiY / bandLoY = 两条框面【当前实际】所在的高度;null = 还没进场(从画外开始)✓ */
  bandHiY: number | null = null;
  bandLoY: number | null = null;
  /** 两条框的贴图色:原版地面贴图是白的,由【关卡地面色(通道 1001)】染色
   *  (GJGroundLayer::updateGround01Color / OpenGD `_colorChannels.at(1001)._color`)✓
   *  ★ 本关 chart 里还没有通道数据(只硬编了玩家色 1005/1006)⇒ 先用【页面地面线已经在用的那个色】,
   *    拿到关卡的 kS38 就换成 1001 的真值 ✓ */
  bandTint = 0xffffff;
  private iconLayers: Array<{
    mode: Mode;
    body: Phaser.GameObjects.Image;
    glow: Phaser.GameObjects.Image | null;
    bw: number; bh: number; pxPerUnit: number;
  }> = [];
  private iconsReady = false;
  /** ★ 物件贴图池:每帧按可见物件取用,用完把多余的藏起来(避免几千个 Image 常驻) */
  private artPool: Phaser.GameObjects.Image[] = [];
  private artUsed = 0;
  artReady = false;

  /** 物件 → 图集帧名(没有就返回 null,走矢量画法)。
   *  ★★★ 2026-09 改成读【官方真映射】:static/assets/gd-object-atlas.json 的 ids
   *      (id → 帧名,来自 OpenGD 的 Content/Custom/object.json;图集是官方 GJ_GameSheet{02}-uhd ✓)
   *      —— 早期那套"按尺寸/颜色/唯一命中"猜出来的自造表(见 git 历史里的 build-art MAP)已废弃 ✗
   *  线框(468/469/470)按用户口径不做贴图 ⇒ 排除 ✓ */
  private artKeyOf(o: Obj): string | null {
    if (!this.artReady) return null;
    if (o.kind === 'frame') return null;
    const pack = this.cache.json.get('gd-art-ids') as { ids?: Record<string, string> } | undefined;
    const id = (o as unknown as { id?: number }).id;
    if (id == null || !pack?.ids) return null;
    return pack.ids[String(id)] ?? null;      // 有帧 ⇒ 画贴图;没帧 ⇒ null ⇒ 矢量 ✓
  }

  /** 无敌模式的轨道夹取:加载规划走廊(static/assets/gd-guide.json),按 x 插值出这条走廊的高度,
   *  把人夹在 ±GUIDE_BAND 块内。走廊没加载到就退回"只贴关卡边界"(老行为,不影响能玩)。 */
  private guide: Array<[number, number]> = [];
  private guideYAt(xBlocks: number): number | null {
    const G = this.guide;
    if (!G.length) return null;
    if (xBlocks <= G[0][0]) return G[0][1];
    const last = G[G.length - 1];
    if (xBlocks >= last[0]) return last[1];
    let lo = 0, hi = G.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (G[mid][0] <= xBlocks) lo = mid; else hi = mid; }
    const [x0, y0] = G[lo], [x1, y1] = G[hi];
    return y0 + (y1 - y0) * ((xBlocks - x0) / Math.max(1e-6, x1 - x0));
  }
  private loadGuide() {
    fetch('/assets/gd-guide.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
      .then((j: { points: Array<[number, number]> }) => {
        this.guide = (j.points ?? []).filter((p) => Array.isArray(p) && p.length === 2);
        console.log('[gd] 无敌轨道就绪:' + this.guide.length + ' 个点 · ±' + GUIDE_BAND + ' 块');
      })
      .catch((e: Error) => { console.warn('[gd] 轨道没加载到,无敌只贴边界:' + e.message); });
  }
  /** 无敌状态下把人夹回轨道。
   *  ★★ 2026-09 修(用户:"轨道是固定y轴,导致直接卡住"):第一版是【硬夹】——
   *  超界就把 y 直接赋值到边界。可走廊本身是几何规划出来的,某些位置上它就是贴着砖/在半空,
   *  硬夹等于每帧把人塞进那块几何里 ⇒ 人卡在墙里动不了 ✗。
   *  现在改成【软推】:每帧最多推 0.5 块(30 单位/秒),并清掉朝外的纵向速度 ——
   *  不瞬移、不穿模,推不进去就自然停在那儿,绝不会卡死 ✓。 */
  private clampToGuide() {
    const w = this.world;
    if (!w.god) return;
    const gy = this.guideYAt(w.x / U);
    if (gy == null) return;
    const cy = (w.y + w.box / 2) / U;                 // 用玩家【中心】(块)比,别拿脚底比
    const over = cy - gy;
    if (Math.abs(over) <= GUIDE_BAND) return;
    const dir = over > 0 ? -1 : 1;                    // 往轨道那一侧推
    const push = Math.min(0.5, Math.abs(over) - GUIDE_BAND) * U;
    w.y += dir * push;
    if (dir < 0 && w.vy > 0) w.vy = 0;
    if (dir > 0 && w.vy < 0) w.vy = 0;
  }

  /** 贴图染色:砖用关卡主色;环/冲刺环【不染】—— 官方每种环本来就是带颜色的不同帧
   *  (tools/sheet-peek.ts 放大验证:ring_01 黄芯 · gravring_01 青芯 · gravJumpRing_01 绿芯 ·
   *   ring_03 品红芯 · dropRing_01 黑芯 · dashRing_01/02 环+绿/品红箭头 ✓)
   *  ⇒ 2026-09 那版"按类型染色"已作废(当时只统计 alpha>200 的像素,漏了半透明彩色内芯 ✗) */
  private artTintOf(o: Obj, blockTint: number): number {
    return o.kind === 'block' ? blockTint : 0xffffff;
  }

  /** 把一个池子里的 Image 摆好;返回 false 表示这帧没画(调用方走矢量兜底) */
  private drawArtObject(o: Obj, key: string, dx: number, dy: number, tintCol = 0xffffff, depth = 6): boolean {
    const tex = this.textures.get('gd-art');
    const fr = tex && tex.has(key) ? tex.get(key) : null;
    if (!fr) return false;
    let img = this.artPool[this.artUsed];
    if (!img) { img = this.add.image(0, 0, 'gd-art').setDepth(depth); this.artPool.push(img); }
    this.artUsed++;
    /* ★★★ 2026-09 用户:"速度门/形态门等贴图方向不对或者大小不对,原版门贴图大小应该是竖着的三格"
       —— 以前 k = 物件判定盒高 ÷ 帧高 ✗ ⇒ 门在铺面里是 1 格高的物件,
          于是把【3 格高】的门美术硬压成 1 格 ⇒ 又扁又怪 ✓✓
       改成【官方美术密度】:标准图集 1 px = 1 单位,uhd 图集 4 px = 1 单位
       ⇒ k = 1/4(我们用的是 uhd 图集 ✓)⇒ 3 格高的门自然就是 90 单位高 ✓
       锚点:门/速度门/迷你门 = 贴图【底边贴物件底边】(否则 3 格美术会往上冒 1 格 ✓);其余居中 ✓ */
    const k = 0.25;                                   // uhd:4 px = 1 世界单位
    const dispW = fr.width * k, dispH = fr.height * k;
    /* ★★★ 2026-09 用户:"竖了,但整体偏高/偏低" —— 病根是我上一轮给门加的【底边对齐】✗
       硬证据(GD 自己的判定表 _pHitboxes,见 gdids.ts,单位 1 块 = 30):
         形态门 34×86 == 贴图 34×85 ✓  速度门 0 档 35×44 == 贴图 35×44 ✓
         速度门 2 档 51×56 == 50.5×56.5 ✓  3 档 65×56 ✓  4 档 69×56 ✓
       ⇒ 门的判定盒【就是贴图外框】,而 GD 的判定盒以【物件中心】为心 ⇒ 贴图必须【居中】画,
          和砖/刺/环一个规矩 ✓
       上一轮 `dy + chU/2 + dispH/2` 把 3 格高的门整体抬了 (86+85)/2 = 85.5 单位 ≈ 2.85 格 ✗
       —— 这正是"整体偏高";也解释了更早那次"速度门往下偏移两格":同一个锚点来回错 ✓ */
    const drawY = dy;                                 // 居中 ✓(isDoor 只留给注释/后续层判断用)
    img.setVisible(true).setTexture('gd-art', key).setPosition(dx, drawY).setDepth(depth);
    img.setRotation(((o.rot ?? 0) * Math.PI) / 180);
    /* ★★★ 2026-09 用户:"速度箭头有几个箭头的方向不对,各种门贴图也是方向不对"
       —— GD 里门/箭头的朝向来自【flipX / flipY】(不是 rot ✗),我们以前没做 ⇒ 该翻的都没翻 ✓ */
    img.setFlipX(!!o.flipX);
    img.setFlipY(!!o.flipY);
    img.setDisplaySize(dispW, dispH);
    img.setTint(tintCol);
    return true;
  }
  /** 验收用:update 被调了几次、Phaser 喂进来的 delta 是多少 */
  updates = 0;
  lastDt = 0;
  /** 自己用 performance.now() 量上一次 update 的墙上时间(演示节拍用,见 update) */
  lastWallMs = 0;
  /** 上一次"试着把音乐 seek 回模拟时间"的时刻(seek 失败时每 1.5 秒重试一次) */
  lastSeekTry = 0;
  /** 验收用:演示/机器人模式下每次"发现世界死了"的记录(次数、帧号、位置) */
  deathLog: Array<{ tick: number; x: number; y: number; vy: number; mode: string; gdir: number; chunk: number; at: number; hold: boolean }> = [];
  baseTick = 0;                     // 这一条命的起点在音乐时间轴上的帧号(复活时跟着存档点走)
  airT = 0;                         // 空中停留了多久(给方块自转用)
  spinLast = 0;                     // ★ 落地时保留上一个空中角度(不再"回正" —— 用户:"回转更刻意了")
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
  private godLatch = false;         // G 键:无敌模式
  private prevG = false;
  private demoLatch = false;        // B 键:看 bot 通关(演示卷)
  private padLatch = 0;             // [ / ]:弹簧力度微调(-1 / +1 个单位,每个 5%)
  /** 无敌模式想要的状态 —— startRun() 会 new 一个 World,得把开关带过去 */
  godWanted = false;
  /** 弹簧力度微调(和 godWanted 一样:换世界时要带过去) */
  padMulWanted = 1;
  private modeLatch = 0;            // 数字键 1~7:调试用的现场换形态
  uiTitle!: Phaser.GameObjects.Text;
  uiHint!: Phaser.GameObjects.Text;
  poemText!: Phaser.GameObjects.Text;
  /** 形态门头上那块名字牌子(门可能被触发器推动,位置每帧跟着算) */
  private portalLabels: Array<{ o: Obj; t: Phaser.GameObjects.Text }> = [];
  poemT = 0;                       // 终末之诗滚了多久(秒)
  egg = false;                     // 彩蛋窗口是否已弹出

  /** 第一次确认:开跑(音乐和模拟同时从 0 开始 —— 铺面贴着音乐,不能有"准备时间") */
  startRun() {
    if (this.phase !== 'idle') return;
    this.phase = 'running';
    this.started = true;
    this.world = new World(LEVEL);
    this.world.god = false;   /* ★ 2026-09 用户:"把无敌模式直接给我删掉" ⇒ 恒为 false,开关不再生效 */      // 无敌开关要跟着新世界走
    this.world.padMul = this.padMulWanted;
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

  /** 把音乐跳到第 t 秒并从那里播。
   *  ★★ 2026-09 修(用户:"死了一次之后在存档点复活,音乐不会在那个地方继续播放"):
   *    `a.currentTime = t` 在【元数据还没加载完】时会抛异常 / 被忽略(readyState 0),
   *    而这里把异常吞了 → 复活时音乐从"死掉那一刻"接着放,和画面(存档点)彻底不同步;
   *    更糟的是模拟是【音乐驱动】的(target = currentTime×60 − baseTick),
   *    于是复活瞬间会被灌进几百帧(人直接被拽到前面去)。
   *    现在:没准备好就等 loadedmetadata 再 seek;并且给模拟加一条漂移护栏(见 update)。 */
  private playMusicAt(t: number) {
    const a = this.audio;
    if (!a) return;
    this.seekMusic(t);
    a.play().catch((e) => { this.audioErr = String((e && e.message) || e); });   // 失败原因留着,别静默吞
  }

  private seekMusic(t: number) {
    const a = this.audio;
    if (!a) return;
    const apply = () => { try { a.currentTime = t; } catch { /* seek 失败就从头放 */ } };
    if (a.readyState >= 1) apply();
    else a.addEventListener('loadedmetadata', apply, { once: true });
  }

  private pauseMusic() { if (this.audio && !this.audio.paused) this.audio.pause(); }

  /** 彩蛋解锁:写进 localStorage,CD 页面据此显示「切换游玩模式」按钮 */
  private unlockEaster() {
    try { localStorage.setItem(EASTER_KEY, '1'); } catch { /* 无痕模式就算了 */ }
  }

  /** x(单位)→ 音乐秒数。
   *  ★★ 2026-09 修 bug:以前这里直接调 `tOfX(LEVEL, world.x / checkX)` —— 两个错叠在一起:
   *    ① `tOfX` 的口径是【块】(sim.test / tools/diag-chart 都按块调),传单位进去等于把时间放大 30 倍;
   *    ② 更要命的是 `tOfX` 读的是 `level.segments`,而那是【生成铺面】的产物 ——
   *       真实关卡(这张手搓的 WATER)用它会算出非单调的垃圾(x=600 → 7.2s,而 x=1060 → 0.0s)。
   *    后果正是用户报的那条:"死了一次之后在存档点复活,音乐不会在那个地方继续播放" ——
   *    模拟是【音乐驱动】的(target = currentTime×60 − baseTick),baseTick 一错,target 恒为 0,
   *    画面停在原地、音乐却从荒唐的位置放着。
   *  现在走 makeRealTimeAxis():按【速度门】分段积分 dx/v —— GD 编辑器里 x 就是速度×时间的积分,
   *  所以这条才是"铺面贴着音乐"的原口径。自检:积分出的总长 294.45s vs 这首歌实际 299.29s(差 1.6%),
   *  再按 audio.duration 等比缩放一下,结尾就和歌对齐了。 */
  private tAtX(xUnits: number): number {
    /* ★★ 2026-09 修(用户:"存档点复活音乐继续的位置错误,采音全乱"):
       以前这里把时间轴【整体拉伸】成音频时长:raw × (audio.duration / axisTotal)。
       可关卡自己的时间轴全长 294.45 秒,而这支 mp3 是 299.29 秒 ⇒ 差 1.6%,
       这个系数会让**每一个采音点都按比例偏移** —— 越往后偏得越多:
         x=3032(第 8 个存档点)处:关卡时间 245.74 秒,拉伸后变成 249.78 秒 ⇒ 偏 4.04 秒 ✗✗
       而原版的口径是:x → 秒 由【速度门积分】决定(关卡就是照这首歌铺的),
       音乐按它自己的速率放,两边在同一个时间轴上对齐 ⇒ **不该乘任何拉伸系数**。
       ⇒ 现在直接用关卡自己的时间轴(不拉伸)。 */
    return REAL_T_AXIS(Math.max(0, xUnits) / U);
  }

  /** 从存档点重来(死亡界面按确认) */
  retry() {
    const w = this.world;
    w.respawn();
    this.baseTick = Math.floor(this.tAtX(w.checkX) * 60);
    this.airT = 0;
    this.acc = 0;
    this.deathT = 0;
    this.prevY = w.y;
    this.camInit = false;                 // 复活:镜头立刻贴到存档点(不然要从死亡点滑过来)
    this.phase = 'running';
    this.playMusicAt(this.tAtX(w.checkX));
  }

  /** 从头来(R 键 / "重来"按钮 / 死亡界面按 R)。★ 2026-09 修:以前演示/机器人模式下
   *  这一支根本走不到(update 里每帧把 phase 强行掰回 running),用户按 R 就是"摆设";
   *  现在任何模式、任何阶段都走这里:演示模式下 = 【演示从头再放一遍】。 */
  restartRun() {
    this.demoAcc = 0;
    this.demoEndX = 0;
    if (this.demoMode || this.botMode) {
      this.world = new World(LEVEL);
      this.world.god = false;   /* ★ 2026-09 用户:"把无敌模式直接给我删掉" ⇒ 恒为 false,开关不再生效 */
      this.world.padMul = this.padMulWanted;
      this.botStarted = false;              // 让 pump 里"干净开局"那一段重新走一遍
      this.botStates = [];
      this.fp = '';
      this.baseTick = 0; this.prevY = 0; this.airT = 0; this.camInit = false;
      this.phase = 'running';
      this.started = true;
      this.playMusicAt(0);
      return;
    }
    this.restartFromZero();
  }

  /** 从头来(R 键,死亡界面与通关界面都能用) */
  restartFromZero() {
    this.world.resetToStart();          // ★ 回到铺面的出生点(Level.start),不是硬编码的 (0,0)
    this.baseTick = 0;
    this.airT = 0;
    this.acc = 0;
    this.demoAcc = 0;
    this.deathT = 0;
    this.prevY = 0;
    this.camInit = false;
    this.phase = 'running';
    this.playMusicAt(0);
  }

  create() {
    this.g = this.add.graphics();
    /* ★★ 2026-09 用户:"把按键,提示全删掉,按b还是有反应" ⇒ 只保留跳跃键(SPACE/↑/W)✓
       删掉 R(重开) / G(无敌,已停用) / B(演示·机器人)—— 这三个是调试入口 ✓ */
    /* ★★ 2026-09 演示铺的自由移动:←/→ 或 A/D 决定左右(freeDir 在帧循环里设 ✓) */
    this.keys = this.input.keyboard!.addKeys('SPACE,UP,W,A,D,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
    /* ★★ 2026-09 用户:"单次测试游戏耗时太长" ⇒ 加【URL 传送参数】,不用从头玩 ✓
         ?from=2500    从 x=2500 开始(自动取该 x 之前【最近的存档点】状态,再把人放过去 ✓)
         ?cp=3         直接跳到第 3 个存档点 ✓
         ?mode=ball    指定初始形态(cube/ship/ball/ufo/wave/robot/spider)✓
         ?spd=4        指定速度档 0~4 ✓
       三个开关都【不产生任何界面元素】✓(和你要求的"页面不留东西"不冲突 ✓)*/
    {
      const w = this.world;
      const chks = (w.level.objects as Array<Record<string, unknown>>)
        .filter((o) => o.kind === 'check').sort((a, b) => (a.b as number) - (b.b as number));
      const q = (k: string) => new RegExp('(^|[?&])' + k + '=([^&]+)').exec(location.search);
      const cpQ = q('cp'), fromQ = q('from'), modeQ = q('mode'), spdQ = q('spd');
      let pick: Record<string, unknown> | null = null;
      if (cpQ) pick = chks[Math.max(0, Math.min(chks.length - 1, Number(cpQ[2]) - 1))] ?? null;
      else if (fromQ) {
        const x = Number(fromQ[2]);
        for (const c of chks) if ((c.b as number) <= x) pick = c;
      }
      const mode = (modeQ ? String(modeQ[2]) : 'cube') as Mode;
      if (pick || modeQ || spdQ) {
        const px = pick ? ((pick.b as number) + 0.5) * U : w.x;
        const py = pick ? ((pick.r as number) + 0.5) * U - 15 : w.y;
        w.checkX = px; w.checkY = py; w.checkMode = mode;   // 存档点不记录形态 ⇒ 用 ?mode= 指定的(默认 cube ✓)
        w.checkSpeed = spdQ ? Number(spdQ[2]) : w.speedIdx;
        w.checkGdir = 1; w.checkSize = 1;
        w.reset(px, mode, py);
        w.god = false;
      }
      /* ★ 演示铺:默认【自由移动】(←/→ 或 A/D 走,不按就停 ✓)—— 用户:"demo 做成自由移动,不再固定往前" */
      if (/(^|[?&])level=demo(&|$)/.test(location.search)) w.freeMove = true;
    }
    /* ★ 无敌模式:页面按 G 切;也可以开局就用 URL 打开(?god=1),验收脚本直接改 __gd.world.god */
    this.godWanted = /(^|[?&])god=1(&|$)/.test(location.search);
    this.world.god = false;   /* ★ 2026-09 用户:"把无敌模式直接给我删掉" ⇒ 恒为 false,开关不再生效 */
    /* ?demo=1 —— 开局直接演示"bot 通关"(和按 B / 点右下角按钮等效)
       ?demospeed=4 —— 演示倍速(默认 1 = 正常速度;20086 帧的卷子正常速度播 334.8 秒) */
    if (/(^|[?&])demo=1(&|$)/.test(location.search)) this.demoWanted = true;
    const ds = /(^|[?&])demospeed=([\d.]+)/.exec(location.search);
    if (ds) this.demoSpeed = Math.max(0.25, Math.min(40, Number(ds[2]) || 1));
    /* ?padmul=0.75 —— 弹簧力度微调(和按 [ / ] 等效),验收脚本也能用 URL 指定 */
    const pm = /(^|[?&])padmul=([\d.]+)/.exec(location.search);
    if (pm) { this.padMulWanted = Math.max(0.4, Math.min(1.5, Number(pm[2]) || 1)); this.world.padMul = this.padMulWanted; }
    this.cameras.main.setBackgroundColor('#05070d');
    this.cameras.main.setZoom(this.zoomOf());
    /* ★ 只在【画布上】点才算确认 —— 以前监听 window,点导航、点 CD 面板都会顺手把游戏开起来 */
    this.input.on('pointerdown', () => {
      this.clicked = true;
      /* ★ 把焦点从站内搜索框上拿走:搜索框还留着焦点时,键盘事件都指向它,
         实测就是它让 R / G 按了没反应(点一下画面就恢复正常)。 */
      const ae = document.activeElement as HTMLElement | null;
      if (ae && ae !== document.body) ae.blur();
    });
    /* 空格 / 上 / W 才算"确认",其它按键一概不理(以前任何按键都会开跑);
       数字键 1~7 是调试用的"现场换形态";R 重来、G 无敌。
       ★ 用【捕获阶段】(第三个参数 true)挂:页面里别的 keydown 处理器(搜索框、站内快捷键等)
         一旦 stopPropagation,冒泡阶段我们就收不到了 —— 捕获阶段先于它们运行。
       ★ 不再"焦点在输入框里就不理":用户实测 R/G 没反应,查出来是站内搜索框还留着焦点 ——
         指向输入框的 keydown 我们一样要接。玩之前点一下画面就会把焦点从搜索框上拿走(见下面 pointerdown)。 */
    window.addEventListener('keydown', (ev: KeyboardEvent) => {
      if (ev.code === 'Space' || ev.code === 'ArrowUp' || ev.code === 'KeyW') this.confirmLatch = true;
      /* ★★ 2026-09 用户:"把按键,提示全删掉,按 b 还是有反应" —— B 的处理器就在窗口级监听这里 ✗
         R(重开)/ G(无敌,已停用)/ B(演示·机器人)三个调试入口一并删掉 ✓,只留跳跃键 ✓ */
      void ev;
      /* ★ 弹簧力度微调:以前只认 [ / ](BracketLeft/Right)—— 用户实测"按了没用"
         (不同键盘/输入法下发出来的 code 不一样)。现在把常见的那几对全收进来,
         另外页面上还加了两个能点的按钮(见 lost.html 的 .gd-tools)。 */
      if (ev.code === 'BracketLeft' || ev.code === 'Minus' || ev.code === 'NumpadSubtract' || ev.code === 'Comma') this.padLatch -= 1;
      if (ev.code === 'BracketRight' || ev.code === 'Equal' || ev.code === 'NumpadAdd' || ev.code === 'Period') this.padLatch += 1;
      if (/^Digit[1-7]$/.test(ev.code)) this.modeLatch = Number(ev.code.slice(5));
    }, true);
    /* ★ 再给几个【能点的】按钮:键盘在某些环境里会被别的东西吃掉(用户实测 R/G 没反应),
       按钮用鼠标/触屏都能按,而且状态直接写在按钮上 —— 不用猜到底开没开。 */
    document.getElementById('gd-god')?.addEventListener('click', () => { this.toggleGod(); this.blurSelf(); });
    document.getElementById('gd-demo')?.addEventListener('click', () => { this.demoLatch = true; this.blurSelf(); });
    document.getElementById('gd-restart')?.addEventListener('click', () => { this.restartLatch = true; this.blurSelf(); });
    /* ★ 累加而不是赋值:连点两下按钮/连按两下键时,如果只是 `= 1`,同一帧里的两次会互相覆盖
       (用户会看到"点了没反应/只动一格")。 */
    document.getElementById('gd-pad-minus')?.addEventListener('click', () => { this.padLatch -= 1; this.blurSelf(); });
    document.getElementById('gd-pad-plus')?.addEventListener('click', () => { this.padLatch += 1; this.blurSelf(); });
    /* ★★ 物件贴图(从【游戏本体】抽出来的小图集,见 tools/verify/build-art.mjs):
       static/assets/gd-art.png/json 里只有这一关用得到的 35 帧 —— 锯片/弹簧板/存档点/硬币/刺/跳环/形态门。
       ★ 密度:1 像素 = 1 单位(方块 30 单位 = 30 px),所以画画时 k = 物件高度(单位) / 帧高(px)。
       ★ id → 帧名的映射【不在游戏的数据文件里】(那是编译进 exe 的代码);这里靠"尺寸/颜色/唯一命中"钉,
         每条都在 build-art.mjs 的 MAP 里写了理由。线框(468/469/470)按用户口径不做贴图。 */
    /* ★★★ 2026-09 限高框(限制框)的外观 —— 用户:"没有贴图,我都看不到限高框在哪,我怎么知道生没生效" */
    this.load.image('gd-ground', '/icons/groundSquare_01_001.png?v=' + ART_V);
    if (ART_ENABLED) {
      /* ★★★ 2026-09 换成【官方图集 + 真映射】—— 由 tools/bake-object-atlas.ts 烘出:
           GJ_GameSheet{02}-uhd 两张 uhd 图集 + 38 帧矩形 + 38 条 id→帧名(来自 OpenGD 的 object.json ✓)
         ⇒ 不再用早期"尺寸/颜色/唯一命中"猜出来的自造表 ✗
         注:取帧那一处若仍按旧帧名查,会全部查空 ⇒ 必须先改用本 JSON 的 ids 映射(下一步)✓ */
      /* ★ 2026-09 图集 JSON 加版本尾巴:换图集时浏览器才不会拿旧的(JSON 是运行时抓的,不吃 bundle 的 ?v= ✗) */
      if (!this.textures.exists('gd-art')) this.load.multiatlas('gd-art', '/assets/gd-object-atlas.json?v=' + ART_V, '/icons/');
      this.load.json('gd-art-ids', '/assets/gd-object-atlas.json?v=' + ART_V);
      this.load.once('complete', () => { this.artReady = this.textures.exists('gd-art'); });
      this.load.start();
    }
    /* ★★ 2026-09 用户:"全删掉,页面不留任何东西" ⇒ 除了画布,其它界面元素一律移除 ✓
       (HUD 进度条 / 按键提示 / 五个调试按钮 / 手机提示 / 遮罩 / 底部参考行 —— 全部删掉) */
    for (const sel of ['#gd-hud', '#gd-tools', '#gd-god', '#gd-demo', '#gd-restart', '#gd-pad-minus', '#gd-pad-plus',
                       '.lost-tip', '.gd-tools', '.gd-mobile-note', '.lost-veil', '.lost-wip__ref']) {
      document.querySelectorAll(sel).forEach((el) => el.remove());
    }
    this.loadGuide();                          // ★ 无敌模式的轨道(见 clampToGuide)
    /* ★ 形态图集(static/icons):默认不加载(见上面那段"结论")。?icons=1 才试图集 */
    if (ICON_ENABLED) {
      const q = /(^|[?&])col1=([0-9a-fA-F]{6})/.exec(location.search);
      const q2 = /(^|[?&])col2=([0-9a-fA-F]{6})/.exec(location.search);
      if (q) for (const k of Object.keys(ICON_COL) as Mode[]) ICON_COL[k][0] = parseInt(q[2], 16);
      if (q2) for (const k of Object.keys(ICON_COL) as Mode[]) ICON_COL[k][1] = parseInt(q2[2], 16);
      for (const a of ICON_ATLAS) {
        /* ★★★ 2026-09 修"cube.png 208×252 vs plist 252×244"(用户给的 console 原文):
           服务器上的 cube.png 已经是新的(252×244,fetch 实测 ✓),但浏览器缓存里存着【换图之前】
           那份 208×252 ✗ —— 而 /icons/*.png 这个 URL 没有版本尾巴,于是每次都拿旧的:
           尺寸校验不过 ⇒ cube 那层被跳过 ⇒ cube 没贴图 + 载具驾驶位空 ✓✓
           ⇒ 图标 URL 也带上 ART_V(和 gd-object-atlas.json 一个办法 ✓) */
        this.load.image('iconimg-' + a.file, '/icons/' + a.file + '.png?v=' + ART_V);
        this.load.text('iconxml-' + a.file, '/icons/' + a.file + '.plist?v=' + ART_V);
      }
      /* ★ 机器人/蜘蛛:【UHD 图集】+ 部件动画表(官方 AnimDesc 烘出来的 ✓)
         —— 用 multiatlas 一次加载两张 uhd 图集(JSON 里的 image 字段相对 /icons/ ✓),
            Node 解不了 uhd 的 PNG ✗ ⇒ 交给 Phaser 解 ✓ */
      this.load.multiatlas('gd-parts', '/assets/gd-player-atlas.json', '/icons/');
      this.load.json('gd-parts-anim', '/assets/gd-player-parts.json');
      this.load.once('complete', () => { this.buildIcons(); });
      this.load.start();
    }
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
    /* ★ 形态门挂牌子:光看门框分不出切什么形态(用户:"形态门都是一个样式,我怎么知道这个门是什么")——
       每个门头上挂一块写着形态名的小牌子,底色就是那个形态的颜色。位置每帧跟着门走(见 draw)。
       ★ 重力门同理:方向不同颜色不同(反重力蓝 / 常重力黄),牌子上直接写"反重力↑""重力↓"。 */
    for (const o of LEVEL.objects) {
      let text = '';
      let col = 0xffffff;
      if (o.kind === 'portal' && o.to) {
        const to = o.to as Mode;
        text = MODE_NAME[to] ?? to;
        col = PORTAL_COL[to] ?? 0xffe17a;
      } else if (o.kind === 'gravity') {
        const up = (o.gdir ?? 1) < 0;
        text = up ? '反重力↑' : '重力↓';
        col = up ? 0x6fc3ff : 0xffd166;
      } else continue;
      const t = this.add.text(0, 0, text, {
        fontFamily: 'ui-monospace, Consolas, monospace',
        fontSize: '16px',
        color: '#05070d',
        backgroundColor: '#' + col.toString(16).padStart(6, '0'),
        padding: { x: 4, y: 1 },
      });
      t.setOrigin(0.5, 1).setDepth(18).setAlpha(0.95).setVisible(false);   // ★ 用户:"门上面的文字去掉" ✓
      this.portalLabels.push({ o, t });
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
    /* 无敌模式开关:G 键(边沿触发)。切换时给一次提示,好确认到底开没开。 */
    const gEdge = (!!k.G?.isDown && !this.prevG) || this.godLatch;
    this.prevG = !!k.G?.isDown;
    this.godLatch = false;
    if (gEdge) this.toggleGod();
    /* B 键 / ?demo=1:看 bot 通关 */
    if (this.demoLatch || this.demoWanted) {
      this.demoLatch = false;
      this.demoWanted = false;
      this.toggleDemo();
    }
    /* ★ 弹簧力度微调:[ 减 5%、] 加 5%(0.4 ~ 1.5)。蓝跳点到底该多大还没定死,
       让用户直接把数值调到手感对,比我们反复猜省事 —— HUD 上会显示"跳点×N"。
       ★ 走和 G/R 同一条路(真实 keydown 事件 + latch):Phaser 的 addKeys('OPEN_BRACKET')
       实测收不到(按 ] 有效、按 [ 无效),别在这上面浪费时间。 */
    if (this.padLatch) {
      this.padMulWanted = Math.round(Math.max(0.4, Math.min(1.5,
        this.padMulWanted + Math.sign(this.padLatch) * 0.05 * Math.min(4, Math.abs(this.padLatch)))) * 100) / 100;
      this.world.padMul = this.padMulWanted;
      this.padLatch = 0;
    }
    if (this.confirmLatch) { this.confirmLatch = false; this.clicked = false; return true; }
    if (edge) { this.clicked = false; return true; }
    if (this.clicked) { this.clicked = false; return true; }
    return false;
  }

  /** 无敌开关:键盘 G 和屏幕右下角那个按钮都走这里(状态写在按钮上,不用猜开没开) */
  toggleGod() {
    this.godWanted = !this.godWanted;
    this.world.god = false;   /* ★ 2026-09 用户:"把无敌模式直接给我删掉" ⇒ 恒为 false,开关不再生效 */
    this.syncGodButton();
  }

  /** 按钮点完把焦点还回去 —— 不然按钮留着焦点,按空格会当成"再点一次这个按钮"(HTML 默认行为) */
  private blurSelf() {
    const ae = document.activeElement as HTMLElement | null;
    if (ae && ae !== document.body) ae.blur();
  }

  private godBtnEl: HTMLElement | null = null;
  private godBtnTxt = '';

  /** 演示按钮上的字:没下好 / 下失败 / 开了 / 关了 —— 状态写在按钮上,不用猜 */
  syncDemoButton() {
    if (!this.demoBtnEl) this.demoBtnEl = document.getElementById('gd-demo');
    const el = this.demoBtnEl;
    if (!el) return;
    const txt = this.demoMode
      ? (this.demoTape ? '演示:开 ×' + this.demoSpeed.toFixed(2).replace(/\.?0+$/, '') : this.demoErr ? '演示:卷子加载失败' : '演示:载入中…')
      : '看 bot 通关';
    if (txt === this.demoBtnTxt) return;
    this.demoBtnTxt = txt;
    el.textContent = txt;
    el.classList.toggle('is-on', this.demoMode);
  }
  private demoBtnEl: HTMLElement | null = null;
  private demoBtnTxt = '';

  private syncGodButton() {
    if (!this.godBtnEl) this.godBtnEl = document.getElementById('gd-god');
    const el = this.godBtnEl;
    if (!el) return;
    const txt = this.world.god ? '无敌:开' : '无敌:关';
    if (txt === this.godBtnTxt) return;              // 只在变了的时候写 DOM
    this.godBtnTxt = txt;
    el.textContent = txt;
    el.classList.toggle('is-on', this.world.god);
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
  /** 渲染缓冲的高度(buffer 像素);zoom = viewH / (11 格 × 30 单位) */
  viewH = 720;
  /** 渲染缓冲的宽度:★ 必须由【盒子的长宽比】推出来。
   *  以前固定 1280(CSS 再拉伸到盒子上),而盒子(显示器透明窗口)根本不是 16:9 ——
   *  实测 1440×900 时是 1.80:1、用户那块屏上更宽,于是水平被拉长、垂直被压扁,
   *  **方块看着就是长方体而不是正方体**(用户实测)。缓冲和盒子同比例 → 拉伸是等比的。 */
  bufW = 1280;
  /** 这一帧真正画出来的物件数(HUD 用;帧率不对时先看它) */
  drawn = 0;
  private fracT = 0;

  private measureFrac() {
    const cv = document.getElementById('gd-canvas') as HTMLCanvasElement | null;
    const r = cv?.getBoundingClientRect();
    if (!cv || !r || r.height <= 0 || r.width <= 0) {
      this.viewFrac = 1; this.viewTop = 0; this.viewH = 720; this.bufW = 1280; return;
    }
    this.viewH = Math.round(720 * RENDER_SCALE);
    let w = Math.round(this.viewH * (r.width / r.height));
    /* ★ 像素预算:盒子越宽,缓冲就越宽(比例必须跟着盒子,不然方块会变长方形)。
       但盒子可能非常宽 —— 那就整体缩一档(等比缩,比例不变),别让填充率拖垮帧率。 */
    const px = w * this.viewH;
    if (px > BUF_BUDGET) {
      const k = Math.sqrt(BUF_BUDGET / px);
      this.viewH = Math.max(240, Math.round(this.viewH * k));
      w = Math.max(320, Math.round(w * k));
    }
    this.bufW = Math.max(320, w);
    this.viewFrac = 1;
    this.viewTop = 0;
  }

  /** 可见宽度 = 由 VIEW_H_BLOCKS 与画幅比例决定;取景框只覆盖"露出来的那一条" */
  zoomOf() {
    return this.viewH / (VIEW_H_BLOCKS * U);
  }

  /** 图集加载完:每个形态挑出【第 1 组主图 + 同组发光层】,把 plist 里"躺着的"帧转正后
   *  画进两张离屏 canvas(一主一发光),再注册成 Phaser 贴图。
   *  ★ 不再按帧号轮播:GD 的玩家图集是按部件拆的(蜘蛛 02/03/04 是腿等部件,画布尺寸还不一样),
   *    没有部件合成表就轮播 = 一会儿只有腿一会儿只有眼睛(用户报的"贴图是乱的")。 */
  /** ★★★ TODO(下一步,数据已全部就位 —— 只差这段实现):
   *  robot / spider 的图标 = 【按官方部件表摆多个 sprite】(不是合成一张画布 ✗)
   *
   *  数据:static/assets/gd-player-parts.json(由 tools/bake-player-parts.ts 从官方
   *        Resources/Robot_AnimDesc.plist · Spider_AnimDesc.plist 烘出)
   *     robot : 7 个部件(4 个唯一贴图)   spider: 6 个部件(4 个唯一贴图)
   *     每个部件 = { tex, x, y, sx, sy, z }
   *  贴图:static/icons/part-<mode>-<frame>.png(由 tools/slice-parts.ts 切好,8 张 ✓)
   *
   *  坐标:部件尺寸 5~28 px、position ±7.5 ⇒ 与世界单位 1:1(方块 30 单位)⇒ 直接用,零换算 ✓
   *  画法:for (每个部件,按 z 升序) sprite.setPosition(cxw + x, cyw - y).setDisplaySize(w, h)
   *        —— y 取反是因为世界坐标 y 向上、屏幕 y 向下 ✓
   *  验收:robot 应有躯干(带眼)+ 两节腿 + 脚;spider 应有身体 + 腿 ✓
   */
  private buildIcons() {
    const REF_PX = 120;                       // GD 玩家图集的密度:1 块 = 120 px(方块主图就是 120×120)
    for (const a of ICON_ATLAS) {
      const img = this.textures.exists('iconimg-' + a.file)
        ? (this.textures.get('iconimg-' + a.file).getSourceImage() as HTMLImageElement) : null;
      const xml = this.cache.text.get('iconxml-' + a.file) as string | undefined;
      if (!img || !xml) continue;
      /* ★ 文件错配检查(实测这套素材里 cube 与 GameSheet 就是错的):
         plist 里的 metadata.size 声明了它描述的那张图集有多大 —— 和真实 png 对不上就【不要用】,
         否则帧坐标全错位(画出来就是一堆错位的碎片)。 */
      const meta = /<key>size<\/key>\s*<string>\{([\d.]+),([\d.]+)\}<\/string>/.exec(xml);
      if (meta && (Math.abs(+meta[1] - img.naturalWidth) > 1 || Math.abs(+meta[2] - img.naturalHeight) > 1)) {
        console.warn('[gd] 图集与 plist 尺寸对不上,跳过:' + a.file + '.png ' + img.naturalWidth + '×' + img.naturalHeight
          + ' vs plist 声明 ' + meta[1] + '×' + meta[2]);
        continue;
      }
      const F = parsePlistFrames(xml);
      if (!F) continue;
      /* ★★★ 2026-09 修"UFO/robot 贴图全错乱"(用户实测):
         原来是取【未裁剪尺寸最大】的那一帧当主图 ✗ —— 而图集里同一个形态有多个变体:
             cube  : player_348_001 / _2_001 / _extra_001 / _glow_001
             bird  : bird_109_001 / _2_ / _3_ / _extra_
             robot : robot_01_01_001 / robot_01_02_001 / …     ← 01_02 是【另一个图标】✗
             spider: spider_13_01_001 / _2_ / _extra_ / _glow_
         "取最大"会挑到 _extra_ / 其它序号 ⇒ 画出来就是错的/拼在一起 ✓✓
         ⇒ 改成【按名字取基础帧】:排除 _2_/_3_/_extra_/_glow_,再按名字字典序取第一个
           (基础帧名字最短、序号最小 ⇒ 就是 001 那一张 ✓) */
      const mains = Object.keys(F).filter((n) => !/_2_|_3_|_extra_|_glow_/.test(n));
      if (!mains.length) continue;
      const name = mains.slice().sort((p, q) => p.localeCompare(q))[0];
      const glowName = name.replace(/_(\d+)\.png$/, '_glow_$1.png');
      const made: Array<{ layer: 'body' | 'glow'; tex: string; w: number; h: number }> = [];
      /* ★★★ 2026-09 多层拼装(修用户报的"robot 没腿 / spider 看不出是什么"):
         GD 的玩家图标是【身体 + _2_ + _3_ 部件】叠出来的 ——
             robot : robot_01_01_001(身体)+ robot_01_01_2_001(腿)
             spider: spider_13_01_001 + spider_13_01_2_001(腿)
             bird  : bird_109_001 + _2_ + _3_(翼)
         我们以前只画第 1 层 ✗ ⇒ robot/spider 缺腿 ✓✓
         ⇒ 现在把同一图标的 _2_ / _3_ 层按顺序叠到同一张画布上,每层用自己的 spriteSourceSize 定位 ✓
         (_glow_ 依旧不画 ✓;_extra_ 是额外素材,不叠 ✓) */
      /* ★★★ 2026-09 照源码定论(用户:"能不能照搬源码,不要给我瞎写"):
         我在 IDA 里找到了玩家图标的真正组装者 ——
             PlayerObject::createRobot (IDA 141642)  +  GJRobotSprite::create   ← 机器人【腿】是独立 sprite 类
             PlayerObject::createSpider(IDA 141739)  +  GJSpiderSprite::create  ← 蜘蛛【腿】同理
             headers: GJRobotSprite.h / GJSpiderSprite.h(都是 CCAnimatedSprite 子类 ✓)
         而对象侧的 sub_346540(..., "_001.png", "_2_001.png")(IDA 171816)说明:
             `_2_` 后缀是【第二帧 / 动画帧】,不是"第二层部件" ✗✓
         ⇒ 我前面两版"把 _2_ 当腿叠上去"是【原理就错了】✗✗ —— 腿根本不在玩家图集里,
           而在 GJRobotSprite / GJSpiderSprite 这两套【独立动画 sprite】里 ✓
         ⇒ 先回到【只画基础帧】(不再破坏其它形态 ✓);要还原腿必须:
             ① 找到 GJRobotSprite/GJSpiderSprite 的贴图(可能在 GameSheet 里,或在别的 sheet ✗)
             ② 按 createRobot / createSpider 的摆位抄 ✓ */
      /* ★★★ 2026-09 用户:"ball,bird,dart,spider,ship 等在原版有一个限制框,这个没有还原出来"
         —— 官方图标图集里每个形态是【四层】:主体(_001)+ 第二色(_2_)+ 描边/框(_extra_)+ 发光(_glow_)
            (实测 cube/ship/ball/bird/dart/spider 六套里 _extra_ 全都在 ✓)
         我们以前【只叠主体】✗ ⇒ 少了那圈"框" ✓ ⇒ 现在把 _extra_ 一起叠进来 ✓(_glow_ 照旧不叠 ✓) */
      const layerNames = [name, name.replace(/_(\d+)\.png$/, '_extra_$1.png')].filter((n) => !!F[n]);
      {
        const base = F[name];
        /* 画布尺寸 = 各层 内容尺寸 + 2×|偏移| 的最大值(保证都放得下 ✓) */
        let W = 4, H = 4;
        for (const ln of layerNames) {
          const fr = F[ln];
          if (!fr) continue;
          const tw = fr.rotated ? fr.frame.h : fr.frame.w;
          const th = fr.rotated ? fr.frame.w : fr.frame.h;
          W = Math.max(W, Math.round(tw + 2 * Math.abs(fr.spriteSourceSize.x)) + 2);
          H = Math.max(H, Math.round(th + 2 * Math.abs(fr.spriteSourceSize.y)) + 2);
        }
        const cv = document.createElement('canvas');
        cv.width = W; cv.height = H;
        const c2 = cv.getContext('2d');
        if (!c2) continue;
        for (const ln of layerNames) {
          const fr = F[ln];
          if (!fr) continue;
          const sw = fr.rotated ? fr.frame.h : fr.frame.w;      // 图集里的实际区域(旋转帧宽高互换)
          const sh = fr.rotated ? fr.frame.w : fr.frame.h;
          const tw = fr.frame.w, th = fr.frame.h;               // 转正后的显示尺寸
          /* ★ 关键:层中心 = 画布中心 + 该层自己的偏移(y 轴向下为正在 canvas 里就是负 ✓) */
          const cx = W / 2 + fr.spriteSourceSize.x;
          const cy = H / 2 - fr.spriteSourceSize.y;
          c2.save();
          c2.translate(cx, cy);
          if (fr.rotated) c2.rotate(-Math.PI / 2);
          c2.drawImage(img, fr.frame.x, fr.frame.y, sw, sh, -tw / 2, -th / 2, tw, th);
          c2.restore();
        }
        const tex = 'icon-' + a.file + '-body';
        if (this.textures.exists(tex)) this.textures.remove(tex);
        this.textures.addCanvas(tex, cv);
        made.push({ layer: 'body', tex, w: W, h: H });
      }
      {
        const base = F[name];
        const W = Math.max(4, Math.round(base.sourceSize.w)), H = Math.max(4, Math.round(base.sourceSize.h));
        const cv = document.createElement('canvas');
        cv.width = W; cv.height = H;
        const c2 = cv.getContext('2d');
        if (!c2) continue;
        for (const ln of layerNames) {
          const fr = F[ln];
          if (!fr) continue;
          /* 图集里的实际区域:rotated 的帧宽高是【互换】的,而且内容是躺着的 */
          const sw = fr.rotated ? fr.frame.h : fr.frame.w;
          const sh = fr.rotated ? fr.frame.w : fr.frame.h;
          const tw = fr.frame.w, th = fr.frame.h;                     // 转正之后的显示尺寸
          /* 未裁剪画布里的位置:中心 = 画布中心 + spriteOffset(y 轴和画布相反) */
          const dx = W / 2 + fr.spriteSourceSize.x - tw / 2;
          const dy = H / 2 - fr.spriteSourceSize.y - th / 2;
          c2.save();
          c2.translate(dx + tw / 2, dy + th / 2);
          if (fr.rotated) c2.rotate(-Math.PI / 2);                    // 实测:-90° 才是正的
          c2.drawImage(img, fr.frame.x, fr.frame.y, sw, sh, -tw / 2, -th / 2, tw, th);
          c2.restore();
        }
        const tex = 'icon-' + a.file + '-body';
        if (this.textures.exists(tex)) this.textures.remove(tex);
        this.textures.addCanvas(tex, cv);
        made.push({ layer: 'body', tex, w: W, h: H });
      }
      /* ★★★ 2026-09 用户:"贴图为什么我感觉就上色了一半,是不是还有一半青色没有上" —— 正是 ✓
         官方图标是【两层颜色】:主体层(_001)用玩家色 1、第二色层(_2_)用玩家色 2 ✓
         我们以前只叠主体 ⇒ 第二色那一半(本关是青色 1006)根本没画 ✗
         ⇒ 再把 _2_ 层单独烘一张画布,挂在图层的 glow 槽上(glow 现在不画,槽位空着 ✓),
            位置/旋转/尺寸跟着主体走,只是染成玩家色 2 ✓ */
      {
        const n2 = name.replace(/_(\d+)\.png$/, '_2_$1.png');
        const base = F[name];
        const f2 = F[n2];
        if (f2 && base) {
          const W = Math.max(4, Math.round(base.sourceSize.w)), H = Math.max(4, Math.round(base.sourceSize.h));
          const cv = document.createElement('canvas');
          cv.width = W; cv.height = H;
          const c2 = cv.getContext('2d');
          if (c2) {
            const sw = f2.rotated ? f2.frame.h : f2.frame.w;
            const sh = f2.rotated ? f2.frame.w : f2.frame.h;
            const tw = f2.frame.w, th = f2.frame.h;
            const dx = W / 2 + f2.spriteSourceSize.x - tw / 2;
            const dy = H / 2 - f2.spriteSourceSize.y - th / 2;
            c2.save();
            c2.translate(dx + tw / 2, dy + th / 2);
            if (f2.rotated) c2.rotate(-Math.PI / 2);
            c2.drawImage(img, f2.frame.x, f2.frame.y, sw, sh, -tw / 2, -th / 2, tw, th);
            c2.restore();
            const tex2 = 'icon-' + a.file + '-c2';
            if (this.textures.exists(tex2)) this.textures.remove(tex2);
            this.textures.addCanvas(tex2, cv);
            made.push({ layer: 'glow', tex: tex2, w: W, h: H });
          }
        }
      }
      const body = made.find((m) => m.layer === 'body');
      if (!body) continue;
      const glow = made.find((m) => m.layer === 'glow');
      this.iconLayers.push({
        mode: a.mode,
        body: this.add.image(0, 0, body.tex).setVisible(false).setDepth(16),
        /* ★★★ 2026-09 修"贴图变成纯青"(用户实测):我把第二色层画到了主体【上面】✗,
           而官方图标是【第二色(内芯)在下、主体(外框)在上】——
           主体层自己的内部是透空的,内芯从下面透出来才是原版那个样子 ✓
           ⇒ 第二色层的深度放到主体【下面】(主体 16 ⇒ 内芯 15.5)✓ */
        glow: glow ? this.add.image(0, 0, glow.tex).setVisible(false).setDepth(15.5) : null,
        bw: body.w, bh: body.h,
        pxPerUnit: REF_PX / (WATER_CHART.start ? 30 : 30),          // 见 REF_PX:120 px = 1 块 = 30 单位
      });
    }
    /* ★★★ 2026-09 修"还是卡死,问题是 UFO 里面的 cube"(用户定位)—— 我上一轮是【在渲染途中】
       this.add.image 建 pilot ✗:那是在 display list 被遍历的时候往里塞对象 ⇒ 卡死 ✓✓
       ⇒ 改成在这里(图集构建完、渲染还没开始)就把它建好,绘制时只改位置/尺寸/颜色 ✓ */
    if (this.textures.exists('icon-cube-body')) {
      /* ★★★ 2026-09 用户:"继续修UFO的cube" —— 探针实测驾驶位 cube 的 depth=16.5 >
         载具本体 16 / 第二色层 15.5 ⇒ 【cube 画在 UFO 上面】✗
         原版是反的:cube 是玩家本体、UFO/飞船是【坐在外面的载具】,载具压在本体上面
         (座舱盖住 cube 的上半,只露出下面一截 ✓)⇒ 驾驶位必须排在载具两层【之下】✓ */
      this.pilot = this.add.image(0, 0, 'icon-cube-body').setVisible(false).setDepth(15);
    }
    this.iconsReady = this.iconLayers.length > 0;
    console.log('[gd] 形态图集就绪:' + this.iconLayers.map((l) => l.mode + '(' + l.bw + '×' + l.bh + ')').join(' '));
  }

  /** 用图集摆玩家:位置/尺寸/旋转/上色。
   *  ★ 尺寸用统一密度(120 px = 1 块),不是"每层各自撑满 1 格" —— 后者会把小腿/描边放大到和身体一样大。 */
  private drawIconPlayer(w: World, cxw: number, cyw: number, B: number) {
    /* ★★ 2026-09 用户:"cube 的贴图变成 ship 的贴图了" —— 就是这一行的 ?? 兜底 ✗
       cube 的图集因为尺寸不符被跳过 ⇒ find() 拿不到 ⇒ 于是【借用了第 0 层】(别的形态)✗✓
       改成:拿不到就【没有图层】⇒ 上层会走矢量画法 ✓(绝不借用别的形态 ✗) */
    const L = this.iconLayers.find((l) => l.mode === w.mode);
    if (!L) return;
    const on = !w.done;
    for (const l of this.iconLayers) {
      const vis = on && l === L;
      l.body.setVisible(vis);
      l.glow?.setVisible(vis);
    }
    let rot = 0;
    if (w.mode === 'cube') {
      /* ★★★ 2026-09 找到"改了半天完全没变化"的真凶:【玩家是这条路径画的】✓
         `if (this.iconsReady) this.drawIconPlayer(...)` —— 页面里图集是就绪的 ✓,
         所以矢量那一条(我之前十几轮改的地方)【根本不执行】✗✓✓;
         而这条里的 `w.onGround ? 0` 就是"落地突兀回正"的来源 ✓✓。
         现在:直接读状态机算好的角度(在帧循环里更新,和走哪条绘制路径无关 ✓) */
      rot = this.spinLast;
    } else if (w.mode === 'ship') {
      rot = Math.max(-0.55, Math.min(0.55, w.vy / P.shipVyMax * 0.55));
    } else if (w.mode === 'ball') {
      rot = (w.x / U) * 1.2;
    } else if (w.mode === 'wave') {
      /* ★ 2026-09 角度表暴露的问题:原来 vy==0 时也画成 +45° ✗(落地/水平时应该是平的)✓ */
      rot = w.onGround ? 0 : (w.vy >= 0 ? 1 : -1) * Math.PI / 4;
    } else if (w.mode === 'ufo') {
      rot = Math.max(-0.3, Math.min(0.3, w.vy / P.flyUpMax * 0.3));
    }
    const k = B / (L.pxPerUnit * 30);                     // 120 px = 30 单位 → k = B/120
    L.body.setPosition(cxw, cyw).setRotation(rot);
    /* ★★★ 2026-09 用户:"玩家贴图没有上色,有点诡异" —— 上色 ✓
       官方图标美术是白/灰底,GD 用玩家颜色染:主体 = 玩家色 1、框/第二色(_extra_/_2_) = 玩家色 2 ✓
       (我们目前把主体与 _extra_ 合成在一张画布上 ⇒ 整体染玩家色 1,框会跟着主体同色;
        要完全照原版得拆成两张画布分别染 —— 已记进待办 ✓) */
    L.body.setTint(w.dead ? 0xff7a5a : PLAYER_C1);
    /* ★★★ 2026-09 用户:"反转重力方向时,贴图也要反转" —— 重力反了就上下翻 ✓
       (原版 flipGravity 之后飞机/球/UFO/浪/蜘蛛的贴图整个是倒的 ✓) */
    L.body.setFlipY(w.gdir < 0);
    /* ★★★ 2026-09 第二色层(用户:"是不是还有一半青色没有上"):跟着主体走,染玩家色 2 ✓ */
    if (L.glow) {
      L.glow.setVisible(on).setPosition(cxw, cyw).setRotation(rot).setFlipY(w.gdir < 0)
        .setTint(w.dead ? 0xff7a5a : PLAYER_C2).setDisplaySize(L.bw * k, L.bh * k);
    }
    L.body.setDisplaySize(L.bw * k, L.bh * k);
    /* ★★ 2026-09 用户:"原本贴图就只是一个透明的框" ⇒ 去掉 glow 层(不再叠一层发光)✗
       (buildIcons 那边也随之不再需要 glow,但这里先彻底不画 ✓ —— 两层叠着就是"拼到一起" ✓) */
    /* ★★★ 2026-09 修"cube 还是只有一种颜色":下面这行(上一版留下的)把我刚画的第二色层又关了 ✗✗
       它当时的理由是"不要叠发光",但那个槽位现在放的是【第二色层 _2_】,不是发光 ✓ */
    // if (L.glow) L.glow.setVisible(false);   // ✗ 删掉:第二色层要用
  }

  /** 推进 n 帧模拟(输入按当前模式取:演示卷 / 机器人 / 键盘) */
  pump(n: number) {
    /* ★★ 卷子还没下好就别推进(2026-09 修):演示的输入是 `tape[tick]`,
       而 `loadTape()` 是异步 fetch —— 以前这中间会照常推进,于是**开头几十上百帧是"没有输入"在跑**,
       等卷子到了,人和卷子已经错位,必然在 x≈100 前后摔死、然后无限重来。
       用户报的"只播放了几秒就结束了"就有它一份;而且它取决于网速/页面加载快慢,是典型的竞态。
       现在:没卷子就不动(按钮上显示"载入中…"),卷子到了再由 loadTape 从头开一局。 */
    /* ★★ 2026-09 用户:"自动播放也给我删掉" ⇒ 演示卷/机器人输入每帧强制关闭,入口(键/URL)都不再生效 ✓
       (原来是:if (this.demoMode && !this.demoTape) return; —— 演示/机器人输入会接管按键 ✗) */
    this.demoMode = false;
    this.botMode = false;
    this.demoTape = [];
    for (let i = 0; i < n; i++) {
      const w0 = this.world;
      if (w0.dead) {
        /* ★ 验收用:把"哪一帧、在哪死的"记下来 —— 演示卷在 Node 侧是 0 死亡,
           页面上要是有死亡,必须能一眼看出是哪一帧/哪个位置(只有一个次数根本查不动)。 */
        if (this.deathLog.length < 20) {
          this.deathLog.push({ tick: w0.tick, x: +(w0.x / U).toFixed(2), y: +(w0.y / U).toFixed(2), vy: +(w0.vy / U).toFixed(2), mode: w0.mode, gdir: w0.gdir, chunk: n, at: i, hold: this.demoHold(w0.tick) });
        }
        if (this.botMode || this.demoMode) {
          /* ★ 演示卷【死了一次】= 它和当前物理已经不是一套了(卷子是按某一版物理搜出来的)。
             以前会静默复活、无限重来(用户看到的"演示几秒就结束/闪一下")——
             现在直接判定"卷子过期"并退出演示,按钮上写清楚,别装作还能跑。 */
          if (this.demoMode) {
            this.demoErr = '演示卷已过期(物理更新过,等重新打包)';
            this.demoMode = false;
            this.phase = 'idle';
            this.pauseMusic();
            this.syncDemoButton();
            return;
          }
          /* 机器人验收:立刻复活,和 Node 侧一致 */
          const wasX = w0.checkX;
          w0.respawn();
          this.baseTick = Math.floor(this.tAtX(wasX) * 60);
          this.airT = 0;
        } else {
          this.phase = 'dead';                  // 真人:停下来出死亡界面,不再自动复活
          this.deathT = 0;
          this.pauseMusic();
          return;
        }
      }
      /* 输入来源:演示卷按 tick 取(那卷输入是从 tick=0 全程录的),
         否则反应式机器人,否则键盘。 */
      /* ★★ 短按丢失的修复(2026-09,用户报"空格有时候失效"+"跳环按了没用"其实是同一条):
         键盘这条路原来【只看 isDown 轮询】—— keydown/keyup 落在两次轮询之间的一下会被整帧丢掉 ✗,
         而跳环要求"在环里的那一帧有新按下",丢一拍就是完全没反应 ✗。
         confirmLatch 是真实 keydown 记下来的(上面注释写着"极短的一下也收得到"),现在接进来:
         本帧第一个物理帧吃掉它并立刻清掉 ⇒ 追赶帧不会把它当成"一直按住" ✓ */
      const useLatch = this.confirmLatch;
      this.confirmLatch = false;
      const hold = this.demoMode ? this.demoHold(w0.tick)
        : this.botMode ? botThink(w0)
          : (!!(this.keys.SPACE?.isDown || this.keys.UP?.isDown || this.keys.W?.isDown) || useLatch);
      if ((this.botMode || this.demoMode) && !this.botStarted) {       // 开机器人 = 从干净的一局开始,方便和 Node 侧对指纹
        this.botStarted = true;
        this.started = true;
        this.world = new World(LEVEL);
        this.world.god = false;   /* ★ 2026-09 用户:"把无敌模式直接给我删掉" ⇒ 恒为 false,开关不再生效 */
        this.world.padMul = this.padMulWanted;
        this.botStates = [];
        this.fp = '';
        this.prevY = 0;
        this.airT = 0;
        this.baseTick = 0;
        continue;
      }
      this.prevY = w0.y;
      w0.frame(hold);
      /* ★ 无敌模式的"轨道上限":开着无敌时不许飞离规划走廊(见 clampToGuide) */
      this.clampToGuide();
      this.airT = w0.onGround ? 0 : this.airT + 1 / 60;
      /* ★★ 2026-09 演示铺自由移动(用户:"还是不能自由移动,固定向右"):
         上一版只在启动时给【当时的那个 world】设了 freeMove ✗ —— 而世界会被重建(复活/切铺),
         新世界又变回 false ⇒ 表现就是"固定向右" ✓✓
         ⇒ 改成【每帧】对着当前世界强制打开(check 一次正则,开销可忽略 ✓)*/
      if (/(^|[?&])level=demo(&|$)/.test(location.search)) w0.freeMove = true;
      if (w0.freeMove) {
        const k = this.keys;
        const right = !!(k.RIGHT?.isDown || k.D?.isDown);
        const left = !!(k.LEFT?.isDown || k.A?.isDown);
        w0.freeDir = (right ? 1 : 0) - (left ? 1 : 0);
      }
      /* ★★ 2026-09 照源码抄的方块自转(PlayerObject::updateRotation,IDA 144749 / 144846):
           · 目标角:空中时 = 当前角 + 180°(源码 v85 = getRotation + 180 ✓)⇒ 目标永远在前面 180°,
             所以【一直在转】✓,落地则由下面的"最近 90°"接管 ✓
           · 插值:朝目标做 Slerp 缓动,每帧步长有上限 = 该字段 × 0.175 × dt
             (源码 v7 = v3[505] × 0.175;v3[505] 是速度量 ⇒ 速度档越高转得越快 ✓)
           · 落地:目标换成 convertToClosestRotation(0) = 最近的 90° 倍数
             (源码 144846 那两个重载里就是这么调的 ✓)⇒ 落地收平是【缓动】,不是瞬跳、也不是回正到 0 ✓
         这次一个自创常数都没有:180° 和 0.175 都是源码里的 ✓,唯一的换算用本档速度归一化 ✓ */
      if (w0.mode === 'cube') {
        /* ★★★ 2026-09 用户:"cube 的旋转力度太大,照搬原版的旋转机制"
           原版出处:PlayerObject::runNormalRotation(反编译 144512-144542 行)——
             角速度是【常数】:ω(度/秒) = 180 × (速度因子 this+589) × a3 ÷ v7
               v7 = 0.33333(当 this+504 == 1.0 时 0.43333),a3 = 1.0(从 runRotateAction 传 1.0)
               符号:v6 = -1(重力反时)再乘 reverseMod/flipMod(±1)
             ⇒ 基准 = 180 ÷ 0.33333 = **540 度/秒**(一圈 2/3 秒),是【匀速积分】✓
           我们以前是【朝"当前角 + 180°"做指数缓动、步长 0.175×速度】✗ ——
             目标永远在前面 180° ⇒ 一直追、一上来就猛转 ⇒ 正是"力度太大" ✓✓
           ⇒ 现在改成按源码常数匀速转 ✓(重力反了反向:源码那个 v6 = -1 ✓)
           落地收平那段【没动】:原版是 stopRotation(_, 22),那个 22 的口径我还没核,
             而现在的收平手感是你之前定过的("不再回正")⇒ 只改空中的转速这一个变量 ✓ */
        if (w0.onGround) {
          const step = Math.min(1, (0.175 * Math.max(0.5, Math.abs(w0.vx) / 5.7700018)) / Math.max(1, n));
          const near = Math.round(this.spinLast / (Math.PI / 2)) * (Math.PI / 2);   // 最近的 90° 倍数
          this.spinLast += (near - this.spinLast) * step;
        } else {
          const RAD_PER_SEC = (180 / 0.33333) * (Math.PI / 180);      // 540°/s = 源码常数 ✓
          const dir = w0.gdir < 0 ? 1 : -1;                           // 重力反 ⇒ 反向 ✓
          this.spinLast += dir * RAD_PER_SEC * (n / 60);              // 一帧 n 个子步 = n/60 秒 ✓
        }
      } else {
        this.spinLast = 0;
      }
      if (this.botMode) {
        this.botStates.push(w0.state);
        if (w0.done && !this.fp) this.fp = fingerprint(this.botStates);
      }
      if (w0.done) {
        if (this.demoMode) {
          /* 演示跑完 = 通关:停在这一帧,让"通关"两个字留在 HUD 上(R 可以重看) */
          this.demoEndX = w0.x;
          this.phase = 'done';
          this.deathT = 0;
          this.pauseMusic();
          break;
        }
        if (!this.botMode) { this.phase = 'poem'; this.poemT = 0; this.egg = false; this.pauseMusic(); }
        break;
      }
    }
  }

  /** 演示卷:第 tick 帧按不按。卷子比模拟短就一律松手(不该发生,但别越界) */
  private demoHold(tick: number): boolean {
    const t = this.demoTape;
    return !!t && tick >= 0 && tick < t.length && t[tick];
  }

  /** 开/关【看 bot 通关】。开的时候如果卷子还没下载,先去下载(懒加载:平时不占带宽) */
  toggleDemo() {
    this.demoMode = !this.demoMode;
    if (this.demoMode) {
      this.loadTape();
      this.world = new World(LEVEL);
      this.world.god = false;   /* ★ 2026-09 用户:"把无敌模式直接给我删掉" ⇒ 恒为 false,开关不再生效 */
      this.world.padMul = this.padMulWanted;
      this.botStarted = false;
      this.botStates = [];
      this.fp = '';
      this.phase = 'running';
      this.started = true;
      this.baseTick = 0;
      this.prevY = 0;
      this.airT = 0;
      this.camInit = false;
      this.playMusicAt(0);
    } else {
      this.demoErr = '';
      this.restartFromZero();
    }
    this.syncDemoButton();
  }

  /** 下载并解码通关输入卷(RLE → 每帧一个 bool) */
  private loadTape() {
    if (this.demoTried) return;
    this.demoTried = true;
    const url = (window as unknown as { __GD_TAPE?: string }).__GD_TAPE ?? '/assets/gd-tape.json';
    fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
      .then((j: { first: boolean; rle: number[] }) => {
        const out: boolean[] = [];
        let cur = j.first;
        for (const n of j.rle) { for (let i = 0; i < n; i++) out.push(cur); cur = !cur; }
        this.demoTape = out;
        this.demoLoaded = true;
        /* ★ 卷子到了就从干净的一局重开 —— 这样"第一个输入一定是 tape[0]"(见 pump 开头那条守卫) */
        if (this.demoMode) this.restartRun();
      })
      .catch((e: Error) => { this.demoErr = e.message; });
  }

  update(_t: number, dtMs: number) {
    this.updates++;
    this.lastDt = Number.isFinite(dtMs) ? dtMs : -1;      // 验收要看:Phaser 到底喂进来什么
    this.expose();
    this.fps = this.game.loop.actualFps;
    this.paintHud();
    /* 确认键每帧只读一次(边沿判定要按帧消费) */
    const confirm = this.confirmDown();
    const restart = this.restartPressed;
    /* ★ R 优先于一切:任何阶段、任何模式都先处理重来(以前演示模式把 phase 强行掰回 running,
       'done' 那一支永远走不到 → "R 是摆设")。 */
    if (restart) this.restartRun();
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

    if (this.botMode || this.demoMode) {
      /* 演示:按【真实时间】推进(见 demoSpeed 的说明)。一帧渲染最多推 240 帧,防止切标签页回来爆帧。
         内置机器人验收(botMode)固定 8 倍速:它只是用来和 Node 侧对指纹,不需要人看。
         ★ 时间用 performance.now() 自己量,不用 Phaser 的 delta —— 实测 Phaser 的 delta 是"平滑过"的,
           183 次 update/6 秒(墙上 33ms 一次)却只累出 5.5 秒,演示会慢 25%(用户报的"倍速不对"就有它一份)。 */
      const now = performance.now();
      const dtWall = this.lastWallMs ? Math.min(0.5, (now - this.lastWallMs) / 1000) : 0;
      this.lastWallMs = now;
      const sp = this.botMode ? 8 : this.demoSpeed;
      this.demoAcc += dtWall * sp;
      const want = Math.min(240, Math.floor(this.demoAcc * 60));
      if (want > 0) {
        this.demoAcc -= want / 60;
        this.pump(want);
      }
    } else if (this.dbgPause) {
      /* 冻住:只画不推(出图/调试用) */
    } else {
      const a = this.audio;
      const live = !!a && !a.paused && isFinite(a.duration) && a.duration > 0;
      const step = 1 / 60;
      /* ★ 音乐能不能当"时钟"用:它得和模拟时间轴对得上。
         对不上的两种情形——① 刚复活,baseTick 跳了,音乐还停在旧位置;② 服务器不支持 Range 请求,
         浏览器 seekable 是空的,`currentTime = t` 会被直接忽略(实测本地静态服务器就是这样)。
         以前只认 live,于是这两种情况下 target 恒为 0 → **画面卡住不动**(用户报的就是"复活后不对")。
         现在:对不上就先试着重 seek(1.5 秒一次),同时【照常按固定步长推进模拟】,绝不卡住。 */
      const wantT = (this.baseTick + this.world.tick) / 60;
      const synced = live && Math.abs(a!.currentTime - wantT) <= 1.5;
      if (synced) {
        /* ★ 由音乐驱动:画面里的障碍正好落在它对应的那一拍上 */
        const target = Math.max(0, Math.floor(a!.currentTime * 60) - this.baseTick);
        let n = 0;
        while (this.world.tick < target && n < 8) { this.pump(1); n++; }
      } else {
        if (live) {
          const now = performance.now();
          if (now - this.lastSeekTry > 1500) { this.lastSeekTry = now; this.seekMusic(wantT); }
        }
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
    this.syncGodButton();
    this.syncDemoButton();
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
    if (w.god) parts.push('★ 无敌' + (this.guide.length ? ' · 限轨 ±' + GUIDE_BAND + ' 块' : ' · 只贴边界'));
    if (this.demoMode) {
      const n = this.demoTape ? this.demoTape.length : 0;
      parts.push(this.demoTape
        ? '演示 bot 通关 ×' + this.demoSpeed.toFixed(2).replace(/\.?0+$/, '') + '(' + (n / 60 / this.demoSpeed).toFixed(0) + 's 放完)'
        : this.demoErr ? '演示卷加载失败:' + this.demoErr : '演示卷载入中…');
    }
    if (Math.abs(w.padMul - 1) > 0.001) parts.push('跳点×' + w.padMul.toFixed(2));
    /* ★ 可见格数 + 取景框被外框挡掉的比例:和原版对不上时,一眼看出是缩放还是裁切问题 */
    const cam = this.cameras.main;
    const vhBlocks = (cam.height / cam.zoom) / U;
    parts.push('可见 ' + vhBlocks.toFixed(1) + ' 格');
    /* ★ 黑边自查:把"画布"和"外框的透明窗口"两个矩形直接打在 HUD 上 ——
       不用 DevTools,一眼看出画布比窗口矮多少/偏了多少(黑边 = 画布没能盖住窗口)。
       窗口的四条边从 FrameFit 写在 CSS 变量里的 --ff-win-* 读(以前这里打的是
       .screen-frame —— 那是【整块视口】,量出来永远等于视口,什么都说明不了)。 */
    const cvEl = document.getElementById('gd-canvas');
    const hostEl = cvEl?.parentElement ?? document.querySelector('.lost');
    if (cvEl && hostEl) {
      const cv = cvEl.getBoundingClientRect();
      const cs = getComputedStyle(hostEl);
      const px = (nm: string) => parseFloat(cs.getPropertyValue(nm)) || 0;
      const wl = px('--ff-win-left'), wt = px('--ff-win-top');
      const wr = px('--ff-win-right'), wb = px('--ff-win-bottom');
      const ww = window.innerWidth - wl - wr, wh = window.innerHeight - wt - wb;
      const seamB = (window.innerHeight - wb) - cv.bottom;      // >0 = 底下留了缝
      const seamR = (window.innerWidth - wr) - cv.right;
      const seamT = cv.top - wt;
      parts.push('盒 ' + Math.round(cv.width) + '×' + Math.round(cv.height) + '@' + Math.round(cv.top)
        + ' 窗 ' + Math.round(ww) + '×' + Math.round(wh) + '@' + Math.round(wt));
      const seams = [['下', seamB], ['右', seamR], ['上', seamT]] as const;
      const bad = seams.filter(([, v]) => Math.abs(v) > 1.5)
        .map(([k, v]) => k + (v > 0 ? '缝 ' : '溢 ') + Math.abs(Math.round(v)));
      if (bad.length) parts.push(bad.join(' '));
    }
    if (this.viewFrac < 0.995) parts.push('画布被挡 ' + Math.round((1 - this.viewFrac) * 100) + '%');
    /* ★ 缓冲尺寸 + 实际画了几个物件:帧率不对时一眼看出是"画太多"还是"像素太多" */
    parts.push('缓冲 ' + this.bufW + '×' + this.viewH + ' 绘 ' + this.drawn);
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
    /* ★★ 2026-09 用户:"明明知道相机不是双向跟随,给我整个半成品上来?" —— 对,是我没做完 ✗
       这里原来写死 Math.max(0, …) ⇒ 相机永远不越过关卡左边界(演示铺从 x=2 开始 ⇒ 往左等于撞墙 ✓)
       自由移动(演示铺)时去掉这个夹取 ⇒ 相机【双向跟随】✓;正常关卡照旧夹在 0 ✓ */
    const left = w.freeMove ? w.x - vw * 0.4 : Math.max(0, w.x - vw * 0.4);
    this.camX = left + vw / 2;

    /* ---- 形态切换:记下"进门时的视口中心"(原版 m_fCameraYCenter) ---- */
    if (w.mode !== this.camMode) {
      if (CAM_FIXED_MODES.has(w.mode)) {
        /* ★★★ 2026-09 用户定位:"高度不对,我觉得是因为我们形态门是到达这个 x 就生效的" ✓✓ 完全正确:
           原版的门是【碰到】才生效(门有 y,玩家必须和它重叠)⇒ 那一刻玩家就在门的高度上,
           所以源码 m_fCameraYCenter 用门的高度 = 玩家的高度 ✓;
           我们这套引擎的门是【越过 x 就生效】(DOOR_KINDS,"到达这一 x 就触发")⇒ 玩家可能在上/下很远的地方 ✗,
           再拿门的 y 去锁 ⇒ 框落在玩家根本不在的高度上(就是"高度不对" ✓)
           ⇒ 等价量是【越过那一刻玩家自己的 y】:公式照源码不动,只把输入换成它 ✓ */
        /* (原来这里从门/玩家高度取 m_fCameraYCenter 的那套 CAM_* 阈值已删——真源码用的是下面那条玩家公式 ✓) */
        /* ★★★ 源码(asm 451064-451076,`animateInDualGroundNew`)—— 这是【进门那一刻算一次目标】的地方:
             v8 = getTargetFlyCameraY(player); v11 = floor((v8 − 屏高/2)/30)*30; if (v11 <= 90) v11 = 90
             *(this+680) = v11 + 屏高/2
           ⇒ 我们坐标:camBottom = max(0, floor((玩家中心 − 屏高/2)/30) × 30) ⇒ 相机中心 = 它 + 屏高/2 ✓
           ★★ 用户:"摄像机跟人是要把人晃死吗?" —— 对 ✗:这个公式只在【进门那一下】用一次,
              之后相机是【钉住】的(每帧按格跟人 ⇒ 视野一格一格跳 ✗)。我上一版把它挂到每帧了 ✗ */
        const camBottomWant = Math.max(0, Math.floor((w.y + (P.box * w.sizeMul) / 2 - vh / 2) / U) * U);
        this.camCenter = camBottomWant + vh / 2;
        /* ★★★ 2026-09 用户两条:"为什么摄像机是突然被固定的" + "为什么限高框没有出现的动画"
           ⇒ ① 区间锁在【进门这一刻的目标视口中心】(此前 sim 拿到的是每帧移动的视口 ⇒ 框会跟着飘 ✗)
             ② 相机实际高度每帧朝目标靠 0.1(照搬 updateCamera 末尾那句 iLerp ✓,不是瞬移 ✗)
             ③ 两条框的进场进度归零 ⇒ 下面 bandT 播 0.1 秒 EaseInOut ✓ */
        /* ★ 相机目标现在由【门锚定的那段区间】决定(见下面 portalFrame 那段)⇒ 这里不再算 camCenter ✗ */
        this.camPinY = null; this.camPinned = false;      // 两条框从画外开始进场 ✓
      } else {
        this.camPinY = null;
      }
      this.camMode = w.mode;
    }
    /* ---- 纵向:视野下边(世界 y、单位) ---- */
    /* ★★★ 2026-09 双人(克隆门 286/287):两个人【x 相同、y 可以不同】⇒ 纵向取两人中点,
       这样两个玩家都在屏内 ✓(两人共用一套输入,见 sim/world.ts 的 dual 那段) */
    const p2 = w.p2Pos();
    const midY = p2 ? (w.y + p2.y) / 2 : w.y;
    const py = midY + (P.box * w.sizeMul) / 2;           // 视点中心(单人时就是人中心 ✓)
    let bottom: number;
    if (CAM_FIXED_MODES.has(w.mode)) {
      /* ★★ 钉死在【进门算好的目标】上,只做 0.1/帧 的平滑靠拢 ✓
         ★★★ 但必须【吸到格线上】(用户:"你框位置搞成带小数的干啥")——
         源码里相机 y 就是 `floor(v/30)*30`(asm 451070)⇒ 不对齐的话,框面会带小数、
         而且过渡途中框会从小数位置扫过玩家 ⇒ 挤人 ✗。这里 Math.round 到 30 的整数倍 ✓ */
      this.camPinY = this.camPinY == null ? this.camPinTarget
        : this.camPinY + (this.camPinTarget - this.camPinY) * 0.1;
      const snapped = Math.round(this.camPinY / U) * U;   // ← 一格对齐(源码 floor(v/30)*30 的等价)
      bottom = snapped - vh / 2;
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
    /* ★★★ 限高框 = 取景窗口本身(见 sim 的 frameOf:源码里两块地面只跟窗口有关 ✓)
       ⇒ 页面只把【取景上下边】发出去,框的门锚定 / 安全网一律撤掉 ✗(那两个都是我自己加的 ✗)
       ★ 相机:进门那一下按源码公式把目标吸到格线上,之后 0.1/帧 平滑靠拢 ✓ */
    const bandOn = CAM_FIXED_MODES.has(w.mode);
    if (bandOn && !this.camPinned) {
      /* ★ 源码(asm 451064-451076):相机中心 = max(90, floor((目标y − gh/2)/30)×30) + gh/2
         (gh = 该形态的"这段高度",球 234 / 飞船·UFO·波浪 300 / 其余 270 ✓)我们坐标 = 原版 − 90 ✓ */
      const gh = groundHeightOf(w.mode);
      const py = w.y + (P.box * w.sizeMul) / 2;
      this.camPinTarget = Math.max(0, Math.floor((py - gh / 2) / U) * U) + gh / 2;
      this.camPinY = this.camBottom + vh / 2;
      this.camPinned = true;
      this.bandT = 0;                     // ★ 进场进度归零 ⇒ 两块地面从窗口外收进来 ✓
    } else if (!bandOn) this.camPinned = false;
    w.airLo = bottom;
    w.airHi = bottom + vh;
    {
      /* ★★★ 2026-09 修 `Uncaught ReferenceError: Y is not defined`(用户给的报错原文)——
         这个作用域里现成的换算就是 `rowsU - y` ⇒ 直接算,不碰只在 draw() 里存在的 Y() ✓ */
      const drawY = (wy: number) => rowsU - wy;
      const wide = vw + 2 * Scene.GROUND_TILE;
      /* ★★★ 用户:"地面贴图没有颜色" —— 原版这条贴图是白的,靠【关卡地面色】染
         (GJGroundLayer::updateGround01Color / OpenGD `_colorChannels.at(1001)._color` ✓)
         ★ 本关 chart 里还没有颜色通道数据(只硬编了玩家色 1005/1006)⇒ 先用【页面地面线已经在用的那个色】
           (= color 触发器色 w.tint,否则本段配色 PAL)⇒ 拿到关卡 kS38 就换成通道 1001 的真值 ✓ */
      {
        const bx0 = w.x / U;
        const seg0 = LEVEL.segments.find((sg) => bx0 >= sg.from && bx0 < sg.to) || LEVEL.segments[0];
        this.bandTint = w.tint != null ? w.tint : PAL[LEVEL.segments.indexOf(seg0) % PAL.length];
      }
      /* ★★★ 2026-09 用户:"位置对了,出场全错" ⇒ 源码里这两块地面【没有进场动画】✗:
         `updateCameraBGArt` 每帧只是把它们【摆】在窗口边上(asm 431211 地面 / 431218 天花板),
         显隐由 `toggleVisible01(层, 层.y 在窗口内)` 决定 ✓ —— "落位"的感觉来自【相机】进门后 0.1/帧靠拢 ✓,
         不是框自己从画外滑进来 ✗(那套 bandHiY/bandLoY 是我编的 ✗,撤掉) */
      const fr = frameOf(w.mode, w.airLo as number, w.airHi as number);
      const bandH = Scene.GROUND_TILE * Scene.BAND_SCALE;      // 带宽 = 贴图高 × 缩放 ✓(32 单位)
      /* ★★★ 2026-09 用户:"上边框你写的是从下面出来的,这才是顶飞的原因" ✓✓ —— 完全正确:
         我给两条带加了"从框外收回来"的位移(`hiY = fr.hi + OUT×(1-e)`)✗ ⇒ 带子先出现在别处、
         而 sim 的夹取按【最终面】算 ⇒ 人和带子互相错位 ⇒ 一碰就被推飞 ✓
         ⇒ 撤掉带子的位移:两条带【永远就在各自的面上】(和夹取共用同一组数 ✓)。
         源码里也是这个结构:带子每帧只是被【摆】在位置上(431211/431218),没有任何位移动画 ✓;
         `this[218]` 那个进度影响的是【区间布局】,不是带子的滑动 ✓(布局过渡我下一步按它做) */
      const hiY = fr.hi, loY = fr.lo;
      /* ★★ 探针实测(tools/verify/gd-limit-shot.mjs):第一版建出来的 TileSprite 贴图是 `__MISSING` ✗
         —— 建对象那一刻 'gd-ground' 还没就绪,Phaser 就退化成缺省贴图,而且【不会自己换回来】✗
         ⇒ 就绪了才建;万一已经建成 __MISSING,销毁重建一次 ✓(自愈,不用刷新页面) */
      if (this.ceiling && this.ceiling.texture.key === '__MISSING') { this.ceiling.destroy(); this.ceiling = null; }
      if (this.groundBand && this.groundBand.texture.key === '__MISSING') { this.groundBand.destroy(); this.groundBand = null; }
      const groundReady = this.textures.exists('gd-ground') && !!this.textures.getFrame('gd-ground');
      if (!this.ceiling && groundReady) {
        /* ★ 上框 = 地面贴图【竖着镜像】(原版 GJFlyGroundLayer 就是倒过来的地面 ✓),不透明、不上色 ✓ */
        this.ceiling = this.add.tileSprite(0, 0, wide, Scene.GROUND_TILE, 'gd-ground')
          .setOrigin(0.5, 1)                              // 原点在【下沿】⇒ 下沿就是上框面 ✓
          .setFlipY(true)
          .setDepth(7).setVisible(false);
        /* 下沿那条亮线 = 原版 floorLine_001.png(压在地面顶边 = 框面上)✓ */
        this.ceilingLine = this.add.rectangle(0, 0, wide, 2, 0xbfe9ff, 0.85).setDepth(8).setVisible(false);
        /* ★★★ 用户:"没有地面的框" ⇒ 下框(这个形态的地面)也要画:同一条贴图,正着放、挂在框面【下面】✓ */
        this.groundBand = this.add.tileSprite(0, 0, wide, Scene.GROUND_TILE, 'gd-ground')
          .setOrigin(0.5, 0)                              // 原点在【上沿】⇒ 上沿就是下框面 ✓
          .setDepth(7).setVisible(false);
        this.groundLine = this.add.rectangle(0, 0, wide, 2, 0xbfe9ff, 0.85).setDepth(8).setVisible(false);
      }
      if (this.ceiling && this.groundBand) {
        const c = this.ceiling, gb = this.groundBand;
        const cl = this.ceilingLine as Phaser.GameObjects.Rectangle;
        const gl = this.groundLine as Phaser.GameObjects.Rectangle;
        /* ★ 只在【相机钉死的形态】显示:原版这两条是进门那一刻 tween 进来的,
           方块/机器人/蜘蛛进门不拉 ⇒ 它们留在画外(看不见)✓ 我们直接不显示 ✓ */
        c.setVisible(bandOn); cl.setVisible(bandOn);
        gb.setVisible(bandOn); gl.setVisible(bandOn);
        if (bandOn) {
          /* ★ 贴图【不动】(用户:"为什么地面贴图会动")⇒ 不设 tilePositionX ✓
             ★ 上色:白贴图 × 地面色(GD 就是这么染的 ✓) */
          c.setTint(this.bandTint); gb.setTint(this.bandTint);
          c.setPosition(this.camX, drawY(hiY)).setSize(wide, bandH);
          cl.setPosition(this.camX, drawY(hiY) + 1).setSize(wide, 2);
          gb.setPosition(this.camX, drawY(loY)).setSize(wide, bandH);
          gl.setPosition(this.camX, drawY(loY) - 1).setSize(wide, 2);
        }
      }
    }
    this.camWorldY = rowsU - this.camCenter;             // 换算成 Phaser 相机的绘图空间 y
    cam.centerOn(this.camX, this.camWorldY);
  }

  /** 三个界面(开场 / 死亡 / 通关)+ 终末之诗 + 彩蛋窗口:位置跟着相机取景走 */
  private paintUi() {
    const cam = this.cameras.main;
    const vw = cam.width / cam.zoom;
    const vh = cam.height / cam.zoom;
    const ux = this.world.freeMove ? this.camX : Math.max(vw / 2, this.camX);
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
      god: this.world.god,
      demoMode: this.demoMode,
      demoTape: this.demoTape,
      demoLoaded: this.demoLoaded,
      demoErr: this.demoErr,
      demoEndX: this.demoEndX,
      /* ★ 验收脚本要用的几个钩子(每个 bug 都要能在真浏览器里量出来,不能只靠"我看着好了"):
         · musicExpected —— 模拟时间轴上的秒数(baseTick + tick)/60,复活后音乐就该在这儿
         · retry/restartRun —— 不靠按键也能驱动复活/重来
         · padMul —— 弹簧力度微调到底有没有生效 */
      musicExpected: (this.baseTick + this.world.tick) / 60,
      baseTick: this.baseTick,
      padMul: this.padMulWanted,
      demoSpeed: this.demoSpeed,
      demoAcc: this.demoAcc,
      updates: this.updates,
      lastDt: this.lastDt,
      deathLog: this.deathLog,
      retry: () => this.retry(),
      restartRun: () => this.restartRun(),
      tapeHold: (tick: number) => this.demoHold(tick),
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
    if (this.scale.height !== this.viewH || this.scale.width !== this.bufW) this.scale.resize(this.bufW, this.viewH);
    const cv = document.getElementById('gd-canvas') as HTMLCanvasElement | null;
    if (cv) {
      cv.style.width = '100%';
      cv.style.height = '100%';
    }
    cam.setViewport(0, 0, this.bufW, this.viewH);
    cam.setSize(this.bufW, this.viewH);
    cam.setZoom(this.zoomOf());
  }

  draw() {
    const g = this.g, w = this.world, cam = this.cameras.main;
    this.drawn = 0;
    /* ★ 真正的病根在【viewport】:create() 时父容器还没量到尺寸,相机的 viewport 被定成
       320×180(恰好四分之一),渲染就被裁在左上角一小块里 —— 只改 setSize 没用,得设 viewport。 */
    if (!this.fixed) {
      this.fixed = true;
      this.measureFrac();
      this.applyViewport(cam);
      window.addEventListener('resize', () => { this.measureFrac(); this.applyViewport(cam); });
    }
    /* 每 20 帧(或刚开局)重新量一次:露出来的那一条/缓冲比例变了就跟着改取景框 */
    if (this.fixed && (this.fracT++ % 20 === 0)) {
      const before = [this.viewTop, this.viewH, this.bufW];
      this.measureFrac();
      if (before[0] !== this.viewTop || before[1] !== this.viewH || before[2] !== this.bufW) this.applyViewport(cam);
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
    for (const pl of this.portalLabels) {
      const off = w.offsetOf(pl.o);
      pl.t.setX((pl.o.b + pl.o.w / 2 + off.dx) * U);
      pl.t.setY(Y((pl.o.r + pl.o.h + off.dy) * U) - 8);
    }
    for (let pass = 0; pass < 2; pass++) {
    this.artUsed = 0;                              // ★ 贴图池:这一帧从 0 开始分配,画完把剩下的藏掉
    for (const o of LEVEL.objects) {
      if ((o.kind === 'deco') !== (pass === 0)) continue;
      if (o.kind === 'trigger') continue;         // 触发器是个逻辑物件,不画
      /* ★ 先用【静态坐标】粗筛,再问触发器偏移 —— offsetOf 以前放在最前面,
         8980 个物件每个都问一次(而且它自己还是线性扫),是帧率掉下来的主因。
         留一块余量:会动的物件可能从屏幕外推进来。 */
      if ((o.b + o.w) * U < x0 - CULL_MARGIN || o.b * U > x1 + CULL_MARGIN) continue;
      /* 会动的东西(触发器推的)按运行时偏移画;判定盒在 sim 里已经同步过了 */
      const off = w.offsetOf(o);
      const obx = (o.b + off.dx) * U, obw = o.w * U, obh = o.h * U;
      const oTop = Y((o.r + o.h + off.dy) * U);   // 格子上边(绘图空间)
      const oBot = Y((o.r + off.dy) * U);         // 格子下边
      if (obx + obw < x0 || obx > x1) continue;
      if ((o.r + o.h + off.dy) * U < lowY || (o.r + off.dy) * U > highY) continue;
      this.drawn++;
      /* ★ 有贴图的物件直接画贴图(锯片/弹簧板/存档点/硬币/刺/环),没贴图的走下面的矢量画法 */
      const artKey = this.artKeyOf(o);
      if (artKey) {
        /* ★★★ 2026-09 门的 back 层【撤回】—— 用户:"你把后层放到了和前层相同的位置,导致混在一起了" ✗
           我按反编译给门加了两层(back 深度 7 / front 深度 17.5),查证结果:
             反编译里 GD 确实会为门建一个 back 物件,位置就是门前层的 getPosition()(同位置 ✓),
             z = 前层 z − 100 + v37 ⇒ 在前层【后面 100 档】(90133–90177 行)
           ⇒ 位置相同这事本身没错,但【把两张半透明美术叠在一起】会让门明显发闷/发糊 ✗
           ⇒ 在能拿到原版门的逐帧对照之前,先只画 front 一层(回到 g102 用户没说"混"的状态 ✓) */
        if (this.drawArtObject(o, artKey, obx + obw / 2, oBot - obh / 2, this.artTintOf(o, tint))) continue;
      }
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
          /* 锯片:带齿的【圆】锯轮,按时间转。
             ★★ 2026-09 修(用户:"锯片大小,你现在做成了椭圆,但是原版不是圆的吗?
                也就是说你只放缩了纵向宽度"):以前按【包围盒】画(1.47×2.83 格 × 缩放),
                于是画出来是竖椭圆 —— 而判定是圆(OpenGD `_pHitboxRadius`,sim 里走 circles)。
                现在:半径就用 sim 的圆半径(o.rad,已含缩放),画的和判的完全一致。
                换算:这一格的屏幕宽度 / 物件宽度 = 每单位多少像素。 */
          const ppu = obw / Math.max(1e-6, o.w * U);
          const r = Math.max(5, (o.rad ?? 30) * ppu);
          const scx = obx + obw / 2, scy = oBot - obh / 2;
          const spin = tick * 0.12;
          g.fillStyle(0x2a1408, 0.9).fillCircle(scx, scy, r);
          g.lineStyle(2, WARN, 0.95).strokeCircle(scx, scy, r);
          for (let k = 0; k < 12; k++) {
            const a = spin + k * Math.PI / 6;
            const ca = Math.cos(a), sa = Math.sin(a);
            g.fillStyle(WARN, 0.9).fillTriangle(
              scx + ca * r * 0.78, scy + sa * r * 0.78,
              scx + Math.cos(a + 0.20) * r * 1.12, scy + Math.sin(a + 0.20) * r * 1.12,
              scx + Math.cos(a - 0.20) * r * 1.12, scy + Math.sin(a - 0.20) * r * 1.12,
            );
          }
          g.fillStyle(0x05070d, 1).fillCircle(scx, scy, r * 0.42);
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
          /* 形态门:★ 每个形态一套颜色 + 门上一块写着形态名的小牌子 ——
             以前所有门都画成同一个黄圈(只有飞机画个三角),用户根本看不出切什么形态。
             门画成原版那种"竖着的椭圆门"(尺寸就取判定盒 34×86 单位),色/牌子都按目标形态分。 */
          const to = (o.to ?? 'cube') as Mode;
          const col = PORTAL_COL[to] ?? 0xffe17a;
          const pw = PORTAL_W, ph = PORTAL_H;
          const ccx = obx + obw / 2, ccy = oBot - obh / 2;
          g.fillStyle(col, 0.16).fillEllipse(ccx, ccy, pw, ph);
          g.lineStyle(3, col, 0.95).strokeEllipse(ccx, ccy, pw, ph);
          g.lineStyle(1, col, 0.45).strokeEllipse(ccx, ccy, pw * 0.72, ph * 0.8);
          /* 门里画个目标形态的简笔:方块=方,飞机/波浪=三角,球=圆,UFO=扁圆,机器人=方+腿,蜘蛛=方+须 */
          g.fillStyle(col, 0.95);
          const gs = 9;
          if (to === 'cube' || to === 'robot' || to === 'spider') {
            g.fillRect(ccx - gs, ccy - gs, gs * 2, gs * 2);
            if (to === 'robot') { g.fillRect(ccx - gs, ccy + gs, 4, 5); g.fillRect(ccx + gs - 4, ccy + gs, 4, 5); }
            if (to === 'spider') { g.fillRect(ccx - gs - 5, ccy - gs, 5, 3); g.fillRect(ccx + gs, ccy - gs, 5, 3); }
          } else if (to === 'ball') {
            g.fillCircle(ccx, ccy, gs);
          } else if (to === 'ufo') {
            g.fillEllipse(ccx, ccy, gs * 2.6, gs * 1.1);
          } else {
            g.fillTriangle(ccx + gs, ccy, ccx - gs, ccy - gs, ccx - gs, ccy + gs);
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
          /* 重力门:★ 以前两个方向都画成"淡紫色小三角 + 一圈淡淡的光",用户根本看不出是重力门、
             更看不出往哪边翻。现在按原版配色做成【竖椭圆门 + 大箭头 + 门头牌子】:
               反重力(向上,id 11)= 蓝;常重力(向下,id 10)= 黄。
             门框尺寸用判定盒一致的口径(34×86 单位),撞上去的范围和看见的一致。 */
          const up = (o.gdir ?? 1) < 0;
          const col = up ? 0x6fc3ff : 0xffd166;
          const gcx = obx + obw / 2, gcy = oBot - obh / 2;
          g.fillStyle(col, 0.16).fillEllipse(gcx, gcy, PORTAL_W, PORTAL_H);
          g.lineStyle(3, col, 0.95).strokeEllipse(gcx, gcy, PORTAL_W, PORTAL_H);
          g.lineStyle(1, col, 0.45).strokeEllipse(gcx, gcy, PORTAL_W * 0.72, PORTAL_H * 0.8);
          /* 门里一支大箭头:朝上 = 反重力,朝下 = 常重力;还配两条横线示意"哪边是地" */
          g.lineStyle(4, col, 0.95);
          g.beginPath();
          const ay = up ? -1 : 1;                       // 屏幕上:up → 往上画
          g.moveTo(gcx, gcy - ay * 14); g.lineTo(gcx, gcy + ay * 14);
          g.moveTo(gcx - 9, gcy + ay * 4); g.lineTo(gcx, gcy + ay * 15); g.lineTo(gcx + 9, gcy + ay * 4);
          g.strokePath();
          g.lineStyle(3, col, 0.8);
          g.lineBetween(gcx - 12, gcy + ay * 22, gcx + 12, gcy + ay * 22);
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
          /* 线框:这里只管【画】—— 按 frameRects 画出看得见的那 1~3 条边。
             ★ 判定【不再】用这份几何:原版表里 469/470/471 的外框是整格 30×30、661 是 15×15,
               L 形/U 形只是贴图(见 sim/world.ts 的 case 'frame')。 */
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
          /* ★ 屏幕上的角度 = 数据里的 rot(0 = 指向右,正角度顺时针 = 屏幕上往下)——
             和 sim 里的 arrowDir 是同一套口径,画的和冲的方向才会一致。 */
          const a = ((o.rot ?? 0) * Math.PI) / 180;
          const dx = Math.cos(a), dy = Math.sin(a);
          const L = U * 0.5;
          const tx = acx + dx * L * 0.62, ty = acy + dy * L * 0.62;     // 箭尖
          g.lineStyle(3, acol, 0.95);
          g.beginPath();
          g.moveTo(acx - dx * L * 0.5, acy - dy * L * 0.5);
          g.lineTo(tx, ty);
          g.moveTo(tx, ty);
          g.lineTo(tx - dx * L * 0.45 + dy * L * 0.42, ty - dy * L * 0.45 - dx * L * 0.42);
          g.moveTo(tx, ty);
          g.lineTo(tx - dx * L * 0.45 - dy * L * 0.42, ty - dy * L * 0.45 + dx * L * 0.42);
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
    /* ★ 贴图池收尾:这一帧没用到的那些藏起来(池子只增不减,复用同一批 Image) */
    for (let i = this.artUsed; i < this.artPool.length; i++) this.artPool[i].setVisible(false);

    // 玩家:方块 = 描边正方形(空中自转 90°),飞机 = 三角(按 vy 倾斜)
    const B = P.box * w.sizeMul;   // ★ 迷你门:人也要画小
    const py = this.prevY + (w.y - this.prevY) * Math.min(1, this.acc * 60);   // 渲染插值
    const cxw = w.x + B / 2, cyw = py + B / 2;
    /* ★ 图集就绪就用真图标(见 buildIcons);没就绪/加载失败时走下面这套矢量兜底。
       注意图标用的是绘图空间坐标(和 Graphics 一样,y 走 Y() 翻转),所以这里给它 Y(cyw) */
    /* robot / spider 不走图标(见下面的说明:部件摆位数据不在我们手上 ✗)⇒ 用矢量画 ✓ */
    /* ★★★ 2026-09 robot / spider:按【官方部件表】摆多 sprite(规格见 buildIcons 上方的 TODO)
       数据 = cache.json('gd-parts')(由 tools/bake-player-parts.ts 从官方 AnimDesc 烘出 ✓)
       坐标 = 部件 px 与 position 同尺度 ⇒ 直接当世界单位用 ✓(屏幕 y 取反 ✓)
       首次用到某形态时懒加载 4 个部件 sprite,之后每帧只改位置与显隐 ✓ */
    let drewParts = false;
    if (w.mode === 'robot' || w.mode === 'spider') {
      const self = this as unknown as { partSprites?: Record<string, Phaser.GameObjects.Image[]> };
      self.partSprites = self.partSprites ?? {};
      let arr = self.partSprites[w.mode];
      const all = this.cache.json.get('gd-parts-anim') as Record<string, {
        scale: number;
        frames: Record<string, { ox: number; oy: number }>;
        anims: Record<string, Array<Array<{ tex: string; x: number; y: number; z: number }>>>;
      }> | undefined;
      const info = all?.[w.mode];
      /* ★ 动画选择(官方 AnimDesc 里有多种):
           robot : run(跑) / skip(跳) / idle    ← 用户:"robot 还有一个跳跃动画" ✓
           spider: run / walk / jump / idle ✓
         规则:落地 ⇒ run(跑动);离地 ⇒ robot 用 skip、spider 用 jump ✓ */
      const anims = info?.anims ?? {};
      const airborne = !w.onGround;
      const pick = w.mode === 'robot'
        ? (airborne ? (anims.skip ?? anims.run) : (anims.run ?? anims.idle))
        : (airborne ? (anims.jump ?? anims.run) : (anims.run ?? anims.walk));
      if (!arr) {
        const maxN = Math.max(...(pick ?? [[]]).map((f) => f.length), 0);
        arr = Array.from({ length: maxN }, () => this.add.image(cxw, Y(cyw), '__DEFAULT').setDepth(16).setVisible(false));
        self.partSprites[w.mode] = arr;
      }
      const frames = pick ?? [];
      const fi = frames.length ? Math.floor((w.tick / 60) * 12) % frames.length : 0;
      const list = frames[fi] ?? [];
      const sc = info?.scale ?? 0.25;                 // uhd → 布局单位(实测 4× ✓)
      const k = (B / 30) * sc;                        // 部件表与世界单位 1:1(方块 30 单位)✓
      for (let i = 0; i < arr.length; i++) {
        const img = arr[i];
        const sp = list[i];
        if (!sp) { img.setVisible(false); continue; }
        const key = 'gd-parts';
        if (img.texture.key !== '__DEFAULT') img.setTexture(key, sp.tex);
        else img.setTexture(key, sp.tex);
        const fr = this.textures.getFrame(key, sp.tex);
        /* ★★★ 2026-09 用户:"spider 没有上色" —— robot/spider 走的是这条【部件动画】路,
           而它以前【完全没染色】✗(染色只加在 drawIconPlayer 里 ⇒ 这两个形态永远是白灰底 ✓)
           官方部件名自带层号:xxx_2_001 = 第二色层、其余 = 主体层 ⇒ 分别用玩家色 1 / 2 染 ✓ */
        img.setTint(sp.tex.includes('_2_') ? PLAYER_C2 : PLAYER_C1);
        /* ★ 叠加部件自己的 spriteOffset(用户:"蜘蛛腿的位置太高了,robot 也有点" ⇒ 缺的就是这一项 ✓)
           AnimDesc 的 position 是"部件锚点",而部件内容在它自己的画布里还有偏移 ✓
           再乘 uhd→布局的 scale(0.25)✓ */
        const fo = info?.frames?.[sp.tex];
        const ox = (fo?.ox ?? 0) * sc, oy = (fo?.oy ?? 0) * sc;
        img.setVisible(!w.done)
          .setPosition(cxw + (sp.x + ox) * (B / 30), Y(cyw) - (sp.y + oy) * (B / 30))
          .setDisplaySize(Math.max(1, fr.width * k), Math.max(1, fr.height * k));
      }
      drewParts = arr.length > 0 && list.length > 0;
    }
    /* ★★★ 2026-09 修"cube 贴图还是没有"(用户第三次报):原来这里判断的是【图集整体就绪】✗,
       而 drawIconPlayer 里是【按形态找图层】——cube 那层没建出来时它直接 return,
       上面又因为 iconsReady 跳过了矢量 ⇒ 【两边都不画 = 什么都看不见】✓✓
       (1986 行那段注释早就写明要改成"按形态判断",代码没改 ✗)
       现在:这个形态【真有图层】才走图集并跳过矢量;没有就走矢量兜底 ⇒ 无论图层成不成都有东西 ✓ */
    const hasLayer = this.iconLayers.some((l) => l.mode === w.mode);
    if (hasLayer && w.mode !== 'robot' && w.mode !== 'spider') this.drawIconPlayer(w, cxw, Y(cyw), B);
    /* ★ 这里【绝不能】每帧 console.warn:devtools 开着时一帧一条会把页面拖死(用户已经踩过一次卡死 ✗)
       ⇒ 只在"形态图层表"变化时打一次(buildIcons 结束时那条 [gd] 日志已经够定位 ✓) */
    /* ★★★ 2026-09 用户:"bird 外观是一个 UFO,但驾驶位在原版是独立的一个 cube,所以现在驾驶位是空的"
       —— 原版载具(UFO/飞船/球/波浪箭)里坐着的是【玩家自己的 cube 图标】,我们以前只画载具 ⇒ 驾驶位空 ✗
       做法:再建一张图,用 cube 那一层的贴图,跟着玩家走、同色 ✓
       (各载具里 cube 的确切缩放/偏移还没从源码核到 ⇒ 现在【同尺寸居中】,已记待办 ✓) */
    /* ★★★ 2026-09 修"UFO 驾驶位没有 cube":旧的【渲染途中懒创建】删掉 ✗
       (当初卡死就是它 —— add.image 发生在 draw 里 ⇒ 显示列表被遍历时被改 ✗)
       换成一行【一次性】诊断(挂在 pilot 对象上 ⇒ 只打一次,不刷屏 ✗):
         · "已建" ⇒ 问题在绘制/可见性
         · "没建出来" ⇒ 问题在 buildIcons 那一步(并打出 icon-cube-body 在不在)
       有这一行就能定性,不用再来回猜 ✓ */
    {
      const dbg = this.pilot as unknown as { _dbg?: boolean } | null;
      const state = this.pilot ? ('已建 · 贴图=' + this.pilot.texture.key + ' · visible=' + this.pilot.visible)
        : ('【没建出来】· icon-cube-body 存在吗=' + this.textures.exists('icon-cube-body') + ' · 图集就绪=' + this.iconsReady);
      if (!dbg?._dbg) {
        if (dbg) dbg._dbg = true;
        this.pilotDbgLogged = true;
        console.info('[gd] 驾驶位 cube:' + state + ' · 形态=' + w.mode);
      }
    }
    const PILOT_MODES = new Set(['ship', 'ufo', 'wave', 'ball']);
    /* ★★★ 2026-09 单变量复测:上一次卡死(g114)那一版里,除了这个 pilot 【限高也是开着的】✗
       ⇒ 我一直没做过"只开 pilot、限高关着"的干净测试。现在就是这样:
           限高 AIR_LIMIT_ON = false(关着) · pilot 开 · 其余都保持基线 ✓
       若这版不卡 ⇒ 卡死是限高(它会把 UFO 段夹在 portalY ± 160 的区间里,那一段要往上飞就死循环 ✗)
       若这版还卡 ⇒ pilot 确实是元凶,我拿掉它换别的做法(不再猜)✓ */
    /* ★★★ 2026-09 修"碰到 bird 门卡死"(用户实测)★ 这是我上一轮引入的 ✗:
       pilot 用的 'icon-cube-body' 在 cube 那一层没建出来时【根本不存在】⇒ this.add.image 抛异常,
       异常发生在渲染循环里 ⇒ 整页卡死(第一次进载具形态才触发 = 碰上 bird 门那一下 ✓)
       => 先查 textures.exists,没有就【不画驾驶位】,绝不抛 ✓ */
    if (PILOT_MODES.has(w.mode) && this.pilot) {
      /* ★★★ 2026-09 卡死真凶(用户给的报错原文):`on is not defined` ✗✗
         这段在 draw() 里,而我抄了 drawIconPlayer() 作用域里的变量名 on —— 这里根本没有 on ⇒
         每帧抛一次异常 ⇒ Phaser 的 update/draw 链断掉 ⇒ 整页卡死 ✓✓✓
         (这也解释了:g108 加 pilot ⇒ 第一次卡死;g114 我只改了"预建时机"、没碰这个变量 ⇒ 还是卡;
          g115 整段关掉 ⇒ 不卡 ✓)
         ★ 教训:构建(vite/esbuild)【不做类型检查】✗ ⇒ 这种作用域错误能一路进包 ⇒
           以后交付前必须跑一次 npx tsc --noEmit ✓
         这里用本作用域内的等价条件 ✓ */
      this.pilot.setVisible(!w.done).setPosition(cxw, cyw).setRotation(0).setFlipY(w.gdir < 0)
        .setTint(w.dead ? 0xff7a5a : PLAYER_C1).setDisplaySize(B, B);
    } else this.pilot?.setVisible(false);
    /* ★★★ 2026-09 双人:玩家 2 也画一遍(状态换进换出,所以画法和玩家 1 完全一样 ✓)
       已知缺口:robot/spider 的【部件动画】那条路(P2 目前只画图标本体)✗ 已记进待办 ✓ */
    if (w.dualInto()) {
      const B2 = P.box * w.sizeMul;
      this.drawIconPlayer(w, w.x + B2 / 2, Y(w.y + B2 / 2), B2);
      w.dualBack();
    }
    /* ★★ 2026-09 修"cube 根本没有贴图"(我上一轮引入的 ✗):
       drawIconPlayer 在没有该形态图层时会直接 return ⇒ 而这里只要 iconsReady 就跳过矢量 ✗
       ⇒ cube(图集尺寸不符被跳过)两边都不画 = 【什么都看不见】✓✓
       改成:只有【这个形态真的有图层】才跳过矢量 ✓,否则照常走矢量 ✓ */
    /* ★★★ 2026-09 照源码定论 + 务实处理(用户:"robot/spider 没腿,UFO 又乱了"):
       源码:robot/spider 的【腿等部件】来自 GJRobotSprite / GJSpiderSprite 这两个
             "命名动画 sprite"(class GJSpiderSprite : public GJRobotSprite ✓
              GJRobotSprite::init(id, name) 按名字加载一整套动画 ✓)
       ⇒ 部件的【相对摆位】在那套动画数据里,不在 texture plist 里 ✗ ——
         我离线把 texture plist 的各部件按各种对齐方式拼过,拼出来都是"方框 + 一坨线" ✗(亲眼看过 ✓)
       处置:这两个形态【不用 icon 贴图,走矢量画法】✓
             —— 这样至少画出一个能认出是机器人/蜘蛛的东西 ✓,
                而不是现在这种"拼错的方框" ✗;等拿到 GJ*Sprite 的动画数据再换成贴图 ✓
       (矢量那套在下面 else 分支里,本来就有 ✓ —— 这里只要不认这两个形态的 icon ✓) */
    const NO_ICON_MODES = new Set(['robot', 'spider']);
    if (drewParts) { /* robot/spider 的部件 sprite 已经画了,矢量那套跳过 */ } else if (this.iconsReady && !NO_ICON_MODES.has(w.mode) && this.iconLayers.some((l) => l.mode === w.mode)) { /* 图标已经画了,矢量那套跳过 */ } else if (w.mode === 'ship') {
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
      /* ★★ 2026-09 用户口径(原版):"原版大跳旋转 180°,会根据位置决定下落是否旋转,
       使得不会出现落到平台上还存在旋转角的情况" ⇒ 落地必须是【趴平】的(0° / 90° 的整数倍)✓。
       所以:一落地就把角度吸到 0(方块永远平着落)✓ —— 这是我们以前完全没有的一步 ✗。 */
    /* ★★ 2026-09 方向:用户实测"旋转方向也是错的" ⇒ 现在这里取【负号】。
       原因:我们的绘图空间 y 是翻转的(见 Y()),正角度在屏幕上看是【逆时针】✗,
       而方块向右跑时应该【顺时针】转 ✓。 */
    /* ★★ 2026-09 用户答"a":普通一跳应当 180°,而现在实测转出了 360° ⇒ 速率【减半】。
       原来的 `(airT/spinStep) × π` 在真实滞空(≈2×标称)下会转满 360° ✗ ——
       系数从 1 改成 0.5 ⇒ 普通跳 = 180° ✓、大跳(滞空×2)= 360° ✓。
       (落地不做任何"回正"动作 —— 用户:"回转更刻意了" ✗;落地角由连续旋转自然落在 90° 的
        倍数附近,0/90/180/270 对方块都算趴平 ✓。) */
    const spinStep = 2 * P.jump / (P.gravity * Y_TIME_SCALE) / 60;   // 一次标称跳的滞空(秒)
    /* ★★ 2026-09 用户口径:"跳跃旋转 180°"(就这一条),不要任何"落地回正/吸附"✗。
       实现:角度 = 空中帧数 × (180° ÷ 一次真实跳跃的空中帧数)。
       实测本引擎一次平地起跳的空中帧数 = 33 帧(之前几版都拿"理论滞空 26 帧"算 ⇒ 每次多转
       33/26 ≈ 27% ⇒ 一眼就是"转了 360°" ✗ —— 这就是我一直改不对的原因)。
       落地不再做任何处理:空中转到哪就是哪 ✓(方块在 90° 倍数时本来就看着一样) */
    const spin = -(this.airT * 60) * (Math.PI / 33);
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
      const px = this.world.freeMove ? this.camX : Math.max(vw / 2, this.camX), py = this.camWorldY;
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
