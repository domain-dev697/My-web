const bcrypt = require("bcryptjs");
const { getDb } = require("./_db");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { username, email, password } = req.body || {};
  if (!username || !email || !password || String(password).length < 6) {
    return res.status(400).json({
      error: "Username, valid email, and password (6+ chars) are required.",
    });
  }

  try {
    const cleanUsername = String(username).trim();
    const normalizedEmail = String(email).trim().toLowerCase();
    const passwordHash = await bcrypt.hash(String(password), 10);
    const db = getDb();

    db.run(
      `INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)`,
      [cleanUsername, normalizedEmail, passwordHash],
      function (err) {
        db.close();
        if (err) {
          if (err.message && err.message.includes("UNIQUE")) {
            return res.status(409).json({ error: "Email is already registered." });
          }
          console.error("Register error:", err);
          return res.status(500).json({ error: "Database error" });
        }

        return res.status(201).json({
          user: {
            id: this.lastID,
            username: cleanUsername,
            email: normalizedEmail,
          },
        });
      }
    );
  } catch (err) {
    console.error("Register handler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
