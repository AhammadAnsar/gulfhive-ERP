/**
 * GulfHive ERP - Phase 1 Authentication, Authorization & Security Hardening Test Suite
 * 
 * Verifies P0 Security Remediation:
 * - SEC-001: Missing-token fallback elimination & strict 401 Unauthorized
 * - SEC-002: Hardcoded fallback passwords elimination
 * - SEC-003: Default-deny middleware & API authentication matrix
 * - SEC-004: Server-side employee salary, bank, and identity sanitization
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  authenticateToken,
  requireCompanyAccess,
  requirePermission,
  sanitizeEmployeeRecord,
  canViewSalary,
  canViewBank,
  canViewIdentity,
} from '../src/core/security/auth.middleware.ts';
import { authRepository, AuthContext } from '../src/infrastructure/database/repositories/auth.repository.ts';

// Helper to create mock Express request & response
function createMockHttp(options: {
  headers?: Record<string, string>;
  params?: Record<string, string>;
  body?: Record<string, any>;
  user?: AuthContext;
}) {
  const req = {
    headers: options.headers || {},
    params: options.params || {},
    body: options.body || {},
    user: options.user,
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as Request;

  let statusCode = 200;
  let responseData: any = null;

  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: any) {
      responseData = data;
      return this;
    },
    send(data: any) {
      responseData = data;
      return this;
    },
    getStatusCode: () => statusCode,
    getResponseData: () => responseData,
  } as unknown as Response & { getStatusCode: () => number; getResponseData: () => any };

  return { req, res };
}

describe('PHASE 1: Authentication & Authorization Hardening', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  // =========================================================================
  // 1. SEC-001: Missing-Token Fallback Elimination & Strict 401
  // =========================================================================
  describe('SEC-001: Missing-Token Authentication Rejection', () => {
    it('should strictly return HTTP 401 UNAUTHORIZED when no authorization token is supplied in production mode', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOW_DEV_AUTH_BYPASS = 'false';

      const { req, res } = createMockHttp({ headers: {} });
      let nextCalled = false;
      const next: NextFunction = () => { nextCalled = true; };

      await authenticateToken(req, res, next);

      expect(nextCalled).toBe(false);
      expect(res.getStatusCode()).toBe(401);
      expect(res.getResponseData()).toEqual(
        expect.objectContaining({
          code: 'UNAUTHORIZED',
        })
      );
    });

    it('should strictly return HTTP 401 UNAUTHORIZED when in development mode if ALLOW_DEV_AUTH_BYPASS is not "true"', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.ALLOW_DEV_AUTH_BYPASS;

      const { req, res } = createMockHttp({ headers: {} });
      let nextCalled = false;
      const next: NextFunction = () => { nextCalled = true; };

      await authenticateToken(req, res, next);

      expect(nextCalled).toBe(false);
      expect(res.getStatusCode()).toBe(401);
      expect(res.getResponseData().code).toBe('UNAUTHORIZED');
    });

    it('should reject invalid or malformed bearer tokens with HTTP 401', async () => {
      const { req, res } = createMockHttp({
        headers: { authorization: 'Bearer invalid_malformed_token_12345' },
      });
      let nextCalled = false;
      const next: NextFunction = () => { nextCalled = true; };

      await authenticateToken(req, res, next);

      expect(nextCalled).toBe(false);
      expect(res.getStatusCode()).toBe(401);
      expect(res.getResponseData().code).toBe('UNAUTHORIZED');
    });
  });

  // =========================================================================
  // 2. SEC-002: Hardcoded Fallback Passwords Elimination
  // =========================================================================
  describe('SEC-002: Password Verification Security', () => {
    it('should reject passwords when stored password hash is empty, null, or malformed', () => {
      expect(authRepository.verifyPassword('Password@123', '')).toBe(false);
      expect(authRepository.verifyPassword('Admin@123', '')).toBe(false);
      expect(authRepository.verifyPassword('Password@123', 'invalidhash')).toBe(false);
      expect(authRepository.verifyPassword('', '')).toBe(false);
    });

    it('should successfully verify valid scrypt-hashed passwords', () => {
      const plainPassword = 'Secur3Enterprise#P@ssword2026';
      const hash = authRepository.hashPassword(plainPassword);

      expect(hash).toContain(':');
      expect(authRepository.verifyPassword(plainPassword, hash)).toBe(true);
      expect(authRepository.verifyPassword('WrongPassword', hash)).toBe(false);
    });
  });

  // =========================================================================
  // 3. SEC-003: Multi-Company Isolation & Role Permissions
  // =========================================================================
  describe('SEC-003: Multi-Company Isolation Guard', () => {
    const regularUser: AuthContext = {
      userId: 10,
      uid: 'usr_reg_10',
      email: 'user@company-a.com',
      displayName: 'Company A User',
      activeCompanyId: 'tenant_company_a',
      activeBranchId: 'branch_main',
      roles: ['VIEWER'],
      permissions: ['people.view'],
      dataScopes: {},
      authorizedCompanyIds: ['tenant_company_a'],
      authorizedBranchIds: ['branch_main'],
    };

    const superAdminUser: AuthContext = {
      userId: 1,
      uid: 'usr_super_1',
      email: 'superadmin@gulfhive.internal',
      displayName: 'Super Admin',
      activeCompanyId: 'tenant_company_a',
      activeBranchId: null,
      roles: ['SUPER_ADMIN'],
      permissions: ['*'],
      dataScopes: {},
      authorizedCompanyIds: ['tenant_company_a'],
      authorizedBranchIds: [],
    };

    it('should allow access when user is authorized for the requested company', () => {
      const { req, res } = createMockHttp({
        params: { companyId: 'tenant_company_a' },
        user: regularUser,
      });
      let nextCalled = false;
      const next: NextFunction = () => { nextCalled = true; };

      requireCompanyAccess(req, res, next);
      expect(nextCalled).toBe(true);
      expect(res.getStatusCode()).toBe(200);
    });

    it('should reject access with HTTP 403 COMPANY_ISOLATION_VIOLATION when user attempts cross-company access', () => {
      const { req, res } = createMockHttp({
        params: { companyId: 'tenant_company_b' },
        user: regularUser,
      });
      let nextCalled = false;
      const next: NextFunction = () => { nextCalled = true; };

      requireCompanyAccess(req, res, next);
      expect(nextCalled).toBe(false);
      expect(res.getStatusCode()).toBe(403);
      expect(res.getResponseData().code).toBe('COMPANY_ISOLATION_VIOLATION');
    });

    it('should allow SUPER_ADMIN to access any company', () => {
      const { req, res } = createMockHttp({
        params: { companyId: 'tenant_company_b' },
        user: superAdminUser,
      });
      let nextCalled = false;
      const next: NextFunction = () => { nextCalled = true; };

      requireCompanyAccess(req, res, next);
      expect(nextCalled).toBe(true);
    });
  });

  describe('SEC-003: RBAC Permission Guard & Permission Aliases', () => {
    const hrUser: AuthContext = {
      userId: 20,
      uid: 'usr_hr_20',
      email: 'hr@gulfhive.internal',
      displayName: 'HR Specialist',
      activeCompanyId: 'tenant_co_1',
      activeBranchId: null,
      roles: ['HR_SPECIALIST'],
      permissions: ['people.view', 'people.salary.view'],
      dataScopes: {},
      authorizedCompanyIds: ['tenant_co_1'],
      authorizedBranchIds: [],
    };

    it('should evaluate permission checks correctly with dot-notation and uppercase aliases', () => {
      expect(authRepository.can(hrUser, 'people.view', 'tenant_co_1')).toBe(true);
      expect(authRepository.can(hrUser, 'Employee.View', 'tenant_co_1')).toBe(true);
      expect(authRepository.can(hrUser, 'people.salary.view', 'tenant_co_1')).toBe(true);
      expect(authRepository.can(hrUser, 'Employee.Salary.View', 'tenant_co_1')).toBe(true);
      expect(authRepository.can(hrUser, 'finance.post', 'tenant_co_1')).toBe(false);
    });

    it('should guard routes and reject unauthorized requests with HTTP 403 FORBIDDEN', () => {
      const guard = requirePermission('finance.post');
      const { req, res } = createMockHttp({
        params: { companyId: 'tenant_co_1' },
        user: hrUser,
      });
      let nextCalled = false;
      const next: NextFunction = () => { nextCalled = true; };

      guard(req, res, next);
      expect(nextCalled).toBe(false);
      expect(res.getStatusCode()).toBe(403);
      expect(res.getResponseData().code).toBe('FORBIDDEN');
      expect(res.getResponseData().requiredPermission).toBe('finance.post');
    });

    it('should grant access to authorized users', () => {
      const guard = requirePermission('people.salary.view');
      const { req, res } = createMockHttp({
        params: { companyId: 'tenant_co_1' },
        user: hrUser,
      });
      let nextCalled = false;
      const next: NextFunction = () => { nextCalled = true; };

      guard(req, res, next);
      expect(nextCalled).toBe(true);
    });
  });

  // =========================================================================
  // 4. SEC-004: Server-Side Employee Data Sanitization (Salary, Bank, Identity)
  // =========================================================================
  describe('SEC-004: Server-Side Sensitive Field Protection', () => {
    const rawEmployee = {
      id: 'emp_101',
      tenantId: 'tenant_co_1',
      employeeNumber: 'EMP-001',
      firstNameEn: 'Tariq',
      lastNameEn: 'Al-Mansoor',
      civilIdNumber: '290101509988',
      passportNumber: 'K987654321',
      basicSalary: '1850.000',
      housingAllowance: '350.000',
      transportAllowance: '150.000',
      totalSalary: '2350.000',
      salaries: [
        { id: 1, effectiveDate: '2026-01-01', basicSalary: '1850.000', currency: 'KWD' },
      ],
      bankDetails: {
        bankName: 'National Bank of Kuwait',
        iban: 'KW82NBOK0000000000000123456789',
        accountNumber: '00000123456789',
        swiftBic: 'NBOKKWKW',
      },
      bankAccounts: [
        { id: 1, bankName: 'NBK', iban: 'KW82NBOK0000000000000123456789' },
      ],
    };

    it('should sanitize salary, bank, and identity fields when caller lacks sensitive permissions', () => {
      const standardViewer: AuthContext = {
        userId: 50,
        uid: 'usr_view_50',
        email: 'viewer@gulfhive.internal',
        displayName: 'Standard Viewer',
        activeCompanyId: 'tenant_co_1',
        activeBranchId: null,
        roles: ['VIEWER'],
        permissions: ['people.view'],
        dataScopes: {},
        authorizedCompanyIds: ['tenant_co_1'],
        authorizedBranchIds: [],
      };

      expect(canViewSalary(standardViewer, 'tenant_co_1')).toBe(false);
      expect(canViewBank(standardViewer, 'tenant_co_1')).toBe(false);
      expect(canViewIdentity(standardViewer, 'tenant_co_1')).toBe(false);

      const sanitized = sanitizeEmployeeRecord(rawEmployee, standardViewer, 'tenant_co_1');

      // Salary fields must be stripped
      expect(sanitized.salaries).toEqual([]);
      expect(sanitized.basicSalary).toBeNull();
      expect(sanitized.housingAllowance).toBeNull();
      expect(sanitized.transportAllowance).toBeNull();
      expect(sanitized.totalSalary).toBeNull();

      // Bank details must be stripped
      expect(sanitized.bankDetails).toBeNull();
      expect(sanitized.bankAccounts).toEqual([]);

      // Identity numbers must be masked server-side
      expect(sanitized.civilIdNumber).toBe('******9988');
      expect(sanitized.passportNumber).toBe('******4321');

      // Non-sensitive fields must remain intact
      expect(sanitized.id).toBe('emp_101');
      expect(sanitized.employeeNumber).toBe('EMP-001');
      expect(sanitized.firstNameEn).toBe('Tariq');
    });

    it('should retain full salary details for users with Employee.Salary.View permission', () => {
      const payrollOfficer: AuthContext = {
        userId: 60,
        uid: 'usr_pay_60',
        email: 'payroll@gulfhive.internal',
        displayName: 'Payroll Officer',
        activeCompanyId: 'tenant_co_1',
        activeBranchId: null,
        roles: ['PAYROLL_OFFICER'],
        permissions: ['people.view', 'people.salary.view', 'people.bank.view'],
        dataScopes: {},
        authorizedCompanyIds: ['tenant_co_1'],
        authorizedBranchIds: [],
      };

      const sanitized = sanitizeEmployeeRecord(rawEmployee, payrollOfficer, 'tenant_co_1');

      expect(sanitized.basicSalary).toBe('1850.000');
      expect(sanitized.totalSalary).toBe('2350.000');
      expect(sanitized.salaries).toHaveLength(1);
      expect(sanitized.bankDetails?.bankName).toBe('National Bank of Kuwait');
      expect(sanitized.bankAccounts).toHaveLength(1);
    });

    it('should retain full information for COMPANY_ADMIN', () => {
      const companyAdmin: AuthContext = {
        userId: 2,
        uid: 'usr_admin_2',
        email: 'admin@company.com',
        displayName: 'Company Admin',
        activeCompanyId: 'tenant_co_1',
        activeBranchId: null,
        roles: ['COMPANY_ADMIN'],
        permissions: ['*'],
        dataScopes: {},
        authorizedCompanyIds: ['tenant_co_1'],
        authorizedBranchIds: [],
      };

      const sanitized = sanitizeEmployeeRecord(rawEmployee, companyAdmin, 'tenant_co_1');

      expect(sanitized.basicSalary).toBe('1850.000');
      expect(sanitized.bankDetails?.iban).toBe('KW82NBOK0000000000000123456789');
      expect(sanitized.civilIdNumber).toBe('290101509988');
      expect(sanitized.passportNumber).toBe('K987654321');
    });
  });
});
