"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const pino_http_1 = __importDefault(require("pino-http"));
const logger_1 = require("./logger");
const settings_1 = require("./routes/settings");
const db_1 = require("./db");
const PORT = Number(process.env.PORT ?? 3000);
const app = (0, express_1.default)();
exports.app = app;
app.use(express_1.default.json());
app.use((0, pino_http_1.default)({ logger: logger_1.logger }));
app.use('/api/settings', settings_1.settingsRouter);
app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
});
const server = app.listen(PORT, () => {
    logger_1.logger.info({ port: PORT }, 'server listening');
});
function shutdown() {
    logger_1.logger.info('shutting down');
    server.close(() => {
        try {
            (0, db_1.closeDb)();
        }
        catch (err) {
            logger_1.logger.error({ err }, 'error closing database');
        }
        process.exit(0);
    });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
//# sourceMappingURL=index.js.map