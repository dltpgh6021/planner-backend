const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 1. TODO 추가
router.post('/', async (req, res) => {
    const { user_id, title, content, target_date } = req.body;
    try {
        const query = `
            INSERT INTO TODOS (user_id, title, content, target_date)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
        const values = [user_id, title, content, target_date];
        const result = await db.query(query, values);
        
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. TODO 수정 (내용 및 완료 여부)
router.patch('/:id', async (req, res) => {
    const { id } = req.params;
    const { user_id, title, content, is_completed, target_date } = req.body;
    try {
        // 본인 확인을 위해 user_id를 조건에 포함
        const query = `
            UPDATE TODOS 
            SET title = COALESCE($1, title), 
                content = COALESCE($2, content), 
                is_completed = COALESCE($3, is_completed),
                target_date = COALESCE($4, target_date)
            WHERE id = $5 AND user_id = $6
            RETURNING *;
        `;
        const values = [title, content, is_completed, target_date, id, user_id];
        const result = await db.query(query, values);

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: "해당 항목을 찾을 수 없거나 권한이 없습니다." });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. TODO 삭제
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const { user_id } = req.body; // 본인 확인용
    try {
        const query = 'DELETE FROM TODOS WHERE id = $1 AND user_id = $2 RETURNING *;';
        const result = await db.query(query, [id, user_id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: "해당 항목을 찾을 수 없거나 권한이 없습니다." });
        }
        res.json({ success: true, message: "성공적으로 삭제되었습니다." });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
