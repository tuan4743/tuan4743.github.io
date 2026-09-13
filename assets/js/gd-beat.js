/* ============================================================
   采音:把一首歌变成"节拍"和"网格"
   ─────────────────────────────────────────────────────────────
   算法照搬 GDForge(github.com/hannesgook/gdforge, MIT)的 README 与实现思路:
     · 分帧:hop 256 采样,512 点 Hann 窗(50% 重叠)
     · 包络:二选一 —— RMS 能量 / onset strength(半波整流的谱通量)
     · 峰值:滑动窗口里的【动态百分位阈值】(默认 75)+ 最小间隔(默认 90ms)
     · 再拟合一条等比网格(自相关找周期 + 网格搜索找相位),
       铺面编辑器就吸附在这条网格上
   为什么要浏览器里做:decodeAudioData 是现成的解码器,不用给仓库塞 ffmpeg/librosa;
   同一份代码既给验收脚本用,也给 ?chart 编辑器里的"重新采音"按钮用。
   用法:
     GDBeat.decode(url)            -> AudioBuffer
     GDBeat.analyze(buffer, opts)  -> { beats, grid, bpm, env, sr, hop, ... }
   ============================================================ */
(function () {
  "use strict";

  var DEFAULTS = {
    sr: 44100,          /* 解码目标采样率(和 GDForge 一样按固定采样率分析)*/
    hop: 256,           /* 帧移(GDForge 默认 256)*/
    win: 512,           /* 窗长(50% 重叠)*/
    mode: "onset",      /* "onset"(打击感强的曲子) | "rms" */
    percentile: 75,     /* 动态百分位阈值 */
    minSep: 0.09,       /* 最小峰间隔(秒) */
    winSec: 1.6,        /* 百分位统计的滑动窗口半径(秒)*/
    bpmLo: 70, bpmHi: 200,
    div: 2              /* 网格细分:一拍切几份。这首曲子的 onset 就是 8 分音符 → 默认切 2 份 */
  };

  function mix(buf) {
    var n = buf.length, ch = buf.numberOfChannels, out = new Float32Array(n), c, d, i;
    for (c = 0; c < ch; c++) {
      d = buf.getChannelData(c);
      for (i = 0; i < n; i++) out[i] += d[i] / ch;
    }
    return out;
  }

  /* ---------- 512 点 radix-2 FFT(原地) ---------- */
  function fft(re, im) {
    var n = re.length, i, j, k, m, len, half, ang, wr, wi, tr, ti, ur, ui;
    for (i = 1, j = 0; i < n; i++) {
      m = n >> 1;
      for (; j & m; m >>= 1) j ^= m;
      j ^= m;
      if (i < j) { tr = re[i]; re[i] = re[j]; re[j] = tr; ti = im[i]; im[i] = im[j]; im[j] = ti; }
    }
    for (len = 2; len <= n; len <<= 1) {
      half = len >> 1;
      ang = -2 * Math.PI / len;
      wr = Math.cos(ang); wi = Math.sin(ang);
      for (i = 0; i < n; i += len) {
        var cr = 1, ci = 0;
        for (k = 0; k < half; k++) {
          ur = re[i + k]; ui = im[i + k];
          tr = re[i + k + half] * cr - im[i + k + half] * ci;
          ti = re[i + k + half] * ci + im[i + k + half] * cr;
          re[i + k] = ur + tr; im[i + k] = ui + ti;
          re[i + k + half] = ur - tr; im[i + k + half] = ui - ti;
          var ncr = cr * wr - ci * wi;
          ci = cr * wi + ci * wr; cr = ncr;
        }
      }
    }
  }

  /* ---------- 包络 ---------- */
  function envelope(x, o) {
    var hop = o.hop, win = o.win, n = x.length;
    var frames = Math.max(1, Math.floor((n - win) / hop) + 1);
    var env = new Float32Array(frames);
    var hann = new Float32Array(win), i;
    for (i = 0; i < win; i++) hann[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (win - 1));
    if (o.mode === "rms") {
      for (var f = 0; f < frames; f++) {
        var base = f * hop, s = 0;
        for (var j = 0; j < win; j++) { var v = x[base + j] || 0; s += v * v; }
        env[f] = Math.sqrt(s / win);
      }
      return env;
    }
    /* onset strength:半波整流的谱通量 */
    var re = new Float32Array(win), im = new Float32Array(win);
    var prev = new Float32Array(win >> 1);
    var mag = new Float32Array(win >> 1);
    for (var g = 0; g < frames; g++) {
      var b = g * hop;
      for (i = 0; i < win; i++) { re[i] = (x[b + i] || 0) * hann[i]; im[i] = 0; }
      fft(re, im);
      var flux = 0;
      for (i = 0; i < (win >> 1); i++) {
        mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
        var d = mag[i] - prev[i];
        if (d > 0) flux += d;
        prev[i] = mag[i];
      }
      env[g] = flux / (win >> 1);
    }
    return env;
  }

  function percentile(sorted, p) {
    if (!sorted.length) return 0;
    var idx = (sorted.length - 1) * p / 100, lo = Math.floor(idx), hi = Math.ceil(idx);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  }
  /* 局部滑窗里排序取百分位:窗口小(几秒),直接排序就够快 */
  function movingPercentile(env, halfWin, p) {
    var n = env.length, out = new Float32Array(n), buf = new Float32Array(halfWin * 2 + 1);
    for (var i = 0; i < n; i++) {
      var a = Math.max(0, i - halfWin), b = Math.min(n - 1, i + halfWin), k = 0;
      for (var j = a; j <= b; j++) buf[k++] = env[j];
      var sub = buf.subarray(0, k);
      Array.prototype.sort.call(sub, function (x, y) { return x - y; });
      out[i] = percentile(sub, p);
    }
    return out;
  }

  /* ---------- 峰值(动态百分位 + 最小间隔)---------- */
  function peaks(env, o) {
    var sr = o.sr, hop = o.hop;
    var halfWin = Math.max(8, Math.round(o.winSec * sr / hop / 2));
    var thr = movingPercentile(env, halfWin, o.percentile);
    var minGap = Math.max(1, Math.round(o.minSep * sr / hop));
    var maxV = 0, i;
    for (i = 0; i < env.length; i++) if (env[i] > maxV) maxV = env[i];
    var out = [], last = -1e9;
    for (i = 1; i < env.length - 1; i++) {
      if (env[i] < thr[i] || env[i] < maxV * 0.06) continue;
      if (env[i] < env[i - 1] || env[i] < env[i + 1]) continue;
      if (i - last < minGap) {
        /* 太近:留能量更大的那个(和 GDForge 的"最小间隔"一个意思)*/
        if (out.length && env[i] > env[out[out.length - 1]]) { out[out.length - 1] = i; last = i; }
        continue;
      }
      out.push(i); last = i;
    }
    return out.map(function (f) { return f * hop / sr; });
  }

  /* ---------- 网格 ----------
     自相关只能给个粗周期:实测这首曲子自相关估的是 169.44 BPM,
     用"相邻节拍间隔中位数"推出来却是 172.2 BPM —— 差 1.6%,放到 400 多拍上
     就累积成半个格子的漂移(第一版就是这么偏的)。
     所以改成三步:① 用间隔中位数定周期基准;② 在 ±3% 里细搜;
     ③ 相位用圆均值粗定 + 局部线性搜索精修,判据是"节拍到最近网格点的平均距离"。*/
  function grid(env, o, beats) {
    var sr = o.sr, hop = o.hop, fps = sr / hop, i, s, k;
    var lag, bestLag = Math.round(0.5 * fps), bestV = -1;
    for (lag = Math.round(60 / o.bpmHi * fps); lag <= Math.round(60 / o.bpmLo * fps); lag++) {
      var acc = 0, cnt = 0;
      for (i = lag; i < env.length; i += 2) { acc += env[i] * env[i - lag]; cnt++; }
      acc = cnt ? acc / cnt : 0;
      if (acc > bestV) { bestV = acc; bestLag = lag; }
    }
    var autoPeriod = bestLag / fps;
    var nb = (beats || []).length;

    var gaps = [];
    for (i = 1; i < nb; i++) gaps.push(beats[i] - beats[i - 1]);
    gaps.sort(function (a, b) { return a - b; });
    var medGap = gaps.length ? gaps[gaps.length >> 1] : autoPeriod;
    var base = medGap > 0.02 ? medGap : autoPeriod;

    var best = null;
    /* 精确倍数周期的评分(上面那段搜索用同一把尺子,才比得出"拧了到底有没有用")*/
    function evalP(P) {
      var cx = 0, cy = 0, i, a, d, m;
      for (i = 0; i < nb; i++) { a = 2 * Math.PI * beats[i] / P; cx += Math.cos(a); cy += Math.sin(a); }
      var p0 = Math.atan2(cy, cx) / (2 * Math.PI) * P;
      if (p0 < 0) p0 += P;
      var bp = p0, br = Infinity;
      for (var q = -10; q <= 10; q++) {
        var ph = p0 + q * P / 40, res = 0;
        for (i = 0; i < nb; i++) { d = beats[i] - ph; m = d - Math.round(d / P) * P; res += Math.abs(m); }
        res /= Math.max(1, nb);
        if (res < br) { br = res; bp = ph; }
      }
      return { P: P, ph: bp, res: br };
    }
    for (k = 1; k <= 4; k++) {                     /* 周期可能是 onset 间隔的 1~4 倍 */
      var P0 = base * k;
      if (P0 < 60 / o.bpmHi || P0 > 60 / o.bpmLo) continue;
      for (s = -60; s <= 60; s++) {
        var P = P0 * (1 + s * 0.0005);             /* ±3%,步长 0.05% */
        var cx = 0, cy = 0;
        for (i = 0; i < nb; i++) {
          var a = 2 * Math.PI * beats[i] / P;
          cx += Math.cos(a); cy += Math.sin(a);
        }
        var ph0 = Math.atan2(cy, cx) / (2 * Math.PI) * P;
        if (ph0 < 0) ph0 += P;
        var bph = ph0, bres = Infinity;
        for (var q = -10; q <= 10; q++) {
          var ph = ph0 + q * P / 40, res = 0, m, d;
          for (i = 0; i < nb; i++) {
            d = beats[i] - ph;
            m = d - Math.round(d / P) * P;
            res += Math.abs(m);
          }
          res /= Math.max(1, nb);
          if (res < bres) { bres = res; bph = ph; }
        }
        if (!best || bres < best.res - 1e-9) best = { P: P, ph: bph, res: bres, k: k };
      }
    }
    if (!best) best = { P: autoPeriod, ph: 0, res: 1, k: 1 };
    /* ★ 只有"拧完明显更贴"(残差降到 80% 以下)才采用微调过的周期:
       这首曲子的 onset 同时有 8 分/16 分/切分,本来就不卡刚性网格,
       硬拧只会把网格拧歪(第一版就是这么偏掉 42ms 的)*/
    var exact = evalP(base * best.k);
    var use = (best.res < exact.res * 0.8) ? best : exact;
    return {
      period: use.P,
      offset: ((use.ph % use.P) + use.P) % use.P,
      fps: fps,
      bpm: +(60 / use.P).toFixed(2),
      div: o.div,
      k: best.k,                                  /* 周期 = onset 间隔中位数的几倍 */
      medianGap: +medGap.toFixed(4),
      autoBpm: +(60 / autoPeriod).toFixed(2),     /* 自相关粗估,留作对照 */
      residual: +use.res.toFixed(4),              /* 到网格的平均偏差:大 = 没卡刚性网格,编辑器该吸附 onset */
      warped: use.P !== exact.P,
      beatCount: Math.floor((env.length / fps - use.ph) / use.P) + 1
    };
  }

  function analyze(buf, opts) {
    var o = {};
    for (var k in DEFAULTS) o[k] = DEFAULTS[k];
    for (var q in (opts || {})) if (opts[q] != null) o[q] = opts[q];
    o.sr = buf.sampleRate;
    var x = mix(buf);
    var env = envelope(x, o);
    var pk = peaks(env, o);
    var g = grid(env, o, pk);
    return {
      sr: o.sr, hop: o.hop, win: o.win, mode: o.mode,
      percentile: o.percentile, minSep: o.minSep,
      duration: +(buf.duration.toFixed(3)),
      beats: pk.map(function (t) { return +t.toFixed(4); }),
      grid: g,
      /* 收一份降采样包络,给编辑器和验收画波形用(不参与游戏)*/
      env: Array.prototype.slice.call(env, 0, env.length).filter(function (_, i) { return i % 8 === 0; }).map(function (v) { return +v.toFixed(5); }),
      envStep: o.hop * 8
    };
  }

  function decode(url, sr) {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    var ctx = new Ctx({ sampleRate: sr || DEFAULTS.sr });
    return fetch(url).then(function (r) { return r.arrayBuffer(); }).then(function (ab) {
      return new Promise(function (res, rej) {
        ctx.decodeAudioData(ab, function (b) { res({ buffer: b, ctx: ctx }); }, function (e) { rej(e || new Error("decodeAudioData failed")); });
      });
    });
  }

  window.GDBeat = {
    defaults: DEFAULTS, analyze: analyze, decode: decode,
    envelope: envelope, peaks: peaks, grid: grid, mix: mix
  };
})();
