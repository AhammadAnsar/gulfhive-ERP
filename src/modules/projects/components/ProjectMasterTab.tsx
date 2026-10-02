import React, { useState } from 'react';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import { Button, Input, Select, Dialog, useToast } from '../../../design-system/index.ts';
import { apiClient } from '../../../lib/api-client.ts';
import { ProjectEditModal } from './ProjectEditModal.tsx';
import { ProjectPreflightDeleteModal } from './ProjectPreflightDeleteModal.tsx';
import { ProjectBulkDeleteModal } from './ProjectBulkDeleteModal.tsx';
import { ProjectDetailDrawer } from './ProjectDetailDrawer.tsx';
import {
  Briefcase,
  Plus,
  Search,
  Eye,
  Edit2,
  Trash2,
  CheckSquare,
  Square,
  Building2,
  Building,
  Users,
  ShieldCheck
} from 'lucide-react';

interface ProjectMasterTabProps {
  company: any;
  branchId: string;
  projects: any[];
  clients: any[];
  suppliers: any[];
  billingProfiles: any[];
  employees: any[];
  onRefresh: () => void;
  onDeployWorker: (project: any) => void;
}

export function ProjectMasterTab({
  company,
  branchId,
  projects,
  clients,
  suppliers,
  billingProfiles,
  employees,
  onRefresh,
  onDeployWorker,
}: ProjectMasterTabProps) {
  const { language } = useI18n();
  const { addToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<any | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<any | null>(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [drawerProjectId, setDrawerProjectId] = useState<number | null>(null);

  // New Project Form State
  const [newProject, setNewProject] = useState({
    projectCode: '',
    nameEn: '',
    nameAr: '',
    projectType: 'General Contract',
    isSubcontract: false,
    clientId: '',
    principalSupplierId: '',
    billingProfileId: '',
    contractReference: '',
    principalReference: '',
    currency: company.baseCurrency || 'KWD',
    contractValue: '0.000',
    billingMethod: 'FIXED_CONTRACT',
    startDate: new Date().toISOString().slice(0, 10),
    plannedEndDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    projectManagerEmployeeId: '',
    description: '',
  });

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post(`/api/companies/${company.id}/projects`, {
        ...newProject,
        clientId: Number(newProject.clientId),
        principalSupplierId: newProject.principalSupplierId ? Number(newProject.principalSupplierId) : undefined,
        billingProfileId: Number(newProject.billingProfileId),
        branchId,
      });

      addToast({
        type: 'success',
        title: language === 'ar' ? 'تم إنشاء المشروع' : 'Project Established',
        message: language === 'ar' ? 'تم تسجيل المشروع وهوية الفوترة بنجاح' : 'Project master record created.',
      });
      setShowCreateModal(false);
      setNewProject({
        projectCode: '',
        nameEn: '',
        nameAr: '',
        projectType: 'General Contract',
        isSubcontract: false,
        clientId: '',
        principalSupplierId: '',
        billingProfileId: '',
        contractReference: '',
        principalReference: '',
        currency: company.baseCurrency || 'KWD',
        contractValue: '0.000',
        billingMethod: 'FIXED_CONTRACT',
        startDate: new Date().toISOString().slice(0, 10),
        plannedEndDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        projectManagerEmployeeId: '',
        description: '',
      });
      onRefresh();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message || 'Failed to create project' });
    }
  };

  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeClients = Array.isArray(clients) ? clients : [];
  const safeSuppliers = Array.isArray(suppliers) ? suppliers : [];
  const safeBillingProfiles = Array.isArray(billingProfiles) ? billingProfiles : [];
  const safeEmployees = Array.isArray(employees) ? employees : [];

  const filtered = safeProjects.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.projectCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.nameEn?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.nameAr?.includes(searchQuery) ||
      p.client?.nameEn?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const allSelected = filtered.length > 0 && filtered.every((p) => selectedProjectIds.includes(p.id));

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4 shadow-3xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold text-slate-950 uppercase tracking-wider">
            {language === 'ar' ? 'سجل المشاريع والعقود والتشغيل' : 'Projects & Contracts Master Ledger'}
          </h3>
          <p className="text-[11px] text-slate-500">
            {language === 'ar' ? 'إدارة المشاريع المباشرة ومشاريع الباطن، جهات الفوترة، وهيكل العمالة' : 'Direct client contracts, subcontracts with Principal companies, and billing entities.'}
          </p>
        </div>

        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <Button
            size="sm"
            variant="primary"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => {
              if (billingProfiles.length > 0 && !newProject.billingProfileId) {
                setNewProject((prev) => ({ ...prev, billingProfileId: String(billingProfiles[0].id) }));
              }
              setShowCreateModal(true);
            }}
          >
            {language === 'ar' ? 'مشروع جديد' : 'New Project'}
          </Button>
        </div>
      </div>

      {/* Search, Filter & Bulk Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <div className="w-64">
            <Input
              placeholder={language === 'ar' ? 'بحث بكود أو اسم المشروع...' : 'Search project code, name...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs"
            />
          </div>
          <div className="flex space-x-1 rtl:space-x-reverse text-[10px]">
            {['ALL', 'ACTIVE', 'PLANNED', 'ON_HOLD', 'COMPLETED', 'CLOSED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded font-bold transition cursor-pointer ${
                  statusFilter === st ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {selectedProjectIds.length > 0 && (
          <div className="p-1.5 bg-slate-900 text-white rounded flex items-center space-x-2 rtl:space-x-reverse text-xs">
            <span>{selectedProjectIds.length} {language === 'ar' ? 'محدد' : 'selected'}</span>
            <Button size="sm" variant="danger" onClick={() => setShowBulkDeleteModal(true)}>
              {language === 'ar' ? 'حذف / إغلاق جماعي' : 'Bulk Delete'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setSelectedProjectIds([])}>
              {language === 'ar' ? 'إلغاء' : 'Clear'}
            </Button>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-400">
          {language === 'ar' ? 'لا توجد مشاريع مسجلة حالياً.' : 'No project records found.'}
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left text-slate-900">
            <thead className="bg-slate-900 text-white uppercase text-[10px] font-bold">
              <tr>
                <th className="p-3 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedProjectIds(filtered.map((p) => p.id));
                      else setSelectedProjectIds([]);
                    }}
                    className="rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="p-3">Project Code</th>
                <th className="p-3">Project Name & Type</th>
                <th className="p-3">End Client</th>
                <th className="p-3">Principal / Partner</th>
                <th className="p-3">Billing Entity</th>
                <th className="p-3 text-right">Contract Value</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((proj) => {
                const isChecked = selectedProjectIds.includes(proj.id);
                const isSubcontract = !!proj.principalSupplierId;
                return (
                  <tr key={proj.id} className="hover:bg-slate-50">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedProjectIds((prev) => [...prev, proj.id]);
                          else setSelectedProjectIds((prev) => prev.filter((id) => id !== proj.id));
                        }}
                        className="rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                      />
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-900">{proj.projectCode}</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{language === 'ar' ? proj.nameAr : proj.nameEn}</div>
                      <div className="text-[10px] text-slate-500">{proj.projectType} • {proj.billingMethod}</div>
                    </td>
                    <td className="p-3 font-semibold text-slate-800">
                      {proj.client ? (language === 'ar' ? proj.client.nameAr : proj.client.nameEn) : `Client #${proj.clientId}`}
                    </td>
                    <td className="p-3">
                      {isSubcontract ? (
                        <div className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-medium inline-block">
                          {language === 'ar' ? proj.principalSupplier?.nameAr : proj.principalSupplier?.nameEn || 'Subcontract'}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Direct Contract</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="font-mono text-[11px] font-bold text-slate-800">
                        {proj.billingProfile?.profileName || 'Default'}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {proj.billingProfile?.isOperatingCompany ? 'Operating Company' : 'Principal Entity'}
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono font-bold">
                      {parseFloat(proj.contractValue || '0').toFixed(3)} {proj.currency}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          proj.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : proj.status === 'PLANNED'
                            ? 'bg-blue-100 text-blue-800'
                            : proj.status === 'COMPLETED'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {proj.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end space-x-1 rtl:space-x-reverse">
                        <button
                          onClick={() => setDrawerProjectId(proj.id)}
                          className="p-1 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100 cursor-pointer"
                          title="View Architecture Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setProjectToEdit(proj)}
                          className="p-1 text-slate-500 hover:text-blue-600 rounded hover:bg-slate-100 cursor-pointer"
                          title="Edit Project"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setProjectToDelete(proj)}
                          className="p-1 text-slate-500 hover:text-rose-600 rounded hover:bg-slate-100 cursor-pointer"
                          title="Delete / Archive Project"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE PROJECT MODAL */}
      {showCreateModal && (
        <Dialog
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title={language === 'ar' ? 'إنشاء مشروع وعقد جديد' : 'New Project & Contract Master'}
          size="lg"
        >
          <form onSubmit={handleCreateProject} className="space-y-4 p-1 text-xs">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Project Code</label>
                <Input
                  required
                  placeholder="PRJ-2026-001"
                  value={newProject.projectCode}
                  onChange={(e) => setNewProject({ ...newProject, projectCode: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Project Type</label>
                <Select
                  value={newProject.projectType}
                  onChange={(e) => setNewProject({ ...newProject, projectType: e.target.value })}
                >
                  <option value="General Contract">General Contract</option>
                  <option value="Subcontract">Subcontract (من الباطن)</option>
                  <option value="Construction">Construction</option>
                  <option value="Cleaning">Cleaning & Hospitality</option>
                  <option value="Maintenance">Facility Maintenance</option>
                  <option value="Labour Supply">Labour Supply (توريد عمالة)</option>
                  <option value="Service">Service Contract</option>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Billing Method</label>
                <Select
                  value={newProject.billingMethod}
                  onChange={(e) => setNewProject({ ...newProject, billingMethod: e.target.value })}
                >
                  <option value="FIXED_CONTRACT">Fixed Contract (مقطوع)</option>
                  <option value="MILESTONE">Milestone Progress</option>
                  <option value="MONTHLY_SERVICE">Monthly Service</option>
                  <option value="TIMESHEET_BASED">Timesheet / Man-hour Rate</option>
                  <option value="MANUAL">Manual Billing</option>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Currency</label>
                <Select
                  value={newProject.currency}
                  onChange={(e) => setNewProject({ ...newProject, currency: e.target.value })}
                >
                  <option value="KWD">KWD</option>
                  <option value="SAR">SAR</option>
                  <option value="AED">AED</option>
                  <option value="USD">USD</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Project Name (English)</label>
                <Input
                  required
                  placeholder="Facility Management Contract"
                  value={newProject.nameEn}
                  onChange={(e) => setNewProject({ ...newProject, nameEn: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">اسم المشروع (عربي)</label>
                <Input
                  required
                  placeholder="مشروع إدارة وتشغيل المرافق"
                  value={newProject.nameAr}
                  onChange={(e) => setNewProject({ ...newProject, nameAr: e.target.value })}
                />
              </div>
            </div>

            {/* Commercial Model Block */}
            <div className="p-3 bg-slate-50 border rounded-lg space-y-3">
              <div className="font-bold text-slate-900 uppercase text-[10px]">
                {language === 'ar' ? 'الأطراف التجارية وهوية الفوترة المعتمدة' : 'Commercial Model & Authorized Billing Identity'}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">End Client (العميل المستفيد)</label>
                  <Select
                    required
                    value={newProject.clientId}
                    onChange={(e) => setNewProject({ ...newProject, clientId: e.target.value })}
                  >
                    <option value="">-- Choose Client --</option>
                    {safeClients.map((c) => (
                      <option key={c.id} value={c.id}>{c.code} - {c.nameEn}</option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Principal / Main Contractor</label>
                  <Select
                    value={newProject.principalSupplierId}
                    onChange={(e) => setNewProject({ ...newProject, principalSupplierId: e.target.value })}
                  >
                    <option value="">-- Direct Project (No Principal) --</option>
                    {safeSuppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.code} - {s.nameEn}</option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Authorized Billing Profile</label>
                  <Select
                    required
                    value={newProject.billingProfileId}
                    onChange={(e) => setNewProject({ ...newProject, billingProfileId: e.target.value })}
                  >
                    <option value="">-- Choose Profile --</option>
                    {safeBillingProfiles.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.profileCode} - {b.profileName} {b.isOperatingCompany ? '(Operating Company)' : '(Principal External)'}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Contract Value</label>
                <Input
                  value={newProject.contractValue}
                  onChange={(e) => setNewProject({ ...newProject, contractValue: e.target.value })}
                  placeholder="0.000"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Start Date</label>
                <Input
                  type="date"
                  required
                  value={newProject.startDate}
                  onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Planned End Date</label>
                <Input
                  type="date"
                  value={newProject.plannedEndDate}
                  onChange={(e) => setNewProject({ ...newProject, plannedEndDate: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Project Manager</label>
                <Select
                  value={newProject.projectManagerEmployeeId}
                  onChange={(e) => setNewProject({ ...newProject, projectManagerEmployeeId: e.target.value })}
                >
                  <option value="">-- Unassigned --</option>
                  {safeEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.employeeNumber} - {emp.firstNameEn} {emp.lastNameEn}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="flex justify-end space-x-2 rtl:space-x-reverse pt-2 border-t">
              <Button variant="secondary" type="button" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Establish Project
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* EDIT MODAL */}
      {projectToEdit && (
        <ProjectEditModal
          isOpen={!!projectToEdit}
          onClose={() => setProjectToEdit(null)}
          project={projectToEdit}
          companyId={company.id}
          clients={clients}
          suppliers={suppliers}
          billingProfiles={billingProfiles}
          employees={employees}
          onSaved={onRefresh}
        />
      )}

      {/* PREFLIGHT DELETE MODAL */}
      {projectToDelete && (
        <ProjectPreflightDeleteModal
          isOpen={!!projectToDelete}
          onClose={() => setProjectToDelete(null)}
          project={projectToDelete}
          companyId={company.id}
          onDeleted={() => {
            setSelectedProjectIds((prev) => prev.filter((id) => id !== projectToDelete.id));
            onRefresh();
          }}
        />
      )}

      {/* BULK DELETE MODAL */}
      {showBulkDeleteModal && selectedProjectIds.length > 0 && (
        <ProjectBulkDeleteModal
          isOpen={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          projectIds={selectedProjectIds}
          companyId={company.id}
          onCompleted={() => {
            setSelectedProjectIds([]);
            onRefresh();
          }}
        />
      )}

      {/* DETAIL DRAWER */}
      {drawerProjectId && (
        <ProjectDetailDrawer
          isOpen={!!drawerProjectId}
          onClose={() => setDrawerProjectId(null)}
          projectId={drawerProjectId}
          companyId={company.id}
          onEdit={(p) => setProjectToEdit(p)}
          onDeployWorker={(p) => onDeployWorker(p)}
        />
      )}
    </div>
  );
}
