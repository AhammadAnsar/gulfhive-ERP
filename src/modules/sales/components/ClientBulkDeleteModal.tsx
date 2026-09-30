import React, { useState, useEffect } from 'react';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import { Button, Input, Dialog, useToast, LoadingState } from '../../../design-system/index.ts';
import { ShieldAlert, Layers } from 'lucide-react';

interface ClientBulkDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientIds: number[];
  companyId: string;
  onCompleted: () => void;
}

export function ClientBulkDeleteModal({
  isOpen,
  onClose,
  clientIds,
  companyId,
  onCompleted,
}: ClientBulkDeleteModalProps) {
  const { language } = useI18n();
  const { addToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [preflightSummary, setPreflightSummary] = useState<any | null>(null);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && clientIds.length > 0) {
      setIsLoading(true);
      setReason('');
      fetch(`/api/companies/${companyId}/sales/clients/bulk-delete/preflight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientIds }),
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
  }, [isOpen, clientIds, companyId]);

  if (!isOpen || clientIds.length === 0) return null;

  const handleExecuteBulk = async () => {
    if (!reason.trim()) {
      addToast({
        type: 'error',
        title: language === 'ar' ? 'سبب العملية مطلوب' : 'Audit Reason Required',
        message: language === 'ar' ? 'يرجى إدخال سبب الحذف / الأرشفة الجماعية.' : 'Please enter an audit reason.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/sales/clients/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientIds, reason }),
      });

      if (res.ok) {
        const data = await res.json();
        addToast({
          type: 'success',
          title: language === 'ar' ? 'اكتملت المعالجة الجماعية' : 'Bulk Operation Completed',
          message:
            language === 'ar'
              ? `تمت معالجة ${clientIds.length} عميل بنجاح.`
              : `Processed ${clientIds.length} client records safely.`,
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
      title={language === 'ar' ? `إدارة وحذف جماعي (${clientIds.length} عملاء)` : `Bulk Client Management (${clientIds.length} Clients)`}
      size="md"
    >
      <div className="space-y-4 p-1 text-xs">
        {isLoading ? (
          <LoadingState label={language === 'ar' ? 'جاري التدقيق المسبق للعمليات...' : 'Running bulk preflight audit on selected records...'} />
        ) : (
          <>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-900 space-y-1">
              <div className="font-bold flex items-center space-x-1.5 rtl:space-x-reverse">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>{language === 'ar' ? 'تدقيق السلامة المحاسبية' : 'Financial Ledger Integrity Check'}</span>
              </div>
              <p className="text-[11px] text-amber-800">
                {language === 'ar'
                  ? 'سيتم الحذف الفعلي فقط للحسابات النظيفة التي لا تحتوي على قيود. أما الحسابات ذات التاريخ المالي فسيتم أرشفتها تلقائياً كـ (غير نشط) لضمان دقة القوائم المالية.'
                  : 'Clients with financial transactions will be safely archived (marked INACTIVE) to protect general ledger history. Clients with zero history will be purged.'}
              </p>
            </div>

            {preflightSummary && (
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                  <div className="text-base font-bold text-slate-900">{preflightSummary.hardDeleteCount || 0}</div>
                  <div className="text-[10px] text-slate-500 uppercase">{language === 'ar' ? 'حذف نهائي فوري' : 'Eligible for Purge'}</div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                  <div className="text-base font-bold text-amber-600">{preflightSummary.softDeleteCount || 0}</div>
                  <div className="text-[10px] text-slate-500 uppercase">{language === 'ar' ? 'أرشفة آمنة (لوجود قيود)' : 'Safe Soft Archive'}</div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-700 uppercase">
                {language === 'ar' ? 'سبب الإجراء الجماعي (مطلوب)' : 'Bulk Action Reason (Required for Audit)'}
              </label>
              <Input
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  language === 'ar'
                    ? 'مثال: تنظيف سجلات غير مستخدمة / مراجعة دورية'
                    : 'E.g. Inactive account clean-up / periodic audit'
                }
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
