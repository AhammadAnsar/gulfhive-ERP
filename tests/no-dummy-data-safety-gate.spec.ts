/**
 * GulfHive ERP - No-Dummy-Data Safety Gate & Regression Suite
 * 
 * Verifies the strict ERP invariant:
 * - Never insert fake, demo, sample, or dummy business data (employees, clients, suppliers, projects, invoices, bills, payroll).
 * - Startup / module initialization must never alter business-record counts.
 * - Only system reference data (currencies, countries, nationalities, permissions) and explicit test fixtures are permitted.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MigrationRunner } from '../src/infrastructure/database/migrations/migration-runner.ts';
import { companyRepository } from '../src/infrastructure/database/repositories/company.repository.ts';
import { peopleRepository } from '../src/infrastructure/database/repositories/people.repository.ts';
import { salesRepository } from '../src/infrastructure/database/repositories/sales.repository.ts';
import { procurementRepository } from '../src/infrastructure/database/repositories/procurement.repository.ts';
import { projectsRepository } from '../src/infrastructure/database/repositories/projects.repository.ts';
import { payrollRepository } from '../src/infrastructure/database/repositories/payroll.repository.ts';
import { db } from '../src/db/index.ts';
import {
  employees,
  clients,
  suppliers,
  projects,
  currencies,
  countries,
  nationalities,
  permissions
} from '../src/db/schema.ts';
import { eq } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('No-Dummy-Data Safety Gate & Business Record Purity', () => {
  let testTenantId: string;
  const testCompanyCode = `SG_${Date.now().toString().slice(-4)}`;

  beforeAll(async () => {
    try {
      const runner = new MigrationRunner();
      await runner.runAllMigrations();
    } catch {
      // Migrations may be pre-applied
    }
  });

  describe('1. Static Codebase Purity & Prohibited Keywords Scan', () => {
    it('should confirm production source files do not contain dummy/faker/mock fallback business generators', () => {
      const srcDir = path.resolve(rootDir, 'src');
      const filesToScan: string[] = [];

      function collectFiles(dir: string) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            collectFiles(fullPath);
          } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
            filesToScan.push(fullPath);
          }
        }
      }

      collectFiles(srcDir);
      expect(filesToScan.length).toBeGreaterThan(50);

      const forbiddenPatterns = [
        /faker\./i,
        /mockEmployees\s*=/i,
        /mockClients\s*=/i,
        /mockSuppliers\s*=/i,
        /mockInvoices\s*=/i,
        /mockProjects\s*=/i,
        /dummyEmployees/i,
        /dummy_data/i,
      ];

      for (const filePath of filesToScan) {
        const content = fs.readFileSync(filePath, 'utf8');
        for (const pattern of forbiddenPatterns) {
          const match = content.match(pattern);
          expect(
            match,
            `Forbidden dummy data pattern ${pattern} found in production file: ${path.relative(rootDir, filePath)}`
          ).toBeNull();
        }
      }
    });

    it('should verify formula evaluator does not execute any database inserts', () => {
      const evaluatorPath = path.resolve(rootDir, 'src/services/payroll/formula-evaluator.ts');
      const content = fs.readFileSync(evaluatorPath, 'utf8');
      expect(content).toContain('FormulaEvaluator');
      expect(content).not.toContain('db.insert');
    });
  });

  describe('2. Runtime Isolation & Zero Business Records on Tenant Creation', () => {
    it('should prove fresh tenant initialization has exactly 0 business records', async () => {
      // Create isolated test company via standard First-Run establishment
      const result = await companyRepository.createCompanyWithMainBranchAndAdmin({
        code: testCompanyCode,
        legalNameEn: 'Safety Gate Isolation Corp',
        legalNameAr: 'شركة بوابة الأمان للتجارة',
        tradeNameEn: 'Safety Gate',
        tradeNameAr: 'بوابة الأمان',
        countryCode: 'KW',
        baseCurrency: 'KWD',
        crNumber: `CR-${Date.now().toString().slice(-6)}`,
        taxNumber: `TX-${Date.now().toString().slice(-6)}`,
        fiscalYearStartMonth: 1,
        timezone: 'Asia/Kuwait',
        phone: '+965 2200 9900',
        email: `info-${Date.now()}@safetygate.corp`,
        branchCode: 'HQ',
        branchNameEn: 'Main Headquarters',
        branchNameAr: 'المقر الرئيسي',
        cityEn: 'Kuwait City',
        cityAr: 'مدينة الكويت',
        adminUid: `admin_sg_${Date.now()}`,
        adminEmail: `admin_${Date.now()}@safetygate.corp`,
        adminDisplayName: 'Safety Officer',
      });

      testTenantId = result.tenant.id;
      expect(testTenantId).toBeDefined();

      // Verify all business domain record counts are strictly zero
      const empList = await peopleRepository.listEmployees(testTenantId);
      expect(empList.length).toBe(0);

      const clientList = await salesRepository.listClients(testTenantId);
      expect(clientList.length).toBe(0);

      const supplierList = await procurementRepository.listSuppliers(testTenantId);
      expect(supplierList.length).toBe(0);

      const projectList = await projectsRepository.listProjects(testTenantId);
      expect(projectList.length).toBe(0);

      const invoiceList = await salesRepository.listInvoices(testTenantId);
      expect(invoiceList.length).toBe(0);

      const billList = await procurementRepository.listSupplierBills(testTenantId);
      expect(billList.length).toBe(0);

      const payrollList = await payrollRepository.listPayrollRuns(testTenantId);
      expect(payrollList.length).toBe(0);

      const deploymentList = await projectsRepository.listDeployments(testTenantId);
      expect(deploymentList.length).toBe(0);
    });

    it('should verify that business tables are not polluted with global dummy data', async () => {
      // Currencies reference table should only have system currencies if seeded
      const currencyRows = await db.select().from(currencies);
      for (const c of currencyRows) {
        expect(['KWD', 'SAR', 'AED', 'BHD', 'OMR', 'QAR', 'USD', 'EUR']).toContain(c.isoCode);
      }

      // Permissions table should only contain system permission codes
      const permRows = await db.select().from(permissions);
      for (const p of permRows) {
        expect(p.code).toMatch(/^[a-z_]+(\.[a-z_]+)*$/);
      }
    });
  });

  describe('3. Module Initialization & Repository Safety', () => {
    it('should ensure repeated querying does not mutate or inject business records', async () => {
      // Query multiple times across domains
      await peopleRepository.listEmployees(testTenantId);
      await salesRepository.listClients(testTenantId);
      await procurementRepository.listSuppliers(testTenantId);
      await projectsRepository.listProjects(testTenantId);

      // Verify counts remain strictly 0
      const [empCount] = await db.select().from(employees).where(eq(employees.tenantId, testTenantId));
      expect(empCount).toBeUndefined();

      const [clientCount] = await db.select().from(clients).where(eq(clients.tenantId, testTenantId));
      expect(clientCount).toBeUndefined();

      const [supplierCount] = await db.select().from(suppliers).where(eq(suppliers.tenantId, testTenantId));
      expect(supplierCount).toBeUndefined();

      const [projectCount] = await db.select().from(projects).where(eq(projects.tenantId, testTenantId));
      expect(projectCount).toBeUndefined();
    });
  });
});
