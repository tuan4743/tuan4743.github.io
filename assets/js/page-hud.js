(function () {
    "use strict";

    var T60 = Math.tan(Math.PI / 3);

    function gFrame(w, h, bandX) {
        var k = h / w;
        var y1;
        var bx = isFinite(parseFloat(bandX)) ? parseFloat(bandX) : 35;

        var p1 = [45, 0];
        var p2 = [p1[0] - (9 * k) / T60, 9];
        var p3 = [30, 9];
        var p4 = [p3[0] - 3 * k, 6];
        var p5 = [8, 6];
        var p6 = [5, 0];
        p6[1] = 6 + 3 / k;
        y1 = p6[1];
        var p7 = [5, 100 - y1];
        var p8 = [8, p7[1] + 3 / k];
        var p9 = [bx, p8[1]];
        var p10 = [p9[0] + (6 * k) / T60, 100];/* ⑩ 60°:Δy=6 ⇒ Δx = 6k/√3 */

        var user = [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10];
        var d = user.map(function (p, i) {
            return (i ? "L" : "M") + round(100 - p[0]) + " " + round(p[1]);
        }).join(" ");
        var fill = d + " L100 100 L100 0 Z";
        return { path: d, fill: fill, user: user, k: k, y1: y1 };
    }

    var T30LB = Math.tan(Math.PI / 6);
    var LB = {
        RAIL: 2, TIP: 6, FLAT: 7.5, CUT: 7, Y0: 42, GAP: 7.8691,
        INSET: 0.5, FACE_OUT: 0.3, TRI: 9, TRI_INSET: 0.7
    };

    function gFrameLB() {
        var R = LB.RAIL, TIP = LB.TIP, FLAT = LB.FLAT, C = LB.CUT;
        var flank = (TIP - R) * T30LB;
        var cutY = 100 - R - C;
        var mir = function (p) { return [100 - p[1], 100 - p[0]]; };

        var half = [], mods = [];
        var y = LB.Y0;
        half.push([0, y]);
        y += R * T30LB;  half.push([R, y]);
        y += LB.GAP;     half.push([R, y]);
        for (var i = 0; i < 2; i++) {
            var yTop = y + flank;
            half.push([TIP, yTop], [TIP, yTop + FLAT], [R, yTop + FLAT + flank]);
            mods.push({ top: yTop, bot: yTop + FLAT });
            y = yTop + FLAT + flank;
            if (!i) { y += LB.GAP; half.push([R, y]); }
        }
        half.push([R, cutY]);

        var pts = half.slice();
        pts.push(mir([R, cutY]));
        for (var j = half.length - 2; j >= 0; j--) pts.push(mir(half[j]));

        var d = pts.map(function (p, k) {
            return (k ? "L" : "M") + round(p[0]) + " " + round(p[1]);
        }).join(" ");
        var poly = function (f) {
            return f.map(function (p) { return round(p[0]) + "," + round(p[1]); }).join(" ");
        };

        var xOut = LB.FACE_OUT, xIn = TIP - LB.INSET, run = (xIn - xOut) * T30LB;
        var left = mods.map(function (m) {
            return [[xOut, m.top + LB.INSET - run], [xIn, m.top + LB.INSET],
                    [xIn, m.bot - LB.INSET], [xOut, m.bot - LB.INSET + run]];
        });
        var faces = left.concat([
            left[1].slice().reverse().map(mir),
            left[0].slice().reverse().map(mir)
        ]);
        var k = LB.TRI_INSET;
        var tri = [[k, 100 - k], [k, 100 - k - LB.TRI], [k + LB.TRI, 100 - k]];

        var center = function (f) {
            var cx = 0, cy = 0;
            f.forEach(function (p) { cx += p[0]; cy += p[1]; });
            return [cx / f.length, cy / f.length];
        };
        var boxes = faces.concat([tri]).map(function (f) {
            var xs = f.map(function (p) { return p[0]; }), ys = f.map(function (p) { return p[1]; });
            var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
            var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
            var w = x1 - x0, h = y1 - y0;
            var c = center(f);
            return {
                x: round(x0), y: round(y0), w: round(w), h: round(h),
                clip: "polygon(" + f.map(function (p) {
                    return round((p[0] - x0) / w * 100) + "% " + round((p[1] - y0) / h * 100) + "%";
                }).join(", ") + ")",
                fx: round((c[0] - x0) / w * 100), fy: round((c[1] - y0) / h * 100)
            };
        });
        return {
            path: d, fill: d + " L0 100 Z", user: pts,
            faces: faces, facePts: faces.map(poly),
            tri: tri, triPts: poly(tri),
            centers: faces.map(center), boxes: boxes
        };
    }

    function round(v) {
        return Math.round(v * 1e4) / 1e4;
    }

    function drawFrame() {
        var root = document.getElementById("page-hud");
        if (!root) return;
        var w = window.innerWidth || document.documentElement.clientWidth || 0;
        var h = window.innerHeight || document.documentElement.clientHeight || 0;
        if (!w || !h) return;
        var bandX = null;
        try {
            var cs = window.getComputedStyle ? window.getComputedStyle(root).getPropertyValue("--hud-band-x") : "";
            bandX = parseFloat(String(cs).replace("%", ""));
        } catch (e) { }
        var g = gFrame(w, h, bandX);
        var svg = root.querySelector(".page-hud__frame");
        if (svg) {
            var ps = svg.querySelectorAll("path");
            var ds = [g.fill, g.path, g.path, g.path];
            for (var i = 0; i < ps.length && i < ds.length; i++) ps[i].setAttribute("d", ds[i]);
        }
        var fill = root.querySelector(".hud-fill");
        if (fill) fill.setAttribute("d", g.fill);
        root.setAttribute("data-hud-frame", g.path);

        var band = gFrameLB();
        var svgLB = root.querySelector(".page-hud__band");
        if (svgLB) {
            var qs = svgLB.querySelectorAll("path");
            var dsb = [band.fill, band.path, band.path, band.path];
            for (var m = 0; m < qs.length && m < dsb.length; m++) qs[m].setAttribute("d", dsb[m]);
            var pg = svgLB.querySelectorAll("polygon");
            var pgs = band.facePts.concat([band.triPts]);
            for (var q = 0; q < pg.length && q < pgs.length; q++) pg[q].setAttribute("points", pgs[q]);
        }
        root.setAttribute("data-hud-band", band.path);
        var btns = root.querySelectorAll("[data-hud-lb]");
        for (var b = 0; b < btns.length && b < band.boxes.length; b++) {
            var bx = band.boxes[b], el = btns[b];
            if (!el.style) continue;
            el.style.left = bx.x + "vh";
            el.style.top = bx.y + "vh";
            el.style.width = bx.w + "vh";
            el.style.height = bx.h + "vh";
            el.style.clipPath = bx.clip;
            if (el.style.webkitClipPath !== undefined) el.style.webkitClipPath = bx.clip;
            var fc = el.querySelector ? el.querySelector(".hud-left__face") : null;
            if (fc && fc.style) { fc.style.left = bx.fx + "%"; fc.style.top = bx.fy + "%"; }
        }
        if (window.__hudFrame) { window.__hudFrame.last = g; window.__hudFrame.lastLB = band; }
    }

    if (typeof window !== "undefined") {
        window.__hudFrame = { gFrame: gFrame, gFrameLB: gFrameLB, draw: drawFrame, T60: T60 };
    }

    if (typeof document === "undefined" || !document.getElementById) return;

    var rootEl = document.documentElement;
    var byId = function (id) { return document.getElementById(id); };
    drawFrame();
    var pending = false;
    window.addEventListener("resize", function () {
        if (pending) return;
        pending = true;
        var run = function () { pending = false; drawFrame(); syncNavH(); };
        if (window.requestAnimationFrame) window.requestAnimationFrame(run);
        else setTimeout(run, 120);
    });

    function syncNavH() {
        var nav = document.querySelector(".hud-nav");
        var h = nav ? nav.offsetHeight : 0;
        if (h > 0) rootEl.style.setProperty("--hud-nav-h", h + "px");
    }
    syncNavH();
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
        document.fonts.ready.then(function () { syncNavH(); }).catch(function () { });
    }
    window.addEventListener("load", function () { syncNavH(); });

    var store = {
        get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
        set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
    };

    var P = window.__hudPalette;
    var hue = byId("palette-hue");
    var hueVal = byId("hud-hue-val");

    function paintHue() {
        if (!hueVal || !hue) return;
        hueVal.textContent = (P && P.stored() !== null)
            ? Math.round(parseFloat(hue.value)) + "°"
            : "默认";
    }

    if (hue && P) {
        hue.value = String(P.initialHue());
        paintHue();
        hue.addEventListener("input", function () {
            P.set(parseFloat(hue.value));
            paintHue();
        });
        if (window.MutationObserver) {
            new MutationObserver(function () {
                if (P.stored() !== null) P.apply(parseFloat(hue.value));
            }).observe(rootEl, { attributes: true, attributeFilter: ["data-theme"] });
        }
    }

    var vol = byId("volume-range");
    var volVal = byId("hud-vol-val");

    function paintVol() {
        if (volVal && vol) volVal.textContent = vol.value + "%";
    }

    if (vol) {
        var v = 0.5;
        var raw = store.get("cd-audio-vol");
        var f = parseFloat(raw);
        if (isFinite(f)) v = Math.min(1, Math.max(0, f));
        vol.value = String(Math.round(v * 100));
        paintVol();
        vol.addEventListener("input", function () {
            var n = Math.min(1, Math.max(0, parseFloat(vol.value) / 100));
            store.set("cd-audio-vol", String(n));
            try {
                window.dispatchEvent(new CustomEvent("hud-volume", { detail: n }));
            } catch (e) { }
            paintVol();
        });
    }

    var sInput = byId("header-search-input");
    var sClear = byId("hud-search-clear");

    function paintClear() {
        if (sClear) sClear.hidden = !(sInput && sInput.value);
    }

    if (sInput && sClear) {
        sInput.addEventListener("input", paintClear);
        sInput.addEventListener("search", paintClear);
        sClear.addEventListener("click", function (e) {
            e.stopPropagation();
            var root = byId("header-search");
            var inst = root && root.__search;
            if (inst && inst.clear) {
                inst.clear();
            } else {
                sInput.value = "";
                var panel = byId("header-search-results");
                if (panel) panel.hidden = true;
            }
            paintClear();
            sInput.focus();
        });
        paintClear();
    }

    var PEN_ON = "hud-pen";
    var PEN_SIZE = "hud-pen-size";
    var penSizes = {};
    try { penSizes = JSON.parse(store.get(PEN_SIZE) || "{}") || {}; } catch (e) { penSizes = {}; }

    var pens = [].slice.call(document.querySelectorAll("[data-hud-pen]"));
    var penInputs = [].slice.call(document.querySelectorAll("[data-hud-pen-size]"));

    function setPenSize(name, val) {
        penSizes[name] = val;
        store.set(PEN_SIZE, JSON.stringify(penSizes));
        var el = document.querySelector('[data-hud-pen="' + name + '"]');
        if (el) el.style.setProperty("--pen-size", String(val));
        publishPenCursor();
    }

    penInputs.forEach(function (input) {
        var name = input.getAttribute("data-hud-pen-size");
        var saved = penSizes[name];
        if (saved !== undefined && isFinite(parseFloat(saved))) input.value = String(saved);
        setPenSize(name, parseFloat(input.value));
        input.addEventListener("input", function () { setPenSize(name, parseFloat(input.value)); });
        input.addEventListener("click", function (e) { e.stopPropagation(); });
    });

    function publishPenCursor() {
        var on = null;
        for (var i = 0; i < pens.length; i++) if (pens[i].classList.contains("is-on")) on = pens[i];
        if (!on) { window.__mcPenCfg = null; return; }
        var name = on.getAttribute("data-hud-pen");
        var size = parseFloat(penSizes[name]);
        if (!isFinite(size)) size = 8;
        window.__mcPenCfg = name === "annot"
            ? { shape: "x", size: Math.round(6 + size * 0.75) }
            : { shape: "circle", size: Math.round(size * 1.7) };
    }

    var PEN_COLOR = "hud-pen-color";
    var penColors = {};
    try { penColors = JSON.parse(store.get(PEN_COLOR) || "{}") || {}; } catch (e) { penColors = {}; }

    function paintPenColor(name, color) {
        var el = document.querySelector('[data-hud-pen="' + name + '"]');
        if (!el) return;
        el.style.setProperty("--pen-color", color);
        var dots = el.querySelectorAll(".hud-pen__swatch");
        for (var i = 0; i < dots.length; i++) {
            dots[i].classList.toggle("is-on", dots[i].getAttribute("data-pen-c") === color);
        }
    }

    function setPenColor(name, color) {
        penColors[name] = color;
        store.set(PEN_COLOR, JSON.stringify(penColors));
        paintPenColor(name, color);
    }

    [].slice.call(document.querySelectorAll(".hud-pen__swatch")).forEach(function (dot) {
        var name = dot.getAttribute("data-hud-pen-color");
        var m = /--pen-c:\s*([^;"]+)/.exec(dot.getAttribute("style") || "");
        var color = m ? m[1].trim() : "#eaf3ff";
        dot.setAttribute("data-pen-c", color);
        dot.addEventListener("click", function (e) {
            e.stopPropagation();
            setPenColor(name, color);
        });
        if (penColors[name] === color) paintPenColor(name, color);
    });

    function activatePen(name) {
        pens.forEach(function (p) {
            var on = p.getAttribute("data-hud-pen") === name;
            p.classList.toggle("is-on", on);
            var btn = p.querySelector(".hud-pen__btn");
            if (btn) btn.setAttribute("aria-pressed", on ? "true" : "false");
        });
        store.set(PEN_ON, name || "");
        publishPenCursor();
    }

    pens.forEach(function (p) {
        var name = p.getAttribute("data-hud-pen");
        var btn = p.querySelector(".hud-pen__btn");
        if (!btn) return;
        btn.addEventListener("click", function () {
            activatePen(p.classList.contains("is-on") ? "" : name);
        });
    });
    activatePen("");
    Object.keys(penColors).forEach(function (n) { paintPenColor(n, penColors[n]); });

    var wxBtn = byId("hud-wechat");
    var toast = byId("hud-toast");
    var toastTimer = null;

    function say(text) {
        if (!toast) return;
        toast.textContent = text;
        toast.hidden = false;
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toast.hidden = true; }, 1800);
    }

    function fallbackCopy(text) {
        try {
            var ta = document.createElement("textarea");
            ta.value = text;
            ta.setAttribute("readonly", "");
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            var ok = document.execCommand && document.execCommand("copy");
            document.body.removeChild(ta);
            return !!ok;
        } catch (e) { return false; }
    }

    if (wxBtn) {
        wxBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            var text = wxBtn.getAttribute("data-copy") || "";
            var done = function (ok) { say(ok ? "已复制微信号:" + text : "微信号:" + text); };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(fallbackCopy(text)); });
            } else {
                done(fallbackCopy(text));
            }
        });
        document.addEventListener("click", function () { if (toast) toast.hidden = true; });
        document.addEventListener("keydown", function (e) { if (e.key === "Escape" && toast) toast.hidden = true; });
    }
})();
