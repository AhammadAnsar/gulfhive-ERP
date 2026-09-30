-- GulfHive ERP Migration 0009: Sales, Receivables & Customer Invoicing Schema Parity
-- Creates Clients, Client Contacts, Client Sites, Tax Codes, Quotations, Sales Orders, Deliveries, Invoices, Credit Notes, Receipts, and Receipt Allocations.

-- 1. Clients
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(32) NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  email TEXT,
  phone TEXT,
  website TEXT,
  cr_number TEXT,
  payment_terms_id VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_by TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by TEXT,
  delete_reason TEXT,
  CONSTRAINT uk_clients_tenant_code UNIQUE (tenant_id, code)
);

-- 2. Client Contacts
CREATE TABLE IF NOT EXISTS client_contacts (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  is_primary BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 3. Client Sites
CREATE TABLE IF NOT EXISTS client_sites (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  address_en TEXT,
  address_ar TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 4. Tax Codes
CREATE TABLE IF NOT EXISTS tax_codes (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(32) NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  rate TEXT NOT NULL,
  calculation_method VARCHAR(32) NOT NULL DEFAULT 'PERCENTAGE',
  effective_from VARCHAR(10) NOT NULL,
  effective_to VARCHAR(10),
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT uk_tax_codes_tenant_code UNIQUE (tenant_id, code)
);

-- 5. Quotations
CREATE TABLE IF NOT EXISTS quotations (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  quotation_number VARCHAR(64) NOT NULL,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  client_contact_id INTEGER REFERENCES client_contacts(id) ON DELETE SET NULL,
  client_site_id INTEGER REFERENCES client_sites(id) ON DELETE SET NULL,
  quotation_date VARCHAR(10) NOT NULL,
  valid_until VARCHAR(10),
  currency VARCHAR(3) NOT NULL,
  payment_terms TEXT,
  reference TEXT,
  subject TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  subtotal TEXT NOT NULL,
  discount_total TEXT NOT NULL DEFAULT '0.000',
  tax_total TEXT NOT NULL DEFAULT '0.000',
  grand_total TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by TEXT,
  delete_reason TEXT,
  CONSTRAINT uk_quotations_tenant_num UNIQUE (tenant_id, quotation_number)
);

-- 6. Quotation Lines
CREATE TABLE IF NOT EXISTS quotation_lines (
  id SERIAL PRIMARY KEY,
  quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  item_id VARCHAR(64),
  description TEXT NOT NULL,
  quantity TEXT NOT NULL,
  unit VARCHAR(32),
  unit_price TEXT NOT NULL,
  discount_type VARCHAR(32),
  discount_value TEXT DEFAULT '0.000',
  tax_code_id INTEGER REFERENCES tax_codes(id) ON DELETE SET NULL,
  line_subtotal TEXT NOT NULL,
  discount_amount TEXT NOT NULL DEFAULT '0.000',
  tax_amount TEXT NOT NULL DEFAULT '0.000',
  line_total TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- 7. Sales Orders
CREATE TABLE IF NOT EXISTS sales_orders (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  sales_order_number VARCHAR(64) NOT NULL,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  quotation_id INTEGER REFERENCES quotations(id) ON DELETE SET NULL,
  order_date VARCHAR(10) NOT NULL,
  expected_delivery_date VARCHAR(10),
  currency VARCHAR(3) NOT NULL,
  payment_terms TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  subtotal TEXT NOT NULL,
  discount_total TEXT NOT NULL DEFAULT '0.000',
  tax_total TEXT NOT NULL DEFAULT '0.000',
  grand_total TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_by TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by TEXT,
  delete_reason TEXT,
  CONSTRAINT uk_sales_orders_tenant_num UNIQUE (tenant_id, sales_order_number)
);

-- 8. Sales Order Lines
CREATE TABLE IF NOT EXISTS sales_order_lines (
  id SERIAL PRIMARY KEY,
  sales_order_id INTEGER NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  item_id VARCHAR(64),
  description TEXT NOT NULL,
  quantity TEXT NOT NULL,
  delivered_quantity TEXT NOT NULL DEFAULT '0.000',
  invoiced_quantity TEXT NOT NULL DEFAULT '0.000',
  unit VARCHAR(32),
  unit_price TEXT NOT NULL,
  discount_type VARCHAR(32),
  discount_value TEXT DEFAULT '0.000',
  tax_code_id INTEGER REFERENCES tax_codes(id) ON DELETE SET NULL,
  line_subtotal TEXT NOT NULL,
  discount_amount TEXT NOT NULL DEFAULT '0.000',
  tax_amount TEXT NOT NULL DEFAULT '0.000',
  line_total TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- 9. Deliveries
CREATE TABLE IF NOT EXISTS deliveries (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  delivery_number VARCHAR(64) NOT NULL,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  sales_order_id INTEGER REFERENCES sales_orders(id) ON DELETE SET NULL,
  delivery_date VARCHAR(10) NOT NULL,
  client_site_id INTEGER REFERENCES client_sites(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  received_by TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_by TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by TEXT,
  delete_reason TEXT,
  CONSTRAINT uk_deliveries_tenant_num UNIQUE (tenant_id, delivery_number)
);

-- 10. Delivery Lines
CREATE TABLE IF NOT EXISTS delivery_lines (
  id SERIAL PRIMARY KEY,
  delivery_id INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  sales_order_line_id INTEGER REFERENCES sales_order_lines(id) ON DELETE SET NULL,
  item_id VARCHAR(64),
  description TEXT NOT NULL,
  quantity TEXT NOT NULL,
  unit VARCHAR(32),
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- 11. Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  invoice_number VARCHAR(64) NOT NULL,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  sales_order_id INTEGER REFERENCES sales_orders(id) ON DELETE SET NULL,
  delivery_id INTEGER REFERENCES deliveries(id) ON DELETE SET NULL,
  invoice_date VARCHAR(10) NOT NULL,
  due_date VARCHAR(10) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  payment_terms TEXT,
  client_reference TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  subtotal TEXT NOT NULL,
  discount_total TEXT NOT NULL DEFAULT '0.000',
  tax_total TEXT NOT NULL DEFAULT '0.000',
  rounding_adjustment TEXT NOT NULL DEFAULT '0.000',
  grand_total TEXT NOT NULL,
  paid_amount TEXT NOT NULL DEFAULT '0.000',
  outstanding_amount TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by TEXT,
  posted_at TIMESTAMP WITH TIME ZONE,
  posted_by TEXT,
  voided_at TIMESTAMP WITH TIME ZONE,
  voided_by TEXT,
  void_reason TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by TEXT,
  delete_reason TEXT,
  CONSTRAINT uk_invoices_tenant_num UNIQUE (tenant_id, invoice_number)
);

-- 12. Invoice Lines
CREATE TABLE IF NOT EXISTS invoice_lines (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  source_line_type VARCHAR(32),
  source_line_id INTEGER,
  item_id VARCHAR(64),
  description TEXT NOT NULL,
  quantity TEXT NOT NULL,
  unit VARCHAR(32),
  unit_price TEXT NOT NULL,
  discount_type VARCHAR(32),
  discount_value TEXT DEFAULT '0.000',
  tax_code_id INTEGER REFERENCES tax_codes(id) ON DELETE SET NULL,
  line_subtotal TEXT NOT NULL,
  discount_amount TEXT NOT NULL DEFAULT '0.000',
  tax_amount TEXT NOT NULL DEFAULT '0.000',
  line_total TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- 13. Credit Notes
CREATE TABLE IF NOT EXISTS credit_notes (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  credit_note_number VARCHAR(64) NOT NULL,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
  credit_note_date VARCHAR(10) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  subtotal TEXT NOT NULL,
  tax_total TEXT NOT NULL DEFAULT '0.000',
  grand_total TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_by TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by TEXT,
  delete_reason TEXT,
  CONSTRAINT uk_credit_notes_tenant_num UNIQUE (tenant_id, credit_note_number)
);

-- 14. Credit Note Lines
CREATE TABLE IF NOT EXISTS credit_note_lines (
  id SERIAL PRIMARY KEY,
  credit_note_id INTEGER NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity TEXT NOT NULL,
  unit_price TEXT NOT NULL,
  tax_code_id INTEGER REFERENCES tax_codes(id) ON DELETE SET NULL,
  line_subtotal TEXT NOT NULL,
  tax_amount TEXT NOT NULL DEFAULT '0.000',
  line_total TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- 15. Receipts
CREATE TABLE IF NOT EXISTS receipts (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  receipt_number VARCHAR(64) NOT NULL,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  receipt_date VARCHAR(10) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  payment_method VARCHAR(32) NOT NULL DEFAULT 'CASH',
  bank_account_id VARCHAR(64),
  reference_number TEXT,
  amount TEXT NOT NULL,
  unallocated_amount TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_by TEXT,
  posted_at TIMESTAMP WITH TIME ZONE,
  posted_by TEXT,
  voided_at TIMESTAMP WITH TIME ZONE,
  voided_by TEXT,
  void_reason TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by TEXT,
  delete_reason TEXT,
  CONSTRAINT uk_receipts_tenant_num UNIQUE (tenant_id, receipt_number)
);

-- 16. Receipt Allocations
CREATE TABLE IF NOT EXISTS receipt_allocations (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  receipt_id INTEGER REFERENCES receipts(id) ON DELETE CASCADE,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
  credit_note_id INTEGER REFERENCES credit_notes(id) ON DELETE CASCADE,
  allocated_amount TEXT NOT NULL,
  allocation_date VARCHAR(10) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT
);
