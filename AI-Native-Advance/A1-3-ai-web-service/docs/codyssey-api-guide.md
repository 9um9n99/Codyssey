# Codyssey 공개 API 콘솔 연동 가이드

이 문서만 보고 순서대로 따라 하시면 Claude(Anthropic) API 연결이 끝나요.
각 단계마다 "이게 나오면 성공"을 같이 적어뒀으니, 그것만 확인하면서 진행하시면 돼요.

---

## 준비: 작업 폴더 열기

1. 아무 곳에나 새 폴더 하나 만들기 (예: 바탕화면에 `api-test` 폴더)
2. VS Code 실행 → **파일 → 폴더 열기** → 방금 만든 폴더 선택
3. 메뉴 **터미널 → 새 터미널** (단축키: `Ctrl` + `` ` ``)

앞으로 모든 명령어는 이 터미널 안에서 입력하시면 돼요.

---

## STEP 1. 콘솔에서 API 키 발급받기

1. 학습자 사이트에서 `/public-api-console` 접속
2. **"API 키"** 탭 → **"+ 키 발급"** 클릭 (Anthropic 호환)
3. 발급된 키를 메모장 등에 잠깐 복사해두기 (`sk-cody-live-...` 형태)

✅ **확인**: "API 키" 탭 목록에 방금 만든 키가 **"활성"** 상태로 보이면 성공.

---

## STEP 2. base_url 확인하기

같은 콘솔의 **"문서"** 탭 → 코드 예제에 나온 `Public API Base URL` 값을 그대로 복사해두세요.
(주소는 환경에 따라 다를 수 있으니, 반드시 콘솔에 표시된 값을 그대로 쓰세요.)

---

## STEP 3. 패키지 설치

터미널에 입력:
```bash
pip install anthropic
```

✅ **성공 결과**: `Successfully installed anthropic-x.x.x`
(이미 설치돼 있으면 `Requirement already satisfied` — 이것도 정상)

---

## STEP 4. `.env` 파일 만들기

VS Code에서 새 파일 생성 → 이름을 정확히 `.env`로 저장. 안에 이렇게 입력:

```
ANTHROPIC_API_KEY=발급받은_키를_여기에_붙여넣기
ANTHROPIC_BASE_URL=STEP2에서_복사한_주소
```

✅ **확인**: 터미널에 아래 입력했을 때 방금 적은 두 줄이 그대로 출력되면 성공.
```bash
cat .env
```

---

## STEP 5. `.gitignore`에 `.env` 등록

이 프로젝트를 GitHub에 올릴 계획이 있다면, `.gitignore` 파일을 만들고 이 한 줄 추가:
```
.env
```
(키가 실수로 GitHub에 올라가는 걸 막아줘요. 개인 테스트용이면 이 단계는 생략해도 돼요.)

---

## STEP 6. 연결 테스트 코드 작성

새 파일 `test.py`를 만들고 아래 내용을 그대로 붙여넣기:

```python
import os
from anthropic import Anthropic

api_key = os.environ.get("ANTHROPIC_API_KEY")
base_url = os.environ.get("ANTHROPIC_BASE_URL")

client = Anthropic(
    api_key=api_key,
    base_url=base_url,
    default_headers={"Authorization": f"Bearer {api_key}"},
)

message = client.messages.create(
    model="claude-sonnet-4",  # 콘솔의 "모델별 차감 가중치" 표에서 정확한 이름 확인
    max_tokens=100,
    messages=[{"role": "user", "content": "안녕이라고만 대답해줘."}],
)

print(message.content[0].text)
```

---

## STEP 7. 실행하기

터미널에 입력:
```bash
export $(cat .env | xargs) && python3 test.py
```

✅ **성공 결과**: 터미널에 실제 문장이 출력돼요.
```
안녕하세요!
```

❌ **실패했을 때 뜨는 화면과 뜻**:

| 화면에 뜨는 것 | 원인 |
|---|---|
| `authentication_error` / `Authentication is required` | 키 또는 base_url이 잘못됨 (STEP 1, 2 다시 확인) |
| `Failed to connect` | base_url 주소 자체가 틀림 |
| `invalid_request_error` | 모델명이 콘솔에서 지원 안 하는 이름 |
| `Traceback (most recent call last):`로 시작하는 빨간 글씨 | 맨 아래 줄에 구체적인 에러 종류가 적혀있음 |

**핵심 하나만 기억하기**: 결과에 `"text"`나 실제 문장이 보이면 성공, `"error"`라는 단어가 보이면 아직 안 된 거예요.

---

## STEP 8. 실제 프로젝트에 연결하기

STEP 7까지 성공했다면, 이 `test.py`의 로직을 실제 백엔드 코드(예: 웹 서비스의 API 엔드포인트)에
그대로 옮겨서 쓰면 돼요. 프론트엔드에서는 그 백엔드 주소를 이렇게 호출하면 됩니다:

```javascript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: '사용자 입력' }),
});

const data = await response.json();
console.log(data);
```

⚠️ API 키는 절대 프론트엔드(JavaScript) 코드에 직접 넣지 마세요. 항상 `.env` → 백엔드 코드에서만 다뤄야 해요.

---

## 체크리스트

- [ ] STEP 1: 콘솔에서 키 발급 + "활성" 확인
- [ ] STEP 2: base_url 정확히 복사
- [ ] STEP 3: `anthropic` 패키지 설치 확인
- [ ] STEP 4: `.env` 파일 내용 확인 (`cat .env`)
- [ ] STEP 5: `.gitignore`에 `.env` 등록 (GitHub 쓸 경우)
- [ ] STEP 7: `python3 test.py` 실행 → 실제 문장 출력 확인
- [ ] STEP 8: 실제 프로젝트 코드로 이식
