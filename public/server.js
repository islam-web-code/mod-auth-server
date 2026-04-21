const express = require('express');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// =======================
// HEALTH CHECK
// =======================
app.get('/', (req, res) => {
    res.send('Mod auth server is running');
});

// =======================
// AUTH CHECK
// =======================
app.post('/auth/check', async (req, res) => {
    const { hwid } = req.body;

    if (!hwid) {
        return res.status(400).json({
            allowed: false,
            message: 'HWID is required'
        });
    }

    try {
        const result = await db.query(
            'SELECT * FROM users WHERE hwid = $1',
            [hwid]
        );

        const row = result.rows[0];

        if (!row) {
            return res.json({
                allowed: false,
                message: 'HWID not found'
            });
        }

        if (row.access_enabled !== 1) {
            return res.json({
                allowed: false,
                message: 'Access revoked'
            });
        }

        await db.query(
            'UPDATE users SET last_seen = NOW() WHERE hwid = $1',
            [hwid]
        );

        return res.json({
            allowed: true,
            message: 'Access granted'
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            allowed: false,
            message: 'Database error'
        });
    }
});

// =======================
// ADD HWID
// =======================
app.post('/admin/add-hwid', async (req, res) => {
    const { hwid } = req.body;

    if (!hwid) {
        return res.status(400).json({
            success: false,
            message: 'HWID is required'
        });
    }

    try {
        await db.query(
            'INSERT INTO users (hwid) VALUES ($1)',
            [hwid]
        );

        return res.json({
            success: true,
            message: 'HWID added successfully'
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Failed to add HWID (maybe already exists)'
        });
    }
});

// =======================
// REVOKE HWID
// =======================
app.post('/admin/revoke-hwid', async (req, res) => {
    const { hwid } = req.body;

    if (!hwid) {
        return res.status(400).json({
            success: false,
            message: 'HWID is required'
        });
    }

    try {
        const result = await db.query(
            'UPDATE users SET access_enabled = 0 WHERE hwid = $1',
            [hwid]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'HWID not found'
            });
        }

        return res.json({
            success: true,
            message: 'HWID revoked successfully'
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Failed to revoke HWID'
        });
    }
});

// =======================
// ENABLE HWID
// =======================
app.post('/admin/enable-hwid', async (req, res) => {
    const { hwid } = req.body;

    if (!hwid) {
        return res.status(400).json({
            success: false,
            message: 'HWID is required'
        });
    }

    try {
        const result = await db.query(
            'UPDATE users SET access_enabled = 1 WHERE hwid = $1',
            [hwid]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'HWID not found'
            });
        }

        return res.json({
            success: true,
            message: 'HWID enabled successfully'
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Failed to enable HWID'
        });
    }
});

// =======================
// LIST HWIDS
// =======================
app.get('/admin/list-hwids', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, hwid, access_enabled, created_at, last_seen FROM users ORDER BY id DESC'
        );

        return res.json({
            success: true,
            users: result.rows
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch HWIDs'
        });
    }
});

// =======================
// START SERVER
// =======================
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});