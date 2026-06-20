import type { SignalKeyStoreWithTransaction } from '../Types/index.js';
import type { ILogger } from '../Utils/logger.js';
/**
 * Session activity tracker configuration
 */
export interface SessionActivityConfig {
    /** Flush interval in milliseconds (default: 60s) */
    flushIntervalMs: number;
    /** Enable activity tracking (default: true) */
    enabled: boolean;
}
/**
 * Default configuration for session activity tracking
 */
export declare const DEFAULT_SESSION_ACTIVITY_CONFIG: SessionActivityConfig;
/**
 * Session activity metadata stored in key store
 */
export interface SessionActivityMetadata {
    /** Last activity timestamp (Unix milliseconds) */
    lastActivityAt: number;
    /** Session created timestamp (Unix milliseconds) */
    createdAt?: number;
}
/**
 * Session Activity Tracker
 *
 * Tracks when sessions were last used (message sent/received) to enable
 * cleanup of inactive sessions.
 *
 * PERFORMANCE OPTIMIZATION:
 * - In-memory cache: Updates stored in Map (no disk I/O per message)
 * - Periodic flush: Writes to disk every 60s (configurable)
 * - Batch writes: All updates written in single transaction
 *
 * OVERHEAD: <0.1ms per message (just Map.set() in memory)
 *
 * @example
 * const tracker = makeSessionActivityTracker(keys, logger)
 * tracker.start()
 *
 * // On message send/receive:
 * tracker.recordActivity('5511999999999@s.whatsapp.net')
 *
 * // On cleanup:
 * const lastActivity = await tracker.getLastActivity('5511999999999@s.whatsapp.net')
 * if (Date.now() - lastActivity > 30_DAYS) {
 *   // Delete session
 * }
 */
export declare const makeSessionActivityTracker: (keys: SignalKeyStoreWithTransaction, logger: ILogger, config?: SessionActivityConfig) => {
    recordActivity: (jid: string) => void;
    getLastActivity: (jid: string) => Promise<number | undefined>;
    getAllActivities: () => Promise<Map<string, number>>;
    flush: () => Promise<void>;
    start: () => void;
    stop: () => Promise<void>;
    getStats: () => {
        totalUpdates: number;
        totalFlushes: number;
        lastFlushAt: number;
        lastFlushDuration: number;
        cacheSize: number;
        enabled: boolean;
    };
};
/**
 * Session activity tracker type
 */
export type SessionActivityTracker = ReturnType<typeof makeSessionActivityTracker>;
//# sourceMappingURL=session-activity-tracker.d.ts.map