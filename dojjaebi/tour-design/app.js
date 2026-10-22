/* 도째비 길동무 — 화면. 계산은 planner.js, 시연용 인공지능 흉내는 ai.js. */
(function () {
  'use strict';
  var D = window.TOUR_DATA, P = window.TourPlanner, AI = window.TourAI, ED = window.TourEdit, LV = window.TourLive, OV = window.TourOv, TW = window.TourTown, REP = window.TourRep, CR = window.TourCrowd;
  var $ = function (id) { return document.getElementById(id); };
  var fmt = P.fmt;
  var CT = window.CITYTOUR || null; // 동해시티투어버스 자료(citytour.js). 없으면 시티투어 기능만 빠진다
  var CLIENT = Math.random().toString(36).slice(2, 8);
  var K_REP = 'tour.reports.v1', K_LOG = 'tour.log.v1', K_SIM = 'tour.sim.v1', K_PING = 'tour.ping.v1', K_COURSE = 'tour.course.v1', K_DEV = 'tour.dev.v1';
  function todayIso() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  var PLACE = {}; D.places.forEach(function (p) { PLACE[p.id] = p; });
  /* 한국관광공사 「대한민국 명소발굴 100×100」 선정 표시(pick100.js — 확인된 곳만 손으로 적은 목록). 목록에 없으면 표시하지 않는다 */
  var PK = window.TourPick100 || { has: function () { return false; }, label: '', full: '' };
  /* 장소 종류 4가지(2026-10-21 시안): 코스 카드 번호 핀과 지도 번호 핀 색을 같게. 장소 이름으로만 가른다(자료에 없는 사실을 더하지 않음).
     색만으로 구분하지 않도록 카드에는 종류 이름을 글로 함께 적고, 지도 설명 줄에도 적는다. 흰 글씨와 4.5:1 이상 */
  var CAT = { sea: { n: '바다·자연', c: '#1f6feb' }, food: { n: '먹거리·시장', c: '#c2410c' }, see: { n: '볼거리', c: '#237032' }, stay: { n: '쉼·숙박', c: '#5f3dc4' } };
  function catOf(p) {
    var n = (p && p.name) || '';
    if (/시장|장터|오일장|활어회/.test(n)) return 'food';
    if (/해변|해수욕장|항|촛대바위|등대|바다/.test(n)) return 'sea';
    return 'see';
  }
  function pickHtml(p, cls) { return p && PK.has(p.id) ? '<span class="' + (cls || 'tag') + ' pick" title="' + esc(PK.full) + '">' + esc(PK.label) + '</span>' : ''; }
  /* 끼니 시간 슬롯(planner.js): 코스에는 특정 식당을 넣지 않고 점심·저녁 '시간'만 잡는다. 슬롯은 번호 붙은 장이 아니다. */
  function isSlot(s) { return !!(s && s.place && s.place.slot); }
  function placeStops(stops) { return (stops || []).filter(function (s) { return !isSlot(s); }); }
  function slotRange(s) { return hhmm(s.startVisit) + '~' + hhmm(s.leave); }
  function slotName(id) { return P.SLOT_NAME[P.slotKindOf(id)] || '식사'; }
  var NUMS = {}; // 장 id → 화면 번호(끼니 시간은 번호 없음)
  var TYPE_NAME = { crowd: '붐빔', closed: '휴무', view: '좋은 풍경', 'new': '새 볼거리' };
  /* 한국관광공사 사진 — 공공누리 제1·제3유형만 데이터에 들어 있다(사진캐시/ 의 원본 그대로).
     제3유형(변경금지): 자르지 않고(object-fit:contain) 색을 바꾸지 않고, 사진 위에는 글·배지를 얹지 않는다 — 출처 표시는 사진 밖(아래 줄)에.
     제1유형: 칸을 꽉 채워(cover) 보여 줘도 된다. 사진이 안 불러와지면 사진을 지워 그림이 그대로 보인다(아래 load/error 처리). */
  function licNo(p) { return p && p.photo ? (p.photoType === 'Type3' ? 3 : p.photoType === 'Type1' ? 1 : 0) : 0; }
  function creditText(p) { return '사진: 한국관광공사 · 공공누리 제' + licNo(p) + '유형'; }
  function photoImg(p) { return licNo(p) ? '<img class="ph t' + licNo(p) + '" src="' + esc(p.photo) + '" alt="' + esc(p.name) + ' 사진" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-credit="' + esc(creditText(p)) + '">' : ''; }
  /* 피드 게시물의 그림 칸: 그림(+사진) 상자 + 사진 밖 출처 줄 */
  function artFig(p) {
    var n = licNo(p);
    return '<figure class="p-art' + (n ? ' has-photo t' + n : '') + '"><div class="p-box">' + ART.svg(p.id) + photoImg(p) + '<span class="art-tag">그림</span></div>' +
      (n ? '<figcaption class="p-credit" hidden>' + esc(creditText(p)) + '</figcaption>' : '') + '</figure>';
  }
  document.addEventListener('load', function (ev) {
    var t = ev.target; if (!t || !t.classList || !t.classList.contains('ph')) return;
    t.classList.add('ok');
    var box = t.parentNode; if (!box) return;
    box.classList.add('ph-ok');
    var tag = box.querySelector('.art-tag'); if (tag) tag.hidden = true; // 사진 위에는 배지를 두지 않는다
    var fig = box.closest ? box.closest('.p-art') : null, cap = fig && fig.querySelector('.p-credit'); if (cap) cap.hidden = false;
    if (box.id === 'svArt') $('svSrc').textContent = $('svSrc').textContent.replace(/ · 그림.*$/, '') + ' · ' + t.getAttribute('data-credit');
  }, true);
  document.addEventListener('error', function (ev) {
    var t = ev.target; if (!t || !t.classList) return;
    if (t.classList.contains('ph') && t.parentNode) t.parentNode.removeChild(t); // 그림이 그대로 남는다
    else if (t.classList.contains('kto-img')) { // 지도 목록·기록 카드의 작은 사진: 칸째 지우고 출처 줄도 지운다
      var host = t.closest ? t.closest('[data-kto]') : null;
      if (host) { var cr = host.querySelectorAll('.kto-credit'); for (var i = 0; i < cr.length; i++) cr[i].parentNode.removeChild(cr[i]); }
      var th = t.parentNode; if (th && th.getAttribute('data-art')) th.innerHTML = ART.svg(th.getAttribute('data-art')); else if (th && th.parentNode) th.parentNode.removeChild(th);
    }
  }, true);
  /* 작은 사진 칸(지도 목록·기록 카드): 사진은 contain, 없으면 null */
  function smallPhoto(p, cls) { return licNo(p) ? '<span class="' + cls + '" data-art="' + p.id + '"><img class="kto-img" src="' + esc(p.photo) + '" alt="' + esc(p.name) + ' 사진" loading="lazy" decoding="async" referrerpolicy="no-referrer"></span>' : ''; }
  function won(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '원'; }

  /* ---------- 저장(막히면 메모리) ---------- */
  var mem = {};
  function lsGet(k) { try { var v = localStorage.getItem(k); return v === null ? (k in mem ? mem[k] : null) : v; } catch (e) { return k in mem ? mem[k] : null; } }
  function lsSet(k, v) { mem[k] = v; try { localStorage.setItem(k, v); } catch (e) { /* 무시 */ } }
  function lsDel(k) { delete mem[k]; try { localStorage.removeItem(k); } catch (e) { /* 무시 */ } }
  function jget(k, d) { try { var v = lsGet(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function hhmm(m) { return fmt(m); }
  function toTimeValue(m) { m = ((m % 1440) + 1440) % 1440; return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2); }

  /* ---------- 상태 ---------- */
  var S = {
    screen: 'start', mode: 'normal', plan: null, fixed: [], fx: null, changed: {},
    step: 0, nextStep: null, cond: null, tr: null, wx: null, wxRain: false, startNote: null,
    simNow: 13 * 60, presetSim: null, applied: {}, dismissed: {}, raMore: false, fix: null, demoNear: false, notified: {}, mapSeen: false, reports: [], seen: {}, mine: [], liked: {}, storySeen: {}, banner: null, muteAuto: lsGet('tour-mute') !== '0', /* 자동 음성: 처음엔 꺼 둠(10/18 사용자), 🔊 로 켜면 기억 */ pickedType: null, mealKind: 'crowd', found: [], dayTab: 0, stayPick: null, stayAuto: false, openFold: {}
  };
  S.cond = freshCond();
  var savedSim = parseInt(lsGet(K_SIM), 10);
  if (isFinite(savedSim)) S.simNow = savedSim;
  function isSlow() { return S.cond.companions.indexOf('부모님') >= 0 || S.cond.knee; }

  /* ---------- 편의 시설(화장실·관광안내소·숙박·식당): 공공데이터포털 자료, 자동 생성 facilities.js + 계산 fac.js ---------- */
  var FAC = window.FACILITIES || { toilets: [], infos: [], lodging: [], eats: [], source: {} }, FU = window.TourFac;
  S.fac = { wc: null, info: false }; // wc: null = 함께 가는 사람이 부모님·아이면 켜짐, 아니면 꺼짐(누르면 그 값을 따름)
  function wcOn() { return S.fac.wc === null ? (S.cond.companions.indexOf('부모님') >= 0 || S.cond.companions.indexOf('아이') >= 0) : S.fac.wc; }
  /* 게시물 아래 줄: 300m 안에 화장실이 있을 때만, 가장 가까운 곳 하나 */
  function wcLineHtml(p) {
    var hit = FU && p ? FU.nearest(FAC.toilets, p.lat, p.lng, 300) : null;
    return hit ? '<p class="p-wc" data-wc="' + esc(hit.item.id) + '">' + esc(FU.wcLine(hit)) + '</p>' : '';
  }
  /* ---------- 기록(시청 화면용) ---------- */
  function logEvent(kind, extra) {
    var arr = jget(K_LOG, []); var e = { t: Date.now(), k: kind, c: CLIENT };
    if (extra) for (var k in extra) e[k] = extra[k];
    arr.push(e); if (arr.length > 500) arr = arr.slice(-500);
    lsSet(K_LOG, JSON.stringify(arr));
  }

  /* ---------- 소리 ---------- */
  var speaking = null;
  function canSpeak() { return 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'; }
  /* 소리 단추 모양: 그림 단추는 아이콘·이름만 바꾸고, 글 단추는 글자를 바꾼다 */
  function speakUi(btn, on) {
    if (btn.classList.contains('ico')) {
      var lab = btn.getAttribute('data-label') || '이야기 듣기';
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-label', on ? '멈추기' : lab); btn.title = on ? '멈추기' : lab;
      var u = btn.querySelector('use'); if (u) u.setAttribute('href', on ? '#i-stop' : '#i-sound');
    } else {
      if (!btn.getAttribute('data-label')) btn.setAttribute('data-label', btn.textContent);
      btn.textContent = on ? '멈추기' : btn.getAttribute('data-label');
    }
  }
  function flash(msg) {
    var f = $('flash'); f.textContent = msg; f.hidden = false;
    clearTimeout(flash.t); flash.t = setTimeout(function () { f.hidden = true; }, 2600);
  }
  function stopSpeak() {
    try { if (canSpeak()) window.speechSynthesis.cancel(); } catch (e) { /* 무시 */ }
    if (speaking && speaking.btn) speakUi(speaking.btn, false);
    speaking = null;
  }
  function say(text, btn) {
    if (!canSpeak() || !text) return false;
    var same = speaking && btn && speaking.btn === btn;
    stopSpeak();
    if (same) return true;
    try {
      var u = new SpeechSynthesisUtterance(text); u.lang = 'ko-KR'; u.rate = 0.92;
      if (btn) { speaking = { btn: btn }; speakUi(btn, true); u.onend = u.onerror = function () { if (speaking && speaking.btn === btn) { speakUi(btn, false); speaking = null; } }; }
      window.speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }
  function autoSay(text) { if (!S.muteAuto) say(text, null); }

  /* ---------- 화면 전환 ---------- */
  var SCREENS = ['s-start', 's-input', 's-prep', 's-course', 's-map', 's-report', 's-stay', 's-card', 's-watch'];
  var TAB_SCREENS = ['s-course', 's-map', 's-report', 's-stay', 's-card'];
  function show(id) {
    closeStory(true); closeSheet(true); ttClose(true); closeImage(); hideSnack();
    SCREENS.forEach(function (s) { $(s).hidden = (s !== id); });
    S.screen = id;
    stopSpeak();
    var ttl = { 's-start': '여행 준비', 's-input': '여행 준비', 's-prep': '여행 준비', 's-course': '오늘 코스', 's-map': '코스 지도', 's-report': '현장 제보', 's-stay': '동네', 's-card': '기록', 's-watch': '시청 화면' }[id] || '';
    if ($('scrTitle')) $('scrTitle').textContent = ttl;
    if ($('toMapTop')) $('toMapTop').hidden = !(id === 's-course' && S.plan);
    var inTab = !!S.plan && TAB_SCREENS.indexOf(id) >= 0;
    $('tabs').hidden = !inTab;
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      if (t.getAttribute('data-tab') === id) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    var showBanner = S.banner && TAB_SCREENS.indexOf(id) >= 0;
    $('banner').hidden = !showBanner;
    window.scrollTo(0, 0);
    if (id === 's-map') { renderMapList(); renderPoiUi(); setTimeout(function () { if (mapApi && mapApi.resize) mapApi.resize(); drawMap(); }, 60); }
    if (id === 's-start') { loadTrains(); renderStart(); renderWx(); var ns = S.nextStep; S.nextStep = null; setStep(ns != null ? ns : 0, { focus: ns != null }); }
    if (id === 's-stay') renderTownTab();
    if (id === 's-course') ovKakaoEnsure();
    if (id === 's-watch') renderWatch();
    if (id === 's-prep') renderPrep();
  }
  document.addEventListener('click', function (ev) {
    var g = ev.target.closest('[data-go]'); if (g) { show(g.getAttribute('data-go')); }
  });
  $('homeBtn').addEventListener('click', function () { show('s-start'); });
  $('toMapTop').addEventListener('click', function () { $('tabMap').click(); }); // 위 막대 「지도로 보기」 = 아래 메뉴 「지도」와 같음
  /* 아래 메뉴 */
  $('tabHome').addEventListener('click', function () { show(S.plan ? 's-course' : 's-start'); });
  $('tabMap').addEventListener('click', function () { S.mapFocus = null; if (!S.mapSeen) { S.mapSeen = true; S.mapLay = { course: true, eat: false, cafe: false, lodge: false, spot: false }; } show('s-map'); }); // 지도 탭을 처음 열 때는 코스만 (식당·카페·숙소 층은 끈 채)
  $('toStay').addEventListener('click', function () { show('s-stay'); });
  $('toCard').addEventListener('click', function () { renderCard(); show('s-card'); });

  /* ---------- 큰 글씨 ---------- */
  function setBig(on) {
    document.body.classList.toggle('big', on);
    var b = $('bigBtn'); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.setAttribute('aria-label', on ? '글씨 보통으로 줄이기' : '글씨 크게 키우기'); b.title = on ? '글씨 보통으로' : '글씨 크게';
    try { lsSet('tour.big', on ? '1' : '0'); } catch (e) { /* 무시 */ }
    if (mapApi && mapApi.resize) setTimeout(function () { mapApi.resize(); }, 60);
  }
  $('bigBtn').addEventListener('click', function () { setBig(!document.body.classList.contains('big')); });
  setBig(lsGet('tour.big') === '1'); // 기본은 보통 글씨, 가+ 단추로 크게 (2026-10-18)

  /* ---------- 1. 시작: 날씨 + 올 때 / 돌아갈 때 / 누구와 ---------- */
  var HOW_NAME = { train: '기차', bus: '버스', car: '자가용' };
  var COMPS = ['친구', '연인', '혼자', '아이', '부모님'];
  function isoLocal(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  /* 도착 시각 기본값: 다음 정시. 지금이 20시를 넘었으면 내일 10:00 */
  function startDefaults() {
    var d = new Date(), h = d.getHours();
    if (h >= 20) { d.setDate(d.getDate() + 1); return { date: isoLocal(d), arrive: 600 }; }
    return { date: isoLocal(d), arrive: (h + 1) * 60 };
  }
  /* 돌아갈 때 기차 시간표: 가는 날의 실제 시간표(코레일·TAGO, 서버)가 왔으면 그것. 고르게 하지 않고, 고른 시각에 가까운 기차를 작은 줄로만 알려 준다 */
  function realTrains(c) { return S.tr && S.tr.ok && S.tr.date === c.backDate && S.tr.end === c.end ? S.tr : null; }
  function trainTimes(c) { var r = realTrains(c); return r ? r.list.map(function (x) { return x.dep; }) : (D.trains[c.end] || D.trains.mukho); }
  /* 돌아가는 시간 기본값: 18:00 (같은 날이고 도착이 오후 3시를 넘으면 도착 3시간 뒤, 밤 11시까지) */
  function defaultBack(c) {
    if (!c.backDate || c.backDate === c.date) return Math.min(1380, Math.max(18 * 60, c.arrive + 180));
    return 18 * 60;
  }
  function freshCond() {
    var s0 = startDefaults();
    // 2026-10-21: companions 기본값을 ['친구']가 아니라 []로 — "친구"가 미리 눌려 있던 것을 없애고 아무것도 안 고른 채 시작
    var c = { how: 'train', arrive: s0.arrive, arriveTouched: false, back: 18 * 60, backDate: s0.date, backHow: 'train', backTouched: false, backHowTouched: false, backDateTouched: false, backDateExplicit: false, noLimit: false, end: 'mukho', companions: [], knee: false, interests: [], rain: false, food: false, foodWord: '', count: null, stayBooked: null, date: s0.date, branch: null, tripNights: null, must: [] }; // 2026-10-22: arriveTouched — 사용자가 "오는 시각"을 직접 고르기 전엔 시간칸을 미리 고른 것처럼 안 보이게(twSync)
    c.back = defaultBack(c);
    return c;
  }
  /* 오는 날·이동수단이 바뀌면 가는 날·시각·이동수단 기본값을 따라 맞춘다(사용자가 직접 고친 것은 그대로). 가는 날은 오는 날 ~ +2일 안으로.
     tripNights(2026-10-21, 6차안 "동해에 올 예정이에요"): 직접 날짜를 고치지 않았으면 며칠 묵는지(0·1·2)에 맞춰 가는 날을 자동으로 맞춘다 */
  function syncBack(c) {
    if (c.tripNights != null && !c.backDateExplicit) c.backDate = P.addDays(c.date, c.tripNights) || c.date;
    else if (!c.backDateTouched || !c.backDate) c.backDate = c.date;
    if (c.backDate < c.date) c.backDate = c.date;
    var mx = P.addDays(c.date, 2); if (mx && c.backDate > mx) c.backDate = mx;
    if (!c.backHowTouched) c.backHow = c.how;
    if (!c.backTouched) c.back = defaultBack(c);
  }
  function nowMinutes() { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
  /* 두 버튼 시작(2026-10-21 6차안): 지금 동해에 있어요 → 오늘·지금 시각부터. 동해에 올 예정이에요 → 다음 정시(기존 기본값) */
  function startBranch(kind) {
    var c = S.cond;
    c.branch = kind;
    if (kind === 'now') { c.date = todayIso(); c.arrive = nowMinutes(); c.backDateTouched = false; c.backDateExplicit = false; c.tripNights = null; syncBack(c); }
    else { var s0 = startDefaults(); if (!c.date || c.date < todayIso()) { c.date = s0.date; c.arrive = s0.arrive; } syncBack(c); CAL.picking = 'in'; S.calView = calMonthOf(c.date); }
    S.startNote = null;
    loadTrains();
    renderStart();
    setStep(1);
  }
  function nDays(c) { return P.dayCount(c.date, c.backDate); }
  /* 숙박 앱처럼 달력에서 두 번 탭으로 날짜 고르기(2026-10-21): 첫 탭 = 오는 날, 두 번째 탭 = 가는 날(같은 날 또 누르면 당일치기). 오늘~2개월 안, 최대 2박 3일. 장날(3·8일)은 점으로 표시 */
  var CAL = { picking: 'in' };
  function calMonthOf(iso) { var i = P.dateInfo(iso) || P.dateInfo(todayIso()); return { y: i.y, m: i.m }; }
  function calMaxIso() {
    var i = P.dateInfo(todayIso()), y = i.y, m = i.m + 2;
    if (m > 12) { m -= 12; y++; }
    var last = new Date(Date.UTC(y, m, 0)).getUTCDate(), d = Math.min(i.d, last);
    return y + '-' + ('0' + m).slice(-2) + '-' + ('0' + d).slice(-2);
  }
  function calShiftMonth(view, delta) {
    var y = view.y, m = view.m + delta;
    while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; }
    return { y: y, m: m };
  }
  function calClampView(view) {
    var minV = calMonthOf(todayIso()), maxV = calMonthOf(calMaxIso());
    var vk = view.y * 12 + view.m, mnk = minV.y * 12 + minV.m, mxk = maxV.y * 12 + maxV.m;
    if (vk < mnk) return minV; if (vk > mxk) return maxV; return view;
  }
  function calHintText(c) {
    if (!c.date) return '오는 날을 먼저 눌러 주세요.';
    if (!c.backDate || c.backDate === c.date) return P.dateLabel(c.date) + ' 와서 당일에 돌아가요 — 머무는 날을 늘리려면 다른 날짜를 한 번 더 눌러 주세요.';
    return P.dateLabel(c.date) + ' ~ ' + P.dateLabel(c.backDate) + ' (' + P.tripLabel(nDays(c)) + ')';
  }
  function calTap(iso) {
    var todayI = todayIso(), maxI = calMaxIso(); if (iso < todayI || iso > maxI) return;
    var c = S.cond;
    if (CAL.picking === 'in' || !c.date) {
      c.date = iso; c.backDate = iso; c.backDateTouched = true; c.backDateExplicit = true; c.tripNights = null;
      CAL.picking = 'out';
    } else if (iso === c.date) { c.backDate = c.date; CAL.picking = 'out'; } // 2026-10-21: 당일치기로 확정된 뒤 picking 을 'in'으로 되돌리면, 안내 글("다른 날짜를 한 번 더 눌러 늘리기")과 달리 다음 탭이 늘리기가 아니라 처음부터 다시 고르는 걸로 되던 버그 — 'out'을 유지해 다음 탭이 그대로 늘리기(또는 앞날이면 오는 날 옮기기)가 되게 함
    else if (iso < c.date) { c.date = iso; c.backDate = iso; }
    else {
      var mx = P.addDays(c.date, 2);
      c.backDate = iso > mx ? mx : iso; c.backDateTouched = true; c.backDateExplicit = true; c.tripNights = null;
      CAL.picking = 'in';
    }
    syncBack(c);
    S.calView = calMonthOf(c.date);
  }
  function renderCal() {
    var box = $('calBox'); if (!box) return;
    var c = S.cond;
    if (!S.calView) S.calView = calMonthOf(c.date || todayIso());
    S.calView = calClampView(S.calView);
    var y = S.calView.y, m = S.calView.m;
    var startDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(), daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    var todayI = todayIso(), maxI = calMaxIso(), minV = calMonthOf(todayI), maxV = calMonthOf(maxI);
    var atMin = (y === minV.y && m === minV.m), atMax = (y === maxV.y && m === maxV.m);
    var cells = '';
    for (var i = 0; i < startDow; i++) cells += '<span class="cal-cell cal-pad" aria-hidden="true"></span>';
    for (var d = 1; d <= daysInMonth; d++) {
      var iso = y + '-' + ('0' + m).slice(-2) + '-' + ('0' + d).slice(-2);
      var dis = iso < todayI || iso > maxI;
      var inSel = c.date && iso === c.date, outSel = c.backDate && iso === c.backDate && c.backDate !== c.date;
      var inRange = c.date && c.backDate && iso > c.date && iso < c.backDate;
      var mk = P.lastDigitDay(iso, marketDigits());
      var cls = 'cal-cell' + (inSel ? ' cal-in' : '') + (outSel ? ' cal-out' : '') + (inRange ? ' cal-mid' : '') + (dis ? ' cal-dis' : '');
      cells += '<button type="button" class="' + cls + '" data-cal="' + iso + '"' + (dis ? ' disabled aria-disabled="true"' : '') + ' aria-pressed="' + !!(inSel || outSel) + '">' + d + (mk ? '<i class="cal-dot" aria-hidden="true"></i><span class="visually-hidden"> 장날</span>' : '') + '</button>';
    }
    box.innerHTML = '<div class="cal-hd"><button type="button" class="cal-nav" id="calPrev" data-calnav="-1" aria-label="이전 달"' + (atMin ? ' disabled' : '') + '>‹</button><b>' + y + '년 ' + m + '월</b><button type="button" class="cal-nav" id="calNext" data-calnav="1" aria-label="다음 달"' + (atMax ? ' disabled' : '') + '>›</button></div>' +
      '<div class="cal-dow">' + ['일', '월', '화', '수', '목', '금', '토'].map(function (w) { return '<span>' + w + '</span>'; }).join('') + '</div>' +
      '<div class="cal-grid">' + cells + '</div>' +
      '<p class="cal-hint" id="calHint">' + esc(calHintText(c)) + '</p>';
  }
  function compOf(c) { return c.companions[0] || ''; }
  function setComp(c, name) { c.companions = name ? [name] : []; }
  /* 누구와: 여러 명 함께 고를 수 있음(아이+부모님 등). 「혼자」는 다른 것과 같이 못 고름(서로 배타) */
  function toggleComp(c, name) {
    var arr = c.companions || (c.companions = []);
    if (name === '혼자') { c.companions = arr.indexOf('혼자') >= 0 ? [] : ['혼자']; return; }
    var i = arr.indexOf(name);
    if (i >= 0) arr.splice(i, 1);
    else { var j = arr.indexOf('혼자'); if (j >= 0) arr.splice(j, 1); arr.push(name); }
  }
  function compNames(c) { return (c.companions || []).join(', '); }
  /* 날짜 밑 작은 배지: 장날 · 시티투어 운행 · 쉬는 곳 (긴 안내 글 대신) */
  function bdg(txt, cls) { return '<span class="bdg' + (cls ? ' ' + cls : '') + '">' + esc(txt) + '</span>'; }
  function dateBadges(date, withNext) {
    var info = P.dateInfo(date); if (!info) return '';
    var out = [], mk = marketPlace();
    if (mk) {
      if (P.lastDigitDay(date, marketDigits())) out.push(bdg(mk.short + ' 장날', 'on'));
      else if (withNext) { var nx = P.nextMarketDay(date, marketDigits()); if (nx) out.push(bdg('다음 장날 ' + P.dateInfo(nx).m + '/' + P.dateInfo(nx).d)); }
    }
    if (CT) {
      var d = P.tourDay(CT, date);
      if (d.ok) out.push(bdg('시티투어 운행' + (d.unconfirmed ? ' (공휴일 확인필요)' : ''), 'on'));
      else { var nt = P.tourNextDay(CT, date); out.push(bdg(d.why === '평일' && nt ? '시티투어 평일 미운행(다음 ' + P.dateInfo(nt).m + '/' + P.dateInfo(nt).d + ')' : '시티투어 운행 안 해요')); }
    }
    var shut = D.places.filter(function (p) { return p.closedDow && p.closedDow.indexOf(info.dow) >= 0; }).map(function (p) { return p.short; });
    if (shut.length) out.push(bdg(shut.join('·') + ' 쉬는 날'));
    return out.join('');
  }
  /* 돌아갈 때 기차: 고른 시각 이후 가장 가까운 기차 한 줄(못 받으면 아무것도 안 보임). 누르면 그 시각으로 */
  function nearestHelp(c) { // 한 줄: "묵호역 15분 전까지 · 이 시간 가까운 기차 19:11 KTX-이음 · 코레일 시간표"
    var st = D.stations[c.end].name, pre = esc(st) + '에는 출발 15분 전까지 와 있으면 돼요';
    var rt = c.backHow === 'train' ? realTrains(c) : null; if (!rt) return '<p class="help">' + pre + '</p>';
    var hit = P.nearestDeparture(rt.list, c.back); if (!hit) return '<p class="help">' + pre + ' · 이 시간 뒤에는 기차가 없어요 · 코레일 시간표</p>';
    var it = hit.item;
    return '<p class="help">' + pre + ' · 이 시간 가까운 기차 <button type="button" class="linkbtn" data-hset="' + esc(hit.dep) + '">' + esc(hit.dep) + (it.grade ? ' ' + esc(it.grade) : '') + '</button> · 코레일 시간표' + (rt.snap ? ' · ' + esc(rt.snap) + ' 기준' : '') + '</p>';
  }
  function renderStart() {
    var c = S.cond;
    // 2026-10-21: 날씨로 자동 켠 "비 와요"(S.wxRain)는 "지금" 날씨라, 날짜를 앞날로 바꾸면 더는 맞지 않음 — 그 날로 바뀌면 자동으로 끔(사용자가 손으로 켠 건 그대로 둠)
    if (S.wxRain && c.date !== todayIso()) { c.rain = false; S.wxRain = false; }
    /* 두 버튼 시작(6차안): branch==='now' 는 날짜·시각을 숨기고(오늘·지금), branch==='later' 는 며칠 묵는지 칩을 보인다 */
    if ($('dtArrive')) $('dtArrive').hidden = c.branch === 'now';
    if ($('nowArriveNote')) $('nowArriveNote').hidden = c.branch !== 'now';
    if ($('calBox')) { $('calBox').hidden = c.branch === 'now'; if (c.branch !== 'now') renderCal(); }
    if ($('calBackTimeWrap')) $('calBackTimeWrap').hidden = c.branch === 'now'; // 2026-10-22: 달력과 같이 보이고 같이 숨음(지금 branch 는 날짜 자체를 안 물으니 떠날 시각도 여기선 안 물음, 2단계에서 물음)
    if ($('nowBackTimeWrap')) $('nowBackTimeWrap').hidden = c.branch !== 'now'; // 2026-10-22: "지금" 흐름의 떠날 시각 직접 입력(빨리 고르기 칩은 뺌 — 이 칸과 하는 일이 겹침)
    if ($('nowTicketWrap')) $('nowTicketWrap').hidden = c.branch !== 'now'; // 2026-10-22: "지금" 흐름의 승차권 사진 단추
    if ($('howSeg')) $('howSeg').hidden = c.branch === 'now'; // 지금 branch 는 "올 때 이동수단"(기차·버스·자가용) 대신 "동해에서 이용할 교통수단"을 물음
    if ($('howSegNow')) $('howSegNow').hidden = c.branch !== 'now';
    if ($('hs1')) $('hs1').textContent = c.branch === 'now' ? '어서 오세요!' : '언제 와요?'; // 2026-10-22: "지금 동해에 있어요"로 들어오면 이미 도착한 건데 "언제 와요?"라고 묻던 것을 고침
    $('sDate').value = c.date || todayIso(); $('sDate').min = todayIso(); $('sTime').value = toTimeValue(c.arrive);
    var dmsg = $('dateMsg'); if (dmsg && !dmsg.hidden && !pastDate(c)) { dmsg.hidden = true; dmsg.textContent = ''; }
    $('bDate').value = c.backDate; $('bDate').min = c.date; $('bDate').max = P.addDays(c.date, 2) || '';
    $('bTime').value = toTimeValue(c.back); $('bTime').disabled = c.backHow === 'car' && c.noLimit;
    if ($('calBTimeLb')) $('calBTimeLb').textContent = (c.backHow === 'car' ? '언제까지 머무세요? (대략)' : '떠날 시각(대략)');
    if ($('nowBTimeLb')) $('nowBTimeLb').textContent = (c.backHow === 'car' ? '언제까지 머무세요? (대략)' : '떠날 시각(대략)');
    twSync('sTime'); twSync('bTime');
    $('inBadges').innerHTML = dateBadges(c.date, true);
    renderCrowdLine(c);
    var n = nDays(c);
    $('outBadges').innerHTML = '<span class="bdg trip' + (n > 1 ? ' on' : '') + '">' + P.tripLabel(n) + '</span>' + (c.backDate !== c.date ? dateBadges(c.backDate, false) : '');
    Array.prototype.forEach.call(document.querySelectorAll('[data-how]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-how') === c.how ? 'true' : 'false'); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-bhow]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-bhow') === c.backHow ? 'true' : 'false'); });
    // 사용자 관점 단순화: 자가용으로 왔으면 돌아갈 때도 자가용만(기차·버스 숨김) · 대중교통으로 왔으면 자가용은 숨김(기차·버스만)
    Array.prototype.forEach.call(document.querySelectorAll('#bhowSeg [data-bhow]'), function (b) { b.hidden = c.how === 'car' ? b.getAttribute('data-bhow') !== 'car' : b.getAttribute('data-bhow') === 'car'; });
    $('bhowSeg').hidden = c.how === 'car'; // 하나만 남으면(자가용) 고를 게 없으니 묶음째 숨기고 글로만 알림
    var bhowNote = $('bhowNote'); if (bhowNote) { bhowNote.hidden = c.how !== 'car'; bhowNote.textContent = c.how === 'car' ? '자가용으로 다니니 돌아갈 때도 자가용이에요.' : ''; }
    var eff = c.backHow === 'car' && c.noLimit ? 22 * 60 : c.back, body = ''; // 2026-10-21: 저녁 8시 상한은 너무 일러 야경 코스를 아예 못 넣었음 — 밤 10시로 늦춤
    if (c.backHow === 'train') {
      body = '<div class="seg" role="group" aria-label="기차 타는 역"><button type="button" class="chip" data-end="mukho" aria-pressed="' + (c.end === 'mukho') + '">묵호역</button><button type="button" class="chip" data-end="donghae" aria-pressed="' + (c.end === 'donghae') + '">동해역</button></div>' + nearestHelp(c);
    } else if (c.backHow === 'bus') {
      body = '<p class="note">' + esc(D.stations.bus.name) + '에는 버스 출발 15분 전까지 와 있으면 돼요. 버스 시간표는 아직 연결하지 않아서 시간을 직접 적어 주세요.</p>';
    } else {
      body = '<div class="quick"><button type="button" class="chip" data-nolimit="1" aria-pressed="' + (c.noLimit ? 'true' : 'false') + '">정하지 않았어요 (밤 10시까지)</button></div>' +
        '<p class="note">' + esc(D.stations.park.name) + '에 그 시각까지 오시면 돼요.' + (c.how === 'car' ? ' 걸어서 10분 안은 걷고, 먼 곳은 차로 가요(주차 5분 포함).' : '') + '</p>';
    }
    if ((c.how === 'car') !== (c.backHow === 'car')) body += '<p class="note warnline">차는 한쪽만 쓰는 여행이라 주차 위치를 한 번 확인해 주세요. 이동은 걷기·버스·택시로 짜요.</p>';
    if (c.backDate === c.date && (eff - c.arrive) < 90 && eff >= c.arrive) body += '<p class="note warnline">머물 수 있는 시간이 90분이 안 돼요. 조금 더 늦은 시각을 고르면 더 많이 볼 수 있어요.</p>';
    if (c.backDate === c.date && eff < c.arrive) body += '<p class="note warnline">도착 시각보다 앞이에요. 날짜나 시각을 다시 골라 주세요.</p>';
    $('outBody').innerHTML = body;
    $('inNote').textContent = c.how === 'train' ? '' :c.how === 'bus' ? D.stations.bus.name + '에서 시작해요.' : D.stations.park.name + '에서 시작해요.';
    $('chipComp').innerHTML = COMPS.map(function (nm) { return chip(nm, (c.companions || []).indexOf(nm) >= 0, 'data-comp="' + nm + '"'); }).join('');
    $('chipMore').innerHTML = chip('점심·저녁 시간 넣기', c.food, 'data-food="1"') + chip('사진·노을', c.interests.indexOf('사진') >= 0, 'data-like="사진"') + chip('먹거리 구경', c.interests.indexOf('먹거리') >= 0, 'data-like="먹거리"') + chip('무릎·계단이 힘들어요', c.knee, 'data-knee="1"') + chip('날씨가 안 좋아요' + (S.wxRain ? ' (기상청)' : ''), c.rain, 'data-rain="1"');
    if (c.rain || c.food || c.knee || c.interests.length) $('moreBox').open = true;
    var sn = $('startNote'); sn.hidden = !S.startNote; sn.textContent = S.startNote || '';
    var sm = $('stepMsg'); if (sm && !sm.hidden && !backEarly(c)) sm.hidden = true;
  }
  /* 기차 시간표: 서버(/api/trains)에서 받는다 — 돌아갈 때가 기차일 때, 가는 날·역이 바뀔 때마다. 못 받으면 묶음에 넣어 둔 사진(TRAIN_SNAPSHOT), 그것도 없으면 아무것도 안 보임 */
  function loadTrains() {
    var c = S.cond; if (c.backHow !== 'train') return;
    var date = c.backDate, end = c.end, key = date + '|' + end;
    if (S.tr && S.tr.key === key && !S.tr.fail) return;
    S.tr = { key: key, date: date, end: end, pending: true };
    var to = end === 'donghae' ? '서울' : '청량리', from = end === 'donghae' ? '동해' : '묵호';
    function done(r) {
      if (S.tr.key !== key) return; // 그 사이 다른 날짜로 바뀜
      S.tr = r; r.key = key; r.date = date; r.end = end;
      if (!$('s-start').hidden) renderStart();
      refreshLeadSrc();
    }
    function snap() {
      var sn = window.TRAIN_SNAPSHOT, d = sn && sn.dates && sn.dates[date], l = d && d[end];
      if (l && l.length) return { ok: true, list: l, to: to, snap: sn.builtAt || '' };
      return null;
    }
    var t0 = todayIso(); // 서버는 오늘-1 ~ 오늘+30 일만 받는다 — 밖이면 물어보지 않고 묶음 시간표/예시로
    if (location.protocol.indexOf('http') !== 0 || date < P.addDays(t0, -1) || date > P.addDays(t0, 30)) { done(snap() || { fail: true }); return; }
    fetch('/api/trains?date=' + date.replace(/-/g, '') + '&from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) { done(j && j.ok && j.list && j.list.length ? { ok: true, list: j.list, to: to } : (snap() || { fail: true })); })
      .catch(function () { done(snap() || { fail: true }); });
  }
  /* 코레일 시간표가 늦게 도착하면, 코스 화면에 떠 있는 머리글의 "(예시 시간표)/(직접 고른 시간)/(코레일 시간표)" 만 바로 고친다(다시 그리지 않음) */
  function refreshLeadSrc() {
    var el = $('courseLead'), cs = $('s-course'); if (!el || !cs || cs.hidden || !S.plan) return;
    var nt = backSrc(); el.textContent = el.textContent.replace(/ ((예시 시간표|직접 고른 시간|코레일 시간표))/, nt);
  }
  function backEdited(v) { S.cond.back = v; S.cond.backTouched = true; }
  $('s-start').addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    var c = S.cond;
    if (b.hasAttribute('data-how')) {
      c.how = b.getAttribute('data-how');
      // 사용자 관점 단순화(2026-10-21): 자가용을 골랐으면 기차·버스로 돌아갈 수는 없고, 대중교통을 골랐으면 자가용으로 돌아갈 수 없다 — 돌아갈 때 칸도 바로 맞춰 둠(안 맞는 조합은 2단계에서 애초에 안 보이게 함)
      if (c.how === 'car') { c.backHow = 'car'; c.backHowTouched = false; }
      else if (c.backHow === 'car') { c.backHow = c.how; c.backHowTouched = false; }
      syncBack(c);
    }
    else if (b.hasAttribute('data-bhow')) { c.backHow = b.getAttribute('data-bhow'); c.backHowTouched = true; }
    else if (b.hasAttribute('data-end')) { c.end = b.getAttribute('data-end'); }
    else if (b.hasAttribute('data-hset')) { backEdited(P.toMin(b.getAttribute('data-hset'))); }
    else if (b.hasAttribute('data-cdate')) { c.date = b.getAttribute('data-cdate'); c.backDate = c.date; c.backDateTouched = true; c.backDateExplicit = true; CAL.picking = 'out'; syncBack(c); } // 더 한산한 날로 바꾸기
    else if (b.hasAttribute('data-cal')) { calTap(b.getAttribute('data-cal')); }
    else if (b.hasAttribute('data-calnav')) { S.calView = calShiftMonth(S.calView || calMonthOf(c.date || todayIso()), +b.getAttribute('data-calnav')); }
    else if (b.hasAttribute('data-nolimit')) { c.noLimit = !c.noLimit; }
    else if (b.hasAttribute('data-comp')) { toggleComp(c, b.getAttribute('data-comp')); }
    else if (b.hasAttribute('data-knee')) { c.knee = !c.knee; }
    else if (b.hasAttribute('data-rain')) { c.rain = !c.rain; if (!c.rain) S.wxRain = false; }
    else if (b.hasAttribute('data-food')) { c.food = !c.food; }
    else if (b.hasAttribute('data-like')) { var l = b.getAttribute('data-like'), j = c.interests.indexOf(l); if (j >= 0) c.interests.splice(j, 1); else c.interests.push(l); }
    else return;
    S.startNote = null;
    loadTrains();
    renderStart();
  });
  $('s-start').addEventListener('change', function (ev) {
    var t = ev.target, c = S.cond;
    if (t.id === 'sDate') { c.date = t.value || todayIso(); syncBack(c); }
    else if (t.id === 'sTime') { if (t.value) { c.arrive = P.toMin(t.value); c.arriveTouched = true; syncBack(c); } }
    else if (t.id === 'bDate') { c.backDate = t.value || c.date; c.backDateTouched = c.backDate !== c.date; c.backDateExplicit = true; c.tripNights = null; syncBack(c); }
    else if (t.id === 'bTime') { if (t.value) backEdited(P.toMin(t.value)); }
    else return;
    loadTrains();
    renderStart();
  });
  /* ---------- 시각 입력 (2026-10-18): [오전|오후] + 시 + 분 을 직접 적는다. type=time 칸(#sTime·#bTime)은 눈에 안 보이게 남겨 두고 값의 기준으로 쓴다(양쪽으로 맞춤) ---------- */
  /*TW-BEGIN*/
  function twToMin(pm, h12, m) { return ((h12 % 12) + (pm ? 12 : 0)) * 60 + m; }
  function twFromMin(min) { min = ((min % 1440) + 1440) % 1440; var h = Math.floor(min / 60); return { pm: h >= 12, h12: h % 12 === 0 ? 12 : h % 12, m: min % 60 }; }
  // 2026-10-22(사용자 요청): "13 16시도 입력 가능하게" — disp 는 사용자가 실제로 적은(또는 그 시각이 가리키는) 24시간 숫자를 그대로 들고 있어서,
  // 13~23 을 적으면 화면에도 13~23 그대로 보인다(예전엔 오후로 바꾸며 1~12 로 줄여 보여서 "방금 적은 숫자가 멋대로 바뀐다"고 느껴졌음).
  function twHour(txt) { var n = parseInt(txt, 10); if (!isFinite(n)) return null; if (n === 0 || n > 23) return { h12: 12, pm: null, disp: 12 }; if (n > 12) return { h12: n - 12, pm: true, disp: n }; return { h12: n, pm: null, disp: n }; } // 13~23 은 24시간으로 읽어 오후로, 0·24 이상은 12
  function twDisp(h12, pm) { return pm && h12 !== 12 ? h12 + 12 : h12; } // 오후면 13~23 로, 정오(12시)는 그대로 — 다시 보여 줄 때도 같은 모습이어야 "임의로 바뀐다"고 안 느낌
  function twMinute(txt) { var n = parseInt(txt, 10); if (!isFinite(n)) return null; return Math.max(0, Math.min(59, n)); }
  function twAdvance(txt) { var t = String(txt || ''); return t.length >= 2 || (t.length === 1 && +t >= 3); } // 두 자리를 적었거나 3~9 한 자리면 분 칸으로
  /*TW-END*/
  var TWS = {}; // srcId -> [widget, ...] (2026-10-22: 같은 hidden input 을 공유하는 위젯이 둘 이상일 수 있음 — 1단계 달력 밑 "떠날 시각(대략)" 과 2단계 "출발 시각"이 같은 #bTime 값을 같이 씀)
  // 2026-10-22(사용자 요청): "니가 선택 미리 해놓으니까 (헷갈려요), 먼저 선택하지 말자" — 아직 사용자가 직접 안 고른 시각은
  // 미리 고른 것처럼 숫자·오전/오후가 채워져 보이지 않게(빈 칸 + 둘 다 안 눌린 상태)로 시작. 속값(S.cond.arrive/back)은 그대로 둬서
  // 계산은 평소처럼 되고, 눈에만 "아직 안 골랐다"고 보이게 함.
  var TW_TOUCHED_KEY = { sTime: 'arriveTouched', bTime: 'backTouched' };
  function twInit(wid, srcId) {
    var w = $(wid), src = $(srcId); if (!w || !src) return;
    var st = { w: w, src: src, h: w.querySelector('.tmw-h'), m: w.querySelector('.tmw-m'), btns: w.querySelectorAll('.tmw-b'), pm: false };
    (TWS[srcId] = TWS[srcId] || []).push(st);
    st.setPm = function (pm) { st.pm = pm; Array.prototype.forEach.call(st.btns, function (b) { b.setAttribute('aria-checked', (b.getAttribute('data-ap') === 'pm') === pm ? 'true' : 'false'); }); };
    // 2026-10-22(버그 고침): 아직 커밋 안 된(한창 입력 중인) 상태에서도 twSync 가 다시 불릴 수 있는데(오전/오후 먼저 누르거나, 시만 적고 포커스를 옮기는 등),
    // 그때 Touched 가 아직 false 면 twSync 가 "안 고른 것"으로 보고 방금 입력한 걸 빈 칸으로 되돌려 버려 — 오전/오후가 안 눌리고 시각도 안 적히는 것처럼 보이던 원인.
    // 그래서 이 위젯을 처음 만지는 순간(포커스·버튼 누름) 바로 Touched 를 켜서, 그 뒤로는 twSync 가 실제 값을 보여 주게 함.
    function markTouched() { var tk = TW_TOUCHED_KEY[srcId]; if (tk) S.cond[tk] = true; }
    // 2026-10-22(버그 고침): "오후로 가서 21시 되면 오전으로 안 바뀌고" — 13~23 처럼 적은 숫자는 오후가 확실해서,
    // commit() 이 늘 그 뜻대로 오전/오후 단추를 되돌려 놨음 — 그래서 21시인 채로 오전 단추를 눌러도 소용없었음(눌러도 바로 오후로 되돌아감).
    // 오전/오후 단추를 "직접 누른" 경우(pmOverride)는 그 누른 값이 맞다고 보고, 적힌 숫자가 뭐였든 그 뜻(예: 21→9)으로 바꿔 보여 줌.
    function commit(force, pmOverride) {
      var h = twHour(st.h.value), m = twMinute(st.m.value);
      if (!h || m === null) return false;
      if (!force && st.m.value.length < 2) return false;
      var pm;
      if (pmOverride !== undefined) { pm = pmOverride; st.setPm(pm); }
      else { if (h.pm !== null) st.setPm(h.pm); pm = st.pm; } // 1~12 처럼 애매하면 오전/오후 버튼이 정한 값을 따름
      st.h.value = String(twDisp(h.h12, pm)); st.m.value = ('0' + m).slice(-2);
      var v = toTimeValue(twToMin(pm, h.h12, m));
      if (src.value !== v) { src.value = v; src.dispatchEvent(new Event('change', { bubbles: true })); }
      return true;
    }
    function digits(el) { var v = el.value.replace(/[^0-9]/g, '').slice(0, 2); if (v !== el.value) el.value = v; return v; }
    st.h.addEventListener('input', function () {
      var v = digits(st.h);
      if (twAdvance(v)) { var h = twHour(v); if (h) { st.h.value = String(h.disp); if (h.pm !== null) st.setPm(h.pm); } st.m.focus(); try { st.m.select(); } catch (e) { /* 무시 */ } if (st.m.value.length === 2) commit(false); }
    });
    st.m.addEventListener('input', function () { var v = digits(st.m); if (v.length === 2) { if (+v > 59) st.m.value = '59'; commit(false); } });
    [st.h, st.m].forEach(function (el) {
      el.addEventListener('focus', function () { markTouched(); try { el.select(); } catch (e) { /* 무시 */ } });
      el.addEventListener('blur', function () { if (!commit(true)) twSync(srcId); });
    });
    st.m.addEventListener('keydown', function (ev) { if (ev.key === 'Backspace' && !st.m.value) { ev.preventDefault(); st.h.focus(); } });
    Array.prototype.forEach.call(st.btns, function (b) { b.addEventListener('click', function () { if (b.disabled) return; markTouched(); var pm = b.getAttribute('data-ap') === 'pm'; if (st.h.value && st.m.value) commit(true, pm); else { st.setPm(pm); twSync(srcId); } }); });
    twSync(srcId);
  }
  function twSync(srcId) { // 눈에 안 보이는 type=time 값 → 보이는 칸(같은 값을 쓰는 위젯이 여럿이면 전부)
    var list = TWS[srcId]; if (!list) return;
    var tk = TW_TOUCHED_KEY[srcId], touched = tk ? !!S.cond[tk] : true;
    list.forEach(function (st) {
      var v = st.src.value;
      if (/^\d\d:\d\d$/.test(v)) {
        var p = twFromMin(P.toMin(v)); st.setPm(p.pm);
        if (!touched) Array.prototype.forEach.call(st.btns, function (b) { b.setAttribute('aria-checked', 'false'); }); // 속으로는 그 값을 들고 있되(그래야 시만 적어도 알맞은 오전/오후로 떨어짐), 버튼은 안 눌린 것처럼
        if (document.activeElement !== st.h) st.h.value = touched ? String(twDisp(p.h12, p.pm)) : '';
        if (document.activeElement !== st.m) st.m.value = touched ? ('0' + p.m).slice(-2) : '';
      } else { if (document.activeElement !== st.h) st.h.value = ''; if (document.activeElement !== st.m) st.m.value = ''; }
      var dis = !!st.src.disabled; st.h.disabled = dis; st.m.disabled = dis;
      Array.prototype.forEach.call(st.btns, function (b) { b.disabled = dis; });
    });
  }
  twInit('twS', 'sTime'); twInit('twB', 'bTime'); twInit('twCalB', 'bTime'); twInit('twNowB', 'bTime'); /* 2026-10-22: 1단계 달력 밑 "떠날 시각(대략)" · 2단계 "지금" 흐름의 떠날 시각 — 모두 같은 #bTime 값을 공유 */

  /* ---------- 시작 화면 단계 (S.step: 0 인사 · 1 올 때 · 2 돌아갈 때 · 3 누구와) — 한 화면에 한 가지씩 ---------- */
  function backEarly(c) { var eff = c.backHow === 'car' && c.noLimit ? 22 * 60 : c.back; return c.backDate === c.date && eff < c.arrive; }
  function setHdr() { var t = $('top'); if (t) document.documentElement.style.setProperty('--hdr', t.offsetHeight + 'px'); }
  function setStep(n, opt) {
    opt = opt || {};
    S.step = n;
    $('s-start').setAttribute('data-step', String(n));
    for (var i = 0; i <= 6; i++) $('st' + i).hidden = (i !== n);
    var m = $('stepMsg'); if (m) { m.hidden = true; m.textContent = ''; }
    if (n === 4) renderMustList();
    if (n === 5) renderStayUi();
    if (n === 6) renderConfirm();
    setHdr();
    var pane = $('st' + n);
    pane.classList.remove('enter'); void pane.offsetWidth; pane.classList.add('enter'); // 살짝 밀려 들어옴 (움직임 줄이기 설정이면 CSS 에서 끔)
    window.scrollTo(0, 0);
    if (opt.focus !== false) { var h = n === 0 ? $('h-start') : $('hs' + n); if (h) h.focus({ preventScroll: true }); }
  }
  function pastDate(c) { return !!c.date && c.date < todayIso(); }
  function pastBlock() { // 지난 날짜로는 못 간다 — 1단계에서 알려 준다
    if (!pastDate(S.cond)) return false;
    var m = $('dateMsg'); m.textContent = '지난 날짜는 고를 수 없어요. 오늘이나 앞으로의 날짜를 골라 주세요.'; m.hidden = false;
    if (S.step !== 1) setStep(1, { focus: false });
    if (m.scrollIntoView) m.scrollIntoView({ block: 'center' });
    return true;
  }
  function stepBlock() { // 돌아갈 시각이 오는 시각보다 빠르면 3단계로 못 간다
    var c = S.cond;
    if (pastBlock()) return true;
    if (!backEarly(c)) return false;
    var m = $('stepMsg'); m.textContent = '시각을 한 번만 다시 골라 주세요. 도착 시각보다 뒤여야 코스를 짤 수 있어요.'; m.hidden = false; if (m.scrollIntoView) m.scrollIntoView({ block: 'center' });
    return true;
  }
  $('goNow').addEventListener('click', function () { startBranch('now'); });
  $('goLater').addEventListener('click', function () { startBranch('later'); });
  $('stNext1').addEventListener('click', function () { if (pastBlock()) return; setStep(2); });
  $('stNext2').addEventListener('click', function () { if (stepBlock()) { $('bTime').focus(); return; } setStep(3); });
  $('stNext3').addEventListener('click', function () { setStep(4); });
  $('stNext4').addEventListener('click', function () { setStep(5); });
  $('stNext5').addEventListener('click', function () { setStep(6); });
  [1, 2, 3, 4, 5, 6].forEach(function (n) { $('stBack' + n).addEventListener('click', function () { setStep(n - 1); }); });
  /* ---------- 5단계: 숙소 예약 여부 + 인원수 (2026-10-21, 사용자 요청: "누구랑 와서 어디서 잘지도 추천해 주기 편하지 않니") ---------- */
  function stayUi() { Array.prototype.forEach.call(document.querySelectorAll('#chipStay [data-stay]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-stay') === S.cond.stayBooked ? 'true' : 'false'); }); $('stayNote').hidden = S.cond.stayBooked !== 'none'; /* 2026-10-22(Fable 리뷰): 이 글은 "숙소 자리를 추천해 드려요" 라는 내용 — 아직 안 잡았을 때(none)만 맞는 말이라 조건이 거꾸로였음 */ }
  function renderStayUi() {
    stayUi();
    $('countN').textContent = (S.cond.count || 1) + '명';
    var multi = isMulti();
    if ($('stayQBlock')) $('stayQBlock').hidden = !multi; // 2026-10-22: 당일치기는 묵을 숙소가 없으니 이 질문을 안 보임
    if (!multi) S.cond.stayBooked = null; // 당일치기로 바뀌면 전에 고른 값이 남아 확인 화면에 엉뚱하게 나오지 않게 비움
  }
  $('chipStay').addEventListener('click', function (ev) { var b = ev.target.closest('[data-stay]'); if (!b) return; S.cond.stayBooked = b.getAttribute('data-stay'); stayUi(); });
  $('countMinus').addEventListener('click', function () { S.cond.count = Math.max(1, (S.cond.count || 1) - 1); $('countN').textContent = S.cond.count + '명'; });
  $('countPlus').addEventListener('click', function () { S.cond.count = Math.min(10, (S.cond.count || 1) + 1); $('countN').textContent = S.cond.count + '명'; });
  /* ---------- 4단계: 꼭 갈 곳 (선택, 최대 3곳) — 장소 자료 전체에서 고름(코스가 아직 없어도 됨) ---------- */
  var MV = { f: null, cat: 'place' }; // 2026-10-21: "전체" 칩을 없애고 기본으로 아무 것도 안 눌린 채 시작(눌러도 괜찮지만 미리 눌려 있지 않게) — SH_F[null]은 SH_F.all로 자동 대체됨
  // 2026-10-22: "여행의 본질이 보고 먹고 놀고" — 꼭 갈 곳에 식당·카페도 고를 수 있게(MV.cat), 3곳 제한도 없앰.
  // 식당·카페는 코스 안에 실제 들르는 장소로 넣지 않는다(끼니는 시간 슬롯 방식 그대로) — 대신 planner 로 넘기기 전에 가장 가까운 볼거리로 바꿔서, 그 근처를 지나가게 동선만 짠다(resolveMust 참고).
  function mvChipsUi() { Array.prototype.forEach.call(document.querySelectorAll('#mvChips [data-mvf]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-mvf') === MV.f ? 'true' : 'false'); }); }
  function mvCatUi() {
    Array.prototype.forEach.call(document.querySelectorAll('#mvCat [data-mvcat]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-mvcat') === MV.cat ? 'true' : 'false'); });
    $('mvChips').hidden = MV.cat !== 'place'; // 바다·실내·노을 칩은 볼거리를 고를 때만
  }
  function mustFoodKey(id) { return id.indexOf('food:') === 0 ? id.slice(5) : null; }
  function renderMustList() {
    var q = ($('mvQ').value || '').trim(), must = S.cond.must || (S.cond.must = []);
    var list, isFood = MV.cat === 'eat' || MV.cat === 'cafe';
    if (isFood) list = kindList(MV.cat, q);
    else { var fn = SH_F[MV.f] || SH_F.all; list = D.places.filter(function (p) { return fn(p) && (!q || (p.name || '').indexOf(q) >= 0 || (p.short || '').indexOf(q) >= 0); }); }
    $('mvHint').textContent = must.length ? ('고른 곳 ' + must.length + '곳') : '원하는 만큼 골라요.';
    $('mvList').innerHTML = !list.length ? '<li class="sh-none">찾는 곳이 없어요. 다른 낱말로 찾아 보세요.</li>' : list.slice(0, 60).map(function (p) {
      var id = isFood ? ('food:' + p.key) : p.id, idx = must.indexOf(id), on = idx >= 0;
      var meta = isFood ? ('<span class="sh-t">' + esc(p.type) + '</span><span class="sh-t">#' + esc(p.area) + '</span>')
        : (pickHtml(p, 'sh-t') + '<span class="sh-t">#' + esc(p.region || '') + '</span><span class="sh-t">' + (p.indoor ? '실내' : '야외') + '</span>');
      return '<li><button type="button" class="sh-item mv-item' + (on ? ' on' : '') + '" data-mvpick="' + esc(id) + '" aria-pressed="' + on + '"><span class="sh-top"><b>' + esc(p.name) + '</b>' + (on ? '<span class="mv-n">' + (idx + 1) + '</span>' : '') + '</span><span class="sh-meta">' + meta + '</span></button></li>';
    }).join('');
  }
  $('mvQ').addEventListener('input', renderMustList);
  $('mvCat').addEventListener('click', function (ev) { var b = ev.target.closest('[data-mvcat]'); if (!b) return; MV.cat = b.getAttribute('data-mvcat'); mvCatUi(); renderMustList(); });
  $('mvChips').addEventListener('click', function (ev) { var b = ev.target.closest('[data-mvf]'); if (!b) return; MV.f = b.getAttribute('data-mvf'); mvChipsUi(); renderMustList(); });
  $('mvList').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-mvpick]'); if (!b) return;
    var id = b.getAttribute('data-mvpick'), must = S.cond.must || (S.cond.must = []), idx = must.indexOf(id);
    if (idx >= 0) must.splice(idx, 1); else must.push(id); // 2026-10-22: 3곳 제한 없앰 — 원하는 만큼
    renderMustList();
  });
  /* 2026-10-22: planner(D.places 만 앎)에 넘기기 전에 'food:' 로 고른 식당·카페를 가장 가까운 볼거리 id 로 바꾼다 — 그 식당이 코스에 들어가는 게 아니라, 그 근처를 지나도록 동선만 짜 주는 것(사용자: "카페동해를 고르면 그 근처 묵호등대로 안내하는 로직")
   * 2026-10-22(Fable 리뷰 반영): 그냥 가장 가까운 곳 하나만 보면 장날에만 여는 곳(dayRule)·쉬는 요일(closedDow)에 걸려 그날 못 가는 곳을 억지로 끼워 넣을 수 있다.
   * 가까운 곳 5곳까지 보고, 그중 그날 가도 되는 곳을 고른다(다 막혀 있으면 그냥 가장 가까운 곳으로 어쩔 수 없이 되돌아감 — planner.js 가 뒤에서 또 한 번 거르거나 infeasible 로 처리). */
  function dayOkFor(p) {
    var dinfo = (P && P.dateInfo) ? P.dateInfo(S.cond.date) : null;
    if (p.dayRule && p.dayRule.lastDigit) { if (!dinfo || p.dayRule.lastDigit.indexOf(dinfo.d % 10) < 0) return false; }
    if (p.closedDow && dinfo && p.closedDow.indexOf(dinfo.dow) >= 0) return false;
    return true;
  }
  /* 2026-10-22: 고른 게 코스에 들어갔는지 사용자가 눈으로 바로 알 수 있게 — placeTags() 가 이 두 가지를 찾아 표(⭐)를 붙인다.
   * S.mustPicked: 「볼거리」로 고른 곳이 실제로 그 id 그대로 들어갔을 때(장소명=고른 것) 표시.
   * S.mustFoodNear: 「맛집·카페」로 고른 곳은 그 가게가 코스에 들어가는 게 아니라 가장 가까운 볼거리로 동선만 짜 주므로, 그 볼거리 장에 "이 근처: 가게이름"으로 표시해 줘야 "골랐는데 안 보인다"고 느끼지 않음. */
  function resolveMust(must) {
    var out = [], seen = {};
    S.mustFoodNear = {};
    (must || []).forEach(function (id) {
      var key = mustFoodKey(id), pid = id, foodName = null;
      if (key) {
        var x = TW.list('eat').filter(function (e) { return e.key === key; })[0];
        pid = null; foodName = x ? x.name : null;
        if (x && x.lat && x.lng && FU) {
          var cands = FU.nearestN(D.places, x.lat, x.lng, 5, null) || [];
          var ok = cands.filter(function (c) { return c && c.item && dayOkFor(c.item); })[0];
          pid = (ok || cands[0]) ? (ok || cands[0]).item.id : null;
        }
      }
      // 2026-10-22(버그 고침): "맛집·카페 반영 안 됨" — 서로 다른 맛집/카페 두 곳이 같은 가까운 볼거리로 묶이면(흔함),
      // !seen[pid] 에 걸려 두 번째로 고른 가게 이름이 아예 통째로 사라지던 문제. pid 는 한 번만 must 목록에 넣되(중복 고정 방지),
      // 가게 이름은 같은 볼거리에 묶인 것마다 전부 쌓는다(둘 다 "#꼭갈곳 · 근처 가게1·가게2" 로 보이게).
      if (pid) {
        if (!seen[pid]) { seen[pid] = 1; out.push(pid); }
        if (foodName) (S.mustFoodNear[pid] = S.mustFoodNear[pid] || []).push(foodName);
      }
    });
    return out;
  }
  /* ---------- 5단계: 확인 — 고른 내용을 줄로 보여 주고, 「고치기」로 그 단계로 바로 간다 ---------- */
  function mustNames() {
    return (S.cond.must || []).map(function (id) {
      var key = mustFoodKey(id);
      if (key) { var x = TW.list('eat').filter(function (e) { return e.key === key; })[0]; return x ? x.name : id; }
      return PLACE[id] ? (PLACE[id].short || PLACE[id].name) : id;
    });
  }
  function editRow(label, value, step) { return '<li class="confirm-row"><span class="cf-k">' + esc(label) + '</span><span class="cf-v">' + value + '</span><button type="button" class="linkbtn" data-editstep="' + step + '">고치기</button></li>'; }
  function renderConfirm() {
    var c = S.cond;
    var whenTxt = esc(P.dateLabel(c.date) + ' ' + toTimeValue(c.arrive) + ' 도착 (' + HOW_NAME[c.how] + ')' + (c.branch === 'now' ? ' · 지금' : ''));
    var effBack = c.backHow === 'car' && c.noLimit ? 22 * 60 : c.back;
    var backTxt = esc((c.backDate !== c.date ? P.dateLabel(c.backDate) + ' ' : '') + toTimeValue(effBack) + (c.backHow === 'car' && c.noLimit ? '까지' : ' 출발') + ' (' + HOW_NAME[c.backHow] + ')' + (nDays(c) > 1 ? ' · ' + P.tripLabel(nDays(c)) : ''));
    var compTxt = esc(compOf(c) && compOf(c) !== '혼자' ? compNames(c) + ' 함께' : '혼자');
    var mv = mustNames(), multiMust = mv.length && nDays(c) > 1;
    var mvTxt = mv.length ? (esc(mv.join(', ')) + (multiMust ? ' <span class="warnline">(1박 이상은 아직 반영 못 해요)</span>' : '')) : '없음 (도째비가 알맞게 골라요)';
    // 2026-10-22: 당일치기는 숙소를 안 물어보니(stayBooked 가 null) "안 물어봤어요"가 아니라 인원수만 보여줌
    var stayLabel = isMulti() ? '숙소·인원' : '인원';
    var stayTxt = isMulti() ? (c.stayBooked === 'booked' ? '벌써 잡았어요' : c.stayBooked === 'none' ? '아직이에요 (도째비가 추천해요)' : '안 물어봤어요') + ' · ' + (c.count || 1) + '명' : (c.count || 1) + '명';
    $('confirmList').innerHTML = editRow('올 때', whenTxt, 1) + editRow('돌아갈 때', backTxt, 2) + editRow('누구와', compTxt, 3) + editRow('꼭 갈 곳', mvTxt, 4) + editRow(stayLabel, stayTxt, 5);
  }
  document.addEventListener('click', function (ev) { var b = ev.target.closest('[data-editstep]'); if (!b) return; setStep(+b.getAttribute('data-editstep'), { focus: false }); });
  /* 인사 화면: 대표 사진 여러 장이 천천히 바뀐다(공공누리 제1유형만 — 칸에 꽉 채워 잘라 쓰므로). 4.5초마다 · 점 · 1/6 · 좌우로 밀기 · 손대는 동안·탭이 가려지면 멈춤 · 움직임 줄이기면 자동으로 안 넘김 */
  var HERO_IDS = ['skyvalley', 'suibyeon', 'mangsang', 'gamchusa', 'byeoryu', 'mukhoport'], HERO_MS = 4500;
  var HS = { list: [], i: 0, timer: null, touch: false, built: false };
  function heroShow(k, byUser) {
    var n = HS.list.length; if (!n) return;
    k = ((k % n) + n) % n; HS.i = k;
    Array.prototype.forEach.call($('heroSlides').children, function (el, j) { el.classList.toggle('on', j === k); el.setAttribute('aria-hidden', j === k ? 'false' : 'true'); });
    Array.prototype.forEach.call($('heroDots').children, function (el, j) { if (j === k) el.setAttribute('aria-current', 'true'); else el.removeAttribute('aria-current'); });
    var p = HS.list[k]; $('heroName').textContent = p.name; $('heroCredit').textContent = creditText(p); $('heroCount').textContent = (k + 1) + '/' + n;
    $('hero').setAttribute('data-slide', String(k + 1));
    if (byUser) heroTimer();
  }
  function heroTick() {
    if (document.hidden || HS.touch || reduceMotion() || HS.list.length < 2) return;
    var h = $('hero'); if (!h || h.offsetParent === null) return; // 인사 화면이 아니면 안 넘김
    heroShow(HS.i + 1, false);
  }
  function heroTimer() { clearInterval(HS.timer); HS.timer = null; if (!reduceMotion() && HS.list.length > 1) HS.timer = setInterval(heroTick, HERO_MS); }
  function initHero() {
    HS.list = HERO_IDS.map(function (id) { return PLACE[id]; }).filter(function (p) { return p && licNo(p) === 1; });
    if (!HS.list.length) { $('heroMeta').hidden = true; $('heroCount').hidden = true; return; }
    $('heroSlides').innerHTML = HS.list.map(function (p, k) { return '<figure class="hs' + (k === 0 ? ' on' : '') + '" data-id="' + p.id + '" aria-hidden="' + (k === 0 ? 'false' : 'true') + '"><img src="' + esc(p.photo) + '" alt="' + esc(p.name + ' 풍경') + '" width="940" height="704"' + (k === 0 ? '' : ' loading="lazy"') + ' decoding="async" referrerpolicy="no-referrer" draggable="false"></figure>'; }).join('');
    $('heroDots').innerHTML = HS.list.map(function (p, k) { return '<button type="button" class="hero-dot" data-k="' + k + '" aria-label="' + (k + 1) + '번째 사진 · ' + esc(p.short || p.name) + '"></button>'; }).join('');
    Array.prototype.forEach.call($('heroSlides').querySelectorAll('img'), function (img) { img.onerror = function () { var fig = img.parentNode; fig.parentNode.removeChild(fig); HS.list = HS.list.filter(function (q) { return q.id !== fig.getAttribute('data-id'); }); $('heroDots').innerHTML = HS.list.map(function (p, k) { return '<button type="button" class="hero-dot" data-k="' + k + '" aria-label="' + (k + 1) + '번째 사진"></button>'; }).join(''); if (HS.list.length) heroShow(Math.min(HS.i, HS.list.length - 1), false); }; });
    $('heroDots').addEventListener('click', function (ev) { var b = ev.target.closest('.hero-dot'); if (b) heroShow(+b.getAttribute('data-k'), true); });
    var hero = $('hero'), sx = 0, sy = 0, down = false;
    hero.addEventListener('pointerdown', function (ev) { if (ev.target.closest('.hero-dot') || ev.target.closest('a,button')) return; down = true; HS.touch = true; sx = ev.clientX; sy = ev.clientY; });
    function up(ev) {
      if (!down) { HS.touch = false; return; }
      down = false; HS.touch = false;
      var dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) heroShow(HS.i + (dx < 0 ? 1 : -1), true);
      else heroTimer();
    }
    hero.addEventListener('pointerup', up); hero.addEventListener('pointercancel', function () { down = false; HS.touch = false; });
    hero.addEventListener('keydown', function (ev) { if (ev.key === 'ArrowRight') { heroShow(HS.i + 1, true); } else if (ev.key === 'ArrowLeft') { heroShow(HS.i - 1, true); } });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) heroTimer(); });
    try { var mq = window.matchMedia('(prefers-reduced-motion: reduce)'); if (mq.addEventListener) mq.addEventListener('change', heroTimer); } catch (e) { /* 무시 */ }
    heroShow(0, false); heroTimer(); HS.built = true;
  }
  function initIntro() {
    initHero();
    Array.prototype.forEach.call(document.querySelectorAll('.ex-card'), function (b) {
      var id = b.getAttribute('data-ph'), p = PLACE[id], box = b.querySelector('.ex-img');
      box.setAttribute('data-art', id);
      if (licNo(p) === 1) box.innerHTML = '<img class="kto-img" src="' + esc(p.photo) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">';
      else box.innerHTML = ART.svg(id);
    });
  }
  function applyParsed(r, leadText) {
    var c = S.cond;
    if (r.how) {
      c.how = r.how;
      if (c.how === 'car') { c.backHow = 'car'; c.backHowTouched = false; } // 2026-10-21: 자가용·대중교통 뒤섞인 조합은 안 보이게 했으니 말로 들어온 값도 바로 맞춤
      else if (c.backHow === 'car') { c.backHow = c.how; c.backHowTouched = false; }
    }
    c.end = r.end || 'mukho';
    // 2026-10-21: 누구와는 이제 여러 명 동시 선택이 되는데, 말로/사진으로 들어온 값은 하나만 골라 쓰고 있었음(확인 글에는 다 보여주면서 실제로는 하나만 반영되던 버그) — 들어온 것 전부 반영, 혼자는 다른 것과 함께 못 둠
    if (r.companions && r.companions.length) c.companions = r.companions.indexOf('혼자') >= 0 ? ['혼자'] : r.companions.filter(function (n) { return COMPS.indexOf(n) >= 0; });
    c.knee = !!r.knee; c.interests = r.interests.slice(); c.rain = !!r.rain || (S.wxRain && c.rain); c.food = !!r.food; c.foodWord = r.foodWord || ''; c.count = r.count;
    c.date = r.date || c.date || todayIso();
    syncBack(c);
    if (r.train != null) { c.back = r.train; c.backTouched = true; }
    var found = [];
    if (r.date) found.push('여행 날짜 ' + P.dateLabel(r.date));
    if (r.how) found.push(HOW_NAME[r.how]);
    if (r.train != null) found.push((c.backHow === 'car' ? '머무는 시간 ' : '돌아갈 시간 ') + hhmm(r.train));
    if (r.end === 'donghae') found.push('동해역');
    r.companions.forEach(function (n) { found.push(n + ' 함께'); });
    if (r.knee) found.push('무릎·계단 조심');
    r.interests.forEach(function (n) { found.push(n === '사진' ? '사진·노을' : n); });
    if (r.rain) found.push('비');
    if (r.food) found.push('식사');
    if (r.count) found.push(r.count + '명');
    S.found = found;
    S.nextStep = 3; // 알아들은 내용을 마지막 단계에서 확인
    S.startNote = leadText + (found.length ? ' 알아들은 것: ' + found.join(' · ') + '.' : '') + ' 맞는지 보고 아래 단추를 눌러 주세요.';
    loadTrains();
    show('s-start');
  }
  function handleTicketFile(ev) {
    var f = ev.target.files && ev.target.files[0]; if (!f) return;
    var r = AI.aiParseTicket(f);
    r.how = 'train';
    applyParsed(r, '승차권 사진에서 읽은 내용이에요 (시연: 사진을 읽은 것처럼 보여 드려요).');
    ev.target.value = '';
  }
  $('ticketFile').addEventListener('change', handleTicketFile);
  if ($('ticketFile2')) $('ticketFile2').addEventListener('change', handleTicketFile); // 2026-10-22: 2단계("지금" 흐름)에서도 같은 승차권 사진 기능을 쓸 수 있게
  $('goVoice').addEventListener('click', function () { $('reqText').value = ''; show('s-input'); initMic(); });
  $('inputNext').addEventListener('click', function () {
    var r = AI.aiParseRequest($('reqText').value, S.cond.arrive, todayIso());
    applyParsed(r, '말씀하신 내용이에요.');
  });
  $('runDemo').addEventListener('click', function () { runDemo('normal'); });
  $('runDemoMeal').addEventListener('click', function () { runDemo('meal'); });
  $('runDemoDay').addEventListener('click', function () { runDemo('day'); });
  $('runDemoTour').addEventListener('click', function () { runDemo('tour'); });
  $('runDemo1bak').addEventListener('click', function () { runDemo('1bak'); });
  /* 예시: 'normal' 13시 부모님 · 'meal' 낮 12시 "점심도 먹고 싶어요"(점심 시간 포함) · 'day' 10시 도착 · 19:40 기차 · 친구 · 가장 가까운 장날 → 먼 권역까지 가는 하루
     'bus' 터미널에서 시작·끝 · 'car' 주차장에서 시작·끝 · 'kid' 아이 · 'couple' 연인 저녁(자가용 15~21시) */
  var DEMOS = {
    normal: { say: '6시 10분 기차, 부모님과 가요', arrive: 13 * 60 },
    meal: { say: '6시 10분 기차, 부모님과 가요. 점심도 먹고 싶어요', arrive: 12 * 60 },
    day: { say: '7시 40분 기차, 친구랑 가요', arrive: 10 * 60, market: true },
    bus: { how: 'bus', arrive: 10 * 60, back: 18 * 60, comp: '친구' },
    car: { how: 'car', arrive: 10 * 60, back: 18 * 60, comp: '친구' },
    kid: { how: 'train', arrive: 10 * 60, back: P.toMin('18:10'), comp: '아이' },
    couple: { how: 'car', arrive: 15 * 60, back: 21 * 60, comp: '연인' },
    tour: { how: 'train', arrive: 9 * 60 + 30, back: 19 * 60 + 40, comp: '친구', loop: true }, // 시티투어버스로 한 바퀴: 가장 가까운 운행 토요일
    '1bak': { how: 'train', arrive: 10 * 60, back: 15 * 60 + 48, comp: '연인', sat: true, nights: 1 } // 1박 2일: 다음 토요일 10:00 기차로 와서 일요일 15:48 기차로 감
  };
  /* 오늘 포함 가장 가까운 운행 토요일 */
  function nextTourSaturday() {
    var d = todayIso();
    for (var k = 0; k < 400; k++) { var t = P.addDays(d, k), i = P.dateInfo(t); if (i && i.dow === 6 && (!CT || P.tourDay(CT, t).ok)) return t; }
    return d;
  }
  /* 오늘 다음 날부터 처음 오는 토요일 */
  function nextSaturday() {
    var d = todayIso();
    for (var k = 1; k < 9; k++) { var t = P.addDays(d, k), i = P.dateInfo(t); if (i && i.dow === 6) return t; }
    return d;
  }
  function runDemo(kind) {
    kind = kind === true ? 'meal' : (kind || 'normal');
    var dm = DEMOS[kind]; if (!dm) return;
    var keepRain = S.cond.rain && S.wxRain;
    S.cond = freshCond(); S.cond.arrive = dm.arrive; S.cond.date = todayIso();
    S.simNow = dm.arrive; lsSet(K_SIM, String(S.simNow));
    S.tourLoop = !!dm.loop;
    if (dm.loop) S.cond.date = nextTourSaturday();
    if (dm.sat) { S.cond.date = nextSaturday(); S.cond.backDate = P.addDays(S.cond.date, dm.nights); S.cond.backDateTouched = true; }
    if (dm.say) {
      $('reqText').value = dm.say;
      var r = AI.aiParseRequest(dm.say, S.simNow, todayIso());
      if (dm.market) r.date = P.nextMarketDay(todayIso(), marketDigits()) || todayIso();
      r.how = 'train';
      applyParsed(r, '예시: "' + dm.say + '"' + (dm.market ? ' (날짜는 가장 가까운 장날로 맞췄어요)' : '') + '.');
    } else {
      S.cond.how = dm.how; S.cond.backHow = dm.how; syncBack(S.cond); S.cond.back = dm.back; S.cond.backTouched = true; setComp(S.cond, dm.comp);
    }
    if (keepRain) S.cond.rain = true;
    makeCourse(true);
  }

  /* 말하기 */
  var rec = null, recOn = false, micReady = false;
  function initMic() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    var btn = $('micBtn');
    if (!SR) { btn.hidden = true; $('micNote').hidden = false; return; }
    btn.hidden = false; $('micNote').hidden = true;
    if (micReady) return; micReady = true;
    rec = new SR(); rec.lang = 'ko-KR'; rec.interimResults = false; rec.maxAlternatives = 1;
    function idle() { recOn = false; btn.classList.remove('rec'); $('micTxt').textContent = '말하기'; }
    rec.onresult = function (ev) { var t = ev.results[0][0].transcript; $('reqText').value = ($('reqText').value ? $('reqText').value + ' ' : '') + t; $('micErr').hidden = true; };
    rec.onend = idle;
    rec.onerror = function (ev) {
      idle();
      var e = $('micErr'); e.hidden = false;
      e.textContent = (ev && (ev.error === 'not-allowed' || ev.error === 'service-not-allowed')) ? '마이크를 쓸 수 없어요. 주소창 옆 자물쇠에서 마이크를 허용하시거나 글로 적어 주세요.' : '잘 듣지 못했어요. 한 번 더 눌러서 말씀해 주세요.';
    };
    btn.addEventListener('click', function () {
      if (recOn) { rec.stop(); return; }
      try { stopSpeak(); rec.start(); recOn = true; btn.classList.add('rec'); $('micTxt').textContent = '듣고 있어요… 다 말씀하셨으면 누르세요'; } catch (e) { idle(); }
    });
  }

  /* ---------- 조건 화면 ---------- */
  function chip(label, pressed, attrs) { return '<button type="button" class="chip" aria-pressed="' + (pressed ? 'true' : 'false') + '" ' + attrs + '>' + esc(label) + '</button>'; }
  /* 장날(끝자리 3·8) 전용 곳 — 데이터의 dayRule 에서 읽는다 */
  function marketPlace() { return D.places.filter(function (p) { return p.dayRule; })[0] || null; }
  function marketDigits() { var m = marketPlace(); return m ? m.dayRule.lastDigit : [3, 8]; }
  var DOW_NAME = ['일', '월', '화', '수', '목', '금', '토'];
  /* 날짜 안내 한 줄: 장날이면 "장날이에요", 아니면 "다음 장날 ○월 ○일", 쉬는 요일이 걸리는 곳도 알린다 */
  function dateHint(date, short) {
    var info = P.dateInfo(date); if (!info) return '';
    var mk = marketPlace(), out = [];
    if (mk) {
      if (P.lastDigitDay(date, marketDigits())) out.push(mk.short + ' 장날이에요 — 코스에 넣을 수 있어요');
      else { var nx = P.nextMarketDay(date, marketDigits()); out.push(mk.short + '은 장날(3·8일)에만 넣어요 · 다음 장날 ' + (nx ? P.dateLabel(nx) : '')); }
    }
    var shut = D.places.filter(function (p) { return p.closedDow && p.closedDow.indexOf(info.dow) >= 0; }).map(function (p) { return p.short; });
    if (shut.length) out.push(DOW_NAME[info.dow] + '요일은 ' + shut.join('·') + '이(가) 쉬어서 뺐어요');
    var th = tourHint(date, short); if (th) out.push(th);
    return P.dateLabel(date) + ' · ' + out.join(' · ');
  }
  /* 시티투어버스 안내 한 줄: 운행일이면 시간·요금, 아니면 "토·일·공휴일만 다녀요 (다음 운행: ○월 ○일)" */
  function tourHint(date, short) {
    if (!CT) return '';
    var d = P.tourDay(CT, date);
    if (d.ok) return '시티투어버스 운행일(' + d.why + ') ' + CT.hours + (short ? '' : ' · ' + P.tourFareText(CT));
    var nx = P.tourNextDay(CT, date);
    if (d.why === '운행 기간이 끝남' || !nx) return '시티투어버스는 ' + P.dateLabel(CT.period.to) + '까지만 운행해요';
    return '시티투어버스는 토·일·공휴일만 다녀요 (다음 운행: ' + P.dateLabel(nx) + ')';
  }
  $('makeCourse').addEventListener('click', function () {
    if (stepBlock()) { setStep(2, { focus: false }); stepBlock(); return; }
    var future = S.cond.branch !== 'now' && S.cond.date > todayIso(); // 올 예정 + 앞날 날짜 → 먼저 "여행 준비"(D-day) 화면
    makeCourse(false, false, future ? 's-prep' : 's-course');
  });

  /* ---------- 코스 결과의 지도는 접어 두고 버튼으로만 (2026-10-22 디자인 시안) ---------- */
  function ovMapOpen(open) {
    var ov = $('ov'), b = $('ovToggle'); if (!ov || !b) return;
    ov.classList.toggle('map-open', !!open); b.setAttribute('aria-expanded', open ? 'true' : 'false');
    b.querySelector('span').textContent = open ? '지도 접기' : '지도로 동선 보기';
    if (open) { try { ovKakaoEnsure(); } catch (e) { /* 지도 그림으로 계속 */ } try { if (OVS.frame && OA.state === 'idle') ovLayout(OVS.cam ? OVS.cam.z : 1); } catch (e) { /* 무시 */ } }
  }
  $('ovToggle').addEventListener('click', function () { ovMapOpen(!$('ov').classList.contains('map-open')); });
  $('ovPlay').addEventListener('click', function () { if (!$('ov').classList.contains('map-open')) ovMapOpen(true); }, true); // 미리 보기는 지도 위에서 움직이니 자동으로 펼침

  /* ---------- 빠른 시작 (2026-10-22 디자인 시안): 큰 카드 3묶음 → 기존 코스 만들기에 그대로 연결 ---------- */
  var QS = { stay: null, comp: null, how: 'train' };
  function qsUi() {
    Array.prototype.forEach.call(document.querySelectorAll('#quick [data-qs]'), function (b) {
      var k = b.getAttribute('data-qs'), v = b.getAttribute('data-v');
      b.setAttribute('aria-pressed', String(QS[k] != null && String(QS[k]) === v));
    });
    var m = $('qsMsg'); if (m && QS.stay != null && QS.comp) m.hidden = true;
  }
  $('quick').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-qs]'); if (!b) return;
    var k = b.getAttribute('data-qs'), v = b.getAttribute('data-v');
    QS[k] = k === 'stay' ? +v : v; qsUi();
  });
  $('qsGo').addEventListener('click', function () {
    if (QS.stay == null || !QS.comp) { var m = $('qsMsg'); m.hidden = false; return; }
    S.cond = freshCond(); var c = S.cond;
    c.branch = 'later'; c.how = QS.how; c.backHow = QS.how; c.tripNights = QS.stay || null;
    c.companions = [QS.comp];
    if (QS.stay >= 1) c.stayBooked = 'none'; // 1박이면 숙소는 "아직이에요"로 두고 도째비가 추천
    syncBack(c); loadTrains(); renderStart();
    $('makeCourse').click();
  });

  /* ---------- 코스 만들기 ---------- */
  /* 돌아갈 시각(분): 기차·버스 = 출발, 자가용 = 주차장에 돌아올 시각(정하지 않으면 밤 10시). 막차 보기 = 기차는 그날 마지막 기차, 버스·자가용은 밤 10시
     2026-10-21: late 모드가 20·21시로 못 박혀 있던 걸 그대로 두면, "시간 안 정함"(c.noLimit)일 때 이미 밤 10시까지인데 "하루 더 머물면?" 의 "OO시까지 늘리기"가 오히려 더 이른 시각을 보여줘(코스가 짧아짐) — 늘 노멀 모드 상한(22시)과 같거나 늦게 맞춤 */
  function lastTrain(c) { var tl = trainTimes(c); return P.toMin(tl[tl.length - 1]); }
  function effTrain(mode) {
    var c = S.cond;
    if (mode === 'late') return c.backHow === 'train' ? lastTrain(c) : Math.max(22 * 60, c.back || 0);
    return c.backHow === 'car' && c.noLimit ? 22 * 60 : c.back;
  }
  /* 돌아갈 시각이 어디서 왔나: 코레일 시간표에 있는 기차 · 예시 시간표 · 직접 고른 시간 */
  function backSrc(mode) {
    var c = S.cond, tv = toTimeValue(effTrain(mode || S.mode));
    if (c.backHow !== 'train') return ' (직접 고른 시간)';
    var rt = realTrains(c);
    if (rt) return rt.list.some(function (x) { return x.dep === tv; }) ? ' (코레일 시간표)' : ' (직접 고른 시간)';
    return (D.trains[c.end] || []).indexOf(tv) >= 0 ? ' (예시 시간표)' : ' (직접 고른 시간)';
  }
  function startId() { return S.cond.how === 'bus' ? 'bus' : S.cond.how === 'car' ? 'park' : 'mukho'; }
  function endId() { return S.cond.backHow === 'bus' ? 'bus' : S.cond.backHow === 'car' ? 'park' : S.cond.end; }
  function isMulti() { return nDays(S.cond) > 1; }
  /* 여러 날 숙소 자리: 동해시 숙박업소 자료 중 묵호역에서 가장 가까운 곳(이름·거리만, 별점·광고 없음). 자료가 없으면 묵호역 둘레 */
  function stayInfo() {
    if (S.stayPick) return S.stayPick; // 동네 탭에서 고른 숙소
    var m = D.stations.mukho;
    if (!FU || !FAC.lodging || !FAC.lodging.length) return { id: 'stay', name: '묵호역 근처 숙소', lat: m.lat, lng: m.lng, examples: [], source: '' };
    var all = FU.nearestN(FAC.lodging, m.lat, m.lng, 99, null), best = all[0].item;
    return { id: 'stay', name: best.name, lat: best.lat, lng: best.lng, examples: all.slice(0, 3).map(function (x) { return x.item.name; }), source: (FAC.source && FAC.source.lodging) || '공공데이터포털 동해시 숙박업소' };
  }
  /* 올 예정(앞날) + 여러 날이면, 동선을 보고 숙소 권역을 스스로 추천한다(동네 탭과 같은 숙박업소 자료, 망상·묵호·천곡·구미 네 권역만 — 자료에 있는 19곳뿐).
     권역마다 자료 안에서 가장 가운데 있는 숙소를 임시로 넣어 날마다 코스를 짜 보고, 볼거리 수가 가장 많은(동점이면 점수 합이 큰) 권역을 고른다. 나중에 동네 탭에서 직접 바꾸면 그 값을 따른다(S.stayPick). */
  function stayCandidates() {
    if (!TW) return [];
    var lodges = TW.list('lodge').filter(function (x) { return x.lat && x.lng; }), byArea = {};
    lodges.forEach(function (x) { (byArea[x.area] = byArea[x.area] || []).push(x); });
    // 2026-10-21: 날마다 코스를 미리 짜 보는 계산이라 권역 하나하나가 비용이 꽤 됨 — 숙박업소가 1곳뿐인 권역(실제 숙박지로 보기 어려움)은 미리 빼서 계산을 줄임
    return Object.keys(byArea).filter(function (a) { return byArea[a].length >= 2; }).map(function (a) {
      var arr = byArea[a], clat = arr.reduce(function (s, x) { return s + x.lat; }, 0) / arr.length, clng = arr.reduce(function (s, x) { return s + x.lng; }, 0) / arr.length;
      var near = FU ? FU.nearestN(arr.map(function (x) { return { name: x.name, lat: x.lat, lng: x.lng }; }), clat, clng, 1, null) : null;
      var best = (near && near[0] && near[0].item) || arr[0];
      return { id: 'stay', name: best.name, lat: best.lat, lng: best.lng, area: a, examples: arr.slice(0, 3).map(function (x) { return x.name; }), source: (TW.src && TW.src.lodging) || '공공데이터포털 동해시 숙박업소' };
    });
  }
  function planScore(pl) {
    var n = 0, s = 0;
    (pl.days || []).forEach(function (d) { n += placeStops(d.plan.stops).length; s += d.plan.score || 0; });
    return n * 1000 + s;
  }
  function recommendStay() {
    var cands = stayCandidates();
    if (!cands.length) return null;
    var base = planOpts(), best = null, bestScore = -Infinity;
    cands.forEach(function (cand) {
      var pl = P.planDays(D, Object.assign({}, base, { stay: cand, fixed: [], mode: 'normal', now: S.cond.arrive }));
      if (!pl.feasible) return;
      var sc = planScore(pl);
      if (sc > bestScore) { bestScore = sc; best = cand; }
    });
    return best; // 2026-10-21: 어느 권역도 하루 안에 다 안 맞으면(infeasible) 아무 권역이나 골라 "추천"이라고 말하지 않고, 기존 기본값(묵호역 근처)으로 되돌림(stayInfo()) — cands[0] 은 추천이 아니라 그냥 첫 번째라 틀린 이유를 달고 보여주고 있었음
  }
  function isKid() { return S.cond.companions.indexOf('아이') >= 0; }
  function isCouple() { return S.cond.companions.indexOf('연인') >= 0; }
  function planOpts(over) {
    var multi = isMulti();
    if (multi) S.mustFoodNear = {}; // 2026-10-22: 여러 날은 must 를 안 쓰니(날마다 강제되는 문제 회피) 전에 하루 코스에서 쓰던 "근처: 가게이름" 표도 지워 둠(묵은 표가 남지 않게)
    var o = { now: S.simNow, train: effTrain(S.mode), how: S.cond.how, backHow: S.cond.backHow, start: startId(), end: endId(), backDate: S.cond.backDate, stay: multi ? stayInfo() : undefined, sunrise: multi && !S.cond.rain && !isKid() && !isSlow() && (isCouple() || S.cond.companions.indexOf('친구') >= 0 || S.cond.companions.indexOf('혼자') >= 0 || !S.cond.companions.length), kid: isKid(), couple: isCouple(), slow: isSlow(), avoidStairs: isSlow() || isKid(), soft: isSlow(), food: !!S.cond.food, foodWord: S.cond.foodWord || '', rain: S.cond.rain, interests: S.cond.interests, fx: S.fx, crowdFn: S.crowd ? crowdFn : null, mode: S.mode, fixed: S.fixed, date: S.cond.date, tour: !!CT, tourPrefer: !!S.tourLoop, must: multi ? [] : resolveMust(S.cond.must) }; // 꼭 갈 곳(o.must)은 하루 코스에만: planDays 는 날마다 같은 o 를 쓰므로 여러 날이면 날마다 강제돼 버린다 · 2026-10-22: resolveMust 가 'food:' 선택을 가장 가까운 볼거리 id 로 바꿔 줌
    if (over) for (var k in over) o[k] = over[k];
    if (over && over.mode) o.train = effTrain(over.mode);
    if (multi) { o.fixed = []; o.mode = 'normal'; o.now = S.cond.arrive; }
    return o;
  }
  /* 2026-10-22(Fable 리뷰 반영): '꼭 갈 곳'을 너무 많이 고르면 하루 안에 다 못 돌아 코스가 아예 비어 버리고,
   * "돌아갈 시간까지 여유가 적어요"(시간이 모자란 것처럼 보이는) 안내만 나가던 문제를 고친다.
   * 안 들어가면 뒤에서부터 하나씩 빼고 다시 짜 보고, 그래도 안 되면 또 뺀다 — 뭘 뺐는지는 S.mustDropped 에 남겨 코스 화면에 알려 준다. */
  function buildPlan(over) {
    var o = planOpts(over);
    S.mustDropped = [];
    if (isMulti()) return P.planDays(D, o);
    var result = P.plan(D, o);
    if (o.must && o.must.length) {
      var left = o.must.slice();
      while (!result.feasible && left.length) {
        S.mustDropped.push(left.pop());
        var o2 = {}; for (var k in o) o2[k] = o[k];
        o2.must = left;
        result = P.plan(D, o2);
      }
    }
    return result;
  }
  /* 제보는 코스를 자동으로 바꾸지 않는다: 코스 계산에 들어가는 것은 사람이 [코스 다시 짜기]로 받아들인(S.applied) 알림의 제보뿐 */
  function recomputeFx() { S.fx = P.effectsFromReports(REP.acceptedReports(S.reports, S.applied, S.simNow), S.simNow, true); }
  /* ---------- 관광지 집중률 예측 (한국관광공사, 하루 한 값 · 실시간 아님) ----------
     /api/crowd(서버가 하루 한 번 받아 둔 값) → 못 받으면 묶음의 CROWD_SNAPSHOT → 그것도 없으면 아무것도 안 보인다. 예측이 있는 날(오늘~+29일)만 보여 준다. 계산은 crowd.js */
  function crowdFn(isoDate) { return S.crowd ? CR.ratesFor(S.crowd, isoDate) : null; }
  function loadCrowd() {
    function use(d) {
      if (!CR.valid(d)) return;
      S.crowd = d;
      if (!$('s-start').hidden) renderStart();
      if (S.plan) { if (!S.ed && !S.fixed.length) replan({ noHighlight: true }); else renderCourse(); } // 늦게 도착하면 아침 먼저 규칙까지 반영해 다시 짠다(고친 코스는 그대로, 이름표만)
    }
    var sn = window.CROWD_SNAPSHOT;
    if (location.protocol.indexOf('http') !== 0) { use(sn); return; }
    fetch('/api/crowd', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) { if (CR.valid(j)) use(j); else use(sn); }).catch(function () { use(sn); });
  }
  function stopDate(s) { var pl = S.plan; if (!pl) return S.cond.date; return pl.multi ? (pl.days[s && s.day || 0] || pl.days[0]).date : (pl.date || S.cond.date); }
  function crowdOf(s) { return S.crowd && s && s.place && !isSlot(s) ? CR.rateFor(S.crowd, s.id, stopDate(s)) : null; }
  function crowdHtml(s) {
    var v = crowdOf(s); if (v == null) return '';
    var lv = CR.level(v), nm = CR.LEVEL_NAME[lv];
    return '<span class="p-cr cr-' + lv + '" role="img" aria-label="붐빔 예상 ' + Math.round(v) + ' (' + nm + ')"><span class="cr-bar" aria-hidden="true"><i style="width:' + Math.max(6, Math.round(Math.min(100, v))) + '%"></i></span><span class="cr-t">' + nm + ' ' + Math.round(v) + '</span></span>';
  }
  function crowdBody(s) {
    var v = crowdOf(s); if (v == null) return '';
    var lv = CR.level(v);
    return '<p class="p-crline cr-' + lv + '"><b>붐빔 예상 ' + Math.round(v) + ' (' + CR.LEVEL_NAME[lv] + ')</b> · 이 날 하루 값이에요(시간대는 몰라요)' + (s.crowdEarly ? ' · <b>붐빌 예정이라 아침에 먼저 (어림)</b>' : '') + '</p>';
  }
  function allStops() { var pl = S.plan; return !pl ? [] : pl.multi ? pl.days.reduce(function (a, d) { return a.concat(d.plan.stops.map(function (s) { s.day = s.day == null ? d.n - 1 : s.day; return s; })); }, []) : pl.stops; }
  function crowdBusy() { return placeStops(allStops()).map(function (s) { return { s: s, v: crowdOf(s) }; }).filter(function (x) { return x.v != null && x.v > CR.BUSY; }); }
  function renderCrowdLine(c) {
    var el = $('crowdLine'), q = $('crowdQuiet'); if (!el || !q) return;
    el.hidden = true; q.hidden = true;
    var avg = S.crowd ? CR.avgFor(S.crowd, c.date) : null; if (avg == null) return; // 예측이 없는 날이면 아무것도 안 보인다
    var lv = CR.level(avg);
    el.hidden = false; el.className = 'crowd-line cr-' + lv;
    el.innerHTML = '이날 붐빔 예상: <b>' + CR.AVG_NAME[lv] + '</b> (동해 주요 관광지 평균)<small>' + esc(CR.sourceLine(S.crowd)) + '</small>';
    var qt = CR.quieter(S.crowd, c.date, todayIso(), P.addDays);
    if (qt) { q.hidden = false; q.textContent = P.dateLabel(qt.iso) + '은 더 한산해요'; q.setAttribute('data-cdate', qt.iso); }
  }
  function ids(pl) { return pl ? pl.stops.map(function (s) { return s.id; }) : []; }
  function diff(prev, next) {
    var ch = {}; if (!prev) return ch;
    var pi = ids(prev);
    next.stops.forEach(function (s, i) {
      if (pi.indexOf(s.id) !== i) ch[s.id] = true;
      var ps = prev.stops.filter(function (x) { return x.id === s.id; })[0];
      if (ps && !ps.delay && s.delay) ch[s.id] = true;
    });
    return ch;
  }
  function replan(opts) {
    recomputeFx();
    var prev = S.plan;
    if (S.ed) { // 직접 고친 코스: 순서는 건드리지 않고(제보·비·시각이 바뀌어도) 시각·문제만 다시 계산한다. 바꾸는 방법은 위쪽 안내에 올린다
      var wasDirty = edDirty(), fr = buildPlan();
      if (!wasDirty) S.ed.hist = new ED.History(ED.fromPlan(fr), 50); // 아직 안 고쳤으면 새 자동 코스를 그대로 따른다
      S.ed.frame = fr; S.plan = edRetimed(); S.changed = {};
    } else {
      S.plan = buildPlan();
      S.changed = (opts && opts.noHighlight) ? {} : diff(prev, S.plan);
    }
    renderCourse();
    return prev;
  }
  function today() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function makeCourse(fromDemo, quiet, toScreen) {
    if (!fromDemo) S.tourLoop = false;
    S.simNow = S.cond.arrive; lsSet(K_SIM, String(S.simNow)); S.startNote = null; S.tr = S.tr; // 도착 시각이 출발 시각
    S.mode = 'normal'; S.fixed = []; S.banner = null; $('banner').hidden = true;
    S.plan = null; S.ed = null; S.editing = false; S.dayTab = 0; S.stayPick = null; S.stayAuto = false; S.openFold = {};
    S.applied = {}; S.dismissed = {}; S.notified = {}; S.raMore = false; S.demoNear = false; S.mapSeen = false; S.mapLay = { course: true, eat: false, cafe: false, lodge: false, spot: false }; S.mapFocus = null; // 새 코스: 제보 알림 선택·지도 층을 처음 상태로
    if (isMulti() && S.cond.stayBooked !== 'booked') { var rs = recommendStay(); if (rs) { S.stayPick = rs; S.stayAuto = true; } } // 올 예정 + 여러 날: 동선 보고 숙소 권역을 스스로 추천(동네 탭에서 직접 바꾸면 그 값을 따름) — 2026-10-22(Fable 리뷰): 벌써 숙소를 잡았다고 했으면 엉뚱한 곳을 "추천"이라고 덮어 보여주지 않음
    replan({ noHighlight: true });
    edRestore(); // 같은 조건으로 전에 고쳐 둔 코스가 있으면 그대로 불러온다
    logEvent('plan', { mode: 'normal' });
    show(toScreen || 's-course');
    var pl = S.plan;
    if (!quiet && toScreen !== 's-prep' && placeStops(pl.stops).length) autoSay(pl.startStation.name + '에서 출발해서 ' + placeStops(pl.stops).length + '곳을 이야기와 함께 돌아요. 첫 번째 장은 ' + placeStops(pl.stops)[0].place.name + '이에요. ' + hhmm(pl.back.arrive) + '에 ' + pl.endStation.name + '에 도착해요.');
  }

  /* ---------- 여행 준비(D-day, 6차안): 올 예정 + 앞날 날짜일 때 코스 화면 전에 보여 준다. 코스는 이미 만들어 둔 S.plan 에서 미리 보기만 뽑는다 ---------- */
  function factRow(label, state, text) {
    var tag = state === 'ok' ? '확정' : state === 'guess' ? '예측' : '아직 몰라요';
    return '<li class="fact-row"><span class="fact-k">' + esc(label) + '</span><span class="fact-tag f-' + state + '">' + tag + '</span><span class="fact-v">' + esc(text) + '</span></li>';
  }
  function prepPreviewHtml(pl) {
    if (!pl) return '';
    var days = pl.multi ? pl.days : [{ n: 1, date: pl.date || S.cond.date, plan: pl }];
    return days.slice(0, 2).map(function (d) {
      var stops = placeStops((d.plan || pl).stops || []);
      return '<div class="prep-day"><b>' + d.n + '일차 · ' + esc(P.dateLabel(d.date)) + '</b><ol>' + (stops.length ? stops.map(function (s) { return '<li>' + esc(s.place.short || s.place.name) + '</li>'; }).join('') : '<li class="quiet">갈 곳을 찾지 못했어요</li>') + '</ol></div>';
    }).join('');
  }
  /* 2026-10-21: 자가용만 쓰면 "기차표·버스표 예매"가 안 맞음 — 실제로 쓰는 이동수단에 맞춰 보여줌 */
  function prepTodoList(c) {
    var usesTrain = c.how === 'train' || c.backHow === 'train', usesBus = c.how === 'bus' || c.backHow === 'bus', usesCar = c.how === 'car' || c.backHow === 'car';
    var out = [];
    if (usesTrain && usesBus) out.push({ k: 'ticket', t: '기차표·버스표 예매' });
    else if (usesTrain) out.push({ k: 'ticket', t: '기차표 예매' });
    else if (usesBus) out.push({ k: 'ticket', t: '버스표 예매' });
    if (usesCar) out.push({ k: 'parking', t: '목적지 주차장 확인' });
    if (nDays(c) > 1) out.push({ k: 'stay', t: '숙소 예약' }); // 2026-10-21: 당일치기(같은 날 돌아감)인데도 "숙소 예약"이 뜨던 버그 — 1박 이상일 때만
    out.push({ k: 'wear', t: '날씨에 맞는 옷 준비' });
    return out;
  }
  function renderPrep() {
    var c = S.cond, d = P.dayCount(todayIso(), c.date) - 1;
    $('prepDday').textContent = d <= 0 ? '오늘!' : 'D-' + d;
    $('prepWhen').textContent = P.dateLabel(c.date) + (c.backDate !== c.date ? ' ~ ' + P.dateLabel(c.backDate) : '') + (compOf(c) && compOf(c) !== '혼자' ? ' · ' + compNames(c) + ' 함께' : '');
    var mk = marketPlace(), onMarket = mk && P.lastDigitDay(c.date, marketDigits());
    var rows = '';
    rows += (c.how === 'train' || c.backHow === 'train') ? factRow('기차표', realTrains(c) ? 'ok' : 'none', realTrains(c) ? '코레일 시간표를 확인했어요' : '아직 예매 전이에요 · 가까워지면 시간표가 나와요') : factRow('이동', 'ok', HOW_NAME[c.how] + '으로 와요');
    if (mk) rows += factRow('장날', 'ok', onMarket ? mk.short + ' 장날이에요' : mk.short + ' 장날이 아니에요 (3·8일)'); // 2026-10-21: 장날인지 아닌지는 날짜로 바로 계산되는 확정 사실 — 아니어도 "아직 몰라요"가 아님
    rows += factRow('행사', 'none', '아직 확인된 행사가 없어요');
    rows += factRow('붐빔 예측', S.crowd ? 'guess' : 'none', S.crowd ? '한국관광공사 예측이 코스에 반영됐어요' : '예측 자료는 날짜가 가까워지면 나와요');
    // 2026-10-21: /api/weather 는 "지금 날씨"(기상청 초단기실황)라 오늘이 아닌 날(여행 준비 화면은 늘 앞날)엔 보여 주면 틀린 값이 됨 — 오늘 날짜일 때만 실제 값을 보여줌
    var wxOk = S.wx && !S.wx.error && S.wx.temp != null && c.date === todayIso();
    rows += factRow('날씨', wxOk ? 'guess' : 'none', wxOk ? Math.round(S.wx.temp) + '℃' + (S.wx.text ? ' ' + S.wx.text : '') + ' (기상청 지금 날씨)' : '아직 예보가 없어요 (가까워지면 기상청 예보가 나와요)');
    if (isMulti() && S.plan && S.plan.stay) { // 2026-10-21: 여러 날이면 동선을 보고 숙소 권역을 스스로 추천(동네 탭에서 바꾸면 "추천" 대신 "정함"으로 표시)
      var sa = S.plan.stay, areaTxt = sa.area ? sa.area + ' 쪽' : sa.name;
      rows += factRow('숙소', S.stayAuto ? 'guess' : 'ok', (S.stayAuto ? areaTxt + '을 추천해요(동선을 보고 골랐어요 · ' + sa.name + ' 기준)' : sa.name + ' 쪽으로 정했어요') + ' · 코스 화면의 「동네」 탭에서 둘러보고 바꿀 수 있어요');
    }
    $('prepFacts').innerHTML = rows;
    $('prepTodo').innerHTML = prepTodoList(c).map(function (x) {
      var on = lsGet('tour.prep.' + x.k) === '1';
      return '<li><label class="todo-row"><input type="checkbox" data-todo="' + x.k + '"' + (on ? ' checked' : '') + '> ' + esc(x.t) + '</label></li>';
    }).join('');
    $('prepPreview').innerHTML = prepPreviewHtml(S.plan);
  }
  $('prepTodo').addEventListener('change', function (ev) { var t = ev.target.closest('[data-todo]'); if (!t) return; lsSet('tour.prep.' + t.getAttribute('data-todo'), t.checked ? '1' : '0'); });
  $('prepGoCourse').addEventListener('click', function () { show('s-course'); });
  $('prepNotify').addEventListener('click', function () { flash('여행 전날 알려 드릴게요 (시연 — 실제 알림은 아직 연결하지 않았어요).'); });

  /* ---------- 코스 화면 ---------- */
  var ART = window.TourArt;
  function ico(name) { return '<svg class="ic" aria-hidden="true"><use href="#i-' + name + '"/></svg>'; }
  function placeTags(s) {
    var p = s.place, b = [];
    // 2026-10-22: "꼭 갈 곳"으로 고른 게 코스에 들어갔을 때 바로 보이게(안 보이면 "골랐는데 반영이 안 됐다"고 느낌)
    if (!S.cond.must || S.cond.must.indexOf(p.id) < 0) { if (S.mustFoodNear && S.mustFoodNear[p.id]) b.push('<span class="tag good">#꼭갈곳 · 근처 ' + esc(S.mustFoodNear[p.id].join('·')) + '</span>'); }
    else b.push('<span class="tag good">#꼭갈곳으로고름</span>');
    if (p.region) b.push('<span class="tag">#' + esc(p.region) + '</span>');
    b.push(p.indoor ? '<span class="tag good">#실내</span>' : '<span class="tag">#야외</span>');
    if (p.stairs) b.push('<span class="tag warn">#계단있음</span>');
    else if (p.slope) b.push('<span class="tag warn">#오르막</span>');
    else if (p.stairsKnown === false) b.push('<span class="tag warn">#계단은확인필요</span>');
    else b.push('<span class="tag good">#계단없음</span>');
    if (p.dayRule) b.push('<span class="tag warn">#장날(3·8일)만</span>');
    if (p.trail) b.push('<span class="tag warn">#걷는길이길어요</span>');
    b.push('<span class="tag' + (p.확인필요 ? ' warn' : '') + '">#' + (p.확인필요 ? '운영대략' : '운영시간관광공사자료') + '</span>');
    if (s.wait) b.push('<span class="tag warn">#열때까지' + s.wait + '분기다림</span>');
    if (s.delay) b.push('<span class="tag bad">#붐빔제보 #기다림' + s.delay + '분</span>');
    if (S.fx && S.fx.view[p.id]) b.push('<span class="tag good">#풍경좋다는제보</span>');
    if (S.fx && S.fx.news[p.id]) b.push('<span class="tag good">#새볼거리제보</span>');
    if (s.done) b.push('<span class="tag good">#도착함</span>');
    b.push(edTags(s));
    if (s.pre && p.id === 'chuam') b.push('<span class="tag good">#새벽일출(어림시각)</span>');
    return b.join('');
  }
  /* 이동 글: planner 가 만든 moveText("걸어서 12분(실제 길)" · "버스 21-1번 18분 · 환승 0회" · "택시 약 9분(어림)"). 없으면 예전 글. */
  /* 시티투어 구간은 글을 두 줄로: 굵게 "몇 회차 몇 시 어디 탑승 → 어디 하차", 작게 걷기·기다림·버스 시간 */
  function mvHtml(s, mv, extra) {
    if (extra || !s.tour || s.mode !== 'tour') return esc(mv);
    var i = mv.indexOf(' (걸어서');
    var head = i > 0 ? mv.slice(0, i) : mv, tail = i > 0 ? mv.slice(i + 2, -1) : '';
    return '<span class="tourmv"><b>' + esc(head) + '</b>' + (tail ? '<small>' + esc(tail) + '</small>' : '') + '</span>';
  }
  function moveLine(s) { return s.moveText || ((s.mode === 'taxi' ? '택시 약 ' : '걸어서 ') + s.legMin + '분(어림)'); }
  /* 여러 날: 날마다 머리글("1일차 · 11월 14일(토)")과 숙소 안내 */
  function dayHeadHtml(d) {
    var pl = d.plan, sub;
    if (d.n === 1) sub = hhmm(pl.start) + ' ' + pl.startStation.name + '에서 출발';
    else if (d.sunrise) sub = '새벽 ' + hhmm(d.sunrise.depart) + ' 숙소 출발 · 추암 일출 ' + hhmm(d.sunrise.sunrise) + ' (계산한 어림값, 확인필요)';
    else sub = hhmm(pl.start) + ' ' + (d.n > 1 ? '숙소' : pl.startStation.name) + '에서 출발';
    return '<li class="dayhead"><div role="heading" aria-level="2" class="dh-t"><b>' + esc(d.label) + '</b><span>' + esc(sub) + '</span></div>' + (LV && !S.editing ? '<button type="button" class="eb daylive" data-live="' + (d.n - 1) + '" aria-label="' + esc(d.label) + ' 여행 길안내">이 날 여행 길안내</button>' : '') + '</li>';
  }
  function stayNoteHtml(d) {
    var st = d.stay, near = st.id === 'stay' && st.examples && st.examples.length;
    var arr = d.plan.back ? hhmm(d.plan.back.arrive) + ' 도착 · ' : '';
    var autoTag = (d.n === 1 && S.stayAuto) ? ' <span class="tag good">#동선보고추천</span>' : ''; // 2026-10-21: 올 예정 + 여러 날이면 동선 보고 스스로 고른 숙소 권역이라고 표시
    return '<li class="staynote"><b>오늘은 ' + esc(near ? st.name : '묵호역') + ' 근처에서 묵어요</b>' + autoTag + '<span>' + esc(arr) + (near ? '숙소 예: ' + st.examples.map(esc).join(' · ') : '숙소 자료가 없어 묵호역 둘레로 잡았어요') + '</span><small>' + (near ? '출처: ' + esc(st.source) + ' · ' : '') + '예약·요금은 직접 확인 · 별점·광고 없음 · 「동네」 탭에서 바꿀 수 있어요</small></li>';
  }
  /* 이야기 장 한 개 = 게시물 한 개 */
  /* 시티투어 줄: 눈에 띄는 예약 안내(공식 사이트 단추) + 시간표 단추 */
  function tourBlock(s) {
    if (!CT || !OV || !s || s.mode !== 'tour' || !s.tour) return '';
    return OV.reserveHtml(CT, true) + '<p class="tt-row"><button type="button" class="eb tt-open" data-ttopen="' + esc(s.id) + '">시티투어 시간표 보기</button></p>';
  }
  /* 접힌 한 줄: 번호 · 이름 · 도착 시각 · 오는 방법(작은 그림). 누르면 아래 게시물 전체가 펼쳐진다(한 번에 하나) */
  var MVIC = {
    walk: '<circle cx="13" cy="4.5" r="2"/><path d="M12 8l-2 4 3 3 1 5M12 8l4 3 2 1M10 12l-3 6"/>',
    taxi: '<path d="M4 15l1.5-5h13L20 15v4H4zM7 10l1-3h8l1 3M7 19v1.5M17 19v1.5"/><circle cx="8" cy="15" r=".8"/><circle cx="16" cy="15" r=".8"/>',
    car: '<path d="M4 15l1.5-5h13L20 15v4H4zM7 10l1-3h8l1 3M7 19v1.5M17 19v1.5"/><circle cx="8" cy="15" r=".8"/><circle cx="16" cy="15" r=".8"/>',
    bus: '<rect x="5" y="4" width="14" height="14" rx="3"/><path d="M5 11h14M8 21v-3M16 21v-3"/><circle cx="8.5" cy="14.5" r=".8"/><circle cx="15.5" cy="14.5" r=".8"/>',
    tour: '<rect x="3" y="6" width="18" height="12" rx="3"/><path d="M3 12h18M8 6v6M13 6v6M7 21v-3M17 21v-3"/>'
  };
  function mvShort(s) {
    var m = s.mode, n = s.legMin;
    var t = m === 'tour' ? '시티투어' : m === 'taxi' ? '택시' : m === 'bus' ? '버스' : m === 'car' ? '자가용' : '걸어서';
    return t + (n ? ' ' + n + '분' : '');
  }
  /* 코스 카드(2026-10-21 시안): 사진은 늘 보이고, 그 아래 [종류 색 번호 핀 · 시각 · 종류] · 장소 이름(누르면 자세히) · 100×100 · 이동 줄.
     번호 핀은 사진 위에 얹지 않는다(공공누리 제3유형 사진 위에는 글·배지를 두지 않는 규칙). 자세한 내용(이야기·묻기·태그·운영 시간)은 p-body 에 접어 둔다 */
  // 2026-10-22(Fable 5.1 독립 검토로 찾은 문제): "꼭 갈 곳" 표는 접힌 카드엔 하나도 안 보이고 "자세히 보기"를 펼쳐야만,
  // 그것도 해시태그 줄(#묵호 #야외 #계단없음 사이)에 섞여서만 보여서 — 실제로는 반영됐어도 사용자 눈엔 "반영 안 됨"으로 보이던 원인.
  // 그래서 접힌 머리에도(다른 배지들과 같은 자리) 바로 보이는 ⭐ 배지를 추가한다.
  function mustBadgeHtml(p) {
    if (S.cond.must && S.cond.must.indexOf(p.id) >= 0) return '<span class="must-badge">⭐ 꼭 갈 곳</span>';
    if (S.mustFoodNear && S.mustFoodNear[p.id]) return '<span class="must-badge">⭐ 근처: ' + esc(S.mustFoodNear[p.id].join('·')) + '</span>';
    return '';
  }
  function foldHead(p, i, when, s, tomorrow, changed, num, open) {
    var mode = s && s.mode && MVIC[s.mode] ? s.mode : 'walk';
    var mv = tomorrow ? '' : '<span class="p-mv"><svg class="ic mvic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + MVIC[mode] + '</svg><span>' + esc(mvShort(s)) + '</span></span>';
    var ck = CAT[catOf(p)], n = num || i + 1, mustBadge = mustBadgeHtml(p);
    return '<div class="c-meta"><span class="c-pin" style="background:' + ck.c + '" aria-hidden="true"><span>' + n + '</span></span><span class="c-when">' + esc(when) + ' · ' + esc(ck.n) + '</span>' + (tomorrow ? '' : crowdHtml(s)) + '</div>' +
      '<h3 class="p-h"><button type="button" class="p-head p-tog" data-fold="' + i + '" aria-expanded="' + (open ? 'true' : 'false') + '" aria-controls="pb-' + i + '">' +
      '<span class="pt"><span class="p-t"><span class="visually-hidden">' + n + '장 · </span>' + esc(p.name) + '</span><span class="p-sub">자세히 보기</span></span>' +
      '<svg class="ic chev" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button></h3>' +
      ((PK.has(p.id) || changed || mustBadge) ? '<div class="c-badges">' + pickHtml(p) + (changed ? '<span class="new-badge">방금 바뀜</span>' : '') + mustBadge + '</div>' : '') + mv;
  }
  /* 접힌 장은 사용자가 다시 누를 때까지 열린 채로 둔다: 여러 개를 동시에 열 수 있고, 다시 그려도(날씨·시간표·길안내·미리 보기·날짜 탭) 열린 장은 S.openFold 에서 되살린다 */
  function foldSet(li, open) {
    var b = li && li.querySelector('.p-tog'), body = li && li.querySelector('.p-body'); if (!b || !body) return;
    body.hidden = !open; b.setAttribute('aria-expanded', open ? 'true' : 'false'); li.classList.toggle('open', !!open);
    var id = li.getAttribute('data-id'); if (id) { if (open) S.openFold[id] = true; else delete S.openFold[id]; }
  }
  function foldOpen(id, scroll) {
    S.openFold[id] = true; // 지금 안 그려져 있어도(다른 날 탭) 열린 채로 기억
    var li = document.querySelector('#timeline .chap[data-id="' + id + '"]'); if (!li) return null;
    foldSet(li, true);
    if (scroll) { try { li.scrollIntoView({ block: 'start' }); } catch (e) { /* 무시 */ } }
    return li;
  }
  function chapterHtml(s, i, extra) {
    if (isSlot(s)) return slotHtml(s, i);
    var p = s.place, st = AI.aiStory(p, S.cond), isOpen = !extra && !!S.openFold[p.id], num = extra ? extra.num : NUMS[s.id];
    var mv = extra ? extra.move : moveLine(s);
    var when = extra ? extra.when : (hhmm(s.arrive) + ' 도착 · ' + p.visit + '분' + (s.delay ? ' (+기다림 ' + s.delay + '분)' : ''));
    var changed = S.changed[s.id] ? ' changed' : '';
    var liked = !!S.liked[p.id];
    var qs = (p.qa || []).map(function (x, k) { return '<button type="button" class="btn" data-act="q" data-id="' + p.id + '" data-k="' + k + '">' + esc(x.q) + '</button>'; }).join('');
    var nb = extra ? '' : nearBtnHtml(s);
    return '<li class="chap post fold card' + changed + (isOpen ? ' open' : '') + '" data-id="' + p.id + '">' +
      artFig(p) + '<div class="c-info">' + foldHead(p, i, when, s, !!extra, changed, num, isOpen) + '</div>' + (nb ? '<div class="c-quick">' + nb + '</div>' : '') +
      '<div class="p-body" id="pb-' + i + '"' + (isOpen ? '' : ' hidden') + '>' +
      '<div class="p-acts">' +
      '<button type="button" class="ico" data-act="like" data-id="' + p.id + '" aria-pressed="' + liked + '" aria-label="좋아요" title="좋아요">' + ico('heart') + '</button>' +
      '<button type="button" class="ico" data-act="ask" data-id="' + p.id + '" aria-label="도째비에게 묻기" title="도째비에게 묻기" aria-expanded="false">' + ico('chat') + '</button>' +
      '<button type="button" class="ico" data-act="listen" data-id="' + p.id + '" data-label="이야기 듣기" aria-label="이야기 듣기" title="이야기 듣기">' + ico('sound') + '</button>' +
      '<span class="gap"></span>' +
      (extra || S.ed || (S.plan && S.plan.multi) ? '' : '<button type="button" class="ico pin" data-act="arrive" data-i="' + i + '" aria-label="여기 왔어요" title="여기 왔어요">' + ico('pin') + '<span>여기 왔어요</span></button>') +
      '</div>' +
      '<div class="ask" hidden data-ask="' + p.id + '"><div class="qs">' + qs + '</div>' +
      '<div class="askrow"><input type="text" data-in="' + p.id + '" placeholder="직접 물어보기" aria-label="도째비에게 직접 묻기"><button type="button" class="btn" data-act="qsend" data-id="' + p.id + '">묻기</button></div>' +
      '<div class="answer" hidden data-ans="' + p.id + '" aria-live="polite"></div></div>' +
      '<div class="p-cap"><div class="cl"><b>도째비</b>' + esc(st.text) + '</div></div>' +
      '<p class="p-src">출처: ' + esc(st.source) + '</p>' +
      '<p class="tags">' + (extra ? '<span class="tag warn">#내일일출(예시시각)</span>' : placeTags(s)) + '</p>' + (extra ? '' : crowdBody(s)) +
      '<p class="p-hours">' + mvHtml(s, mv, extra) + (extra ? '' : (s.mode === 'tour' ? '<br>' : ' · ') + '운영 ' + esc(p.openText) + (p.restText ? ' · 쉬는 날 ' + esc(p.restText) : '')) + '</p>' +
      (extra ? '' : tourBlock(s) + kmapHtml(s)) + wcLineHtml(p) +
      '</div></li>';
  }
  /* 접힌 장 누름: 그 장만 열고 닫는다(다른 장은 건드리지 않음) */
  /* 카카오맵 길안내 단추: 앞 장(첫 장이면 출발 역)에서 이 장까지, 이동 수단에 맞춰(걷기 · 대중교통 · 자동차 · 시티투어는 정류장까지 걷기) */
  function prevPlaceOf(s) {
    var pl = S.plan; if (!pl || !s) return null;
    var fl = pl.multi ? pl.days.map(function (d) { return d.plan; }) : [pl];
    for (var i = 0; i < fl.length; i++) { var st = fl[i].stops; for (var k = 0; k < st.length; k++) if (st[k].id === s.id) { var q = k - 1; while (q >= 0 && isSlot(st[q])) q--; return q >= 0 ? st[q].place : fl[i].startStation; } }
    return null;
  }
  /* ---------- 근처 볼거리 (2026-10-21) — 게시물의 "근처 볼거리 ○곳 더 보기" → 지도 탭에서 그 둘레의 코스 밖 볼거리를 보고 바로 코스에 넣는다 (머무는 여행) ---------- */
  var NEAR_M = 2000; // 게시물 단추에 세는 범위(직선 2km)
  function courseIds() {
    var m = {}, pl = S.plan; if (!pl) return m;
    (pl.multi ? pl.days.reduce(function (a, d) { return a.concat(d.plan.stops); }, []) : pl.stops).forEach(function (x) { if (x.place && !x.place.slot) m[x.place.id] = 1; });
    if (pl.tomorrow && pl.tomorrow.place) m[pl.tomorrow.place.id] = 1;
    return m;
  }
  function nearSpots(pt, maxM) {
    var have = courseIds();
    return D.places.filter(function (q) { return !have[q.id] && q.id !== pt.id; })
      .map(function (q) { return { p: q, m: FU ? FU.dist(pt.lat, pt.lng, q.lat, q.lng) : 0 }; })
      .filter(function (x) { return maxM == null || x.m <= maxM; })
      .sort(function (a, b) { return a.m - b.m; });
  }
  function nearBtnHtml(s) {
    if (!s || !s.place || s.place.slot) return '';
    var n = nearSpots(s.place, NEAR_M).length; if (!n) return '';
    return '<p class="p-near"><button type="button" class="btn near-btn" data-act="near" data-id="' + esc(s.place.id) + '">' + ico('pin') + '<span>근처 볼거리 ' + n + '곳 더 보기</span></button></p>';
  }
  function dayOfPlace(id) {
    var pl = S.plan; if (!pl || !pl.multi) return 0;
    for (var i = 0; i < pl.days.length; i++) if (pl.days[i].plan.stops.some(function (x) { return x.place && x.place.id === id; })) return i;
    return S.dayTab || 0;
  }
  /* 코스 밖 볼거리를 코스에 넣는다: 코스 고치기와 같은 계산(editor.js bestInsert — 가장 덜 돌아가는 자리)으로 넣고, 홈에서 그 장을 펼쳐 보여 준다 */
  function spotAdd(pid) {
    if (!S.plan || !PLACE[pid]) return false;
    if (courseIds()[pid]) { flash('이미 코스에 있어요'); return false; }
    edStart(); if (!S.ed) return false;
    var di = S.plan.multi ? Math.max(0, Math.min(S.plan.days.length - 1, S.spotDay || 0)) : 0;
    var b = ED.bestInsert(edEnv(), S.ed.hist.cur, di, pid);
    if (!b || !b.r || !b.r.spec) { flash('넣을 자리를 못 찾았어요'); return false; }
    S.poiSel = null;
    edApply(b.r.spec, PLACE[pid].short + ' 넣었어요' + (b.r.blocked ? ' · 시간이 빠듯해요. 코스 고치기에서 확인해 주세요' : ''), [pid]);
    if (S.plan.multi) S.dayTab = di;
    show('s-course');
    setTimeout(function () { foldOpen(pid, true); }, 30);
    return true;
  }
  function kmapHtml(s) {
    if (!LV || !s || !s.place) return '';
    var prev = prevPlaceOf(s); if (!prev) return '';
    var l = LV.legLink(prev, { place: s.place, leg: { mode: s.mode, tour: s.tour } }, null);
    return '<p class="kmap-row"><a class="kmap" href="' + esc(l.url) + '" target="_blank" rel="noopener">' + ico('pin') + '<span>' + esc(l.label) + '</span></a></p>';
  }


  /* 끼니 시간 = 한 줄. 특정 식당을 정해 주지 않고, 그 시간대에 앞 장소 근처에서 먹도록 시간만 잡아 둔다. 식당은 지도 탭에서 직접 고른다. */
  function slotHtml(s, i) {
    var p = s.place, nm = slotName(p.id), near = p.base && p.base.short ? p.base.short : (p.base && p.base.name ? p.base.name.replace(/역$/, '') : '');
    var changed = S.changed[s.id] ? ' changed' : '';
    return '<li class="chap post slot' + changed + '" data-id="' + esc(p.id) + '" data-slot="' + esc(P.slotKindOf(p.id) || '') + '">' +
      '<div class="slot-row"><span class="slot-ic" aria-hidden="true"><svg viewBox="0 0 24 24" class="ic"><path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2.5 1.5-3.5 5-3.5 8H17"/></svg></span>' +
      '<div class="slot-t"><b>' + esc(nm) + ' ' + esc(slotRange(s)) + '</b><span>' + esc(near ? near + ' 근처에서 ' + nm + ' 드시는 시간이에요' : nm + ' 드시는 시간이에요') + (s.wait ? ' · ' + hhmm(s.arrive) + '부터 ' + s.wait + '분 쉬어 가요' : '') + '</span></div></div>' +
      '<div class="slot-acts"><button type="button" class="btn slot-map" data-slotmap="' + esc(p.id) + '">' + ico('pin') + '<span>근처 식당 지도에서 보기</span></button></div>' +
      '</li>';
  }

  /* ---------- 코스 고치기 (2026-10-17) — 자동으로 짠 코스를 직접 고친다. 계산(시각·마감·고치는 방법)은 editor.js, 말로 고치기는 ai.js aiEditIntent ----------
     고친 내용(spec)은 되돌리기 기록과 함께 localStorage(tour.edit.v1.<여행 조건>)에 저장돼, 새로 고쳐도 같은 조건이면 그대로 불러온다. */
  var K_EDLAST = 'tour.edit.last.v2', ED_KEY = 'tour.edit.v2.'; // v2: 식당 장 없앤 뒤(10/18) — 예전 v1 고친 코스는 읽지 않는다
  var EDSTORE = { get: lsGet, set: lsSet, del: lsDel };
  S.ed = null; S.editing = false;
  // 2026-10-22(Fable 5.1 독립 검토로 찾은 문제): must(꼭 갈 곳)가 서명에 없어서, 전에 고쳐 둔 코스가 있으면 같은 날짜·시간·동행 조건이라고 보고
  // edRestore() 가 must 없는 옛 코스를 그대로 되살려 버려 — 방금 고른 맛집·카페가 반영 안 된 것처럼 보이던 또 다른 원인. must 도 서명에 넣어 막는다.
  function edSig() { var c = S.cond; return ED.sigOf({ date: c.date, backDate: c.backDate, arrive: c.arrive, back: c.back, noLimit: c.noLimit, how: c.how, backHow: c.backHow, end: c.end, companions: c.companions, knee: c.knee, interests: c.interests, rain: c.rain, food: c.food, foodWord: c.foodWord, loop: !!S.tourLoop, stay: S.stayPick ? S.stayPick.name : '', must: (c.must || []).join(',') }); }
  function edEnv() { return { D: D, o: planOpts(), frame: S.ed.frame }; }
  function edRetimed() { return ED.retime(edEnv(), S.ed.hist.cur); }
  function edDirty() { return !!S.ed && JSON.stringify(S.ed.hist.cur) !== JSON.stringify(ED.fromPlan(S.ed.frame)); }
  function edPersist() {
    if (!S.ed) return;
    var sig = edSig(), key = ED_KEY + sig;
    if (edDirty()) { ED.save(EDSTORE, key, S.ed.hist); lsSet(K_EDLAST, JSON.stringify({ sig: sig, cond: S.cond, loop: !!S.tourLoop })); }
    else { lsDel(key); var l = jget(K_EDLAST, null); if (l && l.sig === sig) lsDel(K_EDLAST); }
  }
  /* 코스를 새로 짠 직후: 같은 조건으로 고쳐 둔 코스가 저장돼 있으면 불러온다(S.plan 은 방금 짠 자동 코스 = 기준 틀) */
  function edRestore() {
    S.ed = null; S.editing = false;
    var h = ED.load(EDSTORE, ED_KEY + edSig(), 50); if (!h) return;
    S.ed = { frame: S.plan, hist: h, fixes: null, nl: null };
    if (!edDirty()) { S.ed = null; return; }
    S.plan = edRetimed(); S.changed = {}; renderCourse();
  }
  function edBootRestore() {
    var last = jget(K_EDLAST, null); if (!last || !last.cond || !last.sig) return;
    if (!ED.load(EDSTORE, ED_KEY + last.sig, 50)) return;
    try {
      S.cond = Object.assign(freshCond(), last.cond); S.tourLoop = !!last.loop;
      makeCourse(true, true);
      if (S.ed) flash('고친 코스를 다시 불러왔어요');
    } catch (e) { // 저장된 고친 코스가 지금 앱과 안 맞으면 버리고 첫 화면으로
      lsDel(K_EDLAST); lsDel(ED_KEY + last.sig); S.ed = null; S.cond = freshCond(); show('s-start');
    }
  }
  function edStart() {
    if (S.ed || !S.plan) return;
    if (S.fixed.length) { S.fixed = []; S.simNow = S.cond.arrive; lsSet(K_SIM, String(S.simNow)); recomputeFx(); S.plan = buildPlan(); } // "여기 왔어요" 표시는 고치기 전에 풀린다
    S.ed = { frame: S.plan, hist: new ED.History(ED.fromPlan(S.plan), 50), fixes: null, nl: null };
    S.plan = edRetimed(); // 고치는 줄에 쓰는 값(머무는 분 등)이 든 계산 결과로 바꿔 둔다 (시각은 자동 코스와 같음)
  }
  function edAfter(msg, hl, quiet) {
    S.changed = {}; (hl || []).forEach(function (id) { S.changed[id] = true; });
    S.plan = edRetimed(); S.ed.nl = null; S.ed.fixes = null;
    edPersist(); renderCourse();
    if (msg && !quiet) snack(msg);
  }
  function edApply(spec, msg, hl) { if (!S.ed || !spec) return false; S.ed.hist.push(spec); edAfter(msg, hl); return true; }
  function pnm(id) { return P.isSlotId(id) ? slotName(id) + ' 시간' : (PLACE[id] ? PLACE[id].short : id); }

  /* 말 풍선 아래 작은 되돌리기 알림 */
  var snackT = null;
  function snack(msg) {
    var s = $('edSnack'); $('edSnackTxt').textContent = msg; $('edSnackUndo').hidden = !(S.ed && S.ed.hist.canUndo()); s.hidden = false;
    clearTimeout(snackT); snackT = setTimeout(function () { s.hidden = true; }, 7000);
  }
  function hideSnack() { var s = $('edSnack'); if (s) s.hidden = true; clearTimeout(snackT); }

  /* 고칠 때만 쓰는 장 줄 / 사이 단추 */
  function edTags(s) {
    var b = [];
    if (s.pin) b.push('<span class="tag good">#내가고정</span>');
    (s.issues || []).forEach(function (x) {
      if (x.kind === 'closed') b.push('<span class="tag bad">#문닫기전에못끝남</span>');
      else if (x.kind === 'off') b.push('<span class="tag bad">#오늘열지않아요</span>');
      else if (x.kind === 'brk') b.push('<span class="tag bad">#쉬는시간에걸림</span>');
      else if (x.kind === 'fxclosed') b.push('<span class="tag bad">#휴무제보</span>');
    });
    return b.join('');
  }
  function edAddHtml(di, at, n) {
    var lab = at === 0 ? '맨 처음에 장소 넣기' : at >= n ? '맨 끝에 장소 넣기' : at + '번째 장 다음에 장소 넣기';
    return '<li class="edadd"><button type="button" class="eb add" data-ed="add" data-di="' + di + '" data-at="' + at + '" aria-label="' + esc(lab) + '"><span aria-hidden="true">＋</span> 여기에 장소 넣기</button></li>';
  }
  function editRowHtml(s, gi, di, k, n) {
    var p = s.place, meal = isSlot(s), bad = (s.issues || []).some(function (x) { return x.level === 'block'; });
    var sub = hhmm(s.arrive) + ' 도착 · ' + s.visit + '분 머물러요' + (s.wait ? ' (열 때까지 ' + s.wait + '분)' : '') + (s.delay ? ' (+기다림 ' + s.delay + '분)' : '');
    var iss = (s.issues || []).filter(function (x) { return x.kind !== 'wait' && x.kind !== 'fxcrowd'; }).map(function (x) { return '<p class="er-iss ' + (x.level === 'block' ? 'bad' : 'warn') + '">' + esc(x.text) + '</p>'; }).join('');
    var nmq = esc(p.name);
    return '<li class="chap edrow' + (s.pin ? ' pinned' : '') + (bad ? ' bad' : '') + (S.changed[s.id] ? ' changed' : '') + '" data-id="' + p.id + '" data-di="' + di + '" data-k="' + k + '">' +
      '<div class="er-top"><span class="er-av">' + (meal ? '<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2.5 1.5-3.5 5-3.5 8H17"/></svg>' : ART.svg(p.id)) + '</span><div class="er-t"><b>' + (meal ? '' : '<span class="er-n">' + (NUMS[s.id] || gi + 1) + '</span> ') + nmq + '</b><span class="er-sub">' + esc(sub) + '</span><span class="er-mv">' + esc(meal ? '앞 장소 근처 · 식당은 지도에서 직접 골라요' : moveLine(s)) + '</span></div>' +
      (meal ? '<span class="er-chip">식사 시간</span>' : '') + (s.pin ? '<span class="er-chip pin">📌 고정</span>' : '') + '</div>' + iss +
      '<div class="er-btns" role="group" aria-label="' + nmq + ' 고치기">' +
      '<button type="button" class="eb" data-ed="up"' + (k === 0 ? ' disabled' : '') + ' aria-label="' + nmq + ' 위로 올리기"><span aria-hidden="true">↑</span> 위로</button>' +
      '<button type="button" class="eb" data-ed="down"' + (k >= n - 1 ? ' disabled' : '') + ' aria-label="' + nmq + ' 아래로 내리기"><span aria-hidden="true">↓</span> 아래로</button>' +
      '<button type="button" class="eb" data-ed="rm" aria-label="' + nmq + ' 코스에서 빼기">빼기</button>' +
      '<button type="button" class="eb" data-ed="less"' + (s.visit <= ED.VISIT_MIN ? ' disabled' : '') + ' aria-label="' + nmq + ' 머무는 시간 10분 줄이기">− 10분</button>' +
      '<button type="button" class="eb" data-ed="more"' + (s.visit >= ED.VISIT_MAX ? ' disabled' : '') + ' aria-label="' + nmq + ' 머무는 시간 10분 늘리기">+ 10분</button>' +
      (meal ? '' : '<button type="button" class="eb' + (s.pin ? ' on' : '') + '" data-ed="pin" aria-pressed="' + (s.pin ? 'true' : 'false') + '" aria-label="' + nmq + ' 자리 고정"><span aria-hidden="true">📌</span> 고정</button>') +
      '</div></li>';
  }

  /* 아래 고정 바(2026-10-21 시안): 「코스 고치기」(위 고치기 단추와 같은 일) + 하루 여행일 때만 「하루 더 머물면」 제안 → 고치기 안의 「더 머물면? (막차 · 하룻밤)」을 연다 */
  function cBarUi(on, label) {
    var e = $('cBarEdit'); if (!e) return;
    e.textContent = label; e.setAttribute('aria-pressed', on ? 'true' : 'false');
    var pl = S.plan; $('cBarStay').hidden = !pl || !!pl.multi || S.mode === 'night' || on;
  }
  $('cBarEdit').addEventListener('click', function () { $('editBtn').click(); });
  $('cBarStay').addEventListener('click', function () {
    if (!S.editing) $('editBtn').click();
    var d = $('stayDet'); if (!d) return;
    d.open = true; renderStay();
    try { d.scrollIntoView({ block: 'start' }); } catch (e) { /* 무시 */ }
  });
  /* 위쪽: 고치기 단추 · 되돌리기 줄 · 마감 경고 + 한 번 눌러 고치기 */
  function renderEdUi() {
    var on = !!(S.editing && S.ed), eb = $('editBtn');
    eb.setAttribute('aria-pressed', on ? 'true' : 'false');
    eb.textContent = on ? '고치기 끝내기' : (S.ed && edDirty() ? '코스 더 고치기' : '코스 고치기');
    cBarUi(on, eb.textContent);
    $('edPanel').hidden = !on;
    if (on && $('stayDet').open) renderStay();
    if (on) { $('edUndo').disabled = !S.ed.hist.canUndo(); $('edRedo').disabled = !S.ed.hist.canRedo(); $('edReset').disabled = !edDirty(); }
    var w = $('edWarn');
    if (!S.ed || !S.plan || !S.plan.edited) { w.hidden = true; w.innerHTML = ''; return; }
    var bl = ED.blocks(S.plan).sort(function (x, y) { return (y.kind === 'deadline') - (x.kind === 'deadline'); }); // 마감 문제를 맨 위에
    if (!bl.length) { w.hidden = true; w.innerHTML = ''; S.ed.fixes = null; return; }
    var fx = ED.fixes(edEnv(), S.ed.hist.cur); S.ed.fixes = fx.fixes;
    var more = bl.slice(1, 4).map(function (x) { return '<p class="ew-p">' + esc(x.text) + '</p>'; }).join('') + (bl.length > 4 ? '<p class="ew-p">외 ' + (bl.length - 4) + '건</p>' : '');
    w.innerHTML = '<div class="ew-h"><span class="ew-ic" aria-hidden="true">!</span><b>' + esc(bl[0].text) + '</b></div>' + more +
      (fx.fixes.length ? '<p class="ew-q">한 번 눌러서 고치기</p><div class="ew-fx">' + fx.fixes.map(function (f, i) { return '<button type="button" class="ew-b" data-fix="' + i + '"><b>' + esc(f.label) + '</b><small>' + esc(f.detail) + (f.partial ? ' · 일부만 풀려요' : '') + '</small></button>'; }).join('') + '</div>' : '<p class="ew-p">한 번에 고칠 방법을 못 찾았어요. 📌 고정을 풀거나 직접 빼 주세요.</p>');
    w.hidden = false;
  }
  $('edWarn').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-fix]'); if (!b || !S.ed || !S.ed.fixes) return;
    var f = S.ed.fixes[+b.getAttribute('data-fix')]; if (!f) return;
    edApply(f.spec, f.label + ' 적용했어요');
  });
  $('editBtn').addEventListener('click', function () {
    if (!S.plan) return;
    if (S.editing) { S.editing = false; closeSheet(true); if (S.ed && !edDirty()) { S.ed = null; } renderCourse(); return; }
    edStart(); S.editing = true; renderCourse();
    var p = $('edPanel'); if (p && p.scrollIntoView) p.scrollIntoView({ block: 'nearest' });
  });
  $('edUndo').addEventListener('click', function () { if (S.ed && S.ed.hist.undo()) edAfter('되돌렸어요', null, true); });
  $('edRedo').addEventListener('click', function () { if (S.ed && S.ed.hist.redo()) edAfter('다시 했어요', null, true); });
  $('edSnackUndo').addEventListener('click', function () { hideSnack(); if (S.ed && S.ed.hist.undo()) { edAfter('', null, true); flash('되돌렸어요'); } });
  $('edReset').addEventListener('click', function () {
    if (!S.ed) return;
    S.ed.hist.push(ED.fromPlan(S.ed.frame)); edAfter('처음 코스로 돌아왔어요');
  });
  $('edReplan').addEventListener('click', function () {
    if (!S.ed) return;
    var spec = S.ed.hist.cur, env = edEnv(), ok = false, why = '';
    for (var di = 0; di < spec.days.length; di++) { var r = ED.replan(env, spec, di); if (r.ok) { spec = r.spec; ok = true; } else why = r.why; }
    if (!ok) { flash(why || '다시 짜지 못했어요'); return; }
    if (JSON.stringify(spec) === JSON.stringify(S.ed.hist.cur)) { flash('이미 가장 좋은 짜임이에요'); return; }
    edApply(spec, '나머지를 다시 짰어요 (📌 고정은 그대로)');
  });

  /* 줄(장) 단추: 위·아래·빼기·시간·고정·장소 넣기 */
  $('timeline').addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-ed]'); if (!b || !S.ed || b.disabled) return;
    var act = b.getAttribute('data-ed'), row = b.closest('.edrow'), cur = S.ed.hist.cur, env = edEnv();
    if (act === 'add') { openSheet(+b.getAttribute('data-di'), +b.getAttribute('data-at'), b); return; }
    if (!row) return;
    var id = row.getAttribute('data-id'), di = +row.getAttribute('data-di'), k = +row.getAttribute('data-k');
    if (act === 'up' || act === 'down') edApply(ED.moveItem(cur, di, k, act === 'up' ? -1 : 1), pnm(id) + (act === 'up' ? ' 위로 옮겼어요' : ' 아래로 옮겼어요'), [id]);
    else if (act === 'rm') edApply(ED.removeItem(cur, id), pnm(id) + ' 뺐어요');
    else if (act === 'less' || act === 'more') {
      var n = ED.adjustVisit(env, cur, id, act === 'less' ? -10 : 10);
      if (n) edApply(n, pnm(id) + ' 머무는 시간 ' + (act === 'less' ? '−10분' : '+10분')); else flash('더는 못 바꿔요 (' + ED.VISIT_MIN + '~' + ED.VISIT_MAX + '분)');
    } else if (act === 'pin') {
      var f = ED.findItem(cur, id), on = f && !f.it.pin;
      edApply(ED.setPin(cur, id), on ? pnm(id) + ' 자리를 고정했어요 (다시 짜도 그대로)' : pnm(id) + ' 고정을 풀었어요');
    }
    // 단추가 새로 그려져도 같은 자리를 다시 짚도록
    var again = document.querySelector('.edrow[data-id="' + id + '"] [data-ed="' + act + '"]');
    if (again && !again.disabled) { try { again.focus({ preventScroll: true }); } catch (e) { /* 무시 */ } }
  });

  /* ---------- 장소 넣기 (아래에서 올라오는 창) ---------- */
  var SH = { di: 0, at: 0, opener: null, t: null, f: 'all' };
  /* 장소 넣기 창의 골라 보기 칩(2026-10-21): 장소 자료에 이미 있는 값으로만 가른다 — 바다(이름), 실내(indoor), 노을·저녁(태그 노을 · 저녁 장터) */
  var SH_F = {
    all: function () { return true; },
    sea: function (p) { return /해변|해수욕장|항|촛대바위|등대|바다/.test(p.name || ''); },
    indoor: function (p) { return !!p.indoor; },
    eve: function (p) { return (p.tags || []).indexOf('노을') >= 0 || !!p.evening; }
  };
  var SH_FN = { all: '', sea: '바다', indoor: '실내', eve: '노을·저녁' };
  function shChipsUi() { Array.prototype.forEach.call(document.querySelectorAll('#shChips [data-shf]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-shf') === SH.f ? 'true' : 'false'); }); }
  function sheetWhere() {
    var pl = S.plan, day = pl.multi ? pl.days[SH.di].plan : pl, prev = day.stops[SH.at - 1], next = day.stops[SH.at];
    var head = pl.multi ? (SH.di + 1) + '일차 · ' : '';
    if (!day.stops.length) return head + '아직 장이 없어요. 첫 장으로 넣어요';
    if (!prev) return head + '「' + next.place.short + '」 앞(맨 처음)에 넣어요';
    if (!next) return head + '「' + prev.place.short + '」 다음(맨 끝)에 넣어요';
    return head + '「' + prev.place.short + '」과 「' + next.place.short + '」 사이에 넣어요';
  }
  function openSheet(di, at, opener) {
    SH.di = di; SH.at = at; SH.opener = opener || null;
    $('shQ').value = ''; SH.f = 'all'; shChipsUi(); $('shWhere').textContent = sheetWhere(); renderSheet();
    $('addSheet').hidden = false; document.body.classList.add('sh-open');
    var c = $('shCard'); c.scrollTop = 0; try { c.focus(); } catch (e) { /* 무시 */ }
  }
  function closeSheet(silent) {
    var s = $('addSheet'); if (!s || s.hidden) return;
    s.hidden = true; document.body.classList.remove('sh-open');
    var o = SH.opener; SH.opener = null;
    if (!silent && o && document.body.contains(o)) { try { o.focus(); } catch (e) { /* 무시 */ } }
  }
  function renderSheet() {
    if (!S.ed) return;
    var q = $('shQ').value.trim(), fn = SH_F[SH.f] || SH_F.all, list = ED.suggest(edEnv(), S.ed.hist.cur, SH.di, SH.at, q).filter(function (c) { return fn(c.place); }), shown = (q || SH.f !== 'all') ? list.slice(0, 30) : list.slice(0, 8);
    $('shHint').textContent = (q || SH.f !== 'all') ? ((SH_FN[SH.f] ? SH_FN[SH.f] + ' · ' : '') + '찾은 곳 ' + list.length + '곳' + (list.length > shown.length ? ' (앞 ' + shown.length + '곳만)' : '') + ' · 길을 덜 돌아가는 순') : '길을 덜 돌아가는 순서로 보여 드려요. 이름으로 찾을 수도 있어요.';
    $('shList').innerHTML = shown.length ? shown.map(function (c) {
      var p = c.place, ev = c.cautions.map(function (x) { return '<span class="sh-w ' + (x.level === 'block' ? 'bad' : 'warn') + '">' + esc(x.text) + '</span>'; }).join('');
      var tags = pickHtml(p, 'sh-t') + [p.region || '', p.indoor ? '실내' : '야외'].filter(Boolean).map(function (t) { return '<span class="sh-t">#' + esc(t) + '</span>'; }).join('');
      return '<li><button type="button" class="sh-item' + (c.blocked ? ' warnitem' : '') + '" data-pick="' + p.id + '"><span class="sh-top"><b>' + esc(p.name) + '</b><span class="sh-cost">길 돌아가기 +' + c.detour + '분</span></span>' +
        '<span class="sh-meta">' + tags + '<span class="sh-t">' + hhmm(c.arrive) + ' 도착 · ' + c.visit + '분 머물러요</span><span class="sh-t">운영 ' + esc(p.openText || '') + '</span></span>' + ev + '<span class="sh-go">' + (c.blocked ? '그래도 넣기' : '넣기') + '</span></button></li>';
    }).join('') : '<li class="sh-none">' + (SH.f !== 'all' && !q ? '이 묶음에서 더 넣을 곳이 없어요. 「전체」를 눌러 보세요.' : '찾는 곳이 없어요. 다른 낱말로 찾아 보세요 (예: 등대, 해변, 시장).') + '</li>';
  }
  $('shQ').addEventListener('input', function () { clearTimeout(SH.t); SH.t = setTimeout(renderSheet, 160); });
  $('shChips').addEventListener('click', function (ev) { var b = ev.target.closest('[data-shf]'); if (!b) return; SH.f = b.getAttribute('data-shf'); shChipsUi(); renderSheet(); });
  $('addSheet').addEventListener('click', function (ev) {
    if (ev.target.closest('[data-sh="close"]')) { closeSheet(); return; }
    var b = ev.target.closest('[data-pick]'); if (!b || !S.ed) return;
    var id = b.getAttribute('data-pick'), spec = ED.addItem(edEnv(), S.ed.hist.cur, SH.di, SH.at, id);
    closeSheet(true);
    if (!spec) { flash('이미 코스에 있어요'); return; }
    edApply(spec, pnm(id) + ' 넣었어요', [id]);
    var r = document.querySelector('.edrow[data-id="' + id + '"]'); if (r && r.scrollIntoView) r.scrollIntoView({ block: 'center' });
  });
  document.addEventListener('keydown', function (ev) {
    var s = $('addSheet'); if (!s || s.hidden) return;
    if (ev.key === 'Escape') { closeSheet(); return; }
    if (ev.key === 'Tab') {
      var f = Array.prototype.filter.call(s.querySelectorAll('button,input'), function (x) { return !x.disabled && x.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (ev.shiftKey && (document.activeElement === first || document.activeElement === $('shCard'))) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    }
  });

  /* ---------- 말로 고치기 (시연 모드: ai.js aiEditIntent 규칙. 본선: Claude API 도구 쓰기로 교체) ---------- */
  function edPlaceList() { return D.places.map(function (p) { return { id: p.id, name: p.name, short: p.short }; }); }
  function nlShow(res, intents) {
    var box = $('nlResult'), d = res.diff, rows = [];
    if (d.removed.length) rows.push('<p><b class="nl-k out">빠짐</b> ' + d.removed.map(esc).join(', ') + '</p>');
    if (d.added.length) rows.push('<p><b class="nl-k in">들어감</b> ' + d.added.map(esc).join(', ') + '</p>');
    if (d.moved.length) rows.push('<p><b class="nl-k mv">순서 바뀜</b> ' + d.moved.map(esc).join(', ') + '</p>');
    if (d.stay.length) rows.push('<p><b class="nl-k st">머무는 시간</b> ' + d.stay.map(esc).join(', ') + '</p>');
    res.msgs.forEach(function (m) { rows.push('<p class="nl-m">' + esc(m) + '</p>'); });
    if (res.ok && res.issues.length) rows.push('<p class="nl-m bad">이렇게 바꾸면: ' + esc(res.issues[0].text) + ' — 바꾼 뒤에 위쪽 안내에서 고칠 방법을 고를 수 있어요</p>');
    if (!res.ok && !rows.length) rows.push('<p class="nl-m">바뀌는 게 없어요.</p>');
    box.innerHTML = '<p class="nl-h"><b>이렇게 바꿀까요?</b> <span class="simchip">시연</span></p>' + rows.join('') +
      (res.ok ? '<div class="nl-act"><button type="button" class="btn primary" id="nlOk">이대로 바꾸기</button><button type="button" class="btn" id="nlNo">그만두기</button></div>' : '<div class="nl-act"><button type="button" class="btn" id="nlNo">닫기</button></div>');
    box.hidden = false;
  }
  $('nlGo').addEventListener('click', function () {
    if (!S.ed) return;
    var t = $('nlText').value.trim(), r = AI.aiEditIntent(t, { places: edPlaceList() });
    if (!t) { var b0 = $('nlResult'); b0.innerHTML = '<p class="nl-m">부탁할 말을 적어 주세요. ' + esc(r.help) + '</p>'; b0.hidden = false; return; }
    var res = ED.applyIntents(edEnv(), S.ed.hist.cur, r.intents);
    S.ed.nl = res; nlShow(res, r.intents);
    var o = $('nlResult'); if (o.scrollIntoView) o.scrollIntoView({ block: 'nearest' });
  });
  $('nlText').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); $('nlGo').click(); } });
  $('nlResult').addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    if (b.id === 'nlNo') { $('nlResult').hidden = true; S.ed.nl = null; return; }
    if (b.id === 'nlOk' && S.ed && S.ed.nl && S.ed.nl.ok) {
      var res = S.ed.nl; $('nlResult').hidden = true; $('nlText').value = '';
      edApply(res.spec, '말씀대로 고쳤어요', res.diff.addedIds);
    }
  });
  (function initNlMic() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition, btn = $('nlMic');
    if (!SR) { btn.hidden = true; return; }
    var r = null, on = false;
    btn.addEventListener('click', function () {
      if (on) { try { r.stop(); } catch (e) { /* 무시 */ } return; }
      try {
        r = new SR(); r.lang = 'ko-KR'; r.interimResults = false; r.maxAlternatives = 1;
        r.onresult = function (ev) { $('nlText').value = ev.results[0][0].transcript; };
        r.onend = r.onerror = function () { on = false; btn.classList.remove('rec'); $('nlMicTxt').textContent = '말하기'; };
        stopSpeak(); r.start(); on = true; btn.classList.add('rec'); $('nlMicTxt').textContent = '듣고 있어요…';
      } catch (e) { on = false; }
    });
  })();

  /* ---------- 이야기 줄 · 이야기 보기 ---------- */
  function storyList() {
    var pl = S.plan; if (!pl) return [];
    var l = placeStops(pl.stops).map(function (s) { return { id: s.id, place: s.place, arrive: s.arrive }; });
    if (pl.tomorrow) l.push({ id: pl.tomorrow.place.id, place: pl.tomorrow.place, arrive: pl.tomorrow.arrive, tomorrow: true });
    return l;
  }
  function renderStories() {
    var el = $('stories'); if (!el) return; if (!S.plan) { el.innerHTML = ''; return; }
    el.innerHTML = storyList().map(function (it, k) {
      var seen = !!S.storySeen[it.id];
      return '<button type="button" class="sitem' + (seen ? ' seen' : '') + (S.changed[it.id] ? ' changed' : '') + '" data-story="' + k + '" aria-label="' + (k + 1) + '장 ' + esc(it.place.name) + ' 이야기 보기' + (seen ? ' (본 이야기)' : '') + '">' +
        '<span class="ring"><span>' + ART.svg(it.id) + '</span></span><span class="nb" aria-hidden="true">' + (k + 1) + '</span><span class="sl">' + esc(it.place.short) + '</span></button>';
    }).join('') +
      '<button type="button" class="sitem add" data-storyadd="1" aria-label="현장 제보 남기기"><span class="ring"><span>' + ico('plus') + '</span></span><span class="sl">+ 제보</span></button>';
  }
  var SV = { list: [], i: 0, opener: null };
  function openStory(k, opener) {
    SV.list = storyList(); if (!SV.list.length) return;
    SV.i = Math.max(0, Math.min(k, SV.list.length - 1)); SV.opener = opener || null;
    $('story').hidden = false;
    renderStoryView();
    $('svClose').focus();
  }
  function renderStoryView() {
    var it = SV.list[SV.i]; if (!it) { closeStory(); return; }
    S.storySeen[it.id] = 1; stopSpeak();
    var st = AI.aiStory(it.place, S.cond), art = $('svArt'), old = art.querySelector('svg.art');
    if (old) old.parentNode.removeChild(old);
    var oldPh = art.querySelector('img.ph'); if (oldPh) oldPh.parentNode.removeChild(oldPh);
    art.className = 'sv-art' + (licNo(it.place) ? ' has-photo t' + licNo(it.place) : ''); // 사진이 불러와지면 ph-ok 가 붙는다
    art.insertAdjacentHTML('afterbegin', ART.svg(it.id) + photoImg(it.place));
    $('svBars').innerHTML = SV.list.map(function (_, k) { return '<i class="' + (k <= SV.i ? 'on' : '') + '"></i>'; }).join('');
    $('svAv').innerHTML = ART.svg(it.id);
    $('svName').textContent = (SV.i + 1) + '장 · ' + it.place.name;
    $('svSub').textContent = (it.tomorrow ? '내일 일출 · ' : '') + hhmm(it.arrive) + (it.tomorrow ? ' 예정(예시)' : ' 도착') + ' · ' + (SV.i + 1) + '/' + SV.list.length;
    $('svTitle').textContent = it.place.name;
    $('svText').textContent = st.text;
    $('svSrc').textContent = '출처: ' + st.source + (licNo(it.place) ? ' · 그림 (사진을 불러오면 바뀌어요)' : ' · 그림은 사진이 아니에요');
    var lb = $('svListen'); lb.setAttribute('data-label', '이야기 듣기'); lb.textContent = '이야기 듣기';
    $('story').setAttribute('data-id', it.id);
    $('svPrev').hidden = SV.i === 0;
  }
  function closeStory(silent) {
    var v = $('story'); if (v.hidden) return;
    v.hidden = true; stopSpeak();
    if (!silent) { renderStories(); }
    var o = SV.opener; SV.opener = null;
    if (!silent) { var sr = $('stories'), k = sr && sr.querySelector('[data-story="' + SV.i + '"]'); try { (k || o || $('app')).focus(); } catch (e) { /* 무시 */ } }
  }
  $('svClose').addEventListener('click', function () { closeStory(); });
  $('svNext').addEventListener('click', function () { if (SV.i < SV.list.length - 1) { SV.i++; renderStoryView(); } else closeStory(); });
  $('svPrev').addEventListener('click', function () { if (SV.i > 0) { SV.i--; renderStoryView(); } });
  $('svListen').addEventListener('click', function () {
    var it = SV.list[SV.i]; if (!it) return;
    var st = AI.aiStory(it.place, S.cond);
    if (!say(st.speak, this)) flash('이 기기는 소리 안내가 안 돼요. 글을 읽어 주세요.');
  });
  document.addEventListener('keydown', function (ev) {
    var v = $('story'); if (v.hidden) return;
    if (ev.key === 'Escape') { closeStory(); }
    else if (ev.key === 'ArrowRight') { $('svNext').click(); }
    else if (ev.key === 'ArrowLeft') { $('svPrev').click(); }
    else if (ev.key === 'Tab') {
      var f = Array.prototype.filter.call(v.querySelectorAll('button'), function (b) { return !b.hidden && b.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    }
  });
  if ($('stories')) $('stories').addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-storyadd')) { openReport(); return; }
    if (b.hasAttribute('data-story')) openStory(+b.getAttribute('data-story'), b);
  });
  function renderMapList() {
    renderFacList();
    var pl = S.plan, el = $('mapList'); if (!pl) { el.innerHTML = ''; return; }
    var rows = placeStops(pl.stops).map(function (s, i) { var ph = smallPhoto(s.place, 'ml-th'); return '<li' + (ph ? ' data-kto="1"' : '') + '><span class="n">' + (i + 1) + '</span>' + ph + '<b>' + esc(s.place.name) + '<small class="mv">' + (pl.multi ? (s.day + 1) + '일차 · ' : '') + esc(moveLine(s)) + '</small>' + (ph ? '<small class="mv kto-credit">' + esc(creditText(s.place)) + '</small>' : '') + '</b><span class="tm">' + hhmm(s.arrive) + '</span></li>'; });
    if (pl.tomorrow) rows.push('<li><span class="n">' + (placeStops(pl.stops).length + 1) + '</span><b>' + esc(pl.tomorrow.place.name) + ' 일출</b><span class="tm">' + hhmm(pl.tomorrow.arrive) + '</span></li>');
    el.innerHTML = rows.join('');
  }

  function effectLabels() {
    var out = [];
    if (!S.fx) return out;
    S.fx.active.forEach(function (a) {
      var nm = PLACE[a.placeId] ? PLACE[a.placeId].short : a.placeId;
      if (!PLACE[a.placeId] || P.isSlotId(a.placeId) || /^eat_/.test(a.placeId)) return; // 식당 제보는 코스에 반영하지 않는다
      if (a.type === 'crowd') out.push(nm + ' 붐빔 제보 반영 (' + hhmm(a.until) + '까지)');
      else if (a.type === 'closed') out.push(nm + ' 오늘 휴무 제보 반영 → 뺌');
      else if (a.type === 'view') out.push(nm + ' 풍경 좋음 제보 반영');
      else if (a.type === 'new') out.push(nm + ' 새 볼거리 제보 반영');
    });
    return out;
  }
  /* 코스 조건 안내(아이·연인·날씨·시티투어 요금 등): 작고 흐린 한 줄. 눌러서 펼치면 전부 */
  var cnoteOpen = false, cnoteKey = '';
  function cnoteRender(notes) {
    var el = $('courseNote'); if (!el) return;
    if (!notes.length) { el.hidden = true; el.innerHTML = ''; return; }
    var key = notes.join('|'); if (key !== cnoteKey) { cnoteKey = key; cnoteOpen = false; }
    el.hidden = false;
    el.innerHTML = '<button type="button" class="cn-b' + (cnoteOpen ? ' open' : '') + '" id="cnBtn" aria-expanded="' + cnoteOpen + '" aria-controls="cnList"><span class="cn-t">' + esc(notes.join(' · ')) + '</span><span class="cn-c" aria-hidden="true">' + (cnoteOpen ? '▴' : '▾') + '</span></button>' +
      '<ul class="cn-l" id="cnList"' + (cnoteOpen ? '' : ' hidden') + '>' + notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>';
  }
  if ($('courseNote')) $('courseNote').addEventListener('click', function (ev) {
    var b = ev.target.closest('#cnBtn'); if (!b) return;
    cnoteOpen = !cnoteOpen; b.setAttribute('aria-expanded', cnoteOpen ? 'true' : 'false'); b.classList.toggle('open', cnoteOpen);
    var l = $('cnList'); if (l) l.hidden = !cnoteOpen; var ch = b.querySelector('.cn-c'); if (ch) ch.textContent = cnoteOpen ? '▴' : '▾';
  });
  function renderCourse() {
    var pl = S.plan; if (!pl) return;
    S.dayTab = pl.multi ? Math.max(0, Math.min(S.dayTab || 0, pl.days.length - 1)) : 0;
    var st = pl.endStation.name;
    var lead;
    var HN = S.cond.backHow === 'bus' ? '버스' : '기차';
    if (S.cond.backHow === 'car') lead = (S.mode === 'late' ? '저녁 ' : '') + pl.endStation.name + '에 ' + hhmm(pl.train) + '까지 돌아와요 (자가용' + (S.cond.noLimit && S.mode !== 'late' ? ' · 시간을 정하지 않아 밤 10시까지' : '') + ')';
    else if (S.mode === 'night') lead = '하룻밤 묵고 내일 추암 일출까지 이어가는 코스예요 · 출발 ' + hhmm(pl.start);
    else if (S.mode === 'late') lead = (S.cond.backHow === 'bus' ? '늦은 버스 ' : '막차 ') + hhmm(pl.train) + backSrc() + ' · ' + st + '에서 ' + hhmm(pl.train - 15) + '까지 돌아와요';
    else lead = HN + ' ' + hhmm(pl.train) + backSrc() + ' · ' + st + '에 ' + hhmm(pl.train - 15) + '까지 돌아와요';
    if (pl.multi) lead = pl.label + ' · ' + P.dateLabel(pl.date) + ' ~ ' + P.dateLabel(pl.backDate) + ' · ' + lead.replace(/^막차 /, '');
    $('courseLead').textContent = lead + ' · ' + placeStops(pl.stops).length + '곳' + (pl.meal ? ' (점심·저녁 시간 포함)' : '') + (S.ed && edDirty() ? ' · 직접 고친 코스' : '');
    var notes = [];
    if (pl.how === 'car') notes.push('자가용 · 걸어서 10분 안은 걷고 먼 곳은 차로(주차 5분 포함)');
    if (isKid()) notes.push('아이와 함께 · 걷기 20분 안 · 짧게 보는 곳 먼저 · 계단 있는 곳 뺌');
    if (isCouple()) notes.push('연인과 함께 · 노을·전망·저녁 풍경 먼저');
    if (S.wxRain && S.cond.rain) notes.push('지금 동해에 비가 와서 실내 먼저 짰어요 (기상청)');
    if (isSlow()) notes.push('천천히 걷기(시속 3km) · 계단 있는 곳 뺌');
    if (S.cond.rain) notes.push('비 오는 날 · 실내 먼저 · 해변·계곡 같은 야외 곳은 뺌');
    if (!pl.multi) { var dh = dateHint(S.cond.date, true); if (dh) notes.push('여행 날짜 ' + dh); }
    else notes.push('날마다 새로 짜요 · 앞 날에 간 곳(추암 세 곳 포함)은 다시 안 가요');
    if (pl.tour && pl.tour.used) {
      notes.push('시티투어는 미리 예약하세요 · ' + pl.tour.fareText + ' · 하루 한 장으로 어디서나 타고 내려요(' + pl.tour.rides + '번 탐) · 문의 ' + CT.org + ' ' + CT.phone);
      notes.push('만석이면 못 탈 수 있고, 시각은 교통 상황에 따라 늦어질 수 있어요');
      if (isSlow()) notes.push('시티투어버스는 타고 내릴 때 계단이 있을 수 있어요 — 불편하시면 ' + CT.phone + '에 먼저 물어보세요');
      var wc = P.tourWxCaution(S.wx); if (wc && S.cond.date === todayIso()) notes.push(wc);
    }
    var rsv = $('tourRsv'); if (rsv) { var usesTour = !!(CT && OV && pl.tour && pl.tour.used); rsv.hidden = !usesTour; rsv.innerHTML = usesTour ? OV.reserveHtml(CT, false) : ''; }
    var fxs = effectLabels();
    var strip = $('fxStrip');
    strip.hidden = !fxs.length;
    strip.innerHTML = fxs.length ? fxs.map(esc).join('<br>') : '';
    var bz = crowdBusy(); if (bz.length) notes.push('붐빔 예상: ' + bz.map(function (x) { return x.s.place.short + ' ' + Math.round(x.v); }).join(' · ') + ' (한국관광공사 예측 · 날짜별)');
    var csrc = $('crowdSrc'); if (csrc) { var any = placeStops(allStops()).some(function (s) { return crowdOf(s) != null; }); csrc.hidden = !any; csrc.textContent = any ? CR.sourceLine(S.crowd) + ' · 하루 값이라 아침이 더 한산하다는 건 어림이에요' : ''; }
    cnoteRender(notes);
    $('rainBtn').setAttribute('aria-pressed', S.cond.rain ? 'true' : 'false');
    $('simTime').value = toTimeValue(S.simNow); $('simDate').value = S.cond.date || todayIso();
    var html = '', E = !!(S.editing && S.ed);
    if (!pl.multi && S.mustDropped && S.mustDropped.length) html += '<li class="post empty">꼭 갈 곳 중 ' + S.mustDropped.length + '곳은 시간 안에 다 못 넣어서 뺐어요: ' + S.mustDropped.map(function (id) { return esc(PLACE[id] ? (PLACE[id].short || PLACE[id].name) : id); }).join(', ') + '</li>';
    NUMS = {}; var nn = 0; (pl.multi ? pl.days.map(function (d) { return d.plan; }) : [pl]).forEach(function (q) { q.stops.forEach(function (s) { if (!isSlot(s)) NUMS[s.id] = ++nn; }); });
    if (pl.multi) {
      var gi = 0; // 번호는 여행 전체에서 이어서(그림의 번호와 같게), 아래에는 고른 날(S.dayTab)만 보여 준다
      pl.days.forEach(function (d, di) {
        var h = dayHeadHtml(d), on = di === S.dayTab;
        if (E) h += edAddHtml(di, 0, d.plan.stops.length);
        d.plan.stops.forEach(function (s, k) { h += E ? editRowHtml(s, gi++, di, k, d.plan.stops.length) + edAddHtml(di, k + 1, d.plan.stops.length) : chapterHtml(s, gi++); });
        if (!placeStops(d.plan.stops).length) h += '<li class="post empty">이 날은 시간이 모자라 넣을 곳이 없어요.</li>';
        if (d.stay) h += stayNoteHtml(d);
        if (on) html += h;
      });
    } else html = E ? edAddHtml(0, 0, pl.stops.length) + pl.stops.map(function (s, k) { return editRowHtml(s, k, 0, k, pl.stops.length) + edAddHtml(0, k + 1, pl.stops.length); }).join('') : pl.stops.map(function (s, i) { return chapterHtml(s, i); }).join('');
    if (pl.tomorrow) {
      var t = pl.tomorrow, n = pl.stops.length;
      html += chapterHtml({ id: t.place.id, place: t.place }, n, { num: nn + 1, when: hhmm(t.arrive) + ' 도착 · 일출 ' + hhmm(t.sunrise), move: hhmm(t.depart) + ' ' + pl.endStation.name + ' 출발 · ' + (t.moveText || '택시 약 ' + t.legMin + '분(어림)') });
    }
    if (!placeStops(pl.stops).length) html = (S.mustDropped && S.mustDropped.length ? '<li class="post empty">꼭 갈 곳을 다 넣기엔 시간이 모자라요. 몇 곳을 줄여서 다시 골라 보세요(지금은 다 빼고 바로 ' + esc(st) + '으로 가는 길만 남았어요).</li>' : '<li class="post empty">돌아갈 시간까지 여유가 적어요. 곧바로 ' + esc(st) + '으로 가세요.</li>') + (E && !pl.multi ? edAddHtml(0, 0, 0) : '');
    $('timeline').innerHTML = html;
    renderDayTabs(); ovRender();
    var fl;
    if (!pl.feasible) fl = '돌아갈 시간이 너무 가까워요. 바로 ' + st + '으로 가세요.';
    else if (S.mode === 'night') fl = st + ' ' + hhmm(pl.back.arrive) + ' 도착 → 숙소 · 내일 ' + hhmm(pl.tomorrow.depart).replace('내일 ', '') + ' 출발, 추암 일출 ' + hhmm(pl.tomorrow.sunrise).replace('내일 ', '');
    else fl = st + ' ' + hhmm(pl.back.arrive) + ' 도착' + (pl.back.text && placeStops(pl.multi ? pl.days[pl.nDays - 1].plan.stops : pl.stops).length ? '(마지막 곳에서 ' + pl.back.text + ')' : '') + ' · ' + (S.cond.backHow === 'car' ? '정한 시각 ' : S.cond.backHow === 'bus' ? '버스 ' : '기차 ') + hhmm(pl.train);
    if (pl.late > 0) fl += ' · ' + pl.late + '분 늦음';
    $('finalLine').classList.toggle('late', pl.late > 0);
    /* 디자인 시안(10/22): 돌아갈 시간 신호등 — 여유 30분 이상 초록 · 그보다 적으면 노랑 · 늦으면 빨강. 색만이 아니라 글자로도 알려 준다. 여러 날·하룻밤 모드는 신호 없이 그대로. */
    var slack = (pl.feasible && S.mode !== 'night' && !pl.multi && isFinite(pl.train) && pl.back && isFinite(pl.back.arrive)) ? (pl.train - pl.back.arrive) : null;
    var sig = pl.late > 0 || !pl.feasible ? 'red' : (slack == null ? '' : (slack >= 30 ? 'green' : 'yellow'));
    var sigTxt = sig === 'red' ? '서두르세요' : sig === 'yellow' ? '조금 빠듯해요' : sig === 'green' ? '여유 있어요' : '';
    $('finalLine').setAttribute('data-sig', sig);
    $('finalLine').innerHTML = (sig ? '<b class="sig-l"><i class="sig-dot" aria-hidden="true"></i>' + sigTxt + '</b>' : ico('train')) + '<span>' + esc(fl) + '</span>';
    renderEdUi();
    renderRepAlerts();
    if (S.screen === 's-stay') renderTown();
    if (S.screen === 's-map') renderMapList();
    drawMap();
    publishCourse();
  }

  /* ---------- 코스 한 그림 (2026-10-17) — 전체 코스를 한 장에: 번호 · 날짜별 색 선 · 미리 보기(구간마다 확대하며 따라감) · 그림 저장 · 알아둘 것 ----------
     계산은 ov.js(번호·선·카메라·움직임·알아둘 것), 이 아래는 화면 연결. 공개 주소에서는 카카오 지도(불러오면), 아니면(폰 한 파일 포함) 미리 받아 둔 지도 그림 위에 SVG 로 그린다.
     그림 위 카메라 = SVG viewBox 를 옮기고 키우는 것(그림과 선이 함께 움직이고, 번호·점은 1/확대 배율로 줄여 크기를 지킴). 움직임 줄이기 설정이면 건너뛰기.
     코스가 바뀔 때마다(renderCourse) 그림 · 범례 · 미리 보기 길을 새로 만든다. 내 위치는 쓰지 않는다(미리 보기는 그림 위에서만). */
  var OVB = !!window.TOUR_BUNDLE;
  var OVS = { model: null, frame: null, kakao: null, kakaoOn: false, kakaoTry: false, cam: null, lay: null, focus: -1, dot: null, tw: 0, view: null, fit: null, home: null, all: false }; // view: 번호가 보이는 날(고른 날) · fit: 지도를 맞추는 범위(고른 날 또는 전체 일정) · home: 처음 카메라
  var OA = { tl: null, t0: 0, el: 0, raf: 0, state: 'idle', seg: -1 }; // 미리 보기: idle | play | pause | done
  var OV_MS_PER_NODE = 1500, OV_MS_MIN = 14000, OV_MS_MAX = 22000, OV_MIND = 30; // 번호가 이만큼(px) 안에 모이면 펼친다
  function reduceMotion() { try { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } }
  function ovMaps() { return (window.ROUTES && window.ROUTES.maps) || []; }
  function ovAlt(m) {
    var st = (OVS.view ? OVS.view.nodes : m.nodes).filter(function (n) { return n.kind === 'stop'; });
    return (m.nDays > 1 ? (OVS.view ? OVS.view.sel + 1 : 1) + '일차 코스 그림: ' : '코스 전체 그림: ') + st.length + '곳을 가는 순서대로 번호를 붙이고 선으로 이었어요. ' + st.slice(0, 6).map(function (n) { return n.n + ' ' + n.name; }).join(', ') + (st.length > 6 ? ' 외' : '');
  }
  function ovEase(t) { return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t); }
  function ovQ(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  /* 카메라 적용: viewBox · 배율(--z, 선 굵기) · 번호/점 크기 되돌림 */
  function ovApplyCam(c) {
    OVS.cam = c; var sv = $('ovSvg'); if (!sv || !OVS.frame) return;
    sv.setAttribute('viewBox', OV.viewBox(c)); sv.style.setProperty('--z', c.z.toFixed(3));
    var k = (1 / c.z).toFixed(4);
    ovQ('#ovSvg .ovs').forEach(function (g) { g.setAttribute('transform', 'scale(' + k + ')'); });
    var h = $('ovHi'); if (h) h.setAttribute('r', (25 / c.z).toFixed(2));
    if (OVS.dot) ovPlaceDot(OVS.dot.x, OVS.dot.y);
    var rs = $('ovReset'); if (rs) rs.hidden = !(OA.state === 'idle' && OVS.focus >= 0);
  }
  function ovPlaceDot(x, y) { OVS.dot = { x: x, y: y }; var g = $('ovDot'); if (g) { g.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') scale(' + (1 / (OVS.cam ? OVS.cam.z : 1)).toFixed(4) + ')'); g.setAttribute('visibility', 'visible'); } }
  /* 겹치는 번호 정리: z = 보는 배율. 3개 이상 모이면 "5·6·7" 한 표시로 합치고, 2개가 겹치면 살짝만 비켜 서며 짧은 줄로 잇는다. 보이는 날의 표시만 다룬다 */
  function ovLayoutNow(z) {
    var m = OVS.model, f = OVS.frame, v = OVS.view; if (!m || !f || !v) return null;
    var w = ($('ovBox') && $('ovBox').clientWidth) || 360;
    return OV.layoutMarks(m, f, OV_MIND * f.W / ((z || 1) * w), { visible: v.vis, labels: v.labels });
  }
  function ovLayout(z) {
    var m = OVS.model, f = OVS.frame; if (!m || !f) return;
    var lay = ovLayoutNow(z); if (!lay) return; OVS.lay = lay;
    var g = $('ovMarks'); if (g) g.innerHTML = OV.marksSvg(m, f, lay);
    var ld = $('ovLead'); if (ld) ld.innerHTML = OV.leadersSvg(lay);
    var k = (1 / (OVS.cam ? OVS.cam.z : 1)).toFixed(4); ovQ('#ovSvg .ovs').forEach(function (e) { e.setAttribute('transform', 'scale(' + k + ')'); });
  }
  function ovRes(k) { var it = OVS.lay && OVS.lay[k]; return it && it.hidden && it.mergedInto != null ? it.mergedInto : k; } // 합쳐진 표시에 든 번호 → 합쳐진 표시 자리
  function ovRender() {
    ovAnimStop(true);
    var pl = S.plan, box = $('ovStatic'), sec = $('ov');
    if (!pl || !OV) { sec.hidden = true; box.innerHTML = ''; OVS.model = null; OVS.frame = null; OVS.view = null; return; }
    var m = OV.model(pl); if (m.nDays < 2) OVS.all = false;
    var sel = m.nDays > 1 ? S.dayTab : -1, view = OV.dayView(m, sel), fit = OVS.all ? OV.dayView(m, -1) : view, f = OV.frame(m, ovMaps(), fit);
    OVS.model = m; OVS.view = view; OVS.fit = fit; OVS.frame = f; OVS.focus = -1; OVS.dot = null;
    if (!f) { sec.hidden = true; box.innerHTML = ''; return; }
    sec.hidden = false;
    OVS.home = OV.homeCam(m, f, fit); OVS.cam = OVS.home;
    var lay = ovLayoutNow(OVS.home.z); OVS.lay = lay;
    box.innerHTML = '<svg class="ov-svg" id="ovSvg" viewBox="0 0 ' + f.W + ' ' + f.H + '" role="group" aria-label="' + esc(ovAlt(m)) + '" data-days="' + m.nDays + '" data-sel="' + (m.nDays > 1 ? '1' : '0') + '" data-day="' + (m.nDays > 1 ? S.dayTab : 0) + '">' +
      (f.map ? '<image href="' + esc(f.map.src) + '" x="0" y="' + (-f.y0) + '" width="' + f.map.w + '" height="' + f.map.h + '"/>' : '<rect width="' + f.W + '" height="' + f.H + '" fill="#e9f0f1"/><text x="' + (f.W - 10) + '" y="' + (f.H - 10) + '" text-anchor="end" font-size="13" fill="#6b7f86">좌표만 그린 그림</text>') +
      OV.svgInner(m, f, { layout: lay, sel: sel, all: OVS.all }) + '<circle id="ovHi" r="25" fill="none" stroke="#ffb02e" stroke-width="5" visibility="hidden"/><g id="ovDot" visibility="hidden"><circle r="13" fill="#ffb02e" stroke="#121212" stroke-width="4"/></g></svg>';
    ovApplyCam(OVS.home);
    $('ovLegend').innerHTML = OVS.all ? OV.legendHtml(m) : '';
    var al = $('ovAll'); if (al) { al.hidden = m.nDays < 2; al.setAttribute('aria-pressed', OVS.all ? 'true' : 'false'); al.textContent = OVS.all ? '이 날만 보기' : '전체 일정 보기'; }
    $('ovCredit').textContent = OVS.kakaoOn ? '지도 © Kakao' : (f.map ? '지도 그림 © Kakao (미리 받아 둔 그림)' : '지도 그림 없이 좌표만 그렸어요');
    if (OVS.kakao) OVS.kakao.set(m, view, fit);
    ovCtlUi();
    ovNoteRender();
  }
  var ovAllBtn = $('ovAll'); if (ovAllBtn) ovAllBtn.addEventListener('click', function () { OVS.all = !OVS.all; ovRender(); });
  /* 번호를 누르면 그 장으로 확대, '전체 보기'로 되돌아옴 */
  function ovGoto(cam, ms) {
    cancelAnimationFrame(OVS.tw); var from = OVS.cam, t0 = null;
    ovLayout(cam.z);
    if (!ms || reduceMotion()) { ovApplyCam(cam); return; }
    OVS.tw = requestAnimationFrame(function step(ts) { if (t0 == null) t0 = ts; var u = Math.min(1, (ts - t0) / ms); ovApplyCam(OV.lerpCam(from, cam, ovEase(u))); if (u < 1) OVS.tw = requestAnimationFrame(step); });
  }
  function ovFocus(i) {
    if (OA.state === 'play' || OA.state === 'pause') return;
    var m = OVS.model, f = OVS.frame, mk = m && m.marks[i]; if (!mk) return;
    var it = OVS.lay && OVS.lay[i], nd = m.nodes[mk.nodes[0]]; OVS.focus = i;
    if (it && it.merged) { // 합쳐진 표시 → 그 번호들이 따로 보이게 크게 연다
      var pts = it.members.map(function (j) { return { lat: m.marks[j].lat, lng: m.marks[j].lng }; });
      if (OVS.kakaoOn && OVS.kakao) OVS.kakao.fitPts(pts);
      else { var xs = pts.map(function (p) { return f.proj(p.lat, p.lng); }); ovGoto(OV.cameraFor({ x0: Math.min.apply(null, xs.map(function (q) { return q.x; })), y0: Math.min.apply(null, xs.map(function (q) { return q.y; })), x1: Math.max.apply(null, xs.map(function (q) { return q.x; })), y1: Math.max.apply(null, xs.map(function (q) { return q.y; })) }, f, { pad: 3, minW: f.W / 8 }), 450); }
      $('ovChip').textContent = it.label + ' · ' + it.members.map(function (j) { return m.marks[j].name; }).join(' · ');
      ovCtlUi(); return;
    }
    if (OVS.kakaoOn && OVS.kakao) OVS.kakao.focus(mk.lat, mk.lng); else { var q = f.proj(mk.lat, mk.lng); ovGoto(OV.pointCam(q.x, q.y, f, f.W / 4), 450); }
    $('ovChip').textContent = (nd.kind === 'stop' ? nd.n + ' ' : '') + mk.name + ' · ' + hhmm(nd.t) + (nd.kind === 'stop' ? ' 도착' : '');
    ovCtlUi();
  }
  function ovUnfocus() { OVS.focus = -1; if (OVS.kakaoOn && OVS.kakao) OVS.kakao.fitAll(); else ovGoto(OVS.home, 450); ovCtlUi(); }
  $('ovStatic').addEventListener('click', function (ev) { var g = ev.target.closest('.ovm'); if (g) ovFocus(+g.getAttribute('data-m')); });
  $('ovStatic').addEventListener('keydown', function (ev) { if (ev.key !== 'Enter' && ev.key !== ' ') return; var g = ev.target.closest && ev.target.closest('.ovm'); if (g) { ev.preventDefault(); ovFocus(+g.getAttribute('data-m')); } });
  $('ovReset').addEventListener('click', ovUnfocus);

  /* --- 카카오 지도 (공개 주소에서만, 불러오면 그림 위를 덮는다. 끌어 옮기고 두 손가락/누르기로 키울 수 있다) --- */
  function ovKakaoEnsure() {
    if (OVS.kakao) { OVS.kakao.resize(); return; }
    ovLayout(OVS.cam ? OVS.cam.z : 1); // 화면에 처음 보일 때 실제 폭으로 다시 펼침
    var key = String(window.KAKAO_JS_KEY || '').trim();
    if (OVB || !key || OVS.kakaoTry || !S.plan || !OVS.model) return;
    OVS.kakaoTry = true;
    loadKakao(key, function () { try { ovKakaoInit(); } catch (e) { ovKakaoOff(); } }, function () { /* 지도 그림으로 계속 */ });
  }
  function ovKakaoOff() {
    if (OVS.kakao) OVS.kakao.destroy();
    OVS.kakao = null; OVS.kakaoOn = false; $('ovBox').classList.remove('kon'); $('ovKakao').hidden = true; $('ovKakao').innerHTML = '';
    if (OVS.frame) $('ovCredit').textContent = OVS.frame.map ? '지도 그림 © Kakao (미리 받아 둔 그림)' : '지도 그림 없이 좌표만 그렸어요';
  }
  function ovKakaoInit() {
    var km = kakao.maps, el = $('ovKakao'); el.hidden = false;
    var map = new km.Map(el, { center: new km.LatLng(37.5498, 129.1167), level: 7, draggable: true, scrollwheel: false, disableDoubleClickZoom: false }), tiles = false, ovs = [], lines = [], pins = [], leaders = [], dot = null, kb = null, selDay = -1, curTo = -1, moved = false;
    
    km.event.addListener(map, 'tilesloaded', function () { if (!tiles && OVS.kakao) { tiles = true; OVS.kakaoOn = true; $('ovBox').classList.add('kon'); $('ovCredit').textContent = '지도 © Kakao'; } });
    function clear() { ovs.forEach(function (o) { if (o) o.setMap(null); }); lines.forEach(function (l) { l.ln.setMap(null); }); leaders.forEach(function (l) { l.setMap(null); }); ovs = []; lines = []; pins = []; leaders = []; if (dot) { dot.setMap(null); dot = null; } }
    function base(l) { return curTo >= 0 ? (l.to === curTo ? 1 : 0.28) : (selDay >= 0 && l.day !== selDay ? 0.3 : 0.9); }
    function paint() { lines.forEach(function (l) { l.ln.setOptions({ strokeWeight: l.to === curTo ? 9 : 5, strokeOpacity: base(l) }); }); }
    /* 번호가 겹치면(30px 안) 둥글게 펼치고 가는 줄로 진짜 자리와 잇는다. 출발·도착 알약은 아래로 비켜 서서 번호를 안 가린다 */
    function declutter() {
      var m = OVS.model, v = OVS.view; if (!m || !v || !ovs.length) return;
      var pj; try { pj = map.getProjection(); } catch (e) { return; } if (!pj) return;
      leaders.forEach(function (l) { l.setMap(null); }); leaders = [];
      var fp = { proj: function (lat, lng) { var q = pj.containerPointFromCoords(new km.LatLng(lat, lng)); return { x: q.x, y: q.y }; } };
      var lay = OV.layoutMarks(m, fp, OV_MIND, { visible: v.vis, labels: v.labels });
      lay.forEach(function (it) {
        var mk = m.marks[it.i], o = ovs[it.i]; if (!o) return;
        if (it.hidden) { o.setMap(null); return; }
        o.setMap(map); try { o.setZIndex(it.under ? 2 : (mk.kind === 'st' ? 5 : 3)); } catch (e0) { /* 무시 */ } if (pins[it.i]) { pins[it.i].textContent = it.label; pins[it.i].classList.toggle('mg', !!it.merged); }
        if (!it.moved) { o.setPosition(it.merged || it.members ? pj.coordsFromContainerPoint(new km.Point(it.x, it.y)) : new km.LatLng(mk.lat, mk.lng)); return; }
        var to = pj.coordsFromContainerPoint(new km.Point(it.x, it.y)); o.setPosition(to);
        var ln = new km.Polyline({ path: [new km.LatLng(mk.lat, mk.lng), to], strokeWeight: 1.5, strokeColor: '#333', strokeOpacity: 0.8 }); ln.setMap(map); leaders.push(ln);
      });
    }
    km.event.addListener(map, 'idle', declutter);
    function bounds(path) { var b = new km.LatLngBounds(); path.forEach(function (q) { b.extend(new km.LatLng(q[1], q[0])); }); return b; }
    OVS.kakao = {
      set: function (m, view, fit) {
        var sel = view.sel, allMode = fit.sel < 0 && sel >= 0; clear(); selDay = sel; curTo = -1; var b = new km.LatLngBounds(), inFit = {}; fit.legs.forEach(function (l) { inFit[l.to] = 1; });
        m.legs.forEach(function (l) {
          var off = sel >= 0 && l.day !== sel, ln = new km.Polyline({ path: l.path.map(function (q) { return new km.LatLng(q[1], q[0]); }), strokeWeight: off ? (allMode ? 4 : 3) : 5, strokeColor: OV.dayColor(l.day, m.nDays), strokeOpacity: off ? (allMode ? 0.6 : 0.3) : 0.9, strokeStyle: l.est ? 'shortdash' : 'solid' });
          ln.setMap(map); lines.push({ ln: ln, to: l.to, day: l.day }); if (inFit[l.to]) l.path.forEach(function (q) { b.extend(new km.LatLng(q[1], q[0])); });
        });
        m.marks.forEach(function (mk, i) {
          if (!view.vis[i]) { ovs.push(null); pins.push(null); return; }
          if (fit.vis[i]) b.extend(new km.LatLng(mk.lat, mk.lng));
          var d = document.createElement('div'); d.className = 'kpin ovk' + (mk.kind === 'st' ? ' st' : ''); d.textContent = mk.label; d.setAttribute('role', 'button'); d.title = mk.name; if (mk.kind === 'stop') d.style.background = OV.dayColor(mk.day, m.nDays);
          d.addEventListener('click', function () { ovFocus(i); });
          var o = new km.CustomOverlay({ position: new km.LatLng(mk.lat, mk.lng), content: d, xAnchor: 0.5, yAnchor: 0.5, zIndex: mk.kind === 'st' ? 5 : 3 }); o.setMap(map); ovs.push(o); pins.push(d);
        });
        kb = b; try { map.relayout(); map.setBounds(b, 30, 30, 30, 30); } catch (e) { /* 무시 */ } setTimeout(declutter, 60);
      },
      dot: function (lat, lng) {
        var pos = new km.LatLng(lat, lng);
        if (!dot) { var d = document.createElement('div'); d.className = 'ov-kdot'; dot = new km.CustomOverlay({ position: pos, content: d, xAnchor: 0.5, yAnchor: 0.5, zIndex: 9 }); dot.setMap(map); } else dot.setPosition(pos);
      },
      mark: function (reached, now) { pins.forEach(function (d, i) { if (!d) return; d.classList.toggle('reached', !!reached[i]); d.classList.toggle('now', i === now); }); },
      cur: function (to) { curTo = to; paint(); },
      fitLeg: function (l) { try { map.setBounds(bounds(l.path), 70, 40, 70, 40); } catch (e) { /* 무시 */ } },
      fitAll: function () { try { if (kb) map.setBounds(kb, 30, 30, 30, 30); } catch (e) { /* 무시 */ } },
      fitPts: function (pts) { try { var bb = new km.LatLngBounds(); pts.forEach(function (p) { bb.extend(new km.LatLng(p.lat, p.lng)); }); map.setBounds(bb, 90, 60, 90, 60); } catch (e) { /* 무시 */ } },
      focus: function (lat, lng) { try { map.setLevel(4, { animate: true }); map.panTo(new km.LatLng(lat, lng)); } catch (e) { /* 무시 */ } },
      clearDot: function () { if (dot) { dot.setMap(null); dot = null; } pins.forEach(function (d) { if (d) d.classList.remove('reached', 'now'); }); curTo = -1; paint(); },
      resize: function () { try { map.relayout(); if (kb && OVS.focus < 0 && OA.state === 'idle') map.setBounds(kb, 30, 30, 30, 30); } catch (e) { /* 무시 */ } },
      destroy: function () { clear(); }
    };
    OVS.kakao.set(OVS.model, OVS.view, OVS.fit);
    setTimeout(function () { if (!tiles && OVS.kakao) ovKakaoOff(); }, 9000); // 등록 안 된 주소 등으로 지도 조각이 안 오면 지도 그림 그대로
  }
  /* --- 미리 보기 (그림 위에서만 움직임): 구간마다 그 구간이 꽉 차게 확대 → 점이 따라감 → 다음 구간으로 부드럽게 → 끝에서 전체로 --- */
  function ovCtlUi() {
    var st = OA.state, play = $('ovPlay'), pz = $('ovPause'), en = $('ovEnd'), chip = $('ovChip');
    play.hidden = st === 'play' || st === 'pause';
    play.querySelector('span').textContent = st === 'done' ? '다시 보기' : '여행 미리 보기';
    pz.hidden = !(st === 'play' || st === 'pause'); en.hidden = pz.hidden;
    pz.querySelector('span').textContent = st === 'pause' ? '이어서' : '멈춤';
    pz.setAttribute('aria-label', st === 'pause' ? '이어서 보기' : '멈추기'); pz.querySelector('use').setAttribute('href', st === 'pause' ? '#i-play' : '#i-pause');
    chip.hidden = st === 'idle' && OVS.focus < 0;
    var rs = $('ovReset'); if (rs) rs.hidden = !(st === 'idle' && OVS.focus >= 0);
    var nx = $('ovNext'); if (nx) { var vm = OVS.model, vs = OVS.view ? OVS.view.sel : -1, more = !!(vm && vm.nDays > 1 && vs >= 0 && vs < vm.nDays - 1 && st === 'done'); nx.hidden = !more; if (more) nx.querySelector('span').textContent = (vs + 2) + '일차 미리 보기'; }
    var sv = $('ovSvg'); if (sv) { sv.setAttribute('data-sel', (OVS.model && OVS.model.nDays > 1 && st === 'idle') ? '1' : '0'); if (st === 'idle' || st === 'done') sv.classList.remove('anim'); }
  }
  function ovAnimStop(silent) {
    cancelAnimationFrame(OA.raf); cancelAnimationFrame(OVS.tw); OA.raf = 0; OA.state = 'idle'; OA.tl = null; OA.el = 0; OA.seg = -1; OVS.focus = -1; OVS.dot = null;
    var d = $('ovDot'), h = $('ovHi'); if (d) d.setAttribute('visibility', 'hidden'); if (h) h.setAttribute('visibility', 'hidden');
    ovQ('#ovSvg .ovm').forEach(function (g) { g.classList.remove('reached', 'now'); });
    ovQ('#ovSvg .ovl').forEach(function (l) { l.classList.remove('cur'); });
    var sv = $('ovSvg'); if (sv) sv.classList.remove('anim');
    if (OVS.kakao) { OVS.kakao.clearDot(); OVS.kakao.fitAll(); }
    if (OVS.frame && sv && OVS.home) { OVS.cam = OVS.home; ovLayout(OVS.home.z); ovApplyCam(OVS.home); }
    if (!silent) ovCtlUi();
  }
  function ovBuildCams(tl, reduce) {
    var f = OVS.frame, full = OVS.home, cur = full;
    tl.segs.forEach(function (s) {
      if (s.type === 'move') { s.from = cur; s.to = OV.legCam(s.leg, f); s.trans = reduce ? 0 : Math.min(550, s.ms * 0.7); cur = s.to; }
      else if (s.type === 'hold') { if (reduce && s.leg) cur = OV.legCam(s.leg, f); s.from = s.to = cur; s.trans = 0; }
      else { s.from = cur; s.to = full; s.trans = reduce ? 0 : s.ms; cur = full; }
    });
  }
  function ovSegEnter(st, seg) { // 구간이 바뀔 때 한 번: 지금 가는 선 강조 · 번호 펼치기 · 카카오 지도 맞추기
    OA.seg = st.seg;
    var cur = seg.type === 'out' ? null : st.leg;
    ovQ('#ovSvg .ovl').forEach(function (l) { l.classList.toggle('cur', !!cur && +l.getAttribute('data-leg') === cur.to); });
    var sv = $('ovSvg'); if (sv) sv.classList.toggle('anim', !!cur);
    if (OVS.kakaoOn && OVS.kakao) { OVS.kakao.cur(cur ? cur.to : -1); if (seg.type === 'move') OVS.kakao.fitLeg(cur); else if (seg.type === 'out') OVS.kakao.fitAll(); }
    else ovLayout(seg.to ? seg.to.z : 1);
  }
  function ovFrameState(ms) {
    var m = OVS.model, f = OVS.frame, st = OV.stateAt(m, OA.tl, ms); if (!st) return;
    var seg = OA.tl.segs[st.seg];
    if (st.seg !== OA.seg) ovSegEnter(st, seg);
    var nd = m.nodes[st.toNode], reached = {}, i;
    for (i = 0; i <= st.reached; i++) reached[ovRes(m.dayOf[i])] = 1;
    var now = st.moving ? -1 : ovRes(m.dayOf[st.node]);
    if (OVS.kakaoOn && OVS.kakao) { OVS.kakao.dot(st.lat, st.lng); OVS.kakao.mark(reached, now); }
    else { var fr = seg.trans ? ovEase(Math.min(1, st.t / seg.trans)) : 1; ovApplyCam(OV.lerpCam(seg.from, seg.to, fr)); }
    var o = f.proj(st.lat, st.lng); ovPlaceDot(o.x, o.y);
    ovQ('#ovSvg .ovm').forEach(function (el) { var k = +el.getAttribute('data-m'); el.classList.toggle('reached', !!reached[k]); el.classList.toggle('now', k === now); });
    var h = $('ovHi'); if (h) { if (now >= 0 && st.type !== 'out') { var mk = m.marks[now], it = OVS.lay && OVS.lay[now], q = it ? { x: it.x, y: it.y } : f.proj(mk.lat, mk.lng); h.setAttribute('cx', q.x.toFixed(1)); h.setAttribute('cy', q.y.toFixed(1)); h.setAttribute('visibility', 'visible'); } else h.setAttribute('visibility', 'hidden'); }
    $('ovChip').textContent = st.type === 'move' ? OV.legCaption(m, st.leg) : (nd.kind === 'stop' ? nd.n + ' ' : '') + nd.name + ' · ' + hhmm(st.clock);
  }
  function ovTick(ts) {
    if (OA.state !== 'play') return;
    var ms = ts - OA.t0;
    if (ms >= OA.tl.total) { ovFrameState(OA.tl.total - 1); OA.state = 'done'; OA.raf = 0; var last = OVS.view.nodes[OVS.view.nodes.length - 1]; ovCtlUi(); $('ovChip').textContent = '미리 보기 끝 · ' + last.name + ' ' + hhmm(last.t); return; }
    ovFrameState(ms); OA.el = ms; OA.raf = requestAnimationFrame(ovTick);
  }
  function ovPlay() {
    if (!OVS.model || !OVS.view || !OVS.view.nodes.length) return;
    ovAnimStop(true);
    var n = OVS.view.nodes.length, red = reduceMotion(), total = Math.max(OV_MS_MIN, Math.min(OV_MS_MAX, n * OV_MS_PER_NODE));
    OA.tl = OV.timeline(OVS.model, total, red, OVS.view); ovBuildCams(OA.tl, red); OA.state = 'play'; OA.el = 0; OA.seg = -1; OA.t0 = performance.now(); ovCtlUi(); ovFrameState(0);
    OA.raf = requestAnimationFrame(function (ts) { OA.t0 = ts; ovTick(ts); });
  }
  function ovPauseToggle() {
    if (OA.state === 'play') { cancelAnimationFrame(OA.raf); OA.state = 'pause'; ovCtlUi(); }
    else if (OA.state === 'pause') { OA.state = 'play'; ovCtlUi(); OA.raf = requestAnimationFrame(function (ts) { OA.t0 = ts - OA.el; ovTick(ts); }); }
  }
  $('ovPlay').addEventListener('click', ovPlay);
  $('ovPause').addEventListener('click', ovPauseToggle);
  $('ovEnd').addEventListener('click', function () { ovAnimStop(false); });
  window.addEventListener('resize', function () { if (OVS.kakao) OVS.kakao.resize(); if (OVS.frame && OA.state === 'idle') ovLayout(OVS.cam ? OVS.cam.z : 1); });
  var ovNextBtn = $('ovNext'); if (ovNextBtn) ovNextBtn.addEventListener('click', function () { var pl = S.plan; if (!pl || !pl.multi || S.dayTab >= pl.days.length - 1) return; S.dayTab++; ovNoteOpen = false; renderCourse(); var tabs = $('dayTabs'); if (tabs && tabs.getBoundingClientRect().top < 0) { try { tabs.scrollIntoView({ block: 'start' }); } catch (e) { /* 무시 */ } } ovPlay(); });

  /* --- 오늘 꼭 알아야 할 것: 한 줄, 여러 개면 눌러서 펼침. 여러 날이면 고른 날짜를 따른다 --- */
  var ovNoteOpen = false;
  function ovNoteRender() {
    var pl = S.plan, el = $('ovNote'); if (!pl || !OV) { el.hidden = true; return; }
    var di = pl.multi ? S.dayTab : 0, date = pl.multi ? pl.days[di].date : S.cond.date, sun = null, mk = marketPlace();
    if (pl.multi && pl.days[di].sunrise) sun = { min: pl.days[di].sunrise.sunrise };
    else if (!pl.multi && pl.tomorrow) sun = { min: pl.tomorrow.sunrise };
    var notes = OV.todayNotes({ P: P, CT: CT, date: date, marketDigits: marketDigits(), marketName: mk ? mk.short : '', rain: !!S.cond.rain, wx: S.wx, isToday: date === todayIso(), sunrise: sun });
    if (!notes.length) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    var head = (pl.multi ? (di + 1) + '일차 ' : '') + '주요사항';
    /* 한 줄에는 그 날의 사실만 이어 붙인다("북평장 장날 · 시티투어 운행 · 일출 06:41(어림)"). 눌러서 펼치면 자세한 말, 시티투어 항목 아래엔 예약 안내가 작게 붙는다 */
    el.innerHTML = '<button type="button" class="ovn-b" id="ovnBtn" data-k="' + notes[0].k + '" aria-expanded="' + ovNoteOpen + '" aria-controls="ovnList"><b>' + esc(head) + '</b><span class="ovn-t">' + esc(notes.map(function (n) { return n.short; }).join(' · ')) + '</span><span class="ovn-c" aria-hidden="true">' + (ovNoteOpen ? '▴' : '▾') + '</span></button>' +
      '<ul class="ovn-l" id="ovnList"' + (ovNoteOpen ? '' : ' hidden') + '>' + notes.map(function (n) { return '<li data-k="' + n.k + '">' + esc(n.text) + (n.note ? '<small class="ovn-rsv">' + esc(n.note) + '</small>' : '') + '</li>'; }).join('') + '</ul>';
  }
  $('ovNote').addEventListener('click', function (ev) {
    var b = ev.target.closest('#ovnBtn'); if (!b) return;
    ovNoteOpen = !ovNoteOpen; b.setAttribute('aria-expanded', ovNoteOpen ? 'true' : 'false'); var l = $('ovnList'); if (l) l.hidden = !ovNoteOpen; var ch = b.querySelector('.ovn-c'); if (ch) ch.textContent = ovNoteOpen ? '▴' : '▾';
  });

  /* --- 날짜 고르기(여러 날 여행): 고른 날의 게시물만 아래에 보인다 --- */
  function renderDayTabs() {
    var el = $('dayTabs'), pl = S.plan;
    if (!pl || !pl.multi) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = pl.days.map(function (d, di) {
      var inf = P.dateInfo(d.date), dd = inf ? inf.m + '/' + inf.d + '(' + DOW_NAME[inf.dow] + ')' : '';
      return '<button type="button" class="dt-b' + (di === S.dayTab ? ' on' : '') + '" data-dt="' + di + '" aria-pressed="' + (di === S.dayTab ? 'true' : 'false') + '"><b>' + (di + 1) + '일차</b><span>' + esc(dd) + '</span></button>';
    }).join('');
  }
  $('dayTabs').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-dt]'); if (!b || !S.plan) return;
    var di = +b.getAttribute('data-dt'); if (di === S.dayTab) return;
    S.dayTab = di; ovNoteOpen = false; renderCourse();
    var tabs = $('dayTabs'); if (tabs && tabs.getBoundingClientRect().top < 0) { try { tabs.scrollIntoView({ block: 'start' }); } catch (e) { /* 무시 */ } }
    var nb = tabs.querySelector('[data-dt="' + di + '"]'); if (nb) { try { nb.focus({ preventScroll: true }); } catch (e2) { /* 무시 */ } }
  });

  /* --- 그림 저장 · 공유 · 그림 보기 --- */
  function ovTitle() {
    var pl = S.plan, a = P.dateInfo(pl.date || S.cond.date), b = P.dateInfo(pl.backDate || S.cond.backDate), fm = function (i) { return i ? i.m + '/' + i.d : ''; };
    return '도째비 길동무 · ' + fm(a) + (pl.multi && b ? '~' + fm(b) : '');
  }
  function ovDayTitle() { // 저장 그림 제목: 여러 날이고 '이 날만 보기'면 "1일차 · 10/24(토)", 아니면 전체 제목
    var pl = S.plan; if (!pl || !pl.multi || OVS.all || !OVS.view || OVS.view.sel < 0) return ovTitle();
    var di = OVS.view.sel, inf = P.dateInfo(pl.days[di].date);
    return (di + 1) + '일차 · ' + (inf ? inf.m + '/' + inf.d + '(' + DOW_NAME[inf.dow] + ')' : '');
  }
  function ovMakeBlob(cb) {
    var m = OVS.model, f = OVS.frame, v = OVS.view, c = OVS.home; if (!m || !f || !v || !c) { cb(null); return; }
    try {
      var W = 1080, sc = W / c.w, msc = W / 360, mh = Math.round(c.h * sc), top = 150, bot = 140, cv = document.createElement('canvas'), ff = "'Pretendard','Noto Sans KR','Malgun Gothic',sans-serif";
      cv.width = W; cv.height = top + mh + bot; var g = cv.getContext('2d');
      var bg = g.createLinearGradient(0, 0, W, cv.height); bg.addColorStop(0, '#0b2f52'); bg.addColorStop(1, '#12609a'); g.fillStyle = bg; g.fillRect(0, 0, W, cv.height);
      var nStops = v.nodes.filter(function (n) { return n.kind === 'stop'; }).length, ox = -(c.cx - c.w / 2) * sc, oy = top - (c.cy - c.h / 2) * sc;
      g.textAlign = 'left'; g.fillStyle = '#fff'; g.font = '800 54px ' + ff; g.fillText(ovDayTitle(), 48, 80);
      g.fillStyle = '#c9eeea'; g.font = '500 30px ' + ff; g.fillText((S.plan.multi && (OVS.all || v.sel < 0) ? S.plan.label + ' · ' : '') + nStops + '곳 · 번호는 가는 순서', 48, 126);
      var finish = function () {
        try {
          g.save(); g.beginPath(); g.rect(0, top, W, mh); g.clip();
          OV.drawLines(g, m, f, ox, oy, sc, OV.layoutMarks(m, f, OV_MIND * c.w / 360, { visible: v.vis, labels: v.labels }), { msc: msc, sel: v.sel, all: OVS.all });
          g.restore();
          g.textAlign = 'left'; g.font = '700 30px ' + ff; var x = 48, y = top + mh + 52;
          if (m.nDays > 1 && OVS.all) { for (var d = 0; d < m.nDays; d++) { g.fillStyle = OV.dayColor(d, m.nDays); g.beginPath(); g.arc(x + 12, y - 10, 12, 0, 7); g.fill(); g.fillStyle = '#fff'; g.fillText((d + 1) + '일', x + 34, y); x += 34 + g.measureText((d + 1) + '일').width + 30; } }
          else { g.fillStyle = '#fff'; g.fillText('노란 표시는 출발·도착', 48, y); }
          g.fillStyle = '#c9eeea'; g.font = '500 26px ' + ff; g.fillText('지도: ' + (f.map ? '카카오' : '좌표만 그린 그림') + '', 48, y + 52); // 사진은 이 그림에 안 넣으므로 사진 출처 표기도 없음
          cv.toBlob(function (bl) { cb(bl); }, 'image/png');
        } catch (e2) { cb(null); }
      };
      if (f.map) {
        var img = new Image();
        img.onload = function () { try { g.drawImage(img, c.cx - c.w / 2, c.cy - c.h / 2 + f.y0, c.w, c.h, 0, top, W, mh); } catch (e3) { g.fillStyle = '#e9f0f1'; g.fillRect(0, top, W, mh); } finish(); };
        img.onerror = function () { g.fillStyle = '#e9f0f1'; g.fillRect(0, top, W, mh); finish(); };
        img.src = f.map.src;
      } else { g.fillStyle = '#e9f0f1'; g.fillRect(0, top, W, mh); finish(); }
    } catch (e) { cb(null); }
  }
  /*DL-BEGIN*/
  function plainDownload(blob, name) { // 파일 내려받기(공개 주소). 폰 한 파일(묶음) 만들 때 이 블록은 통째로 빠진다 — 보기 창이 파일 내려받기를 막기 때문
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000); return true;
  }
  /*DL-END*/
  function dlCap() { // 보기 창이 주는 저장 기능(있을 때만). 없으면 null — window.claude 가 없어도 깨지지 않는다
    try { if (window.claude && typeof window.claude.use === 'function') return Promise.resolve(window.claude.use('downloads')).then(function (c) { return c && typeof c.save === 'function' ? c : null; }, function () { return null; }); } catch (e) { /* 무시 */ }
    return Promise.resolve(null);
  }
  function showImage(blob) {
    var url; try { url = URL.createObjectURL(blob); } catch (e) { return; }
    $('ivImg').src = url; $('imgView').hidden = false; document.body.classList.add('sh-open');
    try { $('ivCard').focus(); } catch (e2) { /* 무시 */ }
  }
  function closeImage() { var v = $('imgView'); if (v.hidden) return; v.hidden = true; document.body.classList.remove('sh-open'); var u = $('ivImg').src; $('ivImg').removeAttribute('src'); try { if (u) URL.revokeObjectURL(u); } catch (e) { /* 무시 */ } }
  $('imgView').addEventListener('click', function (ev) { if (ev.target.closest('[data-iv="close"]')) closeImage(); });
  function saveBlob(blob, name, okMsg) { // 저장 기능 → 내려받기 → (막힌 곳) 그림을 화면에 띄워 길게 눌러 저장
    dlCap().then(function (cap) {
      if (cap) { try { var r = cap.save({ filename: name, data: blob }); if (r && r.then) r.then(function () { flash(okMsg); }, function () { showImage(blob); }); else flash(okMsg); return; } catch (e) { /* 아래로 */ } }
      if (!OVB && plainDownload(blob, name)) { flash(okMsg); return; }
      showImage(blob);
    });
  }
  function ovBtnInit() { // 폰 한 파일에서 저장 기능이 없으면 '그림 저장'을 숨기고 '그림 보기'를 보여 준다
    if (!OVB) return;
    dlCap().then(function (cap) { if (!cap) { $('ovSave').hidden = true; $('ovView').hidden = false; var cs = $('cardSave'); if (cs) cs.hidden = true; } });
  }
  $('ovSave').addEventListener('click', function () { if (!S.plan) return; ovMakeBlob(function (bl) { if (!bl) { copyText(cardText(), '그림을 못 만들어서 글을 복사했어요'); return; } saveBlob(bl, '도째비-길동무-코스.png', '코스 그림을 저장했어요'); }); });
  $('ovView').addEventListener('click', function () { if (!S.plan) return; ovMakeBlob(function (bl) { if (!bl) { copyText(cardText(), '그림을 못 만들어서 글을 복사했어요'); return; } showImage(bl); }); });
  $('ovShare').addEventListener('click', function () {
    if (!S.plan) return;
    ovMakeBlob(function (bl) {
      var t = cardText();
      try {
        if (bl && navigator.canShare && typeof File === 'function') {
          var file = new File([bl], '도째비-길동무-코스.png', { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: ovTitle(), text: '나의 동해 코스' }).catch(function () { /* 닫음 */ }); return; }
        }
        if (navigator.share) { navigator.share({ title: ovTitle(), text: t }).catch(function () { /* 닫음 */ }); return; }
      } catch (e) { /* 아래로 */ }
      copyText(t, '코스 글을 복사했어요. 붙여넣어 공유하세요');
    });
  });
  ovBtnInit();

  /* --- 시티투어 시간표 창 --- */
  function stopById(id) {
    var pl = S.plan; if (!pl) return null;
    var fl = pl.multi ? pl.days.map(function (d) { return { q: d.plan, date: d.date }; }) : [{ q: pl, date: S.cond.date }];
    for (var i = 0; i < fl.length; i++) for (var k = 0; k < fl[i].q.stops.length; k++) if (fl[i].q.stops[k].id === id) return { s: fl[i].q.stops[k], date: fl[i].date };
    return null;
  }
  var ttOpener = null;
  function ttOpen(id, opener) {
    var r = stopById(id); if (!r || !r.s.tour || !CT) return;
    var t = r.s.tour;
    $('ttBody').innerHTML = OV.ttHtml(CT, P, { date: r.date, today: r.date === todayIso(), run: t.run, board: t.boardIdx, alight: t.alightIdx, dep: t.dep, arr: t.arr, boardName: t.boardName, alightName: t.alightName, wrap: t.wrap });
    ttOpener = opener || null; $('ttSheet').hidden = false; document.body.classList.add('sh-open');
    var c = $('ttCard'); c.scrollTop = 0; try { c.focus(); } catch (e) { /* 무시 */ }
  }
  function ttClose(silent) {
    var s = $('ttSheet'); if (!s || s.hidden) return;
    s.hidden = true; document.body.classList.remove('sh-open');
    var o = ttOpener; ttOpener = null; if (!silent && o && document.body.contains(o)) { try { o.focus(); } catch (e) { /* 무시 */ } }
  }
  $('ttSheet').addEventListener('click', function (ev) { if (ev.target.closest('[data-tt="close"]')) ttClose(); });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { ttClose(); closeImage(); } });
  $('timeline').addEventListener('click', function (ev) { var b = ev.target.closest('[data-ttopen]'); if (b) ttOpen(b.getAttribute('data-ttopen'), b); });

  /* 코스 화면 이벤트 */
  $('timeline').addEventListener('click', function (ev) {
    var tg = ev.target.closest('.p-tog');
    if (tg) { var li = tg.closest('.chap'), was = tg.getAttribute('aria-expanded') === 'true'; foldSet(li, !was); if (!was) { var r = li.getBoundingClientRect(); if (r.top < 70) { try { li.scrollIntoView({ block: 'start' }); } catch (e) { /* 무시 */ } } } return; }
    var b = ev.target.closest('button[data-act]'); if (!b) return;
    var act = b.getAttribute('data-act'), id = b.getAttribute('data-id');
    if (act === 'listen') {
      var st = AI.aiStory(PLACE[id], S.cond);
      if (!say(st.speak, b)) flash('이 기기는 소리 안내가 안 돼요. 글을 읽어 주세요.');
    } else if (act === 'ask') {
      var box = document.querySelector('[data-ask="' + id + '"]'); box.hidden = !box.hidden; b.setAttribute('aria-expanded', box.hidden ? 'false' : 'true');
    } else if (act === 'like') {
      S.liked[id] = !S.liked[id]; b.setAttribute('aria-pressed', S.liked[id] ? 'true' : 'false');
    } else if (act === 'q') {
      showAnswer(id, PLACE[id].qa[+b.getAttribute('data-k')].q);
    } else if (act === 'qsend') {
      var inp = document.querySelector('[data-in="' + id + '"]'); showAnswer(id, inp.value);
    } else if (act === 'arrive') {
      arriveAt(+b.getAttribute('data-i'));
    } else if (act === 'near') {
      var np = PLACE[id]; if (!np) return;
      openMapAt({ lat: np.lat, lng: np.lng }, { spot: true, focusName: np.short + ' 근처', di: dayOfPlace(id) });
    }
  });
  $('timeline').addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' && ev.target.hasAttribute('data-in')) showAnswer(ev.target.getAttribute('data-in'), ev.target.value);
  });
  function showAnswer(id, q) {
    var a = AI.aiAnswer(PLACE[id], q);
    var el = document.querySelector('[data-ans="' + id + '"]');
    el.hidden = false; el.className = 'answer' + (a.found ? '' : ' none');
    el.textContent = a.text;
    autoSay(a.text);
  }
  /* "여기 왔어요": 그 장까지는 고정, 시연 시계를 그 도착 시각으로 맞추고 나머지만 다시 계산 */
  function arriveAt(i) {
    if (!S.plan || !S.plan.stops[i]) return;
    S.fixed = S.plan.stops.slice(0, i + 1);
    S.simNow = S.plan.stops[i].arrive;
    setSim(S.simNow, true);
    replan({ noHighlight: true });
    S.banner = null; $('banner').hidden = true;
  }
  $('rainBtn').addEventListener('click', function () {
    S.cond.rain = !S.cond.rain;
    var prev = replan();
    setBanner(S.cond.rain ? '날씨가 안 좋아요 → 실내 곳을 먼저 넣어 다시 짰어요' : '비가 그쳤어요 → 코스를 다시 짰어요', ids(prev).join() === ids(S.plan).join() ? '순서는 그대로예요' : '바뀐 장은 반짝이는 테두리예요');
  });
  /* 자동 음성 켜고 끄기 — 위쪽 막대의 스피커 단추 (눌림 = 꺼짐) */
  function muteUi() {
    var b = $('muteBtn'), lab = S.muteAuto ? '자동 음성 켜기' : '자동 음성 끄기';
    b.setAttribute('aria-pressed', S.muteAuto ? 'true' : 'false'); b.setAttribute('aria-label', lab); b.title = lab;
    var u = b.querySelector('use'); if (u) u.setAttribute('href', S.muteAuto ? '#i-mute' : '#i-sound');
  }
  $('muteBtn').addEventListener('click', function () { S.muteAuto = !S.muteAuto; lsSet('tour-mute', S.muteAuto ? '1' : '0'); muteUi(); if (S.muteAuto) stopSpeak(); flash(S.muteAuto ? '자동 음성을 껐어요' : '자동 음성을 켰어요'); });
  muteUi();
  $('toReport').addEventListener('click', function () { openReport(); });

  /* 막차·하룻밤 비교 */
  function summarize(pl) {
    var ps = placeStops(pl.stops), last = ps.length ? ps[ps.length - 1].place.name : '없음';
    return ps.length + '곳 · 마지막 장 ' + last + (pl.meal ? ' · ' + pl.meal.place.short + ' 시간 포함' : '');
  }
  /* 하룻밤: 묵호역 둘레 숙박업소(동해시 숙박업소 자료, 주소→좌표). 별점·광고 없음, 이름과 거리만. */
  function lodgeHtml() {
    if (!FU || !FAC.lodging || !FAC.lodging.length) return '';
    var m = D.stations.mukho, all = FU.nearestN(FAC.lodging, m.lat, m.lng, 99, null), within = all.filter(function (x) { return x.m <= 1000; });
    var km = function (x) { return (Math.round(x / 100) / 10).toFixed(1) + 'km'; };
    return '<div class="stay-fac"><p><b>묵호역 1km 안 숙박업소 ' + within.length + '곳</b>' + (within.length ? '' : ' (자료에 없어요)') + '</p>' +
      '<p class="sf-n">가까운 3곳(직선 거리): ' + all.slice(0, 3).map(function (x) { return esc(x.item.name) + ' ' + km(x.m); }).join(' · ') + '</p>' +
      '<p class="sf-s">출처: ' + esc(FAC.source.lodging || '') + ' · 자료에는 호텔·호스텔·콘도 19곳만 실려 있어 모텔·펜션은 빠져 있어요 · 별점·광고 없음 · 예약·요금은 직접 확인</p></div>';
  }
  function renderStay() {
    renderStayInner();
    if (S.ed && edDirty()) $('stayOpts').insertAdjacentHTML('afterbegin', '<p class="note warnline">직접 고친 내용이 있어요. 막차·하룻밤으로 바꾸려면 먼저 위의 「처음 코스로」를 눌러 주세요.</p>');
  }
  $('stayDet').addEventListener('toggle', function () { if (this.open && S.plan) renderStay(); });
  function renderStayInner() {
    if (S.plan && S.plan.multi) { // 여러 날 여행: 날마다 묵는 곳 안내
      var sy = S.plan.stay;
      $('stayOpts').innerHTML = '<div class="opt on"><b>' + esc(S.plan.label) + ' 코스예요</b><p>날마다 새로 짜서, 밤에는 숙소 앞에서 마쳐요. 둘째 날 새벽에는 추암 일출로 시작할 수 있어요(비 오는 날·아이·부모님과는 뺌).</p>' +
        (sy && sy.examples && sy.examples.length ? '<p>숙소 예' + (sy.area ? '(' + esc(sy.area) + ' 권역)' : S.stayPick ? '' : '(묵호역에서 가까운 순)') + ': ' + sy.examples.map(esc).join(' · ') + '</p><p class="note">출처: ' + esc(sy.source) + ' · 모텔·펜션은 자료에 없어요 · 별점·광고 없음 · 예약·요금은 직접 확인</p>' : '<p class="note">숙박업소 자료가 없어 묵호역 둘레로 잡았어요.</p>') + // 2026-10-21: "가까운 순"은 기본값(묵호역 둘레)일 때만 맞는 말이라, 권역 추천·손으로 고른 숙소일 땐 다르게 보여줌
        '<p class="note">막차·하룻밤 비교는 하루 여행에서만 보여요.</p></div>';
      return;
    }
    var cur = S.mode, st = S.cond.end;
    var A = buildPlan({ mode: 'late' }), B = buildPlan({ mode: 'night' }), N = buildPlan({ mode: 'normal' });
    var nm = hhmm(effTrain('late')), hw = S.cond.backHow, HW = hw === 'bus' ? '버스' : hw === 'car' ? '자가용' : '기차';
    function opt(key, title, body, plan, on, extra) {
      return '<div class="opt' + (on ? ' on' : '') + '"><b>' + esc(title) + '</b><p>' + esc(body) + '<br>' + esc(summarize(plan)) + '</p>' + (extra || '') +
        '<button type="button" class="btn' + (on ? '' : ' primary') + '" data-pick="' + key + '"' + (on ? ' disabled' : '') + '>' + (on ? '지금 이 코스예요' : '이걸로 바꾸기') + '</button></div>';
    }
    var nightHas = A.stops.some(function (s) { return s.id === 'nightmarket'; });
    $('stayOpts').innerHTML =
      opt('normal', hw === 'car' ? '그대로 ' + hhmm(effTrain('normal')) + '까지' : '그대로 ' + hhmm(S.cond.back) + ' ' + HW, hw === 'car' ? hhmm(effTrain('normal')) + '까지 주차장으로 돌아와요.' : HW + ' ' + hhmm(S.cond.back) + (hw === 'train' ? backSrc('normal').replace(/^ /, '') : '') + '에 맞춰 돌아가요.', N, cur === 'normal') +
      opt('late', hw === 'train' ? (A.meal ? 'A. 저녁 먹고 막차 ' : 'A. 막차 ') + nm + '로 바꾸기' : (A.meal ? 'A. 저녁 먹고 ' : 'A. ') + nm + '까지 늘리기', (hw === 'train' ? '막차' + backSrc('late').replace(/^ /, '') + '로 늦추면 ' : nm + '까지 늘리면 ') + (A.meal ? '저녁 한 끼 먹고 ' : '') + (nightHas ? '도째비골 야시장까지' : '저녁 풍경까지') + ' 보고 가요.', A, cur === 'late') +
      opt('night', 'B. 하룻밤 자고 가기', '오늘은 숙소 앞에서 마치고, 내일 ' + D.sunrise.time + '(예시) 추암 일출을 마지막 장으로 봐요.', B, cur === 'night', lodgeHtml());
  }
  $('stayOpts').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-pick]'); if (!b) return;
    if (S.ed && edDirty()) { flash('직접 고친 내용이 있어요. 먼저 「처음 코스로」를 눌러 주세요'); return; }
    var k = b.getAttribute('data-pick');
    S.mode = k;
    if (k === 'late' || k === 'night') logEvent('choice', { v: k });
    replan();
    S.banner = null; $('banner').hidden = true;
    renderStay();
    flash(k === 'night' ? '하룻밤 코스로 바꿨어요' : k === 'late' ? '막차 코스로 바꿨어요' : '처음 코스로 돌아왔어요');
    if (S.plan.stops.length) autoSay((k === 'night' ? '하룻밤 코스로 바꿨어요. 내일 새벽 추암에서 일출을 봐요.' : k === 'late' ? '막차 코스로 바꿨어요. 저녁까지 이야기가 이어져요.' : '처음 코스로 돌아왔어요.'));
  });

  /* 시연 설정 */
  function setSim(m, quiet) {
    S.simNow = m; lsSet(K_SIM, String(m)); $('simTime').value = toTimeValue(m);
    if (!quiet) broadcast({ type: 'sim', m: m });
    else broadcast({ type: 'sim', m: m });
  }
  $('simApply').addEventListener('click', function () {
    var v = $('simTime').value; if (!v) return;
    S.fixed = []; setSim(P.toMin(v)); replan();
  });
  $('simDateApply').addEventListener('click', function () {
    var v = $('simDate').value; if (!v) return;
    S.cond.date = v; S.fixed = []; replan();
  });
  $('resetAll').addEventListener('click', function () { resetData(true); });
  function resetData(announce) {
    lsDel(K_REP); lsDel(K_LOG); S.reports = []; S.seen = {}; S.mine = []; S.applied = {}; S.dismissed = {}; S.notified = {};
    if (announce) broadcast({ type: 'reset' });
    if (S.plan) replan({ noHighlight: true });
    S.banner = null; $('banner').hidden = true; renderRepAlerts();
    if (S.screen === 's-watch') renderWatch();
  }

  /* ---------- 지도 위 편의 시설 (켜짐 칩: 화장실 · 관광안내소) ---------- */
  /* 시티투어 정류장 표시 '투': 코스에서 타고 내린 정류장 */
  function tourMarks(pl) {
    var out = [], seen = {};
    (pl.multi ? pl.days.map(function (d) { return d.plan; }) : [pl]).forEach(function (q) {
      q.stops.concat(q.back && q.back.tour ? [q.back] : []).forEach(function (s) {
        if (s.mode !== 'tour' || !s.tour) return;
        s.tour.stopsUsed.forEach(function (u) { var k = u.lat + ',' + u.lng; if (seen[k]) return; seen[k] = 1; out.push({ lat: u.lat, lng: u.lng, label: '투', kind: 'tour', name: '시티투어버스 ' + u.name }); });
      });
    });
    return out;
  }
  function facMarks() {
    var out = [];
    if (wcOn()) FAC.toilets.forEach(function (t) { out.push({ lat: t.lat, lng: t.lng, label: '화', kind: 'wc', name: t.name }); });
    if (S.fac.info) FAC.infos.forEach(function (t) { out.push({ lat: t.lat, lng: t.lng, label: '안', kind: 'info', name: t.name }); });
    return out;
  }
  /* 지도 밑 글: 지금 코스의 장 400m 안에 있는 것만(화장실은 가까운 순 6곳까지) — 지도를 못 불러와도 읽을 수 있게 */
  function renderFacList() {
    var el = $('facList'), pl = S.plan, on = wcOn(), inf = S.fac.info;
    $('facWc').setAttribute('aria-pressed', on ? 'true' : 'false'); $('facInfo').setAttribute('aria-pressed', inf ? 'true' : 'false');
    if (!pl || (!on && !inf) || !FU) { el.hidden = true; el.innerHTML = ''; return; }
    var pts = placeStops(pl.stops).map(function (s) { return s.place; }).concat([pl.startStation, pl.endStation]);
    var html = '';
    if (on) {
      var wc = FAC.toilets.map(function (t) { var best = FU.nearest(pts, t.lat, t.lng); return { t: t, m: best ? best.m : 1e9 }; }).filter(function (x) { return x.m <= 400; }).sort(function (a, b) { return a.m - b.m; }).slice(0, 6);
      html += '<p class="fl-h"><b>화장실</b> <small>코스 둘레 400m 안</small></p>' + (wc.length ? '<ul>' + wc.map(function (x) {
        var f = FU.wcFacts(x.t);
        return '<li><span class="fl-k wc">화장실</span><b>' + esc(x.t.name) + '</b><small>' + esc(f.join(' · ')) + '</small></li>';
      }).join('') + '</ul>' : '<p class="fl-none">코스 둘레 400m 안에는 자료에 없어요.</p>') +
        '<p class="fl-s">출처: ' + esc(FAC.source.toilet || '') + (FAC.toilets.some(function (t) { return t.diaper || t.bell; }) ? '' : ' · 기저귀 교환대·비상벨은 자료가 비어 있어 알 수 없어요') + '</p>';
    }
    if (inf) {
      html += '<p class="fl-h"><b>관광안내소</b> <small>동해시 자료 ' + FAC.infos.length + '곳</small></p><ul>' + FAC.infos.map(function (t) {
        return '<li><span class="fl-k info">안내소</span><b>' + esc(t.name) + '</b><small>' + esc(t.place) + ' · ' + esc(t.hours) + (t.closed ? ' · 쉬는 날 ' + esc(t.closed) : '') + (t.tel ? ' · <a href="tel:' + esc(t.tel.replace(/[^0-9]/g, '')) + '">' + esc(t.tel) + '</a>' : '') + '</small></li>';
      }).join('') + '</ul><p class="fl-s">출처: ' + esc(FAC.source.info || '') + '</p>';
    }
    el.innerHTML = html; el.hidden = false;
  }
  $('facWc').addEventListener('click', function () { S.fac.wc = !wcOn(); renderFacList(); drawMap(); });
  $('facInfo').addEventListener('click', function () { S.fac.info = !S.fac.info; renderFacList(); drawMap(); });

  /* ---------- 지도(카카오, 실패하면 글로 안내) ---------- */
  var mapApi = null, mapState = 'idle'; // idle|loading|ok|fail
  function loadKakao(key, ok, fail) {
    var done = false, t1 = null, t2 = null;
    function fin(good) { if (done) return; done = true; clearTimeout(t1); clearTimeout(t2); if (good) ok(); else fail(); }
    if (window.kakao && kakao.maps && typeof kakao.maps.load === 'function') { // 이미 불러왔으면(실시간 안내 지도 등) 다시 안 받는다
      t2 = setTimeout(function () { fin(false); }, 6000);
      try { kakao.maps.load(function () { fin(true); }); } catch (e) { fin(false); }
      return;
    }
    var s = document.createElement('script');
    s.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=' + encodeURIComponent(key) + '&autoload=false';
    s.onerror = function () { fin(false); };
    s.onload = function () {
      clearTimeout(t1);
      if (window.kakao && kakao.maps && typeof kakao.maps.load === 'function') {
        t2 = setTimeout(function () { fin(false); }, 6000);
        try { kakao.maps.load(function () { fin(true); }); } catch (e) { fin(false); }
      } else fin(false);
    };
    t1 = setTimeout(function () { if (!window.kakao) fin(false); }, 4000);
    document.head.appendChild(s);
  }
  /* ---------- 지도에 식당·숙소 보기 (2026-10-18) — 코스에는 식당을 넣지 않고, 지도에서 위치를 보고 직접 고른다 ----------
     자료: 동네 탭 자료(좌표 있는 곳) + 관광공사 음식점 + 공공데이터 식당·숙박(편의 자료). 별점·후기·광고 없음. 같은 곳은 하나로 합친다. */
  /* 2026-10-21: "식당이랑 카페 분리" — 자료에 업태가 "카페"로 또렷이 적힌 곳은 4곳뿐이라(1,669곳 중), 이름에 카페·커피 낱말이 있는 곳도 같이 카페로 봄(44곳 안팎). 완벽하진 않지만 업태만 쓰는 것보다 실제에 가까움 */
  var CAFE_RE = /카페|까페|커피|coffee|cafe/i;
  var BAR_TYPE_RE = /정종\/대포집\/소주방|호프\/통닭/; // 2026-10-22: 업소명에 "카페"가 들어가도(예: "꽃카페 정종") 업종이 술집(정종/대포집/소주방 · 호프/통닭)이면 카페가 아님 — 업종이 이름보다 믿을 만함
  function isCafe(x) { if (BAR_TYPE_RE.test(x.type || '')) return false; return CAFE_RE.test(x.name || '') || CAFE_RE.test(x.type || ''); }
  S.mapLay = { course: true, eat: false, cafe: false, lodge: false, spot: false }; S.mapFocus = null; S.poiSel = null;
  var POIS = null;
  function buildPois() {
    if (POIS) return POIS;
    var out = [], seen = {};
    function norm(s) { return String(s || '').replace(/\s+/g, '').toLowerCase(); }
    function add(kind, name, type, addr, lat, lng, tel, prec) {
      if (!name || !lat || !lng) return;
      if (kind === 'eat' && isCafe({ name: name, type: type })) kind = 'cafe'; // 카페는 식당과 다른 색·아이콘으로
      var nk = kind + '|' + norm(name);
      if (seen[nk]) return;
      for (var i = 0; i < out.length; i++) { var o = out[i]; if (o.kind === kind && o.name.slice(0, 2) === String(name).slice(0, 2) && Math.abs(o.lat - lat) < 0.0004 && Math.abs(o.lng - lng) < 0.0005) return; } // 40m 안 같은 이름 앞머리 = 같은 집
      seen[nk] = 1;
      out.push({ id: kind.charAt(0) + out.length, kind: kind, name: name, type: type || (kind === 'eat' ? '식당' : kind === 'cafe' ? '카페' : '숙박'), addr: String(addr || '').replace(/^강원(특별자치)?도\s*동해시\s*/, ''), lat: lat, lng: lng, tel: tel || '', prec: prec || '' });
    }
    (TW && TW.list ? TW.list('eat') : []).forEach(function (x) { if (TW.hasPos(x)) add('eat', x.name, x.type, x.addr, x.lat, x.lng, '', x.prec); });
    (D.eateries || []).forEach(function (e) { add('eat', e.name, '음식점', e.addr, e.lat, e.lng); });
    (FAC.eats || []).forEach(function (e) { add('eat', e.name, e.kind, e.addr, e.lat, e.lng); });
    (TW && TW.list ? TW.list('lodge') : []).forEach(function (x) { if (TW.hasPos(x)) add('lodge', x.name, x.type, x.addr, x.lat, x.lng, x.tel); });
    (FAC.lodging || []).forEach(function (e) { add('lodge', e.name, e.kind, e.addr, e.lat, e.lng, e.tel); });
    D.places.forEach(function (q) { out.push({ id: 's_' + q.id, kind: 'spot', pid: q.id, name: q.name, type: (q.region ? q.region + ' · ' : '') + (q.indoor ? '실내' : '야외'), addr: String(q.addr || '').replace(/^강원(특별자치)?도\s*동해시\s*/, ''), lat: q.lat, lng: q.lng, tel: '', prec: '' }); }); // 볼거리(코스 밖인 곳만 보여 줌 — 아래 notInCourse)
    POIS = out; return out;
  }
  var POI_ICON = { eat: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2.5 1.5-3.5 5-3.5 8H17"/>', cafe: '<path d="M4 9h14v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9z"/><path d="M18 10h1.5a2 2 0 0 1 0 4H18"/><path d="M6 3.5c.5 1-.5 1.5 0 2.5M10 3.5c.5 1-.5 1.5 0 2.5"/>', lodge: '<path d="M3 19V6M3 14h18v5M21 14v-2.5A2.5 2.5 0 0 0 18.5 9H11v5"/><circle cx="7" cy="11" r="1.6"/>', spot: '<path d="M12 3.5l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z"/>' };
  var POI_KINDS = ['eat', 'cafe', 'lodge', 'spot'], POI_NAME = { eat: '식당', cafe: '카페', lodge: '숙소', spot: '볼거리' }, POI_COLOR = { eat: '#b35c00', cafe: '#0d8a6b', lodge: '#5f3dc4', spot: '#5f6672' };
  function layPoi() { var l = S.mapLay; return !!(l.eat || l.cafe || l.lodge || l.spot); }
  function notInCourse(p, have) { return p.kind !== 'spot' || !have[p.pid]; }
  function poiSvg(kind) { return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + POI_ICON[kind] + '</svg>'; }
  function mapCenterPt() { // 보는 중심: 눌러서 정한 자리 → 코스 점들의 가운데 → 묵호역
    if (S.mapFocus) return S.mapFocus;
    var pl = S.plan; if (pl && S.mapLay.course) { var ps = placeStops(pl.stops); if (ps.length) { var la = 0, ln = 0; ps.forEach(function (s) { la += s.place.lat; ln += s.place.lng; }); return { lat: la / ps.length, lng: ln / ps.length }; } }
    return { lat: D.stations.mukho.lat, lng: D.stations.mukho.lng };
  }
  /* 지금 켜진 층에서 보여 줄 곳: 가운데에서 가까운 순으로 몇 곳까지만(확대 수준 level 에 따라 줄임 — 넓게 볼수록 적게) */
  function poiLimit(level) { return level == null ? 32 : level <= 3 ? 60 : level === 4 ? 45 : level === 5 ? 32 : level === 6 ? 22 : 14; }
  function visiblePois(level, center) {
    var c = center || mapCenterPt(), lay = S.mapLay, all = buildPois(), res = [], have = courseIds();
    POI_KINDS.forEach(function (kind) { // 식당·숙소·볼거리는 각자 몫을 따로 둔다(한쪽이 다른 쪽을 밀어내지 않게)
      if (!lay[kind]) return;
      var list = all.filter(function (p) { return p.kind === kind && notInCourse(p, have); }).map(function (p) { return { p: p, m: FU ? FU.dist(c.lat, c.lng, p.lat, p.lng) : 0 }; }).sort(function (x, y) { return x.m - y.m; });
      var lim = poiLimit(level), cell = level == null || level <= 5 ? 0 : level === 6 ? 0.006 : level === 7 ? 0.012 : 0.02, taken = {}, n = 0;
      for (var i = 0; i < list.length && n < lim; i++) { // 넓게 볼수록(6 이상) 칸(격자)마다 한 곳만 — 한 군데에 몰리지 않고 고르게 퍼져 보이게
        var x = list[i];
        if (cell) { var k = Math.floor(x.p.lat / cell) + '|' + Math.floor(x.p.lng / cell); if (taken[k]) continue; taken[k] = 1; }
        x.p.m = Math.round(x.m); res.push(x.p); n++;
      }
    });
    return res;
  }
  /* 지도에 그릴 묶음(2026-10-18): 식당이 1,500곳 가까이라 멀리서는 숫자 동그라미(칸 묶음), 가까이서만 낱개. 화면 안 것만, 한 번에 최대 150개.
     level: 카카오 확대 수준(작을수록 가까움) · bnd: {s,w,n,e}(없으면 전체) · near: 글 지도용 — 이 점들 700m 안의 낱개만 그리고 나머지는 묶음 숫자만 */
  function poiCell(level) { return level == null ? 0.012 : level <= 3 ? 0 : level === 4 ? 0.0035 : level === 5 ? 0.007 : level === 6 ? 0.012 : level === 7 ? 0.02 : 0.04; }
  function poiGroups(level, bnd, near, cen) {
    var lay = S.mapLay, all = buildPois(), out = [], c = cen || mapCenterPt(), have = courseIds();
    POI_KINDS.forEach(function (kind) {
      if (!lay[kind]) return;
      var sel = null, list = all.filter(function (p) {
        if (p.kind !== kind || !notInCourse(p, have)) return false;
        if (p.id === S.poiSel) { sel = p; return false; }
        return !bnd || (p.lat >= bnd.s && p.lat <= bnd.n && p.lng >= bnd.w && p.lng <= bnd.e);
      });
      if (sel) out.push({ n: 1, p: sel, lat: sel.lat, lng: sel.lng, kind: kind, id: sel.id });
      var cell = kind === 'spot' ? 0 : poiCell(level); if (!cell && list.length > 120) cell = 0.0015; // 볼거리는 22곳뿐이라 묶지 않고 낱개로
      if (!cell) { list.forEach(function (p) { out.push({ n: 1, p: p, lat: p.lat, lng: p.lng, kind: kind, id: p.id }); }); return; }
      var g = {};
      list.forEach(function (p) { var k = Math.floor(p.lat / cell) + '|' + Math.floor(p.lng / cell); (g[k] = g[k] || []).push(p); });
      Object.keys(g).forEach(function (k) {
        var a = g[k];
        if (a.length === 1) { out.push({ n: 1, p: a[0], lat: a[0].lat, lng: a[0].lng, kind: kind, id: a[0].id }); return; }
        var la = 0, ln = 0; a.forEach(function (p) { la += p.lat; ln += p.lng; });
        out.push({ n: a.length, p: null, lat: la / a.length, lng: ln / a.length, kind: kind, id: kind.charAt(0) + 'c' + k });
      });
    });
    if (near) out = out.filter(function (q) { return q.n > 1 || q.id === S.poiSel || q.kind === 'spot' || near.some(function (p) { return (FU ? FU.dist(p.lat, p.lng, q.lat, q.lng) : 0) <= 700; }); });
    out.forEach(function (q) { q.d = FU ? FU.dist(c.lat, c.lng, q.lat, q.lng) : 0; });
    out.sort(function (x, y) { return x.d - y.d; });
    return out.slice(0, near ? 60 : 150);
  }
  function selectPoi(id, noMove) {
    var p = buildPois().filter(function (q) { return q.id === id; })[0]; S.poiSel = p ? p.id : null;
    renderPoiUi();
    if (p && !noMove && mapApi && mapApi.focus) mapApi.focus(p);
  }
  function renderPoiUi() {
    var lay = S.mapLay;
    // 2026-10-21: 숙소를 벌써 잡았다고 한 사람에겐 "숙소" 지도 보기 칩이 필요 없음 — 숨기고, 켜져 있었으면 끈다
    var bookedHide = S.cond.stayBooked === 'booked'; if (bookedHide && lay.lodge) lay.lodge = false;
    $('layLodge').hidden = bookedHide;
    $('layCourse').setAttribute('aria-pressed', lay.course ? 'true' : 'false'); $('layEat').setAttribute('aria-pressed', lay.eat ? 'true' : 'false'); $('layCafe').setAttribute('aria-pressed', lay.cafe ? 'true' : 'false'); $('layLodge').setAttribute('aria-pressed', lay.lodge ? 'true' : 'false'); $('laySpot').setAttribute('aria-pressed', lay.spot ? 'true' : 'false');
    var card = $('poiCard'), sel = S.poiSel ? buildPois().filter(function (q) { return q.id === S.poiSel; })[0] : null;
    if (sel && !(lay[sel.kind] && notInCourse(sel, courseIds()))) { sel = null; S.poiSel = null; }
    if (sel && sel.kind === 'spot') {
      var sp = PLACE[sel.pid];
      card.hidden = false;
      card.innerHTML = '<div class="poi-h"><span class="poi-ic spot">' + poiSvg('spot') + '</span><div class="poi-t"><b>' + esc(sel.name) + '</b>' + pickHtml(sp, 'poi-b') + '<span>' + esc(sel.type) + (sel.m != null ? ' · 중심에서 약 ' + (sel.m >= 1000 ? (Math.round(sel.m / 100) / 10) + 'km' : (FU ? FU.round10(sel.m) : sel.m) + 'm') : '') + '</span></div><button type="button" class="poi-x" data-poi-x="1" aria-label="닫기">' + ico('close') + '</button></div>' +
        '<p class="poi-a">운영 ' + esc(sp.openText || '') + (sp.restText ? ' · 쉬는 날 ' + esc(sp.restText) : '') + '</p>' +
        (S.plan ? '<button type="button" class="btn poi-go poi-add" data-spot-add="' + esc(sp.id) + '">코스에 넣기</button><p class="poi-s">가장 덜 돌아가는 자리에 넣어요 · 돌아갈 시각은 지켜요</p>' : '') +
        '<p class="poi-s">출처: 한국관광공사 관광정보' + (PK.has(sp.id) ? ' · 100×100: 한국관광공사 「대한민국 명소발굴 100×100」' : '') + '</p>';
    } else if (sel) {
      card.hidden = false;
      card.innerHTML = '<div class="poi-h"><span class="poi-ic ' + sel.kind + '">' + poiSvg(sel.kind) + '</span><div class="poi-t"><b>' + esc(sel.name) + '</b><span>' + esc(sel.type) + (sel.m != null ? ' · 중심에서 약 ' + (sel.m >= 1000 ? (Math.round(sel.m / 100) / 10) + 'km' : (FU ? FU.round10(sel.m) : sel.m) + 'm') : '') + '</span></div><button type="button" class="poi-x" data-poi-x="1" aria-label="닫기">' + ico('close') + '</button></div>' +
        (sel.addr ? '<p class="poi-a">' + esc(sel.addr) + '</p>' : '') + (sel.prec ? '<p class="poi-a"><small>' + (sel.prec === 'k' ? '이름으로 찾은 위치' : '주소로 찾은 대략 위치(건물 기준)') + '</small></p>' : '') + (sel.tel ? '<p class="poi-a"><a href="tel:' + esc(sel.tel.replace(/[^0-9]/g, '')) + '">' + esc(sel.tel) + '</a></p>' : '') +
        '<a class="btn poi-go" href="' + esc(TW.kakaoSearch(sel.name)) + '" target="_blank" rel="noopener">카카오맵에서 보기</a><p class="poi-s">출처: 공공데이터포털 · 한국관광공사 · 영업 여부는 방문 전 확인 · 별점·광고 없음</p>';
    } else { card.hidden = true; card.innerHTML = ''; }
    var ps = $('poiSrc'); ps.hidden = !(lay.eat || lay.cafe); ps.textContent = (lay.eat || lay.cafe) ? (lay.eat && lay.cafe ? '식당·카페: ' : lay.cafe ? '카페: ' : '식당: ') + ((TW.src && TW.src.eats) || '') + ' · 숫자 동그라미는 그 둘레 곳 수 · 눌러서 확대' : '';
    var lst = $('poiList'), vis = layPoi() ? visiblePois(null, null).sort(function (x, y) { return x.m - y.m; }).slice(0, 6) : [], haveC = courseIds();
    lst.hidden = !vis.length;
    lst.innerHTML = vis.length ? '<p class="poi-lh"><b>' + (S.mapFocus ? (S.mapFocus.name || '여기') + ' 가까운 곳' : '가까운 곳') + '</b> <small>' + POI_KINDS.filter(function (k) { return lay[k]; }).map(function (k) { return POI_NAME[k]; }).join(' · ') + ' ' + buildPois().filter(function (p) { return lay[p.kind] && notInCourse(p, haveC); }).length + '곳 중</small></p><ul>' + vis.map(function (p) {
      return '<li><button type="button" class="poi-i' + (S.poiSel === p.id ? ' on' : '') + '" data-poi="' + p.id + '"><span class="poi-ic ' + p.kind + '">' + poiSvg(p.kind) + '</span><span class="poi-n"><b>' + esc(p.name) + '</b><small>' + esc(p.type) + (p.kind === 'spot' && PK.has(p.pid) ? ' · ' + esc(PK.label) : '') + '</small></span><span class="poi-m">' + (FU ? FU.round10(p.m) : p.m) + 'm</span></button></li>';
    }).join('') + '</ul>' : '';
  }
  function layToggle(k) {
    var lay = S.mapLay; lay[k] = !lay[k];
    if (!lay.course && !lay.eat && !lay.cafe && !lay.lodge && !lay.spot) lay.course = true; // 다 끄면 빈 지도가 되니 코스를 다시 켠다
    if (k !== 'course' && !lay.eat && !lay.cafe && !lay.lodge && !lay.spot) S.poiSel = null;
    renderPoiUi(); drawMap(true);
  }
  $('layCourse').addEventListener('click', function () { layToggle('course'); });
  $('layEat').addEventListener('click', function () { layToggle('eat'); });
  $('layCafe').addEventListener('click', function () { layToggle('cafe'); });
  $('layLodge').addEventListener('click', function () { layToggle('lodge'); });
  $('laySpot').addEventListener('click', function () { layToggle('spot'); });
  $('s-map').addEventListener('click', function (ev) {
    var ad = ev.target.closest('[data-spot-add]'); if (ad) { spotAdd(ad.getAttribute('data-spot-add')); return; }
    var b = ev.target.closest('[data-poi]'); if (b) { selectPoi(b.getAttribute('data-poi')); return; }
    var cl = ev.target.closest('[data-clu]'); if (cl) { var q = cl.getAttribute('data-clu').split(','); S.mapFocus = { lat: +q[0], lng: +q[1], name: '' }; S.poiSel = null; drawMap(true); return; } // 글 지도: 묶음을 누르면 그 둘레를 크게
    if (ev.target.closest('[data-poi-x]')) { S.poiSel = null; renderPoiUi(); drawMap(true); }
  });
  /* 어느 자리 둘레(식당 층 켜고)를 지도 탭에서 본다 — 끼니 시간 줄의 "근처 식당 지도에서 보기", 동네 탭의 "지도에서 보기" */
  function openMapAt(pt, o) {
    o = o || {};
    S.mapFocus = { lat: pt.lat, lng: pt.lng, name: o.focusName || '' };
    S.mapSeen = true; if (o.eat) S.mapLay.eat = true; if (o.spot) S.mapLay.spot = true;
    S.spotDay = o.di != null ? o.di : (S.dayTab || 0);
    S.poiSel = null;
    show('s-map');
    var m = $('s-map'); if (m && m.scrollIntoView) { try { m.scrollIntoView({ block: 'start' }); } catch (e) { /* 무시 */ } }
  }
  $('timeline').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-slotmap]'); if (!b) return;
    var s = stopById(b.getAttribute('data-slotmap')); if (!s) return;
    var pl = s.s.place, base = pl.base || pl;
    openMapAt({ lat: base.lat, lng: base.lng }, { eat: true, focusName: (base.short || base.name || '') + ' 근처' });
  });

  /* 선(길) 한 토막의 색·모양: 걷는 길(실제) = 보라 실선, 버스(실제) = 주황 실선, 길 값이 없는 구간(택시·어림) = 점선 직선 */
  var SEG = { walk: { c: '#0f4c81', w: 5, dash: false }, bus: { c: '#e07a00', w: 5, dash: false }, taxi: { c: '#c2255c', w: 5, dash: false }, est: { c: '#6b7f86', w: 4, dash: true }, tour: { c: '#0b3d91', w: 6, dash: false } };
  function segOf(a, b, info) {
    if (info && info.path && info.path.length > 1) return { kind: info.mode === 'bus' ? 'bus' : (info.mode === 'taxi' || info.mode === 'car') ? 'taxi' : 'walk', path: info.path.map(function (q) { return { lat: q[1], lng: q[0] }; }) };
    return { kind: 'est', path: [{ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }] };
  }
  /* 코스의 길 토막들: 출발역 → 각 장 → 돌아올 역, 1박이면 역 → 내일 추암 */
  function tourSegs(info) { // 시티투어 구간: 걷기 · 버스(진한 파랑) · 걷기 토막
    return info.tour.segs.map(function (sg) { return { kind: sg.kind, path: sg.path.map(function (q) { return { lat: q[1], lng: q[0] }; }) }; });
  }
  function mapSegs(pl) {
    if (pl.multi) { var all = []; pl.days.forEach(function (d) { all = all.concat(mapSegs(d.plan)); }); return all; }
    var segs = [], prev = pl.startStation;
    placeStops(pl.stops).forEach(function (s) { if (s.mode === 'tour' && s.tour) segs = segs.concat(tourSegs(s)); else segs.push(segOf(prev, s.place, s)); prev = s.place; });
    if (pl.feasible && pl.stops.length && pl.back) { if (pl.back.mode === 'tour' && pl.back.tour) segs = segs.concat(tourSegs(pl.back)); else segs.push(segOf(prev, pl.endStation, pl.back)); }
    if (pl.tomorrow) segs.push(segOf(pl.endStation, pl.tomorrow.place, pl.tomorrow));
    return segs;
  }
  /* 지도를 못 불러올 때: 미리 받아 둔 카카오 정적 지도 그림 위에 번호·길을 얹는다 (ROUTES.maps, 화면 밑 글 순서도 함께).
     그림 가운데 = center, 한 점(CSS px) = mPerPx m (lv5 = 4m, lv 마다 2배). */
  function staticMapHtml(pts, segs, facs, meSlot, pois, focus) {
    var maps = (window.ROUTES && window.ROUTES.maps) || [];
    var pick = null, proj = null, fit = focus ? [focus] : pts; // 눌러서 가운데를 정했으면 그 둘레가 크게 보이는 그림을 고른다(코스 전체가 안 들어가도 됨)
    maps.some(function (m) {
      var cos = Math.cos(m.center[1] * Math.PI / 180);
      var f = function (lat, lng) { return { x: m.w / 2 + (lng - m.center[0]) * 111320 * cos / m.mPerPx, y: m.h / 2 - (lat - m.center[1]) * 110574 / m.mPerPx }; };
      var allIn = fit.every(function (p) { var q = f(p.lat, p.lng); return q.x > 24 && q.x < m.w - 24 && q.y > 24 && q.y < m.h - 24; });
      if (allIn || m === maps[maps.length - 1]) { pick = m; proj = f; } // 다 들어가는 첫 그림, 없으면 가장 넓은 그림
      return allIn;
    });
    if (!pick) return '';
    var svg = '';
    var lblBoxes = null; // 이름표 자리(겹치면 그 이름표는 빼고 번호만 — 이름은 아래 목록에 있음)
    function lblFree(x, y, w, h) {
      if (x + w > pick.w - 4 || y < 4) return false;
      var hit = lblBoxes.some(function (b) { return x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y; });
      if (!hit) lblBoxes.push({ x: x, y: y, w: w, h: h });
      return !hit;
    }
    segs.forEach(function (sg) {
      var st = SEG[sg.kind] || SEG.est;
      svg += '<polyline fill="none" stroke="#fff" stroke-width="' + (st.w + 4) + '" stroke-linecap="round" stroke-linejoin="round" opacity=".85" points="' + sg.path.map(function (q) { var o = proj(q.lat, q.lng); return o.x.toFixed(1) + ',' + o.y.toFixed(1); }).join(' ') + '"/>';
      svg += '<polyline fill="none" stroke="' + st.c + '" stroke-width="' + st.w + '" stroke-linecap="round" stroke-linejoin="round"' + (st.dash ? ' stroke-dasharray="9 8"' : '') + ' points="' + sg.path.map(function (q) { var o = proj(q.lat, q.lng); return o.x.toFixed(1) + ',' + o.y.toFixed(1); }).join(' ') + '"/>';
    });
    if (focus) { var fo = proj(focus.lat, focus.lng); svg += '<g transform="translate(' + fo.x.toFixed(1) + ' ' + fo.y.toFixed(1) + ')"><circle r="30" fill="rgba(108,92,231,.14)" stroke="#6c5ce7" stroke-width="3" stroke-dasharray="7 6"/></g>'; } // 여기 근처 표시
    (facs || []).forEach(function (f) { // 편의 시설: 작은 동그라미 (코스 번호 아래)
      var o = proj(f.lat, f.lng); if (o.x < 14 || o.x > pick.w - 14 || o.y < 14 || o.y > pick.h - 14) return;
      svg += '<g transform="translate(' + o.x.toFixed(1) + ' ' + o.y.toFixed(1) + ')"><circle r="11" fill="' + (f.kind === 'info' ? '#1f8a4c' : f.kind === 'tour' ? '#0b3d91' : '#2f6fdc') + '" stroke="#fff" stroke-width="3"/><text y="5" text-anchor="middle" font-size="13" font-weight="700" fill="#fff">' + esc(f.label) + '</text></g>';
    });
    var pn = 0;
    (pois || []).forEach(function (g) { // 식당·숙소: 묶음은 숫자 동그라미, 코스·눌러 정한 자리 둘레 낱개는 작은 동그라미 + 그림 (50개까지)
      if (pn >= 50) return; var o = proj(g.lat, g.lng); if (o.x < 16 || o.x > pick.w - 16 || o.y < 16 || o.y > pick.h - 16) return;
      if (g.n > 1 && pts.some(function (cp) { var q = proj(cp.lat, cp.lng); var hw = cp.st ? Math.max(76, 28 + String(cp.label).length * 24) / 2 : 20; return Math.abs(q.x - o.x) < hw + 17 && Math.abs(q.y + (cp.dy || 0) - o.y) < 37; })) return; // 코스 번호·출발 표시 위(약 30px 안)에는 묶음 숫자를 얹지 않는다
      pn++;
      if (g.n > 1) { svg += '<g class="spoi" data-clu="' + g.lat.toFixed(5) + ',' + g.lng.toFixed(5) + '" transform="translate(' + o.x.toFixed(1) + ' ' + o.y.toFixed(1) + ')"><circle class="hit" r="26" fill="transparent"/><circle r="17" fill="' + POI_COLOR[g.kind] + '" stroke="#fff" stroke-width="3"/><text y="5" text-anchor="middle" font-size="14" font-weight="800" fill="#fff">' + g.n + '</text></g>'; return; }
      var p = g.p;
      svg += '<g class="spoi" data-poi="' + p.id + '" transform="translate(' + o.x.toFixed(1) + ' ' + o.y.toFixed(1) + ')"><circle class="hit" r="26" fill="transparent"/>' + (S.poiSel === p.id ? '<circle r="21" fill="none" stroke="#0f4c81" stroke-width="4"/>' : '') + '<circle r="13" fill="' + POI_COLOR[p.kind] + '" stroke="#fff" stroke-width="3"/><g transform="translate(-8 -8) scale(.67)" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' + POI_ICON[p.kind] + '</g></g>';
    });
    pts.slice().sort(function (x, y) { return (x.st ? 1 : 0) - (y.st ? 1 : 0); }).forEach(function (p) { // 출발·숙소·도착 표시는 번호 위에
      var o = proj(p.lat, p.lng); if (o.x < 0 || o.x > pick.w || o.y < 0 || o.y > pick.h) return;
      var w = p.st ? Math.max(76, 28 + String(p.label).length * 24) : 40;
      if (!p.st) { // 2026-10-21 시안: 물방울 번호 핀(끝이 그 자리) + 이름표(코스 장소만, 겹치면 빼고 번호만 — 이름은 아래 목록에)
        if (!lblBoxes) { lblBoxes = []; pts.forEach(function (q) { var qo = proj(q.lat, q.lng); lblBoxes.push({ x: qo.x - 22, y: qo.y + (q.dy || 0) - 58, w: 44, h: 58, pin: q }); }); }
        svg += '<g transform="translate(' + o.x.toFixed(1) + ' ' + (o.y + (p.dy || 0)).toFixed(1) + ')"><path d="M0 0 C-6 -12 -21 -20 -21 -35 A21 21 0 1 1 21 -35 C21 -20 6 -12 0 0 Z" fill="' + (p.color || '#121212') + '" stroke="#fff" stroke-width="4"/><text y="-27" text-anchor="middle" font-size="22" font-weight="800" fill="#fff">' + esc(p.label) + '</text>' +
          (p.short && lblFree(o.x + 24, o.y + (p.dy || 0) - 48, String(p.short).length * 19 + 8, 28) ? '<text x="26" y="-28" font-size="19" font-weight="800" fill="#121212" stroke="#fff" stroke-width="6" paint-order="stroke" stroke-linejoin="round">' + esc(p.short) + '</text>' : '') + '</g>';
        return;
      }
      svg += '<g transform="translate(' + o.x.toFixed(1) + ' ' + (o.y + (p.dy || 0)).toFixed(1) + ')"><rect x="' + (-w / 2) + '" y="-20" width="' + w + '" height="40" rx="20" fill="' + (p.st ? '#ffb02e' : '#121212') + '" stroke="#fff" stroke-width="4"/><text y="8" text-anchor="middle" font-size="' + (p.st ? 22 : 24) + '" font-weight="800" fill="' + (p.st ? '#2a1500' : '#fff') + '">' + esc(p.label) + '</text></g>';
    });
    if (meSlot) svg += '<g id="lvMeG" visibility="hidden"><circle id="lvMeAcc" r="0" fill="rgba(26,115,232,.16)" stroke="rgba(26,115,232,.5)" stroke-width="2"/><circle r="10" fill="#1a73e8" stroke="#fff" stroke-width="4"/></g>'; // 실시간 안내: 내 위치 점
    staticMapHtml.pick = pick; staticMapHtml.proj = proj;
    return '<div class="smap"><img src="' + esc(pick.src) + '" alt="코스 지도 그림 (미리 받아 둔 카카오 지도)" width="' + pick.w + '" height="' + pick.h + '"><svg viewBox="0 0 ' + pick.w + ' ' + pick.h + '" aria-hidden="true">' + svg + '</svg></div>';
  }
  function mapFail() {
    mapState = 'fail'; mapApi = null;
    $('map').hidden = true; $('mapNote').hidden = false; $('mapFallback').hidden = false;
    $('mapNote').textContent = '지도 그림 © Kakao (미리 받아 둔 그림) · 선: 카카오 길찾기 기준 (보라 = 걷기, 주황 = 버스, 진한 파랑 = 시티투어버스(정류장을 직선으로 이음), 분홍 = 택시·자가용, 점선 = 어림 직선) · 작은 동그라미: 주황 포크 = 식당, 보라 침대 = 숙소, 회색 별 = 코스에 없는 볼거리 · 번호 핀 색: 파랑 = 바다·자연, 주황 = 먹거리·시장, 초록 = 볼거리 (여러 날이면 날짜 색)';
    drawMap();
  }
  function bootMap() {
    if (mapState !== 'idle') return;
    var key = String(window.KAKAO_JS_KEY || '').trim();
    if (!key) { mapFail(); return; }
    mapState = 'loading';
    loadKakao(key, function () {
      try {
        var km = kakao.maps, el = $('map');
        var map = new km.Map(el, { center: new km.LatLng(37.5498, 129.1167), level: 6 });
        map.addControl(new km.ZoomControl(), km.ControlPosition.RIGHT);
        km.event.addListener(map, 'dragend', function () { if (S.screen === 's-map' && layPoi()) { drawMap(true); } }); // 끌어서 옮기면 그 화면의 식당으로 다시 고른다
        km.event.addListener(map, 'zoom_changed', function () { if (S.screen === 's-map' && layPoi()) { drawMap(true); } }); // 확대 수준이 바뀌면 보여 줄 곳 수를 다시 맞춘다
        var ovs = [], lines = [], tiles = false;
        km.event.addListener(map, 'tilesloaded', function () { tiles = true; });
        mapApi = {
          set: function (pts, segs, facs, pois, focus, keep) {
            ovs.forEach(function (o) { o.setMap(null); }); ovs = []; lines.forEach(function (l) { l.setMap(null); }); lines = [];
            var b = new km.LatLngBounds(), path = [];
            pts.forEach(function (p) {
              var pos = new km.LatLng(p.lat, p.lng); path.push(pos); b.extend(pos);
              var d = document.createElement('div');
              if (p.st) { d.className = 'kpin st'; d.textContent = p.label; if (p.dy) d.style.transform = 'translateY(' + p.dy + 'px)'; }
              else { d.className = 'kdrop'; d.innerHTML = '<span class="kd-pin"' + (p.color ? ' style="background:' + p.color + '"' : '') + '><i>' + esc(p.label) + '</i></span>' + (p.short ? '<span class="kd-name">' + esc(p.short) + '</span>' : ''); d.title = p.name; } // 2026-10-21 시안: 종류 색 물방울 번호 핀 + 이름표(코스 장소만)
              var ov = new km.CustomOverlay({ position: pos, content: d, xAnchor: 0.5, yAnchor: p.st ? 0.5 : 1, zIndex: p.st ? 9 : 8 }); ov.setMap(map); ovs.push(ov); // 코스 번호·출발·숙소·도착 표시는 식당 묶음(2)·낱개(4) 위에, 출발·도착은 번호 위에
            });
            (segs || []).forEach(function (sg) { // 실제 길(카카오 길찾기) 선. 길 값이 없는 구간은 점선 직선
              var st = SEG[sg.kind] || SEG.est;
              var ln = new km.Polyline({ path: sg.path.map(function (q) { return new km.LatLng(q.lat, q.lng); }), strokeWeight: st.w, strokeColor: st.c, strokeOpacity: 0.9, strokeStyle: st.dash ? 'shortdash' : 'solid' });
              ln.setMap(map); lines.push(ln);
            });
            (facs || []).forEach(function (f) { // 편의 시설 작은 표시(화장실·관광안내소) — 코스 번호보다 작고 아래에 그린다
              var d = document.createElement('div'); d.className = 'kfac ' + f.kind; d.textContent = f.label; d.title = f.name;
              var ov = new km.CustomOverlay({ position: new km.LatLng(f.lat, f.lng), content: d, xAnchor: 0.5, yAnchor: 0.5, zIndex: 2 }); ov.setMap(map); ovs.push(ov);
            });
            if (focus) { var fd = document.createElement('div'); fd.className = 'kfocus'; var fo = new km.CustomOverlay({ position: new km.LatLng(focus.lat, focus.lng), content: fd, xAnchor: 0.5, yAnchor: 0.5, zIndex: 1 }); fo.setMap(map); ovs.push(fo); }
            var prj = null; try { prj = map.getProjection(); } catch (e) { prj = null; }
            var pp = prj ? pts.map(function (q) { var c = prj.containerPointFromCoords(new km.LatLng(q.lat, q.lng)); return { x: c.x, y: c.y + (q.dy || 0), hw: q.st ? Math.max(26, 14 + String(q.label).length * 9) : 18 }; }) : []; // 코스 표시의 화면 자리(눌림 칸 크기)
            (pois || []).forEach(function (p) { // 식당·숙소: 44px 눌림 칸 안에 작은 동그라미 (n>1 이면 숫자 묶음)
              if (p.n > 1) {
                if (prj && pp.length) { var cq = prj.containerPointFromCoords(new km.LatLng(p.lat, p.lng)); if (pp.some(function (q) { return Math.abs(q.x - cq.x) < q.hw + 20 && Math.abs(q.y - cq.y) < 38; })) return; } // 코스 표시 가까이(약 30px 안)에는 묶음 숫자를 두지 않는다
                var cb = document.createElement('button'); cb.type = 'button'; cb.className = 'kclu ' + p.kind + (p.n >= 100 ? ' big' : ''); cb.setAttribute('aria-label', POI_NAME[p.kind] + ' ' + p.n + '곳 묶음, 누르면 확대'); cb.innerHTML = '<i>' + p.n + '</i>';
                cb.addEventListener('click', function (e) { e.stopPropagation(); mapApi.zoomAt(p.lat, p.lng); });
                var co = new km.CustomOverlay({ position: new km.LatLng(p.lat, p.lng), content: cb, xAnchor: 0.5, yAnchor: 0.5, zIndex: 2, clickable: true }); co.setMap(map); ovs.push(co); return;
              }
              p = p.p;
              var d = document.createElement('button'); d.type = 'button'; d.className = 'kpoi ' + p.kind + (S.poiSel === p.id ? ' on' : ''); d.setAttribute('aria-label', p.name + ' ' + p.type); d.innerHTML = '<i>' + poiSvg(p.kind) + '</i>';
              d.addEventListener('click', function (e) { e.stopPropagation(); selectPoi(p.id, true); });
              var ov = new km.CustomOverlay({ position: new km.LatLng(p.lat, p.lng), content: d, xAnchor: 0.5, yAnchor: 0.5, zIndex: S.poiSel === p.id ? 6 : 4, clickable: true }); ov.setMap(map); ovs.push(ov);
            });
            if (keep) return;
            setTimeout(function () { if (S.screen === 's-map' && layPoi()) drawMap(true); }, 80); // 맞춘 화면 기준으로 보여 줄 곳을 한 번 더 고른다
            if (focus && !path.length) { map.setCenter(new km.LatLng(focus.lat, focus.lng)); map.setLevel(4); }
            else if (focus) { map.setCenter(new km.LatLng(focus.lat, focus.lng)); map.setLevel(4); }
            else if (path.length) map.setBounds(b, 40, 40, 40, 40);
            else if (pois && pois.length) { map.setCenter(new km.LatLng(37.5198, 129.1105)); map.setLevel(7); }
          },
          focus: function (p) { try { map.setCenter(new km.LatLng(p.lat, p.lng)); } catch (e) { /* 무시 */ } },
          level: function () { try { return map.getLevel(); } catch (e) { return null; } },
          center: function () { try { var c = map.getCenter(); return { lat: c.getLat(), lng: c.getLng() }; } catch (e) { return null; } },
          bounds: function () { try { var b = map.getBounds(), sw = b.getSouthWest(), ne = b.getNorthEast(), pl = (ne.getLat() - sw.getLat()) * 0.15, pg = (ne.getLng() - sw.getLng()) * 0.15; return { s: sw.getLat() - pl, w: sw.getLng() - pg, n: ne.getLat() + pl, e: ne.getLng() + pg }; } catch (e) { return null; } },
          setLevel: function (n) { try { map.setLevel(n); } catch (e) { /* 무시 */ } },
          zoomAt: function (la, ln) { try { map.setCenter(new km.LatLng(la, ln)); map.setLevel(Math.max(1, map.getLevel() - 2), { animate: false }); } catch (e) { /* 무시 */ } },
          resize: function () { try { var c = map.getCenter(); map.relayout(); map.setCenter(c); } catch (e) { /* 무시 */ } }
        };
        mapState = 'ok';
        // 폰을 돌리거나 폴드를 펼치면 화면 폭이 바뀜 → 지도 다시 맞추기
        var rz = null;
        window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { if (mapApi) { mapApi.resize(); drawMap(); } }, 200); });
        setTimeout(function () { if (!tiles && mapState === 'ok') mapFail(); }, 9000); // 등록 안 된 주소 등으로 지도 조각이 안 오면 글 안내
        drawMap();
      } catch (e) { mapFail(); }
    }, mapFail);
  }
  /* 겹치는 역·숙소 표시: 400m 안이면 한 표시로 합치고("출발·도착", "숙소·도착"), 가까운 다른 점과 겹치면 위·아래로 띄운다 */
  function declutterPts(pts) {
    var out = [];
    pts.forEach(function (p) {
      var near = p.st ? out.filter(function (q) { return q.st && P.hav(q, p) < 0.4; })[0] : null;
      if (near) { if (near.label.split('·').indexOf(p.label) < 0) near.label += '·' + p.label; near.name += ' · ' + p.name; }
      else out.push({ lat: p.lat, lng: p.lng, label: p.label, st: p.st, name: p.name, short: p.short, color: p.color });
    });
    var up = 0;
    out.forEach(function (q) {
      if (!q.st) return;
      var crowd = out.some(function (r) { return r !== q && P.hav(q, r) < 1.2; });
      if (crowd) { q.dy = up % 2 === 0 ? -34 : 34; up++; }
    });
    return out;
  }
  function drawMap(keep) {
    var pl = S.plan; if (!pl) return;
    if (S.screen !== 's-map') return;
    if (mapState === 'idle') { bootMap(); }
    var pts = [{ lat: pl.startStation.lat, lng: pl.startStation.lng, label: '출발', st: true, name: pl.startStation.name }];
    if (pl.multi) {
      var gi = 0, stayDone = false;
      pl.days.forEach(function (d, di) {
        placeStops(d.plan.stops).forEach(function (s) { pts.push({ lat: s.place.lat, lng: s.place.lng, label: String(++gi), name: s.place.name, short: s.place.short, color: OV ? OV.dayColor(di, pl.days.length) : '' }); });
        if (d.stay && !stayDone) { stayDone = true; pts.push({ lat: d.stay.lat, lng: d.stay.lng, label: '숙소', st: true, name: d.stay.name + ' (숙소 자리)' }); }
      });
      pts.push({ lat: pl.endStation.lat, lng: pl.endStation.lng, label: '도착', st: true, name: pl.endStation.name });
    } else {
      placeStops(pl.stops).forEach(function (s, i) { pts.push({ lat: s.place.lat, lng: s.place.lng, label: String(i + 1), name: s.place.name, short: s.place.short, color: CAT[catOf(s.place)].c }); });
      if (pl.tomorrow) pts.push({ lat: pl.tomorrow.place.lat, lng: pl.tomorrow.place.lng, label: String(placeStops(pl.stops).length + 1), name: pl.tomorrow.place.name, short: pl.tomorrow.place.short, color: CAT[catOf(pl.tomorrow.place)].c });
      if (pl.endStation !== pl.startStation && !pl.tomorrow) pts.push({ lat: pl.endStation.lat, lng: pl.endStation.lng, label: '도착', st: true, name: pl.endStation.name });
    }
    pts = declutterPts(pts);
    var segs = mapSegs(pl), facs = facMarks().concat(tourMarks(pl)), lay = S.mapLay, focus = S.mapFocus;
    var pois = layPoi() ? (mapState === 'ok' && mapApi ? poiGroups(mapApi.level(), mapApi.bounds(), null, mapApi.center()) : poiGroups(focus ? 5 : 8, null, pts.concat(focus ? [focus] : []), focus || null)) : [];
    if (!lay.course) { pts = []; segs = []; facs = []; }
    if (mapState === 'ok' && mapApi) { mapApi.set(pts, segs, facs, pois, focus, keep); }
    renderPoiUi();
    if (mapState === 'fail') {
      var sm = staticMapHtml(pts, segs, facs, false, pois, focus);
      $('mapFallback').innerHTML = sm + '<p class="fbtxt"' + (lay.course ? '' : ' hidden') + '><b>' + (sm ? '실시간 지도 대신 미리 받아 둔 지도 그림이에요.' : '지도를 불러오지 못했어요.') + '</b> 순서대로 가시면 돼요.<br>' +
        pts.map(function (p) { return esc(p.name); }).join(' → ') + '</p>';
    }
  }

  /* ---------- 실시간 여행 안내 (2026-10-17) — 코스(고친 코스 포함)를 따라가며 길 안내 ----------
     계산(도착 감지 · 남은 시간 · 늦음 · 길 벗어남 · 걷기 안내 · 가상 이동)은 live.js, 늦을 때 고치는 방법은 editor.js fixes 를 그대로 쓴다.
     내 위치는 이 기기 안에서만 계산하고 어디로도 보내지 않는다. 저장하는 것은 진행 상황(몇 번째 장까지)뿐(localStorage tour.live.v1). */
  var K_LV = 'tour.live.v1', BUNDLE = !!window.TOUR_BUNDLE;
  var lv = null, lvAskDi = 0, lvMapObj = null, lvMapMode = '', lvCloseT = null;
  function lvGpsOk() { return !BUNDLE && !!(navigator.geolocation && navigator.geolocation.watchPosition); }
  function lvNowMin() { var d = new Date(); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; }
  function lvClock() { return lv.sim ? lv.sim.clock() : lvNowMin(); }
  function lvTrips() { return LV.buildTrips(S.plan, { slow: isSlow() }); }
  function lvDayAuto() {
    var pl = S.plan; if (!pl || !pl.multi) return 0;
    var t = todayIso(); for (var i = 0; i < pl.days.length; i++) if (pl.days[i].date === t) return i;
    return 0;
  }
  var LV_MODE = { walk: '걸어서', bus: '버스', taxi: '택시', car: '자가용', tour: '시티투어' };

  /* --- 시작 전 안내 창 --- */
  function lvOpenAsk(di) {
    if (!LV || !S.plan || !S.plan.stops.length) { flash('코스가 있어야 여행 길안내를 시작할 수 있어요'); return; }
    var trips = lvTrips(), tr = trips[di] || trips[0]; lvAskDi = trips.indexOf(tr);
    var m = tr.nodes.length - 2;
    $('lvAskDay').textContent = (S.plan.multi ? tr.label + ' · ' : '') + '장소 ' + m + '곳 · ' + hhmm(tr.nodes[0].arrive) + ' ' + tr.nodes[0].place.name + '에서 출발';
    $('lvAskGps').hidden = !lvGpsOk(); $('lvAskBundle').hidden = lvGpsOk();
    var sv = jget(K_LV, null), can = !!(sv && sv.sig === edSig() && sv.di === lvAskDi && sv.k > 1 && sv.k <= tr.nodes.length - 1 && lvGpsOk());
    $('lvAskResume').hidden = !can;
    if (can) $('lvAskResume').textContent = '이어서 하기 (' + Math.min(sv.k, m) + '번째 장 가는 길부터)';
    $('lvAsk').hidden = false; document.body.classList.add('sh-open');
    var c = $('lvAskCard'); c.scrollTop = 0; try { c.focus(); } catch (e) { /* 무시 */ }
  }
  function lvCloseAsk() { var a = $('lvAsk'); if (!a || a.hidden) return; a.hidden = true; document.body.classList.remove('sh-open'); }
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-live]'); if (b) { var v = b.getAttribute('data-live'); lvOpenAsk(v === 'auto' ? lvDayAuto() : +v); return; }
    if (ev.target.closest('[data-lvask="close"]')) lvCloseAsk();
  });
  $('lvAskGo').addEventListener('click', function () { lvCloseAsk(); lvStart('gps', lvAskDi, false); });
  $('lvAskResume').addEventListener('click', function () { lvCloseAsk(); lvStart('gps', lvAskDi, true); });
  $('lvAskSim').addEventListener('click', function () { lvCloseAsk(); lvStart('sim', lvAskDi, false); });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !$('lvAsk').hidden) lvCloseAsk(); });

  /* --- 시작·끝 --- */
  function lvStart(mode, di, resume) {
    var trips = lvTrips(), trip = trips[di]; if (!trip) return;
    lvStop(true);
    var ses = new LV.Session(trip);
    lv = { trip: trip, di: di, ses: ses, sim: null, paused: false, watch: null, timer: null, wake: null, wakeState: '', follow: true, story: !S.muteAuto, walk: true, full: false, dismissed: null, fixes: null, fixAt: 0, fixKey: '', fixBase: null,
      denied: '', myPos: null, off: false, arrNode: null, needTap: '', finished: false, mode: mode, sig: {} };
    var now;
    if (mode === 'sim') { lv.sim = new LV.Sim(ses); lv.sim.setSpeed(30); now = lv.sim.clock(); ses.start(now, lv.sim.tms()); }
    else {
      now = lvNowMin();
      var dayOk = !trip.date || trip.date === todayIso(), t0 = trip.nodes[0].arrive;
      if (!dayOk || now < t0 - 90 || now > trip.meta.deadline + 30) { LV.shiftTrip(trip, Math.round(now - t0)); lv.practice = true; } // 연습: 시각을 지금에 맞춤
      ses.start(now, Date.now());
      var sv = jget(K_LV, null);
      if (resume && sv && sv.sig === edSig()) ses.restore(sv, now);
    }
    $('live').hidden = false; document.body.classList.add('lv-open');
    $('lvCloseTxt').textContent = '끝내기';
    lvBuildSheet(); lvMapInit(); lvFollowUi();
    if (mode === 'gps') {
      try { lv.watch = navigator.geolocation.watchPosition(lvOnPos, lvOnErr, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 }); } catch (e) { lvOnErr({ code: 2 }); }
    }
    lv.timer = setInterval(lvLoop, lv.sim ? 250 : 1000);
    lvWake(true);
    logEvent('live-start', { mode: mode, di: di });
    lvRender(true);
  }
  function lvStop(silent) {
    if (!lv) return;
    clearInterval(lv.timer); clearTimeout(lvCloseT);
    if (lv.watch != null) { try { navigator.geolocation.clearWatch(lv.watch); } catch (e) { /* 무시 */ } }
    lvWake(false); stopSpeak();
    if (!lv.finished && lv.mode === 'gps') lvSave();
    lv = null;
    $('live').hidden = true; document.body.classList.remove('lv-open');
    if (lvMapObj && lvMapObj.destroy) lvMapObj.destroy();
    lvMapObj = null; lvMapMode = '';
    if (!silent) logEvent('live-stop');
  }
  function lvSave() {
    if (!lv || lv.mode !== 'gps' || lv.finished) return;
    var o = lv.ses.save(); o.sig = edSig(); o.di = lv.di; o.ts = Date.now();
    lsSet(K_LV, JSON.stringify(o));
  }
  function lvWake(on) {
    if (!lv) return;
    try {
      if (on) {
        if (!('wakeLock' in navigator)) { lv.wakeState = 'none'; return; }
        navigator.wakeLock.request('screen').then(function (w) { if (!lv) { try { w.release(); } catch (e) { /* 무시 */ } return; } lv.wake = w; lv.wakeState = 'on'; w.addEventListener('release', function () { if (lv && lv.wake === w) { lv.wake = null; lv.wakeState = 'off'; } }); }).catch(function () { if (lv) lv.wakeState = 'none'; });
      } else if (lv.wake) { var w2 = lv.wake; lv.wake = null; w2.release(); }
    } catch (e) { if (lv) lv.wakeState = 'none'; }
  }
  document.addEventListener('visibilitychange', function () { if (lv && !lv.finished && document.visibilityState === 'visible' && !lv.wake) lvWake(true); });

  /* --- 위치 받기 / 시간 흐름 --- */
  function lvOnPos(p) {
    if (!lv || lv.sim) return;
    var c = p.coords; lv.denied = ''; lv.myPos = { lat: c.latitude, lng: c.longitude, acc: c.accuracy || 0 };
    lvHandle(lv.ses.setPosition(c.latitude, c.longitude, c.accuracy || 0, Date.now(), lvNowMin()));
    lvMoveMe(); lvRender();
  }
  function lvOnErr(e) {
    if (!lv) return;
    var code = e && e.code;
    lv.denied = code === 1 ? '위치 권한이 꺼져 있어요. 폰 설정에서 이 사이트의 위치를 허용하면 안내가 시작돼요.' : code === 3 ? '위치를 찾는 데 오래 걸려요. 하늘이 보이는 곳에서 다시 시도해 보세요.' : '이 기기에서 위치를 알 수 없어요.';
    lvRender(true);
  }
  function lvLoop() {
    if (!lv) return;
    var ev;
    if (lv.sim) {
      if (lv.paused) { lvRender(); return; }
      lv.sim.step(0.25 * lv.sim.speed / 60);
      var p = lv.sim.pos(); lv.myPos = { lat: p.lat, lng: p.lng, acc: 12 };
      ev = lv.ses.setPosition(p.lat, p.lng, 12, lv.sim.tms(), lv.sim.clock());
    } else ev = lv.ses.tick(Date.now(), lvNowMin());
    lvHandle(ev); lvMoveMe(); lvRender();
    if (lv && lv.sim && lv.ses.phase === 'done') clearInterval(lv.timer);
  }

  /* --- 소리 --- */
  function lvSpeak(text, replace) { // 자동 재생: 브라우저가 막으면(첫 소리는 사용자가 눌러야 하는 기기) "이야기 듣기" 단추로 안내
    if (!canSpeak() || !text) return false;
    try {
      if (replace) window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text), started = false; u.lang = 'ko-KR'; u.rate = 0.92;
      u.onstart = function () { started = true; if (lv) lv.needTap = ''; };
      u.onerror = function (e) { if (lv && !started && e && (e.error === 'not-allowed' || e.error === 'audio-busy' || e.error === 'synthesis-failed')) { lv.needTap = text; lvRender(true); } };
      window.speechSynthesis.speak(u);
      setTimeout(function () { if (lv && !started && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) { lv.needTap = text; lvRender(true); } }, 2500);
      return true;
    } catch (e) { return false; }
  }
  function lvBuzz(ms) { try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(ms); } catch (e) { /* 무시 */ } } // 화면을 한 번도 안 눌렀으면 브라우저가 진동을 막는다

  /* --- 사건(도착·떠남·걷기 안내·길 벗어남) --- */
  function lvStoryText(node) {
    var p = PLACE[node.id]; if (!p) return '';
    return AI.aiStory(p, S.cond).speak;
  }
  function lvHandle(ev) {
    if (!ev || !ev.length || !lv) return;
    ev.forEach(function (e) {
      if (!lv) return;
      if (e.type === 'arrive') {
        if (e.node.kind === 'end') { lv.arrNode = null; return; }
        lv.arrNode = e.node; lv.full = true; lv.needTap = ''; lv.dismissed = null;
        if (S.plan && e.node.id) foldOpen(e.node.id, false); // 도착한 장을 열어 둔다(다른 장은 닫지 않는다)
        logEvent('live-arrive', { id: e.node.id, manual: !!e.manual });
        lvBuzz([180, 80, 180]);
        if (lv.story) lvSpeak(lvStoryText(e.node), true);
      } else if (e.type === 'leave') { lv.arrNode = null; lv.needTap = ''; stopSpeak(); lv.dismissed = null; lv.fixes = null; lv.fixKey = ''; }
      else if (e.type === 'step') { lv.lastStep = e; if (lv.walk) lvSpeak(e.text, false); }
      else if (e.type === 'offroute') { lv.off = true; lvBuzz(300); }
      else if (e.type === 'backonroute') { lv.off = false; }
      else if (e.type === 'skip') { flash('건너뛰었어요'); lv.dismissed = null; lv.fixes = null; lv.fixKey = ''; }
      else if (e.type === 'finish') { lvFinish(); }
    });
    lvSave(); lvRender(true);
    if (lv && lvMapObj && lvMapObj.redraw) lvMapObj.redraw();
  }
  function lvFinish() {
    if (!lv) return;
    lv.finished = true; clearInterval(lv.timer); lv.arrNode = null;
    if (lv.watch != null) { try { navigator.geolocation.clearWatch(lv.watch); } catch (e) { /* 무시 */ } lv.watch = null; }
    lvWake(false); lsDel(K_LV); lv.full = true;
    logEvent('live-finish');
    if (lv.story) lvSpeak('여행을 마쳤어요. 오늘 이야기를 기록 카드로 남겨 보세요.', true);
    $('lvCloseTxt').textContent = '닫기';
  }

  /* --- 늦었을 때: 코스 전체에 되돌려 끼운 "한 번 눌러 고치기" (자동으로 바꾸지 않는다) --- */
  function lvEnvSpec() {
    return S.ed ? { env: edEnv(), spec: S.ed.hist.cur } : { env: { D: D, o: planOpts(), frame: S.plan }, spec: ED.fromPlan(S.plan) };
  }
  function lvComputeFixes(now) {
    var es = lvEnvSpec();
    try { lv.fixes = LV.remainderFixes({ ED: ED, env: es.env, spec: es.spec, di: lv.di, session: lv.ses, now: now }); } catch (e) { lv.fixes = { base: null, fixes: [], problems: [] }; }
    lv.fixAt = Date.now();
  }
  function lvApplyFix(i) {
    var f = lv && lv.fixes && lv.fixes.fixes[i]; if (!f) return;
    var base = lv.fixes.base;
    if (!S.ed) edStart();
    edApply(f.spec, '코스를 고쳤어요: ' + f.label, []);
    lv.ses.rebuild(f.sub, base, { slow: isSlow() });
    if (lv.sim) lv.sim.rebuild();
    lv.fixes = null; lv.fixKey = ''; lv.dismissed = null; lv.needTap = '';
    logEvent('live-fix', { kind: f.kind });
    flash('남은 곳을 고쳤어요: ' + f.label);
    lvSave(); lvRender(true);
    if (lvMapObj && lvMapObj.redraw) lvMapObj.redraw();
  }
  function lvLateText(snap) {
    var L = snap.late, m = lv.ses.meta, how = m.howOut, HN = how === 'bus' ? '버스' : '기차';
    if (L.deadline <= 0) return '마감(' + hhmm(m.deadline) + ')에는 아직 맞아요';
    if (!m.lastDay) return (m.di + 1) + '일차 밤 ' + hhmm(m.deadline) + '까지 숙소에 못 가요 (' + L.deadline + '분 늦음)';
    if (how === 'car') return '이대로면 정한 시각 ' + hhmm(m.train) + '에 ' + L.deadline + '분 늦게 돌아와요';
    if (L.back > m.train) return '이대로면 ' + hhmm(m.train) + ' ' + HN + '를 놓쳐요 (' + Math.round(L.back - m.train) + '분 늦음)';
    return '이대로면 ' + hhmm(m.train) + ' ' + HN + ' 15분 전에 못 닿아요 (' + L.deadline + '분 늦음)';
  }

  /* --- 화면: 틀은 한 번 만들고, 값만 바꾼다(누르는 도중 단추가 바뀌지 않게) --- */
  function lvBuildSheet() {
    $('lvMain').innerHTML =
      '<p class="lv-next" id="lvNext"></p><p class="lv-sub" id="lvSub"></p>' +
      '<div class="lv-chips"><span class="lv-chip" id="lvCnt"></span><span class="lv-chip soft" id="lvClk"></span></div>' +
      '<div id="lvAlerts"></div><div id="lvArr"></div>' +
      '<div class="lv-btnrow"><a class="lv-btn primary" id="lvKmap" target="_blank" rel="noopener"><svg class="ic" aria-hidden="true"><use href="#i-pin"/></svg><span>카카오맵으로 길안내</span></a></div>';
    $('lvMore').innerHTML =
      '<div id="lvStepBox"></div><div id="lvTourBox"></div>' +
      '<div class="lv-btnrow two" id="lvManual"><button type="button" class="lv-btn" data-lv="here">여기 왔어요</button><button type="button" class="lv-btn" data-lv="next">다음 장소로</button><button type="button" class="lv-btn" data-lv="skip">건너뛰기</button></div>' +
      '<div class="lv-tog" role="group" aria-label="소리와 지도 설정">' +
      '<button type="button" class="lv-btn tog" data-lv="story" aria-pressed="true">이야기 소리</button>' +
      '<button type="button" class="lv-btn tog" data-lv="walk" aria-pressed="true">걷기 안내 소리</button>' +
      '</div>' +
      '<div id="lvSimBox"></div>' +
      '<p class="lv-note" id="lvWake"></p>' +
      '<p class="lv-note">내 위치는 이 폰 안에서만 써요. 어디로도 보내지 않고, 저장하는 건 몇 번째 장까지 갔는지뿐이에요.</p>' +
      '<p class="lv-note" id="lvPractice" hidden>연습 중이에요: 여행 날짜·시간이 지금과 달라서 코스 시각을 지금에 맞춰 보여 드려요.</p>' +
      '<p class="lv-note" id="lvKakaoNote">지도 길: 카카오 길찾기 기준 · 도착 시각은 걷는 속도와 교통에 따라 달라질 수 있어요.</p>';
    lv.sig = {};
    var simHtml = '';
    if (lv.sim) {
      simHtml = '<div class="lv-sim"><p class="lv-simh"><b>가상으로 따라가는 중</b> <span class="simchip">시연</span></p>' +
        '<div class="lv-speed" role="group" aria-label="움직이는 속도">' +
        [10, 30, 60].map(function (x) { return '<button type="button" class="lv-btn tog" data-lv="speed" data-x="' + x + '" aria-pressed="' + (x === 30 ? 'true' : 'false') + '">×' + x + '</button>'; }).join('') +
        '<button type="button" class="lv-btn tog" data-lv="pause" aria-pressed="false">잠깐 멈춤</button></div>' +
        '<button type="button" class="lv-btn warnb" data-lv="delay">늦어짐 만들기 (+25분)</button>' +
        '<p class="lv-note">실제 길 위를 시간표대로 움직여요. 도착하면 이야기가 나오고 다음 장으로 넘어가요.</p></div>';
    }
    $('lvSimBox').innerHTML = simHtml;
    $('lvSheet').classList.toggle('full', false); $('lvHandle').setAttribute('aria-expanded', 'false');
    $('lvFollow').hidden = false;
  }
  function lvHtmlOnce(id, key, html) { if (lv.sig[id] === key) return false; lv.sig[id] = key; $(id).innerHTML = html; return true; }
  function lvRender(force) {
    if (!lv) return;
    var ses = lv.ses, now = lvClock(), snap = ses.snapshot(now), done = ses.phase === 'done', m = snap.total;
    $('lvSheet').classList.toggle('full', !!lv.full); $('lvHandle').setAttribute('aria-expanded', lv.full ? 'true' : 'false'); $('lvHandle').setAttribute('aria-label', lv.full ? '접기' : '자세히 보기');
    $('lvProg').textContent = done ? '끝!' : Math.min(m, snap.done + (ses.phase === 'travel' ? 1 : 0)) + '/' + m + ' 곳';
    // 큰 줄
    var title, sub = '';
    if (done) { title = '여행을 마쳤어요'; sub = lv.trip.nodes[ses.last()].place.name + ' 도착'; }
    else if (snap.next) {
      title = snap.next.text;
      sub = ses.phase === 'visit' ? '지금: ' + snap.cur.place.name + ' · ' + hhmm(ses.arrivedAt[ses.k]) + ' 도착' : (lv.myPos ? '' : (lv.mode === 'gps' && !lv.denied ? '내 위치를 찾는 중이에요…' : ''));
      if (ses.phase === 'travel' && snap.next.node.arrive != null) sub = (sub ? sub + ' · ' : '') + '도착 예정 ' + hhmm(snap.next.node.arrive);
    }
    $('lvNext').textContent = title; $('lvSub').textContent = sub; $('lvSub').hidden = !sub;
    $('lvCnt').textContent = snap.countdown.text;
    $('lvClk').textContent = (lv.sim ? '시연 시각 ' : '지금 ') + hhmm(Math.floor(now));
    // 알림(늦음 · 길 벗어남 · 위치 못 씀)
    var al = '', key = '';
    if (lv.denied) {
      key += 'D' + lv.denied;
      al += '<div class="lv-alert bad" role="alert"><b>위치를 쓸 수 없어요</b><span>' + esc(lv.denied) + '</span>' + (lv.mode === 'gps' ? '<button type="button" class="lv-btn" data-lv="tosim">가상으로 따라가 보기</button>' : '') + '</div>';
    }
    if (!done && snap.late.warn) {
      var bucket = Math.floor(snap.late.behind / 5) + '|' + (snap.late.deadline > 0 ? 1 : 0);
      var dis = lv.dismissed && lv.dismissed.b === bucket;
      if (!dis) {
        var fkey = ses.k + '|' + ses.phase; // 가는 곳이 바뀌거나 20초가 지나면 고치는 방법을 다시 구한다(계산이 조금 걸려서)
        if (!lv.fixes || lv.fixKey !== fkey || Date.now() - lv.fixAt > 20000) { lv.fixKey = fkey; lvComputeFixes(now); }
        var fx = lv.fixes ? lv.fixes.fixes : [];
        key += 'L' + bucket + '|' + fx.map(function (x) { return x.label; }).join(',');
        al += '<div class="lv-alert late" role="alert"><b id="lvLateB"></b><span id="lvLateS"></span>' +
          (fx.length ? '<div class="lv-fixes" role="group" aria-label="한 번 눌러 고치기">' + fx.map(function (f, i) { return '<button type="button" class="lv-fix" data-lv="fix" data-i="' + i + '"><b>' + esc(f.label) + '</b><span>' + esc(f.detail) + '</span></button>'; }).join('') + '</div>'
            : '<span class="lv-none">이 시간에 바로 줄일 방법이 없어요. 서두르거나 카카오맵으로 빠른 길을 찾아보세요.</span>') +
          '<button type="button" class="lv-btn ghost" data-lv="dismiss" data-b="' + bucket + '">그냥 갈게요</button><span class="lv-note">누르기 전에는 코스를 바꾸지 않아요.</span></div>';
      }
    }
    if (lv.off && ses.phase === 'travel') {
      key += 'O';
      al += '<div class="lv-alert soft" role="status"><b>길에서 벗어난 것 같아요</b><span>가던 길에서 많이 떨어졌어요. 카카오맵 길안내를 눌러 지금 위치에서 다시 길을 찾아보세요.</span></div>';
    }
    var ra = liveAlertList();
    if (ra.length) { var rv = S.raMore ? ra : ra.slice(0, 2); key += 'R' + rv.map(function (a) { return a.key + a.reports + a.yes + a.no + (nearState(a.placeId).ok ? 1 : 0) + Math.max(0, Math.round(S.simNow - a.latest)); }).join(',') + (S.raMore ? 'm' : '') + ra.length; al += rv.map(function (a, i) { return raItemHtml(a, i > 0); }).join('') + (ra.length > 2 ? '<button type="button" class="ra-more" data-ra="more">' + (S.raMore ? '접기' : '더 보기 (' + (ra.length - 2) + '건)') + '</button>' : ''); }
    lvHtmlOnce('lvAlerts', key || '-', al);
    if ($('lvLateB')) { $('lvLateB').textContent = '예정보다 ' + Math.max(snap.late.behind, snap.late.deadline) + '분 늦어요'; $('lvLateS').textContent = lvLateText(snap); }
    // 도착 카드(이야기)
    var an = lv.arrNode && ses.phase === 'visit' ? lv.arrNode : null, ak = an ? an.id + '|' + (lv.needTap ? 1 : 0) + '|' + (lv.story ? 1 : 0) : (done ? 'done' : '-');
    if (lv.sig.lvArr !== ak) {
      lv.sig.lvArr = ak; var h = '';
      if (an) {
        var p = PLACE[an.id], st = AI.aiStory(p, S.cond);
        h = '<div class="lv-arr"><div class="lv-arr-h"><span class="lv-av">' + ART.svg(p.id) + '</span><div><b>' + esc(p.name) + '에 도착했어요</b><span>' + ses.nodes.indexOf(an) + '/' + m + ' 곳 · ' + esc(p.openText ? '운영 ' + p.openText : '') + '</span></div></div>';
        h += '<p class="lv-arr-t">' + esc(st.text) + '</p><p class="lv-note">출처: ' + esc(st.source) + '</p>';
        h += (lv.needTap ? '<p class="lv-tap">소리가 안 나면 아래 단추를 눌러 주세요.</p>' : '') + '<button type="button" class="lv-btn primary" data-lv="listen" data-label="이야기 듣기">이야기 듣기</button></div>';
      } else if (done) {
        h = '<div class="lv-arr done"><b>오늘 여행을 마쳤어요</b><p class="lv-arr-t">수고하셨어요. 오늘 다닌 곳을 기록 카드로 남겨 볼까요?</p><button type="button" class="lv-btn primary" data-lv="card">기록 카드 보기</button></div>';
      }
      $('lvArr').innerHTML = h;
    }
    // 길안내 단추
    var kl = $('lvKmap');
    if (snap.next && !done) { kl.hidden = false; kl.href = snap.next.link.url; kl.querySelector('span').textContent = snap.next.link.label; } else kl.hidden = true;
    // 걷기 안내 · 시티투어 탑승
    var sh = '';
    if (snap.step && ses.phase === 'travel') sh = '<div class="lv-step"><b>걷기 안내</b><p>' + esc(snap.step.text) + '</p><span>' + (snap.step.distM != null ? '안내 지점까지 ' + LV.meters(snap.step.distM) + ' · ' : '') + (snap.step.j + 1) + '/' + snap.step.of + '</span></div>';
    lvHtmlOnce('lvStepBox', sh, sh);
    var th = '';
    if (snap.next && snap.next.tourBoard) th = '<div class="lv-tour"><b>시티투어버스</b><p>' + esc(snap.next.tourBoard.text) + '</p></div>';
    lvHtmlOnce('lvTourBox', th, th);
    // 손으로 하는 단추 · 소리 설정 상태
    var mn = $('lvManual'); mn.querySelector('[data-lv="here"]').hidden = ses.phase !== 'travel';
    mn.querySelector('[data-lv="next"]').hidden = ses.phase !== 'visit';
    mn.querySelector('[data-lv="skip"]').hidden = !(ses.phase === 'travel' && ses.k < ses.last());
    mn.hidden = done;
    $('lvMore').querySelector('[data-lv="story"]').setAttribute('aria-pressed', lv.story ? 'true' : 'false');
    $('lvMore').querySelector('[data-lv="walk"]').setAttribute('aria-pressed', lv.walk ? 'true' : 'false');
    $('lvMore').querySelector('[data-lv="walk"]').hidden = !canSpeak();
    $('lvMore').querySelector('[data-lv="story"]').hidden = !canSpeak();
    $('lvPractice').hidden = !lv.practice;
    $('lvWake').textContent = lv.wakeState === 'on' ? '화면이 꺼지지 않게 켜 두었어요.' : lv.wakeState === 'none' ? '이 폰에서는 화면 켜 두기를 못 해요. 화면이 꺼지지 않게 직접 설정해 주세요.' : '';
    // 가상 이동 단추 상태
    if (lv.sim) {
      Array.prototype.forEach.call($('lvSimBox').querySelectorAll('[data-lv="speed"]'), function (b) { b.setAttribute('aria-pressed', +b.getAttribute('data-x') === lv.sim.speed ? 'true' : 'false'); });
      var pb = $('lvSimBox').querySelector('[data-lv="pause"]'); if (pb) { pb.setAttribute('aria-pressed', lv.paused ? 'true' : 'false'); pb.textContent = lv.paused ? '계속 가기' : '잠깐 멈춤'; }
    }
  }
  /* 누르는 곳 */
  $('live').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-lv]'); if (!b || !lv) return;
    var act = b.getAttribute('data-lv'), ses = lv.ses, now = lvClock();
    if (act === 'fix') { lvApplyFix(+b.getAttribute('data-i')); return; }
    if (act === 'dismiss') { lv.dismissed = { b: b.getAttribute('data-b') }; lvRender(true); return; }
    if (act === 'listen') {
      var an = lv.arrNode; if (!an) return;
      if (!say(lvStoryText(an), b)) flash('이 기기는 소리 안내가 안 돼요. 글을 읽어 주세요.');
      lv.needTap = ''; return;
    }
    if (act === 'here') { lvHandle(ses.arriveNow(now, lv.sim ? lv.sim.tms() : Date.now())); return; }
    if (act === 'next') { lvHandle(ses.leaveNow(now)); return; }
    if (act === 'skip') { lvHandle(ses.skipNow(now)); return; }
    if (act === 'story') { lv.story = !lv.story; if (!lv.story) stopSpeak(); lvRender(true); return; }
    if (act === 'walk') { lv.walk = !lv.walk; lvRender(true); return; }
    if (act === 'speed' && lv.sim) { lv.sim.setSpeed(+b.getAttribute('data-x')); lvRender(true); return; }
    if (act === 'pause' && lv.sim) { lv.paused = !lv.paused; lvRender(true); return; }
    if (act === 'delay' && lv.sim) { lv.sim.delay(25); ses.addDelay(25); flash('25분 늦어졌어요 (시연)'); lv.dismissed = null; lvRender(true); return; }
    if (act === 'tosim') { var di = lv.di; lvStop(true); lvStart('sim', di, false); return; }
    if (act === 'card') { lvStop(); renderCard(); show('s-card'); return; }
  });
  $('lvHandle').addEventListener('click', function () { if (!lv) return; lv.full = !lv.full; lvRender(true); });
  (function () { // 손가락으로 끌어올리거나 내리기
    var y0 = null, h = $('lvHandle');
    h.addEventListener('touchstart', function (e) { y0 = e.touches[0].clientY; }, { passive: true });
    h.addEventListener('touchend', function (e) { if (y0 == null || !lv) return; var dy = e.changedTouches[0].clientY - y0; y0 = null; if (dy < -30) { lv.full = true; lvRender(true); e.preventDefault(); } else if (dy > 30) { lv.full = false; lvRender(true); e.preventDefault(); } });
  })();
  $('lvClose').addEventListener('click', function () {
    if (!lv) return;
    if (lv.finished || lv.sim || lvCloseT) { lvStop(); return; }
    $('lvCloseTxt').textContent = '한 번 더 누르면 끝나요';
    lvCloseT = setTimeout(function () { lvCloseT = null; if (lv) $('lvCloseTxt').textContent = '끝내기'; }, 4000);
  });
  $('lvFollow').addEventListener('click', function () { if (!lv) return; lvSetFollow(!lv.follow); if (lv.follow && lv.myPos && lvMapObj && lvMapObj.center) lvMapObj.center(lv.myPos.lat, lv.myPos.lng); });
  function lvSetFollow(on) { if (!lv) return; lv.follow = on; lvFollowUi(); }
  function lvFollowUi() { var b = $('lvFollow'); if (!b || !lv) return; b.setAttribute('aria-pressed', lv.follow ? 'true' : 'false'); }

  /* --- 지도: 카카오 지도(국내) 위에 내 위치 점 · 정확도 원 · 코스 선. 못 불러오면 미리 받아 둔 지도 그림 --- */
  function lvPts() {
    var nodes = lv.ses.nodes, pts = [], n = nodes.length;
    nodes.forEach(function (nd, i) {
      var p = nd.place;
      if (i === 0) pts.push({ lat: p.lat, lng: p.lng, label: '출발', st: true, name: p.name });
      else if (i === n - 1) { if (p !== nodes[0].place || n > 2) pts.push({ lat: p.lat, lng: p.lng, label: '도착', st: true, name: p.name }); }
      else pts.push({ lat: p.lat, lng: p.lng, label: String(i), name: p.name });
    });
    return declutterPts(pts);
  }
  function lvSegsOf(k) { // k 번째 node 로 오는 길
    var nd = lv.ses.nodes[k], prev = lv.ses.nodes[k - 1].place, leg = nd.leg;
    if (leg.mode === 'tour' && leg.tour && leg.tour.segs) return tourSegs({ tour: leg.tour });
    return [segOf(prev, nd.place, { path: leg.path, mode: leg.mode })];
  }
  function lvAllSegs() { var out = []; for (var k = 1; k < lv.ses.nodes.length; k++) out = out.concat(lvSegsOf(k)); return out; }
  function lvMapInit() {
    lvMapObj = null; lvMapMode = ''; $('lvMap').hidden = true; $('lvStatic').hidden = true;
    var key = String(window.KAKAO_JS_KEY || '').trim();
    if (BUNDLE || !key) { lvStaticInit(); return; }
    loadKakao(key, function () { if (!lv) return; try { lvKakaoInit(); } catch (e) { lvStaticInit(); } }, function () { if (lv) lvStaticInit(); });
  }
  function lvKakaoInit() {
    var km = kakao.maps, el = $('lvMap'); el.hidden = false; $('lvStatic').hidden = true; $('lvFollow').hidden = false;
    var map = new km.Map(el, { center: new km.LatLng(37.5498, 129.1167), level: 5 });
    var ovs = [], lines = [], meOv = null, circ = null, tiles = false, drawn = false, tOut = null;
    km.event.addListener(map, 'tilesloaded', function () { tiles = true; });
    km.event.addListener(map, 'dragstart', function () { if (lv) lvSetFollow(false); });
    var obj = {
      redraw: function () {
        if (!lv) return;
        ovs.forEach(function (o) { o.setMap(null); }); ovs = []; lines.forEach(function (l) { l.setMap(null); }); lines = [];
        var b = new km.LatLngBounds();
        lvPts().forEach(function (p) {
          var pos = new km.LatLng(p.lat, p.lng); b.extend(pos);
          var d = document.createElement('div'); d.className = 'kpin' + (p.st ? ' st' : ''); d.textContent = p.label; if (p.dy) d.style.transform = 'translateY(' + p.dy + 'px)';
          var ov = new km.CustomOverlay({ position: pos, content: d, xAnchor: 0.5, yAnchor: 0.5, zIndex: p.st ? 5 : 3 }); ov.setMap(map); ovs.push(ov);
        });
        for (var k = 1; k < lv.ses.nodes.length; k++) {
          var faded = lv.ses.arrivedAt[k] != null || lv.ses.skipped[k];
          lvSegsOf(k).forEach(function (sg) {
            var st = SEG[sg.kind] || SEG.est;
            var ln = new km.Polyline({ path: sg.path.map(function (q) { return new km.LatLng(q.lat, q.lng); }), strokeWeight: st.w, strokeColor: st.c, strokeOpacity: faded ? 0.3 : 0.9, strokeStyle: st.dash ? 'shortdash' : 'solid' });
            ln.setMap(map); lines.push(ln);
          });
        }
        if (!drawn) { drawn = true; map.setBounds(b, 120, 40, 260, 40); }
      },
      setMe: function (lat, lng, acc) {
        var pos = new km.LatLng(lat, lng);
        if (!meOv) { var d = document.createElement('div'); d.className = 'lv-me'; d.setAttribute('aria-label', '내 위치'); meOv = new km.CustomOverlay({ position: pos, content: d, xAnchor: 0.5, yAnchor: 0.5, zIndex: 9 }); meOv.setMap(map); }
        else meOv.setPosition(pos);
        if (!circ) { circ = new km.Circle({ center: pos, radius: Math.max(acc, 5), strokeWeight: 1, strokeColor: '#1a73e8', strokeOpacity: 0.6, fillColor: '#1a73e8', fillOpacity: 0.14 }); circ.setMap(map); }
        else { circ.setPosition(pos); circ.setRadius(Math.max(acc, 5)); }
        if (lv && lv.follow) { try { map.panTo(pos); } catch (e) { /* 무시 */ } }
      },
      center: function (lat, lng) { try { map.panTo(new km.LatLng(lat, lng)); } catch (e) { /* 무시 */ } },
      destroy: function () { clearTimeout(tOut); ovs.forEach(function (o) { o.setMap(null); }); lines.forEach(function (l) { l.setMap(null); }); if (meOv) meOv.setMap(null); if (circ) circ.setMap(null); $('lvMap').innerHTML = ''; }
    };
    lvMapObj = obj; lvMapMode = 'kakao';
    obj.redraw(); if (lv.myPos) obj.setMe(lv.myPos.lat, lv.myPos.lng, lv.myPos.acc);
    tOut = setTimeout(function () { if (!tiles && lv && lvMapMode === 'kakao') { obj.destroy(); lvStaticInit(); } }, 9000); // 등록 안 된 주소 등으로 지도 조각이 안 오면 지도 그림으로
  }
  function lvStaticInit() {
    lvMapMode = 'static'; $('lvMap').hidden = true; var el = $('lvStatic'); el.hidden = false; $('lvFollow').hidden = true; // 지도 그림은 고정이라 따라가기가 없다
    var obj = {
      redraw: function () {
        if (!lv) return;
        var sm = staticMapHtml(lvPts(), lvAllSegs(), [], true);
        el.innerHTML = sm || '<p class="fbtxt">지도 그림을 불러오지 못했어요. 아래 안내를 따라가 주세요.</p>';
        el.insertAdjacentHTML('beforeend', '<p class="lv-credit">지도 그림 © Kakao (미리 받아 둔 그림)</p>');
        if (lv.myPos) obj.setMe(lv.myPos.lat, lv.myPos.lng, lv.myPos.acc);
      },
      setMe: function (lat, lng, acc) {
        var g = document.getElementById('lvMeG'), pj = staticMapHtml.proj, pk = staticMapHtml.pick; if (!g || !pj || !pk) return;
        var o = pj(lat, lng);
        if (o.x < 0 || o.x > pk.w || o.y < 0 || o.y > pk.h) { g.setAttribute('visibility', 'hidden'); return; }
        g.setAttribute('visibility', 'visible'); g.setAttribute('transform', 'translate(' + o.x.toFixed(1) + ' ' + o.y.toFixed(1) + ')');
        var a = document.getElementById('lvMeAcc'); if (a) a.setAttribute('r', Math.max(10, acc / pk.mPerPx).toFixed(1));
      },
      center: function () { /* 지도 그림은 고정 */ },
      destroy: function () { el.innerHTML = ''; }
    };
    lvMapObj = obj; obj.redraw();
  }
  var lvMeAt = 0;
  function lvMoveMe() { if (!lv || !lv.myPos || !lvMapObj) return; var t = Date.now(); if (t - lvMeAt < 250) return; lvMeAt = t; lvMapObj.setMe(lv.myPos.lat, lv.myPos.lng, lv.myPos.acc); }

  /* ---------- 3. 현장 제보 ---------- */
  /* 제보 규칙 (2026-10-18, 신청서 v1.4 핵심기능 2) — 계산은 rep.js.
     ① 그 장소 200m 안에서만 제보 (위치는 근처인지 확인만 · 저장·전송 안 함 · 기록에는 장소와 "근처에서 보냄"만)
     ② 같은 곳·같은 종류를 서로 다른 기기 2대가 60분 안에 알려야 알림이 켜짐 · 마지막 제보 60분 뒤 꺼짐 · "아직 그래요"로 연장 · "아니에요" 2명 이상이고 "아직 그래요"보다 많으면 취소
     ③ 알림은 근처 여행자 코스 위에 뜰 뿐, 코스는 [코스 다시 짜기]를 눌러야 바뀜 */
  function myDev() { // 이 기기의 무작위 번호(localStorage). 코스 없는 제보 창은 "다른 여행자 폰" 역할이라 창마다 따로
    var d;
    if (!S.plan) {
      try { d = sessionStorage.getItem('tour.dev.sess'); if (!d) { d = 'w' + Math.random().toString(36).slice(2, 10); sessionStorage.setItem('tour.dev.sess', d); } return d; } catch (e) { return 'w' + CLIENT; }
    }
    d = lsGet(K_DEV); if (!d) { d = 'd' + Math.random().toString(36).slice(2, 12); lsSet(K_DEV, d); }
    return d;
  }
  function repGpsOk() { return !window.TOUR_BUNDLE && !!(navigator.geolocation && navigator.geolocation.getCurrentPosition); }
  function curFix() { // 지금 쓸 수 있는 위치(메모리에만): 길안내 중이면 그 위치, 아니면 방금 확인한 것(10분 안)
    if (lv && lv.myPos) return { lat: lv.myPos.lat, lng: lv.myPos.lng, acc: lv.myPos.acc, at: Date.now() };
    if (S.fix && Date.now() - S.fix.at < 10 * 60e3) return S.fix;
    return null;
  }
  function nearState(placeId) {
    if (S.demoNear) return { ok: true, state: 'demo', m: null };
    var fix = curFix(), p = PLACE[placeId];
    if (!fix) return { ok: false, state: 'nopos', m: null };
    return REP.checkNear(fix, p);
  }
  /* 위치 쓰기 전에 먼저 알려 주는 창 */
  var locCb = null;
  function openLoc(cb) {
    locCb = cb || null;
    $('repLocGps').hidden = !repGpsOk(); $('repLocNoGps').hidden = repGpsOk(); $('repLocErr').hidden = true; $('repLocGo').disabled = false;
    $('repLoc').hidden = false; document.body.classList.add('sh-open');
    var c = $('repLocCard'); c.scrollTop = 0; try { c.focus(); } catch (e) { /* 무시 */ }
  }
  function closeLoc() { var a = $('repLoc'); if (!a || a.hidden) return; a.hidden = true; document.body.classList.remove('sh-open'); }
  function afterLoc() { var cb = locCb; locCb = null; renderRepLoc(); renderRepPlaces(); renderRepAlerts(); if (lv) lvRender(true); if (cb) cb(); }
  $('repLoc').addEventListener('click', function (ev) { if (ev.target.closest('[data-rloc="close"]')) closeLoc(); });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !$('repLoc').hidden) closeLoc(); });
  $('repLocDemo').addEventListener('click', function () { S.demoNear = true; closeLoc(); afterLoc(); flash('시연: 근처라고 치고 진행해요'); });
  $('repLocGo').addEventListener('click', function () {
    var b = this, err = $('repLocErr'); err.hidden = true; b.disabled = true; b.textContent = '위치를 찾는 중이에요…';
    function fin() { b.disabled = false; b.textContent = '위치 켜고 확인하기'; }
    try {
      navigator.geolocation.getCurrentPosition(function (p) {
        fin(); var c = p.coords; S.fix = { lat: c.latitude, lng: c.longitude, acc: c.accuracy || 9999, at: Date.now() }; // 메모리에만 — 저장도 전송도 하지 않는다
        S.demoNear = false; closeLoc(); afterLoc();
      }, function (e) { fin(); err.hidden = false; err.textContent = e && e.code === 1 ? '위치 권한이 꺼져 있어요. 폰 설정에서 이 사이트의 위치를 허용해 주세요.' : e && e.code === 3 ? '위치를 찾는 데 오래 걸려요. 하늘이 보이는 곳에서 다시 해 주세요.' : '이 기기에서 위치를 알 수 없어요.'; }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    } catch (e2) { fin(); err.hidden = false; err.textContent = '이 기기에서 위치를 알 수 없어요.'; }
  });

  /* 제보 화면: 위치 상태 줄 · 장소 목록(200m 안이 먼저, 먼 곳은 거리와 함께 못 고름) */
  var REP_REGIONS = ['묵호', '천곡', '망상·대진', '추암·북평', '삼화'];
  function repPlaceList() { return D.places.filter(function (p) { return REP_REGIONS.indexOf(p.region) >= 0 && isFinite(p.lat) && isFinite(p.lng); }); }
  function optHtml(p, extra, dis) { return '<option value="' + p.id + '"' + (dis ? ' disabled' : '') + '>' + esc(p.name) + (extra ? ' · ' + extra : '') + '</option>'; }
  function renderRepPlaces() {
    var sel = $('repPlace'), cur = sel.value, fix = curFix(), list = repPlaceList(), sub = '', html = '<option value="">글에서 찾기 (선택 안 함)</option>', pick = '';
    var first = S.plan && S.plan.stops.length ? S.plan.stops.filter(function (s) { return !s.done && !isSlot(s); })[0] : null;
    if (S.demoNear || !fix) {
      html += REP_REGIONS.map(function (rg) { var l = list.filter(function (p) { return p.region === rg; }); return l.length ? '<optgroup label="볼거리 · ' + rg + '">' + l.map(function (p) { return optHtml(p); }).join('') + '</optgroup>' : ''; }).join('');
      sub = S.demoNear ? '시연: 근처라고 쳐서 모든 곳을 고를 수 있어요' : '위치를 확인하면 200m 안의 곳이 먼저 나와요';
      pick = first ? first.id : 'skyvalley';
    } else {
      var sd = REP.sortByDistance(fix, list);
      if (sd.state === 'badacc') { html += '<optgroup label="위치가 정확하지 않아요">' + list.map(function (p) { return optHtml(p, '', true); }).join('') + '</optgroup>'; sub = '위치가 정확하지 않아요 · 밖으로 나와 다시 해 주세요'; }
      else {
        if (sd.near.length) html += '<optgroup label="지금 있는 곳 200m 안">' + sd.near.map(function (x) { return optHtml(x.place, x.m + 'm'); }).join('') + '</optgroup>';
        if (sd.far.length) html += '<optgroup label="200m 밖 · 지금은 제보할 수 없어요">' + sd.far.map(function (x) { return optHtml(x.place, x.m >= 1000 ? (Math.round(x.m / 100) / 10) + 'km' : x.m + 'm', true); }).join('') + '</optgroup>';
        sub = sd.near.length ? sd.near.length + '곳이 200m 안이에요' : '200m 안에 제보할 곳이 없어요 · 가까이 가서 다시 확인해 주세요';
        var inCourse = sd.near.filter(function (x) { return first && x.place.id === first.id; })[0]; pick = inCourse ? inCourse.place.id : (sd.near[0] ? sd.near[0].place.id : '');
      }
    }
    sel.innerHTML = html; $('repPlaceSub').textContent = sub ? '(' + sub + ')' : '';
    var okc = cur && Array.prototype.some.call(sel.options, function (o) { return o.value === cur && !o.disabled; });
    sel.value = okc ? cur : pick; if (sel.selectedIndex < 0) sel.value = '';
  }
  function renderRepLoc() {
    var fix = curFix(), t;
    if (S.demoNear) t = '시연 중이에요: 근처라고 치고 제보해요. 실제로는 그 장소 200m 안에서만 보낼 수 있어요.';
    else if (!fix) t = '제보는 그 장소 200m 안에서만 남길 수 있어요. 위치는 근처인지 확인만 하고 저장·전송하지 않아요.';
    else if (!(fix.acc <= REP.ACC_MAX_M)) t = '위치가 정확하지 않아요 · 밖으로 나와 다시 해 주세요 (오차 약 ' + Math.round(Math.min(fix.acc, 99999)) + 'm).';
    else t = '위치를 확인했어요 (오차 약 ' + Math.round(fix.acc) + 'm). 200m 안의 곳만 제보할 수 있어요.';
    $('repLocMsg').textContent = t; $('repLocBtn').textContent = fix && !S.demoNear ? '위치 다시 확인' : '내 위치로 근처 확인';
    $('repDemoNear').hidden = S.demoNear;
  }
  $('repLocBtn').addEventListener('click', function () { S.demoNear = false; openLoc(); });
  $('repDemoNear').addEventListener('click', function () { S.demoNear = true; renderRepLoc(); renderRepPlaces(); renderRepAlerts(); flash('시연: 근처라고 치고 제보해요'); });
  function openReport() {
    $('repResult').hidden = true;
    renderRepLoc(); renderRepPlaces();
    renderPresets();
    $('repBack').textContent = S.plan ? '코스로 돌아가기' : '처음으로';
    $('repLead').textContent = S.plan ? '본 것을 알려 주면 근처 여행자에게 알림으로 가요. 다시 짤지는 본인이 골라요.' : '이 창은 다른 여행자 폰이에요. 보내면 열려 있는 다른 창에 알림이 가요. 코스는 자동으로 안 바뀌고, 그 창에서 [코스 다시 짜기]를 눌러야 바뀌어요. (시연 시각 ' + hhmm(S.simNow) + ')';
    show('s-report');
  }
  $('s-report').addEventListener('click', function (ev) {
    var t = ev.target.closest('.type'); if (!t) return;
    S.pickedType = t.getAttribute('data-type');
    Array.prototype.forEach.call(document.querySelectorAll('.type'), function (x) { x.setAttribute('aria-checked', x === t ? 'true' : 'false'); });
  });
  /* 코스 정보: 이 창에 코스가 있으면 그것, 없으면(다른 창에서 만든 코스를 보는 제보 창) 저장소에 올려 둔 것 */
  function publishCourse() {
    if (!S.plan) return;
    lsSet(K_COURSE, JSON.stringify({ c: CLIENT, t: Date.now(), simNow: S.simNow, lastDone: S.fixed.length - 1,
      stops: S.plan.stops.map(function (s) { return { id: s.id, short: s.place.short, name: s.place.name, kind: s.kind || '', arrive: s.arrive }; }) }));
  }
  function courseInfo() {
    if (S.plan) return { simNow: S.simNow, lastDone: S.fixed.length - 1, stops: S.plan.stops.map(function (s) { return { id: s.id, short: s.place.short, name: s.place.name, kind: s.kind || '', arrive: s.arrive }; }) };
    return jget(K_COURSE, null);
  }
  /* "다음 장소 줄 20분": 가장 최근 "여기 왔어요" 보다 2장 이상 앞선 첫 볼거리(없으면 3번째 장) — 단추 이름에 그 장소 이름을 넣는다.
     시연이 늘 바뀌게, 보내는 제보 시각은 그 장소 도착 20분 전(= 현장에 있는 다른 여행자가 본 때)으로 한다(붐빔은 60분 동안만 유효). */
  function renderPresets() {
    var b = $('presetNext'), note = $('presetNote'), ci = courseInfo();
    var tg = ci && ci.stops ? P.reportTarget(ci.stops, ci.lastDone) : null;
    note.hidden = false;
    if (!tg) { b.hidden = true; note.textContent = ci && ci.stops ? '코스가 짧아 "다음 장소" 단추는 없어요.' : '다른 창에서 코스를 만들면 "다음 장소" 단추가 여기에 나타나요.'; return; }
    var st = tg.stop;
    b.hidden = false; b.textContent = '다음 장소(' + st.short + ') 줄 20분';
    b.setAttribute('data-place', st.id); b.setAttribute('data-text', st.short + ' 줄 20분'); b.setAttribute('data-sim', String(Math.max(ci.simNow || 0, st.arrive - 20)));
    note.textContent = (ci.lastDone >= 0 ? (ci.lastDone + 1) + '장에 도착한 코스 · ' : '아직 도착한 장이 없는 코스 · ') + '겨냥하는 곳: ' + (tg.index + 1) + '장 ' + st.name + ' (' + hhmm(st.arrive) + ' 도착 예정)';
  }
  /* 한 번에 보내기: 글을 채우고 장소는 글에서 찾게 한 뒤 바로 보낸다(시연용) */
  $('repPresets').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-preset],#presetNext'); if (!b) return;
    if (b.id === 'presetNext') { $('repText').value = b.getAttribute('data-text'); $('repPlace').value = b.getAttribute('data-place'); S.presetSim = +b.getAttribute('data-sim'); }
    else { $('repText').value = b.getAttribute('data-preset'); $('repPlace').value = ''; S.presetSim = null; }
    S.pickedType = null;
    Array.prototype.forEach.call(document.querySelectorAll('.type'), function (x) { x.setAttribute('aria-checked', 'false'); });
    sendRep({ demo: true, pre: true });
  });
  $('moreTypes').addEventListener('click', function () { var m = document.querySelector('.type.more'); m.hidden = !m.hidden; this.textContent = m.hidden ? '더보기' : '접기'; });
  $('repPhoto').addEventListener('change', function (ev) {
    var f = ev.target.files && ev.target.files[0], img = $('repPreview');
    if (!f) { img.hidden = true; return; }
    try { img.src = URL.createObjectURL(f); img.hidden = false; } catch (e) { img.hidden = true; }
  });
  $('repBack').addEventListener('click', function () { show(S.plan ? 's-course' : 's-start'); });
  $('sendReport').addEventListener('click', function () { sendRep({}); });
  /* o.demo = 시연 단추(근처라고 침) · o.pre = 먼저 다녀간 가상 여행자 1명의 제보도 함께(서로 다른 기기 2대가 되어 알림이 켜지게) */
  function sendRep(o) {
    var text = $('repText').value.trim();
    var r = AI.aiClassifyReport(text, S.pickedType, $('repPlace').value);
    var res = $('repResult'); res.hidden = false; res.className = 'panel result';
    if (!r.type) { res.innerHTML = '<p>무엇을 알려 주실지 골라 주세요 (붐빔 · 휴무 · 좋은 풍경). 또는 한 줄로 적어 주세요.</p>'; return; }
    if (r.shop) { res.innerHTML = '<p><b>가게 제보는 받지 않아요</b></p><p class="note">코스에는 식당을 넣지 않아서, 가게의 줄·휴무는 코스에 반영되지 않아요. 가고 싶은 식당은 지도 탭에서 골라 보세요. 볼거리·풍경 제보는 언제든 환영이에요.</p>'; return; }
    if (!r.placeId) { res.innerHTML = '<p>어느 곳인지 골라 주세요.</p>'; return; }
    if (r.type === 'menu') { res.innerHTML = '<p>메뉴 제보는 받지 않아요. 붐빔 · 휴무 · 좋은 풍경을 알려 주세요.</p>'; return; }
    var pn = PLACE[r.placeId].name, near = o.demo ? { ok: true, state: 'demo' } : nearState(r.placeId);
    if (!near.ok) { // 근처(200m) 확인
      if (near.state === 'nopos') { res.innerHTML = '<p><b>먼저 근처인지 확인해 주세요</b></p><p class="note">제보는 ' + esc(pn) + ' 200m 안에서만 남길 수 있어요. 위치는 확인만 하고 저장·전송하지 않아요.</p>'; openLoc(); return; }
      if (near.state === 'badacc') { res.innerHTML = '<p><b>위치가 정확하지 않아요 · 밖으로 나와 다시 해 주세요</b></p>'; return; }
      res.innerHTML = '<p><b>' + esc(pn) + '에서 너무 멀어요</b></p><p class="note">지금 위치에서 약 ' + near.m + 'm 떨어져 있어요. 200m 안에서만 제보할 수 있어요.</p>'; return;
    }
    var dev = myDev(), arr = jget(K_REP, []), now = Date.now();
    var rc = REP.rateCheck(arr, dev, r.placeId, now); // 같은 곳 15분에 1건 · 1시간에 6건
    if (!rc.ok) { res.innerHTML = rc.why === 'place' ? '<p><b>같은 곳은 15분에 한 번만 제보할 수 있어요</b></p><p class="note">약 ' + rc.waitMin + '분 뒤에 다시 해 주세요. 같은 제보가 겹쳐 쌓이는 걸 막아요.</p>' : '<p><b>한 시간에 6번까지만 제보할 수 있어요</b></p><p class="note">잠시 뒤에 다시 해 주세요.</p>'; return; }
    var simTs = S.presetSim != null ? S.presetSim : S.simNow;
    if (o.pre) { var pre = REP.makeReport({ id: 'pre-' + CLIENT + '-' + now.toString(36), dev: 'demo-pre', type: r.type, placeId: r.placeId, minutes: r.minutes, simTs: simTs - 8, at: now - 8 * 60e3 }); arr.push(pre); S.seen[pre.id] = 1; }
    var rep = REP.makeReport({ id: CLIENT + '-' + now.toString(36), dev: dev, type: r.type, placeId: r.placeId, minutes: r.minutes, simTs: simTs, at: now, text: text, photo: !!($('repPhoto').files && $('repPhoto').files.length) });
    if (REP.hasCoords(rep)) { res.innerHTML = '<p>위치 정보가 섞여 있어 보내지 않았어요.</p>'; return; } // 좌표는 저장도 전송도 하지 않는다
    arr.push(rep); lsSet(K_REP, JSON.stringify(arr));
    S.mine.push(rep); S.seen[rep.id] = 1; S.reports = arr;
    logEvent('report', { type: rep.type, place: rep.placeId });
    broadcast({ type: 'report', report: rep });
    renderRepAlerts(); // 제보는 코스를 바꾸지 않는다 — 알림만 (이 창에 코스가 있고 그 장소가 들어 있을 때)
    var al = REP.alerts(arr, S.simNow).filter(function (a) { return a.key === r.type + '|' + r.placeId; })[0];
    var tail = al && al.state === 'active' ? '같은 곳을 본 기기 ' + al.devices + '대가 모여 <b>근처 여행자에게 알림이 갔어요</b>. 열려 있는 다른 창의 코스는 자동으로 바뀌지 않고, 그 창에서 [코스 다시 짜기]를 눌러야 바뀌어요.' : '제보를 받았어요. 같은 곳을 본 <b>다른 기기의 제보가 1건 더</b> 오면 근처 여행자에게 알림이 가요.';
    res.className = 'panel result';
    res.innerHTML = '<p><b>AI 분류 결과 (시연 규칙)</b></p><p>종류 <b>' + TYPE_NAME[rep.type] + '</b> · 장소 <b>' + esc(pn) + '</b>' + (rep.minutes ? ' · 기다림 <b>' + rep.minutes + '분</b>' : '') + '<br><span class="note">' + esc(r.why) + '</span></p>' +
      '<p>' + tail + '</p>' + (o.pre ? '<p class="note">시연: 먼저 다녀간 여행자(가상) 1명의 제보도 함께 넣었어요.</p>' : '') +
      '<p class="note">' + esc(r.maskNote) + (near.state === 'demo' ? ' · 시연: 근처라고 쳤어요' : ' · 위치는 근처 확인에만 쓰고 저장하지 않았어요') + (rep.type === 'crowd' ? ' · 붐빔 알림은 마지막 제보 60분 뒤 사라져요.' : '') + '</p>';
    $('repText').value = ''; S.presetSim = null;
    renderRepPlaces();
  }

  /* ---------- 제보 받기(다른 창에서 온 것) ---------- */
  var bc = null; try { bc = new BroadcastChannel('tour-live'); } catch (e) { bc = null; }
  function broadcast(msg) {
    try { if (bc) bc.postMessage(msg); } catch (e) { /* 무시 */ }
    try { localStorage.setItem(K_PING, JSON.stringify({ m: msg, n: Date.now() + Math.random() })); } catch (e) { /* 무시 */ }
  }
  function ingest(extra) {
    var arr = jget(K_REP, []);
    if (extra && !arr.some(function (r) { return r.id === extra.id; })) arr.push(extra);
    arr.forEach(function (r) { S.seen[r.id] = 1; });
    S.reports = arr;
    // 제보가 와도 코스는 바꾸지 않는다. 알림만 새로 그린다 (코스는 [코스 다시 짜기]를 눌러야 바뀜)
    var nw = courseAlertList().filter(function (a) { return !S.notified[a.key]; });
    nw.forEach(function (a) { S.notified[a.key] = 1; });
    renderRepAlerts();
    if (nw.length) flash('근처 제보 알림: ' + PLACE[nw[0].placeId].short + ' ' + alertWhat(nw[0]));
    if (lv) lvRender(true);
    if (S.screen === 's-watch') renderWatch();
  }

  /* ---------- 근처 제보 알림 (코스 화면 위 · 길안내 시트) ---------- */
  function alertWhat(a) { return a.type === 'crowd' ? '줄 ' + (a.minutes || 20) + '분' : a.type === 'closed' ? '오늘 휴무' : a.type === 'view' ? '풍경 좋아요' : '새 볼거리'; }
  function alertOk(a) { return !!(PLACE[a.placeId] && !/^eat_/.test(a.placeId) && !S.applied[a.key] && !S.dismissed[a.key]); }
  function courseAlertList() { // 지금 보는 날의 코스에 든 곳에 대한, 켜진 알림
    if (!S.plan) return [];
    var stops = S.plan.multi ? S.plan.days[Math.min(S.dayTab || 0, S.plan.days.length - 1)].plan.stops : S.plan.stops, has = {};
    placeStops(stops).forEach(function (s) { has[s.id] = 1; });
    return REP.activeAlerts(S.reports, S.simNow).filter(function (a) { return has[a.placeId] && alertOk(a); });
  }
  function liveAlertList() { // 길안내 중: 지금 가는 곳 · 남은 곳
    if (!lv) return [];
    var has = {}; lv.trip.nodes.forEach(function (n, i) { if (n && n.id && PLACE[n.id] && i >= Math.max(1, lv.ses.k)) has[n.id] = 1; });
    return REP.activeAlerts(S.reports, S.simNow).filter(function (a) { return has[a.placeId] && alertOk(a); });
  }
  function raItemHtml(a, compact) {
    var nm = PLACE[a.placeId].name, near = nearState(a.placeId).ok, k = ' data-k="' + esc(a.key) + '"';
    var ago = Math.max(0, Math.round(S.simNow - a.latest)), agoT = ago < 1 ? '방금' : ago + '분 전';
    return '<div class="ra' + (compact ? ' sm' : '') + '" role="group" aria-label="' + esc(nm + ' 제보 알림') + '">' +
      '<p class="ra-t"><b>' + esc(nm) + '</b> · ' + esc(alertWhat(a)) + ' · 제보 ' + a.reports + '건 · ' + agoT + '</p>' +
      '<div class="ra-b"><button type="button" class="ra-go" data-ra="go"' + k + '>코스 다시 짜기</button><button type="button" class="ra-ok" data-ra="ok"' + k + '>괜찮아요</button></div>' +
      (near ? '<div class="ra-c"><span>지금도 그래요?' + (a.yes || a.no ? ' <small>(그래요 ' + a.yes + ' · 아니에요 ' + a.no + ')</small>' : '') + '</span><button type="button" class="ra-s" data-ra="yes"' + k + '>아직 그래요</button><button type="button" class="ra-s" data-ra="no"' + k + '>아니에요</button></div>'
        : '<div class="ra-c"><button type="button" class="ra-s loc" data-ra="loc"' + k + '>그곳 근처예요? 위치로 확인하기</button></div>') + '</div>';
  }
  function renderRepAlerts() {
    var el = $('repAlerts'); if (!el) return;
    var list = courseAlertList();
    if (!list.length) { el.hidden = true; el.innerHTML = ''; return; }
    var vis = S.raMore ? list : list.slice(0, 2);
    el.innerHTML = vis.map(function (a, i) { return raItemHtml(a, i > 0); }).join('') + (list.length > 2 ? '<button type="button" class="ra-more" data-ra="more">' + (S.raMore ? '접기' : '더 보기 (' + (list.length - 2) + '건)') + '</button>' : '');
    el.hidden = false;
  }
  function raAct(act, key) {
    if (act === 'more') { S.raMore = !S.raMore; renderRepAlerts(); if (lv) lvRender(true); return; }
    if (act === 'ok') { S.dismissed[key] = true; renderRepAlerts(); if (lv) lvRender(true); flash('이 코스에서는 이 알림을 더 안 보여 드려요'); return; }
    if (act === 'go') { repApply(key); return; }
    if (act === 'loc') { openLoc(); return; }
    if (act === 'yes' || act === 'no') repVote(key, act);
  }
  $('repAlerts').addEventListener('click', function (ev) { var b = ev.target.closest('[data-ra]'); if (b) raAct(b.getAttribute('data-ra'), b.getAttribute('data-k')); });
  $('live').addEventListener('click', function (ev) { var b = ev.target.closest('[data-ra]'); if (b) raAct(b.getAttribute('data-ra'), b.getAttribute('data-k')); });
  function repFind(key) { return REP.activeAlerts(S.reports, S.simNow).filter(function (a) { return a.key === key; })[0] || null; }
  /* 아직 그래요 / 아니에요: 그 곳 근처에 있는 사람만 */
  function repVote(key, v) {
    var al = repFind(key); if (!al) { flash('그 알림은 이미 끝났어요'); renderRepAlerts(); return; }
    var st = nearState(al.placeId);
    if (!st.ok) { if (st.state === 'badacc') flash('위치가 정확하지 않아요 · 밖으로 나와 다시 해 주세요'); else if (st.state === 'far') flash('그곳에서 200m 넘게 떨어져 있어요'); else openLoc(); return; }
    var arr = jget(K_REP, []), now = Date.now();
    var vote = REP.makeVote({ id: CLIENT + '-v' + now.toString(36), dev: myDev(), vote: v, type: al.type, placeId: al.placeId, simTs: Math.max(S.simNow, al.latest), at: now }); // 시연 시계가 제보 시각보다 이르면 제보 시각에 맞춘다
    if (REP.hasCoords(vote)) return;
    arr.push(vote); lsSet(K_REP, JSON.stringify(arr)); S.seen[vote.id] = 1; S.reports = arr;
    logEvent('rep-vote', { v: v, place: al.placeId, type: al.type });
    broadcast({ type: 'report', report: vote });
    flash(v === 'yes' ? '고마워요. 알림이 60분 더 이어져요' : '알려 주셔서 고마워요');
    renderRepAlerts(); if (lv) lvRender(true); if (S.screen === 's-watch') renderWatch();
  }
  /* [코스 다시 짜기] — 사람이 눌러야만 코스가 바뀐다 (마감·기차 규칙은 코스 계산기가 그대로 지킨다) */
  function repApply(key) {
    var al = repFind(key); if (!al) { flash('그 알림은 이미 끝났어요'); renderRepAlerts(); return; }
    S.applied[key] = true; recomputeFx();
    logEvent('rep-replan', { type: al.type, place: al.placeId });
    if (lv) { lvReplanReport(al); renderRepAlerts(); return; }
    if (S.ed && edDirty()) { // 직접 고친 코스: 📌 고정은 그대로 두고 나머지를 다시 짠다 (코스 고치기의 "나머지 다시 짜기"와 같다)
      var spec = S.ed.hist.cur, env = edEnv(), ok = false;
      for (var di = 0; di < spec.days.length; di++) { var rr = ED.replan(env, spec, di); if (rr.ok) { spec = rr.spec; ok = true; } }
      if (!ok || JSON.stringify(spec) === JSON.stringify(S.ed.hist.cur)) { S.plan = edRetimed(); renderCourse(); flash('이 제보를 반영해도 코스가 달라지지 않아요 (시간만 다시 계산했어요)'); return; }
      edApply(spec, '제보를 반영해 나머지를 다시 짰어요 (📌 고정은 그대로)');
      return;
    }
    var prev = replan(); announceApply(al, prev);
  }
  /* [코스 다시 짜기] 를 누른 뒤 무엇이 바뀌었는지 한 줄 */
  function announceApply(al, prev) {
    var nm = PLACE[al.placeId].short, head = '제보 반영: ' + nm + ' ' + alertWhat(al), tail;
    var inNext = S.plan.stops.filter(function (s) { return s.id === al.placeId; })[0];
    var inPrev = prev && prev.stops.some(function (s) { return s.id === al.placeId; });
    var reordered = prev && ids(prev).join() !== ids(S.plan).join();
    if (al.type === 'crowd') tail = reordered ? '순서를 바꿨어요' : (inNext && inNext.delay) ? '기다리는 시간 ' + inNext.delay + '분을 넣었어요' : inNext ? '도착할 때는 풀릴 시간이라 그대로예요' : '이 코스에는 없어서 그대로예요';
    else if (al.type === 'closed') tail = inPrev ? '코스에서 뺐어요' : '이 코스에는 없어서 그대로예요';
    else if (al.type === 'view') tail = inNext ? (inPrev ? '코스에 이미 있어요 — 순서를 다듬었어요' : '코스에 넣었어요') : '시간이 모자라 이번 코스에는 못 넣었어요';
    else tail = S.fx.news[al.placeId] ? '안내에 적어 두었어요' : '그대로예요';
    setBanner(head + ' → ' + tail, reordered ? '반짝이는 테두리가 바뀐 장이에요' : '');
    autoSay('제보를 반영해 코스를 다시 짰어요. ' + tail);
  }
  function lvReplanReport(al) { // 길안내 중: 지나간 곳은 그대로 두고 남은 곳만 다시 짠다 ("남은 곳 다시 짜기"와 같은 길)
    var es = lvEnvSpec(), r = null;
    try { r = LV.remainderReplan({ ED: ED, env: es.env, spec: es.spec, di: lv.di, session: lv.ses, now: lvClock() }); } catch (e) { r = null; }
    if (!r) { flash('지금은 남은 곳을 다시 짤 수 없어요'); return; }
    if (r.same) { flash('이 제보를 반영해도 남은 코스가 달라지지 않아요'); return; }
    if (!S.ed) edStart();
    edApply(r.spec, '제보를 반영해 남은 곳을 다시 짰어요', []);
    lv.ses.rebuild(r.sub, r.base, { slow: isSlow() });
    if (lv.sim) lv.sim.rebuild();
    lv.fixes = null; lv.fixKey = ''; lv.dismissed = null; lv.needTap = '';
    flash('제보를 반영해 남은 곳을 다시 짰어요');
    lvSave(); lvRender(true);
    if (lvMapObj && lvMapObj.redraw) lvMapObj.redraw();
  }

  function setBanner(msg, sub) {
    S.banner = msg;
    var b = $('banner'); b.innerHTML = '<span class="bav"><span><svg viewBox="0 0 40 48" aria-hidden="true"><path d="M20 3c2 9 14 14 14 27a14 14 0 0 1-28 0C6 22 12 19 14 12c2 3 3 4 4 4 1-4 1-8 2-13z"/></svg></span></span><div class="bt"><b>도째비 · 방금</b>' + esc(msg) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '<small>(눌러서 닫기)</small></div>';
    b.hidden = !(TAB_SCREENS.indexOf(S.screen) >= 0);
    window.__lastBanner = msg;
  }
  $('banner').addEventListener('click', function () { this.hidden = true; S.banner = null; });
  if (bc) bc.onmessage = function (ev) { handleMsg(ev.data); };
  function handleMsg(m) {
    if (!m) return;
    if (m.type === 'report') ingest(m.report);
    else if (m.type === 'sim') { if (m.m !== S.simNow) { S.simNow = m.m; $('simTime').value = toTimeValue(m.m); if (S.plan) replan({ noHighlight: true }); } }
    else if (m.type === 'reset') { resetData(false); }
  }
  window.addEventListener('storage', function (ev) {
    if (ev.key === K_REP) ingest(null);
    else if (ev.key === K_COURSE) { if (S.screen === 's-report') renderPresets(); }
    else if (ev.key === K_PING && ev.newValue) { try { handleMsg(JSON.parse(ev.newValue).m); } catch (e) { /* 무시 */ } }
    else if (ev.key === K_LOG && S.screen === 's-watch') renderWatch();
  });

  /* ---------- 동네 탭 (2026-10-17, 2026-10-22 숙소 241곳으로 보강) — 동해시 공공데이터 식당 1,669곳(깨진 글자 1줄 제외) · 숙박업소 241곳(좌표 있는 19곳 + 주소만 있는 222곳)을 동네별로 둘러본다 ----------
     계산(동네 묶음 · 찾기 · 30개씩)은 town.js, 자료는 town.data.js(동네수집.mjs). 가게 정보는 이름·업태·주소뿐(메뉴·좌표·별점 없음) → 카카오맵 찾기 링크로 넘긴다(키 없음).
     '코스에 넣기'는 숙소(좌표가 있는 곳, 여러 날 여행의 밤 숙소)만. 식당은 코스에 넣지 않고 '지도에서 보기'(지도 탭 식당 층)로 위치만 본다(2026-10-18). 마감(기차 15분 전 등)을 넘기면 코스를 바꾸지 않고 이유를 말한다. */
  var TN = { kind: 'eat', area: '', q: '', pages: 1, near: null }, townT = null;
  /* 2026-10-21: "식당이랑 카페는 분류해서" — TW.list('eat') 를 카페 이름·업태 기준으로 다시 나눈다(식당 탭은 카페를 빼고, 카페 탭은 그것만) */
  function kindList(k, q) {
    if (k === 'lodge') return TW.query('lodge', '', q);
    var base = TW.query('eat', '', q);
    return base.filter(function (x) { return isCafe(x) === (k === 'cafe'); });
  }
  /* "거리순 혹은 목적지 부근 가까운 순" — 위치 정보가 있으면 가까운 순, 없으면 이름순(그대로) */
  function applyNear(list) {
    if (!TN.near) { list.forEach(function (x) { x._m = null; }); return list; } // 꺼져 있으면 예전 거리 글자가 남지 않게 지움
    var withPos = list.filter(function (x) { return x.lat && x.lng; }), without = list.filter(function (x) { return !(x.lat && x.lng); });
    withPos = (FU ? FU.nearestN(withPos, TN.near.lat, TN.near.lng, withPos.length, null) : withPos.map(function (x) { return { item: x, m: 0 }; })).map(function (r) { r.item._m = r.m; return r.item; });
    return withPos.concat(without);
  }
  function townAddState(x) {
    if (x.kind !== 'lodge') return { ok: false, why: '' }; // 식당은 코스에 넣지 않아요 — 지도 탭에서 위치를 봐요
    if (!S.plan) return { ok: false, why: '코스를 먼저 짜면 넣을 수 있어요' };
    if (!TW.hasPos(x)) return { ok: false, why: '위치 정보가 없어 넣을 수 없어요' };
    if (!S.plan.multi) return { ok: false, why: '하루 여행이라 숙소는 정하지 않아요' };
    return { ok: true, why: '' };
  }
  function townSay(msg, bad) { var el = $('townMsg'); el.textContent = msg; el.hidden = !msg; el.classList.toggle('bad', !!bad); if (msg) { try { el.scrollIntoView({ block: 'nearest' }); } catch (e) { /* 무시 */ } } }
  function renderTownTab() {
    Array.prototype.forEach.call($('townSeg').querySelectorAll('[data-tk]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-tk') === TN.kind ? 'true' : 'false'); });
    var tour = TN.kind === 'tour'; $('townBox').hidden = tour; $('tourBox').hidden = !tour;
    if (tour) { $('tourBox').innerHTML = CT ? OV.ttTabHtml(CT, P, ovMaps(), todayIso()) : '<p class="note">시티투어 자료가 없어요.</p>'; return; }
    renderTown();
  }
  function renderTown() {
    var k = TN.kind, all = kindList(k, TN.q), list = TN.area ? all.filter(function (x) { return x.area === TN.area; }) : all, cnt = {};
    all.forEach(function (x) { cnt[x.area] = (cnt[x.area] || 0) + 1; });
    list = applyNear(list);
    var shown = TW.page(list, TN.pages);
    $('townChips').innerHTML = '<button type="button" class="chip" data-area="" aria-pressed="' + (!TN.area) + '">전체 ' + all.length + '</button>' +
      TW.areas(k === 'cafe' ? 'eat' : k).filter(function (a) { return cnt[a.area]; }).map(function (a) { return '<button type="button" class="chip" data-area="' + esc(a.area) + '" aria-pressed="' + (TN.area === a.area) + '">' + esc(a.area) + ' ' + cnt[a.area] + '</button>'; }).join('');
    $('townCount').textContent = (TN.area || '동해시 전체') + (TN.q ? ' · “' + TN.q + '”' : '') + ' ' + list.length + '곳' + (list.length > shown.length ? ' 중 ' + shown.length + '곳 보여요' : '') + (list.length ? '' : ' — 찾는 곳이 없어요. 다른 낱말로 찾아 보세요.') + (TN.near ? ' · 가까운 순' : '');
    $('townList').innerHTML = shown.map(function (x) {
      var st = townAddState(x), lod = x.kind === 'lodge', noPos = !TW.hasPos(x);
      return '<li class="tw" data-key="' + x.key + '"><div class="tw-main"><b class="tw-n">' + esc(x.name) + '</b><span class="tw-t">' + esc(x.type) + (x._m != null ? ' · ' + (FU ? FU.round10(x._m) : Math.round(x._m)) + 'm' : '') + '</span></div>' +
        '<p class="tw-a">' + esc(x.area === TW.OTHER ? x.dong : x.area + ' · ' + x.dong) + ' · ' + esc(x.addr) + (x.tel ? ' · <a href="tel:' + esc(x.tel.replace(/[^0-9]/g, '')) + '">' + esc(x.tel) + '</a>' : '') + '</p>' +
        '<div class="tw-btns"><a class="btn tw-map" href="' + esc(TW.kakaoSearch(x.name)) + '" target="_blank" rel="noopener">카카오맵에서 보기</a>' +
        (!lod ? (noPos ? '' : '<button type="button" class="btn tw-onmap" data-onmap="' + x.key + '">지도에서 보기</button>') : (noPos ? '<span class="tw-nopos">위치 정보 없음</span>' : '<button type="button" class="btn tw-add" data-add="' + x.key + '"' + (st.ok ? '' : ' disabled aria-disabled="true"') + '>코스에 넣기</button>')) + '</div>' +
        (lod ? (st.ok ? '<p class="tw-why">밤에 묵는 곳으로 정해요</p>' : (noPos ? '' : '<p class="tw-why">' + esc(st.why) + '</p>')) : '') + '</li>';
    }).join('');
    var more = $('townMore'); more.hidden = list.length <= shown.length; more.textContent = '더 보기 (' + (list.length - shown.length) + '곳 남음)';
    $('townSrc').textContent = '출처: ' + ((TW.src && TW.src[k === 'lodge' ? 'lodging' : 'eats']) || '') + (k === 'cafe' ? ' · 업태가 "카페"로 적힌 곳 + 이름에 카페·커피가 들어간 곳(완벽하진 않아요)' : '') + ' · 가게 소개·메뉴·별점은 자료에 없어요 · 영업 여부와 예약은 직접 확인 · 광고 없음';
  }
  $('townSeg').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-tk]'); if (!b) return;
    TN.kind = b.getAttribute('data-tk'); TN.area = ''; TN.pages = 1; $('townQ').value = TN.q = ''; townSay(''); renderTownTab();
  });
  $('townChips').addEventListener('click', function (ev) { var b = ev.target.closest('[data-area]'); if (!b) return; TN.area = b.getAttribute('data-area'); TN.pages = 1; renderTown(); });
  /* 2026-10-21: "가나다 순보다는 거리순, 혹은 목적지 부근 가까운 순" — 위치를 이미 쓰고 있으면 바로, 아니면 제보 화면과 같은 위치 동의 창을 띄움 */
  $('townNear').addEventListener('click', function () {
    if (TN.near) { TN.near = null; $('townNear').setAttribute('aria-pressed', 'false'); TN.pages = 1; renderTown(); return; }
    var fix = curFix();
    if (fix) { TN.near = fix; $('townNear').setAttribute('aria-pressed', 'true'); TN.pages = 1; renderTown(); return; }
    openLoc(function () { var f = curFix(); if (f) { TN.near = f; $('townNear').setAttribute('aria-pressed', 'true'); TN.pages = 1; renderTown(); } });
  });
  $('townQ').addEventListener('input', function () { clearTimeout(townT); var v = this.value; townT = setTimeout(function () { TN.q = v.trim(); TN.pages = 1; renderTown(); }, 160); });
  $('townMore').addEventListener('click', function () { TN.pages++; renderTown(); });
  $('townList').addEventListener('click', function (ev) {
    var m = ev.target.closest('[data-onmap]');
    if (m) { var k2 = m.getAttribute('data-onmap'), y = TW.list('eat').filter(function (z) { return z.key === k2; })[0]; if (y && TW.hasPos(y)) openMapAt({ lat: y.lat, lng: y.lng }, { eat: true, focusName: y.name }); return; }
    var b = ev.target.closest('[data-add]'); if (!b || b.disabled) return;
    var key = b.getAttribute('data-add'), x = TW.list('lodge').filter(function (y) { return y.key === key; })[0];
    if (x) townAdd(x);
  });
  function townAdd(x) {
    var st = townAddState(x); if (!st.ok) { townSay(st.why, true); return; }
    townLodge(x);
  }
  function tripLate(pl) { return pl.multi ? pl.days.map(function (d) { return d.plan.late || 0; }) : [pl.late || 0]; }
  /* 날마다 곳 수·가능 여부 — 숙소를 바꾸기 전후 비교용 */
  function tripStat(pl) { return (pl.multi ? pl.days.map(function (d) { return d.plan; }) : [pl]).map(function (p) { return { n: p.stops.length, f: p.feasible !== false, late: p.late || 0 }; }); }
  function lodgeImpact(before, after) { // 돌려주는 값: { revert, msg } 또는 null
    for (var i = 0; i < before.length && i < after.length; i++) {
      var b = before[i], a = after[i], dn = (before.length > 1 ? (i + 1) + '일차에 ' : '');
      if (a.late > b.late) return { revert: true, msg: dn + (a.late - b.late) + '분 더 늦어서 기차 시간을 못 지켜요. 코스는 그대로예요.' };
      if (b.f && !a.f) return { revert: true, msg: dn + '하루 코스가 시간 안에 안 맞아요. 코스는 그대로예요.' };
    }
    for (var j = 0; j < before.length && j < after.length; j++) if (after[j].n < before[j].n) return { revert: false, msg: (before.length > 1 ? (j + 1) + '일차' : '오늘') + ' 코스가 ' + before[j].n + '곳에서 ' + after[j].n + '곳으로 줄었어요' };
    return null;
  }
  function townLodge(x) {
    var prev = S.stayPick, prevAuto = S.stayAuto, before = tripStat(S.plan);
    S.stayPick = { id: 'stay', name: x.name, lat: x.lat, lng: x.lng, examples: [x.name], source: (TW.src && TW.src.lodging) || '공공데이터포털 동해시 숙박업소' };
    S.stayAuto = false; // 손으로 고른 숙소니 더는 "추천" 표시 안 함
    replan({ noHighlight: true });
    var imp = lodgeImpact(before, tripStat(S.plan));
    if (imp && imp.revert) {
      S.stayPick = prev; S.stayAuto = prevAuto; replan({ noHighlight: true }); townSay(x.name + '을(를) 숙소로 하면 ' + imp.msg, true); return;
    }
    townSay(''); show('s-course'); flash(x.name + '을(를) 숙소로 정했어요' + (imp ? ' · ' + imp.msg : ''));
  }

  /* ---------- 5. 나의 동해 이야기 ---------- */
  function cardParts() {
    var pl = S.plan; if (!pl) return null;
    var plain = placeStops(pl.stops); // 끼니 시간은 장이 아니라서 번호를 안 붙인다
    var rows = plain.map(function (s, i) { return { n: i + 1, name: s.place.name, tm: hhmm(s.arrive) }; });
    if (pl.multi) { // 날마다 머리글 + 대표 두 곳(나머지는 곳 수로)
      rows = []; var gi = 0;
      pl.days.forEach(function (d) {
        var pls = placeStops(d.plan.stops);
        rows.push({ head: true, name: d.label + ' · ' + pls.length + '곳', tm: '' });
        pls.forEach(function (s, k) { gi++; if (k < 2) rows.push({ n: gi, name: s.place.name, tm: hhmm(s.arrive) }); });
      });
    }
    if (pl.tomorrow) rows.push({ n: plain.length + 1, name: pl.tomorrow.place.name + ' 일출', tm: hhmm(pl.tomorrow.arrive) + ' 예정(예시)' });
    /* 기록 카드(그림 파일 포함)에는 공공누리 제1유형 사진만 넣는다. 제3유형(변경금지)은 그림 위에 합성·잘라 쓰지 않고 일러스트로 대신한다. */
    var mine = S.mine.map(function (r) { return PLACE[r.placeId].short + ' ' + (TYPE_NAME[r.type] || '') + (r.text ? ' — ' + r.text : ''); });
    var line = AI.aiMyLine({ count: plain.length, reports: S.mine.length, night: S.mode === 'night' });
    return { rows: rows, mine: mine, line: line, sub: (pl.multi ? pl.label : S.mode === 'night' ? '1박 2일' : '오늘 하루') + ' · ' + pl.startStation.name.replace(/역$/, '') + '에서 시작' };
  }
  function renderCard() {
    var c = cardParts(); if (!c) { $('cardBody').innerHTML = '<p>먼저 코스를 만들어 주세요.</p>'; return; }
    S.cardLine = c.line;
    $('cardBody').innerHTML = '<div class="rc-top"><svg viewBox="0 0 40 48" aria-hidden="true"><path d="M20 3c2 9 14 14 14 27a14 14 0 0 1-28 0C6 22 12 19 14 12c2 3 3 4 4 4 1-4 1-8 2-13z"/></svg><div><b>나의 동해 이야기</b><span>' + esc(c.sub) + '</span></div></div>' +
      '<h2 class="visually-hidden">이야기 장</h2>' +
      '<ol class="rc-list">' + c.rows.map(function (r) { return r.head ? '<li class="dh">' + esc(r.name) + '</li>' : '<li><span class="n">' + r.n + '</span>' + esc(r.name) + '<span class="tm">' + esc(r.tm) + '</span></li>'; }).join('') + '</ol>' +
      '<p class="rc-mine">' + (c.mine.length ? '<b>내가 남긴 제보</b> ' + c.mine.map(esc).join(' · ') : '아직 남긴 제보가 없어요.') + '</p>' +
      '<div class="say"><span class="note">도째비 한마디</span><br>' + esc(c.line) + '</div>';
  }
  function cardText() {
    var c = cardParts(); if (!c) return '';
    var NL = String.fromCharCode(10);
    return '나의 동해 이야기 (' + c.sub + ')' + NL + c.rows.map(function (r) { return r.head ? r.name : r.n + '장 ' + r.name + ' ' + r.tm; }).join(NL) + (c.mine.length ? NL + '제보: ' + c.mine.join(', ') : '') + NL + '도째비: ' + c.line + NL + '- 도째비 길동무 (시연)';
  }
  function copyText(t, okMsg) {
    function fallback() {
      try { var ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); var ok = document.execCommand('copy'); document.body.removeChild(ta); flash(ok ? okMsg : '복사하지 못했어요. 글을 길게 눌러 복사해 주세요.'); } catch (e) { flash('복사하지 못했어요.'); }
    }
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { flash(okMsg); }, fallback); else fallback(); } catch (e) { fallback(); }
  }
  $('cardShare').addEventListener('click', function () {
    var t = cardText(); if (!t) return;
    if (navigator.share) { navigator.share({ title: '나의 동해 이야기', text: t }).catch(function () { /* 닫음 */ }); }
    else copyText(t, '글을 복사했어요. 붙여넣어 공유하세요');
  });
  /* 저장 = 정사각 그림 파일(png). 안 되면 글 복사 */
  $('cardSave').addEventListener('click', function () {
    var c = cardParts(); if (!c) return;
    try {
      var W = 1080, cv = document.createElement('canvas'); cv.width = W; cv.height = W; var g = cv.getContext('2d');
      var bg = g.createLinearGradient(0, 0, W, W); bg.addColorStop(0, '#0b2f52'); bg.addColorStop(.62, '#12609a'); bg.addColorStop(1, '#0f4c81'); g.fillStyle = bg; g.fillRect(0, 0, W, W);
      var sun = g.createRadialGradient(W - 120, W - 80, 10, W - 120, W - 80, 420); sun.addColorStop(0, 'rgba(255,178,90,.95)'); sun.addColorStop(.4, 'rgba(255,122,89,.6)'); sun.addColorStop(1, 'rgba(255,122,89,0)'); g.fillStyle = sun; g.fillRect(0, 0, W, W);
      var ff = "'Pretendard','Noto Sans KR','Malgun Gothic',sans-serif";
      g.fillStyle = '#fff'; g.font = '800 64px ' + ff; g.fillText('나의 동해 이야기', 72, 130);
      g.fillStyle = '#c9eeea'; g.font = '500 34px ' + ff; g.fillText(c.sub, 72, 184);
      var pitch = c.rows.some(function (r) { return r.head; }) ? 56 : 72;
      var y = 270; g.font = '700 44px ' + ff;
      c.rows.slice(0, 10).forEach(function (r) {
        if (r.head) { g.fillStyle = '#ffd9a8'; g.font = '700 34px ' + ff; g.fillText(r.name, 72, y); y += pitch; return; }
        g.fillStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.arc(96, y - 14, 26, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = '700 30px ' + ff; g.fillText(String(r.n), r.n > 9 ? 84 : 88, y - 3); g.font = '700 44px ' + ff; g.fillText(r.name, 142, y); g.fillStyle = '#c9eeea'; g.font = '500 32px ' + ff; var w = g.measureText(r.tm).width; g.fillText(r.tm, W - 72 - w, y); y += pitch; });
      var finish = function () { try {
      g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(60, W - 250, W - 120, 170);
      g.fillStyle = '#fff'; g.font = '600 36px ' + ff;
      var words = c.line.split(' '), ln = '', yy = W - 190;
      words.forEach(function (w2) { var t = ln ? ln + ' ' + w2 : w2; if (g.measureText(t).width > W - 190 && ln) { g.fillText(ln, 90, yy); yy += 52; ln = w2; } else ln = t; });
      g.fillText(ln, 90, yy);
      cv.toBlob(function (bl) {
        if (!bl) { copyText(cardText(), '그림 저장이 안 돼서 글을 복사했어요'); return; }
        saveBlob(bl, '나의-동해-이야기.png', '그림으로 저장했어요');
      }, 'image/png');
      } catch (e2) { copyText(cardText(), '그림 저장이 안 돼서 글을 복사했어요'); } };
      finish();
    } catch (e) { copyText(cardText(), '그림 저장이 안 돼서 글을 복사했어요'); }
  });
  $('cardSpeak').addEventListener('click', function () { say(S.cardLine || '', this); });
  $('cardNew').addEventListener('click', function () { S.plan = null; S.ed = null; S.editing = false; S.fixed = []; S.mode = 'normal'; S.mine = []; S.dayTab = 0; S.stayPick = null; S.stayAuto = false; S.simNow = 13 * 60; lsSet(K_SIM, String(S.simNow)); show('s-start'); });

  /* ---------- 6. 시청 화면 ---------- */
  function renderWatch() {
    var log = jget(K_LOG, []);
    var plan = log.filter(function (e) { return e.k === 'plan'; }).length;
    var late = log.filter(function (e) { return e.k === 'choice' && e.v === 'late'; }).length;
    var night = log.filter(function (e) { return e.k === 'choice' && e.v === 'night'; }).length;
    var recs = jget(K_REP, []), reps = recs.filter(function (r) { return !REP.isVote(r); }), votes = recs.filter(REP.isVote);
    var yes = votes.filter(function (v) { return v.vote === 'yes'; }).length, no = votes.length - yes;
    var als = REP.alerts(recs, S.simNow).filter(function (a) { return PLACE[a.placeId]; });
    var act = als.filter(function (a) { return a.state === 'active'; });
    var byType = {}; reps.forEach(function (e) { byType[e.type] = (byType[e.type] || 0) + 1; });
    var ST = { active: '알림 중', pending: '대기 · 기기 2대 필요', cancelled: '취소 · 아니에요가 많아요', expired: '끝남 · 60분 지남' };
    var sum = act.length ? '지금 알림 중: ' + act.map(function (a) { return PLACE[a.placeId].short + ' ' + alertWhat(a); }).join(' · ') : '지금 알림 중인 곳이 없어요.';
    var rank = { active: 0, pending: 1, cancelled: 2, expired: 3 };
    var rows = als.slice().sort(function (a, b) { return rank[a.state] - rank[b.state] || b.reports - a.reports; }).map(function (a) {
      return '<li class="wl ' + a.state + '"><b>' + esc(PLACE[a.placeId].short) + ' · ' + (TYPE_NAME[a.type] || a.type) + '</b><span>제보 ' + a.reports + '건 · 기기 ' + a.devices + '대 · 아직 그래요 ' + a.yes + ' · 아니에요 ' + a.no + '</span><i>' + ST[a.state] + '</i></li>';
    }).join('');
    var types = ['crowd', 'closed', 'view', 'new'].map(function (t) { return '<tr><td>' + TYPE_NAME[t] + '</td><td>' + (byType[t] || 0) + '건</td></tr>'; }).join('');
    $('watchBody').innerHTML =
      '<p class="lead"><b>' + esc(sum) + '</b></p>' +
      '<div class="stats"><div class="stat"><b>' + plan + '</b><span>코스 요청</span></div><div class="stat"><b>' + reps.length + '</b><span>현장 제보</span></div>' +
      '<div class="stat"><b>' + act.length + '</b><span>알림 중인 곳</span></div><div class="stat"><b>' + votes.length + '</b><span>확인 표시 (그래요 ' + yes + ' · 아니에요 ' + no + ')</span></div>' +
      '<div class="stat"><b>' + late + '</b><span>막차로 바꾼 수</span></div><div class="stat"><b>' + night + '</b><span>1박 선택 수</span></div>' +
      '</div>' +
      '<h3>제보 종류별</h3><table class="t"><tbody>' + types + '</tbody></table>' +
      '<h3 style="margin-top:14px">장소별 제보 · 알림 상태</h3>' + (rows ? '<ul class="wlist">' + rows + '</ul>' : '<p class="note">아직 없어요.</p>') +
      '<p class="note">제보는 코스를 자동으로 바꾸지 않아요. 알림만 가고, 다시 짤지는 받은 사람이 골라요. 위치(좌표)는 기록하지 않아요.</p>';
  }
  $('watchBack').addEventListener('click', function () { show(S.plan ? 's-course' : 's-start'); });
  setInterval(function () { if (S.screen === 's-watch') renderWatch(); }, 3000);

  /* ---------- 날씨 (기상청 초단기실황, 서버 /api/weather) ---------- */
  var WX_MOCK = {
    rain: { temp: 14, sky: 4, pty: 1, text: '비', wind: 5.2, rain1h: 2.5, baseTime: '', mock: true },
    cloudy: { temp: 17, sky: 4, pty: 0, text: '흐림', wind: 3.1, rain1h: 0, baseTime: '', mock: true },
    storm: { temp: 13, sky: 4, pty: 1, text: '강한 비', wind: 15.2, rain1h: 18, baseTime: '', mock: true },
    clear: { temp: 21, sky: 1, pty: 0, text: '맑음', wind: 1.6, rain1h: 0, baseTime: '', mock: true }
  };
  function wxIcon(w) { return w.pty > 0 ? 'rain' : w.sky === 1 ? 'sun' : 'cloud'; }
  function renderWx() {
    var el = $('wx'), w = S.wx;
    if (!w) { el.setAttribute('data-state', 'loading'); return; }
    if (w.error) {
      el.setAttribute('data-state', 'none');
      $('wxIc').innerHTML = ico('cloud'); $('wxMain').textContent = '날씨를 불러오지 못했어요'; $('wxSub').textContent = '';
      $('wxHint').textContent = '비 오면 "더 고르기"에서'; $('wxSrc').textContent = '';
      return;
    }
    el.setAttribute('data-state', w.pty > 0 ? 'rain' : 'ok');
    $('wxIc').innerHTML = ico(wxIcon(w));
    // 한 줄로: "동해 21℃ 맑음 · 비 소식 없음  기상청 18시"
    $('wxMain').textContent = '동해 ' + Math.round(w.temp) + '℃' + (w.text ? ' ' + w.text : '');
    $('wxSub').textContent = '';
    $('wxHint').textContent = w.pty > 0 ? '비 와요, 실내 위주로' : (w.wind >= 8 ? '바람 세요 ' + w.wind + 'm/s' : '비 소식 없음');
    $('wxSrc').textContent = w.mock ? '시험값' : w.snap ? ('기상청 ' + w.snap) : ('기상청 ' + parseInt(w.baseTime, 10) + '시');
  }
  function setWx(w) {
    S.wx = w; renderWx();
    // 2026-10-21: 이 값은 기상청 "지금 날씨"(초단기실황)라, 고른 날짜가 오늘이 아니면 자동으로 "비 와요"를 켜지 않음(다른 날 날씨를 지금 날씨로 잘못 맞추게 됨)
    if (w && !w.error && w.pty > 0 && !S.wxApplied && !w.snap && S.cond.date === todayIso()) { S.wxApplied = true; S.wxRain = true; S.cond.rain = true; if (!$('s-start').hidden) renderStart(); }
  }
  function loadWeather() {
    var m = /[?&]mock-weather=([a-z]+)/.exec(location.search || '');
    if (m && WX_MOCK[m[1]]) { setWx(WX_MOCK[m[1]]); return; }
    function snapshot() {
      var sn = window.WX_SNAPSHOT;
      if (sn && !sn.error && sn.temp != null) { var x = {}; for (var k in sn) x[k] = sn[k]; x.snap = sn.label || ''; return x; }
      return null;
    }
    if (location.protocol.indexOf('http') !== 0) { setWx(snapshot() || { error: 'none' }); return; }
    fetch('/api/weather', { cache: 'no-store' }).then(function (r) { return r.json(); })
      .then(function (j) { setWx(j && !j.error && j.temp != null ? j : (snapshot() || { error: (j && j.error) || 'fail' })); })
      .catch(function () { setWx(snapshot() || { error: 'fail' }); });
  }

  /* ---------- 시작 ---------- */
  S.reports = jget(K_REP, []); S.reports.forEach(function (r) { S.seen[r.id] = 1; });
  $('simTime').value = toTimeValue(S.simNow);
  function route() {
    var h = (location.hash || '').replace('#', '');
    if (h === 'demo') runDemo('normal');
    else if (h === 'demo-meal') runDemo('meal');
    else if (h === 'demo-day') runDemo('day');
    else if (h === 'demo-bus') runDemo('bus');
    else if (h === 'demo-car') runDemo('car');
    else if (h === 'demo-kid') runDemo('kid');
    else if (h === 'demo-couple') runDemo('couple');
    else if (h === 'demo-tour') runDemo('tour');
    else if (h === 'demo-1bak') runDemo('1bak');
    else if (h === 'report') openReport();
    else if (h === 'watch') show('s-watch');
  }
  window.addEventListener('hashchange', route);
  initIntro(); setHdr(); window.addEventListener('resize', setHdr);
  loadTrains(); renderStart();
  loadWeather(); loadCrowd();
  route();
  if (!(location.hash || '').replace('#', '')) edBootRestore(); // 새로 고쳐도 직접 고친 코스는 그대로

  // 시험용 접근(자동 점검에서만 쓴다)
  window.__tour = { map: function () { return mapApi; }, pois: function () { return buildPois().length; }, ov: function () { return { OVS: OVS, OA: OA, TN: TN }; }, ovPlay: ovPlay, townAdd: townAdd, state: S, replan: replan, ingest: ingest, ED: ED, edEnv: function () { return edEnv(); }, live: function () { return lv; }, liveStart: lvStart, liveAsk: lvOpenAsk };
})();
