/* 일출·일몰 시각 계산(날짜와 위치만으로) — 미국 해양대기청(NOAA) 간단 식. 외부 자료·서버 없이 날짜가 바뀌면 값이 저절로 바뀐다.
 * 동해시 중심(37.5247, 129.1143) 기준, 한국 표준시. 구름·지형은 반영하지 않는 '계산값'이라 몇 분 어긋날 수 있다(앞뒤 1~3분). */
(function (root) {
  'use strict';
  var LAT = 37.5247, LNG = 129.1143, ZENITH = 90.833, R = Math.PI / 180;
  function dayOfYear(y, m, d) { return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86400000); }
  function mod(a, n) { return ((a % n) + n) % n; }
  function calc(iso, rise, lat, lng) {
    var mm = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(iso || '')); if (!mm) return null;
    lat = lat == null ? LAT : lat; lng = lng == null ? LNG : lng;
    var N = dayOfYear(+mm[1], +mm[2], +mm[3]), lh = lng / 15, t = N + ((rise ? 6 : 18) - lh) / 24;
    var M = 0.9856 * t - 3.289, L = mod(M + 1.916 * Math.sin(M * R) + 0.02 * Math.sin(2 * M * R) + 282.634, 360);
    var RA = mod(Math.atan(0.91764 * Math.tan(L * R)) / R, 360);
    RA += Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90; RA /= 15;
    var sinDec = 0.39782 * Math.sin(L * R), cosDec = Math.cos(Math.asin(sinDec));
    var cosH = (Math.cos(ZENITH * R) - sinDec * Math.sin(lat * R)) / (cosDec * Math.cos(lat * R));
    if (cosH > 1 || cosH < -1) return null;
    var H = (rise ? 360 - Math.acos(cosH) / R : Math.acos(cosH) / R) / 15;
    var T = H + RA - 0.06571 * t - 6.622, UT = mod(T - lh, 24);
    return Math.round(mod(UT + 9, 24) * 60); // 한국 표준시, 하루 중 분
  }
  function hm(min) { return min == null ? '' : ('0' + Math.floor(min / 60)).slice(-2) + ':' + ('0' + (min % 60)).slice(-2); }
  /* 글 안의 {일출}·{일몰} 자리를 그 날짜의 계산값으로 바꾼다 */
  function fill(text, iso) {
    return String(text || '').replace(/\{일출\}/g, hm(calc(iso, true)) || '계산 불가').replace(/\{일몰\}/g, hm(calc(iso, false)) || '계산 불가');
  }
  var api = { rise: function (iso, lat, lng) { return calc(iso, true, lat, lng); }, set: function (iso, lat, lng) { return calc(iso, false, lat, lng); }, hm: hm, fill: fill };
  root.TourSun = api; if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
