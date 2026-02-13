# TVING Newsletter - PRD (Product Requirements Document)

## 1. 프로젝트 개요

TVING 뉴스 기사를 자동으로 크롤링하여 구독자에게 매일 뉴스레터로 발송하는 서비스.

- **서비스 URL**: Cloud Run 배포 (GCP `asia-northeast3`)
- **발송 시간**: 매일 오전 7:30 KST (Cloud Scheduler)
- **데이터 저장소**: Google Cloud Firestore

## 2. 주요 기능

### 2.1 뉴스 크롤링
- TVING 뉴스 기사 ID 기반 브루트포스 크롤링
  - 정방향 탐색: `last_article_id`부터 +150개 ID 탐색하여 최신 기사 발견
  - 역방향 수집: 최신 ID부터 -80개 수집 (카테고리 다양성 확보)
  - 연속 404: 10번 연속 실패 시 탐색 중단
- 카테고리 자동 분류 (경제, 정치, 사회, 문화/연예, 스포츠, IT/과학 등)
- 카테고리당 최대 3개, 총 20개 기사 수집
- **자동 ID 관리**: `getLatestArticles()` 실행 시 발견한 최신 ID를 Firestore `settings/last_article_id`에 자동 저장 (2026-02-13 추가)

### 2.2 이메일 발송
- Gmail SMTP (Nodemailer) 기반 순차 발송
- 모바일 반응형 HTML 이메일 템플릿 (다크 테마)
  - 데스크톱: 썸네일 좌측 / 텍스트 우측 배치
  - 모바일 (480px 이하): 썸네일 상단 / 텍스트 하단 세로 배치
  - 기사 설명 60자 제한
- 발송 간 1초 딜레이 (Gmail 속도 제한 방지)

### 2.3 구독 관리
- 이메일 구독/해지 (웹 랜딩 페이지)
- 이메일 암호화 저장 (AES-256-CBC)
- Firestore 기반 구독자 DB

### 2.4 중복 발송 방지
- `isSentToday()`: Firestore `send_logs`에서 당일 KST 기준 성공 기록 확인
- Cloud Run `max-instances: 1`로 다중 인스턴스 방지
- Cloud Scheduler 재시도 정책: 첫 실패 후 10초 후 재시도, 최대 5분 (2026-02-13 추가)

### 2.5 관리자 기능
- 토큰 기반 인증 (`crypto.randomBytes(32)`, 24시간 만료)
- 구독자 목록 조회/삭제, 테스트 발송, 수동 일괄 발송, 발송 로그 조회
- API 문서: Swagger UI (`/api-docs`)

## 3. 시스템 아키텍처

```
[Cloud Scheduler] --GET /api/cron/send--> [Cloud Run]
                                              |
                                     [크롤링 → 이메일 발송]
                                              |
                                        [Firestore]
                                     (subscribers, send_logs, settings)
```

### 발송 트리거
- **자동**: Cloud Scheduler (`tving-newsletter-daily`, 매일 7:30 KST)
- **수동**: Admin 패널 → `POST /api/send-now`

## 4. 환경 변수

| 변수명 | 설명 |
|--------|------|
| `EMAIL_USER` | Gmail 발신 계정 |
| `EMAIL_PASS` | Gmail 앱 비밀번호 |
| `ENCRYPTION_KEY` | 이메일 암호화 키 (AES-256) |
| `ADMIN_PASSWORD` | 관리자 로그인 비밀번호 |
| `GCP_PROJECT_ID` | GCP 프로젝트 ID |
| `LATEST_ARTICLE_ID` | 크롤링 시작 기사 ID (초기값) |

## 5. 타임존

- 모든 발송 기록은 KST 기준 저장/표시
- `getKSTNow()` 헬퍼로 UTC+9 변환
- `sent_date` (YYYY-MM-DD) 필드로 당일 중복 체크

## 6. 비용

| 서비스 | 월 사용량 | 무료 한도 | 초과분 | 비용 |
|---|---|---|---|---|
| Cloud Run (min-instances=0) | ~7,300 GiB-sec | 360,000 | 없음 | $0 |
| Cloud Scheduler | 1 Job | 3 Jobs | 없음 | $0 |
| Firestore | ~900 reads, ~150 writes | 매우 여유 | 없음 | $0 |
| Artifact Registry | 1.17 GB | 0.5 GB | 0.67 GB | $0.07 |
| **월 총 비용** | | | | **~$0.07** |

> Artifact Registry 이미지 정리 시 **완전 무료** 운영 가능

## 7. 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-02-11 | 초기 구축: 크롤러, 이메일 발송, 구독 시스템 |
| 2026-02-11 | SQLite → Firestore 마이그레이션 |
| 2026-02-11 | node-cron 제거, Cloud Scheduler 단일 트리거로 전환 |
| 2026-02-11 | KST 시간 저장/표시, 중복 발송 방지 추가 |
| 2026-02-11 | 관리자 토큰 인증 시스템 추가 |
| 2026-02-12 | 발송 시간 7:45 → 7:30 변경 |
| 2026-02-12 | 이메일 템플릿 모바일 반응형 개선 (세로 배치) |
| 2026-02-12 | Gmail 다크 배경 호환성 개선, 기사 설명 60자 제한, VIDEO 뱃지 제거 |
| 2026-02-13 | **crawler.js 개선**: `getLatestArticles`에서 `last_article_id` Firestore 자동 저장 |
| 2026-02-13 | **비용 최적화**: Cloud Run min-instances=0 설정 (월 $0.79 → $0.07) |
| 2026-02-13 | **안정성 개선**: Cloud Scheduler 재시도 정책 추가 (maxRetryDuration 300s) |
| 2026-02-13 | 콜드스타트 대응: 재시도 정책으로 첫 실패 커버, 10초 후 재시도 성공 |
