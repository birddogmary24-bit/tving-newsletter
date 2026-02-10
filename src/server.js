/**
 * TVING 뉴스레터 서버
 * Express 기반 백엔드 API
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { initDatabase, addSubscriber, getMaskedSubscribers, getSubscriberCount, deleteSubscriber, getActiveSubscribers, addSendLog, getSendLogs } = require('./database');
const { encryptEmail, maskEmail, decryptEmail } = require('./crypto');
const { startScheduler, runNewsletterJob } = require('./scheduler');
const { getLatestArticles } = require('./crawler');
const { generateEmailTemplate, sendEmail } = require('./emailService');

const app = express();
const PORT = process.env.PORT || 3000;

// 데이터베이스 초기화
initDatabase();

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// =============================================
// API 라우트
// =============================================

/**
 * POST /api/subscribe
 * 이메일 구독 등록
 */
app.post('/api/subscribe', (req, res) => {
    try {
        const { email } = req.body;

        // 이메일 유효성 검사
        if (!email || !email.includes('@')) {
            return res.status(400).json({
                success: false,
                message: '올바른 이메일 주소를 입력해주세요.'
            });
        }

        // 이메일 정규화
        const normalizedEmail = email.trim().toLowerCase();

        // 암호화 및 마스킹
        const encryptedEmail = encryptEmail(normalizedEmail);
        const maskedEmail = maskEmail(normalizedEmail);

        // DB 저장
        const result = addSubscriber(encryptedEmail, maskedEmail);

        if (result.success) {
            console.log(`[Subscribe] New subscriber: ${maskedEmail}`);
            return res.status(201).json({
                success: true,
                message: '구독이 완료되었습니다! 내일 오전 7:30에 첫 뉴스레터가 발송됩니다.'
            });
        } else {
            return res.status(409).json({
                success: false,
                message: result.message || '이미 구독 중인 이메일입니다.'
            });
        }

    } catch (error) {
        console.error('[Subscribe] Error:', error);
        return res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
        });
    }
});

/**
 * GET /api/subscribers
 * 구독자 목록 조회 (마스킹 버전 - 관리자용)
 */
app.get('/api/subscribers', (req, res) => {
    try {
        const subscribers = getMaskedSubscribers();
        const count = getSubscriberCount();

        res.json({
            success: true,
            total: count,
            subscribers: subscribers
        });

    } catch (error) {
        console.error('[Subscribers] Error:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.'
        });
    }
});

/**
 * GET /api/stats
 * 서비스 통계
 */
app.get('/api/stats', (req, res) => {
    try {
        const count = getSubscriberCount();

        res.json({
            success: true,
            subscriberCount: count,
            nextSend: '오전 7:30',
            status: 'active'
        });

    } catch (error) {
        console.error('[Stats] Error:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.'
        });
    }
});

/**
 * GET /health
 * 헬스체크
 */
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * DELETE /api/subscribers/:id
 * 구독자 삭제
 */
app.delete('/api/subscribers/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        deleteSubscriber(id);
        console.log(`[Admin] Deleted subscriber ID: ${id}`);
        res.json({ success: true, message: '삭제되었습니다.' });
    } catch (error) {
        console.error('[Delete] Error:', error);
        res.status(500).json({ success: false, message: '삭제 실패' });
    }
});

/**
 * POST /api/subscribers/:id/test-send
 * 특정 구독자에게 테스트 발송
 */
app.post('/api/subscribers/:id/test-send', async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        // 구독자 찾기
        const subscribers = getActiveSubscribers();
        const subscriber = subscribers.find(s => s.id === id);

        if (!subscriber) {
            return res.status(404).json({ success: false, message: '구독자를 찾을 수 없습니다.' });
        }

        const email = decryptEmail(subscriber.email_encrypted);
        console.log(`[Admin] Test send to ID ${id}: ${email}`);

        // 최근 기사 5개 수집 (카테고리별 그룹화 포함)
        const articles = await getLatestArticles(5);

        if (articles.length === 0) {
            return res.json({ success: false, message: '기사 수집 실패' });
        }

        const today = new Date();
        const subject = `[TVING 뉴스] ${today.getMonth() + 1}월 ${today.getDate()}일 테스트 발송`;
        const html = generateEmailTemplate(articles, today);

        await sendEmail(email, subject, html);

        res.json({ success: true, message: `${email}로 발송 완료! (기사 ${articles.length}건)` });
    } catch (error) {
        console.error('[TestSend] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * POST /api/send-now
 * 수동 뉴스레터 발송
 */
app.post('/api/send-now', async (req, res) => {
    try {
        console.log('[Admin] Manual send triggered');

        // 최근 기사 20개 수집 (카테고리별 그룹화 포함)
        const articles = await getLatestArticles(20);

        if (articles.length === 0) {
            addSendLog(0, 0, 0, 'failed');
            return res.json({ success: false, message: '수집된 기사가 없습니다.' });
        }

        // 구독자에게 발송
        const subscribers = getActiveSubscribers();
        const today = new Date();
        const subject = `[TVING 뉴스] ${today.getMonth() + 1}월 ${today.getDate()}일 뉴스레터`;
        const html = generateEmailTemplate(articles, today);

        let sent = 0;
        for (const sub of subscribers) {
            try {
                const email = decryptEmail(sub.email_encrypted);
                await sendEmail(email, subject, html);
                sent++;
            } catch (e) {
                console.error('[Send] Failed:', e.message);
            }
        }

        // 발송 로그 저장
        addSendLog(subscribers.length, sent, articles.length, sent > 0 ? 'success' : 'failed');

        console.log(`[Admin] Sent to ${sent}/${subscribers.length} subscribers`);
        res.json({ success: true, sent, total: subscribers.length, articles: articles.length });
    } catch (error) {
        console.error('[Send-Now] Error:', error);
        addSendLog(0, 0, 0, 'error');
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/send-logs
 * 발송 내역 조회
 */
app.get('/api/send-logs', (req, res) => {
    try {
        const logs = getSendLogs(20);
        res.json({ success: true, logs });
    } catch (error) {
        console.error('[SendLogs] Error:', error);
        res.status(500).json({ success: false, message: '조회 실패' });
    }
});

/**
 * GET /api/cron/send
 * Cloud Scheduler용 트리거 엔드포인트
 */
app.get('/api/cron/send', async (req, res) => {
    try {
        console.log('[Cron] Newsletter trigger received');
        await runNewsletterJob();
        res.json({ success: true, message: 'Newsletter job started' });
    } catch (error) {
        console.error('[Cron] Job failed:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// SPA 폴백 (모든 경로를 index.html로)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// =============================================
// 서버 시작
// =============================================

async function startServer() {
    // 데이터베이스 초기화 (비동기)
    await initDatabase();
    console.log('[Database] Initialized');

    app.listen(PORT, () => {
        console.log('\n========================================');
        console.log('   TVING Newsletter Server Started');
        console.log('========================================');
        console.log(`🚀 Server running at http://localhost:${PORT}`);
        console.log(`📧 Newsletter scheduled for 07:30 AM daily`);
        console.log('========================================\n');

        // 스케줄러 시작
        startScheduler();
    });
}

startServer().catch(console.error);

module.exports = app;
Pressi
