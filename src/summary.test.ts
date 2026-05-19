import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeSummary } from './summary.js';
import type { ProfileRow, WorkoutRow } from './db.js';

function profile(p: Partial<ProfileRow> = {}): ProfileRow {
  return {
    username: 'test',
    email: null,
    full_name: null,
    goal: 'strength',
    fitness_level: 'intermediate',
    weekly_minutes: 240,
    timezone: 'UTC',
    created_at: new Date(0),
    updated_at: new Date(0),
    ...p,
  };
}

function workout(date: string, completed = 30, planned = 30): WorkoutRow {
  return {
    id: '1',
    username: 'test',
    workout_date: new Date(date + 'T00:00:00Z'),
    theme: 'Pull',
    planned_minutes: planned,
    completed_minutes: completed,
    notes: null,
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
