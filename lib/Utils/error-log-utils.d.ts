/**
 * Compact error serialization for log output.
 *
 * Signal Protocol generates a high volume of operationally-recoverable
 * decryption failures during normal WhatsApp operation — `MessageCounterError`
 * from session-cipher counter drift, `Bad MAC` from rotated keys, `old counter`
 * from out-of-order group messages, `Invalid PreKey ID` from consumed prekey
 * pools. These all auto-recover via the retry+pkmsg flow.
 *
 * Logging the full `err` object for each one repeats the same ~30-line stack
 * trace (always rooted in `libsignal/session_cipher.js` or `group_cipher.ts`)
 * for every operational hiccup, ballooning each error to multiple kilobytes
 * across multiple log sites. Operators can't act on the stack, and grep gets
 * harder.
 *
 * Use `compactError(err)` to emit a single human-readable `Name: message`
 * string instead of a full pino-serialized object — keeps the failure
 * visible without spamming the log.
 */
/**
 * Format an error as `Name: message` without the stack trace.
 *
 * Used for log lines covering recoverable Signal Protocol failures, where the
 * stack is constant and the actionable information is the type + message.
 *
 * MUST NEVER THROW — this helper is called from inside catch blocks (notably
 * `messages-recv.ts` where a throw bubbles past the NACK and leaves the server
 * retrying the same stanza forever). `JSON.stringify` on a circular object
 * raises `TypeError`, so the object-without-message branch is guarded.
 */
export declare const compactError: (err: unknown) => string;
//# sourceMappingURL=error-log-utils.d.ts.map