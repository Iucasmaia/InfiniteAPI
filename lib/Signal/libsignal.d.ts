import type { LIDMapping, SignalAuthState } from '../Types/index.js';
import type { BaileysEventEmitter } from '../Types/Events.js';
import type { SignalRepositoryWithLIDStore } from '../Types/Signal.js';
import type { ILogger } from '../Utils/logger.js';
/**
 * Result of identity key save operation
 */
export interface IdentitySaveResult {
    /**
     * Whether the identity key changed from a previous known value.
     * - true: Key changed (contact reinstalled WhatsApp or switched devices)
     * - false: Key is new (first contact) OR unchanged (same key as before)
     * Use `isNew` to distinguish between new and unchanged cases.
     */
    changed: boolean;
    /** Whether this is a new contact (first time seeing their key) */
    isNew: boolean;
    /** Fingerprint of the previous key (only present if changed === true) */
    previousFingerprint?: string;
    /** SHA-256 fingerprint of the current/new key (64 hex characters) */
    currentFingerprint: string;
}
/**
 * Options for makeLibSignalRepository
 */
export interface LibSignalRepositoryOptions {
    /** Event emitter for broadcasting identity changes */
    ev?: BaileysEventEmitter;
    /**
     * Optional multi-DB SQLite store. When supplied, the LID mapping
     * persistence routes through the typed `jid` + `jid_map` tables in
     * `msgstore.db` instead of opaque key-value rows on the shared signal
     * key store. All in-memory caching, coalescing, retry, statistics, and
     * metrics on top remain identical.
     *
     * Default (`undefined`): legacy behavior — `auth.keys` carries the
     * `'lid-mapping'` rows as before.
     *
     * Typed as `unknown` here to avoid forcing every importer of
     * `LibSignalRepositoryOptions` to resolve the SQLite types. The runtime
     * expectation is `MultiDbSqliteStore` from `../Utils/multi-db-sqlite`.
     */
    multiDbStore?: unknown;
}
export declare function makeLibSignalRepository(auth: SignalAuthState, logger: ILogger, pnToLIDFunc?: (jids: string[]) => Promise<LIDMapping[] | undefined>, options?: LibSignalRepositoryOptions): SignalRepositoryWithLIDStore;
//# sourceMappingURL=libsignal.d.ts.map