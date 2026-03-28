import pino from 'pino';

const logger = pino({ name: 'agent-store' });

// ---------------------------------------------------------------------------
// Data interfaces
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Generic typed collection wrapping a Map
// ---------------------------------------------------------------------------

export class Collection<T extends { id?: string; key?: string }> {
  private readonly items: Map<string, T>;
  private readonly collectionName: string;

  constructor(name: string) {
    this.items = new Map();
    this.collectionName = name;
  }

  private resolveKey(item: T): string {
    const key = (item as Record<string, unknown>).id ?? (item as Record<string, unknown>).key;
    if (typeof key !== 'string' || key.length === 0) {
      throw new Error(`Item in collection "${this.collectionName}" must have a non-empty id or key`);
    }
    return key;
  }

  /** Insert or replace an item. Returns the item. */
  set(item: T): T {
    const key = this.resolveKey(item);
    this.items.set(key, item);
    logger.debug({ collection: this.collectionName, key }, 'item set');
    return item;
  }

  /** Retrieve an item by key. Returns undefined if not found. */
  get(key: string): T | undefined {
    return this.items.get(key);
  }

  /** Check whether a key exists. */
  has(key: string): boolean {
    return this.items.has(key);
  }

  /** Delete an item by key. Returns true if the item existed. */
  delete(key: string): boolean {
    const existed = this.items.delete(key);
    if (existed) {
      logger.debug({ collection: this.collectionName, key }, 'item deleted');
    }
    return existed;
  }

  /** Return all items as an array. */
  getAll(): T[] {
    return Array.from(this.items.values());
  }

  /** Number of items in the collection. */
  get size(): number {
    return this.items.size;
  }

  /** Remove all items from the collection. */
  clear(): void {
    this.items.clear();
    logger.debug({ collection: this.collectionName }, 'collection cleared');
  }
}

// ---------------------------------------------------------------------------
// Store – holds the three named collections
// ---------------------------------------------------------------------------

export interface Store {
  meals: Collection<Meal>;
  workouts: Collection<Workout>;
  settings: Collection<Setting>;
}

/** Create a fresh in-memory store with empty collections. */
export function createStore(): Store {
  logger.info('creating in-memory store');
  return {
    meals: new Collection<Meal>('meals'),
    workouts: new Collection<Workout>('workouts'),
    settings: new Collection<Setting>('settings'),
  };
}
