"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFoodLibrary = getFoodLibrary;
exports.getFoodById = getFoodById;
exports.getAllMeals = getAllMeals;
exports.getMealById = getMealById;
exports.createMeal = createMeal;
exports.deleteMeal = deleteMeal;
const uuid_1 = require("uuid");
const foodLibrary = [
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
const meals = new Map();
function getFoodLibrary() {
    return [...foodLibrary];
}
function getFoodById(id) {
    return foodLibrary.find((f) => f.id === id);
}
function getAllMeals() {
    return Array.from(meals.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
function getMealById(id) {
    return meals.get(id);
}
function createMeal(name, foods) {
    const meal = {
        id: (0, uuid_1.v4)(),
        name,
        foods,
        createdAt: new Date().toISOString(),
    };
    meals.set(meal.id, meal);
    return meal;
}
function deleteMeal(id) {
    return meals.delete(id);
}
//# sourceMappingURL=store.js.map