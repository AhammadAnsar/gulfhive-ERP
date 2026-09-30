import { describe, it, expect } from 'vitest';
import { InMemoryEventBus } from '../src/infrastructure/events/in-memory-event-bus.ts';
import { DomainEvent } from '../src/core/domain/domain-event.ts';

describe('In-Memory Event Bus', () => {
  it('should deliver events to subscribed handlers', async () => {
    const bus = new InMemoryEventBus();
    const received: string[] = [];

    const unsubscribe = bus.subscribe('OrderPlaced', (event) => {
      received.push(event.payload.orderId as string);
    });

    const event: DomainEvent = {
      eventId: 'evt-1',
      eventName: 'OrderPlaced',
      aggregateId: 'ord-101',
      occurredAt: new Date(),
      payload: { orderId: 'ord-101' },
      version: 1,
    };

    await bus.publish(event);
    expect(received).toEqual(['ord-101']);

    unsubscribe();
    await bus.publish(event);
    expect(received).toEqual(['ord-101']); // No extra invocation after unsubscribe
  });

  it('should isolate handler errors so other handlers still execute', async () => {
    const bus = new InMemoryEventBus();
    let handler2Ran = false;

    bus.subscribe('UserRegistered', () => {
      throw new Error('Failing handler 1');
    });

    bus.subscribe('UserRegistered', () => {
      handler2Ran = true;
    });

    const event: DomainEvent = {
      eventId: 'evt-2',
      eventName: 'UserRegistered',
      aggregateId: 'usr-1',
      occurredAt: new Date(),
      payload: {},
      version: 1,
    };

    await bus.publish(event);
    expect(handler2Ran).toBe(true);
  });
});
