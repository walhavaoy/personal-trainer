import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeSummary, computeTrend } from './summary.js';
import type { ProfileRow, WorkoutRow } from './db.js';

function profile(p: Partial<ProfileRow> = {}): ProfileRow {
  return {
    username: 'test',
    email: null,
    full_name: null,
    display_name: null,
    goal: 'strength',
    fitness_level: 'intermediate',
    weekly_minutes: 240,
    timezone: 'UTC',
    created_at: new Date(0),
    updated_at: new Date(0),
    ...p,
  };
}

function workout(date: string, completed = 30, planned = 30, distanceKm: number | null = null): WorkoutRow {
  return {
    id: '1',
    username: 'test',
    workout_date: new Date(date + 'T00:00:00Z'),
    theme: 'Pull',
    planned_minutes: planned,
    completed_minutes: completed,
    notes: null,
    exercises_completed: [],
    distance_km: distanceKm,
    created_at: new Date(0),
  };
}

// 2026-05-19 is Tuesday; Monday of this week is 2026-05-18. Last week starts 2026-05-11.
const TUE = new Date('2026-05-19T12:00:00Z');

describe('computeSummary', () => {
  it('handles no workouts as trend=new and zeros everywhere', () => {
    const s = computeSummary(profile(), [], TUE);
    assert.equal(s.weekStart, '2026-05-18');
    assert.equal(s.thisWeekMinutes, 0);
    assert.equal(s.lastWeekMinutes, 0);
    assert.equal(s.weekOverWeekTrend, 'new');
    assert.equal(s.streakDays, 0);
    assert.equal(s.lastWorkoutDate, null);
  });

  it('counts only workouts inside this week toward thisWeekMinutes', () => {
    const s = computeSummary(profile(), [
      workout('2026-05-18', 30),
      workout('2026-05-19', 30),
      workout('2026-05-17', 30), // last week
    ], TUE);
    assert.equal(s.thisWeekMinutes, 60);
    assert.equal(s.thisWeekSessions, 2);
    assert.equal(s.lastWeekMinutes, 30);
    assert.equal(s.weekOverWeekTrend, 'up');
  });

  it('streak counts back from today across consecutive logged days', () => {
    const s = computeSummary(profile(), [
      workout('2026-05-19'),
      workout('2026-05-18'),
      workout('2026-05-17'),
      // gap on 16
      workout('2026-05-15'),
    ], TUE);
    assert.equal(s.streakDays, 3);
  });

  it('streak survives missing today if yesterday is logged', () => {
    const s = computeSummary(profile(), [
      workout('2026-05-18'), // yesterday
      workout('2026-05-17'),
    ], TUE);
    assert.equal(s.streakDays, 2);
  });

  it('trend tolerance: ±10% (or ±5 min) is flat', () => {
    // Last week 100, this week 105 → 5% diff → flat (tolerance = max(5, 10) = 10)
    const s = computeSummary(profile(), [
      workout('2026-05-12', 50), workout('2026-05-14', 50),
      workout('2026-05-19', 53), workout('2026-05-18', 52),
    ], TUE);
    assert.equal(s.lastWeekMinutes, 100);
    assert.equal(s.thisWeekMinutes, 105);
    assert.equal(s.weekOverWeekTrend, 'flat');
  });

  it('trend up when delta > tolerance', () => {
    const s = computeSummary(profile(), [
      workout('2026-05-14', 30),                   // last week: 30
      workout('2026-05-18', 30), workout('2026-05-19', 60), // this week: 90
    ], TUE);
    assert.equal(s.weekOverWeekTrend, 'up');
    assert.equal(s.weekOverWeekDeltaMinutes, 60);
  });

  it('trend down when delta < -tolerance', () => {
    const s = computeSummary(profile(), [
      workout('2026-05-12', 50), workout('2026-05-13', 50), workout('2026-05-15', 50), // 150 last week
      workout('2026-05-19', 30),                                                       // 30 this week
    ], TUE);
    assert.equal(s.weekOverWeekTrend, 'down');
  });

  it('percent uses weekly_minutes as denominator, capped at 999', () => {
    const s = computeSummary(profile({ weekly_minutes: 100 }), [
      workout('2026-05-18', 50), workout('2026-05-19', 60),
    ], TUE);
    assert.equal(s.percentOfTarget, 110);
  });

  it('bestPriorWeekDistanceKm tracks max distance from prior weeks only', () => {
    const s = computeSummary(profile(), [
      workout('2026-05-19', 30, 30, 3.0),    // this week: 3 km
      workout('2026-05-13', 30, 30, 8.0),    // last week: 8 km
      workout('2026-05-14', 30, 30, 4.0),    // last week + 4 = 12 total
      workout('2026-05-06', 30, 30, 5.0),    // two weeks: 5 km
    ], TUE);
    assert.equal(s.thisWeekDistanceKm, 3);
    assert.equal(s.bestPriorWeekDistanceKm, 12);
  });

  it('bestPriorWeekDistanceKm is 0 with no distance history', () => {
    const s = computeSummary(profile(), [
      workout('2026-05-19', 30, 30, 5.0),
    ], TUE);
    assert.equal(s.bestPriorWeekDistanceKm, 0);
  });

  it('thisWeekDistanceKm sums per-row distance_km only for this week', () => {
    const s = computeSummary(profile(), [
      workout('2026-05-18', 30, 30, 5.0),
      workout('2026-05-19', 30, 30, 3.2),
      workout('2026-05-17', 30, 30, 99), // last week — ignored
    ], TUE);
    assert.equal(s.thisWeekDistanceKm, 8.2);
    assert.equal(s.lastWeekDistanceKm, 99);
  });

  it('distance ignores null and treats strings as numbers', () => {
    const rows = [
      workout('2026-05-18', 30, 30, null),
      workout('2026-05-19', 30, 30, 4.5),
    ];
    // simulate pg-style NUMERIC-as-string
    (rows[0] as { distance_km: string | number | null }).distance_km = '2.5';
    const s = computeSummary(profile(), rows, TUE);
    assert.equal(s.thisWeekDistanceKm, 7);
  });

  it('bestPriorWeekMinutes is the max of prior-week sums, excluding this week', () => {
    // This week (Mon 2026-05-18): 30 min total.
    // Last week (Mon 2026-05-11): 80 min total. ← should win.
    // Two weeks ago (Mon 2026-05-04): 40 min total.
    const s = computeSummary(profile(), [
      workout('2026-05-18', 30),
      workout('2026-05-13', 40), workout('2026-05-15', 40), // last week: 80
      workout('2026-05-06', 40),                            // two weeks: 40
    ], TUE);
    assert.equal(s.thisWeekMinutes, 30);
    assert.equal(s.bestPriorWeekMinutes, 80);
  });

  it('bestPriorWeekMinutes is 0 with no prior workouts', () => {
    const s = computeSummary(profile(), [workout('2026-05-19', 30)], TUE);
    assert.equal(s.bestPriorWeekMinutes, 0);
  });

  it('computeTrend returns N weeks oldest-first, including the current week', () => {
    const t = computeTrend(profile(), [
      workout('2026-05-19', 30), // this week
      workout('2026-05-13', 25), // last week
      workout('2026-05-06', 50), // 2 weeks ago
    ], TUE, 4);
    assert.equal(t.length, 4);
    // oldest first
    const starts = t.map((w) => w.weekStart);
    assert.deepEqual(starts, ['2026-04-27', '2026-05-04', '2026-05-11', '2026-05-18']);
    // current week is the last entry
    assert.equal(t[3]!.totalMinutes, 30);
    assert.equal(t[2]!.totalMinutes, 25);
    assert.equal(t[1]!.totalMinutes, 50);
    assert.equal(t[0]!.totalMinutes, 0);
    // percent based on profile.weekly_minutes (240): 30/240 = 12%
    assert.equal(t[3]!.percentOfTarget, 13); // Math.round(30/240*100) = 13
  });

  it('respects user timezone when picking weekStart', () => {
    // 21:30 UTC on Sunday = 06:30 Monday in Tokyo, so weekStart in Tokyo is
    // Monday May 18 — but in UTC the week still starts on May 11 (since UTC
    // is still Sunday). This locks in the Monday-of-this-week semantics.
    const sundayLate = new Date('2026-05-17T21:30:00Z');
    const tokyo = computeSummary(profile({ timezone: 'Asia/Tokyo' }), [], sundayLate);
    const utc = computeSummary(profile({ timezone: 'UTC' }), [], sundayLate);
    assert.equal(tokyo.weekStart, '2026-05-18');
    assert.equal(utc.weekStart, '2026-05-11');
  });
});
