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

