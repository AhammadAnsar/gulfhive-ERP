import { describe, it, expect } from 'vitest';
import { Result } from '../src/core/domain/result.ts';

describe('Result Monad (Railway-Oriented Error Handling)', () => {
  it('should create successful result and access value', () => {
    const res = Result.ok<string>('Success value');
    expect(res.isSuccess).toBe(true);
    expect(res.isFailure).toBe(false);
    expect(res.getValue()).toBe('Success value');
  });

  it('should create failed result and throw when accessing value', () => {
    const error = new Error('Operation failed');
    const res = Result.fail<string>(error);

    expect(res.isSuccess).toBe(false);
    expect(res.isFailure).toBe(true);
    expect(res.getError()).toBe(error);
    expect(() => res.getValue()).toThrowError();
  });

  it('should combine multiple results and short-circuit on first failure', () => {
    const r1 = Result.ok('one');
    const r2 = Result.fail(new Error('Second step failed'));
    const r3 = Result.ok('three');

    const combined = Result.combine([r1, r2, r3]);
    expect(combined.isFailure).toBe(true);
    expect(combined.getError().message).toBe('Second step failed');
  });
});
