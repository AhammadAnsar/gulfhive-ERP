/**
 * GulfHive ERP - Application Layer Use Case Contract
 * Encapsulates single business transaction / workflow with clear inputs and outputs.
 */

import { Result } from '../domain/result.ts';

export interface IUseCase<TInput, TOutput> {
  execute(input: TInput): Promise<Result<TOutput, Error>>;
}
