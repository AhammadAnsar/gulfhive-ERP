import React, { useState } from 'react';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import { Button, Input, Select, Dialog, useToast } from '../../../design-system/index.ts';
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
  Edit2
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

  // Extract all sites across projects
  const allProjectSites: any[] = [];
  projects.forEach((proj) => {
    if (proj.sites && proj.sites.length > 0) {
      proj.sites.forEach((s: any) => {
        allProjectSites.push({
          ...s,
          projectNameEn: proj.nameEn,
          projectNameAr: proj.nameAr,
          projectCode: proj.projectCode,
          projectId: proj.id,
        });
      });
    } else {
      // Create primary project site record if project is active
      allProjectSites.push({
        id: proj.id * 100,
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
      });
    }
  });

  const filteredSites = allProjectSites.filter((s) => {
    const matchesSearch =
      s.siteNameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.siteCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.projectNameEn.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesProject = selectedProjectId === 'ALL' || String(s.projectId) === selectedProjectId;

    return matchesSearch && matchesProject;
  });

  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      addToast({
        type: 'success',
        title: language === 'ar' ? 'تمت إضافة موقع العمل' : 'Project Site Added',
        message: language === 'ar' ? 'تم ربط الموقع بالمشروع وتعيين المشرف' : 'Site location linked to project.',
      });
      setShowAddSiteModal(false);
      onRefresh();
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Failed to add project site' });
    } finally {
      setIsSubmitting(false);
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

      {/* Sites Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSites.length === 0 ? (
          <div className="col-span-full bg-white rounded-lg border border-slate-200 p-12 text-center space-y-3">
            <MapPin className="w-8 h-8 text-slate-300 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-800">
              {language === 'ar' ? 'لا توجد مواقع مسجلة' : 'No Project Sites Found'}
            </h3>
          </div>
        ) : (
          filteredSites.map((site) => {
            const supervisor = employees.find((e) => e.id === site.siteSupervisorEmployeeId);

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
                    <h3 className="text-sm font-bold text-slate-900 mt-1">{site.siteNameEn}</h3>
                    <p className="text-xs text-slate-500">{site.projectNameEn}</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {site.status}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{language === 'ar' ? 'المشرف الميداني:' : 'Site Supervisor:'}</span>
                    <span className="font-medium text-slate-800">
                      {supervisor ? `${supervisor.firstNameEn} ${supervisor.lastNameEn}` : 'Assigned to PM'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{language === 'ar' ? 'فترة التشغيل:' : 'Active Period:'}</span>
                    <span className="font-mono text-slate-700">
                      {site.startDate} → {site.endDate || 'Ongoing'}
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
          title={language === 'ar' ? 'إضافة موقع عمل للمشروع' : 'Add Project Site Location'}
          size="md"
        >
          <form onSubmit={handleAddSite} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'المشروع المرتبط *' : 'Associated Project *'}</label>
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
