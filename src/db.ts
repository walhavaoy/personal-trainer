import fs from 'fs';
import path from 'path';
import { Workout } from './models';
import { logger } from './logger';

let workouts: Workout[] = [];
let dbPath: string | null = null;

export function initDb(filePath?: string): void {
  if (filePath === ':memory:') {
    dbPath = null;
    workouts = [];
    logger.info('Database initialized (in-memory)');
    return;
  }

  dbPath = filePath ?? path.join(process.cwd(), 'data', 'workouts.json');

  if (fs.existsSync(dbPath)) {
    try {
      const raw = fs.readFileSync(dbPath, 'utf-8');
      workouts = JSON.parse(raw) as Workout[];
    } catch (err) {
      logger.error({ err }, 'Failed to read database file, starting fresh');
      workouts = [];
    }
  } else {
    workouts = [];
  }

  logger.info({ dbPath }, 'Database initialized');
}

function persist(): void {
  if (dbPath === null) return;
  try {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dbPath, JSON.stringify(workouts, null, 2), 'utf-8');
  } catch (err) {
    logger.error({ err }, 'Failed to persist database');
  }
}

export function insertWorkout(workout: Workout): void {
  workouts.push(workout);
  persist();
}

export function getAllWorkouts(): Workout[] {
  return [...workouts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function closeDb(): void {
  persist();
  workouts = [];
  dbPath = null;
}
