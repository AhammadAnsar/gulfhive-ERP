/**
 * GulfHive ERP - Phase 6 Integration Test Suite
 * Real Runtime, Storage, Backup & Deployment Reliability.
 * Covers:
 * 1. Document Storage: Write -> Read -> Compare exact bytes & SHA-256 checksum.
 * 2. Document Lifecycle: Delete -> Not Exists.
 * 3. Security Guards: Path traversal rejection & Cross-tenant isolation.
 * 4. Real Database Backup & Restore Drill: Create -> Verify -> Restore -> Corrupt Checksum Rejection.
 * 5. Hosted Storage Adapter: Unconfigured provider throws StorageNotConfiguredError.
 * 6. Diagnostics & System Health Checks: Queries live database, storage, migrations, and backups.
 * 7. Environment Validation Engine.
 */

import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/index.ts';
import { tenants, branches, employees } from '../src/db/schema.ts';
import { LocalFileStorageService } from '../src/infrastructure/storage/local-file-storage.ts';
import { HostedObjectStorageService } from '../src/infrastructure/storage/hosted-object-storage.ts';
import { DesktopDatabaseBackupService } from '../src/infrastructure/backup/desktop-database-backup.service.ts';
import {
  PathTraversalError,
  FileNotFoundError,
  StorageNotConfiguredError,
  CorruptedBackupError,
} from '../src/infrastructure/runtime/runtime-context.ts';
import { DesktopRuntimeAdapter } from '../src/infrastructure/runtime/desktop-runtime.ts';
import { EnvironmentValidator } from '../src/core/config/env-validator.ts';

describe('Phase 6: Real Runtime, Storage, Backup & Deployment Reliability', () => {
  const testStorageDir = path.resolve('./storage/test_documents');
  const testBackupDir = path.resolve('./storage/test_backups');

  const tenantA = `tenant_p6_a_${Date.now()}`;
  const tenantB = `tenant_p6_b_${Date.now()}`;

  const storageService = new LocalFileStorageService({ baseDirectory: testStorageDir });
  const backupService = new DesktopDatabaseBackupService(testBackupDir);

  beforeAll(async () => {
    // Seed Tenants
    await db.insert(tenants).values([
      {
        id: tenantA,
        code: `CO_P6A_${Date.now()}`,
        legalNameEn: 'Alpha Trading WLL',
        legalNameAr: 'شركة ألفا للتجارة',
        countryCode: 'KW',
        baseCurrency: 'KWD',
        isActive: true,
      },
      {
        id: tenantB,
        code: `CO_P6B_${Date.now()}`,
        legalNameEn: 'Beta Logistics Co.',
        legalNameAr: 'شركة بيتا للوجستيات',
        countryCode: 'SA',
        baseCurrency: 'SAR',
        isActive: true,
      },
    ]);
  });

  afterAll(async () => {
    try {
      await db.delete(tenants).where(eq(tenants.id, tenantA));
      await db.delete(tenants).where(eq(tenants.id, tenantB));
      if (fs.existsSync(testStorageDir)) {
        fs.rmSync(testStorageDir, { recursive: true, force: true });
      }
      if (fs.existsSync(testBackupDir)) {
        fs.rmSync(testBackupDir, { recursive: true, force: true });
      }
    } catch {
      // Cleanup fallback
    }
  });

  describe('1. Real Desktop Local Storage Operations', () => {
    it('should save document, read back, and verify exact byte equality and SHA-256 checksum', async () => {
      const content = Buffer.from('GulfHive Enterprise Document Content — Confidential 2026', 'utf-8');
      const docPath = 'contracts/2026/employment_agreement.pdf';

      const metadata = await storageService.saveDocument(tenantA, docPath, content, 'application/pdf');

      expect(metadata.path).toBe('contracts/2026/employment_agreement.pdf');
      expect(metadata.tenantId).toBe(tenantA);
      expect(metadata.sizeBytes).toBe(content.length);
      expect(metadata.checksum).toBeDefined();
      expect(metadata.checksum.startsWith('sha256:')).toBe(true);

      const { content: readContent, metadata: readMeta } = await storageService.readDocument(tenantA, docPath);

      expect(Buffer.compare(readContent, content)).toBe(0); // Exact byte equality
      expect(readMeta.checksum).toBe(metadata.checksum);
    });

    it('should delete document and verify exists returns false', async () => {
      const content = Buffer.from('Temporary Document To Delete', 'utf-8');
      const docPath = 'temp/delete_me.txt';

      await storageService.saveDocument(tenantA, docPath, content, 'text/plain');
      expect(await storageService.exists(tenantA, docPath)).toBe(true);

      const deleted = await storageService.deleteDocument(tenantA, docPath);
      expect(deleted).toBe(true);

      expect(await storageService.exists(tenantA, docPath)).toBe(false);
      await expect(storageService.readDocument(tenantA, docPath)).rejects.toThrow(FileNotFoundError);
    });

    it('should reject path traversal attempts (../ sequences)', async () => {
      const content = Buffer.from('Malicious Content', 'utf-8');
      const badPath = '../../etc/passwd';

      await expect(
        storageService.saveDocument(tenantA, badPath, content)
      ).rejects.toThrow(PathTraversalError);

      await expect(
        storageService.readDocument(tenantA, badPath)
      ).rejects.toThrow(PathTraversalError);
    });

    it('should isolate documents between tenants (Tenant A cannot read Tenant B document)', async () => {
      const contentA = Buffer.from('Tenant A Confidential Financial Statement', 'utf-8');
      const docPath = 'financials/statement.pdf';

      await storageService.saveDocument(tenantA, docPath, contentA, 'application/pdf');

      // Tenant B trying to read Tenant A's document path
      await expect(
        storageService.readDocument(tenantB, docPath)
      ).rejects.toThrow(FileNotFoundError);
    });
  });

  describe('2. Real Database Backup, Verification & Restore Drill', () => {
    it('should create real database backup, verify cryptographic checksum, and restore data', async () => {
      // 1. Create Backup
      const backupMeta = await backupService.createBackup();

      expect(backupMeta.backupId).toBeDefined();
      expect(backupMeta.checksum.startsWith('sha256:')).toBe(true);
      expect(backupMeta.sizeBytes).toBeGreaterThan(0);
      expect(backupMeta.filePath).toBeDefined();
      expect(fs.existsSync(backupMeta.filePath!)).toBe(true);

      // 2. Verify Backup
      const isValid = await backupService.verifyBackup(backupMeta.backupId);
      expect(isValid).toBe(true);

      // 3. List Backups
      const list = await backupService.listBackups();
      expect(list.length).toBeGreaterThan(0);
      expect(list.some(b => b.backupId === backupMeta.backupId)).toBe(true);

      // 4. Modify Database Record (Simulate Data Mutation)
      await db.update(tenants)
        .set({ legalNameEn: 'MUTATED ALPHA NAME' })
        .where(eq(tenants.id, tenantA));

      const [mutated] = await db.select().from(tenants).where(eq(tenants.id, tenantA));
      expect(mutated.legalNameEn).toBe('MUTATED ALPHA NAME');

      // 5. Execute Restore Drill
      const restored = await backupService.restoreBackup(backupMeta.backupId);
      expect(restored).toBe(true);

      // 6. Verify Original Record Restored
      const [restoredTenant] = await db.select().from(tenants).where(eq(tenants.id, tenantA));
      expect(restoredTenant.legalNameEn).toBe('Alpha Trading WLL');
    });

    it('should reject corrupted backup file with checksum mismatch', async () => {
      const backupMeta = await backupService.createBackup();
      const filePath = backupMeta.filePath!;

      // Tamper with file contents on disk
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      parsed.tables.tenants = [{ id: 'fake_tampered_tenant', code: 'FAKE' }];
      fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), 'utf-8');

      // Verify should reject tampered file
      await expect(
        backupService.verifyBackup(backupMeta.backupId)
      ).rejects.toThrow(CorruptedBackupError);
    });
  });

  describe('3. Unconfigured Hosted Storage Behavior', () => {
    it('should throw StorageNotConfiguredError when attempting operation on unconfigured hosted storage', async () => {
      const hostedStorage = new HostedObjectStorageService({
        provider: 'GCS',
        bucket: undefined,
        credentialsConfigured: false,
      });

      expect(hostedStorage.isConfigured).toBe(false);

      await expect(
        hostedStorage.saveDocument(tenantA, 'test.pdf', Buffer.from('data'))
      ).rejects.toThrow(StorageNotConfiguredError);
    });
  });

  describe('4. Real System Diagnostics & Environment Validation', () => {
    it('should generate real system health diagnostics querying active database and storage', async () => {
      const adapter = new DesktopRuntimeAdapter();
      const diag = await adapter.getSystemDiagnostics();

      expect(diag.status).toBe('HEALTHY');
      expect(diag.runtimeMode).toBe('DESKTOP_OFFLINE');
      expect(diag.database.connected).toBe(true);
      expect(diag.database.latencyMs).toBeGreaterThanOrEqual(0);
      expect(diag.database.currentMigrationVersion).toBeGreaterThanOrEqual(1);
      expect(diag.storage.configured).toBe(true);
      expect(diag.storage.accessible).toBe(true);
      expect(diag.backup.configured).toBe(true);
    });

    it('should validate environment configuration successfully', () => {
      const result = EnvironmentValidator.validate();
      expect(result.isValid).toBe(true);
    });
  });
});
