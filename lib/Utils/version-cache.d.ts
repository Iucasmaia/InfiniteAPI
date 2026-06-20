import type { WAVersion } from '../Types/index.js';
/**
 * Logger interface for version cache operations
 */
export interface VersionCacheLogger {
    info: (obj: unknown, msg?: string) => void;
    debug: (obj: unknown, msg?: string) => void;
    warn: (obj: unknown, msg?: string) => void;
}
/**
 * Configuration for version cache
 */
export interface VersionCacheConfig {
    /** Cache TTL in milliseconds (default: 6 hours) */
    cacheTtlMs?: number;
    /**
     * Path to cache file (default: .baileys-version-cache.json in cwd)
     *
     * NOTE: If running in a container or serverless environment where cwd
     * is not writable, specify a writable path like '/tmp/.baileys-version-cache.json'
     */
    cacheFilePath?: string;
    /** Logger instance */
    logger?: VersionCacheLogger;
}
/**
 * Result from refreshVersionCache with success status
 */
export interface RefreshVersionResult {
    version: WAVersion;
    success: boolean;
    source: 'online' | 'fallback';
}
/**
 * Gets the cached WhatsApp version, fetching if necessary.
 *
 * Features:
 * - File-based persistence (survives restarts)
 * - In-memory cache (fast access)
 * - Request deduplication (150 connections = 1 request)
 * - Configurable TTL
 *
 * @example
 * ```typescript
 * // All 150 connections share the same cached version
 * const { version } = await getCachedVersion()
 * const sock = makeWASocket({ version, auth })
 * ```
 */
export declare function getCachedVersion(config?: VersionCacheConfig): Promise<{
    version: WAVersion;
    fromCache: boolean;
    age: number;
    source: 'online' | 'fallback' | 'memory' | 'file';
}>;
/**
 * Clears the version cache (memory and file).
 * Also cancels any in-progress fetch to prevent it from restoring the cache.
 */
export declare function clearVersionCache(cacheFilePath?: string): Promise<void>;
/**
 * Forces a refresh of the cached version.
 * Returns success status to indicate if online fetch succeeded or fell back to bundled version.
 *
 * @returns Object with version, success status, and source
 */
export declare function refreshVersionCache(config?: VersionCacheConfig): Promise<RefreshVersionResult>;
/**
 * Gets cache status information
 */
export declare function getVersionCacheStatus(cacheTtlMs?: number): {
    hasCache: boolean;
    version: WAVersion | null;
    age: number | null;
    isExpired: boolean;
    expiresIn: number | null;
    source: 'online' | 'fallback' | null;
};
//# sourceMappingURL=version-cache.d.ts.map