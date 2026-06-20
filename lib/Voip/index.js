var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _ActiveCall_state, _ActiveCall_endResolver, _ActiveCall_endPromise, _ActiveCall_endTimer, _ActiveCall_ended, _ActiveCall_heartbeatTimer, _ActiveCall_socketForHeartbeat, _ActiveCall_maybeStartHeartbeat, _VoipClient_config, _VoipClient_engine, _VoipClient_relay, _VoipClient_signaling, _VoipClient_sock, _VoipClient_activeCall, _VoipClient_baileys, _VoipClient_seenIncomingIds, _VoipClient_ownsSocket, _VoipClient_capturePtr, _VoipClient_captureChunkBytes, _VoipClient_captureSampleRate, _VoipClient_captureChannels, _VoipClient_captureFramesPerChunk, _VoipClient_feeder, _VoipClient_attachCallLifecycle, _VoipClient_initEngineWithSocket, _VoipClient_cbCallHandler, _VoipClient_cbReceiptHandler, _VoipClient_wireIncomingCallListener, _VoipClient_makeIncomingHandle, _VoipClient_handleCallEvent, _VoipClient_handleAudioCaptureInit, _VoipClient_handleAudioCaptureStart, _VoipClient_handleAudioCaptureStop;
/**
 * VoIP module — WhatsApp voice calling for Node.js.
 *
 * Wraps WhatsApp Web's official VoIP WASM stack and routes signaling through
 * the fork's own socket. Public surface:
 *
 *   const client = new VoipClient({ authDir })
 *   await client.connect()
 *   const call = await client.call("12345678901", { audioSource: "./hi.mp3" })
 *
 * `@roamhq/wrtc` + `qrcode-terminal` are declared as OPTIONAL peer
 * dependencies so the published package doesn't force ~50MB of native WebRTC
 * bindings on users who never place a call. `ffmpeg` on PATH is also
 * required for MP3/WAV source decoding.
 *
 * The `whatsapp.wasm` / `loader.js` / `worker-modules.js` blobs in
 * `assets/wasm/` originate from WhatsApp Web's own VoIP module
 * (Meta-authored binaries).
 */
import { createHmac, randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { resolve } from 'node:path';
import { SignalingBridge } from './signaling/index.js';
import { WasmEngine } from './wasm-engine/index.js';
import { AudioFeeder } from './audio-feeder.js';
import { RelayRtcTransport } from './relay-transport.js';
import { CallState } from './types.js';
export { CallState } from './types.js';
// Direct imports from our own InfiniteAPI codebase — the third-party
// version lazy-loaded `@whiskeysockets/baileys` as a peer dep. Inside the fork
// we ship as part of the same package, so static imports are cleaner and
// remove the runtime `import()` ceremony.
import makeWASocket from '../Socket/index.js';
import { DisconnectReason } from '../Types/index.js';
import { useMultiFileAuthState } from '../Utils/use-multi-file-auth-state.js';
const SHA256_LEN = 32;
const loadBaileys = async () => ({
    default: makeWASocket,
    makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
});
const toBareJid = (jid) => {
    if (!jid)
        return jid;
    const at = jid.indexOf('@');
    if (at < 0)
        return jid;
    const user = jid.slice(0, at).split(':')[0];
    return `${user}@${jid.slice(at + 1)}`;
};
const computeHkdf = (key, salt, info, length) => {
    const effectiveSalt = salt && salt.length > 0 ? Buffer.from(salt) : Buffer.alloc(SHA256_LEN, 0);
    const prk = createHmac('sha256', effectiveSalt).update(key).digest();
    const blocks = Math.ceil(length / SHA256_LEN);
    const okm = Buffer.alloc(blocks * SHA256_LEN);
    let prev = Buffer.alloc(0);
    for (let i = 1; i <= blocks; i += 1) {
        prev = createHmac('sha256', prk)
            .update(prev)
            .update(info)
            .update(Buffer.from([i]))
            .digest();
        prev.copy(okm, (i - 1) * SHA256_LEN);
    }
    return new Uint8Array(okm.buffer, okm.byteOffset, length);
};
const computeHmacSha256 = (data, key) => {
    const result = createHmac('sha256', Buffer.from(key)).update(data).digest();
    return new Uint8Array(result.buffer, result.byteOffset, result.byteLength);
};
const isCallReceiptNode = (node) => {
    if (node?.tag !== 'receipt')
        return false;
    const child = Array.isArray(node.content) ? node.content[0] : null;
    return !!(child?.attrs?.['call-id'] || child?.attrs?.call_id);
};
/** A live or recently-ended call. */
export class ActiveCall extends EventEmitter {
    constructor(callId, engine, durationMs) {
        super();
        this.callId = callId;
        this.engine = engine;
        _ActiveCall_state.set(this, CallState.Idle);
        _ActiveCall_endResolver.set(this, void 0);
        _ActiveCall_endPromise.set(this, void 0);
        _ActiveCall_endTimer.set(this, null);
        _ActiveCall_ended.set(this, false
        /** @internal mirrors the source path for the audio feeder */
        );
        /** @internal mirrors the source path for the audio feeder */
        this._audioSource = 'silence';
        /** @internal — optional video stream configuration. When set, the engine
         *  routes inbound video frames through `_emitVideoFrame` so the caller's
         *  `'video-frame'` listener fires. */
        this._videoConfig = null;
        /** @internal — group/link callId for the call-creator field used by
         *  `sendHeartbeat`. Populated by `_setGroupContext` when the call is a
         *  group / call-link join. */
        this._callCreator = null;
        /** @internal — heartbeat timer used for group/link calls. Cleared on end. */
        _ActiveCall_heartbeatTimer.set(this, null
        /** @internal — bound socket reference for the heartbeat send. Set by
         *  `_setGroupContext`. */
        );
        /** @internal — bound socket reference for the heartbeat send. Set by
         *  `_setGroupContext`. */
        _ActiveCall_socketForHeartbeat.set(this, null);
        /** @internal — mark this call as a group/link call and provide the
         *  socket reference so the heartbeat loop can fire. Heartbeats start
         *  automatically on `connected` and stop on `ended`. */
        this._setGroupContext = (callCreator, sock) => {
            this._callCreator = callCreator;
            __classPrivateFieldSet(this, _ActiveCall_socketForHeartbeat, sock, "f");
        };
        this.end = () => {
            if (__classPrivateFieldGet(this, _ActiveCall_ended, "f"))
                return;
            // Drive the engine end first; it normally emits a state change which
            // triggers _forceEnd. We then call _forceEnd ourselves so a local
            // hangup ALWAYS wakes any awaiter on waitForEnd(), even when the
            // engine never reports state back. _forceEnd is idempotent.
            try {
                this.engine.endCall(0, true);
            }
            catch { }
            this._forceEnd('ended');
        };
        this.mute = (muted) => {
            try {
                this.engine.setMute(muted);
            }
            catch { }
        };
        this.waitForEnd = () => __classPrivateFieldGet(this, _ActiveCall_endPromise, "f");
        /** @internal — called by VoipClient on WASM call-state change */
        this._updateState = (state) => {
            __classPrivateFieldSet(this, _ActiveCall_state, state, "f");
            if (state === CallState.PreacceptReceived)
                this.emit('ringing');
            else if (state === CallState.Active) {
                this.emit('connected');
                // F2: start the per-call heartbeat loop once we have a working session
                // for group/link calls. WhatsApp Web sends one heartbeat every ~10s
                // while a multi-party call is active; without it the server treats
                // the participant as having timed out after ~30s.
                __classPrivateFieldGet(this, _ActiveCall_maybeStartHeartbeat, "f").call(this);
            }
            else if (state === CallState.Idle || state === CallState.Ending) {
                this._forceEnd('ended');
            }
        };
        /** @internal */
        this._emitAudio = (pcm) => {
            this.emit('audio', pcm);
        };
        /** @internal — surface a video frame to the consumer. The engine wraps
         *  the raw H.264 NAL units from RTP (when `format === 'h264-raw'`) or
         *  delivers an already-decoded YUV420P / RGBA buffer when the consumer
         *  asked for decoding. */
        this._emitVideoFrame = (frame) => {
            if (!this._videoConfig)
                return; // consumer opted out of video
            this.emit('video-frame', frame);
        };
        /** @internal */
        this._forceEnd = (reason) => {
            if (__classPrivateFieldGet(this, _ActiveCall_ended, "f"))
                return;
            __classPrivateFieldSet(this, _ActiveCall_ended, true, "f");
            if (__classPrivateFieldGet(this, _ActiveCall_endTimer, "f")) {
                clearTimeout(__classPrivateFieldGet(this, _ActiveCall_endTimer, "f"));
                __classPrivateFieldSet(this, _ActiveCall_endTimer, null, "f");
            }
            if (__classPrivateFieldGet(this, _ActiveCall_heartbeatTimer, "f")) {
                clearInterval(__classPrivateFieldGet(this, _ActiveCall_heartbeatTimer, "f"));
                __classPrivateFieldSet(this, _ActiveCall_heartbeatTimer, null, "f");
            }
            this.emit('ended', reason);
            __classPrivateFieldGet(this, _ActiveCall_endResolver, "f").call(this, reason);
        };
        /** @internal — start a 10s heartbeat loop. Idempotent (no-op if already
         *  running, or if this isn't a group call, or if the socket doesn't
         *  expose `sendHeartbeat`). */
        _ActiveCall_maybeStartHeartbeat.set(this, () => {
            if (__classPrivateFieldGet(this, _ActiveCall_heartbeatTimer, "f"))
                return;
            if (!this._callCreator)
                return; // not a group/link call
            if (!__classPrivateFieldGet(this, _ActiveCall_socketForHeartbeat, "f")?.sendHeartbeat)
                return;
            const sock = __classPrivateFieldGet(this, _ActiveCall_socketForHeartbeat, "f");
            const callCreator = this._callCreator;
            const callId = this.callId;
            // Fire one immediately, then every 10s. WhatsApp Web's interval is
            // configured via the WASM (`heartbeat_interval_s`, default 30s in the
            // engine wrapper) — we pick 10s for safety against tight server timeouts
            // seen in practice on group calls.
            const fire = () => {
                sock.sendHeartbeat?.(callId, callCreator).catch(() => {
                    // network blips. emit() on `error` in Node throws when there are no
                    // listeners — guard so a flaky heartbeat doesn't crash the host.
                    if (this.listenerCount('error') > 0) {
                        this.emit('error', new Error(`heartbeat failed for ${callId}`));
                    }
                });
            };
            fire();
            __classPrivateFieldSet(this, _ActiveCall_heartbeatTimer, setInterval(fire, 10000), "f");
        });
        __classPrivateFieldSet(this, _ActiveCall_endPromise, new Promise(res => {
            __classPrivateFieldSet(this, _ActiveCall_endResolver, res, "f");
        }), "f");
        if (durationMs > 0) {
            __classPrivateFieldSet(this, _ActiveCall_endTimer, setTimeout(() => this.end(), durationMs), "f");
        }
    }
    get state() {
        return __classPrivateFieldGet(this, _ActiveCall_state, "f");
    }
}
_ActiveCall_state = new WeakMap(), _ActiveCall_endResolver = new WeakMap(), _ActiveCall_endPromise = new WeakMap(), _ActiveCall_endTimer = new WeakMap(), _ActiveCall_ended = new WeakMap(), _ActiveCall_heartbeatTimer = new WeakMap(), _ActiveCall_socketForHeartbeat = new WeakMap(), _ActiveCall_maybeStartHeartbeat = new WeakMap();
/** Top-level client. Connects to WhatsApp and lets you place calls. */
export class VoipClient extends EventEmitter {
    constructor(config) {
        super();
        _VoipClient_config.set(this, void 0);
        _VoipClient_engine.set(this, null);
        _VoipClient_relay.set(this, null);
        _VoipClient_signaling.set(this, null);
        _VoipClient_sock.set(this, null);
        _VoipClient_activeCall.set(this, null);
        _VoipClient_baileys.set(this, null
        /** Tracks incoming call IDs we have already surfaced as `'incoming'` to dedupe
         *  re-emits when the same `<call>` stanza is delivered with multiple children
         *  (e.g. offer + transport in the same node). */
        );
        /** Tracks incoming call IDs we have already surfaced as `'incoming'` to dedupe
         *  re-emits when the same `<call>` stanza is delivered with multiple children
         *  (e.g. offer + transport in the same node). */
        _VoipClient_seenIncomingIds.set(this, new Set()
        /** True when we created the underlying socket (standalone mode). Embedded
         *  mode passes a socket in; we must NOT close it on disconnect because the
         *  caller still needs it for messaging. */
        );
        /** True when we created the underlying socket (standalone mode). Embedded
         *  mode passes a socket in; we must NOT close it on disconnect because the
         *  caller still needs it for messaging. */
        _VoipClient_ownsSocket.set(this, void 0);
        // Capture state populated when WASM negotiates audio params
        _VoipClient_capturePtr.set(this, 0);
        _VoipClient_captureChunkBytes.set(this, 0);
        _VoipClient_captureSampleRate.set(this, 16000);
        _VoipClient_captureChannels.set(this, 1);
        _VoipClient_captureFramesPerChunk.set(this, 320);
        _VoipClient_feeder.set(this, null);
        /**
         * @internal — wire common call lifecycle: clear `#activeCall` when this
         * call ends, and free its incoming-id dedupe slot. Idempotent: safe even
         * if the call was already torn down before the listener fires.
         */
        _VoipClient_attachCallLifecycle.set(this, (call, incomingId) => {
            call.once('ended', () => {
                if (__classPrivateFieldGet(this, _VoipClient_activeCall, "f") === call)
                    __classPrivateFieldSet(this, _VoipClient_activeCall, null, "f");
                if (incomingId)
                    __classPrivateFieldGet(this, _VoipClient_seenIncomingIds, "f").delete(incomingId);
            });
        }
        /**
         * Connect to WhatsApp and bring up the WASM VoIP stack.
         *
         * Two modes:
         *  - **Embedded** (`config.socket` provided): skips auth/QR; reuses the
         *    caller's socket. Returns once the WASM engine is up.
         *  - **Standalone** (`config.authDir` provided): creates its own Baileys
         *    socket, prints QR on first run, waits for connection.
         */
        );
        /**
         * Connect to WhatsApp and bring up the WASM VoIP stack.
         *
         * Two modes:
         *  - **Embedded** (`config.socket` provided): skips auth/QR; reuses the
         *    caller's socket. Returns once the WASM engine is up.
         *  - **Standalone** (`config.authDir` provided): creates its own Baileys
         *    socket, prints QR on first run, waits for connection.
         */
        this.connect = async () => {
            // Embedded mode: socket already provided by the caller. Skip the
            // auth/QR ceremony and go straight to wiring the WASM stack.
            if (__classPrivateFieldGet(this, _VoipClient_config, "f").socket) {
                __classPrivateFieldSet(this, _VoipClient_sock, __classPrivateFieldGet(this, _VoipClient_config, "f").socket, "f");
                await __classPrivateFieldGet(this, _VoipClient_initEngineWithSocket, "f").call(this);
                __classPrivateFieldGet(this, _VoipClient_wireIncomingCallListener, "f").call(this);
                return;
            }
            __classPrivateFieldSet(this, _VoipClient_baileys, await loadBaileys(), "f");
            const { useMultiFileAuthState, default: makeWASocket, DisconnectReason } = __classPrivateFieldGet(this, _VoipClient_baileys, "f");
            const makeSocket = makeWASocket ?? __classPrivateFieldGet(this, _VoipClient_baileys, "f").makeWASocket ?? __classPrivateFieldGet(this, _VoipClient_baileys, "f");
            // `authDir` is required in standalone mode — the constructor guard above
            // already rejected configs that have neither `authDir` nor `socket`, so
            // by the time we get here the non-null assertion is sound.
            const authDir = resolve(__classPrivateFieldGet(this, _VoipClient_config, "f").authDir);
            const { state, saveCreds } = await useMultiFileAuthState(authDir);
            const silentLogger = {
                level: 'silent',
                child: () => silentLogger,
                trace: () => { },
                debug: () => { },
                info: () => { },
                warn: () => { },
                error: () => { },
                fatal: () => { }
            };
            const createSocket = () => makeSocket({
                auth: state,
                emitOwnEvents: true,
                logger: silentLogger
            });
            // Connect with auto-reconnect on the post-QR 515 stream-error path.
            await new Promise((resolveOpen, rejectOpen) => {
                let opened = false;
                let retries = 0;
                const maxRetries = 5;
                // Scoped handler: we install OUR uncaughtException listener and detach
                // exactly that one on cleanup. Earlier versions called
                // process.removeAllListeners("uncaughtException") which would also
                // remove handlers installed by the host application's framework/APM —
                // hostile behaviour for a library.
                let installedHandler = null;
                const detachHandler = () => {
                    if (installedHandler) {
                        process.off('uncaughtException', installedHandler);
                        installedHandler = null;
                    }
                };
                const connectSocket = () => {
                    __classPrivateFieldSet(this, _VoipClient_sock, createSocket(), "f");
                    __classPrivateFieldGet(this, _VoipClient_sock, "f").ev.on('creds.update', saveCreds);
                    detachHandler();
                    installedHandler = (err) => {
                        const code = err?.output?.statusCode ?? err?.data?.attrs?.code;
                        if ((code === 515 || code === '515') && !opened && retries < maxRetries) {
                            retries += 1;
                            setTimeout(connectSocket, 1500);
                        }
                        else if (!opened) {
                            rejectOpen(err);
                        }
                    };
                    process.on('uncaughtException', installedHandler);
                    __classPrivateFieldGet(this, _VoipClient_sock, "f").ev.on('connection.update', (update) => {
                        if (update.qr) {
                            void import('qrcode-terminal')
                                .then(qrt => (qrt.default ?? qrt).generate(update.qr, { small: true }))
                                .catch(() => {
                                console.log('Scan this QR code in WhatsApp > Linked Devices:');
                                console.log(update.qr);
                            });
                        }
                        if (update.connection === 'open') {
                            opened = true;
                            detachHandler();
                            resolveOpen();
                            return;
                        }
                        if (update.connection === 'close' && !opened) {
                            const statusCode = update.lastDisconnect?.error?.output?.statusCode;
                            const shouldReconnect = statusCode === 515 || statusCode === DisconnectReason?.restartRequired;
                            if (shouldReconnect && retries < maxRetries) {
                                retries += 1;
                                setTimeout(connectSocket, 1000);
                            }
                            else {
                                detachHandler();
                                rejectOpen(update.lastDisconnect?.error ?? new Error('socket closed before open'));
                            }
                        }
                    });
                };
                connectSocket();
            });
            await __classPrivateFieldGet(this, _VoipClient_initEngineWithSocket, "f").call(this);
            __classPrivateFieldGet(this, _VoipClient_wireIncomingCallListener, "f").call(this);
        };
        /**
         * Spin up the WASM engine + RTP transport + signaling bridge against the
         * already-attached `this.#sock`. Extracted from the original `connect()`
         * body so it can be reused by the embedded-mode path (which skips the
         * QR/auth ceremony and goes straight here).
         */
        _VoipClient_initEngineWithSocket.set(this, async () => {
            __classPrivateFieldSet(this, _VoipClient_signaling, new SignalingBridge({ sock: __classPrivateFieldGet(this, _VoipClient_sock, "f") }), "f");
            await __classPrivateFieldGet(this, _VoipClient_signaling, "f").init();
            __classPrivateFieldSet(this, _VoipClient_relay, new RelayRtcTransport({
                onTransportMessage: (data, ip, port) => __classPrivateFieldGet(this, _VoipClient_engine, "f")?.handleOnTransportMessage(data, ip, port),
                onIceRtt: (rttMs, ip, port) => __classPrivateFieldGet(this, _VoipClient_engine, "f")?.updateIceRtt(rttMs, ip, port)
            }), "f");
            __classPrivateFieldSet(this, _VoipClient_engine, new WasmEngine({
                callbacks: {
                    onSignalingXmpp: (peerJid, callId, xmlPayload) => __classPrivateFieldGet(this, _VoipClient_signaling, "f").sendSignaling(peerJid, callId, xmlPayload),
                    onCallEvent: (eventType, eventData) => __classPrivateFieldGet(this, _VoipClient_handleCallEvent, "f").call(this, eventType, eventData),
                    sendDataToRelay: (data, ip, port) => __classPrivateFieldGet(this, _VoipClient_relay, "f").send(data, ip, port),
                    onAudioCaptureInit: config => __classPrivateFieldGet(this, _VoipClient_handleAudioCaptureInit, "f").call(this, config),
                    onAudioCaptureStart: () => __classPrivateFieldGet(this, _VoipClient_handleAudioCaptureStart, "f").call(this),
                    onAudioCaptureStop: () => __classPrivateFieldGet(this, _VoipClient_handleAudioCaptureStop, "f").call(this),
                    onAudioPlaybackData: audioData => __classPrivateFieldGet(this, _VoipClient_activeCall, "f")?._emitAudio(audioData),
                    cryptoHkdf: computeHkdf,
                    hmacSha256: computeHmacSha256
                }
            }), "f");
            await __classPrivateFieldGet(this, _VoipClient_engine, "f").initialize();
            __classPrivateFieldGet(this, _VoipClient_signaling, "f").attachEngine(__classPrivateFieldGet(this, _VoipClient_engine, "f"));
            const selfPnJid = __classPrivateFieldGet(this, _VoipClient_sock, "f").authState.creds.me?.id;
            const selfLidJid = __classPrivateFieldGet(this, _VoipClient_sock, "f").authState.creds.me?.lid;
            __classPrivateFieldGet(this, _VoipClient_engine, "f").initVoipStack(selfPnJid, toBareJid(selfPnJid), selfLidJid);
            await __classPrivateFieldGet(this, _VoipClient_engine, "f").waitForVoipStackReady();
            try {
                __classPrivateFieldGet(this, _VoipClient_engine, "f").updateNetworkMedium(2, 0);
            }
            catch { }
            // Direct binary-node hooks used for incoming stanza processing. In embedded
            // mode the socket exposes `.ws` (the underlying ws.WebSocket); in standalone
            // mode it's the socket the client just built. Both expose the same handle.
            // Refs are stored so `disconnect()` can detach them — otherwise a stanza
            // arriving after teardown would run against `#engine = null`.
            if (__classPrivateFieldGet(this, _VoipClient_sock, "f").ws?.on) {
                __classPrivateFieldSet(this, _VoipClient_cbCallHandler, (node) => {
                    __classPrivateFieldGet(this, _VoipClient_signaling, "f")?.processIncomingCall(node, __classPrivateFieldGet(this, _VoipClient_engine, "f"), __classPrivateFieldGet(this, _VoipClient_activeCall, "f")?.callId ?? '');
                }, "f");
                __classPrivateFieldSet(this, _VoipClient_cbReceiptHandler, (node) => {
                    if (!isCallReceiptNode(node))
                        return;
                    __classPrivateFieldGet(this, _VoipClient_signaling, "f")?.processIncomingReceipt(node, __classPrivateFieldGet(this, _VoipClient_engine, "f"), __classPrivateFieldGet(this, _VoipClient_activeCall, "f")?.callId ?? '');
                }, "f");
                __classPrivateFieldGet(this, _VoipClient_sock, "f").ws.on('CB:call', __classPrivateFieldGet(this, _VoipClient_cbCallHandler, "f"));
                __classPrivateFieldGet(this, _VoipClient_sock, "f").ws.on('CB:receipt', __classPrivateFieldGet(this, _VoipClient_cbReceiptHandler, "f"));
            }
        });
        _VoipClient_cbCallHandler.set(this, null);
        _VoipClient_cbReceiptHandler.set(this, null
        /**
         * Subscribe to the socket's `'call'` event. When an offer arrives that we
         * haven't already surfaced (dedupe by call-id), construct an
         * `IncomingCallHandle` and emit `'incoming'` so the caller can
         * `accept()` / `reject()`.
         *
         * Other call statuses (`terminate`, `transport`, `relaylatency`, etc.)
         * are forwarded into the engine via the SignalingBridge — this listener
         * only cares about the `offer` first-touch.
         */
        );
        /**
         * Subscribe to the socket's `'call'` event. When an offer arrives that we
         * haven't already surfaced (dedupe by call-id), construct an
         * `IncomingCallHandle` and emit `'incoming'` so the caller can
         * `accept()` / `reject()`.
         *
         * Other call statuses (`terminate`, `transport`, `relaylatency`, etc.)
         * are forwarded into the engine via the SignalingBridge — this listener
         * only cares about the `offer` first-touch.
         */
        _VoipClient_wireIncomingCallListener.set(this, () => {
            if (!__classPrivateFieldGet(this, _VoipClient_sock, "f")?.ev?.on)
                return;
            __classPrivateFieldGet(this, _VoipClient_sock, "f").ev.on('call', (calls) => {
                for (const call of calls) {
                    if (call?.status !== 'offer')
                        continue;
                    const callId = String(call.id ?? '');
                    if (!callId || __classPrivateFieldGet(this, _VoipClient_seenIncomingIds, "f").has(callId))
                        continue;
                    __classPrivateFieldGet(this, _VoipClient_seenIncomingIds, "f").add(callId);
                    const incoming = __classPrivateFieldGet(this, _VoipClient_makeIncomingHandle, "f").call(this, call);
                    this.emit('incoming', incoming);
                }
            });
        }
        /**
         * Build an `IncomingCallHandle` for an `'offer'` event from the socket.
         * `accept()` performs the signaling stanza + sets up the active call;
         * `reject()` just sends the rejection signaling and removes the dedupe
         * marker so a re-offer with the same id can be surfaced again.
         */
        );
        /**
         * Build an `IncomingCallHandle` for an `'offer'` event from the socket.
         * `accept()` performs the signaling stanza + sets up the active call;
         * `reject()` just sends the rejection signaling and removes the dedupe
         * marker so a re-offer with the same id can be surfaced again.
         */
        _VoipClient_makeIncomingHandle.set(this, (call) => {
            const self = this;
            const callId = String(call.id ?? '');
            const from = String(call.from ?? '');
            const fromPn = call.callerPn ?? undefined;
            const isVideo = !!call.isVideo;
            const isGroup = !!call.isGroup;
            const arrivedAt = call.date instanceof Date ? call.date : new Date();
            return {
                callId,
                from,
                fromPn,
                isVideo,
                isGroup,
                arrivedAt,
                accept: async (opts) => {
                    if (!__classPrivateFieldGet(self, _VoipClient_sock, "f")?.acceptCall) {
                        throw new Error('Socket does not expose acceptCall — is the fork’s call signaling wired up?');
                    }
                    // Pre-accept first (acknowledges ringing without committing audio
                    // path yet), then accept proper. Matches what WA Web does on
                    // incoming-call answer.
                    if (__classPrivateFieldGet(self, _VoipClient_sock, "f").preacceptCall) {
                        await __classPrivateFieldGet(self, _VoipClient_sock, "f").preacceptCall(callId, from, isVideo);
                    }
                    await __classPrivateFieldGet(self, _VoipClient_sock, "f").acceptCall(callId, from, isVideo);
                    // Spin up an ActiveCall and hand it back. The engine was already
                    // initialised in `connect()`; we just need to register the call id
                    // so audio playback / video frame dispatch routes through it.
                    const active = new ActiveCall(callId, __classPrivateFieldGet(self, _VoipClient_engine, "f"), opts?.durationMs ?? 0);
                    active._audioSource = opts?.audioSource ?? 'silence';
                    // F3: opt into video frame delivery on accept.
                    if (opts?.video) {
                        active._videoConfig = opts.video;
                        // Bridge engine → call: install the frame callback so frames the
                        // engine pulls off the wire reach `_emitVideoFrame`.
                        __classPrivateFieldGet(self, _VoipClient_engine, "f").setOnVideoFrameCallback(frame => active._emitVideoFrame(frame));
                    }
                    // F2: for group/link offers, wire the heartbeat context so the
                    // ActiveCall starts pinging once it reaches `Active` state.
                    if (isGroup) {
                        active._setGroupContext(from, __classPrivateFieldGet(self, _VoipClient_sock, "f"));
                    }
                    __classPrivateFieldSet(self, _VoipClient_activeCall, active, "f");
                    __classPrivateFieldGet(self, _VoipClient_attachCallLifecycle, "f").call(self, active, callId);
                    return active;
                },
                reject: async (reason) => {
                    if (!__classPrivateFieldGet(self, _VoipClient_sock, "f")?.rejectCall) {
                        throw new Error('Socket does not expose rejectCall — is the fork’s call signaling wired up?');
                    }
                    await __classPrivateFieldGet(self, _VoipClient_sock, "f").rejectCall(callId, from);
                    // Allow a re-offer with the same id to surface again (the server
                    // sometimes redelivers an offer when the recipient ignored the
                    // first attempt).
                    __classPrivateFieldGet(self, _VoipClient_seenIncomingIds, "f").delete(callId);
                    if (reason) {
                        // Surface as an `ended` event semantically — useful for logging.
                        self.emit('rejected', { callId, reason });
                    }
                }
            };
        }
        /**
         * Place an outbound voice (or video) call.
         *
         * Pass `opts.video` to receive the remote peer's video frames via the
         * `'video-frame'` event on the returned `ActiveCall`. See `VideoConfig`
         * for the available output formats. Omitting `opts.video` means the call
         * is treated as voice-only (matching the SheIITear baseline).
         */
        );
        /**
         * Place an outbound voice (or video) call.
         *
         * Pass `opts.video` to receive the remote peer's video frames via the
         * `'video-frame'` event on the returned `ActiveCall`. See `VideoConfig`
         * for the available output formats. Omitting `opts.video` means the call
         * is treated as voice-only (matching the SheIITear baseline).
         */
        this.call = async (phoneNumber, opts = {}) => {
            if (!__classPrivateFieldGet(this, _VoipClient_engine, "f") || !__classPrivateFieldGet(this, _VoipClient_signaling, "f"))
                throw new Error('Not connected. Call connect() first.');
            if (__classPrivateFieldGet(this, _VoipClient_activeCall, "f"))
                throw new Error('A call is already active.');
            const targetNumber = phoneNumber.replace(/\D/g, '');
            const targetPnJid = `${targetNumber}@s.whatsapp.net`;
            const durationMs = opts.durationMs ?? 120000;
            const audioSource = opts.audioSource ?? 'silence';
            const peerLid = await __classPrivateFieldGet(this, _VoipClient_signaling, "f").resolveLid(targetPnJid);
            if (!peerLid)
                throw new Error(`Could not resolve LID for ${targetPnJid}`);
            for (const jid of [targetPnJid, peerLid]) {
                try {
                    await __classPrivateFieldGet(this, _VoipClient_sock, "f").presenceSubscribe(jid);
                }
                catch { }
            }
            await new Promise(r => setTimeout(r, 750));
            const peerDeviceJids = await __classPrivateFieldGet(this, _VoipClient_signaling, "f").discoverPeerDevices(peerLid);
            const deviceList = peerDeviceJids.length ? peerDeviceJids : [toBareJid(peerLid)];
            await __classPrivateFieldGet(this, _VoipClient_signaling, "f").ensureSessionsForPeers(deviceList);
            await new Promise(r => setTimeout(r, 500));
            await __classPrivateFieldGet(this, _VoipClient_signaling, "f").issueTcToken(peerLid);
            const tcToken = await __classPrivateFieldGet(this, _VoipClient_signaling, "f").ensureTcToken(peerLid, targetPnJid);
            const callId = ('00' + randomBytes(16).toString('hex').slice(2)).toUpperCase();
            const call = new ActiveCall(callId, __classPrivateFieldGet(this, _VoipClient_engine, "f"), durationMs);
            call._audioSource = audioSource;
            __classPrivateFieldSet(this, _VoipClient_activeCall, call, "f");
            __classPrivateFieldGet(this, _VoipClient_attachCallLifecycle, "f").call(this, call);
            // F3: surface video config so the call's `'video-frame'` listener gets
            // engaged when the WASM delivers a frame. `isVideo` on `startCall` tells
            // the engine to negotiate the video codec (H.264/H.265/AV1) with the peer.
            if (opts.video) {
                call._videoConfig = opts.video;
                // Bridge engine → call: install the frame callback so frames the
                // engine pulls off the wire reach `_emitVideoFrame`.
                __classPrivateFieldGet(this, _VoipClient_engine, "f").setOnVideoFrameCallback(frame => call._emitVideoFrame(frame));
            }
            try {
                __classPrivateFieldGet(this, _VoipClient_engine, "f").startCall({
                    peerJid: peerLid,
                    peerPn: targetPnJid,
                    peerList: deviceList,
                    callId,
                    isVideo: !!opts.video,
                    isLidCall: true,
                    isFromDialer: false,
                    extraData: tcToken
                });
            }
            catch (err) {
                // Engine refused — roll the lifecycle back so a future call() works.
                __classPrivateFieldSet(this, _VoipClient_activeCall, null, "f");
                throw err;
            }
            return call;
        };
        // ─── F2 — Group / Call-link orchestration ──────────────────────────────────
        //
        // Signaling for create / query / join + heartbeat / participant tracking is
        // already wired into the fork's socket via PR #245 (`createCallLink`,
        // `joinCallLink`, `queryCallLink`, `sendHeartbeat`, `extractParticipants`).
        // These wrappers just expose them as ergonomic `VoipClient` methods AND
        // start a per-call heartbeat loop once the call reaches the `Active` state.
        //
        // What's NOT covered here: the multi-party AUDIO ROUTING that mixes uplinks
        // from N participants downstream to each of them lives inside the WASM
        // binary itself (`whatsapp.wasm`). The bundled engine wrapper exposes
        // `startCall` for 1:1 — group-call init requires the WASM-side
        // `WAWebVoipGroupCallFromChat` / `WAWebVoipGroupCallFromWids` entrypoint
        // we identified via CDP. Surfacing those goes in a follow-up PR once the
        // WASM bindings are extended; today's wrappers below give consumers the
        // signaling path so they can at least RECEIVE / dial into a group call.
        /**
         * Create a new call link. Returns the token + the `https://call.whatsapp.com/...`
         * URL the recipient can use to join.
         *
         * Delegates to the fork's socket-level `createCallLink` (shipped in
         * PR #245). Throws if the embedded socket doesn't expose it.
         */
        this.createLink = async (media = 'voice') => {
            if (!__classPrivateFieldGet(this, _VoipClient_sock, "f")?.createCallLink) {
                throw new Error('Socket does not expose createCallLink — is the fork’s call signaling wired up?');
            }
            return __classPrivateFieldGet(this, _VoipClient_sock, "f").createCallLink(media === 'video' ? 'video' : 'audio');
        };
        /**
         * Query an existing call link's metadata (creator, current participants,
         * media type, etc.) without joining.
         */
        this.queryLink = async (token, media = 'voice') => {
            if (!__classPrivateFieldGet(this, _VoipClient_sock, "f")?.queryCallLink) {
                throw new Error('Socket does not expose queryCallLink');
            }
            return __classPrivateFieldGet(this, _VoipClient_sock, "f").queryCallLink(token, media === 'video' ? 'video' : 'audio');
        };
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
        this.joinLink = async (token, media = 'voice') => {
            if (!__classPrivateFieldGet(this, _VoipClient_sock, "f")?.joinCallLink) {
                throw new Error('Socket does not expose joinCallLink');
            }
            await __classPrivateFieldGet(this, _VoipClient_sock, "f").joinCallLink(token, media === 'video' ? 'video' : 'audio');
            this.emit('group-joined', { token });
            return { token };
        };
        /**
         * Send a manual heartbeat for an active group/link call. Most consumers
         * won't need this — `ActiveCall` runs an internal heartbeat loop once
         * the call enters the `Active` state. Exposed for advanced cases (manual
         * keep-alive on stale sessions, debugging the protocol, etc.).
         */
        this.sendHeartbeat = async (callId, callCreator) => {
            if (!__classPrivateFieldGet(this, _VoipClient_sock, "f")?.sendHeartbeat) {
                throw new Error('Socket does not expose sendHeartbeat');
            }
            await __classPrivateFieldGet(this, _VoipClient_sock, "f").sendHeartbeat(callId, callCreator);
        };
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
        this.groupCall = async (participants, opts = {}) => {
            if (!__classPrivateFieldGet(this, _VoipClient_engine, "f") || !__classPrivateFieldGet(this, _VoipClient_signaling, "f"))
                throw new Error('Not connected. Call connect() first.');
            if (__classPrivateFieldGet(this, _VoipClient_activeCall, "f"))
                throw new Error('A call is already active.');
            if (!participants.length)
                throw new Error('groupCall: at least one participant is required');
            // Resolve each participant to a LID if it's a bare phone number — the
            // SFU expects LIDs and the signaling layer's `discoverPeerDevices`
            // returns per-device LIDs. We don't fan-out per device here; the WASM
            // does that internally from the per-participant LID.
            const resolved = [];
            for (const p of participants) {
                // Both `@lid` and `@hosted.lid` are already resolved — only bare
                // phone numbers need the LID lookup. The earlier `endsWith('@lid')`
                // missed hosted-LID accounts (device 99) and tried to re-resolve
                // them as if they were PNs.
                if (p.endsWith('@lid') || p.endsWith('@hosted.lid')) {
                    resolved.push(p);
                }
                else if (p.endsWith('@s.whatsapp.net')) {
                    const lid = await __classPrivateFieldGet(this, _VoipClient_signaling, "f").resolveLid(p);
                    resolved.push(lid || p);
                }
                else {
                    const digits = p.replace(/\D/g, '');
                    const pnJid = `${digits}@s.whatsapp.net`;
                    const lid = await __classPrivateFieldGet(this, _VoipClient_signaling, "f").resolveLid(pnJid);
                    resolved.push(lid || pnJid);
                }
            }
            const callId = ('00' + randomBytes(16).toString('hex').slice(2)).toUpperCase();
            const durationMs = opts.durationMs ?? 0;
            const audioSource = opts.audioSource ?? 'silence';
            const active = new ActiveCall(callId, __classPrivateFieldGet(this, _VoipClient_engine, "f"), durationMs);
            active._audioSource = audioSource;
            if (opts.video)
                active._videoConfig = opts.video;
            // Group calls always run the heartbeat loop. The call creator for the
            // heartbeat is OUR own JID (we're the originator).
            const selfJid = __classPrivateFieldGet(this, _VoipClient_sock, "f").authState.creds.me?.lid || __classPrivateFieldGet(this, _VoipClient_sock, "f").authState.creds.me?.id;
            if (selfJid)
                active._setGroupContext(selfJid, __classPrivateFieldGet(this, _VoipClient_sock, "f"));
            __classPrivateFieldSet(this, _VoipClient_activeCall, active, "f");
            __classPrivateFieldGet(this, _VoipClient_attachCallLifecycle, "f").call(this, active);
            // Hook the video frame stream into the active call (if opted-in).
            if (opts.video) {
                __classPrivateFieldGet(this, _VoipClient_engine, "f").setOnVideoFrameCallback(frame => active._emitVideoFrame(frame));
            }
            try {
                __classPrivateFieldGet(this, _VoipClient_engine, "f").startGroupCall({
                    callId,
                    participants: resolved,
                    isVideo: !!opts.video,
                    callCreator: selfJid,
                    linkToken: opts.linkToken
                });
            }
            catch (err) {
                __classPrivateFieldSet(this, _VoipClient_activeCall, null, "f");
                throw err;
            }
            return active;
        };
        /** Tear down the WhatsApp socket and release resources. */
        this.disconnect = () => {
            __classPrivateFieldGet(this, _VoipClient_activeCall, "f")?._forceEnd('disconnect');
            __classPrivateFieldSet(this, _VoipClient_activeCall, null, "f");
            // Detach the direct ws CB hooks BEFORE we null out the engine —
            // otherwise a stanza in flight when destroy() lands could invoke
            // the handler against a torn-down engine and throw into the host
            // process. We captured the refs at attach time so `removeListener`
            // targets the exact closure (a fresh arrow would not match).
            const ws = __classPrivateFieldGet(this, _VoipClient_sock, "f")?.ws;
            const off = ws?.off ?? ws?.removeListener;
            if (off) {
                if (__classPrivateFieldGet(this, _VoipClient_cbCallHandler, "f"))
                    off.call(ws, 'CB:call', __classPrivateFieldGet(this, _VoipClient_cbCallHandler, "f"));
                if (__classPrivateFieldGet(this, _VoipClient_cbReceiptHandler, "f"))
                    off.call(ws, 'CB:receipt', __classPrivateFieldGet(this, _VoipClient_cbReceiptHandler, "f"));
            }
            __classPrivateFieldSet(this, _VoipClient_cbCallHandler, null, "f");
            __classPrivateFieldSet(this, _VoipClient_cbReceiptHandler, null, "f");
            __classPrivateFieldGet(this, _VoipClient_relay, "f")?.closeAll();
            __classPrivateFieldGet(this, _VoipClient_engine, "f")?.destroy();
            // Only close the socket if we created it. In embedded mode the caller
            // still needs it for messaging after the VoIP teardown.
            if (__classPrivateFieldGet(this, _VoipClient_ownsSocket, "f"))
                __classPrivateFieldGet(this, _VoipClient_sock, "f")?.end?.();
            __classPrivateFieldSet(this, _VoipClient_engine, null, "f");
            __classPrivateFieldSet(this, _VoipClient_relay, null, "f");
            __classPrivateFieldSet(this, _VoipClient_signaling, null, "f");
            __classPrivateFieldSet(this, _VoipClient_sock, null, "f");
        };
        // ─── private ──────────────────────────────────────────────────────────────
        _VoipClient_handleCallEvent.set(this, (eventType, eventData) => {
            if (eventType === 16 && eventData) {
                try {
                    const parsed = JSON.parse(eventData);
                    const info = parsed.call_info ?? parsed.callInfo ?? {};
                    const callState = Number(info.call_state ?? info.callState ?? 0);
                    __classPrivateFieldGet(this, _VoipClient_activeCall, "f")?._updateState(callState);
                }
                catch { }
            }
            else if (eventType === 156 && eventData) {
                try {
                    const update = JSON.parse(eventData);
                    __classPrivateFieldGet(this, _VoipClient_relay, "f")?.updateRelayList(update);
                }
                catch { }
            }
            else if (eventType === 2) {
                __classPrivateFieldGet(this, _VoipClient_activeCall, "f")?._forceEnd('remote_end');
            }
        });
        _VoipClient_handleAudioCaptureInit.set(this, (config) => {
            if (!__classPrivateFieldGet(this, _VoipClient_engine, "f"))
                return;
            __classPrivateFieldSet(this, _VoipClient_captureSampleRate, config.sampleRate || 16000, "f");
            __classPrivateFieldSet(this, _VoipClient_captureChannels, config.channels || 1, "f");
            __classPrivateFieldSet(this, _VoipClient_captureFramesPerChunk, config.framesPerChunk || 320, "f");
            const chunkSamples = __classPrivateFieldGet(this, _VoipClient_captureFramesPerChunk, "f") * __classPrivateFieldGet(this, _VoipClient_captureChannels, "f");
            __classPrivateFieldSet(this, _VoipClient_captureChunkBytes, chunkSamples * Float32Array.BYTES_PER_ELEMENT, "f");
            __classPrivateFieldSet(this, _VoipClient_capturePtr, __classPrivateFieldGet(this, _VoipClient_engine, "f").malloc(__classPrivateFieldGet(this, _VoipClient_captureChunkBytes, "f")), "f");
        });
        _VoipClient_handleAudioCaptureStart.set(this, () => {
            if (!__classPrivateFieldGet(this, _VoipClient_engine, "f") || !__classPrivateFieldGet(this, _VoipClient_capturePtr, "f"))
                return;
            const audioSource = __classPrivateFieldGet(this, _VoipClient_activeCall, "f")?._audioSource ?? 'silence';
            __classPrivateFieldSet(this, _VoipClient_feeder, new AudioFeeder(__classPrivateFieldGet(this, _VoipClient_captureSampleRate, "f"), __classPrivateFieldGet(this, _VoipClient_captureChannels, "f"), __classPrivateFieldGet(this, _VoipClient_captureFramesPerChunk, "f"), chunk => {
                if (__classPrivateFieldGet(this, _VoipClient_engine, "f") && __classPrivateFieldGet(this, _VoipClient_capturePtr, "f"))
                    __classPrivateFieldGet(this, _VoipClient_engine, "f").sendAudioData(chunk, __classPrivateFieldGet(this, _VoipClient_capturePtr, "f"));
            }, audioSource), "f");
            __classPrivateFieldGet(this, _VoipClient_feeder, "f").start();
        });
        _VoipClient_handleAudioCaptureStop.set(this, () => {
            __classPrivateFieldGet(this, _VoipClient_feeder, "f")?.stop();
            __classPrivateFieldSet(this, _VoipClient_feeder, null, "f");
            if (__classPrivateFieldGet(this, _VoipClient_engine, "f") && __classPrivateFieldGet(this, _VoipClient_capturePtr, "f")) {
                try {
                    __classPrivateFieldGet(this, _VoipClient_engine, "f").free(__classPrivateFieldGet(this, _VoipClient_capturePtr, "f"));
                }
                catch { }
                __classPrivateFieldSet(this, _VoipClient_capturePtr, 0, "f");
            }
        });
        if (!config.authDir && !config.socket) {
            throw new Error('VoipSdkConfig: must provide either `authDir` (standalone) or `socket` (embedded).');
        }
        if (config.authDir && config.socket) {
            throw new Error('VoipSdkConfig: `authDir` and `socket` are mutually exclusive — pass one only.');
        }
        __classPrivateFieldSet(this, _VoipClient_config, config, "f");
        __classPrivateFieldSet(this, _VoipClient_ownsSocket, !config.socket, "f");
    }
}
_VoipClient_config = new WeakMap(), _VoipClient_engine = new WeakMap(), _VoipClient_relay = new WeakMap(), _VoipClient_signaling = new WeakMap(), _VoipClient_sock = new WeakMap(), _VoipClient_activeCall = new WeakMap(), _VoipClient_baileys = new WeakMap(), _VoipClient_seenIncomingIds = new WeakMap(), _VoipClient_ownsSocket = new WeakMap(), _VoipClient_capturePtr = new WeakMap(), _VoipClient_captureChunkBytes = new WeakMap(), _VoipClient_captureSampleRate = new WeakMap(), _VoipClient_captureChannels = new WeakMap(), _VoipClient_captureFramesPerChunk = new WeakMap(), _VoipClient_feeder = new WeakMap(), _VoipClient_attachCallLifecycle = new WeakMap(), _VoipClient_initEngineWithSocket = new WeakMap(), _VoipClient_cbCallHandler = new WeakMap(), _VoipClient_cbReceiptHandler = new WeakMap(), _VoipClient_wireIncomingCallListener = new WeakMap(), _VoipClient_makeIncomingHandle = new WeakMap(), _VoipClient_handleCallEvent = new WeakMap(), _VoipClient_handleAudioCaptureInit = new WeakMap(), _VoipClient_handleAudioCaptureStart = new WeakMap(), _VoipClient_handleAudioCaptureStop = new WeakMap();
//# sourceMappingURL=index.js.map