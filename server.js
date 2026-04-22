const express = require("express");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_PASSWORD = "1234";

app.use(express.json());
app.use(express.static("public"));

/* ======================================================
   UTIL / HELPERS
====================================================== */

// Admin helper

async function logAction(action, details) {
  await db.query(
    "INSERT INTO admin_logs (action, details) VALUES ($1, $2)",
    [action, details]
  );
}

function requireAdmin(req, res, next) {
  const token = req.headers.authorization;

  if (token !== "admin-token-123") {
    return res.status(403).json({ error: "Unauthorized" });
  }

  next();
}

const sendError = (res, message, code = 500) =>
  res.status(code).json({ success: false, message });

const requireHwid = (req, res) => {
  const { hwid } = req.body;
  if (!hwid) {
    sendError(res, "HWID is required", 400);
    return null;
  }
  return hwid;
};

/* ======================================================
   HEALTH
====================================================== */

app.get("/", (req, res) => {
  res.send("Mod auth server is running");
});

/* ======================================================
   AUTH CONTROLLER
====================================================== */

app.post("/auth/check", async (req, res) => {
  const hwid = requireHwid(req, res);
  if (!hwid) return;

  try {
    const result = await db.query(
      "SELECT * FROM users WHERE hwid = $1",
      [hwid]
    );

    const user = result.rows[0];

    if (!user) {
      return res.json({ allowed: false, message: "HWID not found" });
    }

    if (!user.access_enabled) {
      return res.json({ allowed: false, message: "Access revoked" });
    }

    await db.query(
      "UPDATE users SET last_seen = NOW() WHERE hwid = $1",
      [hwid]
    );

    return res.json({ allowed: true, message: "Access granted" });

  } catch (err) {
    console.error(err);
    return sendError(res, "Database error");
  }
});


/* ======================================================
   ADMIN ROUTES
====================================================== */

app.post("/admin/add-hwid", requireAdmin, async (req, res) => {

  const { hwid, username } = req.body;
  if (!hwid) return sendError(res, "HWID required", 400);

  try {
    await db.query(
      "INSERT INTO users (hwid, username) VALUES ($1, $2)",
      [hwid, username || null]
    );

     await logAction("ADD_HWID", `${username} (${hwid})`);

    res.json({ success: true, message: "HWID added" });
  } catch (err) {
    sendError(res, "Insert failed");
  }
});

app.post("/admin/remove-hwid", requireAdmin, async (req, res) => {
  const { hwid } = req.body;
  if (!hwid) return sendError(res, "HWID required", 400);

  try {
    // 1. get username BEFORE deleting
    const userRes = await db.query(
      "SELECT username FROM users WHERE hwid = $1",
      [hwid]
    );

    const username = userRes.rows[0]?.username || "unknown";

    // 2. delete user
    const result = await db.query(
      "DELETE FROM users WHERE hwid = $1",
      [hwid]
    );

    if (!result.rowCount) {
      return sendError(res, "HWID not found", 404);
    }

    // 3. log correctly (CONSISTENT NAME)
    await logAction("REMOVE_HWID", `${username} (${hwid})`);

    res.json({ success: true, message: "Removed" });

  } catch (err) {
    console.error(err);
    sendError(res, "Delete failed");
  }
});

app.post("/admin/revoke-hwid", requireAdmin, async (req, res) => {

  const { hwid } = req.body;
  if (!hwid) return sendError(res, "HWID required", 400);

  try {
    const result = await db.query(
      "UPDATE users SET access_enabled = 0 WHERE hwid = $1",
      [hwid]
    );

    if (!result.rowCount) {
      return sendError(res, "HWID not found", 404);
    }

    await logAction("REVOKE_HWID", hwid);

    res.json({ success: true, message: "Revoked" });
  } catch {
    sendError(res, "Revoke failed");
  }
});

app.post("/admin/enable-hwid", requireAdmin, async (req, res) => {

  const { hwid } = req.body;
  if (!hwid) return sendError(res, "HWID required", 400);

  try {
    const result = await db.query(
      "UPDATE users SET access_enabled = 1 WHERE hwid = $1",
      [hwid]
    );

    if (!result.rowCount) {
      return sendError(res, "HWID not found", 404);
    }

    await logAction("ENABLE_HWID", hwid);

    res.json({ success: true, message: "Enabled" });
  } catch {
    sendError(res, "Enable failed");
  }
});

app.get("/admin/list-hwids", requireAdmin, async (req, res) => {

  try {
    const result = await db.query(
      "SELECT id, hwid, username, access_enabled, created_at, last_seen FROM users ORDER BY id DESC"
    );

    res.json({ success: true, users: result.rows });
  } catch {
    sendError(res, "Fetch failed");
  }
});

/* ======================================================
   ADMIN LOGIN (optional token stub)
====================================================== */

app.post("/admin/login", (req, res) => {
  const { password } = req.body;

  if (password === ADMIN_PASSWORD) {
    return res.json({ success: true, token: "admin-token-123" });
  }

  return res.status(401).json({ success: false });
});

/* ======================================================
   ADMIN Logs (optional token stub)
====================================================== */

app.get("/admin/logs", requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT 100"
    );

    res.json({
      success: true,
      logs: result.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Fetch failed"
    });
  }
});

// clear logs

app.post("/admin/clear-logs", requireAdmin, async (req, res) => {
  try {
    await db.query("DELETE FROM admin_logs");

    await logAction("CLEAR_LOGS", "All logs cleared");

    res.json({ success: true, message: "Logs cleared" });
  } catch (err) {
    console.error(err);
    sendError(res, "Failed to clear logs");
  }
});

/* ======================================================
   START SERVER
====================================================== */

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});