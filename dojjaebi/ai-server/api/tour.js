/* 도째비 길동무 — 관광정보 중계 함수 (Vercel). 열쇠는 환경변수 TOUR_KEY 에만 둔다(앱 코드에 넣지 않음).
 * 공공데이터포털 "한국관광공사_국문 관광정보 서비스_GW"(TourAPI, KorService2)를 동해시(강원 areaCode 32, sigunguCode 3)로 좁혀서 앱이 쓰는 모양으로 돌려준다.
 *   GET ?op=list&type=12&rows=20&page=1   동해시 장소 목록(type: 12 관광지 · 14 문화시설 · 15 행사 · 28 레포츠 · 32 숙박 · 38 쇼핑 · 39 음식점, 비우면 전체)
 *   GET ?op=search&q=묵호&type=12          이름·낱말 검색
 *   GET ?op=festival&from=20261101         동해시 행사(시작일 이후)
 *   GET ?op=detail&id=콘텐츠번호            개요·사진 등 자세한 정보 한 곳
 * → { items:[{ id, title, type, addr, lat, lng, img, tel }] } / detail: { item:{...,overview} } / 실패하면 { error } (앱은 원래 자료로 계속 돌아간다)
 * 개발계정은 하루 호출 수가 적어서 같은 요청은 30분 동안 다시 쓰고, 주소별 분당 호출도 제한한다. */
var ALLOW = (process.env.ALLOW_ORIGINS || 'https://akklnew1-rgb.github.io,https://dojjaebi-gildongmu.vercel.app,https://test1-tour-design.vercel.app,http://localhost:8765').split(',');
var BASE = 'https://apis.data.go.kr/B551011/KorService2/', AREA = '32', SIGUNGU = '3';
var cache = {}, hits = {};
function limited(ip) { var m = Math.floor(Date.now() / 60000), h = hits[ip] || (hits[ip] = { m: m, n: 0 }); if (h.m !== m) { h.m = m; h.n = 0; } return ++h.n > 30; }
function keyOf() { var raw = String(process.env.TOUR_KEY || '').trim(); if (!raw) return ''; try { if (/%/.test(raw)) raw = decodeURIComponent(raw); } catch (e) { /* 그대로 */ } return encodeURIComponent(raw); }
function qs(o) { return Object.keys(o).filter(function (k) { return o[k] !== '' && o[k] != null; }).map(function (k) { return k + '=' + encodeURIComponent(o[k]); }).join('&'); }
async function call(op, params, key) {
  var url = BASE + op + '?serviceKey=' + key + '&' + qs(Object.assign({ MobileOS: 'ETC', MobileApp: 'dojjaebi', _type: 'json' }, params));
  var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 6000);
  try {
    var r = await fetch(url, { signal: ctl.signal }), txt = await r.text(), j;
    try { j = JSON.parse(txt); } catch (e) { throw new Error('응답 형식 오류(열쇠 승인 전이거나 잘못된 열쇠일 수 있어요)'); }
    var h = j && j.response && j.response.header;
    if (!h || (h.resultCode !== '0000' && h.resultCode !== '00')) throw new Error('관광공사 응답 ' + (h ? h.resultCode + ' ' + h.resultMsg : '없음'));
    var it = j.response.body && j.response.body.items && j.response.body.items.item;
    return !it ? [] : (Array.isArray(it) ? it : [it]);
  } finally { clearTimeout(t); }
}
function norm(x) {
  return { id: String(x.contentid || ''), title: x.title || '', type: String(x.contenttypeid || ''), addr: ((x.addr1 || '') + ' ' + (x.addr2 || '')).trim(), lat: x.mapy ? parseFloat(x.mapy) : null, lng: x.mapx ? parseFloat(x.mapx) : null,
    img: String(x.firstimage || '').replace(/^http:\/\//, 'https://'), tel: x.tel || '', start: x.eventstartdate || '', end: x.eventenddate || '' };
}
function num(v, d, lo, hi) { var n = parseInt(v, 10); return isNaN(n) ? d : Math.max(lo, Math.min(hi, n)); }
async function run(q, key) {
  var op = String(q.op || 'list'), type = /^(12|14|15|25|28|32|38|39)$/.test(q.type || '') ? q.type : '', rows = num(q.rows, 20, 1, 50), page = num(q.page, 1, 1, 50);
  var base = { areaCode: AREA, sigunguCode: SIGUNGU, numOfRows: rows, pageNo: page };
  if (op === 'list') return { items: (await call('areaBasedList2', Object.assign({ contentTypeId: type, arrange: 'O' }, base), key)).map(norm) };
  if (op === 'search') { var kw = String(q.q || '').trim().slice(0, 30); if (!kw) throw new Error('검색어 없음'); return { items: (await call('searchKeyword2', Object.assign({ keyword: kw, contentTypeId: type }, base), key)).map(norm) }; }
  if (op === 'festival') { var d = /^\d{8}$/.test(q.from || '') ? q.from : new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10).replace(/-/g, ''); return { items: (await call('searchFestival2', Object.assign({ eventStartDate: d }, base), key)).map(norm) }; }
  if (op === 'detail') {
    var id = String(q.id || '').replace(/\D/g, ''); if (!id) throw new Error('콘텐츠 번호 없음');
    var rs = await call('detailCommon2', { contentId: id }, key); if (!rs.length) throw new Error('정보 없음');
    var it = norm(rs[0]); it.overview = String(rs[0].overview || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600); return { item: it };
  }
  throw new Error('알 수 없는 요청');
}
module.exports = async function handler(req, res) {
  var origin = req.headers.origin || '';
  if (ALLOW.indexOf(origin) >= 0) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('content-type', 'application/json; charset=utf-8'); res.statusCode = 200;
  var ip = String((req.headers['x-forwarded-for'] || '').split(',')[0] || 'x');
  var q = req.query || {}; if (!req.query) { try { q = Object.fromEntries(new URL(req.url, 'http://x').searchParams); } catch (e) { q = {}; } }
  var ck = JSON.stringify([q.op, q.type, q.q, q.id, q.from, q.rows, q.page]), c = cache[ck];
  if (c && Date.now() - c.t < 30 * 60000) { res.end(JSON.stringify(c.v)); return; }
  if (limited(ip)) { res.end(JSON.stringify({ error: '잠시 뒤에 다시 해 주세요' })); return; }
  try { var key = keyOf(); if (!key) throw new Error('TOUR_KEY 없음'); var v = await run(q, key); cache[ck] = { t: Date.now(), v: v }; res.end(JSON.stringify(v)); }
  catch (e) { res.end(JSON.stringify({ error: String(e && e.message || e).slice(0, 120) })); } // 열쇠는 응답에 넣지 않는다
};
