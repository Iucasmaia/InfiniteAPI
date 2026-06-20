/**
 * Custom Logger for Baileys/WhatsApp
 *
 * Provides:
 * - Pre-configured logger for Baileys/WhatsApp context
 * - Event categorization by type (connection, message, media, etc.)
 * - Specific filters to reduce noise
 * - WhatsApp event metrics
 * - Optimized formatting for debugging
 *
 * @module Utils/baileys-logger
 */
import type { ILogger } from './logger.js';
import { type LogEntry, type LogLevel } from './structured-logger.js';
/**
 * Baileys-specific log categories
 */
export type BaileysLogCategory = 'connection' | 'auth' | 'message' | 'media' | 'group' | 'presence' | 'call' | 'sync' | 'encryption' | 'retry' | 'socket' | 'binary' | 'unknown';
/**
 * Baileys Logger configuration
 */
export interface BaileysLoggerConfig {
    /** Default log level */
    level: LogLevel;
    /** Categories to ignore */
    ignoredCategories?: BaileysLogCategory[];
    /** Categories with elevated log level (always debug) */
    verboseCategories?: BaileysLogCategory[];
    /** Whether to log message payloads (may be sensitive) */
    logMessagePayloads?: boolean;
    /** Whether to log binary data in hex */
    logBinaryData?: boolean;
    /** Instance identifier prefix */
    instanceId?: string;
    /** Handler for specific events */
    eventHandler?: (category: BaileysLogCategory, entry: LogEntry) => void;
    /** Size limit for logged payloads (bytes) */
    maxPayloadSize?: number;
}
/**
 * Baileys-specific metrics
 */
export interface BaileysLoggerMetrics {
    connectionAttempts: number;
    connectionSuccesses: number;
    connectionFailures: number;
    messagesSent: number;
    messagesReceived: number;
    mediaUploads: number;
    mediaDownloads: number;
    retryAttempts: number;
    encryptionOperations: number;
    errorsByCategory: Record<BaileysLogCategory, number>;
    lastConnectionTime?: string;
    lastMessageTime?: string;
}
/**
 * Custom logger for Baileys
 *
 * @example
 * ```typescript
 * const logger = createBaileysLogger({
 *   level: 'debug',
 *   instanceId: 'session-1'
 * })
 *
 * logger.logConnection('connected', { duration: 1500 })
 * logger.logMessage('send', 'text', 'user@s.whatsapp.net')
 * ```
 */
export declare class BaileysLogger implements ILogger {
    private structuredLogger;
    private config;
    private metrics;
    private childContext;
    constructor(config?: Partial<BaileysLoggerConfig>);
    private generateInstanceId;
    private createInitialMetrics;
    get level(): string;
    set level(newLevel: string);
    /**
     * Create child logger with additional context
     */
    child(obj: Record<string, unknown>): BaileysLogger;
    /**
     * Detect log category based on content
     */
    private detectCategory;
    /**
     * Check if category should be logged
     */
    private shouldLogCategory;
    /**
     * Sanitize message payload
     */
    private sanitizePayload;
    /**
     * Update metrics based on log
     */
    private updateMetrics;
    /**
     * Main log method
     */
    private log;
    trace(obj: unknown, msg?: string): void;
    debug(obj: unknown, msg?: string): void;
    info(obj: unknown, msg?: string): void;
    warn(obj: unknown, msg?: string): void;
    error(obj: unknown, msg?: string): void;
    /**
     * Log connection-specific event
     */
    logConnection(event: 'connecting' | 'connected' | 'disconnected' | 'error', details?: Record<string, unknown>): void;
    /**
     * Log message-specific event
     */
    logMessage(direction: 'send' | 'receive', messageType: string, jid: string, details?: Record<string, unknown>): void;
    /**
     * Log media-specific event
     */
    logMedia(operation: 'upload' | 'download', mediaType: string, size: number, details?: Record<string, unknown>): void;
    /**
     * Sanitize JID for logging (mask part of number)
     */
    private sanitizeJid;
    /**
     * Format bytes for human readability
     */
    private formatBytes;
    /**
     * Get logger metrics
     */
    getMetrics(): BaileysLoggerMetrics;
    /**
     * Get internal structured logger metrics
     */
    getStructuredMetrics(): import("./structured-logger.js").LoggerMetrics;
    /**
     * Reset metrics
     */
    resetMetrics(): void;
    /**
     * Get instance ID
     */
    getInstanceId(): string;
}
/**
 * Factory to create Baileys Logger
 */
export declare function createBaileysLogger(config?: Partial<BaileysLoggerConfig>): BaileysLogger;
export declare function getDefaultBaileysLogger(): BaileysLogger;
export declare function setDefaultBaileysLogger(logger: BaileysLogger): void;
/**
 * Event buffer logging types
 */
export type EventBufferLogType = 'buffer_start' | 'buffer_flush' | 'buffer_overflow' | 'buffer_timeout' | 'cache_cleanup' | 'adaptive_mode';
/**
 * Log event buffer operations with emoji and [BAILEYS] prefix
 *
 * @example
 * logEventBuffer('buffer_start')
 * // Output: [BAILEYS] 📦 Event buffering started
 *
 * logEventBuffer('buffer_flush', { flushCount: 10, historyCacheSize: 5, mode: 'aggressive' })
 * // Output: [BAILEYS] 🔄 Event buffer flushed { flushCount: 10, historyCacheSize: 5, mode: 'aggressive' }
 */
export declare function logEventBuffer(type: EventBufferLogType, data?: Record<string, unknown>, sessionName?: string): void;
/**
 * Log buffer metrics in a formatted way
 *
 * @example
 * logBufferMetrics({
 *   itemsBuffered: 0,
 *   flushCount: 120,
 *   historyCacheSize: 0,
 *   buffersInProgress: 0,
 *   adaptive: { mode: 'aggressive', timeout: 1000, eventRate: 1.34, isHealthy: true }
 * })
 */
export declare function logBufferMetrics(metrics: {
    itemsBuffered: number;
    flushCount: number;
    historyCacheSize: number;
    buffersInProgress: number;
    adaptive?: {
        mode: string;
        timeout: number;
        eventRate: number;
        isHealthy: boolean;
    };
}, sessionName?: string): void;
/**
 * Log message sent event
 *
 * @example
 * logMessageSent('3EB02FA562D6CCC0876CDE', '5511999999999@s.whatsapp.net')
 * // Output: [BAILEYS] 📤 Message sent: 3EB02FA562D6CCC0876CDE → 5511999999999@s.whatsapp.net
 */
export declare function logMessageSent(messageId: string, recipientJid: string, sessionName?: string): void;
/**
 * Log message received event
 *
 * @example
 * logMessageReceived('A5E0349897A3F16F3F2778EEF94A065F', '238315571802285@lid')
 * // Output: [BAILEYS] 📥 Message received: A5E0349897A3F16F3F2778EEF94A065F ← 238315571802285@lid
 */
export declare function logMessageReceived(messageId: string, senderJid: string, sessionName?: string): void;
/**
 * Log connection event
 *
 * @example
 * logConnection('connecting')
 * // Output: [BAILEYS] 🔌 Connecting to WhatsApp...
 *
 * logConnection('open')
 * // Output: [BAILEYS] ✅ Connected to WhatsApp
 */
export declare function logConnection(event: 'connecting' | 'open' | 'close' | 'reconnecting' | 'error', details?: Record<string, unknown>, sessionName?: string): void;
/**
 * Log authentication event
 *
 * @example
 * logAuth('qr_generated')
 * // Output: [BAILEYS] 📱 QR Code generated - scan with WhatsApp
 */
export declare function logAuth(event: 'qr_generated' | 'pairing_code' | 'authenticated' | 'logout' | 'creds_updated', details?: Record<string, unknown>, sessionName?: string): void;
/**
 * Log retry event
 *
 * @example
 * logRetry(2, 3, 5000, 'connection')
 * // Output: [BAILEYS] 🔁 Retry attempt 2/3 for connection (delay: 5000ms)
 */
export declare function logRetry(attempt: number, maxAttempts: number, delayMs: number, operation: string, sessionName?: string): void;
/**
 * Log generic Baileys info message
 *
 * @example
 * logInfo('PreKey validation passed')
 * // Output: [BAILEYS] ℹ️ PreKey validation passed
 */
export declare function logInfo(message: string, data?: Record<string, unknown>, sessionName?: string): void;
/**
 * Log generic Baileys warning message
 *
 * @example
 * logWarn('Rate limit approaching')
 * // Output: [BAILEYS] ⚠️ Rate limit approaching
 */
export declare function logWarn(message: string, data?: Record<string, unknown>, sessionName?: string): void;
/**
 * Log generic Baileys error message
 *
 * @example
 * logError('Failed to send message', { error: 'timeout' })
 * // Output: [BAILEYS] ❌ Failed to send message { error: 'timeout' }
 */
export declare function logError(message: string, data?: Record<string, unknown>, sessionName?: string): void;
/**
 * Log LID mapping store event
 */
export declare function logLidMapping(event: 'initialized' | 'lookup' | 'store' | 'batch_resolved', data?: Record<string, unknown>, sessionName?: string): void;
/**
 * Log tctoken lifecycle events
 *
 * @example
 * logTcToken('fetch', { jid: '5511999999999@s.whatsapp.net' })
 * // Output: [BAILEYS] 🔑 TcToken fetch → 5511999999999@s.whatsapp.net
 *
 * logTcToken('expired', { jid: '5511999999999@s.whatsapp.net', age: '32d' })
 * // Output: [BAILEYS] 🔑 TcToken expired → 5511999999999@s.whatsapp.net { age: 32d }
 */
export declare function logTcToken(event: 'stored' | 'expired' | 'fetch' | 'fetched' | 'reissue' | 'reissue_ok' | 'reissue_fail' | 'prune' | 'error_463' | 'error_479' | 'attached' | 'retry_463_ok', data?: Record<string, unknown>, sessionName?: string): void;
export default BaileysLogger;
//# sourceMappingURL=baileys-logger.d.ts.map