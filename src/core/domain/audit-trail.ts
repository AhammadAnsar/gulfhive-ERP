/**
 * GulfHive ERP - Audit Trail Domain Model
 * Tracks all state transitions, financial operations, and statutory compliance changes.
 */

export type AuditAction = 
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'APPROVE'
  | 'REJECT'
  | 'ARCHIVE'
  | 'REVERSE'
  | 'POST_LEDGER'
  | 'CALCULATE_PAYROLL'
  | 'EXPORT_WPS';

export interface AuditActor {
  readonly uid: string;
  readonly email: string;
  readonly role: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

export interface AuditRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly actor: AuditActor;
  readonly action: AuditAction;
  readonly entityType: string;
  readonly entityId: string;
  readonly timestamp: Date;
  readonly previousState?: Record<string, unknown> | null;
  readonly resultingState?: Record<string, unknown> | null;
  readonly metadata?: Record<string, unknown>;
}
