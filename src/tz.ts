/**
 * Timezone-aware date helpers. The DB stores workout_date as a DATE column,
 * and "today's session" depends on what calendar day it is *for the user* —
 * so all date strings are formatted in the user's IANA timezone, not UTC.
 */

/**
 * Format an Instant as a YYYY-MM-DD calendar date string in `tz`.
 * Falls back to UTC if tz is invalid (caller should validate first).
 */
export function calendarDate(at: Date, tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(at);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    /* fall through */
  }
  return at.toISOString().slice(0, 10);
}

/** Day-of-week in `tz`: 0=Sun..6=Sat. */
export function calendarDayOfWeek(at: Date, tz: string): number {
  try {
    const wd = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(at);
    const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return map[wd.slice(0, 3)] ?? at.getUTCDay();
  } catch {
    return at.getUTCDay();
  }
}

/**
 * Return ISO date strings for today and yesterday in `tz`. Used everywhere we
 * previously did `new Date(today.getUTCDate() - 1)`.
 */
export function todayAndYesterday(at: Date, tz: string): { today: string; yesterday: string } {
  const today = calendarDate(at, tz);
  // Subtract 24 hours then re-format. DST boundaries: a 23h or 25h previous
  // day still maps to "yesterday's calendar date" because we re-format under
  // the same tz; the only edge is the brief window where local time has rolled
  // back and "yesterday" is ambiguous — for fitness UX that's acceptable.
  const yest = new Date(at.getTime() - 24 * 3600 * 1000);
  return { today, yesterday: calendarDate(yest, tz) };
}

/** Monday of the week containing `at` in `tz`, returned as ISO date string. */
export function startOfWeekDate(at: Date, tz: string): string {
  const dow = calendarDayOfWeek(at, tz); // 0..6, Sun=0
  const offset = (dow + 6) % 7; // days since Monday
  const monday = new Date(at.getTime() - offset * 24 * 3600 * 1000);
  return calendarDate(monday, tz);
}
