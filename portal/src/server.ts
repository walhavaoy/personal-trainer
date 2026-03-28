import express from 'express';
import path from 'path';
import pino from 'pino';
import pinoHttp from 'pino-http';

const logger = pino({ name: 'portal' });

interface HealthResponse {
  status: string;
  timestamp: string;
}

export function createApp(): express.Application {
  const app = express();

  app.use(pinoHttp({ logger }));
  app.use(express.json());

  // API routes
  app.get('/api/health', (_req, res) => {
    const response: HealthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  });

  // Serve static frontend files from public/
  const publicDir = path.join(__dirname, '..', 'public');
  app.use(express.static(publicDir));

  // SPA fallback: serve index.html for non-API routes that don't match a static file
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  return app;
}

function main(): void {
  const port = parseInt(process.env['PORT'] || '3000', 10);
  const app = createApp();

  const server = app.listen(port, () => {
    logger.info({ port }, 'Portal server started');
  });

  const shutdown = (): void => {
    logger.info('Shutting down portal server');
    try {
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main();
