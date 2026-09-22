/* 娓叉煋灞?Phaser 4 鍙仛"鐢?鍜?鏀惰緭鍏?,鎵€鏈夊垽瀹氶兘鏉ヨ嚜 sim/銆?
 * 椋庢牸:鏈珯鐨?holo / 鏄剧ず鍣ㄨ瑷€ 鈥斺€?娣卞簳銆侀潚鑹叉弿杈广€佺粏缃戞牸銆佸彂鍏夊渾鐜€佺瓑瀹藉瓧銆?
 *
 * 杩欎竴鐗堜慨鐨勪笁浠跺ぇ浜?閮芥槸鐢ㄦ埛瀹炴祴鍙嶉):
 *   鈶?銆愪笂涓嬬炕杞€戜笘鐣屽潗鏍?y 鍚戜笂,鑰?Phaser 鐩告満 y 鍚戜笅 鈥斺€?鎵€鏈?y 鐜板湪缁熶竴杩?Y() 杞崲,
 *      浜庢槸"涓嬭惤"鐪嬬潃鏄笅钀姐€佸皷鍒烘湞涓娿€佸湴闈㈠湪搴曢儴;
 *   鈶?銆愪竴灞忓楂樸€戝師鐗堝彛寰勬槸涓€灞?10 鏍奸珮(VIEW_H_BLOCKS),绾靛悜闈犺窡闅忛暅澶寸湅;
 *   鈶?銆愭寜鎷嶅瓙璧般€戦摵闈㈡槸鎸?onset 鏀剧殑,鎵€浠ョ敾闈㈢殑鏃堕棿杞淬€愮敱闊充箰椹卞姩銆?
 *      姣忓抚璇?audio.currentTime,妯℃嫙鎺ㄨ繘鍒板搴旂殑閭ｄ竴甯?澶嶆椿鏃舵妸闊充箰 seek 鍒板瓨妗ｇ偣鐨勬椂闂淬€?
 */

import Phaser from 'phaser';
import { generateLevel, makeRealTimeAxis, type Level, type Mode, type Obj } from './sim/level.ts';
import { World, botThink, type RunState } from './sim/world.ts';
import { frameRects } from './sim/gdids.ts';
import { fingerprint } from './sim/replay.ts';
import { P, U, Y_TIME_SCALE } from './sim/constants.ts';
import { WATER_CHART } from './sim/charts/water.ts';

const HL = '#7ff0ff';
/* 姣忔涓€涓己璋冭壊:缃戞牸銆佸湴闈€侀棬鐨勯鑹查兘璺熺潃璧?涓€鐪肩煡閬撹窇鍒扮鍑犳 */
const PAL = [0x7ff0ff, 0xffe17a, 0xa0ffd0, 0xc6a0ff, 0xff9fd0];
const HLD = 0x7ff0ff;
const WARN = 0xff9a6b;
/** 瑙嗗彛楂樺害(鍧?銆傗槄 鍘熺増鍙ｅ緞:璁捐鍒嗚鲸鐜?480脳320銆? 鍧?= 30 鍗曚綅 鈫?10.67 鏍?
 *  鐢ㄦ埛鍦ㄥ師鐗堥噷鏁板埌鐨勬槸 11 鏍?鍙栨暣),鎵€浠ヨ繖閲屾寜 11 鏉?鈥斺€?涓€灞忚嚦灏戝埆姣斿師鐗堝皯銆?*/
const VIEW_H_BLOCKS = 11;
/** 娓叉煋鍒嗚鲸鐜囩郴鏁?缂撳啿楂樺害 = 720 脳 杩欎釜鍊?缂撳啿瀹藉害鐢辩洅瀛愮殑闀垮姣旀帹鍑烘潵)銆?
 *  1.0 = 涓嶉檷鐢昏川;璋冨皬鍙互灏戠敾鐐瑰儚绱犳崲甯х巼(鏂瑰潡鍦ㄥ睆骞曚笂杩樻槸涓€鏍峰ぇ,鍙槸鐣ヨ蒋)銆?*/
const RENDER_SCALE = 1;
/** 娓叉煋缂撳啿鐨勫儚绱犱笂闄?瀹矫楅珮):瓒呰繃灏辩瓑姣旂缉涓€妗ｃ€?
 *  1280脳720 鈮?92 涓?杩欓噷缁欏埌 115 涓?鈥斺€?甯歌绐楀彛鐢ㄤ笉鍒?
 *  浣嗙洅瀛愮壒鍒鏃?鏄剧ず鍣ㄨ创鍥炬槸琚媺浼稿～婊¤鍙ｇ殑,瀹藉睆姣斾緥鑳藉埌 2.4:1)鑳藉厹浣忓抚鐜囥€?*/
const BUF_BUDGET = 1_150_000;
/** 缁樺埗瑁佸壀鐨勪綑閲?鍗曚綅):瑙﹀彂鍣ㄤ細鎺ㄧ墿浠?绮楃瓫鏃剁暀鍑轰竴鍧?
 *  鍏嶅緱"灞忓箷澶栨琚帹杩涙潵"鐨勪笢瑗胯鎻愬墠鍓旀帀銆?*/
const CULL_MARGIN = 24 * 30;
/* 鐩告満绾靛悜鐨勫師鐗堝父閲?鍗曚綅銆佹湞涓?鍑鸿嚜 OpenGD 鐨?PlayLayer::updateCamera 鈥斺€?鐢ㄦ埛瑕佹眰鐓ф惉):
 *   鏂瑰潡褰㈡€?浜鸿鍥板湪瑙嗛噹閲岀殑涓€鏉″甫瀛愰噷 鈥斺€?涓嬫部(cam + unk3)銆佷笂娌?cam + 灞忓箷楂?鈭?unk2),
 *             鍙湁瓒婂嚭杩欐潯甯﹀瓙鐩告満鎵嶅姩,涓€鍔ㄥ氨鎶婁汉璐村洖甯﹀瓙杈圭紭;
 *   璺戝湪銆愬湴闈€?涓嶆槸鏂瑰潡)涓婃椂:鐩告満鍥炶惤鍒板湴闈㈤珮搴?cam.y = 0 鈫?瑙嗛噹涓嬭竟 = 鈭?0 鍗曚綅);
 *   椋炶绫?/ 鐞?杩涢棬閭ｄ竴鍒绘妸瑙嗗彛涓績閽夋(m_fCameraYCenter)銆?*/
const CAM_LOW = 90;                       // 涓婃部浣欓噺 3 鏍?
const CAM_MID = 120;                      // 涓嬫部浣欓噺 4 鏍?
const CAM_GROUND_BOTTOM = -90;            // 绔欏湪鍦伴潰涓?瑙嗛噹涓嬭竟(鍦伴潰涔嬩笂 3 鏍?
const CAM_FLY_BELOW = 180;                // 杩涢棬鏃剁畻"浣庣┖"鐨勯槇鍊?6 鏍?
const CAM_FLY_CENTER = 150;               // 浣庣┖杩涢棬 鈫?瑙嗗彛涓績鍥哄畾鍦?5 鏍?
const CAM_BALL_BELOW = 150;
const CAM_BALL_CENTER = 120;
/** 瑙嗗彛銆愰拤姝汇€戠殑褰㈡€?鍘熺増:闄ゆ柟鍧楀閮藉浐瀹?鐢ㄦ埛鐐瑰悕 Wave/UFO 灏辨槸杩欐牱)銆?
 *  鈽?鏈哄櫒浜?/ 铚樿洓:OpenGD 娌＄粰瀹冧滑璁句腑蹇?娌跨敤涓婁竴涓€?,浣嗙敤鎴烽偅鍏宠繖涓ゆ瑕佺旱鐖?5~16 鏍?
 *    閽夋浼氭妸浜烘媿鍑虹敾澶?鈥斺€?鎵€浠ヨ繖涓ょ鎸夋柟鍧楄窡闅忋€傝繖涓よ鏄垜浠嚜宸卞畾鐨?宸插啓杩涙枃妗ｃ€?*/
const CAM_FIXED_MODES = new Set(['ship', 'ufo', 'wave', 'ball']);

/* ---------------- 鈽?褰㈡€佽创鍥?static/icons)----------------
 * 鈽呪槄 缁撹(2026-09 瀹炴祴,鍐欑粰浠ュ悗鐨勪汉):
 *   杩欏鍥鹃泦鏄€愮湡路GD 鐜╁鍥鹃泦銆?浣嗗畠鏄?*鎸夐儴浠舵媶寮€**鐨?鈥斺€?鍚屼竴褰㈡€佺殑 `_2_`(绗簩鑹?銆乣_extra_`(纰庣偣)銆?
 *   `_glow_`(鎻忚竟)浠ュ強 02/03/04 閭ｅ嚑甯?鑵?鐪肩潧/闈㈢僵鈥?**鐢诲竷灏哄鍚勪笉鐩稿悓**,闈?`spriteOffset` 瀵归綈;
 *   瑕佹嫾鍑轰竴涓纭殑褰㈡€?闇€瑕?GD 鐨?*閮ㄤ欢鍚堟垚琛?*(鍝簺閮ㄤ欢鍙犲湪涓€璧枫€佸摢鍑犲抚鏄姩鐢?,鎴戜滑娌℃湁銆?
 *   瀹炴祴鎶?甯у彿杞挱"褰撳姩鐢?= 涓€浼氬効鍙湁鑵裤€佷竴浼氬効鍙湁鐪肩潧(鐢ㄦ埛鎶ョ殑"spider鐨勮创鍥炬槸涔辩殑"灏辨槸杩欎釜),
 *   鑰?鍙栨渶澶х殑涓€甯у綋鏁村彧瑙掕壊"涔熶笉琛?spider 鎷垮埌鐨勬槸韬綋銆乺obot 鎷垮埌鐨勬槸闈㈢僵)銆?
 *   鈬?榛樿**涓嶅惎鐢?*鍥鹃泦,鐜╁浠嶆棫璧扮煝閲忕敾娉?鑷冲皯褰㈢姸鏄鐨?;鎯宠瘯鍥鹃泦灏卞姞 `?icons=1`銆?
 *   鍙﹀杩欏绱犳潗鏈夈€愪袱澶勬枃浠堕敊閰嶃€?瀹炴祴鎸?plist 閲岀殑 metadata.size 瀵瑰嚭鏉ョ殑):
 *     路 cube.png(208脳252) 涓?cube.plist(澹版槑 252脳244)瀵逛笉涓?鈥斺€?搴旇鎹㈠洖閰嶅鐨勯偅寮?
 *     路 GameSheet.png(3091脳2048) 涓?GameSheet.plist(澹版槑 3081脳2048)瀵逛笉涓?
 *       鑰?GameSheet_old.png(3081脳2048)姝ｅソ瀵瑰緱涓?鈬?瑕佺敤鐗╀欢鍥鹃泦璇风敤 old 閭ｅ紶(鎴栭噸鏂板鍑?銆?
 *   涓嬮潰鐨勫姞杞藉櫒浼氳嚜鍔ㄦ寫"灏哄涓?plist 澹版槑涓€鑷?鐨勯偅寮?png,鎸戜笉鍒板氨璺宠繃(涓嶄細鐢诲嚭閿欎綅鐨勫浘)銆?*/
const ICON_ENABLED = /(^|[?&])icons=1(&|$)/.test(location.search);
/** 鈽呪槄 鐗╀欢璐村浘:2026-09 鐢ㄦ埛瀹炴祴"鍏ㄦ槸閿欒璐村浘",**榛樿鍏虫帀**,鍥炲埌鐭㈤噺鐢绘硶銆?
 *  涓轰粈涔堥敊:GD 鐨勭墿浠剁編鏈槸銆愮浠?+ 杩愯鏃舵寜浠ｇ爜鍧愭爣鎷艰銆戠殑 鈥斺€?
 *    路 褰㈡€侀棬 = portalshine + back + extra + extra_2 + front 浜斿眰,灞備笌灞傜殑鐩稿浣嶇疆鍦?exe 閲屽啓姝?
 *    路 璺崇幆 = 鐧芥ā + 杩愯鏃舵煋鑹?鍗曠湅搴曞浘鍒嗕笉鍑烘槸鍝釜鐜?;
 *    路 鐮栧潡 block001_01..07 = 鎸夐偦灞呰嚜鍔ㄦ嫾鎺ョ殑 7 鍧?鍝潡瀵瑰簲鍝潯杈?plist 閲屾病鏈?;
 *  鑰?plist 鍙粰"姣忓潡澶氬ぇ銆佸湪鍥鹃泦鍝効",涓嶇粰"鎽嗗湪鍝? 鈬?鎴戞寜"鍚勮嚜鐢诲竷涓績瀵归綈"鎷煎嚭鏉ョ殑鍏ㄦ槸閿欎綅纰庣墖銆?
 *  鎵€浠?榛樿**涓嶅姞杞?*杩欏紶鍥鹃泦(鐪?121 KB),瑕佺爺绌跺氨鍔?`?art=1`(浠ｇ爜淇濈暀,鍒啀褰撻粯璁?銆?*/
const ART_ENABLED = /(^|[?&])art=1(&|$)/.test(location.search);
/** 鈽呪槄 鏃犳晫妯″紡鐨?杞ㄩ亾涓婇檺"(鐢ㄦ埛鍙ｅ緞:"缁欐棤鏁屾ā寮忓姞涓笂闄?涓嶅厑璁歌劚绂婚瀹氳建閬?)銆?
 *  涓轰粈涔?鏃犳晫鏈韩瑙ｅ喅涓嶄簡"浜哄崱鍑哄/椋炲埌澶╀笂"鈥斺€?浠ュ墠鍙创浣忓叧鍗¤竟鐣?0 ~ 127 鏍?,
 *  浜庢槸寮€浜嗘棤鏁屽氨鑳戒竴璺鍒?y=110 鎶婃暣鍏崇粫杩囧幓,鐜╄捣鏉ュ畬鍏ㄤ笉鏄繖寮犲浘銆?
 *  鐜板湪:寮€鐫€鏃犳晫鏃?鎶婁汉澶瑰湪銆愯鍒掕蛋寤娿€?tools/plan.ts 绠楀嚭鏉ョ殑閭ｆ潯,y 瀹炴祴 9~18 鏍?卤BAND 鍧椾箣鍐?
 *  瓒呭嚭灏辨妸绾靛悜浣嶇疆鎷夊洖杈圭晫骞舵竻鎺夋湞澶栫殑閫熷害 鈥斺€?妯悜鐓ф棫鑷敱璧般€俙?band=12` 鍙互鏀惧銆?*/
const GUIDE_BAND = Math.max(1, Number(/(^|[?&])band=([\d.]+)/.exec(location.search)?.[2] ?? 6));
const ICON_ATLAS: Array<{ mode: Mode; key: string; file: string }> = [
  { mode: 'cube', key: 'icon-cube', file: 'cube' },
  { mode: 'ship', key: 'icon-ship', file: 'ship' },
  { mode: 'ball', key: 'icon-ball', file: 'ball' },
  { mode: 'ufo', key: 'icon-ufo', file: 'bird' },
  { mode: 'wave', key: 'icon-wave', file: 'dart' },
  { mode: 'robot', key: 'icon-robot', file: 'robot' },
  { mode: 'spider', key: 'icon-spider', file: 'spider' },
];

/** 瑙ｆ瀽 TexturePacker 鐨?.plist(XML)鈫?甯ц〃(鍚棆杞爣璁颁笌 spriteOffset)銆?
 *  涓轰粈涔堣鑷繁鍐?Phaser 4.2 鐨?`load.atlasXML` 鍙姞杞藉浘鐗囥€佷笉瑙ｆ瀽 plist(瑙?buildIcons 鐨勬敞閲?銆?*/
function parsePlistFrames(xml: string): Record<string, {
  frame: { x: number; y: number; w: number; h: number };
  rotated: boolean;
  sourceSize: { w: number; h: number };
  spriteSourceSize: { x: number; y: number; w: number; h: number };
}> | null {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const root = doc.querySelector('plist > dict');
  if (!root) return null;
  const kids = Array.from(root.children);
  const fi = kids.findIndex((e) => e.tagName === 'key' && e.textContent === 'frames');
  if (fi < 0) return null;
  const out: NonNullable<ReturnType<typeof parsePlistFrames>> = {};
  const list = Array.from(kids[fi + 1].children);
  for (let j = 0; j < list.length; j++) {
    if (list[j].tagName !== 'key') continue;
    const name = (list[j].textContent ?? '').trim();
    const inner = Array.from(list[j + 1]?.children ?? []);
    const get = (k: string) => {
      const idx = inner.findIndex((e) => e.tagName === 'key' && e.textContent === k);
      return idx >= 0 ? (inner[idx + 1]?.textContent ?? '') : '';
    };
    const rect = get('textureRect').match(/\{\{(-?[\d.]+),(-?[\d.]+)\},\{(-?[\d.]+),(-?[\d.]+)\}\}/);
    if (!rect) continue;
    const ss = get('spriteSourceSize').match(/\{(-?[\d.]+),(-?[\d.]+)\}/);
    const off = get('spriteOffset').match(/\{(-?[\d.]+),(-?[\d.]+)\}/);
    out[name] = {
      frame: { x: +rect[1], y: +rect[2], w: +rect[3], h: +rect[4] },
      rotated: get('textureRotated') === 'true',
      sourceSize: { w: +(ss?.[1] ?? rect[3]), h: +(ss?.[2] ?? rect[4]) },
      /* plist 鐨?spriteOffset 鏄?鐩稿鏈鍓綅鍥句腑蹇?鐨勫亸绉?y 杞存柟鍚戝拰 Phaser 鐩稿弽 */
      spriteSourceSize: { x: +(off?.[1] ?? 0), y: -(+(off?.[2] ?? 0)), w: +rect[3], h: +rect[4] },
    };
  }
  return Object.keys(out).length ? out : null;
}

/** 浠庨〉闈笂鎸戣繖涓€灞€鐢ㄥ摢寮犻摵闈?window.__GD_CHART = 'gen' 鐢ㄨ€佺殑鑷姩閾洪潰,鍏跺畠鐢ㄧ湡瀹為摵闈?*/
function pickLevel(): Level {
  const want = (window as unknown as { __GD_CHART?: string }).__GD_CHART;
  if (want === 'gen') return generateLevel({ seed: 20260913 });
  return WATER_CHART;                       // 绗笁寮犵洏:鐢ㄦ埛鑷繁閾虹殑 WATER
}
const LEVEL: Level = pickLevel();
/** 鐪熷疄鍏冲崱鐨?鍧?鈫?绉?鏃堕棿杞?瑙?Scene.tAtX 鐨勮鏄?:鎸夐€熷害闂ㄧН鍒?澶嶆椿鏃堕潬瀹冩妸闊充箰 seek 鍒颁綅 */
const REAL_T_AXIS = makeRealTimeAxis(LEVEL);

/* ---------------- 鈽?鍚勫舰鎬佺殑榛樿鍙岃壊(涓昏壊 / 绗簩鑹? ----------------
 *  GD 閲岀帺瀹跺浘鏍囨槸鍙岃壊鐨?`?icons=1` 璇曞浘闆嗘椂鎸夊畠涓婅壊,`?col1=RRGGBB&col2=RRGGBB` 鍙鐩栥€?*/
const ICON_COL: Record<Mode, [number, number]> = {
  cube: [0x8ef7ff, 0x2f6bff],
  ship: [0xbdf3ff, 0x3f7cff],
  ball: [0x9fe8ff, 0x2f9bff],
  ufo: [0xc8f6ff, 0x4a86ff],
  wave: [0x9fe8ff, 0x36d0ff],
  robot: [0xa9f0ff, 0x3f6bff],
  spider: [0xc9b6ff, 0x5a4bff],
};

/* 璺崇幆 / 寮圭哀鐨勯厤鑹?鍜屾父鎴忛噷鐨勫父璇嗕竴鑷?榛?璺?绮?灏忚烦,钃?缈婚噸鍔?缁?缈婚噸鍔?璺? */
const ORB_COL: Record<string, number> = {
  yellow: 0xffe17a, pink: 0xff9fd0, red: 0xff8a8a, blue: 0x9fd8ff, green: 0xa0ffd0, black: 0xb9a7ff,
};
const PAD_COL: Record<string, number> = {
  yellow: 0xffe17a, pink: 0xff9fd0, red: 0xff8a8a, blue: 0x9fd8ff, purple: 0xc6a0ff,
};
/* 褰㈡€侀棬鐨勯鑹?鍜屽師鐗堝悇褰㈡€佺殑鍙ｅ緞瀵归綈:鏂瑰潡缁裤€侀鏈虹矇銆佺悆姗欍€乁FO 榛勩€佹尝娴潚銆佹満鍣ㄤ汉绱€佽湗铔涚伆钃?
   鈥斺€?鐢ㄦ埛鎶?褰㈡€侀棬閮芥槸涓€涓牱寮?鎴戞€庝箞鐭ラ亾杩欎釜闂ㄦ槸浠€涔?,鎵€浠ラ鑹?+ 闂ㄤ笂鐨勫悕瀛楃墝瀛愪竴璧蜂笂銆?*/
const PORTAL_COL: Record<string, number> = {
  cube: 0x7dffb0, ship: 0xff9fd0, ball: 0xffb066, ufo: 0xffe17a,
  wave: 0x7ff0ff, robot: 0xc6a0ff, spider: 0xa8c4ff,
};
/** 闂ㄦ灏哄(鍗曚綅)= 鍘熺増鍒ゅ畾鐩?34脳86 鈥斺€?鐢绘垚绔栨き鍦嗛棬,鍜屾挒涓婂幓鐨勮寖鍥翠竴鑷?*/
const PORTAL_W = 34, PORTAL_H = 86;

/** 缁堟湯涔嬭瘲:閫氬叧涔嬪悗鍚戜笂婊氬姩鐨勬枃鏈€?
 *  鈽?鍐呭鐣欑櫧缁欑敤鎴峰～ 鈥斺€?涓€琛屼竴涓瓧绗︿覆,绌哄瓧绗︿覆 = 绌鸿(娈佃惤闂撮殧)銆?
 *    婊氬姩閫熷害鎸夎绠?鎸変綇绌烘牸(鎴栫偣浣忕敾闈?浼氬姞閫熴€?*/
const POEM: string[] = [
  '',
  '(缁堟湯涔嬭瘲 路 鍐呭寰呭～)',
  '',
  '鎶婅鏀剧殑鏂囧瓧濉繘 src/main.ts 閲岀殑 POEM 鏁扮粍,',
  '涓€琛屼竴涓瓧绗︿覆,绌哄瓧绗︿覆琛ㄧず绌鸿銆?,
  '',
];

/** 褰╄泲瑙ｉ攣鏍囪(localStorage):CD 椤甸潰闈犲畠鏄剧ず"鍒囨崲娓哥帺妯″紡"鎸夐挳 */
const EASTER_KEY = 'tuagfey-gd-easter';
const POEM_SPEED = 26;      // 婊氬姩閫熷害(涓栫晫鍗曚綅/绉?绾︽瘡绉?0.7 琛?
const POEM_LINE_H = 36;     // 涓€琛屽崰澶氶珮(鐢ㄦ潵鍒ゆ柇婊氬畬浜嗘病鏈?

/** 璋冭瘯鐢?鎸?1~7 鐜板満鎹㈠舰鎬?鏂逛究涓€涓釜璇曟墜鎰?1 鏂瑰潡 2 椋炴満 3 鐞?4 UFO 5 娉㈡氮 6 鏈哄櫒浜?7 铚樿洓) */
const MODE_ORDER: Mode[] = ['cube', 'ship', 'ball', 'ufo', 'wave', 'robot', 'spider'];
/** HUD 閲岀殑褰㈡€佸悕 */
const MODE_NAME: Record<string, string> = {
  cube: '鏂瑰潡', ship: '椋炴満', ball: '鐞?, ufo: 'UFO', wave: '娉㈡氮', robot: '鏈哄櫒浜?, spider: '铚樿洓',
};

/** 褰撳墠鎵€鍦ㄦ钀界殑鍚嶅瓧(鍙槸缁?HUD 鐪嬬殑,涓嶅奖鍝嶅垽瀹? */
function segOf(x: number): string {
  const b = x / U;
  const sg = LEVEL.segments.find((s) => b >= s.from && b < s.to);
  return sg ? (sg.label || sg.mode) : '';
}

/** 鐣岄潰闃舵銆傗槄 浠ュ墠"浠讳綍鎸夐敭/鐐瑰嚮"閮戒細寮€璺?浜庢槸闈㈡澘涓€鍔犺浇銆佸姞杞藉姩鐢昏繕鍦ㄦ斁,娓告垙灏卞紑濮嬩簡 鈥斺€?
 *  鐜板湪鍙湁"鏄庣‘鐨勭‘璁ら敭(绌烘牸/涓?W)鎴栫偣鐢诲竷"鎵嶅紑濮?姝讳骸/閫氬叧涔熶細鍋滀笅鏉ョ瓑浜恒€?*/
type Phase = 'idle' | 'running' | 'dead' | 'done' | 'poem';

class Scene extends Phaser.Scene {
  world = new World(LEVEL);
  g!: Phaser.GameObjects.Graphics;
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  acc = 0;
  prevY = 0;
  fps = 0;
  fixed = false;
  camX = 0;
  camY = 0;                        // (鏃у瓧娈?鐣欎綔鍏煎)
  camInit = false;                 // 绗竴甯х洿鎺ヨ创鍒扮帺瀹惰韩涓?涓嶇劧寮€鍦轰細浠?0 婊戣繃鍘?
  camWorldY = 0;                   // 鏈抚瀹為檯鐢ㄧ殑闀滃ご涓績(缁樺浘绌洪棿,澶瑰彇涔嬪悗)
  camBottom = 0;                   // 瑙嗛噹銆愪笅杈广€戠殑涓栫晫 y(鍗曚綅)鈥斺€?鍘熺増鐩告満绠楃殑灏辨槸杩欎釜
  camCenter = 0;                   // 瑙嗗彛涓績鐨勪笘鐣?y:椋炶绫昏繘闂ㄩ偅涓€鍒婚拤姝?m_fCameraYCenter)
  camMode: Mode = 'cube';          // 涓婁竴甯х殑褰㈡€?鐢ㄦ潵鎶?鍒氳繘闂?閭ｄ竴鍒?
  audio: HTMLAudioElement | null = null;
  started = false;                  // 璧疯窇闂搁棬:鎸変簡纭閿墠寮€璺?
  audioErr = '';                    // play() 澶辫触鐨勫師鍥?楠屾敹瑕佺湅)
  botStates: RunState[] = [];
  fp = '';
  botMode = false;
  botStarted = false;
  /** 銆愮湅 bot 閫氬叧銆戞紨绀?鎶婃悳绱㈠嚭鏉ョ殑閫氬叧杈撳叆鍗峰師鏍峰杺缁欐ā鎷熴€?
   *  鈽?涓轰粈涔堜笉鏄?鐜板満鎼?:杩欏紶鍥?3620 鍧?Node 渚х敤瀹忓姩浣滄渶浼樹紭鍏堟爲鎼滅储涔熻璺戜竴鍒嗛挓
   *    (鏁版嵁鍦?tools/autoplay.ts 鐨勫ご娉ㄩ噴閲?,娴忚鍣ㄩ噷鐜版悳浼氬崱浣忛〉闈€?
   *    鎵€浠ラ〉闈㈤噷鏀剧殑鏄偅涓€娆＄殑銆愯緭鍏ュ嵎銆戔€斺€斿畠鍜?Node 渚ч€愬抚鍚屾簮,鍥炴斁鎸囩汗涓€鑷?
   *    (tools/verify-run.ts 姣忔閮介獙)銆傜帺瀹舵寜閿殢鏃跺彲浠ユ帴绠°€?*/
  demoMode = false;
  /** 鎯冲紑婕旂ず(URL ?demo=1 鎴栨寜 B);鐪熸鐨勫垏鎹㈠彂鐢熷湪绗竴甯?update 閲?閭ｆ椂涓栫晫宸茬粡寤哄ソ) */
  demoWanted = false;
  demoTape: boolean[] | null = null;
  demoTried = false;
  demoLoaded = false;
  demoEndX = 0;
  demoErr = '';
  /** 婕旂ず鍊嶉€?**鎸夌湡瀹炴椂闂?*蹇繘鐨勫€嶆暟(1 = 姝ｅ父閫熷害)銆?
   *  鈽?2026-09 淇?浠ュ墠鏄?涓€甯ф覆鏌撴帹 N 甯х墿鐞? 鈥斺€?浜庢槸 144Hz/240Hz 灞忎笂浼氬揩 2.4~4 鍊?
   *    鐢ㄦ埛鐪嬪埌鐨勫氨鏄?鏁翠綋鍏€嶉€熴€佸嚑绉掑氨鎾畬浜?(20086 甯х殑鍗峰瓙鍦?240Hz 涓?10 绉掕窇瀹?銆?
   *    鐜板湪鎸?dt 绱Н:鏃犺灞忓箷澶氬皯甯?1 鍊嶉€熷氨鏄?334.8 绉掓挱瀹屻€?*/
  demoSpeed = 1;
  /** 婕旂ず鐨勬椂闂寸疮绉櫒(绉?鈥斺€?鎸夌湡瀹炴椂闂存帹杩?鍜屽埛鏂扮巼鏃犲叧 */
  demoAcc = 0;
  /** 褰㈡€佸浘闆?static/icons)寤哄ソ鐨勫浘灞傘€傝 buildIcons() */
  private iconLayers: Array<{
    mode: Mode;
    body: Phaser.GameObjects.Image;
    glow: Phaser.GameObjects.Image | null;
    bw: number; bh: number; pxPerUnit: number;
  }> = [];
  private iconsReady = false;
  /** 鈽?鐗╀欢璐村浘姹?姣忓抚鎸夊彲瑙佺墿浠跺彇鐢?鐢ㄥ畬鎶婂浣欑殑钘忚捣鏉?閬垮厤鍑犲崈涓?Image 甯搁┗) */
  private artPool: Phaser.GameObjects.Image[] = [];
  private artUsed = 0;
  artReady = false;

  /** 鐗╀欢 鈫?鍥鹃泦甯у悕(娌℃湁灏辫繑鍥?null,璧扮煝閲忕敾娉?銆?
   *  鏄犲皠渚濇嵁瑙?tools/verify/build-art.mjs 鐨?MAP:閿墖鎸夊昂瀵搁拤姝汇€佸脊绨ф澘鎸夐鑹层€佸瓨妗ｇ偣/纭竵鍞竴鍛戒腑;
   *  鍒虹殑 4 涓?id 鎸?缁忓吀鍒?灏忓埡"椤哄簭瀵?spike_01..04(杩欎竴鏉℃槸澶栬鎺ㄦ柇,涓嶇‘瀹氫絾褰卞搷寰堝皬); */
  private artKeyOf(o: Obj): string | null {
    if (!this.artReady) return null;
    switch (o.kind) {
      case 'saw': return o.id === 1706 ? 'saw1706' : 'saw1705';
      case 'pad': return o.pad ? (o.pad === 'purple' ? null : 'pad_' + o.pad) : null;
      case 'check': return 'checkpoint';
      case 'coin': return 'coin';
      /* 鐮栧潡:鐢ㄦ埛鍙ｅ緞"鐮栧潡鐢ㄧ涓€鐗? = block001 閭ｅ銆傚悓涓€濂?7 鍧楁槸鍘熺増鎸夐偦灞呰嚜鍔ㄦ嫾鐨?
         浣嶇疆瀵瑰簲鍏崇郴 plist 閲屾病鏈?瑕佷粠鍍忕礌涓婃帹,宸ュ叿閲岄偅涓€姝ュ厛娌″仛鍑烘潵)鈬?鍏堢敤鍏朵腑涓€鍧楀钩閾?
         瑙嗚涓婄瓑浠蜂簬浠ュ墠鐨勭煝閲忔柟鍧?姣忔牸涓€鍧?,绛夋嫾鎺ヨ〃鍋氬嚭鏉ュ啀鎹€?*/
      case 'block': return 'block4';
      /* 璺崇幆:鐢ㄦ埛鍙ｅ緞"鐜櫎浜嗛鑹叉病鍖哄埆,闄や簡缁跨幆鍜岄粦鐜? 鈬?涓€寮犲簳鍥炬煋鑹?缁跨幆鍗曠嫭鐢?gravJumpRing */
      case 'orb': return o.orb === 'green' ? 'ringGreen' : 'ringY';
      case 'spike': return o.id === 39 ? 'spike02' : o.id === 103 ? 'spike03' : o.id === 392 ? 'spike04' : 'spike01';
      default: return null;
    }
  }

  /** 鏃犳晫妯″紡鐨勮建閬撳す鍙?鍔犺浇瑙勫垝璧板粖(static/assets/gd-guide.json),鎸?x 鎻掑€煎嚭杩欐潯璧板粖鐨勯珮搴?
   *  鎶婁汉澶瑰湪 卤GUIDE_BAND 鍧楀唴銆傝蛋寤婃病鍔犺浇鍒板氨閫€鍥?鍙创鍏冲崱杈圭晫"(鑰佽涓?涓嶅奖鍝嶈兘鐜?銆?*/
  private guide: Array<[number, number]> = [];
  private guideYAt(xBlocks: number): number | null {
    const G = this.guide;
    if (!G.length) return null;
    if (xBlocks <= G[0][0]) return G[0][1];
    const last = G[G.length - 1];
    if (xBlocks >= last[0]) return last[1];
    let lo = 0, hi = G.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (G[mid][0] <= xBlocks) lo = mid; else hi = mid; }
    const [x0, y0] = G[lo], [x1, y1] = G[hi];
    return y0 + (y1 - y0) * ((xBlocks - x0) / Math.max(1e-6, x1 - x0));
  }
  private loadGuide() {
    fetch('/assets/gd-guide.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
      .then((j: { points: Array<[number, number]> }) => {
        this.guide = (j.points ?? []).filter((p) => Array.isArray(p) && p.length === 2);
        console.log('[gd] 鏃犳晫杞ㄩ亾灏辩华:' + this.guide.length + ' 涓偣 路 卤' + GUIDE_BAND + ' 鍧?);
      })
      .catch((e: Error) => { console.warn('[gd] 杞ㄩ亾娌″姞杞藉埌,鏃犳晫鍙创杈圭晫:' + e.message); });
  }
  /** 鏃犳晫鐘舵€佷笅鎶婁汉澶瑰洖杞ㄩ亾銆?
   *  鈽呪槄 2026-09 淇?鐢ㄦ埛:"杞ㄩ亾鏄浐瀹歽杞?瀵艰嚧鐩存帴鍗′綇"):绗竴鐗堟槸銆愮‖澶广€戔€斺€?
   *  瓒呯晫灏辨妸 y 鐩存帴璧嬪€煎埌杈圭晫銆傚彲璧板粖鏈韩鏄嚑浣曡鍒掑嚭鏉ョ殑,鏌愪簺浣嶇疆涓婂畠灏辨槸璐寸潃鐮?鍦ㄥ崐绌?
   *  纭す绛変簬姣忓抚鎶婁汉濉炶繘閭ｅ潡鍑犱綍閲?鈬?浜哄崱鍦ㄥ閲屽姩涓嶄簡 鉁椼€?
   *  鐜板湪鏀规垚銆愯蒋鎺ㄣ€?姣忓抚鏈€澶氭帹 0.5 鍧?30 鍗曚綅/绉?,骞舵竻鎺夋湞澶栫殑绾靛悜閫熷害 鈥斺€?
   *  涓嶇灛绉汇€佷笉绌挎ā,鎺ㄤ笉杩涘幓灏辫嚜鐒跺仠鍦ㄩ偅鍎?缁濅笉浼氬崱姝?鉁撱€?*/
  private clampToGuide() {
    const w = this.world;
    if (!w.god) return;
    const gy = this.guideYAt(w.x / U);
    if (gy == null) return;
    const cy = (w.y + w.box / 2) / U;                 // 鐢ㄧ帺瀹躲€愪腑蹇冦€?鍧?姣?鍒嬁鑴氬簳姣?
    const over = cy - gy;
    if (Math.abs(over) <= GUIDE_BAND) return;
    const dir = over > 0 ? -1 : 1;                    // 寰€杞ㄩ亾閭ｄ竴渚ф帹
    const push = Math.min(0.5, Math.abs(over) - GUIDE_BAND) * U;
    w.y += dir * push;
    if (dir < 0 && w.vy > 0) w.vy = 0;
    if (dir > 0 && w.vy < 0) w.vy = 0;
  }

  /** 鎶婁竴涓睜瀛愰噷鐨?Image 鎽嗗ソ;杩斿洖 false 琛ㄧず杩欏抚娌＄敾(璋冪敤鏂硅蛋鐭㈤噺鍏滃簳) */
  private drawArtObject(o: Obj, key: string, dx: number, dy: number, cwU: number, chU: number, tintCol = 0xffffff): boolean {
    const tex = this.textures.get('gd-art');
    const fr = tex && tex.has(key) ? tex.get(key) : null;
    if (!fr) return false;
    let img = this.artPool[this.artUsed];
    if (!img) { img = this.add.image(0, 0, 'gd-art').setDepth(6); this.artPool.push(img); }
    this.artUsed++;
    /* k:涓€鏍奸噷鐨勮创鍥炬寜"鐗╀欢楂樺害(鍗曚綅)/ 甯ч珮(px)"绛夋瘮缂╂斁;寮圭哀鏉垮お鎵?鏀圭敤瀹藉害瀵归綈(GD 鐨勬澘涔熸槸妯悜閾烘弧) */
    const k = (o.kind === 'pad' ? cwU / fr.width : chU / Math.max(1e-6, fr.height));
    img.setVisible(true).setTexture('gd-art', key).setPosition(dx, dy);
    img.setRotation(((o.rot ?? 0) * Math.PI) / 180);
    img.setDisplaySize(fr.width * k, fr.height * k);
    img.setTint(tintCol);
    return true;
  }
  /** 楠屾敹鐢?update 琚皟浜嗗嚑娆°€丳haser 鍠傝繘鏉ョ殑 delta 鏄灏?*/
  updates = 0;
  lastDt = 0;
  /** 鑷繁鐢?performance.now() 閲忎笂涓€娆?update 鐨勫涓婃椂闂?婕旂ず鑺傛媿鐢?瑙?update) */
  lastWallMs = 0;
  /** 涓婁竴娆?璇曠潃鎶婇煶涔?seek 鍥炴ā鎷熸椂闂?鐨勬椂鍒?seek 澶辫触鏃舵瘡 1.5 绉掗噸璇曚竴娆? */
  lastSeekTry = 0;
  /** 楠屾敹鐢?婕旂ず/鏈哄櫒浜烘ā寮忎笅姣忔"鍙戠幇涓栫晫姝讳簡"鐨勮褰?娆℃暟銆佸抚鍙枫€佷綅缃? */
  deathLog: Array<{ tick: number; x: number; y: number; vy: number; mode: string; gdir: number; chunk: number; at: number; hold: boolean }> = [];
  baseTick = 0;                     // 杩欎竴鏉″懡鐨勮捣鐐瑰湪闊充箰鏃堕棿杞翠笂鐨勫抚鍙?澶嶆椿鏃惰窡鐫€瀛樻。鐐硅蛋)
  airT = 0;                         // 绌轰腑鍋滅暀浜嗗涔?缁欐柟鍧楄嚜杞敤)
  spinAng = 0;                      // 鈽?鏂瑰潡褰撳墠鐨勮嚜杞搴?寮у害)鈥斺€?鎸夋簮鐮佹敼鎴?鍙伴樁 + 缂撳姩"鐘舵€佹満
  labels: Phaser.GameObjects.Text[] = [];
  phase: Phase = 'idle';
  /** 璋冭瘯/鍑哄浘鐢?鍐讳綇妯℃嫙(鍙覆鏌?涓嶆帹杩? 鈥斺€?鑷姩鍖栨埅鍥句笉浼氬洜涓?鐬Щ鍒板閲?褰撳満鎽旀 */
  dbgPause = false;
  deathT = 0;                       // 姝讳骸鍚庤繃浜嗗涔?鍏堝仠涓€鎷嶅啀鍑鸿彍鍗?
  clicked = false;                  // 鐢诲竷涓婅鐐硅繃涓€涓?
  private prevHeld = false;         // 涓婁竴甯ф湁娌℃湁鎸夌潃纭閿?鐢ㄦ潵绠?鎸変笅"鐨勮竟娌?
  private prevR = false;
  private restartPressed = false;
  private confirmLatch = false;     // 鐪熷疄鐨?keydown 浜嬩欢(姣?姣忓抚鏌?isDown"鍙潬:鏋佺煭鐨勪竴涓嬩篃鏀跺緱鍒?
  private restartLatch = false;
  private godLatch = false;         // G 閿?鏃犳晫妯″紡
  private prevG = false;
  private demoLatch = false;        // B 閿?鐪?bot 閫氬叧(婕旂ず鍗?
  private padLatch = 0;             // [ / ]:寮圭哀鍔涘害寰皟(-1 / +1 涓崟浣?姣忎釜 5%)
  /** 鏃犳晫妯″紡鎯宠鐨勭姸鎬?鈥斺€?startRun() 浼?new 涓€涓?World,寰楁妸寮€鍏冲甫杩囧幓 */
  godWanted = false;
  /** 寮圭哀鍔涘害寰皟(鍜?godWanted 涓€鏍?鎹笘鐣屾椂瑕佸甫杩囧幓) */
  padMulWanted = 1;
  private modeLatch = 0;            // 鏁板瓧閿?1~7:璋冭瘯鐢ㄧ殑鐜板満鎹㈠舰鎬?
  uiTitle!: Phaser.GameObjects.Text;
  uiHint!: Phaser.GameObjects.Text;
  poemText!: Phaser.GameObjects.Text;
  /** 褰㈡€侀棬澶翠笂閭ｅ潡鍚嶅瓧鐗屽瓙(闂ㄥ彲鑳借瑙﹀彂鍣ㄦ帹鍔?浣嶇疆姣忓抚璺熺潃绠? */
  private portalLabels: Array<{ o: Obj; t: Phaser.GameObjects.Text }> = [];
  poemT = 0;                       // 缁堟湯涔嬭瘲婊氫簡澶氫箙(绉?
  egg = false;                     // 褰╄泲绐楀彛鏄惁宸插脊鍑?

  /** 绗竴娆＄‘璁?寮€璺?闊充箰鍜屾ā鎷熷悓鏃朵粠 0 寮€濮?鈥斺€?閾洪潰璐寸潃闊充箰,涓嶈兘鏈?鍑嗗鏃堕棿") */
  startRun() {
    if (this.phase !== 'idle') return;
    this.phase = 'running';
    this.started = true;
    this.world = new World(LEVEL);
    this.world.god = this.godWanted;      // 鏃犳晫寮€鍏宠璺熺潃鏂颁笘鐣岃蛋
    this.world.padMul = this.padMulWanted;
    this.baseTick = 0;
    this.prevY = 0;
    this.acc = 0;
    this.airT = 0;
    this.deathT = 0;
    this.camInit = false;
    /* 鈽?姣忓眬寮€濮嬫椂鍐嶈涓€娆￠〉闈㈡寚瀹氱殑姝?鎹㈢洏涔嬪悗寮€璺戝氨浼氱敤鏂版瓕 */
    const forced = (window as unknown as { __GD_SONG?: string }).__GD_SONG;
    if (forced && forced !== LEVEL.song) { LEVEL.song = forced; if (this.audio) this.audio.src = forced; }
    if (!this.audio) {
      const a = document.createElement('audio');
      a.src = LEVEL.song;
      a.preload = 'auto';
      a.volume = 0.85;
      this.audio = a;
    }
    this.playMusicAt(0);
  }

  /** 鎶婇煶涔愯烦鍒扮 t 绉掑苟浠庨偅閲屾挱銆?
   *  鈽呪槄 2026-09 淇?鐢ㄦ埛:"姝讳簡涓€娆′箣鍚庡湪瀛樻。鐐瑰娲?闊充箰涓嶄細鍦ㄩ偅涓湴鏂圭户缁挱鏀?):
   *    `a.currentTime = t` 鍦ㄣ€愬厓鏁版嵁杩樻病鍔犺浇瀹屻€戞椂浼氭姏寮傚父 / 琚拷鐣?readyState 0),
   *    鑰岃繖閲屾妸寮傚父鍚炰簡 鈫?澶嶆椿鏃堕煶涔愪粠"姝绘帀閭ｄ竴鍒?鎺ョ潃鏀?鍜岀敾闈?瀛樻。鐐?褰诲簳涓嶅悓姝?
   *    鏇寸碂鐨勬槸妯℃嫙鏄€愰煶涔愰┍鍔ㄣ€戠殑(target = currentTime脳60 鈭?baseTick),
   *    浜庢槸澶嶆椿鐬棿浼氳鐏岃繘鍑犵櫨甯?浜虹洿鎺ヨ鎷藉埌鍓嶉潰鍘?銆?
   *    鐜板湪:娌″噯澶囧ソ灏辩瓑 loadedmetadata 鍐?seek;骞朵笖缁欐ā鎷熷姞涓€鏉℃紓绉绘姢鏍?瑙?update)銆?*/
  private playMusicAt(t: number) {
    const a = this.audio;
    if (!a) return;
    this.seekMusic(t);
    a.play().catch((e) => { this.audioErr = String((e && e.message) || e); });   // 澶辫触鍘熷洜鐣欑潃,鍒潤榛樺悶
  }

  private seekMusic(t: number) {
    const a = this.audio;
    if (!a) return;
    const apply = () => { try { a.currentTime = t; } catch { /* seek 澶辫触灏变粠澶存斁 */ } };
    if (a.readyState >= 1) apply();
    else a.addEventListener('loadedmetadata', apply, { once: true });
  }

  private pauseMusic() { if (this.audio && !this.audio.paused) this.audio.pause(); }

  /** 褰╄泲瑙ｉ攣:鍐欒繘 localStorage,CD 椤甸潰鎹鏄剧ず銆屽垏鎹㈡父鐜╂ā寮忋€嶆寜閽?*/
  private unlockEaster() {
    try { localStorage.setItem(EASTER_KEY, '1'); } catch { /* 鏃犵棔妯″紡灏辩畻浜?*/ }
  }

  /** x(鍗曚綅)鈫?闊充箰绉掓暟銆?
   *  鈽呪槄 2026-09 淇?bug:浠ュ墠杩欓噷鐩存帴璋?`tOfX(LEVEL, world.x / checkX)` 鈥斺€?涓や釜閿欏彔鍦ㄤ竴璧?
   *    鈶?`tOfX` 鐨勫彛寰勬槸銆愬潡銆?sim.test / tools/diag-chart 閮芥寜鍧楄皟),浼犲崟浣嶈繘鍘荤瓑浜庢妸鏃堕棿鏀惧ぇ 30 鍊?
   *    鈶?鏇磋鍛界殑鏄?`tOfX` 璇荤殑鏄?`level.segments`,鑰岄偅鏄€愮敓鎴愰摵闈€戠殑浜х墿 鈥斺€?
   *       鐪熷疄鍏冲崱(杩欏紶鎵嬫悡鐨?WATER)鐢ㄥ畠浼氱畻鍑洪潪鍗曡皟鐨勫瀮鍦?x=600 鈫?7.2s,鑰?x=1060 鈫?0.0s)銆?
   *    鍚庢灉姝ｆ槸鐢ㄦ埛鎶ョ殑閭ｆ潯:"姝讳簡涓€娆′箣鍚庡湪瀛樻。鐐瑰娲?闊充箰涓嶄細鍦ㄩ偅涓湴鏂圭户缁挱鏀? 鈥斺€?
   *    妯℃嫙鏄€愰煶涔愰┍鍔ㄣ€戠殑(target = currentTime脳60 鈭?baseTick),baseTick 涓€閿?target 鎭掍负 0,
   *    鐢婚潰鍋滃湪鍘熷湴銆侀煶涔愬嵈浠庤崚鍞愮殑浣嶇疆鏀剧潃銆?
   *  鐜板湪璧?makeRealTimeAxis():鎸夈€愰€熷害闂ㄣ€戝垎娈电Н鍒?dx/v 鈥斺€?GD 缂栬緫鍣ㄩ噷 x 灏辨槸閫熷害脳鏃堕棿鐨勭Н鍒?
   *  鎵€浠ヨ繖鏉℃墠鏄?閾洪潰璐寸潃闊充箰"鐨勫師鍙ｅ緞銆傝嚜妫€:绉垎鍑虹殑鎬婚暱 294.45s vs 杩欓姝屽疄闄?299.29s(宸?1.6%),
   *  鍐嶆寜 audio.duration 绛夋瘮缂╂斁涓€涓?缁撳熬灏卞拰姝屽榻愪簡銆?*/
  private tAtX(xUnits: number): number {
    /* 鈽呪槄 2026-09 淇?鐢ㄦ埛:"瀛樻。鐐瑰娲婚煶涔愮户缁殑浣嶇疆閿欒,閲囬煶鍏ㄤ贡"):
       浠ュ墠杩欓噷鎶婃椂闂磋酱銆愭暣浣撴媺浼搞€戞垚闊抽鏃堕暱:raw 脳 (audio.duration / axisTotal)銆?
       鍙叧鍗¤嚜宸辩殑鏃堕棿杞村叏闀?294.45 绉?鑰岃繖鏀?mp3 鏄?299.29 绉?鈬?宸?1.6%,
       杩欎釜绯绘暟浼氳**姣忎竴涓噰闊崇偣閮芥寜姣斾緥鍋忕Щ** 鈥斺€?瓒婂線鍚庡亸寰楄秺澶?
         x=3032(绗?8 涓瓨妗ｇ偣)澶?鍏冲崱鏃堕棿 245.74 绉?鎷変几鍚庡彉鎴?249.78 绉?鈬?鍋?4.04 绉?鉁椻湕
       鑰屽師鐗堢殑鍙ｅ緞鏄?x 鈫?绉?鐢便€愰€熷害闂ㄧН鍒嗐€戝喅瀹?鍏冲崱灏辨槸鐓ц繖棣栨瓕閾虹殑),
       闊充箰鎸夊畠鑷繁鐨勯€熺巼鏀?涓よ竟鍦ㄥ悓涓€涓椂闂磋酱涓婂榻?鈬?**涓嶈涔樹换浣曟媺浼哥郴鏁?*銆?
       鈬?鐜板湪鐩存帴鐢ㄥ叧鍗¤嚜宸辩殑鏃堕棿杞?涓嶆媺浼?銆?*/
    return REAL_T_AXIS(Math.max(0, xUnits) / U);
  }

  /** 浠庡瓨妗ｇ偣閲嶆潵(姝讳骸鐣岄潰鎸夌‘璁? */
  retry() {
    const w = this.world;
    w.respawn();
    this.baseTick = Math.floor(this.tAtX(w.checkX) * 60);
    this.airT = 0;
    this.acc = 0;
    this.deathT = 0;
    this.prevY = w.y;
    this.camInit = false;                 // 澶嶆椿:闀滃ご绔嬪埢璐村埌瀛樻。鐐?涓嶇劧瑕佷粠姝讳骸鐐规粦杩囨潵)
    this.phase = 'running';
    this.playMusicAt(this.tAtX(w.checkX));
  }

  /** 浠庡ご鏉?R 閿?/ "閲嶆潵"鎸夐挳 / 姝讳骸鐣岄潰鎸?R)銆傗槄 2026-09 淇?浠ュ墠婕旂ず/鏈哄櫒浜烘ā寮忎笅
   *  杩欎竴鏀牴鏈蛋涓嶅埌(update 閲屾瘡甯ф妸 phase 寮鸿鎺板洖 running),鐢ㄦ埛鎸?R 灏辨槸"鎽嗚";
   *  鐜板湪浠讳綍妯″紡銆佷换浣曢樁娈甸兘璧拌繖閲?婕旂ず妯″紡涓?= 銆愭紨绀轰粠澶村啀鏀句竴閬嶃€戙€?*/
  restartRun() {
    this.demoAcc = 0;
    this.demoEndX = 0;
    if (this.demoMode || this.botMode) {
      this.world = new World(LEVEL);
      this.world.god = this.godWanted;
      this.world.padMul = this.padMulWanted;
      this.botStarted = false;              // 璁?pump 閲?骞插噣寮€灞€"閭ｄ竴娈甸噸鏂拌蛋涓€閬?
      this.botStates = [];
      this.fp = '';
      this.baseTick = 0; this.prevY = 0; this.airT = 0; this.camInit = false;
      this.phase = 'running';
      this.started = true;
      this.playMusicAt(0);
      return;
    }
    this.restartFromZero();
  }

  /** 浠庡ご鏉?R 閿?姝讳骸鐣岄潰涓庨€氬叧鐣岄潰閮借兘鐢? */
  restartFromZero() {
    this.world.resetToStart();          // 鈽?鍥炲埌閾洪潰鐨勫嚭鐢熺偣(Level.start),涓嶆槸纭紪鐮佺殑 (0,0)
    this.baseTick = 0;
    this.airT = 0;
    this.acc = 0;
    this.demoAcc = 0;
    this.deathT = 0;
    this.prevY = 0;
    this.camInit = false;
    this.phase = 'running';
    this.playMusicAt(0);
  }

  create() {
    this.g = this.add.graphics();
    this.keys = this.input.keyboard!.addKeys('SPACE,UP,W,R,G,B') as Record<string, Phaser.Input.Keyboard.Key>;
    /* 鈽?鏃犳晫妯″紡:椤甸潰鎸?G 鍒?涔熷彲浠ュ紑灞€灏辩敤 URL 鎵撳紑(?god=1),楠屾敹鑴氭湰鐩存帴鏀?__gd.world.god */
    this.godWanted = /(^|[?&])god=1(&|$)/.test(location.search);
    this.world.god = this.godWanted;
    /* ?demo=1 鈥斺€?寮€灞€鐩存帴婕旂ず"bot 閫氬叧"(鍜屾寜 B / 鐐瑰彸涓嬭鎸夐挳绛夋晥)
       ?demospeed=4 鈥斺€?婕旂ず鍊嶉€?榛樿 1 = 姝ｅ父閫熷害;20086 甯х殑鍗峰瓙姝ｅ父閫熷害鎾?334.8 绉? */
    if (/(^|[?&])demo=1(&|$)/.test(location.search)) this.demoWanted = true;
    const ds = /(^|[?&])demospeed=([\d.]+)/.exec(location.search);
    if (ds) this.demoSpeed = Math.max(0.25, Math.min(40, Number(ds[2]) || 1));
    /* ?padmul=0.75 鈥斺€?寮圭哀鍔涘害寰皟(鍜屾寜 [ / ] 绛夋晥),楠屾敹鑴氭湰涔熻兘鐢?URL 鎸囧畾 */
    const pm = /(^|[?&])padmul=([\d.]+)/.exec(location.search);
    if (pm) { this.padMulWanted = Math.max(0.4, Math.min(1.5, Number(pm[2]) || 1)); this.world.padMul = this.padMulWanted; }
    this.cameras.main.setBackgroundColor('#05070d');
    this.cameras.main.setZoom(this.zoomOf());
    /* 鈽?鍙湪銆愮敾甯冧笂銆戠偣鎵嶇畻纭 鈥斺€?浠ュ墠鐩戝惉 window,鐐瑰鑸€佺偣 CD 闈㈡澘閮戒細椤烘墜鎶婃父鎴忓紑璧锋潵 */
    this.input.on('pointerdown', () => {
      this.clicked = true;
      /* 鈽?鎶婄劍鐐逛粠绔欏唴鎼滅储妗嗕笂鎷胯蛋:鎼滅储妗嗚繕鐣欑潃鐒︾偣鏃?閿洏浜嬩欢閮芥寚鍚戝畠,
         瀹炴祴灏辨槸瀹冭 R / G 鎸変簡娌″弽搴?鐐逛竴涓嬬敾闈㈠氨鎭㈠姝ｅ父)銆?*/
      const ae = document.activeElement as HTMLElement | null;
      if (ae && ae !== document.body) ae.blur();
    });
    /* 绌烘牸 / 涓?/ W 鎵嶇畻"纭",鍏跺畠鎸夐敭涓€姒備笉鐞?浠ュ墠浠讳綍鎸夐敭閮戒細寮€璺?;
       鏁板瓧閿?1~7 鏄皟璇曠敤鐨?鐜板満鎹㈠舰鎬?;R 閲嶆潵銆丟 鏃犳晫銆?
       鈽?鐢ㄣ€愭崟鑾烽樁娈点€?绗笁涓弬鏁?true)鎸?椤甸潰閲屽埆鐨?keydown 澶勭悊鍣?鎼滅储妗嗐€佺珯鍐呭揩鎹烽敭绛?
         涓€鏃?stopPropagation,鍐掓场闃舵鎴戜滑灏辨敹涓嶅埌浜?鈥斺€?鎹曡幏闃舵鍏堜簬瀹冧滑杩愯銆?
       鈽?涓嶅啀"鐒︾偣鍦ㄨ緭鍏ユ閲屽氨涓嶇悊":鐢ㄦ埛瀹炴祴 R/G 娌″弽搴?鏌ュ嚭鏉ユ槸绔欏唴鎼滅储妗嗚繕鐣欑潃鐒︾偣 鈥斺€?
         鎸囧悜杈撳叆妗嗙殑 keydown 鎴戜滑涓€鏍疯鎺ャ€傜帺涔嬪墠鐐逛竴涓嬬敾闈㈠氨浼氭妸鐒︾偣浠庢悳绱㈡涓婃嬁璧?瑙佷笅闈?pointerdown)銆?*/
    window.addEventListener('keydown', (ev: KeyboardEvent) => {
      if (ev.code === 'Space' || ev.code === 'ArrowUp' || ev.code === 'KeyW') this.confirmLatch = true;
      if (ev.code === 'KeyR') this.restartLatch = true;
      if (ev.code === 'KeyG') this.godLatch = true;
      if (ev.code === 'KeyB') this.demoLatch = true;
      /* 鈽?寮圭哀鍔涘害寰皟:浠ュ墠鍙 [ / ](BracketLeft/Right)鈥斺€?鐢ㄦ埛瀹炴祴"鎸変簡娌＄敤"
         (涓嶅悓閿洏/杈撳叆娉曚笅鍙戝嚭鏉ョ殑 code 涓嶄竴鏍?銆傜幇鍦ㄦ妸甯歌鐨勯偅鍑犲鍏ㄦ敹杩涙潵,
         鍙﹀椤甸潰涓婅繕鍔犱簡涓や釜鑳界偣鐨勬寜閽?瑙?lost.html 鐨?.gd-tools)銆?*/
      if (ev.code === 'BracketLeft' || ev.code === 'Minus' || ev.code === 'NumpadSubtract' || ev.code === 'Comma') this.padLatch -= 1;
      if (ev.code === 'BracketRight' || ev.code === 'Equal' || ev.code === 'NumpadAdd' || ev.code === 'Period') this.padLatch += 1;
      if (/^Digit[1-7]$/.test(ev.code)) this.modeLatch = Number(ev.code.slice(5));
    }, true);
    /* 鈽?鍐嶇粰鍑犱釜銆愯兘鐐圭殑銆戞寜閽?閿洏鍦ㄦ煇浜涚幆澧冮噷浼氳鍒殑涓滆タ鍚冩帀(鐢ㄦ埛瀹炴祴 R/G 娌″弽搴?,
       鎸夐挳鐢ㄩ紶鏍?瑙﹀睆閮借兘鎸?鑰屼笖鐘舵€佺洿鎺ュ啓鍦ㄦ寜閽笂 鈥斺€?涓嶇敤鐚滃埌搴曞紑娌″紑銆?*/
    document.getElementById('gd-god')?.addEventListener('click', () => { this.toggleGod(); this.blurSelf(); });
    document.getElementById('gd-demo')?.addEventListener('click', () => { this.demoLatch = true; this.blurSelf(); });
    document.getElementById('gd-restart')?.addEventListener('click', () => { this.restartLatch = true; this.blurSelf(); });
    /* 鈽?绱姞鑰屼笉鏄祴鍊?杩炵偣涓や笅鎸夐挳/杩炴寜涓や笅閿椂,濡傛灉鍙槸 `= 1`,鍚屼竴甯ч噷鐨勪袱娆′細浜掔浉瑕嗙洊
       (鐢ㄦ埛浼氱湅鍒?鐐逛簡娌″弽搴?鍙姩涓€鏍?)銆?*/
    document.getElementById('gd-pad-minus')?.addEventListener('click', () => { this.padLatch -= 1; this.blurSelf(); });
    document.getElementById('gd-pad-plus')?.addEventListener('click', () => { this.padLatch += 1; this.blurSelf(); });
    /* 鈽呪槄 鐗╀欢璐村浘(浠庛€愭父鎴忔湰浣撱€戞娊鍑烘潵鐨勫皬鍥鹃泦,瑙?tools/verify/build-art.mjs):
       static/assets/gd-art.png/json 閲屽彧鏈夎繖涓€鍏崇敤寰楀埌鐨?35 甯?鈥斺€?閿墖/寮圭哀鏉?瀛樻。鐐?纭竵/鍒?璺崇幆/褰㈡€侀棬銆?
       鈽?瀵嗗害:1 鍍忕礌 = 1 鍗曚綅(鏂瑰潡 30 鍗曚綅 = 30 px),鎵€浠ョ敾鐢绘椂 k = 鐗╀欢楂樺害(鍗曚綅) / 甯ч珮(px)銆?
       鈽?id 鈫?甯у悕鐨勬槧灏勩€愪笉鍦ㄦ父鎴忕殑鏁版嵁鏂囦欢閲屻€?閭ｆ槸缂栬瘧杩?exe 鐨勪唬鐮?;杩欓噷闈?灏哄/棰滆壊/鍞竴鍛戒腑"閽?
         姣忔潯閮藉湪 build-art.mjs 鐨?MAP 閲屽啓浜嗙悊鐢便€傜嚎妗?468/469/470)鎸夌敤鎴峰彛寰勪笉鍋氳创鍥俱€?*/
    if (ART_ENABLED) {
      if (!this.textures.exists('gd-art')) this.load.atlas('gd-art', '/assets/gd-art.png', '/assets/gd-art.json');
      this.load.once('complete', () => { this.artReady = this.textures.exists('gd-art'); });
      this.load.start();
    }
    this.loadGuide();                          // 鈽?鏃犳晫妯″紡鐨勮建閬?瑙?clampToGuide)
    /* 鈽?褰㈡€佸浘闆?static/icons):榛樿涓嶅姞杞?瑙佷笂闈㈤偅娈?缁撹")銆?icons=1 鎵嶈瘯鍥鹃泦 */
    if (ICON_ENABLED) {
      const q = /(^|[?&])col1=([0-9a-fA-F]{6})/.exec(location.search);
      const q2 = /(^|[?&])col2=([0-9a-fA-F]{6})/.exec(location.search);
      if (q) for (const k of Object.keys(ICON_COL) as Mode[]) ICON_COL[k][0] = parseInt(q[2], 16);
      if (q2) for (const k of Object.keys(ICON_COL) as Mode[]) ICON_COL[k][1] = parseInt(q2[2], 16);
      for (const a of ICON_ATLAS) {
        this.load.image('iconimg-' + a.file, '/icons/' + a.file + '.png');
        this.load.text('iconxml-' + a.file, '/icons/' + a.file + '.plist');
      }
      this.load.once('complete', () => { this.buildIcons(); });
      this.load.start();
    }
    const ui = { fontFamily: 'ui-monospace, Consolas, monospace', align: 'center' as const };
    this.uiTitle = this.add.text(0, 0, '', { ...ui, fontSize: '44px', color: '#e2f6ff' }).setOrigin(0.5).setDepth(20).setVisible(false);
    this.uiHint = this.add.text(0, 0, '', { ...ui, fontSize: '24px', color: HL }).setOrigin(0.5).setDepth(20).setVisible(false);
    this.poemText = this.add.text(0, 0, POEM.join('\n'), { ...ui, fontSize: '26px', color: '#e2f6ff', lineSpacing: 10 }).setOrigin(0.5, 0).setDepth(19).setVisible(false);
    /* 鍔熻兘鍧?text 鐗╀欢)鍋氭垚鍦轰笂鐨勬枃瀛?鏃х増閭ｇ娈佃惤鏃佺櫧姘村嵃宸插垹) */
    for (const o of LEVEL.objects) {
      if (o.kind !== 'text' || !o.text) continue;
      const t = this.add.text(o.b * U, 0, o.text, {
        fontFamily: 'ui-monospace, Consolas, monospace',
        fontSize: Math.round(30 * (o.size ?? 1)) + 'px', color: '#e2f6ff',
      });
      t.setOrigin(0.5, 0.5).setAlpha(0.95);
      t.setData('isText', true);
      t.setY(LEVEL.rows * U - (o.r + 0.5) * U);          // 鍔熻兘鍧楄嚜宸卞畾鍦ㄥ畠閭ｄ竴鏍?
      this.labels.push(t);
    }
    /* 鈽?褰㈡€侀棬鎸傜墝瀛?鍏夌湅闂ㄦ鍒嗕笉鍑哄垏浠€涔堝舰鎬?鐢ㄦ埛:"褰㈡€侀棬閮芥槸涓€涓牱寮?鎴戞€庝箞鐭ラ亾杩欎釜闂ㄦ槸浠€涔?)鈥斺€?
       姣忎釜闂ㄥご涓婃寕涓€鍧楀啓鐫€褰㈡€佸悕鐨勫皬鐗屽瓙,搴曡壊灏辨槸閭ｄ釜褰㈡€佺殑棰滆壊銆備綅缃瘡甯ц窡鐫€闂ㄨ蛋(瑙?draw)銆?
       鈽?閲嶅姏闂ㄥ悓鐞?鏂瑰悜涓嶅悓棰滆壊涓嶅悓(鍙嶉噸鍔涜摑 / 甯搁噸鍔涢粍),鐗屽瓙涓婄洿鎺ュ啓"鍙嶉噸鍔涒啈""閲嶅姏鈫?銆?*/
    for (const o of LEVEL.objects) {
      let text = '';
      let col = 0xffffff;
      if (o.kind === 'portal' && o.to) {
        const to = o.to as Mode;
        text = MODE_NAME[to] ?? to;
        col = PORTAL_COL[to] ?? 0xffe17a;
      } else if (o.kind === 'gravity') {
        const up = (o.gdir ?? 1) < 0;
        text = up ? '鍙嶉噸鍔涒啈' : '閲嶅姏鈫?;
        col = up ? 0x6fc3ff : 0xffd166;
      } else continue;
      const t = this.add.text(0, 0, text, {
        fontFamily: 'ui-monospace, Consolas, monospace',
        fontSize: '16px',
        color: '#05070d',
        backgroundColor: '#' + col.toString(16).padStart(6, '0'),
        padding: { x: 4, y: 1 },
      });
      t.setOrigin(0.5, 1).setDepth(18).setAlpha(0.95);
      this.portalLabels.push({ o, t });
    }
  }

  /** 杩欎竴甯ф湁娌℃湁"纭"杈撳叆(绌烘牸 / 涓?/ W / 鍦ㄧ敾甯冧笂鐐逛竴涓?銆?
   *  鈽?鐢?鑷繁璁颁笂涓€甯?鐨勮竟娌垮垽瀹?涓嶇敤 Phaser.Input.Keyboard.JustDown 鈥斺€?
   *    瀹炴祴鍦ㄨ繖涓〉闈㈤噷 JustDown 鏀朵笉鍒?鎸夐敭鐨?isDown 鏄ソ鐨?,浜庢槸鎸夌┖鏍煎紑涓嶄簡灞€銆?*/
  private confirmDown(): boolean {
    const k = this.keys;
    const held = !!(k.SPACE?.isDown || k.UP?.isDown || k.W?.isDown);
    const edge = held && !this.prevHeld;
    const rEdge = (!!k.R?.isDown && !this.prevR) || this.restartLatch;
    this.prevHeld = held;
    this.prevR = !!k.R?.isDown;
    this.restartPressed = rEdge;
    this.restartLatch = false;
    /* 鏃犳晫妯″紡寮€鍏?G 閿?杈规部瑙﹀彂)銆傚垏鎹㈡椂缁欎竴娆℃彁绀?濂界‘璁ゅ埌搴曞紑娌″紑銆?*/
    const gEdge = (!!k.G?.isDown && !this.prevG) || this.godLatch;
    this.prevG = !!k.G?.isDown;
    this.godLatch = false;
    if (gEdge) this.toggleGod();
    /* B 閿?/ ?demo=1:鐪?bot 閫氬叧 */
    if (this.demoLatch || this.demoWanted) {
      this.demoLatch = false;
      this.demoWanted = false;
      this.toggleDemo();
    }
    /* 鈽?寮圭哀鍔涘害寰皟:[ 鍑?5%銆乚 鍔?5%(0.4 ~ 1.5)銆傝摑璺崇偣鍒板簳璇ュ澶ц繕娌″畾姝?
       璁╃敤鎴风洿鎺ユ妸鏁板€艰皟鍒版墜鎰熷,姣旀垜浠弽澶嶇寽鐪佷簨 鈥斺€?HUD 涓婁細鏄剧ず"璺崇偣脳N"銆?
       鈽?璧板拰 G/R 鍚屼竴鏉¤矾(鐪熷疄 keydown 浜嬩欢 + latch):Phaser 鐨?addKeys('OPEN_BRACKET')
       瀹炴祴鏀朵笉鍒?鎸?] 鏈夋晥銆佹寜 [ 鏃犳晥),鍒湪杩欎笂闈㈡氮璐规椂闂淬€?*/
    if (this.padLatch) {
      this.padMulWanted = Math.round(Math.max(0.4, Math.min(1.5,
        this.padMulWanted + Math.sign(this.padLatch) * 0.05 * Math.min(4, Math.abs(this.padLatch)))) * 100) / 100;
      this.world.padMul = this.padMulWanted;
      this.padLatch = 0;
    }
    if (this.confirmLatch) { this.confirmLatch = false; this.clicked = false; return true; }
    if (edge) { this.clicked = false; return true; }
    if (this.clicked) { this.clicked = false; return true; }
    return false;
  }

  /** 鏃犳晫寮€鍏?閿洏 G 鍜屽睆骞曞彸涓嬭閭ｄ釜鎸夐挳閮借蛋杩欓噷(鐘舵€佸啓鍦ㄦ寜閽笂,涓嶇敤鐚滃紑娌″紑) */
  toggleGod() {
    this.godWanted = !this.godWanted;
    this.world.god = this.godWanted;
    this.syncGodButton();
  }

  /** 鎸夐挳鐐瑰畬鎶婄劍鐐硅繕鍥炲幓 鈥斺€?涓嶇劧鎸夐挳鐣欑潃鐒︾偣,鎸夌┖鏍间細褰撴垚"鍐嶇偣涓€娆¤繖涓寜閽?(HTML 榛樿琛屼负) */
  private blurSelf() {
    const ae = document.activeElement as HTMLElement | null;
    if (ae && ae !== document.body) ae.blur();
  }

  private godBtnEl: HTMLElement | null = null;
  private godBtnTxt = '';

  /** 婕旂ず鎸夐挳涓婄殑瀛?娌′笅濂?/ 涓嬪け璐?/ 寮€浜?/ 鍏充簡 鈥斺€?鐘舵€佸啓鍦ㄦ寜閽笂,涓嶇敤鐚?*/
  syncDemoButton() {
    if (!this.demoBtnEl) this.demoBtnEl = document.getElementById('gd-demo');
    const el = this.demoBtnEl;
    if (!el) return;
    const txt = this.demoMode
      ? (this.demoTape ? '婕旂ず:寮€ 脳' + this.demoSpeed.toFixed(2).replace(/\.?0+$/, '') : this.demoErr ? '婕旂ず:鍗峰瓙鍔犺浇澶辫触' : '婕旂ず:杞藉叆涓€?)
      : '鐪?bot 閫氬叧';
    if (txt === this.demoBtnTxt) return;
    this.demoBtnTxt = txt;
    el.textContent = txt;
    el.classList.toggle('is-on', this.demoMode);
  }
  private demoBtnEl: HTMLElement | null = null;
  private demoBtnTxt = '';

  private syncGodButton() {
    if (!this.godBtnEl) this.godBtnEl = document.getElementById('gd-god');
    const el = this.godBtnEl;
    if (!el) return;
    const txt = this.world.god ? '鏃犳晫:寮€' : '鏃犳晫:鍏?;
    if (txt === this.godBtnTxt) return;              // 鍙湪鍙樹簡鐨勬椂鍊欏啓 DOM
    this.godBtnTxt = txt;
    el.textContent = txt;
    el.classList.toggle('is-on', this.world.god);
  }

  /** 鍙楂樺害 = VIEW_H_BLOCKS 鍧?**鍦ㄧ湡姝ｇ殑绐楀彛閲?*(涓嶆槸鏁村潡鐢诲竷)銆?
   *  鈽?鐢ㄦ埛瀹炴祴:"鍙 11 鏍?绐楀彛鍙湶 6.8 鏍? 鈥斺€?鐢诲竷姣斿妗嗙殑閫忔槑绐楀彛楂?澶氬嚭鏉ョ殑閮ㄥ垎琚?
   *    閲戝睘杈规鎸′綇銆備笂涓€鐗堟垜鐨勫仛娉曟槸"鎶婄缉鏀捐皟灏忋€佽绐楀彛閲屽噾澶?11 鏍?,缁撴灉鐩告満鏄寜鏁村潡鐢诲竷
   *    瀹氫綅鐨?浜虹洿鎺ヨ鎸ゅ埌绐楀彛澶栭潰鍘讳簡("cube 搴曚笅涓嶅啀鏄剧ず")銆?
   *    姝ｇ‘鍋氭硶:**鎶婄浉鏈虹殑鍙栨櫙妗?viewport)鐩存帴璁炬垚闇插嚭鏉ョ殑閭ｄ竴鏉?*,鍐嶈閭ｄ竴鏉￠噷姝ｅソ 11 鏍?
   *    鈥斺€?鐩告満閫昏緫銆佷汉鐗╀綅缃€佸垽瀹氬叏閮借窡鐫€杩欐潯璧?绐楀彛澶栫敾浠€涔堥兘涓嶅奖鍝嶃€?*/
  viewFrac = 1;
  /** 闇插嚭鏉ョ殑閭ｄ竴鏉″湪鐢诲竷閲岀殑浣嶇疆(buffer 鍍忕礌) */
  viewTop = 0;
  /** 娓叉煋缂撳啿鐨勯珮搴?buffer 鍍忕礌);zoom = viewH / (11 鏍?脳 30 鍗曚綅) */
  viewH = 720;
  /** 娓叉煋缂撳啿鐨勫搴?鈽?蹇呴』鐢便€愮洅瀛愮殑闀垮姣斻€戞帹鍑烘潵銆?
   *  浠ュ墠鍥哄畾 1280(CSS 鍐嶆媺浼稿埌鐩掑瓙涓?,鑰岀洅瀛?鏄剧ず鍣ㄩ€忔槑绐楀彛)鏍规湰涓嶆槸 16:9 鈥斺€?
   *  瀹炴祴 1440脳900 鏃舵槸 1.80:1銆佺敤鎴烽偅鍧楀睆涓婃洿瀹?浜庢槸姘村钩琚媺闀裤€佸瀭鐩磋鍘嬫墎,
   *  **鏂瑰潡鐪嬬潃灏辨槸闀挎柟浣撹€屼笉鏄鏂逛綋**(鐢ㄦ埛瀹炴祴)銆傜紦鍐插拰鐩掑瓙鍚屾瘮渚?鈫?鎷変几鏄瓑姣旂殑銆?*/
  bufW = 1280;
  /** 杩欎竴甯х湡姝ｇ敾鍑烘潵鐨勭墿浠舵暟(HUD 鐢?甯х巼涓嶅鏃跺厛鐪嬪畠) */
  drawn = 0;
  private fracT = 0;

  private measureFrac() {
    const cv = document.getElementById('gd-canvas') as HTMLCanvasElement | null;
    const r = cv?.getBoundingClientRect();
    if (!cv || !r || r.height <= 0 || r.width <= 0) {
      this.viewFrac = 1; this.viewTop = 0; this.viewH = 720; this.bufW = 1280; return;
    }
    this.viewH = Math.round(720 * RENDER_SCALE);
    let w = Math.round(this.viewH * (r.width / r.height));
    /* 鈽?鍍忕礌棰勭畻:鐩掑瓙瓒婂,缂撳啿灏辫秺瀹?姣斾緥蹇呴』璺熺潃鐩掑瓙,涓嶇劧鏂瑰潡浼氬彉闀挎柟褰?銆?
       浣嗙洅瀛愬彲鑳介潪甯稿 鈥斺€?閭ｅ氨鏁翠綋缂╀竴妗?绛夋瘮缂?姣斾緥涓嶅彉),鍒濉厖鐜囨嫋鍨抚鐜囥€?*/
    const px = w * this.viewH;
    if (px > BUF_BUDGET) {
      const k = Math.sqrt(BUF_BUDGET / px);
      this.viewH = Math.max(240, Math.round(this.viewH * k));
      w = Math.max(320, Math.round(w * k));
    }
    this.bufW = Math.max(320, w);
    this.viewFrac = 1;
    this.viewTop = 0;
  }

  /** 鍙瀹藉害 = 鐢?VIEW_H_BLOCKS 涓庣敾骞呮瘮渚嬪喅瀹?鍙栨櫙妗嗗彧瑕嗙洊"闇插嚭鏉ョ殑閭ｄ竴鏉? */
  zoomOf() {
    return this.viewH / (VIEW_H_BLOCKS * U);
  }

  /** 鍥鹃泦鍔犺浇瀹?姣忎釜褰㈡€佹寫鍑恒€愮 1 缁勪富鍥?+ 鍚岀粍鍙戝厜灞傘€?鎶?plist 閲?韬虹潃鐨?甯ц浆姝ｅ悗
   *  鐢昏繘涓ゅ紶绂诲睆 canvas(涓€涓讳竴鍙戝厜),鍐嶆敞鍐屾垚 Phaser 璐村浘銆?
   *  鈽?涓嶅啀鎸夊抚鍙疯疆鎾?GD 鐨勭帺瀹跺浘闆嗘槸鎸夐儴浠舵媶鐨?铚樿洓 02/03/04 鏄吙绛夐儴浠?鐢诲竷灏哄杩樹笉涓€鏍?,
   *    娌℃湁閮ㄤ欢鍚堟垚琛ㄥ氨杞挱 = 涓€浼氬効鍙湁鑵夸竴浼氬効鍙湁鐪肩潧(鐢ㄦ埛鎶ョ殑"璐村浘鏄贡鐨?)銆?*/
  private buildIcons() {
    const REF_PX = 120;                       // GD 鐜╁鍥鹃泦鐨勫瘑搴?1 鍧?= 120 px(鏂瑰潡涓诲浘灏辨槸 120脳120)
    for (const a of ICON_ATLAS) {
      const img = this.textures.exists('iconimg-' + a.file)
        ? (this.textures.get('iconimg-' + a.file).getSourceImage() as HTMLImageElement) : null;
      const xml = this.cache.text.get('iconxml-' + a.file) as string | undefined;
      if (!img || !xml) continue;
      /* 鈽?鏂囦欢閿欓厤妫€鏌?瀹炴祴杩欏绱犳潗閲?cube 涓?GameSheet 灏辨槸閿欑殑):
         plist 閲岀殑 metadata.size 澹版槑浜嗗畠鎻忚堪鐨勯偅寮犲浘闆嗘湁澶氬ぇ 鈥斺€?鍜岀湡瀹?png 瀵逛笉涓婂氨銆愪笉瑕佺敤銆?
         鍚﹀垯甯у潗鏍囧叏閿欎綅(鐢诲嚭鏉ュ氨鏄竴鍫嗛敊浣嶇殑纰庣墖)銆?*/
      const meta = /<key>size<\/key>\s*<string>\{([\d.]+),([\d.]+)\}<\/string>/.exec(xml);
      if (meta && (Math.abs(+meta[1] - img.naturalWidth) > 1 || Math.abs(+meta[2] - img.naturalHeight) > 1)) {
        console.warn('[gd] 鍥鹃泦涓?plist 灏哄瀵逛笉涓?璺宠繃:' + a.file + '.png ' + img.naturalWidth + '脳' + img.naturalHeight
          + ' vs plist 澹版槑 ' + meta[1] + '脳' + meta[2]);
        continue;
      }
      const F = parsePlistFrames(xml);
      if (!F) continue;
      /* 涓诲浘 = 鎵€鏈?闈?_2_/_extra_/_glow_"甯ч噷鏈鍓昂瀵告渶澶х殑閭ｄ釜(鏁村彧瑙掕壊) */
      const mains = Object.keys(F).filter((n) => !/_2_|_extra_|_glow_/.test(n));
      if (!mains.length) continue;
      const name = mains.sort((p, q) => (F[q].sourceSize.w * F[q].sourceSize.h) - (F[p].sourceSize.w * F[p].sourceSize.h))[0];
      const glowName = name.replace(/_(\d+)\.png$/, '_glow_$1.png');
      const made: Array<{ layer: 'body' | 'glow'; tex: string; w: number; h: number }> = [];
      for (const [layer, fr] of [['body', F[name]], ['glow', F[glowName]]] as const) {
        if (!fr) continue;
        const W = Math.max(4, Math.round(fr.sourceSize.w)), H = Math.max(4, Math.round(fr.sourceSize.h));
        const cv = document.createElement('canvas');
        cv.width = W; cv.height = H;
        const c2 = cv.getContext('2d');
        if (!c2) continue;
        /* 鍥鹃泦閲岀殑瀹為檯鍖哄煙:rotated 鐨勫抚瀹介珮鏄€愪簰鎹€戠殑,鑰屼笖鍐呭鏄汉鐫€鐨?*/
        const sw = fr.rotated ? fr.frame.h : fr.frame.w;
        const sh = fr.rotated ? fr.frame.w : fr.frame.h;
        const tw = fr.frame.w, th = fr.frame.h;                     // 杞涔嬪悗鐨勬樉绀哄昂瀵?
        /* 鏈鍓敾甯冮噷鐨勪綅缃?涓績 = 鐢诲竷涓績 + spriteOffset(y 杞村拰鐢诲竷鐩稿弽) */
        const dx = W / 2 + fr.spriteSourceSize.x - tw / 2;
        const dy = H / 2 - fr.spriteSourceSize.y - th / 2;
        c2.save();
        c2.translate(dx + tw / 2, dy + th / 2);
        if (fr.rotated) c2.rotate(-Math.PI / 2);                    // 瀹炴祴:-90掳 鎵嶆槸姝ｇ殑
        c2.drawImage(img, fr.frame.x, fr.frame.y, sw, sh, -tw / 2, -th / 2, tw, th);
        c2.restore();
        const tex = 'icon-' + a.file + '-' + layer;
        if (this.textures.exists(tex)) this.textures.remove(tex);
        this.textures.addCanvas(tex, cv);
        made.push({ layer, tex, w: W, h: H });
      }
      const body = made.find((m) => m.layer === 'body');
      if (!body) continue;
      const glow = made.find((m) => m.layer === 'glow');
      this.iconLayers.push({
        mode: a.mode,
        body: this.add.image(0, 0, body.tex).setVisible(false).setDepth(16),
        glow: glow ? this.add.image(0, 0, glow.tex).setVisible(false).setDepth(17) : null,
        bw: body.w, bh: body.h,
        pxPerUnit: REF_PX / (WATER_CHART.start ? 30 : 30),          // 瑙?REF_PX:120 px = 1 鍧?= 30 鍗曚綅
      });
    }
    this.iconsReady = this.iconLayers.length > 0;
    console.log('[gd] 褰㈡€佸浘闆嗗氨缁?' + this.iconLayers.map((l) => l.mode + '(' + l.bw + '脳' + l.bh + ')').join(' '));
  }

  /** 鐢ㄥ浘闆嗘憜鐜╁:浣嶇疆/灏哄/鏃嬭浆/涓婅壊銆?
   *  鈽?灏哄鐢ㄧ粺涓€瀵嗗害(120 px = 1 鍧?,涓嶆槸"姣忓眰鍚勮嚜鎾戞弧 1 鏍? 鈥斺€?鍚庤€呬細鎶婂皬鑵?鎻忚竟鏀惧ぇ鍒板拰韬綋涓€鏍峰ぇ銆?*/
  private drawIconPlayer(w: World, cxw: number, cyw: number, B: number) {
    const L = this.iconLayers.find((l) => l.mode === w.mode) ?? this.iconLayers[0];
    const on = !w.done;
    for (const l of this.iconLayers) {
      const vis = on && l === L;
      l.body.setVisible(vis);
      l.glow?.setVisible(vis);
    }
    let rot = 0;
    if (w.mode === 'cube') {
      /* 鈽?钀藉湴鍚稿钩 + 鏂瑰悜鍙栬礋鍙?瑙佷笅闈㈢煝閲忛偅鏉＄殑璇存槑) */
      rot = this.spinAng;
    } else if (w.mode === 'ship') {
      rot = Math.max(-0.55, Math.min(0.55, w.vy / P.shipVyMax * 0.55));
    } else if (w.mode === 'ball') {
      rot = (w.x / U) * 1.2;
    } else if (w.mode === 'wave') {
      rot = (w.vy >= 0 ? 1 : -1) * Math.PI / 4;
    } else if (w.mode === 'ufo') {
      rot = Math.max(-0.3, Math.min(0.3, w.vy / P.flyUpMax * 0.3));
    }
    const [c1] = ICON_COL[w.mode] ?? [0xffffff, 0xffffff];
    const kill = w.dead ? 0xff7a5a : null;
    const k = B / (L.pxPerUnit * 30);                     // 120 px = 30 鍗曚綅 鈫?k = B/120
    L.body.setPosition(cxw, cyw).setRotation(rot).setTint(kill ?? c1);
    L.body.setDisplaySize(L.bw * k, L.bh * k);
    if (L.glow) {
      L.glow.setPosition(cxw, cyw).setRotation(rot).setDisplaySize(L.bw * k, L.bh * k);
      L.glow.setTint(kill ?? 0xffffff).setAlpha(0.75).setBlendMode(Phaser.BlendModes.ADD);
    }
  }

  /** 鎺ㄨ繘 n 甯фā鎷?杈撳叆鎸夊綋鍓嶆ā寮忓彇:婕旂ず鍗?/ 鏈哄櫒浜?/ 閿洏) */
  pump(n: number) {
    /* 鈽呪槄 鍗峰瓙杩樻病涓嬪ソ灏卞埆鎺ㄨ繘(2026-09 淇?:婕旂ず鐨勮緭鍏ユ槸 `tape[tick]`,
       鑰?`loadTape()` 鏄紓姝?fetch 鈥斺€?浠ュ墠杩欎腑闂翠細鐓у父鎺ㄨ繘,浜庢槸**寮€澶村嚑鍗佷笂鐧惧抚鏄?娌℃湁杈撳叆"鍦ㄨ窇**,
       绛夊嵎瀛愬埌浜?浜哄拰鍗峰瓙宸茬粡閿欎綅,蹇呯劧鍦?x鈮?00 鍓嶅悗鎽旀銆佺劧鍚庢棤闄愰噸鏉ャ€?
       鐢ㄦ埛鎶ョ殑"鍙挱鏀句簡鍑犵灏辩粨鏉熶簡"灏辨湁瀹冧竴浠?鑰屼笖瀹冨彇鍐充簬缃戦€?椤甸潰鍔犺浇蹇參,鏄吀鍨嬬殑绔炴€併€?
       鐜板湪:娌″嵎瀛愬氨涓嶅姩(鎸夐挳涓婃樉绀?杞藉叆涓€?),鍗峰瓙鍒颁簡鍐嶇敱 loadTape 浠庡ご寮€涓€灞€銆?*/
    if (this.demoMode && !this.demoTape) return;
    for (let i = 0; i < n; i++) {
      const w0 = this.world;
      if (w0.dead) {
        /* 鈽?楠屾敹鐢?鎶?鍝竴甯с€佸湪鍝鐨?璁颁笅鏉?鈥斺€?婕旂ず鍗峰湪 Node 渚ф槸 0 姝讳骸,
           椤甸潰涓婅鏄湁姝讳骸,蹇呴』鑳戒竴鐪肩湅鍑烘槸鍝竴甯?鍝釜浣嶇疆(鍙湁涓€涓鏁版牴鏈煡涓嶅姩)銆?*/
        if (this.deathLog.length < 20) {
          this.deathLog.push({ tick: w0.tick, x: +(w0.x / U).toFixed(2), y: +(w0.y / U).toFixed(2), vy: +(w0.vy / U).toFixed(2), mode: w0.mode, gdir: w0.gdir, chunk: n, at: i, hold: this.demoHold(w0.tick) });
        }
        if (this.botMode || this.demoMode) {
          /* 鈽?婕旂ず鍗枫€愭浜嗕竴娆°€? 瀹冨拰褰撳墠鐗╃悊宸茬粡涓嶆槸涓€濂椾簡(鍗峰瓙鏄寜鏌愪竴鐗堢墿鐞嗘悳鍑烘潵鐨?銆?
             浠ュ墠浼氶潤榛樺娲汇€佹棤闄愰噸鏉?鐢ㄦ埛鐪嬪埌鐨?婕旂ず鍑犵灏辩粨鏉?闂竴涓?)鈥斺€?
             鐜板湪鐩存帴鍒ゅ畾"鍗峰瓙杩囨湡"骞堕€€鍑烘紨绀?鎸夐挳涓婂啓娓呮,鍒浣滆繕鑳借窇銆?*/
          if (this.demoMode) {
            this.demoErr = '婕旂ず鍗峰凡杩囨湡(鐗╃悊鏇存柊杩?绛夐噸鏂版墦鍖?';
            this.demoMode = false;
            this.phase = 'idle';
            this.pauseMusic();
            this.syncDemoButton();
            return;
          }
          /* 鏈哄櫒浜洪獙鏀?绔嬪埢澶嶆椿,鍜?Node 渚т竴鑷?*/
          const wasX = w0.checkX;
          w0.respawn();
          this.baseTick = Math.floor(this.tAtX(wasX) * 60);
          this.airT = 0;
        } else {
          this.phase = 'dead';                  // 鐪熶汉:鍋滀笅鏉ュ嚭姝讳骸鐣岄潰,涓嶅啀鑷姩澶嶆椿
          this.deathT = 0;
          this.pauseMusic();
          return;
        }
      }
      /* 杈撳叆鏉ユ簮:婕旂ず鍗锋寜 tick 鍙?閭ｅ嵎杈撳叆鏄粠 tick=0 鍏ㄧ▼褰曠殑),
         鍚﹀垯鍙嶅簲寮忔満鍣ㄤ汉,鍚﹀垯閿洏銆?*/
      /* 鈽呪槄 鐭寜涓㈠け鐨勪慨澶?2026-09,鐢ㄦ埛鎶?绌烘牸鏈夋椂鍊欏け鏁?+"璺崇幆鎸変簡娌＄敤"鍏跺疄鏄悓涓€鏉?:
         閿洏杩欐潯璺師鏉ャ€愬彧鐪?isDown 杞銆戔€斺€?keydown/keyup 钀藉湪涓ゆ杞涔嬮棿鐨勪竴涓嬩細琚暣甯т涪鎺?鉁?
         鑰岃烦鐜姹?鍦ㄧ幆閲岀殑閭ｄ竴甯ф湁鏂版寜涓?,涓竴鎷嶅氨鏄畬鍏ㄦ病鍙嶅簲 鉁椼€?
         confirmLatch 鏄湡瀹?keydown 璁颁笅鏉ョ殑(涓婇潰娉ㄩ噴鍐欑潃"鏋佺煭鐨勪竴涓嬩篃鏀跺緱鍒?),鐜板湪鎺ヨ繘鏉?
         鏈抚绗竴涓墿鐞嗗抚鍚冩帀瀹冨苟绔嬪埢娓呮帀 鈬?杩借刀甯т笉浼氭妸瀹冨綋鎴?涓€鐩存寜浣? 鉁?*/
      const useLatch = this.confirmLatch;
      this.confirmLatch = false;
      const hold = this.demoMode ? this.demoHold(w0.tick)
        : this.botMode ? botThink(w0)
          : (!!(this.keys.SPACE?.isDown || this.keys.UP?.isDown || this.keys.W?.isDown) || useLatch);
      if ((this.botMode || this.demoMode) && !this.botStarted) {       // 寮€鏈哄櫒浜?= 浠庡共鍑€鐨勪竴灞€寮€濮?鏂逛究鍜?Node 渚у鎸囩汗
        this.botStarted = true;
        this.started = true;
        this.world = new World(LEVEL);
        this.world.god = this.godWanted;
        this.world.padMul = this.padMulWanted;
        this.botStates = [];
        this.fp = '';
        this.prevY = 0;
        this.airT = 0;
        this.baseTick = 0;
        continue;
      }
      this.prevY = w0.y;
      w0.frame(hold);
      /* 鈽?鏃犳晫妯″紡鐨?杞ㄩ亾涓婇檺":寮€鐫€鏃犳晫鏃朵笉璁搁绂昏鍒掕蛋寤?瑙?clampToGuide) */
      this.clampToGuide();
      this.airT = w0.onGround ? 0 : this.airT + 1 / 60;
    /* 鈽呪槄 2026-09 鏂瑰潡鑷浆:鎸夋簮鐮侀噸鍐?PlayerObject::runNormalRotation @IDA 144512 +
       updateRotation @IDA 144749)銆傛簮鐮佽鐐?
         路 鏃嬭浆鍩烘暟 = 180掳,鏃堕棿甯告暟 0.33333(杩蜂綘 0.43333)鈬?90掳 涓€鍙伴樁銆佺害 1/3 绉掕蛋瀹屼竴姝?鉁?
         路 鏃嬭浆鏄€愭湞鐩爣瑙掔紦鍔?Slerp2D)+ 姣忓抚鏈€澶ц浆閲忋€戔噿 钀藉湴鏃剁洰鏍囧氨鏄?姝ｇ珛" 鈬?鑷劧鏀跺钩 鉁?
       鎵€浠ヨ繖閲屾槸"鍙伴樁 + 缂撳姩"缁撴瀯:绌轰腑鏈濅笅涓€涓?90掳 鍙伴樁璧?钀藉湴鏈濇渶杩戠殑 90掳 鍊嶆暟鏀?鉁撱€?*/
    if (w0.mode === 'cube') {
      const STEP = Math.PI / 2;
      const rate = (1 / 3) * 60;                     // 婧愮爜鐨勬椂闂村父鏁?0.33333 绉?/ 90掳 鈬?姣忕姝ユ暟
      const dir = w0.gdir >= 0 ? 1 : -1;             // 鏂瑰悜闅忛噸鍔涚炕杞?婧愮爜閲?flipMod 绠¤繖涓?
      if (w0.onGround) {
        const target = Math.round(this.spinAng / STEP) * STEP;
        this.spinAng += (target - this.spinAng) * 0.35;      // 蹇€熸敹骞?缂撳姩,涓嶆槸鐬烦)
        if (Math.abs(target - this.spinAng) < 0.001) this.spinAng = target;
      } else {
        this.spinAng += dir * STEP * rate / 60;              // 鍖€閫熻蛋鍙伴樁(0.33333 绉?/ 姝?
      }
    } else {
      this.spinAng = 0;
    }
      if (this.botMode) {
        this.botStates.push(w0.state);
        if (w0.done && !this.fp) this.fp = fingerprint(this.botStates);
      }
      if (w0.done) {
        if (this.demoMode) {
          /* 婕旂ず璺戝畬 = 閫氬叧:鍋滃湪杩欎竴甯?璁?閫氬叧"涓や釜瀛楃暀鍦?HUD 涓?R 鍙互閲嶇湅) */
          this.demoEndX = w0.x;
          this.phase = 'done';
          this.deathT = 0;
          this.pauseMusic();
          break;
        }
        if (!this.botMode) { this.phase = 'poem'; this.poemT = 0; this.egg = false; this.pauseMusic(); }
        break;
      }
    }
  }

  /** 婕旂ず鍗?绗?tick 甯ф寜涓嶆寜銆傚嵎瀛愭瘮妯℃嫙鐭氨涓€寰嬫澗鎵?涓嶈鍙戠敓,浣嗗埆瓒婄晫) */
  private demoHold(tick: number): boolean {
    const t = this.demoTape;
    return !!t && tick >= 0 && tick < t.length && t[tick];
  }

  /** 寮€/鍏炽€愮湅 bot 閫氬叧銆戙€傚紑鐨勬椂鍊欏鏋滃嵎瀛愯繕娌′笅杞?鍏堝幓涓嬭浇(鎳掑姞杞?骞虫椂涓嶅崰甯﹀) */
  toggleDemo() {
    this.demoMode = !this.demoMode;
    if (this.demoMode) {
      this.loadTape();
      this.world = new World(LEVEL);
      this.world.god = this.godWanted;
      this.world.padMul = this.padMulWanted;
      this.botStarted = false;
      this.botStates = [];
      this.fp = '';
      this.phase = 'running';
      this.started = true;
      this.baseTick = 0;
      this.prevY = 0;
      this.airT = 0;
      this.camInit = false;
      this.playMusicAt(0);
    } else {
      this.demoErr = '';
      this.restartFromZero();
    }
    this.syncDemoButton();
  }

  /** 涓嬭浇骞惰В鐮侀€氬叧杈撳叆鍗?RLE 鈫?姣忓抚涓€涓?bool) */
  private loadTape() {
    if (this.demoTried) return;
    this.demoTried = true;
    const url = (window as unknown as { __GD_TAPE?: string }).__GD_TAPE ?? '/assets/gd-tape.json';
    fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
      .then((j: { first: boolean; rle: number[] }) => {
        const out: boolean[] = [];
        let cur = j.first;
        for (const n of j.rle) { for (let i = 0; i < n; i++) out.push(cur); cur = !cur; }
        this.demoTape = out;
        this.demoLoaded = true;
        /* 鈽?鍗峰瓙鍒颁簡灏变粠骞插噣鐨勪竴灞€閲嶅紑 鈥斺€?杩欐牱"绗竴涓緭鍏ヤ竴瀹氭槸 tape[0]"(瑙?pump 寮€澶撮偅鏉″畧鍗? */
        if (this.demoMode) this.restartRun();
      })
      .catch((e: Error) => { this.demoErr = e.message; });
  }

  update(_t: number, dtMs: number) {
    this.updates++;
    this.lastDt = Number.isFinite(dtMs) ? dtMs : -1;      // 楠屾敹瑕佺湅:Phaser 鍒板簳鍠傝繘鏉ヤ粈涔?
    this.expose();
    this.fps = this.game.loop.actualFps;
    this.paintHud();
    /* 纭閿瘡甯у彧璇讳竴娆?杈规部鍒ゅ畾瑕佹寜甯ф秷璐? */
    const confirm = this.confirmDown();
    const restart = this.restartPressed;
    /* 鈽?R 浼樺厛浜庝竴鍒?浠讳綍闃舵銆佷换浣曟ā寮忛兘鍏堝鐞嗛噸鏉?浠ュ墠婕旂ず妯″紡鎶?phase 寮鸿鎺板洖 running,
       'done' 閭ｄ竴鏀案杩滆蛋涓嶅埌 鈫?"R 鏄憜璁?)銆?*/
    if (restart) this.restartRun();
    /* 璋冭瘯:鏁板瓧閿幇鍦烘崲褰㈡€?1 鏂瑰潡 2 椋炴満 3 鐞?4 UFO 5 娉㈡氮 6 鏈哄櫒浜?7 铚樿洓) */
    if (this.modeLatch) {
      const m = MODE_ORDER[this.modeLatch - 1];
      if (m) {
        this.world.mode = m;
        this.world.gdir = 1;
        this.world.vy = 0;
        this.world.y = Math.max(0, Math.min(this.world.y, LEVEL.rows * U - P.box));
      }
      this.modeLatch = 0;
    }

    if (this.phase === 'idle') {
      if (confirm) this.startRun();
      this.followCamera(); this.draw(); this.paintUi(); return;
    }
    if (this.phase === 'dead') {
      this.deathT += dtMs / 1000;
      /* 鍋滃崐鎷嶅啀鏀惰緭鍏?鍏嶅緱"姝讳骸鐬棿杩樻寜鐫€鐨勬墜"鐩存帴鎶婅彍鍗曠偣鎺?*/
      if (this.deathT > 0.35) {
        if (restart) this.restartFromZero();
        else if (confirm) this.retry();
      }
      this.followCamera(); this.draw(); this.paintUi(); return;
    }
    if (this.phase === 'poem') {
      /* 缁堟湯涔嬭瘲:鍚戜笂婊?鎸変綇绌烘牸(鎴栫偣浣忕敾闈?鍔犻€熷埌 3 鍊?*/
      const fast = !!(this.keys.SPACE?.isDown || this.keys.UP?.isDown || this.keys.W?.isDown);
      this.poemT += (dtMs / 1000) * (fast ? 3 : 1);
      const camVH = this.cameras.main.height / this.cameras.main.zoom;
      const total = POEM.length * POEM_LINE_H + camVH;      // 浠庡睆骞曚笅鏂逛竴鐩存粴鍒板畬鍏ㄥ嚭鍘?
      if (!this.egg && this.poemT * POEM_SPEED > total) { this.egg = true; this.unlockEaster(); }
      if (this.egg && confirm) { this.phase = 'idle'; this.egg = false; this.poemT = 0; }
      this.followCamera(); this.draw(); this.paintUi(); return;
    }
    if (this.phase === 'done') {
      this.deathT += dtMs / 1000;
      if (restart || (this.deathT > 0.5 && confirm)) this.restartFromZero();
      this.followCamera(); this.draw(); this.paintUi(); return;
    }

    if (this.botMode || this.demoMode) {
      /* 婕旂ず:鎸夈€愮湡瀹炴椂闂淬€戞帹杩?瑙?demoSpeed 鐨勮鏄?銆備竴甯ф覆鏌撴渶澶氭帹 240 甯?闃叉鍒囨爣绛鹃〉鍥炴潵鐖嗗抚銆?
         鍐呯疆鏈哄櫒浜洪獙鏀?botMode)鍥哄畾 8 鍊嶉€?瀹冨彧鏄敤鏉ュ拰 Node 渚у鎸囩汗,涓嶉渶瑕佷汉鐪嬨€?
         鈽?鏃堕棿鐢?performance.now() 鑷繁閲?涓嶇敤 Phaser 鐨?delta 鈥斺€?瀹炴祴 Phaser 鐨?delta 鏄?骞虫粦杩?鐨?
           183 娆?update/6 绉?澧欎笂 33ms 涓€娆?鍗村彧绱嚭 5.5 绉?婕旂ず浼氭參 25%(鐢ㄦ埛鎶ョ殑"鍊嶉€熶笉瀵?灏辨湁瀹冧竴浠?銆?*/
      const now = performance.now();
      const dtWall = this.lastWallMs ? Math.min(0.5, (now - this.lastWallMs) / 1000) : 0;
      this.lastWallMs = now;
      const sp = this.botMode ? 8 : this.demoSpeed;
      this.demoAcc += dtWall * sp;
      const want = Math.min(240, Math.floor(this.demoAcc * 60));
      if (want > 0) {
        this.demoAcc -= want / 60;
        this.pump(want);
      }
    } else if (this.dbgPause) {
      /* 鍐讳綇:鍙敾涓嶆帹(鍑哄浘/璋冭瘯鐢? */
    } else {
      const a = this.audio;
      const live = !!a && !a.paused && isFinite(a.duration) && a.duration > 0;
      const step = 1 / 60;
      /* 鈽?闊充箰鑳戒笉鑳藉綋"鏃堕挓"鐢?瀹冨緱鍜屾ā鎷熸椂闂磋酱瀵瑰緱涓娿€?
         瀵逛笉涓婄殑涓ょ鎯呭舰鈥斺€斺憼 鍒氬娲?baseTick 璺充簡,闊充箰杩樺仠鍦ㄦ棫浣嶇疆;鈶?鏈嶅姟鍣ㄤ笉鏀寔 Range 璇锋眰,
         娴忚鍣?seekable 鏄┖鐨?`currentTime = t` 浼氳鐩存帴蹇界暐(瀹炴祴鏈湴闈欐€佹湇鍔″櫒灏辨槸杩欐牱)銆?
         浠ュ墠鍙 live,浜庢槸杩欎袱绉嶆儏鍐典笅 target 鎭掍负 0 鈫?**鐢婚潰鍗′綇涓嶅姩**(鐢ㄦ埛鎶ョ殑灏辨槸"澶嶆椿鍚庝笉瀵?)銆?
         鐜板湪:瀵逛笉涓婂氨鍏堣瘯鐫€閲?seek(1.5 绉掍竴娆?,鍚屾椂銆愮収甯告寜鍥哄畾姝ラ暱鎺ㄨ繘妯℃嫙銆?缁濅笉鍗′綇銆?*/
      const wantT = (this.baseTick + this.world.tick) / 60;
      const synced = live && Math.abs(a!.currentTime - wantT) <= 1.5;
      if (synced) {
        /* 鈽?鐢遍煶涔愰┍鍔?鐢婚潰閲岀殑闅滅姝ｅソ钀藉湪瀹冨搴旂殑閭ｄ竴鎷嶄笂 */
        const target = Math.max(0, Math.floor(a!.currentTime * 60) - this.baseTick);
        let n = 0;
        while (this.world.tick < target && n < 8) { this.pump(1); n++; }
      } else {
        if (live) {
          const now = performance.now();
          if (now - this.lastSeekTry > 1500) { this.lastSeekTry = now; this.seekMusic(wantT); }
        }
        this.acc += Math.min(dtMs / 1000, 0.5);
        let n = 0;
        while (this.acc >= step && n < 5) { this.acc -= step; this.pump(1); n++; }
      }
    }
    if (this.phase !== 'running') { this.followCamera(); this.draw(); this.paintUi(); return; }   // pump 閲屽彲鑳藉垰姝?鍒氶€氬叧
    this.followCamera();
    this.draw();
    this.paintUi();
    this.expose();
  }

  /** HUD(DOM 閲岄偅鏉?:姣忓抚閮藉埛 鈥斺€?浠ュ墠鍙湪"璺戠潃"鐨勫垎鏀噷鍒?姝讳骸鐣岄潰涓婄殑 HUD 鏄畫鐣欑殑鏃у€?*/
  private paintHud() {
    this.syncGodButton();
    this.syncDemoButton();
    const hud = document.getElementById('gd-hud');
    if (!hud) return;
    const w = this.world;
    const parts = [
      MODE_NAME[w.mode] ?? w.mode,
      segOf(w.x) || '',
      Math.round(w.progress * 100) + '%',
      '灏濊瘯 ' + String(w.attempts).padStart(2, '0'),
    ];
    if (this.phase === 'dead') parts.push('鎽斾簡');
    if (this.phase === 'idle') parts.push('鎸夌┖鏍煎紑濮?);
    if (this.phase === 'done') parts.push('閫氬叧');
    if (w.mode === 'ship') parts.push('鎸変綇 = 涓婂崌');
    if (w.god) parts.push('鈽?鏃犳晫' + (this.guide.length ? ' 路 闄愯建 卤' + GUIDE_BAND + ' 鍧? : ' 路 鍙创杈圭晫'));
    if (this.demoMode) {
      const n = this.demoTape ? this.demoTape.length : 0;
      parts.push(this.demoTape
        ? '婕旂ず bot 閫氬叧 脳' + this.demoSpeed.toFixed(2).replace(/\.?0+$/, '') + '(' + (n / 60 / this.demoSpeed).toFixed(0) + 's 鏀惧畬)'
        : this.demoErr ? '婕旂ず鍗峰姞杞藉け璐?' + this.demoErr : '婕旂ず鍗疯浇鍏ヤ腑鈥?);
    }
    if (Math.abs(w.padMul - 1) > 0.001) parts.push('璺崇偣脳' + w.padMul.toFixed(2));
    /* 鈽?鍙鏍兼暟 + 鍙栨櫙妗嗚澶栨鎸℃帀鐨勬瘮渚?鍜屽師鐗堝涓嶄笂鏃?涓€鐪肩湅鍑烘槸缂╂斁杩樻槸瑁佸垏闂 */
    const cam = this.cameras.main;
    const vhBlocks = (cam.height / cam.zoom) / U;
    parts.push('鍙 ' + vhBlocks.toFixed(1) + ' 鏍?);
    /* 鈽?榛戣竟鑷煡:鎶?鐢诲竷"鍜?澶栨鐨勯€忔槑绐楀彛"涓や釜鐭╁舰鐩存帴鎵撳湪 HUD 涓?鈥斺€?
       涓嶇敤 DevTools,涓€鐪肩湅鍑虹敾甯冩瘮绐楀彛鐭灏?鍋忎簡澶氬皯(榛戣竟 = 鐢诲竷娌¤兘鐩栦綇绐楀彛)銆?
       绐楀彛鐨勫洓鏉¤竟浠?FrameFit 鍐欏湪 CSS 鍙橀噺閲岀殑 --ff-win-* 璇?浠ュ墠杩欓噷鎵撶殑鏄?
       .screen-frame 鈥斺€?閭ｆ槸銆愭暣鍧楄鍙ｃ€?閲忓嚭鏉ユ案杩滅瓑浜庤鍙?浠€涔堥兘璇存槑涓嶄簡)銆?*/
    const cvEl = document.getElementById('gd-canvas');
    const hostEl = cvEl?.parentElement ?? document.querySelector('.lost');
    if (cvEl && hostEl) {
      const cv = cvEl.getBoundingClientRect();
      const cs = getComputedStyle(hostEl);
      const px = (nm: string) => parseFloat(cs.getPropertyValue(nm)) || 0;
      const wl = px('--ff-win-left'), wt = px('--ff-win-top');
      const wr = px('--ff-win-right'), wb = px('--ff-win-bottom');
      const ww = window.innerWidth - wl - wr, wh = window.innerHeight - wt - wb;
      const seamB = (window.innerHeight - wb) - cv.bottom;      // >0 = 搴曚笅鐣欎簡缂?
      const seamR = (window.innerWidth - wr) - cv.right;
      const seamT = cv.top - wt;
      parts.push('鐩?' + Math.round(cv.width) + '脳' + Math.round(cv.height) + '@' + Math.round(cv.top)
        + ' 绐?' + Math.round(ww) + '脳' + Math.round(wh) + '@' + Math.round(wt));
      const seams = [['涓?, seamB], ['鍙?, seamR], ['涓?, seamT]] as const;
      const bad = seams.filter(([, v]) => Math.abs(v) > 1.5)
        .map(([k, v]) => k + (v > 0 ? '缂?' : '婧?') + Math.abs(Math.round(v)));
      if (bad.length) parts.push(bad.join(' '));
    }
    if (this.viewFrac < 0.995) parts.push('鐢诲竷琚尅 ' + Math.round((1 - this.viewFrac) * 100) + '%');
    /* 鈽?缂撳啿灏哄 + 瀹為檯鐢讳簡鍑犱釜鐗╀欢:甯х巼涓嶅鏃朵竴鐪肩湅鍑烘槸"鐢诲お澶?杩樻槸"鍍忕礌澶" */
    parts.push('缂撳啿 ' + this.bufW + '脳' + this.viewH + ' 缁?' + this.drawn);
    parts.push(Math.round(this.fps) + ' fps');
    parts.push(this.audio && !this.audio.paused ? '鈾?' + this.audio.currentTime.toFixed(1) + 's' : '鏆傚仠');
    hud.textContent = parts.filter(Boolean).join(' 路 ');
    hud.classList.toggle('is-dead', this.phase === 'dead');
  }

  /** 鍙栨櫙:鐓ф惉鍘熺増(OpenGD PlayLayer::updateCamera)鈥斺€?
   *  鈽?妯悜:鐩告満宸﹁竟缂?= 鐜╁ x 鈭?灞忓/2.5(鍗充汉绔欏湪灞忓箷宸︿晶 40% 澶?;
   *  鈽?鏂瑰潡褰㈡€?浜鸿鍥板湪瑙嗛噹閲岀殑涓€鏉″甫瀛?[涓嬭竟+120, 涓嬭竟+灞忛珮鈭?0] 鍗曚綅閲?
   *    瓒婂嚭涓嬫部 鈫?涓嬭竟 = 浜?鈭?120;瓒婂嚭涓婃部 鈫?涓嬭竟 = 浜?鈭?灞忛珮 + 90;璺戝湪鍦伴潰涓?鈫?鍥炶惤鍒?鈭?0;
   *  鈽?椋炶绫?/ 鐞?杩涢棬閭ｄ竴鍒绘妸瑙嗗彛涓績閽夋(鍘熺増 m_fCameraYCenter),杩欏氨鏄?瑙嗗彛琚浐瀹?;
   *  鈽?鏈€鍚庡す鍦?[鈭?0, 鍏冲崱楂?鈭?灞忛珮] 閲?涓嶄細鎷嶅埌鍏冲崱澶栭潰銆?
   *  鍧愭爣:涓栫晫 y 鏈濅笂,Phaser 鐩告満 y 鏄€愮粯鍥剧┖闂淬€?鏈濅笅銆? 鍦ㄥ叧鍗￠《),鏈€鍚庢崲绠椾竴娆°€?*/
  private followCamera() {
    const cam = this.cameras.main;
    const vw = cam.width / cam.zoom;
    const vh = cam.height / cam.zoom;
    const rowsU = LEVEL.rows * U;
    const w = this.world;

    /* ---- 妯悜 ---- */
    const left = Math.max(0, w.x - vw * 0.4);
    this.camX = left + vw / 2;

    /* ---- 褰㈡€佸垏鎹?璁颁笅"杩涢棬鏃剁殑瑙嗗彛涓績"(鍘熺増 m_fCameraYCenter) ---- */
    if (w.mode !== this.camMode) {
      if (CAM_FIXED_MODES.has(w.mode)) {
        const portalY = w.portalY;                       // 闂ㄧ殑浣嶇疆(涓栫晫 y)
        if (w.mode === 'ball') {
          this.camCenter = portalY < CAM_BALL_BELOW ? CAM_BALL_CENTER
            : Math.floor((portalY + CAM_LOW) / U) * U - CAM_LOW;
        } else {
          this.camCenter = portalY < CAM_FLY_BELOW ? CAM_FLY_CENTER
            : Math.floor((portalY + CAM_LOW) / U) * U - CAM_LOW;
        }
      }
      this.camMode = w.mode;
    }

    /* ---- 绾靛悜:瑙嗛噹涓嬭竟(涓栫晫 y銆佸崟浣? ---- */
    const py = w.y + (P.box * w.sizeMul) / 2;            // 浜轰腑蹇?
    let bottom: number;
    if (CAM_FIXED_MODES.has(w.mode)) {
      bottom = this.camCenter - vh / 2;                  // 閽夋:瑙嗗彛涓績 = 杩涢棬鏃剁殑楂樺害
    } else {
      const flip = w.gdir < 0;
      const unk2 = flip ? CAM_MID : CAM_LOW;             // 涓婃部浣欓噺
      const unk3 = flip ? CAM_LOW : CAM_MID;             // 涓嬫部浣欓噺
      let c = this.camBottom;
      if (py <= vh + c - unk2) {
        if (py < unk3 + c) c = py - unk3;                // 鎺夊嚭涓嬫部 鈫?璐村洖涓嬫部
      } else {
        c = py - vh + unk2;                              // 鍐插嚭涓婃部 鈫?璐村洖涓婃部
      }
      /* 璺戝湪銆愬湴闈€戜笂(涓嶆槸绔欏湪鏂瑰潡涓?:鐩告満鍥炶惤鍒板湴闈㈤珮搴?鍘熺増 cam.y = 0) */
      if (!flip && w.onGround && w.y <= 0.001) c = CAM_GROUND_BOTTOM;
      bottom = c;
    }
    if (!this.camInit) { this.camBottom = bottom; this.camCenter = bottom + vh / 2; this.camInit = true; }
    const lo = Math.min(CAM_GROUND_BOTTOM, rowsU - vh);
    const hi = Math.max(lo, rowsU - vh);
    bottom = Math.max(lo, Math.min(hi, bottom));
    this.camBottom = bottom;
    this.camCenter = bottom + vh / 2;
    this.camWorldY = rowsU - this.camCenter;             // 鎹㈢畻鎴?Phaser 鐩告満鐨勭粯鍥剧┖闂?y
    cam.centerOn(this.camX, this.camWorldY);
  }

  /** 涓変釜鐣岄潰(寮€鍦?/ 姝讳骸 / 閫氬叧)+ 缁堟湯涔嬭瘲 + 褰╄泲绐楀彛:浣嶇疆璺熺潃鐩告満鍙栨櫙璧?*/
  private paintUi() {
    const cam = this.cameras.main;
    const vw = cam.width / cam.zoom;
    const vh = cam.height / cam.zoom;
    const ux = Math.max(vw / 2, this.camX);
    /* 鈽?鐣岄潰鏂囧瓧璺熺潃銆愰暅澶淬€戣蛋:閾洪潰楂?125 鏍?鍐嶇敤"鍦哄湴涓績"灏变細鎶婇潰鏉跨敾鍒扮敾澶栧幓 */
    const uy = this.camWorldY;
    const w = this.world;
    /* 缁堟湯涔嬭瘲:鍗曠嫭涓€鏉￠暱鏂囨湰,浠庡彇鏅笅鏂瑰悜涓婃粴 */
    const inPoem = this.phase === 'poem';
    this.poemText.setVisible(inPoem);
    if (inPoem) {
      this.uiTitle.setVisible(this.egg);
      this.uiHint.setVisible(this.egg);
      const poemLines = POEM.length * POEM_LINE_H;
      this.poemText.setPosition(ux, uy + vh / 2 + poemLines - this.poemT * POEM_SPEED);
      if (this.egg) {
        this.uiTitle.setText('褰╄泲宸茶В閿?);
        this.uiHint.setText('鍙墠寰€ CD 椤甸潰鏌ョ湅(宸︿笅瑙掍細澶氬嚭涓€涓寜閽?\n鎸夌┖鏍?/ 鐐逛竴涓?鍥炲埌寮€澶?);
        this.uiTitle.setPosition(ux, uy - 26);
        this.uiHint.setPosition(ux, uy + 34);
      }
      return;
    }
    const show = this.phase !== 'running';
    this.uiTitle.setVisible(show);
    this.uiHint.setVisible(show);
    if (!show) return;
    if (this.phase === 'idle') {
      this.uiTitle.setText('绗笁寮犵洏 路 杩疯尗');
      this.uiHint.setText('鎸?绌烘牸 寮€濮?涔熷彲浠ョ偣涓€涓嬬敾闈?\n鎸変綇 = 杩炶烦 路 寮圭哀纰板埌灏卞脊銆佷笉鐢ㄦ寜 路 璺崇幆瑕佹寜涓€涓?路 R = 閲嶆潵');
    } else if (this.phase === 'dead') {
      this.uiTitle.setText('鎽斾簡 路 ' + Math.round(w.progress * 100) + '%');
      const at = LEVEL.length > 0 ? Math.round(w.checkX / U / LEVEL.length * 100) : 0;
      this.uiHint.setText('绌烘牸 / 鐐逛竴涓?= 浠庝笂涓€澶勫瓨妗ｇ偣(' + at + '% 澶?閲嶆潵 路 R = 浠庡ご寮€濮?);
    } else {
      this.uiTitle.setText('閫氬叧 路 ' + Math.round(w.progress * 100) + '%');
      this.uiHint.setText('浣犺窇瀹屼簡杩欎竴寮犵洏 路 鎸?R 鍐嶆潵涓€閬?);
    }
    this.uiTitle.setPosition(ux, uy - 26);
    this.uiHint.setPosition(ux, uy + 34);
  }

  /** 瀵瑰鏆撮湶缁欓獙鏀惰剼鏈?姣忓抚鍒锋柊,楠屾敹闅忔椂璇诲埌鐨勯兘鏄綋鍓嶇姸鎬? */
  expose() {
    (window as unknown as { __gd?: unknown }).__gd = {
      world: this.world, scene: this, level: LEVEL,
      audio: this.audio ? { t: this.audio.currentTime, paused: this.audio.paused, duration: this.audio.duration || 0, err: this.audioErr, src: this.audio.src } : null,
      started: this.started,
      phase: this.phase,
      god: this.world.god,
      demoMode: this.demoMode,
      demoTape: this.demoTape,
      demoLoaded: this.demoLoaded,
      demoErr: this.demoErr,
      demoEndX: this.demoEndX,
      /* 鈽?楠屾敹鑴氭湰瑕佺敤鐨勫嚑涓挬瀛?姣忎釜 bug 閮借鑳藉湪鐪熸祻瑙堝櫒閲岄噺鍑烘潵,涓嶈兘鍙潬"鎴戠湅鐫€濂戒簡"):
         路 musicExpected 鈥斺€?妯℃嫙鏃堕棿杞翠笂鐨勭鏁?baseTick + tick)/60,澶嶆椿鍚庨煶涔愬氨璇ュ湪杩欏効
         路 retry/restartRun 鈥斺€?涓嶉潬鎸夐敭涔熻兘椹卞姩澶嶆椿/閲嶆潵
         路 padMul 鈥斺€?寮圭哀鍔涘害寰皟鍒板簳鏈夋病鏈夌敓鏁?*/
      musicExpected: (this.baseTick + this.world.tick) / 60,
      baseTick: this.baseTick,
      padMul: this.padMulWanted,
      demoSpeed: this.demoSpeed,
      demoAcc: this.demoAcc,
      updates: this.updates,
      lastDt: this.lastDt,
      deathLog: this.deathLog,
      retry: () => this.retry(),
      restartRun: () => this.restartRun(),
      tapeHold: (tick: number) => this.demoHold(tick),
    };
  }

  /** 鎶婄浉鏈虹殑鍙栨櫙妗嗚鎴?鐢诲竷閲岀湡姝ｉ湶鍑烘潵鐨勯偅涓€鏉?(琚妗嗘尅浣忕殑閮ㄥ垎骞茶剢涓嶆覆鏌?銆?
   *  鈽?鍙﹀鎶婄敾甯冪殑 CSS 灏哄鎸夊洖 100%脳100%:Phaser 鐨?ScaleManager(mode: NONE)浼氭妸
   *    canvas 鐨勮鍐呮牱寮忓啓鎴?1280px脳720px 鈥斺€?浜庢槸鐢诲竷鍥哄畾 720 px 楂?鑰屽妗嗙獥鍙ｅ彧鏈?
   *    ~525 px,澶氬嚭鏉ョ殑 38% 灏辫閲戝睘杈规鎸′綇(鐢ㄦ埛鎴浘:HUD 鍐欑潃"鐢诲竷琚尅 38%",
   *    搴曚笅杩橀湶鍑轰竴鏉￠粦鏉?鍏冲崱搴曢儴鐨勫埡鍏ㄨ瑁佹帀)銆傝繖涓€鍙ユ墠鏄湡姝ｇ殑鐥呮牴銆?*/
  private applyViewport(cam: Phaser.Cameras.Scene2D.Camera) {
    /* 鈽?鍏堣缂撳啿璺熺潃鐩掑瓙鐨勯暱瀹芥瘮璧?鍐嶆妸鐢诲竷鐨?CSS 灏哄鎸夊洖 100%脳100% 鈥斺€?
       椤哄簭涓嶈兘鍙?Phaser 鐨?ScaleManager 浼氬湪 resize 鏃舵妸 canvas 鐨勮鍐呮牱寮忓張鍐欐垚
       "1280px/xxx px",閭ｆ鏄簳閮ㄩ偅鏉￠粦鏉?鐢诲竷鍥哄畾楂樸€佽涓嶄笅绐楀彛)鐨勬潵婧愩€?*/
    if (this.scale.height !== this.viewH || this.scale.width !== this.bufW) this.scale.resize(this.bufW, this.viewH);
    const cv = document.getElementById('gd-canvas') as HTMLCanvasElement | null;
    if (cv) {
      cv.style.width = '100%';
      cv.style.height = '100%';
    }
    cam.setViewport(0, 0, this.bufW, this.viewH);
    cam.setSize(this.bufW, this.viewH);
    cam.setZoom(this.zoomOf());
  }

  draw() {
    const g = this.g, w = this.world, cam = this.cameras.main;
    this.drawn = 0;
    /* 鈽?鐪熸鐨勭梾鏍瑰湪銆恦iewport銆?create() 鏃剁埗瀹瑰櫒杩樻病閲忓埌灏哄,鐩告満鐨?viewport 琚畾鎴?
       320脳180(鎭板ソ鍥涘垎涔嬩竴),娓叉煋灏辫瑁佸湪宸︿笂瑙掍竴灏忓潡閲?鈥斺€?鍙敼 setSize 娌＄敤,寰楄 viewport銆?*/
    if (!this.fixed) {
      this.fixed = true;
      this.measureFrac();
      this.applyViewport(cam);
      window.addEventListener('resize', () => { this.measureFrac(); this.applyViewport(cam); });
    }
    /* 姣?20 甯?鎴栧垰寮€灞€)閲嶆柊閲忎竴娆?闇插嚭鏉ョ殑閭ｄ竴鏉?缂撳啿姣斾緥鍙樹簡灏辫窡鐫€鏀瑰彇鏅 */
    if (this.fixed && (this.fracT++ % 20 === 0)) {
      const before = [this.viewTop, this.viewH, this.bufW];
      this.measureFrac();
      if (before[0] !== this.viewTop || before[1] !== this.viewH || before[2] !== this.bufW) this.applyViewport(cam);
    }
    const bx = w.x / U;
    const seg = LEVEL.segments.find((sg) => bx >= sg.from && bx < sg.to) || LEVEL.segments[0];
    /* color 瑙﹀彂鍣ㄥ彲浠ユ暣浣撴崲鑹?瀹冨帇杩囨钀介厤鑹? */
    const tint = w.tint != null ? w.tint : PAL[LEVEL.segments.indexOf(seg) % PAL.length];
    const vw = cam.width / cam.zoom, vh = cam.height / cam.zoom;
    const x0 = this.camX - vw / 2, x1 = x0 + vw;
    const rowsU = LEVEL.rows * U;
    /* 鈽?缁樺浘绌洪棿:y 鍚戜笅,涓栫晫 y=0(鍦伴潰)鐢诲湪 rowsU 澶?鈥斺€?涓栫晫鍧愭爣杩囨潵涓€寰嬭蛋瀹?鏁村箙鐢诲氨涓嶄細鍊掋€?
       瑙嗗彛涓婁笅杈圭敱銆愮旱鍚戣窡闅忛暅澶淬€戠粰鍑?camWorldY 卤 鍗婂睆銆?*/
    const Y = (wy: number) => rowsU - wy;
    const dy0 = this.camWorldY - vh / 2, dy1 = dy0 + vh;
    const lowY = rowsU - dy1, highY = rowsU - dy0;      // 鍙鐨勪笘鐣?y 鑼冨洿(鍗曚綅)
    const groundY = Y(0), ceilY = Y(rowsU);
    const tick = this.world.tick;
    g.clear();

    /* 鍦哄湴涔嬪鍘嬫殫(鍦伴潰浠ヤ笅 / 鍏冲崱椤朵互涓?閾洪潰楂樼殑鏃跺€欒繖涓ゅ潡鍩烘湰閮藉湪鐢诲) */
    g.fillStyle(0x03050a, 0.72);
    g.fillRect(x0, dy0, vw, Math.max(0, groundY + U - dy0));
    g.fillRect(x0, ceilY - U, vw, Math.max(0, dy1 - (ceilY - U)));

    // 鍦哄湴缃戞牸(姣忓潡涓€鏉＄粏绾?鍙敾鐪嬪緱瑙佺殑閭ｅ嚑琛?
    g.lineStyle(1, tint, 0.09);
    for (let gx = Math.floor(x0 / U); gx <= x1 / U; gx++) g.lineBetween(gx * U, dy0, gx * U, dy1);
    const r0 = Math.max(0, Math.floor(lowY / U)), r1 = Math.min(LEVEL.rows, Math.ceil(highY / U));
    for (let r = r0; r <= r1; r++) g.lineBetween(x0, Y(r * U), x1, Y(r * U));
    // 鍦伴潰绾夸笌澶╄姳鏉跨嚎(璺戦亾鐨勪笂涓嬭竟)
    g.lineStyle(2, tint, 0.6).lineBetween(x0, groundY, x1, groundY);
    g.lineStyle(1, tint, 0.42).lineBetween(x0, ceilY, x1, ceilY);
    /* 鍦伴潰浠ヤ笅:鍑犳潯瓒婃潵瓒婃贰鐨勬í绾?鍋氬嚭"鍦颁笅"鐨勫帤搴︽劅 */
    g.lineStyle(1, tint, 0.18);
    for (let k = 1; k <= 4; k++) g.lineBetween(x0, groundY + k * 22, x1, groundY + k * 22);

    /* 鐗╀欢:涓ら亶 鈥斺€?鍏堣楗?deco 鏄儗鏅创鐗?涓嶈鐩栧湪鏂瑰潡涓?,鍐嶇帺娉曠墿浠?*/
    for (const pl of this.portalLabels) {
      const off = w.offsetOf(pl.o);
      pl.t.setX((pl.o.b + pl.o.w / 2 + off.dx) * U);
      pl.t.setY(Y((pl.o.r + pl.o.h + off.dy) * U) - 8);
    }
    for (let pass = 0; pass < 2; pass++) {
    this.artUsed = 0;                              // 鈽?璐村浘姹?杩欎竴甯т粠 0 寮€濮嬪垎閰?鐢诲畬鎶婂墿涓嬬殑钘忔帀
    for (const o of LEVEL.objects) {
      if ((o.kind === 'deco') !== (pass === 0)) continue;
      if (o.kind === 'trigger') continue;         // 瑙﹀彂鍣ㄦ槸涓€昏緫鐗╀欢,涓嶇敾
      /* 鈽?鍏堢敤銆愰潤鎬佸潗鏍囥€戠矖绛?鍐嶉棶瑙﹀彂鍣ㄥ亸绉?鈥斺€?offsetOf 浠ュ墠鏀惧湪鏈€鍓嶉潰,
         8980 涓墿浠舵瘡涓兘闂竴娆?鑰屼笖瀹冭嚜宸辫繕鏄嚎鎬ф壂),鏄抚鐜囨帀涓嬫潵鐨勪富鍥犮€?
         鐣欎竴鍧椾綑閲?浼氬姩鐨勭墿浠跺彲鑳戒粠灞忓箷澶栨帹杩涙潵銆?*/
      if ((o.b + o.w) * U < x0 - CULL_MARGIN || o.b * U > x1 + CULL_MARGIN) continue;
      /* 浼氬姩鐨勪笢瑗?瑙﹀彂鍣ㄦ帹鐨?鎸夎繍琛屾椂鍋忕Щ鐢?鍒ゅ畾鐩掑湪 sim 閲屽凡缁忓悓姝ヨ繃浜?*/
      const off = w.offsetOf(o);
      const obx = (o.b + off.dx) * U, obw = o.w * U, obh = o.h * U;
      const oTop = Y((o.r + o.h + off.dy) * U);   // 鏍煎瓙涓婅竟(缁樺浘绌洪棿)
      const oBot = Y((o.r + off.dy) * U);         // 鏍煎瓙涓嬭竟
      if (obx + obw < x0 || obx > x1) continue;
      if ((o.r + o.h + off.dy) * U < lowY || (o.r + off.dy) * U > highY) continue;
      this.drawn++;
      /* 鈽?鏈夎创鍥剧殑鐗╀欢鐩存帴鐢昏创鍥?閿墖/寮圭哀鏉?瀛樻。鐐?纭竵/鍒?,娌¤创鍥剧殑璧颁笅闈㈢殑鐭㈤噺鐢绘硶 */
      const artKey = this.artKeyOf(o);
      if (artKey && this.drawArtObject(o, artKey, obx + obw / 2, oBot - obh / 2, obw, obh, o.kind === 'block' ? tint : 0xffffff)) continue;
      switch (o.kind) {
        case 'platform':
          if (o.r < 0) {
            /* 鍦伴潰:鍘氭潯 + 椤堕儴浜嚎 + 鏂滅汗銆傗槄 濉緱瀹炰竴鐐?0.72)鈥斺€?鍘熺増鍦伴潰鏄€愪笉閫忔槑銆戠殑,
               y<0 鐨勪笢瑗?姣斿杩欏叧閲屾斁鍦?y=鈭?.1 鐨勯偅涓?67)鏄鍦伴潰鎸′綇鐨勩€佺帺瀹剁湅涓嶈;
               鎴戜滑浠ュ墠鐢?0.13 鐨勬贰濉?搴曚笅閭ｄ竴鎺?钃濊壊璺崇偣"灏遍€忓嚭鏉ヤ簡銆?*/
            g.fillStyle(0x0a0f18, 0.92).fillRect(obx, oTop, obw, obh);
            g.fillStyle(tint, 0.13).fillRect(obx, oTop, obw, obh);
            g.lineStyle(2, tint, 0.9).lineBetween(obx, oTop + 1, obx + obw, oTop + 1);
            g.lineStyle(1, tint, 0.22);
            for (let hx = obx + 10; hx < obx + obw; hx += 18) g.lineBetween(hx, oTop + 4, hx - 6, oTop + obh - 2);
          } else {
            /* 骞冲彴:钖勬澘璐村湪鏍煎瓙椤堕潰(纰版挒闈㈠氨鏄《闈?,涓ょ灏忕珫绾?*/
            const th = U * 0.34;
            g.fillStyle(tint, 0.18).fillRect(obx, oTop, obw, th);
            g.lineStyle(2, tint, 0.8).strokeRect(obx + 1, oTop + 1, obw - 2, th - 2);
          }
          break;
        case 'block': {
          /* 鏂瑰潡:瀹炲績 + 椤堕儴楂樺厜 + 鍙充笂缂鸿,鍜屽湴闈?骞冲彴閮戒笉鍚?*/
          g.fillStyle(tint, 0.20).fillRect(obx, oTop, obw, obh);
          g.lineStyle(2, tint, 0.85).strokeRect(obx + 1, oTop + 1, obw - 2, obh - 2);
          g.fillStyle(tint, 0.6).fillRect(obx + 3, oTop + 3, obw - 6, 2);
          g.fillStyle(tint, 0.55).fillTriangle(obx + obw, oTop, obx + obw - 9, oTop, obx + obw, oTop + 9);
          break;
        }
        case 'spike': {
          /* 灏栧埡:搴曡竟鍦ㄦ牸瀛愪笅娌裤€佸皷鏈濅笂;楂樺害鎸?o.h 缂╂斁(灏忓埡 0.5 / 澶у埡 1.5)銆?
             鈽?鏂瑰悜鍙湁涓€鏉¤鍒?鍏堢敾"鏈濅笂"鐨勫熀纭€褰㈢姸,鍐嶅銆愭棆杞€?灞忓箷涓婇『鏃堕拡)銆?
               鈥斺€?涔嬪墠鍐欐垚"rot180 鍏堥暅鍍忋€佸張杞?180掳",绛変簬缈讳簡涓ゆ,鍊掓寕鐨勫埡鐢绘垚浜嗘鐨?
               (鐢ㄦ埛涓€鐪煎氨鐪嬪嚭"鍒虹殑鏂瑰悜杩樻病淇?)銆俧lipY 鎵嶆槸鐪熸鐨勯暅鍍?鍗曠嫭涔樹竴娆°€?
               鍒ゅ畾閭ｄ晶鏄悓涓€鏉″彛寰?rot 180 / flipY 鈫?鍒ゅ畾鐩掓寕鍦ㄦ牸瀛愩€愰《闈€戙€?*/
          const rot = (((o.rot ?? 0) % 360) + 360) % 360;
          const side = rot === 90 || rot === 270;      // 妯潃鐨勫埡:鏁存牸鍙敾涓€涓?
          const mirror = o.flipY ? -1 : 1;             // flipY = 涓婁笅闀滃儚(涓嶈浆鐨勬椂鍊欑敤)
          const theta = (rot * Math.PI) / 180;
          const cs = Math.cos(theta), sn = Math.sin(theta);
          const n = side ? 1 : Math.max(1, Math.round(o.w));
          for (let k = 0; k < n; k++) {
            const ccx = side ? obx + obw / 2 : obx + (k + 0.5) * U;
            const ccy = oBot - obh / 2;                // 鏍煎瓙涓績(缁樺浘绌洪棿)
            const hw = U * 0.47;                       // 鍩虹褰㈢姸:涓€鏍煎
            const hh = (U * 0.9 * o.h) / 2;            // 楂?= 0.9 脳 鍒洪珮
            const yb = hh * mirror, yt = -hh * mirror; // 搴曡竟 / 灏栫
            const P = (lx: number, ly: number): [number, number] =>
              [ccx + lx * cs - ly * sn, ccy + lx * sn + ly * cs];
            const p1 = P(-hw, yb), p2 = P(0, yt), p3 = P(hw, yb);
            g.fillStyle(0x2a1408, 0.95).fillTriangle(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
            g.lineStyle(2, WARN, 0.95);
            g.beginPath();
            g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.lineTo(p3[0], p3[1]);
            g.strokePath();
          }
          break;
        }
        case 'saw': {
          /* 閿墖:甯﹂娇鐨勩€愬渾銆戦敮杞?鎸夋椂闂磋浆銆?
             鈽呪槄 2026-09 淇?鐢ㄦ埛:"閿墖澶у皬,浣犵幇鍦ㄥ仛鎴愪簡妞渾,浣嗘槸鍘熺増涓嶆槸鍦嗙殑鍚?
                涔熷氨鏄浣犲彧鏀剧缉浜嗙旱鍚戝搴?):浠ュ墠鎸夈€愬寘鍥寸洅銆戠敾(1.47脳2.83 鏍?脳 缂╂斁),
                浜庢槸鐢诲嚭鏉ユ槸绔栨き鍦?鈥斺€?鑰屽垽瀹氭槸鍦?OpenGD `_pHitboxRadius`,sim 閲岃蛋 circles)銆?
                鐜板湪:鍗婂緞灏辩敤 sim 鐨勫渾鍗婂緞(o.rad,宸插惈缂╂斁),鐢荤殑鍜屽垽鐨勫畬鍏ㄤ竴鑷淬€?
                鎹㈢畻:杩欎竴鏍肩殑灞忓箷瀹藉害 / 鐗╀欢瀹藉害 = 姣忓崟浣嶅灏戝儚绱犮€?*/
          const ppu = obw / Math.max(1e-6, o.w * U);
          const r = Math.max(5, (o.rad ?? 30) * ppu);
          const scx = obx + obw / 2, scy = oBot - obh / 2;
          const spin = tick * 0.12;
          g.fillStyle(0x2a1408, 0.9).fillCircle(scx, scy, r);
          g.lineStyle(2, WARN, 0.95).strokeCircle(scx, scy, r);
          for (let k = 0; k < 12; k++) {
            const a = spin + k * Math.PI / 6;
            const ca = Math.cos(a), sa = Math.sin(a);
            g.fillStyle(WARN, 0.9).fillTriangle(
              scx + ca * r * 0.78, scy + sa * r * 0.78,
              scx + Math.cos(a + 0.20) * r * 1.12, scy + Math.sin(a + 0.20) * r * 1.12,
              scx + Math.cos(a - 0.20) * r * 1.12, scy + Math.sin(a - 0.20) * r * 1.12,
            );
          }
          g.fillStyle(0x05070d, 1).fillCircle(scx, scy, r * 0.42);
          break;
        }
        case 'pad': {
          /* 寮圭哀(璺虫澘):鈽?鐢绘垚銆愯杽钖勪竴鍧楄创鍦ㄥ簳杈广€戔€斺€?鍘熺増璺崇偣瑙嗚涓婂彧鏈夊皬鍗婃牸楂樸€?
             浠ュ墠鎴戠敾鐨勬槸"0.95 鏍奸珮鐨勫簳搴?+ 涓ら亾澶х澶?,鐪嬬潃鍍忎竴鍧楀ぇ鏉垮瓙,
             鑰屼笖绠ご杩樺線涓婃埑鍑虹墿浠剁洅 鈥斺€?鐢ㄦ埛鎶婂湴闈㈢嚎涓婇偅鍧?67 鏀惧湪 y=鈭?.1銆佽鍦伴潰鎸′綇鐨?
             褰撴垚浜?澶氬嚭鏉ョ殑钃濊壊璺崇偣"銆?*/
          const col = PAD_COL[o.pad ?? 'yellow'] ?? 0xffe17a;
          const th = Math.max(6, obh);                       // 璐村浘鍘氬害 = 鐗╀欢鐩?0.2 鏍?= 6 鍗曚綅)
          g.fillStyle(col, 0.85).fillRect(obx + 1, oBot - th, obw - 2, th);
          g.lineStyle(1, col, 0.9).strokeRect(obx + 1.5, oBot - th + 0.5, obw - 3, th - 1);
          /* 涓€閬撴湞涓婄殑绠ご(鍊掓寕鐨勬湞涓?,鍘嬪湪搴曞骇涓?涓嶅嚭鐗╀欢鐩?*/
          const up = ((o.rot ?? 0) % 360 + 360) % 360 !== 180;
          g.lineStyle(2, col, 0.95);
          g.beginPath();
          const cy0 = oBot - th / 2;
          if (up) { g.moveTo(obx + 5, cy0 + 2); g.lineTo(obx + obw / 2, cy0 - 3); g.lineTo(obx + obw - 5, cy0 + 2); }
          else { g.moveTo(obx + 5, cy0 - 2); g.lineTo(obx + obw / 2, cy0 + 3); g.lineTo(obx + obw - 5, cy0 - 2); }
          g.strokePath();
          break;
        }
        case 'orb': {
          /* 璺崇幆:澶栧湀 + 鍐呭湀 + 涓棿涓€涓鍙?榛?涓婄澶?/ 钃?缈婚噸鍔?/ 绮?灏忕澶? */
          const col = ORB_COL[o.orb ?? 'yellow'] ?? 0xffe17a;
          const ccx = obx + U / 2, ccy = Y(o.r * U + U / 2);
          const pulse = 0.5 + 0.5 * Math.sin(tick * 0.08);
          g.fillStyle(col, 0.10 + 0.06 * pulse).fillCircle(ccx, ccy, U * 0.62);
          g.lineStyle(3, col, 0.95).strokeCircle(ccx, ccy, U * 0.44);
          g.lineStyle(1, col, 0.35 + 0.3 * pulse).strokeCircle(ccx, ccy, U * 0.66);
          g.lineStyle(3, col, 0.95);
          if (o.orb === 'blue' || o.orb === 'green') {          // 缈婚噸鍔?涓婁笅鍙岀澶?
            g.beginPath();
            g.moveTo(ccx - 6, ccy - 4); g.lineTo(ccx, ccy - 9); g.lineTo(ccx + 6, ccy - 4);
            g.moveTo(ccx - 6, ccy + 4); g.lineTo(ccx, ccy + 9); g.lineTo(ccx + 6, ccy + 4);
            g.strokePath();
          } else if (o.orb === 'black') {                       // 鍐插埡:鍚戜笅鐨勫弻绠ご(瀹冩妸浜哄線涓?鐮?)
            g.beginPath();
            g.moveTo(ccx - 7, ccy - 6); g.lineTo(ccx, ccy + 1); g.lineTo(ccx + 7, ccy - 6);
            g.moveTo(ccx - 7, ccy + 1); g.lineTo(ccx, ccy + 8); g.lineTo(ccx + 7, ccy + 1);
            g.strokePath();
          } else {                                              // 璺?涓婄澶?
            const h = o.orb === 'pink' ? 6 : 10;
            g.beginPath();
            g.moveTo(ccx - 7, ccy + h / 2); g.lineTo(ccx, ccy - h); g.lineTo(ccx + 7, ccy + h / 2);
            g.strokePath();
          }
          break;
        }
        case 'pit': {
          /* 鍧?鍦版澘鏂彛 鈥斺€?娣辫壊缂哄彛 + 涓や晶閿娇鏂礀(浠ュ墠杩欓噷鐢讳簡涓崐鍦嗚绀虹伅,瀹屽叏鐪嬩笉鍑烘槸鍧? */
          const depth = U * 2.4;
          g.fillStyle(0x000000, 0.75).fillRect(obx, oBot - depth + U, obw, depth);
          g.fillStyle(0x05070d, 0.9).fillRect(obx, oBot - depth + U, obw, 6);
          g.lineStyle(2, WARN, 0.8);
          g.beginPath();
          g.moveTo(obx, oBot); g.lineTo(obx, oBot + U * 0.9); g.lineTo(obx + 7, oBot + U * 1.5); g.lineTo(obx, oBot + U * 2.1);
          g.moveTo(obx + obw, oBot); g.lineTo(obx + obw, oBot + U * 0.9); g.lineTo(obx + obw - 7, oBot + U * 1.5); g.lineTo(obx + obw, oBot + U * 2.1);
          g.strokePath();
          break;
        }
        case 'portal': {
          /* 褰㈡€侀棬:鈽?姣忎釜褰㈡€佷竴濂楅鑹?+ 闂ㄤ笂涓€鍧楀啓鐫€褰㈡€佸悕鐨勫皬鐗屽瓙 鈥斺€?
             浠ュ墠鎵€鏈夐棬閮界敾鎴愬悓涓€涓粍鍦?鍙湁椋炴満鐢讳釜涓夎),鐢ㄦ埛鏍规湰鐪嬩笉鍑哄垏浠€涔堝舰鎬併€?
             闂ㄧ敾鎴愬師鐗堥偅绉?绔栫潃鐨勬き鍦嗛棬"(灏哄灏卞彇鍒ゅ畾鐩?34脳86 鍗曚綅),鑹?鐗屽瓙閮芥寜鐩爣褰㈡€佸垎銆?*/
          const to = (o.to ?? 'cube') as Mode;
          const col = PORTAL_COL[to] ?? 0xffe17a;
          const pw = PORTAL_W, ph = PORTAL_H;
          const ccx = obx + obw / 2, ccy = oBot - obh / 2;
          g.fillStyle(col, 0.16).fillEllipse(ccx, ccy, pw, ph);
          g.lineStyle(3, col, 0.95).strokeEllipse(ccx, ccy, pw, ph);
          g.lineStyle(1, col, 0.45).strokeEllipse(ccx, ccy, pw * 0.72, ph * 0.8);
          /* 闂ㄩ噷鐢讳釜鐩爣褰㈡€佺殑绠€绗?鏂瑰潡=鏂?椋炴満/娉㈡氮=涓夎,鐞?鍦?UFO=鎵佸渾,鏈哄櫒浜?鏂?鑵?铚樿洓=鏂?椤?*/
          g.fillStyle(col, 0.95);
          const gs = 9;
          if (to === 'cube' || to === 'robot' || to === 'spider') {
            g.fillRect(ccx - gs, ccy - gs, gs * 2, gs * 2);
            if (to === 'robot') { g.fillRect(ccx - gs, ccy + gs, 4, 5); g.fillRect(ccx + gs - 4, ccy + gs, 4, 5); }
            if (to === 'spider') { g.fillRect(ccx - gs - 5, ccy - gs, 5, 3); g.fillRect(ccx + gs, ccy - gs, 5, 3); }
          } else if (to === 'ball') {
            g.fillCircle(ccx, ccy, gs);
          } else if (to === 'ufo') {
            g.fillEllipse(ccx, ccy, gs * 2.6, gs * 1.1);
          } else {
            g.fillTriangle(ccx + gs, ccy, ccx - gs, ccy - gs, ccx - gs, ccy + gs);
          }
          break;
        }
        case 'check':
          g.lineStyle(2, 0xffcc66, 0.9).lineBetween(obx + U * 0.2, oBot, obx + U * 0.2, oTop - U * 0.1);
          g.fillStyle(0xffcc66, 0.9).fillTriangle(obx + U * 0.2, oTop - U * 0.1, obx + U * 1.05, oTop + U * 0.15, obx + U * 0.2, oTop + U * 0.4);
          break;
        case 'speed': {
          const ccy = Y(o.r * U + U / 2);
          g.lineStyle(3, 0x9fd8ff, 0.9);
          g.beginPath();
          g.moveTo(obx + 6, ccy - 8); g.lineTo(obx + 15, ccy); g.lineTo(obx + 6, ccy + 8);
          g.moveTo(obx + 16, ccy - 8); g.lineTo(obx + 25, ccy); g.lineTo(obx + 16, ccy + 8);
          g.strokePath();
          break;
        }
        case 'gravity': {
          /* 閲嶅姏闂?鈽?浠ュ墠涓や釜鏂瑰悜閮界敾鎴?娣＄传鑹插皬涓夎 + 涓€鍦堟贰娣＄殑鍏?,鐢ㄦ埛鏍规湰鐪嬩笉鍑烘槸閲嶅姏闂ㄣ€?
             鏇寸湅涓嶅嚭寰€鍝竟缈汇€傜幇鍦ㄦ寜鍘熺増閰嶈壊鍋氭垚銆愮珫妞渾闂?+ 澶х澶?+ 闂ㄥご鐗屽瓙銆?
               鍙嶉噸鍔?鍚戜笂,id 11)= 钃?甯搁噸鍔?鍚戜笅,id 10)= 榛勩€?
             闂ㄦ灏哄鐢ㄥ垽瀹氱洅涓€鑷寸殑鍙ｅ緞(34脳86 鍗曚綅),鎾炰笂鍘荤殑鑼冨洿鍜岀湅瑙佺殑涓€鑷淬€?*/
          const up = (o.gdir ?? 1) < 0;
          const col = up ? 0x6fc3ff : 0xffd166;
          const gcx = obx + obw / 2, gcy = oBot - obh / 2;
          g.fillStyle(col, 0.16).fillEllipse(gcx, gcy, PORTAL_W, PORTAL_H);
          g.lineStyle(3, col, 0.95).strokeEllipse(gcx, gcy, PORTAL_W, PORTAL_H);
          g.lineStyle(1, col, 0.45).strokeEllipse(gcx, gcy, PORTAL_W * 0.72, PORTAL_H * 0.8);
          /* 闂ㄩ噷涓€鏀ぇ绠ご:鏈濅笂 = 鍙嶉噸鍔?鏈濅笅 = 甯搁噸鍔?杩橀厤涓ゆ潯妯嚎绀烘剰"鍝竟鏄湴" */
          g.lineStyle(4, col, 0.95);
          g.beginPath();
          const ay = up ? -1 : 1;                       // 灞忓箷涓?up 鈫?寰€涓婄敾
          g.moveTo(gcx, gcy - ay * 14); g.lineTo(gcx, gcy + ay * 14);
          g.moveTo(gcx - 9, gcy + ay * 4); g.lineTo(gcx, gcy + ay * 15); g.lineTo(gcx + 9, gcy + ay * 4);
          g.strokePath();
          g.lineStyle(3, col, 0.8);
          g.lineBetween(gcx - 12, gcy + ay * 22, gcx + 12, gcy + ay * 22);
          break;
        }
        case 'size': {
          /* 灏哄闂?杩蜂綘 = 灏忔柟妗嗛噷涓€涓皬浜?鎭㈠ = 澶ф柟妗?*/
          const mini = o.mini !== false;
          const scx2 = obx + U / 2, scy2 = Y((o.r + o.h / 2) * U);
          g.lineStyle(2, mini ? 0xff9fd0 : 0xa0ffd0, 0.9).strokeCircle(scx2, scy2, U * 0.45);
          g.fillStyle(mini ? 0xff9fd0 : 0xa0ffd0, 0.9)
            .fillRect(scx2 - (mini ? 4 : 8), scy2 - (mini ? 4 : 8), mini ? 8 : 16, mini ? 8 : 16);
          break;
        }
        case 'frame': {
          /* 绾挎:杩欓噷鍙銆愮敾銆戔€斺€?鎸?frameRects 鐢诲嚭鐪嬪緱瑙佺殑閭?1~3 鏉¤竟銆?
             鈽?鍒ゅ畾銆愪笉鍐嶃€戠敤杩欎唤鍑犱綍:鍘熺増琛ㄩ噷 469/470/471 鐨勫妗嗘槸鏁存牸 30脳30銆?61 鏄?15脳15,
               L 褰?U 褰㈠彧鏄创鍥?瑙?sim/world.ts 鐨?case 'frame')銆?*/
          g.lineStyle(2, tint, 0.9);
          for (const r of frameRects({ ...o, b: o.b + off.dx, r: o.r + off.dy })) {
            g.strokeRect(r.x0, Y(r.y1), r.x1 - r.x0, r.y1 - r.y0);
          }
          break;
        }
        case 'breakable': {
          /* 鍙牬鍧忕爾鍧?姗欒壊鐨勮绾圭爾 鈥斺€?鎾炰笂鍘讳細纰?纰庝簡灏变笉鐢讳簡) */
          if (w.isBroken(o)) break;
          g.fillStyle(0xffb066, 0.16).fillRect(obx, oTop, obw, obh);
          g.lineStyle(2, 0xffb066, 0.9).strokeRect(obx + 1, oTop + 1, obw - 2, obh - 2);
          g.lineStyle(1, 0xffb066, 0.7);
          g.lineBetween(obx + 3, oTop + obh - 3, obx + obw - 3, oTop + 3);
          g.lineBetween(obx + obw * 0.3, oTop + 2, obx + obw * 0.55, oTop + obh * 0.55);
          break;
        }
        case 'coin': {
          /* 纭竵:閲戣壊鍦嗙墖(鏀惰繃浜嗗氨涓嶇敾) */
          if (w.isCoinTaken(o)) break;
          const ccx3 = obx + obw / 2, ccy3 = Y((o.r + o.h / 2) * U);
          const wob = Math.abs(Math.cos(tick * 0.05));
          g.fillStyle(0xffd76a, 0.9).fillRect(ccx3 - obw * 0.3 * wob, ccy3 - obh * 0.3, obw * 0.6 * wob, obh * 0.6);
          g.lineStyle(2, 0xffe9a8, 0.95).strokeRect(ccx3 - obw * 0.3 * wob, ccy3 - obh * 0.3, obw * 0.6 * wob, obh * 0.6);
          break;
        }
        case 'arrow': {
          /* 鍐插埡绠ご(缁?绮?/ 绱壊涓婅烦绠ご:涓€涓幆 + 涓€鏀寜鏃嬭浆瑙掓寚鐨勭澶?*/
          const acx = obx + obw / 2, acy = Y((o.r + o.h / 2) * U);
          const acol = o.tp ? 0xc6a0ff : (o.arrow === 'pink' ? 0xff9fd0 : 0xa0ffd0);
          g.fillStyle(acol, 0.12).fillCircle(acx, acy, U * 0.55);
          g.lineStyle(3, acol, 0.95).strokeCircle(acx, acy, U * 0.42);
          /* 鈽?灞忓箷涓婄殑瑙掑害 = 鏁版嵁閲岀殑 rot(0 = 鎸囧悜鍙?姝ｈ搴﹂『鏃堕拡 = 灞忓箷涓婂線涓?鈥斺€?
             鍜?sim 閲岀殑 arrowDir 鏄悓涓€濂楀彛寰?鐢荤殑鍜屽啿鐨勬柟鍚戞墠浼氫竴鑷淬€?*/
          const a = ((o.rot ?? 0) * Math.PI) / 180;
          const dx = Math.cos(a), dy = Math.sin(a);
          const L = U * 0.5;
          const tx = acx + dx * L * 0.62, ty = acy + dy * L * 0.62;     // 绠皷
          g.lineStyle(3, acol, 0.95);
          g.beginPath();
          g.moveTo(acx - dx * L * 0.5, acy - dy * L * 0.5);
          g.lineTo(tx, ty);
          g.moveTo(tx, ty);
          g.lineTo(tx - dx * L * 0.45 + dy * L * 0.42, ty - dy * L * 0.45 - dx * L * 0.42);
          g.moveTo(tx, ty);
          g.lineTo(tx - dx * L * 0.45 - dy * L * 0.42, ty - dy * L * 0.45 + dx * L * 0.42);
          g.strokePath();
          break;
        }
        case 'clone': {
          /* 鍏嬮殕闂?鍙爣璁般€佷笉鐢熸晥 鈥斺€?鐢绘垚鐏拌壊铏氱嚎鐜?涓€鐪肩煡閬?杩欓噷鎴戜滑娌″仛" */
          const kcx = obx + obw / 2, kcy = Y((o.r + o.h / 2) * U);
          g.lineStyle(2, 0x8b93a7, 0.75).strokeCircle(kcx, kcy, U * 0.5);
          g.lineStyle(2, 0x8b93a7, 0.45).strokeCircle(kcx, kcy, U * 0.34);
          break;
        }
        case 'teleport': {
          /* 浼犻€侀棬:钃?= 鍏ュ彛(747),姗?= 鍑哄彛(748) 鈥斺€?鍘熺増灏辨槸"钃濊繘姗欏嚭" */
          const tcx = obx + U / 2, tcy = Y(o.r * U + U / 2);
          const tcol = o.exit ? 0xffa04d : 0x6fc8ff;
          const spinT = tick * 0.06;
          g.lineStyle(3, tcol, 0.95).strokeCircle(tcx, tcy, U * 0.95);
          g.fillStyle(tcol, 0.12).fillCircle(tcx, tcy, U * 0.95);
          g.lineStyle(2, tcol, 0.8);
          for (let k = 0; k < 3; k++) {
            const a0 = spinT + k * (Math.PI * 2 / 3);
            g.beginPath();
            g.arc(tcx, tcy, U * 0.35 + k * 6, a0, a0 + 1.6, false);
            g.strokePath();
          }
          g.fillStyle(tcol, 0.95).fillCircle(tcx, tcy, 4);
          break;
        }
        case 'force': {
          /* 鍔涘満:鍗婇€忔槑甯?+ 涓€鎺掔澶?寰€涓婃帹灏辨槸鏈濅笂鐨勭澶? */
          const up = (o.fy ?? 0) >= 0;
          g.fillStyle(up ? 0xa0ffd0 : 0xff9fd0, 0.10).fillRect(obx, oTop, obw, oBot - oTop);
          g.lineStyle(1, up ? 0xa0ffd0 : 0xff9fd0, 0.45).strokeRect(obx + 1, oTop + 1, obw - 2, oBot - oTop - 2);
          g.lineStyle(2, up ? 0xa0ffd0 : 0xff9fd0, 0.7);
          const step = 26, drift = (tick * 1.6) % step;
          for (let yy = oBot - step + drift; yy > oTop; yy -= step) {
            g.beginPath();
            if (up) { g.moveTo(obx + obw / 2 - 7, yy + 7); g.lineTo(obx + obw / 2, yy - 3); g.lineTo(obx + obw / 2 + 7, yy + 7); }
            else { g.moveTo(obx + obw / 2 - 7, yy - 3); g.lineTo(obx + obw / 2, yy + 7); g.lineTo(obx + obw / 2 + 7, yy - 3); }
            g.strokePath();
          }
          break;
        }
        case 'deco':
          /* 瑁呴グ:鍙敾涓嶅垽瀹氥€?638 鏄儗鏅粦鍧?鐢ㄦ埛鎷垮畠鍋?鐢婚潰閫愭笎娓呮櫚"鐨勯伄缃?,
             鍏朵綑鍑犱釜鏄寚绀虹敤鐨勫皬鍥惧舰(鎰熷徆鍙?/ 绠ご / 绗戣劯 / 鍙?/ 鐐硅禐 / 閿侀摼)銆?*/
          this.drawDeco(g, o, obx, obw, oBot, Y, tick);
          break;
      }
    }
    }
    /* 鈽?璐村浘姹犳敹灏?杩欎竴甯ф病鐢ㄥ埌鐨勯偅浜涜棌璧锋潵(姹犲瓙鍙涓嶅噺,澶嶇敤鍚屼竴鎵?Image) */
    for (let i = this.artUsed; i < this.artPool.length; i++) this.artPool[i].setVisible(false);

    // 鐜╁:鏂瑰潡 = 鎻忚竟姝ｆ柟褰?绌轰腑鑷浆 90掳),椋炴満 = 涓夎(鎸?vy 鍊炬枩)
    const B = P.box * w.sizeMul;   // 鈽?杩蜂綘闂?浜轰篃瑕佺敾灏?
    const py = this.prevY + (w.y - this.prevY) * Math.min(1, this.acc * 60);   // 娓叉煋鎻掑€?
    const cxw = w.x + B / 2, cyw = py + B / 2;
    /* 鈽?鍥鹃泦灏辩华灏辩敤鐪熷浘鏍?瑙?buildIcons);娌″氨缁?鍔犺浇澶辫触鏃惰蛋涓嬮潰杩欏鐭㈤噺鍏滃簳銆?
       娉ㄦ剰鍥炬爣鐢ㄧ殑鏄粯鍥剧┖闂村潗鏍?鍜?Graphics 涓€鏍?y 璧?Y() 缈昏浆),鎵€浠ヨ繖閲岀粰瀹?Y(cyw) */
    if (this.iconsReady) this.drawIconPlayer(w, cxw, Y(cyw), B);
    if (this.iconsReady) { /* 鍥炬爣宸茬粡鐢讳簡,鐭㈤噺閭ｅ璺宠繃 */ } else if (w.mode === 'ship') {
      /* 鎵嬪姩鐢讳笁瑙?Phaser 4 閲屾病鏈?Phaser.Geom.Point(v3 鐨勫啓娉曚細鐩存帴鎶涢敊) */
      const rot = Math.max(-0.55, Math.min(0.55, w.vy / P.shipVyMax * 0.55));
      const s = Math.sin(rot), c = Math.cos(rot);
      const vx2 = (a: number, b: number) => cxw + a * c - b * s;
      const vy2 = (a: number, b: number) => Y(cyw + a * s + b * c);
      g.fillStyle(w.dead ? 0xff9a6b : 0xe2f6ff, 0.95);
      g.beginPath();
      g.moveTo(vx2(B * 0.6, 0), vy2(B * 0.6, 0));
      g.lineTo(vx2(-B * 0.45, -B * 0.3), vy2(-B * 0.45, -B * 0.3));
      g.lineTo(vx2(-B * 0.45, B * 0.3), vy2(-B * 0.45, B * 0.3));
      g.closePath();
      g.fillPath();
    } else if (w.mode === 'ball') {
      /* 鐞?涓€涓渾 + 閲岄潰涓€鏉￠殢婊氬姩杞殑绾?涓嶇劧鐪嬩笉鍑哄畠鍦ㄦ粴) */
      const r = B * 0.5;
      g.fillStyle(w.dead ? 0xff9a6b : 0xe2f6ff, 0.96).fillCircle(cxw, Y(cyw), r);
      g.lineStyle(2, HLD, 0.9).strokeCircle(cxw, Y(cyw), r);
      const ang = w.x / U * 1.2;
      g.lineStyle(2, HLD, 0.75).lineBetween(
        cxw - Math.cos(ang) * r * 0.65, Y(cyw) - Math.sin(ang) * r * 0.65,
        cxw + Math.cos(ang) * r * 0.65, Y(cyw) + Math.sin(ang) * r * 0.65,
      );
    } else if (w.mode === 'ufo') {
      /* UFO:涓€涓渾椤?+ 涓€鏉″簳鐩?*/
      const base = Y(cyw - B * 0.35);
      g.fillStyle(w.dead ? 0xff9a6b : 0xe2f6ff, 0.95);
      g.beginPath();
      g.moveTo(cxw - B * 0.5, base);
      g.lineTo(cxw, Y(cyw + B * 0.55));
      g.lineTo(cxw + B * 0.5, base);
      g.closePath();
      g.fillPath();
      g.fillStyle(HLD, 0.9).fillRect(cxw - B * 0.62, base, B * 1.24, 4);
    } else if (w.mode === 'wave') {
      /* 娉㈡氮:涓€鏋氬皬椋為晼,鏈濆綋鍓嶈繍鍔ㄦ柟鍚?*/
      const dirw = w.vy >= 0 ? 1 : -1;
      g.fillStyle(w.dead ? 0xff9a6b : 0xe2f6ff, 0.95);
      g.beginPath();
      g.moveTo(cxw + 11, Y(cyw + dirw * 11));
      g.lineTo(cxw - 9, Y(cyw - dirw * 9));
      g.lineTo(cxw - 3, Y(cyw + dirw * 3));
      g.closePath();
      g.fillPath();
      g.lineStyle(2, HLD, 0.85);
      g.strokePath();
    } else if (w.mode === 'robot') {
      /* 鏈哄櫒浜?姣旀柟鍧楅珮涓€鐐?+ 涓€鏉￠潰缃╃嚎 + 涓ゆ潯鑵?*/
      const hw = B * 0.42, hh = B * 0.72;
      const rtop = Y(cyw + hh), rbot = Y(cyw - hh);
      g.fillStyle(w.dead ? 0xff9a6b : 0xe2f6ff, 0.96).fillRect(cxw - hw, rtop, hw * 2, rbot - rtop);
      g.lineStyle(2, HLD, 0.9).strokeRect(cxw - hw, rtop, hw * 2, rbot - rtop);
      g.fillStyle(HLD, 0.9).fillRect(cxw - hw + 3, rtop + 4, hw * 2 - 6, 3);
      g.lineStyle(3, HLD, 0.9);
      g.lineBetween(cxw - hw * 0.6, rbot, cxw - hw * 0.6, rbot + 6);
      g.lineBetween(cxw + hw * 0.6, rbot, cxw + hw * 0.6, rbot + 6);
    } else if (w.mode === 'spider') {
      /* 铚樿洓:鏂瑰潡 + 鍥涙潯鐭吙 */
      const sw = B * 0.42;
      g.fillStyle(w.dead ? 0xff9a6b : 0xe2f6ff, 0.96).fillRect(cxw - sw, Y(cyw + sw), sw * 2, sw * 2);
      g.lineStyle(2, HLD, 0.9).strokeRect(cxw - sw, Y(cyw + sw), sw * 2, sw * 2);
      g.lineStyle(2, HLD, 0.85);
      for (const sx of [-1, 1]) {
        g.lineBetween(cxw + sx * sw, Y(cyw + sw * 0.5), cxw + sx * (sw + 7), Y(cyw + sw * 0.5) - 8);
        g.lineBetween(cxw + sx * sw, Y(cyw - sw * 0.5), cxw + sx * (sw + 7), Y(cyw - sw * 0.5) + 8);
      }
    } else {
      /* 鏂瑰潡鍦ㄧ┖涓浆 90掳(鍘熺増鎵嬫劅):鐢ㄦ粸绌烘椂闂村綋鏃嬭浆杩涘害 */
      /* 鈽呪槄 2026-09 鐢ㄦ埛鍙ｅ緞(鍘熺増):"鍘熺増澶ц烦鏃嬭浆 180掳,浼氭牴鎹綅缃喅瀹氫笅钀芥槸鍚︽棆杞?
       浣垮緱涓嶄細鍑虹幇钀藉埌骞冲彴涓婅繕瀛樺湪鏃嬭浆瑙掔殑鎯呭喌" 鈬?钀藉湴蹇呴』鏄€愯洞骞炽€戠殑(0掳 / 90掳 鐨勬暣鏁板€?鉁撱€?
       鎵€浠?涓€钀藉湴灏辨妸瑙掑害鍚稿埌 0(鏂瑰潡姘歌繙骞崇潃钀?鉁?鈥斺€?杩欐槸鎴戜滑浠ュ墠瀹屽叏娌℃湁鐨勪竴姝?鉁椼€?*/
    /* 鈽呪槄 2026-09 鏂瑰悜:鐢ㄦ埛瀹炴祴"鏃嬭浆鏂瑰悜涔熸槸閿欑殑" 鈬?鐜板湪杩欓噷鍙栥€愯礋鍙枫€戙€?
       鍘熷洜:鎴戜滑鐨勭粯鍥剧┖闂?y 鏄炕杞殑(瑙?Y()),姝ｈ搴﹀湪灞忓箷涓婄湅鏄€愰€嗘椂閽堛€戔湕,
       鑰屾柟鍧楀悜鍙宠窇鏃跺簲璇ャ€愰『鏃堕拡銆戣浆 鉁撱€?*/
    const spin = this.spinAng;
      const s = Math.sin(spin), c = Math.cos(spin);
      const pts: Array<[number, number]> = [[-B / 2, -B / 2], [B / 2, -B / 2], [B / 2, B / 2], [-B / 2, B / 2]];
      g.fillStyle(w.dead ? 0xff9a6b : 0xe2f6ff, 0.96);
      g.beginPath();
      pts.forEach(([a, b], i) => {
        const px2 = cxw + a * c - b * s, py2 = Y(cyw + a * s + b * c);
        if (i === 0) g.moveTo(px2, py2); else g.lineTo(px2, py2);
      });
      g.closePath();
      g.fillPath();
      g.lineStyle(2, w.dead ? 0xff9a6b : HLD, 0.9);
      g.strokePath();
    }
    // 鍒ゅ畾鍐呮(鑷繁鐪嬪緱瑙?鏂逛究璋冩墜鎰?
    g.lineStyle(1, 0xffffff, 0.28).strokeRect(w.x + w.innerOff, Y(py + w.innerOff + w.innerSize), w.innerSize, w.innerSize);

    // 缁堢偣
    const endX = LEVEL.length * U;
    if (endX > x0 && endX < x1) {
      g.lineStyle(3, HLD, 0.8).lineBetween(endX, groundY, endX, ceilY);
    }
    // 姝讳簡灏卞帇涓€灞傛殫绾?
    if (w.dead) g.fillStyle(0xff6b5a, 0.10).fillRect(x0, dy0, vw, dy1 - dy0);
    /* pulse 瑙﹀彂鍣?鍏ㄥ睆闂竴涓?*/
    if (w.flash > 0) g.fillStyle(w.tint ?? 0xffffff, 0.34 * w.flash).fillRect(x0, dy0, vw, dy1 - dy0);
    /* 寮€鍦?/ 姝讳骸 / 閫氬叧鐣岄潰:鍗婇€忔槑闈㈡澘(鏂囧瓧鏄?Text 瀵硅薄,杩欓噷鍙敾搴曟澘) */
    if (this.phase !== 'running') {
      const px = Math.max(vw / 2, this.camX), py = this.camWorldY;
      g.fillStyle(0x03050a, 0.82).fillRect(px - 470, py - 120, 940, 240);
      g.lineStyle(2, HLD, 0.55).strokeRect(px - 470, py - 120, 940, 240);
      g.lineStyle(1, HLD, 0.25).strokeRect(px - 462, py - 112, 924, 224);
    }
  }

  /** 瑁呴グ璐寸墖:鍙敾涓嶅垽瀹?3638 = 鑳屾櫙榛戝潡,鍏朵綑鏄嚑涓寚绀哄浘褰? */
  private drawDeco(
    g: Phaser.GameObjects.Graphics, o: Level['objects'][number],
    obx: number, obw: number, oBot: number,
    Y: (wy: number) => number, tick: number,
  ) {
    const cx = obx + obw / 2, cy = Y((o.r + o.h / 2) * U);
    const rot = (((o.rot ?? 0) % 360) + 360) % 360;
    switch (o.art) {
      case 3638:
        /* 榛戣壊鑳屾櫙鍧?鍥惧眰 8):鏋佹贰鐨勪竴灞?涓昏鏄?閬僵"鐢ㄩ€?澶粦浼氱洊鎺夋暣涓敾闈?*/
        g.fillStyle(0x000000, 0.10).fillRect(obx, Y((o.r + o.h) * U), obw, o.h * U);
        break;
      case 3810: {
        /* 鎰熷徆鍙?閫氬父鏄?娉ㄦ剰/璀﹀憡"鐨勬寚绀?*/
        const th = (tick * 0) + 0;
        g.fillStyle(0xffe17a, 0.85);
        g.fillRect(cx - obw * 0.08, cy - obw * 0.45 + th, obw * 0.16, obw * 0.6);
        g.fillCircle(cx, cy + obw * 0.32, obw * 0.1);
        break;
      }
      case 3812: {
        /* 绠ご:鏄剧ず鍏冲崱鎯宠浣犲線鍝蛋(鏃嬭浆瑙掑氨鏄繖涓柟鍚? */
        const a = -((rot * Math.PI) / 180) + Math.PI / 2;
        const L = obw * 0.5;
        g.lineStyle(3, 0xe2f6ff, 0.75);
        g.beginPath();
        g.moveTo(cx - Math.cos(a) * L, cy - Math.sin(a) * L);
        g.lineTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L);
        g.moveTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L);
        g.lineTo(cx + Math.cos(a + 2.5) * L * 0.8, cy + Math.sin(a + 2.5) * L * 0.8);
        g.moveTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L);
        g.lineTo(cx + Math.cos(a - 2.5) * L * 0.8, cy + Math.sin(a - 2.5) * L * 0.8);
        g.strokePath();
        break;
      }
      case 3823:
        /* 绗戣劯 */
        g.lineStyle(2, 0xffe17a, 0.8).strokeCircle(cx, cy, obw * 0.4);
        g.fillStyle(0xffe17a, 0.8).fillCircle(cx - obw * 0.15, cy - obw * 0.1, 2);
        g.fillStyle(0xffe17a, 0.8).fillCircle(cx + obw * 0.15, cy - obw * 0.1, 2);
        g.lineStyle(2, 0xffe17a, 0.8);
        g.beginPath();
        g.arc(cx, cy + obw * 0.05, obw * 0.2, 0.3, Math.PI - 0.3, false);
        g.strokePath();
        break;
      case 3818:
        /* 鍙?*/
        g.lineStyle(3, 0xff9a6b, 0.8);
        g.lineBetween(cx - obw * 0.3, cy - obw * 0.3, cx + obw * 0.3, cy + obw * 0.3);
        g.lineBetween(cx + obw * 0.3, cy - obw * 0.3, cx - obw * 0.3, cy + obw * 0.3);
        break;
      case 3848:
        /* 鐐硅禐:涓€涓畝鍖栫殑鎵嬪娍(鎷囨寚鏈濅笂) */
        g.fillStyle(0xa0ffd0, 0.7).fillRect(cx - obw * 0.25, cy - obw * 0.1, obw * 0.5, obw * 0.45);
        g.fillRect(cx - obw * 0.1, cy - obw * 0.45, obw * 0.2, obw * 0.35);
        break;
      case 41: case 106:
        /* 閿侀摼:鍑犱釜灏忕幆 */
        g.lineStyle(2, 0x8b93a7, 0.7);
        for (let k = -1; k <= 1; k++) g.strokeCircle(cx, cy + k * obw * 0.4, obw * 0.22);
        break;
      default:
        break;      // 31 / 1007 杩欑被"鍗犱綅绌虹櫧"浠€涔堥兘涓嶇敾
    }
  }
}

export function boot(target: string | HTMLCanvasElement, opts: { song?: string } = {}) {
  const useCanvas = typeof target !== 'string';
  if (opts.song) LEVEL.song = opts.song;   // 娓哥帺妯″紡鎻掔洏鏃剁敱椤甸潰鎸囧畾杩欎竴灞€鐢ㄥ摢棣栨瓕
  return new Phaser.Game({
    /* 浼犺嚜宸辩殑 canvas 鏃?Phaser 4 瑕佹眰鏄惧紡 renderType(鍚﹀垯鎶?Must set explicit renderType in custom environment) */
    type: useCanvas ? Phaser.WEBGL : Phaser.AUTO,
    ...(useCanvas ? { canvas: target as HTMLCanvasElement } : { parent: target as string }),
    backgroundColor: '#05070d',
    /* 鈽?鐢?NONE + 鍥哄畾灏哄:涔嬪墠鐢?FIT/RESIZE,Phaser 閲忓嚭鏉ョ殑鐖跺鍣ㄥ搴︿笉瀵?
       (鐩告満瑙嗗彛琚畻鎴?320脳720,鐢婚潰鍙湪宸﹁竟涓€鏉￠噷),骞茶剢涓嶈瀹冨幓閲?鈥斺€?
       鐢诲箙鐢遍〉闈?CSS 鍐冲畾,鍐呴儴鍒嗚鲸鐜囧浐瀹?1280脳720銆?*/
    scale: {
      mode: Phaser.Scale.NONE,
      width: 1280,
      height: 720,
    },
    scene: [Scene],
    /* 鈽?鎴浘瑕侀潬瀹?WebGL 榛樿涓嶄繚鐣欑粯鍒剁紦鍐?鑷姩鍖栨埅鍥句細鎶撳埌"鍗婂紶甯? */
    render: { preserveDrawingBuffer: true },
    audio: { noAudio: true },     // 闊充箰鐢遍〉闈㈠眰鐨勯煶棰戞ā鍧楄礋璐?鍜岀珯鐐瑰叡鐢?
  });
}


