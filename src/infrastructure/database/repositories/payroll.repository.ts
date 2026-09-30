/**
 * GulfHive ERP - Authoritative Production Payroll Module Repository
 * Deterministic batch payroll processing, configurable salary components,
 * salary structures, periods, granular result lines, approval & posting workflows,
 * loan repayment transactions, EOSB settlements, WPS/SIF exports, and PDF payslips.
 */

import crypto from 'crypto';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { db } from '../../../db/index.ts';
import {
  payrollPeriods,
  salaryComponents,
  salaryStructures,
  salaryStructureComponents,
  payrollRuns,
  payrollItems,
  payrollResultLines,
  payrollAdjustments,
  loanRepaymentTransactions,
  payrollExceptions,
  employeeLoans,
  finalSettlements,
  employees,
  employeeSalaries,
  employeeBankDetails,
  employeeContracts,
  overtimeRecords,
  leaveRequests,
  approvalWorkflows,
  tenants,
  auditLogs,
} from '../../../db/schema.ts';
import { Money } from '../../../core/domain/money.ts';
import { PayrollCalculator } from '../../../modules/payroll/engine/payroll-calculator.ts';
import { PayrollValidatorService } from '../../../services/payroll/payroll-validator.service.ts';
import { numberingRepository } from './numbering.repository.ts';
import { PayslipPdfService, PayslipPdfData } from '../../../services/payroll/payslip-pdf.service.ts';
import { logger } from '../../../core/logging/logger.ts';

export class PayrollRepository {
  // ==========================================
  // 1. PAYROLL PERIODS
  // ==========================================

  public async listPayrollPeriods(tenantId: string) {
    return db
      .select()
      .from(payrollPeriods)
      .where(eq(payrollPeriods.tenantId, tenantId))
      .orderBy(desc(payrollPeriods.year), desc(payrollPeriods.month));
  }

  public async getPayrollPeriod(tenantId: string, periodId: string) {
    const [period] = await db
      .select()
      .from(payrollPeriods)
      .where(and(eq(payrollPeriods.tenantId, tenantId), eq(payrollPeriods.id, periodId)))
      .limit(1);
    return period || null;
  }

  public async createPayrollPeriod(tenantId: string, input: {
    year: number;
    month: number;
    periodStart: string;
    periodEnd: string;
    paymentDate?: string;
    actorId?: string;
  }) {
    // Validate period date logic
    if (new Date(input.periodEnd) < new Date(input.periodStart)) {
      throw new Error('Period end date cannot precede period start date.');
    }

    // Check if period already exists
    const [existing] = await db
      .select()
      .from(payrollPeriods)
      .where(and(
        eq(payrollPeriods.tenantId, tenantId),
        eq(payrollPeriods.year, input.year),
        eq(payrollPeriods.month, input.month)
      ))
      .limit(1);

    if (existing) {
      throw new Error(`Payroll period for ${input.year}-${String(input.month).padStart(2, '0')} already exists.`);
    }

    const periodNumber = `PRD-${input.year}-${String(input.month).padStart(2, '0')}`;
    const id = `prd_${input.year}_${input.month}_${Date.now()}`;

    const [created] = await db
      .insert(payrollPeriods)
      .values({
        id,
        tenantId,
        periodNumber,
        year: input.year,
        month: input.month,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        paymentDate: input.paymentDate || null,
        status: 'OPEN',
        createdBy: input.actorId || 'system',
        updatedBy: input.actorId || 'system',
      })
      .returning();

    logger.audit('CREATE', 'PAYROLL_PERIOD', id, { periodNumber, year: input.year, month: input.month }, { tenantId });
    return created;
  }

  public async updatePayrollPeriodStatus(tenantId: string, periodId: string, newStatus: string, actorId = 'system') {
    const validTransitions: Record<string, string[]> = {
      OPEN: ['PROCESSING'],
      PROCESSING: ['REVIEW', 'OPEN'],
      REVIEW: ['AWAITING_APPROVAL', 'PROCESSING'],
      AWAITING_APPROVAL: ['APPROVED', 'REVIEW'],
      APPROVED: ['POSTED', 'REVIEW'],
      POSTED: ['PAID', 'APPROVED'],
      PAID: ['CLOSED'],
      CLOSED: [],
    };

    const [period] = await db
      .select()
      .from(payrollPeriods)
      .where(and(eq(payrollPeriods.tenantId, tenantId), eq(payrollPeriods.id, periodId)))
      .limit(1);

    if (!period) throw new Error('Payroll period not found.');

    const allowed = validTransitions[period.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Invalid period transition from ${period.status} to ${newStatus}.`);
    }

    const [updated] = await db
      .update(payrollPeriods)
      .set({
        status: newStatus,
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(eq(payrollPeriods.id, periodId))
      .returning();

    logger.audit('UPDATE_STATUS', 'PAYROLL_PERIOD', periodId, { from: period.status, to: newStatus }, { tenantId });
    return updated;
  }

  // ==========================================
  // 2. CONFIGURABLE SALARY COMPONENTS
  // ==========================================

  public async listSalaryComponents(tenantId: string) {
    let components = await db
      .select()
      .from(salaryComponents)
      .where(eq(salaryComponents.tenantId, tenantId))
      .orderBy(asc(salaryComponents.displayOrder), asc(salaryComponents.code));

    if (components.length === 0) {
      await this.seedDefaultSalaryComponents(tenantId);
      components = await db
        .select()
        .from(salaryComponents)
        .where(eq(salaryComponents.tenantId, tenantId))
        .orderBy(asc(salaryComponents.displayOrder), asc(salaryComponents.code));
    }

    return components;
  }

  public async seedDefaultSalaryComponents(tenantId: string) {
    const defaults = [
      { code: 'BASIC', nameEn: 'Basic Salary', nameAr: 'الراتب الأساسي', type: 'EARNING', calc: 'FIXED', order: 1, gross: true, net: true, ot: true, eos: true },
      { code: 'HOUSING', nameEn: 'Housing Allowance', nameAr: 'بدل السكن', type: 'EARNING', calc: 'FIXED', order: 2, gross: true, net: true, ot: false, eos: false },
      { code: 'TRANSPORT', nameEn: 'Transport Allowance', nameAr: 'بدل النقل', type: 'EARNING', calc: 'FIXED', order: 3, gross: true, net: true, ot: false, eos: false },
      { code: 'FOOD', nameEn: 'Food Allowance', nameAr: 'بدل الطعام', type: 'EARNING', calc: 'FIXED', order: 4, gross: true, net: true, ot: false, eos: false },
      { code: 'OVERTIME', nameEn: 'Approved Overtime', nameAr: 'العمل الإضافي المعتمد', type: 'EARNING', calc: 'FORMULA', order: 5, gross: true, net: true, ot: false, eos: false },
      { code: 'BONUS', nameEn: 'Performance Bonus', nameAr: 'مكافأة أداء', type: 'EARNING', calc: 'INPUT', order: 6, gross: true, net: true, ot: false, eos: false },
      { code: 'COMMISSION', nameEn: 'Sales Commission', nameAr: 'عمولة مبيعات', type: 'EARNING', calc: 'INPUT', order: 7, gross: true, net: true, ot: false, eos: false },
      { code: 'UNPAID_LEAVE', nameEn: 'Unpaid Absence Deduction', nameAr: 'استقطاع غياب غير مدفوع', type: 'DEDUCTION', calc: 'FORMULA', order: 8, gross: false, net: true, ot: false, eos: false },
      { code: 'LOAN', nameEn: 'Loan Installment Recovery', nameAr: 'قسط سلفة وقرض', type: 'DEDUCTION', calc: 'INPUT', order: 9, gross: false, net: true, ot: false, eos: false },
      { code: 'PENALTY', nameEn: 'Disciplinary Penalty', nameAr: 'جزاء انضباطي', type: 'DEDUCTION', calc: 'INPUT', order: 10, gross: false, net: true, ot: false, eos: false },
      { code: 'PIFSS_EMP', nameEn: 'PIFSS Social Insurance (Employee)', nameAr: 'تأمينات اجتماعية (حصة الموظف)', type: 'DEDUCTION', calc: 'FORMULA', order: 11, gross: false, net: true, ot: false, eos: false },
      { code: 'PIFSS_EMPLYR', nameEn: 'PIFSS Social Insurance (Employer)', nameAr: 'تأمينات اجتماعية (حصة صاحب العمل)', type: 'EMPLOYER_CONTRIBUTION', calc: 'FORMULA', order: 12, gross: false, net: false, ot: false, eos: false },
    ];

    for (const d of defaults) {
      const id = `sc_${d.code.toLowerCase()}_${Date.now()}`;
      await db.insert(salaryComponents).values({
        id,
        tenantId,
        code: d.code,
        nameEn: d.nameEn,
        nameAr: d.nameAr,
        componentType: d.type as any,
        calculationType: d.calc as any,
        affectsGross: d.gross,
        affectsNet: d.net,
        affectsOvertimeBase: d.ot,
        affectsEosBase: d.eos,
        displayOrder: d.order,
        status: 'ACTIVE',
      }).onConflictDoNothing();
    }
  }

  public async createSalaryComponent(tenantId: string, input: {
    code: string;
    nameEn: string;
    nameAr: string;
    componentType: 'EARNING' | 'DEDUCTION' | 'EMPLOYER_CONTRIBUTION' | 'INFORMATION';
    calculationType: 'FIXED' | 'PERCENTAGE' | 'FORMULA' | 'INPUT';
    formulaExpression?: string;
    affectsGross?: boolean;
    affectsNet?: boolean;
    affectsOvertimeBase?: boolean;
    affectsEosBase?: boolean;
    displayOrder?: number;
  }) {
    const code = input.code.toUpperCase().trim();
    const id = `sc_${code.toLowerCase()}_${Date.now()}`;

    const [inserted] = await db.insert(salaryComponents).values({
      id,
      tenantId,
      code,
      nameEn: input.nameEn.trim(),
      nameAr: input.nameAr.trim(),
      componentType: input.componentType,
      calculationType: input.calculationType,
      formulaExpression: input.formulaExpression || null,
      affectsGross: input.affectsGross ?? true,
      affectsNet: input.affectsNet ?? true,
      affectsOvertimeBase: input.affectsOvertimeBase ?? false,
      affectsEosBase: input.affectsEosBase ?? false,
      displayOrder: input.displayOrder || 0,
      status: 'ACTIVE',
    }).returning();

    logger.audit('CREATE', 'SALARY_COMPONENT', id, { code }, { tenantId });
    return inserted;
  }

  // ==========================================
  // 3. SALARY STRUCTURES
  // ==========================================

  public async listSalaryStructures(tenantId: string) {
    return db
      .select()
      .from(salaryStructures)
      .where(eq(salaryStructures.tenantId, tenantId))
      .orderBy(asc(salaryStructures.code));
  }

  public async createSalaryStructure(tenantId: string, input: {
    code: string;
    nameEn: string;
    nameAr: string;
    effectiveFrom: string;
    effectiveTo?: string;
    components: Array<{
      salaryComponentId: string;
      calculationMethod: 'FIXED' | 'PERCENTAGE' | 'FORMULA';
      valueExpression: string;
      displayOrder?: number;
    }>;
  }) {
    return db.transaction(async (tx) => {
      const code = input.code.toUpperCase().trim();
      const id = `str_${code.toLowerCase()}_${Date.now()}`;

      const [structure] = await tx.insert(salaryStructures).values({
        id,
        tenantId,
        code,
        nameEn: input.nameEn.trim(),
        nameAr: input.nameAr.trim(),
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo || null,
        status: 'ACTIVE',
      }).returning();

      if (input.components && input.components.length > 0) {
        for (let idx = 0; idx < input.components.length; idx++) {
          const comp = input.components[idx];
          const scId = `ssc_${id}_${idx + 1}`;
          await tx.insert(salaryStructureComponents).values({
            id: scId,
            salaryStructureId: id,
            salaryComponentId: comp.salaryComponentId,
            calculationMethod: comp.calculationMethod,
            valueExpression: comp.valueExpression,
            displayOrder: comp.displayOrder ?? idx + 1,
          });
        }
      }

      logger.audit('CREATE', 'SALARY_STRUCTURE', id, { code }, { tenantId });
      return structure;
    });
  }

  // ==========================================
  // 4. PAYROLL ADJUSTMENTS
  // ==========================================

  public async listAdjustments(tenantId: string, employeeId?: string, periodId?: string) {
    const conditions = [eq(payrollAdjustments.tenantId, tenantId)];
    if (employeeId) conditions.push(eq(payrollAdjustments.employeeId, employeeId));
    if (periodId) conditions.push(eq(payrollAdjustments.payrollPeriodId, periodId));

    return db
      .select({
        id: payrollAdjustments.id,
        tenantId: payrollAdjustments.tenantId,
        employeeId: payrollAdjustments.employeeId,
        employeeNumber: employees.employeeNumber,
        employeeNameEn: sql<string>`concat(${employees.firstNameEn}, ' ', ${employees.lastNameEn})`,
        type: payrollAdjustments.type,
        amount: payrollAdjustments.amount,
        quantity: payrollAdjustments.quantity,
        reason: payrollAdjustments.reason,
        status: payrollAdjustments.status,
        effectiveDate: payrollAdjustments.effectiveDate,
        createdAt: payrollAdjustments.createdAt,
      })
      .from(payrollAdjustments)
      .innerJoin(employees, eq(payrollAdjustments.employeeId, employees.id))
      .where(and(...conditions))
      .orderBy(desc(payrollAdjustments.createdAt));
  }

  public async createAdjustment(tenantId: string, input: {
    employeeId: string;
    payrollPeriodId?: string;
    type: 'BONUS' | 'COMMISSION' | 'CORRECTION' | 'REIMBURSEMENT' | 'DEDUCTION' | 'PENALTY' | 'OTHER';
    amount: string;
    quantity?: string;
    reason: string;
    effectiveDate: string;
    createdBy?: string;
  }) {
    const id = `adj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const [adj] = await db.insert(payrollAdjustments).values({
      id,
      tenantId,
      employeeId: input.employeeId,
      payrollPeriodId: input.payrollPeriodId || null,
      type: input.type,
      amount: input.amount,
      quantity: input.quantity || null,
      reason: input.reason.trim(),
      status: 'APPROVED', // Default approved for direct batch inclusion
      effectiveDate: input.effectiveDate,
      createdBy: input.createdBy || 'system',
    }).returning();

    logger.audit('CREATE', 'PAYROLL_ADJUSTMENT', id, { employeeId: input.employeeId, type: input.type, amount: input.amount }, { tenantId });
    return adj;
  }

  // ==========================================
  // 5. PAYROLL RUNS (BATCH CALCULATION ENGINE)
  // ==========================================

  public async listPayrollRuns(tenantId: string) {
    return db.select().from(payrollRuns)
      .where(eq(payrollRuns.tenantId, tenantId))
      .orderBy(desc(payrollRuns.periodYear), desc(payrollRuns.periodMonth));
  }

  public async getPayrollRun(tenantId: string, runId: string) {
    const [run] = await db.select().from(payrollRuns)
      .where(and(eq(payrollRuns.tenantId, tenantId), eq(payrollRuns.id, runId)))
      .limit(1);

    if (!run) return null;

    const items = await db.select({
      id: payrollItems.id,
      payrollRunId: payrollItems.payrollRunId,
      employeeId: payrollItems.employeeId,
      employeeNumber: employees.employeeNumber,
      employeeNameEn: sql<string>`concat(${employees.firstNameEn}, ' ', ${employees.lastNameEn})`,
      employeeNameAr: sql<string>`concat(${employees.firstNameAr}, ' ', ${employees.lastNameAr})`,
      currency: payrollItems.currency,
      basicSalary: payrollItems.basicSalary,
      housingAllowance: payrollItems.housingAllowance,
      transportAllowance: payrollItems.transportAllowance,
      otherAllowances: payrollItems.otherAllowances,
      overtimeAmount: payrollItems.overtimeAmount,
      overtimeHours: payrollItems.overtimeHours,
      unpaidLeaveDeduction: payrollItems.unpaidLeaveDeduction,
      unpaidLeaveDays: payrollItems.unpaidLeaveDays,
      loanDeduction: payrollItems.loanDeduction,
      statutoryEmployeeContribution: payrollItems.statutoryEmployeeContribution,
      statutoryEmployerContribution: payrollItems.statutoryEmployerContribution,
      grossPay: payrollItems.grossPay,
      totalDeductions: payrollItems.totalDeductions,
      netPay: payrollItems.netPay,
      bankName: payrollItems.bankName,
      iban: payrollItems.iban,
      exceptionCount: payrollItems.exceptionCount,
      calculationBreakdown: payrollItems.calculationBreakdown,
    })
      .from(payrollItems)
      .innerJoin(employees, eq(payrollItems.employeeId, employees.id))
      .where(and(eq(payrollItems.tenantId, tenantId), eq(payrollItems.payrollRunId, runId)))
      .orderBy(asc(employees.employeeNumber));

    // Fetch result lines
    const lines = await db.select()
      .from(payrollResultLines)
      .where(and(eq(payrollResultLines.tenantId, tenantId), eq(payrollResultLines.payrollRunId, runId)))
      .orderBy(asc(payrollResultLines.displayOrder));

    // Fetch exceptions
    const exceptions = await db.select()
      .from(payrollExceptions)
      .where(and(eq(payrollExceptions.tenantId, tenantId), eq(payrollExceptions.payrollRunId, runId)))
      .orderBy(asc(payrollExceptions.severity));

    return { ...run, items, lines, exceptions };
  }

  public async calculateAndCreatePayrollRun(
    tenantId: string,
    month: number,
    year: number,
    actorId: string,
    runType: 'REGULAR' | 'SUPPLEMENTARY' | 'ADJUSTMENT' | 'FINAL_SETTLEMENT' = 'REGULAR'
  ) {
    return db.transaction(async (tx) => {
      // 1. Fetch tenant company info
      const [tenant] = await tx.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
      if (!tenant) throw new Error('Tenant company not found.');

      const currency = tenant.baseCurrency || 'KWD';
      const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
      const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const endDate = new Date(Date.UTC(year, month - 1, daysInMonth, 23, 59, 59));

      // 2. Prevent duplicate approved/posted payroll
      const existing = await tx.select().from(payrollRuns)
        .where(and(
          eq(payrollRuns.tenantId, tenantId),
          eq(payrollRuns.periodMonth, month),
          eq(payrollRuns.periodYear, year),
          eq(payrollRuns.runType, runType)
        ))
        .limit(1);

      if (existing.length > 0 && ['APPROVED', 'POSTED', 'PAID'].includes(existing[0].status)) {
        throw new Error(`Approved or posted payroll run for ${year}-${month} cannot be overwritten.`);
      }

      // Check or generate period reference
      const [period] = await tx.select().from(payrollPeriods)
        .where(and(
          eq(payrollPeriods.tenantId, tenantId),
          eq(payrollPeriods.year, year),
          eq(payrollPeriods.month, month)
        ))
        .limit(1);

      const payrollPeriodId = period?.id || null;

      // Human-facing reference via centralized Numbering Engine
      let payrollNumber = existing.length > 0 && existing[0].payrollNumber
        ? existing[0].payrollNumber
        : await numberingRepository.generateNextNumber(tenantId, 'PAYROLL');

      const runId = existing.length > 0 ? existing[0].id : `pr_${year}_${month}_${Date.now()}`;

      // Clean old draft items, result lines, and exceptions if recalculating
      if (existing.length > 0) {
        await tx.delete(payrollResultLines).where(eq(payrollResultLines.payrollRunId, runId));
        await tx.delete(payrollExceptions).where(eq(payrollExceptions.payrollRunId, runId));
        await tx.delete(payrollItems).where(eq(payrollItems.payrollRunId, runId));
      }

      // 3. Select eligible active employees
      const activeEmployees = await tx.select().from(employees)
        .where(and(
          eq(employees.tenantId, tenantId),
          eq(employees.employmentStatus, 'ACTIVE')
        ));

      // 4. Pre-load salary, bank, contracts, loans, overtime, leave, adjustments
      const allSalaries = await tx.select().from(employeeSalaries)
        .where(and(eq(employeeSalaries.tenantId, tenantId), eq(employeeSalaries.isActive, true)));
      const salariesMap = new Map(allSalaries.map((s) => [s.employeeId, s]));

      const allBanks = await tx.select().from(employeeBankDetails)
        .where(and(eq(employeeBankDetails.tenantId, tenantId), eq(employeeBankDetails.isPrimary, true)));
      const banksMap = new Map(allBanks.map((b) => [b.employeeId, b]));

      const allContracts = await tx.select().from(employeeContracts)
        .where(and(eq(employeeContracts.tenantId, tenantId), eq(employeeContracts.status, 'ACTIVE')));
      const contractsMap = new Map(allContracts.map((c) => [c.employeeId, c]));

      // Pre-calculation validation check
      const preValidation = PayrollValidatorService.validatePreCalculation({
        employees: activeEmployees,
        salariesMap,
        contractsMap,
        bankDetailsMap: banksMap,
      });

      let totalGrossSubunits = 0n;
      let totalDeductionsSubunits = 0n;
      let totalNetSubunits = 0n;

      const calculatedItems: any[] = [];
      const batchResultLines: any[] = [];
      const exceptionRecords: any[] = [];

      for (const emp of activeEmployees) {
        const salary = salariesMap.get(emp.id);
        const bank = banksMap.get(emp.id);

        // Fetch active loan
        const [loan] = await tx.select().from(employeeLoans)
          .where(and(eq(employeeLoans.employeeId, emp.id), eq(employeeLoans.status, 'ACTIVE')))
          .limit(1);

        // Sum approved overtime minutes for this employee in this month
        const datePrefix = `${year}-${String(month).padStart(2, '0')}`;
        const otRecords = await tx.select().from(overtimeRecords)
          .where(and(
            eq(overtimeRecords.employeeId, emp.id),
            eq(overtimeRecords.status, 'APPROVED'),
            sql`${overtimeRecords.date} LIKE ${datePrefix + '%'}`
          ));
        const totalOtMins = otRecords.reduce((sum, r) => sum + r.minutes, 0);

        // Sum unpaid leave days in this month
        const unpaidLeaves = await tx.select().from(leaveRequests)
          .where(and(
            eq(leaveRequests.employeeId, emp.id),
            eq(leaveRequests.status, 'APPROVED'),
            sql`${leaveRequests.startDate} >= ${startDate} AND ${leaveRequests.endDate} <= ${endDate}`
          ));
        const unpaidDays = unpaidLeaves.reduce((sum, l) => sum + l.daysRequested, 0);

        // Fetch approved adjustments for this employee in this period
        const adjustments = await tx.select().from(payrollAdjustments)
          .where(and(
            eq(payrollAdjustments.employeeId, emp.id),
            eq(payrollAdjustments.status, 'APPROVED')
          ));

        // Check joining date proration (if joined mid-month)
        let prorationFactor = 1.0;
        const joinDate = new Date(emp.joiningDate);
        if (joinDate > startDate && joinDate <= endDate) {
          const daysWorked = daysInMonth - joinDate.getUTCDate() + 1;
          prorationFactor = Math.max(0, daysWorked / daysInMonth);
        }

        // Calculate using deterministic engine
        const calculated = PayrollCalculator.calculate({
          employeeId: emp.id,
          employeeNumber: emp.employeeNumber,
          nameEn: `${emp.firstNameEn} ${emp.lastNameEn}`,
          nameAr: `${emp.firstNameAr} ${emp.lastNameAr}`,
          nationality: emp.nationality,
          countryCode: tenant.countryCode,
          baseCurrency: currency,
          basicSalary: salary?.basicSalary || '0.000',
          housingAllowance: salary?.housingAllowance || '0.000',
          transportAllowance: salary?.transportAllowance || '0.000',
          otherAllowances: salary?.otherAllowances || '0.000',
          overtimeMinutes: totalOtMins,
          unpaidLeaveDays: unpaidDays,
          loanMonthlyInstallment: loan?.monthlyInstallment || '0.000',
          loanRemainingBalance: loan?.remainingBalance || '0.000',
          adjustments: adjustments.map((a) => ({ id: a.id, type: a.type, amount: a.amount, reason: a.reason })),
          prorationFactor,
          bankName: bank?.bankName,
          iban: bank?.iban,
          accountNumber: bank?.accountNumber,
          bankCode: bank?.bankCode || undefined,
        });

        const grossSubunits = Money.create(calculated.grossPay, currency).toSubunits();
        const dedSubunits = Money.create(calculated.totalDeductions, currency).toSubunits();
        const netSubunits = Money.create(calculated.netPay, currency).toSubunits();

        totalGrossSubunits += grossSubunits;
        totalDeductionsSubunits += dedSubunits;
        totalNetSubunits += netSubunits;

        const itemId = `pi_${runId}_${emp.id}`;

        calculatedItems.push({
          id: itemId,
          tenantId,
          payrollRunId: runId,
          employeeId: emp.id,
          currency,
          basicSalary: calculated.basicSalary,
          housingAllowance: calculated.housingAllowance,
          transportAllowance: calculated.transportAllowance,
          otherAllowances: calculated.otherAllowances,
          overtimeAmount: calculated.overtimeAmount,
          overtimeHours: calculated.overtimeHours,
          unpaidLeaveDeduction: calculated.unpaidLeaveDeduction,
          unpaidLeaveDays: calculated.unpaidLeaveDays,
          loanDeduction: calculated.loanDeduction,
          statutoryEmployeeContribution: calculated.statutoryEmployeeContribution,
          statutoryEmployerContribution: calculated.statutoryEmployerContribution,
          grossPay: calculated.grossPay,
          totalDeductions: calculated.totalDeductions,
          netPay: calculated.netPay,
          paymentMethod: 'WPS_BANK',
          bankName: calculated.bankName,
          iban: calculated.iban,
          exceptionCount: 0,
          calculationBreakdown: calculated.calculationBreakdown,
        });

        // Collect result lines
        calculated.resultLines.forEach((line) => {
          const uniqueKey = `${runId}_${emp.id}_${line.componentCode.toLowerCase()}`;
          const hash = crypto.createHash('md5').update(uniqueKey).digest('hex');
          batchResultLines.push({
            id: `prl_${hash}`,
            tenantId,
            payrollRunId: runId,
            payrollItemId: itemId,
            componentCodeSnapshot: line.componentCode,
            componentNameSnapshot: line.componentName,
            lineType: line.lineType,
            quantity: line.quantity || null,
            rate: line.rate || null,
            amount: line.amount,
            sourceType: line.sourceType,
            sourceId: line.sourceId || null,
            calculationRuleReference: line.calculationRuleReference || null,
            displayOrder: line.displayOrder,
          });
        });
      }

      // Post-calculation validation check
      const postValidation = PayrollValidatorService.validatePostCalculation(calculatedItems);

      // Collect all validation issues
      const allIssues = [...preValidation.issues, ...postValidation.issues];
      allIssues.forEach((issue, idx) => {
        exceptionRecords.push({
          id: `pex_${runId}_${idx + 1}`,
          tenantId,
          payrollRunId: runId,
          employeeId: issue.employeeId || null,
          severity: issue.severity,
          code: issue.code,
          messageEn: issue.messageEn,
          messageAr: issue.messageAr,
          isResolved: false,
        });
      });

      const totalGrossFormatted = Money.fromSubunits(totalGrossSubunits, currency).toDecimalString();
      const totalDedFormatted = Money.fromSubunits(totalDeductionsSubunits, currency).toDecimalString();
      const totalNetFormatted = Money.fromSubunits(totalNetSubunits, currency).toDecimalString();

      // Persist or Update Payroll Run
      if (existing.length > 0) {
        await tx.update(payrollRuns)
          .set({
            payrollPeriodId,
            payrollNumber,
            runType,
            totalEmployees: activeEmployees.length,
            totalGrossPay: totalGrossFormatted,
            totalDeductions: totalDedFormatted,
            totalNetPay: totalNetFormatted,
            status: 'DRAFT',
            ruleSnapshotVersion: '2026.1',
            calculationVersion: '2.0.0',
            updatedAt: new Date(),
          })
          .where(eq(payrollRuns.id, runId));
      } else {
        await tx.insert(payrollRuns).values({
          id: runId,
          tenantId,
          payrollPeriodId,
          payrollNumber,
          runType,
          periodMonth: month,
          periodYear: year,
          startDate,
          endDate,
          status: 'DRAFT',
          currency,
          totalEmployees: activeEmployees.length,
          totalGrossPay: totalGrossFormatted,
          totalDeductions: totalDedFormatted,
          totalNetPay: totalNetFormatted,
          ruleSnapshotVersion: '2026.1',
          calculationVersion: '2.0.0',
        });
      }

      // Insert Items
      if (calculatedItems.length > 0) {
        await tx.insert(payrollItems).values(calculatedItems);
      }

      // Insert Result Lines
      if (batchResultLines.length > 0) {
        await tx.insert(payrollResultLines).values(batchResultLines);
      }

      // Insert Exceptions
      if (exceptionRecords.length > 0) {
        await tx.insert(payrollExceptions).values(exceptionRecords);
      }

      // Record in unified approval workflow
      await tx.insert(approvalWorkflows).values({
        tenantId,
        entityType: 'PAYROLL_RUN',
        entityId: runId,
        action: 'SUBMITTED',
        actorId,
        comments: `Payroll generated (${payrollNumber}): ${activeEmployees.length} employees, Net: ${totalNetFormatted} ${currency}`,
      });

      logger.audit('CALCULATE_PAYROLL', 'PAYROLL_RUN', runId, {
        payrollNumber,
        totalEmployees: activeEmployees.length,
        totalNetPay: totalNetFormatted,
        exceptions: exceptionRecords.length,
      }, { tenantId });

      return {
        runId,
        payrollNumber,
        totalEmployees: activeEmployees.length,
        totalGrossPay: totalGrossFormatted,
        totalNetPay: totalNetFormatted,
        blockingExceptions: preValidation.blockingCount + postValidation.blockingCount,
        warnings: preValidation.warningCount + postValidation.warningCount,
      };
    });
  }

  // ==========================================
  // 6. VALIDATE, APPROVE & POST PAYROLL RUN
  // ==========================================

  public async validatePayrollRun(tenantId: string, runId: string) {
    const run = await this.getPayrollRun(tenantId, runId);
    if (!run) throw new Error('Payroll run not found.');

    const blockingExceptions = run.exceptions.filter((e) => e.severity === 'BLOCKING' && !e.isResolved);
    const warnings = run.exceptions.filter((e) => e.severity === 'WARNING' && !e.isResolved);

    if (blockingExceptions.length === 0) {
      await db.update(payrollRuns)
        .set({ status: 'VALIDATED', validatedAt: new Date(), updatedAt: new Date() })
        .where(eq(payrollRuns.id, runId));
    }

    return {
      isValid: blockingExceptions.length === 0,
      blockingExceptions,
      warnings,
    };
  }

  public async approvePayrollRun(tenantId: string, runId: string, approverId: string) {
    return db.transaction(async (tx) => {
      const [run] = await tx.select().from(payrollRuns)
        .where(and(eq(payrollRuns.tenantId, tenantId), eq(payrollRuns.id, runId)))
        .limit(1);

      if (!run) throw new Error('Payroll run not found.');
      if (['APPROVED', 'POSTED', 'PAID'].includes(run.status)) {
        throw new Error('Payroll run is already approved.');
      }

      // Check for unresolved blocking exceptions
      const blocking = await tx.select().from(payrollExceptions)
        .where(and(
          eq(payrollExceptions.payrollRunId, runId),
          eq(payrollExceptions.severity, 'BLOCKING'),
          eq(payrollExceptions.isResolved, false)
        ));

      if (blocking.length > 0) {
        throw new Error(`Cannot approve payroll: ${blocking.length} blocking exception(s) remain unresolved.`);
      }

      const [updated] = await tx.update(payrollRuns)
        .set({
          status: 'APPROVED',
          approvedBy: approverId,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(payrollRuns.id, runId))
        .returning();

      // Record in unified approval workflow
      await tx.insert(approvalWorkflows).values({
        tenantId,
        entityType: 'PAYROLL_RUN',
        entityId: runId,
        action: 'APPROVED',
        actorId: approverId,
        comments: `Payroll run ${run.payrollNumber || runId} approved. Net: ${run.totalNetPay} ${run.currency}`,
      });

      // Audit Log
      await tx.insert(auditLogs).values({
        tenantId,
        actorId: approverId,
        action: 'APPROVE_PAYROLL_RUN',
        entityType: 'PAYROLL_RUN',
        entityId: runId,
        resultingState: { status: 'APPROVED', approvedAt: new Date().toISOString() },
      });

      return updated;
    });
  }

  public async postPayrollRun(tenantId: string, runId: string, posterId: string) {
    return db.transaction(async (tx) => {
      const [run] = await tx.select().from(payrollRuns)
        .where(and(eq(payrollRuns.tenantId, tenantId), eq(payrollRuns.id, runId)))
        .limit(1);

      if (!run) throw new Error('Payroll run not found.');
      if (run.status !== 'APPROVED') {
        throw new Error('Only approved payroll runs can be posted.');
      }

      // Deduct loan installments and record loan repayment transactions atomically
      const items = await tx.select().from(payrollItems).where(eq(payrollItems.payrollRunId, runId));

      for (const item of items) {
        const loanDedM = Money.create(item.loanDeduction, item.currency);
        if (loanDedM.toSubunits() > 0n) {
          const [loan] = await tx.select().from(employeeLoans)
            .where(and(eq(employeeLoans.employeeId, item.employeeId), eq(employeeLoans.status, 'ACTIVE')))
            .limit(1);

          if (loan) {
            const currentBalM = Money.create(loan.remainingBalance, loan.currency);
            const totalPaidM = Money.create(loan.totalPaid, loan.currency);
            const newBalM = currentBalM.subtract(loanDedM);
            const newPaidM = totalPaidM.add(loanDedM);

            await tx.update(employeeLoans)
              .set({
                remainingBalance: newBalM.toDecimalString(),
                totalPaid: newPaidM.toDecimalString(),
                status: newBalM.toSubunits() === 0n ? 'REPAID' : 'ACTIVE',
              })
              .where(eq(employeeLoans.id, loan.id));

            // Insert loan repayment transaction
            const txId = `ltx_${runId}_${loan.id}`;
            await tx.insert(loanRepaymentTransactions).values({
              id: txId,
              tenantId,
              loanId: loan.id,
              payrollRunId: runId,
              payrollItemId: item.id,
              amount: loanDedM.toDecimalString(),
              remainingBalanceAfter: newBalM.toDecimalString(),
            });
          }
        }
      }

      const [posted] = await tx.update(payrollRuns)
        .set({
          status: 'POSTED',
          postedBy: posterId,
          postedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(payrollRuns.id, runId))
        .returning();

      logger.audit('POST_PAYROLL_RUN', 'PAYROLL_RUN', runId, { status: 'POSTED' }, { tenantId });
      return posted;
    });
  }

  public async reversePayrollRun(tenantId: string, runId: string, actorId: string, reason: string) {
    if (!reason || !reason.trim()) {
      throw new Error('Reversal reason is required.');
    }

    return db.transaction(async (tx) => {
      const [run] = await tx.select().from(payrollRuns)
        .where(and(eq(payrollRuns.tenantId, tenantId), eq(payrollRuns.id, runId)))
        .limit(1);

      if (!run) throw new Error('Payroll run not found.');
      if (run.status === 'REVERSED') {
        throw new Error('Payroll run is already reversed.');
      }

      // If posted, reverse loan repayment transactions
      if (run.status === 'POSTED') {
        const txs = await tx.select().from(loanRepaymentTransactions).where(eq(loanRepaymentTransactions.payrollRunId, runId));
        for (const t of txs) {
          const [loan] = await tx.select().from(employeeLoans).where(eq(employeeLoans.id, t.loanId)).limit(1);
          if (loan) {
            const currentBalM = Money.create(loan.remainingBalance, loan.currency);
            const totalPaidM = Money.create(loan.totalPaid, loan.currency);
            const repaidM = Money.create(t.amount, loan.currency);
            const restoredBalM = currentBalM.add(repaidM);
            const restoredPaidM = totalPaidM.subtract(repaidM);

            await tx.update(employeeLoans)
              .set({
                remainingBalance: restoredBalM.toDecimalString(),
                totalPaid: restoredPaidM.toDecimalString(),
                status: 'ACTIVE',
              })
              .where(eq(employeeLoans.id, loan.id));
          }
        }
      }

      const [reversed] = await tx.update(payrollRuns)
        .set({
          status: 'REVERSED',
          reversalReason: reason.trim(),
          reversedBy: actorId,
          reversedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(payrollRuns.id, runId))
        .returning();

      logger.audit('REVERSE_PAYROLL_RUN', 'PAYROLL_RUN', runId, { reason }, { tenantId });
      return reversed;
    });
  }

  // ==========================================
  // 7. WPS SIF & EXCEL EXPORTS
  // ==========================================

  public async exportWpsSif(tenantId: string, runId: string) {
    const run = await this.getPayrollRun(tenantId, runId);
    if (!run) throw new Error('Payroll run not found.');

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    const empList = await db.select().from(employees).where(eq(employees.tenantId, tenantId));
    const empMap = new Map<string, any>(empList.map((e) => [e.id, e]));

    const sifContent = PayrollCalculator.generateWpsSifFile({
      employerCr: tenant.crNumber || tenant.code,
      payerBankCode: 'NBK-KW',
      valueDate: run.endDate.toISOString().slice(0, 10),
      currency: run.currency,
      items: run.items as any,
      employeeMasterMap: empMap,
    });

    await db.update(payrollRuns)
      .set({ wpsGeneratedAt: new Date() })
      .where(eq(payrollRuns.id, runId));

    return sifContent;
  }

  public async exportExcelCsv(tenantId: string, runId: string) {
    const run = await this.getPayrollRun(tenantId, runId);
    if (!run) throw new Error('Payroll run not found.');

    const empList = await db.select().from(employees).where(eq(employees.tenantId, tenantId));
    const empMap = new Map<string, any>(empList.map((e) => [e.id, e]));

    return PayrollCalculator.generatePayrollSpreadsheet({
      period: `${run.periodYear}-${run.periodMonth}`,
      items: run.items as any,
      employeeMasterMap: empMap,
    });
  }

  // ==========================================
  // 8. PAYSLIP PDF GENERATION
  // ==========================================

  public async generatePayslipPdf(tenantId: string, runId: string, employeeId: string): Promise<Buffer> {
    const run = await this.getPayrollRun(tenantId, runId);
    if (!run) throw new Error('Payroll run not found.');

    const item = run.items.find((i: any) => i.employeeId === employeeId);
    if (!item) throw new Error('Employee not found in this payroll run.');

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);

    const pdfData: PayslipPdfData = {
      companyNameEn: tenant.legalNameEn || tenant.tradeNameEn || 'GulfHive Enterprise',
      companyNameAr: tenant.legalNameAr || tenant.tradeNameAr,
      companyCr: tenant.crNumber || tenant.code,
      periodYear: run.periodYear,
      periodMonth: run.periodMonth,
      runNumber: run.payrollNumber,
      employeeNumber: item.employeeNumber,
      employeeNameEn: item.employeeNameEn,
      employeeNameAr: item.employeeNameAr,
      bankName: item.bankName,
      iban: item.iban,
      currency: item.currency,
      basicSalary: item.basicSalary,
      housingAllowance: item.housingAllowance,
      transportAllowance: item.transportAllowance,
      otherAllowances: item.otherAllowances,
      overtimeAmount: item.overtimeAmount,
      overtimeHours: item.overtimeHours,
      unpaidLeaveDeduction: item.unpaidLeaveDeduction,
      unpaidLeaveDays: item.unpaidLeaveDays,
      loanDeduction: item.loanDeduction,
      statutoryEmployeeContribution: item.statutoryEmployeeContribution,
      statutoryEmployerContribution: item.statutoryEmployerContribution,
      grossPay: item.grossPay,
      totalDeductions: item.totalDeductions,
      netPay: item.netPay,
    };

    return PayslipPdfService.generateSinglePayslip(pdfData);
  }

  public async generateBatchPayslipsPdf(tenantId: string, runId: string): Promise<Buffer> {
    const run = await this.getPayrollRun(tenantId, runId);
    if (!run) throw new Error('Payroll run not found.');

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);

    const dataList: PayslipPdfData[] = run.items.map((item: any) => ({
      companyNameEn: tenant.legalNameEn || tenant.tradeNameEn || 'GulfHive Enterprise',
      companyNameAr: tenant.legalNameAr || tenant.tradeNameAr,
      companyCr: tenant.crNumber || tenant.code,
      periodYear: run.periodYear,
      periodMonth: run.periodMonth,
      runNumber: run.payrollNumber,
      employeeNumber: item.employeeNumber,
      employeeNameEn: item.employeeNameEn,
      employeeNameAr: item.employeeNameAr,
      bankName: item.bankName,
      iban: item.iban,
      currency: item.currency,
      basicSalary: item.basicSalary,
      housingAllowance: item.housingAllowance,
      transportAllowance: item.transportAllowance,
      otherAllowances: item.otherAllowances,
      overtimeAmount: item.overtimeAmount,
      overtimeHours: item.overtimeHours,
      unpaidLeaveDeduction: item.unpaidLeaveDeduction,
      unpaidLeaveDays: item.unpaidLeaveDays,
      loanDeduction: item.loanDeduction,
      statutoryEmployeeContribution: item.statutoryEmployeeContribution,
      statutoryEmployerContribution: item.statutoryEmployerContribution,
      grossPay: item.grossPay,
      totalDeductions: item.totalDeductions,
      netPay: item.netPay,
    }));

    return PayslipPdfService.generateBatchPayslips(dataList);
  }

  // ==========================================
  // 9. EMPLOYEE LOANS & ADVANCES
  // ==========================================

  public async listLoans(tenantId: string, employeeId?: string) {
    const conditions = [eq(employeeLoans.tenantId, tenantId)];
    if (employeeId) conditions.push(eq(employeeLoans.employeeId, employeeId));

    return db.select({
      id: employeeLoans.id,
      employeeId: employeeLoans.employeeId,
      employeeNumber: employees.employeeNumber,
      employeeNameEn: sql<string>`concat(${employees.firstNameEn}, ' ', ${employees.lastNameEn})`,
      loanAmount: employeeLoans.loanAmount,
      monthlyInstallment: employeeLoans.monthlyInstallment,
      totalPaid: employeeLoans.totalPaid,
      remainingBalance: employeeLoans.remainingBalance,
      currency: employeeLoans.currency,
      status: employeeLoans.status,
      disbursementDate: employeeLoans.disbursementDate,
      notes: employeeLoans.notes,
      createdAt: employeeLoans.createdAt,
    })
      .from(employeeLoans)
      .innerJoin(employees, eq(employeeLoans.employeeId, employees.id))
      .where(and(...conditions))
      .orderBy(desc(employeeLoans.createdAt));
  }

  public async createLoan(tenantId: string, input: {
    employeeId: string;
    loanAmount: string;
    monthlyInstallment: string;
    currency: string;
    disbursementDate: string;
    notes?: string;
  }) {
    const id = `ln_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const [inserted] = await db.insert(employeeLoans).values({
      id,
      tenantId,
      employeeId: input.employeeId,
      loanAmount: input.loanAmount,
      monthlyInstallment: input.monthlyInstallment,
      totalPaid: '0.000',
      remainingBalance: input.loanAmount,
      currency: input.currency,
      status: 'ACTIVE',
      disbursementDate: new Date(input.disbursementDate),
      notes: input.notes || null,
    }).returning();

    logger.audit('CREATE', 'EMPLOYEE_LOAN', id, { employeeId: input.employeeId, amount: input.loanAmount }, { tenantId });
    return inserted;
  }

  // ==========================================
  // 10. FINAL SETTLEMENTS (EOSB)
  // ==========================================

  public async listFinalSettlements(tenantId: string) {
    return db.select({
      id: finalSettlements.id,
      employeeId: finalSettlements.employeeId,
      employeeNumber: employees.employeeNumber,
      employeeNameEn: sql<string>`concat(${employees.firstNameEn}, ' ', ${employees.lastNameEn})`,
      contractType: finalSettlements.contractType,
      terminationType: finalSettlements.terminationType,
      joiningDate: finalSettlements.joiningDate,
      lastWorkingDate: finalSettlements.lastWorkingDate,
      totalServiceYears: finalSettlements.totalServiceYears,
      lastBasicSalary: finalSettlements.lastBasicSalary,
      statutoryGratuityAmount: finalSettlements.statutoryGratuityAmount,
      accruedLeaveEncashment: finalSettlements.accruedLeaveEncashment,
      unpaidSalary: finalSettlements.unpaidSalary,
      loanDeductions: finalSettlements.loanDeductions,
      netSettlementAmount: finalSettlements.netSettlementAmount,
      currency: finalSettlements.currency,
      status: finalSettlements.status,
      calculationDetails: finalSettlements.calculationDetails,
      createdAt: finalSettlements.createdAt,
    })
      .from(finalSettlements)
      .innerJoin(employees, eq(finalSettlements.employeeId, employees.id))
      .where(eq(finalSettlements.tenantId, tenantId))
      .orderBy(desc(finalSettlements.createdAt));
  }

  public async calculateAndCreateFinalSettlement(tenantId: string, input: {
    employeeId: string;
    contractType: 'UNLIMITED' | 'LIMITED';
    terminationType: 'RESIGNATION' | 'TERMINATION' | 'END_OF_CONTRACT';
    lastWorkingDate: string;
    accruedLeaveDays: number;
    unpaidSalaryDays: number;
    actorId: string;
  }) {
    const [emp] = await db.select().from(employees).where(eq(employees.id, input.employeeId)).limit(1);
    if (!emp) throw new Error('Employee not found.');

    const [salary] = await db.select().from(employeeSalaries)
      .where(and(eq(employeeSalaries.employeeId, input.employeeId), eq(employeeSalaries.isActive, true)))
      .limit(1);
    if (!salary) throw new Error('Employee active salary structure not found.');

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    const [loan] = await db.select().from(employeeLoans)
      .where(and(eq(employeeLoans.employeeId, input.employeeId), eq(employeeLoans.status, 'ACTIVE')))
      .limit(1);

    const result = PayrollCalculator.calculateEndofServiceIndemnity({
      countryCode: tenant.countryCode,
      contractType: input.contractType,
      terminationType: input.terminationType,
      joiningDate: new Date(emp.joiningDate),
      lastWorkingDate: new Date(input.lastWorkingDate),
      lastBasicSalary: salary.basicSalary,
      accruedLeaveDays: input.accruedLeaveDays || 0,
      unpaidSalaryDays: input.unpaidSalaryDays || 0,
      loanBalance: loan?.remainingBalance || '0.000',
      currency: tenant.baseCurrency || 'KWD',
    });

    const id = `eos_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const [inserted] = await db.insert(finalSettlements).values({
      id,
      tenantId,
      employeeId: input.employeeId,
      contractType: input.contractType,
      terminationType: input.terminationType,
      joiningDate: new Date(emp.joiningDate),
      lastWorkingDate: new Date(input.lastWorkingDate),
      totalServiceYears: result.serviceYears,
      lastBasicSalary: salary.basicSalary,
      statutoryGratuityAmount: result.gratuityAmount,
      accruedLeaveEncashment: result.accruedLeaveEncashment,
      unpaidSalary: result.unpaidSalary,
      loanDeductions: result.loanDeductions,
      netSettlementAmount: result.netSettlementAmount,
      currency: result.currency,
      status: 'DRAFT',
      calculationDetails: result.calculationDetails,
    }).returning();

    // Log approval workflow submission
    await db.insert(approvalWorkflows).values({
      tenantId,
      entityType: 'FINAL_SETTLEMENT',
      entityId: id,
      action: 'SUBMITTED',
      actorId: input.actorId,
      comments: `Final settlement computed for ${emp.employeeNumber}: ${result.serviceYears} yrs service, Net: ${result.netSettlementAmount} ${result.currency}`,
    });

    return inserted;
  }

  public async approveFinalSettlement(tenantId: string, settlementId: string, approverId: string) {
    return db.transaction(async (tx) => {
      const [settlement] = await tx.select().from(finalSettlements)
        .where(and(eq(finalSettlements.tenantId, tenantId), eq(finalSettlements.id, settlementId)))
        .limit(1);

      if (!settlement) throw new Error('Settlement record not found.');
      if (settlement.status === 'APPROVED') throw new Error('Settlement is already approved.');

      const [updated] = await tx.update(finalSettlements)
        .set({
          status: 'APPROVED',
          approvedBy: approverId,
          approvedAt: new Date(),
        })
        .where(eq(finalSettlements.id, settlementId))
        .returning();

      // Deactivate employee upon settlement approval
      await tx.update(employees)
        .set({ employmentStatus: 'TERMINATED' })
        .where(eq(employees.id, settlement.employeeId));

      // Record in unified approval workflow
      await tx.insert(approvalWorkflows).values({
        tenantId,
        entityType: 'FINAL_SETTLEMENT',
        entityId: settlementId,
        action: 'APPROVED',
        actorId: approverId,
        comments: `Final settlement approved and employee terminated. Total: ${settlement.netSettlementAmount} ${settlement.currency}`,
      });

      return updated;
    });
  }
}

export const payrollRepository = new PayrollRepository();
