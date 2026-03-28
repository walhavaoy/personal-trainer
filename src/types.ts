/** A single food log entry stored in the database */
export interface FoodLogRow {
  id: number;
  logged_at: string; // ISO-8601 date string (YYYY-MM-DD)
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  description: string;
}

/** Daily calorie total */
export interface DailyCalories {
  total: number;
  goal: number;
  remaining: number;
}

/** One day in the weekly trend */
export interface TrendDay {
  date: string;
  calories: number;
}

/** Macronutrient breakdown for the current day */
export interface MacroBreakdown {
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  protein_pct: number;
  carbs_pct: number;
  fat_pct: number;
}

/** Streak information */
export interface Streak {
  current: number;
  longest: number;
}

/** Full dashboard response */
export interface DashboardResponse {
  daily_calories: DailyCalories;
  weekly_trend: TrendDay[];
  macro_breakdown: MacroBreakdown;
  streak: Streak;
}
