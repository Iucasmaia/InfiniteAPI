type WasmBridgeModule = typeof import('whatsapp-rust-bridge');
declare const _bridgeReady: Promise<typeof import("whatsapp-rust-bridge")>;
export { _bridgeReady as wasmBridgeReady };
export declare const hkdf: WasmBridgeModule['hkdf'];
export declare const md5: WasmBridgeModule['md5'];
export declare const expandAppStateKeys: WasmBridgeModule['expandAppStateKeys'];
export declare function getLTHashAntiTampering(): InstanceType<WasmBridgeModule['LTHashAntiTampering']>;
//# sourceMappingURL=wasm-bridge.d.ts.map