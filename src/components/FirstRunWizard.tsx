/**
 * GulfHive ERP - First-Run Company Setup Wizard
 * Step-by-step guided onboarding to establish parent legal entity, headquarters branch, and administrator account.
 * Uses GulfHive Design System: FormField, Input, Select, Button, Toast.
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
  AlertCircle
} from 'lucide-react';
import { Button, Input, Select, FormField, useToast } from '../design-system/index.ts';

interface FirstRunWizardProps {
  onCompanyCreated: (tenant: any) => void;
}

export function FirstRunWizard({ onCompanyCreated }: FirstRunWizardProps) {
  const { t, language, direction } = useI18n();
  const { addToast } = useToast();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Legal Entity
    code: 'CORP-01',
    legalNameEn: '',
    legalNameAr: '',
    tradeNameEn: '',
    tradeNameAr: '',
    countryCode: 'KW',
    baseCurrency: 'KWD',
    crNumber: '',
    taxNumber: '',

    // Step 2: Head Office & Main Branch
    branchCode: 'HQ',
    branchNameEn: 'Head Office',
    branchNameAr: 'المقر الرئيسي',
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

    // Step 4: Administrator Profile
    adminDisplayName: 'Master Administrator',
    adminEmail: 'admin@gulfhive.internal',
    adminUid: `admin_${Date.now()}`,
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
      return updated;
    });
  };

  const validateStep = (step: number): boolean => {
    setErrorMessage(null);
    if (step === 1) {
      if (!formData.code.trim()) {
        setErrorMessage(language === 'ar' ? 'يرجى إدخال رمز المنشأة' : 'Company code is required');
        return false;
      }
      if (!formData.legalNameEn.trim()) {
        setErrorMessage(language === 'ar' ? 'الاسم النظامي بالإنجليزية مطلوب' : 'English legal name is required');
        return false;
      }
      if (!formData.legalNameAr.trim()) {
        setErrorMessage(language === 'ar' ? 'الاسم النظامي بالعربية مطلوب' : 'Arabic legal name is required');
        return false;
      }
    } else if (step === 2) {
      if (!formData.branchCode.trim()) {
        setErrorMessage(language === 'ar' ? 'رمز الفرع الرئيسي مطلوب' : 'Branch code is required');
        return false;
      }
      if (!formData.branchNameEn.trim() || !formData.branchNameAr.trim()) {
        setErrorMessage(language === 'ar' ? 'يرجى إدخال اسم الفرع باللغتين' : 'Branch name in English and Arabic is required');
        return false;
      }
    } else if (step === 4) {
      if (!formData.adminEmail.trim()) {
        setErrorMessage(language === 'ar' ? 'البريد الإلكتروني لمدير المنشأة مطلوب' : 'Administrator email is required');
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

    try {
      const response = await fetch('/api/setup/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to establish company');
      }

      addToast({
        type: 'success',
        title: language === 'ar' ? 'تم تأسيس المنشأة بنجاح' : 'Enterprise Established',
        message: `${data.tenant.code} - ${language === 'ar' ? data.tenant.legalNameAr : data.tenant.legalNameEn}`,
      });

      onCompanyCreated(data.tenant);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to establish company. Please verify details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { num: 1, title: t('wizard.step1.title'), icon: Building2 },
    { num: 2, title: t('wizard.step2.title'), icon: MapPin },
    { num: 3, title: t('wizard.step3.title'), icon: Calendar },
    { num: 4, title: t('wizard.step4.title'), icon: UserCheck },
    { num: 5, title: t('wizard.step5.title'), icon: ShieldCheck },
  ];

  const PrevIcon = direction === 'rtl' ? ArrowRight : ArrowLeft;
  const NextIcon = direction === 'rtl' ? ArrowLeft : ArrowRight;

  return (
    <div className="max-w-4xl w-full mx-auto py-4 px-4 overflow-x-hidden">
      {/* Wizard Header Banner */}
      <div className="bg-slate-900 text-white rounded-t-xl p-6 border-b border-slate-800">
        <div className="flex items-center space-x-3 rtl:space-x-reverse mb-2">
          <div className="w-8 h-8 rounded bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-xs shadow-2xs">
            GH
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">{t('wizard.title')}</h1>
            <p className="text-xs text-slate-300">{t('wizard.subtitle')}</p>
          </div>
        </div>

        {/* Wizard Stepper Bar */}
        <div className="mt-6 grid grid-cols-5 gap-1.5 text-xs">
          {steps.map((s) => {
            const Icon = s.icon;
            const isCompleted = currentStep > s.num;
            const isCurrent = currentStep === s.num;
            return (
              <div
                key={s.num}
                className={`flex flex-col items-center p-2 rounded text-center transition-colors ${
                  isCurrent
                    ? 'bg-slate-800 text-amber-400 font-semibold'
                    : isCompleted
                    ? 'text-emerald-400'
                    : 'text-slate-500'
                }`}
              >
                <div className="flex items-center justify-center w-6 h-6 rounded-full mb-1 bg-slate-800 text-xs">
                  {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Icon className="w-3.5 h-3.5" />}
                </div>
                <span className="hidden md:inline text-[11px] truncate max-w-[120px]">{s.title}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Wizard Card Body */}
      <div className="bg-white rounded-b-xl border border-slate-200 border-t-0 p-8 shadow-2xs">
        {errorMessage && (
          <div className="mb-6 p-3 rounded bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center space-x-2 rtl:space-x-reverse">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
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
              <FormField label={t('field.company_code')} hint={t('field.company_code_hint')} required>
                <Input
                  type="text"
                  value={formData.code}
                  onChange={(e) => updateField('code', e.target.value.toUpperCase())}
                  placeholder="CORP-01"
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
                  dir="rtl"
                  className="font-arabic text-right"
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
                  dir="rtl"
                  className="font-arabic text-right"
                />
              </FormField>

              <FormField label={t('field.cr_number')}>
                <Input
                  type="text"
                  value={formData.crNumber}
                  onChange={(e) => updateField('crNumber', e.target.value)}
                  placeholder="e.g. 1010345678"
                  className="font-mono"
                />
              </FormField>

              <FormField label={t('field.tax_number')}>
                <Input
                  type="text"
                  value={formData.taxNumber}
                  onChange={(e) => updateField('taxNumber', e.target.value)}
                  placeholder="e.g. 300123456700003"
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
              <FormField label={t('field.branch_code')} hint={t('field.branch_code_hint')} required>
                <Input
                  type="text"
                  value={formData.branchCode}
                  onChange={(e) => updateField('branchCode', e.target.value.toUpperCase())}
                  placeholder="HQ"
                  className="font-mono uppercase"
                  required
                />
              </FormField>

              <FormField label={t('field.is_main_branch')}>
                <div className="py-2 px-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700">
                  {language === 'ar' ? 'المقر التشغيلي الرئيسي (تلقائي)' : 'Primary Headquarters (Designated)'}
                </div>
              </FormField>

              <FormField label={t('field.branch_name_en')} required>
                <Input
                  type="text"
                  value={formData.branchNameEn}
                  onChange={(e) => updateField('branchNameEn', e.target.value)}
                  placeholder="Head Office"
                  required
                />
              </FormField>

              <FormField label={t('field.branch_name_ar')} required>
                <Input
                  type="text"
                  value={formData.branchNameAr}
                  onChange={(e) => updateField('branchNameAr', e.target.value)}
                  placeholder="المقر الرئيسي"
                  dir="rtl"
                  className="font-arabic text-right"
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
                  dir="rtl"
                  className="font-arabic text-right"
                />
              </FormField>

              <div className="md:col-span-2">
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
              <FormField label={`${t('field.base_currency')} (ISO 4217)`} required>
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
                  <option value={1}>January (Standard GCC Corporate Calendar)</option>
                  <option value={4}>April</option>
                  <option value={7}>July</option>
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

        {/* STEP 4: Administrator Profile */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-1">{t('wizard.step4.title')}</h2>
              <p className="text-xs text-slate-500">{t('wizard.step4.desc')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label={t('field.admin_name')} required>
                <Input
                  type="text"
                  value={formData.adminDisplayName}
                  onChange={(e) => updateField('adminDisplayName', e.target.value)}
                  placeholder="Abdullah Al-Salem"
                  required
                />
              </FormField>

              <FormField label={t('field.admin_email')} required>
                <Input
                  type="email"
                  value={formData.adminEmail}
                  onChange={(e) => updateField('adminEmail', e.target.value)}
                  placeholder="admin@enterprise.com"
                  required
                />
              </FormField>

              <FormField label={t('field.admin_role')}>
                <div className="py-2 px-3 bg-slate-50 border border-slate-200 rounded text-xs font-mono text-slate-700">
                  COMPANY_ADMIN
                </div>
              </FormField>

              <FormField label={t('field.admin_uid')}>
                <Input
                  type="text"
                  value={formData.adminUid}
                  readOnly
                  className="font-mono bg-slate-50 text-slate-500"
                />
              </FormField>
            </div>
          </div>
        )}

        {/* STEP 5: Review & Establishment */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-1">{t('wizard.step5.title')}</h2>
              <p className="text-xs text-slate-500">{t('wizard.step5.desc')}</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pb-4 border-b border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[11px] mb-0.5">{t('field.company_code')}</span>
                  <span className="font-mono font-bold text-slate-900">{formData.code}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px] mb-0.5">{t('field.country')}</span>
                  <span className="font-semibold text-slate-800">
                    {VALID_GCC_COUNTRIES[formData.countryCode]?.nameEn} ({formData.countryCode})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px] mb-0.5">{t('field.base_currency')}</span>
                  <span className="font-mono font-bold text-slate-900">{formData.baseCurrency}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[11px] mb-0.5">{t('field.legal_name_en')}</span>
                  <span className="font-medium text-slate-900">{formData.legalNameEn}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px] mb-0.5">{t('field.legal_name_ar')}</span>
                  <span className="font-arabic font-medium text-slate-900">{formData.legalNameAr}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pb-4 border-b border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[11px] mb-0.5">{t('field.cr_number')}</span>
                  <span className="font-mono text-slate-800">{formData.crNumber || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px] mb-0.5">{t('field.tax_number')}</span>
                  <span className="font-mono text-slate-800">{formData.taxNumber || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px] mb-0.5">{t('field.branch_code')}</span>
                  <span className="font-mono font-semibold text-slate-800">{formData.branchCode} ({formData.branchNameEn})</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px] mb-0.5">{t('field.admin_name')}</span>
                <span className="font-medium text-slate-900">{formData.adminDisplayName} ({formData.adminEmail})</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Submitting establishes the legal entity, assigns the primary headquarters branch, and creates an immutable initial audit entry.
            </p>
          </div>
        )}

        {/* Wizard Action Controls */}
        <div className="mt-8 pt-5 border-t border-slate-200 flex items-center justify-between">
          <div>
            {currentStep > 1 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handlePrevious}
                disabled={isSubmitting}
                leftIcon={<PrevIcon className="w-3.5 h-3.5" />}
              >
                {t('action.previous')}
              </Button>
            )}
          </div>

          <div>
            {currentStep < 5 ? (
              <Button
                variant="primary"
                size="sm"
                onClick={handleNext}
                rightIcon={<NextIcon className="w-3.5 h-3.5" />}
              >
                {t('action.next')}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmit}
                isLoading={isSubmitting}
                leftIcon={<ShieldCheck className="w-4 h-4" />}
              >
                {t('action.complete_setup')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
