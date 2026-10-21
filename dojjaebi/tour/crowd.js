/* 관광지 집중률 예측(한국관광공사) 계산 — 이름 맞추기 · 등급 · 날짜별 평균 · 더 한산한 이웃 날. 브라우저·Node 양쪽에서 쓴다.
 * 자료: /api/crowd (run/crowd.mjs) 또는 묶음의 CROWD_SNAPSHOT = { ok, baseYmd, from, to, spots:{ 관광지이름:{ YYYYMMDD: 값 } }, source }
 *   값은 하루 한 개(시간대 없음), 100 = 가장 붐빔. 날짜별 예측이며 실시간이 아니다.
 * 이름이 우리 장소와 맞지 않는 곳(해랑전망대·두타산 등)은 쓰지 않는다. */
(function (root) {
  'use strict';
  /* 관광공사 관광지 이름 → 우리 장소 id (places.js). 같은 곳이 둘이면 더 큰 이름 하나만. */
  var NAME2ID = {
    '도째비골스카이밸리': 'skyvalley',
    '논골담길': 'nolgol',
    '묵호등대': 'lighthouse',
    '묵호항': 'mukhoport',
    '묵호항수변공원': 'suibyeon',
    '전망대활어회센터 (묵호항전망대)': 'jeonmangdae',
    '어달해변': 'eodal',
    '추암 촛대바위': 'chuam',
    '추암해변': 'chuambeach',
    '추암조각공원': 'chuamsculpt',
    '천곡황금박쥐동굴': 'cheongok',
    '노봉해변': 'nobong',
    '망상해변': 'mangsang',
    '감추사': 'gamchusa',
    '무릉계곡': 'yongchu',
    '무릉별유천지': 'byeoryu'
  };
  var LOW = 40, HIGH = 70, BUSY = 80; // 한산 < 40 · 보통 40~70 · 붐빔 > 70 · 코스 "붐빔 예상" 안내와 아침 먼저는 > 80
  function level(v) { return v < LOW ? 'low' : v <= HIGH ? 'mid' : 'high'; }
  var LEVEL_NAME = { low: '한산', mid: '보통', high: '붐빔' };
  var AVG_NAME = { low: '한산', mid: '보통', high: '높음' };
  function ymd(iso) { var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(iso || '')); return m ? m[1] + ('0' + m[2]).slice(-2) + ('0' + m[3]).slice(-2) : ''; }
  function iso(y8) { return y8 && /^\d{8}$/.test(y8) ? y8.slice(0, 4) + '-' + y8.slice(4, 6) + '-' + y8.slice(6) : ''; }
  function valid(d) { return !!(d && d.ok !== false && d.spots && d.from && d.to); }
  function has(d, y8) { return valid(d) && /^\d{8}$/.test(y8) && y8 >= d.from && y8 <= d.to; }
  /* 날짜(iso)의 장소별 값 { 장소id: 값 } — 예측이 없는 날(범위 밖)이면 null */
  function ratesFor(d, isoDate) {
    var y = ymd(isoDate); if (!has(d, y)) return null;
    var out = {}, n = 0;
    Object.keys(NAME2ID).forEach(function (nm) { var m = d.spots[nm]; if (m && m[y] != null && isFinite(m[y])) { out[NAME2ID[nm]] = m[y]; n++; } });
    return n ? out : null;
  }
  function rateFor(d, placeId, isoDate) { var r = ratesFor(d, isoDate); return r && r[placeId] != null ? r[placeId] : null; }
  /* 그날 동해 주요 관광지(받은 30곳 전부) 평균 */
  function avgFor(d, isoDate) {
    var y = ymd(isoDate); if (!has(d, y)) return null;
    var s = 0, n = 0; Object.keys(d.spots).forEach(function (nm) { var v = d.spots[nm][y]; if (v != null && isFinite(v)) { s += v; n++; } });
    return n ? Math.round(s / n * 10) / 10 : null;
  }
  /* 앞뒤 2일 안(오늘 이후, 예측 범위 안)에서 훨씬(평균 15점 이상) 더 한산한 날 하나. 없으면 null. */
  function quieter(d, isoDate, todayIso, addDays) {
    var a = avgFor(d, isoDate); if (a == null || level(a) === 'low') return null;
    var best = null;
    [-2, -1, 1, 2].forEach(function (k) {
      var di = addDays(isoDate, k); if (!di || (todayIso && di < todayIso)) return;
      var v = avgFor(d, di); if (v == null) return;
      if (a - v >= 15 && level(v) !== level(a) && (!best || v < best.avg)) best = { iso: di, avg: v, level: level(v) };
    });
    return best;
  }
  function sourceLine(d) { return '한국관광공사 관광지 집중률 예측 · 통신 데이터 기반 · 날짜별 예측(실시간 아님) · 기준 ' + iso(d && d.baseYmd || d && d.from || ''); }
  var api = { NAME2ID: NAME2ID, LOW: LOW, HIGH: HIGH, BUSY: BUSY, level: level, LEVEL_NAME: LEVEL_NAME, AVG_NAME: AVG_NAME, ymd: ymd, iso: iso, valid: valid, has: has, ratesFor: ratesFor, rateFor: rateFor, avgFor: avgFor, quieter: quieter, sourceLine: sourceLine };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TourCrowd = api;
})(typeof window !== 'undefined' ? window : globalThis);
