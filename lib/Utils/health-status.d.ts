/**
 * Health Status Utilities
 *
 * Provides health check and status information for monitoring and k8s probes.
 *
 * @module Utils/health-status
 */
/**
 * Cache health information
 */
export interface CacheHealth {
    versionCache: {
        hasCache: boolean;
        isExpired: boolean;
        ageMs: number | null;
        source: string | null;
    };
}
/**
 * Overall health status
 */
export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: number;
    uptime: number;
    version: string;
    cache: CacheHealth;
    checks: {
        name: string;
        status: 'pass' | 'warn' | 'fail';
        message?: string;
    }[];
}
/**
 * Get the current health status of the Baileys instance.
 *
 * Useful for:
 * - Kubernetes liveness/readiness probes
 * - Load balancer health checks
 * - Monitoring dashboards
 *
 * @returns HealthStatus object with detailed status information
 *
 * @example
 * ```typescript
 * import { getHealthStatus } from '@whiskeysockets/baileys'
 *
 * // Simple health check endpoint
 * app.get('/health', (req, res) => {
 *   const health = getHealthStatus()
 *   const statusCode = health.status === 'healthy' ? 200 :
 *                      health.status === 'degraded' ? 200 : 503
 *   res.status(statusCode).json(health)
 * })
 *
 * // Kubernetes probe
 * app.get('/healthz', (req, res) => {
 *   const health = getHealthStatus()
 *   res.status(health.status !== 'unhealthy' ? 200 : 503).send(health.status)
 * })
 * ```
 */
export declare function getHealthStatus(): HealthStatus;
/**
 * Simple health check - returns true if system is healthy or degraded.
 * Use this for basic liveness probes.
 *
 * @returns true if healthy or degraded, false if unhealthy
 */
export declare function isHealthy(): boolean;
/**
 * Get a simple status string for minimal health endpoints.
 *
 * @returns 'ok', 'degraded', or 'error'
 */
export declare function getSimpleHealthStatus(): 'ok' | 'degraded' | 'error';
//# sourceMappingURL=health-status.d.ts.map