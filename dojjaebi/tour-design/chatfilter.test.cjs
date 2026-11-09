/* node chatfilter.test.cjs — 사랑방 글 검사 규칙 시험 */
const F = require('./chatfilter.js');
let bad = 0;
function t(name, text, ok) {
  const r = F.check(text);
  if (r.ok !== ok) { bad++; console.log('X', name, JSON.stringify(text), '→', JSON.stringify(r)); } else console.log('ok', name);
}
t('보통 글', '묵호등대 노을 진짜 예뻐요', true);
t('ㅋㅋ', '여기 대박이다ㅋㅋㅋㅋㅋ', true);
t('빈 글', '   ', false);
t('81자', '가'.repeat(81), false);
t('80자', '가나다라마바사아자차'.repeat(8), true);
t('링크 http', '여기 보세요 http://abc.com', false);
t('링크 도메인', 'naver.com 에서 봤어요', false);
t('링크 www', 'www.test.kr', false);
t('전화 하이픈', '010-1234-5678 로 연락줘', false);
t('전화 공백', '010 1234 5678', false);
t('전화 붙임', '01012345678', false);
t('지역번호', '033-531-1234', false);
t('욕설', '시 발 뭐야', false);
t('욕설 초성', 'ㅅㅂ', false);
t('도박', '토토 하실 분', false);
t('홍보', '오픈채팅 들어오세요', false);
t('반복', '아아아아아아아아아아', false);
t('숫자 정상', '오전 10시에 3명이 갔는데 40분 기다렸어요', true);
t('가격 정상', '주차는 2000원이었어요', true);
if (F.nick('a') !== F.nick('a')) { bad++; console.log('X 닉네임이 같은 시드에서 달라짐'); } else console.log('ok 닉네임 고정');
console.log(F.nick('abc'), '/', F.nick('xyz'));
console.log(bad ? 'FAIL ' + bad : 'ALL PASS');
process.exit(bad ? 1 : 0);
