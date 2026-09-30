import React, { useState } from 'react';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import { Button, Input, Select, Dialog, useToast } from '../../../design-system/index.ts';
import { SupplierEditModal } from './SupplierEditModal.tsx';
import { SupplierPreflightDeleteModal } from './SupplierPreflightDeleteModal.tsx';
import { SupplierBulkDeleteModal } from './SupplierBulkDeleteModal.tsx';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Search,
  CheckSquare,
  Square,
  Download,
  FileText,
  Building,
  Mail,
  Phone
} from 'lucide-react';

interface SupplierMasterTabProps {
  company: any;
  suppliers: any[];
  onRefresh: () => void;
}

export function SupplierMasterTab({ company, suppliers, onRefresh }: SupplierMasterTabProps) {
  const { language } = useI18n();
  const { addToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<number[]>([]);

  // Create Supplier Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    code: '',
    nameEn: '',
    nameAr: '',
    email: '',
    phone: '',
    crNumber: '',
    vatNumber: '',
    paymentTermsId: '30 Days',
    currency: company.baseCurrency || 'KWD',
  });

  // Edit & Delete Modals
  const [supplierToEdit, setSupplierToEdit] = useState<any | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<any | null>(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  // Statement State
  const [stmtSupplierId, setStmtSupplierId] = useState<number | null>(suppliers[0]?.id || null);
  const [stmtDateFrom, setStmtDateFrom] = useState('2026-01-01');
  const [stmtDateTo, setStmtDateTo] = useState('2026-12-31');
  const [stmtCurrency, setStmtCurrency] = useState(company.baseCurrency || 'KWD');
  const [activeStatement, setActiveStatement] = useState<any | null>(null);
  const [isLoadingStatement, setIsLoadingStatement] = useState(false);

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/companies/${company.id}/procurement/suppliers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSupplier),
      });
      if (res.ok) {
        addToast({
          type: 'success',
          title: language === 'ar' ? 'تم إنشاء المورد' : 'Supplier Created',
          message: language === 'ar' ? 'تم تسجيل بيانات المورد بنجاح' : 'Vendor registered successfully.',
        });
        setShowCreateModal(false);
        setNewSupplier({
          code: '',
          nameEn: '',
          nameAr: '',
          email: '',
          phone: '',
          crNumber: '',
          vatNumber: '',
          paymentTermsId: '30 Days',
          currency: company.baseCurrency || 'KWD',
        });
        onRefresh();
      } else {
        const err = await res.json();
        addToast({ type: 'error', title: 'Error', message: err.error || 'Failed to create supplier' });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message || 'Network error' });
    }
  };

  const handleQueryStatement = async () => {
    if (!stmtSupplierId) {
      addToast({ type: 'error', title: 'Error', message: 'Please select a vendor first' });
      return;
    }
    setIsLoadingStatement(true);
    try {
      const res = await fetch(
        `/api/companies/${company.id}/procurement/suppliers/${stmtSupplierId}/statement?dateFrom=${stmtDateFrom}&dateTo=${stmtDateTo}&currency=${stmtCurrency}`
      );
      if (res.ok) {
        const d = await res.json();
        setActiveStatement(d.statement);
      } else {
        const err = await res.json();
        addToast({ type: 'error', title: 'Error', message: err.error || 'Failed to fetch statement' });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingStatement(false);
    }
  };

  const filtered = suppliers.filter((s) => {
    const matchesSearch =
      !searchQuery ||
      s.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.nameEn?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.nameAr?.includes(searchQuery) ||
      s.crNumber?.includes(searchQuery);
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const allSelected = filtered.length > 0 && filtered.every((s) => selectedSupplierIds.includes(s.id));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Side: Supplier Master List */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3 shadow-3xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-950 uppercase tracking-wider">
              {language === 'ar' ? 'سجل الموردين (AP)' : 'Vendors Master Ledger'}
            </h3>
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setShowCreateModal(true)}
            >
              {language === 'ar' ? 'مورد جديد' : 'New Vendor'}
            </Button>
          </div>

          {/* Search and Filters */}
          <div className="space-y-2">
            <Input
              placeholder={language === 'ar' ? 'بحث بالاسم أو الكود...' : 'Search vendor code or name...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs"
            />
            <div className="flex space-x-1 rtl:space-x-reverse text-[10px]">
              {['ALL', 'ACTIVE', 'INACTIVE', 'BLOCKED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                    statusFilter === st ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Bulk Action Bar */}
          {selectedSupplierIds.length > 0 && (
            <div className="p-2 bg-slate-900 text-white rounded flex items-center justify-between text-xs">
              <span>{selectedSupplierIds.length} {language === 'ar' ? 'مورد محدد' : 'selected'}</span>
              <div className="flex space-x-1.5 rtl:space-x-reverse">
                <Button size="sm" variant="danger" onClick={() => setShowBulkDeleteModal(true)}>
                  {language === 'ar' ? 'حذف / أرشفة جماعية' : 'Bulk Delete'}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setSelectedSupplierIds([])}>
                  {language === 'ar' ? 'إلغاء' : 'Clear'}
                </Button>
              </div>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              {language === 'ar' ? 'لا يوجد موردون مسجلون.' : 'No vendors registered.'}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                <button
                  onClick={() => {
                    if (allSelected) setSelectedSupplierIds([]);
                    else setSelectedSupplierIds(filtered.map((s) => s.id));
                  }}
                  className="flex items-center space-x-1.5 rtl:space-x-reverse hover:text-slate-800 cursor-pointer font-semibold"
                >
                  {allSelected ? <CheckSquare className="w-3.5 h-3.5 text-slate-900" /> : <Square className="w-3.5 h-3.5" />}
                  <span>{language === 'ar' ? 'تحديد الكل' : 'Select All'} ({filtered.length})</span>
                </button>
              </div>

              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {filtered.map((sup) => {
                  const isChecked = selectedSupplierIds.includes(sup.id);
                  const isSelectedForStmt = stmtSupplierId === sup.id;
                  return (
                    <div
                      key={sup.id}
                      className={`p-2.5 rounded border text-left transition ${
                        isSelectedForStmt ? 'border-slate-950 bg-slate-50' : 'border-slate-200 hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 rtl:space-x-reverse">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              e.stopPropagation();
                              if (e.target.checked) setSelectedSupplierIds((prev) => [...prev, sup.id]);
                              else setSelectedSupplierIds((prev) => prev.filter((id) => id !== sup.id));
                            }}
                            className="rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                          />
                          <span
                            className="font-mono font-bold text-xs text-slate-900 cursor-pointer hover:underline"
                            onClick={() => {
                              setStmtSupplierId(sup.id);
                              setActiveStatement(null);
                            }}
                          >
                            {sup.code}
                          </span>
                        </div>
                        <span
                          className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded ${
                            sup.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : sup.status === 'BLOCKED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {sup.status}
                        </span>
                      </div>

                      <div
                        className="text-xs font-semibold text-slate-800 mt-1 cursor-pointer"
                        onClick={() => {
                          setStmtSupplierId(sup.id);
                          setActiveStatement(null);
                        }}
                      >
                        {language === 'ar' ? sup.nameAr : sup.nameEn}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                        <span>{sup.crNumber ? `CR: ${sup.crNumber}` : sup.currency || 'KWD'}</span>
                        <span>{sup.paymentTermsId || '30 Days'}</span>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100 text-xs">
                        <button
                          onClick={() => {
                            setStmtSupplierId(sup.id);
                            handleQueryStatement();
                          }}
                          className="text-[11px] text-slate-600 hover:text-slate-950 flex items-center space-x-1 rtl:space-x-reverse cursor-pointer font-medium"
                        >
                          <FileText className="w-3 h-3" />
                          <span>{language === 'ar' ? 'كشف الحساب' : 'Statement'}</span>
                        </button>
                        <div className="flex items-center space-x-1 rtl:space-x-reverse">
                          <button
                            onClick={() => setSupplierToEdit(sup)}
                            className="p-1 text-slate-500 hover:text-blue-600 rounded hover:bg-slate-100 cursor-pointer"
                            title="Edit Vendor"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setSupplierToDelete(sup)}
                            className="p-1 text-slate-500 hover:text-rose-600 rounded hover:bg-slate-100 cursor-pointer"
                            title="Delete Vendor"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Account Statement View */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 p-4 space-y-4 shadow-3xs">
          <h3 className="text-xs font-bold text-slate-950 uppercase tracking-wider border-b pb-2">
            {language === 'ar' ? 'كشف حساب المورد ودائنية الأستاذ العام' : 'Supplier Accounts Payable Statement'}
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Vendor</label>
              <Select
                value={stmtSupplierId || ''}
                onChange={(e) => setStmtSupplierId(Number(e.target.value))}
              >
                <option value="">-- Choose Vendor --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} - {language === 'ar' ? s.nameAr : s.nameEn}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">From Date</label>
              <Input type="date" value={stmtDateFrom} onChange={(e) => setStmtDateFrom(e.target.value)} />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">To Date</label>
              <Input type="date" value={stmtDateTo} onChange={(e) => setStmtDateTo(e.target.value)} />
            </div>

            <Button
              variant="primary"
              size="sm"
              leftIcon={<Search className="w-3.5 h-3.5" />}
              onClick={handleQueryStatement}
              disabled={isLoadingStatement}
            >
              {language === 'ar' ? 'عرض الكشف' : 'Query Statement'}
            </Button>
          </div>

          {activeStatement ? (
            <div className="space-y-4 border-t pt-4">
              <div className="flex flex-wrap items-center justify-between bg-slate-50 p-4 rounded border border-slate-200">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-slate-900">
                    {language === 'ar' ? activeStatement.supplier.nameAr : activeStatement.supplier.nameEn} ({activeStatement.supplier.code})
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Period: {activeStatement.dateFrom} to {activeStatement.dateTo}
                  </div>
                </div>

                <div className="flex space-x-4 rtl:space-x-reverse text-right">
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Opening AP</div>
                    <div className="text-xs font-bold text-slate-900 font-mono">
                      {parseFloat(activeStatement.openingBalance).toFixed(3)} {stmtCurrency}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Closing AP Balance</div>
                    <div className="text-xs font-bold text-rose-600 font-mono">
                      {parseFloat(activeStatement.closingBalance).toFixed(3)} {stmtCurrency}
                    </div>
                  </div>
                </div>

                <div className="flex space-x-2 rtl:space-x-reverse mt-2 sm:mt-0">
                  <a
                    href={`/api/companies/${company.id}/procurement/suppliers/${stmtSupplierId}/statement/pdf?dateFrom=${stmtDateFrom}&dateTo=${stmtDateTo}&currency=${stmtCurrency}`}
                    download
                    className="inline-flex items-center space-x-1 px-3 py-1.5 bg-slate-900 text-white rounded text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </a>
                  <a
                    href={`/api/companies/${company.id}/procurement/suppliers/${stmtSupplierId}/statement/excel?dateFrom=${stmtDateFrom}&dateTo=${stmtDateTo}&currency=${stmtCurrency}`}
                    download
                    className="inline-flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Excel</span>
                  </a>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs text-left text-slate-900">
                  <thead className="bg-slate-900 text-white uppercase text-[10px] font-bold">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Reference</th>
                      <th className="p-3">Description</th>
                      <th className="p-3 text-right">Debit (Payment/Debit Note)</th>
                      <th className="p-3 text-right">Credit (Supplier Bill)</th>
                      <th className="p-3 text-right">AP Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr className="bg-slate-100 font-bold">
                      <td className="p-3">{activeStatement.dateFrom}</td>
                      <td className="p-3 font-mono">OPENING</td>
                      <td className="p-3">Opening balance forward</td>
                      <td className="p-3 text-right">-</td>
                      <td className="p-3 text-right">-</td>
                      <td className="p-3 text-right font-mono">{parseFloat(activeStatement.openingBalance).toFixed(3)}</td>
                    </tr>
                    {activeStatement.items?.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-3">{row.date}</td>
                        <td className="p-3 font-mono font-bold text-slate-700">{row.reference}</td>
                        <td className="p-3">{row.description}</td>
                        <td className="p-3 text-right font-mono text-emerald-600">
                          {parseFloat(row.debit) > 0 ? parseFloat(row.debit).toFixed(3) : '-'}
                        </td>
                        <td className="p-3 text-right font-mono text-rose-600">
                          {parseFloat(row.credit) > 0 ? parseFloat(row.credit).toFixed(3) : '-'}
                        </td>
                        <td className="p-3 text-right font-mono font-bold">{parseFloat(row.balance).toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-16 text-center text-xs text-slate-400">
              {language === 'ar'
                ? 'اختر المورد والفترة الزمنية لعرض كشف حساب المشتريات والدفعات.'
                : 'Select a vendor and date range to view and export the AP ledger statement.'}
            </div>
          )}
        </div>
      </div>

      {/* CREATE SUPPLIER MODAL */}
      {showCreateModal && (
        <Dialog
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title={language === 'ar' ? 'تسجيل مورد جديد' : 'Register New Vendor'}
          size="md"
        >
          <form onSubmit={handleCreateSupplier} className="space-y-4 p-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Vendor Code</label>
                <Input
                  required
                  placeholder="VND-001"
                  value={newSupplier.code}
                  onChange={(e) => setNewSupplier({ ...newSupplier, code: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">CR Number</label>
                <Input
                  placeholder="198234"
                  value={newSupplier.crNumber}
                  onChange={(e) => setNewSupplier({ ...newSupplier, crNumber: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Vendor Name (English)</label>
              <Input
                required
                placeholder="Gulf Supplies LLC"
                value={newSupplier.nameEn}
                onChange={(e) => setNewSupplier({ ...newSupplier, nameEn: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">اسم المورد (عربي)</label>
              <Input
                required
                placeholder="شركة التوريدات الخليجية ذ.م.م"
                value={newSupplier.nameAr}
                onChange={(e) => setNewSupplier({ ...newSupplier, nameAr: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">VAT / Tax ID</label>
                <Input
                  placeholder="300000000000003"
                  value={newSupplier.vatNumber}
                  onChange={(e) => setNewSupplier({ ...newSupplier, vatNumber: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Payment Terms</label>
                <Select
                  value={newSupplier.paymentTermsId}
                  onChange={(e) => setNewSupplier({ ...newSupplier, paymentTermsId: e.target.value })}
                >
                  <option value="Immediate">Immediate</option>
                  <option value="15 Days">15 Days</option>
                  <option value="30 Days">30 Days</option>
                  <option value="60 Days">60 Days</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Email</label>
                <Input
                  type="email"
                  placeholder="orders@vendor.com"
                  value={newSupplier.email}
                  onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Phone</label>
                <Input
                  placeholder="+965 2200 0000"
                  value={newSupplier.phone}
                  onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 rtl:space-x-reverse pt-2 border-t border-slate-100">
              <Button variant="secondary" type="button" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Register Vendor
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* EDIT SUPPLIER MODAL */}
      {supplierToEdit && (
        <SupplierEditModal
          isOpen={!!supplierToEdit}
          onClose={() => setSupplierToEdit(null)}
          supplier={supplierToEdit}
          companyId={company.id}
          onSaved={onRefresh}
        />
      )}

      {/* PREFLIGHT DELETE MODAL */}
      {supplierToDelete && (
        <SupplierPreflightDeleteModal
          isOpen={!!supplierToDelete}
          onClose={() => setSupplierToDelete(null)}
          supplier={supplierToDelete}
          companyId={company.id}
          onDeleted={() => {
            if (stmtSupplierId === supplierToDelete.id) {
              setStmtSupplierId(null);
              setActiveStatement(null);
            }
            onRefresh();
          }}
        />
      )}

      {/* BULK DELETE MODAL */}
      {showBulkDeleteModal && selectedSupplierIds.length > 0 && (
        <SupplierBulkDeleteModal
          isOpen={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          supplierIds={selectedSupplierIds}
          companyId={company.id}
          onCompleted={() => {
            setSelectedSupplierIds([]);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
