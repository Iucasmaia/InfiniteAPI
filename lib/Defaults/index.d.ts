import { proto } from '../../WAProto/index.js';
import type { SocketConfig } from '../Types/index.js';
export declare const UNAUTHORIZED_CODES: number[];
export declare const DEFAULT_ORIGIN = "https://web.whatsapp.com";
export declare const CALL_VIDEO_PREFIX = "https://call.whatsapp.com/video/";
export declare const CALL_AUDIO_PREFIX = "https://call.whatsapp.com/voice/";
export declare const DEF_CALLBACK_PREFIX = "CB:";
export declare const DEF_TAG_PREFIX = "TAG:";
export declare const PHONE_CONNECTION_CB = "CB:Pong";
export declare const WA_ADV_ACCOUNT_SIG_PREFIX: Buffer<ArrayBuffer>;
export declare const WA_ADV_DEVICE_SIG_PREFIX: Buffer<ArrayBuffer>;
export declare const WA_ADV_HOSTED_ACCOUNT_SIG_PREFIX: Buffer<ArrayBuffer>;
export declare const WA_ADV_HOSTED_DEVICE_SIG_PREFIX: Buffer<ArrayBuffer>;
export declare const WA_DEFAULT_EPHEMERAL: number;
/** Status messages older than 24 hours are considered expired */
export declare const STATUS_EXPIRY_SECONDS: number;
/** CTWA placeholder messages older than 7 days won't be requested from phone */
export declare const PLACEHOLDER_MAX_AGE_SECONDS: number;
export declare const NOISE_MODE = "Noise_XX_25519_AESGCM_SHA256\0\0\0\0";
export declare const DICT_VERSION = 3;
export declare const KEY_BUNDLE_TYPE: Buffer<ArrayBuffer>;
export declare const NOISE_WA_HEADER: Buffer<ArrayBuffer>;
/** from: https://stackoverflow.com/questions/3809401/what-is-a-good-regular-expression-to-match-a-url */
export declare const URL_REGEX: RegExp;
export declare const WA_CERT_DETAILS: {
    SERIAL: number;
    ISSUER: string;
    PUBLIC_KEY: Buffer<ArrayBuffer>;
};
export declare const PROCESSABLE_HISTORY_TYPES: proto.HistorySync.HistorySyncType[];
export declare const DEFAULT_CONNECTION_CONFIG: SocketConfig;
/**
 * Path prefixes for non-newsletter (1:1 / group) media uploads.
 *
 * Confirmed empirically against WhatsApp Web 2.3000.x source code on
 * 2026-06-05 (via CDP `Runtime.evaluate` enumerating `'/mms/*'` string
 * literals across 50 loaded chunks). See
 * `WABA-ANDROID-RE/captures/wa-web-cdp-20260605-021821.log` for the run.
 *
 * Previous values for `sticker` and `thumbnail-link` were `/mms/image`,
 * which works because the CDN's content-typing is permissive — but it
 * tags uploads as image and breaks newsletter / channel routing on the
 * server side. The strings here match the WA Web source 1:1.
 */
export declare const MEDIA_PATH_MAP: {
    [T in MediaType]?: string;
};
/**
 * Path prefixes for media uploaded to newsletter (channel) chats.
 *
 * Confirmed empirically against WhatsApp Web 2.3000.x source code on
 * 2026-06-05 (via CDP `Runtime.evaluate` enumerating `'/newsletter/*'`
 * string literals across 50 loaded chunks). 5 of the 10 paths were
 * additionally observed live in network captures (image, video, gif,
 * ptt, sticker uploads sent from a real channel via WhatsApp Desktop).
 *
 * This matches PR #2434 (WhiskeySockets/Baileys) with the corrections
 * requested by reviewer @vinikjkkj (sticker and thumbnail-link were
 * incorrectly pointed to `-image` in the original PR; gif/ptt/ptv/
 * sticker-pack were missing entirely). Both bugs are fixed here.
 *
 * Note: `audio` exists on the server side but the WhatsApp client
 * always uploads audio to a channel as `ptt` (push-to-talk), even when
 * the source file is an arbitrary mp3. The mapping is preserved for
 * completeness in case a caller dispatches by raw mediaType.
 */
export declare const NEWSLETTER_MEDIA_PATH_MAP: {
    [T in MediaType]?: string;
};
export declare const MEDIA_HKDF_KEY_MAPPING: {
    audio: string;
    document: string;
    gif: string;
    image: string;
    ppic: string;
    product: string;
    ptt: string;
    sticker: string;
    video: string;
    'thumbnail-document': string;
    'thumbnail-image': string;
    'thumbnail-video': string;
    'thumbnail-link': string;
    'md-msg-hist': string;
    'md-app-state': string;
    'product-catalog-image': string;
    'payment-bg-image': string;
    ptv: string;
    'biz-cover-photo': string;
    'sticker-pack': string;
    'thumbnail-sticker-pack': string;
};
export type MediaType = keyof typeof MEDIA_HKDF_KEY_MAPPING;
export declare const MEDIA_KEYS: MediaType[];
/** 120s timeout for history sync stall detection, same as WA Web's handleChunkProgress / restartPausedTimer (g = 120) */
export declare const HISTORY_SYNC_PAUSED_TIMEOUT_MS = 120000;
export declare const MIN_PREKEY_COUNT = 5;
export declare const INITIAL_PREKEY_COUNT = 200;
export declare const UPLOAD_TIMEOUT = 30000;
export declare const MIN_UPLOAD_INTERVAL = 10000;
/**
 * Cache TTL configuration (in seconds)
 */
export declare const DEFAULT_CACHE_TTLS: {
    SIGNAL_STORE: number;
    MSG_RETRY: number;
    CALL_OFFER: number;
    USER_DEVICES: number;
    MSMSG_SECRET: number;
};
/**
 * Maximum cache keys per store type - prevents memory leaks
 * Based on RSocket's battle-tested configuration
 *
 * Usage: Use these limits when initializing LRU caches to prevent unbounded growth
 * Example:
 *   import { DEFAULT_CACHE_MAX_KEYS } from './Defaults'
 *   const cache = new LRUCache({ max: DEFAULT_CACHE_MAX_KEYS.SIGNAL_STORE })
 */
export declare const DEFAULT_CACHE_MAX_KEYS: {
    SIGNAL_STORE: number;
    MSG_RETRY: number;
    CALL_OFFER: number;
    USER_DEVICES: number;
    PLACEHOLDER_RESEND: number;
    LID_PER_SOCKET: number;
    LID_GLOBAL: number;
    MSMSG_SECRET: number;
};
export declare const DEFAULT_SESSION_CLEANUP_CONFIG: {
    enabled: boolean;
    intervalMs: number;
    cleanupHour: number;
    secondaryDeviceInactiveDays: number;
    primaryDeviceInactiveDays: number;
    lidOrphanHours: number;
    cleanupOnStartup: boolean;
    autoCleanCorrupted: boolean;
};
export { RETRY_BACKOFF_DELAYS, RETRY_JITTER_FACTOR } from '../Utils/retry-utils.js';
/**
 * Time constants in milliseconds for various timing calculations.
 * Used by unified session, rate limiting, and other time-based features.
 *
 * @example
 * ```typescript
 * import { TimeMs } from './Defaults'
 *
 * // Calculate 3 days in milliseconds
 * const threeDays = 3 * TimeMs.Day
 *
 * // Check if 1 week has passed
 * if (Date.now() - lastUpdate > TimeMs.Week) {
 *   // do something
 * }
 * ```
 */
export declare const TimeMs: {
    /** One second in milliseconds (1,000) */
    readonly Second: 1000;
    /** One minute in milliseconds (60,000) */
    readonly Minute: 60000;
    /** One hour in milliseconds (3,600,000) */
    readonly Hour: 3600000;
    /** One day in milliseconds (86,400,000) */
    readonly Day: 86400000;
    /** One week in milliseconds (604,800,000) */
    readonly Week: 604800000;
};
export type TimeMsKey = keyof typeof TimeMs;
//# sourceMappingURL=index.d.ts.map