/**
 * GulfHive ERP - Multi-Tenant Isolation Context
 * Enforces company/tenant boundaries at domain and application levels.
 */

export interface TenantContext {
  readonly tenantId: string;
  readonly companyCode: string;
  readonly countryCode: string; // ISO 3166-1 alpha-2 (KW, SA, AE, QA, BH, OM)
  readonly baseCurrency: string; // ISO 4217 (KWD, SAR, AED, QAR, BHD, OMR)
  readonly timezone: string;
}

export interface ITenantScoped {
  readonly tenantId: string;
}

export class TenantContextHolder {
  private static _currentContext?: TenantContext;

  public static setContext(context: TenantContext): void {
    TenantContextHolder._currentContext = context;
  }

  public static getContext(): TenantContext | undefined {
    return TenantContextHolder._currentContext;
  }

  public static getRequiredContext(): TenantContext {
    if (!TenantContextHolder._currentContext) {
      throw new Error('Tenant context is required but not established for this execution context');
    }
    return TenantContextHolder._currentContext;
  }

  public static clearContext(): void {
    TenantContextHolder._currentContext = undefined;
  }
}
