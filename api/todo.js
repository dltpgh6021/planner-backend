const express = require('express');
const router = express.Router();
const db = require('../config/db'); // 경로 주의!

// 할 일 목록 가져오기
router.get('/', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM todos');
        res.json(result.rows);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

module.exports = router;