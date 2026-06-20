import type { AuthenticationState } from '../Types/index.js';
import type { ILogger } from './logger.js';
/**
 * Public configuration shape for {@link useSqliteAuthState}.
 *
 * Codex P1 fix (round-3): `database` is typed `unknown` rather than the
 * internal `Database` alias so this exported type does NOT carry a hard
 * dependency on `better-sqlite3`'s declarations. Consumers who never use
 * SQLite can import baileys' public types without needing
 * `@types/better-sqlite3` resolvable in their project. The runtime
 * expectation is unchanged: pass a `better-sqlite3` `Database` instance.
 */
export type SqliteAuthStateOptions = {
    /**
     * Filesystem path to the SQLite database file. The file will be created if
     * it does not exist. Use `':memory:'` for an in-process ephemeral store
     * (useful in tests).
     */
    dbPath: string;
    /**
     * If supplied, overrides the default `better-sqlite3` import — primarily
     * for tests / advanced consumers that want to inject a pre-opened
     * handle.
     *
     * **Runtime contract**: must be a `better-sqlite3` `Database` instance.
     * Typed as `unknown` here so consumers who don't use SQLite never need
     * to resolve `better-sqlite3` types (the field is cast at the boundary
     * inside the implementation).
     */
    database?: unknown;
    /**
     * Additional `PRAGMA` statements to apply after the defaults. Use this for
     * ops tuning (e.g. `'cache_size = -8000'`, `'mmap_size = 268435456'`)
     * without re-implementing the whole init path. Each entry is passed
     * verbatim to `db.pragma(...)`.
     */
    extraPragmas?: ReadonlyArray<string>;
    /**
     * Optional logger for visibility into init / contention / migration paths.
     * If omitted, the store runs silently.
     */
    logger?: ILogger;
};
/**
 * SQLite-backed authentication state for Baileys.
 *
 * Adapted from upstream WhiskeySockets/Baileys #2575 (Stage 5) with InfiniteAPI
 * additions:
 *   - `busy_timeout` PRAGMA + retry wrapper around the per-call BEGIN IMMEDIATE
 *     so transient SQLITE_BUSY under cross-process contention is absorbed
 *     rather than propagated to the caller as an error;
 *   - optional `extraPragmas` for ops tuning without forking;
 *   - optional `logger` for init / migration / contention observability.
 *
 * Why this and not `useMultiFileAuthState`?
 *   - cross-process safe (SQLite handles file locking);
 *   - true per-call atomicity via `BEGIN IMMEDIATE; ...; COMMIT` — a multi-type
 *     `set({ session, 'identity-key' })` either commits both types or rolls
 *     back the whole call (closes the cross-file gap that the multi-file
 *     adapter can only approximate);
 *   - constant-time point reads under arbitrarily large state;
 *   - efficient `list`/`listIds` enumeration for bulk operations and migration.
 *   - WhatsApp's mobile clients use SQLite + WAL for `msgstore.db` /
 *     `axolotl.db` — this adapter mirrors that pattern.
 *
 * Concurrency contract:
 *   - point reads via prepared statements (constant-time, no transaction);
 *   - each `set()` runs as a single `BEGIN IMMEDIATE` ... `COMMIT` so the
 *     entire multi-type payload commits atomically or rolls back; under
 *     SQLITE_BUSY the call retries up to `MAX_BUSY_ATTEMPTS` times with
 *     jittered backoff before propagating;
 *   - `clear()` is a single statement and serializes naturally;
 *   - `list`/`listIds` use streaming iterators — readers do not block the
 *     single writer under WAL mode.
 *
 * Lifecycle:
 *   - the returned `close()` closes the underlying SQLite handle;
 *   - the same `dbPath` can be reopened after `close()` to resume.
 *
 * For migrating an existing on-disk `useMultiFileAuthState` folder to this
 * store, see {@link migrateAuthState}.
 */
export declare function useSqliteAuthState(opts: SqliteAuthStateOptions): Promise<{
    state: AuthenticationState;
    saveCreds: () => Promise<void>;
    close: () => void;
}>;
//# sourceMappingURL=use-sqlite-auth-state.d.ts.map