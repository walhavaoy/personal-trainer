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

// Read version.json from the container root (Dockerfile generates it at build).
// Tolerate missing file by falling back to "dev" sentinel — keeps `tsx watch`
// dev mode working.
const VERSION_INFO = (() => {
  try {
    const p = path.join(__dirname, '..', 'version.json');
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return { semver: '0.0.0-dev', version: '0.0.0-dev', sha: 'unknown', branch: 'unknown', builtAt: 'unknown', component: 'pt' };
  }
})();
const STARTED_AT = Date.now();

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

app.get('/api/version', (_req, res) => {
  res.json({
    ...VERSION_INFO,
    uptimeSeconds: Math.floor((Date.now() - STARTED_AT) / 1000),
  });
});

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

app.get('/api/me/dashboard', async (req: Request, res: Response) => {
  // Batch endpoint: returns everything the home page needs in one round trip.
  // Composition of existing helpers — no new business logic.
  const user = getUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthenticated' });
    return;
  }
  try {
    const profile = await getOrCreateProfile(user);
    const tz = profile.timezone || 'UTC';
    const now = new Date();

    // Fetch the workout rows once and reuse for context, summary, trend, history, and previous-session lookup.
    const workouts = await loadRecentWorkouts(user.username, 70);

    const ctx = computeRecentContext(workouts, profile, now);
    const session = deriveSession(profile, now, ctx);

    const todayIso = calendarDate(now, tz);
    const previousSession = findPreviousSameThemeSession(workouts, session.theme, todayIso);

    const previews: Array<{ date: string; dayOfWeek: string; theme: string; totalMinutes: number }> = [];
    for (let i = 1; i <= 3; i++) {
      const at = new Date(now.getTime() + i * 24 * 3600 * 1000);
      const s = deriveSession(profile, at, undefined, 'baseline');
      previews.push({ date: s.date, dayOfWeek: s.dayOfWeek, theme: s.theme, totalMinutes: s.totalMinutes });
    }

    const lifetime = await loadLifetimeStats(user.username);
    res.json({
      profile: profileToJson(profile),
      today: { ...session, previousSession },
      summary: computeSummary(profile, workouts, now),
      trend: computeTrend(profile, workouts, now, 8),
      preview: previews,
      lifetime,
      // Cap to 30 like /api/me/workouts does; bigger window of 70 days above is for summary/trend.
      workouts: workouts.slice(0, 30).map(workoutToJson),
    });
  } catch (err) {
    logger.error({ err, username: user.username }, 'Failed to build dashboard');
    res.status(500).json({ error: 'Internal server error' });
  }
});

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

app.post('/api/me/profile/reset', async (req: Request, res: Response) => {
  const user = getUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthenticated' });
    return;
  }
  try {
    await getOrCreateProfile(user); // ensure exists
    // Reset to the same defaults as the schema CREATE TABLE block, except
    // for tz which we keep as-is (user already told us their zone).
    const upd = await pool.query<ProfileRow>(
      `UPDATE pt_user
          SET goal           = 'general_fitness',
              fitness_level  = 'beginner',
              weekly_minutes = 150,
              updated_at     = now()
        WHERE username = $1
      RETURNING *`,
      [user.username],
    );
    logger.info({ username: user.username }, 'Profile reset to defaults');
    res.json(profileToJson(upd.rows[0]!));
  } catch (err) {
    logger.error({ err, username: user.username }, 'Failed to reset profile');
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
  // displayName: empty string clears the override; null also clears; missing leaves unchanged.
  const displayNameInput = body['displayName'];
  let displayName: string | null | undefined;
  if (displayNameInput === undefined) displayName = undefined;
  else if (displayNameInput === null || displayNameInput === '') displayName = null;
  else if (typeof displayNameInput === 'string' && displayNameInput.length <= 100) displayName = displayNameInput.trim() || null;
  else {
    res.status(400).json({ error: 'displayName must be a string ≤100 chars (or null to clear)' });
    return;
  }

  if (goal !== undefined && !VALID_GOALS.has(goal)) {
    res.status(400).json({ error: `goal must be one of: ${Array.from(VALID_GOALS).join(', ')}` });
    return;
  }
  if (level !== undefined && !VALID_LEVELS.has(level)) {
    res.status(400).json({ error: `fitnessLevel must be one of: ${Array.from(VALID_LEVELS).join(', ')}` });
    return;
  }
  if (weekly !== undefined && (!Number.isInteger(weekly) || weekly < 15 || weekly > 1500)) {
    res.status(400).json({ error: 'weeklyMinutes must be an integer between 15 and 1500 (at least one short session per week)' });
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
              display_name   = CASE WHEN $6::bool THEN $7 ELSE display_name END,
              updated_at     = now()
        WHERE username = $1
      RETURNING *`,
      [user.username, goal ?? null, level ?? null, weekly ?? null, timezone ?? null, displayName !== undefined, displayName ?? null],
    );
    res.json(profileToJson(upd.rows[0]!));
  } catch (err) {
    logger.error({ err, username: user.username }, 'Failed to update profile');
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/me/workouts.csv', async (req: Request, res: Response) => {
  const user = getUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthenticated' });
    return;
  }
  try {
    const result = await pool.query<WorkoutRow>(
      `SELECT * FROM pt_workout WHERE username = $1 ORDER BY workout_date ASC, id ASC`,
      [user.username],
    );
    const escape = (v: string): string =>
      /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    const lines = ['date,theme,planned_minutes,completed_minutes,distance_km,exercises_completed,notes'];
    for (const r of result.rows) {
      const date = r.workout_date instanceof Date
        ? r.workout_date.toISOString().slice(0, 10)
        : String(r.workout_date).slice(0, 10);
      const ex = Array.isArray(r.exercises_completed) ? r.exercises_completed.join('; ') : '';
      const dist = r.distance_km == null ? '' : String(r.distance_km);
      lines.push([
        date,
        escape(r.theme),
        String(r.planned_minutes),
        String(r.completed_minutes),
        dist,
        escape(ex),
        escape(r.notes ?? ''),
      ].join(','));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="pt-workouts-${user.username}.csv"`);
    res.send(lines.join('\n') + '\n');
  } catch (err) {
    logger.error({ err, username: user.username }, 'Failed to export CSV');
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/me/workouts', async (req: Request, res: Response) => {
  const user = getUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthenticated' });
    return;
  }
  // Require an explicit confirmation header so a one-character typo in the URL
  // doesn't wipe a user's history.
  if (req.headers['x-confirm-delete-all'] !== 'yes') {
    res.status(400).json({ error: 'set header X-Confirm-Delete-All: yes to confirm bulk delete' });
    return;
  }
  try {
    const result = await pool.query(
      'DELETE FROM pt_workout WHERE username = $1',
      [user.username],
    );
    logger.warn({ username: user.username, deleted: result.rowCount }, 'Bulk-deleted all workouts');
    res.json({ deleted: result.rowCount ?? 0 });
  } catch (err) {
    logger.error({ err, username: user.username }, 'Failed to bulk-delete workouts');
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/me/workouts', async (req: Request, res: Response) => {
  const user = getUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthenticated' });
    return;
  }
  // Optional ?before=YYYY-MM-DD: rows strictly older than that date.
  // Optional ?theme=Name: filter to a single theme (composes with before).
  // Both are used by the history UI to paginate or filter long histories.
  const beforeParam = req.query['before'];
  let before: string | null = null;
  if (typeof beforeParam === 'string' && beforeParam.length > 0) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(beforeParam)) {
      res.status(400).json({ error: 'before must be YYYY-MM-DD' });
      return;
    }
    before = beforeParam;
  }
  const themeParam = req.query['theme'];
  let theme: string | null = null;
  if (typeof themeParam === 'string' && themeParam.length > 0) {
    // Allowlist: any string that has shown up as a theme in our THEMES table,
    // plus 'Rest' (which the rest endpoint uses) and 'Active recovery'.
    if (!/^[A-Za-z][A-Za-z\- ]{0,30}$/.test(themeParam)) {
      res.status(400).json({ error: 'theme must be a short alphabetic label' });
      return;
    }
    theme = themeParam;
  }
  try {
    // Build the query dynamically with positional params.
    const params: unknown[] = [user.username];
    let where = `username = $1`;
    if (before) { params.push(before); where += ` AND workout_date < $${params.length}::date`; }
    if (theme)  { params.push(theme);  where += ` AND theme = $${params.length}`; }
    const result = await pool.query<WorkoutRow>(
      `SELECT * FROM pt_workout
        WHERE ${where}
        ORDER BY workout_date DESC, id DESC
        LIMIT 30`,
      params,
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
  const dist = parseDistanceKm(body['distanceKm']);
  if (dist.error) {
    res.status(400).json({ error: dist.error });
    return;
  }
  // exercisesCompleted: optional string[]. Validation needs the workout's
  // theme — load it first so we know which prescribed exercise names apply.
  // Pass null/[] to clear; missing leaves unchanged.
  const exInput = body['exercisesCompleted'];
  let exercisesCompleted: string[] | undefined;
  if (exInput === undefined) {
    exercisesCompleted = undefined;
  } else if (exInput === null) {
    exercisesCompleted = [];
  } else if (!Array.isArray(exInput)) {
    res.status(400).json({ error: 'exercisesCompleted must be an array of strings (or null to clear)' });
    return;
  } else {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const v of exInput) {
      if (typeof v !== 'string') {
        res.status(400).json({ error: 'exercisesCompleted must be an array of strings' });
        return;
      }
      if (!seen.has(v)) { seen.add(v); out.push(v); }
    }
    exercisesCompleted = out;
  }

  if (completed === undefined && notes === undefined && dist.value === undefined && exercisesCompleted === undefined) {
    res.status(400).json({ error: 'must update at least one of completedMinutes, notes, distanceKm, exercisesCompleted' });
    return;
  }

  try {
    // If the caller supplied exercise names, validate them against the
    // currently-prescribed names for the workout's theme + user's current
    // profile. Load the row first to find its theme.
    if (exercisesCompleted !== undefined && exercisesCompleted.length > 0) {
      const existing = await pool.query<{ theme: string }>(
        `SELECT theme FROM pt_workout WHERE id = $1::bigint AND username = $2`,
        [id, user.username],
      );
      if (existing.rows.length === 0) {
        res.status(404).json({ error: 'Workout not found' });
        return;
      }
      const theme = existing.rows[0]!.theme;
      const profile = await getOrCreateProfile(user);
      // deriveSession is keyed off day-of-week — we need exercises for the
      // workout's theme regardless of which day that maps to. Easiest reliable
      // path: derive sessions for each weekday until one matches that theme.
      let prescribedNames = new Set<string>();
      for (let i = 0; i < 7; i++) {
        const probe = new Date(Date.UTC(2026, 0, 4 + i, 12, 0, 0)); // Sun..Sat
        const s = deriveSession(profile, probe, undefined, 'baseline');
        if (s.theme === theme) {
          prescribedNames = new Set(s.blocks.flatMap((b) => (b.exercises ?? []).map((e) => e.name)));
          break;
        }
      }
      for (const name of exercisesCompleted) {
        if (!prescribedNames.has(name)) {
          res.status(400).json({ error: `exercise "${name}" not prescribed for theme "${theme}" at your current level` });
          return;
        }
      }
    }

    const result = await pool.query<WorkoutRow>(
      `UPDATE pt_workout
          SET completed_minutes   = COALESCE($3, completed_minutes),
              notes               = CASE WHEN $4::bool THEN $5 ELSE notes END,
              distance_km         = CASE WHEN $6::bool THEN $7 ELSE distance_km END,
              exercises_completed = CASE WHEN $8::bool THEN $9::text[] ELSE exercises_completed END
        WHERE id = $1::bigint AND username = $2
        RETURNING *`,
      [
        id, user.username,
        completed ?? null,
        notes !== undefined, notes,
        dist.value !== undefined, dist.value ?? null,
        exercisesCompleted !== undefined, exercisesCompleted ?? null,
      ],
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
    const rows = await loadRecentWorkouts(user.username, 14);
    const ctx = computeRecentContext(rows, profile, sessionDate);
    const session = deriveSession(profile, sessionDate, ctx);
    const themeInput = typeof body['theme'] === 'string' ? body['theme'] : session.theme;

    // Validate exercisesCompleted against the prescribed names so callers can't
    // claim credit for exercises that weren't scheduled today.
    const completedInput = body['exercisesCompleted'];
    let exercisesCompleted: string[] = [];
    if (Array.isArray(completedInput)) {
      const prescribed = new Set(
        session.blocks.flatMap((b) => (b.exercises ?? []).map((e) => e.name)),
      );
      const seen = new Set<string>();
      for (const v of completedInput) {
        if (typeof v !== 'string') {
          res.status(400).json({ error: 'exercisesCompleted must be an array of strings' });
          return;
        }
        if (!prescribed.has(v)) {
          res.status(400).json({ error: `exercise "${v}" not prescribed for this session` });
          return;
        }
        if (!seen.has(v)) { seen.add(v); exercisesCompleted.push(v); }
      }
    } else if (completedInput !== undefined) {
      res.status(400).json({ error: 'exercisesCompleted must be an array of strings' });
      return;
    }

    const dist = parseDistanceKm(body['distanceKm']);
    if (dist.error) {
      res.status(400).json({ error: dist.error });
      return;
    }
    const result = await pool.query<WorkoutRow>(
      `INSERT INTO pt_workout
            (username, workout_date, theme, planned_minutes, completed_minutes, notes, exercises_completed, distance_km)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [user.username, dateInput, themeInput, session.totalMinutes, completed, notes, exercisesCompleted, dist.value ?? null],
    );
    logger.info({ username: user.username, date: dateInput, completed }, 'Workout logged');
    res.status(201).json(workoutToJson(result.rows[0]!));
  } catch (err) {
    logger.error({ err, username: user.username }, 'Failed to log workout');
    res.status(500).json({ error: 'Internal server error' });
  }
});

interface LifetimeStats {
  totalMinutes: number;
  totalSessions: number;
  totalDistanceKm: number;
  distinctDaysActive: number;
  firstWorkoutDate: string | null;
  lastWorkoutDate: string | null;
}

async function loadLifetimeStats(username: string): Promise<LifetimeStats> {
  const result = await pool.query<{
    total_minutes: string | number;
    total_sessions: string | number;
    total_distance: string | number | null;
    distinct_days: string | number;
    first_date: Date | string | null;
    last_date: Date | string | null;
  }>(
    `SELECT
       COALESCE(SUM(completed_minutes), 0) AS total_minutes,
       COUNT(*)                            AS total_sessions,
       COALESCE(SUM(distance_km), 0)       AS total_distance,
       COUNT(DISTINCT workout_date)        AS distinct_days,
       MIN(workout_date)                   AS first_date,
       MAX(workout_date)                   AS last_date
     FROM pt_workout
     WHERE username = $1`,
    [username],
  );
  const row = result.rows[0]!;
  const isoOrNull = (v: Date | string | null): string | null =>
    v == null ? null : (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
  return {
    totalMinutes: Number(row.total_minutes ?? 0),
    totalSessions: Number(row.total_sessions ?? 0),
    totalDistanceKm: Math.round(Number(row.total_distance ?? 0) * 100) / 100,
    distinctDaysActive: Number(row.distinct_days ?? 0),
    firstWorkoutDate: isoOrNull(row.first_date),
    lastWorkoutDate: isoOrNull(row.last_date),
  };
}

app.get('/api/me/lifetime', async (req: Request, res: Response) => {
  const user = getUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthenticated' });
    return;
  }
  try {
    res.json(await loadLifetimeStats(user.username));
  } catch (err) {
    logger.error({ err, username: user.username }, 'Failed to load lifetime stats');
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

app.get('/api/me/session', async (req: Request, res: Response) => {
  // Like /api/me/today but for any ISO date. Used by the backfill UI so the
  // user can see what was prescribed when they pick a past date. Baseline
  // adaptation only — no compliance lookup, since the user hasn't logged it
  // yet (that's the whole point of the form).
  const user = getUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthenticated' });
    return;
  }
  const dateParam = req.query['date'];
  if (typeof dateParam !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    return;
  }
  try {
    const profile = await getOrCreateProfile(user);
    const at = new Date(`${dateParam}T12:00:00Z`);
    res.json(deriveSession(profile, at, undefined, 'baseline'));
  } catch (err) {
    logger.error({ err, username: user.username, date: dateParam }, 'Failed to derive session');
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
    // 70 days is enough to find a previous same-theme session for most schedules.
    const rows = await loadRecentWorkouts(user.username, 70);
    const ctx = computeRecentContext(rows, profile, now);
    const session = deriveSession(profile, now, ctx);
    const tz = profile.timezone || 'UTC';
    const todayIso = calendarDate(now, tz);
    const previousSession = findPreviousSameThemeSession(rows, session.theme, todayIso);

    res.json({ ...session, previousSession });
  } catch (err) {
    logger.error({ err, username: user.username }, 'Failed to derive session');
    res.status(500).json({ error: 'Internal server error' });
  }
});

function workoutToJson(row: WorkoutRow): Record<string, unknown> {
  const wd = row.workout_date;
  // pg returns NUMERIC as string by default; coerce to number for the client.
  const distanceKm = row.distance_km == null ? null
    : (typeof row.distance_km === 'number' ? row.distance_km : parseFloat(row.distance_km));
  return {
    id: typeof row.id === 'string' ? row.id : String(row.id),
    username: row.username,
    date: wd instanceof Date ? wd.toISOString().slice(0, 10) : String(wd).slice(0, 10),
    theme: row.theme,
    plannedMinutes: row.planned_minutes,
    completedMinutes: row.completed_minutes,
    notes: row.notes,
    exercisesCompleted: Array.isArray(row.exercises_completed) ? row.exercises_completed : [],
    distanceKm,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}

// Shared validation: optional distanceKm 0..1000 with one decimal place worth of precision.
function parseDistanceKm(raw: unknown): { value: number | null | undefined; error?: string } {
  if (raw === undefined) return { value: undefined };
  if (raw === null) return { value: null };
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0 || raw > 1000) {
    return { value: undefined, error: 'distanceKm must be a number 0..1000 (or null to clear)' };
  }
  return { value: Math.round(raw * 100) / 100 };
}

function rowDateIso(r: WorkoutRow): string {
  return r.workout_date instanceof Date
    ? r.workout_date.toISOString().slice(0, 10)
    : String(r.workout_date).slice(0, 10);
}

/** Load the user's recent workout rows for in-process derivation. */
async function loadRecentWorkouts(username: string, days: number): Promise<WorkoutRow[]> {
  const result = await pool.query<WorkoutRow>(
    `SELECT * FROM pt_workout
      WHERE username = $1
        AND workout_date >= CURRENT_DATE - ($2::int * INTERVAL '1 day')
      ORDER BY workout_date DESC, id DESC`,
    [username, days],
  );
  return result.rows;
}

/** Compute yesterday-compliance + streak from pre-loaded rows. Pure. */
function computeRecentContext(rows: WorkoutRow[], profile: ProfileRow, now: Date): RecentContext {
  const tz = profile.timezone || 'UTC';
  const { today: todayIso, yesterday: yesterdayIso } = todayAndYesterday(now, tz);
  const yWorkout = rows.find((r) => rowDateIso(r) === yesterdayIso);

  let yesterdayComplianceRatio: number | null = null;
  if (yWorkout && yWorkout.planned_minutes > 0) {
    yesterdayComplianceRatio = yWorkout.completed_minutes / yWorkout.planned_minutes;
  }

  const loggedDates = new Set<string>(rows.map(rowDateIso));
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

  const yesterdayAt = new Date(yesterdayIso + 'T12:00:00Z');
  return {
    yesterdayComplianceRatio,
    streakDays,
    yesterdayWasRest: wasRestDay(profile, yesterdayAt),
  };
}

/** Find the most recent same-theme workout strictly before `todayIso`. */
function findPreviousSameThemeSession(
  rows: WorkoutRow[],
  theme: string,
  todayIso: string,
): { date: string; completedMinutes: number; plannedMinutes: number } | null {
  if (theme === 'Rest') return null;
  // rows are ordered DESC by workout_date — first match is the most recent.
  for (const r of rows) {
    if (r.theme !== theme) continue;
    const d = rowDateIso(r);
    if (d >= todayIso) continue;
    return {
      date: d,
      completedMinutes: r.completed_minutes,
      plannedMinutes: r.planned_minutes,
    };
  }
  return null;
}

function profileToJson(row: ProfileRow): Record<string, unknown> {
  return {
    username: row.username,
    email: row.email,
    fullName: row.full_name,
    displayName: row.display_name,
    goal: row.goal,
    fitnessLevel: row.fitness_level,
    weeklyMinutes: row.weekly_minutes,
    timezone: row.timezone,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

app.get('/', (_req, res) => servePublicFile('index.html', res));
app.get('/favicon.svg', (_req, res) => servePublicFile('favicon.svg', res));
// Browsers will sometimes request /favicon.ico regardless of <link>; reply
// with a 204 to silence the noise rather than 404 every time.
app.get('/favicon.ico', (_req, res) => res.status(204).end());
app.get('/manifest.webmanifest', (_req, res) => {
  // The MIME map in servePublicFile doesn't know about .webmanifest; set explicitly.
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  servePublicFile('manifest.webmanifest', res);
});

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
