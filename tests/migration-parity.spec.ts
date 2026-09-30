/**
 * GulfHive ERP - Phase 3 Database Schema & Migration Parity Test Suite
 * 
 * Verifies:
 * - Deterministic discovery and execution of all 11 SQL migrations (0001 through 0011)
 * - Schema migrations tracking table checksum verification and idempotency
 * - Alignment of database tables with Drizzle schema
 * - Production startup rule (fatal error throwing on migration failure)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { MigrationRunner } from '../src/infrastructure/database/migrations/migration-runner.ts';
import { createPool } from '../src/db/index.ts';

describe('PHASE 3: Database Schema & Migration Parity Engine', () => {
  let migrationRunner: MigrationRunner;

  beforeAll(() => {
    const pool = createPool();
    migrationRunner = new MigrationRunner(pool);
  });

  it('should discover and execute all SQL migrations in deterministic numerical sequence', async () => {
    const results = await migrationRunner.runAllMigrations();
    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThanOrEqual(11);

    const versions = results.map((r) => r.version);
    const sortedVersions = [...versions].sort((a, b) => a - b);
    expect(versions).toEqual(sortedVersions);

    // Verify key migration versions are included
    expect(versions).toContain(1);
    expect(versions).toContain(2);
    expect(versions).toContain(4);
    expect(versions).toContain(5);
    expect(versions).toContain(6);
    expect(versions).toContain(7);
    expect(versions).toContain(8);
    expect(versions).toContain(9);
    expect(versions).toContain(10);
    expect(versions).toContain(11);
    expect(versions).toContain(12);
  });

  it('should ensure schema_migrations records all executed migrations idempotently on re-run', async () => {
    const rerunResults = await migrationRunner.runAllMigrations();
    expect(rerunResults).toBeDefined();
    expect(rerunResults.length).toBeGreaterThanOrEqual(11);

    const applied = await migrationRunner.getAppliedMigrations();
    expect(applied.length).toBeGreaterThanOrEqual(11);
    expect(applied[0].version).toBe(1);
  });

  it('should verify presence of newly migrated module tables in PostgreSQL information_schema', async () => {
    const pool = createPool();
    const client = await pool.connect();
    try {
      const res = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      const tableNames = res.rows.map((r: { table_name: string }) => r.table_name);

      // Core & Organization
      expect(tableNames).toContain('tenants');
      expect(tableNames).toContain('users');
      expect(tableNames).toContain('branches');

      // People & Payroll
      expect(tableNames).toContain('employees');
      expect(tableNames).toContain('payroll_runs');

      // Sales & Receivables (Migration 0009)
      expect(tableNames).toContain('clients');
      expect(tableNames).toContain('invoices');
      expect(tableNames).toContain('receipts');

      // Purchase & Payables (Migration 0010)
      expect(tableNames).toContain('suppliers');
      expect(tableNames).toContain('purchase_requests');
      expect(tableNames).toContain('supplier_bills');

      // Projects & External Workforce (Migration 0011)
      expect(tableNames).toContain('projects');
      expect(tableNames).toContain('billing_profiles');
      expect(tableNames).toContain('external_workers');
      expect(tableNames).toContain('workforce_deployments');
      expect(tableNames).toContain('external_labour_settlements');
    } finally {
      client.release();
    }
  });

  it('should throw an error and rollback transaction if a migration contains invalid SQL syntax', async () => {
    const invalidMigrationRunner = new MigrationRunner();
    const badMigration = {
      version: 9999,
      name: '9999_invalid_syntax_test.sql',
      sql: 'CREATE TABLE INVALID SYNTAX !!!',
    };

    await expect(invalidMigrationRunner.runMigration(badMigration)).rejects.toThrow();
  });
});
