export { MultiDbSqliteStore, type MultiDbSqliteStoreOptions } from './store.js';
export { useMultiDbSqliteAuthState, type UseMultiDbSqliteAuthStateOptions } from './use-multi-db-sqlite-auth-state.js';
export { MULTI_DB_FILES, SCHEMAS, type MultiDbFile } from './schemas/index.js';
export { JidMapBackend, REVERSE_SUFFIX, stripReverse } from './lid-mapping-backend.js';
export { wrapKeysWithJidMap } from './keys-with-jid-map.js';
export { createLIDMappingStoreWithSqlite } from './factories.js';
export { UserDeviceBackend, type StoredDeviceRow } from './user-device-backend.js';
export { UserDeviceCacheSqliteAdapter, type NodeCacheLike, type UserDeviceCacheAdapterOptions } from './user-device-cache-adapter.js';
export { MsgRetryCounterSqliteAdapter, type CacheStoreShape, type MsgRetryCounterAdapterOptions } from './msg-retry-counter-adapter.js';
export { MessageQuarantineBackend, type QuarantineRecord, type StoredQuarantineRow } from './quarantine-backend.js';
export { TrustedContactsBackend, type TrustedContactsBackendStats } from './trusted-contacts-backend.js';
export { AppStateBackend, type CollectionVersionRow, type SyncdMutationRow } from './app-state-backend.js';
export { SignalTypedBackend, type SignalSessionKey, type SignalIdentityKey, type SignalSenderKeyKey } from './signal-typed-backend.js';
//# sourceMappingURL=index.d.ts.map