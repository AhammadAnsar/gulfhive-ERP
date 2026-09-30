# GulfHive ERP — Database Migration, Schema Parity & Relational ID Strategy Report

**Date Generated:** 30 September 2026  
**Status:** Completed Phase 3 Migration Parity Audit  
**Authoritative Migration Runner:** `src/infrastructure/database/migrations/migration-runner.ts`  
**Test Verification:** `tests/migration-parity.spec.ts` (100% Pass)

---

## 1. Schema & Migration Parity Audit

All business domains in GulfHive ERP are now backed by immutable SQL migrations. The dynamic migration runner scans, validates checksums, and executes migrations in numerical version order.

| Migration File | Domain / Module Covered | Primary Tables Created / Managed | Status |
|---|---|---|---|
| `0001_initial_core_schema.sql` | Core Tenant & User Master | `tenants`, `users`, `compliance_rules`, `audit_logs` | **Applied** |
| `0002_organization_master_data.sql` | Org Hierarchy & Master Data | `employee_categories`, `business_units`, `cost_centers`, `fiscal_years`, `currencies`, `countries`, `nationalities`, `banks`, `payment_methods`, `document_types`, `document_sequences` | **Applied** |
| `0004_identity_security_authorization.sql` | Security, Roles & RBAC | `roles`, `permissions`, `role_permissions`, `user_roles`, `user_tenants`, `user_branch_access`, `user_company_access`, `user_data_scopes`, `user_sessions`, `login_events` | **Applied** |
| `0005_people_employee_module.sql` | People & Employee Master | `employees`, `employee_contracts`, `employee_salaries`, `employee_bank_details`, `employee_documents`, `employee_dependents`, `employee_emergency_contacts`, `employee_assignments`, `employee_history` | **Applied** |
| `0006_time_attendance_timesheet.sql` | Time, Attendance & Roster | `shifts`, `work_schedules`, `shift_patterns`, `shift_pattern_days`, `roster_assignments`, `roster_entries`, `roster_change_history`, `clock_events`, `break_policies`, `schedule_overrides`, `attendance_records`, `attendance_days`, `timesheets`, `timesheet_lines`, `attendance_corrections`, `attendance_exceptions`, `holidays`, `holiday_calendars` | **Applied** |
| `0007_leave_overtime_policy_module.sql` | Leave & Overtime Engine | `leave_types`, `leave_policies`, `leave_allocations`, `employee_leave_entitlements`, `leave_requests`, `leave_ledger`, `overtime_policies`, `overtime_records` | **Applied** |
| `0008_payroll_engine_production.sql` | Payroll, Compensation & WPS | `payroll_periods`, `salary_components`, `salary_structures`, `salary_structure_components`, `payroll_runs`, `payroll_items`, `payroll_result_lines`, `payroll_adjustments`, `payroll_exceptions`, `statutory_rules`, `employee_loans`, `loan_repayment_transactions`, `final_settlements` | **Applied** |
| `0009_sales_receivables.sql` | Sales, Receivables & Invoicing | `clients`, `client_contacts`, `client_sites`, `tax_codes`, `quotations`, `quotation_lines`, `sales_orders`, `sales_order_lines`, `deliveries`, `delivery_lines`, `invoices`, `invoice_lines`, `credit_notes`, `credit_note_lines`, `receipts`, `receipt_allocations` | **Applied** |
| `0010_purchase_payables.sql` | Purchase, Procurement & Bills | `suppliers`, `purchase_requests`, `purchase_request_lines`, `rfqs`, `rfq_suppliers`, `supplier_quotations`, `supplier_quotation_lines`, `purchase_orders`, `purchase_order_lines`, `goods_receipts`, `goods_receipt_lines`, `purchase_returns`, `purchase_return_lines`, `supplier_bills`, `supplier_bill_lines`, `supplier_credits`, `supplier_payments`, `supplier_payment_allocations` | **Applied** |
| `0011_projects_billing_workforce.sql` | Projects, Billing & Deployments | `billing_profiles`, `billing_authorizations`, `projects`, `project_contracts`, `project_sites`, `project_activities`, `project_budgets`, `external_workers`, `workforce_supplier_agreements`, `workforce_rate_cards`, `workforce_deployments`, `external_labour_settlements`, `external_labour_settlement_lines` | **Applied** |
| `0012_row_level_security.sql` | RLS Policy & Scoping | Row level security policies on `tenants`, `users`, `branches`, `departments`, `designations`, `employee_categories`, `business_units`, `cost_centers`, `employees`, `clients`, `suppliers` | **Applied** |

---

## 2. Numeric PK/FK Strategy & Legacy String ID Compatibility Matrix

GulfHive is establishing `BIGINT GENERATED ALWAYS AS IDENTITY` / `SERIAL` integer primary keys as the mandatory standard for business tables.

| Module / Table | Persistent Primary Key | Foreign Key References | Human/Business Code Column | Status / Compatibility Plan |
|---|---|---|---|---|
| `clients` | `SERIAL PRIMARY KEY` (`id`) | `tenant_id` | `code` (e.g. `CLI-001`) | **100% Numeric PK/FK** |
| `suppliers` | `SERIAL PRIMARY KEY` (`id`) | `tenant_id` | `code` (e.g. `SUP-001`) | **100% Numeric PK/FK** |
| `invoices` | `SERIAL PRIMARY KEY` (`id`) | `tenant_id`, `client_id` (INTEGER FK) | `invoice_number` | **100% Numeric PK/FK** |
| `supplier_bills` | `SERIAL PRIMARY KEY` (`id`) | `tenant_id`, `supplier_id` (INTEGER FK) | `bill_number` | **100% Numeric PK/FK** |
| `projects` | `SERIAL PRIMARY KEY` (`id`) | `tenant_id`, `client_id`, `billing_profile_id` | `project_code` | **100% Numeric PK/FK** |
| `external_workers` | `SERIAL PRIMARY KEY` (`id`) | `tenant_id`, `source_supplier_id` | `worker_code` | **100% Numeric PK/FK** |
| `workforce_deployments` | `SERIAL PRIMARY KEY` (`id`) | `tenant_id`, `project_id`, `external_worker_id` | N/A | **100% Numeric PK/FK** |
| `employees` (Legacy String PK) | `VARCHAR(64)` (`id`) | `tenant_id`, `branch_id`, `department_id` | `employee_number` | **Phased Dual-Read Compatibility** (Numeric `numeric_id` added in Phase 4 migration) |

---

## 3. Data Integrity & Concurrency Controls

1. **Production Startup Rule:** If any SQL migration fails during boot, `server.ts` logs a `[FATAL]` error and terminates the process with exit code `1`.
2. **Numbering Engine Scope Integrity:** Document sequence generation uses company/branch/fiscal year reset scopes with atomic PostgreSQL row locks to guarantee zero gap / zero duplicate sequence generation under high concurrent load.
3. **FK Delete Restrictions:** Financial and operational transaction tables (`invoices`, `bills`, `payroll_runs`, `projects`, `deployments`) use `ON DELETE RESTRICT` for foreign references to prevent cascading deletions of historical audit data.
