# CD 资产放置说明(你只维护这两个文件)

## 目录结构

```
static/assets/cd/
├── manifest.json          ← 接口契约(改这里,不碰前端代码)
├── drive.glb              ← Blender 导出的整机模型(光驱 + 托盘 + 5 张 CD)
└── cds/
    ├── self.webp          ← 五个主题的盘面标签贴图(圆形图案,透明背景)
    ├── growth.webp
    ├── lost.webp
    ├── tech.webp
    └── future.webp
```

## Blender 导出规范(P1)

1. **物体命名**(必须精确,前端按名查):
   - 整机:`CD_Drive`(光驱/托盘,可含空槽口)
   - 五张盘:`CD_Self` / `CD_Growth` / `CD_Lost` / `CD_Tech` / `CD_Future`
   - (P2 才需要动画名:`A_Eject`(托盘弹出) `A_Insert`(CD 滑入) `A_Pin`(插拔抓取))
2. **导出设置**:glTF 2.0,默认 Y-up;**不用 Draco、不用 KTX2**(P1 阶段);纹理嵌内 PNG/JPG 即可;勾选 `Apply Modifiers`
3. **盘面标签材质**:每张 CD 留一个 `Label` 材质槽——manifest 里的 `tex` 会替换它的贴图
4. **单位**:米级(CD 直径约 0.12m),如果比例特殊,告诉我实际尺寸,我调相机
5. **hub 字段**:`manifest.json` 的 `"hub": [x, y, z]` = 插入点(旋转轴心)在模型空间的坐标——从 Blender 里读物体原点填进去;`"cdOrbitRadius"` = CD 绕 hub 的轨道半径(米)

## 改法速查

| 想改什么 | 改哪 |
|---|---|
| 换模型 | 覆盖 `drive.glb` |
| 换主题盘面 | 覆盖 `cds/*.webp` |
| 换灯光 | 改 `manifest.json` → `light`(位置/强度/色温) |
| 换盘面大小/轨道 | 改 `hub` 和 `cdOrbitRadius` |
| 加插拔动画 | 模型加动画并在 manifest 填动画名 |

改完刷新即可,前端代码一行不用动。
