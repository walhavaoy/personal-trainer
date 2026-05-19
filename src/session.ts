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
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Themes keyed by goal × day-of-week (0..6). Pure derivation, no storage needed yet.
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

export function deriveSession(profile: ProfileRow, now: Date = new Date()): TodaySession {
  const dow = now.getDay();
  const themes = THEMES[profile.goal] ?? THEMES['general_fitness']!;
  const theme = themes[dow] ?? 'Active recovery';
  const factor = LEVEL_FACTOR[profile.fitness_level] ?? 1.0;

  const targetPerDay = Math.max(15, Math.round(profile.weekly_minutes / 6)); // 1 rest day
  const planned = theme === 'Rest' ? 0 : Math.round(targetPerDay * factor);

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

  const isoDate = now.toISOString().slice(0, 10);
  return {
    date: isoDate,
    dayOfWeek: DAYS[dow] ?? 'Today',
    theme,
    totalMinutes: blocks.reduce((s, b) => s + b.durationMinutes, 0),
    blocks,
  };
}
