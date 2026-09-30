/**
 * GulfHive ERP - Authoritative People Module Repository
 * Manages Employee Master, Assignments History, Contracts, Salary Setup, Bank Accounts, Documents, Emergency Contacts, and Dependents.
 */

import { eq, and, desc, sql, asc, or, inArray } from 'drizzle-orm';
import { db } from '../../../db/index.ts';
import {
  departments,
  designations,
  employees,
  employeeAssignments,
  employeeContracts,
  employeeSalaries,
  employeeBankDetails,
  employeeDocuments,
  employeeEmergencyContacts,
  employeeDependents,
  employeeHistory,
  branches,
  employeeCategories,
  businessUnits,
  costCenters,
  nationalities,
  banks,
  documentTypes,
  auditLogs,
  attendanceRecords,
  payrollItems,
  rosterAssignments,
  finalSettlements,
} from '../../../db/schema.ts';
import { numberingRepository } from './numbering.repository.ts';
import { logger } from '../../../core/logging/logger.ts';

export interface CreateDepartmentInput {
  code: string;
  nameEn: string;
  nameAr: string;
  parentDepartmentId?: string;
}

export interface CreateDesignationInput {
  departmentId?: string;
  code: string;
  nameEn: string;
  nameAr: string;
  grade?: string;
}

export interface CreateEmployeeInput {
  branchId: string;
  departmentId?: string;
  designationId?: string;
  employeeCategoryId?: string;
  businessUnitId?: string;
  costCenterId?: string;
  nationalityId?: number;
  managerEmployeeId?: string;
  userId?: number;

  employeeNumber?: string;
  firstNameEn: string;
  middleNameEn?: string;
  lastNameEn: string;
  firstNameAr: string;
  middleNameAr?: string;
  lastNameAr: string;

  gender: string;
  dateOfBirth?: string;
  maritalStatus?: string;
  nationality: string;

  civilIdNumber?: string;
  passportNumber?: string;

  workEmail?: string;
  personalEmail?: string;
  workPhone?: string;
  personalPhone?: string;
  phone?: string;
  email: string;

  addressEn?: string;
  addressAr?: string;

  joiningDate: string;
  employmentStatus?: string; // DRAFT, ACTIVE, ON_LEAVE, SUSPENDED, INACTIVE, TERMINATED, ARCHIVED
  contractType?: string; // LIMITED, UNLIMITED, PROJECT_BASED, PART_TIME, TEMPORARY
  workLocation?: string;
  photoPath?: string;
  avatarUrl?: string;

  // Contract details
  contractStartDate?: string;
  contractEndDate?: string;
  probationDays?: number;
  noticeDays?: number;
  workingDaysPerWeek?: number;
  workingHoursPerDay?: number;

  // Salary setup
  currency?: string;
  basicSalary: string;
  housingAllowance?: string;
  transportAllowance?: string;
  foodAllowance?: string;
  otherAllowances?: string;

  // Bank details (WPS)
  bankId?: string;
  bankName?: string;
  bankCode?: string;
  accountName?: string;
  iban?: string;
  accountNumber?: string;
  swiftBic?: string;

  // Initial Documents Expiry
  civilIdExpiry?: string;
  passportExpiry?: string;

  // Emergency Contact & Dependents
  emergencyContactName?: string;
  emergencyContactRelationship?: string;
  emergencyContactPhone?: string;

  actorId: string;
  actorEmail?: string;
}

export interface UpdateEmployeeInput extends Partial<CreateEmployeeInput> {
  actorId: string;
  actorEmail?: string;
}

export interface AddContractInput {
  contractNumber?: string;
  contractType: string;
  startDate: string;
  endDate?: string;
  probationDays?: number;
  noticeDays?: number;
  workingDaysPerWeek?: number;
  workingHoursPerDay?: number;
  terms?: string;
  documentAttachmentId?: string;
  actorId: string;
}

export interface AddSalaryInput {
  currency: string;
  basicSalary: string;
  housingAllowance?: string;
  transportAllowance?: string;
  foodAllowance?: string;
  otherAllowances?: string;
  effectiveDate: string;
  actorId: string;
}

export interface AddBankAccountInput {
  bankId?: string;
  bankName: string;
  bankCode?: string;
  accountName?: string;
  iban: string;
  accountNumber: string;
  swiftBic?: string;
  currency?: string;
  isPrimary?: boolean;
  actorId: string;
}

export interface AddDocumentInput {
  documentTypeId?: string;
  documentType: string;
  documentNumber: string;
  issueDate?: string;
  expiryDate: string;
  issuingAuthority?: string;
  issuingCountry?: string;
  attachmentUrl?: string;
  fileName?: string;
  notes?: string;
  actorId?: string;
}

export class PeopleRepository {
  // --- Departments ---
  public async listDepartments(tenantId: string) {
    return db.select().from(departments)
      .where(and(eq(departments.tenantId, tenantId), eq(departments.isActive, true)))
      .orderBy(asc(departments.code));
  }

  public async createDepartment(tenantId: string, input: CreateDepartmentInput) {
    const id = `dept_${input.code.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
    const [inserted] = await db.insert(departments).values({
      id,
      tenantId,
      code: input.code.toUpperCase().trim(),
      nameEn: input.nameEn.trim(),
      nameAr: input.nameAr.trim(),
      parentDepartmentId: input.parentDepartmentId || null,
      isActive: true,
    }).returning();
    return inserted;
  }

  // --- Designations ---
  public async listDesignations(tenantId: string) {
    return db.select({
      id: designations.id,
      code: designations.code,
      nameEn: designations.nameEn,
      nameAr: designations.nameAr,
      grade: designations.grade,
      departmentId: designations.departmentId,
      departmentNameEn: departments.nameEn,
      departmentNameAr: departments.nameAr,
      isActive: designations.isActive,
    })
      .from(designations)
      .leftJoin(departments, eq(designations.departmentId, departments.id))
      .where(and(eq(designations.tenantId, tenantId), eq(designations.isActive, true)))
      .orderBy(asc(designations.code));
  }

  public async createDesignation(tenantId: string, input: CreateDesignationInput) {
    const id = `des_${input.code.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
    const [inserted] = await db.insert(designations).values({
      id,
      tenantId,
      departmentId: input.departmentId || null,
      code: input.code.toUpperCase().trim(),
      nameEn: input.nameEn.trim(),
      nameAr: input.nameAr.trim(),
      grade: input.grade || null,
      isActive: true,
    }).returning();
    return inserted;
  }

  // --- Employee Master ---
  public async listEmployees(
    tenantId: string,
    filters?: {
      branchId?: string;
      departmentId?: string;
      designationId?: string;
      employeeCategoryId?: string;
      businessUnitId?: string;
      costCenterId?: string;
      status?: string;
      search?: string;
      nationality?: string;
    }
  ) {
    const conditions = [eq(employees.tenantId, tenantId)];

    if (filters?.branchId) conditions.push(eq(employees.branchId, filters.branchId));
    if (filters?.departmentId) conditions.push(eq(employees.departmentId, filters.departmentId));
    if (filters?.designationId) conditions.push(eq(employees.designationId, filters.designationId));
    if (filters?.employeeCategoryId) conditions.push(eq(employees.employeeCategoryId, filters.employeeCategoryId));
    if (filters?.businessUnitId) conditions.push(eq(employees.businessUnitId, filters.businessUnitId));
    if (filters?.costCenterId) conditions.push(eq(employees.costCenterId, filters.costCenterId));
    if (filters?.status) conditions.push(eq(employees.employmentStatus, filters.status));
    if (filters?.nationality) conditions.push(eq(employees.nationality, filters.nationality));

    if (filters?.search && filters.search.trim().length > 0) {
      const q = `%${filters.search.trim().toLowerCase()}%`;
      conditions.push(
        or(
          sql`LOWER(${employees.employeeNumber}) LIKE ${q}`,
          sql`LOWER(${employees.firstNameEn}) LIKE ${q}`,
          sql`LOWER(${employees.lastNameEn}) LIKE ${q}`,
          sql`LOWER(${employees.firstNameAr}) LIKE ${q}`,
          sql`LOWER(${employees.lastNameAr}) LIKE ${q}`,
          sql`LOWER(${employees.civilIdNumber}) LIKE ${q}`,
          sql`LOWER(${employees.passportNumber}) LIKE ${q}`,
          sql`LOWER(${employees.email}) LIKE ${q}`,
          sql`LOWER(${employees.phone}) LIKE ${q}`
        )!
      );
    }

    return db.select({
      id: employees.id,
      numericId: employees.numericId,
      employeeNumber: employees.employeeNumber,
      firstNameEn: employees.firstNameEn,
      middleNameEn: employees.middleNameEn,
      lastNameEn: employees.lastNameEn,
      firstNameAr: employees.firstNameAr,
      middleNameAr: employees.middleNameAr,
      lastNameAr: employees.lastNameAr,
      displayNameEn: employees.displayNameEn,
      displayNameAr: employees.displayNameAr,
      gender: employees.gender,
      maritalStatus: employees.maritalStatus,
      nationality: employees.nationality,
      civilIdNumber: employees.civilIdNumber,
      passportNumber: employees.passportNumber,
      phone: employees.phone,
      email: employees.email,
      workEmail: employees.workEmail,
      joiningDate: employees.joiningDate,
      employmentStatus: employees.employmentStatus,
      contractType: employees.contractType,
      workLocation: employees.workLocation,
      avatarUrl: employees.avatarUrl,
      photoPath: employees.photoPath,
      branchId: employees.branchId,
      branchCode: branches.code,
      branchNameEn: branches.nameEn,
      branchNameAr: branches.nameAr,
      departmentId: employees.departmentId,
      departmentNameEn: departments.nameEn,
      departmentNameAr: departments.nameAr,
      designationId: employees.designationId,
      designationNameEn: designations.nameEn,
      designationNameAr: designations.nameAr,
      employeeCategoryId: employees.employeeCategoryId,
      categoryNameEn: employeeCategories.nameEn,
      categoryNameAr: employeeCategories.nameAr,
      businessUnitId: employees.businessUnitId,
      businessUnitNameEn: businessUnits.nameEn,
      businessUnitNameAr: businessUnits.nameAr,
      costCenterId: employees.costCenterId,
      costCenterCode: costCenters.code,
      costCenterNameEn: costCenters.nameEn,
      costCenterNameAr: costCenters.nameAr,
      managerEmployeeId: employees.managerEmployeeId,
      createdAt: employees.createdAt,
    })
      .from(employees)
      .leftJoin(branches, eq(employees.branchId, branches.id))
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .leftJoin(designations, eq(employees.designationId, designations.id))
      .leftJoin(employeeCategories, eq(employees.employeeCategoryId, employeeCategories.id))
      .leftJoin(businessUnits, eq(employees.businessUnitId, businessUnits.id))
      .leftJoin(costCenters, eq(employees.costCenterId, costCenters.id))
      .where(and(...conditions))
      .orderBy(asc(employees.employeeNumber));
  }

  public async getEmployeeById(tenantId: string, employeeId: string) {
    const empRows = await db.select({
      id: employees.id,
      numericId: employees.numericId,
      tenantId: employees.tenantId,
      employeeNumber: employees.employeeNumber,
      firstNameEn: employees.firstNameEn,
      middleNameEn: employees.middleNameEn,
      lastNameEn: employees.lastNameEn,
      firstNameAr: employees.firstNameAr,
      middleNameAr: employees.middleNameAr,
      lastNameAr: employees.lastNameAr,
      displayNameEn: employees.displayNameEn,
      displayNameAr: employees.displayNameAr,
      gender: employees.gender,
      dateOfBirth: employees.dateOfBirth,
      maritalStatus: employees.maritalStatus,
      nationality: employees.nationality,
      nationalityId: employees.nationalityId,
      civilIdNumber: employees.civilIdNumber,
      passportNumber: employees.passportNumber,
      workEmail: employees.workEmail,
      personalEmail: employees.personalEmail,
      workPhone: employees.workPhone,
      personalPhone: employees.personalPhone,
      phone: employees.phone,
      email: employees.email,
      addressEn: employees.addressEn,
      addressAr: employees.addressAr,
      joiningDate: employees.joiningDate,
      employmentStatus: employees.employmentStatus,
      contractType: employees.contractType,
      workLocation: employees.workLocation,
      avatarUrl: employees.avatarUrl,
      photoPath: employees.photoPath,
      managerEmployeeId: employees.managerEmployeeId,
      userId: employees.userId,
      branchId: employees.branchId,
      branchCode: branches.code,
      branchNameEn: branches.nameEn,
      branchNameAr: branches.nameAr,
      departmentId: employees.departmentId,
      departmentNameEn: departments.nameEn,
      departmentNameAr: departments.nameAr,
      designationId: employees.designationId,
      designationNameEn: designations.nameEn,
      designationNameAr: designations.nameAr,
      employeeCategoryId: employees.employeeCategoryId,
      categoryNameEn: employeeCategories.nameEn,
      categoryNameAr: employeeCategories.nameAr,
      businessUnitId: employees.businessUnitId,
      businessUnitNameEn: businessUnits.nameEn,
      businessUnitNameAr: businessUnits.nameAr,
      costCenterId: employees.costCenterId,
      costCenterCode: costCenters.code,
      costCenterNameEn: costCenters.nameEn,
      costCenterNameAr: costCenters.nameAr,
      createdAt: employees.createdAt,
      createdBy: employees.createdBy,
      updatedAt: employees.updatedAt,
      updatedBy: employees.updatedBy,
    })
      .from(employees)
      .leftJoin(branches, eq(employees.branchId, branches.id))
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .leftJoin(designations, eq(employees.designationId, designations.id))
      .leftJoin(employeeCategories, eq(employees.employeeCategoryId, employeeCategories.id))
      .leftJoin(businessUnits, eq(employees.businessUnitId, businessUnits.id))
      .leftJoin(costCenters, eq(employees.costCenterId, costCenters.id))
      .where(and(eq(employees.tenantId, tenantId), eq(employees.id, employeeId)))
      .limit(1);

    if (!empRows[0]) return null;
    const employee = empRows[0];

    // Fetch related child collections
    const [assignmentsList, contractsList, salariesList, bankList, documentsList, emergencyList, dependentsList, historyList] = await Promise.all([
      db.select({
        id: employeeAssignments.id,
        branchId: employeeAssignments.branchId,
        branchNameEn: branches.nameEn,
        branchNameAr: branches.nameAr,
        departmentId: employeeAssignments.departmentId,
        departmentNameEn: departments.nameEn,
        departmentNameAr: departments.nameAr,
        designationId: employeeAssignments.designationId,
        designationNameEn: designations.nameEn,
        designationNameAr: designations.nameAr,
        effectiveFrom: employeeAssignments.effectiveFrom,
        effectiveTo: employeeAssignments.effectiveTo,
        reason: employeeAssignments.reason,
        status: employeeAssignments.status,
      })
        .from(employeeAssignments)
        .leftJoin(branches, eq(employeeAssignments.branchId, branches.id))
        .leftJoin(departments, eq(employeeAssignments.departmentId, departments.id))
        .leftJoin(designations, eq(employeeAssignments.designationId, designations.id))
        .where(eq(employeeAssignments.employeeId, employeeId))
        .orderBy(desc(employeeAssignments.effectiveFrom)),

      db.select().from(employeeContracts).where(eq(employeeContracts.employeeId, employeeId)).orderBy(desc(employeeContracts.startDate)),
      db.select().from(employeeSalaries).where(eq(employeeSalaries.employeeId, employeeId)).orderBy(desc(employeeSalaries.effectiveDate)),
      db.select().from(employeeBankDetails).where(eq(employeeBankDetails.employeeId, employeeId)),
      db.select().from(employeeDocuments).where(eq(employeeDocuments.employeeId, employeeId)).orderBy(asc(employeeDocuments.expiryDate)),
      db.select().from(employeeEmergencyContacts).where(eq(employeeEmergencyContacts.employeeId, employeeId)),
      db.select().from(employeeDependents).where(eq(employeeDependents.employeeId, employeeId)),
      db.select().from(employeeHistory).where(eq(employeeHistory.employeeId, employeeId)).orderBy(desc(employeeHistory.effectiveDate)),
    ]);

    return {
      ...employee,
      assignments: assignmentsList,
      contracts: contractsList,
      salaries: salariesList,
      bankDetails: bankList.find((b) => b.isPrimary) || bankList[0] || null,
      bankAccounts: bankList,
      documents: documentsList,
      emergencyContacts: emergencyList,
      dependents: dependentsList,
      history: historyList,
    };
  }

  /**
   * Cross-Company Master Validation Guard
   */
  private async validateCompanyRelations(
    tenantId: string,
    branchId: string,
    departmentId?: string,
    designationId?: string,
    employeeCategoryId?: string,
    businessUnitId?: string,
    costCenterId?: string
  ) {
    // 1. Branch Check
    const [b] = await db.select().from(branches).where(and(eq(branches.id, branchId), eq(branches.tenantId, tenantId))).limit(1);
    if (!b) {
      throw new Error('Cross-company reference violation: Branch does not belong to the selected company.');
    }

    // 2. Department Check
    if (departmentId) {
      const [d] = await db.select().from(departments).where(and(eq(departments.id, departmentId), eq(departments.tenantId, tenantId))).limit(1);
      if (!d) {
        throw new Error('Cross-company reference violation: Department does not belong to the selected company.');
      }
    }

    // 3. Designation Check
    if (designationId) {
      const [des] = await db.select().from(designations).where(and(eq(designations.id, designationId), eq(designations.tenantId, tenantId))).limit(1);
      if (!des) {
        throw new Error('Cross-company reference violation: Designation does not belong to the selected company.');
      }
    }

    // 4. Employee Category Check
    if (employeeCategoryId) {
      const [cat] = await db.select().from(employeeCategories).where(and(eq(employeeCategories.id, employeeCategoryId), eq(employeeCategories.tenantId, tenantId))).limit(1);
      if (!cat) {
        throw new Error('Cross-company reference violation: Employee Category does not belong to the selected company.');
      }
    }

    // 5. Business Unit Check
    if (businessUnitId) {
      const [bu] = await db.select().from(businessUnits).where(and(eq(businessUnits.id, businessUnitId), eq(businessUnits.tenantId, tenantId))).limit(1);
      if (!bu) {
        throw new Error('Cross-company reference violation: Business Unit does not belong to the selected company.');
      }
    }

    // 6. Cost Center Check
    if (costCenterId) {
      const [cc] = await db.select().from(costCenters).where(and(eq(costCenters.id, costCenterId), eq(costCenters.tenantId, tenantId))).limit(1);
      if (!cc) {
        throw new Error('Cross-company reference violation: Cost Center does not belong to the selected company.');
      }
    }
  }

  public async createEmployee(tenantId: string, input: CreateEmployeeInput) {
    // 1. Cross-company reference validation
    await this.validateCompanyRelations(
      tenantId,
      input.branchId,
      input.departmentId,
      input.designationId,
      input.employeeCategoryId,
      input.businessUnitId,
      input.costCenterId
    );

    // 2. Resolve Employee Code via Central Numbering Engine
    let empNumber = input.employeeNumber?.trim().toUpperCase();
    if (!empNumber) {
      empNumber = await numberingRepository.generateNextNumber(tenantId, 'EMPLOYEE', input.branchId);
    }

    return db.transaction(async (tx) => {
      // 3. Check duplicate constraints
      const existingCode = await tx.select().from(employees)
        .where(and(eq(employees.tenantId, tenantId), eq(employees.employeeNumber, empNumber!)))
        .limit(1);

      if (existingCode.length > 0) {
        throw new Error(`Employee code '${empNumber}' is already registered in this company.`);
      }

      if (input.civilIdNumber && input.civilIdNumber.trim().length > 0) {
        const existingCivilId = await tx.select().from(employees)
          .where(and(eq(employees.tenantId, tenantId), eq(employees.civilIdNumber, input.civilIdNumber.trim())))
          .limit(1);
        if (existingCivilId.length > 0) {
          throw new Error(`Civil ID / Residency Number '${input.civilIdNumber}' is already registered to another employee.`);
        }
      }

      if (input.passportNumber && input.passportNumber.trim().length > 0) {
        const existingPassport = await tx.select().from(employees)
          .where(and(eq(employees.tenantId, tenantId), eq(employees.passportNumber, input.passportNumber.trim())))
          .limit(1);
        if (existingPassport.length > 0) {
          throw new Error(`Passport Number '${input.passportNumber}' is already registered to another employee.`);
        }
      }

      const employeeId = `emp_${empNumber!.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
      const joiningDateObj = new Date(input.joiningDate);

      // Display name helpers
      const dispNameEn = `${input.firstNameEn.trim()} ${input.lastNameEn.trim()}`;
      const dispNameAr = `${input.firstNameAr.trim()} ${input.lastNameAr.trim()}`;

      // 4. Insert Employee Master
      const [insertedEmp] = await tx.insert(employees).values({
        id: employeeId,
        tenantId,
        branchId: input.branchId,
        departmentId: input.departmentId || null,
        designationId: input.designationId || null,
        employeeCategoryId: input.employeeCategoryId || null,
        businessUnitId: input.businessUnitId || null,
        costCenterId: input.costCenterId || null,
        nationalityId: input.nationalityId || null,
        managerEmployeeId: input.managerEmployeeId || null,
        userId: input.userId || null,
        employeeNumber: empNumber!,
        firstNameEn: input.firstNameEn.trim(),
        middleNameEn: input.middleNameEn?.trim() || null,
        lastNameEn: input.lastNameEn.trim(),
        firstNameAr: input.firstNameAr.trim(),
        middleNameAr: input.middleNameAr?.trim() || null,
        lastNameAr: input.lastNameAr.trim(),
        displayNameEn: dispNameEn,
        displayNameAr: dispNameAr,
        gender: input.gender,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
        maritalStatus: input.maritalStatus || 'SINGLE',
        nationality: input.nationality.trim(),
        civilIdNumber: input.civilIdNumber?.trim() || null,
        passportNumber: input.passportNumber?.trim() || null,
        workEmail: input.workEmail?.toLowerCase().trim() || null,
        personalEmail: input.personalEmail?.toLowerCase().trim() || null,
        workPhone: input.workPhone?.trim() || null,
        personalPhone: input.personalPhone?.trim() || null,
        phone: input.phone?.trim() || input.workPhone?.trim() || null,
        email: input.email.toLowerCase().trim(),
        addressEn: input.addressEn?.trim() || null,
        addressAr: input.addressAr?.trim() || null,
        joiningDate: joiningDateObj,
        employmentStatus: input.employmentStatus || 'ACTIVE',
        contractType: input.contractType || 'UNLIMITED',
        workLocation: input.workLocation || null,
        avatarUrl: input.avatarUrl || null,
        photoPath: input.photoPath || input.avatarUrl || null,
        createdBy: input.actorEmail || input.actorId,
      }).returning();

      // 5. Insert Initial Assignment Record
      await tx.insert(employeeAssignments).values({
        id: `asg_${employeeId}_1`,
        tenantId,
        employeeId,
        branchId: input.branchId,
        departmentId: input.departmentId || null,
        designationId: input.designationId || null,
        employeeCategoryId: input.employeeCategoryId || null,
        businessUnitId: input.businessUnitId || null,
        costCenterId: input.costCenterId || null,
        managerEmployeeId: input.managerEmployeeId || null,
        effectiveFrom: joiningDateObj,
        reason: 'JOINING',
        status: 'ACTIVE',
        createdBy: input.actorEmail || input.actorId,
      });

      // 6. Insert Initial Contract
      const contractId = `cnt_${employeeId}_1`;
      await tx.insert(employeeContracts).values({
        id: contractId,
        tenantId,
        employeeId,
        contractNumber: `CNT-${empNumber}`,
        contractType: input.contractType || 'UNLIMITED',
        startDate: input.contractStartDate ? new Date(input.contractStartDate) : joiningDateObj,
        endDate: input.contractEndDate ? new Date(input.contractEndDate) : null,
        probationPeriodDays: input.probationDays || 90,
        noticePeriodDays: input.noticeDays || 90,
        workingDaysPerWeek: input.workingDaysPerWeek || 5,
        workingHoursPerDay: input.workingHoursPerDay || 8,
        status: 'ACTIVE',
        createdBy: input.actorEmail || input.actorId,
      });

      // 7. Insert Initial Salary Assignment
      const salaryId = `sal_${employeeId}_1`;
      await tx.insert(employeeSalaries).values({
        id: salaryId,
        tenantId,
        employeeId,
        currency: (input.currency || 'KWD').toUpperCase(),
        basicSalary: input.basicSalary,
        housingAllowance: input.housingAllowance || '0.000',
        transportAllowance: input.transportAllowance || '0.000',
        foodAllowance: input.foodAllowance || '0.000',
        otherAllowances: input.otherAllowances || '0.000',
        effectiveDate: joiningDateObj,
        isActive: true,
        status: 'ACTIVE',
        createdBy: input.actorEmail || input.actorId,
      });

      // 8. Insert Bank Details (if provided)
      if (input.iban && input.accountNumber) {
        const bankDetailsId = `bnk_${employeeId}_1`;
        await tx.insert(employeeBankDetails).values({
          id: bankDetailsId,
          tenantId,
          employeeId,
          bankId: input.bankId || null,
          bankName: input.bankName?.trim() || 'Bank Transfer',
          bankCode: input.bankCode || null,
          accountName: input.accountName || dispNameEn,
          iban: input.iban.toUpperCase().replace(/\s/g, ''),
          accountNumber: input.accountNumber.trim(),
          swiftBic: input.swiftBic?.toUpperCase() || null,
          currency: (input.currency || 'KWD').toUpperCase(),
          isPrimary: true,
          status: 'ACTIVE',
          createdBy: input.actorEmail || input.actorId,
        });
      }

      // 9. Insert Documents (Civil ID, Passport)
      if (input.civilIdNumber && input.civilIdExpiry) {
        await tx.insert(employeeDocuments).values({
          id: `doc_cid_${employeeId}`,
          tenantId,
          employeeId,
          documentType: 'CIVIL_ID',
          documentNumber: input.civilIdNumber.trim(),
          expiryDate: new Date(input.civilIdExpiry),
          status: new Date(input.civilIdExpiry) < new Date() ? 'EXPIRED' : 'VALID',
          createdBy: input.actorEmail || input.actorId,
        });
      }

      if (input.passportNumber && input.passportExpiry) {
        await tx.insert(employeeDocuments).values({
          id: `doc_pass_${employeeId}`,
          tenantId,
          employeeId,
          documentType: 'PASSPORT',
          documentNumber: input.passportNumber.trim(),
          expiryDate: new Date(input.passportExpiry),
          status: new Date(input.passportExpiry) < new Date() ? 'EXPIRED' : 'VALID',
          createdBy: input.actorEmail || input.actorId,
        });
      }

      // 10. Insert Emergency Contact if provided
      if (input.emergencyContactName && input.emergencyContactPhone) {
        await tx.insert(employeeEmergencyContacts).values({
          id: `emg_${employeeId}_1`,
          tenantId,
          employeeId,
          name: input.emergencyContactName.trim(),
          relationship: input.emergencyContactRelationship || 'SPOUSE',
          phone: input.emergencyContactPhone.trim(),
          isPrimary: true,
          createdBy: input.actorEmail || input.actorId,
        });
      }

      // 11. Insert Initial History Log
      await tx.insert(employeeHistory).values({
        tenantId,
        employeeId,
        changeType: 'JOINING',
        descriptionEn: `Employee joined organization as ${empNumber}`,
        descriptionAr: `التحق بالمنشأة برقم وظيفي ${empNumber}`,
        previousState: null,
        newState: {
          employeeNumber: empNumber,
          nameEn: dispNameEn,
          branchId: input.branchId,
          departmentId: input.departmentId,
          designationId: input.designationId,
          joiningDate: input.joiningDate,
        },
        effectiveDate: joiningDateObj,
        recordedBy: input.actorEmail || input.actorId,
      });

      // 12. Audit Trail
      await tx.insert(auditLogs).values({
        tenantId,
        actorId: input.actorId,
        actorEmail: input.actorEmail || null,
        action: 'CREATE',
        entityType: 'EMPLOYEE',
        entityId: employeeId,
        previousState: null,
        resultingState: {
          employeeNumber: empNumber,
          nameEn: dispNameEn,
          branchId: input.branchId,
        },
      });

      logger.audit('CREATE', 'EMPLOYEE', employeeId, { employeeNumber: empNumber }, { tenantId });

      return insertedEmp;
    });
  }

  public async updateEmployee(tenantId: string, employeeId: string, input: UpdateEmployeeInput) {
    const [existing] = await db.select().from(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.tenantId, tenantId)))
      .limit(1);

    if (!existing) {
      throw new Error('Employee not found or access denied');
    }

    // Manager Loop Protection
    if (input.managerEmployeeId && input.managerEmployeeId === employeeId) {
      throw new Error('Manager assignment error: An employee cannot be their own reporting manager.');
    }

    // Cross-company validation
    const targetBranch = input.branchId || existing.branchId;
    const targetDept = input.departmentId !== undefined ? input.departmentId : existing.departmentId;
    const targetDesig = input.designationId !== undefined ? input.designationId : existing.designationId;
    const targetCat = input.employeeCategoryId !== undefined ? input.employeeCategoryId : existing.employeeCategoryId;
    const targetBU = input.businessUnitId !== undefined ? input.businessUnitId : existing.businessUnitId;
    const targetCC = input.costCenterId !== undefined ? input.costCenterId : existing.costCenterId;

    await this.validateCompanyRelations(tenantId, targetBranch, targetDept || undefined, targetDesig || undefined, targetCat || undefined, targetBU || undefined, targetCC || undefined);

    return db.transaction(async (tx) => {
      const positionChanged =
        (input.branchId && input.branchId !== existing.branchId) ||
        (input.departmentId !== undefined && input.departmentId !== existing.departmentId) ||
        (input.designationId !== undefined && input.designationId !== existing.designationId) ||
        (input.managerEmployeeId !== undefined && input.managerEmployeeId !== existing.managerEmployeeId);

      const updateData: Record<string, any> = {
        updatedAt: new Date(),
        updatedBy: input.actorEmail || input.actorId,
      };

      if (input.firstNameEn) updateData.firstNameEn = input.firstNameEn.trim();
      if (input.lastNameEn) updateData.lastNameEn = input.lastNameEn.trim();
      if (input.firstNameAr) updateData.firstNameAr = input.firstNameAr.trim();
      if (input.lastNameAr) updateData.lastNameAr = input.lastNameAr.trim();
      if (input.firstNameEn || input.lastNameEn) {
        updateData.displayNameEn = `${input.firstNameEn || existing.firstNameEn} ${input.lastNameEn || existing.lastNameEn}`;
      }
      if (input.firstNameAr || input.lastNameAr) {
        updateData.displayNameAr = `${input.firstNameAr || existing.firstNameAr} ${input.lastNameAr || existing.lastNameAr}`;
      }

      if (input.branchId) updateData.branchId = input.branchId;
      if (input.departmentId !== undefined) updateData.departmentId = input.departmentId || null;
      if (input.designationId !== undefined) updateData.designationId = input.designationId || null;
      if (input.employeeCategoryId !== undefined) updateData.employeeCategoryId = input.employeeCategoryId || null;
      if (input.businessUnitId !== undefined) updateData.businessUnitId = input.businessUnitId || null;
      if (input.costCenterId !== undefined) updateData.costCenterId = input.costCenterId || null;
      if (input.nationalityId !== undefined) updateData.nationalityId = input.nationalityId || null;
      if (input.managerEmployeeId !== undefined) updateData.managerEmployeeId = input.managerEmployeeId || null;

      if (input.gender) updateData.gender = input.gender;
      if (input.maritalStatus) updateData.maritalStatus = input.maritalStatus;
      if (input.nationality) updateData.nationality = input.nationality.trim();
      if (input.civilIdNumber !== undefined) updateData.civilIdNumber = input.civilIdNumber?.trim() || null;
      if (input.passportNumber !== undefined) updateData.passportNumber = input.passportNumber?.trim() || null;
      if (input.workEmail !== undefined) updateData.workEmail = input.workEmail?.toLowerCase().trim() || null;
      if (input.personalEmail !== undefined) updateData.personalEmail = input.personalEmail?.toLowerCase().trim() || null;
      if (input.workPhone !== undefined) updateData.workPhone = input.workPhone?.trim() || null;
      if (input.personalPhone !== undefined) updateData.personalPhone = input.personalPhone?.trim() || null;
      if (input.phone !== undefined) updateData.phone = input.phone?.trim() || null;
      if (input.email) updateData.email = input.email.toLowerCase().trim();
      if (input.addressEn !== undefined) updateData.addressEn = input.addressEn?.trim() || null;
      if (input.addressAr !== undefined) updateData.addressAr = input.addressAr?.trim() || null;
      if (input.employmentStatus) updateData.employmentStatus = input.employmentStatus;
      if (input.contractType) updateData.contractType = input.contractType;
      if (input.workLocation !== undefined) updateData.workLocation = input.workLocation?.trim() || null;
      if (input.photoPath !== undefined) updateData.photoPath = input.photoPath || null;
      if (input.avatarUrl !== undefined) updateData.avatarUrl = input.avatarUrl || null;

      const [updatedEmp] = await tx.update(employees)
        .set(updateData)
        .where(and(eq(employees.id, employeeId), eq(employees.tenantId, tenantId)))
        .returning();

      // Handle Position Transfer / Effective Assignment History
      if (positionChanged) {
        // Close previous assignment
        await tx.update(employeeAssignments)
          .set({ effectiveTo: new Date(), status: 'HISTORICAL' })
          .where(and(eq(employeeAssignments.employeeId, employeeId), eq(employeeAssignments.status, 'ACTIVE')));

        // Insert new assignment record
        await tx.insert(employeeAssignments).values({
          id: `asg_${employeeId}_${Date.now()}`,
          tenantId,
          employeeId,
          branchId: targetBranch,
          departmentId: targetDept || null,
          designationId: targetDesig || null,
          employeeCategoryId: targetCat || null,
          businessUnitId: targetBU || null,
          costCenterId: targetCC || null,
          managerEmployeeId: input.managerEmployeeId !== undefined ? input.managerEmployeeId : existing.managerEmployeeId,
          effectiveFrom: new Date(),
          reason: 'TRANSFER',
          status: 'ACTIVE',
          createdBy: input.actorEmail || input.actorId,
        });

        // Record History
        await tx.insert(employeeHistory).values({
          tenantId,
          employeeId,
          changeType: 'TRANSFER',
          descriptionEn: `Organizational assignment updated for ${existing.employeeNumber}`,
          descriptionAr: `تحديث التكليف الوظيفي للموظف رقم ${existing.employeeNumber}`,
          previousState: {
            branchId: existing.branchId,
            departmentId: existing.departmentId,
            designationId: existing.designationId,
            managerEmployeeId: existing.managerEmployeeId,
          },
          newState: {
            branchId: targetBranch,
            departmentId: targetDept,
            designationId: targetDesig,
            managerEmployeeId: input.managerEmployeeId,
          },
          effectiveDate: new Date(),
          recordedBy: input.actorEmail || input.actorId,
        });
      }

      // Audit Log
      await tx.insert(auditLogs).values({
        tenantId,
        actorId: input.actorId,
        actorEmail: input.actorEmail || null,
        action: 'UPDATE',
        entityType: 'EMPLOYEE',
        entityId: employeeId,
        previousState: {
          employmentStatus: existing.employmentStatus,
          branchId: existing.branchId,
        },
        resultingState: {
          employmentStatus: updatedEmp.employmentStatus,
          branchId: updatedEmp.branchId,
        },
      });

      logger.audit('UPDATE', 'EMPLOYEE', employeeId, { employeeNumber: existing.employeeNumber }, { tenantId });

      return updatedEmp;
    });
  }

  public async archiveEmployee(tenantId: string, employeeId: string, actorId: string, actorEmail?: string) {
    const [emp] = await db.select().from(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.tenantId, tenantId)))
      .limit(1);

    if (!emp) throw new Error('Employee not found or access denied');

    const [updated] = await db.update(employees)
      .set({
        employmentStatus: 'ARCHIVED',
        archivedAt: new Date(),
        archivedBy: actorEmail || actorId,
        updatedAt: new Date(),
        updatedBy: actorEmail || actorId,
      })
      .where(and(eq(employees.id, employeeId), eq(employees.tenantId, tenantId)))
      .returning();

    await db.insert(employeeHistory).values({
      tenantId,
      employeeId,
      changeType: 'STATUS_CHANGE',
      descriptionEn: `Employee archived by ${actorEmail || actorId}`,
      descriptionAr: `تم أرشفة سجل الموظف بواسطة ${actorEmail || actorId}`,
      previousState: { employmentStatus: emp.employmentStatus },
      newState: { employmentStatus: 'ARCHIVED' },
      effectiveDate: new Date(),
      recordedBy: actorEmail || actorId,
    });

    logger.audit('ARCHIVE', 'EMPLOYEE', employeeId, { employeeNumber: emp.employeeNumber }, { tenantId });
    return updated;
  }

  /**
   * Safe Employee Deletion Guard Policy
   * Blocks destructive deletion if employee has dependent business records in attendance, timesheets, payroll, settlements, or multiple contracts.
   */
  public async deleteEmployee(tenantId: string, employeeId: string, actorId: string) {
    const [emp] = await db.select().from(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.tenantId, tenantId)))
      .limit(1);

    if (!emp) {
      throw new Error('Employee not found or access denied');
    }

    // Check Dependent Business History References
    const [attCount] = await db.select({ count: sql<number>`count(*)` }).from(attendanceRecords).where(eq(attendanceRecords.employeeId, employeeId));
    const [payrollCount] = await db.select({ count: sql<number>`count(*)` }).from(payrollItems).where(eq(payrollItems.employeeId, employeeId));
    const [rosterCount] = await db.select({ count: sql<number>`count(*)` }).from(rosterAssignments).where(eq(rosterAssignments.employeeId, employeeId));
    const [settlementCount] = await db.select({ count: sql<number>`count(*)` }).from(finalSettlements).where(eq(finalSettlements.employeeId, employeeId));
    const [contractCount] = await db.select({ count: sql<number>`count(*)` }).from(employeeContracts).where(eq(employeeContracts.employeeId, employeeId));

    const totalBusinessReferences = Number(attCount?.count || 0) + Number(payrollCount?.count || 0) + Number(rosterCount?.count || 0) + Number(settlementCount?.count || 0);

    if (totalBusinessReferences > 0 || Number(contractCount?.count || 0) > 1) {
      throw new Error('DESTRUCTIVE_DELETE_DENIED: Employee has active business history (attendance, timesheets, payroll, or contracts). Destructive deletion is prohibited to protect historical integrity. Please set employment status to Inactive, Terminated, or Archived instead.');
    }

    // If completely unreferenced draft employee, perform safe delete
    await db.delete(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.tenantId, tenantId)));

    logger.audit('DELETE', 'EMPLOYEE', employeeId, { employeeNumber: emp.employeeNumber, name: `${emp.firstNameEn} ${emp.lastNameEn}` }, { tenantId });

    return { success: true, deletedId: employeeId };
  }

  // --- Contracts Submodule ---
  public async addContract(tenantId: string, employeeId: string, input: AddContractInput) {
    const [emp] = await db.select().from(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.tenantId, tenantId)))
      .limit(1);

    if (!emp) throw new Error('Employee not found');

    return db.transaction(async (tx) => {
      // Close previous active contract
      await tx.update(employeeContracts)
        .set({ status: 'CLOSED', endDate: new Date(), updatedAt: new Date() })
        .where(and(eq(employeeContracts.employeeId, employeeId), eq(employeeContracts.status, 'ACTIVE')));

      const contractId = `cnt_${employeeId}_${Date.now()}`;
      const startDateObj = new Date(input.startDate);

      const [newContract] = await tx.insert(employeeContracts).values({
        id: contractId,
        tenantId,
        employeeId,
        contractNumber: input.contractNumber || `CNT-${emp.employeeNumber}-${Date.now().toString().substring(8)}`,
        contractType: input.contractType,
        startDate: startDateObj,
        endDate: input.endDate ? new Date(input.endDate) : null,
        probationPeriodDays: input.probationDays || 90,
        noticePeriodDays: input.noticeDays || 90,
        workingDaysPerWeek: input.workingDaysPerWeek || 5,
        workingHoursPerDay: input.workingHoursPerDay || 8,
        terms: input.terms || null,
        documentAttachmentId: input.documentAttachmentId || null,
        status: 'ACTIVE',
        createdBy: input.actorId,
      }).returning();

      // Log Contract Renewal History
      await tx.insert(employeeHistory).values({
        tenantId,
        employeeId,
        changeType: 'CONTRACT_RENEWAL',
        descriptionEn: `Contract renewed for ${emp.employeeNumber} (${input.contractType})`,
        descriptionAr: `تجديد عقد العمل للموظف ${emp.employeeNumber} (${input.contractType})`,
        previousState: null,
        newState: {
          contractNumber: newContract.contractNumber,
          contractType: newContract.contractType,
          startDate: input.startDate,
        },
        effectiveDate: startDateObj,
        recordedBy: input.actorId,
      });

      return newContract;
    });
  }

  // --- Salary Submodule ---
  public async addSalaryAssignment(tenantId: string, employeeId: string, input: AddSalaryInput) {
    const [emp] = await db.select().from(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.tenantId, tenantId)))
      .limit(1);

    if (!emp) throw new Error('Employee not found');

    return db.transaction(async (tx) => {
      const effectiveObj = new Date(input.effectiveDate);

      // Deactivate previous active salary structure
      await tx.update(employeeSalaries)
        .set({ isActive: false, status: 'HISTORICAL', effectiveTo: effectiveObj })
        .where(and(eq(employeeSalaries.employeeId, employeeId), eq(employeeSalaries.isActive, true)));

      const salaryId = `sal_${employeeId}_${Date.now()}`;
      const [newSal] = await tx.insert(employeeSalaries).values({
        id: salaryId,
        tenantId,
        employeeId,
        currency: input.currency.toUpperCase(),
        basicSalary: input.basicSalary,
        housingAllowance: input.housingAllowance || '0.000',
        transportAllowance: input.transportAllowance || '0.000',
        foodAllowance: input.foodAllowance || '0.000',
        otherAllowances: input.otherAllowances || '0.000',
        effectiveDate: effectiveObj,
        isActive: true,
        status: 'ACTIVE',
        createdBy: input.actorId,
      }).returning();

      await tx.insert(employeeHistory).values({
        tenantId,
        employeeId,
        changeType: 'SALARY_REVISION',
        descriptionEn: `Salary package revised for ${emp.employeeNumber}`,
        descriptionAr: `تعديل الهيكل المالي للراتب للموظف ${emp.employeeNumber}`,
        previousState: null,
        newState: {
          basicSalary: input.basicSalary,
          currency: input.currency,
          effectiveDate: input.effectiveDate,
        },
        effectiveDate: effectiveObj,
        recordedBy: input.actorId,
      });

      return newSal;
    });
  }

  // --- Bank Accounts Submodule ---
  public async addBankAccount(tenantId: string, employeeId: string, input: AddBankAccountInput) {
    if (input.isPrimary) {
      await db.update(employeeBankDetails)
        .set({ isPrimary: false })
        .where(eq(employeeBankDetails.employeeId, employeeId));
    }

    const bankDetailsId = `bnk_${employeeId}_${Date.now()}`;
    const [inserted] = await db.insert(employeeBankDetails).values({
      id: bankDetailsId,
      tenantId,
      employeeId,
      bankId: input.bankId || null,
      bankName: input.bankName.trim(),
      bankCode: input.bankCode || null,
      accountName: input.accountName || null,
      iban: input.iban.toUpperCase().replace(/\s/g, ''),
      accountNumber: input.accountNumber.trim(),
      swiftBic: input.swiftBic?.toUpperCase() || null,
      currency: (input.currency || 'KWD').toUpperCase(),
      isPrimary: input.isPrimary !== undefined ? input.isPrimary : true,
      status: 'ACTIVE',
      createdBy: input.actorId,
    }).returning();

    return inserted;
  }

  // --- Documents Submodule ---
  public async addEmployeeDocument(tenantId: string, employeeId: string, input: AddDocumentInput) {
    const id = `doc_${input.documentType.toLowerCase()}_${Date.now()}`;
    const expiryObj = new Date(input.expiryDate);
    const now = new Date();

    const [inserted] = await db.insert(employeeDocuments).values({
      id,
      tenantId,
      employeeId,
      documentTypeId: input.documentTypeId || null,
      documentType: input.documentType,
      documentNumber: input.documentNumber.trim(),
      issueDate: input.issueDate ? new Date(input.issueDate) : null,
      expiryDate: expiryObj,
      issuingAuthority: input.issuingAuthority || null,
      issuingCountry: input.issuingCountry || null,
      attachmentUrl: input.attachmentUrl || null,
      fileName: input.fileName || null,
      notes: input.notes || null,
      status: expiryObj < now ? 'EXPIRED' : expiryObj < new Date(now.getTime() + 60 * 86400000) ? 'EXPIRING_SOON' : 'VALID',
      createdBy: input.actorId,
    }).returning();

    return inserted;
  }

  public async listExpiringDocuments(tenantId: string, daysAhead = 60) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

    return db.select({
      id: employeeDocuments.id,
      employeeId: employeeDocuments.employeeId,
      employeeNumber: employees.employeeNumber,
      employeeNameEn: sql<string>`concat(${employees.firstNameEn}, ' ', ${employees.lastNameEn})`,
      employeeNameAr: sql<string>`concat(${employees.firstNameAr}, ' ', ${employees.lastNameAr})`,
      documentType: employeeDocuments.documentType,
      documentNumber: employeeDocuments.documentNumber,
      expiryDate: employeeDocuments.expiryDate,
      status: employeeDocuments.status,
    })
      .from(employeeDocuments)
      .innerJoin(employees, eq(employeeDocuments.employeeId, employees.id))
      .where(and(
        eq(employeeDocuments.tenantId, tenantId),
        sql`${employeeDocuments.expiryDate} <= ${cutoffDate.toISOString()}`
      ))
      .orderBy(asc(employeeDocuments.expiryDate));
  }

  // --- Emergency Contacts & Dependents ---
  public async addEmergencyContact(tenantId: string, employeeId: string, name: string, relationship: string, phone: string, alternatePhone?: string, isPrimary = false, actorId = 'system') {
    if (isPrimary) {
      await db.update(employeeEmergencyContacts).set({ isPrimary: false }).where(eq(employeeEmergencyContacts.employeeId, employeeId));
    }
    const [contact] = await db.insert(employeeEmergencyContacts).values({
      id: `emg_${employeeId}_${Date.now()}`,
      tenantId,
      employeeId,
      name: name.trim(),
      relationship,
      phone: phone.trim(),
      alternatePhone: alternatePhone?.trim() || null,
      isPrimary,
      createdBy: actorId,
    }).returning();
    return contact;
  }

  public async addDependent(tenantId: string, employeeId: string, nameEn: string, nameAr: string, relationship: string, dateOfBirth?: string, nationalityId?: number, documentNumber?: string, actorId = 'system') {
    const [dependent] = await db.insert(employeeDependents).values({
      id: `dep_${employeeId}_${Date.now()}`,
      tenantId,
      employeeId,
      nameEn: nameEn.trim(),
      nameAr: nameAr.trim(),
      relationship,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      nationalityId: nationalityId || null,
      documentNumber: documentNumber?.trim() || null,
      status: 'ACTIVE',
      createdBy: actorId,
    }).returning();
    return dependent;
  }
}

export const peopleRepository = new PeopleRepository();
