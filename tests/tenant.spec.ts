import { describe, it, expect } from 'vitest';
import { Tenant, VALID_GCC_COUNTRIES } from '../src/core/domain/tenant.ts';
import { Branch } from '../src/core/domain/branch.ts';

describe('Tenant & Branch Domain Models', () => {
  it('should create valid Tenant aggregate with GCC compliance attributes', () => {
    const res = Tenant.create('tenant_001', {
      code: 'KWT-CORP',
      legalNameEn: 'Al-Ameen Enterprises W.L.L.',
      legalNameAr: 'شركة الأمين للمشاريع ذ.م.م',
      countryCode: 'KW',
      baseCurrency: 'KWD',
      fiscalYearStartMonth: 1,
      timezone: 'Asia/Kuwait',
      isActive: true,
    });

    expect(res.isSuccess).toBe(true);
    const tenant = res.getValue();
    expect(tenant.code).toBe('KWT-CORP');
    expect(tenant.countryCode).toBe('KW');
    expect(tenant.baseCurrency).toBe('KWD');
    expect(tenant.fiscalYearStartMonth).toBe(1);
  });

  it('should reject non-GCC countries', () => {
    const res = Tenant.create('tenant_002', {
      code: 'US-CORP',
      legalNameEn: 'US Corp',
      legalNameAr: 'يو اس كورب',
      countryCode: 'US', // Not in GCC
      baseCurrency: 'USD',
      fiscalYearStartMonth: 1,
      timezone: 'America/New_York',
      isActive: true,
    });

    expect(res.isFailure).toBe(true);
    expect(res.getError().message).toMatch(/valid GCC country/);
  });

  it('should validate fiscal year start month within 1..12', () => {
    const res = Tenant.create('tenant_003', {
      code: 'SA-CORP',
      legalNameEn: 'Saudi Enterprise Ltd',
      legalNameAr: 'المؤسسة السعودية المحدودة',
      countryCode: 'SA',
      baseCurrency: 'SAR',
      fiscalYearStartMonth: 13, // Invalid
      timezone: 'Asia/Riyadh',
      isActive: true,
    });

    expect(res.isFailure).toBe(true);
    expect(res.getError().message).toMatch(/Fiscal year start month/);
  });

  it('should support all GCC countries in dictionary', () => {
    const countries = ['KW', 'SA', 'AE', 'QA', 'BH', 'OM'];
    for (const c of countries) {
      expect(VALID_GCC_COUNTRIES[c]).toBeDefined();
    }
  });

  it('should create valid Branch entity with parent tenant binding', () => {
    const res = Branch.create('br_001', {
      tenantId: 'tenant_001',
      code: 'HQ',
      nameEn: 'Head Office',
      nameAr: 'المقر الرئيسي',
      isMain: true,
      cityEn: 'Kuwait City',
      cityAr: 'مدينة الكويت',
      isActive: true,
    });

    expect(res.isSuccess).toBe(true);
    const branch = res.getValue();
    expect(branch.code).toBe('HQ');
    expect(branch.isMain).toBe(true);
    expect(branch.tenantId).toBe('tenant_001');
  });
});
