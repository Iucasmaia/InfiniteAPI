/**
 * Optional console filter for libsignal's noisy `console.log` /
 * `console.info` / `console.error` calls.
 *
 * Background: `libsignal/session_record.js` dumps full session objects on
 * every close ("Closing session", "Removing old closed session") and emits
 * Bad MAC / counter / decrypt errors as raw stack traces. For a gateway
 * that handles thousands of sessions, the raw output drowns out everything
 * else and noticeably hurts I/O. This module installs a narrow filter
 * that:
 *   - Suppresses the two session-lifecycle log lines outright.
 *   - Collapses repeated `Bad MAC` / `MessageCounterError` / `Failed to
 *     decrypt` errors (originating from libsignal frames in the stack)
 *     into a single masked one-line summary, deduplicated within a 150 ms
 *     window per `(errorType, jid)` pair.
 *
 * History: this code used to live at the top of `src/index.ts` and ran as
 * an import side effect. That meant any consumer of the library — even
 * one importing only types — had their process-wide `console` rewritten.
 * Moving it into an explicit function makes the override opt-in for
 * library consumers; `src/index.ts` calls it automatically when
 * `INFINITEAPI_DISABLE_LIBSIGNAL_LOG_FILTER` is NOT set, preserving the
 * default behavior the gateway already depends on.
 */
/**
 * Install the libsignal log filter. Safe to call multiple times (subsequent
 * calls are no-ops). Once installed it is intentionally not removable —
 * the original console methods are captured by closure but never restored,
 * because the filter is a process-wide commitment for the lifetime of the
 * gateway.
 */
export declare function suppressLibsignalLogs(): void;
//# sourceMappingURL=suppress-libsignal-logs.d.ts.map