/* 도째비 길동무 — 인공지능 중계 함수 (Vercel). 열쇠는 환경변수 GEMINI_API_KEY 에만 둔다(앱 코드에 넣지 않음).
 * 하는 일은 두 가지뿐이다. 장소·시각 계산은 앱의 계산기가 그대로 하고, 여기서는 "말 → 정해진 명령" 번역과 "코스 이유 설명"만 한다.
 *   POST { task:'edit',    text:'다리가 아파서 덜 걷고 싶어', places:[{id,name}] }  → { ok, intents:[{type,ids?,when?,theme?}], reply }
 *   POST { task:'explain', facts:{...} }                                           → { ok, text }
 * 모델이 지어낸 장소 id 는 places 목록과 대조해서 버린다. 실패하면 { ok:false } — 앱이 알아서 규칙 방식으로 돌아간다. */
var USED = '', MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
var ALLOW = (process.env.ALLOW_ORIGINS || 'https://akklnew1-rgb.github.io,https://dojjaebi-gildongmu.vercel.app,https://test1-tour-design.vercel.app,http://localhost:8765').split(',');
var TYPES = ['remove', 'add', 'removeMeal', 'addMeal', 'addTheme', 'indoor', 'slower', 'longer', 'shorter', 'first', 'last', 'unknown'];
var hits = {}; // 아주 단순한 속도 제한(주소별 분당 20번) — 시연 중 남용 방지
function limited(ip) { var m = Math.floor(Date.now() / 60000), h = hits[ip] || (hits[ip] = { m: m, n: 0 }); if (h.m !== m) { h.m = m; h.n = 0; } return ++h.n > 20; }

async function gemini(system, user, schema, maxTok, perMs) {
  // 환경변수에 열쇠만이 아니라 AI Studio 의 curl 예시 줄 전체를 붙여 넣었어도 열쇠 부분만 뽑아 쓴다
  var raw = String(process.env.GEMINI_API_KEY || '').trim(), mm = raw.match(/x-goog-api-key:\s*([^\s'"\\]+)/i) || raw.match(/[?&]key=([^&\s'"\\]+)/i);
  var key = mm ? mm[1] : (/\s/.test(raw) ? '' : raw); if (!key) throw new Error('no key');
  var body = { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: { temperature: 0.2, maxOutputTokens: maxTok || 700 } };
  if (schema) { body.generationConfig.responseMimeType = 'application/json'; body.generationConfig.responseSchema = schema; }
  var models = [MODEL, 'gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-2.5-flash'].filter(function (m, i, a) { return m && a.indexOf(m) === i; }), last = 'gemini';
  for (var i = 0; i < models.length; i++) {
    var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, perMs || 4500);
    try {
      var r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + models[i] + ':generateContent', { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body), signal: ctl.signal });
      if (!r.ok) { last = 'gemini ' + r.status + ' ' + models[i]; continue; }
      var j = await r.json(), p = j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts;
      USED = models[i];
      return (p || []).map(function (x) { return x.text || ''; }).join('');
    } catch (e) { last = String(e && e.name === 'AbortError' ? 'timeout ' + models[i] : e); } finally { clearTimeout(t); }
  }
  throw new Error(last);
}

var EDIT_SYS = '너는 동해시 여행 코스 앱의 "말 → 명령" 번역기다. 사용자가 코스를 어떻게 고치고 싶은지 한국어로 말하면, 아래 명령 목록으로만 바꿔 intents 배열로 돌려준다. 장소를 새로 지어내지 말고 반드시 주어진 places 목록의 id 만 쓴다.\n' +
  '명령: remove(ids 를 코스에서 뺌) · add(ids 를 코스에 넣음) · removeMeal(when: lunch|dinner, 끼니 시간을 뺌) · addMeal(when: lunch|dinner) · addTheme(theme: "sea", 바다 쪽 한 곳 더) · indoor(실내 위주로) · slower(전체를 더 천천히) · longer/shorter(ids 가 있으면 그 곳만, 없으면 전체 머무는 시간 늘림/줄임) · first/last(ids 를 맨 앞/맨 뒤로) · unknown(why 에 되물을 말).\n' +
  '규칙: 한 문장에 부탁이 여러 개면 여러 명령으로 나눈다. "다리 아파/덜 걷고 싶어/힘들어" → slower 와 indoor 중 알맞은 것. "아이가 지루해해" → 아이가 좋아할 체험·바다 쪽 add 또는 shorter. 장소 이름이 모호하면 unknown. 시각·마감·휴무 계산은 앱이 하니 신경 쓰지 않는다. reply 에는 한 줄(30자 안팎)로 "이렇게 이해했어요: …" 를 쉬운 말로 쓴다. 영어·어려운 한자어 금지.';
var EDIT_SCHEMA = { type: 'OBJECT', properties: { intents: { type: 'ARRAY', items: { type: 'OBJECT', properties: { type: { type: 'STRING', enum: TYPES }, ids: { type: 'ARRAY', items: { type: 'STRING' } }, when: { type: 'STRING', enum: ['lunch', 'dinner'] }, theme: { type: 'STRING' }, why: { type: 'STRING' } }, required: ['type'] } }, reply: { type: 'STRING' } }, required: ['intents', 'reply'] };

function cleanEdit(raw, places) {
  var j; try { j = JSON.parse(raw); } catch (e) { return null; }
  var ok = {}; places.forEach(function (p) { ok[p.id] = 1; });
  var out = [];
  (j.intents || []).forEach(function (it) {
    if (!it || TYPES.indexOf(it.type) < 0) return;
    var o = { type: it.type };
    if (it.ids) o.ids = it.ids.filter(function (id) { return ok[id]; });
    if ((it.type === 'remove' || it.type === 'add' || it.type === 'first' || it.type === 'last') && !(o.ids && o.ids.length)) { o = { type: 'unknown', why: '어느 곳인지 잘 모르겠어요' }; }
    if (it.when === 'lunch' || it.when === 'dinner') o.when = it.when;
    if (it.type === 'addTheme') o.theme = 'sea';
    if (it.type === 'unknown') o.why = String(it.why || '무슨 뜻인지 잘 모르겠어요').slice(0, 80);
    out.push(o);
  });
  return out.length ? { intents: out.slice(0, 5), reply: String(j.reply || '').slice(0, 120) } : null;
}

var EXPLAIN_SYS = '너는 동해시 여행 코스 앱의 안내자 "도째비"다. 아래 사실(facts)만 써서, 이 코스를 왜 이렇게 짰는지 3~4문장으로 쉽게 설명한다. 사실에 없는 장소·시간·날씨·가격은 절대 말하지 않는다. 존댓말, 영어·어려운 한자어 금지, 문장은 짧게. 마지막에 "고치고 싶으면 코스 고치기를 눌러 보세요" 로 끝낸다.';

var PARSE_SYS = '너는 동해시 여행 앱의 "여행 이야기 → 조건" 번역기다. 사용자가 쓴 한국어 문장에서 아래 항목만 뽑는다. 말에 없는 항목은 비워 두고 절대 짐작해서 채우지 않는다. 오늘 날짜는 사용자 메시지의 today 로 계산한다("내일", "이번 토요일" 등을 YYYY-MM-DD 로). back 은 "돌아갈 시각"(기차·버스 출발 또는 떠날 시각) 24시간 HH:MM — "6시 10분 기차" 처럼 저녁 여행이 자연스러우면 18:10. 시각 말이 없으면 빈 문자열. how 는 가는 교통: car(자가용)·bus·train 중 하나, 말이 없으면 빈 문자열. companions 는 부모님·아이·연인·친구·혼자 중에서만. interests 는 사진·먹거리 중에서만. knee 는 무릎·계단·다리·허리 등 걷기 힘들다는 말이 있을 때 true. rain 은 비 이야기가 있을 때 true. food 는 밥·식사·맛집 말이 있을 때 true, foodWord 는 물회·칼국수·국수·회덮밥·모듬회·미역국·죽 중 말한 음식 하나(없으면 빈 문자열). count 는 사람 수(말이 없으면 0). end 는 동해역에서 끝나면 donghae, 아니면 mukho. reply 에는 한 줄로 "이렇게 알아들었어요: …" 를 쉬운 말로 쓴다.';
var PARSE_SCHEMA = { type: 'OBJECT', properties: { date: { type: 'STRING' }, arrive: { type: 'STRING' }, back: { type: 'STRING' }, how: { type: 'STRING' }, end: { type: 'STRING' }, companions: { type: 'ARRAY', items: { type: 'STRING' } }, interests: { type: 'ARRAY', items: { type: 'STRING' } }, knee: { type: 'BOOLEAN' }, rain: { type: 'BOOLEAN' }, food: { type: 'BOOLEAN' }, foodWord: { type: 'STRING' }, count: { type: 'INTEGER' }, reply: { type: 'STRING' } } };

var CHAT_SYS = '너는 동해시 여행 앱 "도째비 길동무"의 대화 도우미 도째비다. 한국어 쉬운 존댓말로 위트 있고 짧게(2~3문장) 말한다. 너는 도깨비라 맛을 잘 못 느끼고 잠을 안 자서 사람 입맛과 잠자리 취향을 모른다는 설정이다. 이 농담은 식당 이야기를 할 때(예: "제가 도깨비라 쇠도 씹어 먹다 보니 사람 입맛은 영 모른답니다")와 숙소 이야기를 할 때(예: "제가 도깨비라 잠을 안 자서 어떤 침대가 편한지는 몰라요")에만 쓰고, 각각 대화에서 한 번만 한다. 코스·날짜·동행·시각을 묻는 말에는 농담을 섞지 않는다. 사용자 말에 "~분과", "~랑 함께 가시는 날짜" 같은 어색한 말을 만들지 말고 자연스럽게 말한다. 농담은 가볍게 곁들이고 안내(메뉴·동네·고른 기준)는 분명하게 말한다. 맛·유명함·인기·분위기·영업시간·거리·역사처럼 cands 에 없는 정보는 절대 말하지 않는다. 쓰지 말 말: 맛있는·존맛·꿀맛·일품·유명한·소문난·대표·줄 서는·1위·엄선·보증·실패 없는·최고. 메뉴 고르기는 "입맛은 사람마다 다르니 메뉴 보고 끌리는 곳으로 정해 주세요"처럼 사람에게 돌려준다. 어려운 한자어·영어는 쓰지 않는다. 동해시 여행 이야기(코스, 맛집, 숙소 포함)만 한다. 숙소 이야기는 범위 안이다(다른 주제는 "동해 여행 이야기만 도와 드려요"라고 부드럽게 돌려 말한다). ' +
  '식당 추천 순서: 사용자가 "맛집"만 말하고 메뉴(회·국밥·면·고기·중식 등)도 동네도 아직 말하지 않았다면 picks 는 비우고, 먼저 메뉴나 동네 중 궁금한 것 하나를 가볍게 되묻고 choices 에 눌러 답할 짧은 보기 3~5개(예: 회·해산물, 국밥·탕, 면·분식, 고기·구이, 묵호, 천곡)를 담는다. 메뉴나 동네 중 하나라도 말했으면 바로 추천하되, 어떤 기준(메뉴·동네)을 반영했는지 한 마디 말하고, 이어서 다른 메뉴나 동네로 바꿀지 가볍게 묻는다. 대화 전체(이전 말)에서 말한 메뉴·동네를 함께 고려한다. 숙소 추천도 같은 방식이다: 사용자가 숙소 종류(호텔·펜션·민박·모텔)나 동네를 말하지 않았다면 먼저 하나만 되묻고 choices 를 준다. cands 의 menu 칸이 숙소 종류다. 가격·시설·후기·침대·전망은 모른다고 솔직히 말하고 종류와 동네 기준으로만 고른다. 추천할 때는 반드시 cands 목록의 id 만 picks 에 최대 3개 담는다. 목록에 없는 가게 이름을 지어내지 않는다. 이 자료는 공공데이터라 평점·후기·인기는 모른다는 점을 한 번은 솔직히 말하고, 메뉴와 동네 기준으로 골랐다고 말한다. cands 가 비어 있으면 식당은 추천하지 않는다. ' +
  '조건 모으기: parsed 에는 지금까지 대화 전체에서 알게 된 여행 조건을 넣는다(말하지 않은 칸은 비움, 짐작 금지). date 는 YYYY-MM-DD(today 기준), arrive 는 도착(출발해서 동해에 닿는) 시각 24시간 HH:MM("오후 1시 도착"이면 13:00, 말 안 했으면 비움), back 은 돌아갈 시각 24시간 HH:MM, how 는 car·bus·train, companions 는 부모님·아이·연인·친구·혼자, interests 는 사진·먹거리, knee·rain·food·foodWord·count·end 는 말한 것만. ' +
  '질문: 코스를 짜는 데 꼭 필요한 정보(날짜 → 누구와 → 돌아갈 시각 순)가 비었으면 한 번에 하나만 가볍게 묻는다. 식당만 물었으면 먼저 식당을 알려 주고 그다음에 "코스도 짜 드릴까요?"처럼 이어 간다. ' +
  '코스 만들기 대화 순서(한 번에 하나씩, 사용자가 한 번에 여러 개 말하면 건너뛴다): ① 날짜 ② 누구와 ③ 오는 교통(기차·버스·자가용, how 에 담고 말하지 않았으면 반드시 묻는다 — 기본값으로 짐작하지 않는다) ④ 도착 시각과 돌아갈 시각 ⑤ 꼭 가고 싶은 곳(없으면 도째비가 고른다고 안내하고 choices 에 "없어요, 알아서 짜 주세요" 를 넣는다). 인원수는 묻지 않는다. 사용자가 가고 싶은 곳을 말하면 places 목록의 id 로만 must 에 담는다(없는 곳이면 목록에 없다고 솔직히 말한다). ①~④ 와 ⑤ 질문이 끝나면(⑤ 는 없다고 답했거나 곳을 말했으면 끝난 것) 조건을 한 문장으로 정리해 "이대로 코스를 짜 드릴까요?" 라고 묻고 ready=true. 그 전에는 ready=false. 정리 문장에는 날짜(몇 월 며칠만 말하고 요일은 말하지 않는다 — 요일 계산은 틀리기 쉽다), 누구와, 도착·돌아갈 시각, 가고 싶은 곳을 자연스럽게 담는다. 사용자가 정리 내용을 고치고 싶다고 하면 고친 값으로 다시 정리한다. 시각·휴무 같은 계산은 앱이 하니 네가 말하지 않는다.';
var CHAT_SCHEMA = { type: 'OBJECT', properties: { reply: { type: 'STRING' }, picks: { type: 'ARRAY', items: { type: 'STRING' } }, choices: { type: 'ARRAY', items: { type: 'STRING' } }, ready: { type: 'BOOLEAN' }, must: { type: 'ARRAY', items: { type: 'STRING' } }, parsed: PARSE_SCHEMA }, required: ['reply'] };
function cleanParse(raw) {
  var j = raw; if (typeof raw === 'string') { try { j = JSON.parse(raw); } catch (e) { return null; } } if (!j || typeof j !== 'object') return null;
  var r = { date: null, arrive: null, train: null, how: null, end: 'mukho', companions: [], interests: [], knee: !!j.knee, rain: !!j.rain, food: !!j.food, foodWord: '', count: null };
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(j.date || ''))) r.date = j.date;
  var am = String(j.arrive || '').match(/^(\\d{1,2}):(\\d{2})$/); if (am && +am[1] < 24 && +am[2] < 60) r.arrive = +am[1] * 60 + +am[2];
  var m = String(j.back || '').match(/^(\d{1,2}):(\d{2})$/); if (m && +m[1] < 24 && +m[2] < 60) r.train = +m[1] * 60 + +m[2];
  if (['car', 'bus', 'train'].indexOf(j.how) >= 0) r.how = j.how;
  if (j.end === 'donghae') r.end = 'donghae';
  (j.companions || []).forEach(function (c) { if (['부모님', '아이', '연인', '친구', '혼자'].indexOf(c) >= 0 && r.companions.indexOf(c) < 0) r.companions.push(c); });
  (j.interests || []).forEach(function (c) { if (['사진', '먹거리'].indexOf(c) >= 0 && r.interests.indexOf(c) < 0) r.interests.push(c); });
  if (['물회', '칼국수', '국수', '회덮밥', '모듬회', '미역국', '죽'].indexOf(j.foodWord) >= 0) { r.foodWord = j.foodWord; r.food = true; }
  var n = parseInt(j.count, 10); if (n >= 1 && n <= 9) r.count = n;
  return { r: r, reply: String(j.reply || '').slice(0, 100) };
}

module.exports = async function handler(req, res) {
  var origin = req.headers.origin || '';
  if (ALLOW.indexOf(origin) >= 0) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }
  if (ALLOW.indexOf(origin) < 0) { res.status(403).json({ ok: false, why: 'origin' }); return; }
  var ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  if (limited(ip)) { res.status(429).json({ ok: false, why: 'rate' }); return; }
  try {
    var b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (b.task === 'edit') {
      var text = String(b.text || '').slice(0, 200), places = (Array.isArray(b.places) ? b.places : []).slice(0, 300).map(function (p) { return { id: String(p.id), name: String(p.name || '') }; });
      if (!text.trim()) { res.status(400).json({ ok: false }); return; }
      var raw = await gemini(EDIT_SYS, '사용자 말: ' + text + '\nplaces: ' + JSON.stringify(places), EDIT_SCHEMA);
      var r = cleanEdit(raw, places); if (!r) { res.status(200).json({ ok: false, why: 'parse' }); return; }
      res.status(200).json({ ok: true, intents: r.intents, reply: r.reply, model: USED }); return;
    }
    if (b.task === 'chat') {
      var msgs = (Array.isArray(b.messages) ? b.messages : []).slice(-8).map(function (m) { return (m && m.role === 'bot' ? '도째비: ' : '사용자: ') + String(m && m.text || '').slice(0, 300); });
      var cands = (Array.isArray(b.cands) ? b.cands : []).slice(0, 30).map(function (c) { return { id: String(c.id), name: String(c.name || '').slice(0, 30), menu: String(c.menu || '').slice(0, 20), area: String(c.area || '').slice(0, 12) }; });
      var cplaces = (Array.isArray(b.places) ? b.places : []).slice(0, 200).map(function (p) { return { id: String(p.id), name: String(p.name || '').slice(0, 30) }; });
      var ctoday = /^\d{4}-\d{2}-\d{2}$/.test(String(b.today || '')) ? b.today : '';
      if (!msgs.length) { res.status(400).json({ ok: false }); return; }
      var cwd = ctoday ? '일월화수목금토'[new Date(ctoday + 'T00:00:00Z').getUTCDay()] + '요일' : '';
      var craw = await gemini(CHAT_SYS, 'today: ' + ctoday + ' ' + cwd + '\njoke_state: ' + (function () { var all = msgs.join(' '), food = /맛집|식당|먹|밥|회|메뉴|국수|탕/.test(all), stay = /숙소|호텔|펜션|모텔|민박|리조트|숙박|잘 곳/.test(all), bot = msgs.filter(function (m) { return /^도째비:/.test(m); }).join(' '), fj = /입맛|혀|쇠도/.test(bot), sj = /침대|잠을 안/.test(bot), last = msgs[msgs.length - 1] || ''; var lf = /맛집|식당|먹|밥|회|메뉴|국수|탕|해산물|고기|면|분식|중식/.test(last), ls = /숙소|호텔|펜션|모텔|민박|리조트|숙박|잘 곳/.test(last); if (ls && stay && !sj) return '이번 답은 숙소 이야기이니 도깨비 잠자리 농담을 한 문장 넣을 것'; if (lf && food && !fj && !ls) return '이번 답은 식당 이야기이니 도깨비 입맛 농담을 한 문장 넣을 것'; return '이번 답에는 도깨비 농담을 넣지 말 것'; })() + '\nplaces: ' + JSON.stringify(cplaces) + '\ncands: ' + JSON.stringify(cands) + '\n대화:\n' + msgs.join('\n'), CHAT_SCHEMA, 1100, 9000);
      var cj; try { cj = JSON.parse(craw); } catch (e) { res.status(200).json({ ok: false, why: 'parse' }); return; }
      var okc = {}; cands.forEach(function (c) { okc[c.id] = 1; });
      var picks = (cj.picks || []).filter(function (id, i, a) { return okc[id] && a.indexOf(id) === i; }).slice(0, 3);
      var okp = {}; cplaces.forEach(function (p) { okp[p.id] = 1; });
      var must = (cj.must || []).filter(function (id, i, a) { return okp[id] && a.indexOf(id) === i; }).slice(0, 6);
      var cp = cleanParse(cj.parsed || {});
      var BAN = /맛있|존맛|꿀맛|일품|유명|소문|대표|줄\s*서|1위|엄선|보증|실패\s*없|최고/;
      cj.reply = String(cj.reply || '').replace(/\s?\(?[월화수목금토일]요일\)?/g, '').replace(/\([월화수목금토일]\)/g, '');
      var reply = String(cj.reply || '').split(/(?<=[.!?요])\s+/).filter(function (x) { return !BAN.test(x); }).join(' ').trim().slice(0, 400); if (!reply) { res.status(200).json({ ok: false, why: 'empty' }); return; }
      var pr = (cp && cp.r) || {}, readyOk = !!cj.ready, forceChoices = null;
      if (readyOk) { var miss = !pr.date ? '여행 날짜가 언제인가요?' : !pr.how ? '동해에는 무엇을 타고 오세요?' : pr.arrive == null ? '몇 시쯤 동해에 도착하세요? 알려 주시면 바로 짜 드릴게요.' : pr.train == null ? '몇 시에 돌아가세요? 알려 주시면 바로 짜 드릴게요.' : ''; if (miss) { readyOk = false; reply = miss; picks = []; forceChoices = !pr.date ? [] : !pr.how ? ['기차', '버스', '자가용'] : []; } }
      res.status(200).json({ ok: true, reply: reply, picks: picks, choices: (forceChoices || cj.choices || []).map(function (c) { return String(c).slice(0, 14); }).filter(Boolean).slice(0, 5), ready: readyOk, must: must, parsed: cp ? cp.r : null, model: USED }); return;
    }
    if (b.task === 'parse') {
      var pt = String(b.text || '').slice(0, 300), today = /^\d{4}-\d{2}-\d{2}$/.test(String(b.today || '')) ? b.today : '';
      if (!pt.trim()) { res.status(400).json({ ok: false }); return; }
      var wd = today ? '일월화수목금토'[new Date(today + 'T00:00:00Z').getUTCDay()] + '요일' : '';
      var pr = cleanParse(await gemini(PARSE_SYS, 'today: ' + today + ' ' + wd + '\n사용자 말: ' + pt, PARSE_SCHEMA));
      if (!pr) { res.status(200).json({ ok: false, why: 'parse' }); return; }
      res.status(200).json({ ok: true, parsed: pr.r, reply: pr.reply, model: USED }); return;
    }
    if (b.task === 'explain') {
      var facts = JSON.stringify(b.facts || {}).slice(0, 3000);
      var t = await gemini(EXPLAIN_SYS, 'facts: ' + facts, null);
      t = String(t || '').trim().slice(0, 600); if (!t) { res.status(200).json({ ok: false }); return; }
      res.status(200).json({ ok: true, text: t, model: USED }); return;
    }
    res.status(400).json({ ok: false });
  } catch (e) { res.status(200).json({ ok: false, why: String(e && e.message || e).replace(/AI[a-zA-Z0-9_\-]{20,}|AQ\.[\w\-.]+/g, '***').slice(0, 40) }); }
};
module.exports.cleanEdit = cleanEdit;
