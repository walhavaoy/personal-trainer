import Database from 'better-sqlite3';
import path from 'node:path';
import pino from 'pino';

const logger = pino({ name: 'db' });

const DB_PATH = process.env['DB_PATH'] || path.join(process.cwd(), 'data', 'trainer.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dir = path.dirname(DB_PATH);
  const fs = require('node:fs');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  logger.info({ path: DB_PATH }, 'database opened');

  migrate(db);
  return db;
}

function migrate(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS food_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      logged_at   TEXT NOT NULL DEFAULT (date('now')),
      calories    REAL NOT NULL CHECK(calories >= 0),
      protein_g   REAL NOT NULL DEFAULT 0 CHECK(protein_g >= 0),
      carbs_g     REAL NOT NULL DEFAULT 0 CHECK(carbs_g >= 0),
      fat_g       REAL NOT NULL DEFAULT 0 CHECK(fat_g >= 0),
      description TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_food_logs_date ON food_logs(logged_at);

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT OR IGNORE INTO settings (key, value) VALUES ('daily_calorie_goal', '2000');
  `);
  logger.info('database migration complete');
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
    logger.info('database closed');
  }
}
