/**
 * GulfHive ERP - Master Data & Organization Repository
 * Full relational management for Branches, Departments, Designations, Employee Categories,
 * Business Units, Cost Centers, Fiscal Years, Currencies, Countries, Nationalities, Banks,
 * Payment Methods, and Document Types.
 * Strictly enforces referential integrity, cross-company isolation, and safe archive/delete rules.
 */

import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { db } from '../../../db/index.ts';
import {
  tenants,
  branches,
  departments,
  designations,
  employeeCategories,
  businessUnits,
  costCenters,
  fiscalYears,
  currencies,
  countries,
  nationalities,
  banks,
  paymentMethods,
  documentTypes,
  employees,
  auditLogs,
} from '../../../db/schema.ts';
import { logger } from '../../../core/logging/logger.ts';

export class MasterDataRepository {
  // ==========================================
  // 1. BRANCHES
  // ==========================================
  public async listBranches(tenantId: string) {
    return db
      .select()
      .from(branches)
      .where(eq(branches.tenantId, tenantId))
      .orderBy(desc(branches.isMain), asc(branches.code));
  }

  public async getBranchById(tenantId: string, branchId: string) {
    const res = await db
      .select()
      .from(branches)
      .where(and(eq(branches.id, branchId), eq(branches.tenantId, tenantId)))
      .limit(1);
    return res[0] || null;
  }

  public async createBranch(tenantId: string, input: any, actorId = 'system') {
    const existing = await db
      .select()
      .from(branches)
      .where(and(eq(branches.tenantId, tenantId), eq(branches.code, input.code.toUpperCase().trim())))
      .limit(1);

    if (existing.length > 0) {
      throw new Error(`Branch code '${input.code}' is already registered in this company.`);
    }

    const id = `branch_${input.code.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
    const [inserted] = await db
      .insert(branches)
      .values({
        id,
        tenantId,
        code: input.code.toUpperCase().trim(),
        nameEn: input.nameEn.trim(),
        nameAr: input.nameAr.trim(),
        isMain: !!input.isMain,
        cityEn: input.cityEn || null,
        cityAr: input.cityAr || null,
        addressEn: input.addressEn || null,
        addressAr: input.addressAr || null,
        phone: input.phone || null,
        isActive: input.isActive !== undefined ? !!input.isActive : true,
      })
      .returning();

    logger.audit('CREATE', 'BRANCH', id, { code: inserted.code, nameEn: inserted.nameEn }, { tenantId });
    return inserted;
  }

  public async updateBranch(tenantId: string, branchId: string, input: any, actorId = 'system') {
    const branch = await this.getBranchById(tenantId, branchId);
    if (!branch) throw new Error('Branch not found or access denied.');

    const [updated] = await db
      .update(branches)
      .set({
        nameEn: input.nameEn !== undefined ? input.nameEn.trim() : branch.nameEn,
        nameAr: input.nameAr !== undefined ? input.nameAr.trim() : branch.nameAr,
        cityEn: input.cityEn !== undefined ? input.cityEn : branch.cityEn,
        cityAr: input.cityAr !== undefined ? input.cityAr : branch.cityAr,
        addressEn: input.addressEn !== undefined ? input.addressEn : branch.addressEn,
        addressAr: input.addressAr !== undefined ? input.addressAr : branch.addressAr,
        phone: input.phone !== undefined ? input.phone : branch.phone,
        isActive: input.isActive !== undefined ? !!input.isActive : branch.isActive,
        updatedAt: new Date(),
      })
      .where(and(eq(branches.id, branchId), eq(branches.tenantId, tenantId)))
      .returning();

    logger.audit('UPDATE', 'BRANCH', branchId, { code: updated.code }, { tenantId });
    return updated;
  }

  public async deleteBranch(tenantId: string, branchId: string) {
    const branch = await this.getBranchById(tenantId, branchId);
    if (!branch) throw new Error('Branch not found or access denied.');

    if (branch.isMain) {
      throw new Error('Main Head Office branch cannot be deleted.');
    }

    // Check references in employees
    const empCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(employees)
      .where(and(eq(employees.tenantId, tenantId), eq(employees.branchId, branchId)));

    if (empCount[0]?.count > 0) {
      throw new Error(`Branch '${branch.nameEn}' cannot be deleted because it is referenced by ${empCount[0].count} employee record(s). You can deactivate or archive it instead.`);
    }

    await db.delete(branches).where(and(eq(branches.id, branchId), eq(branches.tenantId, tenantId)));
    logger.audit('DELETE', 'BRANCH', branchId, { code: branch.code }, { tenantId });
    return { success: true, deletedId: branchId };
  }

  // ==========================================
  // 2. DEPARTMENTS
  // ==========================================
  public async listDepartments(tenantId: string) {
    return db
      .select()
      .from(departments)
      .where(eq(departments.tenantId, tenantId))
      .orderBy(asc(departments.code));
  }

  public async getDepartmentById(tenantId: string, departmentId: string) {
    const res = await db
      .select()
      .from(departments)
      .where(and(eq(departments.id, departmentId), eq(departments.tenantId, tenantId)))
      .limit(1);
    return res[0] || null;
  }

  public async createDepartment(tenantId: string, input: any, actorId = 'system') {
    const code = input.code.toUpperCase().trim();
    const existing = await db
      .select()
      .from(departments)
      .where(and(eq(departments.tenantId, tenantId), eq(departments.code, code)))
      .limit(1);

    if (existing.length > 0) {
      throw new Error(`Department code '${code}' is already registered in this company.`);
    }

    const id = `dept_${code.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
    const [inserted] = await db
      .insert(departments)
      .values({
        id,
        tenantId,
        code,
        nameEn: input.nameEn.trim(),
        nameAr: input.nameAr.trim(),
        parentDepartmentId: input.parentDepartmentId || null,
        isActive: input.isActive !== undefined ? !!input.isActive : true,
      })
      .returning();

    logger.audit('CREATE', 'DEPARTMENT', id, { code: inserted.code, nameEn: inserted.nameEn }, { tenantId });
    return inserted;
  }

  public async updateDepartment(tenantId: string, departmentId: string, input: any, actorId = 'system') {
    const dept = await this.getDepartmentById(tenantId, departmentId);
    if (!dept) throw new Error('Department not found or access denied.');

    const [updated] = await db
      .update(departments)
      .set({
        nameEn: input.nameEn !== undefined ? input.nameEn.trim() : dept.nameEn,
        nameAr: input.nameAr !== undefined ? input.nameAr.trim() : dept.nameAr,
        parentDepartmentId: input.parentDepartmentId !== undefined ? input.parentDepartmentId : dept.parentDepartmentId,
        isActive: input.isActive !== undefined ? !!input.isActive : dept.isActive,
        updatedAt: new Date(),
      })
      .where(and(eq(departments.id, departmentId), eq(departments.tenantId, tenantId)))
      .returning();

    logger.audit('UPDATE', 'DEPARTMENT', departmentId, { code: updated.code }, { tenantId });
    return updated;
  }

  public async deleteDepartment(tenantId: string, departmentId: string) {
    const dept = await this.getDepartmentById(tenantId, departmentId);
    if (!dept) throw new Error('Department not found or access denied.');

    // Check employee references
    const empCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(employees)
      .where(and(eq(employees.tenantId, tenantId), eq(employees.departmentId, departmentId)));

    if (empCount[0]?.count > 0) {
      throw new Error(`Department '${dept.nameEn}' cannot be deleted because it is referenced by ${empCount[0].count} employee record(s). You can deactivate or archive this department instead.`);
    }

    // Check designation references
    const desigCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(designations)
      .where(and(eq(designations.tenantId, tenantId), eq(designations.departmentId, departmentId)));

    if (desigCount[0]?.count > 0) {
      throw new Error(`Department '${dept.nameEn}' cannot be deleted because it is referenced by ${desigCount[0].count} designation(s). You can deactivate or archive it instead.`);
    }

    await db.delete(departments).where(and(eq(departments.id, departmentId), eq(departments.tenantId, tenantId)));
    logger.audit('DELETE', 'DEPARTMENT', departmentId, { code: dept.code }, { tenantId });
    return { success: true, deletedId: departmentId };
  }

  // ==========================================
  // 3. DESIGNATIONS
  // ==========================================
  public async listDesignations(tenantId: string) {
    return db
      .select({
        id: designations.id,
        tenantId: designations.tenantId,
        departmentId: designations.departmentId,
        code: designations.code,
        nameEn: designations.nameEn,
        nameAr: designations.nameAr,
        grade: designations.grade,
        isActive: designations.isActive,
        createdAt: designations.createdAt,
        departmentNameEn: departments.nameEn,
        departmentNameAr: departments.nameAr,
      })
      .from(designations)
      .leftJoin(departments, eq(designations.departmentId, departments.id))
      .where(eq(designations.tenantId, tenantId))
      .orderBy(asc(designations.code));
  }

  public async createDesignation(tenantId: string, input: any, actorId = 'system') {
    const code = input.code.toUpperCase().trim();
    const existing = await db
      .select()
      .from(designations)
      .where(and(eq(designations.tenantId, tenantId), eq(designations.code, code)))
      .limit(1);

    if (existing.length > 0) {
      throw new Error(`Designation code '${code}' is already registered in this company.`);
    }

    const id = `desig_${code.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
    const [inserted] = await db
      .insert(designations)
      .values({
        id,
        tenantId,
        departmentId: input.departmentId || null,
        code,
        nameEn: input.nameEn.trim(),
        nameAr: input.nameAr.trim(),
        grade: input.grade || null,
        isActive: input.isActive !== undefined ? !!input.isActive : true,
      })
      .returning();

    logger.audit('CREATE', 'DESIGNATION', id, { code: inserted.code, nameEn: inserted.nameEn }, { tenantId });
    return inserted;
  }

  public async updateDesignation(tenantId: string, designationId: string, input: any, actorId = 'system') {
    const [desig] = await db
      .select()
      .from(designations)
      .where(and(eq(designations.id, designationId), eq(designations.tenantId, tenantId)))
      .limit(1);

    if (!desig) throw new Error('Designation not found or access denied.');

    const [updated] = await db
      .update(designations)
      .set({
        nameEn: input.nameEn !== undefined ? input.nameEn.trim() : desig.nameEn,
        nameAr: input.nameAr !== undefined ? input.nameAr.trim() : desig.nameAr,
        departmentId: input.departmentId !== undefined ? input.departmentId : desig.departmentId,
        grade: input.grade !== undefined ? input.grade : desig.grade,
        isActive: input.isActive !== undefined ? !!input.isActive : desig.isActive,
        updatedAt: new Date(),
      })
      .where(and(eq(designations.id, designationId), eq(designations.tenantId, tenantId)))
      .returning();

    logger.audit('UPDATE', 'DESIGNATION', designationId, { code: updated.code }, { tenantId });
    return updated;
  }

  public async deleteDesignation(tenantId: string, designationId: string) {
    const [desig] = await db
      .select()
      .from(designations)
      .where(and(eq(designations.id, designationId), eq(designations.tenantId, tenantId)))
      .limit(1);

    if (!desig) throw new Error('Designation not found or access denied.');

    const empCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(employees)
      .where(and(eq(employees.tenantId, tenantId), eq(employees.designationId, designationId)));

    if (empCount[0]?.count > 0) {
      throw new Error(`Designation '${desig.nameEn}' cannot be deleted because it is referenced by ${empCount[0].count} employee record(s). You can deactivate or archive it instead.`);
    }

    await db.delete(designations).where(and(eq(designations.id, designationId), eq(designations.tenantId, tenantId)));
    logger.audit('DELETE', 'DESIGNATION', designationId, { code: desig.code }, { tenantId });
    return { success: true, deletedId: designationId };
  }

  // ==========================================
  // 4. EMPLOYEE CATEGORIES
  // ==========================================
  public async listEmployeeCategories(tenantId: string) {
    return db
      .select()
      .from(employeeCategories)
      .where(eq(employeeCategories.tenantId, tenantId))
      .orderBy(asc(employeeCategories.sortOrder), asc(employeeCategories.code));
  }

  public async createEmployeeCategory(tenantId: string, input: any, actorId = 'system') {
    const code = input.code.toUpperCase().trim();
    const existing = await db
      .select()
      .from(employeeCategories)
      .where(and(eq(employeeCategories.tenantId, tenantId), eq(employeeCategories.code, code)))
      .limit(1);

    if (existing.length > 0) {
      throw new Error(`Employee Category code '${code}' is already registered.`);
    }

    const id = `empcat_${code.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
    const [inserted] = await db
      .insert(employeeCategories)
      .values({
        id,
        tenantId,
        code,
        nameEn: input.nameEn.trim(),
        nameAr: input.nameAr.trim(),
        descriptionEn: input.descriptionEn || null,
        descriptionAr: input.descriptionAr || null,
        sortOrder: input.sortOrder || 0,
        status: input.status || 'ACTIVE',
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    logger.audit('CREATE', 'EMPLOYEE_CATEGORY', id, { code: inserted.code }, { tenantId });
    return inserted;
  }

  public async updateEmployeeCategory(tenantId: string, id: string, input: any, actorId = 'system') {
    const [existing] = await db
      .select()
      .from(employeeCategories)
      .where(and(eq(employeeCategories.id, id), eq(employeeCategories.tenantId, tenantId)))
      .limit(1);

    if (!existing) throw new Error('Employee Category not found or access denied.');

    const [updated] = await db
      .update(employeeCategories)
      .set({
        nameEn: input.nameEn !== undefined ? input.nameEn.trim() : existing.nameEn,
        nameAr: input.nameAr !== undefined ? input.nameAr.trim() : existing.nameAr,
        descriptionEn: input.descriptionEn !== undefined ? input.descriptionEn : existing.descriptionEn,
        descriptionAr: input.descriptionAr !== undefined ? input.descriptionAr : existing.descriptionAr,
        sortOrder: input.sortOrder !== undefined ? Number(input.sortOrder) : existing.sortOrder,
        status: input.status || existing.status,
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(and(eq(employeeCategories.id, id), eq(employeeCategories.tenantId, tenantId)))
      .returning();

    return updated;
  }

  public async deleteEmployeeCategory(tenantId: string, id: string) {
    const [existing] = await db
      .select()
      .from(employeeCategories)
      .where(and(eq(employeeCategories.id, id), eq(employeeCategories.tenantId, tenantId)))
      .limit(1);

    if (!existing) throw new Error('Employee Category not found or access denied.');

    await db.delete(employeeCategories).where(and(eq(employeeCategories.id, id), eq(employeeCategories.tenantId, tenantId)));
    return { success: true, deletedId: id };
  }

  // ==========================================
  // 5. BUSINESS UNITS
  // ==========================================
  public async listBusinessUnits(tenantId: string) {
    return db
      .select()
      .from(businessUnits)
      .where(eq(businessUnits.tenantId, tenantId))
      .orderBy(asc(businessUnits.code));
  }

  public async createBusinessUnit(tenantId: string, input: any, actorId = 'system') {
    const code = input.code.toUpperCase().trim();
    const existing = await db
      .select()
      .from(businessUnits)
      .where(and(eq(businessUnits.tenantId, tenantId), eq(businessUnits.code, code)))
      .limit(1);

    if (existing.length > 0) {
      throw new Error(`Business Unit code '${code}' is already registered.`);
    }

    const id = `bu_${code.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
    const [inserted] = await db
      .insert(businessUnits)
      .values({
        id,
        tenantId,
        code,
        nameEn: input.nameEn.trim(),
        nameAr: input.nameAr.trim(),
        descriptionEn: input.descriptionEn || null,
        descriptionAr: input.descriptionAr || null,
        status: input.status || 'ACTIVE',
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    return inserted;
  }

  public async updateBusinessUnit(tenantId: string, id: string, input: any, actorId = 'system') {
    const [existing] = await db
      .select()
      .from(businessUnits)
      .where(and(eq(businessUnits.id, id), eq(businessUnits.tenantId, tenantId)))
      .limit(1);

    if (!existing) throw new Error('Business Unit not found or access denied.');

    const [updated] = await db
      .update(businessUnits)
      .set({
        nameEn: input.nameEn !== undefined ? input.nameEn.trim() : existing.nameEn,
        nameAr: input.nameAr !== undefined ? input.nameAr.trim() : existing.nameAr,
        descriptionEn: input.descriptionEn !== undefined ? input.descriptionEn : existing.descriptionEn,
        descriptionAr: input.descriptionAr !== undefined ? input.descriptionAr : existing.descriptionAr,
        status: input.status || existing.status,
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(and(eq(businessUnits.id, id), eq(businessUnits.tenantId, tenantId)))
      .returning();

    return updated;
  }

  public async deleteBusinessUnit(tenantId: string, id: string) {
    const [existing] = await db
      .select()
      .from(businessUnits)
      .where(and(eq(businessUnits.id, id), eq(businessUnits.tenantId, tenantId)))
      .limit(1);

    if (!existing) throw new Error('Business Unit not found or access denied.');

    await db.delete(businessUnits).where(and(eq(businessUnits.id, id), eq(businessUnits.tenantId, tenantId)));
    return { success: true, deletedId: id };
  }

  // ==========================================
  // 6. COST CENTERS
  // ==========================================
  public async listCostCenters(tenantId: string) {
    return db
      .select()
      .from(costCenters)
      .where(eq(costCenters.tenantId, tenantId))
      .orderBy(asc(costCenters.code));
  }

  public async createCostCenter(tenantId: string, input: any, actorId = 'system') {
    const code = input.code.toUpperCase().trim();
    const existing = await db
      .select()
      .from(costCenters)
      .where(and(eq(costCenters.tenantId, tenantId), eq(costCenters.code, code)))
      .limit(1);

    if (existing.length > 0) {
      throw new Error(`Cost Center code '${code}' is already registered.`);
    }

    const id = `cc_${code.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
    const [inserted] = await db
      .insert(costCenters)
      .values({
        id,
        tenantId,
        parentCostCenterId: input.parentCostCenterId || null,
        code,
        nameEn: input.nameEn.trim(),
        nameAr: input.nameAr.trim(),
        descriptionEn: input.descriptionEn || null,
        descriptionAr: input.descriptionAr || null,
        status: input.status || 'ACTIVE',
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    return inserted;
  }

  public async updateCostCenter(tenantId: string, id: string, input: any, actorId = 'system') {
    const [existing] = await db
      .select()
      .from(costCenters)
      .where(and(eq(costCenters.id, id), eq(costCenters.tenantId, tenantId)))
      .limit(1);

    if (!existing) throw new Error('Cost Center not found or access denied.');

    const [updated] = await db
      .update(costCenters)
      .set({
        nameEn: input.nameEn !== undefined ? input.nameEn.trim() : existing.nameEn,
        nameAr: input.nameAr !== undefined ? input.nameAr.trim() : existing.nameAr,
        parentCostCenterId: input.parentCostCenterId !== undefined ? input.parentCostCenterId : existing.parentCostCenterId,
        descriptionEn: input.descriptionEn !== undefined ? input.descriptionEn : existing.descriptionEn,
        descriptionAr: input.descriptionAr !== undefined ? input.descriptionAr : existing.descriptionAr,
        status: input.status || existing.status,
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(and(eq(costCenters.id, id), eq(costCenters.tenantId, tenantId)))
      .returning();

    return updated;
  }

  public async deleteCostCenter(tenantId: string, id: string) {
    const [existing] = await db
      .select()
      .from(costCenters)
      .where(and(eq(costCenters.id, id), eq(costCenters.tenantId, tenantId)))
      .limit(1);

    if (!existing) throw new Error('Cost Center not found or access denied.');

    await db.delete(costCenters).where(and(eq(costCenters.id, id), eq(costCenters.tenantId, tenantId)));
    return { success: true, deletedId: id };
  }

  // ==========================================
  // 7. FISCAL YEARS
  // ==========================================
  public async listFiscalYears(tenantId: string) {
    return db
      .select()
      .from(fiscalYears)
      .where(eq(fiscalYears.tenantId, tenantId))
      .orderBy(desc(fiscalYears.startDate));
  }

  public async createFiscalYear(tenantId: string, input: any, actorId = 'system') {
    const name = input.name.trim();
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);

    if (startDate >= endDate) {
      throw new Error('Fiscal year start date must be prior to end date.');
    }

    const id = `fy_${startDate.getFullYear()}_${Date.now()}`;

    if (input.isCurrent) {
      // Reset other fiscal years isCurrent
      await db
        .update(fiscalYears)
        .set({ isCurrent: false })
        .where(eq(fiscalYears.tenantId, tenantId));
    }

    const [inserted] = await db
      .insert(fiscalYears)
      .values({
        id,
        tenantId,
        name,
        startDate,
        endDate,
        isCurrent: !!input.isCurrent,
        isLocked: !!input.isLocked,
        status: input.isLocked ? 'LOCKED' : input.status || 'OPEN',
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    return inserted;
  }

  public async updateFiscalYear(tenantId: string, id: string, input: any, actorId = 'system') {
    const [existing] = await db
      .select()
      .from(fiscalYears)
      .where(and(eq(fiscalYears.id, id), eq(fiscalYears.tenantId, tenantId)))
      .limit(1);

    if (!existing) throw new Error('Fiscal Year not found or access denied.');

    if (existing.isLocked && input.isLocked !== false && input.status !== 'OPEN') {
      throw new Error('Fiscal year is locked. Unlock it first before modifying dates or status.');
    }

    if (input.isCurrent) {
      await db
        .update(fiscalYears)
        .set({ isCurrent: false })
        .where(eq(fiscalYears.tenantId, tenantId));
    }

    const [updated] = await db
      .update(fiscalYears)
      .set({
        name: input.name !== undefined ? input.name.trim() : existing.name,
        startDate: input.startDate ? new Date(input.startDate) : existing.startDate,
        endDate: input.endDate ? new Date(input.endDate) : existing.endDate,
        isCurrent: input.isCurrent !== undefined ? !!input.isCurrent : existing.isCurrent,
        isLocked: input.isLocked !== undefined ? !!input.isLocked : existing.isLocked,
        status: input.isLocked ? 'LOCKED' : input.status || existing.status,
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(and(eq(fiscalYears.id, id), eq(fiscalYears.tenantId, tenantId)))
      .returning();

    return updated;
  }

  public async deleteFiscalYear(tenantId: string, id: string) {
    const [existing] = await db
      .select()
      .from(fiscalYears)
      .where(and(eq(fiscalYears.id, id), eq(fiscalYears.tenantId, tenantId)))
      .limit(1);

    if (!existing) throw new Error('Fiscal Year not found or access denied.');
    if (existing.isLocked) throw new Error('Locked fiscal year cannot be deleted.');

    await db.delete(fiscalYears).where(and(eq(fiscalYears.id, id), eq(fiscalYears.tenantId, tenantId)));
    return { success: true, deletedId: id };
  }

  // ==========================================
  // 8. CURRENCIES, COUNTRIES, NATIONALITIES
  // ==========================================
  public async listCurrencies() {
    return db.select().from(currencies).orderBy(asc(currencies.isoCode));
  }

  public async listCountries() {
    return db.select().from(countries).orderBy(asc(countries.nameEn));
  }

  public async listNationalities() {
    return db.select().from(nationalities).orderBy(asc(nationalities.nameEn));
  }

  // ==========================================
  // 9. BANKS
  // ==========================================
  public async listBanks(tenantId: string) {
    return db
      .select()
      .from(banks)
      .where(
        sql`${banks.tenantId} IS NULL OR ${banks.tenantId} = ${tenantId}`
      )
      .orderBy(asc(banks.nameEn));
  }

  public async createBank(tenantId: string, input: any, actorId = 'system') {
    const id = `bank_${input.bankCode.toLowerCase()}_${Date.now()}`;
    const [inserted] = await db
      .insert(banks)
      .values({
        id,
        tenantId,
        countryCode: input.countryCode || null,
        bankCode: input.bankCode.trim(),
        nameEn: input.nameEn.trim(),
        nameAr: input.nameAr.trim(),
        swiftCode: input.swiftCode || null,
        status: input.status || 'ACTIVE',
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    return inserted;
  }

  public async updateBank(tenantId: string, id: string, input: any, actorId = 'system') {
    const [existing] = await db
      .select()
      .from(banks)
      .where(and(eq(banks.id, id), eq(banks.tenantId, tenantId)))
      .limit(1);

    if (!existing) throw new Error('Bank record not found or access denied.');

    const [updated] = await db
      .update(banks)
      .set({
        nameEn: input.nameEn !== undefined ? input.nameEn.trim() : existing.nameEn,
        nameAr: input.nameAr !== undefined ? input.nameAr.trim() : existing.nameAr,
        bankCode: input.bankCode !== undefined ? input.bankCode.trim() : existing.bankCode,
        swiftCode: input.swiftCode !== undefined ? input.swiftCode : existing.swiftCode,
        countryCode: input.countryCode !== undefined ? input.countryCode : existing.countryCode,
        status: input.status || existing.status,
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(and(eq(banks.id, id), eq(banks.tenantId, tenantId)))
      .returning();

    return updated;
  }

  public async deleteBank(tenantId: string, id: string) {
    const [existing] = await db
      .select()
      .from(banks)
      .where(and(eq(banks.id, id), eq(banks.tenantId, tenantId)))
      .limit(1);

    if (!existing) throw new Error('Bank record not found or access denied.');

    await db.delete(banks).where(and(eq(banks.id, id), eq(banks.tenantId, tenantId)));
    return { success: true, deletedId: id };
  }

  // ==========================================
  // 10. PAYMENT METHODS
  // ==========================================
  public async listPaymentMethods(tenantId: string) {
    return db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.tenantId, tenantId))
      .orderBy(asc(paymentMethods.sortOrder), asc(paymentMethods.code));
  }

  public async createPaymentMethod(tenantId: string, input: any, actorId = 'system') {
    const code = input.code.toUpperCase().trim();
    const existing = await db
      .select()
      .from(paymentMethods)
      .where(and(eq(paymentMethods.tenantId, tenantId), eq(paymentMethods.code, code)))
      .limit(1);

    if (existing.length > 0) throw new Error(`Payment Method code '${code}' is already registered.`);

    const id = `pm_${code.toLowerCase()}_${Date.now()}`;
    const [inserted] = await db
      .insert(paymentMethods)
      .values({
        id,
        tenantId,
        code,
        nameEn: input.nameEn.trim(),
        nameAr: input.nameAr.trim(),
        paymentType: input.paymentType || 'BANK_TRANSFER',
        sortOrder: input.sortOrder || 0,
        status: input.status || 'ACTIVE',
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    return inserted;
  }

  public async updatePaymentMethod(tenantId: string, id: string, input: any, actorId = 'system') {
    const [existing] = await db
      .select()
      .from(paymentMethods)
      .where(and(eq(paymentMethods.id, id), eq(paymentMethods.tenantId, tenantId)))
      .limit(1);

    if (!existing) throw new Error('Payment method not found or access denied.');

    const [updated] = await db
      .update(paymentMethods)
      .set({
        nameEn: input.nameEn !== undefined ? input.nameEn.trim() : existing.nameEn,
        nameAr: input.nameAr !== undefined ? input.nameAr.trim() : existing.nameAr,
        paymentType: input.paymentType || existing.paymentType,
        sortOrder: input.sortOrder !== undefined ? Number(input.sortOrder) : existing.sortOrder,
        status: input.status || existing.status,
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(and(eq(paymentMethods.id, id), eq(paymentMethods.tenantId, tenantId)))
      .returning();

    return updated;
  }

  public async deletePaymentMethod(tenantId: string, id: string) {
    const [existing] = await db
      .select()
      .from(paymentMethods)
      .where(and(eq(paymentMethods.id, id), eq(paymentMethods.tenantId, tenantId)))
      .limit(1);

    if (!existing) throw new Error('Payment method not found or access denied.');

    await db.delete(paymentMethods).where(and(eq(paymentMethods.id, id), eq(paymentMethods.tenantId, tenantId)));
    return { success: true, deletedId: id };
  }

  // ==========================================
  // 11. DOCUMENT TYPES
  // ==========================================
  public async listDocumentTypes(tenantId: string) {
    return db
      .select()
      .from(documentTypes)
      .where(
        sql`${documentTypes.tenantId} IS NULL OR ${documentTypes.tenantId} = ${tenantId}`
      )
      .orderBy(asc(documentTypes.code));
  }

  public async createDocumentType(tenantId: string, input: any, actorId = 'system') {
    const code = input.code.toUpperCase().trim();
    const id = `doctype_${code.toLowerCase()}_${Date.now()}`;
    const [inserted] = await db
      .insert(documentTypes)
      .values({
        id,
        tenantId,
        code,
        nameEn: input.nameEn.trim(),
        nameAr: input.nameAr.trim(),
        entityScope: input.entityScope || 'EMPLOYEE',
        requiresIssueDate: !!input.requiresIssueDate,
        requiresExpiryDate: input.requiresExpiryDate !== undefined ? !!input.requiresExpiryDate : true,
        requiresDocumentNumber: input.requiresDocumentNumber !== undefined ? !!input.requiresDocumentNumber : true,
        status: input.status || 'ACTIVE',
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    return inserted;
  }

  public async updateDocumentType(tenantId: string, id: string, input: any, actorId = 'system') {
    const [existing] = await db
      .select()
      .from(documentTypes)
      .where(and(eq(documentTypes.id, id), eq(documentTypes.tenantId, tenantId)))
      .limit(1);

    if (!existing) throw new Error('Document Type not found or access denied.');

    const [updated] = await db
      .update(documentTypes)
      .set({
        nameEn: input.nameEn !== undefined ? input.nameEn.trim() : existing.nameEn,
        nameAr: input.nameAr !== undefined ? input.nameAr.trim() : existing.nameAr,
        entityScope: input.entityScope || existing.entityScope,
        requiresIssueDate: input.requiresIssueDate !== undefined ? !!input.requiresIssueDate : existing.requiresIssueDate,
        requiresExpiryDate: input.requiresExpiryDate !== undefined ? !!input.requiresExpiryDate : existing.requiresExpiryDate,
        requiresDocumentNumber: input.requiresDocumentNumber !== undefined ? !!input.requiresDocumentNumber : existing.requiresDocumentNumber,
        status: input.status || existing.status,
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(and(eq(documentTypes.id, id), eq(documentTypes.tenantId, tenantId)))
      .returning();

    return updated;
  }

  public async deleteDocumentType(tenantId: string, id: string) {
    const [existing] = await db
      .select()
      .from(documentTypes)
      .where(and(eq(documentTypes.id, id), eq(documentTypes.tenantId, tenantId)))
      .limit(1);

    if (!existing) throw new Error('Document Type not found or access denied.');

    await db.delete(documentTypes).where(and(eq(documentTypes.id, id), eq(documentTypes.tenantId, tenantId)));
    return { success: true, deletedId: id };
  }
}

export const masterDataRepository = new MasterDataRepository();
