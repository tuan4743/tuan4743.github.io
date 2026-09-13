/* 把"机器人开局重置"挪到取 w0 之前 —— 之前写反了顺序,第一步仍在旧世界(半空中) */
const fs = require('fs');
const path = require('path');
const F = path.resolve(__dirname, '..', 'src', 'main.ts');
let s = fs.readFileSync(F, 'utf8');
const bad = `      const w0 = this.world;
      if (this.botMode && !this.botStarted) {`;
const good = `      if (this.botMode && !this.botStarted) {`;
if (s.split(bad).length - 1 !== 1) { console.log('✗ 锚点 1 没找到'); process.exit(1); }
s = s.replace(bad, good);
const anchor = `        this.prevY = 0;
      }`;
if (s.split(anchor).length - 1 !== 1) { console.log('✗ 锚点 2 没找到'); process.exit(1); }
s = s.replace(anchor, anchor + `
      const w0 = this.world;`);
fs.writeFileSync(F, s);
console.log('✓ 顺序已修正');
