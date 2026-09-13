/* 博客页面里的入口:找 #gd-canvas 启动引擎。
   手机端不启动(站点在手机上本来就展不开),改显示一段"请用 PC 打开"的说明。 */
import { boot } from './main.ts';

const canvas = document.getElementById('gd-canvas') as HTMLCanvasElement | null;
const isPhone = /Android|iPhone|iPod|Mobile/i.test(navigator.userAgent)
  || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 900);

if (!canvas) {
  // 页面上没有画布:什么都不做(不该发生,留个记号方便排查)
  document.documentElement.setAttribute('data-gd', 'no-canvas');
} else if (isPhone) {
  document.documentElement.setAttribute('data-gd', 'mobile');
} else {
  document.documentElement.setAttribute('data-gd', 'ok');
  boot(canvas);
}
