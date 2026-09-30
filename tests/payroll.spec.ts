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
      resultLines: [],
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

  it('should generate granular result lines with auditable calculation traces', () => {
    const input = {
      employeeId: 'emp_audited_01',
      employeeNumber: 'EMP-AUDIT-001',
      nameEn: 'Ahmad Al-Saleh',
      nameAr: 'أحمد الصالح',
      nationality: 'Kuwaiti',
      countryCode: 'KW',
      baseCurrency: 'KWD',
      basicSalary: '1200.000',
      housingAllowance: '300.000',
      transportAllowance: '50.000',
      otherAllowances: '20.000',
      overtimeMinutes: 180, // 3 hours
      unpaidLeaveDays: 2,
      loanMonthlyInstallment: '100.000',
      loanRemainingBalance: '800.000',
      adjustments: [
        { id: 'adj_1', type: 'BONUS', amount: '150.000', reason: 'Quarterly Performance' },
        { id: 'adj_2', type: 'PENALTY', amount: '25.000', reason: 'Safety Violation' },
      ],
      bankName: 'Gulf Bank',
      iban: 'KW99GB0000000000000000000000',
    };

    const result = PayrollCalculator.calculate(input);
    expect(result.resultLines.length).toBeGreaterThanOrEqual(7);

    // Verify individual result lines exist and have correct line types
    const basicLine = result.resultLines.find(l => l.componentCode === 'BASIC');
    expect(basicLine).toBeDefined();
    expect(basicLine?.amount).toBe('1200.000');
    expect(basicLine?.lineType).toBe('EARNING');

    const otLine = result.resultLines.find(l => l.componentCode === 'OVERTIME');
    expect(otLine).toBeDefined();
    expect(otLine?.lineType).toBe('EARNING');
    expect(otLine?.quantity).toBe('3.00 hrs');

    const bonusLine = result.resultLines.find(l => l.componentCode === 'BONUS');
    expect(bonusLine).toBeDefined();
    expect(bonusLine?.amount).toBe('150.000');

    const penaltyLine = result.resultLines.find(l => l.componentCode === 'PENALTY');
    expect(penaltyLine).toBeDefined();
    expect(penaltyLine?.lineType).toBe('DEDUCTION');

    const unpaidLine = result.resultLines.find(l => l.componentCode === 'UNPAID_LEAVE');
    expect(unpaidLine).toBeDefined();
    expect(unpaidLine?.quantity).toBe('2 days');

    const loanLine = result.resultLines.find(l => l.componentCode === 'LOAN_INSTALLMENT');
    expect(loanLine).toBeDefined();
    expect(loanLine?.amount).toBe('100.000');
  });

  it('should enforce statutory ceiling on Kuwait PIFSS (3,000 KWD)', () => {
    const input = {
      employeeId: 'emp_exec_01',
      employeeNumber: 'EMP-EXEC-001',
      nameEn: 'Mubarak Al-Sabah',
      nameAr: 'مبارك الصباح',
      nationality: 'Kuwaiti',
      countryCode: 'KW',
      baseCurrency: 'KWD',
      basicSalary: '4000.000', // Above 3000 KWD ceiling
      housingAllowance: '1000.000',
      transportAllowance: '200.000',
      otherAllowances: '0.000',
      overtimeMinutes: 0,
      unpaidLeaveDays: 0,
      loanMonthlyInstallment: '0.000',
      loanRemainingBalance: '0.000',
    };

    const result = PayrollCalculator.calculate(input);
    // PIFSS contribution base should be capped at 3000.000
    // Employee 10.5% on 3000 = 315.000 KWD
    expect(result.statutoryEmployeeContribution).toBe('315.000');
    // Employer 11.5% on 3000 = 345.000 KWD
    expect(result.statutoryEmployerContribution).toBe('345.000');
  });

  it('should evaluate custom mathematical formulas securely without eval()', async () => {
    const { FormulaEvaluator } = await import('../src/services/payroll/formula-evaluator.ts');

    const ctx = {
      BASIC: '1200.000',
      HOUSING: '300.000',
      DAYS_WORKED: '26',
    };

    // 1. Percentage formula
    const r1 = FormulaEvaluator.evaluate('BASIC * 0.15 + HOUSING * 0.10', ctx);
    // 1200 * 0.15 = 180, 300 * 0.10 = 30 -> 210.000
    expect(r1.toFixed(3)).toBe('210.000');

    // 2. Parentheses & precedence formula
    const r2 = FormulaEvaluator.evaluate('(BASIC + HOUSING) / 30 * 2', ctx);
    // 1500 / 30 = 50 * 2 = 100
    expect(r2.toFixed(3)).toBe('100.000');

    // 3. Syntax validation check
    expect(FormulaEvaluator.validate('BASIC * 0.20 + 50').isValid).toBe(true);
    expect(FormulaEvaluator.validate('BASIC * * 0.20').isValid).toBe(false);
  });

  it('should validate payroll batches and flag blocking and warning exceptions', async () => {
    const { PayrollValidatorService } = await import('../src/services/payroll/payroll-validator.service.ts');

    // Test with excessive deductions and negative net pay
    const invalidItems = [
      {
        employeeId: 'emp_err_1',
        employeeNumber: 'EMP-ERR-01',
        grossPay: '500.000',
        totalDeductions: '600.000', // Deductions exceed earnings
        netPay: '-100.000',
        currency: 'KWD',
      },
      {
        employeeId: 'emp_err_2',
        employeeNumber: 'EMP-ERR-02',
        grossPay: '800.000',
        totalDeductions: '450.000', // Exceeds 50%
        netPay: '350.000',
        currency: 'KWD',
      }
    ];

    const result = PayrollValidatorService.validatePostCalculation(invalidItems);
    expect(result.isValid).toBe(false); // Has blocking issue
    expect(result.blockingCount).toBe(1);
    expect(result.issues.some(i => i.code === 'NEGATIVE_NET_PAY')).toBe(true);
    expect(result.issues.some(i => i.code === 'EXCESSIVE_DEDUCTION_RATIO')).toBe(true);
  });

  it('should generate official corporate bilingual payslip PDF with valid PDF binary signature', async () => {
    const { PayslipPdfService } = await import('../src/services/payroll/payslip-pdf.service.ts');

    const pdfBuffer = await PayslipPdfService.generateSinglePayslip({
      companyNameEn: 'GulfHive Global Logistics W.L.L.',
      companyNameAr: 'شركة جلف هايف للخدمات اللوجستية ذ.م.م',
      companyCr: '12345678',
      periodYear: 2026,
      periodMonth: 9,
      runNumber: 'PRUN-2026-09-0001',
      employeeNumber: 'EMP-2026-0045',
      employeeNameEn: 'Khaled Al-Rashidi',
      employeeNameAr: 'خالد الرشيدي',
      departmentName: 'Operations',
      designationName: 'Senior Logistics Specialist',
      bankName: 'National Bank of Kuwait',
      iban: 'KW00NBK0000000000000000000000',
      currency: 'KWD',
      basicSalary: '1200.000',
      housingAllowance: '300.000',
      transportAllowance: '50.000',
      otherAllowances: '0.000',
      overtimeAmount: '0.000',
      overtimeHours: '0.00',
      unpaidLeaveDeduction: '0.000',
      unpaidLeaveDays: 0,
      loanDeduction: '0.000',
      statutoryEmployeeContribution: '162.750',
      statutoryEmployerContribution: '178.250',
      grossPay: '1550.000',
      totalDeductions: '162.750',
      netPay: '1387.250',
    });

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    // Standard PDF file signature check
    const header = pdfBuffer.slice(0, 5).toString('ascii');
    expect(header).toBe('%PDF-');
  });
});
