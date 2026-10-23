/* 도째비 길동무 — 날씨 중계 함수 (Vercel). 열쇠는 환경변수 KMA_KEY 에만 둔다(앱 코드에 넣지 않음).
 * 공공데이터포털 "기상청_단기예보 ((구)동네예보) 조회서비스" 두 가지를 합쳐 앱이 쓰는 모양으로 돌려준다.
 *   초단기실황(getUltraSrtNcst): 지금 기온·비 여부·1시간 강수량·바람   /  초단기예보(getUltraSrtFcst): 하늘 상태(맑음·흐림)
 * GET → { temp, sky, pty, text, wind, rain1h, baseTime }  /  실패하면 { error } (앱이 알아서 날씨 칸을 숨긴다)
 * 같은 값을 5분 동안 다시 쓴다(호출 한도 보호). */
var ALLOW = (process.env.ALLOW_ORIGINS || 'https://akklnew1-rgb.github.io,https://dojjaebi-gildongmu.vercel.app,https://test1-tour-design.vercel.app,http://localhost:8765').split(',');
var LAT = 37.5247, LON = 129.1143; // 동해시청 근처
var BASE = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/';
var cache = null;

/* 기상청 격자 변환(람베르트 정각원추). 위·경도 → nx, ny */
function grid(lat, lon) {
  var RE = 6371.00877, GRID = 5.0, SLAT1 = 30.0, SLAT2 = 60.0, OLON = 126.0, OLAT = 38.0, XO = 43, YO = 136, D = Math.PI / 180;
  var re = RE / GRID, s1 = SLAT1 * D, s2 = SLAT2 * D, ol = OLON * D, oa = OLAT * D;
  var sn = Math.log(Math.cos(s1) / Math.cos(s2)) / Math.log(Math.tan(Math.PI * 0.25 + s2 * 0.5) / Math.tan(Math.PI * 0.25 + s1 * 0.5));
  var sf = Math.pow(Math.tan(Math.PI * 0.25 + s1 * 0.5), sn) * Math.cos(s1) / sn;
  var ro = re * sf / Math.pow(Math.tan(Math.PI * 0.25 + oa * 0.5), sn);
  var ra = re * sf / Math.pow(Math.tan(Math.PI * 0.25 + lat * D * 0.5), sn);
  var th = lon * D - ol; if (th > Math.PI) th -= 2 * Math.PI; if (th < -Math.PI) th += 2 * Math.PI; th *= sn;
  return { nx: Math.floor(ra * Math.sin(th) + XO + 0.5), ny: Math.floor(ro - ra * Math.cos(th) + YO + 0.5) };
}
function kst(ms) { var d = new Date(ms + 9 * 3600 * 1000); return { ymd: d.toISOString().slice(0, 10).replace(/-/g, ''), h: d.getUTCHours(), m: d.getUTCMinutes() }; }
function pad(n) { return (n < 10 ? '0' : '') + n; }
function keyOf() { var raw = String(process.env.KMA_KEY || '').trim(); if (!raw) return ''; try { if (/%/.test(raw)) raw = decodeURIComponent(raw); } catch (e) { /* 그대로 */ } return encodeURIComponent(raw); }
async function call(op, q, key) {
  var url = BASE + op + '?serviceKey=' + key + '&pageNo=1&numOfRows=' + q.rows + '&dataType=JSON&base_date=' + q.date + '&base_time=' + q.time + '&nx=' + q.nx + '&ny=' + q.ny;
  var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 4500);
  try {
    var r = await fetch(url, { signal: ctl.signal }); var txt = await r.text(), j;
    try { j = JSON.parse(txt); } catch (e) { throw new Error('응답 형식 오류(열쇠 승인 전이거나 잘못된 열쇠일 수 있어요)'); }
    var h = j && j.response && j.response.header;
    if (!h || h.resultCode !== '00') throw new Error('기상청 응답 ' + (h ? h.resultCode + ' ' + h.resultMsg : '없음'));
    var it = j.response.body && j.response.body.items && j.response.body.items.item; return it || [];
  } finally { clearTimeout(t); }
}
var PTY = { 1: '비', 2: '비/눈', 3: '눈', 5: '빗방울', 6: '빗방울·눈날림', 7: '눈날림' }, SKY = { 1: '맑음', 3: '구름 많음', 4: '흐림' };
async function build() {
  var key = keyOf(); if (!key) throw new Error('KMA_KEY 없음');
  var g = grid(LAT, LON), now = Date.now(), a = kst(now - 10 * 60000), f = kst(now - 45 * 60000);
  var ncstTime = pad(a.h) + '00', fcstTime = pad(f.h) + '30';
  var rs = await Promise.all([
    call('getUltraSrtNcst', { date: a.ymd, time: ncstTime, nx: g.nx, ny: g.ny, rows: 20 }, key),
    call('getUltraSrtFcst', { date: f.ymd, time: fcstTime, nx: g.nx, ny: g.ny, rows: 60 }, key).catch(function () { return []; }) // 하늘 상태만 못 받아도 나머지는 보여 준다
  ]);
  var v = {}; rs[0].forEach(function (x) { v[x.category] = x.obsrValue; });
  if (v.T1H == null) throw new Error('실황 값 없음');
  var temp = parseFloat(v.T1H), pty = parseInt(v.PTY, 10) || 0, wind = parseFloat(v.WSD) || 0, rn = String(v.RN1 == null ? '' : v.RN1).replace(/[^0-9.]/g, ''), rain1h = rn ? parseFloat(rn) : 0;
  var sky = 0, skyRows = rs[1].filter(function (x) { return x.category === 'SKY'; }).sort(function (p, q) { return (p.fcstDate + p.fcstTime) < (q.fcstDate + q.fcstTime) ? -1 : 1; });
  if (skyRows.length) sky = parseInt(skyRows[0].fcstValue, 10) || 0;
  var text = pty > 0 ? (rain1h >= 15 ? '강한 비' : (PTY[pty] || '비')) : (SKY[sky] || '');
  return { temp: temp, sky: sky || 4, pty: pty, text: text, wind: wind, rain1h: rain1h, baseTime: ncstTime, nx: g.nx, ny: g.ny };
}
module.exports = async function handler(req, res) {
  var origin = req.headers.origin || '';
  if (ALLOW.indexOf(origin) >= 0) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  res.setHeader('Cache-Control', 'no-store');
  if (cache && Date.now() - cache.t < 5 * 60000) { res.statusCode = 200; res.setHeader('content-type', 'application/json; charset=utf-8'); res.end(JSON.stringify(cache.v)); return; }
  try { var v = await build(); cache = { t: Date.now(), v: v }; res.statusCode = 200; res.setHeader('content-type', 'application/json; charset=utf-8'); res.end(JSON.stringify(v)); }
  catch (e) { res.statusCode = 200; res.setHeader('content-type', 'application/json; charset=utf-8'); res.end(JSON.stringify({ error: String(e && e.message || e).slice(0, 120) })); } // 열쇠는 응답에 넣지 않는다
};
module.exports.grid = grid;
