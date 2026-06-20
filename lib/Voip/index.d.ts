import { EventEmitter } from 'node:events';
import { WasmEngine } from './wasm-engine/index.js';
import { CallState, type VoipSdkConfig } from './types.js';
export type { VoipSdkConfig, CallOptions, CallEvents, AudioConfig } from './types.js';
export { CallState } from './types.js';
/** A live or recently-ended call. */
export declare class ActiveCall extends EventEmitter {
    #private;
    readonly callId: string;
    private readonly engine;
    /** @internal mirrors the source path for the audio feeder */
    _audioSource: string;
    /** @internal — optional video stream configuration. When set, the engine
     *  routes inbound video frames through `_emitVideoFrame` so the caller's
     *  `'video-frame'` listener fires. */
    _videoConfig: import('./types.js').VideoConfig | null;
    /** @internal — group/link callId for the call-creator field used by
     *  `sendHeartbeat`. Populated by `_setGroupContext` when the call is a
     *  group / call-link join. */
    _callCreator: string | null;
    constructor(callId: string, engine: WasmEngine, durationMs: number);
    /** @internal — mark this call as a group/link call and provide the
     *  socket reference so the heartbeat loop can fire. Heartbeats start
     *  automatically on `connected` and stop on `ended`. */
    _setGroupContext: (callCreator: string, sock: {
        sendHeartbeat?: (callId: string, callCreator: string) => Promise<void>;
    }) => void;
    get state(): CallState;
    end: () => void;
    mute: (muted: boolean) => void;
    waitForEnd: () => Promise<string>;
    /** @internal — called by VoipClient on WASM call-state change */
    _updateState: (state: number) => void;
    /** @internal */
    _emitAudio: (pcm: Float32Array) => void;
    /** @internal — surface a video frame to the consumer. The engine wraps
     *  the raw H.264 NAL units from RTP (when `format === 'h264-raw'`) or
     *  delivers an already-decoded YUV420P / RGBA buffer when the consumer
     *  asked for decoding. */
    _emitVideoFrame: (frame: import("./types.js").VideoFrame) => void;
    /** @internal */
    _forceEnd: (reason: string) => void;
}
/** Top-level client. Connects to WhatsApp and lets you place calls. */
export declare class VoipClient extends EventEmitter {
    #private;
    constructor(config: VoipSdkConfig);
    /**
     * Connect to WhatsApp and bring up the WASM VoIP stack.
     *
     * Two modes:
     *  - **Embedded** (`config.socket` provided): skips auth/QR; reuses the
     *    caller's socket. Returns once the WASM engine is up.
     *  - **Standalone** (`config.authDir` provided): creates its own Baileys
     *    socket, prints QR on first run, waits for connection.
     */
    connect: () => Promise<void>;
    /**
     * Place an outbound voice (or video) call.
     *
     * Pass `opts.video` to receive the remote peer's video frames via the
     * `'video-frame'` event on the returned `ActiveCall`. See `VideoConfig`
     * for the available output formats. Omitting `opts.video` means the call
     * is treated as voice-only (matching the SheIITear baseline).
     */
    call: (phoneNumber: string, opts?: {
        audioSource?: string;
        durationMs?: number;
        video?: import("./types.js").VideoConfig;
    }) => Promise<ActiveCall>;
    /**
     * Create a new call link. Returns the token + the `https://call.whatsapp.com/...`
     * URL the recipient can use to join.
     *
     * Delegates to the fork's socket-level `createCallLink` (shipped in
     * PR #245). Throws if the embedded socket doesn't expose it.
     */
    createLink: (media?: "voice" | "video") => Promise<{
        token: string;
        url: string;
    }>;
    /**
     * Query an existing call link's metadata (creator, current participants,
     * media type, etc.) without joining.
     */
    queryLink: (token: string, media?: "voice" | "video") => Promise<unknown>;
    /**
     * Join an existing call link. Returns immediately after the signaling
     * round-trip — the call lifecycle then flows through `'incoming'` /
     * `ActiveCall` events the same way a regular call does.
     *
     * Future-work note: the WASM engine still needs `startGroupCall(...)`
     * (or equivalent) to be wired for the inbound audio mixer to engage.
     * For now this primes the signaling side and emits a `'group-joined'`
     * event so the caller knows the join succeeded at the protocol layer.
     */
    joinLink: (token: string, media?: "voice" | "video") => Promise<{
        token: string;
    }>;
    /**
     * Send a manual heartbeat for an active group/link call. Most consumers
     * won't need this — `ActiveCall` runs an internal heartbeat loop once
     * the call enters the `Active` state. Exposed for advanced cases (manual
     * keep-alive on stale sessions, debugging the protocol, etc.).
     */
    sendHeartbeat: (callId: string, callCreator: string) => Promise<void>;
    /**
     * Place an outbound GROUP call to a list of participants.
     *
     * Drives `wasm-engine.startGroupCall` which mirrors WhatsApp Web's
     * `WAWebVoipStartCall.startWAWebVoipGroupCallFromWids` — extracted via
     * CDP for reference; not bundled. The engine picks between the
     * dedicated `startGroupCall` WASM binding (when present) and the
     * generic `startVoipCall` with an N-element peer list (the path
     * WA Web itself falls back to). See the JSDoc on
     * `WasmEngine.startGroupCall` for the routing details.
     *
     * Participants should be passed as LID-form JIDs (`<number>@lid`) when
     * possible — that's what the WASM SFU bring-up expects. Bare phone
     * numbers are resolved by the signaling layer the same way `call()` does.
     *
     * `opts.video` opts into video frame delivery on the returned
     * `ActiveCall` (same shape as 1:1 `call()`).
     */
    groupCall: (participants: string[], opts?: {
        audioSource?: string;
        durationMs?: number;
        video?: import("./types.js").VideoConfig;
        linkToken?: string;
    }) => Promise<ActiveCall>;
    /** Tear down the WhatsApp socket and release resources. */
    disconnect: () => void;
}
//# sourceMappingURL=index.d.ts.map