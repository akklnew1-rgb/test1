/* 코스 한 그림(전체 지도) — 코스(plan)에서 번호 붙은 장·날짜별 선을 뽑고, 그림(SVG)·미리 보기 움직임·저장용 그림·오늘 꼭 알아야 할 것을 계산한다.
   화면 연결은 app.js. 브라우저·Node 양쪽. 키·네트워크 없음(미리 받아 둔 지도 그림 ROUTES.maps 또는 좌표만 그린 깨끗한 SVG).
   model(plan) → { nDays, nodes:[{i,kind:'start'|'stop'|'stay'|'end',n?,label,name,lat,lng,day,t,leave?}], legs:[{from,to,day,path:[[lng,lat]],est,tour,t0,t1,len}], marks:[…그릴 표시…] }
   모든 경로는 live.js 와 같은 [경도, 위도] 쌍 목록이라 TourLive.pointAt / pathLen 을 그대로 쓴다. */
(function (root) {
  'use strict';
  var LV = root.TourLive || (typeof require !== 'undefined' ? require('./live.js') : null);
  var RSV = '시티투어는 미리 예약하세요', RSV_URL = 'https://dcitybus.com/';
  var DAYC = ['#5b49e0', '#b35c00', '#2b8a3e', '#0e7490', '#c2255c'];
  var ONE = '#5b49e0';
  function dayColor(di, n) { return n > 1 ? DAYC[di % DAYC.length] : ONE; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function hav(a, b) { var R = 6371000, r = Math.PI / 180, dl = (b.lat - a.lat) * r, dg = (b.lng - a.lng) * r, x = Math.sin(dl / 2) * Math.sin(dl / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dg / 2) * Math.sin(dg / 2); return 2 * R * Math.asin(Math.min(1, Math.sqrt(x))); }

  /* 한 토막의 선: 시티투어는 걷기·버스 토막을 이어 붙이고, 길 값이 없으면 두 점 직선(est) */
  function pathOf(info, a, b) {
    if (info && info.tour && info.tour.segs && info.tour.segs.length) { var p = []; info.tour.segs.forEach(function (sg) { p = p.concat(sg.path || []); }); if (p.length > 1) return { path: p, est: false, tour: true }; }
    if (info && info.path && info.path.length > 1) return { path: info.path, est: false, tour: false };
    return { path: [[a.lng, a.lat], [b.lng, b.lat]], est: true, tour: false };
  }
  function days(pl) {
    if (!pl) return [];
    return pl.multi ? pl.days.map(function (d, di) { return { plan: d.plan, di: di, stay: d.stay, date: d.date, sunrise: d.sunrise }; }) : [{ plan: pl, di: 0, stay: null, date: pl.date, sunrise: null }];
  }
  function model(pl) {
    var out = { nDays: 0, nodes: [], legs: [], marks: [], dayOf: [] };
    var dl = days(pl); if (!dl.length) return out;
    out.nDays = dl.length;
    var nodes = out.nodes, legs = out.legs, gi = 0;
    function add(n) { n.i = nodes.length; nodes.push(n); return n; }
    function leg(prev, node, info, di, t0, t1) { var po = pathOf(info, prev, node); legs.push({ from: prev.i, to: node.i, day: di, path: po.path, est: po.est, tour: po.tour, mode: info && info.mode || '', min: info && (info.legMin != null ? info.legMin : info.min) != null ? (info.legMin != null ? info.legMin : info.min) : null, t0: t0, t1: t1, len: LV ? LV.pathLen(po.path) : 0 }); }
    dl.forEach(function (dp) {
      var q = dp.plan, di = dp.di, last = di === dl.length - 1;
      if (di === 0) add({ kind: 'start', label: '출발', name: q.startStation.name, lat: q.startStation.lat, lng: q.startStation.lng, day: 0, t: q.start });
      var prev = nodes[nodes.length - 1];
      (q.stops || []).forEach(function (s, k) {
        var nd = add({ kind: 'stop', n: ++gi, label: String(gi), name: s.place.name, short: s.place.short || s.place.name, lat: s.place.lat, lng: s.place.lng, day: di, t: s.arrive, leave: s.leave, id: s.id });
        leg(prev, nd, s, di, k === 0 && di > 0 && q.start != null ? q.start : (prev.leave != null ? prev.leave : prev.t), s.arrive);
        prev = nd;
      });
      var endPl = last ? q.endStation : (dp.stay || q.endStation), tom = last && pl.tomorrow;
      var end = add({ kind: last && !tom ? 'end' : 'stay', label: last && !tom ? '도착' : '숙소', name: last && !tom ? q.endStation.name : (dp.stay && dp.stay.name) || '숙소', lat: endPl.lat, lng: endPl.lng, day: di, t: q.back ? q.back.arrive : prev.t });
      if (prev !== end) leg(prev, end, (q.feasible !== false && q.stops && q.stops.length) ? q.back : null, di, prev.leave != null ? prev.leave : prev.t, end.t);
      if (tom) {
        var tn = add({ kind: 'stop', n: ++gi, label: String(gi), name: pl.tomorrow.place.name, short: pl.tomorrow.place.short || pl.tomorrow.place.name, lat: pl.tomorrow.place.lat, lng: pl.tomorrow.place.lng, day: di, t: pl.tomorrow.arrive, tomorrow: true, id: pl.tomorrow.place.id });
        leg(end, tn, pl.tomorrow, di, pl.tomorrow.depart != null ? pl.tomorrow.depart : end.t, pl.tomorrow.arrive);
      }
    });
    /* 그릴 표시: 번호 장은 하나씩, 출발·숙소·도착은 400m 안이면 한 알약으로 합친다("출발·도착") */
    nodes.forEach(function (nd) {
      if (nd.kind === 'stop') { out.dayOf[nd.i] = out.marks.length; out.marks.push({ kind: 'stop', label: nd.label, name: nd.name, lat: nd.lat, lng: nd.lng, day: nd.day, nodes: [nd.i] }); return; }
      var near = out.marks.filter(function (m) { return m.kind === 'st' && hav(m, nd) < 400; })[0];
      if (near) { if (near.label.split('·').indexOf(nd.label) < 0) near.label += '·' + nd.label; near.nodes.push(nd.i); near.name += ' · ' + nd.name; out.dayOf[nd.i] = out.marks.indexOf(near); }
      else { out.dayOf[nd.i] = out.marks.length; out.marks.push({ kind: 'st', label: nd.label, name: nd.name, lat: nd.lat, lng: nd.lng, day: nd.day, nodes: [nd.i] }); }
    });
    return out;
  }
  function stopCount(m) { return m.nodes.filter(function (n) { return n.kind === 'stop'; }).length; }

  /* ---------- 그림 자리 맞추기 ---------- */
  /* 미리 받아 둔 지도 그림 중 모든 점이 들어가는 가장 가까운 그림. 없으면 null(→ 좌표만 그린 깨끗한 그림) */
  function pickStatic(maps, pts) {
    var res = null;
    (maps || []).some(function (m) {
      var cos = Math.cos(m.center[1] * Math.PI / 180);
      var f = function (lat, lng) { return { x: m.w / 2 + (lng - m.center[0]) * 111320 * cos / m.mPerPx, y: m.h / 2 - (lat - m.center[1]) * 110574 / m.mPerPx }; };
      var ok = pts.every(function (p) { var q = f(p.lat, p.lng); return q.x > 26 && q.x < m.w - 26 && q.y > 26 && q.y < m.h - 26; });
      if (ok) res = { map: m, W: m.w, H: m.h, proj: f };
      return ok;
    });
    return res;
  }
  /* 좌표만 그리기: 점들이 W×H 안에 꽉 차게(위도·경도 비율 맞춤) */
  function fitProj(pts, W, H, pad) {
    pad = pad == null ? 34 : pad;
    var cos = Math.cos(pts[0].lat * Math.PI / 180), xs = pts.map(function (p) { return p.lng * cos; }), ys = pts.map(function (p) { return p.lat; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var sw = Math.max(1e-6, x1 - x0), sh = Math.max(1e-6, y1 - y0), s = Math.min((W - 2 * pad) / sw, (H - 2 * pad) / sh), ox = (W - sw * s) / 2, oy = (H - sh * s) / 2;
    return { map: null, W: W, H: H, proj: function (lat, lng) { return { x: ox + (lng * cos - x0) * s, y: oy + (y1 - lat) * s }; } };
  }
  /* ---------- 고른 날만 보이기 ----------
     sel = 날 번호(0부터), 없거나 하루 여행이면 전체. 보이는 표시 = 그 날의 선이 닿는 곳 + 그 날에 속한 곳(앞 날 숙소에서 출발하면 그 숙소 포함).
     돌려주는 값: { sel, vis:[표시마다 true/false], labels:[표시마다 글자(출발·숙소처럼 합쳐진 건 그 날 몫만)], nodes:[그 날 장 목록], legs:[그 날 선] } */
  function dayView(m, sel) {
    var all = sel == null || sel < 0 || m.nDays < 2, use = {};
    if (all) m.nodes.forEach(function (nd) { use[nd.i] = 1; });
    else { m.legs.forEach(function (l) { if (l.day === sel) { use[l.from] = 1; use[l.to] = 1; } }); m.nodes.forEach(function (nd) { if (nd.day === sel) use[nd.i] = 1; }); }
    var vis = [], labels = [];
    m.marks.forEach(function (mk) {
      var ns = mk.nodes.filter(function (j) { return use[j]; });
      vis.push(ns.length > 0);
      if (mk.kind === 'stop') labels.push(mk.label);
      else { var seen = {}, parts = []; ns.forEach(function (j) { var t = m.nodes[j].label; if (!seen[t]) { seen[t] = 1; parts.push(t); } }); labels.push(parts.join('·') || mk.label); }
    });
    return { sel: all ? -1 : sel, vis: vis, labels: labels, nodes: m.nodes.filter(function (nd) { return use[nd.i]; }), legs: m.legs.filter(function (l) { return all || l.day === sel; }) };
  }
  function allPts(m, view) {
    var p = m.marks.filter(function (mk, i) { return !view || view.vis[i]; });
    (view ? view.legs : m.legs).forEach(function (l) { l.path.forEach(function (q) { p.push({ lat: q[1], lng: q[0] }); }); });
    return p;
  }
  /* 위치: 지도 그림이 있으면 그 그림, 없으면 좌표만 그린 깨끗한 SVG. view 가 있으면 그 날의 점만으로 맞춘다.
     돌려주는 값: { map|null, W, H, y0(그림에서 잘라낸 위쪽), proj(lat,lng)→{x,y} } */
  var HMAX = 440;
  function frame(m, maps, view) {
    if (!m.marks.length) return null;
    var pts = allPts(m, view); if (!pts.length) return null;
    var pk = pickStatic(maps, pts);
    if (pk) {
      var ys = pts.map(function (p) { return pk.proj(p.lat, p.lng).y; }), lo = Math.min.apply(null, ys) - 34, hi = Math.max.apply(null, ys) + 34, y0 = 0, H = pk.H;
      if (hi - lo <= HMAX) { y0 = Math.max(0, Math.min(pk.H - HMAX, (lo + hi) / 2 - HMAX / 2)); H = HMAX; }
      return { map: pk.map, W: pk.W, H: H, y0: y0, ext: { x0: 0, y0: -y0, x1: pk.map.w, y1: pk.map.h - y0 }, proj: function (lat, lng) { var o = pk.proj(lat, lng); return { x: o.x, y: o.y - y0 }; } };
    }
    var f = fitProj(pts, 600, HMAX, 40); f.y0 = 0; f.ext = { x0: 0, y0: 0, x1: f.W, y1: f.H }; return f;
  }
  /* 처음 보이는 카메라: 그 날(또는 전체)의 점·선이 가장자리 여유(그림 점 단위 mg)만 두고 꽉 차게 */
  function homeCam(m, f, view, mg) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, add = function (o) { x0 = Math.min(x0, o.x); y0 = Math.min(y0, o.y); x1 = Math.max(x1, o.x); y1 = Math.max(y1, o.y); };
    m.marks.forEach(function (mk, i) { if (!view || view.vis[i]) add(f.proj(mk.lat, mk.lng)); });
    (view ? view.legs : m.legs).forEach(function (l) { l.path.forEach(function (q) { add(f.proj(q[1], q[0])); }); });
    if (x0 > x1) return fullCam(f);
    mg = mg == null ? 46 : mg;
    return cameraFor({ x0: x0 - mg, y0: y0 - mg, x1: x1 + mg, y1: y1 + mg }, f, { pad: 1, minW: f.W / 4 });
  }

  /* ---------- SVG ---------- */
  var HIT = 28, R_STOP = 17;
  function pillW(label) { return Math.max(48, 24 + String(label).length * 15); }
  function ptsStr(path, f) { return path.map(function (q) { var o = f.proj(q[1], q[0]); return o.x.toFixed(1) + ',' + o.y.toFixed(1); }).join(' '); }
  function nodeLabel(n) { return n.kind === 'stop' ? String(n.n) : n.label; }

  /* ---------- 겹치는 표시 정리 ----------
     minD = 화면 30px 가 그림 몇 점인지. 보이는 표시(opts.visible)만 다룬다.
     · 가까이 모인 번호가 3개 이상이면 한 표시로 합친다("5·6·7") — 누르면 그곳이 크게 열려 따로 보인다. 부채꼴로 펼치지 않는다.
     · 2개가 겹치면 서로 살짝(최대 24px) 비켜 서고, 진짜 자리와 짧은 줄로 잇는다.
     · 출발·숙소·도착 알약은 가까운 빈 자리(최대 64px)로 비켜 서고, 끝내 자리가 없으면 번호 아래에 깔아 번호를 가리지 않는다(under).
     반환: marks 와 같은 순서의 [{ i, tx, ty(진짜 자리), x, y(그릴 자리), moved, hidden, label, merged, members }] */
  var MAXNUDGE = 24, MAXPILL = 64;
  function layoutMarks(m, f, minD, opts) {
    var u = minD / 30, vis = opts && opts.visible, labs = opts && opts.labels, T = 34 * u; // u: 화면 1px 이 그림 몇 점인지 · T: 번호 두 개가 닿는 거리
    var items = m.marks.map(function (mk, i) { var o = f.proj(mk.lat, mk.lng), lab = labs && labs[i] != null ? labs[i] : mk.label; return { i: i, tx: o.x, ty: o.y, x: o.x, y: o.y, moved: false, hidden: !!(vis && !vis[i]), label: lab, st: mk.kind === 'st', merged: false, hw: mk.kind === 'st' ? pillW(lab) / 2 * u : 0 }; });
    var live = items.filter(function (it) { return !it.hidden; }), stops = live.filter(function (it) { return !it.st; }), pills = live.filter(function (it) { return it.st; });
    /* 1) 번호끼리 닿는 덩어리 찾기 */
    var par = stops.map(function (_, k) { return k; });
    function find(k) { while (par[k] !== k) { par[k] = par[par[k]]; k = par[k]; } return k; }
    for (var a = 0; a < stops.length; a++) for (var b = a + 1; b < stops.length; b++) if (Math.hypot(stops[a].tx - stops[b].tx, stops[a].ty - stops[b].ty) < T) par[find(a)] = find(b);
    var groups = {}; stops.forEach(function (it, k) { var r = find(k); (groups[r] = groups[r] || []).push(it); });
    var singles = [];
    Object.keys(groups).forEach(function (r) {
      var g = groups[r];
      if (g.length >= 3) { // 합치기: 맨 앞 번호가 대표, 나머지는 숨김
        g.sort(function (p, q) { return p.i - q.i; });
        var head = g[0], ls = g.map(function (it) { return it.label; }), cx = g.reduce(function (s0, it) { return s0 + it.tx; }, 0) / g.length, cy = g.reduce(function (s0, it) { return s0 + it.ty; }, 0) / g.length;
        head.merged = true; head.members = g.map(function (it) { return it.i; }); head.label = ls.length <= 4 ? ls.join('·') : ls[0] + ' 외 ' + (ls.length - 1);
        head.tx = head.x = cx; head.ty = head.y = cy; head.hw = pillW(head.label) / 2 * u;
        g.slice(1).forEach(function (it) { it.hidden = true; it.mergedInto = head.i; });
        singles.push(head);
      } else g.forEach(function (it) { singles.push(it); });
    });
    /* 2) 둘이 겹친 것만 살짝 밀어내기(진짜 자리에서 24px 안) */
    function rad(it) { return it.merged ? it.hw : 17 * u; }
    function clampNear(it) { var dx = it.x - it.tx, dy = it.y - it.ty, d = Math.hypot(dx, dy), mx = MAXNUDGE * u; if (d > mx) { it.x = it.tx + dx / d * mx; it.y = it.ty + dy / d * mx; } }
    for (var it0 = 0; it0 < 60; it0++) {
      var calm = true;
      for (var p = 0; p < singles.length; p++) for (var q = p + 1; q < singles.length; q++) {
        var A = singles[p], B = singles[q], dx = B.x - A.x, dy = B.y - A.y, dd = Math.hypot(dx, dy), need = rad(A) + rad(B) + 1 * u;
        if (dd >= need - 0.01) continue; calm = false;
        if (dd < 1e-6) { dx = 1; dy = 0; dd = 1; }
        var k = (need - dd) / 2 + 0.01, ux = dx / dd, uy = dy / dd; A.x -= ux * k; A.y -= uy * k; B.x += ux * k; B.y += uy * k; clampNear(A); clampNear(B);
      }
      if (calm) break;
    }
    /* 3) 출발·숙소·도착 알약끼리 닿으면 한 알약으로("숙소·도착"), 번호를 가리지 않게 가장 가까운 빈 자리로 */
    (function () {
      var pp = pills.map(function (_, k) { return k; });
      function fd(k) { while (pp[k] !== k) { pp[k] = pp[pp[k]]; k = pp[k]; } return k; }
      for (var a2 = 0; a2 < pills.length; a2++) for (var b2 = a2 + 1; b2 < pills.length; b2++) { var A2 = pills[a2], B2 = pills[b2]; if (Math.abs(A2.tx - B2.tx) < A2.hw + B2.hw + 2 * u && Math.abs(A2.ty - B2.ty) < 26 * u) pp[fd(a2)] = fd(b2); }
      var gs = {}; pills.forEach(function (it, k) { var r = fd(k); (gs[r] = gs[r] || []).push(it); });
      pills = [];
      Object.keys(gs).forEach(function (r) {
        var g = gs[r].sort(function (p, q) { return p.i - q.i; }), head = g[0];
        if (g.length > 1) {
          var seen = {}, parts = []; g.forEach(function (it) { String(it.label).split('·').forEach(function (t) { if (!seen[t]) { seen[t] = 1; parts.push(t); } }); });
          head.label = parts.join('·'); head.members = g.map(function (it) { return it.i; }); head.hw = pillW(head.label) / 2 * u;
          head.tx = head.x = g.reduce(function (s0, it) { return s0 + it.tx; }, 0) / g.length; head.ty = head.y = g.reduce(function (s0, it) { return s0 + it.ty; }, 0) / g.length;
          g.slice(1).forEach(function (it) { it.hidden = true; it.mergedInto = head.i; });
        }
        pills.push(head);
      });
    })();
    function hit(pl, x, y) {
      for (var j = 0; j < singles.length; j++) { var c = singles[j], nx = Math.max(x - pl.hw - c.hw, Math.min(c.x, x + pl.hw + c.hw)), ny = Math.max(y - 13 * u, Math.min(c.y, y + 13 * u)); if (Math.hypot(c.x - nx, c.y - ny) < 19.5 * u) return true; }
      for (var k2 = 0; k2 < pills.length; k2++) { var o = pills[k2]; if (o !== pl && o.placed && Math.abs(o.x - x) < o.hw + pl.hw + 4 * u && Math.abs(o.y - y) < 28 * u) return true; }
      return false;
    }
    pills.forEach(function (pl) {
      pl.placed = true; if (!hit(pl, pl.tx, pl.ty)) return;
      var best = null;
      for (var r = 8; r <= MAXPILL && !best; r += 4) for (var k3 = 0; k3 < 16; k3++) { var ang2 = Math.PI / 2 + k3 * Math.PI / 8, x = pl.tx + Math.cos(ang2) * r * u, y = pl.ty + Math.sin(ang2) * r * u; if (!hit(pl, x, y)) { best = { x: x, y: y }; break; } }
      if (best) { pl.x = best.x; pl.y = best.y; } else pl.under = true;
    });
    items.forEach(function (it) { it.moved = !it.hidden && !it.merged && Math.hypot(it.x - it.tx, it.y - it.ty) > 1; delete it.placed; });
    return items;
  }
  /* ---------- 카메라(보이는 쪽): 그림 위에서 어디를 얼마나 크게 볼지. { cx, cy, w, h, z } (z = 전체 대비 확대 배율) ---------- */
  function fullCam(f) { return { cx: f.W / 2, cy: f.H / 2, w: f.W, h: f.H, z: 1 }; }
  function legBounds(l, f) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    l.path.forEach(function (q) { var o = f.proj(q[1], q[0]); x0 = Math.min(x0, o.x); y0 = Math.min(y0, o.y); x1 = Math.max(x1, o.x); y1 = Math.max(y1, o.y); });
    return { x0: x0, y0: y0, x1: x1, y1: y1 };
  }
  function cameraFor(b, f, o) {
    o = o || {}; var pad = o.pad || 1.6, minW = o.minW || 130, W = f.W, H = f.H;
    var w = Math.min(W, Math.max((b.x1 - b.x0) * pad, (b.y1 - b.y0) * pad * W / H, minW)), h = w * H / W, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, e = f.ext || { x0: 0, y0: 0, x1: W, y1: H };
    function clamp(v, lo, hi) { return hi < lo ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)); }
    cx = clamp(cx, e.x0 + w / 2, e.x1 - w / 2); cy = clamp(cy, e.y0 + h / 2, e.y1 - h / 2);
    return { cx: cx, cy: cy, w: w, h: h, z: W / w };
  }
  function legCam(l, f, o) { return cameraFor(legBounds(l, f), f, o); }
  function pointCam(x, y, f, w) { return cameraFor({ x0: x, y0: y, x1: x, y1: y }, f, { minW: w || f.W / 4 }); }
  function lerpCam(a, b, t) {
    var w = Math.exp(Math.log(a.w) + (Math.log(b.w) - Math.log(a.w)) * t), s = t, cx = a.cx + (b.cx - a.cx) * s, cy = a.cy + (b.cy - a.cy) * s;
    return { cx: cx, cy: cy, w: w, h: w * a.h / a.w, z: a.z * a.w / w };
  }
  function viewBox(c) { return (c.cx - c.w / 2).toFixed(2) + ' ' + (c.cy - c.h / 2).toFixed(2) + ' ' + c.w.toFixed(2) + ' ' + c.h.toFixed(2); }

  function legCaption(m, l) {
    var a = m.nodes[l.from], b = m.nodes[l.to], mt = { walk: '걸어서', bus: '버스', taxi: '택시', car: '자동차' }[l.mode] || '', min = l.min != null ? l.min : (l.t1 != null && l.t0 != null ? Math.max(0, Math.round(l.t1 - l.t0)) : null);
    if (l.tour) mt = '시티투어버스';
    return nodeLabel(a) + ' → ' + nodeLabel(b) + ' · ' + a.name + ' → ' + b.name + (min != null ? ' · ' + (mt ? mt + ' ' : '') + min + '분' : '');
  }

  /* 표시(번호·알약) 그림 조각. lay = layoutMarks 결과(없으면 진짜 자리 그대로) */
  function marksSvg(m, f, lay) {
    var n = m.nDays, svg = '';
    lay = lay || m.marks.map(function (mk, i) { var q = f.proj(mk.lat, mk.lng); return { i: i, x: q.x, y: q.y, tx: q.x, ty: q.y, label: mk.label }; });
    m.marks.map(function (_, i) { return i; }).sort(function (a, b) { var A = lay[a].under ? -1 : m.marks[a].kind === 'st' || lay[a].merged ? 1 : 0, B = lay[b].under ? -1 : m.marks[b].kind === 'st' || lay[b].merged ? 1 : 0; return A - B; }).forEach(function (i) {
      var mk = m.marks[i], q = lay[i]; if (q.hidden) return;
      var lab = q.label != null ? q.label : mk.label, nm = q.merged ? lab + '번 ' + q.members.map(function (j) { return m.marks[j].name; }).join(', ') : mk.kind === 'stop' ? lab + '번 ' + mk.name : mk.name;
      var at = ' data-day="' + mk.day + '" data-m="' + i + '" role="button" tabindex="0" aria-label="' + esc(nm + ' 크게 보기') + '" transform="translate(' + q.x.toFixed(1) + ' ' + q.y.toFixed(1) + ')"';
      if (q.merged) { var w0 = pillW(lab); svg += '<g class="ovm mg"' + at + '><g class="ovs"><rect class="hit" x="' + (-w0 / 2 - 6) + '" y="-22" width="' + (w0 + 12) + '" height="44" fill="transparent"/><rect x="' + (-w0 / 2) + '" y="-17" width="' + w0 + '" height="34" rx="17" fill="' + dayColor(mk.day, n) + '" stroke="#fff" stroke-width="3.5"/><text y="6.5" text-anchor="middle" font-size="18" font-weight="800" fill="#fff">' + esc(lab) + '</text></g></g>'; }
      else if (mk.kind === 'stop') svg += '<g class="ovm"' + at + '><g class="ovs"><circle class="hit" r="' + HIT + '" fill="transparent"/><circle r="' + R_STOP + '" fill="' + dayColor(mk.day, n) + '" stroke="#fff" stroke-width="3.5"/><text y="6.5" text-anchor="middle" font-size="18" font-weight="800" fill="#fff">' + esc(lab) + '</text></g></g>';
      else { var w = pillW(lab); svg += '<g class="ovm st"' + at + '><g class="ovs"><rect class="hit" x="' + (-w / 2 - 6) + '" y="-22" width="' + (w + 12) + '" height="44" fill="transparent"/><rect x="' + (-w / 2) + '" y="-13" width="' + w + '" height="26" rx="13" fill="#ffb02e" stroke="#fff" stroke-width="3"/><text y="5.5" text-anchor="middle" font-size="14.5" font-weight="800" fill="#2a1500">' + esc(lab) + '</text></g></g>'; }
    });
    return svg;
  }
  function leadersSvg(lay) {
    return (lay || []).filter(function (it) { return it.moved && !it.hidden; }).map(function (it) { return '<line class="ovld" x1="' + it.tx.toFixed(1) + '" y1="' + it.ty.toFixed(1) + '" x2="' + it.x.toFixed(1) + '" y2="' + it.y.toFixed(1) + '"/>'; }).join('');
  }
  /* o = { layout, sel(보이는 날, -1=전체), all(전체 일정 보기 중이면 true) }. 보이는 날이 아닌 날의 선은 흐리고 가늘게(전체 보기에서는 색 그대로 조금 흐리게) */
  function svgInner(m, f, o) {
    var n = m.nDays, sel = o && o.sel != null ? o.sel : -1, svg = '<g id="ovLines">';
    m.legs.forEach(function (l) {
      var c = dayColor(l.day, n), p = ptsStr(l.path, f), off = sel >= 0 && l.day !== sel, at = ' data-day="' + l.day + '" data-leg="' + l.to + '" fill="none" stroke-linecap="round" stroke-linejoin="round"';
      var cls = off ? (o && o.all ? ' off all' : ' off') : '';
      svg += '<polyline class="ovl cs' + cls + '"' + at + ' stroke="#fff" opacity=".9" points="' + p + '"/>';
      svg += '<polyline class="ovl cl' + cls + '"' + at + ' stroke="' + c + '"' + (l.est ? ' stroke-dasharray="10 8"' : '') + ' points="' + p + '"/>';
    });
    var lay = o && o.layout;
    svg += '</g><g id="ovLead">' + leadersSvg(lay) + '</g><g id="ovMarks">' + marksSvg(m, f, lay) + '</g>';
    return svg;
  }
  function legendHtml(m) {
    if (m.nDays < 2) return '';
    var h = '';
    for (var d = 0; d < m.nDays; d++) h += '<span class="ov-lg"><i style="background:' + dayColor(d, m.nDays) + '"></i>' + (d + 1) + '일</span>';
    return h;
  }

  /* ---------- 미리 보기 움직임 ---------- */
  /* 구간 목록: 정류(장에서 잠깐 멈춤) · 이동(선을 따라) · 끝(전체로 되돌아 나옴). totalMs 안에 맞춘다. reduce 이면 이동 없이 장마다 건너뜀 */
  function timeline(m, totalMs, reduce, view) {
    var segs = [], nodes = view ? view.nodes : m.nodes, legs = view ? view.legs : m.legs; if (!nodes.length) return { segs: segs, total: 0 };
    var legByTo = {}; legs.forEach(function (l) { legByTo[l.to] = l; });
    var OUT = reduce ? 900 : 800;
    if (reduce) { nodes.forEach(function (nd) { segs.push({ type: 'hold', node: nd.i, ms: 900, leg: legByTo[nd.i] || null }); }); segs.push({ type: 'out', node: nodes[nodes.length - 1].i, ms: OUT }); return { segs: segs, total: segs.length * 900 - 900 + OUT }; }
    var nStop = nodes.length, hold = Math.max(160, Math.min(700, Math.round(totalMs * 0.3 / nStop))), move = Math.max(0, totalMs - hold * nStop - OUT), sum = legs.reduce(function (a, l) { return a + Math.max(l.len, 50); }, 0) || 1;
    nodes.forEach(function (nd) {
      var l = legByTo[nd.i];
      if (l) segs.push({ type: 'move', leg: l, node: nd.i, ms: Math.max(220, Math.round(move * Math.max(l.len, 50) / sum)) });
      segs.push({ type: 'hold', node: nd.i, ms: hold, leg: l || null });
    });
    segs.push({ type: 'out', node: nodes[nodes.length - 1].i, ms: OUT });
    return { segs: segs, total: segs.reduce(function (a, s) { return a + s.ms; }, 0) };
  }
  /* 시각 ms 의 상태: { seg(몇 번째 구간), t(구간 안 ms), type, lat, lng, node(가장 최근에 닿은 장), moving, toNode, clock(분), reached, leg } */
  function stateAt(m, tl, ms) {
    var acc = 0, segs = tl.segs;
    if (!segs.length) return null;
    for (var i = 0; i < segs.length; i++) {
      var s = segs[i];
      if (ms < acc + s.ms || i === segs.length - 1) {
        var t = Math.max(0, Math.min(s.ms, ms - acc)), f = s.ms ? t / s.ms : 1;
        if (s.type === 'move') {
          var l = s.leg, pt = LV ? LV.pointAt(l.path, l.len * f) : { lat: m.nodes[l.from].lat, lng: m.nodes[l.from].lng };
          return { seg: i, t: t, type: 'move', lat: pt.lat, lng: pt.lng, node: l.from, moving: true, toNode: s.node, clock: l.t0 != null && l.t1 != null ? Math.round(l.t0 + (l.t1 - l.t0) * f) : m.nodes[s.node].t, reached: l.from, leg: l };
        }
        var nd = m.nodes[s.node];
        return { seg: i, t: t, type: s.type, lat: nd.lat, lng: nd.lng, node: s.node, moving: false, toNode: s.node, clock: nd.t, reached: s.node, leg: s.leg || null };
      }
      acc += s.ms;
    }
    return null;
  }

  /* ---------- 오늘 꼭 알아야 할 것 ---------- */
  /* ctx = { P, CT, date(고른 날 'YYYY-MM-DD'), marketDigits:[3,8], marketName, rain:boolean(코스를 비 기준으로 짬), wx:{pty..}|null, isToday:boolean, sunrise:{min,approx}|null }
     → [{ k:'market'|'tour'|'rain'|'sun', short(한 줄에 이어 붙일 짧은 말), text(펼쳤을 때 긴 말) }] 중요한 순서. 없으면 [].
     한 줄에는 그 날의 사실을 먼저("북평장 장날 · 시티투어 운행 · 일출 06:41(어림)"). 시티투어 예약 안내는 줄 맨 앞에 두지 않고, 펼친 목록의 시티투어 항목 아래에 작게(note) 붙는다. */
  function todayNotes(ctx) {
    var P = ctx.P, out = [], info = P.dateInfo(ctx.date); if (!info) return out;
    if (ctx.marketName && P.lastDigitDay(ctx.date, ctx.marketDigits || [3, 8])) out.push({ k: 'market', short: ctx.marketName + ' 장날', text: ctx.marketName + ' 장날이에요' });
    if (ctx.CT) {
      var td = P.tourDay(ctx.CT, ctx.date);
      if (td.ok) out.push({ k: 'tour', short: '시티투어 운행' + (td.unconfirmed ? ' (공휴일 확인필요)' : ''), text: '이 날은 시티투어버스가 다녀요(' + td.why + ')', note: RSV });
      else if (td.why !== '운행 기간이 끝남' && td.why !== '아직 운행 전') out.push({ k: 'tour', short: '시티투어 쉬는 날', text: '이 날은 시티투어버스가 쉬어요(토·일·공휴일만 다녀요)', note: RSV });
      else out.push({ k: 'tour', short: '시티투어 ' + (td.why === '아직 운행 전' ? '운행 전' : '운행 끝'), text: '시티투어버스는 ' + (td.why === '아직 운행 전' ? P.dateLabel(ctx.CT.period.from) + '부터' : P.dateLabel(ctx.CT.period.to) + '까지만') + ' 다녀요', note: RSV });
    }
    if (ctx.rain || (ctx.isToday && ctx.wx && ctx.wx.pty > 0)) { var wxBad = ctx.isToday && ctx.wx && ctx.wx.pty > 0; out.push({ k: 'rain', short: wxBad ? '지금 날씨 안 좋음' : '비 오는 날 코스', text: wxBad ? '지금 동해 날씨가 안 좋아요(기상청)' : '비 오는 날 기준으로 짰어요' }); }
    if (ctx.sunrise) out.push({ k: 'sun', short: '일출 ' + P.fmt(ctx.sunrise.min) + '(어림)', text: '일출 ' + P.fmt(ctx.sunrise.min) + ' (계산한 어림값, 확인필요)' });
    var rank = { rain: 0, market: 1, tour: 2, sun: 3 };
    return out.sort(function (a, b) { return rank[a.k] - rank[b.k]; });
  }

  /* ---------- 저장용 그림(canvas) ---------- */
  /* ctx2d 에 지도 그림 위의 선·표시를 그린다. (ox,oy) 왼쪽 위, sc = 그림 한 점이 몇 px 인지, lay = layoutMarks 결과(겹치는 표시를 떼어 놓음) */
  function drawLines(g, m, f, ox, oy, sc, lay, o) {
    o = o || {}; var n = m.nDays, ms = o.msc || sc, sel = o.sel == null ? -1 : o.sel; // sc: 그림 한 점이 몇 px · ms: 번호·선 굵기 배율(화면 px 기준)
    function pts(path) { return path.map(function (q) { var p = f.proj(q[1], q[0]); return [ox + p.x * sc, oy + p.y * sc]; }); }
    function line(p, w, col, dash) { g.beginPath(); p.forEach(function (q, i) { if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.lineWidth = w; g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round'; g.setLineDash(dash || []); g.stroke(); g.setLineDash([]); }
    m.legs.forEach(function (l) {
      var p = pts(l.path), off = sel >= 0 && l.day !== sel; g.globalAlpha = off ? (o.all ? 0.6 : 0.3) : 1;
      line(p, (off && !o.all ? 6 : 9) * ms, 'rgba(255,255,255,.9)'); line(p, (off && !o.all ? 3 : 5) * ms, dayColor(l.day, n), l.est ? [10 * ms, 8 * ms] : null);
    });
    g.globalAlpha = 1;
    lay = lay || m.marks.map(function (mk, i) { var q = f.proj(mk.lat, mk.lng); return { i: i, x: q.x, y: q.y, tx: q.x, ty: q.y, moved: false, label: mk.label }; });
    lay.forEach(function (it) { if (!it.moved || it.hidden) return; g.beginPath(); g.moveTo(ox + it.tx * sc, oy + it.ty * sc); g.lineTo(ox + it.x * sc, oy + it.y * sc); g.lineWidth = 2 * ms; g.strokeStyle = 'rgba(18,18,18,.55)'; g.stroke(); g.beginPath(); g.arc(ox + it.tx * sc, oy + it.ty * sc, 3.5 * ms, 0, 7); g.fillStyle = '#121212'; g.fill(); });
    function pill(x, y, w, h, fill, stroke, lw) { g.beginPath(); if (g.roundRect) g.roundRect(x - w / 2, y - h / 2, w, h, h / 2); else g.rect(x - w / 2, y - h / 2, w, h); g.fillStyle = fill; g.fill(); g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); }
    m.marks.map(function (mk, i) { return i; }).sort(function (a, b) { var A = lay[a].under ? -1 : m.marks[a].kind === 'st' || lay[a].merged ? 1 : 0, B = lay[b].under ? -1 : m.marks[b].kind === 'st' || lay[b].merged ? 1 : 0; return A - B; }).forEach(function (i) {
      var mk = m.marks[i], it = lay[i]; if (it.hidden) return;
      var x = ox + it.x * sc, y = oy + it.y * sc, lab = it.label != null ? it.label : mk.label;
      g.textAlign = 'center';
      if (it.merged) { pill(x, y, pillW(lab) * ms, 34 * ms, dayColor(mk.day, n), '#fff', 3.5 * ms); g.fillStyle = '#fff'; g.font = '800 ' + (18 * ms) + 'px sans-serif'; g.fillText(lab, x, y + 6.5 * ms); }
      else if (mk.kind === 'stop') { g.beginPath(); g.arc(x, y, R_STOP * ms, 0, 7); g.fillStyle = dayColor(mk.day, n); g.fill(); g.lineWidth = 3.5 * ms; g.strokeStyle = '#fff'; g.stroke(); g.fillStyle = '#fff'; g.font = '800 ' + (18 * ms) + 'px sans-serif'; g.fillText(lab, x, y + 6.5 * ms); }
      else { pill(x, y, pillW(lab) * ms, 26 * ms, '#ffb02e', '#fff', 3 * ms); g.fillStyle = '#2a1500'; g.font = '800 ' + (14.5 * ms) + 'px sans-serif'; g.fillText(lab, x, y + 5.5 * ms); }
    });
  }

  /* ---------- 시티투어 시간표 · 예약 안내 (동해시티투어버스 dcitybus.com 기준, citytour.js) ---------- */
  function rsvNote(CT) { var n = ((CT && CT.notes) || []).filter(function (x) { return x.indexOf('만석') >= 0; })[0]; return n || '만석이면 탑승이 제한될 수 있어요 · 네이버 예약이 마감되면 현장 결제가 안 될 수 있어요'; }
  /* 작은 한 줄 예약 안내(배너 아님) + 공식 사이트로 가는 작은 링크(전화번호·예약 주소는 새로 만들지 않는다: 공식 사이트 첫 화면만) */
  function reserveHtml(CT, mini) {
    return '<p class="rsv' + (mini ? ' mini' : '') + '" role="note"><svg class="ic rsv-i" aria-hidden="true"><use href="#i-train"/></svg><span class="rsv-t">' + RSV + '</span> <span class="rsv-n">· ' + esc(rsvNote(CT)) + '</span> <a class="rsv-a" href="' + RSV_URL + '" target="_blank" rel="noopener">예약 안내 보기</a></p>';
  }
  function md(P, iso) { var i = P.dateInfo(iso); return i ? i.m + '/' + i.d + '(' + ['일', '월', '화', '수', '목', '금', '토'][i.dow] + ')' : ''; }
  /* 시간표 표: 행 = 정류장, 열 = 회차. o.board/o.alight = 정류장 번호(굵게), o.run = 코스가 탈 회차(열 강조). 옆으로 미는 것은 이 표 안에서만 */
  function ttTable(CT, o) {
    o = o || {}; var n = CT.runs || 7, h = '<div class="tt-scroll" tabindex="0" role="region" aria-label="시티투어 시간표 (옆으로 밀어 보세요)"><table class="tt"><thead><tr><th scope="col">정류장</th>';
    for (var r = 0; r < n; r++) h += '<th scope="col"' + (o.run === r + 1 ? ' class="run"' : '') + '>' + (r + 1) + '회</th>';
    h += '</tr></thead><tbody>';
    CT.stops.forEach(function (s, i) {
      var tag = i === o.board ? '<i class="tt-tag on">탑승</i>' : i === o.alight ? '<i class="tt-tag off">하차</i>' : '';
      h += '<tr' + (i === o.board || i === o.alight ? ' class="me"' : '') + '><th scope="row">' + (i + 1) + ' ' + esc(s.short || s.name) + tag + '</th>';
      for (var r2 = 0; r2 < n; r2++) h += '<td' + (o.run === r2 + 1 ? ' class="run"' : '') + '>' + esc((s.times && s.times[r2]) || '–') + '</td>';
      h += '</tr>';
    });
    var endMe = o.alight === CT.stops.length;
    h += '<tr class="end' + (endMe ? ' me' : '') + '"><th scope="row">묵호역 도착' + (endMe ? '<i class="tt-tag off">하차</i>' : '') + '</th>';
    for (var r3 = 0; r3 < n; r3++) h += '<td>' + esc((CT.endTimes && CT.endTimes[r3]) || '–') + '</td>';
    return h + '</tr></tbody></table></div>';
  }
  /* 정류장 그림: 미리 받아 둔 지도 그림 위(점이 다 들어가면) 또는 좌표만 그린 선 */
  function ttMapSvg(CT, maps) {
    var pts = CT.stops.map(function (s) { return { lat: s.lat, lng: s.lng }; }), f = pickStatic(maps, pts) || fitProj(pts, 600, 360, 40), H = f.H;
    var P2 = pts.map(function (p, i) { var o = f.proj(p.lat, p.lng); return [o.x, o.y, i]; });
    var line = P2.map(function (q) { return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' ') + ' ' + P2[0][0].toFixed(1) + ',' + P2[0][1].toFixed(1);
    var h = '<svg class="tt-svg" viewBox="0 0 ' + f.W + ' ' + H + '" role="img" aria-label="시티투어 정류장 ' + CT.stops.length + '곳을 도는 길">' + (f.map ? '<image href="' + esc(f.map.src) + '" x="0" y="0" width="' + f.map.w + '" height="' + f.map.h + '"/>' : '<rect width="' + f.W + '" height="' + H + '" fill="#e9f0f1"/>');
    h += '<polyline points="' + line + '" fill="none" stroke="#fff" stroke-width="9" stroke-linejoin="round"/><polyline points="' + line + '" fill="none" stroke="#0b3d91" stroke-width="5" stroke-linejoin="round"/>';
    P2.forEach(function (q) { h += '<g transform="translate(' + q[0].toFixed(1) + ' ' + q[1].toFixed(1) + ')"><circle r="14" fill="#0b3d91" stroke="#fff" stroke-width="3.5"/><text y="6" text-anchor="middle" font-size="16" font-weight="800" fill="#fff">' + (q[2] + 1) + '</text></g>'; });
    return h + '</svg>';
  }
  /* 시간표 창 몸통. o = { date, today(고른 날이 오늘인가), run, board, alight, dep, arr, boardName, alightName, wrap } */
  function ttHtml(CT, P, o) {
    o = o || {}; var h = reserveHtml(CT, false), td = o.date ? P.tourDay(CT, o.date) : { ok: true, why: '' };
    if (!td.ok) {
      var nx = P.tourNextDay(CT, o.date);
      h += '<p class="tt-off"><b>' + (o.today ? '오늘은' : md(P, o.date) + '은') + ' 운행하지 않아요</b>' + (nx ? ' · 다음 운행: ' + md(P, nx) : '') + '</p><p class="note">운행: ' + esc(CT.days) + ' · ' + md(P, CT.period.from) + '~' + md(P, CT.period.to) + '</p>';
      return h;
    }
    if (o.run) {
      var f = P.fmt;
      h += '<p class="tt-me"><b>' + o.run + '회차 ' + f(o.dep) + '</b> ' + esc(o.boardName) + ' 탑승 → <b>' + f(o.arr) + '</b> ' + esc(o.alightName) + ' 하차' + (o.wrap ? ' (묵호역에서 갈아타요)' : '') + '</p>';
    }
    h += '<p class="note">' + (o.date ? md(P, o.date) + ' 시간표 · ' : '') + '굵은 칸이 이 코스에서 탈 회차예요. 표는 옆으로 밀어 볼 수 있어요.</p>' + ttTable(CT, o);
    return h;
  }
  /* 동네 탭 시티투어: 운행일 · 요금 · 정류장 순서 · 회차별 시각 · 그림 */
  function ttTabHtml(CT, P, maps, today) {
    var fr = CT.fares, c = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }, nx = P.tourNextDay(CT, today), td = P.tourDay(CT, today);
    var h = reserveHtml(CT, false);
    h += '<ul class="tt-facts"><li><b>운행</b> ' + esc(CT.days) + ' · ' + md(P, CT.period.from) + '~' + md(P, CT.period.to) + '</li>' +
      '<li><b>시간</b> ' + esc(CT.hours) + ' · 묵호역에서 하루 ' + CT.runs + '회 (한 바퀴 약 ' + CT.loopMin + '분)</li>' +
      '<li><b>요금</b> ' + esc(fr.ticket) + ' 어른 ' + c(fr.adult) + '원 · 어린이 ' + c(fr.child) + '원(' + esc(fr.childAge) + ') · ' + esc(fr.free) + '</li>' +
      '<li><b>오늘</b> ' + (td.ok ? '운행해요(' + esc(td.why) + ')' : '운행하지 않아요' + (nx ? ' · 다음 운행: ' + md(P, nx) : '')) + '</li></ul>';
    h += '<h3 class="tt-h">정류장 ' + CT.stops.length + '곳 도는 길</h3>' + ttMapSvg(CT, maps) + '<h3 class="tt-h">회차별 시각</h3>' + ttTable(CT, {});
    h += '<ul class="tt-notes">' + (CT.notes || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
    h += '<p class="note">출처: 동해시티투어버스(dcitybus.com) 시간표·요금·정류장 안내 기준 · ' + esc(CT.org) + ' · 확인한 날 ' + esc(CT.checked) + ' · 시각은 교통 상황에 따라 달라질 수 있어 <b>확인필요</b> · 문의 ' + esc(CT.phone) + '</p>';
    return h;
  }

  var api = { RSV: RSV, RSV_URL: RSV_URL, reserveHtml: reserveHtml, ttHtml: ttHtml, ttTable: ttTable, ttTabHtml: ttTabHtml, ttMapSvg: ttMapSvg, md: md, DAYC: DAYC, ONE: ONE, dayColor: dayColor, model: model, frame: frame, pickStatic: pickStatic, fitProj: fitProj, svgInner: svgInner, layoutMarks: layoutMarks, fullCam: fullCam, legBounds: legBounds, cameraFor: cameraFor, legCam: legCam, pointCam: pointCam, lerpCam: lerpCam, viewBox: viewBox, legCaption: legCaption, nodeLabel: nodeLabel, legendHtml: legendHtml, timeline: timeline, stateAt: stateAt, todayNotes: todayNotes, drawLines: drawLines, dayView: dayView, homeCam: homeCam, marksSvg: marksSvg, leadersSvg: leadersSvg, stopCount: stopCount, hav: hav };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TourOv = api;
})(typeof window !== 'undefined' ? window : globalThis);
