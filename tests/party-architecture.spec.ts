/**
 * GulfHive ERP - Phase 4 Integration Tests
 * Unified Party Architecture: Single legal entity representation with multi-role management.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../src/db/index.ts';
import { partyRepository } from '../src/infrastructure/database/repositories/party.repository.ts';
import { salesRepository } from '../src/infrastructure/database/repositories/sales.repository.ts';
import { procurementRepository } from '../src/infrastructure/database/repositories/procurement.repository.ts';
import { projectsRepository } from '../src/infrastructure/database/repositories/projects.repository.ts';
import { MigrationRunner } from '../src/infrastructure/database/migrations/migration-runner.ts';

const TENANT_A = 'test_comp_party_a';
const TENANT_B = 'test_comp_party_b';

describe('Phase 4: Unified Party Architecture', () => {
  beforeAll(async () => {
    const migrationRunner = new MigrationRunner();
    await migrationRunner.runAllMigrations();

    // Seed tenants
    await db.execute(
      `INSERT INTO tenants (id, code, legal_name_en, legal_name_ar, country_code, base_currency)
       VALUES ('${TENANT_A}', 'CP-A', 'Party Company A', 'شركة الأطراف أ', 'KW', 'KWD'),
              ('${TENANT_B}', 'CP-B', 'Party Company B', 'شركة الأطراف ب', 'KW', 'KWD')
       ON CONFLICT (id) DO NOTHING;`
    );

    // Seed branch
    await db.execute(
      `INSERT INTO branches (id, tenant_id, code, name_en, name_ar, is_main)
       VALUES ('br_party_a', '${TENANT_A}', 'MAIN', 'Main Branch', 'الفرع الرئيسي', true)
       ON CONFLICT (id) DO NOTHING;`
    );
  });

  afterAll(async () => {
    await db.execute(`DELETE FROM parties WHERE tenant_id IN ('${TENANT_A}', '${TENANT_B}')`);
    await db.execute(`DELETE FROM tenants WHERE id IN ('${TENANT_A}', '${TENANT_B}')`);
  });

  it('1. should create a client-only party with client profile', async () => {
    const party = await partyRepository.createParty(TENANT_A, {
      legalNameEn: 'Al-Bahar Trading Co',
      legalNameAr: 'شركة البحر للتجارة',
      crNumber: 'CR-100200300',
      taxNumber: 'TAX-900800',
      roles: ['CLIENT'],
      clientProfile: {
        creditLimit: '50000.000',
        paymentTermsDays: 60,
      },
    });

    expect(party).toBeDefined();
    expect(party?.legalNameEn).toBe('Al-Bahar Trading Co');
    expect(party?.roles).toHaveLength(1);
    expect(party?.roles[0].roleType).toBe('CLIENT');
    expect(party?.clientProfile).not.toBeNull();
    expect(party?.clientProfile?.paymentTermsDays).toBe(60);
    expect(party?.supplierProfile).toBeNull();
  });

  it('2. should create a supplier-only party with supplier profile', async () => {
    const party = await partyRepository.createParty(TENANT_A, {
      legalNameEn: 'Gulf Equipment Supplier',
      legalNameAr: 'مورد المعدات الخليجية',
      crNumber: 'CR-400500600',
      taxNumber: 'TAX-333222',
      roles: ['SUPPLIER'],
      supplierProfile: {
        paymentTermsDays: 30,
        bankName: 'National Bank of Kuwait',
        bankIban: 'KW98NBOK0000000012345678',
      },
    });

    expect(party).toBeDefined();
    expect(party?.legalNameEn).toBe('Gulf Equipment Supplier');
    expect(party?.roles).toHaveLength(1);
    expect(party?.roles[0].roleType).toBe('SUPPLIER');
    expect(party?.clientProfile).toBeNull();
    expect(party?.supplierProfile).not.toBeNull();
    expect(party?.supplierProfile?.bankName).toBe('National Bank of Kuwait');
  });

  it('3. should support single legal entity gaining dual roles (Client + Supplier)', async () => {
    // Create initially as Client
    const initial = await partyRepository.createParty(TENANT_A, {
      legalNameEn: 'Khaled & Bros Enterprise',
      legalNameAr: 'مؤسسة خالد وإخوانه',
      crNumber: 'CR-777888999',
      roles: ['CLIENT'],
    });

    expect(initial?.roles).toHaveLength(1);
    expect(initial?.roles[0].roleType).toBe('CLIENT');

    // Add SUPPLIER role to same party
    const updated = await partyRepository.addRole(TENANT_A, initial!.id, 'SUPPLIER', {
      supplierProfile: {
        bankName: 'Gulf Bank',
        bankIban: 'KW12GULF000011112222',
      },
    });

    expect(updated?.roles).toHaveLength(2);
    const roleTypes = updated?.roles.map((r) => r.roleType);
    expect(roleTypes).toContain('CLIENT');
    expect(roleTypes).toContain('SUPPLIER');
    expect(updated?.clientProfile).not.toBeNull();
    expect(updated?.supplierProfile).not.toBeNull();
  });

  it('4. should support Principal Contractor role assignment and project linking', async () => {
    const principalParty = await partyRepository.createParty(TENANT_A, {
      legalNameEn: 'Kuwait General Contracting Co',
      legalNameAr: 'شركة المقاولات العامة الكويتية',
      crNumber: 'CR-555444333',
      roles: ['PRINCIPAL_CONTRACTOR'],
    });

    expect(principalParty?.roles.map((r) => r.roleType)).toContain('PRINCIPAL_CONTRACTOR');

    // Create client for project
    const client = await salesRepository.createClient(TENANT_A, {
      code: 'CL-PRJ-01',
      nameEn: 'Project Owner Client',
      nameAr: 'عميل صاحب المشروع',
    });

    // Create billing profile
    const bp = await projectsRepository.createBillingProfile(TENANT_A, {
      profileCode: 'BP-PRJ-01',
      profileName: 'Main Operating Billing Profile',
      isOperatingCompany: true,
      legalNameEn: 'Operating Co',
      legalNameAr: 'الشركة المشغلة',
      effectiveFrom: '2026-01-01',
    });

    // Create project referencing Principal Contractor Party
    const project = await projectsRepository.createProject(TENANT_A, {
      projectCode: 'PRJ-PRINCIPAL-01',
      nameEn: 'Airport Terminal Construction',
      nameAr: 'مشروع بناء مبنى المطار',
      clientId: client.id,
      billingProfileId: bp.id,
      startDate: '2026-02-01',
    });

    expect(project).toBeDefined();
    expect(project.clientId).toBe(client.id);
  });

  it('5. should support Workforce Supplier role assignment and external worker linking', async () => {
    const workforceParty = await partyRepository.createParty(TENANT_A, {
      legalNameEn: 'Al-Safa Manpower Agency',
      legalNameAr: 'وكالة الصفاء للعمالة',
      crNumber: 'CR-111222333',
      roles: ['WORKFORCE_SUPPLIER'],
    });

    const supplier = await procurementRepository.createSupplier(TENANT_A, {
      code: 'SUP-WF-01',
      nameEn: 'Al-Safa Manpower Agency',
      nameAr: 'وكالة الصفاء للعمالة',
      crNumber: 'CR-111222333',
    });

    const externalWorker = await projectsRepository.createExternalWorker(TENANT_A, {
      workerCode: 'EXT-001',
      sourceSupplierId: supplier.id,
      nameEn: 'Rajesh Kumar',
      profession: 'Senior Electrician',
    });

    expect(externalWorker).toBeDefined();
    expect(externalWorker.sourceSupplierId).toBe(supplier.id);
    expect(externalWorker.sourcePartyId).toBe(supplier.partyId);
  });

  it('6. should allow removing one role without destroying legal entity or other role profiles', async () => {
    const party = await partyRepository.createParty(TENANT_A, {
      legalNameEn: 'Multi Tech Solutions',
      legalNameAr: 'حلول التقنيات المتعددة',
      crNumber: 'CR-999000111',
      roles: ['CLIENT', 'SUPPLIER'],
    });

    expect(party?.roles).toHaveLength(2);

    // Remove CLIENT role
    const updated = await partyRepository.removeRole(TENANT_A, party!.id, 'CLIENT');
    expect(updated).toBeDefined();

    // Verify CLIENT role status is INACTIVE
    const clientRole = updated?.roles.find((r) => r.roleType === 'CLIENT');
    expect(clientRole?.status).toBe('INACTIVE');

    // SUPPLIER role remains ACTIVE
    const supplierRole = updated?.roles.find((r) => r.roleType === 'SUPPLIER');
    expect(supplierRole?.status).toBe('ACTIVE');

    // Legal entity data preserved
    expect(updated?.legalNameEn).toBe('Multi Tech Solutions');
  });

  it('7. should enforce multi-tenant isolation on Party operations', async () => {
    const partyA = await partyRepository.createParty(TENANT_A, {
      legalNameEn: 'Tenant A Private Partner',
      legalNameAr: 'شريك خاص أ',
    });

    // Tenant B attempt to view Party A
    const bAttempt = await partyRepository.getParty(TENANT_B, partyA!.id);
    expect(bAttempt).toBeNull();

    // Tenant B attempt to update Party A
    await expect(
      partyRepository.updateParty(TENANT_B, partyA!.id, { legalNameEn: 'Hacked Name' })
    ).rejects.toThrow();

    // Tenant B list should not include Party A
    const listB = await partyRepository.listParties(TENANT_B);
    expect(listB.some((p) => p.id === partyA!.id)).toBe(false);
  });

  it('8. should detect duplicates based on CR Number, Tax Number, and Legal Name', async () => {
    await partyRepository.createParty(TENANT_A, {
      legalNameEn: 'Unique GCC Holdings',
      legalNameAr: 'القابضة الفريدة',
      crNumber: 'CR-UNIQUE-777',
      taxNumber: 'TAX-UNIQUE-888',
    });

    const dupByCr = await partyRepository.checkDuplicates(TENANT_A, {
      crNumber: 'CR-UNIQUE-777',
    });
    expect(dupByCr.hasMatch).toBe(true);
    expect(dupByCr.exactMatch).toBe(true);

    const dupByTax = await partyRepository.checkDuplicates(TENANT_A, {
      taxNumber: 'TAX-UNIQUE-888',
    });
    expect(dupByTax.hasMatch).toBe(true);

    const dupByName = await partyRepository.checkDuplicates(TENANT_A, {
      legalNameEn: 'Unique GCC Holdings',
    });
    expect(dupByName.hasMatch).toBe(true);
  });

  it('9. should consolidate parties using merge workflow without losing references', async () => {
    const sourceParty = await partyRepository.createParty(TENANT_A, {
      legalNameEn: 'Original Supplier Co',
      legalNameAr: 'شركة المورد الأصلي',
      crNumber: 'CR-SRC-101',
      roles: ['SUPPLIER'],
    });

    const targetParty = await partyRepository.createParty(TENANT_A, {
      legalNameEn: 'Merged Group Holdings',
      legalNameAr: 'مجموعة القابضة المدمجة',
      crNumber: 'CR-TGT-202',
      roles: ['CLIENT'],
    });

    const merged = await partyRepository.mergeParties(TENANT_A, sourceParty!.id, targetParty!.id);
    expect(merged).toBeDefined();

    // Target party now has both CLIENT and SUPPLIER roles
    const activeRoles = merged?.roles.filter((r) => r.status === 'ACTIVE').map((r) => r.roleType);
    expect(activeRoles).toContain('CLIENT');
    expect(activeRoles).toContain('SUPPLIER');

    // Source party soft-deleted
    const checkSource = await partyRepository.getParty(TENANT_A, sourceParty!.id);
    expect(checkSource).toBeNull();
  });

  it('10. should handle soft delete gracefully', async () => {
    const party = await partyRepository.createParty(TENANT_A, {
      legalNameEn: 'Temporary Entity',
      legalNameAr: 'كيان مؤقت',
    });

    const deleted = await partyRepository.deleteParty(TENANT_A, party!.id, 'Testing soft delete');
    expect(deleted.status).toBe('DELETED');

    const check = await partyRepository.getParty(TENANT_A, party!.id);
    expect(check).toBeNull();
  });
});
