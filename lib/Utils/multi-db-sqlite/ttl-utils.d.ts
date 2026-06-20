/**
 * NodeCache-style TTL helpers shared between
 * `UserDeviceCacheSqliteAdapter` and `MsgRetryCounterSqliteAdapter`.
 *
 * Extracted from those adapters to avoid duplicating the (regex + unit)
 * parsing logic, and to give both adapters a single source of truth for
 * the `NO_EXPIRY_SENTINEL` semantics.
 */
/**
 * Year-9999 in epoch milliseconds. Used as `expires_at` for entries
 * written with `ttl=0` (NodeCache convention for "never expire"). A fixed
 * far-future value keeps the `expires_at` column NOT NULL and the read
 * path simple: `expires_at <= Date.now()` returns false until well past
 * any realistic runtime, while bookkeeping (pruneExpired) still treats
 * the row as live.
 */
export declare const NO_EXPIRY_SENTINEL = 253402300799000;
/**
 * Parses a NodeCache-style TTL string (`'35m'`, `'1h'`, `'30s'`, `'1d'`,
 * or a bare number like `'90'` meaning seconds) into milliseconds.
 * Returns `null` if the input is not a recognised shape so the caller
 * can fall back to its default TTL.
 */
export declare function parseTtlString(ttl: string): number | null;
/**
 * Resolves the TTL argument to an absolute `expires_at` (epoch ms),
 * applying the NodeCache conventions:
 *
 *   - `undefined` → `defaultTtlMs` from now
 *   - `0` (number) → `NO_EXPIRY_SENTINEL` (never expire)
 *   - other number → seconds, added to now
 *   - string `"35m"`, `"1h"`, etc. → parsed via `parseTtlString`; falls
 *     back to `defaultTtlMs` on malformed input (mirrors NodeCache's own
 *     defensive behaviour)
 */
export declare function resolveExpiresAt(ttl: number | string | undefined, defaultTtlMs: number, now?: number): number;
//# sourceMappingURL=ttl-utils.d.ts.map