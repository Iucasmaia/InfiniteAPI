export class MessageQuarantineBackend {
    constructor(db) {
        this.db = db;
        this.stmts = {
            // Single atomic UPSERT with RETURNING. The previous design used a
            // transaction wrapping (UPDATE-then-INSERT-if-no-rows) but
            // `db.transaction()` defaults to DEFERRED mode, so two callers
            // across processes could both execute UPDATE → 0 changes, then
            // both attempt INSERT — the second hitting `SQLITE_CONSTRAINT_
            // UNIQUE` instead of falling through to a retry-count bump. The
            // `busy_timeout` pragma only smooths `SQLITE_BUSY`, not UNIQUE
            // violations. The conflict clause now does the increment in the
            // same statement and `RETURNING` gives us the row's _id and
            // final retry_count without a separate SELECT.
            upsert: this.db.prepare('INSERT INTO message_quarantine ' +
                '(key_id, from_me, chat_row_id, sender_jid_row_id, original_protobuf, serialized_stanza, ' +
                'failure_reason, quarantined_at, retry_count) ' +
                'VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1) ' +
                'ON CONFLICT(key_id, from_me, chat_row_id, sender_jid_row_id) ' +
                'DO UPDATE SET ' +
                '  retry_count = retry_count + 1, ' +
                '  quarantined_at = excluded.quarantined_at, ' +
                '  failure_reason = excluded.failure_reason ' +
                'RETURNING _id, retry_count'),
            selectByKey: this.db.prepare('SELECT _id, key_id, from_me, chat_row_id, sender_jid_row_id, original_protobuf, ' +
                'serialized_stanza, failure_reason, quarantined_at, retry_count ' +
                'FROM message_quarantine WHERE key_id = ? AND from_me = ? AND chat_row_id = ? AND sender_jid_row_id = ?'),
            selectByChat: this.db.prepare('SELECT _id, key_id, from_me, chat_row_id, sender_jid_row_id, original_protobuf, ' +
                'serialized_stanza, failure_reason, quarantined_at, retry_count ' +
                'FROM message_quarantine WHERE chat_row_id = ? ORDER BY quarantined_at DESC'),
            selectSince: this.db.prepare('SELECT _id, key_id, from_me, chat_row_id, sender_jid_row_id, original_protobuf, ' +
                'serialized_stanza, failure_reason, quarantined_at, retry_count ' +
                'FROM message_quarantine WHERE quarantined_at >= ? ORDER BY quarantined_at DESC'),
            delByKey: this.db.prepare('DELETE FROM message_quarantine ' +
                'WHERE key_id = ? AND from_me = ? AND chat_row_id = ? AND sender_jid_row_id = ?'),
            pruneOlderThan: this.db.prepare('DELETE FROM message_quarantine WHERE quarantined_at < ?')
        };
    }
    /**
     * Inserts a quarantine row, or increments `retry_count` on an existing
     * row matching the natural key. Returns the resulting row's id +
     * retry_count after the operation.
     *
     * Atomic via single UPSERT + RETURNING — no transaction wrapper needed
     * and no race window between the conflict check and the row read.
     */
    quarantine(record) {
        const now = record.quarantinedAt ?? Date.now();
        // schema: sender_jid_row_id NOT NULL DEFAULT 0 — coerce nullish to 0 so
        // UNIQUE constraint sees consistent values (SQLite treats NULLs as
        // distinct under UNIQUE).
        const sender = record.senderJidRowId ?? 0;
        const row = this.stmts.upsert.get(record.keyId, record.fromMe ? 1 : 0, record.chatRowId, sender, record.originalProtobuf ?? null, record.serializedStanza ?? null, record.failureReason ?? null, now);
        return { id: row._id, retryCount: row.retry_count };
    }
    /** Returns the quarantine row matching the natural key, or `null`. */
    findByKey(keyId, fromMe, chatRowId, senderJidRowId) {
        const row = this.stmts.selectByKey.get(keyId, fromMe ? 1 : 0, chatRowId, senderJidRowId ?? 0);
        return row ? mapRow(row) : null;
    }
    /** Returns every quarantine row for a chat ordered by most-recent first. */
    listByChat(chatRowId) {
        const rows = this.stmts.selectByChat.all(chatRowId);
        return rows.map(mapRow);
    }
    /** Returns rows quarantined at or after `since` (epoch ms). */
    listSince(since) {
        const rows = this.stmts.selectSince.all(since);
        return rows.map(mapRow);
    }
    /**
     * Removes the row matching the natural key. Use after successful
     * recovery so the row doesn't pile up forever.
     */
    dismiss(keyId, fromMe, chatRowId, senderJidRowId) {
        const r = this.stmts.delByKey.run(keyId, fromMe ? 1 : 0, chatRowId, senderJidRowId ?? 0);
        return r.changes > 0;
    }
    /** Deletes every row older than the cutoff (epoch ms). Returns rows pruned. */
    pruneOlderThan(cutoff) {
        const r = this.stmts.pruneOlderThan.run(cutoff);
        return r.changes;
    }
}
function mapRow(row) {
    return {
        id: row._id,
        keyId: row.key_id,
        fromMe: row.from_me === 1,
        chatRowId: row.chat_row_id,
        senderJidRowId: row.sender_jid_row_id,
        originalProtobuf: row.original_protobuf,
        serializedStanza: row.serialized_stanza,
        failureReason: row.failure_reason,
        quarantinedAt: row.quarantined_at,
        retryCount: row.retry_count
    };
}
//# sourceMappingURL=quarantine-backend.js.map