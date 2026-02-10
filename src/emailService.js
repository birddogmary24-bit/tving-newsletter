/**
 * 이메일 발송 서비스
 * Nodemailer + Gmail SMTP
 */

const nodemailer = require('nodemailer');
const { getActiveSubscribers } = require('./database');
const { decryptEmail } = require('./crypto');
require('dotenv').config();

// SMTP 트랜스포터 생성
function createTransporter() {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
}

/**
 * HTML 이메일 템플릿 생성
 * @param {Array} articles - 기사 목록
 * @param {Date} date - 발송 날짜
 * @returns {string} - HTML 문자열
 */
function generateEmailTemplate(articles, date = new Date()) {
    const formattedDate = date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
    });

    // 기사를 카테고리별로 다시 그룹화 (템플릿 렌더링용)
    const grouped = {};
    articles.forEach(article => {
        if (!grouped[article.category]) grouped[article.category] = [];
        grouped[article.category].push(article);
    });

    // 카테고리 순서 (이미 crawler에서 랜덤화해서 왔지만, 여기서 한번 더 보장)
    const sortedCategories = Object.keys(grouped);

    const categorySections = sortedCategories.map(cat => {
        const items = grouped[cat].map(article => `
        <tr>
            <td class="article-text" style="padding: 20px 0; border-bottom: 1px solid #2A2A2A;">
                <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                        ${article.thumbnail ? `
                        <td class="article-img" width="140" style="padding-right: 20px; vertical-align: top;">
                            <a href="${article.url}" target="_blank" style="display: block; overflow: hidden; border-radius: 8px; text-decoration: none;">
                                <img src="${article.thumbnail}" alt="기사" width="140" height="78" style="border-radius: 8px; object-fit: cover; display: block; border: 1px solid #333;" />
                            </a>
                        </td>
                        ` : ''}
                        <td style="vertical-align: top;">
                            <a href="${article.url}" target="_blank" style="text-decoration: none;">
                                <h3 style="margin: 0 0 6px 0; font-size: 16px; font-weight: 600; color: #FFFFFF; line-height: 1.4; letter-spacing: -0.2px;">
                                    ${article.thumbnail?.includes('/clip/') || article.title.includes('[영상') ? `<span style="display:inline-block; padding: 1px 4px; background:#FF153C; color:white; font-size:10px; border-radius:3px; margin-right:5px; vertical-align:middle;">VIDEO</span>` : ''}${article.title}
                                </h3>
                            </a>
                            <p style="margin: 0; font-size: 12px; color: #999999; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                                ${article.description ? article.description.slice(0, 100) + '...' : ''}
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
        `).join('');

        return `
        <!-- Category Section: ${cat} -->
        <tr>
            <td style="padding: 32px 0 8px 0;">
                <h2 style="margin: 0; font-size: 18px; font-weight: 800; color: #FF153C; border-left: 4px solid #FF153C; padding-left: 12px;">
                    ${cat}
                </h2>
            </td>
        </tr>
        ${items}
        `;
    }).join('');

    return `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TVING 뉴스레터</title>
    <style>
        @media screen and (max-width: 480px) {
            .container { width: 100% !important; padding: 0 10px !important; }
            .card { padding: 20px 16px !important; border-radius: 16px !important; }
            .article-list td { display: block; width: 100% !important; padding: 0 !important; }
            .article-img { width: 100% !important; height: auto !important; margin-bottom: 12px; }
            .article-img img { width: 100% !important; height: auto !important; aspect-ratio: 16/9; }
            .article-text { padding-bottom: 24px !important; border-bottom: 1px solid #2A2A2A; margin-bottom: 16px; }
            .cta-button { width: 100% !important; display: block !important; box-sizing: border-box; text-align: center; }
            h1 { font-size: 24px !important; }
            h2 { font-size: 20px !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #0D0D0D; font-family: -apple-system, BlinkMacSystemFont, 'Noto Sans KR', sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0D0D0D;">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table class="container" width="100%" style="max-width: 600px; margin: 0 auto;" cellpadding="0" cellspacing="0">
                    
                    <!-- Header -->
                    <tr>
                        <td style="padding: 0 0 32px 0; text-align: center;">
                            <h1 style="margin: 0; font-size: 28px; font-weight: 900; color: #FF153C; letter-spacing: -0.5px;">TVING</h1>
                            <p style="margin: 6px 0 0 0; font-size: 13px; color: #888888; font-weight: 500;">Newsletter</p>
                        </td>
                    </tr>
                    
                    <!-- Date Badge -->
                    <tr>
                        <td style="padding: 0 0 24px 0; text-align: center;">
                            <span style="display: inline-block; padding: 6px 14px; background: rgba(255, 21, 60, 0.1); border: 1px solid rgba(255, 21, 60, 0.2); border-radius: 50px; font-size: 12px; color: #FF153C; font-weight: 600;">
                                ${formattedDate}
                            </span>
                        </td>
                    </tr>
                    
                    <!-- Intro -->
                    <tr>
                        <td style="padding: 0 0 32px 0; text-align: center;">
                            <h2 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.5px;">
                                오늘의 하이라이트
                            </h2>
                            <p style="margin: 0; font-size: 14px; color: #888888; line-height: 1.5;">
                                엄선된 ${articles.length}개의 뉴스를 전해드립니다
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Articles Sections -->
                    <tr>
                        <td class="card" style="background: #1A1A1A; border-radius: 24px; padding: 0 24px 24px 24px;">
                            <table class="article-list" width="100%" cellpadding="0" cellspacing="0">
                                ${categorySections}
                            </table>
                        </td>
                    </tr>
                    
                    <!-- CTA Button -->
                    <tr>
                        <td style="padding: 32px 0; text-align: center;">
                            <a href="https://www.tving.com/news" target="_blank" class="cta-button"
                                style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #FF153C 0%, #E50914 100%); color: #FFFFFF; text-decoration: none; font-size: 15px; font-weight: 700; border-radius: 12px; box-shadow: 0 4px 12px rgba(255, 21, 60, 0.3);">
                                전체 뉴스 보러가기 →
                            </a>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 32px 20px 40px; border-top: 1px solid #1F1F1F; text-align: center;">
                            <p style="margin: 0 0 8px 0; font-size: 12px; color: #555555;">
                                본 메일은 TVING 뉴스레터 구독을 통해 발송되었습니다.
                            </p>
                            <p style="margin: 0; font-size: 11px; color: #444444;">
                                서울특별시 마포구 상암산로 34, DMC디지털큐브 15층(상암동) | 티빙(주)
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `;
}

/**
 * 단일 이메일 발송
 * @param {string} to - 수신자 이메일
 * @param {string} subject - 제목
 * @param {string} html - HTML 내용
 */
async function sendEmail(to, subject, html) {
    const transporter = createTransporter();

    const mailOptions = {
        from: `"TVING 뉴스레터" <${process.env.EMAIL_USER}>`,
        to: to,
        subject: subject,
        html: html,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`[Email] Sent to ${to.slice(0, 5)}***: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`[Email] Failed to send to ${to.slice(0, 5)}***:`, error.message);
        return { success: false, error: error.message };
    }
}

/**
 * 모든 구독자에게 뉴스레터 발송
 * @param {Array} articles - 기사 목록
 */
async function sendNewsletterToAll(articles) {
    if (articles.length === 0) {
        console.log('[Email] No articles to send.');
        return;
    }

    const subscribers = await getActiveSubscribers();

    if (subscribers.length === 0) {
        console.log('[Email] No subscribers.');
        return;
    }

    const today = new Date();
    const subject = `[TVING 뉴스] ${today.getMonth() + 1}월 ${today.getDate()}일 오늘의 뉴스 ${articles.length}건`;
    const html = generateEmailTemplate(articles, today);

    console.log(`[Email] Sending newsletter to ${subscribers.length} subscribers...`);

    let successCount = 0;
    let failCount = 0;

    for (const subscriber of subscribers) {
        const email = decryptEmail(subscriber.email_encrypted);
        const result = await sendEmail(email, subject, html);

        if (result.success) {
            successCount++;
        } else {
            failCount++;
        }

        // Gmail 속도 제한 방지 (일 500건)
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`[Email] Complete. Success: ${successCount}, Failed: ${failCount}`);

    return {
        successCount,
        failCount,
        totalSubscribers: subscribers.length
    };
}

// 테스트용
if (require.main === module) {
    const testArticles = [
        {
            id: 'A00000136232',
            title: '"휴대용 정수기, 플라스틱 저감 효과"…주의사항은?',
            description: '1인 가구가 증가하면서 전기 없이도 사용할 수 있는 휴대용 정수기에 대한 소비자들의 관심도 커지고 있는데요.',
            thumbnail: 'https://image.tving.com/upload/cms/caip/CAIP1500/P001735063.jpg',
            url: 'https://www.tving.com/news/article/A00000136232'
        },
        {
            id: 'A00000136231',
            title: '테스트 기사 제목입니다',
            description: '테스트 기사 설명입니다.',
            thumbnail: '',
            url: 'https://www.tving.com/news/article/A00000136231'
        }
    ];

    const html = generateEmailTemplate(testArticles);
    console.log('HTML Template generated. Length:', html.length);

    // 실제 발송 테스트 (주석 해제하여 사용)
    // sendEmail('test@example.com', '[TVING 뉴스] 테스트', html);
}

module.exports = {
    sendEmail,
    sendNewsletterToAll,
    generateEmailTemplate
};
