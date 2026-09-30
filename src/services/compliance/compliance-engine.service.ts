import { eq, and, lte, or, sql } from 'drizzle-orm';
import Decimal from 'decimal.js';
import { db } from '../../db/index.ts';
import { statutoryRules } from '../../db/schema.ts';
import { Money } from '../../core/domain/money.ts';
import { logger } from '../../core/logging/logger.ts';

export interface IComplianceEngine {
  calculateSocialInsurance(params: {
    countryCode: string;
    nationality: string;
    currency: string;
    basicSalary: string;
    housingAllowance: string;
    transportAllowance: string;
    otherAllowances: string;
    asOfDate?: string | Date;
  }): Promise<{
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
  }>;

  getOvertimeRule(countryCode: string, asOfDate?: string | Date): Promise<{
    hourlyBaseDivisor: number;
    regularDayMultiplier: number;
    restDayMultiplier: number;
    holidayMultiplier: number;
    ruleVersion: string;
    sourceReference: string;
  }>;

  calculateEOSB(params: {
    countryCode: string;
    contractType: 'UNLIMITED' | 'LIMITED';
    terminationType: 'RESIGNATION' | 'TERMINATION' | 'END_OF_CONTRACT';
    joiningDate: Date;
    lastWorkingDate: Date;
    lastBasicSalary: string;
    currency: string;
    asOfDate?: string | Date;
  }): Promise<{
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
  }>;
}

export class ComplianceEngineService implements IComplianceEngine {
  private static instance: ComplianceEngineService;

  public static getInstance(): ComplianceEngineService {
    if (!ComplianceEngineService.instance) {
      ComplianceEngineService.instance = new ComplianceEngineService();
    }
    return ComplianceEngineService.instance;
  }

  public async getEffectiveRule(countryCode: string, ruleType: string, asOfDateStr?: string | Date) {
    const code = countryCode.toUpperCase();
    const dateStr = asOfDateStr
      ? (typeof asOfDateStr === 'string' ? asOfDateStr : asOfDateStr.toISOString().slice(0, 10))
      : new Date().toISOString().slice(0, 10);

    try {
      const [rule] = await db
        .select()
        .from(statutoryRules)
        .where(
          and(
            eq(statutoryRules.countryCode, code),
            eq(statutoryRules.ruleType, ruleType),
            eq(statutoryRules.status, 'ACTIVE'),
            lte(statutoryRules.effectiveFrom, dateStr),
            or(sql`${statutoryRules.effectiveTo} IS NULL`, sql`${statutoryRules.effectiveTo} >= ${dateStr}`)
          )
        )
        .orderBy(sql`${statutoryRules.effectiveFrom} DESC`)
        .limit(1);

      if (rule) return rule;
    } catch (err: any) {
      logger.debug(`Statutory rules query info: ${err.message}`);
    }

    // Fallback seed / default
    return this.getDefaultRuleFallback(code, ruleType);
  }

  public async calculateSocialInsurance(params: {
    countryCode: string;
    nationality: string;
    currency: string;
    basicSalary: string;
    housingAllowance: string;
    transportAllowance: string;
    otherAllowances: string;
    asOfDate?: string | Date;
  }) {
    const { countryCode, nationality, currency, basicSalary, housingAllowance, transportAllowance, otherAllowances, asOfDate } = params;
    const rule = await this.getEffectiveRule(countryCode, 'PIFSS', asOfDate) || await this.getEffectiveRule(countryCode, 'GOSI', asOfDate);

    const basicM = Money.create(basicSalary, currency);
    const housingM = Money.create(housingAllowance, currency);
    const transportM = Money.create(transportAllowance, currency);
    const otherM = Money.create(otherAllowances, currency);

    const isKuwait = countryCode.toUpperCase() === 'KW';
    const isSaudi = countryCode.toUpperCase() === 'SA';
    const isCitizen = this.isNational(countryCode, nationality);

    if (isKuwait) {
      if (!isCitizen) {
        return {
          isApplicable: false,
          schemeName: 'Kuwait Expatriate Labor Regime (Statutory Gratuity Only)',
          ruleVersion: rule?.version || 'KW-PIFSS-2026.1',
          contributoryBaseAmount: Money.zero(currency).toDecimalString(),
          employeeRate: 0,
          employeeContributionAmount: Money.zero(currency).toDecimalString(),
          employerRate: 0,
          employerContributionAmount: Money.zero(currency).toDecimalString(),
          ceilingApplied: false,
          sourceReference: rule?.sourceReference || 'Kuwait Social Security Law (Amiri Decree 61/1976)',
        };
      }

      const totalContributoryM = basicM.add(housingM).add(transportM).add(otherM);
      const paramsData = (rule?.parameters as any) || { ceilingAmount: '3000.000', employeeRate: '0.105', employerRate: '0.115' };
      const ceilingM = Money.create(paramsData.ceilingAmount || '3000.000', currency);
      const isCapped = totalContributoryM.greaterThan(ceilingM);
      const effectiveBaseM = isCapped ? ceilingM : totalContributoryM;

      const empRateStr = paramsData.employeeRate || '0.105';
      const emplyrRateStr = paramsData.employerRate || '0.115';

      const empM = effectiveBaseM.multiply(empRateStr);
      const emplyrM = effectiveBaseM.multiply(emplyrRateStr);

      return {
        isApplicable: true,
        schemeName: 'Kuwait Public Institution for Social Security (PIFSS)',
        ruleVersion: rule?.version || 'KW-PIFSS-2026.1',
        contributoryBaseAmount: effectiveBaseM.toDecimalString(),
        employeeRate: new Decimal(empRateStr).toNumber(),
        employeeContributionAmount: empM.toDecimalString(),
        employerRate: new Decimal(emplyrRateStr).toNumber(),
        employerContributionAmount: emplyrM.toDecimalString(),
        ceilingApplied: isCapped,
        ceilingAmount: ceilingM.toDecimalString(),
        sourceReference: rule?.sourceReference || 'Amiri Decree Law No. 61 of 1976 & Ministerial Decrees',
      };
    }

    if (isSaudi) {
      const paramsData = (rule?.parameters as any) || {
        ceilingAmount: '45000.00',
        citizenEmployeeRate: '0.0975',
        citizenEmployerRate: '0.1175',
        expatEmployerHazardRate: '0.02',
      };
      const ceilingM = Money.create(paramsData.ceilingAmount || '45000.00', currency);

      if (!isCitizen) {
        const expatBaseM = basicM.add(housingM);
        const isCapped = expatBaseM.greaterThan(ceilingM);
        const effectiveExpatBaseM = isCapped ? ceilingM : expatBaseM;
        const hazardRateStr = paramsData.expatEmployerHazardRate || '0.02';
        const expatEmplyrM = effectiveExpatBaseM.multiply(hazardRateStr);

        return {
          isApplicable: true,
          schemeName: 'Saudi GOSI — Occupational Hazards Branch (Expatriates)',
          ruleVersion: rule?.version || 'SA-GOSI-2026.1',
          contributoryBaseAmount: effectiveExpatBaseM.toDecimalString(),
          employeeRate: 0,
          employeeContributionAmount: Money.zero(currency).toDecimalString(),
          employerRate: new Decimal(hazardRateStr).toNumber(),
          employerContributionAmount: expatEmplyrM.toDecimalString(),
          ceilingApplied: isCapped,
          ceilingAmount: ceilingM.toDecimalString(),
          sourceReference: rule?.sourceReference || 'Saudi Social Insurance Law (Royal Decree M/33)',
        };
      }

      const totalContributoryM = basicM.add(housingM);
      const isCapped = totalContributoryM.greaterThan(ceilingM);
      const effectiveBaseM = isCapped ? ceilingM : totalContributoryM;

      const empRateStr = paramsData.citizenEmployeeRate || '0.0975';
      const emplyrRateStr = paramsData.citizenEmployerRate || '0.1175';

      const empM = effectiveBaseM.multiply(empRateStr);
      const emplyrM = effectiveBaseM.multiply(emplyrRateStr);

      return {
        isApplicable: true,
        schemeName: 'Saudi General Organization for Social Insurance (GOSI & SANED)',
        ruleVersion: rule?.version || 'SA-GOSI-2026.1',
        contributoryBaseAmount: effectiveBaseM.toDecimalString(),
        employeeRate: new Decimal(empRateStr).toNumber(),
        employeeContributionAmount: empM.toDecimalString(),
        employerRate: new Decimal(emplyrRateStr).toNumber(),
        employerContributionAmount: emplyrM.toDecimalString(),
        ceilingApplied: isCapped,
        ceilingAmount: ceilingM.toDecimalString(),
        sourceReference: rule?.sourceReference || 'Royal Decree M/33 & SANED Royal Decree M/18',
      };
    }

    return {
      isApplicable: false,
      schemeName: 'Standard Labor Gratuity Regime',
      ruleVersion: 'GCC-GEN-2026.1',
      contributoryBaseAmount: Money.zero(currency).toDecimalString(),
      employeeRate: 0,
      employeeContributionAmount: Money.zero(currency).toDecimalString(),
      employerRate: 0,
      employerContributionAmount: Money.zero(currency).toDecimalString(),
      ceilingApplied: false,
      sourceReference: 'General Labor Law Provisions',
    };
  }

  public async getOvertimeRule(countryCode: string, asOfDate?: string | Date) {
    const rule = await this.getEffectiveRule(countryCode, 'OVERTIME', asOfDate);
    const params = (rule?.parameters as any) || {};

    const code = countryCode.toUpperCase();
    const isSaudi = code === 'SA';

    return {
      hourlyBaseDivisor: params.hourlyBaseDivisor || 240,
      regularDayMultiplier: params.regularDayMultiplier ? new Decimal(params.regularDayMultiplier).toNumber() : (isSaudi ? 1.5 : 1.25),
      restDayMultiplier: params.restDayMultiplier ? new Decimal(params.restDayMultiplier).toNumber() : 1.5,
      holidayMultiplier: params.holidayMultiplier ? new Decimal(params.holidayMultiplier).toNumber() : (isSaudi ? 1.5 : 2.0),
      ruleVersion: rule?.version || (isSaudi ? 'SA-LL-ART107-2026' : 'KW-LL-ART66-2026'),
      sourceReference: rule?.sourceReference || (isSaudi ? 'Saudi Labor Law Article 107' : 'Kuwait Labor Law No. 6/2010 Article 66'),
    };
  }

  public async getTimePolicy(countryCode: string, asOfDate?: string | Date) {
    const rule = await this.getEffectiveRule(countryCode, 'TIME_POLICY', asOfDate);
    const params = (rule?.parameters as any) || {};

    return {
      policyVersion: rule?.version || 'GCC-TIME-2026.1',
      excessiveHoursThresholdMinutes: params.excessiveHoursThresholdMinutes || 720,
      partialDayRatioThreshold: params.partialDayRatioThreshold || 0.5,
      defaultGraceInMinutes: params.defaultGraceInMinutes || 15,
      defaultGraceOutMinutes: params.defaultGraceOutMinutes || 15,
      minOvertimeCandidateThresholdMinutes: params.minOvertimeCandidateThresholdMinutes || 15,
    };
  }

  public async calculateEOSB(params: {
    countryCode: string;
    contractType: 'UNLIMITED' | 'LIMITED';
    terminationType: 'RESIGNATION' | 'TERMINATION' | 'END_OF_CONTRACT';
    joiningDate: Date;
    lastWorkingDate: Date;
    lastBasicSalary: string;
    currency: string;
    asOfDate?: string | Date;
  }) {
    const { countryCode, contractType, terminationType, joiningDate, lastWorkingDate, lastBasicSalary, currency, asOfDate } = params;
    const rule = await this.getEffectiveRule(countryCode, 'EOSB', asOfDate);

    const diffMs = Math.max(lastWorkingDate.getTime() - joiningDate.getTime(), 0);
    const serviceDaysTotal = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const serviceYearsDec = new Decimal(serviceDaysTotal).dividedBy('365.25');

    const basicM = Money.create(lastBasicSalary, currency);

    if (countryCode.toUpperCase() === 'KW') {
      const dailyWageM = basicM.divide(26);

      const first5Years = Decimal.min(serviceYearsDec, 5);
      const remainingYears = Decimal.max(serviceYearsDec.minus(5), 0);

      const first5AmountM = dailyWageM.multiply(15).multiply(first5Years);
      const remainingAmountM = basicM.multiply(remainingYears);
      const rawGratuityM = first5AmountM.add(remainingAmountM);

      const capM = basicM.multiply(18); // 18 months basic cap
      const isCapped = rawGratuityM.greaterThan(capM);
      const cappedGratuityM = isCapped ? capM : rawGratuityM;

      let factorDec = new Decimal(1.0);
      if (terminationType === 'RESIGNATION' && contractType === 'UNLIMITED') {
        if (serviceYearsDec.lessThan(3)) factorDec = new Decimal(0);
        else if (serviceYearsDec.lessThan(5)) factorDec = new Decimal(0.5);
        else if (serviceYearsDec.lessThan(10)) factorDec = new Decimal('0.6666666666666666');
        else factorDec = new Decimal(1.0);
      }

      const finalGratuityM = cappedGratuityM.multiply(factorDec);

      return {
        serviceYears: serviceYearsDec.toNumber(),
        serviceMonths: Math.floor((serviceDaysTotal % 365) / 30),
        serviceDays: serviceDaysTotal % 30,
        eligibleSalaryBase: basicM.toDecimalString(),
        gratuityAmount: finalGratuityM.toDecimalString(),
        resignationFactor: factorDec.toNumber(),
        ruleVersion: rule?.version || 'KW-LL-ART51-53-2026',
        sourceReference: rule?.sourceReference || 'Kuwait Labor Law No. 6/2010 Articles 51 & 53',
        breakdown: {
          firstPeriodYears: first5Years.toNumber(),
          firstPeriodAmount: first5AmountM.toDecimalString(),
          secondPeriodYears: remainingYears.toNumber(),
          secondPeriodAmount: remainingAmountM.toDecimalString(),
          statutoryCapAmount: capM.toDecimalString(),
          isCapped,
        },
      };
    }

    // Saudi / GCC Standard
    const first5 = Decimal.min(serviceYearsDec, 5);
    const after5 = Decimal.max(serviceYearsDec.minus(5), 0);
    const halfMonthM = basicM.multiply('0.5').multiply(first5);
    const fullMonthM = basicM.multiply(after5);
    const totalGratuityM = halfMonthM.add(fullMonthM);

    return {
      serviceYears: serviceYearsDec.toNumber(),
      serviceMonths: Math.floor((serviceDaysTotal % 365) / 30),
      serviceDays: serviceDaysTotal % 30,
      eligibleSalaryBase: basicM.toDecimalString(),
      gratuityAmount: totalGratuityM.toDecimalString(),
      resignationFactor: 1.0,
      ruleVersion: rule?.version || 'GCC-EOSB-STD-2026',
      sourceReference: rule?.sourceReference || 'Saudi Labor Law Article 84',
      breakdown: {
        firstPeriodYears: first5.toNumber(),
        firstPeriodAmount: halfMonthM.toDecimalString(),
        secondPeriodYears: after5.toNumber(),
        secondPeriodAmount: fullMonthM.toDecimalString(),
        statutoryCapAmount: 'No Statutory Cap',
        isCapped: false,
      },
    };
  }

  private isNational(countryCode: string, nationality: string): boolean {
    if (!nationality) return false;
    const nat = nationality.toLowerCase().trim();
    const c = countryCode.toUpperCase();

    if (c === 'KW') return nat.includes('kuwait') || nat.includes('كويت');
    if (c === 'SA') return nat.includes('saudi') || nat.includes('سعود');
    if (c === 'BH') return nat.includes('bahrain') || nat.includes('بحرين');
    if (c === 'AE') return nat.includes('emirati') || nat.includes('uae') || nat.includes('إمارات');
    if (c === 'QA') return nat.includes('qatar') || nat.includes('قطر');
    if (c === 'OM') return nat.includes('oman') || nat.includes('عمان');
    return false;
  }

  private getDefaultRuleFallback(countryCode: string, ruleType: string): any {
    const code = countryCode.toUpperCase();
    if (code === 'KW' && ruleType === 'PIFSS') {
      return {
        id: 'rule_kw_pifss_2026',
        countryCode: 'KW',
        ruleType: 'PIFSS',
        version: 'KW-PIFSS-2026.1',
        effectiveFrom: '2020-01-01',
        effectiveTo: null,
        parameters: { ceilingAmount: '3000.000', employeeRate: '0.105', employerRate: '0.115' },
        sourceReference: 'Amiri Decree Law No. 61 of 1976 & Ministerial Decrees',
        status: 'ACTIVE',
      };
    }

    if (code === 'SA' && ruleType === 'GOSI') {
      return {
        id: 'rule_sa_gosi_2026',
        countryCode: 'SA',
        ruleType: 'GOSI',
        version: 'SA-GOSI-2026.1',
        effectiveFrom: '2020-01-01',
        effectiveTo: null,
        parameters: { ceilingAmount: '45000.00', citizenEmployeeRate: '0.0975', citizenEmployerRate: '0.1175', expatEmployerHazardRate: '0.02' },
        sourceReference: 'Royal Decree M/33 & SANED Royal Decree M/18',
        status: 'ACTIVE',
      };
    }

    if (ruleType === 'OVERTIME') {
      return {
        id: `rule_${code.toLowerCase()}_ot_2026`,
        countryCode: code,
        ruleType: 'OVERTIME',
        version: code === 'SA' ? 'SA-LL-ART107-2026' : 'KW-LL-ART66-2026',
        effectiveFrom: '2020-01-01',
        effectiveTo: null,
        parameters: {
          hourlyBaseDivisor: 240,
          regularDayMultiplier: code === 'SA' ? '1.50' : '1.25',
          restDayMultiplier: '1.50',
          holidayMultiplier: code === 'SA' ? '1.50' : '2.00',
        },
        sourceReference: code === 'SA' ? 'Saudi Labor Law Article 107' : 'Kuwait Labor Law Article 66',
        status: 'ACTIVE',
      };
    }

    return null;
  }
}

export const complianceEngine = ComplianceEngineService.getInstance();
