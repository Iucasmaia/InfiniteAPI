export class TrustedContactsBackend {
    constructor(db) {
        this.db = db;
        this.stmts = {
            upsertIncoming: this.db.prepare('INSERT INTO wa_trusted_contacts (jid, incoming_tc_token, incoming_tc_token_timestamp) VALUES (?, ?, ?) ' +
                'ON CONFLICT(jid) DO UPDATE SET ' +
                '  incoming_tc_token = excluded.incoming_tc_token, ' +
                '  incoming_tc_token_timestamp = excluded.incoming_tc_token_timestamp'),
            selectIncoming: this.db.prepare('SELECT incoming_tc_token, incoming_tc_token_timestamp FROM wa_trusted_contacts WHERE jid = ?'),
            delIncoming: this.db.prepare('DELETE FROM wa_trusted_contacts WHERE jid = ?'),
            upsertSent: this.db.prepare('INSERT INTO wa_trusted_contacts_send (jid, sent_tc_token_timestamp, real_issue_timestamp) VALUES (?, ?, ?) ' +
                'ON CONFLICT(jid) DO UPDATE SET ' +
                '  sent_tc_token_timestamp = excluded.sent_tc_token_timestamp, ' +
                '  real_issue_timestamp = excluded.real_issue_timestamp'),
            selectSent: this.db.prepare('SELECT sent_tc_token_timestamp, real_issue_timestamp FROM wa_trusted_contacts_send WHERE jid = ?'),
            delSent: this.db.prepare('DELETE FROM wa_trusted_contacts_send WHERE jid = ?'),
            countIncoming: this.db.prepare('SELECT COUNT(*) AS n FROM wa_trusted_contacts'),
            countSent: this.db.prepare('SELECT COUNT(*) AS n FROM wa_trusted_contacts_send')
        };
    }
    /** Stores (or updates) the incoming TC token for a contact JID. */
    setIncoming(jid, token, timestamp = Date.now()) {
        this.stmts.upsertIncoming.run(jid, token, timestamp);
    }
    /** Returns the incoming TC token + timestamp for a JID, or null. */
    getIncoming(jid) {
        const row = this.stmts.selectIncoming.get(jid);
        if (!row)
            return null;
        return { token: row.incoming_tc_token, timestamp: row.incoming_tc_token_timestamp };
    }
    /** Removes the incoming TC token for a JID. Returns true if a row was removed. */
    deleteIncoming(jid) {
        return this.stmts.delIncoming.run(jid).changes > 0;
    }
    /** Stores (or updates) the outbound TC token timestamps for a recipient. */
    setSent(jid, sentTimestamp, realIssueTimestamp) {
        this.stmts.upsertSent.run(jid, sentTimestamp, realIssueTimestamp);
    }
    /** Returns the outbound TC token timestamps for a JID, or null. */
    getSent(jid) {
        const row = this.stmts.selectSent.get(jid);
        if (!row)
            return null;
        return {
            sentTimestamp: row.sent_tc_token_timestamp,
            realIssueTimestamp: row.real_issue_timestamp
        };
    }
    /** Removes the outbound TC token row for a JID. */
    deleteSent(jid) {
        return this.stmts.delSent.run(jid).changes > 0;
    }
    /** Diagnostic stats for ops visibility. */
    stats() {
        const inc = this.stmts.countIncoming.get();
        const sent = this.stmts.countSent.get();
        return { incomingCount: inc.n, sentCount: sent.n };
    }
}
//# sourceMappingURL=trusted-contacts-backend.js.map