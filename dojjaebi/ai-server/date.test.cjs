const { dateHint: d } = require('./api/ai.js'); const a = require('assert');
const T = '2026-11-13'; // 금요일
[['오늘 동해','2026-11-13'],['내일','2026-11-14'],['모레','2026-11-15'],['이번 토요일','2026-11-14'],['금요일','2026-11-13'],['목요일','2026-11-19'],['주말에','2026-11-14'],['다음 주말','2026-11-21'],['다음주 월요일','2026-11-16'],['담주 일요일','2026-11-22'],['11월 20일','2026-11-20'],['11월 1일','2027-11-01'],['3일 뒤','2026-11-16'],['단풍 보고 싶어',''],['2월 30일','']]
  .forEach(([t, e]) => a.strictEqual(d(t, T), e, t));
a.strictEqual(d('이번 주말', '2026-11-15'), '2026-11-15');
console.log('날짜 말 시험 통과');
const { nightsHint: n } = require('./api/ai.js');
[['1박 2일로 갈래',1],['2박 3일',2],['당일치기',0],['이틀 동안',1],['토요일 일요일에',1],['금요일 토요일 일요일',2],['단풍',null],['3박 4일',2]].forEach(([t, e]) => a.strictEqual(n(t, T), e, t));
console.log('머무는 기간 시험 통과');
// 2026-11-15: 앞서 말한 날짜가 최근 8개 대화 밖으로 밀려도 앱이 아는 조건(known)으로 이어 간다
{ const { knownHints } = require('./api/ai.js'), a = require('assert');
  let k = knownHints({ date: '2026-11-16', backDate: '', how: 'car', companions: ['친구'], arrive: '600' }, '2026-11-15');
  a.strictEqual(k.date, '2026-11-16'); a.strictEqual(k.nights, null); a.ok(/자가용/.test(k.text) && /친구/.test(k.text) && /도착 10시 0분/.test(k.text));
  k = knownHints({ date: '2026-11-20', backDate: '2026-11-21' }, '2026-11-15'); a.strictEqual(k.nights, 1);
  a.strictEqual(knownHints({ date: '2026-11-10' }, '2026-11-15').date, ''); // 지난 날짜는 안 씀
  a.strictEqual(knownHints(null, '2026-11-15').date, ''); a.strictEqual(knownHints({ date: 'x' }, '2026-11-15').date, '');
  console.log('앞서 알던 조건 이어 가기 시험 통과'); }
