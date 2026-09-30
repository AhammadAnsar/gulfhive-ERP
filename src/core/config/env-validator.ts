/**
 * GulfHive ERP - Environment & Production Configuration Validator
 * Validates essential security keys, database parameters, and runtime configuration.
 * Fails startup safely with actionable diagnostics in production mode if required configuration is missing.
 */

import { logger } from '../logging/logger.ts';
import { appConfig } from './app-config.ts';

export interface EnvValidationResult {
  readonly isValid: boolean;
  readonly errors: string[];
  readonly warnings: string[];
}

export class EnvironmentValidator {
  public static validate(): EnvValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const isProd = process.env.NODE_ENV === 'production' || appConfig.isProduction;

    // 1. Database Configuration
    if (!process.env.SQL_HOST && !process.env.DATABASE_URL) {
      errors.push('DATABASE_URL or SQL_HOST is missing. Database connection cannot be established.');
    }

    if (!process.env.SQL_USER && !process.env.DATABASE_URL) {
      errors.push('SQL_USER is missing.');
    }

    // 2. JWT & Security Secrets
    const jwtSecret = process.env.JWT_SECRET;
    if (isProd) {
      if (!jwtSecret || jwtSecret.length < 32) {
        errors.push('JWT_SECRET must be set and at least 32 characters long in production mode.');
      }
      if (jwtSecret === 'development-jwt-secret-key-change-in-production') {
        errors.push('Insecure default JWT_SECRET detected in production environment.');
      }
    } else {
      if (!jwtSecret) {
        warnings.push('JWT_SECRET is not explicitly set; using development fallback secret.');
      }
    }

    // 3. Storage Configuration Check
    if (appConfig.deploymentMode === 'ONLINE_CLOUD_HOSTED') {
      const objProvider = process.env.OBJECT_STORAGE_PROVIDER;
      if (!objProvider && !process.env.STORAGE_BUCKET) {
        warnings.push('OBJECT_STORAGE_PROVIDER / STORAGE_BUCKET is NOT_CONFIGURED. Local storage will be used for document attachments.');
      }
    }

    const isValid = errors.length === 0;

    if (!isValid) {
      logger.error('CRITICAL: Environment validation failed!', { errors, warnings });
    } else if (warnings.length > 0) {
      logger.warn('Environment validation passed with warnings', { warnings });
    } else {
      logger.info('Environment validation passed successfully.');
    }

    return { isValid, errors, warnings };
  }

  /**
   * Enforces environment validation, throwing if invalid in production.
   */
  public static assertValidOrExit(): void {
    const result = this.validate();
    if (!result.isValid && (process.env.NODE_ENV === 'production' || process.env.STRICT_ENV_CHECK === 'true')) {
      throw new Error(
        `Production Startup Aborted due to Environment Configuration Errors:\n - ${result.errors.join('\n - ')}`
      );
    }
  }
}
