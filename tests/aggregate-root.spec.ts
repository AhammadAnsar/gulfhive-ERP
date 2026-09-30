import { describe, it, expect } from 'vitest';
import { AggregateRoot } from '../src/core/domain/aggregate-root.ts';
import { DomainEvent } from '../src/core/domain/domain-event.ts';

class TestAggregate extends AggregateRoot<string> {
  constructor(id: string) {
    super(id);
  }

  public performAction(value: string): void {
    const event: DomainEvent = {
      eventId: 'evt-123',
      eventName: 'ActionExecuted',
      aggregateId: this.id,
      occurredAt: new Date(),
      payload: { value },
      version: 1,
    };
    this.addDomainEvent(event);
  }
}

describe('Domain Entities & Aggregate Root', () => {
  it('should evaluate equality based on identity', () => {
    const a1 = new TestAggregate('agg-001');
    const a2 = new TestAggregate('agg-001');
    const a3 = new TestAggregate('agg-002');

    expect(a1.equals(a2)).toBe(true);
    expect(a1.equals(a3)).toBe(false);
  });

  it('should capture and clear domain events properly', () => {
    const agg = new TestAggregate('agg-001');
    expect(agg.domainEvents.length).toBe(0);

    agg.performAction('test-data');
    expect(agg.domainEvents.length).toBe(1);
    expect(agg.domainEvents[0].eventName).toBe('ActionExecuted');

    agg.clearDomainEvents();
    expect(agg.domainEvents.length).toBe(0);
  });
});
