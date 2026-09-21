# gdp 反编译 ↔ gd-web 物理实现 逐条审计

审计对象
- **权威来源(判据)**:`C:\Users\hp\Desktop\deep-workspace\.tmp\gdp211\*(camila314/gdp 分支 2.11 反编译)`
  以及 `.tmp\gdp\`(同仓库 master 分支:含 `PlayerObject_collidedWithObjectInternal.cpp`、`PlayerObject_updateJump.cpp`、
  `GJBaseGameLayer_update.cpp`)。辅助参考:`OpenGD`(`playerobject.cpp` / `playlayer.cpp` / `gameobject.cpp` / `longdata.cpp`)。
- **被审对象**:`C:\Users\hp\Desktop\deep-workspace\tuagfey-blog\gd-web\src\sim\world.ts`、
  `constants.ts`、`gdids.ts`、`level.ts`。
- 坐标/符号约定:我们 `gdir=+1` 是常重力(向下),GD `m_isUpsideDown=false`;`vy` 两者都是"y 向上为正的速度"。
  下表的"双方数值"已换算到同一口径。

## 0. 一句话结论

**数值层面大体是对的**(弹簧、跳环、跳跃初速、终端速度、容差 15/10/6、各形态重力倍率都能对上;翻重力那一下原来按 2.11 取 ×1.75,现已按关卡实测改回 2.2 的减半);
**对不上的是"时机/时序/作用域"三类**:弹簧与跳环不受终端速度钳制的机制、蓝粉板的触发前置条件、
绿环的"先翻后给"、黑环的分形态倍率、重力门的速度处理、以及 `checkSnapJumpToObject` 的来源被误用。
手感跑偏的头号嫌疑在 §3 的「我们猜的」清单里。

---

## 1. 逐条对照大表

> 判定:一致 / 数值不同 / 缺失 / 未验证。
> 「未验证」= 反编译里找不到对应实现(2.11 源码不含该机制),或反编译本身自相矛盾、无法定论。

### 1.1 各形态的速度与加速度

| # | gdp 里的规则(file:line) | 我们实现的位置 | 判定 | 差在哪 |
|---|---|---|---|---|
| 1 | 方块每帧 x 位移 = `m_dXVel`;速度门只改 `m_dXVel`,值固定 5.98/5.77/5.87/6.0/6.0 (`playlayer.cpp:1915-1950` OpenGD;gdp211 的对应量 `m_playerSpeed*playerSpeedMultiplier`) | `constants.ts:29,33-34` `xVel=5.1930017 = 5.77000189×0.9`;`vxOf()` :73-75 | **一致**(常速档) | 我们**算出来的**每帧位移 5.1930017 与 `5.77×0.9` 吻合。注意这里有个隐藏关系:GD 是"乘完倍率再 ×0.9"(见 #18 的 `dtSlow`),我们把它折叠进了 `xVel × Y_TIME_SCALE` |
| 2 | 速度倍率表本身:`changePlayerSpeed` 只给 `(xVel, playerSpeed)` 对,不含"档位→倍率"的显式表 (OpenGD `playlayer.cpp:1915-1950`) | `constants.ts:34` `speedMul=[0.7,0.9,1.1,1.3,1.6]`,注释标 `[GDOpenGD]` | **未验证 + 出处标注错误** | OpenGD 与 gdp211 **都没有**这张倍率表,`[GDOpenGD]` 标注不成立。按 OpenGD 的 `m_dXVel` 反解,倍率应是 `[0.8063, 0.9, 1.1, 1.243, 1.5]`(与社区口径 0.807/0.9/1.1/1.243/1.502 基本吻合;我们档 0/3/4 = 0.7/1.3/1.6)。**注意:两者的绝对速度并不一致** —— 我们档 3/4 的每帧位移 7.8/9.6(15.6/19.2 块/秒),OpenGD 的 `m_dXVel` 给的是 6.0/6.0(12 块/秒),两版源码本身冲突,所以这条只能靠实测标定 |
| 3 | 速度门 ID→档位映射:201→(5.98,0.7)、200→(5.77,0.9)、202→(5.87,1.1)、203→(6.0,1.3)、1334→(6.0,1.6) (OpenGD `playlayer.cpp:1915-1950`) | `gdids.ts:204-208` 200→0、201→1、202→2、203→3、1334→4 | **一致**(按 xVel) | 与第 2 条合并看:分档的**xVel**对得上,倍率对不上 |
| 4 | 重力常量 `m_gravity`(=0.958199) | `constants.ts:23` `gravity=0.958199024` | **一致** | — |
| 5 | 终端速度:常重力 `m_yVelocity = max(-15, vy)`,反重力 `min(15, vy)`,**只夹下落方向**,且只在 `m_maybeIsBoosted==false` 那一支执行 (`gdp\PlayerObject_updateJump.cpp:456-460`;`gdp211\updateJump.cpp:203-208`) | `constants.ts:27` `vyMax=15`;`world.ts:555-561` `applyFallClamp()` | **一致**(下落钳制),**缺失**(上升分支不钳) | gdp211 里上升/boost 支**完全不设钳制**,我们 `#5` 只在 `vy*gdir<0` 时钳 → 上升不钳 ✓。但我们对 `boostDir!=0` **额外豁免了下落钳制**,见 #34 |
| 6 | 飞船:`yAccel += gravity*dt*sign*step*multiplier/size`,step=0.5(已达 2g 时)否则 0.4;按住 multiplier=-1、step=0.4;松开且上升 multiplier=1.2、下落 0.8 (`gdp211\updateJump.cpp:18-45`) | `world.ts:587-598` | **数值不同(近似)** | 我们写成 `shipAccel=-1(按住)/0.8(下落)/1.2(上升)`,`vy -= gravity*gdir*shipAccel*extraBoost/size*sY`,其中 `extraBoost=0.5(按住且下落)否则 0.4`。gdp211 里**按住时 multiplier 取 -1、step 固定 0.4**,即"按住"每帧增量 = `g*0.9*0.4` 向下;我们按住下落时 = `g*1.0*0.5` 向上 → **符号相反**。这一条我们抄的是 `OpenGD playerobject.cpp:576-591` 的旧版口径,不是 2.11。另外 `v52`(extraBoost)两版也不同:gdp211 是 0.5(下落)/0.4,`gdp\PlayerObject_updateJump.cpp:254` 是 `playerIsFallingBugged()?0.5:0.4`;我们写的 `extraBoost=(hold&&falling)?0.5:0.4` 与两版都不完全对应 |
| 7 | 飞船速度上下限 `8/size`、`-6.4/size`;迷你 size=0.85(⇒ 9.4118 / -7.5294) (`gdp211\updateJump.cpp:32-43`;`gdp\PlayerObject_updateJump.cpp:118-131`) | `world.ts:596` `flyUpMax/mini`, `flyDownMax/mini`,`constants.ts:49-50,594` | **一致** | 迷你 8/0.85=9.4118、-6.4/0.85=-7.5294 ✓ |
| 8 | 球/蜘蛛/摇摆重力乘子 0.6 (`gdp\PlayerObject_updateJump.cpp:309-315`;`gdp211\updateJump.cpp:97-100`) | `constants.ts:45` `ballGravityMul=0.6`;`world.ts:639`(球)、`world.ts:647`(蜘蛛) | **一致** | — |
| 9 | 球上升支:`fall_accel = 1.0*gravity*dt`,重力**不乘 0.6** (`gdp211\updateJump.cpp:93` `local_gravity = isCube ? gravity : 0.958199`,:133) | `world.ts:639` 下落支 0.6 ✓ | **未验证** | gdp211 的球"起跳后的上升段"走 `isRising` 支,`its_1_if_ball=1.0`、`local_gravity=0.958199`;我们全形态统一用 `gravity*0.6`。数值差异 = 上升段重力 0.575 vs 0.958,球跳的弧顶会偏高。反编译里 `local_gravity` 的赋值在球分支里被 `its_1_if_ball` 抵消,难以定论 → 标未验证 |
| 10 | UFO 点一下:`newVel = flipMod*(mini?8:7)*playerSize`,**赋值**(不叠加) (`gdp211\updateJump.cpp:49-66`;OpenGD `playerobject.cpp:592-611`) | `constants.ts:47` `ufoImpulse=7.0`(注释 `[待核]`);`world.ts:609-612` `vy = gdir*(mini?8:7)*size` | **一致** | 我们按 0.85 缩放置信,GD 用 `playerSize`;三种实现一致 |
| 11 | UFO 重力:`gravityMult = 0.8`,不落时 1.2,再 `*0.5` (`gdp211\updateJump.cpp:68-70`) | `world.ts:614` | **一致** | — |
| 12 | 波浪/飞镖:`yAccel = playerSpeedMultiplier*playerSpeed*direction`,`direction = (isHolding ^ isUpsideDown) ? -1 : 1` (`gdp211\updateJump.cpp:87-89`) | `world.ts:599-604` `vy = (hold?1:-1)*vx` | **一致**(正重力) | 反重力下 GD 会镜像(按住反而向下);我们始终"按住向上",靠渲染镜像。**反重力波浪段(本关没有)行为不同** |
| 13 | 机器人起跳 = `jumpPower/2` (`gdp211\updateJump.cpp:244-246`) | `constants.ts:51` `robotJumpMul=0.5`;`world.ts:655` | **一致** | — |
| 14 | 机器人浮空:`m_accelerationOrSpeed += dt/10`,只有 `<1.5` 时额外加一次"抵消重力"(`m_touchedPad` 为真则不加) (`gdp\PlayerObject_updateJump.cpp:425-429`) | `constants.ts:52` `robotFloat=0.27`;`world.ts:661-664` | **数值不同 + 机制不同** | GD 是"额外 +dt/10 的向上加速度、累加超过 1.5 就停"(15 帧 ≈ 0.25 s),而且**碰到弹簧后不许浮**;我们实现为"按住期间完全抵消重力、计时 0.27 s",且没有 `m_touchedPad` 这一条闸门 |
| 15 | 蜘蛛:重力 ×0.6;`if (isSpider && !isDashing) spiderTestJump(0)` —— 即**冲刺时反而不跳**,而且这一支位于 `isRising` 之前,与落地状态无关;另一条路径是 `isOnGround && jumpBufferedAndRingJump && !isDashing` 时才跳 (`gdp211\updateJump.cpp:102-105`;`gdp\...updateJump.cpp:323-325`) | `world.ts:642-649` | **数值一致 / 触发条件缺失** | 重力 0.6 ✓。差异:(a) GD 在 `isDashing` 时蜘蛛**不**瞬移,我们照跳;(b) GD 的两条路径把"地面点按"与"非冲刺"绑在一起,我们 `world.ts:644` 只看 `hold && pressFresh`,**冲刺中/空中都能跳** |
| 16 | 迷你体积 `_vehicleSize=0.6` (`OpenGD playerobject.cpp:1019-1022`) | `constants.ts:55` `miniSize=0.6` | **一致** | — |
| 17 | 迷你时方块/球/蜘蛛用 `size=0.8`,飞船/UFO/波浪用 `size=0.85` (`gdp211\updateJump.cpp:16,95`;`gdp\...updateJump.cpp:118-130,566`) | `world.ts:594`(船 0.85)、:608(UFO 0.85)、:630(球 0.8)、:633 | **一致** | — |
| 18 | y 轴时间尺度:玩家每子步 `dtSlow = dt*0.9`,水平用 `dt` (`OpenGD playerobject.cpp:320-328`) | `constants.ts:19` `Y_TIME_SCALE=0.9`;`world.ts:571` `sY=s*0.9` | **一致** | 出处只找到 OpenGD,`gdp211` 未直接给出;但我们 4 子步/帧与 OpenGD `for(i<4)` 结构相同,可采信 |
| 19 | 重力竖直积分:`vy -= gravity*dir*dt*gdirMult*dt`(方块/球/蜘蛛/机器人) | `world.ts:639,647,664,666` | **一致** | — |

### 1.2 跳跃 / updateJump

| # | gdp 里的规则 | 我们实现 | 判定 | 差在哪 |
|---|---|---|---|---|
| 20 | 起跳初速 `jumpPower = 11.180032` (`gdp211\updateJump.cpp:242`) | `constants.ts:24` `jump=11.1800318` | **一致** | — |
| 21 | 起跳时若"不在落地状态"(`!onGround`)则 `jumpPower = 1/32`(0.03125) 且置 `hasHitPortal` (`gdp211\updateJump.cpp:247-250`) | — | **缺失** | 这是"缓冲跳在空中兑现"的细节:GD 给一个极小初速。我们没有对应实现(第 25 条的缓冲也没做) |
| 22 | 起跳后才清缓冲:`m_isRising=true; isSliding=false; onGround=false; hasJustHeld=false; robotCanJump=false; decelRate=0`(`gdp211\updateJump.cpp:236-241`) | `world.ts:654-660` | **一致** | — |
| 23 | 方块落地缓冲/连跳:`hasJustHeld & isHolding`(按住不放 → 落地自动连跳) (`gdp211\updateJump.cpp:7-9,236-241`;`OpenGD playerobject.cpp:1028-1047 set/clear`) | `world.ts:654` `hold && onGround`;`pressFresh` 仅在 `frame()` 里"上升沿"置位 (`world.ts:511`) | **一致**(行为),**未验证**(内部量) | 行为等价;但 GD 的 `hasJustHeld` 是**按下时置位、直到某次起跳才清**,我们 `pressFresh` 会被第一个子步的**任何**环/门/箭头消费(`world.ts:824,846,1068`)——同帧既碰环又要跳时,消费顺序与 GD 不同 |
| 24 | 球:只有 `pressFresh && onGround` 才跳;顺序 = 给旧方向初速 → `flipGravity`(倍率见第 52 条,现为 ÷2) → `vy *= 0.6` (`gdp211\updateJump.cpp:279-284`;`flipGravity.cpp:18-20`) | `world.ts:631-638` | **一致** | `jump*0.8*gdir → gdir*=-1 → *1.75 → *0.6` 与 GD 完全同序 ✓(注:gdp211 里 `flipGravity` 在 `+=` 之后调用,`yAccel = size*jumpPower*sign` 是赋值,所以 ×1.75 作用在赋值上) |
| 25 | 球/机器人的**缓冲跳**:`m_jumpBuffered` 在空中按下时置位、落地时兑现 (`gdp\...updateJump.cpp:110,323,391-396`;"空中按下的也算数(按下时标记,落地才消费)") | 我们只有 `pressFresh`(空中按 → 落地**不**兑现) | **缺失** | 与 `world.ts:622-629` 的注释自相矛盾:注释声称还原了"缓冲跳",代码里没有缓冲。空中按一下落地不会弹 |
| 26 | 机器人 `shouldJump = hasJustHeld & isHolding`,与 `m_jumpBuffered` 双轨 (`gdp211\updateJump.cpp:7-9`;`gdp\...updateJump.cpp:110`) | `world.ts:654` 用 `hold` | **一致**(行为) | — |
| 27 | 球/蜘蛛在 `propellPlayer`/`ringJump` 里 `m_yAccel *= 0.6` / `*0.7` (`propellPlayer.cpp:8-10`;`ringJump.cpp:127-130`) | `world.ts:1047`(弹簧 0.6)、`world.ts:1066`(boostDir) | **部分一致** | 弹簧 0.6 ✓;跳环那一档 `*0.7` **缺失**(见 #46) |

### 1.3 弹簧 propellPlayer

| # | gdp 里的规则 | 我们实现 | 判定 | 差在哪 |
|---|---|---|---|---|
| 28 | `m_yAccel = 16.00*arg1*(upsideDown?-1:1)*(vehicleSize==1?1:0.8)`,球/蜘蛛再 `*=0.6` (`propellPlayer.cpp:6-10`) | `constants.ts:101-121` `PAD`;`world.ts:1030-1047` | **一致** | 黄 1.0×16=16、粉 0.65×16=10.4、红 1.25×16=20、蓝 0.8×16=12.8、迷你 ×0.8、球/蜘蛛 ×0.6 全对 ✓ |
| 29 | 弹簧各档 arg1:黄 1、蓝 0.8、粉 0.65、红 1.25 (OpenGD `playlayer.cpp:1394-1430`;gdp211 `kBlueBump` 里 `propellPlayer(0.8)`) | 同上 | **一致** | — |
| 30 | **蓝板时序**:`propellPlayer(0.8)` 先执行 → 再 `flipGravity`(先按旧重力方向赋值,再翻重力) (`checkCollisions.cpp:228-242`) | `constants.ts:105-114` `flip:'before'`;`world.ts:1048-1054` | **一致** | 顺序与来源一致 ✓ |
| 31 | 蓝板触发前置条件:`player->isUpsideDown ^ !local_isPadUpsideDown(gameObj)` (`checkCollisions.cpp:229`) | 无 | **缺失** | 我们没有任何"重力方向不对就不触发"的闸门;GD 里重力方向与板一致时**这个板什么也不做** |
| 32 | 弹簧触发用玩家**外框**与物件判定盒相交 (`checkCollisions.cpp:139,175` `playerTouchesObject(player->getObjectRect(), ...)`) | `world.ts:797` `this.outer()` | **一致** | — |
| 33 | 弹簧判定盒:黄 `{4,25,-12.5,-2}`、蓝 67 `{6,25,-12.5,-3}`、粉 140 `{5,25,-12.5,-2.5}`、红 1332 `{7,29,-14.5,-3.5}` (`longdata.cpp:48,66,103,345`) | `gdids.ts:57`;`world.ts:208-213` | **一致**(尺寸与锚点) | ★ 复核纠正(2026-09):表里的 (x,y) 是**盒左下角**的偏移,不是盒中心 —— 黄板 `-2` 即盒 y∈[-2,+2],正是"以物件中心为心"。`tools/hb-audit.ts` 用 .dat 的 ID 直方图逐条核过:本关 45 个可查 ID 里 44 个居中,唯一例外是传送门 747(已按 [-0.5,-45] 修,见 13.19) |
| 34 | 弹簧不钳终端速度:`m_maybeIsBoosted=true` → 走 `isRising` 支,该支无 `max(-15)` (`propellPlayer` 无钳制;对照组 `gdp\...updateJump.cpp:423-460` vs `:456-459`) | `world.ts:555-561,1066` `boostDir` 豁免 | **未验证**(口径不同) | GD 的豁免来自 `m_maybeIsBoosted`(只有弹簧/boostPlayer/起跳置位),我们用一个"速度符号"标志。**黄板峰值:我们 3.9 块(`test/sim.test.ts:188` 就是这么写的)vs GD 不钳制 ⇒ 4.4 块**。差半格,来源是"我们给弹簧也开了下落钳制豁免、但整段上升都在钳制豁免里,回落时被钳" |
| 35 | 粉色板的力度 0.65×16=10.4 ⇒ 峰值 = 10.4²/(2×0.958)/30 = **1.88 块** | `constants.ts:103` 注释写"峰值约 1.88 块",但同文件 `arcPeak()` 会给 10.4 算出 1.88(正确);`world.ts` 模拟给的峰值未测 | **数值一致 / 注释自相矛盾** | 注释里同时写了 "0.65×16=10.4" 和 "峰值约 1.88 块",数值恰好自洽(10.4²/2g/30=1.88),但文件里没有断言覆盖它 → 标"未验证(无测试)" |
| 36 | 2.11 **没有**紫色板(3005);紫/粉 bump 走 `kYellowBump/kPurpleBump/kRedBump → bumpPlayer` (`checkCollisions.cpp:223-227`) | `gdids.ts:185,190` 3005/3004 `tp:true` → `world.ts:802,826` `spiderJump()` | **未验证** | 2.11 源码里没有 3004/3005,也没有 `bumpPlayer` 实现。我们把它们实现成"蜘蛛式瞬移+翻重力",纯属外部信息 |
| 37 | 弹簧触发是**一次性**的(每帧 `touchedSurfaces` 清空,`hasBeenActivatedByPlayer`) (`checkCollisions.cpp:152,165,432-438`) | `world.ts:801` `armedPads` | **一致** | — |

### 1.4 跳环 ringJump

| # | gdp 里的规则 | 我们实现 | 判定 | 差在哪 |
|---|---|---|---|---|
| 38 | 前置:`hasQueuedHold && !isDashing && isHolding2`;每帧碰到的环先进 `untouchedRings`,按到的环出列 (`ringJump.cpp:2-8`) | `world.ts:837-849` `hold && pressFresh` + `armedOrbs` | **一致**(行为) | 都需要"新的一次按下" ✓ |
| 39 | 黄环 = `jumpPower`,`new_y_accel *= 1.0`(默认支) (`ringJump.cpp:110-114`);机器人 ×0.9 | `world.ts:1085-1086` `robot?0.9:1.0` | **一致** | — |
| 40 | 粉环 ×0.72(机器人同档);UFO 0.42 / 球 0.77;船 **两张源冲突**(见右栏) (`ringJump.cpp:84-93`;OpenGD `playerobject.cpp:476-491`) | `world.ts` `orbVel` `'pink'` | **数值一致(取 OpenGD)** | ★ 船的粉环:gdp@2.11 写 `*= 1.37`、OpenGD 写 `*= 0.37f`,**其余每一项两边完全相同**。取 0.37,理由:粉环的语义是"小跳"(UFO 0.42 / 球 0.77 / 默认 0.72 都 <1),1.37 会让船的粉环比红环(1.38)还猛,而且船的纵速本来就被 `shipVyMax` 钳住,1.37 与 1.38 会被钳成同一个值、粉红两档分不出来。**本关 127 个环没有一个在飞行形态段里**(cube 121 / 机器人 5 / 球 1),所以这个取值对本关通关卷零影响 |
| 41 | 红环:船(mini)×1.4 / UFO 1.02(mini 1.36)/ 球 1.34 / 机器人 1.28 / 蜘蛛 1.34 / 方块 1.38 (`ringJump.cpp:65-83`;OpenGD `playerobject.cpp:452-475`) | `world.ts` `orbVel` `'red'` | **一致** | 已补上"船的迷你红环 ×1.4"(`vehicleSize != 1.0` 才乘) —— 这就是这一行原来标"覆盖不全"的那一处,本轮已修 |
| 42 | 蓝环 ×0.8,**先赋值再 `flipGravity`** (`ringJump.cpp:108-109,132-139`) | `constants.ts:96` `flip:'before'`;`world.ts:1089-1090` | **一致** | — |
| 43 | 绿环:船 ×0.7,**先 `flipGravity` 再赋值**(`flipGravity` 在 :98-107,赋值在 :117) (`ringJump.cpp:94-107`) | `constants.ts:97` `flip:'after'`;`world.ts:1087-1088` | **一致** | — |
| 44 | 黑环(冲刺):船/UFO/飞镖 = ±14(UFO ×0.8=11.2);其它 = ±15(蜘蛛 ×1.10=16.5);并 `hasQueuedHold=false`、`hitPortal=true`、球则 `isHolding=false` (`ringJump.cpp:32-58`) | `constants.ts:98`;`world.ts` `orbVel` `'black'` | **数值一致** / 副作用缺失 | 15/11.2/14/16.5 全对 ✓。★ **原表这一行原来写的"缺 ×0.7(球黑环应 10.5)"是误判**:那句 `if (isBall\|\|isSpider) { yAccel *= 0.7; }` 在 `ringJump.cpp:127-130`,属于【普通环那一支】(59-140 行,末尾才赋值),而黑环支在 32-58 行就 `return` 了 —— 黑环**本来就不吃那 7 折**;蜘蛛黑环的 ×1.10 是它自己那一支里的,我们已实现 ✓。确实还缺的是 `hasQueuedHold=false` / `hitPortal=true` 两个副作用(本关用不到,见 §2) |
| 45 | 通用尾段:`new_y_accel *= upsideDown?-1:1`;`*= vehicleSize<1 ? 0.8 : 1`;球/蜘蛛 `*= 0.7` 且 `isHolding=false` (`ringJump.cpp:115-130`) | `world.ts:1031`(迷你 ×0.8) | **部分缺失** | 迷你 ×0.8 ✓ 但**作用域错**:GD 的 ×0.8 只在**通用跳环支**里(黄/粉/红/绿/蓝),黑环支提前 `return` 不受影响;我们 `triggerScale()` 对黑环也生效 |
| 46 | 迷你 ×0.8 只在 `vehicleSize<1` 时:即 `miniSize=0.6` (`ringJump.cpp:116`) | `constants.ts:56` `miniTriggerMul=0.8` | **一致** | — |
| 47 | 环的判定盒 `36×36`(`{36,36,-18,-18}` 中心对齐)(`longdata.cpp:49,80,104,296,343,428`) | `gdids.ts:59` `orb:[36,36]`;`world.ts:202-207` | **一致** | — |
| 48 | 环的触发用玩家外框相交 (`checkCollisions.cpp:139`;OpenGD `playlayer.cpp:1341`) | `world.ts:838` `this.outer()` | **一致** | — |
| 49 | 环被吃后 `activatedByPlayer + powerOffObject`,且进 `m_untouchedRings` 去重 (`ringJump.cpp:8,200-201`) | `world.ts:842` `armedOrbs` | **一致** | — |
| 50 | 自定义环(`kCustomRing`)/ `canHitCustomRing` 门闩 (`ringJump.cpp:3-5,9-13`) | 无 | **缺失** | 见 §2 |
| 51 | 环上的 `m_stateRingJump`(船/UFO/波浪/蜘蛛的"环待兑现"状态机)(`gdp\...updateJump.cpp:110,150-225`) | 无 | **缺失** | 见 §2。我们的环对所有形态都是"立即赋值" |

### 1.5 重力门 flipGravity

| # | gdp 里的规则 | 我们实现 | 判定 | 差在哪 |
|---|---|---|---|---|
| 52 | `flipGravity` 里翻重力对纵向速度的处理:gdp@2.11 `m_yAccel *= 1.75`(放大)、OpenGD/**2.2** `m_dYVel /= 2`(**减半**)(`flipGravity.cpp:18-20` 对 `playerobject.cpp:540`) | `world.ts` 文件头 `FLIP_VEL_MUL = 0.5` | **已定案 = 减半(OpenGD/2.2)** | ★ **两张源直接冲突**,最后按【关卡自己的证据】定案。A/B 实测(同一处手工反重力贴顶状态、同一套搜索,只改这一个倍率):`(714.2, y=23)` ×1.75 死在 718.0 / ÷2 过到 740.6;`(716, y=24)` ×1.75 死在 726.6 / ÷2 过到 740.6 —— **×1.75 让本关 714~727 那段垫板走廊无解**。再加两条旁证:本关是 2.2 的图,而 2.2 的通行口径就是减半;×1.75 会让蓝板一跳 9 格(塔段 546 那块把人从 y=8 直接送到 y=17),÷2 约 0.7 格,后者才像原版蓝板。用户 2026-09 拍板取 ÷2;`w.flipMul` 仍可改,供定点实验 |
| 53 | 重力门:`flipGravity(player, true/false, false)`,**没有 `vy=0`** (`checkCollisions.cpp:188-207`) | `world.ts` 重力门分支 | **一致** | GD:速度保留并按第 52 条处理(现在 = 减半);我们:保留 + 减半 + `onGround=false`(只有方向真的变了才动,和 `flipGravity.cpp:2` 的 `if (m_upsideDown != upsideDown)` 一致) |
| 54 | 重力门触发用玩家外框相交,盒子 `75×25`(id 10/11:`{75,25,-12.5,-37.5}`)(`longdata.cpp:32-33`) | `gdids.ts:69` `gravity:[25,75]`;`world.ts:200` | **一致**(尺寸对称)/ **锚点未还原** | 表里是 75 宽 × 25 高,我们写成 25 宽 × 75 高 —— 因为取的是包络盒且两者都是纯包围盒判定,功能上等价;但原表 x/y 偏移(-12.5,-37.5)说明它其实是"横向 75 宽、贴在门底"的盒,我们没还原 |
| 55 | 翻转时清空 `m_dict_518/m_dict_520`、`m_collidedUUID=0`、`m_onGround=false`、球则 `runBallRotation2` (`flipGravity.cpp:15-17,48-55`) | `world.ts` 未实现 | **缺失** | 我们只改 `gdir`;GD 还会清"同帧已撞过的物件表"(防止翻重力后立刻再撞同一个块) |
| 56 | `arg2=true` 时不出光圈、`m_lastHitGround = m_lastPortalLocation` (`flipGravity.cpp:29-32,48`) | 无 | **缺失**(表现层) | 只影响视觉/落台基准点 |

### 1.6 碰撞 checkCollisions

| # | gdp 里的规则 | 我们实现 | 判定 | 差在哪 |
|---|---|---|---|---|
| 57 | 危险物(刺/锯):`playerRect = player->getObjectRect()`(和实心碰撞**同一个** rect),然后 `(playerTouchesObject(playerRect, obj->getObjectRect()) && obj->hitboxRect <= 0) \|\| objectIntersectsCircle(player, obj)` (`checkCollisions.cpp:440-445`) | `world.ts` 刺走**内框** 7.5×7.5、锯片(圆)走**外框** 30×30 | **口径待定(已量化)** | 原文用的是**一个** rect,没说内/外;OpenGD 把危险物定成**外框**(`playlayer.cpp:1494-1502`)、内框留给实心交互。我们刺走内框 = 更宽松。**2026-09 量化过**:若改外框,当前自由路线多 55/2970 帧死亡(最深压进 0.31 块)、正规路线多 33/2271 帧,且两条卷子都会在第 18 帧(x=2.5,出生走廊那根吊刺)死掉。**决定:维持内框**——社区 mod「Accurate Hitboxes」的说明是"让危险判定尽量准,**可能让某些关卡变得不可能**",说明原版危险判定本身偏宽松;这条留 `--hazbox=outer` 做 A/B(见 `tools/hazbox-audit.ts`、HANDOVER §13.19) |
| 58 | 刺的判定盒(id 8 `{12,6,-3,-6}`、39 `{5.6,6,-3,-2.8}`、103 `{7.6,4,-2,-3.8}`、392 `{4.8,2.6,-1.3,-2.4}`)(`longdata.cpp:30,50,93,225`) | `gdids.ts:54`;`world.ts:186-192` | **一致** | ★ 复核纠正(2026-09):同 #33 —— 原表 y 偏移是**左下角**,`y=-h/2` 就是居中,所以"刺盒整体上移 3 单位"是误报。刺 8 的盒 y∈[中心-6, 中心+6],和我们一致(见 `tools/hb-audit.ts` 的"本关用到的 ID 居中情况") |
| 59 | 可破坏砖:`isBreakable` 走"摧毁而非死亡" (`world.ts:716-721` 对应 `gdp211 checkCollisions.cpp` 无专门支路,OpenGD 走 `collidedWithObject`) | `world.ts:715-721` 内框相交即碎 | **一致**(行为) | — |
| 60 | 实心侧面撞死:内框 × `getObjectRect(0.3,0.3)` 再判死 (`gdp\...Internal.cpp:616-652`) | `world.ts:722,769` 内框相交即死 | **一致**(口径近似) | GD 最后一道是**缩到 0.3 的迷你盒**(9×9),我们直接用 7.5×7.5 内框。9×9 比 7.5×7.5 略宽 ⇒ GD 判死略更严 |
| 61 | 落台容错 `snapUpThreshold`:默认 10 / `m_stateScale>=1` → 15 / 平台模式 5;飞行类(非平台模式)`gravityMult*6`;`maxSnapY = playerBottom + snapUpThreshold`,`floatG = maxSnapY - adjustedYDelta`,两路任一越顶即 `canSnap` (`gdp\...Internal.cpp:27-40,125-140`) | `world.ts:740-751` `snapTol = 6(飞)/10(mini)/15`,`reachDown = max(y, frameY0)+snapTol`,`reachUp = min(top, frame0Top)-snapTol` | **一致** | 15/10/6 与"帧初/本帧两路"都还原了 ✓ 出处 `gdp211` 的 `checkCollisions.cpp` 里没有这段,实际出处是 `.tmp\gdp\PlayerObject_collidedWithObjectInternal.cpp:125-140` |
| 62 | `checkSnapJumpToObject` **只对 `vType==Cube` 调用** (`gdp\...Internal.cpp:249-251,370-372`) | 我们在 `world.ts` 里没有任何 cube 专用的吸附 | **缺失** | 任务问"只对 cube 生效这件事我们是否还原"——**没有还原,因为整个机制都没实现**。见 §2 |
| 63 | `checkSnapJumpToObject` 的距离表(小/下/大台阶)按 `m_playerSpeed` 分档:0.9→(120/150/90)、0.7→(90/120/60)、1.1→(150/195/120)、1.3→(180/225/135)、默认→(120/90/135…按 vehicleSize) (`gdp211\checkSnapJumpToObject.cpp:14-39`;`gdp\PlayerObject_checkSnapJumpToObject.cpp:14-46`) | `world.ts:942-944` `spiderReach()` 直接用了这张表 `[60,90,120,135,120]` | **数值不同 + 出处误用** | **这张表是"方块吸附到 30/60/90 单位高的台阶精灵"用的,不是蜘蛛的可达距离**。我们把它当成蜘蛛搜索带(`world.ts:937-941` 注释明写"照搬原版 checkSnapJumpToObject 的距离表"),来源错误。另外档 4(1.6)在我们这里是 120,而 GD 的默认支给 135/180 ⇒ 也对不上 |
| 64 | 蜘蛛搜索带:`player->isSpider` 分支引用 `m_vehicleSize`(`ringJump.cpp`/`updateJump.cpp` 里蜘蛛专属量) | `constants.ts:54,56` `spiderBand=8`,注释"(厚度 = m_vehicleSize × 8 块)" | **未验证** | 反编译里找不到 `spiderTestJump` 的实现体,`spiderBand` 从未被使用(死常量)。8 块这个数**没有可核出处**;而我们实际用的又是 #63 那张表。**同一件事我们有两套互相矛盾的来源** |
| 65 | 物件判定盒的**锚点**语义:`setOuterBounds(pos + (15,15) + (rec.x, rec.y), rec.size)`(OpenGD `gameobject.cpp:758-772`),即 `_pHitboxes` 的 (x,y) 是相对**对象中心点**的偏移 | `world.ts:147-155` 以物件中心为心、忽略偏移 | **一致(个别例外已修)** | ★ 复核纠正(2026-09):见 #33/#58 —— 原表 (x,y) 是盒**左下角**偏移,`(-w/2,-h/2)` 就是居中,那批"普遍偏差 0.07~0.13 格"是误报。真正的例外只有传送门 747(`x=-0.5`,横向右移 12 单位),已按 `GD_HITBOX_OFFSET` 修好(本关 7 个) |
| 66 | 玩家判定盒:`Rect(pos, (30,30))` 与 `Rect(pos+(11.25,11.25), (7.5,7.5))`;迷你时外框 ×0.6 (`OpenGD playlayer.cpp:750-751,1239`) | `world.ts:433-444` `box=30*sizeMul`,`innerOff=11.25*sizeMul`,`innerSize=7.5*sizeMul` | **一致** | 30/30、11.25、7.5 全对;迷你同时缩内框(我们把 innerOff/innerSize 都乘了 sizeMul) |
| 67 | 关卡上边界:`y > 2790+cubeSizeScalar` 直接 return(不判死);反重力撞顶 `destroyPlayer` (`checkCollisions.cpp:36-45,71-74`) | `world.ts:585,598,604,709,617` 用 `rows*U` 边界 | **数值不同** | 关卡高度由"本关 rows"给出,不是原版的固定天花板 + 相机;两者的死区位置不同。原版顶部是**死区(destroyPlayer)**,我们出顶也是死(`this.y+box > rows*U → die`)⇒ 方向一致 |
| 68 | 地面:`groundY = 90 + groundHeight/2 - xmm2`,落地 `hitGround(false)` (`checkCollisions.cpp:25-45`) | `world.ts:675-710` 用关卡里的实心/平台 | **未验证** | gdp211 的 `groundY` 依赖 `xmm2/groundHeight` 两个来源不明的量(反编译残留),无法核对。我们走"几何地板",设计上不同 |

### 1.7 形态门 / 速度门 / 尺寸门 / 传送门 / 克隆门 / 力场 / 触发器

| # | gdp 里的规则 | 我们实现 | 判定 | 差在哪 |
|---|---|---|---|---|
| 69 | 形态门只切形态:`willSwitchToMode` / `switchToFlyMode`;`setGamemode` 里 **仅飞船** `m_dYVel /= 2`,仅 Cube/Ship `setIsOnGround(false)`;不改位置、不改 `gdir` (OpenGD `playerobject.cpp:796-830`;`msg-portal.txt:4-7` 也确认) | `world.ts:853-871` | **一致** | `to==='ship' → vy /= 2`、`cube/ship → onGround=false` ✓ |
| 70 | 非 GD 铺面的兼容支:`!strict && to==='ship' && y<3*U → y=3*U` (`world.ts:870`) | — | **我们猜的** | 见 §3 |
| 71 | 速度门:改 `m_dXVel` + `playerSpeed`(见 #3) | `world.ts:872-877` | **一致**(分档)/ 见 #2(倍率) | — |
| 72 | 尺寸门 `toggleMini`:`_vehicleSize = active?0.6:1`;外框 ×0.6 (OpenGD `playerobject.cpp:1019-1022`;`playlayer.cpp:1470-1481`) | `world.ts:916-923`;`constants.ts:55` | **一致** | — |
| 73 | 传送门 747:盒 `{90,25,-0.5,-45}`;入口 → `setPositionY(realPos.y + teleportY)` + 出/入口两个 portalCircle (`checkCollisions.cpp:360-392`;`longdata.cpp:277`) | `gdids.ts:211-212,288-293`;`world.ts:894-915` | **一致**(纵向偏移)/ **未验证**(配对模型) | 我们用"蓝入口→橙出口配对 + 键 54 纵向偏移"两套;GD 2.11 只有**单物件自带纵向偏移**这一种(`gameObj->teleportY`),没有"橙出口物件"这一说 —— 我们多了一套 |
| 74 | 克隆门 286/287 `{91,41,-20.5,-45.5}` (`longdata.cpp:185-186`) | `gdids.ts:213-214` `inert:true` | **缺失**(只标记) | 克隆/回收完全不生效(见 §2) |
| 75 | 力场(2.2 的 Force) | `world.ts:216,785-792`;`level.ts:60` | **未验证** | **2.11/gdp master 源码里没有力场**(`GameObject.cpp` 无 Force 类型、`_pHitboxes` 无 2.2 ID)。我们按"垂直加速度 `fy`"实现,出处不可核 |
| 76 | 触发器:`if(obj->_isTrigger && obj->getPositionX() <= player->getPositionX()) triggerActivated(dt)` (OpenGD `playlayer.cpp:1328-1335`) | `world.ts:888-893` + `hitEvent()` :997-1001 | **一致**(x 越线)/ **数值不同**(strict 支) | 非 GD 铺面我们按"跨过 x"✓;GD 真实铺面走 `outer()` 相交 ⇒ **与原版不同**(原版只看 x) |
| 77 | 触发器一次性:靠 `effectManager->hasBeenTriggered(uniqueID)` + `storeTriggeredID` (`checkCollisions.cpp:295-302`) | `world.ts:891` `armedTriggers` | **一致**(但见 §3 的 move 语义) | — |
| 78 | move 触发器:`runMoveCommand(_duration, _offset, _easing, _easeRate, _targetGroupId)` (OpenGD `EffectGameObject.cpp:181`) | `world.ts:374-379,391-417` | **数值不同** | 我们:线性/sine 二选一、dur 取整帧、loop 往复(`level.ts:83`);OpenGD:有 `_easeRate` 参数、无 loop 语义。停止(stop)/生成(spawn)/震动/旋转等触发器**全缺** |
| 79 | color/pulse 触发器:`ColorAction`(目标颜色通道 + 淡入淡出序列)、`_fadeIn/_hold/_fadeOut` (`EffectGameObject.cpp:146-260`) | `world.ts:380-386` | **数值不同** | 我们是"全局 tint + 一次性闪光 `flash=1`,每帧 -0.08"(`world.ts:392`);GD 是逐颜色通道 + 三段式(淡入/保持/淡出)。**有 fadeIn/hold/fadeOut 的脉冲我们没实现** |

### 1.8 冲刺箭头 / 紫色上跳箭头

| # | gdp 里的规则 | 我们实现 | 判定 | 差在哪 |
|---|---|---|---|---|
| 80 | 冲刺箭头 = `kGreenDashRing`(1751)/`kPinkDashRing`:粉的**先 `flipGravity` 再 `startDashing`**;绿的直接 dash (`ringJump.cpp:18-31`) | `gdids.ts:188-189`;`world.ts:825-830` | **部分一致** | "粉翻重力"✓(我们在 `world.ts:829` 翻)。但 GD 是先翻重力、**再**进 dash;我们是先设 dash 再翻重力,顺序反了(影响同一帧的 dash 方向) |
| 81 | `startDashing` / `isDashing` 状态机:冲刺期间 `ringJump` 直接 return;`updateJump` 里 `isSpider && !isDashing` 才走瞬移 (`ringJump.cpp:2`;`updateJump.cpp:102-105`) | `world.ts:428,576-586` `dash={ang,kind,t}` | **数值不同 / 未验证** | 我们:`vy = ｜vx｜ * dir.y`、`t>0.5 ｜｜ !hold` 就结束、出界即死(`world.ts:582-585`)。搜索不到 `startDashing` 的实现体 ⇒ **dash 的时长/水平速度/结束条件全是自定**。紫色(3004)在 2.11 里不存在 |
| 82 | 箭头判定盒 1704/1751 = `{36,36,-18,-18}` (`longdata.cpp:387,428`) | `gdids.ts:59,188-190` `arrow:[36,36]` | **一致** | — |
| 83 | 黑环/冲刺环的"环"与"箭头"是同一族 (`ringJump.cpp:18-31` 与 OpenGD `playlayer.cpp:1432-1445` 同一 switch) | 我们分 `orb:'black'` 与 `arrow:'green'/'pink'` | **部分一致** | 黑环 = 立即赋值速度;箭头 = 持续 dash。GD 里 dash ring 两者都进 dash。**我们的黑环没有进 dash 状态** |

### 1.9 蜘蛛抓取与横向判定

| # | gdp 里的规则 | 我们实现 | 判定 | 差在哪 |
|---|---|---|---|---|
| 84 | `isRestricted() = isFlying() \|\| isSpider \|\| isBall`,它进的是 `ypos >= groundY \|\| isRestricted() \|\| dualMode \|\| !isUpsideDown` 这个大条件 (`checkCollisions.cpp:1-3,36`) | `world.ts:677` 只把 ship/ufo/wave 排除,球/蜘蛛仍走地面吸附 | **一致**(常重力)/ **数值不同**(反重力) | 常重力下 `!isUpsideDown` 让这个条件恒真,球/蜘蛛的落地行为与方块同支 ⇒ 我们"让球/蜘蛛吸附地面"在常重力下是对的。**反重力**时才分出 `isRestricted()` 那条受限区路径(`:49-136` 用 `groundRestrictionY/ceilingRestrictionY`),我们没有这个概念 |
| 85 | 蜘蛛横向判定用 `playerTouchesObject(playerRect, loopObject->getObjectRect())`,其中 `playerTouchesObject` 是**四边包含**(`objMinX<=playerMinX && objMaxX<=playerMaxX && …`) (`checkCollisions.cpp:5-18,434`) | `world.ts:949-955` 用外框**相交** (`hx1<=s.x0 \|\| hx0>=s.x1`) | **数值不同** | GD 的 `playerTouchesObject` 在 2.11 里写成了"物件完全被玩家包含"(要求物件比玩家窄),与 OpenGD 的 `intersectsRect`(宽松)矛盾。**两版反编译互相矛盾** ⇒ 我们取"一格宽外框相交"是合理折中,但**不是任何一版的原文**(`world.ts:949-954` 的注释引用的是同一行的 `playerTouchesObject`,而它并不是相交判定) |
| 86 | 蜘蛛落地/贴面后 `boostPlayer(?)/m_yAccel = ∓1` 级别的小速度 | `world.ts:987` `vy = -P.spiderVel*gdir`,`spiderVel=1.0` | **未验证** | 反编译里没有"蜘蛛落地后给 ∓1"的赋值(只有 `checkSnapJumpToObject` 的吸附)。`spiderVel` 无出处 |
| 87 | 蜘蛛也受 `m_lastSpiderFlipTime < 0.04` 保护 (`gdp\...Internal.cpp:633-635`) | 无 | **缺失** | 翻重力后 0.04 s 内不与方块判死 |
| 88 | 翻重力后 0.1 s 内的"落台保护" `canSnap && m_totalTime - m_lastFlipTime < 0.1` (`gdp\...Internal.cpp:621-631`) | 无 | **缺失** | GD 在翻转后的短暂窗口里把撞头改成落地;我们直接判死 |

---

## 2. 「gdp 里有、我们完全没有对应实现」清单

按"对手感的潜在影响"排序:

1. **`checkSnapJumpToObject`:方块在高台阶之间的横向吸附 / 爬台阶**
   `gdp\PlayerObject_checkSnapJumpToObject.cpp:1-71`、`gdp211\checkSnapJumpToObject.cpp:1-77`;调用点 `gdp\...Internal.cpp:249-251,370-372`(只在 `vType==Cube`)。
   逻辑:当方块连续落在不同台阶块上、且两块的相对位移命中"小台阶 120 / 下台阶 150 / 大台阶 90(或 30/60)"之一的容差窗口时,把玩家 x **吸附**到新块上,让他"走上台阶"而不是撞死。我们完全没有 —— 一格高的实心台阶在我们这里是**判死**(`test/sim.test.ts:107-113` 明确断言"撞一格台阶应该死")。若真实铺面里有贴地的方块台阶,这是"本该走过去却死了"的来源。
2. **`m_stateRingJump` 状态机(飞行类/UFO/波浪/蜘蛛的环)**
   `gdp\PlayerObject_updateJump.cpp:110,150-225`。UFO 环:只有"新的一次"才置速,并且带"最小值比较"(`:208`);摇摆/蜘蛛环在 `updateJump` 里兑现并翻重力。我们是"环 → 立即赋值"。
3. **`m_jumpBuffered` 缓冲跳(球/机器人的空中按键兑现)**
   `gdp\...updateJump.cpp:110,323,391-396`;空中按下时标记、落地时消费。我们的注释(`world.ts:622-629`)声称做了,代码里没有。
4. **自定义环 `kCustomRing` + `canHitCustomRing/unknown_74a` 门闩**
   `ringJump.cpp:3-5,9-13`。我们一张环种类表,没有自定义环。
5. **`untouchedRings`(每帧重置的"可点环"集合)+ `hasBeenActivatedByPlayer` 的逐帧语义**
   `checkCollisions.cpp:152,165`;`ringJump.cpp:8`。我们用永久 `armedOrbs`,语义相近但不是同一件事(原版允许环在"重开/回退"后重置)。
6. **dash 完整状态机(`startDashing` / `stopDashing` / `isDashing`)**
   引用点 `ringJump.cpp:2,18-31`;`updateJump.cpp:102-105`;`gdp\...Internal.cpp:575-601`(`stopDashing` + 清缓冲)。我们只有 `world.ts:428,576-586` 的近似。
7. **`m_maybeIsBoosted`(弹簧/起跳后的"推力飞行"标志)与它对应的整段特判分支**
   `gdp\...updateJump.cpp:328,420-448,456-460`;`propellPlayer.cpp:2-6`;`boostPlayer.cpp:1-24`。我们用一个"速度符号"替代(`world.ts:555-561,1066`),不是同一个东西。
8. **`boostPlayer(float)` 本身**(速度赋值的完整版:置 rising/sliding/onGround/hitPortal + 旋转动画)
   `gdp211\boostPlayer.cpp:1-21`;`gdp\PlayerObject_boostPlayer.cpp:1-24`。我们只在 `applyTrigger` 里赋值速度。
9. **坡道碰撞全族**:`collidedWithSlope` / `m_isOnSlope` / `m_slopeRotation` / `m_slopeVelocity` / `preSlopeCollision`
   `checkCollisions.cpp:330-337`(`case kSlope`);`gdp211.json` 列出的 `PlayerObject/preSlopeCollision.cpp`;`gdp-flat.json` 的 `PlayerObject_collidedWithSlopeInternal.cpp`。我们一张坡都没有。
10. **双人 / 平台模式**:`dualMode`、`dualObject`、`player2`、`m_isPlatformer`
    `checkCollisions.cpp:36,47-136,265-269,314-329`。全缺。
11. **`hitGround` / `updateCollide` / `specialGroundHit` / `m_groundYVelocity`(移动平台带人)**
    `gdp\...Internal.cpp:184-241`;`OpenGD playerobject.cpp:943-964`。我们 `world.ts:689,707,760,764` 直接 `vy=0; onGround=true`,**移动平台不会带着人走**,也没有 `specialGroundHit`(落地后按平台速度再压一点速度)。
12. **`m_lastFlipTime` / `m_stateFlipGravity` 的落地保护窗口**
    `gdp\...Internal.cpp:194-205,315-325,442-457,621-631`。翻重力后 0.1 s 内的特殊落台处理没有。
13. **`updateCollideTop/Bottom`、`m_collidedTopMinY/m_collidedBottomMaxY`(连续多块落台的"最高接触面"记账)**
    `gdp\...Internal.cpp:219,281-291,394-420`。我们每次只处理当帧的方块。
14. **`isSafeFlip` / `isSafeMode`(天花板/地面受限区的安全翻转判定)**
    `checkCollisions.cpp:79,113,460`。没有对应实现。
15. ~~**`objectIntersectsCircle` + `_radius`(圆形判定物件,锯片族)**~~
    **✅ 2026-09 已补齐**:`gdids.ts` 的 `GD_HITBOX_RADIUS`(照抄 `longdata.cpp:461-466`)+
    `world.ts` 的 `circles` / 死亡判定"玩家**外框** vs 圆"(出处 OpenGD `playlayer.cpp:1491-1503`:
    有半径的走 `intersectsCircle`,没半径的才走矩形)。本关 552 个锯片(1705×550、1706×2)全部走圆;
    见 HANDOVER §13.18。**剩下的**:玩家侧 `spikes` 仍用内框(原版危险物统一用外框,见 §13.11 待办)。
16. **`usesOrientedBox` / `OBB2D::overlaps1Way`(旋转物件的定向包围盒)**
    `checkCollisions.cpp:177-182,447-449`。我们一律轴对齐盒,旋转只做宽高对调。
17. **`isUnloaded` / `toggledOff` / 分组禁用(`getGroupDisabled`)**
    `checkCollisions.cpp:152,433,444`。没有。
18. **`section` 空间分区与 `sectionForPos` 的 `section-1..section` 窗口**
    `checkCollisions.cpp:141-144`。我们用 x 索引窗口(等价目的,不同实现),但**原版窗口只覆盖 2 个 section**,我们的窗口是 `[x-6块, x+45块]`。
19. **`preCollision()` / `postCollision(delta)` 钩子**
    `checkCollisions.cpp:22,458`。没有。
20. **硬币收集的练习模式分支**:`if(!practiceMode){...}` (`checkCollisions.cpp:305-312`);以及用户硬币最多 3 个、按 x 排序 (`createObjectsFromSetup.cpp:42-58`)。我们只做"碰到就收"。
21. **`LevelSettingsObject` / 关卡头部解析 / `xCompSpeed` 排序 / `m_endPortal`**
    `createObjectsFromSetup.cpp:22-78`。我们直接从紧凑文本建对象,没有这些。
22. **`LabelGameObject` / `RingObject` / `AnimatedGameObject` / `StartPosObject` / `TeleportPortalObject` 的按 ID 分派**
    `createWithKey.cpp:1-99`。我们是一张平表 + kind 枚举,没有类分派(功能等价,但 `case 914/747/31/1615` 这些特殊化的行为我们按 kind 硬编码)。
23. **`objectFromString` 的 ID 改写**:717/718/743/221→899(颜色触发器)、1008→1292、104→915(线触发器);`6` 的 `floor(rot/90)*90` 量化 (`objectFromString.cpp:12-20,96-100`)。
    我们的 `mapRecord`(`gdids.ts:250-301`)没有这三条 ID 改写,旋转也没有量化。
24. **`addMainSpriteToParent` 的 z 层/blend 决策**(颜色通道 <1008 就 blend、`colorID==1024` 死循环等)
    `addMainSpriteToParent.cpp:1-145`。我们 `main.ts` 按 kind 画,没有颜色通道 blend 决策。

---

## 3. 「我们实现了、但 gdp 里找不到出处」清单(★ 手感跑偏头号嫌疑)

按嫌疑大小排序。每条都给了"我们写在哪"和"为什么说出处存疑"。

1. **`P.speedMul = [0.7, 0.9, 1.1, 1.3, 1.6]`,注释标 `[GDOpenGD]`** — `constants.ts:34`
   OpenGD `playlayer.cpp:1915-1950` 与 gdp211 都**没有这张倍率表**,只给了 5 个 `m_dXVel`。按 OpenGD 反解,倍率应是 `[0.806, 0.9, 1.1, 1.243, 1.5]`。
   **影响**:档 0(慢速门)我们比原版慢 13%、档 3 快 4.6%、档 4(4x 速)快 6.7%;所有"速度门之后的落点/间距"都会漂。这是全表最大的一处数值风险。
2. **`spiderReach() = [60,90,120,135,120]` 直接搬 `checkSnapJumpToObject` 的台阶表** — `world.ts:937-944`
   那张表是**方块吸附到台阶精灵**用的(`gdp211\checkSnapJumpToObject.cpp:14-39`),不是蜘蛛的可达距离。同时 `constants.ts:56` 还留着一个从未被使用的 `spiderBand=8`(注释说来自 `m_vehicleSize × 8`)。**我们对同一件事有两套互相矛盾的来源**。
3. ~~**`applyTrigger` 里蓝/绿/环的 `FLIP_VEL_MUL` 处理**~~ — **已解决(2026-09)**
   原来两张源冲突:gdp@2.11 `flipGravity` 是 `m_yAccel *= 1.75`,OpenGD(2.2)是 `m_dYVel /= 2`。
   当时取 1.75,结果**本关 714~727 那段垫板走廊按 1.75 无解**(A/B 实测:同一处手工状态,
   714.2/23 起点 ×1.75 死在 718.0、÷2 过到 740.6;716/24 起点 ×1.75 死在 726.6、÷2 过到 740.6)。
   现在定案 = **÷2**(`world.ts` 文件头 `FLIP_VEL_MUL = 0.5`),理由三条写在那个注释里:
   关卡自己的证据、版本(本关是 2.2 的图)、手感(×1.75 让蓝板一跳 9 格,÷2 约 0.7 格)。
4. **弹簧/跳环的"推力飞行不夹终端速度"豁免** — `world.ts:555-561`
   GD 的豁免来自 `m_maybeIsBoosted` 那一整支(`gdp\...updateJump.cpp:420-448`),**上升支本来就完全不含钳制**;我们的 `boostDir` 是自造量,而且**整个上升段都在"不钳"**、回落时才钳 —— 与原版的分支边界不同。黄板峰值我们 3.9 块 / GD 4.4 块。
5. **`hitEvent()` 的 strict 分流** — `world.ts:991-1001`
   真实 GD 铺面我们走"外框相交",但原版触发器的条件**只有 x**(`OpenGD playlayer.cpp:1328-1335`)。同一文件里我们给"门"用了相交、给"触发器"用相交,原版对门是相交、对触发器是 x —— 一半对一半错。
6. ~~**重力门清零速度**~~ — **已修**:原版 `flipGravity` 不清零,而是按第 52 条换算(现在 = 减半)。
7. **`force`(力场)整套** — `world.ts:216,785-792`;`level.ts:60`
   2.11/gdp 源码里没有 Force 类型。我们是"垂直加速度 `fy`",来源不可核。
8. **`dash` 的参数**:`vy = |vx|*dir.y`、`d > 0.5s || !hold` 结束、出界判死 — `world.ts:576-586,1124-1133`
   搜不到 `startDashing` 实现体。结束条件(0.5 s / 松手)与箭头方向映射(`arrowDir` 的 0.7 横向下限)都是自定。
9. **`clone` 门只标记不生效** — `gdids.ts:213-214`;`world.ts:177`
   原版 286/287 有真实判定盒 `{91,41,-20.5,-45.5}`(`longdata.cpp:185-186`)和克隆/回收逻辑,我们完全跳过。
10. **`check` 存档点判定盒 `[30,30]`** — `gdids.ts:74,215`
    `longdata.cpp` 里**没有 2063**(它是 2.2 物件)。这个 30×30 是猜的。
11. ~~**`saw` 判定 = 自身包围盒**~~ — **✅ 2026-09 已按原版改正**:`gdids.ts` 的 `saw` 只用于**画法**,
    判定走 `GD_HITBOX_RADIUS`(1705→32.3 单位 = 1.077 块、1706→21.6)+ 缩放,圆心 = 物件中心;
    `_pHitboxes` 的 `1705→85×44`(`longdata.cpp:388`)是**贴图外框**,不再当判定用。见 HANDOVER §13.18。
12. **`miniTriggerMul` 的作用域** — `world.ts:1024,1031`
    ×0.8 在 GD 里只在通用跳环支(`ringJump.cpp:116`),我们对**黑环也乘**。
13. **`ball` 在弹簧/黑环上的 ×0.6 / ×0.7** — `world.ts:1047`(弹簧 ✓)、**黑环缺 ×0.7**(`ringJump.cpp:127-130`);`constants.ts:1033-1046` 的注释里**同一条规则写了两遍、结论相反**(第一段说"球不打折 16",第二段说"维持 0.6"),这是代码里唯一自相矛盾的地方。
14. **`P.miniSize` 与 `P.miniTriggerMul` 的注释串行** — `constants.ts:55-56`:第 55 行的行尾注释被拼到了第 56 行,`spiderBand=8` 的说明文字实际是 `miniTriggerMul` 的。文档级错误。
15. **非 GD 铺面的兼容支 `to==='ship' && y<3*U → y=3*U`** — `world.ts:867-870`
    为了保住自动铺面的旧行为而保留,原版没有这种吸附。
16. **`pit` / `text` / `deco` / `platform` 这几个 kind** — `level.ts:25-46`
    都是我们自己引擎特有的(自动铺面用),真实 GD 铺面不走。
17. **黄色跳板 `PAD.yellow.v = 16` 的峰值注释** — `constants.ts:102` 写"峰值 4.45 块",而 `test/sim.test.ts:188` 的实测是 3.9 块,两者都没错(一个解析、一个模拟),但**没有任何测试断言"峰值 = 4.45"**,所以 #4 那条偏差一直没被发现。
18. **`pink ring = 0.72` 与 `pink pad = 0.65` 的区分** — `constants.ts:94,103`
    数值本身有出处(✓),但 `gdids.ts:176` 把 141 标成"紫/粉色跳环"并给了显示色覆盖 `0xc6a0ff`(`gdids.ts:132`),这是用户口径不是源码口径。

### 3b. 反编译内部自相矛盾、因此我们被迫"猜"的条目(单列)

| 位置 | 矛盾 | 我们的取法 |
|---|---|---|
| `gdp211\propellPlayer.cpp:6`(16×force) vs OpenGD `playerobject.cpp:404`(16×force) | 两版一致 ✓ | — |
| `gdp211\flipGravity.cpp:19`(×1.75) vs OpenGD `playerobject.cpp:540`(`/= 2`) | **完全相反** | **已定案 = 取 OpenGD 的 ÷2**(`world.ts` 文件头 `FLIP_VEL_MUL`):本关 714~727 那段垫板走廊在 ×1.75 下无解、在 ÷2 下过得去(A/B 见 §2 第 3 条);另外本关是 2.2 的图,2.2 的通行口径就是减半 |
| `gdp211\updateJump.cpp:203-208`(`yAccel = min(15, yAccel)` 显然是被反编译搞坏的行) | 会**丢掉算出来的新速度** | 取"只钳下落方向"的语义 |
| `gdp211\checkCollisions.cpp:5-18`(`playerTouchesObject` = 四边包含)vs OpenGD `intersectsRect` | **相反** | 取相交 |
| `gdp211\updateJump.cpp:19`(`if(!this->hasHitPortal)`) | 会把飞船加速度整段跳掉,逻辑上不可能 | **未验证**,按 OpenGD 的飞船公式实现 |
| `gdp211\checkSnapJumpToObject.cpp` vs `gdp\PlayerObject_checkSnapJumpToObject.cpp` | 阈值表数值相同但默认支不同 | 都没采用 |

---

## 4. 结论与建议修的前 5 项(按 对手感影响 × 修改成本 排序)

### ① 把速度表改成"每帧位移",并把 `[GDOpenGD]` 标注改掉 —— 影响最大、成本最低
`constants.ts:33-34`。现在这张表是"速度值 × 倍率"两层,而**两层都没有可核出处**(见 #1/#2)。建议改成一层、逐档列 `每帧位移`(现口径 = `[4.186, 5.193, 6.457, 7.8, 9.6]`),并在注释里写清楚:OpenGD 的 `changePlayerSpeed`(`playlayer.cpp:1915-1950`)给的是 `m_dXVel = [5.98,5.77,5.87,6.0,6.0]` + `playerSpeed = [0.7,0.9,1.1,1.3,1.6]`,**两版源码在这张表上互相冲突**(按 `m_dXVel × playerSpeed` 复现不出社区公认的 8.4/10.4/12.9/15.6/19.2 块/秒),所以最终值必须靠"在真实铺面上量一段固定距离的通过帧数"标定。
**代价**:`vxOf()` 的下游(机器人 `botThink`、`level.ts` 的铺面几何、`sim.test.ts:38-51`)会跟着变,需要重跑 `node --test` 与 `diag-bot`。**这一步不改数值也能先做**(只改文档与出处标注),是零风险的收益。

### ② 弹簧/跳环:去掉自造的 `boostDir`,改用 GD 的分支边界
`world.ts:555-561,1064-1066`。GD 的规则是"上升支完全不含终端速度钳制、下落支含"(`gdp\...updateJump.cpp:456-460` vs `:420-448`),**不需要额外的标志位**。改法:`applyFallClamp()` 只在 `vy*gdir < 0`(下落)时钳制、去掉 `boostDir` 的提前 return;顺带把 `constants.ts:27` 注释里"黄弹簧 16 能原样生效 ⇒ 峰值 4.45 块"和 `sim.test.ts:188` 的 3.9 块对齐。
**收益**:黄板峰值从 3.9 → 约 4.4 块(≈0.5 格),弹簧连与"弹簧过刺"的落点全部右移。

### ③ 把 `spiderReach()` 从"台阶表"换回真正的可达距离,并补 `constants.ts` 的文档错误
`world.ts:937-944`、`constants.ts:54-56`。两件事:
(a) `checkSnapJumpToObject` 的表**不是**蜘蛛可达距离,必须换来源(反编译里没有 `spiderTestJump` 实现体 ⇒ 要么按 `constants.ts:56` 原本写的 `m_vehicleSize × 8` 块,要么标成"未验证的近似值"并在注释里写清楚);
(b) `constants.ts:55-56` 两行注释串行了,`miniTriggerMul` 的说明被写到 `spiderBand` 上,顺便修掉。
**注意**:这一条改动会直接影响蜘蛛段的落点,建议先用 `diag-chart` 在真实铺面上做一次 A/B。

### ④ 重力门与蓝板/蓝环的 ×1.75:统一到 `flipGravity` 一条路径
`world.ts:878-887`(重力门 `vy=0`)、`world.ts:1048-1054`(弹簧"故意不乘")。
最小改动、最大一致性:**把所有"翻重力"收敛到一个私有方法 `flipGravity(toUpsideDown, arg2)`,里面只做"×1.75 + gdir 翻转"**(`flipGravity.cpp:18-20`),然后:
- 重力门:`flipGravity(target, false)`,**删掉 `vy=0`**;
- 蓝板:`vy = 12.8*oldGdir` → `flipGravity(!gdir, true)`;
- 蓝环/绿环同理。
**这一条会显著改变手感**(蓝板 12.8→22.4、蓝环 8.94→15.65),所以建议**和 `padMul` 微调口子一起上**,先在真实铺面上验一遍再定死。如果你确认"原版蓝板就是 22.4 那种冲劲",这一条价值极高;如果不是,就把它降级成"已知偏差、保留现口径"并写进报告。

### ⑤ 补 `m_jumpBuffered`(球/机器人的落地缓冲),顺手补空中起跳的 `1/32`
`world.ts:618-641,650-660`。现状:注释(`:622-629`)说做了缓冲跳,代码里没有 —— **注释与实现不符是审计里最危险的一类问题**。改法:加一个 `jumpBuffered` 布尔,空中按下时置位、`pressFresh` 单独留给环/门;落地那一步消费它。
顺带:`gdp211\updateJump.cpp:247-250` 的"不在落地状态则 `jumpPower = 1/32`"这条也一起补(它决定了"空中按一下之后落地那帧的速度")。
**代价**:小(约 15 行 + 1 个测试);**收益**:按住球/机器人的手感、以及"空中乱按"的行为与原版一致。

### 备选(第 6~8 位,成本略高但影响明确)
- ~~**判定盒锚点**:把 `_pHitboxes` 的 (x,y) 偏移也用上~~ —— **✅ 2026-09 已核完**:那批"偏高 0.07~0.13 格"是把左下角偏移当成中心偏移的误报;本关 45 个可查 ID 里 44 个本来居中,唯一例外传送门 747 已按表修(`GD_HITBOX_OFFSET`)。证据:`tools/hb-audit.ts`。
- **爬台阶(`checkSnapJumpToObject`)**:只在 `mode==='cube'` 且命中台阶容差窗口时吸附 x。这是"该走过去却撞死"的最大剩余来源,但需要先把"水平吸附"接进 `substep` 的实心碰撞分支,成本中等。
- **反重力下球/蜘蛛的受限区**:`isRestricted()`(`checkCollisions.cpp:1-3,36,49-136`)只在 `isUpsideDown` 时才把球/蜘蛛从"地面吸附"切到 `groundRestrictionY/ceilingRestrictionY` 受限区(常重力下 `!isUpsideDown` 让大条件恒真,与方块同支 ⇒ 现在这样写是对的)。要照搬得先引入"地面线"概念,成本高,建议先只记档。

---

## 附:审计方法与可信度说明

- 每条结论都给了 `file:line`;凡是只有 OpenGD 有、gdp211 没有的,都在表格里标了实际来源文件名。
- **标了「未验证」的判定共 14 处**(#2、#9、#25 相关、#34、#36、#53 相关、#56、#63 相关、#64、#68、#73、#75、#81、#86),原因分三类,已在表内逐条写明:
  (1) 该机制在 2.11/gdp master 源码里**不存在**(力场、3004/3005、紫色板、dash 状态机、存档点 2063 的判定盒);
  (2) 反编译**自相矛盾**(flying 支的 `hasHitPortal`、`playerTouchesObject`、`flipGravity` 的 ×1.75 vs /2);
  (3) 引用的量在反编译里**来源不明**(`checkCollisions.cpp` 的 `xmm2/groundHeight/groundY`、`spiderTestJump` 的实现体)。
- 本报告只读代码,未改动 `tuagfey-blog/` 下任何文件。

---

# 附录 A:复核(2026-09,改物理之前先自己回读源码 + 实测)

审计的结论不能直接照改 —— 下面三条**复核后判定为误报**,证据在这里;另外三条**已按源码修掉**。

## A.1 误报:速度表无出处 / 复现不出社区口径

审计说 `P.speedMul=[0.7,0.9,1.1,1.3,1.6]` 两版源码都没有、且算不出 8.4/10.4/12.9/15.6/19.2 块/秒。复核:

- 出处其实有:gdp master `PlayerObject_checkSnapJumpToObject.cpp:14-33` 直接按 `m_playerSpeed` 分档写死了
  **0.7 / 0.9 / 1.1 / 1.3 / else** 五档 —— 这就是我们那张表的来源,不是编的。
- 算术也复现得出来:`(speedVal × speedMul) × 60 / 30 = 块/秒`
  · 5.98×0.7 = 4.186 → 8.37 块/秒 ✓
  · 5.77×0.9 = 5.193 → 10.39 ✓
  · 5.87×1.1 = 6.457 → 12.91 ✓
  · 6.00×1.3 = 7.800 → 15.60 ✓
  · 6.00×1.6 = 9.600 → 19.20 ✓
  五档与社区口径**逐位相同**。结论:不改。

## A.2 误报:弹簧 `boostDir` 是自造量,黄板峰值 3.9 vs 4.4 块

复核 gdp master `PlayerObject_updateJump.cpp:419-448`(推力飞行那一段)与 `PlayerObject_boostPlayer.cpp:2-8`:

```
boostPlayer(){ m_maybeIsBoosted = true; m_isOnGround = false; setYVelocity(amount); }
updateJump(){ if (m_maybeIsBoosted) { addToYVelocity(-float_d, 62);      // ★ 重力照常施加
                                       if (playerIsFallingBugged()) m_maybeIsBoosted = false; }  // ★ 速度反向就结束
              else { ... setYVelocity(max(m_yVelocity, -15), 5); } }     // ★ 终端速度只在这条支里夹
```

这正是我们 `boostDir` 的语义(推力飞行中不夹终端速度、重力照常、速度反向即结束)——
`applyFallClamp()` 与它一一对应,不是自造量。

实测本机模拟:初速 16 的峰值 = **4.39 块**(公式 `arcPeak(16) = 4.45`,社区口径 4.4);
方块起跳峰值 = **2.13 块**(公式 2.17,原作"跳两块多")。
（顺带纠正我自己一开始的误判:`Y_TIME_SCALE = 0.9` 是给 y 轴做时间重参数化,
`y += vy·sY` 与 `vy -= g·sY` 同时缩放 ⇒ **峰值不变、滞空变长 1/0.9**,不会把峰值压掉 10%。）

## A.3 误报:球的重力倍率方向反了

gdp211 的 `its_1_if_ball`(= 球时为 1.0)一度看起来和 OpenGD `playerobject.cpp:627-629`
(球 = 0.6)矛盾。复核 gdp master `PlayerObject_updateJump.cpp:112,454`:
`usedGravity = (isBall || isFlying() || isSpider ? 0.9582 : m_gravity)`,而施加重力那一行还要再乘一个
`float_b` —— 球那一档正是 `0.9582 × 0.6 ≈ 0.575`。两版源码在这一条上**其实一致**:
球的重力是 0.6 档。我们现在的 `ballGravityMul = 0.6` 不用动。

## A.4 已按源码修掉的三条(见 git 9674dd6)

| 项 | 出处 | 改法 |
|---|---|---|
| 翻重力 ×1.75 | gdp211 `flipGravity.cpp:2,19` | 蓝板 12.8→**22.4**、蓝环 8.94→**15.65**(球/蜘蛛再 ×0.7 → 10.96) |
| 重力门不清零速度 | `checkCollisions.cpp:194,204` + `flipGravity.cpp:49` | 方向真变了才 `vy *= 1.75` 且 `onGround = false` |
| 球/蜘蛛普通跳环 ×0.7 | gdp211 `ringJump.cpp:127-130`、OpenGD `playerobject.cpp:522-526` | 黑(冲刺)环不吃这 7 折 |

改完重搜:106.8 秒通关(改前 60.8 秒),输入卷仍 21187 帧,指纹 `cda117a3 → cb300414`;
`verify-run` 6/6、`gd-demo-check` 9/9、`sim.test` 38/38、`diag-bot` 0 死亡。

## A.5 依然成立、还没动的

- `spiderReach()=[60,90,120,135,120]` 确实是把 `checkSnapJumpToObject` 的**方块台阶吸附表**
  (littleStair/downStair/bigStair = 90/120/135/150/180/225 单位)当成了蜘蛛可达距离 ——
  但 `spiderTestJump` 的实现体在 gdp(22 个文件)与 OpenGD 里都**不存在**,拿不到真值,
  只能先标注来源存疑,不要瞎改(改了没有依据)。
- `m_jumpBuffered`:gdp master 里它是"按下时置位、落地/碰撞时消费并清零"的缓冲跳,
  我们的 `pressFresh`(上升沿 + 被一次起跳/跳环消费)语义接近,但 GD 会在碰撞处清掉它,
  我们不会 —— 差别是"我们略宽容一点",等有空按 `collidedWithObjectInternal` 的 8 处清零逐条对齐。
- `checkSnapJumpToObject`(方块落到新方块时的**横向吸附**,±1~2 单位)整条没实现 ——
  机制读懂了(`PlayerObject_checkSnapJumpToObject.cpp`),但影响只有 1~2 单位(0.03~0.07 格),
  排在其它项后面。
