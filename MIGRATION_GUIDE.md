# GulfHive ERP — Database Migration Guide

This document describes how to execute, verify, and write SQL migrations safely for GulfHive ERP.

## 1. Migration Philosophy
- Migrations are forward-only and immutable.
- A migration's code and content must never be edited once applied to production.
- Every migration must be designed to execute within a single transaction block so that failures roll back cleanly.

## 2. Executing Migrations
To execute all pending SQL migration files:
```bash
npm run verify:migrations
```
This commands runs the `MigrationRunner` which:
1. Validates that the existing migration table exists in `public.schema_migrations`.
2. Computes the SHA-256 hash of each SQL file and verifies it matches the recorded database checksum.
3. Applies new SQL migrations sequentially in alphabetical order.

## 3. Creating New Migrations
When changing the database schema:
1. Create a new SQL file under `/src/infrastructure/database/migrations/` using the sequential naming pattern: `0014_short_description.sql`.
2. Ensure all statements run inside standard transactional boundaries.
3. Verify that any table creation includes standard tenant context fields:
   ```sql
   tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id)
   ```
4. Run `npm run verify:migrations` to apply and test locally.
