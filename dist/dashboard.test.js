"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const express_1 = __importDefault(require("express"));
const db_1 = require("./db");
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const node_http_1 = __importDefault(require("node:http"));
function request(server, path) {
    return new Promise((resolve, reject) => {
        const address = server.address();
        if (!address || typeof address === 'string') {
            reject(new Error('server not listening'));
            return;
        }
        node_http_1.default.get(`http://127.0.0.1:${address.port}${path}`, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk.toString(); });
            res.on('end', () => {
                resolve({ status: res.statusCode ?? 500, body: JSON.parse(data) });
            });
            res.on('error', reject);
        }).on('error', reject);
    });
}
(0, node_test_1.describe)('GET /api/dashboard', () => {
    let server;
    (0, node_test_1.before)(() => {
        process.env['DB_PATH'] = ':memory:';
        const app = (0, express_1.default)();
        app.use(express_1.default.json());
        (0, db_1.getDb)();
        app.use('/api', dashboard_1.default);
        server = app.listen(0);
    });
    (0, node_test_1.after)(() => {
        server.close();
        (0, db_1.closeDb)();
    });
    (0, node_test_1.it)('returns 200 with empty data', async () => {
        const { status, body } = await request(server, '/api/dashboard');
        strict_1.default.equal(status, 200);
        strict_1.default.equal(body.daily_calories.total, 0);
        strict_1.default.equal(body.daily_calories.goal, 2000);
        strict_1.default.equal(body.daily_calories.remaining, 2000);
        strict_1.default.equal(body.weekly_trend.length, 7);
        strict_1.default.equal(body.macro_breakdown.protein_g, 0);
        strict_1.default.equal(body.streak.current, 0);
        strict_1.default.equal(body.streak.longest, 0);
    });
    (0, node_test_1.it)('reflects inserted food log data', async () => {
        const db = (0, db_1.getDb)();
        const today = new Date().toISOString().slice(0, 10);
        db.prepare(`INSERT INTO food_logs (logged_at, calories, protein_g, carbs_g, fat_g, description)
       VALUES (?, 500, 30, 50, 20, 'test meal')`).run(today);
        const { status, body } = await request(server, '/api/dashboard');
        strict_1.default.equal(status, 200);
        strict_1.default.equal(body.daily_calories.total, 500);
        strict_1.default.equal(body.daily_calories.remaining, 1500);
        strict_1.default.equal(body.macro_breakdown.protein_g, 30);
        strict_1.default.equal(body.macro_breakdown.carbs_g, 50);
        strict_1.default.equal(body.macro_breakdown.fat_g, 20);
        strict_1.default.equal(body.streak.current, 1);
        strict_1.default.equal(body.streak.longest, 1);
        strict_1.default.ok(body.macro_breakdown.protein_pct > 0);
    });
    (0, node_test_1.it)('calculates multi-day streak', async () => {
        const db = (0, db_1.getDb)();
        const today = new Date().toISOString().slice(0, 10);
        // Add entries for yesterday and day before
        const yesterday = shiftDate(today, -1);
        const dayBefore = shiftDate(today, -2);
        db.prepare(`INSERT INTO food_logs (logged_at, calories, protein_g, carbs_g, fat_g, description)
       VALUES (?, 400, 20, 40, 15, 'yesterday meal')`).run(yesterday);
        db.prepare(`INSERT INTO food_logs (logged_at, calories, protein_g, carbs_g, fat_g, description)
       VALUES (?, 350, 25, 35, 10, 'day before meal')`).run(dayBefore);
        const { body } = await request(server, '/api/dashboard');
        strict_1.default.equal(body.streak.current, 3);
        strict_1.default.equal(body.streak.longest, 3);
    });
});
function shiftDate(dateStr, days) {
    const d = new Date(dateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}
//# sourceMappingURL=dashboard.test.js.map