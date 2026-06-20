/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * @fileoverview Adaptador entre diferentes sistemas de logging
 * @module Utils/logger-adapter
 *
 * Fornece:
 * - Adapter pattern para integrar diferentes loggers
 * - Mapeamento de níveis de log entre sistemas
 * - Transformação de formatos de log
 * - Compatibilidade com Pino, Console e StructuredLogger
 */
import { createStructuredLogger, LOG_LEVEL_VALUES, StructuredLogger } from './structured-logger.js';
/**
 * Mapeamento padrão de níveis Pino para StructuredLogger
 */
const PINO_LEVEL_MAPPING = {
    10: 'trace',
    20: 'debug',
    30: 'info',
    40: 'warn',
    50: 'error',
    60: 'fatal'
};
/**
 * Mapeamento reverso para Pino
 */
const STRUCTURED_TO_PINO_LEVEL = {
    trace: 10,
    debug: 20,
    info: 30,
    warn: 40,
    error: 50,
    fatal: 60,
    silent: 100
};
/**
 * Classe adaptadora principal
 */
export class LoggerAdapter {
    constructor(sourceLogger, config = {}) {
        this.targetLogger = null;
        this.sourceLogger = sourceLogger;
        this.config = {
            sourceType: config.sourceType || 'pino',
            targetType: config.targetType || 'structured',
            levelMapping: config.levelMapping,
            contextTransformer: config.contextTransformer,
            logFilter: config.logFilter
        };
    }
    get level() {
        return this.sourceLogger.level;
    }
    set level(newLevel) {
        this.sourceLogger.level = newLevel;
        if (this.targetLogger) {
            this.targetLogger.level = newLevel;
        }
    }
    /**
     * Define o logger de destino
     */
    setTargetLogger(logger) {
        this.targetLogger = logger;
    }
    /**
     * Cria um logger filho
     */
    child(obj) {
        const transformedContext = this.config.contextTransformer ? this.config.contextTransformer(obj) : obj;
        const childAdapter = new LoggerAdapter(this.sourceLogger.child(transformedContext), this.config);
        if (this.targetLogger) {
            childAdapter.setTargetLogger(this.targetLogger.child(transformedContext));
        }
        return childAdapter;
    }
    /**
     * Mapeia nível de log
     */
    mapLevel(level) {
        if (typeof level === 'number') {
            return PINO_LEVEL_MAPPING[level] || 'info';
        }
        if (this.config.levelMapping && level in this.config.levelMapping) {
            return this.config.levelMapping[level] ?? 'info';
        }
        return level || 'info';
    }
    /**
     * Verifica se o log deve ser processado
     */
    shouldLog(level, msg, obj) {
        if (this.config.logFilter) {
            return this.config.logFilter(level, msg, obj);
        }
        return true;
    }
    /**
     * Processa log em ambos loggers
     */
    processLog(level, obj, msg) {
        if (!this.shouldLog(level, msg || '', obj)) {
            return;
        }
        // Log no source logger
        const sourceMethod = this.sourceLogger[level];
        if (typeof sourceMethod === 'function') {
            ;
            sourceMethod.call(this.sourceLogger, obj, msg);
        }
        // Log no target logger se configurado
        if (this.targetLogger) {
            const targetMethod = this.targetLogger[level];
            if (typeof targetMethod === 'function') {
                ;
                targetMethod.call(this.targetLogger, obj, msg);
            }
        }
    }
    trace(obj, msg) {
        this.processLog('trace', obj, msg);
    }
    debug(obj, msg) {
        this.processLog('debug', obj, msg);
    }
    info(obj, msg) {
        this.processLog('info', obj, msg);
    }
    warn(obj, msg) {
        this.processLog('warn', obj, msg);
    }
    error(obj, msg) {
        this.processLog('error', obj, msg);
    }
}
/**
 * Wrapper para converter Pino logger em StructuredLogger
 */
export class PinoToStructuredAdapter {
    constructor(pinoLogger, structuredLoggerConfig) {
        this.pinoLogger = pinoLogger;
        this.structuredLogger = createStructuredLogger({
            level: this.mapPinoLevel(pinoLogger.level),
            ...structuredLoggerConfig
        });
    }
    get level() {
        return this.pinoLogger.level;
    }
    set level(newLevel) {
        this.pinoLogger.level = newLevel;
        this.structuredLogger.level = newLevel;
    }
    mapPinoLevel(pinoLevel) {
        const levelMap = {
            trace: 'trace',
            debug: 'debug',
            info: 'info',
            warn: 'warn',
            error: 'error',
            fatal: 'fatal',
            silent: 'silent'
        };
        return levelMap[pinoLevel] || 'info';
    }
    child(obj) {
        const adapter = new PinoToStructuredAdapter(this.pinoLogger.child(obj));
        return adapter;
    }
    trace(obj, msg) {
        this.pinoLogger.trace(obj, msg);
        this.structuredLogger.trace(obj, msg);
    }
    debug(obj, msg) {
        this.pinoLogger.debug(obj, msg);
        this.structuredLogger.debug(obj, msg);
    }
    info(obj, msg) {
        this.pinoLogger.info(obj, msg);
        this.structuredLogger.info(obj, msg);
    }
    warn(obj, msg) {
        this.pinoLogger.warn(obj, msg);
        this.structuredLogger.warn(obj, msg);
    }
    error(obj, msg) {
        this.pinoLogger.error(obj, msg);
        this.structuredLogger.error(obj, msg);
    }
    /**
     * Obtém métricas do structured logger
     */
    getMetrics() {
        return this.structuredLogger.getMetrics();
    }
}
/**
 * Factory para criar adapter baseado no tipo de logger
 */
export function createLoggerAdapter(logger, config) {
    return new LoggerAdapter(logger, config);
}
/**
 * Converte qualquer logger para a interface ILogger
 */
export function normalizeLogger(logger) {
    if (isILogger(logger)) {
        return logger;
    }
    // Se for um objeto com métodos de log
    if (typeof logger === 'object' && logger !== null) {
        const logObj = logger;
        return {
            level: logObj.level || 'info',
            child: (obj) => {
                if (typeof logObj.child === 'function') {
                    return normalizeLogger(logObj.child(obj));
                }
                return normalizeLogger(logger);
            },
            trace: createLogMethod(logObj, 'trace'),
            debug: createLogMethod(logObj, 'debug'),
            info: createLogMethod(logObj, 'info'),
            warn: createLogMethod(logObj, 'warn'),
            error: createLogMethod(logObj, 'error')
        };
    }
    // Fallback: console logger
    return createConsoleLogger();
}
/**
 * Verifica se objeto implementa ILogger
 */
export function isILogger(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }
    const logger = obj;
    return (typeof logger.child === 'function' &&
        typeof logger.trace === 'function' &&
        typeof logger.debug === 'function' &&
        typeof logger.info === 'function' &&
        typeof logger.warn === 'function' &&
        typeof logger.error === 'function');
}
/**
 * Cria método de log genérico
 */
function createLogMethod(logger, level) {
    return (obj, msg) => {
        if (typeof logger[level] === 'function') {
            ;
            logger[level](obj, msg);
        }
        else {
            // Fallback to console methods
            const consoleMethod = console[level];
            if (typeof consoleMethod === 'function') {
                consoleMethod(obj, msg);
            }
        }
    };
}
/**
 * Cria um logger baseado em console
 */
export function createConsoleLogger(prefix) {
    const formatMessage = (level, obj, msg) => {
        const timestamp = new Date().toISOString();
        const prefixStr = prefix ? `[${prefix}]` : '';
        const message = msg || (typeof obj === 'string' ? obj : '');
        const data = typeof obj === 'object' ? JSON.stringify(obj) : '';
        return `${timestamp} ${prefixStr}[${level.toUpperCase()}] ${message} ${data}`.trim();
    };
    return {
        level: 'info',
        child(obj) {
            const childPrefix = prefix ? `${prefix}:${Object.values(obj)[0]}` : String(Object.values(obj)[0]);
            return createConsoleLogger(childPrefix);
        },
        trace(obj, msg) {
            console.debug(formatMessage('trace', obj, msg));
        },
        debug(obj, msg) {
            console.debug(formatMessage('debug', obj, msg));
        },
        info(obj, msg) {
            console.info(formatMessage('info', obj, msg));
        },
        warn(obj, msg) {
            console.warn(formatMessage('warn', obj, msg));
        },
        error(obj, msg) {
            console.error(formatMessage('error', obj, msg));
        }
    };
}
export default LoggerAdapter;
//# sourceMappingURL=logger-adapter.js.map