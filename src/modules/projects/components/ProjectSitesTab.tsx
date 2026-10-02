import React, { useState, useEffect } from 'react';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import { Button, Input, Select, Dialog, useToast, LoadingState } from '../../../design-system/index.ts';
import { apiClient } from '../../../lib/api-client.ts';
import {
  MapPin,
  Plus,
  Search,
  Building,
  Users,
  CheckCircle,
  Calendar,
  UserCheck,
  Trash2,
  AlertCircle
} from 'lucide-react';

interface ProjectSitesTabProps {
  company: any;
  projects: any[];
  employees: any[];
  onRefresh: () => void;
}

export function ProjectSitesTab({
  company,
  projects,
  employees,
  onRefresh,
}: ProjectSitesTabProps) {
  const { language } = useI18n();
  const { addToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('ALL');
  const [showAddSiteModal, setShowAddSiteModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSites, setIsLoadingSites] = useState(false);
  const [sites, setSites] = useState<any[]>([]);

  const [newSite, setNewSite] = useState({
    projectId: '',
    siteNameEn: '',
    siteNameAr: '',
    siteCode: '',
    siteSupervisorEmployeeId: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    status: 'ACTIVE',
  });

  const fetchSites = async () => {
    if (!company?.id) return;
    setIsLoadingSites(true);
    try {
      const data = await apiClient.get(`/api/companies/${company.id}/projects/sites`);
      setSites(Array.isArray(data?.sites) ? data.sites : []);
    } catch (err: any) {
      console.warn('Failed to load project sites:', err);
    } finally {
      setIsLoadingSites(false);
    }
  };

  useEffect(() => {
    fetchSites();
  }, [company?.id]);

  // Combine real database sites with primary project virtual sites if no site is registered yet
  const displayedSites: any[] = [...sites];

  // If a project has no recorded site in DB, provide its primary HQ site view
  projects.forEach((proj) => {
    const hasSite = displayedSites.some((s) => s.projectId === proj.id);
    if (!hasSite) {
      displayedSites.push({
        id: proj.id * 1000,
        projectId: proj.id,
        projectNameEn: proj.nameEn,
        projectNameAr: proj.nameAr,
        projectCode: proj.projectCode,
        siteCode: `SITE-${proj.projectCode}-01`,
        siteNameEn: `${proj.nameEn} - Main Site`,
        siteNameAr: `${proj.nameAr} - الموقع الرئيسي`,
        startDate: proj.startDate,
        endDate: proj.plannedEndDate,
        siteSupervisorEmployeeId: proj.projectManagerEmployeeId,
        status: proj.status || 'ACTIVE',
        isDefaultVirtual: true,
      });
    }
  });

  const filteredSites = displayedSites.filter((s) => {
    const siteName = (s.siteNameEn || s.nameEn || '').toLowerCase();
    const siteCode = (s.siteCode || '').toLowerCase();
    const projectName = (s.projectNameEn || '').toLowerCase();
    const q = searchQuery.toLowerCase();

    const matchesSearch = !q || siteName.includes(q) || siteCode.includes(q) || projectName.includes(q);
    const matchesProject = selectedProjectId === 'ALL' || String(s.projectId) === selectedProjectId;

    return matchesSearch && matchesProject;
  });

  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSite.projectId || !newSite.siteCode || !newSite.siteNameEn) {
      addToast({ type: 'warning', title: 'Validation', message: 'Project, site code, and site name are required.' });
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.post(`/api/companies/${company.id}/projects/sites`, {
        projectId: Number(newSite.projectId),
        siteCode: newSite.siteCode,
        siteNameEn: newSite.siteNameEn,
        siteNameAr: newSite.siteNameAr || newSite.siteNameEn,
        siteSupervisorEmployeeId: newSite.siteSupervisorEmployeeId || undefined,
        startDate: newSite.startDate,
        endDate: newSite.endDate || undefined,
        status: newSite.status,
      });

      addToast({
        type: 'success',
        title: language === 'ar' ? 'تمت إضافة موقع العمل' : 'Project Site Added',
        message: language === 'ar' ? 'تم حفظ الموقع وتعيين المشرف بنجاح' : 'Site location linked to project and persisted in database.',
      });
      setShowAddSiteModal(false);
      setNewSite({
        projectId: '',
        siteNameEn: '',
        siteNameAr: '',
        siteCode: '',
        siteSupervisorEmployeeId: '',
        startDate: new Date().toISOString().slice(0, 10),
        endDate: '',
        status: 'ACTIVE',
      });
      await fetchSites();
      onRefresh();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message || 'Failed to add project site' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSite = async (site: any) => {
    if (site.isDefaultVirtual) {
      addToast({
        type: 'info',
        title: 'Information',
        message: language === 'ar' ? 'هذا الموقع الافتراضي مرتبط بتهيئة المشروع الأولية' : 'This is the project default primary location.',
      });
      return;
    }
    if (!window.confirm(language === 'ar' ? 'هل أنت متأكد من حذف موقع العمل هذا نهائياً؟' : 'Are you sure you want to delete this project site?')) {
      return;
    }
    try {
      await apiClient.delete(`/api/companies/${company.id}/projects/sites/${site.id}`);
      addToast({
        type: 'success',
        title: language === 'ar' ? 'تم حذف الموقع' : 'Site Deleted',
        message: language === 'ar' ? 'تم حذف موقع العمل بنجاح' : 'Project site removed successfully.',
      });
      await fetchSites();
      onRefresh();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message || 'Failed to delete site' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="bg-slate-900 text-white rounded-lg p-5 shadow-xs border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-bold tracking-wide">
              {language === 'ar' ? 'مواقع المشاريع والمشرفون الميدانيون' : 'Project Sites & Field Locations'}
            </h2>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            {language === 'ar'
              ? 'توزيع مواقع العمل الميدانية التابعة لكل مشروع وتعيين المشرفين المسؤولين عن الحضور وساعات التشغيل.'
              : 'Manage multiple operational site locations per project with dedicated field supervisors and shift allocations.'}
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowAddSiteModal(true)}
          className="flex items-center gap-1.5 self-start sm:self-auto bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold"
        >
          <Plus className="w-4 h-4" />
          {language === 'ar' ? 'إضافة موقع للمشروع' : 'Add Project Site'}
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={language === 'ar' ? 'بحث باسم الموقع، كود الموقع، المشروع...' : 'Search site name, code, project...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
            {language === 'ar' ? 'المشروع:' : 'Project:'}
          </span>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400"
          >
            <option value="ALL">{language === 'ar' ? 'جميع المشاريع' : 'All Projects'}</option>
            {projects.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.projectCode} - {p.nameEn}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoadingSites && (
        <LoadingState label={language === 'ar' ? 'جاري تحميل مواقع المشاريع...' : 'Loading project sites...'} />
      )}

      {/* Sites Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSites.length === 0 && !isLoadingSites ? (
          <div className="col-span-full bg-white rounded-lg border border-slate-200 p-12 text-center space-y-3">
            <MapPin className="w-8 h-8 text-slate-300 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-800">
              {language === 'ar' ? 'لا توجد مواقع مسجلة' : 'No Project Sites Found'}
            </h3>
            <p className="text-xs text-slate-500">
              {language === 'ar' ? 'انقر على "إضافة موقع للمشروع" لإنشاء موقع ميداني جديد.' : 'Click "Add Project Site" to register a new field location.'}
            </p>
          </div>
        ) : (
          filteredSites.map((site) => {
            const supervisor = employees.find((e) => e.id === site.siteSupervisorEmployeeId);
            const supervisorName = supervisor
              ? `${supervisor.firstNameEn || ''} ${supervisor.lastNameEn || ''}`.trim()
              : (site.supervisorFirstName ? `${site.supervisorFirstName} ${site.supervisorLastName || ''}`.trim() : null);

            return (
              <div
                key={`${site.projectId}-${site.id}`}
                className="bg-white rounded-lg border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-shadow space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                      {site.siteCode}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 mt-1">
                      {language === 'ar' ? (site.siteNameAr || site.siteNameEn) : site.siteNameEn}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {site.projectCode} • {language === 'ar' ? site.projectNameAr : site.projectNameEn}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {site.status}
                    </span>
                    {!site.isDefaultVirtual && (
                      <button
                        onClick={() => handleDeleteSite(site)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition cursor-pointer"
                        title={language === 'ar' ? 'حذف الموقع' : 'Delete Site'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                      {language === 'ar' ? 'المشرف الميداني:' : 'Supervisor:'}
                    </span>
                    <span className="font-medium text-slate-800">
                      {supervisorName || (language === 'ar' ? 'غير محدد' : 'Unassigned')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {language === 'ar' ? 'الفترة الزمنية:' : 'Duration:'}
                    </span>
                    <span className="font-mono text-[11px] text-slate-700">
                      {site.startDate || '—'} → {site.endDate || (language === 'ar' ? 'مستمر' : 'Ongoing')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Site Modal */}
      {showAddSiteModal && (
        <Dialog
          isOpen={showAddSiteModal}
          onClose={() => setShowAddSiteModal(false)}
          title={language === 'ar' ? 'إضافة موقع عمل جديد للمشروع' : 'Add Project Operational Site'}
          size="md"
        >
          <form onSubmit={handleAddSite} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'المشروع المستهدف *' : 'Target Project *'}</label>
              <Select
                required
                value={newSite.projectId}
                onChange={(e) => setNewSite({ ...newSite, projectId: e.target.value })}
              >
                <option value="">{language === 'ar' ? '— اختر المشروع —' : '— Select Project —'}</option>
                {projects.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.projectCode} - {p.nameEn}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'كود الموقع *' : 'Site Code *'}</label>
                <Input
                  required
                  placeholder="e.g. SITE-01"
                  value={newSite.siteCode}
                  onChange={(e) => setNewSite({ ...newSite, siteCode: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'المشرف الميداني' : 'Field Supervisor'}</label>
                <Select
                  value={newSite.siteSupervisorEmployeeId}
                  onChange={(e) => setNewSite({ ...newSite, siteSupervisorEmployeeId: e.target.value })}
                >
                  <option value="">{language === 'ar' ? '— اختر المشرف —' : '— Select Supervisor —'}</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstNameEn} {emp.lastNameEn}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'اسم الموقع (إنجليزي) *' : 'Site Name (EN) *'}</label>
              <Input
                required
                placeholder="e.g. Hospital Main Tower - Zone B"
                value={newSite.siteNameEn}
                onChange={(e) => setNewSite({ ...newSite, siteNameEn: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'اسم الموقع (عربي)' : 'Site Name (AR)'}</label>
              <Input
                placeholder="مثال: البرج الرئيسي للمستشفى - القطاع ب"
                value={newSite.siteNameAr}
                onChange={(e) => setNewSite({ ...newSite, siteNameAr: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'تاريخ البدء' : 'Start Date'}</label>
                <Input
                  type="date"
                  value={newSite.startDate}
                  onChange={(e) => setNewSite({ ...newSite, startDate: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'تاريخ الانتهاء' : 'End Date'}</label>
                <Input
                  type="date"
                  value={newSite.endDate}
                  onChange={(e) => setNewSite({ ...newSite, endDate: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button variant="secondary" type="button" onClick={() => setShowAddSiteModal(false)}>
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button variant="primary" type="submit" disabled={isSubmitting}>
                {language === 'ar' ? 'إضافة الموقع' : 'Save Site'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
