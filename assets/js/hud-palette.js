/* ============================================================
   背景配色:一个色相角 → 整套主题变量
   ─────────────────────────────────────────────────────────────
   用户选的做法是"真的 HSV 色相滑条,连续调"(不是五档预设):
   右下角那根滑条给一个色相 h,这里把整套配色变量算出来,写成
   <html> 上的内联自定义属性。

   ★ 为什么是一个独立文件、而且被【内联进 <head>】(见 extend_head.html):
     配色必须在首帧之前就位,否则会先闪一下默认配色再变。
     内联的是同一个文件(不是抄一份),所以算法只有这一处 —— 见 tests/page-hud.test.mjs。

   ★★ 三件必须记住的事
   1) 只对 .shell-page(首页之外的那些页面)生效:内联变量比任何样式表规则都硬
      (它压得过 [data-theme] 和 [data-palette]),要是不加这道门,
      首页那块平板主界面自己的配色面板(theme-palette.js)会被这里按死成"点了没反应"。
   2) 没拖过滑条(没有 pref-palette-hue)时【什么都不写】——
      页面照旧用站点自己的配色(含 [data-palette] 那几套预设),不偷偷改用户的观感。
   3) 主题切换(data-theme 变了)要重算一遍:同一组变量在深浅两个主题下不是同一套值。

   旧键迁移:老用户 localStorage 里存的是预设名(pref-palette),
   那几套预设折算成色相就是 LEGACY 表,滑条初始位置据此对齐。
   ============================================================ */
(function () {
    "use strict";

    var KEY = "pref-palette-hue";
    var LEGACY_PALETTE_KEY = "pref-palette";

    /* 旧的四套预设 + 默认 折算出的色相(滑条初始位置用) */
    var LEGACY = { "": 220, "default": 220, "mist": 218, "warm": 33, "mint": 160, "violet": 262 };

    /* 色相 → 整套变量。深浅两套分开写:
       浅色:底极亮、字极暗;深色:底极暗、字极亮。
       饱和度都压得比较低(12%~34%)——再高就不像"底色"而像"色块"了。 */
    function pal(h, dark) {
        h = ((h % 360) + 360) % 360;
        if (dark) {
            return [
                ["--theme", "hsl(" + h + ", 20%, 9%)"],
                ["--entry", "hsl(" + h + ", 18%, 13%)"],
                ["--border", "hsl(" + h + ", 16%, 25%)"],
                ["--primary", "hsl(" + h + ", 16%, 92%)"],
                ["--secondary", "hsl(" + h + ", 12%, 62%)"],
                ["--tertiary", "hsl(" + h + ", 14%, 30%)"],
                ["--content", "hsl(" + h + ", 14%, 86%)"],
                ["--code-bg", "hsl(" + h + ", 20%, 8%)"]
            ];
        }
        return [
            ["--theme", "hsl(" + h + ", 30%, 97%)"],
            ["--entry", "hsl(" + h + ", 34%, 99%)"],
            ["--border", "hsl(" + h + ", 22%, 87%)"],
            ["--primary", "hsl(" + h + ", 28%, 14%)"],
            ["--secondary", "hsl(" + h + ", 16%, 42%)"],
            ["--tertiary", "hsl(" + h + ", 20%, 84%)"],
            ["--content", "hsl(" + h + ", 26%, 16%)"],
            ["--code-bg", "hsl(" + h + ", 26%, 96%)"]
        ];
    }

    function isShell() {
        return document.documentElement.classList.contains("shell-page");
    }

    /* 用户拖过的色相(没有就返回 null —— 这个区别很重要,见开头第 2 条) */
    function stored() {
        try {
            var raw = localStorage.getItem(KEY);
            if (raw === null || raw === "") return null;
            var v = parseFloat(raw);
            return isFinite(v) ? v : null;
        } catch (e) {
            return null;
        }
    }

    /* 滑条该停在哪儿:拖过就用拖过的;没拖过就按旧的预设折算 */
    function initialHue() {
        var s = stored();
        if (s !== null) return s;
        var legacy = "";
        try { legacy = localStorage.getItem(LEGACY_PALETTE_KEY) || ""; } catch (e) { }
        return LEGACY[legacy] === undefined ? LEGACY[""] : LEGACY[legacy];
    }

    function apply(h) {
        if (!isShell()) return;
        var dark = document.documentElement.dataset.theme === "dark";
        var list = pal(h, dark);
        for (var i = 0; i < list.length; i++) {
            document.documentElement.style.setProperty(list[i][0], list[i][1]);
        }
        document.documentElement.dataset.hue = String(Math.round(((h % 360) + 360) % 360));
    }

    /* 拖滑条走这条:存下来 + 立刻生效 */
    function set(h) {
        try { localStorage.setItem(KEY, String(h)); } catch (e) { }
        apply(h);
    }

    /* 首帧还原:只在"拖过"的时候写,没拖过一概不动 */
    var saved = stored();
    if (saved !== null) apply(saved);

    window.__hudPalette = {
        apply: apply,
        set: set,
        stored: stored,
        initialHue: initialHue,
        LEGACY: LEGACY,
        KEY: KEY
    };
})();
