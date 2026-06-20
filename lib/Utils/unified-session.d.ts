/**
 * Unified Session Telemetry Implementation
 *
 * This module implements WhatsApp's unified_session telemetry feature to reduce
 * detection of unofficial clients. The implementation is inspired by:
 * - whatsmeow PR #1057 (Go implementation)
 * - Baileys PR #2294 (TypeScript implementation)
 *
 * The unified_session is a time-based identifier that mimics the behavior of
 * official WhatsApp Web clients, potentially reducing account restriction warnings.
 *
 * @module Utils/unified-session
 * @see https://github.com/tulir/whatsmeow/pull/1057
 * @see https://github.com/WhiskeySockets/Baileys/pull/2294
 */
import type { BinaryNode } from '../WABinary/types.js';
import type { ILogger } from './logger.js';
/**
 * Unified Session Manager options
 */
export interface UnifiedSessionOptions {
    /** Whether unified session telemetry is enabled */
    enabled?: boolean;
    /** Logger instance for debugging */
    logger?: ILogger;
    /** Function to send binary nodes to WhatsApp */
    sendNode?: (node: BinaryNode) => Promise<void>;
}
/**
 * Unified Session state
 */
export interface UnifiedSessionState {
    /** Server time offset in milliseconds (server time - local time) */
    serverTimeOffset: number;
    /** Last time unified_session was sent (Unix timestamp ms) */
    lastSentTime: number;
    /** Total number of unified_session messages sent */
    sendCount: number;
    /** Whether the session manager is initialized */
    isInitialized: boolean;
}
/**
 * Trigger types for unified session sending
 */
export type UnifiedSessionTrigger = 'login' | 'pairing' | 'presence' | 'manual';
/**
 * Unified Session Manager
 *
 * Manages the unified_session telemetry feature with:
 * - Server time synchronization
 * - Rate limiting (prevents spam)
 * - Prometheus metrics integration
 * - Structured logging
 *
 * @example
 * ```typescript
 * const sessionManager = new UnifiedSessionManager({
 *   enabled: true,
 *   logger: myLogger,
 *   sendNode: (node) => sock.sendNode(node)
 * })
 *
 * // Update server time offset when receiving server timestamp
 * sessionManager.updateServerTimeOffset(serverTimeAttr)
 *
 * // Send unified_session on login
 * await sessionManager.send('login')
 * ```
 */
export declare class UnifiedSessionManager {
    private state;
    private readonly options;
    /** Minimum interval between unified_session sends (1 minute) */
    private static readonly MIN_SEND_INTERVAL_MS;
    constructor(options?: UnifiedSessionOptions);
    /**
     * Update the server time offset from a received server timestamp.
     *
     * WhatsApp includes a 't' attribute in some nodes containing the server's
     * Unix timestamp (in seconds). We use this to calculate the offset between
     * server time and local time.
     *
     * @param serverTime - Server timestamp (seconds) from node.attrs.t
     */
    updateServerTimeOffset(serverTime: string | number | undefined): void;
    /**
     * Calculate the unified session ID.
     *
     * The algorithm matches WhatsApp Web's official implementation:
     * - Takes current time adjusted by server offset
     * - Adds 3-day offset
     * - Modulo 7 days (one week cycle)
     * - Returns as string
     *
     * @returns The unified session ID as a string
     */
    getSessionId(): string;
    /**
     * Check if enough time has passed since the last send.
     * Prevents spamming the server with unified_session messages.
     */
    private canSend;
    /**
     * Send the unified_session telemetry to WhatsApp.
     *
     * This should be called at specific trigger points:
     * - After successful login (CB:success)
     * - After successful pairing (CB:iq,,pair-success)
     * - When sending 'available' presence
     *
     * @param trigger - What triggered this send (for logging/metrics)
     * @returns Promise that resolves when sent, or void if skipped
     */
    send(trigger?: UnifiedSessionTrigger): Promise<void>;
    /**
     * Get the current state for debugging/monitoring.
     */
    getState(): Readonly<UnifiedSessionState>;
    /**
     * Reset the manager state (useful for testing or reconnection).
     */
    reset(): void;
    /**
     * Destroy the manager and clean up resources.
     */
    destroy(): void;
}
/**
 * Create a new UnifiedSessionManager instance.
 *
 * @param options - Configuration options
 * @returns A new UnifiedSessionManager instance
 *
 * @example
 * ```typescript
 * const sessionManager = createUnifiedSessionManager({
 *   enabled: config.enableUnifiedSession,
 *   logger: config.logger,
 *   sendNode: sock.sendNode
 * })
 * ```
 */
export declare function createUnifiedSessionManager(options?: UnifiedSessionOptions): UnifiedSessionManager;
/**
 * Extract server time from a binary node's attributes.
 * WhatsApp includes 't' attribute in various nodes.
 *
 * @param node - Binary node with potential time attribute
 * @returns Server time in seconds, or undefined if not present
 */
export declare function extractServerTime(node: BinaryNode): number | undefined;
/**
 * Check if unified_session should be enabled based on environment.
 * Can be controlled via environment variable for testing.
 *
 * @returns true if unified_session should be enabled
 */
export declare function shouldEnableUnifiedSession(): boolean;
export default UnifiedSessionManager;
//# sourceMappingURL=unified-session.d.ts.map