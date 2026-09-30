import React, { useState } from 'react';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import { Button, Input, Select, Dialog, useToast } from '../../../design-system/index.ts';
import {
  Receipt,
  Plus,
  CheckCircle,
  Eye,
  AlertTriangle,
  FileCheck,
  CreditCard,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';

interface SupplierBillsTabProps {
  company: any;
  branchId: string;
  suppliers: any[];
  orders: any[];
  receipts: any[];
  bills: any[];
  onRefresh: () => void;
  onPayBill: (bill: any) => void;
}

export function SupplierBillsTab({
  company,
  branchId,
  suppliers,
  orders,
  receipts,
  bills,
  onRefresh,
  onPayBill,
}: SupplierBillsTabProps) {
  const { language } = useI18n();
  const { addToast } = useToast();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState<any | null>(null);
  const [creationMode, setCreationMode] = useState<'DIRECT' | 'PO_LINKED' | 'GRN_LINKED'>('DIRECT');

  const [newBill, setNewBill] = useState({
    supplierId: '',
    supplierInvoiceNumber: '',
    purchaseOrderId: '',
    goodsReceiptId: '',
    billDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    currency: company.baseCurrency || 'KWD',
    paymentTerms: '30 Days',
    notes: '',
    lines: [{ purchaseOrderLineId: undefined as number | undefined, description: '', quantity: '1', unitPrice: '0.000', taxCodeId: '' }],
  });

  const handleSelectPOForBill = (poIdStr: string) => {
    const po = orders.find((o) => o.id === Number(poIdStr));
    if (po) {
      const lines = po.lines?.map((l: any) => ({
        purchaseOrderLineId: l.id,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        taxCodeId: l.taxCodeId || '',
      })) || [];
      setNewBill({
        ...newBill,
        purchaseOrderId: poIdStr,
        supplierId: String(po.supplierId),
        currency: po.currency,
        lines,
      });
    }
  };

  const handleSelectGRNForBill = (grnIdStr: string) => {
    const grn = receipts.find((r) => r.id === Number(grnIdStr));
    if (grn) {
      const po = orders.find((o) => o.id === grn.purchaseOrderId);
      const lines = grn.lines?.map((l: any) => {
        const poLine = po?.lines?.find((pol: any) => pol.id === l.purchaseOrderLineId);
        return {
          purchaseOrderLineId: l.purchaseOrderLineId,
          description: l.description,
          quantity: l.acceptedQuantity || l.receivedQuantity,
          unitPrice: poLine?.unitPrice || '0.000',
          taxCodeId: '',
        };
      }) || [];

      setNewBill({
        ...newBill,
        goodsReceiptId: grnIdStr,
        purchaseOrderId: grn.purchaseOrderId ? String(grn.purchaseOrderId) : '',
        supplierId: String(grn.supplierId),
        lines,
      });
    }
  };

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/companies/${company.id}/procurement/supplier-bills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newBill,
          supplierId: Number(newBill.supplierId),
          purchaseOrderId: newBill.purchaseOrderId ? Number(newBill.purchaseOrderId) : undefined,
          goodsReceiptId: newBill.goodsReceiptId ? Number(newBill.goodsReceiptId) : undefined,
          branchId,
        }),
      });

      if (res.ok) {
        addToast({
          type: 'success',
          title: language === 'ar' ? 'تم إنشاء فاتورة المورد' : 'Supplier Bill Saved',
          message: language === 'ar' ? 'تم تسجيل الفاتورة بنجاح في سجل المدفوعات' : 'Supplier AP Bill recorded.',
        });
        setShowCreateModal(false);
        setNewBill({
          supplierId: '',
          supplierInvoiceNumber: '',
          purchaseOrderId: '',
          goodsReceiptId: '',
          billDate: new Date().toISOString().slice(0, 10),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          currency: company.baseCurrency || 'KWD',
          paymentTerms: '30 Days',
          notes: '',
          lines: [{ purchaseOrderLineId: undefined, description: '', quantity: '1', unitPrice: '0.000', taxCodeId: '' }],
        });
        onRefresh();
      } else {
        const err = await res.json();
        addToast({
          type: 'error',
          title: language === 'ar' ? 'فشل المطابقة الثلاثية أو الحفظ' : '3-Way Match or Save Failed',
          message: err.error || 'Failed to create supplier bill',
        });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message || 'Network error' });
    }
  };

  const handlePostBill = async (billId: number) => {
    try {
      const res = await fetch(`/api/companies/${company.id}/procurement/supplier-bills/${billId}/post`, {
        method: 'POST',
      });
      if (res.ok) {
        addToast({ type: 'success', title: 'Bill Posted', message: 'Supplier bill posted to AP Ledger.' });
        onRefresh();
      } else {
        const err = await res.json();
        addToast({ type: 'error', title: 'Post Failed', message: err.error });
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4 shadow-3xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold text-slate-950 uppercase tracking-wider">
            {language === 'ar' ? 'فواتير الموردين والمطابقة الثلاثية (AP Bills & 3-Way Match)' : 'Accounts Payable Bills & 3-Way Matching Engine'}
          </h3>
          <p className="text-[11px] text-slate-500">
            {language === 'ar' ? 'مطابقة الفواتير مع أوامر الشراء وسندات الاستلام، واحتساب الدائنية' : 'Automated 3-Way Match validation against POs and Goods Receipts with discrepancy guard.'}
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => setShowCreateModal(true)}
        >
          {language === 'ar' ? 'فاتورة مورد جديدة' : 'New Supplier Bill'}
        </Button>
      </div>

      {bills.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-400">
          {language === 'ar' ? 'لا توجد فواتير موردين مسجلة.' : 'No supplier bills in ledger.'}
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left text-slate-900">
            <thead className="bg-slate-900 text-white uppercase text-[10px] font-bold">
              <tr>
                <th className="p-3">Bill #</th>
                <th className="p-3">Vendor Invoice #</th>
                <th className="p-3">Vendor</th>
                <th className="p-3">Bill Date</th>
                <th className="p-3 text-right">Grand Total</th>
                <th className="p-3 text-right">Outstanding</th>
                <th className="p-3 text-center">3-Way Match</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {bills.map((bill) => {
                const sup = suppliers.find((s) => s.id === bill.supplierId);
                const isDiscrepancy = bill.matchStatus === 'DISCREPANCY';
                return (
                  <tr key={bill.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-slate-900">{bill.billNumber}</td>
                    <td className="p-3 font-mono text-slate-700">{bill.supplierInvoiceNumber || '—'}</td>
                    <td className="p-3 font-semibold">{sup ? (language === 'ar' ? sup.nameAr : sup.nameEn) : `Vendor #${bill.supplierId}`}</td>
                    <td className="p-3 text-slate-600">{bill.billDate}</td>
                    <td className="p-3 text-right font-mono font-bold">
                      {parseFloat(bill.grandTotal || '0').toFixed(3)} {bill.currency}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-rose-600">
                      {parseFloat(bill.outstandingAmount || bill.grandTotal || '0').toFixed(3)}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          isDiscrepancy
                            ? 'bg-rose-100 text-rose-800'
                            : bill.goodsReceiptId || bill.purchaseOrderId
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {isDiscrepancy ? <ShieldAlert className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                        <span>{isDiscrepancy ? 'Discrepancy' : 'Matched 3-Way'}</span>
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          bill.status === 'POSTED'
                            ? 'bg-blue-100 text-blue-800'
                            : bill.status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {bill.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5 rtl:space-x-reverse">
                        <Button size="sm" variant="secondary" onClick={() => setSelectedBill(bill)}>
                          <Eye className="w-3 h-3" />
                        </Button>
                        {bill.status === 'DRAFT' && (
                          <Button size="sm" variant="success" onClick={() => handlePostBill(bill.id)}>
                            <CheckCircle className="w-3 h-3 mr-1" />
                            <span>Post</span>
                          </Button>
                        )}
                        {bill.status === 'POSTED' && parseFloat(bill.outstandingAmount || '1') > 0 && (
                          <Button size="sm" variant="primary" onClick={() => onPayBill(bill)}>
                            <CreditCard className="w-3 h-3 mr-1" />
                            <span>Pay</span>
                          </Button>
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

      {/* CREATE BILL MODAL */}
      {showCreateModal && (
        <Dialog
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title={language === 'ar' ? 'تسجيل فاتورة مورد ومطابقة ثلاثية' : 'New Vendor AP Bill (3-Way Match)'}
          size="lg"
        >
          <form onSubmit={handleCreateBill} className="space-y-4 p-1 text-xs">
            {/* Creation Mode Tabs */}
            <div className="flex bg-slate-100 p-1 rounded space-x-1 rtl:space-x-reverse text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setCreationMode('DIRECT')}
                className={`flex-1 py-1 rounded transition cursor-pointer ${
                  creationMode === 'DIRECT' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Direct Vendor Invoice
              </button>
              <button
                type="button"
                onClick={() => setCreationMode('PO_LINKED')}
                className={`flex-1 py-1 rounded transition cursor-pointer ${
                  creationMode === 'PO_LINKED' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Match to Purchase Order (PO)
              </button>
              <button
                type="button"
                onClick={() => setCreationMode('GRN_LINKED')}
                className={`flex-1 py-1 rounded transition cursor-pointer ${
                  creationMode === 'GRN_LINKED' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Match to Goods Receipt (GRN)
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {creationMode === 'DIRECT' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Vendor</label>
                  <Select
                    required
                    value={newBill.supplierId}
                    onChange={(e) => setNewBill({ ...newBill, supplierId: e.target.value })}
                  >
                    <option value="">-- Choose Vendor --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.code} - {s.nameEn}</option>
                    ))}
                  </Select>
                </div>
              )}

              {creationMode === 'PO_LINKED' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Purchase Order</label>
                  <Select
                    required
                    value={newBill.purchaseOrderId}
                    onChange={(e) => handleSelectPOForBill(e.target.value)}
                  >
                    <option value="">-- Choose PO --</option>
                    {orders.filter((o) => o.status === 'APPROVED' || o.status === 'PARTIALLY_RECEIVED' || o.status === 'RECEIVED').map((o) => (
                      <option key={o.id} value={o.id}>{o.purchaseOrderNumber}</option>
                    ))}
                  </Select>
                </div>
              )}

              {creationMode === 'GRN_LINKED' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Goods Receipt (GRN)</label>
                  <Select
                    required
                    value={newBill.goodsReceiptId}
                    onChange={(e) => handleSelectGRNForBill(e.target.value)}
                  >
                    <option value="">-- Choose GRN --</option>
                    {receipts.map((r) => (
                      <option key={r.id} value={r.id}>{r.receiptNumber} ({r.receivedDate})</option>
                    ))}
                  </Select>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Vendor Invoice #</label>
                <Input
                  required
                  placeholder="INV-9908"
                  value={newBill.supplierInvoiceNumber}
                  onChange={(e) => setNewBill({ ...newBill, supplierInvoiceNumber: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Bill Date</label>
                <Input
                  type="date"
                  required
                  value={newBill.billDate}
                  onChange={(e) => setNewBill({ ...newBill, billDate: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Due Date</label>
                <Input
                  type="date"
                  required
                  value={newBill.dueDate}
                  onChange={(e) => setNewBill({ ...newBill, dueDate: e.target.value })}
                />
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2 border-t pt-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase">Billed Items / بنود الفاتورة</h4>
              <div className="space-y-2 max-h-[180px] overflow-y-auto">
                {newBill.lines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center bg-slate-50 p-2 rounded border">
                    <div className="md:col-span-2">
                      <Input
                        required
                        placeholder="Description"
                        value={line.description}
                        onChange={(e) => {
                          const updated = [...newBill.lines];
                          updated[idx].description = e.target.value;
                          setNewBill({ ...newBill, lines: updated });
                        }}
                      />
                    </div>
                    <div>
                      <Input
                        required
                        type="number"
                        placeholder="Billed Qty"
                        value={line.quantity}
                        onChange={(e) => {
                          const updated = [...newBill.lines];
                          updated[idx].quantity = e.target.value;
                          setNewBill({ ...newBill, lines: updated });
                        }}
                      />
                    </div>
                    <div>
                      <Input
                        required
                        placeholder="Unit Price"
                        value={line.unitPrice}
                        onChange={(e) => {
                          const updated = [...newBill.lines];
                          updated[idx].unitPrice = e.target.value;
                          setNewBill({ ...newBill, lines: updated });
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t">
              <Button variant="secondary" type="button" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Validate & Save Bill
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* DETAIL MODAL */}
      {selectedBill && (
        <Dialog
          isOpen={!!selectedBill}
          onClose={() => setSelectedBill(null)}
          title={`Supplier Bill: ${selectedBill.billNumber}`}
          size="lg"
        >
          <div className="space-y-4 p-1 text-xs">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded border">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Vendor</span>
                <div className="font-semibold text-slate-900">
                  {suppliers.find((s) => s.id === selectedBill.supplierId)?.nameEn || `Vendor #${selectedBill.supplierId}`}
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Vendor Inv #</span>
                <div>{selectedBill.supplierInvoiceNumber || '—'}</div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Due Date</span>
                <div>{selectedBill.dueDate}</div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Outstanding</span>
                <div className="font-bold text-rose-600 font-mono">
                  {parseFloat(selectedBill.outstandingAmount || selectedBill.grandTotal).toFixed(3)} {selectedBill.currency}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900 text-white uppercase text-[9px] font-bold">
                  <tr>
                    <th className="p-2">Description</th>
                    <th className="p-2 text-right">Billed Qty</th>
                    <th className="p-2 text-right">Unit Price</th>
                    <th className="p-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {selectedBill.lines?.map((l: any, idx: number) => (
                    <tr key={idx}>
                      <td className="p-2">{l.description}</td>
                      <td className="p-2 text-right font-mono">{parseFloat(l.quantity).toFixed(2)}</td>
                      <td className="p-2 text-right font-mono">{parseFloat(l.unitPrice).toFixed(3)}</td>
                      <td className="p-2 text-right font-mono font-bold">
                        {parseFloat(l.lineTotal || '0').toFixed(3)} {selectedBill.currency}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setSelectedBill(null)}>Close</Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
