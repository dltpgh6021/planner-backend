const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 1. 전체 루틴 목록 가져오기
router.get('/', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM routines');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. 새 루틴 추가하기 (테스트용 뼈대)
router.post('/', async (req, res) => {
    // 안드로이드 앱에서 전달받을 데이터
    const { user_id, name, description } = req.body; 
    
    try {
        // RETURNING * 을 붙이면 방금 DB에 저장된 데이터를 그대로 다시 뱉어줘서 확인하기 편해!
        const query = 'INSERT INTO routines (user_id, name, description) VALUES ($1, $2, $3) RETURNING *';
        const result = await db.query(query, [user_id, name, description]);
        
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;