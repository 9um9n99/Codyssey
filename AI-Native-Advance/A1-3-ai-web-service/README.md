# 조각조각 🥒

막막한 목표를 **오이 한 개**처럼 생각하고, AI 보조셰프 **조각이**가 실행 가능한 단계(조각)로 잘게 썰어주는 서비스예요.
사용자(헤드 셰프)가 조각을 하나씩 조리(체크)하다가 전부 끝내면, 25가지 오이 요리 중 하나가 완성되어 **레시피북**에 모여요.

- 배포 URL: `https://(배포 후 여기에 채우기).vercel.app`
- 과제: Codyssey "AI 웹 개발" 미션

## 주요 기능

| 페이지 | 파일 | 하는 일 |
| --- | --- | --- |
| 조각내기 (홈) | `index.html` | 목표 + 기한 입력 → AI가 단계로 나눔 → 조각별 일수 조정 → 저장. 아래에 사용법·서비스 소개(아코디언) |
| 조리하기 | `calendar.html` | 월간 캘린더 + 목표별 진행 현황, 조각 체크, 완성 시 축하 팝업 |
| 나의요리 | `record.html` | 완성/진행 중 요리 목록, 체크리스트, 25칸 레시피북(레어 요리 3종 포함) |

## 기술 스택

- 프론트엔드: 순수 HTML / CSS / JavaScript (프레임워크 없음), 데이터는 브라우저 `localStorage`(`jogak-plans`)
- 백엔드: Vercel Serverless Function (Python) — `api/chop.py`
- AI: Codyssey 공개 API 콘솔의 Anthropic 호환 API (`claude-sonnet-4`)
- 배포: GitHub → Vercel

## AI 기능은 어떻게 동작하나요?

1. 브라우저(`js/cutting.js`)가 `POST /api/chop` 으로 `{ "goal": "...", "days": 7 }` 를 보냅니다.
2. `api/chop.py` 가 환경 변수의 API 키로 Claude를 호출합니다. (키는 브라우저에 절대 내려가지 않아요)
3. Claude가 목표의 성격을 판단해 `[{"title": "..."}, ...]` 형태의 JSON 단계 목록을 돌려줍니다.
4. 실패하면(키 누락, 시간 초과, 응답 형식 오류) 화면에 안내 문구가 뜨고 다시 시도할 수 있어요. (20초 타임아웃)

## 폴더 구조

```
.
├── index.html / calendar.html / record.html
├── css/style.css
├── js/        main.js(공통) index.js cutting.js calendar.js record.js
├── api/chop.py            # AI 호출 서버리스 함수
├── images/                # 일러스트, dishes/ 에 요리 25장
├── docs/                  # 서비스 기획서, API 가이드
├── requirements.txt       # anthropic
├── vercel.json            # {"framework": null}
└── .env                  # (로컬 전용, 커밋 안 됨)
```

## 환경 변수

코드에 키를 적지 않고 **환경 변수**로만 넣어요.

| 이름 | 값 |
| --- | --- |
| `ANTHROPIC_API_KEY` | Codyssey API 콘솔에서 발급한 키 |
| `ANTHROPIC_BASE_URL` | `https://copa.codyssey.kr` |

- 로컬: 프로젝트 루트에 `.env` 파일을 만들어 위 두 줄을 `이름=값` 형태로 적기 (`.gitignore` 로 커밋 제외됨)
- 배포: Vercel 프로젝트 → Settings → Environment Variables 에 같은 두 개 추가 후 **재배포**

## 로컬 실행

```bash
cd ~/Desktop/Codyssey/AI-Native-Advance/A1-3-ai-web-service
npx vercel dev
```

브라우저에서 `http://localhost:3000` 으로 접속하세요. (`index.html` 을 더블클릭해서 열면 `/api/chop` 이 동작하지 않아요.)

## 배포

1. GitHub 저장소에 push
2. Vercel에서 저장소 Import (프로젝트 루트가 저장소 하위 폴더라면 Root Directory 지정, Framework Preset은 `Other`)
3. 환경 변수 2개 등록 → Deploy
4. 배포 URL에서 조각내기 → 조리하기 → 나의요리 흐름 확인

## 문서

- [서비스 기획서](docs/service-plan.md)
- [Codyssey API 연동 가이드](docs/codyssey-api-guide.md)
