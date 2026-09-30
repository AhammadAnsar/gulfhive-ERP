import React, { useState, useEffect } from 'react';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import { Button, Input, Dialog, useToast, LoadingState } from '../../../design-system/index.ts';
import { AlertTriangle, ShieldAlert, Archive, Trash2 } from 'lucide-react';

interface ClientPreflightDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: any;
  companyId: string;
  onDeleted: () => void;
}

export function ClientPreflightDeleteModal({
  isOpen,
  onClose,
  client,
  companyId,
  onDeleted,
}: ClientPreflightDeleteModalProps) {
  const { language } = useI18n();
  const { addToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [preflightData, setPreflightData] = useState<any | null>(null);
  const [reason, setReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen && client) {
      setIsLoading(true);
      setReason('');
      fetch(`/api/companies/${companyId}/sales/clients/${client.id}/preflight`)
        .then((res) => res.json())
        .then((data) => {
          setPreflightData(data.preflight || null);
        })
        .catch((err) => {
          console.error(err);
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, client, companyId]);

  if (!isOpen || !client) return null;

  const handleDelete = async () => {
    if (!reason.trim()) {
      addToast({
        type: 'error',
        title: language === 'ar' ? 'مطلوب توثيق السبب' : 'Audit Reason Required',
        message: language === 'ar' ? 'يرجى إدخال سبب الإلغاء أو الحذف لتوثيق التدقيق.' : 'Please provide an audit reason.',
      });
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/sales/clients/${client.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (res.ok) {
        const data = await res.json();
        const actionType = data.result?.action || 'DELETED';
        addToast({
          type: 'success',
          title: language === 'ar' ? 'تمت العملية' : 'Completed Successfully',
          message:
            actionType === 'SOFT_DELETE'
              ? (language === 'ar' ? 'تم أرشفة العميل بنجاح لمنع الإخلال بالسجلات التاريخية.' : 'Client safely archived with preserved transaction history.')
              : (language === 'ar' ? 'تم حذف العميل نهائياً لعدم وجود قيود مرتبطة.' : 'Client record permanently purged.'),
        });
        onDeleted();
        onClose();
      } else {
        const err = await res.json();
        addToast({
          type: 'error',
          title: language === 'ar' ? 'تعذرت العملية' : 'Action Prevented',
          message: err.error || 'Failed to delete client',
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
      title={`${language === 'ar' ? 'فحص تدقيق الحذف والأرشفة' : 'Client Deletion Audit Guard'}: ${client.code}`}
      size="md"
    >
      <div className="space-y-4 p-1 text-xs">
        {isLoading ? (
          <LoadingState label={language === 'ar' ? 'جاري فحص القيود والاعتماديات...' : 'Analyzing financial ledger & sales dependencies...'} />
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
                  {language === 'ar' ? client.nameAr : client.nameEn} ({client.code})
                </div>
                <div className="text-[11px] text-slate-600">
                  {isSoftDelete
                    ? (language === 'ar'
                        ? 'يحتوي هذا العميل على سجلات مرتبطة (فواتير، عروض، أو عقود). سيتم أرشفة الحساب تلقائياً للحفاظ على سلامة القيود المحاسبية.'
                        : 'This client has associated historical transactions. To preserve double-entry audit integrity, the record will be softly archived.')
                    : (language === 'ar'
                        ? 'هذا العميل نظيف ولا توجد عليه أي معاملات مالية. سيتم حذفه بالكامل من قاعدة البيانات.'
                        : 'No active transactions detected. Client can be safely purged.')}
                </div>
              </div>
            </div>

            {/* Breakdown of dependent entities */}
            {preflightData?.dependentRecords && (
              <div className="border border-slate-200 rounded overflow-hidden">
                <div className="bg-slate-100 px-3 py-1.5 text-[10px] font-bold uppercase text-slate-700">
                  {language === 'ar' ? 'سجل الارتباطات والعمليات' : 'Dependent Records Summary'}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-white text-center">
                  <div className="bg-slate-50 p-2 rounded border">
                    <div className="text-sm font-bold text-slate-900">{preflightData.dependentRecords.quotations || 0}</div>
                    <div className="text-[10px] text-slate-500">{language === 'ar' ? 'عروض أسعار' : 'Quotations'}</div>
                  </div>
                  <div className="bg-slate-50 p-2 rounded border">
                    <div className="text-sm font-bold text-slate-900">{preflightData.dependentRecords.salesOrders || 0}</div>
                    <div className="text-[10px] text-slate-500">{language === 'ar' ? 'أوامر بيع' : 'Sales Orders'}</div>
                  </div>
                  <div className="bg-slate-50 p-2 rounded border">
                    <div className="text-sm font-bold text-slate-900">{preflightData.dependentRecords.invoices || 0}</div>
                    <div className="text-[10px] text-slate-500">{language === 'ar' ? 'فواتير' : 'Invoices'}</div>
                  </div>
                  <div className="bg-slate-50 p-2 rounded border">
                    <div className="text-sm font-bold text-slate-900">{preflightData.dependentRecords.receipts || 0}</div>
                    <div className="text-[10px] text-slate-500">{language === 'ar' ? 'سندات قبض' : 'Receipts'}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-700 uppercase">
                {language === 'ar' ? 'سبب العملية (مطلوب للتدقيق)' : 'Audit Deletion Reason (Required)'}
              </label>
              <Input
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  language === 'ar'
                    ? 'مثال: إغلاق حساب العميل / دمج سجلات / انتهاء التعاقد'
                    : 'E.g., Client account closed / consolidated / contract concluded'
                }
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
                  : (language === 'ar' ? 'تأكيد الحذف النهائي' : 'Confirm Permanent Purge')}
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
