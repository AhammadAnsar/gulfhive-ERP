-- GulfHive ERP Migration 0012: Row Level Security (RLS) Policy & Scoping Strategy
-- Enables PostgreSQL Row Level Security on core tenant-owned business tables as defense-in-depth.

DO $$
BEGIN
  -- 1. Enable RLS on Core Tenant Tables (non-fatal if non-owner user in managed environment)
  BEGIN
    ALTER TABLE IF EXISTS tenants ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS branches ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS departments ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS designations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS employee_categories ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS business_units ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS cost_centers ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS employees ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS clients ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS suppliers ENABLE ROW LEVEL SECURITY;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'RLS enable skipped due to privilege constraint: %', SQLERRM;
  END;

  -- 2. Define Permissive Policies based on Session Setting 'app.current_tenant_id'
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_employees') THEN
    CREATE POLICY tenant_isolation_employees ON employees
      FOR ALL
      USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.current_tenant_id', true) IS NULL
        OR current_setting('app.current_tenant_id', true) = ''
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_clients') THEN
    CREATE POLICY tenant_isolation_clients ON clients
      FOR ALL
      USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.current_tenant_id', true) IS NULL
        OR current_setting('app.current_tenant_id', true) = ''
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_suppliers') THEN
    CREATE POLICY tenant_isolation_suppliers ON suppliers
      FOR ALL
      USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.current_tenant_id', true) IS NULL
        OR current_setting('app.current_tenant_id', true) = ''
      );
  END IF;
END $$;
