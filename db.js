const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

pool.query(`
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        hwid TEXT UNIQUE NOT NULL,
        username TEXT,
        access_enabled INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        last_seen TIMESTAMP
    )
`).then(() => {
    console.log('Users table ready');
}).catch(err => {
    console.error('Error creating users table:', err);
});

pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT
`).then(() => {
    console.log('Username column ready');
}).catch(err => {
    console.error('Error adding username column:', err);
});

module.exports = pool;