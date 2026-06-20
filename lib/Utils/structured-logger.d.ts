/**
 * Structured Logging System for InfiniteAPI
 *
 * Enterprise-grade features:
 * - Environment variable configuration (BAILEYS_LOG_*)
 * - Configurable log levels (trace, debug, info, warn, error, fatal)
 * - JSON formatting for log analysis
 * - Hierarchical context with child loggers
 * - External system integration via hooks
 * - Logging metrics with Prometheus integration
 * - Sensitive data sanitization
 * - Log buffering for batch writes
 * - Rate limiting to prevent flooding
 * - Async logging queue for non-blocking operations
 * - Proper resource cleanup (destroy)
 *
 * @module Utils/structured-logger
 */
import type { ILogger } from './logger.js';
/**
 * Available log levels (ordered by severity)
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';
/**
 * Numeric values for each log level
 */
export declare const LOG_LEVEL_VALUES: Record<LogLevel, number>;
/**
 * Structured logger configuration
 */
export interface StructuredLoggerConfig {
    /** Minimum log level to record */
    level: LogLevel;
    /** Service/component name */
    name?: string;
    /** Additional context to include in all logs */
    context?: Record<string, unknown>;
    /** Format as JSON (true) or human-readable text (false) */
    jsonFormat?: boolean;
    /** Fields to sanitize (passwords, tokens, etc.) */
    redactFields?: string[];
    /** Hook for sending logs to external systems */
    externalHook?: (entry: LogEntry) => void | Promise<void>;
    /** Include stack trace in errors */
    includeStackTrace?: boolean;
    /** Timezone for timestamps (default: UTC) */
    timezone?: string;
    /** Enable log buffering for batch writes */
    enableBuffering?: boolean;
    /** Buffer flush interval in ms (default: 1000) */
    bufferFlushIntervalMs?: number;
    /** Maximum buffer size before auto-flush (default: 100) */
    maxBufferSize?: number;
    /** Enable rate limiting (default: false) */
    enableRateLimiting?: boolean;
    /** Max logs per second (default: 1000) */
    maxLogsPerSecond?: number;
    /** Enable async logging queue (default: false) */
    enableAsyncQueue?: boolean;
    /** Enable Prometheus metrics integration (default: false) */
    enableMetrics?: boolean;
}
/**
 * Load configuration from environment variables
 */
export declare function loadLoggerConfig(): Partial<StructuredLoggerConfig>;
/**
 * Structured log entry
 */
export interface LogEntry {
    /** ISO 8601 timestamp */
    timestamp: string;
    /** Log level */
    level: LogLevel;
    /** Numeric level value */
    levelValue: number;
    /** Main message */
    message: string;
    /** Logger/component name */
    name?: string;
    /** Additional context */
    context?: Record<string, unknown>;
    /** Logged object data */
    data?: Record<string, unknown>;
    /** Stack trace (for errors) */
    stack?: string;
    /** Correlation ID for tracing */
    correlationId?: string;
    /** Operation duration in ms (if applicable) */
    durationMs?: number;
}
/**
 * Logger metrics
 */
export interface LoggerMetrics {
    totalLogs: number;
    logsByLevel: Record<LogLevel, number>;
    errorsCount: number;
    lastLogTimestamp?: string;
    /** Logs dropped due to rate limiting */
    droppedLogs: number;
    /** Buffer flushes performed */
    bufferFlushes: number;
    /** External hook failures */
    hookFailures: number;
    /** Average log processing time in ms */
    avgProcessingTimeMs: number;
}
/**
 * Logger statistics for monitoring
 */
export interface LoggerStatistics extends LoggerMetrics {
    /** Buffer current size */
    bufferSize: number;
    /** Rate limiter tokens available */
    rateLimiterTokens: number;
    /** Queue size (if async enabled) */
    queueSize: number;
    /** Created timestamp */
    createdAt: number;
    /** Uptime in ms */
    uptimeMs: number;
}
/**
 * Structured Logger main class
 *
 * Enterprise-grade features:
 * - Environment variable configuration
 * - Log buffering for batch writes
 * - Rate limiting to prevent flooding
 * - Async logging queue
 * - External hooks for integrations
 * - Prometheus metrics integration
 *
 * @example
 * ```typescript
 * const logger = createStructuredLogger({
 *   level: 'info',
 *   name: 'my-service',
 *   jsonFormat: true,
 *   enableBuffering: true,
 *   enableRateLimiting: true
 * })
 *
 * logger.info({ userId: '123' }, 'User logged in')
 * logger.error(new Error('Connection failed'))
 *
 * // Cleanup when done
 * logger.destroy()
 * ```
 */
export declare class StructuredLogger implements ILogger {
    private config;
    private metrics;
    private childContext;
    private destroyed;
    private createdAt;
    private buffer;
    private bufferFlushTimer;
    private rateLimiter;
    private asyncQueue;
    private totalProcessingTime;
    private processedLogs;
    private metricsModule;
    constructor(config: StructuredLoggerConfig);
    /**
     * Get current log level (ILogger compatibility)
     */
    get level(): string;
    /**
     * Set log level
     */
    set level(newLevel: string);
    /**
     * Check if logger has been destroyed
     */
    isDestroyed(): boolean;
    /**
     * Create a child logger with additional context.
     *
     * Children DO NOT spin up their own buffer timer / async queue / rate
     * limiter. Each `child()` call previously did `new StructuredLogger(
     * {...this.config})`, which preserved `enableBuffering` and so allocated
     * a fresh `setInterval` per child. In Baileys, `logger.child({class: 'x'})`
     * is called pervasively (every handler, every component), so on a high-
     * fanout deployment that pattern produced thousands of unrelated timers.
     * Children now disable buffering/queue/rate-limit locally and let the
     * root logger own the single resource. The behavior is preserved at the
     * write boundary — output still goes through `console.{debug,info,warn,
     * error}` synchronously inside the child — only the resource lifecycle
     * moves up to the root.
     */
    child(obj: Record<string, unknown>): StructuredLogger;
    /**
     * Check if log level is enabled
     */
    isLevelEnabled(level: LogLevel): boolean;
    /**
     * Main logging method
     */
    private log;
    /**
     * Flush buffered logs
     */
    flushBuffer(): void;
    /**
     * Create a structured log entry
     */
    private createLogEntry;
    /**
     * Sanitize sensitive data
     */
    private sanitize;
    /**
     * Update internal metrics
     */
    private updateMetrics;
    /**
     * Output log entry
     */
    private output;
    /**
     * Format log as human-readable text
     */
    private formatText;
    trace(obj: unknown, msg?: string): void;
    debug(obj: unknown, msg?: string): void;
    info(obj: unknown, msg?: string): void;
    warn(obj: unknown, msg?: string): void;
    error(obj: unknown, msg?: string): void;
    fatal(obj: unknown, msg?: string): void;
    /**
     * Log with temporary context
     */
    withContext(context: Record<string, unknown>): StructuredLogger;
    /**
     * Log with correlation ID
     */
    withCorrelationId(correlationId: string): StructuredLogger;
    /**
     * Log operation with duration tracking
     */
    logOperation<T>(operationName: string, operation: () => T | Promise<T>, level?: LogLevel): T | Promise<T>;
    /**
     * Get logger metrics
     */
    getMetrics(): LoggerMetrics;
    /**
     * Get comprehensive statistics
     */
    getStatistics(): LoggerStatistics;
    /**
     * Reset metrics
     */
    resetMetrics(): void;
    /**
     * Destroy the logger and clean up resources
     * CRITICAL: Call this when done to prevent memory leaks
     */
    destroy(): void;
}
/**
 * Factory to create structured logger
 */
export declare function createStructuredLogger(config?: Partial<StructuredLoggerConfig>): StructuredLogger;
export declare function getDefaultLogger(): StructuredLogger;
export declare function setDefaultLogger(logger: StructuredLogger): void;
/**
 * Utility to measure execution time
 */
export declare function createTimer(): {
    elapsed: () => number;
    elapsedMs: () => string;
};
export default StructuredLogger;
//# sourceMappingURL=structured-logger.d.ts.map