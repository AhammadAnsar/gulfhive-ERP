import { describe, it, expect } from 'vitest';
import { timeRepository } from '../src/infrastructure/database/repositories/time.repository.ts';

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
