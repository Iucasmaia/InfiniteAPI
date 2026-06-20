/**
 * Schema for `status.db` — Status (24h feed) + channel-crosspost state.
 *
 * Mirrors the canonical mobile schema discovered on WA Business 2.26.21.75
 * via Frida (the verbatim mobile dump captured at the same time is preserved
 * outside the repo for future reference). The mobile DB has ~25 tables; we
 * ship the core subset that any Baileys status / channel-crosspost feature
 * would touch — `status` (the root feed), `status_attribution` (channel-
 * crosspost reference), `status_info` (per-chat aggregates), the read-receipt
 * + privacy + media-link companion tables, and the `status_crossposting_v3`
 * outbound queue. Remaining tables (reporting, orphan, interactions, add_on,
 * etc.) can be appended in future PRs as concrete callers land — the
 * bookkeeping schema-migrations helper lets new tables be introduced safely
 * against existing databases.
 *
 * State machine for `status.state` (empirical):
 *   0 → creating / uploading
 *   1 → sent locally (queued for server)
 *   3 → server-confirmed receipt
 *   6 → expired / deleted
 *
 * `status.type` observed values:
 *   4 → standard photo/text/crosspost (dominant)
 *   5 → variant (other senders, flags=32)
 *
 * `status_attribution.type` observed values:
 *   1 → newsletter / channel crosspost (proto ~43 bytes)
 *   3 → other variant (16–111 byte protos)
 *
 * Column names match the canonical mobile schema verbatim.
 */
export declare const STATUS_SCHEMA = "\nCREATE TABLE IF NOT EXISTS android_metadata (locale TEXT);\n\nCREATE TABLE IF NOT EXISTS status (\n  row_id INTEGER PRIMARY KEY AUTOINCREMENT,\n  sort_id INTEGER NOT NULL,\n  uuid TEXT NOT NULL,\n  sender_user_jid TEXT NOT NULL,\n  status_info_row_id INTEGER NOT NULL,\n  type INTEGER NOT NULL,\n  timestamp INTEGER NOT NULL,\n  server_receipt_timestamp INTEGER,\n  text_data TEXT,\n  state INTEGER NOT NULL,\n  secret BLOB,\n  content_proto BLOB,\n  fp_proto BLOB,\n  origin INTEGER NOT NULL,\n  flags INTEGER NOT NULL,\n  audience_type INTEGER NOT NULL DEFAULT 0,\n  is_archived INTEGER NOT NULL,\n  stanza_xml BLOB,\n  received_timestamp INTEGER\n);\n\nCREATE INDEX IF NOT EXISTS status_is_archived_index ON status (is_archived);\nCREATE UNIQUE INDEX IF NOT EXISTS status_info_sort_id_index\n  ON status (status_info_row_id, sort_id);\n\nCREATE TABLE IF NOT EXISTS status_attribution (\n  row_id INTEGER PRIMARY KEY AUTOINCREMENT,\n  status_row_id INTEGER NOT NULL,\n  type INTEGER NOT NULL,\n  content_proto BLOB\n);\n\nCREATE INDEX IF NOT EXISTS status_attribution_index\n  ON status_attribution (status_row_id);\n\nCREATE TABLE IF NOT EXISTS status_crossposting_v3 (\n  row_id INTEGER PRIMARY KEY AUTOINCREMENT,\n  status_row_id INTEGER,\n  crossposting_session_id TEXT,\n  crossposting_status_unique_id TEXT,\n  state INTEGER,\n  media_file_path TEXT,\n  direct_url_path TEXT,\n  destination INTEGER\n);\n\nCREATE UNIQUE INDEX IF NOT EXISTS status_crossposting_v3_index\n  ON status_crossposting_v3 (status_row_id, destination);\nCREATE INDEX IF NOT EXISTS status_crossposting_v3_state_index\n  ON status_crossposting_v3 (state);\n\nCREATE TABLE IF NOT EXISTS status_info (\n  row_id INTEGER PRIMARY KEY AUTOINCREMENT,\n  chat_jid TEXT NOT NULL,\n  total_count INTEGER NOT NULL,\n  unread_count INTEGER NOT NULL,\n  last_status_sort_id INTEGER,\n  first_unread_sort_id INTEGER,\n  is_muted INTEGER NOT NULL,\n  last_status_timestamp INTEGER,\n  pending_count INTEGER,\n  failed_count INTEGER,\n  type INTEGER NOT NULL DEFAULT 0,\n  unread_count_close_friends INTEGER NOT NULL DEFAULT 0\n);\n\nCREATE UNIQUE INDEX IF NOT EXISTS status_info_chat_index ON status_info (chat_jid);\nCREATE INDEX IF NOT EXISTS status_info_last_status_sort_id_index\n  ON status_info (last_status_sort_id);\nCREATE INDEX IF NOT EXISTS status_info_type_index ON status_info (type);\n\nCREATE TABLE IF NOT EXISTS status_text (\n  status_row_id INTEGER PRIMARY KEY,\n  url TEXT,\n  page_title TEXT,\n  page_description TEXT,\n  font_style INTEGER,\n  text_color INTEGER,\n  background_color INTEGER,\n  preview_type INTEGER,\n  invite_link_group_type INTEGER,\n  thumbnail BLOB,\n  text_content_proto BLOB\n);\n\nCREATE TABLE IF NOT EXISTS status_media_link (\n  row_id INTEGER PRIMARY KEY AUTOINCREMENT,\n  status_row_id INTEGER NOT NULL,\n  media_content_row_id INTEGER NOT NULL\n);\n\nCREATE UNIQUE INDEX IF NOT EXISTS status_media_link_index\n  ON status_media_link (status_row_id, media_content_row_id);\nCREATE INDEX IF NOT EXISTS status_media_link_media_content_row_id_index\n  ON status_media_link (media_content_row_id);\n\nCREATE TABLE IF NOT EXISTS status_thumbnail (\n  row_id INTEGER PRIMARY KEY AUTOINCREMENT,\n  status_row_id INTEGER NOT NULL,\n  media_content_row_id INTEGER,\n  thumbnail BLOB,\n  thumbnail_path TEXT,\n  highres_thumbnail_path TEXT\n);\n\nCREATE INDEX IF NOT EXISTS status_thumbnail_status_row_id_index\n  ON status_thumbnail (status_row_id);\nCREATE INDEX IF NOT EXISTS status_thumbnail_media_content_row_id_index\n  ON status_thumbnail (media_content_row_id);\n\nCREATE TABLE IF NOT EXISTS status_seen_receipt (\n  row_id INTEGER PRIMARY KEY AUTOINCREMENT,\n  status_row_id INTEGER,\n  receipt_user_jid TEXT NOT NULL,\n  received_timestamp INTEGER,\n  seen_timestamp INTEGER\n);\n\nCREATE UNIQUE INDEX IF NOT EXISTS status_seen_receipt_index\n  ON status_seen_receipt (status_row_id, receipt_user_jid);\n\nCREATE TABLE IF NOT EXISTS status_privacy_custom_list (\n  row_id INTEGER PRIMARY KEY AUTOINCREMENT,\n  list_id TEXT NOT NULL,\n  name TEXT,\n  emoji TEXT,\n  is_selected INTEGER NOT NULL DEFAULT 0,\n  member_jids TEXT,\n  source_group_jids TEXT,\n  allow_list_selected INTEGER\n);\n\nCREATE UNIQUE INDEX IF NOT EXISTS status_privacy_custom_list_list_id_index\n  ON status_privacy_custom_list (list_id);\n\nCREATE TABLE IF NOT EXISTS key_value_store (\n  row_id INTEGER PRIMARY KEY AUTOINCREMENT,\n  key TEXT NOT NULL UNIQUE,\n  value TEXT\n);\n\nCREATE TABLE IF NOT EXISTS props (\n  _id INTEGER PRIMARY KEY AUTOINCREMENT,\n  prop_name TEXT UNIQUE,\n  prop_value TEXT\n);\n";
//# sourceMappingURL=status.d.ts.map