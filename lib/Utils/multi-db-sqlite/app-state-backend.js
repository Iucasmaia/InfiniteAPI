export class AppStateBackend {
    constructor(db) {
        this.db = db;
        this.stmts = {
            upsertCollectionVersion: this.db.prepare('INSERT INTO collection_versions (collection_name, version, lt_hash, dirty_version) ' +
                'VALUES (?, ?, ?, ?) ' +
                'ON CONFLICT(collection_name) DO UPDATE SET ' +
                '  version = excluded.version, lt_hash = excluded.lt_hash, dirty_version = excluded.dirty_version'),
            selectCollectionVersion: this.db.prepare('SELECT collection_name, version, lt_hash, dirty_version FROM collection_versions ' +
                'WHERE collection_name = ?'),
            listCollectionVersions: this.db.prepare('SELECT collection_name, version, lt_hash, dirty_version FROM collection_versions'),
            insertSyncdMutation: this.db.prepare('INSERT INTO syncd_mutations (mutation_index, mutation_value, mutation_version, collection_name, ' +
                'are_dependencies_missing, mutation_mac, device_id, epoch, chat_jid, mutation_name) ' +
                'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
            selectMutationsByCollection: this.db.prepare('SELECT _id, mutation_index, mutation_value, mutation_version, collection_name, ' +
                'are_dependencies_missing, mutation_mac, device_id, epoch, chat_jid, mutation_name ' +
                'FROM syncd_mutations WHERE collection_name = ? ORDER BY _id ASC'),
            selectMutationsByVersionRange: this.db.prepare('SELECT _id, mutation_index, mutation_value, mutation_version, collection_name, ' +
                'are_dependencies_missing, mutation_mac, device_id, epoch, chat_jid, mutation_name ' +
                'FROM syncd_mutations WHERE collection_name = ? AND mutation_version > ? ' +
                'ORDER BY mutation_version ASC'),
            deleteMutationsByCollection: this.db.prepare('DELETE FROM syncd_mutations WHERE collection_name = ?')
        };
    }
    setCollectionVersion(row) {
        this.stmts.upsertCollectionVersion.run(row.collectionName, row.version, row.ltHash ?? null, row.dirtyVersion);
    }
    getCollectionVersion(collectionName) {
        const r = this.stmts.selectCollectionVersion.get(collectionName);
        if (!r)
            return null;
        return {
            collectionName: r.collection_name,
            version: r.version,
            ltHash: r.lt_hash,
            dirtyVersion: r.dirty_version
        };
    }
    listCollectionVersions() {
        const rows = this.stmts.listCollectionVersions.all();
        return rows.map(r => ({
            collectionName: r.collection_name,
            version: r.version,
            ltHash: r.lt_hash,
            dirtyVersion: r.dirty_version
        }));
    }
    insertMutation(row) {
        const res = this.stmts.insertSyncdMutation.run(row.mutationIndex, row.mutationValue ?? null, row.mutationVersion, row.collectionName, row.areDependenciesMissing, row.mutationMac ?? null, row.deviceId, row.epoch, row.chatJid ?? null, row.mutationName ?? null);
        return Number(res.lastInsertRowid);
    }
    listMutations(collectionName) {
        const rows = this.stmts.selectMutationsByCollection.all(collectionName);
        return rows.map(mapMutationRow);
    }
    listMutationsSince(collectionName, sinceVersion) {
        const rows = this.stmts.selectMutationsByVersionRange.all(collectionName, sinceVersion);
        return rows.map(mapMutationRow);
    }
    clearCollection(collectionName) {
        const r = this.stmts.deleteMutationsByCollection.run(collectionName);
        return r.changes;
    }
}
function mapMutationRow(r) {
    return {
        id: r._id,
        mutationIndex: r.mutation_index,
        mutationValue: r.mutation_value,
        mutationVersion: r.mutation_version,
        collectionName: r.collection_name,
        areDependenciesMissing: r.are_dependencies_missing,
        mutationMac: r.mutation_mac,
        deviceId: r.device_id,
        epoch: r.epoch,
        chatJid: r.chat_jid,
        mutationName: r.mutation_name
    };
}
//# sourceMappingURL=app-state-backend.js.map