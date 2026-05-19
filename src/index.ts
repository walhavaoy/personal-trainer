import express, { type Request, type Response, type NextFunction } from 'express';
import pino from 'pino';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, migrate, VALID_GOALS, VALID_LEVELS, isValidTimezone, type ProfileRow, type WorkoutRow } from './db.js';
import { deriveSession, wasRestDay, type RecentContext } from './session.js';
import { computeSummary, computeTrend } from './summary.js';
import { calendarDate, todayAndYesterday } from './tz.js';

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
  const timezone = typeof body['timezone'] === 'string' ? body['timezone'] : undefined;

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
  if (timezone !== undefined && !isValidTimezone(timezone)) {
    res.status(400).json({ error: 'timezone must be a valid IANA timezone (e.g. America/Los_Angeles)' });
    return;
  }

  try {
    await getOrCreateProfile(user); // ensure exists
    const upd = await pool.query<ProfileRow>(
      `UPDATE pt_user
          SET goal           = COALESCE($2, goal),
              fitness_level  = COALESCE($3, fitness_level),
              weekly_minutes = COALESCE($4, weekly_minutes),
              timezone       = COALESCE($5, timezone),
              updated_at     = now()
        WHERE username = $1
      RETURNING *`,
      [user.username, goal ?? null, level ?? null, weekly ?? null, timezone ?? null],
    );
    res.json(profileToJson(upd.rows[0]!));
  } catch (err) {
    logger.error({ err, username: user.username }, 'Failed to update profile');
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/me/workouts', async (req: Request, res: Response) => {
  const user = getUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthenticated' });
    return;
  }
  try {
    const result = await pool.query<WorkoutRow>(
      `SELECT * FROM pt_workout
        WHERE username = $1
        ORDER BY workout_date DESC, id DESC
        LIMIT 30`,
      [user.username],
    );
    res.json(result.rows.map(workoutToJson));
  } catch (err) {
    logger.error({ err, username: user.username }, 'Failed to list workouts');
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/api/me/workouts/:id', async (req: Request<{ id: string }>, res: Response) => {
  const user = getUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthenticated' });
    return;
  }
  const id = req.params.id;
  if (!/^\d+$/.test(id)) {
    res.status(400).json({ error: 'id must be a positive integer' });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const completed = body['completedMinutes'];
  const notesInput = body['notes'];
  // Allow null to clear notes; reject other non-string types
  let notes: string | null | undefined;
  if (notesInput === undefined) notes = undefined;
  else if (notesInput === null) notes = null;
  else if (typeof notesInput === 'string' && notesInput.length <= 500) notes = notesInput;
  else { res.status(400).json({ error: 'notes must be a string (≤500 chars) or null' }); return; }

  if (completed !== undefined && (typeof completed !== 'number' || !Number.isInteger(completed) || completed < 0 || completed > 1000)) {
    res.status(400).json({ error: 'completedMinutes must be an integer between 0 and 1000' });
    return;
  }
  if (completed === undefined && notes === undefined) {
    res.status(400).json({ error: 'must update at least one of completedMinutes, notes' });
    return;
  }

  try {
    const result = await pool.query<WorkoutRow>(
      `UPDATE pt_workout
          SET completed_minutes = COALESCE($3, completed_minutes),
              notes             = CASE WHEN $4::bool THEN $5 ELSE notes END
        WHERE id = $1::bigint AND username = $2
        RETURNING *`,
      [id, user.username, completed ?? null, notes !== undefined, notes],
    );
    if (result.rows.length === 0) {
      // 404 (not 403) on someone else's row — don't leak that the id exists.
      res.status(404).json({ error: 'Workout not found' });
      return;
    }
    res.json(workoutToJson(result.rows[0]!));
  } catch (err) {
    logger.error({ err, username: user.username, id }, 'Failed to update workout');
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/me/workouts/:id', async (req: Request<{ id: string }>, res: Response) => {
  const user = getUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthenticated' });
    return;
  }
  const id = req.params.id;
  if (!/^\d+$/.test(id)) {
    res.status(400).json({ error: 'id must be a positive integer' });
    return;
  }
  try {
    const result = await pool.query(
      'DELETE FROM pt_workout WHERE id = $1::bigint AND username = $2',
      [id, user.username],
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Workout not found' });
      return;
    }
    res.status(204).end();
  } catch (err) {
    logger.error({ err, username: user.username, id }, 'Failed to delete workout');
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/me/today/rest', async (req: Request, res: Response) => {
  const user = getUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthenticated' });
    return;
  }
  try {
    const profile = await getOrCreateProfile(user);
    const tz = profile.timezone || 'UTC';
    const todayIso = calendarDate(new Date(), tz);
    // Refuse if today already has any entry — clients should DELETE first if they want to overwrite.
    const existing = await pool.query(
      `SELECT 1 FROM pt_workout WHERE username = $1 AND workout_date = $2 LIMIT 1`,
      [user.username, todayIso],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      res.status(409).json({ error: 'Today already has a logged entry; delete it first to set rest' });
      return;
    }
    const result = await pool.query<WorkoutRow>(
      `INSERT INTO pt_workout
            (username, workout_date, theme, planned_minutes, completed_minutes, notes)
       VALUES ($1, $2, 'Rest', 0, 0, $3)
       RETURNING *`,
      [user.username, todayIso, (req.body && typeof req.body.notes === 'string') ? req.body.notes.slice(0, 500) : null],
    );
    logger.info({ username: user.username, date: todayIso }, 'Manual rest day');
    res.status(201).json(workoutToJson(result.rows[0]!));
  } catch (err) {
    logger.error({ err, username: user.username }, 'Failed to record rest day');
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/me/workouts', async (req: Request, res: Response) => {
  const user = getUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthenticated' });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;

  // Profile is needed both to validate date defaulting (user's tz) and to derive theme below.
  const profile = await getOrCreateProfile(user);
  const dateInput = typeof body['date'] === 'string'
    ? body['date']
    : calendarDate(new Date(), profile.timezone || 'UTC');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    return;
  }
  const completed = body['completedMinutes'];
  if (typeof completed !== 'number' || !Number.isInteger(completed) || completed < 0 || completed > 1000) {
    res.status(400).json({ error: 'completedMinutes must be an integer between 0 and 1000' });
    return;
  }
  const notes = typeof body['notes'] === 'string' && body['notes'].length <= 500 ? body['notes'] : null;

  try {
    // Profile already loaded above.
    // Derive theme/planned from the profile-driven session for the requested date,
    // not from client input — we don't want clients fabricating arbitrary themes.
    // Use today's recent-context so the planned-minutes recorded match the adapted
    // session the user was actually shown.
    const sessionDate = new Date(`${dateInput}T12:00:00Z`);
    const ctx = await loadRecentContext(user.username, profile, sessionDate);
    const session = deriveSession(profile, sessionDate, ctx);
    const themeInput = typeof body['theme'] === 'string' ? body['theme'] : session.theme;

    const result = await pool.query<WorkoutRow>(
      `INSERT INTO pt_workout
            (username, workout_date, theme, planned_minutes, completed_minutes, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [user.username, dateInput, themeInput, session.totalMinutes, completed, notes],
    );
    logger.info({ username: user.username, date: dateInput, completed }, 'Workout logged');
    res.status(201).json(workoutToJson(result.rows[0]!));
  } catch (err) {
    logger.error({ err, username: user.username }, 'Failed to log workout');
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/me/summary', async (req: Request, res: Response) => {
  const user = getUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthenticated' });
    return;
  }
  try {
    const profile = await getOrCreateProfile(user);
    // 60 days is enough to compute current streak even with sparse training.
    const workouts = await pool.query<WorkoutRow>(
      `SELECT * FROM pt_workout
        WHERE username = $1
          AND workout_date >= CURRENT_DATE - INTERVAL '60 days'
        ORDER BY workout_date DESC`,
      [user.username],
    );
    res.json(computeSummary(profile, workouts.rows));
  } catch (err) {
    logger.error({ err, username: user.username }, 'Failed to compute summary');
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/me/trend', async (req: Request, res: Response) => {
  const user = getUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthenticated' });
    return;
  }
  const weeksParam = req.query['weeks'];
  let weeks = 8;
  if (typeof weeksParam === 'string') {
    const parsed = parseInt(weeksParam, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 26) {
      res.status(400).json({ error: 'weeks must be an integer 1..26' });
      return;
    }
    weeks = parsed;
  }
  try {
    const profile = await getOrCreateProfile(user);
    // Pull enough rows: weeks*7 days back from today, plus a few day buffer.
    const workouts = await pool.query<WorkoutRow>(
      `SELECT * FROM pt_workout
        WHERE username = $1
          AND workout_date >= CURRENT_DATE - ($2::int * 7 + 7) * INTERVAL '1 day'
        ORDER BY workout_date DESC`,
      [user.username, weeks],
    );
    res.json(computeTrend(profile, workouts.rows, new Date(), weeks));
  } catch (err) {
    logger.error({ err, username: user.username }, 'Failed to compute trend');
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/me/preview', async (req: Request, res: Response) => {
  const user = getUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthenticated' });
    return;
  }
  // Cap N at 7 to bound CPU and keep the response trivially small.
  const daysParam = req.query['days'];
  let days = 3;
  if (typeof daysParam === 'string') {
    const parsed = parseInt(daysParam, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 7) {
      res.status(400).json({ error: 'days must be an integer 1..7' });
      return;
    }
    days = parsed;
  }
  try {
    const profile = await getOrCreateProfile(user);
    const now = new Date();
    // For previews we deliberately pass a *blank* recent context so the
    // sketch shows the baseline plan, not an adaptation that depends on
    // what may or may not happen between now and then.
    const previews: Array<{ date: string; dayOfWeek: string; theme: string; totalMinutes: number }> = [];
    for (let i = 1; i <= days; i++) {
      const at = new Date(now.getTime() + i * 24 * 3600 * 1000);
      const session = deriveSession(profile, at, undefined, 'baseline');
      previews.push({
        date: session.date,
        dayOfWeek: session.dayOfWeek,
        theme: session.theme,
        totalMinutes: session.totalMinutes,
      });
    }
    res.json(previews);
  } catch (err) {
    logger.error({ err, username: user.username }, 'Failed to compute preview');
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
    const now = new Date();
    const ctx = await loadRecentContext(user.username, profile, now);
    res.json(deriveSession(profile, now, ctx));
  } catch (err) {
    logger.error({ err, username: user.username }, 'Failed to derive session');
    res.status(500).json({ error: 'Internal server error' });
  }
});

function workoutToJson(row: WorkoutRow): Record<string, unknown> {
  const wd = row.workout_date;
  return {
    id: typeof row.id === 'string' ? row.id : String(row.id),
    username: row.username,
    date: wd instanceof Date ? wd.toISOString().slice(0, 10) : String(wd).slice(0, 10),
    theme: row.theme,
    plannedMinutes: row.planned_minutes,
    completedMinutes: row.completed_minutes,
    notes: row.notes,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}

async function loadRecentContext(username: string, profile: ProfileRow, now: Date): Promise<RecentContext> {
  const tz = profile.timezone || 'UTC';
  const result = await pool.query<WorkoutRow>(
    `SELECT * FROM pt_workout
      WHERE username = $1
        AND workout_date >= CURRENT_DATE - INTERVAL '14 days'
      ORDER BY workout_date DESC`,
    [username],
  );
  const rows = result.rows;
  const { today: todayIso, yesterday: yesterdayIso } = todayAndYesterday(now, tz);
  const rowIso = (r: WorkoutRow) =>
    r.workout_date instanceof Date ? r.workout_date.toISOString().slice(0, 10) : String(r.workout_date).slice(0, 10);
  const yWorkout = rows.find((r) => rowIso(r) === yesterdayIso);

  let yesterdayComplianceRatio: number | null = null;
  if (yWorkout && yWorkout.planned_minutes > 0) {
    yesterdayComplianceRatio = yWorkout.completed_minutes / yWorkout.planned_minutes;
  }

  const loggedDates = new Set<string>(rows.map(rowIso));
  let cursorIso: string | null = null;
  if (loggedDates.has(todayIso)) cursorIso = todayIso;
  else if (loggedDates.has(yesterdayIso)) cursorIso = yesterdayIso;
  let streakDays = 0;
  while (cursorIso && loggedDates.has(cursorIso)) {
    streakDays += 1;
    const prev = new Date(cursorIso + 'T00:00:00Z');
    prev.setUTCDate(prev.getUTCDate() - 1);
    cursorIso = prev.toISOString().slice(0, 10);
  }

  // For yesterdayWasRest, we want "was yesterday's calendar day a rest day in this tz?"
  // Build an Instant at yesterday-noon-UTC and let session.ts use the profile tz.
  const yesterdayAt = new Date(yesterdayIso + 'T12:00:00Z');
  return {
    yesterdayComplianceRatio,
    streakDays,
    yesterdayWasRest: wasRestDay(profile, yesterdayAt),
  };
}

function profileToJson(row: ProfileRow): Record<string, unknown> {
  return {
    username: row.username,
    email: row.email,
    fullName: row.full_name,
    goal: row.goal,
    fitnessLevel: row.fitness_level,
    weeklyMinutes: row.weekly_minutes,
    timezone: row.timezone,
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
