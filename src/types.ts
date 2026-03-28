/** Macronutrient breakdown in grams per serving */
export interface Macros {
  protein: number;
  carbs: number;
  fat: number;
}

/** A food item in the library */
export interface FoodItem {
  id: string;
  name: string;
  servingSize: string;
  calories: number;
  macros: Macros;
}

/** An exercise in the library */
export interface ExerciseItem {
  id: string;
  name: string;
  category: 'cardio' | 'strength' | 'flexibility';
  /** Calories burned per minute (based on ~70 kg / 154 lb person) */
  caloriesPerMinute: number;
}
