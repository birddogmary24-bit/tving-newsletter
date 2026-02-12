/**
 * 수동 테스트 발송 스크립트
 * 특정 이메일 주소로 뉴스레터 즉시 발송
 */

require('dotenv').config();
const nodemailer = require('nodemailer');
const { fetchArticle } = require('./crawler');
const { generateEmailTemplate } = require('./emailService');

const TEST_RECIPIENTS = [
    process.env.TEST_EMAIL || process.env.EMAIL_USER
];

async function runManualTest() {
    console.log('========================================');
    console.log('   TVING Newsletter 수동 테스트 발송');
    console.log('========================================\n');

    // 1. 몇 개의 기사 크롤링
    console.log('[1/3] 기사 크롤링 중...');
    const articleIds = [
        'A00000137129', // 최근 기사 (사법농단)
        'A00000137128',
        'A00000137127'
    ];

    const articles = [];
    for (const id of articleIds) {
        const article = await fetchArticle(id);
        if (article) {
            articles.push(article);
            console.log(`  ✓ ${article.title.slice(0, 40)}...`);
        }
        await new Promise(r => setTimeout(r, 500));
    }

    console.log(`\n  총 ${articles.length}개 기사 수집 완료\n`);

    if (articles.length === 0) {
        console.log('❌ 수집된 기사가 없습니다.');
        return;
    }

    // 2. 이메일 템플릿 생성
    console.log('[2/3] 이메일 템플릿 생성 중...');
    const today = new Date();
    const subject = `[TVING 뉴스] ${today.getMonth() + 1}월 ${today.getDate()}일 오늘의 뉴스 ${articles.length}건`;
    const html = generateEmailTemplate(articles, today);
    console.log('  ✓ 템플릿 생성 완료\n');

    // 3. 이메일 발송
    console.log('[3/3] 이메일 발송 중...');
    console.log(`  발신: ${process.env.EMAIL_USER}`);
    console.log(`  수신: ${TEST_RECIPIENTS.join(', ')}\n`);

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    for (const recipient of TEST_RECIPIENTS) {
        try {
            const info = await transporter.sendMail({
                from: `"TVING 뉴스레터" <${process.env.EMAIL_USER}>`,
                to: recipient,
                subject: subject,
                html: html,
            });
            console.log(`  ✓ ${recipient} - 발송 성공 (${info.messageId})`);
        } catch (error) {
            console.log(`  ✗ ${recipient} - 발송 실패: ${error.message}`);
        }

        await new Promise(r => setTimeout(r, 1000));
    }

    console.log('\n========================================');
    console.log('   테스트 발송 완료!');
    console.log('========================================');
}

runManualTest().catch(console.error);
