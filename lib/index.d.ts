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
export type WASocket = ReturnType<typeof makeWASocket>;
export { makeWASocket, makeWASocketAutoVersion, suppressLibsignalLogs };
export { isPersonJid as isJidUser } from './Utils/history.js';
export { VoipClient, ActiveCall, CallState } from './Voip/index.js';
export type { AcceptOptions, ActiveCallHandle, AudioConfig, CallEvents, CallOptions, IncomingCallHandle, RelayListUpdate, VideoConfig, VideoFrame, VideoFrameFormat, VoipClientEvents, VoipIncomingCallEvent, VoipSdkConfig, VoipSocketLike } from './Voip/types.js';
export default makeWASocket;
//# sourceMappingURL=index.d.ts.map