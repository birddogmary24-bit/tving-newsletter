/**
 * 뉴스레터 발송 스케줄러
 * 매일 오전 7:30 실행
 */

const cron = require('node-cron');
const { crawlTodayArticles } = require('./crawler');
const { sendNewsletterToAll } = require('./emailService');

/**
 * 뉴스레터 발송 작업 실행
 */
async function runNewsletterJob() {
    console.log('\n========================================');
    console.log(`[Scheduler] Newsletter job started at ${new Date().toLocaleString('ko-KR')}`);
    console.log('========================================\n');

    try {
        // 1. 오늘 기사 크롤링
        console.log('[Scheduler] Step 1: Crawling today articles...');
        const articles = await crawlTodayArticles();

        if (articles.length === 0) {
            console.log('[Scheduler] No new articles found. Skipping email send.');
            return;
        }

        console.log(`[Scheduler] Found ${articles.length} articles.`);

        // 2. 뉴스레터 발송
        console.log('\n[Scheduler] Step 2: Sending newsletter...');
        await sendNewsletterToAll(articles);

        console.log('\n[Scheduler] Job completed successfully.');

    } catch (error) {
        console.error('[Scheduler] Job failed:', error);
    }
}

/**
 * 스케줄러 시작
 * 매일 오전 7:30 (한국 시간)
 */
function startScheduler() {
    // '30 7 * * *' = 매일 7시 30분
    cron.schedule('30 7 * * *', () => {
        runNewsletterJob();
    }, {
        timezone: 'Asia/Seoul'
    });

    console.log('[Scheduler] Newsletter scheduler started.');
    console.log('[Scheduler] Next run: Every day at 07:30 AM (Asia/Seoul)');
}

/**
 * 수동 실행 (테스트용)
 */
async function runManually() {
    console.log('[Scheduler] Manual run triggered...');
    await runNewsletterJob();
}

// 직접 실행 시
if (require.main === module) {
    runManually();
}

module.exports = {
    startScheduler,
    runNewsletterJob,
    runManually
};
