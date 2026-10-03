-- GulfHive ERP Initial Baseline Schema Migration
-- Migration: 0001_initial_core_schema.sql
-- Applies: Tenants, Users, Compliance Rules, Audit Logs, and Schema Migrations

CREATE TABLE IF NOT EXISTS tenants (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(32) NOT NULL UNIQUE,
  legal_name_en TEXT NOT NULL,
  legal_name_ar TEXT NOT NULL,
  country_code VARCHAR(2) NOT NULL,
  base_currency VARCHAR(3) NOT NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kuwait',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS branches (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(32) NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  is_main BOOLEAN NOT NULL DEFAULT false,
  city_en TEXT,
  city_ar TEXT,
  address_en TEXT,
  address_ar TEXT,
  phone VARCHAR(32),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT uk_branches_tenant_code UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  display_name TEXT,
  role VARCHAR(32) NOT NULL DEFAULT 'VIEWER',
  tenant_id VARCHAR(64) REFERENCES tenants(id) ON DELETE SET NULL,
  preferred_language VARCHAR(2) NOT NULL DEFAULT 'en',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS compliance_rules (
  id VARCHAR(64) PRIMARY KEY,
  country VARCHAR(2) NOT NULL,
  category VARCHAR(64) NOT NULL,
  version INTEGER NOT NULL,
  effective_from TIMESTAMP WITH TIME ZONE NOT NULL,
  effective_to TIMESTAMP WITH TIME ZONE,
  parameters JSONB NOT NULL,
  calculation_method TEXT NOT NULL,
  legal_reference TEXT NOT NULL,
  approval_status VARCHAR(32) NOT NULL DEFAULT 'APPROVED',
  approved_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_compliance_country_category ON compliance_rules (country, category, version);
CREATE INDEX IF NOT EXISTS idx_compliance_effective_dates ON compliance_rules (country, category, effective_from, effective_to);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) REFERENCES tenants(id) ON DELETE SET NULL,
  actor_id TEXT NOT NULL,
  actor_email TEXT,
  action VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id TEXT NOT NULL,
  previous_state JSONB,
  resulting_state JSONB,
  ip_address TEXT,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_timestamp ON audit_logs (tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  execution_time_ms INTEGER NOT NULL
);
