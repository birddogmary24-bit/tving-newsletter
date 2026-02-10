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

        // 기사 설명 (우선순위: og:description -> .article_body 텍스트 -> meta description)
        let description = $('meta[property="og:description"]').attr('content') || '';

        // 제목과 완전히 같거나 너무 짧으면 본문에서 추출 시도
        if (!description || description === title || description.length < 50 || description.includes('TVING에서 제공하는')) {
            // 본문 선택자 시도 (티빙 뉴스 구조에 맞춰 여러 시도)
            const bodySelectors = [
                'div[class*="content"]',
                'div[class*="body"]',
                'div[class*="article"]',
                '.news_content',
                'div[class*="css-"] p',
                'p' // 모든 p 태그 시도 (최후의 수단)
            ];

            let bodyText = '';
            for (const selector of bodySelectors) {
                // p 태그인 경우 모든 p 태그의 텍스트를 합침
                let text = '';
                if (selector === 'p' || selector.endsWith(' p')) {
                    $(selector).each((i, el) => {
                        const pText = $(el).text().trim();
                        if (pText.length > 10) text += pText + ' ';
                    });
                } else {
                    text = $(selector).text().trim();
                }

                if (text && text.length > bodyText.length) {
                    bodyText = text;
                }
            }

            if (bodyText && bodyText.length > 20) {
                description = bodyText.replace(/\s+/g, ' ').substring(0, 200).trim();
            } else if (description.includes('TVING에서 제공하는')) {
                // 본문도 못 찾았는데 기존 설명이 범용 문구라면 차라리 비움
                description = '';
            }
        }

        // JSON-LD에서 설명 추출 시도 (더 정확할 수 있음)
        if (!description || description.length < 50) {
            try {
                const ldJsonText = $('script[type="application/ld+json"]').first().html();
                if (ldJsonText) {
                    const ldJson = JSON.parse(ldJsonText);
                    const ldDesc = ldJson.description || ldJson.articleBody;
                    if (ldDesc && ldDesc.length > (description?.length || 0)) {
                        description = ldDesc.replace(/\s+/g, ' ').substring(0, 200).trim();
                    }
                }
            } catch (e) {
                // ignore JSON parse error
            }
        }

        // 썸네일 이미지
        const thumbnail = $('meta[property="og:image"]').attr('content') || '';

        // 기사가 존재하는지 확인 (404 페이지가 아닌지)
        if (!title || title.includes('404') || title.includes('찾을 수 없') || title === '뉴스 | TVING') {
            return null;
        }

        // 카테고리 추출 (썸네일 URL에서 추출)
        let category = '뉴스';
        if (thumbnail) {
            const match = thumbnail.match(/ntgs\/([^/]+)\//);
            if (match && match[1]) {
                const map = {
                    'culture': '문화/연예',
                    'disaster': '사회/재난',
                    'economy': '경제',
                    'politics': '정치',
                    'news': '통합뉴스',
                    'sports': '스포츠',
                    'world': '국제',
                    'society': '사회',
                    'science': 'IT/과학',
                    'entertainment': '연예',
                    'lifestyle': '생활/문화'
                };
                category = map[match[1].toLowerCase()] || match[1];
                // 첫 글자 대문자 처리 (매핑에 없는 경우)
                if (category === match[1]) {
                    category = category.charAt(0).toUpperCase() + category.slice(1);
                }
            }
        }

        return {
            id: articleId,
            title: title,
            description: description,
            thumbnail: thumbnail,
            category: category,
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
 * 최신 기사 N개 가져오기
 * @param {number} count - 가져올 기사 수
 * @returns {Array} - 기사 목록
 */
async function getLatestArticles(totalLimit = 30) {
    console.log(`[Crawler] Fetching latest articles (goal: ${totalLimit})...`);

    // 1. 최신 ID 찾기
    let currentId = getSetting('last_article_id') || process.env.LATEST_ARTICLE_ID || 'A00000136232';
    let currentNum = parseArticleNum(currentId);

    let latestNum = currentNum;
    let consecutiveNotFound = 0;
    // 최신 기사를 찾기 위해 충분히 탐색 (150개 정도)
    for (let i = 1; i <= 150; i++) {
        const id = formatArticleId(currentNum + i);
        const a = await fetchArticle(id);
        if (a) {
            latestNum = currentNum + i;
            consecutiveNotFound = 0;
        } else {
            consecutiveNotFound++;
            if (consecutiveNotFound >= 10) break;
        }
    }

    // 2. 충분한 양의 기사를 수집 (카테고리별 그룹화를 위해 목표의 2.5배 정도 수집)
    const pool = [];
    let num = latestNum;
    let checkedCount = 0;
    const POOL_SIZE = Math.max(80, totalLimit * 2);

    while (pool.length < POOL_SIZE && checkedCount < POOL_SIZE * 1.5) {
        const id = formatArticleId(num);
        const a = await fetchArticle(id);
        if (a) {
            pool.push(a);
        }
        num--;
        checkedCount++;
        if (num < 100000) break;
        await sleep(50);
    }

    // 3. 카테고리별 그룹화 (카테고리당 최대 3개)
    const categoryGroups = {};
    for (const a of pool) {
        if (!categoryGroups[a.category]) {
            categoryGroups[a.category] = [];
        }
        if (categoryGroups[a.category].length < 3) {
            categoryGroups[a.category].push(a);
        }
    }

    // 4. 카테고리 순서 랜덤화
    const categories = Object.keys(categoryGroups);
    for (let i = categories.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [categories[i], categories[j]] = [categories[j], categories[i]];
    }

    // 5. 최종 리스트 구성 (총합 totalLimit까지)
    const finalArticles = [];
    for (const cat of categories) {
        for (const a of categoryGroups[cat]) {
            if (finalArticles.length < totalLimit) {
                finalArticles.push(a);
            }
        }
    }

    return finalArticles;
}

/**
 * 슬립 함수
 * @param {number} ms - 밀리초
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 최근 기사 크롤링 (역순 탐색 - 테스트/수동 발송용)
 * @param {number} count - 가져올 기사 수
 * @returns {Array} - 기사 목록
 */
async function crawlRecentArticles(count = 5) {
    const lastId = getSetting('last_article_id') || process.env.LATEST_ARTICLE_ID || 'A00000136232';
    const startNum = parseArticleNum(lastId);
    const articles = [];

    console.log(`[Crawler] Fetching ${count} recent articles from ${lastId}...`);

    for (let i = 0; articles.length < count && i < count * 3; i++) {
        const articleId = formatArticleId(startNum - i);
        const article = await fetchArticle(articleId);
        if (article) articles.push(article);
        if (i > 0) await sleep(200);
    }

    console.log(`[Crawler] Found ${articles.length} recent articles.`);
    return articles;
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
    crawlRecentArticles,
    crawlArticleRange,
    getLatestArticles,
    formatArticleId,
    parseArticleNum
};
