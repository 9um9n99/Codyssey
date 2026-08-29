import os                          # 운영체제 관련 기능 (환경변수 읽기용)
from dotenv import load_dotenv     # .env 파일을 읽어오는 도구
import requests                    # 인터넷 요청 보내는 도구

load_dotenv()                      # .env 파일 내용을 읽어서 환경변수로 등록

API_KEY = os.getenv("OPENAI_API_KEY")   # .env에 적어둔 키 값을 꺼내옴
BASE_URL = "https://copa.codyssey.kr/v1"

response = requests.post(
    f"{BASE_URL}/chat/completions",     # 최종 주소: .../v1/chat/completions
    headers={"Authorization": f"Bearer {API_KEY}"},  # "나는 이 키를 가진 사람이다" 증명
    json={
        "model": "gpt-5-mini",
        "messages": [
            {"role": "user", "content": "안녕! 잘 연결됐는지 테스트야. 한 문장으로 대답해줘."}
        ]
    }
)

print(response.status_code)   # 200이면 성공, 401/403이면 인증 문제
print(response.json())        # 실제 응답 내용 출력