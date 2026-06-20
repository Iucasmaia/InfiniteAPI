import type { proto } from '../../WAProto/index.js';
import type { ILogger } from './logger.js';
/**
 * Retry reason codes from WhatsApp protocol
 * These map to the error codes sent in retry receipts
 *
 * @see https://github.com/WhiskeySockets/Baileys/pull/2307
 */
export declare enum RetryReason {
    /** Unknown or unspecified error */
    UnknownError = 0,
    /** No Signal session exists for recipient */
    SignalErrorNoSession = 1,
    /** Invalid key format or corrupted key */
    SignalErrorInvalidKey = 2,
    /** Invalid pre-key ID (key not found) */
    SignalErrorInvalidKeyId = 3,
    /** Invalid message - MAC verification failed */
    SignalErrorInvalidMessage = 4,
    /** Invalid signature on message or key */
    SignalErrorInvalidSignature = 5,
    /** Message from the future (timestamp issue) */
    SignalErrorFutureMessage = 6,
    /** Explicit MAC verification failure */
    SignalErrorBadMac = 7,
    /** Session is corrupted or invalid state */
    SignalErrorInvalidSession = 8,
    /** Invalid message key (decryption key issue) */
    SignalErrorInvalidMsgKey = 9,
    /** Bad broadcast ephemeral setting */
    BadBroadcastEphemeralSetting = 10,
    /** Unknown companion device without pre-key */
    UnknownCompanionNoPrekey = 11,
    /** ADV (Announcement Delivery Verification) failure */
    AdvFailure = 12,
    /** Status revoke was delayed */
    StatusRevokeDelay = 13
}
/**
 * MAC error codes that indicate identity key mismatch
 * These errors occur when the sender's identity key has changed (e.g., reinstalled WhatsApp)
 * and require immediate session recreation without waiting for the normal timeout
 */
export declare const MAC_ERROR_CODES: Set<RetryReason>;
/**
 * Session-related error codes that may require session recreation
 */
export declare const SESSION_ERROR_CODES: Set<RetryReason>;
export interface RecentMessageKey {
    to: string;
    id: string;
}
export interface RecentMessage {
    message: proto.IMessage;
    timestamp: number;
}
export interface SessionRecreateHistory {
    [jid: string]: number;
}
export interface RetryCounter {
    [messageId: string]: number;
}
export type PendingPhoneRequest = Record<string, ReturnType<typeof setTimeout>>;
export interface RetryStatistics {
    totalRetries: number;
    successfulRetries: number;
    failedRetries: number;
    mediaRetries: number;
    sessionRecreations: number;
    phoneRequests: number;
}
export declare class MessageRetryManager {
    private logger;
    private recentMessagesMap;
    private messageKeyIndex;
    private sessionRecreateHistory;
    private retryCounters;
    /**
     * Tracks the open-session base key per `(addr, msgId)` for retry-collision
     * detection. WA Web saves the base key at retry==2 and, on retry>2, deletes
     * the local session if the stored base key is still in place (indicating
     * neither side has rotated). 15-min TTL matches the retryCounters lifetime.
     */
    private baseKeys;
    private pendingPhoneRequests;
    private readonly maxMsgRetryCount;
    private statistics;
    constructor(logger: ILogger, maxMsgRetryCount: number);
    /**
     * Add a recent message to the cache for retry handling
     */
    addRecentMessage(to: string, id: string, message: proto.IMessage): void;
    /**
     * Get a recent message from the cache.
     *
     * First attempts an exact `to+id` key lookup. If that misses — which happens when
     * the retry receipt arrives from a device-specific JID (e.g. `55123:82@s.whatsapp.net`)
     * while the message was stored under the normalised base JID (`55123@s.whatsapp.net`),
     * or when the JID domain flipped between LID and PN — falls back to the `messageKeyIndex`
     * which maps bare message IDs to stored keys regardless of the `to` format.
     */
    getRecentMessage(to: string, id: string): RecentMessage | undefined;
    /**
     * Check if a session should be recreated based on retry count, history, and error code
     *
     * @param jid - The JID of the recipient
     * @param hasSession - Whether a Signal session exists for this JID
     * @param errorCode - Optional error code from the retry receipt (indicates type of failure)
     * @returns Object with reason string and boolean indicating if session should be recreated
     */
    shouldRecreateSession(jid: string, hasSession: boolean, errorCode?: RetryReason): {
        reason: string;
        recreate: boolean;
    };
    /**
     * Parse error code from retry receipt attribute
     *
     * @param errorAttr - The error attribute string from the retry receipt
     * @returns Parsed RetryReason or undefined if invalid
     */
    parseRetryErrorCode(errorAttr: string | undefined): RetryReason | undefined;
    /**
     * Check if an error code indicates a MAC verification failure
     *
     * @param errorCode - The retry error code to check
     * @returns True if this is a MAC error requiring immediate session recreation
     */
    isMacError(errorCode: RetryReason | undefined): boolean;
    /**
     * Check if an error code indicates a session-related failure
     *
     * @param errorCode - The retry error code to check
     * @returns True if this is a session error
     */
    isSessionError(errorCode: RetryReason | undefined): boolean;
    /**
     * Increment retry counter for a message
     */
    incrementRetryCount(messageId: string): number;
    /**
     * Get retry count for a message
     */
    getRetryCount(messageId: string): number;
    /**
     * Check if message has exceeded maximum retry attempts
     */
    hasExceededMaxRetries(messageId: string): boolean;
    /**
     * Atomic check-and-increment (M12 — upstream #2576): returns
     * `{ proceed: true, count }` if the retry attempt is allowed (and the
     * counter was incremented), or `{ proceed: false, count }` if the message
     * is already at or past the retry limit. JavaScript's single-threaded
     * execution model means the read+increment happens within one sync block
     * — no external `await` can interleave between the bound check and the
     * `set`. Prefer this over calling `hasExceededMaxRetries` followed by
     * `incrementRetryCount` separately, because the latter pattern has an
     * `await` boundary between the two ops and a concurrent caller can
     * race past the cap.
     */
    tryIncrement(messageId: string): {
        proceed: boolean;
        count: number;
    };
    /**
     * Mark retry as successful
     */
    markRetrySuccess(messageId: string): void;
    /**
     * Mark retry as failed
     */
    markRetryFailed(messageId: string): void;
    /**
     * Schedule a phone request with delay
     */
    schedulePhoneRequest(messageId: string, callback: () => void, delay?: number): void;
    /**
     * Cancel pending phone request
     */
    cancelPendingPhoneRequest(messageId: string): void;
    /**
     * Save the open-session base key seen on a retry==2 receipt for a given
     * `(sessionId, msgId)`. Used by retry==N (N>2) to detect whether the
     * peer's session has rotated; if the same base key is still there, the
     * caller forces a fresh session before resending.
     */
    saveBaseKey(addr: string, msgId: string, baseKey: Uint8Array): void;
    /**
     * Plain byte-by-byte equality check of the stored base key vs `baseKey`.
     * Early-exits on length mismatch and on the first differing byte — this is
     * not constant-time, but timing resistance isn't required for these base
     * keys (they live in-memory only, used to detect retry-cycle collisions,
     * and are not high-value secrets like identity/signed-pre keys).
     */
    hasSameBaseKey(addr: string, msgId: string, baseKey: Uint8Array): boolean;
    deleteBaseKey(addr: string, msgId: string): void;
    private keyToString;
    private removeRecentMessage;
    /** Release all caches and cancel pending phone-request timers (called on socket close). */
    clear(): void;
}
//# sourceMappingURL=message-retry-manager.d.ts.map