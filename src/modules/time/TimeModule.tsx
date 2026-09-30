/**
 * GulfHive ERP - Time & Workforce Scheduling Module
 * Complete management of Attendance, Shift Templates, Rosters, Holidays, Leave, Overtime, and Approval Flows.
 * Enforces versioned GCC statutory rules and reusable approval engine.
 */

import React, { useState, useEffect } from 'react';
import { useI18n } from '../../shared/i18n/I18nContext.tsx';
import {
  Clock,
  Calendar,
  Coffee,
  CheckCircle2,
  XCircle,
  Plus,
  AlertTriangle,
  History,
  FileCheck,
  TrendingUp,
  LogIn,
  LogOut,
  Sparkles,
  FileText,
  Download,
  Lock,
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

export interface TimeModuleProps {
  company: any;
  branches: any[];
  activeBranchId: string;
}

export function TimeModule({ company, branches, activeBranchId }: TimeModuleProps) {
  const { t, language } = useI18n();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<'attendance' | 'shifts' | 'rosters' | 'leave' | 'overtime' | 'holidays' | 'corrections' | 'timesheets'>('attendance');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // Data states
  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  const [shiftsList, setShiftsList] = useState<any[]>([]);
  const [rostersList, setRostersList] = useState<any[]>([]);
  const [leaveRequestsList, setLeaveRequestsList] = useState<any[]>([]);
  const [leaveTypesList, setLeaveTypesList] = useState<any[]>([]);
  const [overtimeList, setOvertimeList] = useState<any[]>([]);
  const [holidaysList, setHolidaysList] = useState<any[]>([]);
  const [correctionsList, setCorrectionsList] = useState<any[]>([]);
  const [timesheetsList, setTimesheetsList] = useState<any[]>([]);
  const [employeesList, setEmployeesList] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Dialog States
  const [showCheckInDialog, setShowCheckInDialog] = useState(false);
  const [showShiftDialog, setShowShiftDialog] = useState(false);
  const [showRosterDialog, setShowRosterDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showOvertimeDialog, setShowOvertimeDialog] = useState(false);
  const [showHolidayDialog, setShowHolidayDialog] = useState(false);
  const [showCorrectionDialog, setShowCorrectionDialog] = useState(false);
  const [showTimesheetDialog, setShowTimesheetDialog] = useState(false);

  // Forms
  const [checkInForm, setCheckInForm] = useState({ employeeId: '', date: selectedDate, shiftId: '' });
  const [shiftForm, setShiftForm] = useState({ code: '', nameEn: '', nameAr: '', startTime: '08:00', endTime: '16:00', gracePeriodMinutes: 15, breakDurationMinutes: 60, isOvernight: false });
  const [rosterForm, setRosterForm] = useState({ employeeId: '', shiftId: '', startDate: selectedDate, endDate: selectedDate, notes: '' });
  const [leaveForm, setLeaveForm] = useState({ employeeId: '', leaveTypeId: '', startDate: selectedDate, endDate: selectedDate, daysRequested: 1, reason: '' });
  const [overtimeForm, setOvertimeForm] = useState({ employeeId: '', date: selectedDate, overtimeType: 'REGULAR_DAY', minutes: 120, reason: '' });
  const [holidayForm, setHolidayForm] = useState({ nameEn: '', nameAr: '', startDate: selectedDate, endDate: selectedDate, countryCode: company?.countryCode || 'KW', isRecurring: false });
  const [correctionForm, setCorrectionForm] = useState({ attendanceId: '', employeeId: '', requestedCheckIn: '', requestedCheckOut: '', reason: '' });
  const [timesheetForm, setTimesheetForm] = useState({
    employeeId: '',
    periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10),
  });

  const loadAllData = async () => {
    if (!company?.id) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const [attRes, shfRes, rstRes, lvReqRes, lvTypRes, otRes, holRes, corRes, empRes, tsRes] = await Promise.all([
        fetch(`/api/companies/${company.id}/attendance?date=${selectedDate}`),
        fetch(`/api/companies/${company.id}/shifts`),
        fetch(`/api/companies/${company.id}/rosters`),
        fetch(`/api/companies/${company.id}/leave-requests`),
        fetch(`/api/companies/${company.id}/leave-types`),
        fetch(`/api/companies/${company.id}/overtime`),
        fetch(`/api/companies/${company.id}/holidays`),
        fetch(`/api/companies/${company.id}/attendance-corrections`),
        fetch(`/api/companies/${company.id}/employees`),
        fetch(`/api/companies/${company.id}/timesheets`),
      ]);

      if (attRes.ok) setAttendanceList((await attRes.json()).attendance || []);
      if (shfRes.ok) setShiftsList((await shfRes.json()).shifts || []);
      if (rstRes.ok) setRostersList((await rstRes.json()).rosters || []);
      if (lvReqRes.ok) setLeaveRequestsList((await lvReqRes.json()).leaveRequests || []);
      if (lvTypRes.ok) setLeaveTypesList((await lvTypRes.json()).leaveTypes || []);
      if (otRes.ok) setOvertimeList((await otRes.json()).overtimeRecords || []);
      if (holRes.ok) setHolidaysList((await holRes.json()).holidays || []);
      if (corRes.ok) setCorrectionsList((await corRes.json()).corrections || []);
      if (empRes.ok) setEmployeesList((await empRes.json()).employees || []);
      if (tsRes.ok) setTimesheetsList((await tsRes.json()).timesheets || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load Time module data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [company?.id, selectedDate]);

  // Actions
  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkInForm.employeeId) return;

    try {
      const res = await fetch(`/api/companies/${company.id}/attendance/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...checkInForm,
          branchId: activeBranchId,
          source: 'WEB',
        }),
      });

      if (!res.ok) throw new Error('Check-in failed');
      addToast({ type: 'success', title: 'Punch Recorded', message: 'Employee check-in logged' });
      setShowCheckInDialog(false);
      loadAllData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const handleCheckOut = async (attendanceId: string) => {
    try {
      const res = await fetch(`/api/companies/${company.id}/attendance/${attendanceId}/check-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkOutTime: new Date().toISOString() }),
      });

      if (!res.ok) throw new Error('Check-out failed');
      addToast({ type: 'success', title: 'Punch Recorded', message: 'Employee check-out logged' });
      loadAllData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftForm.code || !shiftForm.nameEn || !shiftForm.nameAr) return;

    try {
      const res = await fetch(`/api/companies/${company.id}/shifts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shiftForm),
      });

      if (!res.ok) throw new Error('Failed to create shift');
      addToast({ type: 'success', title: 'Shift Created', message: shiftForm.code });
      setShowShiftDialog(false);
      setShiftForm({ code: '', nameEn: '', nameAr: '', startTime: '08:00', endTime: '16:00', gracePeriodMinutes: 15, breakDurationMinutes: 60, isOvernight: false });
      loadAllData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const handleCreateRoster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rosterForm.employeeId || !rosterForm.shiftId) return;

    try {
      const res = await fetch(`/api/companies/${company.id}/rosters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...rosterForm,
          branchId: activeBranchId,
        }),
      });

      if (!res.ok) throw new Error('Failed to assign roster');
      addToast({ type: 'success', title: 'Roster Assigned', message: 'Shift schedule updated' });
      setShowRosterDialog(false);
      loadAllData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const handleCreateLeaveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveForm.employeeId || !leaveForm.leaveTypeId) return;

    try {
      const res = await fetch(`/api/companies/${company.id}/leave-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leaveForm),
      });

      if (!res.ok) throw new Error('Failed to submit leave request');
      addToast({ type: 'success', title: 'Leave Application Submitted', message: 'Routed for manager approval' });
      setShowLeaveDialog(false);
      loadAllData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const handleReviewLeave = async (requestId: string, decision: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await fetch(`/api/companies/${company.id}/leave-requests/${requestId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reviewerId: 'admin' }),
      });

      if (!res.ok) throw new Error('Review action failed');
      addToast({ type: decision === 'APPROVED' ? 'success' : 'warning', title: `Leave ${decision}`, message: 'Decision audited' });
      loadAllData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const handleCreateOvertime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overtimeForm.employeeId || !overtimeForm.minutes) return;

    try {
      const res = await fetch(`/api/companies/${company.id}/overtime`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...overtimeForm,
          countryCode: company?.countryCode || 'KW',
          actorId: 'admin',
        }),
      });

      if (!res.ok) throw new Error('Failed to log overtime');
      addToast({ type: 'success', title: 'Overtime Claim Logged', message: 'Statutory multiplier applied' });
      setShowOvertimeDialog(false);
      loadAllData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const handleReviewOvertime = async (otId: string, decision: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await fetch(`/api/companies/${company.id}/overtime/${otId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reviewerId: 'admin' }),
      });

      if (!res.ok) throw new Error('Review action failed');
      addToast({ type: decision === 'APPROVED' ? 'success' : 'warning', title: `Overtime ${decision}`, message: 'Decision audited' });
      loadAllData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const handleCreateHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayForm.nameEn || !holidayForm.nameAr) return;

    try {
      const res = await fetch(`/api/companies/${company.id}/holidays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(holidayForm),
      });

      if (!res.ok) throw new Error('Failed to record holiday');
      addToast({ type: 'success', title: 'Public Holiday Created', message: holidayForm.nameEn });
      setShowHolidayDialog(false);
      loadAllData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const handleReviewCorrection = async (corId: string, decision: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await fetch(`/api/companies/${company.id}/attendance-corrections/${corId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reviewerId: 'admin' }),
      });

      if (!res.ok) throw new Error('Review action failed');
      addToast({ type: decision === 'APPROVED' ? 'success' : 'warning', title: `Correction ${decision}`, message: 'Attendance adjusted' });
      loadAllData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const handleGenerateTimesheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!timesheetForm.employeeId || !timesheetForm.periodStart || !timesheetForm.periodEnd) return;

    try {
      const res = await fetch(`/api/companies/${company.id}/timesheets/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...timesheetForm,
          actorId: 'admin',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate timesheet');
      }

      const data = await res.json();
      addToast({
        type: 'success',
        title: 'Timesheet Generated',
        message: `Generated ${data.timesheet?.timesheetNumber || 'successfully'}`
      });
      setShowTimesheetDialog(false);
      loadAllData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Timesheet Generation Error', message: err.message });
    }
  };

  const handleTimesheetAction = async (id: string, action: 'submit' | 'approve' | 'lock') => {
    try {
      const res = await fetch(`/api/companies/${company.id}/timesheets/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorId: 'admin' }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to ${action} timesheet`);
      }

      addToast({
        type: 'success',
        title: 'Timesheet Updated',
        message: `Timesheet status advanced to ${action}ed.`
      });
      loadAllData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Action Failed', message: err.message });
    }
  };

  // Table Columns
  const attendanceColumns: Column<any>[] = [
    {
      key: 'employee',
      header: 'Employee',
      sortable: true,
      width: '24%',
      render: (a) => (
        <div>
          <span className="font-semibold text-slate-900 block">
            {language === 'ar' ? a.employeeNameAr : a.employeeNameEn}
          </span>
          <span className="font-mono text-[11px] text-slate-400">{a.employeeNumber}</span>
        </div>
      ),
    },
    {
      key: 'checkIn',
      header: 'Check-In',
      render: (a) => (
        <span className="font-mono text-slate-800 font-medium">
          {a.checkIn ? new Date(a.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
        </span>
      ),
    },
    {
      key: 'checkOut',
      header: 'Check-Out',
      render: (a) => (
        <span className="font-mono text-slate-800 font-medium">
          {a.checkOut ? new Date(a.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
        </span>
      ),
    },
    {
      key: 'totalWorked',
      header: 'Hours Worked',
      render: (a) => {
        const hrs = Math.floor(a.totalMinutes / 60);
        const mins = a.totalMinutes % 60;
        return <span className="font-mono text-slate-700">{hrs}h {mins}m</span>;
      },
    },
    {
      key: 'overtime',
      header: 'Overtime',
      render: (a) => {
        if (!a.overtimeMinutes) return <span className="font-mono text-slate-300">0m</span>;
        return <span className="font-mono font-bold text-amber-700">+{a.overtimeMinutes}m</span>;
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (a) => (
        <span className="font-mono text-[11px] font-semibold text-slate-800">
          {a.status}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (a) => (
        <div className="flex items-center justify-end space-x-1 rtl:space-x-reverse">
          {a.checkIn && !a.checkOut && (
            <Button size="sm" variant="secondary" onClick={() => handleCheckOut(a.id)}>
              {t('time.action.check_out')}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setCorrectionForm({ attendanceId: a.id, employeeId: a.employeeId, requestedCheckIn: '', requestedCheckOut: '', reason: '' });
              setShowCorrectionDialog(true);
            }}
          >
            Adjust
          </Button>
        </div>
      ),
    },
  ];

  const shiftColumns: Column<any>[] = [
    {
      key: 'code',
      header: t('time.field.shift_code'),
      sortable: true,
      width: '15%',
      render: (s) => <span className="font-mono font-bold text-slate-900">{s.code}</span>,
    },
    {
      key: 'name',
      header: 'Shift Name',
      sortable: true,
      render: (s) => (
        <div>
          <span className="font-medium text-slate-900 block">{s.nameEn}</span>
          <span className="font-arabic text-xs text-slate-500 block">{s.nameAr}</span>
        </div>
      ),
    },
    {
      key: 'hours',
      header: 'Working Hours',
      render: (s) => (
        <span className="font-mono text-slate-800 font-semibold">
          {s.startTime} – {s.endTime}
        </span>
      ),
    },
    {
      key: 'grace',
      header: t('time.field.grace_minutes'),
      render: (s) => <span className="font-mono text-slate-600">{s.gracePeriodMinutes} mins</span>,
    },
    {
      key: 'break',
      header: t('time.field.break_minutes'),
      render: (s) => <span className="font-mono text-slate-600">{s.breakDurationMinutes} mins</span>,
    },
  ];

  const rosterColumns: Column<any>[] = [
    {
      key: 'employee',
      header: 'Employee',
      sortable: true,
      render: (r) => (
        <div>
          <span className="font-semibold text-slate-900 block">{r.employeeNameEn}</span>
          <span className="font-mono text-[11px] text-slate-400">{r.employeeNumber}</span>
        </div>
      ),
    },
    {
      key: 'shift',
      header: 'Shift Assigned',
      sortable: true,
      render: (r) => (
        <div>
          <span className="font-bold text-slate-900 block">{r.shiftCode} ({r.shiftNameEn})</span>
          <span className="font-mono text-[11px] text-slate-500">{r.startTime} – {r.endTime}</span>
        </div>
      ),
    },
    {
      key: 'period',
      header: 'Effective Schedule',
      render: (r) => (
        <span className="font-mono text-[11px] text-slate-700">
          {new Date(r.startDate).toLocaleDateString()} – {new Date(r.endDate).toLocaleDateString()}
        </span>
      ),
    },
  ];

  const leaveColumns: Column<any>[] = [
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
      key: 'leaveType',
      header: t('time.field.leave_type'),
      sortable: true,
      render: (l) => <span className="font-bold text-slate-800">{l.leaveTypeNameEn}</span>,
    },
    {
      key: 'dates',
      header: 'Duration',
      render: (l) => (
        <div className="font-mono text-xs">
          <span>{new Date(l.startDate).toLocaleDateString()} – {new Date(l.endDate).toLocaleDateString()}</span>
          <span className="block text-[11px] text-slate-400 font-bold">({l.daysRequested} Days)</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('time.field.status'),
      sortable: true,
      render: (l) => (
        <span className={`font-mono text-[11px] font-bold ${
          l.status === 'APPROVED' ? 'text-emerald-700' : l.status === 'REJECTED' ? 'text-rose-600' : 'text-amber-700'
        }`}>
          {l.status}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (l) => (
        l.status === 'PENDING' ? (
          <div className="flex items-center justify-end space-x-1.5 rtl:space-x-reverse">
            <Button size="sm" variant="success" onClick={() => handleReviewLeave(l.id, 'APPROVED')}>
              Approve
            </Button>
            <Button size="sm" variant="danger" onClick={() => handleReviewLeave(l.id, 'REJECTED')}>
              Reject
            </Button>
          </div>
        ) : null
      ),
    },
  ];

  const overtimeColumns: Column<any>[] = [
    {
      key: 'employee',
      header: 'Employee',
      sortable: true,
      render: (ot) => (
        <div>
          <span className="font-semibold text-slate-900 block">{ot.employeeNameEn}</span>
          <span className="font-mono text-[11px] text-slate-400">{ot.employeeNumber}</span>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      render: (ot) => <span className="font-mono text-slate-700">{ot.date}</span>,
    },
    {
      key: 'type',
      header: t('time.field.overtime_type'),
      render: (ot) => <span className="font-bold text-slate-800">{ot.overtimeType}</span>,
    },
    {
      key: 'multiplier',
      header: 'Statutory Rate',
      render: (ot) => (
        <span className="font-mono font-bold text-amber-800">
          {ot.statutoryRateMultiplier}x normal wage
        </span>
      ),
    },
    {
      key: 'minutes',
      header: 'Minutes',
      render: (ot) => <span className="font-mono font-bold text-slate-900">{ot.minutes}m</span>,
    },
    {
      key: 'status',
      header: t('time.field.status'),
      render: (ot) => (
        <span className={`font-mono text-[11px] font-bold ${
          ot.status === 'APPROVED' ? 'text-emerald-700' : ot.status === 'REJECTED' ? 'text-rose-600' : 'text-amber-700'
        }`}>
          {ot.status}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (ot) => (
        ot.status === 'PENDING' ? (
          <div className="flex items-center justify-end space-x-1.5 rtl:space-x-reverse">
            <Button size="sm" variant="success" onClick={() => handleReviewOvertime(ot.id, 'APPROVED')}>
              Approve
            </Button>
            <Button size="sm" variant="danger" onClick={() => handleReviewOvertime(ot.id, 'REJECTED')}>
              Reject
            </Button>
          </div>
        ) : null
      ),
    },
  ];

  const holidayColumns: Column<any>[] = [
    {
      key: 'name',
      header: 'Holiday Name',
      sortable: true,
      render: (h) => (
        <div>
          <span className="font-semibold text-slate-900 block">{h.nameEn}</span>
          <span className="font-arabic text-xs text-slate-500 block">{h.nameAr}</span>
        </div>
      ),
    },
    {
      key: 'country',
      header: 'Jurisdiction',
      render: (h) => <span className="font-mono font-semibold text-slate-700">{h.countryCode}</span>,
    },
    {
      key: 'dates',
      header: 'Observance Window',
      render: (h) => (
        <span className="font-mono text-xs text-slate-800">
          {new Date(h.startDate).toLocaleDateString()} – {new Date(h.endDate).toLocaleDateString()} ({h.daysCount} days)
        </span>
      ),
    },
    {
      key: 'recurring',
      header: 'Frequency',
      render: (h) => <span className="font-mono text-slate-500">{h.isRecurring ? 'Annual Recurring' : 'Single Year'}</span>,
    },
  ];

  const correctionColumns: Column<any>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (c) => (
        <div>
          <span className="font-semibold text-slate-900 block">{c.employeeNameEn}</span>
          <span className="font-mono text-[11px] text-slate-400">{c.employeeNumber}</span>
        </div>
      ),
    },
    {
      key: 'requested',
      header: 'Requested Timestamps',
      render: (c) => (
        <div className="font-mono text-xs">
          <span>In: {c.requestedCheckIn ? new Date(c.requestedCheckIn).toLocaleTimeString() : '—'}</span>
          <br />
          <span>Out: {c.requestedCheckOut ? new Date(c.requestedCheckOut).toLocaleTimeString() : '—'}</span>
        </div>
      ),
    },
    {
      key: 'reason',
      header: t('time.field.reason'),
      render: (c) => <span className="text-slate-700 text-xs">{c.reason}</span>,
    },
    {
      key: 'status',
      header: t('time.field.status'),
      render: (c) => (
        <span className={`font-mono text-[11px] font-bold ${
          c.status === 'APPROVED' ? 'text-emerald-700' : c.status === 'REJECTED' ? 'text-rose-600' : 'text-amber-700'
        }`}>
          {c.status}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (c) => (
        c.status === 'PENDING' ? (
          <div className="flex items-center justify-end space-x-1.5 rtl:space-x-reverse">
            <Button size="sm" variant="success" onClick={() => handleReviewCorrection(c.id, 'APPROVED')}>
              Approve
            </Button>
            <Button size="sm" variant="danger" onClick={() => handleReviewCorrection(c.id, 'REJECTED')}>
              Reject
            </Button>
          </div>
        ) : null
      ),
    },
  ];

  const timesheetColumns: Column<any>[] = [
    {
      key: 'timesheetNumber',
      header: 'Timesheet #',
      sortable: true,
      render: (ts) => (
        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
          {ts.timesheetNumber}
        </span>
      ),
    },
    {
      key: 'employee',
      header: 'Employee',
      sortable: true,
      render: (ts) => (
        <div>
          <span className="font-semibold text-slate-900 block">{ts.employeeNameEn}</span>
          <span className="font-mono text-[11px] text-slate-400">{ts.employeeNumber}</span>
        </div>
      ),
    },
    {
      key: 'period',
      header: 'Period Window',
      render: (ts) => (
        <span className="font-mono text-xs text-slate-700">
          {ts.periodStart} → {ts.periodEnd}
        </span>
      ),
    },
    {
      key: 'regularHours',
      header: 'Regular Time',
      render: (ts) => (
        <span className="font-mono text-xs font-semibold text-slate-800">
          {((ts.totalRegularMinutes || 0) / 60).toFixed(1)} hrs
        </span>
      ),
    },
    {
      key: 'overtimeHours',
      header: 'Candidate OT',
      render: (ts) => (
        <span className="font-mono text-xs font-semibold text-amber-700">
          {((ts.totalOvertimeMinutes || 0) / 60).toFixed(1)} hrs
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Lifecycle Status',
      render: (ts) => {
        const colors: Record<string, string> = {
          DRAFT: 'bg-slate-100 text-slate-700 border-slate-300',
          SUBMITTED: 'bg-blue-50 text-blue-700 border-blue-200',
          APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          LOCKED: 'bg-purple-50 text-purple-700 border-purple-200',
        };
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-mono font-bold ${colors[ts.status] || ''}`}>
            {ts.status === 'LOCKED' && <Lock className="w-2.5 h-2.5 mr-1 rtl:ml-1" />}
            {ts.status}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (ts) => (
        <div className="flex items-center justify-end space-x-1.5 rtl:space-x-reverse">
          {ts.status === 'DRAFT' && (
            <Button size="sm" variant="primary" onClick={() => handleTimesheetAction(ts.id, 'submit')}>
              Submit
            </Button>
          )}
          {ts.status === 'SUBMITTED' && (
            <Button size="sm" variant="success" onClick={() => handleTimesheetAction(ts.id, 'approve')}>
              Approve
            </Button>
          )}
          {ts.status === 'APPROVED' && (
            <Button size="sm" variant="secondary" leftIcon={<Lock className="w-3 h-3" />} onClick={() => handleTimesheetAction(ts.id, 'lock')}>
              Lock for Payroll
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Module Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'attendance', label: t('time.tab.attendance'), icon: Clock, count: attendanceList.length },
            { id: 'shifts', label: t('time.tab.shifts'), icon: Coffee, count: shiftsList.length },
            { id: 'rosters', label: t('time.tab.rosters'), icon: Calendar, count: rostersList.length },
            { id: 'leave', label: t('time.tab.leave'), icon: CheckCircle2, count: leaveRequestsList.length },
            { id: 'overtime', label: t('time.tab.overtime'), icon: TrendingUp, count: overtimeList.length },
            { id: 'holidays', label: t('time.tab.holidays'), icon: Sparkles, count: holidaysList.length },
            { id: 'corrections', label: t('time.tab.corrections'), icon: AlertTriangle, count: correctionsList.length },
            { id: 'timesheets', label: t('time.tab.timesheets'), icon: FileText, count: timesheetsList.length },
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

        {/* Tab Context Primary Action */}
        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          {activeTab === 'attendance' && (
            <>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="py-1 text-xs w-36 font-mono"
              />
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Download className="w-3.5 h-3.5" />}
                onClick={() => window.open(`/api/companies/${company?.id}/time/reports/export-pdf?workDate=${selectedDate}`, '_blank')}
                title="Export Daily Attendance PDF Report"
              >
                PDF
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Download className="w-3.5 h-3.5" />}
                onClick={() => window.open(`/api/companies/${company?.id}/time/reports/export-csv?workDate=${selectedDate}`, '_blank')}
                title="Export Daily Attendance CSV"
              >
                CSV
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<LogIn className="w-3.5 h-3.5" />}
                onClick={() => setShowCheckInDialog(true)}
              >
                {t('time.action.check_in')}
              </Button>
            </>
          )}
          {activeTab === 'shifts' && (
            <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowShiftDialog(true)}>
              {t('time.action.new_shift')}
            </Button>
          )}
          {activeTab === 'rosters' && (
            <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowRosterDialog(true)}>
              {t('time.action.assign_roster')}
            </Button>
          )}
          {activeTab === 'leave' && (
            <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowLeaveDialog(true)}>
              {t('time.action.request_leave')}
            </Button>
          )}
          {activeTab === 'overtime' && (
            <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowOvertimeDialog(true)}>
              {t('time.action.claim_overtime')}
            </Button>
          )}
          {activeTab === 'holidays' && (
            <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowHolidayDialog(true)}>
              {t('time.action.new_holiday')}
            </Button>
          )}
          {activeTab === 'timesheets' && (
            <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowTimesheetDialog(true)}>
              Generate Timesheet
            </Button>
          )}
        </div>
      </div>

      {errorMsg && <ErrorState message={errorMsg} onRetry={loadAllData} />}

      {/* TAB 1: Attendance */}
      {activeTab === 'attendance' && (
        <Table
          columns={attendanceColumns}
          data={attendanceList}
          keyExtractor={(a) => a.id}
          isLoading={isLoading}
          searchable={true}
          searchPlaceholder="Search attendance by employee..."
          pageSize={10}
        />
      )}

      {/* TAB 2: Shifts */}
      {activeTab === 'shifts' && (
        <Table
          columns={shiftColumns}
          data={shiftsList}
          keyExtractor={(s) => s.id}
          isLoading={isLoading}
          searchable={true}
          searchPlaceholder="Search shift templates..."
          pageSize={10}
        />
      )}

      {/* TAB 3: Rosters */}
      {activeTab === 'rosters' && (
        <Table
          columns={rosterColumns}
          data={rostersList}
          keyExtractor={(r) => r.id}
          isLoading={isLoading}
          searchable={true}
          searchPlaceholder="Search shift rosters..."
          pageSize={10}
        />
      )}

      {/* TAB 4: Leave Requests */}
      {activeTab === 'leave' && (
        <Table
          columns={leaveColumns}
          data={leaveRequestsList}
          keyExtractor={(l) => l.id}
          isLoading={isLoading}
          searchable={true}
          searchPlaceholder="Search leave applications..."
          pageSize={10}
        />
      )}

      {/* TAB 5: Overtime */}
      {activeTab === 'overtime' && (
        <Table
          columns={overtimeColumns}
          data={overtimeList}
          keyExtractor={(ot) => ot.id}
          isLoading={isLoading}
          searchable={true}
          searchPlaceholder="Search overtime logs..."
          pageSize={10}
        />
      )}

      {/* TAB 6: Public Holidays */}
      {activeTab === 'holidays' && (
        <Table
          columns={holidayColumns}
          data={holidaysList}
          keyExtractor={(h) => h.id}
          isLoading={isLoading}
          searchable={true}
          searchPlaceholder="Search statutory public holidays..."
          pageSize={10}
        />
      )}

      {/* TAB 7: Attendance Corrections */}
      {activeTab === 'corrections' && (
        <Table
          columns={correctionColumns}
          data={correctionsList}
          keyExtractor={(c) => c.id}
          isLoading={isLoading}
          searchable={true}
          searchPlaceholder="Search punch correction requests..."
          pageSize={10}
        />
      )}

      {/* TAB 8: Timesheets & Authoritative Allocations */}
      {activeTab === 'timesheets' && (
        <Table
          columns={timesheetColumns}
          data={timesheetsList}
          keyExtractor={(ts) => ts.id}
          isLoading={isLoading}
          searchable={true}
          searchPlaceholder="Search timesheets by number or employee..."
          pageSize={10}
        />
      )}

      {/* Check In Modal */}
      <Dialog
        isOpen={showCheckInDialog}
        onClose={() => setShowCheckInDialog(false)}
        title={t('time.action.check_in')}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowCheckInDialog(false)}>
              {t('action.cancel')}
            </Button>
            <Button variant="primary" size="sm" onClick={handleCheckIn}>
              Record Punch
            </Button>
          </>
        }
      >
        <form onSubmit={handleCheckIn} className="space-y-3">
          <FormField label="Employee" required>
            <Select
              value={checkInForm.employeeId}
              onChange={(e) => setCheckInForm({ ...checkInForm, employeeId: e.target.value })}
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

          <FormField label="Assigned Shift (Optional)">
            <Select
              value={checkInForm.shiftId}
              onChange={(e) => setCheckInForm({ ...checkInForm, shiftId: e.target.value })}
            >
              <option value="">Select Shift...</option>
              {shiftsList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} ({s.startTime} - {s.endTime})
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Date" required>
            <Input
              type="date"
              value={checkInForm.date}
              onChange={(e) => setCheckInForm({ ...checkInForm, date: e.target.value })}
              required
            />
          </FormField>
        </form>
      </Dialog>

      {/* New Shift Modal */}
      <Dialog
        isOpen={showShiftDialog}
        onClose={() => setShowShiftDialog(false)}
        title={t('time.action.new_shift')}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowShiftDialog(false)}>
              {t('action.cancel')}
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateShift}>
              {t('action.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateShift} className="space-y-3">
          <FormField label={t('time.field.shift_code')} required>
            <Input
              type="text"
              value={shiftForm.code}
              onChange={(e) => setShiftForm({ ...shiftForm, code: e.target.value.toUpperCase() })}
              placeholder="e.g. DAY-01"
              className="font-mono uppercase"
              required
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('time.field.shift_name_en')} required>
              <Input
                type="text"
                value={shiftForm.nameEn}
                onChange={(e) => setShiftForm({ ...shiftForm, nameEn: e.target.value })}
                placeholder="Morning Regular Shift"
                required
              />
            </FormField>
            <FormField label={t('time.field.shift_name_ar')} required>
              <Input
                type="text"
                value={shiftForm.nameAr}
                onChange={(e) => setShiftForm({ ...shiftForm, nameAr: e.target.value })}
                placeholder="مناوبة الصباح الاعتيادية"
                dir="rtl"
                className="font-arabic text-right"
                required
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('time.field.start_time')} required>
              <Input
                type="time"
                value={shiftForm.startTime}
                onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })}
                required
              />
            </FormField>
            <FormField label={t('time.field.end_time')} required>
              <Input
                type="time"
                value={shiftForm.endTime}
                onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })}
                required
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('time.field.grace_minutes')}>
              <Input
                type="number"
                value={shiftForm.gracePeriodMinutes}
                onChange={(e) => setShiftForm({ ...shiftForm, gracePeriodMinutes: Number(e.target.value) })}
              />
            </FormField>
            <FormField label={t('time.field.break_minutes')}>
              <Input
                type="number"
                value={shiftForm.breakDurationMinutes}
                onChange={(e) => setShiftForm({ ...shiftForm, breakDurationMinutes: Number(e.target.value) })}
              />
            </FormField>
          </div>
        </form>
      </Dialog>

      {/* Assign Roster Modal */}
      <Dialog
        isOpen={showRosterDialog}
        onClose={() => setShowRosterDialog(false)}
        title={t('time.action.assign_roster')}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowRosterDialog(false)}>
              {t('action.cancel')}
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateRoster}>
              Assign Schedule
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateRoster} className="space-y-3">
          <FormField label="Employee" required>
            <Select
              value={rosterForm.employeeId}
              onChange={(e) => setRosterForm({ ...rosterForm, employeeId: e.target.value })}
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

          <FormField label="Shift Template" required>
            <Select
              value={rosterForm.shiftId}
              onChange={(e) => setRosterForm({ ...rosterForm, shiftId: e.target.value })}
              required
            >
              <option value="">Select Shift...</option>
              {shiftsList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} - {s.nameEn} ({s.startTime} - {s.endTime})
                </option>
              ))}
            </Select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Start Date" required>
              <Input
                type="date"
                value={rosterForm.startDate}
                onChange={(e) => setRosterForm({ ...rosterForm, startDate: e.target.value })}
                required
              />
            </FormField>
            <FormField label="End Date" required>
              <Input
                type="date"
                value={rosterForm.endDate}
                onChange={(e) => setRosterForm({ ...rosterForm, endDate: e.target.value })}
                required
              />
            </FormField>
          </div>
        </form>
      </Dialog>

      {/* Request Leave Modal */}
      <Dialog
        isOpen={showLeaveDialog}
        onClose={() => setShowLeaveDialog(false)}
        title={t('time.action.request_leave')}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowLeaveDialog(false)}>
              {t('action.cancel')}
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateLeaveRequest}>
              Submit Application
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateLeaveRequest} className="space-y-3">
          <FormField label="Employee" required>
            <Select
              value={leaveForm.employeeId}
              onChange={(e) => setLeaveForm({ ...leaveForm, employeeId: e.target.value })}
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

          <FormField label={t('time.field.leave_type')} required>
            <Select
              value={leaveForm.leaveTypeId}
              onChange={(e) => setLeaveForm({ ...leaveForm, leaveTypeId: e.target.value })}
              required
            >
              <option value="">Select Leave Type...</option>
              {leaveTypesList.map((lt) => (
                <option key={lt.id} value={lt.id}>
                  {lt.nameEn} ({lt.nameAr}) - {lt.defaultDaysPerYear} Days/Yr
                </option>
              ))}
            </Select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Start Date" required>
              <Input
                type="date"
                value={leaveForm.startDate}
                onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                required
              />
            </FormField>
            <FormField label="End Date" required>
              <Input
                type="date"
                value={leaveForm.endDate}
                onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                required
              />
            </FormField>
          </div>

          <FormField label={t('time.field.days')} required>
            <Input
              type="number"
              min="1"
              value={leaveForm.daysRequested}
              onChange={(e) => setLeaveForm({ ...leaveForm, daysRequested: Number(e.target.value) })}
              required
            />
          </FormField>

          <FormField label={t('time.field.reason')}>
            <Input
              type="text"
              value={leaveForm.reason}
              onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
              placeholder="e.g. Annual summer recess"
            />
          </FormField>
        </form>
      </Dialog>

      {/* Log Overtime Modal */}
      <Dialog
        isOpen={showOvertimeDialog}
        onClose={() => setShowOvertimeDialog(false)}
        title={t('time.action.claim_overtime')}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowOvertimeDialog(false)}>
              {t('action.cancel')}
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateOvertime}>
              Log Claim
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateOvertime} className="space-y-3">
          <FormField label="Employee" required>
            <Select
              value={overtimeForm.employeeId}
              onChange={(e) => setOvertimeForm({ ...overtimeForm, employeeId: e.target.value })}
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

          <FormField label={t('time.field.overtime_type')} required>
            <Select
              value={overtimeForm.overtimeType}
              onChange={(e) => setOvertimeForm({ ...overtimeForm, overtimeType: e.target.value as any })}
            >
              <option value="REGULAR_DAY">Regular Working Day (1.25x / 1.50x)</option>
              <option value="WEEKEND">Weekend Rest Day (1.50x)</option>
              <option value="HOLIDAY">Official Public Holiday (1.50x / 2.0x)</option>
            </Select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Date" required>
              <Input
                type="date"
                value={overtimeForm.date}
                onChange={(e) => setOvertimeForm({ ...overtimeForm, date: e.target.value })}
                required
              />
            </FormField>
            <FormField label={t('time.field.minutes')} required>
              <Input
                type="number"
                value={overtimeForm.minutes}
                onChange={(e) => setOvertimeForm({ ...overtimeForm, minutes: Number(e.target.value) })}
                required
              />
            </FormField>
          </div>

          <FormField label={t('time.field.reason')}>
            <Input
              type="text"
              value={overtimeForm.reason}
              onChange={(e) => setOvertimeForm({ ...overtimeForm, reason: e.target.value })}
              placeholder="e.g. Critical project deadline delivery"
            />
          </FormField>
        </form>
      </Dialog>

      {/* Add Public Holiday Modal */}
      <Dialog
        isOpen={showHolidayDialog}
        onClose={() => setShowHolidayDialog(false)}
        title={t('time.action.new_holiday')}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowHolidayDialog(false)}>
              {t('action.cancel')}
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateHoliday}>
              Save Holiday
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateHoliday} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Name (English)" required>
              <Input
                type="text"
                value={holidayForm.nameEn}
                onChange={(e) => setHolidayForm({ ...holidayForm, nameEn: e.target.value })}
                placeholder="National Day"
                required
              />
            </FormField>
            <FormField label="Name (Arabic)" required>
              <Input
                type="text"
                value={holidayForm.nameAr}
                onChange={(e) => setHolidayForm({ ...holidayForm, nameAr: e.target.value })}
                placeholder="العيد الوطني"
                dir="rtl"
                className="font-arabic text-right"
                required
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Start Date" required>
              <Input
                type="date"
                value={holidayForm.startDate}
                onChange={(e) => setHolidayForm({ ...holidayForm, startDate: e.target.value })}
                required
              />
            </FormField>
            <FormField label="End Date" required>
              <Input
                type="date"
                value={holidayForm.endDate}
                onChange={(e) => setHolidayForm({ ...holidayForm, endDate: e.target.value })}
                required
              />
            </FormField>
          </div>
        </form>
      </Dialog>

      {/* Attendance Punch Correction Modal */}
      <Dialog
        isOpen={showCorrectionDialog}
        onClose={() => setShowCorrectionDialog(false)}
        title={t('time.action.request_correction')}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowCorrectionDialog(false)}>
              {t('action.cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={async (e) => {
                e.preventDefault();
                if (!correctionForm.reason) return;
                try {
                  const res = await fetch(`/api/companies/${company.id}/attendance-corrections`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(correctionForm),
                  });
                  if (!res.ok) throw new Error('Correction submission failed');
                  addToast({ type: 'success', title: 'Correction Submitted', message: 'Sent for approval' });
                  setShowCorrectionDialog(false);
                  loadAllData();
                } catch (err: any) {
                  addToast({ type: 'error', title: 'Error', message: err.message });
                }
              }}
            >
              Submit for Approval
            </Button>
          </>
        }
      >
        <form className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Requested Check-In">
              <Input
                type="datetime-local"
                value={correctionForm.requestedCheckIn}
                onChange={(e) => setCorrectionForm({ ...correctionForm, requestedCheckIn: e.target.value })}
              />
            </FormField>
            <FormField label="Requested Check-Out">
              <Input
                type="datetime-local"
                value={correctionForm.requestedCheckOut}
                onChange={(e) => setCorrectionForm({ ...correctionForm, requestedCheckOut: e.target.value })}
              />
            </FormField>
          </div>

          <FormField label={t('time.field.reason')} required>
            <Input
              type="text"
              value={correctionForm.reason}
              onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
              placeholder="e.g. Biometric device offline during site ingress"
              required
            />
          </FormField>
        </form>
      </Dialog>

      {/* Generate Timesheet Modal */}
      <Dialog
        isOpen={showTimesheetDialog}
        onClose={() => setShowTimesheetDialog(false)}
        title="Generate Authoritative Timesheet"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowTimesheetDialog(false)}>
              {t('action.cancel')}
            </Button>
            <Button variant="primary" size="sm" onClick={handleGenerateTimesheet}>
              Generate Document
            </Button>
          </>
        }
      >
        <form onSubmit={handleGenerateTimesheet} className="space-y-3">
          <FormField label="Target Employee" required>
            <Select
              value={timesheetForm.employeeId}
              onChange={(e) => setTimesheetForm({ ...timesheetForm, employeeId: e.target.value })}
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
            <FormField label="Period Start Date" required>
              <Input
                type="date"
                value={timesheetForm.periodStart}
                onChange={(e) => setTimesheetForm({ ...timesheetForm, periodStart: e.target.value })}
                required
              />
            </FormField>
            <FormField label="Period End Date" required>
              <Input
                type="date"
                value={timesheetForm.periodEnd}
                onChange={(e) => setTimesheetForm({ ...timesheetForm, periodEnd: e.target.value })}
                required
              />
            </FormField>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-800">Deterministic Document Numbering:</p>
            <p>Assigns sequential numbering via Numbering Engine (e.g. <span className="font-mono font-bold">TS-2026-00001</span>).</p>
            <p>Aggregates approved attendance days, candidate overtime minutes, and checks for overlapping locked periods.</p>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
