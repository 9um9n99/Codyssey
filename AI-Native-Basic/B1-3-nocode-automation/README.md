# B1-3: 노코드 자동화 기초

코딩 없이 반복 업무를 자동화하는 워크플로우를 설계·구현한 과제입니다.  
동일한 워크플로우를 2개 도구(Make, Zapier)로 비교 구현하고, 자유 주제로 나만의 자동화 파이프라인을 추가 설계하였습니다.

---

## 📁 폴더 구조

```
B1-3-nocode-automation/
├── README.md
├── project1/          # 자동화 도구 비교 구현 (Make vs Zapier)
│   ├── report.md
│   └── screenshots/
└── project2/          # 자유 주제 자동화 — 뉴스레터 토픽 알림
    ├── report.md
    └── screenshots/
```

---

## 📌 프로젝트 1 — 자동화 도구 비교 구현

**워크플로우**: 채용공고 관심도 자동 분류

```
Google Forms (Trigger)
 └─ 분기
     ├─ 경로 A: UX/UI/프로덕트 키워드 포함 → Sheets(관심공고) + Slack 알림
     └─ 경로 B: Fallback → Sheets(보류공고)
```

| 항목 | 내용 |
|---|---|
| 사용 도구 | Make (무료 플랜), Zapier (Professional 14일 체험) |
| Trigger | Google Forms — 새 응답 제출 |
| 조건 분기 | 공고 제목에 UX/UI/프로덕트/Product/PD 키워드 포함 여부 |
| Action | Google Sheets 기록 + Slack 알림 |

---

## 📌 프로젝트 2 — 자유 주제 자동화

**워크플로우**: 뉴스레터 토픽 자동 추출 및 Slack 알림

```
Gmail (Trigger)
 └─ Filter: 등록된 뉴스레터 발신자 여부
     ├─ 조건 충족 → AI by Zapier: 토픽 추출 → Slack (#소설) 전송
     └─ 조건 미충족 → 종료
```

| 항목 | 내용 |
|---|---|
| 사용 도구 | Zapier (Professional 14일 체험) |
| Trigger | Gmail — 새 메일 수신 |
| 조건 분기 | From Name contains `Uppity` OR `newneek` |
| Action | AI by Zapier 토픽 추출 + Slack 채널 메시지 전송 |
| 보너스 | AI 연동 Action 포함 (AI by Zapier) |

---

## 🛠 사용 도구

| 도구 | 용도 |
|---|---|
| Make | 프로젝트 1 구현 |
| Zapier | 프로젝트 1 비교 구현 + 프로젝트 2 구현 |
| Google Forms / Sheets | 데이터 수집 및 저장 |
| Gmail | 프로젝트 2 Trigger |
| Slack | 알림 전송 |
| AI by Zapier | 뉴스레터 토픽 추출 |
