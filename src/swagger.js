/**
 * OpenAPI 3.0 스펙 정의
 * TVING 뉴스레터 API 문서
 */

const swaggerSpec = {
    openapi: '3.0.0',
    info: {
        title: 'TVING 뉴스레터 API',
        version: '1.0.0',
        description: '티빙 뉴스레터 구독 서비스 API — 매일 오전 7:30 뉴스 기사 이메일 발송 (Cloud Scheduler)',
    },
    servers: [
        { url: 'http://localhost:3000', description: 'Local' },
    ],
    tags: [
        { name: 'Public', description: '공개 API' },
        { name: 'Auth', description: '관리자 인증' },
        { name: 'Admin', description: '관리자 전용 API (Bearer Token 필요)' },
        { name: 'System', description: '시스템 / 스케줄러' },
    ],
    components: {
        securitySchemes: {
            BearerAuth: {
                type: 'http',
                scheme: 'bearer',
                description: 'POST /api/admin/login 으로 발급받은 토큰',
            },
        },
    },
    paths: {
        // ─── Public ───
        '/api/subscribe': {
            post: {
                tags: ['Public'],
                summary: '이메일 구독 등록',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['email'],
                                properties: {
                                    email: { type: 'string', format: 'email', example: 'user@example.com' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: {
                        description: '구독 성공',
                        content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, message: { type: 'string' } } } } },
                    },
                    400: { description: '잘못된 이메일 형식' },
                    409: { description: '이미 구독 중인 이메일' },
                    500: { description: '서버 오류' },
                },
            },
        },
        '/api/stats': {
            get: {
                tags: ['Public'],
                summary: '서비스 통계 조회',
                responses: {
                    200: {
                        description: '통계 정보',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        subscriberCount: { type: 'integer', example: 6 },
                                        nextSend: { type: 'string', example: '오전 7:30 (Cloud Scheduler)' },
                                        status: { type: 'string', example: 'active' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/health': {
            get: {
                tags: ['System'],
                summary: '헬스체크',
                responses: {
                    200: {
                        description: '서버 상태',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string', example: 'ok' },
                                        timestamp: { type: 'string', format: 'date-time' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },

        // ─── Auth ───
        '/api/admin/login': {
            post: {
                tags: ['Auth'],
                summary: '관리자 로그인',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['password'],
                                properties: {
                                    password: { type: 'string', example: 'your-admin-password' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: '로그인 성공',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        token: { type: 'string', example: 'a1b2c3d4...' },
                                    },
                                },
                            },
                        },
                    },
                    401: { description: '비밀번호 불일치' },
                },
            },
        },
        '/api/admin/logout': {
            post: {
                tags: ['Auth'],
                summary: '관리자 로그아웃',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: {
                        description: '로그아웃 성공',
                        content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true } } } } },
                    },
                },
            },
        },

        // ─── Admin ───
        '/api/subscribers': {
            get: {
                tags: ['Admin'],
                summary: '구독자 목록 조회 (마스킹)',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: {
                        description: '구독자 목록',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        total: { type: 'integer', example: 6 },
                                        subscribers: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    id: { type: 'string' },
                                                    email_masked: { type: 'string', example: 'ex***le@gm***.com' },
                                                    created_at: { type: 'string' },
                                                    is_active: { type: 'integer', example: 1 },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    401: { description: '인증 필요' },
                },
            },
        },
        '/api/subscribers/{id}': {
            delete: {
                tags: ['Admin'],
                summary: '구독자 삭제',
                security: [{ BearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Firestore 문서 ID' },
                ],
                responses: {
                    200: {
                        description: '삭제 성공',
                        content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, message: { type: 'string' } } } } },
                    },
                    401: { description: '인증 필요' },
                    500: { description: '삭제 실패' },
                },
            },
        },
        '/api/subscribers/{id}/test-send': {
            post: {
                tags: ['Admin'],
                summary: '특정 구독자에게 테스트 발송',
                security: [{ BearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Firestore 문서 ID' },
                ],
                responses: {
                    200: {
                        description: '발송 결과',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        message: { type: 'string', example: 'ex***le@gm***.com로 발송 완료! (기사 5건)' },
                                    },
                                },
                            },
                        },
                    },
                    401: { description: '인증 필요' },
                    404: { description: '구독자 없음' },
                },
            },
        },
        '/api/send-now': {
            post: {
                tags: ['Admin'],
                summary: '수동 뉴스레터 발송 (전체)',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: {
                        description: '발송 결과',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        sent: { type: 'integer', example: 6 },
                                        total: { type: 'integer', example: 6 },
                                        articles: { type: 'integer', example: 20 },
                                    },
                                },
                            },
                        },
                    },
                    401: { description: '인증 필요' },
                    500: { description: '발송 실패' },
                },
            },
        },
        '/api/send-logs': {
            get: {
                tags: ['Admin'],
                summary: '발송 내역 조회 (최근 20건)',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: {
                        description: '발송 로그 목록',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        logs: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    id: { type: 'string' },
                                                    sent_at: { type: 'string', example: '2026-02-12 07:30:00' },
                                                    total_subscribers: { type: 'integer' },
                                                    success_count: { type: 'integer' },
                                                    article_count: { type: 'integer' },
                                                    status: { type: 'string', enum: ['success', 'failed', 'error'] },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    401: { description: '인증 필요' },
                },
            },
        },

        // ─── System ───
        '/api/cron/send': {
            get: {
                tags: ['System'],
                summary: 'Cloud Scheduler 뉴스레터 트리거',
                description: 'Cloud Scheduler가 호출하는 엔드포인트. 오늘 이미 발송했으면 skip.',
                responses: {
                    200: {
                        description: '실행 결과',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        skipped: { type: 'boolean' },
                                        message: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    500: { description: '발송 실패' },
                },
            },
        },
    },
};

module.exports = swaggerSpec;
