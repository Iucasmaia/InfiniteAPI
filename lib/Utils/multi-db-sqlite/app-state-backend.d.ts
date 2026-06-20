/**
 * Phase 9.7 — typed app-state sync storage backed by `sync.db`.
 *
 * Replaces the multi-file blob storage with the canonical mobile schema:
 *
 *   - `collection_versions` — one row per collection (regular, critical,
 *     etc.) with `version` (monotonic counter), `lt_hash` (LT-Hash digest
 *     of the collection contents), and `dirty_version` (sentinel for
 *     dirty-bit set during a resync attempt).
 *   - `syncd_mutations` — committed mutations log, ordered by `_id`. The
 *     gateway replays from this table when a peer device requests an
 *     incremental sync.
 *   - `pending_mutations` — uncommitted mutations awaiting server ACK.
 *
 * Column names match the canonical schema verbatim.
 */
import type { SqliteDbLike } from './types.js';
export type CollectionVersionRow = {
    collectionName: string;
    version: number;
    ltHash?: Buffer | null;
    dirtyVersion: number;
};
export type SyncdMutationRow = {
    id: number;
    mutationIndex: string;
    mutationValue?: Buffer | null;
    mutationVersion: number;
    collectionName: string;
    areDependenciesMissing: number;
    mutationMac?: Buffer | null;
    deviceId: number;
    epoch: number;
    chatJid?: string | null;
    mutationName?: string | null;
};
export declare class AppStateBackend {
    private readonly stmts;
    private readonly db;
    constructor(db: SqliteDbLike);
    setCollectionVersion(row: CollectionVersionRow): void;
    getCollectionVersion(collectionName: string): CollectionVersionRow | null;
    listCollectionVersions(): CollectionVersionRow[];
    insertMutation(row: Omit<SyncdMutationRow, 'id'>): number;
    listMutations(collectionName: string): SyncdMutationRow[];
    listMutationsSince(collectionName: string, sinceVersion: number): SyncdMutationRow[];
    clearCollection(collectionName: string): number;
}
//# sourceMappingURL=app-state-backend.d.ts.map