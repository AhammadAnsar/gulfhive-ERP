import { relations } from 'drizzle-orm';
import { boolean, integer, jsonb, pgTable, primaryKey, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';

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
  code: varchar('code', { length: 64 }).notNull(), // SUPER_ADMIN, COMPANY_ADMIN, FINANCE_MANAGER, HR_MANAGER, etc.
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  descriptionEn: text('description_en'),
  descriptionAr: text('description_ar'),
  isSystemRole: boolean('is_system_role').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 4. Permissions Table
 * Granular business operations permissions.
 */
export const permissions = pgTable('permissions', {
  id: varchar('id', { length: 64 }).primaryKey(),
  code: varchar('code', { length: 64 }).notNull().unique(), // e.g. company.manage, users.manage, finance.post
  module: varchar('module', { length: 32 }).notNull(),
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
 * Strictly follows Cloud SQL + Firebase Auth specification.
 * `uid` is the Firebase Auth unique identifier (or desktop local UID).
 */
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  role: varchar('role', { length: 32 }).notNull().default('VIEWER'),
  tenantId: varchar('tenant_id', { length: 64 }).references(() => tenants.id, { onDelete: 'set null' }),
  preferredLanguage: varchar('preferred_language', { length: 2 }).notNull().default('en'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 7. User Tenants Junction Table (Multi-Company Access)
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
 * 10. Employees Table (Authoritative Employee Master)
 * Single source of truth for all employment records in GulfHive.
 */
export const employees = pgTable('employees', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  branchId: varchar('branch_id', { length: 64 }).notNull().references(() => branches.id, { onDelete: 'restrict' }),
  departmentId: varchar('department_id', { length: 64 }).references(() => departments.id, { onDelete: 'set null' }),
  designationId: varchar('designation_id', { length: 64 }).references(() => designations.id, { onDelete: 'set null' }),
  employeeNumber: varchar('employee_number', { length: 32 }).notNull(),
  firstNameEn: text('first_name_en').notNull(),
  lastNameEn: text('last_name_en').notNull(),
  firstNameAr: text('first_name_ar').notNull(),
  lastNameAr: text('last_name_ar').notNull(),
  gender: varchar('gender', { length: 16 }).notNull(), // MALE, FEMALE
  dateOfBirth: timestamp('date_of_birth', { withTimezone: true }),
  nationality: varchar('nationality', { length: 64 }).notNull(),
  civilIdNumber: varchar('civil_id_number', { length: 32 }),
  passportNumber: varchar('passport_number', { length: 32 }),
  phone: varchar('phone', { length: 32 }),
  email: text('email').notNull(),
  joiningDate: timestamp('joining_date', { withTimezone: true }).notNull(),
  employmentStatus: varchar('employment_status', { length: 32 }).notNull().default('ACTIVE'), // PROBATION, ACTIVE, ON_LEAVE, RESIGNED, TERMINATED
  contractType: varchar('contract_type', { length: 32 }).notNull().default('UNLIMITED'), // LIMITED, UNLIMITED, PROJECT_BASED
  workLocation: text('work_location'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
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
  probationPeriodDays: integer('probation_period_days').default(90).notNull(),
  noticePeriodDays: integer('notice_period_days').default(90).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'), // ACTIVE, EXPIRED, TERMINATED
  terms: text('terms'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
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
  otherAllowances: text('other_allowances').default('0.000').notNull(),
  effectiveDate: timestamp('effective_date', { withTimezone: true }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 13. Employee Bank Details Table
 * WPS compliance routing and IBAN account structures.
 */
export const employeeBankDetails = pgTable('employee_bank_details', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: varchar('employee_id', { length: 64 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  bankName: text('bank_name').notNull(),
  bankCode: varchar('bank_code', { length: 32 }), // WPS / Central Bank Routing Code
  iban: varchar('iban', { length: 64 }).notNull(),
  accountNumber: varchar('account_number', { length: 64 }).notNull(),
  swiftBic: varchar('swift_bic', { length: 32 }),
  isPrimary: boolean('is_primary').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 14. Employee Documents Table
 * Civil ID, Iqama, Passport, Work Permit, and Expiry tracking.
 */
export const employeeDocuments = pgTable('employee_documents', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: varchar('employee_id', { length: 64 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
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
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
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
 * 19. Shifts Table (Time Module)
 */
export const shifts = pgTable('shifts', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 32 }).notNull(), // DAY-01, NIGHT-01, SPLIT-01
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  startTime: varchar('start_time', { length: 8 }).notNull(), // '08:00'
  endTime: varchar('end_time', { length: 8 }).notNull(), // '16:00'
  breakDurationMinutes: integer('break_duration_minutes').notNull().default(60),
  gracePeriodMinutes: integer('grace_period_minutes').notNull().default(15),
  isOvernight: boolean('is_overnight').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 20. Roster Assignments Table (Time Module)
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
 * 21. Attendance Records Table (Time Module)
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
 * 22. Attendance Corrections Table (Time Module)
 */
export const attendanceCorrections = pgTable('attendance_corrections', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  attendanceId: varchar('attendance_id', { length: 64 }).notNull().references(() => attendanceRecords.id, { onDelete: 'cascade' }),
  employeeId: varchar('employee_id', { length: 64 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  requestedCheckIn: timestamp('requested_check_in', { withTimezone: true }),
  requestedCheckOut: timestamp('requested_check_out', { withTimezone: true }),
  reason: text('reason').notNull(),
  status: varchar('status', { length: 32 }).notNull().default('PENDING'), // PENDING, APPROVED, REJECTED
  reviewedBy: text('reviewed_by'),
  reviewNotes: text('review_notes'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 23. Public Holidays Table (Time Module)
 */
export const holidays = pgTable('holidays', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  countryCode: varchar('country_code', { length: 2 }).notNull(),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  daysCount: integer('days_count').notNull().default(1),
  isRecurring: boolean('is_recurring').notNull().default(false),
  year: integer('year').notNull(),
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
 * 27. Overtime Records Table (Time Module)
 */
export const overtimeRecords = pgTable('overtime_records', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: varchar('employee_id', { length: 64 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  attendanceId: varchar('attendance_id', { length: 64 }).references(() => attendanceRecords.id, { onDelete: 'set null' }),
  date: varchar('date', { length: 10 }).notNull(),
  overtimeType: varchar('overtime_type', { length: 32 }).notNull(), // REGULAR_DAY, WEEKEND, HOLIDAY
  minutes: integer('minutes').notNull(),
  statutoryRateMultiplier: text('statutory_rate_multiplier').notNull().default('1.25'), // 1.25x or 1.50x
  status: varchar('status', { length: 32 }).notNull().default('PENDING'), // PENDING, APPROVED, REJECTED
  reason: text('reason'),
  approvedBy: text('approved_by'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
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
