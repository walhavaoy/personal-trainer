import Database from 'better-sqlite3';
import path from 'node:path';
import { logger } from './logger';

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'personal-trainer.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    const fs = require('node:fs');
    fs.mkdirSync(dir, { recursive: true });

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    logger.info({ path: DB_PATH }, 'database opened');
    migrate(db);
  }
  return db;
}

function migrate(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const insertDefault = database.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  );

  const defaults: Record<string, string> = {
    dailyCalorieTarget: '2000',
    weeklyWorkoutGoal: '4',
  };

  const tx = database.transaction(() => {
    for (const [key, value] of Object.entries(defaults)) {
      insertDefault.run(key, value);
    }
  });
  tx();

  logger.info('database migration complete');
}

export function closeDb(): void {
  if (db) {
    db.close();
    logger.info('database closed');
  }
}
