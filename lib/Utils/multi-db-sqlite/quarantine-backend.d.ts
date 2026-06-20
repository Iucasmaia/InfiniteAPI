/**
 * Phase 9.4 — typed `message_quarantine` storage.
 *
 * Stanzas that fail to decrypt (typically Bad MAC errors) are quarantined
 * here so they survive a gateway restart and can be replayed forensically
 * or fed back into the recovery flow when a new session is established.
 *
 * Backed by `msgstore.db.message_quarantine` with a UNIQUE constraint on
 * `(key_id, from_me, chat_row_id, sender_jid_row_id)` so duplicate
 * quarantine attempts for the same message merge into a single row with
 * the `retry_count` incremented.
 *
 * Storage choices:
 *   - `original_protobuf` BLOB: the raw inner payload (e.g. the protobuf
 *     before encryption) when available — useful for offline analysis.
 *   - `serialized_stanza` BLOB: the wire-format XMPP stanza that the
 *     client received and failed to decrypt. Lets the recovery handler
 *     re-process the same stanza after the session is rebuilt.
 *   - `failure_reason` TEXT: free-form diagnostic ("Bad MAC", "Invalid
 *     SignedPreKey", etc.) for triage dashboards.
 *   - `quarantined_at` INTEGER: epoch ms — supports time-window queries
 *     ("everything quarantined in the last 5 minutes").
 *   - `retry_count` INTEGER: incremented on every quarantine attempt for
 *     the same natural key, mirroring the existing in-RAM ring buffer.
 */
import type { SqliteDbLike } from './types.js';
export type QuarantineRecord = {
    keyId: string;
    fromMe: boolean;
    chatRowId: number;
    senderJidRowId?: number | null;
    originalProtobuf?: Buffer | Uint8Array | null;
    serializedStanza?: Buffer | Uint8Array | null;
    failureReason?: string | null;
    quarantinedAt?: number;
};
export type StoredQuarantineRow = QuarantineRecord & {
    id: number;
    quarantinedAt: number;
    retryCount: number;
};
export declare class MessageQuarantineBackend {
    private readonly stmts;
    private readonly db;
    constructor(db: SqliteDbLike);
    /**
     * Inserts a quarantine row, or increments `retry_count` on an existing
     * row matching the natural key. Returns the resulting row's id +
     * retry_count after the operation.
     *
     * Atomic via single UPSERT + RETURNING — no transaction wrapper needed
     * and no race window between the conflict check and the row read.
     */
    quarantine(record: QuarantineRecord): {
        id: number;
        retryCount: number;
    };
    /** Returns the quarantine row matching the natural key, or `null`. */
    findByKey(keyId: string, fromMe: boolean, chatRowId: number, senderJidRowId: number | null): StoredQuarantineRow | null;
    /** Returns every quarantine row for a chat ordered by most-recent first. */
    listByChat(chatRowId: number): StoredQuarantineRow[];
    /** Returns rows quarantined at or after `since` (epoch ms). */
    listSince(since: number): StoredQuarantineRow[];
    /**
     * Removes the row matching the natural key. Use after successful
     * recovery so the row doesn't pile up forever.
     */
    dismiss(keyId: string, fromMe: boolean, chatRowId: number, senderJidRowId: number | null): boolean;
    /** Deletes every row older than the cutoff (epoch ms). Returns rows pruned. */
    pruneOlderThan(cutoff: number): number;
}
//# sourceMappingURL=quarantine-backend.d.ts.map