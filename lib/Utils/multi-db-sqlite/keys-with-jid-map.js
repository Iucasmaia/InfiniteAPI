import { JidMapBackend, REVERSE_SUFFIX, stripReverse } from './lid-mapping-backend.js';
/**
 * Returns a new store that proxies `inner`, intercepting only the
 * `'lid-mapping'` type.
 *
 * The returned object satisfies the same `SignalKeyStoreWithTransaction`
 * surface as `inner` so it can be used wherever the existing
 * {@link LIDMappingStore} expects a key store.
 */
export function wrapKeysWithJidMap(inner, jidMap) {
    return {
        isInTransaction: () => inner.isInTransaction(),
        transaction: (exec, key) => inner.transaction(exec, key),
        transactWith: inner.transactWith ? (scope, work) => inner.transactWith(scope, work) : undefined,
        destroy: inner.destroy ? () => inner.destroy() : undefined,
        clear: inner.clear ? () => inner.clear() : undefined,
        list: inner.list ? inner.list.bind(inner) : undefined,
        listIds: inner.listIds ? inner.listIds.bind(inner) : undefined,
        async get(type, ids) {
            if (type !== 'lid-mapping') {
                return inner.get(type, ids);
            }
            // Split the input batch into PN-direction (no suffix) and
            // LID-direction (`_reverse` suffix) lookups, then do ONE batched
            // SQL query per direction. `LIDMappingStore` defaults
            // batchSize=100 here, so without batching this was N point
            // selects per call — undoing the whole point of the batch read.
            const out = {};
            const forwardIds = [];
            const reverseLids = [];
            const reverseLookup = new Map(); // lidUser → original id
            for (const id of ids) {
                const { lidUser, isReverse } = stripReverse(id);
                if (isReverse) {
                    reverseLids.push(lidUser);
                    reverseLookup.set(lidUser, id);
                }
                else {
                    forwardIds.push(id);
                }
            }
            if (forwardIds.length > 0) {
                const forwardHits = jidMap.batchGetLidForPn(forwardIds);
                for (const pn of forwardIds) {
                    const lid = forwardHits[pn];
                    if (lid !== undefined)
                        out[pn] = lid;
                }
            }
            if (reverseLids.length > 0) {
                const reverseHits = jidMap.batchGetPnForLid(reverseLids);
                for (const lid of reverseLids) {
                    const pn = reverseHits[lid];
                    if (pn === undefined)
                        continue;
                    const originalId = reverseLookup.get(lid);
                    if (originalId)
                        out[originalId] = pn;
                }
            }
            // Fall back to the inner store for any IDs that jid_map did not
            // resolve. This covers sessions migrated from a legacy key store
            // that still have lid-mapping entries under the inner store rather
            // than jid_map — without this, those mappings are invisible until
            // WhatsApp re-emits them.
            const allOriginalIds = [...forwardIds, ...reverseLids.map(lid => reverseLookup.get(lid))];
            const missedIds = allOriginalIds.filter(id => out[id] === undefined);
            if (missedIds.length > 0) {
                const legacyHits = await inner.get(type, missedIds);
                for (const id of missedIds) {
                    if (legacyHits[id] !== undefined)
                        out[id] = legacyHits[id];
                }
            }
            return out;
        },
        async set(data) {
            // IMPORTANT — cross-DB transaction caveat (audit MDB-03):
            // `wrapKeysWithJidMap` writes to TWO physical .db files —
            // axolotl.db (signal_kv via `inner.set`) and msgstore.db (jid_map
            // via `jidMap.*`). SQLite does not support a single transaction
            // spanning multiple files; ATTACH could come close but breaks
            // busy-timeout semantics and is incompatible with the per-DB
            // `transaction()` helper better-sqlite3 already wraps each call
            // in. We therefore commit `inner.set` FIRST, then jid_map — the
            // same order documented in `use-multi-db-sqlite-auth-state.ts:clear`.
            // A crash between the two commits leaves jid_map STALE relative
            // to the newer Signal keys; on next session establishment the
            // missing jid_map row is naturally rebuilt by LIDMappingStore.
            // Promoting this to a real distributed-transaction needs a
            // write-ahead log on either side and is out of scope here.
            const lidMappingBucket = data['lid-mapping'];
            if (!lidMappingBucket) {
                return inner.set(data);
            }
            // Pair forward + reverse entries by stripping the `_reverse`
            // suffix and matching against the unsuffixed entry. Anything
            // unpaired is stored as a single direction (forward implies
            // inserting only the PN→LID side; reverse implies the LID→PN
            // side without a confirmed forward pair).
            const pairs = [];
            const forwardOnly = [];
            const reverseOnly = [];
            // Deletes — `null`/`undefined` value is the Signal protocol's
            // delete sentinel. Previously these were silently `continue`d,
            // leaving stale `jid_map` rows that pointed at sessions that no
            // longer existed. (audit P1-SQDB-02)
            const deletes = [];
            const seenReverse = new Set();
            // Track which entries in the inner store ALSO need a delete request
            // — used below to propagate the null sentinel down so legacy entries
            // that landed in the inner store (pre-Phase-9) don't resurrect via
            // the `inner.get` fallback. (audit MDB-02)
            const innerDeleteForward = [];
            const innerDeleteReverse = [];
            for (const key of Object.keys(lidMappingBucket)) {
                if (key.endsWith(REVERSE_SUFFIX))
                    continue;
                const pnUser = key;
                const lidUser = lidMappingBucket[key];
                if (lidUser === null || lidUser === undefined) {
                    // Forward delete request. WhatsApp can link multiple device-
                    // LIDs to one PN over time, so `getLidForPn` returning the
                    // most-recent isn't enough — N-1 historic LIDs would still
                    // be visible via batchGetPnForLid. Wipe them all.
                    // (audit MDB-01)
                    const allLids = jidMap.getAllLidsForPn(pnUser);
                    for (const l of allLids) {
                        deletes.push(l);
                        // Also propagate the corresponding `_reverse` delete to
                        // the inner store — without this, a legacy reverse
                        // mapping `${lid}_reverse → pnUser` left behind in the
                        // inner store would re-surface (and point at the
                        // just-deleted PN) on the next `getKey` fallback.
                        // (audit thread 12)
                        innerDeleteReverse.push(l + REVERSE_SUFFIX);
                    }
                    innerDeleteForward.push(pnUser);
                    continue;
                }
                const reverseKey = lidUser + REVERSE_SUFFIX;
                const reverseVal = lidMappingBucket[reverseKey];
                if (reverseVal === pnUser) {
                    pairs.push({ pnUser, lidUser });
                    seenReverse.add(reverseKey);
                }
                else {
                    forwardOnly.push({ pnUser, lidUser });
                }
            }
            for (const key of Object.keys(lidMappingBucket)) {
                if (!key.endsWith(REVERSE_SUFFIX) || seenReverse.has(key))
                    continue;
                const lidUser = key.slice(0, -REVERSE_SUFFIX.length);
                const pnUser = lidMappingBucket[key];
                if (pnUser === null || pnUser === undefined) {
                    // Reverse delete — keyed by LID directly.
                    deletes.push(lidUser);
                    innerDeleteReverse.push(key); // include the `_reverse` suffix
                    // Also clean up the FORWARD direction in the inner store.
                    // Reverse-only delete was leaving any legacy `pnUser →
                    // lidUser` entry intact in the inner store, so a later
                    // `inner.get('lid-mapping', [pnUser])` would resurrect the
                    // just-deleted LID via the fallback path. Resolve the PN
                    // from the typed backend (synchronous) and queue its
                    // forward delete too.
                    const resolvedPn = jidMap.getPnForLid(lidUser);
                    if (resolvedPn)
                        innerDeleteForward.push(resolvedPn);
                    continue;
                }
                reverseOnly.push({ pnUser, lidUser });
            }
            // Cross-DB write ordering — see comment in
            // `use-multi-db-sqlite-auth-state.ts:clear` for why this matters.
            // Order chosen here:
            //   1. Forward the rest of `data` to the inner store (axolotl.db).
            //   2. Then write jid_map (msgstore.db).
            // A crash between 1 and 2 leaves jid_map STALE relative to the
            // newer Signal keys. On the next session establishment, the missing
            // `jid_map` row is rebuilt naturally by the LIDMappingStore — no
            // catastrophic loss. The reverse order would leave the Signal keys
            // missing while jid_map still resolves PN→LID, causing decryption
            // failures for those contacts until WhatsApp re-emits the mapping.
            // (audit P1-SQDB-03)
            const rest = {};
            let hasRest = false;
            for (const t in data) {
                if (t === 'lid-mapping')
                    continue;
                rest[t] = data[t];
                hasRest = true;
            }
            // Propagate deletes to the inner store as well — covers legacy
            // lid-mapping entries that landed there before Phase 9 migrated
            // the typed jid_map backend in. Without this they resurrect via
            // `inner.get` fallback. (audit MDB-02)
            if (innerDeleteForward.length > 0 || innerDeleteReverse.length > 0) {
                const lidMappingDeletes = {};
                for (const pn of innerDeleteForward)
                    lidMappingDeletes[pn] = null;
                for (const reverseKey of innerDeleteReverse)
                    lidMappingDeletes[reverseKey] = null;
                rest['lid-mapping'] = lidMappingDeletes;
                hasRest = true;
            }
            if (hasRest)
                await inner.set(rest);
            // Now persist jid_map changes. Wrapped in try/catch so the catch
            // arm below can distinguish SQLITE_BUSY (re-raise so the upstream
            // `runSetWithBusyRetry` can drive a backoff) from anything else
            // (let it propagate). NOT best-effort — every error path
            // rethrows; the wrapper is purely about classifying.
            try {
                if (deletes.length > 0) {
                    for (const lidUser of deletes)
                        jidMap.deleteMapping(lidUser);
                }
                if (pairs.length > 0)
                    jidMap.storeMappingsBatch(pairs);
                for (const m of forwardOnly)
                    jidMap.storeMapping(m.pnUser, m.lidUser);
                for (const m of reverseOnly)
                    jidMap.storeMapping(m.pnUser, m.lidUser);
            }
            catch (err) {
                // Re-raise SQLITE_BUSY so caller-level retry (e.g.
                // `runSetWithBusyRetry` in `use-multi-db-sqlite-auth-state`)
                // can drive a backoff. Anything else (constraint violation,
                // disk full) is a hard error — let it propagate. (P2-SQDB-01)
                throw err;
            }
        }
    };
}
//# sourceMappingURL=keys-with-jid-map.js.map