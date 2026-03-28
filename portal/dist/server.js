"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const pino_1 = __importDefault(require("pino"));
const pino_http_1 = __importDefault(require("pino-http"));
const logger = (0, pino_1.default)({ name: 'portal' });
function createApp() {
    const app = (0, express_1.default)();
    app.use((0, pino_http_1.default)({ logger }));
    app.use(express_1.default.json());
    // API routes
    app.get('/api/health', (_req, res) => {
        const response = {
            status: 'ok',
            timestamp: new Date().toISOString(),
        };
        res.json(response);
    });
    // Serve static frontend files from public/
    const publicDir = path_1.default.join(__dirname, '..', 'public');
    app.use(express_1.default.static(publicDir));
    // SPA fallback: serve index.html for non-API routes that don't match a static file
    app.get('*', (_req, res) => {
        res.sendFile(path_1.default.join(publicDir, 'index.html'));
    });
    return app;
}
function main() {
    const port = parseInt(process.env['PORT'] || '3000', 10);
    const app = createApp();
    const server = app.listen(port, () => {
        logger.info({ port }, 'Portal server started');
    });
    const shutdown = () => {
        logger.info('Shutting down portal server');
        try {
            server.close(() => {
                logger.info('Server closed');
                process.exit(0);
            });
        }
        catch (err) {
            logger.error({ err }, 'Error during shutdown');
            process.exit(1);
        }
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}
main();
//# sourceMappingURL=server.js.map