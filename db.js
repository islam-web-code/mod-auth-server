const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./modauth.db');

// Create table if not exists
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hwid TEXT UNIQUE,
            access_enabled INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_seen DATETIME
        )
    `);
});

module.exports = db;