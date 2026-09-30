/**
 * GulfHive ERP - Structured Logger Interface
 */

export interface LogContext {
  tenantId?: string;
  correlationId?: string;
  userId?: string;
  module?: string;
  [key: string]: unknown;
}

export interface ILogger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: unknown, context?: LogContext): void;
  audit(action: string, entityType: string, entityId: string, details?: Record<string, unknown>, context?: LogContext): void;
}
