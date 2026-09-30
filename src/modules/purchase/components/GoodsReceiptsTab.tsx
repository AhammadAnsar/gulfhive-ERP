import React, { useState } from 'react';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import { Button, Input, Select, Dialog, useToast } from '../../../design-system/index.ts';
import { Truck, Plus, CheckCircle, Eye, AlertTriangle } from 'lucide-react';

interface GoodsReceiptsTabProps {
  company: any;
  branchId: string;
  suppliers: any[];
  orders: any[];
  receipts: any[];
  onRefresh: () => void;
  onCreateBillFromGRN: (grn: any) => void;
}

export function GoodsReceiptsTab({
  company,
  branchId,
  suppliers,
  orders,
  receipts,
  onRefresh,
  onCreateBillFromGRN,
}: GoodsReceiptsTabProps) {
  const { language } = useI18n();
  const { addToast } = useToast();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);

  const [newGRN, setNewGRN] = useState({
    purchaseOrderId: '',
    supplierId: '',
    supplierDeliveryNote: '',
    receivedDate: new Date().toISOString().slice(0, 10),
    warehouseLocation: 'Main Warehouse - Bay A',
    notes: '',
    lines: [] as any[],
  });

  const handleSelectPO = (poIdStr: string) => {
    const po = orders.find((o) => o.id === Number(poIdStr));
    if (po) {
      const lines = po.lines?.map((l: any) => ({
        purchaseOrderLineId: l.id,
        description: l.description,
        orderedQuantity: l.quantity,
        receivedQuantity: l.quantity,
        acceptedQuantity: l.quantity,
        rejectedQuantity: '0',
        rejectionReason: '',
        batchNumber: 'B-2026-01',
      })) || [];
      setNewGRN({
        ...newGRN,
        purchaseOrderId: poIdStr,
        supplierId: String(po.supplierId),
        lines,
      });
    } else {
      setNewGRN({ ...newGRN, purchaseOrderId: '', lines: [] });
    }
  };

  const handleCreateGRN = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/companies/${company.id}/procurement/goods-receipts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newGRN,
          purchaseOrderId: Number(newGRN.purchaseOrderId),
          supplierId: Number(newGRN.supplierId),
          branchId,
        }),
      });

      if (res.ok) {
        addToast({
          type: 'success',
          title: language === 'ar' ? 'تم إنشاء محضر الاستلام' : 'Goods Receipt Generated',
          message: language === 'ar' ? 'تم فحص وقبول البضائع في المستودع' : 'Goods received and inspected.',
        });
        setShowCreateModal(false);
        setNewGRN({
          purchaseOrderId: '',
          supplierId: '',
          supplierDeliveryNote: '',
          receivedDate: new Date().toISOString().slice(0, 10),
          warehouseLocation: 'Main Warehouse - Bay A',
          notes: '',
          lines: [],
        });
        onRefresh();
      } else {
        const err = await res.json();
        addToast({ type: 'error', title: 'Error', message: err.error || 'Failed to create GRN' });
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
            {language === 'ar' ? 'سندات استلام البضائع والفحص (GRN)' : 'Goods Receipt Notes & Inspection (GRN)'}
          </h3>
          <p className="text-[11px] text-slate-500">
            {language === 'ar' ? 'استلام الشحنات، الفحص النوعي، وتوثيق الكميات المقبولة والمرفوضة' : 'Warehouse receiving ledger, QC inspection, and batch acceptance.'}
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => setShowCreateModal(true)}
        >
          {language === 'ar' ? 'استلام بضاعة' : 'New Goods Receipt'}
        </Button>
      </div>

      {receipts.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-400">
          {language === 'ar' ? 'لا توجد سندات استلام مسجلة.' : 'No goods receipt notes recorded.'}
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left text-slate-900">
            <thead className="bg-slate-900 text-white uppercase text-[10px] font-bold">
              <tr>
                <th className="p-3">GRN Number</th>
                <th className="p-3">Vendor</th>
                <th className="p-3">PO Reference</th>
                <th className="p-3">Received Date</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {receipts.map((grn) => {
                const sup = suppliers.find((s) => s.id === grn.supplierId);
                return (
                  <tr key={grn.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-slate-900">{grn.receiptNumber}</td>
                    <td className="p-3 font-semibold">{sup ? (language === 'ar' ? sup.nameAr : sup.nameEn) : `Vendor #${grn.supplierId}`}</td>
                    <td className="p-3 font-mono text-slate-600">{grn.purchaseOrderNumber || `PO #${grn.purchaseOrderId}`}</td>
                    <td className="p-3 text-slate-600">{grn.receivedDate}</td>
                    <td className="p-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                        {grn.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5 rtl:space-x-reverse">
                        <Button size="sm" variant="secondary" onClick={() => setSelectedReceipt(grn)}>
                          <Eye className="w-3 h-3 mr-1" />
                          <span>View</span>
                        </Button>
                        <Button size="sm" variant="primary" onClick={() => onCreateBillFromGRN(grn)}>
                          <span>Bill AP</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE GRN MODAL */}
      {showCreateModal && (
        <Dialog
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Receive & Inspect Vendor Shipment"
          size="lg"
        >
          <form onSubmit={handleCreateGRN} className="space-y-4 p-1 text-xs">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Purchase Order</label>
                <Select
                  required
                  value={newGRN.purchaseOrderId}
                  onChange={(e) => handleSelectPO(e.target.value)}
                >
                  <option value="">-- Choose PO --</option>
                  {orders.filter((o) => o.status === 'APPROVED' || o.status === 'PARTIALLY_RECEIVED').map((o) => (
                    <option key={o.id} value={o.id}>{o.purchaseOrderNumber}</option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Received Date</label>
                <Input
                  type="date"
                  required
                  value={newGRN.receivedDate}
                  onChange={(e) => setNewGRN({ ...newGRN, receivedDate: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Delivery Note #</label>
                <Input
                  placeholder="DN-2026-88"
                  value={newGRN.supplierDeliveryNote}
                  onChange={(e) => setNewGRN({ ...newGRN, supplierDeliveryNote: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Warehouse Location</label>
                <Input
                  value={newGRN.warehouseLocation}
                  onChange={(e) => setNewGRN({ ...newGRN, warehouseLocation: e.target.value })}
                />
              </div>
            </div>

            {/* Inspect Lines */}
            {newGRN.lines.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase">QC Item Verification & Acceptance</h4>
                <div className="space-y-2 max-h-[220px] overflow-y-auto">
                  {newGRN.lines.map((line, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-50 border rounded space-y-2">
                      <div className="flex justify-between font-semibold">
                        <span>{line.description}</span>
                        <span className="text-slate-500">Ordered Qty: {line.orderedQuantity}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 items-center text-xs">
                        <div>
                          <label className="text-[9px] font-bold text-emerald-700 uppercase">Accepted Qty</label>
                          <Input
                            type="number"
                            value={line.acceptedQuantity}
                            onChange={(e) => {
                              const updated = [...newGRN.lines];
                              updated[idx].acceptedQuantity = e.target.value;
                              setNewGRN({ ...newGRN, lines: updated });
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-rose-700 uppercase">Rejected Qty</label>
                          <Input
                            type="number"
                            value={line.rejectedQuantity}
                            onChange={(e) => {
                              const updated = [...newGRN.lines];
                              updated[idx].rejectedQuantity = e.target.value;
                              setNewGRN({ ...newGRN, lines: updated });
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-500 uppercase">Batch / Lot #</label>
                          <Input
                            value={line.batchNumber}
                            onChange={(e) => {
                              const updated = [...newGRN.lines];
                              updated[idx].batchNumber = e.target.value;
                              setNewGRN({ ...newGRN, lines: updated });
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-2 border-t">
              <Button variant="secondary" type="button" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={newGRN.lines.length === 0}>
                Confirm GRN Inspection
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* DETAIL MODAL */}
      {selectedReceipt && (
        <Dialog
          isOpen={!!selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
          title={`Goods Receipt Note: ${selectedReceipt.receiptNumber}`}
          size="md"
        >
          <div className="space-y-4 p-1 text-xs">
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded border">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Date</span>
                <div>{selectedReceipt.receivedDate}</div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Status</span>
                <div className="font-bold text-emerald-600">{selectedReceipt.status}</div>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900 text-white uppercase text-[9px] font-bold">
                  <tr>
                    <th className="p-2">Description</th>
                    <th className="p-2 text-right">Accepted Qty</th>
                    <th className="p-2 text-right">Rejected Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {selectedReceipt.lines?.map((l: any, idx: number) => (
                    <tr key={idx}>
                      <td className="p-2">{l.description}</td>
                      <td className="p-2 text-right font-mono text-emerald-600 font-bold">{parseFloat(l.acceptedQuantity).toFixed(2)}</td>
                      <td className="p-2 text-right font-mono text-rose-600">{parseFloat(l.rejectedQuantity || '0').toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setSelectedReceipt(null)}>Close</Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
