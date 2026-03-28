import { Router, Request, Response } from 'express';
import pino from 'pino';
import { getDb } from '../db';
import type {
  DashboardResponse,
  DailyCalories,
  TrendDay,
  MacroBreakdown,
  Streak,
} from '../types';

const logger = pino({ name: 'dashboard' });
const router = Router();

interface CalorieSumRow {
  total_calories: number;
}

interface MacroSumRow {
  total_protein: number;
  total_carbs: number;
  total_fat: number;
}

interface TrendRow {
  date: string;
  calories: number;
}

interface SettingRow {
  value: string;
}

interface DateRow {
  logged_at: string;
}

function getDailyCalories(today: string): DailyCalories {
  const db = getDb();

  const goalRow = db.prepare(
    `SELECT value FROM settings WHERE key = 'daily_calorie_goal'`
  ).get() as SettingRow | undefined;
  const goal = goalRow ? parseInt(goalRow.value, 10) : 2000;

  const row = db.prepare(
    `SELECT COALESCE(SUM(calories), 0) AS total_calories
     FROM food_logs WHERE logged_at = ?`
  ).get(today) as CalorieSumRow;

  const total = Math.round(row.total_calories);
  return {
    total,
    goal,
    remaining: Math.max(0, goal - total),
  };
}

function getWeeklyTrend(today: string): TrendDay[] {
  const db = getDb();

  const rows = db.prepare(
    `WITH RECURSIVE dates(d) AS (
       SELECT date(?, '-6 days')
       UNION ALL
       SELECT date(d, '+1 day') FROM dates WHERE d < ?
     )
     SELECT dates.d AS date,
            COALESCE(SUM(f.calories), 0) AS calories
     FROM dates
     LEFT JOIN food_logs f ON f.logged_at = dates.d
     GROUP BY dates.d
     ORDER BY dates.d`
  ).all(today, today) as TrendRow[];

  return rows.map((r) => ({
    date: r.date,
    calories: Math.round(r.calories),
  }));
}

function getMacroBreakdown(today: string): MacroBreakdown {
  const db = getDb();

  const row = db.prepare(
    `SELECT COALESCE(SUM(protein_g), 0) AS total_protein,
            COALESCE(SUM(carbs_g), 0)   AS total_carbs,
            COALESCE(SUM(fat_g), 0)     AS total_fat
     FROM food_logs WHERE logged_at = ?`
  ).get(today) as MacroSumRow;

  const protein = row.total_protein;
  const carbs = row.total_carbs;
  const fat = row.total_fat;
  const totalGrams = protein + carbs + fat;

  return {
    protein_g: Math.round(protein * 10) / 10,
    carbs_g: Math.round(carbs * 10) / 10,
    fat_g: Math.round(fat * 10) / 10,
    protein_pct: totalGrams > 0 ? Math.round((protein / totalGrams) * 100) : 0,
    carbs_pct: totalGrams > 0 ? Math.round((carbs / totalGrams) * 100) : 0,
    fat_pct: totalGrams > 0 ? Math.round((fat / totalGrams) * 100) : 0,
  };
}

function getStreak(today: string): Streak {
  const db = getDb();

  const rows = db.prepare(
    `SELECT DISTINCT logged_at FROM food_logs ORDER BY logged_at DESC`
  ).all() as DateRow[];

  if (rows.length === 0) {
    return { current: 0, longest: 0 };
  }

  // Build a Set of logged dates for O(1) lookup
  const loggedDates = new Set(rows.map((r) => r.logged_at));

  // Calculate current streak (consecutive days ending today or yesterday)
  let current = 0;
  let checkDate = today;

  // If today has no logs, start from yesterday
  if (!loggedDates.has(checkDate)) {
    checkDate = shiftDate(checkDate, -1);
  }

  while (loggedDates.has(checkDate)) {
    current++;
    checkDate = shiftDate(checkDate, -1);
  }

  // Calculate longest streak
  const sortedDates = Array.from(loggedDates).sort();
  let longest = 0;
  let run = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = sortedDates[i - 1] as string;
    const curr = sortedDates[i] as string;
    if (shiftDate(prev, 1) === curr) {
      run++;
    } else {
      longest = Math.max(longest, run);
      run = 1;
    }
  }
  longest = Math.max(longest, run);

  return { current, longest };
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

router.get('/dashboard', (_req: Request, res: Response) => {
  try {
    const today = todayUTC();

    const response: DashboardResponse = {
      daily_calories: getDailyCalories(today),
      weekly_trend: getWeeklyTrend(today),
      macro_breakdown: getMacroBreakdown(today),
      streak: getStreak(today),
    };

    res.json(response);
  } catch (err: unknown) {
    logger.error({ err }, 'failed to build dashboard response');
    res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
