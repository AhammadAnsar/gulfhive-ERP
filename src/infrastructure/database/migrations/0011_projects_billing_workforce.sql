-- GulfHive ERP Migration 0011: Projects, Billing Profiles, External Workforce & Deployments Schema Parity
-- Creates Billing Profiles, Billing Authorizations, Projects, Project Contracts, Project Sites, Project Activities, Project Budgets, External Workers, Workforce Supplier Agreements, Rate Cards, Workforce Deployments, External Labour Settlements & Settlement Lines.

-- 1. Billing Profiles
CREATE TABLE IF NOT EXISTS billing_profiles (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_code VARCHAR(64) NOT NULL,
  profile_name VARCHAR(255) NOT NULL,
  is_operating_company BOOLEAN NOT NULL DEFAULT FALSE,
  principal_supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  principal_client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  legal_name_en TEXT NOT NULL,
  legal_name_ar TEXT NOT NULL,
  trade_name_en TEXT,
  trade_name_ar TEXT,
  cr_number VARCHAR(64),
  license_number VARCHAR(64),
  vat_number VARCHAR(64),
  phone VARCHAR(32),
  email VARCHAR(255),
  address_en TEXT,
  address_ar TEXT,
  bank_name VARCHAR(255),
  iban VARCHAR(64),
  swift_code VARCHAR(32),
  signatory_name VARCHAR(255),
  signatory_title VARCHAR(255),
  logo_url TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  effective_from VARCHAR(10) NOT NULL,
  effective_to VARCHAR(10),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_by TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by TEXT
);

-- 2. Billing Authorizations
CREATE TABLE IF NOT EXISTS billing_authorizations (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  billing_profile_id INTEGER NOT NULL REFERENCES billing_profiles(id) ON DELETE CASCADE,
  authorization_reference VARCHAR(128) NOT NULL,
  effective_from VARCHAR(10) NOT NULL,
  effective_to VARCHAR(10) NOT NULL,
  document_reference TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'APPROVED',
  approved_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_by TEXT
);

-- 3. Projects
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE RESTRICT,
  project_code VARCHAR(64) NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  project_type VARCHAR(64) NOT NULL DEFAULT 'General Contract',
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  principal_supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  billing_profile_id INTEGER NOT NULL REFERENCES billing_profiles(id) ON DELETE RESTRICT,
  contract_reference VARCHAR(128),
  principal_reference VARCHAR(128),
  primary_site_id INTEGER REFERENCES client_sites(id) ON DELETE SET NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'KWD',
  contract_value TEXT NOT NULL DEFAULT '0.000',
  billing_method VARCHAR(64) NOT NULL DEFAULT 'FIXED_CONTRACT',
  start_date VARCHAR(10) NOT NULL,
  planned_end_date VARCHAR(10),
  actual_end_date VARCHAR(10),
  project_manager_employee_id VARCHAR(64) REFERENCES employees(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_by TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by TEXT,
  delete_reason TEXT,
  CONSTRAINT uk_projects_tenant_code UNIQUE (tenant_id, project_code)
);

-- 4. Project Contracts
CREATE TABLE IF NOT EXISTS project_contracts (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contract_number VARCHAR(64) NOT NULL,
  contract_type VARCHAR(64) NOT NULL,
  client_id INTEGER REFERENCES clients(id) ON DELETE RESTRICT,
  principal_supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  contract_date VARCHAR(10) NOT NULL,
  effective_from VARCHAR(10) NOT NULL,
  effective_to VARCHAR(10),
  contract_value TEXT NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'KWD',
  billing_method VARCHAR(64) NOT NULL DEFAULT 'FIXED_CONTRACT',
  payment_terms TEXT,
  retention_percentage TEXT DEFAULT '0.00',
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  version INTEGER NOT NULL DEFAULT 1,
  document_attachment_id TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_by TEXT
);

-- 5. Project Sites
CREATE TABLE IF NOT EXISTS project_sites (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_site_id INTEGER NOT NULL REFERENCES client_sites(id) ON DELETE RESTRICT,
  site_code VARCHAR(64),
  start_date VARCHAR(10),
  end_date VARCHAR(10),
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  site_supervisor_employee_id VARCHAR(64) REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_by TEXT
);

-- 6. Project Activities
CREATE TABLE IF NOT EXISTS project_activities (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  code VARCHAR(64) NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT
);

-- 7. Project Budgets
CREATE TABLE IF NOT EXISTS project_budgets (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  budget_category VARCHAR(64) NOT NULL,
  allocated_amount TEXT NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'KWD',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT
);

-- 8. External Workers
CREATE TABLE IF NOT EXISTS external_workers (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  worker_code VARCHAR(64) NOT NULL,
  source_supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  name_en TEXT NOT NULL,
  name_ar TEXT,
  nationality_id INTEGER REFERENCES nationalities(id) ON DELETE SET NULL,
  profession VARCHAR(128) NOT NULL,
  phone VARCHAR(32),
  identity_document_type VARCHAR(64),
  identity_document_number VARCHAR(64),
  default_rate TEXT DEFAULT '0.000',
  rate_type VARCHAR(32) NOT NULL DEFAULT 'HOURLY',
  currency VARCHAR(3) NOT NULL DEFAULT 'KWD',
  available_from VARCHAR(10),
  available_to VARCHAR(10),
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_by TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by TEXT,
  delete_reason TEXT,
  CONSTRAINT uk_external_workers_tenant_code UNIQUE (tenant_id, worker_code)
);

-- 9. Workforce Supplier Agreements
CREATE TABLE IF NOT EXISTS workforce_supplier_agreements (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  agreement_number VARCHAR(64) NOT NULL,
  effective_from VARCHAR(10) NOT NULL,
  effective_to VARCHAR(10),
  currency VARCHAR(3) NOT NULL DEFAULT 'KWD',
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT
);

-- 10. Workforce Rate Cards
CREATE TABLE IF NOT EXISTS workforce_rate_cards (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agreement_id INTEGER NOT NULL REFERENCES workforce_supplier_agreements(id) ON DELETE CASCADE,
  profession VARCHAR(128) NOT NULL,
  rate_type VARCHAR(32) NOT NULL DEFAULT 'HOURLY',
  standard_rate TEXT NOT NULL,
  overtime_rate TEXT DEFAULT '0.000',
  effective_from VARCHAR(10) NOT NULL,
  effective_to VARCHAR(10),
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
);

-- 11. Workforce Deployments
CREATE TABLE IF NOT EXISTS workforce_deployments (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  project_site_id INTEGER REFERENCES project_sites(id) ON DELETE SET NULL,
  workforce_type VARCHAR(32) NOT NULL,
  employee_id VARCHAR(64) REFERENCES employees(id) ON DELETE SET NULL,
  external_worker_id INTEGER REFERENCES external_workers(id) ON DELETE SET NULL,
  position VARCHAR(128),
  shift_id VARCHAR(64) REFERENCES shifts(id) ON DELETE SET NULL,
  start_date VARCHAR(10) NOT NULL,
  end_date VARCHAR(10),
  deployment_type VARCHAR(64) NOT NULL DEFAULT 'REGULAR',
  rate_override TEXT,
  rate_type VARCHAR(32) DEFAULT 'HOURLY',
  currency VARCHAR(3) DEFAULT 'KWD',
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  assigned_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_by TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by TEXT,
  delete_reason TEXT
);

-- 12. External Labour Settlements
CREATE TABLE IF NOT EXISTS external_labour_settlements (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  settlement_number VARCHAR(64) NOT NULL,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  period_start VARCHAR(10) NOT NULL,
  period_end VARCHAR(10) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'KWD',
  total_approved_hours TEXT NOT NULL,
  total_amount TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  supplier_bill_id INTEGER REFERENCES supplier_bills(id) ON DELETE SET NULL,
  approved_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_by TEXT
);

-- 13. External Labour Settlement Lines
CREATE TABLE IF NOT EXISTS external_labour_settlement_lines (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  settlement_id INTEGER NOT NULL REFERENCES external_labour_settlements(id) ON DELETE CASCADE,
  external_worker_id INTEGER NOT NULL REFERENCES external_workers(id) ON DELETE RESTRICT,
  approved_hours TEXT NOT NULL,
  rate TEXT NOT NULL,
  line_total TEXT NOT NULL,
  timesheet_reference TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
