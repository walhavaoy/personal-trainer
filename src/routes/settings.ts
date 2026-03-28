import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { logger } from '../logger';

export const settingsRouter = Router();

/** Shape returned by GET and accepted by PATCH */
export interface Settings {
  dailyCalorieTarget: number;
  weeklyWorkoutGoal: number;
}

/** Allowed keys and their validation constraints */
const SETTING_KEYS: Record<keyof Settings, { min: number; max: number }> = {
  dailyCalorieTarget: { min: 0, max: 99999 },
  weeklyWorkoutGoal: { min: 0, max: 7 },
};

function loadSettings(): Settings {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{
    key: string;
    value: string;
  }>;

  const map = new Map(rows.map((r) => [r.key, r.value]));

  return {
    dailyCalorieTarget: Number(map.get('dailyCalorieTarget') ?? '2000'),
    weeklyWorkoutGoal: Number(map.get('weeklyWorkoutGoal') ?? '4'),
  };
}

// GET /api/settings
settingsRouter.get('/', (_req: Request, res: Response) => {
  try {
    const settings = loadSettings();
    res.json(settings);
  } catch (err: unknown) {
    logger.error({ err }, 'failed to load settings');
    res.status(500).json({ error: 'internal server error' });
  }
});

// PATCH /api/settings
settingsRouter.patch('/', (req: Request, res: Response) => {
  try {
    const body: unknown = req.body;

    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      res.status(400).json({ error: 'request body must be a JSON object' });
      return;
    }

    const updates = body as Record<string, unknown>;
    const validUpdates: Array<{ key: string; value: string }> = [];

    for (const [key, value] of Object.entries(updates)) {
      if (!(key in SETTING_KEYS)) {
        res.status(400).json({ error: `unknown setting: ${key}` });
        return;
      }

      if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
        res.status(400).json({ error: `${key} must be an integer` });
        return;
      }

      const constraints = SETTING_KEYS[key as keyof Settings];
      if (value < constraints.min || value > constraints.max) {
        res.status(400).json({
          error: `${key} must be between ${constraints.min} and ${constraints.max}`,
        });
        return;
      }

      validUpdates.push({ key, value: String(value) });
    }

    if (validUpdates.length === 0) {
      res.status(400).json({ error: 'no valid settings provided' });
      return;
    }

    const db = getDb();
    const upsert = db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    );

    const tx = db.transaction(() => {
      for (const { key, value } of validUpdates) {
        upsert.run(key, value);
      }
    });
    tx();

    logger.info({ updates: validUpdates }, 'settings updated');

    const settings = loadSettings();
    res.json(settings);
  } catch (err: unknown) {
    logger.error({ err }, 'failed to update settings');
    res.status(500).json({ error: 'internal server error' });
  }
});
