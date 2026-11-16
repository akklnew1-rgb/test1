const assert = require('assert'), S = require('./sun.js'), AI = require('./ai.js'), D = require('./places.js');
const near = (got, want, tol, msg) => assert.ok(Math.abs(got - want) <= tol, msg + ': ' + S.hm(got) + ' ≠ ' + S.hm(want));
const m = s => +s.slice(0, 2) * 60 + +s.slice(3);
// 계산 식 점검 — 서울(37.5665, 126.978)의 알려진 값(동지·하지). 틀리면 식이 잘못된 것
near(S.rise('2026-12-22', 37.5665, 126.978), m('07:43'), 2, '서울 동지 일출'); near(S.set('2026-12-22', 37.5665, 126.978), m('17:17'), 2, '서울 동지 일몰');
near(S.rise('2026-06-21', 37.5665, 126.978), m('05:11'), 2, '서울 하지 일출'); near(S.set('2026-06-21', 37.5665, 126.978), m('19:57'), 2, '서울 하지 일몰');
// 동해는 서울보다 동쪽이라 해가 더 일찍 뜬다(약 8분)
const dh = S.rise('2026-11-16'), se = S.rise('2026-11-16', 37.5665, 126.978); assert.ok(se - dh >= 6 && se - dh <= 10, '동해가 서울보다 6~10분 이르다: ' + (se - dh));
// 날짜가 바뀌면 값이 바뀐다(자동 반영)
assert.ok(S.rise('2026-11-21') > S.rise('2026-11-16') && S.set('2026-11-21') < S.set('2026-11-16'), '11월은 일출이 늦어지고 일몰이 빨라진다');
assert.strictEqual(S.rise('아무말'), null); assert.strictEqual(S.fill('{일출}', '아무말'), '계산 불가');
// 추암 촛대바위 질문 답에 날짜별 값이 들어간다
const chuam = D.places.find(p => p.id === 'chuam'); const a1 = AI.aiAnswer(chuam, '일출은 몇 시예요?', '2026-11-16'), a2 = AI.aiAnswer(chuam, '일출은 몇 시예요?', '2026-11-21');
assert.ok(a1.found && a1.text.indexOf(S.hm(S.rise('2026-11-16'))) >= 0 && !/\{일출\}|06:25|시연용/.test(a1.text), a1.text);
assert.ok(a2.text.indexOf(S.hm(S.rise('2026-11-21'))) >= 0 && a1.text !== a2.text, '날짜마다 다른 답');
console.log('일출 시각 시험 통과 · 동해 11/16', S.hm(S.rise('2026-11-16')), S.hm(S.set('2026-11-16')));
// 남에게 보이는 글: 돈·투자 말은 거르고 평범한 소원은 통과
const CF = require('./chatfilter.js');
assert.ok(CF.checkShare('오늘 같은 날이 자주 오게 해 주세요').ok, '평범한 소원 통과');
for (const t of ['로또 1등 되게 해주세요', '계좌 알려드려요', '코인 대박', '대 출 받고 싶어요']) { const r = CF.checkShare(t); assert.ok(!r.ok && r.money, '돈 얘기 거름: ' + t); }
assert.ok(CF.check('로또 1등 되게 해주세요').ok, '내 기록용 검사(check)는 그대로 통과');
console.log('돈 얘기 거름 시험 통과');
