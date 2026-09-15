/* ============================================================
   第四张盘「技术」:故障光盘 = 一台紧急恢复终端
   ─────────────────────────────────────────────────────────────
   背景设定(整段逻辑都围着它转):
     · 这是 CD 的镜像,盘面标签印错 → 固件拒绝按普通介质挂载
     · 只挂上了一个只读的 iso9660 会话,挂在 /mnt/cdrom
     · 当前身份是 emergency 用户(没有 root),所以 /bin /etc 读不动
     · 盘上有坏扇区:02_vllm_DCU_optimize 的 README.md 读不出来,
       要用自定义指令 recover <文件夹> 重建后才能看

   这个文件里有三块:
     ① FS      —— 文件树 + 每个节点的"读得出来吗"(ok/denied/eio/bad)
     ② 输出层  —— 逐行打印 / 打字机 / 进度条 / 故障爆发
     ③ 指令层  —— Linux 指令(大多会报错)+ recover 工具
   盘里的真实文件在 static/assets/cd/tech/(fetch 按需取),要改项目简介改那边。

   接入点:见 intro.js —— 开机动画放完会派发 cd-boot-done,
          本文件收到后开始打第二页日志(见 bootSequence)。
   ============================================================ */
(function () {
  "use strict";

  var root = document.getElementById("cd4-term");
  if (!root) return;
  var screen = document.getElementById("cd4-screen");
  var tear = document.getElementById("cd4-tear");
  var live = document.getElementById("cd4-live");
  var panel = root.closest(".intro-panel");
  var CD = (root.getAttribute("data-term-cd") || "/assets/cd/tech").replace(/\/$/, "");

  /* ============================================================
     ① 文件树
     read: 'ok' 读得到 | 'denied' 没权限 | 'eio' 读取错误
           'bad' 坏扇区(recover 之后变成 ok)| 'missing' 文件不存在
     file: static/assets/cd/tech/ 下的相对路径(fetch 取)
     text: 直接写在代码里的小文件
     ============================================================ */
  function D(read, children, note) { return { d: true, read: read || "ok", ch: children || {}, note: note || "" }; }
  function T(read, text, note) { return { read: read, text: text, note: note || "" }; }
  function F(read, file, note) { return { read: read, file: file, note: note || "" }; }

  var FS = D("ok", {
    bin: D("denied", {
      busybox: F("denied"), mount: F("denied"), cat: F("denied")
    }, "紧急模式自带的最小工具集"),
    etc: D("denied", {
      fstab: F("denied")
    }),
    home: D("ok", {
      emergency: D("ok", {
        ".bash_history": T("ok",
          "ls /mnt/cdrom\n" +
          "cat /mnt/cdrom/INDEX\n" +
          "mount -o remount,rw /mnt/cdrom\n" +
          "dd if=/dev/sr0 of=/mnt/cdrom/recovered/fragment_001.bin bs=512\n" +
          "recover --list\n" +
          "# 02 那个目录还是读不出来\n" +
          "recover 02_vllm_DCU_optimize\n"),
        ".profile": T("ok",
          "# ~/.profile — emergency session\n" +
          "export PS1='\\u@\\h:\\w\\$ '\n" +
          "export PATH=/bin:/sbin\n" +
          "alias ll='ls -l'\n" +
          "# 这台机器是只读的:别想着改 /etc 下的东西\n")
      })
    }),
    mnt: D("ok", {
      cdrom: D("ok", {
        INDEX: T("ok", null, "由 recover 工具现场生成"),   /* 内容动态生成,见 indexText() */
        "README.txt": F("ok", "README.txt"),
        "MANIFEST.sha256": F("ok", "MANIFEST.sha256"),
        projects: D("ok", {
          "00_tuagfey-blog": D("ok", {
            "README.md": F("ok", "projects/00_tuagfey-blog/README.md"),
            "manifest.json": F("missing"),          /* 归档时就丢了 */
            "launch.sh": F("ok", "projects/00_tuagfey-blog/launch.sh"),
            preview: D("ok", {}),
            src: D("eio", {}, "目录项还在,数据读不出来")
          }),
          "01_ROMS": D("ok", {
            "README.md": F("ok", "projects/01_ROMS/README.md"),
            "manifest.json": F("ok", "projects/01_ROMS/manifest.json"),
            "launch.sh": F("ok", "projects/01_ROMS/launch.sh")
          }),
          "02_vllm_DCU_optimize": D("ok", {
            "README.md": F("bad", "projects/02_vllm_DCU_optimize/README.md"),
            "manifest.json": F("ok", "projects/02_vllm_DCU_optimize/manifest.json"),
            "launch.sh": F("eio"),
            src: D("eio", {})
          })
        }),
        recovered: D("ok", {
          "fragment_001.bin": F("ok", "recovered/fragment_001.bin", "坏扇区附近抠出来的碎片")
        })
      })
    }),
    var: D("ok", {
      log: D("ok", {
        "boot.log": F("eio"),
        "disk_scan.log": T("ok",
          "[    1.031220] sr0: starting scan (session 1/2)\n" +
          "[    1.204881] sr0: TOC ok, 2 sessions, iso9660\n" +
          "[    1.662004] sr0: reading session 2 ...\n" +
          "[    2.108773] sr0: unrecovered read error at sector 0x1a3f\n" +
          "[    2.109101] sr0: scan aborted — medium error\n"),
        "emergency.log": T("ok",
          "[recover] Received fatal error, trying detecting...\n" +
          "[recover] Medium error detected on /dev/sr0.\n" +
          "[recover] Archive mounted read-only at /mnt/cdrom.\n" +
          "[recover] Automatic index failed. Manual recovery required.\n")
      })
    })
  });

  /* 项目表:INDEX / recover --list / 恢复状态都以它为准(以后加项目只改这里) */
  var PROJECTS = [
    { id: "00", dir: "00_tuagfey-blog", title: "Tuagfey Blog", size: 1104 },
    { id: "01", dir: "01_ROMS", title: "ROMS-CoSiNE 限定环境优化", size: 1473 },
    { id: "02", dir: "02_vllm_DCU_optimize", title: "Qwen3.5-27B × 海光 DCU × vLLM", size: 6131, bad: true, sectors: ["0x1a3f", "0x1a40", "0x1b02"] }
  ];
  var recovered = {};                    /* dir → true(本次会话里恢复过的)*/

  function projOf(dir) {
    /* 容忍这几种写法:02_vllm_DCU_optimize / 02_vllm_DCU_optimize/ /
       projects/02_vllm_DCU_optimize / /mnt/cdrom/projects/02_vllm_DCU_optimize */
    var name = String(dir || "").replace(/\/+$/, "").split("/").pop();
    for (var i = 0; i < PROJECTS.length; i++) if (PROJECTS[i].dir === name) return PROJECTS[i];
    return null;
  }
  function projStatus(p) {
    if (!p.bad) return "OK";
    return recovered[p.dir] ? "RECOVERED" : "BAD SECTORS";
  }

  /* INDEX 是现场生成的:恢复过谁,这里就是什么状态(与 recover 同一份真相)*/
  function indexText() {
    var out = [
      "GLITCH ARCHIVE - RECOVERY INDEX",
      "Volume: GLITCH_ARCHIVE",
      "Mount:  /mnt/cdrom",
      "Status: " + (countBad() ? "DEGRADED" : "REPAIRED"),
      "Projects: /mnt/cdrom/projects",
      ""
    ];
    PROJECTS.forEach(function (p) {
      out.push("[" + p.id + "] projects/" + pad(p.dir, 26) + " " + projStatus(p));
    });
    out.push("");
    out.push("Note:");
    out.push("  BAD SECTORS 的条目不能直接读取。");
    out.push("  用 recover <folder> 尝试重建该目录的索引与首文件。");
    out.push("");
    out.push("  recover --list      列出全部条目与状态");
    out.push("  recover <folder>    对单个项目做恢复");
    out.push("  help                查看可用指令");
    return out.join("\n");
  }
  function countBad() {
    var n = 0;
    PROJECTS.forEach(function (p) { if (p.bad && !recovered[p.dir]) n++; });
    return n;
  }
  function pad(s, n) { s = String(s); while (s.length < n) s += " "; return s; }

  /* 几个文件的大小(ls -l 用):不 fetch 也能显示得像样 */
  var SIZES = {
    "/mnt/cdrom/README.txt": 1057,
    "/mnt/cdrom/MANIFEST.sha256": 1290,
    "/mnt/cdrom/projects/00_tuagfey-blog/README.md": 1104,
    "/mnt/cdrom/projects/00_tuagfey-blog/launch.sh": 473,
    "/mnt/cdrom/projects/01_ROMS/README.md": 1473,
    "/mnt/cdrom/projects/01_ROMS/manifest.json": 410,
    "/mnt/cdrom/projects/01_ROMS/launch.sh": 473,
    "/mnt/cdrom/projects/02_vllm_DCU_optimize/README.md": 6131,
    "/mnt/cdrom/projects/02_vllm_DCU_optimize/manifest.json": 499,
    "/mnt/cdrom/recovered/fragment_001.bin": 4096
  };
  /* 二进制文件:cat 会吐乱码,用 strings 才看得到里面的串 */
  var BIN = { "/mnt/cdrom/recovered/fragment_001.bin": true };

  /* ============================================================
     ② 输出层
     ============================================================ */
  var epoch = 0;                 /* 每次 reset 自增:旧的异步流程会自己停手 */
  var inputEl = null;            /* 当前输入行(永远是"可输入"的那一行)*/
  var curInput = "";
  var hist = [], histIdx = -1;
  var cwd = "/home/emergency";
  var busy = false;              /* 正在跑指令(这段时间不吃键盘)*/
  var unkCount = 0;              /* 乱输指令的次数:够了就给提示 */
  var stick = true;              /* 自动滚到底(用户往上翻就停)*/

  function esc(s) {
    return String(s === null || s === undefined ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function seg(t, cls) { return '<span class="' + cls + '">' + esc(t) + "</span>"; }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  /* 真实程序不是匀速打印的:
       多数行之间很快、偶尔卡一下(在读盘/重试)、偶尔连着蹦两行。
     用带重尾的随机,而不是均匀分布 —— 这就是"正常程序运行"的节奏。*/
  function pace(fast, slow) {
    var r = Math.random();
    if (r < 0.13) return rnd(slow * 1.6, slow * 4.4);   /* 卡一下:多半是在读坏道 */
    if (r < 0.36) return rnd(40, fast * 0.75);          /* 连着蹦两行 */
    return rnd(fast, slow);
  }

  function scrollDown() {
    if (stick) screen.scrollTop = screen.scrollHeight;
  }
  screen.addEventListener("scroll", function () {
    stick = screen.scrollHeight - screen.scrollTop - screen.clientHeight < 28;
  });

  /* 写一行(插在当前输入行之前)*/
  function write(html, cls) {
    var d = document.createElement("div");
    d.className = "t-ln" + (cls ? " " + cls : "");
    d.innerHTML = html;
    if (inputEl && inputEl.parentNode === screen) screen.insertBefore(d, inputEl);
    else screen.appendChild(d);
    scrollDown();
    trim();
    return d;
  }
  /* 写在最底下(开机引导那种"抢在提示符后面打印"的行)*/
  function writeAfter(html, cls) {
    var d = document.createElement("div");
    d.className = "t-ln" + (cls ? " " + cls : "");
    d.innerHTML = html;
    screen.appendChild(d);
    scrollDown();
    trim();
    return d;
  }
  function blank() { return write("&nbsp;"); }

  /* 回滚上限:太长的历史就不留了(终端也不留无限行)*/
  var MAX_LINES = 900;
  function trim() {
    while (screen.childNodes.length > MAX_LINES) screen.removeChild(screen.firstChild);
  }

  /* 一行一行地打(内核日志就是这种节奏;行与行之间的间隔由 pace() 给,不匀速)*/
  function writeSeq(items, myEpoch) {
    var i = 0;
    return new Promise(function (done) {
      (function step() {
        if (myEpoch !== epoch) return done();
        if (i >= items.length) return done();
        var it = items[i++];
        write(it.h, it.c);
        var d = it.d === undefined ? pace(150, 460) : it.d;
        setTimeout(step, d);
      })();
    });
  }

  /* 打字机:一个字符一个字符,而且字符之间也不是匀速(标点后多停一下)*/
  function typeLine(text, cls, speed, myEpoch) {
    var d = write("", cls);
    return new Promise(function (done) {
      var i = 0;
      (function step() {
        if (myEpoch !== epoch) return done();
        d.textContent = text.slice(0, i);
        scrollDown();
        if (i++ >= text.length) return done();
        var ch = text.charAt(i - 1);
        var ms = speed ? speed * rnd(0.6, 1.6) : rnd(26, 58);
        if (/[,.:;]/.test(ch)) ms += rnd(60, 190);
        setTimeout(step, ms);
      })();
    });
  }

  /* 原地刷新的一行(进度条)*/
  function liveLine() {
    var d = write("");
    return function (text, cls) {
      d.className = "t-ln" + (cls ? " " + cls : "");
      d.textContent = text;
      scrollDown();
    };
  }

  /* 故障爆发:撕裂条 + RGB 分离抖动 + 随机把某一行弄成乱码 */
  var GARBLE = "▓▒░#@%&$*!?/\\|<>~^¤§µ¶·¸";
  function glitchBurst(ms, myEpoch) {
    ms = ms || 420;
    root.classList.add("is-glitching");
    if (tear) {
      tear.style.top = Math.round(rnd(18, 74)) + "%";
      tear.classList.remove("is-on");
      void tear.offsetWidth;
      tear.classList.add("is-on");
    }
    /* 挑一行把字符换掉,过一会儿再换回来 */
    var pool = Array.prototype.filter.call(screen.children, function (n) { return n !== inputEl; });
    var victim = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    var saved = victim ? victim.innerHTML : "";
    if (victim) {
      victim.textContent = String(victim.textContent).replace(/\S/g, function () {
        return GARBLE[Math.floor(Math.random() * GARBLE.length)];
      });
    }
    setTimeout(function () {
      if (myEpoch !== undefined && myEpoch !== epoch) return;
      if (victim && victim.parentNode) victim.innerHTML = saved;
    }, Math.min(160, ms * 0.45));
    setTimeout(function () {
      if (myEpoch !== undefined && myEpoch !== epoch) return;
      root.classList.remove("is-glitching");
      if (tear) tear.classList.remove("is-on");
    }, ms);
  }

  /* 环境光故障:开机完事后偶尔来一下(不打扰输入)*/
  function ambientGlitch(myEpoch) {
    setTimeout(function () {
      if (myEpoch !== epoch) return;
      if (!busy && !document.hidden) glitchBurst(320, myEpoch);
      ambientGlitch(myEpoch);
    }, rnd(9000, 17000));
  }

  /* ============================================================
     路径与文件
     ============================================================ */
  function norm(p, base) {
    if (!p) p = ".";
    var abs = p.charAt(0) === "/" ? p : (base === "/" ? "/" + p : base + "/" + p);
    var parts = abs.split("/"), out = [];
    for (var i = 0; i < parts.length; i++) {
      var s = parts[i];
      if (!s || s === ".") continue;
      if (s === "..") { out.pop(); continue; }
      out.push(s);
    }
    return "/" + out.join("/");
  }
  function nodeAt(path) {
    if (path === "/") return FS;
    var parts = path.split("/").slice(1), n = FS;
    for (var i = 0; i < parts.length; i++) {
      if (!n || !n.ch) return null;
      n = n.ch[parts[i]];
      if (!n) return null;
    }
    return n;
  }
  function pretty(p) { return p === "/home/emergency" ? "~" : p; }
  function shortName(p) { var a = p.split("/"); return a[a.length - 1] || "/"; }

  /* 取文件内容(带缓存);读不出来的按策略直接抛错,不去 fetch */
  var cache = {};
  function readNode(path, node) {
    var r = node.read;
    if (node.d) return Promise.reject({ kind: "isdir" });
    if (r === "denied") return Promise.reject({ kind: "denied" });
    if (r === "eio") return Promise.reject({ kind: "eio" });
    if (r === "bad") {
      var pr = projOf(path.split("/").slice(-2)[0] || "");
      if (!(pr && recovered[pr.dir])) return Promise.reject({ kind: "bad", proj: pr });
    }
    if (r === "missing") return Promise.reject({ kind: "missing" });
    if (path === "/mnt/cdrom/INDEX") {
      var ix = indexText();
      return Promise.resolve({ text: ix, bytes: new TextEncoder().encode(ix) });
    }
    if (cache[path]) return Promise.resolve(cache[path]);
    if (node.text != null) {
      var t = node.text;
      return Promise.resolve((cache[path] = { text: t, bytes: new TextEncoder().encode(t) }));
    }
    return fetch(CD + "/" + node.file, { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw { kind: "eio" };
      return res.arrayBuffer();
    }).then(function (buf) {
      var bytes = new Uint8Array(buf);
      var text = new TextDecoder("utf-8").decode(bytes);
      return (cache[path] = { text: text, bytes: bytes, isBinary: !!BIN[path] });
    }).catch(function (e) {
      if (e && e.kind) throw e;
      throw { kind: "eio" };
    });
  }
  function errLine(path, e) {
    var k = e && e.kind;
    if (k === "isdir") return [E("cat: " + path + ": Is a directory")];
    if (k === "denied") return [E("cat: " + path + ": Permission denied")];
    if (k === "missing") return [E("cat: " + path + ": No such file or directory")];
    if (k === "bad") {
      var hint = e.proj ? " (bad sector — 试:recover " + e.proj.dir + ")" : "";
      return [E("cat: " + path + ": Input/output error"), H("[recover] 这个扇区读不出来" + hint)];
    }
    return [E("cat: " + path + ": Input/output error")];
  }
  function E(s) { return { h: esc(s), c: "is-err" }; }
  function H(s) { return { h: seg(s, "c-mag"), c: null }; }
  function DIM(s) { return { h: seg(s, "c-dim") }; }
  function OK(s) { return { h: seg(s, "c-ok") }; }

  /* ============================================================
     ③ 指令层
     ============================================================ */
  var CMDS = {};

  CMDS.help = function () {
    return [
      { h: seg("GLITCH ARCHIVE — emergency shell 1.4", "c-hi") },
      { h: seg("可用指令:", "c-dim") },
      { h: "  ls  cd  pwd  cat  less  find  grep      " + seg("文件与目录", "c-dim") },
      { h: "  mount  blkid  lsblk                     " + seg("设备与挂载", "c-dim") },
      { h: "  dmesg  journalctl                        " + seg("日志(多半读不出来)", "c-dim") },
      { h: "  sha256sum  dd  file  strings             " + seg("读盘工具", "c-dim") },
      { h: "  clear  history  exit                     " + seg("会话", "c-dim") },
      { h: "  whoami  id  uname  date  echo            " + seg("看看自己在哪", "c-dim") },
      { h: "  ↑ ↓ 翻历史  Ctrl+Shift+C 中断  Ctrl+Shift+L 清屏", c: "is-dim" },
      { h: seg("  recover [--list|<项目>]", "c-ok") + "                   " + seg("★ 恢复工具(这张盘的全部意义)", "c-dim") },
      { h: "&nbsp;" },
      H("[recover] 不知道从哪开始就打:cat /mnt/cdrom/INDEX")
    ];
  };

  CMDS.pwd = function () { return [esc(cwd)]; };

  CMDS.whoami = function () { return ["emergency"]; };
  CMDS.id = function () { return ["uid=1000(emergency) gid=1000(emergency) groups=1000(emergency)"]; };
  CMDS.hostname = function () { return ["recovery"]; };
  CMDS.uname = function (a) {
    if (a.indexOf("-a") >= 0) return ["Linux recovery 6.6.0-recovery #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux"];
    return ["Linux"];
  };
  CMDS.date = function () {
    return [new Date().toString().replace(/GMT.*/, "UTC") + "   " + seg("(时钟不准:介质故障后 RTC 没同步)", "c-dim")];
  };
  CMDS.echo = function (a) { return [esc(a.join(" "))]; };
  CMDS.history = function () {
    if (!hist.length) return [DIM("(空)")];
    return hist.map(function (h, i) { return seg(pad(String(i + 1), 5), "c-dim") + "  " + esc(h); });
  };
  CMDS.clear = function () {
    while (screen.firstChild) screen.removeChild(screen.firstChild);
    inputEl = null;
    return null;                       /* 不打印任何东西 */
  };
  CMDS.less = function (a) {
    if (!a.length) return [E("usage: less <file>")];
    return CMDS.cat(a);
  };

  CMDS.cat = function (a) {
    if (!a.length) return [E("cat: 缺少操作数")];
    return Promise.all(a.map(function (arg) {
      var p = norm(arg, cwd), n = nodeAt(p);
      if (!n) return [E("cat: " + arg + ": No such file or directory")];
      if (n.d) return [E("cat: " + arg + ": Is a directory")];
      return readNode(p, n).then(function (f) {
        if (f.isBinary) {
          var dec = new TextDecoder("latin1").decode(f.bytes.slice(0, 640));
          return [{ h: seg(dec, "c-mag") }, DIM("… (二进制输出已截断:共 " + f.bytes.length + " 字节,用 strings 看)")];
        }
        var out = f.text.split(/\r?\n/);
        if (out.length && out[out.length - 1] === "") out.pop();
        return out.length ? out.map(function (l) { return esc(l) || "&nbsp;"; }) : [DIM("(空文件)")];
      }).catch(function (e) { return errLine(arg, e); });
    })).then(function (groups) {
      var out = [];
      groups.forEach(function (g) { g.forEach(function (l) { out.push(l); }); });
      return out;
    });
  };

  CMDS.cd = function (a) {
    var target = a.length ? a[0] : "/home/emergency";
    var p = norm(target, cwd), n = nodeAt(p);
    if (!n) return [E("bash: cd: " + target + ": No such file or directory")];
    if (!n.d) return [E("bash: cd: " + target + ": Not a directory")];
    if (n.read === "denied") return [E("bash: cd: " + target + ": Permission denied")];
    if (n.read === "eio") return [E("bash: cd: " + target + ": Input/output error")];
    cwd = p;
    return null;
  };

  CMDS.ls = function (a) {
    var long = false, all = false, rest = [];
    a.forEach(function (x) {
      if (x === "-l" || x === "-la" || x === "-al") { long = true; if (x !== "-l") all = true; }
      else if (x === "-a") all = true;
      else rest.push(x);
    });
    var p = norm(rest[0] || ".", cwd), n = nodeAt(p);
    if (!n) return [E("ls: cannot access '" + (rest[0] || p) + "': No such file or directory")];
    if (!n.d) return [long ? esc(modeOf(n) + "  " + sizeOf(n, p) + "  " + shortName(p)) : esc(shortName(p))];
    if (n.read === "denied") return [E("ls: cannot open directory '" + (rest[0] || p) + "': Permission denied")];
    if (n.read === "eio") return [E("ls: reading directory '" + (rest[0] || p) + "': Input/output error")];
    var names = Object.keys(n.ch).filter(function (k) { return all || k.charAt(0) !== "."; });
    if (!names.length) return [DIM("(空)")];
    if (!long) return [names.map(function (k) {
      var c = n.ch[k];
      return (c.d ? seg(k, "c-path") : esc(k));
    }).join("   ")];
    var out = [seg("total " + names.length, "c-dim")];
    names.forEach(function (k) {
      var c = n.ch[k];
      out.push(esc(modeOf(c)) + "  emergency emergency " + pad(sizeOf(c, p + "/" + k), 7) + "  " +
        (c.d ? seg(k, "c-path") : esc(k)));
    });
    return out;
  };
  function modeOf(n) {
    if (n.d) return n.read === "denied" ? "dr-x------" : "dr-xr-xr-x";
    if (n.read === "denied") return "-r--------";
    return "-r--r--r--";
  }
  function sizeOf(n, p) {
    if (n.d) return "4096";
    if (p === "/mnt/cdrom/INDEX") return String(new TextEncoder().encode(indexText()).length);
    if (SIZES[p] !== undefined) return String(SIZES[p]);
    if (n.text != null) return String(new TextEncoder().encode(n.text).length);
    return "512";
  }

  CMDS.find = function (a) {
    var start = "/mnt/cdrom";
    a.forEach(function (x) { if (x.charAt(0) === "/") start = x; });
    if (start === "/") return [E("find: '/': Permission denied")];
    var p = norm(start, cwd), n = nodeAt(p);
    if (!n) return [E("find: '" + start + "': No such file or directory")];
    var out = [{ h: seg(p, "c-path") }];
    (function walk(cur, node) {
      if (!node.ch) return;
      Object.keys(node.ch).forEach(function (k) {
        var c = node.ch[k], cp = cur + "/" + k;
        if (node.read === "eio" || c.read === "eio") {
          out.push({ h: seg(cp, "c-path") + "  " + seg("Input/output error", "c-err") });
          return;
        }
        out.push({ h: seg(cp, "c-path") + (c.d ? "" : "") });
        if (c.d) walk(cp, c);
      });
    })(p, n);
    out.push(DIM("find: 完成(读不出来的目录已跳过)"));
    return out;
  };

  CMDS.grep = function (a) {
    var ci = false, rest = [];
    a.forEach(function (x) { if (x === "-i") ci = true; else rest.push(x); });
    if (rest.length < 2) return [E("usage: grep [-i] <模式> <文件>")];
    var pat = rest[0], target = rest[1];
    var p = norm(target, cwd), n = nodeAt(p);
    if (!n) return [E("grep: " + target + ": No such file or directory")];
    if (n.d) {
      var hits = [];
      (function walk(cur, node) {
        if (!node.ch) return;
        Object.keys(node.ch).forEach(function (k) {
          var c = node.ch[k], cp = cur + "/" + k;
          if (c.d) return walk(cp, c);
          if (c.read !== "ok" && c.read !== "bad") return;
          hits.push(cp);
        });
      })(p, n);
      return Promise.all(hits.slice(0, 12).map(function (fp) { return grepOne(fp, nodeAt(fp), pat, ci); }))
        .then(function (groups) {
          var out = [];
          groups.forEach(function (g) { g.forEach(function (l) { out.push(l); }); });
          out.push(out.length ? DIM("grep: 只搜了 " + Math.min(12, hits.length) + " 个可读文件") : DIM("grep: 没有匹配"));
          return out;
        });
    }
    return grepOne(p, n, pat, ci);
  };
  function grepOne(p, n, pat, ci) {
    return readNode(p, n).then(function (f) {
      if (f.isBinary) return [];
      var lines = f.text.split(/\r?\n/), out = [];
      lines.forEach(function (l, i) {
        var hay = ci ? l.toLowerCase() : l, needle = ci ? pat.toLowerCase() : pat;
        if (hay.indexOf(needle) >= 0) {
          out.push(seg(p + ":", "c-path") + seg(String(i + 1), "c-num") + ":" + esc(l));
        }
      });
      return out;
    }).catch(function (e) { return errLine(p, e); });
  }

  CMDS.mount = function (a) {
    if (a.join(" ").indexOf("remount") >= 0) {
      return [E("mount: /mnt/cdrom: cannot remount read-write: Permission denied."),
              H("[recover] 这张盘是只读挂载的;emergency 用户也没有权限改挂载标志。")];
    }
    return [
      "sysfs on /sys type sysfs (ro,nosuid,nodev,noexec)",
      "proc on /proc type proc (ro,nosuid,nodev,noexec)",
      "devtmpfs on /dev type devtmpfs (rw,nosuid,size=4096k)",
      seg("/dev/sr0 on /mnt/cdrom type iso9660 (ro,relatime,norock,check=r)", "c-hi"),
      DIM("(没有别的了:根文件系统还在 initramfs 里)")
    ];
  };

  CMDS.blkid = function () {
    return [
      seg("/dev/sr0:", "c-hi") + ' LABEL="WRONG_LABEL" UUID="2026-04-01-13-37-00-00" TYPE="iso9660"',
      "/dev/sda1: LABEL=\"RECOVERY\" UUID=\"7c9e-1f2a\" TYPE=\"vfat\" PARTUUID=\"0000a1b2-01\"",
      { h: seg("blkid: /dev/sr0: 卷标与目录里的 GLITCH_ARCHIVE 不一致", "c-err") }
    ];
  };

  CMDS.lsblk = function () {
    return [
      "NAME   MAJ:MIN RM   SIZE RO TYPE MOUNTPOINTS",
      "sda      8:0    0    16G  0 disk ",
      "└─sda1   8:1    0    16G  0 part /",
      seg("sr0     11:0    1   2.1G  1 rom  /mnt/cdrom", "c-hi"),
      DIM("(sr0 是只读的,而且已经报了介质错误)")
    ];
  };

  CMDS.dmesg = function () {
    return [E("dmesg: read kernel buffer failed: Operation not permitted"),
            H("[recover] 需要 root 才能读内核环形缓冲区。试着 cat /var/log/disk_scan.log")];
  };

  CMDS.journalctl = function () {
    return [
      E("Failed to open /var/log/journal: Input/output error"),
      "No journal files were found.",
      H("[recover] journal 也没了。这里能看的只有 /var/log 下那几个纯文本日志。")
    ];
  };

  CMDS.systemctl = function (a) {
    return [E("Failed to connect to bus: No such file or directory"),
            H("[recover] 紧急模式里没有 init/DBus,'systemctl " + esc(a.join(" ")) + "' 用不了。")];
  };

  CMDS.su = function () { return [E("su: must be suid to work properly")]; };
  CMDS.sudo = function () { return [E("-bash: sudo: command not found")]; };

  CMDS.file = function (a) {
    if (!a.length) return [E("usage: file <文件>")];
    var p = norm(a[0], cwd), n = nodeAt(p);
    if (!n) return [E("file: cannot open `" + a[0] + "' (No such file or directory)")];
    if (n.read === "denied") return [E("file: cannot open `" + a[0] + "' (Permission denied)")];
    if (n.read === "eio" || n.read === "bad") return [E("file: cannot open `" + a[0] + "' (Input/output error)")];
    return [E("file: could not find any valid magic files!")];
  };

  CMDS.strings = function (a) {
    if (!a.length) return [E("usage: strings <文件>")];
    var p = norm(a[0], cwd), n = nodeAt(p);
    if (!n) return [E("strings: '" + a[0] + "': No such file or directory")];
    return readNode(p, n).then(function (f) {
      var txt = f.isBinary ? new TextDecoder("latin1").decode(f.bytes) : f.text;
      var found = txt.match(/[\x20-\x7e]{4,}/g) || [];
      if (!found.length) return [DIM("strings: 没找到可打印串")];
      var out = found.slice(0, 40).map(function (s) {
        return seg(String(txt.indexOf(s)).padStart(6, "0"), "c-dim") + "  " + esc(s);
      });
      if (found.length > 40) out.push(DIM("… 还有 " + (found.length - 40) + " 段"));
      return out;
    }).catch(function (e) { return errLine(a[0], e); });
  };

  CMDS.sha256sum = function (a) {
    if (!a.length) return [E("usage: sha256sum <文件>")];
    return Promise.all(a.map(function (arg) {
      var p = norm(arg, cwd), n = nodeAt(p);
      if (!n) return Promise.resolve(E("sha256sum: " + arg + ": No such file or directory"));
      return readNode(p, n).then(function (f) {
        if (!(window.crypto && crypto.subtle)) return E("sha256sum: " + arg + ": 无法计算(环境不支持)");
        return crypto.subtle.digest("SHA-256", f.bytes).then(function (h) {
          var hex = Array.prototype.map.call(new Uint8Array(h), function (b) {
            return ("0" + b.toString(16)).slice(-2);
          }).join("");
          return seg(hex, "c-hi") + "  " + esc(arg);
        });
      }).catch(function (e) {
        var k = e && e.kind;
        if (k === "denied") return E("sha256sum: " + arg + ": Permission denied");
        if (k === "missing") return E("sha256sum: " + arg + ": No such file or directory");
        return E("sha256sum: " + arg + ": Input/output error");
      });
    })).then(function (lines) { return lines; });
  };

  CMDS.dd = function (a) {
    var src = "", dst = "";
    a.forEach(function (x) {
      if (x.indexOf("if=") === 0) src = x.slice(3);
      if (x.indexOf("of=") === 0) dst = x.slice(3);
    });
    if (!src) return [E("dd: 缺少 if=<输入>"), DIM("例:dd if=/dev/sr0 of=/mnt/cdrom/recovered/fragment_001.bin bs=512")];
    if (src.indexOf("/dev/") === 0) return [E("dd: failed to open '" + src + "': Permission denied")];
    if (dst.indexOf("/mnt/cdrom") === 0) return [E("dd: failed to open '" + dst + "': Read-only file system")];
    if (!dst) return [E("dd: 缺少 of=<输出>")];
    return [E("dd: failed to open '" + dst + "': No such file or directory")];
  };

  CMDS.exit = function () {
    return [
      E("bash: exit: cannot exit the emergency shell (没有可以回去的 init)"),
      H("[recover] 想离开就输入 recover --list 或 cat /mnt/cdrom/INDEX。")
    ];
  };

  /* ---------- ★ recover:这不是 Linux 指令,是这张盘自己的恢复工具 ---------- */
  CMDS.recover = function (a, out) {
    var arg = (a[0] || "").replace(/\/+$/, "");
    if (!arg || arg === "-h" || arg === "--help") {
      return [
        { h: seg("recover — GLITCH ARCHIVE 恢复工具", "c-ok") },
        { h: seg("用法:", "c-dim") },
        "  recover --list            列出全部条目与状态",
        "  recover <项目文件夹>      对单个项目做恢复(重建索引 + 抢救首文件)",
        { h: "&nbsp;" },
        H("[recover] 坏扇区上的目录不会自动恢复:得你点名。")
      ];
    }
    if (arg === "--list" || arg === "-l" || arg === "list") {
      out.push({ h: seg("[recover] scanning /mnt/cdrom/projects ...", "c-dim") });
      return [
        { h: seg("[" + pad("ID", 4) + "] " + pad("目录", 28) + " 状态", "c-dim") }
      ].concat(PROJECTS.map(function (p) {
        var st = projStatus(p);
        var cls = st === "BAD SECTORS" ? "c-err" : (st === "RECOVERED" ? "c-ok" : "c-ok");
        return { h: "[" + p.id + "] " + esc(pad(p.dir, 28)) + " " + seg(st, cls) +
          (p.bad && !recovered[p.dir] ? seg("  (" + p.sectors.length + " 个坏扇区)", "c-dim") : "") };
      })).concat([{ h: "&nbsp;" }, H("[recover] 要救哪个:recover <目录名>")]);
    }
    var proj = projOf(arg);
    if (!proj) {
      return [E("[recover] 没有这个条目: " + arg), H("[recover] 先看看 recover --list。")];
    }
    if (!proj.bad || recovered[proj.dir]) {
      return [
        { h: seg("[recover] " + proj.dir + ": 没有坏扇区,不需要恢复。", "c-dim") },
        H("[recover] 直接读:cat /mnt/cdrom/projects/" + proj.dir + "/README.md")
      ];
    }
    /* 有坏扇区:打进度条 → 成功 */
    var prog = out.progress();
    var cur = 0;
    return new Promise(function (done) {
      (function step() {
        if (out.epoch !== epoch) return done("abort");
        cur += rnd(6, 17);
        if (cur >= 100) {
          prog("[recover] rebuilding index ... [" + "#".repeat(28) + "] 100%", "c-ok");
          return done("done");
        }
        var n = Math.round(cur / 100 * 28);
        prog("[recover] reading bad sectors ... [" + "#".repeat(n) + "-".repeat(28 - n) + "] " +
          String(Math.round(cur)).padStart(3, " ") + "%  " + proj.sectors[Math.min(proj.sectors.length - 1, Math.floor(cur / 34))]);
        setTimeout(step, rnd(90, 190));
      })();
    }).then(function (how) {
      if (how === "abort" || out.epoch !== epoch) return [];
      recovered[proj.dir] = true;
      unkCount = 0;
      return writeSeq([
        { h: seg("[recover] " + proj.sectors.length + " 个坏扇区: " + proj.sectors.join(", "), "c-dim"), d: 160 },
        { h: seg("[recover] 重建目录索引 ... done", "c-dim"), d: 200 },
        { h: seg("[recover] 抢救出 1 个文件: README.md (" + proj.size + " B)", "c-dim"), d: 180 }
      ], epoch).then(function () {
        if (out.epoch !== epoch) return [];
        glitchBurst(360, epoch);
        write(seg("recover success", "c-ok"), null);
        return [
          H("[recover] 现在可以读:cat /mnt/cdrom/projects/" + proj.dir + "/README.md"),
          DIM("[recover] 盘还是只读的;只是这一个目录的索引修好了。")
        ];
      });
    });
  };

  /* 未收录的指令 */
  function notFound(name) {
    unkCount++;
    var out = [E("bash: " + name + ": command not found")];
    if (unkCount >= 3 && unkCount % 3 === 0) {
      out.push({ h: seg("[recover] Manual recovery pending. Try 'help' or 'cat /mnt/cdrom/INDEX'.", "c-mag") });
    }
    return out;
  }

  /* ============================================================
     输入行 / 按键
     ============================================================ */
  function promptHtml() {
    return seg("emergency@recovery", "c-ok") + ":" + seg(pretty(cwd), "c-path") + "$";
  }
  function newInput() {
    inputEl = document.createElement("div");
    inputEl.className = "t-ln";
    screen.appendChild(inputEl);
    curInput = "";
    renderInput();
    scrollDown();
    return inputEl;
  }
  function renderInput() {
    if (!inputEl) return;
    inputEl.innerHTML = promptHtml() + " " + esc(curInput) + '<span class="t-caret"> </span>';
  }

  function submit() {
    var line = curInput;
    /* 输入行前面可能还压着后来打印的引导行 → 先把它挪到底,输出顺序才不乱 */
    if (inputEl && inputEl.nextSibling) screen.appendChild(inputEl);
    if (inputEl) inputEl.innerHTML = promptHtml() + " " + esc(line);   /* 定格的回显 */
    inputEl = null;
    if (line.trim()) {
      hist.push(line);
      histIdx = -1;
      exec(line, epoch).then(function () {
        if (!busy) newInput();
      });
    } else {
      newInput();
    }
  }

  function exec(line, myEpoch) {
    busy = true;
    var out = {
      epoch: myEpoch,
      push: function (x) { if (myEpoch === epoch) write(typeof x === "string" ? x : x.h, typeof x === "string" ? null : x.c); },
      progress: liveLine
    };
    var toks = tokenize(line);
    var name = toks[0] || "";
    var fn = CMDS[name];
    if (myEpoch !== epoch) { busy = false; return Promise.resolve(); }
    if (!fn) {
      notFound(name).forEach(function (l) { out.push(l); });
      busy = false;
      announce(line, "command not found");
      return Promise.resolve();
    }
    var res;
    try { res = fn(toks.slice(1), out); }
    catch (e) { res = [E("bash: " + name + ": " + (e && e.message ? e.message : "error"))]; }
    return Promise.resolve(res).then(function (lines) {
      if (myEpoch !== epoch) { busy = false; return; }
      if (lines && lines.length) {
        lines.forEach(function (l) { if (l !== null && l !== undefined) out.push(l); });
      }
      busy = false;
      announce(line, lines && lines.length ? String(lines[0].h || "").replace(/<[^>]*>/g, "") : "");
    }).catch(function (e) {
      busy = false;
      out.push(E("bash: " + name + ": " + (e && e.message ? e.message : "unexpected error")));
    });
  }

  /* 读屏用:只报"用户敲了什么 + 结果第一行",不报每一次按键 */
  function announce(cmd, result) {
    if (!live) return;
    live.textContent = "$ " + cmd + " → " + String(result).replace(/\s+/g, " ").slice(0, 120);
  }

  function tokenize(s) {
    var out = [], cur = "", q = null;
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      if (q) {
        if (c === q) q = null; else cur += c;
      } else if (c === '"' || c === "'") q = c;
      else if (/\s/.test(c)) { if (cur) { out.push(cur); cur = ""; } }
      else cur += c;
    }
    if (cur) out.push(cur);
    return out;
  }

  function panelActive() {
    if (!panel) return false;
    return panel.classList.contains("is-active") && !document.body.classList.contains("scene-open");
  }
  function typingElsewhere() {
    var a = document.activeElement;
    if (!a) return false;
    var t = a.tagName;
    return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || a.isContentEditable;
  }

  function onKey(e) {
    if (!panelActive()) return;
    /* ★ 中断/清屏用 Ctrl+Shift+C / Ctrl+Shift+L:
       纯 Ctrl+C、Ctrl+V 一律不拦 —— 那是浏览器的复制/粘贴,用户要能选中台词拷走
       (用户报过"Ctrl+C / Ctrl+V 不能用")。粘贴由下面的 paste 事件接。*/
    if (e.ctrlKey && e.shiftKey && (e.key === "c" || e.key === "C")) {
      e.preventDefault();
      if (inputEl) { inputEl.innerHTML = promptHtml() + " " + esc(curInput) + seg("^C", "c-dim"); }
      inputEl = null; curInput = "";
      busy = false;
      newInput();
      return;
    }
    if (e.ctrlKey && e.shiftKey && (e.key === "l" || e.key === "L")) {
      e.preventDefault();
      while (screen.firstChild) screen.removeChild(screen.firstChild);
      inputEl = null; newInput();
      return;
    }
    if (busy) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (typingElsewhere()) return;
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
      return;
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      if (!hist.length) return;
      e.preventDefault();
      if (e.key === "ArrowUp") histIdx = histIdx < 0 ? hist.length - 1 : Math.max(0, histIdx - 1);
      else histIdx = histIdx < 0 ? -1 : Math.min(hist.length - 1, histIdx + 1);
      curInput = histIdx < 0 ? "" : hist[histIdx];
      renderInput();
      return;
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      if (curInput) { curInput = curInput.slice(0, -1); renderInput(); }
      return;
    }
    if (e.key === "Tab") { e.preventDefault(); return; }        /* 不做补全 */
    if (e.key.length === 1) {
      e.preventDefault();
      if (curInput.length < 200) { curInput += e.key; renderInput(); }
    }
  }
  document.addEventListener("keydown", onKey);
  screen.addEventListener("mousedown", function () {
    try { screen.focus({ preventScroll: true }); } catch (e) { screen.focus(); }
  });

  /* 粘贴:Ctrl+V / Ctrl+Shift+V 都交给浏览器的 paste 事件,这里接住塞进输入行。
     终端不是真的 <input>,不接的话按 Ctrl+V 什么也不会发生。 */
  document.addEventListener("paste", function (e) {
    if (!panelActive() || busy) return;
    var txt = e.clipboardData ? e.clipboardData.getData("text") : "";
    if (!txt) return;
    e.preventDefault();
    curInput = (curInput + txt.replace(/[\r\n]+/g, " ")).slice(0, 200);
    renderInput();
  });

  /* ============================================================
     开机序列(第二页:内核日志,没有进度条)
     ============================================================ */
  function tstamp() {                       /* 随机、但单调递增的时间戳 */
    var t = tstamp._t || 0;
    t += rnd(0.0006, 0.42);
    tstamp._t = t;
    return t.toFixed(6).padStart(12, " ");
  }
  function klog(msg, cls) {
    return { h: seg("[" + tstamp() + "]", "c-dim") + " " + (cls ? seg(msg, cls) : esc(msg)) };
  }

  function bootSequence(myEpoch) {
    tstamp._t = 0;
    return writeSeq([
      klog("Linux version 6.6.0-recovery (gcc (GCC) 13.2.0, GNU ld (GNU Binutils) 2.41) #1 SMP PREEMPT_DYNAMIC"),
      klog("Command line: BOOT_IMAGE=/vmlinuz root=UUID=7c9e-1f2a ro emergency quiet"),
      klog("sr 0:0:0:0: [sr0] Attached SCSI removable disk"),
      klog("systemd[1]: Started Disk Scanner."),
      { h: esc("Scanning /dev/sr0..."), d: pace(260, 620) },
      { h: esc("  Reading TOC... OK"), d: pace(220, 520) },
      { h: esc("  Reading session 1... OK"), d: pace(240, 560) },
      { h: esc("  Reading session 2..."), d: rnd(1100, 2400) }     /* 卡在这儿:读不过去 */
    ], myEpoch).then(function () {
      if (myEpoch !== epoch) return;
      glitchBurst(420, myEpoch);
      return writeSeq([
        { h: seg("[FAILED] Failed to read sector 0x1A3F: Input/output error.", "c-err"), d: rnd(600, 900) },
        { h: seg("Disk scan failure.", "c-err"), d: rnd(700, 1400) },
        { h: esc("Attempting to log in as emergency user..."), d: rnd(900, 1600) }
      ], myEpoch);
    }).then(function () {
      if (myEpoch !== epoch) return;
      blank();
      return writeSeq([
        { h: esc("Welcome to emergency mode! After logging in, type \"journalctl -xb\" to view"), d: rnd(180, 420) },
        { h: esc("system logs, \"systemctl reboot\" to reboot, \"systemctl default\" or ^D to"), d: rnd(180, 420) },
        { h: esc("try again to boot into default mode."), d: rnd(260, 520) }
      ], myEpoch);
    }).then(function () {
      if (myEpoch !== epoch) return;
      newInput();                       /* 欢迎语后面的那个提示符 */
      /* ★ 引导不是紧接着来的:像有个保护进程在后台先愣几秒,再开始扫盘 */
      return wait(rnd(3400, 5200));
    }).then(function () {
      if (myEpoch !== epoch) return;
      /* 抢在提示符后面打印的恢复守护进程 */
      return writeSeq([
        { h: seg("[recover] Received fatal error, trying detecting...", "c-mag"), d: rnd(220, 520) },
        { h: seg("[recover] Medium error detected on /dev/sr0.", "c-mag"), d: rnd(200, 460) },
        { h: seg("[recover] Archive mounted read-only at /mnt/cdrom.", "c-mag"), d: rnd(200, 460) },
        { h: seg("[recover] Automatic index failed. Manual recovery required.", "c-mag"), d: rnd(300, 620) },
        { h: seg("[recover] See /mnt/cdrom/INDEX for recovery manifest.", "c-mag"), d: rnd(200, 460) },
        { h: seg("[recover] Suggested commands: ls /mnt/cdrom | cat /mnt/cdrom/INDEX | recover --list", "c-mag"), d: rnd(200, 460) }
      ], myEpoch);
    }).then(function () {
      if (myEpoch !== epoch) return;
      blank();
      /* 引导打完之后把提示符"收"到底部 —— 屏幕上永远只有一个 emergency@recovery:~$
         (之前这里又新建了一个,于是出现两个提示符,用户报过这个 bug)。
         用户要是在这几秒里已经敲了字,就不动它,免得把输入弄没。*/
      settlePrompt();
      try { screen.focus({ preventScroll: true }); } catch (e) {}
      ambientGlitch(myEpoch);
    });
  }

  /* 让输入行回到最底下(它前面是被打印出来的引导行时)*/
  function settlePrompt() {
    if (!inputEl) { newInput(); return; }
    if (curInput) return;                 /* 用户在打字:保持原样 */
    if (inputEl.nextSibling) screen.appendChild(inputEl);
    scrollDown();
  }

  /* ---------- 落位:套用公共的外框贴合模块 ----------
     量贴图、求内接矩形、拼窗口轮廓这些都在 assets/js/frame-fit.js 里(五张盘共用),
     本文件只负责:玻璃层按轮廓裁(--term-clip)、文字层收到内接矩形里(--term-inset-*)。 */
  var frameCache = null;

  /* 外框内侧的安全余量(--term-frame-gap 是个 clamp(),读出来是原样字符串,这里用兜底值)*/
  function frameGapPx() { return 10; }

  var frameBox = null;                   /* 文字活动范围(px,视口坐标)*/
  function fitToFrame() {
    var W = window.innerWidth, H = window.innerHeight;
    var FF = window.FrameFit;
    var d = FF && FF.data ? FF.data() : null;
    var cs = getComputedStyle(document.documentElement);
    var gap = frameGapPx();
    var s = root.style;
    if (d) {
      var sx = W / d.img[0], sy = H / d.img[1];
      /* 文字活动范围 = 窗口四边往内收 gap(FrameFit 的 win 是图上坐标,
         右边的写法是"坐标 - gap",不是"视口宽 - 坐标" —— 两种口径混过一次,终端被压成 0 宽)*/
      var win = d.win || d.safe;
      frameBox = [
        Math.round(win[0] * sx + gap), Math.round(win[1] * sy + gap),
        Math.round(win[2] * sx - gap), Math.round(win[3] * sy - gap)
      ];
      s.setProperty("--term-inset-left", frameBox[0] + "px");
      s.setProperty("--term-inset-top", frameBox[1] + "px");
      s.setProperty("--term-inset-right", (W - frameBox[2]) + "px");
      s.setProperty("--term-inset-bottom", (H - frameBox[3]) + "px");
      var clip = cs.getPropertyValue("--ff-clip").trim();
      if (clip) {
        s.setProperty("--term-clip", clip);
        root.classList.add("is-fitted");
      } else {
        root.classList.remove("is-fitted");
      }
      /* 为了排障接口仍然把量到的原始数据挂在身上 */
      frameCache = d;
      s.setProperty("--term-frame-applied", "1");
    } else {
      ["--term-inset-left", "--term-inset-top", "--term-inset-right", "--term-inset-bottom", "--term-clip", "--term-frame-applied"]
        .forEach(function (k) { s.removeProperty(k); });
      root.classList.remove("is-fitted");
      frameBox = null;
      frameCache = null;
    }
    syncTopGap();
  }
  if (window.FrameFit) {
    window.FrameFit.ready(function () { fitToFrame(); });
  }
  window.addEventListener("frame-fit", function () { fitToFrame(); });

  /* 顶部站点导航(浮层)让位:导航默认收起,那就不让;真露出来才量它的高度。
     ★ 注意别在 initStatusbar() 之前量 —— 那时候 statusbar-hidden 还没加上,
       会量出一个"导航开着"的高度,然后文字就永远往下沉(用户报过)。 */
  var navEl = document.querySelector("header") || document.querySelector(".statusbar");
  function navVisible() {
    if (!navEl) return false;
    if (document.body.classList.contains("statusbar-hidden")) return false;
    var cs = getComputedStyle(navEl);
    if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.05) return false;
    return navEl.getBoundingClientRect().height > 4;
  }
  /* 排障:把导航为什么算"没露出来"的原因也带上 */
  function navWhy() {
    if (!navEl) return "no-nav";
    if (document.body.classList.contains("statusbar-hidden")) return "body.statusbar-hidden";
    var cs = getComputedStyle(navEl);
    if (cs.display === "none") return "display:none";
    if (cs.visibility === "hidden") return "visibility:hidden";
    if (parseFloat(cs.opacity) < 0.05) return "opacity:" + cs.opacity;
    if (navEl.getBoundingClientRect().height <= 4) return "height<=4";
    return "visible";
  }
  function syncTopGap() {
    /* ★ 参照物必须是【文字区】,不能是 .term 这个盒子 ——
       量到外框之后 .term 是铺满视口的(靠 clip-path 裁),它的 top 永远是 0,
       拿它比就永远算出"导航没压到东西",让位量恒为 0(踩过)。
       做法:先把让位量清零量一次文字区顶部,再按导航底边算需要让多少。 */
    root.style.setProperty("--term-gap-top", "0px");
    var gap = 0;
    if (navVisible()) {
      var r = navEl.getBoundingClientRect();
      var s = screen.getBoundingClientRect();
      if (r.bottom > s.top) gap = Math.round(r.bottom - s.top) + 6;
    }
    root.style.setProperty("--term-gap-top", gap + "px");
  }
  syncTopGap();
  /* 导航的显示/隐藏、入场动画、窗口缩放都可能晚于本脚本:
     头 10 秒里每 450ms 重算一次(就两次 getBoundingClientRect,代价可以忽略),
     之后靠 MutationObserver(body 的 class)+ 点收起箭头 + resize 兜着 */
  var gapTicks = 0;
  var gapTimer = setInterval(function () {
    syncTopGap();
    if (++gapTicks > 22) clearInterval(gapTimer);
  }, 450);
  if (window.MutationObserver) {
    new MutationObserver(syncTopGap).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }
  window.addEventListener("resize", function () { fitToFrame(); });
  var sbToggle = document.getElementById("statusbar-toggle");
  if (sbToggle) sbToggle.addEventListener("click", function () { syncTopGap(); setTimeout(syncTopGap, 420); });

  /* ============================================================
     对外接口:reset() 清屏待机,start() 开始开机序列
     ============================================================ */
  var started = false;
  function reset() {
    epoch++;
    started = false;
    busy = false;
    curInput = "";
    inputEl = null;
    hist = [];
    histIdx = -1;
    unkCount = 0;
    cwd = "/home/emergency";
    stick = true;
    while (screen.firstChild) screen.removeChild(screen.firstChild);
    root.classList.remove("is-glitching");
  }
  function start() {
    if (started) return;
    started = true;
    var myEpoch = epoch;
    /* 第一屏先来一句"看门狗"式的开场,再接内核日志 */
    writeSeq([
      { h: seg("GLITCH ARCHIVE — emergency shell 1.4 (tty1)", "c-dim"), d: 200 },
      { h: seg("booting from /dev/sr0 ...", "c-dim"), d: 320 },
      { h: "", d: 120 }
    ], myEpoch).then(function () {
      if (myEpoch !== epoch) return;
      return bootSequence(myEpoch);
    });
  }

  window.CD4Term = {
    reset: reset,
    start: start,
    isStarted: function () { return started; },
    /* 调试/排障用:控制台里敲 CD4Term.measure() —— 看看终端到底落在哪、外框窗口量到多少。
       用户那边如果"文字还偏"或"还顶出框",把这一行结果发过来就够了 */
    measure: function () {
      var r = root.getBoundingClientRect();
      var cs = getComputedStyle(root);
      return {
        viewport: [window.innerWidth, window.innerHeight],
        termBox: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)],
        frameWindow: frameBox,
        frameFromImage: !!(frameCache && frameCache.safe),
        frameSafe: frameCache ? frameCache.safe : null,
        frameBoxCenterLine: frameCache ? frameCache.box : null,
        frameFit: !!(window.FrameFit && window.FrameFit.data()),
        gapTop: cs.getPropertyValue("--term-gap-top").trim(),
        fitted: root.classList.contains("is-fitted"),
        clipPath: String(getComputedStyle(root).clipPath || "none").slice(0, 90),
        termScreenBox: (function () {
          var b = screen.getBoundingClientRect();
          return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)];
        })(),
        nav: navEl ? { tag: navEl.tagName, cls: navEl.className, visible: navVisible(), why: navWhy(), rect: (function () { var b = navEl.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom)]; })() } : null,
        statusbarHidden: document.body.classList.contains("statusbar-hidden"),
      };
    },
    refit: fitToFrame
  };

  /* 接入站点流程:
     · 必须"面板激活 + CD 架已收起 + 没有开机动画在放"三条同时成立才开始打印,
       否则会打在还被盖住的画面上(用户只会看到日志的尾巴)
     · 插盘:finish() 紧接着会调 reset() 清一次,所以这里抢跑也没关系
     · 回访:收起 CD 架 → 先放这张盘的开机动画 → cd-boot-done 之后才开始 */
  function maybeStart() {
    if (started) return;
    /* 站点还没进入 CD 界面(加载 3D 那几秒)时别抢跑:那时候 scene-open 还没加上,
       一抢跑就会打在还没露出来的页面上 */
    if (!window.__introReady) return;
    if (!panel || !panel.classList.contains("is-active")) return;
    if (document.body.classList.contains("scene-open")) return;
    if (window.__bootRunning) return;
    start();
  }
  window.addEventListener("cd-panel", maybeStart);
  window.addEventListener("cd-boot-done", maybeStart);
  setInterval(maybeStart, 400);        /* 兜底:收起架子/动画结束都可能错过事件 */

  maybeStart();                        /* 本次加载时如果条件已满足(极少见),立刻开始 */
})();
