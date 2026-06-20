import type { AuthenticationState } from '../Types/index.js';
/**
 * Error thrown by {@link useMultiFileAuthState} when a JSON file on disk is
 * present but cannot be parsed — usually the result of a torn write from a
 * crash mid-rewrite. The original parse error is attached via `cause` and the
 * offending path is exposed so operators can recover the file.
 *
 * Stage 5 (adapted from upstream WhiskeySockets/Baileys #2575): previously
 * `readData` swallowed parse errors and returned `null`, which let the boot
 * path silently regenerate creds via `initAuthCreds()` and discard pairing
 * state. This error surfaces the failure loudly so operators can recover the
 * file (often from the `.bak` rotation) instead of paying for re-pairing.
 */
export declare class AuthFileCorruptError extends Error {
    readonly path: string;
    readonly cause: unknown;
    constructor(path: string, cause: unknown);
}
/**
 * Stores the full authentication state in a single folder.
 *
 * @deprecated For production deployments, prefer the SQLite-backed
 * `useSqliteAuthState` (cross-process safe, atomic transactions, faster on
 * cold start). This file-per-key implementation remains supported but is no
 * longer the recommended default; it is retained primarily for development
 * and for in-place migrations. WhatsApp's own mobile clients (Android
 * `msgstore.db` / `axolotl.db`) use SQLite with WAL — `useSqliteAuthState`
 * mirrors that pattern.
 *
 * Hardened in Stage 5 of the concurrency rewrite (closes H7 — adapted from
 * upstream WhiskeySockets/Baileys #2575):
 *   - persistent writes go via `*.tmp` + `rename` so a crash mid-write never
 *     replaces the previous file with a truncated one;
 *   - `.bak` rotation preserves the prior good state for manual or rare
 *     crash-driven recovery;
 *   - `readData` distinguishes ENOENT (return null) from corruption
 *     (`AuthFileCorruptError` thrown with the originating parse error in
 *     `cause`), so a torn write surfaces as a loud error rather than as a
 *     silent fresh-install on next boot;
 *   - `fileLocks` is refcounted and pruned on release;
 *   - implements `list`/`listIds` via `readdir` so `migrateAuthState` can
 *     enumerate the on-disk contents without leaking the file naming scheme.
 *
 * Cross-process safety: the per-path `Mutex` is per-process only. Do NOT
 * share an auth folder across multiple Baileys processes — use
 * `useSqliteAuthState` if you need that.
 */
export declare const useMultiFileAuthState: (folder: string) => Promise<{
    state: AuthenticationState;
    saveCreds: () => Promise<void>;
}>;
//# sourceMappingURL=use-multi-file-auth-state.d.ts.map