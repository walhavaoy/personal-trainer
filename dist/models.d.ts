export interface Workout {
    id: string;
    exerciseType: ExerciseType;
    durationMinutes: number;
    caloriesBurned: number;
    createdAt: string;
}
export type ExerciseType = 'running' | 'cycling' | 'swimming' | 'walking' | 'weightlifting' | 'yoga' | 'hiit';
export declare const EXERCISE_TYPES: readonly ExerciseType[];
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
//# sourceMappingURL=models.d.ts.map