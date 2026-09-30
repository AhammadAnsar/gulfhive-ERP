/**
 * GulfHive ERP - Payroll Module Workspace
 * Complete deterministic payroll calculation, loans, EOSB settlements, and WPS bank exports.
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
  Lock
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

  const [activeTab, setActiveTab] = useState<'runs' | 'loans' | 'eosb'>('runs');

  // Data states
  const [runsList, setRunsList] = useState<any[]>([]);
  const [loansList, setLoansList] = useState<any[]>([]);
  const [settlementsList, setSettlementsList] = useState<any[]>([]);
  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Selected Run for Drawer
  const [selectedRun, setSelectedRun] = useState<any | null>(null);
  const [isRunDrawerOpen, setIsRunDrawerOpen] = useState(false);

  // Dialogs
  const [showNewRunDialog, setShowNewRunDialog] = useState(false);
  const [showNewLoanDialog, setShowNewLoanDialog] = useState(false);
  const [showNewEosbDialog, setShowNewEosbDialog] = useState(false);

  // Forms
  const now = new Date();
  const [runForm, setRunForm] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
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
      const [runsRes, loansRes, eosbRes, empRes] = await Promise.all([
        fetch(`/api/companies/${company.id}/payroll/runs`),
        fetch(`/api/companies/${company.id}/loans`),
        fetch(`/api/companies/${company.id}/final-settlements`),
        fetch(`/api/companies/${company.id}/employees`),
      ]);

      if (runsRes.ok) setRunsList((await runsRes.json()).runs || []);
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
    } catch (err) {
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

  // Columns
  const runColumns: Column<any>[] = [
    {
      key: 'period',
      header: t('payroll.field.period'),
      sortable: true,
      width: '16%',
      render: (r) => (
        <span className="font-mono font-bold text-slate-900">
          {r.periodYear} / {String(r.periodMonth).padStart(2, '0')}
        </span>
      ),
    },
    {
      key: 'employees',
      header: t('payroll.field.employees_count'),
      render: (r) => <span className="font-mono text-slate-600">{r.totalEmployees} Staff</span>,
    },
    {
      key: 'gross',
      header: t('payroll.field.total_gross'),
      render: (r) => <span className="font-mono text-slate-800">{r.totalGrossPay} {r.currency}</span>,
    },
    {
      key: 'deductions',
      header: t('payroll.field.total_deductions'),
      render: (r) => <span className="font-mono text-rose-700">-{r.totalDeductions} {r.currency}</span>,
    },
    {
      key: 'net',
      header: t('payroll.field.total_net'),
      sortable: true,
      render: (r) => (
        <span className="font-mono font-bold text-slate-900">
          {r.totalNetPay} {r.currency}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('payroll.field.status'),
      sortable: true,
      render: (r) => (
        <span className={`font-mono text-[11px] font-bold ${
          r.status === 'APPROVED' ? 'text-emerald-700' : r.status === 'VALIDATED' ? 'text-blue-700' : 'text-slate-600'
        }`}>
          {r.status}
        </span>
      ),
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
      header: t('payroll.field.loan_amount'),
      render: (l) => <span className="font-mono font-bold text-slate-900">{l.loanAmount} {l.currency}</span>,
    },
    {
      key: 'installment',
      header: t('payroll.field.monthly_installment'),
      render: (l) => <span className="font-mono text-slate-700">{l.monthlyInstallment} {l.currency}/mo</span>,
    },
    {
      key: 'remaining',
      header: t('payroll.field.remaining_balance'),
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
      header: t('payroll.field.service_years'),
      render: (e) => <span className="font-mono text-slate-700">{e.totalServiceYears} yrs</span>,
    },
    {
      key: 'gratuity',
      header: t('payroll.field.gratuity_amount'),
      render: (e) => <span className="font-mono text-slate-800">{e.statutoryGratuityAmount} {e.currency}</span>,
    },
    {
      key: 'net',
      header: t('payroll.field.net_settlement'),
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
            { id: 'runs', label: t('payroll.tab.runs'), icon: Coins, count: runsList.length },
            { id: 'loans', label: t('payroll.tab.loans'), icon: CreditCard, count: loansList.length },
            { id: 'eosb', label: t('payroll.tab.eosb'), icon: FileText, count: settlementsList.length },
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
                <span className="text-[10px] opacity-70 font-mono">({tab.count})</span>
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
              {t('payroll.action.new_run')}
            </Button>
          )}
          {activeTab === 'loans' && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setShowNewLoanDialog(true)}
            >
              {t('payroll.action.new_loan')}
            </Button>
          )}
          {activeTab === 'eosb' && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setShowNewEosbDialog(true)}
            >
              {t('payroll.action.calculate_eosb')}
            </Button>
          )}
        </div>
      </div>

      {errorMsg && <ErrorState message={errorMsg} onRetry={loadAllData} />}

      {/* TAB 1: Payroll Runs */}
      {activeTab === 'runs' && (
        <Table
          columns={runColumns}
          data={runsList}
          keyExtractor={(r) => r.id}
          isLoading={isLoading}
          searchable={true}
          searchPlaceholder="Search payroll periods..."
          pageSize={10}
        />
      )}

      {/* TAB 2: Employee Loans */}
      {activeTab === 'loans' && (
        <Table
          columns={loanColumns}
          data={loansList}
          keyExtractor={(l) => l.id}
          isLoading={isLoading}
          searchable={true}
          searchPlaceholder="Search employee loans..."
          pageSize={10}
        />
      )}

      {/* TAB 3: EOSB Final Settlements */}
      {activeTab === 'eosb' && (
        <Table
          columns={eosbColumns}
          data={settlementsList}
          keyExtractor={(s) => s.id}
          isLoading={isLoading}
          searchable={true}
          searchPlaceholder="Search final settlements..."
          pageSize={10}
        />
      )}

      {/* Run Detail Slide-Over Drawer */}
      <PayrollRunDetailDrawer
        isOpen={isRunDrawerOpen}
        onClose={() => setIsRunDrawerOpen(false)}
        run={selectedRun}
        company={company}
        onRefresh={() => {
          loadAllData();
          if (selectedRun) handleOpenRunDetail(selectedRun.id);
        }}
      />

      {/* Calculate Payroll Run Modal */}
      <Dialog
        isOpen={showNewRunDialog}
        onClose={() => setShowNewRunDialog(false)}
        title={t('payroll.action.new_run')}
        description="Deterministic calculation: aggregates contracts, salary, attendance, approved overtime, and statutory rules."
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowNewRunDialog(false)}>
              {t('action.cancel')}
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateRun} isLoading={isSubmitting}>
              Run Calculation
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateRun} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Month" required>
              <Select
                value={runForm.month}
                onChange={(e) => setRunForm({ ...runForm, month: Number(e.target.value) })}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                  <option key={m} value={m}>
                    {new Date(2026, m - 1, 1).toLocaleString('default', { month: 'long' })} ({m})
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Year" required>
              <Input
                type="number"
                value={runForm.year}
                onChange={(e) => setRunForm({ ...runForm, year: Number(e.target.value) })}
                required
              />
            </FormField>
          </div>
        </form>
      </Dialog>

      {/* Disburse Loan Modal */}
      <Dialog
        isOpen={showNewLoanDialog}
        onClose={() => setShowNewLoanDialog(false)}
        title={t('payroll.action.new_loan')}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowNewLoanDialog(false)}>
              {t('action.cancel')}
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateLoan} isLoading={isSubmitting}>
              Disburse Loan
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateLoan} className="space-y-3">
          <FormField label="Employee" required>
            <Select
              value={loanForm.employeeId}
              onChange={(e) => setLoanForm({ ...loanForm, employeeId: e.target.value })}
              required
            >
              <option value="">Select Employee...</option>
              {employeesList.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.employeeNumber} - {emp.firstNameEn} {emp.lastNameEn}
                </option>
              ))}
            </Select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('payroll.field.loan_amount')} required>
              <Input
                type="text"
                value={loanForm.loanAmount}
                onChange={(e) => setLoanForm({ ...loanForm, loanAmount: e.target.value })}
                className="font-mono"
                required
              />
            </FormField>

            <FormField label={t('payroll.field.monthly_installment')} required>
              <Input
                type="text"
                value={loanForm.monthlyInstallment}
                onChange={(e) => setLoanForm({ ...loanForm, monthlyInstallment: e.target.value })}
                className="font-mono"
                required
              />
            </FormField>
          </div>

          <FormField label="Disbursement Date" required>
            <Input
              type="date"
              value={loanForm.disbursementDate}
              onChange={(e) => setLoanForm({ ...loanForm, disbursementDate: e.target.value })}
              required
            />
          </FormField>
        </form>
      </Dialog>

      {/* Calculate EOSB Settlement Modal */}
      <Dialog
        isOpen={showNewEosbDialog}
        onClose={() => setShowNewEosbDialog(false)}
        title={t('payroll.action.calculate_eosb')}
        description="Calculates statutory gratuity, accrued leave encashment, and loan recoveries per GCC labor law."
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowNewEosbDialog(false)}>
              {t('action.cancel')}
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateEosb} isLoading={isSubmitting}>
              Calculate Settlement
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateEosb} className="space-y-3">
          <FormField label="Employee" required>
            <Select
              value={eosbForm.employeeId}
              onChange={(e) => setEosbForm({ ...eosbForm, employeeId: e.target.value })}
              required
            >
              <option value="">Select Employee...</option>
              {employeesList.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.employeeNumber} - {emp.firstNameEn} {emp.lastNameEn}
                </option>
              ))}
            </Select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Contract Type" required>
              <Select
                value={eosbForm.contractType}
                onChange={(e) => setEosbForm({ ...eosbForm, contractType: e.target.value as any })}
              >
                <option value="UNLIMITED">Unlimited Duration</option>
                <option value="LIMITED">Fixed / Limited Duration</option>
              </Select>
            </FormField>

            <FormField label="Termination Type" required>
              <Select
                value={eosbForm.terminationType}
                onChange={(e) => setEosbForm({ ...eosbForm, terminationType: e.target.value as any })}
              >
                <option value="RESIGNATION">Resignation (Employee Departure)</option>
                <option value="TERMINATION">Termination (Employer Action)</option>
                <option value="END_OF_CONTRACT">End of Contract Expiry</option>
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FormField label="Last Working Date" required>
              <Input
                type="date"
                value={eosbForm.lastWorkingDate}
                onChange={(e) => setEosbForm({ ...eosbForm, lastWorkingDate: e.target.value })}
                required
              />
            </FormField>

            <FormField label="Accrued Leave (Days)">
              <Input
                type="number"
                value={eosbForm.accruedLeaveDays}
                onChange={(e) => setEosbForm({ ...eosbForm, accruedLeaveDays: Number(e.target.value) })}
              />
            </FormField>

            <FormField label="Unpaid Salary (Days)">
              <Input
                type="number"
                value={eosbForm.unpaidSalaryDays}
                onChange={(e) => setEosbForm({ ...eosbForm, unpaidSalaryDays: Number(e.target.value) })}
              />
            </FormField>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
