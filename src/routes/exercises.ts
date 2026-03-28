import { Router, Request, Response } from 'express';
import pino from 'pino';
import { getExercises } from '../store.js';

const logger = pino({ name: 'exercises-route' });
const router = Router();

router.get('/', (req: Request, res: Response) => {
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const muscleGroup = typeof req.query.muscleGroup === 'string' ? req.query.muscleGroup : undefined;
  const type = typeof req.query.type === 'string' ? req.query.type : undefined;

  const exercises = getExercises({ search, muscleGroup, type });

  logger.info({ search, muscleGroup, type, resultCount: exercises.length }, 'exercises query');

  res.json({ exercises, total: exercises.length });
});

export { router as exercisesRouter };
