/**
 * Firestore 데이터베이스 모듈
 * 구독자 이메일 관리
 */

const { Firestore } = require('@google-cloud/firestore');
require('dotenv').config();

let db = null;

// 데이터베이스 초기화
async function initDatabase() {
    db = new Firestore({
        projectId: process.env.GCP_PROJECT_ID,
    });

    // 연결 테스트
    try {
        await db.collection('subscribers').limit(1).get();
        console.log('[Firestore] Connected successfully');
    } catch (error) {
        console.error('[Firestore] Connection failed:', error.message);
        throw error;
    }

    return db;
}

// Firestore는 자동 저장이므로 no-op
function saveDatabase() {}

// 데이터베이스 인스턴스 반환
function getDb() {
    return db;
}

/**
 * 구독자 추가
 */
async function addSubscriber(encryptedEmail, maskedEmail) {
    try {
        // 중복 체크
        const existing = await db.collection('subscribers')
            .where('email_encrypted', '==', encryptedEmail)
            .limit(1)
            .get();

        if (!existing.empty) {
            return { success: false, message: '이미 구독 중인 이메일입니다.' };
        }

        const docRef = await db.collection('subscribers').add({
            email_encrypted: encryptedEmail,
            email_masked: maskedEmail,
            created_at: new Date().toISOString(),
            is_active: 1
        });

        return { success: true, id: docRef.id };
    } catch (error) {
        throw error;
    }
}

/**
 * 활성 구독자 목록 조회 (암호화된 이메일)
 */
async function getActiveSubscribers() {
    const snapshot = await db.collection('subscribers')
        .where('is_active', '==', 1)
        .get();

    if (snapshot.empty) return [];

    return snapshot.docs.map(doc => ({
        id: doc.id,
        email_encrypted: doc.data().email_encrypted
    }));
}

/**
 * 구독자 목록 조회 (마스킹된 버전 - 관리자용)
 */
async function getMaskedSubscribers() {
    const snapshot = await db.collection('subscribers')
        .orderBy('created_at', 'desc')
        .get();

    if (snapshot.empty) return [];

    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            email_masked: data.email_masked,
            created_at: data.created_at,
            is_active: data.is_active
        };
    });
}

/**
 * 구독 취소
 */
async function unsubscribe(id) {
    await db.collection('subscribers').doc(id).update({ is_active: 0 });
}

/**
 * 구독자 삭제
 */
async function deleteSubscriber(id) {
    await db.collection('subscribers').doc(id).delete();
}

/**
 * 설정 값 저장
 */
async function setSetting(key, value) {
    await db.collection('settings').doc(key).set({
        value: value,
        updated_at: new Date().toISOString()
    });
}

/**
 * 설정 값 조회
 */
async function getSetting(key) {
    const doc = await db.collection('settings').doc(key).get();
    if (!doc.exists) return null;
    return doc.data().value;
}

/**
 * 구독자 수 조회
 */
async function getSubscriberCount() {
    const snapshot = await db.collection('subscribers')
        .where('is_active', '==', 1)
        .get();
    return snapshot.size;
}

/**
 * KST 날짜/시간 헬퍼
 */
function getKSTNow() {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const date = kst.toISOString().slice(0, 10); // "2026-02-11"
    const time = kst.toISOString().slice(11, 19); // "07:45:23"
    return { date, datetime: `${date} ${time}` };
}

/**
 * 오늘(KST) 이미 발송했는지 확인
 */
async function isSentToday() {
    const { date } = getKSTNow();
    const snapshot = await db.collection('send_logs')
        .where('sent_date', '==', date)
        .where('status', '==', 'success')
        .limit(1)
        .get();
    return !snapshot.empty;
}

/**
 * 발송 로그 저장
 */
async function addSendLog(totalSubscribers, successCount, articleCount, status = 'success') {
    const { date, datetime } = getKSTNow();
    await db.collection('send_logs').add({
        sent_at: datetime,
        sent_date: date,
        total_subscribers: totalSubscribers,
        success_count: successCount,
        article_count: articleCount,
        status: status
    });
}

/**
 * 발송 로그 조회 (최근 20개)
 */
async function getSendLogs(limit = 20) {
    const snapshot = await db.collection('send_logs')
        .orderBy('sent_at', 'desc')
        .limit(limit)
        .get();

    if (snapshot.empty) return [];

    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            sent_at: data.sent_at,
            total_subscribers: data.total_subscribers,
            success_count: data.success_count,
            article_count: data.article_count,
            status: data.status
        };
    });
}

module.exports = {
    initDatabase,
    getDb,
    addSubscriber,
    getActiveSubscribers,
    getMaskedSubscribers,
    unsubscribe,
    deleteSubscriber,
    setSetting,
    getSetting,
    getSubscriberCount,
    addSendLog,
    getSendLogs,
    isSentToday,
    saveDatabase
};
