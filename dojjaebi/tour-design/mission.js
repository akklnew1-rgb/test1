/*
 * 도깨비 미션 (2026-11-13) — 장소마다 도깨비가 낸 미션을 하나씩 해결하면 도장이 찍히고, 끝나면 도깨비가 엽서를 써 준다.
 * 장소·할 일은 아래 표(MISSIONS)에 고정돼 있다. 미션은 세 가지 모양이다 — 고르기(pick)·짧은 글(text)·찾아 체크(bingo). 긴 글·사진 판정은 일부러 뺐다.
 * 인공지능은 도깨비 한마디·내 답에 대한 반응·엽서 글만 쓰고, 실패하거나 느리면 아래 기본 글로 바로 돌아온다.
 * "먼저 다녀간 여행자" 칸은 Firebase(mtraces)에 실제로 남은 답만 보여준다. 데이터가 없으면 없다고 말하고, 숫자를 지어내지 않는다.
 * 도장은 "현장 확인"(휴대폰 위치가 장소 근처)과 "직접 확인"(위치를 못 받음)으로 나눠 표시한다 — 위치·사진은 완벽한 방문 증명이 아니다.
 * 저장: 이 기기(localStorage)에만. 사진은 기기 메모리에만 두고 서버로 보내지 않는다.
 * 본선에서 장소를 바꾸려면 MISSIONS 표만 고치면 된다(좌표는 places.js 와 같은 값).
 */
(function (root) {
  'use strict';

  var PLACES = [
    { id: 'mukhoport', name: '묵호항·묵호시장', short: '묵호항', lat: 37.5503878, lng: 129.1125091 },
    { id: 'nolgol', name: '논골담길', short: '논골담길', lat: 37.5522210, lng: 129.1183391 },
    { id: 'lighthouse', name: '묵호등대', short: '묵호등대', lat: 37.5548308, lng: 129.1184742 }
  ];
  var MISSIONS = [
    { id: 'mukhoport-1', place: 'mukhoport', kind: 'pick', title: '도깨비 취향 맞히기', ask: '도깨비는 항구에서 무엇이 더 멋지다고 할까요?', options: ['갈매기', '배', '둘 다'], line: '도깨비는 항구에 올 때마다 고민해요. 누가 더 멋질까?', hint: '정답은 없어요. 보이는 대로 골라 보세요.' },
    { id: 'mukhoport-2', place: 'mukhoport', kind: 'text', title: '시장에서 만난 것에 별명 붙이기', ask: '별명을 지어 주세요', max: 15, ph: '예: 파란 심술쟁이', line: '이름 없는 것들에게 이름을 지어 주면 도깨비가 좋아해요.', hint: '사람 얼굴 말고 물건이나 풍경으로 해 주세요.' },
    { id: 'nolgol-1', place: 'nolgol', kind: 'text', title: '벽화 속 인물이 도깨비를 만나면 뭐라고 할까?', ask: '첫마디를 한 문장으로', max: 30, ph: '예: 어머, 도깨비가 길을 잃었나?', line: '벽 속 사람들이 도깨비한테 뭐라고 할지 궁금해요.', hint: '길이 좁으니 지나가는 분께 길을 비켜 주세요.' },
    { id: 'nolgol-2', place: 'nolgol', kind: 'bingo', title: '골목에서 찾아보기', ask: '눈에 띈 것을 2개 이상 골라 주세요', items: ['벽화', '계단', '바다 한 조각', '알록달록한 색'], min: 2, line: '걷다 보면 하나씩 눈에 들어와요. 없는 건 안 골라도 돼요.', hint: '오르막은 무리하지 말고 쉬엄쉬엄 올라가요.' },
    { id: 'lighthouse-1', place: 'lighthouse', kind: 'pick', title: '오늘 바다를 한 단어로', ask: '오늘 바다는 어떤 느낌인가요?', options: ['설렘', '자유', '그리움', '시원함'], line: '도깨비는 바다 앞에서 말을 잠깐 멈춰요.', hint: '바람이 센 날은 난간에서 한 걸음 떨어져 주세요.' },
    { id: 'lighthouse-2', place: 'lighthouse', kind: 'text', title: '바다를 보며 도깨비에게 소원 한 줄', ask: '소원을 한 줄로 (돈 얘기는 빼고요)', max: 20, ph: '예: 오늘 같은 날이 자주 오게 해 주세요', line: '도깨비가 소원을 하나쯤은 귀담아들어요.', hint: '길게 안 써도 돼요.' }
  ];
  var NEAR_M = 500; // 이 안이면 "현장 확인" (휴대폰 위치 오차를 넉넉히 본다)
  var KEY = 'dojjaebi.mission.v2';

  /* ---------- 계산 (화면 없이 시험할 수 있게 따로) ---------- */
  function dist(a, b) {
    var R = 6371000, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function placeOf(m) { for (var i = 0; i < PLACES.length; i++) if (PLACES[i].id === m.place) return PLACES[i]; return null; }
  function findMission(id) { for (var i = 0; i < MISSIONS.length; i++) if (MISSIONS[i].id === id) return MISSIONS[i]; return null; }
  function judge(m, pos) { // pos: {lat,lng} 또는 null → 'gps' | 'self'
    var p = placeOf(m);
    if (!p || !pos || typeof pos.lat !== 'number' || typeof pos.lng !== 'number') return 'self';
    return dist(p, pos) <= NEAR_M ? 'gps' : 'self';
  }
  function loadStamps(storage) {
    try { var j = JSON.parse((storage || root.localStorage).getItem(KEY) || '{}'); return (j && typeof j === 'object') ? j : {}; } catch (e) { return {}; }
  }
  function saveStamps(st, storage) { try { (storage || root.localStorage).setItem(KEY, JSON.stringify(st)); } catch (e) { /* 저장이 막혀도 화면에서는 계속 쓴다 */ } }
  function stampList(st) { return MISSIONS.filter(function (m) { return st[m.id]; }); }
  function fallbackPostcard(list, st) {
    var names = []; list.forEach(function (m) { var p = placeOf(m); if (p && names.indexOf(p.short) < 0) names.push(p.short); });
    var n = list.length, gps = list.filter(function (m) { return st[m.id].via === 'gps'; }).length;
    var body = '오늘 ' + (names.join('·') || '묵호') + '에서 미션 ' + n + '개를 해결했어요. ' + (gps ? '직접 그곳에 서서 해낸 ' + gps + '개는 도깨비가 특히 기억해 둘게요. ' : '') + '다음에 또 놀러 오면 새 미션을 낼게요.';
    return { title: n >= MISSIONS.length ? '묵호 도깨비 졸업장' : '도깨비와 걸은 날', body: body };
  }
  function wrapText(measure, text, maxW) { // 글자 단위로 줄 나누기(한국어)
    var lines = [], cur = '';
    String(text || '').split('\n').forEach(function (para) {
      cur = '';
      for (var i = 0; i < para.length; i++) {
        var t = cur + para[i];
        if (measure(t) > maxW && cur) { lines.push(cur); cur = para[i]; } else cur = t;
      }
      lines.push(cur);
    });
    return lines;
  }

  /* 답 검사: pick 은 보기 중 하나, text 는 글자 수 안(글 검사 규칙 chatfilter 가 있으면 함께), bingo 는 min 개 이상 */
  function validateAnswer(m, value, filter) {
    if (m.kind === 'pick') return (m.options || []).indexOf(value) >= 0 ? { ok: true, text: value } : { ok: false, why: '하나를 골라 주세요' };
    if (m.kind === 'bingo') {
      var got = (Array.isArray(value) ? value : []).filter(function (x, i, a) { return (m.items || []).indexOf(x) >= 0 && a.indexOf(x) === i; });
      return got.length >= (m.min || 1) ? { ok: true, text: got.join(', '), n: got.length } : { ok: false, why: (m.min || 1) + '개 이상 골라 주세요' };
    }
    var t = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    if (!t) return { ok: false, why: '한 줄 적어 주세요' };
    if (t.length > (m.max || 30)) return { ok: false, why: (m.max || 30) + '자까지 적을 수 있어요' };
    if (filter) { var f = filter.check(t); if (!f.ok) return { ok: false, why: f.why }; }
    return { ok: true, text: t };
  }
  /* 먼저 다녀간 사람들의 답 모으기 — 내가 쓴 것은 빼고, 실제로 있는 것만 센다 */
  function othersOf(records, myUid) { return (records || []).filter(function (r) { return r && r.u !== myUid && typeof r.t === 'string' && r.t; }); }
  function tally(m, records, myUid) { // pick → [{label, n}] (n>0 만), 전체 인원
    var o = othersOf(records, myUid), cnt = {}; o.forEach(function (r) { cnt[r.t] = (cnt[r.t] || 0) + 1; });
    var out = (m.options || []).filter(function (x) { return cnt[x]; }).map(function (x) { return { label: x, n: cnt[x] }; });
    return { total: o.length, rows: out };
  }
  function recentTexts(records, myUid, filter, n) { // text → 최근 글 n개 (검사 규칙 통과한 것만)
    var o = othersOf(records, myUid).sort(function (a, b) { return (+b.ts || 0) - (+a.ts || 0); }), out = [];
    for (var i = 0; i < o.length && out.length < (n || 3); i++) { if (!filter || filter.check(o[i].t).ok) out.push(o[i].t); }
    return out;
  }
  function fallbackReact(m, answer) {
    if (m.kind === 'pick') return '“' + answer + '”라고 하셨군요. 도깨비가 기억해 둘게요.';
    if (m.kind === 'bingo') return '골목에서 ' + answer + ' 쪽을 눈여겨보셨네요. 도깨비도 뿌듯해요.';
    return '좋은 말이에요. 도깨비가 잘 받아 적었어요.';
  }

  var api = { PLACES: PLACES, MISSIONS: MISSIONS, NEAR_M: NEAR_M, dist: dist, judge: judge, findMission: findMission, loadStamps: loadStamps, saveStamps: saveStamps, stampList: stampList, fallbackPostcard: fallbackPostcard, wrapText: wrapText, validateAnswer: validateAnswer, tally: tally, recentTexts: recentTexts, fallbackReact: fallbackReact };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.TourMission = api;
  if (typeof document === 'undefined') return;

  /* ---------- 화면 ---------- */
  var st = loadStamps(), photos = {}, lines = {}, el = null, open = null, view = 'list';
  var tr = {};            // 먼저 다녀간 사람들의 답: { 미션id: { state:'loading'|'ok'|'fail', rows:[...] } }
  var uid = (function () { var u = null; try { u = localStorage.getItem('chat.uid'); } catch (e) { /* 무시 */ } if (!u) { u = 'u' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); try { localStorage.setItem('chat.uid', u); } catch (e) { /* 무시 */ } } return u; })();
  function $(id) { return document.getElementById(id); }
  function mk(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

  function aiPost(body, ms) {
    var url = String(root.DOJJAEBI_AI_URL || '').trim(); if (!url || !root.fetch) return Promise.resolve(null);
    var ctl = root.AbortController ? new AbortController() : null, t = setTimeout(function () { if (ctl) ctl.abort(); }, ms || 6000);
    return fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json(); }).then(function (j) { return j && j.ok ? j : null; }).catch(function () { return null; })
      .then(function (v) { clearTimeout(t); return v; });
  }
  function getPos() {
    return new Promise(function (ok) {
      if (!navigator.geolocation) { ok(null); return; }
      var done = false, t = setTimeout(function () { if (!done) { done = true; ok(null); } }, 5000);
      navigator.geolocation.getCurrentPosition(function (p) { if (done) return; done = true; clearTimeout(t); ok({ lat: p.coords.latitude, lng: p.coords.longitude }); }, function () { if (done) return; done = true; clearTimeout(t); ok(null); }, { enableHighAccuracy: true, timeout: 4500, maximumAge: 60000 });
    });
  }

  /* 다른 여행자의 답 저장소 — 사랑방과 같은 Firebase 프로젝트의 /mtraces/<미션id>. 못 불러오면 그 칸만 "지금은 못 불러와요"로 두고 나머지는 그대로 쓴다 */
  var FB_CFG = { apiKey: 'AIzaSyAvPAAx1HckCiiDG-OVonGPTalLJKhrZMU', authDomain: 'dojjaebi.firebaseapp.com', databaseURL: 'https://dojjaebi-default-rtdb.asia-southeast1.firebasedatabase.app', projectId: 'dojjaebi', appId: '1:968561148026:web:80d087555b2726b11bbbc3' };
  var fbP = null;
  function fb() {
    if (fbP) return fbP;
    var timeout = new Promise(function (ok) { setTimeout(function () { ok(null); }, 6000); });
    var load = Promise.all([import('https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js'), import('https://www.gstatic.com/firebasejs/13.2.0/firebase-database.js')]).then(function (m) {
      var app = m[0].initializeApp(FB_CFG, 'mission'), d = m[1];
      return { db: d.getDatabase(app), ref: d.ref, push: d.push, query: d.query, limitToLast: d.limitToLast, get: d.get, serverTimestamp: d.serverTimestamp };
    }).catch(function () { return null; });
    fbP = Promise.race([load, timeout]); return fbP;
  }
  function loadTraces(m) {
    if (m.kind === 'bingo' || (tr[m.id] && tr[m.id].state === 'loading')) return;
    tr[m.id] = { state: 'loading' };
    fb().then(function (F) {
      if (!F) { tr[m.id] = { state: 'fail' }; return null; }
      return F.get(F.query(F.ref(F.db, 'mtraces/' + m.id), F.limitToLast(60))).then(function (snap) {
        var arr = []; snap.forEach(function (c) { arr.push(c.val()); }); tr[m.id] = { state: 'ok', recs: arr };
      }).catch(function () { tr[m.id] = { state: 'fail' }; });
    }).then(function () { if (el && !el.hidden && view === 'list' && !$('msBody').querySelector('.ms-form')) render(); });
  }
  function shareTrace(m, text) {
    if (m.kind === 'bingo') return Promise.resolve();
    return fb().then(function (F) { if (!F) return; return F.push(F.ref(F.db, 'mtraces/' + m.id), { u: uid, t: text, ts: F.serverTimestamp() }).catch(function () { /* 규칙상 못 쓰면 내 화면에서만 */ }); });
  }

  function build() {
    if (el) return;
    el = mk('div', 'ms'); el.id = 'missionRoom'; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', '도깨비 미션'); el.tabIndex = -1;
    var head = mk('div', 'ms-head'), ht = mk('div', 'ms-ht');
    ht.appendChild(mk('h2', '', '도깨비 미션')); ht.appendChild(mk('p', 'ms-sub', '묵호에서 도깨비가 낸 미션을 해결해 보세요')); head.appendChild(ht);
    var x = mk('button', 'ms-x', '닫기'); x.type = 'button'; x.addEventListener('click', close); head.appendChild(x);
    el.appendChild(head);
    el.appendChild(mk('p', 'ms-note', '위치는 완벽한 방문 증명이 아니에요. 사진은 이 휴대폰에만 있고 서버로 보내지 않아요. 남긴 답은 익명으로 다른 여행자에게 보일 수 있어요(끌 수 있어요).'));
    var body = mk('div', 'ms-body'); body.id = 'msBody'; el.appendChild(body);
    document.body.appendChild(el);
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && el && !el.hidden) close(); });
  }

  function render() {
    view = 'list';
    var body = $('msBody'); body.textContent = '';
    var n = stampList(st).length, bar = mk('div', 'ms-prog');
    bar.appendChild(mk('b', '', '도장 ' + n + ' / ' + MISSIONS.length));
    var pb = mk('span', 'ms-bar'), fill = mk('i'); fill.style.width = Math.round(n / MISSIONS.length * 100) + '%'; pb.appendChild(fill); bar.appendChild(pb);
    body.appendChild(bar);
    PLACES.forEach(function (p) {
      var sec = mk('section', 'ms-place'); sec.appendChild(mk('h3', '', p.name));
      MISSIONS.filter(function (m) { return m.place === p.id; }).forEach(function (m) { sec.appendChild(missionCard(m)); });
      body.appendChild(sec);
    });
    var pc = mk('button', 'ms-card-btn', n ? '도깨비 엽서 받기' : '미션을 하나 해결하면 엽서를 받을 수 있어요'); pc.type = 'button'; pc.disabled = !n;
    pc.addEventListener('click', function () { postcard(); });
    body.appendChild(pc);
  }

  function tracesBox(m) { // 먼저 다녀간 여행자
    var box = mk('div', 'ms-tr'), t = tr[m.id];
    if (m.kind === 'bingo') return null;
    box.appendChild(mk('p', 'ms-tr-h', '먼저 다녀간 여행자'));
    if (!t || t.state === 'loading') { box.appendChild(mk('p', 'ms-state', '불러오는 중이에요…')); return box; }
    if (t.state === 'fail') { box.appendChild(mk('p', 'ms-state', '지금은 다른 여행자의 답을 못 불러와요.')); return box; }
    if (m.kind === 'pick') {
      var tl = tally(m, t.recs, uid);
      if (!tl.total) box.appendChild(mk('p', 'ms-state', '아직 먼저 다녀간 분이 없어요. 첫 번째로 남겨 주셨어요!'));
      else { tl.rows.forEach(function (r) { box.appendChild(mk('p', 'ms-tr-row', '“' + r.label + '” ' + r.n + '명 (먼저 다녀간 ' + tl.total + '명 중)')); }); }
    } else {
      var rt = recentTexts(t.recs, uid, root.ChatFilter, 3);
      if (!rt.length) box.appendChild(mk('p', 'ms-state', '아직 먼저 다녀간 분이 없어요. 첫 번째로 남겨 주셨어요!'));
      else { rt.forEach(function (x) { box.appendChild(mk('p', 'ms-tr-row', '“' + x + '”')); }); box.appendChild(mk('p', 'ms-state', '이용자가 남긴 글이에요. 도째비의 추천이 아니에요.')); }
    }
    return box;
  }

  function missionCard(m) {
    var s = st[m.id], c = mk('article', 'ms-m' + (s ? ' done' : '')), t = mk('h4', '', (s ? '✓ ' : '') + m.title); c.appendChild(t);
    var say = lines[m.id] || { line: m.line, hint: m.hint };
    c.appendChild(mk('p', 'ms-line', '“' + say.line + '”')); c.appendChild(mk('p', 'ms-hint', '요령: ' + say.hint));
    if (s) {
      c.appendChild(mk('p', 'ms-tag ' + s.via, s.via === 'gps' ? '현장 확인' : '직접 확인'));
      c.appendChild(mk('p', 'ms-memo', '내 답: ' + (s.answer || s.note || '')));
      if (s.react) c.appendChild(mk('p', 'ms-react', '도깨비: ' + s.react));
      if (!tr[m.id]) loadTraces(m);
      var tb = tracesBox(m); if (tb) c.appendChild(tb);
      return c;
    }
    if (open === m.id) { c.appendChild(form(m)); return c; }
    var b = mk('button', 'ms-go', '해볼래요'); b.type = 'button';
    b.addEventListener('click', function () { open = m.id; render(); if (!lines[m.id]) askLine(m); });
    c.appendChild(b); return c;
  }

  function askLine(m) { // 도깨비 한마디를 인공지능에게 — 못 받으면 기본 글 그대로
    var p = placeOf(m);
    aiPost({ task: 'mission', place: { id: p.id, name: p.name }, mission: m.title, companions: [], rain: false }, 6000).then(function (j) {
      if (j && j.line && open === m.id) { lines[m.id] = { line: j.line, hint: j.hint || m.hint }; var l = el.querySelector('.ms-form'); if (view === 'list' && !l) render(); }
    });
  }

  function form(m) {
    var f = mk('div', 'ms-form'), value = m.kind === 'bingo' ? [] : '', getVal = function () { return value; };
    f.appendChild(mk('p', 'ms-ask', m.ask));
    var msg = mk('p', 'ms-state', ''); msg.setAttribute('aria-live', 'polite');
    var ok = mk('button', 'ms-go', '도장 찍기'); ok.type = 'button';
    function refresh() { ok.disabled = !validateAnswer(m, getVal(), root.ChatFilter).ok; }
    if (m.kind === 'pick') {
      var grp = mk('div', 'ms-opts'); grp.setAttribute('role', 'group'); grp.setAttribute('aria-label', m.ask);
      m.options.forEach(function (o) { var b = mk('button', 'ms-opt', o); b.type = 'button'; b.setAttribute('aria-pressed', 'false'); b.addEventListener('click', function () { value = o; Array.prototype.forEach.call(grp.children, function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); refresh(); }); grp.appendChild(b); });
      f.appendChild(grp);
    } else if (m.kind === 'bingo') {
      var bg = mk('div', 'ms-opts'); bg.setAttribute('role', 'group'); bg.setAttribute('aria-label', m.ask);
      m.items.forEach(function (o) { var b = mk('button', 'ms-opt', o); b.type = 'button'; b.setAttribute('aria-pressed', 'false'); b.addEventListener('click', function () { var i = value.indexOf(o); if (i >= 0) value.splice(i, 1); else value.push(o); b.setAttribute('aria-pressed', i >= 0 ? 'false' : 'true'); refresh(); }); bg.appendChild(b); });
      f.appendChild(bg);
    } else {
      var inp = mk('input'); inp.type = 'text'; inp.maxLength = m.max || 30; inp.placeholder = m.ph || ''; inp.setAttribute('aria-label', m.ask);
      inp.addEventListener('input', function () { value = inp.value; refresh(); }); f.appendChild(inp);
    }
    var share = null;
    if (m.kind !== 'bingo') { var sl = mk('label', 'ms-share'), sc = document.createElement('input'); sc.type = 'checkbox'; sc.checked = true; sl.appendChild(sc); sl.appendChild(document.createTextNode(' 다른 여행자에게도 익명으로 보이기')); f.appendChild(sl); share = sc; }
    var pl = mk('label', 'ms-photo', '사진 남기기 (선택)'), pi = mk('input'); pi.type = 'file'; pi.accept = 'image/*'; pl.appendChild(pi);
    var thumb = mk('img', 'ms-thumb'); thumb.alt = '고른 사진'; thumb.hidden = true; pl.appendChild(thumb); f.appendChild(pl);
    pi.addEventListener('change', function () {
      var file = pi.files && pi.files[0]; if (!file) return;
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { var w = 600, h = Math.round(img.height * w / img.width), cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(img, 0, 0, w, h); photos[m.id] = cv; thumb.src = cv.toDataURL('image/jpeg', .7); thumb.hidden = false; URL.revokeObjectURL(url); };
      img.src = url;
    });
    ok.disabled = true;
    ok.addEventListener('click', function () {
      var v = validateAnswer(m, getVal(), root.ChatFilter); if (!v.ok) { msg.textContent = v.why; return; }
      ok.disabled = true; msg.textContent = '휴대폰 위치를 확인하는 중이에요…';
      var shareOn = !!(share && share.checked);
      getPos().then(function (pos) {
        st[m.id] = { ts: Date.now(), via: judge(m, pos), answer: v.text, shared: shareOn && m.kind !== 'bingo', react: fallbackReact(m, v.text) };
        saveStamps(st); open = null; delete tr[m.id];
        var p = placeOf(m), done = shareOn ? shareTrace(m, v.text) : Promise.resolve();
        render();
        aiPost({ task: 'react', place: { id: p.id, name: p.name }, mission: m.title, answer: v.text }, 6000).then(function (j) { if (j && j.line) { st[m.id].react = j.line; saveStamps(st); if (el && !el.hidden && view === 'list' && !$('msBody').querySelector('.ms-form')) render(); } });
        done.then(function () { loadTraces(m); });
      });
    });
    var cancel = mk('button', 'ms-cancel', '접기'); cancel.type = 'button'; cancel.addEventListener('click', function () { open = null; render(); });
    f.appendChild(ok); f.appendChild(cancel); f.appendChild(msg); return f;
  }

  function postcard() {
    var list = stampList(st); if (!list.length) return;
    var body = $('msBody'); body.textContent = '';
    var back = mk('button', 'ms-cancel', '← 미션으로'); back.type = 'button'; back.addEventListener('click', function () { if (view === 'card' && history.state && history.state.ms === 2) history.back(); else render(); }); body.appendChild(back);
    view = 'card'; try { history.pushState({ ms: 2 }, ''); } catch (e) { /* 무시 */ }
    var state = mk('p', 'ms-state', '도깨비가 엽서를 쓰는 중이에요…'); state.setAttribute('aria-live', 'polite'); body.appendChild(state);
    var stamps = list.map(function (m) { return { place: placeOf(m).name, mission: m.title, note: st[m.id].answer || st[m.id].note || '' }; });
    var fb0 = fallbackPostcard(list, st);
    aiPost({ task: 'postcard', stamps: stamps, companions: [] }, 9000).then(function (j) {
      var out = j && j.title && j.body ? { title: j.title, body: j.body } : fb0;
      state.textContent = j ? '인공지능(제미나이)이 도장 기록을 보고 쓴 엽서예요' : '도장 기록으로 만든 기본 엽서예요';
      var cv = drawCard(out, list); cv.className = 'ms-canvas'; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', '도깨비 엽서: ' + out.title);
      body.appendChild(cv);
      var save = mk('button', 'ms-go', '그림으로 저장'); save.type = 'button';
      save.addEventListener('click', function () { cv.toBlob(function (b) { if (!b) return; var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = '도째비엽서.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000); }, 'image/png'); });
      body.appendChild(save);
    });
  }

  function drawCard(out, list) {
    var W = 720, H = 960, cv = document.createElement('canvas'); cv.width = W; cv.height = H; var g = cv.getContext('2d');
    var font = "'Pretendard','Noto Sans KR','Malgun Gothic','Apple SD Gothic Neo',sans-serif";
    var bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0b2f52'); bg.addColorStop(1, '#0f4c81'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff'; g.fillRect(36, 36, W - 72, H - 72);
    g.fillStyle = '#0b2f52'; g.font = '800 40px ' + font; g.textBaseline = 'top'; g.fillText(out.title, 64, 70, W - 128);
    var y = 140, ph = null; for (var i = 0; i < list.length; i++) if (photos[list[i].id]) { ph = photos[list[i].id]; break; }
    if (ph) { var iw = W - 128, ih = Math.min(300, Math.round(ph.height * iw / ph.width)); g.drawImage(ph, 0, 0, ph.width, ph.height, 64, y, iw, ih); y += ih + 24; }
    g.fillStyle = '#121826'; g.font = '500 30px ' + font;
    wrapText(function (t) { return g.measureText(t).width; }, out.body, W - 128).forEach(function (ln) { g.fillText(ln, 64, y); y += 44; });
    y += 16; g.font = '700 26px ' + font; g.fillStyle = '#0b2f52'; g.fillText('도장', 64, y); y += 40; g.font = '500 24px ' + font;
    list.forEach(function (m) { if (y > H - 150) return; g.fillStyle = '#475467'; g.fillText((st[m.id].via === 'gps' ? '● ' : '○ ') + placeOf(m).short + ' · ' + m.title, 64, y, W - 128); y += 36; });
    g.fillStyle = '#475467'; g.font = '500 20px ' + font; g.fillText('도째비 길동무 · 동해시 · ' + new Date().toISOString().slice(0, 10) + ' · ●현장 확인 ○직접 확인', 64, H - 90, W - 128);
    return cv;
  }

  /* 뒤로가기(휴대폰 아래 버튼·밀기): 창을 열 때 기록 한 칸을 쌓아 두고, 뒤로가면 앱을 떠나지 않고 이 창만 닫는다. 엽서 화면은 한 칸 더 쌓아 뒤로가면 미션 목록으로 돌아온다. */
  function hide() { if (!el) return; el.hidden = true; view = 'list'; document.documentElement.classList.remove('ms-open'); var t = $('tabMission'); if (t) try { t.focus(); } catch (e) { /* 무시 */ } }
  function openRoom() {
    build(); open = null; render(); el.hidden = false; document.documentElement.classList.add('ms-open');
    try { if (!(history.state && history.state.ms)) history.pushState({ ms: 1 }, ''); } catch (e) { /* 기록을 못 쌓아도 창은 열린다 */ }
    try { el.focus(); } catch (e) { /* 무시 */ }
  }
  function close() { // 닫기 버튼: 쌓아 둔 기록을 걷어내며 닫는다
    if (!el || el.hidden) return;
    if (history.state && history.state.ms) { try { history.go(view === 'card' ? -2 : -1); return; } catch (e) { /* 아래에서 그냥 닫는다 */ } }
    hide();
  }
  window.addEventListener('popstate', function () {
    if (!el || el.hidden) return;
    var ms = history.state && history.state.ms;
    if (ms === 1) { if (view === 'card') render(); } // 엽서 → 목록
    else if (!ms) hide();                           // 목록 → 앱 화면
  });

  var tab = $('tabMission'); if (tab) tab.addEventListener('click', openRoom);
  api.open = openRoom; api.close = close;
})(typeof window !== 'undefined' ? window : globalThis);
