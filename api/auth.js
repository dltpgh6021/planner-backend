require('dotenv').config();
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

// 여기에 나중에 구글 클라우드 콘솔에서 발급받은 '클라이언트 ID'를 넣을 거야! (지금은 임시)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const JWT_SECRET = process.env.JWT_SECRET;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

router.get('/dev-token', (req, res) => {
    // test 유저의 정보로 JWT 토큰 강제 생성
    const testToken = jwt.sign(
        { id: "5ffd29b8-a3cc-4de2-85c8-aabd2178e06d", googld_id: "dev_test_123" }, 
        process.env.JWT_SECRET, 
        { expiresIn: '7d' }
    );
    res.json({ success: true, message: "테스트용 토큰 발급 완료!", token: testToken });
});

// 구글 로그인 & 회원가입 API (POST /api/auth/google)
router.post('/google', async (req, res) => {
    const { idToken } = req.body; // 안드로이드에서 보내준 구글 영수증(토큰)

    if (!idToken) {
        return res.status(400).json({ success: false, message: "idToken이 필요합니다." });
    }

    try {
        // 1. 구글 서버에 "이 토큰 진짜 맞아?" 하고 물어보고 내용물 까보기
        const ticket = await googleClient.verifyIdToken({
            idToken: idToken,
            audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        
        // payload 안에는 구글이 보증하는 유저 정보가 들어있어!
        const google_id = payload['sub']; // 구글 유저의 고유 ID (이게 핵심!)
        const email = payload['email'];
        const username = payload['name'];

        // 2. 우리 DB(USERS 테이블)에 이 구글 유저가 이미 가입되어 있는지 확인
        let userQuery = await db.query('SELECT * FROM USERS WHERE google_id = $1', [google_id]);
        let user = userQuery.rows[0];

        // 3. 만약 처음 온 유저라면? -> 새로 가입(INSERT) 시켜주기
        if (!user) {
            const insertQuery = `
                INSERT INTO USERS (google_id, email, username)
                VALUES ($1, $2, $3)
                RETURNING *;
            `;
            const insertResult = await db.query(insertQuery, [google_id, email, username]);
            user = insertResult.rows[0];
            console.log("🎉 새로운 유저 가입 완료:", user.username);
        } else {
            console.log("👋 기존 유저 로그인:", user.username);
        }

        // 4. 가입/로그인이 끝났으니, 우리 서버만의 'JWT 출입증' 발급해주기
        // (이 출입증에 user.id와 google_id를 담아둠)
        const token = jwt.sign(
            { id: user.id, google_id: user.google_id }, 
            JWT_SECRET, 
            { expiresIn: '7d' } // 출입증 유효기간은 7일!
        );

        // 5. 안드로이드에게 출입증(token)과 유저 정보 던져주기
        res.json({
            success: true,
            message: "로그인 성공!",
            data: {
                token: token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email
                }
            }
        });

    } catch (err) {
        console.error('구글 로그인 에러:', err);
        res.status(401).json({ success: false, message: "유효하지 않은 구글 토큰입니다.", error: err.message });
    }
});

module.exports = router;