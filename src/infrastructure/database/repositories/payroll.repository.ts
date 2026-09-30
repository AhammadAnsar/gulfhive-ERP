/**
 * GulfHive ERP - Payroll Module Repository
 * Manages deterministic batch payroll processing, loans, EOSB final settlements,
 * WPS/SIF export generation, and validation/approval workflows.
 */

import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { db } from '../../../db/index.ts';
import {
  payrollRuns,
  payrollItems,
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
import { PayrollCalculator, CalculatedPayrollItem } from '../../../modules/payroll/engine/payroll-calculator.ts';
import { logger } from '../../../core/logging/logger.ts';

export class PayrollRepository {
  // --- 1. PAYROLL RUNS ---
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
      calculationBreakdown: payrollItems.calculationBreakdown,
    })
      .from(payrollItems)
      .innerJoin(employees, eq(payrollItems.employeeId, employees.id))
      .where(and(eq(payrollItems.tenantId, tenantId), eq(payrollItems.payrollRunId, runId)))
      .orderBy(asc(employees.employeeNumber));

    return { ...run, items };
  }

  public async calculateAndCreatePayrollRun(tenantId: string, month: number, year: number, actorId: string) {
    return db.transaction(async (tx) => {
      // 1. Fetch tenant company info
      const [tenant] = await tx.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
      if (!tenant) throw new Error('Tenant not found');

      const currency = tenant.baseCurrency || 'KWD';
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      // Check if run already exists
      const existing = await tx.select().from(payrollRuns)
        .where(and(
          eq(payrollRuns.tenantId, tenantId),
          eq(payrollRuns.periodMonth, month),
          eq(payrollRuns.periodYear, year)
        ))
        .limit(1);

      if (existing.length > 0 && existing[0].status === 'APPROVED') {
        throw new Error('Approved payroll cannot be overwritten. Use a controlled reversal or adjustment.');
      }

      const runId = existing.length > 0 ? existing[0].id : `pr_${year}_${month}_${Date.now()}`;

      // If existing draft/validated, remove previous items to recalculate cleanly
      if (existing.length > 0) {
        await tx.delete(payrollItems).where(eq(payrollItems.payrollRunId, runId));
      }

      // 2. Fetch all active employees
      const activeEmployees = await tx.select().from(employees)
        .where(and(eq(employees.tenantId, tenantId), eq(employees.employmentStatus, 'ACTIVE')));

      let totalGrossSubunits = 0n;
      let totalDeductionsSubunits = 0n;
      let totalNetSubunits = 0n;
      const calculatedItems: any[] = [];

      for (const emp of activeEmployees) {
        // Fetch active salary structure
        const [salary] = await tx.select().from(employeeSalaries)
          .where(and(eq(employeeSalaries.employeeId, emp.id), eq(employeeSalaries.isActive, true)))
          .limit(1);

        // Fetch bank details
        const [bank] = await tx.select().from(employeeBankDetails)
          .where(and(eq(employeeBankDetails.employeeId, emp.id), eq(employeeBankDetails.isPrimary, true)))
          .limit(1);

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

        calculatedItems.push({
          id: `pi_${runId}_${emp.id}`,
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
          calculationBreakdown: calculated.calculationBreakdown,
        });
      }

      const totalGrossFormatted = Money.fromSubunits(totalGrossSubunits, currency).toDecimalString();
      const totalDedFormatted = Money.fromSubunits(totalDeductionsSubunits, currency).toDecimalString();
      const totalNetFormatted = Money.fromSubunits(totalNetSubunits, currency).toDecimalString();

      if (existing.length > 0) {
        await tx.update(payrollRuns)
          .set({
            totalEmployees: activeEmployees.length,
            totalGrossPay: totalGrossFormatted,
            totalDeductions: totalDedFormatted,
            totalNetPay: totalNetFormatted,
            status: 'DRAFT',
            updatedAt: new Date(),
          })
          .where(eq(payrollRuns.id, runId));
      } else {
        await tx.insert(payrollRuns).values({
          id: runId,
          tenantId,
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
        });
      }

      if (calculatedItems.length > 0) {
        await tx.insert(payrollItems).values(calculatedItems);
      }

      // Record in unified approval workflow
      await tx.insert(approvalWorkflows).values({
        tenantId,
        entityType: 'PAYROLL_RUN',
        entityId: runId,
        action: 'SUBMITTED',
        actorId,
        comments: `Payroll generated for ${year}-${month}: ${activeEmployees.length} employees, Net: ${totalNetFormatted} ${currency}`,
      });

      return { runId, totalEmployees: activeEmployees.length, totalNetPay: totalNetFormatted };
    });
  }

  public async validatePayrollRun(tenantId: string, runId: string) {
    const run = await this.getPayrollRun(tenantId, runId);
    if (!run) throw new Error('Payroll run not found');

    const issues: string[] = [];

    run.items.forEach((item) => {
      const netVal = parseFloat(item.netPay);
      if (netVal < 0) {
        issues.push(`Employee ${item.employeeNumber} has negative net pay (${item.netPay} ${item.currency}).`);
      }
      if (!item.iban || item.iban.length < 15) {
        issues.push(`Employee ${item.employeeNumber} is missing valid IBAN for WPS bank transfer.`);
      }
    });

    if (issues.length === 0) {
      await db.update(payrollRuns)
        .set({ status: 'VALIDATED', validatedAt: new Date() })
        .where(eq(payrollRuns.id, runId));
    }

    return { isValid: issues.length === 0, issues };
  }

  public async approvePayrollRun(tenantId: string, runId: string, approverId: string) {
    return db.transaction(async (tx) => {
      const [run] = await tx.select().from(payrollRuns)
        .where(and(eq(payrollRuns.tenantId, tenantId), eq(payrollRuns.id, runId)))
        .limit(1);

      if (!run) throw new Error('Payroll run not found');
      if (run.status === 'APPROVED' || run.status === 'PAID') {
        throw new Error('Payroll run is already approved and locked.');
      }

      // Update status
      const [updated] = await tx.update(payrollRuns)
        .set({
          status: 'APPROVED',
          approvedBy: approverId,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(payrollRuns.id, runId))
        .returning();

      // Deduct loan installments from employee loans balance
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
          }
        }
      }

      // Record in unified approval workflow
      await tx.insert(approvalWorkflows).values({
        tenantId,
        entityType: 'PAYROLL_RUN',
        entityId: runId,
        action: 'APPROVED',
        actorId: approverId,
        comments: `Payroll approved and locked for disbursement. Net total: ${run.totalNetPay} ${run.currency}`,
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

  // --- 2. WPS SIF & EXCEL EXPORTS ---
  public async exportWpsSif(tenantId: string, runId: string) {
    const run = await this.getPayrollRun(tenantId, runId);
    if (!run) throw new Error('Payroll run not found');

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
    if (!run) throw new Error('Payroll run not found');

    const empList = await db.select().from(employees).where(eq(employees.tenantId, tenantId));
    const empMap = new Map<string, any>(empList.map((e) => [e.id, e]));

    return PayrollCalculator.generatePayrollSpreadsheet({
      period: `${run.periodYear}-${run.periodMonth}`,
      items: run.items as any,
      employeeMasterMap: empMap,
    });
  }

  // --- 3. EMPLOYEE LOANS ---
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
    return inserted;
  }

  // --- 4. FINAL SETTLEMENT / END OF SERVICE INDEMNITY ---
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
    if (!emp) throw new Error('Employee not found');

    const [salary] = await db.select().from(employeeSalaries)
      .where(and(eq(employeeSalaries.employeeId, input.employeeId), eq(employeeSalaries.isActive, true)))
      .limit(1);
    if (!salary) throw new Error('Employee active salary structure not found');

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

      if (!settlement) throw new Error('Settlement record not found');
      if (settlement.status === 'APPROVED') throw new Error('Settlement is already approved');

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
