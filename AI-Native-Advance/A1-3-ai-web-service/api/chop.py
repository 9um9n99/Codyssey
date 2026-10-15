# api/chop.py
# Vercel Serverless Function (Python) — 목표를 조각으로 쪼개는 AI 기능의 백엔드.
#
# 프론트엔드(js/cutting.js)가 fetch('/api/chop', { method: 'POST', body: { goal, days } })로
# 이 엔드포인트를 호출하면, Claude API로 실제 분석해서 조각을 만들어 돌려줍니다.
#
# 요청 형식: {"goal": "...", "days": 7, "attachments": [{"kind":"image","mediaType":"image/jpeg","data":"<base64>"}, {"kind":"text","name":"..","text":".."}]}
#   (attachments는 선택. 이미지는 최대 3개, 텍스트는 글자로 프롬프트에 붙여서 보냄)
# 응답 형식: {"pieces": [{"title": "..."}, ...], "notice": "(선택) 안내 문구"}
# (예전엔 조각마다 "며칠 걸릴지"까지 AI가 정했지만, 기한이 짧으면(예: 1일) 조각을
#  억지로 하나만 만들어야 하는 문제가 있었음. 그래서 지금은 AI는 순서 있는
#  단계 목록만 주고, "몇 일차에 할지"는 프론트엔드에서 사용자가 직접 정함.)
#
# 필요한 환경 변수 (Vercel 대시보드 또는 로컬 .env에 설정):
#   ANTHROPIC_API_KEY   - 필수. Codyssey 공개 API 콘솔에서 발급받은 Anthropic 호환 키.
#   ANTHROPIC_BASE_URL  - 필수. Codyssey 콘솔에서 안내한 호출 주소(엔드포인트).

import json
import os
from http.server import BaseHTTPRequestHandler

from anthropic import Anthropic

# Codyssey 공개 API 콘솔에서 지원하는 모델명 (콘솔의 "모델별 차감 가중치" 표 기준)
MODEL_NAME = "claude-sonnet-4"

PROMPT_INSTRUCTIONS = """당신은 사용자의 막연한 목표를 실행 가능한 단계(조각)로 쪼개주는 "보조셰프 조각이"입니다.

규칙:
1. 목표의 성격을 스스로 판단하세요 (디자인 작업? 이사/정리? 학습? 문서 작성? 운동? 등)
2. 판단한 성격에 맞는 논리적인 흐름으로 단계를 구성하세요.
   예) 디자인 작업 -> 리서치 - 문제 정의 - 컨셉/설계 - 제작 - 검증 - 문서화
   예) 이사 준비 -> 정리/처분 - 업체 예약 - 포장 - 이사 당일 - 정착/신고
3. 조각(단계) 개수는 입력받은 기한(일수)에 비례해서 정하세요. 기한이 짧아도(예: 1일)
   그 안에서 실제로 나눠서 진행할 만한 의미 있는 단계라면 2~3개로 쪼개도 좋습니다
   (같은 날 안에서 순서대로 처리하는 여러 단계여도 괜찮습니다).
   - 1~3일: 2~3조각
   - 4~9일: 4~6조각
   - 10~20일: 7~9조각
   - 21일 이상: 10조각
4. 각 조각은 "구체적인 행동" 하나로 작성하고(예: "경쟁 서비스 3곳 리서치하기"),
   "디자인하기"처럼 애매한 표현은 피하세요.
5. 순서는 반드시 논리적인 흐름을 따르게 하세요.
   (몇 일차에 할지는 신경 쓰지 마세요 — 그건 사용자가 화면에서 직접 정합니다.)
6. 사용자가 첨부한 이미지나 글이 있다면, 거기서 현재 진행 상황·범위·조건을 읽어서
   이미 끝난 일은 빼고 남은 일 중심으로 단계를 구체적으로 만드세요.

응답은 반드시 아래와 같은 JSON 배열만 출력하세요.
인사말, 설명, 마크다운 코드블록 없이 순수 JSON 텍스트만 출력해야 합니다:
[{"title": "1단계 설명"}, {"title": "2단계 설명"}]
"""


def build_prompt(goal, days):
    # Codyssey 콘솔 예시 코드가 system 파라미터 없이 user 메시지 하나만 쓰는 구조였어서,
    # 최대한 그 구조와 똑같이 맞추기 위해 규칙 설명 + 실제 입력값을 하나의 문자열로 합친다.
    return f"{PROMPT_INSTRUCTIONS}\n\n목표: {goal}\n기한: {days}일"


MAX_IMAGES = 3
MAX_TEXT_FILES = 3
MAX_TEXT_CHARS = 12000
MAX_IMAGE_BASE64_CHARS = 1_800_000  # 이미지 한 장당 약 1.3MB (Vercel 요청 크기 한도 4.5MB 안에서 3장)
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


def clean_attachments(raw):
    """프론트에서 온 첨부를 안전하게 걸러서 (이미지 목록, 텍스트 목록)으로 돌려준다."""
    images, texts = [], []
    if not isinstance(raw, list):
        return images, texts

    for item in raw[:6]:
        if not isinstance(item, dict):
            continue
        if item.get("kind") == "image" and len(images) < MAX_IMAGES:
            media_type = item.get("mediaType")
            data = item.get("data")
            if media_type in ALLOWED_IMAGE_TYPES and isinstance(data, str) and 0 < len(data) <= MAX_IMAGE_BASE64_CHARS:
                images.append({"mediaType": media_type, "data": data})
        elif item.get("kind") == "text" and len(texts) < MAX_TEXT_FILES:
            text = str(item.get("text", ""))[:MAX_TEXT_CHARS].strip()
            if text:
                texts.append({"name": str(item.get("name", "메모"))[:80], "text": text})
    return images, texts


def build_content(goal, days, images, texts):
    """Claude에 보낼 메시지 content를 만든다. 첨부가 없으면 예전처럼 글 하나만 보낸다."""
    prompt = build_prompt(goal, days)
    for text_file in texts:
        prompt += f"\n\n[첨부 글: {text_file['name']}]\n{text_file['text']}"

    if not images:
        return prompt

    blocks = [
        {"type": "image", "source": {"type": "base64", "media_type": img["mediaType"], "data": img["data"]}}
        for img in images
    ]
    blocks.append({"type": "text", "text": prompt})
    return blocks


def call_claude(client, content):
    message = client.messages.create(
        model=MODEL_NAME,
        max_tokens=1024,
        messages=[{"role": "user", "content": content}],
    )
    return parse_pieces(message.content[0].text.strip())


def chop_goal(goal, days, attachments=None):
    """(조각 목록, 안내 문구)를 돌려준다."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    base_url = os.environ.get("ANTHROPIC_BASE_URL")

    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY 환경 변수가 설정되어 있지 않습니다.")
    if not base_url:
        raise RuntimeError("ANTHROPIC_BASE_URL 환경 변수가 설정되어 있지 않습니다.")

    client = Anthropic(
        api_key=api_key,
        base_url=base_url,
        # 콘솔 예시 코드가 전부 Authorization: Bearer 방식이라, 혹시 몰라 같이 보냄
        default_headers={"Authorization": f"Bearer {api_key}"},
    )

    images, texts = clean_attachments(attachments)

    try:
        return call_claude(client, build_content(goal, days, images, texts)), ""
    except Exception:
        # 이미지를 보냈다가 실패했다면, 이 API가 이미지를 못 읽는 걸 수 있으니 글만으로 한 번 더 시도
        if not images:
            raise
        pieces = call_claude(client, build_content(goal, days, [], texts))
        return pieces, "이미지는 읽지 못해서 입력한 글만으로 나눴어요."


def parse_pieces(raw_text):
    """Claude 응답에서 JSON 배열을 최대한 안전하게 뽑아낸다."""
    text = raw_text.strip()

    # ```json ... ``` 처럼 코드블록으로 감싸서 응답한 경우 벗겨내기
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # 혹시 앞뒤에 다른 텍스트가 섞였다면, 첫 '['부터 마지막 ']'까지만 추출해서 재시도
        start = text.find("[")
        end = text.rfind("]")
        if start != -1 and end != -1:
            return json.loads(text[start:end + 1])
        raise


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body or b"{}")

            goal = str(data.get("goal", "")).strip()
            days = int(data.get("days", 0) or 0)

            if not goal or days < 1:
                self._send_json(400, {"error": "goal과 days(1 이상)를 함께 보내주세요."})
                return

            pieces, notice = chop_goal(goal, days, data.get("attachments"))
            payload = {"pieces": pieces}
            if notice:
                payload["notice"] = notice
            self._send_json(200, payload)

        except RuntimeError as e:
            self._send_json(500, {"error": str(e)})
        except Exception as e:
            # AI 서버가 돌려준 HTTP 상태(401 키 오류, 429 한도 등)를 프론트에 같이 알려줘서 원인을 바로 알 수 있게 함
            upstream_status = getattr(e, "status_code", None)
            self._send_json(502, {
                "error": f"{type(e).__name__}: {str(e)[:200]}",
                "upstream_status": upstream_status,
            })

    def _send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
