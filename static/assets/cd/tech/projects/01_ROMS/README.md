# ROMS-CoSiNE限定环境优化

> AI辅助开发的产物,前中期指定方向优化,后期无思路AI自主迭代轮查方向
> MCC2026的决赛题目,成绩第四

## 成绩

**baseline 1:50:06（6606 s，4 节点 64 核）→ 26:11（1571 s，验证 26/26 PASS），提速 4.2×**

## 项目结构

```
ROMS-optimized/
├── docs/                               # 最终整理文档
│   ├── 00_Audit.md/                    # 什么有 / 什么缺 / 远端路径
│   ├── 01_check_report.md/             # 数字/版本/差异三方互验
│   ├── 02_delivery_guide/              # 交接 skill 包
│   └── 03_funny_case/                  # 一个有意思的错误和总结
├── final/                              # 最终版本
├── logs/                               # AI工作日志(整理版)
│   ├── 00_Introduction_and_Scope/      # 项目边界和要求
│   ├── 01_tasks/                       # 工作文档
│   ├── 02_main_logs/                   # 后期自主迭代实验跟踪文档
│   ├── 03_evidences/                   # 分析文档(给人看的)
│   └── 04_scripts/                     # 脚本(插桩,数据分析,校准以及手写特定性能抓取工具)
├── origin/                             # 原始版本
├── profile/                            # 所有留档的本地profile记录
└── README.md/                          # 本文档
```
