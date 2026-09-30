# GulfHive ERP — Hardening & Remediation Issue Tracker

**Date Created:** 30 September 2026  
**Status:** Canonical Remediation Issue Tracker  
**Governance Standard:** Every item must have a designated severity, source file(s), planned remediation phase, tracked status, and a specific automated test proving closure before resolution.

---

## Issue Summary Matrix

| ID | Issue Category | Title | Severity | Source File(s) | Planned Phase | Status |
|---|---|---|---|---|---|---|
| `SEC-001` | Auth Bypass | Missing-token authentication bypass in middleware | **P0** | `src/core/security/auth.middleware.ts` | Phase 1 | **RESOLVED** |
| `SEC-002` | Fallback Passwords | Hardcoded fallback passwords for empty password hashes | **P0** | `src/infrastructure/database/repositories/auth.repository.ts` | Phase 1 | **RESOLVED** |
| `SEC-003` | Unauthenticated APIs | Master data, People, and Audit endpoints lacking authentication | **P0** | `server.ts` | Phase 1 | **RESOLVED** |
| `SEC-004` | Salary/Bank Exposure | Sensitive salary and bank data visibility governed by client headers | **P0** | `server.ts` | Phase 1 | **RESOLVED** |
| `SEC-005` | Tenant Context | Global mutable static tenant context (`TenantContextHolder`) | **P0** | `src/core/domain/tenant-context.ts` | Phase 2 | **RESOLVED** |
| `DB-001` | Schema/Migration Drift | Missing SQL migrations for Sales, Purchase, and Projects tables | **P0** | `src/infrastructure/database/migrations/` | Phase 3 | **RESOLVED** |
| `DB-002` | Migration Failure | Server continues booting after migration failure | **P0** | `server.ts`, `migration-runner.ts` | Phase 3 | **RESOLVED** |
| `RUN-001` | Fake Storage/Backup | Desktop and Hosted backup & file storage adapters return fake success | **P0** | `src/infrastructure/runtime/` | Phase 6 | OPEN |
| `DB-003` | Mixed PK Strategy | Schema split between legacy string IDs and modern numeric serial IDs | **P1** | `src/db/schema.ts` | Phase 4 | OPEN |
| `DOM-001` | Party Model | Clients and Suppliers separated without unified legal Party entity | **P1** | `src/db/schema.ts`, `sales.repository.ts`, `procurement.repository.ts` | Phase 4 | OPEN |
| `COMP-001` | Compliance Engine | Hardcoded statutory rules (PIFSS, GOSI, Overtime, EOSB) in TypeScript | **P1** | `src/services/compliance/statutory-rules.service.ts` | Phase 5 | OPEN |
| `DOM-002` | Money Precision | Statutory compliance and currency conversions using JS Number / Math.round | **P1** | `src/services/compliance/statutory-rules.service.ts`, `money.ts` | Phase 5 | OPEN |
| `DB-004` | Date & Currency Refs | Business dates stored as varchar(10) instead of PostgreSQL DATE | **P1** | `src/db/schema.ts` | Phase 4 | OPEN |
| `DOM-003` | Numbering Scope | Document sequence uniqueness and reset policies not fully enforced in DB | **P1** | `src/infrastructure/database/repositories/numbering.repository.ts` | Phase 4 | OPEN |
| `REP-001` | Arabic PDF | PDF generators lack embedded Arabic font, shaping, and RTL alignment | **P1** | `src/services/pdf-generator.service.ts`, `sales-document.service.ts` | Phase 8 | OPEN |
| `ARCH-001` | Monolithic Files | `server.ts`, `schema.ts`, and major repositories exceeding 1,000–4,000 lines | **P2** | `server.ts`, `src/db/schema.ts`, repositories | Phase 7 | OPEN |
| `TEST-001` | Missing CI/E2E | Absence of automated end-to-end browser tests and cross-tenant tests | **P2** | `tests/` | Phase 9 | OPEN |

---

## Detailed Issue Specifications & Test Closure Requirements

---

### `SEC-001`: Missing-Token Authentication Bypass
- **Severity:** **P0 — Critical**
- **Source File:** `src/core/security/auth.middleware.ts` (lines 34–43)
- **Problem Description:** When no `Authorization` or `x-session-token` header is provided, the middleware automatically resolves a fallback default user and tenant (`tenant_corp_01_1790702844962`), allowing unauthenticated callers to access protected endpoints.
- **Planned Phase:** **Phase 1 — Security Emergency Hardening**
- **Remediation Plan:** Delete the unauthenticated preview bypass. Enforce strict `401 Unauthorized` with `{ error: 'Authentication required. Missing token.', code: 'UNAUTHORIZED' }` on all production requests when token is absent.
- **Status:** **`RESOLVED`** (Verified via `tests/auth-security-hardening.spec.ts`)
- **Test Proving Closure:** `tests/auth-security-hardening.spec.ts` — asserts that making requests to any protected endpoint without a valid Bearer token returns HTTP 401.

---

### `SEC-002`: Hardcoded Fallback Passwords
- **Severity:** **P0 — Critical**
- **Source File:** `src/infrastructure/database/repositories/auth.repository.ts` (lines 118–125)
- **Problem Description:** If a user account has an empty `password_hash`, the authentication repository accepts `Password@123` or `Admin@123` as valid credentials.
- **Planned Phase:** **Phase 1 — Security Emergency Hardening**
- **Remediation Plan:** Completely delete fallback password evaluation. Accounts without securely hashed passwords must be forced through the secure password reset or First-Run provisioning workflow.
- **Status:** **`RESOLVED`** (Verified via `tests/auth-security-hardening.spec.ts`)
- **Test Proving Closure:** `tests/auth-security-hardening.spec.ts` — asserts that attempting login with empty password hash rejects all passwords and returns authentication failure.

---

### `SEC-003`: Unauthenticated Master Data & Employee Endpoints
- **Severity:** **P0 — Critical**
- **Source File:** `server.ts` (multiple route handlers across lines 1050–2500)
- **Problem Description:** Employee directory (`/api/companies/:companyId/employees`), organization branches, departments, designations, fiscal years, document types, and audit logs lack `authenticateToken` middleware.
- **Planned Phase:** **Phase 1 — Security Emergency Hardening**
- **Remediation Plan:** Adopt a default-deny architecture. Apply `authenticateToken`, `requireCompanyAccess`, and granular `requirePermission(...)` middleware to all business and organization endpoints.
- **Status:** **`RESOLVED`** (Verified via `tests/auth-security-hardening.spec.ts`)
- **Test Proving Closure:** `tests/auth-security-hardening.spec.ts` — asserts multi-company isolation and RBAC permission checks reject unauthorized or missing credentials.

---

### `SEC-004`: Salary and Bank Data Exposure Controlled by Client Headers
- **Severity:** **P0 — Critical**
- **Source File:** `server.ts` (lines 1080–1098)
- **Problem Description:** The server relies on client-supplied headers `x-hide-salary` and `x-hide-bank` to redact sensitive employee financial data. Malicious or untrusted clients can simply omit the headers.
- **Planned Phase:** **Phase 1 — Security Emergency Hardening**
- **Remediation Plan:** Redaction must be derived strictly server-side from `req.user.permissions.includes('people.salary.view')`. DTOs must omit sensitive columns before serialization.
- **Status:** **`RESOLVED`** (Verified via `tests/auth-security-hardening.spec.ts`)
- **Test Proving Closure:** `tests/auth-security-hardening.spec.ts` — asserts that users without `people.salary.view` receive sanitized employee objects with salary/bank fields stripped, regardless of client headers.

---

### `SEC-005`: Global Static Mutable Tenant Context
- **Severity:** **P0 — Critical**
- **Source File:** `src/core/domain/tenant-context.ts` (lines 18–39)
- **Problem Description:** `TenantContextHolder` stores `_currentContext` in a static property. In a concurrent Node.js runtime, interleaved async requests can overwrite each other's tenant context, leading to cross-tenant data leaks.
- **Planned Phase:** **Phase 2 — Multi-Tenant Isolation & RLS**
- **Remediation Plan:** Refactor tenant context storage to Node.js `AsyncLocalStorage` (`node:async_hooks`), guaranteeing thread-safe, request-scoped tenant isolation.
- **Status:** **`RESOLVED`** (Verified via `tests/tenant-isolation-concurrency.spec.ts`)
- **Test Proving Closure:** `tests/tenant-isolation-concurrency.spec.ts` — fires concurrent asynchronous simulated requests for different tenants and proves no context bleed occurs under AsyncLocalStorage.

---

### `DB-001`: Schema vs Migration Drift
- **Severity:** **P0 — Critical**
- **Source File:** `src/infrastructure/database/migrations/` vs `src/db/schema.ts`
- **Problem Description:** Drizzle schema contains tables 80–126 (Sales, Purchase, Projects, External Workers, Deployments, Labour Settlements) which do not have corresponding SQL migration files in `src/infrastructure/database/migrations/`.
- **Planned Phase:** **Phase 3 — Database Schema & Migration Parity**
- **Remediation Plan:** Create immutable migrations `0009_sales_receivables.sql`, `0010_purchase_payables.sql`, and `0011_projects_billing_workforce.sql`. Update `migration-runner.ts` to execute them.
- **Status:** **`RESOLVED`** (Verified via `tests/migration-parity.spec.ts`)
- **Test Proving Closure:** `tests/migration-parity.spec.ts` — runs all migrations from scratch on a clean database and verifies 100% table and column alignment with Drizzle schema.

---

### `DB-002`: Server Bypasses Migration Execution Failure
- **Severity:** **P0 — Critical**
- **Source File:** `server.ts` (lines 4059–4065), `src/infrastructure/database/migrations/migration-runner.ts`
- **Problem Description:** Server startup catches migration errors and continues booting, leaving the application running against an out-of-date or broken database schema.
- **Planned Phase:** **Phase 3 — Database Schema & Migration Parity**
- **Remediation Plan:** Enforce fail-fast startup. If `migrationRunner.runAllMigrations()` throws, log fatal error and terminate process with non-zero exit code (`process.exit(1)`).
- **Status:** **`RESOLVED`** (Verified via `tests/migration-parity.spec.ts`)
- **Test Proving Closure:** `tests/migration-parity.spec.ts` — verifies migration runner throws deterministically on corrupted migrations and prevents application boot.

---

### `RUN-001`: Simulated / Fake Desktop & Hosted Runtime Adapters
- **Severity:** **P0 — Critical**
- **Source File:** `src/infrastructure/runtime/desktop-runtime.ts`, `src/infrastructure/runtime/hosted-runtime.ts`
- **Problem Description:** Desktop backup returns hardcoded checksums and mock sizes; restore always returns `true`; file storage reads return empty byte arrays without touching disk.
- **Planned Phase:** **Phase 6 — Real Runtime Persistence & Backup**
- **Remediation Plan:** Implement genuine local filesystem storage with path traversal protection, real database dump/restore commands (e.g. `pg_dump`/`pg_restore` or SQLite export), actual byte checksum verification, and Cloud Object Storage integration (S3/GCS SDK).
- **Status:** `OPEN`
- **Test Proving Closure:** `tests/real-runtime-persistence.spec.ts` — writes actual files, computes real SHA-256 hashes, creates real backup archives, restores them, and verifies payload fidelity.

---

### `DB-003`: Mixed Relational Primary Key Strategy
- **Severity:** **P1 — High**
- **Source File:** `src/db/schema.ts`
- **Problem Description:** Schema is split: 62 tables use `varchar(64)` primary keys while 62 newer tables use `serial()` numeric IDs. The agreed architectural standard is `BIGINT GENERATED ALWAYS AS IDENTITY` with numeric foreign keys.
- **Planned Phase:** **Phase 4 — Identity, Master Data & Relational Consolidation**
- **Remediation Plan:** Execute phased migration to backfill `bigint` identity columns, map foreign keys, validate referential integrity, and deprecate string-based primary keys.
- **Status:** `OPEN`
- **Test Proving Closure:** `tests/relational-integrity.spec.ts` — proves all tables use numeric foreign keys and relational joins succeed without string conversions.

---

### `DOM-001`: Non-Unified Legal Party Architecture
- **Severity:** **P1 — High**
- **Source File:** `src/db/schema.ts`, `src/infrastructure/database/repositories/sales.repository.ts`, `procurement.repository.ts`, `projects.repository.ts`
- **Problem Description:** `clients` and `suppliers` exist as separate disconnected tables without a shared `parties` base table. Organizations acting as both Client, Supplier, and Principal Contractor require duplicate records.
- **Planned Phase:** **Phase 4 — Identity, Master Data & Relational Consolidation**
- **Remediation Plan:** Implement `parties`, `party_roles`, `client_profiles`, and `supplier_profiles`. Refactor projects and workforce suppliers to reference `principal_party_id` and `source_party_id`.
- **Status:** `OPEN`
- **Test Proving Closure:** `tests/party-unification.spec.ts` — creates a single legal Party with dual Client and Supplier roles, generating linked invoices and bills without data duplication.

---

### `COMP-001`: Hardcoded Legal Compliance Rules in Code
- **Severity:** **P1 — High**
- **Source File:** `src/services/compliance/statutory-rules.service.ts`
- **Problem Description:** Statutory insurance rates (Kuwait PIFSS, Saudi GOSI, Bahrain SIO, UAE GPSSA), overtime multipliers, and end-of-service gratuity formulas are hardcoded in TypeScript. Historical payroll recalculations cannot reference point-in-time legal versions.
- **Planned Phase:** **Phase 5 — DB-Backed Compliance & Precision Engine**
- **Remediation Plan:** Migrate statutory parameters into versioned `statutory_rules` database records with effective date ranges (`effective_from`, `effective_to`), legal sources, and snapshot IDs recorded on each payroll run.
- **Status:** `OPEN`
- **Test Proving Closure:** `tests/versioned-compliance.spec.ts` — tests payroll calculation across different historical rule versions and proves approved historical payroll results are reproducible.

---

### `DOM-002`: Monetary Precision & Allocation Edge Cases
- **Severity:** **P1 — High**
- **Source File:** `src/services/compliance/statutory-rules.service.ts`, `src/core/domain/money.ts`
- **Problem Description:** Certain statutory calculation branches convert subunits to JavaScript `Number` and use `Math.round`. Money allocation uses float-based proportional ratios.
- **Planned Phase:** **Phase 5 — DB-Backed Compliance & Precision Engine**
- **Remediation Plan:** Eliminate JavaScript `Number` from financial formulas. Implement the deterministic **Largest Remainder Method** (Hare-Niemeyer) for Money allocations.
- **Status:** `OPEN`
- **Test Proving Closure:** `tests/money-precision-hardening.spec.ts` — allocates odd monetary amounts (e.g. 100.000 KWD across 3 accounts) and verifies sum of allocated subunits strictly equals original sum down to the exact millime.

---

### `DB-004`: Business Dates Stored as Varchar Strings
- **Severity:** **P1 — High**
- **Source File:** `src/db/schema.ts`
- **Problem Description:** Document dates, allocation dates, and contract periods in newer tables use `varchar(10)` (`YYYY-MM-DD`) instead of PostgreSQL native `DATE`.
- **Planned Phase:** **Phase 4 — Identity, Master Data & Relational Consolidation**
- **Remediation Plan:** Migrate business date columns from `varchar(10)` to PostgreSQL `DATE` types with proper migration scripts and validation.
- **Status:** `OPEN`
- **Test Proving Closure:** `tests/date-integrity.spec.ts` — verifies date range queries, interval arithmetic, and invalid date rejections at the database layer.

---

### `DOM-003`: Numbering Engine Scope & Concurrency
- **Severity:** **P1 — High**
- **Source File:** `src/infrastructure/database/repositories/numbering.repository.ts`, `src/db/schema.ts`
- **Problem Description:** `document_sequences` lookup relies primarily on `tenant_id + document_type` without strict unique constraints covering branch and fiscal scopes. Concurrent sequence generation risk.
- **Planned Phase:** **Phase 4 — Identity, Master Data & Relational Consolidation**
- **Remediation Plan:** Add composite unique constraints `(tenant_id, document_type, branch_id, fiscal_year_id)` with `SELECT ... FOR UPDATE` row-level locking or atomic sequence increment transactions.
- **Status:** `OPEN`
- **Test Proving Closure:** `tests/concurrent-numbering.spec.ts` — executes 50 concurrent sequence generation requests and verifies exactly 50 unique sequential numbers without duplicates or gaps.

---

### `REP-001`: Incomplete Arabic PDF Rendering & Font Shaping
- **Severity:** **P1 — High**
- **Source File:** `src/services/pdf-generator.service.ts`, `src/services/sales-document.service.ts`, `src/services/procurement-document.service.ts`
- **Problem Description:** PDF services use `Helvetica` / `Helvetica-Bold` fonts which cannot render Arabic glyphs or RTL text shaping.
- **Planned Phase:** **Phase 8 — Arabic Typography, RTL & Official Documents**
- **Remediation Plan:** Register licensed Arabic fonts (e.g. Amiri, Cairo, or Noto Sans Arabic) in PDFKit, integrate `@mapbox/mapbox-gl-rtl-text` or bilingual bidirectional shaping, and enforce RTL layout alignment.
- **Status:** `OPEN`
- **Test Proving Closure:** `tests/arabic-pdf-rendering.spec.ts` — generates sample PDF and asserts binary font embedding and valid RTL glyph sequences.

---

### `ARCH-001`: Monolithic Server & Megafiles
- **Severity:** **P2 — Medium**
- **Source File:** `server.ts` (4,094 lines), `src/db/schema.ts` (2,844 lines), large module tabs
- **Problem Description:** Server and schema have accumulated into huge single files, making modular boundaries blurry and code reviews risk-prone.
- **Planned Phase:** **Phase 7 — Clean Architecture & Modular Monolith Refactor**
- **Remediation Plan:** Refactor `server.ts` into Express modular routers per bounded context (`routes/people.ts`, `routes/sales.ts`, etc.) and modularize schema by domain.
- **Status:** `OPEN`
- **Test Proving Closure:** `tests/modular-router-integrity.spec.ts` — asserts all 284 routes remain intact and accessible under modular router composition.

---

### `TEST-001`: Missing Automated End-to-End & Concurrency Test Suites
- **Severity:** **P2 — Medium**
- **Source File:** `tests/`
- **Problem Description:** Vitest unit and integration suites cover domain logic, but browser-level E2E tests (Playwright) and cross-tenant authorization penetration tests are needed.
- **Planned Phase:** **Phase 9 — Full Production Test Gate & Release Audit**
- **Remediation Plan:** Add Playwright test suite covering First-Run Wizard, Login, Employee Lifecycle, Sales Quotation-to-Invoice, and Payroll Approval workflows in both English and Arabic RTL.
- **Status:** `OPEN`
- **Test Proving Closure:** `tests/e2e/workflow.spec.ts` — complete browser-level test execution across critical business journeys.
