/**
 * 티빙 뉴스 기사 크롤러
 * 기사 ID 기반 브루트포스 방식
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { getSetting, setSetting } = require('./database');

const BASE_URL = 'https://www.tving.com/news/article/';
const USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';

// 요청 딜레이 (ms) - 서버 부하 방지
const REQUEST_DELAY = 500;

/**
 * 단일 기사 정보 크롤링
 * @param {string} articleId - 기사 ID (예: A00000136232)
 * @returns {object|null} - 기사 정보 객체 또는 null
 */
async function fetchArticle(articleId) {
    try {
        const url = `${BASE_URL}${articleId}`;
        const response = await axios.get(url, {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            },
            timeout: 10000,
        });

        const $ = cheerio.load(response.data);

        // 기사 제목
        const title = $('meta[property="og:title"]').attr('content') ||
            $('title').text().replace(' | TVING', '').trim();

        // 기사 설명
        const description = $('meta[property="og:description"]').attr('content') ||
            $('meta[name="description"]').attr('content') || '';

        // 썸네일 이미지
        const thumbnail = $('meta[property="og:image"]').attr('content') || '';

        // 기사가 존재하는지 확인 (404 페이지가 아닌지)
        if (!title || title.includes('404') || title.includes('찾을 수 없')) {
            return null;
        }

        return {
            id: articleId,
            title: title,
            description: description,
            thumbnail: thumbnail,
            url: url,
            crawledAt: new Date().toISOString()
        };
    } catch (error) {
        // 404 또는 기타 에러는 무시
        if (error.response && error.response.status === 404) {
            return null;
        }
        console.error(`Error fetching article ${articleId}:`, error.message);
        return null;
    }
}

/**
 * 기사 ID 숫자 파싱
 * @param {string} articleId - 기사 ID (예: A00000136232)
 * @returns {number} - 숫자 부분
 */
function parseArticleNum(articleId) {
    return parseInt(articleId.replace('A', ''), 10);
}

/**
 * 기사 ID 생성
 * @param {number} num - 숫자
 * @returns {string} - 기사 ID (예: A00000136232)
 */
function formatArticleId(num) {
    return 'A' + num.toString().padStart(11, '0');
}

/**
 * 오늘 기사 크롤링 (브루트포스 방식)
 * 일일 200-500개 기사 예상, 최대 600개 ID 탐색
 * @returns {Array} - 기사 목록
 */
async function crawlTodayArticles() {
    const articles = [];

    // 마지막으로 확인한 기사 ID 가져오기
    let lastCheckedId = getSetting('last_article_id') || process.env.LATEST_ARTICLE_ID || 'A00000136232';
    let startNum = parseArticleNum(lastCheckedId);

    // 최대 600개 ID 탐색 (하루 200-500개 + 여유분)
    const MAX_CHECK = 600;
    let consecutiveNotFound = 0;
    const MAX_NOT_FOUND = 20; // 연속 20개 없으면 종료

    console.log(`[Crawler] Starting from article ID: ${formatArticleId(startNum + 1)}`);
    console.log(`[Crawler] Checking up to ${MAX_CHECK} article IDs...`);

    for (let i = 1; i <= MAX_CHECK; i++) {
        const articleId = formatArticleId(startNum + i);

        // 딜레이
        if (i > 1) {
            await sleep(REQUEST_DELAY);
        }

        const article = await fetchArticle(articleId);

        if (article) {
            articles.push(article);
            consecutiveNotFound = 0;
            console.log(`[Crawler] Found: ${article.title.slice(0, 40)}...`);
        } else {
            consecutiveNotFound++;

            // 연속으로 없으면 종료
            if (consecutiveNotFound >= MAX_NOT_FOUND) {
                console.log(`[Crawler] ${MAX_NOT_FOUND} consecutive 404s, stopping search.`);
                break;
            }
        }
    }

    // 마지막 확인 ID 저장
    if (articles.length > 0) {
        const lastArticle = articles[articles.length - 1];
        setSetting('last_article_id', lastArticle.id);
        console.log(`[Crawler] Updated last_article_id to: ${lastArticle.id}`);
    }

    console.log(`[Crawler] Total articles found: ${articles.length}`);

    return articles;
}

/**
 * 슬립 함수
 * @param {number} ms - 밀리초
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 테스트용: 특정 범위 기사 크롤링
 * @param {string} startId - 시작 ID
 * @param {string} endId - 종료 ID
 * @returns {Array} - 기사 목록
 */
async function crawlArticleRange(startId, endId) {
    const articles = [];
    const startNum = parseArticleNum(startId);
    const endNum = parseArticleNum(endId);

    for (let num = startNum; num <= endNum; num++) {
        const articleId = formatArticleId(num);
        const article = await fetchArticle(articleId);

        if (article) {
            articles.push(article);
            console.log(`Found: ${articleId} - ${article.title.slice(0, 30)}...`);
        }

        await sleep(REQUEST_DELAY);
    }

    return articles;
}

// 직접 실행 시 테스트
if (require.main === module) {
    (async () => {
        console.log('Testing crawler...');

        // 단일 기사 테스트
        const article = await fetchArticle('A00000136232');
        if (article) {
            console.log('\nSample article:');
            console.log(JSON.stringify(article, null, 2));
        }

        // 범위 테스트 (10개)
        // const articles = await crawlArticleRange('A00000136225', 'A00000136235');
        // console.log(`\nFound ${articles.length} articles`);
    })();
}

module.exports = {
    fetchArticle,
    crawlTodayArticles,
    crawlArticleRange,
    formatArticleId,
    parseArticleNum
};
