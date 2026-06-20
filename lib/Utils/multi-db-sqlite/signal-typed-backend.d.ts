/**
 * Phase 9.5 — typed Signal Protocol backend that migrates the opaque
 * `signal_kv(type, id, value)` rows in `axolotl.db` into their typed
 * counterparts (`sessions`, `prekeys`, `signed_prekeys`,
 * `kyber_prekeys`, `identities`, `sender_keys`).
 *
 * The opaque `signal_kv` table stays in place — it acts as a staging
 * surface for any signal data type whose libsignal-side integration
 * has not yet been migrated. The typed tables are addressable directly
 * by callers that have rewired their persistence layer; everything
 * else continues to use the staging area.
 *
 * Why a backend instead of a wrapper around the existing key store?
 *   The typed tables have natural keys that don't fit a `(type, id)`
 *   tuple cleanly:
 *     - `sessions` is keyed by `(device_id, recipient_account_id,
 *       recipient_account_type, session_type, session_scope)` — a 5-tuple
 *       that needs structured access, not a single opaque id string.
 *     - `sender_keys` is keyed by `(group_id, device_id, sender_account_id,
 *       sender_account_type)` — 4 fields.
 *     - `identities` is dual-stored by `(recipient_id, recipient_type,
 *       device_id)` — 3 fields with the LID/PN type column meaningful.
 *   The wrapper pattern from phase 9.1 worked because LID mapping is a
 *   simple key->value relation; the typed Signal tables need first-class
 *   structured operations.
 *
 * Migration sequencing:
 *   - Skeleton (this commit) — typed backend ships with insert + select
 *     primitives; opaque signal_kv stays primary.
 *   - Phase 9.5.1 (follow-up) — libsignal-side integration calls these
 *     primitives directly. The opaque signal_kv rows are migrated row by
 *     row into the typed tables, gated behind a version flag in the
 *     creds row so a partial migration is detectable on restart.
 */
import type { SqliteDbLike } from './types.js';
export type SignalSessionKey = {
    deviceId: number;
    recipientAccountId: string;
    recipientAccountType: number;
    sessionType?: number;
    sessionScope?: number;
};
export type SignalIdentityKey = {
    recipientId: number;
    recipientType: number;
    deviceId?: number | null;
};
export type SignalSenderKeyKey = {
    groupId: string;
    deviceId: number;
    senderAccountId: string;
    senderAccountType: number;
};
export declare class SignalTypedBackend {
    private readonly stmts;
    private readonly db;
    constructor(db: SqliteDbLike);
    putSession(key: SignalSessionKey, record: Buffer | Uint8Array, timestamp?: number): void;
    getSession(key: SignalSessionKey): {
        record: Buffer;
        timestamp: number;
    } | null;
    deleteSession(key: SignalSessionKey): boolean;
    putPrekey(prekeyId: number, record: Buffer | Uint8Array, keyType?: number): void;
    getPrekey(prekeyId: number): Buffer | null;
    deletePrekey(prekeyId: number): boolean;
    putSignedPrekey(prekeyId: number, record: Buffer | Uint8Array, timestamp?: number, keyType?: number): void;
    getSignedPrekey(prekeyId: number): {
        record: Buffer;
        timestamp: number;
    } | null;
    putKyberPrekey(prekeyId: number, record: Buffer | Uint8Array, lastResortKey?: boolean): void;
    getKyberPrekey(prekeyId: number): {
        record: Buffer;
        lastResortKey: boolean;
    } | null;
    putIdentity(key: SignalIdentityKey, publicKey: Buffer | Uint8Array, timestamp?: number): void;
    getIdentity(key: SignalIdentityKey): {
        publicKey: Buffer;
        timestamp: number;
    } | null;
    putSenderKey(key: SignalSenderKeyKey, record: Buffer | Uint8Array, timestamp?: number): void;
    getSenderKey(key: SignalSenderKeyKey): {
        record: Buffer;
        timestamp: number;
    } | null;
}
//# sourceMappingURL=signal-typed-backend.d.ts.map