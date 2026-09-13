/* 博客页面里的入口:找 #gd-canvas 启动引擎。
   手机端不启动(站点在手机上本来就展不开),改显示一段"请用 PC 打开"的说明。
   ★ 歌可以外部指定:游玩模式插盘时 intro.js 会写 window.__GD_SONG(这张盘的歌),
     这里把它交给引擎 —— 引擎每局开始时读一次,所以中途换盘再开跑也会用新歌。 */
import { boot } from './main.ts';

const canvas = document.getElementById('gd-canvas') as HTMLCanvasElement | null;
const isPhone = /Android|iPhone|iPod|Mobile/i.test(navigator.userAgent)
  || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 900);

function songOverride(): string | undefined {
  const w = window as unknown as { __GD_SONG?: string };
  if (typeof w.__GD_SONG === 'string' && w.__GD_SONG) return w.__GD_SONG;
  const fromDom = document.documentElement.getAttribute('data-gd-song');
  return fromDom || undefined;
}

if (!canvas) {
  // 页面上没有画布:什么都不做(不该发生,留个记号方便排查)
  document.documentElement.setAttribute('data-gd', 'no-canvas');
} else if (isPhone) {
  document.documentElement.setAttribute('data-gd', 'mobile');
} else {
  document.documentElement.setAttribute('data-gd', 'ok');
  boot(canvas, { song: songOverride() });
}
