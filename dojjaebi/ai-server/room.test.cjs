/* node room.test.cjs — 사랑방 요약 정리 규칙(cleanRoom) 시험: 인원수는 서버가 세고, 링크·전화번호는 지우고, 없는 글쓴이 번호는 버린다 */
const { cleanRoom } = require('./api/ai.js');
let bad = 0;
function t(name, cond, extra) { if (!cond) { bad++; console.log('X', name, extra || ''); } else console.log('ok', name); }
const valid = { 0: 1, 1: 1, 2: 1 };
const J = (items) => JSON.stringify({ items });

let r = cleanRoom(J([{ topic: '바람', mood: 'info', gist: '바람이 세다', writers: [0, 1, 1, 7] }]), valid);
t('같은 사람 두 번·없는 번호는 한 번만/버림 → 2명', r.length === 1 && r[0].n === 2, JSON.stringify(r));
r = cleanRoom(J([{ gist: '아무도 안 말함', writers: [9] }]), valid);
t('유효한 글쓴이가 없으면 항목 버림', r.length === 0);
r = cleanRoom(J([{ gist: '여기 http://a.com 에서 예약', writers: [0] }]), valid);
t('링크 지움', r.length === 1 && !/http|a\.com/.test(r[0].gist), JSON.stringify(r));
r = cleanRoom(J([{ gist: '010-1234-5678', writers: [0] }]), valid);
t('전화번호만 있던 항목은 버림', r.length === 0, JSON.stringify(r));
r = cleanRoom(J([{ gist: '문의 033-531-1234 로 주세요', writers: [0] }]), valid);
t('전화번호 지움', r.length === 1 && !/\d{3}-\d{3}/.test(r[0].gist), JSON.stringify(r));
r = cleanRoom(J([{ gist: '가'.repeat(100), writers: [0] }]), valid);
t('40자까지만', r[0].gist.length === 40);
r = cleanRoom(J([{ gist: '이상한 분위기', mood: 'hack', writers: [0] }]), valid);
t('모르는 mood 는 info', r[0].mood === 'info');
r = cleanRoom(J([1, 2, 3, 4, 5, 6].map(i => ({ gist: '항목' + i, writers: [0] }))), valid);
t('최대 4개', r.length === 4);
t('깨진 JSON 은 null', cleanRoom('not json', valid) === null);
t('items 없음 → 빈 배열', Array.isArray(cleanRoom('{}', valid)) && cleanRoom('{}', valid).length === 0);
console.log(bad ? 'FAIL ' + bad : 'ALL PASS');
process.exit(bad ? 1 : 0);
