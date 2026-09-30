import React, { useState, useEffect } from 'react';
import { useI18n } from '../../shared/i18n/I18nContext.tsx';
import { LoadingState, useToast } from '../../design-system/index.ts';
import { ProjectMasterTab } from './components/ProjectMasterTab.tsx';
import { BillingProfilesTab } from './components/BillingProfilesTab.tsx';
import { ProjectContractsTab } from './components/ProjectContractsTab.tsx';
import { ProjectSitesTab } from './components/ProjectSitesTab.tsx';
import { ExternalWorkersTab } from './components/ExternalWorkersTab.tsx';
import { WorkforceDeploymentTab } from './components/WorkforceDeploymentTab.tsx';
import { ProjectTimeTab } from './components/ProjectTimeTab.tsx';
import { LabourSettlementTab } from './components/LabourSettlementTab.tsx';
import { ProjectReportsTab } from './components/ProjectReportsTab.tsx';
import {
  Briefcase,
  Building,
  FileText,
  MapPin,
  Users,
  UserCheck,
  Clock,
  Receipt,
  FileSpreadsheet,
  Coins,
  ShieldCheck,
  TrendingUp,
  Layers
} from 'lucide-react';

interface ProjectsModuleProps {
  company: any;
  branches: any[];
  activeBranchId: string;
}

export function ProjectsModule({
  company,
  branches,
  activeBranchId,
}: ProjectsModuleProps) {
  const { language } = useI18n();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<
    | 'projects'
    | 'billing-profiles'
    | 'contracts'
    | 'sites'
    | 'external-workers'
    | 'deployments'
    | 'time'
    | 'settlements'
    | 'reports'
  >('projects');

  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [billingProfiles, setBillingProfiles] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  const loadModuleData = async () => {
    setIsLoading(true);
    try {
      const [projRes, bpRes, clientRes, supRes, empRes] = await Promise.all([
        fetch(`/api/companies/${company.id}/projects`),
        fetch(`/api/companies/${company.id}/projects/billing-profiles`),
        fetch(`/api/companies/${company.id}/sales/clients`),
        fetch(`/api/companies/${company.id}/procurement/suppliers`),
        fetch(`/api/companies/${company.id}/employees`),
      ]);

      if (projRes.ok) {
        const data = await projRes.json();
        setProjects(Array.isArray(data) ? data : data.projects || []);
      }
      if (bpRes.ok) {
        const data = await bpRes.json();
        setBillingProfiles(Array.isArray(data) ? data : data.billingProfiles || []);
      }
      if (clientRes.ok) {
        const data = await clientRes.json();
        setClients(Array.isArray(data) ? data : data.clients || []);
      }
      if (supRes.ok) {
        const data = await supRes.json();
        setSuppliers(Array.isArray(data) ? data : data.suppliers || []);
      }
      if (empRes.ok) {
        const data = await empRes.json();
        setEmployees(Array.isArray(data) ? data : data.employees || []);
      }
    } catch {
      addToast({
        type: 'error',
        title: language === 'ar' ? 'خطأ في التحميل' : 'Data Load Error',
        message: language === 'ar' ? 'فشل تحميل بيانات موديول المشاريع' : 'Could not fetch projects data.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadModuleData();
  }, [company.id]);

  // Dynamic KPI calculations with array safety
  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeBillingProfiles = Array.isArray(billingProfiles) ? billingProfiles : [];
  const safeClients = Array.isArray(clients) ? clients : [];
  const safeSuppliers = Array.isArray(suppliers) ? suppliers : [];
  const safeEmployees = Array.isArray(employees) ? employees : [];

  const totalContractValue = safeProjects.reduce((acc, p) => acc + Number(p.contractValue || 0), 0);
  const subcontractProjectsCount = safeProjects.filter((p) => p.principalSupplierId).length;
  const activeProjectsCount = safeProjects.filter((p) => p.status === 'ACTIVE').length;

  return (
    <div className="space-y-6">
      {/* Top Banner with KPIs */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-slate-900 flex items-center justify-center text-amber-400 font-bold">
                <Briefcase className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900">
                  {language === 'ar'
                    ? 'إدارة المشاريع، عقود الباطن، هويات الفوترة وتشغيل القوى العاملة'
                    : 'Projects, Subcontracts, Billing Identity & Workforce Deployment'}
                </h1>
                <p className="text-xs text-slate-500">
                  {language === 'ar'
                    ? 'الحوكمة التشغيلية للمشاريع المباشرة والمقاولة بالباطن مع التحقق التام من هويات الفوترة وفصل مستحقات العمالة.'
                    : 'End-to-end management of direct & subcontracted projects, multi-party billing governance, and mixed workforce deployment.'}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-2.5 bg-slate-50 rounded-md border border-slate-100">
              <span className="text-[11px] text-slate-500 font-medium">
                {language === 'ar' ? 'المشاريع النشطة' : 'Active Projects'}
              </span>
              <div className="text-sm font-bold text-slate-900 mt-0.5">{activeProjectsCount}</div>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-md border border-slate-100">
              <span className="text-[11px] text-slate-500 font-medium">
                {language === 'ar' ? 'عقود الباطن' : 'Subcontracts'}
              </span>
              <div className="text-sm font-bold text-amber-800 mt-0.5">{subcontractProjectsCount}</div>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-md border border-slate-100">
              <span className="text-[11px] text-slate-500 font-medium">
                {language === 'ar' ? 'هويات الفوترة' : 'Billing Profiles'}
              </span>
              <div className="text-sm font-bold text-blue-900 mt-0.5">{safeBillingProfiles.length}</div>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-md border border-slate-100">
              <span className="text-[11px] text-slate-500 font-medium">
                {language === 'ar' ? 'إجمالي قيمة العقود' : 'Portfolio Value'}
              </span>
              <div className="text-sm font-bold text-slate-900 mt-0.5 font-mono">
                {totalContractValue.toLocaleString('en-US', { minimumFractionDigits: 3 })}{' '}
                <span className="text-[10px] text-slate-500 font-normal">{company.baseCurrency || 'KWD'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab('projects')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
            activeTab === 'projects'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          {language === 'ar' ? 'سجل المشاريع' : 'Projects Master'}
        </button>

        <button
          onClick={() => setActiveTab('billing-profiles')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
            activeTab === 'billing-profiles'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          {language === 'ar' ? 'هويات الفوترة والتفويض' : 'Billing Profiles & Auth'}
        </button>

        <button
          onClick={() => setActiveTab('contracts')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
            activeTab === 'contracts'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          {language === 'ar' ? 'العقود والاتفاقيات' : 'Contracts & Subcontracts'}
        </button>

        <button
          onClick={() => setActiveTab('sites')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
            activeTab === 'sites'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <MapPin className="w-4 h-4" />
          {language === 'ar' ? 'مواقع العمل' : 'Project Sites'}
        </button>

        <button
          onClick={() => setActiveTab('external-workers')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
            activeTab === 'external-workers'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4 text-amber-400" />
          {language === 'ar' ? 'العمالة الخارجية' : 'External Workforce'}
        </button>

        <button
          onClick={() => setActiveTab('deployments')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
            activeTab === 'deployments'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          {language === 'ar' ? 'تشغيل القوى العاملة' : 'Workforce Deployment'}
        </button>

        <button
          onClick={() => setActiveTab('time')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
            activeTab === 'time'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-4 h-4" />
          {language === 'ar' ? 'ساعات العمل' : 'Project Timesheets'}
        </button>

        <button
          onClick={() => setActiveTab('settlements')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
            activeTab === 'settlements'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Receipt className="w-4 h-4 text-blue-400" />
          {language === 'ar' ? 'تسويات الموردين' : 'Labour Settlements'}
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
            activeTab === 'reports'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          {language === 'ar' ? 'التقارير' : 'Reports'}
        </button>
      </div>

      {/* Tab Content Rendering */}
      {isLoading ? (
        <div className="bg-white rounded-lg border border-slate-200 p-16 text-center">
          <LoadingState label={language === 'ar' ? 'جاري تحميل بيانات المشاريع وهويات الفوترة...' : 'Loading project domain and workforce ledger...'} />
        </div>
      ) : (
        <>
          {activeTab === 'projects' && (
            <ProjectMasterTab
              company={company}
              branchId={activeBranchId}
              projects={safeProjects}
              clients={safeClients}
              suppliers={safeSuppliers}
              billingProfiles={safeBillingProfiles}
              employees={safeEmployees}
              onRefresh={loadModuleData}
              onDeployWorker={(proj) => {
                setActiveTab('deployments');
              }}
            />
          )}

          {activeTab === 'billing-profiles' && (
            <BillingProfilesTab
              company={company}
              billingProfiles={safeBillingProfiles}
              suppliers={safeSuppliers}
              clients={safeClients}
              onRefresh={loadModuleData}
            />
          )}

          {activeTab === 'contracts' && (
            <ProjectContractsTab
              company={company}
              projects={safeProjects}
              clients={safeClients}
              suppliers={safeSuppliers}
              onRefresh={loadModuleData}
            />
          )}

          {activeTab === 'sites' && (
            <ProjectSitesTab
              company={company}
              projects={safeProjects}
              employees={safeEmployees}
              onRefresh={loadModuleData}
            />
          )}

          {activeTab === 'external-workers' && (
            <ExternalWorkersTab
              company={company}
              suppliers={safeSuppliers}
              onRefresh={loadModuleData}
            />
          )}

          {activeTab === 'deployments' && (
            <WorkforceDeploymentTab
              company={company}
              projects={safeProjects}
              employees={safeEmployees}
              onRefresh={loadModuleData}
            />
          )}

          {activeTab === 'time' && (
            <ProjectTimeTab
              company={company}
              projects={safeProjects}
              employees={safeEmployees}
              onRefresh={loadModuleData}
            />
          )}

          {activeTab === 'settlements' && (
            <LabourSettlementTab
              company={company}
              projects={safeProjects}
              suppliers={safeSuppliers}
              onRefresh={loadModuleData}
            />
          )}

          {activeTab === 'reports' && (
            <ProjectReportsTab
              company={company}
              projects={safeProjects}
              employees={safeEmployees}
              suppliers={safeSuppliers}
              clients={safeClients}
            />
          )}
        </>
      )}
    </div>
  );
}
