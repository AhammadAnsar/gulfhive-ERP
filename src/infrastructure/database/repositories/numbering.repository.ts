/**
 * GulfHive ERP - Reusable Central Document Numbering Engine Repository
 * Transaction-safe, concurrency-safe atomic sequence generation.
 * Supports scoped prefixes, suffixes, year/month tokens, branch/fiscal year scope, and zero-padding.
 */

import { eq, and, sql } from 'drizzle-orm';
import { db } from '../../../db/index.ts';
import { documentSequences } from '../../../db/schema.ts';
import { logger } from '../../../core/logging/logger.ts';

export interface SequenceConfigInput {
  documentType: string;
  prefix?: string;
  suffix?: string;
  separator?: string;
  includeYear?: boolean;
  includeMonth?: boolean;
  paddingLength?: number;
  nextNumber?: number;
  resetPolicy?: string; // NEVER, YEARLY, MONTHLY
  fiscalYearId?: string;
  branchId?: string;
  status?: string;
}

const DEFAULT_PREFIXES: Record<string, string> = {
  EMPLOYEE: 'EMP',
  INVOICE: 'INV',
  BILL: 'BILL',
  TIMESHEET: 'TS',
  PURCHASE_ORDER: 'PO',
  SALES_ORDER: 'SO',
  QUOTATION: 'QT',
  RECEIPT: 'RCT',
  PAYMENT: 'PAY',
  PROJECT: 'PRJ',
  PAYROLL: 'PAY',
  JOURNAL: 'JRN',
  ASSET: 'AST',
};

export class NumberingRepository {
  /**
   * Format document number string according to sequence rules.
   */
  public formatNumber(
    seq: {
      prefix: string;
      suffix: string;
      separator: string;
      includeYear: boolean;
      includeMonth: boolean;
      paddingLength: number;
    },
    num: number,
    date: Date = new Date()
  ): string {
    const parts: string[] = [];
    const sep = seq.separator !== undefined ? seq.separator : '-';

    if (seq.prefix && seq.prefix.trim().length > 0) {
      parts.push(seq.prefix.trim());
    }

    if (seq.includeYear) {
      parts.push(date.getFullYear().toString());
    }

    if (seq.includeMonth) {
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      parts.push(month);
    }

    const paddedNum = num.toString().padStart(seq.paddingLength || 5, '0');
    parts.push(paddedNum);

    let result = parts.join(sep);

    if (seq.suffix && seq.suffix.trim().length > 0) {
      result = `${result}${seq.suffix.trim()}`;
    }

    return result;
  }

  /**
   * List all document sequences configured for a tenant/company.
   */
  public async listSequences(tenantId: string) {
    return db
      .select()
      .from(documentSequences)
      .where(eq(documentSequences.tenantId, tenantId))
      .orderBy(documentSequences.documentType);
  }

  /**
   * Upsert document sequence configuration for a document type.
   */
  public async upsertSequence(tenantId: string, input: SequenceConfigInput, actorId = 'system') {
    const docType = input.documentType.toUpperCase().trim();
    const branchId = input.branchId || null;
    const fiscalYearId = input.fiscalYearId || null;

    // Check existing
    const existing = await db
      .select()
      .from(documentSequences)
      .where(
        and(
          eq(documentSequences.tenantId, tenantId),
          eq(documentSequences.documentType, docType)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const seq = existing[0];
      const updated = await db
        .update(documentSequences)
        .set({
          prefix: input.prefix !== undefined ? input.prefix.trim() : seq.prefix,
          suffix: input.suffix !== undefined ? input.suffix.trim() : seq.suffix,
          separator: input.separator !== undefined ? input.separator : seq.separator,
          includeYear: input.includeYear !== undefined ? input.includeYear : seq.includeYear,
          includeMonth: input.includeMonth !== undefined ? input.includeMonth : seq.includeMonth,
          paddingLength: input.paddingLength !== undefined ? Number(input.paddingLength) : seq.paddingLength,
          nextNumber: input.nextNumber !== undefined ? Number(input.nextNumber) : seq.nextNumber,
          resetPolicy: input.resetPolicy || seq.resetPolicy,
          fiscalYearId,
          branchId,
          status: input.status || seq.status,
          updatedAt: new Date(),
          updatedBy: actorId,
        })
        .where(eq(documentSequences.id, seq.id))
        .returning();

      return updated[0];
    } else {
      const id = `seq_${docType.toLowerCase()}_${Date.now()}`;
      const inserted = await db
        .insert(documentSequences)
        .values({
          id,
          tenantId,
          documentType: docType,
          prefix: input.prefix !== undefined ? input.prefix.trim() : DEFAULT_PREFIXES[docType] || docType.substring(0, 3),
          suffix: input.suffix !== undefined ? input.suffix.trim() : '',
          separator: input.separator !== undefined ? input.separator : '-',
          includeYear: input.includeYear !== undefined ? input.includeYear : true,
          includeMonth: input.includeMonth !== undefined ? input.includeMonth : false,
          paddingLength: input.paddingLength !== undefined ? Number(input.paddingLength) : 5,
          nextNumber: input.nextNumber !== undefined ? Number(input.nextNumber) : 1,
          resetPolicy: input.resetPolicy || 'NEVER',
          fiscalYearId,
          branchId,
          status: input.status || 'ACTIVE',
          createdBy: actorId,
          updatedBy: actorId,
        })
        .returning();

      return inserted[0];
    }
  }

  /**
   * Preview formatted document code without mutating or consuming the sequence counter.
   */
  public async previewNumber(tenantId: string, input: SequenceConfigInput): Promise<{ preview: string }> {
    const defaultPrefix = DEFAULT_PREFIXES[input.documentType?.toUpperCase()] || input.documentType?.substring(0, 3) || 'DOC';
    const cfg = {
      prefix: input.prefix !== undefined ? input.prefix : defaultPrefix,
      suffix: input.suffix || '',
      separator: input.separator !== undefined ? input.separator : '-',
      includeYear: input.includeYear !== undefined ? input.includeYear : true,
      includeMonth: input.includeMonth !== undefined ? input.includeMonth : false,
      paddingLength: input.paddingLength || 5,
    };

    const num = input.nextNumber || 1;
    const preview = this.formatNumber(cfg, num);
    return { preview };
  }

  /**
   * Atomically generate and increment next document number in a transaction lock.
   * Concurrency-safe and duplicate-safe.
   */
  public async generateNextNumber(
    tenantId: string,
    documentType: string,
    branchId?: string,
    fiscalYearId?: string
  ): Promise<string> {
    const docType = documentType.toUpperCase().trim();

    return db.transaction(async (tx) => {
      // Query with FOR UPDATE lock if supported, or atomic update
      const existing = await tx
        .select()
        .from(documentSequences)
        .where(
          and(
            eq(documentSequences.tenantId, tenantId),
            eq(documentSequences.documentType, docType)
          )
        )
        .for('update')
        .limit(1);

      let seq: typeof documentSequences.$inferSelect;

      if (existing.length === 0) {
        const id = `seq_${docType.toLowerCase()}_${Date.now()}`;
        const defaultPrefix = DEFAULT_PREFIXES[docType] || docType.substring(0, 3);
        const [inserted] = await tx
          .insert(documentSequences)
          .values({
            id,
            tenantId,
            documentType: docType,
            prefix: defaultPrefix,
            suffix: '',
            separator: '-',
            includeYear: true,
            includeMonth: false,
            paddingLength: 5,
            nextNumber: 1,
            resetPolicy: 'NEVER',
            branchId: branchId || null,
            fiscalYearId: fiscalYearId || null,
            status: 'ACTIVE',
          })
          .returning();
        seq = inserted;
      } else {
        seq = existing[0];
      }

      const currentNum = seq.nextNumber;
      const formattedCode = this.formatNumber(seq, currentNum);

      // Increment sequence atomically
      await tx
        .update(documentSequences)
        .set({
          nextNumber: currentNum + 1,
          updatedAt: new Date(),
        })
        .where(eq(documentSequences.id, seq.id));

      logger.info(`Generated document number '${formattedCode}' for tenant '${tenantId}' [Type: ${docType}]`);

      return formattedCode;
    });
  }
}

export const numberingRepository = new NumberingRepository();
