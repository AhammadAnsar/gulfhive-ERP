import React, { useState, useEffect } from 'react';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import { Button, Input, Dialog, useToast, LoadingState } from '../../../design-system/index.ts';
import { Archive, Trash2 } from 'lucide-react';

interface SupplierPreflightDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: any;
  companyId: string;
  onDeleted: () => void;
}

export function SupplierPreflightDeleteModal({
  isOpen,
  onClose,
  supplier,
  companyId,
  onDeleted,
}: SupplierPreflightDeleteModalProps) {
  const { language } = useI18n();
  const { addToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [preflightData, setPreflightData] = useState<any | null>(null);
  const [reason, setReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen && supplier) {
      setIsLoading(true);
      setReason('');
      fetch(`/api/companies/${companyId}/procurement/suppliers/${supplier.id}/preflight`)
        .then((res) => res.json())
        .then((data) => {
          setPreflightData(data.preflight || null);
        })
        .catch((err) => {
          console.error(err);
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, supplier, companyId]);

  if (!isOpen || !supplier) return null;

  const handleDelete = async () => {
    if (!reason.trim()) {
      addToast({
        type: 'error',
        title: language === 'ar' ? 'سبب العملية مطلوب' : 'Audit Reason Required',
        message: language === 'ar' ? 'يرجى إدخال سبب الحذف / الأرشفة.' : 'Please provide an audit reason.',
      });
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/procurement/suppliers/${supplier.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (res.ok) {
        const data = await res.json();
        const actionType = data.result?.action || 'DELETED';
        addToast({
          type: 'success',
          title: language === 'ar' ? 'تمت العملية' : 'Success',
          message:
            actionType === 'SOFT_DELETE'
              ? (language === 'ar' ? 'تم أرشفة المورد بنجاح لحماية القيود المحاسبية.' : 'Supplier safely archived with audit record.')
              : (language === 'ar' ? 'تم حذف المورد نهائياً لعدم وجود قيود.' : 'Supplier record permanently removed.'),
        });
        onDeleted();
        onClose();
      } else {
        const err = await res.json();
        addToast({
          type: 'error',
          title: language === 'ar' ? 'خطأ' : 'Error',
          message: err.error || 'Failed to delete supplier',
        });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message || 'Network error' });
    } finally {
      setIsDeleting(false);
    }
  };

  const isSoftDelete = preflightData?.action === 'SOFT_DELETE' || (preflightData?.dependentRecords && Object.values(preflightData.dependentRecords).some((v: any) => v > 0));

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`${language === 'ar' ? 'تدقيق حذف المورد' : 'Supplier Deletion Audit Guard'}: ${supplier.code}`}
      size="md"
    >
      <div className="space-y-4 p-1 text-xs">
        {isLoading ? (
          <LoadingState label="Auditing purchase orders and vendor bills..." />
        ) : (
          <>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded flex items-start space-x-3 rtl:space-x-reverse">
              {isSoftDelete ? (
                <Archive className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              ) : (
                <Trash2 className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
              )}
              <div className="space-y-1">
                <div className="font-bold text-slate-900">
                  {language === 'ar' ? supplier.nameAr : supplier.nameEn} ({supplier.code})
                </div>
                <div className="text-[11px] text-slate-600">
                  {isSoftDelete
                    ? (language === 'ar'
                        ? 'يحتوي هذا المورد على أوامر شراء أو فواتير مسجلة. سيتم أرشفة الحساب للحفاظ على سلامة القيود.'
                        : 'Associated AP bills or POs exist. Supplier will be archived to protect ledger history.')
                    : (language === 'ar'
                        ? 'المورد نظيف ولا توجد عليه قيود مالية. سيتم حذفه بالكامل.'
                        : 'No active transactions detected. Supplier can be safely purged.')}
                </div>
              </div>
            </div>

            {preflightData?.dependentRecords && (
              <div className="border border-slate-200 rounded overflow-hidden">
                <div className="bg-slate-100 px-3 py-1.5 text-[10px] font-bold uppercase text-slate-700">
                  {language === 'ar' ? 'سجل الارتباطات' : 'Dependent Records Summary'}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-white text-center">
                  <div className="bg-slate-50 p-2 rounded border">
                    <div className="text-sm font-bold text-slate-900">{preflightData.dependentRecords.purchaseOrders || 0}</div>
                    <div className="text-[10px] text-slate-500">POs</div>
                  </div>
                  <div className="bg-slate-50 p-2 rounded border">
                    <div className="text-sm font-bold text-slate-900">{preflightData.dependentRecords.goodsReceipts || 0}</div>
                    <div className="text-[10px] text-slate-500">GRNs</div>
                  </div>
                  <div className="bg-slate-50 p-2 rounded border">
                    <div className="text-sm font-bold text-slate-900">{preflightData.dependentRecords.supplierBills || 0}</div>
                    <div className="text-[10px] text-slate-500">AP Bills</div>
                  </div>
                  <div className="bg-slate-50 p-2 rounded border">
                    <div className="text-sm font-bold text-slate-900">{preflightData.dependentRecords.payments || 0}</div>
                    <div className="text-[10px] text-slate-500">Payments</div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-700 uppercase">
                {language === 'ar' ? 'سبب العملية (مطلوب للتدقيق)' : 'Audit Reason (Required)'}
              </label>
              <Input
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="E.g., Vendor relationship terminated / Duplicate entry"
              />
            </div>

            <div className="flex justify-end space-x-2 rtl:space-x-reverse pt-2 border-t border-slate-100">
              <Button variant="secondary" type="button" onClick={onClose} disabled={isDeleting}>
                {language === 'ar' ? 'تراجع' : 'Cancel'}
              </Button>
              <Button
                variant="danger"
                type="button"
                onClick={handleDelete}
                disabled={isDeleting || !reason.trim()}
              >
                {isDeleting
                  ? (language === 'ar' ? 'جاري المعالجة...' : 'Processing...')
                  : isSoftDelete
                  ? (language === 'ar' ? 'تأكيد الأرشفة الآمنة' : 'Confirm Safe Archive')
                  : (language === 'ar' ? 'تأكيد الحذف' : 'Confirm Purge')}
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
