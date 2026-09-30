/**
 * GulfHive ERP - Deterministic Payroll Calculation Engine
 * Strictly auditable, decimal-safe pipeline integrating Contracts, Salary components,
 * Attendance, Leave, Overtime, Adjustments, Loans, and versioned GCC statutory rules (PIFSS, GOSI, Gratuity/EOSB).
 */

import { Money } from '../../../core/domain/money.ts';
import { StatutoryRulesService } from '../../../services/compliance/statutory-rules.service.ts';
import { FormulaEvaluator } from '../../../services/payroll/formula-evaluator.ts';

export interface PayrollAdjustmentInput {
  id?: string;
  type: string;
  amount: string;
  reason: string;
}

export interface EmployeePayrollInput {
  employeeId: string;
  employeeNumber: string;
  nameEn: string;
  nameAr: string;
  nationality: string;
  countryCode: string; // KW, SA, AE, etc.
  baseCurrency: string; // KWD, SAR, AED
  basicSalary: string;
  housingAllowance: string;
  transportAllowance: string;
  otherAllowances: string;
  overtimeMinutes: number;
  unpaidLeaveDays: number;
  loanMonthlyInstallment: string;
  loanRemainingBalance: string;
  adjustments?: PayrollAdjustmentInput[];
  prorationFactor?: number; // 0.0 to 1.0 for mid-period joining or salary change
  bankName?: string;
  iban?: string;
  accountNumber?: string;
  bankCode?: string;
}

export interface PayrollResultLineItem {
  componentCode: string;
  componentName: string;
  lineType: 'EARNING' | 'DEDUCTION' | 'EMPLOYER_CONTRIBUTION' | 'INFORMATION';
  quantity?: string;
  rate?: string;
  amount: string;
  sourceType: 'CONTRACT' | 'TIME' | 'LEAVE' | 'OVERTIME' | 'ADJUSTMENT' | 'LOAN' | 'STATUTORY' | 'FORMULA';
  sourceId?: string;
  calculationRuleReference?: string;
  displayOrder: number;
}

export interface CalculatedPayrollItem {
  employeeId: string;
  currency: string;
  basicSalary: string;
  housingAllowance: string;
  transportAllowance: string;
  otherAllowances: string;
  overtimeAmount: string;
  overtimeHours: string;
  unpaidLeaveDeduction: string;
  unpaidLeaveDays: number;
  loanDeduction: string;
  statutoryEmployeeContribution: string;
  statutoryEmployerContribution: string;
  grossPay: string;
  totalDeductions: string;
  netPay: string;
  bankName: string;
  iban: string;
  resultLines: PayrollResultLineItem[];
  calculationBreakdown: {
    basePackage: {
      basic: string;
      housing: string;
      transport: string;
      other: string;
      regularTotal: string;
    };
    overtime: {
      minutes: number;
      hours: string;
      hourlyRate: string;
      multiplier: string;
      total: string;
      rule: string;
    };
    leaveDeductions: {
      unpaidDays: number;
      dailyRate: string;
      deductionAmount: string;
    };
    loans: {
      installmentDue: string;
      balanceBefore: string;
      actualDeduction: string;
    };
    statutoryPension: {
      country: string;
      isNational: boolean;
      employeeRate: string;
      employeeAmount: string;
      employerRate: string;
      employerAmount: string;
      scheme: string;
    };
    summary: {
      gross: string;
      deductions: string;
      net: string;
    };
  };
}

export class PayrollCalculator {
  /**
   * Deterministically calculates one employee's complete payslip for a given month (30-day labor standard).
   */
  public static calculate(input: EmployeePayrollInput): CalculatedPayrollItem {
    const curr = input.baseCurrency;
    const factor = input.prorationFactor !== undefined ? Math.max(0, Math.min(1, input.prorationFactor)) : 1.0;
    const resultLines: PayrollResultLineItem[] = [];
    let order = 1;

    // 1. Base Compensation Components (with Proration if applicable)
    let basicM = Money.create(input.basicSalary || '0', curr);
    let housingM = Money.create(input.housingAllowance || '0', curr);
    let transportM = Money.create(input.transportAllowance || '0', curr);
    let otherM = Money.create(input.otherAllowances || '0', curr);

    if (factor < 1.0) {
      basicM = Money.create(Number(basicM.amount) * factor, curr);
      housingM = Money.create(Number(housingM.amount) * factor, curr);
      transportM = Money.create(Number(transportM.amount) * factor, curr);
      otherM = Money.create(Number(otherM.amount) * factor, curr);
    }

    resultLines.push({
      componentCode: 'BASIC',
      componentName: 'Basic Salary / الراتب الأساسي',
      lineType: 'EARNING',
      amount: basicM.toDecimalString(),
      sourceType: 'CONTRACT',
      calculationRuleReference: factor < 1.0 ? `Contract baseline prorated at ${(factor * 100).toFixed(1)}%` : 'Contract baseline wage',
      displayOrder: order++,
    });

    if (housingM.toSubunits() > 0n) {
      resultLines.push({
        componentCode: 'HOUSING',
        componentName: 'Housing Allowance / بدل سكن',
        lineType: 'EARNING',
        amount: housingM.toDecimalString(),
        sourceType: 'CONTRACT',
        displayOrder: order++,
      });
    }

    if (transportM.toSubunits() > 0n) {
      resultLines.push({
        componentCode: 'TRANSPORT',
        componentName: 'Transport Allowance / بدل نقل',
        lineType: 'EARNING',
        amount: transportM.toDecimalString(),
        sourceType: 'CONTRACT',
        displayOrder: order++,
      });
    }

    if (otherM.toSubunits() > 0n) {
      resultLines.push({
        componentCode: 'OTHER',
        componentName: 'Other Allowances / بدلات أخرى',
        lineType: 'EARNING',
        amount: otherM.toDecimalString(),
        sourceType: 'CONTRACT',
        displayOrder: order++,
      });
    }

    const regularPackageM = basicM.add(housingM).add(transportM).add(otherM);

    // 2. Overtime Computation (GCC 30-day labor month, 8-hour workday = 240 hours/month)
    const otPolicy = StatutoryRulesService.getOvertimePolicy(input.countryCode);
    const hourlySubunits = basicM.toSubunits() / BigInt(otPolicy.hourlyBaseDivisor);
    const otHours = (input.overtimeMinutes / 60).toFixed(2);
    const multiplier = otPolicy.regularDayMultiplier;

    const otSubunits = BigInt(Math.round(Number(hourlySubunits) * (input.overtimeMinutes / 60) * multiplier));
    const overtimeM = Money.fromSubunits(otSubunits, curr);

    if (overtimeM.toSubunits() > 0n) {
      resultLines.push({
        componentCode: 'OVERTIME',
        componentName: 'Approved Overtime / العمل الإضافي المعتمد',
        lineType: 'EARNING',
        quantity: `${otHours} hrs`,
        rate: Money.fromSubunits(hourlySubunits, curr).toDecimalString(),
        amount: overtimeM.toDecimalString(),
        sourceType: 'OVERTIME',
        calculationRuleReference: `${otPolicy.sourceReference} (${multiplier}x regular rate)`,
        displayOrder: order++,
      });
    }

    // 3. Process Adjustments (Bonuses, Commissions, Reimbursements, Penalties)
    let adjustmentAdditionsM = Money.zero(curr);
    let adjustmentDeductionsM = Money.zero(curr);

    if (input.adjustments && input.adjustments.length > 0) {
      for (const adj of input.adjustments) {
        const adjM = Money.create(adj.amount, curr);
        const isDeduction = ['DEDUCTION', 'PENALTY'].includes(adj.type.toUpperCase());
        if (isDeduction) {
          adjustmentDeductionsM = adjustmentDeductionsM.add(adjM);
          resultLines.push({
            componentCode: adj.type.toUpperCase(),
            componentName: `Adjustment: ${adj.reason || adj.type}`,
            lineType: 'DEDUCTION',
            amount: adjM.toDecimalString(),
            sourceType: 'ADJUSTMENT',
            sourceId: adj.id,
            displayOrder: order++,
          });
        } else {
          adjustmentAdditionsM = adjustmentAdditionsM.add(adjM);
          resultLines.push({
            componentCode: adj.type.toUpperCase(),
            componentName: `Adjustment: ${adj.reason || adj.type}`,
            lineType: 'EARNING',
            amount: adjM.toDecimalString(),
            sourceType: 'ADJUSTMENT',
            sourceId: adj.id,
            displayOrder: order++,
          });
        }
      }
    }

    // Gross Earnings = Regular Package + Overtime + Earning Adjustments
    const grossM = regularPackageM.add(overtimeM).add(adjustmentAdditionsM);

    // 4. Unpaid Leave Deduction (Daily Rate = Basic Salary / 30)
    const dailySubunits = basicM.toSubunits() / 30n;
    const unpaidSubunits = dailySubunits * BigInt(input.unpaidLeaveDays);
    const unpaidDeductionM = Money.fromSubunits(unpaidSubunits, curr);

    if (unpaidDeductionM.toSubunits() > 0n) {
      resultLines.push({
        componentCode: 'UNPAID_LEAVE',
        componentName: 'Unpaid Absence Deduction / استقطاع غياب وإجازات غير مدفوعة',
        lineType: 'DEDUCTION',
        quantity: `${input.unpaidLeaveDays} days`,
        rate: Money.fromSubunits(dailySubunits, curr).toDecimalString(),
        amount: unpaidDeductionM.toDecimalString(),
        sourceType: 'LEAVE',
        calculationRuleReference: '30-day statutory calendar day divisor (Basic / 30)',
        displayOrder: order++,
      });
    }

    // 5. Employee Loan Deduction (min of installment due and remaining balance)
    const loanInstM = Money.create(input.loanMonthlyInstallment || '0', curr);
    const loanBalM = Money.create(input.loanRemainingBalance || '0', curr);
    const loanDeductionM = loanInstM.toSubunits() > loanBalM.toSubunits() ? loanBalM : loanInstM;

    if (loanDeductionM.toSubunits() > 0n) {
      resultLines.push({
        componentCode: 'LOAN_INSTALLMENT',
        componentName: 'Employee Loan Recovery / استقطاع قسط سلفة وقرض',
        lineType: 'DEDUCTION',
        amount: loanDeductionM.toDecimalString(),
        sourceType: 'LOAN',
        calculationRuleReference: `Remaining balance before: ${loanBalM.toDecimalString()} ${curr}`,
        displayOrder: order++,
      });
    }

    // 6. Versioned Statutory Social Insurance (PIFSS in Kuwait, GOSI in Saudi)
    const socialIns = StatutoryRulesService.calculateSocialInsurance({
      countryCode: input.countryCode,
      nationality: input.nationality,
      currency: curr,
      basicSalary: basicM.toDecimalString(),
      housingAllowance: housingM.toDecimalString(),
      transportAllowance: transportM.toDecimalString(),
      otherAllowances: otherM.toDecimalString(),
    });

    const statutoryEmpM = Money.create(socialIns.employeeContributionAmount, curr);
    const statutoryEmplyrM = Money.create(socialIns.employerContributionAmount, curr);

    if (statutoryEmpM.toSubunits() > 0n) {
      resultLines.push({
        componentCode: 'STATUTORY_PENSION_EMP',
        componentName: `Social Insurance (${socialIns.schemeName})`,
        lineType: 'DEDUCTION',
        rate: `${(socialIns.employeeRate * 100).toFixed(1)}%`,
        amount: statutoryEmpM.toDecimalString(),
        sourceType: 'STATUTORY',
        calculationRuleReference: socialIns.sourceReference,
        displayOrder: order++,
      });
    }

    if (statutoryEmplyrM.toSubunits() > 0n) {
      resultLines.push({
        componentCode: 'STATUTORY_PENSION_EMPLYR',
        componentName: `Employer Social Insurance Contribution (${socialIns.schemeName})`,
        lineType: 'EMPLOYER_CONTRIBUTION',
        rate: `${(socialIns.employerRate * 100).toFixed(1)}%`,
        amount: statutoryEmplyrM.toDecimalString(),
        sourceType: 'STATUTORY',
        calculationRuleReference: `${socialIns.sourceReference} (Employer share — cost only, not deducted from net pay)`,
        displayOrder: order++,
      });
    }

    // Total Deductions = Unpaid Leave + Loan + Adjustment Deductions + Statutory Employee Contribution
    const totalDeductionsM = unpaidDeductionM.add(loanDeductionM).add(adjustmentDeductionsM).add(statutoryEmpM);

    // Net Pay = Gross - Total Deductions
    const netM = grossM.subtract(totalDeductionsM);

    return {
      employeeId: input.employeeId,
      currency: curr,
      basicSalary: basicM.toDecimalString(),
      housingAllowance: housingM.toDecimalString(),
      transportAllowance: transportM.toDecimalString(),
      otherAllowances: otherM.toDecimalString(),
      overtimeAmount: overtimeM.toDecimalString(),
      overtimeHours: otHours,
      unpaidLeaveDeduction: unpaidDeductionM.toDecimalString(),
      unpaidLeaveDays: input.unpaidLeaveDays,
      loanDeduction: loanDeductionM.toDecimalString(),
      statutoryEmployeeContribution: statutoryEmpM.toDecimalString(),
      statutoryEmployerContribution: statutoryEmplyrM.toDecimalString(),
      grossPay: grossM.toDecimalString(),
      totalDeductions: totalDeductionsM.toDecimalString(),
      netPay: netM.toDecimalString(),
      bankName: input.bankName || 'Direct Transfer',
      iban: input.iban || '',
      resultLines,
      calculationBreakdown: {
        basePackage: {
          basic: basicM.toDecimalString(),
          housing: housingM.toDecimalString(),
          transport: transportM.toDecimalString(),
          other: otherM.toDecimalString(),
          regularTotal: regularPackageM.toDecimalString(),
        },
        overtime: {
          minutes: input.overtimeMinutes,
          hours: otHours,
          hourlyRate: Money.fromSubunits(hourlySubunits, curr).toDecimalString(),
          multiplier: `${multiplier}x`,
          total: overtimeM.toDecimalString(),
          rule: `${otPolicy.sourceReference}: ${multiplier}x basic rate`,
        },
        leaveDeductions: {
          unpaidDays: input.unpaidLeaveDays,
          dailyRate: Money.fromSubunits(dailySubunits, curr).toDecimalString(),
          deductionAmount: unpaidDeductionM.toDecimalString(),
        },
        loans: {
          installmentDue: loanInstM.toDecimalString(),
          balanceBefore: loanBalM.toDecimalString(),
          actualDeduction: loanDeductionM.toDecimalString(),
        },
        statutoryPension: {
          country: input.countryCode,
          isNational: socialIns.isApplicable,
          employeeRate: `${(socialIns.employeeRate * 100).toFixed(1)}%`,
          employeeAmount: statutoryEmpM.toDecimalString(),
          employerRate: `${(socialIns.employerRate * 100).toFixed(1)}%`,
          employerAmount: statutoryEmplyrM.toDecimalString(),
          scheme: socialIns.schemeName,
        },
        summary: {
          gross: grossM.toDecimalString(),
          deductions: totalDeductionsM.toDecimalString(),
          net: netM.toDecimalString(),
        },
      },
    };
  }

  /**
   * End of Service Benefits (EOSB) / Indemnity Calculation
   */
  public static calculateEndofServiceIndemnity(params: {
    countryCode: string;
    contractType: 'UNLIMITED' | 'LIMITED';
    terminationType: 'RESIGNATION' | 'TERMINATION' | 'END_OF_CONTRACT';
    joiningDate: Date;
    lastWorkingDate: Date;
    lastBasicSalary: string;
    accruedLeaveDays: number;
    unpaidSalaryDays: number;
    loanBalance: string;
    currency: string;
  }) {
    const curr = params.currency;
    const eosb = StatutoryRulesService.calculateEndOfService({
      countryCode: params.countryCode,
      contractType: params.contractType,
      terminationType: params.terminationType,
      joiningDate: params.joiningDate,
      lastWorkingDate: params.lastWorkingDate,
      lastBasicSalary: params.lastBasicSalary,
      currency: curr,
    });

    const basicM = Money.create(params.lastBasicSalary, curr);
    const dailyWageM = Money.create(Number(basicM.amount) / 26, curr);
    const leavePayoutM = Money.create(Number(dailyWageM.amount) * (params.accruedLeaveDays || 0), curr);
    const unpaidSalaryM = Money.create(Number(dailyWageM.amount) * (params.unpaidSalaryDays || 0), curr);
    const loanBalM = Money.create(params.loanBalance || '0', curr);

    const gratuityM = Money.create(eosb.gratuityAmount, curr);
    const netSubunits = gratuityM.toSubunits() + leavePayoutM.toSubunits() + unpaidSalaryM.toSubunits() - loanBalM.toSubunits();
    const netM = Money.fromSubunits(netSubunits < 0n ? 0n : netSubunits, curr);

    return {
      serviceYears: eosb.serviceYears.toFixed(2),
      gratuityAmount: gratuityM.toDecimalString(),
      accruedLeaveEncashment: leavePayoutM.toDecimalString(),
      unpaidSalary: unpaidSalaryM.toDecimalString(),
      loanDeductions: loanBalM.toDecimalString(),
      netSettlementAmount: netM.toDecimalString(),
      currency: curr,
      calculationDetails: {
        tenureYears: eosb.serviceYears.toFixed(2),
        basis: `${params.countryCode} Labor Law Statutory Formula (${eosb.sourceReference})`,
        lastSalary: basicM.toDecimalString(),
        gratuityGross: gratuityM.toDecimalString(),
        resignationFactor: eosb.resignationFactor,
        leaveEncashmentDays: params.accruedLeaveDays,
        leaveEncashmentAmount: leavePayoutM.toDecimalString(),
        unpaidDays: params.unpaidSalaryDays,
        unpaidAmount: unpaidSalaryM.toDecimalString(),
        loanRecovery: loanBalM.toDecimalString(),
        finalNetPayable: netM.toDecimalString(),
        statutoryBreakdown: eosb.breakdown,
      },
    };
  }

  /**
   * Generates standard GCC Wage Protection System (WPS) SIF file.
   */
  public static generateWpsSifFile(params: {
    employerCr: string;
    payerBankCode: string;
    valueDate: string; // YYYY-MM-DD
    currency: string;
    items: CalculatedPayrollItem[];
    employeeMasterMap: Map<string, any>;
  }): string {
    const dateFormatted = params.valueDate.replace(/-/g, '');
    const totalCount = params.items.length;
    let totalWagesSubunits = 0n;

    const bodyLines: string[] = [];

    params.items.forEach((item, idx) => {
      const emp = params.employeeMasterMap.get(item.employeeId);
      const civilId = emp?.civilIdNumber || '000000000000';
      const iban = item.iban || 'KW000000000000000000000000';
      const netSubunits = Money.create(item.netPay, item.currency).toSubunits();
      totalWagesSubunits += netSubunits;

      // Detail Record:
      // EDR, Record#, Employee Civil ID, Employee Account/IBAN, Currency, Basic Salary, Extra/Allowances, Deductions, Net Pay
      bodyLines.push(
        `EDR,${idx + 1},${civilId},${iban},${item.currency},${item.basicSalary},${(parseFloat(item.housingAllowance) + parseFloat(item.transportAllowance) + parseFloat(item.overtimeAmount)).toFixed(3)},${item.totalDeductions},${item.netPay}`
      );
    });

    const totalWagesFormatted = Money.fromSubunits(totalWagesSubunits, params.currency).toDecimalString();

    // SIF Header Record:
    // SCR, Employer CR, Payer Bank Routing, Value Date, Total Wages, Employee Count, Currency
    const headerLine = `SCR,${params.employerCr || 'CORP'},${params.payerBankCode || 'NBK-KW'},${dateFormatted},${totalWagesFormatted},${totalCount},${params.currency}`;

    return [headerLine, ...bodyLines].join('\n');
  }

  /**
   * Generates standard CSV representation for Excel export.
   */
  public static generatePayrollSpreadsheet(params: {
    period: string;
    items: CalculatedPayrollItem[];
    employeeMasterMap: Map<string, any>;
  }): string {
    const headers = [
      'Employee Number',
      'Name (English)',
      'Name (Arabic)',
      'Currency',
      'Basic Salary',
      'Housing Allowance',
      'Transport Allowance',
      'Overtime Amount',
      'Gross Pay',
      'Unpaid Leave Deduction',
      'Loan Deduction',
      'Statutory Social Insurance (Employee)',
      'Total Deductions',
      'Net Pay',
      'Bank Name',
      'IBAN'
    ];

    const rows = params.items.map((item) => {
      const emp = params.employeeMasterMap.get(item.employeeId);
      return [
        `"${emp?.employeeNumber || ''}"`,
        `"${emp?.firstNameEn || ''} ${emp?.lastNameEn || ''}"`,
        `"${emp?.firstNameAr || ''} ${emp?.lastNameAr || ''}"`,
        item.currency,
        item.basicSalary,
        item.housingAllowance,
        item.transportAllowance,
        item.overtimeAmount,
        item.grossPay,
        item.unpaidLeaveDeduction,
        item.loanDeduction,
        item.statutoryEmployeeContribution,
        item.totalDeductions,
        item.netPay,
        `"${item.bankName || ''}"`,
        `"${item.iban || ''}"`,
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }
}
