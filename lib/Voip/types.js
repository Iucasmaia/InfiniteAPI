/**
 * Shared type definitions for the VoIP module.
 *
 */
/** Mirrors the WhatsApp WASM `CallState` enum. */
export const CallState = {
    Idle: 0,
    Calling: 1,
    PreacceptReceived: 2,
    ReceivedCall: 3,
    AcceptSent: 4,
    AcceptReceived: 5,
    Active: 6,
    ActiveElsewhere: 7,
    Ending: 13
};
//# sourceMappingURL=types.js.map