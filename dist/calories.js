"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateCaloriesBurned = calculateCaloriesBurned;
exports.getCalorieRate = getCalorieRate;
/** Calories burned per minute for each exercise type */
const CALORIE_RATES = {
    running: 10,
    cycling: 8,
    swimming: 9,
    walking: 4,
    weightlifting: 6,
    yoga: 3,
    hiit: 12,
};
function calculateCaloriesBurned(exerciseType, durationMinutes) {
    const rate = CALORIE_RATES[exerciseType];
    return Math.round(rate * durationMinutes);
}
function getCalorieRate(exerciseType) {
    return CALORIE_RATES[exerciseType];
}
//# sourceMappingURL=calories.js.map