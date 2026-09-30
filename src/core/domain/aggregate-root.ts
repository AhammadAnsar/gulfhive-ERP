/**
 * GulfHive ERP - Aggregate Root
 * Encapsulates domain invariants and manages domain events.
 */

import { Entity } from './entity.ts';
import { DomainEvent } from './domain-event.ts';

export abstract class AggregateRoot<TId> extends Entity<TId> {
  private _domainEvents: DomainEvent[] = [];

  public get domainEvents(): ReadonlyArray<DomainEvent> {
    return [...this._domainEvents];
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  public clearDomainEvents(): void {
    this._domainEvents = [];
  }
}
