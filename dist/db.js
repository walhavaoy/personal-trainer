"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDb = initDb;
exports.insertWorkout = insertWorkout;
exports.getAllWorkouts = getAllWorkouts;
exports.closeDb = closeDb;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger_1 = require("./logger");
let workouts = [];
let dbPath = null;
function initDb(filePath) {
    if (filePath === ':memory:') {
        dbPath = null;
        workouts = [];
        logger_1.logger.info('Database initialized (in-memory)');
        return;
    }
    dbPath = filePath ?? path_1.default.join(process.cwd(), 'data', 'workouts.json');
    if (fs_1.default.existsSync(dbPath)) {
        try {
            const raw = fs_1.default.readFileSync(dbPath, 'utf-8');
            workouts = JSON.parse(raw);
        }
        catch (err) {
            logger_1.logger.error({ err }, 'Failed to read database file, starting fresh');
            workouts = [];
        }
    }
    else {
        workouts = [];
    }
    logger_1.logger.info({ dbPath }, 'Database initialized');
}
function persist() {
    if (dbPath === null)
        return;
    try {
        const dir = path_1.default.dirname(dbPath);
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        fs_1.default.writeFileSync(dbPath, JSON.stringify(workouts, null, 2), 'utf-8');
    }
    catch (err) {
        logger_1.logger.error({ err }, 'Failed to persist database');
    }
}
function insertWorkout(workout) {
    workouts.push(workout);
    persist();
}
function getAllWorkouts() {
    return [...workouts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
function closeDb() {
    persist();
    workouts = [];
    dbPath = null;
}
//# sourceMappingURL=db.js.map