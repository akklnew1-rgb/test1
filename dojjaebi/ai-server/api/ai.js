/* 도째비 길동무 — 인공지능 중계 함수 (Vercel). 열쇠는 환경변수 GEMINI_API_KEY 에만 둔다(앱 코드에 넣지 않음).
 * 하는 일은 두 가지뿐이다. 장소·시각 계산은 앱의 계산기가 그대로 하고, 여기서는 "말 → 정해진 명령" 번역과 "코스 이유 설명"만 한다.
 *   POST { task:'edit',    text:'다리가 아파서 덜 걷고 싶어', places:[{id,name}] }  → { ok, intents:[{type,ids?,when?,theme?}], reply }
 *   POST { task:'explain', facts:{...} }                                           → { ok, text }
 * 모델이 지어낸 장소 id 는 places 목록과 대조해서 버린다. 실패하면 { ok:false } — 앱이 알아서 규칙 방식으로 돌아간다. */
var MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
var ALLOW = (process.env.ALLOW_ORIGINS || 'https://akklnew1-rgb.github.io,https://dojjaebi-gildongmu.vercel.app,http://localhost:8765').split(',');
var TYPES = ['remove', 'add', 'removeMeal', 'addMeal', 'addTheme', 'indoor', 'slower', 'longer', 'shorter', 'first', 'last', 'unknown'];
var hits = {}; // 아주 단순한 속도 제한(주소별 분당 20번) — 시연 중 남용 방지
function limited(ip) { var m = Math.floor(Date.now() / 60000), h = hits[ip] || (hits[ip] = { m: m, n: 0 }); if (h.m !== m) { h.m = m; h.n = 0; } return ++h.n > 20; }

async function gemini(system, user, schema) {
  // 환경변수에 열쇠만이 아니라 AI Studio 의 curl 예시 줄 전체를 붙여 넣었어도 열쇠 부분만 뽑아 쓴다
  var raw = String(process.env.GEMINI_API_KEY || '').trim(), mm = raw.match(/x-goog-api-key:\s*([^\s'"\\]+)/i) || raw.match(/[?&]key=([^&\s'"\\]+)/i);
  var key = mm ? mm[1] : (/\s/.test(raw) ? '' : raw); if (!key) throw new Error('no key');
  var body = { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 700 } };
  if (schema) { body.generationConfig.responseMimeType = 'application/json'; body.generationConfig.responseSchema = schema; }
  var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 8000);
  try {
    var r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent', { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body), signal: ctl.signal });
    if (!r.ok) throw new Error('gemini ' + r.status);
    var j = await r.json(), p = j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts;
    return (p || []).map(function (x) { return x.text || ''; }).join('');
  } finally { clearTimeout(t); }
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
      res.status(200).json({ ok: true, intents: r.intents, reply: r.reply, model: MODEL }); return;
    }
    if (b.task === 'explain') {
      var facts = JSON.stringify(b.facts || {}).slice(0, 3000);
      var t = await gemini(EXPLAIN_SYS, 'facts: ' + facts, null);
      t = String(t || '').trim().slice(0, 600); if (!t) { res.status(200).json({ ok: false }); return; }
      res.status(200).json({ ok: true, text: t, model: MODEL }); return;
    }
    res.status(400).json({ ok: false });
  } catch (e) { res.status(200).json({ ok: false, why: String(e && e.message || e).replace(/AI[a-zA-Z0-9_\-]{20,}|AQ\.[\w\-.]+/g, '***').slice(0, 40) }); }
};
module.exports.cleanEdit = cleanEdit;
