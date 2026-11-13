/* 뒤로가기(안드로이드 뒤로 버튼) 관리
   - 열린 창(시트·이야기·사진·카메라·사랑방 등)이 있으면 그 창만 닫는다.
   - 없으면 직전 화면으로 돌아간다.
   - 처음 화면에서 한 번 더 누르면 그때 앱을 나간다. */
(function () {
  'use strict';
  var IDS = ['story', 'addSheet', 'cfSheet', 'recSheet', 'ttSheet', 'imgView', 'repLoc', 'lvAsk', 'camView', 'chatRoom'];
  var closers = {}, stack = [], cur = 's-start', goScreen = null;

  function el(id) { return document.getElementById(id); }
  function isOpen(id) { var e = el(id); return !!e && !e.hidden; }
  function sync() {
    stack = stack.filter(isOpen);
    IDS.forEach(function (id) { if (isOpen(id) && stack.indexOf(id) < 0) stack.push(id); });
  }
  function closeTop() {
    sync();
    var id = stack.pop();
    if (!id) return false;
    var fn = closers[id];
    try { if (fn) fn(); else el(id).hidden = true; } catch (e) { el(id).hidden = true; }
    if (isOpen(id)) el(id).hidden = true;
    return true;
  }
  function stateOf() { try { return history.state || null; } catch (e) { return null; } }

  /* 처음: 맨 아래 칸(root) 위에 첫 화면 칸을 쌓는다. 새로 고침이면 칸을 더 쌓지 않는다. */
  try {
    var st = stateOf();
    if (st && (st.root || st.scr)) history.replaceState({ scr: 's-start' }, '');
    else { history.replaceState({ root: 1 }, ''); history.pushState({ scr: 's-start' }, ''); }
  } catch (e) { /* 무시 */ }

  window.addEventListener('popstate', function () {
    var st = stateOf();
    sync();
    if (stack.length) { // 열린 창이 있으면 창만 닫고, 화면 칸은 그대로 다시 쌓는다
      closeTop();
      try { history.pushState({ scr: cur }, ''); } catch (e) { /* 무시 */ }
      return;
    }
    if (!st) return;
    if (st.root) { try { history.back(); } catch (e) { /* 무시 */ } return; } // 맨 처음에서 뒤로 = 앱 나가기
    if (st.scr && st.scr !== cur && goScreen) { cur = st.scr; goScreen(st.scr); }
  });

  window.TourNav = {
    register: function (id, fn) { closers[id] = fn; },
    onScreen: function (fn) { goScreen = fn; },
    screen: function (id) { // 화면이 바뀔 때 app.js 가 알려 준다
      if (id === cur) return;
      cur = id;
      try { history.pushState({ scr: id }, ''); } catch (e) { /* 무시 */ }
    },
    quiet: function (id) { cur = id; } // 뒤로가기로 돌아온 화면은 칸을 또 쌓지 않는다
    ,_stack: function () { sync(); return stack.slice(); }
  };

  try {
    new MutationObserver(sync).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['hidden'], childList: true });
  } catch (e) { /* 무시 */ }
})();
