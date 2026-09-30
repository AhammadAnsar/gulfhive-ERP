/**
 * GulfHive ERP - Decimal-Safe Monetary Domain Value Object
 * Strictly adheres to non-negotiable rules:
 * 1. Zero floating-point arithmetic.
 * 2. Multi-decimal currencies (e.g. KWD 3 decimals, BHD 3 decimals, OMR 3 decimals).
 * 3. Configurable rounding policies (default Banker's Rounding / HALF_EVEN).
 * 4. Remainder-safe allocation for payroll, invoicing, and tax calculations.
 */

import Decimal from 'decimal.js';
import { ValueObject } from './value-object.ts';

// Configure Decimal.js precision for enterprise ERP financial grade (30 significant digits)
Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_EVEN });

export type RoundingPolicy = 'HALF_EVEN' | 'HALF_UP' | 'FLOOR' | 'CEIL';

export interface CurrencyConfig {
  readonly code: string;
  readonly numericCode: string;
  readonly decimals: number;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly symbolEn: string;
  readonly symbolAr: string;
  readonly defaultRounding: RoundingPolicy;
}

export const SUPPORTED_CURRENCIES: Record<string, CurrencyConfig> = {
  KWD: {
    code: 'KWD',
    numericCode: '414',
    decimals: 3,
    nameEn: 'Kuwaiti Dinar',
    nameAr: 'دينار كويتي',
    symbolEn: 'KD',
    symbolAr: 'د.ك',
    defaultRounding: 'HALF_EVEN',
  },
  BHD: {
    code: 'BHD',
    numericCode: '048',
    decimals: 3,
    nameEn: 'Bahraini Dinar',
    nameAr: 'دينار بحريني',
    symbolEn: 'BD',
    symbolAr: 'د.ب',
    defaultRounding: 'HALF_EVEN',
  },
  OMR: {
    code: 'OMR',
    numericCode: '512',
    decimals: 3,
    nameEn: 'Omani Rial',
    nameAr: 'ريال عماني',
    symbolEn: 'OMR',
    symbolAr: 'ر.ع',
    defaultRounding: 'HALF_EVEN',
  },
  SAR: {
    code: 'SAR',
    numericCode: '682',
    decimals: 2,
    nameEn: 'Saudi Riyal',
    nameAr: 'ريال سعودي',
    symbolEn: 'SAR',
    symbolAr: 'ر.س',
    defaultRounding: 'HALF_EVEN',
  },
  AED: {
    code: 'AED',
    numericCode: '784',
    decimals: 2,
    nameEn: 'UAE Dirham',
    nameAr: 'درهم إماراتي',
    symbolEn: 'AED',
    symbolAr: 'د.إ',
    defaultRounding: 'HALF_EVEN',
  },
  QAR: {
    code: 'QAR',
    numericCode: '634',
    decimals: 2,
    nameEn: 'Qatari Riyal',
    nameAr: 'ريال قطري',
    symbolEn: 'QAR',
    symbolAr: 'ر.ق',
    defaultRounding: 'HALF_EVEN',
  },
  USD: {
    code: 'USD',
    numericCode: '840',
    decimals: 2,
    nameEn: 'US Dollar',
    nameAr: 'دولار أمريكي',
    symbolEn: '$',
    symbolAr: '$',
    defaultRounding: 'HALF_EVEN',
  },
  EUR: {
    code: 'EUR',
    numericCode: '978',
    decimals: 2,
    nameEn: 'Euro',
    nameAr: 'يورو',
    symbolEn: '€',
    symbolAr: '€',
    defaultRounding: 'HALF_EVEN',
  },
};

interface MoneyProps {
  amount: string; // Store internally as exact decimal string
  currency: string;
}

export class Money extends ValueObject<MoneyProps> {
  private readonly _decimal: Decimal;
  private readonly _currencyConfig: CurrencyConfig;

  private constructor(amount: Decimal, currencyCode: string) {
    const code = currencyCode.toUpperCase();
    const config = SUPPORTED_CURRENCIES[code];
    if (!config) {
      throw new Error(`Unsupported currency code: ${currencyCode}`);
    }

    // Quantize according to currency precision using Banker's Rounding
    const quantized = amount.toDecimalPlaces(
      config.decimals,
      Money.mapRounding(config.defaultRounding)
    );

    super({
      amount: quantized.toFixed(config.decimals),
      currency: code,
    });

    this._decimal = quantized;
    this._currencyConfig = config;
  }

  public get amount(): Decimal {
    return this._decimal;
  }

  public get currency(): string {
    return this.props.currency;
  }

  public get decimals(): number {
    return this._currencyConfig.decimals;
  }

  public static create(amount: string | number | Decimal, currencyCode: string): Money {
    if (typeof amount === 'number' && !Number.isFinite(amount)) {
      throw new Error('Monetary amount must be a finite number');
    }
    const dec = new Decimal(amount.toString());
    return new Money(dec, currencyCode);
  }

  public static zero(currencyCode: string): Money {
    return new Money(new Decimal(0), currencyCode);
  }

  public static fromSubunits(subunits: bigint | number, currencyCode: string): Money {
    const code = currencyCode.toUpperCase();
    const config = SUPPORTED_CURRENCIES[code];
    if (!config) {
      throw new Error(`Unsupported currency: ${currencyCode}`);
    }
    const factor = new Decimal(10).pow(config.decimals);
    const amount = new Decimal(subunits.toString()).dividedBy(factor);
    return new Money(amount, code);
  }

  public toSubunits(): bigint {
    const factor = new Decimal(10).pow(this._currencyConfig.decimals);
    const subunitsDecimal = this._decimal.times(factor).round();
    return BigInt(subunitsDecimal.toFixed(0));
  }

  public add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this._decimal.plus(other._decimal), this.currency);
  }

  public subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this._decimal.minus(other._decimal), this.currency);
  }

  public multiply(factor: string | number | Decimal, rounding?: RoundingPolicy): Money {
    const factorDec = new Decimal(factor.toString());
    const roundingMode = rounding
      ? Money.mapRounding(rounding)
      : Money.mapRounding(this._currencyConfig.defaultRounding);
    const result = this._decimal.times(factorDec).toDecimalPlaces(this._currencyConfig.decimals, roundingMode);
    return new Money(result, this.currency);
  }

  public divide(divisor: string | number | Decimal, rounding?: RoundingPolicy): Money {
    const divDec = new Decimal(divisor.toString());
    if (divDec.isZero()) {
      throw new Error('Division by zero in monetary calculation');
    }
    const roundingMode = rounding
      ? Money.mapRounding(rounding)
      : Money.mapRounding(this._currencyConfig.defaultRounding);
    const result = this._decimal.dividedBy(divDec).toDecimalPlaces(this._currencyConfig.decimals, roundingMode);
    return new Money(result, this.currency);
  }

  /**
   * Deterministic largest-remainder allocation algorithm with exact total subunit preservation.
   * Supports number, string, or Decimal weights.
   * Handles 3-decimal currencies (e.g. KWD, BHD, OMR) and 2-decimal currencies (e.g. SAR, AED).
   * Tie-break rules: largest remainder -> largest weight -> original array index.
   */
  public allocate(ratios: Array<number | string | Decimal>): Money[] {
    if (ratios.length === 0) {
      return [];
    }

    const weights = ratios.map((r) => new Decimal(r.toString()));

    if (weights.some((w) => w.isNegative())) {
      throw new Error('Allocation weights cannot be negative');
    }

    const totalWeight = weights.reduce((sum, w) => sum.plus(w), new Decimal(0));
    if (totalWeight.isZero()) {
      throw new Error('Total weight must be positive for allocation');
    }

    const totalSubunits = this.toSubunits();
    const isNegative = totalSubunits < 0n;
    const absSubunits = isNegative ? -totalSubunits : totalSubunits;
    const absSubunitsDec = new Decimal(absSubunits.toString());

    const floorShares: bigint[] = [];
    const remainders: { index: number; remainder: Decimal; weight: Decimal }[] = [];
    let allocatedSum = 0n;

    for (let i = 0; i < weights.length; i++) {
      const weight = weights[i];
      if (weight.isZero()) {
        floorShares.push(0n);
        remainders.push({ index: i, remainder: new Decimal(0), weight });
        continue;
      }

      const exactShare = absSubunitsDec.times(weight).dividedBy(totalWeight);
      const floorShare = BigInt(exactShare.floor().toFixed(0));
      const rem = exactShare.minus(new Decimal(floorShare.toString()));

      floorShares.push(floorShare);
      allocatedSum += floorShare;
      remainders.push({ index: i, remainder: rem, weight });
    }

    let unallocatedSubunits = absSubunits - allocatedSum;

    // Sort remainders: largest remainder desc, then largest weight desc, then original index asc
    remainders.sort((a, b) => {
      const remDiff = b.remainder.minus(a.remainder);
      if (!remDiff.isZero()) return remDiff.isPositive() ? 1 : -1;

      const weightDiff = b.weight.minus(a.weight);
      if (!weightDiff.isZero()) return weightDiff.isPositive() ? 1 : -1;

      return a.index - b.index;
    });

    for (let i = 0; i < Number(unallocatedSubunits); i++) {
      const targetIndex = remainders[i % remainders.length].index;
      floorShares[targetIndex] += 1n;
    }

    return floorShares.map((s) => {
      const signed = isNegative ? -s : s;
      return Money.fromSubunits(signed, this.currency);
    });
  }

  public isZero(): boolean {
    return this._decimal.isZero();
  }

  public isPositive(): boolean {
    return this._decimal.isPositive() && !this._decimal.isZero();
  }

  public isNegative(): boolean {
    return this._decimal.isNegative();
  }

  public equals(other?: ValueObject<MoneyProps>): boolean {
    if (!(other instanceof Money)) return false;
    return this.currency === other.currency && this._decimal.equals(other._decimal);
  }

  public greaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._decimal.greaterThan(other._decimal);
  }

  public greaterThanOrEqual(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._decimal.greaterThanOrEqualTo(other._decimal);
  }

  public lessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._decimal.lessThan(other._decimal);
  }

  public lessThanOrEqual(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._decimal.lessThanOrEqualTo(other._decimal);
  }

  public toDecimalString(): string {
    return this._decimal.toFixed(this._currencyConfig.decimals);
  }

  public toFormattedString(isArabic = false, showSymbol = true): string {
    const formattedNum = this._decimal.toFixed(this._currencyConfig.decimals);
    if (!showSymbol) {
      return formattedNum;
    }
    const symbol = isArabic ? this._currencyConfig.symbolAr : this._currencyConfig.symbolEn;
    return isArabic ? `${formattedNum} ${symbol}` : `${symbol} ${formattedNum}`;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(`Currency mismatch: cannot perform operation between ${this.currency} and ${other.currency}`);
    }
  }

  private static mapRounding(policy: RoundingPolicy): Decimal.Rounding {
    switch (policy) {
      case 'HALF_EVEN':
        return Decimal.ROUND_HALF_EVEN;
      case 'HALF_UP':
        return Decimal.ROUND_HALF_UP;
      case 'FLOOR':
        return Decimal.ROUND_FLOOR;
      case 'CEIL':
        return Decimal.ROUND_CEIL;
      default:
        return Decimal.ROUND_HALF_EVEN;
    }
  }
}
