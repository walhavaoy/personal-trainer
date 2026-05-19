import express, { type Request, type Response, type NextFunction } from 'express';
import pino from 'pino';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const logger = pino({ name: 'pt' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const TRUST_FORWARD_AUTH = process.env['TRUST_FORWARD_AUTH'] === 'true';

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — exiting');
  process.exit(1);
});

const app = express();
app.use(express.json({ limit: '100kb' }));

interface AuthedUser {
  username: string;
  email: string | null;
  fullName: string | null;
}

function getUser(req: Request): AuthedUser | null {
  if (!TRUST_FORWARD_AUTH) {
    return { username: 'dev', email: 'dev@local', fullName: 'Dev User' };
  }
  const u = req.headers['x-forwarded-user'];
  if (typeof u !== 'string' || u.length === 0) return null;
  const email = req.headers['x-forwarded-email'];
  const name = req.headers['x-forwarded-name'] ?? req.headers['x-forwarded-preferred-username'];
  return {
    username: u,
    email: typeof email === 'string' ? email : null,
    fullName: typeof name === 'string' ? name : null,
  };
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function servePublicFile(filePath: string, res: Response): void {
  const abs = path.resolve(PUBLIC_DIR, filePath.replace(/^\//, ''));
  if (!abs.startsWith(PUBLIC_DIR + path.sep) && abs !== PUBLIC_DIR) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  if (!fs.existsSync(abs)) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }
  const ext = path.extname(abs).toLowerCase();
  const mime = MIME_TYPES[ext] ?? 'application/octet-stream';
  res.setHeader('Content-Type', mime);
  res.sendFile(abs);
}

app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));
app.get('/readyz', (_req, res) => res.json({ status: 'ok' }));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.get('/api/me', (req: Request, res: Response) => {
  const user = getUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthenticated' });
    return;
  }
  res.json(user);
});

app.get('/', (_req, res) => servePublicFile('index.html', res));

app.use('/css', express.static(path.join(PUBLIC_DIR, 'css')));
app.use('/js', express.static(path.join(PUBLIC_DIR, 'js')));

app.use((_req, res) => res.status(404).json({ error: 'Not Found' }));

app.use((err: Error & { type?: string }, _req: Request, res: Response, _next: NextFunction) => {
  if (err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = parseInt(process.env['PORT'] ?? '8080', 10) || 8080;

const server = app.listen(PORT, () => {
  logger.info({ port: PORT, trustForwardAuth: TRUST_FORWARD_AUTH }, 'PT service listening');
});

let shuttingDown = false;
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal: sig }, 'Shutting down');
    server.close(() => process.exit(0));
  });
}

export { app };
