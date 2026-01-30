/**
 * 이메일 암호화/복호화 모듈
 * AES-256-CBC 알고리즘 사용
 */

const crypto = require('crypto');
require('dotenv').config();

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'tving-newsletter-secret-key-32c';
const IV_LENGTH = 16;

/**
 * 이메일 암호화
 * @param {string} email - 원본 이메일 주소
 * @returns {string} - 암호화된 문자열 (iv:encrypted 형식)
 */
function encryptEmail(email) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(email, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
}

/**
 * 이메일 복호화
 * @param {string} encryptedEmail - 암호화된 이메일 (iv:encrypted 형식)
 * @returns {string} - 원본 이메일 주소
 */
function decryptEmail(encryptedEmail) {
    const parts = encryptedEmail.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

/**
 * 이메일 마스킹
 * example@gmail.com → ex***le@gm***.com
 * @param {string} email - 원본 이메일 주소
 * @returns {string} - 마스킹된 이메일 주소
 */
function maskEmail(email) {
    const [localPart, domain] = email.split('@');

    // 로컬 파트 마스킹
    let maskedLocal;
    if (localPart.length <= 2) {
        maskedLocal = localPart[0] + '*';
    } else if (localPart.length <= 4) {
        maskedLocal = localPart[0] + '***' + localPart[localPart.length - 1];
    } else {
        maskedLocal = localPart.slice(0, 2) + '***' + localPart.slice(-2);
    }

    // 도메인 마스킹
    const domainParts = domain.split('.');
    let maskedDomain;
    if (domainParts[0].length <= 2) {
        maskedDomain = domainParts[0][0] + '***';
    } else {
        maskedDomain = domainParts[0].slice(0, 2) + '***';
    }

    // TLD 유지
    const tld = domainParts.slice(1).join('.');

    return `${maskedLocal}@${maskedDomain}.${tld}`;
}

module.exports = {
    encryptEmail,
    decryptEmail,
    maskEmail
};
