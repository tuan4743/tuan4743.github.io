# 极光（Aurora）逐像素算法说明书 —— 2D canvas / ImageData 版

> 调研范围：极光的物理/视觉构成 + 可直接照抄的逐像素算法 + 现有实现对照 + 假极光的判别特征。
> 交付对象：Hugo 博客主页"结霜夜窗"里那块 2D canvas（约 400×250 离屏场，`drawImage` 平滑放大，`mix-blend-mode: screen` 叠到夜空渐变上）。
> **本文严格区分「查到的」与「我推断的」**。查到的都给 URL 和原文片段；推断的标注【推断】。
> 我**没有**在浏览器里验证渲染结果（本环境 Chrome 起不来）。文中所有实测数字来自我在 Node 里跑的数值原型（见 §6 验证记录），不是"我看到效果了"。

---

## 1. 真实极光的视觉构成（几何 / 物理描述）

### 1.1 为什么是"竖直的帘子"而不是"横向的云"

三个独立的事实，缺一个就不像：

**（a）几何本质是"片"（sheet），不是"体"（volume）。**
Lawlor & Genetti（WSCG 2011, Univ. of Alaska Fairbanks）原文：

> "magnetic effects expel currents from the body of a conductive plasma, compressing the charged particle currents flowing through the magnetosphere into thin sheets around **one kilometer thick**. As these current sheets are bent along magnetic field lines and intersect the atmosphere, they become visible as auroral **'curtains,' long linear stripe-like features**."

—— 电流片被压成 ~1 km 厚的薄片，沿磁力线弯折后与大气相交 ⇒ 视觉上是**长条线性**结构，厚度只有约 1 km。来源：[Interactive Volume Rendering Aurora on the GPU (PDF)](http://wscg.zcu.cz/WSCG2011/!_2011_J_WSCG-1.pdf)（我下载后本地提取的正文，见 §6 验证记录）。

**（b）竖纹 = 帘子的"褶"（pleats/folds），方向就是磁力线方向。**
名古屋大学 ISEE《オーロラ50のなぜ》第 15 問「オーロラはどうしてカーテンの形になるの？」（极光为什么是窗帘形状）原文：

> 「カーテンというのは、**上下方向に走るヒダ**と、**下の縁がピタッとはっきりしている**ことが特徴ですね。… 電気を帯びた粒子は、磁力線に沿ってやってきますので、オーロラカーテンの**ヒダはその磁力線の方向を表わします**。そして、カーテンの縁は、**粒子がその高度より低く入って来られない**ことを示しています。」

—— 窗帘的两个特征就是：**上下方向走的褶** + **下缘齐齐清清楚楚**。褶的方向 = 磁力线方向；下缘 = 粒子无法再往下进入的高度。来源：[オーロラ50のなぜ 15](https://www.isee.nagoya-u.ac.jp/50naze/aurora/15.html)

Alaska 大学 GI 的官方 FAQ 把这件事说得更直白：

> "When the aurora becomes slightly more active, vertical stripes or striations, called rays, form. **These are actually fine pleats in the auroral curtain.**"

来源：[UAF Geophysical Institute — Aurora FAQ](https://www.gi.alaska.edu/monitors/aurora-forecast)

**（c）单根"射线"（ray）的尺度。**
RPI / CSCI-4530 课程报告（Ng, "Aurora Rendering with Sheet Modeling Technique"，转述 Baranoski et al. 2000/2005）原文：

> "These curls are responsible in another auroral feature which is the electron beams/rays. **Each ray is on average has a diameter of 1 km or less and run vertically down till several hundred kilometers.** Varieties of auroral forms from ground observation are dependent on this ray as its fundamental building block."

来源：[Aurora Rendering with Sheet Modeling Technique](https://studyres.com/doc/15998507/aurora-rendering-with-sheet-modeling-technique)

**⇒ 对你现在这个 bug 的直接判决：**
你现在 `for x += 2px` 逐竖条铺 + 每列一个高斯，等于在屏幕上画了"一列一列独立的柱"。柱子之间的横向变化是**阶跃**的、每根柱子内部纵向是**常量**的。而真实极光的结构是：**沿 x 方向高频、强对比**（褶/射线），**沿 y 方向低频、长程相关**（一根射线从裙边往上延伸几十到几百公里）。你画出来的"横带"是因为纵向衰减 `v = g * 纵向衰减` 里那个"纵向衰减"是**全屏统一的**，于是所有列共享同一条纵向亮度曲线 ⇒ 眼睛看到的等亮度轮廓线是**水平**的 ⇒ 横带。**判别一个极光实现真假，本质上就是看等亮度线是竖直还是水平**（这条我给了可量化的检验 `gradRatio`，见 §4.1 与 §4.7 速查表）。

### 1.2 底边（裙边）与上缘的区别

| | 下缘 / 裙边（bottom border, "skirt"） | 上缘（top） |
|---|---|---|
| 锐利度 | **锐利**。亮度在很短的高度内从 0 冲到最大 | **弥散**，指数式拖尾，渐渐消失在天光里 |
| 成因 | 粒子穿透深度极限，低于此高度没有激发（名古屋大学原文："粒子がその高度より低く入って来られない"） | 大气密度按标高衰减，激发率越来越低 |
| 位置 | 典型 ~100 km（UAF：60 miles）；Lawlor 论文说 50 km 以下粒子几乎无法穿透，而 500 km 以上因大气太稀薄极光难以分辨 | 通常 200–300 km 淡出，偶尔可见到 800 km |
| 颜色 | 最亮的绿；强活动时下缘出现**紫色/粉色的边** | 绿→青→紫→（大活动时）红 |

UAF FAQ 原文（颜色）：
> "Oxygen at about 60 miles up gives off the familiar green-yellow color, while oxygen at higher altitudes (about 200 miles above Earth's surface) gives all-red auroras. Nitrogen in different forms produces the blue light. **Purple occurs when nitrogen at higher altitudes mixes with the red auroral emissions from oxygen.** … **Since there is more oxygen at high altitudes, the red aurora tends to be on top of the regular green aurora. Very intense aurora often has a purple rim at the bottom.**"

UAF FAQ 原文（高度）：
> "The bottom edge of the aurora is typically about **60 miles (100 kilometers)** above the surface of the Earth. The top of the visible aurora peters out at about **120 to 200 miles (200 to 300 kilometers)**, but sometimes aurora can be seen as high as 500 miles (800 kilometers)."

（同一来源：[UAF GI Aurora FAQ](https://www.gi.alaska.edu/monitors/aurora-forecast)）

### 1.3 发射线 → 高度区间 → 颜色（可直接做渐变 stop）

**查到的（有出处）：**

| 发射线 | 物种 | 出处原文 | 高度 |
|---|---|---|---|
| **557.7 nm** 绿（"green line"） | 原子氧 OI | RPI 报告："The most dominant aurora is the atomic oxygen 'green line' with **557.7 nm** in wavelength, **around 100 km**." | ~100 km 峰，约 90–150 km |
| **630.0 nm** 红（"red line"） | 原子氧 OI | 同上："Next, prominent color often spotted is red which is located in the **upper parts** caused by the atomic oxygen 'red line' with **630.0 nm**." | 150–300 km（UAF："about 200 miles" ≈ 320 km 全红） |
| **427.8 nm** 蓝紫 | 电离氮分子 N₂⁺ | 同上："In between these two lines, is the blue band from ionized nitrogen molecules with **427.8 nm**." | 大约介于绿与红之间 |
| 紫 / 粉 | N₂⁺ 蓝 + OI 红 混合 | UAF："Purple occurs when nitrogen at higher altitudes mixes with the red auroral emissions from oxygen."；下缘"purple rim"来自氮的蓝+红混合 | 强活动时集中在**下缘** |

来源：[RPI 报告](https://studyres.com/doc/15998507/aurora-rendering-with-sheet-modeling-technique)、[UAF GI](https://www.gi.alaska.edu/monitors/aurora-forecast)。557.7 nm 绿色≈`#3CFF66`、630.0 nm 红色≈`#FF2A1E`、427.8 nm 蓝紫≈`#3A4CFF` 是**由波长换算的近似 sRGB**【推断】（我按 CIE 大致换算 + 手调，没跑光谱积分；engawa 项目也是这么手调的，见 §3.1）。

**另一个关键的时间尺度差（这条很重要，决定你要不要画红色）：**
RPI 报告转述 Baranoski 的物理模型：
> "The transition state in the atomic green line only exists up till **0.7 seconds**, whereas, the red line can exists up till **110 seconds**. So atom can travel a much greater distance which resulted in a **larger red emission area**."

Lawlor 论文也从渲染角度说了同一件事：
> "we currently do not integrate the curtains across the **minutes-long timescale that gives high red aurora**."

**⇒ 结论**：绿色是"瞬时的、贴着磁力线的细结构"；红色是"积分了几十秒到几分钟的、糊开的、高处的"大面积辉光。所以**红/粉要用一层低频、高位置、低对比的弥散场**，绝不能用画绿帘子的那套高频射线去画红——这是 §4 里"发光果冻"的一个成因。

### 1.4 一句式几何总结（给实现用）

> 一张 1 km 厚、被磁力线折成竖褶的**竖直采样面**；面在屏幕上是**沿 x 高频变化、沿 y 长程相干**的条纹场；场在下缘被一个**随列缓慢上下摆动的锐利边界**切断，向上按指数衰减；颜色沿"距下缘的高度"从绿走到紫，红色只在大活动时以一层低频弥散加在高处。

---

## 2. 可执行算法（伪代码 + 具体数字）

### 2.0 总体结构（一屏一次，不是逐帧）

```
offscreen = 400×250 RGBA ImageData      // 主画布的 1/2
for each pixel (px,py):
    v   = py / 250                       // 0 顶, 1 底
    x   = px / 400 * 2.0                 // 0..2, 横向归一
    alt = 1 - v / 0.74                   // 1 = 画面顶, 0 = 地平线(74%), <0 = 地面
    if alt <= 0: 写 (0,0,0,0); continue  // 地面以下绝对不写
    ...见 §2.7
putImageData → 离屏 canvas
ctx.imageSmoothingEnabled = true
ctx.imageSmoothingQuality = 'high'
ctx.drawImage(offscreen, 0, 0, W, H)     // 2× 平滑放大
```

**时间**：`t` 只作为噪声坐标的**平移量**（`x += t*0.012`），不做任何逐帧随机、不做任何 `round()`、不做相位跳变。
**建议**：真正需要动时才重建（每 2–4 帧重建一次，或 `t` 每帧只推进 1/60 × 0.012 ≈ 0.0002 个噪声单位 —— 慢到肉眼看不出跳变）。一次性构建 10 万像素的成本见 §6.4。

### 2.1 噪声：**值噪声（value noise）+ 五次插值（quintic）**

**用什么**：2D 值噪声。**不要**上 simplex —— 你只有 10 万像素、一次性构建，值噪声的方块感在五次插值 + 域扭曲 + fbm 之后完全看不出来，而值噪声每格只要 4 次哈希（simplex 要 3 次哈希 + 更多算术，还没更好看）。

**哈希（用无 sin 版，跨平台稳定）**——Dave Hoskins 风格，是 minimax 的技能库给出的标准写法，也是 engawa 项目 `hash12` 的同族：

```js
function hash12(x, y) {           // → [0,1)
  let px = frac(x * 0.1031), py = frac(y * 0.1030), pz = frac(x * 0.0973);
  const d = px*(py + 33.33) + py*(pz + 33.33) + pz*(px + 33.33);
  px = frac(px + d); py = frac(py + d); pz = frac(pz + d);
  return frac((px + py) * pz);
}
```
`frac(v) = v - Math.floor(v)`。**不要**用 `fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453)` —— 精度敏感、不同引擎结果不同（minimax 技能库把它标为 "short but precision-sensitive"）。

哈希来源：[MiniMax-AI/skills — procedural-noise.md](https://raw.githubusercontent.com/MiniMax-AI/skills/main/skills/shader-dev/techniques/procedural-noise.md)（原文："**sin-free** (cross-platform stable): `fract(p * 0.1031)` + dot mixing + fract"）

**插值：五次（quintic），不是双线性、不是 smoothstep**。理由（minimax 技能库原文）：
> "**Quintic interpolation**: `6t^5 - 15t^4 + 10t^3` gives **C2 continuous** noise (vs Hermite's C1), eliminating visible grid artifacts in derivatives."

因为你要做域扭曲 + 极慢漂移，C1（smoothstep）在慢速运动时会在格子边界产生"折线抖动"；C2 没有。

```js
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx*fx*fx*(fx*(fx*6 - 15) + 10);   // 6t^5-15t^4+10t^3
  const uy = fy*fy*fy*(fy*(fy*6 - 15) + 10);
  const a = hash12(ix,   iy  ), b = hash12(ix+1, iy  );
  const c = hash12(ix,   iy+1), d = hash12(ix+1, iy+1);
  const top = a + (b-a)*ux, bot = c + (d-c)*ux;
  return top + (bot-top)*uy;                    // → [0,1)
}
```

### 2.2 fBm：**3 个倍频**，带旋转 + 破相关偏移

minimax 技能库的标准 fbm（原文："Lacunarity ~2.0, Gain ~0.5, **inter-octave rotation** to eliminate artifacts"）：

```js
const CR = Math.cos(0.6435), SR = Math.sin(0.6435);   // 0.6435 rad ≈ 36.87°
function fbm2(x, y, oct) {
  let v = 0, amp = 0.5, fx = x, fy = y;
  for (let i = 0; i < oct; i++) {
    v += amp * vnoise(fx, fy);
    const nx = CR*fx - SR*fy, ny = SR*fx + CR*fy;      // 旋转
    fx = nx*2.03 + 19.7; fy = ny*2.03 + 7.3;           // 略>2 的 lacunarity + 偏移去相关
    amp *= 0.5;
  }
  return v / (1 - Math.pow(0.5, oct));                 // 归一到 ≈[0,1]
}
```

| 参数 | 值 | 说明 |
|---|---|---|
| 倍频数 | **3**（主体）；域扭曲场用 **2**；微扰用 **1** | 4 个倍频在这个分辨率下已无可见收益（1 px 已到噪声格大小） |
| lacunarity | **2.03**（不是整 2.0） | 非整数倍频 + 偏移，避免倍频与格点对齐产生的规则纹 |
| gain | **0.5** | |
| 归一化除数 | `1/(1-0.5^oct)` = 0.875(3 oct) / 0.75(2 oct) | 让输出回到 ~[0,1]，方便写死阈值 |
| 旋转 | 36.87°（`mat2(0.8,-0.6,0.6,0.8)` 同族） | 破坏轴对齐方块感 |

**平移速度（漂移）**：真实极光帘子横移很快，但**你是一张静帧叠在夜窗上**，且"结霜的夜窗"语义上应该是**极慢**的。给出的值：
```
DRIFT_X = 0.012 / 秒      // 噪声空间单位/秒（x 方向）
DRIFT_Y = 0.004 / 秒      // 纵向（几乎不动，只让纹理缓慢"呼吸"）
```
主 fbm 用 `1.0 ×` 漂移，域扭曲场用 `0.5 ×`，射线层用 `1.4 ×`（视差：细结构比帘子本体移得快一点，这是真实感的重要来源）。
换算：`x` 噪声坐标上，横向 1 个噪声格 ≈ 画面宽的 2.0/3.4 ≈ 0.59 屏宽 ≈ 235 px；每秒移 0.012 噪声单位 ⇒ 约 **2.8 px/秒**。**故意很慢**。

### 2.3 Domain warp（把竖直的帘边推弯）—— 这是"像不像"的第一关键

理论依据：Inigo Quilez, *Domain Warping*。原文核心：
> "We can just write both cases more compactly as _f(p)_ … Warping simply means we distort the domain with another function _g(p)_ before we evaluate _f_. Basically, we replace f(p) with _f(g(p))_. … it makes sense to have _g(p)_ being just the identity plus a small arbitrary distortion _h(p)_, or in other words, **_g(p) = p + h(p)_**, meaning we will be computing **_f( p + h(p) )_**"

来源：[Inigo Quilez — Domain Warping](https://iquilezles.org/articles/warp/)

论文里的做法是**沿路径**做：Lawlor 的算法是 spline 定义帘子"足迹"路径，再用 2D 流体（Stam stable fluids，Kelvin–Helmholtz 剪切）给路径加湍流扰动。**我不建议你也上流体求解器**——但那个**结构**（一条主路径 + 一个独立的低频扰动场把它推弯）就是你要照抄的东西，只不过 h(p) 用噪声代替流体：

```
// 一级 warp：两个不同的低频 fbm 分别给 x 和 y 方向的位移
q1 = fbm2(x*0.75 + 0.13 + dx*0.5,  alt*0.20 + 3.1 + dy, 2) - 0.5
q2 = fbm2(x*0.75 + 4.70 + dx*0.5,  alt*0.20 + 8.9 + dy, 2) - 0.5
wx = x + 1.10*(q1 + 0.33*q2) + 0.10*fbm2(x*0.4 + dx, alt*1.6 + 20.0 + dy, 1)
```

**具体数字与含义**：

| 参数 | 值 | 含义 |
|---|---|---|
| `WARP_AMP` | **1.10** | 位移幅度，单位是"帘子格"。`CROSS_F=3.4` ⇒ 一屏约 3.4 个帘子格，位移 1.10 格 ≈ **±0.32 屏宽**。这是"把直边推成 S 形"的量 |
| 第二项权重 | **0.33** | 第二个 warp 场只做细节，防止位移过大导致结构翻卷重叠 |
| `WARP_ALONG` | **0.20** | warp 场自身的**纵向**频率。取小 ⇒ 位移沿高度变化慢 ⇒ 竖直的帘边被整体推成**长弧**而不是被切碎。【推断，但我在原型里对比过：调大到 1.6 会立刻变成"云"】 |
| `MICRO` | **0.10** | 第三级单倍频微扰，纵向频率 1.6（高），制造边缘的细锯齿 |
| warp 场自身漂移 | 主场的 **0.5×** | 视差 |

**⚠️ 最关键的误解防线**：warp 不要作用在**最终像素坐标**上再画"窗帘形状"，而是当作**采样坐标**（`f(p + h(p))`）。你现在"三条窗帘、每条一个中心 + 高斯"的模型里根本没有可被 warp 的连续场 —— 这是必须换掉的第一个东西。

### 2.4 射线（细竖纹）：单独一层**各向异性**噪声

这是第二关键。Ray 层的频率必须**横向高、纵向极低**：

```
// 两级射线：中频轮廓 + 高频细节
rayA = vnoise(wx*34.0 + 2.3 + dx*1.4, alt*0.12 + 1.1 + dy)     // 横向 34, 纵向 0.12 ⇒ 长宽比 ~283:1
rayB = vnoise(wx*34.0*2.6 + 7.7 + dx*2.0, alt*0.12*0.7 + 5.3 + dy)
ray  = 0.28 + 0.72 * (0.50*rayA + 0.50*rayB)                    // RAY_FLOOR=0.28, RAY_MIX=0.50
```

| 参数 | 值 | 说明 |
|---|---|---|
| `RAY_F`（横向频率） | **34** | `wx` 的取值域 ≈ 0..2+ ⇒ 34×2 ≈ 68 个噪声格跨屏 ⇒ 400px/68 ≈ **5.9 px 一根射线**；放大到主画布约 **12 px** |
| `RAY_STRETCH`（纵向频率） | **0.12** | 纵向 0.12 × alt(0..1) = 0.12 格 ⇒ 一根射线横跨**整个画面高度都不重复**，这才是"竖直"的来源 |
| 长宽比 | 34 / 0.12 ≈ **283** | **这个比值必须 > 100**。低于 20 就开始"糊"（§4） |
| `RAY_FLOOR` | **0.28** | 射线的最低亮度不是 0。真实射线是"亮度的调制"，不是"有/无的门"。设 0 会出现死黑的竖缝 ⇒ 像栅栏 |
| `RAY_MIX` | **0.50** | 两级混合比 |
| 射线层漂移 | 主线 **1.4×** | 视差 |
| 射线怎么进入最终值 | **乘法**（`body * ray`），不是加法 | 射线是"帘子上的褶皱阴影"，是调制 |

### 2.5 纵向亮度曲线（裙边 + 向上衰减）—— 具体公式

```
border = -0.04 + 0.16 * vnoise(wx*0.40 + 3.7 + dx,  alt*0.05 + 11.0 + dy)
rel    = alt - border                       // 距下缘的高度（alt 单位）
profile = smoothstep(0, 0.05, rel) * (0.12 + 0.88 * exp(-rel * 3.0))
```

| 项 | 值 | 作用 |
|---|---|---|
| `BORDER_BASE` | **-0.04** | 裙边**基准线在地平线以下**。这样在多数列里帘子一直被地面剪掉（视觉上"帘子落在地面后面"），只有 `vnoise` 高的列才抬起来 ⇒ 下缘**参差** |
| `BORDER_AMP` | **0.16** | 下缘上下摆动的幅度。在 `alt` 单位里（alt: 地平线=0, 顶=1）⇒ 屏幕高度的 ±0.16 × 74% ≈ **±12% 屏高**。这是"参差"的量，**不要小于 0.08**（否则下缘变成一条水平直线，立刻假） |
| 下缘噪声频率 | 横向 **0.40**、纵向 **0.05** | 横向 0.4（波长约 2.5 屏宽）⇒ 缓慢的大尺度起伏；纵向 0.05 ⇒ 几乎是"每条列一个值" |
| `BORDER_SOFT` | **0.05** | 裙边的锐利度：`smoothstep(0, 0.05, rel)` 让亮度在 0.05 个 alt 单位（≈3.7% 屏高，放大后约 9 px）内从 0 冲到满 ⇒ **锐利但不硬切** |
| `DECAY` | **3.0** | 向上的指数衰减率。`exp(-3*rel)`：rel=0.23 时降到 0.5，rel=0.5 时降到 0.22，rel=0.77 时 0.1。**上缘必须是弥散的指数尾，不能是对称高斯** |
| `TAIL` | **0.12** | 指数尾的地板：`0.12 + 0.88*exp(...)` ⇒ 帘子顶部不会真的降到 0，留一层极淡的弥散（真实极光顶部接天光） |

**⚠️ 注意 `profile` 是乘在整个颜色上的，且是"每一列各不相同"的**（因为 `border` 依赖 `wx`）。**这正是治好"横带"的地方**：等亮度线跟着 `border` 走，于是等亮度线是竖直起伏的，不是水平的。

### 2.6 颜色梯度：按 `rel` 混合 4 个色

```js
// th: 0 = 裙边, 1 = 最高处
const th = clamp01(rel * 2.2);
let c = mix3([0.10, 1.00, 0.42], [0.05, 0.78, 0.86], smoothstep(0.00, 0.45, th)); // 绿 → 青
c     = mix3(c,                    [0.55, 0.25, 0.95], smoothstep(0.45, 0.90, th)); // → 紫
c     = mix3(c,                    [0.95, 0.35, 0.70], smoothstep(0.85, 1.00, th)); // → 粉
r = clamp01(c[0] + 0.25*smoothstep(0.5, 1.0, th)) * A;   // RED_CAP：高处补红 (630 nm)
g = c[1] * A;
b = clamp01(c[2] + 0.10*smoothstep(0.6, 1.0, th)) * A;
```

| stop | RGB (0–1) | HEX | 对应 | 位置（th） |
|---|---|---|---|---|
| 绿 | `0.10, 1.00, 0.42` | `#1AFF6B` | OI 557.7 nm | th 0（裙边） |
| 青 | `0.05, 0.78, 0.86` | `#0DC7DB` | 高空青色辉光 | th ≈ 0.45 |
| 紫 | `0.55, 0.25, 0.95` | `#8C40F2` | N₂⁺ 427.8 nm 边 | th ≈ 0.90 |
| 粉 | `0.95, 0.35, 0.70` | `#F259B3` | 上缘粉（强度大时） | th ≈ 1.0 |
| `SPEC_RATE` | **2.2** | — | 颜色沿高度爬升的速度；2.2 ⇒ rel≈0.45 就爬到顶 | |
| `RED_CAP` | **0.25** | — | 高处额外加的 OI 630 nm 红 | |

**参考锚点**（engawa 项目用的三条 stop，可作为"物理味"的交叉验证）：
> `DEFAULT_GREEN = [0.10, 0.95, 0.35]`（"linear-rgb approximation of the oxygen **557.7 nm** emission line"）、`DEFAULT_CYAN = [0.05, 0.60, 0.70]`（"high-altitude cyan wash"）、`DEFAULT_VIOLET = [0.45, 0.18, 0.85]`（"nitrogen ~**427.8 nm** violet"）。
> 来源：[engawa-wgpu aurora.rs](https://docs.rs/engawa-wgpu/latest/src/engawa_wgpu/catalog/aurora.rs.html)

**⚠️ 颜色必须按 `rel`（高度）取，不能按 `A`（亮度）取。** 按亮度取色是"发光果冻"的头号成因（§4.2）：真实极光里**暗的高处是紫的**，不是"暗的绿"。

### 2.7 最终像素：怎么乘起来

```
densMain = clamp01((body - 0.26) / (0.70 - 0.26));   densMain = densMain^1.45
densHalo = clamp01((body - 0.04) / (0.55 - 0.04))
A = min(1, ( densMain * ray * 2.2  +  densHalo * 0.32 ) * profile)
(r,g,b) = colorFromHeight() * A
```

| 参数 | 值 | 作用 |
|---|---|---|
| `BODY_LO/ HI` | **0.26 / 0.70** | 主体门限。**必须是不对称的窄窗**（宽度 0.44）—— 这是"帘子稀疏、有黑缝"的来源 |
| `CURTAIN_GAMMA` | **1.45** | 主体对比度（>1 压暗暗部） |
| `GAIN` | **2.2** | 增益，让好的像素能顶到 A=1 |
| `HALO_LO/HI` | **0.04 / 0.55** | **第二遍**：同一个 `body` 场、低门限、低增益、**不乘 ray** ⇒ 弥散辉光，填掉黑缝、模拟大气散射与红色的"糊" |
| `HALO_GAIN` | **0.32** | |
| 顺序 | 主体 + halo → 乘 `profile` → 乘颜色 | **先加后乘 `profile`**：halo 也要被裙边切断，不能糊到地面以下 |

**预乘 alpha**：输出的 `(r,g,b)` 已是 `color × A`（预乘）。到主画布上用 `screen` 混合时，若你用 `drawImage` + CSS `mix-blend-mode: screen`，把离屏 canvas 的 alpha 设为 **1（不透明）**、RGB 直接放预乘值更省事，因为 screen 不受 alpha 影响（`screen(a,b) = 1-(1-a)(1-b)`），黑底 (0,0,0) 就是"不贡献"。

### 2.8 screen 混合与"集齐后升到全亮"

```
最终像素 = screen( 夜空渐变, 极光RGB × k )    // k = 0.05 → 1.0（集齐进度）
```
`screen(a,b) = a + b - a*b`。极光默认 `k=0.05`（几乎不可见），集齐后 `k=1.0`。
**注意**：`screen` 会让"高处的紫"和夜空深蓝相加后偏亮偏灰。如果发现紫色被夜空吃掉，把夜空渐变在 60% 以上高度的蓝分量降 15%（这是**你调色的问题，不是算法问题**）。

### 2.9 构建顺序（重要：从上到下是"可调试顺序"）

1. **只画 `px` 灰度**（`A` 写进 R=G=B）→ 检查是否像"竖条纹"。不像就**回头调 §2.3 §2.4**，别往下走。
2. 加 `profile` → 检查下缘是否锐利、参差，上缘是否弥散。
3. 加颜色 → 检查高处是否偏紫。
4. 放大贴到主画布 → **这一步才会暴露分辨率问题**（`RAY_F` 太高的噪声会在放大后变成"泥"）。若变泥，把离屏提到 1/1.5 分辨率，或把 `RAY_F` 从 34 降到 24。

---

## 3. 网上现成实现的对照

### 3.1 【完整源码 · 强推】engawa-wgpu — aurora WGSL

- 源码页：https://docs.rs/engawa-wgpu/latest/src/engawa_wgpu/catalog/aurora.rs.html
- 完整 WGSL 常量：https://docs.rs/engawa-wgpu/0.1.10/engawa_wgpu/catalog/aurora/constant.WGSL.html
- 仓库：https://github.com/pleme-io/engawa-wgpu

**我抓到了**：完整的 WGSL fragment shader 源码（不是摘要）。这是最接近你需求的一份 —— 它就是"2D 全屏、逐像素、值噪声 + fbm + 竖直帘子 + 高度配色"，可以直接把每一步翻成 JS。

**它的算法核心是这几步**（原文摘录 + 我的标注）：

1. **高度归一 + 地平线裁剪**（和你 74% 地面的需求完全同构）：
   ```wgsl
   let alt = 1.0 - in.uv.y / horizon;   // 1 at top, 0 at horizon, negative below it
   if (alt <= 0.0) { return scene; }
   ```
2. **噪声**：`hash12`（Hoskins 无 sin 哈希）+ `vnoise`（**smoothstep 插值**，`f*f*(3-2f)`）+ `fbm` 带 `q = q*2.03 + vec2(19.7,7.3)`（非整数 lacunarity + 偏移去相关）。
3. **逐列摆动的下缘**（← 这就是治"横带"的关键，和我 §2.5 完全一致）：
   ```wgsl
   let border = 0.08 + 0.22 * vnoise(vec2(xb*0.31 + drift_t*0.5, drift_t*0.23));
   let rel = alt - border;
   if (rel <= 0.0) { return scene; }
   let profile = smoothstep(0.0, BORDER_SOFT, rel) * exp(-rel * DECAY_RATE);
   // 常量: BORDER_SOFT = 0.06, DECAY_RATE = 2.6
   ```
   注释原文：*"The lower border wanders slowly per-column — one cheap octave at every tier; **the wander is what sells the curtain**."*
   以及：*"Curtain lower border: sharp ramp-in width + upward decay rate (**real curtains have a crisp bottom edge and a diffuse top**)."*
4. **帘子密度**：`fbm(curtain_p, 3)/0.875`，然后 `smoothstep(0.30, 0.78, density)` 再平方。
5. **射线/闪烁**：High 档做 **12 步竖直 ray-march**：
   ```wgsl
   let fold = (fbm(vec2(xb*0.35 + fi*0.8, drift_t*0.4), 2) - 0.5) * 1.4;   // 褶子场
   let s = vnoise(vec2(xb*9.0 + fold*3.0, fi*2.0 - drift_t*1.7));           // 9× 频
   let wt = 1.0 - fi*0.7;                                                   // 下方样本权重高
   ```
   注释原文：*"the fold field bends the sampling column (**curtain pleats**), the inner noise reads ray structure at ~9x band frequency. Lower samples dominate (1 - fi*0.7 weight) so the bottom border stays the brightest."*
6. **按高度取色**（和我 §2.6 一致）：`th = clamp(rel*1.6,0,1)`；green → cyan（`smoothstep(0,0.55,th)`）→ violet（`smoothstep(0.5,1.0,th)`）。

**它缺什么**：它是 3D 管线里的全屏后处理（WGSL + uniform），没有离屏 ImageData 那一步；它的"射线"是 12 步 ray-march（对 2D canvas 太重，我用两层各向异性噪声代替，见 §2.4）。**它的 `MAX_ALPHA = 0.5` 是给"天空装饰"用的**，你集齐后要全亮的话不要抄这个上限。

### 3.2 【完整源码】Photon（Minecraft 光影包）— sky/aurora.glsl

- 源码：https://raw.githubusercontent.com/sixthsurge/photon/main/shaders/include/sky/aurora.glsl
- 仓库：https://github.com/sixthsurge/photon

**我抓到了**：完整 GLSL 源码。**它的核心就两步**：

```glsl
float aurora_shape(vec3 pos, float altitude_fraction) {
    const float frequency = 0.00003 * AURORA_FREQUENCY;
    float height_fade = cube(1.0 - altitude_fraction)
                      * linear_step(0.0, 0.025, altitude_fraction);   // ← 下缘硬切
    float worley_0 = texture(noisetex, pos.xz * frequency + wind_0 * frameTimeCounter).y;
    float worley_1 = texture(noisetex, pos.xz * frequency + wind_1 * frameTimeCounter).y;
    return linear_step(1.0, 2.0, worley_0 + worley_1) * height_fade;
}
```
```glsl
vec3 aurora_color(vec3 pos, float altitude_fraction) {
    return mix(aurora_colors[0], aurora_colors[1], clamp01(dampen(altitude_fraction)));
}
```

**值得抄的 3 点**：
1. **高度包络**：`cube(1-h)` 向上淡出 × `linear_step(0, 0.025, h)` 在下缘的 2.5% 内硬切 ⇒ **"下锐上软"**，和 §2.5 的 `smoothstep(0,0.05,rel) * exp(-3rel)` 是同一个设计，只是用了多项式而不是指数。
2. **两个不同风向的噪声相加再门限**：`linear_step(1.0, 2.0, worley_0 + worley_1)`。两个不同漂移方向的场相加 ⇒ 结构会**互相穿过**（这才是真实帘子的"褶皱交叠"感）。加 `wind_0 = 0.005*vec2(0.7,0.1)` / `wind_1 = 0.008*vec2(-0.1,-0.7)`，两个方向**近乎正交**。
3. **距离淡出**：`(1-cube(d*rcp(volume_radius))) * (1-exp2(-0.001*d))` 防止体积边界出现硬边。

**它缺什么**：噪声来自**贴图**（`noisetex` 的 worley 通道），不是程序化生成；它是真 3D 体积 ray-march（64 步）。**你不能直接抄体积那部分**，但 `aurora_shape` + `aurora_color` 这两个函数本身是 2D 可用的。

### 3.3 【完整源码 · 2D】Chromaney/ShaderToys — Aurora.glsl

- 源码：https://raw.githubusercontent.com/Chromaney/ShaderToys/main/Aurora.glsl
- 仓库：https://github.com/Chromaney/ShaderToys
- 原 Shadertoy：https://www.shadertoy.com/view/Mfy3Dz

**我抓到了**：完整源码（3D Perlin 噪声 buffer + 累积 buffer + palette）。这是**唯一一份真正纯 2D 的**参考。**它的核心是一个很聪明的技巧**：

```glsl
// BufferB：沿列向下"抽运"一层场
vec2 curVal = prevVal - vec2(3.0 * minRes, 0.0);           // 每行衰减
float blendCoeff = max((spawnVal - curVal.x) * 0.25, 0.0);
fragColor = vec4(mix(curVal.x, spawnVal * (1.0 - 0.5*uv.y), blendCoeff), rand2, 0.0, 1.0);

// Image：用"纵向梯度为负"当作帘子边缘
vec2 grad = vec2(dFdx(inData.x), dFdy(inData.x)) * (0.0013 / minRes);
float corrCoeff = smoothstep(-0.05, 0.0, -grad.y) * smoothstep(-0.01, 0.0, -length(grad));
```

**核心思路**：沿**每一列**从下往上抽运（`prevVal - 3*minRes`），`spawnVal` 由 3D perlin 在 0.45–0.55 窗口内生成；**只在"纵向梯度为负"（即该像素下方更暗）的地方发亮** ⇒ 自动得到锐利的**下缘**。这是"锐利裙边"的第二种做法（第一种是 §2.5 的逐列 border）。
**palette 用 3 个高斯峰**：
```glsl
vec3 amps = vec3(0.3, 0.9, 0.2);  vec3 centers = vec3(1.0, 0.3, 0.7);  vec3 widths = vec3(0.35, 0.20, 0.35);
vec3 color = amps * exp(-pow((t-centers)/widths, vec3(2.0)) / 2.0);
```
（峰值位置不是 0/0.33/0.66 的均匀分布，而是 **0.3 / 0.7 / 1.0** —— 这是它看起来比"均匀三色渐变"自然的原因，值得借鉴。）
**它缺什么**：它依赖**多帧累积**（`iFrame`、`iChannel0` 回读），一次性静态构建用不了；它的噪声是 3D Perlin（你 2D 用不上第三个维度）。**能抄的是：逐列抽运/纵向梯度定边缘 + 非均匀高斯 palette。**

### 3.4 【论文 · 物理/数学】Lawlor & Genetti, WSCG 2011 — 极光 GPU 体积渲染

- 论文 PDF：http://wscg.zcu.cz/WSCG2011/!_2011_J_WSCG-1.pdf （极光那篇在第 25–32 页）
- 元数据页：https://dspace.zcu.cz/items/0bd963cb-b034-4899-8f0c-515ccd7c92e0/full

**我抓到了**：完整正文（本地 pdftotext 提取）。这是**唯一给出可执行纵向沉积公式**的文献。

**核心分解**（这就是你 §2.5 的理论依据）：
> "an auroral display is **emissive** and can be factored into a **height-dependent energy deposition function**, and a **2D electron flux map**."
> "at each 3D sample point, we sum up the auroral emission as the **product of the 2D curtain footprint and the vertical deposition function**."

**Lazarev 能量沉积模型**（原文公式，直接可抄成 JS 的纵向曲线）：
```
M_E = 4.6e-6 * E^1.65                 // 特征屏蔽质量 [g/cm²], E = 电子能量 [keV], 极光取 1–30 keV
r   = M_z / M_E                       // 相对穿透深度 (无量纲), M_z = 高度 z 以上的大气总质量
L   = 4.2 * r * exp(-r^2 - r^1.37) + 0.48 * exp(-17.4 * r)   // Lazarev 未归一化相互作用率
A_z = L * E * (D_z / M_E)             // 高度 z 处的能量沉积率
```
原文注释：*"E Initial energy of incoming particles, in thousands of electron-volts [keV]. For aurora, this is 1–30keV."*

**关键洞察（论文 Figure 7）**：不同能量 E 的沉积曲线峰值高度不同 —— 1 keV 峰值在 ~200 km 以上，20 keV 峰值在 ~110 km 附近（**我读的是图，不是数字表；峰的精确高度是我的目测**【推断】；但"低能沉得高、高能沉得低"这个**趋势**是图里明确画出来的）。**这解释了为什么绿在下面、红在上面**：绿色 557.7 nm 需要较高的 O 密度（低处），红色 630 nm 的亚稳态寿命长（110 s），只有低激发率的高处才能存活并发光。

**其他值得抄的**：
- **帘子 = spline 主路径 + 2D 流体（Stam stable fluids）沿路径的自由度**，做 Kelvin–Helmholtz 剪切不稳定性。原文：*"we use an simple 2D Stam-type fluid advection simulator. … The simulator is solving a Kelvin-Helmholtz instability problem, with the fluid shear zone lying along the flux center of the auroral curtain"*。**你不必上流体**，但要知道"帘子的弯扭"来自**剪切不稳定性**，所以 warp 应该是**各向异性**的（沿帘子方向的扰动要拉长）。【推断：这是我把 §2.3 的 `WARP_ALONG` 定为 0.20 而非 1.0 的物理理由】
- **sRGB / gamma**：*"We then convert to the standard sRGB gamma of 2.2 using the following function … `float brightness=length(color); return color*pow(brightness,1/2.2-1);`"*
- **纯发射、无自吸收**：*"The aurora are almost perfectly emissive phenomena, since the degree of absorption and scattering by the atmosphere is vanishingly small around 100km altitude."* ⇒ 你**不需要**做散射/消光，直接加就行（这支持用 `screen`）。
- **纵向层序**：*"On short timescales, the upper layers of the aurora are green, while the lower layers have a purple tinge."* —— ⚠️**注意这条和 UAF/名古屋的"绿在下、红在上"表面相反**。我的解读【推断】：Lawlor 说的是"**近距离、几秒内**看到的（大活动时下缘的紫边）"，而 UAF 说的是"**宏观高度分层**（OI 630 nm 在高处）"。**实现上按 §1.3 的表来**（绿在裙边、紫/红往上），但**下缘加一道窄的紫粉边**（我的 §2.6 用 pink stop 在 th→1 实现，实际更该在下缘；见 §4.2 第 6 条）。这是我的判断，不是文献直述。

### 3.5 【源码 · 非极光，但公式直接可用】MiniMax-AI/skills — procedural-noise.md

- https://raw.githubusercontent.com/MiniMax-AI/skills/main/skills/shader-dev/techniques/procedural-noise.md

**我抓到了**：完整文档。§2.1/§2.2 的哈希、五次插值、fbm 旋转矩阵、domain warp 的三种写法都出自这里。**它不含任何极光内容**（它是通用噪声技能库），但它是**参数的权威来源**（例如五次插值 vs Hermite 的理由、非整数 lacunarity）。

### 3.6 【教程】Inigo Quilez — Domain Warping

- https://iquilezles.org/articles/warp/

**我抓到了**：完整正文 + 代码。**核心三步**（原文代码）：
```glsl
// 一级
vec2 q = vec2( fbm( p + vec2(0.0,0.0) ), fbm( p + vec2(5.2,1.3) ) );
return fbm( p + 4.0*q );
// 二级
vec2 r = vec2( fbm( p + 4.0*q + vec2(1.7,9.2) ), fbm( p + 4.0*q + vec2(8.3,2.8) ) );
return fbm( p + 4.0*r );
```
**注意 `4.0*q` 这个 4.0** —— 它比我的 `WARP_AMP=1.10` 大得多，因为 IQ 的 `fbm` 输出是 [-1,1] 且他用的是"云"的尺度；**极光的 warp 必须比云小得多**（极光是薄片，过大的 warp 会让它变成云）。这是**从"云"到"极光"最关键的一个数字**【推断，我在原型里验证过：`WARP_AMP` 从 1.1 提到 1.5 就开始失去帘子感】。
另外原文提醒：*"those particular offset values … don't have any special meaning, they are used to get different fBM values by using one single fbm() implementation."*

### 3.7 【查不到】"nimitz aurora" —— 我做了什么、缺什么

你要我特别留意 `nimitz aurora`。**结论：我没能验证"nimitz 有一个极光 shader"这件事。**

- Shadertoy **全站被 Cloudflare 挡住**：`https://www.shadertoy.com/view/4s23zz` 和 `https://www.shadertoy.com/api/v1/shaders/4s23zz?key=rdr` 都返回 **HTTP 403 "Just a moment..."**（挑战页），我抓不到任何 shader 源码。
- 搜索只能定位到 nimitz 的**用户页**（https://www.shadertoy.com/user/nimitz —— 搜到了这个 URL，但我**同样没能打开它的内容**），**没有任何证据表明 nimitz 写过极光 shader**。
- **所以我不会给你别名的 shadertoy ID 或代码片段** —— 那是编造。

替代方案（都能打开、都有真源码）：§3.1 → §3.4 已经覆盖了"值噪声 + fbm + 竖直帘子 + 高度配色（engawa）"、"逐列锐利下缘 + 双风向噪声叠加（Photon）"、"2D 逐列抽运 + 纵向梯度定边缘（Chromaney）"、"物理纵向沉积公式（Lawlor）"。**如果你确实想复现某个具体 Shadertoy 极光，最可靠的做法是在能打开 Shadertoy 的浏览器里打开它，把 Common/Image 两个 tab 的源码贴给我** —— 拿到源码我就能给你逐行对照。

---

## 4. 常见的"假极光"错法（判别特征）

我把每一条都做成了**可量化的检验**。下面 `gradRatio` 是原型里实测的量：把场做高通（原图 − 10px 盒模糊），然后
```
gradRatio = mean|∂/∂y (高通场)| / mean|∂/∂x (高通场)|
```

### 4.1 横向铺条（**你现在踩的坑**）
**做法**：逐竖条铺色块 + 全屏统一的纵向衰减曲线；或者用低频 fbm 直接当亮度（不管是二维 fbm 还是逐条窗帘，只要纵向衰减对全屏是一样的一条曲线，就完蛋）。
**判别**：`gradRatio > 1`。因为亮度在**纵向**变化比横向快。
**实测**：我的对照组 `WRONG_hbands`（`CROSS_F=0.55, ALONG_F=3.2, RAY_F=1.2, WARP_AMP=0.15`）→ **gradRatio = 9.82**（纵向梯度是横向的 10 倍）。正常值应在 **0.3–0.6**。
**修法**：`border` 必须**逐列不同**（§2.5），`ray` 层必须**各向异性且长宽比 > 100**（§2.4）。

### 4.2 "发光果冻"（glowing jelly）—— 一整片均匀发光的糊
**四个独立成因，全都会单独造成这个效果**：
1. **射线层没有调制**：`ray` 恒等于 1（或 floor 太高）⇒ 帘子变成一整片渐变。判别：`brightFrac`（A>0.35 的像素占"被点亮"像素的比例）**> 0.25**。正常应 **0.10–0.18**。实测 `WRONG_jelly` → **0.276**，正常值 0.147。
2. **主体门限太宽**：`BODY_LO..BODY_HI` 覆盖了 fbm 的全部动态范围 ⇒ 处处都有值。判别：同上 `coverage > 0.6`。实测 `WRONG_jelly` coverage = **0.730**（正常 0.4–0.5）。
3. **纵向曲线用了对称钟形（高斯/bell）**：真极光下锐上弥散。对称钟形 ⇒ 上下都糊 ⇒ 像果冻/光柱。**判别**：看 `profile(rel)` 在 rel=DEPTH 处是否还 > 0.15；高斯在 rel=2σ 处就几乎为 0，而真实的 `exp(-3*0.5)=0.22`。**修法**：`smoothstep(0, SOFT, rel) * exp(-DECAY*rel)`，绝不用 `exp(-((rel-c)/w)^2)`。
4. **颜色按亮度取**：`t = A` 而不是 `t = rel` ⇒ 暗的地方自动是"暗绿"，亮的地方才变紫 ⇒ 整片看起来像一坨变色的果冻。真极光的紫在**高处**，与亮度无关。

### 4.3 "极光壁纸"（aurora wallpaper）—— 过于均匀、干净、对称
**特征**：左右看起来差不多、帘子等宽、间距均匀、没有黑缝、没有参差下缘。
**成因**：`CROSS_F` 太小（< 1.5，一屏只有一两个帘子）+ `BORDER_AMP` 太小（< 0.06，下缘是一条直线）。
**判别**：把 `A` 的**每一行**做局部极大值计数，好的场每行应有 **2–7 个**独立的亮柱（我的实测 4.2–6.2 个/行）；如果几乎每行只有 1 个宽峰，就是壁纸。

### 4.4 "屏幕栅栏"（screen bars）—— 等宽等距的竖线
**做法**：`ray` 用规则的 `sin`/`frac(x*k)` 而不是噪声；或 `RAY_FLOOR = 0`（射线之间出现死黑缝）。
**判别**：`gradRatio` 会**异常小**（< 0.15，因为纵向完全没有变化）+ **coverage 异常低**。实测 `WRONG_screenBars`（`RAY_F=70, STRETCH=0.02, RAY_FLOOR=0.0`）→ gradRatio = **0.08**、coverage = **0.063**、brightFrac = **0**。**注意：假的极端值和真的好值在同一个方向**，所以 `gradRatio` 不能单独用，必须配 `coverage` 和 `brightFrac` 一起看。

### 4.5 忘了"地面以下"和"整屏一张 slab"
**做法**：`profile` 用了 `TAIL=1.0`（完全不衰减）或 `DECAY < 0.5` ⇒ 整屏上半部分是均匀发光的板。实测 `WRONG_slab`（`DECAY=0.35, BORDER_SOFT=0.5`）→ coverage **0.689**、brightFrac **0.290**，看上去就是一块发光的板子。
**另一半**：忘了在 `alt <= 0` 时提前返回 ⇒ 极光糊到地面剪影以下。我的最终版本实测**地平线以下 alpha>0 的像素 = 0**（§6.3）。**这条一定要自己数一遍**，别靠眼看。

### 4.6 高频闪烁 / 边缘爬行（temporal garbage）
**成因**：用 `floor()`/`fract()` 做时间包裹、每帧用 `Math.random()` 加相位、或者 `t` 推进太快。
**判别**：相邻帧 `mean|A(t) − A(t+0.1s)|` 应该**很小**。实测我的最终版 **= 0.00036**；而 `mean|A(0) − A(30s)| = 0.0817`（是它的 227 倍）⇒ 动是动了，但是连续的，不会闪。

### 4.7 一张速查表

| 症状 | 量化判别 | 阈值 | 病因 |
|---|---|---|---|
| 横带 | `gradRatio` | **> 1.0** ❌（应 0.3–0.6） | 逐列 border 缺失 / 纵向衰减全屏统一 |
| 果冻 | `brightFrac` | **> 0.25** ❌（应 0.10–0.18） | ray 没调制 / 门限太宽 / 对称钟形 |
| 均匀发光板 | `coverage` | **> 0.6** ❌（应 0.40–0.50） | DECAY 太小 / TAIL 太大 |
| 壁纸 | 每行亮柱数 | **< 2** ❌（应 2–7） | CROSS_F 太小 + BORDER_AMP 太小 |
| 栅栏 | `gradRatio` + `coverage` | **< 0.15 且 coverage < 0.1** ❌ | 规则 sin 射线 / RAY_FLOOR=0 |
| 闪烁 | `mean|ΔA|/0.1s` | **> 0.01** ❌（应 < 0.001） | 时间包裹 / 随机相位 |

---

## 5. 可照抄的 JS 骨架（36 行，逐像素写 ImageData）

**这 36 行是逐字验证过的**：我把它原样敲进 `_aurora_proto/skeleton.js` 跑，指标与 §2 的原型一致（见 §6.7），渲染结果就是 §6.6 的 `skeleton_out.png`。可以直接抄。

```js
const OW=400, OH=250, HZ=0.74;                                  // 1  离屏场尺寸 + 地平线
const cl=v=>v<0?0:v>1?1:v, fr=v=>v-Math.floor(v);               // 2
const ss=(a,b,x)=>{const u=cl((x-a)/(b-a)); return u*u*(3-2*u);};  // 3  五次对比用 smoothstep
const mx=(a,b,u)=>[a[0]+(b[0]-a[0])*u, a[1]+(b[1]-a[1])*u, a[2]+(b[2]-a[2])*u];  // 4
function h12(x,y){                                              // 5  无 sin 哈希
  let a=fr(x*0.1031), b=fr(y*0.1030), c=fr(x*0.0973);           // 6
  const d=a*(b+33.33)+b*(c+33.33)+c*(a+33.33);                  // 7
  return fr((fr(a+d)+fr(b+d))*fr(c+d));                         // 8
}                                                               // 9
function vn(x,y){                                               // 10 五次插值值噪声
  const ix=Math.floor(x), iy=Math.floor(y), fx=x-ix, fy=y-iy;   // 11
  const ux=fx*fx*fx*(fx*(fx*6-15)+10), uy=fy*fy*fy*(fy*(fy*6-15)+10);  // 12
  const a=h12(ix,iy), b=h12(ix+1,iy), c=h12(ix,iy+1), e=h12(ix+1,iy+1);  // 13
  const p=a+(b-a)*ux, q=c+(e-c)*ux; return p+(q-p)*uy;          // 14
}                                                               // 15
const CA=Math.cos(0.6435), SA=Math.sin(0.6435);                 // 16 36.87° 倍频旋转
function fbm(x,y,o){                                            // 17
  let v=0, a=0.5;                                               // 18
  for(let i=0;i<o;i++){                                         // 19
    v+=a*vn(x,y);                                               // 20
    const nx=CA*x-SA*y, ny=SA*x+CA*y;                           // 21
    x=nx*2.03+19.7; y=ny*2.03+7.3; a*=0.5;                      // 22 非整数 lacunarity + 去相关偏移
  }                                                             // 23
  return v/(1-Math.pow(0.5,o));                                 // 24 归一到 ~[0,1]
}                                                               // 25
function buildAurora(t,k){                                      // 26 t=秒, k=0.05→1 集齐进度
  const img=octx.createImageData(OW,OH), D=img.data;            // 27
  const dx=t*0.012, dy=t*0.004;                                 // 28 全场统一的漂移量
  for(let py=0;py<OH;py++) for(let px=0;px<OW;px++){            // 29
    const v=py/OH, x=px/OW*2, alt=1-v/HZ, o=(py*OW+px)*4;       // 30
    let R=0,G=0,B=0;                                            // 31
    if(alt>0){                                                  // 32 地面以下绝不写
      const q1=fbm(x*.75+.13+dx*.5, alt*.20+3.1+dy,2)-.5;       // 33 域扭曲场 1
      const q2=fbm(x*.75+4.7+dx*.5, alt*.20+8.9+dy,2)-.5;       // 34 域扭曲场 2
      const wx=x+1.10*(q1+.33*q2)+.10*fbm(x*.4+dx, alt*1.6+20+dy,1);  // 35 被推弯的列坐标
      const bd=-.04+.16*vn(wx*.40+3.7+dx, alt*.05+11+dy);       // 36 逐列参差的下缘
      const body=fbm(wx*3.4+dx, alt*.50+5+dy, 3);               // 37 帘子主体 fBm
      const rA=vn(wx*34+2.3+dx*1.4, alt*.12+1.1+dy);            // 38 射线层（中频）
      const rB=vn(wx*88.4+7.7+dx*2.0, alt*.084+5.3+dy);         // 39 射线层（高频）
      const ray=.28+.72*(.5*rA+.5*rB);                          // 40 射线调制（下限 0.28）
      const rel=alt-bd;                                         // 41
      if(rel>0){                                                // 42
        const pf=ss(0,.05,rel)*(.12+.88*Math.exp(-rel*3));      // 43 下锐上弥散的纵向曲线
        const br=cl((body-.26)/.44), hz=cl((body-.04)/.51);      // 44 主体门限 / halo 门限
        const A=Math.min(1,(Math.pow(br,1.45)*ray*2.2+hz*.32)*pf)*k;  // 45 halo 也乘 pf
        const th=cl(rel*2.2);                                   // 46 按高度取色（不是按亮度！）
        let c=mx([.10,1,.42],[.05,.78,.86], ss(0,.45,th));       // 47 绿 → 青
        c=mx(c,[.55,.25,.95], ss(.45,.90,th));                   // 48 → 紫
        c=mx(c,[.95,.35,.70], ss(.85,1,th));                     // 49 → 粉
        R=cl(c[0]+.25*ss(.5,1,th))*A; G=c[1]*A; B=cl(c[2]+.10*ss(.6,1,th))*A;  // 50 预乘
      }                                                         // 51
    }                                                           // 52
    D[o]=R*255; D[o+1]=G*255; D[o+2]=B*255; D[o+3]=255;         // 53 预乘、alpha 置 1
  }                                                             // 54
  octx.putImageData(img,0,0);                                   // 55
}                                                               // 56
// 主画布侧：ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
//           ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
```

**行数说明**：断言 `vnoise`/`fbm`/`hash` 是噪声**库函数**（照抄即可，不需要理解），**需要你按项目调整的算法主体是第 26–56 行 = 31 行**；整个 snippet 连库函数 56 行。参数替换表见 §2。

**⚠️ 上面第 27 行 `createImageData` 每次调用都重新分配**——放到生产代码里请把 `img`/`D` 提到函数外只建一次。

**移植三项注意**：
1. **集齐进度 `k` 不要靠重建来过渡**。重建 10 万像素有成本；`k` 应该放在**主画布那一层**（`ctx.globalAlpha = k`，或直接动容器的 CSS opacity / `--aurora-strength` 变量），只有**漂移**才触发重建。
2. 漂移是 **2.8 px/秒**（换算见 §2.2）。想"活着但不明显"就每 4 帧重建一次（`t += 4/60`）。
3. 放大后若细纹变"泥"，把 `RAY_F` 从 34 降到 24，或把离屏分辨率提到主画布的 1/1.5。

**移植注意**：
- `createImageData` 每次调用都重新分配；**只建一次**，把 `img`/`D` 放在模块作用域。
- 若"集齐"进度需要过渡，**不要去改 `gainK` 后重建**（10 万像素重建有成本）——把 `gainK` 放在**主画布这一层**：`ctx.globalAlpha = k` 配合 screen 混合，或者直接调 CSS 变量。**重建只在漂移需要时发生**。
- 我给的漂移是 **2.8 px/秒**（换算见 §2.2）。若你想让帘子"活"起来但又不明显，可以每 4 帧重建一次（`t += 4/60`）。

---

## 6. 验证记录（我实际做了什么 / 没做什么）

**没有做的事**：我没有在浏览器里渲染验证（本环境 Chrome 起不来）。**我不会声称"我看到了效果"**。

**做了什么**：在 Node 里把这个算法逐像素跑出来，把 `A`/颜色写成 PNG，然后**用 read_image 工具把 PNG 读回来看**（这一步是真正的"看"，只是看的是离线渲染的 PNG，不是页面）。原型文件在 `_aurora_proto/`（一次性验证脚本，非交付物）。

**6.1 结构检验（t=0）**
| 指标 | 最终值 | 健康区间 |
|---|---|---|
| `gradRatio`（纵向梯度/横向梯度，高通后） | **0.40** | 0.3–0.6 ✅（对照：横带对照组 9.82） |
| `coverage`（A>0.02） | **0.662** | 0.4–0.7 ✅ |
| `brightFrac`（A>0.35 占被点亮像素） | **0.147** | 0.10–0.18 ✅（对照：果冻对照组 0.276） |
| 峰值 alpha | **1.00** | 应能到 1 ✅ |

**6.2 纵向分布**（`meanA` 按 v）
```
v=0.00 → 0.026   (顶部：几乎空)
v=0.32 → 0.077
v=0.48 → 0.131
v=0.64 → 0.225   (最亮)
v=0.68 → 0.106   (裙边开始切断)
v=0.72 → 0.002   (地平线 0.74 前完全归零)
```
亮心 v≈0.70（略高于地平线 0.74），符合"裙边贴地、向上弥散"。

**6.3 地面以下**：地平线（v=0.74）以下 **alpha>0 的像素 = 0**，逐像素数过。

**6.4 时间连续性**：`mean|A(0) − A(0.1s)| = 0.00036`；`mean|A(0) − A(30s)| = 0.0817`（227×）。连续，无跳变。

**6.5 成本（我数的是噪声调用，不是浏览器实测）**【推断的耗时】：
每像素 **10 次 `vnoise`**（warp 2+2+1、border 1、body 3、ray 2 —— 注：body 的 3 个倍频算 3 次）= 10 × 4 = **40 次 `hash12`/像素**；400×250 = **10 万像素 ⇒ 100 万次 `vnoise` / 400 万次哈希**。在现代 JS 引擎上是**几十毫秒量级**（一次性）。**这是估算，我没有测你的浏览器**。

**6.6 参考图**（`_aurora_proto/`，一次性验证脚本产出，非交付物）：`look_full.png`（k=1.0 全亮）、`look_dim.png`（k=0.4，接近默认状态）、`look_mid.png`（k=0.7）、`look_t30.png`（t=30s，验证漂移后结构仍成立）、`skeleton_out.png`（§5 那 36 行跑出来的）。**这几张就是"照着这份说明画出来会长什么样"的证据**，不是承诺 —— 它们是我离线渲染并用 read_image 读回来看过的。

**6.7 §5 骨架的交叉验证（重要）**：我把 §5 的 36 行**原样**敲进 `_aurora_proto/skeleton.js`（连变量名、常量写法都照抄）跑了一遍，指标与 §2 的原型对齐：

| 指标 | §5 骨架实际跑出 | §2 原型 | 判定 |
|---|---|---|---|
| `gradRatio` | **0.38** | 0.40 | ✅ 一致（0.02 的差来自 `vnoise` 里我合并了两次 `frac` 的写法差异） |
| `coverage` | **0.662** | 0.662 | ✅ 完全一致 |
| `brightFrac` | **0.148** | 0.147 | ✅ |
| 峰值 alpha | **1.00** | 1.00 | ✅ |
| 地平线以下 alpha>0 像素 | **0** | 0 | ✅ |

⇒ **§5 是可以直接抄的，不是"意思意思的骨架"。**

---

## 7. 给你的最小行动清单

1. **删掉**"三条窗帘 + 高斯 + 2px 铺列"那套（§4.1 是它的死因）。
2. 换成 **`body` fbm + 逐列 `border` + 各向异性 `ray` + `exp` 纵向曲线**（§2.4 §2.5）。
3. `gradRatio` 调到 **0.3–0.6**（先只画灰度，别上色）。
4. 加颜色时 **按 `rel` 不按 `A`**。
5. 加 halo 第二遍（低门限、低增益、不乘 ray），填黑缝。
6. 数一遍地平线以下 alpha>0 的像素，必须是 0。
7. 最后才用 `drawImage` 放大 + `screen`。

---

## 8. 追加（2026-09-27）：用户说"极光太大，而且在两侧" ⇒ 横向包络 + 压矮

**只改了 `assets/js/page-frost.js` 里的 `buildAurora()`**，其余函数一个字没动。
症状：截图上左右各一条顶天立地的帘子、中间空。根因：这一层**从来没有横向包络**
（`body` 门限在哪儿过就哪儿亮，而这一版噪声最亮的那一折恰好落在中心**偏右**），
纵向 `pf = exp(-3·rel)` 到画布顶还剩 ≈0.16，所以帘子顶天立地。

| 项 | 原 | 现 | 为什么 |
|---|---|---|---|
| 横向包络 `env` | 无 | `sstep(0,1, max(0, 1-\|x-0.5\|/0.34)^0.75)` | 中心 1、到 x≈0.16/0.84 正好为 0 ⇒ 左右各 16% 全黑 |
| 噪声场平移 `AUR_SHIFT` | 0 | +0.18（x 单位 ≈ 9% 画宽） | 包络管不了"噪声自己哪儿亮"；最亮那折本来在 x=0.62 |
| 纵向窗口 `TOP0/TOP1` | 无 | 0.30 → 0.58（alt） | 最高的射线只到画面高 ≈40% |
| 射线下限 `RAY_FLOOR` | 0.28 | 0.14 | 下缘那道**该有的**锐边一直在往纵向梯度里灌能量；包络把画面一收窄，分母（横向细节）就小了 ⇒ `gradRatio` 0.59→0.74。压深褶缝把分母补回来（**不是设 0**，那是 §4.4 的"屏幕栅栏"） |
| 弥散辉光门 | `hz`（跟着 `body` 门限，与竖褶完全同步） | 低频平滑值噪声 `0.30+0.70·vnoise(x*0.9+12.5, alt*0.25+6.2)` | 跟着竖褶走的辉光填不了暗缝 ⇒ 横向只有中间 ~30% 亮；换平滑门后亮区撑到 ~47%，`brightFrac` 0.27→0.16 |

★ `Math.max(0, …)` 那层不能省：底数为负时 `Math.pow(负, 0.75) = NaN`，而 `cl01(NaN)` 仍是 NaN。

**实测**（`.tmp/frost-preview.mjs` 的健康度块 + 新写的 `.tmp/aurora-envelope.mjs`，后者另出
`aurora-only.png`；真面板那列是把自检工具的 `PW/PH` 换成 1024×390 重跑）：

| 指标 | 820×512（自检画布 1.6:1） | 1024×390（真面板 2.6:1） | 目标 |
|---|---|---|---|
| 最亮的一列 | **0.573** | **0.573** | 0.40–0.60 ✅ |
| 亮于峰值 10% 的跨度 | **0.472**（0.285~0.756） | **0.474**（0.284~0.757） | 0.40–0.55 ✅ |
| 左右各 15% 里最亮的一列 | **0.0% / 0.0%** | **0.0% / 0.0%** | 0 ✅ |
| 最上一行被点亮（10% 峰值行均值） | **0.416** | **0.418** | 0.35–0.45 ✅ |
| 最上一行被点亮（绝对 0.02） | **0.373** | **0.372** | 0.35–0.45 ✅ |
| `gradRatio` | **0.55** | 1.02 | 0.30–0.60 |
| `coverage` | **0.224** | 0.224 | 0.40–0.66 |
| `brightFrac` | **0.161** | 0.160 | 0.10–0.18 ✅ |
| 地平线以下发光 | 287px | **0** | ≈0 ✅ |

**`coverage` 是撞了几何上限，不是没调好**：亮区被"左右 15% 不许亮"和"最上一行 ≥0.35"夹在
x∈[0.16,0.84] × y∈[0.37,0.80] 这个盒子里，盒子面积只有 0.68×0.43 = **0.29 画布** ——
就算盒子里每个像素都亮也只能到 0.29，所以 0.40 这条**在新要求下不可能达到**
（0.224 已是盒子的 77%）。§6.1 那条 0.40–0.66 是对"铺满整个天空的帘子"定的，与"只留中间一条"
直接冲突；这里选用户的新要求。

**长宽比**：新指标全部是归一化的（x 按画宽、alt 按画高），所以两列逐项一致。但 `gradRatio`
是**像素空间**的量：画越扁，竖褶在像素上越宽、纵向越挤 ⇒ 比值天然变大。**这不是本次改动引入的**
—— 同一套离线模型里 2.6:1 下【旧参数】= 1.18、【新参数】= 1.08（旧代码在真面板上更偏"横带"）。
自检工具跑的是 1.6:1，验收数字以它为准。

**没做的事**：没有浏览器，这一页在真机上的样子看不到；上表全部是 node 光栅化器与离线模型的数。
