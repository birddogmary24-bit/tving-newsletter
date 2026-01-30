/**
 * TVING Newsletter - Client-side JavaScript
 * 이메일 구독 폼 처리 및 UI 인터랙션
 */

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('subscribeForm');
    const emailInput = document.getElementById('emailInput');
    const agreeCheckbox = document.getElementById('agreeCheckbox');
    const submitBtn = form.querySelector('.subscribe-btn');
    const successMessage = document.getElementById('successMessage');
    const errorMessage = document.getElementById('errorMessage');

    // 이메일 유효성 검사
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // 에러 메시지 표시
    function showError(message) {
        errorMessage.querySelector('p').textContent = message;
        errorMessage.classList.remove('hidden');
        successMessage.classList.add('hidden');
        
        // 3초 후 자동 숨김
        setTimeout(() => {
            errorMessage.classList.add('hidden');
        }, 5000);
    }

    // 성공 메시지 표시
    function showSuccess() {
        form.classList.add('hidden');
        successMessage.classList.remove('hidden');
        errorMessage.classList.add('hidden');
        
        // 성공 애니메이션
        successMessage.style.animation = 'fadeInUp 0.5s ease-out';
    }

    // 로딩 상태 토글
    function setLoading(isLoading) {
        if (isLoading) {
            submitBtn.classList.add('loading');
            submitBtn.disabled = true;
        } else {
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
        }
    }

    // 폼 제출 처리
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = emailInput.value.trim();

        // 유효성 검사
        if (!email) {
            showError('이메일 주소를 입력해주세요.');
            emailInput.focus();
            return;
        }

        if (!isValidEmail(email)) {
            showError('올바른 이메일 형식이 아닙니다.');
            emailInput.focus();
            return;
        }

        if (!agreeCheckbox.checked) {
            showError('개인정보 수집 및 이용에 동의해주세요.');
            return;
        }

        // API 요청
        setLoading(true);

        try {
            const response = await fetch('/api/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (response.ok) {
                showSuccess();
            } else {
                showError(data.message || '구독 처리 중 오류가 발생했습니다.');
            }
        } catch (error) {
            console.error('Subscribe error:', error);
            showError('서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.');
        } finally {
            setLoading(false);
        }
    });

    // 이메일 입력 시 에러 메시지 숨김
    emailInput.addEventListener('input', () => {
        errorMessage.classList.add('hidden');
    });

    // 체크박스 클릭 시 에러 메시지 숨김
    agreeCheckbox.addEventListener('change', () => {
        errorMessage.classList.add('hidden');
    });

    // 입력 필드 포커스 시 키보드 올라올 때 스크롤 조정
    emailInput.addEventListener('focus', () => {
        setTimeout(() => {
            emailInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
    });
});
