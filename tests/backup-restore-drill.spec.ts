/**
 * GulfHive ERP - Backup and Restore Verification Drill
 * 
 * Objectives:
 * 1. Automate database state capture as a verifiable file on disk.
 * 2. Purge or mutate state records directly to simulate data loss.
 * 3. Execute restore drill restoring complete relational consistency.
 * 4. Verify exact recovering of tenants, branches, employees, and custom metadata.
 * 5. Verify cryptographic checksum rejection on backup corruption.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/index.ts';
import { tenants, branches, employees } from '../src/db/schema.ts';
import { DesktopDatabaseBackupService } from '../src/infrastructure/backup/desktop-database-backup.service.ts';
import { CorruptedBackupError } from '../src/infrastructure/runtime/runtime-context.ts';

describe('Database Backup and Restore Disaster Recovery Drill', () => {
  const testBackupDir = path.resolve('./storage/disaster_recovery_drill_backups');
  const backupService = new DesktopDatabaseBackupService(testBackupDir);

  const tenantDrillId = `tenant_drill_${Date.now()}`;
  const branchDrillId = `branch_drill_${Date.now()}`;
  const employeeDrillId = `emp_drill_${Date.now()}`;

  beforeAll(async () => {
    // 1. Establish initial test data structures
    await db.insert(tenants).values([
      {
        id: tenantDrillId,
        code: `CO_DRILL_${Date.now()}`,
        legalNameEn: 'Disaster Recovery Corp WLL',
        legalNameAr: 'شركة الطوارئ واستعادة البيانات',
        countryCode: 'KW',
        baseCurrency: 'KWD',
        isActive: true,
      },
    ]);

    await db.insert(branches).values([
      {
        id: branchDrillId,
        tenantId: tenantDrillId,
        code: 'RECOVERY_HQ',
        nameEn: 'Recovery Headquarters',
        nameAr: 'مقر استعادة البيانات',
        isMain: true,
        isActive: true,
      },
    ]);

    await db.insert(employees).values([
      {
        id: employeeDrillId,
        tenantId: tenantDrillId,
        branchId: branchDrillId,
        employeeNumber: `DRILL-EMP-${Date.now()}`,
        firstNameEn: 'Data',
        lastNameEn: 'Preservationist',
        firstNameAr: 'حفظ',
        lastNameAr: 'البيانات',
        nationality: 'Kuwaiti',
        gender: 'MALE',
        email: 'drill@gulfhive.kw',
        joiningDate: new Date(),
        employmentStatus: 'ACTIVE',
      },
    ]);
  });

  afterAll(async () => {
    // Cleanup remaining traces
    try {
      await db.delete(employees).where(eq(employees.id, employeeDrillId));
      await db.delete(branches).where(eq(branches.id, branchDrillId));
      await db.delete(tenants).where(eq(tenants.id, tenantDrillId));
      if (fs.existsSync(testBackupDir)) {
        fs.rmSync(testBackupDir, { recursive: true, force: true });
      }
    } catch (e) {
      console.warn('Drill cleanup warning:', e);
    }
  });

  it('should create a complete cryptographic backup, allow data corruption, and restore database to exact previous state', async () => {
    // 2. Perform automated database backup
    const backupMeta = await backupService.createBackup();

    expect(backupMeta.backupId).toBeDefined();
    expect(backupMeta.checksum.startsWith('sha256:')).toBe(true);
    expect(fs.existsSync(backupMeta.filePath!)).toBe(true);

    // 3. Intentionally Corrupt Database (Simulation of Ransomware/Data Loss)
    await db.delete(employees).where(eq(employees.id, employeeDrillId));
    await db.update(tenants)
      .set({ legalNameEn: 'COMPLETELY_MUTATED_AND_LOST_STATE' })
      .where(eq(tenants.id, tenantDrillId));

    // Verify database state is corrupted
    const lostEmployee = await db.select().from(employees).where(eq(employees.id, employeeDrillId));
    expect(lostEmployee).toHaveLength(0);

    const [mutatedTenant] = await db.select().from(tenants).where(eq(tenants.id, tenantDrillId));
    expect(mutatedTenant.legalNameEn).toBe('COMPLETELY_MUTATED_AND_LOST_STATE');

    // 4. Run the recovery drill restoring precise state from the backup file
    const restoreResult = await backupService.restoreBackup(backupMeta.backupId);
    expect(restoreResult).toBe(true);

    // 5. Verify relational recovery state matching original values exactly
    const [recoveredTenant] = await db.select().from(tenants).where(eq(tenants.id, tenantDrillId));
    expect(recoveredTenant.legalNameEn).toBe('Disaster Recovery Corp WLL');
    expect(recoveredTenant.legalNameAr).toBe('شركة الطوارئ واستعادة البيانات');

    const [recoveredBranch] = await db.select().from(branches).where(eq(branches.id, branchDrillId));
    expect(recoveredBranch.code).toBe('RECOVERY_HQ');

    const [recoveredEmployee] = await db.select().from(employees).where(eq(employees.id, employeeDrillId));
    expect(recoveredEmployee).toBeDefined();
    expect(recoveredEmployee.firstNameEn).toBe('Data');
  });

  it('should reject restoring from a tampered/corrupted backup with custom checksum validation error', async () => {
    const backupMeta = await backupService.createBackup();
    const filePath = backupMeta.filePath!;

    // Tamper with backup file
    const rawContent = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(rawContent);
    parsed.tables.tenants[0].legalNameEn = 'HOSTILE TAMPERED BACKUP DATA';
    fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), 'utf-8');

    // Expect verify to throw CorruptedBackupError due to SHA-256 mismatch
    await expect(
      backupService.verifyBackup(backupMeta.backupId)
    ).rejects.toThrow(CorruptedBackupError);

    await expect(
      backupService.restoreBackup(backupMeta.backupId)
    ).rejects.toThrow(CorruptedBackupError);
  });
});
