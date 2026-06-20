/**
 * Schema for `location.db` — live location share state.
 *
 * Caches the latest reported position per contact, tracks key-distribution
 * acknowledgement state for the group-key rotation, and records active
 * sharer expiry per chat. Column names match the canonical mobile schema
 * verbatim.
 */
export declare const LOCATION_SCHEMA = "\nCREATE TABLE IF NOT EXISTS android_metadata (locale TEXT);\n\nCREATE TABLE IF NOT EXISTS location_cache (\n  _id INTEGER PRIMARY KEY AUTOINCREMENT,\n  jid TEXT NOT NULL DEFAULT '',\n  latitude REAL NOT NULL DEFAULT 0.0,\n  longitude REAL NOT NULL DEFAULT 0.0,\n  accuracy INTEGER NOT NULL DEFAULT 0,\n  speed REAL NOT NULL DEFAULT 0.0,\n  bearing INTEGER NOT NULL DEFAULT 0,\n  location_ts INTEGER NOT NULL DEFAULT 0\n);\n\nCREATE UNIQUE INDEX IF NOT EXISTS user_location_index ON location_cache (jid);\n\nCREATE TABLE IF NOT EXISTS location_key_distribution (\n  _id INTEGER PRIMARY KEY AUTOINCREMENT,\n  jid TEXT NOT NULL DEFAULT '',\n  sent_to_server BOOLEAN NOT NULL DEFAULT 0\n);\n\nCREATE UNIQUE INDEX IF NOT EXISTS location_key_distribution_index\n  ON location_key_distribution (jid);\n\nCREATE TABLE IF NOT EXISTS location_sharer (\n  _id INTEGER PRIMARY KEY AUTOINCREMENT,\n  remote_jid TEXT NOT NULL DEFAULT '',\n  from_me BOOLEAN NOT NULL DEFAULT 0,\n  remote_resource TEXT NOT NULL DEFAULT '',\n  expires INTEGER NOT NULL DEFAULT 0,\n  message_id TEXT NOT NULL DEFAULT ''\n);\n\nCREATE UNIQUE INDEX IF NOT EXISTS location_sharer_index\n  ON location_sharer (remote_jid, from_me, remote_resource, message_id);\n\nCREATE TABLE IF NOT EXISTS props (\n  _id INTEGER PRIMARY KEY AUTOINCREMENT,\n  prop_name TEXT UNIQUE,\n  prop_value TEXT\n);\n";
//# sourceMappingURL=location.d.ts.map