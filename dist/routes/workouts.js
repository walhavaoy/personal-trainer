"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workoutsRouter = void 0;
const express_1 = require("express");
const uuid_1 = require("uuid");
const models_1 = require("../models");
const calories_1 = require("../calories");
const db_1 = require("../db");
const logger_1 = require("../logger");
exports.workoutsRouter = (0, express_1.Router)();
exports.workoutsRouter.get('/', (_req, res) => {
    try {
        const workouts = (0, db_1.getAllWorkouts)();
        res.json({ workouts });
    }
    catch (err) {
        logger_1.logger.error({ err }, 'Failed to fetch workouts');
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.workoutsRouter.post('/', (req, res) => {
    try {
        const body = req.body;
        if (!body || typeof body !== 'object') {
            res.status(400).json({ error: 'Request body is required' });
            return;
        }
        const exerciseType = body.exerciseType;
        const durationMinutes = body.durationMinutes;
        if (!exerciseType || !models_1.EXERCISE_TYPES.includes(exerciseType)) {
            res.status(400).json({
                error: `Invalid exerciseType. Must be one of: ${models_1.EXERCISE_TYPES.join(', ')}`,
            });
            return;
        }
        if (durationMinutes === undefined ||
            durationMinutes === null ||
            typeof durationMinutes !== 'number' ||
            !Number.isFinite(durationMinutes) ||
            durationMinutes <= 0) {
            res.status(400).json({
                error: 'durationMinutes must be a positive number',
            });
            return;
        }
        const validExerciseType = exerciseType;
        const caloriesBurned = (0, calories_1.calculateCaloriesBurned)(validExerciseType, durationMinutes);
        const workout = {
            id: (0, uuid_1.v4)(),
            exerciseType: validExerciseType,
            durationMinutes,
            caloriesBurned,
            createdAt: new Date().toISOString(),
        };
        (0, db_1.insertWorkout)(workout);
        logger_1.logger.info({ workoutId: workout.id, exerciseType, durationMinutes, caloriesBurned }, 'Workout created');
        res.status(201).json({ workout });
    }
    catch (err) {
        logger_1.logger.error({ err }, 'Failed to create workout');
        res.status(500).json({ error: 'Internal server error' });
    }
});
//# sourceMappingURL=workouts.js.map