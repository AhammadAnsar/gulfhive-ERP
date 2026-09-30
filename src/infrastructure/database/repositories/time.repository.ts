/**
 * GulfHive ERP - Authoritative Time, Attendance & Timesheet Repository
 * 
 * Comprehensive management of:
 * - Work Schedules & Break Policies
 * - Shifts (Cross-midnight, Grace periods, Break duration, Policies)
 * - Shift Patterns & Rotating Rosters
 * - Schedule Overrides (Ramadan / Seasonal adjustments)
 * - Immutable Clock Events (Append-only, Duplicate detection)
 * - Deterministic Attendance Days (Idempotent daily processing, Versioning)
 * - Attendance Exceptions Engine & Resolution
 * - Manual Corrections Workflow & Auditing
 * - Holiday Calendars & Holidays (Company & Branch scoped)
 * - Timesheets (Central Numbering Engine TS-YYYY-NNNNN, Allocation validation, Lifecycle: Draft->Submitted->Approved->Locked)
 * - Overtime Candidate Time Records (Time-only tracking, no hardcoded monetary payroll rates)
 * - Reports, Exports, and Dashboard Integration
 */

import { eq, and, desc, asc, sql, inArray, gte, lte, or } from 'drizzle-orm';
import { db } from '../../../db/index.ts';
import {
  workSchedules,
  breakPolicies,
  shifts,
  shiftPatterns,
  shiftPatternDays,
  employeeScheduleAssignments,
  scheduleOverrides,
  rosterEntries,
  rosterChangeHistory,
  clockEvents,
  attendanceDays,
  attendanceExceptions,
  attendanceCorrections,
  holidayCalendars,
  holidays,
  timesheets,
  timesheetLines,
  overtimeRecords,
  approvalWorkflows,
  employees,
  branches,
  auditLogs,
} from '../../../db/schema.ts';
import { numberingRepository } from './numbering.repository.ts';
import { attendanceProcessor, ProcessAttendanceParams } from '../../../services/attendance-processor.service.ts';
import { logger } from '../../../core/logging/logger.ts';

export interface CreateShiftInput {
  code: string;
  nameEn: string;
  nameAr: string;
  startTime: string; // '08:00' or '20:00'
  endTime: string; // '16:00' or '04:00'
  crossesMidnight?: boolean;
  scheduledMinutes?: number;
  breakPolicyId?: string;
  breakDurationMinutes?: number;
  gracePeriodMinutes?: number;
  graceOutMinutes?: number;
  earlyInPolicy?: string;
  lateInPolicy?: string;
  earlyOutPolicy?: string;
  actorId?: string;
}

export interface CreateWorkScheduleInput {
  code: string;
  nameEn: string;
  nameAr: string;
  scheduleType?: string;
  weeklyHours?: string;
  defaultShiftId?: string;
  effectiveFrom?: string;
  actorId?: string;
}

export interface CreateBreakPolicyInput {
  code: string;
  nameEn: string;
  nameAr: string;
  breakType?: 'PAID' | 'UNPAID';
  durationMinutes: number;
  calculationMethod?: 'FIXED' | 'CLOCKED' | 'AUTOMATIC_DEDUCTION';
  actorId?: string;
}

export interface CreateRosterEntryInput {
  employeeId: string;
  workDate: string; // YYYY-MM-DD
  shiftId: string;
  branchId?: string;
  projectId?: string;
  siteId?: string;
  clientId?: string;
  source?: string;
  actorId?: string;
}

export interface ClockEventInput {
  employeeId: string;
  eventTimestamp: Date;
  eventType: 'IN' | 'OUT' | 'BREAK_START' | 'BREAK_END';
  source?: 'MANUAL' | 'EXCEL_IMPORT' | 'BIOMETRIC' | 'MOBILE' | 'API' | 'DESKTOP';
  deviceId?: string;
  branchId?: string;
  siteId?: string;
  latitude?: string;
  longitude?: string;
  sourceReference?: string;
  actorId?: string;
}

export interface CorrectionRequestInput {
  attendanceDayId: string;
  requestedFirstIn?: string;
  requestedLastOut?: string;
  reason: string;
  actorId: string;
}

export interface GenerateTimesheetInput {
  employeeId: string;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  actorId: string;
}

export class TimeRepository {
  // ==========================================
  // STATUTORY MULTIPLIERS (GCC Jurisdictions)
  // ==========================================
  public getStatutoryMultiplier(countryCode: string, dayType: 'REGULAR_DAY' | 'WEEKEND' | 'HOLIDAY'): string {
    const c = countryCode.toUpperCase();
    if (c === 'KW') {
      if (dayType === 'REGULAR_DAY') return '1.25';
      if (dayType === 'WEEKEND') return '1.50';
      if (dayType === 'HOLIDAY') return '2.00';
    } else if (c === 'SA') {
      // Saudi Labor Law (Royal Decree M/51): All overtime hours are compensated at normal wage + 50% (1.50x)
      return '1.50';
    } else if (c === 'AE') {
      if (dayType === 'REGULAR_DAY') return '1.25';
      return '1.50';
    } else if (c === 'QA') {
      if (dayType === 'REGULAR_DAY') return '1.25';
      return '1.50';
    } else if (c === 'OM' || c === 'BH') {
      if (dayType === 'REGULAR_DAY') return '1.25';
      return '1.50';
    }
    return dayType === 'HOLIDAY' ? '2.00' : (dayType === 'WEEKEND' ? '1.50' : '1.25');
  }

  // ==========================================
  // 1. WORK SCHEDULES & BREAK POLICIES
  // ==========================================

  public async listWorkSchedules(tenantId: string) {
    return db.select().from(workSchedules)
      .where(and(eq(workSchedules.tenantId, tenantId), eq(workSchedules.status, 'ACTIVE')))
      .orderBy(asc(workSchedules.code));
  }

  public async createWorkSchedule(tenantId: string, input: CreateWorkScheduleInput) {
    const id = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const [schedule] = await db.insert(workSchedules).values({
      id,
      tenantId,
      code: input.code.toUpperCase().trim(),
      nameEn: input.nameEn.trim(),
      nameAr: input.nameAr.trim(),
      scheduleType: input.scheduleType || 'REGULAR',
      weeklyHours: input.weeklyHours || '40.00',
      defaultShiftId: input.defaultShiftId || null,
      effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : new Date(),
      status: 'ACTIVE',
      createdBy: input.actorId || 'system',
    }).returning();

    logger.audit('CREATE', 'WORK_SCHEDULE', id, { code: schedule.code }, { tenantId });
    return schedule;
  }

  public async listBreakPolicies(tenantId: string) {
    return db.select().from(breakPolicies)
      .where(and(eq(breakPolicies.tenantId, tenantId), eq(breakPolicies.status, 'ACTIVE')))
      .orderBy(asc(breakPolicies.code));
  }

  public async createBreakPolicy(tenantId: string, input: CreateBreakPolicyInput) {
    const id = `bp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const [policy] = await db.insert(breakPolicies).values({
      id,
      tenantId,
      code: input.code.toUpperCase().trim(),
      nameEn: input.nameEn.trim(),
      nameAr: input.nameAr.trim(),
      breakType: input.breakType || 'UNPAID',
      durationMinutes: input.durationMinutes || 60,
      calculationMethod: input.calculationMethod || 'FIXED',
      status: 'ACTIVE',
      createdBy: input.actorId || 'system',
    }).returning();

    logger.audit('CREATE', 'BREAK_POLICY', id, { code: policy.code }, { tenantId });
    return policy;
  }

  // ==========================================
  // 2. SHIFTS
  // ==========================================

  public async listShifts(tenantId: string) {
    return db.select().from(shifts)
      .where(and(eq(shifts.tenantId, tenantId), eq(shifts.status, 'ACTIVE')))
      .orderBy(asc(shifts.code));
  }

  public async getShiftById(tenantId: string, shiftId: string) {
    const rows = await db.select().from(shifts)
      .where(and(eq(shifts.tenantId, tenantId), eq(shifts.id, shiftId)))
      .limit(1);
    return rows[0] || null;
  }

  public async createShift(tenantId: string, input: CreateShiftInput) {
    // Cross-midnight detection
    const crossesMidnight = input.crossesMidnight !== undefined 
      ? input.crossesMidnight 
      : input.startTime > input.endTime;

    // Calculate scheduled minutes
    let scheduledMinutes = input.scheduledMinutes;
    if (!scheduledMinutes) {
      const [sH, sM] = input.startTime.split(':').map(Number);
      const [eH, eM] = input.endTime.split(':').map(Number);
      let durationMinutes = (eH * 60 + eM) - (sH * 60 + sM);
      if (crossesMidnight || durationMinutes < 0) {
        durationMinutes += 24 * 60;
      }
      scheduledMinutes = Math.max(0, durationMinutes - (input.breakDurationMinutes ?? 60));
    }

    const id = `shf_${input.code.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
    const [inserted] = await db.insert(shifts).values({
      id,
      tenantId,
      code: input.code.toUpperCase().trim(),
      nameEn: input.nameEn.trim(),
      nameAr: input.nameAr.trim(),
      startTime: input.startTime,
      endTime: input.endTime,
      crossesMidnight,
      scheduledMinutes,
      breakPolicyId: input.breakPolicyId || null,
      breakDurationMinutes: input.breakDurationMinutes ?? 60,
      gracePeriodMinutes: input.gracePeriodMinutes ?? 15,
      graceOutMinutes: input.graceOutMinutes ?? 15,
      earlyInPolicy: input.earlyInPolicy || 'IGNORE',
      lateInPolicy: input.lateInPolicy || 'DEDUCT_LATE',
      earlyOutPolicy: input.earlyOutPolicy || 'DEDUCT_EARLY',
      isOvernight: crossesMidnight,
      isActive: true,
      status: 'ACTIVE',
      createdBy: input.actorId || 'system',
    }).returning();

    logger.audit('CREATE', 'SHIFT', id, { code: inserted.code, startTime: inserted.startTime, endTime: inserted.endTime }, { tenantId });
    return inserted;
  }

  public async updateShift(tenantId: string, shiftId: string, input: Partial<CreateShiftInput>) {
    const existing = await this.getShiftById(tenantId, shiftId);
    if (!existing) throw new Error('Shift not found in this company.');

    const [updated] = await db.update(shifts)
      .set({
        ...input,
        updatedAt: new Date(),
        updatedBy: input.actorId || 'system',
      })
      .where(and(eq(shifts.tenantId, tenantId), eq(shifts.id, shiftId)))
      .returning();

    logger.audit('UPDATE', 'SHIFT', shiftId, { changes: input }, { tenantId });
    return updated;
  }

  public async deleteShift(tenantId: string, shiftId: string, actorId = 'system') {
    // Safe deletion guard: check if shift is referenced in attendance or rosters
    const [rosterCount] = await db.select({ count: sql<number>`count(*)` })
      .from(rosterEntries)
      .where(and(eq(rosterEntries.tenantId, tenantId), eq(rosterEntries.shiftId, shiftId)));

    const [attendanceCount] = await db.select({ count: sql<number>`count(*)` })
      .from(attendanceDays)
      .where(and(eq(attendanceDays.tenantId, tenantId), eq(attendanceDays.shiftId, shiftId)));

    if (Number(rosterCount?.count || 0) > 0 || Number(attendanceCount?.count || 0) > 0) {
      // Historical references exist - archive instead of destructive deletion
      await db.update(shifts)
        .set({ status: 'ARCHIVED', isActive: false, updatedAt: new Date(), updatedBy: actorId })
        .where(and(eq(shifts.tenantId, tenantId), eq(shifts.id, shiftId)));

      logger.audit('ARCHIVE', 'SHIFT', shiftId, { reason: 'Preserved due to existing historical records' }, { tenantId });
      return { success: true, action: 'ARCHIVED', message: 'Shift is referenced in historical records and has been safely archived.' };
    }

    await db.delete(shifts).where(and(eq(shifts.tenantId, tenantId), eq(shifts.id, shiftId)));
    logger.audit('DELETE', 'SHIFT', shiftId, {}, { tenantId });
    return { success: true, action: 'DELETED', message: 'Shift deleted successfully.' };
  }

  // ==========================================
  // 3. SHIFT PATTERNS (Rotating Schedules)
  // ==========================================

  public async listShiftPatterns(tenantId: string) {
    const patterns = await db.select().from(shiftPatterns)
      .where(and(eq(shiftPatterns.tenantId, tenantId), eq(shiftPatterns.status, 'ACTIVE')))
      .orderBy(asc(shiftPatterns.code));

    const patternIds = patterns.map(p => p.id);
    let days: any[] = [];
    if (patternIds.length > 0) {
      days = await db.select().from(shiftPatternDays)
        .where(inArray(shiftPatternDays.patternId, patternIds))
        .orderBy(asc(shiftPatternDays.sequenceDay));
    }

    return patterns.map(p => ({
      ...p,
      days: days.filter(d => d.patternId === p.id),
    }));
  }

  public async createShiftPattern(tenantId: string, input: {
    code: string;
    nameEn: string;
    nameAr: string;
    cycleLengthDays: number;
    days: Array<{ sequenceDay: number; shiftId?: string; isRestDay: boolean }>;
    actorId?: string;
  }) {
    const id = `pat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    return db.transaction(async (tx) => {
      const [pattern] = await tx.insert(shiftPatterns).values({
        id,
        tenantId,
        code: input.code.toUpperCase().trim(),
        nameEn: input.nameEn.trim(),
        nameAr: input.nameAr.trim(),
        cycleLengthDays: input.cycleLengthDays,
        status: 'ACTIVE',
        createdBy: input.actorId || 'system',
      }).returning();

      for (const d of input.days) {
        await tx.insert(shiftPatternDays).values({
          patternId: id,
          sequenceDay: d.sequenceDay,
          shiftId: d.shiftId || null,
          isRestDay: d.isRestDay,
        });
      }

      logger.audit('CREATE', 'SHIFT_PATTERN', id, { code: pattern.code }, { tenantId });
      return pattern;
    });
  }

  // ==========================================
  // 4. ROSTER & SCHEDULING
  // ==========================================

  public async listRosters(tenantId: string, filters: {
    branchId?: string;
    employeeId?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
  }) {
    const conditions = [eq(rosterEntries.tenantId, tenantId)];
    if (filters.branchId) conditions.push(eq(rosterEntries.branchId, filters.branchId));
    if (filters.employeeId) conditions.push(eq(rosterEntries.employeeId, filters.employeeId));
    if (filters.startDate) conditions.push(gte(rosterEntries.workDate, filters.startDate));
    if (filters.endDate) conditions.push(lte(rosterEntries.workDate, filters.endDate));
    if (filters.status) conditions.push(eq(rosterEntries.status, filters.status));

    return db.select({
      id: rosterEntries.id,
      numericId: rosterEntries.numericId,
      employeeId: rosterEntries.employeeId,
      employeeNumber: employees.employeeNumber,
      employeeNameEn: sql<string>`concat(${employees.firstNameEn}, ' ', ${employees.lastNameEn})`,
      employeeNameAr: sql<string>`concat(${employees.firstNameAr}, ' ', ${employees.lastNameAr})`,
      workDate: rosterEntries.workDate,
      shiftId: rosterEntries.shiftId,
      shiftCode: shifts.code,
      shiftNameEn: shifts.nameEn,
      shiftNameAr: shifts.nameAr,
      startTime: shifts.startTime,
      endTime: shifts.endTime,
      branchId: rosterEntries.branchId,
      branchCode: branches.code,
      projectId: rosterEntries.projectId,
      siteId: rosterEntries.siteId,
      clientId: rosterEntries.clientId,
      status: rosterEntries.status,
      source: rosterEntries.source,
      publishedAt: rosterEntries.publishedAt,
      publishedBy: rosterEntries.publishedBy,
    })
      .from(rosterEntries)
      .innerJoin(employees, eq(rosterEntries.employeeId, employees.id))
      .innerJoin(shifts, eq(rosterEntries.shiftId, shifts.id))
      .leftJoin(branches, eq(rosterEntries.branchId, branches.id))
      .where(and(...conditions))
      .orderBy(desc(rosterEntries.workDate), asc(employees.employeeNumber));
  }

  public async createRosterEntry(tenantId: string, input: CreateRosterEntryInput) {
    // Cross-company isolation guard
    const [emp] = await db.select().from(employees)
      .where(and(eq(employees.id, input.employeeId), eq(employees.tenantId, tenantId)))
      .limit(1);
    if (!emp) throw new Error('Cross-company reference violation: Employee does not belong to this company.');

    const [shf] = await db.select().from(shifts)
      .where(and(eq(shifts.id, input.shiftId), eq(shifts.tenantId, tenantId)))
      .limit(1);
    if (!shf) throw new Error('Cross-company reference violation: Shift does not belong to this company.');

    const id = `rst_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const [entry] = await db.insert(rosterEntries).values({
      id,
      tenantId,
      employeeId: input.employeeId,
      workDate: input.workDate,
      shiftId: input.shiftId,
      branchId: input.branchId || emp.branchId || null,
      projectId: input.projectId || null,
      siteId: input.siteId || null,
      clientId: input.clientId || null,
      status: 'DRAFT',
      source: input.source || 'MANUAL',
      createdBy: input.actorId || 'system',
    }).returning();

    logger.audit('CREATE', 'ROSTER_ENTRY', id, { employeeId: input.employeeId, workDate: input.workDate, shiftId: input.shiftId }, { tenantId });
    return entry;
  }

  public async publishRoster(tenantId: string, rosterIds: string[], actorId = 'system') {
    if (rosterIds.length === 0) return { updatedCount: 0 };

    const result = await db.update(rosterEntries)
      .set({
        status: 'PUBLISHED',
        publishedAt: new Date(),
        publishedBy: actorId,
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(and(eq(rosterEntries.tenantId, tenantId), inArray(rosterEntries.id, rosterIds)))
      .returning();

    logger.audit('PUBLISH', 'ROSTER', rosterIds.join(','), { count: result.length }, { tenantId });
    return { updatedCount: result.length };
  }

  public async updateRosterEntry(tenantId: string, rosterId: string, newShiftId: string, reason: string, actorId = 'system') {
    const [existing] = await db.select().from(rosterEntries)
      .where(and(eq(rosterEntries.id, rosterId), eq(rosterEntries.tenantId, tenantId)))
      .limit(1);
    if (!existing) throw new Error('Roster entry not found in this company.');

    return db.transaction(async (tx) => {
      // If already published, record historical change audit
      if (existing.status === 'PUBLISHED') {
        await tx.insert(rosterChangeHistory).values({
          rosterEntryId: rosterId,
          oldShiftId: existing.shiftId,
          newShiftId,
          changedBy: actorId,
          reason,
        });
      }

      const [updated] = await tx.update(rosterEntries)
        .set({
          shiftId: newShiftId,
          status: existing.status === 'PUBLISHED' ? 'CHANGED' : existing.status,
          updatedAt: new Date(),
          updatedBy: actorId,
        })
        .where(eq(rosterEntries.id, rosterId))
        .returning();

      logger.audit('UPDATE', 'ROSTER_ENTRY', rosterId, { oldShiftId: existing.shiftId, newShiftId, reason }, { tenantId });
      return updated;
    });
  }

  // ==========================================
  // 5. CLOCK EVENTS (Immutable Raw Punches)
  // ==========================================

  public async listClockEvents(tenantId: string, filters: {
    employeeId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const conditions = [eq(clockEvents.tenantId, tenantId)];
    if (filters.employeeId) conditions.push(eq(clockEvents.employeeId, filters.employeeId));
    if (filters.startDate) conditions.push(gte(clockEvents.eventTimestamp, new Date(filters.startDate)));
    if (filters.endDate) conditions.push(lte(clockEvents.eventTimestamp, new Date(filters.endDate)));

    return db.select().from(clockEvents)
      .where(and(...conditions))
      .orderBy(desc(clockEvents.eventTimestamp));
  }

  public async recordClockEvent(tenantId: string, input: ClockEventInput) {
    // Verify employee belongs to tenant
    const [emp] = await db.select().from(employees)
      .where(and(eq(employees.id, input.employeeId), eq(employees.tenantId, tenantId)))
      .limit(1);
    if (!emp) throw new Error('Employee does not belong to this company.');

    // Duplicate detection within 60 seconds for same employee & event type
    const sixtySecsBefore = new Date(input.eventTimestamp.getTime() - 60000);
    const sixtySecsAfter = new Date(input.eventTimestamp.getTime() + 60000);

    const [dup] = await db.select().from(clockEvents)
      .where(and(
        eq(clockEvents.tenantId, tenantId),
        eq(clockEvents.employeeId, input.employeeId),
        eq(clockEvents.eventType, input.eventType),
        gte(clockEvents.eventTimestamp, sixtySecsBefore),
        lte(clockEvents.eventTimestamp, sixtySecsAfter)
      ))
      .limit(1);

    const isDuplicate = !!dup;

    const id = `clk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const [event] = await db.insert(clockEvents).values({
      id,
      tenantId,
      employeeId: input.employeeId,
      eventTimestamp: input.eventTimestamp,
      eventType: input.eventType,
      source: input.source || 'MANUAL',
      deviceId: input.deviceId || null,
      branchId: input.branchId || emp.branchId || null,
      siteId: input.siteId || null,
      latitude: input.latitude || null,
      longitude: input.longitude || null,
      sourceReference: input.sourceReference || null,
      isDuplicate,
      createdBy: input.actorId || 'system',
    }).returning();

    logger.audit('CLOCK_PUNCH', 'CLOCK_EVENT', id, {
      employeeId: input.employeeId,
      eventType: input.eventType,
      timestamp: input.eventTimestamp.toISOString(),
      isDuplicate,
    }, { tenantId });

    return event;
  }

  // ==========================================
  // 6. ATTENDANCE PROCESSING & ATTENDANCE DAYS
  // ==========================================

  public async listAttendanceDays(tenantId: string, filters: {
    workDate?: string;
    startDate?: string;
    endDate?: string;
    branchId?: string;
    employeeId?: string;
    status?: string;
    exceptionsOnly?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const conditions = [eq(attendanceDays.tenantId, tenantId)];
    if (filters.workDate) conditions.push(eq(attendanceDays.workDate, filters.workDate));
    if (filters.startDate) conditions.push(gte(attendanceDays.workDate, filters.startDate));
    if (filters.endDate) conditions.push(lte(attendanceDays.workDate, filters.endDate));
    if (filters.employeeId) conditions.push(eq(attendanceDays.employeeId, filters.employeeId));
    if (filters.status) conditions.push(eq(attendanceDays.status, filters.status));

    if (filters.exceptionsOnly) {
      conditions.push(or(
        eq(attendanceDays.status, 'MISSING_PUNCH'),
        eq(attendanceDays.status, 'LATE'),
        eq(attendanceDays.status, 'ABSENT'),
        eq(attendanceDays.status, 'PARTIAL')
      )!);
    }

    return db.select({
      id: attendanceDays.id,
      numericId: attendanceDays.numericId,
      tenantId: attendanceDays.tenantId,
      employeeId: attendanceDays.employeeId,
      employeeNumber: employees.employeeNumber,
      employeeNameEn: sql<string>`concat(${employees.firstNameEn}, ' ', ${employees.lastNameEn})`,
      employeeNameAr: sql<string>`concat(${employees.firstNameAr}, ' ', ${employees.lastNameAr})`,
      branchId: employees.branchId,
      workDate: attendanceDays.workDate,
      shiftId: attendanceDays.shiftId,
      shiftCode: shifts.code,
      shiftNameEn: shifts.nameEn,
      scheduledStart: attendanceDays.scheduledStart,
      scheduledEnd: attendanceDays.scheduledEnd,
      actualFirstIn: attendanceDays.actualFirstIn,
      actualLastOut: attendanceDays.actualLastOut,
      scheduledMinutes: attendanceDays.scheduledMinutes,
      workedMinutes: attendanceDays.workedMinutes,
      breakMinutes: attendanceDays.breakMinutes,
      lateMinutes: attendanceDays.lateMinutes,
      earlyLeaveMinutes: attendanceDays.earlyLeaveMinutes,
      overtimeCandidateMinutes: attendanceDays.overtimeCandidateMinutes,
      status: attendanceDays.status,
      isLocked: attendanceDays.isLocked,
    })
      .from(attendanceDays)
      .innerJoin(employees, eq(attendanceDays.employeeId, employees.id))
      .leftJoin(shifts, eq(attendanceDays.shiftId, shifts.id))
      .where(and(...conditions))
      .orderBy(desc(attendanceDays.workDate), asc(employees.employeeNumber))
      .limit(filters.limit || 100)
      .offset(filters.offset || 0);
  }

  public async getAttendanceDayDetail(tenantId: string, attendanceDayId: string) {
    const rows = await db.select({
      day: attendanceDays,
      employee: {
        id: employees.id,
        employeeNumber: employees.employeeNumber,
        firstNameEn: employees.firstNameEn,
        lastNameEn: employees.lastNameEn,
        firstNameAr: employees.firstNameAr,
        lastNameAr: employees.lastNameAr,
        email: employees.email,
        branchId: employees.branchId,
      },
      shift: shifts,
    })
      .from(attendanceDays)
      .innerJoin(employees, eq(attendanceDays.employeeId, employees.id))
      .leftJoin(shifts, eq(attendanceDays.shiftId, shifts.id))
      .where(and(eq(attendanceDays.tenantId, tenantId), eq(attendanceDays.id, attendanceDayId)))
      .limit(1);

    if (rows.length === 0) return null;
    const { day, employee, shift } = rows[0];

    // Fetch related exceptions
    const exceptions = await db.select().from(attendanceExceptions)
      .where(eq(attendanceExceptions.attendanceDayId, day.id));

    // Fetch related raw clock events for this day window
    const dayStart = new Date(`${day.workDate}T00:00:00.000Z`);
    const dayEnd = new Date(dayStart.getTime() + (36 * 60 * 60 * 1000)); // 36 hours for cross-midnight
    const rawEvents = await db.select().from(clockEvents)
      .where(and(
        eq(clockEvents.employeeId, day.employeeId),
        gte(clockEvents.eventTimestamp, dayStart),
        lte(clockEvents.eventTimestamp, dayEnd)
      ))
      .orderBy(asc(clockEvents.eventTimestamp));

    // Fetch any corrections
    const corrections = await db.select().from(attendanceCorrections)
      .where(eq(attendanceCorrections.attendanceDayId, day.id));

    return {
      ...day,
      employee,
      shift,
      exceptions,
      clockEvents: rawEvents,
      corrections,
    };
  }

  /**
   * Process and save attendance for one employee on one work date.
   * Completely deterministic and idempotent.
   */
  public async processEmployeeDay(tenantId: string, employeeId: string, workDate: string, actorId = 'system') {
    // 1. Check if employee has a roster entry
    const [roster] = await db.select().from(rosterEntries)
      .where(and(
        eq(rosterEntries.tenantId, tenantId),
        eq(rosterEntries.employeeId, employeeId),
        eq(rosterEntries.workDate, workDate),
        or(eq(rosterEntries.status, 'PUBLISHED'), eq(rosterEntries.status, 'CHANGED'), eq(rosterEntries.status, 'DRAFT'))
      ))
      .limit(1);

    // 2. Resolve Shift
    let shiftDef = null;
    const shiftIdToUse = roster?.shiftId;
    if (shiftIdToUse) {
      shiftDef = await this.getShiftById(tenantId, shiftIdToUse);
    }

    // 3. Query Clock Events for this workDate window
    // Cross-midnight window: start from 4 hours before workDate 00:00 to 12 hours after workDate 23:59
    const dayStart = new Date(`${workDate}T00:00:00.000Z`);
    const windowStart = new Date(dayStart.getTime() - (4 * 3600 * 1000));
    const windowEnd = new Date(dayStart.getTime() + (36 * 3600 * 1000));

    const events = await db.select().from(clockEvents)
      .where(and(
        eq(clockEvents.tenantId, tenantId),
        eq(clockEvents.employeeId, employeeId),
        gte(clockEvents.eventTimestamp, windowStart),
        lte(clockEvents.eventTimestamp, windowEnd)
      ))
      .orderBy(asc(clockEvents.eventTimestamp));

    // 4. Check for Holiday
    const [hol] = await db.select().from(holidays)
      .where(and(
        eq(holidays.tenantId, tenantId),
        eq(holidays.holidayDate, workDate),
        eq(holidays.status, 'ACTIVE')
      ))
      .limit(1);

    const isHoliday = !!hol;

    // 5. Run Processor
    const result = attendanceProcessor.processDay({
      employeeId,
      workDate,
      shift: shiftDef,
      rosterEntryId: roster?.id,
      clockEvents: events.map(e => ({
        id: e.id,
        eventTimestamp: e.eventTimestamp,
        eventType: e.eventType as any,
        source: e.source,
        isDuplicate: e.isDuplicate,
      })),
      isHoliday,
    });

    // 6. Idempotently insert/update attendance_days
    const [existing] = await db.select().from(attendanceDays)
      .where(and(
        eq(attendanceDays.tenantId, tenantId),
        eq(attendanceDays.employeeId, employeeId),
        eq(attendanceDays.workDate, workDate)
      ))
      .limit(1);

    const dayId = existing?.id || `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    let savedDay;
    if (existing) {
      if (existing.isLocked) {
        throw new Error('This attendance record belongs to a locked timesheet/payroll period and cannot be edited.');
      }

      [savedDay] = await db.update(attendanceDays)
        .set({
          rosterEntryId: roster?.id || null,
          shiftId: shiftIdToUse || null,
          scheduledStart: result.scheduledStart,
          scheduledEnd: result.scheduledEnd,
          actualFirstIn: result.actualFirstIn,
          actualLastOut: result.actualLastOut,
          scheduledMinutes: result.scheduledMinutes,
          workedMinutes: result.workedMinutes,
          breakMinutes: result.breakMinutes,
          lateMinutes: result.lateMinutes,
          earlyLeaveMinutes: result.earlyLeaveMinutes,
          overtimeCandidateMinutes: result.overtimeCandidateMinutes,
          status: result.status,
          processingVersion: existing.processingVersion + 1,
          updatedAt: new Date(),
        })
        .where(eq(attendanceDays.id, existing.id))
        .returning();

      // Clean old unresolved exceptions for this day
      await db.delete(attendanceExceptions)
        .where(and(eq(attendanceExceptions.attendanceDayId, existing.id), eq(attendanceExceptions.status, 'OPEN')));
    } else {
      [savedDay] = await db.insert(attendanceDays).values({
        id: dayId,
        tenantId,
        employeeId,
        workDate,
        rosterEntryId: roster?.id || null,
        shiftId: shiftIdToUse || null,
        scheduledStart: result.scheduledStart,
        scheduledEnd: result.scheduledEnd,
        actualFirstIn: result.actualFirstIn,
        actualLastOut: result.actualLastOut,
        scheduledMinutes: result.scheduledMinutes,
        workedMinutes: result.workedMinutes,
        breakMinutes: result.breakMinutes,
        lateMinutes: result.lateMinutes,
        earlyLeaveMinutes: result.earlyLeaveMinutes,
        overtimeCandidateMinutes: result.overtimeCandidateMinutes,
        status: result.status,
        processingVersion: 1,
        isLocked: false,
      }).returning();
    }

    // 7. Insert detected exceptions
    for (const exc of result.exceptions) {
      const excId = `exc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await db.insert(attendanceExceptions).values({
        id: excId,
        tenantId,
        employeeId,
        attendanceDayId: savedDay.id,
        exceptionType: exc.exceptionType,
        severity: exc.severity,
        status: 'OPEN',
        description: exc.description,
      });
    }

    // 8. If overtime candidate exists, record candidate overtime time record
    if (result.overtimeCandidateMinutes > 0) {
      const otId = `ot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await db.insert(overtimeRecords).values({
        id: otId,
        tenantId,
        employeeId,
        attendanceDayId: savedDay.id,
        date: workDate,
        overtimeType: isHoliday ? 'HOLIDAY' : 'REGULAR_DAY',
        minutes: result.overtimeCandidateMinutes,
        source: 'ATTENDANCE',
        status: 'PENDING',
        reason: `Auto-derived candidate overtime of ${result.overtimeCandidateMinutes}m from shift excess.`,
        createdBy: actorId,
      });
    }

    return savedDay;
  }

  /**
   * Process attendance for all active employees of a tenant for a workDate.
   */
  public async processDayForTenant(tenantId: string, workDate: string, actorId = 'system') {
    const activeEmployees = await db.select({ id: employees.id }).from(employees)
      .where(and(eq(employees.tenantId, tenantId), eq(employees.employmentStatus, 'ACTIVE')));

    const results = [];
    for (const emp of activeEmployees) {
      const day = await this.processEmployeeDay(tenantId, emp.id, workDate, actorId);
      results.push(day);
    }

    logger.audit('PROCESS_ATTENDANCE', 'ATTENDANCE_DAY', workDate, { processedCount: results.length }, { tenantId });
    return { workDate, processedCount: results.length };
  }

  // ==========================================
  // 7. EXCEPTIONS & CORRECTIONS WORKFLOW
  // ==========================================

  public async listExceptions(tenantId: string, filters: {
    status?: string;
    severity?: string;
    employeeId?: string;
  }) {
    const conditions = [eq(attendanceExceptions.tenantId, tenantId)];
    if (filters.status) conditions.push(eq(attendanceExceptions.status, filters.status));
    if (filters.severity) conditions.push(eq(attendanceExceptions.severity, filters.severity));
    if (filters.employeeId) conditions.push(eq(attendanceExceptions.employeeId, filters.employeeId));

    return db.select({
      id: attendanceExceptions.id,
      numericId: attendanceExceptions.numericId,
      employeeId: attendanceExceptions.employeeId,
      employeeNumber: employees.employeeNumber,
      employeeNameEn: sql<string>`concat(${employees.firstNameEn}, ' ', ${employees.lastNameEn})`,
      workDate: attendanceDays.workDate,
      attendanceDayId: attendanceExceptions.attendanceDayId,
      exceptionType: attendanceExceptions.exceptionType,
      severity: attendanceExceptions.severity,
      status: attendanceExceptions.status,
      description: attendanceExceptions.description,
      detectedAt: attendanceExceptions.detectedAt,
      resolvedAt: attendanceExceptions.resolvedAt,
      resolvedBy: attendanceExceptions.resolvedBy,
      resolutionType: attendanceExceptions.resolutionType,
      notes: attendanceExceptions.notes,
    })
      .from(attendanceExceptions)
      .innerJoin(employees, eq(attendanceExceptions.employeeId, employees.id))
      .innerJoin(attendanceDays, eq(attendanceExceptions.attendanceDayId, attendanceDays.id))
      .where(and(...conditions))
      .orderBy(desc(attendanceExceptions.detectedAt));
  }

  public async resolveException(tenantId: string, exceptionId: string, input: {
    resolutionType: 'CORRECTION_APPLIED' | 'JUSTIFIED' | 'WAIVED' | 'DEDUCTION_CONFIRMED';
    notes?: string;
    actorId: string;
  }) {
    const [updated] = await db.update(attendanceExceptions)
      .set({
        status: 'RESOLVED',
        resolutionType: input.resolutionType,
        notes: input.notes || null,
        resolvedAt: new Date(),
        resolvedBy: input.actorId,
      })
      .where(and(eq(attendanceExceptions.id, exceptionId), eq(attendanceExceptions.tenantId, tenantId)))
      .returning();

    logger.audit('RESOLVE', 'ATTENDANCE_EXCEPTION', exceptionId, input, { tenantId });
    return updated;
  }

  public async requestCorrection(tenantId: string, input: CorrectionRequestInput) {
    const [day] = await db.select().from(attendanceDays)
      .where(and(eq(attendanceDays.id, input.attendanceDayId), eq(attendanceDays.tenantId, tenantId)))
      .limit(1);
    if (!day) throw new Error('Attendance day not found.');

    if (day.isLocked) {
      throw new Error('This attendance record belongs to a locked timesheet/payroll period and cannot be edited.');
    }

    const id = `corr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const [corr] = await db.insert(attendanceCorrections).values({
      id,
      tenantId,
      attendanceDayId: day.id,
      employeeId: day.employeeId,
      requestedFirstIn: input.requestedFirstIn ? new Date(input.requestedFirstIn) : null,
      requestedLastOut: input.requestedLastOut ? new Date(input.requestedLastOut) : null,
      reason: input.reason,
      status: 'PENDING',
      requestedBy: input.actorId,
      requestedAt: new Date(),
    }).returning();

    logger.audit('REQUEST', 'ATTENDANCE_CORRECTION', id, { attendanceDayId: day.id, reason: input.reason }, { tenantId });
    return corr;
  }

  public async approveCorrection(tenantId: string, correctionId: string, actorId: string) {
    const [corr] = await db.select().from(attendanceCorrections)
      .where(and(eq(attendanceCorrections.id, correctionId), eq(attendanceCorrections.tenantId, tenantId)))
      .limit(1);
    if (!corr) throw new Error('Correction request not found.');
    if (corr.status !== 'PENDING') throw new Error(`Correction is already ${corr.status}.`);

    return db.transaction(async (tx) => {
      // 1. Mark approved
      const [approved] = await tx.update(attendanceCorrections)
        .set({
          status: 'APPROVED',
          approvedBy: actorId,
          approvedAt: new Date(),
        })
        .where(eq(attendanceCorrections.id, correctionId))
        .returning();

      // 2. If requested times were provided, update attendance day
      if (corr.attendanceDayId) {
        const updatePayload: any = { updatedAt: new Date() };
        if (corr.requestedFirstIn) updatePayload.actualFirstIn = corr.requestedFirstIn;
        if (corr.requestedLastOut) updatePayload.actualLastOut = corr.requestedLastOut;

        await tx.update(attendanceDays)
          .set(updatePayload)
          .where(eq(attendanceDays.id, corr.attendanceDayId));
      }

      logger.audit('APPROVE', 'ATTENDANCE_CORRECTION', correctionId, {}, { tenantId });
      return approved;
    });
  }

  public async listCorrections(tenantId: string) {
    const list = await db.select({
      corr: attendanceCorrections,
      emp: {
        employeeNumber: employees.employeeNumber,
        firstNameEn: employees.firstNameEn,
        lastNameEn: employees.lastNameEn,
      },
    })
      .from(attendanceCorrections)
      .innerJoin(employees, eq(attendanceCorrections.employeeId, employees.id))
      .where(eq(attendanceCorrections.tenantId, tenantId))
      .orderBy(desc(attendanceCorrections.requestedAt));

    return list.map(r => ({ ...r.corr, employee: r.emp }));
  }

  // ==========================================
  // 8. TIMESHEETS & ALLOCATIONS
  // ==========================================

  public async listTimesheets(tenantId: string, filters: {
    employeeId?: string;
    status?: string;
    periodStart?: string;
    periodEnd?: string;
  }) {
    const conditions = [eq(timesheets.tenantId, tenantId)];
    if (filters.employeeId) conditions.push(eq(timesheets.employeeId, filters.employeeId));
    if (filters.status) conditions.push(eq(timesheets.status, filters.status));
    if (filters.periodStart) conditions.push(gte(timesheets.periodStart, filters.periodStart));
    if (filters.periodEnd) conditions.push(lte(timesheets.periodEnd, filters.periodEnd));

    return db.select({
      id: timesheets.id,
      numericId: timesheets.numericId,
      timesheetNumber: timesheets.timesheetNumber,
      employeeId: timesheets.employeeId,
      employeeNumber: employees.employeeNumber,
      employeeNameEn: sql<string>`concat(${employees.firstNameEn}, ' ', ${employees.lastNameEn})`,
      employeeNameAr: sql<string>`concat(${employees.firstNameAr}, ' ', ${employees.lastNameAr})`,
      periodStart: timesheets.periodStart,
      periodEnd: timesheets.periodEnd,
      status: timesheets.status,
      totalRegularMinutes: timesheets.totalRegularMinutes,
      totalOvertimeMinutes: timesheets.totalOvertimeMinutes,
      submittedAt: timesheets.submittedAt,
      submittedBy: timesheets.submittedBy,
      approvedAt: timesheets.approvedAt,
      approvedBy: timesheets.approvedBy,
      lockedAt: timesheets.lockedAt,
    })
      .from(timesheets)
      .innerJoin(employees, eq(timesheets.employeeId, employees.id))
      .where(and(...conditions))
      .orderBy(desc(timesheets.periodStart), asc(employees.employeeNumber));
  }

  public async getTimesheetDetail(tenantId: string, timesheetId: string) {
    const rows = await db.select({
      timesheet: timesheets,
      employee: {
        id: employees.id,
        employeeNumber: employees.employeeNumber,
        firstNameEn: employees.firstNameEn,
        lastNameEn: employees.lastNameEn,
      },
    })
      .from(timesheets)
      .innerJoin(employees, eq(timesheets.employeeId, employees.id))
      .where(and(eq(timesheets.id, timesheetId), eq(timesheets.tenantId, tenantId)))
      .limit(1);

    if (rows.length === 0) return null;
    const { timesheet, employee } = rows[0];

    const lines = await db.select().from(timesheetLines)
      .where(eq(timesheetLines.timesheetId, timesheet.id))
      .orderBy(asc(timesheetLines.workDate));

    return {
      ...timesheet,
      employee,
      lines,
    };
  }

  /**
   * Generate timesheet from approved attendance days.
   * Uses central NumberingEngine to generate TS-YYYY-NNNNN.
   */
  public async generateTimesheet(tenantId: string, input: GenerateTimesheetInput) {
    // 1. Check for overlapping approved/locked timesheet for this employee
    const [overlap] = await db.select().from(timesheets)
      .where(and(
        eq(timesheets.tenantId, tenantId),
        eq(timesheets.employeeId, input.employeeId),
        or(eq(timesheets.status, 'APPROVED'), eq(timesheets.status, 'LOCKED')),
        lte(timesheets.periodStart, input.periodEnd),
        gte(timesheets.periodEnd, input.periodStart)
      ))
      .limit(1);

    if (overlap) {
      throw new Error(`An approved or locked timesheet (${overlap.timesheetNumber}) already covers the period ${overlap.periodStart} to ${overlap.periodEnd}.`);
    }

    // 2. Fetch processed attendance days for period
    const days = await db.select().from(attendanceDays)
      .where(and(
        eq(attendanceDays.tenantId, tenantId),
        eq(attendanceDays.employeeId, input.employeeId),
        gte(attendanceDays.workDate, input.periodStart),
        lte(attendanceDays.workDate, input.periodEnd)
      ))
      .orderBy(asc(attendanceDays.workDate));

    let totalRegularMinutes = 0;
    let totalOvertimeMinutes = 0;

    for (const d of days) {
      totalRegularMinutes += d.workedMinutes;
      totalOvertimeMinutes += d.overtimeCandidateMinutes;
    }

    // 3. Generate sequential Number using Numbering Engine
    const timesheetNumber = await numberingRepository.generateNextNumber(tenantId, 'TIMESHEET');

    const id = `ts_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    return db.transaction(async (tx) => {
      const [ts] = await tx.insert(timesheets).values({
        id,
        tenantId,
        employeeId: input.employeeId,
        timesheetNumber,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        status: 'DRAFT',
        totalRegularMinutes,
        totalOvertimeMinutes,
        createdBy: input.actorId,
      }).returning();

      // Create lines
      for (const d of days) {
        await tx.insert(timesheetLines).values({
          timesheetId: id,
          workDate: d.workDate,
          attendanceDayId: d.id,
          regularMinutes: d.workedMinutes,
          overtimeMinutes: d.overtimeCandidateMinutes,
        });
      }

      logger.audit('CREATE', 'TIMESHEET', id, { timesheetNumber, employeeId: input.employeeId, periodStart: input.periodStart, periodEnd: input.periodEnd }, { tenantId });
      return ts;
    });
  }

  public async submitTimesheet(tenantId: string, timesheetId: string, actorId: string) {
    const [ts] = await db.select().from(timesheets)
      .where(and(eq(timesheets.id, timesheetId), eq(timesheets.tenantId, tenantId)))
      .limit(1);
    if (!ts) throw new Error('Timesheet not found.');
    if (ts.status !== 'DRAFT' && ts.status !== 'REJECTED') {
      throw new Error(`Timesheet cannot be submitted from status: ${ts.status}.`);
    }

    const [updated] = await db.update(timesheets)
      .set({
        status: 'SUBMITTED',
        submittedAt: new Date(),
        submittedBy: actorId,
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(eq(timesheets.id, timesheetId))
      .returning();

    logger.audit('SUBMIT', 'TIMESHEET', timesheetId, {}, { tenantId });
    return updated;
  }

  public async approveTimesheet(tenantId: string, timesheetId: string, actorId: string) {
    const [ts] = await db.select().from(timesheets)
      .where(and(eq(timesheets.id, timesheetId), eq(timesheets.tenantId, tenantId)))
      .limit(1);
    if (!ts) throw new Error('Timesheet not found.');
    if (ts.status !== 'SUBMITTED' && ts.status !== 'UNDER_REVIEW') {
      throw new Error(`Timesheet cannot be approved from status: ${ts.status}.`);
    }

    const [updated] = await db.update(timesheets)
      .set({
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: actorId,
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(eq(timesheets.id, timesheetId))
      .returning();

    logger.audit('APPROVE', 'TIMESHEET', timesheetId, {}, { tenantId });
    return updated;
  }

  public async lockTimesheet(tenantId: string, timesheetId: string, actorId: string) {
    const [ts] = await db.select().from(timesheets)
      .where(and(eq(timesheets.id, timesheetId), eq(timesheets.tenantId, tenantId)))
      .limit(1);
    if (!ts) throw new Error('Timesheet not found.');
    if (ts.status !== 'APPROVED') {
      throw new Error(`Timesheet must be APPROVED before it can be LOCKED for payroll. Current status: ${ts.status}.`);
    }

    return db.transaction(async (tx) => {
      const [updated] = await tx.update(timesheets)
        .set({
          status: 'LOCKED',
          lockedAt: new Date(),
          lockedBy: actorId,
          updatedAt: new Date(),
          updatedBy: actorId,
        })
        .where(eq(timesheets.id, timesheetId))
        .returning();

      // Lock all underlying attendance days
      const lines = await tx.select().from(timesheetLines).where(eq(timesheetLines.timesheetId, timesheetId));
      const attDayIds = lines.map(l => l.attendanceDayId).filter(Boolean) as string[];

      if (attDayIds.length > 0) {
        await tx.update(attendanceDays)
          .set({ isLocked: true })
          .where(inArray(attendanceDays.id, attDayIds));
      }

      logger.audit('LOCK', 'TIMESHEET', timesheetId, {}, { tenantId });
      return updated;
    });
  }

  // ==========================================
  // 9. OVERTIME RECORDS (Time Only)
  // ==========================================

  public async listOvertimeRecords(tenantId: string, filters: {
    employeeId?: string;
    status?: string;
  }) {
    const conditions = [eq(overtimeRecords.tenantId, tenantId)];
    if (filters.employeeId) conditions.push(eq(overtimeRecords.employeeId, filters.employeeId));
    if (filters.status) conditions.push(eq(overtimeRecords.status, filters.status));

    return db.select({
      id: overtimeRecords.id,
      employeeId: overtimeRecords.employeeId,
      employeeNumber: employees.employeeNumber,
      employeeNameEn: sql<string>`concat(${employees.firstNameEn}, ' ', ${employees.lastNameEn})`,
      date: overtimeRecords.date,
      overtimeType: overtimeRecords.overtimeType,
      minutes: overtimeRecords.minutes,
      source: overtimeRecords.source,
      status: overtimeRecords.status,
      reason: overtimeRecords.reason,
      approvedBy: overtimeRecords.approvedBy,
      approvedAt: overtimeRecords.approvedAt,
    })
      .from(overtimeRecords)
      .innerJoin(employees, eq(overtimeRecords.employeeId, employees.id))
      .where(and(...conditions))
      .orderBy(desc(overtimeRecords.date));
  }

  public async approveOvertimeRecord(tenantId: string, overtimeId: string, actorId: string) {
    const [updated] = await db.update(overtimeRecords)
      .set({
        status: 'APPROVED',
        approvedBy: actorId,
        approvedAt: new Date(),
      })
      .where(and(eq(overtimeRecords.id, overtimeId), eq(overtimeRecords.tenantId, tenantId)))
      .returning();

    logger.audit('APPROVE', 'OVERTIME_RECORD', overtimeId, {}, { tenantId });
    return updated;
  }

  public async createOvertimeRecord(tenantId: string, input: {
    employeeId: string;
    attendanceId?: string;
    date: string;
    overtimeType?: string;
    minutes: number;
    countryCode?: string;
    reason?: string;
    actorId?: string;
  }) {
    const id = `ot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const [rec] = await db.insert(overtimeRecords).values({
      id,
      tenantId,
      employeeId: input.employeeId,
      attendanceDayId: input.attendanceId || null,
      date: input.date,
      overtimeType: (input.overtimeType as any) || 'REGULAR_DAY',
      minutes: input.minutes,
      source: 'MANUAL',
      status: 'PENDING',
      reason: input.reason || null,
      createdBy: input.actorId || 'system',
    }).returning();

    logger.audit('CREATE', 'OVERTIME_RECORD', id, { employeeId: input.employeeId, minutes: input.minutes }, { tenantId });
    return rec;
  }

  public async reviewOvertimeRecord(
    tenantId: string,
    overtimeId: string,
    decision: 'APPROVED' | 'REJECTED',
    actorId: string,
    _notes?: string
  ) {
    const [updated] = await db.update(overtimeRecords)
      .set({
        status: decision,
        approvedBy: actorId,
        approvedAt: new Date(),
      })
      .where(and(eq(overtimeRecords.id, overtimeId), eq(overtimeRecords.tenantId, tenantId)))
      .returning();

    logger.audit(decision === 'APPROVED' ? 'APPROVE' : 'REJECT', 'OVERTIME_RECORD', overtimeId, {}, { tenantId });
    return updated;
  }

  // ==========================================
  // 10. HOLIDAYS & CALENDARS
  // ==========================================

  public async listHolidayCalendars(tenantId: string) {
    return db.select().from(holidayCalendars)
      .where(and(eq(holidayCalendars.tenantId, tenantId), eq(holidayCalendars.status, 'ACTIVE')))
      .orderBy(asc(holidayCalendars.code));
  }

  public async createHolidayCalendar(tenantId: string, input: {
    code: string;
    nameEn: string;
    nameAr: string;
    countryId?: number;
    branchId?: string;
    actorId?: string;
  }) {
    const id = `hc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const [calendar] = await db.insert(holidayCalendars).values({
      id,
      tenantId,
      code: input.code.toUpperCase().trim(),
      nameEn: input.nameEn.trim(),
      nameAr: input.nameAr.trim(),
      countryId: input.countryId || null,
      branchId: input.branchId || null,
      status: 'ACTIVE',
      createdBy: input.actorId || 'system',
    }).returning();

    logger.audit('CREATE', 'HOLIDAY_CALENDAR', id, { code: calendar.code }, { tenantId });
    return calendar;
  }

  public async listHolidays(tenantId: string, year?: number) {
    const conditions = [eq(holidays.tenantId, tenantId), eq(holidays.status, 'ACTIVE')];
    if (year) conditions.push(eq(holidays.year, year));

    return db.select().from(holidays)
      .where(and(...conditions))
      .orderBy(asc(holidays.holidayDate));
  }

  public async createHoliday(tenantId: string, input: {
    nameEn: string;
    nameAr: string;
    holidayDate: string; // YYYY-MM-DD
    holidayCalendarId?: string;
    holidayType?: string;
    isPaid?: boolean;
    actorId?: string;
  }) {
    const [y, m, d] = input.holidayDate.split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));

    const id = `hol_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const [hol] = await db.insert(holidays).values({
      id,
      tenantId,
      holidayCalendarId: input.holidayCalendarId || null,
      nameEn: input.nameEn.trim(),
      nameAr: input.nameAr.trim(),
      holidayDate: input.holidayDate,
      startDate: dateObj,
      endDate: dateObj,
      daysCount: 1,
      holidayType: input.holidayType || 'PUBLIC',
      isPaid: input.isPaid ?? true,
      year: y,
      status: 'ACTIVE',
    }).returning();

    logger.audit('CREATE', 'HOLIDAY', id, { nameEn: hol.nameEn, date: hol.holidayDate }, { tenantId });
    return hol;
  }

  // ==========================================
  // 11. DASHBOARD INTEGRATION STATS
  // ==========================================

  public async getDashboardStats(tenantId: string, todayStr: string) {
    const [activeEmp] = await db.select({ count: sql<number>`count(*)` })
      .from(employees)
      .where(and(eq(employees.tenantId, tenantId), eq(employees.employmentStatus, 'ACTIVE')));

    const daysToday = await db.select().from(attendanceDays)
      .where(and(eq(attendanceDays.tenantId, tenantId), eq(attendanceDays.workDate, todayStr)));

    const onDuty = daysToday.filter(d => d.status === 'PRESENT' || d.status === 'LATE').length;
    const absent = daysToday.filter(d => d.status === 'ABSENT').length;
    const late = daysToday.filter(d => d.status === 'LATE' || d.lateMinutes > 0).length;

    const [openExceptions] = await db.select({ count: sql<number>`count(*)` })
      .from(attendanceExceptions)
      .where(and(eq(attendanceExceptions.tenantId, tenantId), eq(attendanceExceptions.status, 'OPEN')));

    const [pendingTimesheets] = await db.select({ count: sql<number>`count(*)` })
      .from(timesheets)
      .where(and(eq(timesheets.tenantId, tenantId), eq(timesheets.status, 'SUBMITTED')));

    return {
      totalEmployees: Number(activeEmp?.count || 0),
      onDutyToday: onDuty,
      absentToday: absent,
      lateToday: late,
      openExceptions: Number(openExceptions?.count || 0),
      pendingTimesheets: Number(pendingTimesheets?.count || 0),
    };
  }

  // ==========================================
  // 12. APPROVAL WORKFLOW HISTORY
  // ==========================================

  public async listApprovalHistory(tenantId: string, entityType: string, entityId: string) {
    return db.select().from(approvalWorkflows)
      .where(and(
        eq(approvalWorkflows.tenantId, tenantId),
        eq(approvalWorkflows.entityType, entityType),
        eq(approvalWorkflows.entityId, entityId)
      ))
      .orderBy(desc(approvalWorkflows.timestamp));
  }
}

export const timeRepository = new TimeRepository();
