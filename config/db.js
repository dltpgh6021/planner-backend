const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL, 
    
    // 아래 ssl 설정 3줄을 추가해 주세요!
    ssl: process.env.DB_SSL === "true"
        ? { rejectUnauthorized: false }
    : false
});

// 예기치 않은 에러 발생 시 처리하는 부분
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

module.exports = pool;