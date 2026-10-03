/**
 * GulfHive ERP - Company & Organization Repository
 * Atomic transactional operations for companies, branches, roles, user assignments, and audit logs.
 */

import crypto from 'crypto';
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../../../db/index.ts';
import {
  tenants,
  branches,
  users,
  userTenants,
  userRoles,
  userCompanyAccess,
  userBranchAccess,
  userDataScopes,
  userSessions,
  roles,
  permissions,
  rolePermissions,
  auditLogs,
  documentSequences,
} from '../../../db/schema.ts';
import { logger } from '../../../core/logging/logger.ts';
import { authRepository } from './auth.repository.ts';

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
  adminUsername?: string;
  adminDisplayName?: string;
  adminPhone?: string;
  adminPassword?: string;
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

  public async updateCompany(
    id: string,
    input: {
      legalNameEn?: string;
      legalNameAr?: string;
      tradeNameEn?: string;
      tradeNameAr?: string;
      logoUrl?: string;
      crNumber?: string;
      taxNumber?: string;
      fiscalYearStartMonth?: number;
      timezone?: string;
      phone?: string;
      email?: string;
      website?: string;
      addressEn?: string;
      addressAr?: string;
      actorId?: string;
      actorEmail?: string;
    }
  ) {
    const existing = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
    if (existing.length === 0) {
      throw new Error(`Company with id '${id}' not found.`);
    }

    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (input.legalNameEn !== undefined) updateData.legalNameEn = input.legalNameEn.trim();
    if (input.legalNameAr !== undefined) updateData.legalNameAr = input.legalNameAr.trim();
    if (input.tradeNameEn !== undefined) updateData.tradeNameEn = input.tradeNameEn?.trim() || null;
    if (input.tradeNameAr !== undefined) updateData.tradeNameAr = input.tradeNameAr?.trim() || null;
    if (input.logoUrl !== undefined) updateData.logoUrl = input.logoUrl || null;
    if (input.crNumber !== undefined) updateData.crNumber = input.crNumber?.trim() || null;
    if (input.taxNumber !== undefined) updateData.taxNumber = input.taxNumber?.trim() || null;
    if (input.fiscalYearStartMonth !== undefined) updateData.fiscalYearStartMonth = Number(input.fiscalYearStartMonth) || 1;
    if (input.timezone !== undefined) updateData.timezone = input.timezone;
    if (input.phone !== undefined) updateData.phone = input.phone?.trim() || null;
    if (input.email !== undefined) updateData.email = input.email?.trim() || null;
    if (input.website !== undefined) updateData.website = input.website?.trim() || null;
    if (input.addressEn !== undefined) updateData.addressEn = input.addressEn?.trim() || null;
    if (input.addressAr !== undefined) updateData.addressAr = input.addressAr?.trim() || null;

    const [updated] = await db
      .update(tenants)
      .set(updateData)
      .where(eq(tenants.id, id))
      .returning();

    logger.audit('UPDATE', 'COMPANY', id, { updatedFields: Object.keys(updateData) }, { tenantId: id, actorId: input.actorId });
    return updated;
  }

  public async createCompanyWithMainBranchAndAdmin(input: CreateCompanyInput) {
    const cleanCode = input.code.toUpperCase().trim();

    // Idempotency pre-check: if this exact company code was already established with main branch, return it gracefully
    const existing = await db.select().from(tenants).where(eq(tenants.code, cleanCode)).limit(1);
    if (existing.length > 0) {
      const existingTenant = existing[0];
      const existingBranches = await db.select().from(branches).where(eq(branches.tenantId, existingTenant.id)).limit(1);
      const existingUsers = await db.select().from(users).where(eq(users.tenantId, existingTenant.id)).limit(1);
      if (existingBranches.length > 0) {
        return {
          tenant: existingTenant,
          branch: existingBranches[0],
          user: existingUsers[0] || null,
        };
      }
      throw new Error(`Company code '${input.code}' is already registered.`);
    }

    return db.transaction(async (tx) => {
      // 1. Verify company code is unique within transaction
      const inTxExisting = await tx.select().from(tenants).where(eq(tenants.code, cleanCode)).limit(1);
      if (inTxExisting.length > 0) {
        throw new Error(`Company code '${input.code}' is already registered.`);
      }

      const tenantId = `tenant_${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
      const branchId = `branch_main_${tenantId}`;

      // 2. Insert Tenant
      const insertedTenants = await tx.insert(tenants).values({
        id: tenantId,
        code: cleanCode,
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

      // 4. Ensure Admin User exists in users table with secure password if provided
      const passwordHash = input.adminPassword ? authRepository.hashPassword(input.adminPassword) : null;
      const cleanEmail = input.adminEmail.toLowerCase().trim();
      const cleanUsername = input.adminUsername ? input.adminUsername.trim().toLowerCase() : cleanEmail.split('@')[0];

      const upsertedUsers = await tx.insert(users).values({
        uid: input.adminUid,
        email: cleanEmail,
        username: cleanUsername,
        displayName: input.adminDisplayName || 'System Administrator',
        phone: input.adminPhone?.trim() || null,
        role: 'SUPER_ADMIN',
        tenantId: tenant.id,
        defaultBranchId: branch.id,
        passwordHash,
        status: 'ACTIVE',
        isActive: true,
        mustChangePassword: false,
        failedLoginAttempts: 0,
      }).onConflictDoUpdate({
        target: users.uid,
        set: {
          email: cleanEmail,
          username: cleanUsername,
          displayName: input.adminDisplayName || undefined,
          phone: input.adminPhone?.trim() || undefined,
          role: 'SUPER_ADMIN',
          tenantId: tenant.id,
          defaultBranchId: branch.id,
          passwordHash: passwordHash || undefined,
          status: 'ACTIVE',
          isActive: true,
          mustChangePassword: false,
          failedLoginAttempts: 0,
          updatedAt: new Date(),
        },
      }).returning();

      const user = upsertedUsers[0];

      // 5. Connect user to RBAC tables: userRoles, userCompanyAccess, userBranchAccess, userDataScopes, and userTenants
      // 5a. Assign SUPER_ADMIN and COMPANY_ADMIN system roles
      await tx.insert(userRoles).values([
        {
          userId: user.id,
          roleId: 'role_super_admin',
          tenantId: tenant.id,
        },
        {
          userId: user.id,
          roleId: 'role_company_admin',
          tenantId: tenant.id,
        },
      ]).onConflictDoNothing();

      // 5b. Authorize company access
      await tx.insert(userCompanyAccess).values({
        userId: user.id,
        companyId: tenant.id,
        isDefault: true,
        status: 'ACTIVE',
        createdBy: input.adminUid || 'system',
      });

      // 5c. Authorize branch access
      await tx.insert(userBranchAccess).values({
        userId: user.id,
        companyId: tenant.id,
        branchId: branch.id,
        createdBy: input.adminUid || 'system',
      });

      // 5d. Data scopes
      await tx.insert(userDataScopes).values({
        userId: user.id,
        companyId: tenant.id,
        module: 'ALL',
        scope: 'ALL_COMPANIES',
      });

      // 5e. Legacy user_tenants table compatibility
      const assignmentId = `ut_${user.id}_${tenant.id}`;
      await tx.insert(userTenants).values({
        id: assignmentId,
        userId: user.id,
        tenantId: tenant.id,
        roleId: 'role_super_admin',
        defaultBranchId: branch.id,
        isDefault: true,
        isActive: true,
      }).onConflictDoUpdate({
        target: userTenants.id,
        set: {
          roleId: 'role_super_admin',
          defaultBranchId: branch.id,
          isActive: true,
        },
      });

      // 6. Initialize default central document sequences for new enterprise
      const defaultDocumentTypes = [
        { type: 'EMPLOYEE', prefix: 'EMP' },
        { type: 'TIMESHEET', prefix: 'TS' },
        { type: 'INVOICE', prefix: 'INV' },
        { type: 'BILL', prefix: 'BILL' },
        { type: 'PAYROLL', prefix: 'PAY' },
        { type: 'PROJECT', prefix: 'PRJ' },
        { type: 'JOURNAL', prefix: 'JRN' },
        { type: 'PAYMENT', prefix: 'PAY' },
        { type: 'RECEIPT', prefix: 'RCT' },
        { type: 'QUOTATION', prefix: 'QT' },
      ];

      for (const item of defaultDocumentTypes) {
        await tx.insert(documentSequences).values({
          id: `seq_${item.type.toLowerCase()}_${tenant.id}`,
          tenantId: tenant.id,
          documentType: item.type,
          prefix: item.prefix,
          suffix: '',
          separator: '-',
          includeYear: true,
          includeMonth: false,
          paddingLength: 5,
          nextNumber: 1,
          resetPolicy: 'NEVER',
          status: 'ACTIVE',
          createdBy: input.adminUid || 'system',
        }).onConflictDoNothing();
      }

      // 7. Generate established cryptographic session token for immediate dashboard authorization
      const tokenSecret = crypto.randomBytes(32).toString('hex');
      const sessionId = `sess_${user.id}_${Date.now()}`;
      const tokenHash = crypto.createHash('sha256').update(tokenSecret).digest('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await tx.insert(userSessions).values({
        id: sessionId,
        userId: user.id,
        tokenHash,
        deviceInfo: 'First-Run Establishment Session',
        ipAddress: '127.0.0.1',
        expiresAt,
      });

      const token = `${sessionId}:${tokenSecret}`;

      // 8. Record immutable Audit Log
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

      const allPerms = await tx.select({ code: permissions.code }).from(permissions);
      const permissionCodes = allPerms.map((p) => p.code);

      const authCtx = {
        userId: user.id,
        id: user.id,
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        activeCompanyId: tenant.id,
        activeBranchId: branch.id,
        roles: ['SUPER_ADMIN', 'COMPANY_ADMIN'],
        permissions: permissionCodes,
        dataScopes: { ALL: 'ALL_COMPANIES' },
        authorizedCompanyIds: [tenant.id],
        authorizedBranchIds: [branch.id],
      };

      return {
        tenant,
        branch,
        user: authCtx,
        token,
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
