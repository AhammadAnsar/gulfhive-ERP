import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { salesRepository } from '../src/infrastructure/database/repositories/sales.repository.ts';
import { companyRepository } from '../src/infrastructure/database/repositories/company.repository.ts';
import { db } from '../src/db/index.ts';
import {
  clients,
  clientContacts,
  clientSites,
  branches,
  tenants,
  userTenants,
  users,
  documentSequences,
  quotations,
  invoices,
  receipts,
} from '../src/db/schema.ts';
import { eq, and } from 'drizzle-orm';

describe('Client Hardening, Bulk Selection and Safe Deletion Suite', () => {
  let companyId = '';
  let branchId = '';
  let otherCompanyId = '';

  beforeAll(async () => {
    // 1. Establish isolated fresh company
    const created = await companyRepository.createCompanyWithMainBranchAndAdmin({
      code: `CLT${Date.now().toString().slice(-4)}`,
      legalNameEn: 'Client Test Corp',
      legalNameAr: 'شركة فحص العملاء',
      countryCode: 'KW',
      baseCurrency: 'KWD',
      fiscalYearStartMonth: 1,
      timezone: 'Asia/Kuwait',
      branchCode: 'HQ',
      branchNameEn: 'HQ Branch',
      branchNameAr: 'فرع المركز الرئيسي',
      adminUid: `admin_clt_${Date.now()}`,
      adminEmail: `admin_clt_${Date.now()}@gulfhive.test`,
    });
    companyId = created.tenant.id;
    branchId = created.branch.id;

    // 2. Establish another isolated company to verify Cross-Company Isolation
    const other = await companyRepository.createCompanyWithMainBranchAndAdmin({
      code: `OTH${Date.now().toString().slice(-4)}`,
      legalNameEn: 'Other Test Corp',
      legalNameAr: 'شركة فحص أخرى',
      countryCode: 'KW',
      baseCurrency: 'KWD',
      fiscalYearStartMonth: 1,
      timezone: 'Asia/Kuwait',
      branchCode: 'HQ',
      branchNameEn: 'HQ Branch',
      branchNameAr: 'فرع المركز الرئيسي',
      adminUid: `admin_oth_${Date.now()}`,
      adminEmail: `admin_oth_${Date.now()}@gulfhive.test`,
    });
    otherCompanyId = other.tenant.id;
  });

  afterAll(async () => {
    // 3. Cleanup after tests
    for (const cid of [companyId, otherCompanyId]) {
      if (cid) {
        try {
          await db.delete(receipts).where(eq(receipts.tenantId, cid));
          await db.delete(invoices).where(eq(invoices.tenantId, cid));
          await db.delete(quotations).where(eq(quotations.tenantId, cid));
          await db.delete(clientContacts).where(eq(clientContacts.clientId, clients.id));
          await db.delete(clientSites).where(eq(clientSites.clientId, clients.id));
          await db.delete(clients).where(eq(clients.tenantId, cid));
          await db.delete(userTenants).where(eq(userTenants.tenantId, cid));
          await db.delete(users).where(eq(users.tenantId, cid));
          await db.delete(documentSequences).where(eq(documentSequences.tenantId, cid));
          await db.delete(branches).where(eq(branches.tenantId, cid));
          await db.delete(tenants).where(eq(tenants.id, cid));
        } catch (err) {
          // Cleanup silent fallback
        }
      }
    }
  });

  it('1. should guarantee Client Count = 0 upon startup and new company establishment', async () => {
    // NO dummy clients must be seeded
    const list = await salesRepository.listClients(companyId);
    expect(list).toHaveLength(0);
  });

  it('2. should create and edit client fields correctly with audit trail', async () => {
    const cl = await salesRepository.createClient(companyId, {
      code: 'CLI-001',
      nameEn: 'Al Noor Corp',
      nameAr: 'شركة النور',
      email: 'info@alnoor.test',
      phone: '+965 2222 3333',
      crNumber: 'CR123456',
    }, 'test_user');

    expect(cl.id).toBeDefined();
    expect(cl.code).toBe('CLI-001');

    // Edit Client
    const updated = await salesRepository.updateClient(companyId, cl.id, {
      nameEn: 'Al Noor International Corp',
      phone: '+965 2222 4444',
    }, 'test_user');

    expect(updated.nameEn).toBe('Al Noor International Corp');
    expect(updated.phone).toBe('+965 2222 4444');

    // Retrieve via getClient and verify
    const retrieved = await salesRepository.getClient(companyId, cl.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.nameEn).toBe('Al Noor International Corp');
  });

  it('3. should hard delete an unused client permanently', async () => {
    const cl = await salesRepository.createClient(companyId, {
      code: 'CLI-002',
      nameEn: 'Unused client',
      nameAr: 'عميل غير مستخدم',
    }, 'test_user');

    // Preflight check
    const preflight = await salesRepository.preflightDeleteClient(companyId, cl.id);
    expect(preflight.isEligibleForHardDelete).toBe(true);

    // Delete
    const delResult = await salesRepository.deleteClient(companyId, cl.id, 'test_user');
    expect(delResult.action).toBe('HARD_DELETE');

    // Verify removed from active lists
    const found = await salesRepository.getClient(companyId, cl.id);
    expect(found).toBeNull();
  });

  it('4. should prevent cross-company client modifications (Company Isolation)', async () => {
    // Create client in companyId
    const cl = await salesRepository.createClient(companyId, {
      code: 'CLI-SEC',
      nameEn: 'Secure Corp',
      nameAr: 'شركة آمنة',
    }, 'test_user');

    // Attempt to update from otherCompanyId -> must throw error
    await expect(
      salesRepository.updateClient(otherCompanyId, cl.id, { nameEn: 'Hacked name' }, 'attacker')
    ).rejects.toThrow();

    // Attempt to delete from otherCompanyId -> must throw error
    await expect(
      salesRepository.deleteClient(otherCompanyId, cl.id, 'attacker')
    ).rejects.toThrow();
  });

  it('5. should soft-delete a client referenced by Quotation but preserve transaction details', async () => {
    const cl = await salesRepository.createClient(companyId, {
      code: 'CLI-QUT',
      nameEn: 'Quoted Client Ltd',
      nameAr: 'شركة مع عرض سعر',
    }, 'test_user');

    // Insert mock Quotation referencing this client
    const [quote] = await db.insert(quotations).values({
      tenantId: companyId,
      branchId,
      clientId: cl.id,
      quotationNumber: 'Q-2026-0001',
      quotationDate: '2026-01-01',
      validUntil: '2026-02-01',
      currency: 'KWD',
      subtotal: '500.000',
      grandTotal: '500.000',
    }).returning();

    // Preflight check
    const preflight = await salesRepository.preflightDeleteClient(companyId, cl.id);
    expect(preflight.isEligibleForHardDelete).toBe(false);
    expect(preflight.totalReferences).toBe(1);

    // Controlled Delete (must soft delete / archive)
    const delResult = await salesRepository.deleteClient(companyId, cl.id, 'test_user', 'Business quote history');
    expect(delResult.action).toBe('SOFT_DELETE');

    // Deleted client must not show in ordinary active client lists
    const activeClients = await salesRepository.listClients(companyId);
    expect(activeClients.find(c => c.id === cl.id)).toBeUndefined();

    // But historical quotation still references and retrieves correct client name (preserves integrity)
    const [savedQuote] = await db.select().from(quotations).where(eq(quotations.id, quote.id));
    expect(savedQuote.clientId).toBe(cl.id);
  });

  it('6. should preflight check and execute bulk deletion on mixed client states', async () => {
    const clUnused1 = await salesRepository.createClient(companyId, {
      code: 'CLI-BULK1',
      nameEn: 'Unused Bulk 1',
      nameAr: 'مستند جماعي غير مستخدم ١',
    });

    const clUnused2 = await salesRepository.createClient(companyId, {
      code: 'CLI-BULK2',
      nameEn: 'Unused Bulk 2',
      nameAr: 'مستند جماعي غير مستخدم ٢',
    });

    const clReferenced = await salesRepository.createClient(companyId, {
      code: 'CLI-BULK3',
      nameEn: 'Referenced Bulk 3',
      nameAr: 'مستند جماعي مستخدم ٣',
    });

    // Create quotation for Referenced Bulk 3
    await db.insert(quotations).values({
      tenantId: companyId,
      branchId,
      clientId: clReferenced.id,
      quotationNumber: 'Q-2026-0002',
      quotationDate: '2026-01-01',
      validUntil: '2026-02-01',
      currency: 'KWD',
      subtotal: '150.000',
      grandTotal: '150.000',
    });

    // Run Preflight on bulk list
    const preflight = await salesRepository.preflightBulkDeleteClients(companyId, [
      clUnused1.id,
      clUnused2.id,
      clReferenced.id,
    ]);

    expect(preflight.totalCount).toBe(3);
    expect(preflight.eligibleCount).toBe(2);
    expect(preflight.protectedCount).toBe(1);

    // Perform bulk hard delete on unused, soft delete on referenced
    const bulkDelResult = await salesRepository.bulkDeleteClients(companyId, {
      clientIds: [clUnused1.id, clUnused2.id, clReferenced.id],
      action: 'DELETE',
      actorId: 'test_admin',
    });

    expect(bulkDelResult.requested).toBe(3);
    expect(bulkDelResult.deleted).toBe(2); // The 2 eligible ones
    expect(bulkDelResult.protected).toBe(1); // The referenced one is protected from hard deletion

    // Now let's bulk archive (soft-delete) the remaining referenced one
    const bulkArchiveResult = await salesRepository.bulkDeleteClients(companyId, {
      clientIds: [clReferenced.id],
      action: 'ARCHIVE',
      actorId: 'test_admin',
      reason: 'Bulk cleanup',
    });

    expect(bulkArchiveResult.requested).toBe(1);
    expect(bulkArchiveResult.archived).toBe(1);

    // Verify all 3 have disappeared from listClients active view
    const activeClientsList = await salesRepository.listClients(companyId);
    const anyFound = activeClientsList.some(c =>
      [clUnused1.id, clUnused2.id, clReferenced.id].includes(c.id)
    );
    expect(anyFound).toBe(false);
  });
});
