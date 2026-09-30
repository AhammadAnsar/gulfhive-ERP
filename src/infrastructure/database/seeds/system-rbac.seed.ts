/**
 * GulfHive ERP - System RBAC Seed
 * Seeds standard permissions and default system roles.
 */

import { Pool } from 'pg';
import { logger } from '../../../core/logging/logger.ts';

export const SYSTEM_PERMISSIONS = [
  // Company & Branch
  { code: 'company.view', module: 'company', action: 'view', nameEn: 'View Company Details', nameAr: 'عرض بيانات المنشأة', descriptionEn: 'View legal entity information', descriptionAr: 'عرض معلومات الكيان القانوني' },
  { code: 'company.manage', module: 'company', action: 'manage', nameEn: 'Manage Company', nameAr: 'إدارة المنشأة', descriptionEn: 'Update legal entity settings and tax configuration', descriptionAr: 'تحديث إعدادات المنشأة والتهيئة الضريبية' },
  { code: 'branch.view', module: 'branch', action: 'view', nameEn: 'View Branches', nameAr: 'عرض الفروع', descriptionEn: 'View company branch locations', descriptionAr: 'عرض فروع ومواقع المنشأة' },
  { code: 'branch.manage', module: 'branch', action: 'manage', nameEn: 'Manage Branches', nameAr: 'إدارة الفروع', descriptionEn: 'Create, modify, and close branch locations', descriptionAr: 'إنشاء وتعديل وإغلاق الفروع' },

  // User & Access Control
  { code: 'users.view', module: 'users', action: 'view', nameEn: 'View Users', nameAr: 'عرض المستخدمين', descriptionEn: 'View tenant users and profiles', descriptionAr: 'عرض مستخدمي وملفات المنشأة' },
  { code: 'users.manage', module: 'users', action: 'manage', nameEn: 'Manage Users', nameAr: 'إدارة المستخدمين', descriptionEn: 'Invite, edit, activate and deactivate users', descriptionAr: 'دعوة وتعديل وتفعيل وتعطيل المستخدمين' },
  { code: 'roles.view', module: 'roles', action: 'view', nameEn: 'View Roles & Permissions', nameAr: 'عرض الأدوار والصلاحيات', descriptionEn: 'View security roles and access matrices', descriptionAr: 'عرض مصفوفة الأدوار والصلاحيات' },
  { code: 'roles.manage', module: 'roles', action: 'manage', nameEn: 'Manage Roles', nameAr: 'إدارة الأدوار', descriptionEn: 'Create custom roles and assign permissions', descriptionAr: 'إنشاء أدوار مخصصة وتعيين الصلاحيات' },

  // Core Modules
  { code: 'people.view', module: 'people', action: 'view', nameEn: 'View Employee Master', nameAr: 'عرض سجل الموظفين', descriptionEn: 'View employee records and contracts', descriptionAr: 'عرض سجلات الموظفين والعقود' },
  { code: 'people.manage', module: 'people', action: 'manage', nameEn: 'Manage Employee Master', nameAr: 'إدارة سجل الموظفين', descriptionEn: 'Create and update employee records and contracts', descriptionAr: 'إنشاء وتحديث سجلات الموظفين والعقود' },
  { code: 'time.view', module: 'time', action: 'view', nameEn: 'View Attendance & Rosters', nameAr: 'عرض الحضور والمناوبات', descriptionEn: 'View shifts, punch logs, and leave requests', descriptionAr: 'عرض المناوبات وسجلات الحضور والإجازات' },
  { code: 'time.manage', module: 'time', action: 'manage', nameEn: 'Manage Attendance', nameAr: 'إدارة الحضور والانصراف', descriptionEn: 'Approve leaves, overtime, and adjust timesheets', descriptionAr: 'اعتماد الإجازات والساعات الإضافية وتعديل السجلات' },
  { code: 'payroll.calculate', module: 'payroll', action: 'calculate', nameEn: 'Calculate Payroll', nameAr: 'احتساب الرواتب', descriptionEn: 'Execute deterministic payroll runs', descriptionAr: 'تنفيذ مسيرات احتساب الرواتب' },
  { code: 'payroll.approve', module: 'payroll', action: 'approve', nameEn: 'Approve Payroll', nameAr: 'اعتماد مسير الرواتب', descriptionEn: 'Authorize finalized payroll runs and generate WPS files', descriptionAr: 'اعتماد مسيرات الرواتب وتوليد ملفات حماية الأجور' },
  { code: 'finance.view', module: 'finance', action: 'view', nameEn: 'View Financial Ledger', nameAr: 'عرض السجل المالي', descriptionEn: 'View chart of accounts and general journals', descriptionAr: 'عرض شجرة الحسابات وقيود اليومية العامة' },
  { code: 'finance.post', module: 'finance', action: 'post', nameEn: 'Post Journal Entries', nameAr: 'ترحيل القيود المحاسبية', descriptionEn: 'Post double-entry journal entries and close fiscal periods', descriptionAr: 'ترحيل القيود المزدوجة وإغلاق الفترات المالية' },
  { code: 'audit.view', module: 'audit', action: 'view', nameEn: 'View Audit Logs', nameAr: 'عرض سجلات التدقيق', descriptionEn: 'Inspect immutable system event audit trails', descriptionAr: 'فحص سجلات التدقيق غير القابلة للتعديل' },
  { code: 'compliance.view', module: 'compliance', action: 'view', nameEn: 'View Compliance Rules', nameAr: 'عرض أنظمة الامتثال', descriptionEn: 'Inspect GCC statutory rules and formulas', descriptionAr: 'فحص اللوائح والأنظمة الخليجية المعتمدة' },
];

export const DEFAULT_SYSTEM_ROLES = [
  {
    id: 'role_company_admin',
    code: 'COMPANY_ADMIN',
    nameEn: 'Company Administrator',
    nameAr: 'مدير المنشأة',
    descriptionEn: 'Full administrative control over company, branches, users, and operations.',
    descriptionAr: 'صلاحيات إدارية كاملة على إعدادات المنشأة والفروع والمستخدمين والعمليات.',
    isSystemRole: true,
    permissionCodes: SYSTEM_PERMISSIONS.map((p) => p.code),
  },
  {
    id: 'role_finance_manager',
    code: 'FINANCE_MANAGER',
    nameEn: 'Finance Manager',
    nameAr: 'المدير المالي',
    descriptionEn: 'Access to general ledger, journals, payroll approval, and audit views.',
    descriptionAr: 'إدارة الحسابات العامة، القيود، اعتماد الرواتب، والتقارير المالية.',
    isSystemRole: true,
    permissionCodes: [
      'company.view',
      'branch.view',
      'payroll.calculate',
      'payroll.approve',
      'finance.view',
      'finance.post',
      'audit.view',
      'compliance.view',
    ],
  },
  {
    id: 'role_hr_manager',
    code: 'HR_MANAGER',
    nameEn: 'HR Manager',
    nameAr: 'مدير الموارد البشرية',
    descriptionEn: 'Access to employee master, attendance, shift rosters, and payroll preparation.',
    descriptionAr: 'إدارة ملفات الموظفين، سجلات الحضور والانصراف، وإعداد مسيرات الرواتب.',
    isSystemRole: true,
    permissionCodes: [
      'company.view',
      'branch.view',
      'people.view',
      'people.manage',
      'time.view',
      'time.manage',
      'payroll.calculate',
      'compliance.view',
    ],
  },
  {
    id: 'role_auditor',
    code: 'AUDITOR',
    nameEn: 'Internal / External Auditor',
    nameAr: 'مدقق داخلي / خارجي',
    descriptionEn: 'Read-only inspection rights across all operational ledgers and immutable audit trails.',
    descriptionAr: 'صلاحية استعراض وتدقيق شاملة لجميع السجلات والقيود دون صلاحية التعديل.',
    isSystemRole: true,
    permissionCodes: [
      'company.view',
      'branch.view',
      'users.view',
      'roles.view',
      'people.view',
      'time.view',
      'finance.view',
      'audit.view',
      'compliance.view',
    ],
  },
];

export async function seedSystemRbac(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Seed Permissions
    for (const perm of SYSTEM_PERMISSIONS) {
      await client.query(
        `INSERT INTO permissions (id, code, module, action, name_en, name_ar, description_en, description_ar)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (code) DO UPDATE SET
           name_en = EXCLUDED.name_en,
           name_ar = EXCLUDED.name_ar,
           description_en = EXCLUDED.description_en,
           description_ar = EXCLUDED.description_ar;`,
        [
          `perm_${perm.code.replace('.', '_')}`,
          perm.code,
          perm.module,
          perm.action,
          perm.nameEn,
          perm.nameAr,
          perm.descriptionEn,
          perm.descriptionAr,
        ]
      );
    }

    // 2. Seed Default Roles
    for (const role of DEFAULT_SYSTEM_ROLES) {
      await client.query(
        `INSERT INTO roles (id, code, name_en, name_ar, description_en, description_ar, is_system_role)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           name_en = EXCLUDED.name_en,
           name_ar = EXCLUDED.name_ar;`,
        [role.id, role.code, role.nameEn, role.nameAr, role.descriptionEn, role.descriptionAr, role.isSystemRole]
      );

      // Link Role Permissions
      for (const permCode of role.permissionCodes) {
        const permId = `perm_${permCode.replace('.', '_')}`;
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING;`,
          [role.id, permId]
        );
      }
    }

    await client.query('COMMIT');
    logger.info('System RBAC permissions and default roles seeded successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Failed to seed system RBAC', err);
    throw err;
  } finally {
    client.release();
  }
}
