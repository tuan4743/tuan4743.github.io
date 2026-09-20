/* 诊断:把玩家放在某个位置,按指定的输入方式往前跑,打出逐帧轨迹。
 * 用法:cd gd-web && node tools/diag-run.ts <x块> <y块> <形态> <帧数> [输入] [gdir] [速度档] [每几帧打一次]
 *   输入 = idle(不按) | hold(一直按) | bot(机器人兜底)
 *
 * 为什么要它:"这个蓝弹簧到底把人弹到哪、翻不翻重力"这种问题,看常数表只能猜,
 * 放个人上去跑一遍就有数了 —— 塔段(pad 连弹上 23 格)就是这么一段段量出来的。 */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World, botThink } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';

const X = Number(process.argv[2] ?? 545);
const Y = Number(process.argv[3] ?? 8);
const MODE = (process.argv[4] ?? 'cube') as 'cube' | 'ship' | 'ball' | 'ufo' | 'wave' | 'robot' | 'spider';
const FRAMES = Number(process.argv[5] ?? 120);
const INPUT = (process.argv[6] ?? 'idle') as string;
/* 输入可以写成 hold:N —— 按住前 N 帧再松手。塔段("贴天花板时按一下从门底下钻过去")
   全靠这个:一直按会一路弹到天花板上飞出去,一直松又会被撞死。
   ★ 还可以写成 pat=0011 —— 按这个 0/1 串【循环】按键,用来扫"起跳时机差几帧"。 */
const HOLD_N = INPUT.startsWith('hold:') ? Number(INPUT.slice(5)) : -1;
const PAT = INPUT.startsWith('pat=') ? INPUT.slice(4) : '';
const kind = INPUT.startsWith('hold:') ? 'hold' : INPUT;
const GDIR = Number(process.argv[7] ?? 1) < 0 ? -1 : 1;
const SPEED = Number(process.argv[8] ?? 1);
const EVERY = Number(process.argv[9] ?? 3);
const WHY = process.argv.includes('--why');    // 每帧列出"谁的外框压着玩家"(查弹簧/门到底哪一帧生效)
type B = { x0: number; y0: number; x1: number; y1: number; o: { kind: string; pad?: string; orb?: string; rot?: number; to?: string } };
const overlapped = (): string[] => {
  const out: string[] = [];
  const bx = [[w.x, w.x + w.box, w.y, w.y + w.box]];
  const lists: Array<[string, B[]]> = [
    ['弹簧', w.pads as unknown as B[]], ['环', w.orbs as unknown as B[]],
    ['门', w.portals as unknown as B[]], ['实心', w.solids as unknown as B[]],
  ];
  for (const [tag, list] of lists) {
    for (const b of list) {
      for (const [x0, x1, y0, y1] of bx) {
        if (x1 <= b.x0 || x0 >= b.x1 || y1 <= b.y0 || y0 >= b.y1) continue;
        out.push(tag + (b.o.pad ?? b.o.orb ?? b.o.to ?? b.o.kind)
          + '@' + (b.x0 / U).toFixed(1) + ',' + (b.y0 / U).toFixed(1)
          + (b.o.rot ? 'rot' + b.o.rot : ''));
      }
    }
  }
  return out;
};

const w = new World(WATER_CHART);
w.windowed = true;
w.x = X * U; w.y = Y * U; w.vy = 0; w.onGround = true;
w.mode = MODE; w.gdir = GDIR; w.speedIdx = SPEED;
w.checkX = w.x; w.checkY = w.y;

const out: string[] = [];
const mark = (i: number) => (i % EVERY === 0 ? '[' + i + ']' : '');
for (let i = 0; i < FRAMES; i++) {
  if (w.dead || w.done) break;
  if (INPUT === 'bot') w.frame(botThink(w));
  else if (PAT) w.frame(PAT[i % PAT.length] === '1');
  else if (HOLD_N >= 0) w.frame(i < HOLD_N);
  else w.frame(kind === 'hold');
  if (i % EVERY === 0 || WHY) {
    out.push(mark(i) + (w.x / U).toFixed(2) + ':' + (w.y / U).toFixed(2) + w.mode[0]
      + (w.gdir < 0 ? '↑' : '↓') + ' vy=' + (w.vy / U).toFixed(1)
      + (w.onGround ? ' G' : '') + (w.y < 0 ? ' 掉出去!' : '')
      + (WHY ? ' {压着:' + (overlapped().join(',') || '无') + '}' : ''));
  }
  if (w.y < -20 * U) break;
}
console.log('起点 x=' + X + ' y=' + Y + ' ' + MODE + ' 输入=' + INPUT + ' gdir=' + GDIR + ' 速度档=' + SPEED);
console.log(out.join('  '));
console.log('结束:' + (w.x / U).toFixed(2) + ':' + (w.y / U).toFixed(2) + ' ' + w.mode
  + (w.gdir < 0 ? ' ↑反重力' : ' ↓常重力') + (w.dead ? ' 【死了】' : '') + (w.done ? ' 【通关】' : ''));
