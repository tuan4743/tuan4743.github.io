(function () {
    "use strict";

    var KEY = "pref-palette-hue";
    var LEGACY_PALETTE_KEY = "pref-palette";

    var LEGACY = { "": 220, "default": 220, "mist": 218, "warm": 33, "mint": 160, "violet": 262 };

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

    function set(h) {
        try { localStorage.setItem(KEY, String(h)); } catch (e) { }
        apply(h);
    }

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
