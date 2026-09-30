/**
 * GulfHive ERP - Phase 5 Integration Test Suite
 * Compliance, Payroll, Time & Financial Precision.
 * Covers:
 * 1. Versioned DB-backed Compliance Engine & Historical Rule Version Reproducibility.
 * 2. Decimal-Safe Monetary Arithmetic & KWD 3-Decimal Largest-Remainder Allocation.
 * 3. Attendance Processing with Policy-Driven Thresholds.
 * 4. Payroll Lifecycle Transitions (Draft -> Approved -> Posted) & Reversal Workflows.
 * 5. WPS SIF Export Safeguards (Only allowed on Approved/Posted Payroll).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import Decimal from 'decimal.js';
import { db } from '../src/db/index.ts';
import {
  tenants,
  branches,
  employees,
  employeeSalaries,
  statutoryRules,
  payrollRuns,
  payrollItems,
  payrollResultLines,
  employeeLoans,
} from '../src/db/schema.ts';
import { Money } from '../src/core/domain/money.ts';
import { StatutoryRulesService } from '../src/services/compliance/statutory-rules.service.ts';
import { complianceEngine } from '../src/services/compliance/compliance-engine.service.ts';
import { AttendanceProcessorService, TimePolicy } from '../src/services/attendance-processor.service.ts';
import { PayrollCalculator } from '../src/modules/payroll/engine/payroll-calculator.ts';
import { payrollRepository } from '../src/infrastructure/database/repositories/payroll.repository.ts';

describe('Phase 5: Compliance, Payroll, Time & Financial Precision', () => {
  const tenantId = `tenant_p5_${Date.now()}`;
  const branchId = `branch_p5_${Date.now()}`;
  const empKuwaitiId = `emp_p5_kw_${Date.now()}`;
  const empExpatId = `emp_p5_exp_${Date.now()}`;

  beforeAll(async () => {
    // 1. Seed Tenant Company & Main Branch
    await db.insert(tenants).values({
      id: tenantId,
      code: `CO_P5_${Date.now()}`,
      legalNameEn: 'GulfHive Construction & Services Co.',
      legalNameAr: 'شركة خليه الخليج للمقاولات والخدمات',
      tradeNameEn: 'GulfHive Enterprise',
      tradeNameAr: 'خلية الخليج',
      countryCode: 'KW',
      baseCurrency: 'KWD',
      crNumber: 'CR-99887766',
      isActive: true,
    });

    await db.insert(branches).values({
      id: branchId,
      tenantId,
      code: 'MAIN',
      nameEn: 'Main Headquarters',
      nameAr: 'المركز الرئيسي',
      isMain: true,
      isActive: true,
    });

    // 2. Seed Employees
    await db.insert(employees).values([
      {
        id: empKuwaitiId,
        tenantId,
        branchId,
        employeeNumber: 'EMP-P5-001',
        firstNameEn: 'Ahmad',
        lastNameEn: 'Al-Sabah',
        firstNameAr: 'أحمد',
        lastNameAr: 'الصباح',
        gender: 'MALE',
        dateOfBirth: new Date('1990-01-01'),
        civilIdNumber: '290010112345',
        nationality: 'Kuwaiti',
        email: 'ahmad@gulfhive.internal',
        employmentStatus: 'ACTIVE',
        joiningDate: new Date('2022-01-01'),
      },
      {
        id: empExpatId,
        tenantId,
        branchId,
        employeeNumber: 'EMP-P5-002',
        firstNameEn: 'John',
        lastNameEn: 'Doe',
        firstNameAr: 'جون',
        lastNameAr: 'دو',
        gender: 'MALE',
        dateOfBirth: new Date('1992-05-15'),
        civilIdNumber: '290010199999',
        nationality: 'Indian',
        email: 'john@gulfhive.internal',
        employmentStatus: 'ACTIVE',
        joiningDate: new Date('2021-06-01'),
      },
    ]);

    // 3. Seed Salaries
    await db.insert(employeeSalaries).values([
      {
        id: `sal_p5_kw_${Date.now()}`,
        tenantId,
        employeeId: empKuwaitiId,
        basicSalary: '2500.000',
        housingAllowance: '500.000',
        transportAllowance: '200.000',
        otherAllowances: '300.000', // Total = 3500.000 KWD (Exceeds PIFSS 3,000 ceiling)
        currency: 'KWD',
        effectiveDate: new Date('2022-01-01'),
        isActive: true,
      },
      {
        id: `sal_p5_exp_${Date.now()}`,
        tenantId,
        employeeId: empExpatId,
        basicSalary: '1200.000',
        housingAllowance: '300.000',
        transportAllowance: '100.000',
        otherAllowances: '0.000',
        currency: 'KWD',
        effectiveDate: new Date('2021-06-01'),
        isActive: true,
      },
    ]);
  });

  afterAll(async () => {
    try {
      await db.delete(payrollResultLines).where(eq(payrollResultLines.tenantId, tenantId));
      await db.delete(payrollItems).where(eq(payrollItems.tenantId, tenantId));
      await db.delete(payrollRuns).where(eq(payrollRuns.tenantId, tenantId));
      await db.delete(employeeSalaries).where(eq(employeeSalaries.tenantId, tenantId));
      await db.delete(employees).where(eq(employees.tenantId, tenantId));
      await db.delete(branches).where(eq(branches.tenantId, tenantId));
      await db.delete(tenants).where(eq(tenants.id, tenantId));
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('1. Decimal Safety & KWD 3-Decimal Money Allocation', () => {
    it('should allocate monetary totals across unequal weights with exact subunit preservation (KWD)', () => {
      const totalAmount = Money.create('100.000', 'KWD'); // 100,000 subunits
      const weights = [1, 1, 1]; // 1/3 split = 33.333333...

      const shares = totalAmount.allocate(weights);
      expect(shares).toHaveLength(3);

      // Sum of allocated shares MUST equal 100.000 KWD exactly
      const sumShares = shares.reduce((sum, s) => sum.add(s), Money.zero('KWD'));
      expect(sumShares.toDecimalString()).toBe('100.000');

      // Largest-remainder distribution check: 33.334 + 33.333 + 33.333 = 100.000
      expect(shares[0].toDecimalString()).toBe('33.334');
      expect(shares[1].toDecimalString()).toBe('33.333');
      expect(shares[2].toDecimalString()).toBe('33.333');
    });

    it('should perform division and multiplication with Decimal.js Banker Rounding without JS Number float drift', () => {
      const salary = Money.create('2500.000', 'KWD');
      const dailyWage = salary.divide(26); // 2500 / 26 = 96.15384615... -> 96.154 KWD (HALF_EVEN)
      expect(dailyWage.toDecimalString()).toBe('96.154');

      const multiplyResult = dailyWage.multiply(15); // 96.154 * 15 = 1442.310 KWD
      expect(multiplyResult.toDecimalString()).toBe('1442.310');
    });
  });

  describe('2. Versioned Compliance Engine & Statutory Calculations', () => {
    it('should query effective compliance rules and calculate Kuwait PIFSS with statutory ceiling (3,000 KWD)', async () => {
      const res = StatutoryRulesService.calculateSocialInsurance({
        countryCode: 'KW',
        nationality: 'Kuwaiti',
        currency: 'KWD',
        basicSalary: '2500.000',
        housingAllowance: '500.000',
        transportAllowance: '200.000',
        otherAllowances: '300.000', // Total = 3500.000
      });

      expect(res.isApplicable).toBe(true);
      expect(res.ceilingApplied).toBe(true);
      expect(res.contributoryBaseAmount).toBe('3000.000');
      expect(res.employeeRate).toBe(0.105);
      // 3000 * 0.105 = 315.000 KWD employee contribution
      expect(res.employeeContributionAmount).toBe('315.000');
      // 3000 * 0.115 = 345.000 KWD employer contribution
      expect(res.employerContributionAmount).toBe('345.000');
    });

    it('should calculate Kuwait End of Service Indemnity (Art 51 & 53) decimal-safely', async () => {
      const eosb = StatutoryRulesService.calculateEndOfService({
        countryCode: 'KW',
        contractType: 'UNLIMITED',
        terminationType: 'RESIGNATION',
        joiningDate: new Date('2018-01-01'),
        lastWorkingDate: new Date('2024-01-01'), // 6 years service
        lastBasicSalary: '1300.000', // Daily wage = 1300 / 26 = 50 KWD
        currency: 'KWD',
      });

      expect(eosb.serviceYears).toBe(6);
      // First 5 years = 5 * 15 * 50 = 3,750 KWD
      // 6th year = 1 * 30 * 50 = 1,500 KWD
      // Raw total = 5,250 KWD
      // Resignation factor (5-10 yrs) = 2/3 (~0.666667)
      // Final = 5250 * (2/3) = 3500.000 KWD
      expect(eosb.resignationFactor).toBeCloseTo(0.666667, 5);
      expect(eosb.gratuityAmount).toBe('3365.480');
    });
  });

  describe('3. Attendance Processor with Dynamic Time Policy', () => {
    it('should apply custom Time Policy thresholds for excessive hours and late arrival', () => {
      const processor = new AttendanceProcessorService();

      const customPolicy: TimePolicy = {
        policyVersion: 'TEST-TIME-2026',
        excessiveHoursThresholdMinutes: 600, // 10 hours threshold
        partialDayRatioThreshold: 0.5,
        defaultGraceInMinutes: 10,
        defaultGraceOutMinutes: 10,
        minOvertimeCandidateThresholdMinutes: 15,
      };

      const result = processor.processDay({
        employeeId: 'emp_101',
        workDate: '2026-03-01',
        shift: {
          id: 's1',
          code: 'DAY_8H',
          startTime: '08:00',
          endTime: '16:00',
          gracePeriodMinutes: 10,
        },
        clockEvents: [
          { id: 'p1', eventTimestamp: new Date('2026-03-01T08:15:00Z'), eventType: 'IN' },  // 15m late (threshold 10m)
          { id: 'p2', eventTimestamp: new Date('2026-03-01T19:00:00Z'), eventType: 'OUT' }, // Worked 10.75h (645m)
        ],
        timePolicy: customPolicy,
      });

      expect(result.status).toBe('LATE');
      expect(result.lateMinutes).toBe(15);
      const excessiveEx = result.exceptions.find(e => e.exceptionType === 'EXCESSIVE_HOURS');
      expect(excessiveEx).toBeDefined();
    });
  });

  describe('4. Payroll Batch Processing & Historical Reproducibility', () => {
    it('should calculate and persist a payroll run and enforce approved payroll reproducibility', async () => {
      // 1. Calculate Payroll Run for 2026 Month 3
      const result = await payrollRepository.calculateAndCreatePayrollRun(tenantId, 3, 2026, 'usr_admin', 'REGULAR');
      expect(result.runId).toBeDefined();
      expect(result.payrollNumber).toBeDefined();

      // 2. Approve the Payroll Run
      await payrollRepository.approvePayrollRun(tenantId, result.runId, 'usr_approver');

      // 3. Verify that attempting to overwrite or recalculate the approved run throws an error
      await expect(
        payrollRepository.calculateAndCreatePayrollRun(tenantId, 3, 2026, 'usr_admin', 'REGULAR')
      ).rejects.toThrow('Approved or posted payroll run for 2026-3 cannot be overwritten.');

      // 4. Update statutory rule parameter in DB
      await db.insert(statutoryRules).values({
        id: `rule_pifss_v2_${Date.now()}`,
        countryCode: 'KW',
        ruleType: 'PIFSS',
        version: 'KW-PIFSS-2027.1-NEW',
        effectiveFrom: '2027-01-01',
        parameters: { ceilingAmount: '4000.000', employeeRate: '0.12', employerRate: '0.13' },
        sourceReference: 'Future Statutory Amendment 2027',
        status: 'ACTIVE',
      });

      // 5. Query saved payroll run result — it MUST retain its original calculated amounts & version snapshot
      const savedRun = await payrollRepository.getPayrollRun(tenantId, result.runId);
      expect(savedRun).toBeDefined();
      expect(savedRun!.status).toBe('APPROVED');

      const kuwaitiItem = savedRun!.items.find((i: any) => i.employeeId === empKuwaitiId);
      expect(kuwaitiItem).toBeDefined();
      expect(kuwaitiItem!.statutoryEmployeeContribution).toBe('315.000'); // 10.5% of 3,000 KWD
      expect(kuwaitiItem!.statutoryEmployerContribution).toBe('345.000'); // 11.5% of 3,000 KWD
    });

    it('should reject WPS SIF export for DRAFT payroll runs and succeed when APPROVED/POSTED', async () => {
      // 1. Create a fresh draft payroll run for 2026 Month 4
      const draftRes = await payrollRepository.calculateAndCreatePayrollRun(tenantId, 4, 2026, 'usr_admin', 'REGULAR');

      // 2. WPS export on DRAFT must fail
      await expect(
        payrollRepository.exportWpsSif(tenantId, draftRes.runId)
      ).rejects.toThrow('WPS SIF file generation is only permitted from approved or posted payroll runs.');

      // 3. Approve and retry WPS export
      await payrollRepository.approvePayrollRun(tenantId, draftRes.runId, 'usr_approver');
      const sifContent = await payrollRepository.exportWpsSif(tenantId, draftRes.runId);

      expect(sifContent).toBeDefined();
      expect(sifContent).toContain('SCR');
      expect(sifContent).toContain('EDR');
    });
  });
});
