export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: any, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
}

export class InMemoryCacheService implements ICacheService {
  private cache = new Map<string, { value: any; expiry: number | null }>();

  async get<T>(key: string): Promise<T | null> {
    const item = this.cache.get(key);
    if (!item) return null;

    if (item.expiry && item.expiry < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return item.value as T;
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const expiry = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.cache.set(key, { value, expiry });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }
}

// Global cache service instance
let cacheServiceInstance: ICacheService;

export function getCacheService(): ICacheService {
  if (!cacheServiceInstance) {
    const enableRedis = process.env.ENABLE_REDIS === 'true';
    if (enableRedis) {
      console.log('[CacheService] Redis requested (ENABLE_REDIS=true). Trying to initialize Redis cache...');
      try {
        // If they decide to enable Redis in the future, we can load a Redis implementation here dynamically.
        // For Phase 1 prototype, we default to InMemoryCacheService safely.
        console.log('[CacheService] Using in-memory fallback since Redis client is deferred for Phase 1.');
        cacheServiceInstance = new InMemoryCacheService();
      } catch (e) {
        console.error('[CacheService] Failed to load Redis cache, falling back to in-memory:', e);
        cacheServiceInstance = new InMemoryCacheService();
      }
    } else {
      console.log('[CacheService] Using InMemoryCacheService (Redis is disabled).');
      cacheServiceInstance = new InMemoryCacheService();
    }
  }
  return cacheServiceInstance;
}
