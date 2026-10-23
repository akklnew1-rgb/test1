/* 한국관광공사 관광정보(TourAPI)를 중계 서버(ai-server/api/tour.js)에서 받아 두 곳에 보탠다. 못 받으면 아무것도 보이지 않고 앱은 원래대로 돌아간다.
 *  1) 코스 화면: 여행 날짜 앞뒤로 동해시에서 열리는 행사   2) 동네 찾기: 우리 자료에 없는 곳을 "한국관광공사에 더 있는 곳"으로 보여 줌 */
(function () {
  var BASE = window.DOJJAEBI_AI_URL ? String(window.DOJJAEBI_AI_URL).replace(/\/api\/ai\/?$/, '/api/tour') : '';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function get(params, cb) {
    if (!BASE || location.protocol.indexOf('http') !== 0) { cb(null); return; }
    var ck = 'tour.api.v1.' + JSON.stringify(params), hit = null;
    try { hit = JSON.parse(sessionStorage.getItem(ck) || 'null'); } catch (e) { hit = null; }
    if (hit && Date.now() - hit.t < 20 * 60000) { cb(hit.v); return; }
    var q = Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&'), done = false;
    var timer = setTimeout(function () { if (!done) { done = true; cb(null); } }, 7000);
    fetch(BASE + '?' + q).then(function (r) { return r.json(); }).then(function (j) {
      if (done) return; done = true; clearTimeout(timer);
      if (!j || j.error) { cb(null); return; }
      try { sessionStorage.setItem(ck, JSON.stringify({ t: Date.now(), v: j })); } catch (e) { /* 무시 */ }
      cb(j);
    }).catch(function () { if (!done) { done = true; clearTimeout(timer); cb(null); } });
  }
  function ymd(iso) { return String(iso || '').replace(/-/g, ''); }
  function addDays(iso, n) { var d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function fmt(s) { return s && s.length === 8 ? parseInt(s.slice(4, 6), 10) + '/' + parseInt(s.slice(6, 8), 10) : ''; }

  /* 1) 행사 — 직접 옮겨 적은 data/events.json(동해시청 게시판) + 한국관광공사 행사를 합친다 */
  function localEvents(cb) {
    fetch('data/events.json?v=1').then(function (r) { return r.json(); }).then(function (j) { cb(j && j.items ? j : null); }).catch(function () { cb(null); });
  }
  function events(dateIso, el) {
    if (!el || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso || '')) return;
    var from = ymd(addDays(dateIso, -60)), d0 = ymd(dateIso), d1 = ymd(addDays(dateIso, 7)), loc = [], api = [], n = 0;
    function show() {
      if (++n < 2) return;
      var all = loc.concat(api).slice(0, 4);
      if (!all.length) { el.hidden = true; el.innerHTML = ''; return; }
      var src = [loc.length ? '동해시청 행사 게시판' : '', api.length ? '한국관광공사 관광정보' : ''].filter(Boolean).join(' · ');
      el.innerHTML = '<b>🎪 이 즈음 동해 행사</b><br>' + all.map(function (x) { return x.html; }).join('<br>') + '<br><span class="ev-src">출처: ' + src + ' · 가시기 전에 일정을 꼭 확인해 주세요</span>';
      el.hidden = false;
    }
    localEvents(function (j) {
      loc = ((j && j.items) || []).filter(function (x) { var s = ymd(x.start), e = ymd(x.end || x.start); return s && e >= d0 && s <= d1; }).map(function (x) {
        var s = ymd(x.start), e = ymd(x.end || x.start);
        return { html: esc(x.title) + ' · ' + fmt(s) + (e !== s ? '~' + fmt(e) : '') + (x.time ? ' ' + esc(x.time) : '') + (x.place ? ' · ' + esc(x.place) : '') + (x.note ? ' · ' + esc(x.note) : '') };
      });
      show();
    });
    get({ op: 'festival', from: from, rows: 30 }, function (j) {
      api = ((j && j.items) || []).filter(function (x) { return x.end && x.start && x.end >= d0 && x.start <= d1; }).slice(0, 3).map(function (x) {
        return { html: esc(x.title) + ' · ' + fmt(x.start) + '~' + fmt(x.end) + (x.addr ? ' · ' + esc(x.addr.replace(/^강원(특별자치)?도?\s*/, '')) : '') };
      });
      show();
    });
  }

  /* 3) 동네 찾기에서 우리 자료에 없는 곳 */
  var tq = document.getElementById('townQ'), tl = document.getElementById('townList'), more = null, tt = null;
  if (tq && tl) {
    more = document.createElement('div'); more.id = 'tourMore'; more.className = 'tour-more'; more.hidden = true; tl.parentNode.insertBefore(more, tl.nextSibling);
    tq.addEventListener('input', function () {
      clearTimeout(tt); var v = tq.value.trim(); more.hidden = true;
      if (v.length < 2) return;
      tt = setTimeout(function () {
        get({ op: 'search', q: v, rows: 10 }, function (j) {
          if (tq.value.trim() !== v) return; // 그 사이 글이 바뀌었으면 버린다
          var have = tl.textContent || '', list = ((j && j.items) || []).filter(function (x) { return x.title && have.indexOf(x.title) < 0; }).slice(0, 5);
          if (!list.length) { more.hidden = true; return; }
          more.innerHTML = '<b>한국관광공사에 더 있는 곳</b><ul>' + list.map(function (x) { return '<li><span>' + esc(x.title) + '</span><small>' + esc((x.addr || '').replace(/^강원(특별자치)?도?\s*/, '')) + (x.tel ? ' · ' + esc(x.tel) : '') + '</small></li>'; }).join('') + '</ul><span class="ev-src">출처: 한국관광공사 관광정보 · 운영 시간은 가시기 전에 확인해 주세요</span>';
          more.hidden = false;
        });
      }, 500);
    });
  }
  window.TourAPI = { events: events, get: get };
})();
