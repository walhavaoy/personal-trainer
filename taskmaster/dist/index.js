"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const pino_1 = __importDefault(require("pino"));
const pino_http_1 = __importDefault(require("pino-http"));
const meals_1 = require("./routes/meals");
const logger = (0, pino_1.default)({ name: 'taskmaster' });
const port = parseInt(process.env['PORT'] || '3000', 10);
const app = (0, express_1.default)();
exports.app = app;
app.use(express_1.default.json());
app.use((0, pino_http_1.default)({ logger }));
app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
});
app.use('/api/meals', meals_1.mealsRouter);
const server = app.listen(port, () => {
    logger.info({ port }, 'taskmaster listening');
});
function shutdown() {
    logger.info('shutting down');
    try {
        server.close();
    }
    catch (err) {
        logger.error({ err }, 'error closing server');
    }
    process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
//# sourceMappingURL=index.js.map