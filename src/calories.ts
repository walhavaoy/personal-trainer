import { ExerciseType } from './models';

/** Calories burned per minute for each exercise type */
const CALORIE_RATES: Record<ExerciseType, number> = {
  running: 10,
  cycling: 8,
  swimming: 9,
  walking: 4,
  weightlifting: 6,
  yoga: 3,
  hiit: 12,
};

export function calculateCaloriesBurned(
  exerciseType: ExerciseType,
  durationMinutes: number
): number {
  const rate = CALORIE_RATES[exerciseType];
  return Math.round(rate * durationMinutes);
}

export function getCalorieRate(exerciseType: ExerciseType): number {
  return CALORIE_RATES[exerciseType];
}
