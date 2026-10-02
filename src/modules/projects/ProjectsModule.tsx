import React, { useState, useEffect } from 'react';
import { useI18n } from '../../shared/i18n/I18nContext.tsx';
import { LoadingState, useToast } from '../../design-system/index.ts';
import { apiClient } from '../../lib/api-client.ts';
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
  Layers,
  FolderKanban,
  HardHat,
  BadgeDollarSign
} from 'lucide-react';

interface ProjectsModuleProps {
  company: any;
  branches: any[];
  activeBranchId: string;
}

type TabType =
  | 'projects'
  | 'billing-profiles'
  | 'contracts'
  | 'sites'
  | 'external-workers'
  | 'deployments'
  | 'time'
  | 'settlements'
  | 'reports';

type DomainCategory = 'ALL' | 'CONTRACTS' | 'WORKFORCE' | 'FINANCE';

export function ProjectsModule({
  company,
  branches,
  activeBranchId,
}: ProjectsModuleProps) {
  const { language } = useI18n();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabType>('projects');
  const [selectedCategory, setSelectedCategory] = useState<DomainCategory>('ALL');

  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [billingProfiles, setBillingProfiles] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  const loadModuleData = async () => {
    setIsLoading(true);
    try {
      const [projData, bpData, clientData, supData, empData] = await Promise.all([
        apiClient.get(`/api/companies/${company.id}/projects`),
        apiClient.get(`/api/companies/${company.id}/projects/billing-profiles`),
        apiClient.get(`/api/companies/${company.id}/sales/clients`),
        apiClient.get(`/api/companies/${company.id}/procurement/suppliers`),
        apiClient.get(`/api/companies/${company.id}/employees`),
      ]);

      setProjects(Array.isArray(projData) ? projData : projData?.projects || []);
      setBillingProfiles(Array.isArray(bpData) ? bpData : bpData?.billingProfiles || []);
      setClients(Array.isArray(clientData) ? clientData : clientData?.clients || []);
      setSuppliers(Array.isArray(supData) ? supData : supData?.suppliers || []);
      setEmployees(Array.isArray(empData) ? empData : empData?.employees || []);
    } catch (err: any) {
      addToast({
        type: 'error',
        title: language === 'ar' ? 'خطأ في التحميل' : 'Data Load Error',
        message: err.message || (language === 'ar' ? 'فشل تحميل بيانات موديول المشاريع' : 'Could not fetch projects data.'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadModuleData();
  }, [company.id]);

  // Listen for global refresh trigger
  useEffect(() => {
    const handleRefresh = () => loadModuleData();
    window.addEventListener('gulfhive:refresh', handleRefresh);
    return () => window.removeEventListener('gulfhive:refresh', handleRefresh);
  }, [company?.id]);

  // Dynamic KPI calculations with array safety
  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeBillingProfiles = Array.isArray(billingProfiles) ? billingProfiles : [];
  const safeClients = Array.isArray(clients) ? clients : [];
  const safeSuppliers = Array.isArray(suppliers) ? suppliers : [];
  const safeEmployees = Array.isArray(employees) ? employees : [];

  const totalContractValue = safeProjects.reduce((acc, p) => acc + Number(p.contractValue || 0), 0);
  const subcontractProjectsCount = safeProjects.filter((p) => p.principalSupplierId).length;
  const activeProjectsCount = safeProjects.filter((p) => p.status === 'ACTIVE').length;

  const allTabs: { id: TabType; category: DomainCategory; labelEn: string; labelAr: string; icon: any }[] = [
    // 1. Projects & Sites
    { id: 'projects', category: 'CONTRACTS', labelEn: 'Projects Master', labelAr: 'سجل المشاريع', icon: Briefcase },
    { id: 'contracts', category: 'CONTRACTS', labelEn: 'Contracts & Subcontracts', labelAr: 'العقود والاتفاقيات', icon: FileText },
    { id: 'sites', category: 'CONTRACTS', labelEn: 'Project Sites', labelAr: 'مواقع العمل', icon: MapPin },
    // 2. Workforce Operations
    { id: 'deployments', category: 'WORKFORCE', labelEn: 'Workforce Deployment', labelAr: 'تشغيل القوى العاملة', icon: Layers },
    { id: 'external-workers', category: 'WORKFORCE', labelEn: 'External Workforce', labelAr: 'العمالة الخارجية', icon: Users },
    { id: 'time', category: 'WORKFORCE', labelEn: 'Project Timesheets', labelAr: 'ساعات العمل', icon: Clock },
    // 3. Billing & Finance
    { id: 'billing-profiles', category: 'FINANCE', labelEn: 'Billing Profiles & Auth', labelAr: 'هويات الفوترة والتفويض', icon: ShieldCheck },
    { id: 'settlements', category: 'FINANCE', labelEn: 'Labour Settlements & AP', labelAr: 'تسويات مقاولي التوريد', icon: Receipt },
    { id: 'reports', category: 'FINANCE', labelEn: 'Operational Reports', labelAr: 'التقارير التكليفية', icon: FileSpreadsheet },
  ];

  const visibleTabs = selectedCategory === 'ALL'
    ? allTabs
    : allTabs.filter((t) => t.category === selectedCategory);

  return (
    <div className="space-y-5 max-w-full overflow-x-hidden">
      {/* Top Banner with KPIs */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-slate-900 flex items-center justify-center text-amber-400 font-bold shrink-0">
                <Briefcase className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900 tracking-tight">
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
            <div className="p-2.5 bg-slate-50 rounded-md border border-slate-100 min-w-[110px]">
              <span className="text-[11px] text-slate-500 font-medium">
                {language === 'ar' ? 'المشاريع النشطة' : 'Active Projects'}
              </span>
              <div className="text-sm font-bold text-slate-900 mt-0.5">{activeProjectsCount}</div>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-md border border-slate-100 min-w-[110px]">
              <span className="text-[11px] text-slate-500 font-medium">
                {language === 'ar' ? 'عقود الباطن' : 'Subcontracts'}
              </span>
              <div className="text-sm font-bold text-amber-800 mt-0.5">{subcontractProjectsCount}</div>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-md border border-slate-100 min-w-[110px]">
              <span className="text-[11px] text-slate-500 font-medium">
                {language === 'ar' ? 'هويات الفوترة' : 'Billing Profiles'}
              </span>
              <div className="text-sm font-bold text-slate-900 mt-0.5">{safeBillingProfiles.length}</div>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-md border border-slate-100 min-w-[130px]">
              <span className="text-[11px] text-slate-500 font-medium">
                {language === 'ar' ? 'إجمالي قيمة العقود' : 'Portfolio Value'}
              </span>
              <div className="text-sm font-bold text-emerald-800 mt-0.5 font-mono">
                {totalContractValue.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}{' '}
                <span className="text-[10px] text-slate-500 font-normal">{company.baseCurrency || 'KWD'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Domain Category Filter + Tab Strip: Zero Horizontal Scrollbars */}
      <div className="space-y-2 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
        {/* Category Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1 rtl:ml-1">
              {language === 'ar' ? 'القطاع:' : 'Domain:'}
            </span>
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                selectedCategory === 'ALL'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {language === 'ar' ? 'الكل (9)' : 'All (9)'}
            </button>
            <button
              onClick={() => {
                setSelectedCategory('CONTRACTS');
                if (!['projects', 'contracts', 'sites'].includes(activeTab)) setActiveTab('projects');
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                selectedCategory === 'CONTRACTS'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <FolderKanban className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'المشاريع والمواقع (3)' : 'Projects & Sites (3)'}</span>
            </button>
            <button
              onClick={() => {
                setSelectedCategory('WORKFORCE');
                if (!['deployments', 'external-workers', 'time'].includes(activeTab)) setActiveTab('deployments');
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                selectedCategory === 'WORKFORCE'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <HardHat className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'القوى العاملة والتشغيل (3)' : 'Workforce & Operations (3)'}</span>
            </button>
            <button
              onClick={() => {
                setSelectedCategory('FINANCE');
                if (!['billing-profiles', 'settlements', 'reports'].includes(activeTab)) setActiveTab('billing-profiles');
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                selectedCategory === 'FINANCE'
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <BadgeDollarSign className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'الفوترة والتسويات (3)' : 'Billing & Commercial (3)'}</span>
            </button>
          </div>

          <div className="text-[11px] font-mono text-slate-400">
            {language === 'ar' ? 'عرض بدون تمرير أفقي' : 'Responsive Compact Layout'}
          </div>
        </div>

        {/* Tab Buttons: Clean Flex-Wrap, No Overflow Scrollbar */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-xs transition cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-2xs font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 bg-slate-50/80 border border-slate-200/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-500'}`} />
                <span>{language === 'ar' ? tab.labelAr : tab.labelEn}</span>
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <LoadingState label={language === 'ar' ? 'جاري تحميل بيانات المشاريع والعقود...' : 'Synchronizing project portfolio & workforce data...'} />
      ) : (
        <>
          {activeTab === 'projects' && (
            <ProjectMasterTab
              company={company}
              projects={safeProjects}
              clients={safeClients}
              suppliers={safeSuppliers}
              billingProfiles={safeBillingProfiles}
              employees={safeEmployees}
              branchId={activeBranchId}
              onRefresh={loadModuleData}
              onDeployWorker={() => {
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
