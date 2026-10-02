/**
 * GulfHive ERP - People & Employee Master Router
 * Handles Employee Master, Assignments, Contracts, Salary Assignments, Bank Accounts, Documents, Emergency Contacts, Dependents, and Bulk Operations.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { peopleRepository } from '../infrastructure/database/repositories/people.repository.ts';
import { sanitizeEmployeeRecord } from '../core/security/auth.middleware.ts';
import { ValidationError, NotFoundError } from '../core/errors/app-error.ts';
import { logger } from '../core/logging/logger.ts';

export const peopleRouter = Router();

// Employee List
peopleRouter.get('/companies/:companyId/employees', async (req: Request, res: Response, next: NextFunction) => {
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
    const safeList = list.map((emp) => sanitizeEmployeeRecord(emp, req.user, req.params.companyId));
    res.json({ employees: safeList });
  } catch (error) {
    next(error);
  }
});

// Employee Details
peopleRouter.get('/companies/:companyId/employees/:employeeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employee = await peopleRepository.getEmployeeById(req.params.companyId, req.params.employeeId);
    if (!employee) {
      throw new NotFoundError('Employee', req.params.employeeId);
    }
    const safeEmployee = sanitizeEmployeeRecord(employee, req.user, req.params.companyId);
    res.json({ employee: safeEmployee });
  } catch (error) {
    next(error);
  }
});

// Create Employee
peopleRouter.post('/companies/:companyId/employees', async (req: Request, res: Response, next: NextFunction) => {
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
      documents,
      actorId,
      actorEmail,
    } = req.body;

    if (!branchId || !firstNameEn || !lastNameEn || !firstNameAr || !lastNameAr || !email || !joiningDate || !basicSalary) {
      throw new ValidationError('Missing required employee fields: branchId, firstNameEn, lastNameEn, firstNameAr, lastNameAr, email, joiningDate, basicSalary.');
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
      documents: Array.isArray(documents) ? documents : undefined,
      actorId: actorId || 'admin',
      actorEmail: actorEmail || 'admin@gulfhive.internal',
    });

    res.status(201).json({ employee });
  } catch (error) {
    next(error);
  }
});

// Update Employee
peopleRouter.put('/companies/:companyId/employees/:employeeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await peopleRepository.updateEmployee(req.params.companyId, req.params.employeeId, {
      ...req.body,
      actorId: req.body.actorId || 'admin',
      actorEmail: req.body.actorEmail || 'admin@gulfhive.internal',
    });
    res.json({ employee: updated });
  } catch (error) {
    next(error);
  }
});

// Archive Employee
peopleRouter.post('/companies/:companyId/employees/:employeeId/archive', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { actorId, actorEmail } = req.body;
    const result = await peopleRepository.archiveEmployee(req.params.companyId, req.params.employeeId, actorId || 'admin', actorEmail);
    res.json({ employee: result });
  } catch (error) {
    next(error);
  }
});

// Delete Employee
peopleRouter.delete('/companies/:companyId/employees/:employeeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actorId = (req.query.actorId as string) || 'admin';
    const result = await peopleRepository.deleteEmployee(req.params.companyId, req.params.employeeId, actorId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Preflight Bulk Delete
peopleRouter.post('/companies/:companyId/employees/bulk-delete/preflight', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { employeeIds, allFiltered, filterCriteria } = req.body;
    const preflight = await peopleRepository.preflightBulkDelete(req.params.companyId, {
      employeeIds,
      allFiltered,
      filterCriteria,
    });
    res.json(preflight);
  } catch (error) {
    next(error);
  }
});

// Bulk Delete
peopleRouter.post('/companies/:companyId/employees/bulk-delete', async (req: Request, res: Response, next: NextFunction) => {
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
  } catch (error) {
    next(error);
  }
});

// Bulk Archive
peopleRouter.post('/companies/:companyId/employees/bulk-archive', async (req: Request, res: Response, next: NextFunction) => {
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
  } catch (error) {
    next(error);
  }
});

// Contracts
peopleRouter.post('/companies/:companyId/employees/:employeeId/contracts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contractType, startDate, endDate, probationDays, noticeDays, workingDaysPerWeek, workingHoursPerDay, terms, documentAttachmentId, actorId } = req.body;
    if (!contractType || !startDate) {
      throw new ValidationError('contractType and startDate are required.');
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
  } catch (error) {
    next(error);
  }
});

// Salary Assignments
peopleRouter.post('/companies/:companyId/employees/:employeeId/salaries', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currency, basicSalary, housingAllowance, transportAllowance, foodAllowance, otherAllowances, effectiveDate, actorId } = req.body;
    if (!basicSalary || !effectiveDate) {
      throw new ValidationError('basicSalary and effectiveDate are required.');
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
  } catch (error) {
    next(error);
  }
});

// Bank Accounts
peopleRouter.post('/companies/:companyId/employees/:employeeId/bank-accounts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { bankId, bankName, bankCode, accountName, iban, accountNumber, swiftBic, currency, isPrimary, actorId } = req.body;
    if (!bankName || !iban || !accountNumber) {
      throw new ValidationError('bankName, iban, and accountNumber are required.');
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
  } catch (error) {
    next(error);
  }
});

// Documents
peopleRouter.post('/companies/:companyId/employees/:employeeId/documents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { documentTypeId, documentType, documentNumber, issueDate, expiryDate, issuingAuthority, issuingCountry, attachmentUrl, fileName, notes, actorId } = req.body;
    if (!documentType || !documentNumber || !expiryDate) {
      throw new ValidationError('documentType, documentNumber, and expiryDate are required.');
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
  } catch (error) {
    next(error);
  }
});

peopleRouter.delete('/companies/:companyId/employees/:employeeId/documents/:documentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actorId = (req.query.actorId as string) || req.user?.displayName || 'admin';
    const deleted = await peopleRepository.deleteEmployeeDocument(req.params.companyId, req.params.employeeId, req.params.documentId, actorId);
    res.json({ success: true, document: deleted });
  } catch (error) {
    next(error);
  }
});

// Emergency Contacts
peopleRouter.post('/companies/:companyId/employees/:employeeId/emergency-contacts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, relationship, phone, alternatePhone, isPrimary, actorId } = req.body;
    if (!name || !relationship || !phone) {
      throw new ValidationError('name, relationship, and phone are required.');
    }
    const contact = await peopleRepository.addEmergencyContact(req.params.companyId, req.params.employeeId, name, relationship, phone, alternatePhone, isPrimary, actorId || 'admin');
    res.status(201).json({ contact });
  } catch (error) {
    next(error);
  }
});

// Dependents
peopleRouter.post('/companies/:companyId/employees/:employeeId/dependents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, nameAr, relationship, dateOfBirth, civilId, actorId } = req.body;
    if (!name || !relationship) {
      throw new ValidationError('name and relationship are required.');
    }
    const dependent = await peopleRepository.addDependent(
      req.params.companyId,
      req.params.employeeId,
      name,
      nameAr || name,
      relationship,
      dateOfBirth,
      undefined,
      civilId,
      actorId || 'admin'
    );
    res.status(201).json({ dependent });
  } catch (error) {
    next(error);
  }
});
