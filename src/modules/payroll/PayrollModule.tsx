/**
 * GulfHive ERP - Authoritative Payroll Module Workspace
 * Complete deterministic payroll calculation, configurable components, structures,
 * periods, adjustments, loans, EOSB settlements, reports, and WPS bank exports.
 */

import React, { useState, useEffect } from 'react';
import { useI18n } from '../../shared/i18n/I18nContext.tsx';
import {
  Coins,
  CreditCard,
  FileText,
  Plus,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Download,
  AlertTriangle,
  Building2,
  Lock,
  Layers,
  FileSpreadsheet,
  Printer,
  Sliders,
  DollarSign,
  TrendingUp,
  Tag
} from 'lucide-react';
import {
  Button,
  Input,
  Select,
  Table,
  Column,
  Dialog,
  FormField,
  useToast,
  LoadingState,
  ErrorState
} from '../../design-system/index.ts';
import { PayrollRunDetailDrawer } from './components/PayrollRunDetailDrawer.tsx';

export interface PayrollModuleProps {
  company: any;
  branches: any[];
  activeBranchId: string;
}

export function PayrollModule({ company, branches, activeBranchId }: PayrollModuleProps) {
  const { t, language } = useI18n();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<'runs' | 'periods' | 'adjustments' | 'loans' | 'eosb' | 'reports' | 'settings'>('runs');

  // Data states
  const [runsList, setRunsList] = useState<any[]>([]);
  const [periodsList, setPeriodsList] = useState<any[]>([]);
  const [adjustmentsList, setAdjustmentsList] = useState<any[]>([]);
  const [loansList, setLoansList] = useState<any[]>([]);
  const [settlementsList, setSettlementsList] = useState<any[]>([]);
  const [componentsList, setComponentsList] = useState<any[]>([]);
  const [structuresList, setStructuresList] = useState<any[]>([]);
  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Selected Run for Drawer
  const [selectedRun, setSelectedRun] = useState<any | null>(null);
  const [isRunDrawerOpen, setIsRunDrawerOpen] = useState(false);

  // Dialogs
  const [showNewRunDialog, setShowNewRunDialog] = useState(false);
  const [showNewPeriodDialog, setShowNewPeriodDialog] = useState(false);
  const [showNewAdjDialog, setShowNewAdjDialog] = useState(false);
  const [showNewLoanDialog, setShowNewLoanDialog] = useState(false);
  const [showNewEosbDialog, setShowNewEosbDialog] = useState(false);
  const [showNewCompDialog, setShowNewCompDialog] = useState(false);
  const [showNewStructDialog, setShowNewStructDialog] = useState(false);

  // Forms
  const now = new Date();
  const [runForm, setRunForm] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });

  const [periodForm, setPeriodForm] = useState({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    periodStart: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
    periodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
    paymentDate: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10),
  });

  const [adjForm, setAdjForm] = useState({
    employeeId: '',
    type: 'BONUS' as 'BONUS' | 'COMMISSION' | 'CORRECTION' | 'REIMBURSEMENT' | 'DEDUCTION' | 'PENALTY',
    amount: '50.000',
    reason: '',
    effectiveDate: new Date().toISOString().slice(0, 10),
  });

  const [compForm, setCompForm] = useState({
    code: '',
    nameEn: '',
    nameAr: '',
    componentType: 'EARNING' as 'EARNING' | 'DEDUCTION' | 'EMPLOYER_CONTRIBUTION' | 'INFORMATION',
    calculationType: 'FIXED' as 'FIXED' | 'PERCENTAGE' | 'FORMULA' | 'INPUT',
    formulaExpression: '',
    affectsGross: true,
    affectsNet: true,
  });

  const [structForm, setStructForm] = useState({
    code: '',
    nameEn: '',
    nameAr: '',
    effectiveFrom: new Date().toISOString().slice(0, 10),
  });

  const [loanForm, setLoanForm] = useState({
    employeeId: '',
    loanAmount: '1000.000',
    monthlyInstallment: '100.000',
    disbursementDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const [eosbForm, setEosbForm] = useState({
    employeeId: '',
    contractType: 'UNLIMITED' as 'UNLIMITED' | 'LIMITED',
    terminationType: 'RESIGNATION' as 'RESIGNATION' | 'TERMINATION' | 'END_OF_CONTRACT',
    lastWorkingDate: new Date().toISOString().slice(0, 10),
    accruedLeaveDays: 0,
    unpaidSalaryDays: 0,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadAllData = async () => {
    if (!company?.id) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const [runsRes, periodsRes, compRes, structRes, adjRes, loansRes, eosbRes, empRes] = await Promise.all([
        fetch(`/api/companies/${company.id}/payroll/runs`),
        fetch(`/api/companies/${company.id}/payroll/periods`),
        fetch(`/api/companies/${company.id}/payroll/components`),
        fetch(`/api/companies/${company.id}/payroll/structures`),
        fetch(`/api/companies/${company.id}/payroll/adjustments`),
        fetch(`/api/companies/${company.id}/loans`),
        fetch(`/api/companies/${company.id}/final-settlements`),
        fetch(`/api/companies/${company.id}/employees`),
      ]);

      if (runsRes.ok) setRunsList((await runsRes.json()).runs || []);
      if (periodsRes.ok) setPeriodsList((await periodsRes.json()).periods || []);
      if (compRes.ok) setComponentsList((await compRes.json()).components || []);
      if (structRes.ok) setStructuresList((await structRes.json()).structures || []);
      if (adjRes.ok) setAdjustmentsList((await adjRes.json()).adjustments || []);
      if (loansRes.ok) setLoansList((await loansRes.json()).loans || []);
      if (eosbRes.ok) setSettlementsList((await eosbRes.json()).settlements || []);
      if (empRes.ok) setEmployeesList((await empRes.json()).employees || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load Payroll data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [company?.id]);

  const handleOpenRunDetail = async (runId: string) => {
    try {
      const res = await fetch(`/api/companies/${company.id}/payroll/runs/${runId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedRun(data.run);
        setIsRunDrawerOpen(true);
      }
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Could not fetch payroll batch details' });
    }
  };

  const handleCreateRun = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/payroll/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: runForm.month,
          year: runForm.year,
          actorId: 'admin',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to calculate payroll');

      addToast({
        type: 'success',
        title: 'Payroll Batch Calculated',
        message: `Processed ${data.result.totalEmployees} employees · Net: ${data.result.totalNetPay}`,
      });

      setShowNewRunDialog(false);
      loadAllData();
      handleOpenRunDetail(data.result.runId);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Calculation Error', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/payroll/periods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(periodForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create period');

      addToast({ type: 'success', title: 'Payroll Period Created', message: `Period ${data.period.periodNumber} is OPEN` });
      setShowNewPeriodDialog(false);
      loadAllData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjForm.employeeId) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/payroll/adjustments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adjForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add adjustment');

      addToast({ type: 'success', title: 'Adjustment Added', message: 'Ready for inclusion in next payroll run' });
      setShowNewAdjDialog(false);
      loadAllData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/payroll/components`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(compForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create component');

      addToast({ type: 'success', title: 'Component Added', message: `Salary component ${data.component.code} active` });
      setShowNewCompDialog(false);
      loadAllData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/payroll/structures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...structForm, components: [] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create structure');

      addToast({ type: 'success', title: 'Salary Structure Created', message: `${data.structure.code} active` });
      setShowNewStructDialog(false);
      loadAllData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanForm.employeeId) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/loans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...loanForm,
          currency: company?.baseCurrency || 'KWD',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to disburse loan');

      addToast({ type: 'success', title: 'Loan Disbursed', message: 'Active in payroll deductions' });
      setShowNewLoanDialog(false);
      loadAllData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateEosb = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eosbForm.employeeId) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/final-settlements/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...eosbForm,
          actorId: 'admin',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to calculate settlement');

      addToast({
        type: 'success',
        title: 'EOSB Settlement Computed',
        message: `Net Payable: ${data.settlement.netSettlementAmount} ${data.settlement.currency}`,
      });
      setShowNewEosbDialog(false);
      loadAllData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveEosb = async (settlementId: string) => {
    try {
      const res = await fetch(`/api/companies/${company.id}/final-settlements/${settlementId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approverId: 'admin' }),
      });

      if (!res.ok) throw new Error('Failed to approve settlement');
      addToast({ type: 'success', title: 'Final Settlement Approved', message: 'Employee status set to TERMINATED' });
      loadAllData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  // Columns: Runs
  const runColumns: Column<any>[] = [
    {
      key: 'period',
      header: t('payroll.field.period') || 'Period / Run #',
      sortable: true,
      render: (r) => (
        <div>
          <span className="font-mono font-bold text-slate-900 block">
            {r.payrollNumber || `${r.periodYear}/${String(r.periodMonth).padStart(2, '0')}`}
          </span>
          <span className="text-[11px] text-slate-500 font-sans">{r.periodYear} — M{r.periodMonth} ({r.runType || 'REGULAR'})</span>
        </div>
      ),
    },
    {
      key: 'employees',
      header: t('payroll.field.employees_count') || 'Staff',
      render: (r) => <span className="font-mono text-slate-600">{r.totalEmployees} Employees</span>,
    },
    {
      key: 'gross',
      header: t('payroll.field.total_gross') || 'Total Gross',
      render: (r) => <span className="font-mono text-slate-800">{r.totalGrossPay} {r.currency}</span>,
    },
    {
      key: 'deductions',
      header: t('payroll.field.total_deductions') || 'Deductions',
      render: (r) => <span className="font-mono text-rose-700">-{r.totalDeductions} {r.currency}</span>,
    },
    {
      key: 'net',
      header: t('payroll.field.total_net') || 'Net Payable',
      sortable: true,
      render: (r) => (
        <span className="font-mono font-bold text-slate-900">
          {r.totalNetPay} {r.currency}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('payroll.field.status') || 'Status',
      sortable: true,
      render: (r) => {
        const colors: Record<string, string> = {
          APPROVED: 'text-emerald-700 bg-emerald-50 border-emerald-200',
          POSTED: 'text-blue-700 bg-blue-50 border-blue-200',
          VALIDATED: 'text-sky-700 bg-sky-50 border-sky-200',
          REVERSED: 'text-rose-700 bg-rose-50 border-rose-200',
          DRAFT: 'text-slate-700 bg-slate-100 border-slate-200',
        };
        return (
          <span className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded border ${colors[r.status] || ''}`}>
            {r.status}
          </span>
        );
      },
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (r) => (
        <Button size="sm" variant="secondary" onClick={() => handleOpenRunDetail(r.id)}>
          Inspect Batch
        </Button>
      ),
    },
  ];

  // Columns: Periods
  const periodColumns: Column<any>[] = [
    {
      key: 'number',
      header: 'Period Code',
      render: (p) => <span className="font-mono font-bold text-slate-900">{p.periodNumber}</span>,
    },
    {
      key: 'window',
      header: 'Date Window',
      render: (p) => <span className="font-mono text-xs text-slate-600">{p.periodStart} → {p.periodEnd}</span>,
    },
    {
      key: 'payDate',
      header: 'Pay Date',
      render: (p) => <span className="font-mono text-xs text-slate-600">{p.paymentDate || '—'}</span>,
    },
    {
      key: 'status',
      header: 'Lifecycle Status',
      render: (p) => (
        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 border border-slate-300">
          {p.status}
        </span>
      ),
    },
  ];

  // Columns: Adjustments
  const adjColumns: Column<any>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (a) => (
        <div>
          <span className="font-semibold text-slate-900 block">{a.employeeNameEn}</span>
          <span className="font-mono text-[11px] text-slate-400">{a.employeeNumber}</span>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (a) => (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
          ['DEDUCTION', 'PENALTY'].includes(a.type) ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
        }`}>
          {a.type}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (a) => <span className="font-mono font-bold text-slate-900">{a.amount}</span>,
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (a) => <span className="text-xs text-slate-700">{a.reason}</span>,
    },
    {
      key: 'effectiveDate',
      header: 'Effective Date',
      render: (a) => <span className="font-mono text-xs text-slate-500">{a.effectiveDate}</span>,
    },
  ];

  // Columns: Components
  const compColumns: Column<any>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (c) => <span className="font-mono font-bold text-slate-900">{c.code}</span>,
    },
    {
      key: 'name',
      header: 'Name',
      render: (c) => (
        <div>
          <span className="font-semibold text-slate-900 block">{c.nameEn}</span>
          <span className="text-xs text-slate-500">{c.nameAr}</span>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Classification',
      render: (c) => (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 border border-slate-300">
          {c.componentType}
        </span>
      ),
    },
    {
      key: 'calc',
      header: 'Method',
      render: (c) => <span className="font-mono text-xs text-slate-600">{c.calculationType}</span>,
    },
  ];

  // Columns: Loans
  const loanColumns: Column<any>[] = [
    {
      key: 'employee',
      header: 'Employee',
      sortable: true,
      render: (l) => (
        <div>
          <span className="font-semibold text-slate-900 block">{l.employeeNameEn}</span>
          <span className="font-mono text-[11px] text-slate-400">{l.employeeNumber}</span>
        </div>
      ),
    },
    {
      key: 'amount',
      header: t('payroll.field.loan_amount') || 'Principal',
      render: (l) => <span className="font-mono font-bold text-slate-900">{l.loanAmount} {l.currency}</span>,
    },
    {
      key: 'installment',
      header: t('payroll.field.monthly_installment') || 'Installment',
      render: (l) => <span className="font-mono text-slate-700">{l.monthlyInstallment} {l.currency}/mo</span>,
    },
    {
      key: 'remaining',
      header: t('payroll.field.remaining_balance') || 'Remaining',
      render: (l) => <span className="font-mono font-bold text-amber-800">{l.remainingBalance} {l.currency}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (l) => (
        <span className={`font-mono text-[11px] font-bold ${
          l.status === 'REPAID' ? 'text-emerald-700' : 'text-amber-700'
        }`}>
          {l.status}
        </span>
      ),
    },
  ];

  // Columns: EOSB
  const eosbColumns: Column<any>[] = [
    {
      key: 'employee',
      header: 'Employee',
      sortable: true,
      render: (e) => (
        <div>
          <span className="font-semibold text-slate-900 block">{e.employeeNameEn}</span>
          <span className="font-mono text-[11px] text-slate-400">{e.employeeNumber}</span>
        </div>
      ),
    },
    {
      key: 'tenure',
      header: t('payroll.field.service_years') || 'Tenure',
      render: (e) => <span className="font-mono text-slate-700">{e.totalServiceYears} yrs</span>,
    },
    {
      key: 'gratuity',
      header: t('payroll.field.gratuity_amount') || 'Gratuity',
      render: (e) => <span className="font-mono text-slate-800">{e.statutoryGratuityAmount} {e.currency}</span>,
    },
    {
      key: 'net',
      header: t('payroll.field.net_settlement') || 'Net Settlement',
      render: (e) => (
        <span className="font-mono font-bold text-emerald-800">
          {e.netSettlementAmount} {e.currency}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (e) => (
        <span className={`font-mono text-[11px] font-bold ${
          e.status === 'APPROVED' ? 'text-emerald-700' : 'text-amber-700'
        }`}>
          {e.status}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (e) => (
        e.status === 'DRAFT' ? (
          <Button size="sm" variant="success" onClick={() => handleApproveEosb(e.id)}>
            Approve & Terminate
          </Button>
        ) : null
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Module Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'runs', label: t('payroll.tab.runs') || 'Payroll Batches', icon: Coins, count: runsList.length },
            { id: 'periods', label: t('payroll.tab.periods') || 'Periods', icon: Calendar, count: periodsList.length },
            { id: 'adjustments', label: t('payroll.tab.adjustments') || 'Adjustments', icon: Tag, count: adjustmentsList.length },
            { id: 'loans', label: t('payroll.tab.loans') || 'Employee Loans', icon: CreditCard, count: loansList.length },
            { id: 'eosb', label: t('payroll.tab.eosb') || 'End of Service', icon: FileText, count: settlementsList.length },
            { id: 'reports', label: t('payroll.tab.reports') || 'Reports & Exports', icon: FileSpreadsheet, count: undefined },
            { id: 'settings', label: t('payroll.tab.settings') || 'Setup & Structure', icon: Sliders, count: componentsList.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center space-x-2 rtl:space-x-reverse transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.count !== undefined && <span className="text-[10px] opacity-70 font-mono">({tab.count})</span>}
              </button>
            );
          })}
        </div>

        <div>
          {activeTab === 'runs' && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setShowNewRunDialog(true)}
            >
              {t('payroll.action.new_run') || 'Run Payroll Batch'}
            </Button>
          )}
          {activeTab === 'periods' && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setShowNewPeriodDialog(true)}
            >
              {t('payroll.action.new_period') || 'Create Period'}
            </Button>
          )}
          {activeTab === 'adjustments' && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setShowNewAdjDialog(true)}
            >
              {t('payroll.action.new_adjustment') || 'Add Adjustment'}
            </Button>
          )}
          {activeTab === 'loans' && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setShowNewLoanDialog(true)}
            >
              {t('payroll.action.new_loan') || 'Disburse Loan'}
            </Button>
          )}
          {activeTab === 'eosb' && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setShowNewEosbDialog(true)}
            >
              {t('payroll.action.calculate_eosb') || 'Calculate EOSB'}
            </Button>
          )}
          {activeTab === 'settings' && (
            <div className="flex space-x-2 rtl:space-x-reverse">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setShowNewCompDialog(true)}
              >
                {t('payroll.action.new_component') || 'Component'}
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setShowNewStructDialog(true)}
              >
                {t('payroll.action.new_structure') || 'Structure'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <LoadingState label="Loading payroll domain data..." />
      ) : errorMsg ? (
        <ErrorState title="Error Loading Payroll" message={errorMsg} />
      ) : (
        <>
          {/* TAB 1: RUNS */}
          {activeTab === 'runs' && (
            <Table
              columns={runColumns}
              data={runsList}
              keyExtractor={(r) => r.id}
              emptyTitle="No payroll runs calculated yet. Click 'Run Payroll Batch' to generate."
            />
          )}

          {/* TAB 2: PERIODS */}
          {activeTab === 'periods' && (
            <Table
              columns={periodColumns}
              data={periodsList}
              keyExtractor={(p) => p.id}
              emptyTitle="No payroll periods configured."
            />
          )}

          {/* TAB 3: ADJUSTMENTS */}
          {activeTab === 'adjustments' && (
            <Table
              columns={adjColumns}
              data={adjustmentsList}
              keyExtractor={(a) => a.id}
              emptyTitle="No one-time adjustments recorded."
            />
          )}

          {/* TAB 4: LOANS */}
          {activeTab === 'loans' && (
            <Table
              columns={loanColumns}
              data={loansList}
              keyExtractor={(l) => l.id}
              emptyTitle="No employee loans or salary advances recorded."
            />
          )}

          {/* TAB 5: EOSB */}
          {activeTab === 'eosb' && (
            <Table
              columns={eosbColumns}
              data={settlementsList}
              keyExtractor={(e) => e.id}
              emptyTitle="No final settlements calculated."
            />
          )}

          {/* TAB 6: REPORTS & EXPORTS */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
                <h3 className="text-base font-bold text-slate-900 mb-1">Corporate Payroll Reports & Financial Exports</h3>
                <p className="text-xs text-slate-500 mb-6">
                  Authoritative exports derived directly from locked payroll result lines and statutory compliance tables.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Card 1: WPS SIF */}
                  <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center space-x-2 text-slate-800 font-bold mb-1">
                        <Download className="w-4 h-4 text-sky-600" />
                        <span>WPS SIF File</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Official GCC Wage Protection System electronic salary file format for central bank compliance.
                      </p>
                    </div>
                    {runsList.length > 0 ? (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => window.location.href = `/api/companies/${company.id}/payroll/runs/${runsList[0].id}/export/wps`}
                      >
                        Download Latest SIF
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400">Requires a payroll run</span>
                    )}
                  </div>

                  {/* Card 2: Excel Payroll Register */}
                  <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center space-x-2 text-slate-800 font-bold mb-1">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        <span>Payroll Register (Excel)</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Itemized cross-component spreadsheet containing employee codes, earnings, deductions, and bank details.
                      </p>
                    </div>
                    {runsList.length > 0 ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.location.href = `/api/companies/${company.id}/payroll/runs/${runsList[0].id}/export/excel`}
                      >
                        Export CSV Register
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400">Requires a payroll run</span>
                    )}
                  </div>

                  {/* Card 3: Batch PDF Payslips */}
                  <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center space-x-2 text-slate-800 font-bold mb-1">
                        <Printer className="w-4 h-4 text-purple-600" />
                        <span>Batch Payslips (PDF)</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Complete multi-page corporate PDF booklet of all individual employee payslips for the active period.
                      </p>
                    </div>
                    {runsList.length > 0 ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => window.open(`/api/companies/${company.id}/payroll/runs/${runsList[0].id}/payslips/batch/pdf`, '_blank')}
                      >
                        Generate PDF Booklet
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400">Requires a payroll run</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: SETTINGS & STRUCTURES */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-3">Configurable Salary Components</h3>
                <Table
                  columns={compColumns}
                  data={componentsList}
                  keyExtractor={(c) => c.id}
                  emptyTitle="No salary components found."
                />
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-3">Salary Structures</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {structuresList.map((s) => (
                    <div key={s.id} className="bg-white border border-slate-200 rounded p-4 font-mono text-xs">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-slate-900">{s.code}</span>
                        <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-sans text-[10px]">
                          {s.status}
                        </span>
                      </div>
                      <p className="font-sans text-slate-700">{s.nameEn} · {s.nameAr}</p>
                      <p className="text-slate-400 text-[11px] mt-1">Effective: {s.effectiveFrom} → {s.effectiveTo || 'Ongoing'}</p>
                    </div>
                  ))}
                  {structuresList.length === 0 && (
                    <div className="col-span-2 text-center text-xs text-slate-400 py-6 border border-dashed rounded">
                      No custom salary structures defined yet. Standard contract structure is active.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Dialog: Run Payroll Batch */}
      <Dialog
        isOpen={showNewRunDialog}
        onClose={() => setShowNewRunDialog(false)}
        title={t('payroll.action.new_run') || 'Run Payroll Batch'}
        size="md"
      >
        <form onSubmit={handleCreateRun} className="space-y-4">
          <FormField label="Target Year *">
            <Input
              type="number"
              value={runForm.year}
              onChange={(e) => setRunForm({ ...runForm, year: parseInt(e.target.value) || now.getFullYear() })}
              min={2020}
              max={2050}
              required
            />
          </FormField>

          <FormField label="Target Month (1 - 12) *">
            <Select
              value={runForm.month.toString()}
              onChange={(e) => setRunForm({ ...runForm, month: parseInt(e.target.value) || 1 })}
            >
              <option value="1">January (01)</option>
              <option value="2">February (02)</option>
              <option value="3">March (03)</option>
              <option value="4">April (04)</option>
              <option value="5">May (05)</option>
              <option value="6">June (06)</option>
              <option value="7">July (07)</option>
              <option value="8">August (08)</option>
              <option value="9">September (09)</option>
              <option value="10">October (10)</option>
              <option value="11">November (11)</option>
              <option value="12">December (12)</option>
            </Select>
          </FormField>

          <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs text-slate-600">
            Calculation pipeline reads approved Attendance, approved Overtime, approved Leave, active Contracts, and Loans with decimal safety.
          </div>

          <div className="flex justify-end space-x-2 rtl:space-x-reverse pt-2">
            <Button variant="secondary" size="sm" type="button" onClick={() => setShowNewRunDialog(false)}>
              {t('action.cancel') || 'Cancel'}
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
              Execute Batch Calculation
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Dialog: Create Payroll Period */}
      <Dialog
        isOpen={showNewPeriodDialog}
        onClose={() => setShowNewPeriodDialog(false)}
        title="Create Payroll Period"
        size="md"
      >
        <form onSubmit={handleCreatePeriod} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Year *">
              <Input
                type="number"
                value={periodForm.year}
                onChange={(e) => setPeriodForm({ ...periodForm, year: Number(e.target.value) })}
                required
              />
            </FormField>
            <FormField label="Month (1-12) *">
              <Input
                type="number"
                min={1}
                max={12}
                value={periodForm.month}
                onChange={(e) => setPeriodForm({ ...periodForm, month: Number(e.target.value) })}
                required
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Period Start *">
              <Input
                type="date"
                value={periodForm.periodStart}
                onChange={(e) => setPeriodForm({ ...periodForm, periodStart: e.target.value })}
                required
              />
            </FormField>
            <FormField label="Period End *">
              <Input
                type="date"
                value={periodForm.periodEnd}
                onChange={(e) => setPeriodForm({ ...periodForm, periodEnd: e.target.value })}
                required
              />
            </FormField>
          </div>

          <FormField label="Scheduled Payment Date">
            <Input
              type="date"
              value={periodForm.paymentDate}
              onChange={(e) => setPeriodForm({ ...periodForm, paymentDate: e.target.value })}
            />
          </FormField>

          <div className="flex justify-end space-x-2 rtl:space-x-reverse pt-2">
            <Button variant="secondary" size="sm" type="button" onClick={() => setShowNewPeriodDialog(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
              Establish Period
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Dialog: Add Adjustment */}
      <Dialog
        isOpen={showNewAdjDialog}
        onClose={() => setShowNewAdjDialog(false)}
        title="Add Payroll Adjustment"
        size="md"
      >
        <form onSubmit={handleCreateAdjustment} className="space-y-4">
          <FormField label="Employee *">
            <Select
              value={adjForm.employeeId}
              onChange={(e) => setAdjForm({ ...adjForm, employeeId: e.target.value })}
              required
            >
              <option value="">Select Employee...</option>
              {employeesList.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.employeeNumber} — {emp.firstNameEn} {emp.lastNameEn}
                </option>
              ))}
            </Select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Adjustment Type *">
              <Select
                value={adjForm.type}
                onChange={(e) => setAdjForm({ ...adjForm, type: e.target.value as any })}
              >
                <option value="BONUS">Bonus / مكافأة</option>
                <option value="COMMISSION">Commission / عمولة</option>
                <option value="REIMBURSEMENT">Reimbursement / تعويض مصاريف</option>
                <option value="CORRECTION">Correction / تسوية</option>
                <option value="DEDUCTION">Manual Deduction / خصم يدوي</option>
                <option value="PENALTY">Penalty / جزاء</option>
              </Select>
            </FormField>

            <FormField label="Amount *">
              <Input
                type="text"
                value={adjForm.amount}
                onChange={(e) => setAdjForm({ ...adjForm, amount: e.target.value })}
                placeholder="50.000"
                required
              />
            </FormField>
          </div>

          <FormField label="Reason / Business Justification *">
            <Input
              type="text"
              value={adjForm.reason}
              onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })}
              placeholder="e.g. Project completion award Q3"
              required
            />
          </FormField>

          <FormField label="Effective Date *">
            <Input
              type="date"
              value={adjForm.effectiveDate}
              onChange={(e) => setAdjForm({ ...adjForm, effectiveDate: e.target.value })}
              required
            />
          </FormField>

          <div className="flex justify-end space-x-2 rtl:space-x-reverse pt-2">
            <Button variant="secondary" size="sm" type="button" onClick={() => setShowNewAdjDialog(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
              Save Adjustment
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Dialog: Create Salary Component */}
      <Dialog
        isOpen={showNewCompDialog}
        onClose={() => setShowNewCompDialog(false)}
        title="New Salary Component"
        size="md"
      >
        <form onSubmit={handleCreateComponent} className="space-y-4">
          <FormField label="Component Code (e.g. MOBILE, SHIFT_DIFF) *">
            <Input
              type="text"
              value={compForm.code}
              onChange={(e) => setCompForm({ ...compForm, code: e.target.value.toUpperCase() })}
              placeholder="MOBILE"
              required
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="English Name *">
              <Input
                type="text"
                value={compForm.nameEn}
                onChange={(e) => setCompForm({ ...compForm, nameEn: e.target.value })}
                placeholder="Mobile Allowance"
                required
              />
            </FormField>
            <FormField label="Arabic Name *">
              <Input
                type="text"
                value={compForm.nameAr}
                onChange={(e) => setCompForm({ ...compForm, nameAr: e.target.value })}
                placeholder="بدل هاتف"
                required
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Type *">
              <Select
                value={compForm.componentType}
                onChange={(e) => setCompForm({ ...compForm, componentType: e.target.value as any })}
              >
                <option value="EARNING">Earning</option>
                <option value="DEDUCTION">Deduction</option>
                <option value="EMPLOYER_CONTRIBUTION">Employer Contribution</option>
                <option value="INFORMATION">Informational</option>
              </Select>
            </FormField>
            <FormField label="Calculation Method *">
              <Select
                value={compForm.calculationType}
                onChange={(e) => setCompForm({ ...compForm, calculationType: e.target.value as any })}
              >
                <option value="FIXED">Fixed Amount</option>
                <option value="PERCENTAGE">Percentage</option>
                <option value="FORMULA">Formula Expression</option>
                <option value="INPUT">Variable Input</option>
              </Select>
            </FormField>
          </div>

          {compForm.calculationType === 'FORMULA' && (
            <FormField label="Formula Expression (e.g. BASIC * 0.10)">
              <Input
                type="text"
                value={compForm.formulaExpression}
                onChange={(e) => setCompForm({ ...compForm, formulaExpression: e.target.value })}
                placeholder="BASIC * 0.05"
              />
            </FormField>
          )}

          <div className="flex justify-end space-x-2 rtl:space-x-reverse pt-2">
            <Button variant="secondary" size="sm" type="button" onClick={() => setShowNewCompDialog(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
              Create Component
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Dialog: Create Salary Structure */}
      <Dialog
        isOpen={showNewStructDialog}
        onClose={() => setShowNewStructDialog(false)}
        title="New Salary Structure"
        size="md"
      >
        <form onSubmit={handleCreateStructure} className="space-y-4">
          <FormField label="Structure Code *">
            <Input
              type="text"
              value={structForm.code}
              onChange={(e) => setStructForm({ ...structForm, code: e.target.value.toUpperCase() })}
              placeholder="SAL-GRADE-A"
              required
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="English Name *">
              <Input
                type="text"
                value={structForm.nameEn}
                onChange={(e) => setStructForm({ ...structForm, nameEn: e.target.value })}
                placeholder="Executive Grade Structure"
                required
              />
            </FormField>
            <FormField label="Arabic Name *">
              <Input
                type="text"
                value={structForm.nameAr}
                onChange={(e) => setStructForm({ ...structForm, nameAr: e.target.value })}
                placeholder="هيكل الرواتب التنفيذي"
                required
              />
            </FormField>
          </div>
          <FormField label="Effective From *">
            <Input
              type="date"
              value={structForm.effectiveFrom}
              onChange={(e) => setStructForm({ ...structForm, effectiveFrom: e.target.value })}
              required
            />
          </FormField>

          <div className="flex justify-end space-x-2 rtl:space-x-reverse pt-2">
            <Button variant="secondary" size="sm" type="button" onClick={() => setShowNewStructDialog(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
              Save Structure
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Dialog: Disburse Loan */}
      <Dialog
        isOpen={showNewLoanDialog}
        onClose={() => setShowNewLoanDialog(false)}
        title={t('payroll.action.new_loan') || 'Disburse Employee Loan'}
        size="md"
      >
        <form onSubmit={handleCreateLoan} className="space-y-4">
          <FormField label="Employee *">
            <Select
              value={loanForm.employeeId}
              onChange={(e) => setLoanForm({ ...loanForm, employeeId: e.target.value })}
              required
            >
              <option value="">Select Employee...</option>
              {employeesList.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.employeeNumber} — {emp.firstNameEn} {emp.lastNameEn}
                </option>
              ))}
            </Select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Loan Principal Amount *">
              <Input
                type="text"
                value={loanForm.loanAmount}
                onChange={(e) => setLoanForm({ ...loanForm, loanAmount: e.target.value })}
                required
              />
            </FormField>
            <FormField label="Monthly Installment *">
              <Input
                type="text"
                value={loanForm.monthlyInstallment}
                onChange={(e) => setLoanForm({ ...loanForm, monthlyInstallment: e.target.value })}
                required
              />
            </FormField>
          </div>

          <FormField label="Disbursement Date *">
            <Input
              type="date"
              value={loanForm.disbursementDate}
              onChange={(e) => setLoanForm({ ...loanForm, disbursementDate: e.target.value })}
              required
            />
          </FormField>

          <FormField label="Notes / Reason">
            <Input
              type="text"
              value={loanForm.notes}
              onChange={(e) => setLoanForm({ ...loanForm, notes: e.target.value })}
              placeholder="e.g. Housing advance loan"
            />
          </FormField>

          <div className="flex justify-end space-x-2 rtl:space-x-reverse pt-2">
            <Button variant="secondary" size="sm" type="button" onClick={() => setShowNewLoanDialog(false)}>
              {t('action.cancel') || 'Cancel'}
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
              Authorize & Disburse
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Dialog: Compute EOSB Settlement */}
      <Dialog
        isOpen={showNewEosbDialog}
        onClose={() => setShowNewEosbDialog(false)}
        title={t('payroll.action.calculate_eosb') || 'Calculate End of Service Settlement'}
        size="lg"
      >
        <form onSubmit={handleCreateEosb} className="space-y-4">
          <FormField label="Employee *">
            <Select
              value={eosbForm.employeeId}
              onChange={(e) => setEosbForm({ ...eosbForm, employeeId: e.target.value })}
              required
            >
              <option value="">Select Employee...</option>
              {employeesList.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.employeeNumber} — {emp.firstNameEn} {emp.lastNameEn}
                </option>
              ))}
            </Select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Contract Type *">
              <Select
                value={eosbForm.contractType}
                onChange={(e) => setEosbForm({ ...eosbForm, contractType: e.target.value as any })}
              >
                <option value="UNLIMITED">Unlimited Contract / عقد غير محدد المدة</option>
                <option value="LIMITED">Limited Term Contract / عقد محدد المدة</option>
              </Select>
            </FormField>

            <FormField label="Termination Type *">
              <Select
                value={eosbForm.terminationType}
                onChange={(e) => setEosbForm({ ...eosbForm, terminationType: e.target.value as any })}
              >
                <option value="RESIGNATION">Resignation / استقالة</option>
                <option value="TERMINATION">Termination by Employer / إنهاء خدمات</option>
                <option value="END_OF_CONTRACT">Natural End of Contract / انتهاء العقد</option>
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FormField label="Last Working Date *">
              <Input
                type="date"
                value={eosbForm.lastWorkingDate}
                onChange={(e) => setEosbForm({ ...eosbForm, lastWorkingDate: e.target.value })}
                required
              />
            </FormField>
            <FormField label="Accrued Leave Days">
              <Input
                type="number"
                value={eosbForm.accruedLeaveDays}
                onChange={(e) => setEosbForm({ ...eosbForm, accruedLeaveDays: parseFloat(e.target.value) || 0 })}
                min={0}
              />
            </FormField>
            <FormField label="Unpaid Salary Days">
              <Input
                type="number"
                value={eosbForm.unpaidSalaryDays}
                onChange={(e) => setEosbForm({ ...eosbForm, unpaidSalaryDays: parseFloat(e.target.value) || 0 })}
                min={0}
              />
            </FormField>
          </div>

          <div className="flex justify-end space-x-2 rtl:space-x-reverse pt-2">
            <Button variant="secondary" size="sm" type="button" onClick={() => setShowNewEosbDialog(false)}>
              {t('action.cancel') || 'Cancel'}
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
              Compute Statutory Settlement
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Slide-over Batch Details Drawer */}
      <PayrollRunDetailDrawer
        isOpen={isRunDrawerOpen}
        onClose={() => setIsRunDrawerOpen(false)}
        run={selectedRun}
        company={company}
        onRefresh={() => {
          loadAllData();
          if (selectedRun?.id) handleOpenRunDetail(selectedRun.id);
        }}
      />
    </div>
  );
}
