import { calculateCaloriesBurned, getCalorieRate } from './calories';

describe('calculateCaloriesBurned', () => {
  it('calculates calories for running', () => {
    expect(calculateCaloriesBurned('running', 30)).toBe(300);
  });

  it('calculates calories for walking', () => {
    expect(calculateCaloriesBurned('walking', 60)).toBe(240);
  });

  it('calculates calories for cycling', () => {
    expect(calculateCaloriesBurned('cycling', 45)).toBe(360);
  });

  it('calculates calories for swimming', () => {
    expect(calculateCaloriesBurned('swimming', 20)).toBe(180);
  });

  it('calculates calories for yoga', () => {
    expect(calculateCaloriesBurned('yoga', 60)).toBe(180);
  });

  it('calculates calories for hiit', () => {
    expect(calculateCaloriesBurned('hiit', 15)).toBe(180);
  });

  it('calculates calories for weightlifting', () => {
    expect(calculateCaloriesBurned('weightlifting', 45)).toBe(270);
  });

  it('rounds to nearest integer', () => {
    expect(calculateCaloriesBurned('running', 7)).toBe(70);
  });

  it('handles fractional durations', () => {
    expect(calculateCaloriesBurned('running', 1.5)).toBe(15);
  });
});

describe('getCalorieRate', () => {
  it('returns rate for running', () => {
    expect(getCalorieRate('running')).toBe(10);
  });

  it('returns rate for hiit', () => {
    expect(getCalorieRate('hiit')).toBe(12);
  });
});
