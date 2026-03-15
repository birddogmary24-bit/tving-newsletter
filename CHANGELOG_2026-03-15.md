# 변경 및 진단 로그 — 2026-03-15

## 완료된 작업

### 1. 크롤러 ID Gap 브릿지 수정 (`src/crawler.js`)
- **문제**: `last_article_id` (A00000142400)와 최신 기사 사이에 큰 ID 공백 발생
- **원인**: 며칠간 기사 미수집 → 순차 탐색 시 연속 실패 임계치(20회)에 도달 → 2월 기사 반복 수집
- **해결**: 슬라이딩 윈도우 gap-bridging 알고리즘 도입
  - 100단위 점프 → ±10 윈도우 탐색 → 발견 시 리셋 반복
  - `crawlTodayArticles()`와 `getLatestArticles()` 양쪽에 적용
  - window search에 `sleep(50)` 추가 (rate limit 방지)
  - `MAX_NOT_FOUND`: 20 → 30으로 완화
- **결과**: A00000142400 → A00000160144로 gap 브릿지 성공 (약 17,744 ID 간격)

### 2. 테스트 발송 스크립트 수정 (`src/testSend.js`)
- 하드코딩된 옛 기사 ID → `getLatestArticles()` 사용으로 변경
- Firestore `initDatabase()` 호출 추가

### 3. Firestore 데이터베이스 ID 지원 (`src/database.js`)
- `FIRESTORE_DATABASE_ID` 환경변수 지원 추가 (non-default DB: `opinionnewsletterdb`)

### 4. 테스트 메일 발송 성공
- 최신 3월 15일 기사 10개 수집 및 이메일 발송 완료
- `last_article_id`가 Firestore에 `A00000160144`로 업데이트됨

---

## 발견된 문제 (미해결)

### P0: Cloud Run 서비스 앱 교체
- **현상**: `opinionnewsletter-web` (asia-northeast3)이 Express 뉴스레터 앱이 아닌 **Next.js 앱**을 서빙 중
- **영향**: `/health` → 404, `/api/cron/send` → 405/401
- **조치 필요**: Express 앱 재배포 또는 올바른 리비전으로 트래픽 전환

### P0: HTTP 메서드 불일치
- **현상**: Cloud Scheduler → **POST** `/api/cron/send`, server.js → **GET** 핸들러
- **조치**: `app.get` → `app.post` 또는 `app.all`로 변경

### P0: Gmail 앱 비밀번호 오류
- **현상**: Cloud Run 환경변수 `GMAIL_APP_PASSWORD=opinionnewsletter001` (무효)
- **조치**: 올바른 앱 비밀번호로 업데이트 + 환경변수명 통일 (`EMAIL_USER`/`EMAIL_PASS`)

### P1: 환경변수 누락
- Cloud Run에 `FIRESTORE_DATABASE_ID=opinionnewsletterdb` 미설정
- `GCP_PROJECT_ID` 미설정 (코드에서 참조)

### P2: 중복 스케줄러/Jobs 정리
- us-central1에 3개 스케줄러 + 3개 Cloud Run Jobs 존재 (2월 이후 전부 실패)
- asia-northeast3 하나로 통합 필요

---

## To-Do 목록

| 우선순위 | 작업 | 상태 |
|---------|------|------|
| P0 | Express 뉴스레터 앱을 Cloud Run에 재배포 | 미완 |
| P0 | `app.get('/api/cron/send')` → `app.post` 변경 | 미완 |
| P0 | Cloud Run 환경변수 수정 (EMAIL_PASS, FIRESTORE_DATABASE_ID 등) | 미완 |
| P1 | crawler.js + testSend.js + database.js 변경사항 커밋 | 미완 |
| P1 | GitHub Actions CI/CD 확인 (올바른 앱이 배포되는지) | 미완 |
| P2 | us-central1 중복 스케줄러/Jobs 정리 | 미완 |
| P2 | Cloud Run 환경변수명 통일 (GMAIL_USER→EMAIL_USER 등) | 미완 |
