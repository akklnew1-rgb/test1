/* 미션·엽서 중계 시험 (node mission.test.cjs) — 제미나이 호출은 가짜로 바꿔서 확인 */
var assert = require('assert');
process.env.GEMINI_API_KEY = 'testkey';
var reply = null;
global.fetch = async function () { return { ok: true, json: async function () { return { candidates: [{ content: { parts: [{ text: reply }] } }] }; } }; };
var h = require('./api/ai.js');
function call(body) {
  return new Promise(function (ok) {
    var res = { headers: {}, setHeader: function (k, v) { this.headers[k] = v; }, status: function (c) { this.code = c; return this; }, json: function (j) { ok({ code: this.code, j: j }); }, end: function () { ok({ code: this.code }); } };
    h({ method: 'POST', headers: { origin: 'http://localhost:8765', 'x-forwarded-for': 't' + Math.random() }, body: body }, res);
  });
}
(async function () {
  reply = JSON.stringify({ line: '도깨비가 기다려요. 전화 010-1234-5678', hint: '천천히 올라가요 https://a.com' });
  var r = await call({ task: 'mission', place: { id: 'nolgol', name: '논골담길' }, mission: '벽화 이야기 지어 주기' });
  assert.strictEqual(r.j.ok, true); assert(!/010|https/.test(r.j.line + r.j.hint), '연락처·링크 제거');
  reply = JSON.stringify({ line: '여기가 제일 유명한 곳이에요', hint: '요령' });
  r = await call({ task: 'mission', place: { name: '묵호등대' }, mission: '수평선 보기' });
  assert.strictEqual(r.j.ok, false, '홍보·평가 말은 버림');
  r = await call({ task: 'mission', place: {}, mission: '' }); assert.strictEqual(r.code, 400);
  reply = 'not json'; r = await call({ task: 'mission', place: { name: 'a' }, mission: 'b' }); assert.strictEqual(r.j.ok, false);
  reply = JSON.stringify({ title: '도깨비와 걸은 날', body: '논골담길에서 벽화 이야기를 남겼어요. 다음에 또 와요.' });
  r = await call({ task: 'postcard', stamps: [{ place: '논골담길', mission: '벽화', note: '재미있었다' }] });
  assert.strictEqual(r.j.ok, true); assert.strictEqual(r.j.title, '도깨비와 걸은 날');
  r = await call({ task: 'postcard', stamps: [] }); assert.strictEqual(r.code, 400);
  console.log('중계 미션 시험 통과');
})().catch(function (e) { console.error(e); process.exit(1); });
