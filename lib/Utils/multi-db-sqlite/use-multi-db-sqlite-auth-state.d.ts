import type { AuthenticationState } from '../../Types/index.js';
import { MultiDbSqliteStore, type MultiDbSqliteStoreOptions } from './store.js';
export type UseMultiDbSqliteAuthStateOptions = MultiDbSqliteStoreOptions & {
    /**
     * Optional pre-opened {@link MultiDbSqliteStore}. When supplied, the
     * auth-state adapter reuses this handle set instead of opening a fresh
     * one against the same `sessionDir`, which avoids duplicate connections
     * (WAL contention + 2× FD usage) when the caller also passes the same
     * store to `SocketConfig.multiDbStore` or to a cache adapter.
     *
     * Typed as `unknown` to keep the public type free of `better-sqlite3`
     * references for consumers that don't use SQLite.
     *
     * Ownership: when `store` is supplied, the returned `close()` does
     * NOT close the injected store — the caller retains ownership and is
     * expected to call `store.close()` itself on shutdown. When `store`
     * is omitted and the adapter opens its own store, `close()` closes
     * everything as before.
     */
    store?: unknown;
};
/**
 * Multi-DB authentication state for Baileys.
 *
 * Same API as `useMultiFileAuthState` / `useSqliteAuthState`, but the
 * underlying persistence is split across 14 physical SQLite files, one per
 * concern (creds, axolotl, msgstore, wa, sync, media, companion_devices,
 * chatsettings, location, payments, stickers, smb, status, prometheus):
 *
 *   sessionDir/
 *     creds.db        — auth credentials (the `app_state_sync_keys` table
 *                       is reserved for a later phase; v1 still routes
 *                       `app-state-sync-key` to axolotl.signal_kv)
 *     axolotl.db      — Signal Protocol (opaque `signal_kv` in v1; typed
 *                       tables reserved for phase 9.5 integration)
 *     msgstore.db     — JID routing, device cache, quarantine, retry counters
 *                       (schemas reserved for phases 9.1–9.4)
 *     wa.db           — contacts + TC tokens (schemas reserved for phase 9.6)
 *     sync.db         — app-state sync (schemas reserved for phase 9.7)
 *     status.db       — Status (24h feed) + channel-crosspost state
 *                       (schema ships ahead of callers — no Baileys feature
 *                       consumes it today)
 *     prometheus.db   — metrics history; isolated so high-frequency writes
 *                       never contend with the message-send hot path
 *
 * **v1 contract:** behaves exactly like `useSqliteAuthState` — auth creds
 * in `creds.db`, signal data in `axolotl.db.signal_kv` (opaque, JSON-encoded
 * via BufferJSON). The msgstore/wa/sync DB files are created with their
 * schemas but their typed tables remain empty until the corresponding
 * follow-up phases route the respective components to them.
 *
 * Why open all 14 files up front instead of lazily? Disk allocation + WAL
 * checkpointing both have one-time costs; doing them at startup means the
 * first message flow doesn't pay them. The cost is ~210 KB per session
 * for empty WAL files (14 files × ~15 KB each) — negligible.
 */
export declare function useMultiDbSqliteAuthState(opts: UseMultiDbSqliteAuthStateOptions): Promise<{
    state: AuthenticationState;
    saveCreds: () => Promise<void>;
    close: () => void;
    /** Exposed for advanced consumers and the upcoming phase 9.1+ integrations. */
    store: MultiDbSqliteStore;
}>;
//# sourceMappingURL=use-multi-db-sqlite-auth-state.d.ts.map