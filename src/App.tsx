/**
 * GulfHive ERP - Production Application Shell & Multi-Module Workspace
 * Clean Architecture & Domain-Driven Design Foundation.
 * Adheres strictly to GulfHive Design System: minimal, compact, zero-pill, enterprise-grade.
 */

import React, { useState, useEffect } from 'react';
import { I18nProvider, useI18n } from './shared/i18n/I18nContext.tsx';
import { ToastProvider, LayoutProvider, AppShell, Button, Input, Select, useToast, LoadingState } from './design-system/index.ts';
import { Money, SUPPORTED_CURRENCIES } from './core/domain/money.ts';
import { GULFHIVE_MODULES } from './modules/module.manifest.ts';
import { apiClient } from './lib/api-client.ts';
import { AuthProvider, useAuth } from './core/security/AuthContext.tsx';
import { LoginScreen } from './modules/auth/LoginScreen.tsx';
import { FirstRunWizard } from './components/FirstRunWizard.tsx';
import { CompanyManagement } from './components/CompanyManagement.tsx';
import { PeopleModule } from './modules/people/PeopleModule.tsx';
import { TimeModule } from './modules/time/TimeModule.tsx';
import { PayrollModule } from './modules/payroll/PayrollModule.tsx';
import { DashboardModule } from './modules/dashboard/DashboardModule.tsx';
import { SettingsModule } from './modules/settings/SettingsModule.tsx';
import { SalesModule } from './modules/sales/SalesModule.tsx';
import { PurchaseModule } from './modules/purchase/PurchaseModule.tsx';
import { ProjectsModule } from './modules/projects/ProjectsModule.tsx';
import {
  Coins,
  FileCheck,
  Building2,
  Globe,
  Plus,
  Save,
  Edit2,
  CheckCircle2,
  XCircle,
  Download,
  Archive,
  RotateCw
} from 'lucide-react';

interface SetupStatus {
  needsSetup: boolean;
  tenantsCount: number;
  activeTenant: any | null;
  deploymentMode: string;
}

function MainWorkspace() {
  const { t, language, toggleLanguage } = useI18n();
  const { addToast } = useToast();
  const { user, isAuthenticated, isLoading: isAuthLoading, logout, setAuthSession } = useAuth();

  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(true);
  const [activeModule, setActiveModule] = useState<string>('dashboard');
  const [activeCompany, setActiveCompany] = useState<any | null>(null);
  const [activeBranchId, setActiveBranchId] = useState<string>('');
  const [companyBranches, setCompanyBranches] = useState<any[]>([]);

  // Monetary Arithmetic Verifier
  const [selectedCurrency, setSelectedCurrency] = useState<string>('KWD');
  const [calcInput, setCalcInput] = useState<string>('1250.750');
  const [calcAllocation, setCalcAllocation] = useState<string[]>([ '1', '1', '1' ]);

  const fetchSetupStatus = async () => {
    try {
      const data = await apiClient.get('/api/system/setup-status');
      if (data) {
        setSetupStatus(data);
      }
    } catch (err) {
      console.error('Error querying setup status', err);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const fetchCompanyBranches = async (tenantId: string) => {
    try {
      const data = await apiClient.get(`/api/companies/${tenantId}/branches`);
      if (data) {
        setCompanyBranches(data.branches || []);
        if (data.branches?.length > 0) {
          const main = data.branches.find((b: any) => b.isMain) || data.branches[0];
          setActiveBranchId(main.id);
        }
      }
    } catch (err) {
      console.error('Error querying company branches', err);
    }
  };

  useEffect(() => {
    fetchSetupStatus();
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      const companyId = user.activeCompanyId || (user.authorizedCompanyIds && user.authorizedCompanyIds[0]) || setupStatus?.activeTenant?.id;
      if (companyId) {
        apiClient.get(`/api/companies/${companyId}`).then((res) => {
          if (res?.company) {
            setActiveCompany(res.company);
            setSelectedCurrency(res.company.baseCurrency || 'KWD');
            fetchCompanyBranches(companyId);
          }
        }).catch(() => {
          if (setupStatus?.activeTenant) {
            setActiveCompany(setupStatus.activeTenant);
            setSelectedCurrency(setupStatus.activeTenant.baseCurrency || 'KWD');
            fetchCompanyBranches(setupStatus.activeTenant.id);
          }
        });
      }
    } else {
      setActiveCompany(null);
      setCompanyBranches([]);
      setActiveBranchId('');
    }
  }, [isAuthenticated, user?.activeCompanyId, user?.authorizedCompanyIds, setupStatus?.activeTenant?.id]);

  const handleCompanyCreated = (newTenant: any, token?: string, userContext?: any) => {
    if (token && userContext) {
      setAuthSession(userContext, token);
    }
    setActiveCompany(newTenant);
    setSelectedCurrency(newTenant.baseCurrency || 'KWD');
    setSetupStatus({
      needsSetup: false,
      tenantsCount: 1,
      activeTenant: newTenant,
      deploymentMode: setupStatus?.deploymentMode || 'ONLINE_CLOUD_HOSTED',
    });
    fetchCompanyBranches(newTenant.id);
  };

  // Live Decimal-Safe Monetary Calculation
  let computedMoney: Money | null = null;
  let allocationShares: Money[] = [];
  let moneyError: string | null = null;

  try {
    computedMoney = Money.create(calcInput || '0', selectedCurrency);
    allocationShares = computedMoney.allocate(calcAllocation.map((n) => Number(n) || 1));
  } catch (err: any) {
    moneyError = err.message || 'Invalid amount';
  }

  // 1. BOOTSTRAPPING STATE
  if (isLoadingStatus || isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <LoadingState label={language === 'ar' ? 'جاري التحقق من جلسة العمل وحالة النظام...' : 'Authenticating session & verifying system state...'} />
      </div>
    );
  }

  // 2. FIRST-RUN SETUP WIZARD (Strictly rendered when 0 companies exist)
  if (setupStatus?.needsSetup) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
        <header className="bg-slate-900 text-white border-b border-slate-800 py-3 px-6 flex items-center justify-between">
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <div className="w-8 h-8 rounded bg-amber-500 flex items-center justify-center font-bold text-slate-950 text-xs">
              GH
            </div>
            <span className="text-base font-bold tracking-tight">{t('app.name')}</span>
          </div>

          <button
            onClick={toggleLanguage}
            className="flex items-center space-x-1.5 rtl:space-x-reverse px-2.5 py-1 text-xs font-semibold rounded text-slate-200 border border-slate-700 hover:bg-slate-800 transition cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span>{t('action.switch_language')}</span>
          </button>
        </header>

        <main className="flex-1 py-8">
          <FirstRunWizard onCompanyCreated={handleCompanyCreated} />
        </main>
      </div>
    );
  }

  // 3. UNAUTHENTICATED STATE -> Render Login Screen
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // 4. AUTHENTICATED BUT COMPANY INITIALIZING
  if (!activeCompany) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <LoadingState label={language === 'ar' ? 'جاري تهيئة سياق المنشأة المصرح بها...' : 'Establishing authorized company context...'} />
      </div>
    );
  }

  const currentBranch = companyBranches.find((b) => b.id === activeBranchId) || companyBranches[0];

  const standardActions = (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        leftIcon={<RotateCw className="w-3.5 h-3.5" />}
        onClick={() => {
          if (activeCompany?.id) {
            fetchCompanyBranches(activeCompany.id);
          }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('gulfhive:refresh'));
          }
          addToast({
            type: 'info',
            title: language === 'ar' ? 'تحديث البيانات' : 'Refresh Data',
            message: language === 'ar' ? 'تمت مزامنة بيانات الشاشة الحالية' : 'Active screen records synchronized.',
          });
        }}
      >
        {language === 'ar' ? 'تحديث' : 'Refresh'}
      </Button>

      <Button
        variant="secondary"
        size="sm"
        leftIcon={<Download className="w-3.5 h-3.5" />}
        onClick={() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('gulfhive:export', { detail: { module: activeModule } }));
          }
          addToast({
            type: 'info',
            title: t('action.export'),
            message: language === 'ar' ? `جاري تصدير بيانات ${t('nav.' + activeModule)}...` : `Exporting ${activeModule} dataset...`,
          });
        }}
      >
        {t('action.export')}
      </Button>
    </div>
  );

  return (
    <AppShell
      activeModule={activeModule}
      onSelectModule={setActiveModule}
      company={activeCompany}
      branches={companyBranches}
      activeBranchId={activeBranchId}
      onSelectBranch={setActiveBranchId}
      breadcrumbs={[
        { label: language === 'ar' ? activeCompany.legalNameAr : activeCompany.legalNameEn },
        { label: currentBranch ? (language === 'ar' ? currentBranch.nameAr : currentBranch.nameEn) : 'HQ' },
        { label: t(`nav.${activeModule}`), isCurrent: true },
      ]}
      actions={standardActions}
      currentUser={{
        displayName: user?.displayName || 'Administrator',
        email: user?.email || 'admin@gulfhive.internal',
        role: user?.roles?.[0] || 'COMPANY_ADMIN',
      }}
      onLogout={logout}
    >
      {activeModule === 'dashboard' ? (
        <DashboardModule
          company={activeCompany}
          branches={companyBranches}
          activeBranchId={activeBranchId}
          onNavigate={(module) => setActiveModule(module)}
        />
      ) : activeModule === 'people' ? (
        <PeopleModule
          company={activeCompany}
          branches={companyBranches}
          activeBranchId={activeBranchId}
        />
      ) : activeModule === 'time' ? (
        <TimeModule
          company={activeCompany}
          branches={companyBranches}
          activeBranchId={activeBranchId}
        />
      ) : activeModule === 'payroll' ? (
        <PayrollModule
          company={activeCompany}
          branches={companyBranches}
          activeBranchId={activeBranchId}
        />
      ) : activeModule === 'settings' ? (
        <SettingsModule
          company={activeCompany}
          branches={companyBranches}
          activeBranchId={activeBranchId}
          onCompanyUpdated={() => fetchCompanyBranches(activeCompany.id)}
        />
      ) : activeModule === 'sales' ? (
        <SalesModule
          company={activeCompany}
          branches={companyBranches}
          activeBranchId={activeBranchId}
        />
      ) : activeModule === 'purchase' ? (
        <PurchaseModule
          company={activeCompany}
          branches={companyBranches}
          activeBranchId={activeBranchId}
        />
      ) : activeModule === 'projects' ? (
        <ProjectsModule
          company={activeCompany}
          branches={companyBranches}
          activeBranchId={activeBranchId}
        />
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 p-8 shadow-2xs text-center space-y-4">
          <div className="w-10 h-10 mx-auto rounded bg-slate-100 flex items-center justify-center text-slate-600">
            <FileCheck className="w-5 h-5" />
          </div>
          <h2 className="text-sm font-bold text-slate-900">
            {t(`nav.${activeModule}`)} — {language === 'ar' ? 'الوحدة قيد التهيئة المؤسسية' : 'Module Domain Boundary Active'}
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            {GULFHIVE_MODULES[activeModule]
              ? language === 'ar'
                ? GULFHIVE_MODULES[activeModule].descriptionAr
                : GULFHIVE_MODULES[activeModule].descriptionEn
              : 'Module contract defined in Clean Architecture Modular Monolith registry.'}
          </p>
          <div className="pt-4 border-t border-slate-100 max-w-xs mx-auto flex items-center justify-between text-xs text-slate-500 font-mono">
            <span>Company: {activeCompany.code}</span>
            <span>Branch: {currentBranch?.code || 'HQ'}</span>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <ToastProvider>
        <LayoutProvider>
          <AuthProvider>
            <MainWorkspace />
          </AuthProvider>
        </LayoutProvider>
      </ToastProvider>
    </I18nProvider>
  );
}
