import pino from 'pino';
import type { Meal, Workout, Settings, ICollection } from './types';

const logger = pino({ name: 'agent-store' });

// ---------------------------------------------------------------------------
// Generic typed collection wrapping a Map
// ---------------------------------------------------------------------------

export class Collection<T> implements ICollection<T> {
  private readonly items: Map<string, T>;
  private readonly collectionName: string;

  constructor(name: string) {
    this.items = new Map();
    this.collectionName = name;
  }

  set(id: string, item: T): T {
    this.items.set(id, item);
    logger.debug({ collection: this.collectionName, key: id }, 'item set');
    return item;
  }

  get(id: string): T | undefined {
    return this.items.get(id);
  }

  has(id: string): boolean {
    return this.items.has(id);
  }

  delete(id: string): boolean {
    const existed = this.items.delete(id);
    if (existed) {
      logger.debug({ collection: this.collectionName, key: id }, 'item deleted');
    }
    return existed;
  }

  list(): T[] {
    return Array.from(this.items.values());
  }

  get size(): number {
    return this.items.size;
  }

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
  settings: Collection<Settings>;
}

export function createStore(): Store {
  logger.info('creating in-memory store');
  return {
    meals: new Collection<Meal>('meals'),
    workouts: new Collection<Workout>('workouts'),
    settings: new Collection<Settings>('settings'),
  };
}
