// ./prelude MUST be the first import: it installs the libsignal log filter
// as a module side-effect. In native ESM all static imports are evaluated
// before the module body runs, so a call in the body would fire too late
// (libsignal already loaded). The prelude has no Socket dependency, so the
// ESM loader evaluates it — and its filter — before the Socket/index graph.
import './prelude.js';
import makeWASocket, { makeWASocketAutoVersion } from './Socket/index.js';
import { suppressLibsignalLogs } from './Utils/suppress-libsignal-logs.js';
export * from '../WAProto/index.js';
export * from './Utils/index.js';
export * from './Types/index.js';
export * from './Defaults/index.js';
export * from './WABinary/index.js';
export * from './WAM/index.js';
export * from './WAUSync/index.js';
export { makeWASocket, makeWASocketAutoVersion, suppressLibsignalLogs };
// Alias de compatibilidade para zpro.io
// isJidUser é um alias para isPersonJid (mantém retrocompatibilidade)
export { isPersonJid as isJidUser } from './Utils/history.js';
// VoIP (voice calls) — outbound 1:1 calls via WhatsApp Web's WASM stack.
// Peer deps `@roamhq/wrtc` and `qrcode-terminal` are OPTIONAL — only
// consumers placing voice calls need to install them. `ffmpeg` on PATH is
// also required for MP3/WAV source decoding.
export { VoipClient, ActiveCall, CallState } from './Voip/index.js';
export default makeWASocket;
//# sourceMappingURL=index.js.map