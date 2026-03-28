/** An exercise in the library */
export interface ExerciseItem {
  id: string;
  name: string;
  type: 'strength' | 'cardio' | 'flexibility' | 'balance';
  muscleGroup: 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core' | 'full-body';
  caloriesBurnedPerMinute: number;
  description: string;
}

/** Filter options for exercise queries */
export interface ExerciseFilter {
  search?: string;
  muscleGroup?: string;
  type?: string;
}
