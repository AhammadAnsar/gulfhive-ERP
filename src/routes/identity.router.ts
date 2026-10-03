/**
 * GulfHive ERP - Identity, Auth & Permissions Router
 * Handles login, logout, user profile, user management, RBAC roles & permissions, active sessions, and security logs.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authRepository } from '../infrastructure/database/repositories/auth.repository.ts';
import { companyRepository } from '../infrastructure/database/repositories/company.repository.ts';
import {
  authenticateToken,
  requirePermission,
  requireCompanyAccess,
} from '../core/security/auth.middleware.ts';
import { ValidationError, ForbiddenError, UnauthenticatedError } from '../core/errors/app-error.ts';
import { logger } from '../core/logging/logger.ts';

export const identityRouter = Router();

// Login
identityRouter.post('/auth/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      throw new ValidationError('Username/Email and Password are required.');
    }
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Browser';
    const result = await authRepository.login(username, password, ipAddress, userAgent);
    res.json(result);
  } catch (error) {
    logger.warn('Login attempt failed:', (error as any)?.message);
    next(new UnauthenticatedError((error as any)?.message || 'Authentication failed.'));
  }
});

// Initial Password Establishment for uninitialized accounts
identityRouter.post('/auth/establish-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { usernameOrEmail, password } = req.body;
    if (!usernameOrEmail || !password) {
      throw new ValidationError('Username/Email and Password are required.');
    }
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Browser';
    const result = await authRepository.establishInitialPassword(usernameOrEmail, password, ipAddress, userAgent);
    res.json(result);
  } catch (error: any) {
    logger.warn(`Password establishment failed: ${error?.message}`);
    next(error);
  }
});

// Logout
identityRouter.post('/auth/logout', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const customHeader = req.headers['x-session-token'] as string;
    const token = customHeader || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null);
    if (token && token.includes(':')) {
      const [sessionId] = token.split(':');
      await authRepository.revokeSession(sessionId, req.user?.displayName || 'user');
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

// Current Authenticated User Context
identityRouter.get('/auth/me', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ user: req.user });
  } catch (error) {
    next(error);
  }
});

// User Management
identityRouter.get(
  '/companies/:companyId/users',
  authenticateToken,
  requireCompanyAccess,
  requirePermission('users.view'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const usersList = await authRepository.listUsers(req.params.companyId);
      res.json({ users: usersList });
    } catch (error) {
      next(error);
    }
  }
);

identityRouter.post(
  '/companies/:companyId/users',
  authenticateToken,
  requireCompanyAccess,
  requirePermission('users.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, username, phone, password, displayName, roleIds, defaultBranchId, employeeId, preferredLanguage, status } = req.body;
      if (!email) {
        throw new ValidationError('Email address is required.');
      }

      if (
        roleIds &&
        roleIds.includes('role_company_admin') &&
        !req.user?.roles.includes('COMPANY_ADMIN') &&
        !req.user?.roles.includes('SUPER_ADMIN')
      ) {
        throw new ForbiddenError('Self-Escalation Prevention: Only Company Administrators can grant the Administrator role.');
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
    } catch (error) {
      next(error);
    }
  }
);

identityRouter.put(
  '/companies/:companyId/users/:id',
  authenticateToken,
  requireCompanyAccess,
  requirePermission('users.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = Number(req.params.id);
      const { displayName, phone, preferredLanguage, defaultBranchId, employeeId, status, roleIds, companyIds, branchIds } = req.body;

      if (
        roleIds &&
        roleIds.includes('role_company_admin') &&
        !req.user?.roles.includes('COMPANY_ADMIN') &&
        !req.user?.roles.includes('SUPER_ADMIN')
      ) {
        throw new ForbiddenError('Self-Escalation Prevention: Only Company Administrators can grant the Administrator role.');
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
    } catch (error) {
      next(error);
    }
  }
);

identityRouter.post(
  '/companies/:companyId/users/:id/reset-password',
  authenticateToken,
  requireCompanyAccess,
  requirePermission('users.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = Number(req.params.id);
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 8) {
        throw new ValidationError('Password must be at least 8 characters long.');
      }
      const result = await authRepository.resetUserPassword(userId, newPassword, req.user?.displayName || 'system');
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Roles & Permissions
identityRouter.get(
  '/companies/:companyId/roles',
  authenticateToken,
  requireCompanyAccess,
  requirePermission('roles.view'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rolesList = await authRepository.listRoles(req.params.companyId);
      res.json({ roles: rolesList });
    } catch (error) {
      next(error);
    }
  }
);

identityRouter.post(
  '/companies/:companyId/roles',
  authenticateToken,
  requireCompanyAccess,
  requirePermission('roles.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { code, nameEn, nameAr, descriptionEn, descriptionAr, permissionIds } = req.body;
      if (!code || !nameEn || !nameAr) {
        throw new ValidationError('code, nameEn, and nameAr are required.');
      }
      const newRole = await authRepository.createRole(
        req.params.companyId,
        { code, nameEn, nameAr, descriptionEn, descriptionAr, permissionIds },
        req.user?.displayName || 'system'
      );
      res.status(201).json({ role: newRole });
    } catch (error) {
      next(error);
    }
  }
);

identityRouter.put(
  '/companies/:companyId/roles/:id',
  authenticateToken,
  requireCompanyAccess,
  requirePermission('roles.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await authRepository.updateRole(req.params.id, req.body, req.user?.displayName || 'system');
      res.json({ role: updated });
    } catch (error) {
      next(error);
    }
  }
);

identityRouter.post(
  '/companies/:companyId/roles/:id/archive',
  authenticateToken,
  requireCompanyAccess,
  requirePermission('roles.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authRepository.archiveRole(req.params.id, req.user?.displayName || 'system');
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

identityRouter.get('/permissions', authenticateToken, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await authRepository.listPermissions();
    res.json({ permissions: list });
  } catch (error) {
    next(error);
  }
});

// Sessions & Security Audit
identityRouter.get(
  '/companies/:companyId/sessions',
  authenticateToken,
  requireCompanyAccess,
  requirePermission('users.manage'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionsList = await authRepository.listActiveSessions();
      res.json({ sessions: sessionsList });
    } catch (error) {
      next(error);
    }
  }
);

identityRouter.post(
  '/companies/:companyId/sessions/:id/revoke',
  authenticateToken,
  requireCompanyAccess,
  requirePermission('users.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authRepository.revokeSession(req.params.id, req.user?.displayName || 'system');
      res.json({ success: true, revokedId: req.params.id });
    } catch (error) {
      next(error);
    }
  }
);

identityRouter.get(
  '/companies/:companyId/login-events',
  authenticateToken,
  requireCompanyAccess,
  requirePermission('audit.view'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const events = await authRepository.listLoginEvents();
      res.json({ events });
    } catch (error) {
      next(error);
    }
  }
);

identityRouter.get('/companies/:id/audit-logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const logs = await companyRepository.listAuditLogs(req.params.id, limit);
    res.json({ logs });
  } catch (error) {
    next(error);
  }
});
