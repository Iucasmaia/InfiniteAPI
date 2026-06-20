import type { SignalRepositoryWithLIDStore } from '../Types/index.js';
import type { AuthenticationCreds, AuthenticationState, KeyPair, SignalIdentity, SignalKeyStore, SignedKeyPair } from '../Types/Auth.js';
import { type BinaryNode, type FullJid } from '../WABinary/index.js';
import type { USyncQueryResultList } from '../WAUSync/index.js';
export declare const createSignalIdentity: (wid: string, accountSignatureKey: Uint8Array) => SignalIdentity;
export declare const getPreKeys: ({ get }: SignalKeyStore, min: number, limit: number) => Promise<{
    [id: string]: KeyPair;
}>;
export declare const generateOrGetPreKeys: (creds: AuthenticationCreds, range: number) => {
    newPreKeys: {
        [id: number]: KeyPair;
    };
    lastPreKeyId: number;
    preKeysRange: readonly [number, number];
};
export declare const xmppSignedPreKey: (key: SignedKeyPair) => BinaryNode;
export declare const xmppPreKey: (pair: KeyPair, id: number) => BinaryNode;
/**
 * Extract a Signal E2E session bundle from a `<receipt type="retry">` stanza.
 *
 * When WhatsApp asks us to resend a message it can attach a fresh `<keys>` prekey
 * bundle so the recipient is sure to have a matching session. Returning `null`
 * means "no usable bundle" — the caller should fall back to the usual prekey
 * IQ fetch path. Every nested field is validated (type byte, expected lengths,
 * registration id) so a malformed receipt never reaches the SessionBuilder.
 */
export declare const extractE2ESessionFromRetryReceipt: (receipt: BinaryNode) => {
    registrationId: number;
    identityKey: Uint8Array<ArrayBufferLike> | Buffer<ArrayBufferLike>;
    signedPreKey: {
        keyId: number;
        publicKey: Uint8Array<ArrayBufferLike> | Buffer<ArrayBufferLike>;
        signature: Uint8Array<ArrayBufferLike> | Buffer<ArrayBufferLike>;
    };
    preKey: {
        keyId: number;
        publicKey: Uint8Array;
    } | undefined;
} | null;
export declare const parseAndInjectE2ESessions: (node: BinaryNode, repository: SignalRepositoryWithLIDStore) => Promise<void>;
export declare const extractDeviceJids: (result: USyncQueryResultList[], myJid: string, myLid: string, excludeZeroDevices: boolean) => FullJid[];
/**
 * get the next N keys for upload or processing
 * @param count number of pre-keys to get or generate
 */
export declare const getNextPreKeys: ({ creds, keys }: AuthenticationState, count: number) => Promise<{
    update: Partial<AuthenticationCreds>;
    preKeys: {
        [id: string]: KeyPair;
    };
}>;
export declare const getNextPreKeysNode: (state: AuthenticationState, count: number) => Promise<{
    update: Partial<AuthenticationCreds>;
    node: BinaryNode;
}>;
//# sourceMappingURL=signal.d.ts.map