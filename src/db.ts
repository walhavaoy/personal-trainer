import fs from 'fs';
import path from 'path';
import { Workout, Meal } from './models';
import { logger } from './logger';

let workouts: Workout[] = [];
let meals: Meal[] = [];
let dbPath: string | null = null;
let mealsDbPath: string | null = null;

export function initDb(filePath?: string): void {
  if (filePath === ':memory:') {
    dbPath = null;
    mealsDbPath = null;
    workouts = [];
    meals = [];
    logger.info('Database initialized (in-memory)');
    return;
  }

  dbPath = filePath ?? path.join(process.cwd(), 'data', 'workouts.json');
  mealsDbPath = path.join(path.dirname(dbPath), 'meals.json');

  if (fs.existsSync(dbPath)) {
    try {
      const raw = fs.readFileSync(dbPath, 'utf-8');
      workouts = JSON.parse(raw) as Workout[];
    } catch (err) {
      logger.error({ err }, 'Failed to read workouts database file, starting fresh');
      workouts = [];
    }
  } else {
    workouts = [];
  }

  if (fs.existsSync(mealsDbPath)) {
    try {
      const raw = fs.readFileSync(mealsDbPath, 'utf-8');
      meals = JSON.parse(raw) as Meal[];
    } catch (err) {
      logger.error({ err }, 'Failed to read meals database file, starting fresh');
      meals = [];
    }
  } else {
    meals = [];
  }

  logger.info({ dbPath, mealsDbPath }, 'Database initialized');
}

function persistWorkouts(): void {
  if (dbPath === null) return;
  try {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dbPath, JSON.stringify(workouts, null, 2), 'utf-8');
  } catch (err) {
    logger.error({ err }, 'Failed to persist workouts database');
  }
}

function persistMeals(): void {
  if (mealsDbPath === null) return;
  try {
    const dir = path.dirname(mealsDbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(mealsDbPath, JSON.stringify(meals, null, 2), 'utf-8');
  } catch (err) {
    logger.error({ err }, 'Failed to persist meals database');
  }
}

export function insertWorkout(workout: Workout): void {
  workouts.push(workout);
  persistWorkouts();
}

export function getAllWorkouts(): Workout[] {
  return [...workouts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function insertMeal(meal: Meal): void {
  meals.push(meal);
  persistMeals();
}

export function getAllMeals(): Meal[] {
  return [...meals].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getMealById(id: string): Meal | undefined {
  return meals.find((m) => m.id === id);
}

export function updateMeal(id: string, updates: Partial<Omit<Meal, 'id' | 'createdAt'>>): Meal | undefined {
  const index = meals.findIndex((m) => m.id === id);
  if (index === -1) return undefined;
  meals[index] = { ...meals[index], ...updates };
  persistMeals();
  return { ...meals[index] };
}

export function deleteMeal(id: string): boolean {
  const index = meals.findIndex((m) => m.id === id);
  if (index === -1) return false;
  meals.splice(index, 1);
  persistMeals();
  return true;
}

export function closeDb(): void {
  persistWorkouts();
  persistMeals();
  workouts = [];
  meals = [];
  dbPath = null;
  mealsDbPath = null;
}
