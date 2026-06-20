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
import { metrics } from './prometheus-metrics.js';
/**
 * Numeric priority values
 */
const PRIORITY_VALUES = {
    critical: 0,
    high: 1,
    normal: 2,
    low: 3
};
/**
 * Event type to category mapping
 */
const EVENT_CATEGORY_MAP = {
    'connection.update': 'connection',
    'creds.update': 'auth',
    'messaging-history.set': 'sync',
    'chats.set': 'sync',
    'contacts.set': 'sync',
    'messages.upsert': 'message',
    'messages.update': 'message',
    'messages.delete': 'message',
    'messages.reaction': 'message',
    'message-receipt.update': 'message',
    'groups.upsert': 'group',
    'groups.update': 'group',
    'group-participants.update': 'group',
    'presence.update': 'presence',
    'chats.update': 'message',
    'chats.delete': 'message',
    call: 'call',
    'blocklist.set': 'sync',
    'blocklist.update': 'sync'
};
/**
 * Default priority by event type
 */
const EVENT_PRIORITY_MAP = {
    'connection.update': 'critical',
    'creds.update': 'critical',
    'messages.upsert': 'high',
    'messages.update': 'high',
    call: 'high',
    'presence.update': 'low',
    'messaging-history.set': 'normal'
};
/**
 * Generate unique event ID
 */
function generateEventId() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
/**
 * Main Event Stream class
 */
export class BaileysEventStream extends EventEmitter {
    constructor(options = {}) {
        super();
        this.buffer = [];
        this.handlers = new Map();
        this.filters = [];
        this.transformers = [];
        this.deadLetterQueue = [];
        this.isProcessing = false;
        this.paused = false;
        this.options = {
            maxBufferSize: options.maxBufferSize ?? 10000,
            enableBackpressure: options.enableBackpressure ?? true,
            highWaterMark: options.highWaterMark ?? 8000,
            lowWaterMark: options.lowWaterMark ?? 2000,
            batchSize: options.batchSize ?? 100,
            flushInterval: options.flushInterval ?? 0,
            maxRetries: options.maxRetries ?? 3,
            deadLetterQueueSize: options.deadLetterQueueSize ?? 1000,
            collectMetrics: options.collectMetrics ?? true,
            streamName: options.streamName ?? 'baileys'
        };
        this.stats = this.createInitialStats();
        // Start periodic flush if configured
        if (this.options.flushInterval > 0) {
            this.flushTimer = setInterval(() => this.flush(), this.options.flushInterval);
        }
    }
    createInitialStats() {
        return {
            bufferSize: 0,
            totalReceived: 0,
            totalProcessed: 0,
            totalFailed: 0,
            totalDropped: 0,
            deadLetterQueueSize: 0,
            isBackpressured: false,
            eventsByType: {},
            eventsByPriority: {
                critical: 0,
                high: 0,
                normal: 0,
                low: 0
            }
        };
    }
    /**
     * Add event to stream
     */
    push(type, data, options) {
        // Check backpressure
        if (this.options.enableBackpressure && this.buffer.length >= this.options.highWaterMark) {
            this.stats.isBackpressured = true;
            this.emit('backpressure', { bufferSize: this.buffer.length });
            if (this.buffer.length >= this.options.maxBufferSize) {
                this.stats.totalDropped++;
                this.emit('dropped', { type, reason: 'buffer_full' });
                if (this.options.collectMetrics) {
                    metrics.errors.inc({ category: 'event_stream', code: 'dropped' });
                }
                return false;
            }
        }
        const event = {
            id: generateEventId(),
            type,
            data,
            timestamp: Date.now(),
            priority: options?.priority || EVENT_PRIORITY_MAP[type] || 'normal',
            category: EVENT_CATEGORY_MAP[type] || 'unknown',
            metadata: options?.metadata,
            retryCount: 0
        };
        // Apply transformers
        let transformedEvent = event;
        for (const transformer of this.transformers) {
            transformedEvent = transformer(transformedEvent);
        }
        // Apply filters
        for (const filter of this.filters) {
            if (!filter(transformedEvent)) {
                return false;
            }
        }
        // Add to buffer at correct position (by priority)
        this.insertByPriority(transformedEvent);
        // Update statistics
        this.stats.totalReceived++;
        this.stats.bufferSize = this.buffer.length;
        this.stats.lastEventTimestamp = Date.now();
        this.stats.eventsByType[type] = (this.stats.eventsByType[type] || 0) + 1;
        this.stats.eventsByPriority[event.priority]++;
        if (this.options.collectMetrics) {
            metrics.socketEvents.inc({ event: type });
        }
        this.emit('event', transformedEvent);
        // Process if not paused
        if (!this.paused && !this.isProcessing) {
            void this.processNext();
        }
        return true;
    }
    /**
     * Insert event in buffer by priority
     */
    insertByPriority(event) {
        const eventPriorityValue = PRIORITY_VALUES[event.priority];
        // Find correct position
        let insertIndex = this.buffer.length;
        for (let i = 0; i < this.buffer.length; i++) {
            const bufferEvent = this.buffer[i];
            if (bufferEvent && PRIORITY_VALUES[bufferEvent.priority] > eventPriorityValue) {
                insertIndex = i;
                break;
            }
        }
        this.buffer.splice(insertIndex, 0, event);
    }
    /**
     * Register handler for event type
     */
    on(event, handler) {
        // For control events (backpressure, drain, etc), use native EventEmitter
        if (event === 'backpressure' ||
            event === 'drain' ||
            event === 'dropped' ||
            event === 'batch-processed' ||
            event === 'retry') {
            super.on(event, handler);
            return this;
        }
        // For Baileys events, use custom handler system
        if (!this.handlers.has(event)) {
            this.handlers.set(event, new Set());
        }
        this.handlers.get(event).add(handler);
        return this;
    }
    /**
     * Remove handler
     */
    off(event, handler) {
        // For control events, use native EventEmitter
        if (event === 'backpressure' ||
            event === 'drain' ||
            event === 'dropped' ||
            event === 'batch-processed' ||
            event === 'retry') {
            super.off(event, handler);
            return this;
        }
        // For Baileys events, use custom handler system
        const handlers = this.handlers.get(event);
        if (handlers) {
            handlers.delete(handler);
        }
        return this;
    }
    /**
     * Register single-use handler
     */
    once(event, handler) {
        const wrappedHandler = e => {
            this.off(event, wrappedHandler);
            return handler(e);
        };
        return this.on(event, wrappedHandler);
    }
    /**
     * Add filter
     */
    addFilter(filter) {
        this.filters.push(filter);
        return this;
    }
    /**
     * Remove filter
     */
    removeFilter(filter) {
        const index = this.filters.indexOf(filter);
        if (index !== -1) {
            this.filters.splice(index, 1);
        }
        return this;
    }
    /**
     * Add transformer
     */
    addTransformer(transformer) {
        this.transformers.push(transformer);
        return this;
    }
    /**
     * Process next events
     */
    async processNext() {
        if (this.isProcessing || this.paused || this.buffer.length === 0) {
            return;
        }
        this.isProcessing = true;
        try {
            // Get batch of events
            const batch = this.buffer.splice(0, this.options.batchSize);
            this.stats.bufferSize = this.buffer.length;
            // Check if exited backpressure
            if (this.stats.isBackpressured && this.buffer.length <= this.options.lowWaterMark) {
                this.stats.isBackpressured = false;
                this.emit('drain');
            }
            // Process batch
            const startTime = Date.now();
            let processed = 0;
            let failed = 0;
            for (const event of batch) {
                try {
                    await this.processEvent(event);
                    processed++;
                    this.stats.totalProcessed++;
                }
                catch (error) {
                    failed++;
                    this.stats.totalFailed++;
                    await this.handleFailedEvent(event, error);
                }
            }
            const duration = Date.now() - startTime;
            this.emit('batch-processed', { processed, failed, duration });
            // Continue processing if there are more
            if (this.buffer.length > 0) {
                setImmediate(() => this.processNext());
            }
        }
        finally {
            this.isProcessing = false;
        }
    }
    /**
     * Process a single event
     */
    async processEvent(event) {
        // Type-specific handlers
        const typeHandlers = this.handlers.get(event.type);
        if (typeHandlers) {
            for (const handler of typeHandlers) {
                await handler(event);
            }
        }
        // Global handlers
        const globalHandlers = this.handlers.get('*');
        if (globalHandlers) {
            for (const handler of globalHandlers) {
                await handler(event);
            }
        }
    }
    /**
     * Handle failed event
     */
    async handleFailedEvent(event, error) {
        event.retryCount = (event.retryCount || 0) + 1;
        if (event.retryCount <= this.options.maxRetries) {
            // Re-add to buffer for retry
            event.originalTimestamp = event.originalTimestamp || event.timestamp;
            event.timestamp = Date.now();
            this.buffer.push(event);
            this.stats.bufferSize = this.buffer.length;
            this.emit('retry', { event, error, attempt: event.retryCount });
        }
        else {
            // Send to dead letter queue
            this.addToDeadLetterQueue(event, error);
        }
        if (this.options.collectMetrics) {
            metrics.errors.inc({ category: 'event_stream', code: 'processing_failed' });
        }
    }
    /**
     * Add event to dead letter queue
     */
    addToDeadLetterQueue(event, error) {
        const dlqEvent = {
            ...event,
            metadata: {
                ...event.metadata,
                error: error.message,
                errorStack: error.stack,
                movedToDlqAt: Date.now()
            }
        };
        this.deadLetterQueue.push(dlqEvent);
        // Limit DLQ size
        while (this.deadLetterQueue.length > this.options.deadLetterQueueSize) {
            this.deadLetterQueue.shift();
        }
        this.stats.deadLetterQueueSize = this.deadLetterQueue.length;
        this.emit('dead-letter', dlqEvent);
    }
    /**
     * Force flush the buffer
     */
    async flush() {
        const startTime = Date.now();
        let processed = 0;
        let failed = 0;
        while (this.buffer.length > 0 && !this.paused) {
            const batch = this.buffer.splice(0, this.options.batchSize);
            for (const event of batch) {
                try {
                    await this.processEvent(event);
                    processed++;
                    this.stats.totalProcessed++;
                }
                catch (error) {
                    failed++;
                    this.stats.totalFailed++;
                    await this.handleFailedEvent(event, error);
                }
            }
        }
        this.stats.bufferSize = this.buffer.length;
        return {
            processed,
            failed,
            duration: Date.now() - startTime
        };
    }
    /**
     * Pause processing
     */
    pause() {
        this.paused = true;
        this.emit('pause');
    }
    /**
     * Resume processing
     */
    resume() {
        this.paused = false;
        this.emit('resume');
        void this.processNext();
    }
    /**
     * Check if paused
     */
    isPaused() {
        return this.paused;
    }
    /**
     * Clear the buffer
     */
    clear() {
        this.buffer = [];
        this.stats.bufferSize = 0;
        this.emit('clear');
    }
    /**
     * Return dead letter queue events
     */
    getDeadLetterQueue() {
        return [...this.deadLetterQueue];
    }
    /**
     * Clear dead letter queue
     */
    clearDeadLetterQueue() {
        this.deadLetterQueue = [];
        this.stats.deadLetterQueueSize = 0;
    }
    /**
     * Replay dead letter queue events
     */
    async replayDeadLetterQueue() {
        const events = this.deadLetterQueue.splice(0);
        this.stats.deadLetterQueueSize = 0;
        let processed = 0;
        let failed = 0;
        const startTime = Date.now();
        for (const event of events) {
            // Reset retry count
            event.retryCount = 0;
            delete event.metadata?.error;
            delete event.metadata?.errorStack;
            delete event.metadata?.movedToDlqAt;
            try {
                await this.processEvent(event);
                processed++;
            }
            catch (error) {
                failed++;
                this.addToDeadLetterQueue(event, error);
            }
        }
        return {
            processed,
            failed,
            duration: Date.now() - startTime
        };
    }
    /**
     * Return statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = this.createInitialStats();
        this.stats.bufferSize = this.buffer.length;
        this.stats.deadLetterQueueSize = this.deadLetterQueue.length;
    }
    /**
     * Destroy and clean up resources
     */
    destroy() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        this.buffer = [];
        this.deadLetterQueue = [];
        this.handlers.clear();
        this.filters = [];
        this.transformers = [];
        this.removeAllListeners();
    }
}
/**
 * Factory to create event stream
 */
export function createEventStream(options) {
    return new BaileysEventStream(options);
}
/**
 * Pre-defined filters
 */
export const eventFilters = {
    /** Filter by event type */
    byType: (...types) => event => types.includes(event.type),
    /** Filter by category */
    byCategory: (...categories) => event => categories.includes(event.category),
    /** Filter by minimum priority */
    byMinPriority: (minPriority) => event => PRIORITY_VALUES[event.priority] <= PRIORITY_VALUES[minPriority],
    /** Filter recent events (within ms) */
    recentOnly: (maxAgeMs) => event => Date.now() - event.timestamp <= maxAgeMs,
    /** Combine filters with AND */
    and: (...filters) => event => filters.every(f => f(event)),
    /** Combine filters with OR */
    or: (...filters) => event => filters.some(f => f(event))
};
/**
 * Pre-defined transformers
 */
export const eventTransformers = {
    /** Add processing timestamp */
    addProcessingTimestamp: () => event => ({
        ...event,
        metadata: {
            ...event.metadata,
            processingTimestamp: Date.now()
        }
    }),
    /** Add trace ID */
    addTraceId: (traceIdGenerator) => event => ({
        ...event,
        metadata: {
            ...event.metadata,
            traceId: traceIdGenerator()
        }
    }),
    /** Elevate priority based on condition */
    elevatepriorityIf: (condition, newPriority) => event => condition(event) ? { ...event, priority: newPriority } : event
};
export default BaileysEventStream;
//# sourceMappingURL=baileys-event-stream.js.map