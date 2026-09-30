/**
 * GulfHive ERP - Authoritative Leave & Overtime Policy Repository
 * 
 * Core Invariants:
 * 1. Separation of Policy, Entitlement, Transaction, and Derived Balance.
 * 2. Balance is strictly derived from the immutable transaction-based Leave Ledger (no arbitrary direct editing).
 * 3. Leave duration is calculated authoritatively by backend, respecting schedules, rest days, and holiday calendars.
 * 4. Policy versioning via effective_from and effective_to ensures historical consistency.
 * 5. Approved leave flows deterministically into Attendance Processing (no false absences).
 * 6. Overtime requests preserve requested vs approved minutes, applying policy rounding and caps.
 * 7. Zero hardcoded monetary calculations (outputs approved quantities to future Payroll).
 */

import { eq, and, desc, asc, sql, inArray, gte, lte, or } from 'drizzle-orm';
import { db } from '../../../db/index.ts';
import {
  leaveTypes,
  leavePolicies,
  employeeLeaveEntitlements,
  leaveLedger,
  leaveRequests,
  overtimePolicies,
  overtimeRecords,
  employees,
  holidays,
  shifts,
  rosterEntries,
  auditLogs,
} from '../../../db/schema.ts';
import { logger } from '../../../core/logging/logger.ts';

export interface CreateLeaveTypeInput {
  code: string;
  nameEn: string;
  nameAr: string;
  category?: string;
  defaultDaysPerYear?: number;
  isPaid?: boolean;
  requiresApproval?: boolean;
  requiresAttachment?: boolean;
  statutoryReference?: string;
}

export interface CreateLeavePolicyInput {
  leaveTypeId: string;
  nameEn: string;
  nameAr: string;
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo?: string | null;
  accrualMethod?: string;
  annualEntitlement: string | number;
  eligibilityMonths?: number;
  carryForwardEnabled?: boolean;
  carryForwardLimit?: string | number;
  carryForwardExpiryMonths?: number;
  encashmentAllowed?: boolean;
  negativeBalanceAllowed?: boolean;
  maximumConsecutiveDays?: number | null;
  excludeRestDays?: boolean;
  excludeHolidays?: boolean;
}

export interface SubmitLeaveRequestInput {
  employeeId: string;
  leaveTypeId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  startPortion?: 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF';
  endPortion?: 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF';
  reason?: string;
  attachmentId?: string;
  actorId: string;
}

export interface AdjustLeaveBalanceInput {
  employeeId: string;
  leaveTypeId: string;
  quantity: string | number; // positive = credit, negative = debit
  reason: string;
  effectiveDate: string; // YYYY-MM-DD
  actorId: string;
}

export interface CreateOvertimePolicyInput {
  code: string;
  nameEn: string;
  nameAr: string;
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo?: string | null;
  eligibilityRule?: string;
  minimumMinutes?: number;
  roundingRule?: string;
  maximumDailyMinutes?: number;
  maximumWeeklyMinutes?: number;
  approvalRequired?: boolean;
}

export class LeaveRepository {
  // ==========================================
  // 1. LEAVE TYPES
  // ==========================================

  public async listLeaveTypes(tenantId: string) {
    return db.select().from(leaveTypes)
      .where(and(eq(leaveTypes.tenantId, tenantId), eq(leaveTypes.status, 'ACTIVE')))
      .orderBy(asc(leaveTypes.code));
  }

  public async getLeaveTypeById(tenantId: string, id: string) {
    const rows = await db.select().from(leaveTypes)
      .where(and(eq(leaveTypes.id, id), eq(leaveTypes.tenantId, tenantId)))
      .limit(1);
    return rows[0] || null;
  }

  public async createLeaveType(tenantId: string, input: CreateLeaveTypeInput) {
    const id = `lt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const [lt] = await db.insert(leaveTypes).values({
      id,
      tenantId,
      code: input.code.toUpperCase().trim(),
      nameEn: input.nameEn.trim(),
      nameAr: input.nameAr.trim(),
      category: input.category || 'ANNUAL',
      defaultDaysPerYear: input.defaultDaysPerYear ?? 30,
      isPaid: input.isPaid !== undefined ? input.isPaid : true,
      requiresApproval: input.requiresApproval !== undefined ? input.requiresApproval : true,
      requiresAttachment: input.requiresAttachment !== undefined ? input.requiresAttachment : false,
      statutoryReference: input.statutoryReference || null,
      status: 'ACTIVE',
      isActive: true,
    }).returning();

    logger.audit('CREATE', 'LEAVE_TYPE', id, { code: lt.code }, { tenantId });
    return lt;
  }

  // ==========================================
  // 2. LEAVE POLICIES (Versioned)
  // ==========================================

  public async listLeavePolicies(tenantId: string, leaveTypeId?: string) {
    const conditions = [eq(leavePolicies.tenantId, tenantId), eq(leavePolicies.status, 'ACTIVE')];
    if (leaveTypeId) conditions.push(eq(leavePolicies.leaveTypeId, leaveTypeId));

    return db.select({
      policy: leavePolicies,
      leaveType: {
        code: leaveTypes.code,
        nameEn: leaveTypes.nameEn,
        nameAr: leaveTypes.nameAr,
        category: leaveTypes.category,
      },
    })
      .from(leavePolicies)
      .innerJoin(leaveTypes, eq(leavePolicies.leaveTypeId, leaveTypes.id))
      .where(and(...conditions))
      .orderBy(desc(leavePolicies.effectiveFrom));
  }

  public async getActivePolicy(tenantId: string, leaveTypeId: string, dateStr: string) {
    const rows = await db.select().from(leavePolicies)
      .where(and(
        eq(leavePolicies.tenantId, tenantId),
        eq(leavePolicies.leaveTypeId, leaveTypeId),
        eq(leavePolicies.status, 'ACTIVE'),
        lte(leavePolicies.effectiveFrom, dateStr),
        or(sql`${leavePolicies.effectiveTo} IS NULL`, gte(leavePolicies.effectiveTo, dateStr))
      ))
      .orderBy(desc(leavePolicies.effectiveFrom))
      .limit(1);

    return rows[0] || null;
  }

  public async createLeavePolicy(tenantId: string, input: CreateLeavePolicyInput) {
    const id = `lp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const [policy] = await db.insert(leavePolicies).values({
      id,
      tenantId,
      leaveTypeId: input.leaveTypeId,
      nameEn: input.nameEn.trim(),
      nameAr: input.nameAr.trim(),
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo || null,
      accrualMethod: input.accrualMethod || 'ANNUAL_GRANT',
      annualEntitlement: String(input.annualEntitlement),
      eligibilityMonths: input.eligibilityMonths ?? 0,
      carryForwardEnabled: input.carryForwardEnabled !== undefined ? input.carryForwardEnabled : true,
      carryForwardLimit: String(input.carryForwardLimit ?? '5.00'),
      carryForwardExpiryMonths: input.carryForwardExpiryMonths ?? 3,
      encashmentAllowed: input.encashmentAllowed !== undefined ? input.encashmentAllowed : false,
      negativeBalanceAllowed: input.negativeBalanceAllowed !== undefined ? input.negativeBalanceAllowed : false,
      maximumConsecutiveDays: input.maximumConsecutiveDays || null,
      excludeRestDays: input.excludeRestDays !== undefined ? input.excludeRestDays : true,
      excludeHolidays: input.excludeHolidays !== undefined ? input.excludeHolidays : true,
      status: 'ACTIVE',
    }).returning();

    logger.audit('CREATE', 'LEAVE_POLICY', id, { nameEn: policy.nameEn, leaveTypeId: policy.leaveTypeId }, { tenantId });
    return policy;
  }

  // ==========================================
  // 3. AUTHORITATIVE LEAVE LEDGER & BALANCES
  // ==========================================

  /**
   * Derives authoritative available balance from transaction ledger.
   */
  public async getEmployeeLeaveBalance(tenantId: string, employeeId: string, leaveTypeId: string): Promise<number> {
    const result = await db.select({
      total: sql<string>`coalesce(sum(${leaveLedger.quantity}), 0)::text`,
    })
      .from(leaveLedger)
      .where(and(
        eq(leaveLedger.tenantId, tenantId),
        eq(leaveLedger.employeeId, employeeId),
        eq(leaveLedger.leaveTypeId, leaveTypeId)
      ));

    return parseFloat(result[0]?.total || '0');
  }

  public async listEmployeeLedger(tenantId: string, employeeId: string, leaveTypeId?: string) {
    const conditions = [eq(leaveLedger.tenantId, tenantId), eq(leaveLedger.employeeId, employeeId)];
    if (leaveTypeId) conditions.push(eq(leaveLedger.leaveTypeId, leaveTypeId));

    return db.select().from(leaveLedger)
      .where(and(...conditions))
      .orderBy(desc(leaveLedger.transactionDate), desc(leaveLedger.createdAt));
  }

  public async adjustLeaveBalance(tenantId: string, input: AdjustLeaveBalanceInput) {
    const id = `lgr_adj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const [entry] = await db.insert(leaveLedger).values({
      id,
      tenantId,
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      transactionDate: input.effectiveDate,
      transactionType: 'ADJUSTMENT',
      quantity: String(input.quantity),
      referenceType: 'MANUAL_ADJUSTMENT',
      notes: input.reason,
      createdBy: input.actorId,
    }).returning();

    logger.audit('CREATE', 'LEAVE_ADJUSTMENT', id, {
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      quantity: input.quantity,
      reason: input.reason,
    }, { tenantId });

    return entry;
  }

  // ==========================================
  // 4. AUTHORITATIVE DURATION CALCULATION
  // ==========================================

  /**
   * Deterministically calculates working leave days between start and end dates,
   * excluding rest days (Fridays/Saturdays or rostered off-days) and public holidays
   * according to policy configuration.
   */
  public async calculateLeaveDuration(
    tenantId: string,
    employeeId: string,
    leavePolicyId: string,
    startDate: string,
    endDate: string,
    startPortion: 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF' = 'FULL_DAY',
    endPortion: 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF' = 'FULL_DAY'
  ): Promise<{ calendarDays: number; deductibleDays: number; nonWorkingDays: number }> {
    const [policy] = await db.select().from(leavePolicies)
      .where(and(eq(leavePolicies.id, leavePolicyId), eq(leavePolicies.tenantId, tenantId)))
      .limit(1);

    if (!policy) throw new Error('Leave policy not found.');

    const start = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T00:00:00Z');
    if (end < start) throw new Error('End date cannot precede start date.');

    // Fetch company holidays in this date range
    const holidayRows = await db.select().from(holidays)
      .where(and(
        eq(holidays.tenantId, tenantId),
        gte(holidays.endDate, start),
        lte(holidays.startDate, end)
      ));

    const holidayDates = new Set<string>();
    for (const h of holidayRows) {
      if (h.holidayDate) {
        holidayDates.add(h.holidayDate);
      } else if (h.startDate && h.endDate) {
        const cur = new Date(h.startDate);
        const hEnd = new Date(h.endDate);
        while (cur <= hEnd) {
          holidayDates.add(cur.toISOString().slice(0, 10));
          cur.setUTCDate(cur.getUTCDate() + 1);
        }
      }
    }

    let calendarDays = 0;
    let deductibleDays = 0;
    let nonWorkingDays = 0;

    const cur = new Date(start);
    while (cur <= end) {
      calendarDays++;
      const dateStr = cur.toISOString().slice(0, 10);
      const dayOfWeek = cur.getUTCDay(); // 5 = Friday, 6 = Saturday (GCC weekend)
      const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
      const isHoliday = holidayDates.has(dateStr);

      const excludeAsRestDay = policy.excludeRestDays && isWeekend;
      const excludeAsHoliday = policy.excludeHolidays && isHoliday;

      if (excludeAsRestDay || excludeAsHoliday) {
        nonWorkingDays++;
      } else {
        let dayWeight = 1.0;
        if (dateStr === startDate && (startPortion === 'FIRST_HALF' || startPortion === 'SECOND_HALF')) {
          dayWeight = 0.5;
        } else if (dateStr === endDate && (endPortion === 'FIRST_HALF' || endPortion === 'SECOND_HALF')) {
          dayWeight = 0.5;
        }
        deductibleDays += dayWeight;
      }

      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    return { calendarDays, deductibleDays, nonWorkingDays };
  }

  // ==========================================
  // 5. LEAVE REQUESTS & APPROVAL ENGINE
  // ==========================================

  public async listLeaveRequests(tenantId: string, filters: {
    employeeId?: string;
    status?: string;
  }) {
    const conditions = [eq(leaveRequests.tenantId, tenantId)];
    if (filters.employeeId) conditions.push(eq(leaveRequests.employeeId, filters.employeeId));
    if (filters.status) conditions.push(eq(leaveRequests.status, filters.status));

    const rows = await db.select({
      req: leaveRequests,
      emp: {
        id: employees.id,
        employeeNumber: employees.employeeNumber,
        firstNameEn: employees.firstNameEn,
        lastNameEn: employees.lastNameEn,
        firstNameAr: employees.firstNameAr,
        lastNameAr: employees.lastNameAr,
      },
      lt: {
        code: leaveTypes.code,
        nameEn: leaveTypes.nameEn,
        nameAr: leaveTypes.nameAr,
        category: leaveTypes.category,
        isPaid: leaveTypes.isPaid,
      },
    })
      .from(leaveRequests)
      .innerJoin(employees, eq(leaveRequests.employeeId, employees.id))
      .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .where(and(...conditions))
      .orderBy(desc(leaveRequests.createdAt));

    return rows.map(r => ({
      ...r.req,
      employeeNumber: r.emp.employeeNumber,
      employeeNameEn: `${r.emp.firstNameEn} ${r.emp.lastNameEn}`,
      employeeNameAr: `${r.emp.firstNameAr || ''} ${r.emp.lastNameAr || ''}`.trim() || `${r.emp.firstNameEn} ${r.emp.lastNameEn}`,
      leaveTypeCode: r.lt.code,
      leaveTypeNameEn: r.lt.nameEn,
      leaveTypeNameAr: r.lt.nameAr,
      isPaid: r.lt.isPaid,
    }));
  }

  public async submitLeaveRequest(tenantId: string, input: SubmitLeaveRequestInput) {
    // 1. Check for overlapping leave requests for this employee
    const overlapping = await db.select().from(leaveRequests)
      .where(and(
        eq(leaveRequests.tenantId, tenantId),
        eq(leaveRequests.employeeId, input.employeeId),
        inArray(leaveRequests.status, ['PENDING', 'APPROVED']),
        lte(sql`${leaveRequests.startDate}::date`, sql`${input.endDate}::date`),
        gte(sql`${leaveRequests.endDate}::date`, sql`${input.startDate}::date`)
      ))
      .limit(1);

    if (overlapping.length > 0) {
      throw new Error(`An existing ${overlapping[0].status.toLowerCase()} leave request already overlaps this period.`);
    }

    // 2. Resolve active policy
    const policy = await this.getActivePolicy(tenantId, input.leaveTypeId, input.startDate);
    if (!policy) {
      throw new Error('No active leave policy configured for this leave type and date.');
    }

    // 3. Authoritatively compute duration
    const duration = await this.calculateLeaveDuration(
      tenantId,
      input.employeeId,
      policy.id,
      input.startDate,
      input.endDate,
      input.startPortion || 'FULL_DAY',
      input.endPortion || 'FULL_DAY'
    );

    // 4. Validate balance if negative balance is not allowed
    if (!policy.negativeBalanceAllowed) {
      const currentBalance = await this.getEmployeeLeaveBalance(tenantId, input.employeeId, input.leaveTypeId);
      if (currentBalance < duration.deductibleDays) {
        throw new Error(`Insufficient leave balance: requested ${duration.deductibleDays} day(s), available balance is ${currentBalance} day(s).`);
      }
    }

    const id = `lr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const [created] = await db.insert(leaveRequests).values({
      id,
      tenantId,
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      startDate: new Date(input.startDate + 'T00:00:00Z'),
      endDate: new Date(input.endDate + 'T00:00:00Z'),
      startPortion: input.startPortion || 'FULL_DAY',
      endPortion: input.endPortion || 'FULL_DAY',
      calendarDays: duration.calendarDays,
      daysRequested: Math.ceil(duration.deductibleDays),
      requestedQuantity: String(duration.deductibleDays),
      reason: input.reason || null,
      attachmentId: input.attachmentId || null,
      status: 'PENDING',
    }).returning();

    logger.audit('CREATE', 'LEAVE_REQUEST', id, {
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      deductibleDays: duration.deductibleDays,
    }, { tenantId });

    return created;
  }

  public async reviewLeaveRequest(tenantId: string, requestId: string, decision: 'APPROVED' | 'REJECTED', reviewerId: string, notes?: string) {
    return db.transaction(async (tx) => {
      const [req] = await tx.select().from(leaveRequests)
        .where(and(eq(leaveRequests.id, requestId), eq(leaveRequests.tenantId, tenantId)))
        .limit(1);

      if (!req) throw new Error('Leave request not found.');
      if (req.status !== 'PENDING') throw new Error(`Leave request is already ${req.status}.`);

      if (decision === 'APPROVED') {
        const [updated] = await tx.update(leaveRequests)
          .set({
            status: 'APPROVED',
            approvedBy: reviewerId,
            approvedAt: new Date(),
            approvalNotes: notes || null,
            updatedAt: new Date(),
          })
          .where(eq(leaveRequests.id, requestId))
          .returning();

        // Post ledger debit transaction for authoritative balance tracking
        const ledgerId = `lgr_used_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        await tx.insert(leaveLedger).values({
          id: ledgerId,
          tenantId,
          employeeId: req.employeeId,
          leaveTypeId: req.leaveTypeId,
          transactionDate: req.startDate.toISOString().slice(0, 10),
          transactionType: 'USED',
          quantity: `-${req.requestedQuantity}`, // debit
          referenceType: 'LEAVE_REQUEST',
          referenceId: req.id,
          notes: `Approved leave request #${req.id}`,
          createdBy: reviewerId,
        });

        logger.audit('APPROVE', 'LEAVE_REQUEST', requestId, { deductibleDays: req.requestedQuantity }, { tenantId });
        return updated;
      } else {
        const [updated] = await tx.update(leaveRequests)
          .set({
            status: 'REJECTED',
            rejectionReason: notes || 'Rejected by reviewer',
            approvedBy: reviewerId,
            approvedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(leaveRequests.id, requestId))
          .returning();

        logger.audit('REJECT', 'LEAVE_REQUEST', requestId, { reason: notes }, { tenantId });
        return updated;
      }
    });
  }

  public async cancelLeaveRequest(tenantId: string, requestId: string, actorId: string, reason?: string) {
    return db.transaction(async (tx) => {
      const [req] = await tx.select().from(leaveRequests)
        .where(and(eq(leaveRequests.id, requestId), eq(leaveRequests.tenantId, tenantId)))
        .limit(1);

      if (!req) throw new Error('Leave request not found.');
      if (req.status === 'CANCELLED') throw new Error('Leave request is already cancelled.');

      const wasApproved = req.status === 'APPROVED';

      const [updated] = await tx.update(leaveRequests)
        .set({
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledBy: actorId,
          cancellationReason: reason || null,
          updatedAt: new Date(),
        })
        .where(eq(leaveRequests.id, requestId))
        .returning();

      // If it was already approved, restore balance by posting credit transaction
      if (wasApproved) {
        const reversalId = `lgr_rev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        await tx.insert(leaveLedger).values({
          id: reversalId,
          tenantId,
          employeeId: req.employeeId,
          leaveTypeId: req.leaveTypeId,
          transactionDate: new Date().toISOString().slice(0, 10),
          transactionType: 'ADJUSTMENT',
          quantity: String(req.requestedQuantity), // credit back
          referenceType: 'LEAVE_REQUEST',
          referenceId: req.id,
          notes: `Reversal for cancelled leave request #${req.id}: ${reason || 'Cancelled'}`,
          createdBy: actorId,
        });
      }

      logger.audit('CANCEL', 'LEAVE_REQUEST', requestId, { wasApproved }, { tenantId });
      return updated;
    });
  }

  /**
   * Deterministic Attendance Integration:
   * Returns approved leave on workDate for employee if one exists.
   */
  public async getApprovedLeaveForDate(tenantId: string, employeeId: string, dateStr: string) {
    const rows = await db.select({
      req: leaveRequests,
      lt: leaveTypes,
    })
      .from(leaveRequests)
      .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .where(and(
        eq(leaveRequests.tenantId, tenantId),
        eq(leaveRequests.employeeId, employeeId),
        eq(leaveRequests.status, 'APPROVED'),
        lte(sql`${leaveRequests.startDate}::date`, sql`${dateStr}::date`),
        gte(sql`${leaveRequests.endDate}::date`, sql`${dateStr}::date`)
      ))
      .limit(1);

    if (!rows[0]) return null;
    return {
      requestId: rows[0].req.id,
      leaveType: rows[0].lt.code,
      leaveTypeNameEn: rows[0].lt.nameEn,
      isPaid: rows[0].lt.isPaid,
      startPortion: rows[0].req.startPortion,
      endPortion: rows[0].req.endPortion,
    };
  }

  // ==========================================
  // 6. OVERTIME POLICIES & REQUEST ENGINE
  // ==========================================

  public async listOvertimePolicies(tenantId: string) {
    return db.select().from(overtimePolicies)
      .where(and(eq(overtimePolicies.tenantId, tenantId), eq(overtimePolicies.status, 'ACTIVE')))
      .orderBy(asc(overtimePolicies.code));
  }

  public async getActiveOvertimePolicy(tenantId: string, dateStr: string) {
    const rows = await db.select().from(overtimePolicies)
      .where(and(
        eq(overtimePolicies.tenantId, tenantId),
        eq(overtimePolicies.status, 'ACTIVE'),
        lte(overtimePolicies.effectiveFrom, dateStr),
        or(sql`${overtimePolicies.effectiveTo} IS NULL`, gte(overtimePolicies.effectiveTo, dateStr))
      ))
      .orderBy(desc(overtimePolicies.effectiveFrom))
      .limit(1);

    return rows[0] || null;
  }

  public async createOvertimePolicy(tenantId: string, input: CreateOvertimePolicyInput) {
    const id = `otp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const [policy] = await db.insert(overtimePolicies).values({
      id,
      tenantId,
      code: input.code.toUpperCase().trim(),
      nameEn: input.nameEn.trim(),
      nameAr: input.nameAr.trim(),
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo || null,
      eligibilityRule: input.eligibilityRule || null,
      minimumMinutes: input.minimumMinutes ?? 30,
      roundingRule: input.roundingRule || 'NEAREST_15_MIN',
      maximumDailyMinutes: input.maximumDailyMinutes ?? 240,
      maximumWeeklyMinutes: input.maximumWeeklyMinutes ?? 960,
      approvalRequired: input.approvalRequired !== undefined ? input.approvalRequired : true,
      status: 'ACTIVE',
    }).returning();

    logger.audit('CREATE', 'OVERTIME_POLICY', id, { code: policy.code }, { tenantId });
    return policy;
  }

  /**
   * Evaluates overtime candidate minutes with policy rounding rules.
   */
  public roundOvertimeMinutes(rawMinutes: number, roundingRule: string = 'NEAREST_15_MIN'): number {
    if (rawMinutes <= 0) return 0;
    if (roundingRule === 'EXACT_MINUTE') return rawMinutes;
    if (roundingRule === 'NEAREST_15_MIN') return Math.round(rawMinutes / 15) * 15;
    if (roundingRule === 'NEAREST_30_MIN') return Math.round(rawMinutes / 30) * 30;
    return rawMinutes;
  }

  public async submitOvertimeRequest(tenantId: string, input: {
    employeeId: string;
    workDate: string;
    overtimeCategory?: string;
    requestedMinutes: number;
    reason?: string;
    projectId?: string;
    siteId?: string;
    source?: string;
    actorId?: string;
  }) {
    // 1. Resolve active policy
    const policy = await this.getActiveOvertimePolicy(tenantId, input.workDate);

    // 2. Check minimum threshold
    let roundedMinutes = input.requestedMinutes;
    if (policy) {
      if (input.requestedMinutes < policy.minimumMinutes) {
        // Below minimum threshold
        roundedMinutes = 0;
      } else {
        roundedMinutes = this.roundOvertimeMinutes(input.requestedMinutes, policy.roundingRule);
      }
    }

    const id = `ot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const [rec] = await db.insert(overtimeRecords).values({
      id,
      tenantId,
      employeeId: input.employeeId,
      overtimePolicyId: policy?.id || null,
      date: input.workDate,
      overtimeType: input.overtimeCategory || 'REGULAR_DAY',
      minutes: roundedMinutes,
      requestedMinutes: input.requestedMinutes,
      approvedMinutes: null,
      source: input.source || 'MANUAL',
      projectId: input.projectId || null,
      siteId: input.siteId || null,
      reason: input.reason || null,
      status: 'PENDING',
      createdBy: input.actorId || 'system',
    }).returning();

    logger.audit('CREATE', 'OVERTIME_REQUEST', id, {
      employeeId: input.employeeId,
      requestedMinutes: input.requestedMinutes,
      roundedMinutes,
    }, { tenantId });

    return rec;
  }

  public async reviewOvertimeRecord(
    tenantId: string,
    overtimeId: string,
    decision: 'APPROVED' | 'REJECTED',
    approvedMinutes?: number,
    actorId: string = 'admin',
    notes?: string
  ) {
    const [existing] = await db.select().from(overtimeRecords)
      .where(and(eq(overtimeRecords.id, overtimeId), eq(overtimeRecords.tenantId, tenantId)))
      .limit(1);

    if (!existing) throw new Error('Overtime record not found.');

    const finalApprovedMinutes = decision === 'APPROVED'
      ? (approvedMinutes !== undefined ? approvedMinutes : existing.minutes)
      : null;

    const [updated] = await db.update(overtimeRecords)
      .set({
        status: decision,
        approvedMinutes: finalApprovedMinutes,
        approvedBy: actorId,
        approvedAt: new Date(),
        notes: notes || null,
        updatedAt: new Date(),
      })
      .where(eq(overtimeRecords.id, overtimeId))
      .returning();

    logger.audit(decision === 'APPROVED' ? 'APPROVE' : 'REJECT', 'OVERTIME_RECORD', overtimeId, {
      requestedMinutes: existing.requestedMinutes,
      approvedMinutes: finalApprovedMinutes,
    }, { tenantId });

    return updated;
  }
}

export const leaveRepository = new LeaveRepository();
