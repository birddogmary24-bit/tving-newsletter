/**
 * TVING 뉴스레터 서버
 * Express 기반 백엔드 API
 */

const express = require('express');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();

const { initDatabase, addSubscriber, getMaskedSubscribers, getSubscriberCount, deleteSubscriber, getActiveSubscribers, addSendLog, getSendLogs } = require('./database');
const { encryptEmail, maskEmail, decryptEmail } = require('./crypto');
const { runNewsletterJob } = require('./scheduler');
const { getLatestArticles } = require('./crawler');
const { generateEmailTemplate, sendEmail } = require('./emailService');

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// =============================================
// 관리자 인증
// =============================================

const adminTokens = new Map();

function requireAdmin(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token || !adminTokens.has(token)) {
        return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    }
    const tokenData = adminTokens.get(token);
    if (Date.now() > tokenData.expiresAt) {
        adminTokens.delete(token);
        return res.status(401).json({ success: false, message: '세션이 만료되었습니다.' });
    }
    next();
}

/**
 * POST /api/admin/login
 * 관리자 로그인
 */
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (!process.env.ADMIN_PASSWORD) {
        return res.status(500).json({ success: false, message: '관리자 비밀번호가 설정되지 않았습니다.' });
    }
    if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: '비밀번호가 틀렸습니다.' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    adminTokens.set(token, { expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
    res.json({ success: true, token });
});

/**
 * POST /api/admin/logout
 * 관리자 로그아웃
 */
app.post('/api/admin/logout', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) adminTokens.delete(token);
    res.json({ success: true });
});

// =============================================
// 공개 API
// =============================================

/**
 * POST /api/subscribe
 * 이메일 구독 등록
 */
app.post('/api/subscribe', async (req, res) => {
    try {
        const { email } = req.body;

        // 이메일 유효성 검사
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email) || email.length > 254) {
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
        const result = await addSubscriber(encryptedEmail, maskedEmail);

        if (result.success) {
            console.log(`[Subscribe] New subscriber: ${maskedEmail}`);
            return res.status(201).json({
                success: true,
                message: '구독이 완료되었습니다! 매일 오전 7:45에 뉴스레터가 발송됩니다.'
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
 * GET /api/stats
 * 서비스 통계 (공개)
 */
app.get('/api/stats', async (req, res) => {
    try {
        const count = await getSubscriberCount();

        res.json({
            success: true,
            subscriberCount: count,
            nextSend: '오전 7:45 (Cloud Scheduler)',
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
 * GET /api/cron/send
 * Cloud Scheduler용 트리거 엔드포인트
 */
app.get('/api/cron/send', async (req, res) => {
    try {
        console.log('[Cron] Newsletter trigger received');
        const result = await runNewsletterJob();
        if (result && result.skipped) {
            res.json({ success: true, skipped: true, message: '오늘 이미 발송 완료 (KST)' });
        } else {
            res.json({ success: true, message: 'Newsletter sent successfully' });
        }
    } catch (error) {
        console.error('[Cron] Job failed:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// =============================================
// 관리자 API (인증 필요)
// =============================================

/**
 * GET /api/subscribers
 * 구독자 목록 조회 (마스킹 버전)
 */
app.get('/api/subscribers', requireAdmin, async (req, res) => {
    try {
        const subscribers = await getMaskedSubscribers();
        const count = await getSubscriberCount();

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
 * DELETE /api/subscribers/:id
 * 구독자 삭제
 */
app.delete('/api/subscribers/:id', requireAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        await deleteSubscriber(id);
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
app.post('/api/subscribers/:id/test-send', requireAdmin, async (req, res) => {
    try {
        const id = req.params.id;

        const subscribers = await getActiveSubscribers();
        const subscriber = subscribers.find(s => s.id === id);

        if (!subscriber) {
            return res.status(404).json({ success: false, message: '구독자를 찾을 수 없습니다.' });
        }

        const email = decryptEmail(subscriber.email_encrypted);
        const masked = subscriber.email_masked || maskEmail(email);
        console.log(`[Admin] Test send to: ${masked}`);

        const articles = await getLatestArticles(5);

        if (articles.length === 0) {
            return res.json({ success: false, message: '기사 수집 실패' });
        }

        const today = new Date();
        const subject = `[TVING 뉴스] ${today.getMonth() + 1}월 ${today.getDate()}일 테스트 발송`;
        const html = generateEmailTemplate(articles, today);

        await sendEmail(email, subject, html);

        res.json({ success: true, message: `${masked}로 발송 완료! (기사 ${articles.length}건)` });
    } catch (error) {
        console.error('[TestSend] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * POST /api/send-now
 * 수동 뉴스레터 발송
 */
app.post('/api/send-now', requireAdmin, async (req, res) => {
    try {
        console.log('[Admin] Manual send triggered');

        const articles = await getLatestArticles(20);

        if (articles.length === 0) {
            await addSendLog(0, 0, 0, 'failed');
            return res.json({ success: false, message: '수집된 기사가 없습니다.' });
        }

        const subscribers = await getActiveSubscribers();
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

        await addSendLog(subscribers.length, sent, articles.length, sent > 0 ? 'success' : 'failed');

        console.log(`[Admin] Sent to ${sent}/${subscribers.length} subscribers`);
        res.json({ success: true, sent, total: subscribers.length, articles: articles.length });
    } catch (error) {
        console.error('[Send-Now] Error:', error);
        await addSendLog(0, 0, 0, 'error');
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/send-logs
 * 발송 내역 조회
 */
app.get('/api/send-logs', requireAdmin, async (req, res) => {
    try {
        const logs = await getSendLogs(20);
        res.json({ success: true, logs });
    } catch (error) {
        console.error('[SendLogs] Error:', error);
        res.status(500).json({ success: false, message: '조회 실패' });
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
    await initDatabase();
    console.log('[Database] Initialized');

    app.listen(PORT, () => {
        console.log('\n========================================');
        console.log('   TVING Newsletter Server Started');
        console.log('========================================');
        console.log(`Server running at http://localhost:${PORT}`);
        console.log(`Newsletter trigger: Cloud Scheduler -> GET /api/cron/send`);
        console.log('========================================\n');
    });
}

startServer().catch(console.error);

module.exports = app;
