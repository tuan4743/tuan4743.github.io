/* 修飞机用例的"松手会下落"断言:松手后先减速(还会上滑一小段),速度转负才真的下落 */
const fs = require('fs');
const path = require('path');
const F = path.resolve(__dirname, '..', 'test', 'sim.test.ts');
let s = fs.readFileSync(F, 'utf8');
const start = s.indexOf('  const start = up.y, vy0 = up.vy;');
const end = s.indexOf('});', start);
if (start < 0 || end < 0) { console.log('✗ 锚点没找到'); process.exit(1); }
const block = [
  '  const start = up.y, vy0 = up.vy;',
  '  for (let i = 0; i < 10; i++) up.frame(false);        // 先减速:这一段还会往上滑',
  '  const yTop = up.y, vyMid = up.vy;',
  '  for (let i = 0; i < 24; i++) up.frame(false);        // 速度转负之后才是真的下落',
  '  assert.ok(vyMid < vy0, "松手后上升速度应该变小(" + vy0.toFixed(1) + " → " + vyMid.toFixed(1) + ")");',
  '  assert.ok(up.vy < 0 && up.y < yTop, "松手后应该转为下落(y " + (yTop / U).toFixed(2) + " → " + (up.y / U).toFixed(2) + " 块, vy " + up.vy.toFixed(1) + ")");',
  '  assert.ok(up.y < start + 1.2 * U, "松手后不该继续爬升(起点 " + (start / U).toFixed(2) + " 块)");',
  '',
].join('\n');
s = s.slice(0, start) + block + s.slice(end);
fs.writeFileSync(F, s);
console.log('✓ 已修飞机用例的下落断言');
