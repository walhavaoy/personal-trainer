// ---------------------------------------------------------------------------
// Data interfaces
// ---------------------------------------------------------------------------

export interface Meal {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  timestamp: number;
}

export interface Workout {
  id: string;
  name: string;
  durationMinutes: number;
  caloriesBurned: number;
  type: string;
  timestamp: number;
}

export interface Settings {
  id: string;
  key: string;
  value: unknown;
}

// ---------------------------------------------------------------------------
// Generic collection interface
// ---------------------------------------------------------------------------

export interface ICollection<T> {
  get(id: string): T | undefined;
  set(id: string, item: T): T;
  delete(id: string): boolean;
  list(): T[];
  clear(): void;
}
