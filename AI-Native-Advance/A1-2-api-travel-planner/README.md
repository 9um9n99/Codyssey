# 국내 여행지 추천 프로그램

날짜를 입력하면 LLM이 여행지를 추천하고, 지도 API로 맛집을 검색해 최종 리포트를 생성하는 CLI 프로그램입니다.

## 실행 방법

```bash
pip3 install requests python-dotenv
python3 travel_planner.py --date "2026-03-15"
```

## API 키 설정 방법

프로젝트 루트에 `.env` 파일을 만들고 아래 내용을 채워주세요.

```
OPENAI_API_KEY=발급받은_OpenAI_계열_키
KAKAO_API_KEY=발급받은_Kakao_REST_API_키
```

- OpenAI 계열 키: Codyssey 공개 API 콘솔(`/public-api-console`)에서 발급
- Kakao 키: [Kakao Developers](https://developers.kakao.com)에서 앱 생성 후 REST API 키 발급, "카카오맵" 사용 설정을 켜야 합니다.

**⚠️ 주의: `.env` 파일은 절대 GitHub에 올리지 마세요.** (`.gitignore`에 이미 등록되어 있습니다.)

`.env`를 버전 관리(Git)에서 제외하는 이유는, 키가 코드와 함께 저장소 히스토리에 영구히 남으면 저장소를 지운 뒤에도 과거 커밋 기록을 통해 유출될 수 있고, 협업 시 실수로 공개 저장소에 올라갈 위험이 있기 때문입니다. 실제 서비스로 배포할 때는 `.env` 파일 대신 배포 환경(예: GitHub Actions Secrets, 서버의 환경변수 설정)에 키를 등록해 코드와 완전히 분리하는 방식을 권장합니다.

## 결과 확인 방법

프로그램 실행 후 `results/` 폴더에 아래 두 파일이 생성됩니다.
- `{날짜}_travel_plan.json`: 1차 추천 원본 데이터 + 맛집 검색 결과 + 오류 요약
- `{날짜}_travel_plan.md`: 최종 여행 리포트 (오류 요약 섹션 포함)

## 사용 API

- LLM: OpenAI 계열 (Codyssey 공개 API 콘솔의 OpenAI 호환 엔드포인트, 모델: gpt-5-mini)
  - 요청 방식: **POST** — 프롬프트(질문 내용)를 요청 본문(body)에 실어 보내야 하므로 POST를 사용합니다.
  - 엔드포인트 예시: `https://copa.codyssey.kr/v1/chat/completions`
- 지도/장소 검색: Kakao Local API
  - 요청 방식: **GET** — 검색어 하나만 전달하면 되고, 서버 상태를 바꾸는 요청이 아니므로 GET을 사용합니다.
  - 엔드포인트 예시: `https://dapi.kakao.com/v2/local/search/keyword.json?query=제주+맛집`

## 보너스: 결과 캐싱
같은 --date로 재실행 시, results/ 폴더에 이미 저장된 JSON이 있으면 API 호출(LLM 1차 추천, 맛집 검색)을 건너뛰고 저장된 데이터로 리포트만 재생성합니다.
