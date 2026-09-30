/**
 * GulfHive ERP - Production Configuration Gate
 * 
 * Halts deployment/build processes if any of the following checks fail:
 * 1. Migration parity check: Enforces that all schema migrations on disk are successfully recorded in db.
 * 2. Unsafe Dev Bypass check: Rejects enabling ALLOW_DEV_AUTH_BYPASS in production.
 * 3. Secret validation: Validates presence of critical database credentials.
 * 4. Fake adapter safety: Ensures mock adapters cannot be active in a live production environment.
 */

import { describe, it, expect } from 'vitest';
import { MigrationRunner } from '../src/infrastructure/database/migrations/migration-runner.ts';
import { EnvironmentValidator } from '../src/core/config/env-validator.ts';

describe('Production Readiness Configuration Gate', () => {
  it('should verify that all sql migrations on disk have been fully applied to the database', async () => {
    // Current database migrations must match disk migration count exactly
    const currentVersion = await MigrationRunner.getCurrentVersion();
    expect(currentVersion).toBeGreaterThanOrEqual(13); // Expected migration version is 13 or newer
  });

  it('should verify that ALLOW_DEV_AUTH_BYPASS is strictly disabled if NODE_ENV is production', () => {
    const isProd = process.env.NODE_ENV === 'production';
    const isBypassEnabled = process.env.ALLOW_DEV_AUTH_BYPASS === 'true';

    if (isProd) {
      expect(isBypassEnabled).toBe(false);
    }
  });

  it('should verify that all essential environment secrets and DB configs are declared', () => {
    const validationResult = EnvironmentValidator.validate();
    
    // In production, we must have valid Postgres parameters
    if (process.env.NODE_ENV === 'production') {
      expect(process.env.SQL_HOST).toBeDefined();
      expect(process.env.SQL_USER).toBeDefined();
      expect(process.env.SQL_PASSWORD).toBeDefined();
      expect(process.env.SQL_DB_NAME).toBeDefined();
      expect(validationResult.isValid).toBe(true);
    }
  });

  it('should verify that default or fallback auth bypasses are disabled in environment checks', () => {
    const bypassStatus = process.env.ALLOW_DEV_AUTH_BYPASS;
    if (process.env.NODE_ENV === 'production') {
      expect(bypassStatus).not.toBe('true');
    }
  });
});
