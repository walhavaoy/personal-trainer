import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { foodLibrary } from './food-library.js';
import { exerciseLibrary } from './exercise-library.js';

describe('foodLibrary', () => {
  it('has exactly 10 items', () => {
    assert.equal(foodLibrary.length, 10);
  });

  it('every item has positive calories and valid macros', () => {
    for (const item of foodLibrary) {
      assert.ok(item.id.length > 0, `missing id`);
      assert.ok(item.name.length > 0, `missing name for ${item.id}`);
      assert.ok(item.calories > 0, `calories must be positive for ${item.id}`);
      assert.ok(item.macros.protein >= 0, `protein must be >= 0 for ${item.id}`);
      assert.ok(item.macros.carbs >= 0, `carbs must be >= 0 for ${item.id}`);
      assert.ok(item.macros.fat >= 0, `fat must be >= 0 for ${item.id}`);
    }
  });

  it('has unique ids', () => {
    const ids = foodLibrary.map((f) => f.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe('exerciseLibrary', () => {
  it('has at least 10 items', () => {
    assert.ok(exerciseLibrary.length >= 10);
  });

  it('every item has positive calorie burn rate', () => {
    for (const item of exerciseLibrary) {
      assert.ok(item.id.length > 0, `missing id`);
      assert.ok(item.name.length > 0, `missing name for ${item.id}`);
      assert.ok(item.caloriesPerMinute > 0, `burn rate must be positive for ${item.id}`);
      assert.ok(
        ['cardio', 'strength', 'flexibility'].includes(item.category),
        `invalid category for ${item.id}`,
      );
    }
  });

  it('has unique ids', () => {
    const ids = exerciseLibrary.map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});
