# 도째비 인공지능 중계 함수

앱(정적 페이지)이 제미나이를 직접 부르면 열쇠가 노출되므로, 이 함수가 중간에서 대신 부른다.

## 올리는 방법 (본인 Vercel 계정, 한 번만)
1. Vercel 에서 New Project → 이 저장소 선택 → **Root Directory 를 `dojjaebi/ai-server`** 로 지정.
2. Environment Variables 에 `GEMINI_API_KEY` = (Google AI Studio 에서 받은 열쇠) 를 넣는다. **열쇠는 코드·채팅에 적지 않는다.**
3. (선택) `ALLOW_ORIGINS` = 앱 주소들을 쉼표로. 기본: 본인 GitHub 페이지·팀 Vercel·localhost:8765.
4. 배포가 끝나면 주소(예: `https://xxx.vercel.app/api/ai`)를 `tour-design/ai-config.js` 의 `window.DOJJAEBI_AI_URL` 에 넣고 커밋.

## 동작
- `task:'edit'` 말 → 명령(remove/add/indoor/slower…) 번역. 모델이 만든 장소 id 는 목록과 대조해 버림.
- `task:'explain'` 코스 사실 → 3~4문장 설명.
- 실패·시간 초과(앱 쪽 4초)면 앱이 기존 규칙 방식으로 자동 복귀.
- 주소별 분당 20번 제한, 허용 주소 밖은 403.

## 날씨 (api/weather.js)
공공데이터포털 "기상청_단기예보 ((구)동네예보) 조회서비스"의 초단기실황·초단기예보를 합쳐 `{ temp, sky, pty, text, wind, rain1h, baseTime }` 로 돌려준다.
- 환경변수 `KMA_KEY` 에 서비스키(일반 인증키 Decoding/Encoding 어느 쪽이든 가능)를 넣고 재배포한다. 앱 코드에는 열쇠를 넣지 않는다.
- 격자는 동해시청 근처(위도 37.5247, 경도 129.1143) → nx 97, ny 127 로 코드에서 계산한다.
- 열쇠가 없거나 아직 승인 전이면 `{ error }` 를 돌려주고 앱은 날씨 칸을 숨긴다. 같은 값은 5분간 다시 쓴다.
