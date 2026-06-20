let _bridge;
// Start loading eagerly using .then() instead of top-level await.
// This prevents the whatsapp-rust-bridge top-level await from propagating
// through the ESM graph, which would break CJS require() consumers.
const _bridgeReady = import('whatsapp-rust-bridge').then(m => {
    _bridge = m;
    return m;
});
export { _bridgeReady as wasmBridgeReady };
function getBridge() {
    if (!_bridge) {
        throw new Error('whatsapp-rust-bridge not yet loaded. ' + 'Ensure async operations have started before calling crypto functions.');
    }
    return _bridge;
}
export const hkdf = (...args) => getBridge().hkdf(...args);
export const md5 = (...args) => getBridge().md5(...args);
export const expandAppStateKeys = (...args) => getBridge().expandAppStateKeys(...args);
let _ltHash;
export function getLTHashAntiTampering() {
    if (!_ltHash) {
        _ltHash = new (getBridge().LTHashAntiTampering)();
    }
    return _ltHash;
}
//# sourceMappingURL=wasm-bridge.js.map