/* ============================================================
   第三张盘「迷茫」的主页内容:几何冲刺式音乐关卡
   ─────────────────────────────────────────────────────────────
   一句话:**他过不去的地方,就是他缺的东西。** 四段 = 四个存档点 = 四种变形:
     ST-01 复盘 · 回响方块 —— 死亡/失误在那一拍留下残影,下一轮同拍【自动补一次二段跳】
     ST-02 求助 · 飞机     —— 按住上升 / 松开下降,两边都是 45°(GD 原版那种浪)
     ST-03 呼吸 · 护盾形态 —— 点击获得 2 秒护盾,冷却 5 秒
     ST-04 继续 · 重力箭头 —— 在箭头那一拍点击,重力翻转(上下轨道互换)

   玩法骨架(几何冲刺那一套):
     · 自动向右跑,速度固定(blocks/s);【点击只做一件事】—— 跳 / 触发跳点 / 翻转重力
     · 游戏时钟 = 音频时钟(decode 好的 mp3 直接播),所以音乐与障碍天生同步;
       死亡 → 把音乐倒回【死亡那一拍前 2 拍】重来(这就是"复盘")
     · 铺面数据:static/assets/cd/lost-chart.json(秒对齐);
       节拍:static/assets/cd/lost-beats.json(GDForge 那套采音,见 gd-beat.js)
     · 铺面为空时会用 beats 自动铺一版草稿(dev.draft / ?chart 里也能重新生成)

   验收:tools/verify/lost-gd-check.mjs(定步长推演,不靠手速)
   ============================================================ */
(function () {
  "use strict";

  var CFG = {
    SPEED: 10.4,        /* 块/秒:GD 常速 311.58 units/s ÷ 30 units/块 */
    ROWS: 10,           /* 轨道行数(0 = 地面)*/
    GRAV: 200,          /* 方块重力(块/s²)*/
    JUMP: 34,           /* 起跳初速度 → 跳高 2.9 块、跳远 3.5 块。
                           原来是 30(跳远 3.12 块):跨 1 块高的障碍只有 0.046 秒容错(约 8% 拍)
                           —— 人类基本打不过、自动播放机器人也一头撞死,所以抬到 34 */
    ORB_Y: 1.12, ORB_P: 0.82,   /* 跳点力度(黄/粉)*/
    SHIELD_T: 2.0, SHIELD_CD: 5.0,
    TAP_WIN: 0.20,      /* 拍点点击窗口(秒,±)*/
    REWIND_BEATS: 2,    /* 死后倒退几拍重来 */
    DEAD_PAUSE: 0.75,   /* 死了停多久再回到那一拍 */
    LEAD: 1.6,          /* 开段/复活的准备拍(音频留一点前奏)*/
    PW: 0.9, PH: 0.9,   /* 他的碰撞盒(块)*/
    /* 物件"落点"偏移:障碍放在对应拍的后面一点,这样【踩着拍点点击】正好跳过去 */
    OFF: { block: 2.0, spike: 2.0, orb: 1.0, gravity: 0.0, shield: 1.0 },
    VIEW: 0.30          /* 他在屏幕上的横向位置 */
  };

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function prng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function fmtClock(t) {
    t = Math.max(0, t);
    var m = Math.floor(t / 60), s = t - m * 60;
    return m + ":" + (s < 10 ? "0" : "") + s.toFixed(1);
  }

  function build(root, key) {
    var cv = root.querySelector(".lost-cv");
    var ctx2d = cv ? cv.getContext("2d") : null;
    var sayEl = root.querySelector(".lost-say");
    var sayTx = root.querySelector(".lost-say-tx");
    var deathsEl = root.querySelector(".lost-deaths");
    var codeEl = root.querySelector(".lost-code");
    var clockEl = root.querySelector(".lost-clock");
    var stateEl = root.querySelector(".lost-state");
    var stateMode = root.querySelector(".lost-state-mode");
    var stateTx = root.querySelector(".lost-state-tx");
    var endEl = root.querySelector(".lost-end");
    var veil = root.querySelector(".lost-veil");
    var beatDots = Array.prototype.slice.call(root.querySelectorAll(".lost-beat i"));
    var menuAuto = root.querySelector('[data-act="auto"][data-where="menu"]');
    var deadAuto = root.querySelector('[data-act="auto"][data-where="dead"]');
    var deadAt = root.querySelector(".lost-dead__at");
    var segEls = Array.prototype.slice.call(root.querySelectorAll(".lost-skill"));

    var TXT = {
      intro: root.getAttribute("data-intro") || "他站在起点。",
      ending: root.getAttribute("data-ending") || "",
      restart: root.getAttribute("data-restart") || "按 R 再来一次",
      chart: root.getAttribute("data-chart") || "/assets/cd/lost-chart.json"
    };
    var SEGS = segEls.map(function (el) {
      return {
        ability: el.getAttribute("data-skill"), theme: el.getAttribute("data-theme") || "",
        form: el.getAttribute("data-form") || "", key: el.getAttribute("data-key") || "",
        line: el.getAttribute("data-line") || "", el: el
      };
    });

    /* ---------------- 数据 ---------------- */
    var chart = null, beats = [], beatT = [], period = 0.3483, offset = 0.0947, dur = 156, ready = false, loadErr = "";
    var items = [];                 /* 已按 x 排序:{t,row,type,w,orb,x,x2} */
    var segs = [];                  /* {t, mode, ability, i} */
    var mode = "cube", gdir = 1;    /* gdir: 1 = 重力向下,-1 = 向上 */

    /* ---------------- 玩家 / 局面 ---------------- */
    var S = null, echoes = [], attempts = 0, deaths = 0, reached = false, sayT = 0, flash = 0, hudT = 0;
    var camX = 0, deadT = 0, dead = false, respawnT = 0, echoFired = 0, orbCd = 0, cumX = [];
    var keys = { jump: 0, shield: 0 };
    var prevJump = 0, shieldT = 0, shieldCd = 0, stateT = 0, segNow = -1, tapArmed = null, tapArmedT = 0, tapMiss = 0;
    var ghostTrail = [], trail = [];

    function resetPlayer(y, g) {
      S = { x: 0, y: y == null ? 0 : y, vy: 0, onGround: true, rot: 0, air: 0 };
      gdir = g == null ? 1 : g;
      dead = false; deadT = 0; echoFired = 0; orbCd = 0; trail = []; ghostTrail = [];
      tapArmed = null; tapMiss = 0;
      /* 一次新的尝试 = 护盾也重置(不然上一次用掉的冷却会带到这一轮)*/
      shieldT = 0; shieldCd = 0;
    }

    /* ★ x 由"按段积分"得到:每段可以有自己的速度,时间轴仍严格对齐音频 */
    function xAt(t) {
      if (!segs.length) return (t - chart.lead) * CFG.SPEED;
      var k = 0;
      for (var i = 0; i < segs.length; i++) if (t >= segs[i].t) k = i;
      if (t < segs[0].t) return (t - chart.lead) * segs[0].speed;
      return cumX[k] + (t - segs[k].t) * segs[k].speed;
    }
    function t2x(t) { return xAt(t); }
    function xOf(it) { return t2x(it.t) + (CFG.OFF[it.type] || 0); }
    function nearestBeat(t) {
      if (!beatT.length) return 0;
      var lo = 0, hi = beatT.length - 1, mid;
      while (hi - lo > 1) { mid = (lo + hi) >> 1; if (beatT[mid] < t) lo = mid; else hi = mid; }
      return (t - beatT[lo] <= beatT[hi] - t) ? lo : hi;
    }
    function beatTime(i) { return beatT[clamp(i, 0, beatT.length - 1)] || 0; }
    function segAt(t) {
      var k = 0;
      /* ★ 严格按段落起点切换:原来提前 0.8 秒,结果上一段的柱子还在、形态已经换了
         → 当场撞死(整首自动播放跑出来的)。铺面在段边界本来留了 1.2 拍的空档 */
      for (var i = 0; i < segs.length; i++) if (t >= segs[i].t) k = i;
      return k;
    }
    /* 地面缺口:玩家中心落进去就不吃地板(掉下去 = 死)*/
    function inHole(cx) {
      for (var i = 0; i < items.length; i++) {
        var o = items[i];
        if (o.type !== "hole") continue;
        if (cx > o.x && cx < o.x2) return true;
      }
      return false;
    }
    function itemsNear(x0, x1) {
      var out = [];
      for (var i = 0; i < items.length; i++) { var it = items[i]; if (it.x2 >= x0 && it.x <= x1) out.push(it); }
      return out;
    }

    /* ---------------- 自动铺面(草稿)----------------
       铺面为空时用它先铺一版能玩的东西;?chart 里也能"重新生成草稿"再手改。
       规则按段:方块段踩 4 分音符放障碍、飞机段留 3 行缝、护盾段放长尖刺带、重力段换轨道 */
    function draft(ch, bs) {
      var out = [], rnd = prng(20260913), i, k, g;
      var rows = ch.rows || CFG.ROWS, P = ch.period || period;
      function push(t, row, type, w, orb) {
        if (t < ch.lead + P * 2 || t > ch.duration - 0.6) return;
        out.push({ t: +t.toFixed(4), row: row, type: type, w: w || 1, h: 1, orb: orb });
      }
      for (var si = 0; si < ch.segments.length; si++) {
        var sg = ch.segments[si];
        var end = (si + 1 < ch.segments.length) ? ch.segments[si + 1].t : ch.duration;
        /* ★ 用【均匀节拍格】而不是 onset 列表:onset 里混着 16 分与切分,
           相邻两个可能只差 0.21 秒(2.2 块)—— 一跳 3.54 块落不下来,就成了必死关。
           一拍 = period ≈ 3.62 块,各段规则再按整数拍取用 */
        var list = [];
        var step = P;
        var first = Math.ceil((sg.t + P * 1.2) / step) * step;
        for (var tt = first; tt < end - P * 1.2; tt += step) list.push(+tt.toFixed(4));
        if (sg.mode === "plane") {
          /* 上下轨道各一条,中间留 3 行缝,每 2 拍换一次缝的位置 */
          for (i = 0; i < list.length; i += 2) {
            /* 头两个用居中留缝(3~4 行):变形进场时他正好在走廊中间,不能被夹死 */
            g = (i < 4) ? 4 : (2 + Math.floor(rnd() * 5));
            for (k = 0; k < g; k++) push(list[i], k, "block", 2);
            for (k = g + 3; k < rows; k++) push(list[i], k, "block", 2);
          }
        } else if (sg.ability === "shield") {
          /* 尖刺带:宽到跳不过去,只有盾能过去。
             间隔按"盾 2s + 冷却 5s = 7 秒一轮"配:每 20 拍(≈7s)一段、宽 16 块(≈1.5s)
             —— 放太密会出现"上一段刚用完盾、冷却还没好"的死局(验收抓到的)*/
          for (i = 0; i < list.length; i += 20) push(list[i], 0, "spike", 13);   /* 13 块 ≈1.25s,给 2 秒盾留出余量 */
        } else if (sg.ability === "gravity") {
          /* 下轨道跑一段 → 拍点上翻重力 → 上轨道跑一段(障碍稀疏到能踩着跳过去)*/
          for (i = 0; i < list.length; i++) {
            if (i === 6 || i === 14) { push(list[i], 0, "gravity", 1); continue; }
            var up = (i > 6 && i <= 14);                       /* 翻过来之后他贴在天花板上 */
            if (i % 4 === 2 && i !== 6 && i !== 14) push(list[i], up ? rows - 1 : 0, "block", 1);
          }
        } else {
          /* 方块段:踩 4 分音符(隔一拍)放障碍,偶尔给个跳点 */
          for (i = 0; i < list.length; i += 2) {
            var r = rnd();
            /* ★ 方块段一律 w=1:一跳只跨 3.12 块,w=2 的方块是【跳不过去】的 ——
               用户说"全是bug"里就有这种必死关(验收里量出来的)*/
            if (r < 0.55) push(list[i], 0, "spike", 1);
            else push(list[i], 0, "block", 1);
            if (rnd() < 0.18 && i + 1 < list.length) push(list[i + 1], 2, "orb", 1, rnd() < 0.6 ? "yellow" : "pink");
          }
        }
      }
      out.sort(function (a, b) { return a.t - b.t; });
      return out;
    }

    function prepare() {
      segs = (chart.segments || []).map(function (s, i) {
        return {
          t: s.t, mode: s.mode || "cube", ability: s.ability || "", i: i,
          speed: s.speed || chart.speed || CFG.SPEED,          /* 每段可以有自己的移速 */
          check: (s.check != null ? s.check : s.t)             /* 每段的存档点(默认段起点)*/
        };
      });
      /* 累计 x 表:xAt(t) = 前面各段各自速度积分 + 本段内插 */
      cumX = [];
      for (var si2 = 0; si2 < segs.length; si2++) {
        if (si2 === 0) cumX[0] = Math.max(0, (segs[0].t - chart.lead)) * segs[0].speed;
        else cumX[si2] = cumX[si2 - 1] + (segs[si2].t - segs[si2 - 1].t) * segs[si2 - 1].speed;
      }
      items = (chart.items && chart.items.length ? chart.items : draft(chart, beats)).map(function (it) {
        var o = { t: it.t, row: it.row | 0, type: it.type, w: it.w || 1, h: it.h || 1, orb: it.orb || "yellow",
          text: it.text || "", deco: it.deco || "" };
        o.x = xOf(o);
        if (o.type === "rail") {                       /* 斜轨:两端点都是时间 */
          o.t2 = it.t2 != null ? it.t2 : o.t + 0.7;
          o.row2 = it.row2 != null ? it.row2 : o.row;
          o.x2 = t2x(o.t2);
        } else {
          o.x2 = o.x + (o.type === "orb" || o.type === "gravity" ? 1 : o.w);
        }
        if (o.x2 < o.x) { var sw = o.x; o.x = o.x2; o.x2 = sw; var sw2 = o.row, sw3 = o.row2; o.row = sw3 == null ? o.row : sw3; if (sw2 != null) o.row2 = sw2; }
        return o;
      }).sort(function (a, b) { return a.x - b.x; });
      ready = true;
      hud(true);
    }

    function load() {
      var p1 = fetch(TXT.chart).then(function (r) { return r.json(); });
      var p2 = fetch("/assets/cd/lost-beats.json").then(function (r) { return r.json(); });
      return Promise.all([p1, p2]).then(function (res) {
        chart = res[0];
        var b = res[1];
        beats = b.beats || []; beatT = beats.slice();
        period = b.period || chart.period || 0.3483;
        offset = b.offset || chart.offset || 0;
        dur = b.duration || chart.duration || 156;
        window.__lostEnv = b.env || [];
        window.__lostEnvStep = b.envStep || 0;
        CFG.SPEED = chart.speed || CFG.SPEED;
        CFG.ROWS = chart.rows || CFG.ROWS;
        chart.lead = chart.lead == null ? CFG.LEAD : chart.lead;
        chart.duration = dur; chart.period = period; chart.rows = CFG.ROWS;
        prepare();
        return true;
      }).catch(function (e) { loadErr = (e && e.message) || "加载失败"; return false; });
    }

    /* ---------------- 音频(游戏自己的那条轨:能倒带、能对齐)---------------- */
    var A = { ctx: null, buf: null, src: null, gain: null, offset: 0, startCtx: 0, on: false, err: "" };
    function audioInit() {
      if (A.ctx || A.buf || A.err) return;
      if (!window.GDBeat) { A.err = "no GDBeat"; return; }
      window.GDBeat.decode(chart.song).then(function (r) {
        A.ctx = r.ctx; A.buf = r.buffer;
        A.gain = A.ctx.createGain();
        var v = 1;
        try { if (window.__cdAudio && window.__cdAudio.getVolume) v = window.__cdAudio.getVolume(); } catch (e) {}
        A.gain.gain.value = clamp(v, 0, 1) * 0.9;
        A.gain.connect(A.ctx.destination);
        if (A.on) audioStart(S ? S.t : 0);
      }).catch(function (e) { A.err = (e && e.message) || "音频加载失败"; });
    }
    function audioStart(at) {
      if (!A.ctx || !A.buf) return;
      audioStop();
      try { A.ctx.resume(); } catch (e) {}
      A.src = A.ctx.createBufferSource();
      A.src.buffer = A.buf; A.src.connect(A.gain);
      A.offset = clamp(at, 0, Math.max(0, A.buf.duration - 0.05));
      A.startCtx = A.ctx.currentTime + 0.02;
      A.src.start(A.startCtx, A.offset);
    }
    function audioStop() { if (A.src) { try { A.src.stop(); } catch (e) {} A.src = null; } }
    function audioNow() {
      if (!A.src || !A.ctx) return null;
      var t = A.offset + (A.ctx.currentTime - A.startCtx);
      return t >= A.offset - 0.05 ? t : null;
    }

    /* ---------------- 动作 ---------------- */
    function jumpNow(power) {
      S.vy = CFG.JUMP * power * gdir;
      S.onGround = false; S.air++;
    }
    function tap() {
      if (!ready || dead || reached || S.modeIsPlane) return;
      /* 拍点上的重力箭头优先 */
      if (tapArmed && Math.abs(nowT() - tapArmed.t) <= CFG.TAP_WIN) {
        gdir = -gdir; S.vy = 0; flash = 0.6;
        say("重力翻了。", 1.2);
        tapArmed.done = true; tapArmed = null;
        return;
      }
      if (S.onGround) { jumpNow(1); return; }
      /* ★ 第一个能力:二段跳(ST-01 复盘)—— 空中再点一次就能再蹬一下 */
      if (S.air < 2) { S.air = 2; jumpNow(0.95); flash = 0.35; return; }
      /* 空中:看脚下有没有跳点 */
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it.type !== "orb" || it.done) continue;
        if (S.x + CFG.PW < it.x - 0.4 || S.x > it.x2 + 0.4) continue;
        if (S.y + CFG.PH < it.row - 0.6 || S.y > it.row + 1.6) continue;
        it.done = true;
        jumpNow(it.orb === "pink" ? CFG.ORB_P : CFG.ORB_Y);
        flash = 0.4;
        return;
      }
    }
    function shieldNow() {
      if (!ready || dead || shieldT > 0 || shieldCd > 0) return;
      shieldT = CFG.SHIELD_T;
      flash = 0.5;
    }
    function hit(w, h, x, y) {           /* 他的盒子 vs 一个矩形 */
      return S.x < x + w && S.x + CFG.PW > x && S.y < y + h && S.y + CFG.PH > y;
    }
    function die(why, item) {
      if (dead || reached) return;
      dead = true; deadT = 0; deaths++; flash = 1;
      /* ★ 回响:残影留在【撞到的那个物件所属的拍】上,下一轮同一拍自动补一次二段跳。
         必须是物件的拍、不是"死亡时刻最近的一拍":障碍放在"拍点 + 2 块"处,
         死在障碍上时最近的一拍已经过去,按它补跳会晚 2 块(点查抓到的)。*/
      var et = item && item.t != null ? item.t : beatTime(nearestBeat(nowT()));
      var bi = nearestBeat(et);
      /* ★ 只留最后一次死亡的那个位置(用户要求:残影别攒一堆)*/
      echoes = [{ beat: bi, t: et, y: S.y, x: S.x, at: attempts, ghost: ghostTrail.slice(-24) }];
      say("他在 " + (beatTime(bi)).toFixed(2) + "s 那一拍摔了。下一轮,那一拍会替他蹬一下。", 4.5);
      if (deathsEl) deathsEl.textContent = pad2(deaths);
    }
    function respawn() {
      attempts++;
      /* ★ 回到【本段存档点】(用户要求:不要回退几秒 —— 那样会一直在同一处反复死)*/
      var si = Math.max(0, segAt(S.t));
      var t = Math.max(levelStart(), segs[si].check - 0.15);   /* 允许 0 */   /* 每段自己的存档点 */
      resetPlayer(0, 1);
      if (MODE_STEP.dry) S.t = t; else { S.t = t; audioStart(t); }
      segNow = -1;
    }
    var MODE_STEP = { dry: false };

    function nowT() { return S ? S.t : 0; }

    /* ---------------- 推进 ---------------- */
    function step(dt) {
      if (!ready || ED) return;
      if (phase !== "play") return;          /* 没点开始 / 停在死亡菜单 → 什么都不推进 */
      if (reached) return;
      if (dead) {
        deadT += dt;
        /* ★ 死了不再自动复活:等玩家在死亡菜单里选(继续 / 自动播放 / 退出)*/
        if (deadT >= CFG.DEAD_PAUSE && phase === "play") {
          setPhase("dead");
          audioStop();
        }
        return;
      }
      /* 时间:真实播放时以音频时钟为准,推演时按 dt 累加 */
      if (MODE_STEP.dry) S.t += dt;
      else { var at = audioNow(); if (at != null) S.t = at; else S.t += dt; }
      var t = S.t;
      if (t >= dur - 0.4) {
        reached = true;
        if (endEl) { endEl.classList.add("is-on"); endEl.setAttribute("aria-hidden", "false"); }
        say("", 0);
        audioStop();
        return;
      }
      /* 段落 / 形态:形态每帧都从段落推(seek、推演跳时间也不会错),
         但只有【真的换了形态】才动他的运动状态 —— 否则刚起跳就被第一帧清零 */
      var si = segAt(t);
      var seg = segs[si];
      if (seg.mode !== mode) {
        mode = seg.mode; S.modeIsPlane = (mode === "plane");
        /* 变形瞬间给个安全的落点:方块 → 飞机 时直接切到走廊中间
           (从地面上起飞、又刚好没按住,第一帧就撞地死了 —— 验收抓到的);
           飞机 → 方块 时干净落地 */
        if (mode === "plane") { S.y = (CFG.ROWS - CFG.PH) / 2; S.vy = 0; S.onGround = false; }
        else { gdir = 1; S.vy = 0; S.y = 0; S.onGround = true; }
        stateT = 4;
      }
      if (si !== segNow) {
        segNow = si;
        var meta = SEGS[si] || {};
        say(meta.line || ("第 " + (si + 1) + " 段"), 6);
        segEls.forEach(function (el, i2) { el.classList.toggle("is-locked", i2 > si); el.classList.toggle("is-on", i2 === si); });
        stateT = 4;
      }
      if (auto) autoThink();                 /* 自动播放:机器人接管点击 */
      if (shieldT > 0) { shieldT -= dt; if (shieldT <= 0) { shieldT = 0; shieldCd = CFG.SHIELD_CD; } }
      else if (shieldCd > 0) shieldCd = Math.max(0, shieldCd - dt);
      if (flash > 0) flash = Math.max(0, flash - dt * 1.8);
      if (sayT > 0) { sayT -= dt; if (sayT <= 0 && sayEl) sayEl.classList.remove("is-on"); }
      if (stateT > 0) stateT -= dt;

      /* 物理:x 由时间推导(世界按时间滚),这样倒带/推演之后位置和时间永远对得上 */
      S.x = t2x(t);
      if (mode === "plane") {
        S.vy = keys.jump ? CFG.SPEED : -CFG.SPEED;
        S.y += S.vy * dt;
        S.rot = keys.jump ? -0.785 : 0.785;
        if (S.y < 0 || S.y + CFG.PH > CFG.ROWS) { die("rail"); return; }
      } else {
        S.vy -= CFG.GRAV * gdir * dt;
        S.y += S.vy * dt;
        S.air = S.onGround ? 0 : S.air;
        var overHole = inHole(S.x + CFG.PW / 2);
        if (gdir > 0) {
          if (S.y <= 0 && !overHole) { S.y = 0; S.vy = 0; S.air = 0; if (!S.onGround) S.rot = 0; S.onGround = true; }
          else S.onGround = false;
        } else {
          if (S.y + CFG.PH >= CFG.ROWS) { S.y = CFG.ROWS - CFG.PH; S.vy = 0; S.air = 0; if (!S.onGround) S.rot = 0; S.onGround = true; }
          else S.onGround = false;
        }
        if (!S.onGround) S.rot += dt * 5.2 * (gdir > 0 ? 1 : -1);
        /* ★ 可踩实体(平台/地面)= 单向地板:
           下落时脚底穿过台面就接住,站在上面时每帧把脚底按回台面;不做横向阻挡
           (x = f(t) 是时间驱动的,推不回去),也永不致死 */
        var supportY = null;
        for (var si3 = 0; si3 < items.length; si3++) {
          var pl = items[si3];
          if (pl.type !== "platform" && pl.type !== "ground") continue;
          if (S.x + CFG.PW <= pl.x || S.x >= pl.x2) continue;
          var top = pl.row + (pl.h || 1);
          if (S.y + CFG.PH >= top - 0.05 && S.y + CFG.PH <= top + 1.0) {
            if (supportY === null || top > supportY) supportY = top;
          }
        }
        if (supportY !== null && S.vy <= 0.01) {
          S.y = supportY - CFG.PH; S.vy = 0; S.air = 0; S.onGround = true;
        }
        /* ★ 掉出世界就该死:几何冲刺版重写时把它弄丢了,站在坑洞上会一直往下掉、永远不死 */
        if (S.y < -2.5) { die("fall"); return; }
      }

      /* 回响:到那一拍自动补一次二段跳 */
      for (var e = 0; e < echoes.length; e++) {
        var ec = echoes[e];
        if (ec.at === attempts || ec.fired === attempts) continue;
        if (S.t >= ec.t && S.t - dt < ec.t) {
          ec.fired = attempts;
          jumpNow(0.95);
          flash = 0.5;
          say("那一拍,上一轮的他替你蹬了一下。", 2.6);
        }
      }
      /* 重力箭头进入点击窗口 */
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it.type !== "gravity" || it.done) continue;
        if (S.t >= it.t - CFG.TAP_WIN && S.t <= it.t + CFG.TAP_WIN) { if (!tapArmed) { tapArmed = it; tapMiss = 0; } }
        else if (tapArmed === it) { tapArmed = null; tapMiss = 1; }
      }
      /* 碰撞 */
      var near = itemsNear(S.x - 3, S.x + 3);
      for (var j = 0; j < near.length; j++) {
        var o = near[j];
        if (o.type === "orb" || o.type === "gravity") continue;
        if (o.type === "hole") continue;                       /* 坑洞不是实体,靠地板判定 */
        if (o.type === "deco") continue;                       /* ★ 装饰物纯视觉,不参与碰撞 */
        if (o.type === "platform" || o.type === "ground") continue;   /* ★ 可踩实体交给地板式处理,永不致死 */
        if (o.type === "rail") {                               /* 斜轨:算中心到轨道的距离 */
          var cxr = S.x + CFG.PW / 2, cyr = S.y + CFG.PH / 2;
          if (cxr < o.x - 0.2 || cxr > o.x2 + 0.2) continue;
          var k2 = (o.x2 - o.x) > 0.01 ? (cxr - o.x) / (o.x2 - o.x) : 0;
          var ry = (o.row + 0.5) + ((o.row2 + 0.5) - (o.row + 0.5)) * k2;
          if (Math.abs(cyr - ry) < 0.30 + CFG.PH / 2) { if (shieldT > 0) continue; die("rail", o); return; }
          continue;
        }
        var x = o.x, w = o.x2 - o.x, y = o.row, h = o.h || 1;
        if (o.type === "spike") { x += w * 0.18; w *= 0.64; y += 0; h = 0.72; }
        if (hit(w, h, x, y)) {
          if (shieldT > 0) { flash = 0.15; continue; }   /* 盾挡着,直接穿过去 */
          die("hit", o); return;
        }
      }
      /* 拖影 */
      if (trail.length < 40) trail.push({ x: S.x, y: S.y });
      for (var g = trail.length - 1; g >= 0; g--) { trail[g].a = (trail[g].a == null ? 1 : trail[g].a) - dt * 1.6; if (trail[g].a <= 0) trail.splice(g, 1); }
      ghostTrail.push({ x: S.x, y: S.y }); if (ghostTrail.length > 40) ghostTrail.shift();
    }

    /* ---------------- 画 ---------------- */
    var V = { w: 0, h: 0, ppb: 20, dpr: 1 };
    function resize() {
      if (!cv || !ctx2d) return;
      var r = root.getBoundingClientRect();
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      V.w = Math.max(2, Math.round(r.width)); V.h = Math.max(2, Math.round(r.height)); V.dpr = dpr;
      V.ppb = V.h / (CFG.ROWS + 2);                    /* 一格方块多少像素 */
      cv.width = Math.round(V.w * dpr); cv.height = Math.round(V.h * dpr);
      cv.style.width = V.w + "px"; cv.style.height = V.h + "px";
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    var COL = { accent: "#7ff0ff", bg: "#06080f", warn: "#ff7a6b", dim: "rgba(226,242,255,.62)" };
    function readColors() {
      var cs = getComputedStyle(root);
      var a = (cs.getPropertyValue("--intro-accent") || "").trim();
      var t = (cs.getPropertyValue("--theme") || "").trim();
      if (a) COL.accent = a;
      if (t) COL.bg = t;
    }
    function W2S(x) { return (x - camX) * V.ppb; }
    function H2S(y) { return V.h - V.ppb - y * V.ppb; }   /* 行 0 = 地面线 */
    var animT = 0;
    function render(dt) {
      if (!ctx2d || !ready) return;
      animT += dt;
      var t = S ? S.t : 0;
      camX = (S ? S.x : 0) - (V.w / V.ppb) * CFG.VIEW;
      ctx2d.clearRect(0, 0, V.w, V.h);
      ctx2d.fillStyle = COL.bg;
      ctx2d.fillRect(0, 0, V.w, V.h);
      /* 背景网格(跟着世界滚)*/
      var step = 4, x0 = Math.floor(camX / step) * step;
      ctx2d.strokeStyle = "rgba(127,240,255,0.05)"; ctx2d.lineWidth = 1;
      for (var gx = x0; gx < camX + V.w / V.ppb + step; gx += step) {
        var px = W2S(gx);
        ctx2d.beginPath(); ctx2d.moveTo(px, 0); ctx2d.lineTo(px, V.h); ctx2d.stroke();
      }
      for (var gy = 0; gy <= CFG.ROWS; gy += 2) {
        var py = H2S(gy);
        ctx2d.beginPath(); ctx2d.moveTo(0, py); ctx2d.lineTo(V.w, py); ctx2d.stroke();
      }
      /* 拍点:地面线跟着拍闪 */
      var ph = period > 0 ? ((t - offset) / period) : 0;
      var phf = ph - Math.floor(ph);
      var pulse = Math.pow(1 - phf, 3);
      ctx2d.strokeStyle = COL.accent;
      ctx2d.globalAlpha = 0.35 + 0.5 * pulse;
      ctx2d.lineWidth = 2;
      ctx2d.beginPath(); ctx2d.moveTo(0, H2S(0)); ctx2d.lineTo(V.w, H2S(0)); ctx2d.stroke();
      ctx2d.globalAlpha = 0.18 + 0.3 * pulse;
      ctx2d.beginPath(); ctx2d.moveTo(0, H2S(CFG.ROWS)); ctx2d.lineTo(V.w, H2S(CFG.ROWS)); ctx2d.stroke();
      ctx2d.globalAlpha = 1;

      /* 物件 */
      var near = itemsNear(camX - 2, camX + V.w / V.ppb + 2);
      for (var i = 0; i < near.length; i++) {
        var o = near[i];
        var x = W2S(o.x), w = (o.x2 - o.x) * V.ppb, y = H2S(o.row + 1), h = V.ppb;
        if (o.type === "block") {
          ctx2d.fillStyle = "rgba(226,246,255,0.16)";
          ctx2d.fillRect(x, H2S(o.row + (o.h || 1)), w, (o.h || 1) * V.ppb);
          ctx2d.strokeStyle = COL.accent; ctx2d.globalAlpha = 0.75; ctx2d.lineWidth = 2;
          ctx2d.strokeRect(x + 1, H2S(o.row + (o.h || 1)) + 1, w - 2, (o.h || 1) * V.ppb - 2);
          ctx2d.globalAlpha = 1;
        } else if (o.type === "spike") {
          ctx2d.fillStyle = COL.warn; ctx2d.globalAlpha = 0.9;
          var n = Math.max(1, Math.round((o.x2 - o.x)));
          for (var k = 0; k < n; k++) {
            var sx = x + k * V.ppb, sw = Math.min(V.ppb, w - k * V.ppb);
            ctx2d.beginPath();
            ctx2d.moveTo(sx, y + h); ctx2d.lineTo(sx + sw / 2, y + h * 0.12); ctx2d.lineTo(sx + sw, y + h);
            ctx2d.closePath(); ctx2d.fill();
          }
          ctx2d.globalAlpha = 1;
        } else if (o.type === "orb") {
          var cy2 = H2S(o.row + 0.5), cr = V.ppb * 0.30 * (1 + 0.22 * Math.sin(animT * 6 + i));
          ctx2d.strokeStyle = o.orb === "pink" ? "#ff9fd0" : "#ffe17a";
          ctx2d.lineWidth = 3; ctx2d.globalAlpha = o.done ? 0.25 : 0.95;
          ctx2d.beginPath(); ctx2d.arc(x + V.ppb * 0.5, cy2, cr, 0, Math.PI * 2); ctx2d.stroke();
          ctx2d.globalAlpha = 1;
        } else if (o.type === "platform" || o.type === "ground") {
          ctx2d.fillStyle = "rgba(184,233,134,0.20)";
          ctx2d.fillRect(x, H2S(o.row + (o.h || 1)), w, (o.h || 1) * V.ppb);
          ctx2d.strokeStyle = "rgba(184,233,134,0.9)"; ctx2d.globalAlpha = 0.9; ctx2d.lineWidth = 2;
          ctx2d.strokeRect(x, H2S(o.row + (o.h || 1)), w, (o.h || 1) * V.ppb);
          ctx2d.globalAlpha = 1; ctx2d.lineWidth = 1;
        } else if (o.type === "deco") {
          if (o.deco === "text") {
            ctx2d.fillStyle = COL.accent; ctx2d.globalAlpha = 0.85;
            ctx2d.font = "600 " + Math.round(V.ppb * 0.7) + "px ui-monospace, Consolas, monospace";
            ctx2d.fillText(o.text || "", x, H2S(o.row + 0.5));
            ctx2d.globalAlpha = 1;
          } else {
            var lr = V.ppb * (o.w || 2);
            var lg = ctx2d.createRadialGradient(x, H2S(o.row + 0.5), 0, x, H2S(o.row + 0.5), lr);
            lg.addColorStop(0, "rgba(255,240,200,0.45)");
            lg.addColorStop(1, "rgba(255,240,200,0)");
            ctx2d.fillStyle = lg;
            ctx2d.fillRect(x - lr, H2S(o.row + 0.5) - lr, lr * 2, lr * 2);
          }
        } else if (o.type === "hole") {
          ctx2d.fillStyle = COL.bg;
          ctx2d.fillRect(x, H2S(1), w, V.ppb * 1.2);           /* 把地板涂掉 = 缺口 */
          ctx2d.strokeStyle = COL.warn; ctx2d.globalAlpha = 0.8; ctx2d.lineWidth = 2;
          ctx2d.beginPath(); ctx2d.moveTo(x, H2S(0)); ctx2d.lineTo(x, H2S(0) + V.ppb * 0.5); ctx2d.stroke();
          ctx2d.beginPath(); ctx2d.moveTo(x + w, H2S(0)); ctx2d.lineTo(x + w, H2S(0) + V.ppb * 0.5); ctx2d.stroke();
          ctx2d.globalAlpha = 1; ctx2d.lineWidth = 1;
        } else if (o.type === "rail") {
          ctx2d.strokeStyle = COL.accent; ctx2d.globalAlpha = 0.9; ctx2d.lineWidth = 3;
          ctx2d.beginPath();
          ctx2d.moveTo(x, H2S(o.row + 0.5));
          ctx2d.lineTo(W2S(o.x2), H2S(o.row2 + 0.5));
          ctx2d.stroke();
          ctx2d.globalAlpha = 1; ctx2d.lineWidth = 1;
        } else if (o.type === "gravity") {
          var arm = (tapArmed === o);
          ctx2d.fillStyle = arm ? "#ffffff" : COL.accent;
          ctx2d.globalAlpha = arm ? 1 : 0.8;
          var cy3 = H2S(o.row + 0.5);
          ctx2d.beginPath();
          ctx2d.moveTo(x + V.ppb * 0.15, cy3 + V.ppb * 0.35);
          ctx2d.lineTo(x + V.ppb * 0.5, cy3 - V.ppb * 0.15);
          ctx2d.lineTo(x + V.ppb * 0.85, cy3 + V.ppb * 0.35);
          ctx2d.closePath(); ctx2d.fill();
          ctx2d.beginPath();
          ctx2d.moveTo(x + V.ppb * 0.15, cy3 + V.ppb * 0.75);
          ctx2d.lineTo(x + V.ppb * 0.5, cy3 + V.ppb * 0.25);
          ctx2d.lineTo(x + V.ppb * 0.85, cy3 + V.ppb * 0.75);
          ctx2d.closePath(); ctx2d.fill();
          ctx2d.globalAlpha = 1;
        }
      }
      /* 回响残影 */
      for (var e = 0; e < echoes.length; e++) {
        var ec = echoes[e];
        if (Math.abs(t - ec.t) > 1.6) continue;
        ctx2d.globalAlpha = 0.16;
        for (var q = 0; q < ec.ghost.length; q++) {
          var gq = ec.ghost[q];
          ctx2d.fillStyle = COL.accent;
          ctx2d.fillRect(W2S(gq.x), H2S(gq.y + 0.9), CFG.PW * V.ppb, CFG.PH * V.ppb);
        }
        ctx2d.globalAlpha = 0.9;
        ctx2d.strokeStyle = COL.accent; ctx2d.lineWidth = 2;
        ctx2d.strokeRect(W2S(ec.x), H2S(ec.y + 0.9), CFG.PW * V.ppb, CFG.PH * V.ppb);
        ctx2d.globalAlpha = 1;
      }
      /* 拖影 */
      for (var q2 = 0; q2 < trail.length; q2++) {
        var tr = trail[q2];
        ctx2d.globalAlpha = (tr.a == null ? 1 : tr.a) * 0.16;
        ctx2d.fillStyle = COL.accent;
        ctx2d.fillRect(W2S(tr.x), H2S(tr.y + 0.9), CFG.PW * V.ppb * 0.7, CFG.PH * V.ppb * 0.7);
      }
      ctx2d.globalAlpha = 1;
      /* 他 */
      if (S) {
        var px = W2S(S.x), py = H2S(S.y + CFG.PH), pw = CFG.PW * V.ppb, phh = CFG.PH * V.ppb;
        if (mode === "plane") {
          ctx2d.save();
          ctx2d.translate(px + pw / 2, py + phh / 2);
          ctx2d.rotate(S.rot || 0);
          ctx2d.fillStyle = "rgba(226,246,255,0.95)";
          ctx2d.beginPath();
          ctx2d.moveTo(-pw * 0.5, -phh * 0.32); ctx2d.lineTo(pw * 0.6, 0); ctx2d.lineTo(-pw * 0.5, phh * 0.32);
          ctx2d.closePath(); ctx2d.fill();
          ctx2d.restore();
        } else {
          ctx2d.save();
          ctx2d.translate(px + pw / 2, py + phh / 2);
          ctx2d.rotate(S.rot || 0);
          ctx2d.fillStyle = dead ? COL.warn : "rgba(226,246,255,0.96)";
          if (dead) ctx2d.globalAlpha = Math.max(0, 1 - deadT * 1.4);
          ctx2d.fillRect(-pw / 2, -phh / 2, pw, phh);
          ctx2d.strokeStyle = COL.accent; ctx2d.lineWidth = 2;
          ctx2d.strokeRect(-pw / 2 + 1, -phh / 2 + 1, pw - 2, phh - 2);
          ctx2d.restore();
          ctx2d.globalAlpha = 1;
        }
        if (shieldT > 0) {
          ctx2d.globalAlpha = 0.35 + 0.25 * Math.sin(animT * 8);
          ctx2d.strokeStyle = COL.accent; ctx2d.lineWidth = 3;
          ctx2d.beginPath(); ctx2d.arc(px + pw / 2, py + phh / 2, phh * 0.95, 0, Math.PI * 2); ctx2d.stroke();
          ctx2d.globalAlpha = 1;
        }
      }
      /* 死亡/护盾闪 */
      if (flash > 0) {
        ctx2d.fillStyle = "rgba(255,120,110," + (flash * 0.20).toFixed(3) + ")";
        ctx2d.fillRect(0, 0, V.w, V.h);
      }
      if (tapMiss > 0) {
        ctx2d.fillStyle = "rgba(255,120,110,0.5)";
        ctx2d.font = "600 14px ui-monospace, Consolas, monospace";
        ctx2d.fillText("MISS", 24, V.h - 24);
      }
      if (dead) { ctx2d.fillStyle = "rgba(0,0,0,0.35)"; ctx2d.fillRect(0, 0, V.w, V.h); }
    }

    /* ---------------- HUD ---------------- */
    function say(text, hold) {
      if (!sayEl) return;
      if (text) { sayTx.textContent = text; sayEl.classList.add("is-on"); }
      sayT = hold || 0;
      if (!text) { sayEl.classList.remove("is-on"); sayT = 0; }
    }
    var lastMode = "";
    function hud(force) {
      if (!ready) return;
      if (clockEl) clockEl.textContent = fmtClock(S ? S.t : 0);
      if (deathsEl) deathsEl.textContent = pad2(deaths);
      if (codeEl) codeEl.style.setProperty("--p", (clamp((S ? S.t : 0) / dur, 0, 1) * 100).toFixed(1) + "%");
      var mt = mode === "plane" ? "飞机" : (gdir > 0 ? "方块" : "方块·反重力");
      if (force || mt !== lastMode) { lastMode = mt; if (stateMode) stateMode.textContent = mt; }
      if (stateTx) {
        var tx = mode === "plane" ? "按住上升 · 松开下降(45°)"
          : (shieldT > 0 ? "护盾 " + shieldT.toFixed(1) + "s"
            : (shieldCd > 0 ? "护盾冷却 " + shieldCd.toFixed(1) + "s" : "TAP 跳"));
        stateTx.textContent = tx;
      }
      if (veil) veil.classList.toggle("is-on", shieldT > 0);
      if (beatDots.length === 4) {
        var ph = period > 0 ? ((S ? S.t : 0) - offset) / period : 0;
        var q = Math.floor((ph - Math.floor(ph)) * 4) % 4;
        for (var i = 0; i < 4; i++) beatDots[i].classList.toggle("is-on", i === q);
      }
    }

    /* ---------------- 循环 ---------------- */
    var active = false, raf = 0, last = 0, acc = 0, frozen = false, paused = false;
    var ED = false;                 /* 铺面编辑器开着 → 不推进仿真 */
    var phase = "menu";             /* menu(开始菜单)/ play / dead(死亡菜单)/ end */
    var auto = false;               /* 自动播放 */
    function frame(now) {
      raf = 0;
      if (!active) return;
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      if (dt > 0 && !frozen) {
        acc += dt;
        var guard = 0;
        while (acc >= 1 / 120 && guard++ < 8) { step(1 / 120); acc -= 1 / 120; }
      }
      if (++hudT % 6 === 0) hud(false);
      render(dt);
      raf = requestAnimationFrame(frame);
    }

    /* ---------------- 输入 ---------------- */
    function typing(e) {
      var t = e.target, tag = t && t.tagName ? t.tagName.toLowerCase() : "";
      return tag === "input" || tag === "textarea" || tag === "select" || (t && t.isContentEditable);
    }
    function onKey(e, down) {
      if (!active || typing(e)) return;
      if (e.key === " " || e.key === "ArrowUp" || /^Arrow/.test(e.key)) e.preventDefault();
      if (e.key === "r" || e.key === "R") { if (down) retry(); return; }
      if (e.key === "s" || e.key === "S" || e.key === "Shift") { if (down && !keys.shield) { keys.shield = 1; shieldNow(); } else if (!down) keys.shield = 0; return; }
      if (e.repeat) return;
      if (down && (e.key === " " || e.key === "ArrowUp" || e.key === "w" || e.key === "W" || e.key === "Enter")) { keys.jump = 1; tap(); }
      else if (!down && (e.key === " " || e.key === "ArrowUp" || e.key === "w" || e.key === "W" || e.key === "Enter")) keys.jump = 0;
    }
    var kd = function (e) { onKey(e, true); }, ku = function (e) { onKey(e, false); };
    function onDown(e) { if (!active) return; if (e.target && e.target.closest && e.target.closest(".lost-btn")) return; keys.jump = 1; tap(); }
    function onUp() { keys.jump = 0; }
    function bindTouch() {
      Array.prototype.slice.call(root.querySelectorAll(".lost-btn")).forEach(function (b) {
        var k = b.getAttribute("data-k");
        b.addEventListener("pointerdown", function (ev) {
          ev.preventDefault(); ev.stopPropagation();
          if (k === "restart") { retry(); return; }
          if (k === "shield") { shieldNow(); return; }
          keys.jump = 1; tap();
        });
        b.addEventListener("pointerup", function (ev) { ev.preventDefault(); keys.jump = 0; });
        b.addEventListener("pointercancel", function () { keys.jump = 0; });
      });
    }
    /* ---------------- 阶段切换(开始菜单 / 死亡菜单)---------------- */
    function setPhase(p2) {
      phase = p2;
      root.classList.toggle("is-menu", phase === "menu");
      root.classList.toggle("is-dead", phase === "dead");
      if (menuAuto) menuAuto.classList.toggle("is-on", auto);
      if (deadAuto) deadAuto.classList.toggle("is-on", auto);
      if (deadAt) deadAt.textContent = "摔在第 " + (nearestBeat(S ? S.t : 0) + 1) + " 拍(" + (S ? S.t.toFixed(1) : "0") + "s) · 从 ST-0" + (Math.max(0, segAt(S ? S.t : 0)) + 1) + " 存档点重来";
    }
    function startRun() {
      auto = auto || false;
      retry();
      audioInit();
      if (!MODE_STEP.dry) audioStart(S.t);
      setPhase("play");
    }
    function quitToMenu() {
      audioStop();
      setPhase("menu");
    }
    function resumeRun() {
      respawn();
      if (!MODE_STEP.dry) audioStart(S.t);
      setPhase("play");
    }
    function toggleAuto() {
      auto = !auto;
      if (phase === "dead") resumeRun();          /* 在死亡菜单里点自动播放 = 开机器人并继续 */
      else if (phase === "menu") startRun();
      else setPhase(phase);
    }
    /* ★ 自动播放:看前方最近的障碍决定"点 / 举盾 / 踩拍翻重力",飞机段朝空档中间飞 */
    function autoThink() {
      if (mode === "plane") {
        var want = null;
        for (var i = 0; i < items.length; i++) {
          var it = items[i];
          if (it.type !== "block") continue;
          if (it.x2 < S.x - 1 || it.x > S.x + 12) continue;
          if (!want || it.x < want.x) want = it;
        }
        var target = 4.5;
        if (want) {
          /* 这一列的障碍摆在哪几行 → 找连续空档的中间 */
          var rowsAt = [];
          for (var j = 0; j < items.length; j++) if (Math.abs(items[j].x - want.x) < 0.6) rowsAt.push(items[j].row);
          var bestGap = null;
          for (var r0 = 0; r0 <= CFG.ROWS - 3; r0++) {
            var okGap = true;
            for (var r1 = r0; r1 < r0 + 3; r1++) if (rowsAt.indexOf(r1) >= 0) okGap = false;
            if (okGap && (bestGap === null || Math.abs(r0 + 1 - S.y) < Math.abs(bestGap + 1 - S.y))) bestGap = r0;
          }
          if (bestGap !== null) target = bestGap + 1;
        }
        keys.jump = (S.y < target - 0.15) ? 1 : 0;
        return;
      }
      /* 重力箭头:窗口一开就踩拍点 */
      if (tapArmed) { tap(); return; }
      var best = null;
      for (var k = 0; k < items.length; k++) {
        var o = items[k];
        if (o.type === "orb" || o.type === "gravity" || o.done || o.type === "rail") continue;
        if (o.type === "platform" || o.type === "ground" || o.type === "deco") continue;
        /* 坑洞当成"要跳过去的东西" */
        if (o.x2 < S.x - 0.5 || o.x > S.x + 10) continue;
        if (!best || o.x < best.x) best = o;
      }
      if (!best) return;
      var bx = best.x + (best.type === "spike" ? 0.18 : 0);   /* 尖刺的判定框比格子窄 */
      var d = bx - (S.x + CFG.PW);
      if (best.w >= 3) { if (d < 7) shieldNow(); return; }     /* 宽障碍:举盾顶过去 */
      /* 在"跨得过整块"的那段窗口里点:太早点不着、太晚落地时还在障碍里 */
      if (S.onGround && S.x >= bx - 2.0 && S.x <= bx - 1.15) { tap(); return; }
      /* 已经在空中、前面还有障碍且正在下落 → 用二段跳补一下 */
      if (!S.onGround && S.air < 2 && S.vy < 1 && S.x < bx - 0.4 && S.x > bx - 3.4) tap();
    }
    function retry() {
      attempts = 0; deaths = 0; echoes = []; reached = false;
      if (endEl) endEl.classList.remove("is-on");
      segNow = -1; resetPlayer(0, 1);
      S.t = chart.lead; S.x = t2x(S.t);
      items.forEach(function (it) { it.done = false; });
      if (!MODE_STEP.dry) audioStart(S.t);
      say(TXT.intro, 5);
      if (deathsEl) deathsEl.textContent = "00";
    }

    /* ---------------- 起停 ---------------- */
    var mo = null;
    function watchScene() {
      if (mo || !window.MutationObserver) return;
      mo = new MutationObserver(function () {
        paused = document.body.classList.contains("scene-open");
        if (paused) audioStop(); else if (active && !MODE_STEP.dry) audioStart(S ? S.t : 0);
      });
      mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    }
    root.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    if (cv) cv.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    bindTouch();
    Array.prototype.slice.call(root.querySelectorAll("[data-act]")).forEach(function (b) {
      b.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var act = b.getAttribute("data-act");
        if (act === "start") startRun();
        else if (act === "resume") resumeRun();
        else if (act === "quit") quitToMenu();
        else if (act === "auto") toggleAuto();
      });
    });
    resetPlayer(0, 1);
    S.t = chart && chart.lead ? chart.lead : 0;
    load();

    return {
      ready: function () { return ready; },
      activate: function (on) {
        active = !!on;
        if (on) {
          /* ★ 选中这张盘只显示开始菜单:不点「开始」不播音乐、不推进(插入 CD 时还在播开机动画)*/
          if (!ready) load().then(function () { if (active) { S.t = chart.lead || 0; S.x = t2x(S.t); setPhase("menu"); } });
          else setPhase("menu");
          audioStop();
          if (!raf) { last = 0; acc = 0; raf = requestAnimationFrame(frame); }
          resize(); readColors();
          window.addEventListener("keydown", kd);
          window.addEventListener("keyup", ku);
          watchScene();
          /* 这一页自己管路关音乐的时间轴 → 让站点的 BGM 让位,免得同一首叠两遍 */
          try { if (window.__cdAudio && window.__cdAudio.music) window.__cdAudio.music.stop(); } catch (e) {}
        } else {
          phase = "menu";
          window.removeEventListener("keydown", kd);
          window.removeEventListener("keyup", ku);
          keys.jump = 0; keys.shield = 0;
          audioStop();
          if (raf) { cancelAnimationFrame(raf); raf = 0; }
        }
      },
      repaint: function () { resize(); camX = (S ? S.x : 0) - (V.w / V.ppb) * CFG.VIEW; },
      /* ---------- 铺面编辑器用的接口 ---------- */
      editorOpen: function (on) {
        ED = !!on;
        if (on) { audioStop(); keys.jump = 0; keys.shield = 0; }
        else if (active && !MODE_STEP.dry) audioStart(S ? S.t : 0);
        return ED;
      },
      /* 编辑器里改了铺面 → 立刻套进来(节拍不用重算)*/
      applyChart: function (ch) {
        if (!ch || !ch.segments) return -1;
        chart = ch; chart.lead = chart.lead == null ? CFG.LEAD : chart.lead;
        chart.duration = dur; chart.period = period; chart.rows = chart.rows || CFG.ROWS;
        prepare();
        return items.length;
      },
      /* 编辑器重新采音之后,把新节拍也交给游戏(否则编辑器吸附新节拍、
         游戏判定用旧节拍,两边就不同步了)*/
      applyBeats: function (bs, p, off, d, env, envStep) {
        if (bs && bs.length) { beats = bs.slice(); beatT = bs.slice(); }
        if (p) period = p;
        if (off != null) offset = off;
        if (d) dur = d;
        if (env) { window.__lostEnv = env; window.__lostEnvStep = envStep || 0; }
        return beatT.length;
      },
      /* 从某一刻试玩:先关掉编辑暂停,再定位 */
      preview: function (t) {
        ED = false;
        resetPlayer(0, 1); S.t = clamp(t, 0, dur - 1); S.x = t2x(S.t); segNow = segAt(S.t);
        items.forEach(function (it) { it.done = false; });
        if (active && !MODE_STEP.dry) audioStart(S.t);
        return S.t;
      },
      /* 编辑器要的原始数据(波形 / 节拍 / 段落 / 采音参数)*/
      data: function () {
        return {
          chart: chart, beats: beatT.slice(), period: period, offset: offset, dur: dur, segs: segs,
          env: (window.__lostEnv || []), envStep: (window.__lostEnvStep || 0),
          items: items.map(function (it) { return { t: it.t, row: it.row, type: it.type, w: it.w, orb: it.orb }; })
        };
      },
      state: function () {
        return {
          key: key, active: active, ready: ready, err: loadErr || A.err,
          t: S ? +S.t.toFixed(3) : 0, x: S ? +S.x.toFixed(2) : 0, y: S ? +S.y.toFixed(2) : 0,
          mode: mode, gdir: gdir, onGround: S ? S.onGround : false,
          phase: phase, auto: auto, echoN: echoes.length,
          dead: dead, deaths: deaths, attempts: attempts, reached: reached,
          shieldT: +shieldT.toFixed(2), shieldCd: +shieldCd.toFixed(2),
          echoes: echoes.map(function (e) { return { beat: e.beat, t: +e.t.toFixed(3), fired: e.fired }; }),
          items: items.length, segs: segs.length, bpm: +(60 / period).toFixed(2),
          beat: nearestBeat(S ? S.t : 0), armed: tapArmed ? +tapArmed.t.toFixed(3) : null,
          say: sayEl && sayEl.classList.contains("is-on") ? sayTx.textContent : ""
        };
      },
      /* ---- 验收专用:定步长推演,不依赖 rAF 与音频 ---- */
      dev: {
        dry: function (on) { MODE_STEP.dry = on !== false; audioStop(); return MODE_STEP.dry; },
        retry: retry,
        seek: function (t) {
          resetPlayer(0, 1); S.t = t; S.x = t2x(t); segNow = segAt(t);
          phase = "play";   /* ★ 推演用:上一条用例死过也不会把后面的挡掉 */
          items.forEach(function (it) { it.done = false; });
          audioStop();
          return this.snapshot();
        },
        y: function (v, gy) { dead = false; deadT = 0; S.y = v; S.vy = 0; S.onGround = false; if (gy) gdir = gy; return this.snapshot(); },
        tap: function () { tap(); return this.snapshot(); },
        start: function () { startRun(); return this.snapshot(); },
        resume: function () { resumeRun(); return this.snapshot(); },
        quit: function () { quitToMenu(); return this.snapshot(); },
        setAuto: function (on) { auto = !!on; setPhase(phase); return this.snapshot(); },
        /* 推演时跳过"死在菜单里等玩家"的那一段 */
        stepMenu: function () { if (phase === "dead") resumeRun(); return this.snapshot(); },
        shield: function () { shieldNow(); return this.snapshot(); },
        hold: function (on) { keys.jump = on ? 1 : 0; return this.snapshot(); },
        advance: function (sec) {
          frozen = true;
          var n = Math.round(sec / (1 / 120));
          for (var i = 0; i < n; i++) step(1 / 120);
          frozen = false;
          return this.snapshot();
        },
        /* 推进到关卡时间 t(按拍走,方便"在第 N 拍点击"这种脚法)*/
        to: function (t) {
          var guard = 0;
          while (S.t < t - 1e-6 && guard++ < 20000 && !dead && !reached) step(1 / 120);
          return this.snapshot();
        },
        echo: function () { return echoes.map(function (e) { return { beat: e.beat, t: +e.t.toFixed(3), at: e.at, fired: e.fired }; }); },
        draft: function () { return draft(chart, beats); },
        chart: function () { return { segments: segs, items: items.length, speed: CFG.SPEED, rows: CFG.ROWS, lead: chart.lead }; },
        /* 排查用:把 rail/hole 换算出来的几何打出来 */
        probe: function () {
          return items.filter(function (o) { return o.type === "rail" || o.type === "hole"; }).map(function (o) {
            return { type: o.type, t: o.t, row: o.row, w: o.w, t2: o.t2, row2: o.row2,
              x: +o.x.toFixed(2), x2: +o.x2.toFixed(2) };
          });
        },
        /* 玩家当前的碰撞盒中心(排查用)*/
        me: function () { return { x: +(S.x + CFG.PW / 2).toFixed(2), y: +(S.y + CFG.PH / 2).toFixed(2), mode: mode }; },
        /* 排查用:把 rail/hole 换算出来的几何打出来 */
        probe: function () {
          return items.filter(function (o) { return o.type === "rail" || o.type === "hole"; }).map(function (o) {
            return { type: o.type, t: o.t, row: o.row, w: o.w, t2: o.t2, row2: o.row2, x: +o.x.toFixed(2), x2: +o.x2.toFixed(2) };
          });
        },
        me: function () { return { x: +(S.x + CFG.PW / 2).toFixed(2), y: +(S.y + CFG.PH / 2).toFixed(2), mode: mode }; },
        snapshot: function () {

          return {
            t: +S.t.toFixed(3), x: +S.x.toFixed(2), y: +S.y.toFixed(2), vy: +S.vy.toFixed(2),
            dead: dead, onGround: S.onGround, mode: mode, gdir: gdir, beat: nearestBeat(S.t),
            phase: phase, auto: auto,
            deaths: deaths, attempts: attempts, reached: reached,
            shieldT: +shieldT.toFixed(2), shieldCd: +shieldCd.toFixed(2)
          };
        }
      }
    };
  }

  if (window.CDPages && window.CDPages.register) window.CDPages.register("lost", build);
})();
