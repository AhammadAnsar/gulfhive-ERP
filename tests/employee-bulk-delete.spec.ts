import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { peopleRepository } from '../src/infrastructure/database/repositories/people.repository.ts';
import { companyRepository } from '../src/infrastructure/database/repositories/company.repository.ts';
import { db } from '../src/db/index.ts';
import { employees, branches, tenants, userTenants, users, documentSequences, attendanceRecords } from '../src/db/schema.ts';
import { eq } from 'drizzle-orm';

describe('Employee Data Hygiene & Safe Bulk Delete Suite', () => {
  let companyId = '';
  let branchId = '';

  beforeAll(async () => {
    // 1. Establish isolated fresh company
    const created = await companyRepository.createCompanyWithMainBranchAndAdmin({
      code: `DEL${Date.now().toString().slice(-4)}`,
      legalNameEn: 'Bulk Delete Clean Test Corp',
      legalNameAr: 'شركة فحص الحذف الجماعي',
      countryCode: 'KW',
      baseCurrency: 'KWD',
      fiscalYearStartMonth: 1,
      timezone: 'Asia/Kuwait',
      branchCode: 'HQ',
      branchNameEn: 'HQ Branch',
      branchNameAr: 'فرع المركز الرئيسي',
      adminUid: `admin_bulk_${Date.now()}`,
      adminEmail: `admin_bulk_${Date.now()}@gulfhive.test`,
    });
    companyId = created.tenant.id;
    branchId = created.branch.id;
  });

  afterAll(async () => {
    if (companyId) {
      try {
        await db.delete(attendanceRecords).where(eq(attendanceRecords.tenantId, companyId));
        await db.delete(employees).where(eq(employees.tenantId, companyId));
        await db.delete(userTenants).where(eq(userTenants.tenantId, companyId));
        await db.delete(users).where(eq(users.tenantId, companyId));
        await db.delete(documentSequences).where(eq(documentSequences.tenantId, companyId));
        await db.delete(branches).where(eq(branches.tenantId, companyId));
        await db.delete(tenants).where(eq(tenants.id, companyId));
      } catch (err) {
        // Cleanup silent fallback
      }
    }
  });

  it('1. should guarantee Employee Count = 0 upon startup and new company establishment', async () => {
    // Proves there is no "casual" mock employee seeding on startup or company creation.
    const list = await peopleRepository.listEmployees(companyId);
    expect(list).toHaveLength(0);
  });

  it('2. should perform single employee preflight check and allow hard deletion of unreferenced draft employee', async () => {
    // Create draft employee
    const emp = await peopleRepository.createEmployee(companyId, {
      branchId,
      firstNameEn: 'Clean',
      lastNameEn: 'Candidate',
      firstNameAr: 'نظيف',
      lastNameAr: 'مرشح',
      gender: 'MALE',
      nationality: 'Kuwaiti',
      email: 'clean@candidate.test',
      basicSalary: '1000.000',
      civilIdNumber: '290010101999',
      employmentStatus: 'ACTIVE',
      dateOfBirth: '1990-01-01',
      joiningDate: '2026-01-01',
      actorId: 'test_admin',
    });

    // Run preflight
    const preflight = await peopleRepository.preflightBulkDelete(companyId, {
      employeeIds: [emp.id],
    });

    expect(preflight.totalCount).toBe(1);
    expect(preflight.eligibleCount).toBe(1);
    expect(preflight.protectedCount).toBe(0);
    expect(preflight.items[0].isEligibleForDelete).toBe(true);

    // Run bulk delete
    const result = await peopleRepository.bulkDeleteEmployees(companyId, {
      employeeIds: [emp.id],
      action: 'DELETE',
      actorId: 'test_admin',
    });

    expect(result.requested).toBe(1);
    expect(result.deleted).toBe(1);
    expect(result.protected).toBe(0);

    // Verify gone
    const list = await peopleRepository.listEmployees(companyId);
    expect(list).toHaveLength(0);
  });

  it('3. should block deletion and protect employees with active business history (attendance)', async () => {
    // Create draft employee
    const emp = await peopleRepository.createEmployee(companyId, {
      branchId,
      firstNameEn: 'Protected',
      lastNameEn: 'History',
      firstNameAr: 'محمي',
      lastNameAr: 'سجل',
      gender: 'MALE',
      nationality: 'Kuwaiti',
      email: 'protected@history.test',
      basicSalary: '1000.000',
      civilIdNumber: '290010101888',
      employmentStatus: 'ACTIVE',
      dateOfBirth: '1990-01-01',
      joiningDate: '2026-01-01',
      actorId: 'test_admin',
    });

    // Create a dependent attendance record for this employee
    await db.insert(attendanceRecords).values({
      id: `att_${emp.id}`,
      tenantId: companyId,
      branchId,
      employeeId: emp.id,
      date: '2026-09-30',
      status: 'PRESENT',
    });

    // Run preflight
    const preflight = await peopleRepository.preflightBulkDelete(companyId, {
      employeeIds: [emp.id],
    });

    expect(preflight.totalCount).toBe(1);
    expect(preflight.eligibleCount).toBe(0);
    expect(preflight.protectedCount).toBe(1);
    expect(preflight.items[0].isEligibleForDelete).toBe(false);
    expect(preflight.items[0].reasons[0]).toContain('attendance record');

    // Run bulk delete -> should skip/protect this employee
    const result = await peopleRepository.bulkDeleteEmployees(companyId, {
      employeeIds: [emp.id],
      action: 'DELETE',
      actorId: 'test_admin',
    });

    expect(result.requested).toBe(1);
    expect(result.deleted).toBe(0);
    expect(result.protected).toBe(1);

    // Archive should succeed instead
    const archiveResult = await peopleRepository.bulkDeleteEmployees(companyId, {
      employeeIds: [emp.id],
      action: 'ARCHIVE',
      actorId: 'test_admin',
    });
    expect(archiveResult.archived).toBe(1);
  });
});
