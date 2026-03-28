"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
exports.closeDb = closeDb;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const node_path_1 = __importDefault(require("node:path"));
const logger_1 = require("./logger");
const DB_PATH = process.env.DB_PATH ?? node_path_1.default.join(process.cwd(), 'data', 'personal-trainer.db');
let db;
function getDb() {
    if (!db) {
        const dir = node_path_1.default.dirname(DB_PATH);
        const fs = require('node:fs');
        fs.mkdirSync(dir, { recursive: true });
        db = new better_sqlite3_1.default(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        logger_1.logger.info({ path: DB_PATH }, 'database opened');
        migrate(db);
    }
    return db;
}
function migrate(database) {
    database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
    const insertDefault = database.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    const defaults = {
        dailyCalorieTarget: '2000',
        weeklyWorkoutGoal: '4',
    };
    const tx = database.transaction(() => {
        for (const [key, value] of Object.entries(defaults)) {
            insertDefault.run(key, value);
        }
    });
    tx();
    logger_1.logger.info('database migration complete');
}
function closeDb() {
    if (db) {
        db.close();
        logger_1.logger.info('database closed');
    }
}
//# sourceMappingURL=db.js.map