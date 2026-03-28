import { ExerciseItem, ExerciseFilter } from './types.js';

const exercises: readonly ExerciseItem[] = [
  {
    id: 'ex-001',
    name: 'Push-ups',
    type: 'strength',
    muscleGroup: 'chest',
    caloriesBurnedPerMinute: 7,
    description: 'Classic bodyweight chest exercise performed in a plank position',
  },
  {
    id: 'ex-002',
    name: 'Squats',
    type: 'strength',
    muscleGroup: 'legs',
    caloriesBurnedPerMinute: 8,
    description: 'Compound lower-body movement targeting quads, glutes, and hamstrings',
  },
  {
    id: 'ex-003',
    name: 'Running',
    type: 'cardio',
    muscleGroup: 'full-body',
    caloriesBurnedPerMinute: 10,
    description: 'Steady-state cardiovascular running at moderate pace',
  },
  {
    id: 'ex-004',
    name: 'Plank',
    type: 'strength',
    muscleGroup: 'core',
    caloriesBurnedPerMinute: 4,
    description: 'Isometric core exercise holding a rigid body position',
  },
  {
    id: 'ex-005',
    name: 'Deadlift',
    type: 'strength',
    muscleGroup: 'back',
    caloriesBurnedPerMinute: 9,
    description: 'Compound lift targeting posterior chain — back, glutes, and hamstrings',
  },
  {
    id: 'ex-006',
    name: 'Cycling',
    type: 'cardio',
    muscleGroup: 'legs',
    caloriesBurnedPerMinute: 8,
    description: 'Moderate-intensity cycling on a stationary bike or road',
  },
  {
    id: 'ex-007',
    name: 'Overhead Press',
    type: 'strength',
    muscleGroup: 'shoulders',
    caloriesBurnedPerMinute: 6,
    description: 'Standing barbell or dumbbell press targeting shoulders and triceps',
  },
  {
    id: 'ex-008',
    name: 'Bicep Curls',
    type: 'strength',
    muscleGroup: 'arms',
    caloriesBurnedPerMinute: 5,
    description: 'Isolation exercise targeting the biceps with dumbbells or barbell',
  },
  {
    id: 'ex-009',
    name: 'Jump Rope',
    type: 'cardio',
    muscleGroup: 'full-body',
    caloriesBurnedPerMinute: 12,
    description: 'High-intensity skipping exercise for cardiovascular endurance',
  },
  {
    id: 'ex-010',
    name: 'Yoga Flow',
    type: 'flexibility',
    muscleGroup: 'full-body',
    caloriesBurnedPerMinute: 4,
    description: 'Vinyasa-style yoga sequence combining stretching and balance',
  },
  {
    id: 'ex-011',
    name: 'Bench Press',
    type: 'strength',
    muscleGroup: 'chest',
    caloriesBurnedPerMinute: 7,
    description: 'Barbell press performed on a flat bench targeting chest and triceps',
  },
  {
    id: 'ex-012',
    name: 'Lunges',
    type: 'strength',
    muscleGroup: 'legs',
    caloriesBurnedPerMinute: 7,
    description: 'Unilateral leg exercise stepping forward into a deep knee bend',
  },
  {
    id: 'ex-013',
    name: 'Swimming',
    type: 'cardio',
    muscleGroup: 'full-body',
    caloriesBurnedPerMinute: 7,
    description: 'Freestyle swimming at a moderate pace for full-body cardio',
  },
  {
    id: 'ex-014',
    name: 'Single-Leg Balance',
    type: 'balance',
    muscleGroup: 'legs',
    caloriesBurnedPerMinute: 3,
    description: 'Standing on one leg to improve stability and proprioception',
  },
  {
    id: 'ex-015',
    name: 'Pull-ups',
    type: 'strength',
    muscleGroup: 'back',
    caloriesBurnedPerMinute: 8,
    description: 'Upper-body compound exercise pulling bodyweight up to a bar',
  },
] as const;

/** Return exercises matching the given filter criteria (AND logic). */
export function getExercises(filter?: ExerciseFilter): ExerciseItem[] {
  let results: ExerciseItem[] = [...exercises];

  if (filter?.search) {
    const term = filter.search.trim().toLowerCase();
    results = results.filter(
      (e) =>
        e.name.toLowerCase().includes(term) ||
        e.description.toLowerCase().includes(term),
    );
  }

  if (filter?.muscleGroup) {
    const mg = filter.muscleGroup.trim().toLowerCase();
    results = results.filter((e) => e.muscleGroup.toLowerCase() === mg);
  }

  if (filter?.type) {
    const t = filter.type.trim().toLowerCase();
    results = results.filter((e) => e.type.toLowerCase() === t);
  }

  return results;
}

/** Return a single exercise by ID, or undefined if not found. */
export function getExerciseById(id: string): ExerciseItem | undefined {
  return exercises.find((e) => e.id === id);
}
