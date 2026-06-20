/**
 * Configurable Logger for Baileys
 *
 * Supports environment variables:
 * - BAILEYS_LOG: Enable/disable logging (default: true)
 * - BAILEYS_LOG_LEVEL: Log level - trace/debug/info/warn/error/fatal/silent (default: info)
 * - USE_STRUCTURED_LOGS: Use structured logger with advanced features (default: false)
 * - LOG_FORMAT: Output format - 'json' or 'pretty' (default: json)
 * - LOGGER_INFO: Enable info level (default: true)
 * - LOGGER_WARN: Enable warn level (default: true)
 * - LOGGER_ERROR: Enable error level (default: true)
 *
 * @module Utils/logger
 */
export interface ILogger {
    level: string;
    child(obj: Record<string, unknown>): ILogger;
    trace(obj: unknown, msg?: string): void;
    debug(obj: unknown, msg?: string): void;
    info(obj: unknown, msg?: string): void;
    warn(obj: unknown, msg?: string): void;
    error(obj: unknown, msg?: string): void;
}
/**
 * Logger configuration from environment variables
 */
interface LoggerConfig {
    enabled: boolean;
    level: string;
    format: 'json' | 'pretty';
    useStructuredLogs: boolean;
    levelFilters: {
        info: boolean;
        warn: boolean;
        error: boolean;
    };
}
/**
 * Load logger configuration from environment
 */
declare function loadLoggerConfig(): LoggerConfig;
declare const logger: ILogger;
export default logger;
export { loadLoggerConfig, type LoggerConfig };
//# sourceMappingURL=logger.d.ts.map