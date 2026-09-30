/**
 * GulfHive ERP - Dashboard Summary Repository
 * Aggregates real business signals across People, Time, Payroll, Compliance, and Audit Trails
 * to power the calm, permission-aware ERP Command Center.
 */

import { eq, and, desc, sql, lte } from 'drizzle-orm';
import { db } from '../../../db/index.ts';
import {
  employees,
  employeeDocuments,
  branches,
  attendanceRecords,
  leaveRequests,
  overtimeRecords,
  payrollRuns,
  employeeLoans,
  finalSettlements,
  auditLogs,
  approvalWorkflows,
  tenants,
  employeeSalaries,
} from '../../../db/schema.ts';
import { logger } from '../../../core/logging/logger.ts';

export class DashboardRepository {
  public async getDashboardSummary(tenantId: string, branchId?: string) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const thirtyDaysAhead = new Date();
    thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);

    // 1. Company Metadata
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    if (!tenant) throw new Error('Tenant company not found');

    // 2. People & Compliance Metrics
    const allEmployees = await db.select().from(employees)
      .where(and(eq(employees.tenantId, tenantId), eq(employees.employmentStatus, 'ACTIVE')));

    const totalEmployees = allEmployees.length;

    // Expiring Civil IDs, Passports, Visas from employee_documents table
    const expiringDocs = await db.select({
      id: employeeDocuments.id,
      employeeId: employeeDocuments.employeeId,
      documentType: employeeDocuments.documentType,
      documentNumber: employeeDocuments.documentNumber,
      expiryDate: employeeDocuments.expiryDate,
      employeeNumber: employees.employeeNumber,
      firstNameEn: employees.firstNameEn,
      lastNameEn: employees.lastNameEn,
      firstNameAr: employees.firstNameAr,
      lastNameAr: employees.lastNameAr,
    })
      .from(employeeDocuments)
      .innerJoin(employees, eq(employeeDocuments.employeeId, employees.id))
      .where(and(
        eq(employeeDocuments.tenantId, tenantId),
        lte(employeeDocuments.expiryDate, thirtyDaysAhead)
      ));

    // 3. Time & Attendance Metrics
    const todayAttendance = await db.select().from(attendanceRecords)
      .where(and(
        eq(attendanceRecords.tenantId, tenantId),
        sql`${attendanceRecords.date} = ${todayStr}`
      ));

    const onDutyCount = todayAttendance.filter((a) => a.checkIn !== null).length;

    const pendingLeaves = await db.select().from(leaveRequests)
      .where(and(eq(leaveRequests.tenantId, tenantId), eq(leaveRequests.status, 'PENDING')));

    const pendingOvertime = await db.select().from(overtimeRecords)
      .where(and(eq(overtimeRecords.tenantId, tenantId), eq(overtimeRecords.status, 'PENDING')));

    // 4. Payroll Metrics
    const [latestRun] = await db.select().from(payrollRuns)
      .where(eq(payrollRuns.tenantId, tenantId))
      .orderBy(desc(payrollRuns.periodYear), desc(payrollRuns.periodMonth))
      .limit(1);

    const activeLoans = await db.select().from(employeeLoans)
      .where(and(eq(employeeLoans.tenantId, tenantId), eq(employeeLoans.status, 'ACTIVE')));

    const pendingEosb = await db.select().from(finalSettlements)
      .where(and(eq(finalSettlements.tenantId, tenantId), eq(finalSettlements.status, 'DRAFT')));

    // 5. Recent Activity Stream
    const recentAuditLogs = await db.select().from(auditLogs)
      .where(eq(auditLogs.tenantId, tenantId))
      .orderBy(desc(auditLogs.timestamp))
      .limit(5);

    const recentWorkflows = await db.select().from(approvalWorkflows)
      .where(eq(approvalWorkflows.tenantId, tenantId))
      .orderBy(desc(approvalWorkflows.timestamp))
      .limit(5);

    const combinedActivity = [
      ...recentAuditLogs.map((a) => ({
        id: `audit_${a.id}`,
        type: 'AUDIT',
        actor: a.actorId || 'System',
        action: a.action,
        entityType: a.entityType,
        timestamp: a.timestamp,
      })),
      ...recentWorkflows.map((w) => ({
        id: `wf_${w.id}`,
        type: 'WORKFLOW',
        actor: w.actorId,
        action: `${w.entityType}_${w.action}`,
        entityType: w.entityType,
        timestamp: w.timestamp,
        comments: w.comments,
      })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 6);

    // 6. Setup Progress (For newly onboarded companies)
    const hasEmployees = totalEmployees > 0;
    const [hasSalaries] = await db.select().from(employeeSalaries).where(eq(employeeSalaries.tenantId, tenantId)).limit(1);
    const hasPayrollRun = !!latestRun;

    const setupSteps = [
      { key: 'company_profile', completed: true, label: 'Company Legal Entity' },
      { key: 'fiscal_year', completed: true, label: 'GCC Jurisdiction & Currency' },
      { key: 'add_employees', completed: hasEmployees, label: 'Add First Employees' },
      { key: 'salary_structure', completed: !!hasSalaries, label: 'Configure Salaries & WPS IBANs' },
      { key: 'first_payroll', completed: hasPayrollRun, label: 'Run First Batch Payroll' },
    ];

    const completedCount = setupSteps.filter((s) => s.completed).length;
    const setupPercentage = Math.round((completedCount / setupSteps.length) * 100);

    return {
      company: {
        id: tenant.id,
        code: tenant.code,
        legalNameEn: tenant.legalNameEn,
        legalNameAr: tenant.legalNameAr,
        countryCode: tenant.countryCode,
        baseCurrency: tenant.baseCurrency,
      },
      metrics: {
        totalEmployees,
        onDutyCount,
        attendancePercentage: totalEmployees > 0 ? Math.min(Math.round((onDutyCount / totalEmployees) * 100), 100) : 0,
        pendingLeaveApprovals: pendingLeaves.length,
        pendingOvertimeApprovals: pendingOvertime.length,
        expiringDocumentsCount: expiringDocs.length,
        activeLoansCount: activeLoans.length,
        pendingEosbCount: pendingEosb.length,
      },
      payrollStatus: latestRun ? {
        runId: latestRun.id,
        periodYear: latestRun.periodYear,
        periodMonth: latestRun.periodMonth,
        status: latestRun.status,
        totalNetPay: latestRun.totalNetPay,
        currency: latestRun.currency,
        totalEmployees: latestRun.totalEmployees,
      } : null,
      needsAttention: [
        ...(expiringDocs.length > 0 ? [{
          id: 'expiring_docs',
          category: 'COMPLIANCE',
          severity: 'WARNING',
          title: 'Expiring Statutory Documents',
          subtitle: `${expiringDocs.length} employee civil IDs, passports or visas expire within 30 days`,
          count: expiringDocs.length,
          moduleTarget: 'people',
          filterTarget: 'expiring',
        }] : []),
        ...(pendingLeaves.length > 0 ? [{
          id: 'pending_leaves',
          category: 'TIME',
          severity: 'INFO',
          title: 'Leave Requests Awaiting Approval',
          subtitle: `${pendingLeaves.length} employee leave applications require review`,
          count: pendingLeaves.length,
          moduleTarget: 'time',
          filterTarget: 'leave',
        }] : []),
        ...(pendingOvertime.length > 0 ? [{
          id: 'pending_ot',
          category: 'TIME',
          severity: 'INFO',
          title: 'Overtime Submissions Awaiting Approval',
          subtitle: `${pendingOvertime.length} overtime hours pending statutory approval`,
          count: pendingOvertime.length,
          moduleTarget: 'time',
          filterTarget: 'overtime',
        }] : []),
        ...(latestRun && latestRun.status === 'DRAFT' ? [{
          id: 'draft_payroll',
          category: 'PAYROLL',
          severity: 'ATTENTION',
          title: 'Draft Payroll Batch Needs Review',
          subtitle: `Batch for ${latestRun.periodYear}/${String(latestRun.periodMonth).padStart(2, '0')} calculated and awaiting validation`,
          count: 1,
          moduleTarget: 'payroll',
          filterTarget: 'runs',
        }] : []),
        ...(pendingEosb.length > 0 ? [{
          id: 'pending_eosb',
          category: 'PAYROLL',
          severity: 'WARNING',
          title: 'End of Service Indemnity Settlements',
          subtitle: `${pendingEosb.length} draft EOSB settlements calculated and awaiting approval`,
          count: pendingEosb.length,
          moduleTarget: 'payroll',
          filterTarget: 'eosb',
        }] : []),
      ],
      expiringDocumentsList: expiringDocs.slice(0, 5),
      recentActivity: combinedActivity,
      setupProgress: {
        completedCount,
        totalCount: setupSteps.length,
        percentage: setupPercentage,
        steps: setupSteps,
        isComplete: completedCount === setupSteps.length,
      },
    };
  }
}

export const dashboardRepository = new DashboardRepository();
