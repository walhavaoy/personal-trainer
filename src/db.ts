import pg from 'pg';
import pino from 'pino';

const logger = pino({ name: 'pt-db' });

const DATABASE_URL =
  process.env['DATABASE_URL'] ??
  'postgresql://tmpclaw:tmpclaw@postgres.tmpclaw.svc.cluster.local:5432/pt';

export const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 5 });

pool.on('error', (err) => {
  logger.error({ err }, 'Idle pg client error');
});

const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS pt_user (
      username        TEXT PRIMARY KEY,
      email           TEXT,
      full_name       TEXT,
      goal            TEXT NOT NULL DEFAULT 'general_fitness',
      fitness_level   TEXT NOT NULL DEFAULT 'beginner',
      weekly_minutes  INTEGER NOT NULL DEFAULT 150,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS pt_workout (
      id                BIGSERIAL PRIMARY KEY,
      username          TEXT NOT NULL REFERENCES pt_user(username) ON DELETE CASCADE,
      workout_date      DATE NOT NULL,
      theme             TEXT NOT NULL,
      planned_minutes   INTEGER NOT NULL,
      completed_minutes INTEGER NOT NULL,
      notes             TEXT,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS pt_workout_user_date_idx
      ON pt_workout (username, workout_date DESC)`,
  `ALTER TABLE pt_user
       ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC'`,
  `ALTER TABLE pt_workout
       ADD COLUMN IF NOT EXISTS exercises_completed TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`,
  `ALTER TABLE pt_user
       ADD COLUMN IF NOT EXISTS display_name TEXT`,
  // Index for the iter 25 theme filter and iter 18/23 previous-same-theme lookup.
  `CREATE INDEX IF NOT EXISTS pt_workout_theme_idx
       ON pt_workout (username, theme, workout_date DESC)`,
  // Optional distance in km for cardio sessions (run/walk/bike etc.).
  `ALTER TABLE pt_workout
       ADD COLUMN IF NOT EXISTS distance_km NUMERIC(6,2)`,
  // Modern rework: explicit activity kind + planned/completed status.
  // kind ∈ {walk, run, cycle, gym, rest, cardio, mobility, other}.
  // status ∈ {planned, completed} — a planned future row has completed_minutes=0.
  `ALTER TABLE pt_workout
       ADD COLUMN IF NOT EXISTS kind TEXT`,
  `ALTER TABLE pt_workout
       ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed'`,
  `ALTER TABLE pt_workout
       ADD COLUMN IF NOT EXISTS planned_distance_km NUMERIC(6,2)`,
  // Backfill kind on existing rows from theme — best-effort bucketing so the
  // history page can group walks/runs/cycles into the new Cardio tab.
  `UPDATE pt_workout SET kind = CASE
        WHEN theme = 'Rest' THEN 'rest'
        WHEN theme IN ('Walk', 'Long walk') THEN 'walk'
        WHEN theme IN ('Tempo run', 'Long run', 'Easy', 'Intervals', 'Run') THEN 'run'
        WHEN theme IN ('Cycle', 'Cycling', 'Bike') THEN 'cycle'
        WHEN theme IN ('Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Strength', 'Full body', 'Gym') THEN 'gym'
        WHEN theme IN ('Hips', 'Spine', 'Shoulders', 'Mobility') THEN 'mobility'
        WHEN theme IN ('Cardio', 'HIIT', 'Cross') THEN 'cardio'
        ELSE 'other'
      END
    WHERE kind IS NULL`,
  // Gym sessions: sets/reps/weight tracking. Keyed to pt_workout when a row
  // already exists for the date (so summary/streak still sees gym time), or
  // standalone (workout_id NULL) if the user wants to log a gym session that
  // isn't currently tied to the auto-derived day.
  `CREATE TABLE IF NOT EXISTS pt_gym_workout (
      id          BIGSERIAL PRIMARY KEY,
      username    TEXT NOT NULL REFERENCES pt_user(username) ON DELETE CASCADE,
      workout_id  BIGINT REFERENCES pt_workout(id) ON DELETE SET NULL,
      session_date DATE NOT NULL,
      name        TEXT NOT NULL DEFAULT 'Gym session',
      notes       TEXT,
      status      TEXT NOT NULL DEFAULT 'completed',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS pt_gym_workout_user_date_idx
       ON pt_gym_workout (username, session_date DESC)`,
  `CREATE TABLE IF NOT EXISTS pt_gym_set (
      id              BIGSERIAL PRIMARY KEY,
      gym_workout_id  BIGINT NOT NULL REFERENCES pt_gym_workout(id) ON DELETE CASCADE,
      exercise_name   TEXT NOT NULL,
      exercise_order  INTEGER NOT NULL DEFAULT 0,
      set_order       INTEGER NOT NULL DEFAULT 0,
      reps            INTEGER NOT NULL DEFAULT 0,
      weight_kg       NUMERIC(6,2),
      notes           TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS pt_gym_set_workout_idx
       ON pt_gym_set (gym_workout_id, exercise_order, set_order)`,
  // i18n: user's preferred UI locale. Falls back to browser default if NULL,
  // which we treat as "unset" so we can auto-detect on first login.
  `ALTER TABLE pt_user
       ADD COLUMN IF NOT EXISTS locale TEXT`,
];

export async function migrate(): Promise<void> {
  for (const sql of MIGRATIONS) {
    await pool.query(sql);
  }
  logger.info({ migrations: MIGRATIONS.length }, 'Migrations applied');
}

export interface ProfileRow {
  username: string;
  email: string | null;
  full_name: string | null;
  display_name: string | null;
  goal: string;
  fitness_level: string;
  weekly_minutes: number;
  timezone: string;
  locale: string | null;
  created_at: Date;
  updated_at: Date;
}

// Locales the backend recognizes; frontend i18n catalog must cover all of these.
// Extending here is necessary but not sufficient — also update public/js/i18n.js.
export const VALID_LOCALES = new Set(['en', 'fi']);

/**
 * IANA timezone validation — Node's Intl throws RangeError for unknown zones.
 * We accept what Node accepts; anything else is rejected as 400 by the API.
 */
export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export interface WorkoutRow {
  id: string;
  username: string;
  workout_date: Date | string;
  theme: string;
  planned_minutes: number;
  completed_minutes: number;
  notes: string | null;
  exercises_completed: string[];
  distance_km: string | number | null;
  planned_distance_km: string | number | null;
  kind: string | null;
  status: string;
  created_at: Date;
}

export interface GymWorkoutRow {
  id: string;
  username: string;
  workout_id: string | null;
  session_date: Date | string;
  name: string;
  notes: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface GymSetRow {
  id: string;
  gym_workout_id: string;
  exercise_name: string;
  exercise_order: number;
  set_order: number;
  reps: number;
  weight_kg: string | number | null;
  notes: string | null;
}

export const VALID_KINDS = new Set([
  'walk', 'run', 'cycle', 'gym', 'rest', 'cardio', 'mobility', 'other',
]);
export const CARDIO_KINDS = new Set(['walk', 'run', 'cycle']);
export const VALID_STATUSES = new Set(['planned', 'completed']);

export function defaultThemeForKind(kind: string): string {
  switch (kind) {
    case 'walk': return 'Walk';
    case 'run': return 'Run';
    case 'cycle': return 'Cycle';
    case 'gym': return 'Gym';
    case 'rest': return 'Rest';
    case 'cardio': return 'Cardio';
    case 'mobility': return 'Mobility';
    default: return 'Activity';
  }
}

export const VALID_GOALS = new Set([
  'general_fitness',
  'strength',
  'endurance',
  'weight_loss',
  'mobility',
]);

export const VALID_LEVELS = new Set(['beginner', 'intermediate', 'advanced']);
