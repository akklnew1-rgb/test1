/* 동네 탭 계산 — 동 이름 → 동네 묶음, 이름 찾기, 30개씩 끊어 보기, 카카오맵 찾기 주소. 브라우저·Node 양쪽. 자료는 town.data.js(동네수집.mjs 가 만듦). 키는 쓰지 않는다. */
(function (root) {
  'use strict';
  var DATA = root.TOWN_DATA || (typeof require !== 'undefined' ? require('./town.data.js') : { eats: [], lodging: [], src: {}, ref: {} });
  var PAGE = 30;
  /* 주소에 적힌 동 → 낯익은 동네 이름. 아래에 없는 동은 '그 밖'. 줄마다 실제 동 이름도 같이 보여 줘서 묶음이 틀려도 숨기지 않는다. */
  var AREA = { '묵호': ['묵호진동', '어달동', '대진동', '노봉동'], '발한': ['발한동'], '천곡': ['천곡동'], '동회': ['동회동'], '부곡': ['부곡동'], '평릉': ['평릉동'], '효가': ['효가동'], '송정': ['송정동'], '구미': ['구미동'], '쇄운': ['쇄운동'], '이도': ['이도동'], '북평': ['북평동', '단봉동'], '망상': ['망상동'], '삼화': ['삼화동'], '나안': ['나안동'], '추암': ['추암동'] };
  var DONG2AREA = {}; Object.keys(AREA).forEach(function (a) { AREA[a].forEach(function (d) { DONG2AREA[d] = a; }); });
  var OTHER = '그 밖';
  function areaOf(dong) { return DONG2AREA[dong] || OTHER; }
  /* 줄 → 객체 */
  function eat(r, i) { return { key: 'e' + i, kind: 'eat', name: r[0], type: r[1], addr: r[2], dong: r[3], area: areaOf(r[3]), lat: r[4] || 0, lng: r[5] || 0, eatId: r[6] || '', prec: r[7] || '' }; }
  function lodge(r, i) { return { key: 'l' + i, kind: 'lodge', name: r[0], type: r[1], addr: r[2], dong: r[3], area: areaOf(r[3]), tel: r[4] || '', lat: r[5] || 0, lng: r[6] || 0 }; }
  /* 목록 순서: 코스에 넣을 수 있는(좌표 있는) 곳 먼저 → 이름이 한글인 곳 → 숫자·영문·기호로 시작하는 곳. 같은 무리 안에서는 가나다순. key 는 자료 줄 번호라 정렬해도 안 바뀐다 */
  function nameClass(n) { var c = String(n || '').trim().charAt(0); return /[가-힣]/.test(c) ? 0 : /[0-9]/.test(c) ? 2 : /[A-Za-z]/.test(c) ? 1 : 3; }
  function byOrder(a, b) {
    var pa = a.lat && a.lng ? 0 : 1, pb = b.lat && b.lng ? 0 : 1; if (pa !== pb) return pa - pb;
    var ca = nameClass(a.name), cb = nameClass(b.name); if (ca !== cb) return ca - cb;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : (a.key < b.key ? -1 : 1);
  }
  var EATS = DATA.eats.map(eat).sort(byOrder), LODGE = DATA.lodging.map(lodge).sort(byOrder);
  function list(kind) { return kind === 'lodge' ? LODGE : EATS; }
  /* 동네 칩: 많은 순, '그 밖'은 맨 뒤 */
  function areas(kind) {
    var c = {}; list(kind).forEach(function (x) { c[x.area] = (c[x.area] || 0) + 1; });
    return Object.keys(c).sort(function (a, b) { return (a === OTHER) - (b === OTHER) || c[b] - c[a] || (a < b ? -1 : 1); }).map(function (a) { return { area: a, n: c[a] }; });
  }
  function norm(s) { return String(s || '').replace(/\s+/g, '').toLowerCase(); }
  /* 걸러내기: area ''=전체, q 는 이름·업태·주소에서 찾는다(띄어쓰기·대소문자 무시) */
  function query(kind, area, q) {
    var nq = norm(q);
    return list(kind).filter(function (x) { return (!area || x.area === area) && (!nq || norm(x.name + x.type + x.addr + x.dong).indexOf(nq) >= 0); });
  }
  function page(items, n) { return items.slice(0, Math.max(1, n || 1) * PAGE); } // n 쪽까지(앞에서부터 30개씩)
  function kakaoSearch(name) { return 'https://map.kakao.com/link/search/' + encodeURIComponent(String(name || '').replace(/[\/?#%&]/g, ' ').replace(/\s+/g, ' ').trim() + ' 동해'); }
  function hasPos(x) { return !!(x && x.lat && x.lng); }
  var api = { nameClass: nameClass, PAGE: PAGE, AREA: AREA, OTHER: OTHER, areaOf: areaOf, list: list, areas: areas, query: query, page: page, kakaoSearch: kakaoSearch, hasPos: hasPos, src: DATA.src, ref: DATA.ref, counts: function () { return { eats: EATS.length, lodging: LODGE.length }; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TourTown = api;
})(typeof window !== 'undefined' ? window : globalThis);
