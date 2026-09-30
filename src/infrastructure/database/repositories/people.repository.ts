/**
 * GulfHive ERP - People Module Repository
 * Authoritative management for Employee Master, Departments, Designations, Contracts, Salaries, Documents, and History.
 */

import { eq, and, desc, sql, asc } from 'drizzle-orm';
import { db } from '../../../db/index.ts';
import {
  departments,
  designations,
  employees,
  employeeContracts,
  employeeSalaries,
  employeeBankDetails,
  employeeDocuments,
  employeeHistory,
  branches,
  auditLogs,
} from '../../../db/schema.ts';
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
  employeeNumber: string;
  firstNameEn: string;
  lastNameEn: string;
  firstNameAr: string;
  lastNameAr: string;
  gender: string;
  dateOfBirth?: string;
  nationality: string;
  civilIdNumber?: string;
  passportNumber?: string;
  phone?: string;
  email: string;
  joiningDate: string;
  employmentStatus?: string; // ACTIVE, PROBATION, etc.
  contractType?: string; // LIMITED, UNLIMITED
  workLocation?: string;

  // Contract details
  contractStartDate?: string;
  contractEndDate?: string;
  probationDays?: number;
  noticeDays?: number;

  // Salary setup
  currency: string;
  basicSalary: string;
  housingAllowance?: string;
  transportAllowance?: string;
  otherAllowances?: string;

  // Bank details (WPS)
  bankName?: string;
  bankCode?: string;
  iban?: string;
  accountNumber?: string;
  swiftBic?: string;

  // Initial Document
  civilIdExpiry?: string;
  passportExpiry?: string;

  actorId: string;
  actorEmail?: string;
}

export interface AddDocumentInput {
  documentType: string;
  documentNumber: string;
  issueDate?: string;
  expiryDate: string;
  issuingAuthority?: string;
  issuingCountry?: string;
  attachmentUrl?: string;
  fileName?: string;
  notes?: string;
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
  public async listEmployees(tenantId: string, branchId?: string, departmentId?: string) {
    const conditions = [eq(employees.tenantId, tenantId)];
    if (branchId) conditions.push(eq(employees.branchId, branchId));
    if (departmentId) conditions.push(eq(employees.departmentId, departmentId));

    return db.select({
      id: employees.id,
      employeeNumber: employees.employeeNumber,
      firstNameEn: employees.firstNameEn,
      lastNameEn: employees.lastNameEn,
      firstNameAr: employees.firstNameAr,
      lastNameAr: employees.lastNameAr,
      gender: employees.gender,
      nationality: employees.nationality,
      civilIdNumber: employees.civilIdNumber,
      passportNumber: employees.passportNumber,
      phone: employees.phone,
      email: employees.email,
      joiningDate: employees.joiningDate,
      employmentStatus: employees.employmentStatus,
      contractType: employees.contractType,
      workLocation: employees.workLocation,
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
    })
      .from(employees)
      .leftJoin(branches, eq(employees.branchId, branches.id))
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .leftJoin(designations, eq(employees.designationId, designations.id))
      .where(and(...conditions))
      .orderBy(asc(employees.employeeNumber));
  }

  public async getEmployeeById(tenantId: string, employeeId: string) {
    const empRows = await db.select({
      id: employees.id,
      employeeNumber: employees.employeeNumber,
      firstNameEn: employees.firstNameEn,
      lastNameEn: employees.lastNameEn,
      firstNameAr: employees.firstNameAr,
      lastNameAr: employees.lastNameAr,
      gender: employees.gender,
      dateOfBirth: employees.dateOfBirth,
      nationality: employees.nationality,
      civilIdNumber: employees.civilIdNumber,
      passportNumber: employees.passportNumber,
      phone: employees.phone,
      email: employees.email,
      joiningDate: employees.joiningDate,
      employmentStatus: employees.employmentStatus,
      contractType: employees.contractType,
      workLocation: employees.workLocation,
      avatarUrl: employees.avatarUrl,
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
    })
      .from(employees)
      .leftJoin(branches, eq(employees.branchId, branches.id))
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .leftJoin(designations, eq(employees.designationId, designations.id))
      .where(and(eq(employees.tenantId, tenantId), eq(employees.id, employeeId)))
      .limit(1);

    if (!empRows[0]) return null;
    const employee = empRows[0];

    const [contractsList, salariesList, bankList, documentsList, historyList] = await Promise.all([
      db.select().from(employeeContracts).where(eq(employeeContracts.employeeId, employeeId)).orderBy(desc(employeeContracts.startDate)),
      db.select().from(employeeSalaries).where(eq(employeeSalaries.employeeId, employeeId)).orderBy(desc(employeeSalaries.effectiveDate)),
      db.select().from(employeeBankDetails).where(eq(employeeBankDetails.employeeId, employeeId)),
      db.select().from(employeeDocuments).where(eq(employeeDocuments.employeeId, employeeId)).orderBy(asc(employeeDocuments.expiryDate)),
      db.select().from(employeeHistory).where(eq(employeeHistory.employeeId, employeeId)).orderBy(desc(employeeHistory.effectiveDate)),
    ]);

    return {
      ...employee,
      contracts: contractsList,
      salaries: salariesList,
      bankDetails: bankList[0] || null,
      documents: documentsList,
      history: historyList,
    };
  }

  public async createEmployee(tenantId: string, input: CreateEmployeeInput) {
    return db.transaction(async (tx) => {
      // 1. Check employee number unique within tenant
      const existing = await tx.select().from(employees)
        .where(and(eq(employees.tenantId, tenantId), eq(employees.employeeNumber, input.employeeNumber.toUpperCase().trim())))
        .limit(1);

      if (existing.length > 0) {
        throw new Error(`Employee number '${input.employeeNumber}' is already registered in this company.`);
      }

      const employeeId = `emp_${input.employeeNumber.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
      const joiningDateObj = new Date(input.joiningDate);

      // 2. Insert Employee Master
      const [insertedEmp] = await tx.insert(employees).values({
        id: employeeId,
        tenantId,
        branchId: input.branchId,
        departmentId: input.departmentId || null,
        designationId: input.designationId || null,
        employeeNumber: input.employeeNumber.toUpperCase().trim(),
        firstNameEn: input.firstNameEn.trim(),
        lastNameEn: input.lastNameEn.trim(),
        firstNameAr: input.firstNameAr.trim(),
        lastNameAr: input.lastNameAr.trim(),
        gender: input.gender,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
        nationality: input.nationality.trim(),
        civilIdNumber: input.civilIdNumber?.trim() || null,
        passportNumber: input.passportNumber?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email.toLowerCase().trim(),
        joiningDate: joiningDateObj,
        employmentStatus: input.employmentStatus || 'ACTIVE',
        contractType: input.contractType || 'UNLIMITED',
        workLocation: input.workLocation || null,
      }).returning();

      // 3. Insert Initial Contract
      const contractId = `cnt_${employeeId}`;
      await tx.insert(employeeContracts).values({
        id: contractId,
        tenantId,
        employeeId,
        contractNumber: `CNT-${input.employeeNumber}`,
        contractType: input.contractType || 'UNLIMITED',
        startDate: input.contractStartDate ? new Date(input.contractStartDate) : joiningDateObj,
        endDate: input.contractEndDate ? new Date(input.contractEndDate) : null,
        probationPeriodDays: input.probationDays || 90,
        noticePeriodDays: input.noticeDays || 90,
        status: 'ACTIVE',
      });

      // 4. Insert Initial Salary Structure
      const salaryId = `sal_${employeeId}`;
      await tx.insert(employeeSalaries).values({
        id: salaryId,
        tenantId,
        employeeId,
        currency: input.currency.toUpperCase(),
        basicSalary: input.basicSalary,
        housingAllowance: input.housingAllowance || '0.000',
        transportAllowance: input.transportAllowance || '0.000',
        otherAllowances: input.otherAllowances || '0.000',
        effectiveDate: joiningDateObj,
        isActive: true,
      });

      // 5. Insert Bank Details (if provided)
      if (input.bankName && input.iban && input.accountNumber) {
        const bankId = `bnk_${employeeId}`;
        await tx.insert(employeeBankDetails).values({
          id: bankId,
          tenantId,
          employeeId,
          bankName: input.bankName.trim(),
          bankCode: input.bankCode || null,
          iban: input.iban.toUpperCase().replace(/\s/g, ''),
          accountNumber: input.accountNumber.trim(),
          swiftBic: input.swiftBic?.toUpperCase() || null,
          isPrimary: true,
        });
      }

      // 6. Insert Documents (Civil ID, Passport)
      if (input.civilIdNumber && input.civilIdExpiry) {
        const docId = `doc_cid_${employeeId}`;
        await tx.insert(employeeDocuments).values({
          id: docId,
          tenantId,
          employeeId,
          documentType: 'CIVIL_ID',
          documentNumber: input.civilIdNumber.trim(),
          expiryDate: new Date(input.civilIdExpiry),
          status: 'VALID',
        });
      }

      if (input.passportNumber && input.passportExpiry) {
        const docId = `doc_pass_${employeeId}`;
        await tx.insert(employeeDocuments).values({
          id: docId,
          tenantId,
          employeeId,
          documentType: 'PASSPORT',
          documentNumber: input.passportNumber.trim(),
          expiryDate: new Date(input.passportExpiry),
          status: 'VALID',
        });
      }

      // 7. Insert Initial Employee History Record
      await tx.insert(employeeHistory).values({
        tenantId,
        employeeId,
        changeType: 'JOINING',
        descriptionEn: `Joined organization as ${input.employeeNumber}`,
        descriptionAr: `التحق بالمنشأة برقم وظيفي ${input.employeeNumber}`,
        previousState: null,
        newState: {
          employeeNumber: input.employeeNumber,
          branchId: input.branchId,
          departmentId: input.departmentId,
          designationId: input.designationId,
          basicSalary: input.basicSalary,
          joiningDate: input.joiningDate,
        },
        effectiveDate: joiningDateObj,
        recordedBy: input.actorEmail || input.actorId,
      });

      // 8. Immutable System Audit Log
      await tx.insert(auditLogs).values({
        tenantId,
        actorId: input.actorId,
        actorEmail: input.actorEmail || null,
        action: 'CREATE',
        entityType: 'EMPLOYEE',
        entityId: employeeId,
        previousState: null,
        resultingState: {
          employeeNumber: input.employeeNumber,
          nameEn: `${input.firstNameEn} ${input.lastNameEn}`,
          nameAr: `${input.firstNameAr} ${input.lastNameAr}`,
          branchId: input.branchId,
        },
      });

      logger.audit('CREATE', 'EMPLOYEE', employeeId, { employeeNumber: input.employeeNumber }, { tenantId });

      return insertedEmp;
    });
  }

  public async deleteEmployee(tenantId: string, employeeId: string) {
    const [emp] = await db.select().from(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.tenantId, tenantId)))
      .limit(1);

    if (!emp) {
      throw new Error('Employee not found or access denied');
    }

    await db.delete(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.tenantId, tenantId)));

    logger.audit('DELETE', 'EMPLOYEE', employeeId, { employeeNumber: emp.employeeNumber, name: `${emp.firstNameEn} ${emp.lastNameEn}` }, { tenantId });

    return { success: true, deletedId: employeeId };
  }

  public async addEmployeeDocument(tenantId: string, employeeId: string, input: AddDocumentInput) {
    const id = `doc_${input.documentType.toLowerCase()}_${Date.now()}`;
    const [inserted] = await db.insert(employeeDocuments).values({
      id,
      tenantId,
      employeeId,
      documentType: input.documentType,
      documentNumber: input.documentNumber.trim(),
      issueDate: input.issueDate ? new Date(input.issueDate) : null,
      expiryDate: new Date(input.expiryDate),
      issuingAuthority: input.issuingAuthority || null,
      issuingCountry: input.issuingCountry || null,
      attachmentUrl: input.attachmentUrl || null,
      fileName: input.fileName || null,
      notes: input.notes || null,
      status: new Date(input.expiryDate) < new Date() ? 'EXPIRED' : 'VALID',
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
}

export const peopleRepository = new PeopleRepository();
