/* ============================================================
   光驱音效 v1.0 —— 纯 Web Audio 合成(零音频文件 / 零第三方依赖)
   参数全部来自 manifest.json 的 audio 段(改配置即可调音,无需改代码)

   五个音色:
     eject  光驱弹出:解锁 → 马达推出 → 撞到限位(带回弹)→ 落定
     insert 收回:机构咬合 → 马达收回(减速)
     snap   末尾那一下急插的马达短促声
     clack  锁扣"咔哒":撞击瞬态 + 硬塑料共振 + 机身闷响
     disc   CD 落入盘托:下落气流 → 轻碰 → 吸到主轴

   ⚠ 浏览器自动播放策略:首次访问、用户还没点过任何东西时
     AudioContext 处于 suspended,此时的音效会被静默跳过(不报错)。
     任何一次点击/按键后自动解锁,后续音效正常。

   公开:initCdAudio(cfg) → { play, setEnabled, isEnabled, setVolume, render, unlock }
   ============================================================ */

const PREFS_KEY = "cd-audio";        /* localStorage:"on" / "off"(静音状态)*/
const VOL_KEY = "cd-audio-vol";      /* localStorage:主音量 0..1 */

const DEFAULTS = {
  enabled: true,
  master: 0.5,      /* 总线音量(整体大小)*/
  eject: 1,         /* 以下为各音效的独立音量倍数 */
  insert: 1,
  snap: 0.9,
  clack: 1,
  disc: 0.75
};

let cfg = Object.assign({}, DEFAULTS);
let ctx = null;
let bus = null;
let on = true;                      /* 用户开关(静音)*/let master = 0.5;                   /* 主音量 0..1(滑动条控制)*/
let bound = false;
let gestured = false;               /* 用户已经点过(自动播放策略已解锁)*/

const dbg = { plays: 0, lastCue: null, log: [], ctxState: "none", unlocked: false, enabled: true, skipped: 0, deferred: 0 };
if (typeof window !== "undefined") window.__cdAudioDebug = dbg;

/* ---------- 基础设施 ---------- */

/* 白噪声缓冲(1 秒,按 AudioContext 缓存;离线渲染用的是另一个 ctx,会各自生成)*/
const noiseCache = new WeakMap();
function noiseBuffer(c) {
  let b = noiseCache.get(c);
  if (!b) {
    const n = Math.floor(c.sampleRate * 1.0);
    b = c.createBuffer(1, n, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(c, b);
  }
  return b;
}

const ms2s = (v, dflt) => (v != null ? v : dflt) / 1000;

/* ---------- 音色零件 ---------- */

/* 噪声脉冲:咔哒 / 摩擦 / 撞击 / 气流 的通用零件
   freq→to 做扫频;gain 是峰值;atk 是起振时间(越小越"脆")*/
function hit(c, out, t0, o) {
  const dur = o.dur;
  const s = c.createBufferSource();
  s.buffer = noiseBuffer(c);
  s.loop = true;
  const f = c.createBiquadFilter();
  f.type = o.type || "bandpass";
  f.frequency.setValueAtTime(o.freq, t0);
  f.Q.setValueAtTime(o.q != null ? o.q : 0.9, t0);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
  const g = c.createGain();
  const atk = o.atk != null ? o.atk : 0.0015;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.gain, t0 + Math.min(atk, dur * 0.6));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f);
  f.connect(g);
  g.connect(out);
  s.start(t0);
  s.stop(t0 + dur + 0.03);
}

/* 低频体感:撞击的重量(机身/盘托)*/
function thud(c, out, t0, o) {
  const dur = o.dur || 0.09;
  const os = c.createOscillator();
  os.type = o.type || "sine";
  os.frequency.setValueAtTime(o.f0, t0);
  os.frequency.exponentialRampToValueAtTime(o.f1, t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.gain, t0 + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  os.connect(g);
  g.connect(out);
  os.start(t0);
  os.stop(t0 + dur + 0.02);
}

/* 硬塑料共振:几个快速衰减的分音(把"啪"变成"塑料壳的啪")*/
function reso(c, out, t0, parts) {
  parts.forEach((p) => {
    const f = p[0];
    const dur = p[1];
    const gain = p[2];
    const os = c.createOscillator();
    os.type = "sine";
    os.frequency.value = f;
    os.detune.value = (Math.random() - 0.5) * 45;   /* 每次略微失谐,避免电子味 */
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.0012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    os.connect(g);
    g.connect(out);
    os.start(t0);
    os.stop(t0 + dur + 0.02);
  });
}

/* 马达:锯齿(转子的低频)+ 带通噪声(齿轮摩擦)+ 抖动 LFO(齿轮感)
   f0→f1→f2 三段转速,模拟启动 / 匀速 / 减速停下 */
function motor(c, out, t0, dur, o) {
  const g = c.createGain();
  const peak = o.gain;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.05, dur * 0.18));
  g.gain.setValueAtTime(peak, t0 + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  /* 齿轮抖动 */
  const trem = o.trem || 26;
  const lfo = c.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = trem;
  const lfoG = c.createGain();
  lfoG.gain.value = peak * (o.tremDepth != null ? o.tremDepth : 0.28);
  lfo.connect(lfoG);
  lfoG.connect(g.gain);
  lfo.start(t0);
  lfo.stop(t0 + dur);

  /* 转子 */
  const os = c.createOscillator();
  os.type = "sawtooth";
  os.frequency.setValueAtTime(o.f0, t0);
  os.frequency.linearRampToValueAtTime(o.f1, t0 + dur * 0.3);
  os.frequency.linearRampToValueAtTime(o.f2, t0 + dur);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(o.lp || 430, t0);
  lp.Q.setValueAtTime(0.9, t0);
  os.connect(lp);
  lp.connect(g);

  /* 齿轮摩擦噪声 */
  const s = c.createBufferSource();
  s.buffer = noiseBuffer(c);
  s.loop = true;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(o.nf, t0);
  bp.frequency.linearRampToValueAtTime(o.nf * 0.78, t0 + dur);
  bp.Q.setValueAtTime(0.7, t0);
  const ng = c.createGain();
  ng.gain.value = 0.9;
  s.connect(bp);
  bp.connect(ng);
  ng.connect(g);

  g.connect(out);
  os.start(t0);
  os.stop(t0 + dur + 0.02);
  s.start(t0);
  s.stop(t0 + dur + 0.02);
}

/* ---------- 音效 ---------- */

const CUES = {
  /* 光驱弹出:解锁 → 马达推出 → 撞到限位 → 回弹落定
     撞限位的时刻 = easeOutBack 的过冲峰值(61%),之后回弹到 D 处停稳 */
  eject(c, out, o, t0) {
    const D = ms2s(o.ms, 620);
    const stop = t0 + D * 0.61;
    hit(c, out, t0, { dur: 0.012, gain: 0.1, type: "highpass", freq: 2600, atk: 0.0008 });
    thud(c, out, t0 + 0.004, { f0: 220, f1: 95, dur: 0.05, gain: 0.07 });
    motor(c, out, t0 + 0.015, D * 0.8, { f0: 34, f1: 44, f2: 41, gain: 0.085, nf: 235, lp: 460, trem: 24 });
    /* 撞到限位(过冲峰值) */
    hit(c, out, stop, { dur: 0.045, gain: 0.15, freq: 1100, to: 420, q: 0.8, atk: 0.0008 });
    thud(c, out, stop, { f0: 170, f1: 62, dur: 0.12, gain: 0.19 });
    reso(c, out, stop, [[2400, 0.022, 0.06], [1500, 0.032, 0.05], [980, 0.045, 0.04]]);
    /* 回弹落定 */
    hit(c, out, t0 + D, { dur: 0.018, gain: 0.05, type: "highpass", freq: 1900 });
  },

  /* 收回:机构咬合 → 马达收回(D 内减速停住)*/
  insert(c, out, o, t0) {
    const D = ms2s(o.ms, 620);
    hit(c, out, t0, { dur: 0.018, gain: 0.09, freq: 1500, to: 700, q: 1.1 });
    thud(c, out, t0 + 0.002, { f0: 190, f1: 80, dur: 0.06, gain: 0.1 });
    motor(c, out, t0 + 0.012, D, { f0: 30, f1: 43, f2: 24, gain: 0.08, nf: 265, lp: 400, trem: 27 });
  },

  /* 末尾急插:马达短促一顶(紧接在停顿之后)*/
  snap(c, out, o, t0) {
    const D = ms2s(o.ms, 55);
    motor(c, out, t0, D + 0.02, { f0: 52, f1: 46, f2: 28, gain: 0.075, nf: 300, lp: 520, trem: 30 });
  },

  /* 锁扣"咔哒"—— 主角:瞬态 + 硬塑料共振 + 机身闷响 + 机箱余韵 */
  clack(c, out, o, t0) {
    hit(c, out, t0, { dur: 0.013, gain: 0.3, type: "highpass", freq: 2100, q: 0.6, atk: 0.0006 });
    hit(c, out, t0, { dur: 0.05, gain: 0.16, freq: 2600, to: 900, q: 0.9, atk: 0.0008 });
    reso(c, out, t0, [[3100, 0.014, 0.1], [2050, 0.02, 0.09], [1240, 0.032, 0.07], [720, 0.05, 0.05]]);
    thud(c, out, t0 + 0.001, { f0: 150, f1: 72, dur: 0.085, gain: 0.17 });
    hit(c, out, t0 + 0.012, { dur: 0.09, gain: 0.035, type: "lowpass", freq: 380, q: 0.5, atk: 0.004 });
  },

  /* CD 落入盘托:lead 之后开始下落,下落 ms 后落在盘托,再 settle 后吸到主轴 */
  disc(c, out, o, t0) {
    const lead = ms2s(o.lead, 690);
    const drop = ms2s(o.ms, 720);
    const settle = ms2s(o.settle, 180);
    const land = t0 + lead + drop;
    hit(c, out, t0 + lead, { dur: drop * 0.9, gain: 0.05, freq: 900, to: 320, q: 0.7, atk: drop * 0.35 });
    hit(c, out, land, { dur: 0.03, gain: 0.1, freq: 1800, to: 700, q: 0.9, atk: 0.001 });
    thud(c, out, land + 0.002, { f0: 210, f1: 110, dur: 0.06, gain: 0.09 });
    hit(c, out, land + settle, { dur: 0.012, gain: 0.05, type: "highpass", freq: 2400, atk: 0.0008 });
  }
};

/* ---------- 引擎 ---------- */

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  bus = ctx.createGain();
  bus.gain.value = on ? master : 0;
  bus.connect(ctx.destination);
  dbg.ctxState = ctx.state;
  return ctx;
}

function applyGain() {
  if (!ctx || !bus) return;
  const v = on ? master : 0;
  try { bus.gain.setTargetAtTime(v, ctx.currentTime, 0.012); } catch (e) { bus.gain.value = v; }
}

/* 首次用户手势时解锁(浏览器自动播放策略)*/
function waitRunning(c, timeoutMs) {
  const t0 = performance.now();
  return new Promise(function (resolve) {
    (function tick() {
      if (c.state === "running") resolve(true);
      else if (performance.now() - t0 > timeoutMs) resolve(false);
      else setTimeout(tick, 20);
    })();
  });
}

function armUnlock() {
  const go = () => {
    gestured = true;
    const c = ensureCtx();
    if (!c) return;
    if (c.state === "suspended") c.resume().catch(() => {});
    waitRunning(c, 2000).then((run) => {
      dbg.ctxState = c.state;
      dbg.unlocked = run;
    });
  };
  window.addEventListener("pointerdown", go, true);
  window.addEventListener("keydown", go, true);
  window.addEventListener("touchend", go, true);
}

function syncButton() {
  const btn = document.getElementById("sound-toggle");
  if (!btn) return;
  btn.classList.toggle("is-muted", !on);
  btn.setAttribute("aria-pressed", on ? "false" : "true");
  const label = on ? "静音" : "取消静音";
  btn.title = label;
  btn.setAttribute("aria-label", label);
  const range = document.getElementById("volume-range");
  const out = document.getElementById("volume-value");
  if (range) range.value = String(Math.round(master * 100));
  if (out) out.textContent = Math.round(master * 100) + "%";
}

/* 音量滑动条:直接改总线增益(音效 + 音乐一起),存 localStorage */
function bindVolume() {
  const range = document.getElementById("volume-range");
  if (!range || range.dataset.bound) return;
  range.dataset.bound = "1";
  range.addEventListener("input", () => {
    const v = Math.max(0, Math.min(1, (+range.value || 0) / 100));
    master = v;
    try { localStorage.setItem(VOL_KEY, String(v)); } catch (e) {}
    if (v > 0 && !on) { on = true; try { localStorage.setItem(PREFS_KEY, "on"); } catch (e) {} }
    if (v === 0 && on) { on = false; try { localStorage.setItem(PREFS_KEY, "off"); } catch (e) {} }
    applyGain();
    syncButton();
  });
}

function bindButton() {
  const btn = document.getElementById("sound-toggle");
  if (!btn || bound) return;
  bound = true;
  btn.addEventListener("click", () => setEnabled(!on));
  bindVolume();
  syncButton();
}

function setEnabled(v) {
  on = !!v;
  try { localStorage.setItem(PREFS_KEY, on ? "on" : "off"); } catch (e) {}
  if (on && master <= 0) { master = cfg.master || 0.5; }   /* 之前滑到 0 了,取消静音时给回默认音量 */
  dbg.enabled = on;
  applyGain();
  syncButton();
  if (on) unlock();          /* 重新打开时立刻可用 */
  return on;
}

function unlock() {
  const c = ensureCtx();
  if (!c) return null;
  if (c.state === "suspended") c.resume().catch(() => {});
  dbg.ctxState = c.state;
  return c;
}

/* 真正排程(此时 ctx 必须在跑)*/
function emit(name, o) {
  const c = ctx;
  const cue = CUES[name];
  if (!c || !cue || !on || !cfg.enabled || c.state !== "running") return null;
  const t0 = c.currentTime + 0.015 + ms2s(o.delayMs, 0);
  const vol = (cfg[name] != null ? cfg[name] : 1);
  const out = c.createGain();
  out.gain.value = vol * (0.94 + Math.random() * 0.12);   /* 每次略有差异,避免机械重复 */
  out.connect(bus);
  cue(c, out, o, t0);
  dbg.ctxState = c.state;
  dbg.plays++;
  dbg.lastCue = name;
  dbg.log.push({
    cue: name,
    at: Math.round(performance.now()),
    delayMs: o.delayMs || 0,
    shift: o.shift != null ? o.shift : null      /* 调用方(cd3d)传入的"触发瞬间托盘位置"*/
  });
  if (dbg.log.length > 24) dbg.log.shift();
  return { cue: name, t0: t0, gain: vol };
}

/* 播放:o.ms / o.lead / o.settle 由调用方(cd3d)按 manifest 时序传入
   o.delayMs 用于"排在未来某个动作点"(例:停顿之后才发生的急插)*/
function play(name, o) {
  o = o || {};
  if (!on || !cfg.enabled) return null;
  const c = ensureCtx();
  if (!c) return null;
  if (c.state !== "running") {
    if (!gestured) {
      /* 用户还没点过任何东西(冷启动的自动弹出):静默跳过,不报错 */
      dbg.skipped++;
      dbg.ctxState = c.state;
      return null;
    }
    /* 手势已发生、但音频线程还没起来(例:关架子的那一次点击):
       等它起来再放 —— 相对时序由 ctx.currentTime 保证不会乱;超过 700ms 就放弃,避免严重不同步 */
    dbg.deferred++;
    c.resume().catch(() => {});
    waitRunning(c, 700).then((run) => {
      dbg.ctxState = ctx ? ctx.state : "none";
      if (run) emit(name, o);
      else dbg.skipped++;
    });
    return null;
  }
  return emit(name, o);
}

/* 离线渲染(供自动化验证:不需要耳朵也能看包络)*/
async function render(name, o) {
  o = o || {};
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OAC || !CUES[name]) return null;
  const sr = 48000;
  const dur = o.dur || 2.4;
  const c = new OAC(1, Math.ceil(sr * dur), sr);
  const out = c.createGain();
  out.gain.value = 1;
  out.connect(c.destination);
  CUES[name](c, out, o, 0.02);
  const buf = await c.startRendering();
  const d = buf.getChannelData(0);
  const hop = Math.floor(sr * 0.005);        /* 5ms 一格的峰值包络 */
  const env = [];
  let peak = 0;
  let sum = 0;
  for (let i = 0; i < d.length; i += hop) {
    let p = 0;
    for (let j = i; j < Math.min(i + hop, d.length); j++) {
      const a = Math.abs(d[j]);
      if (a > p) p = a;
      sum += d[j] * d[j];
    }
    env.push(+p.toFixed(4));
    if (p > peak) peak = p;
  }
  const rms = Math.sqrt(sum / d.length);
  const th = peak * 0.06;                    /* 能量门限:峰值 6% */
  let first = -1;
  let last = -1;
  env.forEach((v, i) => {
    if (v >= th) { if (first < 0) first = i; last = i; }
  });
  return {
    cue: name,
    sr: sr,
    peak: +peak.toFixed(4),
    rms: +rms.toFixed(5),
    env: env,
    hopMs: 5,
    firstMs: first < 0 ? -1 : first * 5,
    lastMs: last < 0 ? -1 : last * 5
  };
}

/* ---------- 音乐:预览 / 背景音乐 + 频谱(供可视化)----------
   信号链:source → 每首自己的 gain → musicGain → analyser → bus(静音按钮)-> 输出
   分析器放在 bus 之前,所以静音后画面照样跟着频谱跳(只是没声音)*/

const MUSIC_BASE = "/assets/cd/music/";
const MUSIC_DEFAULTS = {
  enabled: true,
  previewVolume: 0.14,     /* 预览音量(很小)*/
  bgmVolume: 0.25,         /* 背景音乐音量 */
  fadeMs: 400,             /* 淡入淡出(切换的手感)*/
  cutMs: 150,              /* 换盘时"立刻停掉旧的"用多快淡出 */
  previewMs: 0,            /* 预览播多久后自动淡出(0 = 一直播到换选/关架子)*/
  bgmRestartOnInsert: false, /* 插入后背景音乐是否从头开始(false = 接着预览继续)*/
  prefetch: true,          /* 后台预取其余几首的字节(只进 HTTP 缓存,切换时省掉下载)*/
  prefetchDecode: 1,       /* 后台预解码"下一首"(1 = 下一首;0 = 关;内存里仍只留 maxDecoded 首)*/
  maxDecoded: 2,           /* 同时缓存的解码结果数量(每个解码后几十 MB,别调大)*/
  start: {}                /* 每首的起始秒数:{ "self": 42, ... } */
};

let musicCfg = Object.assign({}, MUSIC_DEFAULTS);
let musicGain = null;
let analyser = null;
let freqData = null;
let cur = null;              /* 当前正在播的 { key, src, gain, mode } */
let bgmKey = null;           /* 光驱里那张盘 = 主界面该放的音乐 */
const decoded = new Map();   /* key → AudioBuffer(按 maxDecoded 限量)*/
const loading = new Map();   /* key → Promise */
let musicTimer = null;
let musicGen = 0;      /* 代际:插入/停止会让"还没解码完的预览"作废,避免它盖掉背景音乐 */
let bgmPending = null; /* 正在解码等待起播的 BGM key:并发调用 toBgm 时去重,免得同一首叠两条 */

const BANDS = 64;              /* 频带数:够音频条一根一根各跳各的 */
const lv = {
  level: 0, bass: 0, mid: 0, treble: 0,
  bands: new Float32Array(BANDS),
  playing: false, mode: null, key: null
};
const mdbg = { key: null, mode: null, loading: false, error: null, starts: 0, stops: 0, gen: 0, actions: [], preDecoded: [] };
if (typeof window !== "undefined") window.__cdMusicDebug = mdbg;

function ensureMusicNodes() {
  const c = ensureCtx();
  if (!c) return false;
  if (!musicGain) {
    musicGain = c.createGain();
    musicGain.gain.value = 1;
    analyser = c.createAnalyser();
    analyser.fftSize = 2048;              /* 1024 个频点,分 64 段才够细 */
    analyser.smoothingTimeConstant = 0.65; /* 跳得干脆一点,不然条子会糊成一片 */
    musicGain.connect(analyser);
    analyser.connect(bus);
    freqData = new Uint8Array(analyser.frequencyBinCount);
  }
  return true;
}

/* 解码:用 32kHz 的 OfflineAudioContext 解,内存约为 48kHz 的 2/3 */
const decodedOrder = [];      /* LRU:最近用过的排后面 */
function touchDecoded(key) {
  const i = decodedOrder.indexOf(key);
  if (i >= 0) decodedOrder.splice(i, 1);
  decodedOrder.push(key);
}
function evictDecoded(keep) {
  const max = Math.max(1, musicCfg.maxDecoded);
  while (decodedOrder.length > max) {
    const victim = decodedOrder.find((k) => k !== keep && !(cur && cur.key === k));
    if (victim == null) break;
    decodedOrder.splice(decodedOrder.indexOf(victim), 1);
    decoded.delete(victim);
  }
}

function loadMusic(key) {
  if (decoded.has(key)) { touchDecoded(key); return Promise.resolve(decoded.get(key)); }
  if (loading.has(key)) return loading.get(key);
  const p = fetch(MUSIC_BASE + key + ".mp3")
    .then((r) => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.arrayBuffer();
    })
    .then((buf) => {
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const dc = new OAC(1, 1, 32000);
      return dc.decodeAudioData(buf);
    })
    .then((audioBuf) => {
      decoded.set(key, audioBuf);
      touchDecoded(key);
      evictDecoded(key);
      loading.delete(key);
      mdbg.error = null;
      return audioBuf;
    })
    .catch((e) => {
      loading.delete(key);
      mdbg.error = key + ": " + (e && e.message);
      console.warn("[cd-audio] 音乐加载失败 " + key + ":" + (e && e.message));
      return null;
    });
  loading.set(key, p);
  return p;
}

/* 后台预取其余几首的"字节"(只进浏览器 HTTP 缓存,不解码、不占内存):
   这样切换时只剩解码这一件事,不用再等下载 */
let prefetched = false;
function prefetchOthers(exceptKey) {
  if (prefetched || !musicCfg.prefetch) return;
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn && (conn.saveData || /(^|-)2g|3g/.test(conn.effectiveType || ""))) return;   /* 省流/慢网就别预取 */
  prefetched = true;
  const keys = Object.keys(musicCfg.start || {});
  const list = keys.filter((k) => k !== exceptKey);
  let i = 0;
  const next = () => {
    if (i >= list.length) return;
    const k = list[i++];
    fetch(MUSIC_BASE + k + ".mp3", { cache: "force-cache" })
      .then((r) => r.arrayBuffer())
      .catch(() => {})
      .then(() => { setTimeout(next, 400); });
  };
  setTimeout(next, 1500);
}

function fadeOutNode(node, ms) {
  const c = ctx;
  if (!node || !c) return;
  const t = c.currentTime;
  const k = Math.max(0.03, ms / 1000);
  try {
    node.gain.cancelScheduledValues(t);
    node.gain.setValueAtTime(Math.max(0.0001, node.gain.value), t);
    node.gain.exponentialRampToValueAtTime(0.0001, t + k);
  } catch (e) {}
  try { node.src.stop(t + k + 0.06); } catch (e) {}
}

function startSource(key, o) {
  const c = ensureCtx();
  if (!c || !ensureMusicNodes()) return null;
  const buf = decoded.get(key);
  if (!buf) return null;
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = !!o.loop;
  const g = c.createGain();
  g.gain.value = 0.0001;
  src.connect(g);
  g.connect(musicGain);
  const t = c.currentTime + 0.03;
  const vol = Math.max(0.0005, o.vol);
  const fade = Math.max(0.05, (o.fade != null ? o.fade : musicCfg.fadeMs) / 1000);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + fade);
  const off = Math.min(Math.max(0, o.offset || 0), Math.max(0, buf.duration - 1));
  src.start(t, off);
  mdbg.starts++;
  mdbg.actions.push({ a: "start", key: key, mode: o.mode || (o.loop ? "bgm" : "preview"), at: Math.round(performance.now()) });
  /* mode 必须显式给:预览和背景音乐都是循环播放,不能靠 loop 推 */
  return { key: key, src: src, gain: g, mode: o.mode || (o.loop ? "bgm" : "preview"), vol: vol };
}

function stopAll(ms) {
  if (cur) { fadeOutNode(cur, ms); mdbg.stops++; }
  cur = null;
  mdbg.mode = null;
  mdbg.key = null;
  lv.playing = false;
  lv.mode = null;
  lv.key = null;
}

function startOf(key) {
  const s = musicCfg.start || {};
  const v = s[key];
  return typeof v === "number" && v > 0 ? v : 0;
}

/* 后台预解码:当前这首播起来之后,把"下一首"也解好(内存里保持在 maxDecoded 之内)
   这样往前滚轮换盘时是"瞬切"——只剩淡入淡出,不用等下载也不用等解码 */
let preDecoded = null;
function prefetchDecode(key) {
  const n = musicCfg.prefetchDecode != null ? musicCfg.prefetchDecode : 0;
  if (!n || !musicCfg.enabled) return;
  const keys = Object.keys(musicCfg.start || {});
  const i = keys.indexOf(key);
  if (i < 0) return;
  const targets = [];
  for (let d = 1; d <= n; d++) targets.push(keys[(i + d) % keys.length]);
  setTimeout(() => {
    targets.forEach((k) => {
      if (k === key || decoded.has(k) || loading.has(k)) return;
      if (cur && cur.key !== key) return;          /* 期间已经换歌了,别乱抢 */
      loadMusic(k).then(() => { preDecoded = k; mdbg.preDecoded.push(k); evictDecoded(cur && cur.key ? cur.key : key); });
    });
  }, 800);
}

/* 选中某张盘 → 小声预览
   语义:一旦换成别的盘,先把当前这首**立刻停掉**(150ms 快速淡出,不硬切以防爆音),
   等新这首解码好了再开始播 —— 不是"两首叠着等交叉淡入淡出"。
   连续快速滚轮时只有最后停下来的那张会真正起播 */
let previewGen = 0;
function preview(key) {
  if (!musicCfg.enabled || !key) return;
  if (cur && cur.key === key) return;              /* 已经在放这首 */
  const gen = ++previewGen;
  /* 换盘:马上停掉旧的 */
  if (cur) {
    mdbg.actions.push({ a: "cut", from: cur.key, to: key, at: Math.round(performance.now()) });
    stopAll(musicCfg.cutMs != null ? musicCfg.cutMs : 150);
  }
  mdbg.loading = true;
  mdbg.actions.push({ a: "preview", key: key, gen: gen, at: Math.round(performance.now()) });
  prefetchOthers(key);
  loadMusic(key).then((buf) => {
    mdbg.loading = false;
    if (!buf || gen !== previewGen) return;        /* 期间又换选了 / 插入 / 停止 → 这次作废 */
    if (cur && cur.key === key) return;
    const old = cur;
    cur = startSource(key, { offset: startOf(key), loop: true, mode: "preview", vol: musicCfg.previewVolume });
    if (old) fadeOutNode(old, musicCfg.fadeMs);
    if (!cur) return;
    mdbg.key = key;
    mdbg.mode = "preview";
    lv.playing = true;
    lv.mode = "preview";
    lv.key = key;
    evictDecoded(key);
    prefetchDecode(key);
    if (musicTimer) clearTimeout(musicTimer);
    if (musicCfg.previewMs > 0) {
      musicTimer = setTimeout(() => {
        if (cur && cur.mode === "preview") { fadeOutNode(cur, 1200); cur = null; mdbg.mode = null; lv.playing = false; }
      }, musicCfg.previewMs);
    }
  });
}

/* 插入完成 → 这首歌升格成背景音乐 */
function toBgm(key) {
  if (!musicCfg.enabled || !key) return;
  bgmKey = key;
  musicGen++;                       /* 作废所有在途的预览请求 */
  previewGen++;                     /* 预览代际也推进:解码中的预览不能再起播盖掉背景音乐 */
  if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
  mdbg.actions.push({ a: "bgm", key: key, cur: cur && cur.key, mode: cur && cur.mode, at: Math.round(performance.now()) });
  if (cur && cur.key === key) {
    /* 接着预览继续放,只把音量提上来 */
    if (cur.mode !== "bgm") {
      cur.mode = "bgm";
      cur.src.loop = true;
      const t = ctx.currentTime;
      try {
        cur.gain.gain.cancelScheduledValues(t);
        cur.gain.gain.setValueAtTime(Math.max(0.0001, cur.gain.gain.value), t);
        cur.gain.gain.exponentialRampToValueAtTime(Math.max(0.0005, musicCfg.bgmVolume), t + musicCfg.fadeMs / 1000);
      } catch (e) {}
      mdbg.mode = "bgm";
      lv.mode = "bgm";
    }
    return;
  }
  if (bgmPending === key) return;        /* 已经有一条在等解码了,别再起 */
  bgmPending = key;
  loadMusic(key).then((buf) => {
    if (bgmPending === key) bgmPending = null;
    if (!buf) return;
    if (cur && cur.key === key) return;  /* 期间已经被别的调用起起来了 */
    const old = cur;
    cur = startSource(key, {
      offset: musicCfg.bgmRestartOnInsert ? 0 : startOf(key),
      loop: true, mode: "bgm", vol: musicCfg.bgmVolume
    });
    if (old) fadeOutNode(old, musicCfg.fadeMs);
    if (!cur) return;
    mdbg.key = key;
    mdbg.mode = "bgm";
    lv.playing = true;
    lv.mode = "bgm";
    lv.key = key;
  });
}

/* 离开 CD 页(收起架子):只结束预览 —— 【不在这里起背景音乐】
   ★ 收起架子紧接着就是开机动画,而动画期间必须一点音乐都没有;
     原来这里会把上一张盘的 BGM 立刻拉起来,于是 loading 一开播就有歌。
     背景音乐改由 intro.js 在"动画播完"那一刻起(见 setOpen 的收尾回调)。
   如果此刻放的本来就是背景音乐,那就不动它 */
function leaveCdPage() {
  if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
  mdbg.actions.push({ a: "leave", cur: cur && cur.key, mode: cur && cur.mode, at: Math.round(performance.now()) });
  if (cur && cur.mode === "bgm") return;
  musicGen++;
  previewGen++;
  stopAll(musicCfg.fadeMs);
}

/* 频谱:level/bass/mid/treble + 32 段对数频带(0..1),可视化直接用 */
function levels() {
  if (!analyser || !freqData) {
    lv.level = lv.bass = lv.mid = lv.treble = 0;
    lv.bands.fill(0);
    return lv;
  }
  analyser.getByteFrequencyData(freqData);
  const nyq = (ctx ? ctx.sampleRate : 48000) / 2;
  const per = nyq / freqData.length;
  const avg = (f0, f1) => {
    const a = Math.max(0, Math.floor(f0 / per));
    const b = Math.min(freqData.length - 1, Math.ceil(f1 / per));
    let s = 0;
    for (let i = a; i <= b; i++) s += freqData[i];
    return b >= a ? s / (b - a + 1) / 255 : 0;
  };
  const curve = (v) => Math.pow(v, 1.35);
  lv.bass = curve(avg(30, 140));
  lv.mid = curve(avg(140, 1500));
  lv.treble = curve(avg(1500, 9000));
  lv.level = Math.min(1, curve(avg(40, 9000)) * 1.25);
  /* 64 段:40Hz → 9kHz 对数分布(音频条一根对一段,每根都有独立数值)*/
  const fMin = 40, fMax = 9000;
  for (let i = 0; i < BANDS; i++) {
    const a = fMin * Math.pow(fMax / fMin, i / BANDS);
    const b = fMin * Math.pow(fMax / fMin, (i + 1) / BANDS);
    lv.bands[i] = curve(avg(a, b));
  }
  return lv;
}

/* ---------- 初始化 ---------- */

export function initCdAudio(conf) {
  cfg = Object.assign({}, DEFAULTS, conf || {});
  musicCfg = Object.assign({}, MUSIC_DEFAULTS, (conf && conf.music) || {});
  try { on = localStorage.getItem(PREFS_KEY) !== "off"; } catch (e) { on = true; }
  master = cfg.master != null ? cfg.master : 0.5;
  try {
    const sv = parseFloat(localStorage.getItem(VOL_KEY));
    if (!isNaN(sv)) master = Math.max(0, Math.min(1, sv));
  } catch (e) {}
  if (cfg.enabled === false) on = false;
  dbg.enabled = on;

  const api = {
    play: play,
    render: render,
    setEnabled: setEnabled,
    isEnabled: function () { return on; },
    setVolume: function (v) {
      master = Math.max(0, Math.min(1, +v || 0));
      applyGain();
      syncButton();
      return master;
    },
    getVolume: function () { return master; },
    unlock: unlock,
    cues: Object.keys(CUES),
    /* 音乐:选中预览 / 插入转背景音乐 / 离开 CD 页 / 频谱 */
    music: {
      preview: preview,
      toBgm: toBgm,
      leaveCdPage: leaveCdPage,
      levels: levels,
      stop: function () { musicGen++; previewGen++; stopAll(musicCfg.fadeMs); },
      setVolume: function (v) {
        musicCfg.bgmVolume = v;
        if (cur && cur.mode === "bgm" && ctx) {
          try { cur.gain.gain.setTargetAtTime(v, ctx.currentTime, 0.05); } catch (e) {}
        }
      },
      load: loadMusic,
      state: function () {
        return {
          cfg: musicCfg, key: mdbg.key, mode: mdbg.mode, bgmKey: bgmKey,
          loading: mdbg.loading, error: mdbg.error, starts: mdbg.starts, stops: mdbg.stops,
          gen: musicGen, actions: mdbg.actions.slice(-8), preDecoded: mdbg.preDecoded.slice(-6),
          decodedKeys: Array.from(decoded.keys()),
          durationSec: cur && cur.src.buffer ? +cur.src.buffer.duration.toFixed(2) : null
        };
      }
    }
  };

  if (typeof window !== "undefined") window.__cdAudio = api;   /* 调试 / 自动化验证入口 */

  if (typeof document === "undefined" || cfg.enabled === false) return api;

  /* 按钮:只在音效就绪后显示(降级路径没有音效,就不出现死按钮)*/
  document.documentElement.classList.add("has-cd-audio");
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindButton, { once: true });
  } else {
    bindButton();
  }
  armUnlock();
  if (on) ensureCtx();
  console.info("[cd-audio] 音效就绪:" + Object.keys(CUES).join(" / ") + (on ? "" : "(已静音)"));
  return api;
}
