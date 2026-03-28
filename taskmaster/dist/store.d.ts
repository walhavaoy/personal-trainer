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
export declare function getFoodLibrary(): FoodItem[];
export declare function getFoodById(id: string): FoodItem | undefined;
export declare function getAllMeals(): Meal[];
export declare function getMealById(id: string): Meal | undefined;
export declare function createMeal(name: string, foods: FoodEntry[]): Meal;
export declare function deleteMeal(id: string): boolean;
//# sourceMappingURL=store.d.ts.map