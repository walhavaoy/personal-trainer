import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { MEAL_TYPES, MealType } from '../models';
import { insertMeal, getAllMeals, getMealById, updateMeal, deleteMeal } from '../db';
import { logger } from '../logger';

export const mealsRouter = Router();

mealsRouter.get('/', (_req: Request, res: Response) => {
  try {
    const meals = getAllMeals();
    res.json({ meals });
  } catch (err) {
    logger.error({ err }, 'Failed to fetch meals');
    res.status(500).json({ error: 'Internal server error' });
  }
});

mealsRouter.get('/:id', (req: Request, res: Response) => {
  try {
    const meal = getMealById(req.params.id);
    if (!meal) {
      res.status(404).json({ error: 'Meal not found' });
      return;
    }
    res.json({ meal });
  } catch (err) {
    logger.error({ err }, 'Failed to fetch meal');
    res.status(500).json({ error: 'Internal server error' });
  }
});

function validatePositiveNumber(value: unknown, fieldName: string): string | null {
  if (
    value === undefined ||
    value === null ||
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return `${fieldName} must be a non-negative number`;
  }
  return null;
}

mealsRouter.post('/', (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;

    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'Request body is required' });
      return;
    }

    const name = body.name as string | undefined;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'name is required and must be a non-empty string' });
      return;
    }

    const mealType = body.mealType as string | undefined;
    if (!mealType || !MEAL_TYPES.includes(mealType as MealType)) {
      res.status(400).json({
        error: `Invalid mealType. Must be one of: ${MEAL_TYPES.join(', ')}`,
      });
      return;
    }

    for (const field of ['calories', 'protein', 'carbs', 'fat'] as const) {
      const err = validatePositiveNumber(body[field], field);
      if (err) {
        res.status(400).json({ error: err });
        return;
      }
    }

    const meal = {
      id: uuidv4(),
      name: name.trim(),
      calories: body.calories as number,
      protein: body.protein as number,
      carbs: body.carbs as number,
      fat: body.fat as number,
      mealType: mealType as MealType,
      createdAt: new Date().toISOString(),
    };

    insertMeal(meal);
    logger.info({ mealId: meal.id, name: meal.name, mealType }, 'Meal created');

    res.status(201).json({ meal });
  } catch (err) {
    logger.error({ err }, 'Failed to create meal');
    res.status(500).json({ error: 'Internal server error' });
  }
});

mealsRouter.put('/:id', (req: Request, res: Response) => {
  try {
    const existing = getMealById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Meal not found' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'Request body is required' });
      return;
    }

    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim().length === 0) {
        res.status(400).json({ error: 'name must be a non-empty string' });
        return;
      }
      updates.name = (body.name as string).trim();
    }

    if (body.mealType !== undefined) {
      if (!MEAL_TYPES.includes(body.mealType as MealType)) {
        res.status(400).json({
          error: `Invalid mealType. Must be one of: ${MEAL_TYPES.join(', ')}`,
        });
        return;
      }
      updates.mealType = body.mealType;
    }

    for (const field of ['calories', 'protein', 'carbs', 'fat'] as const) {
      if (body[field] !== undefined) {
        const err = validatePositiveNumber(body[field], field);
        if (err) {
          res.status(400).json({ error: err });
          return;
        }
        updates[field] = body[field];
      }
    }

    const updated = updateMeal(req.params.id, updates);
    if (!updated) {
      res.status(404).json({ error: 'Meal not found' });
      return;
    }

    logger.info({ mealId: req.params.id }, 'Meal updated');
    res.json({ meal: updated });
  } catch (err) {
    logger.error({ err }, 'Failed to update meal');
    res.status(500).json({ error: 'Internal server error' });
  }
});

mealsRouter.delete('/:id', (req: Request, res: Response) => {
  try {
    const deleted = deleteMeal(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Meal not found' });
      return;
    }

    logger.info({ mealId: req.params.id }, 'Meal deleted');
    res.status(204).send();
  } catch (err) {
    logger.error({ err }, 'Failed to delete meal');
    res.status(500).json({ error: 'Internal server error' });
  }
});
