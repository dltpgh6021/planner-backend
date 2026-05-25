const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { getTodoPrompt, getTextTodoPrompt, getDefaultTodoPrompt } = require('../prompts/todoPrompt');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// TODO 추가
router.post('/', async (req, res) => {
    const { title, content, target_date } = req.body;
    const user_id = req.user.id;
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

// 특정 날짜의 TODO 목록 조회 (GET)
router.get('/', async (req, res) => {
    const { target_date } = req.query;
    const user_id = req.user.id;
    if (!user_id || !target_date) {
        return res.status(400).json({ success: false, message: "user_id와 target_date가 필요합니다." });
    }
    try {
        const query = 'SELECT * FROM TODOS WHERE user_id = $1 AND target_date = $2 ORDER BY id ASC;';
        const result = await db.query(query, [user_id, target_date]);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// TODO 수정 (내용 및 완료 여부)
router.patch('/:id', async (req, res) => {
    const { id } = req.params; // todo의 id
    const { title, content, is_completed, target_date } = req.body;
    const user_id = req.user.id;
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

// TODO 삭제
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id;
    try {
        const query = 'DELETE FROM TODOS WHERE id = $1 AND user_id = $2 RETURNING *;';
        const result = await db.query(query, [id, user_id]);
        if (result.rowCount === 0) return res.status(404).json({ success: false, message: "항목을 찾을 수 없거나 권한이 없습니다." });
        res.json({ success: true, message: "성공적으로 삭제되었습니다." });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// TODO List 불러오기
router.get('/all', async (req, res) => {
    const user_id = req.user.id;
    try {
        const query = `
            SELECT 
                TO_CHAR(target_date AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') as target_date,
                ARRAY_AGG(title ORDER BY id ASC) as titles,
                ARRAY_AGG(id::text ORDER BY id ASC) as ids
            FROM TODOS
            WHERE user_id = $1
            GROUP BY TO_CHAR(target_date AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD')
            ORDER BY TO_CHAR(target_date AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') DESC;
        `;
        const result = await db.query(query, [user_id]);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 월별 완료 개수 조회
router.get('/monthly', async (req, res) => {
    const { year, month } = req.query;
    const user_id = req.user.id;
    try {
        const query = `
            SELECT 
                date_day,
                SUM(completed_count) as completed
            FROM (
                -- 투두 완료 수
                SELECT 
                    TO_CHAR(target_date AT TIME ZONE 'Asia/Seoul', 'DD') as date_day,
                    SUM(CASE WHEN is_completed = true THEN 1 ELSE 0 END) as completed_count
                FROM TODOS
                WHERE user_id = $1
                    AND EXTRACT(YEAR FROM target_date AT TIME ZONE 'Asia/Seoul') = $2
                    AND EXTRACT(MONTH FROM target_date AT TIME ZONE 'Asia/Seoul') = $3
                GROUP BY TO_CHAR(target_date AT TIME ZONE 'Asia/Seoul', 'DD')

                UNION ALL

                -- 루틴 완료 수
                SELECT 
                    TO_CHAR(completed_date, 'DD') as date_day,
                    COUNT(*) as completed_count
                FROM routine_completions
                WHERE user_id = $1
                    AND EXTRACT(YEAR FROM completed_date) = $2
                    AND EXTRACT(MONTH FROM completed_date) = $3
                GROUP BY TO_CHAR(completed_date, 'DD')
            ) combined
            GROUP BY date_day
            ORDER BY date_day ASC;
        `;
        const result = await db.query(query, [user_id, year, month]);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// AI 할 일 목록 생성 (미리보기 전용, DB 저장 없음)
router.post('/from-ai', async (req, res) => {
    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        const { imageBase64, mimeType, userMessage } = req.body;
        const hasImage = imageBase64 && mimeType;
        const hasText  = userMessage && userMessage.trim().length > 0;

        let result;
        if (hasImage) {
            const imagePart = { inlineData: { data: imageBase64, mimeType } };
            result = await model.generateContent([getTodoPrompt(userMessage), imagePart]);
        } else if (hasText) {
            result = await model.generateContent(getTextTodoPrompt(userMessage));
        } else {
            result = await model.generateContent(getDefaultTodoPrompt());
        }

        const generatedData = JSON.parse(result.response.text());

        res.json({
            success: true,
            data: { items: generatedData.items }
        });
    } catch (err) {
        console.error('AI 리스트 생성 에러:', err);
        res.status(500).json({ success: false, message: "AI 분석에 실패했습니다.", error: err.message });
    }
});

module.exports = router;