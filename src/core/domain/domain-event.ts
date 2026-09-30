/**
 * GulfHive ERP - Domain Event Definition
 * Base contract for domain events emitted across bounded contexts.
 */

export interface DomainEvent {
  readonly eventId: string;
  readonly eventName: string;
  readonly aggregateId: string;
  readonly tenantId?: string;
  readonly occurredAt: Date;
  readonly payload: Record<string, unknown>;
  readonly version: number;
}
