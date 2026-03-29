export interface Workout {
  id: string;
  exerciseType: ExerciseType;
  durationMinutes: number;
  caloriesBurned: number;
  createdAt: string;
}

export type ExerciseType =
  | 'running'
  | 'cycling'
  | 'swimming'
  | 'walking'
  | 'weightlifting'
  | 'yoga'
  | 'hiit';

export const EXERCISE_TYPES: readonly ExerciseType[] = [
  'running',
  'cycling',
  'swimming',
  'walking',
  'weightlifting',
  'yoga',
  'hiit',
] as const;

export interface CreateWorkoutRequest {
  exerciseType: ExerciseType;
  durationMinutes: number;
}

export interface WorkoutRow {
  id: string;
  exercise_type: string;
  duration_minutes: number;
  calories_burned: number;
  created_at: string;
}

export interface Meal {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealType: MealType;
  createdAt: string;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_TYPES: readonly MealType[] = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
] as const;

export interface CreateMealRequest {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealType: MealType;
}

export interface UpdateMealRequest {
  name?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  mealType?: MealType;
}
