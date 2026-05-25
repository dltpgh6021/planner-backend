const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { getRoutinePrompt, getTextRoutinePrompt, getDefaultRoutinePrompt } = require('../prompts/routinePrompt');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 새 루틴 추가하기
router.post('/', async (req, res) => {
    // 1. 데이터 받기
    const { routine_name, description, schedules } = req.body; 
    const user_id = req.user.id;

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
    
        const insertPromises = targetSchedules.map(day => {
            return client.query(insertScheduleQuery, [newRoutineId, day]);
        });
        await Promise.all(insertPromises);

        await client.query('COMMIT');
        res.status(201).json({
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

// user_id 입력하면 그에 대항하는 루틴 목록 출력
router.get('/', async (req, res) => {
    const user_id = req.user.id;

    try {
        // 기본 정보 가져오기
        // COALESCE와 NULLIF를 써서 요일이 아예 없는 빈 루틴도 배열이 빈 상태로 에러 없이 가져옴
        const query = `
            SELECT 
                r.id, 
                r.routine_name, 
                r.description, 
                r.created_at,
                COALESCE(
                    ARRAY_AGG(rs.day_of_week) FILTER (WHERE rs.day_of_week IS NOT NULL), 
                    '{}'
                ) AS schedules
            FROM routines r
            LEFT JOIN routine_schedules rs ON r.id = rs.routine_id
            WHERE r.user_id = $1
            GROUP BY r.id
            ORDER BY r.created_at DESC;
        `;
        
        const result = await db.query(query, [user_id]);
        const routines = result.rows;

        // 루틴 없을 때
        if (routines.length === 0) {
            return res.json({ success: true, message: '루틴이 없습니다. ', data: [] });
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

// 루틴 기본 정보 및 요일 수정 API
router.patch('/:routineId', async (req, res) => {
    const { routineId } = req.params;
    const { routine_name, description, schedules } = req.body;
    const user_id = req.user.id;
    
    // 둘 다 안보냈으면 DB 작업 할 필요 없음. 
    if (!routine_name && !description && !schedules) {
        return res.status(400).json({ success: false, message: "수정할 데이터를 보내주세요." });
    }

    const client = await db.connect();

    try {
        await client.query('BEGIN'); // 트랜잭션 시작

        // 1. 루틴 이름과 설명 수정 (COALESCE를 써서 값이 안 들어오면 기존 값 유지)
        const updateRoutineQuery = `
            UPDATE routines 
            SET routine_name = COALESCE($1, routine_name), 
                description = COALESCE($2, description)
            WHERE id = $3 AND user_id = $4
            RETURNING *;
        `;
        const routineResult = await client.query(updateRoutineQuery, [routine_name, description, routineId, user_id]);

        if (routineResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: '권한이 없거나 수정할 루틴을 찾을 수 없습니다.' });
        }

        // 2. 만약 요일(schedules) 정보도 같이 들어왔다면?
        if (schedules && Array.isArray(schedules)) {
            // 기존 요일 싹 지우기
            await client.query('DELETE FROM routine_schedules WHERE routine_id = $1', [routineId]);
            
            // 새 요일 꽂아 넣기
            if (schedules.length > 0) {
                // 실무 최적화: for문 대신 Promise.all을 써서 병렬(동시)로 쿼리를 날리면 훨씬 빠름!
                const insertPromises = schedules.map(day => {
                    return client.query(
                        'INSERT INTO routine_schedules (routine_id, day_of_week) VALUES ($1, $2)',
                        [routineId, day]
                    );
                });
                await Promise.all(insertPromises);
            }
        }

        await client.query('COMMIT'); // 성공하면 확정
        res.json({ success: true, message: '루틴이 성공적으로 수정되었습니다.', data: routineResult.rows[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`루틴 수정 중 에러 (루틴: ${routineId}):`, err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
});

//루틴 아예 삭제 API
router.delete('/:routineId', async (req, res) => {
    const { routineId } = req.params;
    const user_id = req.user.id;

    const client = await db.connect();

    try {
        await client.query('BEGIN');

        const checkOwnershipQuery = 'SELECT id FROM routines WHERE id = $1 AND user_id = $2';
        const ownershipCheck = await client.query(checkOwnershipQuery, [routineId, user_id]);

        if (ownershipCheck.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(403).json({ success: false, message: '권한이 없거나 해당 루틴을 찾을 수 없습니다. ' });
        }

        // 스케줄, 아이템 삭제 (외래키 제약조건 에러 방지)
        await client.query('DELETE FROM routine_schedules WHERE routine_id = $1', [routineId]);
        await client.query('DELETE FROM routine_items WHERE routine_id = $1', [routineId]);

        // 부모 루틴 삭제
        const result = await client.query('DELETE FROM routines WHERE id = $1 AND user_id = $2 RETURNING id', [routineId, user_id]);

        await client.query('COMMIT');
        res.json({ success: true, message: '루틴이 성공적으로 삭제되었습니다. ' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('루틴 삭제 중 에러', err);
        res.status(500).json({ success: true, message: err.message });
    } finally {
        client.release();
    }
});



// 루틴 아이템 관련 api들

// 아이템 추가 api
router.post('/:routineId/items', async(req, res) => {
    const { routineId } = req.params;
    const { item_name } = req.body;
    const user_id = req.user.id;

    // 방어 로직. 아이템 이름이 비어있으면 바로 아웃
    if (!item_name || item_name.trim() === "") {
        return res.status(400).json({ success: false, message: "아이템 이름을 입력해주세요. " });
    }

    try {
        // 이 루틴이 user의 것이 맞는지 확인
        const checkOwnershipQuery = 'SELECT id FROM routines WHERE id = $1 AND user_id = $2';
        const ownershipCheck = await db.query(checkOwnershipQuery, [routineId, user_id]);

        if (ownershipCheck.rowCount === 0) {
            // 내 루틴이 아니거나 존재하지 않는 루틴이면 거절
            return res.status(403).json({ success: false, message: "권한이 없거나 해당 루틴을 찾을 수 없습니다." });
        }

        // user의 루틴임을 확인 이후 아이템 추가
        const query = `
            INSERT INTO routine_items (routine_id, title)
            VALUES ($1, $2)
            RETURNING id, title;
        `;
        const result = await db.query(query, [routineId, item_name]);

        res.status(201).json({
            success: true, 
            message: '아이템이 추가되었습니다. ', 
            data: result.rows[0]
        });
    } catch (err) {
        console.error('아이템 추가 중 에러: ', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 루틴 아이템 조회
router.get('/:routineId/items', async (req, res) => {
    const { routineId } = req.params;
    const user_id = req.user.id;

    try {
        // 루틴이 내 것인지 검증
        const checkOwnershipQuery = 'SELECT id FROM routines WHERE id = $1 AND user_id = $2';
        const ownershipCheck = await db.query(checkOwnershipQuery, [routineId, user_id]);

        if (ownershipCheck.rowCount === 0) {
            // 내 루틴이 아니거나 아예 없는 루틴이면 여기서 접근 차단!
            return res.status(403).json({ success: false, message: "권한이 없거나 해당 루틴을 찾을 수 없습니다." });
        }

        const query = `
            SELECT id, title
            FROM routine_items
            WHERE routine_id = $1
            ORDER BY id ASC;
        `;
        const result = await db.query(query, [routineId]);

        res.json({
            success: true, 
            message: '루틴 아이템 목록 조회 성공!', 
            data: result.rows
        });
    } catch (err) {
        console.error(`아이템 목록 조회 중 에러 (루틴: ${routineId}):`, err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 아이템 수정
router.patch('/:routineId/items/:itemId', async(req, res) => {
    const { routineId, itemId } = req.params;
    const { item_name } = req.body;
    const user_id = req.user.id;

    // 방어 로직: 사용자가 실수로 빈칸을 보냈을 때 컷
    if (!item_name || item_name.trim() === "") {
        return res.status(400).json({ success: false, message: "수정할 아이템 이름을 입력해주세요." });
    }

    try {
        // 소유권 검증: 이 루틴이 진짜 내 것(user_id)인지 먼저 확인!
        const checkOwnershipQuery = 'SELECT id FROM routines WHERE id = $1 AND user_id = $2';
        const ownershipCheck = await db.query(checkOwnershipQuery, [routineId, user_id]);

        if (ownershipCheck.rowCount === 0) {
            return res.status(403).json({ success: false, message: "권한이 없거나 해당 루틴을 찾을 수 없습니다." });
        }

        const query = `
            UPDATE routine_items
            SET title = $1
            WHERE id = $2 AND routine_id = $3
            RETURNING id, title;
        `;
        const result = await db.query(query, [item_name, itemId, routineId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: '수정할 아이템을 찾을 수 없습니다. '});
        }

        res.json({
            success: true, 
            message: '아이템이 성공적으로 수정되었습니다. ', 
            data: result.rows[0]
        });
    } catch (err) {
        console.error('아이템 수정 중 에러:', err);
        res.status(500).json({success: false, error: err.message });
    }

});

// 루틴 아이템 삭제
router.delete('/:routineId/items/:itemId', async(req, res) => {
    const { routineId, itemId } = req.params;
    const user_id = req.user.id;

    try {
        // 소유권 검증: 이 루틴이 진짜 내 것(user_id)인지 먼저 확인
        const checkOwnershipQuery = 'SELECT id FROM routines WHERE id = $1 AND user_id = $2';
        const ownershipCheck = await db.query(checkOwnershipQuery, [routineId, user_id]);

        if (ownershipCheck.rowCount === 0) {
            return res.status(403).json({ success: false, message: "권한이 없거나 해당 루틴을 찾을 수 없습니다." });
        }

        const query = 'DELETE FROM routine_items WHERE id = $1 AND routine_id = $2 RETURNING id';
        const result = await db.query(query, [itemId, routineId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: '삭제할 아이템을 찾지 못했습니다. '});
        }

        res.json({ success: true, message: '아이템이 성공적으로 삭제되었습니다. ' });
    } catch (err) {
        console.error('아이템 삭제 중 에러: ', err);
        res.status(500).json({success: false, error: err.message});
    }
});

// 루틴 아이템 완료 체크/해제
router.post('/:routineId/items/:itemId/complete', async (req, res) => {
    const { itemId } = req.params;
    const { completed_date, is_completed } = req.body;
    const user_id = req.user.id;

    try {
        if (is_completed) {
            // 완료 처리
            const query = `
                INSERT INTO routine_completions (user_id, routine_item_id, completed_date)
                VALUES ($1, $2, $3)
                ON CONFLICT (routine_item_id, completed_date) DO NOTHING
                RETURNING *;
            `;
            await db.query(query, [user_id, itemId, completed_date]);
        } else {
            // 완료 해제
            await db.query(
                'DELETE FROM routine_completions WHERE routine_item_id = $1 AND completed_date = $2 AND user_id = $3',
                [itemId, completed_date, user_id]
            );
        }
        res.json({ success: true });
    } catch (err) {
        console.error('루틴 완료 처리 중 에러:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 특정 날짜 루틴 아이템 완료 여부 조회
router.get('/:routineId/items/completions', async (req, res) => {
    const { routineId } = req.params;
    const { completed_date } = req.query;
    const user_id = req.user.id;

    try {
        const query = `
            SELECT ri.id, ri.title,
                CASE WHEN rc.id IS NOT NULL THEN true ELSE false END as is_completed
            FROM routine_items ri
            LEFT JOIN routine_completions rc 
                ON ri.id = rc.routine_item_id 
                AND rc.completed_date = $1
                AND rc.user_id = $2
            WHERE ri.routine_id = $3
            ORDER BY ri.id ASC;
        `;
        const result = await db.query(query, [completed_date, user_id, routineId]);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/from-image', async (req, res) => {
    const { imageBase64, mimeType } = req.body;
    const user_id = req.user.id;

    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        const { userMessage } = req.body;
        const hasImage = imageBase64 && mimeType;
        const hasText  = userMessage && userMessage.trim().length > 0;

        let result;
        if (hasImage) {
            // 이미지 있음 (+ 선택적 텍스트)
            const imagePart = { inlineData: { data: imageBase64, mimeType } };
            result = await model.generateContent([getRoutinePrompt(userMessage), imagePart]);
        } else if (hasText) {
            // 텍스트만
            result = await model.generateContent(getTextRoutinePrompt(userMessage));
        } else {
            // 아무것도 없음 → 기본 루틴
            result = await model.generateContent(getDefaultRoutinePrompt());
        }
        const generatedData = JSON.parse(result.response.text());

        // DB 저장 없이 AI 결과만 반환 (클라이언트에서 확인 후 등록)
        res.json({
            success: true,
            data: {
                routine_title: generatedData.routine_title,
                schedules: generatedData.schedules || [0,1,2,3,4,5,6],
                items: generatedData.items   // [{ content: "HH:MM 행동설명" }]
            }
        });

    } catch (err) {
        console.error('AI 루틴 생성 에러:', err);
        res.status(500).json({ success: false, message: "AI 분석에 실패했습니다.", error: err.message });
    }
});

module.exports = router;