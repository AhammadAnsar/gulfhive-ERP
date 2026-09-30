/**
 * GulfHive ERP - Time & Workforce Management Repository
 * Authoritative management for Attendance, Shifts, Rosters, Holidays, Leave, Overtime, and Approval Flows.
 * Enforces versioned statutory compliance rules and unified approval trails.
 */

import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { db } from '../../../db/index.ts';
import {
  shifts,
  rosterAssignments,
  attendanceRecords,
  attendanceCorrections,
  holidays,
  leaveTypes,
  leaveAllocations,
  leaveRequests,
  overtimeRecords,
  approvalWorkflows,
  employees,
  branches,
  auditLogs,
} from '../../../db/schema.ts';
import { logger } from '../../../core/logging/logger.ts';

export interface CreateShiftInput {
  code: string;
  nameEn: string;
  nameAr: string;
  startTime: string; // '08:00'
  endTime: string; // '16:00'
  breakDurationMinutes?: number;
  gracePeriodMinutes?: number;
  isOvernight?: boolean;
}

export interface CreateRosterInput {
  employeeId: string;
  shiftId: string;
  branchId?: string;
  startDate: string;
  endDate: string;
  notes?: string;
}

export interface CheckInInput {
  employeeId: string;
  branchId?: string;
  date: string; // 'YYYY-MM-DD'
  checkInTime?: string; // ISO string
  shiftId?: string;
  source?: string;
}

export interface CreateLeaveRequestInput {
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
  reason?: string;
  actorId: string;
  actorEmail?: string;
}

export interface CreateOvertimeInput {
  employeeId: string;
  attendanceId?: string;
  date: string;
  overtimeType: 'REGULAR_DAY' | 'WEEKEND' | 'HOLIDAY';
  minutes: number;
  countryCode?: string;
  reason?: string;
  actorId: string;
}

export class TimeRepository {
  // --- 1. SHIFTS ---
  public async listShifts(tenantId: string) {
    return db.select().from(shifts)
      .where(and(eq(shifts.tenantId, tenantId), eq(shifts.isActive, true)))
      .orderBy(asc(shifts.code));
  }

  public async createShift(tenantId: string, input: CreateShiftInput) {
    const id = `shf_${input.code.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
    const [inserted] = await db.insert(shifts).values({
      id,
      tenantId,
      code: input.code.toUpperCase().trim(),
      nameEn: input.nameEn.trim(),
      nameAr: input.nameAr.trim(),
      startTime: input.startTime,
      endTime: input.endTime,
      breakDurationMinutes: input.breakDurationMinutes ?? 60,
      gracePeriodMinutes: input.gracePeriodMinutes ?? 15,
      isOvernight: input.isOvernight ?? false,
      isActive: true,
    }).returning();
    return inserted;
  }

  // --- 2. ROSTERS & SCHEDULING ---
  public async listRosters(tenantId: string, branchId?: string, employeeId?: string) {
    const conditions = [eq(rosterAssignments.tenantId, tenantId)];
    if (branchId) conditions.push(eq(rosterAssignments.branchId, branchId));
    if (employeeId) conditions.push(eq(rosterAssignments.employeeId, employeeId));

    return db.select({
      id: rosterAssignments.id,
      employeeId: rosterAssignments.employeeId,
      employeeNumber: employees.employeeNumber,
      employeeNameEn: sql<string>`concat(${employees.firstNameEn}, ' ', ${employees.lastNameEn})`,
      employeeNameAr: sql<string>`concat(${employees.firstNameAr}, ' ', ${employees.lastNameAr})`,
      shiftId: rosterAssignments.shiftId,
      shiftCode: shifts.code,
      shiftNameEn: shifts.nameEn,
      shiftNameAr: shifts.nameAr,
      startTime: shifts.startTime,
      endTime: shifts.endTime,
      branchId: rosterAssignments.branchId,
      branchCode: branches.code,
      startDate: rosterAssignments.startDate,
      endDate: rosterAssignments.endDate,
      notes: rosterAssignments.notes,
    })
      .from(rosterAssignments)
      .innerJoin(employees, eq(rosterAssignments.employeeId, employees.id))
      .innerJoin(shifts, eq(rosterAssignments.shiftId, shifts.id))
      .leftJoin(branches, eq(rosterAssignments.branchId, branches.id))
      .where(and(...conditions))
      .orderBy(desc(rosterAssignments.startDate));
  }

  public async createRosterAssignment(tenantId: string, input: CreateRosterInput) {
    const id = `rst_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const [inserted] = await db.insert(rosterAssignments).values({
      id,
      tenantId,
      employeeId: input.employeeId,
      shiftId: input.shiftId,
      branchId: input.branchId || null,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      notes: input.notes || null,
    }).returning();
    return inserted;
  }

  // --- 3. ATTENDANCE & PUNCHES ---
  public async listAttendance(tenantId: string, date?: string, branchId?: string) {
    const conditions = [eq(attendanceRecords.tenantId, tenantId)];
    if (date) conditions.push(eq(attendanceRecords.date, date));
    if (branchId) conditions.push(eq(attendanceRecords.branchId, branchId));

    return db.select({
      id: attendanceRecords.id,
      date: attendanceRecords.date,
      employeeId: attendanceRecords.employeeId,
      employeeNumber: employees.employeeNumber,
      employeeNameEn: sql<string>`concat(${employees.firstNameEn}, ' ', ${employees.lastNameEn})`,
      employeeNameAr: sql<string>`concat(${employees.firstNameAr}, ' ', ${employees.lastNameAr})`,
      checkIn: attendanceRecords.checkIn,
      checkOut: attendanceRecords.checkOut,
      shiftId: attendanceRecords.shiftId,
      shiftCode: shifts.code,
      shiftNameEn: shifts.nameEn,
      status: attendanceRecords.status,
      totalMinutes: attendanceRecords.totalMinutes,
      regularMinutes: attendanceRecords.regularMinutes,
      overtimeMinutes: attendanceRecords.overtimeMinutes,
      lateMinutes: attendanceRecords.lateMinutes,
      earlyDepartureMinutes: attendanceRecords.earlyDepartureMinutes,
      source: attendanceRecords.source,
      isCorrected: attendanceRecords.isCorrected,
      branchId: attendanceRecords.branchId,
      branchCode: branches.code,
    })
      .from(attendanceRecords)
      .innerJoin(employees, eq(attendanceRecords.employeeId, employees.id))
      .leftJoin(shifts, eq(attendanceRecords.shiftId, shifts.id))
      .leftJoin(branches, eq(attendanceRecords.branchId, branches.id))
      .where(and(...conditions))
      .orderBy(desc(attendanceRecords.date), asc(employees.employeeNumber));
  }

  public async recordCheckIn(tenantId: string, input: CheckInInput) {
    // Check if an attendance record already exists for this employee on this date
    const existing = await db.select().from(attendanceRecords)
      .where(and(
        eq(attendanceRecords.tenantId, tenantId),
        eq(attendanceRecords.employeeId, input.employeeId),
        eq(attendanceRecords.date, input.date)
      ))
      .limit(1);

    const checkInDate = input.checkInTime ? new Date(input.checkInTime) : new Date();

    if (existing.length > 0) {
      const [updated] = await db.update(attendanceRecords)
        .set({
          checkIn: checkInDate,
          status: 'PRESENT',
          updatedAt: new Date(),
        })
        .where(eq(attendanceRecords.id, existing[0].id))
        .returning();
      return updated;
    }

    const id = `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const [inserted] = await db.insert(attendanceRecords).values({
      id,
      tenantId,
      employeeId: input.employeeId,
      branchId: input.branchId || null,
      date: input.date,
      checkIn: checkInDate,
      shiftId: input.shiftId || null,
      status: 'PRESENT',
      source: input.source || 'WEB',
    }).returning();
    return inserted;
  }

  public async recordCheckOut(tenantId: string, attendanceId: string, checkOutTime?: string) {
    const record = await db.select().from(attendanceRecords)
      .where(and(eq(attendanceRecords.tenantId, tenantId), eq(attendanceRecords.id, attendanceId)))
      .limit(1);

    if (!record[0] || !record[0].checkIn) {
      throw new Error('Check-in record not found or missing check-in timestamp.');
    }

    const checkOutDate = checkOutTime ? new Date(checkOutTime) : new Date();
    const durationMs = checkOutDate.getTime() - new Date(record[0].checkIn).getTime();
    const totalMinutes = Math.max(Math.floor(durationMs / (1000 * 60)), 0);

    // Standard working day is 8 hours (480 minutes)
    const regularMinutes = Math.min(totalMinutes, 480);
    const overtimeMinutes = Math.max(totalMinutes - 480, 0);

    const [updated] = await db.update(attendanceRecords)
      .set({
        checkOut: checkOutDate,
        totalMinutes,
        regularMinutes,
        overtimeMinutes,
        updatedAt: new Date(),
      })
      .where(eq(attendanceRecords.id, attendanceId))
      .returning();

    return updated;
  }

  public async requestAttendanceCorrection(tenantId: string, input: {
    attendanceId: string;
    employeeId: string;
    requestedCheckIn?: string;
    requestedCheckOut?: string;
    reason: string;
    actorId: string;
  }) {
    const id = `cor_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const [inserted] = await db.insert(attendanceCorrections).values({
      id,
      tenantId,
      attendanceId: input.attendanceId,
      employeeId: input.employeeId,
      requestedCheckIn: input.requestedCheckIn ? new Date(input.requestedCheckIn) : null,
      requestedCheckOut: input.requestedCheckOut ? new Date(input.requestedCheckOut) : null,
      reason: input.reason.trim(),
      status: 'PENDING',
    }).returning();

    // Log approval workflow request
    await db.insert(approvalWorkflows).values({
      tenantId,
      entityType: 'ATTENDANCE_CORRECTION',
      entityId: id,
      action: 'SUBMITTED',
      actorId: input.actorId,
      comments: input.reason,
    });

    return inserted;
  }

  public async listCorrections(tenantId: string, status?: string) {
    const conditions = [eq(attendanceCorrections.tenantId, tenantId)];
    if (status) conditions.push(eq(attendanceCorrections.status, status));

    return db.select({
      id: attendanceCorrections.id,
      attendanceId: attendanceCorrections.attendanceId,
      employeeId: attendanceCorrections.employeeId,
      employeeNumber: employees.employeeNumber,
      employeeNameEn: sql<string>`concat(${employees.firstNameEn}, ' ', ${employees.lastNameEn})`,
      requestedCheckIn: attendanceCorrections.requestedCheckIn,
      requestedCheckOut: attendanceCorrections.requestedCheckOut,
      reason: attendanceCorrections.reason,
      status: attendanceCorrections.status,
      reviewedBy: attendanceCorrections.reviewedBy,
      reviewedAt: attendanceCorrections.reviewedAt,
      createdAt: attendanceCorrections.createdAt,
    })
      .from(attendanceCorrections)
      .innerJoin(employees, eq(attendanceCorrections.employeeId, employees.id))
      .where(and(...conditions))
      .orderBy(desc(attendanceCorrections.createdAt));
  }

  public async reviewCorrection(tenantId: string, correctionId: string, decision: 'APPROVED' | 'REJECTED', reviewerId: string, notes?: string) {
    return db.transaction(async (tx) => {
      const [correction] = await tx.select().from(attendanceCorrections)
        .where(and(eq(attendanceCorrections.tenantId, tenantId), eq(attendanceCorrections.id, correctionId)))
        .limit(1);

      if (!correction) throw new Error('Correction request not found');

      // Update correction status
      const [updated] = await tx.update(attendanceCorrections)
        .set({
          status: decision,
          reviewedBy: reviewerId,
          reviewNotes: notes || null,
          reviewedAt: new Date(),
        })
        .where(eq(attendanceCorrections.id, correctionId))
        .returning();

      // If approved, update underlying attendance record
      if (decision === 'APPROVED') {
        const checkIn = correction.requestedCheckIn || undefined;
        const checkOut = correction.requestedCheckOut || undefined;

        let totalMinutes = 0;
        let regularMinutes = 0;
        let overtimeMinutes = 0;

        if (checkIn && checkOut) {
          const durationMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
          totalMinutes = Math.max(Math.floor(durationMs / (1000 * 60)), 0);
          regularMinutes = Math.min(totalMinutes, 480);
          overtimeMinutes = Math.max(totalMinutes - 480, 0);
        }

        await tx.update(attendanceRecords)
          .set({
            ...(checkIn ? { checkIn: new Date(checkIn) } : {}),
            ...(checkOut ? { checkOut: new Date(checkOut) } : {}),
            totalMinutes,
            regularMinutes,
            overtimeMinutes,
            isCorrected: true,
            updatedAt: new Date(),
          })
          .where(eq(attendanceRecords.id, correction.attendanceId));
      }

      // Record in unified approval workflow
      await tx.insert(approvalWorkflows).values({
        tenantId,
        entityType: 'ATTENDANCE_CORRECTION',
        entityId: correctionId,
        action: decision,
        actorId: reviewerId,
        comments: notes || null,
      });

      return updated;
    });
  }

  // --- 4. PUBLIC HOLIDAYS ---
  public async listHolidays(tenantId: string, year?: number) {
    const conditions = [eq(holidays.tenantId, tenantId)];
    if (year) conditions.push(eq(holidays.year, year));

    return db.select().from(holidays)
      .where(and(...conditions))
      .orderBy(asc(holidays.startDate));
  }

  public async createHoliday(tenantId: string, input: {
    countryCode: string;
    nameEn: string;
    nameAr: string;
    startDate: string;
    endDate: string;
    daysCount?: number;
    isRecurring?: boolean;
    year?: number;
  }) {
    const id = `hol_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    const calculatedDays = Math.max(Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1, 1);

    const [inserted] = await db.insert(holidays).values({
      id,
      tenantId,
      countryCode: input.countryCode.toUpperCase(),
      nameEn: input.nameEn.trim(),
      nameAr: input.nameAr.trim(),
      startDate: start,
      endDate: end,
      daysCount: input.daysCount || calculatedDays,
      isRecurring: input.isRecurring ?? false,
      year: input.year || start.getFullYear(),
    }).returning();
    return inserted;
  }

  // --- 5. LEAVE MANAGEMENT ---
  public async listLeaveTypes(tenantId: string) {
    // If tenant has no leave types yet, seed statutory default GCC types
    const existing = await db.select().from(leaveTypes)
      .where(and(eq(leaveTypes.tenantId, tenantId), eq(leaveTypes.isActive, true)));

    if (existing.length === 0) {
      const defaults = [
        { code: 'ANNUAL', nameEn: 'Annual Leave', nameAr: 'إجازة سنوية اعتيادية', defaultDaysPerYear: 30, isPaid: true, statutoryReference: 'GCC Labor Law standard 30 days' },
        { code: 'SICK', nameEn: 'Sick Leave', nameAr: 'إجازة مرضية معتمدة', defaultDaysPerYear: 15, isPaid: true, statutoryReference: 'Medical Board Certificate Required' },
        { code: 'HAJJ', nameEn: 'Hajj Pilgrimage Leave', nameAr: 'إجازة أداء فريضة الحج', defaultDaysPerYear: 21, isPaid: true, statutoryReference: 'Once per employment tenure' },
        { code: 'MATERNITY', nameEn: 'Maternity Leave', nameAr: 'إجازة وضع ورعاية مولود', defaultDaysPerYear: 70, isPaid: true, statutoryReference: 'GCC Statutory Maternity' },
        { code: 'COMPASSIONATE', nameEn: 'Compassionate / Bereavement', nameAr: 'إجازة عزاء ومواساة', defaultDaysPerYear: 3, isPaid: true, statutoryReference: 'Immediate family bereavement' },
        { code: 'UNPAID', nameEn: 'Unpaid Leave', nameAr: 'إجازة بدون راتب', defaultDaysPerYear: 0, isPaid: false, statutoryReference: 'Subject to company approval' },
      ];

      for (const d of defaults) {
        await db.insert(leaveTypes).values({
          id: `lt_${d.code.toLowerCase()}_${tenantId.slice(0, 10)}`,
          tenantId,
          code: d.code,
          nameEn: d.nameEn,
          nameAr: d.nameAr,
          defaultDaysPerYear: d.defaultDaysPerYear,
          isPaid: d.isPaid,
          requiresApproval: true,
          statutoryReference: d.statutoryReference,
          isActive: true,
        });
      }

      return db.select().from(leaveTypes).where(and(eq(leaveTypes.tenantId, tenantId), eq(leaveTypes.isActive, true)));
    }

    return existing;
  }

  public async listLeaveRequests(tenantId: string, employeeId?: string, status?: string) {
    const conditions = [eq(leaveRequests.tenantId, tenantId)];
    if (employeeId) conditions.push(eq(leaveRequests.employeeId, employeeId));
    if (status) conditions.push(eq(leaveRequests.status, status));

    return db.select({
      id: leaveRequests.id,
      employeeId: leaveRequests.employeeId,
      employeeNumber: employees.employeeNumber,
      employeeNameEn: sql<string>`concat(${employees.firstNameEn}, ' ', ${employees.lastNameEn})`,
      employeeNameAr: sql<string>`concat(${employees.firstNameAr}, ' ', ${employees.lastNameAr})`,
      leaveTypeId: leaveRequests.leaveTypeId,
      leaveTypeCode: leaveTypes.code,
      leaveTypeNameEn: leaveTypes.nameEn,
      leaveTypeNameAr: leaveTypes.nameAr,
      startDate: leaveRequests.startDate,
      endDate: leaveRequests.endDate,
      daysRequested: leaveRequests.daysRequested,
      reason: leaveRequests.reason,
      status: leaveRequests.status,
      approvedBy: leaveRequests.approvedBy,
      approvalNotes: leaveRequests.approvalNotes,
      approvedAt: leaveRequests.approvedAt,
      createdAt: leaveRequests.createdAt,
    })
      .from(leaveRequests)
      .innerJoin(employees, eq(leaveRequests.employeeId, employees.id))
      .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .where(and(...conditions))
      .orderBy(desc(leaveRequests.createdAt));
  }

  public async createLeaveRequest(tenantId: string, input: CreateLeaveRequestInput) {
    const id = `lv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const [inserted] = await db.insert(leaveRequests).values({
      id,
      tenantId,
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      daysRequested: input.daysRequested,
      reason: input.reason || null,
      status: 'PENDING',
    }).returning();

    // Log approval workflow submission
    await db.insert(approvalWorkflows).values({
      tenantId,
      entityType: 'LEAVE_REQUEST',
      entityId: id,
      action: 'SUBMITTED',
      actorId: input.actorId,
      actorEmail: input.actorEmail || null,
      comments: input.reason || 'Leave application submitted for approval',
    });

    return inserted;
  }

  public async reviewLeaveRequest(tenantId: string, requestId: string, decision: 'APPROVED' | 'REJECTED', reviewerId: string, notes?: string) {
    return db.transaction(async (tx) => {
      const [updated] = await tx.update(leaveRequests)
        .set({
          status: decision,
          approvedBy: reviewerId,
          approvalNotes: notes || null,
          approvedAt: new Date(),
        })
        .where(and(eq(leaveRequests.tenantId, tenantId), eq(leaveRequests.id, requestId)))
        .returning();

      // Record in unified approval workflow
      await tx.insert(approvalWorkflows).values({
        tenantId,
        entityType: 'LEAVE_REQUEST',
        entityId: requestId,
        action: decision,
        actorId: reviewerId,
        comments: notes || null,
      });

      return updated;
    });
  }

  // --- 6. OVERTIME & STATUTORY RATES ---
  public getStatutoryMultiplier(countryCode: string, overtimeType: 'REGULAR_DAY' | 'WEEKEND' | 'HOLIDAY'): string {
    // Versioned statutory rules per GCC country labor laws
    switch (overtimeType) {
      case 'HOLIDAY':
        // Kuwait Law 6/2010 Art 66: 2.0x for official holidays
        // Saudi Labor Law Art 107: 1.50x
        return countryCode === 'KW' ? '2.00' : '1.50';
      case 'WEEKEND':
        // Weekend rest day overtime: 1.50x standard across GCC
        return '1.50';
      case 'REGULAR_DAY':
      default:
        // Normal day overtime: 1.25x (or 1.50x in Saudi)
        return countryCode === 'SA' ? '1.50' : '1.25';
    }
  }

  public async listOvertimeRecords(tenantId: string, status?: string) {
    const conditions = [eq(overtimeRecords.tenantId, tenantId)];
    if (status) conditions.push(eq(overtimeRecords.status, status));

    return db.select({
      id: overtimeRecords.id,
      employeeId: overtimeRecords.employeeId,
      employeeNumber: employees.employeeNumber,
      employeeNameEn: sql<string>`concat(${employees.firstNameEn}, ' ', ${employees.lastNameEn})`,
      employeeNameAr: sql<string>`concat(${employees.firstNameAr}, ' ', ${employees.lastNameAr})`,
      date: overtimeRecords.date,
      overtimeType: overtimeRecords.overtimeType,
      minutes: overtimeRecords.minutes,
      statutoryRateMultiplier: overtimeRecords.statutoryRateMultiplier,
      status: overtimeRecords.status,
      reason: overtimeRecords.reason,
      approvedBy: overtimeRecords.approvedBy,
      approvedAt: overtimeRecords.approvedAt,
      createdAt: overtimeRecords.createdAt,
    })
      .from(overtimeRecords)
      .innerJoin(employees, eq(overtimeRecords.employeeId, employees.id))
      .where(and(...conditions))
      .orderBy(desc(overtimeRecords.date));
  }

  public async createOvertimeRecord(tenantId: string, input: CreateOvertimeInput) {
    const id = `ot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const multiplier = this.getStatutoryMultiplier(input.countryCode || 'KW', input.overtimeType);

    const [inserted] = await db.insert(overtimeRecords).values({
      id,
      tenantId,
      employeeId: input.employeeId,
      attendanceId: input.attendanceId || null,
      date: input.date,
      overtimeType: input.overtimeType,
      minutes: input.minutes,
      statutoryRateMultiplier: multiplier,
      status: 'PENDING',
      reason: input.reason || null,
    }).returning();

    // Log approval workflow submission
    await db.insert(approvalWorkflows).values({
      tenantId,
      entityType: 'OVERTIME_REQUEST',
      entityId: id,
      action: 'SUBMITTED',
      actorId: input.actorId,
      comments: input.reason || `Overtime claim: ${input.minutes} mins (${multiplier}x statutory rate)`,
    });

    return inserted;
  }

  public async reviewOvertimeRecord(tenantId: string, overtimeId: string, decision: 'APPROVED' | 'REJECTED', reviewerId: string, notes?: string) {
    return db.transaction(async (tx) => {
      const [updated] = await tx.update(overtimeRecords)
        .set({
          status: decision,
          approvedBy: reviewerId,
          approvedAt: new Date(),
        })
        .where(and(eq(overtimeRecords.tenantId, tenantId), eq(overtimeRecords.id, overtimeId)))
        .returning();

      // Record in unified approval workflow
      await tx.insert(approvalWorkflows).values({
        tenantId,
        entityType: 'OVERTIME_REQUEST',
        entityId: overtimeId,
        action: decision,
        actorId: reviewerId,
        comments: notes || null,
      });

      return updated;
    });
  }

  // --- 7. REUSABLE APPROVAL WORKFLOW ENGINE AUDIT TRAIL ---
  public async listApprovalHistory(tenantId: string, entityType: string, entityId: string) {
    return db.select().from(approvalWorkflows)
      .where(and(
        eq(approvalWorkflows.tenantId, tenantId),
        eq(approvalWorkflows.entityType, entityType),
        eq(approvalWorkflows.entityId, entityId)
      ))
      .orderBy(asc(approvalWorkflows.timestamp));
  }
}

export const timeRepository = new TimeRepository();
