import React, { useState } from 'react';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import { Button, Input, Select, Dialog, useToast } from '../../../design-system/index.ts';
import { Plus, CheckCircle, Trophy, ShoppingBag, Eye } from 'lucide-react';

interface RFQsTabProps {
  company: any;
  suppliers: any[];
  rfqs: any[];
  quotations: any[];
  onRefresh: () => void;
  onAwardQuote: (quote: any) => void;
}

export function RFQsTab({
  company,
  suppliers,
  rfqs,
  quotations,
  onRefresh,
  onAwardQuote,
}: RFQsTabProps) {
  const { language } = useI18n();
  const { addToast } = useToast();

  const [showCreateRFQModal, setShowCreateRFQModal] = useState(false);
  const [showAddQuoteModal, setShowAddQuoteModal] = useState(false);
  const [selectedRFQ, setSelectedRFQ] = useState<any | null>(null);

  const [newRFQ, setNewRFQ] = useState({
    title: '',
    closingDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    notes: '',
    lines: [{ description: '', quantity: '1' }],
  });

  const [newQuote, setNewQuote] = useState({
    rfqId: '',
    supplierId: '',
    supplierQuotationNumber: '',
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    currency: company.baseCurrency || 'KWD',
    lines: [{ description: '', quantity: '1', unitPrice: '0.000' }],
  });

  const handleCreateRFQ = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/companies/${company.id}/procurement/rfqs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRFQ),
      });
      if (res.ok) {
        addToast({ type: 'success', title: 'RFQ Created', message: 'Request for Quotation issued.' });
        setShowCreateRFQModal(false);
        setNewRFQ({
          title: '',
          closingDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          notes: '',
          lines: [{ description: '', quantity: '1' }],
        });
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/companies/${company.id}/procurement/quotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newQuote, rfqId: Number(newQuote.rfqId), supplierId: Number(newQuote.supplierId) }),
      });
      if (res.ok) {
        addToast({ type: 'success', title: 'Bid Registered', message: 'Vendor quotation added.' });
        setShowAddQuoteModal(false);
        setNewQuote({
          rfqId: '',
          supplierId: '',
          supplierQuotationNumber: '',
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          currency: company.baseCurrency || 'KWD',
          lines: [{ description: '', quantity: '1', unitPrice: '0.000' }],
        });
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4 shadow-3xs">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-950 uppercase tracking-wider">
              {language === 'ar' ? 'استدراج عروض الأسعار والمقارنة (RFQ)' : 'Requests for Quotation (RFQ & Vendor Bid Matrix)'}
            </h3>
            <p className="text-[11px] text-slate-500">
              {language === 'ar' ? 'مقارنة عروض الموردين واختيار السعر الأنسب وترسية أمر الشراء' : 'Compare multi-vendor price bids, analyze margins, and award Purchase Orders.'}
            </p>
          </div>
          <div className="flex space-x-2 rtl:space-x-reverse">
            <Button size="sm" variant="secondary" onClick={() => setShowAddQuoteModal(true)}>
              {language === 'ar' ? 'تسجيل عرض مورد' : 'Record Supplier Bid'}
            </Button>
            <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowCreateRFQModal(true)}>
              {language === 'ar' ? 'استدراج جديد' : 'New RFQ'}
            </Button>
          </div>
        </div>

        {rfqs.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            {language === 'ar' ? 'لا توجد طلبات عروض أسعار حالياً.' : 'No RFQ records available.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {rfqs.map((rfq) => {
              const relatedQuotes = quotations.filter((q) => q.rfqId === rfq.id);
              return (
                <div key={rfq.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900">{rfq.rfqNumber}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-800">
                      {rfq.status}
                    </span>
                  </div>
                  <div className="font-bold text-slate-800">{rfq.title}</div>
                  <div className="text-[11px] text-slate-500">Closing: {rfq.closingDate || 'Open'}</div>

                  <div className="border-t border-slate-200 pt-2 space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-600">
                      <span>Bids Received ({relatedQuotes.length})</span>
                    </div>

                    {relatedQuotes.length === 0 ? (
                      <div className="text-[10px] text-slate-400 italic">Awaiting vendor submissions</div>
                    ) : (
                      <div className="space-y-1">
                        {relatedQuotes.map((q) => {
                          const sup = suppliers.find((s) => s.id === q.supplierId);
                          return (
                            <div key={q.id} className="p-1.5 bg-white border rounded flex justify-between items-center text-xs">
                              <div>
                                <div className="font-semibold text-slate-800">{sup?.nameEn || `Vendor #${q.supplierId}`}</div>
                                <div className="text-[10px] font-mono text-slate-500">
                                  Total: {parseFloat(q.grandTotal || '0').toFixed(3)} {q.currency}
                                </div>
                              </div>
                              <Button size="sm" variant="success" onClick={() => onAwardQuote(q)}>
                                <Trophy className="w-3 h-3 mr-1" />
                                <span>Award</span>
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE RFQ MODAL */}
      {showCreateRFQModal && (
        <Dialog
          isOpen={showCreateRFQModal}
          onClose={() => setShowCreateRFQModal(false)}
          title="Issue Request for Quotation (RFQ)"
          size="md"
        >
          <form onSubmit={handleCreateRFQ} className="space-y-4 p-1 text-xs">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">RFQ Title / Subject</label>
              <Input
                required
                placeholder="E.g., Heavy Equipment Procurement Q2"
                value={newRFQ.title}
                onChange={(e) => setNewRFQ({ ...newRFQ, title: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Bid Closing Date</label>
              <Input
                type="date"
                required
                value={newRFQ.closingDate}
                onChange={(e) => setNewRFQ({ ...newRFQ, closingDate: e.target.value })}
              />
            </div>
            <div className="flex justify-end space-x-2 pt-2 border-t">
              <Button variant="secondary" type="button" onClick={() => setShowCreateRFQModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Issue RFQ
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* ADD QUOTE MODAL */}
      {showAddQuoteModal && (
        <Dialog
          isOpen={showAddQuoteModal}
          onClose={() => setShowAddQuoteModal(false)}
          title="Record Supplier Quotation Bid"
          size="lg"
        >
          <form onSubmit={handleCreateQuote} className="space-y-4 p-1 text-xs">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Target RFQ</label>
                <Select
                  required
                  value={newQuote.rfqId}
                  onChange={(e) => setNewQuote({ ...newQuote, rfqId: e.target.value })}
                >
                  <option value="">-- Choose RFQ --</option>
                  {rfqs.map((r) => (
                    <option key={r.id} value={r.id}>{r.rfqNumber} - {r.title}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Vendor</label>
                <Select
                  required
                  value={newQuote.supplierId}
                  onChange={(e) => setNewQuote({ ...newQuote, supplierId: e.target.value })}
                >
                  <option value="">-- Choose Vendor --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.code} - {s.nameEn}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Vendor Quote #</label>
                <Input
                  required
                  placeholder="QT-2026-99"
                  value={newQuote.supplierQuotationNumber}
                  onChange={(e) => setNewQuote({ ...newQuote, supplierQuotationNumber: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Currency</label>
                <Select
                  value={newQuote.currency}
                  onChange={(e) => setNewQuote({ ...newQuote, currency: e.target.value })}
                >
                  <option value="KWD">KWD</option>
                  <option value="SAR">SAR</option>
                  <option value="AED">AED</option>
                  <option value="USD">USD</option>
                </Select>
              </div>
            </div>

            <div className="space-y-2 border-t pt-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase">Quoted Items</h4>
              {newQuote.lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center bg-slate-50 p-2 rounded border">
                  <div className="md:col-span-2">
                    <Input
                      required
                      placeholder="Item Description"
                      value={line.description}
                      onChange={(e) => {
                        const updated = [...newQuote.lines];
                        updated[idx].description = e.target.value;
                        setNewQuote({ ...newQuote, lines: updated });
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
                        const updated = [...newQuote.lines];
                        updated[idx].quantity = e.target.value;
                        setNewQuote({ ...newQuote, lines: updated });
                      }}
                    />
                  </div>
                  <div>
                    <Input
                      required
                      placeholder="Quoted Unit Price"
                      value={line.unitPrice}
                      onChange={(e) => {
                        const updated = [...newQuote.lines];
                        updated[idx].unitPrice = e.target.value;
                        setNewQuote({ ...newQuote, lines: updated });
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t">
              <Button variant="secondary" type="button" onClick={() => setShowAddQuoteModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Submit Vendor Bid
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
