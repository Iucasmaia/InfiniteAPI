/**
 * Phase 9.2 — `NodeCache`-shaped adapter backed by `user_device(_info)` so
 * the existing `userDevicesCache` plumbing in `messages-send.ts` /
 * `messages-recv.ts` keeps working unchanged when the multi-DB SQLite
 * store is wired up via `SocketConfig.multiDbStore`.
 *
 * Why a NodeCache-shaped wrapper instead of swapping every call site to
 * the typed {@link UserDeviceBackend}? The existing code threads
 * `userDevicesCache` through 12+ files (cache.del, cache.set, cache.get,
 * cache.mget). Rewriting all of them to a typed API is a much bigger
 * change than this PR can absorb without risk. The adapter preserves the
 * exact shape (incl. async-or-sync return contract) and stores devices
 * as JSON in `user_device_cache_json` — a small auxiliary table on
 * `msgstore.db` that keeps the typed `user_device` tables free for the
 * eventual full typed split (phase 9.2.1).
 *
 * Behavior preserved:
 *   - 5-minute default TTL via the auxiliary table's `expires_at` column
 *     (the typed `user_device_info.expected_timestamp` column stays
 *     reserved for the typed split in phase 9.2.1)
 *   - `set` replaces previous entry atomically
 *   - `del` removes the entry
 *   - `mget` returns a `Record<user, devices>` for the requested users
 *     using a single batched `SELECT ... WHERE user_jid IN (...)`
 *
 * Behavior NOT preserved (intentional):
 *   - keyspace size limit / LRU eviction. SQLite WAL grows as needed;
 *     `pruneExpired` should be called periodically by the host process
 *     (an opt-in `runPruneTickerEverySeconds` constructor option does
 *     this automatically).
 */
import { prepareInClause } from './in-statement-cache.js';
import { resolveExpiresAt } from './ttl-utils.js';
// `user_device_cache_json` is owned by `schemas/msgstore.ts` so it goes
// through the same migration bookkeeping as the rest of the multi-DB
// store. The adapter assumes the table already exists (MultiDbSqliteStore
// has opened msgstore.db and run its schema by the time this adapter is
// constructed).
const FLUSH_ALL_SQL = 'DELETE FROM user_device_cache_json';
/**
 * SQLite-backed `userDevicesCache`. Drop-in replacement for the NodeCache
 * the gateway uses by default; activate by passing
 * `SocketConfig.userDevicesCache = new UserDeviceCacheSqliteAdapter(...)`.
 */
export class UserDeviceCacheSqliteAdapter {
    constructor(db, opts = {}) {
        this.db = db;
        this.defaultTtlMs = (opts.defaultTtlSeconds ?? 5 * 60) * 1000;
        this.stmts = {
            select: this.db.prepare('SELECT devices_json, expires_at FROM user_device_cache_json WHERE user_jid = ?'),
            upsert: this.db.prepare('INSERT INTO user_device_cache_json (user_jid, devices_json, expires_at) VALUES (?, ?, ?) ' +
                'ON CONFLICT(user_jid) DO UPDATE SET devices_json = excluded.devices_json, expires_at = excluded.expires_at'),
            del: this.db.prepare('DELETE FROM user_device_cache_json WHERE user_jid = ?'),
            prune: this.db.prepare('DELETE FROM user_device_cache_json WHERE expires_at <= ?'),
            flushAll: this.db.prepare(FLUSH_ALL_SQL)
        };
        this.mgetQuery = prepareInClause(this.db, 'SELECT user_jid, devices_json, expires_at FROM user_device_cache_json WHERE user_jid IN (', ')');
        this.mDelQuery = prepareInClause(this.db, 'DELETE FROM user_device_cache_json WHERE user_jid IN (', ')');
        if (opts.runPruneTickerEverySeconds && opts.runPruneTickerEverySeconds > 0) {
            // The try/catch is not paranoia: when the host process calls
            // `MultiDbSqliteStore.close()` BEFORE the adapter's own `close()`,
            // the underlying db handle is gone but this interval may already be
            // armed for its next fire. The synchronous `stmt.run` then throws
            // `"The database connection is not open"` from inside the timer
            // callback, where there is no caller to catch it — Node surfaces
            // it as an unhandled exception and the process crashes on
            // teardown. Swallowing it here is correct because by the time the
            // db is closed there is nothing meaningful to prune anyway.
            this.pruneTicker = setInterval(() => {
                try {
                    this.pruneExpired();
                }
                catch {
                    /* db handle already closed by host shutdown — nothing to prune */
                }
            }, opts.runPruneTickerEverySeconds * 1000);
            if (typeof this.pruneTicker.unref === 'function')
                this.pruneTicker.unref();
        }
    }
    get(key) {
        const row = this.stmts.select.get(key);
        if (!row)
            return undefined;
        if (row.expires_at <= Date.now()) {
            // Lazy expiry — swallow SQLITE_BUSY so the lookup still reports a
            // clean miss to the caller. NodeCache's `get()` never throws and
            // this adapter is a drop-in replacement; surfacing a busy-error
            // here breaks `messages-recv.ts`'s `incrementRetryAndGet` path
            // which expects `undefined | number`, not an exception.
            try {
                this.stmts.del.run(key);
            }
            catch {
                /* lazy expiry only — leave the stale row for the prune ticker */
            }
            return undefined;
        }
        // Robustness: a corrupted/tampered devices_json row must not crash the
        // message pipeline. NodeCache returns `undefined` for missing entries
        // and we mirror that here — drop the bad row and report a cache miss
        // so the caller falls back to its refetch path naturally.
        try {
            return JSON.parse(row.devices_json);
        }
        catch {
            this.stmts.del.run(key);
            return undefined;
        }
    }
    set(key, value, ttl) {
        const expiresAt = resolveExpiresAt(ttl, this.defaultTtlMs);
        this.stmts.upsert.run(key, JSON.stringify(value), expiresAt);
        return true;
    }
    del(key) {
        const keys = Array.isArray(key) ? key : [key];
        // Fast path for the common single-key case (every NodeCache caller in
        // messages-recv.ts passes one key) — avoids a BEGIN IMMEDIATE /
        // COMMIT round-trip and the closure allocation for a single DELETE.
        if (keys.length === 1)
            return this.stmts.del.run(keys[0]).changes;
        // Reducer-based counter — see msg-retry-counter-adapter.ts for the
        // rationale (closure-mutation would double-count under a future
        // retry-wrapped transaction).
        const tx = this.db.transaction((batch) => batch.reduce((acc, k) => acc + this.stmts.del.run(k).changes, 0));
        return tx(keys);
    }
    async mget(keys) {
        const out = {};
        if (keys.length === 0)
            return out;
        // Cached IN-clause statements (`mgetQuery` + `mDelQuery`) replace
        // what previously was ad-hoc `db.prepare()` per chunk. `prepareInClause`
        // caches by placeholder count, so the hot path pays at most one
        // compilation per unique chunk size (default chunk 500 → 1 cache
        // entry covers 99% of calls). Stops the gradual native-memory
        // growth that the per-call prepare pattern caused.
        const now = Date.now();
        const staleKeys = [];
        const rows = this.mgetQuery.all([], keys);
        for (const r of rows) {
            if (r.expires_at <= now) {
                staleKeys.push(r.user_jid);
                continue;
            }
            try {
                out[r.user_jid] = JSON.parse(r.devices_json);
            }
            catch {
                // Corrupted JSON — drop the row, report a miss for this key.
                staleKeys.push(r.user_jid);
            }
        }
        // Use `.run()` (not `.all()`) — the previous `.all()` worked at runtime
        // but discarded the changes count and was semantically wrong for a
        // DELETE statement. The change is invisible to callers (mget()'s
        // return type doesn't expose deletion stats) but matches the SQLite
        // statement-type contract.
        if (staleKeys.length > 0)
            this.mDelQuery.run([], staleKeys);
        return out;
    }
    /** Removes every entry whose `expires_at` has passed. Returns rows pruned. */
    pruneExpired(now = Date.now()) {
        const r = this.stmts.prune.run(now);
        return r.changes;
    }
    /**
     * Required by `SocketConfig.userDevicesCache` (which is typed
     * `PossiblyExtendedCacheStore` and extends `CacheStore`). Wipes every
     * cached entry — used on socket close so a fresh reconnect starts with
     * no stale device assumptions.
     */
    flushAll() {
        this.stmts.flushAll.run();
    }
    /** Stops the background prune ticker, if one was scheduled. */
    close() {
        if (this.pruneTicker) {
            clearInterval(this.pruneTicker);
            this.pruneTicker = undefined;
        }
    }
}
//# sourceMappingURL=user-device-cache-adapter.js.map