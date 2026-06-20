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
/**
 * Numeric values for each log level
 */
export const LOG_LEVEL_VALUES = {
    trace: 10,
    debug: 20,
    info: 30,
    warn: 40,
    error: 50,
    fatal: 60,
    silent: 100
};
// Parses a positive integer env var, returning undefined for missing or
// non-numeric values. `parseInt('abc', 10)` returns NaN; if we forwarded that
// to setInterval(fn, NaN) the buffer would flush on every event-loop tick,
// destroying the batching the user asked for.
const parsePositiveIntEnv = (raw) => {
    if (raw === undefined || raw === '')
        return undefined;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
};
/**
 * Load configuration from environment variables
 */
export function loadLoggerConfig() {
    const level = process.env.BAILEYS_LOG_LEVEL;
    return {
        level: level && level in LOG_LEVEL_VALUES ? level : undefined,
        name: process.env.BAILEYS_LOG_NAME,
        jsonFormat: process.env.BAILEYS_LOG_JSON === 'true' || process.env.NODE_ENV === 'production',
        enableBuffering: process.env.BAILEYS_LOG_BUFFERING === 'true',
        bufferFlushIntervalMs: parsePositiveIntEnv(process.env.BAILEYS_LOG_BUFFER_FLUSH_MS),
        maxBufferSize: parsePositiveIntEnv(process.env.BAILEYS_LOG_MAX_BUFFER_SIZE),
        enableRateLimiting: process.env.BAILEYS_LOG_RATE_LIMIT === 'true',
        maxLogsPerSecond: parsePositiveIntEnv(process.env.BAILEYS_LOG_MAX_PER_SECOND),
        enableAsyncQueue: process.env.BAILEYS_LOG_ASYNC === 'true',
        enableMetrics: process.env.BAILEYS_LOG_METRICS === 'true',
        includeStackTrace: process.env.BAILEYS_LOG_STACK_TRACE !== 'false'
    };
}
/**
 * Default fields to sanitize
 */
const DEFAULT_REDACT_FIELDS = [
    'password',
    'passwd',
    'secret',
    'token',
    'accessToken',
    'refreshToken',
    'apiKey',
    'api_key',
    'authorization',
    'auth',
    'credentials',
    'privateKey',
    'private_key'
];
// ============================================================================
// RATE LIMITER
// ============================================================================
/**
 * Token bucket rate limiter
 */
class RateLimiter {
    constructor(maxPerSecond) {
        this.maxTokens = maxPerSecond;
        this.tokens = maxPerSecond;
        this.refillRate = maxPerSecond / 1000;
        this.lastRefill = Date.now();
    }
    tryAcquire() {
        this.refill();
        if (this.tokens >= 1) {
            this.tokens--;
            return true;
        }
        return false;
    }
    refill() {
        const now = Date.now();
        const elapsed = now - this.lastRefill;
        const tokensToAdd = elapsed * this.refillRate;
        this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
        this.lastRefill = now;
    }
    getTokens() {
        this.refill();
        return Math.floor(this.tokens);
    }
}
// ============================================================================
// ASYNC LOG QUEUE
// ============================================================================
/**
 * Async log processing queue
 */
class AsyncLogQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.destroyed = false;
    }
    enqueue(task) {
        if (this.destroyed)
            return;
        this.queue.push(task);
        void this.processNext();
    }
    async processNext() {
        if (this.processing || this.queue.length === 0 || this.destroyed)
            return;
        this.processing = true;
        while (this.queue.length > 0 && !this.destroyed) {
            const task = this.queue.shift();
            if (task) {
                try {
                    task();
                }
                catch {
                    // Silently ignore errors
                }
            }
            // Yield to event loop periodically
            if (this.queue.length > 0 && this.queue.length % 10 === 0) {
                await new Promise(resolve => setImmediate(resolve));
            }
        }
        this.processing = false;
    }
    getSize() {
        return this.queue.length;
    }
    /**
     * Run every queued task synchronously and clear the queue. Called by
     * `StructuredLogger.destroy()` to ensure logs enqueued just before
     * teardown are not silently dropped. Errors thrown by individual tasks
     * are swallowed (matches the `processNext` semantics) so a single bad
     * task cannot block the rest of the drain.
     */
    drain() {
        while (this.queue.length > 0) {
            const task = this.queue.shift();
            if (task) {
                try {
                    task();
                }
                catch {
                    // Mirrors processNext: drains are best-effort.
                }
            }
        }
    }
    destroy() {
        this.destroyed = true;
        this.queue = [];
    }
}
// ============================================================================
// MAIN CLASS
// ============================================================================
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
export class StructuredLogger {
    constructor(config) {
        this.childContext = {};
        this.destroyed = false;
        // Buffer for batch writes
        this.buffer = [];
        this.bufferFlushTimer = null;
        // Rate limiter
        this.rateLimiter = null;
        // Async queue
        this.asyncQueue = null;
        // Performance tracking
        this.totalProcessingTime = 0;
        this.processedLogs = 0;
        // Metrics module (lazy loaded)
        // NOTE: Currently no metrics are recorded to this module - it's loaded but unused
        this.metricsModule = null;
        const envConfig = loadLoggerConfig();
        this.createdAt = Date.now();
        this.config = {
            level: config.level ?? envConfig.level ?? 'info',
            name: config.name ?? envConfig.name ?? 'app',
            context: config.context || {},
            jsonFormat: config.jsonFormat ?? envConfig.jsonFormat ?? true,
            redactFields: [...DEFAULT_REDACT_FIELDS, ...(config.redactFields || [])],
            externalHook: config.externalHook,
            includeStackTrace: config.includeStackTrace ?? envConfig.includeStackTrace ?? true,
            timezone: config.timezone || 'UTC',
            enableBuffering: config.enableBuffering ?? envConfig.enableBuffering ?? false,
            bufferFlushIntervalMs: config.bufferFlushIntervalMs ?? envConfig.bufferFlushIntervalMs ?? 1000,
            maxBufferSize: config.maxBufferSize ?? envConfig.maxBufferSize ?? 100,
            enableRateLimiting: config.enableRateLimiting ?? envConfig.enableRateLimiting ?? false,
            maxLogsPerSecond: config.maxLogsPerSecond ?? envConfig.maxLogsPerSecond ?? 1000,
            enableAsyncQueue: config.enableAsyncQueue ?? envConfig.enableAsyncQueue ?? false,
            enableMetrics: config.enableMetrics ?? envConfig.enableMetrics ?? false
        };
        this.metrics = {
            totalLogs: 0,
            logsByLevel: {
                trace: 0,
                debug: 0,
                info: 0,
                warn: 0,
                error: 0,
                fatal: 0,
                silent: 0
            },
            errorsCount: 0,
            droppedLogs: 0,
            bufferFlushes: 0,
            hookFailures: 0,
            avgProcessingTimeMs: 0
        };
        // Initialize rate limiter
        if (this.config.enableRateLimiting) {
            this.rateLimiter = new RateLimiter(this.config.maxLogsPerSecond);
        }
        // Initialize async queue
        if (this.config.enableAsyncQueue) {
            this.asyncQueue = new AsyncLogQueue();
        }
        // Initialize buffer flush timer
        if (this.config.enableBuffering) {
            this.bufferFlushTimer = setInterval(() => {
                this.flushBuffer();
            }, this.config.bufferFlushIntervalMs);
        }
        // Load metrics module if enabled (currently unused but loaded for future use)
        if (this.config.enableMetrics) {
            import('./prometheus-metrics.js')
                .then(m => {
                this.metricsModule = m;
                this.debug('📊 Prometheus metrics loaded for logger');
            })
                .catch(() => {
                // Metrics module not available - silent fail
            });
        }
    }
    /**
     * Get current log level (ILogger compatibility)
     */
    get level() {
        return this.config.level;
    }
    /**
     * Set log level
     */
    set level(newLevel) {
        if (newLevel in LOG_LEVEL_VALUES) {
            this.config.level = newLevel;
        }
    }
    /**
     * Check if logger has been destroyed
     */
    isDestroyed() {
        return this.destroyed;
    }
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
    child(obj) {
        const childLogger = new StructuredLogger({
            ...this.config,
            context: { ...this.config.context, ...this.childContext, ...obj },
            enableBuffering: false,
            enableAsyncQueue: false,
            enableRateLimiting: false,
            enableMetrics: false
        });
        childLogger.childContext = { ...this.childContext, ...obj };
        return childLogger;
    }
    /**
     * Check if log level is enabled
     */
    isLevelEnabled(level) {
        return LOG_LEVEL_VALUES[level] >= LOG_LEVEL_VALUES[this.config.level];
    }
    /**
     * Main logging method
     */
    log(level, obj, msg) {
        if (this.destroyed || !this.isLevelEnabled(level)) {
            return;
        }
        const startTime = Date.now();
        // Rate limiting check
        if (this.rateLimiter && !this.rateLimiter.tryAcquire()) {
            this.metrics.droppedLogs++;
            return;
        }
        const entry = this.createLogEntry(level, obj, msg);
        // Update metrics
        this.updateMetrics(level);
        // Process log (sync or async)
        const processLog = () => {
            // Buffered output
            if (this.config.enableBuffering) {
                this.buffer.push(entry);
                if (this.buffer.length >= this.config.maxBufferSize) {
                    this.flushBuffer();
                }
            }
            else {
                this.output(entry);
            }
            // External hook (fire-and-forget; failures don't impact log flow)
            const externalHook = this.config.externalHook;
            if (externalHook) {
                Promise.resolve()
                    .then(() => externalHook(entry))
                    .catch(() => {
                    this.metrics.hookFailures++;
                });
            }
            // Track processing time
            this.totalProcessingTime += Date.now() - startTime;
            this.processedLogs++;
            this.metrics.avgProcessingTimeMs = this.totalProcessingTime / this.processedLogs;
        };
        // Async or sync processing
        if (this.asyncQueue) {
            this.asyncQueue.enqueue(processLog);
        }
        else {
            processLog();
        }
    }
    /**
     * Flush buffered logs
     */
    flushBuffer() {
        if (this.buffer.length === 0)
            return;
        const entries = this.buffer;
        this.buffer = [];
        this.metrics.bufferFlushes++;
        for (const entry of entries) {
            this.output(entry);
        }
    }
    /**
     * Create a structured log entry
     */
    createLogEntry(level, obj, msg) {
        const timestamp = new Date().toISOString();
        let message = msg || '';
        let data;
        let stack;
        // Process object
        if (obj instanceof Error) {
            message = message || obj.message;
            if (this.config.includeStackTrace && obj.stack) {
                stack = obj.stack;
            }
            data = {
                errorName: obj.name,
                errorMessage: obj.message,
                ...obj
            };
        }
        else if (typeof obj === 'object' && obj !== null) {
            data = this.sanitize(obj);
            if (!message && 'msg' in obj) {
                message = String(obj.msg);
            }
        }
        else if (typeof obj === 'string') {
            message = message || obj;
        }
        // Extract correlationId and durationMs if present
        const correlationId = data?.correlationId;
        const durationMs = data?.durationMs;
        return {
            timestamp,
            level,
            levelValue: LOG_LEVEL_VALUES[level],
            message,
            name: this.config.name,
            context: Object.keys(this.config.context).length > 0 ? this.config.context : undefined,
            data,
            stack,
            correlationId,
            durationMs
        };
    }
    /**
     * Sanitize sensitive data
     */
    sanitize(obj) {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            const lowerKey = key.toLowerCase();
            if (this.config.redactFields.some(field => lowerKey.includes(field.toLowerCase()))) {
                sanitized[key] = '[REDACTED]';
            }
            else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                sanitized[key] = this.sanitize(value);
            }
            else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }
    /**
     * Update internal metrics
     */
    updateMetrics(level) {
        this.metrics.totalLogs++;
        this.metrics.logsByLevel[level]++;
        this.metrics.lastLogTimestamp = new Date().toISOString();
        if (level === 'error' || level === 'fatal') {
            this.metrics.errorsCount++;
        }
    }
    /**
     * Output log entry
     */
    output(entry) {
        const output = this.config.jsonFormat ? JSON.stringify(entry) : this.formatText(entry);
        switch (entry.level) {
            case 'trace':
            case 'debug':
                console.debug(output);
                break;
            case 'info':
                console.info(output);
                break;
            case 'warn':
                console.warn(output);
                break;
            case 'error':
            case 'fatal':
                console.error(output);
                break;
        }
    }
    /**
     * Format log as human-readable text
     */
    formatText(entry) {
        const parts = [
            `[${entry.timestamp}]`,
            `[${entry.level.toUpperCase()}]`,
            entry.name ? `[${entry.name}]` : '',
            entry.correlationId ? `[${entry.correlationId}]` : '',
            entry.message,
            entry.durationMs !== undefined ? `(${entry.durationMs}ms)` : ''
        ];
        let text = parts.filter(Boolean).join(' ');
        if (entry.data && Object.keys(entry.data).length > 0) {
            text += ` | ${JSON.stringify(entry.data)}`;
        }
        if (entry.stack) {
            text += `\n${entry.stack}`;
        }
        return text;
    }
    // Convenience methods for each log level
    trace(obj, msg) {
        this.log('trace', obj, msg);
    }
    debug(obj, msg) {
        this.log('debug', obj, msg);
    }
    info(obj, msg) {
        this.log('info', obj, msg);
    }
    warn(obj, msg) {
        this.log('warn', obj, msg);
    }
    error(obj, msg) {
        this.log('error', obj, msg);
    }
    fatal(obj, msg) {
        this.log('fatal', obj, msg);
    }
    /**
     * Log with temporary context
     */
    withContext(context) {
        return this.child(context);
    }
    /**
     * Log with correlation ID
     */
    withCorrelationId(correlationId) {
        return this.child({ correlationId });
    }
    /**
     * Log operation with duration tracking
     */
    logOperation(operationName, operation, level = 'info') {
        const startTime = Date.now();
        const contextLogger = this.child({ operation: operationName });
        contextLogger.log(level, { event: 'operation_start' }, `Starting ${operationName}`);
        const handleResult = (result) => {
            const durationMs = Date.now() - startTime;
            contextLogger.log(level, { event: 'operation_complete', durationMs }, `Completed ${operationName}`);
            return result;
        };
        const handleError = (error) => {
            const durationMs = Date.now() - startTime;
            contextLogger.error({ event: 'operation_error', durationMs, error }, `Failed ${operationName}`);
            throw error;
        };
        try {
            const result = operation();
            if (result instanceof Promise) {
                return result.then(handleResult).catch(handleError);
            }
            return handleResult(result);
        }
        catch (error) {
            return handleError(error);
        }
    }
    /**
     * Get logger metrics
     */
    getMetrics() {
        return { ...this.metrics };
    }
    /**
     * Get comprehensive statistics
     */
    getStatistics() {
        return {
            ...this.metrics,
            bufferSize: this.buffer.length,
            rateLimiterTokens: this.rateLimiter?.getTokens() ?? 0,
            queueSize: this.asyncQueue?.getSize() ?? 0,
            createdAt: this.createdAt,
            uptimeMs: Date.now() - this.createdAt
        };
    }
    /**
     * Reset metrics
     */
    resetMetrics() {
        this.metrics = {
            totalLogs: 0,
            logsByLevel: {
                trace: 0,
                debug: 0,
                info: 0,
                warn: 0,
                error: 0,
                fatal: 0,
                silent: 0
            },
            errorsCount: 0,
            droppedLogs: 0,
            bufferFlushes: 0,
            hookFailures: 0,
            avgProcessingTimeMs: 0
        };
        this.totalProcessingTime = 0;
        this.processedLogs = 0;
    }
    /**
     * Destroy the logger and clean up resources
     * CRITICAL: Call this when done to prevent memory leaks
     */
    destroy() {
        if (this.destroyed)
            return;
        // Order matters when both buffering and the async queue are enabled:
        // queued tasks are what FILL the buffer, so draining the queue first
        // makes sure the buffer holds every entry that was already
        // `log()`-ed before we attempt to flush it. The previous order
        // (flush → clear queue) silently dropped any entries still sitting
        // in the queue at teardown — exactly the last few logs that matter
        // most for diagnosing a crash. We flip `destroyed` AFTER the drain
        // so the in-flight tasks are not refused (`enqueue` is a no-op
        // once `destroyed` is true).
        if (this.asyncQueue) {
            this.asyncQueue.drain();
        }
        this.destroyed = true;
        // Flush remaining buffer (now includes everything the queue produced)
        this.flushBuffer();
        // Clear buffer flush timer
        if (this.bufferFlushTimer) {
            clearInterval(this.bufferFlushTimer);
            this.bufferFlushTimer = null;
        }
        // Destroy async queue
        if (this.asyncQueue) {
            this.asyncQueue.destroy();
            this.asyncQueue = null;
        }
        // Clear references
        this.rateLimiter = null;
        this.metricsModule = null;
    }
}
/**
 * Factory to create structured logger
 */
export function createStructuredLogger(config = {}) {
    return new StructuredLogger({
        level: config.level || 'info',
        ...config
    });
}
/**
 * Default singleton logger
 */
let defaultLogger = null;
export function getDefaultLogger() {
    if (!defaultLogger) {
        defaultLogger = createStructuredLogger({
            level: 'info',
            name: 'baileys',
            jsonFormat: process.env.NODE_ENV === 'production'
        });
    }
    return defaultLogger;
}
export function setDefaultLogger(logger) {
    defaultLogger = logger;
}
/**
 * Utility to measure execution time
 */
export function createTimer() {
    const start = process.hrtime.bigint();
    return {
        elapsed: () => Number(process.hrtime.bigint() - start) / 1000000,
        elapsedMs: () => `${(Number(process.hrtime.bigint() - start) / 1000000).toFixed(2)}ms`
    };
}
export default StructuredLogger;
//# sourceMappingURL=structured-logger.js.map