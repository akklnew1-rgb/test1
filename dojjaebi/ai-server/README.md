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
