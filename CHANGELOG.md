# GulfHive ERP — Changelog

All notable changes to this project will be documented in this file. This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-09-30

### Added
- **Phase 1: Security Hardening & Authorization**
  - Implemented strict PBKDF2/scrypt password hashing with unique secure cryptographic salts.
  - Eliminated all hardcoded default bypass passwords and placeholder logic.
  - Created system-wide `authenticateToken` and `requireCompanyAccess` middlewares.
  - Added robust server-side employee record sanitization restricting Civil ID, Passport, and Salary visibility.
- **Phase 2: Multi-Tenant Isolation & Thread-Safe Context**
  - Integrated Express request-scoped state persistence using Node's native `AsyncLocalStorage`.
  - Added strict tenant boundary isolation checking parameters and cross-company database associations.
- **Phase 3: Relational Database Schema (Drizzle ORM & Postgres)**
  - Established initial relational schema with fully enforced primary, foreign key, and unique constraints.
  - Formulated row-level security policy skeletons and schema boundaries.
- **Phase 4: Unified Party Architecture & Procurement**
  - Unified Suppliers and Clients under the authoritative `Party` relational master.
  - Developed full Purchase Order, Supplier Billing, Payment Voucher, and Supplier Statement ledger tracking.
- **Phase 5: Compliance and Multi-Currency Payroll Engine**
  - Built deterministic payroll engine with support for 3-decimal currencies (KWD, BHD, OMR).
  - Enforced statutory PIFSS deductions for Kuwaiti Nationals and standard labor regimes for Expatriates.
  - Designed automated Kuwait Labor Law compliant End-of-Service Benefit (EOSB) indemnities.
- **Phase 6: Relational Migrations & DR Backup Systems**
  - Structured deterministic, transactional SQL schema migration runners with checksum verify.
  - Engineered local file and Cloud storage systems with path traversal defenses.
  - Coded automated PostgreSQL backup, list, verify, and transactional restore services.
- **Phase 7: Modular Refactoring & Bilingual PDF Engine**
  - Partitioned centralized routes into 11 distinct bounded-context routers.
  - Standardized the PDF/Excel generation engines with perfect English/Arabic (RTL) fonts (Amiri regular and bold).
- **Phase 8: Continuous Integration & Verification Gate**
  - Wrote local CI shell script pipeline (`scripts/ci-pipeline.sh`) and GitHub Actions workflow.
  - Structured robust database transaction, FK constraint, sequence concurrency, and posting immutability tests.
  - Created dynamic API security scanner mapping 100% of routes and writing `API_SECURITY_COVERAGE_REPORT.md`.
  - Designed disaster recovery backup restore drill verification specs.

### Changed
- Standardized package configuration to `gulfhive-erp` version `1.0.0`.
- Ensured perfect bilingual layout orientations for all generated legal PDF reports and receipts.
