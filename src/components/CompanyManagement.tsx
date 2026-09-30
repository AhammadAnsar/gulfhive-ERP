/**
 * GulfHive ERP - Company & Organization Management
 * Complete management of legal entities, multi-branch cost centers, roles, users, and audit trails.
 * Adheres strictly to GulfHive Design System: clean typography, zero pills, unboxed metadata, and Table components.
 */

import React, { useState, useEffect } from 'react';
import { useI18n } from '../shared/i18n/I18nContext.tsx';
import {
  Building2,
  GitBranch,
  Users,
  Shield,
  History,
  Plus,
  MapPin,
  Phone,
  Mail,
  Globe,
} from 'lucide-react';
import {
  Button,
  Input,
  FormField,
  Table,
  Column,
  Dialog,
  useToast,
  LoadingState,
  ErrorState,
} from '../design-system/index.ts';

interface CompanyManagementProps {
  company: any;
  activeBranchId: string;
  onSelectBranch: (branchId: string) => void;
  onCompanyUpdated: () => void;
}

export function CompanyManagement({ company, activeBranchId, onSelectBranch, onCompanyUpdated }: CompanyManagementProps) {
  const { t, language } = useI18n();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<'overview' | 'branches' | 'users' | 'roles' | 'audit'>('overview');
  const [branchesList, setBranchesList] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [rolesList, setRolesList] = useState<any[]>([]);
  const [auditLogsList, setAuditLogsList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Add Branch Modal State
  const [showAddBranch, setShowAddBranch] = useState<boolean>(false);
  const [branchForm, setBranchForm] = useState({
    code: '',
    nameEn: '',
    nameAr: '',
    cityEn: '',
    cityAr: '',
    addressEn: '',
    addressAr: '',
    phone: '',
    isMain: false,
  });
  const [branchError, setBranchError] = useState<string | null>(null);
  const [isSubmittingBranch, setIsSubmittingBranch] = useState<boolean>(false);

  const loadData = async () => {
    if (!company?.id) return;
    setIsLoading(true);
    setLoadError(null);

    try {
      const [branchesRes, usersRes, rolesRes, auditRes] = await Promise.all([
        fetch(`/api/companies/${company.id}/branches`),
        fetch(`/api/companies/${company.id}/users`),
        fetch(`/api/roles`),
        fetch(`/api/companies/${company.id}/audit-logs`),
      ]);

      if (branchesRes.ok) {
        const b = await branchesRes.json();
        setBranchesList(b.branches || []);
      }
      if (usersRes.ok) {
        const u = await usersRes.json();
        setUsersList(u.users || []);
      }
      if (rolesRes.ok) {
        const r = await rolesRes.json();
        setRolesList(r.roles || []);
      }
      if (auditRes.ok) {
        const a = await auditRes.json();
        setAuditLogsList(a.logs || []);
      }
    } catch (err: any) {
      setLoadError(err.message || 'Failed to fetch company details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [company?.id]);

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchForm.code.trim() || !branchForm.nameEn.trim() || !branchForm.nameAr.trim()) {
      setBranchError(language === 'ar' ? 'يرجى تعبئة الحقول المطلوبة' : 'Please complete all required fields.');
      return;
    }

    setIsSubmittingBranch(true);
    setBranchError(null);

    try {
      const res = await fetch(`/api/companies/${company.id}/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...branchForm,
          actorId: 'admin',
          actorEmail: 'admin@gulfhive.internal',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create branch');
      }

      setShowAddBranch(false);
      setBranchForm({
        code: '',
        nameEn: '',
        nameAr: '',
        cityEn: '',
        cityAr: '',
        addressEn: '',
        addressAr: '',
        phone: '',
        isMain: false,
      });

      addToast({
        type: 'success',
        title: language === 'ar' ? 'تم تأسيس الفرع' : 'Branch Established',
        message: language === 'ar' ? 'تم تسجيل الفرع الجديد وتوثيقه بسجل التدقيق.' : `Branch '${data.branch.code}' successfully created and audited.`,
      });

      loadData();
      onCompanyUpdated();
    } catch (err: any) {
      setBranchError(err.message || 'Error creating branch');
    } finally {
      setIsSubmittingBranch(false);
    }
  };

  const tabs = [
    { id: 'overview', label: t('tab.overview'), icon: Building2 },
    { id: 'branches', label: t('tab.branches'), icon: GitBranch },
    { id: 'users', label: t('tab.users'), icon: Users },
    { id: 'roles', label: t('tab.roles'), icon: Shield },
    { id: 'audit', label: t('tab.audit'), icon: History },
  ];

  // Table Columns Definitions
  const branchColumns: Column<any>[] = [
    {
      key: 'code',
      header: language === 'ar' ? 'رمز الفرع' : 'Code',
      sortable: true,
      width: '12%',
      render: (b) => <span className="font-mono font-semibold text-slate-900">{b.code}</span>,
    },
    {
      key: 'name',
      header: language === 'ar' ? 'الاسم' : 'Branch Name',
      sortable: true,
      width: '30%',
      render: (b) => (
        <div>
          <span className="font-medium text-slate-900 block">{language === 'ar' ? b.nameAr : b.nameEn}</span>
          <span className="text-[11px] text-slate-400 block">{language === 'ar' ? b.nameEn : b.nameAr}</span>
        </div>
      ),
    },
    {
      key: 'city',
      header: language === 'ar' ? 'المدينة' : 'City',
      sortable: true,
      render: (b) => <span>{b.cityEn || '—'}</span>,
    },
    {
      key: 'type',
      header: language === 'ar' ? 'التصنيف' : 'Type',
      render: (b) => (
        <span className="text-slate-600">
          {b.isMain ? (
            <span className="text-amber-700 font-semibold">{t('branch.badge_main')}</span>
          ) : (
            'Branch Office'
          )}
        </span>
      ),
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (b) => {
        const isCurrent = activeBranchId === b.id;
        return (
          <Button
            size="sm"
            variant={isCurrent ? 'primary' : 'secondary'}
            onClick={() => {
              onSelectBranch(b.id);
              addToast({
                type: 'info',
                title: language === 'ar' ? 'تم تبديل نطاق الفرع' : 'Active Branch Switched',
                message: `${b.code} - ${language === 'ar' ? b.nameAr : b.nameEn}`,
              });
            }}
          >
            {isCurrent ? (language === 'ar' ? 'النطاق النشط' : 'Active Scope') : (language === 'ar' ? 'تحديد' : 'Select')}
          </Button>
        );
      },
    },
  ];

  const userColumns: Column<any>[] = [
    {
      key: 'displayName',
      header: language === 'ar' ? 'المستخدم' : 'Personnel Name',
      sortable: true,
      render: (u) => (
        <div>
          <span className="font-semibold text-slate-900 block">{u.displayName || u.email}</span>
          <span className="text-[11px] text-slate-400 font-mono">{u.email}</span>
        </div>
      ),
    },
    {
      key: 'role',
      header: language === 'ar' ? 'الدور الأمني' : 'Assigned Role',
      sortable: true,
      render: (u) => (
        <span className="font-mono text-slate-800 font-medium">
          {language === 'ar' ? u.roleNameAr || u.role : u.roleNameEn || u.role}
        </span>
      ),
    },
    {
      key: 'branch',
      header: language === 'ar' ? 'الفرع المخصص' : 'Default Branch',
      render: (u) => (
        <span className="text-slate-700">
          {language === 'ar' ? u.branchNameAr || 'المقر العام' : u.branchNameEn || 'Head Office'}
        </span>
      ),
    },
    {
      key: 'uid',
      header: language === 'ar' ? 'معرف النظام' : 'UID Link',
      render: (u) => <span className="font-mono text-[11px] text-slate-400">{u.uid.slice(0, 16)}...</span>,
    },
  ];

  const auditColumns: Column<any>[] = [
    {
      key: 'timestamp',
      header: language === 'ar' ? 'الوقت والتاريخ' : 'Timestamp',
      sortable: true,
      width: '20%',
      render: (a) => (
        <span className="font-mono text-[11px] text-slate-500">
          {new Date(a.timestamp).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'action',
      header: language === 'ar' ? 'الإجراء' : 'Action',
      sortable: true,
      render: (a) => <span className="font-mono font-semibold text-slate-800">{a.action}</span>,
    },
    {
      key: 'entity',
      header: language === 'ar' ? 'الكيان' : 'Entity',
      render: (a) => (
        <span className="text-slate-700">
          {a.entityType} ({a.entityId?.slice(0, 14)})
        </span>
      ),
    },
    {
      key: 'actor',
      header: language === 'ar' ? 'المنفذ' : 'Actor',
      render: (a) => <span className="text-slate-600 font-mono text-[11px]">{a.actorEmail || a.actorId}</span>,
    },
    {
      key: 'diff',
      header: language === 'ar' ? 'بيانات الحالة' : 'Resulting Diff',
      render: (a) => (
        <span className="font-mono text-[11px] text-slate-400 max-w-xs truncate block">
          {a.resultingState ? JSON.stringify(a.resultingState) : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Company Header Identity Banner */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4 rtl:space-x-reverse">
            <div className="w-12 h-12 rounded bg-slate-900 text-amber-400 font-bold flex items-center justify-center text-lg shadow-2xs">
              {company.code?.slice(0, 3) || 'COR'}
            </div>
            <div>
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <h1 className="text-xl font-bold text-slate-900">
                  {language === 'ar' ? company.legalNameAr : company.legalNameEn}
                </h1>
                <span className="text-xs font-mono font-bold text-slate-600">
                  ({company.code})
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'ar' ? company.tradeNameAr || company.legalNameAr : company.tradeNameEn || company.legalNameEn}
                <span aria-hidden="true" className="mx-1.5">·</span>
                {company.countryCode}
                <span aria-hidden="true" className="mx-1.5">·</span>
                {company.baseCurrency}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 rtl:space-x-reverse text-xs text-slate-600 font-mono">
            <span>CR: <strong className="text-slate-800">{company.crNumber || 'N/A'}</strong></span>
            <span aria-hidden="true">·</span>
            <span>TIN: <strong className="text-slate-800">{company.taxNumber || 'N/A'}</strong></span>
          </div>
        </div>

        {/* Tab Navigation Controls (Interactive Filter Segment) */}
        <div className="mt-6 border-t border-slate-100 pt-4 flex flex-wrap gap-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-1.5 rounded text-xs font-medium flex items-center space-x-1.5 rtl:space-x-reverse transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {loadError && (
        <ErrorState message={loadError} onRetry={loadData} />
      )}

      {/* TAB 1: Company Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-2xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100">
              {language === 'ar' ? 'البيانات النظامية والتسجيل التجاري' : 'Statutory & Commercial Registration'}
            </h2>
            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <span className="text-slate-400 block mb-0.5">Commercial Reg (CR):</span>
                <span className="text-slate-900 font-bold">{company.crNumber || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Tax / VAT ID (TIN):</span>
                <span className="text-slate-900 font-bold">{company.taxNumber || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">GCC Jurisdiction:</span>
                <span className="text-slate-900 font-semibold">{company.countryCode}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Base Currency:</span>
                <span className="text-slate-900 font-semibold">{company.baseCurrency}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Fiscal Year Starts:</span>
                <span className="text-slate-900 font-semibold">Month {company.fiscalYearStartMonth} (January)</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Timezone:</span>
                <span className="text-slate-900 font-semibold">{company.timezone}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-2xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100">
              {language === 'ar' ? 'العناوين ووسائل الاتصال الرسمية' : 'Official Contact & Addresses'}
            </h2>
            <div className="space-y-3 text-xs">
              <div className="flex items-start space-x-2 rtl:space-x-reverse">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-800 block">English Address:</span>
                  <span className="text-slate-600">{company.addressEn || 'Not provided'}</span>
                </div>
              </div>
              <div className="flex items-start space-x-2 rtl:space-x-reverse">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-800 block">Arabic Address:</span>
                  <span className="font-arabic text-slate-600">{company.addressAr || 'غير مدخل'}</span>
                </div>
              </div>
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="font-mono text-slate-700">{company.phone || '—'}</span>
              </div>
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-slate-700">{company.email || '—'}</span>
              </div>
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-slate-700">{company.website || '—'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Branches & Sites (Using Table Component) */}
      {activeTab === 'branches' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">{t('branch.list_title')}</h2>
              <p className="text-xs text-slate-500">{t('branch.list_subtitle')}</p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowAddBranch(true)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              {t('action.add_branch')}
            </Button>
          </div>

          <Table
            columns={branchColumns}
            data={branchesList}
            keyExtractor={(b) => b.id}
            isLoading={isLoading}
            searchable={true}
            searchPlaceholder={language === 'ar' ? 'بحث في الفروع والمواقع...' : 'Search branch code, name, city...'}
            pageSize={8}
          />
        </div>
      )}

      {/* TAB 3: Users & Access (Using Table Component) */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">{t('users.title')}</h2>
            <p className="text-xs text-slate-500">{t('users.subtitle')}</p>
          </div>

          <Table
            columns={userColumns}
            data={usersList}
            keyExtractor={(u) => u.id}
            isLoading={isLoading}
            searchable={true}
            searchPlaceholder={language === 'ar' ? 'بحث في المستخدمين...' : 'Search personnel email or name...'}
            pageSize={8}
          />
        </div>
      )}

      {/* TAB 4: Roles & Permissions Matrix */}
      {activeTab === 'roles' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-2xs p-6 space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">{t('roles.title')}</h2>
            <p className="text-xs text-slate-500">{t('roles.subtitle')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {rolesList.map((role) => (
              <div key={role.id} className="p-5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 rtl:space-x-reverse">
                    <Shield className="w-4 h-4 text-slate-700" />
                    <h3 className="text-sm font-bold text-slate-900">
                      {language === 'ar' ? role.nameAr : role.nameEn}
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 font-bold">
                    {role.code}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {language === 'ar' ? role.descriptionAr : role.descriptionEn}
                </p>

                <div className="pt-3 border-t border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500 block mb-2">
                    Granted Permissions ({role.permissions?.length || 0}):
                  </span>
                  <div className="flex flex-wrap gap-1 text-[11px] text-slate-700 font-mono">
                    {role.permissions?.map((p: any, idx: number) => (
                      <span key={p.id}>
                        {p.code}
                        {idx < (role.permissions?.length || 0) - 1 && <span aria-hidden="true" className="mx-1 text-slate-300">·</span>}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: Audit Trail (Using Table Component) */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">{t('foundation.audit.title')}</h2>
            <p className="text-xs text-slate-500">
              Immutable, non-destructive audit log capturing actor, action, timestamp, and state differentials.
            </p>
          </div>

          <Table
            columns={auditColumns}
            data={auditLogsList}
            keyExtractor={(a) => a.id}
            isLoading={isLoading}
            searchable={true}
            searchPlaceholder={language === 'ar' ? 'بحث في سجل التدقيق...' : 'Search audit actions, actors, entities...'}
            pageSize={10}
          />
        </div>
      )}

      {/* Add Branch Dialog Modal (Using Design System Dialog) */}
      <Dialog
        isOpen={showAddBranch}
        onClose={() => setShowAddBranch(false)}
        title={t('action.add_branch')}
        description={language === 'ar' ? 'تسجيل موقع أو مركز تكلفة تشغيلي جديد تحت المنشأة.' : 'Provision a new operational site or branch office.'}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowAddBranch(false)}>
              {t('action.cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateBranch}
              isLoading={isSubmittingBranch}
            >
              {t('action.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateBranch} className="space-y-3.5">
          {branchError && (
            <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {branchError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('field.branch_code')} required htmlFor="br_code">
              <Input
                id="br_code"
                type="text"
                value={branchForm.code}
                onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value.toUpperCase() })}
                placeholder="BR-02"
                required
              />
            </FormField>

            <FormField label={t('field.branch_phone')} htmlFor="br_phone">
              <Input
                id="br_phone"
                type="text"
                value={branchForm.phone}
                onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
                placeholder="+965 2200 0001"
              />
            </FormField>
          </div>

          <FormField label={t('field.branch_name_en')} required htmlFor="br_name_en">
            <Input
              id="br_name_en"
              type="text"
              value={branchForm.nameEn}
              onChange={(e) => setBranchForm({ ...branchForm, nameEn: e.target.value })}
              placeholder="Shuwaikh Industrial Site"
              required
            />
          </FormField>

          <FormField label={t('field.branch_name_ar')} required htmlFor="br_name_ar">
            <Input
              id="br_name_ar"
              type="text"
              value={branchForm.nameAr}
              onChange={(e) => setBranchForm({ ...branchForm, nameAr: e.target.value })}
              placeholder="موقع الشويخ الصناعية"
              dir="rtl"
              required
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('field.city_en')} htmlFor="br_city_en">
              <Input
                id="br_city_en"
                type="text"
                value={branchForm.cityEn}
                onChange={(e) => setBranchForm({ ...branchForm, cityEn: e.target.value })}
                placeholder="Shuwaikh"
              />
            </FormField>

            <FormField label={t('field.city_ar')} htmlFor="br_city_ar">
              <Input
                id="br_city_ar"
                type="text"
                value={branchForm.cityAr}
                onChange={(e) => setBranchForm({ ...branchForm, cityAr: e.target.value })}
                placeholder="الشويخ"
                dir="rtl"
              />
            </FormField>
          </div>

          <div className="pt-2 flex items-center space-x-2 rtl:space-x-reverse">
            <input
              type="checkbox"
              id="isMainCheck"
              checked={branchForm.isMain}
              onChange={(e) => setBranchForm({ ...branchForm, isMain: e.target.checked })}
              className="rounded border-slate-300 text-slate-900"
            />
            <label htmlFor="isMainCheck" className="text-slate-700 text-xs">
              {language === 'ar' ? 'تعيين كمقر رئيسي جديد للمنشأة' : 'Designate as new primary headquarters'}
            </label>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
