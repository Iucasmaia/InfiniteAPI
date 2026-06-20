export type WasmAudioConfig = {
    sampleRate: number;
    channels: number;
    bitsPerSample: number;
    framesPerChunk: number;
};
export type WasmEngineCallbacks = {
    onSignalingXmpp?: (peerJid: string, callId: string, xmlPayload: Uint8Array) => void;
    onCallEvent?: (eventType: number, eventData?: string) => void;
    onVoipReady?: () => void;
    sendDataToRelay?: (data: Uint8Array, ip: string, port: number) => number;
    onLog?: (level: string, message: string) => void;
    onAudioCaptureInit?: (config: WasmAudioConfig) => void;
    onAudioCaptureStart?: () => void;
    onAudioCaptureStop?: () => void;
    onAudioPlaybackInit?: (config: WasmAudioConfig) => void;
    onAudioPlaybackStart?: () => void;
    onAudioPlaybackStop?: () => void;
    onAudioPlaybackData?: (audioData: Float32Array) => void;
    cryptoHkdf?: (key: Uint8Array, salt: Uint8Array | null, info: Uint8Array, length: number) => Uint8Array;
    hmacSha256?: (data: Uint8Array, key: Uint8Array) => Uint8Array;
};
export type WasmEngineConfig = {
    resourcesPath?: string;
    wasmPath?: string;
    wasmBinary?: Uint8Array;
    loaderCode?: string;
    workerModulesCode?: string;
    loaderModuleName?: string;
    callbacks?: WasmEngineCallbacks;
    enableLogs?: boolean;
    options?: {
        heartbeatInterval?: number;
        lobbyTimeout?: number;
        maxParticipantsScreenShare?: number;
        maxGroupSizeLongRingtone?: number;
        logLevel?: number;
    };
};
export declare class WasmEngine {
    #private;
    static registerGlobalCallbackListener: (callbackName: string, handler: (data: any) => void) => void;
    static notifyGlobalCallbackListeners: (callbackName: string, data: any) => void;
    constructor(config?: WasmEngineConfig);
    initialize: () => Promise<void>;
    isInitialized: () => boolean;
    destroy: () => void;
    initVoipStack: (selfJid: string, meUserJid: string, selfLid: string) => void;
    waitForVoipStackReady: () => Promise<void>;
    isVoipStackReady: () => boolean;
    /**
     * Place an outbound group call. Mirrors `WAWebVoipStartCall.startWAWebVoipGroupCallFromWids`
     * from the WA Web source (extracted via CDP for reference; not bundled).
     *
     * Behaviour:
     *   - Tries `this.#instance.startGroupCall(...)` first — that's the
     *     dedicated multi-party entrypoint the WASM exposes when the build
     *     supports group calls.
     *   - If `startGroupCall` is absent (older WASM builds, or the bundle
     *     bundled with this package), falls back to `startVoipCall(...)`
     *     with the participant list passed as `peers`. The WASM internally
     *     handles the rest of the SFU bring-up — `WAWebVoipGroupCallFromChat`
     *     in WA Web's source just calls `startVoipCall` with an N-element
     *     peer list and lets the engine sort it out.
     *   - If neither path works (very old WASM), throws a descriptive
     *     `Error` so the caller knows the runtime needs updating.
     *
     * The set of methods this caller relies on (`startGroupCall`,
     * `startVoipCall`) is checked dynamically. The TS bindings can't
     * promise the WASM has them — they're exposed only when the build
     * includes the multi-party stack.
     */
    startGroupCall: (options: {
        callId: string;
        participants: string[];
        isVideo?: boolean;
        /** For SFU rekey flows. Defaults to the WASM-known self JID — the WA
         *  Web source uses `meUser.toString(0)` here, NOT the first participant. */
        callCreator?: string;
        linkToken?: string;
        extraData?: Uint8Array;
    }) => unknown;
    /**
     * Register a callback for incoming video frames.
     *
     * Two paths:
     *   1. The WASM build exports `setVideoFrameCallback` (video-enabled
     *      builds). We install a translator that adapts the
     *      `globalThis.VideoFrame`-shaped object the WASM hands us into the
     *      public `VideoFrame` type and invokes the consumer's callback.
     *      Returns `true`.
     *   2. The WASM build does NOT export it. We store the callback into
     *      `#h264FrameCallback` so anything calling `_onH264Packet(...)` (a
     *      future RTP demuxer in relay-transport, or a custom path on the
     *      consumer side) can drive raw NALU delivery. Returns `false` so
     *      the consumer knows the in-tree wiring won't deliver frames
     *      automatically — they need to feed `_onH264Packet` themselves or
     *      pre-shim `globalThis.VideoFrame` before `connect()`.
     *
     * Earlier versions returned `true` unconditionally and stashed the
     * callback into a slot that nothing currently feeds — that was a silent
     * fail. The signature above makes the contract honest.
     */
    setOnVideoFrameCallback: (cb: (frame: import("../types.js").VideoFrame) => void) => boolean;
    /** @internal — call this from your RTP demuxer when a video packet arrives
     *  in builds where the WASM-side `setVideoFrameCallback` isn't exported. */
    _onH264Packet: (nalu: Uint8Array, timestamp: number, isKeyframe: boolean) => void;
    startCall: (options: {
        peerJid: string;
        peerPn: string;
        peerList?: string[];
        callId: string;
        isVideo: boolean;
        isLidCall?: boolean;
        isFromDialer?: boolean;
        extraData?: Uint8Array;
    }) => unknown;
    endCall: (reason?: number, sendTerminate?: boolean) => void;
    setMute: (muted: boolean) => number;
    updateNetworkMedium: (networkMedium: number, networkMtu?: number) => void;
    handleSignalingOffer: (msg: {
        payload: string;
        peerPlatform?: number;
        peerAppVersion?: string;
        epochId?: string;
        timestamp?: string;
        isOffline?: boolean;
        isOfferNotContact?: boolean;
        peerJid: string;
        tcToken?: Uint8Array;
    }) => void;
    handleSignalingMessage: (msg: {
        payload: string;
        peerPlatform?: string | number;
        peerAppVersion?: string;
        epochId?: string;
        timestamp?: string;
        isOffline?: boolean;
        peerJid: string;
        tcToken?: Uint8Array;
    }) => void;
    handleSignalingAck: (msg: {
        payload: string;
        ackError?: string;
        msgType?: string;
        peerJid?: string;
        extraData?: Uint8Array;
    }) => void;
    handleSignalingReceipt: (msg: {
        payload: string;
        peerJid: string;
        tcToken?: Uint8Array;
    }) => void;
    handleOnTransportMessage: (data: Uint8Array, ip: string, port: number) => void;
    updateIceRtt: (rttMs: number, relayIp: string, relayPort: number) => void;
    sendAudioData: (data: Float32Array, ptr: number) => void;
    malloc: (size: number) => number;
    free: (ptr: number) => void;
}
export default WasmEngine;
//# sourceMappingURL=instance.d.ts.map