/**
 * Compile-time check: the `_ALL_TYPES_MAP` literal MUST contain every key
 * of `SignalDataTypeMap`. Adding a new signal-data type without listing it
 * here causes a TS error on the `_ensureAllTypes` line below — the array
 * passed to consumers can't drift behind the runtime types.
 */
const _ALL_TYPES_MAP = {
    'pre-key': true,
    session: true,
    'sender-key': true,
    'sender-key-memory': true,
    'app-state-sync-key': true,
    'app-state-sync-version': true,
    'lid-mapping': true,
    'device-list': true,
    tctoken: true,
    'identity-key': true
};
// Type-only assertion: if a new SignalDataTypeMap key is added without an
// entry in `_ALL_TYPES_MAP`, TypeScript errors here on the assignment.
const _ensureAllTypes = _ALL_TYPES_MAP;
void _ensureAllTypes;
/** Every record type that `migrateAuthState` will iterate. */
const ALL_TYPES = Object.keys(_ALL_TYPES_MAP);
/**
 * Copy a full authentication state (creds + every signal key record) from one
 * {@link AuthenticationState} to another. Used to migrate operators from
 * `useMultiFileAuthState` (deprecated) to a SQL-backed or other compliant
 * adapter without re-pairing the device.
 *
 * Adapted verbatim from upstream WhiskeySockets/Baileys #2575 (Stage 5).
 *
 * Requirements:
 * - The `from.keys` store MUST implement `list(type)` (added by Stage 1's type
 *   lift). Without it the migrator cannot enumerate records.
 * - The destination's `set(data)` MUST be at least per-call atomic for the
 *   pairs of types it observes. Crashes between batches leave a partial state
 *   on the destination; re-running with the default `skipExisting: true`
 *   safely resumes (writes are upserts; existing ids are skipped).
 *
 * Operational notes:
 * - The source is never mutated.
 * - Listing reads bypass the cache layer (see
 *   `makeCacheableSignalKeyStore.list`) so we always observe the durable
 *   content of the source.
 * - Logs `info` per type with counts; `warn` for any verification mismatch.
 */
export async function migrateAuthState({ from, to, batchSize = 100, skipExisting = true, logger, verify = true }) {
    if (!from.keys.list) {
        throw new Error('migrateAuthState: source store does not implement `list(type)`. Upgrade the source adapter or supply the records manually.');
    }
    const result = {
        creds: { copied: false },
        counts: {},
        verified: false,
        warnings: []
    };
    // 1. Copy creds. `AuthenticationState.creds` is a plain object — `Object.assign`
    //    in-place onto the destination keeps the property writes typed against
    //    `AuthenticationCreds` instead of routing every key through paired
    //    `any` casts. Callers that use the destination's `saveCreds`-style API
    //    are expected to persist.
    Object.assign(to.creds, from.creds);
    result.creds.copied = true;
    logger?.info('migrateAuthState: creds copied');
    /**
     * Build a single-type `SignalDataSet` payload for `to.keys.set`. The
     * inputs (`type: T`, `batch: { [id]: SignalDataTypeMap[T] | null }`) are
     * strongly typed; the assignment to `payload[type]` requires one narrow
     * cast because `SignalDataSet` is a mapped type whose distributive
     * index TypeScript can't tie back to the caller's `T`. The runtime
     * shape is unambiguous and the cast is contained to this single
     * helper instead of the previous `as any` at every call site.
     */
    function buildSetPayload(type, batch) {
        const payload = {};
        payload[type] = batch;
        return payload;
    }
    // 2. Per-type record migration.
    for (const type of ALL_TYPES) {
        let batch = {};
        let batchCount = 0;
        let total = 0;
        // `flush` is INTENTIONALLY not wrapped in the listing try/catch below:
        // a destination write failure must propagate so the migration rejects
        // and the operator notices, rather than getting silently logged as a
        // "source enumeration" warning.
        const flush = async () => {
            if (batchCount === 0)
                return;
            await to.keys.set(buildSetPayload(type, batch));
            total += batchCount;
            batch = {};
            batchCount = 0;
        };
        // Optional: pre-fetch destination ids so we skip records already there.
        let existingIds = null;
        if (skipExisting && to.keys.listIds) {
            existingIds = new Set();
            try {
                for await (const id of to.keys.listIds(type))
                    existingIds.add(id);
            }
            catch (e) {
                result.warnings.push(`failed to enumerate existing destination ids for ${type}: ${String(e)}`);
                existingIds = null;
            }
        }
        // Drain the source iterator and stage records in `batch`. Source-side
        // errors are recoverable (we record a warning per type, then continue
        // to the next type so a partially-listable source doesn't lose every
        // other type's records). Destination-side errors are NOT — they MUST
        // propagate so the operator notices and can re-run the migration.
        //
        // Cubic P1 fix: previous structure used `for await ... { await flush() }`
        // inside ONE try/catch. A destination throw from the in-loop `flush()`
        // got caught by the outer source-listing catch and downgraded to a
        // warning — the migration then either silently dropped remaining
        // records for that type or attempted to flush the same broken batch
        // twice. Manual iteration lets us catch source `.next()` errors at
        // the call site only, while in-loop `flush()` throws propagate up to
        // the caller untouched.
        //
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sourceIter = from.keys.list(type)[Symbol.asyncIterator]();
        // Cubic P2 fix (round-3): wrap the whole iteration in try/finally so
        // the source iterator is ALWAYS released, regardless of how we exit.
        // Round-1 only called `sourceIter.return?.()` in the source-error
        // branch; an in-loop `flush()` throw (destination error) bypassed
        // cleanup entirely and leaked the source cursor / prepared statement.
        // The `try { return await ... }` in `flush()` already lets the throw
        // reach this finally — we just need to make the cleanup unconditional.
        try {
            while (true) {
                let next;
                try {
                    next = await sourceIter.next();
                }
                catch (e) {
                    result.warnings.push(`failed to enumerate source records for ${type}: ${String(e)}`);
                    break;
                }
                if (next.done)
                    break;
                const [id, value] = next.value;
                if (existingIds?.has(id))
                    continue;
                batch[id] = value;
                batchCount++;
                if (batchCount >= batchSize) {
                    // Flush throws propagate — destination errors must NOT be
                    // swallowed as source warnings. The outer try/finally
                    // guarantees iterator cleanup before the throw reaches
                    // the caller.
                    await flush();
                }
            }
        }
        finally {
            // Best-effort iterator cleanup. Source stores typically release
            // the cursor/statement here (e.g. better-sqlite3 finalises the
            // prepared SELECT iteration). Swallow any error — the original
            // throw (if any) takes precedence.
            try {
                await sourceIter.return?.();
            }
            catch {
                // best-effort cleanup; ignore.
            }
        }
        // Final flush: a destination `to.keys.set` failure aborts the
        // migration. The caller's `await` rejects with the underlying store
        // error.
        await flush();
        result.counts[type] = total;
        logger?.info({ type, count: total }, 'migrateAuthState: copied type');
    }
    // 3. Verify (best-effort).
    if (verify) {
        const verifyOk = await verifyMigration(from, to, logger, result.warnings);
        result.verified = verifyOk;
    }
    logger?.info({ counts: result.counts, verified: result.verified, warnings: result.warnings.length }, 'migrateAuthState: done');
    return result;
}
async function verifyMigration(from, to, logger, warnings) {
    if (!from.keys.listIds && !from.keys.list)
        return false;
    if (!to.keys.listIds && !to.keys.list)
        return false;
    let ok = true;
    for (const type of ALL_TYPES) {
        const fromIds = await collectIds(from, type, logger);
        const toIds = await collectIds(to, type, logger);
        // A null from `collectIds` means we couldn't enumerate that side at
        // all — that's a verification gap, not a clean pass. Surface it as
        // a warning and fail the overall verified flag.
        if (fromIds === null || toIds === null) {
            warnings.push(`verification skipped for ${type}: unable to enumerate one side`);
            ok = false;
            continue;
        }
        for (const id of fromIds) {
            if (!toIds.has(id)) {
                warnings.push(`destination missing ${type}:${id}`);
                ok = false;
            }
        }
        // Symmetric check: destination should not have records the source
        // doesn't. An extra id in `to` means either a stale leftover from a
        // prior partial run or an unrelated write to the destination during
        // migration — both are signal worth surfacing.
        for (const id of toIds) {
            if (!fromIds.has(id)) {
                warnings.push(`destination has unexpected ${type}:${id}`);
                ok = false;
            }
        }
    }
    logger?.info({ ok }, 'migrateAuthState: verification complete');
    return ok;
}
async function collectIds(state, type, logger) {
    const out = new Set();
    try {
        if (state.keys.listIds) {
            for await (const id of state.keys.listIds(type))
                out.add(id);
        }
        else if (state.keys.list) {
            for await (const [id] of state.keys.list(type))
                out.add(id);
        }
        else {
            return null;
        }
        return out;
    }
    catch (err) {
        // Log the original error so the operator can distinguish "store
        // doesn't expose listIds/list" (null) from a real failure here
        // (locked db, corrupted file, etc.). The caller still treats null
        // as "could not enumerate" but the diagnostic is preserved.
        logger?.warn({ type, err }, 'collectIds: failed to enumerate signal-data type');
        return null;
    }
}
//# sourceMappingURL=migrate-auth-state.js.map