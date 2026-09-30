/**
 * GulfHive ERP - Event Bus Abstraction
 * Asynchronous & decoupled domain event dispatching across bounded contexts.
 */

import { DomainEvent } from '../domain/domain-event.ts';

export type DomainEventHandler<T extends DomainEvent = DomainEvent> = (event: T) => Promise<void> | void;

export interface IEventBus {
  publish(event: DomainEvent): Promise<void>;
  publishAll(events: ReadonlyArray<DomainEvent>): Promise<void>;
  subscribe<T extends DomainEvent = DomainEvent>(eventName: string, handler: DomainEventHandler<T>): () => void;
}
