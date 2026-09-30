/**
 * GulfHive ERP - Deterministic Attendance Processing Engine
 * 
 * Invariants:
 * 1. Raw clock events are immutable evidence; processed attendance is stored separately in attendance_days.
 * 2. Cross-midnight shifts (e.g. 20:00 -> 04:00, punch in 19:57, punch out 04:03) map strictly to the work_date.
 * 3. Missing punches generate exceptions (MISSING_IN, MISSING_OUT), never invent artificial punches.
 * 4. Configurable grace periods (grace_in, grace_out) determine punctuality.
 * 5. Break policies (paid vs unpaid, fixed vs clocked) calculate net worked minutes.
 * 6. Overtime candidate minutes are derived (time only, no statutory monetary multiplier).
 * 7. Processing is fully idempotent: re-running for the same day updates and recalculates cleanly.
 */

export interface ShiftDefinition {
  id: string;
  code: string;
  startTime: string; // "HH:MM" e.g. "08:00" or "20:00"
  endTime: string; // "HH:MM" e.g. "16:00" or "04:00"
  crossesMidnight?: boolean;
  scheduledMinutes?: number;
  breakDurationMinutes?: number;
  gracePeriodMinutes?: number;
  graceOutMinutes?: number;
  earlyInPolicy?: string;
  lateInPolicy?: string;
  earlyOutPolicy?: string;
}

export interface ClockEventRecord {
  id: string;
  eventTimestamp: Date;
  eventType: 'IN' | 'OUT' | 'BREAK_START' | 'BREAK_END';
  source?: string;
  isDuplicate?: boolean;
}

export interface ProcessAttendanceParams {
  employeeId: string;
  workDate: string; // "YYYY-MM-DD"
  shift?: ShiftDefinition | null;
  rosterEntryId?: string | null;
  clockEvents: ClockEventRecord[];
  isHoliday?: boolean;
  isRestDay?: boolean;
  hasApprovedLeave?: boolean;
}

export interface AttendanceProcessingResult {
  workDate: string;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  actualFirstIn: Date | null;
  actualLastOut: Date | null;
  scheduledMinutes: number;
  workedMinutes: number;
  breakMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeCandidateMinutes: number;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'PARTIAL' | 'REST_DAY' | 'HOLIDAY' | 'LEAVE' | 'MISSING_PUNCH' | 'NOT_SCHEDULED';
  exceptions: Array<{
    exceptionType: 'MISSING_IN' | 'MISSING_OUT' | 'LATE_ARRIVAL' | 'EARLY_DEPARTURE' | 'UNEXPECTED_ABSENCE' | 'UNEXPECTED_ATTENDANCE' | 'EXCESSIVE_HOURS' | 'DUPLICATE_PUNCH' | 'SCHEDULE_MISMATCH';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    description: string;
  }>;
}

export class AttendanceProcessorService {
  /**
   * Parse a date string and "HH:MM" into a UTC Date object.
   * If crossesMidnight is true and the time is before startTime, it advances to next calendar day.
   */
  public parseShiftDateTime(workDateStr: string, timeStr: string, isNextDay = false): Date {
    const [year, month, day] = workDateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);

    const d = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
    if (isNextDay) {
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return d;
  }

  /**
   * Process a single employee workday deterministically.
   */
  public processDay(params: ProcessAttendanceParams): AttendanceProcessingResult {
    const { employeeId, workDate, shift, rosterEntryId, clockEvents, isHoliday, isRestDay, hasApprovedLeave } = params;

    const exceptions: AttendanceProcessingResult['exceptions'] = [];

    // Filter out duplicates for core calculation but record exception if duplicate found
    const hasDuplicate = clockEvents.some(e => e.isDuplicate);
    if (hasDuplicate) {
      exceptions.push({
        exceptionType: 'DUPLICATE_PUNCH',
        severity: 'LOW',
        description: `Duplicate clock punch detected for employee ${employeeId} on ${workDate}.`,
      });
    }

    const validPunches = clockEvents
      .filter(e => !e.isDuplicate)
      .sort((a, b) => a.eventTimestamp.getTime() - b.eventTimestamp.getTime());

    // 1. Check Holiday / Rest Day / Leave when no shift or no punches
    if (hasApprovedLeave && validPunches.length === 0) {
      return {
        workDate,
        scheduledStart: null,
        scheduledEnd: null,
        actualFirstIn: null,
        actualLastOut: null,
        scheduledMinutes: 0,
        workedMinutes: 0,
        breakMinutes: 0,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        overtimeCandidateMinutes: 0,
        status: 'LEAVE',
        exceptions,
      };
    }

    if (isHoliday && validPunches.length === 0) {
      return {
        workDate,
        scheduledStart: null,
        scheduledEnd: null,
        actualFirstIn: null,
        actualLastOut: null,
        scheduledMinutes: 0,
        workedMinutes: 0,
        breakMinutes: 0,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        overtimeCandidateMinutes: 0,
        status: 'HOLIDAY',
        exceptions,
      };
    }

    if (isRestDay && validPunches.length === 0) {
      return {
        workDate,
        scheduledStart: null,
        scheduledEnd: null,
        actualFirstIn: null,
        actualLastOut: null,
        scheduledMinutes: 0,
        workedMinutes: 0,
        breakMinutes: 0,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        overtimeCandidateMinutes: 0,
        status: 'REST_DAY',
        exceptions,
      };
    }

    // 2. Unscheduled work
    if (!shift) {
      if (validPunches.length > 0) {
        const firstIn = validPunches.find(e => e.eventType === 'IN')?.eventTimestamp || validPunches[0].eventTimestamp;
        const lastOut = [...validPunches].reverse().find(e => e.eventType === 'OUT')?.eventTimestamp || validPunches[validPunches.length - 1].eventTimestamp;
        const workedMs = Math.max(0, lastOut.getTime() - firstIn.getTime());
        const workedMinutes = Math.floor(workedMs / (1000 * 60));

        exceptions.push({
          exceptionType: 'UNEXPECTED_ATTENDANCE',
          severity: 'MEDIUM',
          description: `Employee clocked in on ${workDate} without a scheduled shift.`,
        });

        return {
          workDate,
          scheduledStart: null,
          scheduledEnd: null,
          actualFirstIn: firstIn,
          actualLastOut: lastOut,
          scheduledMinutes: 0,
          workedMinutes,
          breakMinutes: 0,
          lateMinutes: 0,
          earlyLeaveMinutes: 0,
          overtimeCandidateMinutes: workedMinutes,
          status: 'NOT_SCHEDULED',
          exceptions,
        };
      }

      return {
        workDate,
        scheduledStart: null,
        scheduledEnd: null,
        actualFirstIn: null,
        actualLastOut: null,
        scheduledMinutes: 0,
        workedMinutes: 0,
        breakMinutes: 0,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        overtimeCandidateMinutes: 0,
        status: 'NOT_SCHEDULED',
        exceptions,
      };
    }

    // 3. Shift Configuration
    const crossesMidnight = shift.crossesMidnight || (shift.startTime > shift.endTime);
    const scheduledStart = this.parseShiftDateTime(workDate, shift.startTime, false);
    const scheduledEnd = this.parseShiftDateTime(workDate, shift.endTime, crossesMidnight);

    const scheduledDurationMs = scheduledEnd.getTime() - scheduledStart.getTime();
    const rawScheduledMinutes = Math.floor(scheduledDurationMs / (1000 * 60));
    const breakDurationMinutes = shift.breakDurationMinutes || 0;
    const scheduledMinutes = shift.scheduledMinutes || Math.max(0, rawScheduledMinutes - breakDurationMinutes);

    const graceInMinutes = shift.gracePeriodMinutes || 0;
    const graceOutMinutes = shift.graceOutMinutes || 0;

    // 4. Check for Absence (scheduled to work, no punches)
    if (validPunches.length === 0) {
      exceptions.push({
        exceptionType: 'UNEXPECTED_ABSENCE',
        severity: 'HIGH',
        description: `Employee scheduled for shift ${shift.code} but did not clock in on ${workDate}.`,
      });

      return {
        workDate,
        scheduledStart,
        scheduledEnd,
        actualFirstIn: null,
        actualLastOut: null,
        scheduledMinutes,
        workedMinutes: 0,
        breakMinutes: 0,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        overtimeCandidateMinutes: 0,
        status: 'ABSENT',
        exceptions,
      };
    }

    // 5. Categorize In and Out Punches
    const inEvents = validPunches.filter(e => e.eventType === 'IN');
    const outEvents = validPunches.filter(e => e.eventType === 'OUT');

    let actualFirstIn: Date | null = inEvents.length > 0 ? inEvents[0].eventTimestamp : null;
    let actualLastOut: Date | null = outEvents.length > 0 ? outEvents[outEvents.length - 1].eventTimestamp : null;

    // Missing Punch detection
    if (!actualFirstIn && actualLastOut) {
      exceptions.push({
        exceptionType: 'MISSING_IN',
        severity: 'HIGH',
        description: `Missing Clock IN punch on ${workDate}; OUT registered at ${actualLastOut.toISOString()}.`,
      });
      return {
        workDate,
        scheduledStart,
        scheduledEnd,
        actualFirstIn: null,
        actualLastOut,
        scheduledMinutes,
        workedMinutes: 0,
        breakMinutes: 0,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        overtimeCandidateMinutes: 0,
        status: 'MISSING_PUNCH',
        exceptions,
      };
    }

    if (actualFirstIn && !actualLastOut) {
      exceptions.push({
        exceptionType: 'MISSING_OUT',
        severity: 'HIGH',
        description: `Missing Clock OUT punch on ${workDate}; IN registered at ${actualFirstIn.toISOString()}.`,
      });
      return {
        workDate,
        scheduledStart,
        scheduledEnd,
        actualFirstIn,
        actualLastOut: null,
        scheduledMinutes,
        workedMinutes: 0,
        breakMinutes: 0,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        overtimeCandidateMinutes: 0,
        status: 'MISSING_PUNCH',
        exceptions,
      };
    }

    if (!actualFirstIn || !actualLastOut) {
      // Fallback: use first and last punch if eventType was generic
      actualFirstIn = validPunches[0].eventTimestamp;
      actualLastOut = validPunches[validPunches.length - 1].eventTimestamp;
    }

    // 6. Calculate Gross and Net Worked Minutes
    const grossWorkedMs = Math.max(0, actualLastOut.getTime() - actualFirstIn.getTime());
    const grossWorkedMinutes = Math.floor(grossWorkedMs / (1000 * 60));

    // Calculate clocked breaks if any
    let breakMinutes = breakDurationMinutes;
    const breakStarts = validPunches.filter(e => e.eventType === 'BREAK_START');
    const breakEnds = validPunches.filter(e => e.eventType === 'BREAK_END');
    if (breakStarts.length > 0 && breakEnds.length > 0) {
      let clockedBreakMs = 0;
      for (let i = 0; i < Math.min(breakStarts.length, breakEnds.length); i++) {
        clockedBreakMs += Math.max(0, breakEnds[i].eventTimestamp.getTime() - breakStarts[i].eventTimestamp.getTime());
      }
      breakMinutes = Math.floor(clockedBreakMs / (1000 * 60));
    }

    const workedMinutes = Math.max(0, grossWorkedMinutes - breakMinutes);

    // 7. Late Arrival calculation
    let lateMinutes = 0;
    const graceInThresholdMs = scheduledStart.getTime() + (graceInMinutes * 60 * 1000);
    if (actualFirstIn.getTime() > graceInThresholdMs) {
      lateMinutes = Math.floor((actualFirstIn.getTime() - scheduledStart.getTime()) / (1000 * 60));
      exceptions.push({
        exceptionType: 'LATE_ARRIVAL',
        severity: 'MEDIUM',
        description: `Late arrival by ${lateMinutes} minutes (Threshold: ${graceInMinutes}m grace).`,
      });
    }

    // 8. Early Departure calculation
    let earlyLeaveMinutes = 0;
    const graceOutThresholdMs = scheduledEnd.getTime() - (graceOutMinutes * 60 * 1000);
    if (actualLastOut.getTime() < graceOutThresholdMs) {
      earlyLeaveMinutes = Math.floor((scheduledEnd.getTime() - actualLastOut.getTime()) / (1000 * 60));
      exceptions.push({
        exceptionType: 'EARLY_DEPARTURE',
        severity: 'MEDIUM',
        description: `Early departure by ${earlyLeaveMinutes} minutes before scheduled end.`,
      });
    }

    // 9. Overtime Candidate calculation (time only)
    let overtimeCandidateMinutes = 0;
    if (workedMinutes > scheduledMinutes) {
      overtimeCandidateMinutes = workedMinutes - scheduledMinutes;
    } else if (isRestDay || isHoliday) {
      overtimeCandidateMinutes = workedMinutes;
    }

    // 10. Excessive hours flag (> 12 hours)
    if (workedMinutes > 720) {
      exceptions.push({
        exceptionType: 'EXCESSIVE_HOURS',
        severity: 'HIGH',
        description: `Employee worked ${workedMinutes} minutes (${(workedMinutes / 60).toFixed(1)}h), exceeding daily safety limit.`,
      });
    }

    // 11. Final Status Derivation
    let status: AttendanceProcessingResult['status'] = 'PRESENT';
    if (lateMinutes > 0) {
      status = 'LATE';
    } else if (workedMinutes < (scheduledMinutes * 0.5)) {
      status = 'PARTIAL';
    }

    return {
      workDate,
      scheduledStart,
      scheduledEnd,
      actualFirstIn,
      actualLastOut,
      scheduledMinutes,
      workedMinutes,
      breakMinutes,
      lateMinutes,
      earlyLeaveMinutes,
      overtimeCandidateMinutes,
      status,
      exceptions,
    };
  }
}

export const attendanceProcessor = new AttendanceProcessorService();
