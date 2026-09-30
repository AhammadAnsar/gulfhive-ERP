/**
 * GulfHive ERP - Company & Organization Repository
 * Atomic transactional operations for companies, branches, roles, user assignments, and audit logs.
 */

import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../../../db/index.ts';
import { tenants, branches, users, userTenants, roles, permissions, rolePermissions, auditLogs } from '../../../db/schema.ts';
import { logger } from '../../../core/logging/logger.ts';

export interface CreateCompanyInput {
  code: string;
  legalNameEn: string;
  legalNameAr: string;
  tradeNameEn?: string;
  tradeNameAr?: string;
  countryCode: string;
  baseCurrency: string;
  crNumber?: string;
  taxNumber?: string;
  fiscalYearStartMonth: number;
  timezone: string;
  phone?: string;
  email?: string;
  website?: string;
  addressEn?: string;
  addressAr?: string;

  // Main branch
  branchCode: string;
  branchNameEn: string;
  branchNameAr: string;
  cityEn?: string;
  cityAr?: string;
  branchAddressEn?: string;
  branchAddressAr?: string;
  branchPhone?: string;

  // Administrator
  adminUid: string;
  adminEmail: string;
  adminDisplayName?: string;
}

export interface CreateBranchInput {
  tenantId: string;
  code: string;
  nameEn: string;
  nameAr: string;
  isMain?: boolean;
  cityEn?: string;
  cityAr?: string;
  addressEn?: string;
  addressAr?: string;
  phone?: string;
  actorId: string;
  actorEmail?: string;
}

export class CompanyRepository {
  public async getCompaniesCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(tenants);
    return result[0]?.count ?? 0;
  }

  public async getFirstCompany() {
    const result = await db.select().from(tenants).where(eq(tenants.isActive, true)).limit(1);
    return result[0] || null;
  }

  public async listCompanies() {
    return db.select().from(tenants).orderBy(desc(tenants.createdAt));
  }

  public async getCompanyById(id: string) {
    const comp = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
    if (!comp[0]) return null;

    const compBranches = await db.select().from(branches).where(eq(branches.tenantId, id));
    return {
      ...comp[0],
      branches: compBranches,
    };
  }

  public async createCompanyWithMainBranchAndAdmin(input: CreateCompanyInput) {
    return db.transaction(async (tx) => {
      // 1. Verify company code is unique
      const existing = await tx.select().from(tenants).where(eq(tenants.code, input.code.toUpperCase().trim())).limit(1);
      if (existing.length > 0) {
        throw new Error(`Company code '${input.code}' is already registered.`);
      }

      const tenantId = `tenant_${input.code.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
      const branchId = `branch_main_${tenantId}`;

      // 2. Insert Tenant
      const insertedTenants = await tx.insert(tenants).values({
        id: tenantId,
        code: input.code.toUpperCase().trim(),
        legalNameEn: input.legalNameEn.trim(),
        legalNameAr: input.legalNameAr.trim(),
        tradeNameEn: input.tradeNameEn?.trim() || null,
        tradeNameAr: input.tradeNameAr?.trim() || null,
        countryCode: input.countryCode.toUpperCase(),
        baseCurrency: input.baseCurrency.toUpperCase(),
        crNumber: input.crNumber?.trim() || null,
        taxNumber: input.taxNumber?.trim() || null,
        fiscalYearStartMonth: input.fiscalYearStartMonth || 1,
        timezone: input.timezone || 'Asia/Kuwait',
        phone: input.phone || null,
        email: input.email || null,
        website: input.website || null,
        addressEn: input.addressEn || null,
        addressAr: input.addressAr || null,
        isActive: true,
      }).returning();

      const tenant = insertedTenants[0];

      // 3. Insert Main Branch
      const insertedBranches = await tx.insert(branches).values({
        id: branchId,
        tenantId: tenant.id,
        code: (input.branchCode || 'HQ').toUpperCase().trim(),
        nameEn: input.branchNameEn.trim(),
        nameAr: input.branchNameAr.trim(),
        isMain: true,
        cityEn: input.cityEn?.trim() || null,
        cityAr: input.cityAr?.trim() || null,
        addressEn: input.branchAddressEn?.trim() || input.addressEn || null,
        addressAr: input.branchAddressAr?.trim() || input.addressAr || null,
        phone: input.branchPhone?.trim() || input.phone || null,
        isActive: true,
      }).returning();

      const branch = insertedBranches[0];

      // 4. Ensure Admin User exists in users table
      const upsertedUsers = await tx.insert(users).values({
        uid: input.adminUid,
        email: input.adminEmail.toLowerCase().trim(),
        displayName: input.adminDisplayName || 'System Administrator',
        role: 'COMPANY_ADMIN',
        tenantId: tenant.id,
      }).onConflictDoUpdate({
        target: users.uid,
        set: {
          email: input.adminEmail.toLowerCase().trim(),
          displayName: input.adminDisplayName || undefined,
          role: 'COMPANY_ADMIN',
          tenantId: tenant.id,
          updatedAt: new Date(),
        },
      }).returning();

      const user = upsertedUsers[0];

      // 5. Connect user to user_tenants with COMPANY_ADMIN role and main branch
      const assignmentId = `ut_${user.id}_${tenant.id}`;
      await tx.insert(userTenants).values({
        id: assignmentId,
        userId: user.id,
        tenantId: tenant.id,
        roleId: 'role_company_admin',
        defaultBranchId: branch.id,
        isDefault: true,
        isActive: true,
      }).onConflictDoUpdate({
        target: userTenants.id,
        set: {
          roleId: 'role_company_admin',
          defaultBranchId: branch.id,
          isActive: true,
        },
      });

      // 6. Record immutable Audit Log
      await tx.insert(auditLogs).values({
        tenantId: tenant.id,
        actorId: input.adminUid,
        actorEmail: input.adminEmail,
        action: 'CREATE',
        entityType: 'COMPANY',
        entityId: tenant.id,
        previousState: null,
        resultingState: {
          tenantCode: tenant.code,
          legalNameEn: tenant.legalNameEn,
          countryCode: tenant.countryCode,
          baseCurrency: tenant.baseCurrency,
          mainBranchId: branch.id,
          adminUserId: user.id,
        },
      });

      logger.audit('CREATE', 'COMPANY', tenant.id, { code: tenant.code }, { tenantId: tenant.id });

      return {
        tenant,
        branch,
        user,
      };
    });
  }

  public async listBranchesByCompany(tenantId: string) {
    return db.select().from(branches).where(eq(branches.tenantId, tenantId)).orderBy(desc(branches.isMain), branches.code);
  }

  public async createBranch(input: CreateBranchInput) {
    return db.transaction(async (tx) => {
      const existing = await tx.select().from(branches)
        .where(sql`${branches.tenantId} = ${input.tenantId} AND ${branches.code} = ${input.code.toUpperCase().trim()}`)
        .limit(1);

      if (existing.length > 0) {
        throw new Error(`Branch code '${input.code}' already exists in this company.`);
      }

      const branchId = `branch_${input.code.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;

      // If marked as main, demote any previous main branch
      if (input.isMain) {
        await tx.update(branches)
          .set({ isMain: false, updatedAt: new Date() })
          .where(eq(branches.tenantId, input.tenantId));
      }

      const inserted = await tx.insert(branches).values({
        id: branchId,
        tenantId: input.tenantId,
        code: input.code.toUpperCase().trim(),
        nameEn: input.nameEn.trim(),
        nameAr: input.nameAr.trim(),
        isMain: Boolean(input.isMain),
        cityEn: input.cityEn?.trim() || null,
        cityAr: input.cityAr?.trim() || null,
        addressEn: input.addressEn?.trim() || null,
        addressAr: input.addressAr?.trim() || null,
        phone: input.phone?.trim() || null,
        isActive: true,
      }).returning();

      const branch = inserted[0];

      // Audit log
      await tx.insert(auditLogs).values({
        tenantId: input.tenantId,
        actorId: input.actorId,
        actorEmail: input.actorEmail || null,
        action: 'CREATE',
        entityType: 'BRANCH',
        entityId: branch.id,
        previousState: null,
        resultingState: {
          code: branch.code,
          nameEn: branch.nameEn,
          isMain: branch.isMain,
        },
      });

      return branch;
    });
  }

  public async listCompanyUsers(tenantId: string) {
    return db.select({
      id: users.id,
      uid: users.uid,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      preferredLanguage: users.preferredLanguage,
      isActive: userTenants.isActive,
      roleId: userTenants.roleId,
      branchId: userTenants.defaultBranchId,
      branchNameEn: branches.nameEn,
      branchNameAr: branches.nameAr,
      roleNameEn: roles.nameEn,
      roleNameAr: roles.nameAr,
    })
      .from(userTenants)
      .innerJoin(users, eq(userTenants.userId, users.id))
      .leftJoin(roles, eq(userTenants.roleId, roles.id))
      .leftJoin(branches, eq(userTenants.defaultBranchId, branches.id))
      .where(eq(userTenants.tenantId, tenantId))
      .orderBy(users.displayName);
  }

  public async listRoles() {
    const allRoles = await db.select().from(roles).orderBy(roles.code);
    const allPermissions = await db.select().from(permissions).orderBy(permissions.module, permissions.action);
    const allMappings = await db.select().from(rolePermissions);

    return allRoles.map((r) => {
      const assignedPermIds = new Set(allMappings.filter((m) => m.roleId === r.id).map((m) => m.permissionId));
      return {
        ...r,
        permissions: allPermissions.filter((p) => assignedPermIds.has(p.id)),
      };
    });
  }

  public async listAuditLogs(tenantId: string, limit = 50) {
    return db.select().from(auditLogs)
      .where(eq(auditLogs.tenantId, tenantId))
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit);
  }
}

export const companyRepository = new CompanyRepository();
