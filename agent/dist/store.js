"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Collection = void 0;
exports.createStore = createStore;
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)({ name: 'agent-store' });
// ---------------------------------------------------------------------------
// Generic typed collection wrapping a Map
// ---------------------------------------------------------------------------
class Collection {
    items;
    collectionName;
    constructor(name) {
        this.items = new Map();
        this.collectionName = name;
    }
    resolveKey(item) {
        const key = item.id ?? item.key;
        if (typeof key !== 'string' || key.length === 0) {
            throw new Error(`Item in collection "${this.collectionName}" must have a non-empty id or key`);
        }
        return key;
    }
    /** Insert or replace an item. Returns the item. */
    set(item) {
        const key = this.resolveKey(item);
        this.items.set(key, item);
        logger.debug({ collection: this.collectionName, key }, 'item set');
        return item;
    }
    /** Retrieve an item by key. Returns undefined if not found. */
    get(key) {
        return this.items.get(key);
    }
    /** Check whether a key exists. */
    has(key) {
        return this.items.has(key);
    }
    /** Delete an item by key. Returns true if the item existed. */
    delete(key) {
        const existed = this.items.delete(key);
        if (existed) {
            logger.debug({ collection: this.collectionName, key }, 'item deleted');
        }
        return existed;
    }
    /** Return all items as an array. */
    getAll() {
        return Array.from(this.items.values());
    }
    /** Number of items in the collection. */
    get size() {
        return this.items.size;
    }
    /** Remove all items from the collection. */
    clear() {
        this.items.clear();
        logger.debug({ collection: this.collectionName }, 'collection cleared');
    }
}
exports.Collection = Collection;
/** Create a fresh in-memory store with empty collections. */
function createStore() {
    logger.info('creating in-memory store');
    return {
        meals: new Collection('meals'),
        workouts: new Collection('workouts'),
        settings: new Collection('settings'),
    };
}
//# sourceMappingURL=store.js.map