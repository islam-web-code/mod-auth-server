const express = require('express');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
    res.send('Mod auth server is running');
});

// Check if HWID is allowed
app.post('/auth/check', (req, res) => {
    const { hwid } = req.body;

    if (!hwid) {
        return res.status(400).json({
            allowed: false,
            message: 'HWID is required'
        });
    }

    db.query(
    'SELECT * FROM users WHERE hwid = $1',
    [hwid]
).then(result => {
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

    db.query(
        'UPDATE users SET last_seen = NOW() WHERE hwid = $1',
        [hwid]
    );

    return res.json({
        allowed: true,
        message: 'Access granted'
    });

}).catch(err => {
    return res.status(500).json({
        allowed: false,
        message: 'Database error'
    });
});
});

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
            message: 'Failed to add HWID'
        });
    }
});

app.post('/admin/revoke-hwid', (req, res) => {
    const { hwid } = req.body;

    if (!hwid) {
        return res.status(400).json({
            success: false,
            message: 'HWID is required'
        });
    }

    db.run(
        'UPDATE users SET access_enabled = 0 WHERE hwid = ?',
        [hwid],
        function (err) {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to revoke HWID'
                });
            }

            if (this.changes === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'HWID not found'
                });
            }

            return res.json({
                success: true,
                message: 'HWID revoked successfully'
            });
        }
    );
});

app.post('/admin/enable-hwid', (req, res) => {
    const { hwid } = req.body;

    if (!hwid) {
        return res.status(400).json({
            success: false,
            message: 'HWID is required'
        });
    }

    db.run(
        'UPDATE users SET access_enabled = 1 WHERE hwid = ?',
        [hwid],
        function (err) {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to enable HWID'
                });
            }

            if (this.changes === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'HWID not found'
                });
            }

            return res.json({
                success: true,
                message: 'HWID enabled successfully'
            });
        }
    );
});

app.get('/admin/list-hwids', (req, res) => {
    db.all(
        'SELECT id, hwid, access_enabled, created_at, last_seen FROM users ORDER BY id DESC',
        [],
        (err, rows) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to fetch HWIDs'
                });
            }

            return res.json({
                success: true,
                users: rows
            });
        }
    );
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});