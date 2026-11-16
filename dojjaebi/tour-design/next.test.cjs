const { JSDOM } = require('jsdom'); const fs = require('fs'), path = require('path'), assert = require('assert');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const dom = await JSDOM.fromFile(path.resolve(__dirname, 'index.html'), { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' });
  const w = dom.window, errs = []; w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = function () {};
  w.IntersectionObserver = class { observe() {} disconnect() {} }; w.ResizeObserver = class { observe() {} disconnect() {} };
  w.addEventListener('error', e => errs.push(e.message)); w.localStorage.setItem('tour.here.v1', 'no');
  let aiOk = true, last = null;
  w.fetch = (u, o) => /api\/ai/.test(u) ? (last = JSON.parse(o.body), Promise.resolve({ json: () => Promise.resolve(aiOk && last.task === 'next' ? { ok: true, summary: '바다 위주였으니 다음엔 산 쪽도 가 봐요.', picks: [{ id: 'cheongok', why: '비 와도 걱정 없어요' }, { id: 'zzz', why: '없는 곳' }] } : { ok: false }) })) : new Promise(() => {});
  const srcs = [...w.document.querySelectorAll('script[src]')].map(s => s.getAttribute('src')).filter(s => !/^http/.test(s) && !/chat\.js|mission\.js/.test(s));
  for (const s of srcs) { const f = path.resolve(__dirname, s.split('?')[0]); if (fs.existsSync(f)) { try { w.eval(fs.readFileSync(f, 'utf8')); } catch (e) { errs.push(s + ': ' + e.message); } } }
  await wait(400); const d = w.document; w.__tour.makePlan();
  d.querySelector('[data-tab="s-card"]').click(); await wait(300);
  const box = d.getElementById('nextBox'); assert.ok(!box.hidden, '다음에 또 올 때 칸이 보여야 함');
  const rows = box.querySelectorAll('.nx-list .nx-row'); assert.ok(rows.length >= 2, '코스 곳 줄: ' + rows.length);
  const b = rows[0].querySelector('[data-wish]'), id = b.getAttribute('data-wish'); assert.strictEqual(b.getAttribute('aria-pressed'), 'false');
  b.click(); await wait(50);
  assert.ok(JSON.parse(w.localStorage.getItem('tour.wish.v1')).includes(id), '저장됨'); assert.strictEqual(box.querySelector('[data-wish="' + id + '"]').getAttribute('aria-pressed'), 'true');
  // AI 추천
  d.getElementById('nxGo').click(); await wait(400);
  assert.strictEqual(last.task, 'next'); assert.ok(last.pool.length > 0 && !last.pool.some(p => p.id === id) && last.wish.some(p => p.id === id), 'AI에 후보·저장 목록 전달');
  assert.ok(/도째비 추천/.test(box.textContent) && /산 쪽도/.test(box.textContent) && /천곡|황금박쥐/.test(box.textContent), 'AI 결과 표시: ' + box.textContent.slice(0, 200));
  assert.ok(!/없는 곳/.test(box.textContent), '목록에 없는 id는 버림');
  // AI 실패 → 기본 추천 표시
  aiOk = false; d.getElementById('nxGo').click(); await wait(400);
  assert.ok(/기본 추천/.test(box.textContent) && box.querySelectorAll('.nx-say + .nx-list .nx-row').length >= 1, '실패 시 기본 추천: ' + box.textContent.slice(0, 160));
  // 저장 해제
  box.querySelector('[data-wish="' + id + '"]').click(); await wait(50); assert.ok(!JSON.parse(w.localStorage.getItem('tour.wish.v1')).includes(id));
  assert.deepStrictEqual(errs, [], errs.join('|')); console.log('다음에 또 올 때 시험 통과'); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
