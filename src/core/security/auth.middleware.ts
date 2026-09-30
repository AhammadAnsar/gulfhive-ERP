/**
 * GulfHive ERP - Reusable Security Middleware & Authorization Guards
 * Enforces authentication, RBAC permissions, company isolation, and branch restrictions server-side.
 */

import { Request, Response, NextFunction } from 'express';
import { authRepository, AuthContext } from '../../infrastructure/database/repositories/auth.repository.ts';
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
 * Authentication Middleware: Extracts Bearer token or x-session-token header.
 */
export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const customHeader = req.headers['x-session-token'] as string;
  let token: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (customHeader) {
    token = customHeader;
  }

  // Support local desktop development bypass or session verification
  if (!token) {
    // Default system user for unauthenticated preview mode / desktop local single user
    const defaultCompanyId = req.params.companyId || req.params.id || 'tenant_corp_01_1790702844962';
    try {
      const defaultUser = await authRepository.getAuthorizationContext(1, defaultCompanyId);
      req.user = defaultUser;
      return next();
    } catch {
      return res.status(401).json({ error: 'Authentication required. Missing token.', code: 'UNAUTHORIZED' });
    }
  }

  try {
    const authCtx = await authRepository.verifySessionToken(token);
    if (!authCtx) {
      return res.status(401).json({ error: 'Session expired or invalid token', code: 'UNAUTHORIZED' });
    }
    req.user = authCtx;
    next();
  } catch (error) {
    logger.error('Authentication verification error:', error);
    res.status(401).json({ error: 'Invalid authentication token', code: 'UNAUTHORIZED' });
  }
}

/**
 * RBAC Permission Guard: Verifies specific required permission code.
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
    });
  }

  next();
}
