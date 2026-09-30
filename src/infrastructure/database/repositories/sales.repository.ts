import { eq, and, desc, asc, sql, inArray, lt } from 'drizzle-orm';
import { db } from '../../../db/index.ts';
import {
  clients,
  clientContacts,
  clientSites,
  taxCodes,
  quotations,
  quotationLines,
  salesOrders,
  salesOrderLines,
  deliveries,
  deliveryLines,
  invoices,
  invoiceLines,
  creditNotes,
  creditNoteLines,
  receipts,
  receiptAllocations,
  auditLogs,
} from '../../../db/schema.ts';
import { numberingRepository } from './numbering.repository.ts';
import { Money } from '../../../core/domain/money.ts';
import { logger } from '../../../core/logging/logger.ts';

export class SalesRepository {
  // ==========================================
  // 1. CLIENTS & CONTACTS & SITES
  // ==========================================

  public async listClients(tenantId: string) {
    return db
      .select()
      .from(clients)
      .where(and(eq(clients.tenantId, tenantId), sql`${clients.deletedAt} IS NULL`))
      .orderBy(asc(clients.code));
  }

  public async getClient(tenantId: string, clientId: number) {
    const [client] = await db
      .select()
      .from(clients)
      .where(and(eq(clients.tenantId, tenantId), eq(clients.id, clientId), sql`${clients.deletedAt} IS NULL`))
      .limit(1);

    if (!client) return null;

    const contacts = await db
      .select()
      .from(clientContacts)
      .where(eq(clientContacts.clientId, clientId))
      .orderBy(desc(clientContacts.isPrimary));

    const sites = await db
      .select()
      .from(clientSites)
      .where(eq(clientSites.clientId, clientId))
      .orderBy(asc(clientSites.nameEn));

    return { ...client, contacts, sites };
  }

  public async createClient(
    tenantId: string,
    input: {
      code: string;
      nameEn: string;
      nameAr: string;
      email?: string;
      phone?: string;
      website?: string;
      crNumber?: string;
      paymentTermsId?: string;
    },
    actorId = 'system'
  ) {
    const cleanCode = input.code.toUpperCase().trim();

    // Check unique code
    const existing = await db
      .select()
      .from(clients)
      .where(and(eq(clients.tenantId, tenantId), eq(clients.code, cleanCode), sql`${clients.deletedAt} IS NULL`))
      .limit(1);

    if (existing.length > 0) {
      throw new Error(`Client code '${cleanCode}' is already registered.`);
    }

    const [inserted] = await db
      .insert(clients)
      .values({
        tenantId,
        code: cleanCode,
        nameEn: input.nameEn.trim(),
        nameAr: input.nameAr.trim(),
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
        website: input.website?.trim() || null,
        crNumber: input.crNumber?.trim() || null,
        paymentTermsId: input.paymentTermsId || '30 Days',
        status: 'ACTIVE',
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    // Log Audit
    await db.insert(auditLogs).values({
      tenantId,
      actorId,
      action: 'CREATE',
      entityType: 'CLIENT',
      entityId: String(inserted.id),
      previousState: null,
      resultingState: inserted,
    });

    return inserted;
  }

  public async updateClient(
    tenantId: string,
    clientId: number,
    input: {
      nameEn?: string;
      nameAr?: string;
      email?: string;
      phone?: string;
      website?: string;
      crNumber?: string;
      paymentTermsId?: string;
      status?: string;
    },
    actorId = 'system'
  ) {
    const existing = await this.getClient(tenantId, clientId);
    if (!existing) throw new Error('Client not found or access denied');

    const [updated] = await db
      .update(clients)
      .set({
        nameEn: input.nameEn !== undefined ? input.nameEn.trim() : existing.nameEn,
        nameAr: input.nameAr !== undefined ? input.nameAr.trim() : existing.nameAr,
        email: input.email !== undefined ? input.email?.trim() || null : existing.email,
        phone: input.phone !== undefined ? input.phone?.trim() || null : existing.phone,
        website: input.website !== undefined ? input.website?.trim() || null : existing.website,
        crNumber: input.crNumber !== undefined ? input.crNumber?.trim() || null : existing.crNumber,
        paymentTermsId: input.paymentTermsId !== undefined ? input.paymentTermsId : existing.paymentTermsId,
        status: (input.status !== undefined ? input.status : existing.status) as any,
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(and(eq(clients.id, clientId), eq(clients.tenantId, tenantId)))
      .returning();

    // Log Audit
    await db.insert(auditLogs).values({
      tenantId,
      actorId,
      action: 'UPDATE',
      entityType: 'CLIENT',
      entityId: String(clientId),
      previousState: existing,
      resultingState: updated,
    });

    return updated;
  }

  public async createClientContact(
    tenantId: string,
    clientId: number,
    input: { name: string; email?: string; phone?: string; isPrimary?: boolean }
  ) {
    const client = await db.select().from(clients).where(and(eq(clients.id, clientId), eq(clients.tenantId, tenantId))).limit(1);
    if (client.length === 0) throw new Error('Client not found or access denied');

    if (input.isPrimary) {
      // Demote existing primary contacts
      await db.update(clientContacts).set({ isPrimary: false }).where(eq(clientContacts.clientId, clientId));
    }

    const [contact] = await db
      .insert(clientContacts)
      .values({
        clientId,
        name: input.name.trim(),
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
        isPrimary: !!input.isPrimary,
      })
      .returning();

    return contact;
  }

  public async createClientSite(
    tenantId: string,
    clientId: number,
    input: { nameEn: string; nameAr: string; addressEn?: string; addressAr?: string }
  ) {
    const client = await db.select().from(clients).where(and(eq(clients.id, clientId), eq(clients.tenantId, tenantId))).limit(1);
    if (client.length === 0) throw new Error('Client not found or access denied');

    const [site] = await db
      .insert(clientSites)
      .values({
        clientId,
        nameEn: input.nameEn.trim(),
        nameAr: input.nameAr.trim(),
        addressEn: input.addressEn?.trim() || null,
        addressAr: input.addressAr?.trim() || null,
      })
      .returning();

    return site;
  }

  public async preflightDeleteClient(tenantId: string, clientId: number) {
    const client = await this.getClient(tenantId, clientId);
    if (!client) throw new Error('Client not found or access denied');

    const quotes = await db.select().from(quotations).where(and(eq(quotations.clientId, clientId), sql`${quotations.deletedAt} IS NULL`));
    const orders = await db.select().from(salesOrders).where(and(eq(salesOrders.clientId, clientId), sql`${salesOrders.deletedAt} IS NULL`));
    const invs = await db.select().from(invoices).where(and(eq(invoices.clientId, clientId), sql`${invoices.deletedAt} IS NULL`));
    const rects = await db.select().from(receipts).where(and(eq(receipts.clientId, clientId), sql`${receipts.deletedAt} IS NULL`));

    const totalReferences = quotes.length + orders.length + invs.length + rects.length;
    const isEligibleForHardDelete = totalReferences === 0;

    const reasons: string[] = [];
    if (quotes.length > 0) reasons.push(`${quotes.length} Quotation(s) reference this client`);
    if (orders.length > 0) reasons.push(`${orders.length} Sales Order(s) reference this client`);
    if (invs.length > 0) reasons.push(`${invs.length} Invoice(s) reference this client`);
    if (rects.length > 0) reasons.push(`${rects.length} Receipt(s) reference this client`);

    return {
      clientId,
      nameEn: client.nameEn,
      isEligibleForHardDelete,
      totalReferences,
      reasons,
    };
  }

  public async deleteClient(tenantId: string, clientId: number, actorId = 'system', reason = '') {
    const preflight = await this.preflightDeleteClient(tenantId, clientId);
    const client = await this.getClient(tenantId, clientId);
    if (!client) throw new Error('Client not found');

    if (preflight.isEligibleForHardDelete) {
      // Hard Delete
      await db.delete(clients).where(and(eq(clients.id, clientId), eq(clients.tenantId, tenantId)));
      await db.insert(auditLogs).values({
        tenantId,
        actorId,
        action: 'DELETE',
        entityType: 'CLIENT',
        entityId: String(clientId),
        previousState: client,
        resultingState: null,
      });
      return { action: 'HARD_DELETE', success: true };
    } else {
      // Soft Delete
      const [updated] = await db
        .update(clients)
        .set({
          deletedAt: new Date(),
          deletedBy: actorId,
          deleteReason: reason || 'Soft deleted due to existing transaction history',
          status: 'DELETED' as any,
          updatedAt: new Date(),
          updatedBy: actorId,
        })
        .where(and(eq(clients.id, clientId), eq(clients.tenantId, tenantId)))
        .returning();

      await db.insert(auditLogs).values({
        tenantId,
        actorId,
        action: 'SOFT_DELETE',
        entityType: 'CLIENT',
        entityId: String(clientId),
        previousState: client,
        resultingState: updated,
      });
      return { action: 'SOFT_DELETE', success: true, reason };
    }
  }

  public async preflightBulkDeleteClients(tenantId: string, clientIds: number[]) {
    if (!clientIds || clientIds.length === 0) {
      return {
        totalCount: 0,
        eligibleCount: 0,
        protectedCount: 0,
        items: [],
      };
    }

    // Secure cross-company verification: Query clients belonging to THIS tenantId only
    const targetClients = await db
      .select({
        id: clients.id,
        code: clients.code,
        nameEn: clients.nameEn,
        nameAr: clients.nameAr,
        status: clients.status,
      })
      .from(clients)
      .where(and(eq(clients.tenantId, tenantId), inArray(clients.id, clientIds), sql`${clients.deletedAt} IS NULL`));

    const items = [];
    for (const cl of targetClients) {
      const depCheck = await this.preflightDeleteClient(tenantId, cl.id);
      items.push({
        id: cl.id,
        code: cl.code,
        nameEn: cl.nameEn,
        nameAr: cl.nameAr,
        isEligibleForDelete: depCheck.isEligibleForHardDelete,
        reasons: depCheck.reasons,
        status: cl.status,
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

  public async bulkDeleteClients(
    tenantId: string,
    params: {
      clientIds: number[];
      action: 'DELETE' | 'ARCHIVE';
      actorId: string;
      reason?: string;
    }
  ) {
    const preflight = await this.preflightBulkDeleteClients(tenantId, params.clientIds);

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
          await db.transaction(async (tx) => {
            // Delete child contact and sites first to satisfy foreign keys
            await tx.delete(clientContacts).where(eq(clientContacts.clientId, item.id));
            await tx.delete(clientSites).where(eq(clientSites.clientId, item.id));
            await tx.delete(clients).where(and(eq(clients.id, item.id), eq(clients.tenantId, tenantId)));
          });

          await db.insert(auditLogs).values({
            tenantId,
            actorId: params.actorId,
            action: 'DELETE',
            entityType: 'CLIENT',
            entityId: String(item.id),
            previousState: item,
            resultingState: null,
          });

          result.deleted++;
          result.details.push({
            id: item.id,
            code: item.code,
            nameEn: item.nameEn,
            status: 'DELETED',
          });
        } catch (error: any) {
          result.failed++;
          result.details.push({
            id: item.id,
            code: item.code,
            nameEn: item.nameEn,
            status: 'FAILED',
            message: error.message,
          });
        }
      }
    } else {
      // ARCHIVE (Soft Delete)
      for (const item of preflight.items) {
        try {
          const [updated] = await db
            .update(clients)
            .set({
              deletedAt: new Date(),
              deletedBy: params.actorId,
              deleteReason: params.reason || 'Bulk archived',
              status: 'DELETED' as any,
              updatedAt: new Date(),
              updatedBy: params.actorId,
            })
            .where(and(eq(clients.id, item.id), eq(clients.tenantId, tenantId)))
            .returning();

          await db.insert(auditLogs).values({
            tenantId,
            actorId: params.actorId,
            action: 'SOFT_DELETE',
            entityType: 'CLIENT',
            entityId: String(item.id),
            previousState: item,
            resultingState: updated,
          });

          result.archived++;
          result.details.push({
            id: item.id,
            code: item.code,
            nameEn: item.nameEn,
            status: 'ARCHIVED',
          });
        } catch (error: any) {
          result.failed++;
          result.details.push({
            id: item.id,
            code: item.code,
            nameEn: item.nameEn,
            status: 'FAILED',
            message: error.message,
          });
        }
      }
    }

    return result;
  }

  // ==========================================
  // 2. TAX CODES
  // ==========================================

  public async listTaxCodes(tenantId: string) {
    return db
      .select()
      .from(taxCodes)
      .where(and(eq(taxCodes.tenantId, tenantId), eq(taxCodes.status, 'ACTIVE')))
      .orderBy(asc(taxCodes.code));
  }

  public async createTaxCode(
    tenantId: string,
    input: { code: string; nameEn: string; nameAr: string; rate: string; calculationMethod?: string; effectiveFrom: string; effectiveTo?: string }
  ) {
    const cleanCode = input.code.toUpperCase().trim();
    const [inserted] = await db
      .insert(taxCodes)
      .values({
        tenantId,
        code: cleanCode,
        nameEn: input.nameEn.trim(),
        nameAr: input.nameAr.trim(),
        rate: input.rate,
        calculationMethod: input.calculationMethod || 'PERCENTAGE',
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo || null,
        status: 'ACTIVE',
      })
      .returning();

    return inserted;
  }

  // ==========================================
  // 3. QUOTATIONS
  // ==========================================

  public async listQuotations(tenantId: string) {
    return db
      .select({
        id: quotations.id,
        quotationNumber: quotations.quotationNumber,
        clientNameEn: clients.nameEn,
        clientNameAr: clients.nameAr,
        quotationDate: quotations.quotationDate,
        validUntil: quotations.validUntil,
        currency: quotations.currency,
        grandTotal: quotations.grandTotal,
        status: quotations.status,
      })
      .from(quotations)
      .innerJoin(clients, eq(quotations.clientId, clients.id))
      .where(and(eq(quotations.tenantId, tenantId), sql`${quotations.deletedAt} IS NULL`))
      .orderBy(desc(quotations.quotationNumber));
  }

  public async getQuotation(tenantId: string, id: number) {
    const [quote] = await db
      .select()
      .from(quotations)
      .where(and(eq(quotations.id, id), eq(quotations.tenantId, tenantId), sql`${quotations.deletedAt} IS NULL`))
      .limit(1);

    if (!quote) return null;

    const lines = await db
      .select()
      .from(quotationLines)
      .where(eq(quotationLines.quotationId, id))
      .orderBy(asc(quotationLines.sortOrder));

    const [client] = await db.select().from(clients).where(eq(clients.id, quote.clientId)).limit(1);

    return { ...quote, lines, client };
  }

  public async createQuotation(
    tenantId: string,
    input: {
      branchId: string;
      clientId: number;
      clientContactId?: number;
      clientSiteId?: number;
      quotationDate: string;
      validUntil?: string;
      currency: string;
      paymentTerms?: string;
      reference?: string;
      subject?: string;
      notes?: string;
      lines: {
        itemId?: string;
        description: string;
        quantity: string;
        unit?: string;
        unitPrice: string;
        discountType?: 'PERCENTAGE' | 'FIXED';
        discountValue?: string;
        taxCodeId?: number;
      }[];
    },
    actorId = 'system'
  ) {
    const currency = input.currency.toUpperCase();
    const quoteNumber = await numberingRepository.generateNextNumber(tenantId, 'QUOTATION', input.branchId);

    return db.transaction(async (tx) => {
      // 1. Authoritative decimal math
      let subtotalSubunits = 0n;
      let discountTotalSubunits = 0n;
      let taxTotalSubunits = 0n;
      let grandTotalSubunits = 0n;

      const linesToInsert: any[] = [];

      for (let i = 0; i < input.lines.length; i++) {
        const line = input.lines[i];
        const qty = parseFloat(line.quantity) || 0;
        const priceM = Money.create(line.unitPrice, currency);

        // Line Subtotal = qty * price
        const lineSubtotalM = priceM.multiply(qty);
        subtotalSubunits += lineSubtotalM.toSubunits();

        // Line Discount
        let discountAmountM = Money.create('0.000', currency);
        if (line.discountType === 'PERCENTAGE' && line.discountValue) {
          const pct = parseFloat(line.discountValue) || 0;
          discountAmountM = lineSubtotalM.multiply(pct / 100);
        } else if (line.discountType === 'FIXED' && line.discountValue) {
          discountAmountM = Money.create(line.discountValue, currency);
        }
        discountTotalSubunits += discountAmountM.toSubunits();

        // Taxable Amount = Subtotal - Discount
        const taxableM = lineSubtotalM.subtract(discountAmountM);

        // Tax Amount
        let taxAmountM = Money.create('0.000', currency);
        if (line.taxCodeId) {
          const [tc] = await tx.select().from(taxCodes).where(eq(taxCodes.id, line.taxCodeId)).limit(1);
          if (tc) {
            const taxPct = parseFloat(tc.rate) || 0;
            taxAmountM = taxableM.multiply(taxPct / 100);
          }
        }
        taxTotalSubunits += taxAmountM.toSubunits();

        // Line Total = Taxable + Tax
        const lineTotalM = taxableM.add(taxAmountM);
        grandTotalSubunits += lineTotalM.toSubunits();

        linesToInsert.push({
          itemId: line.itemId || null,
          description: line.description.trim(),
          quantity: line.quantity,
          unit: line.unit || null,
          unitPrice: priceM.toDecimalString(),
          discountType: line.discountType || null,
          discountValue: line.discountValue || '0.000',
          taxCodeId: line.taxCodeId || null,
          lineSubtotal: lineSubtotalM.toDecimalString(),
          discountAmount: discountAmountM.toDecimalString(),
          taxAmount: taxAmountM.toDecimalString(),
          lineTotal: lineTotalM.toDecimalString(),
          sortOrder: i,
        });
      }

      const [quote] = await tx
        .insert(quotations)
        .values({
          tenantId,
          branchId: input.branchId,
          quotationNumber: quoteNumber,
          clientId: input.clientId,
          clientContactId: input.clientContactId || null,
          clientSiteId: input.clientSiteId || null,
          quotationDate: input.quotationDate,
          validUntil: input.validUntil || null,
          currency,
          paymentTerms: input.paymentTerms || '30 Days',
          reference: input.reference || null,
          subject: input.subject || null,
          status: 'DRAFT',
          subtotal: Money.fromSubunits(subtotalSubunits, currency).toDecimalString(),
          discountTotal: Money.fromSubunits(discountTotalSubunits, currency).toDecimalString(),
          taxTotal: Money.fromSubunits(taxTotalSubunits, currency).toDecimalString(),
          grandTotal: Money.fromSubunits(grandTotalSubunits, currency).toDecimalString(),
          notes: input.notes || null,
          createdBy: actorId,
          updatedBy: actorId,
        })
        .returning();

      // Insert Lines
      const mappedLines = linesToInsert.map((l) => ({ ...l, quotationId: quote.id }));
      await tx.insert(quotationLines).values(mappedLines);

      // Audit Trail
      await tx.insert(auditLogs).values({
        tenantId,
        actorId,
        action: 'CREATE',
        entityType: 'QUOTATION',
        entityId: String(quote.id),
        previousState: null,
        resultingState: quote,
      });

      return quote;
    });
  }

  public async updateQuotation(
    tenantId: string,
    id: number,
    input: {
      quotationDate?: string;
      validUntil?: string;
      paymentTerms?: string;
      reference?: string;
      subject?: string;
      notes?: string;
      status?: string;
      lines?: {
        itemId?: string;
        description: string;
        quantity: string;
        unit?: string;
        unitPrice: string;
        discountType?: 'PERCENTAGE' | 'FIXED';
        discountValue?: string;
        taxCodeId?: number;
      }[];
    },
    actorId = 'system'
  ) {
    const existing = await this.getQuotation(tenantId, id);
    if (!existing) throw new Error('Quotation not found or access denied');

    if (existing.status !== 'DRAFT' && existing.status !== 'SUBMITTED' && input.lines) {
      throw new Error('Only draft or submitted quotations can have their lines modified.');
    }

    return db.transaction(async (tx) => {
      const currency = existing.currency;
      let updateFields: any = {
        quotationDate: input.quotationDate || existing.quotationDate,
        validUntil: input.validUntil || existing.validUntil,
        paymentTerms: input.paymentTerms || existing.paymentTerms,
        reference: input.reference !== undefined ? input.reference : existing.reference,
        subject: input.subject !== undefined ? input.subject : existing.subject,
        notes: input.notes !== undefined ? input.notes : existing.notes,
        status: input.status || existing.status,
        updatedAt: new Date(),
        updatedBy: actorId,
      };

      if (input.lines) {
        // Recalculate everything
        let subtotalSubunits = 0n;
        let discountTotalSubunits = 0n;
        let taxTotalSubunits = 0n;
        let grandTotalSubunits = 0n;

        // Delete old lines
        await tx.delete(quotationLines).where(eq(quotationLines.quotationId, id));

        const linesToInsert: any[] = [];
        for (let i = 0; i < input.lines.length; i++) {
          const line = input.lines[i];
          const qty = parseFloat(line.quantity) || 0;
          const priceM = Money.create(line.unitPrice, currency);

          const lineSubtotalM = priceM.multiply(qty);
          subtotalSubunits += lineSubtotalM.toSubunits();

          let discountAmountM = Money.create('0.000', currency);
          if (line.discountType === 'PERCENTAGE' && line.discountValue) {
            discountAmountM = lineSubtotalM.multiply((parseFloat(line.discountValue) || 0) / 100);
          } else if (line.discountType === 'FIXED' && line.discountValue) {
            discountAmountM = Money.create(line.discountValue, currency);
          }
          discountTotalSubunits += discountAmountM.toSubunits();

          const taxableM = lineSubtotalM.subtract(discountAmountM);

          let taxAmountM = Money.create('0.000', currency);
          if (line.taxCodeId) {
            const [tc] = await tx.select().from(taxCodes).where(eq(taxCodes.id, line.taxCodeId)).limit(1);
            if (tc) {
              taxAmountM = taxableM.multiply((parseFloat(tc.rate) || 0) / 100);
            }
          }
          taxTotalSubunits += taxAmountM.toSubunits();

          const lineTotalM = taxableM.add(taxAmountM);
          grandTotalSubunits += lineTotalM.toSubunits();

          linesToInsert.push({
            quotationId: id,
            itemId: line.itemId || null,
            description: line.description.trim(),
            quantity: line.quantity,
            unit: line.unit || null,
            unitPrice: priceM.toDecimalString(),
            discountType: line.discountType || null,
            discountValue: line.discountValue || '0.000',
            taxCodeId: line.taxCodeId || null,
            lineSubtotal: lineSubtotalM.toDecimalString(),
            discountAmount: discountAmountM.toDecimalString(),
            taxAmount: taxAmountM.toDecimalString(),
            lineTotal: lineTotalM.toDecimalString(),
            sortOrder: i,
          });
        }

        await tx.insert(quotationLines).values(linesToInsert);

        updateFields.subtotal = Money.fromSubunits(subtotalSubunits, currency).toDecimalString();
        updateFields.discountTotal = Money.fromSubunits(discountTotalSubunits, currency).toDecimalString();
        updateFields.taxTotal = Money.fromSubunits(taxTotalSubunits, currency).toDecimalString();
        updateFields.grandTotal = Money.fromSubunits(grandTotalSubunits, currency).toDecimalString();
      }

      const [updatedQuote] = await tx
        .update(quotations)
        .set(updateFields)
        .where(eq(quotations.id, id))
        .returning();

      // Log Audit
      await tx.insert(auditLogs).values({
        tenantId,
        actorId,
        action: 'UPDATE',
        entityType: 'QUOTATION',
        entityId: String(id),
        previousState: existing,
        resultingState: updatedQuote,
      });

      return updatedQuote;
    });
  }

  public async deleteQuotation(tenantId: string, id: number, actorId = 'system', reason = '') {
    const existing = await this.getQuotation(tenantId, id);
    if (!existing) throw new Error('Quotation not found');

    if (existing.status === 'DRAFT' || existing.status === 'SUBMITTED' || existing.status === 'REJECTED') {
      // Hard delete lines first
      await db.delete(quotationLines).where(eq(quotationLines.quotationId, id));
      await db.delete(quotations).where(eq(quotations.id, id));

      await db.insert(auditLogs).values({
        tenantId,
        actorId,
        action: 'DELETE',
        entityType: 'QUOTATION',
        entityId: String(id),
        previousState: existing,
        resultingState: null,
      });
      return { success: true, action: 'HARD_DELETE' };
    } else {
      // Soft Delete
      const [updated] = await db
        .update(quotations)
        .set({
          deletedAt: new Date(),
          deletedBy: actorId,
          deleteReason: reason || 'Soft deleted due to workflow state restrictions',
          status: 'DELETED' as any,
          updatedAt: new Date(),
          updatedBy: actorId,
        })
        .where(eq(quotations.id, id))
        .returning();

      await db.insert(auditLogs).values({
        tenantId,
        actorId,
        action: 'SOFT_DELETE',
        entityType: 'QUOTATION',
        entityId: String(id),
        previousState: existing,
        resultingState: updated,
      });
      return { success: true, action: 'SOFT_DELETE' };
    }
  }

  // ==========================================
  // 4. SALES ORDERS
  // ==========================================

  public async listSalesOrders(tenantId: string) {
    return db
      .select({
        id: salesOrders.id,
        salesOrderNumber: salesOrders.salesOrderNumber,
        clientNameEn: clients.nameEn,
        clientNameAr: clients.nameAr,
        orderDate: salesOrders.orderDate,
        currency: salesOrders.currency,
        grandTotal: salesOrders.grandTotal,
        status: salesOrders.status,
      })
      .from(salesOrders)
      .innerJoin(clients, eq(salesOrders.clientId, clients.id))
      .where(and(eq(salesOrders.tenantId, tenantId), sql`${salesOrders.deletedAt} IS NULL`))
      .orderBy(desc(salesOrders.salesOrderNumber));
  }

  public async getSalesOrder(tenantId: string, id: number) {
    const [order] = await db
      .select()
      .from(salesOrders)
      .where(and(eq(salesOrders.id, id), eq(salesOrders.tenantId, tenantId), sql`${salesOrders.deletedAt} IS NULL`))
      .limit(1);

    if (!order) return null;

    const lines = await db
      .select()
      .from(salesOrderLines)
      .where(eq(salesOrderLines.salesOrderId, id))
      .orderBy(asc(salesOrderLines.sortOrder));

    const [client] = await db.select().from(clients).where(eq(clients.id, order.clientId)).limit(1);

    return { ...order, lines, client };
  }

  public async convertQuotationToSalesOrder(tenantId: string, quotationId: number, actorId = 'system') {
    const quote = await this.getQuotation(tenantId, quotationId);
    if (!quote) throw new Error('Quotation not found');
    if (quote.status === 'CONVERTED' || quote.status === 'DELETED') {
      throw new Error(`Quotation is already in state '${quote.status}'`);
    }

    const soNumber = await numberingRepository.generateNextNumber(tenantId, 'SALES_ORDER', quote.branchId);

    return db.transaction(async (tx) => {
      // 1. Create Sales Order
      const [order] = await tx
        .insert(salesOrders)
        .values({
          tenantId,
          branchId: quote.branchId,
          salesOrderNumber: soNumber,
          clientId: quote.clientId,
          quotationId,
          orderDate: new Date().toISOString().slice(0, 10),
          currency: quote.currency,
          paymentTerms: quote.paymentTerms,
          status: 'CONFIRMED',
          subtotal: quote.subtotal,
          discountTotal: quote.discountTotal,
          taxTotal: quote.taxTotal,
          grandTotal: quote.grandTotal,
          createdBy: actorId,
          updatedBy: actorId,
        })
        .returning();

      // 2. Create Lines
      const orderLines = quote.lines.map((l) => ({
        salesOrderId: order.id,
        itemId: l.itemId,
        description: l.description,
        quantity: l.quantity,
        deliveredQuantity: '0.000',
        invoicedQuantity: '0.000',
        unit: l.unit,
        unitPrice: l.unitPrice,
        discountType: l.discountType,
        discountValue: l.discountValue,
        taxCodeId: l.taxCodeId,
        lineSubtotal: l.lineSubtotal,
        discountAmount: l.discountAmount,
        taxAmount: l.taxAmount,
        lineTotal: l.lineTotal,
        sortOrder: l.sortOrder,
      }));

      await tx.insert(salesOrderLines).values(orderLines);

      // 3. Mark Quotation as Converted
      await tx.update(quotations).set({ status: 'CONVERTED', updatedAt: new Date(), updatedBy: actorId }).where(eq(quotations.id, quotationId));

      await tx.insert(auditLogs).values({
        tenantId,
        actorId,
        action: 'CONVERT_QUOTATION',
        entityType: 'SALES_ORDER',
        entityId: String(order.id),
        previousState: quote,
        resultingState: order,
      });

      return order;
    });
  }

  public async deleteSalesOrder(tenantId: string, id: number, actorId = 'system', reason = '') {
    const existing = await this.getSalesOrder(tenantId, id);
    if (!existing) throw new Error('Sales Order not found');

    if (existing.status === 'DRAFT' || existing.status === 'CONFIRMED' || existing.status === 'CANCELLED') {
      // Hard Delete
      await db.delete(salesOrderLines).where(eq(salesOrderLines.salesOrderId, id));
      await db.delete(salesOrders).where(eq(salesOrders.id, id));

      await db.insert(auditLogs).values({
        tenantId,
        actorId,
        action: 'DELETE',
        entityType: 'SALES_ORDER',
        entityId: String(id),
        previousState: existing,
        resultingState: null,
      });
      return { success: true, action: 'HARD_DELETE' };
    } else {
      // Soft Delete
      const [updated] = await db
        .update(salesOrders)
        .set({
          deletedAt: new Date(),
          deletedBy: actorId,
          deleteReason: reason || 'Soft deleted due to operational delivery state',
          status: 'DELETED' as any,
          updatedAt: new Date(),
          updatedBy: actorId,
        })
        .where(eq(salesOrders.id, id))
        .returning();

      await db.insert(auditLogs).values({
        tenantId,
        actorId,
        action: 'SOFT_DELETE',
        entityType: 'SALES_ORDER',
        entityId: String(id),
        previousState: existing,
        resultingState: updated,
      });
      return { success: true, action: 'SOFT_DELETE' };
    }
  }

  // ==========================================
  // 5. DELIVERIES
  // ==========================================

  public async listDeliveries(tenantId: string) {
    return db
      .select({
        id: deliveries.id,
        deliveryNumber: deliveries.deliveryNumber,
        clientNameEn: clients.nameEn,
        clientNameAr: clients.nameAr,
        deliveryDate: deliveries.deliveryDate,
        status: deliveries.status,
      })
      .from(deliveries)
      .innerJoin(clients, eq(deliveries.clientId, clients.id))
      .where(and(eq(deliveries.tenantId, tenantId), sql`${deliveries.deletedAt} IS NULL`))
      .orderBy(desc(deliveries.deliveryNumber));
  }

  public async getDelivery(tenantId: string, id: number) {
    const [dlv] = await db
      .select()
      .from(deliveries)
      .where(and(eq(deliveries.id, id), eq(deliveries.tenantId, tenantId), sql`${deliveries.deletedAt} IS NULL`))
      .limit(1);

    if (!dlv) return null;

    const lines = await db
      .select()
      .from(deliveryLines)
      .where(eq(deliveryLines.deliveryId, id))
      .orderBy(asc(deliveryLines.sortOrder));

    const [client] = await db.select().from(clients).where(eq(clients.id, dlv.clientId)).limit(1);

    return { ...dlv, lines, client };
  }

  public async createDeliveryFromSalesOrder(
    tenantId: string,
    input: {
      salesOrderId: number;
      deliveryDate: string;
      clientSiteId?: number;
      notes?: string;
      lines: {
        salesOrderLineId: number;
        quantity: string;
      }[];
    },
    actorId = 'system'
  ) {
    const order = await this.getSalesOrder(tenantId, input.salesOrderId);
    if (!order) throw new Error('Sales Order not found');

    const dnNumber = await numberingRepository.generateNextNumber(tenantId, 'DELIVERY', order.branchId);

    return db.transaction(async (tx) => {
      // 1. Insert Delivery Header
      const [dlv] = await tx
        .insert(deliveries)
        .values({
          tenantId,
          branchId: order.branchId,
          deliveryNumber: dnNumber,
          clientId: order.clientId,
          salesOrderId: input.salesOrderId,
          deliveryDate: input.deliveryDate,
          clientSiteId: input.clientSiteId || null,
          status: 'CONFIRMED',
          notes: input.notes || null,
          createdBy: actorId,
          updatedBy: actorId,
        })
        .returning();

      // 2. Insert Lines & Update delivered quantities on Sales Order
      let i = 0;
      for (const line of input.lines) {
        const [sol] = await tx.select().from(salesOrderLines).where(eq(salesOrderLines.id, line.salesOrderLineId)).limit(1);
        if (!sol) throw new Error('Sales order line not found');

        const currentDelivered = parseFloat(sol.deliveredQuantity) || 0;
        const toDeliver = parseFloat(line.quantity) || 0;
        const newDelivered = currentDelivered + toDeliver;

        // Update sales order line
        await tx
          .update(salesOrderLines)
          .set({ deliveredQuantity: String(newDelivered) })
          .where(eq(salesOrderLines.id, line.salesOrderLineId));

        // Create delivery line
        await tx.insert(deliveryLines).values({
          deliveryId: dlv.id,
          salesOrderLineId: line.salesOrderLineId,
          itemId: sol.itemId,
          description: sol.description,
          quantity: line.quantity,
          unit: sol.unit,
          sortOrder: i++,
        });
      }

      // Check if completely delivered
      const updatedLines = await tx.select().from(salesOrderLines).where(eq(salesOrderLines.salesOrderId, input.salesOrderId));
      const isCompletelyDelivered = updatedLines.every((l) => parseFloat(l.deliveredQuantity) >= parseFloat(l.quantity));

      await tx
        .update(salesOrders)
        .set({ status: isCompletelyDelivered ? 'DELIVERED' : 'PARTIALLY_DELIVERED' })
        .where(eq(salesOrders.id, input.salesOrderId));

      // Trigger Integration Contract Event/Log
      logger.info(`[EVENT] SalesDeliveryConfirmed: ${dnNumber} created for Sales Order ID ${input.salesOrderId}`);

      await tx.insert(auditLogs).values({
        tenantId,
        actorId,
        action: 'CREATE',
        entityType: 'DELIVERY',
        entityId: String(dlv.id),
        previousState: null,
        resultingState: dlv,
      });

      return dlv;
    });
  }

  public async deleteDelivery(tenantId: string, id: number, actorId = 'system', reason = '') {
    const existing = await this.getDelivery(tenantId, id);
    if (!existing) throw new Error('Delivery not found');

    return db.transaction(async (tx) => {
      if (existing.salesOrderId) {
        // Reverse delivered quantities on Sales Order
        const dlvLines = await tx.select().from(deliveryLines).where(eq(deliveryLines.deliveryId, id));
        for (const dl of dlvLines) {
          if (dl.salesOrderLineId) {
            const [sol] = await tx.select().from(salesOrderLines).where(eq(salesOrderLines.id, dl.salesOrderLineId)).limit(1);
            if (sol) {
              const currentDelivered = parseFloat(sol.deliveredQuantity) || 0;
              const deliveredThisLine = parseFloat(dl.quantity) || 0;
              const reversedDelivered = Math.max(0, currentDelivered - deliveredThisLine);

              await tx
                .update(salesOrderLines)
                .set({ deliveredQuantity: String(reversedDelivered) })
                .where(eq(salesOrderLines.id, dl.salesOrderLineId));
            }
          }
        }

        // Reset Sales Order state
        await tx
          .update(salesOrders)
          .set({ status: 'CONFIRMED' })
          .where(eq(salesOrders.id, existing.salesOrderId));
      }

      // Delete lines & header
      await tx.delete(deliveryLines).where(eq(deliveryLines.deliveryId, id));
      await tx.delete(deliveries).where(eq(deliveries.id, id));

      await tx.insert(auditLogs).values({
        tenantId,
        actorId,
        action: 'DELETE',
        entityType: 'DELIVERY',
        entityId: String(id),
        previousState: existing,
        resultingState: null,
      });

      return { success: true, action: 'HARD_DELETE' };
    });
  }

  // ==========================================
  // 6. INVOICE ENGINE
  // ==========================================

  public async listInvoices(tenantId: string) {
    return db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        clientNameEn: clients.nameEn,
        clientNameAr: clients.nameAr,
        invoiceDate: invoices.invoiceDate,
        dueDate: invoices.dueDate,
        currency: invoices.currency,
        grandTotal: invoices.grandTotal,
        outstandingAmount: invoices.outstandingAmount,
        status: invoices.status,
      })
      .from(invoices)
      .innerJoin(clients, eq(invoices.clientId, clients.id))
      .where(and(eq(invoices.tenantId, tenantId), sql`${invoices.deletedAt} IS NULL`))
      .orderBy(desc(invoices.invoiceNumber));
  }

  public async getInvoice(tenantId: string, id: number) {
    const [inv] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId), sql`${invoices.deletedAt} IS NULL`))
      .limit(1);

    if (!inv) return null;

    const lines = await db
      .select()
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, id))
      .orderBy(asc(invoiceLines.sortOrder));

    const [client] = await db.select().from(clients).where(eq(clients.id, inv.clientId)).limit(1);

    return { ...inv, lines, client };
  }

  public async createDirectInvoice(
    tenantId: string,
    input: {
      branchId: string;
      clientId: number;
      salesOrderId?: number;
      deliveryId?: number;
      invoiceDate: string;
      dueDate: string;
      currency: string;
      paymentTerms?: string;
      clientReference?: string;
      notes?: string;
      lines: {
        sourceLineType?: string;
        sourceLineId?: number;
        itemId?: string;
        description: string;
        quantity: string;
        unit?: string;
        unitPrice: string;
        discountType?: 'PERCENTAGE' | 'FIXED';
        discountValue?: string;
        taxCodeId?: number;
      }[];
    },
    actorId = 'system'
  ) {
    const currency = input.currency.toUpperCase();
    const invNumber = await numberingRepository.generateNextNumber(tenantId, 'INVOICE', input.branchId);

    return db.transaction(async (tx) => {
      let subtotalSubunits = 0n;
      let discountTotalSubunits = 0n;
      let taxTotalSubunits = 0n;
      let grandTotalSubunits = 0n;

      const linesToInsert: any[] = [];

      for (let i = 0; i < input.lines.length; i++) {
        const line = input.lines[i];
        const qty = parseFloat(line.quantity) || 0;
        const priceM = Money.create(line.unitPrice, currency);

        const lineSubtotalM = priceM.multiply(qty);
        subtotalSubunits += lineSubtotalM.toSubunits();

        let discountAmountM = Money.create('0.000', currency);
        if (line.discountType === 'PERCENTAGE' && line.discountValue) {
          discountAmountM = lineSubtotalM.multiply((parseFloat(line.discountValue) || 0) / 100);
        } else if (line.discountType === 'FIXED' && line.discountValue) {
          discountAmountM = Money.create(line.discountValue, currency);
        }
        discountTotalSubunits += discountAmountM.toSubunits();

        const taxableM = lineSubtotalM.subtract(discountAmountM);

        let taxAmountM = Money.create('0.000', currency);
        if (line.taxCodeId) {
          const [tc] = await tx.select().from(taxCodes).where(eq(taxCodes.id, line.taxCodeId)).limit(1);
          if (tc) {
            taxAmountM = taxableM.multiply((parseFloat(tc.rate) || 0) / 100);
          }
        }
        taxTotalSubunits += taxAmountM.toSubunits();

        const lineTotalM = taxableM.add(taxAmountM);
        grandTotalSubunits += lineTotalM.toSubunits();

        linesToInsert.push({
          sourceLineType: line.sourceLineType || null,
          sourceLineId: line.sourceLineId || null,
          itemId: line.itemId || null,
          description: line.description.trim(),
          quantity: line.quantity,
          unit: line.unit || null,
          unitPrice: priceM.toDecimalString(),
          discountType: line.discountType || null,
          discountValue: line.discountValue || '0.000',
          taxCodeId: line.taxCodeId || null,
          lineSubtotal: lineSubtotalM.toDecimalString(),
          discountAmount: discountAmountM.toDecimalString(),
          taxAmount: taxAmountM.toDecimalString(),
          lineTotal: lineTotalM.toDecimalString(),
          sortOrder: i,
        });
      }

      const grandTotalDecimal = Money.fromSubunits(grandTotalSubunits, currency).toDecimalString();

      const [inv] = await tx
        .insert(invoices)
        .values({
          tenantId,
          branchId: input.branchId,
          invoiceNumber: invNumber,
          clientId: input.clientId,
          salesOrderId: input.salesOrderId || null,
          deliveryId: input.deliveryId || null,
          invoiceDate: input.invoiceDate,
          dueDate: input.dueDate,
          currency,
          paymentTerms: input.paymentTerms || '30 Days',
          clientReference: input.clientReference || null,
          status: 'DRAFT',
          subtotal: Money.fromSubunits(subtotalSubunits, currency).toDecimalString(),
          discountTotal: Money.fromSubunits(discountTotalSubunits, currency).toDecimalString(),
          taxTotal: Money.fromSubunits(taxTotalSubunits, currency).toDecimalString(),
          roundingAdjustment: '0.000',
          grandTotal: grandTotalDecimal,
          paidAmount: '0.000',
          outstandingAmount: grandTotalDecimal,
          notes: input.notes || null,
          createdBy: actorId,
          updatedBy: actorId,
        })
        .returning();

      // Insert Lines
      const mappedLines = linesToInsert.map((l) => ({ ...l, invoiceId: inv.id }));
      await tx.insert(invoiceLines).values(mappedLines);

      // Log Audit
      await tx.insert(auditLogs).values({
        tenantId,
        actorId,
        action: 'CREATE',
        entityType: 'INVOICE',
        entityId: String(inv.id),
        previousState: null,
        resultingState: inv,
      });

      return inv;
    });
  }

  public async postInvoice(tenantId: string, id: number, actorId = 'system') {
    const inv = await this.getInvoice(tenantId, id);
    if (!inv) throw new Error('Invoice not found');
    if (inv.status !== 'DRAFT' && inv.status !== 'APPROVED') {
      throw new Error(`Invoice cannot be posted from state '${inv.status}'`);
    }

    const [updated] = await db
      .update(invoices)
      .set({
        status: 'POSTED',
        postedAt: new Date(),
        postedBy: actorId,
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)))
      .returning();

    // Trigger Integration Contract Event
    logger.info(`[EVENT] InvoicePosted: ${inv.invoiceNumber} posted by ${actorId}`);

    await db.insert(auditLogs).values({
      tenantId,
      actorId,
      action: 'POST_INVOICE',
      entityType: 'INVOICE',
      entityId: String(id),
      previousState: inv,
      resultingState: updated,
    });

    return updated;
  }

  public async deleteInvoice(tenantId: string, id: number, actorId = 'system', reason = '') {
    const existing = await this.getInvoice(tenantId, id);
    if (!existing) throw new Error('Invoice not found');

    if (parseFloat(existing.paidAmount) > 0) {
      throw new Error('This invoice has received payments. Deleting it requires reversing payment allocations first.');
    }

    if (existing.status === 'DRAFT' || existing.status === 'PENDING_APPROVAL') {
      // Hard Delete
      await db.delete(invoiceLines).where(eq(invoiceLines.invoiceId, id));
      await db.delete(invoices).where(eq(invoices.id, id));

      await db.insert(auditLogs).values({
        tenantId,
        actorId,
        action: 'DELETE',
        entityType: 'INVOICE',
        entityId: String(id),
        previousState: existing,
        resultingState: null,
      });
      return { success: true, action: 'HARD_DELETE' };
    } else {
      // Controlled Financial Void
      const [updated] = await db
        .update(invoices)
        .set({
          status: 'VOIDED',
          voidedAt: new Date(),
          voidedBy: actorId,
          voidReason: reason || 'Invoiced voided and removed from active flow',
          outstandingAmount: '0.000',
          updatedAt: new Date(),
          updatedBy: actorId,
        })
        .where(eq(invoices.id, id))
        .returning();

      // Trigger integration contract event
      logger.info(`[EVENT] InvoiceVoided: ${existing.invoiceNumber} voided/cancelled`);

      await db.insert(auditLogs).values({
        tenantId,
        actorId,
        action: 'VOID_INVOICE',
        entityType: 'INVOICE',
        entityId: String(id),
        previousState: existing,
        resultingState: updated,
      });

      return { success: true, action: 'VOID', reason };
    }
  }

  // ==========================================
  // 7. CREDIT NOTES
  // ==========================================

  public async listCreditNotes(tenantId: string) {
    return db
      .select({
        id: creditNotes.id,
        creditNoteNumber: creditNotes.creditNoteNumber,
        clientNameEn: clients.nameEn,
        clientNameAr: clients.nameAr,
        creditNoteDate: creditNotes.creditNoteDate,
        currency: creditNotes.currency,
        grandTotal: creditNotes.grandTotal,
        status: creditNotes.status,
      })
      .from(creditNotes)
      .innerJoin(clients, eq(creditNotes.clientId, clients.id))
      .where(and(eq(creditNotes.tenantId, tenantId), sql`${creditNotes.deletedAt} IS NULL`))
      .orderBy(desc(creditNotes.creditNoteNumber));
  }

  public async getCreditNote(tenantId: string, id: number) {
    const [cn] = await db
      .select()
      .from(creditNotes)
      .where(and(eq(creditNotes.id, id), eq(creditNotes.tenantId, tenantId), sql`${creditNotes.deletedAt} IS NULL`))
      .limit(1);

    if (!cn) return null;

    const lines = await db
      .select()
      .from(creditNoteLines)
      .where(eq(creditNoteLines.creditNoteId, id))
      .orderBy(asc(creditNoteLines.sortOrder));

    const [client] = await db.select().from(clients).where(eq(clients.id, cn.clientId)).limit(1);

    return { ...cn, lines, client };
  }

  public async createCreditNote(
    tenantId: string,
    input: {
      branchId: string;
      clientId: number;
      invoiceId?: number;
      creditNoteDate: string;
      currency: string;
      reason: string;
      lines: {
        description: string;
        quantity: string;
        unitPrice: string;
        taxCodeId?: number;
      }[];
    },
    actorId = 'system'
  ) {
    const currency = input.currency.toUpperCase();
    const cnNumber = await numberingRepository.generateNextNumber(tenantId, 'CREDIT_NOTE', input.branchId);

    return db.transaction(async (tx) => {
      let subtotalSubunits = 0n;
      let taxTotalSubunits = 0n;
      let grandTotalSubunits = 0n;

      const linesToInsert: any[] = [];

      for (let i = 0; i < input.lines.length; i++) {
        const line = input.lines[i];
        const qty = parseFloat(line.quantity) || 0;
        const priceM = Money.create(line.unitPrice, currency);

        const lineSubtotalM = priceM.multiply(qty);
        subtotalSubunits += lineSubtotalM.toSubunits();

        let taxAmountM = Money.create('0.000', currency);
        if (line.taxCodeId) {
          const [tc] = await tx.select().from(taxCodes).where(eq(taxCodes.id, line.taxCodeId)).limit(1);
          if (tc) {
            taxAmountM = lineSubtotalM.multiply((parseFloat(tc.rate) || 0) / 100);
          }
        }
        taxTotalSubunits += taxAmountM.toSubunits();

        const lineTotalM = lineSubtotalM.add(taxAmountM);
        grandTotalSubunits += lineTotalM.toSubunits();

        linesToInsert.push({
          description: line.description.trim(),
          quantity: line.quantity,
          unitPrice: priceM.toDecimalString(),
          taxCodeId: line.taxCodeId || null,
          lineSubtotal: lineSubtotalM.toDecimalString(),
          taxAmount: taxAmountM.toDecimalString(),
          lineTotal: lineTotalM.toDecimalString(),
          sortOrder: i,
        });
      }

      const grandTotalDecimal = Money.fromSubunits(grandTotalSubunits, currency).toDecimalString();

      const [cn] = await tx
        .insert(creditNotes)
        .values({
          tenantId,
          branchId: input.branchId,
          creditNoteNumber: cnNumber,
          clientId: input.clientId,
          invoiceId: input.invoiceId || null,
          creditNoteDate: input.creditNoteDate,
          currency,
          reason: input.reason.trim(),
          status: 'POSTED', // Credit notes usually post instantly
          subtotal: Money.fromSubunits(subtotalSubunits, currency).toDecimalString(),
          taxTotal: Money.fromSubunits(taxTotalSubunits, currency).toDecimalString(),
          grandTotal: grandTotalDecimal,
          createdBy: actorId,
          updatedBy: actorId,
        })
        .returning();

      // Insert lines
      const mappedLines = linesToInsert.map((l) => ({ ...l, creditNoteId: cn.id }));
      await tx.insert(creditNoteLines).values(mappedLines);

      // If associated with a specific Invoice, allocate credit immediately
      if (input.invoiceId) {
        const [inv] = await tx.select().from(invoices).where(eq(invoices.id, input.invoiceId)).limit(1);
        if (inv) {
          const outstandingM = Money.create(inv.outstandingAmount, currency);
          const creditM = Money.create(grandTotalDecimal, currency);

          // Apply credit
          const appliedM = outstandingM.toSubunits() > creditM.toSubunits() ? creditM : outstandingM;
          const newOutstanding = outstandingM.subtract(appliedM);

          await tx
            .update(invoices)
            .set({ outstandingAmount: newOutstanding.toDecimalString() })
            .where(eq(invoices.id, input.invoiceId));

          await tx.insert(receiptAllocations).values({
            tenantId,
            creditNoteId: cn.id,
            invoiceId: inv.id,
            allocatedAmount: appliedM.toDecimalString(),
            allocationDate: input.creditNoteDate,
            createdBy: actorId,
          });
        }
      }

      // Log Audit
      await tx.insert(auditLogs).values({
        tenantId,
        actorId,
        action: 'CREATE',
        entityType: 'CREDIT_NOTE',
        entityId: String(cn.id),
        previousState: null,
        resultingState: cn,
      });

      return cn;
    });
  }

  // ==========================================
  // 8. RECEIPTS & ALLOCATION ENGINE
  // ==========================================

  public async listReceipts(tenantId: string) {
    return db
      .select({
        id: receipts.id,
        receiptNumber: receipts.receiptNumber,
        clientNameEn: clients.nameEn,
        clientNameAr: clients.nameAr,
        receiptDate: receipts.receiptDate,
        currency: receipts.currency,
        amount: receipts.amount,
        unallocatedAmount: receipts.unallocatedAmount,
        status: receipts.status,
      })
      .from(receipts)
      .innerJoin(clients, eq(receipts.clientId, clients.id))
      .where(and(eq(receipts.tenantId, tenantId), sql`${receipts.deletedAt} IS NULL`))
      .orderBy(desc(receipts.receiptNumber));
  }

  public async getReceipt(tenantId: string, id: number) {
    const [rec] = await db
      .select()
      .from(receipts)
      .where(and(eq(receipts.id, id), eq(receipts.tenantId, tenantId), sql`${receipts.deletedAt} IS NULL`))
      .limit(1);

    if (!rec) return null;

    const allocations = await db
      .select()
      .from(receiptAllocations)
      .where(eq(receiptAllocations.receiptId, id))
      .orderBy(asc(receiptAllocations.id));

    const [client] = await db.select().from(clients).where(eq(clients.id, rec.clientId)).limit(1);

    return { ...rec, allocations, client };
  }

  public async createReceipt(
    tenantId: string,
    input: {
      branchId: string;
      clientId: number;
      receiptDate: string;
      currency: string;
      paymentMethod: string;
      bankAccountId?: string;
      referenceNumber?: string;
      amount: string;
      notes?: string;
      allocations?: { invoiceId: number; amount: string }[];
    },
    actorId = 'system'
  ) {
    const currency = input.currency.toUpperCase();
    const recNumber = await numberingRepository.generateNextNumber(tenantId, 'RECEIPT', input.branchId);

    return db.transaction(async (tx) => {
      const receiptAmountM = Money.create(input.amount, currency);
      let unallocatedSubunits = receiptAmountM.toSubunits();

      const [rec] = await tx
        .insert(receipts)
        .values({
          tenantId,
          branchId: input.branchId,
          receiptNumber: recNumber,
          clientId: input.clientId,
          receiptDate: input.receiptDate,
          currency,
          paymentMethod: input.paymentMethod as any,
          bankAccountId: input.bankAccountId || null,
          referenceNumber: input.referenceNumber || null,
          amount: receiptAmountM.toDecimalString(),
          unallocatedAmount: receiptAmountM.toDecimalString(),
          status: 'DRAFT',
          notes: input.notes || null,
          createdBy: actorId,
          updatedBy: actorId,
        })
        .returning();

      if (input.allocations && input.allocations.length > 0) {
        for (const alloc of input.allocations) {
          const allocM = Money.create(alloc.amount, currency);

          // Verify alloc <= unallocated amount
          if (allocM.toSubunits() > unallocatedSubunits) {
            throw new Error(`Allocated Amount (${allocM.toDecimalString()}) exceeds Receipt Available Amount.`);
          }

          // Lock invoice with FOR UPDATE to prevent concurrency double-allocations
          const [inv] = await tx
            .select()
            .from(invoices)
            .where(and(eq(invoices.id, alloc.invoiceId), eq(invoices.tenantId, tenantId)))
            .for('update')
            .limit(1);

          if (!inv) throw new Error(`Invoice with ID ${alloc.invoiceId} not found.`);

          const outstandingM = Money.create(inv.outstandingAmount, currency);
          if (allocM.toSubunits() > outstandingM.toSubunits()) {
            throw new Error(`Allocated Amount (${allocM.toDecimalString()}) exceeds Invoice Outstanding Balance (${outstandingM.toDecimalString()}).`);
          }

          // Deduct from Invoice Outstanding & Add to Paid
          const newOutstanding = outstandingM.subtract(allocM);
          const currentPaid = Money.create(inv.paidAmount, currency);
          const newPaid = currentPaid.add(allocM);

          const isFullyPaid = newOutstanding.toSubunits() === 0n;

          await tx
            .update(invoices)
            .set({
              outstandingAmount: newOutstanding.toDecimalString(),
              paidAmount: newPaid.toDecimalString(),
              status: isFullyPaid ? 'PAID' : 'PARTIALLY_PAID',
            })
            .where(eq(invoices.id, alloc.invoiceId));

          // Save Allocation Record
          await tx.insert(receiptAllocations).values({
            tenantId,
            receiptId: rec.id,
            invoiceId: alloc.invoiceId,
            allocatedAmount: allocM.toDecimalString(),
            allocationDate: input.receiptDate,
            createdBy: actorId,
          });

          unallocatedSubunits -= allocM.toSubunits();
        }
      }

      // Update unallocated amount & status on receipt
      const unallocatedM = Money.fromSubunits(unallocatedSubunits, currency);
      const isFullyAllocated = unallocatedSubunits === 0n;

      const [updatedRec] = await tx
        .update(receipts)
        .set({
          unallocatedAmount: unallocatedM.toDecimalString(),
          status: isFullyAllocated ? 'ALLOCATED' : (unallocatedSubunits < receiptAmountM.toSubunits() ? 'PARTIALLY_ALLOCATED' : 'POSTED'),
          postedAt: new Date(),
          postedBy: actorId,
        })
        .where(eq(receipts.id, rec.id))
        .returning();

      // Log Audit
      await tx.insert(auditLogs).values({
        tenantId,
        actorId,
        action: 'CREATE',
        entityType: 'RECEIPT',
        entityId: String(rec.id),
        previousState: null,
        resultingState: updatedRec,
      });

      return updatedRec;
    });
  }

  public async deleteReceipt(tenantId: string, id: number, actorId = 'system', reason = '') {
    const existing = await this.getReceipt(tenantId, id);
    if (!existing) throw new Error('Receipt not found');

    return db.transaction(async (tx) => {
      const currency = existing.currency;

      // 1. Reverse all allocations first
      const allocations = await tx.select().from(receiptAllocations).where(eq(receiptAllocations.receiptId, id));
      for (const alloc of allocations) {
        if (alloc.invoiceId) {
          const [inv] = await tx.select().from(invoices).where(eq(invoices.id, alloc.invoiceId)).limit(1);
          if (inv) {
            const allocM = Money.create(alloc.allocatedAmount, currency);
            const outstandingM = Money.create(inv.outstandingAmount, currency);
            const paidM = Money.create(inv.paidAmount, currency);

            const reversedOutstanding = outstandingM.add(allocM);
            const rawPaidSubunits = paidM.toSubunits() - allocM.toSubunits();
            const reversedPaid = Money.fromSubunits(rawPaidSubunits > 0n ? rawPaidSubunits : 0n, currency);

            const isUnpaid = reversedPaid.toSubunits() === 0n;

            await tx
              .update(invoices)
              .set({
                outstandingAmount: reversedOutstanding.toDecimalString(),
                paidAmount: reversedPaid.toDecimalString(),
                status: isUnpaid ? 'POSTED' : 'PARTIALLY_PAID',
              })
              .where(eq(invoices.id, alloc.invoiceId));
          }
        }
      }

      // Delete allocations
      await tx.delete(receiptAllocations).where(eq(receiptAllocations.receiptId, id));

      if (existing.status === 'DRAFT') {
        await tx.delete(receipts).where(eq(receipts.id, id));
        await tx.insert(auditLogs).values({
          tenantId,
          actorId,
          action: 'DELETE',
          entityType: 'RECEIPT',
          entityId: String(id),
          previousState: existing,
          resultingState: null,
        });
        return { success: true, action: 'HARD_DELETE' };
      } else {
        // Void Posted Receipt
        const [voided] = await tx
          .update(receipts)
          .set({
            status: 'VOIDED',
            voidedAt: new Date(),
            voidedBy: actorId,
            voidReason: reason || 'Voided receipt and reversed allocations',
            unallocatedAmount: '0.000',
            updatedAt: new Date(),
            updatedBy: actorId,
          })
          .where(eq(receipts.id, id))
          .returning();

        await tx.insert(auditLogs).values({
          tenantId,
          actorId,
          action: 'VOID_RECEIPT',
          entityType: 'RECEIPT',
          entityId: String(id),
          previousState: existing,
          resultingState: voided,
        });

        return { success: true, action: 'VOID', reason };
      }
    });
  }

  // ==========================================
  // 9. CLIENT ACCOUNT SUBLEDGER & STATEMENTS
  // ==========================================

  public async getCustomerStatement(
    tenantId: string,
    clientId: number,
    dateFrom: string,
    dateTo: string,
    currency = 'KWD'
  ) {
    const client = await db.select().from(clients).where(and(eq(clients.id, clientId), eq(clients.tenantId, tenantId))).limit(1);
    if (client.length === 0) throw new Error('Client not found or access denied');

    // Load Invoices, Credit Notes, Receipts before the dateFrom (for Opening Balance)
    const priorInvoices = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.clientId, clientId), lt(invoices.invoiceDate, dateFrom), eq(invoices.status, 'POSTED'), eq(invoices.currency, currency)));

    const priorReceipts = await db
      .select()
      .from(receipts)
      .where(and(eq(receipts.clientId, clientId), lt(receipts.receiptDate, dateFrom), eq(receipts.status, 'POSTED'), eq(receipts.currency, currency)));

    const priorCreditNotes = await db
      .select()
      .from(creditNotes)
      .where(and(eq(creditNotes.clientId, clientId), lt(creditNotes.creditNoteDate, dateFrom), eq(creditNotes.status, 'POSTED'), eq(creditNotes.currency, currency)));

    // Opening Balance = Prior Invoices (Debit) - Prior Receipts (Credit) - Prior Credit Notes (Credit)
    let openingSubunits = 0n;
    priorInvoices.forEach((i) => (openingSubunits += Money.create(i.grandTotal, currency).toSubunits()));
    priorReceipts.forEach((r) => (openingSubunits -= Money.create(r.amount, currency).toSubunits()));
    priorCreditNotes.forEach((c) => (openingSubunits -= Money.create(c.grandTotal, currency).toSubunits()));

    // Active Transactions in selected Range
    const periodInvoices = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.clientId, clientId),
          sql`${invoices.invoiceDate} >= ${dateFrom} AND ${invoices.invoiceDate} <= ${dateTo}`,
          eq(invoices.status, 'POSTED'),
          eq(invoices.currency, currency)
        )
      );

    const periodReceipts = await db
      .select()
      .from(receipts)
      .where(
        and(
          eq(receipts.clientId, clientId),
          sql`${receipts.receiptDate} >= ${dateFrom} AND ${receipts.receiptDate} <= ${dateTo}`,
          eq(receipts.status, 'POSTED'),
          eq(receipts.currency, currency)
        )
      );

    const periodCreditNotes = await db
      .select()
      .from(creditNotes)
      .where(
        and(
          eq(creditNotes.clientId, clientId),
          sql`${creditNotes.creditNoteDate} >= ${dateFrom} AND ${creditNotes.creditNoteDate} <= ${dateTo}`,
          eq(creditNotes.status, 'POSTED'),
          eq(creditNotes.currency, currency)
        )
      );

    // Flat Map to unified statement rows
    const txs: { date: string; ref: string; type: string; desc: string; debit: string; credit: string; dateObj: Date }[] = [];

    periodInvoices.forEach((i) => {
      txs.push({
        date: i.invoiceDate,
        ref: i.invoiceNumber,
        type: 'INVOICE',
        desc: `Sales Invoice ${i.invoiceNumber}`,
        debit: i.grandTotal,
        credit: '0.000',
        dateObj: new Date(i.invoiceDate),
      });
    });

    periodReceipts.forEach((r) => {
      txs.push({
        date: r.receiptDate,
        ref: r.receiptNumber,
        type: 'RECEIPT',
        desc: `Customer Payment ${r.receiptNumber} (${r.paymentMethod})`,
        debit: '0.000',
        credit: r.amount,
        dateObj: new Date(r.receiptDate),
      });
    });

    periodCreditNotes.forEach((c) => {
      txs.push({
        date: c.creditNoteDate,
        ref: c.creditNoteNumber,
        type: 'CREDIT_NOTE',
        desc: `Credit Note Adjustment ${c.creditNoteNumber} - ${c.reason}`,
        debit: '0.000',
        credit: c.grandTotal,
        dateObj: new Date(c.creditNoteDate),
      });
    });

    // Sort by Date, then Reference
    txs.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.ref.localeCompare(b.ref);
    });

    // Calculate Running Balance
    let runningSubunits = openingSubunits;
    const items = txs.map((t) => {
      const debitSub = Money.create(t.debit, currency).toSubunits();
      const creditSub = Money.create(t.credit, currency).toSubunits();
      runningSubunits += debitSub - creditSub;

      return {
        date: t.date,
        reference: t.ref,
        type: t.type,
        description: t.desc,
        debit: t.debit,
        credit: t.credit,
        balance: Money.fromSubunits(runningSubunits, currency).toDecimalString(),
      };
    });

    const closingBalance = Money.fromSubunits(runningSubunits, currency).toDecimalString();

    return {
      client: client[0],
      dateFrom,
      dateTo,
      currency,
      openingBalance: Money.fromSubunits(openingSubunits, currency).toDecimalString(),
      items,
      closingBalance,
    };
  }

  public async getReceivableAging(tenantId: string, currency = 'KWD') {
    const clientsList = await this.listClients(tenantId);
    const result: any[] = [];

    const todayStr = new Date().toISOString().slice(0, 10);
    const today = new Date(todayStr);

    for (const cl of clientsList) {
      const outstandingInvoices = await db
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.clientId, cl.id),
            eq(invoices.status, 'POSTED'),
            eq(invoices.currency, currency),
            sql`${invoices.outstandingAmount} != '0.000'`
          )
        );

      if (outstandingInvoices.length === 0) continue;

      let clCurrent = 0n;
      let cl30 = 0n;
      let cl60 = 0n;
      let cl90 = 0n;
      let clOver90 = 0n;
      let clTotal = 0n;

      outstandingInvoices.forEach((inv) => {
        const outSub = Money.create(inv.outstandingAmount, currency).toSubunits();
        clTotal += outSub;

        const due = new Date(inv.dueDate);
        const diffTime = today.getTime() - due.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) {
          clCurrent += outSub;
        } else if (diffDays <= 30) {
          cl30 += outSub;
        } else if (diffDays <= 60) {
          cl60 += outSub;
        } else if (diffDays <= 90) {
          cl90 += outSub;
        } else {
          clOver90 += outSub;
        }
      });

      result.push({
        clientId: cl.id,
        clientCode: cl.code,
        clientNameEn: cl.nameEn,
        clientNameAr: cl.nameAr,
        current: Money.fromSubunits(clCurrent, currency).toDecimalString(),
        aging1to30: Money.fromSubunits(cl30, currency).toDecimalString(),
        aging31to60: Money.fromSubunits(cl60, currency).toDecimalString(),
        aging61to90: Money.fromSubunits(cl90, currency).toDecimalString(),
        agingOver90: Money.fromSubunits(clOver90, currency).toDecimalString(),
        totalOutstanding: Money.fromSubunits(clTotal, currency).toDecimalString(),
      });
    }

    return result;
  }
}

export const salesRepository = new SalesRepository();
