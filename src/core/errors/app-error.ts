/**
 * GulfHive ERP - Enterprise Error Hierarchy
 * Standardized typed errors with bilingual translation keys and HTTP status mapping.
 */

export abstract class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly translationKey: string;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, code: string, statusCode: number, translationKey: string, details?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.translationKey = translationKey;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class DomainError extends AppError {
  constructor(message: string, code = 'DOMAIN_RULE_VIOLATION', details?: Record<string, unknown>) {
    super(message, code, 422, `error.domain.${code.toLowerCase()}`, details);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_FAILED', 400, 'error.validation.failed', details);
  }
}

export class NotFoundError extends AppError {
  constructor(entityName: string, identifier: string | number) {
    super(
      `${entityName} with identifier '${identifier}' was not found.`,
      'NOT_FOUND',
      404,
      'error.not_found',
      { entityName, identifier }
    );
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required.') {
    super(message, 'UNAUTHORIZED', 401, 'error.unauthorized');
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = 'Invalid credentials or session expired.') {
    super(message, 'UNAUTHENTICATED', 401, 'error.unauthenticated');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions for this operation.') {
    super(message, 'FORBIDDEN', 403, 'error.forbidden');
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFLICT', 409, 'error.conflict', details);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, originalError?: unknown) {
    super(
      'An internal database operation failed.',
      'DATABASE_ERROR',
      500,
      'error.database.internal',
      { sanitizedMessage: message }
    );
    if (originalError) {
      this.cause = originalError;
    }
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR', 500, 'error.system.config');
  }
}
