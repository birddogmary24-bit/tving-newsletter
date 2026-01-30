# GitHub 저장소 설정 가이드

## 1단계: GitHub 저장소 생성

1. https://github.com 접속 (birddogmary24 계정으로 로그인)
2. 우측 상단 `+` 버튼 → `New repository` 클릭
3. 저장소 설정:
   - **Repository name**: `tving-newsletter`
   - **Description**: "TVING 뉴스 자동 수집 및 이메일 뉴스레터 서비스"
   - **Visibility**: **Private** (민감한 정보 포함)
   - ❌ README, .gitignore, license 추가 **체크 해제**
4. `Create repository` 클릭

## 2단계: 원격 저장소 연결 (저장소 생성 후 실행)

```bash
cd /Users/waynepark/Documents/AI/tving-newsletter
git remote add origin https://github.com/birddogmary24/tving-newsletter.git
git branch -M main
git push -u origin main
```

## 3단계: 다른 컴퓨터에서 작업

```bash
# 최초 클론
git clone https://github.com/birddogmary24/tving-newsletter.git
cd tving-newsletter

# .env 파일 생성 (수동)
cp .env.example .env
# .env 파일에 실제 값 입력

# 의존성 설치
npm install

# 서버 실행
node src/server.js
```

## 작업 동기화

```bash
# 작업 시작 전 (최신 코드 받기)
git pull origin main

# 작업 완료 후 (변경사항 업로드)
git add .
git commit -m "작업 내용 설명"
git push origin main
```

## 주의사항

- `.env` 파일은 Git에 포함되지 않으므로 각 환경에서 수동으로 생성 필요
- `data/` 폴더(구독자 DB)도 Git에서 제외됨
- 작업 전 항상 `git pull`로 최신 코드 받기
