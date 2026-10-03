# GulfHive ERP — API Security Authorization Matrix

Generated Automatically: 2026-10-03T05:08:40.856Z
Release Verification Gate: PASS

| Endpoint Route | HTTP Method | Bounded-Context Module | Required Permission | No Auth Check | Cross-Tenant Block | RBAC Validation |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| `/companies/:companyId/people/employees` | `GET` | People | `people.view` | SECURED (401) | SECURED (403) | SECURED (403) |
| `/companies/:companyId/people/employees/:id` | `GET` | People | `people.view` | SECURED (401) | SECURED (403) | SECURED (403) |
| `/companies/:companyId/people/employees` | `POST` | People | `people.create` | SECURED (401) | SECURED (403) | SECURED (403) |
| `/companies/:companyId/people/employees/:id` | `PUT` | People | `people.update` | SECURED (401) | SECURED (403) | SECURED (403) |
| `/companies/:companyId/people/employees/:id` | `DELETE` | People | `people.delete` | SECURED (401) | SECURED (403) | SECURED (403) |
| `/companies/:companyId/people/employees/bulk-delete` | `POST` | People | `people.delete` | SECURED (401) | SECURED (403) | SECURED (403) |
| `/companies/:companyId/time/attendance` | `GET` | Time | `time.attendance.view` | SECURED (401) | SECURED (403) | SECURED (403) |
| `/companies/:companyId/time/attendance` | `POST` | Time | `time.attendance.create` | SECURED (401) | SECURED (403) | SECURED (403) |
| `/companies/:companyId/time/timesheets` | `GET` | Time | `time.timesheet.view` | SECURED (401) | SECURED (403) | SECURED (403) |
| `/companies/:companyId/payroll/runs` | `GET` | Payroll | `payroll.run.view` | SECURED (401) | SECURED (403) | SECURED (403) |
| `/companies/:companyId/payroll/runs` | `POST` | Payroll | `payroll.run.create` | SECURED (401) | SECURED (403) | SECURED (403) |
| `/companies/:companyId/payroll/runs/:id/post` | `POST` | Payroll | `payroll.run.post` | SECURED (401) | SECURED (403) | SECURED (403) |
| `/companies/:companyId/sales/clients` | `GET` | Sales | `sales.client.view` | SECURED (401) | SECURED (403) | SECURED (403) |
| `/companies/:companyId/sales/invoices/direct` | `POST` | Sales | `sales.invoice.create` | SECURED (401) | SECURED (403) | SECURED (403) |
| `/companies/:companyId/sales/receipts` | `POST` | Sales | `sales.receipt.create` | SECURED (401) | SECURED (403) | SECURED (403) |
| `/companies/:companyId/purchase/suppliers` | `GET` | Purchase | `purchase.supplier.view` | SECURED (401) | SECURED (403) | SECURED (403) |
| `/companies/:companyId/purchase/bills` | `POST` | Purchase | `purchase.bill.create` | SECURED (401) | SECURED (403) | SECURED (403) |
| `/companies/:companyId/projects` | `GET` | Projects | `projects.view` | SECURED (401) | SECURED (403) | SECURED (403) |
| `/companies/:companyId/projects` | `POST` | Projects | `projects.create` | SECURED (401) | SECURED (403) | SECURED (403) |
| `/companies/:companyId/reports/receivables-aging` | `GET` | Reports | `reports.financial.view` | SECURED (401) | SECURED (403) | SECURED (403) |
| `/companies/:companyId/reports/payroll-journal` | `GET` | Reports | `reports.financial.view` | SECURED (401) | SECURED (403) | SECURED (403) |

Total Scanned Business Routes: 21
Unclassified/Exposed Routes: 0

### Release Authorization Verdict
- **ZERO** unclassified enterprise endpoints.
- **100%** coverage of authentication, isolation, and custom permission gates.
