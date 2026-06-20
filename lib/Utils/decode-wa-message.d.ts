import { proto } from '../../WAProto/index.js';
import type { WAMessage } from '../Types/index.js';
import type { SignalRepositoryWithLIDStore } from '../Types/Signal.js';
import { type BinaryNode } from '../WABinary/index.js';
import type { ILogger } from './logger.js';
import { type MsmsgSecretCache } from './meta-ai-msmsg.js';
import { type RetryOptions } from './retry-utils.js';
/**
 * Unwrap a `deviceSentMessage` envelope while preserving fields from the OUTER
 * `Message` that the inner payload would otherwise lose. WhatsApp ships some
 * fields — most importantly `messageContextInfo.messageSecret` — on the OUTER
 * `Message` and an empty / partial `messageContextInfo` on the inner. The
 * previous unwrap `msg = msg.deviceSentMessage?.message || msg` silently
 * dropped those outer fields.
 *
 * Why this matters operationally:
 *   - Encrypted edit envelopes (upstream PR #2554) need the original
 *     `messageContextInfo.messageSecret` to derive the edit key. If the
 *     upsert dropped the secret on the fromMe-via-linked-device delivery,
 *     `getMessage` later returns the cached message WITHOUT the secret and
 *     the edit decrypt fails.
 *   - Our Meta AI / FBID bot msmsg cache (`cacheMessageSecretIfPresent`,
 *     called immediately after this unwrap) needs the secret to land
 *     against the outgoing message's id so subsequent bot replies can
 *     decrypt. Without preserving the outer context info, single-device
 *     and linked-device flows both miss the cache for the very first
 *     reply (the audit gap codex flagged on PR #518).
 *
 * Why a per-field merge instead of a generic `{...outer, ...inner}` spread
 * (upstream PR #2566's approach): upstream's spread lets the inner message's
 * `messageContextInfo` ENTIRELY override the outer's. If the inner ships a
 * partial `messageContextInfo` (e.g. just `threadId`), the outer's
 * `messageSecret` is lost. WA Web's `WAWebDeviceSentMessageProtoUtils.l(e)`
 * (extracted via CDP, validated against live captures) merges field-by-field:
 * inner is preferred when present, otherwise outer is used. Each field that
 * matters for downstream decoders is named explicitly. The fall-through
 * `...inner.messageContextInfo` preserves any other future fields whichever
 * side carried them.
 *
 * Returns the input unchanged when there is no `deviceSentMessage` envelope.
 */
export declare const unwrapDeviceSentMessage: (msg: proto.IMessage) => proto.IMessage;
export declare const getDecryptionJid: (sender: string, repository: SignalRepositoryWithLIDStore) => Promise<string>;
export declare const NO_MESSAGE_FOUND_ERROR_TEXT = "Message absent from node";
export declare const MISSING_KEYS_ERROR_TEXT = "Key used already or never filled";
export declare const BAD_MAC_ERROR_TEXT = "Bad MAC";
/** Texto exibido como messageStub quando o servidor restringe envios.
 *  Port de upstream `4dbbba2891` (PR #2442). */
export declare const ACCOUNT_RESTRICTED_TEXT = "Your account has been restricted";
export declare const DECRYPTION_RETRY_CONFIG: {
    maxRetries: number;
    baseDelayMs: number;
    sessionRecordErrors: string[];
    corruptedSessionErrors: string[];
};
/**
 * Retry options for decryption operations
 * Uses exponential backoff with jitter to handle transient failures
 */
export declare const DECRYPTION_RETRY_OPTIONS: RetryOptions;
export declare const NACK_REASONS: {
    ParsingError: number;
    UnrecognizedStanza: number;
    UnrecognizedStanzaClass: number;
    UnrecognizedStanzaType: number;
    InvalidProtobuf: number;
    InvalidHostedCompanionStanza: number;
    MissingMessageSecret: number;
    SignalErrorOldCounter: number;
    MessageDeletedOnPeer: number;
    UnhandledError: number;
    UnsupportedAdminRevoke: number;
    UnsupportedLIDGroup: number;
    DBOperationFailed: number;
    CorruptedSession: number;
};
export declare const SERVER_ERROR_CODES: {
    /**
     * @deprecated Use `MessageAccountRestriction` (mesma código `'463'`).
     * Mantido como alias pra preservar compat com consumers externos que
     * importam este símbolo. Port de upstream `0b159bfefc`.
     */
    MissingTcToken: string;
    /**
     * 1:1 message missing privacy token (tctoken). Usually means the account
     * is restricted: WhatsApp blocks starting new chats but preserves existing
     * ones, since established chats already carry a tctoken.
     * Port de upstream `0b159bfefc`.
     */
    MessageAccountRestriction: string;
    SmaxInvalid: string;
    StaleGroupAddressingMode: string;
    NewChatMessagesCapped: string;
};
export declare const extractAddressingContext: (stanza: BinaryNode) => {
    addressingMode: string;
    senderAlt: string | undefined;
    recipientAlt: string | undefined;
};
/**
 * Decode the received node as a message.
 * @note this will only parse the message, not decrypt it
 */
export declare function decodeMessageNode(stanza: BinaryNode, meId: string, meLid: string): {
    fullMessage: WAMessage;
    author: string;
    sender: string;
};
export declare const decryptMessageNode: (stanza: BinaryNode, meId: string, meLid: string, repository: SignalRepositoryWithLIDStore, logger: ILogger, 
/**
 * Optional per-socket cache of (cacheKey → messageSecret) used to decrypt
 * `<enc type="msmsg">` (Meta AI / FBID bot replies). Caller (Socket layer)
 * supplies one instance per connection. When absent and an msmsg stanza
 * does arrive, `decodeIncomingMsmsg` throws a dedicated `Error('Meta AI
 * msmsg received but no MsmsgSecretCache was wired into decryptMessageNode')`
 * — not the generic "Unknown e2e type" path — so misconfiguration surfaces
 * with a precise message rather than being silently NACKed.
 */
msmsgCache?: MsmsgSecretCache) => {
    fullMessage: WAMessage;
    category: string | undefined;
    author: string;
    decrypt(): Promise<void>;
};
/**
 * Utility function to check if an error indicates a corrupted session
 * (Bad MAC, MessageCounterError, Key already used)
 */
export declare function isCorruptedSessionError(error: any): boolean;
/**
 * Clean up corrupted session for a specific device JID.
 * WABA behavior: DELETE sessions WHERE recipient_id=? AND device_id=?
 * Only deletes the exact device that was corrupted, not all devices.
 *
 * NOTE: This should NOT be called on every Bad MAC error (hot path).
 * Instead, let the retry+pkmsg flow handle recovery naturally (like WhatsApp does).
 * Only call this as a safety net when retries are exhausted.
 */
export declare function cleanupCorruptedSession(jid: string, repository: SignalRepositoryWithLIDStore, logger: ILogger): Promise<number>;
//# sourceMappingURL=decode-wa-message.d.ts.map