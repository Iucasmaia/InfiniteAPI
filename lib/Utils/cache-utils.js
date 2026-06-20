/**
 * Smart Cache System
 *
 * Provides:
 * - In-memory cache with configurable TTL
 * - Automatic and manual invalidation
 * - Hit/miss metrics
 * - LRU (Least Recently Used) strategy
 * - Distributed cache (prepared for Redis)
 * - Namespace for isolation
 * - Customizable serialization
 *
 * @module Utils/cache-utils
 */
import { LRUCache } from 'lru-cache';
import { metrics } from './prometheus-metrics.js';
/**
 * Main Cache class
 */
export class Cache {
    constructor(options = {}) {
        this.options = {
            ttl: options.ttl ?? 5 * 60 * 1000, // 5 minutos
            maxSize: options.maxSize ?? 1000,
            sizeCalculation: options.sizeCalculation ?? (() => 1),
            updateAgeOnGet: options.updateAgeOnGet ?? false,
            namespace: options.namespace ?? 'default',
            onExpire: options.onExpire ?? (() => { }),
            collectMetrics: options.collectMetrics ?? true,
            metricName: options.metricName ?? 'cache'
        };
        this.namespace = this.options.namespace;
        this.stats = { hits: 0, misses: 0 };
        this.cache = new LRUCache({
            maxSize: this.options.maxSize,
            ttl: this.options.ttl,
            updateAgeOnGet: this.options.updateAgeOnGet,
            sizeCalculation: item => this.options.sizeCalculation(item.value),
            dispose: (value, key) => {
                this.options.onExpire(key, value.value);
            }
        });
    }
    /**
     * Get value from cache
     */
    get(key) {
        const fullKey = this.getFullKey(key);
        const item = this.cache.get(fullKey);
        if (item) {
            this.stats.hits++;
            item.accessCount++;
            item.lastAccess = Date.now();
            if (this.options.collectMetrics) {
                metrics.cacheHits.inc({ cache: this.options.metricName });
            }
            return item.value;
        }
        this.stats.misses++;
        if (this.options.collectMetrics) {
            metrics.cacheMisses.inc({ cache: this.options.metricName });
        }
        return undefined;
    }
    /**
     * Get value with detailed result
     */
    getWithResult(key) {
        const fullKey = this.getFullKey(key);
        const item = this.cache.get(fullKey);
        if (item) {
            this.stats.hits++;
            item.accessCount++;
            item.lastAccess = Date.now();
            if (this.options.collectMetrics) {
                metrics.cacheHits.inc({ cache: this.options.metricName });
            }
            return {
                value: item.value,
                hit: true,
                key
            };
        }
        this.stats.misses++;
        if (this.options.collectMetrics) {
            metrics.cacheMisses.inc({ cache: this.options.metricName });
        }
        return {
            value: undefined,
            hit: false,
            key
        };
    }
    /**
     * Set value in cache
     */
    set(key, value, ttl) {
        const fullKey = this.getFullKey(key);
        const now = Date.now();
        const itemTtl = ttl ?? this.options.ttl;
        const item = {
            value,
            createdAt: now,
            expiresAt: now + itemTtl,
            accessCount: 0,
            lastAccess: now
        };
        this.cache.set(fullKey, item, { ttl: itemTtl });
        if (this.options.collectMetrics) {
            metrics.cacheSize.set({ cache: this.options.metricName }, this.cache.size);
        }
    }
    /**
     * Check if key exists
     */
    has(key) {
        const fullKey = this.getFullKey(key);
        return this.cache.has(fullKey);
    }
    /**
     * Remove item from cache
     */
    delete(key) {
        const fullKey = this.getFullKey(key);
        const result = this.cache.delete(fullKey);
        if (this.options.collectMetrics) {
            metrics.cacheSize.set({ cache: this.options.metricName }, this.cache.size);
        }
        return result;
    }
    /**
     * Clear the entire cache
     */
    clear() {
        this.cache.clear();
        this.stats = { hits: 0, misses: 0 };
        if (this.options.collectMetrics) {
            metrics.cacheSize.set({ cache: this.options.metricName }, 0);
        }
    }
    /**
     * Get or set value (cache-aside pattern)
     */
    async getOrSet(key, factory, ttl) {
        const existing = this.get(key);
        if (existing !== undefined) {
            return existing;
        }
        const value = await factory();
        this.set(key, value, ttl);
        return value;
    }
    /**
     * Get or set value synchronously
     */
    getOrSetSync(key, factory, ttl) {
        const existing = this.get(key);
        if (existing !== undefined) {
            return existing;
        }
        const value = factory();
        this.set(key, value, ttl);
        return value;
    }
    /**
     * Invalidate items by pattern
     */
    invalidateByPattern(pattern) {
        let count = 0;
        const prefix = `${this.namespace}:`;
        for (const key of this.cache.keys()) {
            const shortKey = key.startsWith(prefix) ? key.slice(prefix.length) : key;
            if (pattern.test(shortKey)) {
                this.cache.delete(key);
                count++;
            }
        }
        if (this.options.collectMetrics) {
            metrics.cacheSize.set({ cache: this.options.metricName }, this.cache.size);
        }
        return count;
    }
    /**
     * Invalidate items by prefix
     */
    invalidateByPrefix(prefix) {
        return this.invalidateByPattern(new RegExp(`^${prefix}`));
    }
    /**
     * Return cache statistics
     */
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        return {
            hits: this.stats.hits,
            misses: this.stats.misses,
            size: this.cache.size,
            maxSize: this.options.maxSize,
            hitRate: total > 0 ? this.stats.hits / total : 0
        };
    }
    /**
     * Return current size
     */
    get size() {
        return this.cache.size;
    }
    /**
     * Return all keys
     */
    keys() {
        const prefix = `${this.namespace}:`;
        return Array.from(this.cache.keys()).map(k => (k.startsWith(prefix) ? k.slice(prefix.length) : k));
    }
    /**
     * Return all values
     */
    values() {
        return Array.from(this.cache.values()).map(item => item.value);
    }
    /**
     * Return all items with metadata
     */
    entries() {
        const prefix = `${this.namespace}:`;
        return Array.from(this.cache.entries()).map(([key, item]) => ({
            key: key.startsWith(prefix) ? key.slice(prefix.length) : key,
            item
        }));
    }
    /**
     * Update TTL of an item
     */
    touch(key, ttl) {
        const fullKey = this.getFullKey(key);
        const item = this.cache.get(fullKey);
        if (!item) {
            return false;
        }
        const newTtl = ttl ?? this.options.ttl;
        item.expiresAt = Date.now() + newTtl;
        this.cache.set(fullKey, item, { ttl: newTtl });
        return true;
    }
    /**
     * Get expired item (if still in memory)
     */
    peek(key) {
        const fullKey = this.getFullKey(key);
        const item = this.cache.peek(fullKey);
        return item?.value;
    }
    getFullKey(key) {
        return `${this.namespace}:${key}`;
    }
}
/**
 * Factory to create typed cache
 */
export function createCache(options) {
    return new Cache(options);
}
/**
 * Multi-level cache (L1: memory, L2: external)
 */
export class MultiLevelCache {
    constructor(l1Options, l2) {
        this.l1 = new Cache(l1Options);
        this.l2 = l2;
    }
    async get(key) {
        // Try L1 first
        const l1Value = this.l1.get(key);
        if (l1Value !== undefined) {
            return l1Value;
        }
        // Try L2 if available
        if (this.l2) {
            const l2Value = await this.l2.get(key);
            if (l2Value !== undefined) {
                // Promote to L1
                this.l1.set(key, l2Value);
                return l2Value;
            }
        }
        return undefined;
    }
    async set(key, value, ttl) {
        this.l1.set(key, value, ttl);
        if (this.l2) {
            await this.l2.set(key, value, ttl);
        }
    }
    async delete(key) {
        const l1Result = this.l1.delete(key);
        let l2Result = false;
        if (this.l2) {
            l2Result = await this.l2.delete(key);
        }
        return l1Result || l2Result;
    }
    getL1() {
        return this.l1;
    }
}
/**
 * Decorator to cache method result
 */
export function cached(options = {}) {
    const cache = new Cache(options);
    const keyGenerator = options.keyGenerator ?? ((...args) => JSON.stringify(args));
    return function (_target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        if (!originalMethod)
            return descriptor;
        descriptor.value = async function (...args) {
            const key = `${propertyKey}:${keyGenerator(...args)}`;
            const cachedValue = cache.get(key);
            if (cachedValue !== undefined) {
                return cachedValue;
            }
            const result = await originalMethod.apply(this, args);
            cache.set(key, result);
            return result;
        };
        return descriptor;
    };
}
/**
 * Wrapper for function with cache
 */
// eslint-disable-next-line space-before-function-paren
export function withCache(fn, options = {}) {
    const cache = new Cache(options);
    const keyGenerator = options.keyGenerator ?? ((...args) => JSON.stringify(args));
    return ((...args) => {
        const key = keyGenerator(...args);
        const cachedValue = cache.get(key);
        if (cachedValue !== undefined) {
            return cachedValue;
        }
        const result = fn(...args);
        if (result instanceof Promise) {
            return result.then(value => {
                cache.set(key, value);
                return value;
            });
        }
        cache.set(key, result);
        return result;
    });
}
/**
 * Global singleton cache by namespace
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalCaches = new Map();
export function getGlobalCache(namespace, options) {
    if (!globalCaches.has(namespace)) {
        globalCaches.set(namespace, new Cache({ ...options, namespace }));
    }
    return globalCaches.get(namespace);
}
export function clearGlobalCaches() {
    for (const cache of globalCaches.values()) {
        cache.clear();
    }
    globalCaches.clear();
}
const NODE_CACHE_FULL_TOKENS = ['max keys', 'ECACHEFULL'];
/**
 * Returns true when an error from `@cacheable/node-cache` `.set()` indicates
 * cache saturation (`maxKeys` hit). Exported so other modules can guard their
 * own `try { cache.set(...) } catch (e) { if (!isNodeCacheFullError(e)) throw e }`
 * blocks without duplicating the token list.
 */
export const isNodeCacheFullError = (err) => {
    const msg = err?.message ?? '';
    return NODE_CACHE_FULL_TOKENS.some(t => msg.includes(t));
};
/**
 * Safe wrapper around `@cacheable/node-cache` `NodeCache.set()` for advisory
 * caches with a configured `maxKeys` limit.
 *
 * Background — `@cacheable/node-cache` v2.x diverges from the classic
 * `node-cache`: when `maxKeys` is reached, `.set()` THROWS
 * `"Cache max keys amount exceeded"` (or `ECACHEFULL` in some paths)
 * instead of silently evicting an entry. See dist/cacheable-node-cache.cjs
 * line 278 in v2.0.1.
 *
 * Most cache writes in this codebase are advisory — durable correctness is
 * held by SQLite / auth state / recomputation. Dropping a write when the
 * cache is full is preferable to crashing the caller and tearing down the
 * socket. This helper centralizes that swallowing pattern so each callsite
 * doesn't repeat the try/catch boilerplate (audit BOT-001-B).
 *
 * Any error that is NOT the maxKeys/ECACHEFULL exception is rethrown
 * unchanged — only the cache-saturation case is swallowed.
 *
 * @param cache the NodeCache-like instance
 * @param key cache key
 * @param value value to store
 * @param logger optional logger (debug entry on saturation)
 * @param context optional label included in the debug log so multiple
 *                callsites sharing a logger can be told apart
 */
export async function safeCacheSet(cache, key, value, logger, context) {
    try {
        await cache.set(key, value);
    }
    catch (err) {
        if (!isNodeCacheFullError(err)) {
            throw err;
        }
        logger?.debug({ key, context }, 'cache full, skipping write (durable store unaffected)');
    }
}
export default Cache;
//# sourceMappingURL=cache-utils.js.map