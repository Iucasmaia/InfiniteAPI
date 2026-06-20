/**
 * Local SQLite type aliases that preserve the optional peer-dependency
 * contract for `better-sqlite3`.
 *
 * The problem this solves:
 *
 *   `src/Utils/index.ts` re-exports the entire `multi-db-sqlite` barrel,
 *   so any `better-sqlite3` types that surface in public method signatures
 *   (constructors, `handle()` return types, etc.) end up in the generated
 *   `.d.ts` declarations. Downstream TypeScript consumers that never use
 *   SQLite would still be forced to resolve `better-sqlite3`/`@types/...`
 *   typings, breaking the same optional-peer-dep contract that
 *   `useSqliteAuthState` carefully preserves with `database?: unknown`.
 *
 * The fix: every PUBLIC type signature in this folder uses the local
 * {@link SqliteDbLike} / {@link SqliteStatementLike} structural interfaces
 * defined below — they describe the surface area we actually use, do NOT
 * import from `better-sqlite3`, and therefore do not propagate the peer
 * dep through the published types. Internally, each backend casts the
 * incoming `SqliteDbLike` to `better-sqlite3`'s `Database` for the typed
 * prepared-statement API (the runtime contract is unchanged).
 *
 * The local interfaces intentionally mirror only the better-sqlite3
 * subset we exercise. Adding a new better-sqlite3 method to a backend
 * means either widening this interface or routing the call through a
 * boundary cast — both choices stay explicit.
 */
export {};
//# sourceMappingURL=types.js.map