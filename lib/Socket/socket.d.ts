import { Boom } from '@hapi/boom';
import type { ConnectionState, NewChatMessageCapInfo, ReachoutTimelockState, SocketConfig } from '../Types/index.js';
import { type BinaryNode } from '../WABinary/index.js';
import { BinaryInfo } from '../WAM/BinaryInfo.js';
import { USyncQuery } from '../WAUSync/index.js';
import { WebSocketClient } from './Client/index.js';
/**
 * Connects to WA servers and performs:
 * - simple queries (no retry mechanism, wait for connection establishment)
 * - listen to messages and emit events
 * - query phone connection
 */
export declare const makeSocket: (config: SocketConfig) => {
    type: "md";
    ws: WebSocketClient;
    ev: import("../Types/index.js").BaileysEventEmitter & {
        process(handler: (events: Partial<import("../Types/index.js").BaileysEventMap>) => void | Promise<void>): () => void;
        buffer(): void;
        createBufferedFunction<A extends any[], T>(work: (...args: A) => Promise<T>): (...args: A) => Promise<T>;
        flush(force?: boolean): boolean;
        isBuffering(): boolean;
        destroy(): void;
        isDestroyed(): boolean;
        getStatistics(): import("../Utils/index.js").BufferStatistics;
        getConfig(): import("../Utils/index.js").BufferConfig;
    };
    authState: {
        creds: import("../Types/index.js").AuthenticationCreds;
        keys: import("../Types/index.js").SignalKeyStoreWithRecordTransaction;
    };
    signalRepository: import("../Types/index.js").SignalRepositoryWithLIDStore;
    sessionCleanup: {
        start: () => void;
        stop: () => void;
        runCleanup: () => Promise<import("../Types/index.js").SessionCleanupStats>;
        getStats: () => {
            enabled: boolean;
            lastCleanupAt: number;
            cleanupRunning: boolean;
            config: import("../Types/index.js").SessionCleanupConfig;
        };
    };
    sessionActivityTracker: {
        recordActivity: (jid: string) => void;
        getLastActivity: (jid: string) => Promise<number | undefined>;
        getAllActivities: () => Promise<Map<string, number>>;
        flush: () => Promise<void>;
        start: () => void;
        stop: () => Promise<void>;
        getStats: () => {
            totalUpdates: number;
            totalFlushes: number;
            lastFlushAt: number;
            lastFlushDuration: number;
            cacheSize: number;
            enabled: boolean;
        };
    };
    readonly user: import("../Types/index.js").Contact | undefined;
    generateMessageTag: () => string;
    query: (node: BinaryNode, timeoutMs?: number) => Promise<any>;
    waitForMessage: <T>(msgId: string, timeoutMs?: number | undefined) => Promise<T | undefined>;
    waitForSocketOpen: () => Promise<void>;
    sendRawMessage: (data: Uint8Array | Buffer) => Promise<void>;
    sendNode: (frame: BinaryNode) => Promise<void>;
    logout: (msg?: string) => Promise<void>;
    end: (error: Error | undefined) => Promise<void>;
    registerSocketEndHandler: (handler: (error: Error | undefined) => void | Promise<void>) => void;
    onUnexpectedError: (err: Error | Boom, msg: string) => void;
    uploadPreKeys: (count?: number, retryCount?: number) => Promise<void>;
    uploadPreKeysToServerIfRequired: () => Promise<void>;
    digestKeyBundle: () => Promise<void>;
    rotateSignedPreKey: () => Promise<void>;
    requestPairingCode: (phoneNumber: string, customPairingCode?: string) => Promise<string>;
    wamBuffer: BinaryInfo;
    /** Waits for the connection to WA to reach a state */
    waitForConnectionUpdate: (check: (u: Partial<ConnectionState>) => Promise<boolean | undefined>, timeoutMs?: number) => Promise<void>;
    sendWAMBuffer: (wamBuffer: Buffer) => Promise<any>;
    executeUSyncQuery: (usyncQuery: USyncQuery) => Promise<import("../index.js").USyncQueryResult | undefined>;
    onWhatsApp: (...phoneNumber: string[]) => Promise<{
        jid: string;
        exists: boolean;
    }[] | undefined>;
    fetchAccountReachoutTimelock: (emitUpdate?: boolean) => Promise<ReachoutTimelockState>;
    fetchNewChatMessageCap: () => Promise<NewChatMessageCapInfo>;
    /** Send unified_session telemetry manually */
    sendUnifiedSession: (trigger?: "login" | "pairing" | "presence" | "manual") => Promise<void>;
    /** Get unified session manager state (for debugging) */
    getUnifiedSessionState: () => Readonly<import("../Utils/index.js").UnifiedSessionState> | undefined;
    /** Update server time offset (call when receiving server timestamps) */
    updateServerTimeOffset: (serverTime: string | number) => void;
    /**
     * Whether the offline-phase buffer was skipped for this connection.
     * true  → this is a reconnect of an existing session (skip all sync waits in chats.ts too)
     * false → fresh QR-scan or first connection (normal sync flow applies)
     */
    skipOfflineBuffer: boolean;
};
//# sourceMappingURL=socket.d.ts.map