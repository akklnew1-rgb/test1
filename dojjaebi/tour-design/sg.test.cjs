const { JSDOM } = require('jsdom'); const fs = require('fs'), path = require('path'), assert = require('assert');
function boot(mockFetch) {
  const errs = [];
  return JSDOM.fromFile(path.resolve(__dirname, 'index.html'), { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' }).then(dom => {
    const w = dom.window; w.fetch = mockFetch; w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = function () {};
    w.IntersectionObserver = class { observe() {} disconnect() {} }; w.ResizeObserver = class { observe() {} disconnect() {} };
    w.addEventListener('error', e => errs.push(e.message));
    const srcs = [...w.document.querySelectorAll('script[src]')].map(s => s.getAttribute('src')).filter(s => !/^http/.test(s) && !/chat\.js|mission\.js/.test(s));
    for (const s of srcs) { const f = path.resolve(__dirname, s.split('?')[0]); if (!fs.existsSync(f)) continue; try { w.eval(fs.readFileSync(f, 'utf8')); } catch (e) { errs.push(s + ': ' + e.message); } }
    return new Promise(r => setTimeout(() => r({ w, errs }), 600));
  });
}
const wait = ms => new Promise(r => setTimeout(r, ms));
async function run(label, mock, expectAi, apply) {
  const { w, errs } = await boot(mock), d = w.document, $ = id => d.getElementById(id), calls = [];
  const orig = w.fetch; w.fetch = (u, o) => { try { calls.push(JSON.parse(o.body)); } catch (e) {} return orig(u, o); };
  [...d.querySelectorAll('button')].find(b => /날짜·시간을 직접/.test(b.textContent)).click();
  // 1) 시각 제안: 누구와를 고르면 나온다
  assert.ok($('sugTime').hidden, label + ': 동행 전엔 안 보임');
  d.querySelector('[data-comp="부모님"]').click(); await wait(80);
  assert.ok(!$('sugTime').hidden, label + ': 동행 뒤 보임');
  const txt = $('sugTime').textContent; assert.ok(/도착 \d\d:\d\d/.test(txt) && /떠남 \d\d:\d\d/.test(txt), label + ': 시각 두 개 ' + txt);
  assert.ok(txt.indexOf(expectAi ? '제미나이' : '정해 둔 규칙') >= 0, label + ': 출처 표시');
  assert.ok(/부모님과 함께/.test(txt), label + ': 이유 꼬리표');
  assert.strictEqual($('sTime').value === '', false);
  if (apply) {
    $('sugTime').querySelector('[data-sgtime]').click(); await wait(30);
    assert.ok($('sugTime').hidden, label + ': 적용 뒤 숨음');
    assert.ok(/^\d\d:\d\d$/.test($('sTime').value) && $('sTime').value >= '09:00', label + ': 도착 칸 채워짐 ' + $('sTime').value);
  } else { $('sugTime').querySelector('[data-sgx]').click(); assert.ok($('sugTime').hidden, label + ': 괜찮아요로 닫힘'); }
  // 2) 꼭 가고 싶은 곳 후보
  $('stNext5').click(); await wait(80);
  assert.ok(!$('st4').hidden && !$('sugMust').hidden, label + ': 후보 보임');
  const picks = [...$('sugMust').querySelectorAll('[data-sgmust]')]; assert.ok(picks.length >= 1 && picks.length <= 3, label + ': 후보 1~3곳 ' + picks.length);
  picks[0].click(); assert.strictEqual($('sugMust').querySelector('[data-sgmust]').getAttribute('aria-pressed'), 'true');
  assert.ok($('mvList').querySelector('.mv-item.on'), label + ': 목록에도 고른 것으로 표시');
  assert.ok(!/식당|맛집/.test([...$('sugMust').querySelectorAll('.sg-pick b')].map(x => x.textContent).join('')), label + ': 가게 안 고름');
  // 3) 확인 화면 되묻기
  $('stNext4').click(); await wait(80);
  assert.ok(!$('st6').hidden, label + ': 확인 화면');
  if (apply) assert.ok($('sugAsk').hidden, label + ': 시각을 다 정했으니 되묻지 않음');
  else {
    assert.ok(!$('sugAsk').hidden, label + ': 되묻기 보임');
    assert.ok(/돌아가는|도착/.test($('sugAsk').textContent), label + ': 질문 ' + $('sugAsk').textContent);
    $('sugAsk').querySelector('[data-sgask]').click(); assert.ok(!$('st1').hidden || !$('st2').hidden, label + ': 알려 줄게요 → 시각 화면');
    $('stNext2').click(); $('stNext5').click(); $('stNext4').click(); await wait(60);
    assert.ok(!$('makeCourse').disabled, label + ': 코스 만들기 항상 가능');
    $('sugAsk').querySelector('[data-sgx]').click(); assert.ok($('sugAsk').hidden, label + ': 이대로 짜 주세요');
  }
  assert.deepStrictEqual(errs, [], label + ': 오류 없음');
  console.log(label, '통과 · 호출', calls.map(c => c.kind).join(','));
}
const ai = (u, o) => { if (!o || !o.body) return Promise.reject(new Error('no net')); const b = JSON.parse(o.body), k = b.kind;
  const body = k === 'time' ? { ok: true, arrive: '11:00', back: '17:30', reason: '부모님과 함께라 여유 있게' } : k === 'must' ? { ok: true, ids: ['cheongok', 'suibyeon'], whys: ['실내라 편해요', '평지 산책'] } : { ok: true, field: 'back', q: '돌아가는 시각은 정하셨나요?' };
  return Promise.resolve({ json: () => Promise.resolve(body) }); };
(async () => { await run('규칙', () => Promise.reject(new Error('no net')), false, true); await run('AI', ai, true, false); process.exit(0); })().catch(e => { console.error(e); process.exit(1); });
