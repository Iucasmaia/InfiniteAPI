import type { SqliteDbLike } from './types.js';
export type MsgRetryCounterAdapterOptions = {
    defaultTtlSeconds?: number;
    runPruneTickerEverySeconds?: number;
};
export interface CacheStoreShape {
    get<T = unknown>(key: string): T | undefined;
    set(key: string, value: unknown, ttl?: number | string): boolean;
    del(key: string | string[]): number;
    flushAll(): void;
}
export declare class MsgRetryCounterSqliteAdapter implements CacheStoreShape {
    private readonly stmts;
    private readonly defaultTtlMs;
    private pruneTicker?;
    private readonly db;
    constructor(db: SqliteDbLike, opts?: MsgRetryCounterAdapterOptions);
    get<T = unknown>(key: string): T | undefined;
    set(key: string, value: unknown, ttl?: number | string): boolean;
    del(key: string | string[]): number;
    pruneExpired(now?: number): number;
    /**
     * Required by `SocketConfig.msgRetryCounterCache` (typed `CacheStore`).
     * Wipes every counter — used on socket close so a reconnect does not
     * inherit stale retry budgets from the previous session lifetime.
     */
    flushAll(): void;
    close(): void;
}
//# sourceMappingURL=msg-retry-counter-adapter.d.ts.map