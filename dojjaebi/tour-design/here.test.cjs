const { JSDOM } = require('jsdom'); const fs = require('fs'), path = require('path'), assert = require('assert');
const wait = ms => new Promise(r => setTimeout(r, ms));
async function boot(pos, pre) {
  const dom = await JSDOM.fromFile(path.resolve(__dirname, 'index.html'), { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' });
  const w = dom.window, errs = []; w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = function () {};
  w.IntersectionObserver = class { observe() {} disconnect() {} }; w.ResizeObserver = class { observe() {} disconnect() {} };
  w.fetch = () => new Promise(() => {}); w.addEventListener('error', e => errs.push(e.message));
  if (pre) w.localStorage.setItem('tour.here.v1', pre);
  w.navigator.geolocation = { getCurrentPosition: (ok, bad) => pos ? ok({ coords: { latitude: pos[0], longitude: pos[1] } }) : bad({ code: 1 }) };
  const srcs = [...w.document.querySelectorAll('script[src]')].map(s => s.getAttribute('src')).filter(s => !/^http/.test(s) && !/chat\.js|mission\.js/.test(s));
  for (const s of srcs) { const f = path.resolve(__dirname, s.split('?')[0]); if (fs.existsSync(f)) { try { w.eval(fs.readFileSync(f, 'utf8')); } catch (e) { errs.push(s + ': ' + e.message); } } }
  await wait(500); return { w, errs };
}
(async () => {
  let { w, errs } = await boot([37.5247, 129.1143]); let d = w.document;
  assert.ok(!d.getElementById('hereCard').hidden, '처음엔 카드 보임');
  d.getElementById('hereYes').click(); await wait(50);
  assert.ok(d.getElementById('hereCard').hidden, '답한 뒤 숨음'); assert.strictEqual(w.localStorage.getItem('tour.here.v1'), 'done');
  const bots = [...d.querySelectorAll('#chat .bub.bot')].map(x => x.textContent); assert.ok(bots.some(t => /동해에 계시네요/.test(t) && /누구와/.test(t)), '동해 안: ' + bots.join('|'));
  assert.ok(!bots.some(t => /언제 동해에 오실/.test(t)));
  ({ w, errs } = await boot([37.5665, 126.978])); d = w.document; d.getElementById('hereYes').click(); await wait(50);
  assert.ok([...d.querySelectorAll('#chat .bub.bot')].some(x => /동해 밖/.test(x.textContent) && /언제/.test(x.textContent)), '동해 밖');
  ({ w, errs } = await boot(null)); d = w.document; d.getElementById('hereYes').click(); await wait(50);
  assert.ok([...d.querySelectorAll('#chat .bub.bot')].some(x => /확인하지 못했어요/.test(x.textContent)), '거부');
  ({ w, errs } = await boot([37.5247, 129.1143], 'no')); assert.ok(w.document.getElementById('hereCard').hidden, '나중에 한 뒤엔 안 보임');
  ({ w, errs } = await boot([37.5247, 129.1143], 'done')); assert.ok(w.document.getElementById('hereCard').hidden, '한 번 답하면 다시 안 물음');
  assert.deepStrictEqual(errs, [], '오류 없음');
  console.log('here.test 통과'); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
