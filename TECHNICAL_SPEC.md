# TVING Newsletter - Technical Specification

> 기술 상세 문서 | 버전 1.0 | 최종 업데이트: 2026-02-13

---

## 1. System Architecture

### 1.1 High-Level Architecture

```
┌──────────────────┐
│  Cloud Scheduler │ (매일 07:30 KST)
└────────┬─────────┘
         │ GET /api/cron/send
         ▼
┌────────────────────────────────┐
│      Cloud Run Service         │
│   (min-instances=0, max=1)     │
│                                │
│  ┌──────────┐  ┌────────────┐ │
│  │ Crawler  │─▶│ Email Svc  │ │
│  └──────────┘  └────────────┘ │
│         │            │         │
└─────────┼────────────┼─────────┘
          │            │
          ▼            ▼
    ┌─────────────────────┐
    │     Firestore       │
    │  - subscribers      │
    │  - send_logs        │
    │  - settings         │
    └─────────────────────┘
           │
           ▼
    ┌─────────────┐
    │ Gmail SMTP  │
    └─────────────┘
```

### 1.2 Request Flow

```
사용자 구독 요청:
User → /api/subscribe → Encrypt Email → Firestore → Response

뉴스레터 발송 (자동):
Cloud Scheduler → /api/cron/send
                      ↓
                  isSentToday() 체크
                      ↓
                  getLatestArticles(20)
                      ↓
                  sendNewsletterToAll()
                      ↓
                  addSendLog()

관리자 작업:
Admin → POST /api/admin/login → Token 발급
     → GET /api/subscribers (with Token)
     → POST /api/send-now (with Token)
```

### 1.3 Cold Start Handling

```
07:30:00 - Scheduler 첫 요청
           ↓
07:30:05 - Cold Start 실패 (인스턴스 부팅 중)
           ↓
07:30:15 - 재시도 (10초 후)
           ↓
07:30:16 - 성공 (인스턴스 이미 warm)
           ↓
07:31:26 - 크롤링 + 메일 발송 완료 (70초)
           ↓
07:46:26 - Idle timeout (15분)
           ↓
07:46:27 - 인스턴스 종료 (min-instances=0)
```

---

## 2. Technology Stack

### 2.1 Runtime & Framework

| 구분 | 기술 | 버전 | 용도 |
|------|------|------|------|
| Runtime | Node.js | 20 LTS | 서버 런타임 |
| Framework | Express | 4.18.2 | HTTP 서버 |
| Language | JavaScript | ES6+ | 애플리케이션 로직 |

### 2.2 Database

| 구분 | 기술 | 용도 |
|------|------|------|
| Database | Google Cloud Firestore | NoSQL 문서 데이터베이스 |
| SDK | @google-cloud/firestore | Node.js Firestore 클라이언트 |
| Mode | Native | Firestore Native 모드 |
| Region | asia-northeast3 | 서울 리전 |

### 2.3 External Services

| 서비스 | 용도 | 설정 |
|--------|------|------|
| Gmail SMTP | 이메일 발송 | `smtp.gmail.com:587` |
| Cloud Scheduler | Cron 트리거 | 매일 07:30 KST |
| Artifact Registry | Docker 이미지 저장 | asia-northeast3-docker.pkg.dev |

### 2.4 Infrastructure (GCP)

| 서비스 | 설정 | 비용 |
|--------|------|------|
| Cloud Run | CPU: 1 vCPU, RAM: 256Mi, min=0, max=1 | ~$0 |
| Cloud Scheduler | 1 Job (07:30 daily) | ~$0 |
| Firestore | Native mode, asia-northeast3 | ~$0 |
| Artifact Registry | 1.17 GB storage | ~$0.07/월 |

### 2.5 Dependencies

```json
{
  "@google-cloud/firestore": "^7.11.0",
  "axios": "^1.6.2",
  "cheerio": "^1.0.0-rc.12",
  "cors": "^2.8.5",
  "dotenv": "^16.3.1",
  "express": "^4.18.2",
  "nodemailer": "^6.9.7",
  "swagger-ui-express": "^5.0.1"
}
```

---

## 3. API Endpoints

### 3.1 Public API (구독 관련)

#### `POST /api/subscribe`
이메일 구독 등록

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (성공):**
```json
{
  "success": true,
  "message": "구독이 완료되었습니다! 매일 오전 7:30에 뉴스레터가 발송됩니다."
}
```

**Validation:**
- 이메일 정규식 검증 (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`)
- 최대 길이 254자
- 정규화 (trim + toLowerCase)
- 중복 체크 (Firestore)

---

#### `GET /api/stats`
서비스 통계 조회 (공개)

**Response:**
```json
{
  "success": true,
  "subscriberCount": 7,
  "nextSend": "오전 7:30 (Cloud Scheduler)",
  "status": "active"
}
```

---

#### `GET /health`
헬스체크 엔드포인트

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-13T23:36:35.825Z"
}
```

---

### 3.2 Admin API (인증 필요)

#### `POST /api/admin/login`
관리자 로그인

**Request:**
```json
{
  "password": "admin-password"
}
```

**Response:**
```json
{
  "success": true,
  "token": "64-char-hex-token"
}
```

**Token 정보:**
- 생성: `crypto.randomBytes(32).toString('hex')`
- 유효기간: 24시간
- 저장: 메모리 Map (`adminTokens`)

---

#### `POST /api/admin/logout`
관리자 로그아웃

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true
}
```

---

#### `GET /api/subscribers`
구독자 목록 조회 (마스킹)

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "total": 7,
  "subscribers": [
    {
      "id": "doc-id-123",
      "email_masked": "tri***@gmail.com",
      "created_at": "2026-02-13T08:30:00.000Z",
      "is_active": 1
    }
  ]
}
```

---

#### `DELETE /api/subscribers/:id`
구독자 삭제

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "삭제되었습니다."
}
```

---

#### `POST /api/subscribers/:id/test-send`
특정 구독자에게 테스트 발송

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "tri***@gmail.com로 발송 완료! (기사 5건)"
}
```

---

#### `POST /api/send-now`
수동 뉴스레터 발송 (전체 구독자)

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "sent": 7,
  "total": 7,
  "articles": 18
}
```

---

#### `GET /api/send-logs`
발송 내역 조회 (최근 20개)

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "logs": [
    {
      "id": "log-id-456",
      "sent_at": "2026-02-13 08:38:23",
      "total_subscribers": 7,
      "success_count": 7,
      "article_count": 18,
      "status": "success"
    }
  ]
}
```

---

### 3.3 Cron API

#### `GET /api/cron/send`
Cloud Scheduler 트리거 엔드포인트

**Headers:**
```
User-Agent: Google-Cloud-Scheduler
```

**Response:**
```json
{
  "success": true,
  "message": "Newsletter sent successfully"
}
```

**중복 발송 시:**
```json
{
  "success": true,
  "skipped": true,
  "message": "오늘 이미 발송 완료 (KST)"
}
```

---

### 3.4 Documentation

#### `GET /api-docs`
Swagger UI API 문서

---

## 4. Database Schema (Firestore)

### 4.1 Collection: `subscribers`

```javascript
{
  "id": "auto-generated-doc-id",      // Firestore document ID
  "email_encrypted": "encrypted-AES", // AES-256-CBC 암호화된 이메일
  "email_masked": "tri***@gmail.com", // 마스킹된 이메일 (조회용)
  "created_at": "2026-02-13T08:30:00.000Z", // ISO 8601
  "is_active": 1                      // 1 = 활성, 0 = 비활성
}
```

**인덱스:**
- `email_encrypted` (중복 체크용)
- `is_active` (활성 구독자 조회용)

---

### 4.2 Collection: `send_logs`

```javascript
{
  "id": "auto-generated-doc-id",
  "sent_at": "2026-02-13 08:38:23",  // KST datetime
  "sent_date": "2026-02-13",         // KST date (중복 발송 체크용)
  "total_subscribers": 7,
  "success_count": 7,
  "article_count": 18,
  "status": "success"                // "success", "failed", "error"
}
```

**인덱스:**
- `sent_date` + `status` (당일 성공 여부 체크용)
- `sent_at` (최근 로그 조회용)

---

### 4.3 Collection: `settings`

```javascript
// Document ID: "last_article_id"
{
  "value": "A00000143734",          // 마지막 확인한 기사 ID
  "updated_at": "2026-02-13T08:37:31.697966Z"
}
```

---

## 5. Crawling Algorithm

### 5.1 브루트포스 ID 탐색

**기본 원리:**
- TVING 기사 ID 형식: `A00000XXXXXX` (11자리 숫자)
- 순차적으로 증가하는 ID를 기준으로 브루트포스 탐색
- 404 응답이 연속 N번 나오면 탐색 중단

**코드 흐름 (`getLatestArticles`):**

```javascript
// 1. 최신 ID 찾기 (정방향 탐색)
let currentId = await getSetting('last_article_id') || 'A00000142400';
let currentNum = parseArticleNum(currentId);  // 142400

for (let i = 1; i <= 150; i++) {
  const id = formatArticleId(currentNum + i);  // A00000142401, ...
  const article = await fetchArticle(id);

  if (article) {
    latestNum = currentNum + i;  // 최신 ID 갱신
    consecutiveNotFound = 0;
  } else {
    consecutiveNotFound++;
    if (consecutiveNotFound >= 10) break;  // 연속 10번 404 → 중단
  }
}

// 2. 최신 ID 저장 (다음 실행 시 여기서부터 탐색)
if (latestNum > currentNum) {
  await setSetting('last_article_id', formatArticleId(latestNum));
}

// 3. 역방향 수집 (다양성 확보)
const pool = [];
let num = latestNum;
while (pool.length < 80 && checkedCount < 120) {
  const article = await fetchArticle(formatArticleId(num));
  if (article) pool.push(article);
  num--;
  checkedCount++;
}

// 4. 카테고리별 그룹화 (카테고리당 최대 3개)
const categoryGroups = {};
for (const article of pool) {
  if (!categoryGroups[article.category]) {
    categoryGroups[article.category] = [];
  }
  if (categoryGroups[article.category].length < 3) {
    categoryGroups[article.category].push(article);
  }
}

// 5. 카테고리 순서 랜덤화 후 최종 20개 선정
return shuffleAndLimit(categoryGroups, 20);
```

### 5.2 Article Parsing

**HTML 파싱 (`fetchArticle`):**

```javascript
const $ = cheerio.load(response.data);

// 제목 추출
const title = $('meta[property="og:title"]').attr('content')
           || $('title').text().replace(' | TVING', '').trim();

// 설명 추출 (우선순위 순서)
// 1) og:description
// 2) 본문 텍스트 (p 태그 집계)
// 3) JSON-LD articleBody
let description = $('meta[property="og:description"]').attr('content');

if (!description || description.length < 50) {
  // 본문 텍스트 시도
  $('p').each((i, el) => {
    const text = $(el).text().trim();
    if (text.length > 10) bodyText += text + ' ';
  });
  description = bodyText.substring(0, 200);
}

// 썸네일 & 카테고리 추출
const thumbnail = $('meta[property="og:image"]').attr('content');
const categoryMatch = thumbnail.match(/ntgs\/([^/]+)\//);
const category = categoryMap[categoryMatch[1]] || '뉴스';

return { id, title, description, thumbnail, category, url };
```

### 5.3 Request Throttling

```javascript
await sleep(500);  // 0.5초 딜레이 (서버 부하 방지)
```

---

## 6. Email System

### 6.1 Template Structure

**HTML 구조:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    /* 모바일 반응형 */
    @media screen and (max-width: 480px) {
      .thumb-cell { display: block !important; width: 100% !important; }
      .text-cell { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body bgcolor="#111111">
  <!-- 헤더 (TVING 로고) -->
  <!-- 날짜 배지 -->
  <!-- 카테고리별 기사 섹션 -->
  <!-- CTA 버튼 (전체 뉴스 보러가기) -->
  <!-- 푸터 (발송 정보) -->
</body>
</html>
```

**카테고리 섹션:**
```html
<tr>
  <td>
    <table>
      <tr>
        <td style="background-color:#FF153C;">&nbsp;</td>
        <td>경제</td>
      </tr>
    </table>
  </td>
</tr>
<!-- 기사 3개 -->
<tr>
  <td>
    <table>
      <tr>
        <td class="thumb-cell" width="120">
          <img src="thumbnail.jpg" width="120" height="68" />
        </td>
        <td class="text-cell">
          <a href="article-url">기사 제목</a>
          <p>기사 설명 60자...</p>
        </td>
      </tr>
    </table>
  </td>
</tr>
```

### 6.2 Gmail SMTP Configuration

```javascript
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,     // 발신 Gmail 주소
    pass: process.env.EMAIL_PASS      // Gmail 앱 비밀번호
  }
});

const mailOptions = {
  from: `"TVING 뉴스레터" <${process.env.EMAIL_USER}>`,
  to: subscriberEmail,
  subject: `[TVING 뉴스] ${month}월 ${day}일 오늘의 뉴스 ${count}건`,
  html: emailTemplate
};
```

### 6.3 Batch Sending (순차 발송)

```javascript
for (const subscriber of subscribers) {
  const email = decryptEmail(subscriber.email_encrypted);
  await sendEmail(email, subject, html);

  // Gmail 속도 제한 방지 (일일 500건)
  await sleep(1000);  // 1초 딜레이
}
```

---

## 7. Security

### 7.1 Email Encryption (AES-256-CBC)

**암호화 (저장 시):**
```javascript
const crypto = require('crypto');
const ALGORITHM = 'aes-256-cbc';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'utf8').slice(0, 32);

function encryptEmail(email) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  let encrypted = cipher.update(email, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return iv.toString('hex') + ':' + encrypted;
}
```

**복호화 (발송 시):**
```javascript
function decryptEmail(encryptedData) {
  const [ivHex, encrypted] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

### 7.2 Email Masking

```javascript
function maskEmail(email) {
  const [local, domain] = email.split('@');
  const visibleChars = Math.min(3, local.length);
  const masked = local.slice(0, visibleChars) + '***';
  return masked + '@' + domain;
}

// 예: triones24@gmail.com → tri***@gmail.com
```

### 7.3 Admin Authentication

**토큰 생성:**
```javascript
const token = crypto.randomBytes(32).toString('hex');  // 64자
adminTokens.set(token, {
  expiresAt: Date.now() + 24 * 60 * 60 * 1000  // 24시간
});
```

**미들웨어 검증:**
```javascript
function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token || !adminTokens.has(token)) {
    return res.status(401).json({ message: '인증이 필요합니다.' });
  }

  const tokenData = adminTokens.get(token);
  if (Date.now() > tokenData.expiresAt) {
    adminTokens.delete(token);
    return res.status(401).json({ message: '세션이 만료되었습니다.' });
  }

  next();
}
```

### 7.4 Environment Variables

```bash
# 필수 변수 (Cloud Run Secrets Manager)
ENCRYPTION_KEY=32-char-secret-key
EMAIL_USER=gmail-account@gmail.com
EMAIL_PASS=gmail-app-password
ADMIN_PASSWORD=admin-password
GCP_PROJECT_ID=tving-newsletter-service

# 선택 변수
PORT=3000
LATEST_ARTICLE_ID=A00000142400
```

---

## 8. Deployment Configuration

### 8.1 Cloud Run

**배포 커맨드:**
```bash
gcloud run deploy tving-newsletter \
  --source . \
  --region=asia-northeast3 \
  --min-instances=0 \
  --max-instances=1 \
  --memory=256Mi \
  --cpu=1 \
  --timeout=600 \
  --allow-unauthenticated
```

**설정:**
| 항목 | 값 | 설명 |
|------|-----|------|
| min-instances | 0 | 비용 최적화 (요청 없으면 종료) |
| max-instances | 1 | 중복 발송 방지 |
| memory | 256Mi | HTML 파싱에 충분 |
| cpu | 1 | vCPU 1개 |
| timeout | 600s | 크롤링 + 발송 여유 |
| startup-cpu-boost | true | 콜드스타트 가속 |

### 8.2 Cloud Scheduler

**Job 설정:**
```bash
gcloud scheduler jobs create http tving-newsletter-daily \
  --location=asia-northeast3 \
  --schedule="30 7 * * *" \
  --time-zone="Asia/Seoul" \
  --uri="https://tving-newsletter-xxx.run.app/api/cron/send" \
  --http-method=GET \
  --attempt-deadline=600s \
  --max-retry-duration=300s \
  --min-backoff=10s \
  --max-backoff=300s \
  --max-doublings=3
```

**재시도 정책:**
| 항목 | 값 | 설명 |
|------|-----|------|
| attempt-deadline | 600s | 단일 시도 타임아웃 |
| max-retry-duration | 300s | 총 재시도 시간 (5분) |
| min-backoff | 10s | 첫 재시도 간격 |
| max-backoff | 300s | 최대 재시도 간격 |
| max-doublings | 3 | 지수 백오프 횟수 |

**재시도 시나리오:**
```
1차 시도: 07:30:00 → 실패 (콜드스타트)
2차 시도: 07:30:10 → 성공 (인스턴스 warm)
```

### 8.3 Firestore

**설정:**
```bash
gcloud firestore databases create \
  --location=asia-northeast3 \
  --type=firestore-native
```

**인덱스:**
```javascript
// subscribers
- email_encrypted (ASC)
- is_active (ASC)

// send_logs
- sent_date (ASC) + status (ASC)  // 복합 인덱스
- sent_at (DESC)
```

---

## 9. Monitoring & Logging

### 9.1 Console Logging

**로그 레벨:**
```javascript
console.log('[Info] Normal operation')
console.error('[Error] Exception occurred')
```

**주요 로그 포인트:**
```javascript
// 서버 시작
[Database] Initialized
[Server] Started at http://localhost:3000

// 크롤링
[Crawler] Starting from article ID: A00000143735
[Crawler] Found: 기사 제목...
[Crawler] Updated last_article_id to: A00000143800

// 발송
[Scheduler] Newsletter job started at 2026-02-13 08:36:41
[Scheduler] Collected 18 articles for newsletter.
[Email] Sending newsletter to 7 subscribers...
[Email] Sent to tri***: <message-id>
[Scheduler] Job completed successfully and logged.

// 에러
[Scheduler] Job failed: Error message
[Email] Failed to send to user***: SMTP error
```

### 9.2 Send Logs (Firestore)

```javascript
await addSendLog(
  totalSubscribers: 7,
  successCount: 7,
  articleCount: 18,
  status: 'success'  // 'failed', 'error'
);
```

### 9.3 Cloud Logging (GCP)

**쿼리 예시:**
```bash
# 최근 발송 로그
gcloud logging read 'resource.type="cloud_run_revision"
  AND resource.labels.service_name="tving-newsletter"' \
  --limit=50 --format="table(timestamp, textPayload)"

# 에러만 필터
gcloud logging read 'severity>=ERROR' --limit=20
```

---

## 10. Performance Optimization

### 10.1 Cost Optimization

**min-instances=0 전략:**
- 요청 없으면 인스턴스 자동 종료
- 콜드스타트 3-5초 발생
- 재시도 정책으로 커버
- **월 비용: $0.79 → $0.07 (91% 절감)**

**비용 구조:**
```
Cloud Run (min=0):  $0.00 (무료 한도 내)
Cloud Scheduler:    $0.00 (무료 한도 내)
Firestore:          $0.00 (무료 한도 내)
Artifact Registry:  $0.07 (0.67 GB 초과)
─────────────────────────────
월 총 비용:         $0.07
```

### 10.2 Request Throttling

**크롤링:**
```javascript
await sleep(500);  // 0.5초 딜레이 (TVING 서버 부하 방지)
```

**이메일 발송:**
```javascript
await sleep(1000);  // 1초 딜레이 (Gmail 속도 제한 방지)
```

### 10.3 Caching Strategy

**Firestore 읽기 최소화:**
```javascript
// Bad: 매번 Firestore 조회
for (const article of articles) {
  const setting = await getSetting('some_key');
}

// Good: 한 번만 조회
const lastId = await getSetting('last_article_id');
for (const article of articles) {
  // use lastId
}
```

### 10.4 Memory Management

**256Mi RAM 설정:**
- Cheerio HTML 파싱: ~50-100Mi
- Express 서버: ~30-50Mi
- Firestore SDK: ~20-30Mi
- 여유 공간: ~100Mi

---

## 11. Error Handling

### 11.1 크롤링 실패

```javascript
try {
  const article = await fetchArticle(articleId);
} catch (error) {
  if (error.response?.status === 404) {
    return null;  // 404는 정상 (기사 없음)
  }
  console.error(`Error fetching article ${articleId}:`, error.message);
  return null;  // 다른 에러도 스킵
}
```

### 11.2 이메일 발송 실패

```javascript
try {
  await sendEmail(email, subject, html);
  successCount++;
} catch (error) {
  console.error(`[Email] Failed to send to ${email}:`, error.message);
  failCount++;
  // 계속 진행 (다른 구독자에게 발송)
}
```

### 11.3 중복 발송 방지

```javascript
const alreadySent = await isSentToday();
if (alreadySent) {
  console.log('[Scheduler] Already sent today (KST). Skipping.');
  return { skipped: true, reason: 'already_sent_today' };
}
```

### 11.4 Firestore 연결 실패

```javascript
try {
  await db.collection('subscribers').limit(1).get();
  console.log('[Firestore] Connected successfully');
} catch (error) {
  console.error('[Firestore] Connection failed:', error.message);
  throw error;  // 서버 시작 중단
}
```

---

## 12. 향후 개선 사항

| 우선순위 | 항목 | 설명 |
|---------|------|------|
| 높음 | 구독 취소 링크 | 이메일 하단에 원클릭 구독 취소 |
| 높음 | 에러 알림 | Slack/Discord 웹훅 연동 |
| 중간 | A/B 테스트 | 발송 시간 최적화 |
| 중간 | 통계 대시보드 | 구독자 증감, 오픈율 추적 |
| 낮음 | 개인화 | 관심 카테고리 설정 |

---

## Appendix A: 파일 구조

```
tving-newsletter/
├── src/
│   ├── server.js           # Express 서버 (340줄)
│   ├── crawler.js          # 크롤러 (383줄)
│   ├── emailService.js     # 이메일 (308줄)
│   ├── database.js         # Firestore (224줄)
│   ├── scheduler.js        # 발송 작업 (60줄)
│   ├── crypto.js           # 암호화 (50줄)
│   ├── swagger.js          # Swagger 설정 (200줄)
│   └── testSend.js         # 테스트 (100줄)
├── public/
│   ├── index.html          # 구독 페이지
│   ├── admin.html          # 관리자 페이지
│   ├── styles.css
│   └── script.js
├── Dockerfile              # Cloud Run 배포
├── .github/workflows/
│   └── deploy.yml          # GitHub Actions CI/CD
├── PRD.md                  # 프로덕트 요구사항
├── TECHNICAL_SPEC.md       # 기술 상세 문서 (이 파일)
├── README.md               # 프로젝트 소개
└── package.json            # 의존성
```

---

## Appendix B: 주요 메트릭

| 항목 | 값 |
|------|-----|
| 총 코드 라인 | ~2,000줄 |
| API 엔드포인트 | 14개 |
| Firestore 컬렉션 | 3개 |
| 일일 크롤링 | ~200-500 기사 |
| 일일 발송 | 7명 × 1회 |
| 평균 발송 시간 | 70초 |
| 콜드스타트 | 3-5초 |
| 월 비용 | ~$0.07 |

---

**문서 버전:** 1.0
**최종 업데이트:** 2026-02-13
**작성자:** AI Assistant
**문의:** GitHub Issues
