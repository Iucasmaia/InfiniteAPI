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
/**
 * Retry configuration with custom progressive backoff
 * Fixed delay steps in milliseconds: 1s → 2s → 5s → 10s → 20s
 * Exported for external use (e.g., custom retry logic)
 */
export declare const RETRY_BACKOFF_DELAYS: readonly [1000, 2000, 5000, 10000, 20000];
/**
 * Jitter factor for retry delays (0.15 = ±15% randomization)
 * Helps prevent thundering herd problem
 */
export declare const RETRY_JITTER_FACTOR: 0.15;
/**
 * Backoff strategies
 */
export type BackoffStrategy = 'exponential' | 'linear' | 'constant' | 'fibonacci' | 'stepped';
/**
 * Retry configuration options
 */
export interface RetryOptions {
    /** Maximum number of attempts (default: 3) */
    maxAttempts?: number;
    /** Base delay in ms (default: 1000) */
    baseDelay?: number;
    /** Maximum delay in ms (default: 30000) */
    maxDelay?: number;
    /** Backoff strategy (default: exponential) */
    backoffStrategy?: BackoffStrategy;
    /** Multiplier for exponential backoff (default: 2) */
    backoffMultiplier?: number;
    /** Jitter percentage (0-1, default: 0.1) */
    jitter?: number;
    /** Function to determine if should retry */
    shouldRetry?: (error: Error, attempt: number) => boolean | Promise<boolean>;
    /** Timeout per attempt in ms */
    timeout?: number;
    /** Operation name for metrics */
    operationName?: string;
    /** Collect metrics */
    collectMetrics?: boolean;
    /** Callback before each retry */
    onRetry?: (error: Error, attempt: number, delay: number) => void | Promise<void>;
    /** Callback on success */
    onSuccess?: (result: unknown, attempt: number) => void;
    /** Callback on final failure */
    onFailure?: (error: Error, attempts: number) => void;
    /** Signal for cancellation */
    abortSignal?: AbortSignal;
}
/**
 * Result of operation with retry
 */
export interface RetryResult<T> {
    success: boolean;
    result?: T;
    error?: Error;
    attempts: number;
    totalDuration: number;
    lastAttemptDuration: number;
}
/**
 * Retry context
 */
export interface RetryContext {
    attempt: number;
    maxAttempts: number;
    lastError?: Error;
    startTime: number;
    aborted: boolean;
}
/**
 * Retry exhausted error
 */
export declare class RetryExhaustedError extends Error {
    readonly originalError: Error;
    readonly attempts: number;
    readonly operationName?: string | undefined;
    constructor(originalError: Error, attempts: number, operationName?: string | undefined);
}
/**
 * Abort error
 */
export declare class RetryAbortedError extends Error {
    readonly attempt: number;
    constructor(attempt: number);
}
/**
 * Calculate delay based on strategy
 */
export declare function calculateDelay(attempt: number, baseDelay: number, maxDelay: number, strategy: BackoffStrategy, multiplier: number, jitter: number): number;
/**
 * Main retry function
 */
export declare function retry<T>(operation: (context: RetryContext) => T | Promise<T>, options?: RetryOptions): Promise<T>;
/**
 * Retry with detailed result
 */
export declare function retryWithResult<T>(operation: (context: RetryContext) => T | Promise<T>, options?: RetryOptions): Promise<RetryResult<T>>;
/**
 * Factory to create configured retry function
 */
export declare function createRetrier(defaultOptions?: RetryOptions): <T>(operation: (context: RetryContext) => T | Promise<T>, options?: RetryOptions) => Promise<T>;
/**
 * Decorator to add retry to method
 */
export declare function withRetry(options?: RetryOptions): (_target: unknown, propertyKey: string, descriptor: TypedPropertyDescriptor<(...args: unknown[]) => unknown>) => TypedPropertyDescriptor<(...args: unknown[]) => unknown>;
/**
 * Wrapper for function with retry
 */
export declare function retryable<T extends (...args: unknown[]) => unknown>(fn: T, options?: RetryOptions): (...args: Parameters<T>) => Promise<ReturnType<T>>;
/**
 * Class to manage retries with state
 */
export declare class RetryManager extends EventEmitter {
    private activeRetries;
    private defaultOptions;
    constructor(defaultOptions?: RetryOptions);
    /**
     * Execute operation with retry
     */
    execute<T>(id: string, operation: (context: RetryContext) => T | Promise<T>, options?: RetryOptions): Promise<T>;
    /**
     * Cancel in-progress retry
     */
    cancel(id: string): boolean;
    /**
     * Cancel all retries
     */
    cancelAll(): void;
    /**
     * Check if there is an active retry
     */
    isActive(id: string): boolean;
    /**
     * Return active retry context
     */
    getContext(id: string): RetryContext | undefined;
    /**
     * Return active retry IDs
     */
    getActiveIds(): string[];
}
/**
 * Common predicates for shouldRetry
 */
export declare const retryPredicates: {
    /** Always retry (up to max attempts) */
    always: () => boolean;
    /** Never retry */
    never: () => boolean;
    /** Retry only on network errors */
    onNetworkError: (error: Error) => boolean;
    /** Retry only on specific errors */
    onErrorCodes: (codes: string[]) => (error: Error) => boolean;
    /** Retry except on specific errors */
    exceptErrorCodes: (codes: string[]) => (error: Error) => boolean;
    /** Retry on HTTP 5xx errors or timeout */
    onServerError: (error: Error) => boolean;
    /** Combine multiple predicates with OR */
    or: (...predicates: Array<(error: Error, attempt: number) => boolean>) => (error: Error, attempt: number) => boolean;
    /** Combine multiple predicates with AND */
    and: (...predicates: Array<(error: Error, attempt: number) => boolean>) => (error: Error, attempt: number) => boolean;
};
/**
 * Pre-defined retry configurations
 */
export declare const retryConfigs: {
    /** Aggressive retry (many attempts, short delays) */
    aggressive: {
        maxAttempts: number;
        baseDelay: number;
        maxDelay: number;
        backoffStrategy: "exponential";
        jitter: number;
    };
    /** Conservative retry (few attempts, long delays) */
    conservative: {
        maxAttempts: number;
        baseDelay: number;
        maxDelay: number;
        backoffStrategy: "exponential";
        jitter: number;
    };
    /** Fast retry (for short operations) */
    fast: {
        maxAttempts: number;
        baseDelay: number;
        maxDelay: number;
        backoffStrategy: "linear";
        jitter: number;
    };
    /** Retry for network operations */
    network: {
        maxAttempts: number;
        baseDelay: number;
        maxDelay: number;
        backoffStrategy: "exponential";
        jitter: number;
        shouldRetry: (error: Error) => boolean;
    };
    /**
     * RSocket-style retry with stepped delays
     * Uses fixed delay array: 1s, 2s, 5s, 10s, 20s (with ±15% jitter)
     *
     * NOTE: Values are hardcoded instead of referencing RETRY_BACKOFF_DELAYS /
     * RETRY_JITTER_FACTOR to avoid ESM TDZ ("Cannot access before initialization")
     * issues. Keep in sync with the constants above (lines 25, 31).
     */
    rsocket: {
        maxAttempts: number;
        baseDelay: number;
        maxDelay: number;
        backoffStrategy: "stepped";
        jitter: number;
    };
};
/**
 * Get retry delay with jitter applied
 * Uses RETRY_BACKOFF_DELAYS and RETRY_JITTER_FACTOR defined locally
 *
 * @param attempt - Current attempt number (1-based)
 * @returns Delay in ms with jitter applied
 */
export declare function getRetryDelayWithJitter(attempt: number): number;
/**
 * Get all retry delays with jitter for planning
 * @returns Array of delays with jitter applied
 */
export declare function getAllRetryDelaysWithJitter(): number[];
export default retry;
//# sourceMappingURL=retry-utils.d.ts.map