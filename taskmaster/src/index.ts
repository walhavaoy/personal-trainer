import express from 'express';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { mealsRouter } from './routes/meals';

const logger = pino({ name: 'taskmaster' });
const port = parseInt(process.env['PORT'] || '3000', 10);

const app = express();

app.use(express.json());
app.use(pinoHttp({ logger }));

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/meals', mealsRouter);

const server = app.listen(port, () => {
  logger.info({ port }, 'taskmaster listening');
});

function shutdown(): void {
  logger.info('shutting down');
  try {
    server.close();
  } catch (err: unknown) {
    logger.error({ err }, 'error closing server');
  }
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { app };
