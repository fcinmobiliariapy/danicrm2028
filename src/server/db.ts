import { createClient } from '@libsql/client';

export const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export async function logAudit(
  userId: number | null,
  username: string,
  action: string,
  module: string,
  recordId: string | number | bigint | undefined,
  details: string
) {
  try {
    await db.execute({
      sql: `INSERT INTO audit_logs (user_id, username, action, module, record_id, details) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [userId, username, action, module, recordId !== undefined ? String(recordId) : '', details],
    });
  } catch (err) {
    console.error('Error registrando auditoría:', err);
  }
}

export async function initSchema() {
  await db.batch([
    `PRAGMA foreign_keys = ON`,
    `CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      is_system INTEGER NOT NULL DEFAULT 1
    )`,
    `CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      module TEXT NOT NULL,
      action TEXT NOT NULL,
      label TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INTEGER NOT NULL,
      permission_id INTEGER NOT NULL,
      PRIMARY KEY (role_id, permission_id),
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      email TEXT DEFAULT '',
      password_hash TEXT NOT NULL,
      role_id INTEGER NOT NULL,
      custom_permissions_json TEXT DEFAULT '{}',
      active INTEGER NOT NULL DEFAULT 1,
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (role_id) REFERENCES roles(id)
    )`,
    `CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      name TEXT NOT NULL UNIQUE,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS districts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (department_id, name),
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS seccionales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department_id INTEGER NOT NULL,
      district_id INTEGER NOT NULL,
      number INTEGER NOT NULL,
      name TEXT DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (department_id, district_id, number),
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
      FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS coordinators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      ci TEXT NOT NULL UNIQUE,
      department_id INTEGER NOT NULL,
      district_id INTEGER NOT NULL,
      seccional_number INTEGER NOT NULL,
      phone TEXT NOT NULL,
      registered_at TEXT NOT NULL,
      notes TEXT DEFAULT '',
      consent_accepted INTEGER NOT NULL DEFAULT 1,
      custom_fields_json TEXT DEFAULT '{}',
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (district_id) REFERENCES districts(id)
    )`,
    `CREATE TABLE IF NOT EXISTS youth_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      ci TEXT NOT NULL UNIQUE,
      department_id INTEGER NOT NULL,
      district_id INTEGER NOT NULL,
      seccional_number INTEGER NOT NULL,
      phone TEXT NOT NULL,
      registered_at TEXT NOT NULL,
      notes TEXT DEFAULT '',
      consent_accepted INTEGER NOT NULL DEFAULT 1,
      custom_fields_json TEXT DEFAULT '{}',
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (district_id) REFERENCES districts(id)
    )`,
    `CREATE TABLE IF NOT EXISTS women_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      ci TEXT NOT NULL UNIQUE,
      department_id INTEGER NOT NULL,
      district_id INTEGER NOT NULL,
      seccional_number INTEGER NOT NULL,
      phone TEXT NOT NULL,
      registered_at TEXT NOT NULL,
      notes TEXT DEFAULT '',
      consent_accepted INTEGER NOT NULL DEFAULT 1,
      custom_fields_json TEXT DEFAULT '{}',
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (district_id) REFERENCES districts(id)
    )`,
    `CREATE TABLE IF NOT EXISTS onp_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      organization TEXT NOT NULL,
      registered_at TEXT NOT NULL DEFAULT (date('now')),
      notes TEXT DEFAULT '',
      custom_fields_json TEXT DEFAULT '{}',
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS vote_projections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coordinator_id INTEGER NOT NULL,
      department_id INTEGER NOT NULL,
      district_id INTEGER NOT NULL,
      seccional_number INTEGER NOT NULL,
      estimated_votes INTEGER NOT NULL DEFAULT 0,
      responsible_name TEXT NOT NULL,
      responsible_user_id INTEGER,
      notes TEXT DEFAULT '',
      custom_fields_json TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (coordinator_id, responsible_name),
      FOREIGN KEY (coordinator_id) REFERENCES coordinators(id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (district_id) REFERENCES districts(id)
    )`,
    `CREATE TABLE IF NOT EXISTS agenda_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      department_id INTEGER,
      district_id INTEGER,
      seccional_number INTEGER,
      location TEXT DEFAULT '',
      responsible TEXT DEFAULT '',
      participants TEXT DEFAULT '',
      description TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      reminder_minutes INTEGER NOT NULL DEFAULT 60,
      status TEXT NOT NULL DEFAULT 'programado',
      custom_fields_json TEXT DEFAULT '{}',
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (district_id) REFERENCES districts(id)
    )`,
    `CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      attendance_count INTEGER NOT NULL DEFAULT 0,
      outcomes TEXT NOT NULL DEFAULT '',
      logged_by TEXT NOT NULL DEFAULT '',
      logged_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (event_id) REFERENCES agenda_events(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS saved_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      report_type TEXT NOT NULL,
      filters_json TEXT NOT NULL DEFAULT '{}',
      columns_json TEXT NOT NULL DEFAULT '[]',
      generated_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS custom_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module TEXT NOT NULL,
      field_key TEXT NOT NULL,
      label TEXT NOT NULL,
      field_type TEXT NOT NULL DEFAULT 'text',
      required INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      options_json TEXT DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT NOT NULL DEFAULT '',
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      record_id TEXT DEFAULT '',
      details TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      platform_name TEXT NOT NULL DEFAULT 'CRM Político – Gestión Territorial',
      organization_name TEXT NOT NULL DEFAULT '',
      campaign_reference TEXT NOT NULL DEFAULT '',
      logo_url TEXT DEFAULT '',
      institutional_image_url TEXT DEFAULT '',
      primary_color TEXT DEFAULT '#1E3A8A',
      secondary_color TEXT DEFAULT '#B91C1C',
      theme_mode TEXT DEFAULT 'light',
      background_color TEXT DEFAULT '#F8FAFC',
      surface_color TEXT DEFAULT '#FFFFFF',
      text_color TEXT DEFAULT '#0F172A',
      font_family TEXT DEFAULT 'Plus Jakarta Sans',
      font_size_scale TEXT DEFAULT 'normal',
      border_radius TEXT DEFAULT 'rounded',
header_text TEXT DEFAULT '',
footer_text TEXT DEFAULT '',
institutional_text TEXT DEFAULT '',
contact_phone TEXT DEFAULT '',
contact_email TEXT DEFAULT '',
contact_address TEXT DEFAULT '',
document_format TEXT DEFAULT 'A4',
date_format TEXT DEFAULT 'DD/MM/YYYY',
report_show_charts INTEGER DEFAULT 1,
report_show_totals INTEGER DEFAULT 1,
updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`
], 'write');
}
