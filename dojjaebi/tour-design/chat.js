/*
 * 동해 사랑방 (2026-11-09) — 로그인 없이 이름만 받아 동해 사람들과 한 줄씩 얘기하는 방.
 *  - 방은 하나. 장소 카드에서 들어오면 그 장소 이름이 붙은 채로 열리고 "이 장소 얘기만" 볼 수 있다.
 *  - 저장소: Firebase 실시간 데이터베이스(dojjaebi 프로젝트) 의 /msgs. 글은 24시간 뒤 목록에서 빠지고 접속할 때 지운다.
 *  - 검사 규칙(링크·전화번호·욕설·도배)은 chatfilter.js. 신고 3번이면 모두에게 가려진다.
 *  - 시연용 예시 글: 주소 뒤에 ?seed=1 을 붙여 한 번 열면 '예시' 표시가 붙은 글이 들어간다(진짜 이용자 글과 구분).
 *  - 나라 밖 서비스(gstatic)에서 받아 오므로 인터넷이 막히면 "연결이 안 돼요"가 뜨고 나머지 화면은 그대로 쓴다.
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js';
import { getDatabase, ref, push, query, limitToLast, onValue, serverTimestamp, remove, runTransaction } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-database.js';

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
  var DAY = 24 * 3600 * 1000, HIDE_AT = 3, GAP_MS = 5000, KEEP = 150;

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
      '<header class="cr-head"><div class="cr-ht"><h2 id="crTitle">동해 사랑방</h2><p class="cr-sub">이름도 얼굴도 몰라도 괜찮아요. 글은 24시간 뒤에 사라져요.</p></div>' +
      '<button type="button" class="cr-x" data-cr="close" aria-label="사랑방 닫기"><span aria-hidden="true">✕</span> 닫기</button></header>' +
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
    if (stick) scrollEnd(true);
  }

  function subscribe() {
    if (subscribed || !db) return; subscribed = true;
    var q = query(ref(db, 'msgs'), limitToLast(KEEP));
    onValue(q, function (snap) {
      var arr = [], cut = Date.now() - DAY;
      snap.forEach(function (c) {
        var v = c.val() || {}; v.k = c.key; v.ts = +v.ts || 0; arr.push(v);
        if (v.ts && v.ts < cut && !cleaned[c.key]) { cleaned[c.key] = 1; remove(ref(db, 'msgs/' + c.key)).catch(function () { /* 규칙상 못 지우면 목록에서만 빠짐 */ }); }
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
    push(ref(db, 'msgs'), rec).then(function () {
      lastSend = Date.now(); lastText = r.text; inp.value = ''; btn.disabled = false; render(true);
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
    if (db) runTransaction(ref(db, 'msgs/' + k + '/r'), function (v) { return (v || 0) + 1; }).catch(function () { /* 못 보내도 내 화면에선 가려짐 */ });
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

  window.TourChat = { open: open, close: close };
  var tab = document.getElementById('tabRoom');
  if (tab) tab.addEventListener('click', function () { open(null); });
  if (db) { subscribe(); } // 미리 연결해 두면 열 때 바로 글이 보인다
})();
