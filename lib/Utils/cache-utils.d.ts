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
import type { ILogger } from './logger.js';
/**
 * Cache configuration options
 */
export interface CacheOptions<V> {
    /** Time to live in ms (default: 5 minutes) */
    ttl?: number;
    /** Maximum cache size (default: 1000) */
    maxSize?: number;
    /** Function to calculate item size */
    sizeCalculation?: (value: V) => number;
    /** Whether to update TTL on access */
    updateAgeOnGet?: boolean;
    /** Namespace for isolation */
    namespace?: string;
    /** Callback when item expires */
    onExpire?: (key: string, value: V) => void;
    /** Whether to collect metrics */
    collectMetrics?: boolean;
    /** Cache name for metrics */
    metricName?: string;
}
/**
 * Cache statistics
 */
export interface CacheStats {
    hits: number;
    misses: number;
    size: number;
    maxSize: number;
    hitRate: number;
}
/**
 * Cache item with metadata
 */
export interface CacheItem<V> {
    value: V;
    createdAt: number;
    expiresAt: number;
    accessCount: number;
    lastAccess: number;
}
/**
 * Cache operation result
 */
export interface CacheResult<V> {
    value: V | undefined;
    hit: boolean;
    expired?: boolean;
    key: string;
}
/**
 * Main Cache class
 */
export declare class Cache<V = unknown> {
    private cache;
    private options;
    private stats;
    private namespace;
    constructor(options?: CacheOptions<V>);
    /**
     * Get value from cache
     */
    get(key: string): V | undefined;
    /**
     * Get value with detailed result
     */
    getWithResult(key: string): CacheResult<V>;
    /**
     * Set value in cache
     */
    set(key: string, value: V, ttl?: number): void;
    /**
     * Check if key exists
     */
    has(key: string): boolean;
    /**
     * Remove item from cache
     */
    delete(key: string): boolean;
    /**
     * Clear the entire cache
     */
    clear(): void;
    /**
     * Get or set value (cache-aside pattern)
     */
    getOrSet(key: string, factory: () => V | Promise<V>, ttl?: number): Promise<V>;
    /**
     * Get or set value synchronously
     */
    getOrSetSync(key: string, factory: () => V, ttl?: number): V;
    /**
     * Invalidate items by pattern
     */
    invalidateByPattern(pattern: RegExp): number;
    /**
     * Invalidate items by prefix
     */
    invalidateByPrefix(prefix: string): number;
    /**
     * Return cache statistics
     */
    getStats(): CacheStats;
    /**
     * Return current size
     */
    get size(): number;
    /**
     * Return all keys
     */
    keys(): string[];
    /**
     * Return all values
     */
    values(): V[];
    /**
     * Return all items with metadata
     */
    entries(): Array<{
        key: string;
        item: CacheItem<V>;
    }>;
    /**
     * Update TTL of an item
     */
    touch(key: string, ttl?: number): boolean;
    /**
     * Get expired item (if still in memory)
     */
    peek(key: string): V | undefined;
    private getFullKey;
}
/**
 * Factory to create typed cache
 */
export declare function createCache<V>(options?: CacheOptions<V>): Cache<V>;
/**
 * Multi-level cache (L1: memory, L2: external)
 */
export declare class MultiLevelCache<V> {
    private l1;
    private l2?;
    constructor(l1Options: CacheOptions<V>, l2?: {
        get: (key: string) => Promise<V | undefined>;
        set: (key: string, value: V, ttl?: number) => Promise<void>;
        delete: (key: string) => Promise<boolean>;
    });
    get(key: string): Promise<V | undefined>;
    set(key: string, value: V, ttl?: number): Promise<void>;
    delete(key: string): Promise<boolean>;
    getL1(): Cache<V>;
}
/**
 * Decorator to cache method result
 */
export declare function cached<V>(options?: CacheOptions<V> & {
    keyGenerator?: (...args: unknown[]) => string;
}): (_target: unknown, propertyKey: string, descriptor: TypedPropertyDescriptor<(...args: unknown[]) => V | Promise<V>>) => TypedPropertyDescriptor<(...args: unknown[]) => V | Promise<V>>;
/**
 * Wrapper for function with cache
 */
export declare function withCache<T extends (...args: unknown[]) => unknown>(fn: T, options?: CacheOptions<ReturnType<T>> & {
    keyGenerator?: (...args: Parameters<T>) => string;
}): T;
export declare function getGlobalCache<V>(namespace: string, options?: CacheOptions<V>): Cache<V>;
export declare function clearGlobalCaches(): void;
/**
 * Minimal NodeCache-like surface used by {@link safeCacheSet}. Typed loosely
 * so any `@cacheable/node-cache`-compatible adapter satisfies it without
 * forcing the concrete type on every callsite.
 */
export type NodeCacheSetLike<V> = {
    set: (key: string, value: V, ttl?: number) => unknown | Promise<unknown>;
};
/**
 * Returns true when an error from `@cacheable/node-cache` `.set()` indicates
 * cache saturation (`maxKeys` hit). Exported so other modules can guard their
 * own `try { cache.set(...) } catch (e) { if (!isNodeCacheFullError(e)) throw e }`
 * blocks without duplicating the token list.
 */
export declare const isNodeCacheFullError: (err: unknown) => boolean;
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
export declare function safeCacheSet<V>(cache: NodeCacheSetLike<V>, key: string, value: V, logger?: ILogger, context?: string): Promise<void>;
export default Cache;
//# sourceMappingURL=cache-utils.d.ts.map