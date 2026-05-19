import express, { type Request, type Response, type NextFunction } from 'express';
import pino from 'pino';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, migrate, VALID_GOALS, VALID_LEVELS, type ProfileRow } from './db.js';
import { deriveSession } from './session.js';

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

async function getOrCreateProfile(user: AuthedUser): Promise<ProfileRow> {
  const sel = await pool.query<ProfileRow>(
    'SELECT * FROM pt_user WHERE username = $1',
    [user.username],
  );
  if (sel.rows.length > 0) {
    const row = sel.rows[0]!;
    const emailChanged = user.email !== null && user.email !== row.email;
    const nameChanged = user.fullName !== null && user.fullName !== row.full_name;
    if (emailChanged || nameChanged) {
      const upd = await pool.query<ProfileRow>(
        `UPDATE pt_user
            SET email = COALESCE($2, email),
                full_name = COALESCE($3, full_name),
                updated_at = now()
          WHERE username = $1
        RETURNING *`,
        [user.username, user.email, user.fullName],
      );
      return upd.rows[0]!;
    }
    return row;
  }
  const ins = await pool.query<ProfileRow>(
    `INSERT INTO pt_user (username, email, full_name) VALUES ($1, $2, $3) RETURNING *`,
    [user.username, user.email, user.fullName],
  );
  return ins.rows[0]!;
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
app.get('/readyz', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'error' });
  }
});
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.get('/api/me', (req: Request, res: Response) => {
  const user = getUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthenticated' });
    return;
  }
  res.json(user);
});

app.get('/api/me/profile', async (req: Request, res: Response) => {
  const user = getUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthenticated' });
    return;
  }
  try {
    const profile = await getOrCreateProfile(user);
    res.json(profileToJson(profile));
  } catch (err) {
    logger.error({ err, username: user.username }, 'Failed to load profile');
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/me/profile', async (req: Request, res: Response) => {
  const user = getUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthenticated' });
    return;
  }
  const body = req.body as Record<string, unknown> | undefined;
  if (typeof body !== 'object' || body === null) {
    res.status(400).json({ error: 'Body must be a JSON object' });
    return;
  }
  const goal = typeof body['goal'] === 'string' ? body['goal'] : undefined;
  const level = typeof body['fitnessLevel'] === 'string' ? body['fitnessLevel'] : undefined;
  const weekly = typeof body['weeklyMinutes'] === 'number' ? body['weeklyMinutes'] : undefined;

  if (goal !== undefined && !VALID_GOALS.has(goal)) {
    res.status(400).json({ error: `goal must be one of: ${Array.from(VALID_GOALS).join(', ')}` });
    return;
  }
  if (level !== undefined && !VALID_LEVELS.has(level)) {
    res.status(400).json({ error: `fitnessLevel must be one of: ${Array.from(VALID_LEVELS).join(', ')}` });
    return;
  }
  if (weekly !== undefined && (!Number.isInteger(weekly) || weekly < 0 || weekly > 1500)) {
    res.status(400).json({ error: 'weeklyMinutes must be an integer between 0 and 1500' });
    return;
  }

  try {
    await getOrCreateProfile(user); // ensure exists
    const upd = await pool.query<ProfileRow>(
      `UPDATE pt_user
          SET goal           = COALESCE($2, goal),
              fitness_level  = COALESCE($3, fitness_level),
              weekly_minutes = COALESCE($4, weekly_minutes),
              updated_at     = now()
        WHERE username = $1
      RETURNING *`,
      [user.username, goal ?? null, level ?? null, weekly ?? null],
    );
    res.json(profileToJson(upd.rows[0]!));
  } catch (err) {
    logger.error({ err, username: user.username }, 'Failed to update profile');
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/me/today', async (req: Request, res: Response) => {
  const user = getUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthenticated' });
    return;
  }
  try {
    const profile = await getOrCreateProfile(user);
    res.json(deriveSession(profile));
  } catch (err) {
    logger.error({ err, username: user.username }, 'Failed to derive session');
    res.status(500).json({ error: 'Internal server error' });
  }
});

function profileToJson(row: ProfileRow): Record<string, unknown> {
  return {
    username: row.username,
    email: row.email,
    fullName: row.full_name,
    goal: row.goal,
    fitnessLevel: row.fitness_level,
    weeklyMinutes: row.weekly_minutes,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

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

async function main(): Promise<void> {
  await migrate();
  const server = app.listen(PORT, () => {
    logger.info({ port: PORT, trustForwardAuth: TRUST_FORWARD_AUTH }, 'PT service listening');
  });
  let shuttingDown = false;
  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, () => {
      if (shuttingDown) return;
      shuttingDown = true;
      logger.info({ signal: sig }, 'Shutting down');
      server.close(async () => {
        try { await pool.end(); } catch (e) { logger.error({ err: e }, 'pool close'); }
        process.exit(0);
      });
    });
  }
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start');
  process.exit(1);
});

export { app };
