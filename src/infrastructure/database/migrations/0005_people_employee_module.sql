-- GulfHive ERP People & Employee Master Module Migration
-- Migration: 0005_people_employee_module.sql

-- 1. Extend Employees Table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS numeric_id SERIAL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS middle_name_en TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS middle_name_ar TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS display_name_en TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS display_name_ar TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS marital_status VARCHAR(32) DEFAULT 'SINGLE';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employee_category_id VARCHAR(64) REFERENCES employee_categories(id) ON DELETE SET NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS business_unit_id VARCHAR(64) REFERENCES business_units(id) ON DELETE SET NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS cost_center_id VARCHAR(64) REFERENCES cost_centers(id) ON DELETE SET NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS nationality_id INTEGER REFERENCES nationalities(id) ON DELETE SET NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS manager_employee_id VARCHAR(64) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS work_email TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS personal_email TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS work_phone VARCHAR(32);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS personal_phone VARCHAR(32);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS address_en TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS address_ar TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS photo_path TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS archived_by TEXT;

-- 2. Employee Assignments Table (Organizational & Transfer History)
CREATE TABLE IF NOT EXISTS employee_assignments (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  department_id VARCHAR(64) REFERENCES departments(id) ON DELETE SET NULL,
  designation_id VARCHAR(64) REFERENCES designations(id) ON DELETE SET NULL,
  employee_category_id VARCHAR(64) REFERENCES employee_categories(id) ON DELETE SET NULL,
  business_unit_id VARCHAR(64) REFERENCES business_units(id) ON DELETE SET NULL,
  cost_center_id VARCHAR(64) REFERENCES cost_centers(id) ON DELETE SET NULL,
  manager_employee_id VARCHAR(64) REFERENCES employees(id) ON DELETE SET NULL,
  effective_from TIMESTAMP WITH TIME ZONE NOT NULL,
  effective_to TIMESTAMP WITH TIME ZONE,
  reason VARCHAR(64) NOT NULL DEFAULT 'JOINING',
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT
);

-- 3. Extend Employee Contracts Table
ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS probation_start_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS probation_end_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS working_days_per_week INTEGER DEFAULT 5;
ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS working_hours_per_day INTEGER DEFAULT 8;
ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS document_attachment_id TEXT;
ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- 4. Extend Employee Salaries / Salary Assignments Table
ALTER TABLE employee_salaries ADD COLUMN IF NOT EXISTS food_allowance TEXT DEFAULT '0.000';
ALTER TABLE employee_salaries ADD COLUMN IF NOT EXISTS effective_to TIMESTAMP WITH TIME ZONE;
ALTER TABLE employee_salaries ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE employee_salaries ADD COLUMN IF NOT EXISTS created_by TEXT;

-- 5. Extend Employee Bank Details Table
ALTER TABLE employee_bank_details ADD COLUMN IF NOT EXISTS bank_id VARCHAR(64) REFERENCES banks(id) ON DELETE SET NULL;
ALTER TABLE employee_bank_details ADD COLUMN IF NOT EXISTS account_name TEXT;
ALTER TABLE employee_bank_details ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'KWD';
ALTER TABLE employee_bank_details ADD COLUMN IF NOT EXISTS effective_from TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE employee_bank_details ADD COLUMN IF NOT EXISTS effective_to TIMESTAMP WITH TIME ZONE;
ALTER TABLE employee_bank_details ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE employee_bank_details ADD COLUMN IF NOT EXISTS created_by TEXT;

-- 6. Extend Employee Documents Table
ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS document_type_id VARCHAR(64) REFERENCES document_types(id) ON DELETE SET NULL;
ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- 7. Employee Emergency Contacts Table
CREATE TABLE IF NOT EXISTS employee_emergency_contacts (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship VARCHAR(32) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  alternate_phone VARCHAR(32),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT
);

-- 8. Employee Dependents Table
CREATE TABLE IF NOT EXISTS employee_dependents (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  relationship VARCHAR(32) NOT NULL,
  date_of_birth TIMESTAMP WITH TIME ZONE,
  nationality_id INTEGER REFERENCES nationalities(id) ON DELETE SET NULL,
  document_number VARCHAR(64),
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT
);

-- Indexes for Fast Query Performance
CREATE INDEX IF NOT EXISTS idx_employees_tenant_number ON employees (tenant_id, employee_number);
CREATE INDEX IF NOT EXISTS idx_employees_tenant_status ON employees (tenant_id, employment_status);
CREATE INDEX IF NOT EXISTS idx_employees_tenant_branch ON employees (tenant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_employees_tenant_dept ON employees (tenant_id, department_id);
CREATE INDEX IF NOT EXISTS idx_employees_tenant_desig ON employees (tenant_id, designation_id);
CREATE INDEX IF NOT EXISTS idx_employee_docs_tenant_expiry ON employee_documents (tenant_id, expiry_date);
CREATE INDEX IF NOT EXISTS idx_employee_contracts_tenant_status ON employee_contracts (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_employee_assignments_emp_status ON employee_assignments (employee_id, status);

-- Seed Additional Granular Permissions for People Module
INSERT INTO permissions (id, code, module, resource, action, name_en, name_ar, description_en, description_ar) VALUES
  ('perm_people_create', 'people.create', 'people', 'employee', 'create', 'Create Employee', 'إنشاء موظف', 'Create new employee records', 'إضافة سجلات موظفين جديدة'),
  ('perm_people_edit', 'people.edit', 'people', 'employee', 'edit', 'Edit Employee', 'تعديل موظف', 'Update existing employee records', 'تعديل بيانات الموظفين الحالية'),
  ('perm_people_archive', 'people.archive', 'people', 'employee', 'archive', 'Archive Employee', 'أرشفة موظف', 'Archive employee profiles', 'أرشفة ملفات الموظفين'),
  ('perm_people_delete', 'people.delete', 'people', 'employee', 'delete', 'Delete Employee', 'حذف موظف', 'Safely delete unreferenced employee records', 'حذف سجل الموظف غير المرتبط ببيانات معالجة'),
  ('perm_people_personal_view', 'people.personal.view', 'people', 'personal', 'view', 'View Personal Data', 'عرض البيانات الشخصية', 'View sensitive personal details', 'عرض المعلومات الشخصية الحساسة'),
  ('perm_people_document_view', 'people.document.view', 'people', 'document', 'view', 'View Employee Documents', 'عرض مستندات الموظف', 'View employee identity and contract documents', 'عرض وثائق هويات وعقود الموظف'),
  ('perm_people_document_manage', 'people.document.manage', 'people', 'document', 'manage', 'Manage Employee Documents', 'إدارة مستندات الموظف', 'Upload and manage employee documents', 'إضافة وتحديث مستندات الموظف'),
  ('perm_people_contract_view', 'people.contract.view', 'people', 'contract', 'view', 'View Employee Contracts', 'عرض عقود الموظفين', 'View employment contracts and probation terms', 'عرض عقود العمل والمدد التجريبية'),
  ('perm_people_contract_manage', 'people.contract.manage', 'people', 'contract', 'manage', 'Manage Employee Contracts', 'إدارة عقود الموظفين', 'Create and renew employment contracts', 'إنشاء وتجديد عقود العمل'),
  ('perm_people_bank_view', 'people.bank.view', 'people', 'bank', 'view', 'View Bank Details', 'عرض الحسابات البنكية', 'View employee bank accounts and IBAN', 'عرض الحسابات البنكية والآيبان للموظف'),
  ('perm_people_bank_manage', 'people.bank.manage', 'people', 'bank', 'manage', 'Manage Bank Details', 'إدارة الحسابات البنكية', 'Create and update bank accounts', 'إضافة وتحديث الحسابات البنكية للموظف'),
  ('perm_people_salary_manage', 'people.salary.manage', 'people', 'salary', 'manage', 'Manage Employee Salary', 'إدارة رواتب الموظفين', 'Update employee basic salary and allowances', 'تعديل الراتب الأساسي والبدلات للموظف'),
  ('perm_people_history_view', 'people.history.view', 'people', 'history', 'view', 'View Employment History', 'عرض السجل الوظيفي', 'View transfers, promotions, and status audit history', 'عرض سجل التنقلات والترقيات'),
  ('perm_people_export', 'people.export', 'people', 'employee', 'export', 'Export Employee Data', 'تصدير بيانات الموظفين', 'Export employee list and reports to PDF/Excel', 'تصدير القوائم والتقارير إلى ملفات إكسل وبي دي إف'),
  ('perm_people_idcard_generate', 'people.idcard.generate', 'people', 'idcard', 'generate', 'Generate Employee ID Card', 'توليد بطاقة العمل', 'Generate official printable PDF ID Cards', 'توليد وطباعة بطاقة التعريف الوظيفية')
ON CONFLICT (code) DO NOTHING;

-- Map Company Admin and HR Manager Permissions for new keys
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role_company_admin', id FROM permissions WHERE code LIKE 'people.%'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role_hr_manager', id FROM permissions WHERE code LIKE 'people.%'
ON CONFLICT DO NOTHING;
