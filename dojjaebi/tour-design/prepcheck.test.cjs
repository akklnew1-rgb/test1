const { JSDOM } = require('jsdom'); const fs = require('fs'), path = require('path'), assert = require('assert');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const dom = await JSDOM.fromFile(path.resolve(__dirname, 'index.html'), { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' });
  const w = dom.window, errs = []; w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = function () {};
  w.IntersectionObserver = class { observe() {} disconnect() {} }; w.ResizeObserver = class { observe() {} disconnect() {} };
  w.addEventListener('error', e => errs.push(e.message)); w.localStorage.setItem('tour.here.v1', 'no');
  let wet = true; // 예보: 어떤 날짜든 같은 값(Proxy)
  const fc = () => ({ error: null, days: new Proxy({}, { get: () => ({ tmin: 3, tmax: 9, text: wet ? '비' : '맑음', pop: wet ? 80 : 10 }) }) });
  const NM = ['도째비골스카이밸리','논골담길','묵호등대','묵호항','묵호항수변공원','전망대활어회센터 (묵호항전망대)','어달해변','추암 촛대바위','추암해변','추암조각공원','천곡황금박쥐동굴','노봉해변','망상해변','감추사','무릉계곡','무릉별유천지'];
  const spots = {}; NM.forEach(n => { spots[n] = new Proxy({}, { get: () => 90 }); });
  w.fetch = (u) => /forecast/.test(u) ? Promise.resolve({ json: () => Promise.resolve(fc()) }) : /crowd/.test(u) ? Promise.resolve({ json: () => Promise.resolve({ ok: true, from: '20000101', to: '20991231', spots }) }) : new Promise(() => {});
  const srcs = [...w.document.querySelectorAll('script[src]')].map(s => s.getAttribute('src')).filter(s => !/^http/.test(s) && !/chat\.js|mission\.js/.test(s));
  for (const s of srcs) { const f = path.resolve(__dirname, s.split('?')[0]); if (fs.existsSync(f)) { try { w.eval(fs.readFileSync(f, 'utf8')); } catch (e) { errs.push(s + ': ' + e.message); } } }
  await wait(500); const d = w.document;
  await wait(300); w.__tour.makePlan(); // 코스를 하나 만들어 둔다(붐빔 줄은 코스가 있어야 계산됨)
  d.getElementById('myPrep').click(); await wait(400);
  const rows = () => [...d.querySelectorAll('#prepCheck .pc-row')].map(r => r.textContent);
  let r = rows(); assert.ok(r.length >= 2, '점검 줄이 있어야 함: ' + r.length);
  assert.ok(r.some(t => /날씨/.test(t) && /주의/.test(t) && /비 소식/.test(t)), '비 예보면 날씨 주의: ' + r.join(' | '));
  assert.ok(r.some(t => /붐빔/.test(t) && /주의/.test(t) && /곳 있어요/.test(t)), '붐빔 90이면 주의: ' + r.join(' | '));
  const btn = d.querySelector('#prepCheck [data-pc="rain"]'); assert.ok(btn && btn.getBoundingClientRect, '비 코스 버튼');
  btn.click(); await wait(400);
  r = rows(); assert.ok(r.some(t => /날씨/.test(t) && /괜찮아요/.test(t) && /실내 곳 위주/.test(t)), '누른 뒤엔 반영됨: ' + r.join(' | '));
  assert.ok(!d.querySelector('#prepCheck [data-pc="rain"]'), '버튼 사라짐');
  const q = d.querySelector('#prepCheck [data-pc="quiet"]'); assert.ok(q, '한적 버튼'); const before = (w.__tour.state.plan.stops || []).map(x => x.place && x.place.id).join();
  q.click(); await wait(400); r = rows(); assert.ok(r.some(t => /붐빔/.test(t) && /붐비는 곳을 줄여 짰어요/.test(t)), '누른 뒤: ' + r.join(' | ')); assert.ok(!d.querySelector('#prepCheck [data-pc="quiet"]'), '한적 버튼 사라짐'); assert.ok(w.__tour.state.cond.interests.indexOf('한적') >= 0, '조건에 한적');
  assert.ok(!d.getElementById('prepNotify'), '가짜 알림 버튼 없음');
  assert.deepStrictEqual(errs, [], '오류 없음: ' + errs.join('|'));
  console.log('출발 전 점검 시험 통과'); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
