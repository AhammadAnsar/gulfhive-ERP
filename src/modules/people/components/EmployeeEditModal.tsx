/**
 * GulfHive ERP - Employee Edit Modal
 * Full enterprise update form: personal information, photo, assignments, contract, compensation, and banking.
 */

import React, { useState, useEffect } from 'react';
import { Dialog, Button, FormField, Input, Select, useToast } from '../../../design-system/index.ts';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import { User, Briefcase, CreditCard, Camera, Trash2, ShieldCheck, Image as ImageIcon } from 'lucide-react';

export interface EmployeeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: any;
  company: any;
  branches: any[];
  departments: any[];
  designations: any[];
  onEmployeeUpdated: () => void;
}

export function EmployeeEditModal({
  isOpen,
  onClose,
  employee,
  company,
  branches,
  departments,
  designations,
  onEmployeeUpdated,
}: EmployeeEditModalProps) {
  const { language } = useI18n();
  const { addToast } = useToast();

  const [activeSection, setActiveSection] = useState<'personal' | 'placement' | 'compensation'>('personal');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State initialized from current employee record
  const [form, setForm] = useState({
    firstNameEn: '',
    middleNameEn: '',
    lastNameEn: '',
    firstNameAr: '',
    middleNameAr: '',
    lastNameAr: '',
    gender: 'MALE',
    dateOfBirth: '',
    maritalStatus: 'SINGLE',
    nationality: 'Kuwaiti',
    civilIdNumber: '',
    passportNumber: '',
    phone: '',
    workPhone: '',
    personalPhone: '',
    email: '',
    workEmail: '',
    personalEmail: '',
    addressEn: '',
    addressAr: '',
    avatarUrl: '',
    photoPath: '',

    // Placement & Contract
    branchId: '',
    departmentId: '',
    designationId: '',
    joiningDate: '',
    employmentStatus: 'ACTIVE',
    contractType: 'UNLIMITED',
    workLocation: '',

    // Compensation & Bank
    currency: 'KWD',
    basicSalary: '',
    housingAllowance: '',
    transportAllowance: '',
    foodAllowance: '',
    otherAllowances: '',
    bankName: '',
    bankCode: '',
    iban: '',
    accountNumber: '',
    swiftBic: '',
  });

  useEffect(() => {
    if (employee) {
      const activeSalary = employee.salaries?.[0];
      const bankDetails = employee.bankDetails;

      setForm({
        firstNameEn: employee.firstNameEn || '',
        middleNameEn: employee.middleNameEn || '',
        lastNameEn: employee.lastNameEn || '',
        firstNameAr: employee.firstNameAr || '',
        middleNameAr: employee.middleNameAr || '',
        lastNameAr: employee.lastNameAr || '',
        gender: employee.gender || 'MALE',
        dateOfBirth: employee.dateOfBirth ? new Date(employee.dateOfBirth).toISOString().slice(0, 10) : '',
        maritalStatus: employee.maritalStatus || 'SINGLE',
        nationality: employee.nationality || 'Kuwaiti',
        civilIdNumber: employee.civilIdNumber || '',
        passportNumber: employee.passportNumber || '',
        phone: employee.phone || '',
        workPhone: employee.workPhone || '',
        personalPhone: employee.personalPhone || '',
        email: employee.email || '',
        workEmail: employee.workEmail || '',
        personalEmail: employee.personalEmail || '',
        addressEn: employee.addressEn || '',
        addressAr: employee.addressAr || '',
        avatarUrl: employee.avatarUrl || employee.photoPath || '',
        photoPath: employee.photoPath || '',

        branchId: employee.branchId || branches[0]?.id || '',
        departmentId: employee.departmentId || '',
        designationId: employee.designationId || '',
        joiningDate: employee.joiningDate ? new Date(employee.joiningDate).toISOString().slice(0, 10) : '',
        employmentStatus: employee.employmentStatus || 'ACTIVE',
        contractType: employee.contractType || 'UNLIMITED',
        workLocation: employee.workLocation || '',

        currency: activeSalary?.currency || company?.baseCurrency || 'KWD',
        basicSalary: activeSalary?.basicSalary || '0.000',
        housingAllowance: activeSalary?.housingAllowance || '0.000',
        transportAllowance: activeSalary?.transportAllowance || '0.000',
        foodAllowance: activeSalary?.foodAllowance || '0.000',
        otherAllowances: activeSalary?.otherAllowances || '0.000',

        bankName: bankDetails?.bankName || '',
        bankCode: bankDetails?.bankCode || '',
        iban: bankDetails?.iban || '',
        accountNumber: bankDetails?.accountNumber || '',
        swiftBic: bankDetails?.swiftBic || '',
      });
    }
  }, [employee, company, branches]);

  const updateField = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        addToast({
          type: 'error',
          title: language === 'ar' ? 'حجم الصورة كبير' : 'File Too Large',
          message: language === 'ar' ? 'يجب أن لا يتجاوز حجم الصورة 2 ميجابايت' : 'Maximum photo size is 2MB',
        });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        updateField('avatarUrl', base64);
        updateField('photoPath', base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    updateField('avatarUrl', '');
    updateField('photoPath', '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstNameEn || !form.lastNameEn || !form.firstNameAr || !form.lastNameAr || !form.email || !form.branchId) {
      addToast({
        type: 'error',
        title: 'Validation Error',
        message: 'Please complete all required fields (names, email, branch).',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/employees/${employee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update employee');
      }

      addToast({
        type: 'success',
        title: language === 'ar' ? 'تم تحديث بيانات الموظف بنجاح' : 'Employee Details Updated',
        message: `${employee.employeeNumber} - ${form.firstNameEn} ${form.lastNameEn}`,
      });

      onEmployeeUpdated();
      onClose();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Update Failed', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!employee) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={language === 'ar' ? `تعديل بيانات الموظف (${employee.employeeNumber})` : `Edit Employee Details (${employee.employeeNumber})`}
      description={language === 'ar' ? 'تحديث الملف التعريفي، الصورة الشخصية، التكليف الوظيفي، وهيكل الراتب.' : 'Update employee master records, profile photo, position assignment, and compensation.'}
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
                {s === 'personal'
                  ? language === 'ar' ? '1. البيانات الشخصية والصورة' : '1. Personal & Photo'
                  : s === 'placement'
                  ? language === 'ar' ? '2. التعيين والعقد' : '2. Placement & Contract'
                  : language === 'ar' ? '3. الراتب والبنك' : '3. Compensation & Bank'}
              </button>
            ))}
          </div>

          <div className="flex space-x-2 rtl:space-x-reverse">
            <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button variant="primary" size="sm" onClick={handleSubmit} isLoading={isSubmitting}>
              {language === 'ar' ? 'حفظ التعديلات' : 'Save Changes'}
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* SECTION 1: PERSONAL & PHOTO */}
        {activeSection === 'personal' && (
          <div className="space-y-4">
            {/* Photo Upload Card */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-4">
              <div className="relative w-16 h-16 rounded-lg bg-slate-200 border-2 border-slate-300 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                {form.avatarUrl ? (
                  <img src={form.avatarUrl} alt="Employee Preview" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-8 h-8 text-slate-400" />
                )}
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="text-xs font-bold text-slate-800">
                  {language === 'ar' ? 'الصورة الشخصية للموظف' : 'Employee Profile Photo'}
                </div>
                <p className="text-[11px] text-slate-500">
                  {language === 'ar' ? 'تُستخدم في بطاقة العمل (ID Card) ومسيرات الرواتب وملف الموظف (PNG, JPG بحد أقصى 2MB).' : 'Used in official ID Card, payslips, and employee profile. (PNG, JPG up to 2MB).'}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <label className="px-2.5 py-1 bg-white border border-slate-300 rounded text-slate-700 font-medium text-xs hover:bg-slate-50 cursor-pointer inline-flex items-center gap-1.5 shadow-2xs">
                    <Camera className="w-3.5 h-3.5 text-slate-600" />
                    <span>{language === 'ar' ? 'تغيير الصورة' : 'Upload Photo'}</span>
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  </label>
                  {form.avatarUrl && (
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 rounded text-xs font-medium inline-flex items-center gap-1 border border-rose-200 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{language === 'ar' ? 'إزالة' : 'Remove'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Names */}
            <div className="grid grid-cols-2 gap-3">
              <FormField label={language === 'ar' ? 'الاسم الأول (إنجليزي)' : 'First Name (English)'} required>
                <Input
                  value={form.firstNameEn}
                  onChange={(e) => updateField('firstNameEn', e.target.value)}
                  placeholder="Tariq"
                  required
                />
              </FormField>
              <FormField label={language === 'ar' ? 'اسم العائلة (إنجليزي)' : 'Last Name (English)'} required>
                <Input
                  value={form.lastNameEn}
                  onChange={(e) => updateField('lastNameEn', e.target.value)}
                  placeholder="Al-Mansoor"
                  required
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3" dir="rtl">
              <FormField label="الاسم الأول (بالعربي)" required>
                <Input
                  value={form.firstNameAr}
                  onChange={(e) => updateField('firstNameAr', e.target.value)}
                  placeholder="طارق"
                  required
                />
              </FormField>
              <FormField label="اسم العائلة (بالعربي)" required>
                <Input
                  value={form.lastNameAr}
                  onChange={(e) => updateField('lastNameAr', e.target.value)}
                  placeholder="المنصور"
                  required
                />
              </FormField>
            </div>

            {/* Identity Details */}
            <div className="grid grid-cols-3 gap-3">
              <FormField label={language === 'ar' ? 'الجنس' : 'Gender'} required>
                <Select
                  value={form.gender}
                  onChange={(e) => updateField('gender', e.target.value)}
                  options={[
                    { value: 'MALE', label: language === 'ar' ? 'ذكر' : 'Male' },
                    { value: 'FEMALE', label: language === 'ar' ? 'أنثى' : 'Female' },
                  ]}
                />
              </FormField>
              <FormField label={language === 'ar' ? 'الجنسية' : 'Nationality'} required>
                <Input
                  value={form.nationality}
                  onChange={(e) => updateField('nationality', e.target.value)}
                  placeholder="Kuwaiti / Egyptian / Indian"
                  required
                />
              </FormField>
              <FormField label={language === 'ar' ? 'الحالة الاجتماعية' : 'Marital Status'}>
                <Select
                  value={form.maritalStatus}
                  onChange={(e) => updateField('maritalStatus', e.target.value)}
                  options={[
                    { value: 'SINGLE', label: language === 'ar' ? 'أعزب' : 'Single' },
                    { value: 'MARRIED', label: language === 'ar' ? 'متزوج' : 'Married' },
                    { value: 'DIVORCED', label: language === 'ar' ? 'مطلق' : 'Divorced' },
                    { value: 'WIDOWED', label: language === 'ar' ? 'أرمل' : 'Widowed' },
                  ]}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label={language === 'ar' ? 'الرقم المدني / الهوية الوطنية' : 'Civil ID / National ID Number'}>
                <Input
                  value={form.civilIdNumber}
                  onChange={(e) => updateField('civilIdNumber', e.target.value)}
                  placeholder="290010101234"
                  className="font-mono"
                />
              </FormField>
              <FormField label={language === 'ar' ? 'رقم جواز السفر' : 'Passport Number'}>
                <Input
                  value={form.passportNumber}
                  onChange={(e) => updateField('passportNumber', e.target.value)}
                  placeholder="N12345678"
                  className="font-mono"
                />
              </FormField>
            </div>

            {/* Contacts */}
            <div className="grid grid-cols-2 gap-3">
              <FormField label={language === 'ar' ? 'البريد الإلكتروني الرسمي' : 'Official Email'} required>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="tariq@company.com"
                  required
                />
              </FormField>
              <FormField label={language === 'ar' ? 'رقم الهاتف' : 'Contact Phone'}>
                <Input
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="+965 99887766"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label={language === 'ar' ? 'العنوان (إنجليزي)' : 'Address (English)'}>
                <Input
                  value={form.addressEn}
                  onChange={(e) => updateField('addressEn', e.target.value)}
                  placeholder="Salmiya, Block 4, Street 10"
                />
              </FormField>
              <FormField label={language === 'ar' ? 'العنوان (عربي)' : 'Address (Arabic)'}>
                <Input
                  value={form.addressAr}
                  onChange={(e) => updateField('addressAr', e.target.value)}
                  placeholder="السالمية، قطعة 4، شارع 10"
                  dir="rtl"
                />
              </FormField>
            </div>
          </div>
        )}

        {/* SECTION 2: PLACEMENT & CONTRACT */}
        {activeSection === 'placement' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField label={language === 'ar' ? 'الفرع / مركز التكلفة' : 'Branch'} required>
                <Select
                  value={form.branchId}
                  onChange={(e) => updateField('branchId', e.target.value)}
                  options={branches.map((b) => ({
                    value: b.id,
                    label: `${b.code} - ${language === 'ar' ? b.nameAr : b.nameEn}`,
                  }))}
                />
              </FormField>

              <FormField label={language === 'ar' ? 'حالة التوظيف' : 'Employment Status'} required>
                <Select
                  value={form.employmentStatus}
                  onChange={(e) => updateField('employmentStatus', e.target.value)}
                  options={[
                    { value: 'ACTIVE', label: language === 'ar' ? 'نشط (على رأس عمله)' : 'Active' },
                    { value: 'ON_LEAVE', label: language === 'ar' ? 'في إجازة' : 'On Leave' },
                    { value: 'SUSPENDED', label: language === 'ar' ? 'موقوف مؤقتاً' : 'Suspended' },
                    { value: 'INACTIVE', label: language === 'ar' ? 'غير نشط' : 'Inactive' },
                    { value: 'TERMINATED', label: language === 'ar' ? 'منتهي الخدمة' : 'Terminated' },
                  ]}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label={language === 'ar' ? 'القسم' : 'Department'}>
                <Select
                  value={form.departmentId}
                  onChange={(e) => updateField('departmentId', e.target.value)}
                  options={[
                    { value: '', label: language === 'ar' ? '-- بدون قسم --' : '-- No Department --' },
                    ...departments.map((d) => ({
                      value: d.id,
                      label: language === 'ar' ? d.nameAr : d.nameEn,
                    })),
                  ]}
                />
              </FormField>

              <FormField label={language === 'ar' ? 'المسمى الوظيفي' : 'Designation'}>
                <Select
                  value={form.designationId}
                  onChange={(e) => updateField('designationId', e.target.value)}
                  options={[
                    { value: '', label: language === 'ar' ? '-- بدون مسمى --' : '-- No Designation --' },
                    ...designations.map((d) => ({
                      value: d.id,
                      label: language === 'ar' ? d.nameAr : d.nameEn,
                    })),
                  ]}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label={language === 'ar' ? 'نوع العقد' : 'Contract Type'} required>
                <Select
                  value={form.contractType}
                  onChange={(e) => updateField('contractType', e.target.value)}
                  options={[
                    { value: 'UNLIMITED', label: language === 'ar' ? 'عقد غير محدد المدة' : 'Unlimited Duration' },
                    { value: 'LIMITED', label: language === 'ar' ? 'عقد محدد المدة' : 'Limited Duration' },
                    { value: 'PROJECT_BASED', label: language === 'ar' ? 'مرتبط بالمشروع' : 'Project-Based' },
                    { value: 'PART_TIME', label: language === 'ar' ? 'دوام جزئي' : 'Part-Time' },
                    { value: 'TEMPORARY', label: language === 'ar' ? 'مؤقت' : 'Temporary' },
                  ]}
                />
              </FormField>

              <FormField label={language === 'ar' ? 'موقع العمل' : 'Work Location'}>
                <Input
                  value={form.workLocation}
                  onChange={(e) => updateField('workLocation', e.target.value)}
                  placeholder="Main Office / Field Site A"
                />
              </FormField>
            </div>
          </div>
        )}

        {/* SECTION 3: COMPENSATION & WPS BANKING */}
        {activeSection === 'compensation' && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <div className="font-bold text-slate-800 flex items-center justify-between">
                <span>{language === 'ar' ? 'هيكل الراتب والبدلات' : 'Salary Structure & Allowances'}</span>
                <span className="font-mono text-xs text-amber-600 font-bold">{form.currency}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label={language === 'ar' ? 'الراتب الأساسي' : 'Basic Salary'} required>
                  <Input
                    value={form.basicSalary}
                    onChange={(e) => updateField('basicSalary', e.target.value)}
                    placeholder="450.000"
                    className="font-mono"
                    required
                  />
                </FormField>
                <FormField label={language === 'ar' ? 'بدل سكن' : 'Housing Allowance'}>
                  <Input
                    value={form.housingAllowance}
                    onChange={(e) => updateField('housingAllowance', e.target.value)}
                    placeholder="100.000"
                    className="font-mono"
                  />
                </FormField>
                <FormField label={language === 'ar' ? 'بدل انتقال' : 'Transport Allowance'}>
                  <Input
                    value={form.transportAllowance}
                    onChange={(e) => updateField('transportAllowance', e.target.value)}
                    placeholder="50.000"
                    className="font-mono"
                  />
                </FormField>
                <FormField label={language === 'ar' ? 'بدلات أخرى' : 'Other Allowances'}>
                  <Input
                    value={form.otherAllowances}
                    onChange={(e) => updateField('otherAllowances', e.target.value)}
                    placeholder="0.000"
                    className="font-mono"
                  />
                </FormField>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <div className="font-bold text-slate-800">
                {language === 'ar' ? 'بيانات حساب تحويل الرواتب (WPS)' : 'Wage Protection System (WPS) Bank Account'}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label={language === 'ar' ? 'اسم البنك' : 'Bank Name'}>
                  <Input
                    value={form.bankName}
                    onChange={(e) => updateField('bankName', e.target.value)}
                    placeholder="National Bank of Kuwait (NBK)"
                  />
                </FormField>
                <FormField label={language === 'ar' ? 'رمز البنك' : 'Bank Code / Routing'}>
                  <Input
                    value={form.bankCode}
                    onChange={(e) => updateField('bankCode', e.target.value)}
                    placeholder="NBK"
                    className="font-mono"
                  />
                </FormField>
                <div className="col-span-2">
                  <FormField label={language === 'ar' ? 'رقم الآيبان (IBAN)' : 'IBAN'}>
                    <Input
                      value={form.iban}
                      onChange={(e) => updateField('iban', e.target.value)}
                      placeholder="KW00NBKK0000000000000000000000"
                      className="font-mono"
                    />
                  </FormField>
                </div>
                <FormField label={language === 'ar' ? 'رقم الحساب' : 'Account Number'}>
                  <Input
                    value={form.accountNumber}
                    onChange={(e) => updateField('accountNumber', e.target.value)}
                    placeholder="123456789"
                    className="font-mono"
                  />
                </FormField>
                <FormField label={language === 'ar' ? 'سويفت كود' : 'SWIFT / BIC'}>
                  <Input
                    value={form.swiftBic}
                    onChange={(e) => updateField('swiftBic', e.target.value)}
                    placeholder="NBKKKWKW"
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
