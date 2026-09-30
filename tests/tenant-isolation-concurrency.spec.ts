/**
 * GulfHive ERP - Phase 2 Tenant Isolation & Concurrency Safety Test Suite
 * 
 * Verifies:
 * - Thread-safe request-scoped AsyncLocalStorage tenant context under high async concurrency
 * - Prevention of global context leakage across interleaved async operations
 * - Hostile cross-tenant entity ID access rejection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { TenantContextHolder, TenantContext } from '../src/core/domain/tenant-context.ts';
import { requireCompanyAccess, authenticateToken } from '../src/core/security/auth.middleware.ts';
import { authRepository, AuthContext } from '../src/infrastructure/database/repositories/auth.repository.ts';
import { salesRepository } from '../src/infrastructure/database/repositories/sales.repository.ts';
import { procurementRepository } from '../src/infrastructure/database/repositories/procurement.repository.ts';
import { projectsRepository } from '../src/infrastructure/database/repositories/projects.repository.ts';

function createMockHttp(options: {
  params?: Record<string, string>;
  headers?: Record<string, string>;
  user?: AuthContext;
}) {
  const req = {
    headers: options.headers || {},
    params: options.params || {},
    body: {},
    user: options.user,
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
    getStatusCode: () => statusCode,
    getResponseData: () => responseData,
  } as unknown as Response & { getStatusCode: () => number; getResponseData: () => any };

  return { req, res };
}

describe('PHASE 2: Tenant Isolation, Concurrency & Hostile ID Safety', () => {
  // =========================================================================
  // 1. Thread-Safe AsyncLocalStorage Interleaved Concurrency Test
  // =========================================================================
  describe('AsyncLocalStorage Request-Scoped Context Isolation', () => {
    it('should maintain strict context isolation when interleaved concurrent async requests execute for Company A and Company B', async () => {
      const tenantA: TenantContext = {
        tenantId: 'tenant_company_a_1001',
        companyCode: 'COMP_A',
        countryCode: 'KW',
        baseCurrency: 'KWD',
        timezone: 'Asia/Kuwait',
        requestId: 'req_comp_a_001',
      };

      const tenantB: TenantContext = {
        tenantId: 'tenant_company_b_2002',
        companyCode: 'COMP_B',
        countryCode: 'SA',
        baseCurrency: 'SAR',
        timezone: 'Asia/Riyadh',
        requestId: 'req_comp_b_002',
      };

      const iterations = 50;

      // Simulate 50 concurrent interleaved request executions
      const tasksA = Array.from({ length: iterations }).map((_, i) => {
        return TenantContextHolder.run(tenantA, async () => {
          // Delay simulating async DB/network I/O
          await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 15)));

          const ctx = TenantContextHolder.getRequiredContext();
          expect(ctx.tenantId).toBe('tenant_company_a_1001');
          expect(ctx.companyCode).toBe('COMP_A');
          expect(ctx.requestId).toBe('req_comp_a_001');

          await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 10)));
          const reCheckCtx = TenantContextHolder.getRequiredContext();
          expect(reCheckCtx.tenantId).toBe('tenant_company_a_1001');

          return `A_${i}`;
        });
      });

      const tasksB = Array.from({ length: iterations }).map((_, i) => {
        return TenantContextHolder.run(tenantB, async () => {
          await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 15)));

          const ctx = TenantContextHolder.getRequiredContext();
          expect(ctx.tenantId).toBe('tenant_company_b_2002');
          expect(ctx.companyCode).toBe('COMP_B');
          expect(ctx.requestId).toBe('req_comp_b_002');

          await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 10)));
          const reCheckCtx = TenantContextHolder.getRequiredContext();
          expect(reCheckCtx.tenantId).toBe('tenant_company_b_2002');

          return `B_${i}`;
        });
      });

      const results = await Promise.all([...tasksA, ...tasksB]);
      expect(results).toHaveLength(iterations * 2);

      // Verify no ambient leakage outside run()
      expect(TenantContextHolder.getContext()).toBeUndefined();
    });
  });

  // =========================================================================
  // 2. Hostile ID Access Protection Tests
  // =========================================================================
  describe('Hostile Entity ID Access Rejection', () => {
    const userCompanyA: AuthContext = {
      userId: 101,
      uid: 'usr_comp_a_101',
      email: 'manager@company-a.kw',
      displayName: 'Manager Co A',
      activeCompanyId: 'tenant_company_a_1001',
      activeBranchId: 'branch_a1',
      roles: ['COMPANY_ADMIN'],
      permissions: ['*'],
      dataScopes: {},
      authorizedCompanyIds: ['tenant_company_a_1001'],
      authorizedBranchIds: ['branch_a1'],
    };

    it('should deny a Company A user attempting to access Company B endpoints via URL parameter', () => {
      const { req, res } = createMockHttp({
        params: { companyId: 'tenant_company_b_2002' },
        user: userCompanyA,
      });

      let nextCalled = false;
      const next: NextFunction = () => { nextCalled = true; };

      requireCompanyAccess(req, res, next);

      expect(nextCalled).toBe(false);
      expect(res.getStatusCode()).toBe(403);
      expect(res.getResponseData().code).toBe('COMPANY_ISOLATION_VIOLATION');
    });

    it('should reject creating direct invoice referencing a client from Company B', async () => {
      await expect(
        salesRepository.createDirectInvoice(
          'tenant_company_a_1001',
          {
            branchId: 'branch_a1',
            clientId: 999999, // Hostile Client ID belonging to another tenant or non-existent
            invoiceDate: '2026-09-30',
            dueDate: '2026-10-30',
            currency: 'KWD',
            lines: [{ description: 'Consulting', quantity: '1', unitPrice: '100.000' }],
          },
          'usr_comp_a_101'
        )
      ).rejects.toThrow(/Cross-company reference violation/);
    });

    it('should reject creating supplier bill referencing a supplier from Company B', async () => {
      await expect(
        procurementRepository.createSupplierBill(
          'tenant_company_a_1001',
          {
            branchId: 'branch_a1',
            supplierId: 888888, // Hostile Supplier ID
            supplierInvoiceNumber: 'INV-HOSTILE-001',
            billDate: '2026-09-30',
            dueDate: '2026-10-30',
            currency: 'KWD',
            subtotal: '500.000',
            grandTotal: '500.000',
            lines: [{ description: 'Raw materials', quantity: '1', unitPrice: '500.000', total: '500.000' }],
          },
          'usr_comp_a_101'
        )
      ).rejects.toThrow(/Cross-company reference violation/);
    });

    it('should reject creating project referencing a client from Company B', async () => {
      await expect(
        projectsRepository.createProject(
          'tenant_company_a_1001',
          {
            projectCode: 'PRJ-HOSTILE-01',
            nameEn: 'Hostile Project',
            nameAr: 'مشروع',
            clientId: 777777, // Hostile Client ID
            billingProfileId: 1,
            startDate: '2026-10-01',
          },
          'usr_comp_a_101'
        )
      ).rejects.toThrow(/Cross-company reference violation/);
    });
  });
});
