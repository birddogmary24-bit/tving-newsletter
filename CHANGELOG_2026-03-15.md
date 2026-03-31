# 변경 및 진단 로그 — 2026-03-15

## 프로젝트 정보
- **GCP 프로젝트**: `tving-newsletter-service`
- **Cloud Run**: https://tving-newsletter-386944192020.asia-northeast3.run.app
- **Scheduler**: `tving-newsletter-daily` — 매일 07:30 KST, GET `/api/cron/send`
- **Firestore**: `(default)` DB, asia-northeast3
- **GitHub**: https://github.com/birddogmary24-bit/tving-newsletter
- **구독자**: 6명 활성

---

## 문제

TVING 뉴스레터가 2월 콘텐츠를 반복 발송.
- Firestore `last_article_id`가 `A00000145435` (2026-02-26)에서 정지
- 크롤러가 순차 탐색 시 연속 실패 임계치(20회)에 도달하여 최신 기사까지 도달 못함
- 매일 발송 자체는 성공(6명 전원)이지만 동일한 옛 기사를 반복 발송

---

## 완료된 작업

### 1. 크롤러 ID Gap 브릿지 수정 (`src/crawler.js`)
- 슬라이딩 윈도우 gap-bridging 알고리즘 도입
  - 100단위 점프 → ±10 윈도우 탐색 → 발견 시 리셋 반복 (최대 5000 ID)
  - `crawlTodayArticles()`와 `getLatestArticles()` 양쪽에 적용
  - window search에 `sleep(50)` 추가 (rate limit 방지)
  - `MAX_NOT_FOUND`: 20 → 30으로 완화

### 2. 테스트 발송 스크립트 수정 (`src/testSend.js`)
- 하드코딩된 옛 기사 ID(A00000137127~137129) → `getLatestArticles()` 사용으로 변경
- Firestore `initDatabase()` 호출 추가

### 3. Firestore 데이터베이스 ID 지원 (`src/database.js`)
- `FIRESTORE_DATABASE_ID` 환경변수 지원 추가 (non-default DB 지원)

### 4. Firestore `last_article_id` 업데이트
- `tving-newsletter-service` Firestore: A00000145435 → A00000160155 업데이트
- 이제 크롤러가 최신 위치에서 탐색 시작

### 5. 테스트 메일 발송 성공
- `tving-newsletter-service` 프로젝트에서 최신 3월 15일 기사 10개 수집 + 이메일 발송 완료

### 6. Cloud Run 배포 완료
- GitHub Actions `Deploy to Cloud Run` 워크플로 성공 (run #23112524386)
- 배포 후 헬스체크 정상: `{"status":"ok"}`

### 7. 환경 구성
- gcloud CLI 설치 및 인증
- 로컬 `.env` 파일 생성 (`tving-newsletter-service` 프로젝트 기준)

### 8. 오뉴 Firestore 정리
- 초기 작업 시 `opnionnewsletter` Firestore에 잘못 기록된 `last_article_id` 삭제

---

## 현재 상태

| 항목 | 상태 |
|------|------|
| Cloud Run 헬스체크 | 정상 (`{"status":"ok"}`) |
| Scheduler (`tving-newsletter-daily`) | 매일 07:30 KST, ENABLED |
| Firestore `last_article_id` | `A00000160155` (최신) |
| 최근 발송 (3/11~3/15) | 매일 6명 전원 성공, 17건 기사 |
| gap-bridging 코드 배포 | 완료 |

**내일(3/16) 07:30 KST부터 최신 기사로 자동 발송 예정.**

---

## 커밋

| 커밋 | 설명 |
|------|------|
| `bddc130` | fix: add exponential gap-bridging to crawler for stale article ID recovery |

---

## 참고: 초기 진단 오류
초기 작업 시 `opnionnewsletter` (오뉴) GCP 프로젝트를 분석하여 많은 문제를 발견했으나,
실제 TVING 뉴스레터는 별도 GCP 프로젝트 `tving-newsletter-service`에 정상 구성되어 있었음.
두 프로젝트는 별개이며, 리소스를 혼용하면 안 됨.
- **오뉴 (오피니언 뉴스레터)**: GCP `opnionnewsletter` — Next.js, YouTube 기반
- **TVING 뉴스레터**: GCP `tving-newsletter-service` — Express, TVING 뉴스 크롤러
