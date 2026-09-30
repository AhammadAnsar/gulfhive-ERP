/**
 * GulfHive ERP - Enterprise Backend Server
 * Express fullstack server with Cloud SQL integration, Firebase Auth, and Vite dev integration.
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { appConfig } from './src/core/config/app-config.ts';
import { logger } from './src/core/logging/logger.ts';
import { db, createPool } from './src/db/index.ts';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import { getOrCreateUser, getUserByUid } from './src/db/users.ts';
import { GULFHIVE_MODULES } from './src/modules/module.manifest.ts';
import { currentRuntime } from './src/infrastructure/runtime/index.ts';
import { companyRepository } from './src/infrastructure/database/repositories/company.repository.ts';
import { peopleRepository } from './src/infrastructure/database/repositories/people.repository.ts';
import { timeRepository } from './src/infrastructure/database/repositories/time.repository.ts';
import { payrollRepository } from './src/infrastructure/database/repositories/payroll.repository.ts';
import { dashboardRepository } from './src/infrastructure/database/repositories/dashboard.repository.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Request logging middleware with correlation IDs (scoped to API routes)
app.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.originalUrl.startsWith('/api')) {
    return next();
  }

  const correlationId = (req.headers['x-correlation-id'] as string) || `req_${Date.now()}`;
  res.setHeader('X-Correlation-ID', correlationId);

  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`, {
      correlationId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
    });
  });
  next();
});

// System Health & Diagnostics API
app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    const pool = createPool();
    res.json({
      status: 'UP',
      app: 'GulfHive ERP',
      deploymentMode: appConfig.deploymentMode,
      timestamp: new Date().toISOString(),
      pool: {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
      },
    });
  } catch (error) {
    logger.error('Health check failed', error);
    res.status(503).json({ status: 'DOWN', error: 'Internal system check failed' });
  }
});

// System Setup Status (Checks if first-run setup wizard is required)
app.get('/api/system/setup-status', async (_req: Request, res: Response) => {
  try {
    const count = await companyRepository.getCompaniesCount();
    const activeTenant = count > 0 ? await companyRepository.getFirstCompany() : null;

    res.json({
      needsSetup: count === 0,
      tenantsCount: count,
      activeTenant,
      deploymentMode: appConfig.deploymentMode,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Failed to query setup status', error);
    res.status(500).json({ error: 'Failed to verify system setup status' });
  }
});

// System Status and Architecture Diagnostics API
app.get('/api/system/status', async (_req: Request, res: Response) => {
  try {
    const runtimeDiagnostics = await currentRuntime.getSystemDiagnostics();
    const companiesCount = await companyRepository.getCompaniesCount();

    res.json({
      application: 'GulfHive ERP',
      deploymentMode: appConfig.deploymentMode,
      defaultCountry: appConfig.defaultCountry,
      defaultCurrency: appConfig.defaultCurrency,
      companiesCount,
      modulesCount: Object.keys(GULFHIVE_MODULES).length,
      modules: Object.values(GULFHIVE_MODULES),
      runtime: runtimeDiagnostics,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('System status retrieval failed', error);
    res.status(500).json({ error: error.message || 'System status unavailable' });
  }
});

// First-Run Company Setup Wizard Creation Endpoint
app.post('/api/setup/company', async (req: Request, res: Response) => {
  try {
    const {
      code,
      legalNameEn,
      legalNameAr,
      tradeNameEn,
      tradeNameAr,
      countryCode,
      baseCurrency,
      crNumber,
      taxNumber,
      fiscalYearStartMonth,
      timezone,
      phone,
      email,
      website,
      addressEn,
      addressAr,
      branchCode,
      branchNameEn,
      branchNameAr,
      cityEn,
      cityAr,
      branchAddressEn,
      branchAddressAr,
      branchPhone,
      adminUid,
      adminEmail,
      adminDisplayName,
    } = req.body;

    if (!code || !legalNameEn || !legalNameAr || !countryCode || !baseCurrency) {
      return res.status(400).json({
        error: 'Missing required company parameters: code, legalNameEn, legalNameAr, countryCode, baseCurrency',
      });
    }

    if (!branchNameEn || !branchNameAr) {
      return res.status(400).json({
        error: 'Missing required main branch parameters: branchNameEn, branchNameAr',
      });
    }

    if (!adminEmail) {
      return res.status(400).json({
        error: 'Administrator email is required.',
      });
    }

    const effectiveAdminUid = adminUid || `admin_${Date.now()}`;

    const result = await companyRepository.createCompanyWithMainBranchAndAdmin({
      code,
      legalNameEn,
      legalNameAr,
      tradeNameEn,
      tradeNameAr,
      countryCode,
      baseCurrency,
      crNumber,
      taxNumber,
      fiscalYearStartMonth: Number(fiscalYearStartMonth) || 1,
      timezone: timezone || 'Asia/Kuwait',
      phone,
      email,
      website,
      addressEn,
      addressAr,
      branchCode: branchCode || 'HQ',
      branchNameEn,
      branchNameAr,
      cityEn,
      cityAr,
      branchAddressEn,
      branchAddressAr,
      branchPhone,
      adminUid: effectiveAdminUid,
      adminEmail,
      adminDisplayName,
    });

    res.status(201).json({
      success: true,
      tenant: result.tenant,
      branch: result.branch,
      user: result.user,
    });
  } catch (error: any) {
    logger.error('Failed to execute company setup wizard', error);
    res.status(400).json({ error: error.message || 'Failed to establish company' });
  }
});

// Companies List API
app.get('/api/companies', async (_req: Request, res: Response) => {
  try {
    const list = await companyRepository.listCompanies();
    res.json({ companies: list });
  } catch (error: any) {
    logger.error('Failed to list companies', error);
    res.status(500).json({ error: 'Failed to retrieve companies' });
  }
});

// Company Details API
app.get('/api/companies/:id', async (req: Request, res: Response) => {
  try {
    const company = await companyRepository.getCompanyById(req.params.id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json({ company });
  } catch (error: any) {
    logger.error('Failed to retrieve company', error);
    res.status(500).json({ error: 'Failed to retrieve company' });
  }
});

// Company Branches List API
app.get('/api/companies/:id/branches', async (req: Request, res: Response) => {
  try {
    const branches = await companyRepository.listBranchesByCompany(req.params.id);
    res.json({ branches });
  } catch (error: any) {
    logger.error('Failed to list branches', error);
    res.status(500).json({ error: 'Failed to retrieve branches' });
  }
});

// Add New Branch API
app.post('/api/companies/:id/branches', async (req: Request, res: Response) => {
  try {
    const { code, nameEn, nameAr, isMain, cityEn, cityAr, addressEn, addressAr, phone, actorId, actorEmail } = req.body;
    if (!code || !nameEn || !nameAr) {
      return res.status(400).json({ error: 'Branch code, nameEn, and nameAr are required.' });
    }

    const branch = await companyRepository.createBranch({
      tenantId: req.params.id,
      code,
      nameEn,
      nameAr,
      isMain,
      cityEn,
      cityAr,
      addressEn,
      addressAr,
      phone,
      actorId: actorId || 'system',
      actorEmail,
    });

    res.status(201).json({ branch });
  } catch (error: any) {
    logger.error('Failed to create branch', error);
    res.status(400).json({ error: error.message || 'Failed to create branch' });
  }
});

// Company Users List API
app.get('/api/companies/:id/users', async (req: Request, res: Response) => {
  try {
    const users = await companyRepository.listCompanyUsers(req.params.id);
    res.json({ users });
  } catch (error: any) {
    logger.error('Failed to list company users', error);
    res.status(500).json({ error: 'Failed to retrieve company users' });
  }
});

// Roles List API (with permissions)
app.get('/api/roles', async (_req: Request, res: Response) => {
  try {
    const roles = await companyRepository.listRoles();
    res.json({ roles });
  } catch (error: any) {
    logger.error('Failed to list roles', error);
    res.status(500).json({ error: 'Failed to retrieve roles' });
  }
});

// Company Audit Logs API
app.get('/api/companies/:id/audit-logs', async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const logs = await companyRepository.listAuditLogs(req.params.id, limit);
    res.json({ logs });
  } catch (error: any) {
    logger.error('Failed to retrieve audit logs', error);
    res.status(500).json({ error: 'Failed to retrieve audit logs' });
  }
});

// --- PEOPLE MODULE APIS ---

// Departments API
app.get('/api/companies/:companyId/departments', async (req: Request, res: Response) => {
  try {
    const list = await peopleRepository.listDepartments(req.params.companyId);
    res.json({ departments: list });
  } catch (error: any) {
    logger.error('Failed to list departments', error);
    res.status(500).json({ error: 'Failed to retrieve departments' });
  }
});

app.post('/api/companies/:companyId/departments', async (req: Request, res: Response) => {
  try {
    const { code, nameEn, nameAr, parentDepartmentId } = req.body;
    if (!code || !nameEn || !nameAr) {
      return res.status(400).json({ error: 'Department code, English name, and Arabic name are required.' });
    }
    const dept = await peopleRepository.createDepartment(req.params.companyId, {
      code,
      nameEn,
      nameAr,
      parentDepartmentId,
    });
    res.status(201).json({ department: dept });
  } catch (error: any) {
    logger.error('Failed to create department', error);
    res.status(400).json({ error: error.message || 'Failed to create department' });
  }
});

// Designations API
app.get('/api/companies/:companyId/designations', async (req: Request, res: Response) => {
  try {
    const list = await peopleRepository.listDesignations(req.params.companyId);
    res.json({ designations: list });
  } catch (error: any) {
    logger.error('Failed to list designations', error);
    res.status(500).json({ error: 'Failed to retrieve designations' });
  }
});

app.post('/api/companies/:companyId/designations', async (req: Request, res: Response) => {
  try {
    const { code, nameEn, nameAr, departmentId, grade } = req.body;
    if (!code || !nameEn || !nameAr) {
      return res.status(400).json({ error: 'Designation code, English name, and Arabic name are required.' });
    }
    const des = await peopleRepository.createDesignation(req.params.companyId, {
      code,
      nameEn,
      nameAr,
      departmentId,
      grade,
    });
    res.status(201).json({ designation: des });
  } catch (error: any) {
    logger.error('Failed to create designation', error);
    res.status(400).json({ error: error.message || 'Failed to create designation' });
  }
});

// Employees API
app.get('/api/companies/:companyId/employees', async (req: Request, res: Response) => {
  try {
    const branchId = req.query.branchId as string | undefined;
    const departmentId = req.query.departmentId as string | undefined;
    const list = await peopleRepository.listEmployees(req.params.companyId, branchId, departmentId);
    res.json({ employees: list });
  } catch (error: any) {
    logger.error('Failed to list employees', error);
    res.status(500).json({ error: 'Failed to retrieve employees' });
  }
});

app.get('/api/companies/:companyId/employees/:employeeId', async (req: Request, res: Response) => {
  try {
    const employee = await peopleRepository.getEmployeeById(req.params.companyId, req.params.employeeId);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json({ employee });
  } catch (error: any) {
    logger.error('Failed to retrieve employee', error);
    res.status(500).json({ error: 'Failed to retrieve employee' });
  }
});

app.post('/api/companies/:companyId/employees', async (req: Request, res: Response) => {
  try {
    const {
      branchId,
      departmentId,
      designationId,
      employeeNumber,
      firstNameEn,
      lastNameEn,
      firstNameAr,
      lastNameAr,
      gender,
      dateOfBirth,
      nationality,
      civilIdNumber,
      passportNumber,
      phone,
      email,
      joiningDate,
      employmentStatus,
      contractType,
      workLocation,
      contractStartDate,
      contractEndDate,
      probationDays,
      noticeDays,
      currency,
      basicSalary,
      housingAllowance,
      transportAllowance,
      otherAllowances,
      bankName,
      bankCode,
      iban,
      accountNumber,
      swiftBic,
      civilIdExpiry,
      passportExpiry,
      actorId,
      actorEmail,
    } = req.body;

    if (!branchId || !employeeNumber || !firstNameEn || !lastNameEn || !firstNameAr || !lastNameAr || !email || !joiningDate || !basicSalary || !currency) {
      return res.status(400).json({
        error: 'Missing required employee fields: branchId, employeeNumber, firstNameEn, lastNameEn, firstNameAr, lastNameAr, email, joiningDate, basicSalary, currency.',
      });
    }

    const employee = await peopleRepository.createEmployee(req.params.companyId, {
      branchId,
      departmentId,
      designationId,
      employeeNumber,
      firstNameEn,
      lastNameEn,
      firstNameAr,
      lastNameAr,
      gender: gender || 'MALE',
      dateOfBirth,
      nationality: nationality || 'Kuwaiti',
      civilIdNumber,
      passportNumber,
      phone,
      email,
      joiningDate,
      employmentStatus,
      contractType,
      workLocation,
      contractStartDate,
      contractEndDate,
      probationDays: Number(probationDays) || 90,
      noticeDays: Number(noticeDays) || 90,
      currency,
      basicSalary,
      housingAllowance,
      transportAllowance,
      otherAllowances,
      bankName,
      bankCode,
      iban,
      accountNumber,
      swiftBic,
      civilIdExpiry,
      passportExpiry,
      actorId: actorId || 'admin',
      actorEmail: actorEmail || 'admin@gulfhive.internal',
    });

    res.status(201).json({ employee });
  } catch (error: any) {
    logger.error('Failed to create employee', error);
    res.status(400).json({ error: error.message || 'Failed to create employee' });
  }
});

// Delete Employee API
app.delete('/api/companies/:companyId/employees/:employeeId', async (req: Request, res: Response) => {
  try {
    const result = await peopleRepository.deleteEmployee(req.params.companyId, req.params.employeeId);
    res.json(result);
  } catch (error: any) {
    logger.error('Failed to delete employee', error);
    res.status(400).json({ error: error.message || 'Failed to delete employee' });
  }
});

// Employee Documents API
app.post('/api/companies/:companyId/employees/:employeeId/documents', async (req: Request, res: Response) => {
  try {
    const { documentType, documentNumber, issueDate, expiryDate, issuingAuthority, issuingCountry, notes } = req.body;
    if (!documentType || !documentNumber || !expiryDate) {
      return res.status(400).json({ error: 'documentType, documentNumber, and expiryDate are required.' });
    }
    const doc = await peopleRepository.addEmployeeDocument(req.params.companyId, req.params.employeeId, {
      documentType,
      documentNumber,
      issueDate,
      expiryDate,
      issuingAuthority,
      issuingCountry,
      notes,
    });
    res.status(201).json({ document: doc });
  } catch (error: any) {
    logger.error('Failed to add document', error);
    res.status(400).json({ error: error.message || 'Failed to add document' });
  }
});

// Expiring Documents Central Monitoring API
app.get('/api/companies/:companyId/expiring-documents', async (req: Request, res: Response) => {
  try {
    const daysAhead = Number(req.query.daysAhead) || 60;
    const docs = await peopleRepository.listExpiringDocuments(req.params.companyId, daysAhead);
    res.json({ documents: docs });
  } catch (error: any) {
    logger.error('Failed to retrieve expiring documents', error);
    res.status(500).json({ error: 'Failed to retrieve expiring documents' });
  }
});

// --- TIME MODULE APIS ---

// Shifts API
app.get('/api/companies/:companyId/shifts', async (req: Request, res: Response) => {
  try {
    const list = await timeRepository.listShifts(req.params.companyId);
    res.json({ shifts: list });
  } catch (error: any) {
    logger.error('Failed to list shifts', error);
    res.status(500).json({ error: 'Failed to retrieve shifts' });
  }
});

app.post('/api/companies/:companyId/shifts', async (req: Request, res: Response) => {
  try {
    const { code, nameEn, nameAr, startTime, endTime, breakDurationMinutes, gracePeriodMinutes, isOvernight } = req.body;
    if (!code || !nameEn || !nameAr || !startTime || !endTime) {
      return res.status(400).json({ error: 'code, nameEn, nameAr, startTime, and endTime are required.' });
    }
    const shift = await timeRepository.createShift(req.params.companyId, {
      code,
      nameEn,
      nameAr,
      startTime,
      endTime,
      breakDurationMinutes: Number(breakDurationMinutes) || 60,
      gracePeriodMinutes: Number(gracePeriodMinutes) || 15,
      isOvernight: !!isOvernight,
    });
    res.status(201).json({ shift });
  } catch (error: any) {
    logger.error('Failed to create shift', error);
    res.status(400).json({ error: error.message || 'Failed to create shift' });
  }
});

// Rosters API
app.get('/api/companies/:companyId/rosters', async (req: Request, res: Response) => {
  try {
    const branchId = req.query.branchId as string | undefined;
    const employeeId = req.query.employeeId as string | undefined;
    const list = await timeRepository.listRosters(req.params.companyId, branchId, employeeId);
    res.json({ rosters: list });
  } catch (error: any) {
    logger.error('Failed to list rosters', error);
    res.status(500).json({ error: 'Failed to retrieve rosters' });
  }
});

app.post('/api/companies/:companyId/rosters', async (req: Request, res: Response) => {
  try {
    const { employeeId, shiftId, branchId, startDate, endDate, notes } = req.body;
    if (!employeeId || !shiftId || !startDate || !endDate) {
      return res.status(400).json({ error: 'employeeId, shiftId, startDate, and endDate are required.' });
    }
    const roster = await timeRepository.createRosterAssignment(req.params.companyId, {
      employeeId,
      shiftId,
      branchId,
      startDate,
      endDate,
      notes,
    });
    res.status(201).json({ roster });
  } catch (error: any) {
    logger.error('Failed to create roster assignment', error);
    res.status(400).json({ error: error.message || 'Failed to create roster' });
  }
});

// Attendance API
app.get('/api/companies/:companyId/attendance', async (req: Request, res: Response) => {
  try {
    const date = req.query.date as string | undefined;
    const branchId = req.query.branchId as string | undefined;
    const list = await timeRepository.listAttendance(req.params.companyId, date, branchId);
    res.json({ attendance: list });
  } catch (error: any) {
    logger.error('Failed to list attendance', error);
    res.status(500).json({ error: 'Failed to retrieve attendance' });
  }
});

app.post('/api/companies/:companyId/attendance/check-in', async (req: Request, res: Response) => {
  try {
    const { employeeId, branchId, date, checkInTime, shiftId, source } = req.body;
    if (!employeeId || !date) {
      return res.status(400).json({ error: 'employeeId and date are required.' });
    }
    const rec = await timeRepository.recordCheckIn(req.params.companyId, {
      employeeId,
      branchId,
      date,
      checkInTime,
      shiftId,
      source: source || 'WEB',
    });
    res.status(201).json({ record: rec });
  } catch (error: any) {
    logger.error('Failed to record check-in', error);
    res.status(400).json({ error: error.message || 'Failed to record check-in' });
  }
});

app.post('/api/companies/:companyId/attendance/:id/check-out', async (req: Request, res: Response) => {
  try {
    const { checkOutTime } = req.body;
    const rec = await timeRepository.recordCheckOut(req.params.companyId, req.params.id, checkOutTime);
    res.json({ record: rec });
  } catch (error: any) {
    logger.error('Failed to record check-out', error);
    res.status(400).json({ error: error.message || 'Failed to record check-out' });
  }
});

// Attendance Corrections API
app.get('/api/companies/:companyId/attendance-corrections', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const list = await timeRepository.listCorrections(req.params.companyId, status);
    res.json({ corrections: list });
  } catch (error: any) {
    logger.error('Failed to list attendance corrections', error);
    res.status(500).json({ error: 'Failed to retrieve corrections' });
  }
});

app.post('/api/companies/:companyId/attendance-corrections', async (req: Request, res: Response) => {
  try {
    const { attendanceId, employeeId, requestedCheckIn, requestedCheckOut, reason, actorId } = req.body;
    if (!attendanceId || !employeeId || !reason) {
      return res.status(400).json({ error: 'attendanceId, employeeId, and reason are required.' });
    }
    const correction = await timeRepository.requestAttendanceCorrection(req.params.companyId, {
      attendanceId,
      employeeId,
      requestedCheckIn,
      requestedCheckOut,
      reason,
      actorId: actorId || 'admin',
    });
    res.status(201).json({ correction });
  } catch (error: any) {
    logger.error('Failed to submit attendance correction', error);
    res.status(400).json({ error: error.message || 'Failed to submit correction' });
  }
});

app.post('/api/companies/:companyId/attendance-corrections/:id/review', async (req: Request, res: Response) => {
  try {
    const { decision, reviewerId, notes } = req.body;
    if (!decision || (decision !== 'APPROVED' && decision !== 'REJECTED')) {
      return res.status(400).json({ error: 'decision must be APPROVED or REJECTED.' });
    }
    const result = await timeRepository.reviewCorrection(
      req.params.companyId,
      req.params.id,
      decision,
      reviewerId || 'admin',
      notes
    );
    res.json({ correction: result });
  } catch (error: any) {
    logger.error('Failed to review correction', error);
    res.status(400).json({ error: error.message || 'Failed to review correction' });
  }
});

// Holidays API
app.get('/api/companies/:companyId/holidays', async (req: Request, res: Response) => {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;
    const list = await timeRepository.listHolidays(req.params.companyId, year);
    res.json({ holidays: list });
  } catch (error: any) {
    logger.error('Failed to list holidays', error);
    res.status(500).json({ error: 'Failed to retrieve holidays' });
  }
});

app.post('/api/companies/:companyId/holidays', async (req: Request, res: Response) => {
  try {
    const { countryCode, nameEn, nameAr, startDate, endDate, daysCount, isRecurring, year } = req.body;
    if (!countryCode || !nameEn || !nameAr || !startDate || !endDate) {
      return res.status(400).json({ error: 'countryCode, nameEn, nameAr, startDate, and endDate are required.' });
    }
    const holiday = await timeRepository.createHoliday(req.params.companyId, {
      countryCode,
      nameEn,
      nameAr,
      startDate,
      endDate,
      daysCount,
      isRecurring,
      year,
    });
    res.status(201).json({ holiday });
  } catch (error: any) {
    logger.error('Failed to create holiday', error);
    res.status(400).json({ error: error.message || 'Failed to create holiday' });
  }
});

// Leave Types & Requests API
app.get('/api/companies/:companyId/leave-types', async (req: Request, res: Response) => {
  try {
    const list = await timeRepository.listLeaveTypes(req.params.companyId);
    res.json({ leaveTypes: list });
  } catch (error: any) {
    logger.error('Failed to list leave types', error);
    res.status(500).json({ error: 'Failed to retrieve leave types' });
  }
});

app.get('/api/companies/:companyId/leave-requests', async (req: Request, res: Response) => {
  try {
    const employeeId = req.query.employeeId as string | undefined;
    const status = req.query.status as string | undefined;
    const list = await timeRepository.listLeaveRequests(req.params.companyId, employeeId, status);
    res.json({ leaveRequests: list });
  } catch (error: any) {
    logger.error('Failed to list leave requests', error);
    res.status(500).json({ error: 'Failed to retrieve leave requests' });
  }
});

app.post('/api/companies/:companyId/leave-requests', async (req: Request, res: Response) => {
  try {
    const { employeeId, leaveTypeId, startDate, endDate, daysRequested, reason, actorId, actorEmail } = req.body;
    if (!employeeId || !leaveTypeId || !startDate || !endDate || !daysRequested) {
      return res.status(400).json({ error: 'employeeId, leaveTypeId, startDate, endDate, and daysRequested are required.' });
    }
    const request = await timeRepository.createLeaveRequest(req.params.companyId, {
      employeeId,
      leaveTypeId,
      startDate,
      endDate,
      daysRequested: Number(daysRequested),
      reason,
      actorId: actorId || 'admin',
      actorEmail: actorEmail || 'admin@gulfhive.internal',
    });
    res.status(201).json({ request });
  } catch (error: any) {
    logger.error('Failed to create leave request', error);
    res.status(400).json({ error: error.message || 'Failed to create leave request' });
  }
});

app.post('/api/companies/:companyId/leave-requests/:id/review', async (req: Request, res: Response) => {
  try {
    const { decision, reviewerId, notes } = req.body;
    if (!decision || (decision !== 'APPROVED' && decision !== 'REJECTED')) {
      return res.status(400).json({ error: 'decision must be APPROVED or REJECTED.' });
    }
    const request = await timeRepository.reviewLeaveRequest(
      req.params.companyId,
      req.params.id,
      decision,
      reviewerId || 'admin',
      notes
    );
    res.json({ request });
  } catch (error: any) {
    logger.error('Failed to review leave request', error);
    res.status(400).json({ error: error.message || 'Failed to review leave request' });
  }
});

// Overtime API
app.get('/api/companies/:companyId/overtime', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const list = await timeRepository.listOvertimeRecords(req.params.companyId, status);
    res.json({ overtimeRecords: list });
  } catch (error: any) {
    logger.error('Failed to list overtime', error);
    res.status(500).json({ error: 'Failed to retrieve overtime' });
  }
});

app.post('/api/companies/:companyId/overtime', async (req: Request, res: Response) => {
  try {
    const { employeeId, attendanceId, date, overtimeType, minutes, countryCode, reason, actorId } = req.body;
    if (!employeeId || !date || !overtimeType || !minutes) {
      return res.status(400).json({ error: 'employeeId, date, overtimeType, and minutes are required.' });
    }
    const ot = await timeRepository.createOvertimeRecord(req.params.companyId, {
      employeeId,
      attendanceId,
      date,
      overtimeType,
      minutes: Number(minutes),
      countryCode,
      reason,
      actorId: actorId || 'admin',
    });
    res.status(201).json({ overtime: ot });
  } catch (error: any) {
    logger.error('Failed to create overtime record', error);
    res.status(400).json({ error: error.message || 'Failed to create overtime' });
  }
});

app.post('/api/companies/:companyId/overtime/:id/review', async (req: Request, res: Response) => {
  try {
    const { decision, reviewerId, notes } = req.body;
    if (!decision || (decision !== 'APPROVED' && decision !== 'REJECTED')) {
      return res.status(400).json({ error: 'decision must be APPROVED or REJECTED.' });
    }
    const ot = await timeRepository.reviewOvertimeRecord(
      req.params.companyId,
      req.params.id,
      decision,
      reviewerId || 'admin',
      notes
    );
    res.json({ overtime: ot });
  } catch (error: any) {
    logger.error('Failed to review overtime', error);
    res.status(400).json({ error: error.message || 'Failed to review overtime' });
  }
});

// Approval History API (Reusable Workflow Engine)
app.get('/api/companies/:companyId/approvals/:entityType/:entityId', async (req: Request, res: Response) => {
  try {
    const history = await timeRepository.listApprovalHistory(
      req.params.companyId,
      req.params.entityType,
      req.params.entityId
    );
    res.json({ history });
  } catch (error: any) {
    logger.error('Failed to list approval history', error);
    res.status(500).json({ error: 'Failed to retrieve approval history' });
  }
});

// --- DASHBOARD SUMMARY API ---
app.get('/api/companies/:companyId/dashboard', async (req: Request, res: Response) => {
  try {
    const branchId = req.query.branchId as string | undefined;
    const summary = await dashboardRepository.getDashboardSummary(req.params.companyId, branchId);
    res.json({ summary });
  } catch (error: any) {
    logger.error('Failed to retrieve dashboard summary', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve dashboard summary' });
  }
});

// --- PAYROLL MODULE APIS ---

// List Payroll Runs
app.get('/api/companies/:companyId/payroll/runs', async (req: Request, res: Response) => {
  try {
    const list = await payrollRepository.listPayrollRuns(req.params.companyId);
    res.json({ runs: list });
  } catch (error: any) {
    logger.error('Failed to list payroll runs', error);
    res.status(500).json({ error: 'Failed to retrieve payroll runs' });
  }
});

// Get Single Run with Items
app.get('/api/companies/:companyId/payroll/runs/:id', async (req: Request, res: Response) => {
  try {
    const run = await payrollRepository.getPayrollRun(req.params.companyId, req.params.id);
    if (!run) return res.status(404).json({ error: 'Payroll run not found' });
    res.json({ run });
  } catch (error: any) {
    logger.error('Failed to get payroll run', error);
    res.status(500).json({ error: 'Failed to retrieve payroll run' });
  }
});

// Calculate & Generate Payroll Run
app.post('/api/companies/:companyId/payroll/calculate', async (req: Request, res: Response) => {
  try {
    const { month, year, actorId } = req.body;
    if (!month || !year) {
      return res.status(400).json({ error: 'month and year are required.' });
    }
    const result = await payrollRepository.calculateAndCreatePayrollRun(
      req.params.companyId,
      Number(month),
      Number(year),
      actorId || 'admin'
    );
    res.status(201).json({ result });
  } catch (error: any) {
    logger.error('Failed to calculate payroll', error);
    res.status(400).json({ error: error.message || 'Failed to calculate payroll' });
  }
});

// Validate Payroll Run
app.post('/api/companies/:companyId/payroll/runs/:id/validate', async (req: Request, res: Response) => {
  try {
    const validation = await payrollRepository.validatePayrollRun(req.params.companyId, req.params.id);
    res.json({ validation });
  } catch (error: any) {
    logger.error('Failed to validate payroll run', error);
    res.status(400).json({ error: error.message || 'Failed to validate payroll run' });
  }
});

// Approve Payroll Run
app.post('/api/companies/:companyId/payroll/runs/:id/approve', async (req: Request, res: Response) => {
  try {
    const { approverId } = req.body;
    const run = await payrollRepository.approvePayrollRun(req.params.companyId, req.params.id, approverId || 'admin');
    res.json({ run });
  } catch (error: any) {
    logger.error('Failed to approve payroll run', error);
    res.status(400).json({ error: error.message || 'Failed to approve payroll run' });
  }
});

// Export WPS / SIF File
app.get('/api/companies/:companyId/payroll/runs/:id/export/wps', async (req: Request, res: Response) => {
  try {
    const sifData = await payrollRepository.exportWpsSif(req.params.companyId, req.params.id);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="WPS_SIF_${req.params.id}.sif"`);
    res.send(sifData);
  } catch (error: any) {
    logger.error('Failed to export WPS SIF', error);
    res.status(400).json({ error: error.message || 'Failed to export WPS SIF' });
  }
});

// Export Excel CSV
app.get('/api/companies/:companyId/payroll/runs/:id/export/excel', async (req: Request, res: Response) => {
  try {
    const csvData = await payrollRepository.exportExcelCsv(req.params.companyId, req.params.id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="Payroll_Sheet_${req.params.id}.csv"`);
    res.send(csvData);
  } catch (error: any) {
    logger.error('Failed to export Excel report', error);
    res.status(400).json({ error: error.message || 'Failed to export Excel report' });
  }
});

// Employee Loans API
app.get('/api/companies/:companyId/loans', async (req: Request, res: Response) => {
  try {
    const employeeId = req.query.employeeId as string | undefined;
    const list = await payrollRepository.listLoans(req.params.companyId, employeeId);
    res.json({ loans: list });
  } catch (error: any) {
    logger.error('Failed to list loans', error);
    res.status(500).json({ error: 'Failed to retrieve loans' });
  }
});

app.post('/api/companies/:companyId/loans', async (req: Request, res: Response) => {
  try {
    const { employeeId, loanAmount, monthlyInstallment, currency, disbursementDate, notes } = req.body;
    if (!employeeId || !loanAmount || !monthlyInstallment || !disbursementDate) {
      return res.status(400).json({ error: 'employeeId, loanAmount, monthlyInstallment, and disbursementDate are required.' });
    }
    const loan = await payrollRepository.createLoan(req.params.companyId, {
      employeeId,
      loanAmount,
      monthlyInstallment,
      currency: currency || 'KWD',
      disbursementDate,
      notes,
    });
    res.status(201).json({ loan });
  } catch (error: any) {
    logger.error('Failed to create loan', error);
    res.status(400).json({ error: error.message || 'Failed to create loan' });
  }
});

// Final Settlements / Indemnity API
app.get('/api/companies/:companyId/final-settlements', async (req: Request, res: Response) => {
  try {
    const list = await payrollRepository.listFinalSettlements(req.params.companyId);
    res.json({ settlements: list });
  } catch (error: any) {
    logger.error('Failed to list settlements', error);
    res.status(500).json({ error: 'Failed to retrieve final settlements' });
  }
});

app.post('/api/companies/:companyId/final-settlements/calculate', async (req: Request, res: Response) => {
  try {
    const { employeeId, contractType, terminationType, lastWorkingDate, accruedLeaveDays, unpaidSalaryDays, actorId } = req.body;
    if (!employeeId || !contractType || !terminationType || !lastWorkingDate) {
      return res.status(400).json({ error: 'employeeId, contractType, terminationType, and lastWorkingDate are required.' });
    }
    const settlement = await payrollRepository.calculateAndCreateFinalSettlement(req.params.companyId, {
      employeeId,
      contractType,
      terminationType,
      lastWorkingDate,
      accruedLeaveDays: Number(accruedLeaveDays) || 0,
      unpaidSalaryDays: Number(unpaidSalaryDays) || 0,
      actorId: actorId || 'admin',
    });
    res.status(201).json({ settlement });
  } catch (error: any) {
    logger.error('Failed to calculate final settlement', error);
    res.status(400).json({ error: error.message || 'Failed to calculate settlement' });
  }
});

app.post('/api/companies/:companyId/final-settlements/:id/approve', async (req: Request, res: Response) => {
  try {
    const { approverId } = req.body;
    const settlement = await payrollRepository.approveFinalSettlement(req.params.companyId, req.params.id, approverId || 'admin');
    res.json({ settlement });
  } catch (error: any) {
    logger.error('Failed to approve final settlement', error);
    res.status(400).json({ error: error.message || 'Failed to approve settlement' });
  }
});

// Authenticated user profile endpoint
app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    const email = req.user?.email || '';
    if (!uid) {
      return res.status(401).json({ error: 'Unauthorized: Missing UID' });
    }

    const user = await getOrCreateUser(uid, email, req.user?.name);
    res.json({ user });
  } catch (error: any) {
    logger.error('Failed to resolve authenticated user profile', error);
    res.status(500).json({ error: 'Failed to synchronize user session' });
  }
});

// 404 Handler for undefined API routes
app.all('/api/*', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Global API Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled server exception', err);
  const status = err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
  });
});

// Start Server & integrate Vite dev or static files
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, () => {
    logger.info(`GulfHive ERP server running on port ${PORT} [Mode: ${appConfig.deploymentMode}]`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    logger.error('Fatal server startup failure', err);
    process.exit(1);
  });
}

export { app };
