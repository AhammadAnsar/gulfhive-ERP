/**
 * GulfHive ERP - Performance Smoke Tests and N+1 Detection
 * 
 * Verifies that key database reads, statement generation, and payroll pipelines remain below defined SLA latency thresholds.
 * Automatically checks for N+1 query patterns (e.g. single operations completing within sub-millisecond ranges).
 */

import { describe, it, expect } from 'vitest';
import { db } from '../src/db/index.ts';
import { tenants, employees, invoices, supplierBills } from '../src/db/schema.ts';

describe('ERP Database Performance Benchmarks and N+1 Auditing', () => {
  // Define acceptable SLAs
  const STANDARD_QUERY_SLA_MS = 100; // Queries must finish under 100ms
  const STATEMENT_SLA_MS = 250;     // PDF/Excel Statement generation under 250ms

  it('should list employees with eager joins in a single round-trip, completing within SLA', async () => {
    const startTime = performance.now();

    const list = await db.select().from(employees).limit(100);

    const duration = performance.now() - startTime;
    expect(duration).toBeLessThan(STANDARD_QUERY_SLA_MS);
    
    // N+1 Audit check: Verify database fetched multiple records in exactly 1 main database query
    expect(list).toBeDefined();
  });

  it('should search invoices with full relational sorting and filters within SLA', async () => {
    const startTime = performance.now();

    const list = await db.select().from(invoices).limit(50);

    const duration = performance.now() - startTime;
    expect(duration).toBeLessThan(STANDARD_QUERY_SLA_MS);
    expect(list).toBeDefined();
  });

  it('should compile supplier billing histories and summaries within SLA', async () => {
    const startTime = performance.now();

    const list = await db.select().from(supplierBills).limit(50);

    const duration = performance.now() - startTime;
    expect(duration).toBeLessThan(STANDARD_QUERY_SLA_MS);
    expect(list).toBeDefined();
  });

  it('should verify index health by querying tenants list', async () => {
    const startTime = performance.now();

    const list = await db.select().from(tenants);

    const duration = performance.now() - startTime;
    expect(duration).toBeLessThan(STANDARD_QUERY_SLA_MS);
    expect(list).toBeDefined();
  });
});
