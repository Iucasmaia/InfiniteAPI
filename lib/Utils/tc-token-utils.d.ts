import type { SignalKeyStoreWithTransaction } from '../Types/index.js';
import type { BinaryNode } from '../WABinary/index.js';
/**
 * Mirrors WA Web's `Wid.isRegularUser()` (user ∧ ¬PSA ∧ ¬Bot). Used to gate tctoken
 * storage against malformed notifications — WA Web filters server-side but we
 * defend here for parity with `WAWebSetTcTokenChatAction.handleIncomingTcToken`.
 * Works for both pre- and post-normalized JIDs (`@c.us` vs `@s.whatsapp.net`).
 */
export declare function isRegularUser(jid: string | undefined): boolean;
/**
 * Check if a received token is expired using WA Web's rolling bucket algorithm.
 * Reference: WAWebTrustedContactsUtils.isTokenExpired
 *
 * Uses Receiver mode constants (tctoken_duration, tctoken_num_buckets).
 * NOTE: WA Web distinguishes Sender vs Receiver mode via AB props
 * (tctoken_duration_sender / tctoken_num_buckets_sender). Currently both
 * use identical values (604800 / 4), so we use a single function for both.
 * If WA ever diverges these, add a `mode` parameter here.
 */
export declare function isTcTokenExpired(timestamp: number | string | null | undefined): boolean;
/**
 * Check if we should issue a new token to this contact (bucket boundary crossed).
 * Reference: WAWebTrustedContactsUtils.shouldSendNewToken
 *
 * Returns true if senderTimestamp is null/undefined or in a previous bucket.
 */
export declare function shouldSendNewTcToken(senderTimestamp: number | undefined): boolean;
/**
 * Resolve a JID to its LID for tctoken storage, mirroring how Signal sessions
 * use LID keys via resolveLIDSignalAddress.
 *
 * WA Web always resolves to LID before storing/looking up tctokens:
 * `senderLid ?? toLid(from)` (WAWebSetTcTokenChatAction.handleIncomingTcToken)
 *
 * @param jid - The JID to resolve (can be PN or LID)
 * @param getLIDForPN - Resolver function (from lidMapping)
 * @returns The LID if mapping exists, otherwise the original JID
 */
export declare function resolveTcTokenJid(jid: string, getLIDForPN: (pn: string) => Promise<string | null>): Promise<string>;
type TcTokenParams = {
    jid: string;
    baseContent?: BinaryNode[];
    authState: {
        keys: SignalKeyStoreWithTransaction;
    };
    getLIDForPN?: (pn: string) => Promise<string | null>;
};
/**
 * Legacy sibling-array shape. Used by `presenceSubscribe` where the tctoken
 * is the only content of a `<presence>` (so the "sibling" framing is moot —
 * there's nothing to sibling against). Kept on the legacy
 * `buildTcTokenFromJid` + `getLIDForPN` resolver pair for behavioral
 * stability.
 *
 * Returns `baseContent` (mutated in place with the `<tctoken>` appended)
 * when a token exists, or `baseContent | undefined` otherwise — same exact
 * contract as before the helper extraction.
 */
export declare function buildTcTokenFromJid({ authState, jid, baseContent, getLIDForPN }: TcTokenParams): Promise<BinaryNode[] | undefined>;
/**
 * Build a standalone <tctoken> BinaryNode (no container, no sibling array).
 *
 * Use this when the caller needs the tctoken as a CHILD of another stanza node
 * — e.g. nested inside <picture> for `w:profile:picture` queries (port of
 * upstream PR #2614 / matches WA Web's `WASmaxOutProfilePictureTCTokenMixin`
 * + whatsmeow's `pictureContent`).
 *
 * Returns the node when a valid (non-expired, non-empty) tctoken exists for
 * the resolved storage JID, or `undefined` otherwise.
 */
export declare function buildTcTokenNode({ authState, jid, getLIDForPN }: Omit<TcTokenParams, 'baseContent'>): Promise<BinaryNode | undefined>;
type StoreTcTokensParams = {
    result: BinaryNode;
    fallbackJid: string;
    keys: SignalKeyStoreWithTransaction;
    getLIDForPN: (pn: string) => Promise<string | null>;
    /** Optional callback when a new JID is stored (for index tracking) */
    onNewJidStored?: (jid: string) => void;
};
/**
 * Parse and store tctoken(s) from an IQ result node.
 * Includes timestamp monotonicity guard matching WA Web's handleIncomingTcToken.
 * Used by both the blocking fetch (messages-send) and IQ response (messages-recv) paths.
 */
export declare function storeTcTokensFromIqResult({ result, fallbackJid, keys, getLIDForPN, onNewJidStored }: StoreTcTokensParams): Promise<void>;
export {};
//# sourceMappingURL=tc-token-utils.d.ts.map