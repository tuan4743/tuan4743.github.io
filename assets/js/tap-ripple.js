/* ============================================================
   触摸落点桥接
   —— 手机/平板没有磁吸光标,点按反馈交给【背景本身】:
      把落点(归一化坐标)递给 void-bg 的 __voidBgTap:
      · 暗模式(缺陷海):落点处一次微型成核 —— 三层粒子旋进
        消失 + 中心一粒真空光晕亮起回落(成核事件的同语言小型版);
      · 亮模式(粒子球):最近一颗球被"敲响",立刻泛一道外扩波。
   —— 桌面端(pointer:fine)不挂;reduced-motion 由背景侧兜底。
   ============================================================ */
(function () {
    "use strict";

    if (!window.matchMedia("(pointer: coarse)").matches) return;

    document.addEventListener("pointerdown", function (e) {
        var fn = window.__voidBgTap;
        if (!fn) return;                      /* 背景没挂(首页等)就静默 */
        fn(e.clientX / Math.max(1, window.innerWidth),
           e.clientY / Math.max(1, window.innerHeight));
    }, { passive: true });
})();
