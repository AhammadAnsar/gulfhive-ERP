/**
 * GulfHive ERP - Time & Attendance Router
 * Handles work schedules, break policies, shifts, shift patterns, rosters, clock events, attendance processing, exceptions, corrections, timesheets, overtime, and holiday calendars.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { timeRepository } from '../infrastructure/database/repositories/time.repository.ts';
import { companyRepository } from '../infrastructure/database/repositories/company.repository.ts';
import { attendanceImportService } from '../services/attendance-import.service.ts';
import { timeExportService } from '../services/time-export.service.ts';
import { ValidationError, NotFoundError } from '../core/errors/app-error.ts';
import { logger } from '../core/logging/logger.ts';

export const timeRouter = Router();

// 1. Work Schedules & Break Policies
timeRouter.get('/companies/:companyId/work-schedules', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await timeRepository.listWorkSchedules(req.params.companyId);
    res.json({ schedules: list });
  } catch (error) {
    next(error);
  }
});

timeRouter.post('/companies/:companyId/work-schedules', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schedule = await timeRepository.createWorkSchedule(req.params.companyId, req.body);
    res.status(201).json({ schedule });
  } catch (error) {
    next(error);
  }
});

timeRouter.get('/companies/:companyId/break-policies', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await timeRepository.listBreakPolicies(req.params.companyId);
    res.json({ policies: list });
  } catch (error) {
    next(error);
  }
});

timeRouter.post('/companies/:companyId/break-policies', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const policy = await timeRepository.createBreakPolicy(req.params.companyId, req.body);
    res.status(201).json({ policy });
  } catch (error) {
    next(error);
  }
});

// 2. Shifts API
timeRouter.get('/companies/:companyId/shifts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await timeRepository.listShifts(req.params.companyId);
    res.json({ shifts: list });
  } catch (error) {
    next(error);
  }
});

timeRouter.post('/companies/:companyId/shifts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, nameEn, nameAr, startTime, endTime, breakDurationMinutes, gracePeriodMinutes, crossesMidnight } = req.body;
    if (!code || !nameEn || !nameAr || !startTime || !endTime) {
      throw new ValidationError('code, nameEn, nameAr, startTime, and endTime are required.');
    }
    const shift = await timeRepository.createShift(req.params.companyId, {
      ...req.body,
      breakDurationMinutes: breakDurationMinutes ? Number(breakDurationMinutes) : 60,
      gracePeriodMinutes: gracePeriodMinutes ? Number(gracePeriodMinutes) : 15,
      crossesMidnight: crossesMidnight !== undefined ? !!crossesMidnight : undefined,
    });
    res.status(201).json({ shift });
  } catch (error) {
    next(error);
  }
});

timeRouter.put('/companies/:companyId/shifts/:shiftId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await timeRepository.updateShift(req.params.companyId, req.params.shiftId, req.body);
    res.json({ shift: updated });
  } catch (error) {
    next(error);
  }
});

timeRouter.delete('/companies/:companyId/shifts/:shiftId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await timeRepository.deleteShift(req.params.companyId, req.params.shiftId, req.body.actorId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// 3. Shift Patterns API
timeRouter.get('/companies/:companyId/shift-patterns', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await timeRepository.listShiftPatterns(req.params.companyId);
    res.json({ patterns: list });
  } catch (error) {
    next(error);
  }
});

timeRouter.post('/companies/:companyId/shift-patterns', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pattern = await timeRepository.createShiftPattern(req.params.companyId, req.body);
    res.status(201).json({ pattern });
  } catch (error) {
    next(error);
  }
});

// 4. Rosters API
timeRouter.get('/companies/:companyId/rosters', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await timeRepository.listRosters(req.params.companyId, {
      branchId: req.query.branchId as string | undefined,
      employeeId: req.query.employeeId as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      status: req.query.status as string | undefined,
    });
    res.json({ rosters: list });
  } catch (error) {
    next(error);
  }
});

timeRouter.post('/companies/:companyId/rosters', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { employeeId, shiftId, workDate, branchId, projectId, siteId, clientId } = req.body;
    if (!employeeId || !shiftId || !workDate) {
      throw new ValidationError('employeeId, shiftId, and workDate are required.');
    }
    const roster = await timeRepository.createRosterEntry(req.params.companyId, {
      employeeId,
      shiftId,
      workDate,
      branchId,
      projectId,
      siteId,
      clientId,
      actorId: req.body.actorId || 'admin',
    });
    res.status(201).json({ roster });
  } catch (error) {
    next(error);
  }
});

timeRouter.post('/companies/:companyId/rosters/publish', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rosterIds, actorId } = req.body;
    if (!Array.isArray(rosterIds) || rosterIds.length === 0) {
      throw new ValidationError('rosterIds array is required.');
    }
    const result = await timeRepository.publishRoster(req.params.companyId, rosterIds, actorId || 'admin');
    res.json(result);
  } catch (error) {
    next(error);
  }
});

timeRouter.put('/companies/:companyId/rosters/:rosterId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { newShiftId, reason, actorId } = req.body;
    if (!newShiftId || !reason) {
      throw new ValidationError('newShiftId and reason are required.');
    }
    const updated = await timeRepository.updateRosterEntry(req.params.companyId, req.params.rosterId, newShiftId, reason, actorId || 'admin');
    res.json({ roster: updated });
  } catch (error) {
    next(error);
  }
});

// 5. Clock Events (Raw Punches)
timeRouter.get('/companies/:companyId/clock-events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await timeRepository.listClockEvents(req.params.companyId, {
      employeeId: req.query.employeeId as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    });
    res.json({ clockEvents: list });
  } catch (error) {
    next(error);
  }
});

timeRouter.post('/companies/:companyId/clock-events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { employeeId, eventTimestamp, eventType, source, deviceId, branchId, siteId, latitude, longitude, sourceReference, actorId } = req.body;
    if (!employeeId || !eventTimestamp || !eventType) {
      throw new ValidationError('employeeId, eventTimestamp, and eventType are required.');
    }
    const event = await timeRepository.recordClockEvent(req.params.companyId, {
      employeeId,
      eventTimestamp: new Date(eventTimestamp),
      eventType,
      source: source || 'MANUAL',
      deviceId,
      branchId,
      siteId,
      latitude,
      longitude,
      sourceReference,
      actorId: actorId || 'admin',
    });

    const workDate = new Date(eventTimestamp).toISOString().slice(0, 10);
    await timeRepository.processEmployeeDay(req.params.companyId, employeeId, workDate, actorId || 'admin');

    res.status(201).json({ event });
  } catch (error) {
    next(error);
  }
});

timeRouter.post('/companies/:companyId/clock-events/import', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { csvContent, rows, actorId } = req.body;
    let punchRows = rows;
    if (!punchRows && csvContent) {
      punchRows = attendanceImportService.parseCSV(csvContent);
    }
    if (!Array.isArray(punchRows) || punchRows.length === 0) {
      throw new ValidationError('No punch rows found in import data.');
    }

    const result = await attendanceImportService.importPunches(req.params.companyId, punchRows, actorId || 'admin');
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// 6. Attendance Days API
timeRouter.get('/companies/:companyId/attendance-days', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await timeRepository.listAttendanceDays(req.params.companyId, {
      workDate: req.query.workDate as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      branchId: req.query.branchId as string | undefined,
      employeeId: req.query.employeeId as string | undefined,
      status: req.query.status as string | undefined,
      exceptionsOnly: req.query.exceptionsOnly === 'true',
      limit: req.query.limit ? Number(req.query.limit) : 100,
      offset: req.query.offset ? Number(req.query.offset) : 0,
    });
    res.json({ attendanceDays: list });
  } catch (error) {
    next(error);
  }
});

timeRouter.get('/companies/:companyId/attendance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workDate = (req.query.date as string) || (req.query.workDate as string) || new Date().toISOString().slice(0, 10);
    const list = await timeRepository.listAttendanceDays(req.params.companyId, {
      workDate,
      branchId: req.query.branchId as string | undefined,
      employeeId: req.query.employeeId as string | undefined,
      limit: 100,
    });
    res.json({ attendance: list });
  } catch (error) {
    next(error);
  }
});

timeRouter.get('/companies/:companyId/attendance-days/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const detail = await timeRepository.getAttendanceDayDetail(req.params.companyId, req.params.id);
    if (!detail) throw new NotFoundError('Attendance day record', req.params.id);
    res.json({ attendanceDay: detail });
  } catch (error) {
    next(error);
  }
});

timeRouter.post('/companies/:companyId/attendance-days/process', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { workDate, employeeId, actorId } = req.body;
    if (!workDate) throw new ValidationError('workDate is required (YYYY-MM-DD).');

    if (employeeId) {
      const day = await timeRepository.processEmployeeDay(req.params.companyId, employeeId, workDate, actorId || 'admin');
      res.json({ processed: [day] });
    } else {
      const summary = await timeRepository.processDayForTenant(req.params.companyId, workDate, actorId || 'admin');
      res.json(summary);
    }
  } catch (error) {
    next(error);
  }
});

// 7. Exceptions & Corrections
timeRouter.get('/companies/:companyId/attendance-exceptions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await timeRepository.listExceptions(req.params.companyId, {
      status: req.query.status as string | undefined,
      severity: req.query.severity as string | undefined,
      employeeId: req.query.employeeId as string | undefined,
    });
    res.json({ exceptions: list });
  } catch (error) {
    next(error);
  }
});

timeRouter.put('/companies/:companyId/attendance-exceptions/:id/resolve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { resolutionType, notes, actorId } = req.body;
    if (!resolutionType) throw new ValidationError('resolutionType is required.');
    const resolved = await timeRepository.resolveException(req.params.companyId, req.params.id, {
      resolutionType,
      notes,
      actorId: actorId || 'admin',
    });
    res.json({ exception: resolved });
  } catch (error) {
    next(error);
  }
});

timeRouter.get('/companies/:companyId/attendance-corrections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await timeRepository.listCorrections(req.params.companyId);
    res.json({ corrections: list });
  } catch (error) {
    next(error);
  }
});

timeRouter.post('/companies/:companyId/attendance-corrections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { attendanceDayId, requestedFirstIn, requestedLastOut, reason, actorId } = req.body;
    if (!attendanceDayId || !reason) {
      throw new ValidationError('attendanceDayId and reason are required.');
    }
    const correction = await timeRepository.requestCorrection(req.params.companyId, {
      attendanceDayId,
      requestedFirstIn,
      requestedLastOut,
      reason,
      actorId: actorId || 'admin',
    });
    res.status(201).json({ correction });
  } catch (error) {
    next(error);
  }
});

timeRouter.post('/companies/:companyId/attendance-corrections/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { actorId } = req.body;
    const approved = await timeRepository.approveCorrection(req.params.companyId, req.params.id, actorId || 'admin');
    res.json({ correction: approved });
  } catch (error) {
    next(error);
  }
});

// 8. Timesheets API
timeRouter.get('/companies/:companyId/timesheets', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await timeRepository.listTimesheets(req.params.companyId, {
      employeeId: req.query.employeeId as string | undefined,
      status: req.query.status as string | undefined,
      periodStart: req.query.periodStart as string | undefined,
      periodEnd: req.query.periodEnd as string | undefined,
    });
    res.json({ timesheets: list });
  } catch (error) {
    next(error);
  }
});

timeRouter.post('/companies/:companyId/timesheets/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { employeeId, periodStart, periodEnd, actorId } = req.body;
    if (!employeeId || !periodStart || !periodEnd) {
      throw new ValidationError('employeeId, periodStart, and periodEnd are required.');
    }
    const ts = await timeRepository.generateTimesheet(req.params.companyId, {
      employeeId,
      periodStart,
      periodEnd,
      actorId: actorId || 'admin',
    });
    res.status(201).json({ timesheet: ts });
  } catch (error) {
    next(error);
  }
});

timeRouter.get('/companies/:companyId/timesheets/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const detail = await timeRepository.getTimesheetDetail(req.params.companyId, req.params.id);
    if (!detail) throw new NotFoundError('Timesheet', req.params.id);
    res.json({ timesheet: detail });
  } catch (error) {
    next(error);
  }
});

timeRouter.post('/companies/:companyId/timesheets/:id/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { actorId } = req.body;
    const ts = await timeRepository.submitTimesheet(req.params.companyId, req.params.id, actorId || 'admin');
    res.json({ timesheet: ts });
  } catch (error) {
    next(error);
  }
});

timeRouter.post('/companies/:companyId/timesheets/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { actorId } = req.body;
    const ts = await timeRepository.approveTimesheet(req.params.companyId, req.params.id, actorId || 'admin');
    res.json({ timesheet: ts });
  } catch (error) {
    next(error);
  }
});

timeRouter.post('/companies/:companyId/timesheets/:id/lock', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { actorId } = req.body;
    const ts = await timeRepository.lockTimesheet(req.params.companyId, req.params.id, actorId || 'admin');
    res.json({ timesheet: ts });
  } catch (error) {
    next(error);
  }
});

// 9. Overtime API
timeRouter.get('/companies/:companyId/overtime-records', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await timeRepository.listOvertimeRecords(req.params.companyId, {
      employeeId: req.query.employeeId as string | undefined,
      status: req.query.status as string | undefined,
    });
    res.json({ overtimeRecords: list });
  } catch (error) {
    next(error);
  }
});

timeRouter.post('/companies/:companyId/overtime-records/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { actorId } = req.body;
    const ot = await timeRepository.approveOvertimeRecord(req.params.companyId, req.params.id, actorId || 'admin');
    res.json({ overtimeRecord: ot });
  } catch (error) {
    next(error);
  }
});

// 10. Holidays & Calendars API
timeRouter.get('/companies/:companyId/holiday-calendars', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await timeRepository.listHolidayCalendars(req.params.companyId);
    res.json({ holidayCalendars: list });
  } catch (error) {
    next(error);
  }
});

timeRouter.post('/companies/:companyId/holiday-calendars', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cal = await timeRepository.createHolidayCalendar(req.params.companyId, req.body);
    res.status(201).json({ holidayCalendar: cal });
  } catch (error) {
    next(error);
  }
});

timeRouter.get('/companies/:companyId/holidays', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;
    const list = await timeRepository.listHolidays(req.params.companyId, year);
    res.json({ holidays: list });
  } catch (error) {
    next(error);
  }
});

timeRouter.post('/companies/:companyId/holidays', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nameEn, nameAr, holidayDate, holidayCalendarId, holidayType, isPaid, actorId } = req.body;
    if (!nameEn || !nameAr || !holidayDate) {
      throw new ValidationError('nameEn, nameAr, and holidayDate are required.');
    }
    const holiday = await timeRepository.createHoliday(req.params.companyId, {
      nameEn,
      nameAr,
      holidayDate,
      holidayCalendarId,
      holidayType,
      isPaid,
      actorId,
    });
    res.status(201).json({ holiday });
  } catch (error) {
    next(error);
  }
});

// 11. Reports & Exports
timeRouter.get('/companies/:companyId/time/reports/daily', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workDate = (req.query.workDate as string) || new Date().toISOString().slice(0, 10);
    const list = await timeRepository.listAttendanceDays(req.params.companyId, { workDate, limit: 500 });
    res.json({ report: list, workDate });
  } catch (error) {
    next(error);
  }
});

timeRouter.get('/companies/:companyId/time/reports/export-pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workDate = (req.query.workDate as string) || new Date().toISOString().slice(0, 10);
    const company = await companyRepository.getCompanyById(req.params.companyId);
    const days = await timeRepository.listAttendanceDays(req.params.companyId, { workDate, limit: 500 });

    const rows = days.map(d => ({
      employeeNumber: d.employeeNumber,
      employeeName: d.employeeNameEn,
      shiftCode: d.shiftCode || '-',
      firstIn: d.actualFirstIn ? new Date(d.actualFirstIn).toISOString().slice(11, 16) : '-',
      lastOut: d.actualLastOut ? new Date(d.actualLastOut).toISOString().slice(11, 16) : '-',
      workedFormatted: `${Math.floor(d.workedMinutes / 60)}h ${d.workedMinutes % 60}m`,
      status: d.status,
      lateMinutes: d.lateMinutes,
      otMinutes: d.overtimeCandidateMinutes,
    }));

    const pdfBuffer = await timeExportService.generateDailyReportPDF({
      companyName: company?.legalNameEn || 'GULFHIVE ERP',
      workDate,
      rows,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="daily_attendance_${workDate}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

timeRouter.get('/companies/:companyId/time/reports/export-csv', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workDate = (req.query.workDate as string) || new Date().toISOString().slice(0, 10);
    const days = await timeRepository.listAttendanceDays(req.params.companyId, { workDate, limit: 1000 });

    const rows = days.map(d => ({
      employeeNumber: d.employeeNumber,
      employeeName: d.employeeNameEn,
      shiftCode: d.shiftCode || '-',
      firstIn: d.actualFirstIn ? new Date(d.actualFirstIn).toISOString().slice(11, 16) : '',
      lastOut: d.actualLastOut ? new Date(d.actualLastOut).toISOString().slice(11, 16) : '',
      workedFormatted: `${Math.floor(d.workedMinutes / 60)}h ${d.workedMinutes % 60}m`,
      status: d.status,
      lateMinutes: d.lateMinutes,
      otMinutes: d.overtimeCandidateMinutes,
    }));

    const csvData = timeExportService.generateDailyReportCSV(rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendance_${workDate}.csv"`);
    res.send(csvData);
  } catch (error) {
    next(error);
  }
});
