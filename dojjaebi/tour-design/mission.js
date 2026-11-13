/*
 * 도깨비 미션 (2026-11-13) — 장소마다 도깨비가 낸 미션을 하나씩 해결하면 도장이 찍히고, 끝나면 도깨비가 엽서를 써 준다.
 * 장소·할 일은 아래 표(MISSIONS)에 고정돼 있다. 인공지능은 도깨비 한마디(line·hint)와 엽서 글만 쓰고, 실패하거나 느리면 아래 기본 글로 바로 돌아온다.
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
    { id: 'mukhoport-1', place: 'mukhoport', title: '바다 위에 배가 몇 척 떠 있는지 세어 보기', line: '도깨비는 배 세기를 좋아해요. 눈 크게 뜨고 세어 보세요!', hint: '멀리 보이는 배부터 세면 덜 헷갈려요.', ask: '몇 척이었나요?' },
    { id: 'mukhoport-2', place: 'mukhoport', title: '시장에서 가장 눈에 띄는 색 찾기', line: '도깨비불보다 더 눈에 띄는 색이 있을까요?', hint: '사람 얼굴은 빼고 물건이나 풍경만 담아 주세요.', ask: '무슨 색이었나요?' },
    { id: 'nolgol-1', place: 'nolgol', title: '벽화 한 장면 골라 이야기 지어 주기', line: '벽 속 사람들이 무슨 말을 할지 도깨비한테도 알려 주세요.', hint: '길이 좁으니 지나가는 분께 길을 비켜 주세요.', ask: '어떤 이야기였나요?' },
    { id: 'nolgol-2', place: 'nolgol', title: '골목에서 바다가 가장 잘 보이는 모퉁이 찾기', line: '오르막이 힘들어도 바다 한 번이면 괜찮아져요.', hint: '무리하지 말고 쉬엄쉬엄 올라가요.', ask: '어느 모퉁이였나요?' },
    { id: 'lighthouse-1', place: 'lighthouse', title: '바다가 가장 예쁘게 보이는 자리 찾아 남기기', line: '여기서는 도깨비도 말을 잠깐 멈춰요. 가장 좋은 자리를 찾아 주세요.', hint: '바람이 센 날은 난간 쪽에 천천히 다가가요.', ask: '그 자리는 어땠나요?' },
    { id: 'lighthouse-2', place: 'lighthouse', title: '수평선에서 보이는 것 세 가지 적기', line: '배, 구름, 갈매기… 도깨비 눈에는 또 뭐가 보일까요?', hint: '맑은 날과 흐린 날 보이는 게 달라요.', ask: '무엇이 보였나요?' }
  ];
  var NEAR_M = 500; // 이 안이면 "현장 확인" (휴대폰 위치 오차를 넉넉히 본다)
  var KEY = 'dojjaebi.mission.v1';

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

  var api = { PLACES: PLACES, MISSIONS: MISSIONS, NEAR_M: NEAR_M, dist: dist, judge: judge, findMission: findMission, loadStamps: loadStamps, saveStamps: saveStamps, stampList: stampList, fallbackPostcard: fallbackPostcard, wrapText: wrapText };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.TourMission = api;
  if (typeof document === 'undefined') return;

  /* ---------- 화면 ---------- */
  var st = loadStamps(), photos = {}, lines = {}, el = null, open = null, card = null;
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

  function build() {
    if (el) return;
    el = mk('div', 'ms'); el.id = 'missionRoom'; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', '도깨비 미션'); el.tabIndex = -1;
    var head = mk('div', 'ms-head'), ht = mk('div', 'ms-ht');
    ht.appendChild(mk('h2', '', '도깨비 미션')); ht.appendChild(mk('p', 'ms-sub', '묵호에서 도깨비가 낸 미션을 해결해 보세요')); head.appendChild(ht);
    var x = mk('button', 'ms-x', '닫기'); x.type = 'button'; x.addEventListener('click', close); head.appendChild(x);
    el.appendChild(head);
    el.appendChild(mk('p', 'ms-note', '위치와 사진은 완벽한 방문 증명이 아니에요. 사진은 이 휴대폰에만 있고 서버로 보내지 않아요.'));
    var body = mk('div', 'ms-body'); body.id = 'msBody'; el.appendChild(body);
    document.body.appendChild(el);
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && el && !el.hidden) close(); });
  }

  function render() {
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

  function missionCard(m) {
    var s = st[m.id], c = mk('article', 'ms-m' + (s ? ' done' : '')), t = mk('h4', '', (s ? '✓ ' : '') + m.title); c.appendChild(t);
    var say = lines[m.id] || { line: m.line, hint: m.hint };
    c.appendChild(mk('p', 'ms-line', '“' + say.line + '”')); c.appendChild(mk('p', 'ms-hint', '요령: ' + say.hint));
    if (s) {
      c.appendChild(mk('p', 'ms-tag ' + s.via, s.via === 'gps' ? '현장 확인' : '직접 확인'));
      if (s.note) c.appendChild(mk('p', 'ms-memo', '남긴 말: ' + s.note));
      return c;
    }
    if (open === m.id) { c.appendChild(form(m)); return c; }
    var b = mk('button', 'ms-go', '해결했어요'); b.type = 'button';
    b.addEventListener('click', function () { open = m.id; render(); if (!lines[m.id]) askLine(m); });
    c.appendChild(b); return c;
  }

  function askLine(m) { // 도깨비 한마디를 인공지능에게 — 못 받으면 기본 글 그대로
    var p = placeOf(m);
    aiPost({ task: 'mission', place: { id: p.id, name: p.name }, mission: m.title, companions: [], rain: false }, 6000).then(function (j) {
      if (j && j.line) { lines[m.id] = { line: j.line, hint: j.hint || m.hint }; if (el && !el.hidden) render(); }
    });
  }

  function form(m) {
    var f = mk('div', 'ms-form'), lb = mk('label', '', m.ask), inp = mk('input'); inp.type = 'text'; inp.maxLength = 60; inp.placeholder = '한 줄로 남겨 주세요 (안 써도 돼요)'; lb.appendChild(inp); f.appendChild(lb);
    var pl = mk('label', 'ms-photo', '사진 남기기 (선택)'), pi = mk('input'); pi.type = 'file'; pi.accept = 'image/*'; pl.appendChild(pi);
    var thumb = mk('img', 'ms-thumb'); thumb.alt = '고른 사진'; thumb.hidden = true; pl.appendChild(thumb); f.appendChild(pl);
    pi.addEventListener('change', function () {
      var file = pi.files && pi.files[0]; if (!file) return;
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { // 엽서용으로 작게 줄여 메모리에만 둔다
        var w = 600, h = Math.round(img.height * w / img.width), cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(img, 0, 0, w, h);
        photos[m.id] = cv; thumb.src = cv.toDataURL('image/jpeg', .7); thumb.hidden = false; URL.revokeObjectURL(url);
      };
      img.src = url;
    });
    var ok = mk('button', 'ms-go', '도장 찍기'); ok.type = 'button';
    var msg = mk('p', 'ms-state', ''); msg.setAttribute('aria-live', 'polite');
    ok.addEventListener('click', function () {
      ok.disabled = true; msg.textContent = '휴대폰 위치를 확인하는 중이에요…';
      getPos().then(function (pos) {
        st[m.id] = { ts: Date.now(), via: judge(m, pos), note: inp.value.trim().slice(0, 60) }; saveStamps(st); open = null; render();
      });
    });
    var cancel = mk('button', 'ms-cancel', '접기'); cancel.type = 'button'; cancel.addEventListener('click', function () { open = null; render(); });
    f.appendChild(ok); f.appendChild(cancel); f.appendChild(msg); return f;
  }

  function postcard() {
    var list = stampList(st); if (!list.length) return;
    var body = $('msBody'); body.textContent = '';
    var back = mk('button', 'ms-cancel', '← 미션으로'); back.type = 'button'; back.addEventListener('click', render); body.appendChild(back);
    var state = mk('p', 'ms-state', '도깨비가 엽서를 쓰는 중이에요…'); state.setAttribute('aria-live', 'polite'); body.appendChild(state);
    var stamps = list.map(function (m) { return { place: placeOf(m).name, mission: m.title, note: st[m.id].note || '' }; });
    var fb = fallbackPostcard(list, st);
    aiPost({ task: 'postcard', stamps: stamps, companions: [] }, 9000).then(function (j) {
      var out = j && j.title && j.body ? { title: j.title, body: j.body } : fb;
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

  function openRoom() { build(); open = null; render(); el.hidden = false; document.documentElement.classList.add('ms-open'); try { el.focus(); } catch (e) { /* 무시 */ } }
  function close() { if (!el) return; el.hidden = true; document.documentElement.classList.remove('ms-open'); var t = $('tabMission'); if (t) try { t.focus(); } catch (e) { /* 무시 */ } }

  var tab = $('tabMission'); if (tab) tab.addEventListener('click', openRoom);
  api.open = openRoom; api.close = close;
})(typeof window !== 'undefined' ? window : globalThis);
