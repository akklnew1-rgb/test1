/* 도깨비 미션 — 계산 부분 시험 (node mission.test.cjs) */
var assert = require('assert'), M = require('./mission.js'), D = require('./places.js');
// 1) 미션이 가리키는 장소가 places.js 에 있고 좌표가 같다
M.PLACES.forEach(function (p) {
  var q = D.places.filter(function (x) { return x.id === p.id; })[0];
  assert(q, p.id + ' 가 places.js 에 없음');
  assert(M.dist(p, { lat: q.lat, lng: q.lng }) < 5, p.id + ' 좌표가 places.js 와 다름');
});
// 2) 미션은 6개, 장소마다 2개, id 는 서로 다름
assert.strictEqual(M.MISSIONS.length, 6);
var ids = {}; M.MISSIONS.forEach(function (m) { assert(!ids[m.id]); ids[m.id] = 1; assert(M.PLACES.some(function (p) { return p.id === m.place; })); });
M.PLACES.forEach(function (p) { assert.strictEqual(M.MISSIONS.filter(function (m) { return m.place === p.id; }).length, 2); });
// 3) 현장 판정: 근처면 gps, 멀거나 위치가 없으면 self
var m = M.findMission('lighthouse-1'), p = M.PLACES[2];
assert.strictEqual(M.judge(m, { lat: p.lat + 0.002, lng: p.lng }), 'gps');   // 약 220m
assert.strictEqual(M.judge(m, { lat: p.lat + 0.02, lng: p.lng }), 'self');   // 약 2.2km
assert.strictEqual(M.judge(m, null), 'self');
assert.strictEqual(M.judge(m, { lat: 'x', lng: 1 }), 'self');
// 4) 저장·불러오기 (망가진 값이 있어도 죽지 않음)
var mem = {}, store = { getItem: function (k) { return mem[k] == null ? null : mem[k]; }, setItem: function (k, v) { mem[k] = v; } };
assert.deepStrictEqual(M.loadStamps(store), {});
M.saveStamps({ 'nolgol-1': { ts: 1, via: 'gps', note: '벽화' } }, store);
assert.strictEqual(M.loadStamps(store)['nolgol-1'].via, 'gps');
mem['dojjaebi.mission.v1'] = '{망가짐'; assert.deepStrictEqual(M.loadStamps(store), {});
assert.deepStrictEqual(M.loadStamps({ getItem: function () { throw new Error('막힘'); } }), {});
// 5) 기본 엽서 — 도장 수·현장 확인 수를 그대로 말하고 지어내지 않음
var st = { 'nolgol-1': { via: 'gps' }, 'lighthouse-1': { via: 'self' } }, fb = M.fallbackPostcard(M.stampList(st), st);
assert(/논골담길·묵호등대/.test(fb.body) && /2개/.test(fb.body) && /1개/.test(fb.body), fb.body);
var all = {}; M.MISSIONS.forEach(function (x) { all[x.id] = { via: 'self' }; });
assert(/졸업장/.test(M.fallbackPostcard(M.stampList(all), all).title));
// 6) 글 줄바꿈
var lines = M.wrapText(function (t) { return t.length * 10; }, '가나다라마바사아자차', 50);
assert.deepStrictEqual(lines, ['가나다라마', '바사아자차']);
assert.deepStrictEqual(M.wrapText(function (t) { return t.length; }, 'ab\ncd', 9), ['ab', 'cd']);
console.log('mission.test.cjs 통과');
