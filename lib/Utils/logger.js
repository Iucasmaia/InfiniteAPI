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
import { createRequire } from 'module';
import P, {} from 'pino';
const require = createRequire(import.meta.url);
/**
 * Load logger configuration from environment
 */
function loadLoggerConfig() {
    return {
        enabled: process.env.BAILEYS_LOG !== 'false',
        level: process.env.BAILEYS_LOG_LEVEL || 'info',
        format: process.env.LOG_FORMAT || 'json',
        useStructuredLogs: process.env.USE_STRUCTURED_LOGS === 'true',
        levelFilters: {
            info: process.env.LOGGER_INFO !== 'false',
            warn: process.env.LOGGER_WARN !== 'false',
            error: process.env.LOGGER_ERROR !== 'false'
        }
    };
}
function canUsePrettyTransport() {
    try {
        require.resolve('pino-pretty');
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Create a filtered logger that respects LOGGER_INFO/WARN/ERROR settings
 */
function createFilteredLogger(baseLogger, config) {
    const noop = () => { };
    return {
        get level() {
            return baseLogger.level;
        },
        set level(newLevel) {
            baseLogger.level = newLevel;
        },
        child(obj) {
            return createFilteredLogger(baseLogger.child(obj), config);
        },
        trace: baseLogger.trace.bind(baseLogger),
        debug: baseLogger.debug.bind(baseLogger),
        info: config.levelFilters.info ? baseLogger.info.bind(baseLogger) : noop,
        warn: config.levelFilters.warn ? baseLogger.warn.bind(baseLogger) : noop,
        error: config.levelFilters.error ? baseLogger.error.bind(baseLogger) : noop
    };
}
/**
 * Create a silent logger when logging is disabled
 */
function createSilentLogger() {
    const noop = () => { };
    const silentLogger = {
        level: 'silent',
        child: () => silentLogger,
        trace: noop,
        debug: noop,
        info: noop,
        warn: noop,
        error: noop
    };
    return silentLogger;
}
/**
 * Create the configured logger instance
 */
function createLogger() {
    const config = loadLoggerConfig();
    // If logging is disabled, return silent logger
    if (!config.enabled) {
        return createSilentLogger();
    }
    // Create pino options
    const pinoOptions = {
        level: config.level,
        timestamp: () => `,"time":"${new Date().toJSON()}"`
    };
    // Add pretty printing when explicitly set and available
    if (config.format === 'pretty' && canUsePrettyTransport()) {
        pinoOptions.transport = {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname'
            }
        };
    }
    const baseLogger = P(pinoOptions);
    return createFilteredLogger(baseLogger, config);
}
// Export the configured logger instance
const logger = createLogger();
export default logger;
// Export config loader for testing/inspection
export { loadLoggerConfig };
//# sourceMappingURL=logger.js.map