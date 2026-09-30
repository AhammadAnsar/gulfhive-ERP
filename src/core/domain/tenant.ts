/**
 * GulfHive ERP - Tenant / Company Aggregate Root
 * Enforces legal entity rules, GCC jurisdiction, and ISO currency constraints.
 */

import { AggregateRoot } from './aggregate-root.ts';
import { Result } from './result.ts';
import { SUPPORTED_CURRENCIES } from './money.ts';

export interface TenantProps {
  code: string;
  legalNameEn: string;
  legalNameAr: string;
  tradeNameEn?: string;
  tradeNameAr?: string;
  countryCode: string; // KW, SA, AE, QA, BH, OM
  baseCurrency: string; // KWD, SAR, AED, etc.
  crNumber?: string;
  taxNumber?: string;
  fiscalYearStartMonth: number;
  timezone: string;
  phone?: string;
  email?: string;
  website?: string;
  addressEn?: string;
  addressAr?: string;
  isActive: boolean;
}

export const VALID_GCC_COUNTRIES: Record<string, { nameEn: string; nameAr: string; defaultCurrency: string; defaultTz: string }> = {
  KW: { nameEn: 'Kuwait', nameAr: 'دولة الكويت', defaultCurrency: 'KWD', defaultTz: 'Asia/Kuwait' },
  SA: { nameEn: 'Saudi Arabia', nameAr: 'المملكة العربية السعودية', defaultCurrency: 'SAR', defaultTz: 'Asia/Riyadh' },
  AE: { nameEn: 'United Arab Emirates', nameAr: 'الإمارات العربية المتحدة', defaultCurrency: 'AED', defaultTz: 'Asia/Dubai' },
  QA: { nameEn: 'Qatar', nameAr: 'دولة قطر', defaultCurrency: 'QAR', defaultTz: 'Asia/Qatar' },
  BH: { nameEn: 'Bahrain', nameAr: 'مملكة البحرين', defaultCurrency: 'BHD', defaultTz: 'Asia/Bahrain' },
  OM: { nameEn: 'Oman', nameAr: 'سلطنة عمان', defaultCurrency: 'OMR', defaultTz: 'Asia/Muscat' },
};

export class Tenant extends AggregateRoot<string> {
  private _props: TenantProps;

  private constructor(id: string, props: TenantProps, createdAt?: Date, updatedAt?: Date) {
    super(id, createdAt, updatedAt);
    this._props = props;
  }

  public get code(): string { return this._props.code; }
  public get legalNameEn(): string { return this._props.legalNameEn; }
  public get legalNameAr(): string { return this._props.legalNameAr; }
  public get tradeNameEn(): string | undefined { return this._props.tradeNameEn; }
  public get tradeNameAr(): string | undefined { return this._props.tradeNameAr; }
  public get countryCode(): string { return this._props.countryCode; }
  public get baseCurrency(): string { return this._props.baseCurrency; }
  public get crNumber(): string | undefined { return this._props.crNumber; }
  public get taxNumber(): string | undefined { return this._props.taxNumber; }
  public get fiscalYearStartMonth(): number { return this._props.fiscalYearStartMonth; }
  public get timezone(): string { return this._props.timezone; }
  public get phone(): string | undefined { return this._props.phone; }
  public get email(): string | undefined { return this._props.email; }
  public get website(): string | undefined { return this._props.website; }
  public get addressEn(): string | undefined { return this._props.addressEn; }
  public get addressAr(): string | undefined { return this._props.addressAr; }
  public get isActive(): boolean { return this._props.isActive; }

  public static create(id: string, props: TenantProps, createdAt?: Date, updatedAt?: Date): Result<Tenant> {
    if (!props.code || props.code.trim().length < 2) {
      return Result.fail(new Error('Company code must be at least 2 characters'));
    }
    if (!props.legalNameEn || props.legalNameEn.trim().length === 0) {
      return Result.fail(new Error('English legal name is required'));
    }
    if (!props.legalNameAr || props.legalNameAr.trim().length === 0) {
      return Result.fail(new Error('Arabic legal name is required'));
    }
    const country = VALID_GCC_COUNTRIES[props.countryCode.toUpperCase()];
    if (!country) {
      return Result.fail(new Error(`Country code must be a valid GCC country: ${Object.keys(VALID_GCC_COUNTRIES).join(', ')}`));
    }
    if (!SUPPORTED_CURRENCIES[props.baseCurrency.toUpperCase()]) {
      return Result.fail(new Error(`Unsupported currency code: ${props.baseCurrency}`));
    }
    if (props.fiscalYearStartMonth < 1 || props.fiscalYearStartMonth > 12) {
      return Result.fail(new Error('Fiscal year start month must be between 1 and 12'));
    }

    const tenant = new Tenant(
      id,
      {
        ...props,
        code: props.code.toUpperCase().trim(),
        countryCode: props.countryCode.toUpperCase(),
        baseCurrency: props.baseCurrency.toUpperCase(),
      },
      createdAt,
      updatedAt
    );

    return Result.ok(tenant);
  }
}
