import { ExerciseItem } from './types.js';

/**
 * Seed exercise library with calorie burn rates.
 * Rates are approximate for a ~70 kg (154 lb) person.
 */
export const exerciseLibrary: readonly ExerciseItem[] = [
  {
    id: 'running',
    name: 'Running (6 mph / 10 min mile)',
    category: 'cardio',
    caloriesPerMinute: 10,
  },
  {
    id: 'cycling',
    name: 'Cycling (moderate, 12-14 mph)',
    category: 'cardio',
    caloriesPerMinute: 8,
  },
  {
    id: 'swimming',
    name: 'Swimming (freestyle, moderate)',
    category: 'cardio',
    caloriesPerMinute: 7,
  },
  {
    id: 'jump-rope',
    name: 'Jump Rope',
    category: 'cardio',
    caloriesPerMinute: 12,
  },
  {
    id: 'walking',
    name: 'Walking (3.5 mph)',
    category: 'cardio',
    caloriesPerMinute: 4,
  },
  {
    id: 'weight-training',
    name: 'Weight Training (general)',
    category: 'strength',
    caloriesPerMinute: 5,
  },
  {
    id: 'bodyweight-circuit',
    name: 'Bodyweight Circuit Training',
    category: 'strength',
    caloriesPerMinute: 8,
  },
  {
    id: 'rowing',
    name: 'Rowing Machine (moderate)',
    category: 'cardio',
    caloriesPerMinute: 7,
  },
  {
    id: 'yoga',
    name: 'Yoga (vinyasa)',
    category: 'flexibility',
    caloriesPerMinute: 4,
  },
  {
    id: 'hiit',
    name: 'HIIT (high intensity interval)',
    category: 'cardio',
    caloriesPerMinute: 13,
  },
] as const;
