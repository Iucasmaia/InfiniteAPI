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
import type P from 'pino';
import type { ILogger } from './logger.js';
import { createStructuredLogger, type LogLevel } from './structured-logger.js';
/**
 * Tipo de logger suportado
 */
export type LoggerType = 'pino' | 'console' | 'structured' | 'custom';
/**
 * Configuração do adapter
 */
export interface LoggerAdapterConfig {
    /** Tipo de logger de origem */
    sourceType: LoggerType;
    /** Tipo de logger de destino */
    targetType: LoggerType;
    /** Mapeamento customizado de níveis */
    levelMapping?: Record<string, LogLevel>;
    /** Transformador de contexto */
    contextTransformer?: (context: Record<string, unknown>) => Record<string, unknown>;
    /** Filtro de logs */
    logFilter?: (level: LogLevel, message: string, data?: unknown) => boolean;
}
/**
 * Classe adaptadora principal
 */
export declare class LoggerAdapter implements ILogger {
    private sourceLogger;
    private targetLogger;
    private config;
    constructor(sourceLogger: ILogger, config?: Partial<LoggerAdapterConfig>);
    get level(): string;
    set level(newLevel: string);
    /**
     * Define o logger de destino
     */
    setTargetLogger(logger: ILogger): void;
    /**
     * Cria um logger filho
     */
    child(obj: Record<string, unknown>): LoggerAdapter;
    /**
     * Mapeia nível de log
     */
    private mapLevel;
    /**
     * Verifica se o log deve ser processado
     */
    private shouldLog;
    /**
     * Processa log em ambos loggers
     */
    private processLog;
    trace(obj: unknown, msg?: string): void;
    debug(obj: unknown, msg?: string): void;
    info(obj: unknown, msg?: string): void;
    warn(obj: unknown, msg?: string): void;
    error(obj: unknown, msg?: string): void;
}
/**
 * Wrapper para converter Pino logger em StructuredLogger
 */
export declare class PinoToStructuredAdapter implements ILogger {
    private pinoLogger;
    private structuredLogger;
    constructor(pinoLogger: P.Logger, structuredLoggerConfig?: Parameters<typeof createStructuredLogger>[0]);
    get level(): string;
    set level(newLevel: string);
    private mapPinoLevel;
    child(obj: Record<string, unknown>): PinoToStructuredAdapter;
    trace(obj: unknown, msg?: string): void;
    debug(obj: unknown, msg?: string): void;
    info(obj: unknown, msg?: string): void;
    warn(obj: unknown, msg?: string): void;
    error(obj: unknown, msg?: string): void;
    /**
     * Obtém métricas do structured logger
     */
    getMetrics(): import("./structured-logger.js").LoggerMetrics;
}
/**
 * Factory para criar adapter baseado no tipo de logger
 */
export declare function createLoggerAdapter(logger: ILogger, config?: Partial<LoggerAdapterConfig>): LoggerAdapter;
/**
 * Converte qualquer logger para a interface ILogger
 */
export declare function normalizeLogger(logger: unknown): ILogger;
/**
 * Verifica se objeto implementa ILogger
 */
export declare function isILogger(obj: unknown): obj is ILogger;
/**
 * Cria um logger baseado em console
 */
export declare function createConsoleLogger(prefix?: string): ILogger;
export default LoggerAdapter;
//# sourceMappingURL=logger-adapter.d.ts.map