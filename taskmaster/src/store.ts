import { v4 as uuidv4 } from 'uuid';

export interface Meal {
  id: string;
  name: string;
  foods: FoodEntry[];
  createdAt: string;
}

export interface FoodEntry {
  foodId: string;
  name: string;
  servings: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface FoodItem {
  id: string;
  name: string;
  caloriesPerServing: number;
  proteinPerServing: number;
  carbsPerServing: number;
  fatPerServing: number;
}

const foodLibrary: FoodItem[] = [
  { id: 'food-001', name: 'Chicken Breast', caloriesPerServing: 165, proteinPerServing: 31, carbsPerServing: 0, fatPerServing: 3.6 },
  { id: 'food-002', name: 'Brown Rice', caloriesPerServing: 216, proteinPerServing: 5, carbsPerServing: 45, fatPerServing: 1.8 },
  { id: 'food-003', name: 'Broccoli', caloriesPerServing: 55, proteinPerServing: 3.7, carbsPerServing: 11, fatPerServing: 0.6 },
  { id: 'food-004', name: 'Salmon', caloriesPerServing: 208, proteinPerServing: 20, carbsPerServing: 0, fatPerServing: 13 },
  { id: 'food-005', name: 'Sweet Potato', caloriesPerServing: 103, proteinPerServing: 2.3, carbsPerServing: 24, fatPerServing: 0.1 },
  { id: 'food-006', name: 'Eggs', caloriesPerServing: 155, proteinPerServing: 13, carbsPerServing: 1.1, fatPerServing: 11 },
  { id: 'food-007', name: 'Greek Yogurt', caloriesPerServing: 100, proteinPerServing: 17, carbsPerServing: 6, fatPerServing: 0.7 },
  { id: 'food-008', name: 'Oatmeal', caloriesPerServing: 154, proteinPerServing: 5, carbsPerServing: 27, fatPerServing: 2.6 },
  { id: 'food-009', name: 'Banana', caloriesPerServing: 105, proteinPerServing: 1.3, carbsPerServing: 27, fatPerServing: 0.4 },
  { id: 'food-010', name: 'Almonds', caloriesPerServing: 164, proteinPerServing: 6, carbsPerServing: 6, fatPerServing: 14 },
];

const meals: Map<string, Meal> = new Map();

export function getFoodLibrary(): FoodItem[] {
  return [...foodLibrary];
}

export function getFoodById(id: string): FoodItem | undefined {
  return foodLibrary.find((f) => f.id === id);
}

export function getAllMeals(): Meal[] {
  return Array.from(meals.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function getMealById(id: string): Meal | undefined {
  return meals.get(id);
}

export function createMeal(name: string, foods: FoodEntry[]): Meal {
  const meal: Meal = {
    id: uuidv4(),
    name,
    foods,
    createdAt: new Date().toISOString(),
  };
  meals.set(meal.id, meal);
  return meal;
}

export function deleteMeal(id: string): boolean {
  return meals.delete(id);
}
