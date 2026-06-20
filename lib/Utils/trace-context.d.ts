/**
 * Request Tracing Context
 *
 * Provides:
 * - Unique trace ID generation
 * - Context propagation between operations
 * - Correlation IDs for request tracking
 * - Performance timing
 * - Span tracking for nested operations
 * - Baggage for contextual data
 *
 * @module Utils/trace-context
 */
/**
 * Trace identifiers
 */
export interface TraceIds {
    /** Unique trace ID (16 bytes hex) */
    traceId: string;
    /** Current span ID (8 bytes hex) */
    spanId: string;
    /** Parent span ID (optional) */
    parentSpanId?: string;
    /** Correlation ID for logging */
    correlationId: string;
}
/**
 * Baggage data (propagated context)
 */
export type Baggage = Record<string, string | number | boolean>;
/**
 * Span status
 */
export type SpanStatus = 'unset' | 'ok' | 'error';
/**
 * Span represents a unit of work
 */
export interface Span {
    /** Operation name */
    name: string;
    /** Trace identifiers */
    traceIds: TraceIds;
    /** Start timestamp (ms) */
    startTime: number;
    /** End timestamp (ms) */
    endTime?: number;
    /** Duration in ms */
    duration?: number;
    /** Span status */
    status: SpanStatus;
    /** Span attributes */
    attributes: Record<string, unknown>;
    /** Events occurred during the span */
    events: SpanEvent[];
    /** Whether the span has ended */
    ended: boolean;
}
/**
 * Event within a span
 */
export interface SpanEvent {
    /** Event name */
    name: string;
    /** Event timestamp */
    timestamp: number;
    /** Event attributes */
    attributes?: Record<string, unknown>;
}
/**
 * Complete trace context
 */
export interface TraceContext {
    /** Trace identifiers */
    traceIds: TraceIds;
    /** Baggage (propagated data) */
    baggage: Baggage;
    /** Current span */
    currentSpan?: Span;
    /** Span stack (for nested spans) */
    spanStack: Span[];
    /** Context creation timestamp */
    createdAt: number;
    /** Additional metadata */
    metadata: Record<string, unknown>;
}
/**
 * Options for creating a new context
 */
export interface CreateContextOptions {
    /** Existing trace ID (for propagation) */
    traceId?: string;
    /** Parent span ID */
    parentSpanId?: string;
    /** Existing correlation ID */
    correlationId?: string;
    /** Initial baggage */
    baggage?: Baggage;
    /** Initial metadata */
    metadata?: Record<string, unknown>;
}
/**
 * Options for creating a span
 */
export interface CreateSpanOptions {
    /** Span name */
    name: string;
    /** Initial attributes */
    attributes?: Record<string, unknown>;
    /** Whether to be a child of the current span */
    asChild?: boolean;
}
/**
 * Generate a trace ID (16 bytes = 32 chars hex)
 */
export declare function generateTraceId(): string;
/**
 * Generate a span ID (8 bytes = 16 chars hex)
 */
export declare function generateSpanId(): string;
/**
 * Generate a more readable correlation ID
 */
export declare function generateCorrelationId(): string;
/**
 * Create a new trace context
 */
export declare function createTraceContext(options?: CreateContextOptions): TraceContext;
/**
 * Get the current trace context
 */
export declare function getCurrentContext(): TraceContext | undefined;
/**
 * Get the current trace context or create a new one
 */
export declare function getOrCreateContext(): TraceContext;
/**
 * Execute function with trace context
 */
export declare function runWithContext<T>(context: TraceContext, fn: () => T): T;
/**
 * Execute function with new trace context
 */
export declare function runWithNewContext<T>(options: CreateContextOptions, fn: () => T): T;
/**
 * Execute async function with trace context
 */
export declare function runWithContextAsync<T>(context: TraceContext, fn: () => Promise<T>): Promise<T>;
/**
 * Create a new span
 */
export declare function createSpan(options: CreateSpanOptions): Span;
/**
 * Start a span in the current context
 */
export declare function startSpan(options: CreateSpanOptions): Span;
/**
 * End a span
 */
export declare function endSpan(span: Span, status?: SpanStatus): void;
/**
 * Add event to a span
 */
export declare function addSpanEvent(span: Span, name: string, attributes?: Record<string, unknown>): void;
/**
 * Set attributes on a span
 */
export declare function setSpanAttributes(span: Span, attributes: Record<string, unknown>): void;
/**
 * Mark span as error
 */
export declare function setSpanError(span: Span, error: Error): void;
/**
 * Decorator for automatic function tracing
 */
export declare function traced(name?: string): <T extends (...args: unknown[]) => unknown>(_target: unknown, propertyKey: string, descriptor: TypedPropertyDescriptor<T>) => TypedPropertyDescriptor<T>;
/**
 * Wrapper for tracing a function
 */
export declare function traceFunction<T extends (...args: unknown[]) => unknown>(name: string, fn: T): T;
/**
 * Execute operation with automatic span
 */
export declare function withSpan<T>(name: string, operation: (span: Span) => Promise<T>, attributes?: Record<string, unknown>): Promise<T>;
/**
 * Execute sync operation with automatic span
 */
export declare function withSpanSync<T>(name: string, operation: (span: Span) => T, attributes?: Record<string, unknown>): T;
/**
 * Set item in baggage
 */
export declare function setBaggage(key: string, value: string | number | boolean): void;
/**
 * Get item from baggage
 */
export declare function getBaggage(key: string): string | number | boolean | undefined;
/**
 * Get all baggage
 */
export declare function getAllBaggage(): Baggage;
/**
 * Remove item from baggage
 */
export declare function removeBaggage(key: string): void;
/**
 * Standard headers for trace propagation
 */
export declare const TRACE_HEADERS: {
    readonly TRACE_ID: "x-trace-id";
    readonly SPAN_ID: "x-span-id";
    readonly PARENT_SPAN_ID: "x-parent-span-id";
    readonly CORRELATION_ID: "x-correlation-id";
    readonly BAGGAGE: "baggage";
};
/**
 * Inject context into HTTP headers
 */
export declare function injectTraceHeaders(headers: Record<string, string>): Record<string, string>;
/**
 * Extract context from HTTP headers
 */
export declare function extractTraceHeaders(headers: Record<string, string | undefined>): CreateContextOptions;
/**
 * Export trace context for serialization
 */
export declare function exportContext(context: TraceContext): string;
/**
 * Import trace context from serialized string
 */
export declare function importContext(serialized: string): CreateContextOptions;
/**
 * High precision timer
 */
export interface PrecisionTimer {
    /** Return elapsed time in milliseconds */
    elapsed(): number;
    /** Return formatted elapsed time */
    elapsedFormatted(): string;
    /** Stop the timer and return duration */
    stop(): number;
}
/**
 * Create a high precision timer
 */
export declare function createPrecisionTimer(): PrecisionTimer;
declare const _default: {
    createTraceContext: typeof createTraceContext;
    getCurrentContext: typeof getCurrentContext;
    getOrCreateContext: typeof getOrCreateContext;
    runWithContext: typeof runWithContext;
    runWithNewContext: typeof runWithNewContext;
    createSpan: typeof createSpan;
    startSpan: typeof startSpan;
    endSpan: typeof endSpan;
    withSpan: typeof withSpan;
    withSpanSync: typeof withSpanSync;
    injectTraceHeaders: typeof injectTraceHeaders;
    extractTraceHeaders: typeof extractTraceHeaders;
    createPrecisionTimer: typeof createPrecisionTimer;
};
export default _default;
//# sourceMappingURL=trace-context.d.ts.map