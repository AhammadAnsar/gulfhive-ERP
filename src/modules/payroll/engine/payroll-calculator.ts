/**
 * GulfHive ERP - Deterministic Payroll Calculation Engine
 * Strictly auditable, decimal-safe pipeline integrating Contracts, Salary components,
 * Attendance, Leave, Overtime, Loans, and versioned GCC statutory rules (PIFSS, GOSI, Gratuity/EOSB).
 */

import { Money } from '../../../core/domain/money.ts';

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
  bankName?: string;
  iban?: string;
  accountNumber?: string;
  bankCode?: string;
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

    // 1. Base Compensation Components
    const basicM = Money.create(input.basicSalary || '0', curr);
    const housingM = Money.create(input.housingAllowance || '0', curr);
    const transportM = Money.create(input.transportAllowance || '0', curr);
    const otherM = Money.create(input.otherAllowances || '0', curr);

    const regularPackageM = basicM.add(housingM).add(transportM).add(otherM);

    // 2. Overtime Computation (GCC 30-day labor month, 8-hour workday = 240 hours/month)
    // Hourly rate = Basic Salary / 240
    const basicSubunits = basicM.toSubunits();
    const hourlySubunits = basicSubunits / 240n;
    const otHours = (input.overtimeMinutes / 60).toFixed(2);

    // Multiplier per country labor law (Kuwait Art 66: 1.25x standard; Saudi: 1.50x)
    const multiplier = input.countryCode === 'SA' ? 1.5 : 1.25;
    const otSubunits = BigInt(Math.round(Number(hourlySubunits) * (input.overtimeMinutes / 60) * multiplier));
    const overtimeM = Money.fromSubunits(otSubunits, curr);

    // Gross Earnings = Regular Package + Overtime
    const grossM = regularPackageM.add(overtimeM);

    // 3. Unpaid Leave Deduction (Daily Rate = Basic Salary / 30)
    const dailySubunits = basicSubunits / 30n;
    const unpaidSubunits = dailySubunits * BigInt(input.unpaidLeaveDays);
    const unpaidDeductionM = Money.fromSubunits(unpaidSubunits, curr);

    // 4. Employee Loan Deduction (min of installment due and remaining balance)
    const loanInstM = Money.create(input.loanMonthlyInstallment || '0', curr);
    const loanBalM = Money.create(input.loanRemainingBalance || '0', curr);
    const loanDeductionM = loanInstM.toSubunits() > loanBalM.toSubunits() ? loanBalM : loanInstM;

    // 5. Statutory Social Insurance (PIFSS in Kuwait, GOSI in Saudi)
    // Applied to citizens / nationals
    const isKuwaiti = input.countryCode === 'KW' && (input.nationality.toLowerCase().includes('kuwait') || input.nationality.toLowerCase().includes('كويت'));
    const isSaudi = input.countryCode === 'SA' && (input.nationality.toLowerCase().includes('saudi') || input.nationality.toLowerCase().includes('سعود'));

    let empContribSubunits = 0n;
    let emplyrContribSubunits = 0n;
    let schemeName = 'None (Expatriate Gratuity Scheme)';
    let empRateStr = '0%';
    let emplyrRateStr = '0%';

    if (isKuwaiti) {
      // Kuwait PIFSS: 10.5% employee, 11.5% employer on basic + regular allowances
      schemeName = 'Kuwait Public Institution for Social Security (PIFSS)';
      empRateStr = '10.5%';
      emplyrRateStr = '11.5%';
      empContribSubunits = BigInt(Math.round(Number(regularPackageM.toSubunits()) * 0.105));
      emplyrContribSubunits = BigInt(Math.round(Number(regularPackageM.toSubunits()) * 0.115));
    } else if (isSaudi) {
      // Saudi GOSI: 9.75% employee (9% Annuities + 0.75% SANED), 11.75% employer
      schemeName = 'Saudi General Organization for Social Insurance (GOSI)';
      empRateStr = '9.75%';
      emplyrRateStr = '11.75%';
      empContribSubunits = BigInt(Math.round(Number(basicM.add(housingM).toSubunits()) * 0.0975));
      emplyrContribSubunits = BigInt(Math.round(Number(basicM.add(housingM).toSubunits()) * 0.1175));
    }

    const statutoryEmpM = Money.fromSubunits(empContribSubunits, curr);
    const statutoryEmplyrM = Money.fromSubunits(emplyrContribSubunits, curr);

    // Total Deductions = Unpaid Leave + Loan + Statutory Employee Contribution
    const totalDeductionsM = unpaidDeductionM.add(loanDeductionM).add(statutoryEmpM);

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
          rule: `Article statutory multiplier: ${multiplier}x basic rate`,
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
          isNational: isKuwaiti || isSaudi,
          employeeRate: empRateStr,
          employeeAmount: statutoryEmpM.toDecimalString(),
          employerRate: emplyrRateStr,
          employerAmount: statutoryEmplyrM.toDecimalString(),
          scheme: schemeName,
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
   * Complies with Kuwait Labor Law Art. 51 & 53 and Saudi Labor Law Art. 84.
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
    const diffMs = params.lastWorkingDate.getTime() - params.joiningDate.getTime();
    const serviceYears = Math.max(diffMs / (1000 * 60 * 60 * 24 * 365.25), 0);
    const basicM = Money.create(params.lastBasicSalary, curr);

    let indemnitySubunits = 0n;

    if (params.countryCode === 'KW') {
      // Kuwait Labor Law No. 6 of 2010 Art. 51:
      // First 5 years: 15 days remuneration per year worked (15/26 of monthly pay)
      // Beyond 5 years: 1 month remuneration (26/26) per year worked
      // Capped at 1.5 years' remuneration (18 months basic pay)
      const dailySubunits = basicM.toSubunits() / 26n;
      const first5Years = Math.min(serviceYears, 5);
      const after5Years = Math.max(serviceYears - 5, 0);

      const first5Subunits = BigInt(Math.round(first5Years * 15 * Number(dailySubunits)));
      const after5Subunits = BigInt(Math.round(after5Years * Number(basicM.toSubunits())));

      let totalGrossIndemnity = first5Subunits + after5Subunits;
      const maxCap = basicM.toSubunits() * 18n; // Capped at 1.5 years (18 months' basic salary)

      if (totalGrossIndemnity > maxCap) {
        totalGrossIndemnity = maxCap;
      }

      // Kuwait Art. 53: If employee resigns under unlimited contract:
      // < 3 years: 0%
      // 3 - 5 years: 50%
      // 5 - 10 years: 66.67%
      // >= 10 years: 100%
      if (params.terminationType === 'RESIGNATION' && params.contractType === 'UNLIMITED') {
        if (serviceYears < 3) totalGrossIndemnity = 0n;
        else if (serviceYears < 5) totalGrossIndemnity = totalGrossIndemnity / 2n;
        else if (serviceYears < 10) totalGrossIndemnity = BigInt(Math.round(Number(totalGrossIndemnity) * (2 / 3)));
      }

      indemnitySubunits = totalGrossIndemnity;
    } else {
      // Standard GCC / Saudi Art. 84:
      // Half month wage for first 5 years + 1 month wage for following years
      const halfMonthSubunits = basicM.toSubunits() / 2n;
      const first5Years = Math.min(serviceYears, 5);
      const after5Years = Math.max(serviceYears - 5, 0);

      let totalGross = BigInt(Math.round(first5Years * Number(halfMonthSubunits) + after5Years * Number(basicM.toSubunits())));

      // Saudi resignation scale (Art. 85): < 2 yrs: 0, 2-5 yrs: 1/3, 5-10 yrs: 2/3, >= 10: full
      if (params.terminationType === 'RESIGNATION') {
        if (serviceYears < 2) totalGross = 0n;
        else if (serviceYears < 5) totalGross = totalGross / 3n;
        else if (serviceYears < 10) totalGross = BigInt(Math.round(Number(totalGross) * (2 / 3)));
      }

      indemnitySubunits = totalGross;
    }

    const gratuityM = Money.fromSubunits(indemnitySubunits, curr);

    // Accrued leave payout (days * daily wage basic/26)
    const dailyWage = basicM.toSubunits() / 26n;
    const leavePayoutM = Money.fromSubunits(dailyWage * BigInt(params.accruedLeaveDays), curr);

    // Unpaid salary days
    const unpaidSalaryM = Money.fromSubunits(dailyWage * BigInt(params.unpaidSalaryDays), curr);

    // Loan deductions
    const loanBalM = Money.create(params.loanBalance || '0', curr);

    // Net settlement
    const netSubunits = gratuityM.toSubunits() + leavePayoutM.toSubunits() + unpaidSalaryM.toSubunits() - loanBalM.toSubunits();
    const netM = Money.fromSubunits(netSubunits < 0n ? 0n : netSubunits, curr);

    return {
      serviceYears: serviceYears.toFixed(2),
      gratuityAmount: gratuityM.toDecimalString(),
      accruedLeaveEncashment: leavePayoutM.toDecimalString(),
      unpaidSalary: unpaidSalaryM.toDecimalString(),
      loanDeductions: loanBalM.toDecimalString(),
      netSettlementAmount: netM.toDecimalString(),
      currency: curr,
      calculationDetails: {
        tenureYears: serviceYears.toFixed(2),
        basis: `${params.countryCode} Labor Law Statutory Formula`,
        lastSalary: basicM.toDecimalString(),
        gratuityGross: gratuityM.toDecimalString(),
        leaveEncashmentDays: params.accruedLeaveDays,
        leaveEncashmentAmount: leavePayoutM.toDecimalString(),
        unpaidDays: params.unpaidSalaryDays,
        unpaidAmount: unpaidSalaryM.toDecimalString(),
        loanRecovery: loanBalM.toDecimalString(),
        finalNetPayable: netM.toDecimalString(),
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
   * Generates standard CSV/Spreadsheet representation for Excel export.
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
