const { JSDOM } = require('jsdom'); const fs = require('fs'), path = require('path');
const errs = [];
JSDOM.fromFile(path.resolve(__dirname, 'index.html'), { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' }).then(dom => {
  const w = dom.window, d = w.document;
  w.fetch = () => Promise.reject(new Error('no net')); w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = function () {};
  w.IntersectionObserver = class { observe() {} disconnect() {} }; w.ResizeObserver = class { observe() {} disconnect() {} };
  w.addEventListener('error', e => errs.push(e.message));
  const srcs = [...d.querySelectorAll('script[src]')].map(s => s.getAttribute('src')).filter(s => !/^http/.test(s) && !/chat\.js|mission\.js/.test(s));
  for (const s of srcs) { const f = path.resolve(__dirname, s.split('?')[0]); if (!fs.existsSync(f)) continue; try { w.eval(fs.readFileSync(f, 'utf8')); } catch (e) { errs.push(s + ': ' + e.message); } }
  return new Promise(r => setTimeout(() => r(dom), 800));
}).then(dom => {
  const d = dom.window.document, vis = () => [0,1,2,3,4,5,6].filter(i => !d.getElementById('st' + i).hidden).join(',');
  const go = id => d.getElementById(id).click();
  console.log('errors:', errs.slice(0, 5));
  console.log('start visible:', vis());
  const seq = [];
  const other = [...d.querySelectorAll('button')].find(b => /날짜·시간을 직접/.test(b.textContent)); if (other) { other.click(); seq.push('after other: ' + vis()); }
  go('stNext2'); seq.push('next2: ' + vis());
  go('stNext5'); seq.push('next5: ' + vis());
  go('stNext4'); seq.push('next4: ' + vis());
  go('stBack6'); seq.push('back6: ' + vis()); go('stBack4'); seq.push('back4: ' + vis()); go('stBack3'); seq.push('back3: ' + vis());
  const want = ['after other: 1,2','next2: 3,5','next5: 4','next4: 6','back6: 4','back4: 3,5','back3: 1,2'];
  require('assert').deepStrictEqual(seq, want); require('assert').strictEqual(errs.length, 0);
  console.log('입력 4장 묶음 통과');
  process.exit(0);
});
