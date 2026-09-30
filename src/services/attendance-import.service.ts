/**
 * GulfHive ERP - Authoritative Attendance Import Service
 * 
 * Supports CSV and Excel attendance punch log imports.
 * - Resolves employeeCode securely to internal employeeId within the company context.
 * - Enforces company isolation (rejects employees from foreign companies).
 * - Detects duplicate clock events and flags them.
 * - Appends raw events immutably to clock_events table.
 * - Triggers attendance processor for affected work dates.
 */

import { timeRepository } from '../infrastructure/database/repositories/time.repository.ts';
import { peopleRepository } from '../infrastructure/database/repositories/people.repository.ts';
import { logger } from '../core/logging/logger.ts';

export interface ImportPunchRow {
  employeeCode: string;
  timestamp: string; // ISO string or "YYYY-MM-DD HH:mm:ss"
  eventType: 'IN' | 'OUT' | 'BREAK_START' | 'BREAK_END';
  source?: string;
  deviceId?: string;
  branchCode?: string;
  sourceReference?: string;
}

export interface ImportResult {
  totalRows: number;
  importedCount: number;
  duplicateCount: number;
  errorCount: number;
  errors: Array<{ rowNumber: number; employeeCode?: string; message: string }>;
  affectedDates: string[];
}

export class AttendanceImportService {
  /**
   * Parse CSV string into array of punch records.
   */
  public parseCSV(csvContent: string): ImportPunchRow[] {
    const lines = csvContent.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length <= 1) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''));
    const rows: ImportPunchRow[] = [];

    const codeIdx = headers.findIndex(h => h.includes('code') || h.includes('emp') || h.includes('badge'));
    const timeIdx = headers.findIndex(h => h.includes('time') || h.includes('date'));
    const typeIdx = headers.findIndex(h => h.includes('type') || h.includes('event'));
    const deviceIdx = headers.findIndex(h => h.includes('device') || h.includes('terminal'));
    const branchIdx = headers.findIndex(h => h.includes('branch'));
    const refIdx = headers.findIndex(h => h.includes('ref'));

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim());
      if (parts.length === 0 || !parts[0]) continue;

      const employeeCode = codeIdx >= 0 ? parts[codeIdx] : parts[0];
      const timestamp = timeIdx >= 0 ? parts[timeIdx] : parts[1];
      const rawType = (typeIdx >= 0 ? parts[typeIdx] : parts[2] || 'IN').toUpperCase();

      let eventType: ImportPunchRow['eventType'] = 'IN';
      if (rawType.includes('OUT')) eventType = 'OUT';
      else if (rawType.includes('BREAK_START') || rawType.includes('BREAK_OUT')) eventType = 'BREAK_START';
      else if (rawType.includes('BREAK_END') || rawType.includes('BREAK_IN')) eventType = 'BREAK_END';

      rows.push({
        employeeCode,
        timestamp,
        eventType,
        deviceId: deviceIdx >= 0 ? parts[deviceIdx] : undefined,
        branchCode: branchIdx >= 0 ? parts[branchIdx] : undefined,
        sourceReference: refIdx >= 0 ? parts[refIdx] : undefined,
      });
    }

    return rows;
  }

  /**
   * Import punches for a tenant.
   */
  public async importPunches(tenantId: string, rows: ImportPunchRow[], actorId = 'system'): Promise<ImportResult> {
    const errors: ImportResult['errors'] = [];
    const affectedDatesSet = new Set<string>();
    let importedCount = 0;
    let duplicateCount = 0;

    // Cache employee code lookup for this tenant
    const employeeList = await peopleRepository.listEmployees(tenantId, {});
    const employeeMap = new Map<string, { id: string; branchId: string }>();
    for (const emp of employeeList) {
      employeeMap.set(emp.employeeNumber.toUpperCase().trim(), { id: emp.id, branchId: emp.branchId });
      if (emp.email) employeeMap.set(emp.email.toLowerCase().trim(), { id: emp.id, branchId: emp.branchId });
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      if (!row.employeeCode) {
        errors.push({ rowNumber: rowNum, message: 'Missing employee code' });
        continue;
      }

      const empData = employeeMap.get(row.employeeCode.toUpperCase().trim()) || employeeMap.get(row.employeeCode.toLowerCase().trim());
      if (!empData) {
        errors.push({ rowNumber: rowNum, employeeCode: row.employeeCode, message: `Unknown employee code: "${row.employeeCode}" in this company` });
        continue;
      }

      const eventDate = new Date(row.timestamp);
      if (isNaN(eventDate.getTime())) {
        errors.push({ rowNumber: rowNum, employeeCode: row.employeeCode, message: `Invalid timestamp format: "${row.timestamp}"` });
        continue;
      }

      const dateStr = eventDate.toISOString().slice(0, 10);
      affectedDatesSet.add(dateStr);

      try {
        const result = await timeRepository.recordClockEvent(tenantId, {
          employeeId: empData.id,
          eventTimestamp: eventDate,
          eventType: row.eventType,
          source: 'EXCEL_IMPORT',
          deviceId: row.deviceId,
          branchId: empData.branchId,
          sourceReference: row.sourceReference,
          actorId,
        });

        if (result.isDuplicate) {
          duplicateCount++;
        } else {
          importedCount++;
        }
      } catch (err: any) {
        errors.push({ rowNumber: rowNum, employeeCode: row.employeeCode, message: err.message || 'Failed to record clock event' });
      }
    }

    const affectedDates = Array.from(affectedDatesSet);

    // Auto-reprocess affected dates for tenant
    for (const date of affectedDates) {
      try {
        await timeRepository.processDayForTenant(tenantId, date, actorId);
      } catch (procErr) {
        logger.error(`Error auto-processing attendance for date ${date}:`, procErr);
      }
    }

    return {
      totalRows: rows.length,
      importedCount,
      duplicateCount,
      errorCount: errors.length,
      errors,
      affectedDates,
    };
  }
}

export const attendanceImportService = new AttendanceImportService();
