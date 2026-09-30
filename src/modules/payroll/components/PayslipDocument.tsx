/**
 * GulfHive ERP - Official Employee Payslip Component
 * Print-ready corporate payslip adhering to clean typography, bilingual legal layout,
 * side-by-side earnings & deductions, and statutory explainability audit trace.
 */

import React from 'react';
import { Printer, ShieldCheck, Building2, CreditCard, Info } from 'lucide-react';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import { Button } from '../../../design-system/index.ts';

export interface PayslipDocumentProps {
  item: any;
  company: any;
  periodYear: number;
  periodMonth: number;
  onClose?: () => void;
}

export function PayslipDocument({
  item,
  company,
  periodYear,
  periodMonth,
  onClose,
}: PayslipDocumentProps) {
  const { t, language } = useI18n();

  const handlePrint = () => {
    window.print();
  };

  const breakdown = item.calculationBreakdown || {};

  return (
    <div className="space-y-6">
      {/* Top Action Toolbar */}
      <div className="flex items-center justify-between no-print border-b border-slate-200 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{t('payroll.payslip.title')}</h3>
          <p className="text-xs text-slate-500">
            Period: {periodYear}-{String(periodMonth).padStart(2, '0')} · {item.employeeNumber}
          </p>
        </div>
        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <Button variant="primary" size="sm" onClick={handlePrint} leftIcon={<Printer className="w-3.5 h-3.5" />}>
            {t('payroll.payslip.print')}
          </Button>
          {onClose && (
            <Button variant="secondary" size="sm" onClick={onClose}>
              {t('action.cancel')}
            </Button>
          )}
        </div>
      </div>

      {/* Payslip Document Body */}
      <div
        id="printable-payslip"
        className="bg-white border border-slate-300 rounded-lg p-6 sm:p-8 max-w-3xl mx-auto shadow-sm text-slate-900 font-sans"
      >
        {/* Header: Company & Official Title */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4 mb-6">
          <div>
            <div className="flex items-center space-x-2 rtl:space-x-reverse mb-1">
              <div className="w-7 h-7 rounded bg-slate-900 text-white font-bold flex items-center justify-center text-xs">
                GH
              </div>
              <h2 className="text-base font-bold tracking-tight text-slate-900">
                {language === 'ar' ? company?.legalNameAr : company?.legalNameEn || 'GulfHive Enterprise'}
              </h2>
            </div>
            <p className="text-xs font-arabic text-slate-600">
              {language === 'ar' ? company?.legalNameEn : company?.legalNameAr}
            </p>
            <div className="text-[11px] text-slate-500 font-mono mt-1 space-x-2 rtl:space-x-reverse">
              <span>CR: {company?.crNumber || '—'}</span>
              <span>•</span>
              <span>TIN: {company?.taxNumber || '—'}</span>
              <span>•</span>
              <span>Jurisdiction: {company?.countryCode}-GCC</span>
            </div>
          </div>

          <div className="text-right rtl:text-left">
            <span className="text-xs uppercase font-mono font-bold tracking-widest text-slate-400 block">
              CONFIDENTIAL PAYSLIP
            </span>
            <span className="text-base font-bold font-mono text-slate-900 block mt-1">
              {periodYear} / {String(periodMonth).padStart(2, '0')}
            </span>
            <span className="text-[10px] text-slate-400 font-mono block">
              Ref: {item.id}
            </span>
          </div>
        </div>

        {/* Employee Master Metadata Grid */}
        <div className="bg-slate-50 border border-slate-200 rounded p-4 mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">Employee Number:</span>
            <span className="font-bold text-slate-900">{item.employeeNumber}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">Employee Name:</span>
            <span className="font-semibold text-slate-900 block truncate">{item.employeeNameEn}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">Payment Routing:</span>
            <span className="font-semibold text-slate-900">{item.bankName || 'WPS Transfer'}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">Currency:</span>
            <span className="font-bold text-slate-900">{item.currency}</span>
          </div>
          <div className="col-span-2 sm:col-span-4 pt-2 border-t border-slate-200 text-[11px]">
            <span className="text-slate-400 uppercase text-[10px] me-2">WPS IBAN:</span>
            <span className="font-bold text-slate-800 tracking-wider">{item.iban || 'Pending Registration'}</span>
          </div>
        </div>

        {/* Side-by-Side: Earnings vs Deductions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          {/* Earnings Column */}
          <div className="border border-slate-200 rounded p-4 bg-white flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 pb-2 border-b border-slate-100 flex items-center justify-between">
                <span>{t('payroll.payslip.earnings')}</span>
                <span className="text-[10px] font-mono text-slate-400">CREDIT</span>
              </h4>
              <div className="mt-3 space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-600">Basic Wage:</span>
                  <span className="font-semibold text-slate-900">{item.basicSalary}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Housing Allowance:</span>
                  <span className="text-slate-900">{item.housingAllowance}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Transport Allowance:</span>
                  <span className="text-slate-900">{item.transportAllowance}</span>
                </div>
                {parseFloat(item.otherAllowances || '0') > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Other Allowances:</span>
                    <span className="text-slate-900">{item.otherAllowances}</span>
                  </div>
                )}
                {parseFloat(item.overtimeAmount || '0') > 0 && (
                  <div className="flex justify-between text-amber-800">
                    <span>Overtime ({item.overtimeHours} hrs):</span>
                    <span className="font-bold">+{item.overtimeAmount}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 mt-4 border-t border-slate-200 flex justify-between font-mono font-bold text-xs">
              <span className="text-slate-900">Gross Earnings:</span>
              <span className="text-slate-900">{item.grossPay} {item.currency}</span>
            </div>
          </div>

          {/* Deductions Column */}
          <div className="border border-slate-200 rounded p-4 bg-white flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 pb-2 border-b border-slate-100 flex items-center justify-between">
                <span>{t('payroll.payslip.deductions')}</span>
                <span className="text-[10px] font-mono text-slate-400">DEBIT</span>
              </h4>
              <div className="mt-3 space-y-2 text-xs font-mono">
                {item.unpaidLeaveDays > 0 ? (
                  <div className="flex justify-between text-rose-700">
                    <span>Unpaid Leave ({item.unpaidLeaveDays}d):</span>
                    <span>-{item.unpaidLeaveDeduction}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>Unpaid Leave Days:</span>
                    <span>0.000</span>
                  </div>
                )}
                {parseFloat(item.loanDeduction || '0') > 0 ? (
                  <div className="flex justify-between text-rose-700">
                    <span>Loan Installment:</span>
                    <span>-{item.loanDeduction}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>Loan Installments:</span>
                    <span>0.000</span>
                  </div>
                )}
                {parseFloat(item.statutoryEmployeeContribution || '0') > 0 ? (
                  <div className="flex justify-between text-rose-700">
                    <span>Social Insurance (PIFSS/GOSI):</span>
                    <span className="font-bold">-{item.statutoryEmployeeContribution}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>Statutory Social Insurance:</span>
                    <span>0.000</span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 mt-4 border-t border-slate-200 flex justify-between font-mono font-bold text-xs">
              <span className="text-slate-900">Total Deductions:</span>
              <span className="text-rose-700">-{item.totalDeductions} {item.currency}</span>
            </div>
          </div>
        </div>

        {/* Net Pay Highlight Banner */}
        <div className="bg-slate-900 text-white rounded p-4 flex items-center justify-between mb-6">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-300 block">
              Net Wage Transferred
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Via GCC Wage Protection System (WPS)
            </span>
          </div>
          <div className="text-right rtl:text-left font-mono">
            <span className="text-xl font-bold tracking-tight text-white block">
              {item.netPay} {item.currency}
            </span>
            <span className="text-[10px] text-emerald-400 font-semibold flex items-center justify-end space-x-1 rtl:space-x-reverse">
              <ShieldCheck className="w-3 h-3" />
              <span>DETERMINISTIC & AUDITED</span>
            </span>
          </div>
        </div>

        {/* Audit Explainability Trace */}
        {breakdown.overtime && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono text-slate-600 space-y-1">
            <div className="flex items-center space-x-1.5 rtl:space-x-reverse font-bold text-slate-800">
              <Info className="w-3.5 h-3.5 text-slate-500" />
              <span>Calculation & Statutory Audit Trail</span>
            </div>
            <p>• Overtime Rule: {breakdown.overtime.rule} (Hourly Base: {breakdown.overtime.hourlyRate} {item.currency})</p>
            {breakdown.statutoryPension?.isNational && (
              <p>• Statutory Social Security: {breakdown.statutoryPension.scheme} (Employee: {breakdown.statutoryPension.employeeRate}, Employer: {breakdown.statutoryPension.employerRate})</p>
            )}
            <p>• Net Formula: Gross ({item.grossPay}) - Deductions ({item.totalDeductions}) = Net ({item.netPay} {item.currency})</p>
          </div>
        )}
      </div>
    </div>
  );
}
