import type { ProfileRow } from './db.js';

export interface SessionBlock {
  name: string;
  durationMinutes: number;
  notes: string;
}

export interface TodaySession {
  date: string;
  dayOfWeek: string;
  theme: string;
  totalMinutes: number;
  blocks: SessionBlock[];
  trainerNote: string;
  adaptation: 'recovery' | 'baseline' | 'progression';
}

export interface RecentContext {
  /** completed/planned ratio for yesterday's logged workout, or null if no workout yesterday */
  yesterdayComplianceRatio: number | null;
  /** current consecutive-day streak (including today if logged) */
  streakDays: number;
  /** true if yesterday was a planned rest day (so missing it isn't a miss) */
  yesterdayWasRest: boolean;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const THEMES: Record<string, string[]> = {
  general_fitness: ['Rest', 'Full body', 'Cardio', 'Mobility', 'Full body', 'Cardio', 'Long walk'],
  strength:        ['Rest', 'Push',      'Pull',   'Legs',     'Rest',      'Upper',  'Lower'],
  endurance:       ['Rest', 'Tempo run', 'Easy',   'Intervals','Easy',      'Cross',  'Long run'],
  weight_loss:     ['Rest', 'HIIT',      'Walk',   'Strength', 'Walk',      'HIIT',   'Long walk'],
  mobility:        ['Rest', 'Hips',      'Spine',  'Shoulders','Hips',      'Spine',  'Full body'],
};

const LEVEL_FACTOR: Record<string, number> = {
  beginner: 0.8,
  intermediate: 1.0,
  advanced: 1.2,
};

interface Adaptation {
  factor: number;
  note: string;
  kind: 'recovery' | 'baseline' | 'progression';
}

function pickAdaptation(ctx: RecentContext, theme: string): Adaptation {
  if (theme === 'Rest') {
    return { factor: 1, kind: 'baseline', note: 'Rest day — protect tomorrow by actually resting today.' };
  }

  if (ctx.yesterdayComplianceRatio === null && !ctx.yesterdayWasRest) {
    if (ctx.streakDays === 0) {
      return { factor: 0.9, kind: 'recovery', note: "First session back — keep it doable so you stack a second tomorrow." };
    }
    // Streak alive but no workout yesterday (anchored on today) — just keep going.
    return { factor: 1, kind: 'baseline', note: `Streak of ${ctx.streakDays} day(s). Ride it.` };
  }

  if (ctx.yesterdayComplianceRatio !== null && ctx.yesterdayComplianceRatio < 0.5) {
    return { factor: 0.8, kind: 'recovery', note: "Yesterday came up short — easing today so you finish it." };
  }

  if (ctx.yesterdayComplianceRatio !== null && ctx.yesterdayComplianceRatio >= 1.0 && ctx.streakDays >= 3) {
    return { factor: 1.1, kind: 'progression', note: `Streak of ${ctx.streakDays} and you closed yesterday — small bump today.` };
  }

  if (ctx.streakDays >= 5) {
    return { factor: 1, kind: 'baseline', note: `Five-plus day streak — keep the form clean.` };
  }

  return { factor: 1, kind: 'baseline', note: 'Steady session. Show up, finish strong.' };
}

export function deriveSession(
  profile: ProfileRow,
  now: Date = new Date(),
  ctx: RecentContext = { yesterdayComplianceRatio: null, streakDays: 0, yesterdayWasRest: false },
): TodaySession {
  const dow = now.getDay();
  const themes = THEMES[profile.goal] ?? THEMES['general_fitness']!;
  const theme = themes[dow] ?? 'Active recovery';
  const factor = LEVEL_FACTOR[profile.fitness_level] ?? 1.0;
  const adaptation = pickAdaptation(ctx, theme);

  const targetPerDay = Math.max(15, Math.round(profile.weekly_minutes / 6));
  const baseMinutes = theme === 'Rest' ? 0 : Math.round(targetPerDay * factor);
  const planned = Math.round(baseMinutes * adaptation.factor);

  const blocks: SessionBlock[] = [];
  if (planned === 0) {
    blocks.push({ name: 'Rest day', durationMinutes: 0, notes: 'Hydrate, sleep, light walking only.' });
  } else {
    const warmup = Math.max(5, Math.round(planned * 0.15));
    const main = Math.max(10, planned - warmup - 5);
    const cooldown = 5;
    blocks.push({ name: 'Warm-up', durationMinutes: warmup, notes: 'Easy cardio + dynamic stretches.' });
    blocks.push({ name: theme, durationMinutes: main, notes: 'Main work — focus on form and breathing.' });
    blocks.push({ name: 'Cool-down', durationMinutes: cooldown, notes: 'Slow walk + static stretches.' });
  }

  return {
    date: now.toISOString().slice(0, 10),
    dayOfWeek: DAYS[dow] ?? 'Today',
    theme,
    totalMinutes: blocks.reduce((s, b) => s + b.durationMinutes, 0),
    blocks,
    trainerNote: adaptation.note,
    adaptation: adaptation.kind,
  };
}

/** Was the planned theme for that day a rest day for this profile? */
export function wasRestDay(profile: ProfileRow, date: Date): boolean {
  const themes = THEMES[profile.goal] ?? THEMES['general_fitness']!;
  return (themes[date.getUTCDay()] ?? '') === 'Rest';
}
