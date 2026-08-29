import argparse                    # 터미널 입력값(--date 등)을 받는 도구
from datetime import datetime      # 날짜 형식이 올바른지 검증하는 도구
import sys                         # 프로그램을 즉시 종료시키는 도구
import os
import json                        # 문자열 ↔ 파이썬 딕셔너리 변환 도구
from dotenv import load_dotenv
import requests

load_dotenv()
API_KEY = os.getenv("OPENAI_API_KEY")
KAKAO_API_KEY = os.getenv("KAKAO_API_KEY")
BASE_URL = "https://copa.codyssey.kr/v1"

def parse_arguments():
    parser = argparse.ArgumentParser(
        description="날짜를 입력하면 국내 여행지를 추천해주는 프로그램"
    )
    parser.add_argument(
        "--date",
        required=True,              # 필수 옵션 (안 주면 자동으로 에러 처리됨)
        help="여행 날짜 (형식: YYYY-MM-DD, 예: 2026-03-15)"
    )
    return parser.parse_args()

def validate_date(date_str):
    """날짜 형식이 YYYY-MM-DD인지 확인. 아니면 프로그램 종료."""
    try:
        datetime.strptime(date_str, "%Y-%m-%d")   # 이 형식으로 "해석해봐"라고 시도
        return date_str
    except ValueError:
        print(f"❌ 날짜 형식이 올바르지 않습니다: {date_str}")
        print("사용법: python3 travel_planner.py --date \"YYYY-MM-DD\"")
        sys.exit(1)   # 프로그램을 여기서 즉시 종료

def get_recommendation(date_str):
    """날짜를 받아서 LLM에게 여행지 추천을 요청하고, JSON으로 파싱해서 반환"""

    prompt = f"""
{date_str}에 여행하기 좋은 국내 지역을 1곳 추천해줘.
반드시 아래 키만 포함한 JSON 객체로만 답변하고, 다른 설명은 절대 붙이지 마.
코드블록(```) 표시도 절대 쓰지 말고, 순수 JSON 텍스트만 출력해.

{{
  "recommended_city": "도시명 (예: 제주)",
  "weather": "해당 시기 일반적 날씨 요약 (한 문장)",
  "events": ["행사/축제 후보1", "행사/축제 후보2"],
  "reason": "추천 근거 2~4문장"
}}
"""

    for attempt in range(2):   # 0번째 = 1차 시도, 1번째 = 재시도 1회
        try:
            response = requests.post(
                f"{BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {API_KEY}"},
                json={
                    "model": "gpt-5-mini",
                    "messages": [{"role": "user", "content": prompt}]
                }
            )
            content = response.json()["choices"][0]["message"]["content"]
            return json.loads(content)   # 성공하면 바로 함수 끝내고 반환

        except json.JSONDecodeError:
            if attempt == 0:
                print("  ⚠️ JSON 파싱 실패, 재시도 중...")
                prompt = "이전 응답이 JSON 형식이 아니었습니다. 반드시 순수 JSON 객체만, 다른 설명 없이 다시 출력해주세요: " + prompt
            else:
                print("  ❌ JSON 파싱 재시도도 실패. 기본값으로 진행합니다.")
                return {
                    "recommended_city": "정보 없음",
                    "weather": "정보 없음",
                    "events": [],
                    "reason": "LLM 응답 파싱 실패"
                }

        except requests.exceptions.RequestException as e:
            print(f"  ❌ 네트워크 오류로 추천 생성 실패: {e}")
            return {
                "recommended_city": "정보 없음",
                "weather": "정보 없음",
                "events": [],
                "reason": "네트워크 오류로 LLM 호출 실패"
            }

def search_restaurants(city_name):
    """도시 이름으로 맛집 5곳을 검색. 실패하거나 0건이면 빈 리스트 반환."""
    errors = []

    try:
        response = requests.get(
            "https://dapi.kakao.com/v2/local/search/keyword.json",
            headers={"Authorization": f"KakaoAK {KAKAO_API_KEY}"},
            params={
                "query": f"{city_name} 맛집",
                "size": 5
            }
        )

        if response.status_code == 401 or response.status_code == 403:
            errors.append({"step": "place_search", "type": "AUTH_ERROR", "message": f"HTTP {response.status_code}"})
            return [], errors

        data = response.json()
        documents = data.get("documents", [])

        if len(documents) == 0:
            errors.append({"step": "place_search", "type": "EMPTY_RESULT", "message": f"0 results for query={city_name} 맛집"})
            return [], errors

        restaurants = []
        for place in documents:
            restaurants.append({
                "name": place["place_name"],
                "address": place["address_name"],
                "category": place.get("category_name", ""),
                "url": place.get("place_url", ""),
                "x": place.get("x"),
                "y": place.get("y")
            })

        return restaurants, errors

    except requests.exceptions.RequestException as e:
        errors.append({"step": "place_search", "type": "NETWORK_ERROR", "message": str(e)})
        return [], errors

def build_restaurant_text(restaurants):
    """맛집 리스트를 프롬프트에 넣기 좋은 텍스트로 변환. 0건이면 안내 문구 반환."""
    if not restaurants:
        return "맛집 정보 없음 (검색 결과 0건 또는 API 오류)"

    lines = []
    for r in restaurants:
        lines.append(f"- {r['name']} ({r['category']}) / 주소: {r['address']}")
    return "\n".join(lines)


def generate_report(date_str, recommendation, restaurants):
    """1차 추천 + 맛집 리스트를 받아 최종 Markdown 리포트를 생성"""

    restaurant_text = build_restaurant_text(restaurants)
    events_text = ", ".join(recommendation.get("events", []))

    prompt = f"""
아래 정보를 바탕으로 국내 여행 추천 리포트를 Markdown 형식으로 작성해줘.
다른 설명 없이 Markdown 본문만 출력하고, 코드블록(```) 표시는 쓰지 마.

[여행 날짜] {date_str}
[추천 지역] {recommendation.get('recommended_city')}
[추천 이유] {recommendation.get('reason')}
[날씨 요약] {recommendation.get('weather')}
[행사/축제] {events_text}
[맛집 목록]
{restaurant_text}

리포트는 아래 섹션을 반드시 포함해줘:
## 추천 지역
## 추천 이유
## 날씨 요약
## 행사/축제
## 맛집 추천
## 1일 일정 제안 (오전/오후/저녁)
"""

    try:
        response = requests.post(
            f"{BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {API_KEY}"},
            json={
                "model": "gpt-5-mini",
                "messages": [{"role": "user", "content": prompt}]
            }
        )
        return response.json()["choices"][0]["message"]["content"]
    except requests.exceptions.RequestException as e:
        print(f"  ❌ 네트워크 오류로 리포트 생성 실패: {e}")
        return f"# 리포트 생성 실패\n\n네트워크 오류로 최종 리포트를 생성하지 못했습니다: {e}"

def load_cached_data(date_str):
    """이미 저장된 원본 JSON이 있으면 읽어서 반환, 없으면 None 반환"""
    json_path = f"results/{date_str}_travel_plan.json"

    if os.path.exists(json_path):
        with open(json_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return None

def save_results(date_str, recommendation, restaurants, place_errors, report):
    """원본 JSON과 최종 리포트를 results/ 폴더에 저장"""

    os.makedirs("results", exist_ok=True)   # results 폴더가 없으면 생성, 있으면 그냥 넘어감

    # 1) 원본 데이터 JSON 저장
    raw_data = {
        "recommendation": recommendation,
        "restaurants": restaurants,
        "errors": place_errors
    }
    json_path = f"results/{date_str}_travel_plan.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(raw_data, f, ensure_ascii=False, indent=2)

    # 2) 최종 리포트 Markdown 저장
    md_path = f"results/{date_str}_travel_plan.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(report)

    return json_path, md_path

def main():
    args = parse_arguments()
    travel_date = validate_date(args.date)

    if not API_KEY:
        print("❌ OPENAI_API_KEY가 설정되지 않았습니다.")
        print("   .env 파일에 OPENAI_API_KEY=발급받은_키 형식으로 추가해주세요.")
        sys.exit(1)

    if not KAKAO_API_KEY:
        print("❌ KAKAO_API_KEY가 설정되지 않았습니다.")
        print("   .env 파일에 KAKAO_API_KEY=발급받은_키 형식으로 추가해주세요.")
        sys.exit(1)

    print(f"✅ 입력된 날짜: {travel_date}")

    cached = load_cached_data(travel_date)   # ← 여기 추가!

    if cached:
        print("📦 캐시된 데이터 발견! API 호출을 건너뜁니다.")
        recommendation = cached["recommendation"]
        restaurants = cached["restaurants"]
        place_errors = cached["errors"]
    else:
        print("[1/3] 1차 추천 생성 중(LLM)...")
        recommendation = get_recommendation(travel_date)
        print(f"  - recommended_city: {recommendation['recommended_city']}")

        print("[2/3] 맛집 검색 중(지도/장소 API)...")
        restaurants, place_errors = search_restaurants(recommendation['recommended_city'])
        if restaurants:
            print(f"  - 맛집 {len(restaurants)}곳 검색 완료")
        else:
            print("  - 검색 결과 0건 또는 오류 발생, '데이터 없음'으로 진행")

    print("[3/3] 최종 리포트 생성 중(LLM)...")
    report = generate_report(travel_date, recommendation, restaurants)
    print("  - 리포트 생성 완료")

    json_path, md_path = save_results(travel_date, recommendation, restaurants, place_errors, report)
    print(f"\n완료! {md_path} 를 확인하세요.")

if __name__ == "__main__":
    main()