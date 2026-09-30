/**
 * GulfHive ERP - Centralized Permission Catalog & Security Codes
 * Defines authoritative RBAC permission strings across all modules.
 */

export const PERMISSIONS = {
  // Company & Organization
  COMPANY_VIEW: 'company.view',
  COMPANY_MANAGE: 'company.manage',
  BRANCH_VIEW: 'branch.view',
  BRANCH_MANAGE: 'branch.manage',

  // Identity & Security
  USERS_VIEW: 'users.view',
  USERS_MANAGE: 'users.manage',
  ROLES_VIEW: 'roles.view',
  ROLES_MANAGE: 'roles.manage',
  SESSIONS_MANAGE: 'users.manage',

  // Master Data & Numbering
  MASTER_VIEW: 'company.view',
  MASTER_MANAGE: 'company.manage',
  NUMBERING_VIEW: 'company.view',
  NUMBERING_MANAGE: 'company.manage',

  // People & Employee Master
  PEOPLE_VIEW: 'people.view',
  PEOPLE_MANAGE: 'people.manage',
  PEOPLE_SALARY_VIEW: 'people.salary.view',
  PEOPLE_BANK_VIEW: 'people.bank.view',
  PEOPLE_IDENTITY_VIEW: 'people.identity.view',
  PEOPLE_DOCUMENT_VIEW: 'people.document.view',

  // Time, Shifts & Attendance
  TIME_VIEW: 'time.view',
  TIME_MANAGE: 'time.manage',
  ROSTER_MANAGE: 'time.manage',
  LEAVE_VIEW: 'time.view',
  LEAVE_MANAGE: 'time.manage',
  OVERTIME_VIEW: 'time.view',
  OVERTIME_MANAGE: 'time.manage',

  // Payroll Engine
  PAYROLL_VIEW: 'payroll.view',
  PAYROLL_PROCESS: 'payroll.process',
  PAYROLL_APPROVE: 'payroll.approve',

  // Sales & Receivables
  SALES_VIEW: 'sales.view',
  SALES_MANAGE: 'sales.manage',
  SALES_APPROVE: 'sales.approve',

  // Procurement & Payables
  PROCUREMENT_VIEW: 'procurement.view',
  PROCUREMENT_MANAGE: 'procurement.manage',
  PROCUREMENT_APPROVE: 'procurement.approve',

  // Projects, Subcontracts & External Workforce
  PROJECTS_VIEW: 'projects.view',
  PROJECTS_MANAGE: 'projects.manage',
  WORKFORCE_DEPLOY_MANAGE: 'projects.manage',
  LABOUR_SETTLEMENT_APPROVE: 'projects.manage',

  // Finance & General Ledger
  FINANCE_VIEW: 'finance.view',
  FINANCE_POST: 'finance.post',

  // Audit Trail
  AUDIT_VIEW: 'audit.view',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
