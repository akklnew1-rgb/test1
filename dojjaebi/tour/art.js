/* 도째비 길동무 — 장소별 그림(사진 아님). 하늘·바다·불빛을 그라데이션과 도형으로 그린 일러스트. eat_ 로 시작하는 한 끼 가게는 식탁 위 그릇 그림.
   window.TourArt.svg(장소id) → 정사각 SVG 글자. 같은 쪽에 여러 번 넣어도 id 가 겹치지 않는다. */
(function (root) {
  'use strict';
  var N = 0;
  function lg(id, cols, dir) {
    var st = cols.map(function (c, i) { return '<stop offset="' + (cols.length === 1 ? 0 : Math.round(i * 100 / (cols.length - 1))) + '%" stop-color="' + c + '"/>'; }).join('');
    return '<linearGradient id="' + id + '" x1="0" y1="0" x2="' + (dir === 'h' ? 1 : 0) + '" y2="' + (dir === 'h' ? 0 : 1) + '">' + st + '</linearGradient>';
  }
  function rg(id, cols, cx, cy, r) {
    var st = cols.map(function (c, i) { return '<stop offset="' + Math.round(i * 100 / (cols.length - 1)) + '%" stop-color="' + c[0] + '" stop-opacity="' + c[1] + '"/>'; }).join('');
    return '<radialGradient id="' + id + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '">' + st + '</radialGradient>';
  }
  function waves(y, n, col, op) {
    var s = '';
    for (var i = 0; i < n; i++) {
      var yy = y + i * 18, x = (i * 53) % 120;
      s += '<path d="M' + (x - 40) + ' ' + yy + 'q20 -8 40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0" fill="none" stroke="' + col + '" stroke-opacity="' + op + '" stroke-width="3" stroke-linecap="round"/>';
    }
    return s;
  }
  function stars(n, seed) {
    var s = '';
    for (var i = 0; i < n; i++) { var x = (i * 97 + seed * 31) % 390 + 5, y = (i * 53 + seed * 17) % 170 + 8, r = (i % 3 === 0) ? 2.2 : 1.4; s += '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="#fff" opacity="' + (0.5 + (i % 4) * 0.12) + '"/>'; }
    return s;
  }

  var SCENES = {
    mukhoport: function (u) { /* 새벽 항구 */
      return '<defs>' + lg(u + 'a', ['#ffe3b3', '#ffa57d', '#f0707c']) + lg(u + 'b', ['#2f89a3', '#0d3f58']) + '</defs>' +
        '<rect width="400" height="400" fill="url(#' + u + 'a)"/><circle cx="270" cy="228" r="54" fill="#fff3cf" opacity=".95"/>' +
        '<rect y="236" width="400" height="164" fill="url(#' + u + 'b)"/>' +
        '<rect x="228" y="250" width="86" height="6" rx="3" fill="#ffe9ae" opacity=".7"/><rect x="242" y="268" width="58" height="5" rx="2.5" fill="#ffe9ae" opacity=".5"/>' +
        waves(300, 4, '#ffffff', .22) +
        '<path d="M52 262h140l-20 30H74z" fill="#10222c"/><rect x="104" y="232" width="46" height="30" rx="4" fill="#e8eef0"/><rect x="112" y="240" width="12" height="10" fill="#10222c"/><path d="M168 262V196" stroke="#10222c" stroke-width="5"/><path d="M168 200l26 52h-26z" fill="#ffd36b"/>' +
        '<path d="M330 236V120h12M330 130h62M388 130v24" stroke="#1d2f3a" stroke-width="6" fill="none" stroke-linecap="round"/><rect x="316" y="236" width="42" height="8" fill="#1d2f3a"/>' +
        '<path d="M60 90q12-10 24 0q12-10 24 0" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".85"/>';
    },
    nolgol: function (u) { /* 골목 벽화 */
      return '<defs>' + lg(u + 'a', ['#9fd8e6', '#ffe7c2']) + lg(u + 'b', ['#f7c9a0', '#e49a6c']) + '</defs>' +
        '<rect width="400" height="400" fill="url(#' + u + 'a)"/>' +
        '<rect x="170" y="130" width="62" height="86" fill="#3aa7c4"/><path d="M170 190q15-10 31 0t31 0V216H170z" fill="#1d7f9c"/>' +
        '<path d="M0 40h176v360H0z" fill="url(#' + u + 'b)"/><path d="M0 40h176v22H0z" fill="#c97b52"/>' +
        '<rect x="22" y="104" width="128" height="156" rx="10" fill="#17a398"/><circle cx="108" cy="146" r="22" fill="#ffd36b"/><path d="M22 214q21-22 42 0t42 0t44 0v46H22z" fill="#0b6f6a"/><path d="M52 190c16-14 36-6 40 6-10-2-20 0-30 10z" fill="#fff" opacity=".9"/>' +
        '<rect x="22" y="282" width="46" height="62" rx="6" fill="#7a4a35"/><rect x="30" y="292" width="30" height="24" fill="#ffe3b3"/>' +
        '<path d="M232 20h168v380H232z" fill="#efc86f"/><rect x="254" y="82" width="124" height="118" rx="10" fill="#ff7a59"/><path d="M270 150c24-34 56-34 78-8-22 2-38 18-52 34 4-10-6-20-26-26z" fill="#fff3e2"/><circle cx="332" cy="116" r="5" fill="#2a1500"/>' +
        '<path d="M232 300h168" stroke="#c99a3b" stroke-width="3"/>' +
        '<path d="M176 400l24-92h-12L152 400zM232 400l-24-92h12l36 92z" fill="#e8d3b8"/>' +
        '<g fill="#cfa982"><path d="M162 330h76l8 14h-92zM154 356h92l10 16h-112zM146 384h108l8 16H138z"/></g>' +
        '<path d="M8 74Q88 100 168 70" stroke="#6b4a3a" stroke-width="2" fill="none"/><g><rect x="30" y="84" width="14" height="22" fill="#fff" transform="rotate(-6 37 95)"/><rect x="82" y="92" width="14" height="22" fill="#ffd36b"/><rect x="128" y="86" width="14" height="22" fill="#ff7a59" transform="rotate(5 135 97)"/></g>';
    },
    lighthouse: function (u) { /* 해 질 녘 등대 */
      return '<defs>' + lg(u + 'a', ['#2b2b6e', '#c4558c', '#ffb487']) + lg(u + 'b', ['#2a4f78', '#0d2540']) + '</defs>' +
        '<rect width="400" height="400" fill="url(#' + u + 'a)"/>' + stars(18, 3) +
        '<rect y="262" width="400" height="138" fill="url(#' + u + 'b)"/>' + waves(290, 3, '#ffffff', .18) +
        '<polygon points="230,112 400,60 400,176" fill="#fff6d0" opacity=".28"/>' +
        '<path d="M0 250q60-30 130-8l60 22 30 60-120 76H0z" fill="#1b2a2f"/>' +
        '<path d="M176 128h48l16 150h-80z" fill="#fff"/><path d="M168 218h64l4 32h-72z" fill="#e5484d"/><path d="M176 150h48l-1.5 14h-45z" fill="#e5484d"/>' +
        '<rect x="172" y="104" width="56" height="26" rx="3" fill="#ffd36b"/><rect x="180" y="110" width="40" height="14" fill="#fff6d0"/><path d="M168 104l32-30 32 30z" fill="#e5484d"/><circle cx="200" cy="70" r="5" fill="#fff"/>' +
        '<rect x="148" y="278" width="104" height="14" rx="3" fill="#1b2a2f"/>' +
        '<circle cx="330" cy="236" r="26" fill="#ffd9a0" opacity=".9"/>';
    },
    skyvalley: function (u) { /* 밤 스카이워크·그네 */
      return '<defs>' + lg(u + 'a', ['#15113f', '#3a2a7c', '#e0668a']) + lg(u + 'b', ['#1c3d6b', '#0a1730']) + rg(u + 'c', [['#ffd36b', 0.9], ['#ffd36b', 0]], .5, .5, .5) + '</defs>' +
        '<rect width="400" height="400" fill="url(#' + u + 'a)"/>' + stars(26, 7) +
        '<rect y="290" width="400" height="110" fill="url(#' + u + 'b)"/>' + waves(318, 3, '#8fc7ff', .22) +
        '<path d="M0 238q50-34 120-14l60 26-30 60H0z" fill="#101a2c"/>' +
        '<g stroke="#e8f3ff" stroke-width="5" stroke-linecap="round"><path d="M40 244h220"/><path d="M60 244v52M110 244v52M160 244v52M210 244v52M250 244v52" stroke-width="2.5" opacity=".6"/></g>' +
        '<rect x="40" y="238" width="220" height="12" fill="#cfeff0" opacity=".85"/>' +
        '<circle cx="310" cy="150" r="118" fill="url(#' + u + 'c)"/>' +
        '<path d="M262 244 310 90 358 244" stroke="#e8f3ff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<circle cx="310" cy="150" r="52" fill="none" stroke="#ffd36b" stroke-width="5" stroke-dasharray="3 12" stroke-linecap="round"/><circle cx="310" cy="150" r="52" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>' +
        '<circle cx="310" cy="202" r="9" fill="#ff7a59"/><rect x="306" y="150" width="8" height="52" fill="#fff" opacity=".5"/>';
    },
    nightmarket: function (u) { /* 야시장 */
      var bulbs = '', xs = [18, 62, 108, 152, 198, 244, 290, 336, 380];
      xs.forEach(function (x, i) { var y = 86 + Math.sin(x / 64) * 22 + 30; bulbs += '<circle cx="' + x + '" cy="' + y + '" r="22" fill="url(#' + u + 'c)"/><circle cx="' + x + '" cy="' + y + '" r="7" fill="' + (i % 2 ? '#ffd36b' : '#ffb27a') + '"/>'; });
      return '<defs>' + lg(u + 'a', ['#091f2c', '#14566b']) + rg(u + 'c', [['#ffd36b', 0.6], ['#ffd36b', 0]], .5, .5, .5) + '</defs>' +
        '<rect width="400" height="400" fill="url(#' + u + 'a)"/>' +
        '<path d="M-10 78Q100 150 200 112T410 78" fill="none" stroke="#243947" stroke-width="3"/>' + bulbs +
        '<g><path d="M20 250l60-56 60 56z" fill="#ff7a59"/><rect x="26" y="250" width="108" height="86" fill="#2a1d1b"/><rect x="36" y="262" width="88" height="14" fill="#f0a830"/></g>' +
        '<g><path d="M150 250l60-56 60 56z" fill="#17a398"/><rect x="156" y="250" width="108" height="86" fill="#17262d"/><rect x="166" y="262" width="88" height="14" fill="#ffd36b"/></g>' +
        '<g><path d="M280 250l50-56 50 56z" fill="#f0a830"/><rect x="284" y="250" width="92" height="86" fill="#2a1d1b"/><rect x="292" y="262" width="76" height="14" fill="#ff7a59"/></g>' +
        '<rect y="336" width="400" height="64" fill="#0a1a24"/><ellipse cx="200" cy="344" rx="190" ry="10" fill="#ffd36b" opacity=".12"/>' +
        '<circle cx="78" cy="304" r="9" fill="#ffd36b"/><circle cx="208" cy="304" r="9" fill="#fff"/><circle cx="330" cy="304" r="9" fill="#ffd36b"/>';
    },
    eodal: function (u) { /* 노을 해변 */
      return '<defs>' + lg(u + 'a', ['#5a4fa6', '#ff7a8a', '#ffb347']) + lg(u + 'b', ['#e86a7a', '#6d4a9c']) + lg(u + 'd', ['#f6dcaa', '#d7b27a']) + '</defs>' +
        '<rect width="400" height="400" fill="url(#' + u + 'a)"/><circle cx="200" cy="232" r="92" fill="#ffe08a"/>' +
        '<rect y="236" width="400" height="104" fill="url(#' + u + 'b)"/><rect x="150" y="250" width="100" height="6" rx="3" fill="#ffe08a" opacity=".7"/><rect x="164" y="268" width="72" height="5" rx="2.5" fill="#ffe08a" opacity=".55"/>' +
        waves(286, 3, '#ffffff', .3) +
        '<path d="M0 330q100-26 200-8t200-12v90H0z" fill="url(#' + u + 'd)"/><path d="M0 330q100-26 200-8t200-12" fill="none" stroke="#fff" stroke-width="5" opacity=".8" stroke-linecap="round"/>' +
        '<path d="M72 120q10-9 20 0q10-9 20 0M300 96q8-7 16 0q8-7 16 0" stroke="#2a1d3a" stroke-width="3" fill="none" stroke-linecap="round"/>';
    },
    chuam: function (u) { /* 촛대바위 일출 */
      return '<defs>' + lg(u + 'a', ['#ff8f56', '#ffc989', '#fff0c8']) + lg(u + 'b', ['#4aa3b8', '#1b5877']) + '</defs>' +
        '<rect width="400" height="400" fill="url(#' + u + 'a)"/><circle cx="214" cy="212" r="64" fill="#fff3c4"/>' +
        '<rect y="236" width="400" height="164" fill="url(#' + u + 'b)"/>' +
        '<g fill="#ffe9a6" opacity=".7"><rect x="190" y="248" width="50" height="6" rx="3"/><rect x="198" y="266" width="36" height="5" rx="2.5"/><rect x="204" y="284" width="24" height="5" rx="2.5"/></g>' +
        waves(312, 3, '#ffffff', .18) +
        '<path d="M120 300l10-150 8-12 12 4 10 14 8 144z" fill="#252a35"/><path d="M130 300l8-146 12-8" stroke="#4a5266" stroke-width="4" fill="none"/>' +
        '<path d="M214 300l6-90 10-8 8 8 6 90z" fill="#2c3340"/><path d="M62 304l12-52 14-8 14 10 8 50z" fill="#2c3340"/><path d="M290 306l10-44 16-6 14 10 4 40z" fill="#252a35"/>' +
        '<path d="M96 304h250l-24 22H110z" fill="#1d222b"/>';
    },
    cheongok: function (u) { /* 동굴 */
      var st = '', i;
      for (i = 0; i < 12; i++) { var x = 14 + i * 33, h = 40 + ((i * 37) % 70); st += '<path d="M' + (x - 14) + ' 0L' + x + ' ' + h + ' ' + (x + 16) + ' 0z" fill="url(#' + u + 'd)"/>'; }
      var sg = '';
      for (i = 0; i < 9; i++) { var x2 = 24 + i * 44, h2 = 30 + ((i * 53) % 60); sg += '<path d="M' + (x2 - 16) + ' 400L' + x2 + ' ' + (400 - h2) + ' ' + (x2 + 18) + ' 400z" fill="#8b7a62"/>'; }
      return '<defs>' + lg(u + 'a', ['#0d1a29', '#1b4150']) + lg(u + 'd', ['#d8c8a6', '#8b7a62']) + rg(u + 'c', [['#ffd36b', 0.85], ['#17a398', 0.25], ['#17a398', 0]], .5, .5, .5) + '</defs>' +
        '<rect width="400" height="400" fill="url(#' + u + 'a)"/><circle cx="200" cy="215" r="190" fill="url(#' + u + 'c)"/>' +
        st + sg +
        '<path d="M0 360q100-30 200-12t200-14v66H0z" fill="#12202c"/>' +
        '<g fill="#ffd36b"><ellipse cx="200" cy="208" rx="12" ry="18"/><path d="M190 200q-30-28-64-14q18 4 22 18q12-10 26-2zM210 200q30-28 64-14q-18 4-22 18q-12-10-26-2z"/><path d="M194 192l-3-14 9 7 9-7-3 14z"/></g>' +
        '<circle cx="196" cy="204" r="2" fill="#2a1500"/><circle cx="204" cy="204" r="2" fill="#2a1500"/>';
    }
  };

  /* ---- 2026-10-17 추가 장소 그림 (모두 "그림" 표시 — 사진 아님) ---- */
  function pines(xs, base, col) {
    var s = '';
    xs.forEach(function (x, i) { var h = 70 + (i % 3) * 18; s += '<path d="M' + (x - 22) + ' ' + base + 'l22 -' + h + ' 22 ' + h + 'z" fill="' + col + '"/><path d="M' + (x - 17) + ' ' + (base - h * 0.45) + 'l17 -' + h * 0.7 + ' 17 ' + h * 0.7 + 'z" fill="' + col + '"/><rect x="' + (x - 3) + '" y="' + base + '" width="6" height="12" fill="#5a3d2b"/>'; });
    return s;
  }
  /* 해변 한 장: o.sky/o.sea 색, o.sun [x,y,r,색], o.hor 수평선 높이, o.pines 소나무, o.umb 파라솔, o.rocks 바위 */
  function beach(o) {
    return function (u) {
      var s = '<defs>' + lg(u + 'a', o.sky) + lg(u + 'b', o.sea) + lg(u + 'd', ['#f6e3b8', '#d9bd86']) + '</defs>' +
        '<rect width="400" height="400" fill="url(#' + u + 'a)"/>';
      if (o.sun) s += '<circle cx="' + o.sun[0] + '" cy="' + o.sun[1] + '" r="' + o.sun[2] + '" fill="' + o.sun[3] + '"/>';
      s += '<path d="M60 90q14-12 28 0q14-12 28 0" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round" opacity=".8"/>' +
        '<rect y="' + o.hor + '" width="400" height="' + (400 - o.hor) + '" fill="url(#' + u + 'b)"/>' +
        waves(o.hor + 22, 3, '#ffffff', .3);
      if (o.rocks) s += '<path d="M250 ' + (o.hor + 40) + 'l8-96 10-10 10 8 8 98z" fill="#2c3340"/><path d="M300 ' + (o.hor + 44) + 'l6-52 10-6 8 8 4 50z" fill="#252a35"/><path d="M200 ' + (o.hor + 40) + 'l6-40 8-4 8 6 4 38z" fill="#2c3340"/>';
      s += '<path d="M0 322q100-26 200-8t200-12v110H0z" fill="url(#' + u + 'd)"/><path d="M0 322q100-26 200-8t200-12" fill="none" stroke="#fff" stroke-width="5" opacity=".85" stroke-linecap="round"/>';
      if (o.pines) s += pines(o.pines, 306, '#1f5a3a');
      if (o.umb) s += '<path d="M236 330a46 46 0 0 1 92 0z" fill="' + o.umb + '"/><path d="M282 330v44" stroke="#6b4a3a" stroke-width="5" stroke-linecap="round"/><path d="M236 330a46 46 0 0 1 46-46" fill="none"/><ellipse cx="282" cy="378" rx="42" ry="6" fill="#000" opacity=".1"/>';
      return s;
    };
  }
  SCENES.daejin = beach({ sky: ['#7cc7ef', '#d8f0fb'], sea: ['#2b9bc4', '#0f5f86'], sun: [310, 80, 34, '#fff3b0'], hor: 232, pines: [40, 92], umb: '#ff7a59' });
  SCENES.nobong = beach({ sky: ['#a9dcf5', '#fdf2dc'], sea: ['#3fa9b8', '#1b6f7f'], sun: [96, 96, 28, '#fff0b8'], hor: 240, pines: [330, 372, 296], umb: '#17a398' });
  SCENES.mangsang = beach({ sky: ['#5ab1e8', '#cfeaf9'], sea: ['#1f86b8', '#0b4f78'], sun: [330, 70, 30, '#fff7c4'], hor: 226, pines: [28, 70, 112, 360], umb: '#f0a830' });
  SCENES.hanseom = beach({ sky: ['#b7a6e8', '#ffd1b0'], sea: ['#4d8fb8', '#1e4f78'], sun: [120, 214, 44, '#ffe9a6'], hor: 236, rocks: true });
  SCENES.chuambeach = beach({ sky: ['#ff9a62', '#ffe2b0'], sea: ['#3f93ad', '#194f6b'], sun: [140, 220, 52, '#fff3c4'], hor: 238, rocks: true, pines: [350] });

  SCENES.suibyeon = function (u) { /* 방파제 수변공원 */
    return '<defs>' + lg(u + 'a', ['#ffcf9a', '#ffe9c8']) + lg(u + 'b', ['#3d8fb0', '#15506f']) + '</defs>' +
      '<rect width="400" height="400" fill="url(#' + u + 'a)"/><circle cx="300" cy="160" r="46" fill="#fff4cf"/>' +
      '<rect y="190" width="400" height="210" fill="url(#' + u + 'b)"/>' + waves(244, 3, '#fff', .25) +
      '<path d="M0 270h400v34H0z" fill="#cdbfae"/><path d="M0 270h400" stroke="#fff" stroke-width="5" opacity=".7"/>' +
      '<g fill="#a89a88"><rect x="0" y="304" width="400" height="12"/><rect x="18" y="316" width="364" height="12"/><rect x="40" y="328" width="320" height="12"/><rect x="62" y="340" width="276" height="12"/></g>' +
      '<g fill="#ff7a59"><circle cx="96" cy="250" r="16"/><rect x="88" y="262" width="16" height="12"/></g><g fill="#17a398"><path d="M230 274l16-40 16 40z"/></g>' +
      '<path d="M138 270v-46h10v46M128 224h30" stroke="#3a2a24" stroke-width="5" fill="none" stroke-linecap="round"/>';
  };
  SCENES.jeonmangdae = function (u) { /* 항구 전망대 */
    return '<defs>' + lg(u + 'a', ['#4d9fd6', '#bfe3f6']) + lg(u + 'b', ['#2b86b0', '#0f4d70']) + '</defs>' +
      '<rect width="400" height="400" fill="url(#' + u + 'a)"/><circle cx="76" cy="84" r="30" fill="#fff6c8" opacity=".95"/>' +
      '<rect y="268" width="400" height="132" fill="url(#' + u + 'b)"/>' + waves(300, 3, '#fff', .22) +
      '<path d="M0 268h400v18H0z" fill="#8c8478"/>' +
      '<path d="M170 268V150h60v118z" fill="#e8eef0"/><path d="M158 150h84l-8-30h-68z" fill="#17a398"/><rect x="170" y="100" width="60" height="30" fill="#bfe3f6" stroke="#fff" stroke-width="4"/><path d="M200 100V70" stroke="#e5484d" stroke-width="5"/><path d="M200 70l22 8-22 8z" fill="#e5484d"/>' +
      '<g fill="#fff"><rect x="182" y="168" width="14" height="14"/><rect x="204" y="168" width="14" height="14"/><rect x="182" y="196" width="14" height="14"/><rect x="204" y="196" width="14" height="14"/></g><rect x="182" y="232" width="36" height="36" fill="#ffd36b"/>' +
      '<path d="M40 268l24-30h56l24 30z" fill="#2a1d1b"/><path d="M290 268l16-22 56 0 16 22z" fill="#f0a830"/>';
  };
  SCENES.chuamsculpt = function (u) { /* 조각공원 */
    return '<defs>' + lg(u + 'a', ['#ff9f66', '#ffe0b0']) + lg(u + 'b', ['#4aa3b8', '#1b5877']) + lg(u + 'g', ['#6fbf73', '#2f8f55']) + '</defs>' +
      '<rect width="400" height="400" fill="url(#' + u + 'a)"/><circle cx="300" cy="170" r="50" fill="#fff3c4"/>' +
      '<rect y="214" width="400" height="80" fill="url(#' + u + 'b)"/>' +
      '<path d="M0 290q120-34 240-10t160-16v136H0z" fill="url(#' + u + 'g)"/>' +
      '<path d="M70 330l8-70c10-14 22-14 32 0l8 70z" fill="#e8d9c0"/><circle cx="94" cy="238" r="18" fill="#e8d9c0"/>' +
      '<path d="M170 340c-14-40 6-84 40-96-6 28 24 40 22 96z" fill="#c97b52"/>' +
      '<path d="M270 340v-96M270 244l44 28-44 28" stroke="#3a4a7a" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
  };
  SCENES.cheongokpark = function (u) { /* 돌리네 공원 */
    var fl = '', i;
    for (i = 0; i < 14; i++) fl += '<circle cx="' + (24 + i * 27) + '" cy="' + (318 + (i % 3) * 14) + '" r="5" fill="' + (i % 2 ? '#ffd36b' : '#ff7a8a') + '"/>';
    return '<defs>' + lg(u + 'a', ['#9fd8f0', '#e6f6e8']) + lg(u + 'g', ['#7fcf7a', '#2f8f55']) + lg(u + 'b', ['#4a9fc4', '#1d6a8f']) + '</defs>' +
      '<rect width="400" height="400" fill="url(#' + u + 'a)"/><rect y="170" width="400" height="40" fill="url(#' + u + 'b)"/>' +
      '<path d="M0 220q90-36 180-8t220-20v208H0z" fill="url(#' + u + 'g)"/>' +
      '<path d="M0 300q120-60 240-30t160 10v30H0z" fill="#3f9f63" opacity=".7"/>' +
      '<path d="M40 400q120-90 220-110t140-20" stroke="#c9a06a" stroke-width="26" fill="none" stroke-linecap="round"/><path d="M40 400q120-90 220-110t140-20" stroke="#e0bd86" stroke-width="16" fill="none" stroke-linecap="round" stroke-dasharray="3 14"/>' +
      fl + '<g fill="#1f5a3a"><path d="M300 240l18-60 18 60z"/><path d="M330 236l14-46 14 46z"/></g>' +
      '<path d="M230 170l3-26 4 26z M236 170l2-20 3 20z" fill="#fff"/><circle cx="64" cy="96" r="26" fill="#fff6c8"/>';
  };
  SCENES.gamchusa = function (u) { /* 바닷가 절 */
    return '<defs>' + lg(u + 'a', ['#ffd9a8', '#ffe9d0']) + lg(u + 'b', ['#3f8fb0', '#164a6a']) + '</defs>' +
      '<rect width="400" height="400" fill="url(#' + u + 'a)"/><circle cx="310" cy="120" r="34" fill="#fff0c0"/>' +
      '<rect y="224" width="400" height="176" fill="url(#' + u + 'b)"/>' + waves(262, 3, '#fff', .25) +
      '<path d="M0 200q60-30 140-20l70 40-20 120H0z" fill="#46503f"/><path d="M0 250q100-20 180 0l30 150H0z" fill="#2c3340"/>' +
      '<path d="M70 232h92M58 244h116" stroke="#8a2f2f" stroke-width="8" stroke-linecap="round"/><path d="M60 232q52-34 104 0z" fill="#3a2a24"/><rect x="76" y="244" width="72" height="40" fill="#f3e3c4"/><rect x="104" y="254" width="16" height="30" fill="#8a2f2f"/>' +
      '<g fill="#cfc8b8"><rect x="214" y="260" width="30" height="8"/><rect x="218" y="248" width="22" height="8"/><rect x="222" y="236" width="14" height="8"/></g>';
  };
  SCENES.samhwasa = function (u) { /* 산사 */
    return '<defs>' + lg(u + 'a', ['#9ec8e0', '#e8f2ea']) + lg(u + 'm', ['#4f8f6a', '#2a5f45']) + '</defs>' +
      '<rect width="400" height="400" fill="url(#' + u + 'a)"/>' +
      '<path d="M0 260l80-120 70 70 70-110 90 130 90-60v230H0z" fill="url(#' + u + 'm)"/><path d="M0 300l90-70 80 50 80-60 150 60v120H0z" fill="#2f6e4f"/>' +
      '<path d="M96 300h208" stroke="#3a2a24" stroke-width="8"/><path d="M80 292q120-80 240 0z" fill="#3a2a24"/><path d="M104 292q96-52 192 0z" fill="#7a3a2a"/><rect x="116" y="292" width="168" height="62" fill="#f3e3c4"/><g fill="#8a2f2f"><rect x="140" y="304" width="22" height="50"/><rect x="189" y="304" width="22" height="50"/><rect x="238" y="304" width="22" height="50"/></g>' +
      '<rect x="0" y="354" width="400" height="46" fill="#cdbfae"/><g fill="#1f5a3a"><path d="M30 352l18-76 18 76z"/><path d="M340 352l16-68 16 68z"/></g>';
  };
  SCENES.yongchu = function (u) { /* 계곡 폭포 */
    return '<defs>' + lg(u + 'a', ['#8fc9e0', '#e6f3ea']) + lg(u + 'c', ['#3a6b52', '#1f4a3a']) + lg(u + 'w', ['#ffffff', '#bfe9f4']) + '</defs>' +
      '<rect width="400" height="400" fill="url(#' + u + 'a)"/>' +
      '<path d="M0 40l70-10 40 60-20 120-30 80H0z" fill="url(#' + u + 'c)"/><path d="M400 20l-80 20-30 80 20 100 30 100h60z" fill="url(#' + u + 'c)"/>' +
      '<path d="M130 70h140l-10 120-30 90h-60l-30-90z" fill="#6f7f78"/>' +
      '<path d="M176 70h48l-6 80q-18 24-36 0z" fill="url(#' + u + 'w)"/><path d="M178 150q22 28 44 0l-4 52h-36z" fill="url(#' + u + 'w)" opacity=".9"/><path d="M168 230q32 14 64 0l8 54h-80z" fill="url(#' + u + 'w)" opacity=".85"/>' +
      '<ellipse cx="200" cy="318" rx="120" ry="30" fill="#3fb1ba"/><ellipse cx="200" cy="312" rx="90" ry="18" fill="#9de3e6" opacity=".75"/>' +
      '<ellipse cx="200" cy="296" rx="44" ry="10" fill="#fff" opacity=".6"/>' +
      '<path d="M0 350q100-30 200-10t200-14v74H0z" fill="#2f6e4f"/><g fill="#1f5a3a"><path d="M40 360l20-70 20 70z"/><path d="M330 360l18-64 18 64z"/></g>';
  };
  SCENES.byeoryu = function (u) { /* 석회석 절개면과 에메랄드 호수 */
    return '<defs>' + lg(u + 'a', ['#78bfe8', '#e0f2fa']) + lg(u + 'l', ['#2fd0b8', '#0f8f94']) + lg(u + 'c', ['#fbfaf4', '#cfc9b8']) + '</defs>' +
      '<rect width="400" height="400" fill="url(#' + u + 'a)"/>' +
      '<path d="M0 120l60-50 40 30 50-60 60 40 40-20 150 110v230H0z" fill="url(#' + u + 'c)"/>' +
      '<path d="M60 70l14 90M150 40l20 120M250 80l-10 80M330 120l-14 60" stroke="#bdb6a2" stroke-width="5" opacity=".7"/>' +
      '<path d="M0 270q90-30 200-14t200-8v152H0z" fill="url(#' + u + 'l)"/><path d="M60 300q80-16 180-4" stroke="#fff" stroke-width="4" opacity=".4" fill="none" stroke-linecap="round"/>' +
      '<path d="M40 150L360 112" stroke="#3a4a5a" stroke-width="3"/><g transform="translate(200 128)"><rect x="-10" y="-4" width="20" height="10" rx="4" fill="#ff7a59"/><path d="M-6 -4v-8M6 -4v-8" stroke="#3a4a5a" stroke-width="3"/></g>' +
      '<path d="M0 330q100-24 200-6t200-10v86H0z" fill="#2b7f8a" opacity=".65"/>';
  };
  SCENES.bukpyeong = function (u) { /* 낮 오일장 */
    var aw = '', cols = ['#e5484d', '#17a398', '#f0a830', '#3a6fd9'], i;
    for (i = 0; i < 4; i++) {
      var x = 14 + i * 96, c = cols[i];
      aw += '<g><path d="M' + x + ' 190l8-46h72l8 46z" fill="' + c + '"/><path d="M' + (x + 8) + ' 144v46M' + (x + 24) + ' 144v46M' + (x + 40) + ' 144v46M' + (x + 56) + ' 144v46M' + (x + 72) + ' 144v46" stroke="#fff" stroke-width="5" opacity=".55"/><rect x="' + (x + 4) + '" y="190" width="88" height="96" fill="#6e4329"/><rect x="' + (x + 10) + '" y="206" width="76" height="22" fill="#f5deb0"/><circle cx="' + (x + 24) + '" cy="262" r="11" fill="' + (i % 2 ? '#ff8a5c' : '#7fc47a') + '"/><circle cx="' + (x + 48) + '" cy="264" r="11" fill="' + (i % 2 ? '#ffd36b' : '#e5484d') + '"/><circle cx="' + (x + 72) + '" cy="262" r="11" fill="' + (i % 2 ? '#7fc47a' : '#ff8a5c') + '"/></g>';
    }
    return '<defs>' + lg(u + 'a', ['#8fd0f0', '#fff3d6']) + '</defs>' +
      '<rect width="400" height="400" fill="url(#' + u + 'a)"/><circle cx="330" cy="70" r="30" fill="#fff4b8"/><path d="M0 130q100-26 200-8t200-6v70H0z" fill="#b9d8c4" opacity=".8"/>' +
      aw + '<rect y="286" width="400" height="114" fill="#d6c6a6"/><ellipse cx="200" cy="330" rx="170" ry="10" fill="#000" opacity=".08"/>' +
      '<g fill="#3a2a24"><circle cx="86" cy="316" r="10"/><rect x="78" y="326" width="16" height="30" rx="6"/><circle cx="206" cy="324" r="10"/><rect x="198" y="334" width="16" height="30" rx="6"/><circle cx="318" cy="314" r="10"/><rect x="310" y="324" width="16" height="30" rx="6"/></g>';
  };
  /* 한 끼 그림 — 식탁 위의 그릇·음식 실루엣(사진 아님). 가게마다 그릇 모양과 색만 다르다. */
  function steam(x, y, n) {
    var s = '';
    for (var i = 0; i < n; i++) { var xx = x + i * 26; s += '<path d="M' + xx + ' ' + y + 'q-12 -18 0 -34t0 -34" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="6" stroke-linecap="round"/>'; }
    return s;
  }
  function table(u, c1, c2) {
    return lg(u + 'a', [c1, c2]) + lg(u + 't', ['#a56a45', '#6e4329']) + rg(u + 'g', [['#fff3d0', 0.55], ['#fff3d0', 0]], .5, .35, .6);
  }
  function tableBg(u, top) {
    return '<rect width="400" height="400" fill="url(#' + u + 'a)"/><rect y="' + top + '" width="400" height="' + (400 - top) + '" fill="url(#' + u + 't)"/><rect width="400" height="400" fill="url(#' + u + 'g)"/>';
  }
  var MEALS = {
    eat_mulhoe: function (u) { /* 물회: 얼음 띄운 넓은 그릇 */
      return '<defs>' + table(u, '#ffe9c4', '#f6b98a') + '</defs>' + tableBg(u, 250) +
        '<ellipse cx="200" cy="330" rx="150" ry="22" fill="#2a1a10" opacity=".25"/>' +
        '<path d="M60 218h280q-6 96-140 100Q66 314 60 218z" fill="#f2f6f7"/><path d="M60 218h280" stroke="#cfd9dc" stroke-width="6"/>' +
        '<ellipse cx="200" cy="218" rx="140" ry="26" fill="#ff8a5c"/><ellipse cx="200" cy="216" rx="124" ry="20" fill="#ffb27a"/>' +
        '<g fill="#fff"><rect x="150" y="198" width="30" height="26" rx="6" transform="rotate(-10 165 211)" opacity=".92"/><rect x="215" y="194" width="28" height="24" rx="6" transform="rotate(12 229 206)" opacity=".85"/><rect x="186" y="210" width="24" height="20" rx="5" opacity=".8"/></g>' +
        '<g fill="#ff6b6b"><rect x="120" y="208" width="34" height="14" rx="6"/><rect x="246" y="206" width="34" height="14" rx="6"/></g><g fill="#2fa36b"><rect x="170" y="190" width="26" height="9" rx="4"/><rect x="204" y="226" width="26" height="9" rx="4"/></g><circle cx="140" cy="226" r="6" fill="#ffd36b"/>' +
        '<path d="M290 140l60 118M312 132l60 118" stroke="#3a2418" stroke-width="7" stroke-linecap="round"/>';
    },
    eat_kalguksu: function (u) { /* 칼국수: 김 나는 국수 그릇 */
      var nd = '', i;
      for (i = 0; i < 9; i++) nd += '<path d="M' + (96 + i * 6) + ' 226q' + (30 + i * 9) + ' -26 ' + (120 - i * 4) + ' 0" fill="none" stroke="#f6e3a3" stroke-width="7" stroke-linecap="round"/>';
      return '<defs>' + table(u, '#e6f3f1', '#9fd2cc') + '</defs>' + tableBg(u, 262) +
        steam(150, 150, 3) + '<ellipse cx="200" cy="338" rx="130" ry="20" fill="#2a1a10" opacity=".25"/>' +
        '<path d="M70 214h260q-6 100-130 104Q76 314 70 214z" fill="#17a398"/><path d="M70 214h260q-2 22-14 38H84q-12-16-14-38z" fill="#0f7f77"/>' +
        '<ellipse cx="200" cy="214" rx="130" ry="26" fill="#f3e0a8"/>' + nd +
        '<circle cx="170" cy="210" r="9" fill="#2fa36b"/><circle cx="238" cy="216" r="8" fill="#ff8a5c"/><circle cx="206" cy="204" r="7" fill="#fff"/>' +
        '<path d="M300 150l40 100" stroke="#e9ecee" stroke-width="9" stroke-linecap="round"/><ellipse cx="296" cy="142" rx="18" ry="10" fill="#e9ecee" transform="rotate(-20 296 142)"/>';
    },
    eat_gomchi: function (u) { /* 곰치국: 뚝배기 */
      return '<defs>' + table(u, '#fff0d8', '#f0a878') + '</defs>' + tableBg(u, 270) +
        steam(150, 140, 4) + '<ellipse cx="200" cy="344" rx="120" ry="18" fill="#2a1a10" opacity=".3"/>' +
        '<path d="M92 206h216l-14 104q-6 30-48 30h-92q-42 0-48-30z" fill="#3a2a24"/><path d="M92 206h216" stroke="#5a443a" stroke-width="10" stroke-linecap="round"/>' +
        '<ellipse cx="200" cy="206" rx="108" ry="22" fill="#d9482e"/><ellipse cx="200" cy="204" rx="92" ry="15" fill="#f2724a"/>' +
        '<g fill="#fff3e2"><rect x="150" y="194" width="34" height="14" rx="7"/><rect x="214" y="198" width="30" height="12" rx="6"/></g><g fill="#2fa36b"><rect x="190" y="192" width="22" height="8" rx="4"/></g>' +
        '<path d="M60 224q-30 0-30 24M340 224q30 0 30 24" stroke="#3a2a24" stroke-width="9" fill="none" stroke-linecap="round"/>';
    },
    eat_cafe: function (u) { /* 카페: 찻잔과 샌드위치 */
      return '<defs>' + table(u, '#fdf2e4', '#e9c9a4') + '</defs>' + tableBg(u, 258) +
        steam(104, 160, 2) + '<ellipse cx="200" cy="336" rx="160" ry="20" fill="#2a1a10" opacity=".25"/>' +
        '<ellipse cx="116" cy="300" rx="88" ry="20" fill="#fff"/><path d="M62 220h108q-2 62-54 66-52-4-54-66z" fill="#fff"/><ellipse cx="116" cy="220" rx="54" ry="10" fill="#7a4a2e"/><path d="M170 232q34-2 30 22t-34 20" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"/>' +
        '<path d="M214 262l62-76 62 76z" fill="#f3d58f"/><path d="M214 262h124v14H214z" fill="#e7bb5c"/><path d="M226 258l50-60 50 60z" fill="#7fc47a"/><path d="M222 262h108l-8 8H230z" fill="#e5484d"/>';
    },
    eat_yasijang: function (u) { /* 야시장 꼬치: 불빛과 꼬치 */
      var b = '', xs = [30, 90, 150, 210, 270, 330, 380], i;
      for (i = 0; i < xs.length; i++) b += '<circle cx="' + xs[i] + '" cy="' + (50 + Math.sin(xs[i] / 52) * 14) + '" r="20" fill="url(#' + u + 'c)"/><circle cx="' + xs[i] + '" cy="' + (50 + Math.sin(xs[i] / 52) * 14) + '" r="6" fill="' + (i % 2 ? '#ffd36b' : '#ffb27a') + '"/>';
      var sk = '';
      [[104, '#f0a830', '#e5484d'], [200, '#ffd9a0', '#c97b52'], [296, '#f0a830', '#2fa36b']].forEach(function (c, k) {
        sk += '<g transform="rotate(' + (k - 1) * 8 + ' ' + c[0] + ' 250)"><path d="M' + c[0] + ' 100V380" stroke="#d9b98a" stroke-width="7" stroke-linecap="round"/>' +
          '<rect x="' + (c[0] - 22) + '" y="150" width="44" height="40" rx="12" fill="' + c[1] + '"/><rect x="' + (c[0] - 22) + '" y="198" width="44" height="40" rx="12" fill="' + c[2] + '"/><rect x="' + (c[0] - 22) + '" y="246" width="44" height="40" rx="12" fill="' + c[1] + '"/></g>';
      });
      return '<defs>' + lg(u + 'a', ['#091f2c', '#14566b']) + rg(u + 'c', [['#ffd36b', 0.6], ['#ffd36b', 0]], .5, .5, .5) + '</defs><rect width="400" height="400" fill="url(#' + u + 'a)"/>' + b + '<path d="M-10 70Q100 110 200 84T410 66" fill="none" stroke="#243947" stroke-width="3"/>' + sk + '<rect y="354" width="400" height="46" fill="#0a1a24"/>';
    },
    eat_baekban: function (u) { /* 백반: 밥·국·반찬 */
      return '<defs>' + table(u, '#fff4de', '#f3c995') + '</defs>' + tableBg(u, 240) +
        '<ellipse cx="200" cy="350" rx="170" ry="20" fill="#2a1a10" opacity=".22"/>' +
        '<path d="M56 226h110q-4 70-55 74-51-4-55-74z" fill="#17a398"/><ellipse cx="111" cy="226" rx="55" ry="14" fill="#fff"/><path d="M70 224q41-34 82 0z" fill="#fffaf0"/>' +
        '<path d="M234 226h110q-4 70-55 74-51-4-55-74z" fill="#3a2a24"/><ellipse cx="289" cy="226" rx="55" ry="14" fill="#a8662f"/><circle cx="270" cy="224" r="7" fill="#f4e3b0"/><circle cx="304" cy="228" r="6" fill="#2fa36b"/>' +
        '<g><ellipse cx="96" cy="316" rx="34" ry="12" fill="#fff"/><ellipse cx="96" cy="313" rx="22" ry="7" fill="#e5484d"/><ellipse cx="184" cy="322" rx="34" ry="12" fill="#fff"/><ellipse cx="184" cy="319" rx="22" ry="7" fill="#2fa36b"/><ellipse cx="272" cy="322" rx="34" ry="12" fill="#fff"/><ellipse cx="272" cy="319" rx="22" ry="7" fill="#f0a830"/><ellipse cx="344" cy="312" rx="30" ry="11" fill="#fff"/><ellipse cx="344" cy="309" rx="18" ry="6" fill="#8a5a2e"/></g>' +
        '<path d="M170 150l100 70M182 140l100 70" stroke="#3a2418" stroke-width="7" stroke-linecap="round"/>';
    }
  };
  /* 실제 가게(한국관광공사 자료)에 맞춰 그릇 그림을 짝지음: 물회·회 = 물회 그릇, 칼국수 = 국수 그릇, 미역국 정식 = 뚝배기 */
  MEALS.eat_obuja = MEALS.eat_mulhoe; MEALS.eat_buheung = MEALS.eat_mulhoe; MEALS.eat_ottugi = MEALS.eat_kalguksu; MEALS.eat_yeongbin = MEALS.eat_gomchi;
  MEALS.fallbackMeal = MEALS.eat_kalguksu;
  SCENES.fallback = function (u) {
    return '<defs>' + lg(u + 'a', ['#ffd9a8', '#ff9a7a', '#2f89a3']) + '</defs><rect width="400" height="400" fill="url(#' + u + 'a)"/>' + waves(260, 5, '#fff', .3);
  };

  function svg(id) {
    var u = 'ta' + (++N) + '_', fn = SCENES[id] || MEALS[id] || (String(id).indexOf('eat_') === 0 ? MEALS.fallbackMeal : SCENES.fallback);
    return '<svg class="art" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' + fn(u) + '</svg>';
  }
  root.TourArt = { svg: svg, has: function (id) { return !!SCENES[id] || !!MEALS[id]; } };
})(window);
