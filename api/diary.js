const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 일기 작성
router.post('/', async (req, res) => {
    const { content, target_date } = req.body;
    const user_id = req.user.id;
    try {
        const query = `
            INSERT INTO DIARIES (user_id, content, target_date)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;
        const values = [user_id, content, target_date];
        const result = await db.query(query, values);
        
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 일기 조회
// 특정 날짜의 일기 조회
router.get('/', async (req, res) => {
    const { target_date } = req.query;
    const user_id = req.user.id;
    if (!user_id || !target_date) {
        return res.status(400).json({ success: false, message: "user_id와 target_date가 필요합니다." });
    }
    try {
        const query = 'SELECT * FROM DIARIES WHERE user_id = $1 AND target_date = $2;';
        const result = await db.query(query, [user_id, target_date]);
        res.json({ success: true, data: result.rows.length > 0 ? result.rows[0] : null });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 일기 내용으로 조회
router.get('/search', async (req, res) => {
    // 검색어(keyword)도 query에서 받아옵니다.
    const { keyword } = req.query;
    const user_id = req.user.id;

    if (!user_id || !keyword) {
        return res.status(400).json({ success: false, message: "user_id와 keyword가 필요합니다." });
    }

    try {
        // PostgreSQL 꿀팁: ILIKE를 쓰면 영어 대소문자를 구분하지 않고 찾아줘!
        // ORDER BY target_date DESC: 가장 최근 일기부터 먼저 보여주기
        const query = `
            SELECT * FROM DIARIES 
            WHERE user_id = $1 AND content ILIKE $2
            ORDER BY target_date DESC;
        `;
        
        // 검색어 앞뒤로 '%'를 붙여서, 해당 단어가 중간에 포함된 모든 일기를 찾음
        const values = [user_id, `%${keyword}%`]; 
        const result = await db.query(query, values);

        // 검색 결과가 없으면 정상적으로 빈 배열([])을 프론트엔드로 반환!
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('일기 검색 중 에러:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 일기 수정
router.patch('/:id', async (req, res) => {
    const { id } = req.params;
    const { content } = req.body;
    const user_id = req.user.id;
    try {
        const query = `
            UPDATE DIARIES 
            SET content = $1
            WHERE id = $2 AND user_id = $3
            RETURNING *;
        `;
        const result = await db.query(query, [content, id, user_id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: "일기를 찾을 수 없거나 권한이 없습니다." });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 일기 삭제
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id;
    try {
        const query = 'DELETE FROM DIARIES WHERE id = $1 AND user_id = $2 RETURNING *;';
        const result = await db.query(query, [id, user_id]);
        if (result.rowCount === 0) return res.status(404).json({ success: false, message: "항목을 찾을 수 없거나 권한이 없습니다." });
        res.json({ success: true, message: "성공적으로 삭제되었습니다." });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
