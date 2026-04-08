const express = require('express');
const router = express.Router();
const db = require('../config/db'); 

// 1. 모든 유저 정보 가져오기 (테스트용)
router.get('/', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM users');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. 구글 로그인 API (나중에 여기에 실제 로그인 로직을 짤 예정)
router.post('/google-login', async (req, res) => {
    // 팀원에게 맡기거나 나중에 같이 채울 부분
    res.json({ success: true, message: "구글 로그인 기능 준비 중!" });
});

module.exports = router;