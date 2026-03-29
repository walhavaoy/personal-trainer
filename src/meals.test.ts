import express from 'express';
import { mealsRouter } from './routes/meals';
import { initDb, closeDb } from './db';
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
          resolve({ status: res.statusCode ?? 500, body: data ? JSON.parse(data) : {} });
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
  app.use('/api/meals', mealsRouter);
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

describe('POST /api/meals', () => {
  it('creates a meal', async () => {
    const res = await makeRequest('POST', '/api/meals', {
      name: 'Chicken Salad',
      calories: 350,
      protein: 30,
      carbs: 15,
      fat: 18,
      mealType: 'lunch',
    });
    expect(res.status).toBe(201);
    const meal = res.body.meal as Record<string, unknown>;
    expect(meal.name).toBe('Chicken Salad');
    expect(meal.calories).toBe(350);
    expect(meal.protein).toBe(30);
    expect(meal.carbs).toBe(15);
    expect(meal.fat).toBe(18);
    expect(meal.mealType).toBe('lunch');
    expect(meal.id).toBeDefined();
    expect(meal.createdAt).toBeDefined();
  });

  it('rejects missing name', async () => {
    const res = await makeRequest('POST', '/api/meals', {
      calories: 350,
      protein: 30,
      carbs: 15,
      fat: 18,
      mealType: 'lunch',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('name');
  });

  it('rejects invalid mealType', async () => {
    const res = await makeRequest('POST', '/api/meals', {
      name: 'Test',
      calories: 100,
      protein: 10,
      carbs: 10,
      fat: 5,
      mealType: 'brunch',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('mealType');
  });

  it('rejects negative calories', async () => {
    const res = await makeRequest('POST', '/api/meals', {
      name: 'Test',
      calories: -100,
      protein: 10,
      carbs: 10,
      fat: 5,
      mealType: 'lunch',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('calories');
  });
});

describe('GET /api/meals', () => {
  it('returns list of meals', async () => {
    const res = await makeRequest('GET', '/api/meals');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.meals)).toBe(true);
    expect((res.body.meals as unknown[]).length).toBeGreaterThanOrEqual(1);
  });
});

describe('GET /api/meals/:id', () => {
  it('returns a specific meal', async () => {
    const createRes = await makeRequest('POST', '/api/meals', {
      name: 'Oatmeal',
      calories: 250,
      protein: 8,
      carbs: 45,
      fat: 5,
      mealType: 'breakfast',
    });
    const mealId = (createRes.body.meal as Record<string, unknown>).id as string;

    const res = await makeRequest('GET', `/api/meals/${mealId}`);
    expect(res.status).toBe(200);
    expect((res.body.meal as Record<string, unknown>).name).toBe('Oatmeal');
  });

  it('returns 404 for non-existent meal', async () => {
    const res = await makeRequest('GET', '/api/meals/non-existent-id');
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/meals/:id', () => {
  it('updates a meal', async () => {
    const createRes = await makeRequest('POST', '/api/meals', {
      name: 'Rice Bowl',
      calories: 400,
      protein: 20,
      carbs: 60,
      fat: 10,
      mealType: 'dinner',
    });
    const mealId = (createRes.body.meal as Record<string, unknown>).id as string;

    const res = await makeRequest('PUT', `/api/meals/${mealId}`, {
      name: 'Brown Rice Bowl',
      calories: 380,
    });
    expect(res.status).toBe(200);
    const meal = res.body.meal as Record<string, unknown>;
    expect(meal.name).toBe('Brown Rice Bowl');
    expect(meal.calories).toBe(380);
    expect(meal.protein).toBe(20);
  });

  it('returns 404 for non-existent meal', async () => {
    const res = await makeRequest('PUT', '/api/meals/non-existent-id', {
      name: 'Updated',
    });
    expect(res.status).toBe(404);
  });

  it('rejects invalid mealType update', async () => {
    const createRes = await makeRequest('POST', '/api/meals', {
      name: 'Test Meal',
      calories: 200,
      protein: 10,
      carbs: 20,
      fat: 8,
      mealType: 'snack',
    });
    const mealId = (createRes.body.meal as Record<string, unknown>).id as string;

    const res = await makeRequest('PUT', `/api/meals/${mealId}`, {
      mealType: 'brunch',
    });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/meals/:id', () => {
  it('deletes a meal', async () => {
    const createRes = await makeRequest('POST', '/api/meals', {
      name: 'To Delete',
      calories: 100,
      protein: 5,
      carbs: 10,
      fat: 3,
      mealType: 'snack',
    });
    const mealId = (createRes.body.meal as Record<string, unknown>).id as string;

    const res = await makeRequest('DELETE', `/api/meals/${mealId}`);
    expect(res.status).toBe(204);

    const getRes = await makeRequest('GET', `/api/meals/${mealId}`);
    expect(getRes.status).toBe(404);
  });

  it('returns 404 for non-existent meal', async () => {
    const res = await makeRequest('DELETE', '/api/meals/non-existent-id');
    expect(res.status).toBe(404);
  });
});
