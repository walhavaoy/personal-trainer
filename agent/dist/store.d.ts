export interface Meal {
    id: string;
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    timestamp: number;
}
export interface Workout {
    id: string;
    name: string;
    durationMinutes: number;
    caloriesBurned: number;
    type: string;
    timestamp: number;
}
export interface Setting {
    key: string;
    value: string | number | boolean;
    updatedAt: number;
}
export declare class Collection<T extends {
    id?: string;
    key?: string;
}> {
    private readonly items;
    private readonly collectionName;
    constructor(name: string);
    private resolveKey;
    /** Insert or replace an item. Returns the item. */
    set(item: T): T;
    /** Retrieve an item by key. Returns undefined if not found. */
    get(key: string): T | undefined;
    /** Check whether a key exists. */
    has(key: string): boolean;
    /** Delete an item by key. Returns true if the item existed. */
    delete(key: string): boolean;
    /** Return all items as an array. */
    getAll(): T[];
    /** Number of items in the collection. */
    get size(): number;
    /** Remove all items from the collection. */
    clear(): void;
}
export interface Store {
    meals: Collection<Meal>;
    workouts: Collection<Workout>;
    settings: Collection<Setting>;
}
/** Create a fresh in-memory store with empty collections. */
export declare function createStore(): Store;
//# sourceMappingURL=store.d.ts.map