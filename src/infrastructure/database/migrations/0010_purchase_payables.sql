-- GulfHive ERP Migration 0010: Purchase, Procurement & Payables Schema Parity
-- Creates Suppliers, Purchase Requests, RFQs, Supplier Quotations, Purchase Orders, Goods Receipts, Purchase Returns, Supplier Bills, Supplier Credits, Supplier Payments, and Allocations.

-- 1. Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(32) NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  website TEXT,
  cr_number TEXT,
  vat_number TEXT,
  payment_terms_id VARCHAR(64) DEFAULT '30 Days',
  currency VARCHAR(3) NOT NULL DEFAULT 'KWD',
  bank_name TEXT,
  bank_iban TEXT,
  bank_swift TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_by TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by TEXT,
  delete_reason TEXT,
  CONSTRAINT uk_suppliers_tenant_code UNIQUE (tenant_id, code)
);

-- 2. Purchase Requests
CREATE TABLE IF NOT EXISTS purchase_requests (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  request_number VARCHAR(64) NOT NULL,
  request_date VARCHAR(10) NOT NULL,
  requested_by_employee_id VARCHAR(64) REFERENCES employees(id) ON DELETE SET NULL,
  department_id VARCHAR(64) REFERENCES departments(id) ON DELETE SET NULL,
  cost_center_id VARCHAR(64) REFERENCES cost_centers(id) ON DELETE SET NULL,
  project_id VARCHAR(64),
  required_date VARCHAR(10),
  priority VARCHAR(32) NOT NULL DEFAULT 'MEDIUM',
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  purpose TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_by TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by TEXT,
  delete_reason TEXT,
  CONSTRAINT uk_purchase_requests_tenant_num UNIQUE (tenant_id, request_number)
);

-- 3. Purchase Request Lines
CREATE TABLE IF NOT EXISTS purchase_request_lines (
  id SERIAL PRIMARY KEY,
  purchase_request_id INTEGER NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  item_id VARCHAR(64),
  description TEXT NOT NULL,
  quantity TEXT NOT NULL,
  unit_id VARCHAR(32),
  estimated_unit_cost TEXT,
  required_date VARCHAR(10),
  cost_center_id VARCHAR(64) REFERENCES cost_centers(id) ON DELETE SET NULL,
  project_id VARCHAR(64),
  notes TEXT
);

-- 4. RFQs
CREATE TABLE IF NOT EXISTS rfqs (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  rfq_number VARCHAR(64) NOT NULL,
  rfq_date VARCHAR(10) NOT NULL,
  response_deadline VARCHAR(10) NOT NULL,
  purchase_request_id INTEGER REFERENCES purchase_requests(id) ON DELETE SET NULL,
  instructions TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_by TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by TEXT,
  delete_reason TEXT,
  CONSTRAINT uk_rfqs_tenant_num UNIQUE (tenant_id, rfq_number)
);

-- 5. RFQ Suppliers
CREATE TABLE IF NOT EXISTS rfq_suppliers (
  id SERIAL PRIMARY KEY,
  rfq_id INTEGER NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 6. Supplier Quotations
CREATE TABLE IF NOT EXISTS supplier_quotations (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  rfq_id INTEGER REFERENCES rfqs(id) ON DELETE SET NULL,
  supplier_quote_number VARCHAR(64) NOT NULL,
  quote_date VARCHAR(10) NOT NULL,
  valid_until VARCHAR(10),
  currency VARCHAR(3) NOT NULL,
  payment_terms_id VARCHAR(64) DEFAULT '30 Days',
  delivery_time TEXT,
  subtotal TEXT NOT NULL,
  discount_total TEXT NOT NULL DEFAULT '0.000',
  tax_total TEXT NOT NULL DEFAULT '0.000',
  grand_total TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  selection_reason TEXT,
  selected_by TEXT,
  selected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by TEXT,
  delete_reason TEXT
);

-- 7. Supplier Quotation Lines
CREATE TABLE IF NOT EXISTS supplier_quotation_lines (
  id SERIAL PRIMARY KEY,
  supplier_quotation_id INTEGER NOT NULL REFERENCES supplier_quotations(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity TEXT NOT NULL,
  unit_price TEXT NOT NULL,
  discount TEXT NOT NULL DEFAULT '0.000',
  tax TEXT NOT NULL DEFAULT '0.000',
  total TEXT NOT NULL
);

-- 8. Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  purchase_order_number VARCHAR(64) NOT NULL,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  purchase_request_id INTEGER REFERENCES purchase_requests(id) ON DELETE SET NULL,
  rfq_id INTEGER REFERENCES rfqs(id) ON DELETE SET NULL,
  supplier_quotation_id INTEGER REFERENCES supplier_quotations(id) ON DELETE SET NULL,
  order_date VARCHAR(10) NOT NULL,
  expected_delivery_date VARCHAR(10),
  currency VARCHAR(3) NOT NULL,
  payment_terms_id VARCHAR(64) DEFAULT '30 Days',
  supplier_reference TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  subtotal TEXT NOT NULL,
  discount_total TEXT NOT NULL DEFAULT '0.000',
  tax_total TEXT NOT NULL DEFAULT '0.000',
  rounding_adjustment TEXT NOT NULL DEFAULT '0.000',
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
  CONSTRAINT uk_purchase_orders_tenant_num UNIQUE (tenant_id, purchase_order_number)
);

-- 9. Purchase Order Lines
CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id SERIAL PRIMARY KEY,
  purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  item_id VARCHAR(64),
  description TEXT NOT NULL,
  ordered_quantity TEXT NOT NULL,
  received_quantity TEXT NOT NULL DEFAULT '0.000',
  billed_quantity TEXT NOT NULL DEFAULT '0.000',
  returned_quantity TEXT NOT NULL DEFAULT '0.000',
  unit_price TEXT NOT NULL,
  discount TEXT NOT NULL DEFAULT '0.000',
  tax TEXT NOT NULL DEFAULT '0.000',
  total TEXT NOT NULL,
  project_id VARCHAR(64),
  cost_center_id VARCHAR(64) REFERENCES cost_centers(id) ON DELETE SET NULL
);

-- 10. Goods Receipts
CREATE TABLE IF NOT EXISTS goods_receipts (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  receipt_number VARCHAR(64) NOT NULL,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  receipt_date VARCHAR(10) NOT NULL,
  warehouse TEXT,
  site TEXT,
  project TEXT,
  supplier_delivery_note TEXT,
  received_by TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by TEXT,
  delete_reason TEXT,
  CONSTRAINT uk_goods_receipts_tenant_num UNIQUE (tenant_id, receipt_number)
);

-- 11. Goods Receipt Lines
CREATE TABLE IF NOT EXISTS goods_receipt_lines (
  id SERIAL PRIMARY KEY,
  goods_receipt_id INTEGER NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  purchase_order_line_id INTEGER REFERENCES purchase_order_lines(id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  ordered_quantity TEXT NOT NULL,
  previously_received_quantity TEXT NOT NULL DEFAULT '0.000',
  this_receipt_quantity TEXT NOT NULL,
  accepted_quantity TEXT NOT NULL,
  rejected_quantity TEXT NOT NULL DEFAULT '0.000'
);

-- 12. Purchase Returns
CREATE TABLE IF NOT EXISTS purchase_returns (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  return_number VARCHAR(64) NOT NULL,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  goods_receipt_id INTEGER REFERENCES goods_receipts(id) ON DELETE RESTRICT,
  return_date VARCHAR(10) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by TEXT,
  delete_reason TEXT,
  CONSTRAINT uk_purchase_returns_tenant_num UNIQUE (tenant_id, return_number)
);

-- 13. Purchase Return Lines
CREATE TABLE IF NOT EXISTS purchase_return_lines (
  id SERIAL PRIMARY KEY,
  purchase_return_id INTEGER NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
  purchase_order_line_id INTEGER REFERENCES purchase_order_lines(id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  returned_quantity TEXT NOT NULL
);

-- 14. Supplier Bills
CREATE TABLE IF NOT EXISTS supplier_bills (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  bill_number VARCHAR(64) NOT NULL,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  supplier_invoice_number VARCHAR(64) NOT NULL,
  purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  goods_receipt_id INTEGER REFERENCES goods_receipts(id) ON DELETE RESTRICT,
  bill_date VARCHAR(10) NOT NULL,
  due_date VARCHAR(10) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  payment_terms_id VARCHAR(64) DEFAULT '30 Days',
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
  posted_at TIMESTAMP WITH TIME ZONE,
  posted_by TEXT,
  voided_at TIMESTAMP WITH TIME ZONE,
  voided_by TEXT,
  void_reason TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by TEXT,
  delete_reason TEXT,
  CONSTRAINT uk_supplier_bills_tenant_num UNIQUE (tenant_id, bill_number)
);

-- 15. Supplier Bill Lines
CREATE TABLE IF NOT EXISTS supplier_bill_lines (
  id SERIAL PRIMARY KEY,
  supplier_bill_id INTEGER NOT NULL REFERENCES supplier_bills(id) ON DELETE CASCADE,
  purchase_order_line_id INTEGER REFERENCES purchase_order_lines(id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  quantity TEXT NOT NULL,
  unit_price TEXT NOT NULL,
  discount TEXT NOT NULL DEFAULT '0.000',
  tax TEXT NOT NULL DEFAULT '0.000',
  total TEXT NOT NULL,
  project_id VARCHAR(64),
  cost_center_id VARCHAR(64) REFERENCES cost_centers(id) ON DELETE SET NULL
);

-- 16. Supplier Credits
CREATE TABLE IF NOT EXISTS supplier_credits (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  credit_number VARCHAR(64) NOT NULL,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  purchase_return_id INTEGER REFERENCES purchase_returns(id) ON DELETE SET NULL,
  supplier_bill_id INTEGER REFERENCES supplier_bills(id) ON DELETE SET NULL,
  credit_date VARCHAR(10) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  amount TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by TEXT,
  delete_reason TEXT,
  CONSTRAINT uk_supplier_credits_tenant_num UNIQUE (tenant_id, credit_number)
);

-- 17. Supplier Payments
CREATE TABLE IF NOT EXISTS supplier_payments (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  payment_number VARCHAR(64) NOT NULL,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  payment_date VARCHAR(10) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  payment_method_id VARCHAR(64) NOT NULL DEFAULT 'CASH',
  bank_account_id VARCHAR(64),
  reference_number TEXT,
  amount TEXT NOT NULL,
  allocated_amount TEXT NOT NULL DEFAULT '0.000',
  unallocated_amount TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  posted_at TIMESTAMP WITH TIME ZONE,
  posted_by TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by TEXT,
  delete_reason TEXT,
  CONSTRAINT uk_supplier_payments_tenant_num UNIQUE (tenant_id, payment_number)
);

-- 18. Supplier Payment Allocations
CREATE TABLE IF NOT EXISTS supplier_payment_allocations (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payment_id INTEGER REFERENCES supplier_payments(id) ON DELETE CASCADE,
  supplier_bill_id INTEGER REFERENCES supplier_bills(id) ON DELETE CASCADE,
  supplier_credit_id INTEGER REFERENCES supplier_credits(id) ON DELETE CASCADE,
  allocated_amount TEXT NOT NULL,
  allocation_date VARCHAR(10) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT
);
