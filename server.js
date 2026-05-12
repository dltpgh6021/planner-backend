const express = require('express');
const db = require('./config/db'); // 방금 만든 db.js 모듈 불러오기
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const todoApi = require('./api/todo');
const userApi = require('./api/user');
const routineApi = require('./api/routine');
const diaryApi = require('./api/diary');
const authApi = require('./api/auth');
const requireAuth = require('./middleware/requireAuth');

app.use('/api/todo', requireAuth, todoApi);
app.use('/api/user', requireAuth, userApi);
app.use('/api/routine', requireAuth, routineApi);
app.use('/api/diary', requireAuth, diaryApi);
app.use('/api/auth', authApi);

// 기본 서버 연결 테스트
app.get('/', (req, res) => {
    res.send('플래너 앱 백엔드 서버가 정상적으로 작동 중입니다!');
});

// DB 연결 테스트 API 생성
app.get('/test-db', async (req, res) => {
    try {
        // PostgreSQL에서 현재 시간을 가져오는 가장 간단한 쿼리 실행
        const result = await db.query('SELECT NOW()');
        res.json({
            success: true,
            message: "데이터베이스 연결 완벽 성공! 🎉",
            db_time: result.rows[0].now
        });
    } catch (err) {
        console.error('DB 연결 에러:', err);
        res.status(500).json({ 
            success: false, 
            message: "데이터베이스 연결 실패", 
            error: err.message 
        });
    }
});

app.listen(port, () => {
    console.log(`서버가 ${port}번 포트에서 실행 중입니다.`);
});