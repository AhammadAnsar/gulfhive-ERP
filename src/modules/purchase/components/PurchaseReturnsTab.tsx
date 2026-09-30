import React, { useState } from 'react';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import { Button, Input, Select, Dialog, useToast } from '../../../design-system/index.ts';
import { RotateCcw, Plus, CheckCircle, FileText, Receipt } from 'lucide-react';

interface PurchaseReturnsTabProps {
  company: any;
  branchId: string;
  suppliers: any[];
  bills: any[];
  returns: any[];
  debitNotes: any[];
  onRefresh: () => void;
}

export function PurchaseReturnsTab({
  company,
  branchId,
  suppliers,
  bills,
  returns,
  debitNotes,
  onRefresh,
}: PurchaseReturnsTabProps) {
  const { language } = useI18n();
  const { addToast } = useToast();

  const [activeSubTab, setActiveSubTab] = useState<'returns' | 'debitNotes'>('returns');
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showDebitNoteModal, setShowDebitNoteModal] = useState(false);

  const [newReturn, setNewReturn] = useState({
    supplierId: '',
    returnDate: new Date().toISOString().slice(0, 10),
    reason: 'Damaged Goods / Specification Mismatch',
    lines: [{ description: '', quantity: '1', reason: 'Defective' }],
  });

  const [newDebitNote, setNewDebitNote] = useState({
    supplierId: '',
    supplierBillId: '',
    debitNoteDate: new Date().toISOString().slice(0, 10),
    currency: company.baseCurrency || 'KWD',
    reason: 'Supplier Price Adjustment / Return Credit',
    lines: [{ description: '', quantity: '1', unitPrice: '0.000', taxCodeId: '' }],
  });

  const handleCreateReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/companies/${company.id}/procurement/purchase-returns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newReturn,
          supplierId: Number(newReturn.supplierId),
          branchId,
        }),
      });
      if (res.ok) {
        addToast({ type: 'success', title: 'Return Documented', message: 'Purchase Return recorded.' });
        setShowReturnModal(false);
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateDebitNote = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/companies/${company.id}/procurement/debit-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newDebitNote,
          supplierId: Number(newDebitNote.supplierId),
          supplierBillId: newDebitNote.supplierBillId ? Number(newDebitNote.supplierBillId) : undefined,
          branchId,
        }),
      });
      if (res.ok) {
        addToast({ type: 'success', title: 'Debit Note Issued', message: 'Vendor debit note applied to AP balance.' });
        setShowDebitNoteModal(false);
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4 shadow-3xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveSubTab('returns')}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition cursor-pointer ${
              activeSubTab === 'returns' ? 'border-slate-900 text-slate-900 bg-slate-50' : 'border-transparent text-slate-500'
            }`}
          >
            {language === 'ar' ? 'مرتجعات المشتريات' : 'Purchase Returns'} ({returns.length})
          </button>
          <button
            onClick={() => setActiveSubTab('debitNotes')}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition cursor-pointer ${
              activeSubTab === 'debitNotes' ? 'border-slate-900 text-slate-900 bg-slate-50' : 'border-transparent text-slate-500'
            }`}
          >
            {language === 'ar' ? 'إشعارات الخصم الدائنة (Debit Notes)' : 'AP Debit Notes'} ({debitNotes.length})
          </button>
        </div>

        <div className="flex space-x-2 rtl:space-x-reverse">
          {activeSubTab === 'returns' ? (
            <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowReturnModal(true)}>
              {language === 'ar' ? 'إرجاع بضاعة' : 'New Return'}
            </Button>
          ) : (
            <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowDebitNoteModal(true)}>
              {language === 'ar' ? 'إشعار خصم جديد' : 'New Debit Note'}
            </Button>
          )}
        </div>
      </div>

      {activeSubTab === 'returns' && (
        returns.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">No purchase returns recorded.</div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs text-left text-slate-900">
              <thead className="bg-slate-900 text-white uppercase text-[10px] font-bold">
                <tr>
                  <th className="p-3">Return #</th>
                  <th className="p-3">Vendor</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {returns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold">{ret.returnNumber}</td>
                    <td className="p-3 font-semibold">{suppliers.find((s) => s.id === ret.supplierId)?.nameEn || `Vendor #${ret.supplierId}`}</td>
                    <td className="p-3">{ret.returnDate}</td>
                    <td className="p-3 text-slate-600">{ret.reason}</td>
                    <td className="p-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                        {ret.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {activeSubTab === 'debitNotes' && (
        debitNotes.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">No vendor debit notes registered.</div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs text-left text-slate-900">
              <thead className="bg-slate-900 text-white uppercase text-[10px] font-bold">
                <tr>
                  <th className="p-3">DN Number</th>
                  <th className="p-3">Vendor</th>
                  <th className="p-3">Date</th>
                  <th className="p-3 text-right">Debit Total</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {debitNotes.map((dn) => (
                  <tr key={dn.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold">{dn.debitNoteNumber}</td>
                    <td className="p-3 font-semibold">{suppliers.find((s) => s.id === dn.supplierId)?.nameEn || `Vendor #${dn.supplierId}`}</td>
                    <td className="p-3">{dn.debitNoteDate}</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-600">
                      {parseFloat(dn.grandTotal || '0').toFixed(3)} {dn.currency}
                    </td>
                    <td className="p-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {dn.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* CREATE RETURN MODAL */}
      {showReturnModal && (
        <Dialog isOpen={showReturnModal} onClose={() => setShowReturnModal(false)} title="Issue Purchase Return" size="md">
          <form onSubmit={handleCreateReturn} className="space-y-4 p-1 text-xs">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Vendor</label>
              <Select
                required
                value={newReturn.supplierId}
                onChange={(e) => setNewReturn({ ...newReturn, supplierId: e.target.value })}
              >
                <option value="">-- Choose Vendor --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.code} - {s.nameEn}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Reason for Return</label>
              <Input
                required
                value={newReturn.reason}
                onChange={(e) => setNewReturn({ ...newReturn, reason: e.target.value })}
              />
            </div>
            <div className="flex justify-end space-x-2 pt-2 border-t">
              <Button variant="secondary" type="button" onClick={() => setShowReturnModal(false)}>Cancel</Button>
              <Button variant="primary" type="submit">Submit Return</Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* CREATE DEBIT NOTE MODAL */}
      {showDebitNoteModal && (
        <Dialog isOpen={showDebitNoteModal} onClose={() => setShowDebitNoteModal(false)} title="Issue AP Debit Note" size="md">
          <form onSubmit={handleCreateDebitNote} className="space-y-4 p-1 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Vendor</label>
                <Select
                  required
                  value={newDebitNote.supplierId}
                  onChange={(e) => setNewDebitNote({ ...newDebitNote, supplierId: e.target.value })}
                >
                  <option value="">-- Choose Vendor --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.code} - {s.nameEn}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Bill Reference (Optional)</label>
                <Select
                  value={newDebitNote.supplierBillId}
                  onChange={(e) => setNewDebitNote({ ...newDebitNote, supplierBillId: e.target.value })}
                >
                  <option value="">-- General Debit Adjustment --</option>
                  {bills.filter((b) => b.supplierId === Number(newDebitNote.supplierId)).map((b) => (
                    <option key={b.id} value={b.id}>{b.billNumber} (Due: {b.outstandingAmount})</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Reason</label>
              <Input
                required
                value={newDebitNote.reason}
                onChange={(e) => setNewDebitNote({ ...newDebitNote, reason: e.target.value })}
              />
            </div>
            <div className="space-y-2 border-t pt-2">
              <h4 className="text-[10px] font-bold text-slate-700 uppercase">Debit Adjustment Line</h4>
              {newDebitNote.lines.map((l, idx) => (
                <div key={idx} className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Input
                      required
                      placeholder="Item / Correction Description"
                      value={l.description}
                      onChange={(e) => {
                        const updated = [...newDebitNote.lines];
                        updated[idx].description = e.target.value;
                        setNewDebitNote({ ...newDebitNote, lines: updated });
                      }}
                    />
                  </div>
                  <div>
                    <Input
                      required
                      placeholder="Amount"
                      value={l.unitPrice}
                      onChange={(e) => {
                        const updated = [...newDebitNote.lines];
                        updated[idx].unitPrice = e.target.value;
                        setNewDebitNote({ ...newDebitNote, lines: updated });
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end space-x-2 pt-2 border-t">
              <Button variant="secondary" type="button" onClick={() => setShowDebitNoteModal(false)}>Cancel</Button>
              <Button variant="primary" type="submit">Issue Debit Note</Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
