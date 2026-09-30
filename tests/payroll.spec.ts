import { describe, it, expect } from 'vitest';
import { PayrollCalculator } from '../src/modules/payroll/engine/payroll-calculator.ts';
import { Money } from '../src/core/domain/money.ts';

describe('Payroll Deterministic Engine & Statutory Compliance', () => {
  it('should deterministically calculate net pay with decimal precision for Kuwaiti national', () => {
    const input = {
      employeeId: 'emp_01',
      employeeNumber: 'EMP-001',
      nameEn: 'Tariq Al-Mutawa',
      nameAr: 'طارق المطوع',
      nationality: 'Kuwaiti',
      countryCode: 'KW',
      baseCurrency: 'KWD',
      basicSalary: '1000.000',
      housingAllowance: '200.000',
      transportAllowance: '50.000',
      otherAllowances: '0.000',
      overtimeMinutes: 120, // 2 hours overtime -> 1000/240 * 2 * 1.25 = 10.417 KWD
      unpaidLeaveDays: 1, // 1 day unpaid -> 1000/30 = 33.333 KWD
      loanMonthlyInstallment: '50.000',
      loanRemainingBalance: '500.000',
      bankName: 'National Bank of Kuwait',
      iban: 'KW00NBK0000000000000000000000',
    };

    const result = PayrollCalculator.calculate(input);

    // Regular package: 1000 + 200 + 50 = 1250.000
    // PIFSS 10.5% on 1250: 131.250 KWD
    expect(result.statutoryEmployeeContribution).toBe('131.250');
    expect(result.statutoryEmployerContribution).toBe('143.750'); // 11.5%

    // Net pay = Gross - Total Deductions
    const grossM = Money.create(result.grossPay, 'KWD');
    const dedM = Money.create(result.totalDeductions, 'KWD');
    const netM = Money.create(result.netPay, 'KWD');

    expect(grossM.subtract(dedM).toDecimalString()).toBe(netM.toDecimalString());
    expect(result.calculationBreakdown.summary.net).toBe(result.netPay);
  });

  it('should not deduct PIFSS from expatriate workers and apply standard gratuity regime', () => {
    const input = {
      employeeId: 'emp_02',
      employeeNumber: 'EMP-002',
      nameEn: 'John Doe',
      nameAr: 'جون دو',
      nationality: 'British',
      countryCode: 'KW',
      baseCurrency: 'KWD',
      basicSalary: '800.000',
      housingAllowance: '150.000',
      transportAllowance: '50.000',
      otherAllowances: '0.000',
      overtimeMinutes: 0,
      unpaidLeaveDays: 0,
      loanMonthlyInstallment: '0.000',
      loanRemainingBalance: '0.000',
    };

    const result = PayrollCalculator.calculate(input);
    expect(result.statutoryEmployeeContribution).toBe('0.000');
    expect(result.statutoryEmployerContribution).toBe('0.000');
    expect(result.netPay).toBe('1000.000');
  });

  it('should correctly calculate Kuwait Labor Law Art. 51 & 53 End of Service Benefits (EOSB)', () => {
    // 6 years service, basic 1000 KWD, termination by employer
    const joining = new Date('2020-01-01');
    const lastDay = new Date('2026-01-01'); // exactly 6 years

    const settlement = PayrollCalculator.calculateEndofServiceIndemnity({
      countryCode: 'KW',
      contractType: 'UNLIMITED',
      terminationType: 'TERMINATION',
      joiningDate: joining,
      lastWorkingDate: lastDay,
      lastBasicSalary: '1000.000',
      accruedLeaveDays: 10,
      unpaidSalaryDays: 0,
      loanBalance: '200.000',
      currency: 'KWD',
    });

    // First 5 years: 5 * 15 * (1000/26) = 2884.615 KWD
    // 6th year: 1 * 1000 = 1000 KWD
    // Gratuity: ~3884.615 KWD
    expect(parseFloat(settlement.gratuityAmount)).toBeGreaterThan(3800);
    expect(parseFloat(settlement.loanDeductions)).toBe(200.000);
    expect(parseFloat(settlement.netSettlementAmount)).toBeGreaterThan(0);
  });

  it('should generate valid GCC Wage Protection System (WPS) SIF file', () => {
    const calcItem = {
      employeeId: 'emp_01',
      currency: 'KWD',
      basicSalary: '1000.000',
      housingAllowance: '200.000',
      transportAllowance: '50.000',
      otherAllowances: '0.000',
      overtimeAmount: '0.000',
      overtimeHours: '0.00',
      unpaidLeaveDeduction: '0.000',
      unpaidLeaveDays: 0,
      loanDeduction: '0.000',
      statutoryEmployeeContribution: '0.000',
      statutoryEmployerContribution: '0.000',
      grossPay: '1250.000',
      totalDeductions: '0.000',
      netPay: '1250.000',
      bankName: 'NBK',
      iban: 'KW00NBK0000000000000000000000',
      calculationBreakdown: {} as any,
    };

    const map = new Map();
    map.set('emp_01', { civilIdNumber: '290010101234' });

    const sif = PayrollCalculator.generateWpsSifFile({
      employerCr: 'CR-123456',
      payerBankCode: 'NBK-KW',
      valueDate: '2026-09-30',
      currency: 'KWD',
      items: [calcItem],
      employeeMasterMap: map,
    });

    const lines = sif.split('\n');
    expect(lines[0]).toContain('SCR,CR-123456,NBK-KW,20260930,1250.000,1,KWD');
    expect(lines[1]).toContain('EDR,1,290010101234,KW00NBK0000000000000000000000,KWD,1000.000');
  });
});
