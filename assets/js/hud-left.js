/* ============================================================
   左下角 UHD —— 框上那几枚按钮 + 点出来的"全息投影"面板
   ─────────────────────────────────────────────────────────────
   用户:"完成左侧UHD,实现和右边一样,是先用 SVG 画出边框,再往边框上塞按钮。"
   用户:"我功能页并不是想脱离这个面板,而是想做成那种全息投影,点一下模块,
         投影出这个面版,再点一下收回。面版其实想做成等宽但根据模块自适应高度的,
         整体也是先画 SVG 风格的框,左下角和右上角两个 45° 切角就够了。"
   用户:"音乐播放器其实并非本地曲目,想要做成嵌入式播放器链接网易云音乐。"

   干四件事:
     ① 量面板几何:等宽(所有模块同一个宽度)+ 高度自适应;位置贴着被点的那个模块
        (左下那两枚在页底,面板就投在它们【上面】,不然会盖住按钮点不回去)
     ② 画框:SVG 六边形,左下 + 右上各一刀 45°。切角要【屏幕上的真 45°】⇒
        viewBox 每次设成面板的实际像素尺寸,多边形用像素坐标写
     ③ 那条投影光束:从这个模块的位置连到面板(把"从哪投出来的"说清楚)
     ④ 渲染内容:番茄钟把已有的 #hud-timer 搬进来;音乐 = 网易云嵌入式播放器

   ★ 按钮的位置/形不在这里 —— 那是 page-hud.js 算好写进 style 的(单一真值 gFrameLB)。
   ★ 拿不到 #hud-left 就静默退出(列表页之外的页面、或样式没加载)。
   ============================================================ */
(function () {
  "use strict";

  var root = document.getElementById("hud-left");
  if (!root) return;
  var panel = document.getElementById("hud-left-panel");
  var body = document.getElementById("hud-left-body");
  var inner = root.querySelector(".hud-proj__inner");
  var frame = root.querySelector(".hud-proj__frame");
  var beam = root.querySelector(".hud-proj__beam");
  var titleEl = document.getElementById("hud-left-title");
  var enEl = document.getElementById("hud-left-en");
  var mods = [].slice.call(root.querySelectorAll("[data-hud-mod]"));
  if (!panel || !body || !titleEl) return;

  var main = document.querySelector("main.main") || document.querySelector("main") || document.body;
  var timerEl = document.getElementById("hud-timer");
  var timerHome = timerEl ? timerEl.parentNode : null;
  var timerWasMin = null;
  var musicEmbed = root.getAttribute("data-hud-music") || "";
  /* 歌曲数据走 <script type="application/json">,不塞 data-* 属性(歌名里什么字符都有) */
  var musicData = { embed: "", songs: [] };
  try {
    var raw = document.getElementById("hud-music-data");
    if (raw && raw.textContent) musicData = JSON.parse(raw.textContent) || musicData;
  } catch (e) { }
  if (!musicData.embed) musicData.embed = musicEmbed;
  var musicPick = 0;      /* 面板里选中的是第几首 */

  /* ★★★ 播放器是【常驻】的(用户第六轮:"这个音乐在后台播放时,点其他模块,音乐会关掉"):
     面板内容每次都会被重画,<audio> 要是挂在面板里,一切模块就被销毁 ⇒ 歌就断了。
     所以它挂在 .hud-left 上,谁都不动它;面板那层只是它的"遥控器"。
     (display:none 不影响播放,音频元素照播。) */
  var audioEl = document.createElement("audio");
  audioEl.id = "hud-player-audio";
  audioEl.preload = "none";
  audioEl.style.display = "none";
  root.appendChild(audioEl);

  /* ---------- ① 几何:一条公共的横线 + 纵向展开 ----------
     ★★★ 用户第二轮第 1 条:"我想做成那种纵向展开的,就是原本都是在一个位置的横线,
          然后纵向展开,关闭就收拢,现在看着各个面版的位置都不一样。"
          ⇒ 所有模块共用【同一条横线】(带子上方),面板从这条线往上长;
            位置不再跟着模块跑(等宽 + 等高线 + 只在竖直方向展开)。 */
  var GAP = 12;          /* 模块 → 面板 的缝 */
  var MIN_W = 200;       /* 比这窄就只留按钮、不弹面板 */
  var MAX_W = 360;
  var CUT = 18;          /* 两个 45° 切角的边长(px) */
  var LINE_Y = 88;       /* 那条横线的高度(设计单位 = vh;带子下支的按钮从 89.5 起) */
  var last = null;
  var anim = 0;

  function bandRight() {
    /* 带子(含凸起)伸到哪儿:设计稿里凸起伸到 6 个单位,1 个单位 = 1vh */
    return Math.round(0.06 * document.documentElement.clientHeight);
  }

  /* ★★★ 左上角那个【投影节点】(等腰直角三角形,.proj-node,钉在视口左上角)不能让面板压住 ——
     用户第三轮:"这个音乐播放器展开真有点大了,把左上角那个三角投影点给挡住了。"
     ⇒ 面板能长到多高,由它的下缘决定(拿不到就当 0)。 */
  function projBottom() {
    var n = document.querySelector(".proj-node");
    if (!n || !n.getBoundingClientRect) return 0;
    var r = n.getBoundingClientRect();
    return r && r.height ? Math.round(r.bottom) + 12 : 0;
  }

  /* 那条横线:位置固定,和哪个模块被点无关 */
  function layoutSlit(left, w) {
    var slit = document.getElementById("hud-left-slit");
    if (!slit) return;
    slit.style.left = left + "px";
    slit.style.width = w + "px";
    slit.style.top = Math.round(LINE_Y / 100 * document.documentElement.clientHeight) + "px";
  }

  /* 把面板从当前高度动画到 animTarget —— 每帧重画框 + 重新钉底边,
     所以两刀一直是 45°,而且看起来是【从那条横线往上长】。
     ★ 演到一半如果内容又量高了(日历画出来、iframe 加载完),只改 animTarget,
       不要硬跳 —— 上一版就是在这儿把动画掐死的。
     ★★ 收拢时也要【重钉底边】:只改高度的话元素是"顶边不动、底边往上抬",
        看起来就是"向上收";钉住底边之后才是往那条横线【向下收】(用户第三轮)。 */
  var animTarget = 0;
  function unfold(targetH, durMs) {
    var w = parseFloat(panel.style.width) || panel.offsetWidth || 320;
    var lineTop = last ? last.line : Math.round(LINE_Y / 100 * document.documentElement.clientHeight);
    var from = panel.offsetHeight;
    var t0 = 0, dur = durMs || 460;
    animTarget = targetH;
    if (anim) cancelAnimationFrame(anim);
    var step = function (ts) {
      if (!t0) t0 = ts;
      var k = Math.min(1, (ts - t0) / dur);
      /* easeInOutCubic:两头慢、中间快 —— 展开的"流畅感"就靠这条曲线 */
      var e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      var h = from + (animTarget - from) * e;
      panel.style.height = h + "px";
      panel.style.top = Math.round(lineTop - h) + "px";   /* ★ 底边钉在那条线上 */
      drawFrame(w, h);
      if (k < 1) anim = requestAnimationFrame(step);
      else {
        panel.style.height = animTarget + "px";
        panel.style.top = Math.round(lineTop - animTarget) + "px";
        drawFrame(w, animTarget);
        anim = 0;
        panel.classList.add("is-still");                  /* 停稳了才挂阴影(性能) */
      }
    };
    anim = requestAnimationFrame(step);
  }

  function layout(animate) {
    var vw = document.documentElement.clientWidth;
    var vh = document.documentElement.clientHeight;
    var mainLeft = main.getBoundingClientRect().left;

    /* ★ 等宽 + 固定左缘:所有模块共用同一条横线、同一个宽度。
       ★★ 这段必须在"有没有开面板"之前算 —— 那条横线是【idle 也要在】的收起态,
          上一版把它放在 if (!current) return 后面,于是没开面板时横线是 0 宽(实测抓到的)。 */
    var left = bandRight() + GAP + 2;
    var w = Math.round(Math.min(MAX_W, Math.max(MIN_W, mainLeft - left - GAP)));
    var lineTop = Math.round(LINE_Y / 100 * vh);
    root.style.setProperty("--hud-left-panel-x", left + "px");
    root.style.setProperty("--hud-left-panel-w", w + "px");
    panel.style.left = left + "px";
    panel.style.width = w + "px";
    layoutSlit(left, w);
    last = { vw: vw, vh: vh, left: left, w: w, ph: 0, line: lineTop, cut: CUT };
    if (!current) return;

    var host = root.querySelector('[data-hud-mod="' + current + '"] .hud-left__face');
    var r = host && host.getBoundingClientRect ? host.getBoundingClientRect() : null;

    /* ★★ 量内容高度【不要去动面板自己的 height】(先设 auto 再读再写回去 =
       动画中间插一帧满高 ⇒ 肉眼就是"抖一下",实测抓到 323→269→323 这种跳变)。
       内容那层是 flex:0 0 auto,它天生就是自然高度,直接读它。
       ★ 上限同时受两件事约束:那条横线,以及左上角投影节点的下缘。 */
    var maxH = Math.max(200, lineTop - projBottom() - 12);
    var ph = Math.min((inner && inner.offsetHeight) || panel.offsetHeight || 240, maxH);
    if (animate) {
      panel.style.height = "0px";
      panel.style.top = Math.round(lineTop) + "px";   /* ★ 从 0 高开始:底边先落在那条线上 */
      unfold(ph, 460);                    /* ★ 展开慢一点、两头慢中间快 */
    } else if (anim) {
      animTarget = ph;                    /* 演到一半内容量高了:改目标,别硬跳 */
    } else {
      panel.style.height = ph + "px";
      drawFrame(w, ph);
    }
    /* ★ 动画在跑的时候【不要】去写 top:那是动画每一帧在管的事(它按当前高度钉底边)。
       这里再写一次 = 把面板先挪到"最终位置"、高度还没长上去 ⇒ 肉眼就是抖一下
       (实测抓到 底边 469/792/792 —— 第一帧被顶掉了)。 */
    if (!anim) panel.style.top = Math.round(lineTop - ph) + "px";
    drawBeam(r, left, Math.round(lineTop - ph), w, ph, vh);
    last.ph = ph;
  }

  /* ---------- ② 框:六边形(左下 + 右上两个 45° 切角) ---------- */
  function hexPoints(w, h) {
    var c = Math.min(CUT, Math.floor(Math.min(w, h) / 3));
    return [
      [0, 0], [w - c, 0], [w, c], [w, h], [c, h], [0, h - c]
    ];
  }

  function drawFrame(w, h) {
    if (!frame || !w || !h) return;
    var pts = hexPoints(w, h);
    var str = pts.map(function (p) { return p[0] + "," + p[1]; }).join(" ");
    frame.setAttribute("viewBox", "0 0 " + w + " " + h);
    [].forEach.call(frame.querySelectorAll("polygon"), function (p) { p.setAttribute("points", str); });
    /* 内容也按同一圈切角裁一下,免得字压到切角外面 */
    var css = "polygon(" + pts.map(function (p) { return p[0] + "px " + p[1] + "px"; }).join(", ") + ")";
    if (inner) {
      inner.style.clipPath = css;
      inner.style.webkitClipPath = css;
    }
  }

  /* ---------- ③ 光束:从模块到面板 ---------- */
  function drawBeam(r, left, top, w, ph, vh) {
    if (!beam || !r) return;
    var vw = document.documentElement.clientWidth;
    beam.setAttribute("viewBox", "0 0 " + vw + " " + vh);
    var bx = r.x + r.width / 2, by = r.y + r.height / 2;
    /* 连到面板左缘上离模块最近的那一点(面板已经从那条横线往上展开) */
    var px = left;
    var py = Math.min(top + ph - 8, Math.max(top + 8, by));
    var line = beam.querySelector("line"), dot = beam.querySelector("circle");
    if (line) {
      line.setAttribute("x1", Math.round(bx)); line.setAttribute("y1", Math.round(by));
      line.setAttribute("x2", Math.round(px)); line.setAttribute("y2", Math.round(py));
    }
    if (dot) { dot.setAttribute("cx", Math.round(bx)); dot.setAttribute("cy", Math.round(by)); }
  }

  /* ---------- ④ 模块内容 ---------- */
  var MODS = {
    timer: { name: "番茄钟", en: "FOCUS", host: "timer" },
    music: { name: "音乐播放器", en: "MUSIC", music: true },
    time: {
      name: "时钟 · 日历", en: "TIME",
      html: '<div class="hud-left__clock"><b id="hud-left-clock">--:--:--</b>' +
        '<span id="hud-left-date"></span></div><div class="hud-left__cal" id="hud-left-cal"></div>'
    },
    note: {
      name: "草稿纸", en: "NOTES",
      html: '<textarea class="hud-left__note" id="hud-left-note" spellcheck="false" ' +
        'placeholder="随手记点东西…(自动存本机)"></textarea>'
    },
    slot: {
      name: "左下角空位", en: "SLOT",
      html: '<p class="hud-left__todo">这个角先空着。<br>' +
        '形状已经定死是等腰直角三角形(两条直角边贴着页缘),里面放什么你说。</p>'
    }
  };

  var current = null;
  var clockTimer = 0;
  var calMonth = null;

  /* ---- 番茄钟:把已有的那个节点搬进面板,收回的时候搬回去 ---- */
  function hostTimer() {
    if (!timerEl || !timerHome) {
      body.innerHTML = '<p class="hud-left__todo">没找到番茄钟那一块(它挂在 .page-hud 里)。</p>';
      return;
    }
    if (timerWasMin === null) timerWasMin = timerEl.classList.contains("is-min");
    body.innerHTML = "";
    timerEl.classList.add("hud-timer--inpanel");
    /* ★ 顺序不能反:先搬进面板、再摘 is-min(摘之前它 display:none,offsetHeight 是 0),
       最后才让 layout() 去量高度。 */
    body.appendChild(timerEl);
    if (window.__hudTomato && window.__hudTomato.expand) window.__hudTomato.expand();
    else timerEl.classList.remove("is-min");
  }

  function unhostTimer() {
    if (!timerEl || !timerHome || timerEl.parentNode !== body) return;
    timerEl.classList.remove("hud-timer--inpanel");
    if (window.__hudTomato && window.__hudTomato.collapse) window.__hudTomato.collapse();
    else if (timerWasMin) timerEl.classList.add("is-min");
    timerHome.appendChild(timerEl);
  }

  /* ---- 音乐:网易云的嵌入式播放器 ----
     ★★ 用户给的 25 个 ID 是【歌曲】不是歌单(上一轮我按歌单做,type 用错了)⇒
        播放器走 type=2 的单曲嵌入(只要 86px 高,面板也就不会长到挡住投影节点)。
     数据在 hugo.toml 的 params.hudMusicSongs。 */
  function renderMusic() {
    /* ① 手填的单曲/整条嵌入地址优先 */
    if (musicData.embed) {
      pauseAudio();
      var m0 = /height=(\d+)/.exec(musicData.embed);
      var h0 = m0 ? Math.max(66, Math.min(460, Number(m0[1]) + 20)) : 86;
      body.innerHTML = musicFrame(musicData.embed, h0);
      return;
    }
    /* ② 歌曲列表 */
    var songs = musicData.songs || [];
    if (!songs.length) {
      pauseAudio();
      body.innerHTML = '<p class="hud-left__todo">还没接播放器。<br>' +
        '在 <code>hugo.toml</code> 里给 <code>hudMusicSongs</code> 填网易云的歌曲 ID,<br>' +
        '或者给 <code>hudMusicEmbed</code> 填一条嵌入地址:<br>' +
        '<code>//music.163.com/outchain/player?type=2&id=歌曲ID&auto=0&height=66</code></p>';
      return;
    }
    if (musicPick >= songs.length) musicPick = 0;
    var cur = songs[musicPick] || {};
    /* ★ 换歌才动 src:同一首就不碰它(否则每次开面板都会从头开始) */
    if (audioEl.dataset.song !== String(cur.id)) {
      audioEl.dataset.song = String(cur.id);
      if (cur.direct) {
        audioEl.src = "//music.163.com/song/media/outer/url?id=" + cur.id + ".mp3";
      } else {
        pauseAudio();
        audioEl.removeAttribute("src");
      }
    }
    var rows = songs.map(function (s, i) {
      return '<button type="button" class="hud-plist__row' + (i === musicPick ? " is-on" : "") +
        '" data-hud-song="' + i + '" aria-pressed="' + (i === musicPick) + '">' +
        '<span class="hud-plist__name">' + esc(s.name || ("歌曲 " + (i + 1))) + '</span>' +
        '<span class="hud-plist__meta">' + esc(s.artist || "") + '</span></button>';
    }).join("");
    body.innerHTML = playerFor(cur) +
      '<p class="hud-plist__hint">歌单</p>' +
      '<div class="hud-plist">' + rows + '</div>';
    wireAudio();
  }

  function pauseAudio() {
    try { audioEl.pause(); } catch (e) { }
    var btn = document.getElementById("hud-player-btn");
    if (btn) btn.classList.remove("is-playing");
    var m = document.querySelector('[data-hud-pen], [data-hud-mod="music"]');
    if (m) m.classList.remove("is-playing");
  }

  /* ★★★ 音量(用户第五轮:"不能通过右下角那个音量滑块控制音量大小"):
     —— 网易云的【跨域 iframe】里那个播放器,外面一行 JS 都碰不到它 ✗
        (浏览器同源策略,没有 API 能改它的音量)。
     —— 所以:有直链的歌用【我们自己的 <audio>】播 ⇒ 音量就归右下角那条滑块管了
        (它写的是 cd-audio-vol,同时会派发 hud-volume 事件,见 page-hud.js);
        没直链的(网易云只给 VIP/版权限制的)才退回嵌入式播放器,
        并且在那块面板上写清楚"音量用它自己的" —— 不装作能控。 */
  function playerFor(s) {
    if (s.direct) {
      return '<div class="hud-player">' +
        '<button class="hud-player__btn" type="button" id="hud-player-btn" aria-label="播放或暂停">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path class="hud-player__icon" d="M8 5v14l11-7z"></path></svg></button>' +
        '<div class="hud-player__meta"><b>' + esc(s.name || "") + '</b>' +
        '<span>' + esc(s.artist || "") + '</span></div>' +
        '<span class="hud-player__time" id="hud-player-time">0:00</span>' +
        '<span class="hud-player__track"><i id="hud-player-fill"></i></span>' +
        '</div>';
    }
    return musicFrame("//music.163.com/outchain/player?type=2&id=" + s.id + "&auto=0&height=66", 86) +
      '<p class="hud-plist__note">这首网易云只给嵌入式播放器(没有直链)⇒ 音量用它自己的。</p>';
  }

  /* 音量:开局读一次、之后跟着右下角那条滑块的事件走 */
  function applyVolume(a) {
    var v = NaN;
    try { v = parseFloat(localStorage.getItem("cd-audio-vol")); } catch (e) { }
    if (!isFinite(v)) v = 0.5;
    try { a.volume = Math.min(1, Math.max(0, v)); } catch (e) { }
  }

  function wireAudio() {
    /* ★ 绑的是那颗【常驻】的 audioEl(不是面板里的节点)—— 面板重画不影响播放 */
    var a = audioEl;
    var btn = document.getElementById("hud-player-btn");
    var fill = document.getElementById("hud-player-fill");
    var timeEl = document.getElementById("hud-player-time");
    var musicBtn = document.querySelector('[data-hud-mod="music"]');
    var paint = function () {
      if (fill) fill.style.width = (a.duration ? (a.currentTime / a.duration * 100) : 0) + "%";
      if (timeEl) timeEl.textContent = fmtTime(a.currentTime);
    };
    window.__hudAudio = { el: a, paint: paint };
    applyVolume(a);
    paint();
    if (btn) {
      btn.classList.toggle("is-playing", !a.paused);
      btn.addEventListener("click", function () {
        if (a.paused) { var p = a.play(); if (p && p.catch) p.catch(function () { }); }
        else a.pause();
      });
    }
  }

  function fmtTime(sec) {
    if (!isFinite(sec)) return "0:00";
    var m = Math.floor(sec / 60), r = Math.floor(sec % 60);
    return m + ":" + (r < 10 ? "0" : "") + r;
  }

  /* 播放状态:面板里的按钮 + 模块按钮上的那排柱,两处一起亮 */
  function bindAudioOnce() {
    var a = audioEl;
    applyVolume(a);
    window.addEventListener("hud-volume", function (e) {
      var v = e && e.detail;
      if (a && isFinite(v)) { try { a.volume = Math.min(1, Math.max(0, v)); } catch (err) { } }
    });
    var setState = function (playing) {
      var m = document.querySelector('[data-hud-mod="music"]');
      if (m) m.classList.toggle("is-playing", playing);
      var btn = document.getElementById("hud-player-btn");
      if (btn) btn.classList.toggle("is-playing", playing);
    };
    a.addEventListener("play", function () { setState(true); });
    a.addEventListener("pause", function () { setState(false); });
    a.addEventListener("ended", function () { setState(false); });
    a.addEventListener("timeupdate", function () {
      var f = document.getElementById("hud-player-fill");
      var t = document.getElementById("hud-player-time");
      if (f) f.style.width = (a.duration ? (a.currentTime / a.duration * 100) : 0) + "%";
      if (t) t.textContent = fmtTime(a.currentTime);
    });
    /* ★ 直链不通(版权/VIP)⇒ 就地把这首换成网易云的嵌入式播放器,别留一块按不动的 UI */
    a.addEventListener("error", function () {
      if (!a.getAttribute("src")) return;
      var s = (musicData.songs || [])[musicPick];
      if (!s || current !== "music") return;
      var holder = body.querySelector(".hud-player");
      if (holder) holder.outerHTML = musicFrame(
        "//music.163.com/outchain/player?type=2&id=" + s.id + "&auto=0&height=66", 86) +
        '<p class="hud-plist__note">这首没有直链(网易云只给嵌入式播放器)⇒ 音量用它自己的。</p>';
    });
  }
  bindAudioOnce();

  function musicFrame(src, h) {
    /* ★ 不带 referrerpolicy:网易云的嵌入式播放器是认 referer 的,
       把 referer 抹掉反而可能被它拒(标准嵌入代码里也没有这一条)。 */
    return '<iframe class="hud-left__music" src="' + esc(src) + '" height="' + h +
      '" frameborder="no" border="0" marginwidth="0" marginheight="0" scrolling="no" ' +
      'allow="autoplay" title="网易云音乐"></iframe>';
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function open(key) {
    if (!MODS[key]) return;
    if (anim) { cancelAnimationFrame(anim); anim = 0; }   /* 收起演一半就再点开:停掉那一段 */
    current = key;
    titleEl.textContent = MODS[key].name;
    if (enEl) enEl.textContent = MODS[key].en;
    if (MODS[key].host === "timer") hostTimer();
    else if (MODS[key].music) renderMusic();
    else body.innerHTML = MODS[key].html || "";
    mods.forEach(function (b) {
      var on = b.getAttribute("data-hud-mod") === key;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    panel.hidden = false;                 /* 先露出来 */
    panel.classList.remove("is-still");   /* 展开过程中不挂阴影(每帧改高度时最费) */
    /* ★★ 顺序:先把内容渲染完(startModule 会画日历/时钟),再量高度演展开 ——
       上一版先量后渲染,量到的是"日历还没画出来"的矮高度,展开到一半就定住了。 */
    startModule(key);
    layout(true);                         /* ★ 传 true:从 0 长到内容高度(慢一点,460ms) */
    panel.classList.add("is-open");
    /* 图/字体/iframe 到位后再对齐一次(这次不演动画,直接定高) */
    requestAnimationFrame(function () { layout(false); });
  }

  function close() {
    if (!current) return;
    current = null;                        /* 先落状态:再点同一枚就是"重新投出来" */
    unhostTimer();
    stopModule();
    mods.forEach(function (b) { b.classList.remove("is-on"); b.setAttribute("aria-pressed", "false"); });
    panel.classList.remove("is-open");
    /* ★ 收拢:也走 unfold —— 它会【每帧重钉底边】,
       所以是"向上长出来的那一截,原路往下收回那条横线"(用户第三轮:
       "收起时应该向下收而不是向上收")。 */
    unfold(0, 380);
    /* 演完再 hidden:unfold 结束时高度就是 0,这里等它一拍 */
    var wait = function () {
      if (anim) { setTimeout(wait, 60); return; }
      panel.hidden = true;
      panel.classList.remove("is-still");
    };
    setTimeout(wait, 60);
  }

  function startModule(key) {
    stopModule();
    if (key === "time") {
      tickClock();
      clockTimer = setInterval(tickClock, 1000);
      renderCalendar();
    } else if (key === "note") {
      var ta = document.getElementById("hud-left-note");
      if (!ta) return;
      try { ta.value = localStorage.getItem("hud-note") || ""; } catch (e) { }
      ta.addEventListener("input", function () {
        try { localStorage.setItem("hud-note", ta.value); } catch (e) { }
      });
    }
  }

  function stopModule() {
    if (clockTimer) { clearInterval(clockTimer); clockTimer = 0; }
  }

  function tickClock() {
    var el = document.getElementById("hud-left-clock");
    var d = document.getElementById("hud-left-date");
    if (!el) { stopModule(); return; }
    var now = new Date();
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    el.textContent = p(now.getHours()) + ":" + p(now.getMinutes()) + ":" + p(now.getSeconds());
    if (d) {
      d.textContent = now.getFullYear() + " 年 " + (now.getMonth() + 1) + " 月 " + now.getDate() +
        " 日 · 周" + "日一二三四五六"[now.getDay()];
    }
  }

  function renderCalendar() {
    var box = document.getElementById("hud-left-cal");
    if (!box) return;
    var now = new Date();
    if (!calMonth) calMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    var y = calMonth.getFullYear(), m = calMonth.getMonth();
    var first = new Date(y, m, 1).getDay();
    var days = new Date(y, m + 1, 0).getDate();
    var out = '<div class="hud-left__calhead"><button type="button" data-cal="-1" aria-label="上个月">‹</button>' +
      '<span>' + y + " 年 " + (m + 1) + ' 月</span>' +
      '<button type="button" data-cal="1" aria-label="下个月">›</button></div><div class="hud-left__calgrid">';
    ["日", "一", "二", "三", "四", "五", "六"].forEach(function (w) { out += '<i class="w">' + w + "</i>"; });
    for (var i = 0; i < first; i++) out += "<i></i>";
    for (var d = 1; d <= days; d++) {
      var today = (y === now.getFullYear() && m === now.getMonth() && d === now.getDate());
      out += "<i" + (today ? ' class="today"' : "") + ">" + d + "</i>";
    }
    box.innerHTML = out + "</div>";
  }

  /* ---------- 事件 ---------- */
  root.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-hud-mod]") : null;
    if (!b) return;
    e.preventDefault();
    var key = b.getAttribute("data-hud-mod");
    if (current === key) close(); else open(key);      /* 再点一下收回 */
  });

  body.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-cal]") : null;
    if (b && calMonth) {
      e.preventDefault();
      calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + Number(b.getAttribute("data-cal")), 1);
      renderCalendar();
      return;
    }
    /* 歌单列表:点一行就换成那一首 */
    var row = e.target.closest ? e.target.closest("[data-hud-song]") : null;
    if (row) {
      e.preventDefault();
      musicPick = Number(row.getAttribute("data-hud-song")) || 0;
      renderMusic();
      layout(false);
      return;
    }
  });

  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && current) close(); });

  window.addEventListener("resize", function () { layout(false); });
  if (window.ResizeObserver) {
    try { new ResizeObserver(function () { layout(false); }).observe(main); } catch (e) { }
  }
  /* ★ 开页面就把那条横线摆好(idle 时它是可见的收起态) */
  layout(false);

  /* 排障出口 */
  window.__hudLeft = {
    mods: mods.map(function (b) { return b.getAttribute("data-hud-mod"); }),
    open: function () { return current; },
    layout: function () { return last; },
    relayout: function () { layout(); return last; },
    hex: hexPoints,
    openKey: open,
    close: close
  };
})();
