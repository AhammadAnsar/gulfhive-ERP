/**
 * GulfHive ERP - Branch Entity
 * Represents physical or operational sites under a parent company.
 */

import { Entity } from './entity.ts';
import { Result } from './result.ts';

export interface BranchProps {
  tenantId: string;
  code: string;
  nameEn: string;
  nameAr: string;
  isMain: boolean;
  cityEn?: string;
  cityAr?: string;
  addressEn?: string;
  addressAr?: string;
  phone?: string;
  isActive: boolean;
}

export class Branch extends Entity<string> {
  private _props: BranchProps;

  private constructor(id: string, props: BranchProps, createdAt?: Date, updatedAt?: Date) {
    super(id, createdAt, updatedAt);
    this._props = props;
  }

  public get tenantId(): string { return this._props.tenantId; }
  public get code(): string { return this._props.code; }
  public get nameEn(): string { return this._props.nameEn; }
  public get nameAr(): string { return this._props.nameAr; }
  public get isMain(): boolean { return this._props.isMain; }
  public get cityEn(): string | undefined { return this._props.cityEn; }
  public get cityAr(): string | undefined { return this._props.cityAr; }
  public get addressEn(): string | undefined { return this._props.addressEn; }
  public get addressAr(): string | undefined { return this._props.addressAr; }
  public get phone(): string | undefined { return this._props.phone; }
  public get isActive(): boolean { return this._props.isActive; }

  public static create(id: string, props: BranchProps, createdAt?: Date, updatedAt?: Date): Result<Branch> {
    if (!props.tenantId) {
      return Result.fail(new Error('Tenant ID is required for a branch'));
    }
    if (!props.code || props.code.trim().length === 0) {
      return Result.fail(new Error('Branch code is required'));
    }
    if (!props.nameEn || props.nameEn.trim().length === 0) {
      return Result.fail(new Error('English branch name is required'));
    }
    if (!props.nameAr || props.nameAr.trim().length === 0) {
      return Result.fail(new Error('Arabic branch name is required'));
    }

    const branch = new Branch(
      id,
      {
        ...props,
        code: props.code.toUpperCase().trim(),
      },
      createdAt,
      updatedAt
    );

    return Result.ok(branch);
  }
}
