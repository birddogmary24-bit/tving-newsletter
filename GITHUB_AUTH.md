# GitHub 연결 가이드

## 문제 상황
GitHub 푸시 시 인증 오류가 발생했습니다.

## 해결 방법: Personal Access Token 사용

### 1단계: GitHub에서 저장소 생성 확인
1. https://github.com/birddogmary24 접속
2. Repositories 탭에서 `tving-newsletter` 저장소가 있는지 확인
3. 없다면 생성:
   - New repository 클릭
   - Repository name: `tving-newsletter`
   - **Private** 선택
   - Create repository

### 2단계: Personal Access Token 생성
1. GitHub 우측 상단 프로필 → Settings
2. 왼쪽 메뉴 맨 아래 **Developer settings**
3. **Personal access tokens** → **Tokens (classic)**
4. **Generate new token** → **Generate new token (classic)**
5. 설정:
   - Note: `tving-newsletter-token`
   - Expiration: **No expiration** (또는 원하는 기간)
   - Select scopes: **repo** 전체 체크 ✅
6. **Generate token** 클릭
7. **토큰 복사** (한 번만 표시됨!)

### 3단계: 토큰으로 푸시
터미널에서 실행:

```bash
cd /Users/waynepark/Documents/AI/tving-newsletter

# 원격 저장소 URL을 토큰 포함 형식으로 변경
git remote set-url origin https://YOUR_TOKEN@github.com/birddogmary24/tving-newsletter.git

# 푸시
git push -u origin main
```

**YOUR_TOKEN** 부분을 복사한 토큰으로 교체하세요!

### 4단계: 다른 컴퓨터에서 클론
```bash
git clone https://YOUR_TOKEN@github.com/birddogmary24/tving-newsletter.git
```

## 보안 주의사항
- 토큰은 비밀번호처럼 안전하게 보관
- 절대 공개 저장소에 커밋하지 말 것
- 토큰이 유출되면 즉시 삭제하고 재생성

## 대안: SSH 키 사용
더 안전한 방법은 SSH 키를 사용하는 것입니다. 필요하면 안내해드릴게요!
