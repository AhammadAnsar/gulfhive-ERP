/**
 * GulfHive ERP - Settings Workspace & Security Administration
 * Production-grade administration for Users, Roles, Permission Matrix, Sessions, Security Audit,
 * Organization Structure, Master Data, Fiscal Years, Banking, Document Types, and Central Numbering Engine.
 */

import React, { useState, useEffect } from 'react';
import { useI18n } from '../../shared/i18n/I18nContext.tsx';
import {
  Building2,
  GitBranch,
  Layers,
  Briefcase,
  Users2,
  Calendar,
  DollarSign,
  Landmark,
  CreditCard,
  FileCode,
  Globe,
  Plus,
  Search,
  Edit2,
  Trash2,
  Archive,
  Eye,
  Hash,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Key,
  Lock,
  LogOut,
  UserCheck,
  UserX,
  History,
  Monitor,
  Camera,
  UploadCloud,
  Save,
} from 'lucide-react';
import {
  Button,
  Input,
  Select,
  Table,
  Dialog,
  FormField,
  useToast,
  LoadingState,
} from '../../design-system/index.ts';

export interface SettingsModuleProps {
  company: any;
  branches: any[];
  activeBranchId: string;
  onCompanyUpdated?: () => void;
}

type MainCategory = 'access' | 'company' | 'organization' | 'finance' | 'documents' | 'localization';

export function SettingsModule({ company, branches, activeBranchId, onCompanyUpdated }: SettingsModuleProps) {
  const { t, language } = useI18n();
  const { addToast } = useToast();

  const [mainTab, setMainCategory] = useState<MainCategory>('access');
  const [subTab, setSubTab] = useState<string>('users');

  // Master Data & Security Lists
  const [usersList, setUsersList] = useState<any[]>([]);
  const [rolesList, setRolesList] = useState<any[]>([]);
  const [permissionsList, setPermissionsList] = useState<any[]>([]);
  const [sessionsList, setSessionsList] = useState<any[]>([]);
  const [loginEventsList, setLoginEventsList] = useState<any[]>([]);

  const [branchesList, setBranchesList] = useState<any[]>(branches || []);
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);
  const [designationsList, setDesignationsList] = useState<any[]>([]);
  const [empCategoriesList, setEmpCategoriesList] = useState<any[]>([]);
  const [businessUnitsList, setBusinessUnitsList] = useState<any[]>([]);
  const [costCentersList, setCostCentersList] = useState<any[]>([]);
  const [fiscalYearsList, setFiscalYearsList] = useState<any[]>([]);
  const [currenciesList, setCurrenciesList] = useState<any[]>([]);
  const [countriesList, setCountriesList] = useState<any[]>([]);
  const [nationalitiesList, setNationalitiesList] = useState<any[]>([]);
  const [banksList, setBanksList] = useState<any[]>([]);
  const [paymentMethodsList, setPaymentMethodsList] = useState<any[]>([]);
  const [documentTypesList, setDocumentTypesList] = useState<any[]>([]);
  const [numberingList, setNumberingList] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Generic Dialog State
  const [showDialog, setShowDialog] = useState<boolean>(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form Field States
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Reset Password Dialog State
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState<boolean>(false);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<number | null>(null);
  const [newPasswordInput, setNewPasswordValue] = useState<string>('');

  // Numbering Engine Testing State
  const [numberingPreview, setNumberingPreview] = useState<string>('');
  const [generatedTestNumber, setGeneratedTestNumber] = useState<string>('');
  const [isGeneratingNumber, setIsGeneratingNumber] = useState<boolean>(false);

  // Sync default subTab when main category changes
  useEffect(() => {
    if (mainTab === 'access') setSubTab('users');
    else if (mainTab === 'company') setSubTab('profile');
    else if (mainTab === 'organization') setSubTab('departments');
    else if (mainTab === 'finance') setSubTab('currencies');
    else if (mainTab === 'documents') setSubTab('numbering');
    else if (mainTab === 'localization') setSubTab('countries');
  }, [mainTab]);

  const loadCurrentSubTabData = async () => {
    if (!company?.id) return;
    setIsLoading(true);
    try {
      if (subTab === 'users') {
        const [resUsers, resRoles] = await Promise.all([
          fetch(`/api/companies/${company.id}/users`),
          fetch(`/api/companies/${company.id}/roles`),
        ]);
        if (resUsers.ok) {
          const data = await resUsers.json();
          setUsersList(data.users || []);
        }
        if (resRoles.ok) {
          const data = await resRoles.json();
          setRolesList(data.roles || []);
        }
      } else if (subTab === 'roles') {
        const [resRoles, resPerms] = await Promise.all([
          fetch(`/api/companies/${company.id}/roles`),
          fetch('/api/permissions'),
        ]);
        if (resRoles.ok) {
          const data = await resRoles.json();
          setRolesList(data.roles || []);
        }
        if (resPerms.ok) {
          const data = await resPerms.json();
          setPermissionsList(data.permissions || []);
        }
      } else if (subTab === 'sessions') {
        const res = await fetch(`/api/companies/${company.id}/sessions`);
        if (res.ok) {
          const data = await res.json();
          setSessionsList(data.sessions || []);
        }
      } else if (subTab === 'login_events') {
        const res = await fetch(`/api/companies/${company.id}/login-events`);
        if (res.ok) {
          const data = await res.json();
          setLoginEventsList(data.events || []);
        }
      } else if (subTab === 'branches') {
        const res = await fetch(`/api/companies/${company.id}/branches`);
        if (res.ok) {
          const data = await res.json();
          setBranchesList(data.branches || []);
        }
      } else if (subTab === 'departments') {
        const res = await fetch(`/api/companies/${company.id}/departments`);
        if (res.ok) {
          const data = await res.json();
          setDepartmentsList(data.departments || []);
        }
      } else if (subTab === 'designations') {
        const res = await fetch(`/api/companies/${company.id}/designations`);
        if (res.ok) {
          const data = await res.json();
          setDesignationsList(data.designations || []);
        }
      } else if (subTab === 'emp_categories') {
        const res = await fetch(`/api/companies/${company.id}/employee-categories`);
        if (res.ok) {
          const data = await res.json();
          setEmpCategoriesList(data.employeeCategories || []);
        }
      } else if (subTab === 'business_units') {
        const res = await fetch(`/api/companies/${company.id}/business-units`);
        if (res.ok) {
          const data = await res.json();
          setBusinessUnitsList(data.businessUnits || []);
        }
      } else if (subTab === 'cost_centers') {
        const res = await fetch(`/api/companies/${company.id}/cost-centers`);
        if (res.ok) {
          const data = await res.json();
          setCostCentersList(data.costCenters || []);
        }
      } else if (subTab === 'fiscal_years') {
        const res = await fetch(`/api/companies/${company.id}/fiscal-years`);
        if (res.ok) {
          const data = await res.json();
          setFiscalYearsList(data.fiscalYears || []);
        }
      } else if (subTab === 'currencies') {
        const res = await fetch('/api/master/currencies');
        if (res.ok) {
          const data = await res.json();
          setCurrenciesList(data.currencies || []);
        }
      } else if (subTab === 'countries') {
        const res = await fetch('/api/master/countries');
        if (res.ok) {
          const data = await res.json();
          setCountriesList(data.countries || []);
        }
      } else if (subTab === 'nationalities') {
        const res = await fetch('/api/master/nationalities');
        if (res.ok) {
          const data = await res.json();
          setNationalitiesList(data.nationalities || []);
        }
      } else if (subTab === 'banks') {
        const res = await fetch(`/api/companies/${company.id}/banks`);
        if (res.ok) {
          const data = await res.json();
          setBanksList(data.banks || []);
        }
      } else if (subTab === 'payment_methods') {
        const res = await fetch(`/api/companies/${company.id}/payment-methods`);
        if (res.ok) {
          const data = await res.json();
          setPaymentMethodsList(data.paymentMethods || []);
        }
      } else if (subTab === 'document_types') {
        const res = await fetch(`/api/companies/${company.id}/document-types`);
        if (res.ok) {
          const data = await res.json();
          setDocumentTypesList(data.documentTypes || []);
        }
      } else if (subTab === 'numbering') {
        const res = await fetch(`/api/companies/${company.id}/numbering`);
        if (res.ok) {
          const data = await res.json();
          setNumberingList(data.sequences || []);
        }
      }
    } catch (err) {
      console.error('Failed to query data for tab', subTab, err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCurrentSubTabData();
  }, [company?.id, subTab]);

  // Preview numbering format live
  const updateNumberingPreview = async (cfg: any) => {
    try {
      const res = await fetch(`/api/companies/${company.id}/numbering/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      if (res.ok) {
        const data = await res.json();
        setNumberingPreview(data.preview || '');
      }
    } catch (err) {
      console.error('Failed to preview numbering', err);
    }
  };

  const handleOpenCreate = () => {
    setDialogMode('create');
    setEditingItem(null);
    setFormData({});
    setShowDialog(true);

    if (subTab === 'users') {
      setFormData({
        preferredLanguage: 'en',
        status: 'ACTIVE',
        roleIds: ['role_viewer'],
      });
    } else if (subTab === 'roles') {
      setFormData({
        permissionIds: [],
      });
    } else if (subTab === 'numbering') {
      const defaultCfg = {
        documentType: 'INVOICE',
        prefix: 'INV',
        suffix: '',
        separator: '-',
        includeYear: true,
        includeMonth: false,
        paddingLength: 5,
        nextNumber: 1,
        resetPolicy: 'NEVER',
      };
      setFormData(defaultCfg);
      updateNumberingPreview(defaultCfg);
    }
  };

  const handleOpenEdit = (item: any) => {
    setDialogMode('edit');
    setEditingItem(item);
    setShowDialog(true);

    if (subTab === 'users') {
      const roleIds = (item.assignedRoles && item.assignedRoles.length > 0)
        ? item.assignedRoles.map((r: any) => r.roleId || `role_${r.roleCode?.toLowerCase()}`)
        : item.roleIds && item.roleIds.length > 0
        ? item.roleIds
        : item.roleId
        ? [item.roleId]
        : item.role
        ? [`role_${item.role.toLowerCase()}`]
        : ['role_company_admin'];
      setFormData({
        ...item,
        roleIds,
      });
    } else if (subTab === 'roles') {
      const permissionIds = item.permissions?.map((p: any) => p.id) || [];
      setFormData({
        ...item,
        permissionIds,
      });
    } else {
      setFormData({ ...item });
      if (subTab === 'numbering') {
        updateNumberingPreview(item);
      }
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/companies/${company.id}/sessions/${sessionId}/revoke`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to revoke session');
      addToast({
        type: 'success',
        title: language === 'ar' ? 'تم إلغاء الجلسة' : 'Session Revoked',
        message: 'The session token was invalidated successfully.',
      });
      loadCurrentSubTabData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const handleOpenResetPassword = (userId: number) => {
    setResetPasswordUserId(userId);
    setNewPasswordValue('');
    setShowResetPasswordDialog(true);
  };

  const handleSubmitResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUserId || !newPasswordInput || newPasswordInput.length < 8) {
      addToast({
        type: 'error',
        title: language === 'ar' ? 'كلمة المرور قصيرة' : 'Weak Password',
        message: 'Password must be at least 8 characters long.',
      });
      return;
    }

    try {
      const res = await fetch(`/api/companies/${company.id}/users/${resetPasswordUserId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: newPasswordInput }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to reset password');
      }

      addToast({
        type: 'success',
        title: language === 'ar' ? 'تم إعادة ضبط كلمة المرور' : 'Password Reset Successful',
        message: 'The user password was updated securely.',
      });
      setShowResetPasswordDialog(false);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const handleDeleteItem = async (endpoint: string, id: string, name: string) => {
    if (!window.confirm(language === 'ar' ? `هل أنت تأكد من إزالة "${name}"؟` : `Are you sure you want to delete "${name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/companies/${company.id}/${endpoint}/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete record');
      }

      addToast({
        type: 'success',
        title: language === 'ar' ? 'تم الحذف' : 'Deleted Successfully',
        message: `${name}`,
      });
      loadCurrentSubTabData();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: language === 'ar' ? 'فشل الحذف' : 'Delete Blocked',
        message: err.message,
      });
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let endpoint = '';
      if (subTab === 'users') endpoint = 'users';
      else if (subTab === 'roles') endpoint = 'roles';
      else if (subTab === 'branches') endpoint = 'branches';
      else if (subTab === 'departments') endpoint = 'departments';
      else if (subTab === 'designations') endpoint = 'designations';
      else if (subTab === 'emp_categories') endpoint = 'employee-categories';
      else if (subTab === 'business_units') endpoint = 'business-units';
      else if (subTab === 'cost_centers') endpoint = 'cost-centers';
      else if (subTab === 'fiscal_years') endpoint = 'fiscal-years';
      else if (subTab === 'banks') endpoint = 'banks';
      else if (subTab === 'payment_methods') endpoint = 'payment-methods';
      else if (subTab === 'document_types') endpoint = 'document-types';
      else if (subTab === 'numbering') endpoint = 'numbering';

      const url =
        dialogMode === 'edit' && editingItem && subTab !== 'numbering'
          ? `/api/companies/${company.id}/${endpoint}/${editingItem.id}`
          : `/api/companies/${company.id}/${endpoint}`;

      const method = dialogMode === 'edit' && subTab !== 'numbering' ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save record');
      }

      addToast({
        type: 'success',
        title: language === 'ar' ? 'تم الحفظ بنجاح' : 'Record Saved',
        message: formData.email || formData.code || formData.nameEn || formData.displayName || 'Master record updated',
      });

      setShowDialog(false);
      loadCurrentSubTabData();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: language === 'ar' ? 'خطأ في الحفظ' : 'Validation Error',
        message: err.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate real test number from sequence engine
  const handleTestGenerateNumber = async (docType: string) => {
    setIsGeneratingNumber(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/numbering/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentType: docType }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedTestNumber(data.number);
        addToast({
          type: 'success',
          title: language === 'ar' ? 'تم التوليد الذري' : 'Atomic Number Generated',
          message: `${docType}: ${data.number}`,
        });
        loadCurrentSubTabData();
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setIsGeneratingNumber(false);
    }
  };

  // Permission Matrix helper modules
  const PERMISSION_MODULES = [
    { code: 'company', labelEn: 'Company & Branch Structure', labelAr: 'المنشأة والفروع' },
    { code: 'settings', labelEn: 'Settings & User Access Control', labelAr: 'المستخدمين والصلחיات' },
    { code: 'people', labelEn: 'People & Employee Master', labelAr: 'سجل الموظفين والعقود' },
    { code: 'time', labelEn: 'Time, Attendance & Shifts', labelAr: 'الحضور والانصراف والمناوبات' },
    { code: 'payroll', labelEn: 'Payroll & Compensation', labelAr: 'مسيرات الرواتب وحماية الأجور' },
    { code: 'finance', labelEn: 'Finance & General Ledger', labelAr: 'الحسابات والقيود المحاسبية' },
    { code: 'audit', labelEn: 'System Security & Audit Trail', labelAr: 'سجلات التدقيق والنظام' },
  ];

  return (
    <div className="space-y-6">
      {/* Category Header */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              {language === 'ar' ? 'إعدادات النظام والأمان ورخص الوصول' : 'Identity, Security & Master Data Foundation'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">
              Centralized Users, Roles & RBAC Matrix, Sessions, Data Scopes, Company Isolation, and Master Data Engine.
            </p>
          </div>

          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <Button size="sm" variant="secondary" onClick={loadCurrentSubTabData} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
              {language === 'ar' ? 'تحديث' : 'Refresh'}
            </Button>
            {subTab !== 'profile' && subTab !== 'currencies' && subTab !== 'countries' && subTab !== 'nationalities' && subTab !== 'sessions' && subTab !== 'login_events' && (
              <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={handleOpenCreate}>
                {subTab === 'users' ? (language === 'ar' ? 'إضافة مستخدم' : 'New User') : subTab === 'roles' ? (language === 'ar' ? 'إضافة دور' : 'New Role') : (language === 'ar' ? 'إضافة جديد' : 'New Master Record')}
              </Button>
            )}
          </div>
        </div>

        {/* Main Category Tabs */}
        <div className="flex items-center space-x-1 rtl:space-x-reverse border-b border-slate-200 mt-4 pt-2 text-xs font-semibold overflow-x-auto">
          {[
            { id: 'access', label: language === 'ar' ? 'المستخدمين والأمان' : 'Users & Access Control', icon: <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" /> },
            { id: 'company', label: language === 'ar' ? 'الشركة والفروع' : 'Company & Structure', icon: <Building2 className="w-3.5 h-3.5" /> },
            { id: 'organization', label: language === 'ar' ? 'الهيكل التنظيمي' : 'Organization & HR', icon: <Layers className="w-3.5 h-3.5" /> },
            { id: 'finance', label: language === 'ar' ? 'المالية والبنوك' : 'Finance & Banking', icon: <Landmark className="w-3.5 h-3.5" /> },
            { id: 'documents', label: language === 'ar' ? 'محرك الترقيم والوثائق' : 'Documents & Numbering', icon: <Hash className="w-3.5 h-3.5" /> },
            { id: 'localization', label: language === 'ar' ? 'الموقع والدول' : 'Localization & Region', icon: <Globe className="w-3.5 h-3.5" /> },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setMainCategory(cat.id as MainCategory)}
              className={`flex items-center space-x-1.5 rtl:space-x-reverse px-3 py-2 border-b-2 font-medium transition cursor-pointer whitespace-nowrap ${
                mainTab === cat.id
                  ? 'border-slate-900 text-slate-900 font-bold bg-slate-50 rounded-t'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {cat.icon}
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Sub-Category Navigation Pills */}
        <div className="flex items-center space-x-2 rtl:space-x-reverse pt-3 overflow-x-auto text-xs">
          {mainTab === 'access' && (
            <>
              <button
                onClick={() => setSubTab('users')}
                className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${subTab === 'users' ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {language === 'ar' ? 'المستخدمين' : 'Users Management'}
              </button>
              <button
                onClick={() => setSubTab('roles')}
                className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${subTab === 'roles' ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {language === 'ar' ? 'الأدوار ومصفوفة الصلاحيات' : 'Roles & Permission Matrix'}
              </button>
              <button
                onClick={() => setSubTab('sessions')}
                className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${subTab === 'sessions' ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {language === 'ar' ? 'الجلسات النشطة' : 'Active Sessions'}
              </button>
              <button
                onClick={() => setSubTab('login_events')}
                className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${subTab === 'login_events' ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {language === 'ar' ? 'سجل عمليات الدخول' : 'Security Audit / Login Events'}
              </button>
            </>
          )}

          {mainTab === 'company' && (
            <>
              <button
                onClick={() => setSubTab('profile')}
                className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${subTab === 'profile' ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {language === 'ar' ? 'ملف الشركة' : 'Company Profile'}
              </button>
              <button
                onClick={() => setSubTab('branches')}
                className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${subTab === 'branches' ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {language === 'ar' ? 'الفروع' : 'Branches'}
              </button>
              <button
                onClick={() => setSubTab('business_units')}
                className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${subTab === 'business_units' ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {language === 'ar' ? 'وحدات الأعمال' : 'Business Units'}
              </button>
              <button
                onClick={() => setSubTab('fiscal_years')}
                className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${subTab === 'fiscal_years' ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {language === 'ar' ? 'السنوات المالية' : 'Fiscal Years'}
              </button>
            </>
          )}

          {mainTab === 'organization' && (
            <>
              <button
                onClick={() => setSubTab('departments')}
                className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${subTab === 'departments' ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {language === 'ar' ? 'الأقسام' : 'Departments'}
              </button>
              <button
                onClick={() => setSubTab('designations')}
                className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${subTab === 'designations' ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {language === 'ar' ? 'المسميات الوظيفية' : 'Designations'}
              </button>
              <button
                onClick={() => setSubTab('emp_categories')}
                className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${subTab === 'emp_categories' ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {language === 'ar' ? 'فئات الموظفين' : 'Employee Categories'}
              </button>
              <button
                onClick={() => setSubTab('cost_centers')}
                className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${subTab === 'cost_centers' ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {language === 'ar' ? 'مراكز التكلفة' : 'Cost Centers'}
              </button>
            </>
          )}

          {mainTab === 'finance' && (
            <>
              <button
                onClick={() => setSubTab('currencies')}
                className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${subTab === 'currencies' ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {language === 'ar' ? 'العملات والكسور' : 'Currencies & Precision'}
              </button>
              <button
                onClick={() => setSubTab('banks')}
                className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${subTab === 'banks' ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {language === 'ar' ? 'البنوك والتحويلات' : 'Banks'}
              </button>
              <button
                onClick={() => setSubTab('payment_methods')}
                className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${subTab === 'payment_methods' ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {language === 'ar' ? 'طرق الدفع' : 'Payment Methods'}
              </button>
            </>
          )}

          {mainTab === 'documents' && (
            <>
              <button
                onClick={() => setSubTab('numbering')}
                className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${subTab === 'numbering' ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {language === 'ar' ? 'محرك التسلسل والترقيم' : 'Numbering Engine'}
              </button>
              <button
                onClick={() => setSubTab('document_types')}
                className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${subTab === 'document_types' ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {language === 'ar' ? 'أنواع الوثائق' : 'Document Types'}
              </button>
            </>
          )}

          {mainTab === 'localization' && (
            <>
              <button
                onClick={() => setSubTab('countries')}
                className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${subTab === 'countries' ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {language === 'ar' ? 'الدول والرموز' : 'Countries'}
              </button>
              <button
                onClick={() => setSubTab('nationalities')}
                className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${subTab === 'nationalities' ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {language === 'ar' ? 'الجنسيات' : 'Nationalities'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Workspace Table / View */}
      {subTab === 'users' ? (
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 rtl:right-3 rtl:left-auto" />
              <Input
                type="text"
                placeholder={language === 'ar' ? 'بحث في المستخدمين...' : 'Search users...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 rtl:pr-8 text-xs"
              />
            </div>

            <div className="text-xs text-slate-500 font-mono">
              Total Authorized Users: {usersList.length}
            </div>
          </div>

          {isLoading ? (
            <LoadingState label="Loading Users..." />
          ) : (
            <Table<any>
              data={usersList}
              keyExtractor={(row) => row.id.toString()}
              columns={[
                {
                  key: 'id',
                  header: 'User ID',
                  sortable: true,
                  render: (row: any) => (
                    <span className="font-mono font-bold text-slate-900">
                      #{row.id}
                    </span>
                  ),
                },
                {
                  key: 'displayName',
                  header: 'Name / Username',
                  sortable: true,
                  render: (row: any) => (
                    <div>
                      <div className="font-semibold text-slate-800">{row.displayName || row.email.split('@')[0]}</div>
                      <div className="text-[11px] font-mono text-slate-400">{row.username ? `@${row.username}` : row.email}</div>
                    </div>
                  ),
                },
                {
                  key: 'roles',
                  header: 'Assigned Roles',
                  render: (row: any) => (
                    <div className="flex flex-wrap gap-1">
                      {row.assignedRoles && row.assignedRoles.length > 0 ? (
                        row.assignedRoles.map((r: any, idx: number) => (
                          <span
                            key={idx}
                            className={`px-1.5 py-0.5 text-[10px] font-mono font-bold rounded ${
                              r.roleCode === 'COMPANY_ADMIN'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {language === 'ar' ? r.roleNameAr : r.roleNameEn}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] font-mono text-slate-400">Viewer</span>
                      )}
                    </div>
                  ),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (row: any) => (
                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${
                        row.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : row.status === 'LOCKED'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {row.status}
                    </span>
                  ),
                },
                {
                  key: 'lastLoginAt',
                  header: 'Last Login',
                  render: (row: any) => (
                    <span className="font-mono text-xs text-slate-500">
                      {row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleString() : 'Never'}
                    </span>
                  ),
                },
                {
                  key: 'action',
                  header: '',
                  align: 'right',
                  render: (row: any) => (
                    <div className="flex items-center justify-end space-x-1 rtl:space-x-reverse">
                      <Button size="sm" variant="secondary" onClick={() => handleOpenEdit(row)}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="secondary" title="Reset Password" onClick={() => handleOpenResetPassword(row.id)}>
                        <Key className="w-3.5 h-3.5 text-amber-600" />
                      </Button>
                    </div>
                  ),
                },
              ]}
              emptyTitle="No authorized users found"
              emptyDescription="Click New User to invite or create an account."
            />
          )}
        </div>
      ) : subTab === 'roles' ? (
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
              Roles & Reusable Permission Matrix Registry
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              Total Roles: {rolesList.length}
            </span>
          </div>

          {isLoading ? (
            <LoadingState label="Loading Roles & Matrix..." />
          ) : (
            <Table<any>
              data={rolesList}
              keyExtractor={(row) => row.id}
              columns={[
                {
                  key: 'code',
                  header: 'Role Code',
                  sortable: true,
                  render: (row: any) => (
                    <span className="font-mono font-bold text-slate-900">
                      {row.code}
                    </span>
                  ),
                },
                {
                  key: 'nameEn',
                  header: 'Role Title (En / Ar)',
                  sortable: true,
                  render: (row: any) => (
                    <div>
                      <div className="font-semibold text-slate-800">{row.nameEn}</div>
                      <div className="text-[11px] font-arabic text-slate-500">{row.nameAr}</div>
                    </div>
                  ),
                },
                {
                  key: 'assignedUsersCount',
                  header: 'Assigned Users',
                  render: (row: any) => (
                    <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      {row.assignedUsersCount || 0} Users
                    </span>
                  ),
                },
                {
                  key: 'isSystemRole',
                  header: 'Type',
                  render: (row: any) => (
                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${
                        row.isSystemRole
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {row.isSystemRole ? 'System Template' : 'Custom Company Role'}
                    </span>
                  ),
                },
                {
                  key: 'action',
                  header: '',
                  align: 'right',
                  render: (row: any) => (
                    <div className="flex items-center justify-end space-x-1 rtl:space-x-reverse">
                      <Button size="sm" variant="secondary" onClick={() => handleOpenEdit(row)}>
                        {t('action.edit')} Matrix
                      </Button>
                    </div>
                  ),
                },
              ]}
              emptyTitle="No roles defined"
              emptyDescription="Click New Role to define permissions."
            />
          )}
        </div>
      ) : subTab === 'sessions' ? (
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
              Active Security Sessions
            </h3>
            <Button size="sm" variant="secondary" onClick={loadCurrentSubTabData} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
              Refresh Sessions
            </Button>
          </div>

          <Table<any>
            data={sessionsList}
            keyExtractor={(row) => row.id}
            columns={[
              {
                key: 'userName',
                header: 'User Account',
                render: (row: any) => (
                  <div>
                    <div className="font-semibold text-slate-800">{row.userName || 'System User'}</div>
                    <div className="text-[11px] font-mono text-slate-400">{row.userEmail}</div>
                  </div>
                ),
              },
              {
                key: 'deviceInfo',
                header: 'Device / IP',
                render: (row: any) => (
                  <div className="font-mono text-xs">
                    <span className="font-bold text-slate-700">{row.ipAddress}</span>
                    <span className="text-slate-400 block text-[10px] truncate max-w-xs">{row.deviceInfo}</span>
                  </div>
                ),
              },
              {
                key: 'lastActivityAt',
                header: 'Last Activity',
                render: (row: any) => (
                  <span className="font-mono text-xs text-slate-600">
                    {new Date(row.lastActivityAt).toLocaleString()}
                  </span>
                ),
              },
              {
                key: 'action',
                header: '',
                align: 'right',
                render: (row: any) => (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-rose-600 hover:bg-rose-50"
                    leftIcon={<LogOut className="w-3.5 h-3.5" />}
                    onClick={() => handleRevokeSession(row.id)}
                  >
                    Revoke Session
                  </Button>
                ),
              },
            ]}
            emptyTitle="No active user sessions"
            emptyDescription="All session tokens are logged out."
          />
        </div>
      ) : subTab === 'login_events' ? (
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
              Authentication Security Event Audit
            </h3>
            <span className="text-xs font-mono text-slate-400">Immutable Log</span>
          </div>

          <Table<any>
            data={loginEventsList}
            keyExtractor={(row) => row.id.toString()}
            columns={[
              {
                key: 'timestamp',
                header: 'Timestamp',
                render: (row: any) => (
                  <span className="font-mono text-xs text-slate-700">
                    {new Date(row.timestamp).toLocaleString()}
                  </span>
                ),
              },
              {
                key: 'username',
                header: 'Attempted User',
                render: (row: any) => (
                  <span className="font-mono font-bold text-slate-800">
                    {row.username || `User #${row.userId}`}
                  </span>
                ),
              },
              {
                key: 'isSuccess',
                header: 'Result',
                render: (row: any) => (
                  <span
                    className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${
                      row.isSuccess
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {row.isSuccess ? 'SUCCESS' : 'FAILED'}
                  </span>
                ),
              },
              {
                key: 'failureReason',
                header: 'Details',
                render: (row: any) => (
                  <span className="font-mono text-xs text-slate-500">
                    {row.failureReason || 'Authenticated via credentials'}
                  </span>
                ),
              },
              {
                key: 'ipAddress',
                header: 'IP Address',
                render: (row: any) => (
                  <span className="font-mono text-xs text-slate-600">{row.ipAddress}</span>
                ),
              },
            ]}
            emptyTitle="No login security events recorded"
            emptyDescription="Events appear automatically on authentication attempts."
          />
        </div>
      ) : subTab === 'profile' ? (
        <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-6">
          <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {language === 'ar' ? 'ملف المنشأة والهوية البصرية' : 'Company Profile & Corporate Branding'}
              </h2>
              <p className="text-xs text-slate-500">
                {language === 'ar' ? 'إدارة شعار الشركة، الاسم التجاري، السجل التجاري، والبيانات القانونية والضريبية.' : 'Manage company logo, legal registration, tax ID, and commercial details.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                {company.code}
              </span>
              <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {company.countryCode} · {company.baseCurrency}
              </span>
            </div>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setIsSubmitting(true);
              try {
                const res = await fetch(`/api/companies/${company.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(formData),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to update company profile');
                addToast({
                  type: 'success',
                  title: language === 'ar' ? 'تم تحديث ملف المنشأة' : 'Company Profile Saved',
                  message: language === 'ar' ? 'تم حفظ الشعار والبيانات المؤسسية بنجاح.' : 'Company branding and legal data synchronized.',
                });
                onCompanyUpdated?.();
              } catch (err: any) {
                addToast({ type: 'error', title: 'Save Failed', message: err.message });
              } finally {
                setIsSubmitting(false);
              }
            }}
            className="space-y-6 text-xs"
          >
            {/* Logo Upload Section */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="relative w-20 h-20 rounded-lg bg-white border-2 border-slate-300 flex items-center justify-center p-2 overflow-hidden shrink-0 shadow-inner">
                {(formData.logoUrl !== undefined ? formData.logoUrl : company.logoUrl) ? (
                  <img
                    src={formData.logoUrl !== undefined ? formData.logoUrl : company.logoUrl}
                    alt="Company Logo Preview"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="w-10 h-10 rounded bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-sm">
                    {company.code?.slice(0, 2) || 'GH'}
                  </div>
                )}
              </div>

              <div className="space-y-1.5 flex-1">
                <div className="font-bold text-slate-900 text-sm">
                  {language === 'ar' ? 'شعار الشركة الرسمي (Logo)' : 'Official Company Logo'}
                </div>
                <p className="text-[11px] text-slate-500">
                  {language === 'ar'
                    ? 'يظهر الشعار في الشريط العلوي، بطاقات عمل الموظفين (ID Cards)، كشوف الرواتب، والفواتير الرسمية (PNG, JPG, SVG بحد أقصى 2MB).'
                    : 'Appears in application top bar, printable employee ID badges, payslips, and customer invoices. (PNG, JPG, SVG up to 2MB).'}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <label className="px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-700 font-medium text-xs hover:bg-slate-100 cursor-pointer inline-flex items-center gap-1.5 shadow-2xs">
                    <Camera className="w-3.5 h-3.5 text-slate-600" />
                    <span>{language === 'ar' ? 'تحميل شعار جديد' : 'Upload Logo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 2 * 1024 * 1024) {
                            addToast({
                              type: 'error',
                              title: language === 'ar' ? 'حجم الملف كبير' : 'File Too Large',
                              message: language === 'ar' ? 'يجب ألا يتجاوز حجم الشعار 2 ميجابايت' : 'Maximum logo size is 2MB',
                            });
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () => {
                            setFormData((prev) => ({ ...prev, logoUrl: reader.result as string }));
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                    />
                  </label>

                  {(formData.logoUrl !== undefined ? formData.logoUrl : company.logoUrl) && (
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, logoUrl: '' }))}
                      className="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 rounded text-xs font-medium inline-flex items-center gap-1 border border-rose-200 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{language === 'ar' ? 'إزالة الشعار' : 'Remove'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Legal Names */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label={language === 'ar' ? 'الاسم القانوني (إنجليزي)' : 'Legal Name (English)'} required>
                <Input
                  value={formData.legalNameEn !== undefined ? formData.legalNameEn : company.legalNameEn || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, legalNameEn: e.target.value }))}
                  placeholder="GulfHive Enterprise Co."
                  required
                />
              </FormField>
              <FormField label={language === 'ar' ? 'الاسم القانوني (عربي)' : 'Legal Name (Arabic)'} required>
                <Input
                  value={formData.legalNameAr !== undefined ? formData.legalNameAr : company.legalNameAr || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, legalNameAr: e.target.value }))}
                  placeholder="مؤسسة الخليج للأنظمة المتكاملة"
                  dir="rtl"
                  required
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label={language === 'ar' ? 'الاسم التجاري (إنجليزي)' : 'Trade Name (English)'}>
                <Input
                  value={formData.tradeNameEn !== undefined ? formData.tradeNameEn : company.tradeNameEn || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, tradeNameEn: e.target.value }))}
                  placeholder="GulfHive Tech"
                />
              </FormField>
              <FormField label={language === 'ar' ? 'الاسم التجاري (عربي)' : 'Trade Name (Arabic)'}>
                <Input
                  value={formData.tradeNameAr !== undefined ? formData.tradeNameAr : company.tradeNameAr || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, tradeNameAr: e.target.value }))}
                  placeholder="تقنية الخليج"
                  dir="rtl"
                />
              </FormField>
            </div>

            {/* Commercial and Tax Registration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label={language === 'ar' ? 'رقم السجل التجاري (CR Number)' : 'Commercial Registration (CR) Number'}>
                <Input
                  value={formData.crNumber !== undefined ? formData.crNumber : company.crNumber || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, crNumber: e.target.value }))}
                  placeholder="CR-123456"
                  className="font-mono"
                />
              </FormField>
              <FormField label={language === 'ar' ? 'الرقم الضريبي (Tax / VAT Number)' : 'Tax / VAT Number'}>
                <Input
                  value={formData.taxNumber !== undefined ? formData.taxNumber : company.taxNumber || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, taxNumber: e.target.value }))}
                  placeholder="300012345600003"
                  className="font-mono"
                />
              </FormField>
            </div>

            {/* Contact Details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label={language === 'ar' ? 'البريد الإلكتروني الرسمي' : 'Official Email'}>
                <Input
                  type="email"
                  value={formData.email !== undefined ? formData.email : company.email || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="info@gulfhive.internal"
                />
              </FormField>
              <FormField label={language === 'ar' ? 'رقم الهاتف الرئيسي' : 'Main Phone'}>
                <Input
                  value={formData.phone !== undefined ? formData.phone : company.phone || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="+965 22001122"
                />
              </FormField>
              <FormField label={language === 'ar' ? 'الموقع الإلكتروني' : 'Website'}>
                <Input
                  value={formData.website !== undefined ? formData.website : company.website || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, website: e.target.value }))}
                  placeholder="https://gulfhive.internal"
                />
              </FormField>
            </div>

            {/* Addresses */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label={language === 'ar' ? 'عنوان المقر الرئيسي (إنجليزي)' : 'Headquarters Address (English)'}>
                <Input
                  value={formData.addressEn !== undefined ? formData.addressEn : company.addressEn || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, addressEn: e.target.value }))}
                  placeholder="Kuwait City, Al-Shuhada St, Tower 4, Floor 12"
                />
              </FormField>
              <FormField label={language === 'ar' ? 'عنوان المقر الرئيسي (عربي)' : 'Headquarters Address (Arabic)'}>
                <Input
                  value={formData.addressAr !== undefined ? formData.addressAr : company.addressAr || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, addressAr: e.target.value }))}
                  placeholder="مدينة الكويت، شارع الشهداء، برج 4، الدور 12"
                  dir="rtl"
                />
              </FormField>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-200">
              <Button type="submit" variant="primary" size="md" isLoading={isSubmitting} leftIcon={<Save className="w-4 h-4" />}>
                {language === 'ar' ? 'حفظ تعديلات ملف المنشأة' : 'Save Company Branding & Details'}
              </Button>
            </div>
          </form>
        </div>
      ) : subTab === 'numbering' ? (
        <div className="space-y-6">
          <div className="bg-slate-900 text-white rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <Hash className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold tracking-tight">
                  {language === 'ar' ? 'محرك الترقيم المركزي المنفصل والآمن' : 'Central Transaction-Safe Document Numbering Engine'}
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">Atomic Lock · Non-Duplicate</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              Central numbering engine uses database transaction locks to guarantee sequential, non-duplicate codes across simultaneous users.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleTestGenerateNumber('INVOICE')}
                isLoading={isGeneratingNumber}
              >
                Generate Test Invoice Code
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleTestGenerateNumber('EMPLOYEE')}
                isLoading={isGeneratingNumber}
              >
                Generate Test Employee Code
              </Button>

              {generatedTestNumber && (
                <div className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded border border-amber-500/40 font-mono font-bold text-xs">
                  Result: {generatedTestNumber}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
            <Table<any>
              data={numberingList}
              keyExtractor={(row) => row.id || row.documentType}
              columns={[
                {
                  key: 'documentType',
                  header: 'Document Type',
                  render: (row: any) => <span className="font-mono font-bold text-slate-900">{row.documentType}</span>,
                },
                {
                  key: 'prefix',
                  header: 'Prefix / Format',
                  render: (row: any) => (
                    <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {row.prefix}{row.includeYear ? `{YYYY}` : ''}{row.separator}{'{' + '0'.repeat(row.paddingLength) + '}'}{row.suffix}
                    </span>
                  ),
                },
                {
                  key: 'nextNumber',
                  header: 'Next Counter',
                  render: (row: any) => <span className="font-mono font-bold text-slate-800">{row.nextNumber}</span>,
                },
                {
                  key: 'action',
                  header: '',
                  align: 'right',
                  render: (row: any) => (
                    <Button size="sm" variant="secondary" onClick={() => handleOpenEdit(row)}>
                      {t('action.edit')}
                    </Button>
                  ),
                },
              ]}
              emptyTitle="No document sequences configured yet"
              emptyDescription="Click New Master Record to add one."
            />
          </div>
        </div>
      ) : (
        /* Generic Master Data Table View */
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 rtl:right-3 rtl:left-auto" />
              <Input
                type="text"
                placeholder={language === 'ar' ? 'بحث في السجلات...' : 'Search master records...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 rtl:pr-8 text-xs"
              />
            </div>

            <div className="text-xs text-slate-500 font-mono">
              Total Records: {
                subTab === 'branches' ? branchesList.length :
                subTab === 'departments' ? departmentsList.length :
                subTab === 'designations' ? designationsList.length :
                subTab === 'emp_categories' ? empCategoriesList.length :
                subTab === 'business_units' ? businessUnitsList.length :
                subTab === 'cost_centers' ? costCentersList.length :
                subTab === 'fiscal_years' ? fiscalYearsList.length :
                subTab === 'currencies' ? currenciesList.length :
                subTab === 'banks' ? banksList.length :
                subTab === 'payment_methods' ? paymentMethodsList.length :
                subTab === 'document_types' ? documentTypesList.length :
                subTab === 'countries' ? countriesList.length :
                subTab === 'nationalities' ? nationalitiesList.length : 0
              }
            </div>
          </div>

          {isLoading ? (
            <LoadingState label="Loading Master Data..." />
          ) : (
            <Table<any>
              data={
                subTab === 'branches' ? branchesList :
                subTab === 'departments' ? departmentsList :
                subTab === 'designations' ? designationsList :
                subTab === 'emp_categories' ? empCategoriesList :
                subTab === 'business_units' ? businessUnitsList :
                subTab === 'cost_centers' ? costCentersList :
                subTab === 'fiscal_years' ? fiscalYearsList :
                subTab === 'currencies' ? currenciesList :
                subTab === 'banks' ? banksList :
                subTab === 'payment_methods' ? paymentMethodsList :
                subTab === 'document_types' ? documentTypesList :
                subTab === 'countries' ? countriesList :
                subTab === 'nationalities' ? nationalitiesList : []
              }
              keyExtractor={(row) => row.id || row.code || row.isoCode || row.iso2 || row.bankCode || row.name || Math.random().toString()}
              columns={[
                {
                  key: 'code',
                  header: 'Code / ISO',
                  sortable: true,
                  render: (row: any) => (
                    <span className="font-mono font-bold text-slate-900">
                      {row.code || row.isoCode || row.iso2 || row.bankCode || row.name || '—'}
                    </span>
                  ),
                },
                {
                  key: 'nameEn',
                  header: 'English Name',
                  sortable: true,
                  render: (row: any) => <span className="font-medium text-slate-800">{row.nameEn || row.name || '—'}</span>,
                },
                {
                  key: 'nameAr',
                  header: 'Arabic Name',
                  sortable: true,
                  render: (row: any) => <span className="font-arabic font-medium text-slate-800">{row.nameAr || '—'}</span>,
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (row: any) => (
                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${
                        row.isActive || row.status === 'ACTIVE' || row.status === 'OPEN'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {row.status || (row.isActive ? 'ACTIVE' : 'INACTIVE')}
                    </span>
                  ),
                },
                {
                  key: 'action',
                  header: '',
                  align: 'right',
                  render: (row: any) => (
                    <div className="flex items-center justify-end space-x-1 rtl:space-x-reverse">
                      {subTab !== 'currencies' && subTab !== 'countries' && subTab !== 'nationalities' && (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => handleOpenEdit(row)}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-rose-600 hover:bg-rose-50"
                            onClick={() => {
                              let ep = subTab;
                              if (subTab === 'emp_categories') ep = 'employee-categories';
                              else if (subTab === 'business_units') ep = 'business-units';
                              else if (subTab === 'cost_centers') ep = 'cost-centers';
                              else if (subTab === 'fiscal_years') ep = 'fiscal-years';
                              else if (subTab === 'payment_methods') ep = 'payment-methods';
                              else if (subTab === 'document_types') ep = 'document-types';
                              handleDeleteItem(ep, row.id, row.nameEn || row.code || 'record');
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  ),
                },
              ]}
              emptyTitle="No master data records found"
              emptyDescription="Click New Master Record to add one."
            />
          )}
        </div>
      )}

      {/* Unified Master Data & Security Dialog */}
      <Dialog
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
        title={
          dialogMode === 'create'
            ? subTab === 'users' ? 'Invite / Create Authorized User' : subTab === 'roles' ? 'Create Custom Security Role' : 'New Master Data Record'
            : subTab === 'users' ? 'Edit User Account & Access' : subTab === 'roles' ? 'Edit Role & Permission Matrix' : 'Edit Master Data Record'
        }
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowDialog(false)}>
              {t('action.cancel')}
            </Button>
            <Button variant="primary" size="sm" onClick={handleSubmitForm} isLoading={isSubmitting}>
              {t('action.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmitForm} className="space-y-3 py-2 text-xs">
          {subTab === 'users' ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <FormField label="Email Address" required>
                  <Input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="user@gulfhive.com"
                    required
                  />
                </FormField>
                <FormField label="Username">
                  <Input
                    type="text"
                    value={formData.username || ''}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="e.g. ahmed_hr"
                    className="font-mono"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <FormField label="Display Name">
                  <Input
                    type="text"
                    value={formData.displayName || ''}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    placeholder="Full Display Name"
                  />
                </FormField>
                <FormField label="Phone Number">
                  <Input
                    type="text"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+965 xxxxxxxx"
                  />
                </FormField>
              </div>

              {dialogMode === 'create' && (
                <FormField label="Initial Password" required>
                  <Input
                    type="password"
                    value={formData.password || ''}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Min 8 characters"
                    required
                  />
                </FormField>
              )}

              <div className="grid grid-cols-2 gap-2">
                <FormField label="Default Branch">
                  <Select
                    value={formData.defaultBranchId || ''}
                    onChange={(e) => setFormData({ ...formData, defaultBranchId: e.target.value })}
                  >
                    <option value="">All Branches / Main Office</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nameEn} ({b.code})
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="Account Status">
                  <Select
                    value={formData.status || 'ACTIVE'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="DISABLED">DISABLED</option>
                    <option value="LOCKED">LOCKED</option>
                  </Select>
                </FormField>
              </div>

              <div className="space-y-1 pt-2">
                <label className="block text-xs font-semibold text-slate-800">Assign Security Roles</label>
                <div className="space-y-1 bg-slate-50 p-3 rounded border border-slate-200 max-h-40 overflow-y-auto">
                  {rolesList.map((r) => {
                    const isChecked = (formData.roleIds || []).includes(r.id);
                    return (
                      <label key={r.id} className="flex items-center space-x-2 rtl:space-x-reverse text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const current = formData.roleIds || [];
                            const updated = e.target.checked
                              ? [...current, r.id]
                              : current.filter((id: string) => id !== r.id);
                            setFormData({ ...formData, roleIds: updated });
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="font-semibold text-slate-800">{r.nameEn}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({r.code})</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          ) : subTab === 'roles' ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <FormField label="Role Code" required>
                  <Input
                    type="text"
                    value={formData.code || ''}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. HR_OFFICER"
                    className="font-mono uppercase"
                    disabled={dialogMode === 'edit' && formData.isSystemRole}
                    required
                  />
                </FormField>
                <FormField label="Role Name (English)" required>
                  <Input
                    type="text"
                    value={formData.nameEn || ''}
                    onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                    placeholder="HR Officer"
                    required
                  />
                </FormField>
              </div>

              <FormField label="Role Name (Arabic)" required>
                <Input
                  type="text"
                  value={formData.nameAr || ''}
                  onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                  placeholder="مسؤول الموارد البشرية"
                  dir="rtl"
                  className="font-arabic text-right"
                  required
                />
              </FormField>

              {/* PERMISSION MATRIX */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                  <span className="font-bold text-slate-900 font-mono">Permission Matrix Configuration</span>
                  <span className="text-[10px] font-mono text-slate-500">
                    Selected: {(formData.permissionIds || []).length} permissions
                  </span>
                </div>

                <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                  {PERMISSION_MODULES.map((mod) => {
                    const modPerms = permissionsList.filter((p) => p.module === mod.code);
                    const selectedCount = modPerms.filter((p) => (formData.permissionIds || []).includes(p.id)).length;
                    const isAllSelected = modPerms.length > 0 && selectedCount === modPerms.length;

                    return (
                      <div key={mod.code} className="bg-slate-50 p-3 rounded border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 text-xs">
                            {mod.labelEn} / <span className="font-arabic">{mod.labelAr}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const current = formData.permissionIds || [];
                              const modPermIds = modPerms.map((p) => p.id);
                              let updated: string[];
                              if (isAllSelected) {
                                updated = current.filter((id: string) => !modPermIds.includes(id));
                              } else {
                                updated = Array.from(new Set([...current, ...modPermIds]));
                              }
                              setFormData({ ...formData, permissionIds: updated });
                            }}
                            className="text-[10px] text-indigo-600 font-semibold hover:underline cursor-pointer"
                          >
                            {isAllSelected ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {modPerms.map((p) => {
                            const isChecked = (formData.permissionIds || []).includes(p.id);
                            return (
                              <label key={p.id} className="flex items-center space-x-1.5 rtl:space-x-reverse text-xs cursor-pointer bg-white p-1.5 rounded border border-slate-200">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    const current = formData.permissionIds || [];
                                    const updated = e.target.checked
                                      ? [...current, p.id]
                                      : current.filter((id: string) => id !== p.id);
                                    setFormData({ ...formData, permissionIds: updated });
                                  }}
                                  className="rounded text-indigo-600 focus:ring-indigo-500"
                                />
                                <div>
                                  <span className="font-medium text-slate-800 block text-[11px]">{p.nameEn}</span>
                                  <span className="text-[9px] font-mono text-slate-400 block">{p.code}</span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : subTab === 'numbering' ? (
            <>
              <FormField label="Document Type" required>
                <Select
                  value={formData.documentType || 'INVOICE'}
                  onChange={(e) => {
                    const updated = { ...formData, documentType: e.target.value };
                    setFormData(updated);
                    updateNumberingPreview(updated);
                  }}
                >
                  {['INVOICE', 'EMPLOYEE', 'BILL', 'TIMESHEET', 'PURCHASE_ORDER', 'SALES_ORDER', 'QUOTATION', 'RECEIPT', 'PAYMENT', 'PROJECT', 'PAYROLL', 'JOURNAL', 'ASSET'].map((dt) => (
                    <option key={dt} value={dt}>
                      {dt}
                    </option>
                  ))}
                </Select>
              </FormField>

              <div className="grid grid-cols-2 gap-2">
                <FormField label="Prefix" required>
                  <Input
                    type="text"
                    value={formData.prefix || ''}
                    onChange={(e) => {
                      const updated = { ...formData, prefix: e.target.value.toUpperCase() };
                      setFormData(updated);
                      updateNumberingPreview(updated);
                    }}
                    placeholder="e.g. INV"
                    className="font-mono uppercase"
                  />
                </FormField>

                <FormField label="Suffix">
                  <Input
                    type="text"
                    value={formData.suffix || ''}
                    onChange={(e) => {
                      const updated = { ...formData, suffix: e.target.value.toUpperCase() };
                      setFormData(updated);
                      updateNumberingPreview(updated);
                    }}
                    placeholder="e.g. -HQ"
                    className="font-mono uppercase"
                  />
                </FormField>
              </div>

              <div className="p-3 bg-slate-900 text-amber-400 rounded font-mono text-center font-bold text-sm tracking-wider border border-slate-800">
                Format Preview: {numberingPreview || 'INV-2026-00001'}
              </div>
            </>
          ) : (
            <>
              {subTab !== 'fiscal_years' && (
                <FormField label="Code" required>
                  <Input
                    type="text"
                    value={formData.code || ''}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. FIN-01"
                    className="font-mono uppercase"
                    disabled={dialogMode === 'edit'}
                    required
                  />
                </FormField>
              )}

              <FormField label={subTab === 'fiscal_years' ? 'Fiscal Year Name' : 'English Name'} required>
                <Input
                  type="text"
                  value={formData.nameEn || formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, nameEn: e.target.value, name: e.target.value })}
                  placeholder="English Name"
                  required
                />
              </FormField>

              {subTab !== 'fiscal_years' && (
                <FormField label="Arabic Name" required>
                  <Input
                    type="text"
                    value={formData.nameAr || ''}
                    onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                    placeholder="الاسم بالعربية"
                    dir="rtl"
                    className="font-arabic text-right"
                    required
                  />
                </FormField>
              )}
            </>
          )}
        </form>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog
        isOpen={showResetPasswordDialog}
        onClose={() => setShowResetPasswordDialog(false)}
        title="Administrator Password Reset"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowResetPasswordDialog(false)}>
              {t('action.cancel')}
            </Button>
            <Button variant="primary" size="sm" onClick={handleSubmitResetPassword}>
              Reset Password
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmitResetPassword} className="space-y-3 py-2 text-xs">
          <p className="text-slate-600">
            Set a new secure password for User #{resetPasswordUserId}. The user will be required to change password on next sign-in.
          </p>
          <FormField label="New Password" required>
            <Input
              type="password"
              value={newPasswordInput}
              onChange={(e) => setNewPasswordValue(e.target.value)}
              placeholder="Minimum 8 characters"
              required
            />
          </FormField>
        </form>
      </Dialog>
    </div>
  );
}
