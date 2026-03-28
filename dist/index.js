"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const pino_http_1 = __importDefault(require("pino-http"));
const pino_1 = __importDefault(require("pino"));
const db_1 = require("./db");
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const logger = (0, pino_1.default)({ name: 'server' });
const PORT = parseInt(process.env['PORT'] || '3000', 10);
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, pino_http_1.default)({ logger }));
// Initialise database on startup
(0, db_1.getDb)();
// Routes
app.use('/api', dashboard_1.default);
// Health check
app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
});
const server = app.listen(PORT, () => {
    logger.info({ port: PORT }, 'server started');
});
function shutdown() {
    logger.info('shutting down');
    server.close(() => {
        try {
            (0, db_1.closeDb)();
        }
        catch (err) {
            logger.error({ err }, 'error closing database during shutdown');
        }
        process.exit(0);
    });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
exports.default = app;
//# sourceMappingURL=index.js.map