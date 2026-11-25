const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const isVercel = Boolean(process.env.VERCEL);
const dbPath = isVercel
  ? path.join("/tmp", "users.db")
  : path.join(process.cwd(), "users.db");

function getDb() {
  const db = new sqlite3.Database(dbPath);
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS login_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        email_attempted TEXT NOT NULL,
        success INTEGER NOT NULL,
        ip_address TEXT,
        logged_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });
  return db;
}

module.exports = { getDb, dbPath };
           
