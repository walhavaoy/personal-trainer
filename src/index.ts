import express from 'express';
import pinoHttp from 'pino-http';
import fs from 'fs';
import path from 'path';
import { logger } from './logger';
import { initDb, closeDb } from './db';
import { workoutsRouter } from './routes/workouts';
import { mealsRouter } from './routes/meals';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

const app = express();

app.use(express.json());
app.use(pinoHttp({ logger }));

app.use('/api/workouts', workoutsRouter);
app.use('/api/meals', mealsRouter);

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

function ensureDataDir(): void {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function start(): void {
  ensureDataDir();
  initDb();

  const server = app.listen(PORT, () => {
    logger.info({ port: PORT }, 'Personal Trainer API started');
  });

  const shutdown = (): void => {
    logger.info('Shutting down...');
    try {
      closeDb();
    } catch (err) {
      logger.error({ err }, 'Error closing database');
    }
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

export { app };

start();
