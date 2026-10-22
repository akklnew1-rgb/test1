/*
 * 시연 모드 인공지능 층 — 키 없이 규칙·양식으로 흉내 낸다.
 * 이 파일의 aiParseRequest / aiParseTicket / aiClassifyReport / aiReadMenu / aiStory / aiAnswer / aiMyLine 만 본선에서 바꾼다.
 * 나머지(코스 계산·화면·제보 반영)는 그대로 쓴다.
 *
 * >>> 본선 교체 지점: 각 함수 안에서 Claude API 를 부르는 서버리스 함수(키는 서버에만)로 바꾼다.
 *     - aiParseRequest/aiParseTicket : 글·기차표 사진 → 조건(JSON)
 *     - aiClassifyReport             : 제보 글·사진 → 종류·장소·분(JSON), 얼굴·차번호 가림
 *     - aiReadMenu                   : 메뉴판 사진 → 메뉴·값 목록 (Claude 비전, 아래 함수 안 주석)
 *     - aiStory/aiAnswer             : 공식 자료만 근거로 동행 맞춤 이야기·답변 (없으면 "기록에 없어요")
 */
(function (root) {
  'use strict';

  var SIM_LABEL = '시연 모드 — 본선에서는 인공지능이 직접 판단';
  var NOT_FOUND = '그건 기록에 없어요 — 관광안내소에 물어보세요';

  function has(t, re) { return re.test(t); }

  /* 여행 날짜 읽기(기본만): "오늘 · 내일 · 모레 · 글피", "10월 23일", "13일"(이번 달, 이미 지났으면 다음 달). todayIso('YYYY-MM-DD') 가 없으면 읽지 않는다.
     "1박 2일" 의 2일, "3일간" 같은 기간 말은 날짜로 읽지 않는다. */
  function aiParseDate(text, todayIso) {
    var t = String(text || ''), b = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(todayIso || ''));
    if (!b) return null;
    var y = +b[1], mo = +b[2], d = +b[3];
    function iso(yy, mm, dd) { var x = new Date(Date.UTC(yy, mm - 1, dd)); return x.getUTCFullYear() + '-' + ('0' + (x.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + x.getUTCDate()).slice(-2); }
    function ok(yy, mm, dd) { var x = new Date(Date.UTC(yy, mm - 1, dd)); return x.getUTCMonth() === mm - 1 && x.getUTCDate() === dd; }
    if (/모레/.test(t)) return iso(y, mo, d + 2);
    if (/글피/.test(t)) return iso(y, mo, d + 3);
    if (/내일/.test(t)) return iso(y, mo, d + 1);
    if (/오늘/.test(t)) return iso(y, mo, d);
    var md = t.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
    if (md) {
      var m2 = +md[1], d2 = +md[2];
      if (m2 < 1 || m2 > 12 || !ok(y, m2, d2)) return null;
      var yy = (m2 < mo || (m2 === mo && d2 < d)) ? y + 1 : y;
      return ok(yy, m2, d2) ? iso(yy, m2, d2) : null;
    }
    var dd = t.match(/(?<!박\s*)(?<!\d)(\d{1,2})\s*일(?!\s*간|\s*동안|\s*째|\s*치)/);
    if (dd) {
      var d3 = +dd[1];
      if (d3 < 1 || d3 > 31) return null;
      var m3 = mo, y3 = y;
      if (d3 < d) { m3 = mo + 1; if (m3 > 12) { m3 = 1; y3 = y + 1; } }
      return ok(y3, m3, d3) ? iso(y3, m3, d3) : null;
    }
    return null;
  }

  /* 글·말 → 조건 (todayIso: 오늘 날짜 'YYYY-MM-DD' — 있어야 여행 날짜를 읽는다) */
  function aiParseRequest(text, nowMin, todayIso) {
    var t = String(text || '');
    var r = { train: null, end: 'mukho', companions: [], knee: false, interests: [], rain: false, food: false, foodWord: '', count: null, date: null, how: null, found: [] };
    r.date = aiParseDate(t, todayIso);
    var h = null, m = 0, mk = null;
    var a = t.match(/(\d{1,2})\s*:\s*(\d{2})/);
    var b = t.match(/(오전|오후|저녁|아침|밤)?\s*(\d{1,2})\s*시(?!간)\s*(?:(\d{1,2})\s*분|(반))?/);
    if (a) { h = +a[1]; m = +a[2]; }
    else if (b) { mk = b[1] || null; h = +b[2]; m = b[3] ? +b[3] : (b[4] ? 30 : 0); }
    if (h !== null && h <= 24 && m < 60) {
      if (mk === '오후' || mk === '저녁' || mk === '밤') { if (h < 12) h += 12; }
      else if (mk === '오전' || mk === '아침') { /* 그대로 */ }
      else if (!a && h < 12 && h * 60 + m < (nowMin == null ? 780 : nowMin)) h += 12; // "6시 10분" → 지금보다 뒤인 18:10
      r.train = h * 60 + m;
    }
    if (has(t, /부모|엄마|아빠|어머니|아버지|어르신|할머니|할아버지/)) r.companions.push('부모님');
    if (has(t, /아이|아기|애들|아들|딸|초등/)) r.companions.push('아이');
    if (has(t, /연인|애인|남자친구|여자친구|남친|여친|커플|데이트|신혼/)) r.companions.push('연인');
    if (has(t, /친구/) && !has(t, /남자친구|여자친구/)) r.companions.push('친구');
    if ((has(t, /자가용|자동차|운전|렌터카|내 차/) || /(^|[^기열])차로/.test(t))) r.how = 'car'; else if (has(t, /버스/)) r.how = 'bus'; else if (has(t, /기차|열차|KTX|ktx/)) r.how = 'train';
    if (has(t, /혼자/)) r.companions.push('혼자');
    if (has(t, /무릎|계단|힘들|다리|관절|허리/)) r.knee = true;
    if (has(t, /사진|인생샷|노을|일몰|풍경|뷰/)) r.interests.push('사진');
    if (has(t, /먹|맛집|회|시장|음식|간식/)) r.interests.push('먹거리');
    if (has(t, /먹|맛집|물회|밥|식사|배고|점심|저녁/)) r.food = true; // 밥을 먹고 싶다 → 코스에 점심·저녁 '시간'만 잡는다(특정 식당은 정하지 않음)
    var fw = t.match(/물회|칼국수|국수|회덮밥|모듬회|모둠회|미역국|죽/); if (fw) { r.food = true; r.foodWord = fw[0].replace('모둠', '모듬'); } // 먹고 싶은 음식 낱말 → 메뉴에 그 낱말이 있는 집을 먼저
    if (has(t, /비가|비\s*(오|와|온)|우산|장마/)) r.rain = true;
    if (has(t, /동해역/)) r.end = 'donghae';
    var c = t.match(/(\d)\s*명/);
    if (c) r.count = +c[1]; else if (has(t, /둘이|두 명/)) r.count = 2; else if (has(t, /셋이/)) r.count = 3; else if (has(t, /혼자/)) r.count = 1;
    return r;
  }

  /* 기차표 사진 → 조건 (시연: 사진을 읽은 것처럼 고정값을 돌려준다) */
  function aiParseTicket(file) {
    return { train: 18 * 60 + 10, end: 'mukho', companions: [], knee: false, interests: [], rain: false, food: false, count: 2,
      found: ['돌아갈 기차 18:10', '묵호역', '2명'], demo: true, fileName: file && file.name ? file.name : '' };
  }

  /* 앞에 있는 것이 먼저 맞는다 — 말이 겹치는 곳(묵호항전망대 ⊃ 전망대·묵호항, 추암해변 ⊃ 추암 …)은 더 구체적인 것을 위에 둔다 */
  var PLACE_WORDS = [
    ['nightmarket', /야시장/], ['bukpyeong', /북평|오일장|장날/],
    ['jeonmangdae', /묵호항\s*전망대|활어회센터|전망대활어/], ['suibyeon', /수변공원/],
    ['skyvalley', /스카이|도째비|도깨비/], ['lighthouse', /등대|전망대|해랑/], ['nolgol', /논골|벽화/],
    ['byeoryu', /별유천지/], ['yongchu', /용추|무릉계곡|폭포/], ['samhwasa', /삼화사/], ['gamchusa', /감추사/], ['hanseom', /한섬/],
    ['cheongokpark', /자연학습|체험공원|돌리네/], ['cheongok', /천곡|동굴|박쥐/],
    ['chuamsculpt', /조각공원/], ['chuambeach', /추암\s*(해변|해수욕장)/], ['chuam', /추암|촛대/],
    ['mangsang', /망상/], ['daejin', /대진/], ['nobong', /노봉/], ['eodal', /어달/],
    ['mukhoport', /시장|묵호항|항구|횟집/],
  ];

  /* 특정 가게 낱말 — 가게 제보(줄·휴무)는 받지 않으므로, 이 낱말이 나오면 "가게는 코스에 없어요" 라고 안내하려고 알아본다("야시장 먹거리" 처럼 장소 낱말보다 먼저 본다) */
  var EAT_WORDS = [
    ['eat_obuja', /오부자|냄비물회|물회/], ['eat_buheung', /부흥|모듬회|모둠회/], ['eat_ottugi', /오뚜기|칼국수|수제비|국수/], ['eat_yeongbin', /영빈관|미역국/],
  ];

  /* 제보 분류 — 글의 낱말을 우선하고, 글이 없으면 고른 종류를 그대로 쓴다.
     특정 가게 제보("오부자 줄 30분" 등)는 코스에 식당이 없어 반영하지 않는다 → shop:true 만 돌려주고 placeId 는 비운다. */
  function aiClassifyReport(text, pickedType, pickedPlace) {
    var t = String(text || '');
    var type = null, why = '', conf = 0;
    if (has(t, /줄|붐비|북적|사람\s*많|대기|웨이팅|기다/)) { type = 'crowd'; why = '"줄·붐빔·대기" 같은 말이 있어요'; conf = 0.9; }
    else if (has(t, /휴무|쉬는|쉬어|문\s*닫|닫았|닫혀|영업\s*안/)) { type = 'closed'; why = '"휴무·문 닫음" 같은 말이 있어요'; conf = 0.9; }
    else if (has(t, /오늘\s*(의\s*)?메뉴|메뉴/)) { type = 'menu'; why = '"오늘 메뉴" 같은 말이 있어요'; conf = 0.8; }
    else if (has(t, /새로|생겼|새 벽화|처음 보|신상/)) { type = 'new'; why = '"새로 생김" 같은 말이 있어요'; conf = 0.8; }
    else if (has(t, /노을|풍경|예쁘|뷰|멋|좋아요|최고|아름/)) { type = 'view'; why = '"노을·풍경·최고" 같은 말이 있어요'; conf = 0.8; }
    if (!type && pickedType) { type = pickedType; why = '고르신 종류를 그대로 썼어요'; conf = 0.6; }
    var placeId = null;
    var shop = !!(t && EAT_WORDS.some(function (pw) { return pw[1].test(t); }));
    if (!placeId && t) PLACE_WORDS.some(function (pw) { if (pw[1].test(t)) { placeId = pw[0]; return true; } return false; });
    if (shop) placeId = null; // 가게 이름이 들어 있으면 가게 제보(반영 안 함)
    if (pickedPlace && String(pickedPlace).indexOf('eat_') !== 0) placeId = pickedPlace; // 직접 고른 장소가 우선(가게는 제외)
    var mm = t.match(/(\d{1,3})\s*분/);
    var minutes = type === 'crowd' ? (mm ? Math.min(120, +mm[1]) : 20) : null;
    return { type: type, placeId: placeId, shop: shop && !placeId, food: false, minutes: minutes, why: why, confidence: conf, maskNote: '사진 속 얼굴·차량번호 가리기는 본선에서 인공지능이 해요' };
  }

  /* 메뉴판 사진 → 메뉴·값 목록 (시연: 사진과 상관없이 그 가게의 예시 메뉴를 깔끔한 목록으로 돌려준다)
     >>> 본선 교체 지점: 사진(file)을 서버리스 함수로 보내 Claude 비전(이미지 입력)으로 메뉴 이름·값을 읽는다.
         읽은 글자만 돌려주고, 사진에 찍힌 사람 얼굴·차량번호는 가린다. 읽지 못한 칸은 지어내지 않고 "읽지 못했어요" 로 둔다. */
  function won(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '원'; }
  function aiReadMenu(eatery, cond, file) {
    var comp = (cond && cond.companions) || [];
    var parents = comp.indexOf('부모님') >= 0;
    var items = ((eatery && eatery.menu) || []).map(function (m) {
      var hasP = m.price > 0; // 값은 자료에 있을 때만 적는다
      return { name: m.name, price: hasP ? m.price : null, priceText: hasP ? '약 ' + won(m.price) : '', soft: !!m.soft, tag: (parents && m.soft) ? '부모님께 좋아요' : '' };
    });
    return { demo: true, title: (eatery ? eatery.name : '') + ' 메뉴판', items: items, parents: parents,
      note: '시연: 사진 내용과 상관없이 한국관광공사 자료의 메뉴 이름을 보여 드려요. 값은 자료에 없어 적지 않았어요.',
      fileName: file && file.name ? file.name : '' };
  }

  /* 이야기 — 같은 사실을 일행에 맞춰 앞뒤 말만 다르게 (사실을 새로 만들지 않는다) */
  function aiStory(place, cond) {
    var comp = (cond && cond.companions) || [];
    var lead = '';
    if (comp.indexOf('아이') >= 0) lead = '도째비가 소곤소곤 들려줄게요. ';
    else if (comp.indexOf('부모님') >= 0) lead = '천천히 들어 보세요. ';
    var text = place.story;
    return { text: text, speak: lead + text, source: place.출처, confirm: !!place.확인필요 };
  }

  function norm(s) { return String(s || '').replace(/\s+/g, ''); }
  /* 도째비에게 묻기 — 준비된 질문·낱말이 맞으면 답, 아니면 기록에 없다고 말한다 */
  function aiAnswer(place, question) {
    var q = norm(question);
    if (!q) return { found: false, text: NOT_FOUND };
    var best = null, bestN = 0;
    (place.qa || []).forEach(function (x) {
      var n = 0;
      if (norm(x.q) === q) n = 99;
      (x.keys || []).forEach(function (k) { if (q.indexOf(norm(k)) >= 0) n++; });
      if (n > bestN) { bestN = n; best = x; }
    });
    if (best) return { found: true, text: best.a };
    return { found: false, text: NOT_FOUND };
  }

  /* 나의 동해 이야기 — 도째비 한마디 */
  function aiMyLine(info) {
    var n = info.count || 0;
    if (info.night) return '하룻밤 묵고 추암 일출까지 보는 길이었네요. 도째비도 따라가서 든든했어요.';
    if (info.reports > 0) return '오늘 남겨 주신 제보가 근처 여행자에게 알림으로 가요. 다시 짤지는 그분이 골라요. 길동무가 되어 주셔서 고마워요.';
    if (n >= 5) return '기차 시간 안에 ' + n + '곳을 이야기와 함께 걸으셨어요. 도째비가 뿌듯해요.';
    return '오늘 ' + n + '곳을 함께 걸어서 즐거웠어요. 다음에 또 놀러 와요.';
  }

  /*
   * 말로 코스 고치기 (시연 모드: 규칙으로 흉내) — "무릉계곡 빼줘" · "점심 빼줘" · "점심 넣어줘" · "바다 하나 더" · "실내로" · "더 천천히" · "등대 먼저" · "시간 늘려줘"
   * 글 → 고치는 일 목록(intents). 어떻게 바꿀지(자리·시간 계산)는 editor.js applyIntents 가 하고, 바꾸기 전에 화면이 "빠짐 / 들어감" 을 보여 주며 확인을 받는다.
   * ctx = { places: [{ id, name, short }…] (장소 + 가게) }
   *
   * >>> 본선 교체 지점: 이 함수를 Claude API 의 도구 쓰기(tool use)로 바꾼다. 서버리스 함수에서 코스(JSON) + 사용자의 말을 보내고,
   *     Claude 가 아래 도구를 불러 같은 모양의 intents 를 돌려주게 한다 (장소 이름 맞추기·한 문장에 여러 부탁·모호한 말 되묻기를 모델이 해결).
   *       remove_places({ids}) · remove_meal({when}) · add_places({ids}) · add_meal({when}) · add_theme({theme:'sea'}) · prefer_indoor()
   *       set_pace({mode:'slower'|'longer'|'shorter', ids?}) · move_place({id, to:'first'|'last'})
   *     계산(editor.js)은 그대로 쓰므로 시간·마감·휴무는 모델이 아니라 계산기가 지킨다.
   */
  var EDIT_HELP = '이렇게 말해 보세요: "무릉계곡 빼줘" · "점심 빼줘" · "점심 넣어줘" · "바다 하나 더" · "실내로" · "더 천천히" · "등대 먼저" · "시간 늘려줘"';
  function aiEditIntent(text, ctx) {
    var raw = String(text || '').trim(), list = (ctx && ctx.places) || [];
    if (!raw) return { intents: [], help: EDIT_HELP };
    // 한 문장에 부탁이 여러 개면 나눈다: "빼고 / 넣고 / 쉼표 / 그리고"
    var segs = raw.split(/(?<=빼고|빼주고|빼 주고|넣고|넣어주고|넣어 주고|추가하고|제외하고)\s+|[,，.]\s*|\s그리고\s|\s다음에\s/).map(function (x) { return x.trim(); }).filter(Boolean);
    var intents = [];
    segs.forEach(function (seg) {
      var ids = findPlaces(seg, list);
      var meal = /점심|저녁|식사|밥|한\s*끼|아침|끼니|물회|칼국수|회덮밥|모듬회|모둠회|미역국/.test(seg), when = /점심/.test(seg) ? 'lunch' : /저녁/.test(seg) ? 'dinner' : /아침/.test(seg) ? 'breakfast' : null;
      var rem = /빼|제외|없애|지워|말고|취소|안\s*갈|안\s*가|그만/.test(seg), add = /넣|추가|가고\s*싶|가자|들러|포함|먹고\s*싶|먹을래|먹자/.test(seg);
      if (meal && ids.length === 0 && rem) intents.push({ type: 'removeMeal', when: when === 'breakfast' ? null : when, text: seg });
      else if (meal && ids.length === 0 && (add || /하나\s*더/.test(seg))) intents.push({ type: 'addMeal', when: when, text: seg });
      else if (/(바다|해변|해수욕장|바닷가)/.test(seg) && /(하나\s*더|더|도\s*하나|추가|넣)/.test(seg) && !ids.length) intents.push({ type: 'addTheme', theme: 'sea', text: seg });
      else if (/실내/.test(seg)) intents.push({ type: 'indoor', text: seg });
      else if (/천천히|여유|느긋|느리게|넉넉/.test(seg) && !/시간.*늘/.test(seg)) intents.push({ type: 'slower', text: seg });
      else if (/시간.*(늘|길게)|오래\s*(머물|보|있)|더\s*머물|더\s*오래/.test(seg)) intents.push({ type: 'longer', ids: ids, text: seg });
      else if (/시간.*(줄|짧)|짧게|빨리|서둘/.test(seg)) intents.push({ type: 'shorter', ids: ids, text: seg });
      else if (ids.length && /먼저|처음|첫\s*번째|맨\s*앞|제일\s*앞/.test(seg)) intents.push({ type: 'first', ids: ids, text: seg });
      else if (ids.length && /마지막|나중|맨\s*뒤|끝에|맨\s*끝/.test(seg)) intents.push({ type: 'last', ids: ids, text: seg });
      else if (ids.length && rem) intents.push({ type: 'remove', ids: ids, text: seg });
      else if (ids.length && (add || !rem)) intents.push({ type: 'add', ids: ids, text: seg });
      else intents.push({ type: 'unknown', why: '"' + seg + '" 는 무슨 뜻인지 잘 모르겠어요', text: seg });
    });
    return { intents: intents, help: EDIT_HELP, sim: SIM_LABEL };
  }
  /* 글 안의 장소·가게를 모두 찾는다(이름 전체 → 줄임 이름 → 낱말 규칙 순서, 찾은 글자는 지워서 같은 글자로 두 번 안 찾음) */
  function findPlaces(seg, list) {
    var rest = ' ' + seg.replace(/\s+/g, '') + ' ', out = [];
    function take(id, re) { var m = re.exec(rest); if (!m) return false; rest = rest.slice(0, m.index) + ' ' + rest.slice(m.index + m[0].length); if (out.indexOf(id) < 0) out.push(id); return true; }
    var names = []; list.forEach(function (p) { names.push([p.id, p.name.replace(/\s+/g, '')]); if (p.short && p.short !== p.name) names.push([p.id, p.short.replace(/\s+/g, '')]); });
    names.sort(function (a, b) { return b[1].length - a[1].length; });
    names.forEach(function (n) { if (n[1].length >= 2) { var g = new RegExp(n[1].replace(/[.*+?^${}()|[\]\\·]/g, '\\$&')); while (take(n[0], g)) { /* 여러 번 나와도 한 번만 */ } } });
    EAT_WORDS.concat(PLACE_WORDS).forEach(function (pw) { if (list.some(function (p) { return p.id === pw[0]; })) take(pw[0], new RegExp(pw[1].source)); });
    return out;
  }

  var api = { SIM_LABEL: SIM_LABEL, NOT_FOUND: NOT_FOUND, aiEditIntent: aiEditIntent, EDIT_HELP: EDIT_HELP, aiParseRequest: aiParseRequest, aiParseDate: aiParseDate, aiParseTicket: aiParseTicket, aiClassifyReport: aiClassifyReport, aiReadMenu: aiReadMenu, aiStory: aiStory, aiAnswer: aiAnswer, aiMyLine: aiMyLine };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TourAI = api;
})(typeof window !== 'undefined' ? window : globalThis);
