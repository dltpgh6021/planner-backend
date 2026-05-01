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

// 2. 새 루틴 추가하기
router.post('/', async (req, res) => {
    // 1. 데이터 받기
    const { user_id, routine_name, description, schedules } = req.body; 

    // 트랜잭션을 위한 클라이언트 연결
    const client = await db.connect();
    
    try {
        // 트랜잭션 시작
        await client.query('BEGIN');

        // routines 테이블에 기본 정보 넣고 id 받아오기
        const insertRoutineQuery = `
            INSERT INTO routines (user_id, routine_name, description)
            VALUES ($1, $2, $3)
            RETURNING id;
        `;

        const routineResult = await client.query(insertRoutineQuery, [user_id, routine_name, description]);
        const newRoutineId = routineResult.rows[0].id;

        // routine_schedules 테이블에 요일 저장하기
        let targetSchedules = schedules;

        if (!targetSchedules || targetSchedules.length === 0) {
            const todayDayofWeek = new Date().getDay();
            targetSchedules = [todayDayofWeek];
        }

        // routine_schedules 테이블에 요일 저장
        const insertScheduleQuery = `
            INSERT INTO routine_schedules (routine_id, day_of_week)
            VALUES ($1, $2)
        `;

        for (const day of targetSchedules) {
            await client.query(insertScheduleQuery, [newRoutineId, day]);
        }

        await client.query('COMMIT');
        res.json({
            success: true, 
            message: '루틴이 성공적으로 생성되었습니다. ', 
            routine_id: newRoutineId, 
            applied_schedules: targetSchedules
        });


    } catch (err) {
        await client.query("ROLLBACK");
        console.error('루틴 발생 중 에러:', err);
        res.status(500),json({ success: false, error: err.message });
    } finally {
        client.release();
    }
});

module.exports = router;