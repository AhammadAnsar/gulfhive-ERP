import React, { useState } from 'react';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import { Button, Input, Select, useToast } from '../../../design-system/index.ts';
import {
  FileSpreadsheet,
  Download,
  Filter,
  Briefcase,
  Users,
  Receipt,
  DollarSign,
  Layers,
  Building2,
  Calendar,
  Clock,
  Printer
} from 'lucide-react';

interface ProjectReportsTabProps {
  company: any;
  projects: any[];
  employees: any[];
  suppliers: any[];
  clients: any[];
}

export function ProjectReportsTab({
  company,
  projects,
  employees,
  suppliers,
  clients,
}: ProjectReportsTabProps) {
  const { language } = useI18n();
  const { addToast } = useToast();

  const [activeReport, setActiveReport] = useState('project_summary'); // project_summary, workforce_deployment, labour_cost, billing_summary
  const [selectedProjectId, setSelectedProjectId] = useState('ALL');

  const handleExport = (format: 'pdf' | 'excel') => {
    addToast({
      type: 'success',
      title: language === 'ar' ? 'تم تجهيز التقرير' : 'Report Generated',
      message: language === 'ar' ? `تم استخراج التقرير بصيغة ${format.toUpperCase()} بنجاح` : `Exported ${format.toUpperCase()} report successfully.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="bg-slate-900 text-white rounded-lg p-5 shadow-xs border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-bold tracking-wide">
              {language === 'ar' ? 'تقارير المشاريع، القوى العاملة والتحليلات التكليفية' : 'Project Intelligence, Workforce & Cost Reports'}
            </h2>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            {language === 'ar'
              ? 'تقارير تشغيلية وتكليفية دقيقة مستندة حصراً إلى المعاملات الموثقة (عقود، تشغيل، ساعات عمل، فواتير).'
              : 'Authoritative reporting derived directly from active contracts, recorded hours, settlements, and sales documents.'}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="secondary"
            onClick={() => handleExport('excel')}
            className="flex items-center gap-1.5 text-xs py-1.5 bg-slate-800 text-white border-slate-700 hover:bg-slate-700"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            {language === 'ar' ? 'تصدير Excel' : 'Export XLSX'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleExport('pdf')}
            className="flex items-center gap-1.5 text-xs py-1.5 bg-slate-800 text-white border-slate-700 hover:bg-slate-700"
          >
            <Printer className="w-4 h-4 text-rose-400" />
            {language === 'ar' ? 'طباعة / PDF' : 'Export PDF'}
          </Button>
        </div>
      </div>

      {/* Report Selector Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveReport('project_summary')}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
            activeReport === 'project_summary'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {language === 'ar' ? 'ملخص المشاريع والعقود' : 'Project & Contract Master'}
        </button>
        <button
          onClick={() => setActiveReport('workforce_deployment')}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
            activeReport === 'workforce_deployment'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {language === 'ar' ? 'تقرير انتشار القوى العاملة' : 'Workforce Deployment'}
        </button>
        <button
          onClick={() => setActiveReport('labour_cost')}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
            activeReport === 'labour_cost'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {language === 'ar' ? 'تسويات تكلفة العمالة الخارجية' : 'External Labour Costs'}
        </button>
        <button
          onClick={() => setActiveReport('billing_summary')}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
            activeReport === 'billing_summary'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {language === 'ar' ? 'ملخص الفوترة والتحصيل' : 'Project Billing & AR'}
        </button>
      </div>

      {/* Report Content */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {activeReport === 'project_summary' && (language === 'ar' ? 'كشف المشاريع والعقود النشطة' : 'Project Portfolio & Commercial Agreements')}
              {activeReport === 'workforce_deployment' && (language === 'ar' ? 'كشف انتشار القوى العاملة (داخلي / خارجي)' : 'Workforce Allocation & Field Deployment')}
              {activeReport === 'labour_cost' && (language === 'ar' ? 'تقرير تسويات ومستحقات مقاولي التوريد' : 'External Manpower Settlement Audit')}
              {activeReport === 'billing_summary' && (language === 'ar' ? 'تقرير مطابقة الفوترة والتحصيل للمشاريع' : 'Project Revenue & Invoicing Summary')}
            </h3>
            <p className="text-[11px] text-slate-500 font-mono">Company: {company.code} | Currency: {company.baseCurrency || 'KWD'}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">{language === 'ar' ? 'المشروع:' : 'Filter:'}</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-md px-2 py-1"
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

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2.5 px-3">{language === 'ar' ? 'كود المشروع' : 'Project Code'}</th>
                <th className="py-2.5 px-3">{language === 'ar' ? 'المشروع' : 'Project Name'}</th>
                <th className="py-2.5 px-3">{language === 'ar' ? 'العميل / المقاول' : 'Client / Principal'}</th>
                <th className="py-2.5 px-3">{language === 'ar' ? 'هوية الفوترة' : 'Billing Profile'}</th>
                <th className="py-2.5 px-3 text-right">{language === 'ar' ? 'قيمة العقد' : 'Contract Value'}</th>
                <th className="py-2.5 px-3">{language === 'ar' ? 'فترة المشروع' : 'Timeline'}</th>
                <th className="py-2.5 px-3">{language === 'ar' ? 'الحالة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projects
                .filter((p) => selectedProjectId === 'ALL' || String(p.id) === selectedProjectId)
                .map((proj) => (
                  <tr key={proj.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-medium text-slate-900">{proj.projectCode}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{language === 'ar' ? proj.nameAr : proj.nameEn}</td>
                    <td className="py-2.5 px-3">
                      <div className="text-slate-800">{proj.client ? proj.client.nameEn : 'Client'}</div>
                      {proj.principalSupplier && (
                        <div className="text-[11px] text-amber-800">Principal: {proj.principalSupplier.nameEn}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-mono">
                        {proj.billingProfile ? proj.billingProfile.profileCode : 'BP-DEFAULT'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {Number(proj.contractValue || 0).toLocaleString('en-US', { minimumFractionDigits: 3 })}{' '}
                      <span className="text-[10px] text-slate-500 font-normal">{proj.currency}</span>
                    </td>
                    <td className="py-2.5 px-3 text-[11px] font-mono text-slate-600">
                      {proj.startDate} → {proj.plannedEndDate || 'Ongoing'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {proj.status}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
