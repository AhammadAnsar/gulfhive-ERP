/**
 * GulfHive ERP - Production JSON Structured Logger
 * Emits uniform JSON logs suitable for Cloud Logging, on-prem log aggregators, and local debugging.
 */

import { ILogger, LogContext } from './logger.interface.ts';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export class AppLogger implements ILogger {
  private readonly defaultModule: string;
  private readonly isProduction: boolean;

  constructor(defaultModule = 'Core') {
    this.defaultModule = defaultModule;
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  public debug(message: string, context?: LogContext): void {
    if (!this.isProduction) {
      this.writeLog('DEBUG', message, undefined, context);
    }
  }

  public info(message: string, context?: LogContext): void {
    this.writeLog('INFO', message, undefined, context);
  }

  public warn(message: string, context?: LogContext): void {
    this.writeLog('WARN', message, undefined, context);
  }

  public error(message: string, error?: unknown, context?: LogContext): void {
    this.writeLog('ERROR', message, error, context);
  }

  public audit(action: string, entityType: string, entityId: string, details?: Record<string, unknown>, context?: LogContext): void {
    const auditPayload = {
      auditAction: action,
      entityType,
      entityId,
      details,
      ...context,
    };
    this.writeLog('INFO', `[AUDIT] ${action} on ${entityType} (${entityId})`, undefined, auditPayload);
  }

  private writeLog(level: LogLevel, message: string, error?: unknown, context?: LogContext): void {
    const timestamp = new Date().toISOString();
    const moduleName = context?.module || this.defaultModule;

    const entry: Record<string, unknown> = {
      timestamp,
      severity: level,
      module: moduleName,
      message,
    };

    if (context) {
      const { module: _m, ...rest } = context;
      if (Object.keys(rest).length > 0) {
        entry.context = rest;
      }
    }

    if (error) {
      if (error instanceof Error) {
        entry.error = {
          name: error.name,
          message: error.message,
          stack: this.isProduction ? undefined : error.stack,
          cause: error.cause,
        };
      } else {
        entry.error = String(error);
      }
    }

    // Output formatted JSON for machine ingestion
    const output = JSON.stringify(entry);
    if (level === 'ERROR') {
      console.error(output);
    } else if (level === 'WARN') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }
}

export const logger = new AppLogger('GulfHive');
