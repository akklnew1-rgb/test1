/* 도째비 길동무 v2 — 묻고 답한 글이 곧 추천. 저장소는 기존 사랑방과 같은 Firebase(/msgs 최근, /arch 보관). 글 모양: {u,t,ts,type?('q'|'a'),re?(질문 키),pl?,pn?,r?} */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js';
import { getDatabase, ref, push, query, limitToLast, get, set, serverTimestamp, runTransaction } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-database.js';
(function () {
  'use strict';
  var CFG = { apiKey: 'AIzaSyAvPAAx1HckCiiDG-OVonGPTalLJKhrZMU', authDomain: 'dojjaebi.firebaseapp.com', databaseURL: 'https://dojjaebi-default-rtdb.asia-southeast1.firebasedatabase.app', projectId: 'dojjaebi', appId: '1:968561148026:web:80d087555b2726b11bbbc3' };
  var F = window.ChatFilter, R = window.V2Rank, YEAR = 365 * 864e5, HIDE_AT = 3, GAP = 5000;
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { /* 저장 못 해도 괜찮음 */ } return null; }
  var uid = ls('chat.uid'); if (!uid) { uid = 'u' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); ls('chat.uid', uid); }
  var reported = {}; try { reported = JSON.parse(ls('chat.reported') || '{}') || {}; } catch (e) { reported = {}; }
  var db = null; try { db = getDatabase(initializeApp(CFG)); } catch (e) { db = null; }
  var names = ((window.TOUR_DATA && window.TOUR_DATA.places) || []).map(function (p) { return p.name; });
  var posts = [], loaded = false, cur = null, lastSend = 0, lastText = '';  // cur = { text, key? }

  function hm(ts) { var d = new Date(ts); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function ok(p) { return p && p.t && !p.d && (p.r || 0) < HIDE_AT && !reported[p.k] && (+p.ts || 0) > Date.now() - YEAR; }
  function isQ(p) { return p.type === 'q' || (p.type !== 'a' && R.isQuestion(p.t)); }

  function load() {
    if (!db) { loaded = true; render(); return; }
    Promise.all([get(query(ref(db, 'arch'), limitToLast(300))), get(query(ref(db, 'msgs'), limitToLast(80)))]).then(function (rs) {
      var seen = {};
      rs.forEach(function (s) { s.forEach(function (c) { var v = c.val() || {}; v.k = c.key; v.ts = +v.ts || 0; if (!seen[v.k] || (seen[v.k].r || 0) < (v.r || 0)) seen[v.k] = v; }); });
      posts = Object.keys(seen).map(function (k) { return seen[k]; }).filter(ok);
    }).catch(function () { /* 못 받으면 빈 목록 */ }).then(function () { loaded = true; render(); if (cur) showAns(); });
  }

  function render() {
    var qs = posts.filter(isQ).sort(function (a, b) { return b.ts - a.ts; }).slice(0, 6);
    $('qList').innerHTML = !loaded ? '<li class="muted">불러오는 중이에요…</li>' : qs.length ? qs.map(function (p) {
      return '<li class="q"><button type="button" data-q="' + esc(p.k) + '"><span class="tag">' + hm(p.ts) + '</span>' + esc(p.t) + '</button></li>';
    }).join('') : '<li class="muted">아직 질문이 없어요. 첫 질문을 남겨 보세요.</li>';
  }

  function show(v) { $('v-home').hidden = v !== 'home'; $('v-ans').hidden = v !== 'ans'; window.scrollTo(0, 0); }
  function open(text, key) { cur = { text: text, key: key || null }; $('msg').textContent = ''; show('ans'); showAns(); }

  function showAns() {
    var a = R.answer(cur.text, posts.filter(function (p) { return p.k !== cur.key; }), names, 8);
    var kids = cur.key ? posts.filter(function (p) { return p.re === cur.key && !isQ(p); }) : [];
    var list = kids.length ? kids : (a.mode === 'recent' ? a.list.slice(0, 3) : a.list), mode = kids.length ? 'match' : a.mode;
    $('qq').textContent = cur.text;
    var who = {}; list.forEach(function (p) { who[p.u] = 1; });
    var n = Object.keys(who).length;
    $('sum').textContent = !loaded ? '불러오는 중이에요…' : mode === 'match' ? '이용자 ' + n + '명이 남긴 글이에요' : mode === 'recent' ? '딱 맞는 글은 아직 없어요. 질문을 올리면 다녀간 분이 답해 줘요' : '아직 남겨진 글이 없어요. 첫 이야기를 남겨 주세요';
    var ab = $('askBox'), al = $('aList');
    if (mode === 'match') al.parentNode.insertBefore(al, ab); else al.parentNode.insertBefore(ab, $('aHead'));
    $('aHead').hidden = mode !== 'recent' || !list.length;
    $('aList').innerHTML = list.map(function (p) {
      return '<li><time>' + hm(p.ts) + '</time>' + (p.pn ? ' <span class="tag">' + esc(p.pn) + '</span>' : '') + (p.u === uid ? '' : '<button type="button" class="rp" data-rp="' + esc(p.k) + '" aria-label="이 글 신고하기">신고</button>') + '<p class="t">' + esc(p.t) + '</p></li>';
    }).join('');
    $('askBox').hidden = !!cur.key;
    $('askBoxT').textContent = '사랑방에 올리면 다녀간 분이 답을 남길 수 있어요.';
  }

  function msg(t) { $('msg').textContent = t; }
  function save(rec, done) {
    if (!db) { msg('연결이 안 돼서 지금은 보낼 수 없어요.'); return; }
    var w = GAP - (Date.now() - lastSend); if (w > 0) { msg('조금만 천천히요. ' + Math.ceil(w / 1000) + '초 뒤에 보낼 수 있어요.'); return; }
    var r = F.check(rec.t); if (!r.ok) { msg(r.why); return; }
    if (r.text === lastText) { msg('방금 보낸 글과 같아요.'); return; }
    rec.t = r.text; rec.u = uid; rec.ts = serverTimestamp();
    var pr = push(ref(db, 'msgs'), rec);
    pr.then(function () {
      var ar = { u: uid, t: rec.t, ts: Date.now() }; ['type', 're', 'pl', 'pn'].forEach(function (k) { if (rec[k]) ar[k] = rec[k]; });
      set(ref(db, 'arch/' + pr.key), ar).catch(function () { /* 보관 실패해도 방에는 남음 */ });
      lastSend = Date.now(); lastText = r.text; ar.k = pr.key; posts.push(ar); done(pr.key);
    }).catch(function () { msg('보내지 못했어요. 인터넷을 확인해 주세요.'); });
  }

  $('askForm').addEventListener('submit', function (e) { e.preventDefault(); var t = $('askIn').value.replace(/\s+/g, ' ').trim(); if (t) open(t); });
  $('chips').innerHTML = ['곰치국 잘하는 데 있어요?', '어르신과 걷기 편한 곳은?', '아이랑 갈 만한 곳 알려주세요', '묵호에서 1박 어때요?'].map(function (s) { return '<button type="button" data-say="' + esc(s) + '">' + esc(s) + '</button>'; }).join('');
  $('chips').addEventListener('click', function (e) { var b = e.target.closest('[data-say]'); if (b) open(b.getAttribute('data-say')); });
  $('qList').addEventListener('click', function (e) { var b = e.target.closest('[data-q]'); if (!b) return; var p = posts.filter(function (x) { return x.k === b.getAttribute('data-q'); })[0]; if (p) open(p.t, p.k); });
  $('back').addEventListener('click', function () { cur = null; show('home'); render(); });
  $('postQ').addEventListener('click', function () { save({ t: cur.text, type: 'q' }, function (k) { cur.key = k; msg('올렸어요. 다녀간 분이 답을 남기면 여기에 보여요.'); showAns(); render(); }); });
  $('ansForm').addEventListener('submit', function (e) {
    e.preventDefault(); var t = $('ansIn').value; if (!t.trim()) { msg('글을 적어 주세요'); return; }
    var rec = { t: t, type: 'a' }; if (cur.key) rec.re = cur.key;
    save(rec, function () { $('ansIn').value = ''; msg('남겼어요. 고마워요!'); showAns(); });
  });
  $('aList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-rp]'); if (!b) return;
    if (b.getAttribute('data-armed') !== '1') { b.setAttribute('data-armed', '1'); b.textContent = '정말 신고할까요? 한 번 더'; return; }
    var k = b.getAttribute('data-rp'); reported[k] = 1; ls('chat.reported', JSON.stringify(reported)); posts = posts.filter(ok); showAns(); msg('신고했어요. 여러 사람이 신고하면 글이 모두에게 가려져요.');
    if (db) { runTransaction(ref(db, 'msgs/' + k + '/r'), function (v) { return (v || 0) + 1; }).catch(function () {}); runTransaction(ref(db, 'arch/' + k + '/r'), function (v) { return v === null ? null : (v || 0) + 1; }).catch(function () {}); }
  });
  render(); load();
})();
