/**
 * GulfHive ERP - Generic Repository Abstraction
 * Decouples domain logic from Drizzle/Postgres persistence mechanisms.
 */

import { Entity } from '../../../core/domain/entity.ts';
import { Result } from '../../../core/domain/result.ts';

export interface IRepository<T extends Entity<TId>, TId> {
  findById(id: TId): Promise<Result<T | null, Error>>;
  save(entity: T): Promise<Result<void, Error>>;
  delete(id: TId): Promise<Result<void, Error>>;
}

export interface ITenantScopedRepository<T extends Entity<TId>, TId> extends IRepository<T, TId> {
  findAllByTenant(tenantId: string): Promise<Result<T[], Error>>;
  findByIdAndTenant(id: TId, tenantId: string): Promise<Result<T | null, Error>>;
}
