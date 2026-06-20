import type { LIDMapping, SignalKeyStoreWithTransaction } from '../Types/index.js';
import type { ILogger } from '../Utils/logger.js';
/**
 * LID Mapping Store configuration
 * Configurable via environment variables with BAILEYS_LID_* prefix
 */
export interface LIDMappingConfig {
    /** Cache TTL in milliseconds (default: 3 days) */
    cacheTtlMs: number;
    /** Maximum cache size (default: 50000 entries) */
    maxCacheSize: number;
    /** Enable cache auto-purge (default: true) */
    cacheAutoPurge: boolean;
    /** Update cache age on get (default: true) */
    updateAgeOnGet: boolean;
    /** Enable Prometheus metrics (default: false) */
    enableMetrics: boolean;
    /** Batch size for bulk operations (default: 100) */
    batchSize: number;
    /** Retry attempts for failed operations (default: 3, max: 10) */
    retryAttempts: number;
    /** Base retry delay in ms (default: 1000). Uses exponential backoff: delay * 2^(attempt-1) */
    retryDelayMs: number;
    /** Enable debug logging (default: false) */
    debugLogging: boolean;
}
/**
 * Load configuration from environment variables
 * Includes bounds validation to prevent DoS from malicious values
 */
export declare function loadLIDMappingConfig(): LIDMappingConfig;
/**
 * Statistics for monitoring and debugging
 */
export interface LIDMappingStatistics {
    /** Total cache hits */
    cacheHits: number;
    /** Total cache misses */
    cacheMisses: number;
    /** Total database hits */
    dbHits: number;
    /** Total database misses */
    dbMisses: number;
    /** Total USync fetches */
    usyncFetches: number;
    /** Total USync failures */
    usyncFailures: number;
    /** Total mappings stored */
    mappingsStored: number;
    /** Total invalid mappings rejected */
    invalidMappings: number;
    /** Current cache size */
    cacheSize: number;
    /** Cache hit rate (percentage) */
    cacheHitRate: number;
    /** Total operations */
    totalOperations: number;
    /** Failed operations */
    failedOperations: number;
    /** Store creation timestamp */
    createdAt: number;
    /** Last operation timestamp */
    lastOperationAt: number | null;
}
/**
 * Custom error for LID mapping operations
 */
export declare class LIDMappingError extends Error {
    readonly code: LIDMappingErrorCode;
    readonly details?: Record<string, unknown> | undefined;
    constructor(message: string, code: LIDMappingErrorCode, details?: Record<string, unknown> | undefined);
}
export declare enum LIDMappingErrorCode {
    INVALID_JID = "INVALID_JID",
    INVALID_MAPPING = "INVALID_MAPPING",
    DATABASE_ERROR = "DATABASE_ERROR",
    USYNC_ERROR = "USYNC_ERROR",
    CACHE_ERROR = "CACHE_ERROR",
    DESTROYED = "DESTROYED"
}
/**
 * Enterprise-grade LID Mapping Store
 *
 * Features:
 * - Environment variable configuration
 * - LRU cache with configurable TTL and size
 * - Comprehensive statistics and metrics
 * - Batch operations for bulk mappings
 * - Retry logic for failed operations
 * - Proper resource cleanup
 * - Prometheus metrics integration
 */
export declare class LIDMappingStore {
    private readonly mappingCache;
    private readonly keys;
    private readonly logger;
    private readonly config;
    private destroyed;
    /**
     * Operation counter for safe resource cleanup
     * Tracks number of operations currently in progress to prevent UAF in destroy()
     * Incremented at operation start, decremented at operation end
     */
    private operationsInProgress;
    private pnToLIDFunc?;
    /**
     * Request coalescing Maps - deduplicates concurrent lookups
     *
     * USAGE: Active in getLIDForPN() and getPNForLID() to deduplicate
     * concurrent lookups for the same user. In message bursts, multiple
     * concurrent calls share a single database lookup.
     *
     * MEMORY SAFETY: Cleared in destroy() to prevent memory leaks.
     * Pending Promises complete but won't be returned to new callers.
     *
     * THREAD SAFETY: Protected by operationsInProgress counter (V4 fix).
     * - Maps are only cleared when operationsInProgress === 0
     * - Operations using coalesceRequest() MUST be wrapped with trackOperation()
     * - This ensures maps won't be cleared while coalesceRequest() is accessing them
     */
    private readonly inflightLIDLookups;
    private readonly inflightPNLookups;
    private stats;
    constructor(keys: SignalKeyStoreWithTransaction, logger: ILogger, pnToLIDFunc?: (jids: string[]) => Promise<LIDMapping[] | undefined>, configOverride?: Partial<LIDMappingConfig>);
    /**
     * Get current configuration
     * Safe to call after destroy for debugging purposes
     */
    getConfig(): LIDMappingConfig;
    /**
     * Get current statistics
     * Safe to call after destroy for final metrics collection
     */
    getStatistics(): LIDMappingStatistics;
    /**
     * Check if store has been destroyed
     */
    isDestroyed(): boolean;
    /**
     * Warm cache with pre-loaded mappings
     * Useful for initialization with known mappings
     */
    warmCache(mappings: LIDMapping[]): Promise<{
        loaded: number;
        skipped: number;
    }>;
    /**
     * Clear all cached mappings
     */
    clearCache(): void;
    /**
     * Get cache info for monitoring
     * Safe to call after destroy for final reporting
     */
    getCacheInfo(): {
        size: number;
        maxSize: number;
        ttlMs: number;
    };
    /**
     * Store LID-PN mapping - USER LEVEL
     * Enhanced with batch operations and retry logic
     *
     * @param pairs - Array of LID-PN mappings to store
     * @returns Statistics about the operation (stored, skipped, errors)
     *
     * Note: Return type changed from void to statistics object.
     * Existing callers that ignore the return value remain compatible.
     */
    storeLIDPNMappings(pairs: LIDMapping[]): Promise<{
        stored: number;
        skipped: number;
        errors: number;
    }>;
    /**
     * Get LID for PN - Returns device-specific LID based on user mapping
     *
     * OPTIMIZATION: Uses request coalescing to deduplicate concurrent lookups
     * for the same PN. In message bursts, multiple concurrent calls for the same
     * user will share a single database lookup, reducing load and improving latency.
     *
     * Thread Safety: Protected by trackOperation() wrapper (V4 fix)
     */
    getLIDForPN(pn: string): Promise<string | null>;
    /**
     * Port of upstream PR #2614 (`fix: nest profile picture tctoken and avoid
     * usync on lookup`). Returns the LID for a PN ONLY if the mapping is
     * already known (memory cache or on-disk store). Never triggers a USync
     * lookup.
     *
     * Use this on hot paths where firing a USync just to opportunistically
     * attach metadata (e.g. profile-picture tctoken) is undesired — both
     * because the latency is wasted (the operation must still proceed if the
     * mapping is unknown) AND because USync-on-look-up is a behavioral
     * fingerprint WA Web / whatsmeow don't emit, so doing it makes our
     * traffic profile stand out and may serve as a ban signal.
     *
     * Thread safety: wrapped in `checkDestroyed()` + `trackOperation()` —
     * same contract every other public method on this store follows. Without
     * these, the async `keys.get()` could race with `destroy()` (UAF on the
     * key store) and a post-destroy call could silently return stale data.
     * (PR #510 review — addresses cubic / copilot P2.)
     */
    getKnownLIDForPN(pn: string): Promise<string | null>;
    /**
     * Get LIDs for multiple PNs - Optimized batch operation
     *
     * Note: PNs that fail database lookup are silently skipped and queued for
     * USync retry. Check statistics.failedOperations for failure counts.
     * The returned array may be smaller than input if some lookups failed.
     */
    getLIDsForPNs(pns: string[]): Promise<LIDMapping[] | null>;
    /**
     * Get PN for LID - USER LEVEL with device construction
     *
     * OPTIMIZATION: Uses request coalescing to deduplicate concurrent lookups
     * for the same LID. In message bursts, multiple concurrent calls for the same
     * user will share a single database lookup, reducing load and improving latency.
     *
     * Thread Safety: Protected by trackOperation() wrapper (V4 fix)
     */
    getPNForLID(lid: string): Promise<string | null>;
    /**
     * Get PNs for multiple LIDs - Optimized batch operation
     */
    getPNsForLIDs(lids: string[]): Promise<LIDMapping[] | null>;
    /**
     * Check if a mapping exists for a PN
     */
    hasMappingForPN(pn: string): Promise<boolean>;
    /**
     * Delete mapping from cache only (does not affect persistent storage)
     * Use this to force a fresh lookup on next access
     * @param pn - The phone number JID to remove from cache
     * @returns true if the PN was valid and cache was cleared
     */
    deleteMappingFromCache(pn: string): Promise<boolean>;
    /**
     * @deprecated Use deleteMappingFromCache instead - name clarifies cache-only behavior
     */
    deleteMapping(pn: string): Promise<boolean>;
    /**
     * Destroy the store and clean up resources
     * CRITICAL: Call this when done to prevent memory leaks
     *
     * IMPORTANT BEHAVIOR (following auth-utils.ts pattern):
     * - Always sets destroyed=true to prevent NEW operations
     * - If operations are active (operationsInProgress > 0), returns early WITHOUT destroying resources
     * - This creates intentional temporary inconsistent state:
     *   * destroyed=true (new operations rejected)
     *   * resources exist (active operations complete safely)
     *   * resources cleaned up by GC after active operations finish
     * - If no active operations, destroys resources immediately
     */
    destroy(): void;
    /**
     * Check if store has been destroyed and throw if so
     *
     * NOTE: This is a fail-fast guard with TOCTOU window.
     * Critical operations must use trackOperation() wrapper for atomic safety.
     */
    private checkDestroyed;
    /**
     * Track operation lifecycle for safe resource cleanup
     * Wraps operation execution with counter increment/decrement
     *
     * CRITICAL SAFETY: Prevents UAF by tracking active operations.
     * destroy() will NOT clean resources if operations are in progress.
     *
     * @param operation - Async operation to execute
     * @returns Promise with operation result
     */
    private trackOperation;
    /**
     * Validate a LID-PN mapping pair
     * Checks that one is a LID and the other is a PN (in either order)
     */
    private isValidMapping;
    /**
     * Build device-specific JID
     */
    private buildDeviceSpecificJid;
    /**
     * Chunk array into smaller arrays for batch processing
     */
    private chunkArray;
    /**
     * Retry an operation with exponential backoff
     * Supports both Promise and Awaitable return types
     *
     * Delay pattern: baseDelay * 2^(attempt-1)
     * - Attempt 1: immediate
     * - Attempt 2: baseDelay * 1 (e.g., 1000ms)
     * - Attempt 3: baseDelay * 2 (e.g., 2000ms)
     * - Attempt 4: baseDelay * 4 (e.g., 4000ms)
     *
     * Configure via: BAILEYS_LID_RETRY_ATTEMPTS (default: 3)
     *                BAILEYS_LID_RETRY_DELAY_MS (default: 1000)
     */
    private retryOperation;
    /**
     * Sleep for specified milliseconds
     */
    private sleep;
    /**
     * Fetch mappings from USync
     */
    private fetchFromUSync;
    /**
     * Request coalescing helper - deduplicates concurrent lookups for same key
     *
     * SAFETY GUARANTEES:
     * - No UAF (Use-After-Free): Caller must use trackOperation() wrapper, which prevents
     *   resource cleanup during execution via operationsInProgress counter
     * - No TOCTOU: Destroyed check done once at operation start (no redundant rechecks)
     * - Thread-safe: Maps protected by operationsInProgress (V4) and usage contract (V5)
     *
     * USAGE REQUIREMENTS:
     * - MUST be called from within trackOperation() (enforced by V5 documentation)
     * - Caller MUST have called checkDestroyed() before entering tracked operation
     * - DO NOT call directly from unwrapped operations
     *
     * @param key - Lookup key (e.g., pnUser for LID lookup)
     * @param map - The inflight Map to use
     * @param fetchFn - Function to execute if no inflight request exists
     * @returns Promise that resolves to the result
     */
    private coalesceRequest;
    /**
     * Record metrics if enabled (with buffer support for async loading)
     * Note: Actual metric recording is not yet implemented
     */
    private recordMetrics;
}
//# sourceMappingURL=lid-mapping.d.ts.map