import React, { useState, useEffect } from 'react';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import { Button, Input, Dialog, useToast, LoadingState } from '../../../design-system/index.ts';
import { ShieldAlert } from 'lucide-react';

interface ProjectBulkDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectIds: number[];
  companyId: string;
  onCompleted: () => void;
}

export function ProjectBulkDeleteModal({
  isOpen,
  onClose,
  projectIds,
  companyId,
  onCompleted,
}: ProjectBulkDeleteModalProps) {
  const { language } = useI18n();
  const { addToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [preflightSummary, setPreflightSummary] = useState<any | null>(null);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && projectIds.length > 0) {
      setIsLoading(true);
      setReason('');
      fetch(`/api/companies/${companyId}/projects/bulk-delete/preflight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectIds }),
      })
        .then((res) => res.json())
        .then((data) => setPreflightSummary(data.preflight || null))
        .catch((err) => console.error(err))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, projectIds, companyId]);

  if (!isOpen || projectIds.length === 0) return null;

  const handleExecuteBulk = async () => {
    if (!reason.trim()) {
      addToast({
        type: 'error',
        title: language === 'ar' ? 'سبب العملية مطلوب' : 'Audit Reason Required',
        message: language === 'ar' ? 'يرجى إدخال سبب الحذف / الإغلاق الجماعي.' : 'Please enter an audit reason.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/projects/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectIds, reason }),
      });

      if (res.ok) {
        addToast({
          type: 'success',
          title: language === 'ar' ? 'اكتملت العملية' : 'Bulk Operation Completed',
          message:
            language === 'ar'
              ? `تمت معالجة ${projectIds.length} مشروع بأمان.`
              : `Processed ${projectIds.length} project records safely.`,
        });
        onCompleted();
        onClose();
      } else {
        const err = await res.json();
        addToast({ type: 'error', title: 'Error', message: err.error || 'Failed bulk delete' });
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
      title={language === 'ar' ? `إدارة وحذف جماعي للمشاريع (${projectIds.length} مشاريع)` : `Bulk Project Action (${projectIds.length} Projects)`}
      size="md"
    >
      <div className="space-y-4 p-1 text-xs">
        {isLoading ? (
          <LoadingState label="Running bulk preflight audit on selected projects..." />
        ) : (
          <>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-900 space-y-1">
              <div className="font-bold flex items-center space-x-1.5 rtl:space-x-reverse">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Operational Audit Preservation Guard</span>
              </div>
              <p className="text-[11px] text-amber-800">
                Projects with operational history will be safely closed & archived to protect worker deployment records and general ledger integrity.
              </p>
            </div>

            {preflightSummary && (
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-slate-50 p-2.5 rounded border">
                  <div className="text-base font-bold text-slate-900">{preflightSummary.hardDeleteCount || 0}</div>
                  <div className="text-[10px] text-slate-500 uppercase">Eligible for Purge</div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded border">
                  <div className="text-base font-bold text-amber-600">{preflightSummary.softDeleteCount || 0}</div>
                  <div className="text-[10px] text-slate-500 uppercase">Safe Soft Archive</div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-700 uppercase">Audit Reason</label>
              <Input
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="E.g., Quarterly project review / contract completion"
              />
            </div>

            <div className="flex justify-end space-x-2 rtl:space-x-reverse pt-2 border-t">
              <Button variant="secondary" type="button" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                variant="danger"
                type="button"
                onClick={handleExecuteBulk}
                disabled={isSubmitting || !reason.trim()}
              >
                {isSubmitting ? 'Executing...' : 'Confirm Bulk Execution'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
