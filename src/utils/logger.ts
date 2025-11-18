import winston from 'winston';
import path from 'path';
import { LoggerConfig } from '../types';

const { combine, timestamp, printf, colorize, errors } = winston.format;

/**
 * Custom log format
 */
const logFormat = printf(({ level, message, timestamp, stack }) => {
  const ts = timestamp as string;
  if (stack) {
    return `${ts} [${level}]: ${message}\n${stack}`;
  }
  return `${ts} [${level}]: ${message}`;
});

/**
 * Create logger instance
 */
export function createLogger(config?: Partial<LoggerConfig>): winston.Logger {
  const defaultConfig: LoggerConfig = {
    level: 'info',
    logToFile: false,
    logFilePath: path.join(process.cwd(), 'logs', 'bundler.log'),
  };

  const finalConfig = { ...defaultConfig, ...config };

  const transports: winston.transport[] = [
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
    }),
  ];

  if (finalConfig.logToFile && finalConfig.logFilePath) {
    transports.push(
      new winston.transports.File({
        filename: finalConfig.logFilePath,
        format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      })
    );
  }

  return winston.createLogger({
    level: finalConfig.level,
    format: combine(errors({ stack: true }), timestamp(), logFormat),
    transports,
    exitOnError: false,
  });
}

/**
 * Default logger instance
 */
export const logger = createLogger({
  level: (process.env['LOG_LEVEL'] as LoggerConfig['level']) || 'info',
  logToFile: process.env['LOG_TO_FILE'] === 'true',
});

export default logger;
