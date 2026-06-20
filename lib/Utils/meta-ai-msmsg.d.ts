/**
 * Meta AI / FBID bot message decryption (`<enc type="msmsg">`).
 *
 * The algorithm here was reverse-engineered from WhatsApp Web's
 * `WAWebBotMessageSecret` module and validated empirically via CDP capture
 * (Chrome --remote-debugging-port=9223 + WA Web + Meta AI "oi", 2026-06-07).
 * See `memory/meta_ai_msmsg_decryption_validated.md` for the raw capture and
 * step-by-step derivation.
 *
 * Why not just port upstream PR #2592:
 *   - PR brute-forces 12 HKDF strategies (author didn't decode the algorithm
 *     deterministically). WA Web uses exactly ONE recipe per (FBID, edit-type)
 *     combination.
 *   - PR has an unbounded module-global `Map` for the secret cache (cubic P1,
 *     coderabbit Major). Multiple sockets in the same Node process share secrets
 *     across tenants — leaks cross-account.
 *   - PR drops `botType ∉ {'full', 'last'}`, missing 7 of 8 chunks in a real
 *     Meta AI streaming response (captured: `first` → 6× `inner` → `last`).
 *   - PR's cache key is the raw msgId, colliding across chats. Real key is
 *     `${fromMe}_${remoteJid}_${id}` (mirrors WAWebMsgKey.toString()).
 *
 * What this module provides:
 *   - `extractMsmsgStanzaInfo(stanza)`: pull target_id / target_sender_jid /
 *     edit / edit_target_id out of the `<meta>` and `<bot>` child nodes.
 *   - `makeMsmsgSecretCache()`: per-socket bounded LRU cache (NodeCache,
 *     maxKeys=500, ttl=1h). Caller clears on socket close.
 *   - `buildMsmsgCacheKey(...)`: tri-partite key matching WAWebMsgKey format.
 *   - `decryptMsmsgBotMessage(...)`: 2-step HKDF + AES-GCM, ONE strategy per
 *     case (FBID with `inner`/`last` → use `botEditTargetId` as the HKDF
 *     stanzaId; otherwise use the enc-node's own stanzaId).
 *   - `cacheMessageSecretIfPresent(...)`: scan a decrypted `IMessage` for
 *     `messageContextInfo.messageSecret` and stash it into the cache. Called
 *     after EVERY successful decryption so subsequent bot replies referencing
 *     this msg's id can find the secret.
 *
 * Outside the scope of this module:
 *   - Plumbing into `decryptMessageNode` (Utils/decode-wa-message.ts) — that
 *     adds a `case 'msmsg'` branch and calls into `decryptMsmsgBotMessage`.
 *   - Removing the early-return NACK in `messages-recv.ts` — done in the same PR.
 */
import NodeCache from '@cacheable/node-cache';
import { proto } from '../../WAProto/index.js';
import type { BinaryNode } from '../WABinary/index.js';
import type { ILogger } from './logger.js';
/**
 * Edit-type values seen on `<bot edit="...">` for Meta AI streaming responses.
 * Confirmed via CDP capture:
 *   call 1: edit="first" edit_target_id=""              (initial chunk)
 *   calls 2-7: edit="inner" edit_target_id=<first.id>   (streaming updates)
 *   call 8: edit="last"  edit_target_id=<first.id>      (final chunk)
 *
 * `full` is also documented in `WAWebBotTypes.BotMsgEditType` for non-streaming
 * single-shot replies (not seen in the "oi" capture but kept for compat).
 */
export type MsmsgBotEditType = 'first' | 'inner' | 'last' | 'full' | undefined;
/**
 * Parsed view of the metadata children of an incoming msmsg stanza.
 * Mirrors `WAWebHandleMsgParser.S(e)` output for the `<bot>` node plus the
 * `target_*` attrs of the `<meta>` node.
 */
export interface MsmsgStanzaInfo {
    /** From `<meta target_id="...">`. Identifies the OUTGOING msg whose
     *  messageSecret decrypts this incoming msmsg. Required. */
    targetId?: string;
    /** From `<meta target_sender_jid="...">`. Identifies who created the
     *  secret. Often absent — defaults to me when absent. */
    targetSenderJid?: string;
    /** From `<bot edit="...">`. Drives the choice of stanzaId for HKDF
     *  derivation in the FBID-bot path. */
    botEditType?: MsmsgBotEditType;
    /** From `<bot edit_target_id="...">`. For `inner`/`last` chunks in a
     *  streaming response, this is the id of the `first` chunk and becomes the
     *  HKDF stanzaId so all chunks derive the same key. Empty on `first`. */
    botEditTargetId?: string;
}
/**
 * Per-socket bounded TTL cache of (cacheKey → messageSecret bytes). Capped at
 * `DEFAULT_CACHE_MAX_KEYS.MSMSG_SECRET` (500) and TTLed at
 * `DEFAULT_CACHE_TTLS.MSMSG_SECRET` (1h).
 *
 * NOT an LRU — `@cacheable/node-cache` v2.x raises `ECACHEFULL` on `.set()`
 * once `maxKeys` is reached rather than evicting the oldest entry. Caller-side
 * writes are guarded with `isNodeCacheFullError` so a saturated cache logs at
 * debug and drops the write instead of crashing the decrypt path.
 *
 * The caller MUST `flushAll()` AND `close()` on socket end (see
 * `registerSocketEndHandler` in `messages-recv.ts`) to mirror WA Web's
 * `BackendEventBus.onLogout` behaviour AND to stop the NodeCache `setInterval`
 * timer, avoiding a per-reconnect timer leak across long-running processes.
 */
export type MsmsgSecretCache = NodeCache<Buffer>;
export declare const makeMsmsgSecretCache: () => MsmsgSecretCache;
/**
 * Pull the meta/bot metadata out of a `<message>` stanza's children. Returns
 * `null` if the stanza has no msmsg enc child or no `target_id` — the latter
 * is required by the WA Web decryption code path.
 */
export declare const extractMsmsgStanzaInfo: (stanza: BinaryNode) => MsmsgStanzaInfo | null;
/**
 * Build the cache key that locates a messageSecret by (sender, chat, msg id).
 *
 * Format matches WAWebMsgKey.toString(): `${fromMe}_${remote}_${id}` and for
 * group conversations `${fromMe}_${remote}_${id}_${participant}`.
 *
 * The defaults capture the common case (the secret was stored when WE sent
 * the original message to the bot): `fromMe=true`, `remote=conversation chat`,
 * `id=msgMeta.targetId`. For group chats with FBID bots WA Web pushes the LID
 * through `toPn()` before using it as the participant — we mirror that via
 * `lidToPn`, with a fallback to the raw LID when the mapping is absent so the
 * key still has SOME participant component.
 */
export declare const buildMsmsgCacheKey: (params: {
    fromMe: boolean;
    remoteJid: string;
    id: string;
    participant?: string;
}) => string;
/**
 * Cache the `messageContextInfo.messageSecret` (if present) on a freshly
 * decrypted message. Called from `decryptMessageNode` after every successful
 * decode — covers both messages we received (cache entry for OUR follow-up
 * bot replies) and messages we sent that were echoed back via deviceSentMessage.
 *
 * `cache.set` raises `ECACHEFULL` once `MSMSG_SECRET` (500) is reached. The
 * guard distinguishes that case (debug-log + drop the write — losing one
 * cache entry just means the next bot reply for the same id will raise
 * `OrphanMsmsgError`, which is operationally recoverable) from every other
 * exception (re-thrown — those are bugs we want surfaced).
 */
export declare const cacheMessageSecretIfPresent: (cache: MsmsgSecretCache | undefined, msg: proto.IMessage, msgKey: {
    fromMe?: boolean | null;
    remoteJid?: string | null;
    id?: string | null;
    participant?: string | null;
}, logger?: ILogger) => void;
/**
 * Inputs to `decryptMsmsgBotMessage`. The caller (Utils/decode-wa-message.ts)
 * builds this from the stanza + repository + the just-extracted MsmsgStanzaInfo.
 */
export interface DecryptMsmsgInput {
    /** The MessageSecretMessage protobuf bytes (the `<enc type="msmsg">` content). */
    ciphertext: Uint8Array;
    /** Parsed metadata children of the stanza. */
    stanzaInfo: MsmsgStanzaInfo;
    /** Stanza's own `id` attr — this msg's externalId. */
    stanzaId: string;
    /** Stanza's `from` (or `participant` for groups) — the BOT. */
    authorJid: string;
    /** The chat this msg belongs to (remoteJid). */
    chatJid: string;
    /** Whether the chat is a group. */
    isGroup: boolean;
    /** Whether the bot author is on the `@bot` server (Meta AI / other FBID
     *  bots). Drives which `me` JID is used as `originalUserJid` fallback. */
    isFbidBot: boolean;
    /** Our own LID (`<num>@lid`). Used as default `originalUserJid` for FBID
     *  bots when `targetSenderJid` is absent. */
    meLid: string;
    /** Our own PN JID (`<num>@s.whatsapp.net`). Used as default
     *  `originalUserJid` for non-FBID bots. */
    meId: string;
    /** Per-socket secret cache. */
    cache: MsmsgSecretCache;
    /** Optional logger for trace-level details. */
    logger?: ILogger;
    /** Optional LID→PN mapping function for FBID bots in group chats. The
     *  cache lookup uses the participant in PN form there (mirrors
     *  `LidMigrationUtils.toPn` in WA Web). If absent or returns falsy, the
     *  raw LID is used as a fallback. */
    lidToPn?: (lidJid: string) => string | undefined;
}
/**
 * The dedicated error thrown when neither the cache nor any fallback yields a
 * messageSecret. Callers may catch this and NACK the stanza with
 * `MissingMessageSecret` (487-equivalent) instead of letting it crash the
 * message-handle path. Mirrors `WAWebOrphanBotMsgError`.
 */
export declare class OrphanMsmsgError extends Error {
    readonly targetCacheKey: string;
    constructor(targetCacheKey: string);
}
/**
 * Decrypt one `<enc type="msmsg">` payload.
 *
 * Algorithm summary (full derivation in `meta_ai_msmsg_decryption_validated.md`):
 *
 *   1. Resolve `originalUserJid`:
 *        FBID bot     → targetSenderJid || meLid    (then normalize → strip device)
 *        non-FBID bot → targetSenderJid || meId     (then normalize)
 *
 *   2. Resolve `senderJid`:
 *        widToUserJid(authorJid) — strip device suffix from bot jid
 *
 *   3. Resolve `hkdfStanzaId` (drives both HKDF info and AAD):
 *        FBID + edit ∈ {inner, last} + botEditTargetId present → botEditTargetId
 *        otherwise (FBID first/full, or any non-FBID first attempt)            → stanzaId
 *
 *   4. Lookup messageSecret in the per-socket cache via
 *        WAWebMsgKey-shaped key (fromMe_remote_id [_participant]).
 *      Fallback to `OrphanMsmsgError` (caller decides NACK strategy).
 *
 *   5. Two-step HKDF:
 *        baseSecret   = HKDF(messageSecret, info="Bot Message", L=32)
 *        infoBytes    = utf8(hkdfStanzaId) || utf8(originalUserJid) || utf8(senderJid)
 *        decryptionKey = HKDF(baseSecret, info=infoBytes, L=32)
 *
 *   6. AES-256-GCM decrypt with AAD = utf8(hkdfStanzaId) || 0x00 || utf8(senderJid).
 *      The ciphertext layout matches our existing `aesDecryptGCM` helper
 *      (auth tag is the trailing 16 bytes of encPayload).
 *
 *   7. For non-FBID bots only, one retry with `hkdfStanzaId = botEditTargetId`
 *      if the first attempt fails. WA Web does this same try/catch only on
 *      the non-FBID path; on FBID it picks the right id deterministically
 *      based on `botEditType` and doesn't retry.
 *
 * Returns the decoded `Message` protobuf. The caller is responsible for
 * applying `unpadRandomMax16` semantics and walking `deviceSentMessage`.
 */
export declare const decryptMsmsgBotMessage: (input: DecryptMsmsgInput) => proto.IMessage;
/**
 * Returns true ONLY for the `@bot` server. That's the authoritative signal
 * that the AUTHOR of an incoming stanza is a Meta AI / FBID bot — the cipher
 * layer needs that distinction to pick the FBID HKDF derivation.
 *
 * Intentionally does NOT match the user-facing chat jid (e.g. Meta AI shows
 * up as `13135550202@c.us` in the chat list). `@c.us` is shared with regular
 * 1:1 user chats, so matching it here would risk taking the FBID code path
 * for a non-bot conversation. The `<bot>` xml node on the stanza is the only
 * authoritative tag; for jid-based detection we restrict to `@bot`.
 */
export declare const isMsmsgBotConversation: (chatOrAuthorJid: string | undefined) => boolean;
//# sourceMappingURL=meta-ai-msmsg.d.ts.map