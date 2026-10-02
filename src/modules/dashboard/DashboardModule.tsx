/**
 * GulfHive ERP - Enterprise Command Center Dashboard
 * Real-time, calm, permission-aware operational dashboard designed for 5-second business clarity.
 * Adheres strictly to GulfHive Design System: quiet typography, zero pills, unboxed metadata, and direct actionability.
 */

import React, { useState, useEffect } from 'react';
import { useI18n } from '../../shared/i18n/I18nContext.tsx';
import {
  Users,
  Clock,
  Coins,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Building2,
  FileText,
  UserPlus,
  CreditCard,
  ShieldCheck,
  Activity,
  Plus,
  ArrowUpRight,
  TrendingUp,
  Briefcase
} from 'lucide-react';
import { Button, LoadingState, ErrorState } from '../../design-system/index.ts';
import { AccessRestricted } from '../../shared/components/AccessRestricted.tsx';
import { apiClient } from '../../lib/api-client.ts';

export interface DashboardModuleProps {
  company: any;
  branches: any[];
  activeBranchId: string;
  onNavigate: (module: string, filter?: string) => void;
}

export function DashboardModule({
  company,
  branches,
  activeBranchId,
  onNavigate,
}: DashboardModuleProps) {
  const { t, language, direction } = useI18n();

  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isForbidden, setIsForbidden] = useState(false);

  const ArrowIcon = direction === 'rtl' ? ArrowLeft : ArrowRight;

  const fetchDashboardData = async () => {
    if (!company?.id) return;
    setIsLoading(true);
    setErrorMsg(null);
    setIsForbidden(false);

    try {
      const json = await apiClient.get(`/api/companies/${company.id}/dashboard`, {
        params: { branchId: activeBranchId || undefined },
      });
      setData(json.summary);
    } catch (err: any) {
      if (err.status === 401 || err.code === 'UNAUTHORIZED' || (err.message && err.message.includes('Authentication required'))) {
        // Handled centrally by AuthContext - session invalid or expired
        return;
      }
      if (err.status === 403 || err.code === 'FORBIDDEN') {
        setIsForbidden(true);
        return;
      }
      setErrorMsg(err.message || 'Failed to connect to GulfHive Services');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [company?.id, activeBranchId]);

  // Current formatted date
  const now = new Date();
  const dateFormattedEn = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const dateFormattedAr = now.toLocaleDateString('ar-KW', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const greetingName = 'Administrator';

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Skeleton Greeting */}
        <div className="h-12 bg-slate-200/60 rounded w-1/3" />

        {/* Skeleton Top Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-200/60 rounded-lg" />
          ))}
        </div>

        {/* Skeleton Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-64 bg-slate-200/60 rounded-lg" />
          <div className="h-64 bg-slate-200/60 rounded-lg" />
        </div>
      </div>
    );
  }

  if (isForbidden) {
    return (
      <AccessRestricted
        requiredPermission="dashboard.view"
        onGoHome={fetchDashboardData}
      />
    );
  }

  if (errorMsg) {
    return <ErrorState message={errorMsg} onRetry={fetchDashboardData} />;
  }

  const metrics = data?.metrics || {};
  const payrollStatus = data?.payrollStatus;
  const needsAttention = data?.needsAttention || [];
  const recentActivity = data?.recentActivity || [];
  const setupProgress = data?.setupProgress;

  return (
    <div className="space-y-6">
      {/* 1. Personal Greeting Subheader */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {language === 'ar' ? `صباح الخير، ${greetingName}` : `Good morning, ${greetingName}`}
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            {language === 'ar' ? dateFormattedAr : dateFormattedEn}
          </p>
        </div>

        {/* Active Context Tag */}
        <div className="flex items-center space-x-2 rtl:space-x-reverse text-xs text-slate-600 bg-white border border-slate-200 rounded-md px-3 py-1.5 shadow-2xs">
          <Building2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="font-semibold text-slate-800">
            {language === 'ar' ? company?.legalNameAr : company?.legalNameEn}
          </span>
          <span className="text-slate-300">·</span>
          <span className="font-mono text-[11px] text-slate-500">{company?.countryCode}-GCC</span>
        </div>
      </div>

      {/* 2. Setup Onboarding Banner (Only visible if setup is < 100%) */}
      {setupProgress && !setupProgress.isComplete && (
        <div className="bg-slate-900 text-white rounded-lg p-5 border border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5 rtl:space-x-reverse">
              <div className="w-6 h-6 rounded bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-xs">
                GH
              </div>
              <h3 className="text-sm font-bold text-white">Get GulfHive Ready for Operations</h3>
            </div>
            <span className="font-mono text-xs font-bold text-amber-400">
              {setupProgress.completedCount} of {setupProgress.totalCount} Steps Completed ({setupProgress.percentage}%)
            </span>
          </div>

          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-amber-500 h-full transition-all duration-300"
              style={{ width: `${setupProgress.percentage}%` }}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-xs">
            {setupProgress.steps.map((step: any) => (
              <div key={step.key} className="flex items-center space-x-1.5 rtl:space-x-reverse text-slate-300">
                <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${step.completed ? 'text-emerald-400' : 'text-slate-600'}`} />
                <span className={`truncate text-[11px] ${step.completed ? 'text-slate-200' : 'text-slate-400'}`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Primary Business Overview Metric Blocks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Active Employees */}
        <div
          onClick={() => onNavigate('people')}
          className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs hover:border-slate-300 transition cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span className="font-medium uppercase tracking-wider text-[10px]">Total Active Workforce</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div>
            <span className="text-2xl font-bold font-mono text-slate-900 block">
              {metrics.totalEmployees || 0}
            </span>
            <span className="text-[11px] text-slate-500 mt-1 block font-mono">
              Staff Master Records
            </span>
          </div>
        </div>

        {/* Metric 2: On Duty / Scheduled Today */}
        <div
          onClick={() => onNavigate('time')}
          className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs hover:border-slate-300 transition cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span className="font-medium uppercase tracking-wider text-[10px]">On Duty Today</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div>
            <div className="flex items-baseline space-x-2 rtl:space-x-reverse">
              <span className="text-2xl font-bold font-mono text-slate-900">
                {metrics.onDutyCount || 0}
              </span>
              <span className="text-xs font-mono font-bold text-emerald-700">
                ({metrics.attendancePercentage || 0}%)
              </span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block font-mono">
              Checked-in & Active
            </span>
          </div>
        </div>

        {/* Metric 3: Payroll Batch Status */}
        <div
          onClick={() => onNavigate('payroll')}
          className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs hover:border-slate-300 transition cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span className="font-medium uppercase tracking-wider text-[10px]">Current Payroll</span>
            <Coins className="w-4 h-4 text-slate-400" />
          </div>
          <div>
            {payrollStatus ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold font-mono text-slate-900">
                    {payrollStatus.periodYear}/{String(payrollStatus.periodMonth).padStart(2, '0')}
                  </span>
                  <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${
                    payrollStatus.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}>
                    {payrollStatus.status}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-600 block mt-1">
                  Net: {payrollStatus.totalNetPay} {payrollStatus.currency}
                </span>
              </>
            ) : (
              <div>
                <span className="text-sm font-bold text-slate-700 block">Not Calculated</span>
                <span className="text-[11px] text-slate-400 block">Click to generate batch</span>
              </div>
            )}
          </div>
        </div>

        {/* Metric 4: Active Loans & Receivables */}
        <div
          onClick={() => onNavigate('payroll')}
          className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs hover:border-slate-300 transition cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span className="font-medium uppercase tracking-wider text-[10px]">Staff Loans Active</span>
            <CreditCard className="w-4 h-4 text-slate-400" />
          </div>
          <div>
            <span className="text-2xl font-bold font-mono text-slate-900 block">
              {metrics.activeLoansCount || 0}
            </span>
            <span className="text-[11px] text-slate-500 mt-1 block font-mono">
              Monthly Payroll Deductions
            </span>
          </div>
        </div>
      </div>

      {/* 4. Main Viewport Grid: Needs Attention & Workforce / Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2-Columns: Needs Attention & Quick Actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Needs Attention Panel */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-2xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h2 className="text-sm font-bold text-slate-900">Needs Attention</h2>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {needsAttention.length} Actionable Exceptions
              </span>
            </div>

            {needsAttention.length > 0 ? (
              <div className="space-y-2.5">
                {needsAttention.map((item: any) => (
                  <div
                    key={item.id}
                    onClick={() => onNavigate(item.moduleTarget, item.filterTarget)}
                    className="p-3 bg-slate-50/70 border border-slate-200/80 rounded hover:border-slate-300 hover:bg-slate-50 transition cursor-pointer flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start space-x-3 rtl:space-x-reverse">
                      <div className={`p-2 rounded shrink-0 ${
                        item.severity === 'WARNING' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'
                      }`}>
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">{item.title}</h4>
                        <p className="text-slate-600 mt-0.5">{item.subtitle}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 rtl:space-x-reverse text-slate-800 font-semibold hover:text-slate-950 shrink-0">
                      <span>Review</span>
                      <ArrowIcon className="w-3.5 h-3.5" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded border border-dashed border-slate-200">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-2 opacity-80" />
                <p className="font-semibold text-slate-700">All Operations Clear</p>
                <p className="text-slate-400 mt-0.5">No critical exceptions or pending approvals require attention.</p>
              </div>
            )}
          </div>

          {/* Quick Actions Shortcuts */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-2xs p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Operational Quick Actions
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                onClick={() => onNavigate('people')}
                className="p-3 rounded border border-slate-200 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-300 transition text-left rtl:text-right cursor-pointer flex items-center space-x-2 rtl:space-x-reverse text-xs font-semibold text-slate-800"
              >
                <UserPlus className="w-4 h-4 text-slate-600 shrink-0" />
                <span className="truncate">+ Employee</span>
              </button>

              <button
                onClick={() => onNavigate('payroll')}
                className="p-3 rounded border border-slate-200 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-300 transition text-left rtl:text-right cursor-pointer flex items-center space-x-2 rtl:space-x-reverse text-xs font-semibold text-slate-800"
              >
                <Coins className="w-4 h-4 text-slate-600 shrink-0" />
                <span className="truncate">+ Run Payroll</span>
              </button>

              <button
                onClick={() => onNavigate('payroll')}
                className="p-3 rounded border border-slate-200 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-300 transition text-left rtl:text-right cursor-pointer flex items-center space-x-2 rtl:space-x-reverse text-xs font-semibold text-slate-800"
              >
                <CreditCard className="w-4 h-4 text-slate-600 shrink-0" />
                <span className="truncate">+ Disburse Loan</span>
              </button>

              <button
                onClick={() => onNavigate('settings')}
                className="p-3 rounded border border-slate-200 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-300 transition text-left rtl:text-right cursor-pointer flex items-center space-x-2 rtl:space-x-reverse text-xs font-semibold text-slate-800"
              >
                <Building2 className="w-4 h-4 text-slate-600 shrink-0" />
                <span className="truncate">Settings</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right 1-Column: Recent Activity & Workforce Snapshot */}
        <div className="space-y-6">
          {/* Workforce Breakdown */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-2xs p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2">
              Workforce Snapshot
            </h3>
            <div className="space-y-3 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Active Staff Master:</span>
                <span className="font-bold text-slate-900">{metrics.totalEmployees || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">On Duty Today:</span>
                <span className="font-bold text-emerald-800">{metrics.onDutyCount || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Pending Leave Requests:</span>
                <span className="font-bold text-amber-800">{metrics.pendingLeaveApprovals || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Expiring Civil IDs:</span>
                <span className="font-bold text-rose-700">{metrics.expiringDocumentsCount || 0}</span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full justify-center"
              onClick={() => onNavigate('people')}
            >
              Open Staff Directory
            </Button>
          </div>

          {/* Recent Audit & Workflow Activity */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-2xs p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Recent Audit Trail
              </h3>
              <Activity className="w-3.5 h-3.5 text-slate-400" />
            </div>

            {recentActivity.length > 0 ? (
              <div className="space-y-3 text-xs">
                {recentActivity.map((act: any) => (
                  <div key={act.id} className="flex items-start space-x-2.5 rtl:space-x-reverse pb-2.5 border-b border-slate-100 last:border-0 last:pb-0">
                    <div className="w-2 h-2 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">
                        {act.action}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {act.actor} · {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">No recent activity recorded.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
