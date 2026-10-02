import { createPool } from '../../../db/index.ts';
import { authRepository } from '../repositories/auth.repository.ts';

export async function ensureDefaultAdmin() {
  const p = createPool();
  const hash = authRepository.hashPassword('admin123456');

  // 1. Get or create tenant
  const tenantRes = await p.query('SELECT id FROM tenants ORDER BY id ASC LIMIT 1');
  let tenantId = tenantRes.rows[0]?.id;
  if (!tenantId) {
    tenantId = 'tenant_gulfhive_main';
    await p.query(`
      INSERT INTO tenants (id, code, legal_name_en, legal_name_ar, country_code, base_currency)
      VALUES ('tenant_gulfhive_main', 'GH-001', 'GulfHive Enterprise', 'مؤسسة الخليج للأنظمة', 'KWT', 'KWD')
      ON CONFLICT (id) DO NOTHING;
    `);
  }

  // 2. Ensure main branch
  const branchRes = await p.query('SELECT id FROM branches WHERE tenant_id = $1 LIMIT 1', [tenantId]);
  let branchId = branchRes.rows[0]?.id;
  if (!branchId) {
    branchId = 'branch_main_hq';
    await p.query(`
      INSERT INTO branches (id, tenant_id, code, name_en, name_ar, is_main, status)
      VALUES ('branch_main_hq', $1, 'HQ', 'Headquarters', 'المقر الرئيسي', true, 'ACTIVE')
      ON CONFLICT (id) DO NOTHING;
    `, [tenantId]);
  }

  // 3. Check if admin user exists by email or username
  const existingUserRes = await p.query(`
    SELECT id FROM users WHERE LOWER(email) = 'admin@gulfhive.internal' OR LOWER(username) = 'admin' LIMIT 1;
  `);

  let userId: number;
  if (existingUserRes.rows.length > 0) {
    userId = existingUserRes.rows[0].id;
    await p.query(`
      UPDATE users SET
        username = 'admin',
        email = 'admin@gulfhive.internal',
        password_hash = $1,
        display_name = 'System Administrator',
        status = 'ACTIVE',
        is_active = true,
        must_change_password = false,
        failed_login_attempts = 0,
        locked_until = NULL,
        tenant_id = $2,
        updated_at = NOW()
      WHERE id = $3;
    `, [hash, tenantId, userId]);
  } else {
    const insertRes = await p.query(`
      INSERT INTO users (
        uid, username, email, password_hash, display_name, status, is_active, must_change_password, failed_login_attempts, tenant_id
      ) VALUES (
        'admin_system_uid', 'admin', 'admin@gulfhive.internal', $1, 'System Administrator', 'ACTIVE', true, false, 0, $2
      ) RETURNING id;
    `, [hash, tenantId]);
    userId = insertRes.rows[0].id;
  }

  // 4. Ensure COMPANY_ADMIN and SUPER_ADMIN roles exist
  await p.query(`
    INSERT INTO roles (id, code, name_en, name_ar, is_system_role)
    VALUES
      ('role_company_admin', 'COMPANY_ADMIN', 'Company Administrator', 'مسؤول المنشأة', true),
      ('role_super_admin', 'SUPER_ADMIN', 'Super Administrator', 'المسؤول العام', true)
    ON CONFLICT (id) DO NOTHING;
  `);

  // 5. Link user to role
  await p.query(`
    INSERT INTO user_roles (user_id, role_id)
    VALUES ($1, 'role_company_admin'), ($1, 'role_super_admin')
    ON CONFLICT DO NOTHING;
  `, [userId]);

  // 6. Link user to company access
  await p.query(`
    INSERT INTO user_company_access (user_id, company_id, is_default, status)
    VALUES ($1, $2, true, 'ACTIVE');
  `, [userId, tenantId]);

  console.log(`[GulfHive Admin] Guaranteed admin user id=${userId} email=admin@gulfhive.internal password=admin123456 activeCompany=${tenantId}`);
  return { userId, tenantId };
}

if (process.argv[1]?.endsWith('ensure-admin.ts')) {
  ensureDefaultAdmin()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
