/* 한국관광공사 「대한민국 명소발굴 100×100」 선정 명소 중 이 서비스의 장소(places.js id)와 짝지은 것.
 * - 손으로 적는 목록. 선정이 확인된 곳만 넣는다(추측해서 넣지 않음). 넣은 곳에만 '100×100 선정' 표시가 붙는다.
 * - 확인 방법: https://spot100x100.kr/map/ 에서 동해시로 좁혀 묶음 숫자를 눌러 이름을 본다.
 * - 망상 오토캠핑장·동해휴게소도 선정돼 있으나 이 서비스의 장소 목록(22곳)에 없어 뺐다(망상해수욕장과는 다른 곳).
 * 모양: id → { theme: 선정 주제(모르면 ''), checked: 확인한 날, how: 확인한 방법 }
 */
(function (root) {
  'use strict';
  var PICK100 = {
    bukpyeong: { theme: '', checked: '2026-10-21', how: '만끽 지도 동해시 화면(동해 북평민속시장)' }
  };
  var api = {
    list: PICK100,
    has: function (id) { return Object.prototype.hasOwnProperty.call(PICK100, id); },
    label: '100×100 선정',
    full: '한국관광공사 「대한민국 명소발굴 100×100」 국민 선정 명소',
    src: 'https://spot100x100.kr/map/'
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TourPick100 = api;
})(typeof window !== 'undefined' ? window : globalThis);
