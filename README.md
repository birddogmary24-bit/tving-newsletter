# TVING Newsletter Service

티빙 뉴스 자동 수집 및 이메일 뉴스레터 서비스

## 📋 주요 기능

- 🔄 **자동 뉴스 크롤링**: TVING 뉴스 사이트에서 최신 기사 수집
- 📧 **이메일 뉴스레터**: 매일 오전 7:30 자동 발송
- 🔐 **구독자 관리**: 이메일 암호화 저장 및 관리
- 📱 **모바일 최적화**: 반응형 웹 디자인
- 👨‍💼 **관리자 페이지**: 구독자 관리, 발송 내역, 테스트 발송

## 🛠 기술 스택

- **Backend**: Node.js, Express
- **Database**: SQLite (sql.js)
- **Email**: Nodemailer (Gmail SMTP)
- **Scheduler**: node-cron
- **Deployment**: GCP Compute Engine

## 🚀 로컬 실행

```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일에 Gmail 계정 정보 입력

# 서버 실행
node src/server.js
```

## 📦 배포

GCP Compute Engine 배포 가이드는 `DEPLOY_GCP.md` 참고

## 🔑 환경 변수

```
PORT=3000
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
ENCRYPTION_KEY=your-32-char-encryption-key
```

## 📂 프로젝트 구조

```
tving-newsletter/
├── src/
│   ├── server.js          # Express 서버
│   ├── database.js        # SQLite DB 관리
│   ├── crawler.js         # 뉴스 크롤링
│   ├── emailService.js    # 이메일 발송
│   ├── scheduler.js       # 스케줄러
│   └── crypto.js          # 암호화
├── public/
│   ├── index.html         # 구독 페이지
│   ├── admin.html         # 관리자 페이지
│   ├── styles.css
│   └── script.js
└── data/
    └── subscribers.db     # 구독자 DB (gitignore)
```

## 🔒 보안

- 이메일 주소는 AES-256-CBC로 암호화 저장
- 관리자 페이지는 비밀번호로 보호
- `.env` 파일은 Git에서 제외

## 📝 라이선스

MIT License
