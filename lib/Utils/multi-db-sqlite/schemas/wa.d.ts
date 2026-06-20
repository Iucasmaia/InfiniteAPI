/**
 * Schema for `wa.db` — auxiliary store: contacts, Trusted Contact tokens,
 * business profile cache.
 *
 * Gateway scope:
 *   - `wa_contacts` — contact directory (target for phase 9.6 indirectly)
 *   - `wa_trusted_contacts` / `wa_trusted_contacts_send` — TC token
 *     persistence (incoming + outgoing per-recipient state) for the biz
 *     `quality_control` envelope (phase 9.6)
 *
 * Column names match the canonical mobile schema verbatim.
 */
export declare const WA_SCHEMA = "\nCREATE TABLE IF NOT EXISTS android_metadata (locale TEXT);\n\nCREATE TABLE IF NOT EXISTS wa_contacts (\n  _id INTEGER PRIMARY KEY AUTOINCREMENT,\n  jid TEXT NOT NULL,\n  is_whatsapp_user BOOLEAN NOT NULL,\n  status TEXT,\n  status_timestamp INTEGER,\n  number TEXT,\n  raw_contact_id INTEGER,\n  display_name TEXT,\n  phone_type INTEGER,\n  phone_label TEXT,\n  photo_ts INTEGER,\n  thumb_ts INTEGER,\n  photo_id_timestamp INTEGER,\n  given_name TEXT,\n  family_name TEXT,\n  wa_name TEXT,\n  sort_name TEXT,\n  nickname TEXT,\n  company TEXT,\n  title TEXT,\n  status_autodownload_disabled INTEGER,\n  keep_timestamp INTEGER,\n  is_spam_reported INTEGER,\n  is_sidelist_synced BOOLEAN DEFAULT 0,\n  is_business_synced BOOLEAN DEFAULT 0,\n  disappearing_mode_duration INTEGER,\n  disappearing_mode_timestamp INTEGER,\n  disappearing_mode_support_disabled INTEGER,\n  is_starred BOOLEAN,\n  is_wa_created_contact BOOLEAN,\n  sync_policy INTEGER,\n  status_emoji TEXT,\n  is_contact_synced INTEGER,\n  is_reachable INTEGER,\n  external_user_state INTEGER\n);\n\nCREATE INDEX IF NOT EXISTS wa_contacts_jid_idx ON wa_contacts (jid);\nCREATE INDEX IF NOT EXISTS wa_contacts_is_wa_idx ON wa_contacts (is_whatsapp_user);\nCREATE INDEX IF NOT EXISTS wa_contacts_is_contact_synced_idx\n  ON wa_contacts (is_contact_synced);\n\nCREATE TABLE IF NOT EXISTS wa_trusted_contacts (\n  jid TEXT PRIMARY KEY NOT NULL,\n  incoming_tc_token BLOB NOT NULL,\n  incoming_tc_token_timestamp INTEGER NOT NULL\n);\n\nCREATE INDEX IF NOT EXISTS incoming_tc_token_timestamp_index\n  ON wa_trusted_contacts (incoming_tc_token_timestamp);\n\nCREATE TABLE IF NOT EXISTS wa_trusted_contacts_send (\n  jid TEXT PRIMARY KEY NOT NULL,\n  sent_tc_token_timestamp INTEGER NOT NULL,\n  real_issue_timestamp INTEGER\n);\n\nCREATE INDEX IF NOT EXISTS sent_real_issue_timestamp_index\n  ON wa_trusted_contacts_send (real_issue_timestamp);\nCREATE INDEX IF NOT EXISTS sent_tc_token_timestamp_index\n  ON wa_trusted_contacts_send (sent_tc_token_timestamp);\n";
//# sourceMappingURL=wa.d.ts.map