/**
 * GulfHive ERP - First-Run Institution & Company Setup Wizard
 * Professional step-by-step onboarding to establish parent legal entity, headquarters campus/branch, and Super Administrator account.
 * Clean, production-ready form with zero hardcoded dummy data.
 */

import React, { useState } from 'react';
import { useI18n } from '../shared/i18n/I18nContext.tsx';
import { VALID_GCC_COUNTRIES } from '../core/domain/tenant.ts';
import { SUPPORTED_CURRENCIES } from '../core/domain/money.ts';
import {
  Building2,
  MapPin,
  Calendar,
  UserCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  Lock
} from 'lucide-react';
import { Button, Input, Select, FormField, useToast } from '../design-system/index.ts';
import { apiClient } from '../lib/api-client.ts';

interface FirstRunWizardProps {
  onCompanyCreated: (tenant: any, token?: string, user?: any) => void;
  onCancel?: () => void;
}

export function FirstRunWizard({ onCompanyCreated, onCancel }: FirstRunWizardProps) {
  const { t, language, direction } = useI18n();
  const { addToast } = useToast();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  // Form State - strictly clean without hardcoded fake data
  const [formData, setFormData] = useState({
    // Step 1: Legal Entity & Jurisdiction
    code: '',
    legalNameEn: '',
    legalNameAr: '',
    tradeNameEn: '',
    tradeNameAr: '',
    countryCode: 'KW',
    baseCurrency: 'KWD',
    crNumber: '',
    taxNumber: '',

    // Step 2: Head Office & Main Branch / Campus
    branchCode: 'HQ',
    branchNameEn: '',
    branchNameAr: '',
    cityEn: 'Kuwait City',
    cityAr: 'مدينة الكويت',
    branchAddressEn: '',
    branchAddressAr: '',
    branchPhone: '',

    // Step 3: Fiscal & Operational Defaults
    fiscalYearStartMonth: 1,
    timezone: 'Asia/Kuwait',
    phone: '',
    email: '',
    website: '',
    addressEn: '',
    addressAr: '',

    // Step 4: Primary Super Admin Account
    adminDisplayName: '',
    adminEmail: '',
    adminUsername: '',
    adminPhone: '',
    adminPassword: '',
    adminPasswordConfirm: '',
    adminUid: '',
  });

  const updateField = (field: string, value: any) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };

      if (field === 'countryCode') {
        const country = VALID_GCC_COUNTRIES[value];
        if (country) {
          updated.baseCurrency = country.defaultCurrency;
          updated.timezone = country.defaultTz;
          if (value === 'KW') {
            updated.cityEn = 'Kuwait City';
            updated.cityAr = 'مدينة الكويت';
          } else if (value === 'SA') {
            updated.cityEn = 'Riyadh';
            updated.cityAr = 'الرياض';
          } else if (value === 'AE') {
            updated.cityEn = 'Dubai';
            updated.cityAr = 'دبي';
          } else if (value === 'QA') {
            updated.cityEn = 'Doha';
            updated.cityAr = 'الدوحة';
          } else if (value === 'BH') {
            updated.cityEn = 'Manama';
            updated.cityAr = 'المنامة';
          } else if (value === 'OM') {
            updated.cityEn = 'Muscat';
            updated.cityAr = 'مسقط';
          }
        }
      }

      if (field === 'adminEmail' && !prev.adminUsername) {
        // Auto-suggest clean username from email if not explicitly set
        const suggested = String(value).split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (suggested) {
          updated.adminUsername = suggested;
        }
      }

      return updated;
    });
  };

  const validateStep = (step: number): boolean => {
    setErrorMessage(null);
    if (step === 1) {
      if (!formData.code.trim()) {
        setErrorMessage(language === 'ar' ? 'يرجى إدخال رمز المنشأة / المؤسسة' : 'Organization / Company code is required');
        return false;
      }
      if (!formData.legalNameEn.trim()) {
        setErrorMessage(language === 'ar' ? 'الاسم النظامي بالإنجليزية مطلوب' : 'English legal name is required');
        return false;
      }
      if (!formData.legalNameAr.trim()) {
        setErrorMessage(language === 'ar' ? 'الاسم النظامي بالعربية مطلوب' : 'Arabic / Native legal name is required');
        return false;
      }
    } else if (step === 2) {
      if (!formData.branchCode.trim()) {
        setErrorMessage(language === 'ar' ? 'رمز الفرع / المقر الرئيسي مطلوب' : 'Main branch / Campus code is required');
        return false;
      }
      if (!formData.branchNameEn.trim() || !formData.branchNameAr.trim()) {
        setErrorMessage(language === 'ar' ? 'يرجى إدخال اسم الفرع الرئيسي باللغتين' : 'Main branch name in English and Arabic is required');
        return false;
      }
    } else if (step === 4) {
      if (!formData.adminDisplayName.trim()) {
        setErrorMessage(language === 'ar' ? 'يرجى إدخال الاسم الكامل للمسؤول الرئيسي' : 'Super Admin Full Name is required');
        return false;
      }
      if (!formData.adminEmail.trim() || !formData.adminEmail.includes('@')) {
        setErrorMessage(language === 'ar' ? 'البريد الإلكتروني للمسؤول مطلوب وصحيح' : 'Valid Administrator email is required');
        return false;
      }
      if (!formData.adminUsername.trim()) {
        setErrorMessage(language === 'ar' ? 'اسم المستخدم للمسؤول مطلوب' : 'Administrator username is required');
        return false;
      }
      if (!formData.adminPassword || formData.adminPassword.length < 8) {
        setErrorMessage(language === 'ar' ? 'كلمة المرور يجب أن لا تقل عن 8 خانات' : 'Super Admin password must be at least 8 characters');
        return false;
      }
      if (formData.adminPassword !== formData.adminPasswordConfirm) {
        setErrorMessage(language === 'ar' ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 5));
    }
  };

  const handlePrevious = () => {
    setErrorMessage(null);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(4)) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const generatedUid = formData.adminUid || `admin_${Date.now()}`;

    try {
      const payload = {
        ...formData,
        adminUid: generatedUid,
        adminUsername: formData.adminUsername.trim().toLowerCase(),
        adminEmail: formData.adminEmail.trim().toLowerCase(),
      };

      const data = await apiClient.post<any>('/api/setup/company', payload);

      if (!data?.tenant) {
        throw new Error('Setup completed but tenant metadata was not returned by server.');
      }

      addToast({
        type: 'success',
        title: language === 'ar' ? 'تم تأسيس المنشأة والحساب بنجاح' : 'Enterprise & Super Admin Established',
        message: `${data.tenant.code} - ${language === 'ar' ? data.tenant.legalNameAr : data.tenant.legalNameEn}`,
      });

      if (data.token) {
        localStorage.setItem('gulfhive_session_token', data.token);
      }

      onCompanyCreated(data.tenant, data.token, data.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to establish company. Please verify details and retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { num: 1, title: language === 'ar' ? 'المنشأة' : 'Institution', icon: Building2 },
    { num: 2, title: language === 'ar' ? 'الفروع' : 'Location', icon: MapPin },
    { num: 3, title: language === 'ar' ? 'المالية' : 'Finance', icon: Calendar },
    { num: 4, title: language === 'ar' ? 'المسؤول' : 'Super Admin', icon: UserCheck },
    { num: 5, title: language === 'ar' ? 'المراجعة' : 'Review', icon: ShieldCheck },
  ];

  const PrevIcon = direction === 'rtl' ? ArrowRight : ArrowLeft;
  const NextIcon = direction === 'rtl' ? ArrowLeft : ArrowRight;

  return (
    <div className="max-w-4xl w-full mx-auto py-4 px-4 overflow-x-hidden select-none">
      {/* Wizard Header Banner */}
      <div className="bg-slate-900 text-white rounded-t-xl p-6 border-b border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <div className="w-9 h-9 rounded bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-sm shadow-md font-mono">
              GH
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">
                {language === 'ar' ? 'معالج إعداد وتأسيس المنشأة الجديد' : 'Institution Onboarding & Setup Wizard'}
              </h1>
              <p className="text-xs text-slate-300">
                {language === 'ar'
                  ? 'تهيئة المنشأة والمقر الرئيسي وتأسيس حساب المسؤول العام (Super Admin)'
                  : 'Configure institution details, headquarters, and create the primary Super Administrator.'}
              </p>
            </div>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded border border-slate-700 bg-slate-800 transition cursor-pointer"
            >
              {language === 'ar' ? 'إلغاء' : 'Back to Login'}
            </button>
          )}
        </div>

        {/* Stepper Bar */}
        <div className="mt-6 grid grid-cols-5 gap-2 text-xs">
          {steps.map((s) => {
            const Icon = s.icon;
            const isCompleted = currentStep > s.num;
            const isCurrent = currentStep === s.num;
            return (
              <div
                key={s.num}
                className={`flex flex-col items-center justify-center p-2 rounded text-center transition-colors ${
                  isCurrent
                    ? 'bg-slate-800 text-amber-400 font-semibold'
                    : isCompleted
                    ? 'text-emerald-400 font-medium'
                    : 'text-slate-400'
                }`}
              >
                <div className="flex items-center justify-center w-7 h-7 rounded-full mb-1.5 bg-slate-800 text-xs shrink-0 shadow-2xs">
                  {isCompleted ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Icon className="w-3.5 h-3.5" />}
                </div>
                <span className="text-[11px] leading-tight text-center whitespace-normal break-words max-w-full">
                  {s.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Wizard Card Body */}
      <div className="bg-white rounded-b-xl border border-slate-200 border-t-0 p-8 shadow-sm">
        {errorMessage && (
          <div className="mb-6 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center space-x-2 rtl:space-x-reverse">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: Legal Entity & Jurisdiction */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-1">{t('wizard.step1.title')}</h2>
              <p className="text-xs text-slate-500">{t('wizard.step1.desc')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label={t('field.company_code')} hint="Unique uppercase identifier (e.g. CORP-01, SCH-01)" required>
                <Input
                  type="text"
                  value={formData.code}
                  onChange={(e) => updateField('code', e.target.value.toUpperCase())}
                  placeholder="e.g. CORP-01"
                  className="font-mono uppercase"
                  required
                />
              </FormField>

              <FormField label={t('field.country')} required>
                <Select
                  value={formData.countryCode}
                  onChange={(e) => updateField('countryCode', e.target.value)}
                >
                  {Object.entries(VALID_GCC_COUNTRIES).map(([code, c]) => (
                    <option key={code} value={code}>
                      {language === 'ar' ? c.nameAr : c.nameEn} ({code})
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label={t('field.legal_name_en')} required>
                <Input
                  type="text"
                  value={formData.legalNameEn}
                  onChange={(e) => updateField('legalNameEn', e.target.value)}
                  placeholder="e.g. Al-Ameen Enterprises W.L.L."
                  required
                />
              </FormField>

              <FormField label={t('field.legal_name_ar')} required>
                <Input
                  type="text"
                  value={formData.legalNameAr}
                  onChange={(e) => updateField('legalNameAr', e.target.value)}
                  placeholder="مثال: شركة الأمين للمشاريع ذ.م.م"
                  required
                />
              </FormField>

              <FormField label={t('field.trade_name_en')}>
                <Input
                  type="text"
                  value={formData.tradeNameEn}
                  onChange={(e) => updateField('tradeNameEn', e.target.value)}
                  placeholder="e.g. Al-Ameen Group"
                />
              </FormField>

              <FormField label={t('field.trade_name_ar')}>
                <Input
                  type="text"
                  value={formData.tradeNameAr}
                  onChange={(e) => updateField('tradeNameAr', e.target.value)}
                  placeholder="مثال: مجموعة الأمين"
                />
              </FormField>

              <FormField label={t('field.cr_number')}>
                <Input
                  type="text"
                  value={formData.crNumber}
                  onChange={(e) => updateField('crNumber', e.target.value)}
                  placeholder="CR-1234567"
                  className="font-mono"
                />
              </FormField>

              <FormField label={t('field.tax_number')}>
                <Input
                  type="text"
                  value={formData.taxNumber}
                  onChange={(e) => updateField('taxNumber', e.target.value)}
                  placeholder="TAX-998877"
                  className="font-mono"
                />
              </FormField>
            </div>
          </div>
        )}

        {/* STEP 2: Head Office & Main Branch */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-1">{t('wizard.step2.title')}</h2>
              <p className="text-xs text-slate-500">{t('wizard.step2.desc')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label={t('field.branch_code')} required>
                <Input
                  type="text"
                  value={formData.branchCode}
                  onChange={(e) => updateField('branchCode', e.target.value.toUpperCase())}
                  placeholder="HQ"
                  className="font-mono uppercase"
                  required
                />
              </FormField>

              <div className="flex items-center pt-6">
                <div className="flex items-center space-x-2 rtl:space-x-reverse text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2 w-full">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{language === 'ar' ? 'هذا الفرع سيكون المقر الرئيسي الافتراضي للمنشأة' : 'Designated as Primary Headquarters Branch / Main Campus'}</span>
                </div>
              </div>

              <FormField label={t('field.branch_name_en')} required>
                <Input
                  type="text"
                  value={formData.branchNameEn}
                  onChange={(e) => updateField('branchNameEn', e.target.value)}
                  placeholder="e.g. Headquarters / Main Campus"
                  required
                />
              </FormField>

              <FormField label={t('field.branch_name_ar')} required>
                <Input
                  type="text"
                  value={formData.branchNameAr}
                  onChange={(e) => updateField('branchNameAr', e.target.value)}
                  placeholder="مثال: المقر الرئيسي / الحرم الرئيسي"
                  required
                />
              </FormField>

              <FormField label={t('field.city_en')}>
                <Input
                  type="text"
                  value={formData.cityEn}
                  onChange={(e) => updateField('cityEn', e.target.value)}
                  placeholder="Kuwait City"
                />
              </FormField>

              <FormField label={t('field.city_ar')}>
                <Input
                  type="text"
                  value={formData.cityAr}
                  onChange={(e) => updateField('cityAr', e.target.value)}
                  placeholder="مدينة الكويت"
                />
              </FormField>

              <FormField label={t('field.branch_address_en')}>
                <Input
                  type="text"
                  value={formData.branchAddressEn}
                  onChange={(e) => updateField('branchAddressEn', e.target.value)}
                  placeholder="Tower 4, Floor 12, Financial District"
                />
              </FormField>

              <FormField label={t('field.branch_phone')}>
                <Input
                  type="text"
                  value={formData.branchPhone}
                  onChange={(e) => updateField('branchPhone', e.target.value)}
                  placeholder="+965 2200 0000"
                  className="font-mono"
                />
              </FormField>
            </div>
          </div>
        )}

        {/* STEP 3: Fiscal & Operational Defaults */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-1">{t('wizard.step3.title')}</h2>
              <p className="text-xs text-slate-500">{t('wizard.step3.desc')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label={t('field.base_currency')} required>
                <Select
                  value={formData.baseCurrency}
                  onChange={(e) => updateField('baseCurrency', e.target.value)}
                >
                  {Object.values(SUPPORTED_CURRENCIES).map((curr) => (
                    <option key={curr.code} value={curr.code}>
                      {curr.code} - {language === 'ar' ? curr.nameAr : curr.nameEn} ({curr.decimals} Decimals)
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label={t('field.fiscal_start_month')} required>
                <Select
                  value={formData.fiscalYearStartMonth}
                  onChange={(e) => updateField('fiscalYearStartMonth', Number(e.target.value))}
                >
                  <option value={1}>January (Standard Corporate Calendar)</option>
                  <option value={4}>April</option>
                  <option value={7}>July (Academic / Mid-Year Calendar)</option>
                  <option value={10}>October</option>
                </Select>
              </FormField>

              <FormField label={t('field.timezone')}>
                <Input
                  type="text"
                  value={formData.timezone}
                  onChange={(e) => updateField('timezone', e.target.value)}
                  className="font-mono"
                />
              </FormField>

              <FormField label={t('field.company_email')}>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="contact@enterprise.com"
                />
              </FormField>

              <FormField label={t('field.company_phone')}>
                <Input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="+965 2200 0000"
                  className="font-mono"
                />
              </FormField>

              <FormField label={t('field.company_website')}>
                <Input
                  type="text"
                  value={formData.website}
                  onChange={(e) => updateField('website', e.target.value)}
                  placeholder="https://enterprise.com"
                />
              </FormField>
            </div>
          </div>
        )}

        {/* STEP 4: Super Administrator Profile */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-1">
                {language === 'ar' ? 'إنشاء حساب المسؤول العام (Super Admin)' : 'Primary Super Administrator Account'}
              </h2>
              <p className="text-xs text-slate-500">
                {language === 'ar'
                  ? 'سيتم منح هذا المستخدم أعلى صلاحيات إدارة النظام (Super Admin) لإدارة المنشأة والمستخدمين.'
                  : 'This initial user will be established with Super Admin privileges to oversee all modules and configure security.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label={language === 'ar' ? 'الاسم الكامل للمسؤول *' : 'Super Admin Full Name *'} required>
                <Input
                  type="text"
                  value={formData.adminDisplayName}
                  onChange={(e) => updateField('adminDisplayName', e.target.value)}
                  placeholder="e.g. Master Administrator"
                  required
                />
              </FormField>

              <FormField label={language === 'ar' ? 'البريد الإلكتروني للمسؤول *' : 'Administrator Email *'} required>
                <Input
                  type="email"
                  value={formData.adminEmail}
                  onChange={(e) => updateField('adminEmail', e.target.value)}
                  placeholder="e.g. admin@institution.edu"
                  required
                />
              </FormField>

              <FormField label={language === 'ar' ? 'اسم المستخدم للدخول *' : 'Login Username *'} required>
                <Input
                  type="text"
                  value={formData.adminUsername}
                  onChange={(e) => updateField('adminUsername', e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                  placeholder="e.g. superadmin"
                  className="font-mono"
                  required
                />
              </FormField>

              <FormField label={language === 'ar' ? 'رقم الهاتف (اختياري)' : 'Contact Phone (Optional)'}>
                <Input
                  type="text"
                  value={formData.adminPhone}
                  onChange={(e) => updateField('adminPhone', e.target.value)}
                  placeholder="+965 9900 0000"
                  className="font-mono"
                />
              </FormField>

              <FormField label={language === 'ar' ? 'كلمة المرور المشفرة * (8 خانات كحد أدنى)' : 'Secure Password * (Min 8 characters)'} required>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.adminPassword}
                    onChange={(e) => updateField('adminPassword', e.target.value)}
                    placeholder="••••••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-2 rtl:right-auto rtl:left-2 flex items-center px-2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </FormField>

              <FormField label={language === 'ar' ? 'تأكيد كلمة المرور *' : 'Confirm Password *'} required>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.adminPasswordConfirm}
                    onChange={(e) => updateField('adminPasswordConfirm', e.target.value)}
                    placeholder="••••••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-2 rtl:right-auto rtl:left-2 flex items-center px-2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </FormField>

              <div className="col-span-1 md:col-span-2 p-3 bg-amber-50/80 border border-amber-200 rounded-lg flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
                <div className="text-xs text-amber-900">
                  <span className="font-bold block">
                    {language === 'ar' ? 'صلاحيات المسؤول العام (SUPER_ADMIN):' : 'Assigned Role: SUPER_ADMIN'}
                  </span>
                  <span className="text-amber-800 text-[11px]">
                    {language === 'ar'
                      ? 'يتمتع بكامل الصلاحيات الإدارية والمالية والأمنية وإدارة كافة فروع ومستخدمي النظام.'
                      : 'Full administrative access across organization, modules, user provisioning, and statutory compliance.'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: Review & Confirmation */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-1">{t('wizard.step5.title')}</h2>
              <p className="text-xs text-slate-500">
                {language === 'ar'
                  ? 'يرجى مراجعة كافة بيانات المنشأة وحساب المسؤول قبل إتمام التأسيس النهائي.'
                  : 'Please review all entity specifications and administrator credentials before final initialization.'}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pb-4 border-b border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[11px] mb-0.5">{t('field.company_code')}</span>
                  <span className="font-mono font-bold text-slate-900">{formData.code || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px] mb-0.5">{t('field.country')}</span>
                  <span className="font-semibold text-slate-800">
                    {VALID_GCC_COUNTRIES[formData.countryCode]?.nameEn} ({formData.countryCode})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px] mb-0.5">{t('field.base_currency')}</span>
                  <span className="font-mono font-bold text-amber-600">{formData.baseCurrency}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[11px] mb-0.5">{t('field.legal_name_en')}</span>
                  <span className="font-medium text-slate-800">{formData.legalNameEn || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px] mb-0.5">{t('field.legal_name_ar')}</span>
                  <span className="font-medium text-slate-800">{formData.legalNameAr || 'N/A'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pb-4 border-b border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[11px] mb-0.5">{t('field.branch_code')}</span>
                  <span className="font-mono font-bold text-slate-900">{formData.branchCode || 'HQ'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px] mb-0.5">{language === 'ar' ? 'اسم المقر الرئيسي' : 'Headquarters Branch'}</span>
                  <span className="font-medium text-slate-800">{formData.branchNameEn || 'Main Campus'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px] mb-0.5">{t('field.timezone')}</span>
                  <span className="font-mono text-slate-700">{formData.timezone}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 bg-white p-3 rounded border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[11px] mb-0.5">{language === 'ar' ? 'المسؤول العام' : 'Super Admin'}</span>
                  <span className="font-bold text-slate-900">{formData.adminDisplayName || 'Administrator'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px] mb-0.5">Email</span>
                  <span className="font-mono text-slate-800">{formData.adminEmail || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px] mb-0.5">Username</span>
                  <span className="font-mono font-bold text-amber-700">{formData.adminUsername || 'superadmin'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Wizard Action Footer Bar */}
        <div className="mt-8 pt-5 border-t border-slate-200 flex items-center justify-between">
          <div>
            {currentStep > 1 && (
              <Button
                variant="secondary"
                size="md"
                onClick={handlePrevious}
                leftIcon={<PrevIcon className="w-4 h-4" />}
                disabled={isSubmitting}
              >
                {t('action.previous')}
              </Button>
            )}
          </div>

          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            {currentStep < 5 ? (
              <Button
                variant="primary"
                size="md"
                onClick={handleNext}
                rightIcon={<NextIcon className="w-4 h-4" />}
              >
                {t('action.next')}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                onClick={handleSubmit}
                isLoading={isSubmitting}
                leftIcon={<ShieldCheck className="w-4 h-4" />}
              >
                {language === 'ar' ? 'تأسيس المنشأة وبدء العمل' : 'Establish Institution & Launch ERP'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
