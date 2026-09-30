import React, { useState } from 'react';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import { Button, Input, Select, Dialog, useToast } from '../../../design-system/index.ts';
import { Plus, CheckCircle, Send, Trash2, FileText, ArrowRight } from 'lucide-react';

interface PurchaseRequestsTabProps {
  company: any;
  branchId: string;
  requests: any[];
  onRefresh: () => void;
  onConvertToPO: (pr: any) => void;
}

export function PurchaseRequestsTab({
  company,
  branchId,
  requests,
  onRefresh,
  onConvertToPO,
}: PurchaseRequestsTabProps) {
  const { language } = useI18n();
  const { addToast } = useToast();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPR, setNewPR] = useState({
    requesterName: 'Purchasing Officer',
    department: 'Procurement',
    requiredDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    currency: company.baseCurrency || 'KWD',
    notes: '',
    lines: [{ description: '', quantity: '1', estimatedUnitPrice: '0.000', budgetLine: 'General Ops' }],
  });

  const addLine = () => {
    setNewPR({
      ...newPR,
      lines: [...newPR.lines, { description: '', quantity: '1', estimatedUnitPrice: '0.000', budgetLine: 'General Ops' }],
    });
  };

  const handleCreatePR = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/companies/${company.id}/procurement/purchase-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newPR, branchId }),
      });

      if (res.ok) {
        addToast({
          type: 'success',
          title: language === 'ar' ? 'تم إنشاء طلب الشراء' : 'Purchase Request Created',
          message: language === 'ar' ? 'تم حفظ طلب الشراء بنجاح' : 'Purchase Requisition drafted.',
        });
        setShowCreateModal(false);
        setNewPR({
          requesterName: 'Purchasing Officer',
          department: 'Procurement',
          requiredDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          currency: company.baseCurrency || 'KWD',
          notes: '',
          lines: [{ description: '', quantity: '1', estimatedUnitPrice: '0.000', budgetLine: 'General Ops' }],
        });
        onRefresh();
      } else {
        const err = await res.json();
        addToast({ type: 'error', title: 'Error', message: err.error || 'Failed to create PR' });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message || 'Network error' });
    }
  };

  const handleAction = async (prId: number, action: 'submit' | 'approve') => {
    try {
      const res = await fetch(`/api/companies/${company.id}/procurement/purchase-requests/${prId}/${action}`, {
        method: 'POST',
      });
      if (res.ok) {
        addToast({
          type: 'success',
          title: 'Success',
          message: action === 'submit' ? 'PR submitted for managerial approval' : 'PR approved for procurement order',
        });
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (prId: number) => {
    try {
      const res = await fetch(`/api/companies/${company.id}/procurement/purchase-requests/${prId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        addToast({ type: 'success', title: 'Deleted', message: 'PR record removed' });
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4 shadow-3xs">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-slate-950 uppercase tracking-wider">
            {language === 'ar' ? 'طلبات الشراء والاحتياج الداخلي (PR)' : 'Purchase Requests (Requisitions Pipeline)'}
          </h3>
          <p className="text-[11px] text-slate-500">
            {language === 'ar' ? 'دورة الموافقة على طلبات الاحتياج من الأقسام وتحويلها لأوامر شراء' : 'Manage internal departmental requisitions and approval workflows.'}
          </p>
        </div>
        <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowCreateModal(true)}>
          {language === 'ar' ? 'طلب شراء جديد' : 'New Requisition'}
        </Button>
      </div>

      {requests.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-400">
          {language === 'ar' ? 'لا توجد طلبات شراء مسجلة.' : 'No purchase requisitions found.'}
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left text-slate-900">
            <thead className="bg-slate-900 text-white uppercase text-[10px] font-bold">
              <tr>
                <th className="p-3">PR Number</th>
                <th className="p-3">Requester / Dept</th>
                <th className="p-3">Required Date</th>
                <th className="p-3 text-right">Est. Total</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {requests.map((pr) => (
                <tr key={pr.id} className="hover:bg-slate-50">
                  <td className="p-3 font-mono font-bold text-slate-900">{pr.requestNumber}</td>
                  <td className="p-3">
                    <div className="font-semibold">{pr.requesterName}</div>
                    <div className="text-[10px] text-slate-500">{pr.department || 'General'}</div>
                  </td>
                  <td className="p-3">{pr.requiredDate || 'Immediate'}</td>
                  <td className="p-3 text-right font-mono font-bold">
                    {parseFloat(pr.totalEstimatedAmount || '0').toFixed(3)} {pr.currency}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        pr.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : pr.status === 'SUBMITTED'
                          ? 'bg-blue-100 text-blue-800'
                          : pr.status === 'ORDERED'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {pr.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end space-x-1.5 rtl:space-x-reverse">
                      {pr.status === 'DRAFT' && (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => handleAction(pr.id, 'submit')}>
                            <Send className="w-3 h-3 mr-1" />
                            <span>Submit</span>
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => handleDelete(pr.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                      {pr.status === 'SUBMITTED' && (
                        <Button size="sm" variant="success" onClick={() => handleAction(pr.id, 'approve')}>
                          <CheckCircle className="w-3 h-3 mr-1" />
                          <span>Approve</span>
                        </Button>
                      )}
                      {pr.status === 'APPROVED' && (
                        <Button size="sm" variant="primary" onClick={() => onConvertToPO(pr)}>
                          <ArrowRight className="w-3 h-3 mr-1" />
                          <span>Generate PO</span>
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE PR MODAL */}
      {showCreateModal && (
        <Dialog
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title={language === 'ar' ? 'طلب شراء داخلي جديد' : 'New Purchase Requisition'}
          size="lg"
        >
          <form onSubmit={handleCreatePR} className="space-y-4 p-1">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Requester Name</label>
                <Input
                  required
                  value={newPR.requesterName}
                  onChange={(e) => setNewPR({ ...newPR, requesterName: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Department</label>
                <Input
                  value={newPR.department}
                  onChange={(e) => setNewPR({ ...newPR, department: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Required By</label>
                <Input
                  type="date"
                  value={newPR.requiredDate}
                  onChange={(e) => setNewPR({ ...newPR, requiredDate: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Currency</label>
                <Select
                  value={newPR.currency}
                  onChange={(e) => setNewPR({ ...newPR, currency: e.target.value })}
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
                <h4 className="text-xs font-bold text-slate-900 uppercase">Requested Items / البنود المطلوبة</h4>
                <Button size="sm" variant="secondary" type="button" onClick={addLine}>
                  Add Line
                </Button>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto">
                {newPR.lines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center bg-slate-50 p-2 rounded border">
                    <div className="md:col-span-2">
                      <Input
                        required
                        placeholder="Item specification / الوصف"
                        value={line.description}
                        onChange={(e) => {
                          const updated = [...newPR.lines];
                          updated[idx].description = e.target.value;
                          setNewPR({ ...newPR, lines: updated });
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
                          const updated = [...newPR.lines];
                          updated[idx].quantity = e.target.value;
                          setNewPR({ ...newPR, lines: updated });
                        }}
                      />
                    </div>
                    <div>
                      <Input
                        required
                        placeholder="Est. Unit Price"
                        value={line.estimatedUnitPrice}
                        onChange={(e) => {
                          const updated = [...newPR.lines];
                          updated[idx].estimatedUnitPrice = e.target.value;
                          setNewPR({ ...newPR, lines: updated });
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
                Save Requisition
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
