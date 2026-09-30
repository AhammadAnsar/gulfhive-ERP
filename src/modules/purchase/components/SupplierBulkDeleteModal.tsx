import React, { useState, useEffect } from 'react';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import { Button, Input, Dialog, useToast, LoadingState } from '../../../design-system/index.ts';
import { ShieldAlert } from 'lucide-react';

interface SupplierBulkDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierIds: number[];
  companyId: string;
  onCompleted: () => void;
}

export function SupplierBulkDeleteModal({
  isOpen,
  onClose,
  supplierIds,
  companyId,
  onCompleted,
}: SupplierBulkDeleteModalProps) {
  const { language } = useI18n();
  const { addToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [preflightSummary, setPreflightSummary] = useState<any | null>(null);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && supplierIds.length > 0) {
      setIsLoading(true);
      setReason('');
      fetch(`/api/companies/${companyId}/procurement/suppliers/bulk-delete/preflight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierIds }),
      })
        .then((res) => res.json())
        .then((data) => {
          setPreflightSummary(data.preflight || null);
        })
        .catch((err) => {
          console.error(err);
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, supplierIds, companyId]);

  if (!isOpen || supplierIds.length === 0) return null;

  const handleExecuteBulk = async () => {
    if (!reason.trim()) {
      addToast({
        type: 'error',
        title: language === 'ar' ? 'سبب العملية مطلوب' : 'Audit Reason Required',
        message: language === 'ar' ? 'يرجى إدخال سبب الحذف / الأرشفة.' : 'Please enter an audit reason.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/procurement/suppliers/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierIds, reason }),
      });

      if (res.ok) {
        addToast({
          type: 'success',
          title: language === 'ar' ? 'اكتملت العملية' : 'Bulk Operation Completed',
          message:
            language === 'ar'
              ? `تمت معالجة ${supplierIds.length} مورد بنجاح.`
              : `Processed ${supplierIds.length} supplier records safely.`,
        });
        onCompleted();
        onClose();
      } else {
        const err = await res.json();
        addToast({
          type: 'error',
          title: language === 'ar' ? 'خطأ' : 'Error',
          message: err.error || 'Failed to execute bulk delete',
        });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message || 'Network error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={language === 'ar' ? `إدارة وحذف جماعي (${supplierIds.length} مورد)` : `Bulk Vendor Action (${supplierIds.length} Vendors)`}
      size="md"
    >
      <div className="space-y-4 p-1 text-xs">
        {isLoading ? (
          <LoadingState label="Running bulk preflight audit on selected vendors..." />
        ) : (
          <>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-900 space-y-1">
              <div className="font-bold flex items-center space-x-1.5 rtl:space-x-reverse">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>{language === 'ar' ? 'حماية الحسابات الدائنة' : 'Accounts Payable Ledger Guard'}</span>
              </div>
              <p className="text-[11px] text-amber-800">
                {language === 'ar'
                  ? 'الموردون ذوو السجلات المالية سيتم أرشفتهم تلقائياً (INACTIVE) لضمان دقة قيود المشتريات. الحسابات الخالية من القيود سيتم حذفها نهائياً.'
                  : 'Vendors with AP transactions will be softly archived to preserve general ledger integrity. Unused vendors will be purged.'}
              </p>
            </div>

            {preflightSummary && (
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                  <div className="text-base font-bold text-slate-900">{preflightSummary.hardDeleteCount || 0}</div>
                  <div className="text-[10px] text-slate-500 uppercase">Eligible for Purge</div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                  <div className="text-base font-bold text-amber-600">{preflightSummary.softDeleteCount || 0}</div>
                  <div className="text-[10px] text-slate-500 uppercase">Safe Soft Archive</div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-700 uppercase">
                {language === 'ar' ? 'سبب الإجراء الجماعي (مطلوب)' : 'Audit Reason (Required)'}
              </label>
              <Input
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="E.g., Inactive vendor cleanup / quarterly review"
              />
            </div>

            <div className="flex justify-end space-x-2 rtl:space-x-reverse pt-2 border-t border-slate-100">
              <Button variant="secondary" type="button" onClick={onClose} disabled={isSubmitting}>
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                variant="danger"
                type="button"
                onClick={handleExecuteBulk}
                disabled={isSubmitting || !reason.trim()}
              >
                {isSubmitting
                  ? (language === 'ar' ? 'جاري التنفيذ...' : 'Executing...')
                  : (language === 'ar' ? 'تأكيد المعالجة الجماعية' : 'Confirm Bulk Execution')}
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
