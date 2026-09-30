import React, { useState } from 'react';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import { Button, Input, Select, Dialog, useToast, LoadingState } from '../../../design-system/index.ts';
import {
  Building,
  ShieldCheck,
  Plus,
  Search,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileText,
  Lock,
  Calendar,
  Building2,
  Trash2,
  Edit2,
  ExternalLink
} from 'lucide-react';

interface BillingProfilesTabProps {
  company: any;
  billingProfiles: any[];
  suppliers: any[];
  clients: any[];
  onRefresh: () => void;
}

export function BillingProfilesTab({
  company,
  billingProfiles,
  suppliers,
  clients,
  onRefresh,
}: BillingProfilesTabProps) {
  const { language } = useI18n();
  const { addToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // ALL, OPERATING, PRINCIPAL
  const [selectedProfileForAuth, setSelectedProfileForAuth] = useState<any | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Profile Form State
  const [newProfile, setNewProfile] = useState({
    profileCode: '',
    profileName: '',
    isOperatingCompany: false,
    principalSupplierId: '',
    principalClientId: '',
    legalNameEn: '',
    legalNameAr: '',
    tradeNameEn: '',
    tradeNameAr: '',
    crNumber: '',
    licenseNumber: '',
    vatNumber: '',
    phone: '',
    email: '',
    addressEn: '',
    addressAr: '',
    bankName: '',
    iban: '',
    swiftCode: '',
    signatoryName: '',
    signatoryTitle: '',
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: '',
    status: 'ACTIVE',
  });

  // New Authorization Form State
  const [newAuth, setNewAuth] = useState({
    authorizationReference: '',
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    documentReference: '',
    notes: '',
  });

  const filteredProfiles = billingProfiles.filter((p) => {
    const matchesSearch =
      p.profileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.profileCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.legalNameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.crNumber && p.crNumber.includes(searchQuery)) ||
      (p.vatNumber && p.vatNumber.includes(searchQuery));

    const matchesType =
      filterType === 'ALL' ||
      (filterType === 'OPERATING' && p.isOperatingCompany) ||
      (filterType === 'PRINCIPAL' && !p.isOperatingCompany);

    return matchesSearch && matchesType;
  });

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/projects/billing-profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newProfile,
          principalSupplierId: newProfile.principalSupplierId ? Number(newProfile.principalSupplierId) : null,
          principalClientId: newProfile.principalClientId ? Number(newProfile.principalClientId) : null,
        }),
      });

      if (res.ok) {
        addToast({
          type: 'success',
          title: language === 'ar' ? 'تم إنشاء هوية الفوترة' : 'Billing Profile Created',
          message: language === 'ar' ? 'تم حفظ هوية الفوترة بنجاح' : 'Billing profile registered successfully.',
        });
        setShowCreateModal(false);
        onRefresh();
      } else {
        const err = await res.json();
        addToast({ type: 'error', title: 'Error', message: err.message || 'Failed to create profile' });
      }
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Network error occurred' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddAuthorization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfileForAuth) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(
        `/api/companies/${company.id}/projects/billing-profiles/${selectedProfileForAuth.id}/authorizations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newAuth),
        }
      );

      if (res.ok) {
        addToast({
          type: 'success',
          title: language === 'ar' ? 'تم تسجيل التفويض' : 'Authorization Granted',
          message: language === 'ar' ? 'تم اعتماد تفويض استخدام هوية المقاول الرئيسي بنجاح' : 'Principal billing authorization registered and approved.',
        });
        setShowAuthModal(false);
        setSelectedProfileForAuth(null);
        onRefresh();
      } else {
        const err = await res.json();
        addToast({ type: 'error', title: 'Error', message: err.message || 'Failed to grant authorization' });
      }
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Network error occurred' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="bg-slate-900 text-white rounded-lg p-5 shadow-xs border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              <h2 className="text-sm font-bold tracking-wide">
                {language === 'ar' ? 'هويات الفوترة والامتثال التجاري للمقاول الرئيسي' : 'Billing Profiles & Principal Identity Governance'}
              </h2>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              {language === 'ar'
                ? 'حوكمة إصدار الوثائق التجارية بهوية الشركة التشغيلية أو هوية المقاول الرئيسي المفوض رسمياً بموجب تفويض ساري المفعول.'
                : 'Commercial document issuance governance. Strict snapshotting of legal identities (CR, VAT, Signatories) with non-impersonation security controls.'}
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 self-start sm:self-auto bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold"
          >
            <Plus className="w-4 h-4" />
            {language === 'ar' ? 'إضافة هوية فوترة جديدة' : 'New Billing Profile'}
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={language === 'ar' ? 'بحث بالاسم، الكود، السجل التجاري، الرقم الضريبي...' : 'Search profile name, code, CR, VAT...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
            {language === 'ar' ? 'النوع:' : 'Type:'}
          </span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400"
          >
            <option value="ALL">{language === 'ar' ? 'جميع الهويات' : 'All Profiles'}</option>
            <option value="OPERATING">{language === 'ar' ? 'الشركة التشغيلية' : 'Operating Company'}</option>
            <option value="PRINCIPAL">{language === 'ar' ? 'المقاول الرئيسي الخارجي' : 'External Principal Company'}</option>
          </select>
        </div>
      </div>

      {/* Profiles Cards Grid */}
      {filteredProfiles.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center space-y-3">
          <Building className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-800">
            {language === 'ar' ? 'لا توجد هويات فوترة مطابقة' : 'No Billing Profiles Found'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {language === 'ar'
              ? 'قم بإنشاء هوية فوترة للشركة المشغلة أو للمقاول الرئيسي لإصدار الفواتير وعروض الأسعار.'
              : 'Register an authorized billing identity for direct company projects or subcontracted principal billing.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProfiles.map((profile) => {
            const hasValidAuth =
              profile.isOperatingCompany ||
              (profile.authorizations && profile.authorizations.some((a: any) => a.status === 'APPROVED'));

            return (
              <div
                key={profile.id}
                className="bg-white rounded-lg border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                        {profile.profileCode}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 mt-1">{profile.profileName}</h3>
                      <p className="text-xs text-slate-500">{language === 'ar' ? profile.legalNameAr : profile.legalNameEn}</p>
                    </div>
                    {profile.isOperatingCompany ? (
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        {language === 'ar' ? 'الشركة التشغيلية' : 'Operating Co.'}
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-amber-50 text-amber-800 border border-amber-200">
                        {language === 'ar' ? 'مقاول رئيسي' : 'Principal Co.'}
                      </span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">{language === 'ar' ? 'السجل التجاري:' : 'CR Number:'}</span>
                      <span className="font-mono text-slate-800">{profile.crNumber || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">{language === 'ar' ? 'الرقم الضريبي:' : 'VAT/Tax ID:'}</span>
                      <span className="font-mono text-slate-800">{profile.vatNumber || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">{language === 'ar' ? 'المفوض بالتوقيع:' : 'Signatory:'}</span>
                      <span className="text-slate-800 truncate max-w-[150px]">{profile.signatoryName || '—'}</span>
                    </div>
                  </div>

                  {/* Authorization Status Badge for Principal Profiles */}
                  {!profile.isOperatingCompany && (
                    <div className="pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">{language === 'ar' ? 'حالة التفويض:' : 'Authorization:'}</span>
                        {hasValidAuth ? (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                            {language === 'ar' ? 'تفويض معتمد' : 'Approved'}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] text-amber-700 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            {language === 'ar' ? 'يتطلب تفويض' : 'Auth Required'}
                          </span>
                        )}
                      </div>
                      {profile.authorizations && profile.authorizations.length > 0 && (
                        <div className="mt-1.5 p-1.5 bg-slate-50 rounded text-[11px] font-mono text-slate-600 flex justify-between">
                          <span>Ref: {profile.authorizations[0].authorizationReference}</span>
                          <span>Valid: {profile.authorizations[0].effectiveTo}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    From: {profile.effectiveFrom}
                  </span>
                  {!profile.isOperatingCompany && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSelectedProfileForAuth(profile);
                        setShowAuthModal(true);
                      }}
                      className="text-xs flex items-center gap-1 py-1"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                      {language === 'ar' ? 'إدارة التفويض' : 'Authorize'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Profile Modal */}
      {showCreateModal && (
        <Dialog
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title={language === 'ar' ? 'تسجيل هوية فوترة جديدة' : 'Register New Billing Profile'}
          size="lg"
        >
          <form onSubmit={handleCreateProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">
                  {language === 'ar' ? 'كود هوية الفوترة *' : 'Profile Code *'}
                </label>
                <Input
                  required
                  placeholder="e.g. BP-GULF-01"
                  value={newProfile.profileCode}
                  onChange={(e) => setNewProfile({ ...newProfile, profileCode: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">
                  {language === 'ar' ? 'اسم التعريف *' : 'Profile Name *'}
                </label>
                <Input
                  required
                  placeholder="e.g. Gulf General Trading Subcontract Identity"
                  value={newProfile.profileName}
                  onChange={(e) => setNewProfile({ ...newProfile, profileName: e.target.value })}
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newProfile.isOperatingCompany}
                  onChange={(e) => setNewProfile({ ...newProfile, isOperatingCompany: e.target.checked })}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                />
                <span className="text-xs font-semibold text-slate-900">
                  {language === 'ar' ? 'هذه الهوية تتبع الشركة التشغيلية مباشرة' : 'This is our direct Operating Company identity'}
                </span>
              </label>
              <p className="text-[11px] text-slate-500 mt-1 pl-6">
                {language === 'ar'
                  ? 'في حال كانت تخص مقاولاً رئيسياً خارجياً (Principal)، اترك الخيار غير محدد واربطها بالمورد/الشريك.'
                  : 'Uncheck if this identity belongs to an external Principal/Contractor for subcontracted client billing.'}
              </p>
            </div>

            {!newProfile.isOperatingCompany && (
              <div>
                <label className="text-xs font-semibold text-slate-700">
                  {language === 'ar' ? 'المقاول الرئيسي المرتبط (شريك/مورد)' : 'Associated Principal Supplier / Partner'}
                </label>
                <Select
                  value={newProfile.principalSupplierId}
                  onChange={(e) => setNewProfile({ ...newProfile, principalSupplierId: e.target.value })}
                >
                  <option value="">{language === 'ar' ? '— اختر المقاول الرئيسي من سجل الشركاء —' : '— Select Principal Party —'}</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.code} - {s.nameEn} / {s.nameAr}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">
                  {language === 'ar' ? 'الاسم القانوني (إنجليزي) *' : 'Legal Name (EN) *'}
                </label>
                <Input
                  required
                  placeholder="Official Company Legal Name"
                  value={newProfile.legalNameEn}
                  onChange={(e) => setNewProfile({ ...newProfile, legalNameEn: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">
                  {language === 'ar' ? 'الاسم القانوني (عربي) *' : 'Legal Name (AR) *'}
                </label>
                <Input
                  required
                  dir="rtl"
                  placeholder="الاسم القانوني الرسمي للشركة"
                  value={newProfile.legalNameAr}
                  onChange={(e) => setNewProfile({ ...newProfile, legalNameAr: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">
                  {language === 'ar' ? 'رقم السجل التجاري (CR)' : 'CR Number'}
                </label>
                <Input
                  placeholder="CR-123456"
                  value={newProfile.crNumber}
                  onChange={(e) => setNewProfile({ ...newProfile, crNumber: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">
                  {language === 'ar' ? 'الرقم الضريبي (VAT)' : 'Tax/VAT Number'}
                </label>
                <Input
                  placeholder="VAT-987654321"
                  value={newProfile.vatNumber}
                  onChange={(e) => setNewProfile({ ...newProfile, vatNumber: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">
                  {language === 'ar' ? 'رقم الترخيص' : 'License Number'}
                </label>
                <Input
                  placeholder="LIC-4455"
                  value={newProfile.licenseNumber}
                  onChange={(e) => setNewProfile({ ...newProfile, licenseNumber: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">
                  {language === 'ar' ? 'اسم المفوض بالتوقيع' : 'Authorized Signatory'}
                </label>
                <Input
                  placeholder="Managing Director / CEO Name"
                  value={newProfile.signatoryName}
                  onChange={(e) => setNewProfile({ ...newProfile, signatoryName: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">
                  {language === 'ar' ? 'الصفة / المسمى الوظيفي' : 'Signatory Title'}
                </label>
                <Input
                  placeholder="Executive Director"
                  value={newProfile.signatoryTitle}
                  onChange={(e) => setNewProfile({ ...newProfile, signatoryTitle: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'اسم البنك' : 'Bank Name'}</label>
                <Input
                  placeholder="National Bank of Kuwait"
                  value={newProfile.bankName}
                  onChange={(e) => setNewProfile({ ...newProfile, bankName: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'رقم الآيبان IBAN' : 'IBAN'}</label>
                <Input
                  placeholder="KW00NBOK0000000000"
                  value={newProfile.iban}
                  onChange={(e) => setNewProfile({ ...newProfile, iban: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'ساري من تاريخ *' : 'Effective From *'}</label>
                <Input
                  type="date"
                  required
                  value={newProfile.effectiveFrom}
                  onChange={(e) => setNewProfile({ ...newProfile, effectiveFrom: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button variant="secondary" type="button" onClick={() => setShowCreateModal(false)}>
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button variant="primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : language === 'ar' ? 'حفظ هوية الفوترة' : 'Save Billing Profile'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Grant Authorization Modal */}
      {showAuthModal && selectedProfileForAuth && (
        <Dialog
          isOpen={showAuthModal}
          onClose={() => {
            setShowAuthModal(false);
            setSelectedProfileForAuth(null);
          }}
          title={`${language === 'ar' ? 'تفويض استخدام هوية المقاول:' : 'Authorize Principal Billing Identity:'} ${selectedProfileForAuth.profileName}`}
          size="md"
        >
          <form onSubmit={handleAddAuthorization} className="space-y-4">
            <div className="p-3 bg-amber-50 rounded-md border border-amber-200 text-xs text-amber-900 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-700" />
                {language === 'ar' ? 'ضمانات الأمان وعدم الانتحال' : 'Anti-Impersonation Governance'}
              </div>
              <p className="text-[11px] leading-relaxed">
                {language === 'ar'
                  ? 'يتطلب النظام إرفاق مرجع وثيقة التفويض الرسمية مع تواريخ سريان محددة قبل السماح بإصدار الفواتير وعروض الأسعار بهذه الهوية.'
                  : 'Official authorization reference and valid effective date range are required to issue project invoices under this identity.'}
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">
                {language === 'ar' ? 'رقم مرجع التفويض الرسمي *' : 'Authorization Reference / Agreement No. *'}
              </label>
              <Input
                required
                placeholder="e.g. AUTH-LTR-2026-0044"
                value={newAuth.authorizationReference}
                onChange={(e) => setNewAuth({ ...newAuth, authorizationReference: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">
                  {language === 'ar' ? 'ساري من *' : 'Effective From *'}
                </label>
                <Input
                  type="date"
                  required
                  value={newAuth.effectiveFrom}
                  onChange={(e) => setNewAuth({ ...newAuth, effectiveFrom: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">
                  {language === 'ar' ? 'ساري إلى *' : 'Effective To *'}
                </label>
                <Input
                  type="date"
                  required
                  value={newAuth.effectiveTo}
                  onChange={(e) => setNewAuth({ ...newAuth, effectiveTo: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">
                {language === 'ar' ? 'رابط/مرجع الوثيقة المرفقة' : 'Attached Document Reference'}
              </label>
              <Input
                placeholder="DOC-ARCHIVE-REF-9921"
                value={newAuth.documentReference}
                onChange={(e) => setNewAuth({ ...newAuth, documentReference: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'ملاحظات الاعتماد' : 'Approval Notes'}</label>
              <Input
                placeholder="Authorized by General Manager under Main Subcontract Agreement"
                value={newAuth.notes}
                onChange={(e) => setNewAuth({ ...newAuth, notes: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  setShowAuthModal(false);
                  setSelectedProfileForAuth(null);
                }}
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button variant="primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? (language === 'ar' ? 'جاري الاعتماد...' : 'Authorizing...') : language === 'ar' ? 'اعتماد التفويض' : 'Approve & Authorize'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
