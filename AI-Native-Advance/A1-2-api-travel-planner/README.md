# 국내 여행지 추천 프로그램

날짜를 입력하면 LLM이 여행지를 추천하고, 지도 API로 맛집을 검색해 최종 리포트를 생성하는 CLI 프로그램입니다.

## 실행 방법

\`\`\`bash
pip3 install requests python-dotenv
python3 travel_planner.py --date "2026-03-15"
\`\`\`

## API 키 설정 방법

프로젝트 루트에 `.env` 파일을 만들고 아래 내용을 채워주세요.

\`\`\`
OPENAI_API_KEY=발급받은_OpenAI_계열_키
KAKAO_API_KEY=발급받은_Kakao_REST_API_키
\`\`\`

- OpenAI 계열 키: Codyssey 공개 API 콘솔(`/public-api-console`)에서 발급
- Kakao 키: [Kakao Developers](https://developers.kakao.com)에서 앱 생성 후 REST API 키 발급, "카카오맵" 사용 설정을 켜야 합니다.

**⚠️ 주의: `.env` 파일은 절대 GitHub에 올리지 마세요.** (`.gitignore`에 이미 등록되어 있습니다.)

## 결과 확인 방법

프로그램 실행 후 `results/` 폴더에 아래 두 파일이 생성됩니다.
- `{날짜}_travel_plan.json`: 1차 추천 원본 데이터 + 맛집 검색 결과 + 오류 요약
- `{날짜}_travel_plan.md`: 최종 여행 리포트

## 사용 API

- LLM: OpenAI 계열 (Codyssey 공개 API 콘솔의 OpenAI 호환 엔드포인트, 모델: gpt-5-mini)
- 지도/장소 검색: Kakao Local API

## 보너스: 결과 캐싱
같은 --date로 재실행 시, results/ 폴더에 이미 저장된 JSON이 있으면 API 호출(LLM 1차 추천, 맛집 검색)을 건너뛰고 저장된 데이터로 리포트만 재생성합니다.