"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const pino_http_1 = __importDefault(require("pino-http"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger_1 = require("./logger");
const db_1 = require("./db");
const workouts_1 = require("./routes/workouts");
const PORT = parseInt(process.env.PORT ?? '3000', 10);
const app = (0, express_1.default)();
exports.app = app;
app.use(express_1.default.json());
app.use((0, pino_http_1.default)({ logger: logger_1.logger }));
app.use('/api/workouts', workouts_1.workoutsRouter);
app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
});
function ensureDataDir() {
    const dataDir = path_1.default.join(process.cwd(), 'data');
    if (!fs_1.default.existsSync(dataDir)) {
        fs_1.default.mkdirSync(dataDir, { recursive: true });
    }
}
function start() {
    ensureDataDir();
    (0, db_1.initDb)();
    const server = app.listen(PORT, () => {
        logger_1.logger.info({ port: PORT }, 'Personal Trainer API started');
    });
    const shutdown = () => {
        logger_1.logger.info('Shutting down...');
        try {
            (0, db_1.closeDb)();
        }
        catch (err) {
            logger_1.logger.error({ err }, 'Error closing database');
        }
        server.close(() => {
            process.exit(0);
        });
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}
start();
//# sourceMappingURL=index.js.map