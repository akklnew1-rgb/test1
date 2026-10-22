/* 현장 제보 규칙 (2026-10-18, 신청서 v1.4 핵심기능 2) — 순수 계산만. 브라우저·Node 양쪽에서 쓴다.
 *  제보는 코스를 절대 자동으로 바꾸지 않는다. 같은 장소·같은 종류 제보가 서로 다른 기기 2대 이상, 60분 안에 모이면 "알림"이 켜지고,
 *  알림을 본 사람이 [코스 다시 짜기]를 눌러야만 코스가 바뀐다(app.js).
 *  기록 한 줄(제보):  { id, dev, type, placeId, minutes, simTs(시연 시계 분), at(실제 ms), near:true, text?, photo? }   ← 좌표 없음
 *  기록 한 줄(확인):  { id, dev, vote:'yes'|'no', type, placeId, simTs, at }
 *  시각 규칙은 시연 시계(simTs, 분) 기준 — 실제 서비스에서는 같은 자리에 실제 시각을 넣으면 된다. 속도 제한만 실제 시각(at, ms).
 */
(function (root) {
  'use strict';
  var WINDOW_MIN = 60;      // 서로 다른 기기 제보 2건이 이 안에 모이면 알림 켜짐
  var EXPIRE_MIN = 60;      // 마지막 제보(또는 "아직 그래요") 뒤 이만큼 지나면 알림 끝
  var NEAR_M = 200;         // 제보는 장소에서 이 거리 안에서만
  var ACC_MAX_M = 150;      // 위치 오차가 이보다 크면 근처 확인을 안 함
  var PLACE_GAP_MS = 15 * 60e3, HOUR_MS = 60 * 60e3, HOUR_MAX = 6;
  var KINDS = { crowd: 1, closed: 1, view: 1, 'new': 1 };

  function dist(lat1, lng1, lat2, lng2) { // 직선 거리(m) — haversine
    var R = 6371000, r = Math.PI / 180, dLat = (lat2 - lat1) * r, dLng = (lng2 - lng1) * r;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  function devOf(r) { return r.dev || r.client || r.id; }
  function isVote(r) { return !!(r && (r.vote === 'yes' || r.vote === 'no')); }
  function keyOf(type, placeId) { return type + '|' + placeId; }

  /* 근처 확인: pos = { lat, lng, acc(m) }, place = { lat, lng }. state: 'near' | 'far' | 'badacc' | 'nopos' */
  function checkNear(pos, place, opt) {
    opt = opt || {};
    var nearM = opt.nearM || NEAR_M, accMax = opt.accMax || ACC_MAX_M;
    if (!pos || !isFinite(pos.lat) || !isFinite(pos.lng) || !place || !isFinite(place.lat) || !isFinite(place.lng)) return { ok: false, state: 'nopos', m: null };
    if (!(pos.acc <= accMax)) return { ok: false, state: 'badacc', m: null, acc: pos.acc }; // acc 가 없거나(NaN) 크면 믿지 않는다
    var m = dist(pos.lat, pos.lng, place.lat, place.lng);
    return { ok: m <= nearM, state: m <= nearM ? 'near' : 'far', m: Math.round(m) };
  }
  /* 장소 목록을 가까운 순으로: { near:[{place,m}], far:[{place,m}], state } — 위치 오차가 크면 모두 far 가 아니라 state:'badacc' 로 비움 */
  function sortByDistance(pos, places, opt) {
    var out = { state: 'ok', near: [], far: [] };
    var first = places && places[0], c0 = first ? checkNear(pos, first, opt) : { state: 'nopos' };
    if (c0.state === 'nopos' || c0.state === 'badacc') { out.state = c0.state; return out; }
    (places || []).forEach(function (p) {
      var c = checkNear(pos, p, opt);
      (c.ok ? out.near : out.far).push({ place: p, m: c.m });
    });
    out.near.sort(function (a, b) { return a.m - b.m; }); out.far.sort(function (a, b) { return a.m - b.m; });
    return out;
  }

  /* 속도 제한: 한 기기가 같은 장소에 15분에 1건, 전체 1시간에 6건. records = 저장된 제보(확인 표시 제외). nowMs = 실제 시각. */
  function rateCheck(records, dev, placeId, nowMs) {
    var mine = (records || []).filter(function (r) { return !isVote(r) && devOf(r) === dev && isFinite(r.at); });
    if (mine.some(function (r) { return r.placeId === placeId && nowMs - r.at < PLACE_GAP_MS && nowMs >= r.at; })) {
      var last = mine.filter(function (r) { return r.placeId === placeId; }).reduce(function (a, r) { return Math.max(a, r.at); }, 0);
      return { ok: false, why: 'place', waitMin: Math.max(1, Math.ceil((PLACE_GAP_MS - (nowMs - last)) / 60e3)) };
    }
    var hour = mine.filter(function (r) { return nowMs - r.at < HOUR_MS && nowMs >= r.at; }).length;
    if (hour >= HOUR_MAX) return { ok: false, why: 'hour', waitMin: 0 };
    return { ok: true, why: '' };
  }

  /* 저장할 제보 한 줄을 만든다. 좌표·위치 오차는 받지도 않고 넣지도 않는다(허용한 칸만 복사). */
  function makeReport(o) {
    var r = { id: String(o.id), dev: String(o.dev), type: o.type, placeId: o.placeId, minutes: o.minutes || 0, simTs: +o.simTs, at: +o.at, near: true };
    if (o.text) r.text = String(o.text).slice(0, 80);
    if (o.photo) r.photo = true;
    return r;
  }
  function makeVote(o) {
    return { id: String(o.id), dev: String(o.dev), vote: o.vote === 'no' ? 'no' : 'yes', type: o.type, placeId: o.placeId, simTs: +o.simTs, at: +o.at };
  }
  /* 저장 전 마지막 검사: 좌표가 섞여 있으면 거짓 */
  function hasCoords(x) {
    var s = JSON.stringify(x);
    return /"(lat|lng|lon|latitude|longitude|coords|acc|accuracy|pos|position)"/i.test(s);
  }

  /* 알림 계산. records = 제보 + 확인 표시 전부, now = 시연 시계(분).
     돌려주는 것: 같은 종류·장소마다 한 줄 { key,type,placeId,minutes,reports,devices,first,latest,until,yes,no,state,since }
       state: 'pending'(기기 2대 미만) | 'active' | 'cancelled'(아니에요 2명 이상이고 아직 그래요보다 많음 — 한 명이 장난으로 못 끔) | 'expired'(60분 지남) */
  function alerts(records, now) {
    var by = {};
    (records || []).forEach(function (r) {
      if (!r || !KINDS[r.type] || !r.placeId) return;
      (by[keyOf(r.type, r.placeId)] = by[keyOf(r.type, r.placeId)] || []).push(r);
    });
    var out = [];
    Object.keys(by).forEach(function (k) {
      var all = by[k], reps = all.filter(function (r) { return !isVote(r) && isFinite(r.simTs); }).sort(function (a, b) { return a.simTs - b.simTs; });
      if (!reps.length) return;
      // 마지막 제보가 속한 묶음: 앞 제보와 60분 넘게 떨어지면 끊는다
      var i = reps.length - 1, cl = [reps[i]];
      while (i > 0 && reps[i].simTs - reps[i - 1].simTs <= WINDOW_MIN) { i--; cl.unshift(reps[i]); }
      var devs = {}; cl.forEach(function (r) { devs[devOf(r)] = 1; });
      var nDev = Object.keys(devs).length;
      // 서로 다른 기기 두 건이 60분 안에 있어야 켜짐
      var two = false, act = null;
      for (var a = 0; a < cl.length && !two; a++) for (var b = a + 1; b < cl.length; b++) if (devOf(cl[a]) !== devOf(cl[b]) && Math.abs(cl[b].simTs - cl[a].simTs) <= WINDOW_MIN) { two = true; act = Math.max(cl[a].simTs, cl[b].simTs); break; }
      var latestRep = cl[cl.length - 1].simTs, first = cl[0].simTs;
      // 확인 표시: 마지막 제보 이후 것만, 기기마다 마지막 한 번
      var votes = {};
      all.filter(function (r) { return isVote(r) && isFinite(r.simTs) && r.simTs >= latestRep; }).sort(function (a, b) { return a.simTs - b.simTs || (a.at || 0) - (b.at || 0); }).forEach(function (v) { votes[devOf(v)] = v; });
      var yes = 0, no = 0, latestYes = -1e9;
      Object.keys(votes).forEach(function (d) { if (votes[d].vote === 'yes') { yes++; latestYes = Math.max(latestYes, votes[d].simTs); } else no++; });
      var latest = Math.max(latestRep, latestYes), until = latest + EXPIRE_MIN;
      var state = !two ? 'pending' : (no >= 2 && no > yes) ? 'cancelled' : !(now < until) ? 'expired' : 'active';
      out.push({ key: k, type: cl[0].type, placeId: cl[0].placeId, minutes: cl.reduce(function (m, r) { return Math.max(m, r.minutes || 0); }, 0) || (cl[0].type === 'crowd' ? 20 : 0),
        reports: cl.length, devices: nDev, first: first, since: act, latest: latest, until: until, yes: yes, no: no, state: state, ids: cl.map(function (r) { return r.id; }) });
    });
    return out;
  }
  function activeAlerts(records, now) { return alerts(records, now).filter(function (a) { return a.state === 'active'; }); }

  /* 사람이 [코스 다시 짜기] 를 눌러 받아들인 알림(applied = { key:true })의 제보만 골라 계획 계산기(planner.effectsFromReports)에 준다 */
  function acceptedReports(records, applied, now) {
    var act = activeAlerts(records, now), ids = {};
    act.forEach(function (a) { if (applied && applied[a.key]) a.ids.forEach(function (x) { ids[x] = 1; }); });
    return (records || []).filter(function (r) { return !isVote(r) && ids[r.id]; });
  }

  var api = { WINDOW_MIN: WINDOW_MIN, EXPIRE_MIN: EXPIRE_MIN, NEAR_M: NEAR_M, ACC_MAX_M: ACC_MAX_M, dist: dist, checkNear: checkNear, sortByDistance: sortByDistance, rateCheck: rateCheck, makeReport: makeReport, makeVote: makeVote, hasCoords: hasCoords, alerts: alerts, activeAlerts: activeAlerts, acceptedReports: acceptedReports, isVote: isVote, devOf: devOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TourRep = api;
})(typeof window !== 'undefined' ? window : globalThis);
