# GulfHive ERP — Security Guidelines & Architecture

This document details the security principles embedded within GulfHive ERP to prevent OWASP Top 10 exploits, maintain tenant isolation, and secure sensitive employee records.

## 1. Multi-Tenant Row-Level Isolation
- Every business record is tagged with an immutable `tenant_id`.
- The request-scoped `AsyncLocalStorage` tenant context prevents ambient database leakage.
- Database queries include explicit `and(eq(table.tenantId, currentTenant))` conditions.
- Attempting to pass foreign key parameters of other tenants (e.g., trying to join a client from another company) triggers a `Cross-company reference violation` exception in repositories.

## 2. Authentication and Password Storage
- Standard plain-text password verification or simple fallback passwords are strictly blocked.
- All password hashes are created using salt-PBKDF2/scrypt, ensuring cryptographically distinct hashes even for identical passwords.
- Empty or invalid hash parameters passed to `verifyPassword` automatically fail open-rejection checks.

## 3. Server-Side Data Sanitization (Employee Profiling)
- Sensitive fields (such as `basicSalary`, `civilIdNumber`, `passportNumber`, and IBAN details) are checked at the middleware level.
- Re-serialization removes raw salary properties and completely masks identity numbers (`******1234`) if the authenticated user lacks high-privilege credentials.

## 4. Path Traversal & Injection Defense
- Local file read/write methods check for illegal parent directory navigation patterns (`../` or `..\`).
- Attempts to navigate outside the authorized storage subdirectory trigger an immediate `PathTraversalError` and terminate the request.
