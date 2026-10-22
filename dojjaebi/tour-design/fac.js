/* 편의 시설(화장실·관광안내소·숙박·식당) 계산 — 거리·가장 가까운 곳·글. 브라우저·Node 양쪽에서 쓴다. 자료는 facilities.js(자동 생성). */
(function (root) {
  'use strict';
  function dist(lat1, lng1, lat2, lng2) { // 두 점 사이 직선 거리(m)
    var R = 6371000, r = Math.PI / 180, dLat = (lat2 - lat1) * r, dLng = (lng2 - lng1) * r;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  /* list 에서 (lat,lng) 와 가장 가까운 것. maxM 보다 멀면 null. 같은 거리면 앞에 있는 것. */
  function nearest(list, lat, lng, maxM) {
    var best = null;
    (list || []).forEach(function (it) {
      var m = dist(lat, lng, it.lat, it.lng);
      if (best === null || m < best.m) best = { item: it, m: m };
    });
    if (!best || (maxM != null && best.m > maxM)) return null;
    return best;
  }
  /* 가까운 순으로 n 개 (maxM 안) */
  function nearestN(list, lat, lng, n, maxM) {
    return (list || []).map(function (it) { return { item: it, m: dist(lat, lng, it.lat, it.lng) }; })
      .filter(function (x) { return maxM == null || x.m <= maxM; })
      .sort(function (a, b) { return a.m - b.m; }).slice(0, n);
  }
  /* 코스 점들 중 하나라도 radius(m) 안에 있는 것만 */
  function filterNear(list, pts, radius) {
    return (list || []).filter(function (it) { return pts.some(function (p) { return dist(p.lat, p.lng, it.lat, it.lng) <= radius; }); });
  }
  function round10(m) { return Math.max(10, Math.round(m / 10) * 10); }
  /* 화장실이 열려 있는 시간 글: "24시간" · "06:00~19:00" ("해수욕장개장기간만" 같은 덧붙임은 그대로) */
  function hoursText(t) {
    if (!t) return '';
    if (t.h24 && !/\(/.test(t.hours)) return '24시간';
    return t.hours ? t.hours.replace(/^(\d\d:\d\d)~24:00$/, '$1~24:00').replace('00:00~24:00', '24시간') : '';
  }
  /* 자료에 있는 것만 적는다: 시간 · 장애인용 · 기저귀 교환대 · 비상벨 (자료가 비어 있으면 안 적고, 없다고도 말하지 않는다) */
  function wcFacts(t) {
    var f = [], h = hoursText(t);
    if (h) f.push(h);
    if (t.acc) f.push('장애인 화장실');
    if (t.diaper && !/^(N|없음|0)$/i.test(t.diaper)) f.push('기저귀 교환대');
    if (t.bell && !/^(N|없음|0)$/i.test(t.bell)) f.push('비상벨');
    return f;
  }
  function wcLine(hit) {
    if (!hit) return '';
    var f = wcFacts(hit.item);
    return '가까운 화장실 ' + hit.item.name + ' ' + round10(hit.m) + 'm' + (f.length ? ' (' + f.join(' · ') + ')' : '');
  }
  var api = { dist: dist, nearest: nearest, nearestN: nearestN, filterNear: filterNear, round10: round10, hoursText: hoursText, wcFacts: wcFacts, wcLine: wcLine };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TourFac = api;
})(typeof window !== 'undefined' ? window : globalThis);
