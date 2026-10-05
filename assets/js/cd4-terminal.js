(function () {
  "use strict";

  var root = document.getElementById("cd4-term");
  if (!root) return;
  var screen = document.getElementById("cd4-screen");
  var tear = document.getElementById("cd4-tear");
  var live = document.getElementById("cd4-live");
  var panel = root.closest(".intro-panel");
  var CD = (root.getAttribute("data-term-cd") || "/assets/cd/tech").replace(/\/$/, "");

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
          "# dir 02 still will not read\n" +
          "recover 02_vllm_DCU_optimize\n"),
        ".profile": T("ok",
          "# ~/.profile — emergency session\n" +
          "export PS1='\\u@\\h:\\w\\$ '\n" +
          "export PATH=/bin:/sbin\n" +
          "alias ll='ls -l'\n" +
          "# this box is read-only: do not bother editing anything under /etc\n")
      })
    }),
    mnt: D("ok", {
      cdrom: D("ok", {
        INDEX: T("ok", null, "由 recover 工具现场生成"),
        "README.txt": F("ok", "README.txt"),
        "MANIFEST.sha256": F("ok", "MANIFEST.sha256"),
        projects: D("ok", {
          "00_tuagfey-blog": D("ok", {
            "README.md": F("ok", "projects/00_tuagfey-blog/README.md"),
            "manifest.json": F("missing"),
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

  var PROJECTS = [
    { id: "00", dir: "00_tuagfey-blog", title: "Tuagfey Blog", size: 1104 },
    { id: "01", dir: "01_ROMS", title: "ROMS-CoSiNE 限定环境优化", size: 1473 },
    { id: "02", dir: "02_vllm_DCU_optimize", title: "Qwen3.5-27B × 海光 DCU × vLLM", size: 6131, bad: true, sectors: ["0x1a3f", "0x1a40", "0x1b02"] }
  ];
  var recovered = {};

  function projOf(dir) {
    var name = String(dir || "").replace(/\/+$/, "").split("/").pop();
    for (var i = 0; i < PROJECTS.length; i++) if (PROJECTS[i].dir === name) return PROJECTS[i];
    return null;
  }
  function projStatus(p) {
    if (!p.bad) return "OK";
    return recovered[p.dir] ? "RECOVERED" : "BAD SECTORS";
  }

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
    out.push("  Entries marked BAD SECTORS cannot be read directly.");
    out.push("  Use `recover <folder>` to rebuild that entry's index and first file.");
    out.push("");
    out.push("  recover --list      list every entry and its status");
    out.push("  recover <folder>    attempt recovery of a single project");
    out.push("  help                list available commands");
    return out.join("\n");
  }
  function countBad() {
    var n = 0;
    PROJECTS.forEach(function (p) { if (p.bad && !recovered[p.dir]) n++; });
    return n;
  }
  function pad(s, n) { s = String(s); while (s.length < n) s += " "; return s; }

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
  var BIN = { "/mnt/cdrom/recovered/fragment_001.bin": true };

  var epoch = 0;
  var inputEl = null;
  var curInput = "";
  var hist = [], histIdx = -1;
  var cwd = "/home/emergency";
  var busy = false;
  var unkCount = 0;
  var stick = true;

  function esc(s) {
    return String(s === null || s === undefined ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function seg(t, cls) { return '<span class="' + cls + '">' + esc(t) + "</span>"; }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function pace(fast, slow) {
    var r = Math.random();
    if (r < 0.13) return rnd(slow * 1.6, slow * 4.4);
    if (r < 0.36) return rnd(40, fast * 0.75);
    return rnd(fast, slow);
  }

  function scrollDown() {
    if (stick) screen.scrollTop = screen.scrollHeight;
  }
  screen.addEventListener("scroll", function () {
    stick = screen.scrollHeight - screen.scrollTop - screen.clientHeight < 28;
  });

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

  var MAX_LINES = 900;
  function trim() {
    while (screen.childNodes.length > MAX_LINES) screen.removeChild(screen.firstChild);
  }

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

  function liveLine() {
    var d = write("");
    return function (text, cls) {
      d.className = "t-ln" + (cls ? " " + cls : "");
      d.textContent = text;
      scrollDown();
    };
  }

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

  function ambientGlitch(myEpoch) {
    setTimeout(function () {
      if (myEpoch !== epoch) return;
      if (!busy && !document.hidden) glitchBurst(320, myEpoch);
      ambientGlitch(myEpoch);
    }, rnd(9000, 17000));
  }

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
      var hint = e.proj ? " (try: recover " + e.proj.dir + ")" : "";
      return [E("cat: " + path + ": Input/output error"), H("[recover] Unreadable sector." + hint)];
    }
    return [E("cat: " + path + ": Input/output error")];
  }
  function E(s) { return { h: esc(s), c: "is-err" }; }
  function H(s) { return { h: seg(s, "c-mag"), c: null }; }
  function DIM(s) { return { h: seg(s, "c-dim") }; }
  function OK(s) { return { h: seg(s, "c-ok") }; }

  var CMDS = {};

  CMDS.help = function () {
    function row(cmds, label) {
      var c = "  " + cmds;
      while (c.length < 44) c += " ";
      return { h: esc(c) + seg(label, "c-dim") };
    }
    return [
      { h: seg("GLITCH ARCHIVE — emergency shell 1.4", "c-hi") },
      { h: seg("Available commands:", "c-dim") },
      row("ls  cd  pwd  cat  less  find  grep", "files & directories"),
      row("mount  blkid  lsblk", "devices & mounts"),
      row("dmesg  journalctl", "kernel & journal logs"),
      row("sha256sum  dd  file  strings", "disc utilities"),
      row("clear  history  exit", "session"),
      row("whoami  id  uname  date  echo", "user & host info"),
      row("recover [--list|<project>]", "recovery tool"),
      { h: "&nbsp;" },
      { h: "  ↑ ↓ history    Ctrl+Shift+C interrupt    Ctrl+Shift+V paste    Ctrl+Shift+L clear", c: "is-dim" }
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
    return [new Date().toString().replace(/GMT.*/, "UTC") + "   " + seg("(RTC not synced)", "c-dim")];
  };
  CMDS.echo = function (a) { return [esc(a.join(" "))]; };
  CMDS.history = function () {
    if (!hist.length) return [DIM("(empty)")];
    return hist.map(function (h, i) { return seg(pad(String(i + 1), 5), "c-dim") + "  " + esc(h); });
  };
  CMDS.clear = function () {
    while (screen.firstChild) screen.removeChild(screen.firstChild);
    inputEl = null;
    return null;
  };
  CMDS.less = function (a) {
    if (!a.length) return [E("usage: less <file>")];
    return CMDS.cat(a);
  };

  CMDS.cat = function (a) {
    if (!a.length) return [E("cat: missing operand")];
    return Promise.all(a.map(function (arg) {
      var p = norm(arg, cwd), n = nodeAt(p);
      if (!n) return [E("cat: " + arg + ": No such file or directory")];
      if (n.d) return [E("cat: " + arg + ": Is a directory")];
      return readNode(p, n).then(function (f) {
        if (f.isBinary) {
          var dec = new TextDecoder("latin1").decode(f.bytes.slice(0, 640));
          return [{ h: seg(dec, "c-mag") }, DIM("… (binary file, " + f.bytes.length + " bytes; output truncated)")];
        }
        var out = f.text.split(/\r?\n/);
        if (out.length && out[out.length - 1] === "") out.pop();
        return out.length ? out.map(function (l) { return esc(l) || "&nbsp;"; }) : [DIM("(empty file)")];
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
    if (!names.length) return [DIM("(empty)")];
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
    out.push(DIM("find: done (unreadable directories skipped)"));
    return out;
  };

  CMDS.grep = function (a) {
    var ci = false, rest = [];
    a.forEach(function (x) { if (x === "-i") ci = true; else rest.push(x); });
    if (rest.length < 2) return [E("usage: grep [-i] <pattern> <file|dir>")];
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
          out.push(out.length ? DIM("grep: " + Math.min(12, hits.length) + " readable file(s) searched") : DIM("grep: no match"));
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
              H("[recover] /mnt/cdrom is mounted read-only; emergency cannot change mount flags.")];
    }
    return [
      "sysfs on /sys type sysfs (ro,nosuid,nodev,noexec)",
      "proc on /proc type proc (ro,nosuid,nodev,noexec)",
      "devtmpfs on /dev type devtmpfs (rw,nosuid,size=4096k)",
      seg("/dev/sr0 on /mnt/cdrom type iso9660 (ro,relatime,norock,check=r)", "c-hi")
    ];
  };

  CMDS.blkid = function () {
    return [
      seg("/dev/sr0:", "c-hi") + ' LABEL="WRONG_LABEL" UUID="2026-04-01-13-37-00-00" TYPE="iso9660"',
      "/dev/sda1: LABEL=\"RECOVERY\" UUID=\"7c9e-1f2a\" TYPE=\"vfat\" PARTUUID=\"0000a1b2-01\"",
      { h: seg("blkid: /dev/sr0: volume label does not match GLITCH_ARCHIVE", "c-err") }
    ];
  };

  CMDS.lsblk = function () {
    return [
      "NAME   MAJ:MIN RM   SIZE RO TYPE MOUNTPOINTS",
      "sda      8:0    0    16G  0 disk ",
      "└─sda1   8:1    0    16G  0 part /",
      seg("sr0     11:0    1   2.1G  1 rom  /mnt/cdrom", "c-hi")
    ];
  };

  CMDS.dmesg = function () {
    return [E("dmesg: read kernel buffer failed: Operation not permitted"),
            H("[recover] Reading the kernel ring buffer needs root. Try: cat /var/log/disk_scan.log")];
  };

  CMDS.journalctl = function () {
    return [
      E("Failed to open /var/log/journal: Input/output error"),
      "No journal files were found.",
      H("[recover] No journal files. Only plain-text logs under /var/log are readable.")
    ];
  };

  CMDS.systemctl = function (a) {
    return [E("Failed to connect to bus: No such file or directory"),
            H("[recover] No init/DBus in emergency mode: systemctl is not available.")];
  };

  CMDS.su = function () { return [E("su: must be suid to work properly")]; };
  CMDS.sudo = function () { return [E("-bash: sudo: command not found")]; };

  CMDS.file = function (a) {
    if (!a.length) return [E("usage: file <path>")];
    var p = norm(a[0], cwd), n = nodeAt(p);
    if (!n) return [E("file: cannot open `" + a[0] + "' (No such file or directory)")];
    if (n.read === "denied") return [E("file: cannot open `" + a[0] + "' (Permission denied)")];
    if (n.read === "eio" || n.read === "bad") return [E("file: cannot open `" + a[0] + "' (Input/output error)")];
    return [E("file: could not find any valid magic files!")];
  };

  CMDS.strings = function (a) {
    if (!a.length) return [E("usage: strings <path>")];
    var p = norm(a[0], cwd), n = nodeAt(p);
    if (!n) return [E("strings: '" + a[0] + "': No such file or directory")];
    return readNode(p, n).then(function (f) {
      var txt = f.isBinary ? new TextDecoder("latin1").decode(f.bytes) : f.text;
      var found = txt.match(/[\x20-\x7e]{4,}/g) || [];
      if (!found.length) return [DIM("strings: no printable strings found")];
      var out = found.slice(0, 40).map(function (s) {
        return seg(String(txt.indexOf(s)).padStart(6, "0"), "c-dim") + "  " + esc(s);
      });
      if (found.length > 40) out.push(DIM("… " + (found.length - 40) + " more"));
      return out;
    }).catch(function (e) { return errLine(a[0], e); });
  };

  CMDS.sha256sum = function (a) {
    if (!a.length) return [E("usage: sha256sum <file>")];
    return Promise.all(a.map(function (arg) {
      var p = norm(arg, cwd), n = nodeAt(p);
      if (!n) return Promise.resolve(E("sha256sum: " + arg + ": No such file or directory"));
      return readNode(p, n).then(function (f) {
        if (!(window.crypto && crypto.subtle)) return E("sha256sum: " + arg + ": Operation not supported");
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
    if (!src) return [E("dd: missing if=<input>"), DIM("e.g. dd if=/dev/sr0 of=/mnt/cdrom/recovered/fragment_001.bin bs=512")];
    if (src.indexOf("/dev/") === 0) return [E("dd: failed to open '" + src + "': Permission denied")];
    if (dst.indexOf("/mnt/cdrom") === 0) return [E("dd: failed to open '" + dst + "': Read-only file system")];
    if (!dst) return [E("dd: missing of=<output>")];
    return [E("dd: failed to open '" + dst + "': No such file or directory")];
  };

  CMDS.exit = function () {
    return [E("bash: exit: cannot exit the emergency shell")];
  };

  CMDS.recover = function (a, out) {
    var arg = (a[0] || "").replace(/\/+$/, "");
    if (!arg || arg === "-h" || arg === "--help") {
      return [
        { h: seg("recover — GLITCH ARCHIVE recovery tool", "c-ok") },
        { h: seg("usage:", "c-dim") },
        "  recover --list            list every entry and its status",
        "  recover <project-dir>     rebuild one entry (index + first file)",
        { h: "&nbsp;" },
        H("[recover] Bad sectors are not recovered automatically.")
      ];
    }
    if (arg === "--list" || arg === "-l" || arg === "list") {
      out.push({ h: seg("[recover] scanning /mnt/cdrom/projects ...", "c-dim") });
      return [
        { h: seg("[" + pad("ID", 4) + "] " + pad("DIRECTORY", 28) + " STATUS", "c-dim") }
      ].concat(PROJECTS.map(function (p) {
        var st = projStatus(p);
        var cls = st === "BAD SECTORS" ? "c-err" : "c-ok";
        return { h: "[" + p.id + "] " + esc(pad(p.dir, 28)) + " " + seg(st, cls) +
          (p.bad && !recovered[p.dir] ? seg("  (" + p.sectors.length + " bad sectors)", "c-dim") : "") };
      })).concat([{ h: "&nbsp;" }, H("[recover] Select an entry: recover <directory>")]);
    }
    var proj = projOf(arg);
    if (!proj) {
      return [E("[recover] No such entry: " + arg), H("[recover] Try: recover --list")];
    }
    if (!proj.bad || recovered[proj.dir]) {
      return [
        { h: seg("[recover] " + proj.dir + ": no bad sectors, nothing to recover.", "c-dim") },
        H("[recover] Read it directly: cat /mnt/cdrom/projects/" + proj.dir + "/README.md")
      ];
    }
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
        { h: seg("[recover] " + proj.sectors.length + " bad sectors: " + proj.sectors.join(", "), "c-dim"), d: 160 },
        { h: seg("[recover] rebuilding directory index ... done", "c-dim"), d: 200 },
        { h: seg("[recover] rescued 1 file: README.md (" + proj.size + " B)", "c-dim"), d: 180 }
      ], epoch).then(function () {
        if (out.epoch !== epoch) return [];
        glitchBurst(360, epoch);
        write(seg("recover success", "c-ok"), null);
        return [
          H("[recover] Now readable: cat /mnt/cdrom/projects/" + proj.dir + "/README.md"),
          DIM("[recover] /mnt/cdrom remains read-only; only this entry's index was rebuilt.")
        ];
      });
    });
  };

  function notFound(name) {
    unkCount++;
    var out = [E("bash: " + name + ": command not found")];
    if (unkCount >= 3 && unkCount % 3 === 0) {
      out.push({ h: seg("[recover] Manual recovery pending. Try 'help' or 'cat /mnt/cdrom/INDEX'.", "c-mag") });
    }
    return out;
  }

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
    if (inputEl && inputEl.nextSibling) screen.appendChild(inputEl);
    if (inputEl) inputEl.innerHTML = promptHtml() + " " + esc(line);
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
    if (e.key === "Tab") { e.preventDefault(); return; }
    if (e.key.length === 1) {
      e.preventDefault();
      if (curInput.length < 200) { curInput += e.key; renderInput(); }
    }
  }
  document.addEventListener("keydown", onKey);
  screen.addEventListener("mousedown", function () {
    try { screen.focus({ preventScroll: true }); } catch (e) { screen.focus(); }
  });

  document.addEventListener("paste", function (e) {
    if (!panelActive() || busy) return;
    var txt = e.clipboardData ? e.clipboardData.getData("text") : "";
    if (!txt) return;
    e.preventDefault();
    curInput = (curInput + txt.replace(/[\r\n]+/g, " ")).slice(0, 200);
    renderInput();
  });

  function tstamp() {
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
      { h: esc("  Reading session 2..."), d: rnd(1100, 2400) }
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
      newInput();
      return wait(rnd(3400, 5200));
    }).then(function () {
      if (myEpoch !== epoch) return;
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
      settlePrompt();
      try { screen.focus({ preventScroll: true }); } catch (e) {}
      ambientGlitch(myEpoch);
    });
  }

  function settlePrompt() {
    if (!inputEl) { newInput(); return; }
    if (curInput) return;
    if (inputEl.nextSibling) screen.appendChild(inputEl);
    scrollDown();
  }

  var frameCache = null;

  function frameGapPx() { return 10; }

  var frameBox = null;
  function fitToFrame() {
    var W = window.innerWidth, H = window.innerHeight;
    var FF = window.FrameFit;
    var d = FF && FF.data ? FF.data() : null;
    var gap = frameGapPx();
    var s = root.style;
    if (d) {
      var sx = W / d.img[0], sy = H / d.img[1];
      var win = d.win || d.safe;
      frameBox = [
        Math.round(win[0] * sx + gap), Math.round(win[1] * sy + gap),
        Math.round(win[2] * sx - gap), Math.round(win[3] * sy - gap)
      ];
      s.setProperty("--term-inset-left", frameBox[0] + "px");
      s.setProperty("--term-inset-top", frameBox[1] + "px");
      s.setProperty("--term-inset-right", (W - frameBox[2]) + "px");
      s.setProperty("--term-inset-bottom", (H - frameBox[3]) + "px");
      root.classList.add("is-fitted");
      frameCache = d;
      s.setProperty("--term-frame-applied", "1");
    } else {
      ["--term-inset-left", "--term-inset-top", "--term-inset-right", "--term-inset-bottom", "--term-frame-applied"]
        .forEach(function (k) { s.removeProperty(k); });
      s.removeProperty("--term-clip");
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

  var navEl = document.querySelector("header") || document.querySelector(".statusbar");
  function navVisible() {
    if (!navEl) return false;
    if (document.body.classList.contains("statusbar-hidden")) return false;
    var cs = getComputedStyle(navEl);
    if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.05) return false;
    return navEl.getBoundingClientRect().height > 4;
  }
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

  function maybeStart() {
    if (started) return;
    /* 首页引导流程不会设置 __introReady(只有非首页的 startIntro 会),
       这里改用 __guideDone(引导结束)兜底,其余守卫不变 */
    if (!window.__introReady && !window.__guideDone) return;
    if (!panel || !panel.classList.contains("is-active")) return;
    if (document.body.classList.contains("scene-open")) return;
    if (window.__bootRunning) return;
    start();
  }
  window.addEventListener("cd-panel", maybeStart);
  window.addEventListener("cd-boot-done", maybeStart);
  setInterval(maybeStart, 400);

  maybeStart();
})();
