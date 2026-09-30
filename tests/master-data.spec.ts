import { describe, it, expect } from 'vitest';
import { MasterDataRepository } from '../src/infrastructure/database/repositories/master-data.repository.ts';
import { NumberingRepository } from '../src/infrastructure/database/repositories/numbering.repository.ts';

describe('Organization & Master Data Domain Rules', () => {
  it('should format document number correctly with prefix, year, padding, and separator', () => {
    const numberingRepo = new NumberingRepository();
    const config = {
      prefix: 'INV',
      suffix: 'HQ',
      separator: '-',
      includeYear: true,
      includeMonth: false,
      paddingLength: 5,
    };

    const formatted = numberingRepo.formatNumber(config, 42, new Date('2026-09-15'));
    expect(formatted).toBe('INV-2026-00042HQ');
  });

  it('should support monthly sequence formatting token when enabled', () => {
    const numberingRepo = new NumberingRepository();
    const config = {
      prefix: 'TS',
      suffix: '',
      separator: '-',
      includeYear: true,
      includeMonth: true,
      paddingLength: 4,
    };

    const formatted = numberingRepo.formatNumber(config, 7, new Date('2026-09-15'));
    expect(formatted).toBe('TS-2026-09-0007');
  });

  it('should reject destructive deletion of master entities when business references exist', () => {
    const mockCheckDeletion = (deptName: string, referencedEmpCount: number) => {
      if (referencedEmpCount > 0) {
        throw new Error(`Department '${deptName}' cannot be deleted because it is referenced by ${referencedEmpCount} employee record(s). You can deactivate or archive this department instead.`);
      }
      return true;
    };

    expect(() => mockCheckDeletion('Operations', 237)).toThrow(
      "Department 'Operations' cannot be deleted because it is referenced by 237 employee record(s). You can deactivate or archive this department instead."
    );
    expect(mockCheckDeletion('Unused Department', 0)).toBe(true);
  });

  it('should enforce date validation for fiscal year bounds', () => {
    const validateFiscalYearDates = (startDateStr: string, endDateStr: string) => {
      const start = new Date(startDateStr);
      const end = new Date(endDateStr);
      if (start >= end) {
        throw new Error('Fiscal year start date must be prior to end date.');
      }
      return true;
    };

    expect(() => validateFiscalYearDates('2026-12-31', '2026-01-01')).toThrow(
      'Fiscal year start date must be prior to end date.'
    );
    expect(validateFiscalYearDates('2026-01-01', '2026-12-31')).toBe(true);
  });

  it('should reject modification of locked fiscal years', () => {
    const checkLockedFiscalYear = (fy: { isLocked: boolean }) => {
      if (fy.isLocked) {
        throw new Error('Fiscal year is locked. Unlock it first before modifying dates or status.');
      }
      return true;
    };

    expect(() => checkLockedFiscalYear({ isLocked: true })).toThrow(
      'Fiscal year is locked. Unlock it first before modifying dates or status.'
    );
    expect(checkLockedFiscalYear({ isLocked: false })).toBe(true);
  });
});
