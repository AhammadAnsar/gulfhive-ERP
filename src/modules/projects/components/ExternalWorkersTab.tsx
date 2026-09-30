import React, { useState, useEffect } from 'react';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import { Button, Input, Select, Dialog, useToast, LoadingState } from '../../../design-system/index.ts';
import {
  Users,
  Plus,
  Search,
  CheckCircle,
  Clock,
  AlertTriangle,
  Building,
  Edit2,
  Trash2,
  FileText,
  BadgePercent,
  Layers,
  Phone,
  CreditCard,
  Building2,
  Briefcase
} from 'lucide-react';

interface ExternalWorkersTabProps {
  company: any;
  suppliers: any[];
  onRefresh: () => void;
  onDeployWorker?: (worker: any) => void;
}

export function ExternalWorkersTab({
  company,
  suppliers,
  onRefresh,
  onDeployWorker,
}: ExternalWorkersTabProps) {
  const { language } = useI18n();
  const { addToast } = useToast();

  const [externalWorkers, setExternalWorkers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('ALL');
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<number[]>([]);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingWorker, setEditingWorker] = useState<any | null>(null);
  const [deletingWorker, setDeletingWorker] = useState<any | null>(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Worker Form State
  const [newWorker, setNewWorker] = useState({
    workerCode: '',
    sourceSupplierId: '',
    nameEn: '',
    nameAr: '',
    profession: 'General Labourer',
    phone: '',
    identityDocumentType: 'Civil ID',
    identityDocumentNumber: '',
    defaultRate: '2.500',
    rateType: 'HOURLY', // HOURLY, DAILY, SHIFT, MONTHLY, FIXED
    currency: company.baseCurrency || 'KWD',
    availableFrom: new Date().toISOString().slice(0, 10),
    status: 'ACTIVE',
  });

  const fetchExternalWorkers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/projects/external-workers`);
      if (res.ok) {
        const data = await res.json();
        setExternalWorkers(Array.isArray(data) ? data : data.externalWorkers || []);
      }
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Failed to load external workers' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExternalWorkers();
  }, [company.id]);

  const handleCreateWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/projects/external-workers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newWorker,
          sourceSupplierId: Number(newWorker.sourceSupplierId),
        }),
      });

      if (res.ok) {
        addToast({
          type: 'success',
          title: language === 'ar' ? 'تم تسجيل العامل الخارجي' : 'External Worker Registered',
          message: language === 'ar' ? 'تمت إضافة العامل تحت جهة التوريد بنجاح' : 'Worker registered under workforce supplier.',
        });
        setShowCreateModal(false);
        fetchExternalWorkers();
        onRefresh();
      } else {
        const err = await res.json();
        addToast({ type: 'error', title: 'Error', message: err.message || 'Failed to add worker' });
      }
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Network error occurred' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorker) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/projects/external-workers/${editingWorker.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editingWorker,
          sourceSupplierId: Number(editingWorker.sourceSupplierId),
        }),
      });

      if (res.ok) {
        addToast({
          type: 'success',
          title: language === 'ar' ? 'تم تحديث بيانات العامل' : 'Worker Updated',
          message: language === 'ar' ? 'تم حفظ التعديلات بنجاح' : 'Worker profile updated successfully.',
        });
        setEditingWorker(null);
        fetchExternalWorkers();
        onRefresh();
      } else {
        const err = await res.json();
        addToast({ type: 'error', title: 'Error', message: err.message || 'Failed to update worker' });
      }
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Network error occurred' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteWorker = async (reason: string) => {
    if (!deletingWorker) return;
    try {
      const res = await fetch(`/api/companies/${company.id}/projects/external-workers/${deletingWorker.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (res.ok) {
        addToast({
          type: 'success',
          title: language === 'ar' ? 'تم حذف/أرشفة العامل' : 'Worker Removed',
          message: language === 'ar' ? 'تمت العملية بنجاح' : 'External worker successfully processed.',
        });
        setDeletingWorker(null);
        fetchExternalWorkers();
        onRefresh();
      } else {
        const err = await res.json();
        addToast({ type: 'error', title: 'Error', message: err.message || 'Failed to delete worker' });
      }
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Network error occurred' });
    }
  };

  const filteredWorkers = externalWorkers.filter((w) => {
    const matchesSearch =
      w.workerCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (w.nameAr && w.nameAr.toLowerCase().includes(searchQuery.toLowerCase())) ||
      w.profession.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (w.identityDocumentNumber && w.identityDocumentNumber.includes(searchQuery));

    const matchesSupplier = supplierFilter === 'ALL' || String(w.sourceSupplierId) === supplierFilter;

    return matchesSearch && matchesSupplier;
  });

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="bg-slate-900 text-white rounded-lg p-5 shadow-xs border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-bold tracking-wide">
              {language === 'ar' ? 'سجل القوى العاملة الخارجية ومقاولو التوريد' : 'External Workforce Master & Manpower Partners'}
            </h2>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            {language === 'ar'
              ? 'إدارة العمالة الخارجية التابعة لموردي العمالة والشركاء دون إدخالهم في كشوف رواتب الموظفين الداخليين. تحتسب مستحقاتهم عبر التسويات المالية وموديول المشتريات.'
              : 'External subcontract workforce records. Never converted to fake internal employees; time is settled directly via supplier accounts payable.'}
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 self-start sm:self-auto bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold"
        >
          <Plus className="w-4 h-4" />
          {language === 'ar' ? 'إضافة عامل خارجي' : 'New External Worker'}
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={language === 'ar' ? 'بحث بالكود، الاسم، المهنة، الرقم المدني...' : 'Search code, name, profession, Civil ID...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
            {language === 'ar' ? 'شركة التوريد:' : 'Supplier:'}
          </span>
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400"
          >
            <option value="ALL">{language === 'ar' ? 'جميع موردي العمالة' : 'All Manpower Suppliers'}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.code} - {s.nameEn}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Workers Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <LoadingState label={language === 'ar' ? 'جاري تحميل سجل العمالة الخارجية...' : 'Loading external workforce...'} />
          </div>
        ) : filteredWorkers.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <Users className="w-8 h-8 text-slate-300 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-800">
              {language === 'ar' ? 'لا يوجد عمال خارجيون مسجلون' : 'No External Workers Found'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {language === 'ar'
                ? 'قم بإضافة عمال خارجيين عندما يتم توريد قوى عاملة من شركات أو مقاولي باطن معتمدين.'
                : 'Add external workers when workforce is supplied by partner companies or manpower agencies.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3">{language === 'ar' ? 'كود العامل' : 'Worker Code'}</th>
                  <th className="py-2.5 px-3">{language === 'ar' ? 'الاسم' : 'Name'}</th>
                  <th className="py-2.5 px-3">{language === 'ar' ? 'شركة التوريد / الشريك' : 'Source Supplier'}</th>
                  <th className="py-2.5 px-3">{language === 'ar' ? 'المهنة' : 'Profession'}</th>
                  <th className="py-2.5 px-3 text-right">{language === 'ar' ? 'المعدل التجاري' : 'Standard Rate'}</th>
                  <th className="py-2.5 px-3">{language === 'ar' ? 'الإثبات' : 'Identity Doc'}</th>
                  <th className="py-2.5 px-3">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                  <th className="py-2.5 px-3 text-right">{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredWorkers.map((worker) => (
                  <tr key={worker.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-medium text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 font-mono">
                          {worker.workerCode}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{worker.nameEn}</div>
                      {worker.nameAr && <div className="text-[11px] text-slate-500" dir="rtl">{worker.nameAr}</div>}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1 text-slate-700">
                        <Building2 className="w-3.5 h-3.5 text-amber-600" />
                        <span>{worker.supplier ? worker.supplier.nameEn : 'Manpower Partner'}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {worker.profession}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {Number(worker.defaultRate || 0).toLocaleString('en-US', { minimumFractionDigits: 3 })}{' '}
                      <span className="text-[10px] text-slate-500 font-normal">
                        {worker.currency}/{worker.rateType}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[11px] font-mono text-slate-600">
                      {worker.identityDocumentNumber || '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {worker.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setEditingWorker(worker)}
                          className="p-1 text-slate-600 hover:text-slate-900"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setDeletingWorker(worker)}
                          className="p-1 text-rose-600 hover:text-rose-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Worker Modal */}
      {showCreateModal && (
        <Dialog
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title={language === 'ar' ? 'إضافة عامل خارجي جديد' : 'Register External Manpower Worker'}
          size="lg"
        >
          <form onSubmit={handleCreateWorker} className="space-y-4">
            <div className="p-3 bg-amber-50 rounded-md border border-amber-200 text-xs text-amber-900">
              {language === 'ar'
                ? 'تنبيه: العمال الخارجيون لا يتم احتسابهم كموظفين في نظام الرواتب، بل تتم تسوية ساعات عملهم كمصروفات موردين عبر موديول المشتريات.'
                : 'Notice: External workers belong to a workforce supplier/partner. Their approved hours flow into supplier settlements and AP bills, not employee payroll.'}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'كود العامل *' : 'Worker Code *'}</label>
                <Input
                  required
                  placeholder="e.g. EXT-2026-0001"
                  value={newWorker.workerCode}
                  onChange={(e) => setNewWorker({ ...newWorker, workerCode: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'شركة التوريد / الشريك *' : 'Source Supplier / Partner *'}</label>
                <Select
                  required
                  value={newWorker.sourceSupplierId}
                  onChange={(e) => setNewWorker({ ...newWorker, sourceSupplierId: e.target.value })}
                >
                  <option value="">{language === 'ar' ? '— اختر شركة التوريد —' : '— Select Supplier —'}</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.code} - {s.nameEn}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'الاسم الكامل (إنجليزي) *' : 'Full Name (EN) *'}</label>
                <Input
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={newWorker.nameEn}
                  onChange={(e) => setNewWorker({ ...newWorker, nameEn: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'الاسم الكامل (عربي)' : 'Full Name (AR)'}</label>
                <Input
                  dir="rtl"
                  placeholder="الاسم بالعربية"
                  value={newWorker.nameAr}
                  onChange={(e) => setNewWorker({ ...newWorker, nameAr: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'المهنة / المسمى *' : 'Profession *'}</label>
                <Input
                  required
                  placeholder="e.g. Mason, Electrician, Cleaner"
                  value={newWorker.profession}
                  onChange={(e) => setNewWorker({ ...newWorker, profession: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'المعدل القياسي' : 'Standard Rate'}</label>
                <Input
                  type="number"
                  step="0.001"
                  required
                  value={newWorker.defaultRate}
                  onChange={(e) => setNewWorker({ ...newWorker, defaultRate: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'نوع المعدل' : 'Rate Type'}</label>
                <Select
                  value={newWorker.rateType}
                  onChange={(e) => setNewWorker({ ...newWorker, rateType: e.target.value })}
                >
                  <option value="HOURLY">Hourly (بالساعة)</option>
                  <option value="DAILY">Daily (باليوم)</option>
                  <option value="SHIFT">Per Shift (بالمناوبة)</option>
                  <option value="MONTHLY">Monthly (شهري)</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'الرقم المدني / الإقامة' : 'Civil ID / Document No.'}</label>
                <Input
                  placeholder="Civil ID or Passport Number"
                  value={newWorker.identityDocumentNumber}
                  onChange={(e) => setNewWorker({ ...newWorker, identityDocumentNumber: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'رقم الهاتف' : 'Phone'}</label>
                <Input
                  placeholder="+965 ..."
                  value={newWorker.phone}
                  onChange={(e) => setNewWorker({ ...newWorker, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button variant="secondary" type="button" onClick={() => setShowCreateModal(false)}>
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button variant="primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : language === 'ar' ? 'حفظ العامل' : 'Save Worker'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Edit Worker Modal */}
      {editingWorker && (
        <Dialog
          isOpen={!!editingWorker}
          onClose={() => setEditingWorker(null)}
          title={`${language === 'ar' ? 'تعديل بيانات العامل الخارجي:' : 'Edit External Worker:'} ${editingWorker.nameEn}`}
          size="lg"
        >
          <form onSubmit={handleEditWorker} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'كود العامل' : 'Worker Code'}</label>
                <Input value={editingWorker.workerCode} readOnly className="bg-slate-50 font-mono" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'شركة التوريد *' : 'Source Supplier *'}</label>
                <Select
                  required
                  value={String(editingWorker.sourceSupplierId)}
                  onChange={(e) => setEditingWorker({ ...editingWorker, sourceSupplierId: Number(e.target.value) })}
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.code} - {s.nameEn}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'الاسم (إنجليزي) *' : 'Name (EN) *'}</label>
                <Input
                  required
                  value={editingWorker.nameEn}
                  onChange={(e) => setEditingWorker({ ...editingWorker, nameEn: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'الاسم (عربي)' : 'Name (AR)'}</label>
                <Input
                  dir="rtl"
                  value={editingWorker.nameAr || ''}
                  onChange={(e) => setEditingWorker({ ...editingWorker, nameAr: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'المهنة *' : 'Profession *'}</label>
                <Input
                  required
                  value={editingWorker.profession}
                  onChange={(e) => setEditingWorker({ ...editingWorker, profession: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'المعدل' : 'Rate'}</label>
                <Input
                  type="number"
                  step="0.001"
                  required
                  value={editingWorker.defaultRate}
                  onChange={(e) => setEditingWorker({ ...editingWorker, defaultRate: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">{language === 'ar' ? 'نوع المعدل' : 'Rate Type'}</label>
                <Select
                  value={editingWorker.rateType}
                  onChange={(e) => setEditingWorker({ ...editingWorker, rateType: e.target.value })}
                >
                  <option value="HOURLY">Hourly (بالساعة)</option>
                  <option value="DAILY">Daily (باليوم)</option>
                  <option value="SHIFT">Per Shift (بالمناوبة)</option>
                  <option value="MONTHLY">Monthly (شهري)</option>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button variant="secondary" type="button" onClick={() => setEditingWorker(null)}>
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button variant="primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : language === 'ar' ? 'حفظ التعديلات' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Delete / Archive Confirmation Modal */}
      {deletingWorker && (
        <Dialog
          isOpen={!!deletingWorker}
          onClose={() => setDeletingWorker(null)}
          title={language === 'ar' ? 'تأكيد إزالة العامل الخارجي' : 'Remove External Worker'}
          size="sm"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600 leading-relaxed">
              {language === 'ar'
                ? `هل أنت متأكد من رغبتك في إزالة العامل ${deletingWorker.nameEn} (${deletingWorker.workerCode})؟ سيتم التحقق من سجلات التشغيل والتسويات المالية وحماية البيانات التاريخية.`
                : `Are you sure you want to remove external worker ${deletingWorker.nameEn} (${deletingWorker.workerCode})? Operational and settlement history will be protected.`}
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setDeletingWorker(null)}>
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button variant="danger" onClick={() => handleDeleteWorker('Administrative removal')}>
                {language === 'ar' ? 'تأكيد الإزالة' : 'Confirm Removal'}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
