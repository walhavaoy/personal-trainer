import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { getDb, closeDb } from './db';
import dashboardRouter from './routes/dashboard';
import type { DashboardResponse } from './types';
import http from 'node:http';

function request(server: http.Server, path: string): Promise<{ status: number; body: DashboardResponse }> {
  return new Promise((resolve, reject) => {
    const address = server.address();
    if (!address || typeof address === 'string') {
      reject(new Error('server not listening'));
      return;
    }
    http.get(`http://127.0.0.1:${address.port}${path}`, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => {
        resolve({ status: res.statusCode ?? 500, body: JSON.parse(data) as DashboardResponse });
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

describe('GET /api/dashboard', () => {
  let server: http.Server;

  before(() => {
    process.env['DB_PATH'] = ':memory:';
    const app = express();
    app.use(express.json());
    getDb();
    app.use('/api', dashboardRouter);
    server = app.listen(0);
  });

  after(() => {
    server.close();
    closeDb();
  });

  it('returns 200 with empty data', async () => {
    const { status, body } = await request(server, '/api/dashboard');
    assert.equal(status, 200);
    assert.equal(body.daily_calories.total, 0);
    assert.equal(body.daily_calories.goal, 2000);
    assert.equal(body.daily_calories.remaining, 2000);
    assert.equal(body.weekly_trend.length, 7);
    assert.equal(body.macro_breakdown.protein_g, 0);
    assert.equal(body.streak.current, 0);
    assert.equal(body.streak.longest, 0);
  });

  it('reflects inserted food log data', async () => {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    db.prepare(
      `INSERT INTO food_logs (logged_at, calories, protein_g, carbs_g, fat_g, description)
       VALUES (?, 500, 30, 50, 20, 'test meal')`
    ).run(today);

    const { status, body } = await request(server, '/api/dashboard');
    assert.equal(status, 200);
    assert.equal(body.daily_calories.total, 500);
    assert.equal(body.daily_calories.remaining, 1500);
    assert.equal(body.macro_breakdown.protein_g, 30);
    assert.equal(body.macro_breakdown.carbs_g, 50);
    assert.equal(body.macro_breakdown.fat_g, 20);
    assert.equal(body.streak.current, 1);
    assert.equal(body.streak.longest, 1);
    assert.ok(body.macro_breakdown.protein_pct > 0);
  });

  it('calculates multi-day streak', async () => {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    // Add entries for yesterday and day before
    const yesterday = shiftDate(today, -1);
    const dayBefore = shiftDate(today, -2);
    db.prepare(
      `INSERT INTO food_logs (logged_at, calories, protein_g, carbs_g, fat_g, description)
       VALUES (?, 400, 20, 40, 15, 'yesterday meal')`
    ).run(yesterday);
    db.prepare(
      `INSERT INTO food_logs (logged_at, calories, protein_g, carbs_g, fat_g, description)
       VALUES (?, 350, 25, 35, 10, 'day before meal')`
    ).run(dayBefore);

    const { body } = await request(server, '/api/dashboard');
    assert.equal(body.streak.current, 3);
    assert.equal(body.streak.longest, 3);
  });
});

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
