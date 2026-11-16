/* 질문과 관련 있는 사람들의 글 고르기 (브라우저·Node 양쪽에서 씀)
 *  relevant(question, posts) → 질문과 글자 두 자 묶음이 2개 이상 겹치는 글(질문 글은 뺀다), 점수 높은 순 → 최근 순
 *  isQuestion(text) → 물음표나 '어때요·있나요' 같은 말이 들어 있으면 질문
 * 일부러 단순하다: 글자 두 자 묶음(예: 곰치국 → 곰치·치국)이 겹치는 정도만 본다. 흔한 말(어디·좋아요·동해 …)은 세지 않는다. */
(function (root) {
  'use strict';
  var STOP = {}; ('동해 해여 여행 행가 가요 어디 디가 디서 좋아 아요 어요 해요 에요 이요 있나 나요 있어 없어 어때 때요 알려 려주 주세 세요 추천 천해 천좋 궁금 금해 금한 가고 고싶 싶어 싶은 하는 하고 해서 에서 으로 에는 에도 입니 니다 습니 었어 였어 거예 예요 그냥 정말 진짜 많이 하루 오늘 내일 이번 어떤 무엇 뭐가 뭘까 같아 같은').split(' ').forEach(function (s) { STOP[s] = 1; });
  var Q_RE = /[?？]|어때요|어떤가요|어떨까요|있나요|없나요|알려\s*주|궁금|추천\s*해|어디가|어디로|뭐가|뭘\s*먹|될까요|괜찮을까요/;
  function isQuestion(t) { return Q_RE.test(String(t || '')); }
  function bi(s) {
    s = String(s || '').toLowerCase().replace(/[^가-힣a-z0-9]/g, ''); var o = {}, i;
    for (i = 0; i + 1 < s.length; i++) { var g = s.substr(i, 2); if (!STOP[g]) o[g] = 1; }
    return o;
  }
  function relevant(question, posts, names) {
    var qb = bi(question), q = String(question || '').replace(/\s+/g, '');
    var out = [];
    (posts || []).forEach(function (p) {
      if (!p || !p.t || p.type === 'q' || isQuestion(p.t)) return;
      var pb = bi(p.t), n = 0, g;
      for (g in qb) if (pb[g]) n++;
      var hitName = (names || []).some(function (nm) { return nm && nm.length >= 3 && q.indexOf(nm) >= 0 && (p.t.indexOf(nm) >= 0 || p.pn === nm); });
      if (n >= 2 || hitName) out.push({ p: p, s: n + (hitName ? 3 : 0) });
    });
    out.sort(function (a, b) { return b.s - a.s || (b.p.ts || 0) - (a.p.ts || 0); });
    return out.map(function (x) { return x.p; });
  }
  /* 질문 하나에 대한 보여줄 글 묶음: 딱 맞는 글이 있으면 mode 'match', 없으면 최근 경험 글을 'recent'로 따로 준다(둘 다 질문 글은 뺀다) */
  function answer(question, posts, names, n) {
    n = n || 5;
    var m = relevant(question, posts, names);
    if (m.length) return { mode: 'match', list: m.slice(0, n) };
    var r = (posts || []).filter(function (p) { return p && p.t && p.type !== 'q' && !isQuestion(p.t); })
      .sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
    return { mode: r.length ? 'recent' : 'none', list: r.slice(0, n) };
  }
  var api = { relevant: relevant, isQuestion: isQuestion, answer: answer };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.V2Rank = api;
})(typeof window !== 'undefined' ? window : globalThis);
