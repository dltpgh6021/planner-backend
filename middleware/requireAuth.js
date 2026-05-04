const jwt = require('jsonwebtoken');
require('dotenv').config(); // .env 파일에서 JWT_SECRET을 가져오기 위함

const JWT_SECRET = process.env.JWT_SECRET;

const requireAuth = (req, res, next) => {
    // 1. 프론트엔드가 보낸 요청의 '헤더(Headers)'에서 출입증(Token)을 꺼냄
    const authHeader = req.headers.authorization;

    // 2. 출입증이 아예 없거나, 'Bearer ' 로 시작하지 않으면 문전박대!
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: "로그인이 필요하거나 잘못된 인증 형식입니다." });
    }

    // 3. 'Bearer ' 글자를 떼어내고 순수 토큰만 추출
    const token = authHeader.split(' ')[1];

    try {
        // 4. 우리가 만든 JWT_SECRET으로 진짜 우리가 발급한 토큰이 맞는지 검증!
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // 5. 검증 성공! 토큰 안에 들어있던 유저 정보(id, google_id)를 req.user에 예쁘게 담아줌
        req.user = decoded; 
        
        // 6. 무사 통과! "다음 로직(API)으로 넘어가세요~"
        next(); 
    } catch (err) {
        // 토큰 유효기간이 끝났거나, 위조된 토큰일 경우
        res.status(401).json({ success: false, message: "유효하지 않거나 만료된 토큰입니다." });
    }
};

module.exports = requireAuth;