const express = require('express');
const router = express.Router();
const db = require('../config/db');

// title·content·routineTags·listTags를 JSON으로 묶어 content 컬럼 하나에 저장
function pack(title, content, routineTags, listTags) {
    return JSON.stringify({
        title:       title       || '',
        content:     content     || '',
        routineTags: Array.isArray(routineTags) ? routineTags : [],
        listTags:    Array.isArray(listTags)    ? listTags    : [],
    });
}

function unpack(row) {
    try {
        const p = JSON.parse(row.content);
        const routineTags = Array.isArray(p.routineTags) ? p.routineTags : [];
        // 구형 'tags' 필드 호환: 기존 데이터는 listTags로 취급
        const listTags    = Array.isArray(p.listTags) ? p.listTags
                          : Array.isArray(p.tags)     ? p.tags : [];
        return {
            id:          String(row.id),
            target_date: row.target_date || '',
            title:       p.title   || '',
            content:     p.content || '',
            routineTags,
            listTags,
        };
    } catch (_) {
        return {
            id:          String(row.id),
            target_date: row.target_date || '',
            title:       '',
            content:     row.content || '',
            routineTags: [],
            listTags:    [],
        };
    }
}

// DATE를 timezone 영향 없이 "YYYY-MM-DD" 문자열로 가져오는 SELECT 절
const SELECT = `id, user_id, content, TO_CHAR(target_date, 'YYYY-MM-DD') AS target_date`;

// 일기 작성
router.post('/', async (req, res) => {
    const { title, content, target_date, routineTags, listTags } = req.body;
    const user_id = req.user.id;
    try {
        const result = await db.query(
            `INSERT INTO DIARIES (user_id, content, target_date)
             VALUES ($1, $2, $3)
             RETURNING ${SELECT}`,
            [user_id, pack(title, content, routineTags, listTags), target_date]
        );
        res.status(201).json({ success: true, data: unpack(result.rows[0]) });
    } catch (err) {
        console.error('일기 작성 오류:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 전체 일기 목록 조회
router.get('/all', async (req, res) => {
    const user_id = req.user.id;
    try {
        const result = await db.query(
            `SELECT ${SELECT} FROM DIARIES WHERE user_id = $1 ORDER BY target_date DESC`,
            [user_id]
        );
        res.json({ success: true, data: result.rows.map(unpack) });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 키워드 검색 (제목·내용·태그 모두)
router.get('/search', async (req, res) => {
    const { keyword } = req.query;
    const user_id = req.user.id;
    if (!keyword) return res.status(400).json({ success: false, message: 'keyword가 필요합니다.' });
    try {
        const result = await db.query(
            `SELECT ${SELECT} FROM DIARIES
             WHERE user_id = $1 AND content ILIKE $2
             ORDER BY target_date DESC`,
            [user_id, `%${keyword}%`]
        );
        res.json({ success: true, data: result.rows.map(unpack) });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 특정 날짜 일기 조회
router.get('/', async (req, res) => {
    const { target_date } = req.query;
    const user_id = req.user.id;
    if (!target_date) return res.status(400).json({ success: false, message: 'target_date가 필요합니다.' });
    try {
        const result = await db.query(
            `SELECT ${SELECT} FROM DIARIES WHERE user_id = $1 AND target_date = $2`,
            [user_id, target_date]
        );
        res.json({ success: true, data: result.rows.length > 0 ? unpack(result.rows[0]) : null });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 일기 수정
router.patch('/:id', async (req, res) => {
    const { id } = req.params;
    const { title, content, routineTags, listTags } = req.body;
    const user_id = req.user.id;
    try {
        const result = await db.query(
            `UPDATE DIARIES SET content = $1
             WHERE id = $2 AND user_id = $3
             RETURNING ${SELECT}`,
            [pack(title, content, routineTags, listTags), id, user_id]
        );
        if (result.rowCount === 0)
            return res.status(404).json({ success: false, message: '일기를 찾을 수 없습니다.' });
        res.json({ success: true, data: unpack(result.rows[0]) });
    } catch (err) {
        console.error('일기 수정 오류:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 일기 삭제
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id;
    try {
        const result = await db.query(
            `DELETE FROM DIARIES WHERE id = $1 AND user_id = $2 RETURNING *`,
            [id, user_id]
        );
        if (result.rowCount === 0)
            return res.status(404).json({ success: false, message: '일기를 찾을 수 없습니다.' });
        res.json({ success: true, message: '삭제되었습니다.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
