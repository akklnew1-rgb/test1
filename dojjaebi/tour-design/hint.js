/* 도깨비불 힌트: 지금 눌러야 할 곳 옆에서 은은하게 깜빡임 (처음 한 번만 말풍선) */
(function () {
  'use strict';
  var K = 'dojjaebi.hint1';
  function get() { try { return localStorage.getItem(K); } catch (e) { return null; } }
  function set() { try { localStorage.setItem(K, '1'); } catch (e) { /* 무시 */ } }
  var el = document.createElement('div');
  el.id = 'hintFlame'; el.setAttribute('aria-hidden', 'true'); el.hidden = true;
  el.innerHTML = '<svg viewBox="0 0 40 48" width="34" height="42" focusable="false"><path d="M20 3c2 9 14 14 14 27a14 14 0 0 1-28 0C6 22 12 19 14 12c2 3 3 4 4 4 1-4 1-8 2-13z" fill="#17c1b2"/><circle cx="15" cy="30" r="2.2" fill="#0b2f52"/><circle cx="25" cy="30" r="2.2" fill="#0b2f52"/></svg><span class="hf-t" hidden>이 불빛을 따라 눌러 보세요</span>';
  document.body.appendChild(el);
  var tip = el.querySelector('.hf-t'), cur = null, learned = !!get();
  function vis(n) { return n && n.offsetParent !== null && !n.disabled; }
  function pick() {
    var cf = document.getElementById('cfSheet');
    if (cf && !cf.hidden) { var g = document.getElementById('cfGo'); return vis(g) ? g : null; }
    if (document.body.classList.contains('sh-open') || document.body.classList.contains('no-scroll')) return null;
    var st = document.getElementById('s-start');
    if (st && !st.hidden) {
      var t = document.getElementById('askText'), go = document.getElementById('askGo');
      if (t && !t.value.trim()) return vis(t) ? t : null;
      return vis(go) ? go : null;
    }
    return null;
  }
  function place() {
    var n = pick(); cur = n;
    if (!n) { el.hidden = true; return; }
    var r = n.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) { el.hidden = true; return; }
    el.hidden = false;
    var x = Math.min(window.innerWidth - 40, r.right - 30), y = Math.max(4, r.top - 34);
    el.style.left = x + 'px'; el.style.top = y + 'px';
    tip.hidden = learned;
  }
  document.addEventListener('click', function (ev) {
    if (cur && (ev.target === cur || cur.contains(ev.target)) && !learned) { learned = true; set(); tip.hidden = true; }
  }, true);
  document.addEventListener('focusin', function (ev) { if (cur && ev.target === cur && !learned) { learned = true; set(); tip.hidden = true; } });
  window.addEventListener('scroll', place, { passive: true });
  window.addEventListener('resize', place);
  setInterval(place, 350); place();
})();
