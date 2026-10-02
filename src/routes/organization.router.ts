/**
 * GulfHive ERP - Organization & Master Data Router
 * Handles system setup, company establishment, branches, departments, designations, business units, cost centers, fiscal years, banks, payment methods, and numbering sequences.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { companyRepository } from '../infrastructure/database/repositories/company.repository.ts';
import { masterDataRepository } from '../infrastructure/database/repositories/master-data.repository.ts';
import { numberingRepository } from '../infrastructure/database/repositories/numbering.repository.ts';
import { authenticateToken } from '../core/security/auth.middleware.ts';
import { appConfig } from '../core/config/app-config.ts';
import { GULFHIVE_MODULES } from '../modules/module.manifest.ts';
import { currentRuntime } from '../infrastructure/runtime/index.ts';
import { ValidationError, NotFoundError } from '../core/errors/app-error.ts';

export const organizationRouter = Router();

// Setup status
organizationRouter.get(['/system/setup-status', '/setup/status'], async (_req: Request, res: Response, next: NextFunction) => {
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
  } catch (error) {
    next(error);
  }
});

// System Status
organizationRouter.get('/system/status', async (_req: Request, res: Response, next: NextFunction) => {
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
  } catch (error) {
    next(error);
  }
});

// Company Establishment Wizard
organizationRouter.post(['/setup/company', '/setup/establish'], async (req: Request, res: Response, next: NextFunction) => {
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
      throw new ValidationError('Missing required company parameters: code, legalNameEn, legalNameAr, countryCode, baseCurrency');
    }

    if (!branchNameEn || !branchNameAr) {
      throw new ValidationError('Missing required main branch parameters: branchNameEn, branchNameAr');
    }

    if (!adminEmail) {
      throw new ValidationError('Administrator email is required.');
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
      adminPassword: req.body.adminPassword,
    });

    res.status(201).json({
      success: true,
      tenant: result.tenant,
      branch: result.branch,
      user: result.user,
      token: (result as any).token,
    });
  } catch (error) {
    next(error);
  }
});

// Companies List
organizationRouter.get('/companies', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await companyRepository.listCompanies();
    const authorized = req.user?.roles.includes('SUPER_ADMIN')
      ? list
      : list.filter((c: any) => req.user?.authorizedCompanyIds.includes(c.id));
    res.json({ companies: authorized });
  } catch (error) {
    next(error);
  }
});

// Company Details
organizationRouter.get('/companies/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await companyRepository.getCompanyById(req.params.id);
    if (!company) {
      throw new NotFoundError('Company', req.params.id);
    }
    res.json({ company });
  } catch (error) {
    next(error);
  }
});

// Update Company Details & Logo
organizationRouter.put('/companies/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await companyRepository.updateCompany(req.params.id, {
      ...req.body,
      actorId: req.user?.displayName || 'admin',
      actorEmail: req.user?.email || 'admin@gulfhive.internal',
    });
    res.json({ company: updated });
  } catch (error) {
    next(error);
  }
});

organizationRouter.patch('/companies/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await companyRepository.updateCompany(req.params.id, {
      ...req.body,
      actorId: req.user?.displayName || 'admin',
      actorEmail: req.user?.email || 'admin@gulfhive.internal',
    });
    res.json({ company: updated });
  } catch (error) {
    next(error);
  }
});

// Branches
organizationRouter.get('/companies/:id/branches', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branches = await masterDataRepository.listBranches(req.params.id);
    res.json({ branches });
  } catch (error) {
    next(error);
  }
});

organizationRouter.post('/companies/:id/branches', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, nameEn, nameAr, isMain, cityEn, cityAr, addressEn, addressAr, phone, actorId } = req.body;
    if (!code || !nameEn || !nameAr) {
      throw new ValidationError('Branch code, nameEn, and nameAr are required.');
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
  } catch (error) {
    next(error);
  }
});

organizationRouter.put('/companies/:companyId/branches/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await masterDataRepository.updateBranch(req.params.companyId, req.params.id, req.body, req.body.actorId || 'system');
    res.json({ branch: updated });
  } catch (error) {
    next(error);
  }
});

organizationRouter.delete('/companies/:companyId/branches/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await masterDataRepository.deleteBranch(req.params.companyId, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Departments
organizationRouter.get('/companies/:companyId/departments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await masterDataRepository.listDepartments(req.params.companyId);
    res.json({ departments: list });
  } catch (error) {
    next(error);
  }
});

organizationRouter.post('/companies/:companyId/departments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, nameEn, nameAr, parentDepartmentId, isActive, actorId } = req.body;
    if (!code || !nameEn || !nameAr) {
      throw new ValidationError('code, nameEn, and nameAr are required.');
    }
    const dept = await masterDataRepository.createDepartment(req.params.companyId, {
      code,
      nameEn,
      nameAr,
      parentDepartmentId,
      isActive,
    }, actorId || 'system');
    res.status(201).json({ department: dept });
  } catch (error) {
    next(error);
  }
});

organizationRouter.put('/companies/:companyId/departments/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await masterDataRepository.updateDepartment(req.params.companyId, req.params.id, req.body, req.body.actorId || 'system');
    res.json({ department: updated });
  } catch (error) {
    next(error);
  }
});

organizationRouter.delete('/companies/:companyId/departments/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await masterDataRepository.deleteDepartment(req.params.companyId, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Designations
organizationRouter.get('/companies/:companyId/designations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await masterDataRepository.listDesignations(req.params.companyId);
    res.json({ designations: list });
  } catch (error) {
    next(error);
  }
});

organizationRouter.post('/companies/:companyId/designations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, nameEn, nameAr, departmentId, descriptionEn, descriptionAr, grade, isActive, actorId } = req.body;
    if (!code || !nameEn || !nameAr) {
      throw new ValidationError('code, nameEn, and nameAr are required.');
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
  } catch (error) {
    next(error);
  }
});

organizationRouter.put('/companies/:companyId/designations/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await masterDataRepository.updateDesignation(req.params.companyId, req.params.id, req.body, req.body.actorId || 'system');
    res.json({ designation: updated });
  } catch (error) {
    next(error);
  }
});

organizationRouter.delete('/companies/:companyId/designations/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await masterDataRepository.deleteDesignation(req.params.companyId, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Employee Categories
organizationRouter.get('/companies/:companyId/employee-categories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await masterDataRepository.listEmployeeCategories(req.params.companyId);
    res.json({ employeeCategories: list });
  } catch (error) {
    next(error);
  }
});

organizationRouter.post('/companies/:companyId/employee-categories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = await masterDataRepository.createEmployeeCategory(req.params.companyId, req.body, req.body.actorId || 'system');
    res.status(201).json({ employeeCategory: category });
  } catch (error) {
    next(error);
  }
});

organizationRouter.put('/companies/:companyId/employee-categories/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = await masterDataRepository.updateEmployeeCategory(req.params.companyId, req.params.id, req.body, req.body.actorId || 'system');
    res.json({ employeeCategory: category });
  } catch (error) {
    next(error);
  }
});

organizationRouter.delete('/companies/:companyId/employee-categories/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await masterDataRepository.deleteEmployeeCategory(req.params.companyId, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Business Units
organizationRouter.get('/companies/:companyId/business-units', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await masterDataRepository.listBusinessUnits(req.params.companyId);
    res.json({ businessUnits: list });
  } catch (error) {
    next(error);
  }
});

organizationRouter.post('/companies/:companyId/business-units', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bu = await masterDataRepository.createBusinessUnit(req.params.companyId, req.body, req.body.actorId || 'system');
    res.status(201).json({ businessUnit: bu });
  } catch (error) {
    next(error);
  }
});

organizationRouter.put('/companies/:companyId/business-units/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bu = await masterDataRepository.updateBusinessUnit(req.params.companyId, req.params.id, req.body, req.body.actorId || 'system');
    res.json({ businessUnit: bu });
  } catch (error) {
    next(error);
  }
});

organizationRouter.delete('/companies/:companyId/business-units/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await masterDataRepository.deleteBusinessUnit(req.params.companyId, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Cost Centers
organizationRouter.get('/companies/:companyId/cost-centers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await masterDataRepository.listCostCenters(req.params.companyId);
    res.json({ costCenters: list });
  } catch (error) {
    next(error);
  }
});

organizationRouter.post('/companies/:companyId/cost-centers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cc = await masterDataRepository.createCostCenter(req.params.companyId, req.body, req.body.actorId || 'system');
    res.status(201).json({ costCenter: cc });
  } catch (error) {
    next(error);
  }
});

organizationRouter.put('/companies/:companyId/cost-centers/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cc = await masterDataRepository.updateCostCenter(req.params.companyId, req.params.id, req.body, req.body.actorId || 'system');
    res.json({ costCenter: cc });
  } catch (error) {
    next(error);
  }
});

organizationRouter.delete('/companies/:companyId/cost-centers/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await masterDataRepository.deleteCostCenter(req.params.companyId, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Fiscal Years
organizationRouter.get('/companies/:companyId/fiscal-years', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await masterDataRepository.listFiscalYears(req.params.companyId);
    res.json({ fiscalYears: list });
  } catch (error) {
    next(error);
  }
});

organizationRouter.post('/companies/:companyId/fiscal-years', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fy = await masterDataRepository.createFiscalYear(req.params.companyId, req.body, req.body.actorId || 'system');
    res.status(201).json({ fiscalYear: fy });
  } catch (error) {
    next(error);
  }
});

organizationRouter.put('/companies/:companyId/fiscal-years/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fy = await masterDataRepository.updateFiscalYear(req.params.companyId, req.params.id, req.body, req.body.actorId || 'system');
    res.json({ fiscalYear: fy });
  } catch (error) {
    next(error);
  }
});

organizationRouter.delete('/companies/:companyId/fiscal-years/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await masterDataRepository.deleteFiscalYear(req.params.companyId, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// System Reference Data
organizationRouter.get('/master/currencies', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await masterDataRepository.listCurrencies();
    res.json({ currencies: list });
  } catch (error) {
    next(error);
  }
});

organizationRouter.get('/master/countries', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await masterDataRepository.listCountries();
    res.json({ countries: list });
  } catch (error) {
    next(error);
  }
});

organizationRouter.get('/master/nationalities', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await masterDataRepository.listNationalities();
    res.json({ nationalities: list });
  } catch (error) {
    next(error);
  }
});

// Banks
organizationRouter.get('/companies/:companyId/banks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await masterDataRepository.listBanks(req.params.companyId);
    res.json({ banks: list });
  } catch (error) {
    next(error);
  }
});

organizationRouter.post('/companies/:companyId/banks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bank = await masterDataRepository.createBank(req.params.companyId, req.body, req.body.actorId || 'system');
    res.status(201).json({ bank });
  } catch (error) {
    next(error);
  }
});

organizationRouter.put('/companies/:companyId/banks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bank = await masterDataRepository.updateBank(req.params.companyId, req.params.id, req.body, req.body.actorId || 'system');
    res.json({ bank });
  } catch (error) {
    next(error);
  }
});

organizationRouter.delete('/companies/:companyId/banks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await masterDataRepository.deleteBank(req.params.companyId, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Payment Methods
organizationRouter.get('/companies/:companyId/payment-methods', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await masterDataRepository.listPaymentMethods(req.params.companyId);
    res.json({ paymentMethods: list });
  } catch (error) {
    next(error);
  }
});

organizationRouter.post('/companies/:companyId/payment-methods', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pm = await masterDataRepository.createPaymentMethod(req.params.companyId, req.body, req.body.actorId || 'system');
    res.status(201).json({ paymentMethod: pm });
  } catch (error) {
    next(error);
  }
});

organizationRouter.put('/companies/:companyId/payment-methods/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pm = await masterDataRepository.updatePaymentMethod(req.params.companyId, req.params.id, req.body, req.body.actorId || 'system');
    res.json({ paymentMethod: pm });
  } catch (error) {
    next(error);
  }
});

organizationRouter.delete('/companies/:companyId/payment-methods/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await masterDataRepository.deletePaymentMethod(req.params.companyId, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Document Types
organizationRouter.get('/companies/:companyId/document-types', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await masterDataRepository.listDocumentTypes(req.params.companyId);
    res.json({ documentTypes: list });
  } catch (error) {
    next(error);
  }
});

organizationRouter.post('/companies/:companyId/document-types', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const docType = await masterDataRepository.createDocumentType(req.params.companyId, req.body, req.body.actorId || 'system');
    res.status(201).json({ documentType: docType });
  } catch (error) {
    next(error);
  }
});

organizationRouter.put('/companies/:companyId/document-types/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const docType = await masterDataRepository.updateDocumentType(req.params.companyId, req.params.id, req.body, req.body.actorId || 'system');
    res.json({ documentType: docType });
  } catch (error) {
    next(error);
  }
});

organizationRouter.delete('/companies/:companyId/document-types/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await masterDataRepository.deleteDocumentType(req.params.companyId, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Numbering Engine
organizationRouter.get('/companies/:companyId/numbering', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await numberingRepository.listSequences(req.params.companyId);
    res.json({ sequences: list });
  } catch (error) {
    next(error);
  }
});

organizationRouter.post('/companies/:companyId/numbering', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const seq = await numberingRepository.upsertSequence(req.params.companyId, req.body, req.body.actorId || 'system');
    res.json({ sequence: seq });
  } catch (error) {
    next(error);
  }
});

organizationRouter.post('/companies/:companyId/numbering/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const preview = await numberingRepository.previewNumber(req.params.companyId, req.body);
    res.json(preview);
  } catch (error) {
    next(error);
  }
});

organizationRouter.post('/companies/:companyId/numbering/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { documentType, branchId, fiscalYearId } = req.body;
    if (!documentType) {
      throw new ValidationError('documentType is required.');
    }
    const number = await numberingRepository.generateNextNumber(req.params.companyId, documentType, branchId);
    res.json({ documentNumber: number });
  } catch (error) {
    next(error);
  }
});
