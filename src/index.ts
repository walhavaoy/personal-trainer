import express from 'express';
import pinoHttp from 'pino-http';
import { logger } from './logger';
import { settingsRouter } from './routes/settings';
import { closeDb } from './db';

const PORT = Number(process.env.PORT ?? 3000);

const app = express();

app.use(express.json());
app.use(pinoHttp({ logger }));

app.use('/api/settings', settingsRouter);

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, 'server listening');
});

function shutdown(): void {
  logger.info('shutting down');
  server.close(() => {
    try {
      closeDb();
    } catch (err: unknown) {
      logger.error({ err }, 'error closing database');
    }
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { app };
