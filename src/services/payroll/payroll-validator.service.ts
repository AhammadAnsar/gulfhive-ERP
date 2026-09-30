/**
 * GulfHive ERP - Payroll Validation & Exception Engine
 * Detects discrepancies, missing master data, negative net pay, and compliance gaps.
 */

export interface ValidationIssue {
  code: string;
  severity: 'BLOCKING' | 'WARNING' | 'INFO';
  employeeId?: string;
  employeeNumber?: string;
  messageEn: string;
  messageAr: string;
}

export interface ValidationSummary {
  isValid: boolean;
  hasBlockingIssues: boolean;
  blockingCount: number;
  warningCount: number;
  infoCount: number;
  issues: ValidationIssue[];
}

export class PayrollValidatorService {
  /**
   * Pre-calculation validation checks before calculating batch
   */
  public static validatePreCalculation(params: {
    employees: any[];
    salariesMap: Map<string, any>;
    contractsMap: Map<string, any>;
    bankDetailsMap: Map<string, any>;
  }): ValidationSummary {
    const issues: ValidationIssue[] = [];

    for (const emp of params.employees) {
      const salary = params.salariesMap.get(emp.id);
      const contract = params.contractsMap.get(emp.id);
      const bank = params.bankDetailsMap.get(emp.id);

      // 1. Missing active salary structure/assignment (BLOCKING)
      if (!salary) {
        issues.push({
          code: 'MISSING_SALARY_ASSIGNMENT',
          severity: 'BLOCKING',
          employeeId: emp.id,
          employeeNumber: emp.employeeNumber,
          messageEn: `Employee ${emp.employeeNumber} has no active salary assignment.`,
          messageAr: `الموظف ${emp.employeeNumber} ليس لديه هيكل راتب نشط.`,
        });
      }

      // 2. Missing contract or expired contract (WARNING)
      if (!contract) {
        issues.push({
          code: 'MISSING_EMPLOYMENT_CONTRACT',
          severity: 'WARNING',
          employeeId: emp.id,
          employeeNumber: emp.employeeNumber,
          messageEn: `Employee ${emp.employeeNumber} has no registered employment contract.`,
          messageAr: `الموظف ${emp.employeeNumber} ليس لديه عقد عمل مسجل.`,
        });
      } else if (contract.endDate && new Date(contract.endDate) < new Date()) {
        issues.push({
          code: 'EXPIRED_EMPLOYMENT_CONTRACT',
          severity: 'WARNING',
          employeeId: emp.id,
          employeeNumber: emp.employeeNumber,
          messageEn: `Employee ${emp.employeeNumber} has an expired contract (${contract.endDate}).`,
          messageAr: `عقد عمل الموظف ${emp.employeeNumber} منتهي الصلاحية (${contract.endDate}).`,
        });
      }

      // 3. Missing bank account / IBAN for WPS transfer (WARNING / INFO)
      if (!bank || !bank.iban || bank.iban.trim().length < 10) {
        issues.push({
          code: 'MISSING_IBAN_WPS',
          severity: 'WARNING',
          employeeId: emp.id,
          employeeNumber: emp.employeeNumber,
          messageEn: `Employee ${emp.employeeNumber} has no valid IBAN for WPS bank transfer.`,
          messageAr: `الموظف ${emp.employeeNumber} لا يملك رقم آيبان صالح للتحويل البنكي لنظام حماية الأجور.`,
        });
      }
    }

    const blockingCount = issues.filter((i) => i.severity === 'BLOCKING').length;
    const warningCount = issues.filter((i) => i.severity === 'WARNING').length;
    const infoCount = issues.filter((i) => i.severity === 'INFO').length;

    return {
      isValid: blockingCount === 0,
      hasBlockingIssues: blockingCount > 0,
      blockingCount,
      warningCount,
      infoCount,
      issues,
    };
  }

  /**
   * Post-calculation validation checks on generated payroll run items
   */
  public static validatePostCalculation(items: any[]): ValidationSummary {
    const issues: ValidationIssue[] = [];

    for (const item of items) {
      const netVal = parseFloat(item.netPay || '0');
      const grossVal = parseFloat(item.grossPay || '0');

      // 1. Negative Net Pay (BLOCKING)
      if (netVal < 0) {
        issues.push({
          code: 'NEGATIVE_NET_PAY',
          severity: 'BLOCKING',
          employeeId: item.employeeId,
          employeeNumber: item.employeeNumber,
          messageEn: `Employee ${item.employeeNumber} has negative net pay (${item.netPay} ${item.currency}).`,
          messageAr: `صافي الراتب للموظف ${item.employeeNumber} سالب (${item.netPay} ${item.currency}).`,
        });
      }

      // 2. Zero Net Pay (WARNING)
      if (netVal === 0 && grossVal > 0) {
        issues.push({
          code: 'ZERO_NET_PAY',
          severity: 'WARNING',
          employeeId: item.employeeId,
          employeeNumber: item.employeeNumber,
          messageEn: `Employee ${item.employeeNumber} net pay is zero due to full deductions.`,
          messageAr: `صافي الراتب للموظف ${item.employeeNumber} صفر بسبب استنفاد الخصومات.`,
        });
      }

      // 3. Deduction exceeds 50% of gross salary (GCC Labor Law protection warning)
      const totalDed = parseFloat(item.totalDeductions || '0');
      if (grossVal > 0 && totalDed > grossVal * 0.5) {
        issues.push({
          code: 'EXCESSIVE_DEDUCTION_RATIO',
          severity: 'WARNING',
          employeeId: item.employeeId,
          employeeNumber: item.employeeNumber,
          messageEn: `Employee ${item.employeeNumber} total deductions exceed 50% of gross pay.`,
          messageAr: `إجمالي استقطاعات الموظف ${item.employeeNumber} تتجاوز 50% من إجمالي الراتب.`,
        });
      }
    }

    const blockingCount = issues.filter((i) => i.severity === 'BLOCKING').length;
    const warningCount = issues.filter((i) => i.severity === 'WARNING').length;
    const infoCount = issues.filter((i) => i.severity === 'INFO').length;

    return {
      isValid: blockingCount === 0,
      hasBlockingIssues: blockingCount > 0,
      blockingCount,
      warningCount,
      infoCount,
      issues,
    };
  }
}
