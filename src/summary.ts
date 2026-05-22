import type { ProfileRow, WorkoutRow } from './db.js';
import { startOfWeekDate, todayAndYesterday } from './tz.js';

export interface WeekTrendEntry {
  weekStart: string;
  totalMinutes: number;
  sessions: number;
  percentOfTarget: number;
}

export type Trend = 'up' | 'down' | 'flat' | 'new';

export interface WeekSummary {
  weekStart: string;        // ISO date (Monday)
  weeklyTargetMinutes: number;
  thisWeekMinutes: number;
  thisWeekSessions: number;
  thisWeekDistanceKm: number;     // sum of distance_km across this week's workouts (0 when none)
  percentOfTarget: number;
  streakDays: number;
  lastWorkoutDate: string | null;
  // Week-over-week comparison vs the seven days that ended the day before weekStart.
  lastWeekMinutes: number;
  lastWeekSessions: number;
  lastWeekDistanceKm: number;
  weekOverWeekDeltaMinutes: number;   // thisWeek - lastWeek (signed)
  weekOverWeekTrend: Trend;
  // i18n: a string key the frontend resolves against its locale catalog, plus
  // the numeric/text params that fill its {placeholders}. weekCoachMessage is
  // the English rendering of the same key+params and is kept so clients
  // without an i18n catalog (or unknown locale) still get readable text.
  weekCoachKey: string;
  weekCoachParams: Record<string, number | string>;
  weekCoachMessage: string;
  // Highest weekly total in the 60 days of history we pull, excluding the
  // current (in-progress) week. UI uses this to show a "Best week so far"
  // milestone when thisWeekMinutes exceeds it.
  bestPriorWeekMinutes: number;
  bestPriorWeekDistanceKm: number;
}

/**
 * Last N weeks of activity, oldest → newest.
 * Each entry's weekStart is the Monday ISO date in the user's tz.
 * The current (in-progress) week is included as the last entry.
 */
export function computeTrend(
  profile: ProfileRow,
  workouts: WorkoutRow[],
  now: Date = new Date(),
  weeks = 8,
): WeekTrendEntry[] {
  const tz = profile.timezone || 'UTC';
  const target = Math.max(1, profile.weekly_minutes);

  // Build week boundaries: start with this week's Monday, then walk back.
  const boundaries: string[] = [];
  let cursor = startOfWeekDate(now, tz);
  for (let i = 0; i < weeks; i++) {
    boundaries.unshift(cursor);
    // step back 7 days from cursor (string math)
    const d = new Date(cursor + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - 7);
    cursor = d.toISOString().slice(0, 10);
  }

  // Bucket workouts. For weeks[i] the half-open range is [boundaries[i], boundaries[i+1])
  // — for the final (current) week we use Infinity-ish: anything ≥ that Monday.
  const dateOf = (r: WorkoutRow): string =>
    r.workout_date instanceof Date
      ? r.workout_date.toISOString().slice(0, 10)
      : String(r.workout_date).slice(0, 10);

  const result: WeekTrendEntry[] = [];
  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i]!;
    const end = boundaries[i + 1] ?? null;
    const rows = workouts.filter((r) => {
      const d = dateOf(r);
      if (d < start) return false;
      if (end !== null && d >= end) return false;
      return true;
    });
    const totalMinutes = rows.reduce((s, r) => s + (r.completed_minutes ?? 0), 0);
    result.push({
      weekStart: start,
      totalMinutes,
      sessions: rows.length,
      percentOfTarget: Math.min(999, Math.round((totalMinutes / target) * 100)),
    });
  }
  return result;
}

function rowDate(row: WorkoutRow): string {
  return row.workout_date instanceof Date
    ? // pg's Date for DATE columns is at UTC midnight; slice the ISO is correct
      row.workout_date.toISOString().slice(0, 10)
    : String(row.workout_date).slice(0, 10);
}

function previousIsoDate(iso: string): string {
  // pure string arithmetic on YYYY-MM-DD via Date constructor (UTC) to avoid TZ creep
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function computeStreak(sorted: WorkoutRow[], now: Date, tz: string): number {
  if (sorted.length === 0) return 0;
  const { today, yesterday } = todayAndYesterday(now, tz);

  const dates = new Set<string>();
  for (const r of sorted) dates.add(rowDate(r));

  let cursorIso: string | null = null;
  if (dates.has(today)) cursorIso = today;
  else if (dates.has(yesterday)) cursorIso = yesterday;
  else return 0;

  let streak = 0;
  while (cursorIso && dates.has(cursorIso)) {
    streak += 1;
    cursorIso = previousIsoDate(cursorIso);
  }
  return streak;
}

interface CoachOutput {
  key: string;
  params: Record<string, number | string>;
  message: string;
}

/**
 * Returns the i18n key + params + English-rendered string for the weekly
 * coach line. The frontend resolves `key` against its locale catalog and
 * formats with `params`; `message` is what to show when no catalog is
 * available (legacy/unknown locale).
 *
 * Why we return all three: introducing keys without a string fallback
 * would break any client that doesn't yet know about i18n.js.
 */
function pickWeekCoachMessage(
  thisWeek: number,
  lastWeek: number,
  _target: number,
  trend: Trend,
): CoachOutput {
  if (trend === 'new') {
    if (thisWeek === 0) {
      return {
        key: 'coach.new.zero',
        params: {},
        message: "Fresh start this week — anything beats zero. Pick the smallest session and finish it.",
      };
    }
    return {
      key: 'coach.new.nonzero',
      params: {},
      message: "First week tracking — let's see what a full seven days looks like.",
    };
  }
  const delta = thisWeek - lastWeek;
  const pct = lastWeek > 0 ? Math.round((thisWeek / lastWeek) * 100) : 0;
  if (trend === 'flat') {
    return {
      key: 'coach.flat',
      params: {},
      message: "Steady — same volume as last week. Stability is its own win.",
    };
  }
  if (trend === 'up') {
    if (lastWeek === 0) {
      return {
        key: 'coach.up.from_zero',
        params: { thisWeek },
        message: `Logged ${thisWeek} min this week vs nothing last week. That's the hard step.`,
      };
    }
    return {
      key: 'coach.up',
      params: { delta, pct },
      message: `+${delta} min vs last week (${pct}%). Keep stacking it.`,
    };
  }
  // down
  if (thisWeek === 0) {
    return {
      key: 'coach.down.zero',
      params: { lastWeek },
      message: `No minutes yet this week (${lastWeek} last week). Pick the smallest session and start.`,
    };
  }
  return {
    key: 'coach.down',
    params: { pct, delta },
    message: `${pct}% of last week (${delta} min). Don't let the slip become a habit.`,
  };
}

export function computeSummary(
  profile: ProfileRow,
  workouts: WorkoutRow[],
  now: Date = new Date(),
): WeekSummary {
  const tz = profile.timezone || 'UTC';
  const weekStartIso = startOfWeekDate(now, tz);
  // Previous week boundary = 7 days before this Monday.
  let prevWeekStartIso = weekStartIso;
  for (let i = 0; i < 7; i++) prevWeekStartIso = previousIsoDate(prevWeekStartIso);

  const inThisWeek = workouts.filter((w) => rowDate(w) >= weekStartIso);
  const inLastWeek = workouts.filter((w) => {
    const d = rowDate(w);
    return d >= prevWeekStartIso && d < weekStartIso;
  });

  const sumMinutes = (rows: WorkoutRow[]): number =>
    rows.reduce((s, w) => s + (w.completed_minutes ?? 0), 0);
  // pg returns NUMERIC as string; coerce on the fly.
  const sumDistance = (rows: WorkoutRow[]): number => {
    let sum = 0;
    for (const w of rows) {
      const v = w.distance_km;
      if (v == null) continue;
      const n = typeof v === 'number' ? v : parseFloat(v);
      if (Number.isFinite(n)) sum += n;
    }
    return Math.round(sum * 100) / 100;
  };

  const thisWeekMinutes = sumMinutes(inThisWeek);
  const lastWeekMinutes = sumMinutes(inLastWeek);
  const thisWeekDistanceKm = sumDistance(inThisWeek);
  const lastWeekDistanceKm = sumDistance(inLastWeek);
  const thisWeekSessions = inThisWeek.length;
  const lastWeekSessions = inLastWeek.length;

  const target = Math.max(1, profile.weekly_minutes);
  const percent = Math.min(999, Math.round((thisWeekMinutes / target) * 100));

  const sortedDesc = [...workouts].sort((a, b) => rowDate(b).localeCompare(rowDate(a)));
  const streak = computeStreak(sortedDesc, now, tz);
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

  const coach = pickWeekCoachMessage(thisWeekMinutes, lastWeekMinutes, target, trend);

  // Best prior week: bucket all workouts (excluding this in-progress week) by
  // their Monday, sum minutes/distance, take the max for each.
  const priorMinutesByMonday: Map<string, number> = new Map();
  const priorDistanceByMonday: Map<string, number> = new Map();
  for (const w of workouts) {
    const d = rowDate(w);
    if (d >= weekStartIso) continue; // skip this week
    const dt = new Date(d + 'T00:00:00Z');
    const dow = dt.getUTCDay();
    const offset = (dow + 6) % 7;
    dt.setUTCDate(dt.getUTCDate() - offset);
    const monday = dt.toISOString().slice(0, 10);
    priorMinutesByMonday.set(monday, (priorMinutesByMonday.get(monday) ?? 0) + (w.completed_minutes ?? 0));
    if (w.distance_km != null) {
      const n = typeof w.distance_km === 'number' ? w.distance_km : parseFloat(String(w.distance_km));
      if (Number.isFinite(n)) {
        priorDistanceByMonday.set(monday, (priorDistanceByMonday.get(monday) ?? 0) + n);
      }
    }
  }
  const bestPriorWeekMinutes = priorMinutesByMonday.size > 0
    ? Math.max(...priorMinutesByMonday.values())
    : 0;
  const bestPriorWeekDistanceKm = priorDistanceByMonday.size > 0
    ? Math.round(Math.max(...priorDistanceByMonday.values()) * 100) / 100
    : 0;

  return {
    weekStart: weekStartIso,
    weeklyTargetMinutes: profile.weekly_minutes,
    thisWeekMinutes,
    thisWeekSessions,
    thisWeekDistanceKm,
    percentOfTarget: percent,
    streakDays: streak,
    lastWorkoutDate: last ? rowDate(last) : null,
    lastWeekMinutes,
    lastWeekSessions,
    lastWeekDistanceKm,
    weekOverWeekDeltaMinutes: thisWeekMinutes - lastWeekMinutes,
    weekOverWeekTrend: trend,
    weekCoachKey: coach.key,
    weekCoachParams: coach.params,
    weekCoachMessage: coach.message,
    bestPriorWeekMinutes,
    bestPriorWeekDistanceKm,
  };
}
