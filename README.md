# TVING Newsletter Service

[![Cloud Run](https://img.shields.io/badge/Cloud%20Run-Deployed-blue)](https://cloud.google.com/run)
[![Node.js](https://img.shields.io/badge/Node.js-20%20LTS-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

티빙 뉴스 자동 수집 및 이메일 뉴스레터 서비스

**서비스 URL:** Cloud Run (`asia-northeast3`)
**발송 시간:** 매일 오전 7:30 KST
**월 운영 비용:** ~$0.07 (거의 무료)

---

## 📋 주요 기능

- 🔄 **자동 뉴스 크롤링**: TVING 뉴스 사이트에서 최신 기사 자동 수집 (브루트포스 ID 탐색)
- 📧 **이메일 뉴스레터**: 매일 오전 7:30 자동 발송 (Cloud Scheduler)
- 🗄️ **Firestore DB**: 구독자 관리, 발송 로그, 설정 저장
- 🔐 **보안**: 이메일 AES-256-CBC 암호화, 관리자 토큰 인증
- 📱 **모바일 최적화**: 반응형 이메일 템플릿 (다크 테마)
- 👨‍💼 **관리자 페이지**: 구독자 관리, 발송 내역, 테스트 발송
- 📖 **API 문서**: Swagger UI (`/api-docs`)

---

## 🛠 기술 스택

### Backend
- **Runtime**: Node.js 20 LTS
- **Framework**: Express 4.18
- **Database**: Google Cloud Firestore (Native mode)
- **Email**: Nodemailer (Gmail SMTP)
- **Crawler**: Axios + Cheerio

### Infrastructure (GCP)
- **Compute**: Cloud Run (min-instances=0, 비용 최적화)
- **Scheduler**: Cloud Scheduler (매일 07:30 KST)
- **Database**: Firestore (asia-northeast3)
- **CI/CD**: GitHub Actions → Cloud Run

### Frontend
- **UI**: HTML5 + CSS3 + Vanilla JavaScript
- **Admin**: Token-based Authentication

---

## 🚀 로컬 실행

### 사전 준비
- Node.js 20 이상
- Gmail 계정 (SMTP 사용)
- GCP 프로젝트 (Firestore 활성화)

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 변수 설정
```bash
cp .env.example .env
```

`.env` 파일 수정:
```env
# 암호화 키 (32자)
ENCRYPTION_KEY=your-32-character-secret-key

# Gmail SMTP
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password

# 관리자 비밀번호
ADMIN_PASSWORD=your-admin-password

# GCP 프로젝트 ID
GCP_PROJECT_ID=your-gcp-project-id

# 크롤링 시작 ID (선택)
LATEST_ARTICLE_ID=A00000142400

# 포트 (선택)
PORT=3000
```

### 3. 서버 실행
```bash
npm start
```

접속: `http://localhost:3000`

---

## 📦 GCP 배포

### Cloud Run 배포 (추천)
```bash
gcloud run deploy tving-newsletter \
  --source . \
  --region asia-northeast3 \
  --min-instances 0 \
  --max-instances 1 \
  --memory 256Mi \
  --cpu 1 \
  --timeout 600 \
  --allow-unauthenticated
```

### Cloud Scheduler 설정
```bash
gcloud scheduler jobs create http tving-newsletter-daily \
  --location=asia-northeast3 \
  --schedule="30 7 * * *" \
  --time-zone="Asia/Seoul" \
  --uri="https://YOUR-SERVICE-URL.run.app/api/cron/send" \
  --http-method=GET \
  --attempt-deadline=600s \
  --max-retry-duration=300s \
  --min-backoff=10s
```

자세한 배포 가이드: [DEPLOY_GCP.md](DEPLOY_GCP.md)

---

## 📂 프로젝트 구조

```
tving-newsletter/
├── src/                    # 백엔드 소스
│   ├── server.js          # Express 서버 + API 엔드포인트
│   ├── crawler.js         # 뉴스 크롤링 (브루트포스 ID 탐색)
│   ├── emailService.js    # 이메일 발송 (Nodemailer)
│   ├── database.js        # Firestore CRUD
│   ├── scheduler.js       # 뉴스레터 발송 작업
│   ├── crypto.js          # AES-256-CBC 암호화
│   ├── swagger.js         # Swagger API 문서
│   └── testSend.js        # 테스트 발송 스크립트
├── public/                 # 프론트엔드
│   ├── index.html         # 구독 페이지
│   ├── admin.html         # 관리자 페이지
│   ├── styles.css
│   └── script.js
├── Dockerfile              # Cloud Run 배포
├── .github/workflows/
│   └── deploy.yml          # GitHub Actions CI/CD
├── PRD.md                  # 프로덕트 요구사항
├── TECHNICAL_SPEC.md       # 기술 상세 문서
├── DEPLOY_GCP.md           # 배포 가이드
└── package.json
```

---

## 🔑 환경 변수

| 변수명 | 필수 | 설명 | 예시 |
|--------|------|------|------|
| `ENCRYPTION_KEY` | ✅ | 이메일 암호화 키 (32자) | `tving-newsletter-secret-key-32c` |
| `EMAIL_USER` | ✅ | Gmail 발신 계정 | `newsletter@gmail.com` |
| `EMAIL_PASS` | ✅ | Gmail 앱 비밀번호 | `abcd efgh ijkl mnop` |
| `ADMIN_PASSWORD` | ✅ | 관리자 로그인 비밀번호 | `strong-password-123` |
| `GCP_PROJECT_ID` | ✅ | GCP 프로젝트 ID | `tving-newsletter-service` |
| `LATEST_ARTICLE_ID` | ⭕ | 크롤링 시작 ID | `A00000142400` |
| `PORT` | ⭕ | HTTP 포트 | `3000` |

---

## 📖 API 문서

### Public API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/api/subscribe` | 이메일 구독 등록 |
| `GET` | `/api/stats` | 서비스 통계 (구독자 수) |
| `GET` | `/health` | 헬스체크 |

### Admin API (인증 필요)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/api/admin/login` | 관리자 로그인 (토큰 발급) |
| `POST` | `/api/admin/logout` | 관리자 로그아웃 |
| `GET` | `/api/subscribers` | 구독자 목록 조회 |
| `DELETE` | `/api/subscribers/:id` | 구독자 삭제 |
| `POST` | `/api/subscribers/:id/test-send` | 테스트 발송 |
| `POST` | `/api/send-now` | 수동 뉴스레터 발송 |
| `GET` | `/api/send-logs` | 발송 내역 조회 |

### Cron API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/cron/send` | Cloud Scheduler 트리거 |

**Swagger UI:** `/api-docs`

---

## 🔒 보안

### 이메일 암호화
- **알고리즘**: AES-256-CBC
- **키 관리**: 환경 변수 (`ENCRYPTION_KEY`)
- **IV**: 각 암호화마다 랜덤 생성

### 관리자 인증
- **방식**: 토큰 기반 (메모리 저장)
- **토큰 생성**: `crypto.randomBytes(32)`
- **유효기간**: 24시간
- **헤더**: `Authorization: Bearer <token>`

### 이메일 마스킹
```
triones24@gmail.com → tri***@gmail.com
```

---

## 💰 비용

| 서비스 | 월 사용량 | 무료 한도 | 초과분 | 비용 |
|--------|-----------|-----------|--------|------|
| Cloud Run | ~7,300 GiB-sec | 360,000 | 없음 | $0 |
| Cloud Scheduler | 1 Job | 3 Jobs | 없음 | $0 |
| Firestore | ~900 reads, ~150 writes | 매우 여유 | 없음 | $0 |
| Artifact Registry | 1.17 GB | 0.5 GB | 0.67 GB | $0.07 |
| **월 총 비용** | | | | **~$0.07** |

> Artifact Registry 이미지 정리 시 **완전 무료** 운영 가능

**비용 최적화 전략:**
- Cloud Run `min-instances=0` (요청 없으면 종료)
- Cloud Scheduler 재시도 정책 (콜드스타트 대응)
- Firestore 읽기/쓰기 최소화

---

## 🧪 테스트

### 크롤링 테스트
```bash
node src/crawler.js
```

### 이메일 발송 테스트
```bash
node src/testSend.js
```

### 서버 테스트
```bash
# 헬스체크
curl http://localhost:3000/health

# 구독 등록
curl -X POST http://localhost:3000/api/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# 통계 조회
curl http://localhost:3000/api/stats
```

---

## 📊 시스템 아키텍처

```
[Cloud Scheduler] → GET /api/cron/send → [Cloud Run]
                                              ↓
                                      [Crawler] → [Firestore]
                                              ↓
                                      [Email Service] → [Gmail SMTP]
                                              ↓
                                      [Subscribers]
```

**발송 흐름:**
1. Cloud Scheduler가 매일 07:30 KST에 `/api/cron/send` 호출
2. 중복 발송 체크 (`isSentToday()`)
3. 최신 기사 20개 크롤링 (`getLatestArticles()`)
4. 모든 구독자에게 이메일 발송 (`sendNewsletterToAll()`)
5. 발송 로그 저장 (`addSendLog()`)

자세한 기술 스펙: [TECHNICAL_SPEC.md](TECHNICAL_SPEC.md)

---

## 🎯 주요 기능

### 1. 자동 뉴스 크롤링
- TVING 뉴스 기사 ID 브루트포스 탐색
- 정방향 탐색 (+150개) + 역방향 수집 (-80개)
- 카테고리별 그룹화 (카테고리당 최대 3개)
- `last_article_id` 자동 저장 (Firestore)

### 2. 이메일 템플릿
- 모바일 반응형 (480px 이하 세로 배치)
- 다크 테마 (배경: #111111)
- 카테고리별 섹션 구분
- 썸네일 + 제목 + 설명 (60자 제한)

### 3. 중복 발송 방지
- KST 기준 당일 발송 여부 체크
- Cloud Run max-instances=1
- Cloud Scheduler 재시도 정책 (5분)

### 4. 관리자 기능
- 구독자 목록 조회 (마스킹)
- 개별/전체 테스트 발송
- 발송 내역 조회 (최근 20개)
- Swagger API 문서

---

## 📈 성능 지표

| 항목 | 값 |
|------|-----|
| 일일 크롤링 | ~200-500 기사 |
| 일일 발송 | 7명 × 1회 |
| 평균 발송 시간 | ~70초 |
| 콜드스타트 | 3-5초 (재시도로 커버) |
| 이메일 발송 간격 | 1초 (Gmail 제한 방지) |
| 크롤링 요청 간격 | 0.5초 (서버 부하 방지) |

---

## 🐛 문제 해결

### Q: 이메일이 발송되지 않습니다
**A:** Gmail 앱 비밀번호를 확인하세요. 2단계 인증 활성화 후 앱 비밀번호를 생성해야 합니다.
- [Gmail 앱 비밀번호 생성](https://myaccount.google.com/apppasswords)

### Q: 크롤링이 실패합니다
**A:** `LATEST_ARTICLE_ID`를 최신 ID로 업데이트하세요. Firestore `settings/last_article_id`를 확인하세요.

### Q: Cloud Scheduler가 실패합니다
**A:** Cloud Run 서비스 URL이 올바른지 확인하세요. 재시도 정책이 설정되어 있는지 확인하세요.

### Q: 관리자 페이지 로그인이 안 됩니다
**A:** `.env`의 `ADMIN_PASSWORD`를 확인하세요. 브라우저 캐시를 삭제해보세요.

---

## 🔄 CI/CD

### GitHub Actions 자동 배포
- **트리거**: `main` 브랜치 push
- **워크플로우**: `.github/workflows/deploy.yml`
- **배포 대상**: Cloud Run (asia-northeast3)

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [ main ]
```

---

## 📝 문서

- [PRD.md](PRD.md) - 프로덕트 요구사항
- [TECHNICAL_SPEC.md](TECHNICAL_SPEC.md) - 기술 상세 문서
- [DEPLOY_GCP.md](DEPLOY_GCP.md) - GCP 배포 가이드
- [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) - 프로젝트 현황 요약

---

## 🤝 기여

이슈 제보 및 Pull Request 환영합니다!

---

## 📄 라이선스

MIT License

---

## 📬 문의

- GitHub Issues: [이슈 생성](https://github.com/your-repo/issues)
- Email: triones24@gmail.com

---

**Made with ❤️ by AI Assistant**
