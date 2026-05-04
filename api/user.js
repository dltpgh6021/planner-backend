const express = require('express');
const router = express.Router();
const db = require('../config/db'); 

// 1. 내 정보 조회 (GET /api/user/me)
router.get('/me', async (req, res) => {
    const user_id = req.user.id; // 토큰에서 내 ID 꺼내기

    try {
        const query = `
            SELECT id, google_id, email, username, created_at 
            FROM USERS 
            WHERE id = $1;
        `;
        const result = await db.query(query, [user_id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: "유저 정보를 찾을 수 없습니다." });
        }

        res.json({ success: true, message: "내 정보 조회 성공", data: result.rows[0] });
    } catch (err) {
        console.error('내 정보 조회 중 에러:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. 내 닉네임(정보) 수정 (PATCH /api/user/me)
router.patch('/me', async (req, res) => {
    const user_id = req.user.id;
    const { username } = req.body;

    if (!username || username.trim() === "") {
        return res.status(400).json({ success: false, message: "변경할 닉네임을 입력해주세요." });
    }

    try {
        const query = `
            UPDATE USERS 
            SET username = $1 
            WHERE id = $2 
            RETURNING id, email, username;
        `;
        const result = await db.query(query, [username, user_id]);

        res.json({ success: true, message: "닉네임이 성공적으로 변경되었습니다.", data: result.rows[0] });
    } catch (err) {
        console.error('유저 정보 수정 중 에러:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. 회원 탈퇴 (DELETE /api/user/me)
router.delete('/me', async (req, res) => {
    const user_id = req.user.id;
    const client = await db.connect();

    try {
        await client.query('BEGIN');

        // 중요: 회원 탈퇴 시, 이 유저가 작성한 다른 데이터(todo, diary, routine) 처리가 필요
        // CASCADE를 안 걸어뒀다면, 아래처럼 수동으로 지워주거나 '탈퇴한 유저' 처리
        
        await client.query('DELETE FROM TODOS WHERE user_id = $1', [user_id]);
        await client.query('DELETE FROM DIARIES WHERE user_id = $1', [user_id]);
        
        // 루틴의 경우 자식 테이블(schedules, items)이 또 있으니 먼저 지워야 해
        const routines = await client.query('SELECT id FROM ROUTINES WHERE user_id = $1', [user_id]);
        for (let row of routines.rows) {
            await client.query('DELETE FROM routine_schedules WHERE routine_id = $1', [row.id]);
            await client.query('DELETE FROM routine_items WHERE routine_id = $1', [row.id]);
        }
        await client.query('DELETE FROM ROUTINES WHERE user_id = $1', [user_id]);

        // 마지막으로 진짜 유저 삭제
        const result = await client.query('DELETE FROM USERS WHERE id = $1 RETURNING id', [user_id]);

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: "이미 탈퇴 처리되었거나 유저를 찾을 수 없습니다." });
        }

        await client.query('COMMIT');
        res.json({ success: true, message: "정상적으로 회원 탈퇴되었습니다." });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('회원 탈퇴 중 에러:', err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
});

module.exports = router;