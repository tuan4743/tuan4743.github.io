# CD 资产放置说明(你只维护资产 + manifest.json)

## 目录结构

```
static/assets/cd/
├── manifest.json          ← 接口契约(改这里,不碰前端代码)
├── drive.glb              ← Blender 导出的整机模型(光驱 + 5 张 CD,已内嵌贴图)
└── cds/                   ← 主题盘面贴图(可选,当前用 GLB 内嵌贴图)
    ├── self.webp / growth.webp / lost.webp / tech.webp / future.webp
```

## 实际模型结构(已核对 drive.glb)

| 用途 | 节点名 | 备注 |
|---|---|---|
| 光驱整机 | `CD_drive` | 含 `光盘2`(外壳)与 `光盘3`(托盘/内件);**内部中文名在导出时有编码错乱,不影响渲染** |
| 五张 CD | `self` / `groth` / `lost` / `tech` / `future` | 网格名是中文"圆环";`groth` 是原拼写(保留原名不动) |
| 自带动画 | `圆环动作` ×5 | P2 用;正式版请改名为 `A_Eject` / `A_Insert` / `A_Pin` |

CD 直径 ≈ 2.0 模型单位;光驱外壳 ≈ 2.51 × 0.29 × 2.49(平放托盘形态)。

## manifest.json 可调项(改完刷新即可,零代码改动)

| 字段 | 作用 | 当前值 |
|---|---|---|
| `hub` | 插入点(轮盘旋转轴心,场景坐标) | `[0,0,0]` |
| `driveRot` | 光驱立起角度(平放模型转成正对镜头) | `[90,0,0]` |
| `driveOffset` | 光驱相对 hub 的偏移(负 Z = 往后放) | `[0,0,-0.35]` |
| `cdOrbitRadius` | CD 绕 hub 的轨道半径 | `1.6` |
| `cdStandRotX` | CD 立起角度(平放 → 立正) | `90` |
| `cdZ` | CD 所在平面深度 | `0` |
| `camera.fov` / `margin` | 镜头视角 / 取景留白 | `30` / `0.35` |
| `light` | 灯光位置/强度/色温(屏幕光从右照) | `[3.2,2.4,2.6]` / `1.7` |
| `useExternalTex` | 是否用 `cds/*.webp` 覆盖 GLB 内嵌贴图 | `false` |

## CD 架的文字介绍与背景色(改的是 `hugo.toml`,不是 manifest)

CD 架左上角"当前主题 + 主题配文"、左下角"歌名 + 歌手",以及整块 CD 架的背景色,
都写在 `hugo.toml` 的 `[[params.intro.panels]]` 里(和右侧屏幕的面板共用同一份数据):

| 字段 | 作用 |
|---|---|
| `title` | 左上角大字(当前主题),同时用于右侧面板标题 |
| `caption` | 主题配文(左上角小字);**留空则用 `text`** |
| `text` | 右侧屏幕的面板正文 |
| `bg` | CD 架背景色(跟随"当前选中的盘");文字色自动取它的**反色**(255-x) |
| `fg` | 可选:手动指定文字色(不写就自动反色) |
| `song` | 左下角歌名 |
| `artist` | 左下角歌手(自动居中于歌名之下) |

- 排版尺寸/位置在 `assets/css/intro.css` 的 `.rack` 里,一组 `--rack-*` 变量:
  `--rack-pad`(左边距)、`--rack-text-w`(文字块最大宽度,超长歌名会换行)、
  `--rack-theme-size` / `--rack-caption-size` / `--rack-song-size` / `--rack-artist-size`(字号)、
  `--rack-top` / `--rack-bottom`(上下两块的位置)
- **三块文字都左对齐**(主题/歌名/歌手同一个 x),歌名换行也不会让位置跑偏
- 背景是**纯色**:不叠渐变、不叠阴影,上/下边框已去掉(叠了渐变白色会发灰)
- 换选(滚轮/↑↓)时背景色 **560ms 过渡**,文字随选中盘切换
- 当前色值:自我 `#efc243`、成长 `#a9cde8`、迷茫 `#1c56a0`、技术 `#000000`、未来 `#ffffff`
  (前三个采样自各自的盘面贴图;反色分别是 `#103dbc` `#563217` `#e3a95f` `#ffffff` `#000000`)
- 调试:`window.__rackDebug`(最近一次绘制的 key / bg / fg)

## 音乐(`music/` 目录 + `audio.music` 段)

5 首歌放在 `static/assets/cd/music/<key>.mp3`(命名与贴图同一套 key)。前端行为:

| 时机 | 行为 |
|---|---|
| 滚轮/↑↓ 选中某张盘 | 从 `start[key]` 秒开始**预览**,音量很小,换选时交叉淡出 |
| 点盘 → 插进光驱 → 回主界面 | 同一首**接着播**并升成**背景音乐**(不重启、不中断) |
| 重新打开 CD 架 | 背景音乐让位给新选中盘的预览(新曲解码期间旧曲继续放) |
| 顶栏喇叭按钮 | 音乐和光驱音效一起静音(但画面照常跟着频谱跳) |

```json
"music": {
  "enabled": true,
  "previewVolume": 0.14,      // 预览音量
  "bgmVolume": 0.25,          // 背景音乐音量
  "fadeMs": 700,              // 淡入淡出
  "previewMs": 0,             // 预览播多久自动淡出,0 = 一直播到换选
  "bgmRestartOnInsert": false,// true = 插入后从头放
  "maxDecoded": 1,            // 同时缓存的解码结果(解码后很大,1 最省内存)
  "start": { "self": 0, "growth": 0, "lost": 0, "tech": 0, "future": 0 }
}
```

`start` 是唯一建议你按歌填的:填副歌时间(秒),预览就从副歌进。内存提醒:32kHz 解码后大约
每分钟 15MB,`maxDecoded` 调大很吃内存。

## 音频可视化(`fx` 段)

CD 页左侧竖排 4 个开关(状态记在 localStorage),可任意叠加,颜色自动取"背景色的反色":

| 开关 | 效果 | 调参(manifest 的 `fx` 段) |
|---|---|---|
| 音频条 | 盘左侧 **125°~235°** 一圈条子,最高高度一致(无两端衰减)| `arc.gain` 增益、`bars` 条数、`from`/`to` 角度、`gap` 离盘缘、`minLen`/`maxLen` 长度、`width` 粗细、`taper` 两端衰减(0 = 一样高)、`pulse` 整圈外顶、`alpha` |
| 律动几何体 | 从**盘底**向外弹射的小几何体,实心/空心随机、颜色流动、速度随机 | `particles.count`、`size`、`speed` 最快、`speedMin` 最慢倍数、`life` 基础寿命、`dist` **目标飞行距离**(寿命 = 距离/速度,所以快慢飞得一样远)、`spawn`、`hollowRatio`、`alpha` |
| 放射线 | 盘缘一圈随频谱伸缩的细长条(**有真实宽度**) | `rays.count`、`minLen`/`maxLen`、`width`、`alpha` |
| 扩散圆环 | 低频**概率触发**的分瓣圆环 | `rings.chance` 概率、`threshold` 门槛、`cooldown` 间隔、`max` 数量、`speed` 扩散速度、`grow` 扩散到多少倍半径才淡出、`segments` 分瓣、`wobble` 浮动、`drift`、`alpha`、`width` |
| 背景(多边形 + 线) | 随机透明色多边形 + 随机位置/朝向的线;线随音量伸缩(最多 +25% 长度、粗细最多翻倍)| `polys.count`/`sizeMin`/`sizeMax`/`alphaMin`/`alphaMax`/`sat`/`light`/`rotate`、`lines.count`/`lenMin`/`lenMax`/`width`/`widthGrow`/`grow`/`alpha` |

**`fx.agc`(每频段自动增益)**:低频天然比高频响得多,直接映射会让中间的条子一直顶满。
打开 AGC 后每个频段按自己的峰值(缓慢衰减)归一化,每根条子都能跳满自己的量程 ——
`floor` 是归一化的最小分母(越大越不灵敏)、`decay` 是峰值衰减速度。

**音频条的"左墙"**:条子最长只能顶到左侧开关列的右边缘 + 8px(运行时实时测量),
所以无论怎么调轨道/盘大小/`maxLen`,最长的条子都不会压住开关。

颜色:`colorful` 段控制"彩色"效果(律动几何体 + 扩散圆环用彩色,音频条/背景线/放射线保持背景反色)——
`on` 关掉就全部退回反色,`speed` 色相流动速度、`sat` 饱和度、`light` 亮度、`spread` 每个物体的色相间隔。

其它:`fx.on` 是五个开关的默认值(用户点过之后以 localStorage 为准)、`fx.smooth` 平滑度(越大越软)、
`fx.idle` 没有音乐时是否退化成缓慢呼吸动画。

**发射位置全部按 CD 半径自动算**:`cdRadius` 留 `null` 就从模型几何体实测(你改 CD 大小/位置/轨道后
特效会自动跟随);也可以写死一个数字覆盖它。特效平面固定在盘后面 0.5(代码里的 `behind`),
所以盘随鼠标倾斜时几何体不会跑到盘上面。

调试:`window.__cdFxDebug`(频谱平滑值 / 各开关 / 音频条圆心·半径·最长条子 / 色相 / CD 半径 / 特效平面 z)、
`window.__cdAudio.music.state()`(音乐状态机轨迹 / 播放次数 / 解码缓存 / 预解码记录)。

### 换盘时音乐为什么要等一下?

切歌的耗时**全部**在"下载 + 解码"上(实测:缓冲已在内存时,请求→出声只要 **2ms**)。所以做了三件事:

- `prefetch: true` —— 播第一首之后,后台把**其余几首的字节**抓进浏览器缓存(只下载不解码,不占内存)
- `prefetchDecode: 1` —— 当前这首播起来 0.8 秒后,后台把**下一首**也解码好 → 往前滚轮换盘是瞬切
- `maxDecoded: 2` —— 最近两首的解码结果留在内存里(正在播的永远不会被挤掉),**回上一首是瞬切**
- `fadeMs: 400` —— 交叉淡入淡出缩短到 0.4 秒

内存提醒:解码成 32kHz PCM 后大约每分钟 15MB,`maxDecoded` 调大会很吃内存。首次进入某首**从没播过**
的曲子仍会有一次解码等待(几 MB 的 mp3,通常 0.3~1 秒)。

## CD 架背景与文字配色

**背景 = 深蓝黑底 + 主题色菱形平铺**(参考《冰与火之舞》铺面编辑器):

- 底色固定 `#0b0b14`;菱形是**当前主题色的 50% 透明**(一个 45° 旋转的正方形,SVG data-URI)
- 网格大小 / 流动速度在 `assets/css/intro.css` 的 `.rack` 里:`--bg-tile`(默认 52px)、`--bg-scroll`(默认 26s,设 `0s` 就不动)
- 主题色若和深底太接近(比如"技术"的纯黑),菱形会自动往白里提 30%,免得整片看不见

**文字色**在"主题色"和"它的反色"里**自动挑对比度更高的那个**(拿菱形叠在深底上的合成色来比),
所以换背景后不会出现黑底黑字。想手动钉死就在 `hugo.toml` 那个面板里加 `fg = "#xxxxxx"`。

实测对比度:自我 3.2:1 / 成长 3.2:1 / 迷茫 6.3:1 / 技术 20.2:1 / 未来 5.7:1
(前两个是大字号够用、小字偏软;想更硬就手动 `fg` 或把该主题的 `bg` 调深一点)

辅助工具:`node tools/verify/ink-check.mjs` 会把这张对比度表打出来。

## 主界面(屏幕造型 / 状态栏 / 花屏)

- **屏幕贴图**:`static/assets/screen/frame.webp`(由 `screen.webp` 用"亮度→透明度"转出来,
  所以中心是透明的、金属边框保留)。想重做/换阈值就跑
  `node tools/verify/make-screen-frame.mjs [源图] [输出] [暗阈值] [亮阈值] [最大宽度]`,
  默认 `0.07 / 0.16`(低于 7% 亮度全透明、高于 16% 全不透明);换完刷新即可。
  贴图在 CSS 里是 `.screen-frame`(z-index 34,内容之上、状态栏之上),内容让开边框靠 `.screen` 的 padding。
- **状态栏**:首页的顶栏包在 `.statusbar` 里,上缘中间有个小把手(`#statusbar-toggle`)可收起/展开,
  状态记在 localStorage(`cd-statusbar`)。收起动画与位置在 `intro.css` 的 `.statusbar` / `body.statusbar-hidden`;
  顶栏的纵向位置由 `.screen` 的 `--sp-t` 决定(现在 13vh)。
- **开机动画(黑屏 loading → 六边形塌缩)**:回到主界面时播放,约 2.4 秒 ——
  先黑屏 + 转动的六边形 spinner + "LOADING x%",然后一整片**青色六边形蜂窝逐条描边画出**,
  再从中心向外**塌缩**露出界面。做法参考 JIEJOE 的 hexagons matrix(描边用 dash 偏移"画"出来 +
  从中心错开缩小),但用 canvas 原生 `setLineDash/lineDashOffset` 实现,没有引第三方库。
  时长/网格密度在 `intro.js` 顶部的 `HEX`(`load / draw / drawEach / collapse / collapseEach / fade / cols / rows`);
  手放一次:`window.__screenBoot()`。
- **电视雪花(备用)**:`runStatic(ms)` 还在,手动放一段:`window.__runStatic(1500)`。
- 打开 CD 架(= 光驱拔出)时屏幕是**纯黑**的,一直黑到插盘 —— 这段是 `.screen-static.is-black`。

## 鼓点律动(背景线与彩色多边形)

背景的**线**跟着鼓点伸长/变粗;**彩色多边形位置颜色全固定**(它们只是背景纹理,不闪)。
鼓点判定用**低频谱通量**(低频突增)而不是音量绝对值 —— 低频常年饱和在 1.0,绝对阈值法分不出来。
包络用半衰期衰减,所以低帧率下也不会被一帧清空。调参:`fx.beat`
(`thresh` 越小越容易触发、`gain` 越大跳得越猛、`halfLife` 越小越干脆)、`fx.lines.grow` 伸长幅度。

## 光驱音效(`audio` 段:前端实时合成,没有任何音频文件)

弹出 / 收回 / 末尾那声"咔哒" / CD 落入盘托 —— 四个音效由 Web Audio 现场合成(零音频文件、零依赖):

| 字段 | 作用 | 当前值 |
|---|---|---|
| `enabled` | 总开关(`false` = 完全不出声,顶栏也不显示喇叭按钮) | `true` |
| `master` | 总线音量(整体大小) | `0.5` |
| `eject` | 弹出音量的倍数(解锁 → 马达推出 → 撞限位 → 回弹落定) | `1` |
| `insert` | 收回音量的倍数(机构咬合 → 马达收回减速) | `1` |
| `snap` | 末尾急插那一顶的倍数 | `0.9` |
| `clack` | 锁扣"咔哒"的倍数(瞬态 + 硬塑料共振 + 机身闷响) | `1` |
| `disc` | CD 落入盘托的倍数(下落气流 → 轻碰 → 吸到主轴) | `0.75` |

- 音效时长**自动跟随动画时序**:改 `driveEjectMs` / `retractMs` / `retractPauseMs` / `retractSnapMs` / `cdDropMs`,声音会自动对齐,不用改代码
- "咔哒"是在收回动画末尾那 55ms 急插**落底的那一帧**触发的,与画面同帧
- 顶栏喇叭按钮可随时静音(记忆在 localStorage,键名 `cd-audio`)
- 浏览器自动播放策略:**首次访问、用户还没点过任何东西时**,那一次自动弹出是无声的;点过任意一次(例如点开 CD 架的箭头)之后所有音效正常
- 调试:`window.__cdAudio`(可 `render('clack')` 离线渲染看包络)、`window.__cdAudioDebug`(播放记录)

## Blender 导出规范

1. 物体命名与上表一致(要改名请同步改 manifest 的 `driveNode` / `cdNodes`)
2. glTF 2.0、**不勾 Draco / KTX2**、贴图嵌内(PNG/JPG)、勾选应用修改器
3. 导出时模型根节点保持单位变换(缩放/旋转做在对象上)
4. P2 的插拔动画命名:`A_Eject`(托盘弹出)、`A_Insert`(CD 滑入)、`A_Pin`(抓取拔出)

---

## CD 材质:程序化节点必须「烘焙成贴图」才能在网页生效

glTF 导出器**只携带"直接连在 Principled BSDF 输入上的图像纹理"**,以下节点会被静默丢弃:
噪波纹理、颜色渐变、矢量旋转、光泽 BSDF + 混合着色器、任何 Mix/数学节点。

### 烘焙步骤

1. **确认 UV**:每张 CD 有独立 UV(BaseColor 已有贴图就说明有 UV)
2. **新建 3 张图像**(建议 1024×1024):`Roughness`、`Normal`、`Metallic`
   - 色彩空间:Roughness / Metallic / Normal → **Non-Color**;BaseColor → sRGB
3. **用 Cycles 烘焙**(EEVEE 不支持烘焙这些通道;渲染引擎切到 Cycles):
   - 在材质里**选中**要写入的目标 Image Texture 节点 → 侧栏 `Bake`
   - `粗糙度(Roughness)` → 直接烘(把噪波→颜色渐变的成果烘成图)
   - `法线(Normal)` → 切线空间法线(划痕/纹理)
   - `Metallic`:Blender 无直接类型 → 把 metallic 数值/掩膜临时接到 **Emission**,用 `Emit` 类型烘一张灰度图
   - 采样 64–128,边距(Margin)8–16px,避免接缝
4. **把烘出的图接回 Principled BSDF**(关键):
   - Roughness 图 → `粗糙度`;Metallic 图 → `金属度`;Normal 图 → `法线贴图` 节点 → `法线`
   - **删掉原有的程序化节点**,否则导出器仍然读不到
   - `光泽 BSDF + 混合着色器` → 换用 Principled 自带的 `光泽(Sheen)`
5. **导出 glTF**:导出器会自动把 Roughness + Metallic 打包成一张 `metallicRoughness` 贴图

### 分辨率与体积建议

| 贴图 | 格式 | 说明 |
|---|---|---|
| BaseColor | JPG q90 | 已有 |
| Roughness | JPG q85 | 灰度即可 |
| Metallic | JPG q85 | 多为黑白掩膜 |
| Normal | PNG | 压缩损失会造成瑕疵 |

每张 CD 1024² 足够(屏幕上约 300–400px)。

### 前端侧说明

- CD 材质在运行时已升级为 `MeshPhysicalMaterial`(虹彩 / 清漆 / 各向异性)
- **一旦检测到你提供的 roughness / metallic 贴图,前端系数自动变为 1**,不会削弱贴图数值
- 想在贴图之上再叠一个系数,就在 manifest 的 `cdMaterial` 里显式写数值(会作为乘数)

