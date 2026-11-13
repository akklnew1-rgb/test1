const { JSDOM } = require('jsdom'); const fs = require('fs'); const assert = require('assert');
const dom = new JSDOM('<body><div id="story" hidden></div><div id="addSheet" hidden></div><div id="chatRoom" hidden></div></body>', { url: 'http://localhost/', runScripts: 'outside-only' });
const w = dom.window; w.eval(fs.readFileSync(__dirname + '/nav.js', 'utf8'));
const wait = (ms) => new Promise(r => setTimeout(r, ms || 30));
(async () => {
  const log = []; let screen = 's-start';
  w.TourNav.register('story', () => { w.document.getElementById('story').hidden = true; log.push('story-closed'); });
  w.TourNav.onScreen((id) => { screen = id; w.TourNav.quiet(id); log.push('go:' + id); });
  const nav = (id) => { screen = id; w.TourNav.screen(id); };
  assert.strictEqual(JSON.stringify(w.history.state), JSON.stringify({ scr: 's-start' }));
  nav('s-input'); nav('s-course');
  // 창 열고 뒤로 → 창만 닫힘
  w.document.getElementById('story').hidden = false; await wait();
  w.history.back(); await wait();
  assert(w.document.getElementById('story').hidden); assert.strictEqual(screen, 's-course'); assert.strictEqual(JSON.stringify(w.history.state), JSON.stringify({ scr: 's-course' }));
  // 창 닫은 뒤 뒤로 → 이전 화면
  w.history.back(); await wait(); assert.strictEqual(screen, 's-input');
  w.history.back(); await wait(); assert.strictEqual(screen, 's-start');
  // 폴백 닫기(등록 없는 창)
  w.document.getElementById('chatRoom').hidden = false; await wait();
  w.history.back(); await wait(); assert(w.document.getElementById('chatRoom').hidden);
  // 창 두 개: 위에 열린 것부터
  w.document.getElementById('story').hidden = false; await wait();
  w.document.getElementById('addSheet').hidden = false; await wait();
  w.history.back(); await wait(); assert(w.document.getElementById('addSheet').hidden && !w.document.getElementById('story').hidden);
  w.history.back(); await wait(); assert(w.document.getElementById('story').hidden);
  assert.strictEqual(screen, 's-start');
  console.log('nav ok');
})().catch(e => { console.error(e); process.exit(1); });
