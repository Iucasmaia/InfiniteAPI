/**
 * `MultiDbSqliteStore` — multi-handle SQLite store with one physical
 * `.db` file per concern (creds, axolotl, msgstore, wa, sync, media,
 * companion_devices, chatsettings, location, payments, stickers, smb,
 * status, prometheus — 14 files total; see `MULTI_DB_FILES`).
 *
 * Why multiple files instead of one consolidated DB?
 *
 *   - Lock isolation: a heavy write burst on routing tables does not block
 *     point reads on session storage (message-send hot path).
 *   - Corruption blast radius: a single WAL checkpoint corruption only
 *     compromises one concern. Auth creds in `creds.db` survive a hostile
 *     write on `msgstore.db`.
 *   - Maintenance: tools like `sqlite3 axolotl.db .schema` work without
 *     needing to know table prefixes.
 *
 * Trade-off: cross-file transactions are not ACID. The only logical
 * atomicity boundary in baileys is "save N signal data types in one call",
 * and those all live inside `axolotl.db`, so the trade-off is fine.
 */
import type { ILogger } from '../logger.js';
import { type MultiDbFile } from './schemas/index.js';
import type { SqliteDbLike } from './types.js';
export type MultiDbSqliteStoreOptions = {
    /**
     * Directory where the per-concern `.db` files are written. Created if
     * missing. Each session typically gets its own directory.
     */
    sessionDir: string;
    /**
     * Extra `PRAGMA` statements applied to every opened handle after the
     * defaults. Useful for ops tuning (e.g. `'cache_size = -8000'`).
     */
    extraPragmas?: ReadonlyArray<string>;
    /**
     * Optional logger for init / migration visibility.
     */
    logger?: ILogger;
};
/**
 * Holds the open handles for all multi-DB files in a single session. The
 * handles are opened by {@link open} and closed together via {@link close}.
 */
export declare class MultiDbSqliteStore {
    private readonly opts;
    private readonly handles;
    private opened;
    private openInFlight?;
    private openGeneration;
    constructor(opts: MultiDbSqliteStoreOptions);
    open(): Promise<void>;
    private runOpen;
    /**
     * Returns the opened handle for the given DB file. Throws if the store
     * has not been opened yet — callers should always {@link open} first.
     *
     * The return type is the local {@link SqliteDbLike} structural
     * interface (NOT `better-sqlite3.Database`), so the generated `.d.ts`
     * does not force every TypeScript consumer of `baileys/Utils` to
     * resolve `better-sqlite3`'s typings — preserving the optional
     * peer-dependency contract. The runtime value is an actual
     * `better-sqlite3` `Database` instance; internal callers cast at the
     * boundary when they need the typed API.
     */
    handle(file: MultiDbFile): SqliteDbLike;
    /**
     * Closes every opened handle. Safe to call multiple times; subsequent
     * calls are no-ops. After close, the same `sessionDir` can be re-opened
     * via a fresh store instance.
     *
     * If `close()` is invoked while an `open()` is still in flight, the
     * `openInFlight` promise has already added handles to `this.handles`
     * one by one — we still walk the map and close whatever is there. Then
     * `opened` is set false so the still-pending open() resolves into a
     * closed store: subsequent `handle()` lookups will throw with the
     * "not opened" message, which is the correct postcondition for a
     * caller that explicitly tore the store down.
     */
    close(): void;
}
//# sourceMappingURL=store.d.ts.map