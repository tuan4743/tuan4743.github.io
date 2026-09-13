/* ============================================================
   第三张盘「迷茫」的主页内容:迷你平台跳跃
   ─────────────────────────────────────────────────────────────
   一句话设计:**他过不去的地方,就是他缺的东西。**
     关卡被切成四段,每段只有一样本事能过:
       ① 断崖(240px,单跳只能过 145px)      → 二段跳
       ② 尖刺带(320px,二段跳也跨不过)        → 护盾(按住能挡尖的,但走得慢、撑不久)
       ③ 高速锯(窗口只有几十毫秒)            → 慢动作(世界慢 2.9 倍,他只慢 1.6 倍)
       ④ 深渊(420px,没有落脚点)              → 桥(空中按 E,脚下长出一小块,1.15 秒后消失)
     死一次 → 按顺序解锁下一个能力 → 弹一句第三人称「他」的旁白。
     (不按段落解锁而是按顺序解锁:万一谁手气好蒙过一段,下一次死照样补上,
      不会出现"跳着解锁"或者永远拿不到的情况)

   数据:hugo.toml —— [params.intro.lost] 文案 + [[params.intro.decks.lost]] 四样能力
   微调:所有手感数值都在下面 CONFIG 里(斜坡/重力/跳跃/燃料/桥的寿命…)
   验收:tools/verify/lost-check.mjs(用 dev 钩子做确定性推演,不靠手速)
   ============================================================ */
(function () {
  "use strict";

  /* ---------------- 手感数值(想改手感只动这里) ---------------- */
  var CFG = {
    VW: 960, VH: 540,          /* 设计分辨率:画面按高度缩放,宽度随面板宽高比自然变化 */
    GROUND: 380,               /* 地面顶面 y */
    GRAV: 1500,                /* 重力 px/s² */
    RUN: 215,                  /* 最大跑速 */
    ACC: 1700, FRIC: 2000,     /* 加速度 / 摩擦 */
    JUMP1: 470, JUMP2: 560,    /* 一段跳 / 二段跳的初速度
                                  实测(按住跳、到最高点再蹬):
                                    一段跳 ≈ 135px 远、73px 高
                                    二段跳 ≈ 250px 远、178px 高
                                  → 断崖 190px:单跳必掉(差 55px),二段跳富余 60px
                                  → 尖刺带 320px、深渊 420px:二段跳也够不着(各有别的本事)*/
    COYOTE: 0.09, BUFFER: 0.12,/* 土狼时间 / 起跳缓冲(让手感宽容) */
    PW: 18, PH: 30,            /* 他的碰撞盒 */
    SLOW_W: 0.28,              /* 慢动作:世界的时间倍率(慢 3.6 倍)*/
    SLOW_P: 0.80,              /* 慢动作:他的时间倍率(只慢 1.25 倍 → 相对快 2.9 倍)
                                  这两个数的比值就是"这个能力到底有多强":
                                  世界 0.28 / 他 0.80 = 相对 2.9 倍。
                                  锯那一段就是按这个比值配的:正常速度窗口 0.13s、
                                  过锯要 0.30s(必死);慢下来窗口 0.45s、要 0.37s(过得去)*/
    SH_MAX: 4.6, SH_DRAIN: 1, SH_FILL: 0.7, SH_SPEED: 0.55,  /* 护盾燃料 / 回复 / 减速
                                   燃料要够"从尖刺带前就举着盾一路走过去"(320px ÷ 118px/s ≈ 2.7s,
                                   再加上提前举盾的那一两秒 → 4.6s 才不至于"举早了就死")*/
    BR_LIFE: 1.4, BR_CD: 0.18, BR_MAX: 2, BR_W: 56, BR_H: 10, /* 桥:寿命 / 冷却 / 同时存在数
                                   实测:小跳+空中二段跳一次能过 183px,深渊 420px → 三次跳、两块桥,
                                   每块要撑住"下一次落地"约 1s → 寿命给到 1.4s 才不紧张 */
    DEAD_Y: 560,               /* 掉到这以下算死 */
    RESPAWN: 0.85,             /* 死后停顿多久复活 */
    STEP: 1 / 120,             /* 固定步长(物理确定性) */
    CAM_K: 0.14                /* 镜头跟随阻尼 */
  };

  /* ---------------- 关卡(坐标 = 设计像素) ----------------
     地面顶面 380;深渊就是地面上的缺口;goal 是终点那盏灯 */
  var LV = {
    w: 3720,
    solids: [
      /* 天花板:铺桥跳是可以越跳越高的,没有天花板他会跳到屏幕外面去,
         也就从终点灯(0~380)头顶飞过去了 —— 验收里就是这么发现的 */
      { x: 0, y: -60, w: 3720, h: 60 },
      { x: 0, y: 380, w: 900, h: 220 },        /* ① 起点平台(断崖 900~1090,宽 190)*/
      { x: 1090, y: 380, w: 1610, h: 220 },    /* ②③ 尖刺带与锯走廊同一条地面 1090~2700 */
      { x: 3120, y: 380, w: 600, h: 220 }      /* ④ 深渊之后(深渊 2700~3120,宽 420)*/
    ],
    walls: [],
    /* 崖边标记:只是画一条亮线提醒"到头了",【没有碰撞】——
       之前这里放了两道 140px 的矮墙,结果他直接卡在墙前面过不去(验收抓到的)*/
    edges: [900, 1090, 2700, 3120],
    spikes: [
      { x: 1420, y: 356, w: 320, h: 24 }       /* 尖刺带(护盾专用:320 > 二段跳能跨的 ~270)*/
    ],
    /* 高速锯:周期 0.45s。安全窗口(锯抬到最上面)= 周期的 37% ≈ 0.17s,
       而"从他等到的地方穿过锯"要 0.30s → 正常速度必死;
       慢动作下周期变 1.61s、窗口 0.6s,过锯只要 0.37s → 宽裕 */
    saw: { x: 2230, y: 40, w: 46, h: 220, amp: 150, omega: 2 * Math.PI / 0.45 },
    bridges: [],
    checks: [
      { x: 140 }, { x: 820 }, { x: 1140 }, { x: 1960 }, { x: 2640 }
    ],
    goal: { x: 3400, y: 0, w: 84, h: 380 }     /* 终点那盏灯:从屏幕顶一直垂到地面 ——
                                                  他一路铺桥会越跳越高,矮门会被从头顶飞过去(验收抓到的)*/
  };

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  /* 背景浮尘:固定序列 → 每帧都一样(验收才能逐像素比对) */
  var DUST = (function () {
    var a = [], s = 12345;
    for (var i = 0; i < 90; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      a.push({ x: (s % 10000) / 10000, y: ((s >> 7) % 10000) / 10000, r: 0.6 + ((s >> 3) % 100) / 90, k: 0.2 + ((s >> 11) % 100) / 160 });
    }
    return a;
  })();

  function build(root, key) {
    var cv = root.querySelector(".lost-cv");
    var ctx = cv ? cv.getContext("2d") : null;
    var sayEl = root.querySelector(".lost-say");
    var sayTx = root.querySelector(".lost-say-tx");
    var deathsEl = root.querySelector(".lost-deaths");
    var codeEl = root.querySelector(".lost-code");
    var endEl = root.querySelector(".lost-end");
    var skillEls = Array.prototype.slice.call(root.querySelectorAll(".lost-skill"));
    var veil = root.querySelector(".lost-veil");
    var cvs = { w: 0, h: 0, scale: 1, dpr: 1 };

    /* 文案:开场白 / 终点那句话 / 四样能力的解锁台词 */
    var TXT = {
      intro: root.getAttribute("data-intro") || "",
      ending: root.getAttribute("data-ending") || "",
      restart: root.getAttribute("data-restart") || "按 R 再来一次",
      goal: root.getAttribute("data-goal") || "终点"
    };
    var SKILLS = skillEls.map(function (el) {
      return {
        key: el.getAttribute("data-skill"),
        line: el.getAttribute("data-line") || "",
        el: el, name: (el.querySelector(".lost-skill-name") || {}).textContent || ""
      };
    });
    var ORDER = SKILLS.map(function (s) { return s.key; });
    var skillOf = {};
    SKILLS.forEach(function (s) { skillOf[s.key] = s; });

    /* ---------------- 状态 ---------------- */
    var active = false, frozen = false, raf = 0, last = 0;
    var paused = false;                /* CD 架打开时也停 */
    var skills = {}, keys = { left: 0, right: 0, jump: 0, shield: 0, slow: 0, bridge: 0 };
    var prevJump = 0, prevBridge = 0;
    var player = null, bridges = [], deaths = 0, tWorld = 0, cam = 0, camT = 0;
    var reached = false, sayT = 0, flash = 0, dustT = 0, simT = 0;
    var COL = { accent: "#7ff0ff", dim: "rgba(255,255,255,.45)", bg: "#05070d", warn: "#ff7a6b" };

    function resetPlayer(x) {
      player = {
        x: x, y: CFG.GROUND - CFG.PH, vx: 0, vy: 0, onGround: false,
        jumps: 0, coyote: 0, buffer: 0, fuel: CFG.SH_MAX, brCd: 0, dead: false, deadT: 0,
        face: 1, trail: [], squash: 0
      };
    }

    function reset() {
      skills = {}; ORDER.forEach(function (k) { skills[k] = false; });
      for (var kk in keys) keys[kk] = 0;
      prevJump = 0; prevBridge = 0;
      bridges = []; deaths = 0; tWorld = 0; reached = false; flash = 0;
      resetPlayer(LV.checks[0].x);
      cam = camT = camFor(player.x);
      refreshSkills(); syncHud();
      say(TXT.intro, 6);
      if (endEl) endEl.classList.remove("is-on");
      if (veil) veil.classList.remove("is-on");
    }

    /* ---------------- 音效:不加音频(这一页没配乐需求),只用视觉反馈 ---------------- */

    /* ---------------- 文本 / HUD ---------------- */
    function say(text, hold) {
      if (!sayEl) return;
      if (text) { sayTx.textContent = text; sayEl.classList.add("is-on"); }
      sayT = hold || 0;
      if (!text) sayEl.classList.remove("is-on");
    }
    function refreshSkills() {
      SKILLS.forEach(function (s) {
        s.el.classList.toggle("is-locked", !skills[s.key]);
        s.el.classList.toggle("is-on", !!skills[s.key]);
      });
    }
    function syncHud() {
      if (deathsEl) deathsEl.textContent = pad2(deaths);
      if (codeEl) codeEl.style.setProperty("--p", (clamp(player.x / LV.w, 0, 1) * 100).toFixed(1) + "%");
    }
    function nextLocked() {
      for (var i = 0; i < ORDER.length; i++) if (!skills[ORDER[i]]) return skillOf[ORDER[i]];
      return null;
    }
    function unlock(s) { skills[s.key] = true; refreshSkills(); }

    /* ---------------- 死亡 / 复活 ---------------- */
    function die() {
      if (player.dead) return;
      player.dead = true; player.deadT = 0; flash = 1;
      deaths++;
      if (deathsEl) deathsEl.textContent = pad2(deaths);
      var nx = nextLocked();
      if (nx) { unlock(nx); say(nx.line, 7); }
      else say("他又掉下去了。这一次没有任何新东西长出来 —— 只能自己走过去。", 4.5);
    }
    function respawnX() {
      var x = LV.checks[0].x;
      for (var i = 0; i < LV.checks.length; i++) if (LV.checks[i].x <= player.x) x = LV.checks[i].x;
      return x;
    }
    function respawn() {
      var x = respawnX();
      resetPlayer(x);
      player.brCd = 0;
      bridges.length = 0;
    }

    /* ---------------- 物理 ---------------- */
    function solidRects() { return LV.solids.concat(LV.walls); }
    function hits(ax, ay, aw, ah, b) {
      return ax < b.x + b.w && ax + aw > b.x && ay < b.y + b.h && ay + ah > b.y;
    }
    function playerBox(x, y) { return { x: x, y: y, w: CFG.PW, h: CFG.PH }; }

    function moveX(dt) {
      player.x += player.vx * dt;
      var b = playerBox(player.x, player.y), rs = solidRects();
      for (var i = 0; i < rs.length; i++) {
        var r = rs[i];
        if (!hits(b.x, b.y, b.w, b.h, r)) continue;
        if (player.vx > 0) player.x = r.x - CFG.PW; else if (player.vx < 0) player.x = r.x + r.w;
        player.vx = 0; b = playerBox(player.x, player.y);
      }
      player.x = clamp(player.x, 0, LV.w - CFG.PW);
    }
    function moveY(dt) {
      var prevBottom = player.y + CFG.PH;
      player.y += player.vy * dt;
      var b = playerBox(player.x, player.y), rs = solidRects(), landed = false;
      for (var i = 0; i < rs.length; i++) {
        var r = rs[i];
        if (!hits(b.x, b.y, b.w, b.h, r)) continue;
        if (player.vy > 0) { player.y = r.y - CFG.PH; landed = true; }
        else if (player.vy < 0) { player.y = r.y + r.h; }
        player.vy = 0; b = playerBox(player.x, player.y);
      }
      /* 桥:只从上面踩上去(单向) */
      for (var j = 0; j < bridges.length; j++) {
        var br = bridges[j];
        if (player.vy <= 0) continue;
        if (player.x + CFG.PW <= br.x || player.x >= br.x + br.w) continue;
        if (prevBottom <= br.y + 1 && player.y + CFG.PH >= br.y) { player.y = br.y - CFG.PH; player.vy = 0; landed = true; }
      }
      if (landed) {
        if (!player.onGround) player.squash = 1;
        player.onGround = true; player.jumps = 0; player.coyote = CFG.COYOTE;
      } else {
        player.onGround = false;
        player.coyote = Math.max(0, player.coyote - dt);
      }
    }

    function placeBridge() {
      if (bridges.length >= CFG.BR_MAX) bridges.shift();
      bridges.push({ x: player.x + CFG.PW / 2 - CFG.BR_W / 2, y: player.y + CFG.PH + 2, w: CFG.BR_W, h: CFG.BR_H, life: CFG.BR_LIFE, born: 1 });
      player.brCd = CFG.BR_CD;
    }

    function stepPlayer(dt) {
      if (player.dead) { player.deadT += dt; return; }
      var shieldOn = skills.shield && keys.shield > 0 && player.fuel > 0;
      var dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      var maxv = CFG.RUN * (shieldOn ? CFG.SH_SPEED : 1);
      if (dir) { player.vx += dir * CFG.ACC * dt; player.face = dir; }
      else if (player.vx) player.vx -= Math.min(Math.abs(player.vx), CFG.FRIC * dt) * (player.vx > 0 ? 1 : -1);
      player.vx = clamp(player.vx, -maxv, maxv);

      /* 跳:落地重置 + 土狼时间 + 缓冲;第二次跳要解锁二段跳 */
      if (keys.jump && !prevJump) player.buffer = CFG.BUFFER;
      prevJump = keys.jump;
      player.buffer = Math.max(0, player.buffer - dt);
      if (player.buffer > 0) {
        if (player.onGround || player.coyote > 0) {
          player.vy = -CFG.JUMP1; player.jumps = 1; player.buffer = 0; player.coyote = 0; player.onGround = false;
        } else if (skills.jump && player.jumps < 2) {
          player.vy = -CFG.JUMP2; player.jumps = 2; player.buffer = 0;
          player.trail.push({ x: player.x, y: player.y, a: 1, burst: 1 });
        }
      }
      if (!keys.jump && player.vy < -120) player.vy += CFG.GRAV * 1.6 * dt;   /* 松手就矮一点(手感) */

      player.vy = clamp(player.vy + CFG.GRAV * dt, -900, 900);

      /* 护盾燃料 */
      if (shieldOn) player.fuel = Math.max(0, player.fuel - CFG.SH_DRAIN * dt);
      else player.fuel = Math.min(CFG.SH_MAX, player.fuel + CFG.SH_FILL * dt);

      /* 桥:空中按一下 */
      if (player.brCd > 0) player.brCd = Math.max(0, player.brCd - dt);
      if (keys.bridge && !prevBridge && skills.bridge && !player.onGround && player.brCd <= 0) placeBridge();
      prevBridge = keys.bridge;

      moveX(dt); moveY(dt);

      /* 记录拖影 */
      player.squash = Math.max(0, player.squash - dt * 5);
      if (player.trail.length < 26) player.trail.push({ x: player.x, y: player.y, a: 0.55 });
      for (var i = player.trail.length - 1; i >= 0; i--) {
        player.trail[i].a -= dt * (player.onGround ? 1.3 : 0.75);
        if (player.trail[i].a <= 0) player.trail.splice(i, 1);
      }

      /* 掉出世界 */
      if (player.y > CFG.DEAD_Y) die();
    }

    function stepWorld(dt) {
      if (!player.dead) {
        /* 尖刺:护盾挡得住(挡尖的),别的挡不住 */
        var shieldOn = skills.shield && keys.shield > 0 && player.fuel > 0;
        var b = playerBox(player.x, player.y);
        for (var i = 0; i < LV.spikes.length; i++) {
          if (!hits(b.x, b.y, b.w, b.h, LV.spikes[i])) continue;
          if (shieldOn) continue;                 /* 盾挡住了 */
          die(); return;
        }
        /* 高速锯:盾不管用(它不尖,它快)—— 只有慢动作能给你窗口 */
        var s = sawRect();
        if (hits(b.x, b.y, b.w, b.h, s)) { die(); return; }
        /* 终点 */
        if (!reached && hits(b.x, b.y, b.w, b.h, LV.goal)) {
          reached = true;
          if (endEl) { endEl.classList.add("is-on"); endEl.setAttribute("aria-hidden", "false"); }
          say("", 0);                       /* 结尾那句话交给终点面板说,旁白让位 */
        }
      }
      /* 桥的寿命(跟着他的时间走:慢动作时桥也耐用) */
      for (var j = bridges.length - 1; j >= 0; j--) {
        bridges[j].life -= dt; bridges[j].born = Math.max(0, bridges[j].born - dt * 4);
        if (bridges[j].life <= 0) bridges.splice(j, 1);
      }
    }
    function sawRect() {
      var s = LV.saw;
      var y = s.y + s.amp * (0.5 + 0.5 * Math.sin(tWorld * s.omega));
      return { x: s.x, y: y, w: s.w, h: s.h };
    }

    function step(dtReal) {
      simT += dtReal;
      var slow = !!(skills.slow && keys.slow > 0 && !reached);
      var wdt = dtReal * (slow ? CFG.SLOW_W : 1);
      var pdt = dtReal * (slow ? CFG.SLOW_P : 1);
      tWorld += wdt;
      stepPlayer(pdt);
      if (player.dead && player.deadT > CFG.RESPAWN) respawn();
      stepWorld(wdt);
      /* 旁白计时(真实时间) */
      if (sayT > 0) { sayT -= dtReal; if (sayT <= 0 && sayEl) sayEl.classList.remove("is-on"); }
      /* 镜头 */
      camT = camFor(player.x);
      cam += (camT - cam) * Math.min(1, CFG.CAM_K * dtReal * 60);
      dustT += dtReal;
      flash = Math.max(0, flash - dtReal * 1.6);
      if (veil) veil.classList.toggle("is-on", slow);
    }
    function visW() { return cvs.w ? cvs.w / cvs.scale : CFG.VW; }
    function camFor(x) {
      var half = visW() / 2, want = x + CFG.PW / 2 - half * 0.86;
      return clamp(want, 0, Math.max(0, LV.w - visW()));
    }

    /* ---------------- 画 ---------------- */
    function resize() {
      if (!cv || !ctx) return;
      var r = root.getBoundingClientRect();
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      cvs.w = Math.max(2, Math.round(r.width));
      cvs.h = Math.max(2, Math.round(r.height));
      cvs.dpr = dpr;
      cvs.scale = cvs.h / CFG.VH;
      cv.width = Math.round(cvs.w * dpr);
      cv.height = Math.round(cvs.h * dpr);
      cv.style.width = cvs.w + "px";
      cv.style.height = cvs.h + "px";
      ctx.setTransform(dpr * cvs.scale, 0, 0, dpr * cvs.scale, 0, 0);
    }

    function readColors() {
      var cs = getComputedStyle(root);
      var a = (cs.getPropertyValue("--intro-accent") || "").trim();
      var t = (cs.getPropertyValue("--theme") || "").trim();
      var d = (cs.getPropertyValue("--intro-dim") || "").trim();
      if (a) COL.accent = a;
      if (t) COL.bg = t;
      if (d) COL.dim = d;
    }

    var VWv = 0, VHv = CFG.VH;
    function draw() {
      if (!ctx) return;
      VWv = cvs.w / cvs.scale; VHv = CFG.VH;
      ctx.save();
      ctx.clearRect(0, 0, VWv, VHv);
      /* 背景 */
      ctx.fillStyle = COL.bg;
      ctx.fillRect(0, 0, VWv, VHv);
      drawDust();
      drawGrid();
      ctx.translate(-cam, 0);

      drawSolids();
      drawGoal();
      drawSpikes();
      drawSaw();
      drawBridges();
      drawPlayer();
      ctx.restore();

      drawVignette();
      if (flash > 0) { ctx.fillStyle = "rgba(255,120,110," + (flash * 0.22).toFixed(3) + ")"; ctx.fillRect(0, 0, VWv, VHv); }
      if (reached) { ctx.fillStyle = "rgba(0,0,0,0.42)"; ctx.fillRect(0, 0, VWv, VHv); }
    }

    function drawDust() {
      ctx.save();
      for (var i = 0; i < DUST.length; i++) {
        var d = DUST[i];
        var x = ((d.x * LV.w - cam * d.k) % (VWv + 40) + VWv + 40) % (VWv + 40) - 20;
        var y = d.y * VHv;
        var tw = 0.45 + 0.55 * Math.abs(Math.sin(dustT * 0.7 + i));
        ctx.fillStyle = "rgba(255,255,255," + (0.05 + 0.09 * tw).toFixed(3) + ")";
        ctx.fillRect(x, y, d.r, d.r);
      }
      ctx.restore();
    }
    function drawGrid() {
      ctx.save();
      ctx.strokeStyle = "rgba(127,240,255,0.045)";
      ctx.lineWidth = 1;
      var step = 60, ox = -(cam % step);
      for (var x = ox; x < VWv; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, VHv); ctx.stroke(); }
      for (var y = 0; y < VHv; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VWv, y); ctx.stroke(); }
      ctx.restore();
    }
    function drawSolids() {
      var rs = solidRects();
      for (var i = 0; i < rs.length; i++) {
        var r = rs[i];
        if (r.x + r.w < cam - 40 || r.x > cam + VWv + 40) continue;
        ctx.fillStyle = "rgba(10,16,26,0.92)";
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.fillStyle = COL.accent;
        ctx.globalAlpha = 0.55;
        ctx.fillRect(r.x, r.y, r.w, 2);          /* 台面亮边 */
        ctx.globalAlpha = 0.12;                  /* 两道浅浅的纹理:让它看起来是"台子"而不是黑洞 */
        ctx.fillRect(r.x, r.y + 7, r.w, 1);
        ctx.globalAlpha = 0.06;
        ctx.fillRect(r.x, r.y + 16, r.w, 1);
        ctx.globalAlpha = 1;
      }
      /* 崖边亮线(纯提示,没有碰撞)*/
      ctx.save();
      ctx.strokeStyle = COL.accent;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 2;
      for (var e = 0; e < LV.edges.length; e++) {
        var x = LV.edges[e];
        if (x < cam - 20 || x > cam + VWv + 20) continue;
        ctx.beginPath(); ctx.moveTo(x, CFG.GROUND - 26); ctx.lineTo(x, CFG.GROUND + 130); ctx.stroke();
      }
      ctx.restore();
    }
    function drawSpikes() {
      for (var i = 0; i < LV.spikes.length; i++) {
        var s = LV.spikes[i];
        if (s.x + s.w < cam - 40 || s.x > cam + VWv + 40) continue;
        ctx.fillStyle = COL.warn;
        ctx.globalAlpha = 0.85;
        var n = Math.floor(s.w / 16);
        for (var k = 0; k < n; k++) {
          var x = s.x + k * 16;
          ctx.beginPath();
          ctx.moveTo(x, s.y + s.h); ctx.lineTo(x + 8, s.y); ctx.lineTo(x + 16, s.y + s.h);
          ctx.closePath(); ctx.fill();
        }
        ctx.globalAlpha = 0.5;
        ctx.fillRect(s.x, s.y + s.h - 2, s.w, 2);
        ctx.globalAlpha = 1;
      }
    }
    function drawSaw() {
      var s = sawRect();
      if (s.x + s.w < cam - 60 || s.x > cam + VWv + 60) return;
      ctx.save();
      ctx.shadowColor = COL.accent; ctx.shadowBlur = 18;
      ctx.fillStyle = "rgba(210,245,255,0.92)";
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.restore();
      /* 锯口 */
      ctx.fillStyle = "rgba(10,16,26,0.95)";
      for (var k = 0; k < 8; k++) ctx.fillRect(s.x - 4, s.y + 10 + k * 26, s.w + 8, 8);
      ctx.strokeStyle = "rgba(127,240,255,0.7)"; ctx.lineWidth = 1;
      ctx.strokeRect(s.x - 0.5, s.y - 0.5, s.w + 1, s.h + 1);
    }
    function drawBridges() {
      for (var i = 0; i < bridges.length; i++) {
        var b = bridges[i];
        var a = clamp(b.life / CFG.BR_LIFE, 0, 1);
        ctx.globalAlpha = 0.35 + 0.6 * a;
        ctx.strokeStyle = COL.accent;
        ctx.lineWidth = 2;
        ctx.setLineDash([7, 5]);
        ctx.strokeRect(b.x, b.y, b.w, b.h);
        ctx.setLineDash([]);
        ctx.fillStyle = COL.accent;
        ctx.globalAlpha = 0.18 + 0.5 * a;
        ctx.fillRect(b.x, b.y, b.w * a, b.h);
        ctx.globalAlpha = 1;
      }
    }
    function drawGoal() {
      var g = LV.goal;
      if (g.x + g.w < cam - 80 || g.x > cam + VWv + 80) return;
      ctx.save();
      ctx.strokeStyle = COL.accent; ctx.lineWidth = 2; ctx.globalAlpha = 0.9;
      ctx.strokeRect(g.x + 0.5, g.y + 0.5, g.w - 1, g.h - 1);
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = COL.accent;
      ctx.fillRect(g.x, g.y, g.w, g.h);
      ctx.globalAlpha = 0.5;
      ctx.fillRect(g.x + g.w / 2 - 1, g.y + 14, 2, g.h - 28);
      ctx.globalAlpha = 1;
      ctx.restore();
      ctx.fillStyle = COL.accent;
      ctx.globalAlpha = 0.75;
      ctx.font = "600 13px ui-monospace, Consolas, monospace";
      ctx.fillText(TXT.goal, g.x + 4, g.y + 20);
      ctx.globalAlpha = 1;
    }
    function drawPlayer() {
      /* 拖影 */
      for (var i = 0; i < player.trail.length; i++) {
        var t = player.trail[i];
        ctx.globalAlpha = Math.max(0, t.a) * 0.30;
        ctx.fillStyle = COL.accent;
        if (t.burst) { ctx.globalAlpha = 0.5; ctx.fillRect(t.x - 10, t.y + 26, CFG.PW + 20, 2); }
        ctx.fillRect(t.x + 3, t.y + 4, CFG.PW - 6, CFG.PH - 6);
      }
      ctx.globalAlpha = 1;
      if (player.dead) {
        ctx.globalAlpha = Math.max(0, 1 - player.deadT * 1.4);
        ctx.fillStyle = COL.warn;
        ctx.fillRect(player.x, player.y, CFG.PW, CFG.PH);
        ctx.globalAlpha = 1;
        return;
      }
      var sq = player.squash * 4;
      var h = CFG.PH * (1 - sq * 0.012), w = CFG.PW * (1 + sq * 0.02);
      var y = player.y + (CFG.PH - h);
      /* 护盾 */
      var shieldOn = skills.shield && keys.shield > 0 && player.fuel > 0;
      if (shieldOn) {
        ctx.save();
        ctx.globalAlpha = 0.30 + 0.22 * Math.sin(dustT * 6);
        ctx.strokeStyle = COL.accent; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(player.x + CFG.PW / 2, player.y + CFG.PH / 2, CFG.PH * 0.95, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      /* 身体 + 头 */
      ctx.fillStyle = "rgba(226,246,255,0.95)";
      ctx.fillRect(player.x, y + 9, w, h - 9);
      ctx.beginPath();
      ctx.arc(player.x + w / 2, y + 6, 6, 0, Math.PI * 2);
      ctx.fill();
      /* 朝向 */
      ctx.fillStyle = COL.accent;
      ctx.fillRect(player.x + (player.face > 0 ? w - 3 : 0), y + 4, 3, 4);
      /* 二段跳可用时:脚下两小点 */
      if (skills.jump && player.jumps < 2 && !player.onGround) {
        ctx.globalAlpha = 0.5;
        ctx.fillRect(player.x + 2, player.y + CFG.PH + 3, 4, 2);
        ctx.fillRect(player.x + CFG.PW - 6, player.y + CFG.PH + 3, 4, 2);
        ctx.globalAlpha = 1;
      }
    }
    function drawVignette() {
      var g = ctx.createRadialGradient(VWv / 2, VHv / 2, VHv * 0.32, VWv / 2, VHv / 2, VHv * 0.92);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VWv, VHv);
    }

    /* ---------------- 主循环 ---------------- */
    function frame(now) {
      raf = 0;
      if (!active) return;
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      if (dt > 0 && !paused && !frozen) {
        /* 固定步长推进:物理确定性(验收脚本也用同一条路径)*/
        acc += dt;
        var guard = 0;
        while (acc >= CFG.STEP && guard++ < 8) { step(CFG.STEP); acc -= CFG.STEP; }
      }
      syncHudLight();
      draw();
      raf = requestAnimationFrame(frame);
    }
    var acc = 0;
    var hudTick = 0;
    function syncHudLight() { if (++hudTick % 12 === 0) syncHud(); }

    /* ---------------- 输入 ---------------- */
    var KEYMAP = {
      ArrowLeft: "left", a: "left", A: "left",
      ArrowRight: "right", d: "right", D: "right",
      ArrowUp: "jump", w: "jump", W: "jump", " ": "jump", Spacebar: "jump",
      ArrowDown: "shield", s: "shield", S: "shield",
      Shift: "slow", ShiftLeft: "slow", ShiftRight: "slow",
      e: "bridge", E: "bridge",
      r: "restart", R: "restart"
    };
    function typing(e) {
      var t = e.target;
      if (!t) return false;
      var tag = (t.tagName || "").toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select" || t.isContentEditable;
    }
    function onKey(e, down) {
      if (!active || typing(e)) return;
      var k = KEYMAP[e.key];
      if (!k) return;
      if (/^Arrow|^ $/.test(e.key) || e.key === "Spacebar") e.preventDefault();
      if (k === "restart") { if (down) reset(); return; }
      keys[k] = down ? 1 : 0;
    }
    var kd = function (e) { onKey(e, true); }, ku = function (e) { onKey(e, false); };
    /* 触摸按钮 */
    var btnOff = [];
    function bindTouch() {
      Array.prototype.slice.call(root.querySelectorAll(".lost-btn")).forEach(function (b) {
        var k = b.getAttribute("data-k");
        var set = function (on) { return function (ev) { ev.preventDefault(); if (k === "restart") { if (on) reset(); return; } keys[k] = on ? 1 : 0; }; };
        var d = set(true), u = set(false);
        b.addEventListener("pointerdown", d);
        b.addEventListener("pointerup", u);
        b.addEventListener("pointercancel", u);
        b.addEventListener("pointerleave", u);
        btnOff.push(function () { b.removeEventListener("pointerdown", d); b.removeEventListener("pointerup", u); b.removeEventListener("pointercancel", u); b.removeEventListener("pointerleave", u); });
      });
    }

    /* ---------------- CD 架打开时暂停 ---------------- */
    var mo = null;
    function watchScene() {
      if (mo || !window.MutationObserver) return;
      mo = new MutationObserver(function () { paused = document.body.classList.contains("scene-open"); });
      mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    }

    reset();
    bindTouch();
    return {
      activate: function (on) {
        active = !!on;
        if (on) {
          if (!raf) { last = 0; acc = 0; raf = requestAnimationFrame(frame); }
          resize(); readColors();
          paused = document.body.classList.contains("scene-open");
          window.addEventListener("keydown", kd);
          window.addEventListener("keyup", ku);
          watchScene();
        } else {
          window.removeEventListener("keydown", kd);
          window.removeEventListener("keyup", ku);
          keys = { left: 0, right: 0, jump: 0, shoot: 0, shield: 0, slow: 0, bridge: 0 };
          prevJump = 0; prevBridge = 0;
          if (raf) { cancelAnimationFrame(raf); raf = 0; }
        }
      },
      repaint: function () { resize(); cam = camT = camFor(player.x); if (active) draw(); },
      state: function () {
        return {
          key: key, active: active, paused: paused, reached: reached, deaths: deaths,
          simT: +simT.toFixed(2),            /* 累计仿真时间(验收用:无头浏览器帧率太低时,靠它把"操作"和"帧率"分开看)*/
          skills: JSON.parse(JSON.stringify(skills)),
          x: Math.round(player.x), y: Math.round(player.y), vy: Math.round(player.vy),
          onGround: player.onGround, jumps: player.jumps, fuel: +player.fuel.toFixed(2),
          bridges: bridges.length, sawY: Math.round(sawRect().y),
          say: sayEl && sayEl.classList.contains("is-on") ? sayTx.textContent : "",
          locked: ORDER.filter(function (k) { return !skills[k]; }).length
        };
      },
      /* ---- 验收专用:确定性推演(不依赖 rAF / 手速) ---- */
      dev: {
        reset: reset,
        place: function (x, opts) {
          opts = opts || {};
          if (opts.skills) { skills = {}; ORDER.forEach(function (k) { skills[k] = opts.skills.indexOf(k) >= 0; }); refreshSkills(); }
          /* 先松开所有键:不然上一个测试按住的键会漏到这一个测试里(验收踩过)*/
          for (var kk in keys) keys[kk] = 0;
          prevJump = 0; prevBridge = 0;
          resetPlayer(x);
          if (opts.deaths != null) { deaths = opts.deaths; if (deathsEl) deathsEl.textContent = pad2(deaths); }
          bridges.length = 0; reached = false;
          tWorld = opts.tWorld || 0;      /* 复位世界时间 → 锯的相位从零开始(验收可复现)*/
          if (endEl) endEl.classList.remove("is-on");
          cam = camT = camFor(player.x);
          return this.snapshot();
        },
        press: function (k, on) { if (k in keys) keys[k] = on ? 1 : 0; return this.snapshot(); },
        steer: function (o) { for (var k in o) if (k in keys) keys[k] = o[k] ? 1 : 0; return this.snapshot(); },
        /* 推进 seconds 秒(固定步长,和主循环同一条 step)*/
        advance: function (sec, o) {
          if (o) this.steer(o);
          frozen = true;
          var n = Math.round(sec / CFG.STEP);
          for (var i = 0; i < n; i++) step(CFG.STEP);
          frozen = false;
          return this.snapshot();
        },
        snapshot: function () {
          return {
            x: +player.x.toFixed(1), y: +player.y.toFixed(1), dead: player.dead,
            onGround: player.onGround, jumps: player.jumps, vy: Math.round(player.vy),
            deaths: deaths, sawY: Math.round(sawRect().y),
            skills: Object.keys(skills).filter(function (k) { return skills[k]; }),
            reached: reached, bridges: bridges.length,
            fuel: +player.fuel.toFixed(2), cam: +cam.toFixed(1)
          };
        }
      }
    };
  }

  if (window.CDPages && window.CDPages.register) window.CDPages.register("lost", build);
})();
