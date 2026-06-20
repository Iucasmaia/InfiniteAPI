/**
 * Prometheus Metrics Exposition - Enterprise Grade
 *
 * Uses prom-client for full Prometheus compatibility including:
 * - Native OpenMetrics format export
 * - Default Node.js metrics collection
 * - Proper histogram buckets
 * - Registry management
 *
 * Provides:
 * - Counters for event counting
 * - Gauges for instantaneous values
 * - Histograms for value distribution
 * - Summaries for percentiles
 * - HTTP /metrics endpoint ready for scraping
 * - Dynamic labels
 * - Baileys events integration
 * - Event buffer metrics
 * - System metrics (memory, CPU, uptime)
 * - Retry metrics
 * - Environment variable configuration
 *
 * Configuration via environment variables (supports BAILEYS_PROMETHEUS_* and METRICS_* prefixes):
 * - BAILEYS_PROMETHEUS_ENABLED: Enable/disable metrics (default: false)
 * - BAILEYS_PROMETHEUS_PORT: Port for HTTP metrics server (default: 9092)
 * - BAILEYS_PROMETHEUS_HOST: Host/IP to bind (default: 127.0.0.1)
 * - BAILEYS_PROMETHEUS_PATH: Path for metrics endpoint (default: /metrics)
 * - BAILEYS_PROMETHEUS_PREFIX: Prefix for all metrics (default: baileys)
 * - BAILEYS_PROMETHEUS_LABELS: JSON string with default labels (e.g. {"environment":"production"})
 * - BAILEYS_PROMETHEUS_COLLECT_DEFAULT: Collect default Node.js metrics (default: true)
 * - BAILEYS_PROMETHEUS_INCLUDE_SYSTEM: Include system metrics like CPU/memory (default: true)
 * - BAILEYS_PROMETHEUS_COLLECT_INTERVAL_MS: Interval for system metrics collection (default: 10000)
 *
 * @module Utils/prometheus-metrics
 */
/**
 * Reset all configuration flags - FOR TESTING ONLY
 * Allows reconfiguration in test environments
 */
export declare function resetMetricsConfiguration(): void;
/**
 * Get the current configured prefix - FOR TESTING/DEBUGGING
 */
export declare function getConfiguredPrefix(): string;
/**
 * Metrics configuration from environment
 */
export interface MetricsConfig {
    enabled: boolean;
    port: number;
    /** Host/IP to bind the metrics server (default: '127.0.0.1' for security) */
    host: string;
    path: string;
    prefix: string;
    defaultLabels: Labels;
    includeSystem: boolean;
    collectDefaultMetrics: boolean;
    /** Interval in milliseconds for system metrics collection (default: 10000) */
    collectIntervalMs: number;
}
/**
 * Load configuration from environment variables
 * Supports both BAILEYS_PROMETHEUS_* and METRICS_* prefixes for compatibility
 */
export declare function loadMetricsConfig(): MetricsConfig;
/**
 * Metric type
 */
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';
/**
 * Metric labels
 */
export type Labels = Record<string, string>;
/**
 * Default histogram buckets (in ms)
 */
export declare const DEFAULT_BUCKETS: number[];
/**
 * Default latency buckets (in seconds)
 */
export declare const DEFAULT_LATENCY_BUCKETS: number[];
/**
 * Default size buckets (in bytes)
 */
export declare const DEFAULT_SIZE_BUCKETS: number[];
/**
 * Default summary percentiles
 */
export declare const DEFAULT_PERCENTILES: number[];
/**
 * Base metric interface
 */
export interface BaseMetric {
    name: string;
    help: string;
    type: MetricType;
    labelNames: string[];
}
/**
 * Metric value with labels
 */
export interface MetricValue {
    labels: Labels;
    value: number;
    timestamp?: number;
}
/**
 * Histogram values
 */
export interface HistogramValue {
    labels: Labels;
    buckets: Map<number, number>;
    sum: number;
    count: number;
}
/**
 * Summary values
 */
export interface SummaryValue {
    labels: Labels;
    values: number[];
    sum: number;
    count: number;
}
/**
 * Counter class - monotonically increasing metric
 * Now backed by prom-client for full Prometheus compatibility
 *
 * Counters only go up (or reset to zero). They are used for
 * counting events like requests, errors, tasks completed, etc.
 */
export declare class Counter implements BaseMetric {
    name: string;
    help: string;
    labelNames: string[];
    readonly type: "counter";
    private promCounter;
    constructor(name: string, help: string, labelNames?: string[]);
    /**
     * Increment the counter
     */
    inc(labelsOrValue?: Labels | number, value?: number): void;
    /**
     * Get current value (async, from prom-client)
     */
    get(labels?: Labels): Promise<number>;
    /**
     * Reset the counter
     * If labels provided, removes only that label combination
     * Otherwise resets all values
     */
    reset(labels?: Labels): void;
    /**
     * Get all values (async, from prom-client)
     */
    getValues(): Promise<MetricValue[]>;
    private labelsToKey;
    /**
     * Create version with pre-defined labels
     */
    labels(labels: Labels): {
        inc: (value?: number) => void;
    };
}
/**
 * Gauge class - value that can increase and decrease
 * Now backed by prom-client for full Prometheus compatibility
 *
 * Gauges represent a snapshot of a value at a point in time.
 * Examples: temperature, current memory usage, queue size.
 */
export declare class Gauge implements BaseMetric {
    name: string;
    help: string;
    labelNames: string[];
    readonly type: "gauge";
    private promGauge;
    constructor(name: string, help: string, labelNames?: string[]);
    /**
     * Set value
     */
    set(labelsOrValue: Labels | number, value?: number): void;
    /**
     * Increment value
     */
    inc(labelsOrValue?: Labels | number, value?: number): void;
    /**
     * Decrement value
     */
    dec(labelsOrValue?: Labels | number, value?: number): void;
    /**
     * Set to current timestamp
     */
    setToCurrentTime(labels?: Labels): void;
    /**
     * Get current value (async, from prom-client)
     */
    get(labels?: Labels): Promise<number>;
    /**
     * Reset the gauge
     * If labels provided, removes only that label combination
     * Otherwise resets all values
     */
    reset(labels?: Labels): void;
    /**
     * Get all values (async, from prom-client)
     */
    getValues(): Promise<MetricValue[]>;
    private labelsToKey;
    /**
     * Create version with pre-defined labels
     */
    labels(labels: Labels): {
        set: (value: number) => void;
        inc: (value?: number) => void;
        dec: (value?: number) => void;
    };
    /**
     * Timer helper - returns function to stop and record duration
     */
    startTimer(labels?: Labels): () => number;
}
/**
 * Histogram class - distribution of values in buckets
 * Now backed by prom-client for full Prometheus compatibility
 *
 * Histograms sample observations and count them in configurable buckets.
 * They also provide sum and count of observations.
 */
export declare class Histogram implements BaseMetric {
    name: string;
    help: string;
    labelNames: string[];
    readonly type: "histogram";
    private promHistogram;
    private buckets;
    constructor(name: string, help: string, labelNames?: string[], buckets?: number[]);
    /**
     * Observe a value
     */
    observe(labelsOrValue: Labels | number, value?: number): void;
    /**
     * Timer helper - measures duration in milliseconds
     */
    startTimer(labels?: Labels): () => number;
    /**
     * Timer helper - measures duration in seconds
     */
    startTimerSeconds(labels?: Labels): () => number;
    /**
     * Get histogram values (async, from prom-client)
     */
    get(labels?: Labels): Promise<HistogramValue | undefined>;
    /**
     * Reset the histogram
     * If labels provided, removes only that label combination
     * Otherwise resets all values
     */
    reset(labels?: Labels): void;
    /**
     * Get all values (async, from prom-client)
     */
    getValues(): Promise<HistogramValue[]>;
    /**
     * Get configured buckets
     */
    getBuckets(): number[];
    private labelsToKey;
    /**
     * Create version with pre-defined labels
     */
    labels(labels: Labels): {
        observe: (value: number) => void;
        startTimer: () => () => number;
    };
}
/**
 * Summary class - value percentiles (quantiles)
 * Now backed by prom-client for full Prometheus compatibility
 *
 * Summaries calculate quantiles over a sliding time window.
 * Useful for tracking latency distributions.
 */
export declare class Summary implements BaseMetric {
    name: string;
    help: string;
    labelNames: string[];
    readonly type: "summary";
    private promSummary;
    private percentiles;
    constructor(name: string, help: string, labelNames?: string[], options?: {
        percentiles?: number[];
        maxAgeSeconds?: number;
        ageBuckets?: number;
    });
    /**
     * Observe a value
     */
    observe(labelsOrValue: Labels | number, value?: number): void;
    /**
     * Timer helper
     */
    startTimer(labels?: Labels): () => number;
    /**
     * Get summary values (async, from prom-client)
     */
    get(labels?: Labels): Promise<SummaryValue | undefined>;
    /**
     * Reset the summary
     * If labels provided, removes only that label combination
     * Otherwise resets all values
     */
    reset(labels?: Labels): void;
    /**
     * Get all values (async, from prom-client)
     */
    getValues(): Promise<SummaryValue[]>;
    /**
     * Get configured percentiles
     */
    getPercentiles(): number[];
    private labelsToKey;
    /**
     * Create version with pre-defined labels
     */
    labels(labels: Labels): {
        observe: (value: number) => void;
        startTimer: () => () => number;
    };
}
/**
 * Metrics registry - manages collection of metrics
 *
 * The registry holds all metrics and provides methods to
 * retrieve, reset, and export them in Prometheus format.
 */
export declare class MetricsRegistry {
    private metricsMap;
    private prefix;
    private defaultLabels;
    constructor(options?: {
        prefix?: string;
        defaultLabels?: Labels;
    });
    /**
     * Register a metric
     */
    register<T extends Counter | Gauge | Histogram | Summary>(metric: T): T;
    /**
     * Get a metric by name
     */
    get(name: string): Counter | Gauge | Histogram | Summary | undefined;
    /**
     * Check if a metric exists
     */
    has(name: string): boolean;
    /**
     * Remove a metric
     */
    remove(name: string): boolean;
    /**
     * Get all registered metrics
     */
    getAll(): Map<string, Counter | Gauge | Histogram | Summary>;
    /**
     * Reset all metrics
     */
    resetAll(): void;
    /**
     * Set default labels that will be added to all metrics
     */
    setDefaultLabels(labels: Labels): void;
    /**
     * Return metrics in Prometheus exposition format
     * Uses custom registry with configured prefix and defaultLabels
     */
    getMetricsOutput(): Promise<string>;
    /**
     * Return content type for Prometheus (using prom-client)
     */
    contentType(): string;
    private formatLabels;
    private escapeLabel;
}
/**
 * System metrics collector
 * Collects Node.js process and system-level metrics
 *
 * FIX: CPU usage now calculates delta between measurements to get actual percentage
 */
export declare class SystemMetricsCollector {
    private processStartTime;
    private registry;
    private lastCpuUsage;
    private lastCpuTime;
    readonly processUptime: Gauge;
    readonly processCpuUsage: Gauge;
    readonly processMemoryUsage: Gauge;
    readonly processMemoryExternal: Gauge;
    readonly processMemoryHeapTotal: Gauge;
    readonly processMemoryHeapUsed: Gauge;
    readonly processMemoryRss: Gauge;
    readonly systemCpuUsage: Gauge;
    readonly systemMemoryTotal: Gauge;
    readonly systemMemoryFree: Gauge;
    readonly systemLoadAverage: Gauge;
    readonly eventLoopLag: Histogram;
    constructor(registry: MetricsRegistry);
    /**
     * Collect all system metrics
     */
    collect(): void;
    /**
     * Calculate CPU usage percentage by measuring delta between calls
     * FIX: process.cpuUsage() returns cumulative microseconds, not percentage
     * We need to calculate the delta and convert to percentage
     *
     * NOTE: Values can exceed 100% on multi-core systems (e.g., 200% = 2 cores fully used)
     * This follows the standard Unix/Prometheus convention for process CPU metrics
     */
    private collectCpuUsage;
    private measureEventLoopLag;
}
/**
 * HTTP server for exposing metrics endpoint
 *
 * SECURITY: By default binds to 127.0.0.1 (localhost only)
 * Set BAILEYS_PROMETHEUS_HOST=0.0.0.0 to expose on all interfaces
 */
export declare class MetricsServer {
    private server;
    private registry;
    private systemCollector;
    private collectInterval;
    private config;
    private startPromise;
    constructor(registry: MetricsRegistry, config?: Partial<MetricsConfig>);
    /**
     * Get the system collector (for external access, avoids duplicate creation)
     */
    getSystemCollector(): SystemMetricsCollector | null;
    /**
     * Start the metrics HTTP server
     * FIX: Properly handles concurrent start() calls by caching and returning the same Promise
     */
    start(): Promise<void>;
    /**
     * Stop the metrics HTTP server
     * FIX: Clears startPromise to allow restart after stop
     */
    stop(): Promise<void>;
    /**
     * Check if server is running
     */
    isRunning(): boolean;
}
/**
 * Global registry for Baileys metrics
 * Uses prefix and default labels from environment variables
 */
export declare const baileysMetrics: MetricsRegistry;
/**
 * Pre-defined metrics for Baileys
 */
export declare const metrics: {
    connectionAttempts: Counter;
    connectionState: Gauge;
    connectionDuration: Gauge;
    reconnectAttempts: Counter;
    connectionLatency: Histogram;
    activeConnections: Gauge;
    connectionErrors: Counter;
    messagesSent: Counter;
    messagesReceived: Counter;
    messageLatency: Histogram;
    messageRetries: Counter;
    messageFailures: Counter;
    messagesQueued: Gauge;
    /**
     * Messages from Facebook/Instagram ads that arrive as placeholder messages
     * and are recovered via PDO (Peer Data Operation) request
     */
    ctwaRecoveryRequests: Counter;
    ctwaMessagesRecovered: Counter;
    ctwaRecoveryLatency: Histogram;
    ctwaRecoveryFailures: Counter;
    interactiveMessagesSent: Counter;
    interactiveMessagesSuccess: Counter;
    interactiveMessagesFailures: Counter;
    interactiveMessagesLatency: Histogram;
    mediaUploads: Counter;
    mediaDownloads: Counter;
    mediaSize: Histogram;
    mediaLatency: Histogram;
    bufferSize: Gauge;
    bufferCapacity: Gauge;
    bufferUtilization: Gauge;
    bufferFlushes: Counter;
    bufferOverflows: Counter;
    eventsBuffered: Counter;
    eventsDropped: Counter;
    bufferFlushLatency: Histogram;
    eventsProcessed: Counter;
    bufferDestroyed: Counter;
    bufferFinalFlush: Counter;
    bufferCacheCleanup: Counter;
    bufferCacheSize: Gauge;
    adaptiveFlushInterval: Gauge;
    adaptiveFlushAdjustments: Counter;
    adaptiveFlushThroughput: Gauge;
    adaptiveFlushBackpressure: Gauge;
    adaptiveFlushEfficiency: Gauge;
    adaptiveHealthStatus: Gauge;
    adaptiveEventRate: Gauge;
    errors: Counter;
    errorRate: Gauge;
    retries: Counter;
    retryLatency: Histogram;
    retrySuccess: Counter;
    retryExhausted: Counter;
    socketEvents: Counter;
    socketLatency: Histogram;
    socketBytesReceived: Counter;
    socketBytesSent: Counter;
    socketReconnects: Counter;
    encryptionOperations: Counter;
    encryptionLatency: Histogram;
    keyExchanges: Counter;
    preKeyCount: Gauge;
    /** Total identity key changes detected (contact reinstalled WhatsApp) */
    signalIdentityChanges: Counter;
    /** Total Signal MAC errors encountered */
    signalMacErrors: Counter;
    /** Total Signal session recreations by reason */
    signalSessionRecreations: Counter;
    /** Identity key cache statistics */
    signalIdentityKeyCacheHits: Counter;
    signalIdentityKeyCacheMisses: Counter;
    /** Identity key operations latency */
    signalIdentityKeyOperations: Histogram;
    /** Current identity key cache size */
    signalIdentityKeyCacheSize: Gauge;
    cacheHits: Counter;
    cacheMisses: Counter;
    cacheSize: Gauge;
    cacheEvictions: Counter;
    cacheHitRate: Gauge;
    queryLatency: Histogram;
    queryCount: Counter;
    queryTimeouts: Counter;
    presenceUpdates: Counter;
    presenceSubscriptions: Gauge;
    groupOperations: Counter;
    groupMetadataFetches: Counter;
    historySyncEvents: Counter;
    historySyncMessages: Counter;
    historySyncDuration: Histogram;
};
/**
 * PrometheusMetricsManager - High-level manager for all metrics
 *
 * Provides a unified interface for managing metrics, HTTP server,
 * and system metrics collection.
 *
 * FIX: Removed duplicate SystemMetricsCollector - now uses server's collector
 */
export declare class PrometheusMetricsManager {
    readonly registry: MetricsRegistry;
    readonly metrics: typeof metrics;
    readonly server: MetricsServer;
    private config;
    constructor(config?: Partial<MetricsConfig>);
    /**
     * Initialize the metrics manager
     * FIX: No longer creates duplicate SystemMetricsCollector
     * The MetricsServer handles system metrics collection
     */
    initialize(): Promise<void>;
    /**
     * Shutdown the metrics manager
     */
    shutdown(): Promise<void>;
    /**
     * Get metrics output in Prometheus format
     */
    getMetricsOutput(): Promise<string>;
    /**
     * Reset all metrics
     */
    resetAll(): void;
    /**
     * Check if metrics are enabled
     */
    isEnabled(): boolean;
}
/**
 * Helper to create HTTP metrics endpoint handler
 */
export declare function createMetricsHandler(registry?: MetricsRegistry): (_req: unknown, res: {
    setHeader: (name: string, value: string) => void;
    end: (body: string) => void;
}) => Promise<void>;
/**
 * Create Express middleware for metrics endpoint
 */
export declare function createExpressMetricsMiddleware(registry?: MetricsRegistry): (_req: unknown, res: {
    set: (name: string, value: string) => void;
    send: (body: string) => void;
}) => Promise<void>;
/**
 * Track operation duration using histogram
 */
export declare function trackDuration<T>(histogram: Histogram, labels: Labels, operation: () => T): T;
/**
 * Track operation duration using async histogram
 */
export declare function trackDurationAsync<T>(histogram: Histogram, labels: Labels, operation: () => Promise<T>): Promise<T>;
/**
 * Increment counter with automatic error tracking
 */
export declare function trackOperation(successCounter: Counter, errorCounter: Counter, labels: Labels): {
    success: () => void;
    failure: (errorCode?: string) => void;
};
/**
 * Record an event being buffered
 * Used by event-buffer.ts for metrics integration
 */
export declare function recordEventBuffered(eventType: string, count?: number): void;
/**
 * Record a buffer flush operation
 * Used by event-buffer.ts for metrics integration
 */
export declare function recordBufferFlush(eventCount: number, forced: boolean, historyCacheSize?: number): void;
/**
 * Update buffer statistics gauge
 * Used by event-buffer.ts for metrics integration
 */
export declare function updateBufferStatistics(stats: {
    currentSize: number;
    peakSize: number;
    historyCacheSize: number;
    overflowsDetected: number;
    lruCleanups: number;
}): void;
/**
 * Record a cache cleanup operation
 * Used by event-buffer.ts when LRU cleanup is performed
 */
export declare function recordCacheCleanup(_removedCount: number): void;
/**
 * Record a buffer overflow event
 * Used by event-buffer.ts when buffer exceeds max size
 */
export declare function recordBufferOverflow(): void;
/**
 * Record a connection error
 * Used by socket.ts when connection fails
 */
export declare function recordConnectionError(errorType: string): void;
/**
 * Record buffer destruction
 * Used by event-buffer.ts when buffer is destroyed
 */
export declare function recordBufferDestroyed(reason: string, hadPendingFlush: boolean): void;
/**
 * Record final flush during buffer destruction
 * Used by event-buffer.ts when buffer flushes remaining events on destroy
 */
export declare function recordBufferFinalFlush(): void;
/**
 * Update adaptive system metrics
 * Used by event-buffer.ts to report adaptive timeout health and event rate
 */
export declare function updateAdaptiveMetrics(eventRate: number, isHealthy: boolean): void;
/**
 * Increment active connections gauge
 */
export declare function incrementActiveConnections(): void;
/**
 * Decrement active connections gauge
 */
export declare function decrementActiveConnections(): void;
/**
 * Set active connections to specific value
 */
export declare function setActiveConnections(count: number): void;
/**
 * Record a connection attempt
 */
export declare function recordConnectionAttempt(status: 'success' | 'failure'): void;
/**
 * Record a message sent
 */
export declare function recordMessageSent(type?: string): void;
/**
 * Record a message received
 */
export declare function recordMessageReceived(type?: string): void;
/**
 * Record a message retry attempt
 */
export declare function recordMessageRetry(type?: string): void;
/**
 * Record a message failure
 */
export declare function recordMessageFailure(type?: string, reason?: string): void;
/**
 * Update messages queued gauge
 */
export declare function setMessagesQueued(count: number, priority?: string): void;
/**
 * Record history sync messages
 */
export declare function recordHistorySyncMessages(count?: number): void;
/**
 * Get or create global metrics manager
 */
export declare function getMetricsManager(config?: Partial<MetricsConfig>): PrometheusMetricsManager;
/**
 * Initialize global metrics (call once at application startup)
 */
export declare function initializeMetrics(config?: Partial<MetricsConfig>): Promise<PrometheusMetricsManager>;
/**
 * Shutdown global metrics (call at application shutdown)
 */
export declare function shutdownMetrics(): Promise<void>;
export default baileysMetrics;
//# sourceMappingURL=prometheus-metrics.d.ts.map