/* 주차장 자료 검사 — 실행: node 주차장.test.cjs */
const assert = require('assert'); const P = require('./parking.data.js'), B = require('./blocks.data.js');
let ok = 0; function t(n, f) { try { f(); ok++; console.log('통과', n); } catch (e) { console.log('실패', n, '-', e.message); process.exitCode = 1; } }
t('24곳·기준일 2026-10-12', () => { assert.strictEqual(P.lots.length, 24); assert.strictEqual(P.기준일, '2026-10-12'); });
t('이름·면수·좌표가 있다', () => P.lots.forEach(l => { assert(l.name && l.n > 0); assert(l.lat > 37.3 && l.lat < 37.7 && l.lng > 128.9 && l.lng < 129.3, l.name); }));
t('면수 합 1573', () => assert.strictEqual(P.lots.reduce((s, l) => s + l.n, 0), 1573));
t('요금 구분은 유료/무료/혼합', () => P.lots.forEach(l => assert(['유료', '무료', '혼합'].includes(l.fee), l.name)));
t('블록 중 500m 안에 주차장이 있는 곳은 14/43', () => {
  const h = (a, b, c, d) => { const r = Math.PI / 180, dp = (c - a) * r, dl = (d - b) * r, x = Math.sin(dp / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dl / 2) ** 2; return 12742000 * Math.asin(Math.sqrt(x)); };
  assert.strictEqual(B.blocks.filter(b => P.lots.some(l => h(b.lat, b.lng, l.lat, l.lng) <= 500)).length, 14);
});
console.log(ok + '개 통과');
