"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const assert = __importStar(require("node:assert/strict"));
const food_library_js_1 = require("./food-library.js");
const exercise_library_js_1 = require("./exercise-library.js");
(0, node_test_1.describe)('foodLibrary', () => {
    (0, node_test_1.it)('has exactly 10 items', () => {
        assert.equal(food_library_js_1.foodLibrary.length, 10);
    });
    (0, node_test_1.it)('every item has positive calories and valid macros', () => {
        for (const item of food_library_js_1.foodLibrary) {
            assert.ok(item.id.length > 0, `missing id`);
            assert.ok(item.name.length > 0, `missing name for ${item.id}`);
            assert.ok(item.calories > 0, `calories must be positive for ${item.id}`);
            assert.ok(item.macros.protein >= 0, `protein must be >= 0 for ${item.id}`);
            assert.ok(item.macros.carbs >= 0, `carbs must be >= 0 for ${item.id}`);
            assert.ok(item.macros.fat >= 0, `fat must be >= 0 for ${item.id}`);
        }
    });
    (0, node_test_1.it)('has unique ids', () => {
        const ids = food_library_js_1.foodLibrary.map((f) => f.id);
        assert.equal(new Set(ids).size, ids.length);
    });
});
(0, node_test_1.describe)('exerciseLibrary', () => {
    (0, node_test_1.it)('has at least 10 items', () => {
        assert.ok(exercise_library_js_1.exerciseLibrary.length >= 10);
    });
    (0, node_test_1.it)('every item has positive calorie burn rate', () => {
        for (const item of exercise_library_js_1.exerciseLibrary) {
            assert.ok(item.id.length > 0, `missing id`);
            assert.ok(item.name.length > 0, `missing name for ${item.id}`);
            assert.ok(item.caloriesPerMinute > 0, `burn rate must be positive for ${item.id}`);
            assert.ok(['cardio', 'strength', 'flexibility'].includes(item.category), `invalid category for ${item.id}`);
        }
    });
    (0, node_test_1.it)('has unique ids', () => {
        const ids = exercise_library_js_1.exerciseLibrary.map((e) => e.id);
        assert.equal(new Set(ids).size, ids.length);
    });
});
