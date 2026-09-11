# 音乐文件放这里

把 5 首歌按 **CD 的 key** 命名,放进这个目录(和贴图 `cds/<key>.webp` 同一套 key):

```
static/assets/cd/music/
├── self.mp3      ← 自我  emomomo / RAS
├── growth.mp3    ← 成长  S.A.T.E.L.L.I.T.E / かめりあ
├── lost.mp3      ← 迷茫  WATER / A-39/初音未来
├── tech.mp3      ← 技术  無人区 -Vacuum Track#ADD8E6 / NoKANY
└── future.mp3    ← 未来  The lost aria / Plum
```

- 格式:**mp3**(兼容性最好);128–192 kbps 足够,5 首加起来 ~15MB 正合适
- 时长:整首(2–4 分钟)或一段可循环的片段都行
- 访问路径:`/assets/cd/music/self.mp3` …(前端按需加载,**不会**在首屏下载)
- 文件缺失不会报错:那一张盘就是纯静音,其余功能照常

## 前端会怎么用(待实现,先把契约定下来)

| 时机 | 行为 |
|---|---|
| 滚轮/↑↓ 选中某张盘(停稳 ~0.2s)| 从 `previewStart` 秒开始播**预览**,音量很小,淡入;换选时交叉淡出 |
| 点盘 → 插进光驱 → 回到主界面 | 同一首转为**背景音乐**,循环播放 |
| 重新打开 CD 架 | 背景音乐让位给新选中盘的预览 |
| 顶栏喇叭按钮 | 音乐和光驱音效一起静音 |

可调项写在 `../manifest.json` 的 `music` 段(和 `audio` 段并列),计划这样:

```json
"music": {
  "enabled": true,
  "previewVolume": 0.14,      // 预览音量(很小)
  "bgmVolume": 0.30,          // 背景音乐音量
  "previewMs": 12000,         // 预览播多久(0 = 一直播到换选/关架子)
  "fadeMs": 700,              // 淡入淡出
  "bgmRestartOnInsert": true, // 插入后背景音乐是否从头开始(false = 接着预览的位置继续)
  "start": {                  // 每首的"预览起点"(秒):想从副歌开始就填副歌时间
    "self": 0, "growth": 0, "lost": 0, "tech": 0, "future": 0
  }
}
```

`start` 是唯一需要你按歌填的东西(不然预览会从 0 秒的安静前奏开始)。
你不填也行,默认 0;回头想改随时改 manifest,刷新即生效。
