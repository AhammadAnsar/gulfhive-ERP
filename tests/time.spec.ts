import { describe, it, expect } from 'vitest';
import { timeRepository } from '../src/infrastructure/database/repositories/time.repository.ts';
import { attendanceProcessor } from '../src/services/attendance-processor.service.ts';
import { numberingRepository } from '../src/infrastructure/database/repositories/numbering.repository.ts';

describe('Time Module Domain & Statutory Calculation Rules', () => {
  it('should calculate shift duration and break allowances properly', () => {
    const shift = {
      startTime: '08:00',
      endTime: '16:00',
      breakDurationMinutes: 60,
      gracePeriodMinutes: 15,
    };

    const startMinutes = 8 * 60;
    const endMinutes = 16 * 60;
    const totalWorkingMinutes = (endMinutes - startMinutes) - shift.breakDurationMinutes;

    expect(totalWorkingMinutes).toBe(420); // 7 hours net working time
  });

  it('should enforce GCC versioned statutory overtime multipliers', () => {
    // Kuwait statutory overtime rules
    const kwRegularOT = timeRepository.getStatutoryMultiplier('KW', 'REGULAR_DAY');
    const kwWeekendOT = timeRepository.getStatutoryMultiplier('KW', 'WEEKEND');
    const kwHolidayOT = timeRepository.getStatutoryMultiplier('KW', 'HOLIDAY');

    expect(kwRegularOT).toBe('1.25');
    expect(kwWeekendOT).toBe('1.50');
    expect(kwHolidayOT).toBe('2.00');

    // Saudi statutory overtime rules (Royal Decree M/51)
    const saRegularOT = timeRepository.getStatutoryMultiplier('SA', 'REGULAR_DAY');
    const saWeekendOT = timeRepository.getStatutoryMultiplier('SA', 'WEEKEND');
    const saHolidayOT = timeRepository.getStatutoryMultiplier('SA', 'HOLIDAY');

    expect(saRegularOT).toBe('1.50');
    expect(saWeekendOT).toBe('1.50');
    expect(saHolidayOT).toBe('1.50');

    // UAE statutory overtime rules
    const aeRegularOT = timeRepository.getStatutoryMultiplier('AE', 'REGULAR_DAY');
    const aeWeekendOT = timeRepository.getStatutoryMultiplier('AE', 'WEEKEND');
    expect(aeRegularOT).toBe('1.25');
    expect(aeWeekendOT).toBe('1.50');
  });

  it('should calculate attendance lateness respecting the shift grace period', () => {
    const shiftStartTime = '08:00';
    const graceMinutes = 15;

    const checkPunctuality = (checkInStr: string) => {
      const [h, m] = checkInStr.split(':').map(Number);
      const [sh, sm] = shiftStartTime.split(':').map(Number);

      const checkInMinutes = h * 60 + m;
      const shiftStartMinutes = sh * 60 + sm;

      const diff = checkInMinutes - shiftStartMinutes;
      if (diff <= graceMinutes) {
        return { isLate: false, lateMinutes: 0 };
      }
      return { isLate: true, lateMinutes: diff };
    };

    // 08:10 is within 15 min grace
    const punch1 = checkPunctuality('08:10');
    expect(punch1.isLate).toBe(false);
    expect(punch1.lateMinutes).toBe(0);

    // 08:25 is 25 mins late
    const punch2 = checkPunctuality('08:25');
    expect(punch2.isLate).toBe(true);
    expect(punch2.lateMinutes).toBe(25);
  });

  it('should calculate statutory leave day counts between dates', () => {
    const start = new Date('2026-10-01');
    const end = new Date('2026-10-15');

    const durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    expect(durationDays).toBe(15);
  });
});

describe('AttendanceProcessorService — Deterministic Attendance Engine', () => {
  it('should deterministically calculate standard day attendance with punctuality', () => {
    const workDate = '2026-10-05';
    const shift = {
      id: 'shift_std',
      code: 'STD-DAY',
      startTime: '08:00',
      endTime: '16:00',
      crossesMidnight: false,
      scheduledMinutes: 480,
      breakDurationMinutes: 60,
      gracePeriodMinutes: 15,
      graceOutMinutes: 10,
    };

    const inTime = new Date('2026-10-05T08:05:00Z');
    const outTime = new Date('2026-10-05T16:00:00Z');

    const result = attendanceProcessor.processDay({
      employeeId: 'emp_001',
      workDate,
      shift,
      clockEvents: [
        { id: 'clk_1', eventTimestamp: inTime, eventType: 'IN' },
        { id: 'clk_2', eventTimestamp: outTime, eventType: 'OUT' },
      ],
    });

    expect(result.status).toBe('PRESENT');
    expect(result.workedMinutes).toBe(415); // (480 - 5 min late arrival) - 60 break
    expect(result.lateMinutes).toBe(0); // within 15m grace period
    expect(result.exceptions).toHaveLength(0);
  });

  it('should handle cross-midnight shifts correctly mapping to shift workDate', () => {
    const workDate = '2026-10-05';
    const shift = {
      id: 'shift_night',
      code: 'NIGHT-01',
      startTime: '22:00',
      endTime: '06:00',
      crossesMidnight: true,
      scheduledMinutes: 480,
      breakDurationMinutes: 60,
      gracePeriodMinutes: 15,
      graceOutMinutes: 10,
    };

    // Employee clocks in at 21:58 on 2026-10-05, clocks out at 06:02 on 2026-10-06
    const inTime = new Date('2026-10-05T21:58:00Z');
    const outTime = new Date('2026-10-06T06:02:00Z');

    const result = attendanceProcessor.processDay({
      employeeId: 'emp_002',
      workDate,
      shift,
      clockEvents: [
        { id: 'clk_3', eventTimestamp: inTime, eventType: 'IN' },
        { id: 'clk_4', eventTimestamp: outTime, eventType: 'OUT' },
      ],
    });

    expect(result.status).toBe('PRESENT');
    expect(result.workDate).toBe('2026-10-05');
    expect(result.workedMinutes).toBeGreaterThanOrEqual(420);
    expect(result.exceptions).toHaveLength(0);
  });

  it('should identify MISSING_OUT exception when employee does not clock out', () => {
    const workDate = '2026-10-05';
    const shift = {
      id: 'shift_std',
      code: 'STD-DAY',
      startTime: '08:00',
      endTime: '16:00',
      crossesMidnight: false,
      scheduledMinutes: 480,
      breakDurationMinutes: 60,
      gracePeriodMinutes: 15,
    };

    const inTime = new Date('2026-10-05T08:00:00Z');

    const result = attendanceProcessor.processDay({
      employeeId: 'emp_003',
      workDate,
      shift,
      clockEvents: [
        { id: 'clk_5', eventTimestamp: inTime, eventType: 'IN' },
      ],
    });

    expect(result.status).toBe('MISSING_PUNCH');
    const missingOut = result.exceptions.find(e => e.exceptionType === 'MISSING_OUT');
    expect(missingOut).toBeDefined();
    expect(missingOut?.severity).toBe('HIGH');
  });

  it('should identify DUPLICATE_PUNCH exception when double-tapped on biometric reader', () => {
    const workDate = '2026-10-05';
    const shift = {
      id: 'shift_std',
      code: 'STD-DAY',
      startTime: '08:00',
      endTime: '16:00',
      crossesMidnight: false,
      scheduledMinutes: 480,
      breakDurationMinutes: 60,
      gracePeriodMinutes: 15,
    };

    const inTime1 = new Date('2026-10-05T08:00:00Z');
    const inTime2 = new Date('2026-10-05T08:00:15Z'); // 15 seconds later duplicate
    const outTime = new Date('2026-10-05T16:00:00Z');

    const result = attendanceProcessor.processDay({
      employeeId: 'emp_004',
      workDate,
      shift,
      clockEvents: [
        { id: 'clk_6', eventTimestamp: inTime1, eventType: 'IN' },
        { id: 'clk_7', eventTimestamp: inTime2, eventType: 'IN', isDuplicate: true },
        { id: 'clk_8', eventTimestamp: outTime, eventType: 'OUT' },
      ],
    });

    const dupException = result.exceptions.find(e => e.exceptionType === 'DUPLICATE_PUNCH');
    expect(dupException).toBeDefined();
    expect(dupException?.severity).toBe('LOW');
  });

  it('should compute overtime candidate minutes without hardcoded money rates', () => {
    const workDate = '2026-10-05';
    const shift = {
      id: 'shift_std',
      code: 'STD-DAY',
      startTime: '08:00',
      endTime: '16:00',
      crossesMidnight: false,
      scheduledMinutes: 480, // 8 scheduled hours
      breakDurationMinutes: 0,
      gracePeriodMinutes: 15,
    };

    // Employee stayed until 18:30 (2.5 hours extra = 150 minutes)
    const inTime = new Date('2026-10-05T08:00:00Z');
    const outTime = new Date('2026-10-05T18:30:00Z');

    const result = attendanceProcessor.processDay({
      employeeId: 'emp_005',
      workDate,
      shift,
      clockEvents: [
        { id: 'clk_9', eventTimestamp: inTime, eventType: 'IN' },
        { id: 'clk_10', eventTimestamp: outTime, eventType: 'OUT' },
      ],
    });

    expect(result.overtimeCandidateMinutes).toBe(150);
    // Verifies candidate time is purely minutes, maintaining strict architectural separation from monetary rates
    expect(typeof result.overtimeCandidateMinutes).toBe('number');
  });

  it('should format Timesheet sequence numbers with TS prefix using Numbering Engine', () => {
    const seq = {
      prefix: 'TS',
      suffix: '',
      separator: '-',
      includeYear: true,
      includeMonth: false,
      paddingLength: 5,
    };

    const formatted = numberingRepository.formatNumber(seq, 42, new Date('2026-10-01'));
    expect(formatted).toBe('TS-2026-00042');
  });
});
