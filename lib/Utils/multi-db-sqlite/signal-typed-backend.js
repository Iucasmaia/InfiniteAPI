/**
 * Sentinel `device_id` for identities that arrive without an explicit
 * device. SQLite treats NULLs as distinct under UNIQUE, so storing NULL
 * in `device_id` would let multiple "no-device" identity rows for the
 * same recipient slip past the `identities_idx` constraint and surface
 * stale keys from `getIdentity`. Using 0 — the value the canonical
 * mobile schema also uses — keeps the conflict target meaningful.
 */
const IDENTITY_DEVICE_ID_SENTINEL = 0;
export class SignalTypedBackend {
    constructor(db) {
        this.db = db;
        this.stmts = {
            // sessions: unique index on (device_id, recipient_account_id, recipient_account_type, session_type, session_scope)
            upsertSession: this.db.prepare('INSERT INTO sessions (device_id, recipient_account_id, recipient_account_type, ' +
                'session_type, session_scope, record, timestamp) ' +
                'VALUES (?, ?, ?, ?, ?, ?, ?) ' +
                'ON CONFLICT(device_id, recipient_account_id, recipient_account_type, session_type, session_scope) ' +
                'DO UPDATE SET record = excluded.record, timestamp = excluded.timestamp'),
            selectSession: this.db.prepare('SELECT record, timestamp FROM sessions ' +
                'WHERE device_id = ? AND recipient_account_id = ? AND recipient_account_type = ? ' +
                'AND session_type = ? AND session_scope = ?'),
            deleteSession: this.db.prepare('DELETE FROM sessions ' +
                'WHERE device_id = ? AND recipient_account_id = ? AND recipient_account_type = ? ' +
                'AND session_type = ? AND session_scope = ?'),
            upsertPrekey: this.db.prepare('INSERT INTO prekeys (prekey_id, record, key_type) VALUES (?, ?, ?) ' +
                'ON CONFLICT(prekey_id) DO UPDATE SET record = excluded.record'),
            selectPrekey: this.db.prepare('SELECT record FROM prekeys WHERE prekey_id = ?'),
            deletePrekey: this.db.prepare('DELETE FROM prekeys WHERE prekey_id = ?'),
            upsertSignedPrekey: this.db.prepare('INSERT INTO signed_prekeys (prekey_id, record, timestamp, key_type) VALUES (?, ?, ?, ?) ' +
                'ON CONFLICT(prekey_id) DO UPDATE SET record = excluded.record, timestamp = excluded.timestamp'),
            selectSignedPrekey: this.db.prepare('SELECT record, timestamp FROM signed_prekeys WHERE prekey_id = ?'),
            upsertKyberPrekey: this.db.prepare(
            // Conflict update covers BOTH `record` AND `last_resort_key` so a
            // caller re-saving the same prekey id with a flipped flag (e.g.
            // promoting a one-time key into the last-resort slot) gets that
            // change reflected on the next `getKyberPrekey()` call. Earlier
            // versions only updated `record`, which let the stored flag
            // drift from the latest caller input.
            'INSERT INTO kyber_prekeys (prekey_id, record, last_resort_key) VALUES (?, ?, ?) ' +
                'ON CONFLICT(prekey_id) DO UPDATE SET ' +
                '  record = excluded.record, last_resort_key = excluded.last_resort_key'),
            selectKyberPrekey: this.db.prepare('SELECT record, last_resort_key FROM kyber_prekeys WHERE prekey_id = ?'),
            upsertIdentity: this.db.prepare('INSERT INTO identities (recipient_id, recipient_type, device_id, public_key, timestamp) ' +
                'VALUES (?, ?, ?, ?, ?) ' +
                'ON CONFLICT(recipient_id, recipient_type, device_id) ' +
                'DO UPDATE SET public_key = excluded.public_key, timestamp = excluded.timestamp'),
            selectIdentity: this.db.prepare(
            // `device_id = ?` (not `IS ?`) because `putIdentity` coerces a
            // missing/null device id to the IDENTITY_DEVICE_ID_SENTINEL
            // (0) before insert. Keeping `IS ?` here together with the
            // coerced INSERT would mean a select with `deviceId: null`
            // never finds the row even though the row exists.
            'SELECT public_key, timestamp FROM identities ' +
                'WHERE recipient_id = ? AND recipient_type = ? AND device_id = ?'),
            upsertSenderKey: this.db.prepare('INSERT INTO sender_keys (group_id, device_id, sender_account_id, sender_account_type, record, timestamp) ' +
                'VALUES (?, ?, ?, ?, ?, ?) ' +
                'ON CONFLICT(group_id, device_id, sender_account_id, sender_account_type) ' +
                'DO UPDATE SET record = excluded.record, timestamp = excluded.timestamp'),
            selectSenderKey: this.db.prepare('SELECT record, timestamp FROM sender_keys ' +
                'WHERE group_id = ? AND device_id = ? AND sender_account_id = ? AND sender_account_type = ?')
        };
    }
    // ============ sessions ============
    putSession(key, record, timestamp = Date.now()) {
        this.stmts.upsertSession.run(key.deviceId, key.recipientAccountId, key.recipientAccountType, key.sessionType ?? 0, key.sessionScope ?? 0, record, timestamp);
    }
    getSession(key) {
        const row = this.stmts.selectSession.get(key.deviceId, key.recipientAccountId, key.recipientAccountType, key.sessionType ?? 0, key.sessionScope ?? 0);
        return row ?? null;
    }
    deleteSession(key) {
        const r = this.stmts.deleteSession.run(key.deviceId, key.recipientAccountId, key.recipientAccountType, key.sessionType ?? 0, key.sessionScope ?? 0);
        return r.changes > 0;
    }
    // ============ prekeys ============
    putPrekey(prekeyId, record, keyType = 0) {
        this.stmts.upsertPrekey.run(prekeyId, record, keyType);
    }
    getPrekey(prekeyId) {
        const r = this.stmts.selectPrekey.get(prekeyId);
        return r?.record ?? null;
    }
    deletePrekey(prekeyId) {
        return this.stmts.deletePrekey.run(prekeyId).changes > 0;
    }
    // ============ signed prekeys ============
    putSignedPrekey(prekeyId, record, timestamp = Date.now(), keyType = 0) {
        this.stmts.upsertSignedPrekey.run(prekeyId, record, timestamp, keyType);
    }
    getSignedPrekey(prekeyId) {
        const r = this.stmts.selectSignedPrekey.get(prekeyId);
        return r ?? null;
    }
    // ============ kyber prekeys ============
    putKyberPrekey(prekeyId, record, lastResortKey = false) {
        this.stmts.upsertKyberPrekey.run(prekeyId, record, lastResortKey ? 1 : 0);
    }
    getKyberPrekey(prekeyId) {
        const r = this.stmts.selectKyberPrekey.get(prekeyId);
        if (!r)
            return null;
        return { record: r.record, lastResortKey: r.last_resort_key === 1 };
    }
    // ============ identities (dual LID + PN) ============
    putIdentity(key, publicKey, timestamp = Date.now()) {
        // Coerce missing/null deviceId to the IDENTITY_DEVICE_ID_SENTINEL so
        // ON CONFLICT(recipient_id, recipient_type, device_id) actually fires
        // for "no-device" identities. SQLite considers two NULLs distinct
        // under UNIQUE, so a NULL device_id would let repeated saves insert
        // duplicate rows instead of upserting — and `getIdentity` could then
        // return an older key for the same recipient.
        this.stmts.upsertIdentity.run(key.recipientId, key.recipientType, key.deviceId ?? IDENTITY_DEVICE_ID_SENTINEL, publicKey, timestamp);
    }
    getIdentity(key) {
        const r = this.stmts.selectIdentity.get(key.recipientId, key.recipientType, key.deviceId ?? IDENTITY_DEVICE_ID_SENTINEL);
        if (!r)
            return null;
        return { publicKey: r.public_key, timestamp: r.timestamp };
    }
    // ============ sender keys ============
    putSenderKey(key, record, timestamp = Date.now()) {
        this.stmts.upsertSenderKey.run(key.groupId, key.deviceId, key.senderAccountId, key.senderAccountType, record, timestamp);
    }
    getSenderKey(key) {
        const r = this.stmts.selectSenderKey.get(key.groupId, key.deviceId, key.senderAccountId, key.senderAccountType);
        return r ?? null;
    }
}
//# sourceMappingURL=signal-typed-backend.js.map