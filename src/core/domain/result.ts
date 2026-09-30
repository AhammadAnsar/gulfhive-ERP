/**
 * GulfHive ERP - Core Domain Foundation
 * Railway-Oriented Result Monad for predictable, exception-free error handling.
 */

export class Result<T, E = Error> {
  private readonly _isSuccess: boolean;
  private readonly _value?: T;
  private readonly _error?: E;

  private constructor(isSuccess: boolean, value?: T, error?: E) {
    this._isSuccess = isSuccess;
    this._value = value;
    this._error = error;
  }

  public get isSuccess(): boolean {
    return this._isSuccess;
  }

  public get isFailure(): boolean {
    return !this._isSuccess;
  }

  public getValue(): T {
    if (!this._isSuccess) {
      throw new Error(`Cannot retrieve value from a failed Result: ${JSON.stringify(this._error)}`);
    }
    return this._value as T;
  }

  public getError(): E {
    if (this._isSuccess) {
      throw new Error('Cannot retrieve error from a successful Result');
    }
    return this._error as E;
  }

  public static ok<U, F = Error>(value: U): Result<U, F> {
    return new Result<U, F>(true, value, undefined);
  }

  public static fail<U, F = Error>(error: F): Result<U, F> {
    return new Result<U, F>(false, undefined, error);
  }

  public static combine<F = Error>(results: Result<unknown, F>[]): Result<void, F> {
    for (const result of results) {
      if (result.isFailure) {
        return Result.fail<void, F>(result.getError());
      }
    }
    return Result.ok<void, F>(undefined);
  }
}
