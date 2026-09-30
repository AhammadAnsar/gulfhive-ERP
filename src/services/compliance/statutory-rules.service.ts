/**
 * GulfHive ERP - Versioned Country Compliance Engine
 * Encapsulates statutory social insurance, overtime multipliers, and labor law indemnity rules.
 * Keeps legal specifics isolated from generic payroll domain logic.
 */

import { Money } from '../../core/domain/money.ts';

export interface StatutorySocialInsuranceResult {
  isApplicable: boolean;
  schemeName: string;
  ruleVersion: string;
  contributoryBaseAmount: string;
  employeeRate: number;
  employeeContributionAmount: string;
  employerRate: number;
  employerContributionAmount: string;
  ceilingApplied: boolean;
  ceilingAmount?: string;
  sourceReference: string;
}

export interface StatutoryOvertimeRule {
  hourlyBaseDivisor: number; // e.g. 240 hours (30 days * 8h)
  regularDayMultiplier: number;
  restDayMultiplier: number;
  holidayMultiplier: number;
  ruleVersion: string;
  sourceReference: string;
}

export interface StatutoryEosbCalculationResult {
  serviceYears: number;
  serviceMonths: number;
  serviceDays: number;
  eligibleSalaryBase: string;
  gratuityAmount: string;
  resignationFactor: number;
  ruleVersion: string;
  sourceReference: string;
  breakdown: {
    firstPeriodYears: number;
    firstPeriodAmount: string;
    secondPeriodYears: number;
    secondPeriodAmount: string;
    statutoryCapAmount: string;
    isCapped: boolean;
  };
}

export class StatutoryRulesService {
  /**
   * Determine social insurance contributions (PIFSS in Kuwait, GOSI in Saudi, etc.)
   */
  public static calculateSocialInsurance(params: {
    countryCode: string;
    nationality: string;
    currency: string;
    basicSalary: string;
    housingAllowance: string;
    transportAllowance: string;
    otherAllowances: string;
    asOfDate?: Date;
  }): StatutorySocialInsuranceResult {
    const { countryCode, nationality, currency, basicSalary, housingAllowance, transportAllowance, otherAllowances } = params;
    const basicM = Money.create(basicSalary, currency);
    const housingM = Money.create(housingAllowance, currency);
    const transportM = Money.create(transportAllowance, currency);
    const otherM = Money.create(otherAllowances, currency);

    const isKuwait = countryCode.toUpperCase() === 'KW';
    const isSaudi = countryCode.toUpperCase() === 'SA';
    const isBahrain = countryCode.toUpperCase() === 'BH';
    const isUAE = countryCode.toUpperCase() === 'AE';

    const isCitizen = this.isNational(countryCode, nationality);

    // 1. KUWAIT — PIFSS (Public Institution for Social Security)
    if (isKuwait) {
      if (!isCitizen) {
        return {
          isApplicable: false,
          schemeName: 'Kuwait Expatriate Labor Regime (Statutory Gratuity Only)',
          ruleVersion: 'KW-PIFSS-2026.1',
          contributoryBaseAmount: '0.000',
          employeeRate: 0,
          employeeContributionAmount: '0.000',
          employerRate: 0,
          employerContributionAmount: '0.000',
          ceilingApplied: false,
          sourceReference: 'Kuwait Social Security Law (Amiri Decree 61/1976)',
        };
      }

      // Contributory base = Basic + Regular allowances, capped at 3,000.000 KWD
      const totalContributoryM = basicM.add(housingM).add(transportM).add(otherM);
      const ceilingM = Money.create('3000.000', currency);
      const isCapped = totalContributoryM.toSubunits() > ceilingM.toSubunits();
      const effectiveBaseM = isCapped ? ceilingM : totalContributoryM;

      // Rates: Employee 10.5%, Employer 11.5% (Total 22%)
      const empRate = 0.105;
      const emplyrRate = 0.115;
      const empSubunits = BigInt(Math.round(Number(effectiveBaseM.toSubunits()) * empRate));
      const emplyrSubunits = BigInt(Math.round(Number(effectiveBaseM.toSubunits()) * emplyrRate));

      return {
        isApplicable: true,
        schemeName: 'Kuwait Public Institution for Social Security (PIFSS)',
        ruleVersion: 'KW-PIFSS-2026.1',
        contributoryBaseAmount: effectiveBaseM.toDecimalString(),
        employeeRate: empRate,
        employeeContributionAmount: Money.fromSubunits(empSubunits, currency).toDecimalString(),
        employerRate: emplyrRate,
        employerContributionAmount: Money.fromSubunits(emplyrSubunits, currency).toDecimalString(),
        ceilingApplied: isCapped,
        ceilingAmount: '3000.000',
        sourceReference: 'Amiri Decree Law No. 61 of 1976 & Ministerial Decrees on Contribution Ceilings',
      };
    }

    // 2. SAUDI ARABIA — GOSI (General Organization for Social Insurance)
    if (isSaudi) {
      if (!isCitizen) {
        // Expatriate workers in KSA have 2% Employer Occupational Hazards contribution
        const expatBaseM = basicM.add(housingM);
        const expatCeilingM = Money.create('45000.00', currency);
        const effectiveExpatBaseM = expatBaseM.toSubunits() > expatCeilingM.toSubunits() ? expatCeilingM : expatBaseM;
        const expatEmplyrSubunits = BigInt(Math.round(Number(effectiveExpatBaseM.toSubunits()) * 0.02));

        return {
          isApplicable: true,
          schemeName: 'Saudi GOSI — Occupational Hazards Branch (Expatriates)',
          ruleVersion: 'SA-GOSI-2026.1',
          contributoryBaseAmount: effectiveExpatBaseM.toDecimalString(),
          employeeRate: 0,
          employeeContributionAmount: '0.00',
          employerRate: 0.02,
          employerContributionAmount: Money.fromSubunits(expatEmplyrSubunits, currency).toDecimalString(),
          ceilingApplied: expatBaseM.toSubunits() > expatCeilingM.toSubunits(),
          ceilingAmount: '45000.00',
          sourceReference: 'Saudi Social Insurance Law (Royal Decree M/33)',
        };
      }

      // Saudi Nationals: 9.75% Employee (9% Annuities + 0.75% SANED), 11.75% Employer (9% Annuities + 0.75% SANED + 2% Hazards)
      const totalContributoryM = basicM.add(housingM);
      const ceilingM = Money.create('45000.00', currency);
      const isCapped = totalContributoryM.toSubunits() > ceilingM.toSubunits();
      const effectiveBaseM = isCapped ? ceilingM : totalContributoryM;

      const empRate = 0.0975;
      const emplyrRate = 0.1175;
      const empSubunits = BigInt(Math.round(Number(effectiveBaseM.toSubunits()) * empRate));
      const emplyrSubunits = BigInt(Math.round(Number(effectiveBaseM.toSubunits()) * emplyrRate));

      return {
        isApplicable: true,
        schemeName: 'Saudi General Organization for Social Insurance (GOSI & SANED)',
        ruleVersion: 'SA-GOSI-2026.1',
        contributoryBaseAmount: effectiveBaseM.toDecimalString(),
        employeeRate: empRate,
        employeeContributionAmount: Money.fromSubunits(empSubunits, currency).toDecimalString(),
        employerRate: emplyrRate,
        employerContributionAmount: Money.fromSubunits(emplyrSubunits, currency).toDecimalString(),
        ceilingApplied: isCapped,
        ceilingAmount: '45000.00',
        sourceReference: 'Royal Decree M/33 & Unemployment Insurance (SANED) Royal Decree M/18',
      };
    }

    // 3. BAHRAIN — SIO (Social Insurance Organization)
    if (isBahrain && isCitizen) {
      const baseM = basicM.add(housingM);
      const ceilingM = Money.create('4000.000', currency);
      const effectiveBaseM = baseM.toSubunits() > ceilingM.toSubunits() ? ceilingM : baseM;
      const empSubunits = BigInt(Math.round(Number(effectiveBaseM.toSubunits()) * 0.08)); // 7% pension + 1% unemployment
      const emplyrSubunits = BigInt(Math.round(Number(effectiveBaseM.toSubunits()) * 0.15)); // 12% + 3% hazards

      return {
        isApplicable: true,
        schemeName: 'Bahrain Social Insurance Organization (SIO)',
        ruleVersion: 'BH-SIO-2026.1',
        contributoryBaseAmount: effectiveBaseM.toDecimalString(),
        employeeRate: 0.08,
        employeeContributionAmount: Money.fromSubunits(empSubunits, currency).toDecimalString(),
        employerRate: 0.15,
        employerContributionAmount: Money.fromSubunits(emplyrSubunits, currency).toDecimalString(),
        ceilingApplied: baseM.toSubunits() > ceilingM.toSubunits(),
        ceilingAmount: '4000.000',
        sourceReference: 'Bahrain Decree-Law No. 24 of 1976',
      };
    }

    // Default / Non-national / Other countries
    return {
      isApplicable: false,
      schemeName: 'Standard Labor Gratuity Regime',
      ruleVersion: 'GCC-GEN-2026.1',
      contributoryBaseAmount: '0.000',
      employeeRate: 0,
      employeeContributionAmount: '0.000',
      employerRate: 0,
      employerContributionAmount: '0.000',
      ceilingApplied: false,
      sourceReference: 'General Labor Law Provisions',
    };
  }

  /**
   * Statutory Overtime Policy lookup for Country
   */
  public static getOvertimePolicy(countryCode: string): StatutoryOvertimeRule {
    const code = countryCode.toUpperCase();
    if (code === 'KW') {
      return {
        hourlyBaseDivisor: 240, // 30 days * 8h standard labor month
        regularDayMultiplier: 1.25, // Article 66: 125% of regular hourly wage
        restDayMultiplier: 1.50,    // Rest day: 150% + compensatory day off
        holidayMultiplier: 2.00,    // Public holiday: 200% of regular wage
        ruleVersion: 'KW-LL-ART66-2026',
        sourceReference: 'Kuwait Private Sector Labor Law No. 6 of 2010, Article 66',
      };
    }

    if (code === 'SA') {
      return {
        hourlyBaseDivisor: 240,
        regularDayMultiplier: 1.50, // Saudi Labor Law Art 107: 100% + 50% = 1.50x
        restDayMultiplier: 1.50,
        holidayMultiplier: 1.50,
        ruleVersion: 'SA-LL-ART107-2026',
        sourceReference: 'Saudi Labor Law (Royal Decree No. M/51), Article 107',
      };
    }

    // Default GCC Standard
    return {
      hourlyBaseDivisor: 240,
      regularDayMultiplier: 1.25,
      restDayMultiplier: 1.50,
      holidayMultiplier: 2.00,
      ruleVersion: 'GCC-OT-STD-2026',
      sourceReference: 'Unified GCC Labor Standards Framework',
    };
  }

  /**
   * End of Service Indemnity / Gratuity calculation
   */
  public static calculateEndOfService(params: {
    countryCode: string;
    contractType: 'UNLIMITED' | 'LIMITED';
    terminationType: 'RESIGNATION' | 'TERMINATION' | 'END_OF_CONTRACT';
    joiningDate: Date;
    lastWorkingDate: Date;
    lastBasicSalary: string;
    currency: string;
  }): StatutoryEosbCalculationResult {
    const { countryCode, contractType, terminationType, joiningDate, lastWorkingDate, lastBasicSalary, currency } = params;
    const diffMs = Math.max(lastWorkingDate.getTime() - joiningDate.getTime(), 0);
    const serviceDaysTotal = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const serviceYears = serviceDaysTotal / 365.25;

    const basicM = Money.create(lastBasicSalary, currency);

    if (countryCode.toUpperCase() === 'KW') {
      // Kuwait Labor Law Article 51:
      // - First 5 years: 15 days basic wage per year (Daily rate = basic / 26 working days)
      // - Above 5 years: 30 days basic wage per year
      // - Cap: Maximum total indemnity is 1.5 years of basic salary (18 months = basic * 1.5)
      const dailyWageM = Money.create(Number(basicM.amount) / 26, currency);

      const first5Years = Math.min(serviceYears, 5);
      const remainingYears = Math.max(serviceYears - 5, 0);

      const first5AmountM = Money.create(Number(dailyWageM.amount) * 15 * first5Years, currency);
      const remainingAmountM = Money.create(Number(basicM.amount) * remainingYears, currency);
      const rawGratuityM = first5AmountM.add(remainingAmountM);

      // Statutory Cap: 18 months of basic salary (1.5 years remuneration)
      const capM = Money.create(Number(basicM.amount) * 18, currency);
      const isCapped = rawGratuityM.toSubunits() > capM.toSubunits();
      const cappedGratuityM = isCapped ? capM : rawGratuityM;

      // Article 53: Resignation Factor for UNLIMITED contracts:
      // Less than 3 years: 0%
      // 3 to 5 years: 50%
      // 5 to 10 years: 2/3 (~66.6667%)
      // 10 years or more: 100%
      // Involuntary Termination / End of Contract: 100%
      let factor = 1.0;
      if (terminationType === 'RESIGNATION' && contractType === 'UNLIMITED') {
        if (serviceYears < 3) factor = 0.0;
        else if (serviceYears < 5) factor = 0.5;
        else if (serviceYears < 10) factor = 2 / 3;
        else factor = 1.0;
      }

      const finalGratuityM = Money.create(Number(cappedGratuityM.amount) * factor, currency);

      return {
        serviceYears: Number(serviceYears.toFixed(2)),
        serviceMonths: Math.floor((serviceDaysTotal % 365) / 30),
        serviceDays: serviceDaysTotal % 30,
        eligibleSalaryBase: basicM.toDecimalString(),
        gratuityAmount: finalGratuityM.toDecimalString(),
        resignationFactor: factor,
        ruleVersion: 'KW-LL-ART51-53-2026',
        sourceReference: 'Kuwait Labor Law No. 6/2010 Articles 51 & 53',
        breakdown: {
          firstPeriodYears: Number(first5Years.toFixed(2)),
          firstPeriodAmount: first5AmountM.toDecimalString(),
          secondPeriodYears: Number(remainingYears.toFixed(2)),
          secondPeriodAmount: remainingAmountM.toDecimalString(),
          statutoryCapAmount: capM.toDecimalString(),
          isCapped,
        },
      };
    }

    // Default / Saudi Labor Law Art. 84:
    // Half month wage for first 5 years, one month wage for each subsequent year
    const first5 = Math.min(serviceYears, 5);
    const after5 = Math.max(serviceYears - 5, 0);
    const halfMonthM = Money.create(Number(basicM.amount) * 0.5 * first5, currency);
    const fullMonthM = Money.create(Number(basicM.amount) * after5, currency);
    const totalGratuityM = halfMonthM.add(fullMonthM);

    return {
      serviceYears: Number(serviceYears.toFixed(2)),
      serviceMonths: Math.floor((serviceDaysTotal % 365) / 30),
      serviceDays: serviceDaysTotal % 30,
      eligibleSalaryBase: basicM.toDecimalString(),
      gratuityAmount: totalGratuityM.toDecimalString(),
      resignationFactor: 1.0,
      ruleVersion: 'GCC-EOSB-STD-2026',
      sourceReference: 'Saudi Labor Law Royal Decree M/51 Article 84',
      breakdown: {
        firstPeriodYears: Number(first5.toFixed(2)),
        firstPeriodAmount: halfMonthM.toDecimalString(),
        secondPeriodYears: Number(after5.toFixed(2)),
        secondPeriodAmount: fullMonthM.toDecimalString(),
        statutoryCapAmount: 'No Statutory Cap',
        isCapped: false,
      },
    };
  }

  private static isNational(countryCode: string, nationality: string): boolean {
    if (!nationality) return false;
    const nat = nationality.toLowerCase().trim();
    const c = countryCode.toUpperCase();

    if (c === 'KW') {
      return nat.includes('kuwait') || nat.includes('كويت');
    }
    if (c === 'SA') {
      return nat.includes('saudi') || nat.includes('سعود');
    }
    if (c === 'BH') {
      return nat.includes('bahrain') || nat.includes('بحرين');
    }
    if (c === 'AE') {
      return nat.includes('emirati') || nat.includes('uae') || nat.includes('إمارات');
    }
    if (c === 'QA') {
      return nat.includes('qatar') || nat.includes('قطر');
    }
    if (c === 'OM') {
      return nat.includes('oman') || nat.includes('عمان');
    }
    return false;
  }
}
