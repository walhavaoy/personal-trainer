"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mealsRouter = void 0;
const express_1 = require("express");
const pino_1 = __importDefault(require("pino"));
const store_1 = require("../store");
const logger = (0, pino_1.default)({ name: 'meals-route' });
const router = (0, express_1.Router)();
exports.mealsRouter = router;
// GET /api/meals — list all meals
router.get('/', (_req, res) => {
    const meals = (0, store_1.getAllMeals)();
    logger.info({ count: meals.length }, 'listing meals');
    res.json({ meals });
});
// POST /api/meals — create a new meal
router.post('/', (req, res) => {
    const body = req.body;
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
        res.status(400).json({ error: 'name is required and must be a non-empty string' });
        return;
    }
    if (!Array.isArray(body.foods) || body.foods.length === 0) {
        res.status(400).json({ error: 'foods is required and must be a non-empty array' });
        return;
    }
    const foodEntries = [];
    for (const entry of body.foods) {
        if (!entry.foodId || typeof entry.foodId !== 'string') {
            res.status(400).json({ error: 'each food entry must have a foodId string' });
            return;
        }
        const servings = Number(entry.servings);
        if (!Number.isFinite(servings) || servings <= 0) {
            res.status(400).json({ error: 'each food entry must have a positive servings number' });
            return;
        }
        const food = (0, store_1.getFoodById)(entry.foodId);
        if (!food) {
            res.status(400).json({ error: `unknown foodId: ${entry.foodId}` });
            return;
        }
        foodEntries.push({
            foodId: food.id,
            name: food.name,
            servings,
            calories: Math.round(food.caloriesPerServing * servings * 10) / 10,
            protein: Math.round(food.proteinPerServing * servings * 10) / 10,
            carbs: Math.round(food.carbsPerServing * servings * 10) / 10,
            fat: Math.round(food.fatPerServing * servings * 10) / 10,
        });
    }
    const meal = (0, store_1.createMeal)(body.name.trim(), foodEntries);
    logger.info({ mealId: meal.id }, 'meal created');
    res.status(201).json({ meal });
});
// DELETE /api/meals/:id — delete a meal
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    const deleted = (0, store_1.deleteMeal)(id);
    if (!deleted) {
        res.status(404).json({ error: 'meal not found' });
        return;
    }
    logger.info({ mealId: id }, 'meal deleted');
    res.status(204).send();
});
//# sourceMappingURL=meals.js.map