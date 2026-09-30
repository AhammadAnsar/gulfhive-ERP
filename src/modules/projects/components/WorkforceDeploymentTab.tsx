import React, { useState, useEffect } from 'react';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import { Button, Input, Select, Dialog, useToast, LoadingState } from '../../../design-system/index.ts';
import {
  Users,
  Plus,
  Search,
  CheckCircle,
  ArrowRightLeft,
  Building,
  Building2,
  Calendar,
  Layers,
  Clock,
  UserCheck,
  ShieldAlert,
  Trash2,
  XCircle,
  Briefcase,
  MapPin
} from 'lucide-react';

interface WorkforceDeploymentTabProps {
  company: any;
  projects: any[];
  employees: any[];
  onRefresh: () => void;
}

export function WorkforceDeploymentTab({
  company,
  projects,
  employees,
  onRefresh,
}: WorkforceDeploymentTabProps) {
  const { language } = useI18n();
  const { addToast } = useToast();

  const [deployments, setDeployments] = useState<any[]>([]);
  const [externalWorkers, setExternalWorkers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL'); // ALL, INTERNAL, EXTERNAL
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, ACTIVE, COMPLETED, TRANSFERRED

  // Modals
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [showBulkDeployModal, setShowBulkDeployModal] = useState(false);
  const [transferringDeployment, setTransferringDeployment] = useState<any | null>(null);
  const [endingDeployment, setEndingDeployment] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Single Deploy Form State
  const [newDeploy, setNewDeploy] = useState({
    projectId: '',
    workforceType: 'INTERNAL_EMPLOYEE' as 'INTERNAL_EMPLOYEE' | 'EXTERNAL_WORKER',
    employeeId: '',
    externalWorkerId: '',
    position: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    deploymentType: 'REGULAR',
    rateOverride: '',
    rateType: 'HOURLY',
    currency: company.baseCurrency || 'KWD',
  });

  // Bulk Deploy Form State
  const [bulkDeploy, setBulkDeploy] = useState({
    projectId: '',
    workforceType: 'INTERNAL_EMPLOYEE' as 'INTERNAL_EMPLOYEE' | 'EXTERNAL_WORKER',
    selectedWorkerIds: [] as string[],
    position: 'Project Operative',
    startDate: new Date().toISOString().slice(0, 10),
    deploymentType: 'REGULAR',
  });

  // Transfer Form State
  const [transferData, setTransferData] = useState({
    toProjectId: '',
    transferDate: new Date().toISOString().slice(0, 10),
    newPosition: '',
    reason: '',
  });

  // End Form State
  const [endData, setEndData] = useState({
    endDate: new Date().toISOString().slice(0, 10),
    reason: 'Project phase completed',
  });

  const fetchDeployments = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/projects/deployments`);
      if (res.ok) {
        const data = await res.json();
        setDeployments(Array.isArray(data) ? data : data.deployments || []);
      }
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Failed to load deployments' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchExternalWorkers = async () => {
    try {
      const res = await fetch(`/api/companies/${company.id}/projects/external-workers`);
      if (res.ok) {
        const data = await res.json();
        setExternalWorkers(Array.isArray(data) ? data : data.externalWorkers || []);
      }
    } catch {
      console.error('Failed to load external workers for deployment lookup');
    }
  };

  useEffect(() => {
    fetchDeployments();
    fetchExternalWorkers();
  }, [company.id]);

  const handleCreateDeployment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/projects/deployments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newDeploy,
          projectId: Number(newDeploy.projectId),
          employeeId: newDeploy.workforceType === 'INTERNAL_EMPLOYEE' ? newDeploy.employeeId : null,
          externalWorkerId: newDeploy.workforceType === 'EXTERNAL_WORKER' ? Number(newDeploy.externalWorkerId) : null,
        }),
      });

      if (res.ok) {
        addToast({
          type: 'success',
          title: language === 'ar' ? 'تم تشغيل العامل بالمشروع' : 'Worker Deployed',
          message: language === 'ar' ? 'تم تعيين العامل في المشروع بنجاح' : 'Workforce deployment activated successfully.',
        });
        setShowDeployModal(false);
        fetchDeployments();
        onRefresh();
      } else {
        const err = await res.json();
        addToast({ type: 'error', title: 'Error', message: err.message || 'Failed to deploy worker' });
      }
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Network error occurred' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkDeploy.selectedWorkerIds.length === 0) {
      addToast({ type: 'warning', title: 'Warning', message: 'Please select at least one worker' });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/projects/deployments/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...bulkDeploy,
          projectId: Number(bulkDeploy.projectId),
          employeeIds: bulkDeploy.workforceType === 'INTERNAL_EMPLOYEE' ? bulkDeploy.selectedWorkerIds : [],
          externalWorkerIds: bulkDeploy.workforceType === 'EXTERNAL_WORKER' ? bulkDeploy.selectedWorkerIds.map(Number) : [],
        }),
      });

      if (res.ok) {
        addToast({
          type: 'success',
          title: language === 'ar' ? 'تم التشغيل الجماعي' : 'Bulk Deployment Successful',
          message: language === 'ar' ? 'تم نشر مجموعة العمال في المشروع' : 'Workers assigned to project team.',
        });
        setShowBulkDeployModal(false);
        fetchDeployments();
        onRefresh();
      } else {
        const err = await res.json();
        addToast({ type: 'error', title: 'Error', message: err.message || 'Bulk deployment failed' });
      }
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Network error occurred' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferringDeployment) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/projects/deployments/${transferringDeployment.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toProjectId: Number(transferData.toProjectId),
          transferDate: transferData.transferDate,
          newPosition: transferData.newPosition,
          reason: transferData.reason,
        }),
      });

      if (res.ok) {
        addToast({
          type: 'success',
          title: language === 'ar' ? 'تم نقل العامل' : 'Worker Transferred',
          message: language === 'ar' ? 'تم إنهاء التشغيل السابق وبدء تشغيل جديد بالمشروع المستهدف' : 'Previous assignment closed and new deployment opened atomically.',
        });
        setTransferringDeployment(null);
        fetchDeployments();
        onRefresh();
      } else {
        const err = await res.json();
        addToast({ type: 'error', title: 'Error', message: err.message || 'Transfer failed' });
      }
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Network error occurred' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEndDeployment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!endingDeployment) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/projects/deployments/${endingDeployment.id}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(endData),
      });

      if (res.ok) {
        addToast({
          type: 'success',
          title: language === 'ar' ? 'تم إنهاء التشغيل بالمشروع' : 'Deployment Completed',
          message: language === 'ar' ? 'تم تسجيل تاريخ الإنهاء وتحديث السجل' : 'Assignment ended with history retained.',
        });
        setEndingDeployment(null);
        fetchDeployments();
        onRefresh();
      } else {
        const err = await res.json();
        addToast({ type: 'error', title: 'Error', message: err.message || 'Failed to end deployment' });
      }
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Network error occurred' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredDeployments = deployments.filter((d) => {
    const workerName = d.workerName || (d.employee ? d.employee.firstNameEn : '') || (d.externalWorker ? d.externalWorker.nameEn : '');
    const workerCode = d.workerCode || (d.employee ? d.employee.employeeNumber : '') || (d.externalWorker ? d.externalWorker.workerCode : '');

    const matchesSearch =
      workerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      workerCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.position && d.position.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesProject = projectFilter === 'ALL' || String(d.projectId) === projectFilter;
    const matchesSource =
      sourceFilter === 'ALL' ||
      (sourceFilter === 'INTERNAL' && d.workforceType === 'INTERNAL_EMPLOYEE') ||
      (sourceFilter === 'EXTERNAL' && d.workforceType === 'EXTERNAL_WORKER');
    const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter;

    return matchesSearch && matchesProject && matchesSource && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="bg-slate-900 text-white rounded-lg p-5 shadow-xs border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-bold tracking-wide">
              {language === 'ar' ? 'محرك تشغيل القوى العاملة والفرق المشتركة بالمشاريع' : 'Unified Workforce Deployment & Mixed Project Teams'}
            </h2>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            {language === 'ar'
              ? 'تشغيل مشترك للموظفين الداخليين والعمالة الخارجية على نفس المشاريع والمواقع مع توجيه ساعات العمل للرواتب أو للتسويات المالية بدقة تامة.'
              : 'Deploy mixed internal employees and external manpower to projects. Automatically partitions costs between payroll and supplier payables.'}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="secondary"
            onClick={() => setShowBulkDeployModal(true)}
            className="flex items-center gap-1 text-xs py-1.5 bg-slate-800 text-white border-slate-700 hover:bg-slate-700"
          >
            <Layers className="w-4 h-4 text-amber-400" />
            {language === 'ar' ? 'تشغيل جماعي' : 'Bulk Deploy'}
          </Button>
          <Button
            variant="primary"
            onClick={() => setShowDeployModal(true)}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs py-1.5"
          >
            <Plus className="w-4 h-4" />
            {language === 'ar' ? 'تشغيل عامل' : 'Deploy Worker'}
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={language === 'ar' ? 'بحث باسم العامل، الكود، المسمى بالمشروع...' : 'Search worker name, code, position...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400"
          >
            <option value="ALL">{language === 'ar' ? 'جميع المشاريع' : 'All Projects'}</option>
            {projects.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.projectCode} - {p.nameEn}
              </option>
            ))}
          </select>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400"
          >
            <option value="ALL">{language === 'ar' ? 'جميع المصادر' : 'All Workforce'}</option>
            <option value="INTERNAL">{language === 'ar' ? 'موظف داخلي' : 'Internal Employee'}</option>
            <option value="EXTERNAL">{language === 'ar' ? 'عامل خارجي' : 'External Worker'}</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400"
          >
            <option value="ALL">{language === 'ar' ? 'جميع الحالات' : 'All Statuses'}</option>
            <option value="ACTIVE">{language === 'ar' ? 'قيد العمل (نشط)' : 'Active'}</option>
            <option value="COMPLETED">{language === 'ar' ? 'منتهي' : 'Completed'}</option>
            <option value="TRANSFERRED">{language === 'ar' ? 'تم نقله' : 'Transferred'}</option>
          </select>
        </div>
      </div>

      {/* Deployments Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <LoadingState label={language === 'ar' ? 'جاري تحميل سجل تشغيل القوى العاملة...' : 'Loading workforce deployments...'} />
          </div>
        ) : filteredDeployments.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <Users className="w-8 h-8 text-slate-300 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-800">
              {language === 'ar' ? 'لا توجد سجلات تشغيل مطابقة' : 'No Deployments Found'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {language === 'ar'
                ? 'قم بتشغيل الموظفين الداخليين أو العمال الخارجيين على المشاريع لتتبع الحضور وتكلفة التشغيل.'
                : 'Deploy workforce members to start capturing project hours, attendance and labour costs.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3">{language === 'ar' ? 'العامل' : 'Worker'}</th>
                  <th className="py-2.5 px-3">{language === 'ar' ? 'مصدر القوة العاملة' : 'Workforce Source'}</th>
                  <th className="py-2.5 px-3">{language === 'ar' ? 'المشروع والموقع' : 'Project & Site'}</th>
                  <th className="py-2.5 px-3">{language === 'ar' ? 'المسمى بالمشروع' : 'Assigned Position'}</th>
                  <th className="py-2.5 px-3">{language === 'ar' ? 'فترة التشغيل' : 'Deployment Period'}</th>
                  <th className="py-2.5 px-3">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                  <th className="py-2.5 px-3 text-right">{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDeployments.map((d) => {
                  const isInternal = d.workforceType === 'INTERNAL_EMPLOYEE';
                  const targetProj = projects.find((p) => p.id === d.projectId);

                  return (
                    <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">
                          {d.workerName || (isInternal && d.employee ? `${d.employee.firstNameEn} ${d.employee.lastNameEn}` : d.externalWorker ? d.externalWorker.nameEn : 'Worker')}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {d.workerCode || (isInternal && d.employee ? d.employee.employeeNumber : d.externalWorker ? d.externalWorker.workerCode : '')}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        {isInternal ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-800 border border-blue-200">
                            <UserCheck className="w-3 h-3 text-blue-600" />
                            {language === 'ar' ? 'موظف داخلي (رواتب)' : 'Internal (Payroll)'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                            <Building2 className="w-3 h-3 text-amber-600" />
                            {language === 'ar' ? 'عمالة خارجية (مورد)' : 'External (Payable)'}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-900">
                          {targetProj ? (language === 'ar' ? targetProj.nameAr : targetProj.nameEn) : `Project #${d.projectId}`}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {targetProj?.projectCode || ''}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {d.position || d.deploymentType}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[11px] font-mono text-slate-600">
                        {d.startDate} → {d.endDate || 'Active'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            d.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : d.status === 'TRANSFERRED'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          {d.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {d.status === 'ACTIVE' && (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setTransferringDeployment(d)}
                              className="text-xs py-1 px-2 flex items-center gap-1 text-purple-700 hover:text-purple-800"
                            >
                              <ArrowRightLeft className="w-3 h-3" />
                              {language === 'ar' ? 'نقل' : 'Transfer'}
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setEndingDeployment(d)}
                              className="text-xs py-1 px-2 flex items-center gap-1 text-slate-600 hover:text-slate-900"
                            >
                              <XCircle className="w-3 h-3 text-rose-500" />
                              {language === 'ar' ? 'إنهاء' : 'End'}
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Single Deploy Modal */}
      {showDeployModal && (
        <Dialog
          isOpen={showDeployModal}
          onClose={() => setShowDeployModal(false)}
          title={language === 'ar' ? 'تشغيل عامل على مشروع' : 'Deploy Worker to Project'}
          size="lg"
        >
          <form onSubmit={handleCreateDeployment} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'المشروع المستهدف *' : 'Target Project *'}</label>
              <Select
                required
                value={newDeploy.projectId}
                onChange={(e) => setNewDeploy({ ...newDeploy, projectId: e.target.value })}
              >
                <option value="">{language === 'ar' ? '— اختر المشروع —' : '— Select Project —'}</option>
                {projects.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.projectCode} - {p.nameEn}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'مصدر القوة العاملة *' : 'Workforce Source *'}</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setNewDeploy({ ...newDeploy, workforceType: 'INTERNAL_EMPLOYEE' })}
                  className={`p-2.5 text-xs rounded-md border text-center font-medium transition-all ${
                    newDeploy.workforceType === 'INTERNAL_EMPLOYEE'
                      ? 'bg-blue-50 border-blue-500 text-blue-900 ring-1 ring-blue-500'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <UserCheck className="w-4 h-4 mx-auto mb-1 text-blue-600" />
                  {language === 'ar' ? 'موظف داخلي (رواتب)' : 'Internal Employee (Payroll)'}
                </button>
                <button
                  type="button"
                  onClick={() => setNewDeploy({ ...newDeploy, workforceType: 'EXTERNAL_WORKER' })}
                  className={`p-2.5 text-xs rounded-md border text-center font-medium transition-all ${
                    newDeploy.workforceType === 'EXTERNAL_WORKER'
                      ? 'bg-amber-50 border-amber-500 text-amber-900 ring-1 ring-amber-500'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Building2 className="w-4 h-4 mx-auto mb-1 text-amber-600" />
                  {language === 'ar' ? 'عامل خارجي (مورد باطن)' : 'External Worker (Subcontract)'}
                </button>
              </div>
            </div>

            {newDeploy.workforceType === 'INTERNAL_EMPLOYEE' ? (
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'الموظف الداخلي *' : 'Internal Employee *'}</label>
                <Select
                  required
                  value={newDeploy.employeeId}
                  onChange={(e) => setNewDeploy({ ...newDeploy, employeeId: e.target.value })}
                >
                  <option value="">{language === 'ar' ? '— اختر الموظف —' : '— Select Employee —'}</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.employeeNumber} - {emp.firstNameEn} {emp.lastNameEn}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'العامل الخارجي *' : 'External Worker *'}</label>
                <Select
                  required
                  value={newDeploy.externalWorkerId}
                  onChange={(e) => setNewDeploy({ ...newDeploy, externalWorkerId: e.target.value })}
                >
                  <option value="">{language === 'ar' ? '— اختر العامل الخارجي —' : '— Select External Worker —'}</option>
                  {externalWorkers.map((w) => (
                    <option key={w.id} value={String(w.id)}>
                      {w.workerCode} - {w.nameEn} ({w.profession})
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'المسمى / الوظيفة بالمشروع' : 'Position in Project'}</label>
                <Input
                  placeholder="e.g. Site Supervisor, Operative"
                  value={newDeploy.position}
                  onChange={(e) => setNewDeploy({ ...newDeploy, position: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'نوع التشغيل' : 'Deployment Type'}</label>
                <Select
                  value={newDeploy.deploymentType}
                  onChange={(e) => setNewDeploy({ ...newDeploy, deploymentType: e.target.value })}
                >
                  <option value="REGULAR">Regular (تشغيل كامل)</option>
                  <option value="PART_TIME">Part-Time (تشغيل جزئي)</option>
                  <option value="TEMPORARY">Temporary (مؤقت)</option>
                  <option value="RELIEF">Relief (تغطية بديلة)</option>
                  <option value="EMERGENCY">Emergency (طوارئ)</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'تاريخ بدء التشغيل *' : 'Start Date *'}</label>
                <Input
                  type="date"
                  required
                  value={newDeploy.startDate}
                  onChange={(e) => setNewDeploy({ ...newDeploy, startDate: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'تاريخ الانتهاء المخطط' : 'Planned End Date'}</label>
                <Input
                  type="date"
                  value={newDeploy.endDate}
                  onChange={(e) => setNewDeploy({ ...newDeploy, endDate: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button variant="secondary" type="button" onClick={() => setShowDeployModal(false)}>
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button variant="primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : language === 'ar' ? 'تأكيد التشغيل' : 'Confirm Deployment'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Bulk Deploy Modal */}
      {showBulkDeployModal && (
        <Dialog
          isOpen={showBulkDeployModal}
          onClose={() => setShowBulkDeployModal(false)}
          title={language === 'ar' ? 'التشغيل الجماعي للقوى العاملة' : 'Bulk Workforce Deployment'}
          size="lg"
        >
          <form onSubmit={handleBulkDeploy} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'المشروع المستهدف *' : 'Target Project *'}</label>
              <Select
                required
                value={bulkDeploy.projectId}
                onChange={(e) => setBulkDeploy({ ...bulkDeploy, projectId: e.target.value })}
              >
                <option value="">{language === 'ar' ? '— اختر المشروع —' : '— Select Project —'}</option>
                {projects.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.projectCode} - {p.nameEn}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'نوع القوة العاملة *' : 'Workforce Pool *'}</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setBulkDeploy({ ...bulkDeploy, workforceType: 'INTERNAL_EMPLOYEE', selectedWorkerIds: [] })}
                  className={`p-2 text-xs rounded border text-center font-medium ${
                    bulkDeploy.workforceType === 'INTERNAL_EMPLOYEE'
                      ? 'bg-blue-50 border-blue-500 text-blue-900'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  {language === 'ar' ? 'موظفون داخليون' : 'Internal Employees'}
                </button>
                <button
                  type="button"
                  onClick={() => setBulkDeploy({ ...bulkDeploy, workforceType: 'EXTERNAL_WORKER', selectedWorkerIds: [] })}
                  className={`p-2 text-xs rounded border text-center font-medium ${
                    bulkDeploy.workforceType === 'EXTERNAL_WORKER'
                      ? 'bg-amber-50 border-amber-500 text-amber-900'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  {language === 'ar' ? 'عمالة خارجية' : 'External Workers'}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">
                {language === 'ar' ? 'حدد العمال المطلوب تشغيلهم *' : 'Select Workers to Deploy *'}
              </label>
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-md p-2 divide-y divide-slate-100 mt-1 bg-slate-50">
                {bulkDeploy.workforceType === 'INTERNAL_EMPLOYEE' ? (
                  employees.map((emp) => (
                    <label key={emp.id} className="flex items-center gap-2 py-1.5 px-2 hover:bg-white rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bulkDeploy.selectedWorkerIds.includes(emp.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBulkDeploy({ ...bulkDeploy, selectedWorkerIds: [...bulkDeploy.selectedWorkerIds, emp.id] });
                          } else {
                            setBulkDeploy({ ...bulkDeploy, selectedWorkerIds: bulkDeploy.selectedWorkerIds.filter((id) => id !== emp.id) });
                          }
                        }}
                        className="rounded border-slate-300 text-slate-900"
                      />
                      <span className="text-xs text-slate-800 font-medium">
                        {emp.employeeNumber} - {emp.firstNameEn} {emp.lastNameEn}
                      </span>
                    </label>
                  ))
                ) : (
                  externalWorkers.map((w) => (
                    <label key={w.id} className="flex items-center gap-2 py-1.5 px-2 hover:bg-white rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bulkDeploy.selectedWorkerIds.includes(String(w.id))}
                        onChange={(e) => {
                          const sid = String(w.id);
                          if (e.target.checked) {
                            setBulkDeploy({ ...bulkDeploy, selectedWorkerIds: [...bulkDeploy.selectedWorkerIds, sid] });
                          } else {
                            setBulkDeploy({ ...bulkDeploy, selectedWorkerIds: bulkDeploy.selectedWorkerIds.filter((id) => id !== sid) });
                          }
                        }}
                        className="rounded border-slate-300 text-slate-900"
                      />
                      <span className="text-xs text-slate-800 font-medium">
                        {w.workerCode} - {w.nameEn} ({w.profession})
                      </span>
                    </label>
                  ))
                )}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Selected: <span className="font-bold text-slate-800">{bulkDeploy.selectedWorkerIds.length}</span> workers
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'المسمى المشترك' : 'Common Position'}</label>
                <Input
                  value={bulkDeploy.position}
                  onChange={(e) => setBulkDeploy({ ...bulkDeploy, position: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'تاريخ البدء *' : 'Start Date *'}</label>
                <Input
                  type="date"
                  required
                  value={bulkDeploy.startDate}
                  onChange={(e) => setBulkDeploy({ ...bulkDeploy, startDate: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button variant="secondary" type="button" onClick={() => setShowBulkDeployModal(false)}>
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button variant="primary" type="submit" disabled={isSubmitting || bulkDeploy.selectedWorkerIds.length === 0}>
                {isSubmitting ? (language === 'ar' ? 'جاري التشغيل...' : 'Deploying...') : language === 'ar' ? 'تنفيذ التشغيل الجماعي' : 'Execute Bulk Deploy'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Transfer Worker Modal */}
      {transferringDeployment && (
        <Dialog
          isOpen={!!transferringDeployment}
          onClose={() => setTransferringDeployment(null)}
          title={language === 'ar' ? 'نقل العامل لمشروع آخر' : 'Transfer Worker to Another Project'}
          size="md"
        >
          <form onSubmit={handleTransfer} className="space-y-4">
            <div className="p-3 bg-purple-50 rounded-md border border-purple-200 text-xs text-purple-900">
              {language === 'ar'
                ? `سيتم إغلاق التشغيل الحالي للعامل (${transferringDeployment.workerName || 'Worker'}) وفتح سجل تشغيل جديد للمشروع المستهدف بشكل متزامن دون فقدان التاريخ.`
                : 'Atomic transfer: previous deployment is archived and a new active assignment is opened.'}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'المشروع الجديد المستهدف *' : 'Destination Project *'}</label>
              <Select
                required
                value={transferData.toProjectId}
                onChange={(e) => setTransferData({ ...transferData, toProjectId: e.target.value })}
              >
                <option value="">{language === 'ar' ? '— اختر المشروع —' : '— Select Project —'}</option>
                {projects
                  .filter((p) => p.id !== transferringDeployment.projectId)
                  .map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.projectCode} - {p.nameEn}
                    </option>
                  ))}
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'تاريخ النقل *' : 'Transfer Date *'}</label>
                <Input
                  type="date"
                  required
                  value={transferData.transferDate}
                  onChange={(e) => setTransferData({ ...transferData, transferDate: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'المسمى الجديد' : 'New Position'}</label>
                <Input
                  placeholder="e.g. Lead Operative"
                  value={transferData.newPosition}
                  onChange={(e) => setTransferData({ ...transferData, newPosition: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'سبب النقل' : 'Transfer Reason'}</label>
              <Input
                placeholder="Operational manpower redistribution"
                value={transferData.reason}
                onChange={(e) => setTransferData({ ...transferData, reason: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button variant="secondary" type="button" onClick={() => setTransferringDeployment(null)}>
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button variant="primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? (language === 'ar' ? 'جاري النقل...' : 'Transferring...') : language === 'ar' ? 'تنفيذ النقل' : 'Confirm Transfer'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* End Assignment Modal */}
      {endingDeployment && (
        <Dialog
          isOpen={!!endingDeployment}
          onClose={() => setEndingDeployment(null)}
          title={language === 'ar' ? 'إنهاء تشغيل العامل بالمشروع' : 'End Project Assignment'}
          size="md"
        >
          <form onSubmit={handleEndDeployment} className="space-y-4">
            <p className="text-xs text-slate-600">
              {language === 'ar'
                ? `تسجيل تاريخ نهاية مهمة العامل ${endingDeployment.workerName || 'Worker'} بالمشروع.`
                : `Set assignment completion date for ${endingDeployment.workerName || 'Worker'}.`}
            </p>

            <div>
              <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'تاريخ الانتهاء *' : 'End Date *'}</label>
              <Input
                type="date"
                required
                value={endData.endDate}
                onChange={(e) => setEndData({ ...endData, endDate: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'ملاحظات الإنهاء' : 'Completion Notes'}</label>
              <Input
                value={endData.reason}
                onChange={(e) => setEndData({ ...endData, reason: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button variant="secondary" type="button" onClick={() => setEndingDeployment(null)}>
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button variant="danger" type="submit" disabled={isSubmitting}>
                {isSubmitting ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : language === 'ar' ? 'تأكيد الإنهاء' : 'End Assignment'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
