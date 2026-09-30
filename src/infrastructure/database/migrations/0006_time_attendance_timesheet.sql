-- GulfHive ERP Time, Attendance & Timesheet Module Migration
-- Migration: 0006_time_attendance_timesheet.sql

-- 1. Work Schedules Table
CREATE TABLE IF NOT EXISTS work_schedules (
  id VARCHAR(64) PRIMARY KEY,
  numeric_id SERIAL UNIQUE,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(32) NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  schedule_type VARCHAR(32) NOT NULL DEFAULT 'REGULAR', -- REGULAR, FLEXIBLE, ROTATING, RAMADAN_OVERRIDE
  weekly_hours NUMERIC(5, 2) DEFAULT 40.00,
  default_shift_id VARCHAR(64),
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  effective_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  effective_to TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_by TEXT,
  archived_at TIMESTAMP WITH TIME ZONE,
  archived_by TEXT
);

-- 2. Break Policies Table
CREATE TABLE IF NOT EXISTS break_policies (
  id VARCHAR(64) PRIMARY KEY,
  numeric_id SERIAL UNIQUE,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(32) NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  break_type VARCHAR(32) NOT NULL DEFAULT 'UNPAID', -- PAID, UNPAID
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  calculation_method VARCHAR(32) NOT NULL DEFAULT 'FIXED', -- FIXED, CLOCKED, AUTOMATIC_DEDUCTION
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_by TEXT
);

-- 3. Enhance Shifts Table
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS numeric_id SERIAL;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS crosses_midnight BOOLEAN DEFAULT false NOT NULL;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS scheduled_minutes INTEGER DEFAULT 480 NOT NULL;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS break_policy_id VARCHAR(64) REFERENCES break_policies(id) ON DELETE SET NULL;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS grace_out_minutes INTEGER DEFAULT 15 NOT NULL;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS early_in_policy VARCHAR(32) DEFAULT 'IGNORE' NOT NULL;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS late_in_policy VARCHAR(32) DEFAULT 'DEDUCT_LATE' NOT NULL;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS early_out_policy VARCHAR(32) DEFAULT 'DEDUCT_EARLY' NOT NULL;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'ACTIVE' NOT NULL;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS effective_from TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS effective_to TIMESTAMP WITH TIME ZONE;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- 4. Shift Patterns Table
CREATE TABLE IF NOT EXISTS shift_patterns (
  id VARCHAR(64) PRIMARY KEY,
  numeric_id SERIAL UNIQUE,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(32) NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  cycle_length_days INTEGER NOT NULL DEFAULT 7,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_by TEXT
);

-- 5. Shift Pattern Days Table
CREATE TABLE IF NOT EXISTS shift_pattern_days (
  id SERIAL PRIMARY KEY,
  pattern_id VARCHAR(64) NOT NULL REFERENCES shift_patterns(id) ON DELETE CASCADE,
  sequence_day INTEGER NOT NULL, -- 1 to cycle_length_days
  shift_id VARCHAR(64) REFERENCES shifts(id) ON DELETE SET NULL,
  is_rest_day BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 6. Employee Schedule Assignments Table
CREATE TABLE IF NOT EXISTS employee_schedule_assignments (
  id VARCHAR(64) PRIMARY KEY,
  numeric_id SERIAL UNIQUE,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_schedule_id VARCHAR(64) REFERENCES work_schedules(id) ON DELETE SET NULL,
  shift_pattern_id VARCHAR(64) REFERENCES shift_patterns(id) ON DELETE SET NULL,
  default_shift_id VARCHAR(64) REFERENCES shifts(id) ON DELETE SET NULL,
  effective_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  effective_to TIMESTAMP WITH TIME ZONE,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT
);

-- 7. Schedule Overrides Table (Ramadan / Seasonal Schedules)
CREATE TABLE IF NOT EXISTS schedule_overrides (
  id VARCHAR(64) PRIMARY KEY,
  numeric_id SERIAL UNIQUE,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(32) NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  override_type VARCHAR(32) NOT NULL DEFAULT 'RAMADAN', -- RAMADAN, SEASONAL, CLIENT_SPECIFIC, EMERGENCY
  effective_from VARCHAR(10) NOT NULL, -- YYYY-MM-DD
  effective_to VARCHAR(10) NOT NULL, -- YYYY-MM-DD
  daily_hours_reduction_minutes INTEGER NOT NULL DEFAULT 120,
  target_shift_id VARCHAR(64) REFERENCES shifts(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT
);

-- 8. Roster Entries Table
CREATE TABLE IF NOT EXISTS roster_entries (
  id VARCHAR(64) PRIMARY KEY,
  numeric_id SERIAL UNIQUE,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date VARCHAR(10) NOT NULL, -- YYYY-MM-DD
  shift_id VARCHAR(64) NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
  branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE SET NULL,
  project_id VARCHAR(64),
  site_id VARCHAR(64),
  client_id VARCHAR(64),
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT', -- DRAFT, PUBLISHED, CHANGED, CANCELLED
  source VARCHAR(32) NOT NULL DEFAULT 'MANUAL', -- MANUAL, SCHEDULE_PATTERN, BULK_IMPORT
  published_at TIMESTAMP WITH TIME ZONE,
  published_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_by TEXT
);

-- 9. Roster Change History Table
CREATE TABLE IF NOT EXISTS roster_change_history (
  id SERIAL PRIMARY KEY,
  roster_entry_id VARCHAR(64) NOT NULL REFERENCES roster_entries(id) ON DELETE CASCADE,
  old_shift_id VARCHAR(64) REFERENCES shifts(id) ON DELETE SET NULL,
  new_shift_id VARCHAR(64) NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
  changed_by TEXT NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  reason TEXT NOT NULL
);

-- 10. Clock Events Table (Immutable raw punch evidence)
CREATE TABLE IF NOT EXISTS clock_events (
  id VARCHAR(64) PRIMARY KEY,
  numeric_id SERIAL UNIQUE,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  event_type VARCHAR(32) NOT NULL, -- IN, OUT, BREAK_START, BREAK_END
  source VARCHAR(32) NOT NULL DEFAULT 'MANUAL', -- MANUAL, EXCEL_IMPORT, BIOMETRIC, MOBILE, API, DESKTOP
  device_id VARCHAR(64),
  branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE SET NULL,
  site_id VARCHAR(64),
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  source_reference VARCHAR(128),
  is_duplicate BOOLEAN DEFAULT false NOT NULL,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT
);

-- 11. Attendance Days Table (Deterministic daily processed attendance record)
CREATE TABLE IF NOT EXISTS attendance_days (
  id VARCHAR(64) PRIMARY KEY,
  numeric_id SERIAL UNIQUE,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date VARCHAR(10) NOT NULL, -- YYYY-MM-DD
  roster_entry_id VARCHAR(64) REFERENCES roster_entries(id) ON DELETE SET NULL,
  shift_id VARCHAR(64) REFERENCES shifts(id) ON DELETE SET NULL,
  scheduled_start TIMESTAMP WITH TIME ZONE,
  scheduled_end TIMESTAMP WITH TIME ZONE,
  actual_first_in TIMESTAMP WITH TIME ZONE,
  actual_last_out TIMESTAMP WITH TIME ZONE,
  scheduled_minutes INTEGER NOT NULL DEFAULT 0,
  worked_minutes INTEGER NOT NULL DEFAULT 0,
  break_minutes INTEGER NOT NULL DEFAULT 0,
  late_minutes INTEGER NOT NULL DEFAULT 0,
  early_leave_minutes INTEGER NOT NULL DEFAULT 0,
  overtime_candidate_minutes INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'PRESENT', -- PRESENT, ABSENT, LATE, PARTIAL, REST_DAY, HOLIDAY, LEAVE, MISSING_PUNCH, NOT_SCHEDULED
  processing_version INTEGER NOT NULL DEFAULT 1,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_attendance_days_employee_date UNIQUE(tenant_id, employee_id, work_date)
);

-- 12. Attendance Exceptions Table
CREATE TABLE IF NOT EXISTS attendance_exceptions (
  id VARCHAR(64) PRIMARY KEY,
  numeric_id SERIAL UNIQUE,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  attendance_day_id VARCHAR(64) NOT NULL REFERENCES attendance_days(id) ON DELETE CASCADE,
  exception_type VARCHAR(32) NOT NULL, -- MISSING_IN, MISSING_OUT, LATE_ARRIVAL, EARLY_DEPARTURE, UNEXPECTED_ABSENCE, UNEXPECTED_ATTENDANCE, EXCESSIVE_HOURS, OVERLAPPING_CLOCK, DUPLICATE_PUNCH, SCHEDULE_MISMATCH
  severity VARCHAR(16) NOT NULL DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, CRITICAL
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN', -- OPEN, UNDER_REVIEW, RESOLVED, IGNORED
  description TEXT NOT NULL,
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by TEXT,
  resolution_type VARCHAR(32), -- CORRECTION_APPLIED, JUSTIFIED, WAIVED, DEDUCTION_CONFIRMED
  notes TEXT
);

-- 13. Holiday Calendars Table
CREATE TABLE IF NOT EXISTS holiday_calendars (
  id VARCHAR(64) PRIMARY KEY,
  numeric_id SERIAL UNIQUE,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(32) NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  country_id INTEGER REFERENCES countries(id) ON DELETE SET NULL,
  branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_by TEXT
);

-- Enhance Holidays Table
ALTER TABLE holidays ADD COLUMN IF NOT EXISTS numeric_id SERIAL;
ALTER TABLE holidays ADD COLUMN IF NOT EXISTS holiday_calendar_id VARCHAR(64) REFERENCES holiday_calendars(id) ON DELETE SET NULL;
ALTER TABLE holidays ADD COLUMN IF NOT EXISTS holiday_date VARCHAR(10);
ALTER TABLE holidays ADD COLUMN IF NOT EXISTS holiday_type VARCHAR(32) DEFAULT 'PUBLIC' NOT NULL;
ALTER TABLE holidays ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT true NOT NULL;
ALTER TABLE holidays ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'ACTIVE' NOT NULL;

-- 14. Timesheets Table
CREATE TABLE IF NOT EXISTS timesheets (
  id VARCHAR(64) PRIMARY KEY,
  numeric_id SERIAL UNIQUE,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  timesheet_number VARCHAR(32) NOT NULL,
  period_start VARCHAR(10) NOT NULL, -- YYYY-MM-DD
  period_end VARCHAR(10) NOT NULL, -- YYYY-MM-DD
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT', -- DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, LOCKED
  total_regular_minutes INTEGER NOT NULL DEFAULT 0,
  total_overtime_minutes INTEGER NOT NULL DEFAULT 0,
  submitted_at TIMESTAMP WITH TIME ZONE,
  submitted_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by TEXT,
  rejection_reason TEXT,
  locked_at TIMESTAMP WITH TIME ZONE,
  locked_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_by TEXT
);

-- 15. Timesheet Lines Table
CREATE TABLE IF NOT EXISTS timesheet_lines (
  id SERIAL PRIMARY KEY,
  timesheet_id VARCHAR(64) NOT NULL REFERENCES timesheets(id) ON DELETE CASCADE,
  work_date VARCHAR(10) NOT NULL, -- YYYY-MM-DD
  attendance_day_id VARCHAR(64) REFERENCES attendance_days(id) ON DELETE SET NULL,
  project_id VARCHAR(64),
  site_id VARCHAR(64),
  client_id VARCHAR(64),
  cost_center_id VARCHAR(64) REFERENCES cost_centers(id) ON DELETE SET NULL,
  activity_code_id VARCHAR(64),
  regular_minutes INTEGER NOT NULL DEFAULT 0,
  overtime_minutes INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);

-- 16. Enhance Attendance Corrections Table
ALTER TABLE attendance_corrections ADD COLUMN IF NOT EXISTS numeric_id SERIAL;
ALTER TABLE attendance_corrections ADD COLUMN IF NOT EXISTS attendance_day_id VARCHAR(64) REFERENCES attendance_days(id) ON DELETE CASCADE;
ALTER TABLE attendance_corrections ADD COLUMN IF NOT EXISTS requested_first_in TIMESTAMP WITH TIME ZONE;
ALTER TABLE attendance_corrections ADD COLUMN IF NOT EXISTS requested_last_out TIMESTAMP WITH TIME ZONE;
ALTER TABLE attendance_corrections ADD COLUMN IF NOT EXISTS requested_by TEXT;
ALTER TABLE attendance_corrections ADD COLUMN IF NOT EXISTS requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE attendance_corrections ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE attendance_corrections ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE attendance_corrections ADD COLUMN IF NOT EXISTS rejected_by TEXT;
ALTER TABLE attendance_corrections ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;

-- 17. Seed Granular Time Permissions
INSERT INTO permissions (id, code, name_en, name_ar, module, resource, action) VALUES
  ('perm_time_att_view', 'time.attendance.view', 'View Attendance', 'عرض الحضور والانصراف', 'TIME', 'time', 'VIEW'),
  ('perm_time_att_manage', 'time.attendance.manage', 'Manage Attendance & Punches', 'إدارة الحضور والتبصيم', 'TIME', 'time', 'MANAGE'),
  ('perm_time_roster_view', 'time.roster.view', 'View Rosters', 'عرض جداول المناوبات', 'TIME', 'time', 'VIEW'),
  ('perm_time_roster_manage', 'time.roster.manage', 'Manage Rosters', 'إدارة جداول المناوبات', 'TIME', 'time', 'MANAGE'),
  ('perm_time_roster_publish', 'time.roster.publish', 'Publish Rosters', 'اعتماد ونشر الجداول', 'TIME', 'time', 'PUBLISH'),
  ('perm_time_shift_view', 'time.shift.view', 'View Shifts & Schedules', 'عرض الورديات ومواعيد العمل', 'TIME', 'time', 'VIEW'),
  ('perm_time_shift_manage', 'time.shift.manage', 'Manage Shifts & Schedules', 'إدارة الورديات ومواعيد العمل', 'TIME', 'time', 'MANAGE'),
  ('perm_time_ts_view', 'time.timesheet.view', 'View Timesheets', 'عرض سجلات الدوام', 'TIME', 'time', 'VIEW'),
  ('perm_time_ts_create', 'time.timesheet.create', 'Create Timesheets', 'إنشاء سجل دوام', 'TIME', 'time', 'CREATE'),
  ('perm_time_ts_edit', 'time.timesheet.edit', 'Edit Timesheets', 'تعديل سجل الدوام', 'TIME', 'time', 'EDIT'),
  ('perm_time_ts_submit', 'time.timesheet.submit', 'Submit Timesheets', 'إرسال سجل الدوام للاعتماد', 'TIME', 'time', 'SUBMIT'),
  ('perm_time_ts_approve', 'time.timesheet.approve', 'Approve Timesheets', 'اعتماد سجلات الدوام', 'TIME', 'time', 'APPROVE'),
  ('perm_time_ts_lock', 'time.timesheet.lock', 'Lock Timesheets', 'إقفال سجلات الدوام للرواتب', 'TIME', 'time', 'LOCK'),
  ('perm_time_corr_create', 'time.correction.create', 'Request Attendance Correction', 'طلب تعديل بصمة / حضور', 'TIME', 'time', 'CREATE'),
  ('perm_time_corr_approve', 'time.correction.approve', 'Approve Attendance Corrections', 'اعتماد تصحيحات الحضور', 'TIME', 'time', 'APPROVE'),
  ('perm_time_ot_view', 'time.overtime.view', 'View Overtime Time', 'عرض ساعات العمل الإضافي', 'TIME', 'time', 'VIEW'),
  ('perm_time_ot_approve', 'time.overtime.approve', 'Approve Overtime Time', 'اعتماد ساعات العمل الإضافي', 'TIME', 'time', 'APPROVE'),
  ('perm_time_hol_view', 'time.holiday.view', 'View Holidays & Calendars', 'عرض العطل والتقويم', 'TIME', 'time', 'VIEW'),
  ('perm_time_hol_manage', 'time.holiday.manage', 'Manage Holidays & Calendars', 'إدارة العطل والتقويم', 'TIME', 'time', 'MANAGE'),
  ('perm_time_export', 'time.export', 'Export Time Data & Reports', 'تصدير بيانات وتقارير الدوام', 'TIME', 'time', 'EXPORT'),
  ('perm_time_import', 'time.import', 'Import Attendance & Clock Events', 'استيراد سجلات التبصيم والحضور', 'TIME', 'time', 'IMPORT')
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  name_en = EXCLUDED.name_en,
  name_ar = EXCLUDED.name_ar,
  module = EXCLUDED.module,
  resource = EXCLUDED.resource,
  action = EXCLUDED.action;

-- Grant permissions to COMPANY_ADMIN and HR_MANAGER
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role_company_admin', id FROM permissions WHERE code LIKE 'time.%'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role_hr_manager', id FROM permissions WHERE code LIKE 'time.%'
ON CONFLICT DO NOTHING;

-- Indexes for high-throughput attendance & query efficiency
CREATE INDEX IF NOT EXISTS idx_clock_events_emp_time ON clock_events(employee_id, event_timestamp);
CREATE INDEX IF NOT EXISTS idx_clock_events_tenant_time ON clock_events(tenant_id, event_timestamp);
CREATE INDEX IF NOT EXISTS idx_attendance_days_emp_date ON attendance_days(employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_days_tenant_date ON attendance_days(tenant_id, work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_days_status ON attendance_days(status);
CREATE INDEX IF NOT EXISTS idx_timesheets_emp_period ON timesheets(employee_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_timesheet_lines_ts_date ON timesheet_lines(timesheet_id, work_date);
CREATE INDEX IF NOT EXISTS idx_roster_entries_emp_date ON roster_entries(employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_exceptions_status ON attendance_exceptions(status);
