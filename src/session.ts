import type { ProfileRow } from './db.js';
import { prescriptionsFor, type ExercisePrescription } from './exercises.js';
import { calendarDate, calendarDayOfWeek } from './tz.js';

export interface SessionBlock {
  name: string;
  durationMinutes: number;
  notes: string;
  exercises?: ExercisePrescription[];
}

export interface TodaySession {
  date: string;
  dayOfWeek: string;
  theme: string;
  totalMinutes: number;
  blocks: SessionBlock[];
  // i18n: key + params the frontend resolves against its catalog.
  // trainerNote is the English rendering, retained so legacy clients still
  // display readable text.
  trainerNoteKey: string;
  trainerNoteParams: Record<string, number | string>;
  trainerNote: string;
  adaptation: 'recovery' | 'baseline' | 'progression';
}

export interface RecentContext {
  yesterdayComplianceRatio: number | null;
  streakDays: number;
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
  // i18n key + params; note is the English rendering of the same key.
  key: string;
  params: Record<string, number | string>;
  note: string;
  kind: 'recovery' | 'baseline' | 'progression';
}

function pickAdaptation(ctx: RecentContext, theme: string): Adaptation {
  if (theme === 'Rest') {
    return {
      factor: 1, kind: 'baseline',
      key: 'trainer.rest', params: {},
      note: 'Rest day — protect tomorrow by actually resting today.',
    };
  }
  if (ctx.yesterdayComplianceRatio === null && !ctx.yesterdayWasRest) {
    if (ctx.streakDays === 0) {
      return {
        factor: 0.9, kind: 'recovery',
        key: 'trainer.first_session_back', params: {},
        note: "First session back — keep it doable so you stack a second tomorrow.",
      };
    }
    return {
      factor: 1, kind: 'baseline',
      key: 'trainer.streak.ride', params: { streakDays: ctx.streakDays },
      note: `Streak of ${ctx.streakDays} day(s). Ride it.`,
    };
  }
  if (ctx.yesterdayComplianceRatio !== null && ctx.yesterdayComplianceRatio < 0.5) {
    return {
      factor: 0.8, kind: 'recovery',
      key: 'trainer.yesterday_short', params: {},
      note: "Yesterday came up short — easing today so you finish it.",
    };
  }
  if (ctx.yesterdayComplianceRatio !== null && ctx.yesterdayComplianceRatio >= 1.0 && ctx.streakDays >= 3) {
    return {
      factor: 1.1, kind: 'progression',
      key: 'trainer.progression', params: { streakDays: ctx.streakDays },
      note: `Streak of ${ctx.streakDays} and you closed yesterday — small bump today.`,
    };
  }
  if (ctx.streakDays >= 5) {
    return {
      factor: 1, kind: 'baseline',
      key: 'trainer.streak.five_plus', params: {},
      note: `Five-plus day streak — keep the form clean.`,
    };
  }
  return {
    factor: 1, kind: 'baseline',
    key: 'trainer.steady', params: {},
    note: 'Steady session. Show up, finish strong.',
  };
}

export function deriveSession(
  profile: ProfileRow,
  now: Date = new Date(),
  ctx: RecentContext = { yesterdayComplianceRatio: null, streakDays: 0, yesterdayWasRest: false },
  adaptationOverride?: 'baseline',
): TodaySession {
  const tz = profile.timezone || 'UTC';
  const dow = calendarDayOfWeek(now, tz);
  const themes = THEMES[profile.goal] ?? THEMES['general_fitness']!;
  const theme = themes[dow] ?? 'Active recovery';
  const factor = LEVEL_FACTOR[profile.fitness_level] ?? 1.0;
  // adaptationOverride='baseline' is used by the preview endpoint so far-future
  // days don't pick up a today-only cushion (e.g. "first session back" 0.9×)
  // when the recent context happens to be empty.
  const adaptation: Adaptation = adaptationOverride === 'baseline'
    ? { factor: 1, kind: 'baseline', key: '', params: {}, note: '' }
    : pickAdaptation(ctx, theme);

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
    const level: 'beginner' | 'intermediate' | 'advanced' =
      profile.fitness_level === 'advanced' ? 'advanced'
        : profile.fitness_level === 'intermediate' ? 'intermediate'
        : 'beginner';
    const exercises = prescriptionsFor(theme, level, main);
    blocks.push({ name: 'Warm-up', durationMinutes: warmup, notes: 'Easy cardio + dynamic stretches.' });
    blocks.push({
      name: theme,
      durationMinutes: main,
      notes: 'Main work — focus on form and breathing.',
      ...(exercises.length > 0 ? { exercises } : {}),
    });
    blocks.push({ name: 'Cool-down', durationMinutes: cooldown, notes: 'Slow walk + static stretches.' });
  }

  return {
    date: calendarDate(now, tz),
    dayOfWeek: DAYS[dow] ?? 'Today',
    theme,
    totalMinutes: blocks.reduce((s, b) => s + b.durationMinutes, 0),
    blocks,
    trainerNoteKey: adaptation.key,
    trainerNoteParams: adaptation.params,
    trainerNote: adaptation.note,
    adaptation: adaptation.kind,
  };
}

/** Was the planned theme on the given calendar date a rest day for this profile? */
export function wasRestDay(profile: ProfileRow, at: Date): boolean {
  const themes = THEMES[profile.goal] ?? THEMES['general_fitness']!;
  return (themes[calendarDayOfWeek(at, profile.timezone || 'UTC')] ?? '') === 'Rest';
}
