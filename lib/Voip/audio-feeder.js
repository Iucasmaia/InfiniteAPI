var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var _AudioFeeder_proc, _AudioFeeder_pending, _AudioFeeder_queue, _AudioFeeder_emitTimer, _AudioFeeder_nextEmitAtMs, _AudioFeeder_warmupUntilMs, _AudioFeeder_isSilence, _AudioFeeder_stopped, _AudioFeeder_resolveInputArgs, _AudioFeeder_scheduleNext, _AudioFeeder_flushOne;
/**
 * Audio feeder.
 *
 * Spawns ffmpeg to decode `source` into f32le PCM at the requested rate, then
 * meters frames out at chunk-cadence to the WASM uplink.
 *
 */
import { spawn } from 'node:child_process';
const LOW_WATERMARK_CHUNKS = 16;
const MAX_QUEUED_CHUNKS = 1024;
const DEFAULT_WARMUP_MS = 500;
export class AudioFeeder {
    constructor(sampleRate, channels, framesPerChunk, onChunk, source = 'silence') {
        this.sampleRate = sampleRate;
        this.channels = channels;
        this.framesPerChunk = framesPerChunk;
        this.onChunk = onChunk;
        this.source = source;
        _AudioFeeder_proc.set(this, null);
        _AudioFeeder_pending.set(this, Buffer.alloc(0));
        _AudioFeeder_queue.set(this, []);
        _AudioFeeder_emitTimer.set(this, null);
        _AudioFeeder_nextEmitAtMs.set(this, 0);
        _AudioFeeder_warmupUntilMs.set(this, 0);
        _AudioFeeder_isSilence.set(this, false);
        _AudioFeeder_stopped.set(this, false);
        this.droppedChunks = 0;
        this.underflowChunks = 0;
        this.bytesProduced = 0;
        this.chunksEmitted = 0;
        this.start = () => {
            if (__classPrivateFieldGet(this, _AudioFeeder_proc, "f"))
                return;
            const chunkSamples = this.framesPerChunk * this.channels;
            const chunkBytes = chunkSamples * Float32Array.BYTES_PER_ELEMENT;
            const chunkIntervalMs = (this.framesPerChunk / this.sampleRate) * 1000;
            // Silence source: aevalsrc with d=3600 stops after 1h. For long calls,
            // we restart on `exit` (see below) so the uplink keeps flowing.
            __classPrivateFieldSet(this, _AudioFeeder_isSilence, !this.source || this.source === 'silence', "f");
            const inputArgs = __classPrivateFieldGet(this, _AudioFeeder_resolveInputArgs, "f").call(this);
            __classPrivateFieldSet(this, _AudioFeeder_proc, spawn('ffmpeg', [
                '-hide_banner',
                '-loglevel',
                'error',
                '-thread_queue_size',
                '512',
                ...inputArgs,
                '-f',
                'f32le',
                '-ac',
                String(this.channels),
                '-ar',
                String(this.sampleRate),
                'pipe:1'
            ]), "f");
            // Without this handler an ENOENT (ffmpeg missing from PATH) becomes an
            // uncaught process error and crashes the host. Surface it cleanly so
            // the caller sees a clear stderr message and the call can hang up.
            __classPrivateFieldGet(this, _AudioFeeder_proc, "f").on('error', (err) => {
                process.stderr.write(`[AudioFeeder] ffmpeg spawn failed: ${err?.message ?? err}\n`);
                __classPrivateFieldSet(this, _AudioFeeder_proc, null, "f");
            });
            __classPrivateFieldGet(this, _AudioFeeder_proc, "f").stdout.on('data', (chunk) => {
                __classPrivateFieldSet(this, _AudioFeeder_pending, Buffer.concat([__classPrivateFieldGet(this, _AudioFeeder_pending, "f"), chunk]), "f");
                while (__classPrivateFieldGet(this, _AudioFeeder_pending, "f").length >= chunkBytes) {
                    if (__classPrivateFieldGet(this, _AudioFeeder_queue, "f").length >= MAX_QUEUED_CHUNKS) {
                        __classPrivateFieldGet(this, _AudioFeeder_proc, "f")?.stdout.pause();
                        break;
                    }
                    const frame = __classPrivateFieldGet(this, _AudioFeeder_pending, "f").subarray(0, chunkBytes);
                    __classPrivateFieldSet(this, _AudioFeeder_pending, __classPrivateFieldGet(this, _AudioFeeder_pending, "f").subarray(chunkBytes), "f");
                    const out = new Float32Array(chunkSamples);
                    out.set(new Float32Array(frame.buffer, frame.byteOffset, chunkSamples));
                    this.bytesProduced += chunkBytes;
                    __classPrivateFieldGet(this, _AudioFeeder_queue, "f").push(out);
                }
            });
            __classPrivateFieldGet(this, _AudioFeeder_proc, "f").stderr.on('data', (chunk) => {
                process.stderr.write(`[AudioFeeder] ${chunk.toString().trim()}\n`);
            });
            __classPrivateFieldGet(this, _AudioFeeder_proc, "f").on('exit', code => {
                if (code !== 0 && code !== null) {
                    process.stderr.write(`[AudioFeeder] ffmpeg exited with code=${code}\n`);
                }
                const wasSilence = __classPrivateFieldGet(this, _AudioFeeder_isSilence, "f") && !__classPrivateFieldGet(this, _AudioFeeder_stopped, "f");
                __classPrivateFieldSet(this, _AudioFeeder_proc, null, "f");
                // Silence sources are capped at 1h (`aevalsrc=0:d=3600`). When the
                // call outlives that, ffmpeg exits cleanly and the uplink dries up.
                // Respawn so heartbeat / audio path keeps going indefinitely.
                // IMPORTANT: cancel the in-flight #emitTimer first — start() will
                // schedule a fresh one, and a stale timer from the previous run
                // would emit alongside the new loop, doubling the cadence.
                if (wasSilence) {
                    if (__classPrivateFieldGet(this, _AudioFeeder_emitTimer, "f")) {
                        clearTimeout(__classPrivateFieldGet(this, _AudioFeeder_emitTimer, "f"));
                        __classPrivateFieldSet(this, _AudioFeeder_emitTimer, null, "f");
                    }
                    setImmediate(() => {
                        if (!__classPrivateFieldGet(this, _AudioFeeder_stopped, "f"))
                            this.start();
                    });
                }
            });
            __classPrivateFieldSet(this, _AudioFeeder_nextEmitAtMs, 0, "f");
            __classPrivateFieldSet(this, _AudioFeeder_warmupUntilMs, Date.now() + DEFAULT_WARMUP_MS, "f");
            __classPrivateFieldGet(this, _AudioFeeder_scheduleNext, "f").call(this, chunkSamples, chunkIntervalMs);
        };
        this.stop = () => {
            __classPrivateFieldSet(this, _AudioFeeder_stopped, true, "f");
            if (__classPrivateFieldGet(this, _AudioFeeder_emitTimer, "f")) {
                clearTimeout(__classPrivateFieldGet(this, _AudioFeeder_emitTimer, "f"));
                __classPrivateFieldSet(this, _AudioFeeder_emitTimer, null, "f");
            }
            __classPrivateFieldGet(this, _AudioFeeder_proc, "f")?.kill('SIGTERM');
            __classPrivateFieldSet(this, _AudioFeeder_proc, null, "f");
            __classPrivateFieldSet(this, _AudioFeeder_pending, Buffer.alloc(0), "f");
            __classPrivateFieldSet(this, _AudioFeeder_queue, [], "f");
            __classPrivateFieldSet(this, _AudioFeeder_warmupUntilMs, 0, "f");
        };
        _AudioFeeder_resolveInputArgs.set(this, () => {
            if (!this.source || this.source === 'silence') {
                return ['-f', 'lavfi', '-i', `aevalsrc=0:d=3600:s=${this.sampleRate}`];
            }
            if (this.source.startsWith('lavfi:')) {
                return ['-f', 'lavfi', '-i', this.source.slice('lavfi:'.length)];
            }
            return ['-i', this.source];
        });
        _AudioFeeder_scheduleNext.set(this, (chunkSamples, chunkIntervalMs) => {
            if (!__classPrivateFieldGet(this, _AudioFeeder_proc, "f"))
                return;
            const now = Date.now();
            if (__classPrivateFieldGet(this, _AudioFeeder_nextEmitAtMs, "f") === 0)
                __classPrivateFieldSet(this, _AudioFeeder_nextEmitAtMs, now, "f");
            const delayMs = Math.max(0, __classPrivateFieldGet(this, _AudioFeeder_nextEmitAtMs, "f") - now);
            __classPrivateFieldSet(this, _AudioFeeder_emitTimer, setTimeout(() => {
                __classPrivateFieldSet(this, _AudioFeeder_emitTimer, null, "f");
                if (__classPrivateFieldGet(this, _AudioFeeder_queue, "f").length < LOW_WATERMARK_CHUNKS && Date.now() < __classPrivateFieldGet(this, _AudioFeeder_warmupUntilMs, "f")) {
                    __classPrivateFieldSet(this, _AudioFeeder_nextEmitAtMs, Date.now() + 10, "f");
                    __classPrivateFieldGet(this, _AudioFeeder_scheduleNext, "f").call(this, chunkSamples, chunkIntervalMs);
                    return;
                }
                __classPrivateFieldGet(this, _AudioFeeder_flushOne, "f").call(this, chunkSamples);
                __classPrivateFieldSet(this, _AudioFeeder_nextEmitAtMs, __classPrivateFieldGet(this, _AudioFeeder_nextEmitAtMs, "f") + chunkIntervalMs, "f");
                __classPrivateFieldGet(this, _AudioFeeder_scheduleNext, "f").call(this, chunkSamples, chunkIntervalMs);
            }, delayMs), "f");
        });
        _AudioFeeder_flushOne.set(this, (chunkSamples) => {
            let nextChunk = __classPrivateFieldGet(this, _AudioFeeder_queue, "f").shift();
            if (!nextChunk) {
                nextChunk = new Float32Array(chunkSamples);
                this.underflowChunks += 1;
            }
            this.chunksEmitted += 1;
            this.onChunk(nextChunk);
            if (__classPrivateFieldGet(this, _AudioFeeder_proc, "f")?.stdout.isPaused() && __classPrivateFieldGet(this, _AudioFeeder_queue, "f").length <= MAX_QUEUED_CHUNKS / 4) {
                __classPrivateFieldGet(this, _AudioFeeder_proc, "f").stdout.resume();
            }
        });
    }
}
_AudioFeeder_proc = new WeakMap(), _AudioFeeder_pending = new WeakMap(), _AudioFeeder_queue = new WeakMap(), _AudioFeeder_emitTimer = new WeakMap(), _AudioFeeder_nextEmitAtMs = new WeakMap(), _AudioFeeder_warmupUntilMs = new WeakMap(), _AudioFeeder_isSilence = new WeakMap(), _AudioFeeder_stopped = new WeakMap(), _AudioFeeder_resolveInputArgs = new WeakMap(), _AudioFeeder_scheduleNext = new WeakMap(), _AudioFeeder_flushOne = new WeakMap();
//# sourceMappingURL=audio-feeder.js.map