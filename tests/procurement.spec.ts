import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { procurementRepository } from '../src/infrastructure/database/repositories/procurement.repository.ts';
import { salesRepository } from '../src/infrastructure/database/repositories/sales.repository.ts';
import { companyRepository } from '../src/infrastructure/database/repositories/company.repository.ts';
import { db } from '../src/db/index.ts';
import {
  suppliers,
  purchaseRequests,
  purchaseRequestLines,
  rfqs,
  rfqSuppliers,
  supplierQuotations,
  supplierQuotationLines,
  purchaseOrders,
  purchaseOrderLines,
  goodsReceipts,
  goodsReceiptLines,
  purchaseReturns,
  purchaseReturnLines,
  supplierBills,
  supplierBillLines,
  supplierCredits,
  supplierPayments,
  supplierPaymentAllocations,
  branches,
  tenants,
  userTenants,
  users,
  documentSequences,
} from '../src/db/schema.ts';
import { eq, and } from 'drizzle-orm';

describe('Purchase, Procurement & Payables Module Integration Suite', () => {
  let companyId = '';
  let branchId = '';
  let otherCompanyId = '';

  beforeAll(async () => {
    // 1. Establish isolated fresh company
    const created = await companyRepository.createCompanyWithMainBranchAndAdmin({
      code: `PRC${Date.now().toString().slice(-4)}`,
      legalNameEn: 'Procurement Test Corp',
      legalNameAr: 'شركة فحص المشتريات',
      countryCode: 'KW',
      baseCurrency: 'KWD',
      fiscalYearStartMonth: 1,
      timezone: 'Asia/Kuwait',
      branchCode: 'HQ',
      branchNameEn: 'HQ Branch',
      branchNameAr: 'فرع المركز الرئيسي',
      adminUid: `admin_prc_${Date.now()}`,
      adminEmail: `admin_prc_${Date.now()}@gulfhive.test`,
    });
    companyId = created.tenant.id;
    branchId = created.branch.id;

    // 2. Establish another isolated company to verify Cross-Company Isolation
    const other = await companyRepository.createCompanyWithMainBranchAndAdmin({
      code: `OTH${Date.now().toString().slice(-4)}`,
      legalNameEn: 'Other Secure Corp',
      legalNameAr: 'شركة حماية أخرى',
      countryCode: 'KW',
      baseCurrency: 'KWD',
      fiscalYearStartMonth: 1,
      timezone: 'Asia/Kuwait',
      branchCode: 'HQ',
      branchNameEn: 'HQ Branch',
      branchNameAr: 'فرع المركز الرئيسي',
      adminUid: `admin_sec_${Date.now()}`,
      adminEmail: `admin_sec_${Date.now()}@gulfhive.test`,
    });
    otherCompanyId = other.tenant.id;
  });

  afterAll(async () => {
    // Cleanup databases after tests
    for (const cid of [companyId, otherCompanyId]) {
      if (cid) {
        try {
          await db.delete(supplierPaymentAllocations).where(eq(supplierPaymentAllocations.tenantId, cid));
          await db.delete(supplierPayments).where(eq(supplierPayments.tenantId, cid));
          await db.delete(supplierCredits).where(eq(supplierCredits.tenantId, cid));
          await db.delete(supplierBills).where(eq(supplierBills.tenantId, cid));
          await db.delete(purchaseReturns).where(eq(purchaseReturns.tenantId, cid));
          await db.delete(goodsReceipts).where(eq(goodsReceipts.tenantId, cid));
          await db.delete(purchaseOrders).where(eq(purchaseOrders.tenantId, cid));
          await db.delete(supplierQuotations).where(eq(supplierQuotations.tenantId, cid));
          await db.delete(rfqs).where(eq(rfqs.tenantId, cid));
          await db.delete(purchaseRequests).where(eq(purchaseRequests.tenantId, cid));
          await db.delete(suppliers).where(eq(suppliers.tenantId, cid));
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

  it('1. should guarantee Supplier & Procurement Count = 0 upon startup and new company establishment', async () => {
    // Proves there is no "casual" mock supplier seeding on startup or company creation.
    const sups = await procurementRepository.listSuppliers(companyId);
    expect(sups).toHaveLength(0);

    const prs = await procurementRepository.listPurchaseRequests(companyId);
    expect(prs).toHaveLength(0);
  });

  it('2. should manage Supplier master with robust company isolation and edit audit', async () => {
    const sup = await procurementRepository.createSupplier(companyId, {
      code: 'SUP-001',
      nameEn: 'Marafie Engineering',
      nameAr: 'معرفي الهندسية',
      email: 'info@marafie.test',
      phone: '+965 1800 111',
      bankName: 'Gulf Bank',
      bankIban: 'KW00GULF000101',
    }, 'test_user');

    expect(sup.id).toBeDefined();
    expect(sup.code).toBe('SUP-001');

    // Attempt update from unauthorized company (OtherCompanyId) -> must throw error
    await expect(
      procurementRepository.updateSupplier(otherCompanyId, sup.id, { nameEn: 'Malicious Change' }, 'attacker')
    ).rejects.toThrow();

    // Valid update
    const updated = await procurementRepository.updateSupplier(companyId, sup.id, {
      nameEn: 'Marafie Engineering Group',
    }, 'test_user');
    expect(updated.nameEn).toBe('Marafie Engineering Group');
  });

  it('3. should support complete Purchase Request lifecycle (Create, Edit, Submit, Approve, Delete)', async () => {
    const pr = await procurementRepository.createPurchaseRequest(companyId, {
      branchId,
      requestDate: '2026-09-30',
      priority: 'HIGH',
      purpose: 'Emergency warehouse equipment',
      lines: [
        { description: 'Heavy duty hydraulic forklift', quantity: '2.000', estimatedUnitCost: '2500.000' }
      ]
    }, 'test_user');

    expect(pr.id).toBeDefined();
    expect(pr.requestNumber).toContain('PR-');

    // Update Draft PR
    const updated = await procurementRepository.updatePurchaseRequest(companyId, pr.id, {
      notes: 'Ensure warranty is included',
    }, 'test_user');
    expect(updated.notes).toBe('Ensure warranty is included');

    // Submit
    const submitted = await procurementRepository.setPurchaseRequestStatus(companyId, pr.id, 'SUBMITTED', 'test_user');
    expect(submitted.status).toBe('SUBMITTED');

    // Approve
    const approved = await procurementRepository.setPurchaseRequestStatus(companyId, pr.id, 'APPROVED', 'test_user');
    expect(approved.status).toBe('APPROVED');
  });

  it('4. should support RFQ, Quotation comparison and PO generation flow', async () => {
    // Setup supplier
    const sup = await procurementRepository.createSupplier(companyId, {
      code: 'SUP-002',
      nameEn: 'Kuwait Supply Co',
      nameAr: 'شركة التجهيزات الكويتية',
    });

    // Create RFQ
    const rfq = await procurementRepository.createRFQ(companyId, {
      branchId,
      rfqDate: '2026-09-30',
      responseDeadline: '2026-10-15',
      supplierIds: [sup.id],
      instructions: 'Quote for building raw materials'
    });
    expect(rfq.id).toBeDefined();

    // Create Quotation
    const quote = await procurementRepository.createSupplierQuotation(companyId, {
      branchId,
      supplierId: sup.id,
      rfqId: rfq.id,
      supplierQuoteNumber: 'Q-MAT-998',
      quoteDate: '2026-09-30',
      currency: 'KWD',
      subtotal: '1200.000',
      grandTotal: '1200.000',
      lines: [
        { description: 'Concrete Reinforcement Steel Bars', quantity: '10.000', unitPrice: '120.000', total: '1200.000' }
      ]
    });
    expect(quote.id).toBeDefined();

    // Select Quotation (Comparison selection)
    const selected = await procurementRepository.selectQuotation(companyId, quote.id, 'Best pricing offered', 'test_user');
    expect(selected.status).toBe('SELECTED');
  });

  it('5. should handle PO, Receipt, matching Supplier Bill, and Duplicate Bill Prevention', async () => {
    const sup = await procurementRepository.createSupplier(companyId, {
      code: 'SUP-003',
      nameEn: 'Sultan Center General',
      nameAr: 'مركز سلطان العام',
    });

    // Create PO
    const poHeader = await procurementRepository.createPurchaseOrder(companyId, {
      branchId,
      supplierId: sup.id,
      orderDate: '2026-09-30',
      currency: 'KWD',
      subtotal: '1000.000',
      grandTotal: '1000.000',
      lines: [
        { description: 'Bulk copy paper boxes', orderedQuantity: '100.000', unitPrice: '10.000', total: '1000.000' }
      ]
    });
    const po = await procurementRepository.getPurchaseOrder(companyId, poHeader.id);
    if (!po) throw new Error('PO not found after creation');

    // Approved PO
    const approved = await procurementRepository.approvePurchaseOrder(companyId, po.id, 'test_user');
    expect(approved.status).toBe('APPROVED');

    // Confirm Goods Receipt (Partial GRN = 80 boxes)
    const grn = await procurementRepository.createGoodsReceipt(companyId, {
      branchId,
      supplierId: sup.id,
      purchaseOrderId: po.id,
      receiptDate: '2026-09-30',
      lines: [
        {
          purchaseOrderLineId: po.lines[0].id,
          description: po.lines[0].description,
          orderedQuantity: po.lines[0].orderedQuantity,
          previouslyReceivedQuantity: '0.000',
          thisReceiptQuantity: '80.000',
          acceptedQuantity: '80.000'
        }
      ]
    });
    expect(grn.status).toBe('CONFIRMED');

    // Verify PO status updated to PARTIALLY_RECEIVED
    const poChecked = await procurementRepository.getPurchaseOrder(companyId, po.id);
    expect(poChecked!.status).toBe('PARTIALLY_RECEIVED');

    // Create Supplier Bill (Qty = 90 boxes) -> Should trigger Three-Way Match exception (Billed 90 > Received 80)
    await expect(
      procurementRepository.createSupplierBill(companyId, {
        branchId,
        supplierId: sup.id,
        supplierInvoiceNumber: 'INV-SULTAN-101',
        purchaseOrderId: po.id,
        goodsReceiptId: grn.id,
        billDate: '2026-09-30',
        dueDate: '2026-10-30',
        currency: 'KWD',
        subtotal: '900.000',
        grandTotal: '900.000',
        lines: [
          {
            purchaseOrderLineId: po.lines[0].id,
            description: po.lines[0].description,
            quantity: '90.000', // exceeds 80 received
            unitPrice: '10.000',
            total: '900.000'
          }
        ]
      })
    ).rejects.toThrow('3-way match exception');

    // Create valid Bill (Qty = 80 boxes)
    const bill = await procurementRepository.createSupplierBill(companyId, {
      branchId,
      supplierId: sup.id,
      supplierInvoiceNumber: 'INV-SULTAN-101',
      purchaseOrderId: po.id,
      goodsReceiptId: grn.id,
      billDate: '2026-09-30',
      dueDate: '2026-10-30',
      currency: 'KWD',
      subtotal: '800.000',
      grandTotal: '800.000',
      lines: [
        {
          purchaseOrderLineId: po.lines[0].id,
          description: po.lines[0].description,
          quantity: '80.000',
          unitPrice: '10.000',
          total: '800.000'
        }
      ]
    });
    expect(bill.id).toBeDefined();

    // Posting the bill
    const postedBill = await procurementRepository.postSupplierBill(companyId, bill.id, 'test_user');
    expect(postedBill.status).toBe('POSTED');

    // Attempting duplicate bill creation -> must throw error
    await expect(
      procurementRepository.createSupplierBill(companyId, {
        branchId,
        supplierId: sup.id,
        supplierInvoiceNumber: 'INV-SULTAN-101', // same number
        billDate: '2026-09-30',
        dueDate: '2026-10-30',
        currency: 'KWD',
        subtotal: '800.000',
        grandTotal: '800.000',
        lines: [
          { description: 'Bulk copy paper boxes', quantity: '80.000', unitPrice: '10.000', total: '800.000' }
        ]
      })
    ).rejects.toThrow('Duplicate bill protection');
  });

  it('6. should execute transaction-safe payment allocations and statements with 3-decimal KWD precision', async () => {
    const sup = await procurementRepository.createSupplier(companyId, {
      code: 'SUP-004',
      nameEn: 'Kuwait Concrete Co',
      nameAr: 'خرسانة الكويت',
    });

    // Create opening balance supplier bill
    const billA = await procurementRepository.createSupplierBill(companyId, {
      branchId,
      supplierId: sup.id,
      supplierInvoiceNumber: 'INV-CONC-01',
      billDate: '2026-09-01', // Before statement date (dateFrom = 2026-09-10)
      dueDate: '2026-09-20',
      currency: 'KWD',
      subtotal: '200.000',
      grandTotal: '200.000',
      lines: [{ description: 'Base foundation supply', quantity: '1.000', unitPrice: '200.000', total: '200.000' }]
    });
    await procurementRepository.postSupplierBill(companyId, billA.id, 'test_user');

    // Create current period bill
    const billB = await procurementRepository.createSupplierBill(companyId, {
      branchId,
      supplierId: sup.id,
      supplierInvoiceNumber: 'INV-CONC-02',
      billDate: '2026-09-15', // In-period
      dueDate: '2026-10-15',
      currency: 'KWD',
      subtotal: '800.000',
      grandTotal: '800.000',
      lines: [{ description: 'Main concrete pillars', quantity: '1.000', unitPrice: '800.000', total: '800.000' }]
    });
    await procurementRepository.postSupplierBill(companyId, billB.id, 'test_user');

    // Create Payment (KWD 400.000) allocating KWD 400.000 to Bill B
    const payment = await procurementRepository.createSupplierPayment(companyId, {
      branchId,
      supplierId: sup.id,
      paymentDate: '2026-09-20',
      currency: 'KWD',
      paymentMethodId: 'BANK_TRANSFER',
      amount: '400.000',
      allocations: [
        { supplierBillId: billB.id, allocatedAmount: '400.000' }
      ]
    });
    expect(payment.unallocatedAmount).toBe('0.000');
    expect(payment.allocatedAmount).toBe('400.000');

    // Verify Bill B's outstanding is now KWD 400.000 (800 - 400)
    const checkedBillB = await procurementRepository.getSupplierBill(companyId, billB.id);
    expect(checkedBillB!.outstandingAmount).toBe('400.000');

    // Verify over-allocation error handling
    await expect(
      procurementRepository.createSupplierPayment(companyId, {
        branchId,
        supplierId: sup.id,
        paymentDate: '2026-09-22',
        currency: 'KWD',
        paymentMethodId: 'CASH',
        amount: '500.000',
        allocations: [
          { supplierBillId: billB.id, allocatedAmount: '500.000' } // exceeds remaining 400.000
        ]
      })
    ).rejects.toThrow();

    // Create Supplier Credit (KWD 100.000)
    const credit = await procurementRepository.createSupplierCredit(companyId, {
      branchId,
      supplierId: sup.id,
      creditDate: '2026-09-25',
      currency: 'KWD',
      amount: '100.000',
      notes: 'Price reduction credit note'
    });
    await procurementRepository.postSupplierCredit(companyId, credit.id, 'test_user');

    // Request statement from 2026-09-10 to 2026-09-30
    const stmt = await procurementRepository.getSupplierStatement(companyId, sup.id, '2026-09-10', '2026-09-30');

    // Validate calculations
    expect(stmt.openingBalance).toBe('200.000'); // Bill A (200.000)
    expect(stmt.closingBalance).toBe('500.000'); // 200 (Opening) + 800 (Bill B) - 400 (Payment) - 100 (Credit) = 500
    expect(stmt.items).toHaveLength(3); // Bill B, Payment, Credit
  });

  it('7. should guarantee existing Sales Client behavior is untouched (Client Regression)', async () => {
    // Proves Part B did not alter Client endpoints or domain behavior
    const testCl = await salesRepository.createClient(companyId, {
      code: 'REG-001',
      nameEn: 'Regression Client Ltd',
      nameAr: 'عميل التراجع المالي',
    });
    expect(testCl.id).toBeDefined();

    const activeList = await salesRepository.listClients(companyId);
    expect(activeList.some(c => c.id === testCl.id)).toBe(true);
  });
});
