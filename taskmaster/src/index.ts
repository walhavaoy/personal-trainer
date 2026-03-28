import express from 'express';
import pino from 'pino';
import pinoHttp from 'pino-http';

const logger = pino({ name: 'taskmaster' });

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);

const app = express();

app.use(express.json());
app.use(pinoHttp({ logger }));

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, 'taskmaster listening');
});

function shutdown(signal: string): void {
  logger.info({ signal }, 'shutting down');
  server.close(() => {
    logger.info('server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { app };
