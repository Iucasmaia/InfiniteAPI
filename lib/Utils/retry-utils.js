/**
 * Smart Retry Logic
 *
 * Provides:
 * - Exponential backoff
 * - Jitter to avoid thundering herd
 * - Configurable max attempts
 * - Customizable retry predicates
 * - Event hooks
 * - Cancellation support
 *
 * @module Utils/retry-utils
 */
import { EventEmitter } from 'events';
import { metrics } from './prometheus-metrics.js';
/**
 * Retry configuration with custom progressive backoff
 * Fixed delay steps in milliseconds: 1s → 2s → 5s → 10s → 20s
 * Exported for external use (e.g., custom retry logic)
 */
export const RETRY_BACKOFF_DELAYS = [1000, 2000, 5000, 10000, 20000];
/**
 * Jitter factor for retry delays (0.15 = ±15% randomization)
 * Helps prevent thundering herd problem
 */
export const RETRY_JITTER_FACTOR = 0.15;
/**
 * Retry exhausted error
 */
export class RetryExhaustedError extends Error {
    constructor(originalError, attempts, operationName) {
        super(`Retry exhausted after ${attempts} attempts${operationName ? ` for "${operationName}"` : ''}: ${originalError.message}`);
        this.originalError = originalError;
        this.attempts = attempts;
        this.operationName = operationName;
        this.name = 'RetryExhaustedError';
    }
}
/**
 * Abort error
 */
export class RetryAbortedError extends Error {
    constructor(attempt) {
        super(`Retry aborted at attempt ${attempt}`);
        this.attempt = attempt;
        this.name = 'RetryAbortedError';
    }
}
/**
 * Calculate delay based on strategy
 */
export function calculateDelay(attempt, baseDelay, maxDelay, strategy, multiplier, jitter) {
    // Normalize attempt to ensure valid calculation (must be >= 1)
    const normalizedAttempt = Math.max(attempt, 1);
    let delay;
    switch (strategy) {
        case 'exponential':
            delay = baseDelay * Math.pow(multiplier, normalizedAttempt - 1);
            break;
        case 'linear':
            delay = baseDelay * normalizedAttempt;
            break;
        case 'constant':
            delay = baseDelay;
            break;
        case 'fibonacci': {
            const fib = fibonacciNumber(normalizedAttempt);
            delay = baseDelay * fib;
            break;
        }
        case 'stepped': {
            // Uses pre-defined delay array directly (ignores baseDelay/multiplier)
            // Falls back to last delay if attempt exceeds array length
            const index = Math.min(normalizedAttempt - 1, RETRY_BACKOFF_DELAYS.length - 1);
            delay = RETRY_BACKOFF_DELAYS[index] ?? RETRY_BACKOFF_DELAYS[0] ?? baseDelay;
            break;
        }
        default:
            delay = baseDelay;
    }
    // Apply jitter BEFORE capping to maxDelay
    if (jitter > 0) {
        const jitterAmount = delay * jitter;
        delay = delay + (Math.random() * 2 - 1) * jitterAmount;
    }
    // Apply max delay cap AFTER jitter to ensure we never exceed maxDelay
    delay = Math.min(delay, maxDelay);
    return Math.max(0, Math.round(delay));
}
/**
 * Calculate Fibonacci number
 */
function fibonacciNumber(n) {
    if (n <= 1)
        return 1;
    let a = 1, b = 1;
    for (let i = 2; i < n; i++) {
        const c = a + b;
        a = b;
        b = c;
    }
    return b;
}
/**
 * Sleep with abort support
 */
async function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
        let abortHandler;
        const timer = setTimeout(() => {
            // Cleanup abort listener on normal completion to prevent memory leak
            if (signal && abortHandler) {
                signal.removeEventListener('abort', abortHandler);
            }
            resolve();
        }, ms);
        if (signal) {
            if (signal.aborted) {
                clearTimeout(timer);
                reject(new RetryAbortedError(0));
                return;
            }
            abortHandler = () => {
                clearTimeout(timer);
                reject(new RetryAbortedError(0));
            };
            signal.addEventListener('abort', abortHandler, { once: true });
        }
    });
}
/**
 * Execute operation with timeout
 */
async function executeWithTimeout(operation, timeout, signal) {
    return new Promise((resolve, reject) => {
        let completed = false;
        const timer = setTimeout(() => {
            if (!completed) {
                completed = true;
                reject(new Error(`Operation timed out after ${timeout}ms`));
            }
        }, timeout);
        if (signal?.aborted) {
            clearTimeout(timer);
            reject(new RetryAbortedError(0));
            return;
        }
        operation()
            .then(result => {
            if (!completed) {
                completed = true;
                clearTimeout(timer);
                resolve(result);
            }
        })
            .catch(error => {
            if (!completed) {
                completed = true;
                clearTimeout(timer);
                reject(error);
            }
        });
    });
}
/**
 * Main retry function
 */
export async function retry(operation, options = {}) {
    const config = {
        maxAttempts: options.maxAttempts ?? 3,
        baseDelay: options.baseDelay ?? 1000,
        maxDelay: options.maxDelay ?? 30000,
        backoffStrategy: options.backoffStrategy ?? 'exponential',
        backoffMultiplier: options.backoffMultiplier ?? 2,
        jitter: options.jitter ?? 0.1,
        shouldRetry: options.shouldRetry ?? (() => true),
        timeout: options.timeout,
        operationName: options.operationName ?? 'operation',
        collectMetrics: options.collectMetrics ?? true,
        onRetry: options.onRetry ?? (() => { }),
        onSuccess: options.onSuccess ?? (() => { }),
        onFailure: options.onFailure ?? (() => { }),
        abortSignal: options.abortSignal
    };
    const context = {
        attempt: 0,
        maxAttempts: config.maxAttempts,
        startTime: Date.now(),
        aborted: false
    };
    let lastError;
    // Check initial abort
    if (config.abortSignal?.aborted) {
        throw new RetryAbortedError(0);
    }
    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
        context.attempt = attempt;
        // Check abort
        if (config.abortSignal?.aborted) {
            context.aborted = true;
            throw new RetryAbortedError(attempt);
        }
        try {
            // Execute operation
            let result;
            if (config.timeout) {
                result = await executeWithTimeout(() => Promise.resolve(operation(context)), config.timeout, config.abortSignal);
            }
            else {
                result = await operation(context);
            }
            // Success - only count as retry success if this wasn't the first attempt
            if (config.collectMetrics && attempt > 1) {
                // This was a successful retry (not first attempt)
                metrics.retries.inc({ operation: config.operationName });
            }
            config.onSuccess(result, attempt);
            return result;
        }
        catch (error) {
            lastError = error;
            context.lastError = lastError;
            // Check if should retry
            const shouldRetry = await config.shouldRetry(lastError, attempt);
            if (!shouldRetry || attempt >= config.maxAttempts) {
                // Final failure - use dedicated retry exhausted metric
                if (config.collectMetrics) {
                    metrics.retryExhausted.inc({ operation: config.operationName });
                }
                config.onFailure(lastError, attempt);
                throw new RetryExhaustedError(lastError, attempt, config.operationName);
            }
            // Calculate delay
            const delay = calculateDelay(attempt, config.baseDelay, config.maxDelay, config.backoffStrategy, config.backoffMultiplier, config.jitter);
            // Retry callback
            await config.onRetry(lastError, attempt, delay);
            if (config.collectMetrics) {
                metrics.retryLatency.observe({ operation: config.operationName }, delay);
            }
            // Wait for delay
            await sleep(delay, config.abortSignal);
        }
    }
    // Should never reach here, but TypeScript needs this
    throw new RetryExhaustedError(lastError || new Error('Unknown error'), config.maxAttempts, config.operationName);
}
/**
 * Retry with detailed result
 */
export async function retryWithResult(operation, options = {}) {
    const startTime = Date.now();
    let attempts = 0;
    let lastAttemptStart = startTime;
    try {
        const result = await retry(context => {
            attempts = context.attempt;
            lastAttemptStart = Date.now();
            return operation(context);
        }, options);
        return {
            success: true,
            result,
            attempts,
            totalDuration: Date.now() - startTime,
            lastAttemptDuration: Date.now() - lastAttemptStart
        };
    }
    catch (error) {
        return {
            success: false,
            error: error,
            attempts,
            totalDuration: Date.now() - startTime,
            lastAttemptDuration: Date.now() - lastAttemptStart
        };
    }
}
/**
 * Factory to create configured retry function
 */
export function createRetrier(defaultOptions = {}) {
    return (operation, options) => {
        return retry(operation, { ...defaultOptions, ...options });
    };
}
/**
 * Decorator to add retry to method
 */
export function withRetry(options = {}) {
    return function (_target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        if (!originalMethod)
            return descriptor;
        descriptor.value = async function (...args) {
            return retry(() => originalMethod.apply(this, args), {
                ...options,
                operationName: options.operationName || propertyKey
            });
        };
        return descriptor;
    };
}
/**
 * Wrapper for function with retry
 */
// eslint-disable-next-line space-before-function-paren
export function retryable(fn, options = {}) {
    return async (...args) => {
        return retry(() => fn(...args), options);
    };
}
/**
 * Class to manage retries with state
 */
export class RetryManager extends EventEmitter {
    constructor(defaultOptions = {}) {
        super();
        this.activeRetries = new Map();
        this.defaultOptions = defaultOptions;
    }
    /**
     * Execute operation with retry
     */
    async execute(id, operation, options) {
        // Cancel previous retry with same ID
        this.cancel(id);
        const abortController = new AbortController();
        const mergedOptions = { ...this.defaultOptions, ...options, abortSignal: abortController.signal };
        const retryPromise = retry(context => {
            this.activeRetries.set(id, {
                cancel: () => abortController.abort(),
                context
            });
            this.emit('attempt', { id, attempt: context.attempt });
            return operation(context);
        }, mergedOptions);
        try {
            const result = await retryPromise;
            this.emit('success', { id });
            return result;
        }
        catch (error) {
            this.emit('failure', { id, error });
            throw error;
        }
        finally {
            this.activeRetries.delete(id);
        }
    }
    /**
     * Cancel in-progress retry
     */
    cancel(id) {
        const active = this.activeRetries.get(id);
        if (active) {
            active.cancel();
            this.activeRetries.delete(id);
            this.emit('cancelled', { id });
            return true;
        }
        return false;
    }
    /**
     * Cancel all retries
     */
    cancelAll() {
        for (const [id, active] of this.activeRetries) {
            active.cancel();
            this.emit('cancelled', { id });
        }
        this.activeRetries.clear();
    }
    /**
     * Check if there is an active retry
     */
    isActive(id) {
        return this.activeRetries.has(id);
    }
    /**
     * Return active retry context
     */
    getContext(id) {
        return this.activeRetries.get(id)?.context;
    }
    /**
     * Return active retry IDs
     */
    getActiveIds() {
        return Array.from(this.activeRetries.keys());
    }
}
/**
 * Common predicates for shouldRetry
 */
export const retryPredicates = {
    /** Always retry (up to max attempts) */
    always: () => true,
    /** Never retry */
    never: () => false,
    /** Retry only on network errors */
    onNetworkError: (error) => {
        const networkErrors = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'];
        return networkErrors.some(code => error.message.includes(code) || error.code === code);
    },
    /** Retry only on specific errors */
    onErrorCodes: (codes) => (error) => {
        return codes.some(code => error.message.includes(code) || error.code === code);
    },
    /** Retry except on specific errors */
    exceptErrorCodes: (codes) => (error) => {
        return !codes.some(code => error.message.includes(code) || error.code === code);
    },
    /** Retry on HTTP 5xx errors or timeout */
    onServerError: (error) => {
        const message = error.message.toLowerCase();
        return (message.includes('500') ||
            message.includes('502') ||
            message.includes('503') ||
            message.includes('504') ||
            message.includes('timeout'));
    },
    /** Combine multiple predicates with OR */
    or: (...predicates) => (error, attempt) => {
        return predicates.some(p => p(error, attempt));
    },
    /** Combine multiple predicates with AND */
    and: (...predicates) => (error, attempt) => {
        return predicates.every(p => p(error, attempt));
    }
};
/**
 * Pre-defined retry configurations
 */
export const retryConfigs = {
    /** Aggressive retry (many attempts, short delays) */
    aggressive: {
        maxAttempts: 10,
        baseDelay: 100,
        maxDelay: 5000,
        backoffStrategy: 'exponential',
        jitter: 0.2
    },
    /** Conservative retry (few attempts, long delays) */
    conservative: {
        maxAttempts: 3,
        baseDelay: 2000,
        maxDelay: 60000,
        backoffStrategy: 'exponential',
        jitter: 0.1
    },
    /** Fast retry (for short operations) */
    fast: {
        maxAttempts: 5,
        baseDelay: 50,
        maxDelay: 1000,
        backoffStrategy: 'linear',
        jitter: 0.05
    },
    /** Retry for network operations */
    network: {
        maxAttempts: 5,
        baseDelay: 1000,
        maxDelay: 30000,
        backoffStrategy: 'exponential',
        jitter: 0.1,
        shouldRetry: retryPredicates.onNetworkError
    },
    /**
     * RSocket-style retry with stepped delays
     * Uses fixed delay array: 1s, 2s, 5s, 10s, 20s (with ±15% jitter)
     *
     * NOTE: Values are hardcoded instead of referencing RETRY_BACKOFF_DELAYS /
     * RETRY_JITTER_FACTOR to avoid ESM TDZ ("Cannot access before initialization")
     * issues. Keep in sync with the constants above (lines 25, 31).
     */
    rsocket: {
        maxAttempts: 5, // = RETRY_BACKOFF_DELAYS.length
        baseDelay: 1000, // = RETRY_BACKOFF_DELAYS[0]
        maxDelay: 20000, // = RETRY_BACKOFF_DELAYS[4]
        backoffStrategy: 'stepped',
        jitter: 0.15 // = RETRY_JITTER_FACTOR
    }
};
/**
 * Get retry delay with jitter applied
 * Uses RETRY_BACKOFF_DELAYS and RETRY_JITTER_FACTOR defined locally
 *
 * @param attempt - Current attempt number (1-based)
 * @returns Delay in ms with jitter applied
 */
export function getRetryDelayWithJitter(attempt) {
    const index = Math.min(Math.max(attempt - 1, 0), RETRY_BACKOFF_DELAYS.length - 1);
    const baseDelay = RETRY_BACKOFF_DELAYS[index] ?? RETRY_BACKOFF_DELAYS[0] ?? 1000;
    const jitterRange = baseDelay * RETRY_JITTER_FACTOR;
    const jitter = (Math.random() * 2 - 1) * jitterRange; // ±15%
    return Math.round(baseDelay + jitter);
}
/**
 * Get all retry delays with jitter for planning
 * @returns Array of delays with jitter applied
 */
export function getAllRetryDelaysWithJitter() {
    return RETRY_BACKOFF_DELAYS.map((_, i) => getRetryDelayWithJitter(i + 1));
}
export default retry;
//# sourceMappingURL=retry-utils.js.map