import { Router, Request, Response } from 'express';
import pino from 'pino';
import {
  getAllMeals,
  createMeal,
  deleteMeal,
  getFoodById,
  FoodEntry,
} from '../store';

const logger = pino({ name: 'meals-route' });

interface CreateMealBody {
  name: string;
  foods: Array<{
    foodId: string;
    servings: number;
  }>;
}

const router = Router();

// GET /api/meals — list all meals
router.get('/', (_req: Request, res: Response) => {
  const meals = getAllMeals();
  logger.info({ count: meals.length }, 'listing meals');
  res.json({ meals });
});

// POST /api/meals — create a new meal
router.post('/', (req: Request, res: Response) => {
  const body = req.body as CreateMealBody;

  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    res.status(400).json({ error: 'name is required and must be a non-empty string' });
    return;
  }

  if (!Array.isArray(body.foods) || body.foods.length === 0) {
    res.status(400).json({ error: 'foods is required and must be a non-empty array' });
    return;
  }

  const foodEntries: FoodEntry[] = [];

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

    const food = getFoodById(entry.foodId);
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

  const meal = createMeal(body.name.trim(), foodEntries);
  logger.info({ mealId: meal.id }, 'meal created');
  res.status(201).json({ meal });
});

// DELETE /api/meals/:id — delete a meal
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  const deleted = deleteMeal(id);
  if (!deleted) {
    res.status(404).json({ error: 'meal not found' });
    return;
  }

  logger.info({ mealId: id }, 'meal deleted');
  res.status(204).send();
});

export { router as mealsRouter };
