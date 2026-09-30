/**
 * GulfHive ERP - Authoritative Payroll Run Detail Drawer
 * Slide-over drawer inspecting complete payroll batch calculation, validation checks,
 * locking approval flows, posting, reversals, WPS SIF export, Excel spreadsheet export,
 * individual and batch PDF payslips, and granular line item audit traces.
 */

import React, { useState } from 'react';
import { Drawer, Button, Dialog, useToast, Column, Table } from '../../../design-system/index.ts';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import {
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Download,
  Printer,
  FileSpreadsheet,
  Lock,
  Coins,
  RotateCcw,
  Layers,
  ChevronRight,
  Info
} from 'lucide-react';
import { PayslipDocument } from './PayslipDocument.tsx';

export interface PayrollRunDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  run: any;
  company: any;
  onRefresh: () => void;
}

export function PayrollRunDetailDrawer({
  isOpen,
  onClose,
  run,
  company,
  onRefresh,
}: PayrollRunDetailDrawerProps) {
  const { t, language } = useI18n();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<'employees' | 'lines' | 'exceptions'>('employees');
  const [selectedPayslipItem, setSelectedPayslipItem] = useState<any | null>(null);
  const [selectedTraceItem, setSelectedTraceItem] = useState<any | null>(null);
  const [showTraceDialog, setShowTraceDialog] = useState(false);
  const [showReverseDialog, setShowReverseDialog] = useState(false);
  const [reversalReason, setReversalReason] = useState('');

  const [isValidating, setIsValidating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [isReversing, setIsReversing] = useState(false);

  if (!run) return null;

  const handleValidate = async () => {
    setIsValidating(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/payroll/runs/${run.id}/validate`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Validation failed');

      if (data.validation.isValid) {
        addToast({ type: 'success', title: 'Payroll Validated', message: 'All checks passed. Ready for approval.' });
      } else {
        addToast({
          type: 'warning',
          title: 'Validation Issues Detected',
          message: `${data.validation.blockingExceptions?.length || 0} blocking issue(s) require review.`,
        });
      }
      onRefresh();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setIsValidating(false);
    }
  };

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/payroll/runs/${run.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approverId: 'admin' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Approval failed');

      addToast({
        type: 'success',
        title: 'Payroll Approved & Locked',
        message: `Disbursement authorized for ${run.totalNetPay} ${run.currency}`,
      });
      onRefresh();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setIsApproving(false);
    }
  };

  const handlePost = async () => {
    setIsPosting(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/payroll/runs/${run.id}/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posterId: 'admin' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Posting failed');

      addToast({
        type: 'success',
        title: 'Payroll Posted',
        message: `Financial state locked and loan repayments recorded.`,
      });
      onRefresh();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setIsPosting(false);
    }
  };

  const handleReverse = async () => {
    if (!reversalReason.trim()) {
      addToast({ type: 'error', title: 'Validation Error', message: 'Reversal reason is required.' });
      return;
    }
    setIsReversing(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/payroll/runs/${run.id}/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorId: 'admin', reason: reversalReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reversal failed');

      addToast({
        type: 'warning',
        title: 'Payroll Reversed',
        message: 'Payroll status changed to REVERSED and dependent effects rolled back.',
      });
      setShowReverseDialog(false);
      setReversalReason('');
      onRefresh();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setIsReversing(false);
    }
  };

  const handleDownloadWps = () => {
    window.location.href = `/api/companies/${company.id}/payroll/runs/${run.id}/export/wps`;
  };

  const handleDownloadExcel = () => {
    window.location.href = `/api/companies/${company.id}/payroll/runs/${run.id}/export/excel`;
  };

  const handleDownloadBatchPdf = () => {
    window.open(`/api/companies/${company.id}/payroll/runs/${run.id}/payslips/batch/pdf`, '_blank');
  };

  const handleDownloadSinglePdf = (employeeId: string) => {
    window.open(`/api/companies/${company.id}/payroll/runs/${run.id}/payslips/${employeeId}/pdf`, '_blank');
  };

  const itemColumns: Column<any>[] = [
    {
      key: 'employee',
      header: t('payroll.col.employee') || 'Employee',
      sortable: true,
      width: '28%',
      render: (item) => (
        <div>
          <span className="font-semibold text-slate-900 block truncate">
            {language === 'ar' ? item.employeeNameAr : item.employeeNameEn}
          </span>
          <span className="font-mono text-[11px] text-slate-400">{item.employeeNumber}</span>
        </div>
      ),
    },
    {
      key: 'basic',
      header: t('payroll.col.basic') || 'Basic',
      render: (item) => <span className="font-mono text-slate-700">{item.basicSalary}</span>,
    },
    {
      key: 'gross',
      header: t('payroll.col.gross') || 'Gross Pay',
      render: (item) => <span className="font-mono font-medium text-slate-900">{item.grossPay}</span>,
    },
    {
      key: 'deductions',
      header: t('payroll.col.deductions') || 'Deductions',
      render: (item) => (
        <span className="font-mono text-rose-700">
          {parseFloat(item.totalDeductions) > 0 ? `-${item.totalDeductions}` : '0.000'}
        </span>
      ),
    },
    {
      key: 'net',
      header: t('payroll.col.net') || 'Net Pay',
      sortable: true,
      render: (item) => (
        <span className="font-mono font-bold text-slate-900">
          {item.netPay} {item.currency}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (item) => (
        <div className="flex items-center justify-end space-x-1 rtl:space-x-reverse">
          <Button
            size="sm"
            variant="ghost"
            title="Calculation Trace"
            onClick={() => {
              setSelectedTraceItem(item);
              setShowTraceDialog(true);
            }}
          >
            <Info className="w-3.5 h-3.5 text-slate-500" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            title="Download PDF"
            onClick={() => handleDownloadSinglePdf(item.employeeId)}
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setSelectedPayslipItem(item)}>
            {t('payroll.action.view_payslip') || 'Payslip'}
          </Button>
        </div>
      ),
    },
  ];

  const lineColumns: Column<any>[] = [
    {
      key: 'component',
      header: 'Component Code',
      render: (line) => (
        <div>
          <span className="font-mono font-bold text-xs text-slate-900 block">{line.componentCodeSnapshot}</span>
          <span className="text-[11px] text-slate-500">{line.componentNameSnapshot}</span>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (line) => {
        const colors: Record<string, string> = {
          EARNING: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          DEDUCTION: 'bg-rose-50 text-rose-700 border-rose-200',
          EMPLOYER_CONTRIBUTION: 'bg-blue-50 text-blue-700 border-blue-200',
        };
        return (
          <span className={`text-[10px] px-1.5 py-0.5 font-bold rounded border ${colors[line.lineType] || 'bg-slate-50'}`}>
            {line.lineType}
          </span>
        );
      },
    },
    {
      key: 'quantityRate',
      header: 'Qty / Rate',
      render: (line) => (
        <span className="font-mono text-xs text-slate-600">
          {line.quantity ? `${line.quantity} @ ${line.rate || ''}` : '—'}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (line) => (
        <span className={`font-mono text-xs font-bold ${line.lineType === 'DEDUCTION' ? 'text-rose-600' : 'text-slate-900'}`}>
          {line.lineType === 'DEDUCTION' ? `-${line.amount}` : line.amount}
        </span>
      ),
    },
    {
      key: 'rule',
      header: 'Rule Reference',
      render: (line) => (
        <span className="text-[11px] text-slate-400 block truncate max-w-xs">{line.calculationRuleReference || line.sourceType}</span>
      ),
    },
  ];

  const exceptionColumns: Column<any>[] = [
    {
      key: 'severity',
      header: 'Severity',
      width: '15%',
      render: (ex) => {
        const badgeColors: Record<string, string> = {
          BLOCKING: 'bg-rose-100 text-rose-800 border-rose-300',
          WARNING: 'bg-amber-100 text-amber-800 border-amber-300',
          INFO: 'bg-blue-100 text-blue-800 border-blue-300',
        };
        return (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badgeColors[ex.severity] || ''}`}>
            {ex.severity}
          </span>
        );
      },
    },
    {
      key: 'code',
      header: 'Code',
      render: (ex) => <span className="font-mono text-xs font-semibold text-slate-900">{ex.code}</span>,
    },
    {
      key: 'message',
      header: 'Description',
      render: (ex) => (
        <span className="text-xs text-slate-700">
          {language === 'ar' ? ex.messageAr || ex.messageEn : ex.messageEn}
        </span>
      ),
    },
  ];

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        width="xl"
        title={`Payroll Batch — ${run.payrollNumber || `${run.periodYear}/${String(run.periodMonth).padStart(2, '0')}`}`}
        subtitle={`Total: ${run.totalEmployees} Employees · Currency: ${run.currency} · Status: ${run.status} · Run Type: ${run.runType || 'REGULAR'}`}
        footer={
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Download className="w-3.5 h-3.5" />}
                onClick={handleDownloadWps}
              >
                {t('payroll.action.export_wps') || 'WPS SIF'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<FileSpreadsheet className="w-3.5 h-3.5" />}
                onClick={handleDownloadExcel}
              >
                {t('payroll.action.export_excel') || 'Excel'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Printer className="w-3.5 h-3.5" />}
                onClick={handleDownloadBatchPdf}
              >
                {t('payroll.action.batch_payslips') || 'All Payslips (PDF)'}
              </Button>
            </div>

            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              {run.status === 'DRAFT' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleValidate}
                  isLoading={isValidating}
                  leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                >
                  {t('payroll.action.validate') || 'Validate'}
                </Button>
              )}
              {(run.status === 'DRAFT' || run.status === 'VALIDATED') && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleApprove}
                  isLoading={isApproving}
                  leftIcon={<Lock className="w-3.5 h-3.5" />}
                >
                  {t('payroll.action.approve') || 'Approve'}
                </Button>
              )}
              {run.status === 'APPROVED' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handlePost}
                  isLoading={isPosting}
                  leftIcon={<ShieldCheck className="w-3.5 h-3.5" />}
                >
                  {t('payroll.action.post') || 'Post Payroll'}
                </Button>
              )}
              {['APPROVED', 'POSTED'].includes(run.status) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowReverseDialog(true)}
                  leftIcon={<RotateCcw className="w-3.5 h-3.5 text-rose-600" />}
                >
                  {t('payroll.action.reverse') || 'Reverse'}
                </Button>
              )}
            </div>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Batch Financial Summary Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded p-4 font-mono">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider block font-sans">
                {t('payroll.metric.total_gross') || 'Total Gross Pay'}
              </span>
              <span className="text-xl font-bold text-slate-900 block mt-1">
                {run.totalGrossPay} {run.currency}
              </span>
            </div>

            <div className="bg-rose-50/50 border border-rose-200 rounded p-4 font-mono">
              <span className="text-[11px] text-rose-600 uppercase tracking-wider block font-sans">
                {t('payroll.metric.total_deductions') || 'Total Deductions'}
              </span>
              <span className="text-xl font-bold text-rose-700 block mt-1">
                -{run.totalDeductions} {run.currency}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-950 rounded p-4 font-mono text-white">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-sans">
                {t('payroll.metric.net_disbursement') || 'Net Disbursement'}
              </span>
              <span className="text-xl font-bold text-white block mt-1">
                {run.totalNetPay} {run.currency}
              </span>
            </div>
          </div>

          {/* Tab Navigation inside Drawer */}
          <div className="flex border-b border-slate-200 space-x-6 rtl:space-x-reverse text-sm">
            <button
              onClick={() => setActiveTab('employees')}
              className={`pb-2.5 font-medium flex items-center space-x-1.5 rtl:space-x-reverse ${
                activeTab === 'employees'
                  ? 'border-b-2 border-slate-900 text-slate-900'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{t('payroll.tab.employees') || 'Employees'}</span>
              <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">
                {run.items?.length || 0}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('lines')}
              className={`pb-2.5 font-medium flex items-center space-x-1.5 rtl:space-x-reverse ${
                activeTab === 'lines'
                  ? 'border-b-2 border-slate-900 text-slate-900'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{t('payroll.tab.result_lines') || 'Audit Result Lines'}</span>
              <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">
                {run.lines?.length || 0}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('exceptions')}
              className={`pb-2.5 font-medium flex items-center space-x-1.5 rtl:space-x-reverse ${
                activeTab === 'exceptions'
                  ? 'border-b-2 border-slate-900 text-slate-900'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{t('payroll.tab.exceptions') || 'Exceptions & Warnings'}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  (run.exceptions?.length || 0) > 0 ? 'bg-amber-100 text-amber-800 font-bold' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {run.exceptions?.length || 0}
              </span>
            </button>
          </div>

          {/* Active Tab View */}
          {activeTab === 'employees' && (
            <Table
              columns={itemColumns}
              data={run.items || []}
              keyExtractor={(item) => item.id}
              emptyTitle={t('payroll.empty.no_items') || 'No calculated items found'}
            />
          )}

          {activeTab === 'lines' && (
            <Table
              columns={lineColumns}
              data={run.lines || []}
              keyExtractor={(line) => line.id}
              emptyTitle="No result line records generated"
            />
          )}

          {activeTab === 'exceptions' && (
            <Table
              columns={exceptionColumns}
              data={run.exceptions || []}
              keyExtractor={(ex) => ex.id}
              emptyTitle="No payroll exceptions detected. Clean batch."
            />
          )}
        </div>
      </Drawer>

      {/* Payslip View Dialog */}
      <Dialog
        isOpen={!!selectedPayslipItem}
        onClose={() => setSelectedPayslipItem(null)}
        title={t('payroll.payslip.title') || 'Official Salary Payslip'}
        size="xl"
      >
        {selectedPayslipItem && (
          <PayslipDocument
            item={selectedPayslipItem}
            company={company}
            periodYear={run.periodYear}
            periodMonth={run.periodMonth}
            onClose={() => setSelectedPayslipItem(null)}
          />
        )}
      </Dialog>

      {/* Calculation Trace Modal */}
      <Dialog
        isOpen={showTraceDialog}
        onClose={() => setShowTraceDialog(false)}
        title={`Calculation Breakdown — ${selectedTraceItem?.employeeNumber || ''}`}
        size="lg"
      >
        {selectedTraceItem && (
          <div className="space-y-4 font-mono text-xs">
            <div className="bg-slate-900 text-white p-4 rounded-lg space-y-2">
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-400">Regular Package:</span>
                <span>{selectedTraceItem.calculationBreakdown?.basePackage?.regularTotal} {selectedTraceItem.currency}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-400">Overtime Amount:</span>
                <span>+{selectedTraceItem.overtimeAmount} {selectedTraceItem.currency}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-400">Gross Total:</span>
                <span className="font-bold text-emerald-400">{selectedTraceItem.grossPay} {selectedTraceItem.currency}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-400">Total Deductions:</span>
                <span className="text-rose-400">-{selectedTraceItem.totalDeductions} {selectedTraceItem.currency}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-slate-300 font-bold">Net Payable:</span>
                <span className="text-base font-bold text-sky-400">{selectedTraceItem.netPay} {selectedTraceItem.currency}</span>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3 rounded space-y-1 font-sans text-xs">
              <span className="font-bold text-slate-800 block">Statutory Compliance Rules:</span>
              <p className="text-slate-600">
                Scheme: {selectedTraceItem.calculationBreakdown?.statutoryPension?.scheme || 'None'}<br />
                Employee Contribution: {selectedTraceItem.statutoryEmployeeContribution} {selectedTraceItem.currency}<br />
                Employer Contribution: {selectedTraceItem.statutoryEmployerContribution} {selectedTraceItem.currency}
              </p>
            </div>
          </div>
        )}
      </Dialog>

      {/* Controlled Reversal Confirmation Dialog */}
      <Dialog
        isOpen={showReverseDialog}
        onClose={() => setShowReverseDialog(false)}
        title="Controlled Payroll Reversal"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Reversing a posted payroll preserves the audit history while resetting loan balances and marking the run as REVERSED. Please specify the business justification.
          </p>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Reason for Reversal *</label>
            <input
              type="text"
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
              placeholder="e.g. Discrepancy in timesheet hours after posting"
              className="w-full text-sm border border-slate-300 rounded px-3 py-2 outline-none focus:border-slate-800"
            />
          </div>
          <div className="flex justify-end space-x-2 rtl:space-x-reverse pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowReverseDialog(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleReverse} isLoading={isReversing}>
              Confirm Reversal
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
