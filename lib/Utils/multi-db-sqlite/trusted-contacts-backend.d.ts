/**
 * Phase 9.6 — typed `wa_trusted_contacts` + `wa_trusted_contacts_send`
 * SQLite-backed storage for Trusted Contact (TC) tokens.
 *
 * TC tokens drive the biz `quality_control` envelope: the gateway sends
 * `<quality_control decision_id="..."><decision_source value="df"/>` on
 * outbound business messages, where `decision_id` is derived from the
 * recipient's TC token state. Persisting tokens here lets the gateway:
 *
 *   - Survive restart without losing token state (the legacy in-RAM
 *     store would forget on every boot).
 *   - Carry forward the `sent_tc_token_timestamp` so we don't re-issue
 *     a token to the same recipient inside the cool-down window.
 *   - Track the `real_issue_timestamp` for the outbound side, which is
 *     used to detect token re-issuance loops.
 *
 * Column names match the canonical mobile schema verbatim — backups,
 * forensic dumps, and migration scripts work without renames.
 */
import type { SqliteDbLike } from './types.js';
export type TrustedContactsBackendStats = {
    incomingCount: number;
    sentCount: number;
};
export declare class TrustedContactsBackend {
    private readonly stmts;
    private readonly db;
    constructor(db: SqliteDbLike);
    /** Stores (or updates) the incoming TC token for a contact JID. */
    setIncoming(jid: string, token: Buffer | Uint8Array, timestamp?: number): void;
    /** Returns the incoming TC token + timestamp for a JID, or null. */
    getIncoming(jid: string): {
        token: Buffer;
        timestamp: number;
    } | null;
    /** Removes the incoming TC token for a JID. Returns true if a row was removed. */
    deleteIncoming(jid: string): boolean;
    /** Stores (or updates) the outbound TC token timestamps for a recipient. */
    setSent(jid: string, sentTimestamp: number, realIssueTimestamp: number): void;
    /** Returns the outbound TC token timestamps for a JID, or null. */
    getSent(jid: string): {
        sentTimestamp: number;
        realIssueTimestamp: number;
    } | null;
    /** Removes the outbound TC token row for a JID. */
    deleteSent(jid: string): boolean;
    /** Diagnostic stats for ops visibility. */
    stats(): TrustedContactsBackendStats;
}
//# sourceMappingURL=trusted-contacts-backend.d.ts.map