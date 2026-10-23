/* 도째비와 인증샷: 카메라 화면 위에 캐릭터를 올려 찍는다(진짜 AR 아님 · 바닥에 고정되지 않음).
   캐릭터 그림은 CHAR 한 줄만 바꾸면 교체된다(재단 캐릭터 사용 허가 전에는 도깨비불 그림). */
(function () {
  'use strict';
  var CHAR = 'camchar.svg';
  var $ = function (id) { return document.getElementById(id); };
  var root = document.createElement('div');
  root.id = 'camView'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', '도째비와 인증샷'); root.hidden = true;
  root.innerHTML =
    '<div class="cam-stage" id="camStage">' +
      '<video id="camVideo" playsinline muted autoplay></video>' +
      '<img id="camPhoto" alt="" hidden>' +
      '<img id="camChar" alt="도째비" draggable="false" src="' + CHAR + '">' +
      '<p class="cam-msg" id="camMsg" role="status" hidden></p>' +
    '</div>' +
    '<div class="cam-bar" id="camBar">' +
      '<button type="button" class="cam-b" id="camClose">닫기</button>' +
      '<button type="button" class="cam-b" id="camSmall" aria-label="도째비 작게">작게</button>' +
      '<button type="button" class="cam-shot" id="camShot" aria-label="사진 찍기"><span></span></button>' +
      '<button type="button" class="cam-b" id="camBig" aria-label="도째비 크게">크게</button>' +
      '<button type="button" class="cam-b" id="camFlip">전환</button>' +
    '</div>' +
    '<div class="cam-bar" id="camBar2" hidden>' +
      '<button type="button" class="cam-b" id="camRetake">다시 찍기</button>' +
      '<button type="button" class="cam-b main" id="camSave">저장</button>' +
      '<button type="button" class="cam-b main" id="camShare">공유</button>' +
    '</div>' +
    '<label class="cam-pick" id="camPick" hidden>사진 불러오기<input type="file" id="camFile" accept="image/*" class="visually-hidden"></label>';
  document.body.appendChild(root);

  var stream = null, facing = 'environment', mode = 'live', st = { x: 0.5, y: 0.62, w: 0.4 }, out = null;
  var stage = $('camStage'), vid = $('camVideo'), ph = $('camPhoto'), ch = $('camChar'), msg = $('camMsg');

  function say(t) { msg.textContent = t || ''; msg.hidden = !t; }
  function place() {
    var r = stage.getBoundingClientRect(), w = Math.max(60, st.w * r.width);
    ch.style.width = w + 'px'; ch.style.left = (st.x * r.width - w / 2) + 'px'; ch.style.top = (st.y * r.height - w * 1.2 / 2) + 'px';
  }
  function stopCam() { if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; } vid.srcObject = null; }
  function startCam() {
    stopCam(); say('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { noCam('이 화면에서는 카메라를 쓸 수 없어요. 사진을 불러와서 찍어 보세요.'); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing } }, audio: false }).then(function (s) {
      stream = s; vid.srcObject = s; vid.style.transform = facing === 'user' ? 'scaleX(-1)' : ''; vid.hidden = false; ph.hidden = true; mode = 'live'; $('camPick').hidden = false;
    }).catch(function () { noCam('카메라가 꺼져 있어요. 브라우저에서 카메라를 허용하시거나, 사진을 불러와서 찍어 보세요.'); });
  }
  function noCam(t) { say(t); $('camPick').hidden = false; mode = 'none'; }
  function open() {
    root.hidden = false; document.body.classList.add('no-scroll'); out = null; $('camBar').hidden = false; $('camBar2').hidden = true; ph.hidden = true; ch.hidden = false;
    st = { x: 0.5, y: 0.62, w: 0.4 }; setTimeout(place, 30); startCam();
  }
  function close() { stopCam(); root.hidden = true; document.body.classList.remove('no-scroll'); }
  $('camClose').addEventListener('click', close);
  $('camFlip').addEventListener('click', function () { facing = facing === 'user' ? 'environment' : 'user'; startCam(); });
  $('camBig').addEventListener('click', function () { st.w = Math.min(1.2, st.w * 1.15); place(); });
  $('camSmall').addEventListener('click', function () { st.w = Math.max(0.12, st.w / 1.15); place(); });
  $('camFile').addEventListener('change', function () {
    var f = this.files && this.files[0]; if (!f) return;
    var u = URL.createObjectURL(f); ph.onload = function () { stopCam(); vid.hidden = true; ph.hidden = false; mode = 'photo'; say(''); }; ph.src = u;
  });
  /* 끌어서 옮기기 · 두 손가락으로 크기 */
  var ptrs = {}, base = null;
  ch.addEventListener('pointerdown', function (e) { ch.setPointerCapture(e.pointerId); ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; base = null; e.preventDefault(); });
  ch.addEventListener('pointermove', function (e) {
    if (!ptrs[e.pointerId]) return; var r = stage.getBoundingClientRect(), p = ptrs[e.pointerId], ids = Object.keys(ptrs);
    if (ids.length === 2) {
      var a = ptrs[ids[0]], b = ptrs[ids[1]]; ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      var a2 = ptrs[ids[0]], b2 = ptrs[ids[1]], d0 = Math.hypot(a.x - b.x, a.y - b.y), d1 = Math.hypot(a2.x - b2.x, a2.y - b2.y);
      if (d0 > 10) { st.w = Math.max(0.12, Math.min(1.2, st.w * d1 / d0)); place(); }
      return;
    }
    st.x = Math.max(0, Math.min(1, st.x + (e.clientX - p.x) / r.width)); st.y = Math.max(0, Math.min(1, st.y + (e.clientY - p.y) / r.height));
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; place();
  });
  function up(e) { delete ptrs[e.pointerId]; }
  ch.addEventListener('pointerup', up); ch.addEventListener('pointercancel', up);
  window.addEventListener('resize', function () { if (!root.hidden) place(); });

  /* 찍기: 보이는 화면 그대로(가운데 맞춰 자른 영역) + 캐릭터 */
  function shoot() {
    var src = mode === 'live' ? vid : (mode === 'photo' ? ph : null), r = stage.getBoundingClientRect();
    var vw = mode === 'live' ? vid.videoWidth : (src && src.naturalWidth), vh = mode === 'live' ? vid.videoHeight : (src && src.naturalHeight);
    var cv = document.createElement('canvas'), g;
    if (!src || !vw) { cv.width = Math.round(r.width * 2); cv.height = Math.round(r.height * 2); g = cv.getContext('2d'); g.fillStyle = '#0b2f52'; g.fillRect(0, 0, cv.width, cv.height); var k0 = 2; drawChar(g, k0, r, function () { finish(cv); }); return; }
    var s = Math.max(r.width / vw, r.height / vh), sw = r.width / s, sh = r.height / s, sx = (vw - sw) / 2, sy = (vh - sh) / 2;
    cv.width = Math.round(sw); cv.height = Math.round(sh); g = cv.getContext('2d');
    if (mode === 'live' && facing === 'user') { g.save(); g.translate(cv.width, 0); g.scale(-1, 1); g.drawImage(src, sx, sy, sw, sh, 0, 0, cv.width, cv.height); g.restore(); }
    else g.drawImage(src, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
    drawChar(g, 1 / s, r, function () { finish(cv); });
  }
  function drawChar(g, k, r, done) {
    var w = Math.max(60, st.w * r.width), cx = st.x * r.width, top = st.y * r.height - w * 1.2 / 2;
    var im = new Image(); im.onload = function () { g.drawImage(im, (cx - w / 2) * k, top * k, w * k, w * 1.2 * k); done(); }; im.onerror = done; im.src = CHAR;
  }
  function finish(cv) {
    cv.toBlob(function (b) {
      if (!b) { say('사진을 만들지 못했어요. 다시 시도해 주세요.'); return; }
      out = b; if (ph.dataset.res) URL.revokeObjectURL(ph.dataset.res);
      var u = URL.createObjectURL(b); ph.dataset.res = u; ph.src = u; ph.hidden = false; vid.hidden = true; ch.hidden = true; mode = 'result';
      $('camBar').hidden = true; $('camBar2').hidden = false; $('camPick').hidden = true; stopCam();
    }, 'image/jpeg', 0.92);
  }
  $('camShot').addEventListener('click', shoot);
  $('camRetake').addEventListener('click', function () { out = null; ch.hidden = false; $('camBar').hidden = false; $('camBar2').hidden = true; place(); startCam(); });
  $('camSave').addEventListener('click', function () {
    if (!out) return; var a = document.createElement('a'); a.href = URL.createObjectURL(out); a.download = '도째비_동해_' + Date.now() + '.jpg'; document.body.appendChild(a); a.click(); a.remove(); say('저장했어요. 갤러리나 다운로드 폴더를 확인해 주세요.');
  });
  $('camShare').addEventListener('click', function () {
    if (!out) return; var f = new File([out], 'dojjaebi.jpg', { type: 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f], title: '도째비와 동해', text: '도째비와 동해 여행' }).catch(function () { /* 취소 */ });
    else say('이 브라우저는 바로 공유가 안 돼요. 저장을 눌러 주세요.');
  });
  window.TourCam = { open: open, close: close };
})();
