/* 코스 계산기 — 실제 계산(거리·시간·운영시간·제약). 인공지능 없이 규칙으로 동작하며 브라우저·Node 양쪽에서 쓴다. */
(function (root) {
  'use strict';

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function toMin(s) { var p = String(s).split(':'); return (+p[0]) * 60 + (+p[1]); }
  function fmt(m) {
    m = Math.round(m);
    var day = '';
    if (m >= 1440) { day = '내일 '; m -= 1440; }
    return day + pad(Math.floor(m / 60)) + ':' + pad(m % 60);
  }
  function hav(a, b) {
    var R = 6371, r = function (x) { return x * Math.PI / 180; };
    var dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  /*
   * 두 곳 사이 이동. 미리 받아 둔 실제 길(routes = ROUTES.pairs, 길수집.mjs)이 있으면 그 값을, 없으면 예전 어림(직선거리 x1.3, 도보 4km/h·느리게 3km/h)을 쓴다.
   *  - 걷기: 보통은 walk(BROAD_FIRST), 느리게(부모님·무릎)는 walkAccessible(ACCESSIBLE) 시간 x 4/3.
   *    (카카오 걷기 시간은 보통 걸음 기준이라, 예전 어림에서 보통 4km/h → 느리게 3km/h 로 바꾸던 비율 4/3 을 그대로 적용한다.)
   *  - 걷는 시간이 보통 30분, 느리게(부모님·무릎, 이미 x 4/3 한 값) 15분을 넘으면: 대중교통(실제 길)이 있고 택시보다 짧으면 버스, 아니면 택시.
   *    택시 = 카카오 자동차 길찾기 시간(drive) + 호출 5분. 그 값이 없으면 예전 어림(6분 + 시속 45km). (2026-10-17: 20분 → 30분/15분. 묵호역→논골담길 21분은 걸어서.)
   *    예전에는 먼 곳(far)이면 무조건 차를 탔지만, 이제는 걷는 시간만 본다(추암 촛대바위↔추암해변처럼 붙어 있는 곳은 걸어서).
   *  - 길이 없는 쌍은 예전 어림 그대로(fallback).
   * 돌려주는 값: min · mode('walk'|'bus'|'taxi') · walk(걷기 분) · km · real(실제 길 값을 썼나) · text(화면용 한 줄) · path([[경도,위도]…] a→b, 있으면) · fare · transfers
   */
  var SLOW_K = 4 / 3, WALK_MAX = 30, WALK_MAX_SLOW = 15;
  var FAR_REGIONS = ['망상·대진', '추암·북평', '삼화'], FAR_WINDOW = 330, LONG_WINDOW = 450;
  function findPair(routes, a, b) {
    if (!routes || !a || !b || !a.id || !b.id) return null;
    var r = routes[a.id + '|' + b.id];
    if (r) return { rec: r, rev: false };
    r = routes[b.id + '|' + a.id];
    return r ? { rec: r, rev: true } : null;
  }
  function pathOf(x, rev) { if (!x || !x.path) return null; return rev ? x.path.slice().reverse() : x.path; }
  /* opt: { car: 자가용 이동(걷기 10분 이내는 걸어서, 아니면 자동차 시간 + 주차 5분), walkMax: 걷기 허용 분(아이 20분) } */
  var CAR_WALK_MAX = 10, PARK_MIN = 5;
  function leg(a, b, slow, routes, opt) {
    opt = opt || {};
    var km = hav(a, b) * 1.3;
    var walkOld = km / (slow ? 3 : 4) * 60;
    var taxi = Math.ceil(6 + km / 45 * 60);
    var pr = findPair(routes, a, b);
    var dr = pr ? pr.rec.drive : null;
    if (dr) taxi = Math.ceil(5 + dr.sec / 60);
    var w = pr ? (slow ? (pr.rec.walkAccessible || pr.rec.walk) : pr.rec.walk) : null;
    var tr = pr ? pr.rec.transit : null;
    var walkMin = w ? Math.ceil(w.sec / 60 * (slow ? SLOW_K : 1)) : Math.ceil(walkOld);
    if (opt.car) {
      if (walkMin <= CAR_WALK_MAX) return { min: walkMin, mode: 'walk', walk: walkMin, km: w ? w.m / 1000 : km, real: !!w, text: '걸어서 ' + walkMin + '분' + (w ? '(실제 길)' : '(어림)'), path: w ? pathOf(w, pr.rev) : null };
      var carMin = dr ? Math.ceil(dr.sec / 60) + PARK_MIN : Math.ceil(3 + km / 40 * 60) + PARK_MIN;
      return { min: carMin, mode: 'car', walk: walkMin, km: dr ? dr.m / 1000 : km, real: !!dr, text: '자가용 약 ' + carMin + '분(주차 ' + PARK_MIN + '분 포함' + (dr ? ', 실제 길)' : ', 어림)'), path: dr ? pathOf(dr, pr.rev) : null };
    }
    var wmax = opt.walkMax || (slow ? WALK_MAX_SLOW : WALK_MAX);
    // opt.forceTaxi: 코스를 직접 고칠 때 "택시로 바꾸기" — 걷기·버스를 건너뛰고 택시로 계산
    if (!opt.forceTaxi && walkMin <= wmax) {
      return { min: walkMin, mode: 'walk', walk: walkMin, km: w ? w.m / 1000 : km, real: !!w, text: '걸어서 ' + walkMin + '분' + (w ? '(실제 길)' : '(어림)'), path: w ? pathOf(w, pr.rev) : null, taxi: taxi };
    }
    var trMin = tr ? Math.ceil(tr.sec / 60) : 0;
    if (!opt.forceTaxi && tr && trMin < taxi) {
      return { min: trMin, mode: 'bus', walk: walkMin, km: tr.m / 1000, real: true, text: String(tr.summary).replace(' · ', ' ' + trMin + '분 · '), path: pathOf(tr, pr.rev), fare: tr.fare, transfers: tr.transfers, taxi: taxi };
    }
    if (dr) return { min: taxi, mode: 'taxi', walk: walkMin, km: dr.m / 1000, real: true, text: '택시 약 ' + taxi + '분(실제 길)', path: pathOf(dr, pr.rev), taxi: taxi };
    return { min: taxi, mode: 'taxi', walk: walkMin, km: km, real: false, text: '택시 약 ' + taxi + '분(어림)', path: null, taxi: taxi };
  }

  /* 날짜 'YYYY-MM-DD' → { y, m, d, dow(0=일) }. 날짜가 없거나 읽을 수 없으면 null. */
  function dateInfo(s) {
    var mt = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(s || ''));
    if (!mt) return null;
    var y = +mt[1], mo = +mt[2], d = +mt[3], dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return { y: y, m: mo, d: d, dow: dt.getUTCDay(), iso: s };
  }
  function isoOf(dt) { return dt.getUTCFullYear() + '-' + pad(dt.getUTCMonth() + 1) + '-' + pad(dt.getUTCDate()); }
  function addDays(s, n) { var i = dateInfo(s); if (!i) return null; return isoOf(new Date(Date.UTC(i.y, i.m - 1, i.d + n))); }
  /* 날짜 끝자리가 digits(예 [3,8]) 중 하나인 날인가. 날짜를 모르면 false. */
  function lastDigitDay(s, digits) { var i = dateInfo(s); return !!i && digits.indexOf(i.d % 10) >= 0; }
  /* s 를 포함해 가장 가까운 장날(끝자리 3·8). 날짜를 모르면 null. */
  function nextMarketDay(s, digits) {
    digits = digits || [3, 8];
    if (!dateInfo(s)) return null;
    for (var k = 0; k < 11; k++) { var t = addDays(s, k); if (lastDigitDay(t, digits)) return t; }
    return null;
  }
  var DOW_KO = ['일', '월', '화', '수', '목', '금', '토'];
  function dateLabel(s) { var i = dateInfo(s); return i ? i.m + '월 ' + i.d + '일(' + DOW_KO[i.dow] + ')' : ''; }

  /* ---------- 동해시티투어버스 (2026-10-17) — 자료 citytour.js(window.CITYTOUR, citytour수집.mjs) ----------
   * 순환형 1일권. 정류장 0~11 + 끝(12 = 묵호역 도착). 1~7회차 시간표(null = 안 섬).
   * tourDay(ct, 'YYYY-MM-DD') → { ok, why, name }   운행일: 기간 안 + (토·일 또는 공휴일)
   * tourNextDay(ct, 'YYYY-MM-DD') → 그날(포함) 이후 첫 운행일 'YYYY-MM-DD' | null
   * tourLeg(ct, a, b, t, slow) → a(장소/역)에서 t분에 출발해 b 로 가는 가장 빨리 닿는 시티투어 이동 | null
   *   걸어서 정류장 → 다음 출발 기다림 → 타고 → 내려서 걸어서. 같은 정류장끼리(타지 않아도 되는 곳)는 null. 한 바퀴를 돌아 묵호역에서 갈아타는 경우도 본다(wrap).
   */
  function ctIndex(ct) {
    if (!ct) return null;
    if (ct.__ix) return ct.__ix;
    var ix = { byPlace: {}, T: [], N: 13 };
    ct.stops.forEach(function (s) {
      ix.T[s.i] = (s.times || []).map(function (x) { return x == null ? null : toMin(x); });
      (s.links || []).forEach(function (l) { (ix.byPlace[l.place] = ix.byPlace[l.place] || []).push({ stop: s, rec: l }); });
    });
    ix.T[12] = (ct.endTimes || []).map(function (x) { return x == null ? null : toMin(x); });
    try { Object.defineProperty(ct, '__ix', { value: ix, enumerable: false }); } catch (e) { ct.__ix = ix; }
    return ix;
  }
  function holidayName(ct, iso) {
    var l = (ct && ct.holidays && ct.holidays.list) || [];
    for (var i = 0; i < l.length; i++) if (l[i].date === iso) return l[i].name;
    return '';
  }
  function tourDay(ct, iso) {
    var d = dateInfo(iso);
    if (!ct || !d) return { ok: false, why: '날짜를 몰라요' };
    if (iso < ct.period.from || iso > ct.period.to) return { ok: false, why: iso < ct.period.from ? '아직 운행 전' : '운행 기간이 끝남' };
    if (d.dow === 6 || d.dow === 0) return { ok: true, why: d.dow === 6 ? '토요일' : '일요일' };
    var h = holidayName(ct, iso);
    if (h) { var un = !(ct.holidays && ct.holidays.confirmed === true); return { ok: true, why: '공휴일(' + h + (un ? ', 확인필요' : '') + ')', name: h, unconfirmed: un }; } // 손으로 적은 공휴일 목록은 확인필요
    return { ok: false, why: '평일' };
  }
  function tourNextDay(ct, iso) {
    if (!ct || !dateInfo(iso)) return null;
    var start = iso < ct.period.from ? ct.period.from : iso;
    for (var k = 0; k < 400; k++) { var t = addDays(start, k); if (t > ct.period.to) return null; if (tourDay(ct, t).ok) return t; }
    return null;
  }
  function tourWalk(rec, slow) {
    var w = slow ? (rec.walkAccessible || rec.walk) : rec.walk;
    return w ? Math.max(1, Math.ceil(w.sec / 60 * (slow ? SLOW_K : 1))) : Math.max(1, Math.ceil(rec.m * 1.3 / 1000 / (slow ? 3 : 4) * 60));
  }
  function tourWalkPath(rec, slow, fromStop) { // 정류장→장소 길을 fromStop 이면 그대로, 아니면 뒤집어
    var w = slow ? (rec.walkAccessible || rec.walk) : rec.walk;
    if (!w || !w.path || w.path.length < 2) return null;
    return fromStop ? w.path : w.path.slice().reverse();
  }
  function pt2(ct, i) { var s = ct.stops[i === 12 ? 0 : i]; return [s.lng, s.lat]; }
  function stopName(ct, i) { return i === 12 ? '묵호역' : ct.stops[i].short; }
  function tourLeg(ct, a, b, t, slow) {
    var ix = ctIndex(ct); if (!ix || !a || !b || a.id === b.id) return null;
    var la = ix.byPlace[a.id], lb = ix.byPlace[b.id]; if (!la || !lb) return null;
    var best = null;
    la.forEach(function (A) {
      var i = A.stop.i, wA = tourWalk(A.rec, slow), at0 = t + wA;
      lb.forEach(function (B) {
        var j0 = B.stop.i, wB = tourWalk(B.rec, slow);
        if (j0 === i) return;
        var cand = []; // 가능한 [타는 시각, 내리는 시각, 갈아타기?]
        var j = j0 === 0 ? 12 : j0;
        var runs = Math.max(ix.T[i].length, 7), r;
        if (j > i) { // 한 번 타기
          for (r = 0; r < runs; r++) { var dp = ix.T[i][r], ar = ix.T[j][r]; if (dp != null && ar != null && dp >= at0 && ar > dp) cand.push({ dep: dp, arr: ar, run: r + 1 }); }
        } else if (j0 !== 0) { // 한 바퀴 넘어가기: i → 묵호역(도착) 내려서 → 다음 회차를 묵호역에서 타고 j
          for (r = 0; r < runs; r++) {
            var d1 = ix.T[i][r], e1 = ix.T[12][r]; if (d1 == null || e1 == null || d1 < at0) continue;
            for (var r2 = 0; r2 < runs; r2++) { var d2 = ix.T[0][r2], a2 = ix.T[j0][r2]; if (d2 != null && a2 != null && d2 >= e1 && a2 > d2) cand.push({ dep: d1, arr: a2, run: r + 1, wrap: { endAt: e1, dep2: d2, run2: r2 + 1 } }); }
          }
        }
        cand.forEach(function (c) {
          var arriveB = c.arr + wB;
          if (!best || arriveB < best.arrive || (arriveB === best.arrive && wA + wB < best.walkA + best.walkB)) {
            best = { arrive: arriveB, dep: c.dep, arr: c.arr, run: c.run, wrap: c.wrap || null, i: i, j: j, j0: j0, walkA: wA, walkB: wB, wait: c.dep - at0, A: A, B: B };
          }
        });
      });
    });
    if (!best) return null;
    var nm = stopName(ct, best.i), nj = stopName(ct, best.j0 === 0 ? 12 : best.j0);
    var ride = best.arr - best.dep;
    var text;
    if (best.wrap) {
      text = '시티투어 ' + best.run + '회차 ' + fmt(best.dep) + ' ' + nm + ' 탑승 → ' + fmt(best.wrap.endAt) + ' 묵호역 하차 → ' + best.wrap.run2 + '회차 ' + fmt(best.wrap.dep2) + ' 탑승 → ' + fmt(best.arr) + ' ' + nj + ' 하차';
    } else {
      text = '시티투어 ' + best.run + '회차 ' + fmt(best.dep) + ' ' + nm + ' 탑승 → ' + fmt(best.arr) + ' ' + nj + ' 하차';
    }
    text += ' (걸어서 ' + best.walkA + '분 · 기다림 ' + best.wait + '분 · 버스 ' + ride + '분 · 걸어서 ' + best.walkB + '분)';
    // 지도 길: 걷기(장소→정류장) · 버스(정류장들을 잇는 선) · 걷기(정류장→장소)
    var pa = tourWalkPath(best.A.rec, slow, false), pb = tourWalkPath(best.B.rec, slow, true);
    var rp = [], k;
    if (best.wrap) { for (k = best.i; k <= 11; k++) rp.push(pt2(ct, k)); rp.push(pt2(ct, 12)); for (k = 0; k <= best.j0; k++) rp.push(pt2(ct, k)); }
    else for (k = best.i; k <= best.j; k++) rp.push(pt2(ct, k));
    var segs = [
      pa ? { kind: 'walk', path: pa } : { kind: 'est', path: [[a.lng, a.lat], pt2(ct, best.i)] },
      { kind: 'tour', path: rp },
      pb ? { kind: 'walk', path: pb } : { kind: 'est', path: [pt2(ct, best.j), [b.lng, b.lat]] }
    ];
    var full = []; segs.forEach(function (sg) { full = full.concat(sg.path); });
    return { min: best.arrive - t, arrive: best.arrive, run: best.run, dep: best.dep, arr: best.arr, wrap: best.wrap, boardIdx: best.i, alightIdx: best.j, boardName: nm, alightName: nj, walkA: best.walkA, walkB: best.walkB, wait: best.wait, ride: ride, text: text, path: full, segs: segs,
      stopsUsed: [{ i: best.i, lat: ct.stops[best.i].lat, lng: ct.stops[best.i].lng, name: nm }, { i: best.j, lat: ct.stops[best.j === 12 ? 0 : best.j].lat, lng: ct.stops[best.j === 12 ? 0 : best.j].lng, name: nj }] };
  }
  function tourFareText(ct) {
    var f = ct && ct.fares; if (!f) return '';
    var c = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
    return '시티투어 1일권 ' + c(f.adult) + '원(소인 ' + c(f.child) + '원)';
  }
  /* 날씨 때문에 시티투어가 멈출 수 있는가: 비가 강하게(시간당 10mm 이상) · 눈 · 바람 초속 14m 이상. w = /api/weather 모양 { pty, rain1h, wind } */
  function tourWxCaution(w) {
    if (!w || w.error) return '';
    var heavy = (w.pty > 0 && (+w.rain1h || 0) >= 10) || ((w.pty === 3 && (+w.rain1h || 0) >= 1) || (w.pty === 2 && (+w.rain1h || 0) >= 3)) || (+w.wind || 0) >= 14;
    return heavy ? '악천후엔 운행이 멈출 수 있어요 — 재단 033-532-1945 확인' : '';
  }

  /* 제보 → 효과. 같은 종류·같은 장소 제보가 2건 이상이거나 oneEnough 이면 반영. 붐빔은 제보 뒤 60분(시연 시계)만 유효. */
  function effectsFromReports(reports, simNow, oneEnough) {
    var fx = { closed: {}, crowd: {}, view: {}, news: {}, menu: {}, active: [], pending: [] };
    var groups = {};
    (reports || []).forEach(function (r) {
      if (r.type === 'crowd' && !(simNow < r.simTs + 60)) return; // 붐빔은 60분 뒤 소멸
      var k = r.type + '|' + r.placeId;
      (groups[k] = groups[k] || []).push(r);
    });
    Object.keys(groups).forEach(function (k) {
      var g = groups[k], r0 = g[0];
      var ok = oneEnough || g.length >= 2;
      if (!ok) { fx.pending.push({ type: r0.type, placeId: r0.placeId, count: g.length }); return; }
      var latest = g.reduce(function (a, r) { return Math.max(a, r.simTs); }, -1e9);
      if (r0.type === 'crowd') {
        var delay = g.reduce(function (a, r) { return Math.max(a, r.minutes || 20); }, 0);
        fx.crowd[r0.placeId] = { delay: delay, until: latest + 60 };
        fx.active.push({ type: 'crowd', placeId: r0.placeId, delay: delay, until: latest + 60 });
      } else if (r0.type === 'closed') { fx.closed[r0.placeId] = true; fx.active.push({ type: 'closed', placeId: r0.placeId }); }
      else if (r0.type === 'view') { fx.view[r0.placeId] = true; fx.active.push({ type: 'view', placeId: r0.placeId }); }
      else if (r0.type === 'new') { fx.news[r0.placeId] = true; fx.active.push({ type: 'new', placeId: r0.placeId }); }
      else if (r0.type === 'menu') { // 오늘 메뉴(한 끼): 가장 나중 제보의 글을 보여 준다
        var lastR = g.reduce(function (a, r) { return r.simTs >= a.simTs ? r : a; }, g[0]);
        fx.menu[r0.placeId] = String(lastR.text || '').slice(0, 80);
        fx.active.push({ type: 'menu', placeId: r0.placeId, text: fx.menu[r0.placeId] });
      }
    });
    return fx;
  }

  function placeValue(p, o, fx) {
    var v = p.value || 10;
    (p.tags || []).forEach(function (t) {
      if ((o.interests || []).indexOf(t) >= 0) v += 4;
      if (t === '사진' && (o.interests || []).indexOf('사진') >= 0) v += 0;
    });
    if (o.rain) v += p.indoor ? 6 : -9;
    if (p.slope && o.slow) v -= 2;
    if (fx.view[p.id]) v += 5;
    if (fx.news[p.id]) v += 2;
    if (o.kid) v += p.visit <= 30 ? 3 : (p.visit >= 60 ? -4 : 0); // 아이: 짧게 보는 곳 먼저
    if (o.couple && (p.id === 'skyvalley' || p.id === 'lighthouse' || p.id === 'jeonmangdae' || p.id === 'suibyeon' || (p.tags || []).indexOf('노을') >= 0)) v += 5; // 연인: 노을·전망
    if (p.evening && (o.mode === 'late' || o.mode === 'night' || o.couple)) v += 16; // 막차·1박의 이유: 저녁 야시장 (저녁 한 끼와 함께 들어가도록 값을 높임)
    if (p.id === 'skyvalley' && (o.mode === 'late' || o.mode === 'night' || o.couple)) v += 3;
    return v;
  }

  /* 두 곳 사이 이동 계산기(모든 이동 규칙을 한곳에). plan() 과 코스 고치기(editor.js)가 같은 규칙을 쓰도록 꺼내 둠.
     o: how·backHow·kid·routes·tour·date·citytour·tourPrefer. 돌려주는 값: leg0(a,b,slow) · legAt(a,b,slow,t 분) · legTaxi(a,b,slow) · ct · tday · tix · routes · how/howIn/howOut/carBoth */
  function makeLegger(o) {
    var routes = o.routes === undefined ? (root.ROUTES && root.ROUTES.pairs) || null : (o.routes || null); // o.routes===false 면 길 없이(예전 어림)
    var memo = {};
    var howIn = o.how || 'train', howOut = o.backHow || howIn; // 올 때 / 돌아갈 때 이동수단: 'train' | 'bus' | 'car'
    var carBoth = howIn === 'car' && howOut === 'car'; // 자동차 이동(주차 포함)은 오고 갈 때 모두 자가용일 때만
    var how = carBoth ? 'car' : (howIn === 'car' || howOut === 'car') ? 'mixed' : howIn;
    var legOpt = how === 'car' ? { car: true } : (o.kid ? { walkMax: 20 } : null);
    function leg0(a, b, slow) { var k = a.id + '|' + b.id + (slow ? 's' : 'n'); return memo[k] || (memo[k] = leg(a, b, slow, routes, legOpt)); }
    // 시티투어버스: o.tour 가 참이고(자가용 아님) 여행 날짜가 운행일일 때만. 걸어서 갈 만한 거리는 그대로 걷고, 걷기엔 먼 구간만 택시 어림 + 10분 이내(o.tourPrefer 면 더 느슨하게)일 때 탄다.
    var ct = (o.tour && !carBoth && o.date) ? (o.citytour === undefined ? (root.CITYTOUR || null) : (o.citytour || null)) : null;
    var tday = ct ? tourDay(ct, o.date) : { ok: false };
    var tix = tday.ok ? ctIndex(ct) : null;
    var tmemo = {};
    function legAt(a, b, slow, t) {
      var base = leg0(a, b, slow);
      if (!tix || base.mode === 'walk' || base.mode === 'car') return base;
      var k = a.id + '|' + b.id + (slow ? 's' : 'n') + '@' + Math.round(t), hit = tmemo[k];
      if (hit !== undefined) return hit || base;
      var tl = tourLeg(ct, a, b, t, slow), r = null;
      if (tl) {
        var lim = (base.taxi != null ? base.taxi : base.min) + 10;
        if (tl.min <= lim || (o.tourPrefer && tl.wait <= 45 && tl.ride <= 60 && tl.min <= lim + 50)) r = { min: tl.min, mode: 'tour', walk: base.walk, km: base.km, real: true, text: tl.text, path: tl.path, tour: tl, taxi: base.taxi };
      }
      tmemo[k] = r;
      return r || base;
    }
    function legTaxi(a, b, slow) { return leg(a, b, slow, routes, { forceTaxi: true }); }
    return { routes: routes, howIn: howIn, howOut: howOut, carBoth: carBoth, how: how, legOpt: legOpt, leg0: leg0, legAt: legAt, legTaxi: legTaxi, ct: ct, tday: tday, tix: tix };
  }

  /* ---------- 끼니 시간 슬롯 (2026-10-18) — 코스에는 특정 식당을 넣지 않는다. 점심·저녁(·아침) '시간'만 잡고, 자리는 앞 장소 근처(자리 중립).
     슬롯 = stops 의 kind:'meal' 장, place 는 { slot:true, id:'meal_lunch_<날짜>', base: 앞 장소(실제 길 계산용), lat/lng: 앞 장소와 같음 } */
  var SLOT_NAME = { breakfast: '아침', lunch: '점심', dinner: '저녁' }, SLOT_VISIT = { breakfast: 40, lunch: 50, dinner: 60 };
  var SLOT_LEG = { min: 0, mode: 'walk', walk: 0, km: 0, real: false, text: '', path: null };
  function isSlotId(id) { return typeof id === 'string' && id.indexOf('meal_') === 0; }
  function slotKindOf(id) { var m = /^meal_(breakfast|lunch|dinner)/.exec(String(id || '')); return m ? m[1] : null; }
  function realPos(p) { return p && p.slot ? (p.base || p) : p; }
  function slotPlace(id, near) {
    var kind = slotKindOf(id) || 'lunch', b = realPos(near) || null, nm = SLOT_NAME[kind];
    return { id: id, slot: true, mealKind: kind, base: b, name: nm + ' 시간', short: nm, lat: b ? b.lat : null, lng: b ? b.lng : null, open: [0, 1440], visit: SLOT_VISIT[kind], indoor: true, stairs: false, slope: false, kind: 'meal', tags: [], value: 0, region: '', openText: '', qa: [], story: '' };
  }
  function slotId(kind, date) { return 'meal_' + kind + (date ? '_' + date : ''); }

  /*
   * plan(D, o)
   *  o.how 'train'(기본)|'bus'|'car' · o.start/o.end 점 이름(mukho·donghae·bus·park, 안 주면 how 에 따라) · o.train = 돌아갈 기차·버스 출발(분) 또는 자가용이면 주차장에 돌아올 시각 · o.kid 아이(걷기 20분, 짧은 곳 먼저) · o.couple 연인(노을·전망·야시장)
   *  o.now        출발 시각(분)         o.train  돌아갈 기차(분)      o.end 'mukho'|'donghae'
   *  o.slow       느리게 걷기(3km/h)    o.avoidStairs 계단 있는 곳 뺌   o.rain 비
   *  o.interests  ['사진','먹거리']     o.fx     effectsFromReports 결과
   *  o.routes     미리 받은 실제 길(ROUTES.pairs). 안 주면 window.ROUTES 가 있을 때 그걸 쓰고, false 면 예전 어림만
   *  o.mode       'normal'|'late'|'night' (night: 오늘은 숙소 앞까지, 내일 추암 일출을 마지막 장으로)
   *  o.fixed      이미 도착한 장(앞에서 계산된 stops 일부) — 그 뒤부터만 다시 계산
   *  o.date       여행 날짜 'YYYY-MM-DD' — 장날(dayRule: 북평민속오일장은 끝자리 3·8일만)과 쉬는 요일(closedDow)을 따진다. 없으면 장날 전용 곳은 빼고 쉬는 요일은 따지지 않는다.
   *  o.buffer     기차 전 여유(기본 15분)  o.max 최대 곳 수(기본 5)
   *  o.foodWord   (예전 값: 이제 특정 식당을 고르지 않으므로 쓰지 않는다)
   *  o.food       밥을 먹고 싶다고 말함(말에 먹·맛집·물회·밥·식사·배고)  o.soft 부드러운 음식 우선(기본: o.slow 와 같음)  o.meal===false 면 한 끼 안 넣음
   *  끼니 시간 슬롯: 식당이 아니라 '점심/저녁 시간'을 stops 에 kind:'meal' 로 한 번 넣는다(앞 장소 근처, 자리 중립. 점심 11:30~13:30·저녁 17:30~19:30 과 코스 시간이 60분 이상 겹치거나 o.food).
   *            끼니 때 안에 시작(점심 11:00~13:30 · 저녁 17:00~19:30, o.food 면 10:00~19:30)하고, 기차 15분 전 도착은 그대로 지킨다. 들어갈 틈이 없으면 넣지 않는다.
   */
  function plan(D, o) {
    var LG = makeLegger(o);
    var routes = LG.routes, howIn = LG.howIn, howOut = LG.howOut, carBoth = LG.carBoth, how = LG.how, leg0 = LG.leg0, legAt = LG.legAt, ct = LG.ct, tday = LG.tday, tix = LG.tix;
    var TOUR_BONUS = 2, TOUR_MAXB = o.tourPrefer ? 60 : 2;
    // 시티투어로 한 바퀴(o.tourPrefer): 오래 타는(= 먼 곳을 잇는) 구간일수록 가산. 평소(o.tour 만)에는 아주 조금만.
    function tourBonus(l) { if (l.mode !== 'tour') return 0; return o.tourPrefer ? 6 + Math.min(l.tour.ride, 45) * 1.2 : TOUR_BONUS; }
    var fx = o.fx || { closed: {}, crowd: {}, view: {}, news: {}, menu: {}, active: [], pending: [] };
    var buffer = o.buffer == null ? (howOut === 'car' ? 0 : 15) : o.buffer; // 기차·버스는 출발 15분 전, 자가용은 정한 시각까지 주차장에
    var maxStops = o.max || (o.mode === "late" || o.mode === "night" ? 7 : 5);
    var mode = o.mode || 'normal';
    var stId = function (h) { return h === 'bus' ? 'bus' : h === 'car' ? 'park' : 'mukho'; };
    var start = o.startStation || D.stations[o.start || stId(howIn)];
    var endSt = o.endStation || D.stations[o.end || stId(howOut)];
    var avoidSet = {}; (o.avoid || []).forEach(function (id) { avoidSet[id] = true; });
    // o.must: 고정(📌)한 곳 id 목록(순서 그대로). 반드시 넣고, 서로의 앞뒤 순서는 지키며, 나머지만 빈틈을 채운다. 규칙에 걸려 후보에서 빠질 곳이라도 고정했으면 후보에 둔다(운영시간·마감은 그대로 따짐).
    var vOv = o.visitOv || {}; // o.visitOv: { 장소id: 머무는 분 } — 사용자가 머무는 시간을 고쳐 둔 곳
    var must = (o.must || []).slice(), mustSet = {}; must.forEach(function (id) { mustSet[id] = true; });
    var mustMeal = []; // 식당은 코스에 넣지 않는다
    must = must.filter(function (id) { return !isSlotId(id); }); mustSet = {}; must.forEach(function (id) { mustSet[id] = true; });
    var deadline = mode === 'night' ? 21 * 60 + 30 : o.train - buffer;
    var win0 = (o.fixed && o.fixed.length) ? o.fixed[0].arrive - o.fixed[0].legMin : o.now; // 처음 출발 시각 ("여기 왔어요" 뒤 다시 짤 때도 같게: 고정된 첫 장에서 거꾸로)
    if (!o.max && mode === 'normal' && deadline - win0 >= LONG_WINDOW) maxStops = 6; // 하루가 길면(7시간 30분 이상) 6곳 + 한 끼
    var skipped = [];
    var cands = [];
    var soft = o.soft != null ? !!o.soft : !!o.slow;
    var dinfo = dateInfo(o.date);
    // 관광지 집중률 예측(한국관광공사, 하루 한 값 · 어림): 그날 80 넘는 곳은 오전(14시 전)에 일찍 가도록 점수만 조금 더한다 — 마감·운영시간·다른 규칙은 그대로이고 어떤 곳도 빼지 않는다(부드러운 규칙).
    // o.crowd = { 장소id: 값 } 또는 o.crowdFn(isoDate) → 그 맵. 값이 없으면 아무 일도 없다.
    var crowdMap = o.crowd || (o.crowdFn ? o.crowdFn(dinfo && dinfo.iso) : null) || null;
    var CROWD_BUSY = 80, CROWD_MAXB = 10;
    function crowdBonus(id, startVisit) { var cr = crowdMap && crowdMap[id]; return cr > CROWD_BUSY ? (cr - CROWD_BUSY) * 0.5 * Math.max(0, Math.min(1, (840 - startVisit) / 360)) : 0; }
    // 먼 권역(망상·대진 / 추암·북평 / 삼화)은 코스 전체 시간(처음 출발 ~ 기차 15분 전)이 5시간 30분 이상일 때만 후보. "여기 왔어요" 뒤 다시 짤 때 흔들리지 않게 처음 출발 시각은 고정된 첫 장에서 거꾸로 구한다.
    var farOK = deadline - win0 >= FAR_WINDOW;
    D.places.forEach(function (p) {
      if (o.onlyMust && must.length && !mustSet[p.id]) return; // AI 가 짠 코스: 정한 곳만 후보(시간·마감 계산만 한다)
      if (mustSet[p.id]) { cands.push(p); return; }
      if (avoidSet[p.id]) { skipped.push({ id: p.id, why: '앞 날에 갔어요' }); return; }
      if (FAR_REGIONS.indexOf(p.region) >= 0 && !farOK) { skipped.push({ id: p.id, why: '시간이 모자라 먼 곳은 뺌' }); return; }
      if (o.avoidStairs && p.stairs) { skipped.push({ id: p.id, why: '계단' }); return; }
      if (o.avoidStairs && p.trail) { skipped.push({ id: p.id, why: '걷는 길이 길어요' }); return; }
      if (tix && o.tourPrefer && !(tix.byPlace[p.id] || []).some(function (x) { return tourWalk(x.rec, !!o.slow) <= 15; })) { skipped.push({ id: p.id, why: '시티투어 정류장에서 걸어서 15분이 넘어요' }); return; } // 시티투어로 한 바퀴: 정류장에서 걸어갈 만한 곳만
      if (o.rain && p.rainAvoid) { skipped.push({ id: p.id, why: '비 오는 날 야외' }); return; }
      if (p.dayRule && p.dayRule.lastDigit && !(dinfo && p.dayRule.lastDigit.indexOf(dinfo.d % 10) >= 0)) { skipped.push({ id: p.id, why: dinfo ? '장날이 아님' : '날짜 모름' }); return; }
      if (p.closedDow && dinfo && p.closedDow.indexOf(dinfo.dow) >= 0) { skipped.push({ id: p.id, why: '쉬는 요일' }); return; }
      if (fx.closed[p.id]) { skipped.push({ id: p.id, why: '휴무 제보' }); return; }
      if (mode === 'night' && p.id === 'chuam') { skipped.push({ id: p.id, why: '내일 일출로 남김' }); return; }
      cands.push(p);
    });
    var vals = {};
    cands.forEach(function (p) { vals[p.id] = placeValue(p, o, fx); });
    // 값이 큰 곳부터 살펴보면 좋은 코스를 일찍 찾아 아래 가지치기가 잘 먹힌다(결과는 같고 계산만 빠름)
    cands.sort(function (x, y) { return vals[y.id] - vals[x.id]; });
    var HARD_GROUP = { chuam: 1 }; // 붙어 있는 추암 촛대바위·해변·조각공원은 한 번만 간다
    var GROUP_K = [1, 0.55, 0.35]; // 같은 자리에 붙은 곳(group)은 둘째부터 가치를 깎는다(해변 세 곳을 다 도는 코스 방지)
    var gUsed = {};
    function gk(p) { return p.group ? GROUP_K[Math.min(2, gUsed[p.group] || 0)] : 1; }

    // 이미 도착한 장(o.fixed)은 그대로 두고, 그 다음부터 다시 계산한다
    var fixedSeq = [], usedInit = {}, pos0 = start, t0 = o.now;
    (o.fixed || []).forEach(function (f) {
      fixedSeq.push(Object.assign({}, f, { done: true }));
      usedInit[f.id] = true; pos0 = f.place; t0 = f.leave;
      if (f.place && f.place.group) gUsed[f.place.group] = (gUsed[f.place.group] || 0) + 1;
      if (f.kind === 'meal' && !f.breakfast) usedInit.__meal = true;
    });

    // 끼니 시간 슬롯이 필요한가: 남은 시간이 점심(11:30~13:30)·저녁(17:30~19:30)과 60분 이상 겹치거나 먹고 싶다고 했을 때
    function overlap(a0, a1, b0, b1) { return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0)); }
    var lunchOv = overlap(t0, deadline, 690, 810), dinnerOv = overlap(t0, deadline, 1050, 1170);
    var needMeal = !usedInit.__meal && o.meal !== false && deadline - t0 >= 50 && (!!o.food || lunchOv >= 60 || dinnerOv >= 60); // 남는 시간이 50분 미만이면 넣지 않음
    function mealStartOk(t) {
      if (o.food && t >= 600 && t <= 1170) return true;
      return (lunchOv >= 60 && t >= 660 && t <= 810) || (dinnerOv >= 60 && t >= 1020 && t <= 1170);
    }
    var bothMeals = lunchOv >= 60 && dinnerOv >= 60; // 하루가 길어 점심·저녁이 다 걸리면 한 끼는 점심으로(저녁은 기차 시각에 쫓기기 쉬워서)
    function mealCenterGap(t) { return bothMeals ? Math.abs(t - 750) : Math.min(Math.abs(t - 750), Math.abs(t - 1110)); }
    function mealBandGap(t) { if (bothMeals) return t < 690 ? 690 - t : t > 810 ? t - 810 : 0; return t < 690 ? 690 - t : (t > 810 && t < 1050) ? Math.min(t - 810, 1050 - t) : t > 1170 ? t - 1170 : 0; } // 끼니 때(점심·저녁)에서 벗어난 분
    var MEAL_BONUS = 60, FAR_K = 0.2, MEAL_WAIT = 30;
    if (needMeal) maxStops += 1;
    if (must.length - mustMeal.length > 0) maxStops = Math.max(maxStops, must.length - mustMeal.length + 2);
    function nextMust(used) { for (var i = 0; i < must.length; i++) if (!used[must[i]]) return must[i]; return null; }

    var best = null;
    function consider(seq, t, pos, score, travel) {
      if (must.length) { var have = {}; seq.forEach(function (x) { have[x.id] = 1; }); for (var mi = 0; mi < must.length; mi++) if (!have[must[mi]]) return; } // 고정한 곳을 다 넣은 코스만
      var rpos = realPos(pos), bl = rpos === start && endSt === start ? { min: 0, mode: 'walk', walk: 0, km: 0, text: '', path: null } : legAt(rpos, endSt, o.slow, t);
      var arrive = t + bl.min;
      if (arrive > deadline) return;
      var s = score - travel * 0.03 - farPen(bl.min) - arrive * 0.0001; // 더 일찍 돌아오는 쪽을 아주 조금 선호
      if (!best || s > best.score + 1e-9) best = { score: s, seq: seq.slice(), back: { arrive: arrive, mode: bl.mode, min: bl.min, text: bl.text, path: bl.path, real: !!bl.real, from: rpos, tour: bl.tour || null }, end: t };
    }
    // 먼 이동(12분 넘는 구간)은 넘는 분마다 조금씩 감점 — 가까운 곳으로도 채울 수 있으면 먼 권역은 시간이 넉넉할 때만 들어가게
    function farPen(min) { return min > 12 ? (min - 12) * FAR_K : 0; }
    // 한 번 떠난 권역으로 다시 돌아가는 것(묵호→망상→묵호→천곡→묵호 식으로 왔다갔다)을 막는 감점. 새 권역으로 처음 가는 것(묵호→천곡→삼화처럼 한 방향으로 나아가는 것)은
    // 공짜 — 하루에 먼 권역 여러 곳을 들르는 코스 자체는 그대로 둔다. 다만 "꼭 갈 곳"으로 고정했거나 남는 시간이 넉넉해 값이 충분히 크면 다시 가는 것도 여전히 가능하다
    // (막는 게 아니라 "갔던 곳으로 괜히 되돌아가지 말고 이어서 가깝게" 쏠리게 하는 부드러운 규칙).
    var REGION_RETURN_K = 21;
    function regionPen(seq, region) {
      if (!region || FAR_REGIONS.indexOf(region) < 0) return 0; // 묵호·천곡처럼 가까운 권역으로 돌아가는 것(숙소·야시장 등)은 자연스러우니 그대로
      var last = null, seen = {};
      for (var i = 0; i < seq.length; i++) { var r = seq[i].place && seq[i].place.region; if (r) { seen[r] = true; last = r; } }
      if (region === last || !seen[region]) return 0; // 바로 앞과 같은 권역, 또는 처음 가는 먼 권역이면 그대로
      return REGION_RETURN_K; // 갔다가 떠난 먼 권역(망상·대진 / 추암·북평 / 삼화)으로 되돌아가는 것만 감점
    }
    // 가지치기: 남은 자리를 가장 값 큰 안 간 곳으로 채워도 지금까지의 최고 점수를 못 넘으면 더 안 파고든다(점수 식의 위쪽 한계)
    function bound(seq, t, used, score) {
      var r = maxStops - seq.length, sum = 0;
      for (var i = 0; i < cands.length && r > 0; i++) { var q = cands[i]; if (used[q.id]) continue; var vv = vals[q.id]; if (vv > 0) sum += vv; r--; }
      var b = score + sum * (1 + 0.006 * Math.max(0, deadline - t)) + (tix ? TOUR_MAXB * (maxStops - seq.length + 1) : 0);
      if (needMeal && !used.__meal) b += MEAL_BONUS + 5; // 끼니 시간 가산점의 최대치
      if (crowdMap) b += CROWD_MAXB * (maxStops - seq.length); // 집중률 가산점의 최대치(가지치기가 틀리지 않게)
      return b;
    }
    // 한 걸음에 살펴볼 곳 수(깊을수록 좁게). 점수 식의 한 걸음 몫이 큰 순서로 상위만 파고든다 — 후보가 스무 곳이 넘어도 계산이 순식간에 끝나게
    var BREADTH = [8, 6, 4, 3, 3, 3, 3, 3];
    function dfs(seq, pos, t, used, score, travel) {
      consider(seq, t, pos, score, travel);
      if (seq.length >= maxStops) return;
      if (best && bound(seq, t, used, score) <= best.score + 1e-9) return;
      var opts = [], nm0 = must.length ? nextMust(used) : null;
      for (var i = 0; i < cands.length; i++) {
        var p = cands[i];
        if (used[p.id]) continue;
        if (mustSet[p.id] && p.id !== nm0) continue; // 고정한 곳은 정한 순서대로만
        if (p.group && HARD_GROUP[p.group] && (gUsed[p.group] || 0) >= HARD_GROUP[p.group]) continue; // 같은 권역(추암 세 곳)은 한 곳만
        var l = legAt(realPos(pos), p, o.slow, t);
        var arr = t + l.min, wait = 0;
        if (arr < p.open[0]) { wait = p.open[0] - arr; if (wait > 45) continue; }
        var startVisit = arr + wait;
        var c = fx.crowd[p.id];
        var delay = c && startVisit < c.until ? c.delay : 0;
        var leave = startVisit + delay + (vOv[p.id] != null ? vOv[p.id] : p.visit);
        if (leave > p.open[1] || leave > deadline) continue;
        var vp = vals[p.id] * gk(p);
        // 보고 싶은 곳을 먼저(기차가 늦어져도 좋은 곳은 이미 본 상태): 값 x 남은 시간 비례 가산
        var inc = vp - delay * 0.25 - wait * 0.05 + Math.max(0, vp) * (deadline - leave) * 0.006 - farPen(l.min) - regionPen(seq, p.region) + crowdBonus(p.id, startVisit);
        opts.push({ p: p, l: l, arr: arr, wait: wait, startVisit: startVisit, delay: delay, leave: leave, inc: inc - l.min * 0.03 + tourBonus(l) });
      }
      opts.sort(function (x, y) { return y.inc - x.inc; });
      var nb = BREADTH[Math.min(seq.length - fixedN, BREADTH.length - 1)];
      var forced = nm0 ? opts.filter(function (x) { return x.p.id === nm0; })[0] : null;
      if (opts.length > nb) opts.length = nb;
      if (forced && opts.indexOf(forced) < 0) opts.push(forced); // 고정한 곳은 상위 몇 곳에 못 들어도 반드시 살핀다
      for (var k = 0; k < opts.length; k++) {
        var op = opts[k], p2 = op.p, l2 = op.l;
        used[p2.id] = true;
        if (p2.group) gUsed[p2.group] = (gUsed[p2.group] || 0) + 1;
        seq.push({ id: p2.id, place: p2, legMin: l2.min, mode: l2.mode, moveText: l2.text, path: l2.path, tour: l2.tour || null, real: !!l2.real, fare: l2.fare, transfers: l2.transfers, arrive: op.arr, wait: op.wait, delay: op.delay, startVisit: op.startVisit, leave: op.leave });
        dfs(seq, p2, op.leave, used, score + op.inc + l2.min * 0.03, travel + l2.min);
        seq.pop();
        used[p2.id] = false;
        if (p2.group) gUsed[p2.group]--;
      }
      if (needMeal && !used.__meal) { // 끼니 시간 슬롯: 앞 장소 근처(이동 0분)에서 점심 또는 저녁 한 번
        var kinds = ['lunch', 'dinner'];
        for (var j = 0; j < kinds.length; j++) {
          var kd = kinds[j], sid = slotId(kd, o.date);
          if (used[sid] || avoidSet[sid]) continue;
          var lo = kd === 'lunch' ? (o.food ? 600 : 660) : (o.food ? 900 : 1020), hi = kd === 'lunch' ? (o.food ? 899 : 810) : 1170;
          if (!o.food && kd === 'lunch' && lunchOv < 60) continue;
          if (!o.food && kd === 'dinner' && dinnerOv < 60) continue;
          var sv = Math.max(t, lo), waitE = sv - t;
          if (waitE > MEAL_WAIT || sv > hi) continue;
          var leaveE = sv + (vOv[sid] != null ? vOv[sid] : SLOT_VISIT[kd]);
          if (leaveE > deadline) continue;
          var bonus = MEAL_BONUS - mealBandGap(sv) * 0.5 - mealCenterGap(sv) * 0.08 - waitE * 0.05;
          var sp = slotPlace(sid, pos);
          used.__meal = true; used[sid] = true;
          seq.push({ id: sid, place: sp, kind: 'meal', legMin: 0, mode: 'walk', moveText: '', path: null, tour: null, real: false, arrive: t, wait: waitE, delay: 0, startVisit: sv, leave: leaveE });
          dfs(seq, sp, leaveE, used, score + bonus, travel);
          seq.pop();
          used.__meal = false; used[sid] = false;
        }
      }
    }
    var fixedN = fixedSeq.length;
    dfs(fixedSeq, pos0, t0, usedInit, 0, 0);

    var out = { how: how, howIn: howIn, howOut: howOut, feasible: !!best, stops: [], back: null, deadline: deadline, train: o.train, endStation: endSt, mode: mode, skipped: skipped, start: o.now, startStation: start, slow: !!o.slow, tomorrow: null };
    if (best) {
      out.stops = best.seq;
      out.back = best.back;
      out.score = best.score;
    }
    out.date = dinfo ? dinfo.iso : null;
    // 붐빌 예정이라 아침에 먼저 가도록 앞당겨진 곳 표시: 집중률 없이 짠 코스와 견줘 실제로 일찍 가게 된 곳(30분 이상 앞서거나 새로 들어온 곳)만 — 어림
    if (crowdMap && !o._noCmp && out.stops.some(function (s) { return crowdMap[s.id] > CROWD_BUSY && s.startVisit < 720; })) {
      var b0 = plan(D, Object.assign({}, o, { crowd: null, crowdFn: null, _noCmp: true })), bm = {};
      b0.stops.forEach(function (s) { bm[s.id] = s; });
      out.stops.forEach(function (s) { if (crowdMap[s.id] > CROWD_BUSY && s.startVisit < 720 && !s.done && (!bm[s.id] || bm[s.id].startVisit - s.startVisit >= 30)) s.crowdEarly = true; });
    }
    // 시티투어 요약: 운행일 여부 · 탄 구간 · 1일권은 하루 한 번만
    out.tour = { enabled: !!ct, day: tday, used: false, rides: 0, legs: [], fareText: ct ? tourFareText(ct) : '' };
    out.stops.forEach(function (s) { if (s.mode === 'tour' && s.tour) { out.tour.rides++; out.tour.legs.push(s.id); } });
    if (out.back && out.back.mode === 'tour' && out.back.tour) { out.tour.rides++; out.tour.legs.push('back'); }
    out.tour.used = out.tour.rides > 0;
    out.mealNeeded = needMeal;
    out.meal = out.stops.filter(function (s) { return s.kind === 'meal'; })[0] || null;
    if (mode === 'night') {
      var ch = D.places.filter(function (p) { return p.id === 'chuam'; })[0];
      var sun = toMin(D.sunrise.time) + 1440;
      var l2 = leg0(endSt, ch, false);
      var depart = sun - 30 - l2.min; // 일출 30분 전 도착
      out.tomorrow = { place: ch, depart: depart, arrive: depart + l2.min, sunrise: sun, legMin: l2.min, mode: l2.mode, moveText: l2.text, path: l2.path, real: !!l2.real };
    }
    return out;
  }

  /* ---------- 여러 날 (1박 2일 · 2박 3일) ---------- */
  /* 오는 날~가는 날 일수(1~3). 가는 날이 오는 날 앞이거나 모르면 1, 3일을 넘으면 3. */
  function dayCount(date, backDate) {
    var a = dateInfo(date), b = dateInfo(backDate); if (!a || !b) return 1;
    var n = Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000) + 1;
    return n < 1 ? 1 : n > 3 ? 3 : n;
  }
  function tripLabel(n) { return n <= 1 ? '당일치기' : (n - 1) + '박 ' + n + '일'; }
  /* 날짜별 일출 어림(분): 동해(북위 37.5, 동경 129.1) 태양 위치 공식 — 기상청 값이 아니라 계산한 어림값(확인필요). 날짜를 모르면 D.sunrise 예시 */
  function sunriseApprox(iso) {
    var d = dateInfo(iso); if (!d) return null;
    var N = Math.round((Date.UTC(d.y, d.m - 1, d.d) - Date.UTC(d.y, 0, 0)) / 86400000), rad = Math.PI / 180;
    var decl = 23.44 * Math.sin(2 * Math.PI * (284 + N) / 365) * rad, lat = 37.5 * rad;
    var B = 2 * Math.PI * (N - 81) / 364, eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B); // 분
    var ha = Math.acos((Math.sin(-0.833 * rad) - Math.sin(lat) * Math.sin(decl)) / (Math.cos(lat) * Math.cos(decl))) / rad; // 도
    var noon = 720 - 4 * (129.1 - 135) - eot; // 한국 표준시(동경 135도) 기준 태양 정오(분)
    return Math.round(noon - ha * 4);
  }
  /* 기차 시간표 list(문자열 'HH:MM' 또는 { dep })에서 min(분) 이후(같은 때 포함) 첫 출발. 없으면 null. 앞 시각은 절대 돌려주지 않는다. */
  function nearestDeparture(list, min) {
    var best = null;
    (list || []).forEach(function (x) {
      var t = typeof x === 'string' ? x : x && x.dep; if (!t) return;
      var m = toMin(t); if (m >= min && (!best || m < best.min)) best = { min: m, dep: t, item: x };
    });
    return best;
  }
  var LODGE_BASE_ID = 'stay', DAY_END = 20 * 60 + 30, DAY2_START = 9 * 60;
  var BREAKFAST_BAND = [420, 600];
  /* 첫 아침: 일출을 본 곳(from) 근처에서 아침 먹는 시간 슬롯(식당 아님). 07:00~11:00 사이에 시작 */
  function breakfastStop(D, o, from, t, routes, legOpt) {
    var sv = Math.max(t, BREAKFAST_BAND[0]);
    if (sv > BREAKFAST_BAND[1] + 60) return null;
    var sid = slotId('breakfast', o.date), sp = slotPlace(sid, from);
    return { id: sid, place: sp, kind: 'meal', breakfast: true, legMin: 0, mode: 'walk', moveText: '', path: null, tour: null, real: false, arrive: t, wait: sv - t, delay: 0, startVisit: sv, leave: sv + SLOT_VISIT.breakfast };
  }
  /*
   * planDays(D, o) — 오는 날 ≠ 가는 날일 때 날마다 plan() 을 이어 붙인다.
   *  o.date(오는 날) o.backDate(가는 날) o.now(도착 시각) o.train(가는 날 돌아갈 시각) + plan() 옵션 그대로.
   *  o.stay        숙소 자리 { id:'stay', name, lat, lng, ... } (없으면 묵호역 둘레)
   *  o.sunrise     참이면 둘째 날 새벽 추암 일출로 시작(추암 세 곳은 이날 아침 한 번만 — 첫날에는 뺌), 이어서 아침 한 끼
   *  날마다: 첫날 = 도착 ~ 20:30 숙소 앞 / 가운데 날 = 일출 06시 대 또는 09:00 ~ 20:30 숙소 / 마지막 날 = 아침 ~ 돌아갈 곳(기존 마감 규칙: 기차·버스 15분 전, 자가용은 정한 시각)
   *  앞 날에 간 곳과 같은 권역(추암)은 다시 안 간다(일출 아침만 예외).
   */
  function planDays(D, o) {
    var n = dayCount(o.date, o.backDate);
    if (n <= 1) return plan(D, o);
    var routes = o.routes === undefined ? (root.ROUTES && root.ROUTES.pairs) || null : (o.routes || null);
    var stay = o.stay || { id: LODGE_BASE_ID, name: '묵호역 근처 숙소', lat: D.stations.mukho.lat, lng: D.stations.mukho.lng };
    var howIn = o.how || 'train', carBoth = howIn === 'car' && (o.backHow || howIn) === 'car';
    var dayLegOpt = carBoth ? { car: true } : null; // 둘째 날 새벽 이동도 makeLegger 와 같은 규칙(오고 갈 때 모두 자가용이면 차)
    // 2026-10-22: 일출 장소는 추암 고정이 아니라 동쪽 바다를 보는 곳 중 숙소에서 가장 가까운 곳(묵호에 묵는데 추암까지 가던 문제). 데이터에 일출 표시가 없어 이름 목록으로 어림한다
    var SUN_SPOTS = ['lighthouse', 'nolgol', 'eodal', 'chuam', 'mangsang'], sunSpot = null, sunBest = 1e9;
    SUN_SPOTS.forEach(function (id) { var q = D.places.filter(function (x) { return x.id === id; })[0]; if (!q) return; var lq = leg(stay, q, false, routes, dayLegOpt); if (lq.min < sunBest) { sunBest = lq.min; sunSpot = q; } });
    var chuamCluster = sunSpot ? D.places.filter(function (p) { return p.id === sunSpot.id || (sunSpot.group && p.group === sunSpot.group); }) : [];
    var wantSun = !!o.sunrise && n >= 2 && !o.rain && !!sunSpot && sunBest <= 25; // 숙소에서 25분 넘게 걸리는 곳뿐이면 새벽 일출을 넣지 않는다 // 비 오면 새벽 일출 빼기(앱이 안 막아도 여기서 한 번 더). 동행별 켜고 끄기는 앱이 정한다
    var days = [], avoid = (o.avoid || []).slice(), sunDone = false;
    for (var i = 0; i < n; i++) {
      var last = i === n - 1, date = addDays(o.date, i);
      var base = {}; for (var k in o) base[k] = o[k];
      base.date = date; base.fixed = []; base.max = last ? undefined : 8; base.avoid = avoid.slice(); base.mode = 'normal';
      if (i > 0) { base.startStation = stay; base.start = undefined; base.now = DAY2_START; }
      // 2026-10-21: 자가용으로 오고 갈 때(carBoth) 첫날 아침·마지막 날 저녁까지 "묵호수변공원 주차장"(한 곳 고정)으로 맞춰져 있었음 —
      // 숙소가 망상·천곡 등 다른 권역으로 추천·선택돼도 차는 묵호 쪽 공영 주차장이 아니라 숙소 쪽에 있는 게 자연스러우니, 첫날 시작·마지막 날 도착도 숙소 자리로 맞춤(차 없이 오면 기존대로 역·터미널)
      if (i === 0 && carBoth) { base.startStation = stay; base.start = undefined; }
      if (!last) { base.endStation = stay; base.end = undefined; base.train = DAY_END; base.buffer = 0; base.backHow = carBoth ? 'car' : 'bus'; }
      else if (carBoth) { base.endStation = stay; base.end = undefined; }
      if (i === 0) { base.mode = 'late'; if (wantSun) base.avoid = base.avoid.concat(chuamCluster.map(function (p) { return p.id; })); }
      if (o.mustByDay) { var mb = (o.mustByDay[i] || []).filter(function (id) { return !(wantSun && i <= 1 && chuamCluster.some(function (q) { return q.id === id; })); }); if (mb.length) { base.must = mb; base.onlyMust = true; } } // AI 가 날마다 정한 곳(새벽 일출 자리는 앱이 따로 넣는다)
      var sun = null, brk = null, pl = null;
      if (i === 1 && wantSun && !sunDone) { // 둘째 날 새벽 추암 일출 + 아침 한 끼
        var ch = sunSpot || chuamCluster[0];
        var sm = sunriseApprox(date) || (toMin(D.sunrise.time)), l1 = leg(stay, ch, false, routes, dayLegOpt), arr = sm - 30, dep = arr - l1.min;
        var f1 = { id: ch.id, place: ch, legMin: l1.min, mode: l1.mode, moveText: l1.text, path: l1.path, tour: null, real: !!l1.real, fare: l1.fare, transfers: l1.transfers, arrive: arr, wait: 0, delay: 0, startVisit: arr, leave: arr + 40 + 30 }; // 일출 30분 전 도착, 해 뜬 뒤 40분
        var seed = [f1], bf = o.meal === false ? null : breakfastStop(D, base, ch, f1.leave, routes, dayLegOpt);
        if (bf) seed.push(bf);
        base.now = dep; base.fixed = seed.map(function (x, j) { return Object.assign({}, x); });
        pl = plan(D, base);
        if (pl.feasible) { sun = { place: ch, arrive: arr, depart: dep, sunrise: sm, approx: true, moveText: l1.text }; brk = bf; sunDone = true; base.fixed = base.fixed; }
        else { base.fixed = []; base.now = DAY2_START; pl = null; }
      }
      if (!pl) pl = plan(D, base);
      if (base.onlyMust && base.must && base.must.length) { var lf = base.must.slice(), dr = []; while (!pl.feasible && lf.length) { dr.push(lf.pop()); base.must = lf.slice(); if (!lf.length) base.onlyMust = false; pl = plan(D, base); } pl.mustDropped = dr; } // AI 가 정한 날 코스가 시간에 안 들어가면 뒤에서부터 뺀다
      pl.stops.forEach(function (s) { if (s.done) { delete s.done; s.pre = true; } s.day = i; avoid.push(s.id); if (s.place && s.place.group && sunSpot && s.place.group === sunSpot.group) chuamCluster.forEach(function (p) { if (avoid.indexOf(p.id) < 0) avoid.push(p.id); }); });
      days.push({ n: i + 1, date: date, label: (i + 1) + '일차 · ' + dateLabel(date), plan: pl, sunrise: sun, breakfast: brk, stay: last ? null : stay });
    }
    var first = days[0].plan, lastPl = days[n - 1].plan;
    var out = { multi: true, nDays: n, label: tripLabel(n), how: first.how, howIn: first.howIn, howOut: lastPl.howOut, days: days, stay: stay,
      feasible: days.every(function (d) { return d.plan.feasible || d.plan.stops.length > 0; }), stops: [], back: lastPl.back, deadline: lastPl.deadline, train: lastPl.train, endStation: lastPl.endStation, startStation: first.startStation,
      mode: 'normal', skipped: first.skipped, start: first.start, slow: first.slow, tomorrow: null, date: o.date, backDate: o.backDate };
    days.forEach(function (d) { out.stops = out.stops.concat(d.plan.stops); });
    out.tour = { enabled: days.some(function (d) { return d.plan.tour.enabled; }), day: first.tour.day, used: false, rides: 0, legs: [], fareText: first.tour.fareText };
    days.forEach(function (d) { out.tour.rides += d.plan.tour.rides; out.tour.legs = out.tour.legs.concat(d.plan.tour.legs); });
    out.tour.used = out.tour.rides > 0;
    out.mealNeeded = days.some(function (d) { return d.plan.mealNeeded; });
    out.meal = out.stops.filter(function (s) { return s.kind === 'meal'; })[0] || null;
    return out;
  }

  /* 현장 제보 단추 "다음 장소 줄 20분" 이 겨냥할 장: 가장 최근 "여기 왔어요" 한 장(lastDone, 없으면 -1)보다 2장 이상 앞서 있는 첫 볼거리.
     "여기 왔어요" 가 없으면 3번째 장. 끼니 시간 슬롯은 제보 대상이 아니라 볼거리를 먼저 고른다. 없으면 null. */
  function reportTarget(stops, lastDone) {
    var from = (lastDone == null || lastDone < 0) ? 2 : lastDone + 2;
    for (var i = from; i < (stops || []).length; i++) if (stops[i].kind !== 'meal') return { index: i, stop: stops[i] };
    return null;
  }

  var api = { plan: plan, planDays: planDays, makeLegger: makeLegger, placeValue: placeValue, dayCount: dayCount, tripLabel: tripLabel, sunriseApprox: sunriseApprox, nearestDeparture: nearestDeparture, leg: leg, tourDay: tourDay, tourNextDay: tourNextDay, tourLeg: tourLeg, tourFareText: tourFareText, tourWxCaution: tourWxCaution, hav: hav, fmt: fmt, isSlotId: isSlotId, slotKindOf: slotKindOf, slotPlace: slotPlace, slotId: slotId, realPos: realPos, SLOT_NAME: SLOT_NAME, SLOT_VISIT: SLOT_VISIT, SLOT_LEG: SLOT_LEG, toMin: toMin, effectsFromReports: effectsFromReports, dateInfo: dateInfo, addDays: addDays, lastDigitDay: lastDigitDay, nextMarketDay: nextMarketDay, dateLabel: dateLabel, reportTarget: reportTarget, WALK_MAX: WALK_MAX, WALK_MAX_SLOW: WALK_MAX_SLOW };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TourPlanner = api;
})(typeof window !== 'undefined' ? window : globalThis);
