/*
 * 실시간 여행 안내 — 코스를 따라가는 동안의 계산(위치 → 도착 감지 → 다음 장 → 늦음 → 길 벗어남 → 걷기 안내) + 가상 이동(시연).
 * 화면은 app.js(아래에서 올라오는 창), 코스·시간 규칙은 planner.js, 늦을 때 고치는 방법은 editor.js fixes 를 그대로 쓴다. 브라우저·Node 양쪽에서 쓴다.
 * 위치는 이 기기 안에서만 계산한다 — 어디로도 보내지 않고, 저장하는 것은 진행 상황(몇 번째 장까지 갔나)뿐이다.
 *
 *  buildTrips(plan, o)        코스(plan 또는 planDays 결과) → 날마다 { di, date, label, nodes, meta }.  o = { routes, slow }
 *     nodes[0] = 출발, nodes[1..m] = 장(끼니 시간은 앞 장에 머무는 시간으로 합침), nodes[m+1] = 도착. 각 node 는 앞 node 에서 온 길(leg: mode · min · path · steps · tour)을 갖는다.
 *  new Session(trip)          한 날의 진행 상태.  start(now,tms) → setPosition(lat,lng,acc,tms,now) / tick(tms,now) → 사건 목록[{type:'arrive'|'leave'|'step'|'offroute'|'backonroute'|'finish'}]
 *                             snapshot(now) → 화면에 보일 값(지금 장·다음 장·남은 거리/분·마감까지·늦음·걷기 안내)
 *  remainderFixes(ED, ctx)    늦었을 때: 남은 장만 떼어 editor.js fixes 로 "한 번 눌러 고치는 방법"을 구하고, 코스 전체에 되돌려 끼운 spec 을 돌려준다.
 *  Session.rebuild(...)       고친 뒤: 남은 장의 시각을 지금 기준으로 다시 놓는다.
 *  Sim                        가상 이동: 실제 길(걷기·버스·택시·시티투어) 위를 시간표대로 움직이는 위치를 만들어 Session 에 먹인다(속도 ×10 / ×30 / ×60, "늦어짐" +25분).
 *  kakaoLink(mode, from, to)  카카오맵 길안내 주소 (걷기 by/walk · 대중교통 by/traffic · 자동차 by/car)
 */
(function (root) {
  'use strict';
  var P = root.TourPlanner || (typeof require !== 'undefined' ? require('./planner.js') : null);
  var fmt = P.fmt;

  var SKIP_MS = 180000;                                    // 가는 장을 건너뛰고 다음 장 둘레에 3분 넘게 머물면 앞 장은 건너뛴 것으로 침(지나가기만 한 것과 구분)
  var ARRIVE_R = 50, ARRIVE_RMAX = 80, DWELL_MS = 10000;  // 도착: 50m 안(위치 오차가 크면 그만큼 넓혀 최대 80m)에 10초 이상
  var LEAVE_M = 120;                                       // 머물던 곳에서 120m 넘게 벗어나면 떠난 것
  var OFF_M = 150, OFF_M_LONG = 250, OFF_MS = 60000;       // 길(선)에서 150m(4km 넘는 긴 구간은 250m — 길 선을 점 40개로 줄여 둬서) 넘게 60초
  var STEP_M = 30;                                         // 걷기 안내: 안내 지점 30m 앞에서 읽어 줌
  var LATE_MIN = 15;                                       // 예정보다 15분 이상 늦으면 알림
  var MODE_NAME = { walk: '걸어서', bus: '버스', taxi: '택시', car: '자가용', tour: '시티투어' };

  /* ---------- 거리·길 도구 ---------- */
  var RAD = Math.PI / 180;
  function mDist(aLat, aLng, bLat, bLng) {
    var dLat = (bLat - aLat) * RAD, dLng = (bLng - aLng) * RAD;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(aLat * RAD) * Math.cos(bLat * RAD) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(x)));
  }
  function pathLen(path) { var s = 0; for (var i = 0; i + 1 < path.length; i++) s += mDist(path[i][1], path[i][0], path[i + 1][1], path[i + 1][0]); return s; }
  /* 길(선)에서 가장 가까운 점: 선까지 거리(m) · 선 시작에서 거기까지 따라간 길이(m) · 선 전체 길이(m) */
  function locate(path, lat, lng) {
    var best = { dist: Infinity, along: 0, seg: 0, total: 0 }, acc = 0, cos = Math.cos(lat * RAD);
    for (var i = 0; i + 1 < path.length; i++) {
      var a = path[i], b = path[i + 1], L = mDist(a[1], a[0], b[1], b[0]);
      var bx = (b[0] - a[0]) * 111320 * cos, by = (b[1] - a[1]) * 110574, px = (lng - a[0]) * 111320 * cos, py = (lat - a[1]) * 110574;
      var den = bx * bx + by * by, t = den > 0 ? Math.max(0, Math.min(1, (px * bx + py * by) / den)) : 0, dx = px - t * bx, dy = py - t * by, d = Math.sqrt(dx * dx + dy * dy);
      if (d < best.dist) best = { dist: d, along: acc + t * L, seg: i, total: 0 };
      acc += L;
    }
    best.total = acc; return best;
  }
  function pointAt(path, m) { // 선 시작에서 m 미터 간 곳
    if (!path || !path.length) return null;
    if (m <= 0 || path.length === 1) return { lat: path[0][1], lng: path[0][0] };
    var acc = 0;
    for (var i = 0; i + 1 < path.length; i++) {
      var L = mDist(path[i][1], path[i][0], path[i + 1][1], path[i + 1][0]);
      if (acc + L >= m) { var t = L > 0 ? (m - acc) / L : 0; return { lat: path[i][1] + (path[i + 1][1] - path[i][1]) * t, lng: path[i][0] + (path[i + 1][0] - path[i][0]) * t }; }
      acc += L;
    }
    var e = path[path.length - 1]; return { lat: e[1], lng: e[0] };
  }
  function hm(min) { // 분 → "2시간 10분" / "45분"
    min = Math.max(0, Math.round(min)); var h = Math.floor(min / 60), m = min % 60;
    return h ? h + '시간' + (m ? ' ' + m + '분' : '') : m + '분';
  }
  function meters(m) { m = Math.round(m); return m >= 1000 ? (Math.round(m / 100) / 10) + 'km' : m + 'm'; }

  /* ---------- 카카오맵 길안내 주소 (공식 길찾기 landingUrl 과 같은 모양: https://map.kakao.com/link/by/walk/출발,위도,경도/도착,위도,경도) ---------- */
  function linkName(s) { return encodeURIComponent(String(s || '').replace(/[,\/?#%&]/g, ' ').replace(/\s+/g, ' ').trim() || '장소'); }
  function r6(v) { return Math.round(v * 1e6) / 1e6; }
  function kakaoLink(mode, from, to) {
    var m = mode === 'traffic' || mode === 'car' ? mode : 'walk';
    return 'https://map.kakao.com/link/by/' + m + '/' + linkName(from.name) + ',' + r6(from.lat) + ',' + r6(from.lng) + '/' + linkName(to.name) + ',' + r6(to.lat) + ',' + r6(to.lng);
  }
  /* 한 구간(앞 장 → 이 장)의 길안내 단추: 걷기 → 걷기, 버스 → 대중교통, 택시·자가용 → 자동차, 시티투어 → 정류장까지 걷기 */
  function legLink(prev, node, pos) {
    var leg = node.leg || { mode: 'walk' }, from = pos ? { name: '내 위치', lat: pos.lat, lng: pos.lng } : { name: prev.name, lat: prev.lat, lng: prev.lng };
    var to = { name: node.place.name, lat: node.place.lat, lng: node.place.lng }, mode = 'walk', label = '카카오맵으로 길안내';
    if (leg.mode === 'bus') mode = 'traffic';
    else if (leg.mode === 'taxi' || leg.mode === 'car') mode = 'car';
    else if (leg.mode === 'tour' && leg.tour && leg.tour.stopsUsed && leg.tour.stopsUsed[0]) {
      var b = leg.tour.stopsUsed[0]; to = { name: b.name + ' 정류장', lat: b.lat, lng: b.lng }; label = '정류장까지 카카오맵 길안내';
    }
    return { url: kakaoLink(mode, from, to), mode: mode, label: label, to: to };
  }

  /* ---------- 코스 → 날마다 node 줄 ---------- */
  function stepsFor(a, b, slow, routes, leg) { // 걷기 안내 토막: 미리 받은 한 방향(a|b)에만 있다 — 반대 방향은 "왼쪽/오른쪽"이 거꾸로라 뒤집어 쓰지 않는다
    if (!routes || !leg || leg.mode !== 'walk' || !leg.real || !a || !b) return null;
    var rec = routes[a.id + '|' + b.id]; if (!rec) return null;
    var w = slow ? (rec.walkAccessible || rec.walk) : rec.walk;
    if (!w || !w.steps || !w.steps.length) return null;
    return w.steps.map(function (s) { return { x: s[0], y: s[1], m: s[2], text: s[3] }; });
  }
  function nodesFrom(pl, o) {
    o = o || {};
    var routes = o.routes === undefined ? (root.ROUTES && root.ROUTES.pairs) || null : o.routes, slow = !!o.slow;
    var st = pl.startStation, nodes = [{ i: 0, id: st.id || 'start', kind: 'start', place: st, arrive: pl.start, startVisit: pl.start, leave: pl.start, visit: 0, wait: 0, delay: 0, leg: null }];
    var prev = st;
    (pl.stops || []).forEach(function (s, idx) {
      if (s.kind === 'meal' && s.place && s.place.slot) { // 끼니 시간 슬롯은 장이 아니라 앞 장소에 머무는 시간으로 합친다(식당 길안내 없음). 처음이면 출발 시각을 그만큼 미룬다
        var pn = nodes[nodes.length - 1];
        pn.leave = s.leave; pn.visit = pn.kind === 'start' ? 0 : s.leave - pn.startVisit - (pn.delay || 0);
        pn.meal = { kind: s.place.mealKind, from: s.startVisit, to: s.leave };
        return;
      }
      var leg = { mode: s.mode, min: s.legMin, path: s.path || null, text: s.moveText || '', tour: s.tour || null, fare: s.fare, transfers: s.transfers, real: !!s.real, taxi: s.taxiMin };
      leg.steps = stepsFor(prev, s.place, slow, routes, leg);
      nodes.push({ i: nodes.length, id: s.id, kind: s.kind === 'meal' ? 'meal' : 'stop', place: s.place, arrive: s.arrive, startVisit: s.startVisit, leave: s.leave, wait: s.wait || 0, delay: s.delay || 0,
        visit: s.visit != null ? s.visit : s.leave - s.startVisit - (s.delay || 0), pre: !!s.pre, breakfast: !!s.breakfast, leg: leg });
      prev = s.place;
    });
    var b = pl.back || { arrive: pl.start, mode: 'walk', min: 0, path: null, text: '' };
    var bleg = { mode: b.mode || 'walk', min: b.min || 0, path: b.path || null, text: b.text || '', tour: b.tour || null, real: !!b.real, taxi: b.taxiMin };
    bleg.steps = stepsFor(prev, pl.endStation, slow, routes, bleg);
    nodes.push({ i: nodes.length, id: pl.endStation.id || 'end', kind: 'end', place: pl.endStation, arrive: b.arrive, startVisit: b.arrive, leave: null, visit: 0, wait: 0, delay: 0, leg: bleg });
    return nodes;
  }
  function buildTrips(plan, o) {
    o = o || {};
    var days = plan.multi ? plan.days.map(function (d, di) { return { di: di, date: d.date, label: d.label, pl: d.plan }; }) : [{ di: 0, date: plan.date, label: '', pl: plan }];
    var nd = days.length, howOut = (o.howOut || plan.howOut || plan.how || 'train');
    return days.map(function (d) {
      var last = d.di === nd - 1, pl = d.pl;
      return {
        di: d.di, date: d.date, label: d.label, o: o, nodes: nodesFrom(pl, o),
        meta: { di: d.di, lastDay: last, deadline: pl.deadline, train: pl.train, howOut: o.howOut || pl.howOut || howOut, date: d.date, label: d.label, slow: !!o.slow, nDays: nd }
      };
    });
  }

  /* 연습: 여행 날짜가 오늘이 아니거나 지금이 코스 시간대 밖이면, 코스 시각을 지금에 맞춰 통째로 옮겨 "늦음"이 지금 기준으로 보이게 한다(코스 순서·길이는 그대로) */
  function shiftTrip(trip, delta) {
    trip.nodes.forEach(function (n) { n.arrive += delta; n.startVisit += delta; if (n.leave != null) n.leave += delta; });
    trip.meta.deadline += delta; trip.meta.train += delta; trip.meta.practice = true; trip.meta.shift = delta; return trip;
  }
  /* ---------- 진행 상태 ---------- */
  function Session(trip) {
    this.nodes = trip.nodes; this.meta = trip.meta; this.trip = trip;
    this.phase = 'idle'; this.k = 1;
    this.arrivedAt = {}; this.arrivedMs = {}; this.leftAt = {}; this.skipped = {};
    this.pos = null; this.inSince = null; this.nextIn = null; this.offSince = null; this.offFlag = false;
    this.stepI = 0; this.fracMax = {}; this.log = [];
  }
  Session.prototype.last = function () { return this.nodes.length - 1; };
  Session.prototype.stopCount = function () { return this.nodes.length - 2; };
  Session.prototype.legPath = function (k) { // k 번째 node 로 오는 길(선). 길 값이 없으면 두 점을 직선으로. 길 끝이 장소 점과 떨어져 있으면(길은 도로 위, 장소는 건물 점) 장소 점까지 잇는다
    var n = this.nodes[k], p = n.leg && n.leg.path, a = this.nodes[k - 1].place, b = n.place;
    if (!(p && p.length > 1)) return [[a.lng, a.lat], [b.lng, b.lat]];
    if (n._lp && n._lpSrc === p) return n._lp;
    var q = p.slice();
    if (mDist(a.lat, a.lng, q[0][1], q[0][0]) > 1) q.unshift([a.lng, a.lat]);
    var e = q[q.length - 1]; if (mDist(b.lat, b.lng, e[1], e[0]) > 1) q.push([b.lng, b.lat]);
    n._lp = q; n._lpSrc = p; return q;
  };
  Session.prototype.start = function (now, tms) {
    this.phase = 'travel'; this.k = 1; this.leftAt[0] = now; this.startedAt = now; this.stepI = 0; this.inSince = null; this.nextIn = null;
    if (this.last() === 0) { this.phase = 'done'; }
    return [];
  };
  function radius(acc) { return Math.max(ARRIVE_R, Math.min(ARRIVE_RMAX, acc || 0)); }
  function distTo(pos, place) {
    var d = mDist(pos.lat, pos.lng, place.lat, place.lng);
    if (place.routeAt) d = Math.min(d, mDist(pos.lat, pos.lng, place.routeAt.lat, place.routeAt.lng)); // 걷는 길 끝 장소는 입구에서도 도착으로
    return d;
  }
  Session.prototype.markArrive = function (k, now, tms, events, manual) {
    this.hold = 0; this.arrivedAt[k] = now; this.arrivedMs[k] = tms; this.inSince = null; this.nextIn = null; this.offSince = null; this.offFlag = false; this.stepI = 0;
    var node = this.nodes[k];
    if (k === this.last()) { this.phase = 'done'; events.push({ type: 'arrive', k: k, node: node, manual: !!manual }); events.push({ type: 'finish', k: k }); }
    else { this.phase = 'visit'; this.k = k; events.push({ type: 'arrive', k: k, node: node, manual: !!manual }); }
  };
  Session.prototype.markLeave = function (now, events, manual) {
    var k = this.k; this.hold = 0; this.leftAt[k] = now; this.phase = 'travel'; this.k = k + 1; this.inSince = null; this.nextIn = null; this.offSince = null; this.offFlag = false; // stepI 는 그대로(떠나기 전에 읽은 안내를 또 읽지 않게)
    events.push({ type: 'leave', k: k, next: this.k, manual: !!manual });
  };
  Session.prototype.setPosition = function (lat, lng, acc, tms, now) {
    this.pos = { lat: lat, lng: lng, acc: acc || 0, tms: tms };
    return this.evaluate(tms, now);
  };
  Session.prototype.tick = function (tms, now) { return this.pos ? this.evaluate(tms, now) : []; };
  Session.prototype.evaluate = function (tms, now) {
    var ev = [], pos = this.pos, R = radius(pos.acc), nodes = this.nodes;
    if (this.phase === 'travel') {
      var k = this.k, node = nodes[k], d = distTo(pos, node.place);
      if (d <= R) { if (this.inSince == null) this.inSince = tms; if (tms - this.inSince >= DWELL_MS) { this.markArrive(k, now, tms, ev); return ev; } } else this.inSince = null;
      // 앞 장을 건너뛰고 그 다음 장에 먼저 닿은 경우: 다음 장 도착으로 치고 앞 장은 건너뜀
      if (k < this.last()) {
        var n2 = nodes[k + 1], d2 = distTo(pos, n2.place);
        if (d2 <= R && d > R) { if (this.nextIn == null) this.nextIn = tms; if (tms - this.nextIn >= SKIP_MS) { this.skipped[k] = true; ev.push({ type: 'skip', k: k, auto: true }); this.markArrive(k + 1, now, tms, ev); return ev; } } else this.nextIn = null;
      }
      // 길 벗어남
      var path = this.legPath(k), pl = path.length > 1 ? locate(path, pos.lat, pos.lng) : null;
      if (pl) {
        var thr = pl.total > 4000 ? OFF_M_LONG : OFF_M;
        if (pl.dist > thr && d > R) { if (this.offSince == null) this.offSince = tms; if (!this.offFlag && tms - this.offSince >= OFF_MS) { this.offFlag = true; ev.push({ type: 'offroute', k: k, dist: Math.round(pl.dist) }); } }
        else { this.offSince = null; if (this.offFlag) { this.offFlag = false; ev.push({ type: 'backonroute', k: k }); } }
        if (pl.dist <= thr) this.fracMax[k] = Math.max(this.fracMax[k] || 0, pl.total ? pl.along / pl.total : 0);
      }
      this.stepCheck(node, k, pos, ev, false);
    } else if (this.phase === 'visit') {
      var cur = nodes[this.k], dc = mDist(pos.lat, pos.lng, cur.place.lat, cur.place.lng);
      var nx = nodes[this.k + 1], dn = distTo(pos, nx.place);
      if (dn <= R) { // 다음 장이 바로 옆이라 떠남을 못 보고 닿은 경우
        if (this.nextIn == null) this.nextIn = tms;
        if (tms - this.nextIn >= DWELL_MS) { this.markLeave(now, ev); this.markArrive(this.k, now, tms, ev); return ev; }
      } else this.nextIn = null;
      if (dc > LEAVE_M && dn > R) { this.markLeave(now, ev); this.stepCheck(nodes[this.k], this.k, pos, ev, true); }
    }
    return ev;
  };
  /* 걷기 안내: 안내 지점 30m 안에 들면 그 글을 한 번 읽어 준다. first 면(막 떠났을 때) 아직 안 읽은 첫 안내를 바로 읽는다 */
  Session.prototype.stepCheck = function (node, k, pos, ev, first) {
    var steps = node.leg && node.leg.steps; if (!steps || !steps.length) return;
    if (first && this.stepI === 0) { // 막 떠남: 첫 안내를 바로 읽고, 머물던 곳 둘레에서 이미 지나온 안내 지점은 조용히 넘긴다
      this.stepI = 1; ev.push({ type: 'step', k: k, j: 0, step: steps[0], text: steps[0].text });
      var walked = mDist(steps[0].y, steps[0].x, pos.lat, pos.lng);
      while (this.stepI < steps.length && mDist(steps[0].y, steps[0].x, steps[this.stepI].y, steps[this.stepI].x) + STEP_M <= walked) this.stepI++;
      return;
    }
    for (var j = this.stepI; j < steps.length; j++) {
      if (mDist(pos.lat, pos.lng, steps[j].y, steps[j].x) <= STEP_M) { this.stepI = j + 1; ev.push({ type: 'step', k: k, j: j, step: steps[j], text: steps[j].text }); break; }
    }
  };
  /* 손으로: "여기 왔어요"(지금 가는 장에 도착으로) · "다음 장소로"(머물던 곳을 떠남) · "건너뛰기" */
  /* 새로 고친 뒤 이어서: 저장해 둔 진행(몇 번째 장까지 갔나)에서 다시 시작 */
  Session.prototype.restore = function (saved, now) {
    var self = this; this.phase = 'travel'; this.arrivedAt = {}; this.skipped = {};
    Object.keys(saved.arrivedAt || {}).forEach(function (k) { if (+k < self.nodes.length - 1) self.arrivedAt[k] = saved.arrivedAt[k]; });
    var k = Math.max(1, Math.min(this.last(), +saved.k || 1)); this.k = k; this.leftAt[k - 1] = now; this.startedAt = saved.startedAt != null ? saved.startedAt : now; this.stepI = 0;
    return this;
  };
  Session.prototype.save = function () { return { k: this.phase === 'visit' ? this.k + 1 : this.k, phase: this.phase, arrivedAt: this.arrivedAt, startedAt: this.startedAt }; };
  /* 가상 "늦어짐": 머무는 중이면 더 머무는 것으로 쳐서 예상 떠나는 시각을 미룬다(가는 중이면 시계가 앞서는 것만으로 늦어짐이 보임) */
  Session.prototype.addDelay = function (min) { if (this.phase === 'visit') this.hold = (this.hold || 0) + min; };
  Session.prototype.arriveNow = function (now, tms) { var ev = []; if (this.phase === 'travel') this.markArrive(this.k, now, tms || now * 60000, ev, true); return ev; };
  Session.prototype.leaveNow = function (now) { var ev = []; if (this.phase === 'visit') this.markLeave(now, ev, true); return ev; };
  Session.prototype.skipNow = function (now) {
    var ev = []; if (this.phase !== 'travel' || this.k >= this.last()) return ev;
    this.skipped[this.k] = true; ev.push({ type: 'skip', k: this.k }); this.k += 1; this.leftAt[this.k - 1] = now; this.inSince = null; this.nextIn = null; this.offSince = null; this.offFlag = false; this.stepI = 0; return ev;
  };

  /* ---------- 남은 길·시각 어림 ---------- */
  Session.prototype.legFrac = function (k) { // 지금 가는 구간을 얼마나 왔나(0~1)
    var pos = this.pos, path = this.legPath(k), n = this.nodes[k];
    if (pos && path.length > 1) {
      var pl = locate(path, pos.lat, pos.lng), thr = pl.total > 4000 ? OFF_M_LONG : OFF_M;
      if (pl.dist <= thr) return Math.max(this.fracMax[k] || 0, pl.total ? Math.min(1, pl.along / pl.total) : 0);
      var D = mDist(this.nodes[k - 1].place.lat, this.nodes[k - 1].place.lng, n.place.lat, n.place.lng);
      return Math.max(0, Math.min(1, 1 - distTo(pos, n.place) / Math.max(D, 1)));
    }
    return null;
  };
  Session.prototype.remainingMin = function (now) { // 지금 가는 장까지 남은 분
    var k = this.k, leg = this.nodes[k].leg, fr = this.legFrac(k);
    if (fr == null) return Math.max(0, leg.min - (now - (this.leftAt[k - 1] != null ? this.leftAt[k - 1] : now)));
    return leg.min * (1 - fr);
  };
  Session.prototype.remainingM = function () { // 지금 가는 장까지 남은 거리(m)
    var k = this.k, n = this.nodes[k], path = this.legPath(k), fr = this.legFrac(k), pos = this.pos;
    if (pos && fr != null) {
      var pl = locate(path, pos.lat, pos.lng), thr = pl.total > 4000 ? OFF_M_LONG : OFF_M;
      if (pl.dist <= thr) return Math.max(0, pl.total * (1 - fr));
      return distTo(pos, n.place);
    }
    return pathLen(path);
  };
  function visitEnd(node, arr, practice) { // 이 장에 arr 에 닿으면 떠나는 시각(열기 전이면 열 때까지 기다림. 연습 중에는 시각을 옮겨 놓은 것이라 운영시간을 따지지 않는다)
    var wait = (!practice && !node.pre && node.place.open && arr < node.place.open[0]) ? node.place.open[0] - arr : 0;
    return { start: arr + wait, leave: arr + wait + (node.delay || 0) + (node.visit || 0), wait: wait };
  }
  /* 지금부터 끝까지 예상: arrive[j] · leave[j] (j 는 node 번호), 앞 장은 실제 기록 */
  Session.prototype.projection = function (now) {
    var nodes = this.nodes, end = this.last(), out = { arrive: {}, leave: {} }, j, k = this.k;
    if (this.phase === 'idle') { nodes.forEach(function (n, i) { out.arrive[i] = n.arrive; out.leave[i] = n.leave; }); out.back = nodes[end].arrive; return out; }
    if (this.phase === 'done') { for (j = 0; j <= end; j++) { out.arrive[j] = this.arrivedAt[j] != null ? this.arrivedAt[j] : nodes[j].arrive; } out.back = out.arrive[end]; return out; }
    if (this.phase === 'travel') { out.arrive[k] = (k === 1 && nodes[0].leave != null ? Math.max(now, nodes[0].leave) : now) + this.remainingMin(now); }
    else { // visit
      out.arrive[k] = this.arrivedAt[k]; var v0 = visitEnd(nodes[k], this.arrivedAt[k], this.meta.practice); out.leave[k] = Math.max(now, v0.leave + (this.hold || 0));
    }
    for (j = k; j <= end; j++) {
      if (j === end) break;
      if (out.leave[j] == null) out.leave[j] = visitEnd(nodes[j], out.arrive[j], this.meta.practice).leave;
      out.arrive[j + 1] = out.leave[j] + nodes[j + 1].leg.min;
    }
    out.back = out.arrive[end]; return out;
  };
  Session.prototype.late = function (now) {
    var nodes = this.nodes, k = this.k, pr = this.projection(now), behind = 0;
    if (this.phase === 'travel') behind = pr.arrive[k] - nodes[k].arrive;
    else if (this.phase === 'visit') behind = pr.leave[k] - nodes[k].leave;
    var dl = Math.max(0, Math.round(pr.back - this.meta.deadline));
    behind = Math.round(behind);
    return { behind: behind, deadline: dl, back: pr.back, warn: this.phase !== 'idle' && this.phase !== 'done' && (dl > 0 || behind >= LATE_MIN), proj: pr };
  };
  Session.prototype.countdown = function (now) {
    var m = this.meta, lastDay = m.lastDay, target = lastDay ? m.train : m.deadline, how = m.howOut;
    var label = lastDay ? (how === 'bus' ? '버스까지' : how === 'car' ? '정한 시각까지' : '기차까지') : '오늘 숙소 도착까지';
    var min = target - now;
    return { label: label, min: Math.round(min), target: target, text: min >= 0 ? label + ' ' + hm(min) : (lastDay ? (how === 'car' ? '정한 시각이 지났어요' : (how === 'bus' ? '버스' : '기차') + ' 시각이 지났어요') : '숙소 도착 시각이 지났어요') };
  };
  Session.prototype.doneCount = function () { var c = 0, self = this; this.nodes.forEach(function (n, i) { if (n.kind !== 'start' && n.kind !== 'end' && self.arrivedAt[i] != null) c++; }); return c; };
  Session.prototype.snapshot = function (now) {
    var nodes = this.nodes, k = this.k, ph = this.phase, end = this.last(), s = { phase: ph, k: k, total: this.stopCount(), done: this.doneCount() };
    s.cur = ph === 'visit' ? nodes[k] : null;
    var nextIdx = ph === 'travel' ? k : ph === 'visit' ? k + 1 : null;
    if (nextIdx != null && nodes[nextIdx]) {
      var nn = nodes[nextIdx], leg = nn.leg, prevP = nodes[nextIdx - 1].place, distM, min, mode = leg.mode;
      if (ph === 'travel') { distM = this.remainingM(); min = this.remainingMin(now); }
      else { var p = this.legPath(nextIdx); distM = pathLen(p); min = leg.min; }
      var tb = null;
      if (mode === 'tour' && leg.tour && leg.tour.stopsUsed) tb = { stop: leg.tour.boardName, dep: leg.tour.dep, text: leg.tour.boardName + ' 정류장에서 ' + fmt(leg.tour.dep) + ' 시티투어 탑승' };
      s.next = { node: nn, index: nextIdx, isEnd: nextIdx === end, distM: Math.round(distM), distText: meters(distM), min: Math.max(1, Math.ceil(min)), mode: mode, modeName: MODE_NAME[mode] || '이동', tourBoard: tb, link: legLink(prevP, nn, ph === 'travel' ? this.pos : null), meal: nn.kind === 'meal' };
      s.next.text = '다음: ' + nn.place.short + ' · ' + s.next.distText + ' · 약 ' + s.next.min + '분 (' + s.next.modeName + ')';
      if (ph === 'travel') { var steps = leg.steps; if (steps && this.stepI < steps.length) { var st = steps[this.stepI]; s.step = { text: st.text, distM: this.pos ? Math.round(mDist(this.pos.lat, this.pos.lng, st.y, st.x)) : null, j: this.stepI, of: steps.length }; } }
    } else s.next = null;
    s.countdown = this.countdown(now); s.late = this.late(now); s.off = this.offFlag; s.pos = this.pos;
    s.target = ph === 'travel' ? nodes[k] : null;
    return s;
  };

  /* ---------- 늦었을 때 고치는 방법 (editor.js fixes 재사용) ---------- */
  /* 어디서부터 다시 계산하나: 지금 가는 중이면 앞 장을 떠난 걸로(남은 길을 걸을 시간이 더해지게 시각을 거꾸로 맞춤), 머무는 중이면 이 장을 떠나는 때부터 */
  Session.prototype.remainderBase = function (now) {
    var nodes = this.nodes, k = this.k, pr = this.projection(now), items0, place, t;
    if (this.phase === 'travel') { items0 = k - 1; place = nodes[k - 1].place; t = pr.arrive[k] - nodes[k].leg.min; }
    else if (this.phase === 'visit') { items0 = k; place = nodes[k].place; t = pr.leave[k]; }
    else return null;
    return { k0: items0, place: place, t: Math.round(t * 100) / 100 };
  };
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function dayOf(fr, di) { return fr.multi ? fr.days[di].plan : fr; }
  function dateOfFrame(fr, di) { return fr.multi ? fr.days[di].date : fr.date; }
  /* 남은 장만 든 작은 코스(날 하나짜리)와 그 spec. 마감·출발 지점은 그 날 것 그대로 쓰고 출발만 "지금 있는 곳 · 지금 시각" 으로 바꾼다. */
  function remainderEnv(ctx, base) {
    var fr = ctx.env.frame, dp = dayOf(fr, ctx.di), full = ctx.spec, day = full.days[ctx.di] || { items: [] };
    var o = ctx.env.o, howOut = o.backHow || o.how || 'train', buf = howOut === 'car' ? 0 : 15;
    var sub = Object.assign({}, dp, { start: base.t, startStation: base.place, stops: [], issues: [], train: dp.deadline + buf });
    var done = day.items.slice(0, base.k0).map(function (it) { return it.id; }), others = [];
    full.days.forEach(function (d, i) { if (i !== ctx.di) d.items.forEach(function (it) { others.push(it.id); }); });
    var subSpec = { v: 1, days: [{ items: clone(day.items.slice(base.k0)) }], excl: (full.excl || []).concat(done, others), noMeal: !!full.noMeal };
    if (day.backTaxi) subSpec.days[0].backTaxi = true;
    var frame = { multi: true, nDays: 1, days: [{ n: 1, date: dateOfFrame(fr, ctx.di), label: '', plan: sub }], tour: fr.tour, date: dateOfFrame(fr, ctx.di) };
    return { env: { D: ctx.env.D, o: o, frame: frame }, spec: subSpec, done: done, others: others, excl0: subSpec.excl.length };
  }
  function mergeBack(ctx, base, renv, subNew) { // 남은 장 spec → 코스 전체 spec
    var n = clone(ctx.spec), day = n.days[ctx.di];
    day.items = day.items.slice(0, base.k0).concat(clone(subNew.days[0].items));
    if (subNew.days[0].backTaxi) day.backTaxi = true; else delete day.backTaxi;
    var removed = (subNew.excl || []).slice(renv.excl0).filter(function (id) { return n.excl.indexOf(id) < 0; });
    removed.forEach(function (id) { n.excl.push(id); });
    n.noMeal = !!subNew.noMeal;
    return n;
  }
  /* ctx = { ED, env: {D,o,frame}, spec, di, session, now } → { base, fixes: [{ kind, label, detail, spec(코스 전체), sub(남은 코스를 다시 계산한 것) }], problems } */
  function remainderFixes(ctx) {
    var ED = ctx.ED, s = ctx.session, base = s.remainderBase(ctx.now); if (!base) return { base: null, fixes: [], problems: [] };
    var renv = remainderEnv(ctx, base), res = ED.fixes(renv.env, renv.spec), out = [];
    res.fixes.forEach(function (f) {
      var merged = mergeBack(ctx, base, renv, f.spec), rt = ED.retime(renv.env, f.spec);
      out.push({ kind: f.kind, label: f.label, detail: f.detail, partial: !!f.partial, spec: merged, sub: rt });
    });
    // 마감에는 맞지만 15분 넘게 늦은 경우: 막힌 곳이 없어 고치는 방법이 비어 있으니 "나머지 다시 짜기" 하나는 늘 준다
    if (!out.length) {
      var rp = ED.replan(renv.env, renv.spec, 0);
      if (rp.ok) out.push({ kind: 'replan', label: '남은 곳 다시 짜기', detail: '📌 고정한 곳은 그대로 두고, 남은 시간에 맞춰 남은 곳을 새로 짜요', spec: mergeBack(ctx, base, renv, rp.spec), sub: ED.retime(renv.env, rp.spec) });
    }
    return { base: base, fixes: out, problems: res.problems || [], rt: res.rt };
  }
  /* 제보 알림 [코스 다시 짜기]: 남은 장만 지금 시각부터 다시 짠다(제보 효과는 env.o.fx). 고정(📌)·지나간 곳은 그대로. 바뀐 게 없으면 same:true */
  function remainderReplan(ctx) {
    var s = ctx.session, base = s.remainderBase(ctx.now); if (!base) return null;
    var renv = remainderEnv(ctx, base), rp = ctx.ED.replan(renv.env, renv.spec, 0); if (!rp.ok) return null;
    return { base: base, spec: mergeBack(ctx, base, renv, rp.spec), sub: ctx.ED.retime(renv.env, rp.spec), same: JSON.stringify(rp.spec) === JSON.stringify(renv.spec) };
  }
  /* 고친 뒤: 남은 장을 새로 계산한 값으로 node 를 바꿔 끼운다(앞 장은 그대로). sub = remainderFixes 의 fix.sub */
  Session.prototype.rebuild = function (sub, base, o) {
    var pl = sub.multi ? sub.days[0].plan : sub;
    var fresh = nodesFrom(pl, o || this.trip.o || { slow: this.meta.slow });
    var keep = this.nodes.slice(0, base.k0 + 1);
    fresh.shift(); // 출발 점은 이미 있는 node(지금까지 온 곳)
    var self = this;
    var off0 = keep.length;
    fresh.forEach(function (n, i) { n.i = off0 + i; keep.push(n); });
    this.nodes = keep; this.trip.nodes = keep;
    // 진행 위치(k)는 그대로: 가는 중이면 base.k0+1 번째(= 같은 자리 장), 머무는 중이면 이 장
    if (this.phase === 'travel') { this.k = Math.min(this.k, this.last()); this.fracMax[this.k] = 0; this.stepI = 0; }
    this.offSince = null; this.offFlag = false; this.inSince = null; this.nextIn = null;
    return this;
  };

  /* ---------- 가상 이동(시연): 실제 길 위를 시간표대로 ---------- */
  function legSegs(session, k) { // k 번째 node 로 가는 구간을 시간 토막으로: [{type:'leg'|'dwell', dur(분), path|at}]
    var n = session.nodes[k], leg = n.leg, a = session.nodes[k - 1].place, b = n.place, out = [];
    if (leg.mode === 'tour' && leg.tour && leg.tour.segs && leg.tour.segs.length === 3) {
      var t = leg.tour, sg = t.segs, wA = t.walkA || 0, wt = t.wait || 0, wB = t.walkB || 0, ride = Math.max(0, leg.min - wA - wt - wB);
      out.push({ type: 'leg', dur: wA, path: sg[0].path, mode: 'walk' });
      out.push({ type: 'dwell', dur: wt, at: { lat: sg[1].path[0][1], lng: sg[1].path[0][0] }, tag: 'board' });
      out.push({ type: 'leg', dur: ride, path: sg[1].path, mode: 'tour' });
      out.push({ type: 'leg', dur: wB, path: sg[2].path, mode: 'walk' });
      return out;
    }
    out.push({ type: 'leg', dur: leg.min, path: session.legPath(k), mode: leg.mode });
    return out;
  }
  function Sim(session) {
    this.s = session; this.speed = 30; this.prog = 0; this.extra = 0; this.t0 = session.nodes[0].arrive; this.segs = [];
    var n0 = session.nodes[0], lead0 = (n0.leave != null && n0.leave > n0.arrive) ? [{ type: 'dwell', dur: n0.leave - n0.arrive, at: { lat: n0.place.lat, lng: n0.place.lng }, node: 0 }] : null;
    this.build(1, lead0);
  }
  Sim.prototype.setSpeed = function (x) { this.speed = x; };
  Sim.prototype.build = function (fromK, first, firstIsLeg) { // fromK 번째 node 로 가는 구간부터 끝까지. first = 첫 토막들(지금 있는 곳에서 시작하는 남은 구간·머무는 시간), firstIsLeg 면 fromK 로 가는 구간은 first 가 대신함
    var s = this.s, segs = [], end = s.last(), k;
    if (first) segs = segs.concat(first);
    for (k = fromK; k <= end; k++) {
      if (!(firstIsLeg && k === fromK)) legSegs(s, k).forEach(function (g) { segs.push(g); });
      if (k < end) { var n = s.nodes[k]; segs.push({ type: 'dwell', dur: Math.max(0, (n.leave || n.arrive) - n.arrive), at: { lat: n.place.lat, lng: n.place.lng }, node: k }); }
    }
    var acc = this.prog; segs.forEach(function (g) { g.t0 = acc; g.len = g.type === 'leg' ? pathLen(g.path) : 0; acc += g.dur; });
    this.segs = segs; this.end = acc;
  };
  Sim.prototype.clock = function () { return this.t0 + this.prog + this.extra; };
  Sim.prototype.tms = function () { return Math.round(this.clock() * 60000); };
  Sim.prototype.done = function () { return this.prog >= this.end + 0.5; }; // 도착 뒤 30초 더 흘러야 도착 감지(10초 머묾)가 끝난다
  Sim.prototype.pos = function () {
    var p = this.prog, segs = this.segs, g, i;
    for (i = 0; i < segs.length; i++) { g = segs[i]; if (p < g.t0 + g.dur || i === segs.length - 1) break; }
    if (!g) { var n0 = this.s.nodes[0].place; return { lat: n0.lat, lng: n0.lng }; }
    if (g.type === 'dwell') return { lat: g.at.lat, lng: g.at.lng };
    var f = g.dur > 0 ? Math.max(0, Math.min(1, (p - g.t0) / g.dur)) : 1;
    return pointAt(g.path, f * g.len);
  };
  Sim.prototype.step = function (dtMin) { this.prog += dtMin; };
  Sim.prototype.delay = function (min) { this.extra += min; };
  /* 코스를 고친 뒤: 지금 있는 곳에서 남은 구간을 새 시간표로 다시 놓는다 */
  Sim.prototype.rebuild = function () {
    var s = this.s, here = this.pos(), now = this.clock();
    if (s.phase === 'done') { this.segs = []; this.end = this.prog; return; }
    var first = [];
    if (s.phase === 'visit') {
      var pr = s.projection(now), left = Math.max(0, pr.leave[s.k] - now);
      first.push({ type: 'dwell', dur: left, at: { lat: here.lat, lng: here.lng }, node: s.k });
      this.build(s.k + 1, first); return;
    }
    var k = s.k, path = s.legPath(k), pl = locate(path, here.lat, here.lng), rest = [[here.lng, here.lat]].concat(path.slice(pl.seg + 1));
    var rem = Math.max(0, s.remainingMin(now));
    first.push({ type: 'leg', dur: rem, path: rest, mode: s.nodes[k].leg.mode });
    this.build(k, first, true);
  };

  var api = { mDist: mDist, pathLen: pathLen, locate: locate, pointAt: pointAt, hm: hm, meters: meters, kakaoLink: kakaoLink, legLink: legLink, buildTrips: buildTrips, shiftTrip: shiftTrip, nodesFrom: nodesFrom, stepsFor: stepsFor,
    Session: Session, Sim: Sim, remainderFixes: remainderFixes, remainderReplan: remainderReplan, remainderEnv: remainderEnv, MODE_NAME: MODE_NAME,
    K: { ARRIVE_R: ARRIVE_R, ARRIVE_RMAX: ARRIVE_RMAX, DWELL_MS: DWELL_MS, LEAVE_M: LEAVE_M, OFF_M: OFF_M, OFF_MS: OFF_MS, STEP_M: STEP_M, LATE_MIN: LATE_MIN } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TourLive = api;
})(typeof window !== 'undefined' ? window : globalThis);
