import type { SqliteDbLike } from './types.js';
export type NodeCacheCompatibleEntry = unknown;
/**
 * Minimal subset of `node-cache`'s API that the InfiniteAPI message
 * pipeline calls. The cache used in `messages-send.ts` accesses:
 *   - `get<T>(key)`     — read one entry
 *   - `set(key, value)` — write one entry
 *   - `del(key)`        — delete one entry
 *   - `mget(keys)`      — bulk read
 *
 * All methods are sync in `node-cache`; the existing call sites
 * `await` the return value, which is harmless for sync values.
 */
export interface NodeCacheLike {
    get<T = NodeCacheCompatibleEntry>(key: string): T | undefined;
    set(key: string, value: NodeCacheCompatibleEntry, ttl?: number | string): boolean;
    del(key: string | string[]): number;
    /**
     * `mget` returns a Promise to be assignable to
     * `PossiblyExtendedCacheStore.mget` (which is async). The implementation
     * stays synchronous internally — we just wrap the resolved value in
     * `Promise.resolve()` at the boundary so TypeScript is happy when a
     * consumer writes `userDevicesCache: new UserDeviceCacheSqliteAdapter(...)`
     * against `SocketConfig`.
     */
    mget<T = NodeCacheCompatibleEntry>(keys: string[]): Promise<Record<string, T | undefined>>;
    flushAll(): void;
}
export type UserDeviceCacheAdapterOptions = {
    /** Default TTL applied to entries written without an explicit TTL (seconds). */
    defaultTtlSeconds?: number;
    /**
     * If set, schedules a background ticker that calls `pruneExpired` at
     * the given interval (seconds). Defaults to OFF — callers may prefer
     * to control eviction explicitly.
     */
    runPruneTickerEverySeconds?: number;
};
/**
 * SQLite-backed `userDevicesCache`. Drop-in replacement for the NodeCache
 * the gateway uses by default; activate by passing
 * `SocketConfig.userDevicesCache = new UserDeviceCacheSqliteAdapter(...)`.
 */
export declare class UserDeviceCacheSqliteAdapter implements NodeCacheLike {
    private readonly stmts;
    private readonly defaultTtlMs;
    private pruneTicker?;
    private readonly db;
    /** Cached `IN (…)` queries for `mget` (and its companion bulk delete). */
    private readonly mgetQuery;
    private readonly mDelQuery;
    constructor(db: SqliteDbLike, opts?: UserDeviceCacheAdapterOptions);
    get<T = NodeCacheCompatibleEntry>(key: string): T | undefined;
    set(key: string, value: NodeCacheCompatibleEntry, ttl?: number | string): boolean;
    del(key: string | string[]): number;
    mget<T = NodeCacheCompatibleEntry>(keys: string[]): Promise<Record<string, T | undefined>>;
    /** Removes every entry whose `expires_at` has passed. Returns rows pruned. */
    pruneExpired(now?: number): number;
    /**
     * Required by `SocketConfig.userDevicesCache` (which is typed
     * `PossiblyExtendedCacheStore` and extends `CacheStore`). Wipes every
     * cached entry — used on socket close so a fresh reconnect starts with
     * no stale device assumptions.
     */
    flushAll(): void;
    /** Stops the background prune ticker, if one was scheduled. */
    close(): void;
}
//# sourceMappingURL=user-device-cache-adapter.d.ts.map