/* GD 物件 ID → 我们的物件 的映射表 + 覆盖率报告。
 *
 * ★ 重要说明(别当成"已经校准好了"):
 *   GD 的物件 ID 表有上千项,而且 2.2 之后还在长。**我没有把整张表凭记忆写死** ——
 *   记错一位就会把方块映射成刺,那比"不认识"糟得多。所以这张表是这样用的:
 *     1. 结构(分类 / 置信度 / 备注)先立好;
 *     2. 只有【高置信】的几条先写进去;
 *     3. 剩下的靠 tools/gmd-report.ts 对着**真实的 .gmd** 一条条校准:
 *        报告会把"这张图里出现了哪些 ID、各多少个、我认不认识"全列出来。
 *
 *   校准顺序建议:先对齐"方块 / 刺 / 平台"这三类(占了老关卡几何的绝大多数),
 *   再补跳环、弹簧、门,最后才是装饰(装饰就算不认识也不影响能不能玩)。
 */

/** 我们引擎能表达的物件种类(见 sim/level.ts 的 ObjKind) */
export type OurKind =
  | 'block' | 'spike' | 'saw' | 'platform' | 'orb' | 'pad' | 'portal' | 'speed'
  | 'gravity' | 'size' | 'teleport' | 'force' | 'trigger' | 'text' | 'check' | 'deco';

export type Confidence = 'high' | 'mid' | 'low';

export interface MapEntry {
  kind: OurKind;
  conf: Confidence;
  /** 需要的额外参数(比如是哪种环) */
  arg?: string;
  note: string;
}

/** 我们引擎【还没有】的东西:报告里会按这些类归堆,一眼看出"这张图缺什么" */
export type Gap =
  | 'slope'        // 坡道(2.0+ 到处都是)—— 我们没做坡,必须替换或删
  | 'gamemode'     // 球/UFO/波浪/机器人/蜘蛛段(引擎已支持形态,但要靠门切)
  | 'deco'         // 纯装饰(不认识也不影响能不能玩)
  | 'trigger'      // 触发器(我们只做了 move/color/pulse)
  | 'move-obj'     // 移动物件(要用触发器推)
  | 'unknown';     // 完全没见过

export interface Report {
  total: number;
  known: number;
  unknown: number;
  byKind: Record<string, number>;
  byId: Array<{ id: number; n: number; mapped: MapEntry | null }>;
  gaps: Record<string, number>;
}

/** ID → 我们的物件。只有高置信的先写;其余等真实文件校准(见文件头说明)。 */
export const GD_MAP: Record<number, MapEntry> = {
  1: { kind: 'block', conf: 'high', note: '最基础的方块(整个编辑器第一格)' },
  8: { kind: 'spike', conf: 'mid', note: '常被引用的"尖刺"ID;必须拿真实图确认一次' },
  39: { kind: 'spike', conf: 'low', arg: 'small', note: '疑似小刺;待校准' },
  103: { kind: 'spike', conf: 'low', arg: 'big', note: '疑似大刺;待校准' },
};

/** 粗略分类:给报告用的"缺口归类"。
 *  这些区间是社区口径的**大致**范围(不是逐条核实过的),所以只用来分组统计,
 *  不会拿去生成关卡 —— 报告里会明说这一点。 */
export function gapOf(id: number): Gap | null {
  if (id >= 1000) return 'trigger';          // 1000+ 基本是触发器/新物件
  if (id >= 500) return 'deco';              // 装饰、文字、粒子
  if (id >= 200 && id < 500) return 'unknown'; // 混合区(很多东西都在这儿)
  return null;
}

export function classify(id: number): MapEntry | null {
  return GD_MAP[id] ?? null;
}

/** 对着一个已解析的关卡算覆盖率 */
export function coverage(objects: Array<{ id: number }>): Report {
  const byIdMap = new Map<number, number>();
  for (const o of objects) byIdMap.set(o.id, (byIdMap.get(o.id) ?? 0) + 1);
  const byId = [...byIdMap.entries()]
    .map(([id, n]) => ({ id, n, mapped: classify(id) }))
    .sort((a, b) => b.n - a.n);
  const byKind: Record<string, number> = {};
  const gaps: Record<string, number> = {};
  let known = 0;
  for (const row of byId) {
    if (row.mapped) {
      known += row.n;
      byKind[row.mapped.kind] = (byKind[row.mapped.kind] ?? 0) + row.n;
    } else {
      const g = gapOf(row.id) ?? 'unknown';
      gaps[g] = (gaps[g] ?? 0) + row.n;
    }
  }
  return { total: objects.length, known, unknown: objects.length - known, byKind, byId, gaps };
}

/** 把报告排成一段能直接读的文字 */
export function formatReport(r: Report): string {
  const pct = (n: number) => (r.total ? (n / r.total * 100).toFixed(1) + '%' : '0%');
  const lines: string[] = [];
  lines.push('物件总数 ' + r.total + ' · 认识 ' + r.known + '(' + pct(r.known) + ')· 不认识 ' + r.unknown + '(' + pct(r.unknown) + ')');
  if (Object.keys(r.byKind).length) {
    lines.push('');
    lines.push('【认识的部分,按我们的物件归类】');
    for (const [k, n] of Object.entries(r.byKind).sort((a, b) => b[1] - a[1])) {
      lines.push('  ' + k.padEnd(10) + String(n).padStart(6));
    }
  }
  if (Object.keys(r.gaps).length) {
    lines.push('');
    lines.push('【不认识的部分,按"缺什么"归类】');
    const why: Record<string, string> = {
      slope: '坡道 —— 我们没做坡,导入时要替换成方块或删掉',
      gamemode: '别的形态段 —— 引擎支持形态,但得靠门切',
      deco: '纯装饰 —— 不影响能不能玩',
      trigger: '触发器 —— 我们只做了 move/color/pulse',
      'move-obj': '移动物件 —— 要用触发器推',
      unknown: '没归类 —— 需要拿真实文件逐条校准',
    };
    for (const [k, n] of Object.entries(r.gaps).sort((a, b) => b[1] - a[1])) {
      lines.push('  ' + k.padEnd(10) + String(n).padStart(6) + '   ' + (why[k] ?? ''));
    }
  }
  lines.push('');
  lines.push('【用得最多的 20 个 ID】(用来决定校准顺序:先对齐高频的)');
  for (const row of r.byId.slice(0, 20)) {
    lines.push('  id ' + String(row.id).padStart(6) + ' ×' + String(row.n).padStart(5) + '   ' +
      (row.mapped ? row.mapped.kind + '(' + row.mapped.conf + ')' : '未映射'));
  }
  return lines.join('\n');
}
