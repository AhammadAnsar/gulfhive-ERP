-- GulfHive ERP - Production Payroll Engine Migration
-- Migration: 0008_payroll_engine_production.sql

-- 1. Payroll Periods Table
CREATE TABLE IF NOT EXISTS payroll_periods (
  id VARCHAR(64) PRIMARY KEY,
  numeric_id SERIAL UNIQUE,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_number VARCHAR(64) NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  period_start VARCHAR(10) NOT NULL,
  period_end VARCHAR(10) NOT NULL,
  payment_date VARCHAR(10),
  fiscal_year_id VARCHAR(64) REFERENCES fiscal_years(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN', -- OPEN, PROCESSING, REVIEW, AWAITING_APPROVAL, APPROVED, POSTED, PAID, CLOSED
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_by TEXT
);

-- 2. Configurable Salary Components Table
CREATE TABLE IF NOT EXISTS salary_components (
  id VARCHAR(64) PRIMARY KEY,
  numeric_id SERIAL UNIQUE,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(32) NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  component_type VARCHAR(32) NOT NULL DEFAULT 'EARNING', -- EARNING, DEDUCTION, EMPLOYER_CONTRIBUTION, INFORMATION
  calculation_type VARCHAR(32) NOT NULL DEFAULT 'FIXED', -- FIXED, PERCENTAGE, FORMULA, INPUT
  formula_expression TEXT,
  affects_gross BOOLEAN NOT NULL DEFAULT true,
  affects_net BOOLEAN NOT NULL DEFAULT true,
  affects_overtime_base BOOLEAN NOT NULL DEFAULT false,
  affects_eos_base BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 3. Salary Structures Table
CREATE TABLE IF NOT EXISTS salary_structures (
  id VARCHAR(64) PRIMARY KEY,
  numeric_id SERIAL UNIQUE,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(32) NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  effective_from VARCHAR(10) NOT NULL DEFAULT '2020-01-01',
  effective_to VARCHAR(10),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 4. Salary Structure Components Table
CREATE TABLE IF NOT EXISTS salary_structure_components (
  id VARCHAR(64) PRIMARY KEY,
  numeric_id SERIAL UNIQUE,
  salary_structure_id VARCHAR(64) NOT NULL REFERENCES salary_structures(id) ON DELETE CASCADE,
  salary_component_id VARCHAR(64) NOT NULL REFERENCES salary_components(id) ON DELETE CASCADE,
  calculation_method VARCHAR(32) NOT NULL DEFAULT 'FIXED', -- FIXED, PERCENTAGE, FORMULA
  value_expression TEXT NOT NULL DEFAULT '0',
  display_order INTEGER NOT NULL DEFAULT 0
);

-- 5. Enhance employee_salaries Table for Structure and Effective Dating
ALTER TABLE employee_salaries ADD COLUMN IF NOT EXISTS numeric_id SERIAL;
ALTER TABLE employee_salaries ADD COLUMN IF NOT EXISTS salary_structure_id VARCHAR(64) REFERENCES salary_structures(id) ON DELETE SET NULL;
ALTER TABLE employee_salaries ADD COLUMN IF NOT EXISTS proration_policy VARCHAR(32) DEFAULT 'CALENDAR_DAYS';

-- 6. Enhance payroll_runs Table
ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS numeric_id SERIAL;
ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS payroll_period_id VARCHAR(64) REFERENCES payroll_periods(id) ON DELETE SET NULL;
ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS payroll_number VARCHAR(64);
ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS run_type VARCHAR(32) DEFAULT 'REGULAR' NOT NULL; -- REGULAR, SUPPLEMENTARY, ADJUSTMENT, FINAL_SETTLEMENT
ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS rule_snapshot_version VARCHAR(32) DEFAULT '1.0' NOT NULL;
ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS calculation_version VARCHAR(32) DEFAULT '1.0' NOT NULL;
ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS calculation_trace JSONB;
ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS posted_by TEXT;
ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS posted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS reversal_reason TEXT;
ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS reversed_by TEXT;
ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMP WITH TIME ZONE;

-- 7. Enhance payroll_items Table
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS numeric_id SERIAL;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS exception_count INTEGER DEFAULT 0 NOT NULL;

-- 8. Payroll Result Lines Table (Individual Line Item Audit & Traceability)
CREATE TABLE IF NOT EXISTS payroll_result_lines (
  id VARCHAR(64) PRIMARY KEY,
  numeric_id SERIAL UNIQUE,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payroll_run_id VARCHAR(64) NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  payroll_item_id VARCHAR(64) NOT NULL REFERENCES payroll_items(id) ON DELETE CASCADE,
  salary_component_id VARCHAR(64),
  component_code_snapshot VARCHAR(32) NOT NULL,
  component_name_snapshot TEXT NOT NULL,
  line_type VARCHAR(32) NOT NULL, -- EARNING, DEDUCTION, EMPLOYER_CONTRIBUTION, INFORMATION
  quantity TEXT,
  rate TEXT,
  amount TEXT NOT NULL,
  source_type VARCHAR(32) NOT NULL DEFAULT 'CONTRACT', -- CONTRACT, TIME, LEAVE, OVERTIME, ADJUSTMENT, LOAN, STATUTORY, FORMULA
  source_id VARCHAR(64),
  calculation_rule_reference TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 9. Payroll Adjustments Table (Bonuses, Commissions, Manual Deductions)
CREATE TABLE IF NOT EXISTS payroll_adjustments (
  id VARCHAR(64) PRIMARY KEY,
  numeric_id SERIAL UNIQUE,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  payroll_period_id VARCHAR(64) REFERENCES payroll_periods(id) ON DELETE SET NULL,
  salary_component_id VARCHAR(64) REFERENCES salary_components(id) ON DELETE SET NULL,
  type VARCHAR(32) NOT NULL DEFAULT 'BONUS', -- BONUS, COMMISSION, CORRECTION, REIMBURSEMENT, DEDUCTION, PENALTY, OTHER
  amount TEXT NOT NULL,
  quantity TEXT,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, PROCESSED
  effective_date VARCHAR(10) NOT NULL,
  created_by TEXT,
  approved_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 10. Loan Repayment Transactions Table (Immutable Financial Ledger for Loan Deductions)
CREATE TABLE IF NOT EXISTS loan_repayment_transactions (
  id VARCHAR(64) PRIMARY KEY,
  numeric_id SERIAL UNIQUE,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  loan_id VARCHAR(64) NOT NULL REFERENCES employee_loans(id) ON DELETE CASCADE,
  payroll_run_id VARCHAR(64) REFERENCES payroll_runs(id) ON DELETE SET NULL,
  payroll_item_id VARCHAR(64) REFERENCES payroll_items(id) ON DELETE SET NULL,
  amount TEXT NOT NULL,
  transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  remaining_balance_after TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 11. Versioned Country Compliance Statutory Rules Table
CREATE TABLE IF NOT EXISTS statutory_rules (
  id VARCHAR(64) PRIMARY KEY,
  numeric_id SERIAL UNIQUE,
  country_code VARCHAR(2) NOT NULL,
  rule_type VARCHAR(32) NOT NULL, -- PIFSS, GOSI, OVERTIME, EOSB
  version VARCHAR(32) NOT NULL,
  effective_from VARCHAR(10) NOT NULL,
  effective_to VARCHAR(10),
  parameters JSONB NOT NULL,
  source_reference TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 12. Payroll Exceptions Table (Pre-Calculation & Approval Validation Findings)
CREATE TABLE IF NOT EXISTS payroll_exceptions (
  id VARCHAR(64) PRIMARY KEY,
  numeric_id SERIAL UNIQUE,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payroll_run_id VARCHAR(64) NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id VARCHAR(64) REFERENCES employees(id) ON DELETE CASCADE,
  severity VARCHAR(20) NOT NULL DEFAULT 'WARNING', -- BLOCKING, WARNING, INFO
  code VARCHAR(64) NOT NULL,
  message_en TEXT NOT NULL,
  message_ar TEXT NOT NULL,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indices for Production Performance
CREATE INDEX IF NOT EXISTS idx_payroll_periods_tenant_date ON payroll_periods(tenant_id, year, month);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_tenant_period ON payroll_runs(tenant_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_payroll_items_run_emp ON payroll_items(payroll_run_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_result_lines_item ON payroll_result_lines(payroll_item_id);
CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_emp ON payroll_adjustments(tenant_id, employee_id, status);
CREATE INDEX IF NOT EXISTS idx_loan_tx_loan ON loan_repayment_transactions(loan_id);
CREATE INDEX IF NOT EXISTS idx_statutory_rules_lookup ON statutory_rules(country_code, rule_type, status);
