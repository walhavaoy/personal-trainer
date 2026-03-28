import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { EXERCISE_TYPES, ExerciseType } from '../models';
import { calculateCaloriesBurned } from '../calories';
import { insertWorkout, getAllWorkouts } from '../db';
import { logger } from '../logger';

export const workoutsRouter = Router();

workoutsRouter.get('/', (_req: Request, res: Response) => {
  try {
    const workouts = getAllWorkouts();
    res.json({ workouts });
  } catch (err) {
    logger.error({ err }, 'Failed to fetch workouts');
    res.status(500).json({ error: 'Internal server error' });
  }
});

workoutsRouter.post('/', (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;

    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'Request body is required' });
      return;
    }

    const exerciseType = body.exerciseType as string | undefined;
    const durationMinutes = body.durationMinutes as number | undefined;

    if (!exerciseType || !EXERCISE_TYPES.includes(exerciseType as ExerciseType)) {
      res.status(400).json({
        error: `Invalid exerciseType. Must be one of: ${EXERCISE_TYPES.join(', ')}`,
      });
      return;
    }

    if (
      durationMinutes === undefined ||
      durationMinutes === null ||
      typeof durationMinutes !== 'number' ||
      !Number.isFinite(durationMinutes) ||
      durationMinutes <= 0
    ) {
      res.status(400).json({
        error: 'durationMinutes must be a positive number',
      });
      return;
    }

    const validExerciseType = exerciseType as ExerciseType;
    const caloriesBurned = calculateCaloriesBurned(validExerciseType, durationMinutes);

    const workout = {
      id: uuidv4(),
      exerciseType: validExerciseType,
      durationMinutes,
      caloriesBurned,
      createdAt: new Date().toISOString(),
    };

    insertWorkout(workout);
    logger.info({ workoutId: workout.id, exerciseType, durationMinutes, caloriesBurned }, 'Workout created');

    res.status(201).json({ workout });
  } catch (err) {
    logger.error({ err }, 'Failed to create workout');
    res.status(500).json({ error: 'Internal server error' });
  }
});
