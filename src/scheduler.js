/**
 * 뉴스레터 발송 작업
 * Cloud Scheduler에서 /api/cron/send 호출로 트리거
 */

const { getLatestArticles } = require('./crawler');
const { sendNewsletterToAll } = require('./emailService');
const { addSendLog, isSentToday } = require('./database');

/**
 * 뉴스레터 발송 작업 실행
 */
async function runNewsletterJob() {
    console.log('\n========================================');
    console.log(`[Scheduler] Newsletter job started at ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
    console.log('========================================\n');

    try {
        // 0. 당일 중복 발송 체크 (KST 기준)
        const alreadySent = await isSentToday();
        if (alreadySent) {
            console.log('[Scheduler] Already sent today (KST). Skipping.');
            return { skipped: true, reason: 'already_sent_today' };
        }

        // 1. 최신 기사 20개 수집 (카테고리별 그룹화 포함)
        console.log('[Scheduler] Step 1: Fetching latest articles...');
        const articles = await getLatestArticles(20);

        if (articles.length === 0) {
            console.log('[Scheduler] No articles found. Skipping email send.');
            return;
        }

        console.log(`[Scheduler] Collected ${articles.length} articles for newsletter.`);

        // 2. 뉴스레터 발송
        console.log('\n[Scheduler] Step 2: Sending newsletter...');
        const result = await sendNewsletterToAll(articles);

        // 3. 발송 로그 저장
        await addSendLog(
            result.totalSubscribers,
            result.successCount,
            articles.length,
            'success'
        );

        console.log('\n[Scheduler] Job completed successfully and logged.');

    } catch (error) {
        console.error('[Scheduler] Job failed:', error);
        await addSendLog(0, 0, 0, 'failed');
    }
}

module.exports = {
    runNewsletterJob
};
