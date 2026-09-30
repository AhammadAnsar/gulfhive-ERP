/**
 * GulfHive ERP - Multi-Tenant Isolation Context
 * Thread-safe request-scoped tenant isolation using Node.js AsyncLocalStorage.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContext {
  readonly tenantId: string;
  readonly companyCode: string;
  readonly countryCode: string; // ISO 3166-1 alpha-2 (KW, SA, AE, QA, BH, OM)
  readonly baseCurrency: string; // ISO 4217 (KWD, SAR, AED, QAR, BHD, OMR)
  readonly timezone: string;
  readonly requestId?: string;
}

export interface RequestContext {
  readonly userId: number;
  readonly companyId: string;
  readonly branchId?: string | null;
  readonly roles: string[];
  readonly permissions: string[];
  readonly dataScopes: Record<string, string>;
  readonly requestId: string;
}

export interface ITenantScoped {
  readonly tenantId: string;
}

const asyncLocalStorage = new AsyncLocalStorage<TenantContext>();

export class TenantContextHolder {
  /**
   * Runs an asynchronous execution tree within a thread-safe, request-scoped tenant context.
   */
  public static run<R>(context: TenantContext, callback: () => R): R {
    return asyncLocalStorage.run(context, callback);
  }

  /**
   * Retrieves current request-scoped tenant context from Node AsyncLocalStorage.
   */
  public static getContext(): TenantContext | undefined {
    return asyncLocalStorage.getStore();
  }

  /**
   * Retrieves required request-scoped tenant context, throwing if missing.
   */
  public static getRequiredContext(): TenantContext {
    const ctx = TenantContextHolder.getContext();
    if (!ctx) {
      throw new Error('Tenant context is required but not established for this execution context');
    }
    return ctx;
  }
}
