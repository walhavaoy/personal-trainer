import express from 'express';
import pinoHttp from 'pino-http';
import pino from 'pino';
import { getDb, closeDb } from './db';
import dashboardRouter from './routes/dashboard';

const logger = pino({ name: 'server' });

const PORT = parseInt(process.env['PORT'] || '3000', 10);

const app = express();

app.use(express.json());
app.use(pinoHttp({ logger }));

// Initialise database on startup
getDb();

// Routes
app.use('/api', dashboardRouter);

// Health check
app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, 'server started');
});

function shutdown(): void {
  logger.info('shutting down');
  server.close(() => {
    try {
      closeDb();
    } catch (err: unknown) {
      logger.error({ err }, 'error closing database during shutdown');
    }
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;
