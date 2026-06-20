import type { SignalDataSet, SignalDataTypeMap, SignalKeyStore } from '../Types/index.js';
import type { ILogger } from './logger.js';
/**
 * Pre-key validation + transactional-cache projection.
 *
 * Stage 1 (upstream #2571) dropped the per-instance `PQueue` map that used
 * to live here. All serialization now happens through the {@link LockManager}
 * held by the caller (`auth-utils.addTransactionCapability`), so the
 * validation read and the durable write share one critical section (closes
 * the H2 race).
 *
 * Methods here are pure data-mutation helpers — they assume the caller is
 * already holding any locks required by the store contract.
 *
 * InfiniteAPI customization preserved: `destroyed` flag + `checkDestroyed()`
 * remain as defensive guards against operations after `destroy()` is called
 * (e.g. on socket close). The original purpose was to prevent enqueueing
 * tasks on cleared queues — even without queues, we keep the flag so a
 * post-destroy `processOperations()` call surfaces as an explicit error
 * instead of silently mutating data on a torn-down manager.
 */
export declare class PreKeyManager {
    private readonly store;
    private readonly logger;
    /**
     * Defensive flag — guards method ENTRY against operations after `destroy()`
     * is called. `checkDestroyed()` runs synchronously at the top of each
     * public method, so a caller that hasn't yet entered cannot proceed once
     * `destroyed=true` is observed.
     *
     * Not a full memory barrier: once a method passes the entry guard, it can
     * await internally and the destroyed flag may flip during the await. The
     * stronger "drain in-flight operations before teardown" guarantee lives
     * one level up in `auth-utils.addTransactionCapability.destroy()` via the
     * `activeTransactions` counter (PR #453) — that's where actual concurrent-
     * with-destroy safety is enforced. This flag is just the entry barrier.
     *
     * Preserved from InfiniteAPI's pre-Stage-1 PreKeyManager. Upstream dropped
     * this protection but our socket close path benefits from it (avoids
     * late callers mutating a torn-down manager during reconnect).
     */
    private destroyed;
    constructor(store: SignalKeyStore, logger: ILogger);
    /**
     * Check if manager has been destroyed.
     * @throws Error if manager has been destroyed
     */
    private checkDestroyed;
    /**
     * In-transaction processing: apply updates to the in-memory cache &
     * mutation set, and route deletions through {@link processDeletions}.
     * Caller holds the outer transaction lock.
     */
    processOperations<T extends keyof SignalDataTypeMap>(data: SignalDataSet, keyType: T, transactionCache: SignalDataSet, mutations: SignalDataSet, isInTransaction: boolean): Promise<void>;
    /**
     * Non-transactional pre-deletion validation: drop deletions from `data`
     * whose targets don't exist in the store. Mutates `data` in place. The
     * caller is expected to hold a lock that spans this validation read *and*
     * the subsequent durable write — otherwise a concurrent writer can flip
     * the existence state between our read and the caller's write (H2).
     */
    validateDeletions<T extends keyof SignalDataTypeMap>(data: SignalDataSet, keyType: T): Promise<void>;
    private processDeletions;
    /**
     * Mark this manager as destroyed. After this call, all operations
     * (`processOperations`, `validateDeletions`) throw via `checkDestroyed()`.
     *
     * Stage 1 (upstream #2571) removed PQueue management here — there's
     * nothing to physically clean up anymore (lock state lives in the
     * caller's LockManager). We keep this method as the operational signal
     * that no further work should be accepted, matching the destroyed-flag
     * contract used by `auth-utils.addTransactionCapability.destroy()`.
     */
    destroy(): void;
}
//# sourceMappingURL=pre-key-manager.d.ts.map