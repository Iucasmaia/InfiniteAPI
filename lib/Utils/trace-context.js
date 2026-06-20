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
import { AsyncLocalStorage } from 'async_hooks';
import { randomBytes } from 'crypto';
/**
 * Async storage for trace context
 */
const traceStorage = new AsyncLocalStorage();
/**
 * Generate a random hexadecimal ID
 */
function generateId(bytes) {
    return randomBytes(bytes).toString('hex');
}
/**
 * Generate a trace ID (16 bytes = 32 chars hex)
 */
export function generateTraceId() {
    return generateId(16);
}
/**
 * Generate a span ID (8 bytes = 16 chars hex)
 */
export function generateSpanId() {
    return generateId(8);
}
/**
 * Generate a more readable correlation ID
 */
export function generateCorrelationId() {
    const timestamp = Date.now().toString(36);
    const random = generateId(4);
    return `${timestamp}-${random}`;
}
/**
 * Create a new trace context
 */
export function createTraceContext(options = {}) {
    const traceId = options.traceId || generateTraceId();
    const spanId = generateSpanId();
    const correlationId = options.correlationId || generateCorrelationId();
    return {
        traceIds: {
            traceId,
            spanId,
            parentSpanId: options.parentSpanId,
            correlationId
        },
        baggage: options.baggage || {},
        spanStack: [],
        createdAt: Date.now(),
        metadata: options.metadata || {}
    };
}
/**
 * Get the current trace context
 */
export function getCurrentContext() {
    return traceStorage.getStore();
}
/**
 * Get the current trace context or create a new one
 */
export function getOrCreateContext() {
    const existing = getCurrentContext();
    if (existing) {
        return existing;
    }
    return createTraceContext();
}
/**
 * Execute function with trace context
 */
export function runWithContext(context, fn) {
    return traceStorage.run(context, fn);
}
/**
 * Execute function with new trace context
 */
export function runWithNewContext(options, fn) {
    const context = createTraceContext(options);
    return runWithContext(context, fn);
}
/**
 * Execute async function with trace context
 */
export async function runWithContextAsync(context, fn) {
    return traceStorage.run(context, fn);
}
/**
 * Create a new span
 */
export function createSpan(options) {
    const context = getCurrentContext();
    const parentSpan = context?.currentSpan;
    const span = {
        name: options.name,
        traceIds: {
            traceId: context?.traceIds.traceId || generateTraceId(),
            spanId: generateSpanId(),
            parentSpanId: options.asChild && parentSpan ? parentSpan.traceIds.spanId : undefined,
            correlationId: context?.traceIds.correlationId || generateCorrelationId()
        },
        startTime: Date.now(),
        status: 'unset',
        attributes: options.attributes || {},
        events: [],
        ended: false
    };
    return span;
}
/**
 * Start a span in the current context
 */
export function startSpan(options) {
    const context = getOrCreateContext();
    const span = createSpan({ ...options, asChild: true });
    // Push current span to stack and set new one as current
    if (context.currentSpan) {
        context.spanStack.push(context.currentSpan);
    }
    context.currentSpan = span;
    return span;
}
/**
 * End a span
 */
export function endSpan(span, status) {
    if (span.ended) {
        return;
    }
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = status || 'ok';
    span.ended = true;
    // Pop span from stack in context
    const context = getCurrentContext();
    if (context?.currentSpan === span) {
        context.currentSpan = context.spanStack.pop();
    }
}
/**
 * Add event to a span
 */
export function addSpanEvent(span, name, attributes) {
    if (span.ended) {
        return;
    }
    span.events.push({
        name,
        timestamp: Date.now(),
        attributes
    });
}
/**
 * Set attributes on a span
 */
export function setSpanAttributes(span, attributes) {
    if (span.ended) {
        return;
    }
    Object.assign(span.attributes, attributes);
}
/**
 * Mark span as error
 */
export function setSpanError(span, error) {
    if (span.ended) {
        return;
    }
    span.status = 'error';
    span.attributes.error = true;
    span.attributes.errorMessage = error.message;
    span.attributes.errorName = error.name;
    if (error.stack) {
        span.attributes.errorStack = error.stack;
    }
    addSpanEvent(span, 'exception', {
        'exception.type': error.name,
        'exception.message': error.message
    });
}
/**
 * Decorator for automatic function tracing
 */
export function traced(name) {
    return function (_target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        if (!originalMethod) {
            return descriptor;
        }
        const spanName = name || propertyKey;
        descriptor.value = function (...args) {
            const span = startSpan({ name: spanName });
            try {
                const result = originalMethod.apply(this, args);
                if (result instanceof Promise) {
                    return result
                        .then(value => {
                        endSpan(span, 'ok');
                        return value;
                    })
                        .catch(error => {
                        setSpanError(span, error);
                        endSpan(span, 'error');
                        throw error;
                    });
                }
                endSpan(span, 'ok');
                return result;
            }
            catch (error) {
                setSpanError(span, error);
                endSpan(span, 'error');
                throw error;
            }
        };
        return descriptor;
    };
}
/**
 * Wrapper for tracing a function
 */
// eslint-disable-next-line space-before-function-paren
export function traceFunction(name, fn) {
    return function (...args) {
        const span = startSpan({ name });
        try {
            const result = fn.apply(this, args);
            if (result instanceof Promise) {
                return result
                    .then(value => {
                    endSpan(span, 'ok');
                    return value;
                })
                    .catch(error => {
                    setSpanError(span, error);
                    endSpan(span, 'error');
                    throw error;
                });
            }
            endSpan(span, 'ok');
            return result;
        }
        catch (error) {
            setSpanError(span, error);
            endSpan(span, 'error');
            throw error;
        }
    };
}
/**
 * Execute operation with automatic span
 */
export async function withSpan(name, operation, attributes) {
    const span = startSpan({ name, attributes });
    try {
        const result = await operation(span);
        endSpan(span, 'ok');
        return result;
    }
    catch (error) {
        setSpanError(span, error);
        endSpan(span, 'error');
        throw error;
    }
}
/**
 * Execute sync operation with automatic span
 */
export function withSpanSync(name, operation, attributes) {
    const span = startSpan({ name, attributes });
    try {
        const result = operation(span);
        endSpan(span, 'ok');
        return result;
    }
    catch (error) {
        setSpanError(span, error);
        endSpan(span, 'error');
        throw error;
    }
}
// === Baggage Management ===
/**
 * Set item in baggage
 */
export function setBaggage(key, value) {
    const context = getCurrentContext();
    if (context) {
        context.baggage[key] = value;
    }
}
/**
 * Get item from baggage
 */
export function getBaggage(key) {
    const context = getCurrentContext();
    return context?.baggage[key];
}
/**
 * Get all baggage
 */
export function getAllBaggage() {
    const context = getCurrentContext();
    return context?.baggage || {};
}
/**
 * Remove item from baggage
 */
export function removeBaggage(key) {
    const context = getCurrentContext();
    if (context) {
        delete context.baggage[key];
    }
}
// === Header Utilities ===
/**
 * Standard headers for trace propagation
 */
export const TRACE_HEADERS = {
    TRACE_ID: 'x-trace-id',
    SPAN_ID: 'x-span-id',
    PARENT_SPAN_ID: 'x-parent-span-id',
    CORRELATION_ID: 'x-correlation-id',
    BAGGAGE: 'baggage'
};
/**
 * Inject context into HTTP headers
 */
export function injectTraceHeaders(headers) {
    const context = getCurrentContext();
    if (!context) {
        return headers;
    }
    const result = { ...headers };
    result[TRACE_HEADERS.TRACE_ID] = context.traceIds.traceId;
    result[TRACE_HEADERS.SPAN_ID] = context.traceIds.spanId;
    result[TRACE_HEADERS.CORRELATION_ID] = context.traceIds.correlationId;
    if (context.traceIds.parentSpanId) {
        result[TRACE_HEADERS.PARENT_SPAN_ID] = context.traceIds.parentSpanId;
    }
    // Baggage as key=value list
    if (Object.keys(context.baggage).length > 0) {
        result[TRACE_HEADERS.BAGGAGE] = Object.entries(context.baggage)
            .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
            .join(',');
    }
    return result;
}
/**
 * Extract context from HTTP headers
 */
export function extractTraceHeaders(headers) {
    const options = {};
    if (headers[TRACE_HEADERS.TRACE_ID]) {
        options.traceId = headers[TRACE_HEADERS.TRACE_ID];
    }
    if (headers[TRACE_HEADERS.PARENT_SPAN_ID]) {
        options.parentSpanId = headers[TRACE_HEADERS.PARENT_SPAN_ID];
    }
    if (headers[TRACE_HEADERS.CORRELATION_ID]) {
        options.correlationId = headers[TRACE_HEADERS.CORRELATION_ID];
    }
    // Parse baggage
    const baggageHeader = headers[TRACE_HEADERS.BAGGAGE];
    if (baggageHeader) {
        options.baggage = {};
        const pairs = baggageHeader.split(',');
        for (const pair of pairs) {
            const parts = pair.split('=');
            const key = parts[0];
            const value = parts[1];
            if (key && value) {
                options.baggage[key.trim()] = decodeURIComponent(value.trim());
            }
        }
    }
    return options;
}
/**
 * Export trace context for serialization
 */
export function exportContext(context) {
    return JSON.stringify({
        traceIds: context.traceIds,
        baggage: context.baggage,
        metadata: context.metadata
    });
}
/**
 * Import trace context from serialized string
 */
export function importContext(serialized) {
    try {
        const data = JSON.parse(serialized);
        return {
            traceId: data.traceIds?.traceId,
            parentSpanId: data.traceIds?.spanId,
            correlationId: data.traceIds?.correlationId,
            baggage: data.baggage,
            metadata: data.metadata
        };
    }
    catch {
        return {};
    }
}
/**
 * Create a high precision timer
 */
export function createPrecisionTimer() {
    const start = process.hrtime.bigint();
    let stopped = false;
    let finalDuration = 0;
    return {
        elapsed() {
            if (stopped)
                return finalDuration;
            return Number(process.hrtime.bigint() - start) / 1000000;
        },
        elapsedFormatted() {
            const ms = this.elapsed();
            if (ms < 1)
                return `${(ms * 1000).toFixed(2)}µs`;
            if (ms < 1000)
                return `${ms.toFixed(2)}ms`;
            return `${(ms / 1000).toFixed(2)}s`;
        },
        stop() {
            if (!stopped) {
                finalDuration = Number(process.hrtime.bigint() - start) / 1000000;
                stopped = true;
            }
            return finalDuration;
        }
    };
}
export default {
    createTraceContext,
    getCurrentContext,
    getOrCreateContext,
    runWithContext,
    runWithNewContext,
    createSpan,
    startSpan,
    endSpan,
    withSpan,
    withSpanSync,
    injectTraceHeaders,
    extractTraceHeaders,
    createPrecisionTimer
};
//# sourceMappingURL=trace-context.js.map