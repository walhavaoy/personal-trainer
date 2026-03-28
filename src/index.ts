import express from 'express';
import pino from 'pino';
import { exercisesRouter } from './routes/exercises.js';

const logger = pino({ name: 'personal-trainer' });
const app = express();
const port = parseInt(process.env.PORT ?? '3000', 10);

app.use(express.json());
app.use('/api/exercises', exercisesRouter);

app.listen(port, () => {
  logger.info({ port }, 'server started');
});

export { app };
