# STAR SWARM

ASP.NET Core(.NET 8) 풀스택으로 만든 **고전 아케이드 스타일 고정 화면 슈팅 게임**입니다.
그래픽, 사운드, 이름은 모두 이 프로젝트를 위해 새로 만든 오리지널이에요.

## 실행
```bash
cd src/StarSwarm
dotnet run
# 터미널에 표시된 주소(예: http://localhost:5000)를 브라우저로 열기
```

## 조작
| 키 | 동작 |
|---|---|
| ← → | 이동 |
| SPACE / Z | 발사 (화면에 최대 2발) |
| ENTER | 시작 |
| P / M | 일시정지 / 소리 끄기 |

모바일에서는 화면 아래 터치 버튼으로 조작해요.

## 게임 시스템
- 5개 웨이브로 입장 → 40기 편대(플래그십 4 · 호위기 16 · 드론 20). 편대는 좌우로 흔들리다가 숨쉬듯 넓어졌다 좁아져요.
- 급강하 공격과 조준 사격이 있고, 플래그십은 2발을 맞아야 격추돼요(1발 맞으면 색이 바뀌어요).
- **트랙터 빔**: 플래그십이 내 전투기를 납치해요 → 그 플래그십을 급강하 중에 격추하면 전투기를 구출 → **듀얼 파이터**(화력 2배)
- 호위기를 거느린 플래그십을 격추하면 400 / 800 / 1600점
- 3, 7, 11… 스테이지는 **챌린징 스테이지**(40기를 모두 격추하면 PERFECT 보너스 10000점)
- 20000점, 70000점, 이후 70000점마다 보너스 전투기
- 게임 오버 후 명중률 결과 화면 → **기록을 저장할지 질문** → YES면 영문 닉네임(1~12자) 입력 → Supabase 랭킹에 저장

## 구조
- `src/StarSwarm/Program.cs` — 게임 파일을 제공하는 정적 웹 서버
- 랭킹 — 브라우저가 Supabase(`public.scores` 테이블)에 직접 저장·조회. 보안 규칙(RLS)으로 **읽기·추가만 허용**하고 수정·삭제는 막혀 있어요
- `scripts/build_web.py` — HTML 한 장짜리 버전 생성 (`web/index.html`: GitHub Pages, `web/star-swarm.html`: Claude 아티팩트)
- `scripts/verify_game.js` — 요구사항 자동 검증 (`node scripts/verify_game.js`, playwright 필요)
- `src/StarSwarm/wwwroot/game.js` — Canvas 게임 엔진(60fps 고정 루프, WebAudio로 합성한 효과음)
