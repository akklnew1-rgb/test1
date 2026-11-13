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
mem['dojjaebi.mission.v2'] = '{망가짐'; assert.deepStrictEqual(M.loadStamps(store), {});
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
// 7) 답 검사
var F = require('./chatfilter.js');
var pk = M.findMission('mukhoport-1'), tx = M.findMission('nolgol-1'), bg = M.findMission('nolgol-2');
assert.strictEqual(M.validateAnswer(pk, '갈매기').ok, true);
assert.strictEqual(M.validateAnswer(pk, '고래').ok, false, '보기에 없는 답');
assert.strictEqual(M.validateAnswer(tx, '   ').ok, false);
assert.strictEqual(M.validateAnswer(tx, '가'.repeat(31)).ok, false);
assert.strictEqual(M.validateAnswer(tx, '어머 도깨비다', F).ok, true);
assert.strictEqual(M.validateAnswer(tx, '전화 010-1234-5678', F).ok, false, '전화번호 막음');
assert.strictEqual(M.validateAnswer(bg, ['벽화']).ok, false, '2개 미만');
assert.strictEqual(M.validateAnswer(bg, ['벽화', '계단', '벽화', '없는것']).n, 2, '중복·없는 항목 제외');
// 8) 먼저 다녀간 여행자 — 내 답 제외, 실제로 있는 것만
var recs = [{ u: 'me', t: '갈매기', ts: 1 }, { u: 'a', t: '갈매기', ts: 2 }, { u: 'b', t: '배', ts: 3 }, { u: 'c', t: '갈매기', ts: 4 }, { u: 'd', t: '고래', ts: 5 }, null, { u: 'e', t: 3 }];
var tl = M.tally(pk, recs, 'me');
assert.strictEqual(tl.total, 4); assert.deepStrictEqual(tl.rows, [{ label: '갈매기', n: 2 }, { label: '배', n: 1 }]);
assert.deepStrictEqual(M.tally(pk, [], 'me'), { total: 0, rows: [] }, '데이터 없으면 0 (지어내지 않음)');
var tr2 = [{ u: 'a', t: '좋아요', ts: 1 }, { u: 'b', t: '문의 010-1234-5678', ts: 9 }, { u: 'c', t: '최고예요', ts: 5 }, { u: 'me', t: '내글', ts: 8 }];
assert.deepStrictEqual(M.recentTexts(tr2, 'me', F, 3), ['최고예요', '좋아요'], '최신순·검사 통과·내 글 제외');
// 9) 기본 반응
assert(/갈매기/.test(M.fallbackReact(pk, '갈매기'))); assert(/벽화/.test(M.fallbackReact(bg, '벽화, 계단')));
// 10) 미션 모양: 고르기 2·글 3·찾기 1, 글자수 한도 있음
var kinds = {}; M.MISSIONS.forEach(function (m) { kinds[m.kind] = (kinds[m.kind] || 0) + 1; if (m.kind === 'text') assert(m.max > 0 && m.max <= 30); if (m.kind === 'pick') assert(m.options.length >= 2); });
assert.deepStrictEqual(kinds, { pick: 2, text: 3, bingo: 1 });
console.log('mission.test.cjs 통과');
