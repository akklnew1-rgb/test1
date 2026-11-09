/*
 * 동해 사랑방 — 글 검사 규칙 (브라우저·Node 양쪽에서 씀)
 *  check(text)  → { ok:true, text:'다듬은 글' } 또는 { ok:false, why:'올릴 수 없는 까닭(쉬운 말)' }
 *  nick(seed)   → '길 잃은 도깨비 123' 같은 자동 이름 (같은 seed 면 같은 이름)
 * 규칙은 일부러 단순하다: 링크·전화번호·광고 말·욕설·도배만 막는다. 더 필요하면 아래 목록만 늘리면 된다.
 */
(function (root) {
  'use strict';
  var MAX = 80;

  /* 욕설·도박·성매매 같은 말 (띄어쓰기·점·별을 지우고 비교) */
  var BAD = ['시발', '씨발', '씨빨', 'ㅅㅂ', 'ㅆㅂ', '병신', 'ㅂㅅ', '개새끼', '개세끼', '새끼야', '좆', '존나', '졸라게', '지랄', 'ㅈㄹ', '닥쳐', '꺼져', '미친놈', '미친년', '걸레', '창녀', '섹스', '야동', '성매매', '조건만남', '원나잇', '도박', '토토', '카지노', '바카라', '불법대출', '대출문의', '주식리딩', '코인리딩', '출장안마'];
  /* 홍보 말 */
  var AD = ['오픈채팅', '오픈톡', '카톡문의', '카톡주세요', '텔레그램', '텔레', '친추', '문의주세요', '할인쿠폰', '무료상담'];

  function squash(s) { return String(s).toLowerCase().replace(/[\s.,·\-_*~!?^'"`()\[\]{}<>\/\\|+=:;@#$%&]/g, ''); }

  function check(text) {
    var t = String(text == null ? '' : text).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!t) return { ok: false, why: '글을 적어 주세요' };
    if (t.length > MAX) return { ok: false, why: MAX + '자까지 적을 수 있어요' };
    var q = squash(t), i;
    /* 링크 */
    if (/(https?:\/\/|www\.|[a-z0-9-]+\.(com|net|kr|co|me|io|xyz|link|site|shop|app)\b|bit\.ly|t\.me|kakao\.com)/i.test(t)) return { ok: false, why: '링크는 올릴 수 없어요' };
    /* 전화번호 (010-1234-5678 · 033 123 4567 · 붙여 쓴 것 모두) */
    var digits = t.replace(/[\s\-.·,()]/g, '');
    if (/01[016789]\d{7,8}/.test(digits) || /0(2|3[1-3]|4[1-4]|5[1-5]|6[1-4])\d{7,8}/.test(digits)) return { ok: false, why: '전화번호는 올릴 수 없어요' };
    /* 같은 글자 반복 (ㅋㅋㅋㅋㅋㅋ 정도는 5번까지 봐 줌) */
    if (/(.)\1{7,}/.test(t)) return { ok: false, why: '같은 글자를 너무 많이 이어 썼어요' };
    for (i = 0; i < BAD.length; i++) if (q.indexOf(squash(BAD[i])) >= 0) return { ok: false, why: '서로 기분 좋게 쓸 수 있는 말로 적어 주세요' };
    for (i = 0; i < AD.length; i++) if (q.indexOf(squash(AD[i])) >= 0) return { ok: false, why: '홍보하는 글은 올릴 수 없어요' };
    return { ok: true, text: t };
  }

  var ADJ = ['길 잃은', '바람 쐬는', '배고픈', '졸린', '신난', '느긋한', '두리번거리는', '노을 보는', '파도 구경하는', '사진 찍는', '걷다 지친', '커피 찾는'];
  function hash(s) { var h = 5381; s = String(s); for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h; }
  function nick(seed) { var h = hash(seed); return ADJ[h % ADJ.length] + ' 도깨비 ' + (100 + (Math.floor(h / 13) % 900)); }

  var api = { check: check, nick: nick, MAX: MAX };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ChatFilter = api;
})(typeof self !== 'undefined' ? self : this);
