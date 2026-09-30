import { describe, it, expect } from 'vitest';
import { Money, SUPPORTED_CURRENCIES } from '../src/core/domain/money.ts';

describe('Money Value Object & Financial Calculations', () => {
  it('should support Kuwaiti Dinar (KWD) with exactly 3 decimal places', () => {
    const kwd = Money.create('125.750', 'KWD');
    expect(kwd.decimals).toBe(3);
    expect(kwd.toDecimalString()).toBe('125.750');
    expect(kwd.toFormattedString(false)).toBe('KD 125.750');
    expect(kwd.toFormattedString(true)).toBe('125.750 د.ك');
  });

  it('should eliminate IEEE 754 floating-point inaccuracies', () => {
    // In raw JavaScript float: 0.1 + 0.2 = 0.30000000000000004
    const m1 = Money.create('0.100', 'KWD');
    const m2 = Money.create('0.200', 'KWD');
    const sum = m1.add(m2);

    expect(sum.toDecimalString()).toBe('0.300');
    expect(sum.equals(Money.create('0.300', 'KWD'))).toBe(true);
  });

  it('should accurately handle subunits (fils for KWD, halalas for SAR)', () => {
    // 1 KWD = 1000 fils
    const moneyFromSubunits = Money.fromSubunits(125750n, 'KWD');
    expect(moneyFromSubunits.toDecimalString()).toBe('125.750');
    expect(moneyFromSubunits.toSubunits()).toBe(125750n);

    // 1 SAR = 100 halalas
    const sar = Money.fromSubunits(5025n, 'SAR');
    expect(sar.toDecimalString()).toBe('50.25');
    expect(sar.toSubunits()).toBe(5025n);
  });

  it('should perform remainder-safe allocation without losing or creating a single fils', () => {
    const total = Money.create('100.000', 'KWD');
    // Divide equally into 3 shares (1:1:1)
    const shares = total.allocate([1, 1, 1]);

    expect(shares.length).toBe(3);
    // 100,000 fils / 3 = 33,333 fils + 1 fils remainder distributed to first share
    expect(shares[0].toDecimalString()).toBe('33.334');
    expect(shares[1].toDecimalString()).toBe('33.333');
    expect(shares[2].toDecimalString()).toBe('33.333');

    // Total must strictly equal original 100.000
    const reconstructed = shares[0].add(shares[1]).add(shares[2]);
    expect(reconstructed.equals(total)).toBe(true);
  });

  it('should enforce currency safety and disallow mismatched operations', () => {
    const kwd = Money.create('10.000', 'KWD');
    const sar = Money.create('10.00', 'SAR');

    expect(() => kwd.add(sar)).toThrowError(/Currency mismatch/);
    expect(() => kwd.subtract(sar)).toThrowError(/Currency mismatch/);
  });

  it('should support Banker Rounding (HALF_EVEN)', () => {
    // 2.5 rounded to nearest even integer = 2; 3.5 rounded = 4
    const m1 = Money.create('2.5555', 'KWD');
    // Default KWD is 3 decimals with HALF_EVEN
    expect(m1.toDecimalString()).toBe('2.556');
  });

  it('should support all GCC currencies defined in specification', () => {
    const gccCodes = ['KWD', 'SAR', 'AED', 'QAR', 'BHD', 'OMR'];
    for (const code of gccCodes) {
      expect(SUPPORTED_CURRENCIES[code]).toBeDefined();
      const instance = Money.zero(code);
      expect(instance.currency).toBe(code);
    }
  });
});
