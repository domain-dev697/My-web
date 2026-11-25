const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getDb } = require("./_db");

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const ip = getClientIp(req);
  const db = getDb();

  db.get(
    `SELECT id, username, email, password_hash FROM users WHERE email = ?`,
    [normalizedEmail],
    async (err, user) => {
      if (err) {
        db.close();
        console.error("Login query error:", err);
        return res.status(500).json({ error: "Database error" });
      }

      const isMatch = user
        ? await bcrypt.compare(String(password), user.password_hash)
        : false;

      db.run(
        `INSERT INTO login_logs (user_id, email_attempted, success, ip_address) VALUES (?, ?, ?, ?)`,
        [user ? user.id : null, normalizedEmail, isMatch ? 1 : 0, ip],
        (logErr) => {
          db.close();
          if (logErr) {
            console.error("Login log error:", logErr);
          }
        }
      );

      if (!user || !isMatch) {
        return res.status(401).json({ error: "Invalid email or password." });
      }

      const secret = process.env.JWT_SECRET || "dev-secret-change-me";
      const token = jwt.sign(
        { sub: user.id, username: user.username, email: user.email },
        secret,
        { expiresIn: "1h" }
      );

      return res.status(200).json({
        token,
        user: { id: user.id, username: user.username, email: user.email },
      });
    }
  );
};
