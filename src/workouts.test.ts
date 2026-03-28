import express from 'express';
import { workoutsRouter } from './routes/workouts';
import { initDb, closeDb, getAllWorkouts } from './db';
import http from 'http';

let server: http.Server;
let baseUrl: string;

function makeRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options: http.RequestOptions = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: { 'Content-Type': 'application/json' },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode ?? 500, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode ?? 500, body: {} });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

beforeAll((done) => {
  initDb(':memory:');
  const app = express();
  app.use(express.json());
  app.use('/api/workouts', workoutsRouter);
  server = app.listen(0, () => {
    const addr = server.address();
    if (addr && typeof addr === 'object') {
      baseUrl = `http://127.0.0.1:${addr.port}`;
    }
    done();
  });
});

afterAll((done) => {
  closeDb();
  server.close(done);
});

describe('POST /api/workouts', () => {
  it('creates a workout and calculates calories', async () => {
    const res = await makeRequest('POST', '/api/workouts', {
      exerciseType: 'running',
      durationMinutes: 30,
    });
    expect(res.status).toBe(201);
    const workout = res.body.workout as Record<string, unknown>;
    expect(workout.exerciseType).toBe('running');
    expect(workout.durationMinutes).toBe(30);
    expect(workout.caloriesBurned).toBe(300);
    expect(workout.id).toBeDefined();
    expect(workout.createdAt).toBeDefined();
  });

  it('rejects invalid exercise type', async () => {
    const res = await makeRequest('POST', '/api/workouts', {
      exerciseType: 'dancing',
      durationMinutes: 30,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid exerciseType');
  });

  it('rejects missing durationMinutes', async () => {
    const res = await makeRequest('POST', '/api/workouts', {
      exerciseType: 'running',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('durationMinutes');
  });

  it('rejects negative duration', async () => {
    const res = await makeRequest('POST', '/api/workouts', {
      exerciseType: 'running',
      durationMinutes: -5,
    });
    expect(res.status).toBe(400);
  });

  it('rejects zero duration', async () => {
    const res = await makeRequest('POST', '/api/workouts', {
      exerciseType: 'running',
      durationMinutes: 0,
    });
    expect(res.status).toBe(400);
  });

  it('calculates calories for different exercise types', async () => {
    const res = await makeRequest('POST', '/api/workouts', {
      exerciseType: 'yoga',
      durationMinutes: 60,
    });
    expect(res.status).toBe(201);
    const workout = res.body.workout as Record<string, unknown>;
    expect(workout.caloriesBurned).toBe(180);
  });
});

describe('GET /api/workouts', () => {
  it('returns list of workouts', async () => {
    const res = await makeRequest('GET', '/api/workouts');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.workouts)).toBe(true);
    expect((res.body.workouts as unknown[]).length).toBeGreaterThanOrEqual(1);
  });

  it('returns workouts with correct fields', async () => {
    const res = await makeRequest('GET', '/api/workouts');
    const workouts = res.body.workouts as Record<string, unknown>[];
    const workout = workouts[0];
    expect(workout).toHaveProperty('id');
    expect(workout).toHaveProperty('exerciseType');
    expect(workout).toHaveProperty('durationMinutes');
    expect(workout).toHaveProperty('caloriesBurned');
    expect(workout).toHaveProperty('createdAt');
  });
});
