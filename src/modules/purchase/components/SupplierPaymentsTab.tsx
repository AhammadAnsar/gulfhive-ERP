import React, { useState } from 'react';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import { Button, Input, Select, Dialog, useToast } from '../../../design-system/index.ts';
import { CreditCard, Plus, CheckCircle, Eye, FileText } from 'lucide-react';

interface SupplierPaymentsTabProps {
  company: any;
  branchId: string;
  suppliers: any[];
  bills: any[];
  payments: any[];
  onRefresh: () => void;
}

export function SupplierPaymentsTab({
  company,
  branchId,
  suppliers,
  bills,
  payments,
  onRefresh,
}: SupplierPaymentsTabProps) {
  const { language } = useI18n();
  const { addToast } = useToast();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);

  const [newPayment, setNewPayment] = useState({
    supplierId: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    currency: company.baseCurrency || 'KWD',
    paymentMethod: 'BANK_TRANSFER',
    amount: '0.000',
    notes: '',
    allocations: [] as { supplierBillId: number; billNumber: string; outstanding: string; amount: string }[],
  });

  const handleSelectSupplierForPayment = (supplierIdStr: string) => {
    const sId = Number(supplierIdStr);
    const unpaidBills = bills.filter(
      (b) => b.supplierId === sId && b.status === 'POSTED' && parseFloat(b.outstandingAmount || '1') > 0
    );

    const mapped = unpaidBills.map((b) => ({
      supplierBillId: b.id,
      billNumber: b.billNumber,
      outstanding: b.outstandingAmount,
      amount: '0.000',
    }));

    setNewPayment({
      ...newPayment,
      supplierId: supplierIdStr,
      allocations: mapped,
    });
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const activeAllocs = newPayment.allocations
        .filter((a) => parseFloat(a.amount) > 0)
        .map((a) => ({ supplierBillId: a.supplierBillId, amount: a.amount }));

      const res = await fetch(`/api/companies/${company.id}/procurement/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: Number(newPayment.supplierId),
          paymentDate: newPayment.paymentDate,
          currency: newPayment.currency,
          paymentMethod: newPayment.paymentMethod,
          amount: newPayment.amount,
          notes: newPayment.notes,
          allocations: activeAllocs,
          branchId,
        }),
      });

      if (res.ok) {
        addToast({
          type: 'success',
          title: language === 'ar' ? 'تم تسجيل سند الصرف' : 'Vendor Payment Posted',
          message: language === 'ar' ? 'تم تسوية الفواتير وتحديث رصيد المورد' : 'Payment and bill allocations recorded.',
        });
        setShowCreateModal(false);
        setNewPayment({
          supplierId: '',
          paymentDate: new Date().toISOString().slice(0, 10),
          currency: company.baseCurrency || 'KWD',
          paymentMethod: 'BANK_TRANSFER',
          amount: '0.000',
          notes: '',
          allocations: [],
        });
        onRefresh();
      } else {
        const err = await res.json();
        addToast({ type: 'error', title: 'Error', message: err.error || 'Failed to post payment' });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message || 'Network error' });
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4 shadow-3xs">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-slate-950 uppercase tracking-wider">
            {language === 'ar' ? 'سندات الصرف وتسوية الموردين (AP Payments)' : 'Supplier Payments & Bill Allocations'}
          </h3>
          <p className="text-[11px] text-slate-500">
            {language === 'ar' ? 'سداد مستحقات الموردين وتوزيع الدفعات على فواتير المشتريات' : 'Issue remittance vouchers, settle open AP bills, and manage vendor credits.'}
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => setShowCreateModal(true)}
        >
          {language === 'ar' ? 'سند صرف جديد' : 'New Payment Voucher'}
        </Button>
      </div>

      {payments.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-400">
          {language === 'ar' ? 'لا توجد سندات صرف مسجلة.' : 'No supplier payment vouchers recorded.'}
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left text-slate-900">
            <thead className="bg-slate-900 text-white uppercase text-[10px] font-bold">
              <tr>
                <th className="p-3">Voucher #</th>
                <th className="p-3">Vendor</th>
                <th className="p-3">Payment Date</th>
                <th className="p-3">Method</th>
                <th className="p-3 text-right">Amount Paid</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {payments.map((p) => {
                const sup = suppliers.find((s) => s.id === p.supplierId);
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-slate-900">{p.paymentNumber}</td>
                    <td className="p-3 font-semibold">{sup ? (language === 'ar' ? sup.nameAr : sup.nameEn) : `Vendor #${p.supplierId}`}</td>
                    <td className="p-3 text-slate-600">{p.paymentDate}</td>
                    <td className="p-3 text-slate-700 font-medium">{p.paymentMethod}</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-600">
                      {parseFloat(p.amount).toFixed(3)} {p.currency}
                    </td>
                    <td className="p-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                        {p.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="secondary" onClick={() => setSelectedPayment(p)}>
                        <Eye className="w-3 h-3 mr-1" />
                        <span>View</span>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE PAYMENT MODAL */}
      {showCreateModal && (
        <Dialog
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title={language === 'ar' ? 'تسجيل سند صرف لمورد' : 'Issue Vendor Payment Voucher'}
          size="lg"
        >
          <form onSubmit={handleCreatePayment} className="space-y-4 p-1 text-xs">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Vendor</label>
                <Select
                  required
                  value={newPayment.supplierId}
                  onChange={(e) => handleSelectSupplierForPayment(e.target.value)}
                >
                  <option value="">-- Choose Vendor --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.code} - {s.nameEn}</option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Payment Date</label>
                <Input
                  type="date"
                  required
                  value={newPayment.paymentDate}
                  onChange={(e) => setNewPayment({ ...newPayment, paymentDate: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Payment Method</label>
                <Select
                  value={newPayment.paymentMethod}
                  onChange={(e) => setNewPayment({ ...newPayment, paymentMethod: e.target.value })}
                >
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CHECK">Cheque</option>
                  <option value="CASH">Cash</option>
                  <option value="CREDIT_CARD">Credit Card</option>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Currency</label>
                <Select
                  value={newPayment.currency}
                  onChange={(e) => setNewPayment({ ...newPayment, currency: e.target.value })}
                >
                  <option value="KWD">KWD</option>
                  <option value="SAR">SAR</option>
                  <option value="AED">AED</option>
                  <option value="USD">USD</option>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Total Amount Paid / المبلغ المدفوع</label>
              <Input
                required
                placeholder="0.000"
                value={newPayment.amount}
                onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
              />
            </div>

            {/* Bill Allocations */}
            <div className="space-y-2 border-t pt-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase">Settle Outstanding Bills</h4>
              {newPayment.allocations.length === 0 ? (
                <div className="p-4 bg-slate-50 border rounded text-center text-slate-400">
                  No open posted bills found for this vendor. Unallocated amount will remain as credit.
                </div>
              ) : (
                <div className="space-y-2 max-h-[180px] overflow-y-auto">
                  {newPayment.allocations.map((alloc, idx) => (
                    <div key={idx} className="grid grid-cols-3 gap-2 items-center bg-slate-50 p-2 rounded border">
                      <div className="font-mono font-bold text-slate-800">{alloc.billNumber}</div>
                      <div className="text-slate-500">
                        Outstanding: <span className="font-bold text-slate-800">{parseFloat(alloc.outstanding).toFixed(3)}</span>
                      </div>
                      <div>
                        <Input
                          placeholder="Amount"
                          value={alloc.amount}
                          onChange={(e) => {
                            const updated = [...newPayment.allocations];
                            updated[idx].amount = e.target.value;
                            setNewPayment({ ...newPayment, allocations: updated });
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t">
              <Button variant="secondary" type="button" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Post Payment Voucher
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* DETAIL MODAL */}
      {selectedPayment && (
        <Dialog
          isOpen={!!selectedPayment}
          onClose={() => setSelectedPayment(null)}
          title={`Payment Voucher: ${selectedPayment.paymentNumber}`}
          size="md"
        >
          <div className="space-y-4 p-1 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded border">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Vendor</span>
                <div className="font-semibold text-slate-900">
                  {suppliers.find((s) => s.id === selectedPayment.supplierId)?.nameEn || `Vendor #${selectedPayment.supplierId}`}
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Date</span>
                <div>{selectedPayment.paymentDate}</div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Method</span>
                <div>{selectedPayment.paymentMethod}</div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Amount Paid</span>
                <div className="font-bold text-emerald-600 font-mono">
                  {parseFloat(selectedPayment.amount).toFixed(3)} {selectedPayment.currency}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setSelectedPayment(null)}>Close</Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
