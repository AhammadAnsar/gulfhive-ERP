import { eq, and, desc, asc, sql, inArray } from 'drizzle-orm';
import { db } from '../../../db/index.ts';
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
  auditLogs,
} from '../../../db/schema.ts';
import { numberingRepository } from './numbering.repository.ts';
import { Money } from '../../../core/domain/money.ts';
import { logger } from '../../../core/logging/logger.ts';

export class ProcurementRepository {
  // ==========================================
  // 1. SUPPLIERS CRUD
  // ==========================================

  public async listSuppliers(tenantId: string) {
    return db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.tenantId, tenantId), sql`${suppliers.deletedAt} IS NULL`))
      .orderBy(asc(suppliers.code));
  }

  public async getSupplier(tenantId: string, supplierId: number) {
    const [supplier] = await db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.tenantId, tenantId), eq(suppliers.id, supplierId), sql`${suppliers.deletedAt} IS NULL`))
      .limit(1);
    return supplier || null;
  }

  public async createSupplier(
    tenantId: string,
    input: {
      code: string;
      nameEn: string;
      nameAr: string;
      email?: string;
      phone?: string;
      website?: string;
      crNumber?: string;
      vatNumber?: string;
      paymentTermsId?: string;
      currency?: string;
      bankName?: string;
      bankIban?: string;
      bankSwift?: string;
    },
    actorId = 'system'
  ) {
    const cleanCode = input.code.toUpperCase().trim();

    // Unique code check
    const existing = await db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.tenantId, tenantId), eq(suppliers.code, cleanCode), sql`${suppliers.deletedAt} IS NULL`))
      .limit(1);

    if (existing.length > 0) {
      throw new Error(`Supplier with code '${cleanCode}' already exists.`);
    }

    const [inserted] = await db
      .insert(suppliers)
      .values({
        tenantId,
        code: cleanCode,
        nameEn: input.nameEn.trim(),
        nameAr: input.nameAr.trim(),
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
        website: input.website?.trim() || null,
        crNumber: input.crNumber?.trim() || null,
        vatNumber: input.vatNumber?.trim() || null,
        paymentTermsId: input.paymentTermsId || '30 Days',
        currency: input.currency || 'KWD',
        bankName: input.bankName?.trim() || null,
        bankIban: input.bankIban?.trim() || null,
        bankSwift: input.bankSwift?.trim() || null,
        status: 'ACTIVE',
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    await db.insert(auditLogs).values({
      tenantId,
      actorId,
      action: 'CREATE',
      entityType: 'SUPPLIER',
      entityId: String(inserted.id),
      resultingState: inserted,
    });

    return inserted;
  }

  public async updateSupplier(
    tenantId: string,
    supplierId: number,
    input: {
      nameEn?: string;
      nameAr?: string;
      email?: string;
      phone?: string;
      website?: string;
      crNumber?: string;
      vatNumber?: string;
      paymentTermsId?: string;
      currency?: string;
      bankName?: string;
      bankIban?: string;
      bankSwift?: string;
      status?: string;
    },
    actorId = 'system'
  ) {
    const existing = await this.getSupplier(tenantId, supplierId);
    if (!existing) throw new Error('Supplier not found or access denied');

    const [updated] = await db
      .update(suppliers)
      .set({
        nameEn: input.nameEn !== undefined ? input.nameEn.trim() : existing.nameEn,
        nameAr: input.nameAr !== undefined ? input.nameAr.trim() : existing.nameAr,
        email: input.email !== undefined ? input.email?.trim() || null : existing.email,
        phone: input.phone !== undefined ? input.phone?.trim() || null : existing.phone,
        website: input.website !== undefined ? input.website?.trim() || null : existing.website,
        crNumber: input.crNumber !== undefined ? input.crNumber?.trim() || null : existing.crNumber,
        vatNumber: input.vatNumber !== undefined ? input.vatNumber?.trim() || null : existing.vatNumber,
        paymentTermsId: input.paymentTermsId !== undefined ? input.paymentTermsId : existing.paymentTermsId,
        currency: input.currency !== undefined ? input.currency : existing.currency,
        bankName: input.bankName !== undefined ? input.bankName?.trim() || null : existing.bankName,
        bankIban: input.bankIban !== undefined ? input.bankIban?.trim() || null : existing.bankIban,
        bankSwift: input.bankSwift !== undefined ? input.bankSwift?.trim() || null : existing.bankSwift,
        status: input.status !== undefined ? (input.status as any) : existing.status,
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(and(eq(suppliers.id, supplierId), eq(suppliers.tenantId, tenantId)))
      .returning();

    await db.insert(auditLogs).values({
      tenantId,
      actorId,
      action: 'UPDATE',
      entityType: 'SUPPLIER',
      entityId: String(supplierId),
      previousState: existing,
      resultingState: updated,
    });

    return updated;
  }

  public async preflightDeleteSupplier(tenantId: string, supplierId: number) {
    const supplier = await this.getSupplier(tenantId, supplierId);
    if (!supplier) throw new Error('Supplier not found or access denied');

    const quotes = await db.select().from(supplierQuotations).where(and(eq(supplierQuotations.supplierId, supplierId), sql`${supplierQuotations.deletedAt} IS NULL`));
    const pos = await db.select().from(purchaseOrders).where(and(eq(purchaseOrders.supplierId, supplierId), sql`${purchaseOrders.deletedAt} IS NULL`));
    const grns = await db.select().from(goodsReceipts).where(and(eq(goodsReceipts.supplierId, supplierId), sql`${goodsReceipts.deletedAt} IS NULL`));
    const bills = await db.select().from(supplierBills).where(and(eq(supplierBills.supplierId, supplierId), sql`${supplierBills.deletedAt} IS NULL`));
    const payments = await db.select().from(supplierPayments).where(and(eq(supplierPayments.supplierId, supplierId), sql`${supplierPayments.deletedAt} IS NULL`));

    const totalReferences = quotes.length + pos.length + grns.length + bills.length + payments.length;
    const isEligibleForHardDelete = totalReferences === 0;

    const reasons: string[] = [];
    if (quotes.length > 0) reasons.push(`${quotes.length} Quotation(s) from this supplier`);
    if (pos.length > 0) reasons.push(`${pos.length} Purchase Order(s) reference this supplier`);
    if (grns.length > 0) reasons.push(`${grns.length} Goods Receipt(s) reference this supplier`);
    if (bills.length > 0) reasons.push(`${bills.length} Bill(s) reference this supplier`);
    if (payments.length > 0) reasons.push(`${payments.length} Payment(s) reference this supplier`);

    return {
      supplierId,
      nameEn: supplier.nameEn,
      isEligibleForHardDelete,
      totalReferences,
      reasons,
    };
  }

  public async deleteSupplier(tenantId: string, supplierId: number, actorId = 'system', reason = '') {
    const preflight = await this.preflightDeleteSupplier(tenantId, supplierId);
    const supplier = await this.getSupplier(tenantId, supplierId);
    if (!supplier) throw new Error('Supplier not found');

    if (preflight.isEligibleForHardDelete) {
      await db.delete(suppliers).where(and(eq(suppliers.id, supplierId), eq(suppliers.tenantId, tenantId)));
      await db.insert(auditLogs).values({
        tenantId,
        actorId,
        action: 'DELETE',
        entityType: 'SUPPLIER',
        entityId: String(supplierId),
        previousState: supplier,
      });
      return { action: 'HARD_DELETE', success: true };
    } else {
      const [updated] = await db
        .update(suppliers)
        .set({
          deletedAt: new Date(),
          deletedBy: actorId,
          deleteReason: reason || 'Soft deleted due to dependency history',
          status: 'DELETED' as any,
          updatedAt: new Date(),
          updatedBy: actorId,
        })
        .where(and(eq(suppliers.id, supplierId), eq(suppliers.tenantId, tenantId)))
        .returning();

      await db.insert(auditLogs).values({
        tenantId,
        actorId,
        action: 'SOFT_DELETE',
        entityType: 'SUPPLIER',
        entityId: String(supplierId),
        previousState: supplier,
        resultingState: updated,
      });
      return { action: 'SOFT_DELETE', success: true, reason };
    }
  }

  public async preflightBulkDeleteSuppliers(tenantId: string, supplierIds: number[]) {
    if (!supplierIds || supplierIds.length === 0) {
      return { totalCount: 0, eligibleCount: 0, protectedCount: 0, items: [] };
    }

    const targetSuppliers = await db
      .select({
        id: suppliers.id,
        code: suppliers.code,
        nameEn: suppliers.nameEn,
        status: suppliers.status,
      })
      .from(suppliers)
      .where(and(eq(suppliers.tenantId, tenantId), inArray(suppliers.id, supplierIds), sql`${suppliers.deletedAt} IS NULL`));

    const items = [];
    for (const sup of targetSuppliers) {
      const check = await this.preflightDeleteSupplier(tenantId, sup.id);
      items.push({
        id: sup.id,
        code: sup.code,
        nameEn: sup.nameEn,
        isEligibleForDelete: check.isEligibleForHardDelete,
        reasons: check.reasons,
        status: sup.status,
      });
    }

    const eligibleCount = items.filter((i) => i.isEligibleForDelete).length;
    const protectedCount = items.filter((i) => !i.isEligibleForDelete).length;

    return {
      totalCount: items.length,
      eligibleCount,
      protectedCount,
      items,
    };
  }

  public async bulkDeleteSuppliers(
    tenantId: string,
    params: {
      supplierIds: number[];
      action: 'DELETE' | 'ARCHIVE';
      actorId: string;
      reason?: string;
    }
  ) {
    const preflight = await this.preflightBulkDeleteSuppliers(tenantId, params.supplierIds);
    const result = {
      requested: preflight.totalCount,
      deleted: 0,
      protected: 0,
      archived: 0,
      failed: 0,
      details: [] as Array<{
        id: number;
        code: string;
        nameEn: string;
        status: 'DELETED' | 'PROTECTED' | 'ARCHIVED' | 'FAILED';
        message?: string;
      }>,
    };

    if (params.action === 'DELETE') {
      for (const item of preflight.items) {
        if (!item.isEligibleForDelete) {
          result.protected++;
          result.details.push({
            id: item.id,
            code: item.code,
            nameEn: item.nameEn,
            status: 'PROTECTED',
            message: `Protected: ${item.reasons.join('; ')}`,
          });
          continue;
        }

        try {
          await db.delete(suppliers).where(and(eq(suppliers.id, item.id), eq(suppliers.tenantId, tenantId)));
          result.deleted++;
          result.details.push({ id: item.id, code: item.code, nameEn: item.nameEn, status: 'DELETED' });
        } catch (error: any) {
          result.failed++;
          result.details.push({ id: item.id, code: item.code, nameEn: item.nameEn, status: 'FAILED', message: error.message });
        }
      }
    } else {
      // ARCHIVE
      for (const item of preflight.items) {
        try {
          await db
            .update(suppliers)
            .set({
              deletedAt: new Date(),
              deletedBy: params.actorId,
              deleteReason: params.reason || 'Bulk archived',
              status: 'DELETED' as any,
              updatedAt: new Date(),
              updatedBy: params.actorId,
            })
            .where(and(eq(suppliers.id, item.id), eq(suppliers.tenantId, tenantId)));

          result.archived++;
          result.details.push({ id: item.id, code: item.code, nameEn: item.nameEn, status: 'ARCHIVED' });
        } catch (error: any) {
          result.failed++;
          result.details.push({ id: item.id, code: item.code, nameEn: item.nameEn, status: 'FAILED', message: error.message });
        }
      }
    }

    return result;
  }

  // ==========================================
  // 2. PURCHASE REQUESTS CRUD & Status
  // ==========================================

  public async listPurchaseRequests(tenantId: string) {
    return db
      .select()
      .from(purchaseRequests)
      .where(and(eq(purchaseRequests.tenantId, tenantId), sql`${purchaseRequests.deletedAt} IS NULL`))
      .orderBy(desc(purchaseRequests.requestNumber));
  }

  public async getPurchaseRequest(tenantId: string, id: number) {
    const [header] = await db
      .select()
      .from(purchaseRequests)
      .where(and(eq(purchaseRequests.tenantId, tenantId), eq(purchaseRequests.id, id), sql`${purchaseRequests.deletedAt} IS NULL`))
      .limit(1);

    if (!header) return null;

    const lines = await db
      .select()
      .from(purchaseRequestLines)
      .where(eq(purchaseRequestLines.purchaseRequestId, id));

    return { ...header, lines };
  }

  public async createPurchaseRequest(
    tenantId: string,
    input: {
      branchId: string;
      requestDate: string;
      requestedByEmployeeId?: string;
      departmentId?: string;
      costCenterId?: string;
      projectId?: string;
      requiredDate?: string;
      priority?: string;
      purpose?: string;
      notes?: string;
      lines: Array<{
        itemId?: string;
        description: string;
        quantity: string;
        unitId?: string;
        estimatedUnitCost?: string;
        requiredDate?: string;
        costCenterId?: string;
        projectId?: string;
        notes?: string;
      }>;
    },
    actorId = 'system'
  ) {
    const num = await numberingRepository.generateNextNumber(tenantId, 'PURCHASE_REQUEST');

    return db.transaction(async (tx) => {
      const [header] = await tx
        .insert(purchaseRequests)
        .values({
          tenantId,
          branchId: input.branchId,
          requestNumber: num,
          requestDate: input.requestDate,
          requestedByEmployeeId: input.requestedByEmployeeId || null,
          departmentId: input.departmentId || null,
          costCenterId: input.costCenterId || null,
          projectId: input.projectId || null,
          requiredDate: input.requiredDate || null,
          priority: input.priority || 'MEDIUM',
          status: 'DRAFT',
          purpose: input.purpose || null,
          notes: input.notes || null,
          createdBy: actorId,
          updatedBy: actorId,
        })
        .returning();

      for (const l of input.lines) {
        await tx.insert(purchaseRequestLines).values({
          purchaseRequestId: header.id,
          itemId: l.itemId || null,
          description: l.description,
          quantity: l.quantity,
          unitId: l.unitId || null,
          estimatedUnitCost: l.estimatedUnitCost || null,
          requiredDate: l.requiredDate || null,
          costCenterId: l.costCenterId || null,
          projectId: l.projectId || null,
          notes: l.notes || null,
        });
      }

      await tx.insert(auditLogs).values({
        tenantId,
        actorId,
        action: 'CREATE',
        entityType: 'PURCHASE_REQUEST',
        entityId: String(header.id),
        resultingState: header,
      });

      return header;
    });
  }

  public async updatePurchaseRequest(
    tenantId: string,
    id: number,
    input: {
      requestDate?: string;
      requestedByEmployeeId?: string;
      departmentId?: string;
      costCenterId?: string;
      projectId?: string;
      requiredDate?: string;
      priority?: string;
      purpose?: string;
      notes?: string;
      lines?: Array<{
        itemId?: string;
        description: string;
        quantity: string;
        unitId?: string;
        estimatedUnitCost?: string;
        requiredDate?: string;
        costCenterId?: string;
        projectId?: string;
        notes?: string;
      }>;
    },
    actorId = 'system'
  ) {
    const existing = await this.getPurchaseRequest(tenantId, id);
    if (!existing) throw new Error('Purchase Request not found');
    if (existing.status !== 'DRAFT') throw new Error('Only DRAFT purchase requests can be edited');

    return db.transaction(async (tx) => {
      const [header] = await tx
        .update(purchaseRequests)
        .set({
          requestDate: input.requestDate !== undefined ? input.requestDate : existing.requestDate,
          requestedByEmployeeId: input.requestedByEmployeeId !== undefined ? input.requestedByEmployeeId : existing.requestedByEmployeeId,
          departmentId: input.departmentId !== undefined ? input.departmentId : existing.departmentId,
          costCenterId: input.costCenterId !== undefined ? input.costCenterId : existing.costCenterId,
          projectId: input.projectId !== undefined ? input.projectId : existing.projectId,
          requiredDate: input.requiredDate !== undefined ? input.requiredDate : existing.requiredDate,
          priority: input.priority !== undefined ? input.priority : existing.priority,
          purpose: input.purpose !== undefined ? input.purpose : existing.purpose,
          notes: input.notes !== undefined ? input.notes : existing.notes,
          updatedAt: new Date(),
          updatedBy: actorId,
        })
        .where(eq(purchaseRequests.id, id))
        .returning();

      if (input.lines) {
        await tx.delete(purchaseRequestLines).where(eq(purchaseRequestLines.purchaseRequestId, id));
        for (const l of input.lines) {
          await tx.insert(purchaseRequestLines).values({
            purchaseRequestId: id,
            itemId: l.itemId || null,
            description: l.description,
            quantity: l.quantity,
            unitId: l.unitId || null,
            estimatedUnitCost: l.estimatedUnitCost || null,
            requiredDate: l.requiredDate || null,
            costCenterId: l.costCenterId || null,
            projectId: l.projectId || null,
            notes: l.notes || null,
          });
        }
      }

      await tx.insert(auditLogs).values({
        tenantId,
        actorId,
        action: 'UPDATE',
        entityType: 'PURCHASE_REQUEST',
        entityId: String(id),
        previousState: existing,
        resultingState: header,
      });

      return header;
    });
  }

  public async setPurchaseRequestStatus(tenantId: string, id: number, status: string, actorId = 'system') {
    const [updated] = await db
      .update(purchaseRequests)
      .set({ status: status as any, updatedAt: new Date(), updatedBy: actorId })
      .where(and(eq(purchaseRequests.id, id), eq(purchaseRequests.tenantId, tenantId)))
      .returning();

    await db.insert(auditLogs).values({
      tenantId,
      actorId,
      action: 'UPDATE',
      entityType: 'PURCHASE_REQUEST_STATUS',
      entityId: String(id),
      resultingState: updated,
    });

    return updated;
  }

  public async deletePurchaseRequest(tenantId: string, id: number, actorId = 'system', reason = '') {
    const existing = await this.getPurchaseRequest(tenantId, id);
    if (!existing) throw new Error('Purchase Request not found');

    if (existing.status === 'DRAFT') {
      await db.delete(purchaseRequestLines).where(eq(purchaseRequestLines.purchaseRequestId, id));
      await db.delete(purchaseRequests).where(and(eq(purchaseRequests.id, id), eq(purchaseRequests.tenantId, tenantId)));
      return { action: 'HARD_DELETE', success: true };
    } else {
      const [updated] = await db
        .update(purchaseRequests)
        .set({
          deletedAt: new Date(),
          deletedBy: actorId,
          deleteReason: reason || 'Cancelled / Archived',
          status: 'DELETED' as any,
          updatedAt: new Date(),
          updatedBy: actorId,
        })
        .where(and(eq(purchaseRequests.id, id), eq(purchaseRequests.tenantId, tenantId)))
        .returning();
      return { action: 'SOFT_DELETE', success: true, reason };
    }
  }

  // ==========================================
  // 3. REQUEST FOR QUOTATIONS (RFQ)
  // ==========================================

  public async listRFQs(tenantId: string) {
    return db
      .select()
      .from(rfqs)
      .where(and(eq(rfqs.tenantId, tenantId), sql`${rfqs.deletedAt} IS NULL`))
      .orderBy(desc(rfqs.rfqNumber));
  }

  public async getRFQ(tenantId: string, id: number) {
    const [header] = await db
      .select()
      .from(rfqs)
      .where(and(eq(rfqs.tenantId, tenantId), eq(rfqs.id, id), sql`${rfqs.deletedAt} IS NULL`))
      .limit(1);

    if (!header) return null;

    const rfqSups = await db
      .select({ supplierId: rfqSuppliers.supplierId })
      .from(rfqSuppliers)
      .where(eq(rfqSuppliers.rfqId, id));

    return { ...header, supplierIds: rfqSups.map((s) => s.supplierId) };
  }

  public async createRFQ(
    tenantId: string,
    input: {
      branchId: string;
      rfqDate: string;
      responseDeadline: string;
      purchaseRequestId?: number;
      instructions?: string;
      supplierIds: number[];
    },
    actorId = 'system'
  ) {
    const num = await numberingRepository.generateNextNumber(tenantId, 'RFQ');

    return db.transaction(async (tx) => {
      const [header] = await tx
        .insert(rfqs)
        .values({
          tenantId,
          branchId: input.branchId,
          rfqNumber: num,
          rfqDate: input.rfqDate,
          responseDeadline: input.responseDeadline,
          purchaseRequestId: input.purchaseRequestId || null,
          instructions: input.instructions || null,
          status: 'DRAFT',
          createdBy: actorId,
          updatedBy: actorId,
        })
        .returning();

      for (const supId of input.supplierIds) {
        await tx.insert(rfqSuppliers).values({
          rfqId: header.id,
          supplierId: supId,
        });
      }

      await tx.insert(auditLogs).values({
        tenantId,
        actorId,
        action: 'CREATE',
        entityType: 'RFQ',
        entityId: String(header.id),
        resultingState: header,
      });

      return header;
    });
  }

  public async deleteRFQ(tenantId: string, id: number, actorId = 'system') {
    await db.update(rfqs).set({ deletedAt: new Date(), deletedBy: actorId, status: 'CANCELLED' as any }).where(and(eq(rfqs.id, id), eq(rfqs.tenantId, tenantId)));
    return { success: true };
  }

  // ==========================================
  // 4. SUPPLIER QUOTATIONS & COMPARISONS
  // ==========================================

  public async listSupplierQuotations(tenantId: string) {
    return db
      .select()
      .from(supplierQuotations)
      .where(and(eq(supplierQuotations.tenantId, tenantId), sql`${supplierQuotations.deletedAt} IS NULL`))
      .orderBy(desc(supplierQuotations.createdAt));
  }

  public async getSupplierQuotation(tenantId: string, id: number) {
    const [header] = await db
      .select()
      .from(supplierQuotations)
      .where(and(eq(supplierQuotations.tenantId, tenantId), eq(supplierQuotations.id, id), sql`${supplierQuotations.deletedAt} IS NULL`))
      .limit(1);

    if (!header) return null;

    const lines = await db
      .select()
      .from(supplierQuotationLines)
      .where(eq(supplierQuotationLines.supplierQuotationId, id));

    return { ...header, lines };
  }

  public async createSupplierQuotation(
    tenantId: string,
    input: {
      branchId: string;
      supplierId: number;
      rfqId?: number;
      supplierQuoteNumber: string;
      quoteDate: string;
      validUntil?: string;
      currency: string;
      paymentTermsId?: string;
      deliveryTime?: string;
      subtotal: string;
      discountTotal?: string;
      taxTotal?: string;
      grandTotal: string;
      lines: Array<{
        description: string;
        quantity: string;
        unitPrice: string;
        discount?: string;
        tax?: string;
        total: string;
      }>;
    },
    actorId = 'system'
  ) {
    return db.transaction(async (tx) => {
      const [header] = await tx
        .insert(supplierQuotations)
        .values({
          tenantId,
          branchId: input.branchId,
          supplierId: input.supplierId,
          rfqId: input.rfqId || null,
          supplierQuoteNumber: input.supplierQuoteNumber,
          quoteDate: input.quoteDate,
          validUntil: input.validUntil || null,
          currency: input.currency,
          paymentTermsId: input.paymentTermsId || '30 Days',
          deliveryTime: input.deliveryTime || null,
          subtotal: input.subtotal,
          discountTotal: input.discountTotal || '0.000',
          taxTotal: input.taxTotal || '0.000',
          grandTotal: input.grandTotal,
          status: 'PENDING',
          createdBy: actorId,
        })
        .returning();

      for (const l of input.lines) {
        await tx.insert(supplierQuotationLines).values({
          supplierQuotationId: header.id,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: l.discount || '0.000',
          tax: l.tax || '0.000',
          total: l.total,
        });
      }

      await tx.insert(auditLogs).values({
        tenantId,
        actorId,
        action: 'CREATE',
        entityType: 'SUP_QUOTATION',
        entityId: String(header.id),
        resultingState: header,
      });

      return header;
    });
  }

  public async selectQuotation(tenantId: string, id: number, reason: string, actorId = 'system') {
    return db.transaction(async (tx) => {
      const [quote] = await tx
        .select()
        .from(supplierQuotations)
        .where(and(eq(supplierQuotations.id, id), eq(supplierQuotations.tenantId, tenantId)))
        .limit(1);

      if (!quote) throw new Error('Quotation not found');

      // Reject all other quotations for the same RFQ if rfqId exists
      if (quote.rfqId) {
        await tx
          .update(supplierQuotations)
          .set({ status: 'REJECTED' })
          .where(and(eq(supplierQuotations.rfqId, quote.rfqId), eq(supplierQuotations.tenantId, tenantId)));
      }

      const [updated] = await tx
        .update(supplierQuotations)
        .set({
          status: 'SELECTED',
          selectionReason: reason,
          selectedBy: actorId,
          selectedAt: new Date(),
        })
        .where(eq(supplierQuotations.id, id))
        .returning();

      return updated;
    });
  }

  // ==========================================
  // 5. PURCHASE ORDERS (PO)
  // ==========================================

  public async listPurchaseOrders(tenantId: string) {
    return db
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.tenantId, tenantId), sql`${purchaseOrders.deletedAt} IS NULL`))
      .orderBy(desc(purchaseOrders.purchaseOrderNumber));
  }

  public async getPurchaseOrder(tenantId: string, id: number) {
    const [header] = await db
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.tenantId, tenantId), eq(purchaseOrders.id, id), sql`${purchaseOrders.deletedAt} IS NULL`))
      .limit(1);

    if (!header) return null;

    const lines = await db
      .select()
      .from(purchaseOrderLines)
      .where(eq(purchaseOrderLines.purchaseOrderId, id));

    return { ...header, lines };
  }

  public async createPurchaseOrder(
    tenantId: string,
    input: {
      branchId: string;
      supplierId: number;
      purchaseRequestId?: number;
      rfqId?: number;
      supplierQuotationId?: number;
      orderDate: string;
      expectedDeliveryDate?: string;
      currency: string;
      paymentTermsId?: string;
      supplierReference?: string;
      subtotal: string;
      discountTotal?: string;
      taxTotal?: string;
      roundingAdjustment?: string;
      grandTotal: string;
      notes?: string;
      lines: Array<{
        itemId?: string;
        description: string;
        orderedQuantity: string;
        unitPrice: string;
        discount?: string;
        tax?: string;
        total: string;
        projectId?: string;
        costCenterId?: string;
      }>;
    },
    actorId = 'system'
  ) {
    const num = await numberingRepository.generateNextNumber(tenantId, 'PURCHASE_ORDER');

    return db.transaction(async (tx) => {
      const [header] = await tx
        .insert(purchaseOrders)
        .values({
          tenantId,
          branchId: input.branchId,
          purchaseOrderNumber: num,
          supplierId: input.supplierId,
          purchaseRequestId: input.purchaseRequestId || null,
          rfqId: input.rfqId || null,
          supplierQuotationId: input.supplierQuotationId || null,
          orderDate: input.orderDate,
          expectedDeliveryDate: input.expectedDeliveryDate || null,
          currency: input.currency,
          paymentTermsId: input.paymentTermsId || '30 Days',
          supplierReference: input.supplierReference || null,
          status: 'DRAFT',
          subtotal: input.subtotal,
          discountTotal: input.discountTotal || '0.000',
          taxTotal: input.taxTotal || '0.000',
          roundingAdjustment: input.roundingAdjustment || '0.000',
          grandTotal: input.grandTotal,
          notes: input.notes || null,
          createdBy: actorId,
          updatedBy: actorId,
        })
        .returning();

      for (const l of input.lines) {
        await tx.insert(purchaseOrderLines).values({
          purchaseOrderId: header.id,
          itemId: l.itemId || null,
          description: l.description,
          orderedQuantity: l.orderedQuantity,
          receivedQuantity: '0.000',
          billedQuantity: '0.000',
          returnedQuantity: '0.000',
          unitPrice: l.unitPrice,
          discount: l.discount || '0.000',
          tax: l.tax || '0.000',
          total: l.total,
          projectId: l.projectId || null,
          costCenterId: l.costCenterId || null,
        });
      }

      await tx.insert(auditLogs).values({
        tenantId,
        actorId,
        action: 'CREATE',
        entityType: 'PURCHASE_ORDER',
        entityId: String(header.id),
        resultingState: header,
      });

      return header;
    });
  }

  public async approvePurchaseOrder(tenantId: string, id: number, actorId = 'system') {
    const [updated] = await db
      .update(purchaseOrders)
      .set({
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: actorId,
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, tenantId)))
      .returning();

    await db.insert(auditLogs).values({
      tenantId,
      actorId,
      action: 'APPROVE',
      entityType: 'PURCHASE_ORDER',
      entityId: String(id),
      resultingState: updated,
    });

    return updated;
  }

  public async deletePurchaseOrder(tenantId: string, id: number, actorId = 'system', reason = '') {
    const po = await this.getPurchaseOrder(tenantId, id);
    if (!po) throw new Error('Purchase Order not found');

    if (po.status === 'DRAFT') {
      await db.delete(purchaseOrderLines).where(eq(purchaseOrderLines.purchaseOrderId, id));
      await db.delete(purchaseOrders).where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, tenantId)));
      return { action: 'HARD_DELETE', success: true };
    } else {
      const [updated] = await db
        .update(purchaseOrders)
        .set({
          deletedAt: new Date(),
          deletedBy: actorId,
          deleteReason: reason || 'PO Cancelled',
          status: 'CANCELLED' as any,
          updatedAt: new Date(),
          updatedBy: actorId,
        })
        .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, tenantId)))
        .returning();
      return { action: 'SOFT_DELETE', success: true, reason };
    }
  }

  // ==========================================
  // 6. GOODS / SERVICE RECEIPTS (GRN)
  // ==========================================

  public async listGoodsReceipts(tenantId: string) {
    return db
      .select()
      .from(goodsReceipts)
      .where(and(eq(goodsReceipts.tenantId, tenantId), sql`${goodsReceipts.deletedAt} IS NULL`))
      .orderBy(desc(goodsReceipts.receiptNumber));
  }

  public async getGoodsReceipt(tenantId: string, id: number) {
    const [header] = await db
      .select()
      .from(goodsReceipts)
      .where(and(eq(goodsReceipts.tenantId, tenantId), eq(goodsReceipts.id, id), sql`${goodsReceipts.deletedAt} IS NULL`))
      .limit(1);

    if (!header) return null;

    const lines = await db
      .select()
      .from(goodsReceiptLines)
      .where(eq(goodsReceiptLines.goodsReceiptId, id));

    return { ...header, lines };
  }

  public async createGoodsReceipt(
    tenantId: string,
    input: {
      branchId: string;
      supplierId: number;
      purchaseOrderId: number;
      receiptDate: string;
      warehouse?: string;
      site?: string;
      project?: string;
      supplierDeliveryNote?: string;
      receivedBy?: string;
      notes?: string;
      lines: Array<{
        purchaseOrderLineId: number;
        description: string;
        orderedQuantity: string;
        previouslyReceivedQuantity: string;
        thisReceiptQuantity: string;
        acceptedQuantity: string;
        rejectedQuantity?: string;
      }>;
    },
    actorId = 'system'
  ) {
    const num = await numberingRepository.generateNextNumber(tenantId, 'GOODS_RECEIPT');

    return db.transaction(async (tx) => {
      const [grn] = await tx
        .insert(goodsReceipts)
        .values({
          tenantId,
          branchId: input.branchId,
          receiptNumber: num,
          supplierId: input.supplierId,
          purchaseOrderId: input.purchaseOrderId,
          receiptDate: input.receiptDate,
          warehouse: input.warehouse || null,
          site: input.site || null,
          project: input.project || null,
          supplierDeliveryNote: input.supplierDeliveryNote || null,
          receivedBy: input.receivedBy || null,
          status: 'CONFIRMED',
          notes: input.notes || null,
          createdBy: actorId,
        })
        .returning();

      for (const l of input.lines) {
        await tx.insert(goodsReceiptLines).values({
          goodsReceiptId: grn.id,
          purchaseOrderLineId: l.purchaseOrderLineId,
          description: l.description,
          orderedQuantity: l.orderedQuantity,
          previouslyReceivedQuantity: l.previouslyReceivedQuantity,
          thisReceiptQuantity: l.thisReceiptQuantity,
          acceptedQuantity: l.acceptedQuantity,
          rejectedQuantity: l.rejectedQuantity || '0.000',
        });

        // Atomically update purchaseOrderLine's received quantity
        const [poLine] = await tx
          .select()
          .from(purchaseOrderLines)
          .where(eq(purchaseOrderLines.id, l.purchaseOrderLineId))
          .limit(1);

        if (poLine) {
          const prevReceived = Number(poLine.receivedQuantity) || 0;
          const currentReceipt = Number(l.acceptedQuantity) || 0;
          const newReceivedVal = (prevReceived + currentReceipt).toFixed(3);

          // If over-received and over tolerance (e.g. over ordered qty) -> prevent it
          if (prevReceived + currentReceipt > Number(poLine.orderedQuantity)) {
            throw new Error(`Receipt quantity exceeds remaining ordered quantity on PO Line.`);
          }

          await tx
            .update(purchaseOrderLines)
            .set({ receivedQuantity: newReceivedVal })
            .where(eq(purchaseOrderLines.id, l.purchaseOrderLineId));
        }
      }

      // Update PO overall status based on receipt
      const allLines = await tx
        .select()
        .from(purchaseOrderLines)
        .where(eq(purchaseOrderLines.purchaseOrderId, input.purchaseOrderId));

      const allFullyReceived = allLines.every((l) => Number(l.receivedQuantity) >= Number(l.orderedQuantity));
      const partialReceived = allLines.some((l) => Number(l.receivedQuantity) > 0);

      const nextPoStatus = allFullyReceived ? 'FULLY_RECEIVED' : (partialReceived ? 'PARTIALLY_RECEIVED' : 'APPROVED');
      await tx
        .update(purchaseOrders)
        .set({ status: nextPoStatus as any })
        .where(eq(purchaseOrders.id, input.purchaseOrderId));

      await tx.insert(auditLogs).values({
        tenantId,
        actorId,
        action: 'CONFIRM',
        entityType: 'GOODS_RECEIPT',
        entityId: String(grn.id),
        resultingState: grn,
      });

      return grn;
    });
  }

  public async deleteGoodsReceipt(tenantId: string, id: number, actorId = 'system') {
    return db.transaction(async (tx) => {
      const grn = await this.getGoodsReceipt(tenantId, id);
      if (!grn) throw new Error('Goods receipt not found');

      // Reverse lines received quantities from PO Line
      for (const l of grn.lines) {
        if (l.purchaseOrderLineId) {
          const [poLine] = await tx
            .select()
            .from(purchaseOrderLines)
            .where(eq(purchaseOrderLines.id, l.purchaseOrderLineId))
            .limit(1);

          if (poLine) {
            const currentRec = Number(poLine.receivedQuantity) || 0;
            const sub = Number(l.acceptedQuantity) || 0;
            const reversedVal = Math.max(0, currentRec - sub).toFixed(3);
            await tx
              .update(purchaseOrderLines)
              .set({ receivedQuantity: reversedVal })
              .where(eq(purchaseOrderLines.id, l.purchaseOrderLineId));
          }
        }
      }

      // Reset PO status
      if (grn.purchaseOrderId) {
        const allLines = await tx
          .select()
          .from(purchaseOrderLines)
          .where(eq(purchaseOrderLines.purchaseOrderId, grn.purchaseOrderId));

        const allFullyReceived = allLines.every((l) => Number(l.receivedQuantity) >= Number(l.orderedQuantity));
        const partialReceived = allLines.some((l) => Number(l.receivedQuantity) > 0);

        const nextPoStatus = allFullyReceived ? 'FULLY_RECEIVED' : (partialReceived ? 'PARTIALLY_RECEIVED' : 'APPROVED');
        await tx
          .update(purchaseOrders)
          .set({ status: nextPoStatus as any })
          .where(eq(purchaseOrders.id, grn.purchaseOrderId));
      }

      await tx
        .update(goodsReceipts)
        .set({ deletedAt: new Date(), deletedBy: actorId, status: 'CANCELLED' as any })
        .where(eq(goodsReceipts.id, id));

      return { success: true };
    });
  }

  // ==========================================
  // 7. PURCHASE RETURNS
  // ==========================================

  public async listPurchaseReturns(tenantId: string) {
    return db
      .select()
      .from(purchaseReturns)
      .where(and(eq(purchaseReturns.tenantId, tenantId), sql`${purchaseReturns.deletedAt} IS NULL`))
      .orderBy(desc(purchaseReturns.returnNumber));
  }

  public async getPurchaseReturn(tenantId: string, id: number) {
    const [header] = await db
      .select()
      .from(purchaseReturns)
      .where(and(eq(purchaseReturns.tenantId, tenantId), eq(purchaseReturns.id, id), sql`${purchaseReturns.deletedAt} IS NULL`))
      .limit(1);

    if (!header) return null;

    const lines = await db
      .select()
      .from(purchaseReturnLines)
      .where(eq(purchaseReturnLines.purchaseReturnId, id));

    return { ...header, lines };
  }

  public async createPurchaseReturn(
    tenantId: string,
    input: {
      branchId: string;
      supplierId: number;
      purchaseOrderId: number;
      goodsReceiptId: number;
      returnDate: string;
      notes?: string;
      lines: Array<{
        purchaseOrderLineId: number;
        description: string;
        returnedQuantity: string;
      }>;
    },
    actorId = 'system'
  ) {
    const num = await numberingRepository.generateNextNumber(tenantId, 'PURCHASE_RETURN');

    return db.transaction(async (tx) => {
      const [ret] = await tx
        .insert(purchaseReturns)
        .values({
          tenantId,
          branchId: input.branchId,
          returnNumber: num,
          supplierId: input.supplierId,
          purchaseOrderId: input.purchaseOrderId,
          goodsReceiptId: input.goodsReceiptId,
          returnDate: input.returnDate,
          status: 'CONFIRMED',
          notes: input.notes || null,
          createdBy: actorId,
        })
        .returning();

      for (const l of input.lines) {
        await tx.insert(purchaseReturnLines).values({
          purchaseReturnId: ret.id,
          purchaseOrderLineId: l.purchaseOrderLineId,
          description: l.description,
          returnedQuantity: l.returnedQuantity,
        });

        // Increment returned quantity on PO Line
        const [poLine] = await tx
          .select()
          .from(purchaseOrderLines)
          .where(eq(purchaseOrderLines.id, l.purchaseOrderLineId))
          .limit(1);

        if (poLine) {
          const currentRet = Number(poLine.returnedQuantity) || 0;
          const inc = Number(l.returnedQuantity) || 0;
          await tx
            .update(purchaseOrderLines)
            .set({ returnedQuantity: (currentRet + inc).toFixed(3) })
            .where(eq(purchaseOrderLines.id, l.purchaseOrderLineId));
        }
      }

      await tx.insert(auditLogs).values({
        tenantId,
        actorId,
        action: 'CONFIRM',
        entityType: 'PURCHASE_RETURN',
        entityId: String(ret.id),
        resultingState: ret,
      });

      return ret;
    });
  }

  // ==========================================
  // 8. SUPPLIER BILLS CRUD & 3-WAY MATCHING
  // ==========================================

  public async listSupplierBills(tenantId: string) {
    return db
      .select()
      .from(supplierBills)
      .where(and(eq(supplierBills.tenantId, tenantId), sql`${supplierBills.deletedAt} IS NULL`))
      .orderBy(desc(supplierBills.billNumber));
  }

  public async getSupplierBill(tenantId: string, id: number) {
    const [header] = await db
      .select()
      .from(supplierBills)
      .where(and(eq(supplierBills.tenantId, tenantId), eq(supplierBills.id, id), sql`${supplierBills.deletedAt} IS NULL`))
      .limit(1);

    if (!header) return null;

    const lines = await db
      .select()
      .from(supplierBillLines)
      .where(eq(supplierBillLines.supplierBillId, id));

    return { ...header, lines };
  }

  public async createSupplierBill(
    tenantId: string,
    input: {
      branchId: string;
      supplierId: number;
      supplierInvoiceNumber: string;
      purchaseOrderId?: number;
      goodsReceiptId?: number;
      billDate: string;
      dueDate: string;
      currency: string;
      paymentTermsId?: string;
      subtotal: string;
      discountTotal?: string;
      taxTotal?: string;
      roundingAdjustment?: string;
      grandTotal: string;
      notes?: string;
      lines: Array<{
        purchaseOrderLineId?: number;
        description: string;
        quantity: string;
        unitPrice: string;
        discount?: string;
        tax?: string;
        total: string;
        projectId?: string;
        costCenterId?: string;
      }>;
    },
    actorId = 'system'
  ) {
    const num = await numberingRepository.generateNextNumber(tenantId, 'SUP_BILL');

    // Duplicate Supplier Invoice Reference Check
    const dupCheck = await db
      .select()
      .from(supplierBills)
      .where(
        and(
          eq(supplierBills.tenantId, tenantId),
          eq(supplierBills.supplierId, input.supplierId),
          eq(supplierBills.supplierInvoiceNumber, input.supplierInvoiceNumber.trim()),
          sql`${supplierBills.deletedAt} IS NULL`
        )
      )
      .limit(1);

    if (dupCheck.length > 0) {
      throw new Error(`Duplicate bill protection: supplier invoice reference '${input.supplierInvoiceNumber}' is already posted for this supplier.`);
    }

    // 3-way match validation logic
    if (input.goodsReceiptId) {
      const grLines = await db
        .select()
        .from(goodsReceiptLines)
        .where(eq(goodsReceiptLines.goodsReceiptId, input.goodsReceiptId));

      const grLineMap = new Map<number, number>();
      for (const grLine of grLines) {
        if (grLine.purchaseOrderLineId) {
          const acc = Number(grLine.acceptedQuantity) || 0;
          grLineMap.set(grLine.purchaseOrderLineId, (grLineMap.get(grLine.purchaseOrderLineId) || 0) + acc);
        }
      }

      for (const line of input.lines) {
        if (line.purchaseOrderLineId) {
          const grAccepted = grLineMap.get(line.purchaseOrderLineId) || 0;
          if (Number(line.quantity) > grAccepted) {
            throw new Error(`3-way match exception: billing quantity '${line.quantity}' exceeds accepted Goods Receipt quantity of '${grAccepted}'.`);
          }
        }
      }
    }

    if (input.purchaseOrderId) {
      for (const line of input.lines) {
        if (line.purchaseOrderLineId) {
          const [poLine] = await db
            .select()
            .from(purchaseOrderLines)
            .where(eq(purchaseOrderLines.id, line.purchaseOrderLineId))
            .limit(1);

          if (poLine) {
            // Check quantity discrepancy
            const totalBilled = (Number(poLine.billedQuantity) || 0) + Number(line.quantity);
            if (totalBilled > Number(poLine.orderedQuantity)) {
              throw new Error(`3-way match exception: billing quantity '${line.quantity}' exceeds ordered PO line quantity.`);
            }
            // Check unit price higher than PO
            if (Number(line.unitPrice) > Number(poLine.unitPrice)) {
              throw new Error(`3-way match exception: billing unit price '${line.unitPrice}' is higher than PO line price '${poLine.unitPrice}'.`);
            }
          }
        }
      }
    }

    return db.transaction(async (tx) => {
      const [bill] = await tx
        .insert(supplierBills)
        .values({
          tenantId,
          branchId: input.branchId,
          billNumber: num,
          supplierId: input.supplierId,
          supplierInvoiceNumber: input.supplierInvoiceNumber.trim(),
          purchaseOrderId: input.purchaseOrderId || null,
          goodsReceiptId: input.goodsReceiptId || null,
          billDate: input.billDate,
          dueDate: input.dueDate,
          currency: input.currency,
          paymentTermsId: input.paymentTermsId || '30 Days',
          status: 'DRAFT',
          subtotal: input.subtotal,
          discountTotal: input.discountTotal || '0.000',
          taxTotal: input.taxTotal || '0.000',
          roundingAdjustment: input.roundingAdjustment || '0.000',
          grandTotal: input.grandTotal,
          paidAmount: '0.000',
          outstandingAmount: input.grandTotal,
          notes: input.notes || null,
          createdBy: actorId,
          updatedBy: actorId,
        })
        .returning();

      for (const l of input.lines) {
        await tx.insert(supplierBillLines).values({
          supplierBillId: bill.id,
          purchaseOrderLineId: l.purchaseOrderLineId || null,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: l.discount || '0.000',
          tax: l.tax || '0.000',
          total: l.total,
          projectId: l.projectId || null,
          costCenterId: l.costCenterId || null,
        });

        // Increment po line's billed quantity if references PO
        if (l.purchaseOrderLineId) {
          const [poLine] = await tx
            .select()
            .from(purchaseOrderLines)
            .where(eq(purchaseOrderLines.id, l.purchaseOrderLineId))
            .limit(1);

          if (poLine) {
            const currentBilled = Number(poLine.billedQuantity) || 0;
            const inc = Number(l.quantity) || 0;
            await tx
              .update(purchaseOrderLines)
              .set({ billedQuantity: (currentBilled + inc).toFixed(3) })
              .where(eq(purchaseOrderLines.id, l.purchaseOrderLineId));
          }
        }
      }

      await tx.insert(auditLogs).values({
        tenantId,
        actorId,
        action: 'CREATE',
        entityType: 'SUPPLIER_BILL',
        entityId: String(bill.id),
        resultingState: bill,
      });

      return bill;
    });
  }

  public async postSupplierBill(tenantId: string, id: number, actorId = 'system') {
    const [bill] = await db
      .update(supplierBills)
      .set({
        status: 'POSTED',
        postedAt: new Date(),
        postedBy: actorId,
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(and(eq(supplierBills.id, id), eq(supplierBills.tenantId, tenantId)))
      .returning();

    await db.insert(auditLogs).values({
      tenantId,
      actorId,
      action: 'POST',
      entityType: 'SUPPLIER_BILL',
      entityId: String(id),
      resultingState: bill,
    });

    return bill;
  }

  public async voidSupplierBill(tenantId: string, id: number, reason: string, actorId = 'system') {
    return db.transaction(async (tx) => {
      const [bill] = await tx
        .select()
        .from(supplierBills)
        .where(and(eq(supplierBills.id, id), eq(supplierBills.tenantId, tenantId)))
        .limit(1);

      if (!bill) throw new Error('Bill not found');
      if (Number(bill.paidAmount) > 0) throw new Error('Paid or partially paid bills cannot be voided.');

      // Reverse po lines billed quantities
      const lines = await tx.select().from(supplierBillLines).where(eq(supplierBillLines.supplierBillId, id));
      for (const l of lines) {
        if (l.purchaseOrderLineId) {
          const [poLine] = await tx
            .select()
            .from(purchaseOrderLines)
            .where(eq(purchaseOrderLines.id, l.purchaseOrderLineId))
            .limit(1);

          if (poLine) {
            const currentBilled = Number(poLine.billedQuantity) || 0;
            const dec = Number(l.quantity) || 0;
            await tx
              .update(purchaseOrderLines)
              .set({ billedQuantity: Math.max(0, currentBilled - dec).toFixed(3) })
              .where(eq(purchaseOrderLines.id, l.purchaseOrderLineId));
          }
        }
      }

      const [updated] = await tx
        .update(supplierBills)
        .set({
          status: 'VOIDED',
          voidedAt: new Date(),
          voidedBy: actorId,
          voidReason: reason || 'Voided by user',
          updatedAt: new Date(),
          updatedBy: actorId,
        })
        .where(eq(supplierBills.id, id))
        .returning();

      return updated;
    });
  }

  public async deleteSupplierBill(tenantId: string, id: number, actorId = 'system') {
    const bill = await this.getSupplierBill(tenantId, id);
    if (!bill) throw new Error('Bill not found');

    if (bill.status === 'DRAFT') {
      await db.delete(supplierBillLines).where(eq(supplierBillLines.supplierBillId, id));
      await db.delete(supplierBills).where(and(eq(supplierBills.id, id), eq(supplierBills.tenantId, tenantId)));
      return { action: 'HARD_DELETE', success: true };
    } else {
      await this.voidSupplierBill(tenantId, id, 'Billing cancellation delete workflow', actorId);
      return { action: 'VOID', success: true };
    }
  }

  // ==========================================
  // 9. SUPPLIER CREDITS (Supplier Credit Notes)
  // ==========================================

  public async listSupplierCredits(tenantId: string) {
    return db
      .select()
      .from(supplierCredits)
      .where(and(eq(supplierCredits.tenantId, tenantId), sql`${supplierCredits.deletedAt} IS NULL`))
      .orderBy(desc(supplierCredits.creditNumber));
  }

  public async getSupplierCredit(tenantId: string, id: number) {
    const [credit] = await db
      .select()
      .from(supplierCredits)
      .where(and(eq(supplierCredits.tenantId, tenantId), eq(supplierCredits.id, id), sql`${supplierCredits.deletedAt} IS NULL`))
      .limit(1);
    return credit || null;
  }

  public async createSupplierCredit(
    tenantId: string,
    input: {
      branchId: string;
      supplierId: number;
      purchaseReturnId?: number;
      supplierBillId?: number;
      creditDate: string;
      currency: string;
      amount: string;
      notes?: string;
    },
    actorId = 'system'
  ) {
    const num = await numberingRepository.generateNextNumber(tenantId, 'SUP_CREDIT');

    const [credit] = await db
      .insert(supplierCredits)
      .values({
        tenantId,
        branchId: input.branchId,
        creditNumber: num,
        supplierId: input.supplierId,
        purchaseReturnId: input.purchaseReturnId || null,
        supplierBillId: input.supplierBillId || null,
        creditDate: input.creditDate,
        currency: input.currency,
        status: 'DRAFT',
        amount: input.amount,
        notes: input.notes || null,
        createdBy: actorId,
      })
      .returning();

    await db.insert(auditLogs).values({
      tenantId,
      actorId,
      action: 'CREATE',
      entityType: 'SUPPLIER_CREDIT',
      entityId: String(credit.id),
      resultingState: credit,
    });

    return credit;
  }

  public async postSupplierCredit(tenantId: string, id: number, actorId = 'system') {
    const [credit] = await db
      .update(supplierCredits)
      .set({ status: 'POSTED' })
      .where(and(eq(supplierCredits.id, id), eq(supplierCredits.tenantId, tenantId)))
      .returning();
    return credit;
  }

  // ==========================================
  // 10. PAYMENTS & ALLOCATIONS
  // ==========================================

  public async listSupplierPayments(tenantId: string) {
    return db
      .select()
      .from(supplierPayments)
      .where(and(eq(supplierPayments.tenantId, tenantId), sql`${supplierPayments.deletedAt} IS NULL`))
      .orderBy(desc(supplierPayments.paymentNumber));
  }

  public async getSupplierPayment(tenantId: string, id: number) {
    const [header] = await db
      .select()
      .from(supplierPayments)
      .where(and(eq(supplierPayments.tenantId, tenantId), eq(supplierPayments.id, id), sql`${supplierPayments.deletedAt} IS NULL`))
      .limit(1);

    if (!header) return null;

    const allocations = await db
      .select()
      .from(supplierPaymentAllocations)
      .where(eq(supplierPaymentAllocations.paymentId, id));

    return { ...header, allocations };
  }

  public async createSupplierPayment(
    tenantId: string,
    input: {
      branchId: string;
      supplierId: number;
      paymentDate: string;
      currency: string;
      paymentMethodId: string;
      bankAccountId?: string;
      referenceNumber?: string;
      amount: string;
      notes?: string;
      allocations?: Array<{
        supplierBillId: number;
        allocatedAmount: string;
      }>;
    },
    actorId = 'system'
  ) {
    const num = await numberingRepository.generateNextNumber(tenantId, 'SUP_PAYMENT');

    return db.transaction(async (tx) => {
      const [pay] = await tx
        .insert(supplierPayments)
        .values({
          tenantId,
          branchId: input.branchId,
          paymentNumber: num,
          supplierId: input.supplierId,
          paymentDate: input.paymentDate,
          currency: input.currency,
          paymentMethodId: input.paymentMethodId,
          bankAccountId: input.bankAccountId || null,
          referenceNumber: input.referenceNumber || null,
          amount: input.amount,
          allocatedAmount: '0.000',
          unallocatedAmount: input.amount,
          status: 'DRAFT',
          notes: input.notes || null,
          createdBy: actorId,
        })
        .returning();

      let totalAllocated = 0;

      if (input.allocations) {
        for (const alloc of input.allocations) {
          const [bill] = await tx
            .select()
            .from(supplierBills)
            .where(eq(supplierBills.id, alloc.supplierBillId))
            .limit(1);

          if (!bill) throw new Error(`Bill ${alloc.supplierBillId} not found`);

          const outstanding = Number(bill.outstandingAmount) || 0;
          const toAlloc = Number(alloc.allocatedAmount) || 0;

          if (toAlloc > outstanding) {
            throw new Error(`Allocation of ${toAlloc} KWD exceeds outstanding bill amount ${outstanding} KWD`);
          }

          totalAllocated += toAlloc;

          await tx.insert(supplierPaymentAllocations).values({
            tenantId,
            paymentId: pay.id,
            supplierBillId: bill.id,
            allocatedAmount: toAlloc.toFixed(3),
            allocationDate: input.paymentDate,
            createdBy: actorId,
          });

          // Update Bill outstanding amounts
          const newPaid = ((Number(bill.paidAmount) || 0) + toAlloc).toFixed(3);
          const newOutstanding = (outstanding - toAlloc).toFixed(3);
          const newStatus = Number(newOutstanding) === 0 ? 'PAID' : 'PARTIALLY_PAID';

          await tx
            .update(supplierBills)
            .set({
              paidAmount: newPaid,
              outstandingAmount: newOutstanding,
              status: newStatus as any,
            })
            .where(eq(supplierBills.id, bill.id));
        }
      }

      // Update payment allocations sums
      const remUnallocated = (Number(input.amount) - totalAllocated).toFixed(3);
      const [updatedPay] = await tx
        .update(supplierPayments)
        .set({
          allocatedAmount: totalAllocated.toFixed(3),
          unallocatedAmount: remUnallocated,
          status: 'POSTED', // Auto post upon save for robust payments
          postedAt: new Date(),
          postedBy: actorId,
        })
        .where(eq(supplierPayments.id, pay.id))
        .returning();

      await tx.insert(auditLogs).values({
        tenantId,
        actorId,
        action: 'CREATE_PAYMENT',
        entityType: 'SUPPLIER_PAYMENT',
        entityId: String(pay.id),
        resultingState: updatedPay,
      });

      return updatedPay;
    });
  }

  public async voidSupplierPayment(tenantId: string, id: number, actorId = 'system') {
    return db.transaction(async (tx) => {
      const pay = await this.getSupplierPayment(tenantId, id);
      if (!pay) throw new Error('Payment not found');

      // Reverse all allocations back to bills outstanding amount
      for (const alloc of pay.allocations) {
        if (alloc.supplierBillId) {
          const [bill] = await tx
            .select()
            .from(supplierBills)
            .where(eq(supplierBills.id, alloc.supplierBillId))
            .limit(1);

          if (bill) {
            const allocAmt = Number(alloc.allocatedAmount) || 0;
            const newPaid = Math.max(0, (Number(bill.paidAmount) || 0) - allocAmt).toFixed(3);
            const newOutstanding = ((Number(bill.outstandingAmount) || 0) + allocAmt).toFixed(3);
            const newStatus = Number(newPaid) === 0 ? 'POSTED' : 'PARTIALLY_PAID';

            await tx
              .update(supplierBills)
              .set({
                paidAmount: newPaid,
                outstandingAmount: newOutstanding,
                status: newStatus as any,
              })
              .where(eq(supplierBills.id, bill.id));
          }
        }
      }

      await tx.delete(supplierPaymentAllocations).where(eq(supplierPaymentAllocations.paymentId, id));

      const [updated] = await tx
        .update(supplierPayments)
        .set({
          status: 'VOIDED',
          allocatedAmount: '0.000',
          unallocatedAmount: pay.amount,
        })
        .where(eq(supplierPayments.id, id))
        .returning();

      return updated;
    });
  }

  public async deleteSupplierPayment(tenantId: string, id: number, actorId = 'system') {
    const pay = await this.getSupplierPayment(tenantId, id);
    if (!pay) throw new Error('Payment not found');

    if (pay.status === 'DRAFT') {
      await db.delete(supplierPaymentAllocations).where(eq(supplierPaymentAllocations.paymentId, id));
      await db.delete(supplierPayments).where(and(eq(supplierPayments.id, id), eq(supplierPayments.tenantId, tenantId)));
      return { success: true };
    } else {
      await this.voidSupplierPayment(tenantId, id, actorId);
      return { success: true };
    }
  }

  // ==========================================
  // 11. SUPPLIER STATEMENT ENGINE
  // ==========================================

  public async getSupplierStatement(tenantId: string, supplierId: number, dateFrom: string, dateTo: string, branchId?: string) {
    const supplier = await this.getSupplier(tenantId, supplierId);
    if (!supplier) throw new Error('Supplier not found');

    // Fetch opening balance entries before `dateFrom`
    // Debit = Bills (+)
    // Credit = Payments, Credit Notes (-)
    // Opening balance of a payable accounts is: Cumulative Debit (Bills) - Cumulative Credit (Payments/Credits)
    const oldBills = await db
      .select({ grandTotal: supplierBills.grandTotal })
      .from(supplierBills)
      .where(
        and(
          eq(supplierBills.tenantId, tenantId),
          eq(supplierBills.supplierId, supplierId),
          inArray(supplierBills.status, ['POSTED', 'PAID', 'PARTIALLY_PAID']),
          sql`${supplierBills.billDate} < ${dateFrom}`
        )
      );

    const oldPayments = await db
      .select({ amount: supplierPayments.amount })
      .from(supplierPayments)
      .where(
        and(
          eq(supplierPayments.tenantId, tenantId),
          eq(supplierPayments.supplierId, supplierId),
          eq(supplierPayments.status, 'POSTED'),
          sql`${supplierPayments.paymentDate} < ${dateFrom}`
        )
      );

    const oldCredits = await db
      .select({ amount: supplierCredits.amount })
      .from(supplierCredits)
      .where(
        and(
          eq(supplierCredits.tenantId, tenantId),
          eq(supplierCredits.supplierId, supplierId),
          eq(supplierCredits.status, 'POSTED'),
          sql`${supplierCredits.creditDate} < ${dateFrom}`
        )
      );

    const totalDebit = oldBills.reduce((sum, b) => sum + parseFloat(b.grandTotal), 0);
    const totalCredit = oldPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0) + oldCredits.reduce((sum, c) => sum + parseFloat(c.amount), 0);
    const openingBalance = totalDebit - totalCredit;

    // Fetch period transactions
    const periodBills = await db
      .select()
      .from(supplierBills)
      .where(
        and(
          eq(supplierBills.tenantId, tenantId),
          eq(supplierBills.supplierId, supplierId),
          inArray(supplierBills.status, ['POSTED', 'PAID', 'PARTIALLY_PAID']),
          sql`${supplierBills.billDate} >= ${dateFrom}`,
          sql`${supplierBills.billDate} <= ${dateTo}`
        )
      );

    const periodPayments = await db
      .select()
      .from(supplierPayments)
      .where(
        and(
          eq(supplierPayments.tenantId, tenantId),
          eq(supplierPayments.supplierId, supplierId),
          eq(supplierPayments.status, 'POSTED'),
          sql`${supplierPayments.paymentDate} >= ${dateFrom}`,
          sql`${supplierPayments.paymentDate} <= ${dateTo}`
        )
      );

    const periodCredits = await db
      .select()
      .from(supplierCredits)
      .where(
        and(
          eq(supplierCredits.tenantId, tenantId),
          eq(supplierCredits.supplierId, supplierId),
          eq(supplierCredits.status, 'POSTED'),
          sql`${supplierCredits.creditDate} >= ${dateFrom}`,
          sql`${supplierCredits.creditDate} <= ${dateTo}`
        )
      );

    const txs: Array<{
      date: string;
      reference: string;
      type: string;
      description: string;
      debit: string;
      credit: string;
    }> = [];

    periodBills.forEach((b) => {
      txs.push({
        date: b.billDate,
        reference: b.billNumber,
        type: 'BILL',
        description: `Supplier Invoice: ${b.supplierInvoiceNumber}`,
        debit: b.grandTotal,
        credit: '0.000',
      });
    });

    periodPayments.forEach((p) => {
      txs.push({
        date: p.paymentDate,
        reference: p.paymentNumber,
        type: 'PAYMENT',
        description: `Payment via ${p.paymentMethodId}`,
        debit: '0.000',
        credit: p.amount,
      });
    });

    periodCredits.forEach((c) => {
      txs.push({
        date: c.creditDate,
        reference: c.creditNumber,
        type: 'CREDIT',
        description: c.notes || 'Supplier Credit Adjustment',
        debit: '0.000',
        credit: c.amount,
      });
    });

    // Sort transactions by date and then reference
    txs.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.reference.localeCompare(b.reference);
    });

    // Compute running balance
    let currentBalance = openingBalance;
    const items = txs.map((t) => {
      currentBalance = currentBalance + parseFloat(t.debit) - parseFloat(t.credit);
      return {
        ...t,
        balance: currentBalance.toFixed(3),
      };
    });

    return {
      supplier,
      dateFrom,
      dateTo,
      currency: supplier.currency || 'KWD',
      openingBalance: openingBalance.toFixed(3),
      closingBalance: currentBalance.toFixed(3),
      items,
    };
  }

  // ==========================================
  // 12. AP AGING REPORT
  // ==========================================

  public async getAPAgingReport(tenantId: string) {
    const activeBills = await db
      .select({
        supplierId: supplierBills.supplierId,
        grandTotal: supplierBills.grandTotal,
        outstandingAmount: supplierBills.outstandingAmount,
        dueDate: supplierBills.dueDate,
        billDate: supplierBills.billDate,
      })
      .from(supplierBills)
      .where(and(eq(supplierBills.tenantId, tenantId), eq(supplierBills.status, 'POSTED')));

    const sups = await this.listSuppliers(tenantId);
    const supMap = new Map(sups.map((s) => [s.id, s]));

    const report: Record<
      number,
      {
        supplierId: number;
        code: string;
        nameEn: string;
        current: number;
        bucket30: number;
        bucket60: number;
        bucket90: number;
        bucketOver90: number;
        totalOutstanding: number;
      }
    > = {};

    const today = new Date();

    for (const b of activeBills) {
      const outstanding = parseFloat(b.outstandingAmount) || 0;
      if (outstanding <= 0) continue;

      if (!report[b.supplierId]) {
        const s = supMap.get(b.supplierId);
        report[b.supplierId] = {
          supplierId: b.supplierId,
          code: s ? s.code : `SUP-${b.supplierId}`,
          nameEn: s ? s.nameEn : 'Unknown Supplier',
          current: 0,
          bucket30: 0,
          bucket60: 0,
          bucket90: 0,
          bucketOver90: 0,
          totalOutstanding: 0,
        };
      }

      const due = new Date(b.dueDate);
      const diffTime = today.getTime() - due.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      const entry = report[b.supplierId];
      entry.totalOutstanding += outstanding;

      if (diffDays <= 0) {
        entry.current += outstanding;
      } else if (diffDays <= 30) {
        entry.bucket30 += outstanding;
      } else if (diffDays <= 60) {
        entry.bucket60 += outstanding;
      } else if (diffDays <= 90) {
        entry.bucket90 += outstanding;
      } else {
        entry.bucketOver90 += outstanding;
      }
    }

    return Object.values(report).map((r) => ({
      ...r,
      current: r.current.toFixed(3),
      bucket30: r.bucket30.toFixed(3),
      bucket60: r.bucket60.toFixed(3),
      bucket90: r.bucket90.toFixed(3),
      bucketOver90: r.bucketOver90.toFixed(3),
      totalOutstanding: r.totalOutstanding.toFixed(3),
    }));
  }
}

export const procurementRepository = new ProcurementRepository();
