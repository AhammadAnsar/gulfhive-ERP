/**
 * GulfHive ERP - Part A: First-Run Company Setup & API Client Verification Suite
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { parseResponseSafely, ApiError } from '../src/lib/api-client.ts';
import { MigrationRunner } from '../src/infrastructure/database/migrations/migration-runner.ts';
import { companyRepository } from '../src/infrastructure/database/repositories/company.repository.ts';
import { numberingRepository } from '../src/infrastructure/database/repositories/numbering.repository.ts';
import { db } from '../src/db/index.ts';
import { branches, tenants, userTenants, users, documentSequences } from '../src/db/schema.ts';
import { eq } from 'drizzle-orm';

describe('Part A — API Client Safe Parsing & Non-JSON Error Handling', () => {
  it('should safely handle HTML 404 responses like "The page could not be found" without throwing Unexpected token T', async () => {
    // Simulated cloud hosting / proxy 404 HTML response
    const createMockResponse = () => new Response('The page could not be found on this server.', {
      status: 404,
      statusText: 'Not Found',
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });

    try {
      await parseResponseSafely(createMockResponse());
      expect.fail('Should have thrown an ApiError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(404);
      expect(err.message).toContain('could not be found');
      // Must NOT throw syntax error with unexpected token 'T'
      expect(err.message).not.toContain("Unexpected token 'T'");
    }
  });

  it('should safely handle HTML 500 responses without crashing JSON parsing', async () => {
    const mockResponse = new Response('<html><body><h1>502 Bad Gateway</h1></body></html>', {
      status: 502,
      statusText: 'Bad Gateway',
      headers: {
        'Content-Type': 'text/html',
      },
    });

    try {
      await parseResponseSafely(mockResponse);
      expect.fail('Should have thrown an ApiError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(502);
      expect(err.message).toContain('GulfHive backend encountered an internal error');
      expect(err.message).not.toContain('Unexpected token');
    }
  });

  it('should cleanly parse valid JSON responses', async () => {
    const mockResponse = new Response(JSON.stringify({ success: true, tenant: { code: 'CORP-01' } }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await parseResponseSafely<{ success: boolean; tenant: { code: string } }>(mockResponse);
    expect(data.success).toBe(true);
    expect(data.tenant.code).toBe('CORP-01');
  });
});

describe('Part A — First-Run Company Setup Transactional Establishment', () => {
  const testCompanyCode = `ESTAB_${Date.now().toString().slice(-4)}`;

  beforeAll(async () => {
    try {
      const runner = new MigrationRunner();
      await runner.runAllMigrations();
    } catch {
      // Migrations may be pre-applied
    }
  });

  it('should atomically create Company, Main Branch, Admin User, and Document Sequences', async () => {
    const input = {
      code: testCompanyCode,
      legalNameEn: 'Al-Hekma Gulf General Trading Co.',
      legalNameAr: 'شركة الحكمة الخليجية للتجارة العامة',
      tradeNameEn: 'Al-Hekma Gulf',
      tradeNameAr: 'الحكمة الخليجية',
      countryCode: 'KW',
      baseCurrency: 'KWD',
      crNumber: 'CR-1984210',
      taxNumber: 'TX-998822',
      fiscalYearStartMonth: 1,
      timezone: 'Asia/Kuwait',
      phone: '+965 2200 1100',
      email: 'info@alhekma-gulf.com',
      branchCode: 'HQ',
      branchNameEn: 'Sharq Commercial Tower Branch',
      branchNameAr: 'فرع برج الشرق التجاري',
      cityEn: 'Kuwait City',
      cityAr: 'مدينة الكويت',
      adminUid: `admin_${Date.now()}`,
      adminEmail: `admin_${Date.now()}@alhekma-gulf.com`,
      adminDisplayName: 'Mishari Al-Khaldi',
    };

    const result = await companyRepository.createCompanyWithMainBranchAndAdmin(input);

    expect(result).toBeDefined();
    expect(result.tenant.id).toBeDefined();
    expect(result.tenant.code).toBe(testCompanyCode);
    expect(result.tenant.baseCurrency).toBe('KWD');
    expect(result.tenant.countryCode).toBe('KW');

    expect(result.branch.id).toBeDefined();
    expect(result.branch.isMain).toBe(true);
    expect(result.branch.code).toBe('HQ');

    expect(result.user.id).toBeDefined();
    expect(result.user.email).toBe(input.adminEmail.toLowerCase());

    // Verify document sequence configuration was initialized for this tenant
    const sequences = await numberingRepository.listSequences(result.tenant.id);
    expect(sequences.length).toBeGreaterThan(0);
    const employeeSeq = sequences.find(s => s.documentType === 'EMPLOYEE');
    const timesheetSeq = sequences.find(s => s.documentType === 'TIMESHEET');
    expect(employeeSeq).toBeDefined();
    expect(employeeSeq?.prefix).toBe('EMP');
    expect(timesheetSeq).toBeDefined();
    expect(timesheetSeq?.prefix).toBe('TS');
  });

  it('should handle idempotent double-submission without throwing duplicates or failing', async () => {
    const input = {
      code: testCompanyCode, // Same code as above
      legalNameEn: 'Al-Hekma Gulf General Trading Co.',
      legalNameAr: 'شركة الحكمة الخليجية للتجارة العامة',
      countryCode: 'KW',
      baseCurrency: 'KWD',
      fiscalYearStartMonth: 1,
      timezone: 'Asia/Kuwait',
      branchCode: 'HQ',
      branchNameEn: 'Sharq Commercial Tower Branch',
      branchNameAr: 'فرع برج الشرق التجاري',
      adminUid: 'admin_retry',
      adminEmail: 'admin_retry@alhekma-gulf.com',
    };

    // Second call simulates double-clicking "Establish Enterprise" or retrying
    const duplicateResult = await companyRepository.createCompanyWithMainBranchAndAdmin(input);

    expect(duplicateResult).toBeDefined();
    expect(duplicateResult.tenant.code).toBe(testCompanyCode);
    expect(duplicateResult.branch.isMain).toBe(true);

    // Verify exactly ONE company with this code exists in database
    const companies = await companyRepository.listCompanies();
    const matches = companies.filter(c => c.code === testCompanyCode);
    expect(matches).toHaveLength(1);
  });

  afterAll(async () => {
    try {
      const companies = await companyRepository.listCompanies();
      const matches = companies.filter(c => c.code === testCompanyCode);
      for (const comp of matches) {
        await db.delete(userTenants).where(eq(userTenants.tenantId, comp.id));
        await db.delete(documentSequences).where(eq(documentSequences.tenantId, comp.id));
        await db.delete(branches).where(eq(branches.tenantId, comp.id));
        await db.delete(tenants).where(eq(tenants.id, comp.id));
      }
    } catch {
      // Ignore test cleanup error
    }
  });
});
