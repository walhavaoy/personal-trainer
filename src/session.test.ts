import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deriveSession, wasRestDay } from './session.js';
import type { ProfileRow } from './db.js';

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

// 2026-05-19 is a Tuesday. Use noon UTC so the date is unambiguous in any tz.
const TUE = new Date('2026-05-19T12:00:00Z');
const SUN = new Date('2026-05-17T12:00:00Z'); // strength Sunday → Rest

describe('deriveSession', () => {
  it('picks the theme by day-of-week from the profile goal', () => {
    const s = deriveSession(profile(), TUE);
    assert.equal(s.theme, 'Pull');
    assert.equal(s.dayOfWeek, 'Tuesday');
  });

  it('returns a Rest day with 0 minutes for strength on Sunday', () => {
    const s = deriveSession(profile(), SUN);
    assert.equal(s.theme, 'Rest');
    assert.equal(s.totalMinutes, 0);
    assert.equal(s.blocks.length, 1);
    assert.equal(s.blocks[0]!.name, 'Rest day');
  });

  it('intermediate level keeps the baseline level factor of 1.0', () => {
    const s = deriveSession(
      profile({ fitness_level: 'intermediate', weekly_minutes: 240 }),
      TUE,
      undefined,
      'baseline',
    );
    // weekly_minutes 240 / 6 = 40 perDay; factor 1.0 → 40 planned; warmup+main+cooldown = 40
    assert.equal(s.totalMinutes, 40);
  });

  it('beginner scales down (factor 0.8)', () => {
    const s = deriveSession(
      profile({ fitness_level: 'beginner', weekly_minutes: 240 }),
      TUE,
      undefined,
      'baseline',
    );
    assert.equal(s.totalMinutes, 32);
  });

  it('advanced scales up (factor 1.2)', () => {
    const s = deriveSession(
      profile({ fitness_level: 'advanced', weekly_minutes: 240 }),
      TUE,
      undefined,
      'baseline',
    );
    assert.equal(s.totalMinutes, 48);
  });

  it('applies recovery 0.8× when yesterday compliance < 0.5', () => {
    const s = deriveSession(profile(), TUE, {
      yesterdayComplianceRatio: 0.25,
      streakDays: 1,
      yesterdayWasRest: false,
    });
    assert.equal(s.adaptation, 'recovery');
    // 40 base × 0.8 = 32
    assert.equal(s.totalMinutes, 32);
  });

  it('applies progression 1.1× when streak ≥ 3 and yesterday ≥ 100%', () => {
    const s = deriveSession(profile(), TUE, {
      yesterdayComplianceRatio: 1.0,
      streakDays: 4,
      yesterdayWasRest: false,
    });
    assert.equal(s.adaptation, 'progression');
    // 40 × 1.1 = 44
    assert.equal(s.totalMinutes, 44);
  });

  it('applies first-session recovery 0.9× when there is no streak and no yesterday', () => {
    const s = deriveSession(profile(), TUE, {
      yesterdayComplianceRatio: null,
      streakDays: 0,
      yesterdayWasRest: false,
    });
    assert.equal(s.adaptation, 'recovery');
    // 40 × 0.9 = 36
    assert.equal(s.totalMinutes, 36);
  });

  it('adaptationOverride="baseline" skips all adaptation, regardless of ctx', () => {
    const s = deriveSession(
      profile(),
      TUE,
      { yesterdayComplianceRatio: 0.1, streakDays: 0, yesterdayWasRest: false },
      'baseline',
    );
    assert.equal(s.adaptation, 'baseline');
    assert.equal(s.totalMinutes, 40); // no 0.8× cushion
    assert.equal(s.trainerNote, '');
  });

  it('respects the profile timezone when computing day-of-week', () => {
    // 21:00 UTC on Tuesday = 06:00 Wednesday in Tokyo (UTC+9).
    // For a Tokyo strength user, the day is Wednesday → Legs.
    const at = new Date('2026-05-19T21:00:00Z');
    const tokyo = deriveSession(profile({ timezone: 'Asia/Tokyo' }), at);
    assert.equal(tokyo.dayOfWeek, 'Wednesday');
    assert.equal(tokyo.theme, 'Legs');
    const utc = deriveSession(profile({ timezone: 'UTC' }), at);
    assert.equal(utc.dayOfWeek, 'Tuesday');
    assert.equal(utc.theme, 'Pull');
  });

  it('attaches exercise prescriptions on the main block for known themes', () => {
    const s = deriveSession(profile(), TUE, undefined, 'baseline');
    const main = s.blocks.find((b) => b.name === 'Pull');
    assert.ok(main && main.exercises && main.exercises.length > 0);
    // Intermediate Pull should include a Pull-up variant (not Lat pulldown)
    const names = main.exercises.map((e) => e.name);
    assert.ok(names.includes('Pull-up'), `expected Pull-up in ${names.join(', ')}`);
  });
});

describe('wasRestDay', () => {
  it('returns true for strength Sunday', () => {
    assert.equal(wasRestDay(profile(), SUN), true);
  });
  it('returns false for strength Tuesday', () => {
    assert.equal(wasRestDay(profile(), TUE), false);
  });
});
