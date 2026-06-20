import type { SqliteDbLike } from './types.js';
declare const REVERSE_SUFFIX = "_reverse";
/**
 * Lower-level operations on `msgstore.db` (`jid` + `jid_map`) for the
 * LID↔PN mapping use case. Designed so consumers other than the legacy
 * `LIDMappingStore` can also call directly (e.g. introspection, migration,
 * device-list refresh tooling).
 */
export declare class JidMapBackend {
    private readonly stmts;
    private readonly db;
    /**
     * Cached `IN (…)` queries for the batch lookups. `prepareInClause`
     * holds at most two prepared statements per query (full chunk + one
     * trailing chunk) so the hot path doesn't pay `db.prepare()` per call.
     * Without this, every `LIDMappingStore.batchResolvePn()` call (~100
     * recipients) compiled a brand-new statement that leaked native memory
     * until V8 collected the JS wrapper.
     *
     * Uses SQLite window functions (`ROW_NUMBER() OVER PARTITION BY`) for
     * the PN→LID "most recent" pick — eliminates the correlated subquery
     * the previous version had (which scanned the table per row).
     */
    private readonly batchLidForPnQuery;
    private readonly batchPnForLidQuery;
    constructor(db: SqliteDbLike);
    /**
     * Upserts the JID row and returns its `_id`.
     *
     * Wrapped in a transaction so the `INSERT ... ON CONFLICT DO NOTHING` +
     * subsequent `SELECT _id` are atomic against any concurrent writer.
     * Without the transaction, a deletion landing between the two
     * statements would surface the row as "not materialized" and the
     * caller would see a misleading `failed to materialize jid row` error.
     * The `jid` table is not deleted by today's code paths, so this is
     * defensive — but cheap enough to keep the invariant explicit.
     */
    private rowIdFor;
    /**
     * Stores a single PN↔LID mapping. Idempotent.
     *
     * Wrapped in a transaction so the three operations (materialise LID row,
     * materialise PN row, upsert the map row) commit or roll back together.
     * Without the outer transaction a crash between `rowIdFor(lidUser)` and
     * `upsertMap.run()` would leave a freshly-inserted `jid` row with no
     * matching `jid_map` entry — silently orphaned and never garbage-
     * collected (nothing in the code path deletes orphan jid rows). When
     * called from `storeMappingsBatch` the outer wrapper is nested with
     * this one, which better-sqlite3 promotes to a SAVEPOINT — still safe.
     */
    storeMapping(pnUser: string, lidUser: string): void;
    /** Stores N mappings atomically (single transaction). */
    storeMappingsBatch(pairs: Array<{
        pnUser: string;
        lidUser: string;
    }>): void;
    /**
     * Removes a PN↔LID mapping. Idempotent — silently no-ops when the row
     * does not exist.
     *
     * Identified by the `lidUser` side (the mapping is keyed by `lid_row_id`
     * in `jid_map`), matching the Signal protocol semantics where setting a
     * `lid-mapping` value to `null` is a delete request. Without this, every
     * delete request through `wrapKeysWithJidMap` was silently dropped while
     * the inner store still emitted DELETEs — drifting jid_map until the
     * stale mapping was overwritten by a fresh `storeMapping` call.
     * (audit P1-SQDB-02)
     */
    deleteMapping(lidUser: string): void;
    /** Returns the LID for a PN, or `null` if no mapping exists. */
    getLidForPn(pnUser: string): string | null;
    /**
     * Returns ALL LIDs ever mapped to this PN, newest first. WhatsApp links
     * new device-LIDs over a contact's lifetime, so `jid_map` can hold N
     * rows for one PN. `getLidForPn` returns only the most-recent (highest
     * `sort_id`); for a delete request we need every row so historical
     * mappings don't resurrect via `inner.get` fallback. (audit MDB-01)
     */
    getAllLidsForPn(pnUser: string): string[];
    /** Returns the PN for a LID, or `null` if no mapping exists. */
    getPnForLid(lidUser: string): string | null;
    /**
     * Batch lookup: input list of PNs → record of those that resolved. Uses
     * a single `IN (?, ?, ...)` SELECT per chunk so the LIDMappingStore's
     * default batchSize=100 call from `keys.get('lid-mapping', batch)` lands
     * as one DB round-trip instead of N. Chunked at 500 to stay well below
     * SQLite's default 999-variable limit.
     */
    batchGetLidForPn(pnUsers: string[]): Record<string, string>;
    /** Batch lookup: input list of LIDs → record of those that resolved. */
    batchGetPnForLid(lidUsers: string[]): Record<string, string>;
}
/**
 * Returns the raw LID (strips trailing `_reverse` suffix used by
 * LIDMappingStore as a lookup key convention).
 */
export declare function stripReverse(key: string): {
    lidUser: string;
    isReverse: boolean;
};
export { REVERSE_SUFFIX };
//# sourceMappingURL=lid-mapping-backend.d.ts.map