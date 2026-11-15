const assert = require('assert'); const { shape } = require('./api/crowd.js');
const rows = [{ tAtsNm: '묵호등대', baseYmd: '20261120', cnctrRate: '63.2' }, { tAtsNm: '묵호등대', baseYmd: '20261121', cnctrRate: '88' }, { tAtsNm: '추암 촛대바위', baseYmd: '20261120', cnctrRate: '41' }, { tAtsNm: '', baseYmd: '20261120', cnctrRate: '10' }, { tAtsNm: '이상', baseYmd: '2026', cnctrRate: '10' }, { tAtsNm: '범위밖', baseYmd: '20261120', cnctrRate: '300' }];
const s = shape(rows);
assert.deepStrictEqual(s.spots, { '묵호등대': { '20261120': 63.2, '20261121': 88 }, '추암 촛대바위': { '20261120': 41 } });
assert.strictEqual(s.from, '20261120'); assert.strictEqual(s.to, '20261121'); assert.strictEqual(shape([]), null);
// 앱의 crowd.js 가 이 모양을 그대로 읽는다
const CR = require('../tour-design/crowd.js'); assert.ok(CR.valid(s));
const r = CR.ratesFor(s, '2026-11-21'); assert.strictEqual(r.lighthouse, 88);
console.log('crowd tests ok');
