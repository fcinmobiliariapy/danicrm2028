import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'crm.db');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      is_system INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      module TEXT NOT NULL,
      action TEXT NOT NULL,
      label TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INTEGER NOT NULL,
      permission_id INTEGER NOT NULL,
      PRIMARY KEY (role_id, permission_id),
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
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
    );

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      name TEXT NOT NULL UNIQUE,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS districts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (department_id, name),
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS seccionales (
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
    );

    CREATE TABLE IF NOT EXISTS coordinators (
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
    );

    CREATE TABLE IF NOT EXISTS youth_members (
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
    );

    CREATE TABLE IF NOT EXISTS women_members (
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
    );

    CREATE TABLE IF NOT EXISTS onp_members (
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
    );

    CREATE TABLE IF NOT EXISTS vote_projections (
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
    );

    CREATE TABLE IF NOT EXISTS agenda_events (
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
    );

    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      attendance_count INTEGER NOT NULL DEFAULT 0,
      outcomes TEXT NOT NULL DEFAULT '',
      logged_by TEXT NOT NULL DEFAULT '',
      logged_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (event_id) REFERENCES agenda_events(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS saved_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      report_type TEXT NOT NULL,
      filters_json TEXT NOT NULL DEFAULT '{}',
      columns_json TEXT NOT NULL DEFAULT '[]',
      generated_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      platform_name TEXT NOT NULL DEFAULT 'CRM Político – Gestión Territorial',
      organization_name TEXT NOT NULL DEFAULT 'Comando Territorial Dani Centurión 2018',
      campaign_reference TEXT NOT NULL DEFAULT 'DANI CENTURIÓN 2018',
      logo_url TEXT NOT NULL DEFAULT '/src/assets/images/brand_emblem_1794844008906.jpg',
      institutional_image_url TEXT NOT NULL DEFAULT '/src/assets/images/campaign_banner_1794844011380.jpg',
      primary_color TEXT NOT NULL DEFAULT '#1E3A8A',
      secondary_color TEXT NOT NULL DEFAULT '#B91C1C',
      theme_mode TEXT NOT NULL DEFAULT 'light',
      background_color TEXT NOT NULL DEFAULT '#F8FAFC',
      surface_color TEXT NOT NULL DEFAULT '#FFFFFF',
      text_color TEXT NOT NULL DEFAULT '#0F172A',
      font_family TEXT NOT NULL DEFAULT 'Plus Jakarta Sans',
      font_size_scale TEXT NOT NULL DEFAULT 'normal',
      border_radius TEXT NOT NULL DEFAULT 'rounded',
      header_text TEXT NOT NULL DEFAULT 'CRM POLÍTICO – GESTIÓN TERRITORIAL | DANI CENTURIÓN 2018',
      footer_text TEXT NOT NULL DEFAULT 'Documento de uso interno y confidencial · Estructura Territorial Paraguay',
      institutional_text TEXT NOT NULL DEFAULT 'Plataforma centralizada de organización territorial, coordinación electoral, agenda política y proyección estadística.',
      contact_phone TEXT NOT NULL DEFAULT '+595 21 440 2018',
      contact_email TEXT NOT NULL DEFAULT 'coordinacion@danicenturion2018.org.py',
      contact_address TEXT NOT NULL DEFAULT 'Asunción, República del Paraguay',
      document_format TEXT NOT NULL DEFAULT 'A4',
      date_format TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
      report_show_charts INTEGER NOT NULL DEFAULT 1,
      report_show_totals INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS custom_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module TEXT NOT NULL,
      field_key TEXT NOT NULL,
      label TEXT NOT NULL,
      field_type TEXT NOT NULL DEFAULT 'text',
      required INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      options_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (module, field_key)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT NOT NULL,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      entity_id TEXT DEFAULT '',
      details TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_coord_dept ON coordinators(department_id, district_id, seccional_number);
    CREATE INDEX IF NOT EXISTS idx_youth_dept ON youth_members(department_id, district_id, seccional_number);
    CREATE INDEX IF NOT EXISTS idx_women_dept ON women_members(department_id, district_id, seccional_number);
    CREATE INDEX IF NOT EXISTS idx_onp_name ON onp_members(full_name);
    CREATE INDEX IF NOT EXISTS idx_onp_org ON onp_members(organization);
    CREATE INDEX IF NOT EXISTS idx_proj_coord ON vote_projections(coordinator_id);
    CREATE INDEX IF NOT EXISTS idx_agenda_date ON agenda_events(event_date);
    CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_logs(created_at DESC);
  `);

  const existingCols = new Set(
    (db.prepare(`PRAGMA table_info(system_settings)`).all() as { name: string }[]).map((c) => c.name)
  );
  const migrations: [string, string][] = [
    ['theme_mode', `TEXT NOT NULL DEFAULT 'light'`],
    ['background_color', `TEXT NOT NULL DEFAULT '#F8FAFC'`],
    ['surface_color', `TEXT NOT NULL DEFAULT '#FFFFFF'`],
    ['text_color', `TEXT NOT NULL DEFAULT '#0F172A'`],
    ['font_family', `TEXT NOT NULL DEFAULT 'Plus Jakarta Sans'`],
    ['font_size_scale', `TEXT NOT NULL DEFAULT 'normal'`],
    ['border_radius', `TEXT NOT NULL DEFAULT 'rounded'`],
  ];
  for (const [col, def] of migrations) {
    if (!existingCols.has(col)) {
      db.exec(`ALTER TABLE system_settings ADD COLUMN ${col} ${def}`);
    }
  }
}

export function logAudit(
  userId: number | null,
  username: string,
  action: string,
  module: string,
  entityId: string | number | bigint = '',
  details = ''
) {
  db.prepare(
    `INSERT INTO audit_logs (user_id, username, action, module, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId, username, action, module, String(entityId), details);
}
