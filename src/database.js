/**
 * SQLite 데이터베이스 모듈 (sql.js 기반)
 * 구독자 이메일 관리
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'subscribers.db');
let db = null;

// 데이터베이스 초기화
async function initDatabase() {
    const SQL = await initSqlJs();

    // 기존 DB 파일이 있으면 로드
    if (fs.existsSync(DB_PATH)) {
        const buffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(buffer);
    } else {
        db = new SQL.Database();
    }

    // 테이블 생성
    db.run(`
        CREATE TABLE IF NOT EXISTS subscribers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email_encrypted TEXT NOT NULL UNIQUE,
            email_masked TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            is_active INTEGER DEFAULT 1
        )
    `);

    // 설정 테이블
    db.run(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT DEFAULT (datetime('now'))
        )
    `);

    // 발송 로그 테이블
    db.run(`
        CREATE TABLE IF NOT EXISTS send_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sent_at TEXT DEFAULT (datetime('now')),
            total_subscribers INTEGER DEFAULT 0,
            success_count INTEGER DEFAULT 0,
            article_count INTEGER DEFAULT 0,
            status TEXT DEFAULT 'success'
        )
    `);

    saveDatabase();
    return db;
}

// 데이터베이스 저장
function saveDatabase() {
    if (db) {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
    }
}

// 데이터베이스 가져오기
function getDb() {
    return db;
}

/**
 * 구독자 추가
 */
function addSubscriber(encryptedEmail, maskedEmail) {
    try {
        db.run(`
            INSERT INTO subscribers (email_encrypted, email_masked)
            VALUES (?, ?)
        `, [encryptedEmail, maskedEmail]);
        saveDatabase();

        const result = db.exec(`SELECT last_insert_rowid() as id`);
        const id = result[0]?.values[0]?.[0] || 0;
        return { success: true, id };
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return { success: false, message: '이미 구독 중인 이메일입니다.' };
        }
        throw error;
    }
}

/**
 * 활성 구독자 목록 조회 (암호화된 이메일)
 */
function getActiveSubscribers() {
    const result = db.exec(`
        SELECT id, email_encrypted FROM subscribers WHERE is_active = 1
    `);

    if (!result[0]) return [];

    return result[0].values.map(row => ({
        id: row[0],
        email_encrypted: row[1]
    }));
}

/**
 * 구독자 목록 조회 (마스킹된 버전 - 관리자용)
 */
function getMaskedSubscribers() {
    const result = db.exec(`
        SELECT id, email_masked, created_at, is_active FROM subscribers ORDER BY created_at DESC
    `);

    if (!result[0]) return [];

    return result[0].values.map(row => ({
        id: row[0],
        email_masked: row[1],
        created_at: row[2],
        is_active: row[3]
    }));
}

/**
 * 구독 취소
 */
function unsubscribe(id) {
    db.run(`UPDATE subscribers SET is_active = 0 WHERE id = ?`, [id]);
    saveDatabase();
}

/**
 * 구독자 삭제
 */
function deleteSubscriber(id) {
    db.run(`DELETE FROM subscribers WHERE id = ?`, [id]);
    saveDatabase();
}

/**
 * 설정 값 저장
 */
function setSetting(key, value) {
    db.run(`
        INSERT OR REPLACE INTO settings (key, value, updated_at)
        VALUES (?, ?, datetime('now'))
    `, [key, value]);
    saveDatabase();
}

/**
 * 설정 값 조회
 */
function getSetting(key) {
    const result = db.exec(`SELECT value FROM settings WHERE key = ?`, [key]);
    if (!result[0] || !result[0].values[0]) return null;
    return result[0].values[0][0];
}

/**
 * 구독자 수 조회
 */
function getSubscriberCount() {
    const result = db.exec(`SELECT COUNT(*) as count FROM subscribers WHERE is_active = 1`);
    if (!result[0]) return 0;
    return result[0].values[0][0];
}

/**
 * 발송 로그 저장
 */
function addSendLog(totalSubscribers, successCount, articleCount, status = 'success') {
    db.run(`
        INSERT INTO send_logs (total_subscribers, success_count, article_count, status)
        VALUES (?, ?, ?, ?)
    `, [totalSubscribers, successCount, articleCount, status]);
    saveDatabase();
}

/**
 * 발송 로그 조회 (최근 20개)
 */
function getSendLogs(limit = 20) {
    const result = db.exec(`
        SELECT id, sent_at, total_subscribers, success_count, article_count, status 
        FROM send_logs 
        ORDER BY sent_at DESC 
        LIMIT ?
    `, [limit]);

    if (!result[0]) return [];

    return result[0].values.map(row => ({
        id: row[0],
        sent_at: row[1],
        total_subscribers: row[2],
        success_count: row[3],
        article_count: row[4],
        status: row[5]
    }));
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
    saveDatabase
};
