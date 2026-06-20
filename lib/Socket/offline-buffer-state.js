/**
 * Offline-phase event buffer — safety state machine extracted from
 * `makeSocket` so the three interaction points (arm / cancel-on-arrival /
 * cancel-on-close) can be unit tested directly. (audit TST-06)
 *
 * The factory captures the consumer's `flush` + `warn` callbacks and the
 * timeout duration; the returned object exposes the three transitions that
 * used to be inline closures over `didStartBuffer` + `offlineBufferTimeout`
 * in `socket.ts`. State is fully private.
 */
export const createOfflineBufferState = (flush, warn, timeoutMs) => {
    let didStartBuffer = false;
    let offlineBufferTimeout;
    return {
        startBuffer() {
            // Defensive: if `startBuffer` is ever called twice without an
            // intervening `onOffline` / `onClose` (e.g. a future reconnection
            // path that double-fires the CB:ib trigger), drop the stale
            // timer so two flushes can't race. Today's socket lifecycle
            // guarantees a single call, so this is belt-and-suspenders.
            // (audit thread 9)
            if (offlineBufferTimeout) {
                clearTimeout(offlineBufferTimeout);
                offlineBufferTimeout = undefined;
            }
            didStartBuffer = true;
            offlineBufferTimeout = setTimeout(() => {
                offlineBufferTimeout = undefined;
                if (didStartBuffer) {
                    warn();
                    flush();
                    didStartBuffer = false;
                }
            }, timeoutMs);
        },
        onOffline() {
            if (offlineBufferTimeout) {
                clearTimeout(offlineBufferTimeout);
                offlineBufferTimeout = undefined;
            }
            if (didStartBuffer) {
                flush();
                didStartBuffer = false;
            }
        },
        onClose() {
            if (offlineBufferTimeout) {
                clearTimeout(offlineBufferTimeout);
                offlineBufferTimeout = undefined;
            }
            didStartBuffer = false;
        },
        getState() {
            return { didStartBuffer, hasTimeout: !!offlineBufferTimeout };
        }
    };
};
//# sourceMappingURL=offline-buffer-state.js.map