export { AXOLOTL_SCHEMA } from './axolotl.js';
export { CHATSETTINGS_SCHEMA } from './chatsettings.js';
export { COMPANION_DEVICES_SCHEMA } from './companion-devices.js';
export { CREDS_SCHEMA } from './creds.js';
export { LOCATION_SCHEMA } from './location.js';
export { MEDIA_SCHEMA } from './media.js';
export { MSGSTORE_SCHEMA } from './msgstore.js';
export { PAYMENTS_SCHEMA } from './payments.js';
export { PROMETHEUS_SCHEMA } from './prometheus.js';
export { SMB_SCHEMA } from './smb.js';
export { STATUS_SCHEMA } from './status.js';
export { STICKERS_SCHEMA } from './stickers.js';
export { SYNC_SCHEMA } from './sync.js';
export { WA_SCHEMA } from './wa.js';
/**
 * The 14 physical SQLite files we open in multi-DB mode, one per concern:
 *
 *   - `creds.db`             — auth credentials root + app-state sync keys
 *   - `axolotl.db`           — Signal Protocol (sessions, prekeys, identities,
 *                              sender_keys, stanza queues, base keys, kyber
 *                              prekeys, preacks)
 *   - `msgstore.db`          — JID routing, device cache, retry counters,
 *                              quarantine (subset of the canonical mobile
 *                              schema — gateway scope only)
 *   - `wa.db`                — contacts + Trusted Contact tokens
 *   - `sync.db`              — app-state sync mutations + collection versions
 *   - `media.db`             — media metadata + transfer state
 *   - `companion_devices.db` — Multi-Device companion registry
 *   - `chatsettings.db`      — per-chat preferences + notification state
 *   - `location.db`          — live location share state
 *   - `payments.db`          — payment state (consumer + merchant)
 *   - `stickers.db`          — sticker pack catalog and recent state
 *   - `smb.db`               — Small Business / Marketing Messages state
 *   - `status.db`            — Status (24h feed) + channel-crosspost state.
 *                              Schema ships ahead of callers — no Baileys
 *                              feature consumes it today, but the file is
 *                              opened so future status-feed / channel-share
 *                              features can land without retrofitting the
 *                              MULTI_DB_FILES list.
 *   - `prometheus.db`        — observability / metrics history (isolated so
 *                              high-frequency writes never contend with the
 *                              message-send hot path)
 */
export declare const MULTI_DB_FILES: readonly ["creds.db", "axolotl.db", "msgstore.db", "wa.db", "sync.db", "media.db", "companion_devices.db", "chatsettings.db", "location.db", "payments.db", "stickers.db", "smb.db", "status.db", "prometheus.db"];
export type MultiDbFile = (typeof MULTI_DB_FILES)[number];
export declare const SCHEMAS: Record<MultiDbFile, string>;
//# sourceMappingURL=index.d.ts.map