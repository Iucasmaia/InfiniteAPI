import { proto } from '../../WAProto/index.js';
import type { Chat, Contact, LIDMapping, WAMessage } from '../Types/index.js';
import type { ILogger } from './logger.js';
/**
 * Downloads and decompresses history sync data from WhatsApp servers.
 *
 * PR #493 review P2-002 — note on `opts.host`:
 * The proto `IHistorySyncNotification` carries the WhatsApp-CDN-signed `url`
 * field directly from the server (with `?ccb=&oh=&oe=&_nc_sid=` query
 * params). `downloadContentFromMessage` prefers that signed URL verbatim
 * (post-P1-001 fix), so the per-socket `mediaHost` has NO effect on this
 * code path. Intentionally not threading `opts.host` here — it would be
 * dead code: the URL branch is always selected for history sync blobs.
 *
 * @param msg - The history sync notification message containing download info
 * @param options - Request options for the download
 * @returns Decoded HistorySync protocol buffer
 */
export declare const downloadHistory: (msg: proto.Message.IHistorySyncNotification, options: RequestInit) => Promise<proto.HistorySync>;
/**
 * Checks if a JID represents a person (can have LID-PN mapping).
 * Excludes groups, broadcasts, newsletters, and bots.
 *
 * @param jid - The JID to check
 * @returns true if the JID can have LID-PN mapping
 */
export declare function isPersonJid(jid: string | undefined): boolean;
/**
 * Extracts LID-PN mapping from a conversation object.
 *
 * WhatsApp uses two identifier systems:
 * - LID (Logical ID): Format `{number}@lid` or `{number}@hosted.lid`
 * - PN (Phone Number): Format `{number}@s.whatsapp.net` or `{number}@hosted`
 *
 * Conversations may have their ID in either format, with the alternate
 * format stored in `lidJid` or `pnJid` properties respectively.
 *
 * Skips non-person JIDs:
 * - `@g.us` (groups)
 * - `@broadcast` (broadcast lists)
 * - `@newsletter` (channels)
 *
 * @param chatId - The conversation ID (may be LID or PN format)
 * @param lidJid - The LID JID if chat ID is PN format
 * @param pnJid - The PN JID if chat ID is LID format
 * @returns LID-PN mapping if extractable, undefined otherwise
 *
 * @example
 * // Chat ID is LID, pnJid contains phone number
 * extractLidPnFromConversation('123456789@lid', undefined, '5511999999999@s.whatsapp.net')
 * // Returns: { lid: '123456789@lid', pn: '5511999999999@s.whatsapp.net' }
 *
 * @example
 * // Chat ID is PN, lidJid contains LID
 * extractLidPnFromConversation('5511999999999@s.whatsapp.net', '123456789@lid', undefined)
 * // Returns: { lid: '123456789@lid', pn: '5511999999999@s.whatsapp.net' }
 *
 * @example
 * // Newsletter - returns undefined (no mapping)
 * extractLidPnFromConversation('123456789@newsletter', undefined, undefined)
 * // Returns: undefined
 */
export declare function extractLidPnFromConversation(chatId: string, lidJid: string | undefined | null, pnJid: string | undefined | null): LIDMapping | undefined;
/**
 * Extracts LID-PN mapping from a message's alternative JID fields.
 *
 * Messages may contain alternate JID formats in:
 * - `key.remoteJidAlt` - Alternative remote JID format
 * - `key.participantAlt` - Alternative participant JID format (for groups)
 *
 * IMPORTANT: Uses || (OR) to ensure BOTH JIDs are person JIDs before extracting.
 * This prevents "poisoned" mappings where one side is a group/newsletter/broadcast.
 *
 * @param remoteJid - The primary remote JID
 * @param remoteJidAlt - The alternative remote JID (may be LID or PN)
 * @param participant - The primary participant JID (for group messages)
 * @param participantAlt - The alternative participant JID
 * @returns LID-PN mapping if extractable, undefined otherwise
 */
export declare function extractLidPnFromMessage(remoteJid: string | undefined | null, remoteJidAlt: string | undefined | null, participant: string | undefined | null, participantAlt: string | undefined | null): LIDMapping | undefined;
/**
 * Processes a history sync message and extracts chats, contacts, messages,
 * and LID-PN mappings.
 *
 * LID-PN mappings are extracted from three sources:
 * 1. Top-level `phoneNumberToLidMappings` array in the history sync payload
 * 2. Individual conversation objects that contain both LID and PN identifiers
 *    (via `lidJid` and `pnJid` properties)
 * 3. Message objects with alternate JID fields (`remoteJidAlt`, `participantAlt`)
 *
 * This multi-source extraction ensures maximum mapping coverage, as WhatsApp may
 * provide mappings in different locations depending on the sync type and context.
 *
 * Skipped JID types (no LID-PN mapping):
 * - `@g.us` (groups)
 * - `@broadcast` (broadcast lists)
 * - `@newsletter` (channels)
 *
 * @param item - The history sync protocol buffer to process
 * @param logger - Optional logger instance for trace-level debugging
 * @returns Processed data including chats, contacts, messages, and LID-PN mappings
 *
 * @see https://github.com/WhiskeySockets/Baileys/issues/2263
 */
export declare const processHistoryMessage: (item: proto.IHistorySync, logger?: ILogger) => {
    chats: Chat[];
    contacts: Contact[];
    messages: WAMessage[];
    lidPnMappings: LIDMapping[];
    pastParticipants: proto.IPastParticipants[] | null | undefined;
    syncType: proto.HistorySync.HistorySyncType | null | undefined;
    progress: number | null | undefined;
};
/**
 * Downloads and processes a history sync notification in one step.
 *
 * Handles two cases:
 * - Inline payload: Decodes directly from `initialHistBootstrapInlinePayload`
 * - Remote download: Fetches from WhatsApp servers via `downloadHistory`
 *
 * @param msg - The history sync notification message
 * @param options - Request options for the download
 * @param logger - Optional logger instance for trace-level debugging
 * @returns Processed history data including chats, contacts, messages, and LID-PN mappings
 */
export declare const downloadAndProcessHistorySyncNotification: (msg: proto.Message.IHistorySyncNotification, options: RequestInit, logger?: ILogger) => Promise<{
    chats: Chat[];
    contacts: Contact[];
    messages: WAMessage[];
    lidPnMappings: LIDMapping[];
    pastParticipants: proto.IPastParticipants[] | null | undefined;
    syncType: proto.HistorySync.HistorySyncType | null | undefined;
    progress: number | null | undefined;
}>;
/**
 * Extracts the history sync notification from a protocol message.
 *
 * @param message - The protocol message to check
 * @returns The history sync notification if present, undefined otherwise
 */
export declare const getHistoryMsg: (message: proto.IMessage) => proto.Message.IHistorySyncNotification | null | undefined;
//# sourceMappingURL=history.d.ts.map