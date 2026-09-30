/**
 * GulfHive ERP - In-Memory Event Bus Implementation
 * Asynchronous, decoupled domain event dispatcher with isolated error boundaries.
 */

import { IEventBus, DomainEventHandler } from '../../core/application/event-bus.ts';
import { DomainEvent } from '../../core/domain/domain-event.ts';
import { logger } from '../../core/logging/logger.ts';

export class InMemoryEventBus implements IEventBus {
  private readonly handlers: Map<string, Set<DomainEventHandler>> = new Map();

  public subscribe<T extends DomainEvent = DomainEvent>(eventName: string, handler: DomainEventHandler<T>): () => void {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set());
    }
    const handlerSet = this.handlers.get(eventName)!;
    handlerSet.add(handler as DomainEventHandler);

    // Return unsubscription function
    return () => {
      handlerSet.delete(handler as DomainEventHandler);
    };
  }

  public async publish(event: DomainEvent): Promise<void> {
    const handlerSet = this.handlers.get(event.eventName);
    logger.debug(`Dispatching event ${event.eventName}`, {
      eventId: event.eventId,
      aggregateId: event.aggregateId,
      tenantId: event.tenantId,
    });

    if (!handlerSet || handlerSet.size === 0) {
      return;
    }

    const promises: Promise<void>[] = [];
    for (const handler of handlerSet) {
      promises.push(
        (async () => {
          try {
            await handler(event);
          } catch (err) {
            logger.error(`Error executing event handler for event ${event.eventName}`, err, {
              eventId: event.eventId,
              aggregateId: event.aggregateId,
            });
            // Handlers fail independently so one failure does not halt other subscribers
          }
        })()
      );
    }

    await Promise.all(promises);
  }

  public async publishAll(events: ReadonlyArray<DomainEvent>): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  public getSubscriberCount(eventName: string): number {
    return this.handlers.get(eventName)?.size ?? 0;
  }
}

export const eventBus = new InMemoryEventBus();
