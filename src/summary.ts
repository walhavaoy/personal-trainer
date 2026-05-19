import type { ProfileRow, WorkoutRow } from './db.js';

export type Trend = 'up' | 'down' | 'flat' | 'new';

export interface WeekSummary {
  weekStart: string;        // ISO date (Monday)
  weeklyTargetMinutes: number;
  thisWeekMinutes: number;
  thisWeekSessions: number;
  percentOfTarget: number;
  streakDays: number;
  lastWorkoutDate: string | null;
  // Week-over-week comparison vs the seven days that ended the day before weekStart.
  lastWeekMinutes: number;
  lastWeekSessions: number;
  weekOverWeekDeltaMinutes: number;   // thisWeek - lastWeek (signed)
  weekOverWeekTrend: Trend;
  weekCoachMessage: string;
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

function pickWeekCoachMessage(
  thisWeek: number,
  lastWeek: number,
  target: number,
  trend: Trend,
): string {
  if (trend === 'new') {
    return target > 0 && thisWeek === 0
      ? "Fresh start this week — anything beats zero. Pick the smallest session and finish it."
      : "First week tracking — let's see what a full seven days looks like.";
  }
  const delta = thisWeek - lastWeek;
  const pct = lastWeek > 0 ? Math.round((thisWeek / lastWeek) * 100) : 0;
  if (trend === 'flat') {
    return "Steady — same volume as last week. Stability is its own win.";
  }
  if (trend === 'up') {
    if (lastWeek === 0) return `Logged ${thisWeek} min this week vs nothing last week. That's the hard step.`;
    return `+${delta} min vs last week (${pct}%). Keep stacking it.`;
  }
  // down
  if (thisWeek === 0) return `No minutes yet this week (${lastWeek} last week). Pick the smallest session and start.`;
  return `${pct}% of last week (${delta} min). Don't let the slip become a habit.`;
}

export function computeSummary(
  profile: ProfileRow,
  workouts: WorkoutRow[],
  now: Date = new Date(),
): WeekSummary {
  const weekStart = startOfWeek(now);
  const weekStartIso = toISODate(weekStart);

  // Previous week boundaries (Monday..Sunday of the prior week).
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setUTCDate(prevWeekStart.getUTCDate() - 7);
  const prevWeekStartIso = toISODate(prevWeekStart);

  const inThisWeek = workouts.filter((w) => rowDate(w) >= weekStartIso);
  const inLastWeek = workouts.filter((w) => {
    const d = rowDate(w);
    return d >= prevWeekStartIso && d < weekStartIso;
  });

  const sumMinutes = (rows: WorkoutRow[]): number =>
    rows.reduce((s, w) => s + (w.completed_minutes ?? 0), 0);

  const thisWeekMinutes = sumMinutes(inThisWeek);
  const lastWeekMinutes = sumMinutes(inLastWeek);
  const thisWeekSessions = inThisWeek.length;
  const lastWeekSessions = inLastWeek.length;

  const target = Math.max(1, profile.weekly_minutes);
  const percent = Math.min(999, Math.round((thisWeekMinutes / target) * 100));

  const sortedDesc = [...workouts].sort((a, b) => rowDate(b).localeCompare(rowDate(a)));
  const streak = computeStreak(sortedDesc, now);
  const last = sortedDesc[0];

  let trend: Trend;
  if (inLastWeek.length === 0 && inThisWeek.length === 0) {
    trend = 'new';
  } else if (inLastWeek.length === 0 && inThisWeek.length > 0) {
    trend = 'up';
  } else {
    const delta = thisWeekMinutes - lastWeekMinutes;
    // Treat ±10% (or ±5 min, whichever larger) as flat — avoids noisy trends.
    const tolerance = Math.max(5, Math.round(lastWeekMinutes * 0.1));
    if (Math.abs(delta) <= tolerance) trend = 'flat';
    else trend = delta > 0 ? 'up' : 'down';
  }

  return {
    weekStart: weekStartIso,
    weeklyTargetMinutes: profile.weekly_minutes,
    thisWeekMinutes,
    thisWeekSessions,
    percentOfTarget: percent,
    streakDays: streak,
    lastWorkoutDate: last ? rowDate(last) : null,
    lastWeekMinutes,
    lastWeekSessions,
    weekOverWeekDeltaMinutes: thisWeekMinutes - lastWeekMinutes,
    weekOverWeekTrend: trend,
    weekCoachMessage: pickWeekCoachMessage(thisWeekMinutes, lastWeekMinutes, target, trend),
  };
}
