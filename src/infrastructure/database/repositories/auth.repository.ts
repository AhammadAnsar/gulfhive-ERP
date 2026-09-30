/**
 * GulfHive ERP - Identity, Authentication & Permissions Repository
 * Centralized RBAC, Data Scopes, Sessions, and Multi-Company / Multi-Branch Security Engine.
 */

import { eq, and, sql, desc, inArray, asc } from 'drizzle-orm';
import crypto from 'crypto';
import { db } from '../../../db/index.ts';
import {
  users,
  roles,
  permissions,
  rolePermissions,
  userRoles,
  userCompanyAccess,
  userBranchAccess,
  userDataScopes,
  userSessions,
  loginEvents,
  tenants,
  branches,
  auditLogs,
} from '../../../db/schema.ts';
import { logger } from '../../../core/logging/logger.ts';

export interface UserInput {
  username?: string;
  email: string;
  phone?: string;
  password?: string;
  displayName?: string;
  role?: string;
  tenantId?: string;
  defaultBranchId?: string;
  employeeId?: string;
  preferredLanguage?: string;
  status?: string; // 'ACTIVE', 'DISABLED', 'LOCKED'
  mustChangePassword?: boolean;
}

export interface RoleInput {
  code: string;
  nameEn: string;
  nameAr: string;
  descriptionEn?: string;
  descriptionAr?: string;
  permissionIds?: string[];
  tenantId?: string;
}

export interface AuthContext {
  userId: number;
  uid: string;
  email: string;
  displayName: string | null;
  activeCompanyId: string;
  activeBranchId: string | null;
  roles: string[];
  permissions: string[];
  dataScopes: Record<string, string>;
  authorizedCompanyIds: string[];
  authorizedBranchIds: string[];
}

export class AuthRepository {
  // Password Hashing Helper using scrypt + salt
  public hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  public verifyPassword(password: string, storedHash: string): boolean {
    if (!storedHash || !storedHash.includes(':')) return false;
    const [salt, originalHash] = storedHash.split(':');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
  }

  // ==========================================
  // 1. AUTHENTICATION & SESSIONS
  // ==========================================
  public async login(
    usernameOrEmail: string,
    passwordAttempt: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ token: string; user: AuthContext }> {
    const term = usernameOrEmail.trim().toLowerCase();

    // Query user by username or email
    const matchedUsers = await db
      .select()
      .from(users)
      .where(
        sql`LOWER(${users.email}) = ${term} OR LOWER(${users.username}) = ${term}`
      )
      .limit(1);

    if (matchedUsers.length === 0) {
      await this.recordLoginEvent(null, usernameOrEmail, false, 'Invalid credentials', ipAddress, userAgent);
      throw new Error('Invalid username/email or password');
    }

    const u = matchedUsers[0];

    // Check account status
    if (u.status === 'DISABLED' || !u.isActive) {
      await this.recordLoginEvent(u.id, usernameOrEmail, false, 'Account disabled', ipAddress, userAgent);
      throw new Error('Account is disabled. Please contact your administrator.');
    }

    if (u.status === 'LOCKED' && u.lockedUntil && new Date(u.lockedUntil) > new Date()) {
      await this.recordLoginEvent(u.id, usernameOrEmail, false, 'Account locked', ipAddress, userAgent);
      throw new Error(`Account is locked until ${new Date(u.lockedUntil).toLocaleTimeString()}.`);
    }

    // Verify password
    let isPasswordValid = false;
    if (u.passwordHash) {
      isPasswordValid = this.verifyPassword(passwordAttempt, u.passwordHash);
    } else {
      // Temporary fallback for initial seed accounts
      isPasswordValid = passwordAttempt === 'Password@123' || passwordAttempt === 'Admin@123';
    }

    if (!isPasswordValid) {
      const attempts = (u.failedLoginAttempts || 0) + 1;
      const isLockedNow = attempts >= 5;
      const lockUntil = isLockedNow ? new Date(Date.now() + 15 * 60 * 1000) : null;

      await db
        .update(users)
        .set({
          failedLoginAttempts: attempts,
          status: isLockedNow ? 'LOCKED' : u.status,
          lockedUntil: lockUntil,
          updatedAt: new Date(),
        })
        .where(eq(users.id, u.id));

      await this.recordLoginEvent(u.id, usernameOrEmail, false, 'Invalid password', ipAddress, userAgent);
      throw new Error('Invalid username/email or password');
    }

    // Successful login: reset failed attempts & update lastLoginAt
    await db
      .update(users)
      .set({
        failedLoginAttempts: 0,
        lockedUntil: null,
        status: u.status === 'LOCKED' ? 'ACTIVE' : u.status,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, u.id));

    await this.recordLoginEvent(u.id, usernameOrEmail, true, null, ipAddress, userAgent);

    // Create session token
    const tokenSecret = crypto.randomBytes(32).toString('hex');
    const sessionId = `sess_${u.id}_${Date.now()}`;
    const tokenHash = crypto.createHash('sha256').update(tokenSecret).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.insert(userSessions).values({
      id: sessionId,
      userId: u.id,
      tokenHash,
      deviceInfo: userAgent || 'Standard Session',
      ipAddress: ipAddress || '127.0.0.1',
      expiresAt,
    });

    const activeCompanyId = u.tenantId || 'tenant_corp_01_1790702844962';
    const authCtx = await this.getAuthorizationContext(u.id, activeCompanyId, u.defaultBranchId || undefined);

    const token = `${sessionId}:${tokenSecret}`;
    return { token, user: authCtx };
  }

  public async verifySessionToken(tokenString: string): Promise<AuthContext | null> {
    if (!tokenString || !tokenString.includes(':')) return null;
    const [sessionId, tokenSecret] = tokenString.split(':');
    const tokenHash = crypto.createHash('sha256').update(tokenSecret).digest('hex');

    const matchedSessions = await db
      .select()
      .from(userSessions)
      .where(
        and(
          eq(userSessions.id, sessionId),
          eq(userSessions.tokenHash, tokenHash),
          sql`${userSessions.revokedAt} IS NULL`,
          sql`${userSessions.expiresAt} > NOW()`
        )
      )
      .limit(1);

    if (matchedSessions.length === 0) return null;
    const session = matchedSessions[0];

    // Update session last activity
    await db
      .update(userSessions)
      .set({ lastActivityAt: new Date() })
      .where(eq(userSessions.id, session.id));

    // Get user default company
    const [u] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
    if (!u || u.status === 'DISABLED' || !u.isActive) return null;

    const companyId = u.tenantId || 'tenant_corp_01_1790702844962';
    return this.getAuthorizationContext(u.id, companyId, u.defaultBranchId || undefined);
  }

  public async revokeSession(sessionId: string, actorId = 'system'): Promise<boolean> {
    await db
      .update(userSessions)
      .set({ revokedAt: new Date() })
      .where(eq(userSessions.id, sessionId));
    return true;
  }

  public async listActiveSessions(userId?: number) {
    let query = db
      .select({
        id: userSessions.id,
        userId: userSessions.userId,
        userName: users.displayName,
        userEmail: users.email,
        deviceInfo: userSessions.deviceInfo,
        ipAddress: userSessions.ipAddress,
        lastActivityAt: userSessions.lastActivityAt,
        expiresAt: userSessions.expiresAt,
        createdAt: userSessions.createdAt,
      })
      .from(userSessions)
      .innerJoin(users, eq(userSessions.userId, users.id))
      .where(sql`${userSessions.revokedAt} IS NULL AND ${userSessions.expiresAt} > NOW()`);

    if (userId) {
      return db
        .select({
          id: userSessions.id,
          userId: userSessions.userId,
          userName: users.displayName,
          userEmail: users.email,
          deviceInfo: userSessions.deviceInfo,
          ipAddress: userSessions.ipAddress,
          lastActivityAt: userSessions.lastActivityAt,
          expiresAt: userSessions.expiresAt,
          createdAt: userSessions.createdAt,
        })
        .from(userSessions)
        .innerJoin(users, eq(userSessions.userId, users.id))
        .where(and(eq(userSessions.userId, userId), sql`${userSessions.revokedAt} IS NULL AND ${userSessions.expiresAt} > NOW()`))
        .orderBy(desc(userSessions.lastActivityAt));
    }

    return db
      .select({
        id: userSessions.id,
        userId: userSessions.userId,
        userName: users.displayName,
        userEmail: users.email,
        deviceInfo: userSessions.deviceInfo,
        ipAddress: userSessions.ipAddress,
        lastActivityAt: userSessions.lastActivityAt,
        expiresAt: userSessions.expiresAt,
        createdAt: userSessions.createdAt,
      })
      .from(userSessions)
      .innerJoin(users, eq(userSessions.userId, users.id))
      .where(sql`${userSessions.revokedAt} IS NULL AND ${userSessions.expiresAt} > NOW()`)
      .orderBy(desc(userSessions.lastActivityAt));
  }

  public async recordLoginEvent(
    userId: number | null,
    username: string,
    isSuccess: boolean,
    failureReason: string | null = null,
    ipAddress?: string,
    userAgent?: string
  ) {
    await db.insert(loginEvents).values({
      userId,
      username,
      isSuccess,
      failureReason,
      ipAddress: ipAddress || '127.0.0.1',
      userAgent: userAgent || 'System',
    });
  }

  public async listLoginEvents(userId?: number) {
    if (userId) {
      return db
        .select()
        .from(loginEvents)
        .where(eq(loginEvents.userId, userId))
        .orderBy(desc(loginEvents.timestamp))
        .limit(100);
    }
    return db.select().from(loginEvents).orderBy(desc(loginEvents.timestamp)).limit(100);
  }

  // ==========================================
  // 2. AUTHORIZATION CONTEXT & PERMISSIONS EVALUATOR
  // ==========================================
  public async getAuthorizationContext(userId: number, companyId: string, branchId?: string): Promise<AuthContext> {
    const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!u) throw new Error('User record not found');

    // 1. Authorized Companies
    const companyAccess = await db
      .select({ companyId: userCompanyAccess.companyId })
      .from(userCompanyAccess)
      .where(and(eq(userCompanyAccess.userId, userId), eq(userCompanyAccess.status, 'ACTIVE')));

    let authorizedCompanyIds = companyAccess.map((c) => c.companyId);
    if (!authorizedCompanyIds.includes(companyId) && u.tenantId) {
      authorizedCompanyIds.push(u.tenantId);
    }

    // 2. Authorized Branches
    const branchAccess = await db
      .select({ branchId: userBranchAccess.branchId })
      .from(userBranchAccess)
      .where(and(eq(userBranchAccess.userId, userId), eq(userBranchAccess.companyId, companyId)));

    const authorizedBranchIds = branchAccess.map((b) => b.branchId);

    // 3. User Roles
    const userRoleList = await db
      .select({
        roleId: roles.id,
        roleCode: roles.code,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(and(eq(userRoles.userId, userId), sql`${userRoles.tenantId} IS NULL OR ${userRoles.tenantId} = ${companyId}`));

    let userRoleCodes = userRoleList.map((r) => r.roleCode);
    let userRoleIds = userRoleList.map((r) => r.roleId);

    // Fallback if legacy role string exists
    if (userRoleCodes.length === 0 && u.role) {
      userRoleCodes = [u.role];
      if (u.role === 'COMPANY_ADMIN' || u.role === 'ADMIN' || u.role === 'SUPER_ADMIN') {
        userRoleIds = ['role_company_admin'];
      } else if (u.role === 'HR_MANAGER') {
        userRoleIds = ['role_hr_manager'];
      } else if (u.role === 'FINANCE_MANAGER') {
        userRoleIds = ['role_finance_manager'];
      } else if (u.role === 'AUDITOR') {
        userRoleIds = ['role_auditor'];
      } else {
        userRoleIds = ['role_viewer'];
      }
    }

    // 4. Permissions associated with assigned roles
    let permissionCodes: string[] = [];
    if (userRoleIds.length > 0) {
      const permList = await db
        .select({ code: permissions.code })
        .from(rolePermissions)
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
        .where(inArray(rolePermissions.roleId, userRoleIds));

      permissionCodes = Array.from(new Set(permList.map((p) => p.code)));
    }

    // If Company Admin or Super Admin, grant all permissions
    if (userRoleCodes.includes('COMPANY_ADMIN') || userRoleCodes.includes('SUPER_ADMIN') || u.role === 'SUPER_ADMIN') {
      const allPerms = await db.select({ code: permissions.code }).from(permissions);
      permissionCodes = allPerms.map((p) => p.code);
    }

    // 5. Data Scopes
    const dataScopesList = await db
      .select({ module: userDataScopes.module, scope: userDataScopes.scope })
      .from(userDataScopes)
      .where(and(eq(userDataScopes.userId, userId), eq(userDataScopes.companyId, companyId)));

    const dataScopesMap: Record<string, string> = {};
    dataScopesList.forEach((ds) => {
      dataScopesMap[ds.module] = ds.scope;
    });

    return {
      userId: u.id,
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      activeCompanyId: companyId,
      activeBranchId: branchId || u.defaultBranchId || null,
      roles: userRoleCodes,
      permissions: permissionCodes,
      dataScopes: dataScopesMap,
      authorizedCompanyIds,
      authorizedBranchIds,
    };
  }

  // Permission check helper
  public can(authCtx: AuthContext, requiredPermission: string, requiredCompanyId?: string): boolean {
    if (!authCtx) return false;
    if (requiredCompanyId && !authCtx.authorizedCompanyIds.includes(requiredCompanyId)) {
      return false; // Cross-company isolation enforcement
    }
    if (authCtx.roles.includes('COMPANY_ADMIN') || authCtx.roles.includes('SUPER_ADMIN')) {
      return true;
    }
    return authCtx.permissions.includes(requiredPermission);
  }

  // ==========================================
  // 3. USER MANAGEMENT & SELF-LOCKOUT SAFEGUARDS
  // ==========================================
  public async listUsers(tenantId: string) {
    const list = await db
      .select({
        id: users.id,
        uid: users.uid,
        username: users.username,
        email: users.email,
        phone: users.phone,
        displayName: users.displayName,
        role: users.role,
        tenantId: users.tenantId,
        defaultBranchId: users.defaultBranchId,
        employeeId: users.employeeId,
        preferredLanguage: users.preferredLanguage,
        status: users.status,
        mustChangePassword: users.mustChangePassword,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(sql`${users.tenantId} IS NULL OR ${users.tenantId} = ${tenantId}`)
      .orderBy(asc(users.id));

    // Attach role codes to users
    for (const u of list) {
      const uRoles = await db
        .select({ roleCode: roles.code, roleNameEn: roles.nameEn, roleNameAr: roles.nameAr })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.userId, u.id));

      (u as any).assignedRoles = uRoles;
    }

    return list;
  }

  public async getUserById(userId: number) {
    const [u] = await db
      .select({
        id: users.id,
        uid: users.uid,
        username: users.username,
        email: users.email,
        phone: users.phone,
        displayName: users.displayName,
        role: users.role,
        tenantId: users.tenantId,
        defaultBranchId: users.defaultBranchId,
        employeeId: users.employeeId,
        preferredLanguage: users.preferredLanguage,
        status: users.status,
        mustChangePassword: users.mustChangePassword,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!u) return null;

    const uRoles = await db
      .select({ roleId: roles.id, roleCode: roles.code, roleNameEn: roles.nameEn })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, u.id));

    const companyAccess = await db
      .select({ companyId: userCompanyAccess.companyId, companyNameEn: tenants.legalNameEn })
      .from(userCompanyAccess)
      .innerJoin(tenants, eq(userCompanyAccess.companyId, tenants.id))
      .where(eq(userCompanyAccess.userId, u.id));

    const branchAccess = await db
      .select({ branchId: userBranchAccess.branchId, branchNameEn: branches.nameEn })
      .from(userBranchAccess)
      .innerJoin(branches, eq(userBranchAccess.branchId, branches.id))
      .where(eq(userBranchAccess.userId, u.id));

    return {
      ...u,
      assignedRoles: uRoles,
      companyAccess,
      branchAccess,
    };
  }

  public async createUser(tenantId: string, input: UserInput, roleIds: string[] = [], actorId = 'system') {
    // Check username uniqueness if provided
    if (input.username) {
      const existingName = await db
        .select()
        .from(users)
        .where(eq(users.username, input.username.trim().toLowerCase()))
        .limit(1);
      if (existingName.length > 0) throw new Error(`Username '${input.username}' is already taken.`);
    }

    // Check email uniqueness
    const existingEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, input.email.trim().toLowerCase()))
      .limit(1);

    if (existingEmail.length > 0) throw new Error(`Email address '${input.email}' is already registered.`);

    const uid = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const passwordHash = input.password ? this.hashPassword(input.password) : this.hashPassword('Password@123');

    const [inserted] = await db
      .insert(users)
      .values({
        uid,
        username: input.username ? input.username.trim().toLowerCase() : null,
        email: input.email.trim().toLowerCase(),
        phone: input.phone || null,
        passwordHash,
        displayName: input.displayName ? input.displayName.trim() : input.email.split('@')[0],
        role: input.role || 'VIEWER',
        tenantId,
        defaultBranchId: input.defaultBranchId || null,
        employeeId: input.employeeId || null,
        preferredLanguage: input.preferredLanguage || 'en',
        status: input.status || 'ACTIVE',
        mustChangePassword: input.mustChangePassword !== undefined ? !!input.mustChangePassword : true,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    // Assign Company Access
    await db.insert(userCompanyAccess).values({
      userId: inserted.id,
      companyId: tenantId,
      isDefault: true,
      createdBy: actorId,
    });

    // Assign Roles
    const targetRoles = roleIds.length > 0 ? roleIds : ['role_viewer'];
    for (const rId of targetRoles) {
      await db.insert(userRoles).values({
        userId: inserted.id,
        roleId: rId,
        tenantId,
      });
    }

    logger.audit('CREATE', 'USER', inserted.id.toString(), { email: inserted.email, roles: targetRoles }, { tenantId });
    return this.getUserById(inserted.id);
  }

  public async updateUser(
    userId: number,
    input: Partial<UserInput>,
    roleIds?: string[],
    companyIds?: string[],
    branchIds?: string[],
    actorId = 'system'
  ) {
    const existing = await this.getUserById(userId);
    if (!existing) throw new Error('User record not found');

    // Self-lockout check: if disabling user, ensure they are not the last active administrator
    if (input.status === 'DISABLED' || input.status === 'INACTIVE') {
      await this.verifyNotLastAdmin(userId);
    }

    // Check if role escalation attempt
    if (roleIds) {
      const isRemovingAdmin = existing.assignedRoles.some((r) => r.roleCode === 'COMPANY_ADMIN') && !roleIds.includes('role_company_admin');
      if (isRemovingAdmin) {
        await this.verifyNotLastAdmin(userId);
      }
    }

    await db
      .update(users)
      .set({
        displayName: input.displayName !== undefined ? input.displayName.trim() : existing.displayName,
        phone: input.phone !== undefined ? input.phone : existing.phone,
        preferredLanguage: input.preferredLanguage || existing.preferredLanguage,
        defaultBranchId: input.defaultBranchId !== undefined ? input.defaultBranchId : existing.defaultBranchId,
        employeeId: input.employeeId !== undefined ? input.employeeId : existing.employeeId,
        status: input.status || existing.status,
        mustChangePassword: input.mustChangePassword !== undefined ? !!input.mustChangePassword : existing.mustChangePassword,
        updatedAt: new Date(),
        updatedBy: actorId,
        disabledAt: input.status === 'DISABLED' ? new Date() : null,
        disabledBy: input.status === 'DISABLED' ? actorId : null,
      })
      .where(eq(users.id, userId));

    // Update Roles
    if (roleIds) {
      await db.delete(userRoles).where(eq(userRoles.userId, userId));
      for (const rId of roleIds) {
        await db.insert(userRoles).values({ userId, roleId: rId, tenantId: existing.tenantId });
      }
    }

    // Update Company Access
    if (companyIds) {
      await db.delete(userCompanyAccess).where(eq(userCompanyAccess.userId, userId));
      for (const cId of companyIds) {
        await db.insert(userCompanyAccess).values({ userId, companyId: cId, createdBy: actorId });
      }
    }

    // Update Branch Access
    if (branchIds && existing.tenantId) {
      await db.delete(userBranchAccess).where(and(eq(userBranchAccess.userId, userId), eq(userBranchAccess.companyId, existing.tenantId)));
      for (const bId of branchIds) {
        await db.insert(userBranchAccess).values({ userId, companyId: existing.tenantId, branchId: bId, createdBy: actorId });
      }
    }

    logger.audit('UPDATE', 'USER', userId.toString(), { changes: input, roleIds }, { tenantId: existing.tenantId ?? undefined });
    return this.getUserById(userId);
  }

  public async resetUserPassword(userId: number, newPassword: string, actorId = 'system') {
    const u = await this.getUserById(userId);
    if (!u) throw new Error('User record not found');

    const passwordHash = this.hashPassword(newPassword);
    await db
      .update(users)
      .set({
        passwordHash,
        mustChangePassword: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
        status: u.status === 'LOCKED' ? 'ACTIVE' : u.status,
        lastPasswordChangedAt: new Date(),
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(eq(users.id, userId));

    logger.audit('PASSWORD_RESET', 'USER', userId.toString(), { resetBy: actorId }, { tenantId: u.tenantId ?? undefined });
    return { success: true, message: 'Password reset successfully' };
  }

  private async verifyNotLastAdmin(userId: number) {
    const adminRoles = await db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .innerJoin(users, eq(userRoles.userId, users.id))
      .where(and(eq(roles.code, 'COMPANY_ADMIN'), eq(users.status, 'ACTIVE')));

    const activeAdminIds = Array.from(new Set(adminRoles.map((a) => a.userId)));
    if (activeAdminIds.length <= 1 && activeAdminIds.includes(userId)) {
      throw new Error('Self-Lockout Protection: Cannot disable or remove Administrator role from the last remaining active Administrator.');
    }
  }

  // ==========================================
  // 4. ROLES & PERMISSIONS MANAGEMENT
  // ==========================================
  public async listRoles(tenantId: string) {
    const list = await db
      .select()
      .from(roles)
      .where(
        sql`${roles.tenantId} IS NULL OR ${roles.tenantId} = ${tenantId}`
      )
      .orderBy(asc(roles.code));

    for (const r of list) {
      const perms = await db
        .select({ id: permissions.id, code: permissions.code, nameEn: permissions.nameEn })
        .from(rolePermissions)
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
        .where(eq(rolePermissions.roleId, r.id));

      const uCount = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(userRoles)
        .where(eq(userRoles.roleId, r.id));

      (r as any).permissions = perms;
      (r as any).assignedUsersCount = uCount[0]?.count || 0;
    }

    return list;
  }

  public async listPermissions() {
    return db.select().from(permissions).orderBy(asc(permissions.module), asc(permissions.code));
  }

  public async createRole(tenantId: string, input: RoleInput, actorId = 'system') {
    const code = input.code.toUpperCase().trim();
    const existing = await db
      .select()
      .from(roles)
      .where(and(eq(roles.tenantId, tenantId), eq(roles.code, code)))
      .limit(1);

    if (existing.length > 0) throw new Error(`Role code '${code}' is already registered.`);

    const id = `role_${code.toLowerCase()}_${Date.now()}`;
    const [inserted] = await db
      .insert(roles)
      .values({
        id,
        tenantId,
        code,
        nameEn: input.nameEn.trim(),
        nameAr: input.nameAr.trim(),
        descriptionEn: input.descriptionEn || null,
        descriptionAr: input.descriptionAr || null,
        isSystemRole: false,
        status: 'ACTIVE',
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    if (input.permissionIds && input.permissionIds.length > 0) {
      for (const pId of input.permissionIds) {
        await db.insert(rolePermissions).values({ roleId: id, permissionId: pId });
      }
    }

    logger.audit('CREATE', 'ROLE', id, { code: inserted.code, permissions: input.permissionIds }, { tenantId });
    return inserted;
  }

  public async updateRole(roleId: string, input: Partial<RoleInput>, actorId = 'system') {
    const [existing] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
    if (!existing) throw new Error('Role not found');

    const [updated] = await db
      .update(roles)
      .set({
        nameEn: input.nameEn !== undefined ? input.nameEn.trim() : existing.nameEn,
        nameAr: input.nameAr !== undefined ? input.nameAr.trim() : existing.nameAr,
        descriptionEn: input.descriptionEn !== undefined ? input.descriptionEn : existing.descriptionEn,
        descriptionAr: input.descriptionAr !== undefined ? input.descriptionAr : existing.descriptionAr,
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(eq(roles.id, roleId))
      .returning();

    if (input.permissionIds) {
      await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
      for (const pId of input.permissionIds) {
        await db.insert(rolePermissions).values({ roleId, permissionId: pId });
      }
    }

    logger.audit('UPDATE', 'ROLE', roleId, { permissions: input.permissionIds }, { tenantId: existing.tenantId ?? undefined });
    return updated;
  }

  public async archiveRole(roleId: string, actorId = 'system') {
    const [existing] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
    if (!existing) throw new Error('Role not found');
    if (existing.isSystemRole) throw new Error('System roles cannot be archived or deleted.');

    await db
      .update(roles)
      .set({ status: 'ARCHIVED', archivedAt: new Date(), archivedBy: actorId })
      .where(eq(roles.id, roleId));

    return { success: true, archivedId: roleId };
  }
}

export const authRepository = new AuthRepository();
