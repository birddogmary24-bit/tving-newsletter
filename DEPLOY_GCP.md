# GCP 배포 가이드 (Cloud Run 또는 Compute Engine)

티빙 뉴스레터 서비스를 Google Cloud Platform에 배포하는 가이드입니다. 

> 💡 **비용 절감 추천**: 24시간 켜져 있는 **Compute Engine**보다, 뉴스레터 발송 시에만 실행되는 **Cloud Run** 사용을 권장합니다. (대기 시 비용 0원)

---

## 방법 1: Cloud Run 배포 (추천 - 비용 0원 가능)

### 1. 배포 커맨드
```bash
# 로컬 터미널에서 실행
gcloud run deploy tving-newsletter \
  --source . \
  --platform managed \
  --region asia-northeast3 \
  --min-instances 0 \
  --max-instances 1 \
  --allow-unauthenticated \
  --set-env-vars="PORT=3000,EMAIL_USER=triones24@gmail.com,EMAIL_PASS=tafqhasnptckctfa,ENCRYPTION_KEY=tving-newsletter-secret-key-32c"
```

### 2. 특징
- **비용**: 서버가 사용되지 않을 때는 **0원**입니다.
- **확장성**: 사용자 접속이 늘어나면 자동으로 조절됩니다.

---

## 방법 2: Compute Engine 배포 (기존 방식)

티빙 뉴스레터 서비스를 Google Cloud Platform에 배포하는 가이드입니다.

---

## 사전 준비

1. [GCP Console](https://console.cloud.google.com) 접속
2. 프로젝트 생성 또는 선택
3. Compute Engine API 활성화

---

## Step 1: VM 인스턴스 생성

### GCP Console에서:

1. **Compute Engine** → **VM 인스턴스** → **인스턴스 만들기**

2. **설정값:**
   | 항목 | 값 |
   |------|-----|
   | 이름 | `tving-newsletter` |
   | 리전 | `asia-northeast3` (서울) |
   | 머신 유형 | `e2-micro` (무료 티어) |
   | 부팅 디스크 | Ubuntu 22.04 LTS |
   | 방화벽 | ✅ HTTP 트래픽 허용 |

3. **만들기** 클릭

---

## Step 2: VM 접속 및 환경 설정

### SSH 접속:
```bash
gcloud compute ssh tving-newsletter --zone=asia-northeast3-a
```

### Node.js 설치:
```bash
# Node.js 20 LTS 설치
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 버전 확인
node -v
npm -v
```

### PM2 설치 (프로세스 관리):
```bash
sudo npm install -g pm2
```

---

## Step 3: 코드 업로드

### 로컬에서 GCP로 파일 전송:
```bash
# 로컬 터미널에서 실행
cd /Users/waynepark/Documents/AI

# 압축
zip -r tving-newsletter.zip tving-newsletter -x "*/node_modules/*"

# GCP로 전송
gcloud compute scp tving-newsletter.zip tving-newsletter:~ --zone=asia-northeast3-a
```

### VM에서 압축 해제:
```bash
# VM SSH에서 실행
unzip tving-newsletter.zip
cd tving-newsletter
npm install
```

---

## Step 4: 환경변수 설정

```bash
# VM에서 .env 파일 수정
nano .env
```

```env
ENCRYPTION_KEY=tving-newsletter-secret-key-32c
EMAIL_USER=triones24@gmail.com
EMAIL_PASS=tafqhasnptckctfa
PORT=3000
LATEST_ARTICLE_ID=A00000136232
```

> `Ctrl+O` 저장, `Ctrl+X` 종료

---

## Step 5: PM2로 서버 실행

```bash
# 서버 시작 (백그라운드)
pm2 start src/server.js --name tving-newsletter

# 부팅 시 자동 시작 설정
pm2 startup
pm2 save

# 상태 확인
pm2 status
pm2 logs tving-newsletter
```

---

## Step 6: 외부 접속 설정

### 방화벽 규칙 추가:
```bash
gcloud compute firewall-rules create allow-3000 \
  --allow tcp:3000 \
  --source-ranges 0.0.0.0/0 \
  --description "Allow port 3000"
```

### 외부 IP 확인:
```bash
gcloud compute instances describe tving-newsletter \
  --zone=asia-northeast3-a \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)'
```

**접속 URL:** `http://[외부IP]:3000`

---

## 관리 명령어

```bash
# 서버 상태 확인
pm2 status

# 로그 보기
pm2 logs tving-newsletter

# 서버 재시작
pm2 restart tving-newsletter

# 서버 중지
pm2 stop tving-newsletter

# 수동 뉴스레터 발송
cd ~/tving-newsletter && node src/testSend.js
```

---

## 비용 예상

| 항목 | 월 비용 |
|------|---------|
| e2-micro VM (무료 티어) | $0 |
| 무료 티어 초과 시 | ~$6-8/월 |

> 💡 GCP 무료 티어: e2-micro 1대, 월 30GB 아웃바운드 무료

---

## 도메인 연결 (선택)

1. 고정 IP 설정
2. Cloud DNS에서 도메인 연결
3. Nginx로 리버스 프록시 + HTTPS 설정
