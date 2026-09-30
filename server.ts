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
import { masterDataRepository } from './src/infrastructure/database/repositories/master-data.repository.ts';
import { numberingRepository } from './src/infrastructure/database/repositories/numbering.repository.ts';
import { authRepository } from './src/infrastructure/database/repositories/auth.repository.ts';
import { salesRepository } from './src/infrastructure/database/repositories/sales.repository.ts';
import { procurementRepository } from './src/infrastructure/database/repositories/procurement.repository.ts';
import { projectsRepository } from './src/infrastructure/database/repositories/projects.repository.ts';
import { salesDocumentService } from './src/services/sales-document.service.ts';
import { procurementDocumentService } from './src/services/procurement-document.service.ts';
import { pdfGeneratorService } from './src/services/pdf-generator.service.ts';
import { attendanceImportService } from './src/services/attendance-import.service.ts';
import { timeExportService } from './src/services/time-export.service.ts';
import { authenticateToken, requirePermission, requireCompanyAccess } from './src/core/security/auth.middleware.ts';
import { MigrationRunner } from './src/infrastructure/database/migrations/migration-runner.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// CORS & Preflight Handling for hosted and separate-origin deployments
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Correlation-ID, X-Requested-With, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

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
app.get(['/api/system/setup-status', '/api/setup/status'], async (_req: Request, res: Response) => {
  try {
    const count = await companyRepository.getCompaniesCount();
    const activeTenant = count > 0 ? await companyRepository.getFirstCompany() : null;

    res.json({
      success: true,
      needsSetup: count === 0,
      tenantsCount: count,
      activeTenant,
      deploymentMode: appConfig.deploymentMode,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Failed to query setup status', error);
    res.status(500).json({ success: false, error: 'Failed to verify system setup status', code: 'SETUP_STATUS_ERROR' });
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

// First-Run Company Setup Wizard Creation Endpoint (supports both /api/setup/company and /api/setup/establish)
app.post(['/api/setup/company', '/api/setup/establish'], async (req: Request, res: Response) => {
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
        success: false,
        error: 'Missing required company parameters: code, legalNameEn, legalNameAr, countryCode, baseCurrency',
        code: 'VALIDATION_ERROR',
      });
    }

    if (!branchNameEn || !branchNameAr) {
      return res.status(400).json({
        success: false,
        error: 'Missing required main branch parameters: branchNameEn, branchNameAr',
        code: 'VALIDATION_ERROR',
      });
    }

    if (!adminEmail) {
      return res.status(400).json({
        success: false,
        error: 'Administrator email is required.',
        code: 'VALIDATION_ERROR',
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
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to establish company',
      code: 'COMPANY_SETUP_FAILED',
    });
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
    const branches = await masterDataRepository.listBranches(req.params.id);
    res.json({ branches });
  } catch (error: any) {
    logger.error('Failed to list branches', error);
    res.status(500).json({ error: 'Failed to retrieve branches' });
  }
});

// Add New Branch API
app.post('/api/companies/:id/branches', async (req: Request, res: Response) => {
  try {
    const { code, nameEn, nameAr, isMain, cityEn, cityAr, addressEn, addressAr, phone, actorId } = req.body;
    if (!code || !nameEn || !nameAr) {
      return res.status(400).json({ error: 'Branch code, nameEn, and nameAr are required.' });
    }

    const branch = await masterDataRepository.createBranch(req.params.id, {
      code,
      nameEn,
      nameAr,
      isMain,
      cityEn,
      cityAr,
      addressEn,
      addressAr,
      phone,
    }, actorId || 'system');

    res.status(201).json({ branch });
  } catch (error: any) {
    logger.error('Failed to create branch', error);
    res.status(400).json({ error: error.message || 'Failed to create branch' });
  }
});

app.put('/api/companies/:companyId/branches/:id', async (req: Request, res: Response) => {
  try {
    const updated = await masterDataRepository.updateBranch(req.params.companyId, req.params.id, req.body, req.body.actorId || 'system');
    res.json({ branch: updated });
  } catch (error: any) {
    logger.error('Failed to update branch', error);
    res.status(400).json({ error: error.message || 'Failed to update branch' });
  }
});

app.delete('/api/companies/:companyId/branches/:id', async (req: Request, res: Response) => {
  try {
    const result = await masterDataRepository.deleteBranch(req.params.companyId, req.params.id);
    res.json(result);
  } catch (error: any) {
    logger.error('Failed to delete branch', error);
    res.status(400).json({ error: error.message || 'Failed to delete branch' });
  }
});

// --- MASTER DATA APIS ---

// Departments APIs
app.get('/api/companies/:companyId/departments', async (req: Request, res: Response) => {
  try {
    const list = await masterDataRepository.listDepartments(req.params.companyId);
    res.json({ departments: list });
  } catch (error: any) {
    logger.error('Failed to list departments', error);
    res.status(500).json({ error: 'Failed to retrieve departments' });
  }
});

app.post('/api/companies/:companyId/departments', async (req: Request, res: Response) => {
  try {
    const { code, nameEn, nameAr, parentDepartmentId, isActive, actorId } = req.body;
    if (!code || !nameEn || !nameAr) {
      return res.status(400).json({ error: 'code, nameEn, and nameAr are required.' });
    }
    const dept = await masterDataRepository.createDepartment(req.params.companyId, {
      code,
      nameEn,
      nameAr,
      parentDepartmentId,
      isActive,
    }, actorId || 'system');
    res.status(201).json({ department: dept });
  } catch (error: any) {
    logger.error('Failed to create department', error);
    res.status(400).json({ error: error.message || 'Failed to create department' });
  }
});

app.put('/api/companies/:companyId/departments/:id', async (req: Request, res: Response) => {
  try {
    const updated = await masterDataRepository.updateDepartment(req.params.companyId, req.params.id, req.body, req.body.actorId || 'system');
    res.json({ department: updated });
  } catch (error: any) {
    logger.error('Failed to update department', error);
    res.status(400).json({ error: error.message || 'Failed to update department' });
  }
});

app.delete('/api/companies/:companyId/departments/:id', async (req: Request, res: Response) => {
  try {
    const result = await masterDataRepository.deleteDepartment(req.params.companyId, req.params.id);
    res.json(result);
  } catch (error: any) {
    logger.error('Failed to delete department', error);
    res.status(400).json({ error: error.message || 'Failed to delete department' });
  }
});

// Designations APIs
app.get('/api/companies/:companyId/designations', async (req: Request, res: Response) => {
  try {
    const list = await masterDataRepository.listDesignations(req.params.companyId);
    res.json({ designations: list });
  } catch (error: any) {
    logger.error('Failed to list designations', error);
    res.status(500).json({ error: 'Failed to retrieve designations' });
  }
});

app.post('/api/companies/:companyId/designations', async (req: Request, res: Response) => {
  try {
    const { code, nameEn, nameAr, departmentId, descriptionEn, descriptionAr, grade, isActive, actorId } = req.body;
    if (!code || !nameEn || !nameAr) {
      return res.status(400).json({ error: 'code, nameEn, and nameAr are required.' });
    }
    const desig = await masterDataRepository.createDesignation(req.params.companyId, {
      code,
      nameEn,
      nameAr,
      departmentId,
      descriptionEn,
      descriptionAr,
      grade,
      isActive,
    }, actorId || 'system');
    res.status(201).json({ designation: desig });
  } catch (error: any) {
    logger.error('Failed to create designation', error);
    res.status(400).json({ error: error.message || 'Failed to create designation' });
  }
});

app.put('/api/companies/:companyId/designations/:id', async (req: Request, res: Response) => {
  try {
    const updated = await masterDataRepository.updateDesignation(req.params.companyId, req.params.id, req.body, req.body.actorId || 'system');
    res.json({ designation: updated });
  } catch (error: any) {
    logger.error('Failed to update designation', error);
    res.status(400).json({ error: error.message || 'Failed to update designation' });
  }
});

app.delete('/api/companies/:companyId/designations/:id', async (req: Request, res: Response) => {
  try {
    const result = await masterDataRepository.deleteDesignation(req.params.companyId, req.params.id);
    res.json(result);
  } catch (error: any) {
    logger.error('Failed to delete designation', error);
    res.status(400).json({ error: error.message || 'Failed to delete designation' });
  }
});

// Employee Categories APIs
app.get('/api/companies/:companyId/employee-categories', async (req: Request, res: Response) => {
  try {
    const list = await masterDataRepository.listEmployeeCategories(req.params.companyId);
    res.json({ employeeCategories: list });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve employee categories' });
  }
});

app.post('/api/companies/:companyId/employee-categories', async (req: Request, res: Response) => {
  try {
    const category = await masterDataRepository.createEmployeeCategory(req.params.companyId, req.body, req.body.actorId || 'system');
    res.status(201).json({ employeeCategory: category });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create employee category' });
  }
});

app.put('/api/companies/:companyId/employee-categories/:id', async (req: Request, res: Response) => {
  try {
    const category = await masterDataRepository.updateEmployeeCategory(req.params.companyId, req.params.id, req.body, req.body.actorId || 'system');
    res.json({ employeeCategory: category });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update employee category' });
  }
});

app.delete('/api/companies/:companyId/employee-categories/:id', async (req: Request, res: Response) => {
  try {
    const result = await masterDataRepository.deleteEmployeeCategory(req.params.companyId, req.params.id);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to delete employee category' });
  }
});

// Business Units APIs
app.get('/api/companies/:companyId/business-units', async (req: Request, res: Response) => {
  try {
    const list = await masterDataRepository.listBusinessUnits(req.params.companyId);
    res.json({ businessUnits: list });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve business units' });
  }
});

app.post('/api/companies/:companyId/business-units', async (req: Request, res: Response) => {
  try {
    const bu = await masterDataRepository.createBusinessUnit(req.params.companyId, req.body, req.body.actorId || 'system');
    res.status(201).json({ businessUnit: bu });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create business unit' });
  }
});

app.put('/api/companies/:companyId/business-units/:id', async (req: Request, res: Response) => {
  try {
    const bu = await masterDataRepository.updateBusinessUnit(req.params.companyId, req.params.id, req.body, req.body.actorId || 'system');
    res.json({ businessUnit: bu });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update business unit' });
  }
});

app.delete('/api/companies/:companyId/business-units/:id', async (req: Request, res: Response) => {
  try {
    const result = await masterDataRepository.deleteBusinessUnit(req.params.companyId, req.params.id);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to delete business unit' });
  }
});

// Cost Centers APIs
app.get('/api/companies/:companyId/cost-centers', async (req: Request, res: Response) => {
  try {
    const list = await masterDataRepository.listCostCenters(req.params.companyId);
    res.json({ costCenters: list });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve cost centers' });
  }
});

app.post('/api/companies/:companyId/cost-centers', async (req: Request, res: Response) => {
  try {
    const cc = await masterDataRepository.createCostCenter(req.params.companyId, req.body, req.body.actorId || 'system');
    res.status(201).json({ costCenter: cc });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create cost center' });
  }
});

app.put('/api/companies/:companyId/cost-centers/:id', async (req: Request, res: Response) => {
  try {
    const cc = await masterDataRepository.updateCostCenter(req.params.companyId, req.params.id, req.body, req.body.actorId || 'system');
    res.json({ costCenter: cc });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update cost center' });
  }
});

app.delete('/api/companies/:companyId/cost-centers/:id', async (req: Request, res: Response) => {
  try {
    const result = await masterDataRepository.deleteCostCenter(req.params.companyId, req.params.id);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to delete cost center' });
  }
});

// Fiscal Years APIs
app.get('/api/companies/:companyId/fiscal-years', async (req: Request, res: Response) => {
  try {
    const list = await masterDataRepository.listFiscalYears(req.params.companyId);
    res.json({ fiscalYears: list });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve fiscal years' });
  }
});

app.post('/api/companies/:companyId/fiscal-years', async (req: Request, res: Response) => {
  try {
    const fy = await masterDataRepository.createFiscalYear(req.params.companyId, req.body, req.body.actorId || 'system');
    res.status(201).json({ fiscalYear: fy });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create fiscal year' });
  }
});

app.put('/api/companies/:companyId/fiscal-years/:id', async (req: Request, res: Response) => {
  try {
    const fy = await masterDataRepository.updateFiscalYear(req.params.companyId, req.params.id, req.body, req.body.actorId || 'system');
    res.json({ fiscalYear: fy });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update fiscal year' });
  }
});

app.delete('/api/companies/:companyId/fiscal-years/:id', async (req: Request, res: Response) => {
  try {
    const result = await masterDataRepository.deleteFiscalYear(req.params.companyId, req.params.id);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to delete fiscal year' });
  }
});

// System Reference Data APIs
app.get('/api/master/currencies', async (_req: Request, res: Response) => {
  try {
    const list = await masterDataRepository.listCurrencies();
    res.json({ currencies: list });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve currencies' });
  }
});

app.get('/api/master/countries', async (_req: Request, res: Response) => {
  try {
    const list = await masterDataRepository.listCountries();
    res.json({ countries: list });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve countries' });
  }
});

app.get('/api/master/nationalities', async (_req: Request, res: Response) => {
  try {
    const list = await masterDataRepository.listNationalities();
    res.json({ nationalities: list });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve nationalities' });
  }
});

// Banks APIs
app.get('/api/companies/:companyId/banks', async (req: Request, res: Response) => {
  try {
    const list = await masterDataRepository.listBanks(req.params.companyId);
    res.json({ banks: list });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve banks' });
  }
});

app.post('/api/companies/:companyId/banks', async (req: Request, res: Response) => {
  try {
    const bank = await masterDataRepository.createBank(req.params.companyId, req.body, req.body.actorId || 'system');
    res.status(201).json({ bank });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create bank' });
  }
});

app.put('/api/companies/:companyId/banks/:id', async (req: Request, res: Response) => {
  try {
    const bank = await masterDataRepository.updateBank(req.params.companyId, req.params.id, req.body, req.body.actorId || 'system');
    res.json({ bank });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update bank' });
  }
});

app.delete('/api/companies/:companyId/banks/:id', async (req: Request, res: Response) => {
  try {
    const result = await masterDataRepository.deleteBank(req.params.companyId, req.params.id);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to delete bank' });
  }
});

// Payment Methods APIs
app.get('/api/companies/:companyId/payment-methods', async (req: Request, res: Response) => {
  try {
    const list = await masterDataRepository.listPaymentMethods(req.params.companyId);
    res.json({ paymentMethods: list });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve payment methods' });
  }
});

app.post('/api/companies/:companyId/payment-methods', async (req: Request, res: Response) => {
  try {
    const pm = await masterDataRepository.createPaymentMethod(req.params.companyId, req.body, req.body.actorId || 'system');
    res.status(201).json({ paymentMethod: pm });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create payment method' });
  }
});

app.put('/api/companies/:companyId/payment-methods/:id', async (req: Request, res: Response) => {
  try {
    const pm = await masterDataRepository.updatePaymentMethod(req.params.companyId, req.params.id, req.body, req.body.actorId || 'system');
    res.json({ paymentMethod: pm });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update payment method' });
  }
});

app.delete('/api/companies/:companyId/payment-methods/:id', async (req: Request, res: Response) => {
  try {
    const result = await masterDataRepository.deletePaymentMethod(req.params.companyId, req.params.id);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to delete payment method' });
  }
});

// Document Types APIs
app.get('/api/companies/:companyId/document-types', async (req: Request, res: Response) => {
  try {
    const list = await masterDataRepository.listDocumentTypes(req.params.companyId);
    res.json({ documentTypes: list });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve document types' });
  }
});

app.post('/api/companies/:companyId/document-types', async (req: Request, res: Response) => {
  try {
    const docType = await masterDataRepository.createDocumentType(req.params.companyId, req.body, req.body.actorId || 'system');
    res.status(201).json({ documentType: docType });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create document type' });
  }
});

app.put('/api/companies/:companyId/document-types/:id', async (req: Request, res: Response) => {
  try {
    const docType = await masterDataRepository.updateDocumentType(req.params.companyId, req.params.id, req.body, req.body.actorId || 'system');
    res.json({ documentType: docType });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update document type' });
  }
});

app.delete('/api/companies/:companyId/document-types/:id', async (req: Request, res: Response) => {
  try {
    const result = await masterDataRepository.deleteDocumentType(req.params.companyId, req.params.id);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to delete document type' });
  }
});

// Numbering Engine APIs
app.get('/api/companies/:companyId/numbering', async (req: Request, res: Response) => {
  try {
    const list = await numberingRepository.listSequences(req.params.companyId);
    res.json({ sequences: list });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve document sequences' });
  }
});

app.post('/api/companies/:companyId/numbering', async (req: Request, res: Response) => {
  try {
    const seq = await numberingRepository.upsertSequence(req.params.companyId, req.body, req.body.actorId || 'system');
    res.json({ sequence: seq });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to configure document sequence' });
  }
});

app.post('/api/companies/:companyId/numbering/preview', async (req: Request, res: Response) => {
  try {
    const preview = await numberingRepository.previewNumber(req.params.companyId, req.body);
    res.json(preview);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to preview document number' });
  }
});

app.post('/api/companies/:companyId/numbering/generate', async (req: Request, res: Response) => {
  try {
    const { documentType, branchId, fiscalYearId } = req.body;
    if (!documentType) {
      return res.status(400).json({ error: 'documentType is required.' });
    }
    const number = await numberingRepository.generateNextNumber(req.params.companyId, documentType, branchId, fiscalYearId);
    res.json({ number });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to generate document number' });
  }
});

// --- AUTHENTICATION & IDENTITY APIS ---

app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username/Email and Password are required.' });
    }
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Browser';
    const result = await authRepository.login(username, password, ipAddress, userAgent);
    res.json(result);
  } catch (error: any) {
    logger.warn('Login attempt failed:', error.message);
    res.status(401).json({ error: error.message || 'Authentication failed' });
  }
});

app.post('/api/auth/logout', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers['authorization'];
    const customHeader = req.headers['x-session-token'] as string;
    const token = customHeader || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null);
    if (token && token.includes(':')) {
      const [sessionId] = token.split(':');
      await authRepository.revokeSession(sessionId, req.user?.displayName || 'user');
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    res.json({ user: req.user });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve authenticated user context' });
  }
});

// --- USER MANAGEMENT APIS ---

app.get('/api/companies/:companyId/users', authenticateToken, requireCompanyAccess, requirePermission('users.view'), async (req: Request, res: Response) => {
  try {
    const usersList = await authRepository.listUsers(req.params.companyId);
    res.json({ users: usersList });
  } catch (error: any) {
    logger.error('Failed to list company users', error);
    res.status(500).json({ error: 'Failed to retrieve company users' });
  }
});

app.post('/api/companies/:companyId/users', authenticateToken, requireCompanyAccess, requirePermission('users.manage'), async (req: Request, res: Response) => {
  try {
    const { email, username, phone, password, displayName, roleIds, defaultBranchId, employeeId, preferredLanguage, status } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    // Self-escalation prevention: Non-admins cannot assign COMPANY_ADMIN role
    if (roleIds && roleIds.includes('role_company_admin') && !req.user?.roles.includes('COMPANY_ADMIN') && !req.user?.roles.includes('SUPER_ADMIN')) {
      return res.status(403).json({ error: 'Self-Escalation Prevention: Only Company Administrators can grant the Administrator role.' });
    }

    const newUser = await authRepository.createUser(
      req.params.companyId,
      {
        email,
        username,
        phone,
        password,
        displayName,
        defaultBranchId,
        employeeId,
        preferredLanguage,
        status,
      },
      roleIds || ['role_viewer'],
      req.user?.displayName || 'system'
    );

    res.status(201).json({ user: newUser });
  } catch (error: any) {
    logger.error('Failed to create user', error);
    res.status(400).json({ error: error.message || 'Failed to create user' });
  }
});

app.put('/api/companies/:companyId/users/:id', authenticateToken, requireCompanyAccess, requirePermission('users.manage'), async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.id);
    const { displayName, phone, preferredLanguage, defaultBranchId, employeeId, status, roleIds, companyIds, branchIds } = req.body;

    if (roleIds && roleIds.includes('role_company_admin') && !req.user?.roles.includes('COMPANY_ADMIN') && !req.user?.roles.includes('SUPER_ADMIN')) {
      return res.status(403).json({ error: 'Self-Escalation Prevention: Only Company Administrators can grant the Administrator role.' });
    }

    const updated = await authRepository.updateUser(
      userId,
      { displayName, phone, preferredLanguage, defaultBranchId, employeeId, status },
      roleIds,
      companyIds,
      branchIds,
      req.user?.displayName || 'system'
    );

    res.json({ user: updated });
  } catch (error: any) {
    logger.error('Failed to update user', error);
    res.status(400).json({ error: error.message || 'Failed to update user' });
  }
});

app.post('/api/companies/:companyId/users/:id/reset-password', authenticateToken, requireCompanyAccess, requirePermission('users.manage'), async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.id);
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }
    const result = await authRepository.resetUserPassword(userId, newPassword, req.user?.displayName || 'system');
    res.json(result);
  } catch (error: any) {
    logger.error('Failed to reset user password', error);
    res.status(400).json({ error: error.message || 'Failed to reset password' });
  }
});

// --- ROLES & PERMISSIONS APIS ---

app.get('/api/companies/:companyId/roles', authenticateToken, requireCompanyAccess, requirePermission('roles.view'), async (req: Request, res: Response) => {
  try {
    const rolesList = await authRepository.listRoles(req.params.companyId);
    res.json({ roles: rolesList });
  } catch (error: any) {
    logger.error('Failed to list roles', error);
    res.status(500).json({ error: 'Failed to retrieve roles' });
  }
});

app.post('/api/companies/:companyId/roles', authenticateToken, requireCompanyAccess, requirePermission('roles.manage'), async (req: Request, res: Response) => {
  try {
    const { code, nameEn, nameAr, descriptionEn, descriptionAr, permissionIds } = req.body;
    if (!code || !nameEn || !nameAr) {
      return res.status(400).json({ error: 'code, nameEn, and nameAr are required.' });
    }
    const newRole = await authRepository.createRole(
      req.params.companyId,
      { code, nameEn, nameAr, descriptionEn, descriptionAr, permissionIds },
      req.user?.displayName || 'system'
    );
    res.status(201).json({ role: newRole });
  } catch (error: any) {
    logger.error('Failed to create role', error);
    res.status(400).json({ error: error.message || 'Failed to create role' });
  }
});

app.put('/api/companies/:companyId/roles/:id', authenticateToken, requireCompanyAccess, requirePermission('roles.manage'), async (req: Request, res: Response) => {
  try {
    const updated = await authRepository.updateRole(req.params.id, req.body, req.user?.displayName || 'system');
    res.json({ role: updated });
  } catch (error: any) {
    logger.error('Failed to update role', error);
    res.status(400).json({ error: error.message || 'Failed to update role' });
  }
});

app.post('/api/companies/:companyId/roles/:id/archive', authenticateToken, requireCompanyAccess, requirePermission('roles.manage'), async (req: Request, res: Response) => {
  try {
    const result = await authRepository.archiveRole(req.params.id, req.user?.displayName || 'system');
    res.json(result);
  } catch (error: any) {
    logger.error('Failed to archive role', error);
    res.status(400).json({ error: error.message || 'Failed to archive role' });
  }
});

app.get('/api/permissions', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const list = await authRepository.listPermissions();
    res.json({ permissions: list });
  } catch (error: any) {
    logger.error('Failed to list permissions', error);
    res.status(500).json({ error: 'Failed to retrieve permissions' });
  }
});

// --- SESSIONS & SECURITY AUDIT APIS ---

app.get('/api/companies/:companyId/sessions', authenticateToken, requireCompanyAccess, requirePermission('users.manage'), async (_req: Request, res: Response) => {
  try {
    const sessionsList = await authRepository.listActiveSessions();
    res.json({ sessions: sessionsList });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to list active sessions' });
  }
});

app.post('/api/companies/:companyId/sessions/:id/revoke', authenticateToken, requireCompanyAccess, requirePermission('users.manage'), async (req: Request, res: Response) => {
  try {
    await authRepository.revokeSession(req.params.id, req.user?.displayName || 'system');
    res.json({ success: true, revokedId: req.params.id });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to revoke session' });
  }
});

app.get('/api/companies/:companyId/login-events', authenticateToken, requireCompanyAccess, requirePermission('audit.view'), async (_req: Request, res: Response) => {
  try {
    const events = await authRepository.listLoginEvents();
    res.json({ events });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to list login events' });
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
    const filters = {
      branchId: req.query.branchId as string | undefined,
      departmentId: req.query.departmentId as string | undefined,
      designationId: req.query.designationId as string | undefined,
      employeeCategoryId: req.query.employeeCategoryId as string | undefined,
      businessUnitId: req.query.businessUnitId as string | undefined,
      costCenterId: req.query.costCenterId as string | undefined,
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
      nationality: req.query.nationality as string | undefined,
    };
    const list = await peopleRepository.listEmployees(req.params.companyId, filters);
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

    // Sensitive Field Permission Protection
    const hideSalary = req.headers['x-hide-salary'] === 'true';
    const hideBank = req.headers['x-hide-bank'] === 'true';

    const safeEmployee = {
      ...employee,
      salaries: hideSalary ? [] : employee.salaries,
      bankDetails: hideBank ? null : employee.bankDetails,
      bankAccounts: hideBank ? [] : employee.bankAccounts,
    };

    res.json({ employee: safeEmployee });
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
      employeeCategoryId,
      businessUnitId,
      costCenterId,
      nationalityId,
      managerEmployeeId,
      userId,
      employeeNumber,
      firstNameEn,
      middleNameEn,
      lastNameEn,
      firstNameAr,
      middleNameAr,
      lastNameAr,
      gender,
      dateOfBirth,
      maritalStatus,
      nationality,
      civilIdNumber,
      passportNumber,
      workEmail,
      personalEmail,
      workPhone,
      personalPhone,
      phone,
      email,
      addressEn,
      addressAr,
      joiningDate,
      employmentStatus,
      contractType,
      workLocation,
      photoPath,
      avatarUrl,
      contractStartDate,
      contractEndDate,
      probationDays,
      noticeDays,
      workingDaysPerWeek,
      workingHoursPerDay,
      currency,
      basicSalary,
      housingAllowance,
      transportAllowance,
      foodAllowance,
      otherAllowances,
      bankId,
      bankName,
      bankCode,
      accountName,
      iban,
      accountNumber,
      swiftBic,
      civilIdExpiry,
      passportExpiry,
      emergencyContactName,
      emergencyContactRelationship,
      emergencyContactPhone,
      actorId,
      actorEmail,
    } = req.body;

    if (!branchId || !firstNameEn || !lastNameEn || !firstNameAr || !lastNameAr || !email || !joiningDate || !basicSalary) {
      return res.status(400).json({
        error: 'Missing required employee fields: branchId, firstNameEn, lastNameEn, firstNameAr, lastNameAr, email, joiningDate, basicSalary.',
      });
    }

    const employee = await peopleRepository.createEmployee(req.params.companyId, {
      branchId,
      departmentId,
      designationId,
      employeeCategoryId,
      businessUnitId,
      costCenterId,
      nationalityId: nationalityId ? Number(nationalityId) : undefined,
      managerEmployeeId,
      userId: userId ? Number(userId) : undefined,
      employeeNumber,
      firstNameEn,
      middleNameEn,
      lastNameEn,
      firstNameAr,
      middleNameAr,
      lastNameAr,
      gender: gender || 'MALE',
      dateOfBirth,
      maritalStatus: maritalStatus || 'SINGLE',
      nationality: nationality || 'Kuwaiti',
      civilIdNumber,
      passportNumber,
      workEmail,
      personalEmail,
      workPhone,
      personalPhone,
      phone,
      email,
      addressEn,
      addressAr,
      joiningDate,
      employmentStatus: employmentStatus || 'ACTIVE',
      contractType: contractType || 'UNLIMITED',
      workLocation,
      photoPath,
      avatarUrl,
      contractStartDate,
      contractEndDate,
      probationDays: probationDays ? Number(probationDays) : 90,
      noticeDays: noticeDays ? Number(noticeDays) : 90,
      workingDaysPerWeek: workingDaysPerWeek ? Number(workingDaysPerWeek) : 5,
      workingHoursPerDay: workingHoursPerDay ? Number(workingHoursPerDay) : 8,
      currency: currency || 'KWD',
      basicSalary,
      housingAllowance,
      transportAllowance,
      foodAllowance,
      otherAllowances,
      bankId,
      bankName,
      bankCode,
      accountName,
      iban,
      accountNumber,
      swiftBic,
      civilIdExpiry,
      passportExpiry,
      emergencyContactName,
      emergencyContactRelationship,
      emergencyContactPhone,
      actorId: actorId || 'admin',
      actorEmail: actorEmail || 'admin@gulfhive.internal',
    });

    res.status(201).json({ employee });
  } catch (error: any) {
    logger.error('Failed to create employee', error);
    res.status(400).json({ error: error.message || 'Failed to create employee' });
  }
});

app.put('/api/companies/:companyId/employees/:employeeId', async (req: Request, res: Response) => {
  try {
    const updated = await peopleRepository.updateEmployee(req.params.companyId, req.params.employeeId, {
      ...req.body,
      actorId: req.body.actorId || 'admin',
      actorEmail: req.body.actorEmail || 'admin@gulfhive.internal',
    });
    res.json({ employee: updated });
  } catch (error: any) {
    logger.error('Failed to update employee', error);
    res.status(400).json({ error: error.message || 'Failed to update employee' });
  }
});

app.post('/api/companies/:companyId/employees/:employeeId/archive', async (req: Request, res: Response) => {
  try {
    const { actorId, actorEmail } = req.body;
    const result = await peopleRepository.archiveEmployee(req.params.companyId, req.params.employeeId, actorId || 'admin', actorEmail);
    res.json({ employee: result });
  } catch (error: any) {
    logger.error('Failed to archive employee', error);
    res.status(400).json({ error: error.message || 'Failed to archive employee' });
  }
});

// Delete Employee API
app.delete('/api/companies/:companyId/employees/:employeeId', async (req: Request, res: Response) => {
  try {
    const actorId = (req.query.actorId as string) || 'admin';
    const result = await peopleRepository.deleteEmployee(req.params.companyId, req.params.employeeId, actorId);
    res.json(result);
  } catch (error: any) {
    logger.error('Failed to delete employee', error);
    res.status(400).json({ error: error.message || 'Failed to delete employee' });
  }
});

// Employee Bulk Delete Preflight Inspection API
app.post('/api/companies/:companyId/employees/bulk-delete/preflight', async (req: Request, res: Response) => {
  try {
    const { employeeIds, allFiltered, filterCriteria } = req.body;
    const preflight = await peopleRepository.preflightBulkDelete(req.params.companyId, {
      employeeIds,
      allFiltered,
      filterCriteria,
    });
    res.json(preflight);
  } catch (error: any) {
    logger.error('Failed to execute bulk delete preflight', error);
    res.status(400).json({ error: error.message || 'Failed to execute preflight check' });
  }
});

// Employee Centralized Bulk Delete / Archive Execution API
app.post('/api/companies/:companyId/employees/bulk-delete', async (req: Request, res: Response) => {
  try {
    const { employeeIds, allFiltered, filterCriteria, action, actorId, actorEmail } = req.body;
    const result = await peopleRepository.bulkDeleteEmployees(req.params.companyId, {
      employeeIds,
      allFiltered,
      filterCriteria,
      action: action || 'DELETE',
      actorId: actorId || 'admin',
      actorEmail: actorEmail || 'admin@gulfhive.internal',
    });
    res.json(result);
  } catch (error: any) {
    logger.error('Failed to execute bulk delete', error);
    res.status(400).json({ error: error.message || 'Bulk delete failed' });
  }
});

// Employee Centralized Bulk Archive API
app.post('/api/companies/:companyId/employees/bulk-archive', async (req: Request, res: Response) => {
  try {
    const { employeeIds, allFiltered, filterCriteria, actorId, actorEmail } = req.body;
    const result = await peopleRepository.bulkDeleteEmployees(req.params.companyId, {
      employeeIds,
      allFiltered,
      filterCriteria,
      action: 'ARCHIVE',
      actorId: actorId || 'admin',
      actorEmail: actorEmail || 'admin@gulfhive.internal',
    });
    res.json(result);
  } catch (error: any) {
    logger.error('Failed to execute bulk archive', error);
    res.status(400).json({ error: error.message || 'Bulk archive failed' });
  }
});

// Employee Contracts API
app.post('/api/companies/:companyId/employees/:employeeId/contracts', async (req: Request, res: Response) => {
  try {
    const { contractType, startDate, endDate, probationDays, noticeDays, workingDaysPerWeek, workingHoursPerDay, terms, documentAttachmentId, actorId } = req.body;
    if (!contractType || !startDate) {
      return res.status(400).json({ error: 'contractType and startDate are required.' });
    }
    const contract = await peopleRepository.addContract(req.params.companyId, req.params.employeeId, {
      contractType,
      startDate,
      endDate,
      probationDays: probationDays ? Number(probationDays) : undefined,
      noticeDays: noticeDays ? Number(noticeDays) : undefined,
      workingDaysPerWeek: workingDaysPerWeek ? Number(workingDaysPerWeek) : undefined,
      workingHoursPerDay: workingHoursPerDay ? Number(workingHoursPerDay) : undefined,
      terms,
      documentAttachmentId,
      actorId: actorId || 'admin',
    });
    res.status(201).json({ contract });
  } catch (error: any) {
    logger.error('Failed to add contract', error);
    res.status(400).json({ error: error.message || 'Failed to add contract' });
  }
});

// Employee Salary Revision API
app.post('/api/companies/:companyId/employees/:employeeId/salaries', async (req: Request, res: Response) => {
  try {
    const { currency, basicSalary, housingAllowance, transportAllowance, foodAllowance, otherAllowances, effectiveDate, actorId } = req.body;
    if (!basicSalary || !effectiveDate) {
      return res.status(400).json({ error: 'basicSalary and effectiveDate are required.' });
    }
    const salary = await peopleRepository.addSalaryAssignment(req.params.companyId, req.params.employeeId, {
      currency: currency || 'KWD',
      basicSalary,
      housingAllowance,
      transportAllowance,
      foodAllowance,
      otherAllowances,
      effectiveDate,
      actorId: actorId || 'admin',
    });
    res.status(201).json({ salary });
  } catch (error: any) {
    logger.error('Failed to add salary assignment', error);
    res.status(400).json({ error: error.message || 'Failed to add salary assignment' });
  }
});

// Employee Bank Accounts API
app.post('/api/companies/:companyId/employees/:employeeId/bank-accounts', async (req: Request, res: Response) => {
  try {
    const { bankId, bankName, bankCode, accountName, iban, accountNumber, swiftBic, currency, isPrimary, actorId } = req.body;
    if (!bankName || !iban || !accountNumber) {
      return res.status(400).json({ error: 'bankName, iban, and accountNumber are required.' });
    }
    const bankAccount = await peopleRepository.addBankAccount(req.params.companyId, req.params.employeeId, {
      bankId,
      bankName,
      bankCode,
      accountName,
      iban,
      accountNumber,
      swiftBic,
      currency,
      isPrimary,
      actorId: actorId || 'admin',
    });
    res.status(201).json({ bankAccount });
  } catch (error: any) {
    logger.error('Failed to add bank account', error);
    res.status(400).json({ error: error.message || 'Failed to add bank account' });
  }
});

// Employee Documents API
app.post('/api/companies/:companyId/employees/:employeeId/documents', async (req: Request, res: Response) => {
  try {
    const { documentTypeId, documentType, documentNumber, issueDate, expiryDate, issuingAuthority, issuingCountry, attachmentUrl, fileName, notes, actorId } = req.body;
    if (!documentType || !documentNumber || !expiryDate) {
      return res.status(400).json({ error: 'documentType, documentNumber, and expiryDate are required.' });
    }
    const doc = await peopleRepository.addEmployeeDocument(req.params.companyId, req.params.employeeId, {
      documentTypeId,
      documentType,
      documentNumber,
      issueDate,
      expiryDate,
      issuingAuthority,
      issuingCountry,
      attachmentUrl,
      fileName,
      notes,
      actorId: actorId || 'admin',
    });
    res.status(201).json({ document: doc });
  } catch (error: any) {
    logger.error('Failed to add document', error);
    res.status(400).json({ error: error.message || 'Failed to add document' });
  }
});

// Emergency Contacts API
app.post('/api/companies/:companyId/employees/:employeeId/emergency-contacts', async (req: Request, res: Response) => {
  try {
    const { name, relationship, phone, alternatePhone, isPrimary, actorId } = req.body;
    if (!name || !relationship || !phone) {
      return res.status(400).json({ error: 'name, relationship, and phone are required.' });
    }
    const contact = await peopleRepository.addEmergencyContact(req.params.companyId, req.params.employeeId, name, relationship, phone, alternatePhone, isPrimary, actorId || 'admin');
    res.status(201).json({ contact });
  } catch (error: any) {
    logger.error('Failed to add emergency contact', error);
    res.status(400).json({ error: error.message || 'Failed to add emergency contact' });
  }
});

// Dependents API
app.post('/api/companies/:companyId/employees/:employeeId/dependents', async (req: Request, res: Response) => {
  try {
    const { nameEn, nameAr, relationship, dateOfBirth, nationalityId, documentNumber, actorId } = req.body;
    if (!nameEn || !nameAr || !relationship) {
      return res.status(400).json({ error: 'nameEn, nameAr, and relationship are required.' });
    }
    const dependent = await peopleRepository.addDependent(req.params.companyId, req.params.employeeId, nameEn, nameAr, relationship, dateOfBirth, nationalityId, documentNumber, actorId || 'admin');
    res.status(201).json({ dependent });
  } catch (error: any) {
    logger.error('Failed to add dependent', error);
    res.status(400).json({ error: error.message || 'Failed to add dependent' });
  }
});

// Employee ID Card PDF Generation API
app.get('/api/companies/:companyId/employees/:employeeId/id-card', async (req: Request, res: Response) => {
  try {
    const employee = await peopleRepository.getEmployeeById(req.params.companyId, req.params.employeeId);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const company = await companyRepository.getCompanyById(req.params.companyId);

    const pdfBuffer = await pdfGeneratorService.generateIDCard({
      employeeNumber: employee.employeeNumber,
      firstNameEn: employee.firstNameEn,
      lastNameEn: employee.lastNameEn,
      firstNameAr: employee.firstNameAr,
      lastNameAr: employee.lastNameAr,
      designationEn: employee.designationNameEn || undefined,
      designationAr: employee.designationNameAr || undefined,
      departmentEn: employee.departmentNameEn || undefined,
      departmentAr: employee.departmentNameAr || undefined,
      branchNameEn: employee.branchNameEn || undefined,
      civilIdNumber: employee.civilIdNumber || undefined,
      joiningDate: employee.joiningDate ? new Date(employee.joiningDate).toISOString() : undefined,
      companyNameEn: company?.legalNameEn || 'GULFHIVE ERP',
      companyNameAr: company?.legalNameAr || 'جلف هايف',
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="id_card_${employee.employeeNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    logger.error('Failed to generate employee ID card PDF', error);
    res.status(500).json({ error: 'Failed to generate ID card PDF' });
  }
});

// Employee Profile PDF Generation API
app.get('/api/companies/:companyId/employees/:employeeId/profile-pdf', async (req: Request, res: Response) => {
  try {
    const employee = await peopleRepository.getEmployeeById(req.params.companyId, req.params.employeeId);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const company = await companyRepository.getCompanyById(req.params.companyId);

    const pdfBuffer = await pdfGeneratorService.generateProfilePDF({
      ...employee,
      companyNameEn: company?.legalNameEn || 'GULFHIVE ERP',
      companyNameAr: company?.legalNameAr || 'جلف هايف',
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="employee_profile_${employee.employeeNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    logger.error('Failed to generate employee profile PDF', error);
    res.status(500).json({ error: 'Failed to generate profile PDF' });
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

// 1. Work Schedules & Break Policies
app.get('/api/companies/:companyId/work-schedules', async (req: Request, res: Response) => {
  try {
    const list = await timeRepository.listWorkSchedules(req.params.companyId);
    res.json({ schedules: list });
  } catch (error: any) {
    logger.error('Failed to list work schedules', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve work schedules' });
  }
});

app.post('/api/companies/:companyId/work-schedules', async (req: Request, res: Response) => {
  try {
    const schedule = await timeRepository.createWorkSchedule(req.params.companyId, req.body);
    res.status(201).json({ schedule });
  } catch (error: any) {
    logger.error('Failed to create work schedule', error);
    res.status(400).json({ error: error.message || 'Failed to create work schedule' });
  }
});

app.get('/api/companies/:companyId/break-policies', async (req: Request, res: Response) => {
  try {
    const list = await timeRepository.listBreakPolicies(req.params.companyId);
    res.json({ policies: list });
  } catch (error: any) {
    logger.error('Failed to list break policies', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve break policies' });
  }
});

app.post('/api/companies/:companyId/break-policies', async (req: Request, res: Response) => {
  try {
    const policy = await timeRepository.createBreakPolicy(req.params.companyId, req.body);
    res.status(201).json({ policy });
  } catch (error: any) {
    logger.error('Failed to create break policy', error);
    res.status(400).json({ error: error.message || 'Failed to create break policy' });
  }
});

// 2. Shifts API
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
    const { code, nameEn, nameAr, startTime, endTime, breakDurationMinutes, gracePeriodMinutes, isOvernight, crossesMidnight } = req.body;
    if (!code || !nameEn || !nameAr || !startTime || !endTime) {
      return res.status(400).json({ error: 'code, nameEn, nameAr, startTime, and endTime are required.' });
    }
    const shift = await timeRepository.createShift(req.params.companyId, {
      ...req.body,
      breakDurationMinutes: breakDurationMinutes ? Number(breakDurationMinutes) : 60,
      gracePeriodMinutes: gracePeriodMinutes ? Number(gracePeriodMinutes) : 15,
      crossesMidnight: crossesMidnight !== undefined ? !!crossesMidnight : undefined,
    });
    res.status(201).json({ shift });
  } catch (error: any) {
    logger.error('Failed to create shift', error);
    res.status(400).json({ error: error.message || 'Failed to create shift' });
  }
});

app.put('/api/companies/:companyId/shifts/:shiftId', async (req: Request, res: Response) => {
  try {
    const updated = await timeRepository.updateShift(req.params.companyId, req.params.shiftId, req.body);
    res.json({ shift: updated });
  } catch (error: any) {
    logger.error('Failed to update shift', error);
    res.status(400).json({ error: error.message || 'Failed to update shift' });
  }
});

app.delete('/api/companies/:companyId/shifts/:shiftId', async (req: Request, res: Response) => {
  try {
    const result = await timeRepository.deleteShift(req.params.companyId, req.params.shiftId, req.body.actorId);
    res.json(result);
  } catch (error: any) {
    logger.error('Failed to delete shift', error);
    res.status(400).json({ error: error.message || 'Failed to delete shift' });
  }
});

// 3. Shift Patterns API
app.get('/api/companies/:companyId/shift-patterns', async (req: Request, res: Response) => {
  try {
    const list = await timeRepository.listShiftPatterns(req.params.companyId);
    res.json({ patterns: list });
  } catch (error: any) {
    logger.error('Failed to list shift patterns', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve shift patterns' });
  }
});

app.post('/api/companies/:companyId/shift-patterns', async (req: Request, res: Response) => {
  try {
    const pattern = await timeRepository.createShiftPattern(req.params.companyId, req.body);
    res.status(201).json({ pattern });
  } catch (error: any) {
    logger.error('Failed to create shift pattern', error);
    res.status(400).json({ error: error.message || 'Failed to create shift pattern' });
  }
});

// 4. Rosters API
app.get('/api/companies/:companyId/rosters', async (req: Request, res: Response) => {
  try {
    const list = await timeRepository.listRosters(req.params.companyId, {
      branchId: req.query.branchId as string | undefined,
      employeeId: req.query.employeeId as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      status: req.query.status as string | undefined,
    });
    res.json({ rosters: list });
  } catch (error: any) {
    logger.error('Failed to list rosters', error);
    res.status(500).json({ error: 'Failed to retrieve rosters' });
  }
});

app.post('/api/companies/:companyId/rosters', async (req: Request, res: Response) => {
  try {
    const { employeeId, shiftId, workDate, branchId, projectId, siteId, clientId } = req.body;
    if (!employeeId || !shiftId || !workDate) {
      return res.status(400).json({ error: 'employeeId, shiftId, and workDate are required.' });
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
  } catch (error: any) {
    logger.error('Failed to create roster entry', error);
    res.status(400).json({ error: error.message || 'Failed to create roster entry' });
  }
});

app.post('/api/companies/:companyId/rosters/publish', async (req: Request, res: Response) => {
  try {
    const { rosterIds, actorId } = req.body;
    if (!Array.isArray(rosterIds) || rosterIds.length === 0) {
      return res.status(400).json({ error: 'rosterIds array is required.' });
    }
    const result = await timeRepository.publishRoster(req.params.companyId, rosterIds, actorId || 'admin');
    res.json(result);
  } catch (error: any) {
    logger.error('Failed to publish roster', error);
    res.status(400).json({ error: error.message || 'Failed to publish roster' });
  }
});

app.put('/api/companies/:companyId/rosters/:rosterId', async (req: Request, res: Response) => {
  try {
    const { newShiftId, reason, actorId } = req.body;
    if (!newShiftId || !reason) {
      return res.status(400).json({ error: 'newShiftId and reason are required.' });
    }
    const updated = await timeRepository.updateRosterEntry(req.params.companyId, req.params.rosterId, newShiftId, reason, actorId || 'admin');
    res.json({ roster: updated });
  } catch (error: any) {
    logger.error('Failed to update roster entry', error);
    res.status(400).json({ error: error.message || 'Failed to update roster entry' });
  }
});

// 5. Clock Events (Raw Punches)
app.get('/api/companies/:companyId/clock-events', async (req: Request, res: Response) => {
  try {
    const list = await timeRepository.listClockEvents(req.params.companyId, {
      employeeId: req.query.employeeId as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    });
    res.json({ clockEvents: list });
  } catch (error: any) {
    logger.error('Failed to list clock events', error);
    res.status(500).json({ error: 'Failed to retrieve clock events' });
  }
});

app.post('/api/companies/:companyId/clock-events', async (req: Request, res: Response) => {
  try {
    const { employeeId, eventTimestamp, eventType, source, deviceId, branchId, siteId, latitude, longitude, sourceReference, actorId } = req.body;
    if (!employeeId || !eventTimestamp || !eventType) {
      return res.status(400).json({ error: 'employeeId, eventTimestamp, and eventType are required.' });
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

    // Auto-process for affected date
    const workDate = new Date(eventTimestamp).toISOString().slice(0, 10);
    await timeRepository.processEmployeeDay(req.params.companyId, employeeId, workDate, actorId || 'admin');

    res.status(201).json({ event });
  } catch (error: any) {
    logger.error('Failed to record clock event', error);
    res.status(400).json({ error: error.message || 'Failed to record clock event' });
  }
});

app.post('/api/companies/:companyId/clock-events/import', async (req: Request, res: Response) => {
  try {
    const { csvContent, rows, actorId } = req.body;
    let punchRows = rows;
    if (!punchRows && csvContent) {
      punchRows = attendanceImportService.parseCSV(csvContent);
    }
    if (!Array.isArray(punchRows) || punchRows.length === 0) {
      return res.status(400).json({ error: 'No punch rows found in import data.' });
    }

    const result = await attendanceImportService.importPunches(req.params.companyId, punchRows, actorId || 'admin');
    res.json(result);
  } catch (error: any) {
    logger.error('Failed to import clock events', error);
    res.status(400).json({ error: error.message || 'Failed to import clock events' });
  }
});

// 6. Attendance Days API
app.get('/api/companies/:companyId/attendance-days', async (req: Request, res: Response) => {
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
  } catch (error: any) {
    logger.error('Failed to list attendance days', error);
    res.status(500).json({ error: 'Failed to retrieve attendance days' });
  }
});

// Legacy mapping for backwards compatibility
app.get('/api/companies/:companyId/attendance', async (req: Request, res: Response) => {
  try {
    const workDate = (req.query.date as string) || (req.query.workDate as string) || new Date().toISOString().slice(0, 10);
    const list = await timeRepository.listAttendanceDays(req.params.companyId, {
      workDate,
      branchId: req.query.branchId as string | undefined,
      employeeId: req.query.employeeId as string | undefined,
      limit: 100,
    });
    res.json({ attendance: list });
  } catch (error: any) {
    logger.error('Failed to list attendance', error);
    res.status(500).json({ error: 'Failed to retrieve attendance' });
  }
});

app.get('/api/companies/:companyId/attendance-days/:id', async (req: Request, res: Response) => {
  try {
    const detail = await timeRepository.getAttendanceDayDetail(req.params.companyId, req.params.id);
    if (!detail) return res.status(404).json({ error: 'Attendance day record not found' });
    res.json({ attendanceDay: detail });
  } catch (error: any) {
    logger.error('Failed to retrieve attendance day detail', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve detail' });
  }
});

app.post('/api/companies/:companyId/attendance-days/process', async (req: Request, res: Response) => {
  try {
    const { workDate, employeeId, actorId } = req.body;
    if (!workDate) return res.status(400).json({ error: 'workDate is required (YYYY-MM-DD).' });

    if (employeeId) {
      const day = await timeRepository.processEmployeeDay(req.params.companyId, employeeId, workDate, actorId || 'admin');
      res.json({ processed: [day] });
    } else {
      const summary = await timeRepository.processDayForTenant(req.params.companyId, workDate, actorId || 'admin');
      res.json(summary);
    }
  } catch (error: any) {
    logger.error('Failed to process attendance', error);
    res.status(400).json({ error: error.message || 'Failed to process attendance' });
  }
});

// 7. Exceptions & Corrections
app.get('/api/companies/:companyId/attendance-exceptions', async (req: Request, res: Response) => {
  try {
    const list = await timeRepository.listExceptions(req.params.companyId, {
      status: req.query.status as string | undefined,
      severity: req.query.severity as string | undefined,
      employeeId: req.query.employeeId as string | undefined,
    });
    res.json({ exceptions: list });
  } catch (error: any) {
    logger.error('Failed to list exceptions', error);
    res.status(500).json({ error: 'Failed to retrieve exceptions' });
  }
});

app.put('/api/companies/:companyId/attendance-exceptions/:id/resolve', async (req: Request, res: Response) => {
  try {
    const { resolutionType, notes, actorId } = req.body;
    if (!resolutionType) return res.status(400).json({ error: 'resolutionType is required.' });
    const resolved = await timeRepository.resolveException(req.params.companyId, req.params.id, {
      resolutionType,
      notes,
      actorId: actorId || 'admin',
    });
    res.json({ exception: resolved });
  } catch (error: any) {
    logger.error('Failed to resolve exception', error);
    res.status(400).json({ error: error.message || 'Failed to resolve exception' });
  }
});

app.get('/api/companies/:companyId/attendance-corrections', async (req: Request, res: Response) => {
  try {
    const list = await timeRepository.listCorrections(req.params.companyId);
    res.json({ corrections: list });
  } catch (error: any) {
    logger.error('Failed to list corrections', error);
    res.status(500).json({ error: 'Failed to retrieve corrections' });
  }
});

app.post('/api/companies/:companyId/attendance-corrections', async (req: Request, res: Response) => {
  try {
    const { attendanceDayId, requestedFirstIn, requestedLastOut, reason, actorId } = req.body;
    if (!attendanceDayId || !reason) {
      return res.status(400).json({ error: 'attendanceDayId and reason are required.' });
    }
    const correction = await timeRepository.requestCorrection(req.params.companyId, {
      attendanceDayId,
      requestedFirstIn,
      requestedLastOut,
      reason,
      actorId: actorId || 'admin',
    });
    res.status(201).json({ correction });
  } catch (error: any) {
    logger.error('Failed to request correction', error);
    res.status(400).json({ error: error.message || 'Failed to request correction' });
  }
});

app.post('/api/companies/:companyId/attendance-corrections/:id/approve', async (req: Request, res: Response) => {
  try {
    const { actorId } = req.body;
    const approved = await timeRepository.approveCorrection(req.params.companyId, req.params.id, actorId || 'admin');
    res.json({ correction: approved });
  } catch (error: any) {
    logger.error('Failed to approve correction', error);
    res.status(400).json({ error: error.message || 'Failed to approve correction' });
  }
});

// 8. Timesheets API
app.get('/api/companies/:companyId/timesheets', async (req: Request, res: Response) => {
  try {
    const list = await timeRepository.listTimesheets(req.params.companyId, {
      employeeId: req.query.employeeId as string | undefined,
      status: req.query.status as string | undefined,
      periodStart: req.query.periodStart as string | undefined,
      periodEnd: req.query.periodEnd as string | undefined,
    });
    res.json({ timesheets: list });
  } catch (error: any) {
    logger.error('Failed to list timesheets', error);
    res.status(500).json({ error: 'Failed to retrieve timesheets' });
  }
});

app.post('/api/companies/:companyId/timesheets/generate', async (req: Request, res: Response) => {
  try {
    const { employeeId, periodStart, periodEnd, actorId } = req.body;
    if (!employeeId || !periodStart || !periodEnd) {
      return res.status(400).json({ error: 'employeeId, periodStart, and periodEnd are required.' });
    }
    const ts = await timeRepository.generateTimesheet(req.params.companyId, {
      employeeId,
      periodStart,
      periodEnd,
      actorId: actorId || 'admin',
    });
    res.status(201).json({ timesheet: ts });
  } catch (error: any) {
    logger.error('Failed to generate timesheet', error);
    res.status(400).json({ error: error.message || 'Failed to generate timesheet' });
  }
});

app.get('/api/companies/:companyId/timesheets/:id', async (req: Request, res: Response) => {
  try {
    const detail = await timeRepository.getTimesheetDetail(req.params.companyId, req.params.id);
    if (!detail) return res.status(404).json({ error: 'Timesheet not found' });
    res.json({ timesheet: detail });
  } catch (error: any) {
    logger.error('Failed to retrieve timesheet detail', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve timesheet' });
  }
});

app.post('/api/companies/:companyId/timesheets/:id/submit', async (req: Request, res: Response) => {
  try {
    const { actorId } = req.body;
    const ts = await timeRepository.submitTimesheet(req.params.companyId, req.params.id, actorId || 'admin');
    res.json({ timesheet: ts });
  } catch (error: any) {
    logger.error('Failed to submit timesheet', error);
    res.status(400).json({ error: error.message || 'Failed to submit timesheet' });
  }
});

app.post('/api/companies/:companyId/timesheets/:id/approve', async (req: Request, res: Response) => {
  try {
    const { actorId } = req.body;
    const ts = await timeRepository.approveTimesheet(req.params.companyId, req.params.id, actorId || 'admin');
    res.json({ timesheet: ts });
  } catch (error: any) {
    logger.error('Failed to approve timesheet', error);
    res.status(400).json({ error: error.message || 'Failed to approve timesheet' });
  }
});

app.post('/api/companies/:companyId/timesheets/:id/lock', async (req: Request, res: Response) => {
  try {
    const { actorId } = req.body;
    const ts = await timeRepository.lockTimesheet(req.params.companyId, req.params.id, actorId || 'admin');
    res.json({ timesheet: ts });
  } catch (error: any) {
    logger.error('Failed to lock timesheet', error);
    res.status(400).json({ error: error.message || 'Failed to lock timesheet' });
  }
});

// 9. Overtime API
app.get('/api/companies/:companyId/overtime-records', async (req: Request, res: Response) => {
  try {
    const list = await timeRepository.listOvertimeRecords(req.params.companyId, {
      employeeId: req.query.employeeId as string | undefined,
      status: req.query.status as string | undefined,
    });
    res.json({ overtimeRecords: list });
  } catch (error: any) {
    logger.error('Failed to list overtime records', error);
    res.status(500).json({ error: 'Failed to retrieve overtime records' });
  }
});

app.post('/api/companies/:companyId/overtime-records/:id/approve', async (req: Request, res: Response) => {
  try {
    const { actorId } = req.body;
    const ot = await timeRepository.approveOvertimeRecord(req.params.companyId, req.params.id, actorId || 'admin');
    res.json({ overtimeRecord: ot });
  } catch (error: any) {
    logger.error('Failed to approve overtime', error);
    res.status(400).json({ error: error.message || 'Failed to approve overtime' });
  }
});

// 10. Holidays & Calendars API
app.get('/api/companies/:companyId/holiday-calendars', async (req: Request, res: Response) => {
  try {
    const list = await timeRepository.listHolidayCalendars(req.params.companyId);
    res.json({ holidayCalendars: list });
  } catch (error: any) {
    logger.error('Failed to list holiday calendars', error);
    res.status(500).json({ error: 'Failed to retrieve holiday calendars' });
  }
});

app.post('/api/companies/:companyId/holiday-calendars', async (req: Request, res: Response) => {
  try {
    const cal = await timeRepository.createHolidayCalendar(req.params.companyId, req.body);
    res.status(201).json({ holidayCalendar: cal });
  } catch (error: any) {
    logger.error('Failed to create holiday calendar', error);
    res.status(400).json({ error: error.message || 'Failed to create holiday calendar' });
  }
});

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
    const { nameEn, nameAr, holidayDate, holidayCalendarId, holidayType, isPaid, actorId } = req.body;
    if (!nameEn || !nameAr || !holidayDate) {
      return res.status(400).json({ error: 'nameEn, nameAr, and holidayDate are required.' });
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
  } catch (error: any) {
    logger.error('Failed to create holiday', error);
    res.status(400).json({ error: error.message || 'Failed to create holiday' });
  }
});

// 11. Reports & Exports
app.get('/api/companies/:companyId/time/reports/daily', async (req: Request, res: Response) => {
  try {
    const workDate = (req.query.workDate as string) || new Date().toISOString().slice(0, 10);
    const list = await timeRepository.listAttendanceDays(req.params.companyId, { workDate, limit: 500 });
    res.json({ report: list, workDate });
  } catch (error: any) {
    logger.error('Failed to generate daily report', error);
    res.status(500).json({ error: error.message || 'Failed to generate daily report' });
  }
});

app.get('/api/companies/:companyId/time/reports/export-pdf', async (req: Request, res: Response) => {
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
  } catch (error: any) {
    logger.error('Failed to export daily PDF report', error);
    res.status(500).json({ error: error.message || 'Failed to export PDF' });
  }
});

app.get('/api/companies/:companyId/time/reports/export-csv', async (req: Request, res: Response) => {
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
  } catch (error: any) {
    logger.error('Failed to export CSV', error);
    res.status(500).json({ error: error.message || 'Failed to export CSV' });
  }
});

// 12. Dashboard Stats API
app.get('/api/companies/:companyId/time/dashboard-stats', async (req: Request, res: Response) => {
  try {
    const today = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const stats = await timeRepository.getDashboardStats(req.params.companyId, today);
    res.json(stats);
  } catch (error: any) {
    logger.error('Failed to get dashboard stats', error);
    res.status(500).json({ error: error.message || 'Failed to get stats' });
  }
});

app.post('/api/companies/:companyId/overtime', async (req: Request, res: Response) => {
  try {
    const { employeeId, attendanceId, date, overtimeType, minutes, countryCode, reason, actorId } = req.body;
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

// Payroll Periods Endpoints
app.get('/api/companies/:companyId/payroll/periods', async (req: Request, res: Response) => {
  try {
    const periods = await payrollRepository.listPayrollPeriods(req.params.companyId);
    res.json({ periods });
  } catch (error: any) {
    logger.error('Failed to list payroll periods', error);
    res.status(500).json({ error: 'Failed to retrieve payroll periods' });
  }
});

app.post('/api/companies/:companyId/payroll/periods', async (req: Request, res: Response) => {
  try {
    const { year, month, periodStart, periodEnd, paymentDate, actorId } = req.body;
    if (!year || !month || !periodStart || !periodEnd) {
      return res.status(400).json({ error: 'year, month, periodStart, and periodEnd are required.' });
    }
    const period = await payrollRepository.createPayrollPeriod(req.params.companyId, {
      year: Number(year),
      month: Number(month),
      periodStart,
      periodEnd,
      paymentDate,
      actorId,
    });
    res.status(201).json({ period });
  } catch (error: any) {
    logger.error('Failed to create payroll period', error);
    res.status(400).json({ error: error.message || 'Failed to create payroll period' });
  }
});

app.put('/api/companies/:companyId/payroll/periods/:id/status', async (req: Request, res: Response) => {
  try {
    const { status, actorId } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required.' });
    const period = await payrollRepository.updatePayrollPeriodStatus(req.params.companyId, req.params.id, status, actorId);
    res.json({ period });
  } catch (error: any) {
    logger.error('Failed to update period status', error);
    res.status(400).json({ error: error.message || 'Failed to update period status' });
  }
});

// Configurable Salary Components Endpoints
app.get('/api/companies/:companyId/payroll/components', async (req: Request, res: Response) => {
  try {
    const components = await payrollRepository.listSalaryComponents(req.params.companyId);
    res.json({ components });
  } catch (error: any) {
    logger.error('Failed to list salary components', error);
    res.status(500).json({ error: 'Failed to retrieve salary components' });
  }
});

app.post('/api/companies/:companyId/payroll/components', async (req: Request, res: Response) => {
  try {
    const { code, nameEn, nameAr, componentType, calculationType, formulaExpression, affectsGross, affectsNet, affectsOvertimeBase, affectsEosBase, displayOrder } = req.body;
    if (!code || !nameEn || !nameAr) {
      return res.status(400).json({ error: 'code, nameEn, and nameAr are required.' });
    }
    const component = await payrollRepository.createSalaryComponent(req.params.companyId, {
      code,
      nameEn,
      nameAr,
      componentType: componentType || 'EARNING',
      calculationType: calculationType || 'FIXED',
      formulaExpression,
      affectsGross,
      affectsNet,
      affectsOvertimeBase,
      affectsEosBase,
      displayOrder: displayOrder ? Number(displayOrder) : 0,
    });
    res.status(201).json({ component });
  } catch (error: any) {
    logger.error('Failed to create salary component', error);
    res.status(400).json({ error: error.message || 'Failed to create salary component' });
  }
});

// Salary Structures Endpoints
app.get('/api/companies/:companyId/payroll/structures', async (req: Request, res: Response) => {
  try {
    const structures = await payrollRepository.listSalaryStructures(req.params.companyId);
    res.json({ structures });
  } catch (error: any) {
    logger.error('Failed to list salary structures', error);
    res.status(500).json({ error: 'Failed to retrieve salary structures' });
  }
});

app.post('/api/companies/:companyId/payroll/structures', async (req: Request, res: Response) => {
  try {
    const { code, nameEn, nameAr, effectiveFrom, effectiveTo, components } = req.body;
    if (!code || !nameEn || !nameAr || !effectiveFrom) {
      return res.status(400).json({ error: 'code, nameEn, nameAr, and effectiveFrom are required.' });
    }
    const structure = await payrollRepository.createSalaryStructure(req.params.companyId, {
      code,
      nameEn,
      nameAr,
      effectiveFrom,
      effectiveTo,
      components: components || [],
    });
    res.status(201).json({ structure });
  } catch (error: any) {
    logger.error('Failed to create salary structure', error);
    res.status(400).json({ error: error.message || 'Failed to create salary structure' });
  }
});

// Payroll Adjustments Endpoints
app.get('/api/companies/:companyId/payroll/adjustments', async (req: Request, res: Response) => {
  try {
    const employeeId = req.query.employeeId as string | undefined;
    const periodId = req.query.periodId as string | undefined;
    const adjustments = await payrollRepository.listAdjustments(req.params.companyId, employeeId, periodId);
    res.json({ adjustments });
  } catch (error: any) {
    logger.error('Failed to list payroll adjustments', error);
    res.status(500).json({ error: 'Failed to retrieve adjustments' });
  }
});

app.post('/api/companies/:companyId/payroll/adjustments', async (req: Request, res: Response) => {
  try {
    const { employeeId, payrollPeriodId, type, amount, quantity, reason, effectiveDate, createdBy } = req.body;
    if (!employeeId || !type || !amount || !reason || !effectiveDate) {
      return res.status(400).json({ error: 'employeeId, type, amount, reason, and effectiveDate are required.' });
    }
    const adjustment = await payrollRepository.createAdjustment(req.params.companyId, {
      employeeId,
      payrollPeriodId,
      type,
      amount,
      quantity,
      reason,
      effectiveDate,
      createdBy,
    });
    res.status(201).json({ adjustment });
  } catch (error: any) {
    logger.error('Failed to create payroll adjustment', error);
    res.status(400).json({ error: error.message || 'Failed to create adjustment' });
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

// Post Payroll Run (Freeze, Lock, Deduct Loans)
app.post('/api/companies/:companyId/payroll/runs/:id/post', async (req: Request, res: Response) => {
  try {
    const { posterId } = req.body;
    const run = await payrollRepository.postPayrollRun(req.params.companyId, req.params.id, posterId || 'admin');
    res.json({ run });
  } catch (error: any) {
    logger.error('Failed to post payroll run', error);
    res.status(400).json({ error: error.message || 'Failed to post payroll run' });
  }
});

// Controlled Reversal of Payroll Run
app.post('/api/companies/:companyId/payroll/runs/:id/reverse', async (req: Request, res: Response) => {
  try {
    const { actorId, reason } = req.body;
    if (!reason) {
      return res.status(400).json({ error: 'Reversal reason is required.' });
    }
    const run = await payrollRepository.reversePayrollRun(req.params.companyId, req.params.id, actorId || 'admin', reason);
    res.json({ run });
  } catch (error: any) {
    logger.error('Failed to reverse payroll run', error);
    res.status(400).json({ error: error.message || 'Failed to reverse payroll run' });
  }
});

// Individual Employee Payslip PDF Download
app.get('/api/companies/:companyId/payroll/runs/:id/payslips/:employeeId/pdf', async (req: Request, res: Response) => {
  try {
    const pdfBuffer = await payrollRepository.generatePayslipPdf(req.params.companyId, req.params.id, req.params.employeeId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Payslip_${req.params.id}_${req.params.employeeId}.pdf"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    logger.error('Failed to generate payslip PDF', error);
    res.status(400).json({ error: error.message || 'Failed to generate payslip PDF' });
  }
});

// Batch Payslips PDF Download
app.get('/api/companies/:companyId/payroll/runs/:id/payslips/batch/pdf', async (req: Request, res: Response) => {
  try {
    const pdfBuffer = await payrollRepository.generateBatchPayslipsPdf(req.params.companyId, req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Batch_Payslips_${req.params.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    logger.error('Failed to generate batch payslips PDF', error);
    res.status(400).json({ error: error.message || 'Failed to generate batch payslips PDF' });
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

// ==========================================
// SALES & RECEIVABLES MODULE ENDPOINTS
// ==========================================

// 1. Clients Management
app.get('/api/companies/:companyId/sales/clients', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const list = await salesRepository.listClients(req.params.companyId);
    res.json({ clients: list });
  } catch (error: any) {
    logger.error('Failed to list clients', error);
    res.status(500).json({ error: 'Failed to retrieve clients list' });
  }
});

app.get('/api/companies/:companyId/sales/clients/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const client = await salesRepository.getClient(req.params.companyId, Number(req.params.id));
    if (!client) return res.status(404).json({ error: 'Client not found or access denied' });
    res.json({ client });
  } catch (error: any) {
    logger.error('Failed to get client', error);
    res.status(500).json({ error: 'Failed to retrieve client details' });
  }
});

app.post('/api/companies/:companyId/sales/clients', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const client = await salesRepository.createClient(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ client });
  } catch (error: any) {
    logger.error('Failed to create client', error);
    res.status(400).json({ error: error.message || 'Failed to create client' });
  }
});

app.put('/api/companies/:companyId/sales/clients/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const client = await salesRepository.updateClient(req.params.companyId, Number(req.params.id), req.body, (req as any).user?.uid || 'admin');
    res.json({ client });
  } catch (error: any) {
    logger.error('Failed to update client', error);
    res.status(400).json({ error: error.message || 'Failed to update client' });
  }
});

app.get('/api/companies/:companyId/sales/clients/:id/preflight', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const preflight = await salesRepository.preflightDeleteClient(req.params.companyId, Number(req.params.id));
    res.json({ preflight });
  } catch (error: any) {
    logger.error('Failed to preflight client delete', error);
    res.status(400).json({ error: error.message || 'Failed to preflight client delete' });
  }
});

app.delete('/api/companies/:companyId/sales/clients/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const result = await salesRepository.deleteClient(req.params.companyId, Number(req.params.id), (req as any).user?.uid || 'admin', reason);
    res.json({ result });
  } catch (error: any) {
    logger.error('Failed to delete client', error);
    res.status(400).json({ error: error.message || 'Failed to delete client' });
  }
});

app.post('/api/companies/:companyId/sales/clients/bulk-delete/preflight', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const { clientIds } = req.body;
    const preflight = await salesRepository.preflightBulkDeleteClients(req.params.companyId, clientIds);
    res.json({ preflight });
  } catch (error: any) {
    logger.error('Failed to preflight bulk delete clients', error);
    res.status(400).json({ error: error.message || 'Failed to preflight bulk delete clients' });
  }
});

app.post('/api/companies/:companyId/sales/clients/bulk-delete', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const { clientIds, action, reason } = req.body;
    const result = await salesRepository.bulkDeleteClients(req.params.companyId, {
      clientIds,
      action: action || 'DELETE',
      actorId: (req as any).user?.uid || 'admin',
      reason,
    });
    res.json({ result });
  } catch (error: any) {
    logger.error('Failed bulk delete clients', error);
    res.status(400).json({ error: error.message || 'Failed to execute bulk delete clients' });
  }
});

app.post('/api/companies/:companyId/sales/clients/:id/contacts', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const contact = await salesRepository.createClientContact(req.params.companyId, Number(req.params.id), req.body);
    res.status(201).json({ contact });
  } catch (error: any) {
    logger.error('Failed to create client contact', error);
    res.status(400).json({ error: error.message || 'Failed to create contact' });
  }
});

app.post('/api/companies/:companyId/sales/clients/:id/sites', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const site = await salesRepository.createClientSite(req.params.companyId, Number(req.params.id), req.body);
    res.status(201).json({ site });
  } catch (error: any) {
    logger.error('Failed to create client site', error);
    res.status(400).json({ error: error.message || 'Failed to create site' });
  }
});

// 2. Tax Codes
app.get('/api/companies/:companyId/sales/tax-codes', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const list = await salesRepository.listTaxCodes(req.params.companyId);
    res.json({ taxCodes: list });
  } catch (error: any) {
    logger.error('Failed to list tax codes', error);
    res.status(500).json({ error: 'Failed to retrieve tax codes' });
  }
});

app.post('/api/companies/:companyId/sales/tax-codes', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const tc = await salesRepository.createTaxCode(req.params.companyId, req.body);
    res.status(201).json({ taxCode: tc });
  } catch (error: any) {
    logger.error('Failed to create tax code', error);
    res.status(400).json({ error: error.message || 'Failed to create tax code' });
  }
});

// 3. Quotations
app.get('/api/companies/:companyId/sales/quotations', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const list = await salesRepository.listQuotations(req.params.companyId);
    res.json({ quotations: list });
  } catch (error: any) {
    logger.error('Failed to list quotations', error);
    res.status(500).json({ error: 'Failed to retrieve quotations' });
  }
});

app.get('/api/companies/:companyId/sales/quotations/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const quote = await salesRepository.getQuotation(req.params.companyId, Number(req.params.id));
    if (!quote) return res.status(404).json({ error: 'Quotation not found or access denied' });
    res.json({ quotation: quote });
  } catch (error: any) {
    logger.error('Failed to get quotation', error);
    res.status(500).json({ error: 'Failed to retrieve quotation details' });
  }
});

app.post('/api/companies/:companyId/sales/quotations', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const quote = await salesRepository.createQuotation(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ quotation: quote });
  } catch (error: any) {
    logger.error('Failed to create quotation', error);
    res.status(400).json({ error: error.message || 'Failed to create quotation' });
  }
});

app.put('/api/companies/:companyId/sales/quotations/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const quote = await salesRepository.updateQuotation(req.params.companyId, Number(req.params.id), req.body, (req as any).user?.uid || 'admin');
    res.json({ quotation: quote });
  } catch (error: any) {
    logger.error('Failed to update quotation', error);
    res.status(400).json({ error: error.message || 'Failed to update quotation' });
  }
});

app.delete('/api/companies/:companyId/sales/quotations/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const result = await salesRepository.deleteQuotation(req.params.companyId, Number(req.params.id), (req as any).user?.uid || 'admin', reason);
    res.json({ result });
  } catch (error: any) {
    logger.error('Failed to delete quotation', error);
    res.status(400).json({ error: error.message || 'Failed to delete quotation' });
  }
});

app.post('/api/companies/:companyId/sales/quotations/:id/convert', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const order = await salesRepository.convertQuotationToSalesOrder(req.params.companyId, Number(req.params.id), (req as any).user?.uid || 'admin');
    res.status(201).json({ salesOrder: order });
  } catch (error: any) {
    logger.error('Failed to convert quotation to order', error);
    res.status(400).json({ error: error.message || 'Failed to convert quotation' });
  }
});

// 4. Sales Orders
app.get('/api/companies/:companyId/sales/orders', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const list = await salesRepository.listSalesOrders(req.params.companyId);
    res.json({ salesOrders: list });
  } catch (error: any) {
    logger.error('Failed to list sales orders', error);
    res.status(500).json({ error: 'Failed to retrieve sales orders' });
  }
});

app.get('/api/companies/:companyId/sales/orders/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const order = await salesRepository.getSalesOrder(req.params.companyId, Number(req.params.id));
    if (!order) return res.status(404).json({ error: 'Sales Order not found or access denied' });
    res.json({ salesOrder: order });
  } catch (error: any) {
    logger.error('Failed to get sales order', error);
    res.status(500).json({ error: 'Failed to retrieve sales order details' });
  }
});

app.delete('/api/companies/:companyId/sales/orders/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const result = await salesRepository.deleteSalesOrder(req.params.companyId, Number(req.params.id), (req as any).user?.uid || 'admin', reason);
    res.json({ result });
  } catch (error: any) {
    logger.error('Failed to delete sales order', error);
    res.status(400).json({ error: error.message || 'Failed to delete sales order' });
  }
});

// 5. Deliveries
app.get('/api/companies/:companyId/sales/deliveries', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const list = await salesRepository.listDeliveries(req.params.companyId);
    res.json({ deliveries: list });
  } catch (error: any) {
    logger.error('Failed to list deliveries', error);
    res.status(500).json({ error: 'Failed to retrieve deliveries' });
  }
});

app.get('/api/companies/:companyId/sales/deliveries/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const dlv = await salesRepository.getDelivery(req.params.companyId, Number(req.params.id));
    if (!dlv) return res.status(404).json({ error: 'Delivery note not found or access denied' });
    res.json({ delivery: dlv });
  } catch (error: any) {
    logger.error('Failed to get delivery note', error);
    res.status(500).json({ error: 'Failed to retrieve delivery note details' });
  }
});

app.post('/api/companies/:companyId/sales/deliveries/from-order', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const dlv = await salesRepository.createDeliveryFromSalesOrder(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ delivery: dlv });
  } catch (error: any) {
    logger.error('Failed to create delivery note', error);
    res.status(400).json({ error: error.message || 'Failed to create delivery note' });
  }
});

app.delete('/api/companies/:companyId/sales/deliveries/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const result = await salesRepository.deleteDelivery(req.params.companyId, Number(req.params.id), (req as any).user?.uid || 'admin', reason);
    res.json({ result });
  } catch (error: any) {
    logger.error('Failed to delete delivery note', error);
    res.status(400).json({ error: error.message || 'Failed to delete delivery note' });
  }
});

// 6. Invoices
app.get('/api/companies/:companyId/sales/invoices', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const list = await salesRepository.listInvoices(req.params.companyId);
    res.json({ invoices: list });
  } catch (error: any) {
    logger.error('Failed to list invoices', error);
    res.status(500).json({ error: 'Failed to retrieve invoices' });
  }
});

app.get('/api/companies/:companyId/sales/invoices/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const inv = await salesRepository.getInvoice(req.params.companyId, Number(req.params.id));
    if (!inv) return res.status(404).json({ error: 'Invoice not found or access denied' });
    res.json({ invoice: inv });
  } catch (error: any) {
    logger.error('Failed to get invoice', error);
    res.status(500).json({ error: 'Failed to retrieve invoice details' });
  }
});

app.post('/api/companies/:companyId/sales/invoices/direct', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const inv = await salesRepository.createDirectInvoice(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ invoice: inv });
  } catch (error: any) {
    logger.error('Failed to create direct invoice', error);
    res.status(400).json({ error: error.message || 'Failed to create invoice' });
  }
});

app.post('/api/companies/:companyId/sales/invoices/:id/post', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const inv = await salesRepository.postInvoice(req.params.companyId, Number(req.params.id), (req as any).user?.uid || 'admin');
    res.json({ invoice: inv });
  } catch (error: any) {
    logger.error('Failed to post invoice', error);
    res.status(400).json({ error: error.message || 'Failed to post invoice' });
  }
});

app.delete('/api/companies/:companyId/sales/invoices/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const result = await salesRepository.deleteInvoice(req.params.companyId, Number(req.params.id), (req as any).user?.uid || 'admin', reason);
    res.json({ result });
  } catch (error: any) {
    logger.error('Failed to delete invoice', error);
    res.status(400).json({ error: error.message || 'Failed to delete invoice' });
  }
});

// 7. Credit Notes
app.get('/api/companies/:companyId/sales/credit-notes', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const list = await salesRepository.listCreditNotes(req.params.companyId);
    res.json({ creditNotes: list });
  } catch (error: any) {
    logger.error('Failed to list credit notes', error);
    res.status(500).json({ error: 'Failed to retrieve credit notes' });
  }
});

app.get('/api/companies/:companyId/sales/credit-notes/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const cn = await salesRepository.getCreditNote(req.params.companyId, Number(req.params.id));
    if (!cn) return res.status(404).json({ error: 'Credit note not found or access denied' });
    res.json({ creditNote: cn });
  } catch (error: any) {
    logger.error('Failed to get credit note', error);
    res.status(500).json({ error: 'Failed to retrieve credit note details' });
  }
});

app.post('/api/companies/:companyId/sales/credit-notes', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const cn = await salesRepository.createCreditNote(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ creditNote: cn });
  } catch (error: any) {
    logger.error('Failed to create credit note', error);
    res.status(400).json({ error: error.message || 'Failed to create credit note' });
  }
});

// 8. Receipts
app.get('/api/companies/:companyId/sales/receipts', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const list = await salesRepository.listReceipts(req.params.companyId);
    res.json({ receipts: list });
  } catch (error: any) {
    logger.error('Failed to list receipts', error);
    res.status(500).json({ error: 'Failed to retrieve receipts' });
  }
});

app.get('/api/companies/:companyId/sales/receipts/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const rec = await salesRepository.getReceipt(req.params.companyId, Number(req.params.id));
    if (!rec) return res.status(404).json({ error: 'Receipt not found or access denied' });
    res.json({ receipt: rec });
  } catch (error: any) {
    logger.error('Failed to get receipt', error);
    res.status(500).json({ error: 'Failed to retrieve receipt details' });
  }
});

app.post('/api/companies/:companyId/sales/receipts', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const rec = await salesRepository.createReceipt(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ receipt: rec });
  } catch (error: any) {
    logger.error('Failed to create receipt', error);
    res.status(400).json({ error: error.message || 'Failed to create receipt' });
  }
});

app.delete('/api/companies/:companyId/sales/receipts/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const result = await salesRepository.deleteReceipt(req.params.companyId, Number(req.params.id), (req as any).user?.uid || 'admin', reason);
    res.json({ result });
  } catch (error: any) {
    logger.error('Failed to delete receipt', error);
    res.status(400).json({ error: error.message || 'Failed to delete receipt' });
  }
});

// 9. Document Downloads & Reports
app.get('/api/companies/:companyId/sales/quotations/:id/pdf', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const quote = await salesRepository.getQuotation(req.params.companyId, Number(req.params.id));
    if (!quote) return res.status(404).send('Quotation not found');
    const pdf = await salesDocumentService.generateQuotationPDF(quote);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="QUOTATION_${quote.quotationNumber}.pdf"`);
    res.send(pdf);
  } catch (error: any) {
    logger.error('Failed to generate quotation PDF', error);
    res.status(500).send('Failed to generate PDF document');
  }
});

app.get('/api/companies/:companyId/sales/invoices/:id/pdf', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const inv = await salesRepository.getInvoice(req.params.companyId, Number(req.params.id));
    if (!inv) return res.status(404).send('Invoice not found');
    const pdf = await salesDocumentService.generateInvoicePDF(inv);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="INVOICE_${inv.invoiceNumber}.pdf"`);
    res.send(pdf);
  } catch (error: any) {
    logger.error('Failed to generate invoice PDF', error);
    res.status(500).send('Failed to generate PDF document');
  }
});

app.get('/api/companies/:companyId/sales/receipts/:id/pdf', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const rec = await salesRepository.getReceipt(req.params.companyId, Number(req.params.id));
    if (!rec) return res.status(404).send('Receipt not found');
    const pdf = await salesDocumentService.generateReceiptPDF(rec);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="RECEIPT_${rec.receiptNumber}.pdf"`);
    res.send(pdf);
  } catch (error: any) {
    logger.error('Failed to generate receipt PDF', error);
    res.status(500).send('Failed to generate PDF document');
  }
});

app.get('/api/companies/:companyId/sales/clients/:id/statement', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo, currency } = req.query;
    if (!dateFrom || !dateTo) {
      return res.status(400).json({ error: 'dateFrom and dateTo are required query parameters' });
    }
    const stmt = await salesRepository.getCustomerStatement(
      req.params.companyId,
      Number(req.params.id),
      String(dateFrom),
      String(dateTo),
      String(currency || 'KWD')
    );
    res.json({ statement: stmt });
  } catch (error: any) {
    logger.error('Failed to calculate customer statement', error);
    res.status(400).json({ error: error.message || 'Failed to retrieve statement' });
  }
});

app.get('/api/companies/:companyId/sales/clients/:id/statement/pdf', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo, currency } = req.query;
    if (!dateFrom || !dateTo) return res.status(400).send('dateFrom and dateTo are required');
    const stmt = await salesRepository.getCustomerStatement(
      req.params.companyId,
      Number(req.params.id),
      String(dateFrom),
      String(dateTo),
      String(currency || 'KWD')
    );
    const pdf = await salesDocumentService.generateStatementPDF(stmt);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Statement_${stmt.client.code}.pdf"`);
    res.send(pdf);
  } catch (error: any) {
    logger.error('Failed to generate statement PDF', error);
    res.status(500).send('Failed to generate PDF statement');
  }
});

app.get('/api/companies/:companyId/sales/clients/:id/statement/excel', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo, currency } = req.query;
    if (!dateFrom || !dateTo) return res.status(400).send('dateFrom and dateTo are required');
    const stmt = await salesRepository.getCustomerStatement(
      req.params.companyId,
      Number(req.params.id),
      String(dateFrom),
      String(dateTo),
      String(currency || 'KWD')
    );
    const excelBuffer = await salesDocumentService.generateStatementExcel(stmt);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Statement_${stmt.client.code}.xlsx"`);
    res.send(excelBuffer);
  } catch (error: any) {
    logger.error('Failed to generate statement Excel', error);
    res.status(500).send('Failed to generate Excel statement');
  }
});

app.get('/api/companies/:companyId/sales/reports/aging', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const { currency } = req.query;
    const report = await salesRepository.getReceivableAging(req.params.companyId, String(currency || 'KWD'));
    res.json({ agingReport: report });
  } catch (error: any) {
    logger.error('Failed to build aging report', error);
    res.status(400).json({ error: error.message || 'Failed to retrieve aging report' });
  }
});

// Authenticated user profile endpoint
app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.firebaseUser?.uid;
    const email = req.firebaseUser?.email || '';
    if (!uid) {
      return res.status(401).json({ error: 'Unauthorized: Missing UID' });
    }

    const user = await getOrCreateUser(uid, email, req.firebaseUser?.name);
    res.json({ user });
  } catch (error: any) {
    logger.error('Failed to resolve authenticated user profile', error);
    res.status(500).json({ error: 'Failed to synchronize user session' });
  }
});

// ==========================================
// PURCHASE, PROCUREMENT & PAYABLES MODULE ENDPOINTS
// ==========================================

// 1. Suppliers
app.get('/api/companies/:companyId/procurement/suppliers', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const list = await procurementRepository.listSuppliers(req.params.companyId);
    res.json({ suppliers: list });
  } catch (error: any) {
    logger.error('Failed to list suppliers', error);
    res.status(500).json({ error: 'Failed to retrieve suppliers list' });
  }
});

app.get('/api/companies/:companyId/procurement/suppliers/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const supplier = await procurementRepository.getSupplier(req.params.companyId, Number(req.params.id));
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    res.json({ supplier });
  } catch (error: any) {
    logger.error('Failed to get supplier', error);
    res.status(500).json({ error: 'Failed to retrieve supplier' });
  }
});

app.post('/api/companies/:companyId/procurement/suppliers', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const supplier = await procurementRepository.createSupplier(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ supplier });
  } catch (error: any) {
    logger.error('Failed to create supplier', error);
    res.status(400).json({ error: error.message || 'Failed to create supplier' });
  }
});

app.put('/api/companies/:companyId/procurement/suppliers/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const supplier = await procurementRepository.updateSupplier(req.params.companyId, Number(req.params.id), req.body, (req as any).user?.uid || 'admin');
    res.json({ supplier });
  } catch (error: any) {
    logger.error('Failed to update supplier', error);
    res.status(400).json({ error: error.message || 'Failed to update supplier' });
  }
});

app.get('/api/companies/:companyId/procurement/suppliers/:id/preflight', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const preflight = await procurementRepository.preflightDeleteSupplier(req.params.companyId, Number(req.params.id));
    res.json({ preflight });
  } catch (error: any) {
    logger.error('Failed to preflight supplier delete', error);
    res.status(400).json({ error: error.message || 'Failed to preflight supplier' });
  }
});

app.delete('/api/companies/:companyId/procurement/suppliers/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const result = await procurementRepository.deleteSupplier(req.params.companyId, Number(req.params.id), (req as any).user?.uid || 'admin', reason);
    res.json({ result });
  } catch (error: any) {
    logger.error('Failed to delete supplier', error);
    res.status(400).json({ error: error.message || 'Failed to delete supplier' });
  }
});

app.post('/api/companies/:companyId/procurement/suppliers/bulk-delete/preflight', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const { supplierIds } = req.body;
    const preflight = await procurementRepository.preflightBulkDeleteSuppliers(req.params.companyId, supplierIds);
    res.json({ preflight });
  } catch (error: any) {
    logger.error('Failed to preflight bulk delete suppliers', error);
    res.status(400).json({ error: error.message || 'Failed to preflight bulk delete' });
  }
});

app.post('/api/companies/:companyId/procurement/suppliers/bulk-delete', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const { supplierIds, action, reason } = req.body;
    const result = await procurementRepository.bulkDeleteSuppliers(req.params.companyId, {
      supplierIds,
      action: action || 'DELETE',
      actorId: (req as any).user?.uid || 'admin',
      reason,
    });
    res.json({ result });
  } catch (error: any) {
    logger.error('Failed bulk delete suppliers', error);
    res.status(400).json({ error: error.message || 'Failed bulk delete' });
  }
});

// 2. Purchase Requests
app.get('/api/companies/:companyId/procurement/purchase-requests', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const list = await procurementRepository.listPurchaseRequests(req.params.companyId);
    res.json({ purchaseRequests: list });
  } catch (error: any) {
    logger.error('Failed to list PRs', error);
    res.status(500).json({ error: 'Failed to retrieve purchase requests' });
  }
});

app.get('/api/companies/:companyId/procurement/purchase-requests/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const pr = await procurementRepository.getPurchaseRequest(req.params.companyId, Number(req.params.id));
    if (!pr) return res.status(404).json({ error: 'Purchase request not found' });
    res.json({ purchaseRequest: pr });
  } catch (error: any) {
    logger.error('Failed to get PR', error);
    res.status(500).json({ error: 'Failed to retrieve purchase request details' });
  }
});

app.post('/api/companies/:companyId/procurement/purchase-requests', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const pr = await procurementRepository.createPurchaseRequest(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ purchaseRequest: pr });
  } catch (error: any) {
    logger.error('Failed to create PR', error);
    res.status(400).json({ error: error.message || 'Failed to create purchase request' });
  }
});

app.put('/api/companies/:companyId/procurement/purchase-requests/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const pr = await procurementRepository.updatePurchaseRequest(req.params.companyId, Number(req.params.id), req.body, (req as any).user?.uid || 'admin');
    res.json({ purchaseRequest: pr });
  } catch (error: any) {
    logger.error('Failed to update PR', error);
    res.status(400).json({ error: error.message || 'Failed to update purchase request' });
  }
});

app.post('/api/companies/:companyId/procurement/purchase-requests/:id/submit', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const pr = await procurementRepository.setPurchaseRequestStatus(req.params.companyId, Number(req.params.id), 'SUBMITTED', (req as any).user?.uid || 'admin');
    res.json({ purchaseRequest: pr });
  } catch (error: any) {
    logger.error('Failed to submit PR', error);
    res.status(400).json({ error: error.message || 'Failed to submit' });
  }
});

app.post('/api/companies/:companyId/procurement/purchase-requests/:id/approve', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const pr = await procurementRepository.setPurchaseRequestStatus(req.params.companyId, Number(req.params.id), 'APPROVED', (req as any).user?.uid || 'admin');
    res.json({ purchaseRequest: pr });
  } catch (error: any) {
    logger.error('Failed to approve PR', error);
    res.status(400).json({ error: error.message || 'Failed to approve' });
  }
});

app.delete('/api/companies/:companyId/procurement/purchase-requests/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const result = await procurementRepository.deletePurchaseRequest(req.params.companyId, Number(req.params.id), (req as any).user?.uid || 'admin');
    res.json({ result });
  } catch (error: any) {
    logger.error('Failed to delete PR', error);
    res.status(400).json({ error: error.message || 'Failed to delete' });
  }
});

// 3. RFQs & Supplier Quotations
app.get('/api/companies/:companyId/procurement/rfqs', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const list = await procurementRepository.listRFQs(req.params.companyId);
    res.json({ rfqs: list });
  } catch (error: any) {
    logger.error('Failed to list RFQs', error);
    res.status(500).json({ error: 'Failed to retrieve RFQs' });
  }
});

app.post('/api/companies/:companyId/procurement/rfqs', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const rfq = await procurementRepository.createRFQ(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ rfq });
  } catch (error: any) {
    logger.error('Failed to create RFQ', error);
    res.status(400).json({ error: error.message || 'Failed to create RFQ' });
  }
});

app.get('/api/companies/:companyId/procurement/quotations', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const list = await procurementRepository.listSupplierQuotations(req.params.companyId);
    res.json({ quotations: list });
  } catch (error: any) {
    logger.error('Failed to list quotations', error);
    res.status(500).json({ error: 'Failed to retrieve quotations' });
  }
});

app.post('/api/companies/:companyId/procurement/quotations', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const quote = await procurementRepository.createSupplierQuotation(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ quotation: quote });
  } catch (error: any) {
    logger.error('Failed to create quotation', error);
    res.status(400).json({ error: error.message || 'Failed to create quotation' });
  }
});

app.post('/api/companies/:companyId/procurement/quotations/:id/select', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const quote = await procurementRepository.selectQuotation(req.params.companyId, Number(req.params.id), reason, (req as any).user?.uid || 'admin');
    res.json({ quotation: quote });
  } catch (error: any) {
    logger.error('Failed to select quotation', error);
    res.status(400).json({ error: error.message || 'Failed to select quotation' });
  }
});

// 4. Purchase Orders (PO)
app.get('/api/companies/:companyId/procurement/purchase-orders', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const list = await procurementRepository.listPurchaseOrders(req.params.companyId);
    res.json({ purchaseOrders: list });
  } catch (error: any) {
    logger.error('Failed to list POs', error);
    res.status(500).json({ error: 'Failed to retrieve POs' });
  }
});

app.get('/api/companies/:companyId/procurement/purchase-orders/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const po = await procurementRepository.getPurchaseOrder(req.params.companyId, Number(req.params.id));
    if (!po) return res.status(404).json({ error: 'PO not found' });
    res.json({ purchaseOrder: po });
  } catch (error: any) {
    logger.error('Failed to get PO', error);
    res.status(500).json({ error: 'Failed to retrieve PO details' });
  }
});

app.post('/api/companies/:companyId/procurement/purchase-orders', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const po = await procurementRepository.createPurchaseOrder(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ purchaseOrder: po });
  } catch (error: any) {
    logger.error('Failed to create PO', error);
    res.status(400).json({ error: error.message || 'Failed to create PO' });
  }
});

app.post('/api/companies/:companyId/procurement/purchase-orders/:id/approve', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const po = await procurementRepository.approvePurchaseOrder(req.params.companyId, Number(req.params.id), (req as any).user?.uid || 'admin');
    res.json({ purchaseOrder: po });
  } catch (error: any) {
    logger.error('Failed to approve PO', error);
    res.status(400).json({ error: error.message || 'Failed to approve PO' });
  }
});

app.delete('/api/companies/:companyId/procurement/purchase-orders/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const result = await procurementRepository.deletePurchaseOrder(req.params.companyId, Number(req.params.id), (req as any).user?.uid || 'admin');
    res.json({ result });
  } catch (error: any) {
    logger.error('Failed to delete PO', error);
    res.status(400).json({ error: error.message || 'Failed to delete PO' });
  }
});

app.get('/api/companies/:companyId/procurement/purchase-orders/:id/pdf', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const po = await procurementRepository.getPurchaseOrder(req.params.companyId, Number(req.params.id));
    if (!po) return res.status(404).send('Purchase Order not found');

    const pdf = await procurementDocumentService.generatePurchaseOrderPDF(po);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="PO_${po.purchaseOrderNumber}.pdf"`);
    res.send(pdf);
  } catch (error: any) {
    logger.error('Failed to generate PO PDF', error);
    res.status(500).send('Failed to generate PDF');
  }
});

// 5. Goods / Service Receipts
app.get('/api/companies/:companyId/procurement/goods-receipts', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const list = await procurementRepository.listGoodsReceipts(req.params.companyId);
    res.json({ goodsReceipts: list });
  } catch (error: any) {
    logger.error('Failed to list GRNs', error);
    res.status(500).json({ error: 'Failed to retrieve Goods Receipts' });
  }
});

app.post('/api/companies/:companyId/procurement/goods-receipts', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const grn = await procurementRepository.createGoodsReceipt(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ goodsReceipt: grn });
  } catch (error: any) {
    logger.error('Failed to create GRN', error);
    res.status(400).json({ error: error.message || 'Failed to confirm receipt' });
  }
});

app.delete('/api/companies/:companyId/procurement/goods-receipts/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const result = await procurementRepository.deleteGoodsReceipt(req.params.companyId, Number(req.params.id), (req as any).user?.uid || 'admin');
    res.json({ result });
  } catch (error: any) {
    logger.error('Failed to cancel GRN', error);
    res.status(400).json({ error: error.message || 'Failed to cancel receipt' });
  }
});

// 6. Supplier Bills
app.get('/api/companies/:companyId/procurement/bills', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const list = await procurementRepository.listSupplierBills(req.params.companyId);
    res.json({ bills: list });
  } catch (error: any) {
    logger.error('Failed to list bills', error);
    res.status(500).json({ error: 'Failed to retrieve bills' });
  }
});

app.get('/api/companies/:companyId/procurement/bills/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const bill = await procurementRepository.getSupplierBill(req.params.companyId, Number(req.params.id));
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    res.json({ bill });
  } catch (error: any) {
    logger.error('Failed to get bill', error);
    res.status(500).json({ error: 'Failed to retrieve bill details' });
  }
});

app.post('/api/companies/:companyId/procurement/bills', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const bill = await procurementRepository.createSupplierBill(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ bill });
  } catch (error: any) {
    logger.error('Failed to create bill', error);
    res.status(400).json({ error: error.message || 'Failed to create bill' });
  }
});

app.post('/api/companies/:companyId/procurement/bills/:id/post', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const bill = await procurementRepository.postSupplierBill(req.params.companyId, Number(req.params.id), (req as any).user?.uid || 'admin');
    res.json({ bill });
  } catch (error: any) {
    logger.error('Failed to post bill', error);
    res.status(400).json({ error: error.message || 'Failed to post' });
  }
});

app.post('/api/companies/:companyId/procurement/bills/:id/void', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const bill = await procurementRepository.voidSupplierBill(req.params.companyId, Number(req.params.id), reason, (req as any).user?.uid || 'admin');
    res.json({ bill });
  } catch (error: any) {
    logger.error('Failed to void bill', error);
    res.status(400).json({ error: error.message || 'Failed to void' });
  }
});

app.delete('/api/companies/:companyId/procurement/bills/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const result = await procurementRepository.deleteSupplierBill(req.params.companyId, Number(req.params.id), (req as any).user?.uid || 'admin');
    res.json({ result });
  } catch (error: any) {
    logger.error('Failed to delete bill', error);
    res.status(400).json({ error: error.message || 'Failed to delete' });
  }
});

// 7. Supplier Payments
app.get('/api/companies/:companyId/procurement/payments', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const list = await procurementRepository.listSupplierPayments(req.params.companyId);
    res.json({ payments: list });
  } catch (error: any) {
    logger.error('Failed to list payments', error);
    res.status(500).json({ error: 'Failed to retrieve payments' });
  }
});

app.get('/api/companies/:companyId/procurement/payments/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const pay = await procurementRepository.getSupplierPayment(req.params.companyId, Number(req.params.id));
    if (!pay) return res.status(404).json({ error: 'Payment not found' });
    res.json({ payment: pay });
  } catch (error: any) {
    logger.error('Failed to get payment', error);
    res.status(500).json({ error: 'Failed to retrieve payment details' });
  }
});

app.post('/api/companies/:companyId/procurement/payments', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const pay = await procurementRepository.createSupplierPayment(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ payment: pay });
  } catch (error: any) {
    logger.error('Failed to create payment', error);
    res.status(400).json({ error: error.message || 'Failed to create payment' });
  }
});

app.post('/api/companies/:companyId/procurement/payments/:id/void', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const pay = await procurementRepository.voidSupplierPayment(req.params.companyId, Number(req.params.id), (req as any).user?.uid || 'admin');
    res.json({ payment: pay });
  } catch (error: any) {
    logger.error('Failed to void payment', error);
    res.status(400).json({ error: error.message || 'Failed to void' });
  }
});

app.get('/api/companies/:companyId/procurement/payments/:id/pdf', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const pay = await procurementRepository.getSupplierPayment(req.params.companyId, Number(req.params.id));
    if (!pay) return res.status(404).send('Payment not found');

    const pdf = await procurementDocumentService.generatePaymentVoucherPDF(pay);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Payment_${pay.paymentNumber}.pdf"`);
    res.send(pdf);
  } catch (error: any) {
    logger.error('Failed to generate payment voucher PDF', error);
    res.status(500).send('Failed to generate PDF');
  }
});

// 8. Supplier Statements & Reports
app.get('/api/companies/:companyId/procurement/suppliers/:id/statement', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo, branchId } = req.query;
    if (!dateFrom || !dateTo) return res.status(400).json({ error: 'dateFrom and dateTo are required' });
    const stmt = await procurementRepository.getSupplierStatement(
      req.params.companyId,
      Number(req.params.id),
      String(dateFrom),
      String(dateTo),
      branchId ? String(branchId) : undefined
    );
    res.json({ statement: stmt });
  } catch (error: any) {
    logger.error('Failed to get supplier statement', error);
    res.status(400).json({ error: error.message || 'Failed to calculate statement' });
  }
});

app.get('/api/companies/:companyId/procurement/suppliers/:id/statement/pdf', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo, branchId } = req.query;
    if (!dateFrom || !dateTo) return res.status(400).send('dateFrom and dateTo are required');
    const stmt = await procurementRepository.getSupplierStatement(
      req.params.companyId,
      Number(req.params.id),
      String(dateFrom),
      String(dateTo),
      branchId ? String(branchId) : undefined
    );
    const pdf = await procurementDocumentService.generateSupplierStatementPDF(stmt);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Statement_${stmt.supplier.code}.pdf"`);
    res.send(pdf);
  } catch (error: any) {
    logger.error('Failed to generate statement PDF', error);
    res.status(500).send('Failed to generate PDF');
  }
});

app.get('/api/companies/:companyId/procurement/suppliers/:id/statement/excel', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo, branchId } = req.query;
    if (!dateFrom || !dateTo) return res.status(400).send('dateFrom and dateTo are required');
    const stmt = await procurementRepository.getSupplierStatement(
      req.params.companyId,
      Number(req.params.id),
      String(dateFrom),
      String(dateTo),
      branchId ? String(branchId) : undefined
    );
    const excelBuffer = await procurementDocumentService.generateSupplierStatementExcel(stmt);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Statement_${stmt.supplier.code}.xlsx"`);
    res.send(excelBuffer);
  } catch (error: any) {
    logger.error('Failed to generate statement Excel', error);
    res.status(500).send('Failed to generate Excel statement');
  }
});

app.get('/api/companies/:companyId/procurement/reports/aging', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const report = await procurementRepository.getAPAgingReport(req.params.companyId);
    res.json({ agingReport: report });
  } catch (error: any) {
    logger.error('Failed to get AP aging report', error);
    res.status(500).json({ error: 'Failed to generate aging report' });
  }
});

// ============================================================================
// PROJECTS, SUBCONTRACTS, BILLING PROFILES & WORKFORCE DEPLOYMENT API ROUTES
// ============================================================================

// 1. Billing Profiles & Authorizations
app.get('/api/companies/:companyId/projects/billing-profiles', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const list = await projectsRepository.listBillingProfiles(req.params.companyId);
    res.json({ billingProfiles: list });
  } catch (error: any) {
    logger.error('Failed to list billing profiles', error);
    res.status(500).json({ error: 'Failed to retrieve billing profiles' });
  }
});

app.post('/api/companies/:companyId/projects/billing-profiles', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const profile = await projectsRepository.createBillingProfile(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ billingProfile: profile });
  } catch (error: any) {
    logger.error('Failed to create billing profile', error);
    res.status(400).json({ error: error.message || 'Failed to create billing profile' });
  }
});

app.post('/api/companies/:companyId/projects/billing-profiles/:id/authorizations', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) return res.status(400).json({ error: 'Invalid billing profile ID' });
    const auth = await projectsRepository.createBillingAuthorization(req.params.companyId, {
      ...req.body,
      billingProfileId: id,
    }, (req as any).user?.uid || 'admin');
    res.status(201).json({ authorization: auth });
  } catch (error: any) {
    logger.error('Failed to create billing authorization', error);
    res.status(400).json({ error: error.message || 'Failed to create authorization' });
  }
});

app.get('/api/companies/:companyId/projects/billing-profiles/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) return res.status(400).json({ error: 'Invalid billing profile ID' });
    const profile = await projectsRepository.getBillingProfile(req.params.companyId, id);
    if (!profile) return res.status(404).json({ error: 'Billing profile not found' });
    res.json({ billingProfile: profile });
  } catch (error: any) {
    logger.error('Failed to get billing profile', error);
    res.status(500).json({ error: 'Failed to retrieve billing profile' });
  }
});

app.put('/api/companies/:companyId/projects/billing-profiles/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) return res.status(400).json({ error: 'Invalid billing profile ID' });
    const profile = await projectsRepository.updateBillingProfile(req.params.companyId, id, req.body, (req as any).user?.uid || 'admin');
    res.json({ billingProfile: profile });
  } catch (error: any) {
    logger.error('Failed to update billing profile', error);
    res.status(400).json({ error: error.message || 'Failed to update billing profile' });
  }
});

// 2. External Workers (Manpower Suppliers)
app.post('/api/companies/:companyId/projects/external-workers/bulk-delete/preflight', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const { workerIds } = req.body;
    const preflight = await projectsRepository.preflightBulkDeleteExternalWorkers(req.params.companyId, workerIds);
    res.json({ preflight });
  } catch (error: any) {
    logger.error('Failed to preflight bulk delete workers', error);
    res.status(400).json({ error: error.message || 'Failed bulk preflight' });
  }
});

app.post('/api/companies/:companyId/projects/external-workers/bulk-delete', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const { workerIds, reason } = req.body;
    const result = await projectsRepository.bulkDeleteExternalWorkers(req.params.companyId, {
      workerIds,
      reason,
      actorId: (req as any).user?.uid || 'admin',
    });
    res.json({ result });
  } catch (error: any) {
    logger.error('Failed to bulk delete workers', error);
    res.status(400).json({ error: error.message || 'Failed bulk delete' });
  }
});

app.get('/api/companies/:companyId/projects/external-workers', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const list = await projectsRepository.listExternalWorkers(req.params.companyId, {
      status: req.query.status as string,
      supplierId: req.query.supplierId ? Number(req.query.supplierId) : undefined,
    });
    res.json({ externalWorkers: list });
  } catch (error: any) {
    logger.error('Failed to list external workers', error);
    res.status(500).json({ error: 'Failed to retrieve external workers' });
  }
});

app.post('/api/companies/:companyId/projects/external-workers', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const worker = await projectsRepository.createExternalWorker(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ externalWorker: worker });
  } catch (error: any) {
    logger.error('Failed to create external worker', error);
    res.status(400).json({ error: error.message || 'Failed to create worker' });
  }
});

app.get('/api/companies/:companyId/projects/external-workers/:id/preflight', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) return res.status(400).json({ error: 'Invalid worker ID' });
    const preflight = await projectsRepository.preflightDeleteExternalWorker(req.params.companyId, id);
    res.json({ preflight });
  } catch (error: any) {
    logger.error('Failed to preflight delete worker', error);
    res.status(400).json({ error: error.message || 'Failed to preflight' });
  }
});

app.get('/api/companies/:companyId/projects/external-workers/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) return res.status(400).json({ error: 'Invalid worker ID' });
    const worker = await projectsRepository.getExternalWorker(req.params.companyId, id);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    res.json({ externalWorker: worker });
  } catch (error: any) {
    logger.error('Failed to get external worker', error);
    res.status(500).json({ error: 'Failed to retrieve worker' });
  }
});

app.put('/api/companies/:companyId/projects/external-workers/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) return res.status(400).json({ error: 'Invalid worker ID' });
    const worker = await projectsRepository.updateExternalWorker(req.params.companyId, id, req.body, (req as any).user?.uid || 'admin');
    res.json({ externalWorker: worker });
  } catch (error: any) {
    logger.error('Failed to update external worker', error);
    res.status(400).json({ error: error.message || 'Failed to update worker' });
  }
});

app.delete('/api/companies/:companyId/projects/external-workers/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) return res.status(400).json({ error: 'Invalid worker ID' });
    const { reason } = req.body;
    const result = await projectsRepository.deleteExternalWorker(req.params.companyId, id, (req as any).user?.uid || 'admin', reason);
    res.json({ result });
  } catch (error: any) {
    logger.error('Failed to delete worker', error);
    res.status(400).json({ error: error.message || 'Failed to delete worker' });
  }
});

// 3. Workforce Deployments (Unified Internal + External)
app.post('/api/companies/:companyId/projects/deployments/bulk', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const result = await projectsRepository.bulkDeployWorkers(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ result });
  } catch (error: any) {
    logger.error('Failed to bulk deploy workers', error);
    res.status(400).json({ error: error.message || 'Failed to bulk deploy' });
  }
});

app.get('/api/companies/:companyId/projects/deployments', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const list = await projectsRepository.listDeployments(req.params.companyId, {
      projectId: req.query.projectId ? Number(req.query.projectId) : undefined,
      workforceType: req.query.workforceType as string,
      status: req.query.status as string,
    });
    res.json({ deployments: list });
  } catch (error: any) {
    logger.error('Failed to list deployments', error);
    res.status(500).json({ error: 'Failed to retrieve deployments' });
  }
});

app.post('/api/companies/:companyId/projects/deployments', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const dep = await projectsRepository.createDeployment(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ deployment: dep });
  } catch (error: any) {
    logger.error('Failed to create deployment', error);
    res.status(400).json({ error: error.message || 'Failed to create deployment' });
  }
});

app.post('/api/companies/:companyId/projects/deployments/:id/transfer', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) return res.status(400).json({ error: 'Invalid deployment ID' });
    const transferred = await projectsRepository.transferDeployment(req.params.companyId, id, req.body, (req as any).user?.uid || 'admin');
    res.json({ deployment: transferred });
  } catch (error: any) {
    logger.error('Failed to transfer deployment', error);
    res.status(400).json({ error: error.message || 'Failed to transfer' });
  }
});

app.post('/api/companies/:companyId/projects/deployments/:id/end', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) return res.status(400).json({ error: 'Invalid deployment ID' });
    const ended = await projectsRepository.endDeployment(req.params.companyId, id, (req as any).user?.uid || 'admin', req.body.reason);
    res.json({ deployment: ended });
  } catch (error: any) {
    logger.error('Failed to end deployment', error);
    res.status(400).json({ error: error.message || 'Failed to end deployment' });
  }
});

app.delete('/api/companies/:companyId/projects/deployments/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) return res.status(400).json({ error: 'Invalid deployment ID' });
    const result = await projectsRepository.deleteDeployment(req.params.companyId, id, (req as any).user?.uid || 'admin');
    res.json({ result });
  } catch (error: any) {
    logger.error('Failed to delete deployment', error);
    res.status(400).json({ error: error.message || 'Failed to delete deployment' });
  }
});

// 4. External Labour Settlements
app.get('/api/companies/:companyId/projects/labour-settlements', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const list = await projectsRepository.listLabourSettlements(req.params.companyId, req.query.projectId ? Number(req.query.projectId) : undefined);
    res.json({ labourSettlements: list });
  } catch (error: any) {
    logger.error('Failed to list labour settlements', error);
    res.status(500).json({ error: 'Failed to retrieve settlements' });
  }
});

app.post('/api/companies/:companyId/projects/labour-settlements', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const settlement = await projectsRepository.createLabourSettlement(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ labourSettlement: settlement });
  } catch (error: any) {
    logger.error('Failed to create labour settlement', error);
    res.status(400).json({ error: error.message || 'Failed to create settlement' });
  }
});

app.post('/api/companies/:companyId/projects/labour-settlements/:id/approve', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) return res.status(400).json({ error: 'Invalid settlement ID' });
    const settlement = await projectsRepository.approveLabourSettlement(req.params.companyId, id, (req as any).user?.uid || 'admin');
    res.json({ labourSettlement: settlement });
  } catch (error: any) {
    logger.error('Failed to approve labour settlement', error);
    res.status(400).json({ error: error.message || 'Failed to approve' });
  }
});

app.post('/api/companies/:companyId/projects/labour-settlements/:id/create-bill', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) return res.status(400).json({ error: 'Invalid settlement ID' });
    const result = await projectsRepository.createSupplierBillFromSettlement(
      req.params.companyId,
      id,
      req.body.branchId || 'main_branch',
      (req as any).user?.uid || 'admin'
    );
    res.status(201).json({ result });
  } catch (error: any) {
    logger.error('Failed to generate supplier bill from labour settlement', error);
    res.status(400).json({ error: error.message || 'Failed to create bill' });
  }
});

// 5. Projects Master & Actions
app.post('/api/companies/:companyId/projects/bulk-delete/preflight', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const { projectIds } = req.body;
    const preflight = await projectsRepository.preflightBulkDeleteProjects(req.params.companyId, projectIds);
    res.json({ preflight });
  } catch (error: any) {
    logger.error('Failed to preflight bulk delete projects', error);
    res.status(400).json({ error: error.message || 'Failed to preflight bulk delete' });
  }
});

app.post('/api/companies/:companyId/projects/bulk-delete', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const { projectIds, reason } = req.body;
    const result = await projectsRepository.bulkDeleteProjects(req.params.companyId, {
      projectIds,
      reason,
      actorId: (req as any).user?.uid || 'admin',
    });
    res.json({ result });
  } catch (error: any) {
    logger.error('Failed to bulk delete projects', error);
    res.status(400).json({ error: error.message || 'Failed bulk delete' });
  }
});

app.get('/api/companies/:companyId/projects', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const list = await projectsRepository.listProjects(req.params.companyId, {
      status: req.query.status as string,
      clientId: req.query.clientId ? Number(req.query.clientId) : undefined,
    });
    res.json({ projects: list });
  } catch (error: any) {
    logger.error('Failed to list projects', error);
    res.status(500).json({ error: 'Failed to retrieve projects' });
  }
});

app.post('/api/companies/:companyId/projects', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const project = await projectsRepository.createProject(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ project });
  } catch (error: any) {
    logger.error('Failed to create project', error);
    res.status(400).json({ error: error.message || 'Failed to create project' });
  }
});

app.get('/api/companies/:companyId/projects/:id/preflight', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) return res.status(400).json({ error: 'Invalid project ID' });
    const preflight = await projectsRepository.preflightDeleteProject(req.params.companyId, id);
    res.json({ preflight });
  } catch (error: any) {
    logger.error('Failed to preflight project delete', error);
    res.status(400).json({ error: error.message || 'Failed to preflight delete' });
  }
});

app.get('/api/companies/:companyId/projects/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) return res.status(400).json({ error: 'Invalid project ID' });
    const project = await projectsRepository.getProject(req.params.companyId, id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json({ project });
  } catch (error: any) {
    logger.error('Failed to get project', error);
    res.status(500).json({ error: 'Failed to retrieve project details' });
  }
});

app.put('/api/companies/:companyId/projects/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) return res.status(400).json({ error: 'Invalid project ID' });
    const project = await projectsRepository.updateProject(req.params.companyId, id, req.body, (req as any).user?.uid || 'admin');
    res.json({ project });
  } catch (error: any) {
    logger.error('Failed to update project', error);
    res.status(400).json({ error: error.message || 'Failed to update project' });
  }
});

app.delete('/api/companies/:companyId/projects/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) return res.status(400).json({ error: 'Invalid project ID' });
    const { reason } = req.body;
    const result = await projectsRepository.deleteProject(req.params.companyId, id, (req as any).user?.uid || 'admin', reason);
    res.json({ result });
  } catch (error: any) {
    logger.error('Failed to delete project', error);
    res.status(400).json({ error: error.message || 'Failed to delete project' });
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
  try {
    const migrationRunner = new MigrationRunner();
    await migrationRunner.runAllMigrations();
  } catch (mErr) {
    logger.error('Migration execution warning or bypass:', mErr);
  }

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
