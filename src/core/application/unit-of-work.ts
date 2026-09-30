/**
 * GulfHive ERP - Unit of Work Abstraction
 * Enforces atomic transaction boundaries for database operations.
 */

export interface IUnitOfWork {
  executeInTransaction<T>(work: () => Promise<T>): Promise<T>;
}
