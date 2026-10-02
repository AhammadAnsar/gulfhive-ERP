/**
 * GulfHive ERP - Centralized API Error Handling Middleware
 * Serializes standard AppErrors and uncaught exceptions into uniform JSON contracts.
 * Suppresses stack traces in production environment.
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app-error.ts';
import { logger } from '../logging/logger.ts';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const correlationId = (res.getHeader('X-Correlation-ID') as string) || (req.headers['x-correlation-id'] as string) || 'unknown';

  if (err instanceof AppError) {
    logger.warn(`API Error [${err.code}] (${err.statusCode}): ${err.message}`, {
      correlationId,
      code: err.code,
      statusCode: err.statusCode,
      details: err.details,
      path: req.originalUrl,
    });

    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      translationKey: err.translationKey,
      details: err.details,
      correlationId,
    });
  }

  // Handle database constraint or unexpected runtime errors
  const isDev = process.env.NODE_ENV !== 'production';
  logger.error(`Unhandled API Exception on ${req.method} ${req.originalUrl}:`, err, {
    correlationId,
    stack: err?.stack,
  });

  const statusCode = err.status || err.statusCode || 500;
  const publicMessage = isDev
    ? err?.message || 'An unexpected server error occurred.'
    : 'An internal server error occurred. Please contact system administrator.';

  return res.status(statusCode).json({
    success: false,
    error: publicMessage,
    code: err.code || 'INTERNAL_SERVER_ERROR',
    translationKey: 'error.system.internal',
    correlationId,
  });
}
