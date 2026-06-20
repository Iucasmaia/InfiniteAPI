/**
 * Phase 9.2 — typed `user_device` + `user_device_info` + `primary_device_version`
 * SQLite-backed storage for the device-list cache.
 *
 * Replaces the in-RAM `userDevicesCache` (Map<userJid, { devices, expiry }>)
 * with the canonical mobile schema. The native `expected_timestamp` column
 * in `user_device_info` gives us a TTL value without an application-level
 * eviction loop — call sites can read the column and decide whether to
 * refetch in the same query.
 *
 * Storage model:
 *   - `user_device`: one row per (user, device) pair, with the original
 *     `key_index` preserved (the index ADV uses to address the device key
 *     in the registration).
 *   - `user_device_info`: per-user metadata — `raw_id` (numeric WhatsApp
 *     device list version), `timestamp` (last refresh time), and
 *     `expected_timestamp` (the freshness target). When `now > expected_ts`
 *     the caller should refetch.
 *   - `primary_device_version`: short-circuit cache. If `version` matches
 *     the server-reported one we know the device list is still current and
 *     skip the refetch entirely.
 */
import type { SqliteDbLike } from './types.js';
/**
 * Resolved device record returned by lookups.
 *
 * `userJidRowId` and `deviceJidRowId` are the row IDs in the local `jid`
 * table. Caller-side resolution to raw JIDs (e.g. `user@s.whatsapp.net.X`)
 * happens via the `jid` table join (the {@link JidMapBackend.rowIdFor}
 * helper materializes rows on insert).
 */
export type StoredDeviceRow = {
    userJidRowId: number;
    deviceJidRowId: number;
    keyIndex: number;
};
/**
 * Typed operations on `msgstore.db` user device tables.
 */
export declare class UserDeviceBackend {
    private readonly stmts;
    private readonly db;
    constructor(db: SqliteDbLike);
    /**
     * Replace the device set for a user. Atomic: deletes old rows + inserts
     * the new set + updates info in a single transaction.
     */
    replaceDevices(userJidRowId: number, devices: ReadonlyArray<{
        deviceJidRowId: number;
        keyIndex?: number;
    }>, info: {
        rawId: number;
        timestamp: number;
        expectedTimestamp: number;
    }): void;
    /** Returns all device rows for a user (empty array if none). */
    listDevices(userJidRowId: number): StoredDeviceRow[];
    /**
     * Returns the info row for a user (timestamp + expected_timestamp +
     * raw_id), or `null` if no entry exists. Callers compare `now` against
     * `expected_timestamp` to decide whether to refetch.
     */
    getInfo(userJidRowId: number): {
        rawId: number;
        timestamp: number;
        expectedTimestamp: number | null;
    } | null;
    /**
     * Returns `true` if the cached device list is still fresh by the
     * `expected_timestamp` policy (i.e. `now <= expected_timestamp`). False
     * if expired or absent.
     */
    isFresh(userJidRowId: number, now?: number): boolean;
    /**
     * Bumps the per-user `primary_device_version` short-circuit. If the
     * server reports the same version on the next sync, the caller can skip
     * refetching the full device list.
     */
    setPrimaryDeviceVersion(userJidRowId: number, version: number): void;
    /** Returns the cached primary device version, or `null` if unknown. */
    getPrimaryDeviceVersion(userJidRowId: number): number | null;
}
//# sourceMappingURL=user-device-backend.d.ts.map