import { Router, Request, Response } from 'express';
import { getProfile, BmrResult } from '../models/profile';
import pino from 'pino';

const logger = pino({ name: 'bmr-route' });
const router = Router();

export function calculateBmr(weightKg: number, heightCm: number, ageYears: number, sex: 'male' | 'female'): number {
  // Mifflin-St Jeor equation
  const base = (10 * weightKg) + (6.25 * heightCm) - (5 * ageYears);
  return sex === 'male' ? base + 5 : base - 161;
}

router.get('/:id', (req: Request, res: Response): void => {
  const profile = getProfile(req.params.id);
  if (!profile) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }

  const bmr = calculateBmr(profile.weightKg, profile.heightCm, profile.ageYears, profile.sex);
  const result: BmrResult = {
    bmr,
    formula: 'mifflin-st-jeor',
    profile,
  };

  logger.info({ profileId: profile.id, bmr }, 'BMR calculated');
  res.json(result);
});

export default router;
