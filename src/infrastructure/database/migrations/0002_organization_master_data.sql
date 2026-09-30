-- GulfHive ERP Organization & Master Data Foundation
-- Migration: 0002_organization_master_data.sql
-- Applies: Employee Categories, Business Units, Cost Centers, Fiscal Years, Currencies, Countries, Nationalities, Banks, Payment Methods, Document Types, Document Sequences (Numbering Engine)

-- 1. Employee Categories Table
CREATE TABLE IF NOT EXISTS employee_categories (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(32) NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  description_en TEXT,
  description_ar TEXT,
  sort_order INTEGER DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_by TEXT,
  archived_at TIMESTAMP WITH TIME ZONE,
  archived_by TEXT,
  CONSTRAINT uk_employee_categories_tenant_code UNIQUE (tenant_id, code)
);

-- 2. Business Units Table
CREATE TABLE IF NOT EXISTS business_units (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(32) NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  description_en TEXT,
  description_ar TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_by TEXT,
  archived_at TIMESTAMP WITH TIME ZONE,
  archived_by TEXT,
  CONSTRAINT uk_business_units_tenant_code UNIQUE (tenant_id, code)
);

-- 3. Cost Centers Table
CREATE TABLE IF NOT EXISTS cost_centers (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  parent_cost_center_id VARCHAR(64) REFERENCES cost_centers(id) ON DELETE SET NULL,
  code VARCHAR(32) NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  description_en TEXT,
  description_ar TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_by TEXT,
  archived_at TIMESTAMP WITH TIME ZONE,
  archived_by TEXT,
  CONSTRAINT uk_cost_centers_tenant_code UNIQUE (tenant_id, code)
);

-- 4. Fiscal Years Table
CREATE TABLE IF NOT EXISTS fiscal_years (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(64) NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_by TEXT,
  CONSTRAINT uk_fiscal_years_tenant_name UNIQUE (tenant_id, name)
);

-- 5. Currencies Reference Table
CREATE TABLE IF NOT EXISTS currencies (
  id SERIAL PRIMARY KEY,
  iso_code VARCHAR(3) NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  symbol VARCHAR(16) NOT NULL,
  decimal_places INTEGER NOT NULL DEFAULT 2,
  rounding_mode VARCHAR(32) NOT NULL DEFAULT 'HALF_EVEN',
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
);

-- 6. Countries Reference Table
CREATE TABLE IF NOT EXISTS countries (
  id SERIAL PRIMARY KEY,
  iso2 VARCHAR(2) NOT NULL UNIQUE,
  iso3 VARCHAR(3) NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  phone_code VARCHAR(16),
  default_currency_code VARCHAR(3),
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
);

-- 7. Nationalities Reference Table
CREATE TABLE IF NOT EXISTS nationalities (
  id SERIAL PRIMARY KEY,
  code VARCHAR(32) NOT NULL UNIQUE,
  country_iso2 VARCHAR(2),
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
);

-- 8. Banks Table
CREATE TABLE IF NOT EXISTS banks (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) REFERENCES tenants(id) ON DELETE CASCADE,
  country_code VARCHAR(2),
  bank_code VARCHAR(32) NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  swift_code VARCHAR(32),
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_by TEXT
);

-- 9. Payment Methods Table
CREATE TABLE IF NOT EXISTS payment_methods (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(32) NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  payment_type VARCHAR(32) NOT NULL DEFAULT 'BANK_TRANSFER',
  sort_order INTEGER DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_by TEXT,
  CONSTRAINT uk_payment_methods_tenant_code UNIQUE (tenant_id, code)
);

-- 10. Document Types Table
CREATE TABLE IF NOT EXISTS document_types (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(32) NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  entity_scope VARCHAR(32) NOT NULL DEFAULT 'EMPLOYEE',
  requires_issue_date BOOLEAN NOT NULL DEFAULT false,
  requires_expiry_date BOOLEAN NOT NULL DEFAULT true,
  requires_document_number BOOLEAN NOT NULL DEFAULT true,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_by TEXT
);

-- 11. Document Sequences (Numbering Engine) Table
CREATE TABLE IF NOT EXISTS document_sequences (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_type VARCHAR(64) NOT NULL,
  prefix VARCHAR(32) NOT NULL DEFAULT '',
  suffix VARCHAR(32) NOT NULL DEFAULT '',
  separator VARCHAR(8) NOT NULL DEFAULT '-',
  include_year BOOLEAN NOT NULL DEFAULT true,
  include_month BOOLEAN NOT NULL DEFAULT false,
  padding_length INTEGER NOT NULL DEFAULT 5,
  next_number INTEGER NOT NULL DEFAULT 1,
  reset_policy VARCHAR(32) NOT NULL DEFAULT 'NEVER',
  fiscal_year_id VARCHAR(64) REFERENCES fiscal_years(id) ON DELETE SET NULL,
  branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_by TEXT,
  CONSTRAINT uk_doc_seq_tenant_type_scope UNIQUE (tenant_id, document_type, branch_id, fiscal_year_id)
);

-- Seed System Reference Currencies
INSERT INTO currencies (iso_code, name_en, name_ar, symbol, decimal_places, status) VALUES
  ('KWD', 'Kuwaiti Dinar', 'دينار كويتي', 'د.ك', 3, 'ACTIVE'),
  ('SAR', 'Saudi Riyal', 'ريال سعودي', 'ر.س', 2, 'ACTIVE'),
  ('AED', 'UAE Dirham', 'درهم إماراتي', 'د.إ', 2, 'ACTIVE'),
  ('BHD', 'Bahraini Dinar', 'دينار بحريني', 'د.ب', 3, 'ACTIVE'),
  ('OMR', 'Omani Rial', 'ريال عماني', 'ر.ع', 3, 'ACTIVE'),
  ('QAR', 'Qatari Riyal', 'ريال قطري', 'ر.ق', 2, 'ACTIVE'),
  ('USD', 'US Dollar', 'دولار أمريكي', '$', 2, 'ACTIVE'),
  ('EUR', 'Euro', 'يورو', '€', 2, 'ACTIVE')
ON CONFLICT (iso_code) DO NOTHING;

-- Seed System Reference Countries
INSERT INTO countries (iso2, iso3, name_en, name_ar, phone_code, default_currency_code) VALUES
  ('KW', 'KWT', 'Kuwait', 'الكويت', '+965', 'KWD'),
  ('SA', 'SAU', 'Saudi Arabia', 'المملكة العربية السعودية', '+966', 'SAR'),
  ('AE', 'ARE', 'United Arab Emirates', 'الإمارات العربية المتحدة', '+971', 'AED'),
  ('BH', 'BHR', 'Bahrain', 'البحرين', '+973', 'BHD'),
  ('OM', 'OMN', 'Oman', 'عمان', '+968', 'OMR'),
  ('QA', 'QAT', 'Qatar', 'قطر', '+974', 'QAR'),
  ('US', 'USA', 'United States', 'الولايات المتحدة الأمريكية', '+1', 'USD')
ON CONFLICT (iso2) DO NOTHING;

-- Seed System Reference Nationalities
INSERT INTO nationalities (code, country_iso2, name_en, name_ar) VALUES
  ('KW', 'KW', 'Kuwaiti', 'كويتي'),
  ('SA', 'SA', 'Saudi', 'سعودي'),
  ('AE', 'AE', 'Emirati', 'إماراتي'),
  ('BH', 'BH', 'Bahraini', 'بحريني'),
  ('OM', 'OM', 'Omani', 'عماني'),
  ('QA', 'QA', 'Qatari', 'قطري'),
  ('EG', 'EG', 'Egyptian', 'مصري'),
  ('IN', 'IN', 'Indian', 'هندي'),
  ('PK', 'PK', 'Pakistani', 'باكستاني'),
  ('JO', 'JO', 'Jordanian', 'أردني'),
  ('LB', 'LB', 'Lebanese', 'لبناني'),
  ('PH', 'PH', 'Filipino', 'فلبيني'),
  ('US', 'US', 'American', 'أمريكي'),
  ('GB', 'GB', 'British', 'بريطاني')
ON CONFLICT (code) DO NOTHING;
