import type { SessionCleanupConfig, SessionCleanupStats, SignalKeyStoreWithTransaction } from '../Types/index.js';
import type { ILogger } from '../Utils/logger.js';
import type { LIDMappingStore } from './lid-mapping.js';
import type { SessionActivityTracker } from './session-activity-tracker.js';
export type { SessionCleanupConfig, SessionCleanupStats };
/**
 * Creates a session cleanup manager
 *
 * SAFETY GUARANTEES:
 * - Does NOT affect WebSocket connections (only local database)
 * - Does NOT cause message loss (Signal Protocol auto-recreates sessions)
 * - Runs in low-traffic hours (configurable, default 3am)
 * - Atomic transactions (all-or-nothing)
 * - Comprehensive logging and statistics
 *
 * CLEANUP RULES:
 * 1. Secondary devices (Web, Desktop) - Inactive > X days (default: 15)
 * 2. Primary devices - Inactive > Y days (default: 30)
 * 3. LID orphans (no PN mapping) - Inactive > Z hours (default: 24)
 *
 * @param keys - Signal key store with transaction support
 * @param lidMapping - LID mapping store for orphan detection
 * @param sessionActivityTracker - Session activity tracker for timestamp-based cleanup
 * @param logger - Structured logger instance
 * @param config - Cleanup configuration (uses defaults from env)
 */
export declare const makeSessionCleanup: (keys: SignalKeyStoreWithTransaction, lidMapping: LIDMappingStore, sessionActivityTracker: SessionActivityTracker | null, logger: ILogger, config?: SessionCleanupConfig) => {
    start: () => void;
    stop: () => void;
    runCleanup: () => Promise<SessionCleanupStats>;
    getStats: () => {
        enabled: boolean;
        lastCleanupAt: number;
        cleanupRunning: boolean;
        config: SessionCleanupConfig;
    };
};
/**
 * Session cleanup manager type
 */
export type SessionCleanupManager = ReturnType<typeof makeSessionCleanup>;
//# sourceMappingURL=session-cleanup.d.ts.map