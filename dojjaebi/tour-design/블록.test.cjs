/* 식당가 블록 자료 검사 — 실행: node 블록.test.cjs */
const assert = require('assert');
const T = require('./town.data.js'), B = require('./blocks.data.js');
let ok = 0; function t(n, f) { try { f(); ok++; console.log('통과', n); } catch (e) { console.log('실패', n, '-', e.message); process.exitCode = 1; } }
const all = [].concat(...B.blocks.map(b => b.eats), B.scattered, B.nopos);
t('식당 전부가 한 번씩만 들어 있다(빠짐·중복 없음)', () => { assert.strictEqual(all.length, T.eats.length); assert.strictEqual(new Set(all).size, T.eats.length); });
t('블록 이름이 서로 다르다', () => assert.strictEqual(new Set(B.blocks.map(b => b.name)).size, B.blocks.length));
t('블록은 5곳 이상', () => B.blocks.forEach(b => assert(b.n >= 5 && b.n === b.eats.length)));
t('위치 모름은 좌표가 정말 없는 곳', () => B.nopos.forEach(i => assert(!(T.eats[i][4] && T.eats[i][5]))));
t('블록·흩어진 곳은 좌표가 있고 동해시 안', () => [].concat(...B.blocks.map(b => b.eats), B.scattered).forEach(i => { const r = T.eats[i]; assert(r[4] > 37.3 && r[4] < 37.7 && r[5] > 128.9 && r[5] < 129.3); }));
t('블록 중심은 동해시 안', () => B.blocks.forEach(b => assert(b.lat > 37.3 && b.lat < 37.7 && b.lng > 128.9 && b.lng < 129.3)));
t('이름에 식당 이름이 들어가지 않는다', () => { const names = new Set(T.eats.map(r => r[0]).filter(n => n.length >= 3)); B.blocks.forEach(b => names.forEach(n => assert(!b.name.includes(n), b.name + ' ⊃ ' + n))); });
t('블록 안 모든 가게가 반경 250m+α 안(중심 기준 최대 반경 400m)', () => {
  const h = (a, b, c, d) => { const r = Math.PI / 180, dp = (c - a) * r, dl = (d - b) * r, x = Math.sin(dp / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dl / 2) ** 2; return 12742000 * Math.asin(Math.sqrt(x)); };
  B.blocks.forEach(b => b.eats.forEach(i => assert(h(b.lat, b.lng, T.eats[i][4], T.eats[i][5]) < 400, b.name)));
});
console.log(ok + '개 통과');
