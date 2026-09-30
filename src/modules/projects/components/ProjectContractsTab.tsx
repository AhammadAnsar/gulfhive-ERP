import React, { useState } from 'react';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import { Button, Input, Select, Dialog, useToast } from '../../../design-system/index.ts';
import {
  FileText,
  Plus,
  Search,
  CheckCircle,
  Clock,
  AlertCircle,
  Building,
  Building2,
  Calendar,
  Layers,
  FileCheck,
  Percent,
  Coins
} from 'lucide-react';

interface ProjectContractsTabProps {
  company: any;
  projects: any[];
  clients: any[];
  suppliers: any[];
  onRefresh: () => void;
}

export function ProjectContractsTab({
  company,
  projects,
  clients,
  suppliers,
  onRefresh,
}: ProjectContractsTabProps) {
  const { language } = useI18n();
  const { addToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Contract Form State
  const [newContract, setNewContract] = useState({
    projectId: '',
    contractNumber: '',
    contractType: 'Direct Contract', // Direct Contract, Subcontract, Service Contract, Labour Supply Contract, Maintenance, Cleaning
    clientId: '',
    principalSupplierId: '',
    contractDate: new Date().toISOString().slice(0, 10),
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    contractValue: '0.000',
    currency: company.baseCurrency || 'KWD',
    billingMethod: 'FIXED_CONTRACT',
    paymentTerms: '30 Days Net',
    retentionPercentage: '5.00',
    notes: '',
  });

  // Extract all contracts from projects
  const allContracts: any[] = [];
  projects.forEach((proj) => {
    if (proj.contracts && proj.contracts.length > 0) {
      proj.contracts.forEach((c: any) => {
        allContracts.push({
          ...c,
          projectNameEn: proj.nameEn,
          projectNameAr: proj.nameAr,
          projectCode: proj.projectCode,
          projectClientId: proj.clientId,
          projectClient: proj.client,
        });
      });
    } else {
      allContracts.push({
        id: proj.id,
        projectId: proj.id,
        contractNumber: proj.contractReference || `CTR-${proj.projectCode}`,
        contractType: proj.projectType || 'Direct Contract',
        clientId: proj.clientId,
        client: proj.client,
        principalSupplierId: proj.principalSupplierId,
        principalSupplier: proj.principalSupplier,
        contractDate: proj.startDate,
        effectiveFrom: proj.startDate,
        effectiveTo: proj.plannedEndDate,
        contractValue: proj.contractValue || '0.000',
        currency: proj.currency || 'KWD',
        billingMethod: proj.billingMethod || 'FIXED_CONTRACT',
        retentionPercentage: '0.00',
        paymentTerms: 'Standard Terms',
        status: proj.status || 'ACTIVE',
        version: 1,
        projectNameEn: proj.nameEn,
        projectNameAr: proj.nameAr,
        projectCode: proj.projectCode,
      });
    }
  });

  const filteredContracts = allContracts.filter((c) => {
    const matchesSearch =
      c.contractNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.projectNameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.projectCode && c.projectCode.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesProject = selectedProjectId === 'ALL' || String(c.projectId) === selectedProjectId;

    return matchesSearch && matchesProject;
  });

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/projects/${newContract.projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractReference: newContract.contractNumber,
          contractValue: newContract.contractValue,
          billingMethod: newContract.billingMethod,
          plannedEndDate: newContract.effectiveTo,
        }),
      });

      if (res.ok) {
        addToast({
          type: 'success',
          title: language === 'ar' ? 'تم تسجيل العقد' : 'Contract Registered',
          message: language === 'ar' ? 'تم حفظ بيانات العقد بنجاح' : 'Project contract details registered.',
        });
        setShowCreateModal(false);
        onRefresh();
      } else {
        const err = await res.json();
        addToast({ type: 'error', title: 'Error', message: err.message || 'Failed to create contract' });
      }
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Network error occurred' });
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
            <FileText className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-bold tracking-wide">
              {language === 'ar' ? 'عقود المشاريع واتفاقيات المقاولات من الباطن' : 'Project Contracts & Subcontract Agreements'}
            </h2>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            {language === 'ar'
              ? 'إدارة العقود المباشرة وعقود المقاولة بالباطن وتوريد العمالة مع حفظ تاريخ التعديلات والملاحق.'
              : 'Multi-party commercial agreements with decimal-safe valuations, retention handling, and historical amendments.'}
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 self-start sm:self-auto bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold"
        >
          <Plus className="w-4 h-4" />
          {language === 'ar' ? 'تسجيل عقد جديد' : 'New Contract'}
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={language === 'ar' ? 'بحث برقم العقد، كود المشروع، اسم العميل...' : 'Search contract number, project, client...'}
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
                {p.projectCode} - {language === 'ar' ? p.nameAr : p.nameEn}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Contracts Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2.5 px-3">{language === 'ar' ? 'رقم العقد' : 'Contract #'}</th>
                <th className="py-2.5 px-3">{language === 'ar' ? 'المشروع المرتبط' : 'Project'}</th>
                <th className="py-2.5 px-3">{language === 'ar' ? 'نوع العقد' : 'Type'}</th>
                <th className="py-2.5 px-3">{language === 'ar' ? 'الأطراف التجارية' : 'Commercial Parties'}</th>
                <th className="py-2.5 px-3 text-right">{language === 'ar' ? 'قيمة العقد' : 'Contract Value'}</th>
                <th className="py-2.5 px-3">{language === 'ar' ? 'طريقة الفوترة' : 'Billing Method'}</th>
                <th className="py-2.5 px-3">{language === 'ar' ? 'فترة السريان' : 'Validity'}</th>
                <th className="py-2.5 px-3">{language === 'ar' ? 'الحالة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredContracts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    <FileCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    {language === 'ar' ? 'لا توجد عقود مسجلة' : 'No project contracts found.'}
                  </td>
                </tr>
              ) : (
                filteredContracts.map((ctr) => (
                  <tr key={`${ctr.projectId}-${ctr.contractNumber}`} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-medium text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        <span>{ctr.contractNumber}</span>
                        <span className="text-[10px] px-1 py-0.2 rounded bg-slate-100 text-slate-600 font-normal">
                          v{ctr.version || 1}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{language === 'ar' ? ctr.projectNameAr : ctr.projectNameEn}</div>
                      <div className="text-[11px] font-mono text-slate-500">{ctr.projectCode}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {ctr.contractType}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1 text-slate-700">
                          <Building className="w-3 h-3 text-blue-500" />
                          <span>Client: {ctr.client ? ctr.client.nameEn : 'Direct Client'}</span>
                        </div>
                        {ctr.principalSupplier && (
                          <div className="flex items-center gap-1 text-amber-800 text-[11px]">
                            <Building2 className="w-3 h-3 text-amber-600" />
                            <span>Principal: {ctr.principalSupplier.nameEn}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {Number(ctr.contractValue || 0).toLocaleString('en-US', { minimumFractionDigits: 3 })}{' '}
                      <span className="text-[10px] text-slate-500 font-normal">{ctr.currency}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-[11px] font-mono text-slate-600">
                        {ctr.billingMethod.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[11px] font-mono text-slate-600">
                      {ctr.effectiveFrom} → {ctr.effectiveTo || 'Ongoing'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {ctr.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Contract Modal */}
      {showCreateModal && (
        <Dialog
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title={language === 'ar' ? 'تسجيل عقد مشروع جديد' : 'Register Project Contract'}
          size="lg"
        >
          <form onSubmit={handleCreateContract} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'المشروع المستهدف *' : 'Target Project *'}</label>
              <Select
                required
                value={newContract.projectId}
                onChange={(e) => setNewContract({ ...newContract, projectId: e.target.value })}
              >
                <option value="">{language === 'ar' ? '— اختر المشروع —' : '— Select Project —'}</option>
                {projects.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.projectCode} - {p.nameEn} / {p.nameAr}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'رقم العقد *' : 'Contract Number *'}</label>
                <Input
                  required
                  placeholder="e.g. CTR-2026-0089"
                  value={newContract.contractNumber}
                  onChange={(e) => setNewContract({ ...newContract, contractNumber: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'نوع العقد *' : 'Contract Type *'}</label>
                <Select
                  value={newContract.contractType}
                  onChange={(e) => setNewContract({ ...newContract, contractType: e.target.value })}
                >
                  <option value="Direct Contract">Direct Contract (عقد مباشر مع العميل)</option>
                  <option value="Subcontract">Subcontract (عقد مقاولة بالباطن)</option>
                  <option value="Service Contract">Service Contract (عقد تقديم خدمات)</option>
                  <option value="Labour Supply Contract">Labour Supply Contract (عقد توريد عمالة)</option>
                  <option value="Maintenance Contract">Maintenance Contract (عقد صيانة)</option>
                  <option value="Cleaning Contract">Cleaning Contract (عقد نظافة وتشغيل)</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'قيمة العقد *' : 'Contract Value *'}</label>
                <Input
                  type="number"
                  step="0.001"
                  required
                  placeholder="0.000"
                  value={newContract.contractValue}
                  onChange={(e) => setNewContract({ ...newContract, contractValue: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'العملة' : 'Currency'}</label>
                <Input value={newContract.currency} readOnly className="bg-slate-50 font-mono" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'طريقة الفوترة' : 'Billing Method'}</label>
                <Select
                  value={newContract.billingMethod}
                  onChange={(e) => setNewContract({ ...newContract, billingMethod: e.target.value })}
                >
                  <option value="FIXED_CONTRACT">Fixed Lump Sum (قيمة إجمالية ثابتة)</option>
                  <option value="MILESTONE">Milestone Based (دفعات إنجاز)</option>
                  <option value="MONTHLY_SERVICE">Monthly Recurring (خدمة شهرية)</option>
                  <option value="TIMESHEET_BASED">Timesheet / Man-hour (حسب ساعات العمل)</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'ساري من تاريخ *' : 'Effective From *'}</label>
                <Input
                  type="date"
                  required
                  value={newContract.effectiveFrom}
                  onChange={(e) => setNewContract({ ...newContract, effectiveFrom: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'ساري إلى تاريخ' : 'Effective To'}</label>
                <Input
                  type="date"
                  value={newContract.effectiveTo}
                  onChange={(e) => setNewContract({ ...newContract, effectiveTo: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'شروط الدفع' : 'Payment Terms'}</label>
                <Input
                  placeholder="30 Days Net from Invoice Date"
                  value={newContract.paymentTerms}
                  onChange={(e) => setNewContract({ ...newContract, paymentTerms: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'نسبة الضمان المحتجز %' : 'Retention %'}</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="5.00"
                  value={newContract.retentionPercentage}
                  onChange={(e) => setNewContract({ ...newContract, retentionPercentage: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button variant="secondary" type="button" onClick={() => setShowCreateModal(false)}>
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button variant="primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : language === 'ar' ? 'حفظ العقد' : 'Register Contract'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
