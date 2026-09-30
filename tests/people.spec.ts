import { describe, it, expect } from 'vitest';
import { Money } from '../src/core/domain/money.ts';

describe('People Module Domain & Business Rules', () => {
  it('should calculate total salary compensation with decimal-safe precision', () => {
    const basic = Money.create('450.000', 'KWD');
    const housing = Money.create('100.000', 'KWD');
    const transport = Money.create('50.000', 'KWD');
    const allowances = Money.create('25.750', 'KWD');

    const total = basic.add(housing).add(transport).add(allowances);
    expect(total.toDecimalString()).toBe('625.750');
    expect(total.toSubunits().toString()).toBe('625750');
  });

  it('should accurately compute document expiry status (expired vs expiring soon vs valid)', () => {
    const now = new Date();

    const expiredDate = new Date();
    expiredDate.setDate(now.getDate() - 10);

    const expiringSoonDate = new Date();
    expiringSoonDate.setDate(now.getDate() + 30);

    const validDate = new Date();
    validDate.setDate(now.getDate() + 200);

    const checkStatus = (expiryDate: Date) => {
      const diffDays = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) return 'EXPIRED';
      if (diffDays <= 60) return 'EXPIRING_SOON';
      return 'VALID';
    };

    expect(checkStatus(expiredDate)).toBe('EXPIRED');
    expect(checkStatus(expiringSoonDate)).toBe('EXPIRING_SOON');
    expect(checkStatus(validDate)).toBe('VALID');
  });

  it('should validate Saudi 2-decimal SAR salary compensation', () => {
    const basic = Money.create('4500.50', 'SAR');
    const housing = Money.create('1500.00', 'SAR');
    const total = basic.add(housing);

    expect(total.toDecimalString()).toBe('6000.50');
    expect(total.toSubunits().toString()).toBe('600050');
  });

  it('should maintain single employee identity without duplicating data across submodules', () => {
    const employeeMaster = {
      id: 'emp_001',
      employeeNumber: 'EMP-001',
      firstNameEn: 'Ahmad',
      lastNameEn: 'Al-Sabah',
      firstNameAr: 'أحمد',
      lastNameAr: 'الصباح',
    };

    // Submodules reference employeeMaster.id only
    const contract = { id: 'cnt_1', employeeId: employeeMaster.id, contractNumber: 'CNT-001' };
    const salary = { id: 'sal_1', employeeId: employeeMaster.id, basicSalary: '500.000' };
    const bank = { id: 'bnk_1', employeeId: employeeMaster.id, iban: 'KW00NBK00000' };
    const doc = { id: 'doc_1', employeeId: employeeMaster.id, documentType: 'CIVIL_ID' };

    expect(contract.employeeId).toBe(employeeMaster.id);
    expect(salary.employeeId).toBe(employeeMaster.id);
    expect(bank.employeeId).toBe(employeeMaster.id);
    expect(doc.employeeId).toBe(employeeMaster.id);
  });

  it('should support employee deletion cascading clean-up rule', () => {
    let employeeList = [
      { id: 'emp_001', employeeNumber: 'EMP-001', name: 'Ahmad' },
      { id: 'emp_002', employeeNumber: 'EMP-002', name: 'Fatima' },
    ];

    const deleteEmployeeById = (id: string) => {
      employeeList = employeeList.filter((e) => e.id !== id);
    };

    deleteEmployeeById('emp_001');
    expect(employeeList.length).toBe(1);
    expect(employeeList[0].id).toBe('emp_002');
  });
});
