# GulfHive ERP — Architectural Blueprint & Foundation Audit

## 1. Architectural Philosophy & Overview
GulfHive is designed as an enterprise-grade, Gulf-focused Enterprise Resource Planning (ERP) platform. It adheres strictly to:
- **Clean Architecture**: Dependency direction points inward. Domain logic has zero dependencies on web frameworks, ORMs, or runtime drivers.
- **Domain-Driven Design (DDD)**: Explicit entities, immutable value objects, aggregate roots, domain events, and bounded contexts.
- **Modular Monolith**: Code is partitioned into distinct module boundaries (`people`, `time`, `payroll`, `projects`, `sales`, `purchase`, `stock`, `finance`, `compliance`, `documents`, `reports`, `settings`) that communicate strictly via contracts and asynchronous domain events.
- **Multi-Deployment Target**: Single unified codebase supports:
  1. Offline Desktop installation (with local storage, automated backups, and SHA-256 verification).
  2. Self-hosted / On-Premise deployment.
  3. Online Cloud Hosted deployment (PostgreSQL via Google Cloud SQL).

---

## 2. Directory & Repository Structure

```
├── ARCHITECTURE.md                  # Comprehensive architectural documentation & decision log
├── package.json                     # Dependencies, scripts (dev, test, lint, build)
├── tsconfig.json                    # Strict TypeScript configuration
├── vite.config.ts                   # Frontend bundle configuration with alias & middleware support
├── server.ts                        # Fullstack Express API server + Vite dev middleware
├── firebase-applet-config.json      # Platform OAuth & Firebase configuration
├── tests/                           # Vitest automated test suite
│   ├── money.spec.ts                # Decimal-safe monetary arithmetic & GCC currency tests
│   ├── result.spec.ts               # Railway-oriented Result monad tests
│   ├── aggregate-root.spec.ts       # Entity identity & domain events tests
│   ├── event-bus.spec.ts            # Decoupled domain event dispatching tests
│   ├── i18n.spec.ts                 # Bilingual translation & RTL direction tests
│   └── runtime.spec.ts              # Desktop & cloud runtime abstraction tests
├── src/
│   ├── core/                        # Pure Domain & Application Layer (Zero Framework Deps)
│   │   ├── domain/
│   │   │   ├── entity.ts            # Entity<TId> base with identity equality
│   │   │   ├── aggregate-root.ts    # AggregateRoot<TId> with domain events lifecycle
│   │   │   ├── value-object.ts      # Immutable ValueObject<TProps> with structural equality
│   │   │   ├── domain-event.ts      # DomainEvent contract (eventId, occurredAt, payload)
│   │   │   ├── result.ts            # Result<T, E> monad for railway-oriented error handling
│   │   │   ├── money.ts             # Decimal-safe monetary value object (Decimal.js, Banker's Rounding)
│   │   │   ├── tenant-context.ts    # TenantContext & TenantContextHolder for company isolation
│   │   │   └── audit-trail.ts       # AuditRecord, AuditActor, AuditAction domain models
│   │   ├── application/
│   │   │   ├── use-case.ts          # IUseCase<TInput, TOutput> contract
│   │   │   ├── event-bus.ts         # IEventBus contract (publish, subscribe)
│   │   │   └── unit-of-work.ts      # IUnitOfWork contract for atomic transaction boundaries
│   │   ├── errors/
│   │   │   └── app-error.ts         # Typed error hierarchy (DomainError, ValidationError, etc.)
│   │   ├── logging/
│   │   │   ├── logger.interface.ts  # ILogger contract
│   │   │   └── logger.ts            # AppLogger structured JSON logger
│   │   └── config/
│   │       └── app-config.ts        # Type-safe environment loader & runtime target resolver
│   ├── infrastructure/              # Infrastructure & Technology Adapters
│   │   ├── database/
│   │   │   ├── repositories/
│   │   │   │   └── base.repository.ts # Generic IRepository & ITenantScopedRepository
│   │   │   └── migrations/
│   │   │       ├── 0001_initial_core_schema.sql # Reproducible baseline SQL schema
│   │   │       └── migration-runner.ts # Checksum-verified migration runner
│   │   ├── runtime/
│   │   │   ├── runtime-context.ts   # IRuntimeAdapter, IBackupService, IStorageService
│   │   │   ├── desktop-runtime.ts   # Desktop offline adapter with encrypted backups
│   │   │   ├── hosted-runtime.ts    # Cloud hosted adapter
│   │   │   └── index.ts             # Runtime factory & singleton exporter
│   │   └── events/
│   │       └── in-memory-event-bus.ts # Production in-memory event bus
│   ├── db/                          # Cloud SQL & Drizzle ORM Setup
│   │   ├── drizzle.config.ts        # Drizzle Kit admin credentials config
│   │   ├── schema.ts                # Schema: tenants, users, compliance_rules, audit_logs, migrations
│   │   ├── index.ts                 # Connection pool (Object Method) & Drizzle instance
│   │   └── users.ts                 # getOrCreateUser upsert helper
│   ├── lib/
│   │   ├── firebase.ts              # Firebase client auth initialization
│   │   └── firebase-admin.ts        # Firebase Admin SDK initialization
│   ├── middleware/
│   │   └── auth.ts                  # requireAuth Express middleware
│   ├── modules/
│   │   └── module.manifest.ts       # Modular monolith bounded contexts registry
│   ├── shared/
│   │   └── i18n/
│   │       ├── translations/
│   │       │   ├── en.ts            # English translations
│   │       │   └── ar.ts            # Arabic translations
│   │       ├── i18n.ts              # Translation service with interpolation & date formatting
│   │       └── I18nContext.tsx      # React Context synchronizing HTML `dir` and `lang`
│   ├── App.tsx                      # Architecture diagnostic & foundation deck
│   ├── index.css                    # Tailwind CSS & Arabic typography styling
│   └── main.tsx                     # React 19 entry point
```

---

## 3. Database Architecture & Cloud SQL Setup
1. **Provisioned Instance**: Google Cloud SQL PostgreSQL instance (`ai-studio-2a4207b7`) provisioned in region `asia-southeast1`.
2. **Connection Pooling**: Configured via `pg.Pool` using the **Object Method** (`host`, `user`, `password`, `database`, `max`, `connectionTimeoutMillis`). Eager startup probes and retry loops are strictly avoided in compliance with serverless guidelines.
3. **Admin vs App Credentials**:
   - `SQL_ADMIN_USER` & `SQL_ADMIN_PASSWORD`: Used by `drizzle.config.ts` for schema migrations.
   - `SQL_USER` & `SQL_PASSWORD`: Used at runtime for application operations.
4. **Initial Schema Definition**:
   - `tenants`: Primary tenant/company entity enforcing data boundaries.
   - `users`: Linked with Firebase Auth `uid` (unique), role permissions, and tenant scope.
   - `compliance_rules`: Versioned GCC statutory legal rules (effective dates, parameters JSONB, legal source).
   - `audit_logs`: Immutable audit trails capturing actor, action, timestamp, entity diffs.
   - `schema_migrations`: Deterministic migration ledger storing versions, checksums, and execution times.
5. **Schema Verification**: Executed via Cloud SQL RPC `UpdateSchema` and verified with direct SQL queries on `information_schema.columns`.

---

## 4. Monetary Engine (Zero Floating-Point Arithmetic)
The `Money` domain value object guarantees exact mathematical determinism:
- **Precision**: Configured with 30 significant digits using `decimal.js`.
- **GCC Currencies**:
  - `KWD`: 3 decimals (1 Kuwaiti Dinar = 1,000 fils).
  - `BHD`: 3 decimals (1 Bahraini Dinar = 1,000 fils).
  - `OMR`: 3 decimals (1 Omani Rial = 1,000 baisa).
  - `SAR`, `AED`, `QAR`: 2 decimals (100 halalas / fils / dirhams).
- **Rounding Policy**: Defaults to Banker's Rounding (`HALF_EVEN`) to eliminate statistical bias in payroll and accounting ledgers.
- **Remainder-Free Allocation**: Distributes fractional amounts across ratios down to the exact subunit (fils) without leaking or manufacturing currency.

---

## 5. Versioned Statutory Compliance Engine
In compliance with the GulfHive Master Instruction:
- Statutory rules (e.g. GOSI pension contributions, Kuwait Labor Law indemnity, Saudi Wage Protection System formats) are stored as versioned records.
- Each rule record defines `country`, `category`, `version`, `effective_from`, `effective_to`, `parameters`, `calculation_method`, `legal_reference`, and `approval_status`.
- Historical transactions retain foreign key references to the rule version active when calculated, ensuring that retroactive recalculations are never performed silently.

---

## 6. Internationalization & Bi-directional Support (LTR / RTL)
- **Mandatory First-Phase Bilingualism**: English and Arabic are first-class languages throughout the architecture.
- **Translation Keys**: All UI strings are decoupled from presentation components using structured keys.
- **Dynamic Directionality**: Switching language to Arabic dynamically sets `dir="rtl"` and `lang="ar"` on the root document element, adjusting alignments, tables, and typography.

---

## 7. Runtime Target Abstraction
- Defined by `IRuntimeAdapter` with implementations:
  - `DesktopRuntimeAdapter`: Handles offline deployment, local filesystem document persistence, automated daily backups with SHA-256 integrity verification.
  - `HostedRuntimeAdapter`: Handles cloud persistence, Cloud SQL managed backups, and regional high-availability replication.

---

## 8. Quality Gate & Verification Audit
- **Linter**: `tsc --noEmit` executed and passed with 0 errors.
- **Unit & Integration Tests**: 24 tests executed across 7 test suites via Vitest:
  - `tenant.spec.ts`: 5 tests passed (GCC compliance, country validation, fiscal year bounds, branch binding).
  - `money.spec.ts`: 7 tests passed (precision, floating point rejection, subunit conversion, remainder-safe allocation, Banker's rounding, currency safety).
  - `result.spec.ts`: 3 tests passed (railway-oriented error handling).
  - `aggregate-root.spec.ts`: 2 tests passed (domain event lifecycle & entity identity).
  - `event-bus.spec.ts`: 2 tests passed (event delivery & handler fault isolation).
  - `i18n.spec.ts`: 3 tests passed (English/Arabic translation, RTL switching, interpolation).
  - `runtime.spec.ts`: 2 tests passed (desktop & cloud runtime abstraction).
- **Compilation**: Applet compiled cleanly with zero build errors.

---

## 9. Tenant, Company, Branch & RBAC Implementation
1. **Zero-Dummy Baseline Guarantee**:
   - The system strictly forbids automatic seeding of fake companies or dummy tenants.
   - On initialization with 0 companies, the system renders the 5-step First-Run Company Setup Wizard.
2. **Company & Branch Hierarchy**:
   - Each company maintains legal identity (CR Number, Tax/VAT TIN, Arabic & English legal names, ISO currency, fiscal calendar).
   - Under each company, operational sites and headquarters are modeled via `branches`, with foreign key cascades and a designated primary main branch (`is_main = true`).
3. **Role-Based Access Control (RBAC)**:
   - Tables: `roles`, `permissions`, `role_permissions`, `user_tenants`.
   - Granular permissions seeded across all 12 modules.
   - Built-in system roles: `COMPANY_ADMIN`, `FINANCE_MANAGER`, `HR_MANAGER`, `AUDITOR`.
   - Users are linked to companies and branches via `user_tenants` with specific role authorizations.
4. **Audit Trail Accountability**:
   - Company setup, branch additions, and role assignments trigger immutable entries in `audit_logs` storing actor identity, timestamps, action type, and resulting state differentials.

---

## 10. Design System & Application Shell Architecture
1. **Zero-Pill & Typographic Discipline**:
   - Strict adherence to anti-slop rules: static metadata is presented with unboxed text and clean typographic separators (`·`), reserving interactive backgrounds only for clickable filter segments and action buttons.
   - Spatial math applied consistently: button horizontal padding $\approx 2\times$ vertical padding, container padding $\ge$ child margins, single-elevation depth.
2. **Unified Bidi (LTR/RTL) System**:
   - Every design system component (`AppShell`, `Sidebar`, `TopBar`, `Table`, `Dialog`, `Drawer`, `Toast`, `Breadcrumbs`, `SearchPalette`) renders seamlessly in English LTR and Arabic RTL from the identical source code without duplicate style files.
3. **Responsive Shell Primitives**:
   - **Sidebar**: Persistent desktop sidebar with 1-click collapse (240px to 64px icon rail) and mobile slide-out drawer.
   - **TopBar**: Compact header with global search shell trigger (`⌘K`), active company/branch scope switcher, language toggle, and notification drawer.
   - **SearchPalette**: Keyboard-navigable modal command palette (`Cmd/Ctrl + K`) for instant module and record navigation.
   - **Data Grid (Table)**: Enterprise table supporting column sorting, client search filtering, and localized pagination.
   - **Dialog & Drawer**: Accessible overlays with escape key trapping and native RTL alignment.
   - **Toast Provider**: Centralized non-intrusive alert system with auto-dismissal.

---

## 11. People Module Architecture
1. **Single Authoritative Master Record**:
   - The `employees` table serves as the authoritative master record for all personnel.
   - Submodules (Time/Attendance, Payroll, Workforce Deployment, Documents) reference `employees.id` via foreign key constraints, strictly prohibiting data duplication.
2. **Normalized Relational Sub-entities**:
   - `departments`: Functional organizational branches and hierarchical parent relationships.
   - `designations`: Job titles linked to departments with seniority grades.
   - `employee_contracts`: Legal contracts, unlimited/limited status, probation and notice clauses.
   - `employee_salaries`: Baseline compensation structure with decimal-safe allowances.
   - `employee_bank_details`: GCC Wage Protection System (WPS) bank code, IBAN, and account numbers.
   - `employee_documents`: Civil ID, Iqama, Passport, Visas, and Work Permits with expiration date monitoring.
   - `employee_history`: Append-only career audit log capturing promotions, transfers, and revisions.
3. **Enterprise ID Card Generation**:
   - Integrated print-optimized security credential (`EmployeeIdCard.tsx`) rendering dual English and Arabic typography, QR verification, employee number, designation, and blood group.

---

## 12. Time, Attendance & Approval Engine Architecture
1. **Attendance Tracking & Daily Punches**:
   - `attendance_records`: Captures check-in and check-out timestamps with multiple ingress sources (`BIOMETRIC`, `WEB`, `MOBILE`, `MANUAL`).
   - Computes daily regular hours, total minutes, late arrivals against shift grace periods, early departures, and overtime.
2. **Shifts & Dynamic Rosters**:
   - `shifts`: Configurable templates with start/end times, break durations, grace periods, and overnight shift flags.
   - `roster_assignments`: Links employees to shifts across specific date ranges and branch locations.
3. **Statutory GCC Overtime Engine**:
   - `overtime_records`: Overtime calculations are strictly bounded by country-specific statutory multiplier policies:
     - Kuwait (Law 6/2010 Art. 66): 1.25x for normal days, 1.50x for weekend rest days, 2.00x for official public holidays.
     - Saudi Arabia (Labor Law Art. 107): 1.50x for overtime hours.
4. **Statutory Leave & Public Holidays**:
   - `leave_types`: GCC legal categories (Annual, Certified Sick, Hajj Pilgrimage, Maternity, Compassionate, Unpaid).
   - `leave_requests`: Employee applications with duration validation and balance tracking.
   - `holidays`: Multi-day observance windows with single-year and annual recurring policies.
5. **Reusable Approval Workflow Engine**:
   - `approval_workflows`: Unified audit trail for all approval-based processes (`LEAVE_REQUEST`, `OVERTIME_REQUEST`, `ATTENDANCE_CORRECTION`, `PAYROLL_RUN`, `FINAL_SETTLEMENT`).
   - Tracks actor identity, action type (`SUBMITTED`, `APPROVED`, `REJECTED`), timestamps, and reviewer comments.

---

## 13. Deterministic Payroll Engine & WPS Adapter Architecture
1. **Pipeline Aggregation & Decimal Precision**:
   - `payroll_runs` & `payroll_items`: Deterministic calculation pipeline using `Money` decimal-safe BigInt arithmetic.
   - Aggregates Employee Contract -> Base Salary & Allowances -> Attendance & Approved Overtime -> Unpaid Leave Deductions -> Active Loan Monthly Installments -> Statutory Social Insurance (PIFSS in Kuwait, GOSI in Saudi) -> Net Pay.
2. **Explainability & Statutory Audit Trace**:
   - Every `payroll_items` record stores a JSON `calculation_breakdown` trace documenting base package, overtime hourly rates and multipliers, leave daily rates, loan balances, and social security scheme rates.
3. **Locking & Controlled Approval Workflows**:
   - Payroll runs follow `DRAFT` -> `VALIDATED` -> `APPROVED` state machine.
   - Approved payroll runs are immutable and write loan deduction recoveries back to `employee_loans`.
4. **GCC Wage Protection System (WPS) & Spreadsheet Adapters**:
   - `exportWpsSif()`: Generates standard SIF (Salary Information File) compliant with GCC Central Banks (Header `SCR` with Employer CR, Bank Routing Code, Value Date, Total Wages; Detail `EDR` with Employee Civil ID, IBAN, Basic Salary, Allowances, Deductions).
   - `exportExcelCsv()`: Generates formatted spreadsheet reports with full employee metadata and salary component columns.
5. **End of Service Benefits (EOSB) / Indemnity Engine**:
   - `final_settlements`: Calculates statutory gratuity per Kuwait Labor Law Art. 51/53 (15 days/yr for first 5 yrs, 1 mo/yr thereafter, resignation reduction table) and Saudi Labor Law Art. 84/85.
   - Includes accrued leave encashment, unpaid salary, loan recoveries, and automated employee status transition upon approval.





