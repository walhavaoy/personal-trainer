"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsRouter = void 0;
const express_1 = require("express");
const db_1 = require("../db");
const logger_1 = require("../logger");
exports.settingsRouter = (0, express_1.Router)();
/** Allowed keys and their validation constraints */
const SETTING_KEYS = {
    dailyCalorieTarget: { min: 0, max: 99999 },
    weeklyWorkoutGoal: { min: 0, max: 7 },
};
function loadSettings() {
    const db = (0, db_1.getDb)();
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const map = new Map(rows.map((r) => [r.key, r.value]));
    return {
        dailyCalorieTarget: Number(map.get('dailyCalorieTarget') ?? '2000'),
        weeklyWorkoutGoal: Number(map.get('weeklyWorkoutGoal') ?? '4'),
    };
}
// GET /api/settings
exports.settingsRouter.get('/', (_req, res) => {
    try {
        const settings = loadSettings();
        res.json(settings);
    }
    catch (err) {
        logger_1.logger.error({ err }, 'failed to load settings');
        res.status(500).json({ error: 'internal server error' });
    }
});
// PATCH /api/settings
exports.settingsRouter.patch('/', (req, res) => {
    try {
        const body = req.body;
        if (body === null || typeof body !== 'object' || Array.isArray(body)) {
            res.status(400).json({ error: 'request body must be a JSON object' });
            return;
        }
        const updates = body;
        const validUpdates = [];
        for (const [key, value] of Object.entries(updates)) {
            if (!(key in SETTING_KEYS)) {
                res.status(400).json({ error: `unknown setting: ${key}` });
                return;
            }
            if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
                res.status(400).json({ error: `${key} must be an integer` });
                return;
            }
            const constraints = SETTING_KEYS[key];
            if (value < constraints.min || value > constraints.max) {
                res.status(400).json({
                    error: `${key} must be between ${constraints.min} and ${constraints.max}`,
                });
                return;
            }
            validUpdates.push({ key, value: String(value) });
        }
        if (validUpdates.length === 0) {
            res.status(400).json({ error: 'no valid settings provided' });
            return;
        }
        const db = (0, db_1.getDb)();
        const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
        const tx = db.transaction(() => {
            for (const { key, value } of validUpdates) {
                upsert.run(key, value);
            }
        });
        tx();
        logger_1.logger.info({ updates: validUpdates }, 'settings updated');
        const settings = loadSettings();
        res.json(settings);
    }
    catch (err) {
        logger_1.logger.error({ err }, 'failed to update settings');
        res.status(500).json({ error: 'internal server error' });
    }
});
//# sourceMappingURL=settings.js.map