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
  goal: string;
  fitness_level: string;
  weekly_minutes: number;
  created_at: Date;
  updated_at: Date;
}

export const VALID_GOALS = new Set([
  'general_fitness',
  'strength',
  'endurance',
  'weight_loss',
  'mobility',
]);

export const VALID_LEVELS = new Set(['beginner', 'intermediate', 'advanced']);
