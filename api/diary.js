const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 1. 일기 작성
router.post('/', async (req, res) => {
    const { user_id, content, target_date } = req.body;
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

// 2. 일기 수정
router.patch('/:id', async (req, res) => {
    const { id } = req.params;
    const { user_id, content } = req.body;
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

// 3. 일기 삭제
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const { user_id } = req.body;
    try {
        const query = 'DELETE FROM DIARIES WHERE id = $1 AND user_id = $2 RETURNING *;';
        const result = await db.query(query, [id, user_id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: "일기를 찾을 수 없거나 권한이 없습니다." });
        }
        res.json({ success: true, message: "일기가 삭제되었습니다." });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
