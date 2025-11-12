/**
 * Logging System for Linera React Client
 *
 * Provides flexible, configurable logging with:
 * - Multiple log levels (NONE, ERROR, WARN, INFO, DEBUG)
 * - Environment-aware defaults (disabled in production)
 * - Custom logger support
 * - Prefix customization
 */

/**
 * Available log levels
 */
export enum LogLevel {
  /** No logging */
  NONE = 0,
  /** Only errors */
  ERROR = 1,
  /** Errors and warnings */
  WARN = 2,
  /** Errors, warnings, and info */
  INFO = 3,
  /** All logs including debug */
  DEBUG = 4,
}

/**
 * Custom logger interface for advanced use cases
 */
export interface CustomLogger {
  debug: <T extends unknown[]>(message: string, ...args: T) => void;
  info: <T extends unknown[]>(message: string, ...args: T) => void;
  warn: <T extends unknown[]>(message: string, ...args: T) => void;
  error: <T extends unknown[]>(message: string, ...args: T) => void;
}

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  /**
   * Enable or disable logging
   * @default process.env.NODE_ENV !== 'production'
   */
  enabled?: boolean;

  /**
   * Log level - controls which messages are logged
   * @default LogLevel.DEBUG (dev), LogLevel.ERROR (production)
   */
  level?: LogLevel;

  /**
   * Prefix for all log messages
   * @default '[Linera]'
   */
  prefix?: string;

  /**
   * Custom logger implementation
   * Useful for integrating with logging services (Sentry, LogRocket, etc.)
   */
  customLogger?: CustomLogger;
}

/**
 * Logger class - handles all logging operations
 */
export class Logger {
  private config: Required<LoggerConfig>;

  constructor(config?: LoggerConfig) {
    // Determine defaults based on environment
    const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

    this.config = {
      enabled: config?.enabled ?? isDev,
      level: config?.level ?? (isDev ? LogLevel.DEBUG : LogLevel.ERROR),
      prefix: config?.prefix ?? '[Linera]',
      customLogger: config?.customLogger ?? {
        debug: console.debug.bind(console),
        info: console.info.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console),
      },
    };
  }

  /**
   * Update logger configuration
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Log debug message
   */
  debug<T extends unknown[]>(message: string, ...args: T): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.config.customLogger.debug(`${this.config.prefix} ${message}`, ...args);
    }
  }

  /**
   * Log info message
   */
  info<T extends unknown[]>(message: string, ...args: T): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.config.customLogger.info(`${this.config.prefix} ${message}`, ...args);
    }
  }

  /**
   * Log warning message
   */
  warn<T extends unknown[]>(message: string, ...args: T): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.config.customLogger.warn(`${this.config.prefix} ${message}`, ...args);
    }
  }

  /**
   * Log error message
   */
  error<T extends unknown[]>(message: string, ...args: T): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.config.customLogger.error(`${this.config.prefix} ${message}`, ...args);
    }
  }

  /**
   * Check if we should log at the given level
   */
  private shouldLog(level: LogLevel): boolean {
    return this.config.enabled && this.config.level >= level;
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<Required<LoggerConfig>> {
    return { ...this.config };
  }
}

/**
 * Global logger instance
 */
let globalLogger: Logger | null = null;

/**
 * Create and set the global logger instance
 */
export function createLogger(config?: LoggerConfig): Logger {
  globalLogger = new Logger(config);
  return globalLogger;
}

/**
 * Get the global logger instance
 * Creates a default logger if none exists
 */
export function getLogger(): Logger {
  if (!globalLogger) {
    globalLogger = new Logger();
  }
  return globalLogger;
}

/**
 * Reset the global logger (useful for testing)
 */
export function resetLogger(): void {
  globalLogger = null;
}

/**
 * Convenience function - log debug message
 */
export function debug<T extends unknown[]>(message: string, ...args: T): void {
  getLogger().debug(message, ...args);
}

/**
 * Convenience function - log info message
 */
export function info<T extends unknown[]>(message: string, ...args: T): void {
  getLogger().info(message, ...args);
}

/**
 * Convenience function - log warning message
 */
export function warn<T extends unknown[]>(message: string, ...args: T): void {
  getLogger().warn(message, ...args);
}

/**
 * Convenience function - log error message
 */
export function error<T extends unknown[]>(message: string, ...args: T): void {
  getLogger().error(message, ...args);
}

/**
 * Proxy-based logger that always delegates to the current global instance
 *
 * This allows you to import once and use throughout your code:
 *
 * @example
 * ```typescript
 * import { logger } from '@linera/react-sdk/utils';
 *
 * // Use directly without calling getLogger() every time
 * logger.info('Client initialized');
 * logger.error('Failed to connect', error);
 * ```
 *
 * The proxy ensures you always use the configured logger instance,
 * even if it's configured after module load (e.g., by LineraProvider)
 */
export const logger = {
  /**
   * Log debug message
   */
  debug<T extends unknown[]>(message: string, ...args: T): void {
    getLogger().debug(message, ...args);
  },

  /**
   * Log info message
   */
  info<T extends unknown[]>(message: string, ...args: T): void {
    getLogger().info(message, ...args);
  },

  /**
   * Log warning message
   */
  warn<T extends unknown[]>(message: string, ...args: T): void {
    getLogger().warn(message, ...args);
  },

  /**
   * Log error message
   */
  error<T extends unknown[]>(message: string, ...args: T): void {
    getLogger().error(message, ...args);
  },

  /**
   * Get current logger configuration
   */
  getConfig(): Readonly<Required<LoggerConfig>> {
    return getLogger().getConfig();
  },

  /**
   * Update logger configuration dynamically
   */
  configure(config: Partial<LoggerConfig>): void {
    getLogger().configure(config);
  },
} as const;
