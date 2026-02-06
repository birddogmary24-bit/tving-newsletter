
const { fetchArticle } = require('./src/crawler');

(async () => {
    // 최근 기사 ID로 추정되는 번호로 테스트
    // 사용자가 보고 있는 기사: A00000137129 (2심서 뒤집힌 '사법농단'…)
    const articleId = 'A00000137129'; 
    console.log(`Checking article: ${articleId}`);
    
    const article = await fetchArticle(articleId);
    
    if (article) {
        console.log('--- Crawled Data ---');
        console.log(JSON.stringify(article, null, 2));
    } else {
        console.log('Failed to fetch article.');
    }
})();
