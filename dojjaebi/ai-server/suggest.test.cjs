const assert = require('assert'); const { cleanSuggest } = require('./api/ai.js');
const C = [{ id: 'a', indoor: true, stairs: false }, { id: 'b', indoor: false, stairs: true }, { id: 'c', indoor: false, stairs: false }];
// time
assert.deepStrictEqual(cleanSuggest({ arrive: '11:00', back: '17:30', reason: '아이와 함께라 여유 있게' }, { kind: 'time', needArrive: true, needBack: true }), { arrive: '11:00', back: '17:30', reason: '아이와 함께라 여유 있게' });
assert.strictEqual(cleanSuggest({ arrive: '11:00', reason: '이유' }, { kind: 'time', needArrive: false, needBack: true }), null); // 이미 정한 칸은 안 건드림
assert.strictEqual(cleanSuggest({ arrive: '03:00', reason: '이유' }, { kind: 'time', needArrive: true }), null); // 너무 이른 시각
assert.strictEqual(cleanSuggest({ arrive: '12:00', back: '11:00', reason: '이유' }, { kind: 'time', needArrive: true, needBack: true }).back, undefined);
assert.strictEqual(cleanSuggest({ arrive: '11:00', reason: '가장 유명한 시간' }, { kind: 'time', needArrive: true }), null); // 금지어
// must
assert.deepStrictEqual(cleanSuggest({ ids: ['a', 'b', 'zzz', 'a', 'c'], whys: ['x', 'y', 'z', 'w', 'v'] }, { kind: 'must', cands: C, with: '부모님' }), { ids: ['a', 'c'], whys: ['x', 'v'] }); // 계단 곳·없는 id·중복 제외
assert.deepStrictEqual(cleanSuggest({ ids: ['a', 'c'], whys: ['x', 'y'] }, { kind: 'must', cands: C, rain: true }), { ids: ['a'], whys: ['x'] }); // 비: 실내만
assert.strictEqual(cleanSuggest({ ids: ['q'], whys: [] }, { kind: 'must', cands: C }), null);
assert.strictEqual(cleanSuggest({ ids: ['a', 'b', 'c', 'a'], whys: [] }, { kind: 'must', cands: C }).ids.length, 3);
// ask
assert.deepStrictEqual(cleanSuggest({ field: 'back', q: '돌아가는 시각은 정하셨나요?' }, { kind: 'ask', missing: ['back', 'comp'] }), { field: 'back', q: '돌아가는 시각은 정하셨나요?' });
assert.strictEqual(cleanSuggest({ field: 'food', q: '질문' }, { kind: 'ask', missing: ['back'] }), null);
console.log('suggest tests ok');
