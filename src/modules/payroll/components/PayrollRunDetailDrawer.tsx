/**
 * GulfHive ERP - Payroll Run Detail Drawer
 * Slide-over drawer inspecting complete payroll batch calculation, validation checks,
 * locking approval flows, WPS SIF export, Excel spreadsheet export, and individual employee payslips.
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
  Coins
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

  const [selectedPayslipItem, setSelectedPayslipItem] = useState<any | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

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
          message: data.validation.issues.join('; '),
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

  const handleDownloadWps = () => {
    window.location.href = `/api/companies/${company.id}/payroll/runs/${run.id}/export/wps`;
  };

  const handleDownloadExcel = () => {
    window.location.href = `/api/companies/${company.id}/payroll/runs/${run.id}/export/excel`;
  };

  const itemColumns: Column<any>[] = [
    {
      key: 'employee',
      header: 'Employee',
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
      header: 'Basic',
      render: (item) => <span className="font-mono text-slate-700">{item.basicSalary}</span>,
    },
    {
      key: 'gross',
      header: 'Gross Pay',
      render: (item) => <span className="font-mono font-medium text-slate-900">{item.grossPay}</span>,
    },
    {
      key: 'deductions',
      header: 'Deductions',
      render: (item) => (
        <span className="font-mono text-rose-700">
          {parseFloat(item.totalDeductions) > 0 ? `-${item.totalDeductions}` : '0.000'}
        </span>
      ),
    },
    {
      key: 'net',
      header: 'Net Pay',
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
        <Button size="sm" variant="secondary" onClick={() => setSelectedPayslipItem(item)}>
          {t('payroll.action.view_payslip')}
        </Button>
      ),
    },
  ];

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        width="xl"
        title={`Payroll Batch — ${run.periodYear}/${String(run.periodMonth).padStart(2, '0')}`}
        subtitle={`Total Employees: ${run.totalEmployees} · Currency: ${run.currency} · Status: ${run.status}`}
        footer={
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Download className="w-3.5 h-3.5" />}
                onClick={handleDownloadWps}
              >
                {t('payroll.action.export_wps')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<FileSpreadsheet className="w-3.5 h-3.5" />}
                onClick={handleDownloadExcel}
              >
                {t('payroll.action.export_excel')}
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
                  {t('payroll.action.validate')}
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
                  {t('payroll.action.approve')}
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
              <span className="text-slate-400 block text-[10px] uppercase">Total Gross Wages:</span>
              <span className="text-base font-bold text-slate-900 block mt-0.5">
                {run.totalGrossPay} {run.currency}
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded p-4 font-mono">
              <span className="text-slate-400 block text-[10px] uppercase">Total Statutory Deductions:</span>
              <span className="text-base font-bold text-rose-700 block mt-0.5">
                -{run.totalDeductions} {run.currency}
              </span>
            </div>
            <div className="bg-slate-900 text-white rounded p-4 font-mono">
              <span className="text-slate-300 block text-[10px] uppercase">Total Net Disbursement:</span>
              <span className="text-base font-bold text-white block mt-0.5">
                {run.totalNetPay} {run.currency}
              </span>
            </div>
          </div>

          {/* Locked Status Notice */}
          {run.status === 'APPROVED' && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900 flex items-center justify-between">
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Approved and locked for disbursement. Controlled adjustments required for modifications.</span>
              </div>
              <span className="font-mono text-[10px] text-emerald-700">
                Audited by: {run.approvedBy}
              </span>
            </div>
          )}

          {/* Payslip Items Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-900">
              Employee Payslip Records ({run.items?.length || 0})
            </h4>
            <Table
              columns={itemColumns}
              data={run.items || []}
              keyExtractor={(i) => i.id}
              searchable={true}
              searchPlaceholder="Search employee payslip..."
              pageSize={8}
            />
          </div>
        </div>
      </Drawer>

      {/* Individual Payslip Modal */}
      <Dialog
        isOpen={!!selectedPayslipItem}
        onClose={() => setSelectedPayslipItem(null)}
        size="lg"
        title="Employee Payslip"
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
    </>
  );
}
