import React, { useState, useEffect } from 'react';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import { Button, Input, Dialog, useToast, LoadingState } from '../../../design-system/index.ts';
import { apiClient } from '../../../lib/api-client.ts';
import { Archive, Trash2 } from 'lucide-react';

interface ProjectPreflightDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: any;
  companyId: string;
  onDeleted: () => void;
}

export function ProjectPreflightDeleteModal({
  isOpen,
  onClose,
  project,
  companyId,
  onDeleted,
}: ProjectPreflightDeleteModalProps) {
  const { language } = useI18n();
  const { addToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [preflightData, setPreflightData] = useState<any | null>(null);
  const [reason, setReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen && project) {
      setIsLoading(true);
      setReason('');
      apiClient.get(`/api/companies/${companyId}/projects/${project.id}/preflight`)
        .then((data) => setPreflightData(data?.preflight || null))
        .catch((err) => console.error(err))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, project, companyId]);

  if (!isOpen || !project) return null;

  const handleDelete = async () => {
    if (!reason.trim()) {
      addToast({
        type: 'error',
        title: language === 'ar' ? 'سبب العملية مطلوب' : 'Audit Reason Required',
        message: language === 'ar' ? 'يرجى إدخال سبب الإلغاء أو الحذف.' : 'Please provide an audit reason.',
      });
      return;
    }

    setIsDeleting(true);
    try {
      const data = await apiClient.delete(`/api/companies/${companyId}/projects/${project.id}`, {
        body: JSON.stringify({ reason }),
      });

      const actionType = data?.result?.action || 'DELETED';
      addToast({
        type: 'success',
        title: language === 'ar' ? 'تمت العملية' : 'Success',
        message:
          actionType === 'SOFT_DELETE'
            ? (language === 'ar' ? 'تم إغلاق وأرشفة المشروع بأمان للحفاظ على سجلات العمالة.' : 'Project safely closed and archived with audit preservation.')
            : (language === 'ar' ? 'تم حذف المشروع نهائياً لعدم وجود سجلات مرتبطة.' : 'Project permanently purged.'),
      });
      onDeleted();
      onClose();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message || 'Operation failed' });
    } finally {
      setIsDeleting(false);
    }
  };

  const isSoftDelete = preflightData?.action === 'SOFT_DELETE' || (preflightData?.dependentRecords && Object.values(preflightData.dependentRecords).some((v: any) => v > 0));

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`${language === 'ar' ? 'فحص تدقيق حذف المشروع' : 'Project Deletion Audit Guard'}: ${project.projectCode}`}
      size="md"
    >
      <div className="space-y-4 p-1 text-xs">
        {isLoading ? (
          <LoadingState label="Analyzing project contracts, deployments, and labour settlements..." />
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
                  {language === 'ar' ? project.nameAr : project.nameEn} ({project.projectCode})
                </div>
                <div className="text-[11px] text-slate-600">
                  {isSoftDelete
                    ? (language === 'ar'
                        ? 'يحتوي هذا المشروع على سجلات تشغيل وعمالة. سيتم إغلاق المشروع وأرشفته لمنع فقدان البيانات التاريخية.'
                        : 'Historical workforce deployments or settlement records exist. Record will be softly archived to preserve operational audit.')
                    : (language === 'ar'
                        ? 'المشروع نظيف وخالٍ من العمليات. سيتم حذفه بالكامل.'
                        : 'No active workforce history detected. Project record will be permanently deleted.')}
                </div>
              </div>
            </div>

            {preflightData?.dependentRecords && (
              <div className="grid grid-cols-2 gap-2 p-3 bg-white border rounded text-center">
                <div className="bg-slate-50 p-2 rounded border">
                  <div className="text-sm font-bold text-slate-900">{preflightData.dependentRecords.deployments || 0}</div>
                  <div className="text-[10px] text-slate-500">Deployments</div>
                </div>
                <div className="bg-slate-50 p-2 rounded border">
                  <div className="text-sm font-bold text-slate-900">{preflightData.dependentRecords.settlements || 0}</div>
                  <div className="text-[10px] text-slate-500">Labour Settlements</div>
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
                placeholder="E.g., Contract scope completed / cancellation agreement"
              />
            </div>

            <div className="flex justify-end space-x-2 rtl:space-x-reverse pt-2 border-t">
              <Button variant="secondary" type="button" onClick={onClose} disabled={isDeleting}>
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                variant="danger"
                type="button"
                onClick={handleDelete}
                disabled={isDeleting || !reason.trim()}
              >
                {isDeleting
                  ? 'Processing...'
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
