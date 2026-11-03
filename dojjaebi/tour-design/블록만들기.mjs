/* 식당가 블록 자료 만들기 — 실행: node 블록만들기.mjs  →  blocks.data.js 를 새로 씀 (직접 고치지 말 것)
 * 규칙(정책 v2): 식당이 가장 몰린 곳부터 반경 R(250m) 이내를 한 블록으로 묶는다. 이웃이 5곳 미만이면 '흩어진 곳'. 좌표 없는 곳은 '위치 모름'.
 * 이름: 블록 중심에서 500m 이내 가장 가까운 공공 관광지·역(블록기준점.json) + ' 근처', 없으면 '동 도로명 일대'. 겹치면 기준점에서 본 방향을 붙이고, 그래도 겹치면 가게 많은 순 번호.
 * 가게 수·인기는 이름·순서에 쓰지 않는다(번호는 이름이 정말 겹칠 때만 구분용). */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DATA = require('./town.data.js');
const ANCH = JSON.parse(readFileSync(join(here, '블록기준점.json'), 'utf8'));

const R = 250, MIN_PTS = 5, NEAR = 500;
const PUB = new Set(['호프/통닭', '정종/대포집/소주방', '라이브카페']); // 술집류: 화면에서 기본 접기(제외 아님)

function hav(la1, ln1, la2, ln2) {
  const r = Math.PI / 180, p1 = la1 * r, p2 = la2 * r, dp = p2 - p1, dl = (ln2 - ln1) * r;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}
function roadOf(addr) { const m = /^\s*([가-힣0-9]+(?:로|길)(?:\d+번?길)?)/.exec(addr || ''); return m ? m[1] : ''; }
function dirOf(dlat, dlng, lat) {
  const dy = dlat * 111000, dx = dlng * 111000 * Math.cos(lat * Math.PI / 180);
  const a = ((Math.atan2(dx, dy) * 180 / Math.PI) % 360 + 360) % 360;
  return ['북', '북동', '동', '남동', '남', '남서', '서', '북서'][Math.floor((a + 22.5) / 45) % 8];
}

// 식당 한 줄: [이름, 업종, 주소, 동, 위도, 경도, ...]. key 는 town.js 와 같은 'e' + 원래 줄 번호.
const rows = DATA.eats.map((r, i) => ({ i, r }));
const pos = rows.filter(x => x.r[4] && x.r[5]);
const nopos = rows.filter(x => !(x.r[4] && x.r[5])).map(x => x.i);
const n = pos.length;

// 1) 반경 R 이웃
const nb = Array.from({ length: n }, () => []);
for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
  if (Math.abs(pos[a].r[4] - pos[b].r[4]) > 0.004) continue;
  if (hav(pos[a].r[4], pos[a].r[5], pos[b].r[4], pos[b].r[5]) <= R) { nb[a].push(b); nb[b].push(a); }
}
// 2) 욕심 묶기: 이웃이 가장 많은 곳(같으면 뒤쪽 줄)을 중심으로, 아직 안 묶인 이웃을 한 블록으로
const cnt = nb.map(x => x.length + 1), lab = new Array(n).fill(-1), blocks = [];
for (;;) {
  let seed = -1, best = -1;
  for (let k = 0; k < n; k++) if (lab[k] === -1 && cnt[k] >= best) { best = cnt[k]; seed = k; }
  if (seed < 0 || best < MIN_PTS) break;
  const mem = [seed, ...nb[seed].filter(j => lab[j] === -1)];
  const id = blocks.length; mem.forEach(m => { lab[m] = id; });
  mem.forEach(m => nb[m].forEach(q => { cnt[q]--; }));
  blocks.push(mem);
}
const scattered = pos.filter((_, k) => lab[k] === -1).map(x => x.i);

// 3) 블록 설명
const anchors = ANCH['기준점'];
const info = blocks.map(mem => {
  const rs = mem.map(k => pos[k].r);
  const lat = rs.reduce((s, r) => s + r[4], 0) / rs.length, lng = rs.reduce((s, r) => s + r[5], 0) / rs.length;
  const cnts = {}; rs.forEach(r => { cnts[r[3]] = (cnts[r[3]] || 0) + 1; });
  const dong = Object.keys(cnts).sort((a, b) => cnts[b] - cnts[a])[0];
  const rc = {}; rs.forEach(r => { const d = roadOf(r[2]); if (d) rc[d] = (rc[d] || 0) + 1; });
  const road = Object.keys(rc).sort((a, b) => rc[b] - rc[a])[0] || '';
  let ba = null, bd = 1e12;
  anchors.forEach(a => { const d = hav(lat, lng, a.lat, a.lng); if (d < bd) { bd = d; ba = a; } });
  const near = bd <= NEAR;
  return {
    mem, lat, lng, dong, road, n: mem.length, near,
    base: near ? ba.name + ' 근처' : (dong + ' ' + road + ' 일대').replace(/\s+/g, ' ').trim(),
    dir: near && bd > 150 ? dirOf(lat - ba.lat, lng - ba.lng, lat) : '', anchor: near ? ba.name : '', anchorM: Math.round(bd)
  };
});
// 4) 이름 확정: 기본 → (겹치면) 방향 → (그래도 겹치면) 가게 많은 순 번호
const by = {}; info.forEach(b => { (by[b.base] = by[b.base] || []).push(b); });
Object.values(by).forEach(g => {
  if (g.length === 1) { g[0].name = g[0].base; return; }
  const g2 = {}; g.forEach(b => { const k = b.base + (b.dir ? ' ' + b.dir + '쪽' : ''); (g2[k] = g2[k] || []).push(b); });
  Object.entries(g2).forEach(([k, ys]) => {
    if (ys.length === 1) { ys[0].name = k; return; }
    ys.sort((a, b) => b.n - a.n).forEach((b, j) => { b.name = k + ' ' + (j + 1); });
  });
});
// 5) 화면용: 북→남으로 정렬해 id 부여(순위 아님 — 화면에는 번호를 쓰지 않는다)
info.sort((a, b) => b.lat - a.lat);
const out = {
  기준: { 반경m: R, 최소곳수: MIN_PTS, 이름기준m: NEAR, 자료기준일: (DATA.ref && (DATA.ref.date || DATA.ref.eats)) || '2026-03-24', 만든날: new Date().toISOString().slice(0, 10) },
  blocks: info.map((b, k) => ({
    id: 'b' + (k + 1), name: b.name, lat: +b.lat.toFixed(6), lng: +b.lng.toFixed(6), n: b.n, dong: b.dong,
    anchor: b.anchor, anchorM: b.anchorM, eats: b.mem.map(m => pos[m].i)
  })),
  scattered, nopos, pub: [...PUB]
};
writeFileSync(join(here, 'blocks.data.js'),
  '/* 자동 생성: node 블록만들기.mjs — 직접 고치지 말 것 */\n(function (root) { var B = ' + JSON.stringify(out) + ';\n  if (typeof module !== \'undefined\' && module.exports) module.exports = B; else root.TOWN_BLOCKS = B; })(typeof window !== \'undefined\' ? window : globalThis);\n');
const names = out.blocks.map(b => b.name);
console.log(`블록 ${out.blocks.length}개 · 블록 안 ${out.blocks.reduce((s, b) => s + b.n, 0)}곳 · 흩어진 곳 ${scattered.length} · 위치 모름 ${nopos.length} · 합계 ${out.blocks.reduce((s, b) => s + b.n, 0) + scattered.length + nopos.length}/${DATA.eats.length} · 이름 중복 ${names.length - new Set(names).size}`);
