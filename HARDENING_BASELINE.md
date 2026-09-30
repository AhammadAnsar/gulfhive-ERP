# GulfHive ERP — Hardening Baseline & Technical Inventory

**Date:** 30 September 2026  
**Status:** Canonical Technical Baseline (Pre-Remediation Freeze)  
**Verification Standard:** Verified against live codebase execution, static analysis, schema reflection, and automated test runners.

---

## 1. Overview & Objectives

This document establishes the official technical baseline for the **GulfHive ERP** codebase before initiating Phase 1 Security and Architecture Remediation.

No new business features are introduced during this baseline stabilization phase. All existing modules, schemas, migrations, runtime adapters, route counts, and test suites are inventoried below to prevent silent regressions and ensure verifiable, auditable remediation.

---

## 2. Module Inventory

The system defines 10 core & operational ERP modules documented in `src/modules/module.manifest.ts` and mounted in `src/App.tsx`:

| Module Code | Module Name (EN) | Module Name (AR) | Directory | Core / Extended | Primary Responsibilities |
|---|---|---|---|---|---|
| `People` | People | الموظفون | `src/modules/people` | Core | Authoritative Employee Master, employment contracts, identity documents, and emergency contacts. |
| `Time` | Time | الوقت | `src/modules/time` | Core | Shift schedules, roster assignments, biometric clock events, attendance processing, leaves, and overtime. |
| `Payroll` | Payroll | الرواتب | `src/modules/payroll` | Core | Salary structures, configurable components, multi-stage calculation pipeline, WPS SIF export, payslips. |
| `Projects` | Projects & Workforce | المشاريع وتشغيل القوى العاملة | `src/modules/projects` | Extended | Direct & subcontracted project master, billing profile authorizations, project sites, external manpower, labour settlements. |
| `Sales` | Sales & Receivables | المبيعات | `src/modules/sales` | Extended | Customer directory, quotations, sales orders, delivery notes, commercial invoices, debit/credit notes, receipt allocations. |
| `Purchase` | Purchase & Payables | المشتريات | `src/modules/purchase` | Extended | Supplier directory, purchase requests, RFQs, vendor quotations, purchase orders, goods receipts, supplier bills, payment allocations. |
| `Stock` | Inventory & Warehousing | المخزون | `src/modules/` (manifest defined) | Extended | Multi-warehouse inventory, stock valuation (moving average / FIFO), item movements, stocktakes. |
| `Finance` | General Ledger & Accounting | الحسابات العامة | `src/modules/` (manifest defined) | Core | Double-entry chart of accounts, automated journal entries, AP/AR subledger reconciliation, financial statements. |
| `Assets` | Fixed Assets | الأصول الثابتة | `src/modules/` (manifest defined) | Extended | Fixed asset registers, depreciation schedules, asset transfers, disposals, maintenance records. |
| `Settings` | Administration & Settings | الإعدادات | `src/modules/settings` | Core | Organization hierarchy, branch definitions, departments, designations, fiscal years, document numbering sequences, audit trail, user access. |

---

## 3. Server & API Routing Inventory

- **Server Entry Point:** `server.ts` (4,094 lines)
- **Total Registered Express Routes:** **284 routes**
  - Specific API Route Handlers: 282
  - Undefined API 404 Catch-All: 1 (`app.all('/api/*', ...)`)
  - Single-Page App Static / Catch-All: 1 (`app.get('*', ...)`)
- **Route Distribution by Domain:**
  - **Identity, Auth & User Management:** 18 routes
  - **Organization, Master Data & Numbering:** 48 routes
  - **People & Employee Management:** 34 routes
  - **Time, Shifts, Attendance & Leaves:** 42 routes
  - **Payroll Engine & Settlements:** 32 routes
  - **Sales, Quotes, Invoices & Receipts:** 38 routes
  - **Procurement, Purchase Orders, Bills & Payments:** 42 routes
  - **Projects, Billing Profiles, External Manpower & Deployments:** 28 routes

### Authentication & Guard Usage across Routes:
- Routes using `authenticateToken`: ~136 routes
- Routes using `requireCompanyAccess`: ~132 routes
- Routes using `requirePermission`: ~11 routes
- **Unauthenticated / Public Routes Requiring Immediate Remediation:** Master data, employee profile read endpoints, and audit trail endpoints currently lack strict `authenticateToken` middleware.

---

## 4. Database Schema Table List

The database schema (`src/db/schema.ts` — 2,844 lines) contains exactly **126 relational table definitions**:

### 4.1 System & Tenant Architecture (13 tables)
1. `tenants` — Legal company / tenant identity
2. `branches` — Operational branches and locations
3. `roles` — System and custom RBAC security roles
4. `permissions` — Granular permission catalog
5. `role_permissions` — Role-to-permission mapping
6. `users` — User master accounts and credentials
7. `user_roles` — User role assignments
8. `user_company_access` — Multi-company authorization mapping
9. `user_branch_access` — Branch restriction scopes
10. `user_data_scopes` — User data access scope boundaries
11. `user_sessions` — Stateful user session tokens
12. `login_events` — Authentication audit log
13. `user_tenants` — Legacy tenant link table

### 4.2 Organization Master Data & Foundations (13 tables)
14. `departments` — Department hierarchy
15. `designations` — Job designations / titles
16. `employee_categories` — Workforce categories (Executive, Skilled, General)
17. `business_units` — Operating business units
18. `cost_centers` — Cost center accounting allocations
19. `fiscal_years` — Financial and fiscal periods
20. `currencies` — ISO currency codes with decimal precision (KWD=3, SAR=2, etc.)
21. `countries` — ISO country master data
22. `nationalities` — Country nationality reference table
23. `banks` — Authorized banking institutions
24. `payment_methods` — Payment rails (Bank Transfer, Cheque, Card, Cash)
25. `document_types` — Official document types (Civil ID, Passport, Trade License)
26. `document_sequences` — Document numbering engine (prefix, padding, reset policies)

### 4.3 People & Employee Master (11 tables)
27. `employees` — Authoritative employee master record
28. `employee_assignments` — Department/designation/branch historical assignments
29. `employee_contracts` — Formal labor contracts and terms
30. `employee_salaries` — Salary assignments and compensation
31. `employee_bank_details` — Bank account, IBAN, and payment routing
32. `employee_documents` — Document attachments and expiry tracking
33. `employee_emergency_contacts` — Next-of-kin emergency contact directory
34. `employee_dependents` — Family member dependent records
35. `employee_history` — Employment lifecycle audit history
36. `compliance_rules` — Country-specific labor rule parameters
37. `audit_logs` — System-wide immutable audit trail

### 4.4 Time, Attendance & Leaves (25 tables)
38. `schema_migrations` — Database migration registry and checksum table
39. `break_policies` — Break duration and auto-deduction policies
40. `shifts` — Shift templates and timing definitions
41. `work_schedules` — Weekly work schedule patterns
42. `shift_patterns` — Multi-week repeating shift rotations
43. `shift_pattern_days` — Daily shift pattern rules
44. `employee_schedule_assignments` — Employee-to-schedule mappings
45. `schedule_overrides` — Exception day schedule overrides
46. `roster_entries` — Planned roster calendar entries
47. `roster_change_history` — Roster modifications audit
48. `roster_assignments` — Bulk roster assignments
49. `clock_events` — Raw biometric / mobile clock-in/out timestamps
50. `attendance_days` — Aggregated daily attendance results
51. `attendance_records` — Granular attendance punch records
52. `attendance_exceptions` — Late in, early out, missing punch exceptions
53. `attendance_corrections` — Manager attendance correction workflow
54. `holiday_calendars` — Statutory holiday calendar groups
55. `holidays` — Official public holidays
56. `leave_types` — Leave categories (Annual, Sick, Hajj, Maternity, Unpaid)
57. `leave_policies` — Accrual rules, carry-forward limits, and encashment
58. `employee_leave_entitlements` — Period leave balance entitlements
59. `leave_ledger` — Immutable transaction-based leave balance ledger
60. `leave_allocations` — Annual/monthly leave grants
61. `leave_requests` — Employee leave applications and approvals
62. `timesheets` — Project / weekly timesheet headers
63. `timesheet_lines` — Timesheet daily task lines
64. `overtime_policies` — Overtime calculation tiers (Regular, Rest Day, Holiday)
65. `overtime_records` — Calculated overtime hour records
66. `approval_workflows` — Sequential multi-level approval engine

### 4.5 Payroll Engine & Settlements (13 tables)
67. `employee_loans` — Employee advance loans and installments
68. `payroll_periods` — Monthly payroll processing periods
69. `salary_components` — Dynamic earning and deduction components
70. `salary_structures` — Salary package structures
71. `salary_structure_components` — Component formula and percentage mappings
72. `payroll_runs` — Master payroll calculation runs
73. `payroll_items` — Employee payroll run summary results
74. `payroll_result_lines` — Itemized earnings/deductions/contributions per employee
75. `payroll_adjustments` — Ad-hoc pre-payroll adjustments
76. `loan_repayment_transactions` — Payroll loan deduction ledger
77. `statutory_rules` — Statutory insurance calculation versions
78. `payroll_exceptions` — Payroll calculation warnings and blockers
79. `final_settlements` — End-of-service indemnity (EOSB) calculations

### 4.6 Sales & Commercial Receivables (15 tables)
80. `clients` — Customer / Client master directory
81. `client_contacts` — Client multi-contact directory
82. `client_sites` — Client physical work locations and sites
83. `tax_codes` — Regional tax / VAT rate definitions
84. `quotations` — Commercial sales quotation headers
85. `quotation_lines` — Quotation itemized service lines
86. `sales_orders` — Confirmed sales order headers
87. `sales_order_lines` — Sales order itemized lines
88. `deliveries` — Delivery / service completion notes
89. `delivery_lines` — Delivered items and service lines
90. `invoices` — Commercial sales tax invoice headers
91. `invoice_lines` — Invoice itemized billable lines
92. `credit_notes` — Sales credit notes
93. `credit_note_lines` — Credit note itemized lines
94. `receipts` — Customer payment receipt vouchers
95. `receipt_allocations` — Receipt-to-invoice payment allocations

### 4.7 Procurement & Accounts Payable (18 tables)
96. `suppliers` — Vendor / Supplier master directory
97. `purchase_requests` — Material / service purchase requisitions
98. `purchase_request_lines` — Requisition line items
99. `rfqs` — Request for Quotations (RFQ) headers
100. `rfq_suppliers` — Invited suppliers for RFQ
101. `supplier_quotations` — Vendor quotation responses
102. `supplier_quotation_lines` — Vendor quotation line prices
103. `purchase_orders` — Authorized purchase order contracts
104. `purchase_order_lines` — Purchase order line items
105. `goods_receipts` — Goods Receipt Notes (GRN)
106. `goods_receipt_lines` — Received quantities and inspection notes
107. `purchase_returns` — Goods return vouchers
108. `purchase_return_lines` — Returned item line details
109. `supplier_bills` — Accounts payable vendor bills (3-way match)
110. `supplier_bill_lines` — Vendor bill line items
111. `supplier_credits` — Vendor credit notes
112. `supplier_payments` — Payment vouchers to vendors
113. `supplier_payment_allocations` — Payment-to-bill settlement allocations

### 4.8 Projects, Subcontracts & Workforce Deployment (13 tables)
114. `billing_profiles` — Operating & Principal Company authorized billing identities
115. `billing_authorizations` — Explicit company-to-company billing authorization contracts
116. `projects` — Project master (Direct & Subcontracts with Principal Contractor)
117. `project_contracts` — Formal contract agreements and commercial terms
118. `project_sites` — Project-to-client site mappings
119. `project_activities` — Work breakdown structure (WBS) activities
120. `project_budgets` — Project financial and labor budgets
121. `external_workers` — Manpower supplier external worker records
122. `workforce_supplier_agreements` — Master manpower supply agreements
123. `workforce_rate_cards` — Position-based manpower supply rate cards
124. `workforce_deployments` — Unified workforce deployment history (Internal & External)
125. `external_labour_settlements` — External workforce settlement certificates
126. `external_labour_settlement_lines` — Line-by-line external worker hours and rates

---

## 5. SQL Migration Ordering & Status

### Existing Registered Migrations (`src/infrastructure/database/migrations/`):
1. `0001_initial_core_schema.sql` (v1) — Tenants, branches, roles, permissions, users, initial core tables.
2. `0002_organization_master_data.sql` (v2) — Departments, designations, business units, currencies, countries, nationalities, numbering sequences.
3. `0004_identity_security_authorization.sql` (v4) — RBAC user roles, permissions, company access scopes, login events.
4. `0005_people_employee_module.sql` (v5) — Employee master, assignments, contracts, salaries, bank details, documents.
5. `0006_time_attendance_timesheet.sql` (v6) — Shifts, rosters, biometric clock events, attendance days, corrections, timesheets.
6. `0007_leave_overtime_policy_module.sql` (v7) — Leave types, accrual policies, entitlements, leave ledger, overtime rules.
7. `0008_payroll_engine_production.sql` (v8) — Payroll periods, salary components, structures, payroll runs, result lines, final settlements.

### Identified Migration Drift (To be resolved in Phase 3):
- Drizzle schema contains tables 80–126 (Sales, Purchase, Projects, External Workers, Deployments, Settlements) which currently lack formal numbered `.sql` migration files in the runner. Corrective migrations `0009_sales_receivables.sql`, `0010_purchase_payables.sql`, and `0011_projects_billing_workforce.sql` will be introduced.

---

## 6. Authentication & Tenant Isolation Mechanisms

### 6.1 Authentication Methods in Use
- **Custom Token Session:** `x-session-token` or `Authorization: Bearer <token>` verified via `authRepository.verifySessionToken(token)` against `user_sessions` table.
- **Firebase Auth Bridge:** `src/middleware/auth.ts` verifies Google Firebase tokens.
- **Identified Defect:** Fallback authentication bypass when token is omitted in `auth.middleware.ts` lines 34–43. Must be replaced with strict `401 Unauthorized` in production.

### 6.2 Tenant Context Mechanism
- **Current State:** `TenantContextHolder` in `src/core/domain/tenant-context.ts` uses static class variable `private static _currentContext?: TenantContext`.
- **Identified Defect:** Process-wide mutable state is dangerous under concurrent Node.js asynchronous request handling. Must be refactored to `AsyncLocalStorage` or request-scoped context injection.

---

## 7. Direct `fetch()` Calls & Client Architecture

- **Total Direct `fetch()` Invocations in `src/`:** **187 calls**
- **Centralized API Client:** `src/lib/api-client.ts` exists with safe non-JSON error handling (`parseResponseSafely`), but is currently under-utilized in frontend components.
- **Target Architecture:** Phase 1 will migrate all 187 direct `fetch()` calls into a unified, authenticated HTTP client with automatic token injection, request correlation IDs, and centralized error handling.

---

## 8. Main Monolithic Files (Over 1,000 Lines)

| File Path | Total Line Count | Primary Role | Modularization Target |
|---|---|---|---|
| `server.ts` | 4,094 lines | Monolithic Express Server | Split into domain routers (`/routes/people.ts`, `/routes/sales.ts`, etc.) |
| `src/db/schema.ts` | 2,844 lines | Monolithic Schema | Split into schema modules per bounded context |
| `src/modules/sales/SalesModule.tsx` | 2,163 lines | Sales Frontend SPA Tab Hub | Split into dedicated subcomponents and hook containers |
| `src/infrastructure/database/repositories/sales.repository.ts` | 2,114 lines | Sales DB Repository | Split into Quotes, Orders, Invoices, Receipts repositories |
| `src/infrastructure/database/repositories/procurement.repository.ts` | 2,111 lines | Procurement DB Repository | Split into RFQ, PO, Bills, Payments repositories |
| `src/modules/settings/SettingsModule.tsx` | 1,650 lines | Settings SPA Tab Hub | Split into Organization, Numbering, Users sub-tabs |
| `src/modules/time/TimeModule.tsx` | 1,627 lines | Time & Attendance SPA Hub | Split into Shifts, Rosters, Attendance, Leaves sub-tabs |
| `src/infrastructure/database/repositories/people.repository.ts` | 1,508 lines | Employee Repository | Keep focused, extract document & emergency contacts |
| `src/infrastructure/database/repositories/time.repository.ts` | 1,462 lines | Time & Attendance Repository | Split into Attendance and Roster repositories |
| `src/modules/payroll/PayrollModule.tsx` | 1,456 lines | Payroll Processing SPA Hub | Split into Periods, Structures, Runs, Payslips sub-tabs |
| `src/infrastructure/database/repositories/payroll.repository.ts` | 1,279 lines | Payroll DB Repository | Keep focused on deterministic calculation records |
| `src/infrastructure/database/repositories/projects.repository.ts` | 1,234 lines | Projects & Manpower Repository | Split into Projects, BillingProfiles, Workforce repositories |

---

## 9. Automated Test Suite Inventory

The automated test suite runs via Vitest (`npm test`):

| Test File | Description | Test Count | Status |
|---|---|---|---|
| `tests/money.spec.ts` | Decimal-safe Money value object, rounding, and formatting | 7 tests | Passed |
| `tests/result.spec.ts` | Functional Result monad error handling | 3 tests | Passed |
| `tests/aggregate-root.spec.ts` | Domain Aggregate Root and entity lifecycle | 2 tests | Passed |
| `tests/event-bus.spec.ts` | In-memory domain event dispatching and error isolation | 2 tests | Passed |
| `tests/i18n.spec.ts` | Bilingual dictionary keys, parameter interpolation, and RTL direction | 3 tests | Passed |
| `tests/tenant.spec.ts` | Tenant isolation, currency code, and country context | 5 tests | Passed |
| `tests/master-data.spec.ts` | Document numbering engine, sequence formatting, and deletion guards | 5 tests | Passed |
| `tests/dashboard.spec.ts` | Dashboard KPI calculations and metric aggregations | 2 tests | Passed |
| `tests/runtime.spec.ts` | Desktop vs Cloud runtime adapter capability detection | 2 tests | Passed |
| `tests/people.spec.ts` | Employee entity validation and business rules | 5 tests | Passed |
| `tests/people-employee.spec.ts` | Employee CRUD, contract history, salary structure, and bank validation | 5 tests | Passed |
| `tests/employee-bulk-delete.spec.ts` | Dependency-aware preflight deletion, attendance protection, and bulk archiving | 3 tests | Passed |
| `tests/first-run-setup.spec.ts` | API client safe parsing, non-JSON handling, and transactional company establishment | 5 tests | Passed |
| `tests/time.spec.ts` | Biometric clock events, shift rosters, attendance calculation, and overtime | 10 tests | Passed |
| `tests/payroll.spec.ts` | Configurable components, multi-stage calculation pipeline, and WPS export | 9 tests | Passed |
| `tests/procurement.spec.ts` | 3-way matching, PO approval, supplier bills, and payment allocations | 13 tests | Passed |
| `tests/client-hardening.spec.ts` | Client directory, preflight deletion, bulk actions, and search filtering | 16 tests | Passed |
| `tests/no-dummy-data-safety-gate.spec.ts` | **NEW:** Static codebase purity scan, zero-record tenant initialization, reference data integrity | 5 tests | Passed |

**Total Test Coverage:** **18 Test Suites / 97 Automated Tests Passing (100% Pass Rate).**

---

## 10. Runtime & Storage Adapters Inventory

### 10.1 Desktop Offline Adapter (`src/infrastructure/runtime/desktop-runtime.ts`)
- **Mode:** `DESKTOP_OFFLINE`
- **Current Status:** Stub / Simulated.
- **Known Fakes:** `createBackup()` returns hardcoded checksum/size; `restoreBackup()` returns `true` unconditionally; `saveDocument()` and `readDocument()` do not write/read real disk files.

### 10.2 Hosted Cloud Adapter (`src/infrastructure/runtime/hosted-runtime.ts`)
- **Mode:** `ONLINE_CLOUD_HOSTED`
- **Current Status:** Stub / Simulated.
- **Known Fakes:** `createBackup()` returns mock Cloud SQL snapshot metadata; `saveDocument()` and `readDocument()` return mock `gs://` paths and empty byte arrays; health diagnostics return static `REGIONAL_HIGH_AVAILABILITY`.

---

## 11. Reporting & Document Generation Services

- `src/services/pdf-generator.service.ts` — Vector PDF ID cards and employee profiles via `pdfkit`. (Requires Arabic font embedding and RTL text shaping).
- `src/services/sales-document.service.ts` — Quotations, Sales Orders, Invoices, and Delivery Notes via `pdfkit` and `exceljs`.
- `src/services/procurement-document.service.ts` — Purchase Orders, Goods Receipts, Supplier Statements via `pdfkit` and `exceljs`.
- `src/services/time-export.service.ts` — Timesheets, Biometric Punch Logs, and Attendance Reports via `exceljs`.
- `src/modules/payroll/services/wps-export.service.ts` — Central Bank compliant Wage Protection System (WPS) SIF file generator.

---

## 12. Verification & Build Commands

All baseline verification commands have been consolidated into `package.json`:

```bash
# Typecheck TypeScript without emitting JS
npm run typecheck

# Codebase Linter (TSC No-Emit)
npm run lint

# Run Full Automated Test Suite (18 test suites, 97 tests)
npm test

# Run Fast Unit Tests
npm run test:unit

# Run Integration & Database Tests
npm run test:integration

# Execute Migration Runner CLI
npm run verify:migrations

# Full CI Verification Pipeline
npm run verify

# Production Vite Bundle Build
npm run build
```
