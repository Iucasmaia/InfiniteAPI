/**
 * Helper that caches prepared statements with `IN (?, ?, …)` clauses per
 * chunk size. `better-sqlite3` does NOT cache prepared statements, and
 * unfinalized statements pin native memory until the V8 GC reaps the JS
 * wrapper — calling `db.prepare(sql)` on every batch lookup leaks memory
 * progressively on hot paths.
 *
 * The cache keys on the number of placeholders. In practice we always
 * chunk to a fixed size (default 500) and the cache holds at most two
 * entries: the "full chunk" statement (used 99% of the time) and one
 * "tail chunk" statement of the remainder size.
 *
 * Usage:
 *   const inQuery = prepareInClause(
 *     db,
 *     'SELECT id, value FROM signal_kv WHERE type = ? AND id IN (',
 *     ') ORDER BY id',
 *     500
 *   )
 *   const rows = inQuery.run(['session'], [id1, id2, …]) // first arg = leading params before IN
 */
import type { SqliteDbLike } from './types.js';
/** SQLite default `SQLITE_LIMIT_VARIABLE_NUMBER` is 999. We chunk well below it. */
export declare const DEFAULT_IN_CHUNK = 500;
export interface InClauseQuery {
    /**
     * Executes the query over `inValues`, chunking at `chunkSize` (default
     * 500). `leadingParams` are bound BEFORE the IN-list placeholders for
     * every chunk. The returned rows are concatenated in chunk order.
     */
    all(leadingParams: ReadonlyArray<unknown>, inValues: ReadonlyArray<unknown>): unknown[];
    /**
     * Same as `all()` but uses `stmt.run()` and returns the total `changes`
     * across every chunk. For INSERT/UPDATE/DELETE statements — calling
     * `.all()` works at runtime but is semantically wrong (DELETE has no
     * rows to "iterate") and discards the `changes` count callers might
     * want for metrics or assertions.
     */
    run(leadingParams: ReadonlyArray<unknown>, inValues: ReadonlyArray<unknown>): number;
}
export declare function prepareInClause(db: SqliteDbLike, sqlBeforeIn: string, sqlAfterIn: string, chunkSize?: number): InClauseQuery;
//# sourceMappingURL=in-statement-cache.d.ts.map