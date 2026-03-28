import express from 'express';
import path from 'path';
import pino from 'pino';
import pinoHttp from 'pino-http';
import profileRouter from './routes/profile';
import bmrRouter from './routes/bmr';

const logger = pino({ name: 'personal-trainer' });
const app = express();
const PORT = parseInt(process.env.PORT ?? '3000', 10);

app.use(pinoHttp({ logger }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/profile', profileRouter);
app.use('/api/bmr', bmrRouter);

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Personal Trainer server started');
});

export default app;
