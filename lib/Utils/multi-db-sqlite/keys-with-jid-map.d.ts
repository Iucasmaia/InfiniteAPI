/**
 * Phase 9.1 — `wrapKeysWithJidMap` plugs the typed {@link JidMapBackend}
 * into any `SignalKeyStoreWithTransaction`-shaped store by intercepting
 * the `'lid-mapping'` type.
 *
 * Behavior:
 *   - `get('lid-mapping', ids)` is answered from `jid_map` directly. IDs
 *     ending in `_reverse` are treated as LID-to-PN lookups; others as
 *     PN-to-LID lookups. Other types fall through to the inner store.
 *   - `set({ 'lid-mapping': { ... } })` pairs each `pnUser`/`lidUser_reverse`
 *     entry and writes a single `jid_map` row per pair. Other types fall
 *     through unchanged.
 *   - `clear`, `list`, `listIds`, `transaction`, `transactWith`, `destroy`,
 *     and `isInTransaction` delegate to the inner store unchanged.
 *
 * Why a wrapper and not a fork of `LIDMappingStore`?
 *   The existing `LIDMappingStore` carries InfiniteAPI-specific cache
 *   coalescing, retry logic, statistics, and metrics that we want to keep
 *   intact. Swapping persistence behind it via this wrapper preserves all
 *   of that and lets us introduce typed-table storage without altering
 *   message-routing code paths.
 */
import type { SignalKeyStoreWithTransaction } from '../../Types/index.js';
import { JidMapBackend } from './lid-mapping-backend.js';
/**
 * Returns a new store that proxies `inner`, intercepting only the
 * `'lid-mapping'` type.
 *
 * The returned object satisfies the same `SignalKeyStoreWithTransaction`
 * surface as `inner` so it can be used wherever the existing
 * {@link LIDMappingStore} expects a key store.
 */
export declare function wrapKeysWithJidMap(inner: SignalKeyStoreWithTransaction, jidMap: JidMapBackend): SignalKeyStoreWithTransaction;
//# sourceMappingURL=keys-with-jid-map.d.ts.map