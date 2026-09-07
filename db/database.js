const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'job_portal.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
  }
});

// Promise wrappers for async/await usage
const queryAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const queryOne = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const runSql = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

// Asynchronous schema initialization
const initDb = async () => {
  await runSql('PRAGMA foreign_keys = ON');

  // Users table
  await runSql(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('recruiter', 'jobseeker')),
      company TEXT,
      headline TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Jobs table
  await runSql(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recruiter_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      location TEXT NOT NULL,
      job_type TEXT NOT NULL,
      experience_level TEXT NOT NULL,
      salary_range TEXT,
      category TEXT DEFAULT 'Engineering',
      description TEXT NOT NULL,
      requirements TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (recruiter_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Applications table
  await runSql(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      jobseeker_id INTEGER NOT NULL,
      applicant_name TEXT NOT NULL,
      applicant_email TEXT NOT NULL,
      applicant_phone TEXT,
      portfolio_url TEXT,
      cover_note TEXT,
      resume_filename TEXT NOT NULL,
      resume_original_name TEXT NOT NULL,
      resume_path TEXT NOT NULL,
      status TEXT DEFAULT 'Applied' CHECK(status IN ('Applied', 'Reviewing', 'Shortlisted', 'Rejected', 'Hired')),
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
      FOREIGN KEY (jobseeker_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
};

module.exports = {
  db,
  initDb,
  queryAll,
  queryOne,
  runSql,
};
