/* 背景配色切换:点击画板按钮循环切换,localStorage 持久化 */
(function () {
  "use strict";
  var PALETTES = ["", "mist", "warm", "mint", "violet"];
  var btn = document.getElementById("palette-toggle");
  if (!btn) return;

  function currentIndex() {
    var p = document.documentElement.dataset.palette || "";
    var i = PALETTES.indexOf(p);
    return i === -1 ? 0 : i;
  }

  btn.addEventListener("click", function () {
    var next = (currentIndex() + 1) % PALETTES.length;
    var p = PALETTES[next];
    if (p) {
      document.documentElement.dataset.palette = p;
    } else {
      delete document.documentElement.dataset.palette;
    }
    try {
      localStorage.setItem("pref-palette", p || "default");
    } catch (e) {}
  });
})();
