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

    // 기사를 카테고리별로 그룹화
    const grouped = {};
    articles.forEach(article => {
        if (!grouped[article.category]) grouped[article.category] = [];
        grouped[article.category].push(article);
    });

    const sortedCategories = Object.keys(grouped);

    const categorySections = sortedCategories.map(cat => {
        const items = grouped[cat].map(article => {
            const desc = article.description ? article.description.slice(0, 60) : '';

            return `
            <tr>
                <td style="padding:16px 0;border-bottom:1px solid #333333;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                            ${article.thumbnail ? `
                            <td class="thumb-cell" width="120" valign="top" style="padding-right:16px;padding-bottom:10px;">
                                <a href="${article.url}" target="_blank" style="text-decoration:none;">
                                    <img src="${article.thumbnail}" alt="" width="120" height="68" style="display:block;border-radius:6px;object-fit:cover;border:0;" />
                                </a>
                            </td>` : ''}
                            <td class="text-cell" valign="top">
                                <a href="${article.url}" target="_blank" style="text-decoration:none;">
                                    <span style="font-size:15px;font-weight:600;color:#FFFFFF;line-height:22px;">
                                        ${article.title}
                                    </span>
                                </a>
                                ${desc ? `<p style="margin:6px 0 0 0;font-size:13px;color:#999999;line-height:20px;">${desc}</p>` : ''}
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>`;
        }).join('');

        return `
            <tr>
                <td style="padding:28px 0 10px 0;">
                    <table cellpadding="0" cellspacing="0" border="0">
                        <tr>
                            <td width="4" style="background-color:#FF153C;">&nbsp;</td>
                            <td style="padding-left:10px;font-size:16px;font-weight:700;color:#FF153C;">${cat}</td>
                        </tr>
                    </table>
                </td>
            </tr>
            ${items}`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="ko" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>TVING 뉴스레터</title>
    <!--[if mso]>
    <style>
        table { border-collapse: collapse; }
        td { font-family: Arial, sans-serif; }
    </style>
    <![endif]-->
    <style>
        @media screen and (max-width: 480px) {
            .outer-table { width: 100% !important; }
            .inner-pad { padding: 0 12px !important; }
            .card-pad { padding: 16px !important; }
            .thumb-cell { display: block !important; width: 100% !important; padding: 0 0 10px 0 !important; }
            .thumb-cell img { width: 100% !important; height: auto !important; }
            .text-cell { display: block !important; width: 100% !important; }
        }
    </style>
</head>
<body bgcolor="#111111" style="margin:0;padding:0;background-color:#111111;-webkit-text-size-adjust:none;">
    <div style="background-color:#111111;width:100%;margin:0;padding:0;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#111111" style="background-color:#111111;">
        <tr>
            <td align="center" bgcolor="#111111" style="padding:32px 0;background-color:#111111;">
                <table class="outer-table" width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%;">

                    <!-- Header -->
                    <tr>
                        <td align="center" style="padding:0 0 28px 0;">
                            <span style="font-size:26px;font-weight:900;color:#FF153C;letter-spacing:-0.5px;">TVING</span>
                            <br>
                            <span style="font-size:12px;color:#888888;letter-spacing:1px;">NEWSLETTER</span>
                        </td>
                    </tr>

                    <!-- Date -->
                    <tr>
                        <td align="center" style="padding:0 0 24px 0;">
                            <table cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td style="padding:6px 16px;background-color:#1F1111;border:1px solid #3A1520;border-radius:20px;font-size:12px;color:#FF153C;font-weight:600;">
                                        ${formattedDate}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Intro -->
                    <tr>
                        <td align="center" style="padding:0 0 28px 0;">
                            <span style="font-size:20px;font-weight:700;color:#FFFFFF;">오늘의 하이라이트</span>
                            <br>
                            <span style="font-size:13px;color:#888888;line-height:24px;">엄선된 ${articles.length}개의 뉴스를 전해드립니다</span>
                        </td>
                    </tr>

                    <!-- Articles Card -->
                    <tr>
                        <td class="inner-pad">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#1A1A1A" style="background-color:#1A1A1A;border-radius:12px;">
                                <tr>
                                    <td class="card-pad" style="padding:8px 24px 24px 24px;">
                                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                            ${categorySections}
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- CTA Button -->
                    <tr>
                        <td align="center" style="padding:28px 0;">
                            <table cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td align="center" bgcolor="#FF153C" style="background-color:#FF153C;border-radius:8px;">
                                        <a href="https://www.tving.com/news" target="_blank" style="display:inline-block;padding:14px 36px;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:700;">
                                            전체 뉴스 보러가기 &rarr;
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding:24px 20px 32px;border-top:1px solid #222222;" align="center">
                            <span style="font-size:11px;color:#555555;line-height:18px;">
                                본 메일은 TVING 뉴스레터 구독을 통해 발송되었습니다.
                            </span>
                            <br>
                            <span style="font-size:11px;color:#444444;line-height:18px;">
                                서울특별시 마포구 상암산로 34, DMC디지털큐브 15층 | 티빙(주)
                            </span>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
    </div>
</body>
</html>`;
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
