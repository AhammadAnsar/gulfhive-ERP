-- GulfHive ERP Leave & Overtime Policy Module Migration
-- Migration: 0007_leave_overtime_policy_module.sql

-- 1. Enhance Leave Types Table
ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS numeric_id SERIAL;
ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS category VARCHAR(32) DEFAULT 'ANNUAL' NOT NULL;
ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS requires_attachment BOOLEAN DEFAULT false NOT NULL;
ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL;
ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Leave Policies Table (Versioned Rules & Accrual Configurations)
CREATE TABLE IF NOT EXISTS leave_policies (
  id VARCHAR(64) PRIMARY KEY,
  numeric_id SERIAL UNIQUE,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  leave_type_id VARCHAR(64) NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  effective_from VARCHAR(10) NOT NULL, -- YYYY-MM-DD
  effective_to VARCHAR(10),            -- YYYY-MM-DD (null = active ongoing)
  accrual_method VARCHAR(32) NOT NULL DEFAULT 'ANNUAL_GRANT', -- ANNUAL_GRANT, MONTHLY_ACCRUAL, DAILY_ACCRUAL, ANNIVERSARY_BASED, CUSTOM
  annual_entitlement NUMERIC(7, 2) NOT NULL DEFAULT 30.00,
  eligibility_months INTEGER NOT NULL DEFAULT 0,
  carry_forward_enabled BOOLEAN NOT NULL DEFAULT true,
  carry_forward_limit NUMERIC(7, 2) NOT NULL DEFAULT 5.00,
  carry_forward_expiry_months INTEGER NOT NULL DEFAULT 3,
  encashment_allowed BOOLEAN NOT NULL DEFAULT false,
  negative_balance_allowed BOOLEAN NOT NULL DEFAULT false,
  maximum_consecutive_days INTEGER,
  exclude_rest_days BOOLEAN NOT NULL DEFAULT true,
  exclude_holidays BOOLEAN NOT NULL DEFAULT true,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 3. Employee Leave Entitlements Table (Period Entitlement Records)
CREATE TABLE IF NOT EXISTS employee_leave_entitlements (
  id VARCHAR(64) PRIMARY KEY,
  numeric_id SERIAL UNIQUE,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_policy_id VARCHAR(64) NOT NULL REFERENCES leave_policies(id) ON DELETE CASCADE,
  period_start VARCHAR(10) NOT NULL,
  period_end VARCHAR(10) NOT NULL,
  opening_balance NUMERIC(7, 2) NOT NULL DEFAULT 0.00,
  accrued NUMERIC(7, 2) NOT NULL DEFAULT 0.00,
  used NUMERIC(7, 2) NOT NULL DEFAULT 0.00,
  adjusted NUMERIC(7, 2) NOT NULL DEFAULT 0.00,
  carried_forward NUMERIC(7, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 4. Authoritative Leave Ledger Table (Transaction-Based Derived Balances)
CREATE TABLE IF NOT EXISTS leave_ledger (
  id VARCHAR(64) PRIMARY KEY,
  numeric_id SERIAL UNIQUE,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id VARCHAR(64) NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  transaction_date VARCHAR(10) NOT NULL,
  transaction_type VARCHAR(32) NOT NULL, -- OPENING, ACCRUAL, USED, ADJUSTMENT, CARRY_FORWARD, ENCASHMENT, EXPIRY
  quantity NUMERIC(7, 2) NOT NULL,       -- positive for credits, negative for debits
  reference_type VARCHAR(32),            -- LEAVE_REQUEST, MANUAL_ADJUSTMENT, YEAR_END_ROLLOVER
  reference_id VARCHAR(64),
  notes TEXT,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 5. Enhance Leave Requests Table
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS start_portion VARCHAR(20) DEFAULT 'FULL_DAY';
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS end_portion VARCHAR(20) DEFAULT 'FULL_DAY';
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS calendar_days INTEGER DEFAULT 1;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS requested_quantity NUMERIC(7, 2) DEFAULT 1.00;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS attachment_id TEXT;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS cancelled_by TEXT;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 6. Overtime Policies Table (Configurable Overtime Caps, Minimums & Rounding)
CREATE TABLE IF NOT EXISTS overtime_policies (
  id VARCHAR(64) PRIMARY KEY,
  numeric_id SERIAL UNIQUE,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(32) NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  effective_from VARCHAR(10) NOT NULL,
  effective_to VARCHAR(10),
  eligibility_rule TEXT,
  minimum_minutes INTEGER NOT NULL DEFAULT 30,
  rounding_rule VARCHAR(32) NOT NULL DEFAULT 'NEAREST_15_MIN', -- EXACT_MINUTE, NEAREST_15_MIN, NEAREST_30_MIN
  maximum_daily_minutes INTEGER DEFAULT 240,
  maximum_weekly_minutes INTEGER DEFAULT 960,
  approval_required BOOLEAN NOT NULL DEFAULT true,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 7. Enhance Overtime Records Table
ALTER TABLE overtime_records ADD COLUMN IF NOT EXISTS requested_minutes INTEGER;
ALTER TABLE overtime_records ADD COLUMN IF NOT EXISTS approved_minutes INTEGER;
ALTER TABLE overtime_records ADD COLUMN IF NOT EXISTS overtime_policy_id VARCHAR(64) REFERENCES overtime_policies(id) ON DELETE SET NULL;
ALTER TABLE overtime_records ADD COLUMN IF NOT EXISTS project_id VARCHAR(64);
ALTER TABLE overtime_records ADD COLUMN IF NOT EXISTS site_id VARCHAR(64);
ALTER TABLE overtime_records ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE overtime_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 8. Relational Indexes
CREATE INDEX IF NOT EXISTS idx_leave_policies_tenant ON leave_policies(tenant_id, leave_type_id);
CREATE INDEX IF NOT EXISTS idx_employee_entitlements ON employee_leave_entitlements(employee_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_leave_ledger_emp ON leave_ledger(employee_id, leave_type_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_emp_dates ON leave_requests(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_overtime_policies_tenant ON overtime_policies(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_overtime_records_emp_date ON overtime_records(employee_id, date);

-- 9. Seed Granular Permissions for Leave & Overtime
INSERT INTO permissions (id, code, name_en, name_ar, module, resource, action) VALUES
  ('perm_leave_view', 'leave.view', 'View Leave Applications', 'عرض طلبات الإجازات', 'TIME', 'leave', 'VIEW'),
  ('perm_leave_request', 'leave.request', 'Apply for Leave', 'تقديم طلب إجازة', 'TIME', 'leave', 'CREATE'),
  ('perm_leave_cancel', 'leave.cancel', 'Cancel Leave Application', 'إلغاء طلب الإجازة', 'TIME', 'leave', 'DELETE'),
  ('perm_leave_approve', 'leave.approve', 'Approve/Reject Leave', 'اعتماد أو رفض الإجازات', 'TIME', 'leave', 'APPROVE'),
  ('perm_leave_pol_view', 'leave.policy.view', 'View Leave Policies', 'عرض سياسات الإجازات', 'TIME', 'leave', 'VIEW'),
  ('perm_leave_pol_manage', 'leave.policy.manage', 'Manage Leave Policies', 'إدارة سياسات الإجازات', 'TIME', 'leave', 'MANAGE'),
  ('perm_leave_bal_view', 'leave.balance.view', 'View Leave Balances & Ledger', 'عرض أرصدة وسجل الإجازات', 'TIME', 'leave', 'VIEW'),
  ('perm_leave_bal_adjust', 'leave.balance.adjust', 'Adjust Leave Balances', 'تسوية رصيد الإجازات', 'TIME', 'leave', 'MANAGE'),
  ('perm_leave_export', 'leave.export', 'Export Leave Reports', 'تصدير تقارير الإجازات', 'TIME', 'leave', 'EXPORT'),
  ('perm_ot_view', 'overtime.view', 'View Overtime Records', 'عرض سجلات العمل الإضافي', 'TIME', 'overtime', 'VIEW'),
  ('perm_ot_request', 'overtime.request', 'Submit Overtime Request', 'تقديم طلب عمل إضافي', 'TIME', 'overtime', 'CREATE'),
  ('perm_ot_approve', 'overtime.approve', 'Approve/Reject Overtime', 'اعتماد أو رفض العمل الإضافي', 'TIME', 'overtime', 'APPROVE'),
  ('perm_ot_pol_view', 'overtime.policy.view', 'View Overtime Policies', 'عرض سياسات العمل الإضافي', 'TIME', 'overtime', 'VIEW'),
  ('perm_ot_pol_manage', 'overtime.policy.manage', 'Manage Overtime Policies', 'إدارة سياسات العمل الإضافي', 'TIME', 'overtime', 'MANAGE'),
  ('perm_ot_export', 'overtime.export', 'Export Overtime Reports', 'تصدير تقارير العمل الإضافي', 'TIME', 'overtime', 'EXPORT')
ON CONFLICT (id) DO NOTHING;

-- Assign to Super Admin and Admin Roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role_super_admin', id FROM permissions WHERE code LIKE 'leave.%' OR code LIKE 'overtime.%'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role_admin', id FROM permissions WHERE code LIKE 'leave.%' OR code LIKE 'overtime.%'
ON CONFLICT DO NOTHING;
