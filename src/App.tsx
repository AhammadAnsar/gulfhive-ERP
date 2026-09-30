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
import { FirstRunWizard } from './components/FirstRunWizard.tsx';
import { CompanyManagement } from './components/CompanyManagement.tsx';
import { PeopleModule } from './modules/people/PeopleModule.tsx';
import { TimeModule } from './modules/time/TimeModule.tsx';
import { PayrollModule } from './modules/payroll/PayrollModule.tsx';
import { DashboardModule } from './modules/dashboard/DashboardModule.tsx';
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
  Archive
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
      const res = await fetch('/api/system/setup-status');
      if (res.ok) {
        const data = await res.json();
        setSetupStatus(data);
        if (data.activeTenant) {
          setActiveCompany(data.activeTenant);
          setSelectedCurrency(data.activeTenant.baseCurrency || 'KWD');
          fetchCompanyBranches(data.activeTenant.id);
        }
      }
    } catch (err) {
      console.error('Error querying setup status', err);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const fetchCompanyBranches = async (tenantId: string) => {
    try {
      const res = await fetch(`/api/companies/${tenantId}/branches`);
      if (res.ok) {
        const data = await res.json();
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

  const handleCompanyCreated = (newTenant: any) => {
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

  if (isLoadingStatus) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <LoadingState label="Validating GulfHive System State..." />
      </div>
    );
  }

  // FIRST-RUN SETUP WIZARD (Strictly rendered when 0 companies exist)
  if (setupStatus?.needsSetup || !activeCompany) {
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

  const currentBranch = companyBranches.find((b) => b.id === activeBranchId) || companyBranches[0];

  const standardActions = (
    <>
      <Button
        variant="primary"
        size="sm"
        leftIcon={<Plus className="w-3.5 h-3.5" />}
        onClick={() => addToast({ type: 'info', title: t('action.new'), message: `Create record in ${activeModule}` })}
      >
        {t('action.new')}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        leftIcon={<Save className="w-3.5 h-3.5" />}
        onClick={() => addToast({ type: 'success', title: t('action.save'), message: 'State verified' })}
      >
        {t('action.save')}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        leftIcon={<Edit2 className="w-3.5 h-3.5" />}
        onClick={() => addToast({ type: 'info', title: t('action.edit'), message: 'Edit mode active' })}
      >
        {t('action.edit')}
      </Button>
      <Button
        variant="success"
        size="sm"
        leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
        onClick={() => addToast({ type: 'success', title: t('action.approve'), message: 'Operation approved' })}
      >
        {t('action.approve')}
      </Button>
      <Button
        variant="danger"
        size="sm"
        leftIcon={<XCircle className="w-3.5 h-3.5" />}
        onClick={() => addToast({ type: 'error', title: t('action.reject'), message: 'Operation rejected' })}
      >
        {t('action.reject')}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        leftIcon={<Download className="w-3.5 h-3.5" />}
        onClick={() => addToast({ type: 'info', title: t('action.export'), message: 'Export generated' })}
      >
        {t('action.export')}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        leftIcon={<Archive className="w-3.5 h-3.5" />}
        onClick={() => addToast({ type: 'info', title: t('action.archive'), message: 'Record archived' })}
      >
        {t('action.archive')}
      </Button>
    </>
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
        <div className="space-y-8">
          <CompanyManagement
            company={activeCompany}
            activeBranchId={activeBranchId}
            onSelectBranch={setActiveBranchId}
            onCompanyUpdated={() => fetchCompanyBranches(activeCompany.id)}
          />

          {/* Decimal-Safe Arithmetic Verifier */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-2xs p-6">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <Coins className="w-5 h-5 text-slate-800" />
                <h2 className="text-sm font-bold text-slate-900">{t('foundation.money.title')}</h2>
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                Banker\'s Rounding · Arbitrary Precision
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{t('label.currency')}</label>
                  <Select
                    value={selectedCurrency}
                    onChange={(e) => setSelectedCurrency(e.target.value)}
                  >
                    {Object.values(SUPPORTED_CURRENCIES).map((curr) => (
                      <option key={curr.code} value={curr.code}>
                        {curr.code} - {language === 'ar' ? curr.nameAr : curr.nameEn} ({curr.decimals} Decimals)
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Amount String</label>
                  <Input
                    type="text"
                    value={calcInput}
                    onChange={(e) => setCalcInput(e.target.value)}
                    className="font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Ratios Allocation</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[0, 1, 2].map((idx) => (
                      <Input
                        key={idx}
                        type="number"
                        min="1"
                        value={calcAllocation[idx]}
                        onChange={(e) => {
                          const updated = [...calcAllocation];
                          updated[idx] = e.target.value;
                          setCalcAllocation(updated);
                        }}
                        className="font-mono text-center"
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 bg-slate-50 rounded-lg p-5 border border-slate-200 flex flex-col justify-between">
                {moneyError ? (
                  <div className="text-xs text-rose-600 font-mono p-3 bg-rose-50 rounded border border-rose-200">
                    {moneyError}
                  </div>
                ) : computedMoney ? (
                  <div className="space-y-4 text-xs font-mono">
                    <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-200">
                      <div>
                        <span className="text-slate-400 block mb-0.5">Canonical Decimal:</span>
                        <span className="text-sm font-bold text-slate-900">{computedMoney.toDecimalString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">Subunits (Fils / Halalas):</span>
                        <span className="text-sm font-bold text-slate-900">{computedMoney.toSubunits().toString()}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-200">
                      <div>
                        <span className="text-slate-400 block mb-0.5">English Format:</span>
                        <span className="text-slate-800 font-medium">{computedMoney.toFormattedString(false)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">Arabic Format (RTL):</span>
                        <span className="text-slate-800 font-medium">{computedMoney.toFormattedString(true)}</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-2">Remainder-Free Allocation Result:</span>
                      <div className="grid grid-cols-3 gap-2">
                        {allocationShares.map((share, idx) => (
                          <div key={idx} className="bg-white p-2 rounded border border-slate-200 text-center">
                            <span className="text-[10px] text-slate-400 block">Share {idx + 1}</span>
                            <span className="font-bold text-slate-800">{share.toFormattedString(language === 'ar')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
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
          <MainWorkspace />
        </LayoutProvider>
      </ToastProvider>
    </I18nProvider>
  );
}
