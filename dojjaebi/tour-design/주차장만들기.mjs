/* 주차장 자료 만들기 — 실행: node 주차장만들기.mjs → parking.data.js (직접 고치지 말 것)
 * 출처: 강원특별자치도 동해시 주차장정보(공공데이터포털) 원본 CSV = 주차장정보_원본.csv. 값은 고치지 않고 옮긴다. */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
function parse(t) { // 따옴표 안 쉼표·줄바꿈 처리
  const rows = []; let r = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { r.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; r.push(f); f = ''; if (r.length > 1 || r[0] !== '') rows.push(r); r = []; }
    else f += c;
  }
  if (f !== '' || r.length) { r.push(f); rows.push(r); }
  return rows;
}
const t = readFileSync(join(here, '주차장정보_원본.csv'), 'utf8').replace(/^﻿/, '');
const [h, ...rows] = parse(t); const ix = {}; h.forEach((k, i) => { ix[k] = i; });
const g = (r, k) => (r[ix[k]] || '').trim();
const lots = rows.map(r => ({
  name: g(r, '주차장명'), kind: g(r, '주차장구분'), type: g(r, '주차장유형'),
  addr: g(r, '소재지도로명주소') || g(r, '소재지지번주소').replace(/^강원특별자치도\s*/, ''),
  n: +g(r, '주차구획수') || 0, fee: g(r, '요금정보'),
  base: g(r, '주차기본시간'), baseWon: g(r, '주차기본요금'), add: g(r, '추가단위시간'), addWon: g(r, '추가단위요금'), dayWon: g(r, '1일주차권요금'),
  wk: [g(r, '평일운영시작시각'), g(r, '평일운영종료시각')], sat: [g(r, '토요일운영시작시각'), g(r, '토요일운영종료시각')], hol: [g(r, '공휴일운영시작시각'), g(r, '공휴일운영종료시각')],
  days: g(r, '운영요일'), note: g(r, '특기사항'), org: g(r, '관리기관명'), tel: g(r, '전화번호'),
  lat: +g(r, '위도'), lng: +g(r, '경도')
}));
const date = [...new Set(rows.map(r => g(r, '데이터기준일자')))].join(',');
const out = { 출처: '강원특별자치도 동해시 주차장정보(공공데이터포털)', 기준일: date, lots };
writeFileSync(join(here, 'parking.data.js'),
  '/* 자동 생성: node 주차장만들기.mjs — 직접 고치지 말 것 */\n(function (root) { var P = ' + JSON.stringify(out) + ';\n  if (typeof module !== \'undefined\' && module.exports) module.exports = P; else root.TOWN_PARKING = P; })(typeof window !== \'undefined\' ? window : globalThis);\n');
console.log('주차장', lots.length, '곳 · 기준일', date, '· 면수 합', lots.reduce((s, x) => s + x.n, 0));
