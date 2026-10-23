/* 도째비 길동무 — 날짜별 날씨 예보 중계 함수 (Vercel). 열쇠는 환경변수 KMA_KEY(weather.js 와 같은 것)에만 둔다.
 * 기상청 단기예보(getVilageFcst, 오늘~모레쯤)를 동해시청 격자로 받아 날짜별로 줄여서 돌려준다.
 * GET → { days: { 'YYYY-MM-DD': { tmin, tmax, pop, sky, pty, text } }, base: 'YYYYMMDD HHMM' } / 실패하면 { error }
 * 같은 값을 30분 동안 다시 쓴다. */
var ALLOW = (process.env.ALLOW_ORIGINS || 'https://akklnew1-rgb.github.io,https://dojjaebi-gildongmu.vercel.app,https://test1-tour-design.vercel.app,http://localhost:8765').split(',');
var LAT = 37.5247, LON = 129.1143;
var BASE = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst';
var cache = null;
var grid = require('./weather.js').grid;
function kst(ms) { var d = new Date(ms + 9 * 3600 * 1000); return { ymd: d.toISOString().slice(0, 10).replace(/-/g, ''), h: d.getUTCHours(), m: d.getUTCMinutes() }; }
function pad(n) { return (n < 10 ? '0' : '') + n; }
function keyOf() { var raw = String(process.env.KMA_KEY || '').trim(); if (!raw) return ''; try { if (/%/.test(raw)) raw = decodeURIComponent(raw); } catch (e) { /* 그대로 */ } return encodeURIComponent(raw); }
var SKY = { 1: '맑음', 3: '구름 많음', 4: '흐림' }, PTY = { 1: '비', 2: '비/눈', 3: '눈', 4: '소나기' };
async function build() {
  var key = keyOf(); if (!key) throw new Error('KMA_KEY 없음');
  var g = grid(LAT, LON), t = kst(Date.now() - 20 * 60000), bases = [2, 5, 8, 11, 14, 17, 20, 23], bh = -1, i, bd = t.ymd;
  for (i = 0; i < bases.length; i++) if (bases[i] <= t.h) bh = bases[i];
  if (bh < 0) { bd = kst(Date.now() - 20 * 60000 - 24 * 3600000).ymd; bh = 23; } // 0~2시 사이면 어제 23시 발표분
  var url = BASE + '?serviceKey=' + key + '&pageNo=1&numOfRows=1200&dataType=JSON&base_date=' + bd + '&base_time=' + pad(bh) + '00&nx=' + g.nx + '&ny=' + g.ny;
  var ctl = new AbortController(), tm = setTimeout(function () { ctl.abort(); }, 9000), items;
  try {
    var r = await fetch(url, { signal: ctl.signal }), txt = await r.text(), j;
    try { j = JSON.parse(txt); } catch (e) { throw new Error('응답 형식 오류(열쇠 승인 전이거나 잘못된 열쇠일 수 있어요)'); }
    var h = j && j.response && j.response.header;
    if (!h || h.resultCode !== '00') throw new Error('기상청 응답 ' + (h ? h.resultCode + ' ' + h.resultMsg : '없음'));
    items = (j.response.body && j.response.body.items && j.response.body.items.item) || [];
  } finally { clearTimeout(tm); }
  var days = {};
  items.forEach(function (x) {
    var d = x.fcstDate, iso = d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6), o = days[iso] || (days[iso] = { tmp: [], pop: [], sky: [], pty: [], tmn: null, tmx: null }), v = parseFloat(x.fcstValue), hr = parseInt(x.fcstTime, 10) / 100;
    if (x.category === 'TMP') o.tmp.push(v); else if (x.category === 'TMN') o.tmn = v; else if (x.category === 'TMX') o.tmx = v;
    else if (x.category === 'POP') o.pop.push(v);
    else if (x.category === 'SKY' && hr >= 8 && hr <= 20) o.sky.push(v);
    else if (x.category === 'PTY' && hr >= 8 && hr <= 20) o.pty.push(v);
  });
  var out = {};
  Object.keys(days).forEach(function (iso) {
    var o = days[iso]; if (!o.tmp.length) return;
    var tmin = o.tmn != null ? o.tmn : Math.min.apply(null, o.tmp), tmax = o.tmx != null ? o.tmx : Math.max.apply(null, o.tmp);
    var pop = o.pop.length ? Math.max.apply(null, o.pop) : null, pty = o.pty.reduce(function (a, b) { return b > a ? b : a; }, 0);
    var sky = 0; if (o.sky.length) { var c = {}; o.sky.forEach(function (s) { c[s] = (c[s] || 0) + 1; }); sky = +Object.keys(c).sort(function (a, b) { return c[b] - c[a]; })[0]; }
    out[iso] = { tmin: Math.round(tmin), tmax: Math.round(tmax), pop: pop, sky: sky, pty: pty, text: pty > 0 ? (PTY[pty] || '비') : (SKY[sky] || ''), partial: o.tmp.length < 20 };
  });
  return { days: out, base: bd + ' ' + pad(bh) + '00' };
}
module.exports = async function handler(req, res) {
  var origin = req.headers.origin || '';
  if (ALLOW.indexOf(origin) >= 0) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('content-type', 'application/json; charset=utf-8'); res.statusCode = 200;
  if (cache && Date.now() - cache.t < 30 * 60000) { res.end(JSON.stringify(cache.v)); return; }
  try { var v = await build(); cache = { t: Date.now(), v: v }; res.end(JSON.stringify(v)); }
  catch (e) { res.end(JSON.stringify({ error: String(e && e.message || e).slice(0, 120) })); } // 열쇠는 응답에 넣지 않는다
};
