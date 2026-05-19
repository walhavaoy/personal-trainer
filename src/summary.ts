import type { ProfileRow, WorkoutRow } from './db.js';

export interface WeekSummary {
  weekStart: string;        // ISO date (Monday)
  weeklyTargetMinutes: number;
  thisWeekMinutes: number;
  thisWeekSessions: number;
  percentOfTarget: number;
  streakDays: number;
  lastWorkoutDate: string | null;
}

/** Monday of the week containing `now`, in local clock terms (00:00 UTC anchor). */
function startOfWeek(now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = d.getUTCDay(); // 0=Sun..6=Sat
  const offset = (dow + 6) % 7; // days since Monday
  d.setUTCDate(d.getUTCDate() - offset);
  return d;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rowDate(row: WorkoutRow): string {
  return row.workout_date instanceof Date
    ? toISODate(row.workout_date)
    : String(row.workout_date).slice(0, 10);
}

/**
 * Compute a current streak in *days with at least one logged workout*,
 * ending today (or yesterday if today has no workout yet — that lets you
 * keep yesterday's streak alive during the day before you train).
 */
function computeStreak(sorted: WorkoutRow[], today: Date): number {
  if (sorted.length === 0) return 0;
  const todayIso = toISODate(today);
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayIso = toISODate(yesterday);

  const dates = new Set<string>();
  for (const r of sorted) dates.add(rowDate(r));

  let cursor: Date;
  if (dates.has(todayIso)) cursor = new Date(today);
  else if (dates.has(yesterdayIso)) cursor = new Date(yesterday);
  else return 0;

  let streak = 0;
  while (dates.has(toISODate(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export function computeSummary(
  profile: ProfileRow,
  workouts: WorkoutRow[],
  now: Date = new Date(),
): WeekSummary {
  const weekStart = startOfWeek(now);
  const weekStartIso = toISODate(weekStart);

  const inWeek = workouts.filter((w) => rowDate(w) >= weekStartIso);
  const thisWeekMinutes = inWeek.reduce((s, w) => s + (w.completed_minutes ?? 0), 0);
  const thisWeekSessions = inWeek.length;

  const target = Math.max(1, profile.weekly_minutes);
  const percent = Math.min(999, Math.round((thisWeekMinutes / target) * 100));

  const sortedDesc = [...workouts].sort((a, b) => rowDate(b).localeCompare(rowDate(a)));
  const streak = computeStreak(sortedDesc, now);
  const last = sortedDesc[0];

  return {
    weekStart: weekStartIso,
    weeklyTargetMinutes: profile.weekly_minutes,
    thisWeekMinutes,
    thisWeekSessions,
    percentOfTarget: percent,
    streakDays: streak,
    lastWorkoutDate: last ? rowDate(last) : null,
  };
}
