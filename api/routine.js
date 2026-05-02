const express = require('express');
const router = express.Router();
const db = require('../config/db');

// user_Id 입력하면 그에 대항하는 루틴 목록 출력
router.get('/user/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        // 기본 정보 가져오기
        const routinesQuery = `
            SELECT id, routine_name, description, created_at
            FROM routines
            WHERE user_id = $1
            ORDER BY created_at DESC;
        `;
        const routinesResult = await db.query(routinesQuery, [userId]);
        const routines = routinesResult.rows;

        // 루틴 없을 때
        if (routines.length === 0) {
            return res.json({ success: true, message: '루틴이 없습니다. ', data: [] });
        }

        // 루틴 있는 경우 -> 요일 정보를 합쳐서 DB에서 찾아오기
        for (let routine of routines) {
            const scheduleQuery = `
                SELECT day_of_week
                FROM routine_schedules
                WHERE routine_id = $1;
            `;
            const scheduleResult = await db.query(scheduleQuery, [routine.id]);

            routine.schedules = scheduleResult.rows.map(row => row.day_of_week);
        }

        res.json({
            success: true, 
            message: '루틴 목록 조회 성공', 
            data: routines
        })
    }
    catch (err) {
        console.log('루틴 조회 중 에러 발생: ', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 새 루틴 추가하기
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
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
});

//루틴 아예 삭제 API
router.delete('/:routineId', async (req, res) => {
    const { routineId } = req.params;
    const client = await db.connect();

    try {
        await client.query('BEGIN');

        // 스케줄, 아이템 삭제 (외래키 제약조건 에러 방지)
        await client.query('DELETE FROM routine_schedules WHERE routine_id = $1', [routineId]);
        await client.query('DELETE FROM routine_items WHERE routine_id = $1', [routineId]);

        // 루틴 삭제
        const result = await client.query('DELETE FROM routines WHERE id = $1 RETURNING id', [routineId]);

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: '해당 루틴을 찾을 수 없습니다. ' });
        }

        await client.query('COMMIT');
        res.json({ success: true, message: '루틴이 성공적으로 삭제되었습니다. ' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('루틴 삭제 중 에러', err);
        res.status(500).json({ success: true, message: '루틴이 성공적으로 삭제되었습니다. ' });
    } finally {
        client.release();
    }
});



// 루틴 아이템 관련 api들

// 아이템 추가 api
router.post('/:routineId/items', async(req, res) => {
    const { routineId } = req.params;
    const { item_name } = req.body;

    try {
        const query = `
            INSERT INTO routine_items (routine_id, title)
            VALUES ($1, $2)
            RETURNING id, title;
        `;
        const result = await db.query(query, [routineId, item_name]);

        res.json({
            success: true, 
            message: '아이템이 추가되었습니다. ', 
            data: result.rows[0]
        });
    } catch (err) {
        console.error('아이템 추가 중 에러: ', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;