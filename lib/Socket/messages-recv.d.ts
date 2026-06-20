import NodeCache from '@cacheable/node-cache';
import { Boom } from '@hapi/boom';
import Long from 'long';
import { proto } from '../../WAProto/index.js';
import type { MessageReceiptType, MessageRelayOptions, NewChatMessageCapInfo, PlaceholderMessageData, SocketConfig, WAMessage, WAMessageKey } from '../Types/index.js';
import { type BinaryNode, type JidWithDevice } from '../WABinary/index.js';
export declare const makeMessagesRecvSocket: (config: SocketConfig) => {
    sendMessageAck: (node: BinaryNode, errorCode?: number) => Promise<void>;
    sendRetryRequest: (node: BinaryNode, forceIncludeKeys?: boolean) => Promise<void>;
    rejectCall: (callId: string, callFrom: string) => Promise<void>;
    offerCall: (jid: string, isVideo?: boolean) => Promise<{
        callId: string;
        stanzaId: string;
    }>;
    acceptCall: (callId: string, callFrom: string, isVideo?: boolean) => Promise<void>;
    preacceptCall: (callId: string, callCreator: string, isVideo?: boolean) => Promise<void>;
    terminateCall: (callId: string, callTo: string, callCreator?: string, reason?: string, duration?: number) => Promise<void>;
    sendRelayLatency: (callId: string, callCreator: string, relays: Array<{
        relayName?: string;
        latency: number;
        relayId?: string;
        dlBw?: number;
        ulBw?: number;
    }>, transactionId?: string) => Promise<void>;
    sendTransport: (callId: string, callCreator: string, to: string, candidates: Array<{
        priority: string;
        data?: Uint8Array;
    }>, round?: number) => Promise<void>;
    sendCallDuration: (callId: string, callCreator: string, peer: string, audioDuration: number, callType?: string) => Promise<void>;
    muteCall: (callId: string, callCreator: string, to: string, muted: boolean) => Promise<void>;
    sendHeartbeat: (callId: string, callCreator: string) => Promise<void>;
    sendEncRekey: (callId: string, callCreator: string, to: string, transactionId: string) => Promise<void>;
    sendVideoState: (callId: string, callCreator: string, to: string, enabled: boolean, orientation?: string) => Promise<void>;
    createCallLink: (media?: "video" | "audio", event?: {
        startTime: number;
    }, timeoutMs?: number) => Promise<{
        token: string | undefined;
        url: string | undefined;
        response: any;
    }>;
    queryCallLink: (token: string, media?: "video" | "audio") => Promise<any>;
    joinCallLink: (token: string, media?: "video" | "audio") => Promise<any>;
    fetchMessageHistory: (count: number, oldestMsgKey: WAMessageKey, oldestMsgTimestamp: number | Long) => Promise<string>;
    requestPlaceholderResend: (messageKey: WAMessageKey, msgData?: PlaceholderMessageData) => Promise<string | undefined>;
    messageRetryManager: import("../Utils/index.js").MessageRetryManager | null;
    userDevicesCache: import("../Types/index.js").PossiblyExtendedCacheStore | NodeCache<JidWithDevice[]>;
    devicesMutex: {
        mutex<T>(code: () => Promise<T> | T): Promise<T>;
    };
    getPrivacyTokens: (jids: string[], timestamp?: number) => Promise<any>;
    assertSessions: (jids: string[], force?: boolean) => Promise<boolean>;
    relayMessage: (jid: string, message: proto.IMessage, { messageId: msgId, participant, additionalAttributes, additionalNodes, useUserDevicesCache, useCachedGroupMetadata, statusJidList }: MessageRelayOptions) => Promise<string>;
    sendReceipt: (jid: string, participant: string | undefined, messageIds: string[], type: MessageReceiptType) => Promise<void>;
    sendReceipts: (keys: WAMessageKey[], type: MessageReceiptType) => Promise<void>;
    readMessages: (keys: WAMessageKey[]) => Promise<void>;
    refreshMediaConn: (forceGet?: boolean) => Promise<import("../Types/index.js").MediaConnInfo>;
    getMediaHost: () => string;
    waUploadToServer: import("../Types/index.js").WAMediaUploadFunction;
    fetchPrivacySettings: (force?: boolean) => Promise<{
        [_: string]: string;
    }>;
    sendPeerDataOperationMessage: (pdoMessage: proto.Message.IPeerDataOperationRequestMessage) => Promise<string>;
    createParticipantNodes: (recipientJids: string[], message: proto.IMessage, extraAttrs?: BinaryNode["attrs"], dsmMessage?: proto.IMessage, useLegacyLock?: boolean) => Promise<{
        nodes: BinaryNode[];
        shouldIncludeDeviceIdentity: boolean;
    }>;
    getUSyncDevices: (jids: string[], useCache: boolean, ignoreZeroDevices: boolean) => Promise<(JidWithDevice & {
        jid: string;
    })[]>;
    updateMemberLabel: (jid: string, memberLabel: string) => Promise<string>;
    updateMediaMessage: (message: WAMessage) => Promise<WAMessage>;
    sendAlbumMessage: (jid: string, album: import("../Types/index.js").AlbumMessageOptions, options?: import("../Types/index.js").MiscMessageGenerationOptions) => Promise<import("../Types/index.js").AlbumSendResult>;
    sendMessage: (jid: string, content: import("../Types/index.js").AnyMessageContent, options?: import("../Types/index.js").MiscMessageGenerationOptions) => Promise<WAMessage | undefined>;
    newsletterCreate: (name: string, description?: string) => Promise<import("../Types/index.js").NewsletterMetadata>;
    newsletterUpdate: (jid: string, updates: import("../Types/index.js").NewsletterUpdate) => Promise<unknown>;
    newsletterSubscribers: (jid: string) => Promise<{
        subscribers: number;
    }>;
    newsletterMetadata: (type: "invite" | "jid", key: string) => Promise<import("../Types/index.js").NewsletterMetadata | null>;
    newsletterFollow: (jid: string) => Promise<unknown>;
    newsletterUnfollow: (jid: string) => Promise<unknown>;
    newsletterMute: (jid: string) => Promise<unknown>;
    newsletterUnmute: (jid: string) => Promise<unknown>;
    newsletterUpdateName: (jid: string, name: string) => Promise<unknown>;
    newsletterUpdateDescription: (jid: string, description: string) => Promise<unknown>;
    newsletterUpdatePicture: (jid: string, content: import("../Types/index.js").WAMediaUpload) => Promise<unknown>;
    newsletterRemovePicture: (jid: string) => Promise<unknown>;
    newsletterReactMessage: (jid: string, serverId: string, reaction?: string) => Promise<void>;
    newsletterFetchMessages: (jid: string, count: number, since: number, after: number) => Promise<{
        id: string | undefined;
        serverId: string | undefined;
        type: string | undefined;
        timestamp: number | undefined;
        isSender: boolean;
        views: number | undefined;
        forwards: number | undefined;
        responses: number | undefined;
        editTimestamp: number | undefined;
        originalTimestamp: number | undefined;
        mediaRcat: Uint8Array<ArrayBufferLike> | undefined;
        reactions: {
            code: string | undefined;
            count: number;
        }[];
        pollVotes: {
            count: number;
            hash: Uint8Array<ArrayBufferLike> | undefined;
        }[];
        message: proto.IMessage | undefined;
    }[]>;
    subscribeNewsletterUpdates: (jid: string) => Promise<{
        duration: string;
    } | null>;
    newsletterAdminCount: (jid: string) => Promise<number>;
    newsletterChangeOwner: (jid: string, newOwnerJid: string) => Promise<void>;
    newsletterDemote: (jid: string, userJid: string) => Promise<void>;
    newsletterDelete: (jid: string) => Promise<void>;
    groupMetadata: (jid: string) => Promise<import("../Types/index.js").GroupMetadata>;
    groupCreate: (subject: string, participants: string[]) => Promise<import("../Types/index.js").GroupMetadata>;
    groupLeave: (id: string) => Promise<void>;
    groupUpdateSubject: (jid: string, subject: string) => Promise<void>;
    groupRequestParticipantsList: (jid: string) => Promise<{
        [key: string]: string;
    }[]>;
    groupRequestParticipantsUpdate: (jid: string, participants: string[], action: "approve" | "reject") => Promise<{
        status: string;
        jid: string | undefined;
    }[]>;
    groupParticipantsUpdate: (jid: string, participants: string[], action: import("../Types/index.js").ParticipantAction) => Promise<{
        status: string;
        jid: string | undefined;
        content: BinaryNode;
    }[]>;
    groupUpdateDescription: (jid: string, description?: string) => Promise<void>;
    groupInviteCode: (jid: string) => Promise<string | undefined>;
    groupRevokeInvite: (jid: string) => Promise<string | undefined>;
    groupAcceptInvite: (code: string) => Promise<string | undefined>;
    groupRevokeInviteV4: (groupJid: string, invitedJid: string) => Promise<boolean>;
    groupAcceptInviteV4: (key: string | WAMessageKey, inviteMessage: proto.Message.IGroupInviteMessage) => Promise<any>;
    groupGetInviteInfo: (code: string) => Promise<import("../Types/index.js").GroupMetadata>;
    groupToggleEphemeral: (jid: string, ephemeralExpiration: number) => Promise<void>;
    groupSettingUpdate: (jid: string, setting: "announcement" | "not_announcement" | "locked" | "unlocked") => Promise<void>;
    groupMemberAddMode: (jid: string, mode: "admin_add" | "all_member_add") => Promise<void>;
    groupJoinApprovalMode: (jid: string, mode: "on" | "off") => Promise<void>;
    groupFetchAllParticipating: () => Promise<{
        [_: string]: import("../Types/index.js").GroupMetadata;
    }>;
    getBotListV2: () => Promise<import("../Types/index.js").BotListInfo[]>;
    messageMutex: {
        mutex<T>(key: string, task: () => Promise<T> | T): Promise<T>;
    };
    receiptMutex: {
        mutex<T>(key: string, task: () => Promise<T> | T): Promise<T>;
    };
    appStatePatchMutex: {
        mutex<T>(code: () => Promise<T> | T): Promise<T>;
    };
    notificationMutex: {
        mutex<T>(key: string, task: () => Promise<T> | T): Promise<T>;
    };
    upsertMessage: (msg: WAMessage, type: import("../Types/index.js").MessageUpsertType) => Promise<void>;
    appPatch: (patchCreate: import("../Types/index.js").WAPatchCreate) => Promise<void>;
    sendPresenceUpdate: (type: import("../Types/index.js").WAPresence, toJid?: string) => Promise<void>;
    presenceSubscribe: (toJid: string) => Promise<void>;
    profilePictureUrl: (jid: string, type?: "preview" | "image", timeoutMs?: number, opts?: {
        existingId?: string;
        invite?: string;
        personaId?: string;
        commonGid?: string;
    }) => Promise<string | undefined>;
    fetchBlocklist: () => Promise<(string | undefined)[]>;
    fetchStatus: (...jids: string[]) => Promise<import("../index.js").USyncQueryResultList[] | undefined>;
    fetchDisappearingDuration: (...jids: string[]) => Promise<import("../index.js").USyncQueryResultList[] | undefined>;
    updateProfilePicture: (jid: string, content: import("../Types/index.js").WAMediaUpload, dimensions?: {
        width: number;
        height: number;
    }) => Promise<void>;
    removeProfilePicture: (jid: string) => Promise<void>;
    updateProfileStatus: (status: string) => Promise<void>;
    updateProfileName: (name: string) => Promise<void>;
    updateBlockStatus: (jid: string, action: "block" | "unblock") => Promise<void>;
    updateDisableLinkPreviewsPrivacy: (isPreviewsDisabled: boolean) => Promise<void>;
    updateCallPrivacy: (value: import("../Types/index.js").WAPrivacyCallValue) => Promise<void>;
    updateMessagesPrivacy: (value: import("../Types/index.js").WAPrivacyMessagesValue) => Promise<void>;
    updateLastSeenPrivacy: (value: import("../Types/index.js").WAPrivacyValue) => Promise<void>;
    updateOnlinePrivacy: (value: import("../Types/index.js").WAPrivacyOnlineValue) => Promise<void>;
    updateProfilePicturePrivacy: (value: import("../Types/index.js").WAPrivacyValue) => Promise<void>;
    updateStatusPrivacy: (value: import("../Types/index.js").WAPrivacyValue) => Promise<void>;
    updateReadReceiptsPrivacy: (value: import("../Types/index.js").WAReadReceiptsValue) => Promise<void>;
    updateGroupsAddPrivacy: (value: import("../Types/index.js").WAPrivacyGroupAddValue) => Promise<void>;
    updateDefaultDisappearingMode: (duration: number) => Promise<void>;
    getBusinessProfile: (jid: string) => Promise<import("../Types/index.js").WABusinessProfile | void>;
    resyncAppState: (collections: readonly ("critical_unblock_low" | "regular_high" | "regular_low" | "critical_block" | "regular")[], isInitialSync: boolean) => Promise<void>;
    chatModify: (mod: import("../Types/index.js").ChatModification, jid: string) => Promise<void>;
    cleanDirtyBits: (type: "account_sync" | "groups", fromTimestamp?: number | string) => Promise<void>;
    addOrEditContact: (jid: string, contact: proto.SyncActionValue.IContactAction) => Promise<void>;
    removeContact: (jid: string) => Promise<void>;
    addLabel: (jid: string, labels: import("../Types/index.js").LabelActionBody) => Promise<void>;
    addChatLabel: (jid: string, labelId: string) => Promise<void>;
    removeChatLabel: (jid: string, labelId: string) => Promise<void>;
    addMessageLabel: (jid: string, messageId: string, labelId: string) => Promise<void>;
    removeMessageLabel: (jid: string, messageId: string, labelId: string) => Promise<void>;
    star: (jid: string, messages: {
        id: string;
        fromMe?: boolean;
    }[], star: boolean) => Promise<void>;
    addOrEditQuickReply: (quickReply: import("../Types/index.js").QuickReplyAction) => Promise<void>;
    removeQuickReply: (timestamp: string) => Promise<void>;
    type: "md";
    ws: import("./Client/websocket.js").WebSocketClient;
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
    user: import("../Types/index.js").Contact | undefined;
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
    wamBuffer: import("../index.js").BinaryInfo;
    waitForConnectionUpdate: (check: (u: Partial<import("../Types/index.js").ConnectionState>) => Promise<boolean | undefined>, timeoutMs?: number) => Promise<void>;
    sendWAMBuffer: (wamBuffer: Buffer) => Promise<any>;
    executeUSyncQuery: (usyncQuery: import("../index.js").USyncQuery) => Promise<import("../index.js").USyncQueryResult | undefined>;
    onWhatsApp: (...phoneNumber: string[]) => Promise<{
        jid: string;
        exists: boolean;
    }[] | undefined>;
    fetchAccountReachoutTimelock: (emitUpdate?: boolean) => Promise<import("../Types/index.js").ReachoutTimelockState>;
    fetchNewChatMessageCap: () => Promise<NewChatMessageCapInfo>;
    sendUnifiedSession: (trigger?: "login" | "pairing" | "presence" | "manual") => Promise<void>;
    getUnifiedSessionState: () => Readonly<import("../Utils/index.js").UnifiedSessionState> | undefined;
    updateServerTimeOffset: (serverTime: string | number) => void;
    skipOfflineBuffer: boolean;
};
//# sourceMappingURL=messages-recv.d.ts.map