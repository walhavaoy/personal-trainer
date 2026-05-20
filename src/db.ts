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
  created_at: Date;
  updated_at: Date;
}

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
  created_at: Date;
}

export const VALID_GOALS = new Set([
  'general_fitness',
  'strength',
  'endurance',
  'weight_loss',
  'mobility',
]);

export const VALID_LEVELS = new Set(['beginner', 'intermediate', 'advanced']);
