import { relations } from 'drizzle-orm';
import { boolean, integer, jsonb, numeric, pgTable, primaryKey, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';

/**
 * 1. Tenants / Companies Table
 * Authoritative record for GCC legal entities with Commercial Registration and Tax Identification.
 */
export const tenants = pgTable('tenants', {
  id: varchar('id', { length: 64 }).primaryKey(),
  code: varchar('code', { length: 32 }).notNull().unique(),
  legalNameEn: text('legal_name_en').notNull(),
  legalNameAr: text('legal_name_ar').notNull(),
  tradeNameEn: text('trade_name_en'),
  tradeNameAr: text('trade_name_ar'),
  countryCode: varchar('country_code', { length: 2 }).notNull(), // KW, SA, AE, QA, BH, OM
  baseCurrency: varchar('base_currency', { length: 3 }).notNull(), // KWD, SAR, AED, QAR, BHD, OMR
  crNumber: text('cr_number'), // Commercial Registration Number (السجل التجاري)
  taxNumber: text('tax_number'), // Tax / VAT Identification Number (الرقم الضريبي)
  fiscalYearStartMonth: integer('fiscal_year_start_month').notNull().default(1), // 1 = January
  timezone: varchar('timezone', { length: 64 }).notNull().default('Asia/Kuwait'),
  phone: varchar('phone', { length: 32 }),
  email: text('email'),
  website: text('website'),
  addressEn: text('address_en'),
  addressAr: text('address_ar'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 2. Branches / Cost Centers Table
 * Physical or operational locations under a company.
 */
export const branches = pgTable('branches', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 32 }).notNull(),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  isMain: boolean('is_main').notNull().default(false),
  cityEn: text('city_en'),
  cityAr: text('city_ar'),
  addressEn: text('address_en'),
  addressAr: text('address_ar'),
  phone: varchar('phone', { length: 32 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 3. Roles Table (RBAC)
 * System-wide or tenant-specific functional roles.
 */
export const roles = pgTable('roles', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).references(() => tenants.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 64 }).notNull(),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  descriptionEn: text('description_en'),
  descriptionAr: text('description_ar'),
  isSystemRole: boolean('is_system_role').notNull().default(false),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text('updated_by'),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  archivedBy: text('archived_by'),
});

/**
 * 4. Permissions Table
 * Granular business operations permissions.
 */
export const permissions = pgTable('permissions', {
  id: varchar('id', { length: 64 }).primaryKey(),
  code: varchar('code', { length: 64 }).notNull().unique(),
  module: varchar('module', { length: 32 }).notNull(),
  resource: varchar('resource', { length: 32 }),
  action: varchar('action', { length: 32 }).notNull(),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  descriptionEn: text('description_en'),
  descriptionAr: text('description_ar'),
});

/**
 * 5. Role Permissions Junction Table
 */
export const rolePermissions = pgTable('role_permissions', {
  roleId: varchar('role_id', { length: 64 }).notNull().references(() => roles.id, { onDelete: 'cascade' }),
  permissionId: varchar('permission_id', { length: 64 }).notNull().references(() => permissions.id, { onDelete: 'cascade' }),
}, (t) => ({
  pk: primaryKey({ columns: [t.roleId, t.permissionId] }),
}));

/**
 * 6. Users Table
 * Immutable database numeric integer ID primary key.
 */
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  username: varchar('username', { length: 64 }),
  email: text('email').notNull(),
  phone: varchar('phone', { length: 32 }),
  passwordHash: text('password_hash'),
  displayName: text('display_name'),
  role: varchar('role', { length: 32 }).notNull().default('VIEWER'),
  tenantId: varchar('tenant_id', { length: 64 }).references(() => tenants.id, { onDelete: 'set null' }),
  defaultBranchId: varchar('default_branch_id', { length: 64 }).references(() => branches.id, { onDelete: 'set null' }),
  employeeId: varchar('employee_id', { length: 64 }),
  preferredLanguage: varchar('preferred_language', { length: 2 }).notNull().default('en'),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  lastPasswordChangedAt: timestamp('last_password_changed_at', { withTimezone: true }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text('updated_by'),
  disabledAt: timestamp('disabled_at', { withTimezone: true }),
  disabledBy: text('disabled_by'),
});

/**
 * 7. User Roles Table
 */
export const userRoles = pgTable('user_roles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  roleId: varchar('role_id', { length: 64 }).notNull().references(() => roles.id, { onDelete: 'cascade' }),
  tenantId: varchar('tenant_id', { length: 64 }).references(() => tenants.id, { onDelete: 'cascade' }),
});

/**
 * 8. User Company Access Table
 */
export const userCompanyAccess = pgTable('user_company_access', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  companyId: varchar('company_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  isDefault: boolean('is_default').notNull().default(false),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
});

/**
 * 9. User Branch Access Table
 */
export const userBranchAccess = pgTable('user_branch_access', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  companyId: varchar('company_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  branchId: varchar('branch_id', { length: 64 }).notNull().references(() => branches.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
});

/**
 * 10. User Data Scopes Table
 */
export const userDataScopes = pgTable('user_data_scopes', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  companyId: varchar('company_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  module: varchar('module', { length: 32 }).notNull(),
  scope: varchar('scope', { length: 32 }).notNull().default('COMPANY'), // 'OWN', 'ASSIGNED', 'BRANCH', 'COMPANY', 'ALL_COMPANIES'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 11. User Sessions Table
 */
export const userSessions = pgTable('user_sessions', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  deviceInfo: text('device_info'),
  ipAddress: text('ip_address'),
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 12. Login Events Table
 */
export const loginEvents = pgTable('login_events', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  username: text('username'),
  isSuccess: boolean('is_success').notNull(),
  failureReason: text('failure_reason'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Legacy User Tenants Junction Table (Multi-Company Access compatibility)
 */
export const userTenants = pgTable('user_tenants', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  roleId: varchar('role_id', { length: 64 }).references(() => roles.id, { onDelete: 'set null' }),
  defaultBranchId: varchar('default_branch_id', { length: 64 }).references(() => branches.id, { onDelete: 'set null' }),
  isDefault: boolean('is_default').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 8. Departments Table (People Module)
 * Organization structure / functional departments.
 */
export const departments = pgTable('departments', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 32 }).notNull(),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  parentDepartmentId: varchar('parent_department_id', { length: 64 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 9. Designations Table (People Module)
 * Job roles, functional positions, and seniority bands.
 */
export const designations = pgTable('designations', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  departmentId: varchar('department_id', { length: 64 }).references(() => departments.id, { onDelete: 'set null' }),
  code: varchar('code', { length: 32 }).notNull(),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  grade: varchar('grade', { length: 32 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
  * 9a. Employee Categories Table
  */
export const employeeCategories = pgTable('employee_categories', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 32 }).notNull(),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  descriptionEn: text('description_en'),
  descriptionAr: text('description_ar'),
  sortOrder: integer('sort_order').default(0),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text('updated_by'),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  archivedBy: text('archived_by'),
});

/**
  * 9b. Business Units Table
  */
export const businessUnits = pgTable('business_units', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 32 }).notNull(),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  descriptionEn: text('description_en'),
  descriptionAr: text('description_ar'),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text('updated_by'),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  archivedBy: text('archived_by'),
});

/**
  * 9c. Cost Centers Table
  */
export const costCenters = pgTable('cost_centers', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  parentCostCenterId: varchar('parent_cost_center_id', { length: 64 }),
  code: varchar('code', { length: 32 }).notNull(),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  descriptionEn: text('description_en'),
  descriptionAr: text('description_ar'),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text('updated_by'),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  archivedBy: text('archived_by'),
});

/**
  * 9d. Fiscal Years Table
  */
export const fiscalYears = pgTable('fiscal_years', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 64 }).notNull(),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  isCurrent: boolean('is_current').notNull().default(false),
  isLocked: boolean('is_locked').notNull().default(false),
  status: varchar('status', { length: 32 }).notNull().default('OPEN'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text('updated_by'),
});

/**
  * 9e. Currencies Table (Reference & Company Master Data)
  */
export const currencies = pgTable('currencies', {
  id: serial('id').primaryKey(),
  isoCode: varchar('iso_code', { length: 3 }).notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  symbol: varchar('symbol', { length: 16 }).notNull(),
  decimalPlaces: integer('decimal_places').notNull().default(2),
  roundingMode: varchar('rounding_mode', { length: 32 }).notNull().default('HALF_EVEN'),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
});

/**
  * 9f. Countries Table
  */
export const countries = pgTable('countries', {
  id: serial('id').primaryKey(),
  iso2: varchar('iso2', { length: 2 }).notNull().unique(),
  iso3: varchar('iso3', { length: 3 }).notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  phoneCode: varchar('phone_code', { length: 16 }),
  defaultCurrencyCode: varchar('default_currency_code', { length: 3 }),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
});

/**
  * 9g. Nationalities Table
  */
export const nationalities = pgTable('nationalities', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 32 }).notNull().unique(),
  countryIso2: varchar('country_iso2', { length: 2 }),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
});

/**
  * 9h. Banks Table
  */
export const banks = pgTable('banks', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).references(() => tenants.id, { onDelete: 'cascade' }),
  countryCode: varchar('country_code', { length: 2 }),
  bankCode: varchar('bank_code', { length: 32 }).notNull(),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  swiftCode: varchar('swift_code', { length: 32 }),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text('updated_by'),
});

/**
  * 9i. Payment Methods Table
  */
export const paymentMethods = pgTable('payment_methods', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 32 }).notNull(),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  paymentType: varchar('payment_type', { length: 32 }).notNull().default('BANK_TRANSFER'),
  sortOrder: integer('sort_order').default(0),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text('updated_by'),
});

/**
  * 9j. Document Types Table
  */
export const documentTypes = pgTable('document_types', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).references(() => tenants.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 32 }).notNull(),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  entityScope: varchar('entity_scope', { length: 32 }).notNull().default('EMPLOYEE'),
  requiresIssueDate: boolean('requires_issue_date').notNull().default(false),
  requiresExpiryDate: boolean('requires_expiry_date').notNull().default(true),
  requiresDocumentNumber: boolean('requires_document_number').notNull().default(true),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text('updated_by'),
});

/**
  * 9k. Document Sequences (Numbering Engine) Table
  */
export const documentSequences = pgTable('document_sequences', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  documentType: varchar('document_type', { length: 64 }).notNull(),
  prefix: varchar('prefix', { length: 32 }).notNull().default(''),
  suffix: varchar('suffix', { length: 32 }).notNull().default(''),
  separator: varchar('separator', { length: 8 }).notNull().default('-'),
  includeYear: boolean('include_year').notNull().default(true),
  includeMonth: boolean('include_month').notNull().default(false),
  paddingLength: integer('padding_length').notNull().default(5),
  nextNumber: integer('next_number').notNull().default(1),
  resetPolicy: varchar('reset_policy', { length: 32 }).notNull().default('NEVER'),
  fiscalYearId: varchar('fiscal_year_id', { length: 64 }).references(() => fiscalYears.id, { onDelete: 'set null' }),
  branchId: varchar('branch_id', { length: 64 }).references(() => branches.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text('updated_by'),
});

/**
 * 10. Employees Table (Authoritative Employee Master)
 * Single source of truth for all employment records in GulfHive.
 */
export const employees = pgTable('employees', {
  id: varchar('id', { length: 64 }).primaryKey(),
  numericId: serial('numeric_id').notNull().unique(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  branchId: varchar('branch_id', { length: 64 }).notNull().references(() => branches.id, { onDelete: 'restrict' }),
  departmentId: varchar('department_id', { length: 64 }).references(() => departments.id, { onDelete: 'set null' }),
  designationId: varchar('designation_id', { length: 64 }).references(() => designations.id, { onDelete: 'set null' }),
  employeeCategoryId: varchar('employee_category_id', { length: 64 }).references(() => employeeCategories.id, { onDelete: 'set null' }),
  businessUnitId: varchar('business_unit_id', { length: 64 }).references(() => businessUnits.id, { onDelete: 'set null' }),
  costCenterId: varchar('cost_center_id', { length: 64 }).references(() => costCenters.id, { onDelete: 'set null' }),
  nationalityId: integer('nationality_id').references(() => nationalities.id, { onDelete: 'set null' }),
  managerEmployeeId: varchar('manager_employee_id', { length: 64 }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  employeeNumber: varchar('employee_number', { length: 32 }).notNull(),
  firstNameEn: text('first_name_en').notNull(),
  middleNameEn: text('middle_name_en'),
  lastNameEn: text('last_name_en').notNull(),
  firstNameAr: text('first_name_ar').notNull(),
  middleNameAr: text('middle_name_ar'),
  lastNameAr: text('last_name_ar').notNull(),
  displayNameEn: text('display_name_en'),
  displayNameAr: text('display_name_ar'),
  gender: varchar('gender', { length: 16 }).notNull(), // MALE, FEMALE
  dateOfBirth: timestamp('date_of_birth', { withTimezone: true }),
  maritalStatus: varchar('marital_status', { length: 32 }).default('SINGLE'),
  nationality: varchar('nationality', { length: 64 }).notNull(),
  civilIdNumber: varchar('civil_id_number', { length: 32 }),
  passportNumber: varchar('passport_number', { length: 32 }),
  workEmail: text('work_email'),
  personalEmail: text('personal_email'),
  workPhone: varchar('work_phone', { length: 32 }),
  personalPhone: varchar('personal_phone', { length: 32 }),
  phone: varchar('phone', { length: 32 }),
  email: text('email').notNull(),
  addressEn: text('address_en'),
  addressAr: text('address_ar'),
  joiningDate: timestamp('joining_date', { withTimezone: true }).notNull(),
  employmentStatus: varchar('employment_status', { length: 32 }).notNull().default('ACTIVE'), // DRAFT, ACTIVE, ON_LEAVE, SUSPENDED, INACTIVE, TERMINATED, ARCHIVED
  contractType: varchar('contract_type', { length: 32 }).notNull().default('UNLIMITED'), // LIMITED, UNLIMITED, PROJECT_BASED, PART_TIME, TEMPORARY
  workLocation: text('work_location'),
  avatarUrl: text('avatar_url'),
  photoPath: text('photo_path'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text('updated_by'),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  archivedBy: text('archived_by'),
});

/**
 * 10b. Employee Assignments Table
 * Organizational position history and effective-dated transfers.
 */
export const employeeAssignments = pgTable('employee_assignments', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: varchar('employee_id', { length: 64 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  branchId: varchar('branch_id', { length: 64 }).notNull().references(() => branches.id, { onDelete: 'restrict' }),
  departmentId: varchar('department_id', { length: 64 }).references(() => departments.id, { onDelete: 'set null' }),
  designationId: varchar('designation_id', { length: 64 }).references(() => designations.id, { onDelete: 'set null' }),
  employeeCategoryId: varchar('employee_category_id', { length: 64 }).references(() => employeeCategories.id, { onDelete: 'set null' }),
  businessUnitId: varchar('business_unit_id', { length: 64 }).references(() => businessUnits.id, { onDelete: 'set null' }),
  costCenterId: varchar('cost_center_id', { length: 64 }).references(() => costCenters.id, { onDelete: 'set null' }),
  managerEmployeeId: varchar('manager_employee_id', { length: 64 }),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
  effectiveTo: timestamp('effective_to', { withTimezone: true }),
  reason: varchar('reason', { length: 64 }).notNull().default('JOINING'),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
});

/**
 * 11. Employee Contracts Table
 * Legal employment contracts, probation clauses, and terms.
 */
export const employeeContracts = pgTable('employee_contracts', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: varchar('employee_id', { length: 64 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  contractNumber: varchar('contract_number', { length: 64 }),
  contractType: varchar('contract_type', { length: 32 }).notNull().default('UNLIMITED'),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }),
  probationStartDate: timestamp('probation_start_date', { withTimezone: true }),
  probationEndDate: timestamp('probation_end_date', { withTimezone: true }),
  probationPeriodDays: integer('probation_period_days').default(90).notNull(),
  noticePeriodDays: integer('notice_period_days').default(90).notNull(),
  workingDaysPerWeek: integer('working_days_per_week').default(5),
  workingHoursPerDay: integer('working_hours_per_day').default(8),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'), // ACTIVE, CLOSED, RENEWED, TERMINATED, EXPIRED
  terms: text('terms'),
  documentAttachmentId: text('document_attachment_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text('updated_by'),
});

/**
 * 12. Employee Salaries Table
 * Baseline salary packages, allowances, and currency mappings.
 */
export const employeeSalaries = pgTable('employee_salaries', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: varchar('employee_id', { length: 64 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  currency: varchar('currency', { length: 3 }).notNull(), // KWD, SAR, AED, etc.
  basicSalary: text('basic_salary').notNull(),
  housingAllowance: text('housing_allowance').default('0.000').notNull(),
  transportAllowance: text('transport_allowance').default('0.000').notNull(),
  foodAllowance: text('food_allowance').default('0.000').notNull(),
  otherAllowances: text('other_allowances').default('0.000').notNull(),
  effectiveDate: timestamp('effective_date', { withTimezone: true }).notNull(),
  effectiveTo: timestamp('effective_to', { withTimezone: true }),
  isActive: boolean('is_active').default(true).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
});

/**
 * 13. Employee Bank Details Table
 * WPS compliance routing and IBAN account structures.
 */
export const employeeBankDetails = pgTable('employee_bank_details', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: varchar('employee_id', { length: 64 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  bankId: varchar('bank_id', { length: 64 }).references(() => banks.id, { onDelete: 'set null' }),
  bankName: text('bank_name').notNull(),
  bankCode: varchar('bank_code', { length: 32 }), // WPS / Central Bank Routing Code
  accountName: text('account_name'),
  iban: varchar('iban', { length: 64 }).notNull(),
  accountNumber: varchar('account_number', { length: 64 }).notNull(),
  swiftBic: varchar('swift_bic', { length: 32 }),
  currency: varchar('currency', { length: 3 }).default('KWD'),
  isPrimary: boolean('is_primary').default(true).notNull(),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).defaultNow(),
  effectiveTo: timestamp('effective_to', { withTimezone: true }),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
});

/**
 * 14. Employee Documents Table
 * Civil ID, Iqama, Passport, Work Permit, and Expiry tracking.
 */
export const employeeDocuments = pgTable('employee_documents', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: varchar('employee_id', { length: 64 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  documentTypeId: varchar('document_type_id', { length: 64 }).references(() => documentTypes.id, { onDelete: 'set null' }),
  documentType: varchar('document_type', { length: 64 }).notNull(), // CIVIL_ID, PASSPORT, RESIDENCY_VISA, WORK_PERMIT, DRIVER_LICENSE, CONTRACT_COPY, DIPLOMA, OTHER
  documentNumber: varchar('document_number', { length: 64 }).notNull(),
  issueDate: timestamp('issue_date', { withTimezone: true }),
  expiryDate: timestamp('expiry_date', { withTimezone: true }).notNull(),
  issuingAuthority: text('issuing_authority'),
  issuingCountry: varchar('issuing_country', { length: 2 }),
  attachmentUrl: text('attachment_url'),
  fileName: text('file_name'),
  notes: text('notes'),
  status: varchar('status', { length: 32 }).notNull().default('VALID'), // VALID, EXPIRING_SOON, EXPIRED
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text('updated_by'),
});

/**
 * 14b. Employee Emergency Contacts Table
 */
export const employeeEmergencyContacts = pgTable('employee_emergency_contacts', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: varchar('employee_id', { length: 64 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  relationship: varchar('relationship', { length: 32 }).notNull(),
  phone: varchar('phone', { length: 32 }).notNull(),
  alternatePhone: varchar('alternate_phone', { length: 32 }),
  isPrimary: boolean('is_primary').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
});

/**
 * 14c. Employee Dependents Table
 */
export const employeeDependents = pgTable('employee_dependents', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: varchar('employee_id', { length: 64 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  relationship: varchar('relationship', { length: 32 }).notNull(),
  dateOfBirth: timestamp('date_of_birth', { withTimezone: true }),
  nationalityId: integer('nationality_id').references(() => nationalities.id, { onDelete: 'set null' }),
  documentNumber: varchar('document_number', { length: 64 }),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
});

/**
 * 15. Employee History Table
 * Immutable audit logs of employee promotions, transfers, revisions, and status adjustments.
 */
export const employeeHistory = pgTable('employee_history', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: varchar('employee_id', { length: 64 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  changeType: varchar('change_type', { length: 64 }).notNull(), // JOINING, PROMOTION, TRANSFER, SALARY_REVISION, STATUS_CHANGE, CONTRACT_RENEWAL
  descriptionEn: text('description_en').notNull(),
  descriptionAr: text('description_ar').notNull(),
  previousState: jsonb('previous_state'),
  newState: jsonb('new_state'),
  effectiveDate: timestamp('effective_date', { withTimezone: true }).notNull(),
  recordedBy: text('recorded_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 16. Compliance Rules Table
 */
export const complianceRules = pgTable('compliance_rules', {
  id: varchar('id', { length: 64 }).primaryKey(),
  country: varchar('country', { length: 2 }).notNull(),
  category: varchar('category', { length: 64 }).notNull(),
  version: integer('version').notNull(),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
  effectiveTo: timestamp('effective_to', { withTimezone: true }),
  parameters: jsonb('parameters').notNull(),
  calculationMethod: text('calculation_method').notNull(),
  legalReference: text('legal_reference').notNull(),
  approvalStatus: varchar('approval_status', { length: 32 }).notNull().default('APPROVED'),
  approvedBy: text('approved_by'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 17. Audit Logs Table
 */
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).references(() => tenants.id, { onDelete: 'set null' }),
  actorId: text('actor_id').notNull(),
  actorEmail: text('actor_email'),
  action: varchar('action', { length: 64 }).notNull(),
  entityType: varchar('entity_type', { length: 64 }).notNull(),
  entityId: text('entity_id').notNull(),
  previousState: jsonb('previous_state'),
  resultingState: jsonb('resulting_state'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 18. Schema Migrations Table
 */
export const schemaMigrations = pgTable('schema_migrations', {
  version: integer('version').primaryKey(),
  name: text('name').notNull(),
  checksum: text('checksum').notNull(),
  appliedAt: timestamp('applied_at', { withTimezone: true }).defaultNow().notNull(),
  executionTimeMs: integer('execution_time_ms').notNull(),
});

/**
 * 18b. Break Policies Table (Time Module)
 */
export const breakPolicies = pgTable('break_policies', {
  id: varchar('id', { length: 64 }).primaryKey(),
  numericId: serial('numeric_id').notNull().unique(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 32 }).notNull(),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  breakType: varchar('break_type', { length: 32 }).notNull().default('UNPAID'), // PAID, UNPAID
  durationMinutes: integer('duration_minutes').notNull().default(60),
  calculationMethod: varchar('calculation_method', { length: 32 }).notNull().default('FIXED'), // FIXED, CLOCKED, AUTOMATIC_DEDUCTION
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text('updated_by'),
});

/**
 * 19. Shifts Table (Time Module)
 */
export const shifts = pgTable('shifts', {
  id: varchar('id', { length: 64 }).primaryKey(),
  numericId: serial('numeric_id'),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 32 }).notNull(), // DAY-01, NIGHT-01, SPLIT-01
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  startTime: varchar('start_time', { length: 8 }).notNull(), // '08:00' or '20:00'
  endTime: varchar('end_time', { length: 8 }).notNull(), // '16:00' or '04:00'
  crossesMidnight: boolean('crosses_midnight').notNull().default(false),
  scheduledMinutes: integer('scheduled_minutes').notNull().default(480),
  breakPolicyId: varchar('break_policy_id', { length: 64 }).references(() => breakPolicies.id, { onDelete: 'set null' }),
  breakDurationMinutes: integer('break_duration_minutes').notNull().default(60),
  gracePeriodMinutes: integer('grace_period_minutes').notNull().default(15),
  graceOutMinutes: integer('grace_out_minutes').notNull().default(15),
  earlyInPolicy: varchar('early_in_policy', { length: 32 }).notNull().default('IGNORE'),
  lateInPolicy: varchar('late_in_policy', { length: 32 }).notNull().default('DEDUCT_LATE'),
  earlyOutPolicy: varchar('early_out_policy', { length: 32 }).notNull().default('DEDUCT_EARLY'),
  isOvernight: boolean('is_overnight').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).defaultNow(),
  effectiveTo: timestamp('effective_to', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text('updated_by'),
});

/**
 * 19b. Work Schedules Table (Time Module)
 */
export const workSchedules = pgTable('work_schedules', {
  id: varchar('id', { length: 64 }).primaryKey(),
  numericId: serial('numeric_id').notNull().unique(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 32 }).notNull(),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  scheduleType: varchar('schedule_type', { length: 32 }).notNull().default('REGULAR'), // REGULAR, FLEXIBLE, ROTATING, RAMADAN_OVERRIDE
  weeklyHours: numeric('weekly_hours', { precision: 5, scale: 2 }).default('40.00'),
  defaultShiftId: varchar('default_shift_id', { length: 64 }).references(() => shifts.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).defaultNow().notNull(),
  effectiveTo: timestamp('effective_to', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text('updated_by'),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  archivedBy: text('archived_by'),
});

/**
 * 19c. Shift Patterns Table (Time Module)
 */
export const shiftPatterns = pgTable('shift_patterns', {
  id: varchar('id', { length: 64 }).primaryKey(),
  numericId: serial('numeric_id').notNull().unique(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 32 }).notNull(),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  cycleLengthDays: integer('cycle_length_days').notNull().default(7),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text('updated_by'),
});

/**
 * 19d. Shift Pattern Days Table (Time Module)
 */
export const shiftPatternDays = pgTable('shift_pattern_days', {
  id: serial('id').primaryKey(),
  patternId: varchar('pattern_id', { length: 64 }).notNull().references(() => shiftPatterns.id, { onDelete: 'cascade' }),
  sequenceDay: integer('sequence_day').notNull(), // 1 to cycle_length_days
  shiftId: varchar('shift_id', { length: 64 }).references(() => shifts.id, { onDelete: 'set null' }),
  isRestDay: boolean('is_rest_day').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 19e. Employee Schedule Assignments Table (Time Module)
 */
export const employeeScheduleAssignments = pgTable('employee_schedule_assignments', {
  id: varchar('id', { length: 64 }).primaryKey(),
  numericId: serial('numeric_id').notNull().unique(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: varchar('employee_id', { length: 64 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  workScheduleId: varchar('work_schedule_id', { length: 64 }).references(() => workSchedules.id, { onDelete: 'set null' }),
  shiftPatternId: varchar('shift_pattern_id', { length: 64 }).references(() => shiftPatterns.id, { onDelete: 'set null' }),
  defaultShiftId: varchar('default_shift_id', { length: 64 }).references(() => shifts.id, { onDelete: 'set null' }),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).defaultNow().notNull(),
  effectiveTo: timestamp('effective_to', { withTimezone: true }),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
});

/**
 * 19f. Schedule Overrides Table (Time Module: Ramadan / Seasonal)
 */
export const scheduleOverrides = pgTable('schedule_overrides', {
  id: varchar('id', { length: 64 }).primaryKey(),
  numericId: serial('numeric_id').notNull().unique(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 32 }).notNull(),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  overrideType: varchar('override_type', { length: 32 }).notNull().default('RAMADAN'), // RAMADAN, SEASONAL, CLIENT_SPECIFIC, EMERGENCY
  effectiveFrom: varchar('effective_from', { length: 10 }).notNull(), // YYYY-MM-DD
  effectiveTo: varchar('effective_to', { length: 10 }).notNull(), // YYYY-MM-DD
  dailyHoursReductionMinutes: integer('daily_hours_reduction_minutes').notNull().default(120),
  targetShiftId: varchar('target_shift_id', { length: 64 }).references(() => shifts.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
});

/**
 * 20. Authoritative Roster Entries Table (Time Module)
 */
export const rosterEntries = pgTable('roster_entries', {
  id: varchar('id', { length: 64 }).primaryKey(),
  numericId: serial('numeric_id').notNull().unique(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: varchar('employee_id', { length: 64 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  workDate: varchar('work_date', { length: 10 }).notNull(), // YYYY-MM-DD
  shiftId: varchar('shift_id', { length: 64 }).notNull().references(() => shifts.id, { onDelete: 'restrict' }),
  branchId: varchar('branch_id', { length: 64 }).references(() => branches.id, { onDelete: 'set null' }),
  projectId: varchar('project_id', { length: 64 }),
  siteId: varchar('site_id', { length: 64 }),
  clientId: varchar('client_id', { length: 64 }),
  status: varchar('status', { length: 32 }).notNull().default('DRAFT'), // DRAFT, PUBLISHED, CHANGED, CANCELLED
  source: varchar('source', { length: 32 }).notNull().default('MANUAL'), // MANUAL, SCHEDULE_PATTERN, BULK_IMPORT
  publishedAt: timestamp('published_at', { withTimezone: true }),
  publishedBy: text('published_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text('updated_by'),
});

/**
 * 20b. Roster Change History Table
 */
export const rosterChangeHistory = pgTable('roster_change_history', {
  id: serial('id').primaryKey(),
  rosterEntryId: varchar('roster_entry_id', { length: 64 }).notNull().references(() => rosterEntries.id, { onDelete: 'cascade' }),
  oldShiftId: varchar('old_shift_id', { length: 64 }).references(() => shifts.id, { onDelete: 'set null' }),
  newShiftId: varchar('new_shift_id', { length: 64 }).notNull().references(() => shifts.id, { onDelete: 'restrict' }),
  changedBy: text('changed_by').notNull(),
  changedAt: timestamp('changed_at', { withTimezone: true }).defaultNow().notNull(),
  reason: text('reason').notNull(),
});

/**
 * 20c. Roster Assignments Table (Legacy compatibility)
 */
export const rosterAssignments = pgTable('roster_assignments', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: varchar('employee_id', { length: 64 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  shiftId: varchar('shift_id', { length: 64 }).notNull().references(() => shifts.id, { onDelete: 'restrict' }),
  branchId: varchar('branch_id', { length: 64 }).references(() => branches.id, { onDelete: 'set null' }),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 21. Clock Events Table (Immutable raw punch evidence)
 */
export const clockEvents = pgTable('clock_events', {
  id: varchar('id', { length: 64 }).primaryKey(),
  numericId: serial('numeric_id').notNull().unique(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: varchar('employee_id', { length: 64 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  eventTimestamp: timestamp('event_timestamp', { withTimezone: true }).notNull(),
  eventType: varchar('event_type', { length: 32 }).notNull(), // IN, OUT, BREAK_START, BREAK_END
  source: varchar('source', { length: 32 }).notNull().default('MANUAL'), // MANUAL, EXCEL_IMPORT, BIOMETRIC, MOBILE, API, DESKTOP
  deviceId: varchar('device_id', { length: 64 }),
  branchId: varchar('branch_id', { length: 64 }).references(() => branches.id, { onDelete: 'set null' }),
  siteId: varchar('site_id', { length: 64 }),
  latitude: numeric('latitude', { precision: 10, scale: 7 }),
  longitude: numeric('longitude', { precision: 10, scale: 7 }),
  sourceReference: varchar('source_reference', { length: 128 }),
  isDuplicate: boolean('is_duplicate').notNull().default(false),
  receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
});

/**
 * 21b. Authoritative Attendance Days Table (Deterministic processed daily attendance)
 */
export const attendanceDays = pgTable('attendance_days', {
  id: varchar('id', { length: 64 }).primaryKey(),
  numericId: serial('numeric_id').notNull().unique(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: varchar('employee_id', { length: 64 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  workDate: varchar('work_date', { length: 10 }).notNull(), // YYYY-MM-DD
  rosterEntryId: varchar('roster_entry_id', { length: 64 }).references(() => rosterEntries.id, { onDelete: 'set null' }),
  shiftId: varchar('shift_id', { length: 64 }).references(() => shifts.id, { onDelete: 'set null' }),
  scheduledStart: timestamp('scheduled_start', { withTimezone: true }),
  scheduledEnd: timestamp('scheduled_end', { withTimezone: true }),
  actualFirstIn: timestamp('actual_first_in', { withTimezone: true }),
  actualLastOut: timestamp('actual_last_out', { withTimezone: true }),
  scheduledMinutes: integer('scheduled_minutes').notNull().default(0),
  workedMinutes: integer('worked_minutes').notNull().default(0),
  breakMinutes: integer('break_minutes').notNull().default(0),
  lateMinutes: integer('late_minutes').notNull().default(0),
  earlyLeaveMinutes: integer('early_leave_minutes').notNull().default(0),
  overtimeCandidateMinutes: integer('overtime_candidate_minutes').notNull().default(0),
  status: varchar('status', { length: 32 }).notNull().default('PRESENT'), // PRESENT, ABSENT, LATE, PARTIAL, REST_DAY, HOLIDAY, LEAVE, MISSING_PUNCH, NOT_SCHEDULED
  processingVersion: integer('processing_version').notNull().default(1),
  isLocked: boolean('is_locked').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 21c. Attendance Records Table (Legacy compatibility)
 */
export const attendanceRecords = pgTable('attendance_records', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: varchar('employee_id', { length: 64 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  branchId: varchar('branch_id', { length: 64 }).references(() => branches.id, { onDelete: 'set null' }),
  date: varchar('date', { length: 10 }).notNull(), // 'YYYY-MM-DD'
  checkIn: timestamp('check_in', { withTimezone: true }),
  checkOut: timestamp('check_out', { withTimezone: true }),
  shiftId: varchar('shift_id', { length: 64 }).references(() => shifts.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 32 }).notNull().default('PRESENT'), // PRESENT, ABSENT, ON_LEAVE, HALF_DAY, REST_DAY, HOLIDAY
  totalMinutes: integer('total_minutes').notNull().default(0),
  regularMinutes: integer('regular_minutes').notNull().default(0),
  overtimeMinutes: integer('overtime_minutes').notNull().default(0),
  lateMinutes: integer('late_minutes').notNull().default(0),
  earlyDepartureMinutes: integer('early_departure_minutes').notNull().default(0),
  source: varchar('source', { length: 32 }).notNull().default('WEB'), // BIOMETRIC, WEB, MOBILE, MANUAL
  isCorrected: boolean('is_corrected').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 22. Attendance Exceptions Table (Time Module)
 */
export const attendanceExceptions = pgTable('attendance_exceptions', {
  id: varchar('id', { length: 64 }).primaryKey(),
  numericId: serial('numeric_id').notNull().unique(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: varchar('employee_id', { length: 64 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  attendanceDayId: varchar('attendance_day_id', { length: 64 }).notNull().references(() => attendanceDays.id, { onDelete: 'cascade' }),
  exceptionType: varchar('exception_type', { length: 32 }).notNull(), // MISSING_IN, MISSING_OUT, LATE_ARRIVAL, EARLY_DEPARTURE, UNEXPECTED_ABSENCE, UNEXPECTED_ATTENDANCE, EXCESSIVE_HOURS, OVERLAPPING_CLOCK, DUPLICATE_PUNCH, SCHEDULE_MISMATCH
  severity: varchar('severity', { length: 16 }).notNull().default('MEDIUM'), // LOW, MEDIUM, HIGH, CRITICAL
  status: varchar('status', { length: 32 }).notNull().default('OPEN'), // OPEN, UNDER_REVIEW, RESOLVED, IGNORED
  description: text('description').notNull(),
  detectedAt: timestamp('detected_at', { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedBy: text('resolved_by'),
  resolutionType: varchar('resolution_type', { length: 32 }), // CORRECTION_APPLIED, JUSTIFIED, WAIVED, DEDUCTION_CONFIRMED
  notes: text('notes'),
});

/**
 * 22b. Attendance Corrections Table (Time Module)
 */
export const attendanceCorrections = pgTable('attendance_corrections', {
  id: varchar('id', { length: 64 }).primaryKey(),
  numericId: serial('numeric_id'),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  attendanceId: varchar('attendance_id', { length: 64 }),
  attendanceDayId: varchar('attendance_day_id', { length: 64 }).references(() => attendanceDays.id, { onDelete: 'cascade' }),
  employeeId: varchar('employee_id', { length: 64 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  requestedCheckIn: timestamp('requested_check_in', { withTimezone: true }),
  requestedCheckOut: timestamp('requested_check_out', { withTimezone: true }),
  requestedFirstIn: timestamp('requested_first_in', { withTimezone: true }),
  requestedLastOut: timestamp('requested_last_out', { withTimezone: true }),
  reason: text('reason').notNull(),
  status: varchar('status', { length: 32 }).notNull().default('PENDING'), // PENDING, APPROVED, REJECTED
  requestedBy: text('requested_by'),
  requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow(),
  reviewedBy: text('reviewed_by'),
  reviewNotes: text('review_notes'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  approvedBy: text('approved_by'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  rejectedBy: text('rejected_by'),
  rejectedAt: timestamp('rejected_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 23. Holiday Calendars Table (Time Module)
 */
export const holidayCalendars = pgTable('holiday_calendars', {
  id: varchar('id', { length: 64 }).primaryKey(),
  numericId: serial('numeric_id').notNull().unique(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 32 }).notNull(),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  countryId: integer('country_id').references(() => countries.id, { onDelete: 'set null' }),
  branchId: varchar('branch_id', { length: 64 }).references(() => branches.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text('updated_by'),
});

/**
 * 23b. Public Holidays Table (Time Module)
 */
export const holidays = pgTable('holidays', {
  id: varchar('id', { length: 64 }).primaryKey(),
  numericId: serial('numeric_id'),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  holidayCalendarId: varchar('holiday_calendar_id', { length: 64 }).references(() => holidayCalendars.id, { onDelete: 'set null' }),
  countryCode: varchar('country_code', { length: 2 }),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  startDate: timestamp('start_date', { withTimezone: true }),
  endDate: timestamp('end_date', { withTimezone: true }),
  holidayDate: varchar('holiday_date', { length: 10 }), // YYYY-MM-DD
  daysCount: integer('days_count').notNull().default(1),
  holidayType: varchar('holiday_type', { length: 32 }).notNull().default('PUBLIC'), // PUBLIC, RELIGIOUS, NATIONAL, COMPANY
  isPaid: boolean('is_paid').notNull().default(true),
  isRecurring: boolean('is_recurring').notNull().default(false),
  year: integer('year').notNull(),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 24. Leave Types Table (Time Module)
 */
export const leaveTypes = pgTable('leave_types', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 32 }).notNull(), // ANNUAL, SICK, HAJJ, MATERNITY, COMPASSIONATE, UNPAID
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  defaultDaysPerYear: integer('default_days_per_year').notNull().default(30),
  isPaid: boolean('is_paid').notNull().default(true),
  requiresApproval: boolean('requires_approval').notNull().default(true),
  statutoryReference: text('statutory_reference'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 25. Leave Allocations / Balances Table (Time Module)
 */
export const leaveAllocations = pgTable('leave_allocations', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: varchar('employee_id', { length: 64 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  leaveTypeId: varchar('leave_type_id', { length: 64 }).notNull().references(() => leaveTypes.id, { onDelete: 'cascade' }),
  year: integer('year').notNull(),
  allocatedDays: integer('allocated_days').notNull().default(30),
  usedDays: integer('used_days').notNull().default(0),
  pendingDays: integer('pending_days').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 26. Leave Requests Table (Time Module)
 */
export const leaveRequests = pgTable('leave_requests', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: varchar('employee_id', { length: 64 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  leaveTypeId: varchar('leave_type_id', { length: 64 }).notNull().references(() => leaveTypes.id, { onDelete: 'restrict' }),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  daysRequested: integer('days_requested').notNull(),
  reason: text('reason'),
  status: varchar('status', { length: 32 }).notNull().default('PENDING'), // PENDING, APPROVED, REJECTED, CANCELLED
  approvedBy: text('approved_by'),
  approvalNotes: text('approval_notes'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 27. Timesheets Table (Time Module)
 */
export const timesheets = pgTable('timesheets', {
  id: varchar('id', { length: 64 }).primaryKey(),
  numericId: serial('numeric_id').notNull().unique(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: varchar('employee_id', { length: 64 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  timesheetNumber: varchar('timesheet_number', { length: 32 }).notNull(), // TS-2026-00001
  periodStart: varchar('period_start', { length: 10 }).notNull(), // YYYY-MM-DD
  periodEnd: varchar('period_end', { length: 10 }).notNull(), // YYYY-MM-DD
  status: varchar('status', { length: 32 }).notNull().default('DRAFT'), // DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, LOCKED
  totalRegularMinutes: integer('total_regular_minutes').notNull().default(0),
  totalOvertimeMinutes: integer('total_overtime_minutes').notNull().default(0),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  submittedBy: text('submitted_by'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedBy: text('approved_by'),
  rejectionReason: text('rejection_reason'),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  lockedBy: text('locked_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text('updated_by'),
});

/**
 * 27b. Timesheet Lines Table (Time Module)
 */
export const timesheetLines = pgTable('timesheet_lines', {
  id: serial('id').primaryKey(),
  timesheetId: varchar('timesheet_id', { length: 64 }).notNull().references(() => timesheets.id, { onDelete: 'cascade' }),
  workDate: varchar('work_date', { length: 10 }).notNull(), // YYYY-MM-DD
  attendanceDayId: varchar('attendance_day_id', { length: 64 }).references(() => attendanceDays.id, { onDelete: 'set null' }),
  projectId: varchar('project_id', { length: 64 }),
  siteId: varchar('site_id', { length: 64 }),
  clientId: varchar('client_id', { length: 64 }),
  costCenterId: varchar('cost_center_id', { length: 64 }).references(() => costCenters.id, { onDelete: 'set null' }),
  activityCodeId: varchar('activity_code_id', { length: 64 }),
  regularMinutes: integer('regular_minutes').notNull().default(0),
  overtimeMinutes: integer('overtime_minutes').notNull().default(0),
  notes: text('notes'),
});

/**
 * 27c. Overtime Records Table (Time Module)
 */
export const overtimeRecords = pgTable('overtime_records', {
  id: varchar('id', { length: 64 }).primaryKey(),
  numericId: serial('numeric_id'),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: varchar('employee_id', { length: 64 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  attendanceId: varchar('attendance_id', { length: 64 }).references(() => attendanceRecords.id, { onDelete: 'set null' }),
  attendanceDayId: varchar('attendance_day_id', { length: 64 }).references(() => attendanceDays.id, { onDelete: 'set null' }),
  date: varchar('date', { length: 10 }).notNull(),
  overtimeType: varchar('overtime_type', { length: 32 }).notNull(), // REGULAR_DAY, WEEKEND, HOLIDAY, NIGHT, CUSTOM
  minutes: integer('minutes').notNull(),
  source: varchar('source', { length: 32 }).notNull().default('ATTENDANCE'), // ATTENDANCE, MANUAL, SUPERVISOR_OVERRIDE
  statutoryRateMultiplier: text('statutory_rate_multiplier').default('1.25'),
  status: varchar('status', { length: 32 }).notNull().default('PENDING'), // PENDING, APPROVED, REJECTED
  reason: text('reason'),
  approvedBy: text('approved_by'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
});

/**
 * 28. Approval Workflows Table (Reusable Workflow Engine)
 */
export const approvalWorkflows = pgTable('approval_workflows', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  entityType: varchar('entity_type', { length: 64 }).notNull(), // LEAVE_REQUEST, OVERTIME_REQUEST, ATTENDANCE_CORRECTION, PAYROLL_RUN, FINAL_SETTLEMENT
  entityId: text('entity_id').notNull(),
  action: varchar('action', { length: 32 }).notNull(), // SUBMITTED, APPROVED, REJECTED, RESUBMITTED
  actorId: text('actor_id').notNull(),
  actorEmail: text('actor_email'),
  actorRole: varchar('actor_role', { length: 64 }),
  comments: text('comments'),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 29. Employee Loans Table (Payroll Module)
 */
export const employeeLoans = pgTable('employee_loans', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: varchar('employee_id', { length: 64 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  loanAmount: text('loan_amount').notNull(),
  monthlyInstallment: text('monthly_installment').notNull(),
  totalPaid: text('total_paid').notNull().default('0'),
  remainingBalance: text('remaining_balance').notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'), // ACTIVE, REPAID, PAUSED
  disbursementDate: timestamp('disbursement_date', { withTimezone: true }).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 30. Payroll Runs Table (Payroll Module)
 */
export const payrollRuns = pgTable('payroll_runs', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  periodMonth: integer('period_month').notNull(), // 1 - 12
  periodYear: integer('period_year').notNull(),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('DRAFT'), // DRAFT, VALIDATED, APPROVED, POSTED, PAID
  currency: varchar('currency', { length: 3 }).notNull(),
  totalEmployees: integer('total_employees').notNull().default(0),
  totalGrossPay: text('total_gross_pay').notNull().default('0'),
  totalDeductions: text('total_deductions').notNull().default('0'),
  totalNetPay: text('total_net_pay').notNull().default('0'),
  validatedAt: timestamp('validated_at', { withTimezone: true }),
  approvedBy: text('approved_by'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  wpsGeneratedAt: timestamp('wps_generated_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 31. Payroll Items Table (Payroll Module)
 * Itemized payslip calculations with explainability audit trace.
 */
export const payrollItems = pgTable('payroll_items', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  payrollRunId: varchar('payroll_run_id', { length: 64 }).notNull().references(() => payrollRuns.id, { onDelete: 'cascade' }),
  employeeId: varchar('employee_id', { length: 64 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  currency: varchar('currency', { length: 3 }).notNull(),
  basicSalary: text('basic_salary').notNull(),
  housingAllowance: text('housing_allowance').notNull().default('0'),
  transportAllowance: text('transport_allowance').notNull().default('0'),
  otherAllowances: text('other_allowances').notNull().default('0'),
  overtimeAmount: text('overtime_amount').notNull().default('0'),
  overtimeHours: text('overtime_hours').notNull().default('0'),
  unpaidLeaveDeduction: text('unpaid_leave_deduction').notNull().default('0'),
  unpaidLeaveDays: integer('unpaid_leave_days').notNull().default(0),
  loanDeduction: text('loan_deduction').notNull().default('0'),
  statutoryEmployeeContribution: text('statutory_employee_contribution').notNull().default('0'), // PIFSS / GOSI employee deduction
  statutoryEmployerContribution: text('statutory_employer_contribution').notNull().default('0'), // PIFSS / GOSI employer contribution
  grossPay: text('gross_pay').notNull(),
  totalDeductions: text('total_deductions').notNull(),
  netPay: text('net_pay').notNull(),
  paymentMethod: varchar('payment_method', { length: 32 }).notNull().default('WPS_BANK'),
  bankName: text('bank_name'),
  iban: text('iban'),
  calculationBreakdown: jsonb('calculation_breakdown').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 32. Final Settlements / End of Service Indemnity Table (Payroll Module)
 */
export const finalSettlements = pgTable('final_settlements', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: varchar('employee_id', { length: 64 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  contractType: varchar('contract_type', { length: 32 }).notNull(), // LIMITED, UNLIMITED
  terminationType: varchar('termination_type', { length: 32 }).notNull(), // RESIGNATION, TERMINATION, RETIREMENT, END_OF_CONTRACT
  joiningDate: timestamp('joining_date', { withTimezone: true }).notNull(),
  lastWorkingDate: timestamp('last_working_date', { withTimezone: true }).notNull(),
  totalServiceYears: text('total_service_years').notNull(),
  lastBasicSalary: text('last_basic_salary').notNull(),
  statutoryGratuityAmount: text('statutory_gratuity_amount').notNull(),
  accruedLeaveEncashment: text('accrued_leave_encashment').notNull().default('0'),
  unpaidSalary: text('unpaid_salary').notNull().default('0'),
  loanDeductions: text('loan_deductions').notNull().default('0'),
  netSettlementAmount: text('net_settlement_amount').notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('DRAFT'), // DRAFT, APPROVED, PAID
  calculationDetails: jsonb('calculation_details').notNull(),
  approvedBy: text('approved_by'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Relationships
export const tenantsRelations = relations(tenants, ({ many }) => ({
  branches: many(branches),
  users: many(users),
  userTenants: many(userTenants),
  roles: many(roles),
  departments: many(departments),
  designations: many(designations),
  employees: many(employees),
  auditLogs: many(auditLogs),
}));

export const branchesRelations = relations(branches, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [branches.tenantId],
    references: [tenants.id],
  }),
  employees: many(employees),
}));

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [departments.tenantId],
    references: [tenants.id],
  }),
  designations: many(designations),
  employees: many(employees),
}));

export const designationsRelations = relations(designations, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [designations.tenantId],
    references: [tenants.id],
  }),
  department: one(departments, {
    fields: [designations.departmentId],
    references: [departments.id],
  }),
  employees: many(employees),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [employees.tenantId],
    references: [tenants.id],
  }),
  branch: one(branches, {
    fields: [employees.branchId],
    references: [branches.id],
  }),
  department: one(departments, {
    fields: [employees.departmentId],
    references: [departments.id],
  }),
  designation: one(designations, {
    fields: [employees.designationId],
    references: [designations.id],
  }),
  contracts: many(employeeContracts),
  salaries: many(employeeSalaries),
  bankDetails: many(employeeBankDetails),
  documents: many(employeeDocuments),
  history: many(employeeHistory),
  assignments: many(employeeAssignments),
  emergencyContacts: many(employeeEmergencyContacts),
  dependents: many(employeeDependents),
}));

export const employeeContractsRelations = relations(employeeContracts, ({ one }) => ({
  employee: one(employees, {
    fields: [employeeContracts.employeeId],
    references: [employees.id],
  }),
}));

export const employeeSalariesRelations = relations(employeeSalaries, ({ one }) => ({
  employee: one(employees, {
    fields: [employeeSalaries.employeeId],
    references: [employees.id],
  }),
}));

export const employeeBankDetailsRelations = relations(employeeBankDetails, ({ one }) => ({
  employee: one(employees, {
    fields: [employeeBankDetails.employeeId],
    references: [employees.id],
  }),
}));

export const employeeDocumentsRelations = relations(employeeDocuments, ({ one }) => ({
  employee: one(employees, {
    fields: [employeeDocuments.employeeId],
    references: [employees.id],
  }),
}));

export const employeeHistoryRelations = relations(employeeHistory, ({ one }) => ({
  employee: one(employees, {
    fields: [employeeHistory.employeeId],
    references: [employees.id],
  }),
}));

export const rolesRelations = relations(roles, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [roles.tenantId],
    references: [tenants.id],
  }),
  rolePermissions: many(rolePermissions),
  userTenants: many(userTenants),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
  userTenants: many(userTenants),
}));

export const userTenantsRelations = relations(userTenants, ({ one }) => ({
  user: one(users, {
    fields: [userTenants.userId],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [userTenants.tenantId],
    references: [tenants.id],
  }),
  role: one(roles, {
    fields: [userTenants.roleId],
    references: [roles.id],
  }),
  branch: one(branches, {
    fields: [userTenants.defaultBranchId],
    references: [branches.id],
  }),
}));
