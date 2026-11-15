/* 도째비 길동무 — 관광지 집중률 예측 중계 함수 (Vercel). 열쇠는 환경변수 TOUR_KEY 에만 둔다(앱 코드에 넣지 않음).
 * 공공데이터포털 "한국관광공사_관광지 집중률 방문자 추이 예측 정보"(TatsCnctrRateService)에서 동해시의 앞으로 30일 관광지별 집중률(100=가장 붐빔)을 받아
 * 앱(crowd.js)이 쓰는 모양으로 돌려준다:  { ok, baseYmd, from, to, spots:{ 관광지이름:{ YYYYMMDD: 값 } }, source }
 *   GET /api/crowd           → 위 모양. 실패하면 { ok:false, error } (앱은 붐빔 표시 없이 원래대로 돈다)
 *   GET /api/crowd?debug=1   → 받은 줄 앞 3개 원본(열쇠 제외) — 응답 모양 확인용
 * 값은 하루 한 개(시간대 없음)이고 실시간이 아니다. 하루 호출 수가 적어서 6시간 동안 같은 답을 다시 쓴다. */
var ALLOW = (process.env.ALLOW_ORIGINS || 'https://akklnew1-rgb.github.io,https://dojjaebi-gildongmu.vercel.app,https://test1-tour-design.vercel.app,http://localhost:8765').split(',');
var BASE = 'https://apis.data.go.kr/B551011/TatsCnctrRateService/tatsCnctrRatedList';
var AREAS = [['51', '51170'], ['42', '42170']]; // 강원특별자치도(새 코드) 동해시 → 안 나오면 옛 코드
var cache = null, hits = {};
function limited(ip) { var m = Math.floor(Date.now() / 60000), h = hits[ip] || (hits[ip] = { m: m, n: 0 }); if (h.m !== m) { h.m = m; h.n = 0; } return ++h.n > 20; }
function keyOf() { var raw = String(process.env.TOUR_KEY || '').trim(); if (!raw) return ''; try { if (/%/.test(raw)) raw = decodeURIComponent(raw); } catch (e) { /* 그대로 */ } return encodeURIComponent(raw); }
async function fetchRows(area, sg, key, doFetch) {
  var url = BASE + '?serviceKey=' + key + '&pageNo=1&numOfRows=1500&MobileOS=ETC&MobileApp=dojjaebi&_type=json&areaCd=' + area + '&signguCd=' + sg;
  var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 8000);
  try {
    var r = await doFetch(url, { signal: ctl.signal }), txt = await r.text(), j;
    try { j = JSON.parse(txt); } catch (e) { throw new Error('응답 형식 오류(이 서비스 활용신청이 승인 전이거나 열쇠가 다를 수 있어요)'); }
    var h = j && j.response && j.response.header;
    if (!h || (h.resultCode !== '0000' && h.resultCode !== '00')) throw new Error('관광공사 응답 ' + (h ? h.resultCode + ' ' + h.resultMsg : '없음'));
    var it = j.response.body && j.response.body.items && j.response.body.items.item;
    return !it ? [] : (Array.isArray(it) ? it : [it]);
  } finally { clearTimeout(t); }
}
/* 줄들 → 앱 모양. 값은 0~100 숫자만, 날짜는 8자리만 받는다. */
function shape(rows) {
  var spots = {}, from = '', to = '', base = '', n = 0;
  rows.forEach(function (x) {
    var nm = String(x.tAtsNm || '').trim(), d = String(x.baseYmd || '').replace(/\D/g, ''), v = parseFloat(x.cnctrRate);
    if (!nm || d.length !== 8 || !isFinite(v) || v < 0 || v > 100) return;
    (spots[nm] || (spots[nm] = {}))[d] = Math.round(v * 10) / 10; n++;
    if (!from || d < from) from = d; if (!to || d > to) to = d;
  });
  if (!n) return null;
  return { ok: true, baseYmd: base || from, from: from, to: to, spots: spots, source: '한국관광공사 관광지 집중률 방문자 추이 예측(날짜별, 실시간 아님)' };
}
async function load(key, doFetch) {
  var lastErr = null;
  for (var i = 0; i < AREAS.length; i++) {
    try { var rows = await fetchRows(AREAS[i][0], AREAS[i][1], key, doFetch), s = shape(rows); if (s) return { data: s, rows: rows }; lastErr = new Error('동해시 집중률 줄이 없어요'); }
    catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('받지 못했어요');
}
module.exports = async function handler(req, res) {
  var origin = req.headers.origin || '';
  if (ALLOW.indexOf(origin) >= 0) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  res.setHeader('content-type', 'application/json; charset=utf-8'); res.statusCode = 200;
  var q = req.query || {}; if (!req.query) { try { q = Object.fromEntries(new URL(req.url, 'http://x').searchParams); } catch (e) { q = {}; } }
  var debug = q.debug === '1';
  if (!debug && cache && Date.now() - cache.t < 6 * 3600000) { res.setHeader('Cache-Control', 's-maxage=3600'); res.end(JSON.stringify(cache.v)); return; }
  var ip = String((req.headers['x-forwarded-for'] || '').split(',')[0] || 'x');
  if (limited(ip)) { res.end(JSON.stringify({ ok: false, error: '잠시 뒤에 다시 해 주세요' })); return; }
  res.setHeader('Cache-Control', 'no-store');
  try {
    var key = keyOf(); if (!key) throw new Error('TOUR_KEY 없음');
    var got = await load(key, fetch);
    if (debug) { res.end(JSON.stringify({ ok: true, n: got.rows.length, sample: got.rows.slice(0, 3), spots: Object.keys(got.data.spots), from: got.data.from, to: got.data.to })); return; }
    cache = { t: Date.now(), v: got.data }; res.end(JSON.stringify(got.data));
  } catch (e) { res.end(JSON.stringify({ ok: false, error: String(e && e.message || e).slice(0, 120) })); } // 열쇠는 응답에 넣지 않는다
};
module.exports.shape = shape;
