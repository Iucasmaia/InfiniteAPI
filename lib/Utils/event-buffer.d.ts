import type { BaileysEventEmitter, BaileysEventMap } from '../Types/index.js';
import type { ILogger } from './logger.js';
/**
 * Buffer configuration loaded from environment variables
 * Allows runtime customization without code changes
 */
export interface BufferConfig {
    /** Maximum buffer timeout in milliseconds */
    bufferTimeoutMs: number;
    /** Minimum buffer timeout for adaptive algorithm */
    minBufferTimeoutMs: number;
    /** Maximum buffer timeout for adaptive algorithm */
    maxBufferTimeoutMs: number;
    /** Maximum history cache size before cleanup */
    maxHistoryCacheSize: number;
    /** Maximum events before forcing a flush (overflow protection) */
    maxBufferSize: number;
    /** Debounce delay for flush after buffered function */
    flushDebounceMs: number;
    /** Enable adaptive timeout based on load */
    enableAdaptiveTimeout: boolean;
    /** Enable Prometheus metrics */
    enableMetrics: boolean;
    /** LRU cleanup percentage (0-1) when cache exceeds max */
    lruCleanupRatio: number;
    /** Warn threshold for buffer size (percentage of max) */
    bufferWarnThreshold: number;
}
/**
 * Load buffer configuration from environment variables
 * Uses BAILEYS_BUFFER_* prefix for consistency
 */
export declare function loadBufferConfig(): BufferConfig;
/**
 * A map that contains a list of all events that have been triggered
 *
 * Note, this can contain different type of events
 * this can make processing events extremely efficient -- since everything
 * can be done in a single transaction
 */
type BaileysEventData = Partial<BaileysEventMap>;
/**
 * Statistics about buffer operations for monitoring and debugging
 */
export interface BufferStatistics {
    /** Total number of flushes performed */
    totalFlushes: number;
    /** Total number of forced flushes (overflow/timeout) */
    forcedFlushes: number;
    /** Total events buffered */
    totalEventsBuffered: number;
    /** Current buffer size */
    currentBufferSize: number;
    /** Peak buffer size reached */
    peakBufferSize: number;
    /** Total buffer overflows prevented */
    overflowsDetected: number;
    /** Current adaptive timeout */
    currentTimeout: number;
    /** History cache size */
    historyCacheSize: number;
    /** LRU cleanups performed */
    lruCleanups: number;
    /** Average events per flush */
    avgEventsPerFlush: number;
    /** Buffer creation timestamp */
    createdAt: number;
    /** Last flush timestamp */
    lastFlushAt: number | null;
}
type BaileysBufferableEventEmitter = BaileysEventEmitter & {
    /** Use to process events in a batch */
    process(handler: (events: BaileysEventData) => void | Promise<void>): () => void;
    /**
     * starts buffering events, call flush() to release them
     */
    buffer(): void;
    /** buffers all events till the promise completes */
    createBufferedFunction<A extends any[], T>(work: (...args: A) => Promise<T>): (...args: A) => Promise<T>;
    /**
     * flushes all buffered events
     * @param force - If true, flush even if buffer is empty or not buffering
     * @returns returns true if the flush actually happened, otherwise false
     */
    flush(force?: boolean): boolean;
    /** is there an ongoing buffer */
    isBuffering(): boolean;
    /**
     * Destroy the buffer and clean up all resources
     * CRITICAL: Call this when done to prevent memory leaks
     */
    destroy(): void;
    /** Check if buffer has been destroyed */
    isDestroyed(): boolean;
    /** Get buffer statistics for monitoring */
    getStatistics(): BufferStatistics;
    /** Get current configuration */
    getConfig(): BufferConfig;
};
/**
 * The event buffer logically consolidates different events into a single event
 * making the data processing more efficient.
 *
 * Enterprise-grade features:
 * - Environment variable configuration
 * - Proper resource cleanup (destroy method)
 * - Buffer overflow detection and prevention
 * - Adaptive timeout based on event rate
 * - LRU cache cleanup instead of full clear
 * - Prometheus metrics integration
 * - Force flush capability
 * - Comprehensive statistics
 */
export declare const makeEventBuffer: (logger: ILogger, configOverride?: Partial<BufferConfig>) => BaileysBufferableEventEmitter;
export {};
//# sourceMappingURL=event-buffer.d.ts.map