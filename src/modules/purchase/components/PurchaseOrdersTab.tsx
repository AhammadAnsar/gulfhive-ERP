import React, { useState } from 'react';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import { Button, Input, Select, Dialog, useToast } from '../../../design-system/index.ts';
import {
  Plus,
  CheckCircle,
  Download,
  Truck,
  FileCheck,
  XCircle,
  Eye,
  Trash2,
  Receipt
} from 'lucide-react';

interface PurchaseOrdersTabProps {
  company: any;
  branchId: string;
  suppliers: any[];
  taxCodes: any[];
  orders: any[];
  onRefresh: () => void;
  onCreateGRN: (order: any) => void;
  onCreateBill: (order: any) => void;
}

export function PurchaseOrdersTab({
  company,
  branchId,
  suppliers,
  taxCodes,
  orders,
  onRefresh,
  onCreateGRN,
  onCreateBill,
}: PurchaseOrdersTabProps) {
  const { language } = useI18n();
  const { addToast } = useToast();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPO, setSelectedPO] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [newPO, setNewPO] = useState({
    supplierId: '',
    orderDate: new Date().toISOString().slice(0, 10),
    expectedDeliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    currency: company.baseCurrency || 'KWD',
    paymentTerms: '30 Days',
    notes: '',
    lines: [{ description: '', quantity: '1', unitPrice: '0.000', taxCodeId: '' }],
  });

  const addLine = () => {
    setNewPO({
      ...newPO,
      lines: [...newPO.lines, { description: '', quantity: '1', unitPrice: '0.000', taxCodeId: '' }],
    });
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/companies/${company.id}/procurement/purchase-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newPO,
          supplierId: Number(newPO.supplierId),
          branchId,
        }),
      });

      if (res.ok) {
        addToast({
          type: 'success',
          title: language === 'ar' ? 'تم إنشاء أمر الشراء' : 'Purchase Order Created',
          message: language === 'ar' ? 'تم حفظ أمر الشراء بنجاح' : 'PO created successfully.',
        });
        setShowCreateModal(false);
        setNewPO({
          supplierId: '',
          orderDate: new Date().toISOString().slice(0, 10),
          expectedDeliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          currency: company.baseCurrency || 'KWD',
          paymentTerms: '30 Days',
          notes: '',
          lines: [{ description: '', quantity: '1', unitPrice: '0.000', taxCodeId: '' }],
        });
        onRefresh();
      } else {
        const err = await res.json();
        addToast({ type: 'error', title: 'Error', message: err.error || 'Failed to create PO' });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message || 'Network error' });
    }
  };

  const handleApprovePO = async (poId: number) => {
    try {
      const res = await fetch(`/api/companies/${company.id}/procurement/purchase-orders/${poId}/approve`, {
        method: 'POST',
      });
      if (res.ok) {
        addToast({ type: 'success', title: 'PO Approved', message: 'PO confirmed and sent to vendor.' });
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = orders.filter((o) => statusFilter === 'ALL' || o.status === statusFilter);

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4 shadow-3xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold text-slate-950 uppercase tracking-wider">
            {language === 'ar' ? 'أوامر الشراء والتوريد (PO)' : 'Purchase Orders Registry'}
          </h3>
          <p className="text-[11px] text-slate-500">
            {language === 'ar' ? 'إدارة أوامر التوريد للموردين، المتابعة، والطباعة الرسمية' : 'Formal binding procurement orders, delivery tracking, and PDF document generation.'}
          </p>
        </div>

        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <div className="flex space-x-1 rtl:space-x-reverse text-[10px]">
            {['ALL', 'DRAFT', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2 py-1 rounded font-bold transition cursor-pointer ${
                  statusFilter === st ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            variant="primary"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setShowCreateModal(true)}
          >
            {language === 'ar' ? 'أمر شراء جديد' : 'New PO'}
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-400">
          {language === 'ar' ? 'لا توجد أوامر شراء مطابقة.' : 'No purchase orders matching filter.'}
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left text-slate-900">
            <thead className="bg-slate-900 text-white uppercase text-[10px] font-bold">
              <tr>
                <th className="p-3">PO Number</th>
                <th className="p-3">Vendor</th>
                <th className="p-3">Order Date</th>
                <th className="p-3">Expected Date</th>
                <th className="p-3 text-right">Grand Total</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((po) => {
                const sup = suppliers.find((s) => s.id === po.supplierId);
                return (
                  <tr key={po.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-slate-900">{po.purchaseOrderNumber}</td>
                    <td className="p-3 font-semibold text-slate-800">
                      {sup ? (language === 'ar' ? sup.nameAr : sup.nameEn) : `Vendor #${po.supplierId}`}
                    </td>
                    <td className="p-3 text-slate-600">{po.orderDate}</td>
                    <td className="p-3 text-slate-600">{po.expectedDeliveryDate || '—'}</td>
                    <td className="p-3 text-right font-mono font-bold">
                      {parseFloat(po.grandTotal || '0').toFixed(3)} {po.currency}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          po.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : po.status === 'RECEIVED'
                            ? 'bg-blue-100 text-blue-800'
                            : po.status === 'PARTIALLY_RECEIVED'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {po.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5 rtl:space-x-reverse">
                        <button
                          onClick={() => setSelectedPO(po)}
                          className="p-1 text-slate-600 hover:text-slate-950 rounded hover:bg-slate-100 cursor-pointer"
                          title="View PO Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <a
                          href={`/api/companies/${company.id}/procurement/purchase-orders/${po.id}/pdf`}
                          download
                          className="p-1 text-slate-600 hover:text-slate-950 rounded hover:bg-slate-100 cursor-pointer"
                          title="Download Official PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>

                        {po.status === 'DRAFT' && (
                          <Button size="sm" variant="success" onClick={() => handleApprovePO(po.id)}>
                            <CheckCircle className="w-3 h-3 mr-1" />
                            <span>Approve</span>
                          </Button>
                        )}

                        {po.status === 'APPROVED' && (
                          <>
                            <Button size="sm" variant="primary" onClick={() => onCreateGRN(po)}>
                              <Truck className="w-3 h-3 mr-1" />
                              <span>Receive</span>
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => onCreateBill(po)}>
                              <Receipt className="w-3 h-3 mr-1" />
                              <span>Bill</span>
                            </Button>
                          </>
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

      {/* CREATE PO MODAL */}
      {showCreateModal && (
        <Dialog
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title={language === 'ar' ? 'أمر شراء رسمي جديد' : 'New Official Purchase Order'}
          size="lg"
        >
          <form onSubmit={handleCreatePO} className="space-y-4 p-1 text-xs">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Vendor</label>
                <Select
                  required
                  value={newPO.supplierId}
                  onChange={(e) => setNewPO({ ...newPO, supplierId: e.target.value })}
                >
                  <option value="">-- Choose Vendor --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.code} - {s.nameEn}</option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Order Date</label>
                <Input
                  type="date"
                  required
                  value={newPO.orderDate}
                  onChange={(e) => setNewPO({ ...newPO, orderDate: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Expected Delivery</label>
                <Input
                  type="date"
                  value={newPO.expectedDeliveryDate}
                  onChange={(e) => setNewPO({ ...newPO, expectedDeliveryDate: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Currency</label>
                <Select
                  value={newPO.currency}
                  onChange={(e) => setNewPO({ ...newPO, currency: e.target.value })}
                >
                  <option value="KWD">KWD</option>
                  <option value="SAR">SAR</option>
                  <option value="AED">AED</option>
                  <option value="USD">USD</option>
                </Select>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase">Ordered Items / البنود</h4>
                <Button size="sm" variant="secondary" type="button" onClick={addLine}>
                  Add Line
                </Button>
              </div>

              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {newPO.lines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center bg-slate-50 p-2 rounded border">
                    <div className="md:col-span-2">
                      <Input
                        required
                        placeholder="Item Description / الوصف"
                        value={line.description}
                        onChange={(e) => {
                          const updated = [...newPO.lines];
                          updated[idx].description = e.target.value;
                          setNewPO({ ...newPO, lines: updated });
                        }}
                      />
                    </div>
                    <div>
                      <Input
                        required
                        type="number"
                        placeholder="Qty"
                        value={line.quantity}
                        onChange={(e) => {
                          const updated = [...newPO.lines];
                          updated[idx].quantity = e.target.value;
                          setNewPO({ ...newPO, lines: updated });
                        }}
                      />
                    </div>
                    <div>
                      <Input
                        required
                        placeholder="Unit Price"
                        value={line.unitPrice}
                        onChange={(e) => {
                          const updated = [...newPO.lines];
                          updated[idx].unitPrice = e.target.value;
                          setNewPO({ ...newPO, lines: updated });
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
                Save Draft PO
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* PO DETAILS MODAL */}
      {selectedPO && (
        <Dialog
          isOpen={!!selectedPO}
          onClose={() => setSelectedPO(null)}
          title={`Purchase Order: ${selectedPO.purchaseOrderNumber}`}
          size="lg"
        >
          <div className="space-y-4 p-1 text-xs">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded border">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Vendor</span>
                <div className="font-semibold text-slate-900">
                  {suppliers.find((s) => s.id === selectedPO.supplierId)?.nameEn || `Vendor #${selectedPO.supplierId}`}
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Order Date</span>
                <div>{selectedPO.orderDate}</div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Expected Delivery</span>
                <div>{selectedPO.expectedDeliveryDate || 'N/A'}</div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Grand Total</span>
                <div className="font-bold text-slate-900 font-mono">
                  {parseFloat(selectedPO.grandTotal).toFixed(3)} {selectedPO.currency}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900 text-white uppercase text-[9px] font-bold">
                  <tr>
                    <th className="p-2">Description</th>
                    <th className="p-2 text-right">Qty</th>
                    <th className="p-2 text-right">Unit Price</th>
                    <th className="p-2 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {selectedPO.lines?.map((l: any, idx: number) => (
                    <tr key={idx}>
                      <td className="p-2">{l.description}</td>
                      <td className="p-2 text-right font-mono">{parseFloat(l.quantity).toFixed(2)}</td>
                      <td className="p-2 text-right font-mono">{parseFloat(l.unitPrice).toFixed(3)}</td>
                      <td className="p-2 text-right font-mono font-bold">
                        {parseFloat(l.lineTotal || '0').toFixed(3)} {selectedPO.currency}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setSelectedPO(null)}>Close</Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
