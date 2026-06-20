/**
 * Baileys Event Stream Management
 *
 * Provides:
 * - Event buffering with backpressure
 * - Event transformation and filtering
 * - Priority queues for events
 * - Batch processing
 * - Dead letter queue for failed events
 * - Event replay
 * - Logging and metrics integration
 *
 * @module Utils/baileys-event-stream
 */
import { EventEmitter } from 'events';
import type { BaileysLogCategory } from './baileys-logger.js';
/**
 * Baileys event types
 */
export type BaileysEventType = 'connection.update' | 'creds.update' | 'messaging-history.set' | 'chats.set' | 'contacts.set' | 'messages.upsert' | 'messages.update' | 'messages.delete' | 'messages.reaction' | 'message-receipt.update' | 'groups.upsert' | 'groups.update' | 'group-participants.update' | 'presence.update' | 'chats.update' | 'chats.delete' | 'labels.edit' | 'labels.association' | 'call' | 'blocklist.set' | 'blocklist.update' | string;
/**
 * Event priority
 */
export type EventPriority = 'critical' | 'high' | 'normal' | 'low';
/**
 * Stream event
 */
export interface StreamEvent<T = unknown> {
    id: string;
    type: BaileysEventType;
    data: T;
    timestamp: number;
    priority: EventPriority;
    category: BaileysLogCategory;
    metadata?: Record<string, unknown>;
    retryCount?: number;
    originalTimestamp?: number;
}
/**
 * Event Stream options
 */
export interface EventStreamOptions {
    /** Maximum buffer size (default: 10000) */
    maxBufferSize?: number;
    /** Whether to apply backpressure when buffer is full */
    enableBackpressure?: boolean;
    /** High water mark limit for backpressure */
    highWaterMark?: number;
    /** Low water mark limit to resume */
    lowWaterMark?: number;
    /** Batch size for processing */
    batchSize?: number;
    /** Flush interval in ms (0 = disabled) */
    flushInterval?: number;
    /** Maximum retries for failed events */
    maxRetries?: number;
    /** Dead letter queue size */
    deadLetterQueueSize?: number;
    /** Whether to collect metrics */
    collectMetrics?: boolean;
    /** Stream name for metrics */
    streamName?: string;
}
/**
 * Event handler
 */
export type EventHandler<T = unknown> = (event: StreamEvent<T>) => void | Promise<void>;
/**
 * Event filter
 */
export type EventFilter<T = unknown> = (event: StreamEvent<T>) => boolean;
/**
 * Event transformer
 */
export type EventTransformer<T = unknown, R = unknown> = (event: StreamEvent<T>) => StreamEvent<R>;
/**
 * Batch processing result
 */
export interface BatchResult {
    processed: number;
    failed: number;
    duration: number;
}
/**
 * Stream statistics
 */
export interface EventStreamStats {
    bufferSize: number;
    totalReceived: number;
    totalProcessed: number;
    totalFailed: number;
    totalDropped: number;
    deadLetterQueueSize: number;
    isBackpressured: boolean;
    lastEventTimestamp?: number;
    eventsByType: Record<string, number>;
    eventsByPriority: Record<EventPriority, number>;
}
/**
 * Main Event Stream class
 */
export declare class BaileysEventStream extends EventEmitter {
    private buffer;
    private handlers;
    private filters;
    private transformers;
    private deadLetterQueue;
    private options;
    private stats;
    private isProcessing;
    private flushTimer?;
    private paused;
    constructor(options?: EventStreamOptions);
    private createInitialStats;
    /**
     * Add event to stream
     */
    push<T>(type: BaileysEventType, data: T, options?: {
        priority?: EventPriority;
        metadata?: Record<string, unknown>;
    }): boolean;
    /**
     * Insert event in buffer by priority
     */
    private insertByPriority;
    /**
     * Register handler for event type
     */
    on<T = unknown>(event: BaileysEventType | '*' | 'backpressure' | 'drain' | 'dropped' | 'batch-processed' | 'retry', handler: EventHandler<T>): this;
    /**
     * Remove handler
     */
    off(event: BaileysEventType | '*' | 'backpressure' | 'drain' | 'dropped' | 'batch-processed' | 'retry', handler: EventHandler): this;
    /**
     * Register single-use handler
     */
    once<T = unknown>(event: BaileysEventType, handler: EventHandler<T>): this;
    /**
     * Add filter
     */
    addFilter(filter: EventFilter): this;
    /**
     * Remove filter
     */
    removeFilter(filter: EventFilter): this;
    /**
     * Add transformer
     */
    addTransformer(transformer: EventTransformer): this;
    /**
     * Process next events
     */
    private processNext;
    /**
     * Process a single event
     */
    private processEvent;
    /**
     * Handle failed event
     */
    private handleFailedEvent;
    /**
     * Add event to dead letter queue
     */
    private addToDeadLetterQueue;
    /**
     * Force flush the buffer
     */
    flush(): Promise<BatchResult>;
    /**
     * Pause processing
     */
    pause(): void;
    /**
     * Resume processing
     */
    resume(): void;
    /**
     * Check if paused
     */
    isPaused(): boolean;
    /**
     * Clear the buffer
     */
    clear(): void;
    /**
     * Return dead letter queue events
     */
    getDeadLetterQueue(): StreamEvent[];
    /**
     * Clear dead letter queue
     */
    clearDeadLetterQueue(): void;
    /**
     * Replay dead letter queue events
     */
    replayDeadLetterQueue(): Promise<BatchResult>;
    /**
     * Return statistics
     */
    getStats(): EventStreamStats;
    /**
     * Reset statistics
     */
    resetStats(): void;
    /**
     * Destroy and clean up resources
     */
    destroy(): void;
}
/**
 * Factory to create event stream
 */
export declare function createEventStream(options?: EventStreamOptions): BaileysEventStream;
/**
 * Pre-defined filters
 */
export declare const eventFilters: {
    /** Filter by event type */
    byType: (...types: BaileysEventType[]) => EventFilter;
    /** Filter by category */
    byCategory: (...categories: BaileysLogCategory[]) => EventFilter;
    /** Filter by minimum priority */
    byMinPriority: (minPriority: EventPriority) => EventFilter;
    /** Filter recent events (within ms) */
    recentOnly: (maxAgeMs: number) => EventFilter;
    /** Combine filters with AND */
    and: (...filters: EventFilter[]) => EventFilter;
    /** Combine filters with OR */
    or: (...filters: EventFilter[]) => EventFilter;
};
/**
 * Pre-defined transformers
 */
export declare const eventTransformers: {
    /** Add processing timestamp */
    addProcessingTimestamp: () => EventTransformer;
    /** Add trace ID */
    addTraceId: (traceIdGenerator: () => string) => EventTransformer;
    /** Elevate priority based on condition */
    elevatepriorityIf: (condition: (event: StreamEvent) => boolean, newPriority: EventPriority) => EventTransformer;
};
export default BaileysEventStream;
//# sourceMappingURL=baileys-event-stream.d.ts.map