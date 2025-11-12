/**
 * Utility Functions for Linera React Client
 */

export {
  Logger,
  LogLevel,
  createLogger,
  getLogger,
  resetLogger,
  debug,
  info,
  warn,
  error,
  logger, // Proxy-based logger instance for convenient usage
  type LoggerConfig,
  type CustomLogger,
} from './logger';
