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
import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import * as os from 'os';
import * as promClient from 'prom-client';
import { intFromEnv } from './env-utils.js';
// Create a custom registry to avoid conflicts with global registry
const customRegistry = new promClient.Registry();
// Flags to prevent multiple configuration calls (thread-safety and memory leak prevention)
let defaultMetricsCollected = false;
let registryConfigured = false;
let configuredPrefix = '';
/**
 * Configure the custom registry with default labels
 * Thread-safe: Only executes once, subsequent calls are no-ops
 * To clear default labels, pass an empty object {} explicitly
 */
function configureRegistry(defaultLabels) {
    if (registryConfigured) {
        return; // Already configured, ignore subsequent calls
    }
    registryConfigured = true;
    // Allow setting empty labels to clear previous (useful for testing/reconfiguration)
    if (defaultLabels !== undefined) {
        customRegistry.setDefaultLabels(defaultLabels);
    }
}
/**
 * Set the metric prefix - thread-safe, only first call takes effect
 */
function setMetricPrefix(prefix) {
    if (configuredPrefix === '') {
        configuredPrefix = prefix;
    }
}
function getFullMetricName(name) {
    return configuredPrefix ? `${configuredPrefix}_${name}` : name;
}
/**
 * Reset all configuration flags - FOR TESTING ONLY
 * Allows reconfiguration in test environments
 */
export function resetMetricsConfiguration() {
    registryConfigured = false;
    defaultMetricsCollected = false;
    configuredPrefix = '';
    // Clear all metrics from custom registry
    customRegistry.clear();
}
/**
 * Get the current configured prefix - FOR TESTING/DEBUGGING
 */
export function getConfiguredPrefix() {
    return configuredPrefix;
}
/**
 * Check if a metric with the given name already exists in the custom registry
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function metricExists(name) {
    const fullName = getFullMetricName(name);
    try {
        const existing = customRegistry.getSingleMetric(fullName);
        return existing !== undefined;
    }
    catch {
        return false;
    }
}
/**
 * Get an existing metric from the custom registry
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getExistingMetric(name) {
    const fullName = getFullMetricName(name);
    try {
        return customRegistry.getSingleMetric(fullName);
    }
    catch {
        return undefined;
    }
}
/**
 * Parse JSON labels from environment variable
 */
function parseLabelsFromEnv(envValue) {
    if (!envValue)
        return {};
    try {
        const parsed = JSON.parse(envValue);
        if (typeof parsed === 'object' && parsed !== null) {
            return parsed;
        }
        return {};
    }
    catch {
        return {};
    }
}
/**
 * Load configuration from environment variables
 * Supports both BAILEYS_PROMETHEUS_* and METRICS_* prefixes for compatibility
 */
export function loadMetricsConfig() {
    return {
        enabled: (process.env.BAILEYS_PROMETHEUS_ENABLED ?? process.env.METRICS_ENABLED) === 'true',
        // Was `parseInt(... || '9092', 10)` — NaN under malformed env vars
        // would land as `server.listen(NaN)` producing an opaque
        // EADDRINUSE/bind error. `min=1` is just "not zero / not negative"
        // (operators running as root may legitimately bind a privileged
        // port). `max=65535` rejects values above the TCP range before
        // they reach `server.listen()`.
        port: intFromEnv(process.env.BAILEYS_PROMETHEUS_PORT ?? process.env.METRICS_PORT, 9092, 1, 65535),
        host: process.env.BAILEYS_PROMETHEUS_HOST || process.env.METRICS_HOST || '127.0.0.1',
        path: process.env.BAILEYS_PROMETHEUS_PATH || process.env.METRICS_PATH || '/metrics',
        prefix: process.env.BAILEYS_PROMETHEUS_PREFIX || process.env.METRICS_PREFIX || 'baileys',
        // Support both env prefixes for labels
        defaultLabels: parseLabelsFromEnv(process.env.BAILEYS_PROMETHEUS_LABELS ?? process.env.METRICS_LABELS),
        // Separate flag for system metrics (CPU/memory) - independent from collectDefaultMetrics
        includeSystem: (process.env.BAILEYS_PROMETHEUS_INCLUDE_SYSTEM ?? process.env.METRICS_INCLUDE_SYSTEM) !== 'false',
        // Flag for prom-client default Node.js metrics
        collectDefaultMetrics: (process.env.BAILEYS_PROMETHEUS_COLLECT_DEFAULT ?? process.env.METRICS_COLLECT_DEFAULT) !== 'false',
        // audit ENV-03: was `parseInt(... || '10000', 10)` — NaN → tight
        // `setInterval(NaN)` loop scraping prom-client internals.
        collectIntervalMs: intFromEnv(process.env.BAILEYS_PROMETHEUS_COLLECT_INTERVAL_MS ?? process.env.METRICS_COLLECT_INTERVAL_MS, 10000, 1)
    };
}
/**
 * Convert labels to a stable key string for lookups
 * Sorts keys to ensure consistent ordering regardless of object property order
 */
function stableLabelsToKey(labels) {
    const sortedKeys = Object.keys(labels).sort();
    const sortedObj = {};
    for (const key of sortedKeys) {
        sortedObj[key] = labels[key];
    }
    return JSON.stringify(sortedObj);
}
/**
 * Default histogram buckets (in ms)
 */
export const DEFAULT_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
/**
 * Default latency buckets (in seconds)
 */
export const DEFAULT_LATENCY_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
/**
 * Default size buckets (in bytes)
 */
export const DEFAULT_SIZE_BUCKETS = [1024, 10240, 102400, 1048576, 10485760, 104857600];
/**
 * Default summary percentiles
 */
export const DEFAULT_PERCENTILES = [0.5, 0.9, 0.95, 0.99];
// ============================================
// Counter Class (prom-client backed)
// ============================================
/**
 * Counter class - monotonically increasing metric
 * Now backed by prom-client for full Prometheus compatibility
 *
 * Counters only go up (or reset to zero). They are used for
 * counting events like requests, errors, tasks completed, etc.
 */
export class Counter {
    constructor(name, help, labelNames = []) {
        this.name = name;
        this.help = help;
        this.labelNames = labelNames;
        this.type = 'counter';
        const fullName = getFullMetricName(name);
        this.promCounter = new promClient.Counter({
            name: fullName,
            help,
            labelNames,
            registers: [customRegistry] // Use custom registry, not global
        });
    }
    /**
     * Increment the counter
     */
    inc(labelsOrValue, value) {
        let labels = {};
        let incValue = 1;
        if (typeof labelsOrValue === 'number') {
            incValue = labelsOrValue;
        }
        else if (labelsOrValue) {
            labels = labelsOrValue;
            incValue = value ?? 1;
        }
        if (incValue < 0) {
            throw new Error('Counter cannot be decremented');
        }
        // Use prom-client as single source of truth
        if (Object.keys(labels).length > 0) {
            this.promCounter.labels(labels).inc(incValue);
        }
        else {
            this.promCounter.inc(incValue);
        }
    }
    /**
     * Get current value (async, from prom-client)
     */
    async get(labels = {}) {
        const metric = await this.promCounter.get();
        const key = this.labelsToKey(labels);
        const value = metric.values.find(v => this.labelsToKey(v.labels) === key);
        return value?.value ?? 0;
    }
    /**
     * Reset the counter
     * If labels provided, removes only that label combination
     * Otherwise resets all values
     */
    reset(labels) {
        if (labels && Object.keys(labels).length > 0) {
            // prom-client doesn't support removing specific label combinations
            // Use remove() to remove the specific label set
            this.promCounter.remove(labels);
        }
        else {
            this.promCounter.reset();
        }
    }
    /**
     * Get all values (async, from prom-client)
     */
    async getValues() {
        const metric = await this.promCounter.get();
        return metric.values.map(v => ({
            labels: v.labels,
            value: v.value
        }));
    }
    labelsToKey(labels) {
        return stableLabelsToKey(labels);
    }
    /**
     * Create version with pre-defined labels
     */
    labels(labels) {
        return {
            inc: (value) => this.inc(labels, value)
        };
    }
}
// ============================================
// Gauge Class (prom-client backed)
// ============================================
/**
 * Gauge class - value that can increase and decrease
 * Now backed by prom-client for full Prometheus compatibility
 *
 * Gauges represent a snapshot of a value at a point in time.
 * Examples: temperature, current memory usage, queue size.
 */
export class Gauge {
    constructor(name, help, labelNames = []) {
        this.name = name;
        this.help = help;
        this.labelNames = labelNames;
        this.type = 'gauge';
        const fullName = getFullMetricName(name);
        this.promGauge = new promClient.Gauge({
            name: fullName,
            help,
            labelNames,
            registers: [customRegistry] // Use custom registry, not global
        });
    }
    /**
     * Set value
     */
    set(labelsOrValue, value) {
        let labels = {};
        let setValue;
        if (typeof labelsOrValue === 'number') {
            setValue = labelsOrValue;
        }
        else {
            labels = labelsOrValue;
            setValue = value ?? 0;
        }
        // Use prom-client as single source of truth
        if (Object.keys(labels).length > 0) {
            this.promGauge.labels(labels).set(setValue);
        }
        else {
            this.promGauge.set(setValue);
        }
    }
    /**
     * Increment value
     */
    inc(labelsOrValue, value) {
        let labels = {};
        let incValue = 1;
        if (typeof labelsOrValue === 'number') {
            incValue = labelsOrValue;
        }
        else if (labelsOrValue) {
            labels = labelsOrValue;
            incValue = value ?? 1;
        }
        // Use prom-client as single source of truth
        if (Object.keys(labels).length > 0) {
            this.promGauge.labels(labels).inc(incValue);
        }
        else {
            this.promGauge.inc(incValue);
        }
    }
    /**
     * Decrement value
     */
    dec(labelsOrValue, value) {
        let labels = {};
        let decValue = 1;
        if (typeof labelsOrValue === 'number') {
            decValue = labelsOrValue;
        }
        else if (labelsOrValue) {
            labels = labelsOrValue;
            decValue = value ?? 1;
        }
        // Use prom-client as single source of truth
        if (Object.keys(labels).length > 0) {
            this.promGauge.labels(labels).dec(decValue);
        }
        else {
            this.promGauge.dec(decValue);
        }
    }
    /**
     * Set to current timestamp
     */
    setToCurrentTime(labels = {}) {
        this.set(labels, Date.now() / 1000);
    }
    /**
     * Get current value (async, from prom-client)
     */
    async get(labels = {}) {
        const metric = await this.promGauge.get();
        const key = this.labelsToKey(labels);
        const value = metric.values.find(v => this.labelsToKey(v.labels) === key);
        return value?.value ?? 0;
    }
    /**
     * Reset the gauge
     * If labels provided, removes only that label combination
     * Otherwise resets all values
     */
    reset(labels) {
        if (labels && Object.keys(labels).length > 0) {
            this.promGauge.remove(labels);
        }
        else {
            this.promGauge.reset();
        }
    }
    /**
     * Get all values (async, from prom-client)
     */
    async getValues() {
        const metric = await this.promGauge.get();
        return metric.values.map(v => ({
            labels: v.labels,
            value: v.value
        }));
    }
    labelsToKey(labels) {
        return stableLabelsToKey(labels);
    }
    /**
     * Create version with pre-defined labels
     */
    labels(labels) {
        return {
            set: (value) => this.set(labels, value),
            inc: (value) => this.inc(labels, value),
            dec: (value) => this.dec(labels, value)
        };
    }
    /**
     * Timer helper - returns function to stop and record duration
     */
    startTimer(labels = {}) {
        const start = process.hrtime.bigint();
        return () => {
            const duration = Number(process.hrtime.bigint() - start) / 1000000000; // seconds
            this.set(labels, duration);
            return duration;
        };
    }
}
// ============================================
// Histogram Class (prom-client backed)
// ============================================
/**
 * Histogram class - distribution of values in buckets
 * Now backed by prom-client for full Prometheus compatibility
 *
 * Histograms sample observations and count them in configurable buckets.
 * They also provide sum and count of observations.
 */
export class Histogram {
    constructor(name, help, labelNames = [], buckets = DEFAULT_BUCKETS) {
        this.name = name;
        this.help = help;
        this.labelNames = labelNames;
        this.type = 'histogram';
        this.buckets = [...buckets].sort((a, b) => a - b);
        const fullName = getFullMetricName(name);
        this.promHistogram = new promClient.Histogram({
            name: fullName,
            help,
            labelNames,
            buckets: this.buckets,
            registers: [customRegistry] // Use custom registry, not global
        });
    }
    /**
     * Observe a value
     */
    observe(labelsOrValue, value) {
        let labels = {};
        let observeValue;
        if (typeof labelsOrValue === 'number') {
            observeValue = labelsOrValue;
        }
        else {
            labels = labelsOrValue;
            observeValue = value ?? 0;
        }
        // Use prom-client as single source of truth
        if (Object.keys(labels).length > 0) {
            this.promHistogram.labels(labels).observe(observeValue);
        }
        else {
            this.promHistogram.observe(observeValue);
        }
    }
    /**
     * Timer helper - measures duration in milliseconds
     */
    startTimer(labels = {}) {
        const start = process.hrtime.bigint();
        return () => {
            const duration = Number(process.hrtime.bigint() - start) / 1000000; // ms
            this.observe(labels, duration);
            return duration;
        };
    }
    /**
     * Timer helper - measures duration in seconds
     */
    startTimerSeconds(labels = {}) {
        const start = process.hrtime.bigint();
        return () => {
            const duration = Number(process.hrtime.bigint() - start) / 1000000000; // seconds
            this.observe(labels, duration);
            return duration;
        };
    }
    /**
     * Get histogram values (async, from prom-client)
     */
    async get(labels = {}) {
        const metric = await this.promHistogram.get();
        const key = this.labelsToKey(labels);
        // Find values matching labels
        const matchingValues = metric.values.filter(v => {
            const vLabels = { ...v.labels };
            delete vLabels['le']; // Remove bucket label
            return this.labelsToKey(vLabels) === key;
        });
        if (matchingValues.length === 0)
            return undefined;
        const buckets = new Map();
        let sum = 0;
        let count = 0;
        for (const v of matchingValues) {
            if (v.metricName?.endsWith('_bucket')) {
                const le = parseFloat(v.labels['le'] ?? '0');
                buckets.set(le, v.value);
            }
            else if (v.metricName?.endsWith('_sum')) {
                sum = v.value;
            }
            else if (v.metricName?.endsWith('_count')) {
                count = v.value;
            }
        }
        return { labels, buckets, sum, count };
    }
    /**
     * Reset the histogram
     * If labels provided, removes only that label combination
     * Otherwise resets all values
     */
    reset(labels) {
        if (labels && Object.keys(labels).length > 0) {
            this.promHistogram.remove(labels);
        }
        else {
            this.promHistogram.reset();
        }
    }
    /**
     * Get all values (async, from prom-client)
     */
    async getValues() {
        const metric = await this.promHistogram.get();
        const grouped = new Map();
        for (const v of metric.values) {
            const vLabels = { ...v.labels };
            delete vLabels['le'];
            const key = this.labelsToKey(vLabels);
            if (!grouped.has(key)) {
                grouped.set(key, {
                    labels: vLabels,
                    buckets: new Map(),
                    sum: 0,
                    count: 0
                });
            }
            const histValue = grouped.get(key);
            if (v.metricName?.endsWith('_bucket')) {
                const le = parseFloat(v.labels['le'] ?? '0');
                histValue.buckets.set(le, v.value);
            }
            else if (v.metricName?.endsWith('_sum')) {
                histValue.sum = v.value;
            }
            else if (v.metricName?.endsWith('_count')) {
                histValue.count = v.value;
            }
        }
        return Array.from(grouped.values());
    }
    /**
     * Get configured buckets
     */
    getBuckets() {
        return [...this.buckets];
    }
    labelsToKey(labels) {
        return stableLabelsToKey(labels);
    }
    /**
     * Create version with pre-defined labels
     */
    labels(labels) {
        return {
            observe: (value) => this.observe(labels, value),
            startTimer: () => this.startTimer(labels)
        };
    }
}
// ============================================
// Summary Class
// ============================================
/**
 * Summary class - value percentiles (quantiles)
 * Now backed by prom-client for full Prometheus compatibility
 *
 * Summaries calculate quantiles over a sliding time window.
 * Useful for tracking latency distributions.
 */
export class Summary {
    constructor(name, help, labelNames = [], options = {}) {
        this.name = name;
        this.help = help;
        this.labelNames = labelNames;
        this.type = 'summary';
        this.percentiles = options.percentiles ?? DEFAULT_PERCENTILES;
        const fullName = getFullMetricName(name);
        this.promSummary = new promClient.Summary({
            name: fullName,
            help,
            labelNames,
            percentiles: this.percentiles,
            maxAgeSeconds: options.maxAgeSeconds ?? 600, // 10 min default
            ageBuckets: options.ageBuckets ?? 5,
            registers: [customRegistry] // Use custom registry, not global
        });
    }
    /**
     * Observe a value
     */
    observe(labelsOrValue, value) {
        let labels = {};
        let observeValue;
        if (typeof labelsOrValue === 'number') {
            observeValue = labelsOrValue;
        }
        else {
            labels = labelsOrValue;
            observeValue = value ?? 0;
        }
        // Use prom-client as single source of truth
        if (Object.keys(labels).length > 0) {
            this.promSummary.labels(labels).observe(observeValue);
        }
        else {
            this.promSummary.observe(observeValue);
        }
    }
    /**
     * Timer helper
     */
    startTimer(labels = {}) {
        const start = process.hrtime.bigint();
        return () => {
            const duration = Number(process.hrtime.bigint() - start) / 1000000; // ms
            this.observe(labels, duration);
            return duration;
        };
    }
    /**
     * Get summary values (async, from prom-client)
     */
    async get(labels = {}) {
        const metric = await this.promSummary.get();
        const key = this.labelsToKey(labels);
        // Find values matching labels
        const matchingValues = metric.values.filter(v => {
            const vLabels = { ...v.labels };
            delete vLabels['quantile'];
            return this.labelsToKey(vLabels) === key;
        });
        if (matchingValues.length === 0)
            return undefined;
        let sum = 0;
        let count = 0;
        for (const v of matchingValues) {
            if (v.metricName?.endsWith('_sum')) {
                sum = v.value;
            }
            else if (v.metricName?.endsWith('_count')) {
                count = v.value;
            }
        }
        return { labels, values: [], sum, count };
    }
    /**
     * Reset the summary
     * If labels provided, removes only that label combination
     * Otherwise resets all values
     */
    reset(labels) {
        if (labels && Object.keys(labels).length > 0) {
            this.promSummary.remove(labels);
        }
        else {
            this.promSummary.reset();
        }
    }
    /**
     * Get all values (async, from prom-client)
     */
    async getValues() {
        const metric = await this.promSummary.get();
        const grouped = new Map();
        for (const v of metric.values) {
            const vLabels = { ...v.labels };
            delete vLabels['quantile'];
            const key = this.labelsToKey(vLabels);
            if (!grouped.has(key)) {
                grouped.set(key, {
                    labels: vLabels,
                    values: [],
                    sum: 0,
                    count: 0
                });
            }
            const summaryValue = grouped.get(key);
            if (v.metricName?.endsWith('_sum')) {
                summaryValue.sum = v.value;
            }
            else if (v.metricName?.endsWith('_count')) {
                summaryValue.count = v.value;
            }
        }
        return Array.from(grouped.values());
    }
    /**
     * Get configured percentiles
     */
    getPercentiles() {
        return [...this.percentiles];
    }
    labelsToKey(labels) {
        return stableLabelsToKey(labels);
    }
    /**
     * Create version with pre-defined labels
     */
    labels(labels) {
        return {
            observe: (value) => this.observe(labels, value),
            startTimer: () => this.startTimer(labels)
        };
    }
}
// ============================================
// Metrics Registry
// ============================================
/**
 * Metrics registry - manages collection of metrics
 *
 * The registry holds all metrics and provides methods to
 * retrieve, reset, and export them in Prometheus format.
 */
export class MetricsRegistry {
    constructor(options = {}) {
        this.metricsMap = new Map();
        this.prefix = options.prefix || '';
        this.defaultLabels = options.defaultLabels || {};
    }
    /**
     * Register a metric
     */
    register(metric) {
        const fullName = this.prefix ? `${this.prefix}_${metric.name}` : metric.name;
        this.metricsMap.set(fullName, metric);
        return metric;
    }
    /**
     * Get a metric by name
     */
    get(name) {
        const fullName = this.prefix ? `${this.prefix}_${name}` : name;
        return this.metricsMap.get(fullName);
    }
    /**
     * Check if a metric exists
     */
    has(name) {
        const fullName = this.prefix ? `${this.prefix}_${name}` : name;
        return this.metricsMap.has(fullName);
    }
    /**
     * Remove a metric
     */
    remove(name) {
        const fullName = this.prefix ? `${this.prefix}_${name}` : name;
        return this.metricsMap.delete(fullName);
    }
    /**
     * Get all registered metrics
     */
    getAll() {
        return new Map(this.metricsMap);
    }
    /**
     * Reset all metrics
     */
    resetAll() {
        for (const metric of this.metricsMap.values()) {
            metric.reset();
        }
    }
    /**
     * Set default labels that will be added to all metrics
     */
    setDefaultLabels(labels) {
        this.defaultLabels = { ...labels };
    }
    /**
     * Return metrics in Prometheus exposition format
     * Uses custom registry with configured prefix and defaultLabels
     */
    async getMetricsOutput() {
        // Use customRegistry (not global) for proper isolation
        // Prefix and defaultLabels are applied when metrics are created
        return await customRegistry.metrics();
    }
    /**
     * Return content type for Prometheus (using prom-client)
     */
    contentType() {
        return customRegistry.contentType;
    }
    formatLabels(labels) {
        const entries = Object.entries(labels);
        if (entries.length === 0)
            return '';
        const formatted = entries.map(([k, v]) => `${k}="${this.escapeLabel(v)}"`).join(',');
        return `{${formatted}}`;
    }
    escapeLabel(value) {
        return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
    }
}
// ============================================
// System Metrics Collection
// ============================================
/**
 * System metrics collector
 * Collects Node.js process and system-level metrics
 *
 * FIX: CPU usage now calculates delta between measurements to get actual percentage
 */
export class SystemMetricsCollector {
    constructor(registry) {
        // CPU tracking for delta calculation
        this.lastCpuUsage = null;
        this.lastCpuTime = 0;
        this.registry = registry;
        this.processStartTime = Date.now();
        // Initialize process metrics
        this.processUptime = registry.register(new Gauge('process_uptime_seconds', 'Process uptime in seconds'));
        // FIX: Updated description - can exceed 100% on multi-core (100% = 1 core)
        this.processCpuUsage = registry.register(new Gauge('process_cpu_usage_percent', 'Process CPU usage (100% = 1 core fully used)', ['type']));
        this.processMemoryUsage = registry.register(new Gauge('process_memory_bytes', 'Process memory usage in bytes', ['type']));
        this.processMemoryExternal = registry.register(new Gauge('process_memory_external_bytes', 'External memory used by C++ objects'));
        this.processMemoryHeapTotal = registry.register(new Gauge('process_memory_heap_total_bytes', 'Total heap memory'));
        this.processMemoryHeapUsed = registry.register(new Gauge('process_memory_heap_used_bytes', 'Used heap memory'));
        this.processMemoryRss = registry.register(new Gauge('process_memory_rss_bytes', 'Resident set size'));
        // Initialize system metrics
        this.systemCpuUsage = registry.register(new Gauge('system_cpu_usage_percent', 'System CPU usage percentage'));
        this.systemMemoryTotal = registry.register(new Gauge('system_memory_total_bytes', 'Total system memory'));
        this.systemMemoryFree = registry.register(new Gauge('system_memory_free_bytes', 'Free system memory'));
        this.systemLoadAverage = registry.register(new Gauge('system_load_average', 'System load average', ['period']));
        // Event loop lag - use different name to avoid conflict with collectDefaultMetrics
        // prom-client's collectDefaultMetrics creates nodejs_eventloop_lag_seconds
        // We use system_eventloop_lag_seconds to avoid duplicate registration
        this.eventLoopLag = registry.register(new Histogram('system_eventloop_lag_seconds', 'Event loop lag in seconds', [], DEFAULT_LATENCY_BUCKETS));
        // Initialize CPU baseline
        this.lastCpuUsage = process.cpuUsage();
        this.lastCpuTime = Date.now();
    }
    /**
     * Collect all system metrics
     */
    collect() {
        // Process uptime
        this.processUptime.set((Date.now() - this.processStartTime) / 1000);
        // CPU usage - calculate delta to get actual percentage
        this.collectCpuUsage();
        // Memory usage
        const memUsage = process.memoryUsage();
        this.processMemoryRss.set(memUsage.rss);
        this.processMemoryHeapTotal.set(memUsage.heapTotal);
        this.processMemoryHeapUsed.set(memUsage.heapUsed);
        this.processMemoryExternal.set(memUsage.external);
        this.processMemoryUsage.set({ type: 'rss' }, memUsage.rss);
        this.processMemoryUsage.set({ type: 'heapTotal' }, memUsage.heapTotal);
        this.processMemoryUsage.set({ type: 'heapUsed' }, memUsage.heapUsed);
        this.processMemoryUsage.set({ type: 'external' }, memUsage.external);
        // System metrics
        this.systemMemoryTotal.set(os.totalmem());
        this.systemMemoryFree.set(os.freemem());
        // Load average
        const loadAvg = os.loadavg();
        this.systemLoadAverage.set({ period: '1m' }, loadAvg[0]);
        this.systemLoadAverage.set({ period: '5m' }, loadAvg[1]);
        this.systemLoadAverage.set({ period: '15m' }, loadAvg[2]);
        // Event loop lag measurement
        this.measureEventLoopLag();
    }
    /**
     * Calculate CPU usage percentage by measuring delta between calls
     * FIX: process.cpuUsage() returns cumulative microseconds, not percentage
     * We need to calculate the delta and convert to percentage
     *
     * NOTE: Values can exceed 100% on multi-core systems (e.g., 200% = 2 cores fully used)
     * This follows the standard Unix/Prometheus convention for process CPU metrics
     */
    collectCpuUsage() {
        const currentCpuUsage = process.cpuUsage();
        const currentTime = Date.now();
        if (this.lastCpuUsage && this.lastCpuTime) {
            const elapsedMs = currentTime - this.lastCpuTime;
            if (elapsedMs > 0) {
                // Calculate delta in microseconds
                const userDelta = currentCpuUsage.user - this.lastCpuUsage.user;
                const systemDelta = currentCpuUsage.system - this.lastCpuUsage.system;
                // Convert to percentage: (microseconds used / microseconds elapsed) * 100
                // FIX: Removed division by cpuCount - this was giving artificially low values
                // Standard convention: 100% = 1 core fully utilized, can go up to numCPUs * 100%
                const elapsedMicros = elapsedMs * 1000;
                const userPercent = (userDelta / elapsedMicros) * 100;
                const systemPercent = (systemDelta / elapsedMicros) * 100;
                // Clamp to 0 minimum (no upper limit as it can exceed 100% with multiple cores)
                this.processCpuUsage.set({ type: 'user' }, Math.max(0, userPercent));
                this.processCpuUsage.set({ type: 'system' }, Math.max(0, systemPercent));
            }
        }
        // Store for next calculation
        this.lastCpuUsage = currentCpuUsage;
        this.lastCpuTime = currentTime;
    }
    measureEventLoopLag() {
        const start = process.hrtime.bigint();
        setImmediate(() => {
            const lag = Number(process.hrtime.bigint() - start) / 1000000000; // seconds
            this.eventLoopLag.observe(lag);
        });
    }
}
// ============================================
// HTTP Metrics Server
// ============================================
/**
 * HTTP server for exposing metrics endpoint
 *
 * SECURITY: By default binds to 127.0.0.1 (localhost only)
 * Set BAILEYS_PROMETHEUS_HOST=0.0.0.0 to expose on all interfaces
 */
export class MetricsServer {
    constructor(registry, config) {
        this.server = null;
        this.systemCollector = null;
        this.collectInterval = null;
        this.startPromise = null; // FIX: Cache Promise for race condition
        this.registry = registry;
        this.config = { ...loadMetricsConfig(), ...config };
    }
    /**
     * Get the system collector (for external access, avoids duplicate creation)
     */
    getSystemCollector() {
        return this.systemCollector;
    }
    /**
     * Start the metrics HTTP server
     * FIX: Properly handles concurrent start() calls by caching and returning the same Promise
     */
    start() {
        // If disabled, return resolved promise
        if (!this.config.enabled) {
            return Promise.resolve();
        }
        // If already running, return resolved promise
        if (this.server) {
            return Promise.resolve();
        }
        // FIX: If start is in progress, return the cached promise
        // This ensures all concurrent callers wait for the same result
        if (this.startPromise) {
            return this.startPromise;
        }
        // Configure prefix and registry BEFORE creating Promise to avoid race conditions
        // These functions are thread-safe and only execute once
        setMetricPrefix(this.config.prefix);
        configureRegistry(this.config.defaultLabels);
        // Cache the promise so concurrent calls get the same one
        this.startPromise = new Promise((resolve, reject) => {
            // Enable prom-client's default Node.js metrics collection (only once to prevent memory leak)
            if (this.config.collectDefaultMetrics && !defaultMetricsCollected) {
                defaultMetricsCollected = true;
                promClient.collectDefaultMetrics({
                    prefix: this.config.prefix ? `${this.config.prefix}_` : '',
                    labels: this.config.defaultLabels,
                    register: customRegistry // Use custom registry, not global
                });
            }
            // Initialize system collector if enabled (only once)
            if (this.config.includeSystem && !this.systemCollector) {
                this.systemCollector = new SystemMetricsCollector(this.registry);
                // FIX: Use configurable interval instead of hardcoded 10000
                this.collectInterval = setInterval(() => {
                    this.systemCollector?.collect();
                }, this.config.collectIntervalMs);
            }
            this.server = createServer(async (req, res) => {
                // Parse URL to handle querystrings and trailing slashes
                // Wrapped in try/catch to handle malformed URLs gracefully
                let pathname;
                try {
                    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
                    pathname = parsedUrl.pathname.replace(/\/+$/, '') || '/';
                }
                catch {
                    // Malformed URL - return 400 Bad Request
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        error: 'Bad Request',
                        message: 'Malformed URL',
                        timestamp: new Date().toISOString()
                    }));
                    return;
                }
                const configPath = this.config.path.replace(/\/+$/, '') || '/';
                if (pathname === configPath && req.method === 'GET') {
                    try {
                        // Collect system metrics before responding
                        this.systemCollector?.collect();
                        const metricsOutput = await this.registry.getMetricsOutput();
                        res.writeHead(200, { 'Content-Type': this.registry.contentType() });
                        res.end(metricsOutput);
                    }
                    catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                        console.error(`[Prometheus] Error collecting metrics: ${errorMessage}`);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            error: 'Failed to collect metrics',
                            message: errorMessage,
                            timestamp: new Date().toISOString()
                        }));
                    }
                }
                else if (pathname === '/health' && req.method === 'GET') {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
                }
                else {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('Not Found');
                }
            });
            this.server.on('error', error => {
                this.startPromise = null; // Reset so retry is possible
                this.server = null;
                reject(error);
            });
            // FIX: Use configurable host instead of hardcoded 0.0.0.0
            this.server.listen(this.config.port, this.config.host, () => {
                const labelsInfo = Object.keys(this.config.defaultLabels).length > 0
                    ? ` with labels: ${JSON.stringify(this.config.defaultLabels)}`
                    : '';
                const securityNote = this.config.host === '0.0.0.0' ? ' (WARNING: exposed on all interfaces)' : '';
                console.log(`[Prometheus] Metrics server listening on http://${this.config.host}:${this.config.port}${this.config.path}${labelsInfo}${securityNote}`);
                resolve();
            });
        });
        return this.startPromise;
    }
    /**
     * Stop the metrics HTTP server
     * FIX: Clears startPromise to allow restart after stop
     */
    stop() {
        return new Promise(resolve => {
            // FIX: Clear cached promise so start() can be called again
            this.startPromise = null;
            if (this.collectInterval) {
                clearInterval(this.collectInterval);
                this.collectInterval = null;
            }
            if (this.server) {
                this.server.close(() => {
                    this.server = null;
                    resolve();
                });
            }
            else {
                resolve();
            }
        });
    }
    /**
     * Check if server is running
     */
    isRunning() {
        return this.server !== null;
    }
}
// ============================================
// Pre-defined Baileys Metrics
// ============================================
/**
 * Load metrics configuration from environment
 */
const metricsConfig = loadMetricsConfig();
// Initialize prefix and defaultLabels for all metrics created after this point
setMetricPrefix(metricsConfig.prefix);
configureRegistry(metricsConfig.defaultLabels);
/**
 * Global registry for Baileys metrics
 * Uses prefix and default labels from environment variables
 */
export const baileysMetrics = new MetricsRegistry({
    prefix: metricsConfig.prefix,
    defaultLabels: metricsConfig.defaultLabels
});
/**
 * Pre-defined metrics for Baileys
 */
export const metrics = {
    // ========== Connection Metrics ==========
    connectionAttempts: baileysMetrics.register(new Counter('connection_attempts_total', 'Total connection attempts', ['status'])),
    connectionState: baileysMetrics.register(new Gauge('connection_state', 'Current connection state (0=disconnected, 1=connected)', ['instance'])),
    connectionDuration: baileysMetrics.register(new Gauge('connection_duration_seconds', 'Current connection duration in seconds', ['instance'])),
    reconnectAttempts: baileysMetrics.register(new Counter('reconnect_attempts_total', 'Total reconnection attempts', ['reason'])),
    connectionLatency: baileysMetrics.register(new Histogram('connection_latency_ms', 'Connection establishment latency in ms', [], [100, 250, 500, 1000, 2500, 5000, 10000])),
    activeConnections: baileysMetrics.register(new Gauge('active_connections', 'Number of active WhatsApp connections')),
    connectionErrors: baileysMetrics.register(new Counter('connection_errors_total', 'Total connection errors', ['error_type'])),
    // ========== Message Metrics ==========
    messagesSent: baileysMetrics.register(new Counter('messages_sent_total', 'Total messages sent', ['type'])),
    messagesReceived: baileysMetrics.register(new Counter('messages_received_total', 'Total messages received', ['type'])),
    messageLatency: baileysMetrics.register(new Histogram('message_latency_ms', 'Message send latency in ms', ['type'], [10, 50, 100, 250, 500, 1000, 2500, 5000])),
    messageRetries: baileysMetrics.register(new Counter('message_retries_total', 'Total message retry attempts', ['type'])),
    messageFailures: baileysMetrics.register(new Counter('message_failures_total', 'Total message send failures', ['type', 'reason'])),
    messagesQueued: baileysMetrics.register(new Gauge('messages_queued', 'Current number of messages in queue', ['priority'])),
    // ========== CTWA (Click-to-WhatsApp Ads) Metrics ==========
    /**
     * Messages from Facebook/Instagram ads that arrive as placeholder messages
     * and are recovered via PDO (Peer Data Operation) request
     */
    ctwaRecoveryRequests: baileysMetrics.register(new Counter('ctwa_recovery_requests_total', 'Total CTWA placeholder resend requests', ['status'])),
    ctwaMessagesRecovered: baileysMetrics.register(new Counter('ctwa_messages_recovered_total', 'Total CTWA messages successfully recovered')),
    ctwaRecoveryLatency: baileysMetrics.register(new Histogram('ctwa_recovery_latency_ms', 'CTWA message recovery latency in ms', [], [500, 1000, 2000, 3000, 5000, 8000, 10000])),
    ctwaRecoveryFailures: baileysMetrics.register(new Counter('ctwa_recovery_failures_total', 'Total CTWA recovery failures', ['reason'])),
    // ========== Interactive Messages Metrics ==========
    interactiveMessagesSent: baileysMetrics.register(new Counter('interactive_messages_sent_total', 'Total interactive messages sent (buttons/lists/templates/carousel)', ['type'])),
    interactiveMessagesSuccess: baileysMetrics.register(new Counter('interactive_messages_success_total', 'Total interactive messages successfully sent', ['type'])),
    interactiveMessagesFailures: baileysMetrics.register(new Counter('interactive_messages_failures_total', 'Total interactive message send failures', ['type', 'reason'])),
    interactiveMessagesLatency: baileysMetrics.register(new Histogram('interactive_messages_latency_ms', 'Interactive message send latency in ms', ['type'], [100, 250, 500, 1000, 2500, 5000, 10000])),
    // ========== Media Metrics ==========
    mediaUploads: baileysMetrics.register(new Counter('media_uploads_total', 'Total media uploads', ['type', 'status'])),
    mediaDownloads: baileysMetrics.register(new Counter('media_downloads_total', 'Total media downloads', ['type', 'status'])),
    mediaSize: baileysMetrics.register(new Histogram('media_size_bytes', 'Media size in bytes', ['type', 'direction'], DEFAULT_SIZE_BUCKETS)),
    mediaLatency: baileysMetrics.register(new Histogram('media_latency_ms', 'Media upload/download latency in ms', ['type', 'direction'], [100, 500, 1000, 2500, 5000, 10000, 30000])),
    // ========== Event Buffer Metrics ==========
    bufferSize: baileysMetrics.register(new Gauge('buffer_size', 'Current event buffer size', ['type'])),
    bufferCapacity: baileysMetrics.register(new Gauge('buffer_capacity', 'Maximum event buffer capacity', ['type'])),
    bufferUtilization: baileysMetrics.register(new Gauge('buffer_utilization_percent', 'Event buffer utilization percentage', ['type'])),
    bufferFlushes: baileysMetrics.register(new Counter('buffer_flushes_total', 'Total buffer flush operations', ['type', 'reason'])),
    bufferOverflows: baileysMetrics.register(new Counter('buffer_overflows_total', 'Total buffer overflow events', ['type'])),
    eventsBuffered: baileysMetrics.register(new Counter('events_buffered_total', 'Total events added to buffer', ['event_type'])),
    eventsDropped: baileysMetrics.register(new Counter('events_dropped_total', 'Total events dropped due to buffer full', ['event_type'])),
    bufferFlushLatency: baileysMetrics.register(new Histogram('buffer_flush_latency_ms', 'Buffer flush operation latency in ms', ['type'], [1, 5, 10, 25, 50, 100, 250])),
    eventsProcessed: baileysMetrics.register(new Counter('events_processed_total', 'Total events processed from buffer', ['event_type'])),
    bufferDestroyed: baileysMetrics.register(new Counter('buffer_destroyed_total', 'Total buffers destroyed', ['reason', 'had_pending_flush'])),
    bufferFinalFlush: baileysMetrics.register(new Counter('buffer_final_flush_total', 'Total final flushes during destruction')),
    bufferCacheCleanup: baileysMetrics.register(new Counter('buffer_cache_cleanup_total', 'Total cache cleanup operations')),
    bufferCacheSize: baileysMetrics.register(new Gauge('buffer_cache_size', 'Current buffer cache size')),
    // ========== Adaptive Flush Metrics ==========
    adaptiveFlushInterval: baileysMetrics.register(new Gauge('adaptive_flush_interval_ms', 'Current adaptive flush interval in ms')),
    adaptiveFlushAdjustments: baileysMetrics.register(new Counter('adaptive_flush_adjustments_total', 'Total adaptive flush interval adjustments', ['direction'])),
    adaptiveFlushThroughput: baileysMetrics.register(new Gauge('adaptive_flush_throughput', 'Events processed per second by adaptive flush')),
    adaptiveFlushBackpressure: baileysMetrics.register(new Gauge('adaptive_flush_backpressure', 'Backpressure indicator (0-1)')),
    adaptiveFlushEfficiency: baileysMetrics.register(new Gauge('adaptive_flush_efficiency_percent', 'Flush efficiency percentage')),
    adaptiveHealthStatus: baileysMetrics.register(new Gauge('adaptive_health_status', 'Adaptive system health status (0=unhealthy, 1=healthy)')),
    adaptiveEventRate: baileysMetrics.register(new Gauge('adaptive_event_rate', 'Current event rate per second')),
    // ========== Error Metrics ==========
    errors: baileysMetrics.register(new Counter('errors_total', 'Total errors', ['category', 'code'])),
    errorRate: baileysMetrics.register(new Gauge('error_rate', 'Current error rate per minute', ['category'])),
    // ========== Retry Metrics ==========
    retries: baileysMetrics.register(new Counter('retries_total', 'Total retries', ['operation'])),
    retryLatency: baileysMetrics.register(new Histogram('retry_latency_ms', 'Retry latency in ms', ['operation'])),
    retrySuccess: baileysMetrics.register(new Counter('retry_success_total', 'Successful retries', ['operation'])),
    retryExhausted: baileysMetrics.register(new Counter('retry_exhausted_total', 'Exhausted retry attempts', ['operation'])),
    // ========== Socket Metrics ==========
    socketEvents: baileysMetrics.register(new Counter('socket_events_total', 'Total socket events', ['event'])),
    socketLatency: baileysMetrics.register(new Histogram('socket_latency_ms', 'Socket operation latency in ms', ['operation'])),
    socketBytesReceived: baileysMetrics.register(new Counter('socket_bytes_received_total', 'Total bytes received through socket')),
    socketBytesSent: baileysMetrics.register(new Counter('socket_bytes_sent_total', 'Total bytes sent through socket')),
    socketReconnects: baileysMetrics.register(new Counter('socket_reconnects_total', 'Total socket reconnection attempts', ['reason'])),
    // ========== Encryption Metrics ==========
    encryptionOperations: baileysMetrics.register(new Counter('encryption_operations_total', 'Total encryption operations', ['operation'])),
    encryptionLatency: baileysMetrics.register(new Histogram('encryption_latency_ms', 'Encryption operation latency in ms', ['operation'], [1, 5, 10, 25, 50, 100])),
    keyExchanges: baileysMetrics.register(new Counter('key_exchanges_total', 'Total key exchange operations', ['type'])),
    preKeyCount: baileysMetrics.register(new Gauge('prekey_count', 'Current prekey count')),
    // ========== Signal Identity Metrics ==========
    /** Total identity key changes detected (contact reinstalled WhatsApp) */
    signalIdentityChanges: baileysMetrics.register(new Counter('signal_identity_changes_total', 'Total identity key changes detected', ['type'])),
    /** Total Signal MAC errors encountered */
    signalMacErrors: baileysMetrics.register(new Counter('signal_mac_errors_total', 'Total Signal MAC verification errors', ['action'])),
    /** Total Signal session recreations by reason */
    signalSessionRecreations: baileysMetrics.register(new Counter('signal_session_recreations_total', 'Total Signal session recreations', ['reason'])),
    /** Identity key cache statistics */
    signalIdentityKeyCacheHits: baileysMetrics.register(new Counter('signal_identity_key_cache_hits_total', 'Total identity key cache hits')),
    signalIdentityKeyCacheMisses: baileysMetrics.register(new Counter('signal_identity_key_cache_misses_total', 'Total identity key cache misses')),
    /** Identity key operations latency */
    signalIdentityKeyOperations: baileysMetrics.register(new Histogram('signal_identity_key_operations_ms', 'Identity key operation latency in ms', ['operation'], [1, 5, 10, 25, 50, 100])),
    /** Current identity key cache size */
    signalIdentityKeyCacheSize: baileysMetrics.register(new Gauge('signal_identity_key_cache_size', 'Current identity key cache size')),
    // ========== Cache Metrics ==========
    cacheHits: baileysMetrics.register(new Counter('cache_hits_total', 'Total cache hits', ['cache'])),
    cacheMisses: baileysMetrics.register(new Counter('cache_misses_total', 'Total cache misses', ['cache'])),
    cacheSize: baileysMetrics.register(new Gauge('cache_size', 'Current cache size', ['cache'])),
    cacheEvictions: baileysMetrics.register(new Counter('cache_evictions_total', 'Total cache evictions', ['cache', 'reason'])),
    cacheHitRate: baileysMetrics.register(new Gauge('cache_hit_rate', 'Cache hit rate (0-1)', ['cache'])),
    // ========== Query Metrics ==========
    queryLatency: baileysMetrics.register(new Histogram('query_latency_ms', 'Query latency in ms', ['query_type'], [10, 50, 100, 250, 500, 1000, 2500, 5000])),
    queryCount: baileysMetrics.register(new Counter('query_count_total', 'Total queries executed', ['query_type', 'status'])),
    queryTimeouts: baileysMetrics.register(new Counter('query_timeouts_total', 'Total query timeouts', ['query_type'])),
    // ========== Presence Metrics ==========
    presenceUpdates: baileysMetrics.register(new Counter('presence_updates_total', 'Total presence updates received', ['type'])),
    presenceSubscriptions: baileysMetrics.register(new Gauge('presence_subscriptions', 'Current presence subscriptions')),
    // ========== Group Metrics ==========
    groupOperations: baileysMetrics.register(new Counter('group_operations_total', 'Total group operations', ['operation', 'status'])),
    groupMetadataFetches: baileysMetrics.register(new Counter('group_metadata_fetches_total', 'Total group metadata fetches', ['status'])),
    // ========== History Sync Metrics ==========
    historySyncEvents: baileysMetrics.register(new Counter('history_sync_events_total', 'Total history sync events', ['type'])),
    historySyncMessages: baileysMetrics.register(new Counter('history_sync_messages_total', 'Total messages synced from history')),
    historySyncDuration: baileysMetrics.register(new Histogram('history_sync_duration_ms', 'History sync duration in ms', ['type'], [1000, 5000, 10000, 30000, 60000]))
};
// ============================================
// Metrics Manager
// ============================================
/**
 * PrometheusMetricsManager - High-level manager for all metrics
 *
 * Provides a unified interface for managing metrics, HTTP server,
 * and system metrics collection.
 *
 * FIX: Removed duplicate SystemMetricsCollector - now uses server's collector
 */
export class PrometheusMetricsManager {
    constructor(config) {
        this.config = { ...loadMetricsConfig(), ...config };
        this.registry = baileysMetrics;
        this.metrics = metrics;
        this.server = new MetricsServer(this.registry, this.config);
    }
    /**
     * Initialize the metrics manager
     * FIX: No longer creates duplicate SystemMetricsCollector
     * The MetricsServer handles system metrics collection
     */
    async initialize() {
        if (!this.config.enabled) {
            return;
        }
        // MetricsServer.start() creates SystemMetricsCollector if includeSystem is true
        await this.server.start();
    }
    /**
     * Shutdown the metrics manager
     */
    async shutdown() {
        await this.server.stop();
    }
    /**
     * Get metrics output in Prometheus format
     */
    async getMetricsOutput() {
        // Use server's system collector to avoid duplication
        this.server.getSystemCollector()?.collect();
        return this.registry.getMetricsOutput();
    }
    /**
     * Reset all metrics
     */
    resetAll() {
        this.registry.resetAll();
    }
    /**
     * Check if metrics are enabled
     */
    isEnabled() {
        return this.config.enabled;
    }
}
// ============================================
// Helper Functions
// ============================================
/**
 * Helper to create HTTP metrics endpoint handler
 */
export function createMetricsHandler(registry = baileysMetrics) {
    return async (_req, res) => {
        const metricsOutput = await registry.getMetricsOutput();
        res.setHeader('Content-Type', registry.contentType());
        res.end(metricsOutput);
    };
}
/**
 * Create Express middleware for metrics endpoint
 */
export function createExpressMetricsMiddleware(registry = baileysMetrics) {
    return async (_req, res) => {
        const metricsOutput = await registry.getMetricsOutput();
        res.set('Content-Type', registry.contentType());
        res.send(metricsOutput);
    };
}
/**
 * Track operation duration using histogram
 */
export function trackDuration(histogram, labels, operation) {
    const endTimer = histogram.startTimer(labels);
    try {
        const result = operation();
        if (result instanceof Promise) {
            return result.finally(() => endTimer());
        }
        endTimer();
        return result;
    }
    catch (error) {
        endTimer();
        throw error;
    }
}
/**
 * Track operation duration using async histogram
 */
export async function trackDurationAsync(histogram, labels, operation) {
    const endTimer = histogram.startTimer(labels);
    try {
        const result = await operation();
        endTimer();
        return result;
    }
    catch (error) {
        endTimer();
        throw error;
    }
}
/**
 * Increment counter with automatic error tracking
 */
export function trackOperation(successCounter, errorCounter, labels) {
    return {
        success: () => successCounter.inc(labels),
        failure: (errorCode) => errorCounter.inc({ ...labels, code: errorCode || 'unknown' })
    };
}
// ============================================
// Event Buffer Metrics Integration
// ============================================
// Event buffer metrics (lazy initialized) - for detailed buffer tracking
// Note: bufferFlushes is NOT here - use metrics.bufferFlushes from main metrics object
let eventBufferMetrics = null;
function getEventBufferMetrics() {
    if (!eventBufferMetrics) {
        eventBufferMetrics = {
            bufferFlushEvents: new Histogram('buffer_flush_events', 'Number of events per buffer flush', [], [1, 5, 10, 25, 50, 100, 250, 500, 1000]),
            bufferCurrentSize: new Gauge('buffer_current_size', 'Current number of events in buffer'),
            bufferPeakSize: new Gauge('buffer_peak_size', 'Peak buffer size reached'),
            bufferHistoryCacheSize: new Gauge('buffer_history_cache_size', 'Current size of history cache'),
            bufferLruCleanups: new Counter('buffer_lru_cleanups_total', 'Total number of LRU cache cleanups performed')
        };
    }
    return eventBufferMetrics;
}
/**
 * Record an event being buffered
 * Used by event-buffer.ts for metrics integration
 */
export function recordEventBuffered(eventType, count = 1) {
    try {
        // Use the main metrics object which has eventsBuffered with label ['event_type']
        metrics.eventsBuffered?.inc({ event_type: eventType }, count);
    }
    catch {
        // Metrics not initialized, ignore silently
    }
}
/**
 * Record a buffer flush operation
 * Used by event-buffer.ts for metrics integration
 */
export function recordBufferFlush(eventCount, forced, historyCacheSize) {
    try {
        // Use the main metrics object which has the correct labels ['type', 'reason']
        metrics.bufferFlushes?.inc({ type: 'event', reason: forced ? 'forced' : 'normal' });
        // Update buffer cache size if provided
        if (typeof historyCacheSize === 'number') {
            metrics.bufferCacheSize?.set({}, historyCacheSize);
        }
        // Also update the lazy-loaded event buffer metrics for detailed tracking
        const ebMetrics = getEventBufferMetrics();
        ebMetrics.bufferFlushEvents?.observe({}, eventCount);
        ebMetrics.bufferCurrentSize?.set({}, 0); // Reset after flush
        if (typeof historyCacheSize === 'number') {
            ebMetrics.bufferHistoryCacheSize?.set({}, historyCacheSize);
        }
    }
    catch {
        // Metrics not initialized, ignore silently
    }
}
/**
 * Update buffer statistics gauge
 * Used by event-buffer.ts for metrics integration
 */
export function updateBufferStatistics(stats) {
    try {
        const ebMetrics = getEventBufferMetrics();
        ebMetrics.bufferCurrentSize?.set({}, stats.currentSize);
        ebMetrics.bufferPeakSize?.set({}, stats.peakSize);
        ebMetrics.bufferHistoryCacheSize?.set({}, stats.historyCacheSize);
    }
    catch {
        // Metrics not initialized, ignore silently
    }
}
/**
 * Record a cache cleanup operation
 * Used by event-buffer.ts when LRU cleanup is performed
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function recordCacheCleanup(_removedCount) {
    try {
        metrics.bufferCacheCleanup?.inc({});
    }
    catch {
        // Metrics not initialized, ignore silently
    }
}
/**
 * Record a buffer overflow event
 * Used by event-buffer.ts when buffer exceeds max size
 */
export function recordBufferOverflow() {
    try {
        metrics.bufferOverflows?.inc({ type: 'event' });
    }
    catch {
        // Metrics not initialized, ignore silently
    }
}
/**
 * Record a connection error
 * Used by socket.ts when connection fails
 */
export function recordConnectionError(errorType) {
    try {
        metrics.connectionErrors?.inc({ error_type: errorType });
    }
    catch {
        // Metrics not initialized, ignore silently
    }
}
/**
 * Record buffer destruction
 * Used by event-buffer.ts when buffer is destroyed
 */
export function recordBufferDestroyed(reason, hadPendingFlush) {
    try {
        metrics.bufferDestroyed?.inc({ reason, had_pending_flush: hadPendingFlush ? 'true' : 'false' });
    }
    catch {
        // Metrics not initialized, ignore silently
    }
}
/**
 * Record final flush during buffer destruction
 * Used by event-buffer.ts when buffer flushes remaining events on destroy
 */
export function recordBufferFinalFlush() {
    try {
        metrics.bufferFinalFlush?.inc({});
    }
    catch {
        // Metrics not initialized, ignore silently
    }
}
/**
 * Update adaptive system metrics
 * Used by event-buffer.ts to report adaptive timeout health and event rate
 */
export function updateAdaptiveMetrics(eventRate, isHealthy) {
    try {
        metrics.adaptiveEventRate?.set({}, eventRate);
        metrics.adaptiveHealthStatus?.set({}, isHealthy ? 1 : 0);
    }
    catch {
        // Metrics not initialized, ignore silently
    }
}
// ============================================
// WhatsApp Connection & Message Metrics
// ============================================
/**
 * Increment active connections gauge
 */
export function incrementActiveConnections() {
    try {
        metrics.activeConnections?.inc({});
    }
    catch {
        // Metrics not initialized, ignore silently
    }
}
/**
 * Decrement active connections gauge
 */
export function decrementActiveConnections() {
    try {
        metrics.activeConnections?.dec({});
    }
    catch {
        // Metrics not initialized, ignore silently
    }
}
/**
 * Set active connections to specific value
 */
export function setActiveConnections(count) {
    try {
        metrics.activeConnections?.set({}, count);
    }
    catch {
        // Metrics not initialized, ignore silently
    }
}
/**
 * Record a connection attempt
 */
export function recordConnectionAttempt(status) {
    try {
        metrics.connectionAttempts?.inc({ status });
    }
    catch {
        // Metrics not initialized, ignore silently
    }
}
/**
 * Record a message sent
 */
export function recordMessageSent(type = 'text') {
    try {
        metrics.messagesSent?.inc({ type });
    }
    catch {
        // Metrics not initialized, ignore silently
    }
}
/**
 * Record a message received
 */
export function recordMessageReceived(type = 'text') {
    try {
        metrics.messagesReceived?.inc({ type });
    }
    catch {
        // Metrics not initialized, ignore silently
    }
}
/**
 * Record a message retry attempt
 */
export function recordMessageRetry(type = 'text') {
    try {
        metrics.messageRetries?.inc({ type });
    }
    catch {
        // Metrics not initialized, ignore silently
    }
}
/**
 * Record a message failure
 */
export function recordMessageFailure(type = 'text', reason = 'unknown') {
    try {
        metrics.messageFailures?.inc({ type, reason });
    }
    catch {
        // Metrics not initialized, ignore silently
    }
}
/**
 * Update messages queued gauge
 */
export function setMessagesQueued(count, priority = 'normal') {
    try {
        metrics.messagesQueued?.set({ priority }, count);
    }
    catch {
        // Metrics not initialized, ignore silently
    }
}
/**
 * Record history sync messages
 */
export function recordHistorySyncMessages(count = 1) {
    try {
        metrics.historySyncMessages?.inc({}, count);
    }
    catch {
        // Metrics not initialized, ignore silently
    }
}
// ============================================
// Global Instance
// ============================================
/**
 * Global metrics manager instance
 */
let globalMetricsManager = null;
/**
 * Get or create global metrics manager
 */
export function getMetricsManager(config) {
    if (!globalMetricsManager) {
        globalMetricsManager = new PrometheusMetricsManager(config);
    }
    return globalMetricsManager;
}
/**
 * Initialize metrics with labels to zero values
 * This ensures they appear in Prometheus output even before first increment
 */
function initializeMetricsWithLabels() {
    try {
        // Buffer destroyed metric
        metrics.bufferDestroyed?.inc({ reason: 'normal', had_pending_flush: 'true' }, 0);
        metrics.bufferDestroyed?.inc({ reason: 'normal', had_pending_flush: 'false' }, 0);
        metrics.bufferDestroyed?.inc({ reason: 'error', had_pending_flush: 'true' }, 0);
        metrics.bufferDestroyed?.inc({ reason: 'error', had_pending_flush: 'false' }, 0);
        // Buffer flushes metric
        metrics.bufferFlushes?.inc({ type: 'event', reason: 'normal' }, 0);
        metrics.bufferFlushes?.inc({ type: 'event', reason: 'forced' }, 0);
        // Connection metrics
        metrics.connectionAttempts?.inc({ status: 'success' }, 0);
        metrics.connectionAttempts?.inc({ status: 'failure' }, 0);
        metrics.connectionErrors?.inc({ error_type: 'timeout' }, 0);
        metrics.connectionErrors?.inc({ error_type: 'closed' }, 0);
        metrics.connectionErrors?.inc({ error_type: 'unknown' }, 0);
        // Message metrics
        metrics.messagesSent?.inc({ type: 'text' }, 0);
        metrics.messagesSent?.inc({ type: 'media' }, 0);
        metrics.messagesSent?.inc({ type: 'other' }, 0);
        metrics.messagesReceived?.inc({ type: 'text' }, 0);
        metrics.messagesReceived?.inc({ type: 'media' }, 0);
        metrics.messagesReceived?.inc({ type: 'notification' }, 0);
        metrics.messagesReceived?.inc({ type: 'other' }, 0);
        metrics.messageRetries?.inc({ type: 'text' }, 0);
        metrics.messageRetries?.inc({ type: 'other' }, 0);
        metrics.messageFailures?.inc({ type: 'text', reason: 'max_retries' }, 0);
        metrics.messageFailures?.inc({ type: 'other', reason: 'max_retries' }, 0);
        console.log('[Prometheus] Initialized metrics with labels');
    }
    catch (error) {
        console.error('[Prometheus] Error initializing metrics with labels:', error);
    }
}
/**
 * Initialize global metrics (call once at application startup)
 */
export async function initializeMetrics(config) {
    const manager = getMetricsManager(config);
    await manager.initialize();
    // Initialize metrics with labels to zero values
    initializeMetricsWithLabels();
    return manager;
}
/**
 * Shutdown global metrics (call at application shutdown)
 */
export async function shutdownMetrics() {
    if (globalMetricsManager) {
        await globalMetricsManager.shutdown();
        globalMetricsManager = null;
    }
}
// ============================================
// Auto-initialization
// ============================================
/**
 * Auto-start the Prometheus metrics server when module is loaded
 * and BAILEYS_PROMETHEUS_ENABLED=true
 *
 * This ensures the /metrics endpoint is available without requiring
 * manual initialization in the application code.
 */
if (metricsConfig.enabled) {
    // Use setImmediate to avoid blocking module loading
    setImmediate(() => {
        initializeMetrics()
            .then(() => {
            console.log('[Prometheus] Auto-initialized metrics server successfully');
        })
            .catch(error => {
            console.error('[Prometheus] Failed to auto-initialize metrics server:', error);
        });
    });
}
// ============================================
// Default Export
// ============================================
export default baileysMetrics;
//# sourceMappingURL=prometheus-metrics.js.map