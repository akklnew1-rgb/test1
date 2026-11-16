/*
 * 동해 사랑방 (2026-11-09) — 로그인 없이 이름만 받아 동해 사람들과 한 줄씩 얘기하는 방.
 *  - 방은 하나. 장소 카드에서 들어오면 그 장소 이름이 붙은 채로 열리고 "이 장소 얘기만" 볼 수 있다.
 *  - 저장소: Firebase 실시간 데이터베이스(dojjaebi 프로젝트) 의 /msgs. 글은 지우지 않고 데이터로 쌓는다(방 화면엔 최근 3일·80개, 나머지는 /arch 보관함에 쌓아 장소 요약·추천엔 1년치를 쓴다). 신고가 쌓인 글만 가린다.
 *  - 검사 규칙(링크·전화번호·욕설·도배)은 chatfilter.js. 신고 3번이면 모두에게 가려진다.
 *  - 시연용 예시 글: 주소 뒤에 ?seed=1 을 붙여 한 번 열면 '예시' 표시가 붙은 글이 들어간다(진짜 이용자 글과 구분).
 *  - 나라 밖 서비스(gstatic)에서 받아 오므로 인터넷이 막히면 "연결이 안 돼요"가 뜨고 나머지 화면은 그대로 쓴다.
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js';
import { getDatabase, ref, push, query, limitToLast, onValue, serverTimestamp, remove, runTransaction, get, set } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-database.js';

(function () {
  'use strict';
  var CFG = {
    apiKey: 'AIzaSyAvPAAx1HckCiiDG-OVonGPTalLJKhrZMU',
    authDomain: 'dojjaebi.firebaseapp.com',
    databaseURL: 'https://dojjaebi-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId: 'dojjaebi',
    appId: '1:968561148026:web:80d087555b2726b11bbbc3'
  };
  var F = window.ChatFilter;
  var DAY = 3 * 24 * 3600 * 1000, DATA_DAY = 365 * 24 * 3600 * 1000, HIDE_AT = 3, GAP_MS = 5000, KEEP = 80, ARCH_N = 300; // 방 화면은 최근 3일·80개만 받아 데이터를 아낀다. 오래된 글은 따로 /arch 에 쌓아 두고 요약·추천이 필요할 때만 한 번에 받는다(5분 재사용) // 글은 지우지 않고 데이터로 쌓는다. 방 화면은 최근 30일, 요약·추천 자료는 1년치

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 저장 못 해도 괜찮음 */ } }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* 이 기기 식별(글쓴이 구분용 무작위 값 — 개인정보 아님) */
  var uid = lsGet('chat.uid');
  if (!uid) { uid = 'u' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); lsSet('chat.uid', uid); }
  var nick = lsGet('chat.nick') || F.nick(uid);
  lsSet('chat.nick', nick);
  var reported = {};
  try { reported = JSON.parse(lsGet('chat.reported') || '{}') || {}; } catch (e) { reported = {}; }

  var db = null, dbErr = null;
  try { db = getDatabase(initializeApp(CFG)); } catch (e) { dbErr = e; }

  var aiNote = null;                 // 방금 올린 질문에 붙는 AI 안내 { q, t } (글로 저장하지 않는다)
  var el = null;                     // 화면 뼈대(처음 열 때 만든다)
  var ctx = null;                    // { id, name } 장소 카드에서 들어왔을 때
  var filter = 'all';                // 'all' | 'place'
  var tagOn = true;                  // 보낼 글에 장소 이름 붙이기
  var msgs = [];                     // [{ k, u, n, t, ts, pl, pn, d, r }]
  var subscribed = false, loaded = false, lastSend = 0, lastText = '', opener = null, cleaned = {};
  var $ = function (id) { return document.getElementById(id); };

  function build() {
    el = document.createElement('div');
    el.id = 'chatRoom'; el.className = 'cr'; el.hidden = true;
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'crTitle'); el.tabIndex = -1;
    el.innerHTML =
      '<header class="cr-head"><div class="cr-ht"><h2 id="crTitle">동해 사랑방</h2><p class="cr-sub">이름도 얼굴도 몰라도 괜찮아요. 방에는 최근 3일 글이 보이고, 글은 따로 남아 다른 여행자의 추천에 쓰여요.</p></div>' +
      '<button type="button" class="cr-x" data-cr="close" aria-label="사랑방 닫기"><span aria-hidden="true">✕</span> 닫기</button></header>' +
      '<p class="cr-note" id="crNote">이용자가 남긴 글이에요. 도째비의 추천이 아니에요. 가게·숙소 정보는 가시기 전에 꼭 확인하세요.</p>' +
      '<div class="cr-chips" id="crChips" role="group" aria-label="글 골라 보기"><button type="button" class="cr-chip" data-crf="all" aria-pressed="true">전체</button><button type="button" class="cr-chip" data-crf="place" aria-pressed="false" hidden></button></div>' +
      '<div class="cr-rule" id="crRule"><span>서로 존중해 주세요. 링크·전화번호·홍보 글은 올릴 수 없어요. 시연 서비스라 글이 지워질 수 있어요.</span><button type="button" class="cr-ok" data-cr="rule">알겠어요</button></div>' +
      '<p class="cr-state" id="crState" role="status"></p>' +
      '<ol class="cr-list" id="crList" aria-live="polite"></ol>' +
      '<form class="cr-form" id="crForm" autocomplete="off">' +
      '<button type="button" class="cr-tag" id="crTag" aria-pressed="true" hidden></button>' +
      '<div class="cr-row"><input id="crIn" type="text" maxlength="' + F.MAX + '" placeholder="한 줄로 남겨요 (' + F.MAX + '자)" aria-label="사랑방에 남길 글" enterkeyhint="send"><button type="submit" class="cr-send">보내기</button></div>' +
      '<p class="cr-msg" id="crMsg" role="status"></p>' +
      '<p class="cr-me">내 이름: <b id="crNick"></b></p></form>';
    document.documentElement.appendChild(el); // body 바깥에 둔다(body 는 안쪽 고정 위치를 가두기 때문)
    $('crNick').textContent = nick;
    if (lsGet('chat.rule') === '1') $('crRule').hidden = true;
    el.addEventListener('click', onClick);
    $('crForm').addEventListener('submit', function (ev) { ev.preventDefault(); send(); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && el && !el.hidden) close(); });
    if (window.visualViewport) {
      var fit = function () { if (!el || el.hidden) return; var v = window.visualViewport; el.style.height = v.height + 'px'; el.style.top = v.offsetTop + 'px'; scrollEnd(true); };
      window.visualViewport.addEventListener('resize', fit); window.visualViewport.addEventListener('scroll', fit);
    }
  }

  function setMsg(t, bad) { var m = $('crMsg'); if (!m) return; m.textContent = t || ''; m.className = 'cr-msg' + (bad ? ' bad' : ''); }

  function chipsUi() {
    var pc = el.querySelector('[data-crf="place"]'), ac = el.querySelector('[data-crf="all"]');
    pc.hidden = !ctx;
    if (ctx) pc.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-pin"/></svg> ' + esc(ctx.name) + ' 얘기만';
    ac.setAttribute('aria-pressed', filter === 'all' ? 'true' : 'false');
    pc.setAttribute('aria-pressed', filter === 'place' ? 'true' : 'false');
    var tg = $('crTag'); tg.hidden = !ctx;
    if (ctx) { tg.setAttribute('aria-pressed', tagOn ? 'true' : 'false'); tg.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-pin"/></svg> ' + (tagOn ? esc(ctx.name) + ' 얘기로 보내기' : '장소 없이 보내기') + ' <small>(누르면 바뀌어요)</small>'; }
  }

  function visible() {
    var cut = Date.now() - DAY;
    return msgs.filter(function (m) {
      if (!m.t || m.ts < cut || (m.r || 0) >= HIDE_AT || reported[m.k]) return false;
      return filter === 'place' && ctx ? m.pl === ctx.id : true;
    });
  }
  function hm(ts) {
    var d = new Date(ts), n = new Date(), s = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    return d.toDateString() === n.toDateString() ? s : '어제 ' + s;
  }
  function dt(ts) { var d = new Date(ts); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function nearEnd() { var l = $('crList'); return l.scrollHeight - l.scrollTop - l.clientHeight < 120; }
  function scrollEnd(force) { var l = $('crList'); if (l && (force || nearEnd())) l.scrollTop = l.scrollHeight; }

  function render(forceScroll) {
    if (!el) return;
    var stick = forceScroll || nearEnd(), list = visible(), st = $('crState');
    if (dbErr) st.textContent = '연결이 안 돼요. 인터넷을 확인하고 다시 열어 주세요.';
    else if (!loaded) st.textContent = '불러오는 중이에요…';
    else st.textContent = '';
    st.hidden = !st.textContent;
    $('crList').innerHTML = list.length ? list.map(function (m) {
      var mine = m.u === uid;
      return '<li class="cr-m' + (mine ? ' mine' : '') + '" data-k="' + esc(m.k) + '">' +
        '<div class="cr-mh"><b>' + esc(m.n || '도깨비') + '</b>' + (m.d ? '<span class="cr-demo">시연용 예시</span>' : '') + '<time>' + hm(m.ts) + '</time></div>' +
        (m.pn ? '<span class="cr-pl"><svg class="ic" aria-hidden="true"><use href="#i-pin"/></svg>' + esc(m.pn) + '</span>' : '') +
        '<p class="cr-t">' + esc(m.t) + '</p>' +
        (mine || m.d ? '' : '<button type="button" class="cr-rp" data-rp="' + esc(m.k) + '" aria-label="이 글 신고하기">신고</button>') + '</li>';
    }).join('') : (loaded && !dbErr ? '<li class="cr-empty">' + (filter === 'place' && ctx ? '아직 ' + esc(ctx.name) + ' 얘기가 없어요.<br>첫 마디를 남겨 보세요.' : '아직 아무도 없어요.<br>첫 마디를 남겨 보세요.') + '</li>' : '');
    if (aiNote && (aiNote.found.length || aiNote.t !== '')) {
      var who = {}; aiNote.found.forEach(function (m) { who[m.u] = 1; });
      $('crList').insertAdjacentHTML('beforeend', '<li class="cr-ai">' +
        (aiNote.found.length ? '<span class="cr-aitag">사랑방에 이런 이야기가 있어요 · 이용자 ' + Object.keys(who).length + '명</span><ul class="cr-aif">' + aiNote.found.map(function (m) { return '<li><time>' + dt(m.ts) + '</time> ' + esc(m.t) + '</li>'; }).join('') + '</ul>' : '') +
        (aiNote.t === null ? '<span class="cr-aitag">AI 안내</span><p class="cr-t">도째비가 살펴보는 중이에요…</p>' : aiNote.t ? '<span class="cr-aitag">AI 안내예요 · 이용자 글이 아니에요</span><p class="cr-t">' + esc(aiNote.t) + '</p>' : '') + '</li>');
    }
    if (stick || aiNote) scrollEnd(true);
  }
  /* 지금 시각 기준으로 장소마다 열림 여부와 남은 시간을 코드가 계산해 AI에 넘긴다(AI가 시간을 계산하지 않게) */
  function nowText() { var d = new Date(); return '일월화수목금토'.charAt(d.getDay()) + '요일 ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function hhmm(m) { return ('0' + Math.floor(m / 60) % 24).slice(-2) + ':' + ('0' + m % 60).slice(-2); }
  function placeInfo() {
    var d = new Date(), now = d.getHours() * 60 + d.getMinutes(), dow = d.getDay();
    return ((window.TOUR_DATA && window.TOUR_DATA.places) || []).map(function (p) {
      var o = p.open || [0, 1440], h = String(p.openText || '').replace(/\s*·\s*관광공사 자료/, ''), s;
      var always = o[0] <= 0 && o[1] >= 1440;
      if (p['확인필요'] && !always) s = '운영일·시각이 불확실해서 추천하지 않음';
      else if ((p.closedDow || []).indexOf(dow) >= 0) s = '오늘 쉬는 날';
      else if (always) s = '지금 열림(늘 열려 있음)';
      else if (now < o[0]) s = '아직 안 열림(' + hhmm(o[0]) + '에 열어요)';
      else if (now >= o[1]) s = '오늘 영업 끝(' + hhmm(o[1]) + '에 닫았어요)';
      else s = '지금 열림(' + hhmm(o[1]) + '까지, ' + (o[1] - now) + '분 남음)';
      return { n: p.name, h: h + (p.closedText ? ' · 쉬는 날 ' + String(p.closedText).replace(/\(.*\)/, '') : ''), s: s };
    });
  }
  function askAI(q) {
    var R = window.V2Rank, url = window.DOJJAEBI_AI_URL;
    if (!R || !R.isQuestion(q)) { aiNote = null; return; }
    var mine = aiNote = { q: q, t: null, found: [] };
    var names = ((window.TOUR_DATA && window.TOUR_DATA.places) || []).map(function (p) { return p.name; });
    function go() {
      var cut = Date.now() - DATA_DAY;
      mine.found = R.relevant(q, pool().filter(function (m) { return m.t && !m.d && m.ts >= cut && (m.r || 0) < HIDE_AT && !reported[m.k]; }), names).slice(0, 4);
      if (aiNote === mine && el && !el.hidden) render(false);
      if (!url || !window.fetch) { if (aiNote === mine) { mine.t = ''; if (el && !el.hidden) render(false); } return; }
      var ctl = window.AbortController ? new AbortController() : null, tm = setTimeout(function () { if (ctl) ctl.abort(); }, 9000);
      fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ task: 'qa', q: q, places: names, info: placeInfo(), now: nowText(), posts: (function () { var w = {}, k = 0; return mine.found.map(function (m) { if (w[m.u] === undefined) w[m.u] = k++; return { w: w[m.u], t: m.t }; }); })() }), signal: ctl ? ctl.signal : undefined })
        .then(function (r) { return r.json(); }).then(function (j) { mine.t = j && j.ok ? j.reply : ''; })
        .catch(function () { mine.t = ''; }).then(function () { clearTimeout(tm); if (aiNote === mine && el && !el.hidden) render(false); });
    }
    loadArch(go);
  }

  function subscribe() {
    if (subscribed || !db) return; subscribed = true;
    var q = query(ref(db, 'msgs'), limitToLast(KEEP));
    onValue(q, function (snap) {
      var arr = [], cut = Date.now() - DAY;
      snap.forEach(function (c) {
        var v = c.val() || {}; v.k = c.key; v.ts = +v.ts || 0; arr.push(v);
      });
      msgs = arr; loaded = true; render(false);
      maybeSeed();
    }, function () { dbErr = new Error('read'); loaded = true; render(false); });
    setTimeout(function () { if (!loaded) { dbErr = dbErr || new Error('timeout'); render(false); } }, 9000);
  }

  function send() {
    if (!db) { setMsg('연결이 안 돼서 지금은 보낼 수 없어요.', true); return; }
    var inp = $('crIn'), r = F.check(inp.value);
    if (!r.ok) { setMsg(r.why, true); return; }
    var wait = GAP_MS - (Date.now() - lastSend);
    if (wait > 0) { setMsg('조금만 천천히요. ' + Math.ceil(wait / 1000) + '초 뒤에 보낼 수 있어요.', true); return; }
    if (r.text === lastText) { setMsg('방금 보낸 글과 같아요.', true); return; }
    var rec = { u: uid, n: nick, t: r.text, ts: serverTimestamp() };
    if (ctx && tagOn) { rec.pl = ctx.id; rec.pn = ctx.name; }
    var btn = el.querySelector('.cr-send'); btn.disabled = true; setMsg('');
    var pr = push(ref(db, 'msgs'), rec);
    pr.then(function () {
      var ar = { u: rec.u, t: rec.t, ts: Date.now() }; if (rec.pl) { ar.pl = rec.pl; ar.pn = rec.pn; }
      set(ref(db, 'arch/' + pr.key), ar).catch(function () { /* 보관 실패는 무시 */ });
      lastSend = Date.now(); lastText = r.text; inp.value = ''; btn.disabled = false; askAI(r.text); render(true);
    }).catch(function () { btn.disabled = false; setMsg('보내지 못했어요. 인터넷을 확인해 주세요.', true); });
  }

  function report(k, btn) {
    if (btn.getAttribute('data-armed') !== '1') {
      btn.setAttribute('data-armed', '1'); btn.textContent = '정말 신고할까요? 한 번 더';
      setTimeout(function () { if (btn.isConnected) { btn.removeAttribute('data-armed'); btn.textContent = '신고'; } }, 3500);
      return;
    }
    reported[k] = 1; lsSet('chat.reported', JSON.stringify(reported)); render(false);
    setMsg('신고했어요. 여러 사람이 신고하면 글이 모두에게 가려져요.');
    if (db) { runTransaction(ref(db, 'msgs/' + k + '/r'), function (v) { return (v || 0) + 1; }).catch(function () { /* 못 보내도 내 화면에선 가려짐 */ });
      runTransaction(ref(db, 'arch/' + k + '/r'), function (v) { return v === null ? null : (v || 0) + 1; }).catch(function () { /* 무시 */ }); }
  }

  function onClick(ev) {
    var t = ev.target.closest('[data-cr],[data-crf],[data-rp],#crTag'); if (!t) return;
    if (t.id === 'crTag') { tagOn = !tagOn; chipsUi(); return; }
    var cr = t.getAttribute('data-cr');
    if (cr === 'close') { close(); return; }
    if (cr === 'rule') { $('crRule').hidden = true; lsSet('chat.rule', '1'); return; }
    var f = t.getAttribute('data-crf'); if (f) { filter = f; chipsUi(); render(true); return; }
    var rp = t.getAttribute('data-rp'); if (rp) report(rp, t);
  }

  function open(c) {
    if (!el) build();
    opener = document.activeElement;
    ctx = c && c.id ? { id: String(c.id), name: String(c.name || '이 장소') } : null;
    filter = ctx ? 'place' : 'all'; tagOn = true;
    el.style.fontSize = getComputedStyle(document.body).fontSize;
    el.hidden = false; document.documentElement.classList.add('cr-open');
    if (window.visualViewport) { el.style.height = window.visualViewport.height + 'px'; el.style.top = window.visualViewport.offsetTop + 'px'; }
    setMsg(''); chipsUi(); subscribe(); render(true);
    try { el.focus({ preventScroll: true }); } catch (e) { /* 무시 */ }
  }
  function close() {
    if (!el) return; el.hidden = true; document.documentElement.classList.remove('cr-open');
    try { if (opener && opener.focus) opener.focus({ preventScroll: true }); } catch (e) { /* 무시 */ }
  }

  /* 시연용 예시 글: 주소에 ?seed=1 이 있을 때 한 번만(새로 고칠 때마다 또 들어가지 않게 세션에 표시) */
  var DEMO = [
    { m: 95, pl: 'lighthouse', pn: '묵호등대', t: '해 질 무렵 바다 색이 정말 예뻐요. 바람이 세니 겉옷 챙기세요.' },
    { m: 80, pl: 'chuam', pn: '추암 촛대바위', t: '일출 보러 가려는데 이른 아침에도 주차할 수 있을까요?' },
    { m: 60, pl: 'chuam', pn: '추암 촛대바위', t: '이른 아침엔 덜 붐비는 편이라고 들었어요. 가기 전에 한 번 확인해 보세요.' },
    { m: 42, pl: 'nolgol', pn: '논골담길', t: '계단이 꽤 있어서 편한 신발이 좋아요.' },
    { m: 25, pl: 'skyvalley', pn: '도째비골 스카이밸리', t: '오늘 스카이워크 가려는데 바람 많이 부나요?' },
    { m: 8, t: '오늘 동해 처음 왔어요. 다들 점심은 어디서 드세요?' }
  ];
  var seeded = false;
  function maybeSeed() {
    if (seeded || !db || !/[?&]seed=1\b/.test(location.search)) return; seeded = true;
    try { if (sessionStorage.getItem('chat.seeded') === '1') return; sessionStorage.setItem('chat.seeded', '1'); } catch (e) { /* 무시 */ }
    if (msgs.some(function (x) { return x.d; })) return; // 이미 예시가 있으면 또 넣지 않음
    var now = Date.now();
    DEMO.forEach(function (d, i) {
      var rec = { u: 'demo', n: F.nick('demo' + i), t: d.t, ts: now - d.m * 60000, d: 1 };
      if (d.pl) { rec.pl = d.pl; rec.pn = d.pn; }
      push(ref(db, 'msgs'), rec).catch(function () { /* 무시 */ });
    });
  }

  /* ---- 장소 카드의 "사랑방 얘기 요약" (AI 중계 task:'room') ----
   * 그 장소 이름이 붙은 최근 24시간 글만 보낸다. 글쓴이는 번호(0,1,2…)로만 보내고, "이용자 N명"은 중계 함수가 번호를 세어 돌려준다.
   * 요약은 도째비의 추천이 아니라 이용자가 한 말을 전하는 것 — 화면에도 그렇게 적는다. 같은 장소는 90초 동안 결과를 다시 쓴다. */
  /* 보관함(/arch): 방 화면과 따로 쌓는 글 모음. 필요할 때만 최근 ARCH_N 개를 한 번 받고 5분 동안 다시 쓴다 */
  var arch = [], archAt = 0, archBusy = null;
  function loadArch(cb) {
    if (!db) { cb && cb(); return; }
    if (Date.now() - archAt < 300000) { cb && cb(); return; }
    if (archBusy) { if (cb) archBusy.push(cb); return; }
    archBusy = cb ? [cb] : [];
    get(query(ref(db, 'arch'), limitToLast(ARCH_N))).then(function (snap) {
      var a = []; snap.forEach(function (c) { var v = c.val() || {}; v.k = c.key; v.ts = +v.ts || 0; a.push(v); }); arch = a; archAt = Date.now();
    }).catch(function () { /* 못 받으면 방 화면 글만 쓴다 */ }).then(function () { var w = archBusy || []; archBusy = null; w.forEach(function (f) { f(); }); });
  }
  function pool() { var seen = {}, out = []; arch.concat(msgs).forEach(function (m) { if (seen[m.k] && seen[m.k].r >= (m.r || 0)) return; seen[m.k] = m; }); Object.keys(seen).forEach(function (k) { out.push(seen[k]); }); return out.sort(function (a, b) { return a.ts - b.ts; }); }
  var placeNames = {}; // 장소 id → 이름들(글에 장소 이름이 들어 있으면 그 장소 얘기로 센다). 앱이 setPlaces 로 알려 준다
  var sumCache = {}, MOOD = { good: '좋았다는 말', bad: '아쉬웠다는 말', info: '알려 준 말', ask: '궁금해하는 말' };
  function roomMsgs(id) {
    var cut = Date.now() - DATA_DAY, nm = placeNames[id] || [];
    return pool().filter(function (m) {
      if (!m.t || m.ts < cut || (m.r || 0) >= HIDE_AT || reported[m.k]) return false;
      return m.pl === id || nm.some(function (n) { return n && m.t.indexOf(n) >= 0; });
    });
  }
  /* 요약 아래 '이용자가 남긴 글' 원문(글쓴이 이름 없이 날짜·시각과 글만) — 요약이 맞는지 직접 확인할 수 있게 */
  function rawList(list) {
    var li = list.slice(-12).reverse().map(function (m) { var d = new Date(m.ts); return '<li><time>' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + '</time> ' + esc(m.t) + (m.d ? ' <em>(예시)</em>' : '') + '</li>'; }).join('');
    return '<details class="rs-raw"><summary>이용자가 남긴 글 ' + list.length + '개 그대로 보기</summary><ul>' + li + '</ul></details>';
  }
  function sumShow(out, html) { out.innerHTML = html; }
  function summary(id, name, out, btn) { loadArch(function () { summaryGo(id, name, out, btn); }); }
  function summaryGo(id, name, out, btn) {
    id = String(id); name = String(name || '이 장소');
    var list = roomMsgs(id);
    if (!list.length) {
      sumShow(out, '<p class="rs-none">아직 ' + esc(name) + ' 얘기가 없어요. 사랑방에서 첫 마디를 남겨 보세요.</p>');
      return;
    }
    var sig = list.length + ':' + list[list.length - 1].k, c = sumCache[id];
    if (c && c.sig === sig && Date.now() - c.at < 90000) { sumShow(out, c.html); return; }
    var url = window.DOJJAEBI_AI_URL;
    if (!url) { sumShow(out, '<p class="rs-none">AI 연결이 없어서 요약을 못 해요. 아래 글을 직접 읽어 보세요.</p>' + rawList(list)); return; }
    var who = {}, nw = 0, body = list.slice(-40).map(function (m) { if (who[m.u] == null) who[m.u] = nw++; return { w: who[m.u], t: m.t }; });
    var hasDemo = list.some(function (m) { return m.d; });
    if (btn) btn.disabled = true;
    sumShow(out, '<p class="rs-none">이용자 글을 읽고 있어요…</p>');
    var ctl = typeof AbortController === 'function' ? new AbortController() : null, to = setTimeout(function () { if (ctl) ctl.abort(); }, 12000);
    fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ task: 'room', place: { id: id, name: name }, msgs: body }), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.ok) throw new Error('fail');
        var li = (j.items || []).map(function (it) {
          return '<li><span class="rs-m rs-' + esc(it.mood) + '">' + esc(MOOD[it.mood] || MOOD.info) + '</span> <b>이용자 ' + (+it.n || 1) + '명</b> · ' + (it.topic ? esc(it.topic) + ': ' : '') + esc(it.gist) + '</li>';
        }).join('');
        var d = new Date(), t = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
        var html = (li ? '<ul class="rs-list">' + li + '</ul>' : '<p class="rs-none">요약할 만한 내용이 아직 없어요.</p>') +
          '<p class="rs-foot">이용자 글 ' + (+j.total || list.length) + '개(글쓴이 ' + (+j.writers || nw) + '명)를 AI가 요약했어요 · ' + t + ' 기준. 사실과 다를 수 있고 도째비의 추천이 아니에요.' + (hasDemo ? ' <b>시연용 예시 글이 들어 있어요.</b>' : '') + '</p>';
        html += rawList(list);
        sumCache[id] = { sig: sig, at: Date.now(), html: html };
        sumShow(out, html);
        if (btn) btn.textContent = '다시 요약하기';
      })
      .catch(function () { sumShow(out, '<p class="rs-none">요약을 못 불러왔어요. 아래 글을 직접 읽어 보세요.</p>' + rawList(list)); })
      .then(function () { clearTimeout(to); if (btn) btn.disabled = false; });
  }

  /* AI 대화(맛집·숙소 질문)에 쓸 최근 이용자 글: 글쓴이는 번호로만, 신고 많은 글·예시 글 제외, 최근 1년 최대 n개 */
  function recent(n) {
    var cut = Date.now() - DATA_DAY, who = {}, nw = 0;
    return pool().filter(function (m) { return m.t && !m.d && m.ts >= cut && (m.r || 0) < HIDE_AT && !reported[m.k]; }).slice(-(n || 40)).map(function (m) { if (who[m.u] == null) who[m.u] = nw++; return { w: who[m.u], t: String(m.t).slice(0, 80) }; });
  }
  function setPlaces(list) { (list || []).forEach(function (p) { if (p && p.id) placeNames[String(p.id)] = [p.name, p.short].filter(function (x, i, a) { return x && a.indexOf(x) === i && x.length >= 3; }); }); }
  setTimeout(function () { loadArch(); }, 2500); // 대화 AI 가 쓸 수 있게 미리 한 번
  window.TourChat = { open: open, close: close, summary: summary, recent: recent, setPlaces: setPlaces };
  if (window.TourNav) window.TourNav.register('chatRoom', close);
  var tab = document.getElementById('tabRoom');
  if (tab) tab.addEventListener('click', function () { open(null); });
  if (db) { subscribe(); } // 미리 연결해 두면 열 때 바로 글이 보인다
})();
