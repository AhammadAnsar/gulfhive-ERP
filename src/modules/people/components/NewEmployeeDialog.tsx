/**
 * GulfHive ERP - New Employee Dialog
 * Complete authoritative employee creation wizard: personal master, contract, salary, and WPS banking.
 */

import React, { useState } from 'react';
import { Dialog, Button, FormField, Input, Select, useToast } from '../../../design-system/index.ts';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import { User, Briefcase, CreditCard, ShieldCheck } from 'lucide-react';

export interface NewEmployeeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  company: any;
  branches: any[];
  departments: any[];
  designations: any[];
  onEmployeeCreated: () => void;
}

export function NewEmployeeDialog({
  isOpen,
  onClose,
  company,
  branches,
  departments,
  designations,
  onEmployeeCreated,
}: NewEmployeeDialogProps) {
  const { t, language } = useI18n();
  const { addToast } = useToast();

  const [activeSection, setActiveSection] = useState<'personal' | 'placement' | 'compensation'>('personal');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [form, setForm] = useState({
    // Personal
    employeeNumber: '',
    firstNameEn: '',
    lastNameEn: '',
    firstNameAr: '',
    lastNameAr: '',
    gender: 'MALE',
    dateOfBirth: '',
    nationality: 'Kuwaiti',
    civilIdNumber: '',
    civilIdExpiry: '',
    passportNumber: '',
    passportExpiry: '',
    phone: '',
    email: '',

    // Placement & Contract
    branchId: branches[0]?.id || '',
    departmentId: '',
    designationId: '',
    joiningDate: new Date().toISOString().slice(0, 10),
    employmentStatus: 'ACTIVE',
    contractType: 'UNLIMITED',
    probationDays: 90,
    noticeDays: 90,
    workLocation: '',

    // Compensation & Bank
    currency: company?.baseCurrency || 'KWD',
    basicSalary: '450.000',
    housingAllowance: '100.000',
    transportAllowance: '50.000',
    otherAllowances: '0.000',
    bankName: '',
    bankCode: '',
    iban: '',
    accountNumber: '',
    swiftBic: '',
  });

  const updateField = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstNameEn || !form.lastNameEn || !form.firstNameAr || !form.lastNameAr || !form.email || !form.branchId || !form.basicSalary) {
      addToast({
        type: 'error',
        title: 'Validation Error',
        message: 'Please complete all required fields.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          employeeNumber: form.employeeNumber.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create employee');
      }

      addToast({
        type: 'success',
        title: language === 'ar' ? 'تم إضافة الموظف بنجاح' : 'Employee Registered',
        message: `${data.employee.employeeNumber} - ${data.employee.firstNameEn} ${data.employee.lastNameEn}`,
      });

      onEmployeeCreated();
      onClose();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Registration Failed', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={t('people.action.new_employee')}
      description="Create single authoritative master record with contract, salary structure, and bank credentials."
      footer={
        <div className="w-full flex items-center justify-between">
          <div className="flex space-x-1.5 rtl:space-x-reverse">
            {(['personal', 'placement', 'compensation'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setActiveSection(s)}
                className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer ${
                  activeSection === s ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <Button variant="secondary" size="sm" onClick={onClose}>
              {t('action.cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              isLoading={isSubmitting}
            >
              {t('action.save')}
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* SECTION 1: Personal & Identity */}
        {activeSection === 'personal' && (
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField label={t('people.field.emp_number')}>
                <Input
                  type="text"
                  value={form.employeeNumber}
                  onChange={(e) => updateField('employeeNumber', e.target.value.toUpperCase())}
                  placeholder="Auto-generated (e.g. EMP-00001)"
                  className="font-mono uppercase"
                />
              </FormField>

              <FormField label={t('people.field.nationality')} required>
                <Input
                  type="text"
                  value={form.nationality}
                  onChange={(e) => updateField('nationality', e.target.value)}
                  placeholder="e.g. Kuwaiti, Saudi, Egyptian"
                  required
                />
              </FormField>

              <FormField label="Gender" required>
                <Select value={form.gender} onChange={(e) => updateField('gender', e.target.value)}>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </Select>
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label={t('people.field.first_name_en')} required>
                <Input
                  type="text"
                  value={form.firstNameEn}
                  onChange={(e) => updateField('firstNameEn', e.target.value)}
                  placeholder="Tariq"
                  required
                />
              </FormField>
              <FormField label={t('people.field.last_name_en')} required>
                <Input
                  type="text"
                  value={form.lastNameEn}
                  onChange={(e) => updateField('lastNameEn', e.target.value)}
                  placeholder="Al-Mutawa"
                  required
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label={t('people.field.first_name_ar')} required>
                <Input
                  type="text"
                  value={form.firstNameAr}
                  onChange={(e) => updateField('firstNameAr', e.target.value)}
                  placeholder="طارق"
                  dir="rtl"
                  className="font-arabic text-right"
                  required
                />
              </FormField>
              <FormField label={t('people.field.last_name_ar')} required>
                <Input
                  type="text"
                  value={form.lastNameAr}
                  onChange={(e) => updateField('lastNameAr', e.target.value)}
                  placeholder="المطوع"
                  dir="rtl"
                  className="font-arabic text-right"
                  required
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label={t('people.field.civil_id')}>
                <Input
                  type="text"
                  value={form.civilIdNumber}
                  onChange={(e) => updateField('civilIdNumber', e.target.value)}
                  placeholder="295081200000"
                  className="font-mono"
                />
              </FormField>

              <FormField label="Civil ID Expiry Date">
                <Input
                  type="date"
                  value={form.civilIdExpiry}
                  onChange={(e) => updateField('civilIdExpiry', e.target.value)}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label={t('people.field.passport')}>
                <Input
                  type="text"
                  value={form.passportNumber}
                  onChange={(e) => updateField('passportNumber', e.target.value)}
                  placeholder="P1234567"
                  className="font-mono"
                />
              </FormField>

              <FormField label="Passport Expiry Date">
                <Input
                  type="date"
                  value={form.passportExpiry}
                  onChange={(e) => updateField('passportExpiry', e.target.value)}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Work Email" required>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="tariq@enterprise.com"
                  required
                />
              </FormField>

              <FormField label="Direct Phone">
                <Input
                  type="text"
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="+965 9000 0000"
                  className="font-mono"
                />
              </FormField>
            </div>
          </div>
        )}

        {/* SECTION 2: Placement & Contract */}
        {activeSection === 'placement' && (
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField label="Assigned Branch" required>
                <Select value={form.branchId} onChange={(e) => updateField('branchId', e.target.value)}>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} - {b.nameEn}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Department">
                <Select value={form.departmentId} onChange={(e) => updateField('departmentId', e.target.value)}>
                  <option value="">Select Department...</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} - {d.nameEn}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Designation">
                <Select value={form.designationId} onChange={(e) => updateField('designationId', e.target.value)}>
                  <option value="">Select Designation...</option>
                  {designations.map((des) => (
                    <option key={des.id} value={des.id}>
                      {des.code} - {des.nameEn}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField label={t('people.field.joining_date')} required>
                <Input
                  type="date"
                  value={form.joiningDate}
                  onChange={(e) => updateField('joiningDate', e.target.value)}
                  required
                />
              </FormField>

              <FormField label={t('people.field.contract_type')} required>
                <Select value={form.contractType} onChange={(e) => updateField('contractType', e.target.value)}>
                  <option value="UNLIMITED">Unlimited Duration (Standard)</option>
                  <option value="LIMITED">Fixed Duration (Limited)</option>
                  <option value="PROJECT_BASED">Project-Based</option>
                </Select>
              </FormField>

              <FormField label={t('people.field.employment_status')}>
                <Select value={form.employmentStatus} onChange={(e) => updateField('employmentStatus', e.target.value)}>
                  <option value="ACTIVE">Active Employee</option>
                  <option value="PROBATION">Probationary Period</option>
                </Select>
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label={t('people.field.probation_days')}>
                <Input
                  type="number"
                  value={form.probationDays}
                  onChange={(e) => updateField('probationDays', e.target.value)}
                />
              </FormField>

              <FormField label={t('people.field.notice_days')}>
                <Input
                  type="number"
                  value={form.noticeDays}
                  onChange={(e) => updateField('noticeDays', e.target.value)}
                />
              </FormField>
            </div>
          </div>
        )}

        {/* SECTION 3: Compensation & WPS Banking */}
        {activeSection === 'compensation' && (
          <div className="space-y-3.5">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <h4 className="font-bold text-slate-900 text-xs">Salary & Allowance Structure</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <FormField label={t('people.field.basic_salary')} required>
                  <Input
                    type="text"
                    value={form.basicSalary}
                    onChange={(e) => updateField('basicSalary', e.target.value)}
                    className="font-mono font-bold text-slate-900"
                    placeholder="450.000"
                    required
                  />
                </FormField>

                <FormField label={t('people.field.housing_allowance')}>
                  <Input
                    type="text"
                    value={form.housingAllowance}
                    onChange={(e) => updateField('housingAllowance', e.target.value)}
                    className="font-mono"
                    placeholder="100.000"
                  />
                </FormField>

                <FormField label={t('people.field.transport_allowance')}>
                  <Input
                    type="text"
                    value={form.transportAllowance}
                    onChange={(e) => updateField('transportAllowance', e.target.value)}
                    className="font-mono"
                    placeholder="50.000"
                  />
                </FormField>

                <FormField label={t('people.field.other_allowances')}>
                  <Input
                    type="text"
                    value={form.otherAllowances}
                    onChange={(e) => updateField('otherAllowances', e.target.value)}
                    className="font-mono"
                    placeholder="0.000"
                  />
                </FormField>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <h4 className="font-bold text-slate-900 text-xs">WPS Bank Account Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label={t('people.field.bank_name')}>
                  <Input
                    type="text"
                    value={form.bankName}
                    onChange={(e) => updateField('bankName', e.target.value)}
                    placeholder="National Bank of Kuwait (NBK)"
                  />
                </FormField>

                <FormField label="Bank Code (Routing)">
                  <Input
                    type="text"
                    value={form.bankCode}
                    onChange={(e) => updateField('bankCode', e.target.value)}
                    placeholder="NBK-KW"
                    className="font-mono"
                  />
                </FormField>

                <FormField label={t('people.field.iban')}>
                  <Input
                    type="text"
                    value={form.iban}
                    onChange={(e) => updateField('iban', e.target.value.toUpperCase())}
                    placeholder="KW00NBK0000000000000000000000"
                    className="font-mono uppercase"
                  />
                </FormField>

                <FormField label={t('people.field.account_number')}>
                  <Input
                    type="text"
                    value={form.accountNumber}
                    onChange={(e) => updateField('accountNumber', e.target.value)}
                    placeholder="0001234567"
                    className="font-mono"
                  />
                </FormField>
              </div>
            </div>
          </div>
        )}
      </form>
    </Dialog>
  );
}
