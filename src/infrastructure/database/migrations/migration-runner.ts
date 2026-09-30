/**
 * GulfHive ERP - Deterministic Database Migration Engine
 * Enforces reproducibility, checksum verification, and transactional schema updates.
 */

import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import { createPool } from '../../../db/index.ts';
import { logger } from '../../../core/logging/logger.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface MigrationFile {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
}

export interface MigrationStatus {
  readonly version: number;
  readonly name: string;
  readonly checksum: string;
  readonly appliedAt: Date;
  readonly executionTimeMs: number;
}

export class MigrationRunner {
  private readonly pool: Pool;

  constructor(pool?: Pool) {
    this.pool = pool || createPool();
  }

  public async runAllMigrations(): Promise<MigrationStatus[]> {
    await this.ensureMigrationTable();

    const m0001Path = path.resolve(__dirname, '0001_initial_core_schema.sql');
    const m0002Path = path.resolve(__dirname, '0002_organization_master_data.sql');
    const m0004Path = path.resolve(__dirname, '0004_identity_security_authorization.sql');
    const m0005Path = path.resolve(__dirname, '0005_people_employee_module.sql');
    const m0006Path = path.resolve(__dirname, '0006_time_attendance_timesheet.sql');

    const migrations: MigrationFile[] = [];

    if (fs.existsSync(m0001Path)) {
      migrations.push({
        version: 1,
        name: '0001_initial_core_schema.sql',
        sql: fs.readFileSync(m0001Path, 'utf8'),
      });
    }

    if (fs.existsSync(m0002Path)) {
      migrations.push({
        version: 2,
        name: '0002_organization_master_data.sql',
        sql: fs.readFileSync(m0002Path, 'utf8'),
      });
    }

    if (fs.existsSync(m0004Path)) {
      migrations.push({
        version: 4,
        name: '0004_identity_security_authorization.sql',
        sql: fs.readFileSync(m0004Path, 'utf8'),
      });
    }

    if (fs.existsSync(m0005Path)) {
      migrations.push({
        version: 5,
        name: '0005_people_employee_module.sql',
        sql: fs.readFileSync(m0005Path, 'utf8'),
      });
    }

    if (fs.existsSync(m0006Path)) {
      migrations.push({
        version: 6,
        name: '0006_time_attendance_timesheet.sql',
        sql: fs.readFileSync(m0006Path, 'utf8'),
      });
    }

    const results: MigrationStatus[] = [];
    for (const m of migrations) {
      const status = await this.runMigration(m);
      results.push(status);
    }
    return results;
  }

  public async ensureMigrationTable(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          checksum TEXT NOT NULL,
          applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          execution_time_ms INTEGER NOT NULL
        );
      `);
    } finally {
      client.release();
    }
  }

  public async getAppliedMigrations(): Promise<MigrationStatus[]> {
    await this.ensureMigrationTable();
    const client = await this.pool.connect();
    try {
      const res = await client.query(`
        SELECT version, name, checksum, applied_at AS "appliedAt", execution_time_ms AS "executionTimeMs"
        FROM schema_migrations
        ORDER BY version ASC;
      `);
      return res.rows;
    } finally {
      client.release();
    }
  }

  public async runMigration(migration: MigrationFile): Promise<MigrationStatus> {
    await this.ensureMigrationTable();
    const client = await this.pool.connect();
    const checksum = createHash('sha256').update(migration.sql.trim()).digest('hex');

    try {
      // Check if already applied
      const existing = await client.query('SELECT * FROM schema_migrations WHERE version = $1', [migration.version]);
      if (existing.rows.length > 0) {
        const row = existing.rows[0];
        if (row.checksum !== checksum) {
          throw new Error(
            `Migration checksum mismatch for version ${migration.version} (${migration.name}). Database has ${row.checksum}, file has ${checksum}. Migrations are immutable.`
          );
        }
        logger.info(`Migration ${migration.version} (${migration.name}) is already applied and verified.`);
        return {
          version: row.version,
          name: row.name,
          checksum: row.checksum,
          appliedAt: row.applied_at,
          executionTimeMs: row.execution_time_ms,
        };
      }

      logger.info(`Applying migration ${migration.version}: ${migration.name}...`);
      const startTime = Date.now();

      await client.query('BEGIN');
      await client.query(migration.sql);
      const executionTimeMs = Date.now() - startTime;

      await client.query(
        `INSERT INTO schema_migrations (version, name, checksum, execution_time_ms)
         VALUES ($1, $2, $3, $4)`,
        [migration.version, migration.name, checksum, executionTimeMs]
      );

      await client.query('COMMIT');
      logger.info(`Successfully applied migration ${migration.version} in ${executionTimeMs}ms`);

      return {
        version: migration.version,
        name: migration.name,
        checksum,
        appliedAt: new Date(),
        executionTimeMs,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error(`Migration ${migration.version} (${migration.name}) failed! Rolled back transaction.`, err);
      throw err;
    } finally {
      client.release();
    }
  }
}
