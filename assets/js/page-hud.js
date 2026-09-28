/* ============================================================
   右侧 HUD 的交互层(第一刀)
   ─────────────────────────────────────────────────────────────
   这一版只管两件事:
     · 配色滑条(#palette-hue)→ 调 window.__hudPalette(算法在 hud-palette.js,
       那个文件被内联进 <head>,所以首帧前配色就已经就位了);
     · 音量滑条(#volume-range)→ 写 cd-audio.js 读的那个键(cd-audio-vol,0~1)。
   明暗旋钮(#theme-toggle)【不需要这里绑】:主题的 footer 脚本按 id 找它,
   换到这条栏里照样生效 —— 这就是当初坚持"控件按 id 找人"的好处。

   ★ 音量这一条要说实话:博客页上还没有播放器(左侧那条"音乐播放器"是后面几刀的事),
     所以这根滑条现在只是把偏好存进同一个键,首页的 CD 音频读的就是它。
     两边因此永远是同一个音量,不会各存一份。
   ============================================================ */
(function () {
    "use strict";

    var root = document.documentElement;
    var P = window.__hudPalette;
    var byId = function (id) { return document.getElementById(id); };

    /* ---------------- 配色滑条 ---------------- */
    var hue = byId("palette-hue");
    var hueVal = byId("hud-hue-val");

    function paintHue() {
        if (!hueVal || !hue) return;
        /* 没拖过就显示"默认":那时候页面用的是站点自己的配色,
           写一个色相数字反而是在骗人(见 hud-palette.js 开头第 2 条)。 */
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
        /* 主题一切换,同一组变量要按新的深浅重算一遍 */
        new MutationObserver(function () {
            if (P.stored() !== null) P.apply(parseFloat(hue.value));
        }).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    }

    /* ---------------- 音量滑条 ---------------- */
    var vol = byId("volume-range");
    var volVal = byId("hud-vol-val");

    function paintVol() {
        if (volVal && vol) volVal.textContent = vol.value + "%";
    }

    if (vol) {
        var v = 0.5;
        try {
            var f = parseFloat(localStorage.getItem("cd-audio-vol"));
            if (isFinite(f)) v = Math.min(1, Math.max(0, f));
        } catch (e) { }
        vol.value = String(Math.round(v * 100));
        paintVol();
        vol.addEventListener("input", function () {
            var n = Math.min(1, Math.max(0, parseFloat(vol.value) / 100));
            try { localStorage.setItem("cd-audio-vol", String(n)); } catch (e) { }
            /* 这个页面上真有音频模块时(以后加了播放器),让它跟着变 */
            try {
                window.dispatchEvent(new CustomEvent("hud-volume", { detail: n }));
            } catch (e) { }
            paintVol();
        });
    }
})();
