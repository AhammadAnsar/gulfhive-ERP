import React, { useState, useEffect } from 'react';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import { Button, Input, Select, Dialog, useToast, LoadingState } from '../../../design-system/index.ts';
import {
  FileText,
  Plus,
  Search,
  CheckCircle,
  Receipt,
  Building2,
  Calendar,
  Layers,
  Coins,
  ArrowRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

interface LabourSettlementTabProps {
  company: any;
  projects: any[];
  suppliers: any[];
  onRefresh: () => void;
}

export function LabourSettlementTab({
  company,
  projects,
  suppliers,
  onRefresh,
}: LabourSettlementTabProps) {
  const { language } = useI18n();
  const { addToast } = useToast();

  const [settlements, setSettlements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('ALL');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Settlement Form State
  const [newSettlement, setNewSettlement] = useState({
    supplierId: '',
    projectId: '',
    periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    periodEnd: new Date().toISOString().slice(0, 10),
    totalApprovedHours: '160.0',
    totalAmount: '400.000',
    currency: company.baseCurrency || 'KWD',
    notes: '',
  });

  const fetchSettlements = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/projects/labour-settlements`);
      if (res.ok) {
        const data = await res.json();
        setSettlements(Array.isArray(data) ? data : data.labourSettlements || data.settlements || []);
      }
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Failed to load settlements' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettlements();
  }, [company.id]);

  const handleCreateSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/projects/labour-settlements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newSettlement,
          supplierId: Number(newSettlement.supplierId),
          projectId: Number(newSettlement.projectId),
        }),
      });

      if (res.ok) {
        addToast({
          type: 'success',
          title: language === 'ar' ? 'تم إنشاء كشف تسوية العمالة' : 'Settlement Created',
          message: language === 'ar' ? 'تم تجهيز مسودة كشف التسوية بنجاح' : 'Labour settlement draft generated.',
        });
        setShowCreateModal(false);
        fetchSettlements();
        onRefresh();
      } else {
        const err = await res.json();
        addToast({ type: 'error', title: 'Error', message: err.message || 'Failed to create settlement' });
      }
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Network error occurred' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveSettlement = async (settlementId: number) => {
    try {
      const res = await fetch(`/api/companies/${company.id}/projects/labour-settlements/${settlementId}/approve`, {
        method: 'POST',
      });

      if (res.ok) {
        addToast({
          type: 'success',
          title: language === 'ar' ? 'تم اعتماد التسوية' : 'Settlement Approved',
          message: language === 'ar' ? 'أصبحت التسوية جاهزة للترحيل لموديول المشتريات وفواتير الموردين' : 'Settlement approved for AP bill creation.',
        });
        fetchSettlements();
        onRefresh();
      }
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Approval failed' });
    }
  };

  const handleCreateSupplierBill = async (settlementId: number) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/projects/labour-settlements/${settlementId}/create-bill`, {
        method: 'POST',
      });

      if (res.ok) {
        const data = await res.json();
        addToast({
          type: 'success',
          title: language === 'ar' ? 'تم إنشاء فاتورة المورد في الحسابات الدائنة' : 'AP Supplier Bill Created',
          message: language === 'ar' ? `تم إصدار الفاتورة رقم ${data.bill?.billNumber || 'AP-BILL'} بنجاح` : `Bill ${data.bill?.billNumber || ''} created in Purchase & Payables.`,
        });
        fetchSettlements();
        onRefresh();
      } else {
        const err = await res.json();
        addToast({ type: 'error', title: 'Error', message: err.message || 'Failed to generate bill' });
      }
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Network error occurred' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSettlements = settlements.filter((s) => {
    const matchesSearch =
      s.settlementNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.supplier && s.supplier.nameEn.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesSupplier = supplierFilter === 'ALL' || String(s.supplierId) === supplierFilter;

    return matchesSearch && matchesSupplier;
  });

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="bg-slate-900 text-white rounded-lg p-5 shadow-xs border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-bold tracking-wide">
              {language === 'ar' ? 'تسويات القوى العاملة الخارجية وفواتير الموردين' : 'External Labour Settlements & Payables Integration'}
            </h2>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            {language === 'ar'
              ? 'احتساب مستحقات موردي العمالة بناءً على ساعات العمل المعتمدة ومعدلات الاتفاقيات، ثم ترحيلها بنقرة واحدة كفاتورة مورد في موديول المشتريات والحسابات الدائنة.'
              : 'Calculate supplier manpower dues from approved timesheets and post directly to Accounts Payable as traceable supplier bills.'}
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 self-start sm:self-auto bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold"
        >
          <Plus className="w-4 h-4" />
          {language === 'ar' ? 'إنشاء كشف تسوية' : 'New Labour Settlement'}
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={language === 'ar' ? 'بحث برقم التسوية، اسم المورد...' : 'Search settlement number, supplier...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
            {language === 'ar' ? 'المورد:' : 'Supplier:'}
          </span>
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400"
          >
            <option value="ALL">{language === 'ar' ? 'جميع الموردين' : 'All Suppliers'}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.code} - {s.nameEn}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Settlements Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <LoadingState label={language === 'ar' ? 'جاري تحميل التسويات المالية...' : 'Loading labour settlements...'} />
          </div>
        ) : filteredSettlements.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <Receipt className="w-8 h-8 text-slate-300 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-800">
              {language === 'ar' ? 'لا توجد كشوف تسوية مسجلة' : 'No Labour Settlements Found'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {language === 'ar'
                ? 'أنشئ كشف تسوية عمالة خارجية بعد اعتماد ساعات العمل لتصدير فاتورة مورد في الحسابات الدائنة.'
                : 'Create external labour settlements from approved timesheets to post supplier bills.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3">{language === 'ar' ? 'رقم التسوية' : 'Settlement #'}</th>
                  <th className="py-2.5 px-3">{language === 'ar' ? 'مورد العمالة' : 'Workforce Supplier'}</th>
                  <th className="py-2.5 px-3">{language === 'ar' ? 'المشروع' : 'Project'}</th>
                  <th className="py-2.5 px-3">{language === 'ar' ? 'الفترة' : 'Billing Period'}</th>
                  <th className="py-2.5 px-3 text-right">{language === 'ar' ? 'الساعات المعتمدة' : 'Approved Hours'}</th>
                  <th className="py-2.5 px-3 text-right">{language === 'ar' ? 'إجمالي المستحق' : 'Total Amount'}</th>
                  <th className="py-2.5 px-3">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                  <th className="py-2.5 px-3 text-right">{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSettlements.map((s) => {
                  const targetProj = projects.find((p) => p.id === s.projectId);

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-slate-400" />
                          <span>{s.settlementNumber}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{s.supplier ? s.supplier.nameEn : 'Supplier'}</div>
                        <div className="text-[11px] font-mono text-slate-500">{s.supplier?.code || ''}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-900">{targetProj ? targetProj.nameEn : `Project #${s.projectId}`}</div>
                        <div className="text-[11px] font-mono text-slate-500">{targetProj?.projectCode || ''}</div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 text-[11px]">
                        {s.periodStart} → {s.periodEnd}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-800">
                        {Number(s.totalApprovedHours || 0).toFixed(1)} hrs
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {Number(s.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 3 })}{' '}
                        <span className="text-[10px] text-slate-500 font-normal">{s.currency}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            s.status === 'BILLED'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : s.status === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {s.status === 'DRAFT' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleApproveSettlement(s.id)}
                              className="text-xs py-1 px-2 text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              {language === 'ar' ? 'اعتماد' : 'Approve'}
                            </Button>
                          )}
                          {s.status === 'APPROVED' && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleCreateSupplierBill(s.id)}
                              disabled={isSubmitting}
                              className="text-xs py-1 px-2.5 bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                              {language === 'ar' ? 'إنشاء فاتورة مورد' : 'Post AP Bill'}
                            </Button>
                          )}
                          {s.status === 'BILLED' && (
                            <span className="text-[11px] font-mono text-emerald-700 flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                              {language === 'ar' ? 'مرحلة للحسابات' : 'Posted to AP'}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Settlement Modal */}
      {showCreateModal && (
        <Dialog
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title={language === 'ar' ? 'إنشاء كشف تسوية عمالة خارجية' : 'Create External Labour Settlement'}
          size="lg"
        >
          <form onSubmit={handleCreateSettlement} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'مورد العمالة *' : 'Workforce Supplier *'}</label>
                <Select
                  required
                  value={newSettlement.supplierId}
                  onChange={(e) => setNewSettlement({ ...newSettlement, supplierId: e.target.value })}
                >
                  <option value="">{language === 'ar' ? '— اختر المورد —' : '— Select Supplier —'}</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.code} - {s.nameEn}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'المشروع *' : 'Project *'}</label>
                <Select
                  required
                  value={newSettlement.projectId}
                  onChange={(e) => setNewSettlement({ ...newSettlement, projectId: e.target.value })}
                >
                  <option value="">{language === 'ar' ? '— اختر المشروع —' : '— Select Project —'}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.projectCode} - {p.nameEn}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'بداية الفترة *' : 'Period Start *'}</label>
                <Input
                  type="date"
                  required
                  value={newSettlement.periodStart}
                  onChange={(e) => setNewSettlement({ ...newSettlement, periodStart: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'نهاية الفترة *' : 'Period End *'}</label>
                <Input
                  type="date"
                  required
                  value={newSettlement.periodEnd}
                  onChange={(e) => setNewSettlement({ ...newSettlement, periodEnd: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'إجمالي الساعات المعتمدة *' : 'Approved Hours *'}</label>
                <Input
                  type="number"
                  step="0.5"
                  required
                  value={newSettlement.totalApprovedHours}
                  onChange={(e) => setNewSettlement({ ...newSettlement, totalApprovedHours: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'المبلغ الإجمالي المستحق *' : 'Total Amount *'}</label>
                <Input
                  type="number"
                  step="0.001"
                  required
                  value={newSettlement.totalAmount}
                  onChange={(e) => setNewSettlement({ ...newSettlement, totalAmount: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'ملاحظات التسوية' : 'Settlement Notes'}</label>
              <Input
                placeholder="Monthly manpower timesheet reconciliation"
                value={newSettlement.notes}
                onChange={(e) => setNewSettlement({ ...newSettlement, notes: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button variant="secondary" type="button" onClick={() => setShowCreateModal(false)}>
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button variant="primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : language === 'ar' ? 'إنشاء كشف التسوية' : 'Create Settlement'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
