import pino from 'pino';

export const logger = pino({
  name: 'personal-trainer',
  level: process.env.LOG_LEVEL ?? 'info',
});
