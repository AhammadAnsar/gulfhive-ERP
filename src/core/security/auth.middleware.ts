/**
 * GulfHive ERP - Reusable Security Middleware & Authorization Guards
 * Enforces authentication, RBAC permissions, company isolation, and server-side data sanitization.
 */

import { Request, Response, NextFunction } from 'express';
import { authRepository, AuthContext } from '../../infrastructure/database/repositories/auth.repository.ts';
import { adminAuth } from '../../lib/firebase-admin.ts';
import { logger } from '../logging/logger.ts';

// Extend Express Request to include AuthContext
declare global {
  namespace Express {
    interface Request {
      user?: AuthContext;
    }
  }
}

/**
 * Authentication Middleware: Validates Bearer token (GulfHive Session or Firebase ID Token) or x-session-token header.
 * Strictly rejects missing or invalid tokens with HTTP 401 Unauthorized in production.
 */
export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const customHeader = req.headers['x-session-token'] as string;
  let token: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (customHeader) {
    token = customHeader.trim();
  }

  // Strictly reject requests with no token
  if (!token) {
    const isDev = process.env.NODE_ENV !== 'production';
    const allowDevBypass = process.env.ALLOW_DEV_AUTH_BYPASS === 'true';

    // Development bypass is ONLY allowed when explicitly opted-in via env var in non-production
    if (isDev && allowDevBypass) {
      logger.warn('[SECURITY WARNING] Dev auth bypass is explicitly enabled via ALLOW_DEV_AUTH_BYPASS=true. DO NOT USE IN PRODUCTION.');
      const requestedCompanyId = req.params.companyId || req.params.id || '';
      try {
        const defaultUser = await authRepository.getAuthorizationContext(1, requestedCompanyId);
        req.user = defaultUser;
        return next();
      } catch {
        return res.status(401).json({ error: 'Authentication required. Missing token.', code: 'UNAUTHORIZED' });
      }
    }

    return res.status(401).json({
      error: 'Authentication required. Please provide a valid Bearer token or x-session-token header.',
      code: 'UNAUTHORIZED'
    });
  }

  try {
    // 1. Check custom GulfHive session token (format: "sess_<userId>_<timestamp>:<secret>")
    if (token.startsWith('sess_') && token.includes(':')) {
      const authCtx = await authRepository.verifySessionToken(token);
      if (!authCtx) {
        return res.status(401).json({ error: 'Session expired or invalid token', code: 'UNAUTHORIZED' });
      }
      req.user = authCtx;
      return next();
    }

    // 2. Check Firebase ID Token
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      let authCtx = await authRepository.getAuthorizationContextByUidOrEmail(
        decodedToken.uid,
        decodedToken.email,
        req.params.companyId || req.params.id
      );

      if (!authCtx) {
        // Construct canonical AuthenticatedPrincipal for verified Firebase user
        authCtx = {
          userId: 0,
          uid: decodedToken.uid,
          email: decodedToken.email || decodedToken.uid,
          displayName: decodedToken.name || null,
          activeCompanyId: req.params.companyId || req.params.id || '',
          activeBranchId: null,
          roles: ['VIEWER'],
          permissions: [],
          dataScopes: {},
          authorizedCompanyIds: req.params.companyId ? [req.params.companyId] : [],
          authorizedBranchIds: [],
        };
      }

      req.user = authCtx;
      return next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired authentication token', code: 'UNAUTHORIZED' });
    }
  } catch (error) {
    logger.error('Authentication verification error:', error);
    return res.status(401).json({ error: 'Invalid authentication token', code: 'UNAUTHORIZED' });
  }
}

/**
 * RBAC Permission Guard: Verifies specific required permission code server-side.
 */
export function requirePermission(permissionCode: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
    }

    const companyId = req.params.companyId || req.params.id || req.body.companyId || req.user.activeCompanyId;
    const isAllowed = authRepository.can(req.user, permissionCode, companyId);

    if (!isAllowed) {
      logger.warn(`Access Denied: User #${req.user.userId} (${req.user.email}) attempted to access '${permissionCode}' on company '${companyId}'`);
      return res.status(403).json({
        error: `Access Denied: Missing required permission '${permissionCode}'`,
        code: 'FORBIDDEN',
        requiredPermission: permissionCode,
      });
    }

    next();
  };
}

/**
 * Multi-Company Isolation Guard: Prevents cross-company data leakage.
 */
export function requireCompanyAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
  }

  const requestedCompanyId = req.params.companyId || req.params.id || req.body.companyId;
  if (!requestedCompanyId) return next();

  if (
    !req.user.roles.includes('SUPER_ADMIN') &&
    !req.user.authorizedCompanyIds.includes(requestedCompanyId)
  ) {
    logger.warn(`Company Isolation Violation: User #${req.user.userId} attempted unauthorized access to company '${requestedCompanyId}'`);
    return res.status(403).json({
      error: 'Access Denied: You do not have permission to access data for this company',
      code: 'COMPANY_ISOLATION_VIOLATION',
      requestedCompanyId,
    });
  }

  next();
}

/**
 * Sensitive Data Permissions & Server-Side Redaction Helpers
 */
export function canViewSalary(user?: AuthContext, companyId?: string): boolean {
  if (!user) return false;
  return authRepository.can(user, 'people.salary.view', companyId) || authRepository.can(user, 'Employee.Salary.View', companyId);
}

export function canViewBank(user?: AuthContext, companyId?: string): boolean {
  if (!user) return false;
  return authRepository.can(user, 'people.bank.view', companyId) || authRepository.can(user, 'Employee.Bank.View', companyId);
}

export function canViewIdentity(user?: AuthContext, companyId?: string): boolean {
  if (!user) return false;
  return authRepository.can(user, 'people.identity.view', companyId) || authRepository.can(user, 'Employee.Identity.View', companyId);
}

export function canViewSensitiveDocs(user?: AuthContext, companyId?: string): boolean {
  if (!user) return false;
  return authRepository.can(user, 'people.document.view_sensitive', companyId) || authRepository.can(user, 'Employee.Document.ViewSensitive', companyId);
}

/**
 * Server-Side Employee Sanitization:
 * Strips confidential financial and identity values from employee records if the caller lacks permission.
 * Never relies on client-provided headers for privacy enforcement.
 */
export function sanitizeEmployeeRecord<T extends Record<string, any>>(
  employee: T,
  user?: AuthContext,
  companyId?: string
): T {
  if (!employee) return employee;

  const hasSalaryPerm = canViewSalary(user, companyId);
  const hasBankPerm = canViewBank(user, companyId);
  const hasIdentityPerm = canViewIdentity(user, companyId);

  const sanitized: Record<string, any> = { ...employee };

  // 1. Redact salary information
  if (!hasSalaryPerm) {
    if ('salaries' in sanitized) sanitized.salaries = [];
    if ('salary' in sanitized) sanitized.salary = null;
    if ('baseSalary' in sanitized) sanitized.baseSalary = null;
    if ('basicSalary' in sanitized) sanitized.basicSalary = null;
    if ('salaryAmount' in sanitized) sanitized.salaryAmount = null;
    if ('totalSalary' in sanitized) sanitized.totalSalary = null;
    if ('housingAllowance' in sanitized) sanitized.housingAllowance = null;
    if ('transportAllowance' in sanitized) sanitized.transportAllowance = null;
    if ('foodAllowance' in sanitized) sanitized.foodAllowance = null;
    if ('otherAllowances' in sanitized) sanitized.otherAllowances = null;
  }

  // 2. Redact bank information
  if (!hasBankPerm) {
    if ('bankDetails' in sanitized) sanitized.bankDetails = null;
    if ('bankAccounts' in sanitized) sanitized.bankAccounts = [];
    if ('iban' in sanitized) sanitized.iban = null;
    if ('bankName' in sanitized) sanitized.bankName = null;
    if ('bankAccountNumber' in sanitized) sanitized.bankAccountNumber = null;
    if ('bankSwift' in sanitized) sanitized.bankSwift = null;
  }

  // 3. Mask sensitive national identity identifiers if not authorized
  if (!hasIdentityPerm) {
    if (sanitized.civilIdNumber && typeof sanitized.civilIdNumber === 'string') {
      const len = sanitized.civilIdNumber.length;
      sanitized.civilIdNumber = len > 4 ? `******${sanitized.civilIdNumber.slice(-4)}` : '******';
    }
    if (sanitized.passportNumber && typeof sanitized.passportNumber === 'string') {
      const len = sanitized.passportNumber.length;
      sanitized.passportNumber = len > 4 ? `******${sanitized.passportNumber.slice(-4)}` : '******';
    }
  }

  return sanitized as T;
}
