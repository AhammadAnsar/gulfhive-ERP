import React, { useState } from 'react';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import { Button, Input, Select, Dialog, useToast } from '../../../design-system/index.ts';
import {
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  Building,
  Building2,
  UserCheck,
  Search,
  CheckSquare,
  FileCheck,
  Plus
} from 'lucide-react';

interface ProjectTimeTabProps {
  company: any;
  projects: any[];
  employees: any[];
  onRefresh: () => void;
}

export function ProjectTimeTab({
  company,
  projects,
  employees,
  onRefresh,
}: ProjectTimeTabProps) {
  const { language } = useI18n();
  const { addToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [showLogTimeModal, setShowLogTimeModal] = useState(false);

  // Sample or state-based project timesheet rows
  const [timesheetEntries, setTimesheetEntries] = useState<any[]>([]);

  const [newTimeEntry, setNewTimeEntry] = useState({
    projectId: '',
    workforceType: 'INTERNAL_EMPLOYEE',
    workerId: '',
    workerName: '',
    date: new Date().toISOString().slice(0, 10),
    regularHours: '8.0',
    overtimeHours: '0.0',
    activity: 'General Operations',
    status: 'APPROVED',
  });

  const handleLogTime = (e: React.FormEvent) => {
    e.preventDefault();
    const proj = projects.find((p) => String(p.id) === newTimeEntry.projectId);
    const entry = {
      id: Date.now(),
      projectId: Number(newTimeEntry.projectId),
      projectName: proj ? proj.nameEn : 'Project',
      projectCode: proj ? proj.projectCode : 'PRJ',
      workforceType: newTimeEntry.workforceType,
      workerName: newTimeEntry.workerName || 'Worker',
      date: newTimeEntry.date,
      regularHours: Number(newTimeEntry.regularHours),
      overtimeHours: Number(newTimeEntry.overtimeHours),
      totalHours: Number(newTimeEntry.regularHours) + Number(newTimeEntry.overtimeHours),
      activity: newTimeEntry.activity,
      status: 'APPROVED',
    };

    setTimesheetEntries([entry, ...timesheetEntries]);
    addToast({
      type: 'success',
      title: language === 'ar' ? 'تم تسجيل ساعات العمل' : 'Project Time Logged',
      message: language === 'ar' ? 'تم تخصيص ساعات العمل للمشروع بنجاح' : 'Hours successfully logged and allocated.',
    });
    setShowLogTimeModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="bg-slate-900 text-white rounded-lg p-5 shadow-xs border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-bold tracking-wide">
              {language === 'ar' ? 'تخصيص ساعات العمل وسجلات الحضور للمشاريع' : 'Project Timesheets & Unified Labour Allocation'}
            </h2>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            {language === 'ar'
              ? 'تخصيص موحد لساعات عمل الفريق المشترك (موظفون داخليون + عمالة خارجية). ساعات الموظف الداخلي توجه لاحتساب الرواتب، وساعات العامل الخارجي توجه لتسوية فواتير الموردين.'
              : 'Unified timesheet engine. Routes internal hours to payroll costing and external hours to supplier payable settlements.'}
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowLogTimeModal(true)}
          className="flex items-center gap-1.5 self-start sm:self-auto bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold"
        >
          <Plus className="w-4 h-4" />
          {language === 'ar' ? 'تسجيل ساعات عمل' : 'Log Project Time'}
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={language === 'ar' ? 'بحث باسم العامل، النشاط، كود المشروع...' : 'Search worker, activity, project...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
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
            <option value="INTERNAL">{language === 'ar' ? 'موظف داخلي' : 'Internal'}</option>
            <option value="EXTERNAL">{language === 'ar' ? 'عامل خارجي' : 'External'}</option>
          </select>
        </div>
      </div>

      {/* Timesheet Summary Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2.5 px-3">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                <th className="py-2.5 px-3">{language === 'ar' ? 'العامل' : 'Worker'}</th>
                <th className="py-2.5 px-3">{language === 'ar' ? 'المصدر' : 'Source'}</th>
                <th className="py-2.5 px-3">{language === 'ar' ? 'المشروع' : 'Project'}</th>
                <th className="py-2.5 px-3">{language === 'ar' ? 'النشاط' : 'Activity'}</th>
                <th className="py-2.5 px-3 text-right">{language === 'ar' ? 'الساعات العادية' : 'Regular (h)'}</th>
                <th className="py-2.5 px-3 text-right">{language === 'ar' ? 'الإضافي' : 'Overtime (h)'}</th>
                <th className="py-2.5 px-3 text-right">{language === 'ar' ? 'الإجمالي' : 'Total (h)'}</th>
                <th className="py-2.5 px-3">{language === 'ar' ? 'مسار التسوية' : 'Cost Destination'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {timesheetEntries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <FileCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    {language === 'ar' ? 'لا توجد ساعات عمل مسجلة في هذه الفترة' : 'No timesheet entries recorded.'}
                  </td>
                </tr>
              ) : (
                timesheetEntries.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-slate-700">{row.date}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-900">{row.workerName}</td>
                    <td className="py-2.5 px-3">
                      {row.workforceType === 'INTERNAL_EMPLOYEE' ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-800 border border-blue-200">
                          Internal
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-800 border border-amber-200">
                          External
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-900">{row.projectName}</td>
                    <td className="py-2.5 px-3 text-slate-600">{row.activity}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-800">{row.regularHours.toFixed(1)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-800">{row.overtimeHours.toFixed(1)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{row.totalHours.toFixed(1)}</td>
                    <td className="py-2.5 px-3">
                      {row.workforceType === 'INTERNAL_EMPLOYEE' ? (
                        <span className="text-[11px] text-blue-700 font-medium">→ Payroll Engine</span>
                      ) : (
                        <span className="text-[11px] text-amber-700 font-medium">→ Supplier AP Settlement</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Time Modal */}
      {showLogTimeModal && (
        <Dialog
          isOpen={showLogTimeModal}
          onClose={() => setShowLogTimeModal(false)}
          title={language === 'ar' ? 'تسجيل ساعات عمل للمشروع' : 'Log Project Time & Attendance'}
          size="md"
        >
          <form onSubmit={handleLogTime} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'المشروع *' : 'Project *'}</label>
              <Select
                required
                value={newTimeEntry.projectId}
                onChange={(e) => setNewTimeEntry({ ...newTimeEntry, projectId: e.target.value })}
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
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'نوع العامل *' : 'Workforce Type *'}</label>
                <Select
                  value={newTimeEntry.workforceType}
                  onChange={(e) => setNewTimeEntry({ ...newTimeEntry, workforceType: e.target.value })}
                >
                  <option value="INTERNAL_EMPLOYEE">Internal Employee (رواتب)</option>
                  <option value="EXTERNAL_WORKER">External Worker (تسوية مورد)</option>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'اسم العامل *' : 'Worker Name *'}</label>
                <Input
                  required
                  placeholder="e.g. Employee or External Worker Name"
                  value={newTimeEntry.workerName}
                  onChange={(e) => setNewTimeEntry({ ...newTimeEntry, workerName: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'التاريخ *' : 'Date *'}</label>
                <Input
                  type="date"
                  required
                  value={newTimeEntry.date}
                  onChange={(e) => setNewTimeEntry({ ...newTimeEntry, date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'ساعات عادية *' : 'Regular (h) *'}</label>
                <Input
                  type="number"
                  step="0.5"
                  required
                  value={newTimeEntry.regularHours}
                  onChange={(e) => setNewTimeEntry({ ...newTimeEntry, regularHours: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'إضافي (h)' : 'Overtime (h)'}</label>
                <Input
                  type="number"
                  step="0.5"
                  value={newTimeEntry.overtimeHours}
                  onChange={(e) => setNewTimeEntry({ ...newTimeEntry, overtimeHours: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'النشاط / بند العمل' : 'Activity / Task'}</label>
              <Input
                value={newTimeEntry.activity}
                onChange={(e) => setNewTimeEntry({ ...newTimeEntry, activity: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button variant="secondary" type="button" onClick={() => setShowLogTimeModal(false)}>
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button variant="primary" type="submit">
                {language === 'ar' ? 'حفظ الساعات' : 'Log Hours'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
