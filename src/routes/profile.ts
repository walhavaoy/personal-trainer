import { Router, Request, Response } from 'express';
import { getProfile, setProfile, UserProfile } from '../models/profile';
import pino from 'pino';

const logger = pino({ name: 'profile-route' });
const router = Router();

interface ProfileBody {
  heightCm: number;
  weightKg: number;
  ageYears: number;
  sex: 'male' | 'female';
}

function validateProfileBody(body: unknown): body is ProfileBody {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.heightCm === 'number' && b.heightCm > 0 &&
    typeof b.weightKg === 'number' && b.weightKg > 0 &&
    typeof b.ageYears === 'number' && b.ageYears > 0 &&
    (b.sex === 'male' || b.sex === 'female')
  );
}

router.put('/:id', (req: Request, res: Response): void => {
  const { id } = req.params;
  if (!validateProfileBody(req.body)) {
    res.status(400).json({
      error: 'Invalid profile data. Required: heightCm (>0), weightKg (>0), ageYears (>0), sex ("male"|"female")',
    });
    return;
  }

  const profile: UserProfile = {
    id,
    heightCm: req.body.heightCm,
    weightKg: req.body.weightKg,
    ageYears: req.body.ageYears,
    sex: req.body.sex,
  };

  setProfile(profile);
  logger.info({ profileId: id }, 'Profile saved');
  res.status(200).json(profile);
});

router.get('/:id', (req: Request, res: Response): void => {
  const profile = getProfile(req.params.id);
  if (!profile) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }
  res.json(profile);
});

export default router;
