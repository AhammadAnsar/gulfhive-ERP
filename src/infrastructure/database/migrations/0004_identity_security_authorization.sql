-- GulfHive ERP Identity, Auth & Permissions Foundation
-- Migration: 0004_identity_security_authorization.sql

-- 1. Extend Users Table
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(64) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(32);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_password_changed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_by TEXT;

-- 2. Roles Table
CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(64) NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  description_en TEXT,
  description_ar TEXT,
  is_system_role BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_by TEXT,
  archived_at TIMESTAMP WITH TIME ZONE,
  archived_by TEXT
);

-- 3. Permissions Table
CREATE TABLE IF NOT EXISTS permissions (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  module VARCHAR(32) NOT NULL,
  resource VARCHAR(32),
  action VARCHAR(32) NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  description_en TEXT,
  description_ar TEXT
);

-- 4. Role Permissions Table
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id VARCHAR(64) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id VARCHAR(64) NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- 5. User Roles Table
CREATE TABLE IF NOT EXISTS user_roles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id VARCHAR(64) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  tenant_id VARCHAR(64) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 6. User Company Access Table
CREATE TABLE IF NOT EXISTS user_company_access (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  is_default BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  CONSTRAINT uk_user_company UNIQUE (user_id, company_id)
);

-- 7. User Branch Access Table
CREATE TABLE IF NOT EXISTS user_branch_access (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  CONSTRAINT uk_user_branch UNIQUE (user_id, company_id, branch_id)
);

-- 8. User Data Scopes Table
CREATE TABLE IF NOT EXISTS user_data_scopes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  module VARCHAR(32) NOT NULL,
  scope VARCHAR(32) NOT NULL DEFAULT 'COMPANY',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT uk_user_data_scope UNIQUE (user_id, company_id, module)
);

-- 9. User Sessions Table
CREATE TABLE IF NOT EXISTS user_sessions (
  id VARCHAR(64) PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  device_info TEXT,
  ip_address TEXT,
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 10. Login Events Table
CREATE TABLE IF NOT EXISTS login_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username TEXT,
  is_success BOOLEAN NOT NULL,
  failure_reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Seed Comprehensive Permissions
INSERT INTO permissions (id, code, module, resource, action, name_en, name_ar, description_en, description_ar) VALUES
  ('perm_company_view', 'company.view', 'company', 'company', 'view', 'View Company Details', 'عرض بيانات المنشأة', 'View company profile and settings', 'عرض معلومات الكيان القانوني والإعدادات'),
  ('perm_company_manage', 'company.manage', 'company', 'company', 'manage', 'Manage Company', 'إدارة المنشأة', 'Modify company details, tax, and structure', 'تعديل بيانات المنشأة والضرائب'),
  ('perm_branch_view', 'branch.view', 'branch', 'branch', 'view', 'View Branches', 'عرض الفروع', 'View company branches', 'عرض فروع ومواقع المنشأة'),
  ('perm_branch_manage', 'branch.manage', 'branch', 'branch', 'manage', 'Manage Branches', 'إدارة الفروع', 'Create and manage branches', 'إنشاء وإدارة الفروع والمواقع'),
  ('perm_users_view', 'users.view', 'settings', 'users', 'view', 'View Users', 'عرض المستخدمين', 'View company users', 'عرض مستخدمي المنشأة'),
  ('perm_users_manage', 'users.manage', 'settings', 'users', 'manage', 'Manage Users', 'إدارة المستخدمين', 'Create, update, and disable users', 'إنشاء وتعديل وتعطيل المستخدمين'),
  ('perm_roles_view', 'roles.view', 'settings', 'roles', 'view', 'View Roles', 'عرض الأدوار', 'View security roles and permissions', 'عرض مصفوفة الأدوار والصلاحيات'),
  ('perm_roles_manage', 'roles.manage', 'settings', 'roles', 'manage', 'Manage Roles', 'إدارة الأدوار', 'Create, update, and assign roles', 'إنشاء وتعديل وتعيين الأدوار'),
  ('perm_people_view', 'people.view', 'people', 'employee', 'view', 'View Employees', 'عرض الموظفين', 'View employee records', 'عرض سجلات الموظفين والعقود'),
  ('perm_people_manage', 'people.manage', 'people', 'employee', 'manage', 'Manage Employees', 'إدارة الموظفين', 'Create and edit employee records', 'إنشاء وتحديث سجلات الموظفين'),
  ('perm_people_salary_view', 'people.salary.view', 'people', 'salary', 'view', 'View Employee Salary', 'عرض رواتب الموظفين', 'View sensitive salary and compensation data', 'عرض البيانات المالية والرواتب الحساسة'),
  ('perm_time_view', 'time.view', 'time', 'attendance', 'view', 'View Attendance & Timesheets', 'عرض الحضور والسجلات', 'View shifts and attendance logs', 'عرض الحضور والانصراف والمناوبات'),
  ('perm_time_manage', 'time.manage', 'time', 'attendance', 'manage', 'Manage Attendance', 'إدارة الحضور والانصراف', 'Approve leaves, overtime, and adjust logs', 'اعتماد الإجازات والساعات الإضافية'),
  ('perm_payroll_view', 'payroll.view', 'payroll', 'payroll', 'view', 'View Payroll', 'عرض הرواتب', 'View payroll runs and slips', 'عرض مسيرات الرواتب وكشوف الحساب'),
  ('perm_payroll_process', 'payroll.process', 'payroll', 'payroll', 'process', 'Process Payroll', 'احتساب הرواتب', 'Calculate and prepare payroll runs', 'احتساب وإعداد مسيرات الرواتب'),
  ('perm_payroll_approve', 'payroll.approve', 'payroll', 'payroll', 'approve', 'Approve Payroll', 'اعتماد הرواتب', 'Authorize and approve finalized payroll', 'اعتماد مسيرات الرواتب وتوليد WPS'),
  ('perm_finance_view', 'finance.view', 'finance', 'ledger', 'view', 'View Financial Ledger', 'عرض السجل المالي', 'View chart of accounts and reports', 'عرض الحسابات والتقارير المالية'),
  ('perm_finance_post', 'finance.post', 'finance', 'journal', 'post', 'Post Journal Entries', 'ترحيل القيود', 'Post and reverse double-entry journals', 'ترحيل وإلغاء القيود المحاسبية'),
  ('perm_audit_view', 'audit.view', 'audit', 'audit_logs', 'view', 'View Audit Trail', 'عرض سجلات التدقيق', 'Inspect immutable audit logs', 'فحص سجلات التدقيق والنظام')
ON CONFLICT (code) DO NOTHING;

-- Seed System Roles
INSERT INTO roles (id, code, name_en, name_ar, description_en, description_ar, is_system_role, status) VALUES
  ('role_company_admin', 'COMPANY_ADMIN', 'Company Administrator', 'مدير المنشأة', 'Full administrative control over company, users, and operations.', 'صلاحيات إدارية كاملة على المنشأة والمستخدمين والعمليات.', true, 'ACTIVE'),
  ('role_hr_manager', 'HR_MANAGER', 'HR Manager', 'مدير الموارد البشرية', 'Manage employees, attendance, and preparation of payroll.', 'إدارة الموظفين والحضور والانصراف وإعداد הرواتب.', true, 'ACTIVE'),
  ('role_finance_manager', 'FINANCE_MANAGER', 'Finance Manager', 'المدير المالي', 'Manage financial ledgers, journals, and payroll approvals.', 'إدارة الحسابات العامة והقيود واعتماد الرواتب.', true, 'ACTIVE'),
  ('role_auditor', 'AUDITOR', 'Auditor', 'مدقق حسابات', 'Read-only audit inspection across all modules.', 'صلاحية استعراض وتدقيق شاملة لجميع السجلات.', true, 'ACTIVE'),
  ('role_viewer', 'VIEWER', 'Standard Viewer', 'مستخدم مستعرض', 'Basic read-only access to assigned company modules.', 'صلاحية استعراض أساسية للمنشأة.', true, 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- Map Company Admin Role Permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role_company_admin', id FROM permissions
ON CONFLICT DO NOTHING;

-- Map HR Manager Permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role_hr_manager', id FROM permissions WHERE code IN ('company.view', 'branch.view', 'users.view', 'people.view', 'people.manage', 'people.salary.view', 'time.view', 'time.manage', 'payroll.view', 'payroll.process')
ON CONFLICT DO NOTHING;

-- Map Finance Manager Permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role_finance_manager', id FROM permissions WHERE code IN ('company.view', 'branch.view', 'payroll.view', 'payroll.process', 'payroll.approve', 'finance.view', 'finance.post', 'audit.view')
ON CONFLICT DO NOTHING;

-- Map Auditor Permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role_auditor', id FROM permissions WHERE code IN ('company.view', 'branch.view', 'users.view', 'roles.view', 'people.view', 'time.view', 'payroll.view', 'finance.view', 'audit.view')
ON CONFLICT DO NOTHING;

-- Map Viewer Permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role_viewer', id FROM permissions WHERE code IN ('company.view', 'branch.view', 'people.view', 'time.view')
ON CONFLICT DO NOTHING;
