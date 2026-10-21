/*
 * 코스 고치기 — 자동으로 짠 코스를 사용자가 직접 고치는 계산(순서·머무는 시간·고정·빼기·넣기 + 시각 다시 계산 + 마감 경고 + 고치는 방법).
 * 화면은 app.js, 이동·운영시간 규칙은 planner.js(같은 규칙을 그대로 씀). 인공지능 없이 규칙으로 동작하며 브라우저·Node 양쪽에서 쓴다.
 *
 * 모양
 *  spec  = { v:1, days:[ { items:[ { id, kind?:'meal', pin?, visit?(머무는 분), taxi?(이 장까지 택시), pre?, breakfast? } ], backTaxi? } ], excl:[빼 둔 장소 id], noMeal:bool }
 *          — 사용자가 고친 코스의 "내용". 시각은 들어 있지 않고 retime 이 매번 계산한다. 여러 날이면 days 가 날 수만큼, 장은 자기 날 안에서만 움직인다.
 *  frame = 자동으로 짠 코스(plan 또는 planDays 결과) — 날마다 출발 시각·출발/도착 지점·마감(기차 15분 전 등)만 빌려 쓴다.
 *  env   = { D, o, frame } — o 는 plan() 에 넘긴 것과 같은 옵션(제보 효과 fx, 비, 천천히, 계단, 길 …).
 *
 *  retime(env, spec)  → frame 과 같은 모양의 코스(+ issues, late, edited:true). 순서는 건드리지 않는다(사용자 순서 그대로).
 *  fixes(env, spec)   → 마감·휴무 같은 문제가 있을 때 "한 번 눌러 고치는 방법" 1~3개. 방법마다 실제로 적용해서 문제가 풀리는지 다시 계산해 본 것만 돌려준다.
 *  replan(env, spec, dayIdx, opts) → 고정(📌)한 곳과 그 순서를 지키면서 나머지를 다시 짠다(planner.js o.must).
 *  suggest(env, spec, dayIdx, index, query) → 장소 넣기 시트: 길을 덜 돌아가는 순 + 이름 검색.
 *  applyIntents(env, spec, intents) → "말로 고치기" 의 제안(ai.js aiEditIntent 결과). 적용 전에 보여 줄 diff 를 함께 돌려준다.
 */
(function (root) {
  'use strict';
  var P = root.TourPlanner || (typeof require !== 'undefined' ? require('./planner.js') : null);
  var fmt = P.fmt;
  var BLOCK = { deadline: 1, closed: 1, off: 1, brk: 1, fxclosed: 1 };
  var VISIT_MIN = 10, VISIT_MAX = 240;

  /* ---------- 기본 도구 ---------- */
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function byIdOf(D) { // 식당은 코스에 넣지 않는다(2026-10-18). 끼니 시간 슬롯(meal_…)은 Proxy 로 즉석에서 만든다(자리는 retime 이 앞 장소로 맞춘다)
    var m = {}; D.places.forEach(function (p) { m[p.id] = p; });
    if (typeof Proxy === 'undefined') return m;
    return new Proxy(m, { get: function (t, k) { return (typeof k === 'string' && !(k in t) && P.isSlotId(k)) ? P.slotPlace(k, null) : t[k]; } });
  }
  function isEat(D, id) { return P.isSlotId(id); } // 예전 이름 그대로: 끼니 슬롯인가
  function frames(fr) { return fr.multi ? fr.days.map(function (d) { return d.plan; }) : [fr]; }
  function nDays(fr) { return fr.multi ? fr.days.length : 1; }
  function dateOf(env, di) { return env.frame.multi ? env.frame.days[di].date : (env.frame.date || env.o.date); }
  function norm(s) { return String(s || '').replace(/\s+/g, ''); }
  function legger(env, di) {
    env._lg = env._lg || {};
    var dt = dateOf(env, di), k = String(dt);
    if (!env._lg[k]) env._lg[k] = P.makeLegger(Object.assign({}, env.o, { date: dt }));
    return env._lg[k];
  }
  function allIds(spec) { var m = {}; spec.days.forEach(function (d) { d.items.forEach(function (it) { m[it.id] = true; }); }); return m; }
  function findItem(spec, id) { for (var di = 0; di < spec.days.length; di++) for (var i = 0; i < spec.days[di].items.length; i++) if (spec.days[di].items[i].id === id) return { di: di, i: i, it: spec.days[di].items[i] }; return null; }
  function visitOf(env, it) { var p = byIdOf(env.D)[it.id]; return it.visit != null ? it.visit : (p ? p.visit : 30); }

  /* ---------- 코스 → spec ---------- */
  function itemOf(s) {
    var it = { id: s.id, visit: Math.round(s.leave - s.startVisit - (s.delay || 0)) };
    if (s.kind === 'meal') it.kind = 'meal';
    if (s.breakfast) it.breakfast = true;
    if (s.pre) it.pre = true;
    return it;
  }
  function fromPlan(pl) {
    return { v: 1, days: frames(pl).map(function (q) { return { items: q.stops.map(itemOf) }; }), excl: [], noMeal: false };
  }

  /* ---------- 시각 다시 계산 (사용자 순서 그대로) ---------- */
  function lateText(env, fp, di, late, back) {
    var o = env.o, multi = env.frame.multi, lastDay = di === nDays(env.frame) - 1;
    if (multi && !lastDay) return (di + 1) + '일차 밤 ' + fmt(fp.deadline) + '까지 숙소에 못 가요 (' + late + '분 늦음)';
    var how = o.backHow || o.how || 'train';
    if (how === 'car') return '이대로면 정한 시각 ' + fmt(fp.train) + '에 ' + late + '분 늦게 돌아와요';
    var HN = how === 'bus' ? '버스' : '기차';
    if (back.arrive > fp.train) return '이대로면 ' + fmt(fp.train) + ' ' + HN + '를 놓쳐요 (' + (back.arrive - fp.train) + '분 늦음)';
    return '이대로면 ' + fmt(fp.train) + ' ' + HN + ' ' + (fp.deadline === fp.train ? '' : '15분 전에 ') + '못 닿아요 (' + late + '분 늦음)';
  }
  function retime(env, spec) {
    var D = env.D, o = env.o, fr = env.frame, multi = !!fr.multi, fx = o.fx || { closed: {}, crowd: {}, view: {}, news: {}, menu: {}, active: [], pending: [] };
    var by = byIdOf(D), slow = !!o.slow, fl = frames(fr), issues = [];
    var plans = fl.map(function (f, di) {
      var LG = legger(env, di), day = spec.days[di] || { items: [] }, dinfo = P.dateInfo(dateOf(env, di));
      var pos = f.startStation, t = f.start, stops = [], local = [];
      day.items.forEach(function (it) {
        var pl = by[it.id]; if (!pl) return;
        var slot = !!pl.slot; if (slot) pl = P.slotPlace(it.id, pos);
        var rp = P.realPos(pos);
        var l = slot ? P.SLOT_LEG : (it.taxi && !LG.carBoth) ? LG.legTaxi(rp, pl, slow) : LG.legAt(rp, pl, slow, t);
        var arr = t + l.min, wait = 0;
        var opn = (it.pre && !it.breakfast) ? [0, 1440] : pl.open; // 새벽 일출 장은 해 뜨는 시각에 맞춘 것이라 운영시간을 따지지 않는다(자동 코스와 같게)
        if (arr < opn[0]) wait = opn[0] - arr;
        var sv = arr + wait, c = fx.crowd[pl.id], delay = c && sv < c.until ? c.delay : 0, vis = it.visit != null ? it.visit : pl.visit, leave = sv + delay + vis;
        var s = { id: pl.id, place: pl, kind: it.kind === 'meal' || isEat(D, pl.id) ? 'meal' : undefined, legMin: l.min, mode: l.mode, moveText: l.text, path: l.path, tour: l.tour || null, real: !!l.real, fare: l.fare, transfers: l.transfers, taxiMin: l.taxi, arrive: arr, wait: wait, delay: delay, startVisit: sv, leave: leave, visit: vis, pin: !!it.pin, edited: true };
        if (it.breakfast) s.breakfast = true;
        if (it.pre) s.pre = true;
        if (it.taxi) s.taxiSet = true;
        if (multi) s.day = di;
        var idx = stops.length, mine = [];
        function add(kind, level, text, extra) { var x = { kind: kind, level: level, id: pl.id, day: di, idx: idx, text: text }; if (extra) for (var k in extra) x[k] = extra[k]; mine.push(x); }
        if (pl.dayRule && pl.dayRule.lastDigit && !(dinfo && pl.dayRule.lastDigit.indexOf(dinfo.d % 10) >= 0)) add('off', 'block', pl.short + '은 장날(' + pl.dayRule.lastDigit.join('·') + '일)에만 열려요');
        if (pl.closedDow && dinfo && pl.closedDow.indexOf(dinfo.dow) >= 0) add('off', 'block', pl.short + '은 오늘 쉬는 날이에요 (' + (pl.restText || '정기 휴무') + ')');
        if (fx.closed[pl.id]) add('fxclosed', 'block', pl.short + ' 오늘 휴무 제보가 있어요');
        if (!mine.length && (sv >= opn[1] || leave > opn[1])) add('closed', 'block', pl.short + ' 문 닫는 시각(' + fmt(pl.open[1]) + ') 뒤에 끝나요 — 이대로면 ' + fmt(leave) + '에 끝나요');
        if (pl.brk && sv < pl.brk[1] && leave > pl.brk[0]) add('brk', 'block', pl.short + ' 쉬는 시간(' + fmt(pl.brk[0]) + '~' + fmt(pl.brk[1]) + ')에 걸려요');
        if (wait >= 15) add('wait', 'info', pl.short + '은 ' + fmt(pl.open[0]) + '에 열어서 ' + wait + '분 기다려요');
        if (delay) add('fxcrowd', 'info', pl.short + ' 줄 제보로 ' + delay + '분 기다려요');
        if (o.rain && pl.rainAvoid) add('rain', 'warn', pl.short + '은 야외라 비 오는 날엔 아쉬워요');
        if (o.avoidStairs && (pl.stairs || pl.trail)) add('stairs', 'warn', pl.short + (pl.trail ? ' 걷는 길이 길어요' : ' 계단이 있어요') + ' — 천천히 걷는 일행에겐 힘들 수 있어요');
        s.issues = mine; local = local.concat(mine);
        stops.push(s); pos = pl; t = leave;
      });
      var endSt = f.endStation, bl;
      var rpEnd = P.realPos(pos);
      if (rpEnd === endSt) bl = { min: 0, mode: 'walk', text: '', path: null, real: false };
      else bl = (day.backTaxi && !LG.carBoth) ? LG.legTaxi(rpEnd, endSt, slow) : LG.legAt(rpEnd, endSt, slow, t);
      var back = { arrive: t + bl.min, mode: bl.mode, min: bl.min, text: bl.text, path: bl.path, real: !!bl.real, from: rpEnd, tour: bl.tour || null, taxiMin: bl.taxi, taxiSet: !!day.backTaxi };
      var late = Math.max(0, back.arrive - f.deadline);
      if (late > 0) local.push({ kind: 'deadline', level: 'block', id: null, day: di, idx: stops.length, minutes: late, text: lateText(env, f, di, late, back) });
      local.forEach(function (x) { issues.push(x); });
      var ctOn = !!LG.ct, tour = { enabled: ctOn, day: LG.tday, used: false, rides: 0, legs: [], fareText: ctOn ? P.tourFareText(LG.ct) : '' };
      stops.forEach(function (s) { if (s.mode === 'tour' && s.tour) { tour.rides++; tour.legs.push(s.id); } });
      if (back.mode === 'tour' && back.tour) { tour.rides++; tour.legs.push('back'); }
      tour.used = tour.rides > 0;
      var np = Object.assign({}, f, { stops: stops, back: back, feasible: stops.length > 0 || late <= 0, late: late, issues: local, edited: true, tour: tour, mealNeeded: false, meal: stops.filter(function (s) { return s.kind === 'meal'; })[0] || null });
      return np;
    });
    var out;
    if (multi) {
      var days = fr.days.map(function (d, di) { return Object.assign({}, d, { plan: plans[di] }); });
      var last = plans[plans.length - 1];
      out = Object.assign({}, fr, { days: days, stops: [], back: last.back, feasible: plans.every(function (q) { return q.feasible; }) });
      days.forEach(function (d) { out.stops = out.stops.concat(d.plan.stops); });
      out.tour = { enabled: plans.some(function (q) { return q.tour.enabled; }), day: plans[0].tour.day, used: false, rides: 0, legs: [], fareText: plans[0].tour.fareText };
      plans.forEach(function (q) { out.tour.rides += q.tour.rides; out.tour.legs = out.tour.legs.concat(q.tour.legs); });
      out.tour.used = out.tour.rides > 0;
      out.meal = out.stops.filter(function (s) { return s.kind === 'meal'; })[0] || null;
      out.mealNeeded = false;
    } else out = plans[0];
    out.issues = issues; out.edited = true;
    out.late = plans.reduce(function (a, q) { return a + q.late; }, 0);
    return out;
  }
  function blocks(rt, di) { return rt.issues.filter(function (x) { return x.level === 'block' && (di == null || x.day === di); }); }

  /* ---------- 고치는 동작 (모두 새 spec 을 돌려준다. 못 하면 null) ---------- */
  function moveItem(spec, di, i, dir) {
    var items = spec.days[di] && spec.days[di].items, j = i + dir; if (!items || i < 0 || i >= items.length || j < 0 || j >= items.length) return null;
    var n = clone(spec), a = n.days[di].items; var t = a[i]; a[i] = a[j]; a[j] = t; return n;
  }
  function moveTo(spec, di, i, j) {
    var items = spec.days[di] && spec.days[di].items; if (!items || i < 0 || i >= items.length) return null;
    j = Math.max(0, Math.min(items.length - 1, j)); if (i === j) return null;
    var n = clone(spec), a = n.days[di].items, x = a.splice(i, 1)[0]; a.splice(j, 0, x); return n;
  }
  function removeItem(spec, id) {
    var f = findItem(spec, id); if (!f) return null;
    var n = clone(spec), it = n.days[f.di].items.splice(f.i, 1)[0];
    if (n.excl.indexOf(id) < 0) n.excl.push(id);
    if (it.kind === 'meal' && !it.breakfast) n.noMeal = true;
    return n;
  }
  function addItem(env, spec, di, index, id) {
    var pl = byIdOf(env.D)[id]; if (!pl || allIds(spec)[id] || !spec.days[di]) return null;
    var n = clone(spec), it = { id: id, visit: pl.visit };
    if (isEat(env.D, id)) { it.kind = 'meal'; n.noMeal = false; }
    if (pl.slot) it.visit = P.SLOT_VISIT[P.slotKindOf(id)] || 50;
    n.days[di].items.splice(Math.max(0, Math.min(n.days[di].items.length, index)), 0, it);
    n.excl = n.excl.filter(function (x) { return x !== id; });
    return n;
  }
  function adjustVisit(env, spec, id, delta) {
    var f = findItem(spec, id); if (!f) return null;
    var cur = visitOf(env, f.it), nv = Math.max(VISIT_MIN, Math.min(VISIT_MAX, cur + delta)); if (nv === cur) return null;
    var n = clone(spec); n.days[f.di].items[f.i].visit = nv; return n;
  }
  function setPin(spec, id, on) {
    var f = findItem(spec, id); if (!f) return null;
    var n = clone(spec), it = n.days[f.di].items[f.i]; if (on == null) on = !it.pin;
    if (on) it.pin = true; else delete it.pin; return n;
  }
  function setTaxi(spec, id, on) { // 그 장까지 가는 길을 택시로 (on===false 면 되돌림)
    var n = clone(spec), f = findItem(n, id); if (!f) return null;
    if (on === false) delete f.it.taxi; else f.it.taxi = true; return n;
  }
  function setBackTaxi(spec, di, on) { // 마지막 장 → 돌아갈 곳을 택시로
    var n = clone(spec); if (!n.days[di]) return null; if (on === false) delete n.days[di].backTaxi; else n.days[di].backTaxi = true; return n;
  }

  /* ---------- 되돌리기 / 다시하기 ---------- */
  function History(initial, limit) { this.cur = initial; this.undoS = []; this.redoS = []; this.limit = limit || 50; }
  History.prototype.push = function (spec) { if (!spec) return false; this.undoS.push(JSON.stringify(this.cur)); if (this.undoS.length > this.limit) this.undoS.shift(); this.redoS = []; this.cur = spec; return true; };
  History.prototype.undo = function () { if (!this.undoS.length) return false; this.redoS.push(JSON.stringify(this.cur)); this.cur = JSON.parse(this.undoS.pop()); return true; };
  History.prototype.redo = function () { if (!this.redoS.length) return false; this.undoS.push(JSON.stringify(this.cur)); this.cur = JSON.parse(this.redoS.pop()); return true; };
  History.prototype.canUndo = function () { return this.undoS.length > 0; };
  History.prototype.canRedo = function () { return this.redoS.length > 0; };
  History.prototype.pack = function () { return JSON.stringify({ v: 1, cur: this.cur, undo: this.undoS, redo: this.redoS }); };
  History.unpack = function (txt, limit) {
    try { var o = JSON.parse(txt); if (!o || !o.cur || !o.cur.days) return null; var h = new History(o.cur, limit); h.undoS = (o.undo || []).slice(-(limit || 50)); h.redoS = o.redo || []; return h; } catch (e) { return null; }
  };

  /* ---------- 나머지 다시 짜기 (고정 유지) ---------- */
  function dayPlanOpts(env, spec, di, over) {
    var o = env.o, fr = env.frame, multi = !!fr.multi, f = multi ? fr.days[di].plan : fr, last = di === nDays(fr) - 1;
    var pins = [], vOv = {}, items = spec.days[di].items || [], lead = 0;
    while (lead < items.length && (items[lead].pre || items[lead].breakfast)) lead++; // 새벽 일출·아침 한 끼처럼 맨 앞에 시각이 정해진 장은 그대로 두고(고정 시작) 그 뒤부터만 짠다
    var fixed = lead ? dayStops(env, spec, di).slice(0, lead) : [];
    items.forEach(function (it, k) {
      if (k < lead) return;
      if (it.pin) { pins.push(it.id); if (it.visit != null) vOv[it.id] = it.visit; }
    });
    if (over && over.noPins) { pins = []; vOv = {}; }
    var other = [], seen = {};
    spec.days.forEach(function (d, k) { if (k !== di) d.items.forEach(function (it) { other.push(it.id); seen[it.id] = 1; }); });
    var avoid = (o.avoid || []).concat(spec.excl || [], other);
    if (multi) {
      var hasChuam = spec.days.some(function (d, k) { return k !== di && d.items.some(function (it) { var q = env.D.places.filter(function (p) { return p.id === it.id; })[0]; return q && q.group === 'chuam'; }); });
      if (hasChuam) env.D.places.forEach(function (p) { if (p.group === 'chuam') avoid.push(p.id); });
    }
    var hasPinMeal = pins.some(function (id) { return isEat(env.D, id); });
    var base = Object.assign({}, o, { date: dateOf(env, di), fixed: fixed, must: pins, visitOv: vOv, avoid: avoid, meal: (spec.noMeal && !hasPinMeal) ? false : o.meal });
    base.now = f.start; base.train = f.train;
    if (multi) {
      base.startStation = f.startStation; base.start = undefined; base.endStation = f.endStation; base.end = undefined; base.now = f.start; base.train = f.train; base.mode = f.mode;
      base.max = last ? undefined : 8; if (!last) { base.buffer = 0; base.backHow = f.howOut; }
    }
    if (over) for (var k in over) if (k !== 'noPins') base[k] = over[k];
    return base;
  }
  function dayStops(env, spec, di) { var rt = retime(env, spec); return rt.multi ? rt.days[di].plan.stops : rt.stops; }
  function replan(env, spec, di, over) {
    var o2 = dayPlanOpts(env, spec, di, over), res;
    try { res = P.plan(env.D, o2); } catch (e) { return { ok: false, why: '다시 짜지 못했어요' }; }
    if (!res.feasible) return { ok: false, why: '고정한 곳과 시간 때문에 짤 수 없어요' };
    var pinned = {}; (spec.days[di].items || []).forEach(function (it) { if (it.pin && !(over && over.noPins)) pinned[it.id] = true; });
    var n = clone(spec);
    n.days[di].items = res.stops.map(function (s) { var it = itemOf(s); if (pinned[s.id]) it.pin = true; if (s.done) it.pre = true; return it; });
    n.days[di].backTaxi = undefined; delete n.days[di].backTaxi;
    return { ok: true, spec: n };
  }

  /* ---------- 한 번 눌러 고치는 방법 ---------- */
  function placeLoss(env, p) { if (p && p.slot) return 40; var v = P.placeValue ? P.placeValue(p, env.o, env.o.fx || { view: {}, news: {} }) : (p.value || 10); return v; }
  function fixes(env, spec) {
    var rt = retime(env, spec), bl = blocks(rt);
    if (!bl.length) return { rt: rt, problems: [], fixes: [] };
    var dv = bl[0].day, by = byIdOf(env.D), day = rt.multi ? rt.days[dv].plan : rt, cands = [];
    var before = blocks(rt, dv).length;
    function check(ns) { if (!ns) return null; var r2 = retime(env, ns); var left = blocks(r2, dv); return { rt: r2, left: left.length, late: r2.issues.filter(function (x) { return x.kind === 'deadline' && x.day === dv; }).reduce(function (a, x) { return a + x.minutes; }, 0) }; }
    var viol = bl.filter(function (x) { return x.kind === 'deadline' && x.day === dv; })[0];
    var items = spec.days[dv].items;
    // 1) 머무는 시간 줄이기 (마감이 문제일 때) — 가장 오래 머무는 곳부터 10분씩, 한 곳은 20분 밑으로 안 내림
    if (viol) {
      var ns = clone(spec), steps = {}, total = 0, guard = 0, ok = false;
      while (guard++ < 40) {
        var r1 = retime(env, ns); if (!blocks(r1, dv).some(function (x) { return x.kind === 'deadline'; })) { ok = true; break; }
        var order = ns.days[dv].items.slice().sort(function (a, b) { return visitOf(env, b) - visitOf(env, a); }), pick = null;
        for (var q = 0; q < order.length; q++) { var cur = visitOf(env, order[q]); if (cur - 10 >= 20 && !order[q].breakfast && !order[q].pre) { pick = order[q]; break; } }
        if (!pick) break;
        pick.visit = visitOf(env, pick) - 10; steps[pick.id] = (steps[pick.id] || 0) + 10; total += 10;
      }
      if (ok && total > 0 && total <= 60) {
        var c = check(ns);
        if (c && c.left === 0) cands.push({ kind: 'shorten', label: '머무는 시간 ' + total + '분 줄이기', detail: Object.keys(steps).map(function (id) { return by[id].short + ' −' + steps[id] + '분'; }).join(' · '), spec: ns });
      }
    }
    // 2) 택시로 바꾸기 — 걷거나 버스로 가는 가장 긴 구간
    if (viol && !(env.o.how === 'car' && (env.o.backHow || 'car') === 'car')) {
      var legs = day.stops.filter(function (s) { return !(s.place && s.place.slot); }).map(function (s, i) { return { id: s.id, min: s.legMin, taxi: s.taxiMin, mode: s.mode, name: (i ? day.stops[i - 1].place.short : day.startStation.name.replace(/역$/, '')) + ' → ' + s.place.short, set: s.taxiSet }; });
      legs.push({ id: 'back', min: day.back.min, taxi: day.back.taxiMin, mode: day.back.mode, name: (day.stops.length ? day.stops[day.stops.length - 1].place.short : day.startStation.name) + ' → ' + day.endStation.name, set: day.back.taxiSet });
      legs = legs.filter(function (l) { return !l.set && l.mode !== 'taxi' && l.mode !== 'car' && l.taxi != null && l.taxi < l.min; }).sort(function (a, b) { return (b.min - b.taxi) - (a.min - a.taxi); });
      for (var lg = 0; lg < legs.length; lg++) {
        var L = legs[lg], nt = clone(spec);
        if (L.id === 'back') nt.days[dv].backTaxi = true; else { var ff = findItem(nt, L.id); ff.it.taxi = true; }
        var ct = check(nt);
        if (ct && ct.left === 0) { cands.push({ kind: 'taxi', label: '택시로 바꾸기', detail: L.name + ' (' + (L.min - L.taxi) + '분 줄어요)', spec: nt }); break; }
      }
    }
    // 3) 빼기 — 안 고정한 곳 중 (또는 문제가 난 그 곳) 빼면 풀리는 곳 가운데 가장 덜 아까운 곳
    var probIds = {}; bl.forEach(function (x) { if (x.id) probIds[x.id] = true; });
    var rem = [];
    items.forEach(function (it) {
      if (it.pin && !probIds[it.id]) return;
      if (it.pre || it.breakfast) return;
      var nr = removeItem(spec, it.id), cr = check(nr);
      if (cr && cr.left === 0) rem.push({ it: it, loss: placeLoss(env, by[it.id]) + (it.pin ? 100 : 0), spec: nr });
    });
    rem.sort(function (a, b) { return a.loss - b.loss; });
    if (rem.length) cands.push({ kind: 'remove', label: by[rem[0].it.id].short + ' 빼기', detail: '코스에서 뺄 곳: ' + by[rem[0].it.id].name + (rem[0].it.pin ? ' (고정이 풀려요)' : ''), spec: rem[0].spec });
    // 4) 나머지 다시 짜기 (고정 유지)
    var rp = replan(env, spec, dv);
    if (rp.ok) { var cr2 = check(rp.spec); if (cr2 && cr2.left === 0) cands.push({ kind: 'replan', label: '나머지 다시 짜기 (고정 유지)', detail: '📌 고정한 곳과 그 순서는 그대로 두고 나머지를 새로 짜요', spec: rp.spec }); }
    else if (spec.days[dv].items.some(function (it) { return it.pin; })) {
      var rp2 = replan(env, spec, dv, { noPins: true });
      if (rp2.ok) { var cr3 = check(rp2.spec); if (cr3 && cr3.left === 0) cands.push({ kind: 'replan', label: '고정 풀고 다시 짜기', detail: '고정한 곳 때문에 시간이 안 맞아요. 고정을 풀고 새로 짜요', spec: rp2.spec }); }
    }
    // 한 번에 풀리는 방법이 없으면 문제를 줄이는 것이라도
    var list = cands.slice();
    if (!list.length) {
      var partial = [];
      var rpAny = replan(env, spec, dv, { noPins: true });
      if (rpAny.ok) { var pc = check(rpAny.spec); if (pc && pc.left < before) partial.push({ kind: 'replan', label: '고정 풀고 다시 짜기', detail: '문제를 줄여 줘요', spec: rpAny.spec, partial: true }); }
      list = partial;
    }
    // 눌러 볼 방법은 최대 3개: 가볍게 고치는 것부터, 다시 짜기는 꼭 넣는다
    var rank = { shorten: 1, taxi: 2, remove: 3, replan: 4 };
    list.sort(function (a, b) { return rank[a.kind] - rank[b.kind]; });
    if (list.length > 3) { var rpl = list.filter(function (x) { return x.kind === 'replan'; })[0]; list = list.filter(function (x) { return x.kind !== 'replan'; }).slice(0, rpl ? 2 : 3); if (rpl) list.push(rpl); }
    return { rt: rt, problems: bl, fixes: list };
  }

  /* ---------- 장소 넣기 ---------- */
  function plainOf(p) { return norm(p.name + p.short + (p.region || '') + (p.tags || []).join('')); }
  function isEatery(p) { return p && p.id && String(p.id).indexOf('eat_') === 0; }
  function evalInsert(env, spec, di, index, id, baseRt) {
    var ns = addItem(env, spec, di, index, id); if (!ns) return null;
    var r = retime(env, ns), fp = r.multi ? r.days[di].plan : r, bp = baseRt.multi ? baseRt.days[di].plan : baseRt;
    var idx = Math.min(index, fp.stops.length - 1), me = fp.stops[idx], nx = fp.stops[idx + 1];
    var oldNext = bp.stops[index] ? bp.stops[index].legMin : bp.back.min, newNext = nx ? nx.legMin : fp.back.min;
    var detour = Math.max(0, me.legMin + newNext - oldNext);
    var mine = r.issues.filter(function (x) { return x.id === id; });
    var lateNew = fp.late, lateOld = bp.late, cautions = [];
    mine.forEach(function (x) { if (x.kind !== 'fxcrowd') cautions.push({ level: x.level === 'block' ? 'block' : x.level, text: x.text }); });
    if (lateNew > lateOld) cautions.push({ level: 'block', text: lateText(env, fp, di, lateNew, fp.back).replace(/^이대로면 /, '넣으면 ') });
    var pl = me.place;
    return { id: id, place: pl, kind: isEat(env.D, id) ? 'meal' : 'place', detour: detour, visit: me.visit, arrive: me.arrive, addTotal: fp.back.arrive - bp.back.arrive, cautions: cautions, blocked: cautions.some(function (c) { return c.level === 'block'; }), spec: ns, rt: r };
  }
  function suggest(env, spec, di, index, query) {
    var by = byIdOf(env.D), have = allIds(spec), baseRt = retime(env, spec), q = norm(query), out = [];
    Object.keys(by).forEach(function (id) {
      if (have[id]) return;
      var p = by[id];
      if (q && plainOf(p).indexOf(q) < 0) return;
      var r = evalInsert(env, spec, di, index, id, baseRt); if (!r) return;
      delete r.spec; delete r.rt; out.push(r);
    });
    out.sort(function (a, b) { return (a.blocked - b.blocked) || (a.detour - b.detour) || (a.addTotal - b.addTotal); });
    return out;
  }
  /* 말로 넣기용: 가장 덜 돌아가는(그리고 문제 없는) 자리에 넣은 spec. mealAt 이면 그 시각(분) 근처에 시작하는 자리를 선호 */
  function bestInsert(env, spec, di, id, mealAt) {
    var baseRt = retime(env, spec), best = null, n = spec.days[di].items.length;
    for (var i = 0; i <= n; i++) {
      var r = evalInsert(env, spec, di, i, id, baseRt); if (!r) return null;
      var sc = (r.blocked ? 1000 : 0) + r.addTotal + (mealAt != null ? Math.abs(r.arrive - mealAt) * 0.6 : 0);
      if (!best || sc < best.sc) best = { sc: sc, r: r, i: i };
    }
    return best;
  }

  /* ---------- 말로 고치기: 제안 만들기 (ai.js aiEditIntent 결과 → 새 spec + 보여 줄 diff) ---------- */
  function lowestValueUnpinned(env, spec, di) {
    var by = byIdOf(env.D), best = null;
    spec.days[di].items.forEach(function (it) { if (it.pin || it.pre || it.breakfast || it.kind === 'meal') return; var v = placeLoss(env, by[it.id]); if (!best || v < best.v) best = { v: v, id: it.id }; });
    return best ? best.id : null;
  }
  function describe(env, a, b) {
    var by = byIdOf(env.D), pa = {}, pb = {}, out = { removed: [], added: [], addedIds: [], moved: [], stay: [] };
    function walk(spec, m) { spec.days.forEach(function (d, di) { d.items.forEach(function (it, i) { m[it.id] = { di: di, i: i, v: visitOf(env, it), it: it }; }); }); }
    walk(a, pa); walk(b, pb);
    Object.keys(pa).forEach(function (id) { if (!pb[id]) out.removed.push(by[id].short); });
    Object.keys(pb).forEach(function (id) { if (!pa[id]) { out.added.push(by[id].short); out.addedIds.push(id); } });
    Object.keys(pb).forEach(function (id) {
      if (!pa[id]) return;
      if (pa[id].v !== pb[id].v) out.stay.push(by[id].short + ' ' + (pb[id].v > pa[id].v ? '+' : '−') + Math.abs(pb[id].v - pa[id].v) + '분');
    });
    // 빠지고 들어간 것 때문에 순서가 밀린 곳은 "순서 바뀜" 에 넣지 않는다 — 실제로 앞뒤 순서가 달라진 곳만
    var common = Object.keys(pb).filter(function (id) { return pa[id]; });
    var oa = common.slice().sort(function (x, y) { return pa[x].di - pa[y].di || pa[x].i - pa[y].i; }), ob = common.slice().sort(function (x, y) { return pb[x].di - pb[y].di || pb[x].i - pb[y].i; });
    out.moved = oa.join() === ob.join() ? [] : ob.filter(function (id, k) { return oa[k] !== id; }).map(function (id) { return by[id].short; });
    return out;
  }
  function mealWindow(kind) { return kind === 'dinner' ? 18 * 60 : kind === 'breakfast' ? 8 * 60 : 12 * 60 + 30; }
  var SEA = /해변|해수욕장|수변공원|바다|묵호항|항구/;
  function applyIntents(env, spec0, intents) {
    var by = byIdOf(env.D), spec = clone(spec0), msgs = [], changed = false;
    function dayOf(id) { var f = findItem(spec, id); return f ? f.di : -1; }
    function doAdd(id, mealAt) {
      if (allIds(spec)[id]) { msgs.push(by[id].short + '은 이미 코스에 있어요'); return false; }
      var best = null, bd = -1;
      for (var di = 0; di < spec.days.length; di++) { var b = bestInsert(env, spec, di, id, mealAt); if (b && (!best || b.sc < best.sc)) { best = b; bd = di; } }
      if (!best) { msgs.push(by[id].short + '을 넣을 자리를 못 찾았어요'); return false; }
      spec = addItem(env, spec, bd, best.i, id); return true;
    }
    function autoFit() { // 마감이 넘으면 가장 덜 아까운 곳부터 빼서 맞춘다
      for (var g = 0; g < 8; g++) {
        var rt = retime(env, spec), b = blocks(rt).filter(function (x) { return x.kind === 'deadline'; })[0]; if (!b) return;
        var id = lowestValueUnpinned(env, spec, b.day); if (!id) return;
        spec = removeItem(spec, id); msgs.push('시간이 모자라 ' + by[id].short + '은 뺐어요');
      }
    }
    intents.forEach(function (it) {
      if (it.type === 'remove') {
        (it.ids || []).forEach(function (id) { var n = removeItem(spec, id); if (n) { spec = n; changed = true; } else msgs.push(by[id].short + '은 코스에 없어요'); });
      } else if (it.type === 'removeMeal') {
        var ms = []; spec.days.forEach(function (d) { d.items.forEach(function (x) { if (x.kind === 'meal' && !x.breakfast) ms.push(x.id); }); });
        if (it.when) {
          var rt0 = retime(env, spec), keep = ms.filter(function (id) { var s = rt0.stops.filter(function (q) { return q.id === id; })[0]; return s && ((it.when === 'lunch' && s.startVisit < 15 * 60) || (it.when === 'dinner' && s.startVisit >= 15 * 60)); });
          ms = keep;
        }
        if (!ms.length) msgs.push('빼 줄 식사가 코스에 없어요');
        ms.forEach(function (id) { spec = removeItem(spec, id); changed = true; });
        spec.noMeal = true;
      } else if (it.type === 'add') {
        (it.ids || []).forEach(function (id) { if (doAdd(id)) changed = true; });
      } else if (it.type === 'addMeal') { // 식당이 아니라 끼니 '시간'만 넣는다(점심·저녁·아침)
        var kd = it.when === 'dinner' ? 'dinner' : it.when === 'breakfast' ? 'breakfast' : 'lunch', pickS = null;
        for (var di4 = 0; di4 < spec.days.length; di4++) {
          var sid = P.slotId(kd, dateOf(env, di4));
          if (allIds(spec)[sid]) { msgs.push(P.SLOT_NAME[kd] + ' 시간은 이미 있어요'); continue; }
          var bI = bestInsert(env, spec, di4, sid, mealWindow(kd)); if (bI && (!pickS || bI.sc < pickS.sc)) pickS = { sc: bI.sc, id: sid, di: di4, i: bI.i };
        }
        if (pickS) { spec = addItem(env, spec, pickS.di, pickS.i, pickS.id); changed = true; msgs.push('식당은 정하지 않아요 — ' + P.SLOT_NAME[kd] + ' 먹는 시간만 잡아 드려요'); } else if (!msgs.length) msgs.push('넣을 자리를 못 찾았어요');
      } else if (it.type === 'addTheme') {
        var have = allIds(spec), cs = env.D.places.filter(function (p) { return !have[p.id] && SEA.test(p.name) && !(env.o.rain && p.rainAvoid); }), pk = null;
        cs.forEach(function (p) { for (var di = 0; di < spec.days.length; di++) { var b = bestInsert(env, spec, di, p.id); if (b && (!pk || b.sc < pk.sc)) pk = { sc: b.sc, id: p.id, di: di, i: b.i }; } });
        if (pk) { spec = addItem(env, spec, pk.di, pk.i, pk.id); changed = true; } else msgs.push('더 넣을 바다 쪽 곳을 못 찾았어요');
      } else if (it.type === 'indoor') {
        var before = JSON.stringify(spec);
        for (var di2 = 0; di2 < spec.days.length; di2++) {
          var r = replan(env, spec, di2, { rain: true });
          if (r.ok) spec = r.spec;
        }
        if (JSON.stringify(spec) === before) msgs.push('이미 실내 위주예요'); else changed = true;
      } else if (it.type === 'slower') {
        spec.days.forEach(function (d) { d.items.forEach(function (x) { if (x.pin || x.pre || x.breakfast) return; x.visit = Math.min(VISIT_MAX, visitOf(env, x) + 10); changed = true; }); });
        autoFit();
      } else if (it.type === 'longer' || it.type === 'shorter') {
        var sgn = it.type === 'longer' ? 1 : -1;
        if (it.ids && it.ids.length) it.ids.forEach(function (id) { var n = adjustVisit(env, spec, id, sgn * 20); if (n) { spec = n; changed = true; } else msgs.push(by[id].short + '은 코스에 없어요'); });
        else { spec.days.forEach(function (d) { d.items.forEach(function (x) { if (x.pin || x.pre || x.breakfast) return; var nv = Math.max(VISIT_MIN, Math.min(VISIT_MAX, visitOf(env, x) + sgn * 10)); if (nv !== visitOf(env, x)) { x.visit = nv; changed = true; } }); }); }
        if (sgn > 0) autoFit();
      } else if (it.type === 'first' || it.type === 'last') {
        (it.ids || []).forEach(function (id) {
          var f = findItem(spec, id);
          if (!f) { if (!allIds(spec)[id]) { var di3 = it.type === 'first' ? 0 : spec.days.length - 1, n2 = addItem(env, spec, di3, it.type === 'first' ? 0 : 999, id); if (n2) { spec = n2; changed = true; } } return; }
          var n = moveTo(spec, f.di, f.i, it.type === 'first' ? 0 : 999);
          if (n) { spec = n; changed = true; } else msgs.push(by[id].short + '은 이미 ' + (it.type === 'first' ? '맨 처음' : '맨 끝') + '이에요');
        });
      } else if (it.type === 'unknown') msgs.push(it.why || '무슨 뜻인지 못 알아들었어요');
    });
    var ok = JSON.stringify(spec) !== JSON.stringify(spec0);
    var diff = describe(env, spec0, spec), after = ok ? retime(env, spec) : null;
    return { ok: ok, spec: spec, diff: diff, msgs: msgs, issues: after ? after.issues.filter(function (x) { return x.level === 'block'; }) : [] };
  }

  /* ---------- 저장 (새로 고쳐도 유지): store = { get(k), set(k,v), del(k) } ---------- */
  function sigOf(obj) { var t = JSON.stringify(obj), h = 5381; for (var i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0; return h.toString(36); }
  function save(store, key, hist) { store.set(key, hist.pack()); }
  function load(store, key, limit) { var t = store.get(key); return t ? History.unpack(t, limit) : null; }

  var api = { sigOf: sigOf, save: save, load: load, fromPlan: fromPlan, retime: retime, blocks: blocks, fixes: fixes, replan: replan, suggest: suggest, bestInsert: bestInsert, evalInsert: evalInsert, applyIntents: applyIntents, describe: describe,
    moveItem: moveItem, moveTo: moveTo, setBackTaxi: setBackTaxi, removeItem: removeItem, addItem: addItem, adjustVisit: adjustVisit, setPin: setPin, setTaxi: setTaxi, History: History, findItem: findItem, allIds: allIds, visitOf: visitOf, byIdOf: byIdOf, clone: clone, VISIT_MIN: VISIT_MIN, VISIT_MAX: VISIT_MAX };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TourEdit = api;
})(typeof window !== 'undefined' ? window : globalThis);
