import type { AuthenticationCreds, CacheStore, SignalKeyStore, SignalKeyStoreWithRecordTransaction, TransactionCapabilityOptions } from '../Types/index.js';
import type { ILogger } from './logger.js';
/**
 * Adds caching capability to a SignalKeyStore
 * @param store the store to add caching to
 * @param logger to log trace events
 * @param _cache cache store to use
 */
export declare function makeCacheableSignalKeyStore(store: SignalKeyStore, logger?: ILogger, _cache?: CacheStore): SignalKeyStore;
/**
 * Adds DB-like transaction capability to the SignalKeyStore
 * Uses AsyncLocalStorage for automatic context management
 * @param state the key store to apply this capability to
 * @param logger logger to log events
 * @returns SignalKeyStore with transaction capability
 */
export declare const addTransactionCapability: (state: SignalKeyStore, logger: ILogger, { maxCommitRetries, delayBetweenTriesMs }: TransactionCapabilityOptions) => SignalKeyStoreWithRecordTransaction;
/**
 * Pure helper que devolve `creds.me.id` ou lança `Boom 401` se a socket
 * ainda não autenticou. Mantém o uso DRY em vez de espalhar checks inline
 * (`creds.me?.id` || throw) por messages-send e callers que pré-supõem
 * autenticação concluída. Port parcial de upstream `798f2a93b9` (PR #1892).
 */
export declare const assertMeId: (creds: AuthenticationCreds) => string;
export declare const initAuthCreds: () => AuthenticationCreds;
//# sourceMappingURL=auth-utils.d.ts.map