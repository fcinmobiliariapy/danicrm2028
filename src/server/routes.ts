import { Express, Response } from 'express';
import {
  AuthRequest,
  hashPassword,
  loadUserWithPermissions,
  maskSensitive,
  requireAuth,
  requirePermission,
  SESSION_COOKIE_NAME,
  signToken,
  verifyPassword,
} from './auth.ts';
import { db, logAudit } from './db.ts';

type PeopleTable = 'coordinators' | 'youth_members' | 'women_members';

function resolvePeopleTable(mod: string): { table: PeopleTable; permPrefix: string; label: string } | null {
  if (mod === 'coordinators') return { table: 'coordinators', permPrefix: 'coordinators', label: 'Coordinadores' };
  if (mod === 'youth') return { table: 'youth_members', permPrefix: 'youth', label: 'Jóvenes' };
  if (mod === 'women') return { table: 'women_members', permPrefix: 'women', label: 'Mujeres' };
  return null;
}

export function registerApiRoutes(app: Express) {
  // Public branding for login screen & initial boot
  app.get('/api/public/branding', (_req, res) => {
    const settings = db.prepare(`SELECT * FROM system_settings WHERE id = 1`).get();
    res.json(settings || {});
  });

  // Auth endpoints
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Ingrese usuario y contraseña.' });
    }
    const userRow = db
      .prepare(`SELECT id, username, password_hash, active FROM users WHERE LOWER(username) = LOWER(?)`)
      .get(String(username).trim()) as
      | { id: number; username: string; password_hash: string; active: number }
      | undefined;

    if (!userRow || !userRow.active || !verifyPassword(String(password), userRow.password_hash)) {
      return res.status(401).json({ error: 'Credenciales incorrectas o usuario inactivo.' });
    }

    db.prepare(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`).run(userRow.id);
    const fullUser = loadUserWithPermissions(userRow.id);
    if (!fullUser) {
      return res.status(401).json({ error: 'No se pudo cargar el perfil del usuario.' });
    }

    const token = signToken(userRow.id);
    logAudit(userRow.id, userRow.username, 'LOGIN', 'auth', userRow.id, 'Inicio de sesión exitoso');

    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7,
      path: '/',
    });

    res.json({ token, user: fullUser });
  });

  app.post('/api/auth/logout', requireAuth, (req: AuthRequest, res: Response) => {
    if (req.user) {
      logAudit(req.user.id, req.user.username, 'LOGOUT', 'auth', req.user.id, 'Cierre de sesión');
    }
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthRequest, res: Response) => {
    res.json({ user: req.user });
  });

  app.post('/api/auth/change-password', requireAuth, (req: AuthRequest, res: Response) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
    }
    const row = db.prepare(`SELECT password_hash FROM users WHERE id = ?`).get(req.user!.id) as { password_hash: string };
    if (!verifyPassword(String(currentPassword), row.password_hash)) {
      return res.status(400).json({ error: 'La contraseña actual no es correcta.' });
    }
    db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(hashPassword(String(newPassword)), req.user!.id);
    logAudit(req.user!.id, req.user!.username, 'CAMBIO_CLAVE', 'auth', req.user!.id, 'Actualización de contraseña');
    res.json({ ok: true });
  });

  // Settings & Custom Fields (readable by all authenticated users)
  app.get('/api/settings', requireAuth, (_req, res) => {
    const settings = db.prepare(`SELECT * FROM system_settings WHERE id = 1`).get();
    res.json(settings);
  });

  app.put('/api/settings', requireAuth, requirePermission('admin:manage'), (req: AuthRequest, res: Response) => {
    const s = req.body || {};
    db.prepare(
      `UPDATE system_settings SET
        platform_name = ?, organization_name = ?, campaign_reference = ?,
        logo_url = ?, institutional_image_url = ?, primary_color = ?, secondary_color = ?,
        theme_mode = ?, background_color = ?, surface_color = ?, text_color = ?,
        font_family = ?, font_size_scale = ?, border_radius = ?,
        header_text = ?, footer_text = ?, institutional_text = ?,
        contact_phone = ?, contact_email = ?, contact_address = ?,
        document_format = ?, date_format = ?, report_show_charts = ?, report_show_totals = ?,
        updated_at = datetime('now')
       WHERE id = 1`
    ).run(
      s.platform_name || 'CRM Político – Gestión Territorial',
      s.organization_name || 'Comando Territorial',
      s.campaign_reference || 'DANI CENTURIÓN 2018',
      s.logo_url || '/src/assets/images/brand_emblem_1794844008906.jpg',
      s.institutional_image_url || '/src/assets/images/campaign_banner_1794844011380.jpg',
      s.primary_color || '#1E3A8A',
      s.secondary_color || '#B91C1C',
      s.theme_mode || 'light',
      s.background_color || '#F8FAFC',
      s.surface_color || '#FFFFFF',
      s.text_color || '#0F172A',
      s.font_family || 'Plus Jakarta Sans',
      s.font_size_scale || 'normal',
      s.border_radius || 'rounded',
      s.header_text || '',
      s.footer_text || '',
      s.institutional_text || '',
      s.contact_phone || '',
      s.contact_email || '',
      s.contact_address || '',
      s.document_format || 'A4',
      s.date_format || 'DD/MM/YYYY',
      s.report_show_charts ? 1 : 0,
      s.report_show_totals ? 1 : 0
    );
    logAudit(req.user!.id, req.user!.username, 'ACTUALIZAR', 'configuracion', 1, 'Actualización de configuración general y tema');
    res.json(db.prepare(`SELECT * FROM system_settings WHERE id = 1`).get());
  });

  app.get('/api/custom-fields', requireAuth, (req, res) => {
    const mod = req.query.module ? String(req.query.module) : null;
    const includeInactive = req.query.all === '1';
    let sql = `SELECT * FROM custom_fields WHERE 1=1`;
    const params: unknown[] = [];
    if (mod) {
      sql += ` AND module = ?`;
      params.push(mod);
    }
    if (!includeInactive) {
      sql += ` AND active = 1`;
    }
    sql += ` ORDER BY module ASC, sort_order ASC, id ASC`;
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  });

  app.post('/api/custom-fields', requireAuth, requirePermission('admin:manage'), (req: AuthRequest, res: Response) => {
    const { module, label, field_type, required, options } = req.body || {};
    if (!module || !label) {
      return res.status(400).json({ error: 'Módulo y etiqueta son obligatorios.' });
    }
    const cleanKey =
      String(label)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '') || `campo_${Date.now()}`;
    const maxOrder = (
      db.prepare(`SELECT COALESCE(MAX(sort_order), 0) AS m FROM custom_fields WHERE module = ?`).get(module) as { m: number }
    ).m;
    try {
      const info = db
        .prepare(
          `INSERT INTO custom_fields (module, field_key, label, field_type, required, active, sort_order, options_json)
           VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
        )
        .run(
          module,
          `${cleanKey}_${Math.floor(Math.random() * 100)}`,
          String(label).trim(),
          field_type || 'text',
          required ? 1 : 0,
          maxOrder + 1,
          JSON.stringify(Array.isArray(options) ? options : [])
        );
      logAudit(req.user!.id, req.user!.username, 'CREAR', 'campos_personalizados', info.lastInsertRowid, `${module}: ${label}`);
      res.status(201).json(db.prepare(`SELECT * FROM custom_fields WHERE id = ?`).get(info.lastInsertRowid));
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Error al crear campo.' });
    }
  });

  app.put('/api/custom-fields/:id', requireAuth, requirePermission('admin:manage'), (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    const { label, field_type, required, active, sort_order, options } = req.body || {};
    const existing = db.prepare(`SELECT * FROM custom_fields WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    if (!existing) return res.status(404).json({ error: 'Campo no encontrado.' });
    db.prepare(
      `UPDATE custom_fields SET label = ?, field_type = ?, required = ?, active = ?, sort_order = ?, options_json = ? WHERE id = ?`
    ).run(
      label ?? existing.label,
      field_type ?? existing.field_type,
      required !== undefined ? (required ? 1 : 0) : existing.required,
      active !== undefined ? (active ? 1 : 0) : existing.active,
      sort_order ?? existing.sort_order,
      options !== undefined ? JSON.stringify(options) : existing.options_json,
      id
    );
    logAudit(req.user!.id, req.user!.username, 'EDITAR', 'campos_personalizados', id, `Campo actualizado: ${label ?? existing.label}`);
    res.json(db.prepare(`SELECT * FROM custom_fields WHERE id = ?`).get(id));
  });

  app.delete('/api/custom-fields/:id', requireAuth, requirePermission('admin:manage'), (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    db.prepare(`DELETE FROM custom_fields WHERE id = ?`).run(id);
    logAudit(req.user!.id, req.user!.username, 'ELIMINAR', 'campos_personalizados', id, 'Campo eliminado');
    res.json({ ok: true });
  });

  // Dashboard
  app.get('/api/dashboard', requireAuth, requirePermission('dashboard:view'), (req: AuthRequest, res: Response) => {
    const canSensitive = req.user!.role_slug === 'super_admin' || !!req.user!.permissions['sensitive_data:view'];

    const totalCoordinators = (db.prepare(`SELECT COUNT(*) AS c FROM coordinators`).get() as { c: number }).c;
    const totalYouth = (db.prepare(`SELECT COUNT(*) AS c FROM youth_members`).get() as { c: number }).c;
    const totalWomen = (db.prepare(`SELECT COUNT(*) AS c FROM women_members`).get() as { c: number }).c;
    const totalOnp = (db.prepare(`SELECT COUNT(*) AS c FROM onp_members`).get() as { c: number }).c;
    const totalDepartments = (db.prepare(`SELECT COUNT(*) AS c FROM departments WHERE active = 1`).get() as { c: number }).c;
    const totalDistricts = (db.prepare(`SELECT COUNT(*) AS c FROM districts WHERE active = 1`).get() as { c: number }).c;
    const totalSeccionales = (db.prepare(`SELECT COUNT(*) AS c FROM seccionales WHERE active = 1`).get() as { c: number }).c;
    const totalEstimatedVotes = (
      db.prepare(`SELECT COALESCE(SUM(estimated_votes), 0) AS s FROM vote_projections`).get() as { s: number }
    ).s;
    const scheduledMeetings = (
      db.prepare(`SELECT COUNT(*) AS c FROM agenda_events WHERE status = 'programado'`).get() as { c: number }
    ).c;

    const upcomingEvents = db
      .prepare(
        `SELECT e.*, d.name AS department_name, dis.name AS district_name
         FROM agenda_events e
         LEFT JOIN departments d ON d.id = e.department_id
         LEFT JOIN districts dis ON dis.id = e.district_id
         WHERE e.status = 'programado'
         ORDER BY e.event_date ASC, e.start_time ASC
         LIMIT 5`
      )
      .all();

    const recentCoordinators = db
      .prepare(
        `SELECT 'Coordinador' AS tipo, c.id, c.first_name, c.last_name, c.ci, c.seccional_number, c.registered_at,
                d.name AS department_name, dis.name AS district_name, c.created_at
         FROM coordinators c
         JOIN departments d ON d.id = c.department_id
         JOIN districts dis ON dis.id = c.district_id
         ORDER BY c.id DESC LIMIT 4`
      )
      .all() as Record<string, unknown>[];

    const recentYouth = db
      .prepare(
        `SELECT 'Joven' AS tipo, y.id, y.first_name, y.last_name, y.ci, y.seccional_number, y.registered_at,
                d.name AS department_name, dis.name AS district_name, y.created_at
         FROM youth_members y
         JOIN departments d ON d.id = y.department_id
         JOIN districts dis ON dis.id = y.district_id
         ORDER BY y.id DESC LIMIT 3`
      )
      .all() as Record<string, unknown>[];

    const recentWomen = db
      .prepare(
        `SELECT 'Mujer' AS tipo, w.id, w.first_name, w.last_name, w.ci, w.seccional_number, w.registered_at,
                d.name AS department_name, dis.name AS district_name, w.created_at
         FROM women_members w
         JOIN departments d ON d.id = w.department_id
         JOIN districts dis ON dis.id = w.district_id
         ORDER BY w.id DESC LIMIT 3`
      )
      .all() as Record<string, unknown>[];

    const recentRecords = [...recentCoordinators, ...recentYouth, ...recentWomen]
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, 8)
      .map((r) => ({ ...r, ci: maskSensitive(String(r.ci || ''), canSensitive) }));

    const byDepartment = db
      .prepare(
        `SELECT d.id, d.name,
          (SELECT COUNT(*) FROM coordinators c WHERE c.department_id = d.id) AS coordinadores,
          (SELECT COUNT(*) FROM youth_members y WHERE y.department_id = d.id) AS jovenes,
          (SELECT COUNT(*) FROM women_members w WHERE w.department_id = d.id) AS mujeres,
          (SELECT COALESCE(SUM(vp.estimated_votes), 0) FROM vote_projections vp WHERE vp.department_id = d.id) AS votos_estimados
         FROM departments d
         WHERE d.active = 1
         ORDER BY (coordinadores + jovenes + mujeres + votos_estimados) DESC, d.id ASC`
      )
      .all();

    const byDistrict = db
      .prepare(
        `SELECT dis.id, dis.name, d.name AS department_name,
          (SELECT COUNT(*) FROM coordinators c WHERE c.district_id = dis.id) +
          (SELECT COUNT(*) FROM youth_members y WHERE y.district_id = dis.id) +
          (SELECT COUNT(*) FROM women_members w WHERE w.district_id = dis.id) AS total_estructura,
          (SELECT COALESCE(SUM(vp.estimated_votes), 0) FROM vote_projections vp WHERE vp.district_id = dis.id) AS votos_estimados
         FROM districts dis
         JOIN departments d ON d.id = dis.department_id
         WHERE dis.active = 1
         ORDER BY votos_estimados DESC, total_estructura DESC
         LIMIT 12`
      )
      .all();

    const bySeccional = db
      .prepare(
        `SELECT vp.seccional_number, d.name AS department_name, dis.name AS district_name,
          SUM(vp.estimated_votes) AS votos_estimados,
          COUNT(DISTINCT vp.coordinator_id) AS coordinadores
         FROM vote_projections vp
         JOIN departments d ON d.id = vp.department_id
         JOIN districts dis ON dis.id = vp.district_id
         GROUP BY vp.seccional_number, d.name, dis.name
         ORDER BY votos_estimados DESC
         LIMIT 12`
      )
      .all();

    res.json({
      kpis: {
        totalCoordinators,
        totalYouth,
        totalWomen,
        totalOnp,
        totalDepartments,
        totalDistricts,
        totalSeccionales,
        totalEstimatedVotes,
        scheduledMeetings,
      },
      upcomingEvents,
      recentRecords,
      charts: {
        byDepartment,
        byDistrict,
        bySeccional,
      },
    });
  });

  // Quick coordinator search for Vote Projections
  app.get('/api/people/coordinators/search', requireAuth, requirePermission('projections:view'), (req: AuthRequest, res: Response) => {
    const q = String(req.query.q || '').trim();
    const canSensitive = req.user!.role_slug === 'super_admin' || !!req.user!.permissions['sensitive_data:view'];
    const like = `%${q}%`;
    const rows = db
      .prepare(
        `SELECT c.id, c.first_name, c.last_name, c.ci, c.department_id, c.district_id, c.seccional_number,
                d.name AS department_name, dis.name AS district_name
         FROM coordinators c
         JOIN departments d ON d.id = c.department_id
         JOIN districts dis ON dis.id = c.district_id
         WHERE c.first_name LIKE ? OR c.last_name LIKE ? OR c.ci LIKE ? OR CAST(c.seccional_number AS TEXT) LIKE ?
         ORDER BY c.last_name ASC, c.first_name ASC
         LIMIT 25`
      )
      .all(like, like, like, like) as Record<string, unknown>[];

    res.json(
      rows.map((r) => ({
        ...r,
        ci: maskSensitive(String(r.ci || ''), canSensitive),
      }))
    );
  });

  // People modules (coordinators, youth, women)
  app.get('/api/people/:module', requireAuth, (req: AuthRequest, res: Response) => {
    const info = resolvePeopleTable(req.params.module);
    if (!info) return res.status(404).json({ error: 'Módulo no válido.' });
    if (req.user!.role_slug !== 'super_admin' && !req.user!.permissions[`${info.permPrefix}:view`]) {
      return res.status(403).json({ error: 'Sin permiso para consultar este módulo.' });
    }

    const canSensitive = req.user!.role_slug === 'super_admin' || !!req.user!.permissions['sensitive_data:view'];
    const search = String(req.query.search || '').trim();
    const departmentId = req.query.department_id ? Number(req.query.department_id) : null;
    const districtId = req.query.district_id ? Number(req.query.district_id) : null;
    const seccionalNumber = req.query.seccional_number ? Number(req.query.seccional_number) : null;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(200, Math.max(5, Number(req.query.limit || 15)));
    const offset = (page - 1) * limit;

    let where = `WHERE 1=1`;
    const params: unknown[] = [];

    if (search) {
      where += ` AND (t.first_name LIKE ? OR t.last_name LIKE ? OR t.ci LIKE ? OR t.phone LIKE ?)`;
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (departmentId) {
      where += ` AND t.department_id = ?`;
      params.push(departmentId);
    }
    if (districtId) {
      where += ` AND t.district_id = ?`;
      params.push(districtId);
    }
    if (seccionalNumber) {
      where += ` AND t.seccional_number = ?`;
      params.push(seccionalNumber);
    }

    const total = (
      db.prepare(`SELECT COUNT(*) AS c FROM ${info.table} t ${where}`).get(...params) as { c: number }
    ).c;

    const rows = db
      .prepare(
        `SELECT t.*, d.name AS department_name, dis.name AS district_name
         FROM ${info.table} t
         JOIN departments d ON d.id = t.department_id
         JOIN districts dis ON dis.id = t.district_id
         ${where}
         ORDER BY t.id DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset) as Record<string, unknown>[];

    const locationSummary = db
      .prepare(
        `SELECT d.name AS department_name, dis.name AS district_name, COUNT(*) AS total
         FROM ${info.table} t
         JOIN departments d ON d.id = t.department_id
         JOIN districts dis ON dis.id = t.district_id
         ${where}
         GROUP BY d.name, dis.name
         ORDER BY total DESC
         LIMIT 8`
      )
      .all(...params);

    res.json({
      items: rows.map((r) => ({
        ...r,
        ci_raw: canSensitive ? r.ci : undefined,
        ci: maskSensitive(String(r.ci || ''), canSensitive),
        phone: maskSensitive(String(r.phone || ''), canSensitive),
        custom_fields: JSON.parse(String(r.custom_fields_json || '{}')),
      })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      locationSummary,
      canViewSensitive: canSensitive,
    });
  });

  app.post('/api/people/:module', requireAuth, (req: AuthRequest, res: Response) => {
    const info = resolvePeopleTable(req.params.module);
    if (!info) return res.status(404).json({ error: 'Módulo no válido.' });
    if (req.user!.role_slug !== 'super_admin' && !req.user!.permissions[`${info.permPrefix}:create`]) {
      return res.status(403).json({ error: 'Sin permiso para registrar en este módulo.' });
    }

    const b = req.body || {};
    const firstName = String(b.first_name || '').trim();
    const lastName = String(b.last_name || '').trim();
    const ci = String(b.ci || '').replace(/\./g, '').trim();
    const departmentId = Number(b.department_id);
    const districtId = Number(b.district_id);
    const seccionalNumber = Number(b.seccional_number);
    const phone = String(b.phone || '').trim();
    const registeredAt = String(b.registered_at || new Date().toISOString().slice(0, 10));
    const notes = String(b.notes || '').trim();
    const consentAccepted = b.consent_accepted !== false ? 1 : 0;
    const customFields = b.custom_fields && typeof b.custom_fields === 'object' ? b.custom_fields : {};

    if (!firstName || !lastName || !ci || !departmentId || !districtId || !seccionalNumber || !phone) {
      return res.status(400).json({ error: 'Complete todos los campos obligatorios (Nombres, Apellidos, C.I., Ubicación, Seccional y Teléfono).' });
    }
    if (!consentAccepted) {
      return res.status(400).json({ error: 'Debe confirmar el consentimiento de protección de datos personales.' });
    }

    const dup = db.prepare(`SELECT id FROM ${info.table} WHERE ci = ?`).get(ci);
    if (dup) {
      return res.status(409).json({ error: `Ya existe un registro en ${info.label} con la C.I. ${ci}.` });
    }

    const result = db
      .prepare(
        `INSERT INTO ${info.table} (first_name, last_name, ci, department_id, district_id, seccional_number, phone, registered_at, notes, consent_accepted, custom_fields_json, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        firstName,
        lastName,
        ci,
        departmentId,
        districtId,
        seccionalNumber,
        phone,
        registeredAt,
        notes,
        consentAccepted,
        JSON.stringify(customFields),
        req.user!.id
      );

    logAudit(
      req.user!.id,
      req.user!.username,
      'CREAR',
      info.permPrefix,
      result.lastInsertRowid,
      `Registro de ${firstName} ${lastName} (C.I. ${ci}, Secc. ${seccionalNumber})`
    );

    const created = db.prepare(`SELECT * FROM ${info.table} WHERE id = ?`).get(result.lastInsertRowid);
    res.status(201).json(created);
  });

  app.put('/api/people/:module/:id', requireAuth, (req: AuthRequest, res: Response) => {
    const info = resolvePeopleTable(req.params.module);
    if (!info) return res.status(404).json({ error: 'Módulo no válido.' });
    if (req.user!.role_slug !== 'super_admin' && !req.user!.permissions[`${info.permPrefix}:edit`]) {
      return res.status(403).json({ error: 'Sin permiso para editar registros en este módulo.' });
    }

    const id = Number(req.params.id);
    const existing = db.prepare(`SELECT * FROM ${info.table} WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    if (!existing) return res.status(404).json({ error: 'Registro no encontrado.' });

    const b = req.body || {};
    const firstName = String(b.first_name ?? existing.first_name).trim();
    const lastName = String(b.last_name ?? existing.last_name).trim();
    const ci = String(b.ci ?? existing.ci).replace(/\./g, '').trim();
    const departmentId = Number(b.department_id ?? existing.department_id);
    const districtId = Number(b.district_id ?? existing.district_id);
    const seccionalNumber = Number(b.seccional_number ?? existing.seccional_number);
    const phone = String(b.phone ?? existing.phone).trim();
    const registeredAt = String(b.registered_at ?? existing.registered_at);
    const notes = String(b.notes ?? existing.notes).trim();
    const customFields =
      b.custom_fields && typeof b.custom_fields === 'object'
        ? JSON.stringify(b.custom_fields)
        : String(existing.custom_fields_json || '{}');

    const dup = db.prepare(`SELECT id FROM ${info.table} WHERE ci = ? AND id != ?`).get(ci, id);
    if (dup) {
      return res.status(409).json({ error: `Ya existe otro registro con la C.I. ${ci}.` });
    }

    db.prepare(
      `UPDATE ${info.table}
       SET first_name = ?, last_name = ?, ci = ?, department_id = ?, district_id = ?, seccional_number = ?,
           phone = ?, registered_at = ?, notes = ?, custom_fields_json = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(firstName, lastName, ci, departmentId, districtId, seccionalNumber, phone, registeredAt, notes, customFields, id);

    // Keep linked vote projections synchronized with coordinator's location if edited
    if (info.table === 'coordinators') {
      db.prepare(
        `UPDATE vote_projections SET department_id = ?, district_id = ?, seccional_number = ? WHERE coordinator_id = ?`
      ).run(departmentId, districtId, seccionalNumber, id);
    }

    logAudit(
      req.user!.id,
      req.user!.username,
      'EDITAR',
      info.permPrefix,
      id,
      `Actualización de ${firstName} ${lastName} (C.I. ${ci})`
    );

    res.json(db.prepare(`SELECT * FROM ${info.table} WHERE id = ?`).get(id));
  });

  app.delete('/api/people/:module/:id', requireAuth, (req: AuthRequest, res: Response) => {
    const info = resolvePeopleTable(req.params.module);
    if (!info) return res.status(404).json({ error: 'Módulo no válido.' });
    if (req.user!.role_slug !== 'super_admin' && !req.user!.permissions[`${info.permPrefix}:delete`]) {
      return res.status(403).json({ error: 'Sin permiso para eliminar registros.' });
    }
    const id = Number(req.params.id);
    const existing = db.prepare(`SELECT first_name, last_name, ci FROM ${info.table} WHERE id = ?`).get(id) as
      | { first_name: string; last_name: string; ci: string }
      | undefined;
    if (!existing) return res.status(404).json({ error: 'Registro no encontrado.' });

    db.prepare(`DELETE FROM ${info.table} WHERE id = ?`).run(id);
    logAudit(
      req.user!.id,
      req.user!.username,
      'ELIMINAR',
      info.permPrefix,
      id,
      `Eliminación de ${existing.first_name} ${existing.last_name} (C.I. ${existing.ci})`
    );
    res.json({ ok: true });
  });

  // ONP Module (Organización No Política)
  app.get('/api/onp', requireAuth, requirePermission('onp:view'), (req: AuthRequest, res: Response) => {
    const canSensitive = req.user!.role_slug === 'super_admin' || !!req.user!.permissions['sensitive_data:view'];
    const search = String(req.query.search || '').trim();
    const organization = String(req.query.organization || '').trim();
    const sortBy = String(req.query.sort_by || 'full_name');
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(500, Math.max(1, Number(req.query.limit || 15)));
    const offset = (page - 1) * limit;

    let where = `WHERE 1=1`;
    const params: unknown[] = [];
    if (search) {
      where += ` AND (full_name LIKE ? OR phone LIKE ? OR organization LIKE ? OR notes LIKE ?)`;
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (organization) {
      where += ` AND organization = ?`;
      params.push(organization);
    }

    const orderClause =
      sortBy === 'organization'
        ? `ORDER BY LOWER(organization) ASC, LOWER(full_name) ASC, id ASC`
        : sortBy === 'id'
        ? `ORDER BY id ASC`
        : `ORDER BY LOWER(full_name) ASC, LOWER(organization) ASC, id ASC`;

    const total = (db.prepare(`SELECT COUNT(*) AS c FROM onp_members ${where}`).get(...params) as { c: number }).c;
    const rows = db
      .prepare(`SELECT * FROM onp_members ${where} ${orderClause} LIMIT ? OFFSET ?`)
      .all(...params, limit, offset) as Record<string, unknown>[];

    const organizations = db
      .prepare(`SELECT organization, COUNT(*) AS total FROM onp_members GROUP BY organization ORDER BY LOWER(organization) ASC`)
      .all() as { organization: string; total: number }[];

    res.json({
      items: rows.map((r) => ({
        ...r,
        phone_raw: canSensitive ? r.phone : undefined,
        phone: maskSensitive(String(r.phone || ''), canSensitive),
        custom_fields: JSON.parse(String(r.custom_fields_json || '{}')),
      })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      organizations,
      canViewSensitive: canSensitive,
    });
  });

  app.post('/api/onp', requireAuth, requirePermission('onp:create'), (req: AuthRequest, res: Response) => {
    const b = req.body || {};
    const fullName = String(b.full_name || '').trim();
    const phone = String(b.phone || '').trim();
    const organization = String(b.organization || '').trim();
    const registeredAt = String(b.registered_at || new Date().toISOString().slice(0, 10));
    const notes = String(b.notes || '').trim();
    const customFields = b.custom_fields && typeof b.custom_fields === 'object' ? b.custom_fields : {};

    if (!fullName || !phone || !organization) {
      return res.status(400).json({
        error: 'Complete todos los campos obligatorios (Nombres y Apellidos, Teléfono y Organización/Institución).',
      });
    }

    const result = db
      .prepare(
        `INSERT INTO onp_members (full_name, phone, organization, registered_at, notes, custom_fields_json, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(fullName, phone, organization, registeredAt, notes, JSON.stringify(customFields), req.user!.id);

    logAudit(
      req.user!.id,
      req.user!.username,
      'CREAR',
      'onp',
      result.lastInsertRowid,
      `Registro ONP: ${fullName} (${organization})`
    );

    res.status(201).json(db.prepare(`SELECT * FROM onp_members WHERE id = ?`).get(result.lastInsertRowid));
  });

  app.put('/api/onp/:id', requireAuth, requirePermission('onp:edit'), (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    const existing = db.prepare(`SELECT * FROM onp_members WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    if (!existing) return res.status(404).json({ error: 'Registro ONP no encontrado.' });

    const b = req.body || {};
    const fullName = String(b.full_name ?? existing.full_name).trim();
    const phone = String(b.phone ?? existing.phone).trim();
    const organization = String(b.organization ?? existing.organization).trim();
    const registeredAt = String(b.registered_at ?? existing.registered_at);
    const notes = String(b.notes ?? existing.notes).trim();
    const customFields =
      b.custom_fields && typeof b.custom_fields === 'object'
        ? JSON.stringify(b.custom_fields)
        : String(existing.custom_fields_json || '{}');

    if (!fullName || !phone || !organization) {
      return res.status(400).json({
        error: 'Complete todos los campos obligatorios (Nombres y Apellidos, Teléfono y Organización/Institución).',
      });
    }

    db.prepare(
      `UPDATE onp_members
       SET full_name = ?, phone = ?, organization = ?, registered_at = ?, notes = ?, custom_fields_json = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(fullName, phone, organization, registeredAt, notes, customFields, id);

    logAudit(req.user!.id, req.user!.username, 'EDITAR', 'onp', id, `Actualización ONP: ${fullName} (${organization})`);
    res.json(db.prepare(`SELECT * FROM onp_members WHERE id = ?`).get(id));
  });

  app.delete('/api/onp/:id', requireAuth, requirePermission('onp:delete'), (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    const existing = db.prepare(`SELECT full_name, organization FROM onp_members WHERE id = ?`).get(id) as
      | { full_name: string; organization: string }
      | undefined;
    if (!existing) return res.status(404).json({ error: 'Registro ONP no encontrado.' });

    db.prepare(`DELETE FROM onp_members WHERE id = ?`).run(id);
    logAudit(
      req.user!.id,
      req.user!.username,
      'ELIMINAR',
      'onp',
      id,
      `Eliminación ONP: ${existing.full_name} (${existing.organization})`
    );
    res.json({ ok: true });
  });

  // Vote Projections
  app.get('/api/projections', requireAuth, requirePermission('projections:view'), (req: AuthRequest, res: Response) => {
    const canSensitive = req.user!.role_slug === 'super_admin' || !!req.user!.permissions['sensitive_data:view'];
    const departmentId = req.query.department_id ? Number(req.query.department_id) : null;
    const districtId = req.query.district_id ? Number(req.query.district_id) : null;
    const seccionalNumber = req.query.seccional_number ? Number(req.query.seccional_number) : null;
    const search = String(req.query.search || '').trim();

    let where = `WHERE 1=1`;
    const params: unknown[] = [];
    if (departmentId) {
      where += ` AND vp.department_id = ?`;
      params.push(departmentId);
    }
    if (districtId) {
      where += ` AND vp.district_id = ?`;
      params.push(districtId);
    }
    if (seccionalNumber) {
      where += ` AND vp.seccional_number = ?`;
      params.push(seccionalNumber);
    }
    if (search) {
      where += ` AND (c.first_name LIKE ? OR c.last_name LIKE ? OR c.ci LIKE ? OR vp.responsible_name LIKE ? OR CAST(vp.seccional_number AS TEXT) LIKE ?)`;
      const like = `%${search}%`;
      params.push(like, like, like, like, like);
    }

    const items = db
      .prepare(
        `SELECT vp.*, c.first_name, c.last_name, c.ci,
                d.name AS department_name, dis.name AS district_name
         FROM vote_projections vp
         JOIN coordinators c ON c.id = vp.coordinator_id
         JOIN departments d ON d.id = vp.department_id
         JOIN districts dis ON dis.id = vp.district_id
         ${where}
         ORDER BY vp.updated_at DESC, vp.id DESC`
      )
      .all(...params) as Record<string, unknown>[];

    const byDepartment = db
      .prepare(
        `SELECT d.id, d.name, SUM(vp.estimated_votes) AS total_votes, COUNT(vp.id) AS records_count
         FROM vote_projections vp
         JOIN coordinators c ON c.id = vp.coordinator_id
         JOIN departments d ON d.id = vp.department_id
         ${where}
         GROUP BY d.id, d.name
         ORDER BY total_votes DESC`
      )
      .all(...params);

    const byDistrict = db
      .prepare(
        `SELECT dis.id, dis.name, d.name AS department_name, SUM(vp.estimated_votes) AS total_votes, COUNT(vp.id) AS records_count
         FROM vote_projections vp
         JOIN coordinators c ON c.id = vp.coordinator_id
         JOIN departments d ON d.id = vp.department_id
         JOIN districts dis ON dis.id = vp.district_id
         ${where}
         GROUP BY dis.id, dis.name, d.name
         ORDER BY total_votes DESC`
      )
      .all(...params);

    const bySeccional = db
      .prepare(
        `SELECT vp.seccional_number, d.name AS department_name, dis.name AS district_name,
                SUM(vp.estimated_votes) AS total_votes, COUNT(vp.id) AS records_count
         FROM vote_projections vp
         JOIN coordinators c ON c.id = vp.coordinator_id
         JOIN departments d ON d.id = vp.department_id
         JOIN districts dis ON dis.id = vp.district_id
         ${where}
         GROUP BY vp.seccional_number, d.name, dis.name
         ORDER BY total_votes DESC`
      )
      .all(...params);

    const grandTotal = items.reduce((acc, r) => acc + Number(r.estimated_votes || 0), 0);

    res.json({
      items: items.map((r) => ({
        ...r,
        ci: maskSensitive(String(r.ci || ''), canSensitive),
        custom_fields: JSON.parse(String(r.custom_fields_json || '{}')),
      })),
      byDepartment,
      byDistrict,
      bySeccional,
      grandTotal,
    });
  });

  app.post('/api/projections', requireAuth, requirePermission('projections:create'), (req: AuthRequest, res: Response) => {
    const b = req.body || {};
    const coordinatorId = Number(b.coordinator_id);
    const estimatedVotes = Math.max(0, Math.floor(Number(b.estimated_votes || 0)));
    const responsibleName = String(b.responsible_name || req.user!.full_name).trim();
    const notes = String(b.notes || '').trim();
    const customFields = b.custom_fields && typeof b.custom_fields === 'object' ? b.custom_fields : {};

    if (!coordinatorId || isNaN(estimatedVotes)) {
      return res.status(400).json({ error: 'Seleccione un coordinador e ingrese una cantidad válida de votos estimados.' });
    }

    const coord = db
      .prepare(`SELECT id, first_name, last_name, department_id, district_id, seccional_number FROM coordinators WHERE id = ?`)
      .get(coordinatorId) as
      | { id: number; first_name: string; last_name: string; department_id: number; district_id: number; seccional_number: number }
      | undefined;
    if (!coord) return res.status(404).json({ error: 'Coordinador no encontrado.' });

    const dup = db
      .prepare(`SELECT id FROM vote_projections WHERE coordinator_id = ? AND LOWER(responsible_name) = LOWER(?)`)
      .get(coordinatorId, responsibleName);
    if (dup) {
      return res.status(409).json({
        error: `Ya existe una proyección registrada para ${coord.first_name} ${coord.last_name} bajo el responsable "${responsibleName}". Edite el registro existente para evitar duplicación de votos.`,
      });
    }

    const info = db
      .prepare(
        `INSERT INTO vote_projections (coordinator_id, department_id, district_id, seccional_number, estimated_votes, responsible_name, responsible_user_id, notes, custom_fields_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .run(
        coord.id,
        coord.department_id,
        coord.district_id,
        coord.seccional_number,
        estimatedVotes,
        responsibleName,
        req.user!.id,
        notes,
        JSON.stringify(customFields)
      );

    logAudit(
      req.user!.id,
      req.user!.username,
      'CREAR',
      'proyecciones',
      info.lastInsertRowid,
      `Proyección ${estimatedVotes} votos estimados para ${coord.first_name} ${coord.last_name} (Secc. ${coord.seccional_number})`
    );
    res.status(201).json(db.prepare(`SELECT * FROM vote_projections WHERE id = ?`).get(info.lastInsertRowid));
  });

  app.put('/api/projections/:id', requireAuth, requirePermission('projections:edit'), (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    const existing = db.prepare(`SELECT * FROM vote_projections WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    if (!existing) return res.status(404).json({ error: 'Proyección no encontrada.' });

    const b = req.body || {};
    const estimatedVotes = Math.max(0, Math.floor(Number(b.estimated_votes ?? existing.estimated_votes)));
    const responsibleName = String(b.responsible_name ?? existing.responsible_name).trim();
    const notes = String(b.notes ?? existing.notes).trim();

    db.prepare(
      `UPDATE vote_projections SET estimated_votes = ?, responsible_name = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(estimatedVotes, responsibleName, notes, id);

    logAudit(
      req.user!.id,
      req.user!.username,
      'EDITAR',
      'proyecciones',
      id,
      `Actualización de proyección a ${estimatedVotes} votos estimados (Responsable: ${responsibleName})`
    );
    res.json(db.prepare(`SELECT * FROM vote_projections WHERE id = ?`).get(id));
  });

  app.delete('/api/projections/:id', requireAuth, requirePermission('projections:delete'), (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    db.prepare(`DELETE FROM vote_projections WHERE id = ?`).run(id);
    logAudit(req.user!.id, req.user!.username, 'ELIMINAR', 'proyecciones', id, 'Proyección eliminada');
    res.json({ ok: true });
  });

  // Agenda & Activities
  app.get('/api/agenda', requireAuth, requirePermission('agenda:view'), (req, res) => {
    const search = String(req.query.search || '').trim();
    const eventType = String(req.query.event_type || '').trim();
    const dateFrom = String(req.query.date_from || '').trim();
    const dateTo = String(req.query.date_to || '').trim();
    const departmentId = req.query.department_id ? Number(req.query.department_id) : null;

    let where = `WHERE 1=1`;
    const params: unknown[] = [];
    if (search) {
      where += ` AND (e.title LIKE ? OR e.location LIKE ? OR e.responsible LIKE ? OR e.description LIKE ?)`;
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (eventType) {
      where += ` AND e.event_type = ?`;
      params.push(eventType);
    }
    if (dateFrom) {
      where += ` AND e.event_date >= ?`;
      params.push(dateFrom);
    }
    if (dateTo) {
      where += ` AND e.event_date <= ?`;
      params.push(dateTo);
    }
    if (departmentId) {
      where += ` AND e.department_id = ?`;
      params.push(departmentId);
    }

    const events = db
      .prepare(
        `SELECT e.*, d.name AS department_name, dis.name AS district_name,
                a.summary AS activity_summary, a.attendance_count, a.outcomes AS activity_outcomes
         FROM agenda_events e
         LEFT JOIN departments d ON d.id = e.department_id
         LEFT JOIN districts dis ON dis.id = e.district_id
         LEFT JOIN activities a ON a.event_id = e.id
         ${where}
         ORDER BY e.event_date ASC, e.start_time ASC`
      )
      .all(...params);

    res.json(events);
  });

  app.post('/api/agenda', requireAuth, requirePermission('agenda:create'), (req: AuthRequest, res: Response) => {
    const b = req.body || {};
    if (!b.title || !b.event_type || !b.event_date || !b.start_time || !b.end_time) {
      return res.status(400).json({ error: 'Título, tipo, fecha y horario son obligatorios.' });
    }
    const info = db
      .prepare(
        `INSERT INTO agenda_events (title, event_type, event_date, start_time, end_time, department_id, district_id, seccional_number, location, responsible, participants, description, notes, reminder_minutes, status, custom_fields_json, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        String(b.title).trim(),
        String(b.event_type),
        String(b.event_date),
        String(b.start_time),
        String(b.end_time),
        b.department_id ? Number(b.department_id) : null,
        b.district_id ? Number(b.district_id) : null,
        b.seccional_number ? Number(b.seccional_number) : null,
        String(b.location || '').trim(),
        String(b.responsible || '').trim(),
        String(b.participants || '').trim(),
        String(b.description || '').trim(),
        String(b.notes || '').trim(),
        Number(b.reminder_minutes ?? 60),
        String(b.status || 'programado'),
        JSON.stringify(b.custom_fields || {}),
        req.user!.id
      );

    db.prepare(`INSERT INTO activities (event_id, summary, attendance_count, outcomes, logged_by) VALUES (?, ?, 0, ?, ?)`).run(
      info.lastInsertRowid,
      'Evento creado en agenda oficial.',
      'Pendiente de realización.',
      req.user!.username
    );

    logAudit(req.user!.id, req.user!.username, 'CREAR', 'agenda', info.lastInsertRowid, `Actividad: ${b.title} (${b.event_date})`);
    res.status(201).json(db.prepare(`SELECT * FROM agenda_events WHERE id = ?`).get(info.lastInsertRowid));
  });

  app.put('/api/agenda/:id', requireAuth, requirePermission('agenda:edit'), (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    const existing = db.prepare(`SELECT * FROM agenda_events WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    if (!existing) return res.status(404).json({ error: 'Evento no encontrado.' });
    const b = req.body || {};

    db.prepare(
      `UPDATE agenda_events SET
        title = ?, event_type = ?, event_date = ?, start_time = ?, end_time = ?,
        department_id = ?, district_id = ?, seccional_number = ?,
        location = ?, responsible = ?, participants = ?, description = ?, notes = ?,
        reminder_minutes = ?, status = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      b.title ?? existing.title,
      b.event_type ?? existing.event_type,
      b.event_date ?? existing.event_date,
      b.start_time ?? existing.start_time,
      b.end_time ?? existing.end_time,
      b.department_id !== undefined ? (b.department_id ? Number(b.department_id) : null) : existing.department_id,
      b.district_id !== undefined ? (b.district_id ? Number(b.district_id) : null) : existing.district_id,
      b.seccional_number !== undefined ? (b.seccional_number ? Number(b.seccional_number) : null) : existing.seccional_number,
      b.location ?? existing.location,
      b.responsible ?? existing.responsible,
      b.participants ?? existing.participants,
      b.description ?? existing.description,
      b.notes ?? existing.notes,
      b.reminder_minutes ?? existing.reminder_minutes,
      b.status ?? existing.status,
      id
    );

    logAudit(req.user!.id, req.user!.username, 'EDITAR', 'agenda', id, `Evento actualizado: ${b.title ?? existing.title}`);
    res.json(db.prepare(`SELECT * FROM agenda_events WHERE id = ?`).get(id));
  });

  app.post('/api/agenda/:id/activity', requireAuth, requirePermission('agenda:edit'), (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    const { summary, attendance_count, outcomes, status } = req.body || {};
    const existing = db.prepare(`SELECT id FROM activities WHERE event_id = ?`).get(id);
    if (existing) {
      db.prepare(
        `UPDATE activities SET summary = ?, attendance_count = ?, outcomes = ?, logged_by = ?, logged_at = datetime('now') WHERE event_id = ?`
      ).run(summary || '', Number(attendance_count || 0), outcomes || '', req.user!.username, id);
    } else {
      db.prepare(
        `INSERT INTO activities (event_id, summary, attendance_count, outcomes, logged_by) VALUES (?, ?, ?, ?, ?)`
      ).run(id, summary || '', Number(attendance_count || 0), outcomes || '', req.user!.username);
    }
    if (status) {
      db.prepare(`UPDATE agenda_events SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, id);
    }
    logAudit(req.user!.id, req.user!.username, 'SEGUIMIENTO', 'agenda', id, `Registro de acta/asistencia (${attendance_count || 0} participantes)`);
    res.json({ ok: true });
  });

  app.delete('/api/agenda/:id', requireAuth, requirePermission('agenda:delete'), (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    db.prepare(`DELETE FROM agenda_events WHERE id = ?`).run(id);
    logAudit(req.user!.id, req.user!.username, 'ELIMINAR', 'agenda', id, 'Evento eliminado de agenda');
    res.json({ ok: true });
  });

  // Territorial Configuration
  app.get('/api/territorial/tree', requireAuth, (req, res) => {
    const activeOnly = req.query.activeOnly === '1';
    const depSql = activeOnly ? `SELECT * FROM departments WHERE active = 1 ORDER BY code ASC, name ASC` : `SELECT * FROM departments ORDER BY code ASC, name ASC`;
    const distSql = activeOnly ? `SELECT * FROM districts WHERE active = 1 ORDER BY name ASC` : `SELECT * FROM districts ORDER BY name ASC`;
    const seccSql = activeOnly
      ? `SELECT * FROM seccionales WHERE active = 1 ORDER BY number ASC`
      : `SELECT * FROM seccionales ORDER BY number ASC`;

    res.json({
      departments: db.prepare(depSql).all(),
      districts: db.prepare(distSql).all(),
      seccionales: db.prepare(seccSql).all(),
    });
  });

  app.post('/api/territorial/departments', requireAuth, requirePermission('territorial:manage'), (req: AuthRequest, res: Response) => {
    const { code, name, active } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Nombre del departamento obligatorio.' });
    try {
      const info = db
        .prepare(`INSERT INTO departments (code, name, active) VALUES (?, ?, ?)`)
        .run(String(code || '99').trim(), String(name).trim(), active !== false ? 1 : 0);
      logAudit(req.user!.id, req.user!.username, 'CREAR', 'territorial', info.lastInsertRowid, `Departamento: ${name}`);
      res.status(201).json(db.prepare(`SELECT * FROM departments WHERE id = ?`).get(info.lastInsertRowid));
    } catch {
      res.status(409).json({ error: 'Ya existe un departamento con ese nombre.' });
    }
  });

  app.put('/api/territorial/departments/:id', requireAuth, requirePermission('territorial:manage'), (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    const { code, name, active } = req.body || {};
    db.prepare(`UPDATE departments SET code = COALESCE(?, code), name = COALESCE(?, name), active = COALESCE(?, active) WHERE id = ?`).run(
      code ?? null,
      name ?? null,
      active !== undefined ? (active ? 1 : 0) : null,
      id
    );
    logAudit(req.user!.id, req.user!.username, 'EDITAR', 'territorial', id, `Departamento actualizado: ${name}`);
    res.json(db.prepare(`SELECT * FROM departments WHERE id = ?`).get(id));
  });

  app.delete('/api/territorial/departments/:id', requireAuth, requirePermission('territorial:manage'), (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    try {
      db.prepare(`DELETE FROM departments WHERE id = ?`).run(id);
      logAudit(req.user!.id, req.user!.username, 'ELIMINAR', 'territorial', id, 'Departamento eliminado');
      res.json({ ok: true });
    } catch {
      res.status(409).json({ error: 'No se puede eliminar: existen registros vinculados a este departamento.' });
    }
  });

  app.post('/api/territorial/districts', requireAuth, requirePermission('territorial:manage'), (req: AuthRequest, res: Response) => {
    const { department_id, name, active } = req.body || {};
    if (!department_id || !name) return res.status(400).json({ error: 'Departamento y nombre de distrito obligatorios.' });
    try {
      const info = db
        .prepare(`INSERT INTO districts (department_id, name, active) VALUES (?, ?, ?)`)
        .run(Number(department_id), String(name).trim(), active !== false ? 1 : 0);
      logAudit(req.user!.id, req.user!.username, 'CREAR', 'territorial', info.lastInsertRowid, `Distrito: ${name}`);
      res.status(201).json(db.prepare(`SELECT * FROM districts WHERE id = ?`).get(info.lastInsertRowid));
    } catch {
      res.status(409).json({ error: 'Ya existe un distrito con ese nombre en este departamento.' });
    }
  });

  app.put('/api/territorial/districts/:id', requireAuth, requirePermission('territorial:manage'), (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    const { department_id, name, active } = req.body || {};
    db.prepare(
      `UPDATE districts SET department_id = COALESCE(?, department_id), name = COALESCE(?, name), active = COALESCE(?, active) WHERE id = ?`
    ).run(department_id ?? null, name ?? null, active !== undefined ? (active ? 1 : 0) : null, id);
    logAudit(req.user!.id, req.user!.username, 'EDITAR', 'territorial', id, `Distrito actualizado: ${name}`);
    res.json(db.prepare(`SELECT * FROM districts WHERE id = ?`).get(id));
  });

  app.delete('/api/territorial/districts/:id', requireAuth, requirePermission('territorial:manage'), (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    try {
      db.prepare(`DELETE FROM districts WHERE id = ?`).run(id);
      logAudit(req.user!.id, req.user!.username, 'ELIMINAR', 'territorial', id, 'Distrito eliminado');
      res.json({ ok: true });
    } catch {
      res.status(409).json({ error: 'No se puede eliminar: existen registros vinculados a este distrito.' });
    }
  });

  app.post('/api/territorial/seccionales', requireAuth, requirePermission('territorial:manage'), (req: AuthRequest, res: Response) => {
    const { department_id, district_id, number, name, active } = req.body || {};
    if (!department_id || !district_id || !number) {
      return res.status(400).json({ error: 'Departamento, distrito y número de seccional obligatorios.' });
    }
    try {
      const info = db
        .prepare(`INSERT INTO seccionales (department_id, district_id, number, name, active) VALUES (?, ?, ?, ?, ?)`)
        .run(Number(department_id), Number(district_id), Number(number), String(name || '').trim(), active !== false ? 1 : 0);
      logAudit(req.user!.id, req.user!.username, 'CREAR', 'territorial', info.lastInsertRowid, `Seccional N° ${number}`);
      res.status(201).json(db.prepare(`SELECT * FROM seccionales WHERE id = ?`).get(info.lastInsertRowid));
    } catch {
      res.status(409).json({ error: 'Ya existe ese número de seccional en el distrito seleccionado.' });
    }
  });

  app.put('/api/territorial/seccionales/:id', requireAuth, requirePermission('territorial:manage'), (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    const { department_id, district_id, number, name, active } = req.body || {};
    db.prepare(
      `UPDATE seccionales SET department_id = COALESCE(?, department_id), district_id = COALESCE(?, district_id),
       number = COALESCE(?, number), name = COALESCE(?, name), active = COALESCE(?, active) WHERE id = ?`
    ).run(
      department_id ?? null,
      district_id ?? null,
      number ?? null,
      name ?? null,
      active !== undefined ? (active ? 1 : 0) : null,
      id
    );
    logAudit(req.user!.id, req.user!.username, 'EDITAR', 'territorial', id, `Seccional N° ${number} actualizada`);
    res.json(db.prepare(`SELECT * FROM seccionales WHERE id = ?`).get(id));
  });

  app.delete('/api/territorial/seccionales/:id', requireAuth, requirePermission('territorial:manage'), (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    db.prepare(`DELETE FROM seccionales WHERE id = ?`).run(id);
    logAudit(req.user!.id, req.user!.username, 'ELIMINAR', 'territorial', id, 'Seccional eliminada');
    res.json({ ok: true });
  });

  // Statistics
  app.get('/api/statistics', requireAuth, requirePermission('statistics:view'), (req, res) => {
    const departmentId = req.query.department_id ? Number(req.query.department_id) : null;
    const districtId = req.query.district_id ? Number(req.query.district_id) : null;

    const totalActiveDepts = (db.prepare(`SELECT COUNT(*) AS c FROM departments WHERE active = 1`).get() as { c: number }).c;
    const totalActiveDistricts = (db.prepare(`SELECT COUNT(*) AS c FROM districts WHERE active = 1`).get() as { c: number }).c;
    const totalActiveSeccionales = (db.prepare(`SELECT COUNT(*) AS c FROM seccionales WHERE active = 1`).get() as { c: number }).c;

    const getStatsForTable = (table: PeopleTable) => {
      let where = `WHERE 1=1`;
      const params: unknown[] = [];
      if (departmentId) {
        where += ` AND t.department_id = ?`;
        params.push(departmentId);
      }
      if (districtId) {
        where += ` AND t.district_id = ?`;
        params.push(districtId);
      }
      const coverage = db
        .prepare(
          `SELECT COUNT(*) AS total,
                  COUNT(DISTINCT t.department_id) AS covered_depts,
                  COUNT(DISTINCT t.district_id) AS covered_dists,
                  COUNT(DISTINCT (t.district_id || '-' || t.seccional_number)) AS covered_seccs
           FROM ${table} t ${where}`
        )
        .get(...params) as { total: number; covered_depts: number; covered_dists: number; covered_seccs: number };

      const total = coverage.total;

      const byDept = db
        .prepare(
          `SELECT d.name, COUNT(*) AS count,
                  COUNT(DISTINCT t.district_id) AS districts_covered,
                  COUNT(DISTINCT (t.district_id || '-' || t.seccional_number)) AS seccionales_covered
           FROM ${table} t JOIN departments d ON d.id = t.department_id
           ${where}
           GROUP BY d.id, d.name ORDER BY count DESC`
        )
        .all(...params) as { name: string; count: number; districts_covered: number; seccionales_covered: number }[];
      const byDist = db
        .prepare(
          `SELECT dis.name, d.name AS department_name, COUNT(*) AS count,
                  COUNT(DISTINCT t.seccional_number) AS seccionales_covered
           FROM ${table} t
           JOIN departments d ON d.id = t.department_id
           JOIN districts dis ON dis.id = t.district_id
           ${where}
           GROUP BY dis.id, dis.name, d.name ORDER BY count DESC`
        )
        .all(...params) as { name: string; department_name: string; count: number; seccionales_covered: number }[];
      const bySecc = db
        .prepare(
          `SELECT t.seccional_number AS seccional, dis.name AS district_name, d.name AS department_name, COUNT(*) AS count
           FROM ${table} t
           JOIN departments d ON d.id = t.department_id
           JOIN districts dis ON dis.id = t.district_id
           ${where}
           GROUP BY t.seccional_number, dis.name, d.name ORDER BY count DESC`
        )
        .all(...params) as { seccional: number; district_name: string; department_name: string; count: number }[];

      return {
        total,
        coveredDepartments: coverage.covered_depts,
        coveredDistricts: coverage.covered_dists,
        coveredSeccionales: coverage.covered_seccs,
        byDept: byDept.map((r) => ({ ...r, pct: total ? Number(((r.count / total) * 100).toFixed(1)) : 0 })),
        byDist: byDist.map((r) => ({ ...r, pct: total ? Number(((r.count / total) * 100).toFixed(1)) : 0 })),
        bySecc: bySecc.map((r) => ({ ...r, pct: total ? Number(((r.count / total) * 100).toFixed(1)) : 0 })),
      };
    };

    let vpWhere = `WHERE 1=1`;
    const vpParams: unknown[] = [];
    if (departmentId) {
      vpWhere += ` AND vp.department_id = ?`;
      vpParams.push(departmentId);
    }
    if (districtId) {
      vpWhere += ` AND vp.district_id = ?`;
      vpParams.push(districtId);
    }
    const vpCoverage = db
      .prepare(
        `SELECT COALESCE(SUM(vp.estimated_votes), 0) AS s,
                COUNT(DISTINCT vp.department_id) AS covered_depts,
                COUNT(DISTINCT vp.district_id) AS covered_dists,
                COUNT(DISTINCT (vp.district_id || '-' || vp.seccional_number)) AS covered_seccs,
                COUNT(DISTINCT vp.coordinator_id) AS coords_covered
         FROM vote_projections vp ${vpWhere}`
      )
      .get(...vpParams) as {
      s: number;
      covered_depts: number;
      covered_dists: number;
      covered_seccs: number;
      coords_covered: number;
    };
    const vpTotal = vpCoverage.s;
    const vpByDept = db
      .prepare(
        `SELECT d.name, SUM(vp.estimated_votes) AS votes, COUNT(vp.id) AS records,
                COUNT(DISTINCT vp.coordinator_id) AS coordinators_count,
                COUNT(DISTINCT vp.district_id) AS districts_covered,
                COUNT(DISTINCT (vp.district_id || '-' || vp.seccional_number)) AS seccionales_covered
         FROM vote_projections vp JOIN departments d ON d.id = vp.department_id
         ${vpWhere} GROUP BY d.id, d.name ORDER BY votes DESC`
      )
      .all(...vpParams) as {
      name: string;
      votes: number;
      records: number;
      coordinators_count: number;
      districts_covered: number;
      seccionales_covered: number;
    }[];
    const vpByDist = db
      .prepare(
        `SELECT dis.name, d.name AS department_name, SUM(vp.estimated_votes) AS votes, COUNT(vp.id) AS records,
                COUNT(DISTINCT vp.coordinator_id) AS coordinators_count,
                COUNT(DISTINCT vp.seccional_number) AS seccionales_covered
         FROM vote_projections vp
         JOIN departments d ON d.id = vp.department_id
         JOIN districts dis ON dis.id = vp.district_id
         ${vpWhere} GROUP BY dis.id, dis.name, d.name ORDER BY votes DESC`
      )
      .all(...vpParams);
    const vpBySecc = db
      .prepare(
        `SELECT vp.seccional_number AS seccional, d.name AS department_name, dis.name AS district_name,
                SUM(vp.estimated_votes) AS votes, COUNT(DISTINCT vp.coordinator_id) AS coordinators_count
         FROM vote_projections vp
         JOIN departments d ON d.id = vp.department_id
         JOIN districts dis ON dis.id = vp.district_id
         ${vpWhere} GROUP BY vp.seccional_number, d.name, dis.name ORDER BY votes DESC`
      )
      .all(...vpParams);

    // Overall territorial coverage across all structure + projections
    let locFilter = `WHERE 1=1`;
    const locParams: unknown[] = [];
    if (departmentId) {
      locFilter += ` AND department_id = ?`;
      locParams.push(departmentId);
    }
    if (districtId) {
      locFilter += ` AND district_id = ?`;
      locParams.push(districtId);
    }

    const overallDepts = (
      db
        .prepare(
          `SELECT COUNT(DISTINCT department_id) AS c FROM (
            SELECT department_id, district_id FROM coordinators
            UNION SELECT department_id, district_id FROM youth_members
            UNION SELECT department_id, district_id FROM women_members
            UNION SELECT department_id, district_id FROM vote_projections
          ) ${locFilter}`
        )
        .get(...locParams) as { c: number }
    ).c;

    const overallDists = (
      db
        .prepare(
          `SELECT COUNT(DISTINCT district_id) AS c FROM (
            SELECT department_id, district_id FROM coordinators
            UNION SELECT department_id, district_id FROM youth_members
            UNION SELECT department_id, district_id FROM women_members
            UNION SELECT department_id, district_id FROM vote_projections
          ) ${locFilter}`
        )
        .get(...locParams) as { c: number }
    ).c;

    const overallSeccs = (
      db
        .prepare(
          `SELECT COUNT(DISTINCT (district_id || '-' || seccional_number)) AS c FROM (
            SELECT department_id, district_id, seccional_number FROM coordinators
            UNION SELECT department_id, district_id, seccional_number FROM youth_members
            UNION SELECT department_id, district_id, seccional_number FROM women_members
            UNION SELECT department_id, district_id, seccional_number FROM vote_projections
          ) ${locFilter}`
        )
        .get(...locParams) as { c: number }
    ).c;

    res.json({
      territorialTotals: {
        totalActiveDepts,
        totalActiveDistricts,
        totalActiveSeccionales,
        coveredDepartments: overallDepts,
        coveredDistricts: overallDists,
        coveredSeccionales: overallSeccs,
      },
      coordinators: getStatsForTable('coordinators'),
      youth: getStatsForTable('youth_members'),
      women: getStatsForTable('women_members'),
      votes: {
        total: vpTotal,
        coveredDepartments: vpCoverage.covered_depts,
        coveredDistricts: vpCoverage.covered_dists,
        coveredSeccionales: vpCoverage.covered_seccs,
        coordinatorsCovered: vpCoverage.coords_covered,
        byDept: vpByDept.map((r) => ({ ...r, pct: vpTotal ? Number(((r.votes / vpTotal) * 100).toFixed(1)) : 0 })),
        byDist: vpByDist,
        bySecc: vpBySecc,
      },
    });
  });

  // Reports Center
  app.post('/api/reports/preview', requireAuth, requirePermission('reports:view'), (req: AuthRequest, res: Response) => {
    const canSensitive = req.user!.role_slug === 'super_admin' || !!req.user!.permissions['sensitive_data:view'];
    const { reportType, department_id, district_id, seccional_number, date_from, date_to } = req.body || {};

    let where = `WHERE 1=1`;
    const params: unknown[] = [];

    const applyLoc = (alias: string) => {
      if (department_id) {
        where += ` AND ${alias}.department_id = ?`;
        params.push(Number(department_id));
      }
      if (district_id) {
        where += ` AND ${alias}.district_id = ?`;
        params.push(Number(district_id));
      }
      if (seccional_number) {
        where += ` AND ${alias}.seccional_number = ?`;
        params.push(Number(seccional_number));
      }
    };

    if (reportType === 'coordinators' || reportType === 'youth' || reportType === 'women') {
      const table = reportType === 'coordinators' ? 'coordinators' : reportType === 'youth' ? 'youth_members' : 'women_members';
      applyLoc('t');
      if (date_from) {
        where += ` AND t.registered_at >= ?`;
        params.push(date_from);
      }
      if (date_to) {
        where += ` AND t.registered_at <= ?`;
        params.push(date_to);
      }
      const rows = db
        .prepare(
          `SELECT t.id, t.first_name, t.last_name, t.ci, d.name AS department_name, dis.name AS district_name,
                  t.seccional_number, t.phone, t.registered_at, t.notes, t.custom_fields_json
           FROM ${table} t
           JOIN departments d ON d.id = t.department_id
           JOIN districts dis ON dis.id = t.district_id
           ${where}
           ORDER BY d.name ASC, dis.name ASC, t.seccional_number ASC, t.last_name ASC`
        )
        .all(...params) as Record<string, unknown>[];

      const subtotals = db
        .prepare(
          `SELECT d.name AS label, COUNT(*) AS count
           FROM ${table} t JOIN departments d ON d.id = t.department_id
           ${where} GROUP BY d.name ORDER BY count DESC`
        )
        .all(...params);

      return res.json({
        rows: rows.map((r) => ({
          ...r,
          ci: maskSensitive(String(r.ci || ''), canSensitive),
          phone: maskSensitive(String(r.phone || ''), canSensitive),
          ...JSON.parse(String(r.custom_fields_json || '{}')),
        })),
        subtotals,
        totalCount: rows.length,
        totalVotes: null,
      });
    }

    if (reportType === 'onp') {
      const organizationFilter = String(req.body?.organization || '').trim();
      const sortBy = String(req.body?.sort_by || 'full_name');
      let onpWhere = `WHERE 1=1`;
      const onpParams: unknown[] = [];
      if (organizationFilter) {
        onpWhere += ` AND organization LIKE ?`;
        onpParams.push(`%${organizationFilter}%`);
      }
      if (date_from) {
        onpWhere += ` AND registered_at >= ?`;
        onpParams.push(date_from);
      }
      if (date_to) {
        onpWhere += ` AND registered_at <= ?`;
        onpParams.push(date_to);
      }

      const orderClause =
        sortBy === 'organization'
          ? `ORDER BY LOWER(organization) ASC, LOWER(full_name) ASC, id ASC`
          : sortBy === 'id'
          ? `ORDER BY id ASC`
          : `ORDER BY LOWER(full_name) ASC, LOWER(organization) ASC, id ASC`;

      const rows = db
        .prepare(
          `SELECT id, full_name, phone, organization, registered_at, notes, custom_fields_json
           FROM onp_members
           ${onpWhere}
           ${orderClause}`
        )
        .all(...onpParams) as Record<string, unknown>[];

      const subtotals = db
        .prepare(
          `SELECT organization AS label, COUNT(*) AS count
           FROM onp_members
           ${onpWhere}
           GROUP BY organization
           ORDER BY LOWER(organization) ASC`
        )
        .all(...onpParams);

      return res.json({
        rows: rows.map((r) => ({
          ...r,
          phone: maskSensitive(String(r.phone || ''), canSensitive),
          ...JSON.parse(String(r.custom_fields_json || '{}')),
        })),
        subtotals,
        totalCount: rows.length,
        totalVotes: null,
      });
    }

    // Projection reports
    applyLoc('vp');
    if (reportType === 'projections_dept') {
      const rows = db
        .prepare(
          `SELECT d.name AS department_name, COUNT(vp.id) AS total_coordinadores, SUM(vp.estimated_votes) AS estimated_votes
           FROM vote_projections vp
           JOIN departments d ON d.id = vp.department_id
           ${where}
           GROUP BY d.id, d.name ORDER BY estimated_votes DESC`
        )
        .all(...params) as { estimated_votes: number }[];
      const totalVotes = rows.reduce((a, b) => a + Number(b.estimated_votes || 0), 0);
      return res.json({ rows, subtotals: [], totalCount: rows.length, totalVotes });
    }

    if (reportType === 'projections_district') {
      const rows = db
        .prepare(
          `SELECT d.name AS department_name, dis.name AS district_name, COUNT(vp.id) AS total_coordinadores, SUM(vp.estimated_votes) AS estimated_votes
           FROM vote_projections vp
           JOIN departments d ON d.id = vp.department_id
           JOIN districts dis ON dis.id = vp.district_id
           ${where}
           GROUP BY dis.id, dis.name, d.name ORDER BY estimated_votes DESC`
        )
        .all(...params) as { estimated_votes: number }[];
      const totalVotes = rows.reduce((a, b) => a + Number(b.estimated_votes || 0), 0);
      return res.json({ rows, subtotals: [], totalCount: rows.length, totalVotes });
    }

    if (reportType === 'projections_seccional') {
      const rows = db
        .prepare(
          `SELECT d.name AS department_name, dis.name AS district_name, vp.seccional_number, COUNT(vp.id) AS total_coordinadores, SUM(vp.estimated_votes) AS estimated_votes
           FROM vote_projections vp
           JOIN departments d ON d.id = vp.department_id
           JOIN districts dis ON dis.id = vp.district_id
           ${where}
           GROUP BY vp.seccional_number, dis.name, d.name ORDER BY estimated_votes DESC`
        )
        .all(...params) as { estimated_votes: number }[];
      const totalVotes = rows.reduce((a, b) => a + Number(b.estimated_votes || 0), 0);
      return res.json({ rows, subtotals: [], totalCount: rows.length, totalVotes });
    }

    // projections_general or projections_detail
    const rows = db
      .prepare(
        `SELECT vp.id, c.first_name, c.last_name, c.ci, d.name AS department_name, dis.name AS district_name,
                vp.seccional_number, vp.estimated_votes, vp.responsible_name, vp.updated_at, vp.notes
         FROM vote_projections vp
         JOIN coordinators c ON c.id = vp.coordinator_id
         JOIN departments d ON d.id = vp.department_id
         JOIN districts dis ON dis.id = vp.district_id
         ${where}
         ORDER BY d.name ASC, dis.name ASC, vp.seccional_number ASC, vp.estimated_votes DESC`
      )
      .all(...params) as Record<string, unknown>[];

    const subtotals = db
      .prepare(
        `SELECT d.name AS label, SUM(vp.estimated_votes) AS count
         FROM vote_projections vp JOIN departments d ON d.id = vp.department_id
         ${where} GROUP BY d.name ORDER BY count DESC`
      )
      .all(...params);

    const totalVotes = rows.reduce((a, b) => a + Number(b.estimated_votes || 0), 0);
    return res.json({
      rows: rows.map((r) => ({ ...r, ci: maskSensitive(String(r.ci || ''), canSensitive) })),
      subtotals,
      totalCount: rows.length,
      totalVotes,
    });
  });

  app.get('/api/reports/saved', requireAuth, requirePermission('reports:view'), (_req, res) => {
    res.json(db.prepare(`SELECT * FROM saved_reports ORDER BY id DESC LIMIT 30`).all());
  });

  app.post('/api/reports/saved', requireAuth, requirePermission('reports:view'), (req: AuthRequest, res: Response) => {
    const { title, report_type, filters, columns } = req.body || {};
    const info = db
      .prepare(`INSERT INTO saved_reports (title, report_type, filters_json, columns_json, generated_by) VALUES (?, ?, ?, ?, ?)`)
      .run(
        String(title || 'Informe personalizado'),
        String(report_type || 'coordinators'),
        JSON.stringify(filters || {}),
        JSON.stringify(columns || []),
        req.user!.username
      );
    res.status(201).json(db.prepare(`SELECT * FROM saved_reports WHERE id = ?`).get(info.lastInsertRowid));
  });

  app.delete('/api/reports/saved/:id', requireAuth, requirePermission('reports:view'), (req, res) => {
    db.prepare(`DELETE FROM saved_reports WHERE id = ?`).run(Number(req.params.id));
    res.json({ ok: true });
  });

  // Admin: Roles, Permissions, Users, Audit, Backup & Restore
  app.get('/api/admin/roles', requireAuth, requirePermission('admin:manage'), (_req, res) => {
    const roles = db.prepare(`SELECT * FROM roles ORDER BY id ASC`).all() as Record<string, unknown>[];
    const perms = db.prepare(`SELECT * FROM permissions ORDER BY id ASC`).all();
    const rp = db.prepare(`SELECT role_id, permission_id FROM role_permissions`).all() as {
      role_id: number;
      permission_id: number;
    }[];
    res.json({ roles, permissions: perms, rolePermissions: rp });
  });

  app.get('/api/admin/users', requireAuth, requirePermission('admin:manage'), (_req, res) => {
    const users = db
      .prepare(
        `SELECT u.id, u.username, u.full_name, u.email, u.role_id, u.custom_permissions_json, u.active, u.last_login_at, u.created_at,
                r.slug AS role_slug, r.name AS role_name
         FROM users u
         JOIN roles r ON r.id = u.role_id
         ORDER BY u.id ASC`
      )
      .all() as Record<string, unknown>[];
    res.json(
      users.map((u) => ({
        ...u,
        custom_permissions: JSON.parse(String(u.custom_permissions_json || '{}')),
      }))
    );
  });

  app.post('/api/admin/users', requireAuth, requirePermission('admin:manage'), (req: AuthRequest, res: Response) => {
    const { username, full_name, email, password, role_id, custom_permissions, active } = req.body || {};
    if (!username || !full_name || !password || !role_id) {
      return res.status(400).json({ error: 'Usuario, nombre completo, contraseña y rol son obligatorios.' });
    }
    try {
      const info = db
        .prepare(
          `INSERT INTO users (username, full_name, email, password_hash, role_id, custom_permissions_json, active)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          String(username).trim(),
          String(full_name).trim(),
          String(email || '').trim(),
          hashPassword(String(password)),
          Number(role_id),
          JSON.stringify(custom_permissions || {}),
          active !== false ? 1 : 0
        );
      logAudit(req.user!.id, req.user!.username, 'CREAR', 'usuarios', info.lastInsertRowid, `Usuario creado: ${username}`);
      res.status(201).json({ id: info.lastInsertRowid });
    } catch {
      res.status(409).json({ error: 'Ya existe un usuario con ese nombre de acceso.' });
    }
  });

  app.put('/api/admin/users/:id', requireAuth, requirePermission('admin:manage'), (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    const existing = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    if (!existing) return res.status(404).json({ error: 'Usuario no encontrado.' });
    const { full_name, email, password, role_id, custom_permissions, active } = req.body || {};

    const newHash = password && String(password).trim().length >= 6 ? hashPassword(String(password)) : existing.password_hash;
    db.prepare(
      `UPDATE users SET full_name = ?, email = ?, password_hash = ?, role_id = ?, custom_permissions_json = ?, active = ? WHERE id = ?`
    ).run(
      full_name ?? existing.full_name,
      email ?? existing.email,
      newHash,
      role_id ?? existing.role_id,
      custom_permissions !== undefined ? JSON.stringify(custom_permissions) : existing.custom_permissions_json,
      active !== undefined ? (active ? 1 : 0) : existing.active,
      id
    );
    logAudit(req.user!.id, req.user!.username, 'EDITAR', 'usuarios', id, `Usuario actualizado: ${existing.username}`);
    res.json({ ok: true });
  });

  app.delete('/api/admin/users/:id', requireAuth, requirePermission('admin:manage'), (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    if (id === req.user!.id) {
      return res.status(400).json({ error: 'No puede eliminar su propio usuario activo.' });
    }
    db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
    logAudit(req.user!.id, req.user!.username, 'ELIMINAR', 'usuarios', id, 'Usuario eliminado');
    res.json({ ok: true });
  });

  app.get('/api/admin/audit-logs', requireAuth, requirePermission('admin:manage'), (req, res) => {
    const search = String(req.query.search || '').trim();
    const moduleFilter = String(req.query.module || '').trim();
    let where = `WHERE 1=1`;
    const params: unknown[] = [];
    if (search) {
      where += ` AND (username LIKE ? OR action LIKE ? OR details LIKE ?)`;
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    if (moduleFilter) {
      where += ` AND module = ?`;
      params.push(moduleFilter);
    }
    const logs = db.prepare(`SELECT * FROM audit_logs ${where} ORDER BY id DESC LIMIT 200`).all(...params);
    res.json(logs);
  });

  // Full relational backup & restore
  app.get('/api/admin/backup', requireAuth, requirePermission('admin:manage'), (req: AuthRequest, res: Response) => {
    const snapshot = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      system_settings: db.prepare(`SELECT * FROM system_settings`).all(),
      departments: db.prepare(`SELECT * FROM departments`).all(),
      districts: db.prepare(`SELECT * FROM districts`).all(),
      seccionales: db.prepare(`SELECT * FROM seccionales`).all(),
      custom_fields: db.prepare(`SELECT * FROM custom_fields`).all(),
      coordinators: db.prepare(`SELECT * FROM coordinators`).all(),
      youth_members: db.prepare(`SELECT * FROM youth_members`).all(),
      women_members: db.prepare(`SELECT * FROM women_members`).all(),
      onp_members: db.prepare(`SELECT * FROM onp_members`).all(),
      vote_projections: db.prepare(`SELECT * FROM vote_projections`).all(),
      agenda_events: db.prepare(`SELECT * FROM agenda_events`).all(),
      activities: db.prepare(`SELECT * FROM activities`).all(),
      saved_reports: db.prepare(`SELECT * FROM saved_reports`).all(),
    };
    logAudit(req.user!.id, req.user!.username, 'RESPALDO', 'sistema', 'backup', 'Descarga de copia de seguridad completa');
    res.setHeader('Content-Disposition', `attachment; filename="respaldo-crm-politico-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(snapshot);
  });

  app.post('/api/admin/restore', requireAuth, requirePermission('admin:manage'), (req: AuthRequest, res: Response) => {
    const snap = req.body;
    if (!snap || !Array.isArray(snap.departments) || !Array.isArray(snap.coordinators)) {
      return res.status(400).json({ error: 'Archivo de respaldo inválido.' });
    }

    const restoreTx = db.transaction(() => {
      db.exec(`DELETE FROM activities; DELETE FROM agenda_events; DELETE FROM vote_projections;
               DELETE FROM coordinators; DELETE FROM youth_members; DELETE FROM women_members; DELETE FROM onp_members;
               DELETE FROM seccionales; DELETE FROM districts; DELETE FROM departments;
               DELETE FROM custom_fields; DELETE FROM saved_reports;`);

      const insDep = db.prepare(`INSERT INTO departments (id, code, name, active, created_at) VALUES (?, ?, ?, ?, ?)`);
      for (const r of snap.departments) insDep.run(r.id, r.code, r.name, r.active, r.created_at);

      const insDist = db.prepare(`INSERT INTO districts (id, department_id, name, active, created_at) VALUES (?, ?, ?, ?, ?)`);
      for (const r of snap.districts || []) insDist.run(r.id, r.department_id, r.name, r.active, r.created_at);

      const insSecc = db.prepare(`INSERT INTO seccionales (id, department_id, district_id, number, name, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);
      for (const r of snap.seccionales || []) insSecc.run(r.id, r.department_id, r.district_id, r.number, r.name, r.active, r.created_at);

      const insCf = db.prepare(`INSERT INTO custom_fields (id, module, field_key, label, field_type, required, active, sort_order, options_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const r of snap.custom_fields || []) insCf.run(r.id, r.module, r.field_key, r.label, r.field_type, r.required, r.active, r.sort_order, r.options_json, r.created_at);

      const insPerson = (table: PeopleTable, rows: Record<string, unknown>[]) => {
        const stmt = db.prepare(
          `INSERT INTO ${table} (id, first_name, last_name, ci, department_id, district_id, seccional_number, phone, registered_at, notes, consent_accepted, custom_fields_json, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        for (const r of rows) {
          stmt.run(r.id, r.first_name, r.last_name, r.ci, r.department_id, r.district_id, r.seccional_number, r.phone, r.registered_at, r.notes, r.consent_accepted, r.custom_fields_json, r.created_by, r.created_at, r.updated_at);
        }
      };
      insPerson('coordinators', snap.coordinators || []);
      insPerson('youth_members', snap.youth_members || []);
      insPerson('women_members', snap.women_members || []);

      const insOnp = db.prepare(
        `INSERT INTO onp_members (id, full_name, phone, organization, registered_at, notes, custom_fields_json, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const r of snap.onp_members || []) {
        insOnp.run(r.id, r.full_name, r.phone, r.organization, r.registered_at, r.notes, r.custom_fields_json, r.created_by, r.created_at, r.updated_at);
      }

      const insVp = db.prepare(
        `INSERT INTO vote_projections (id, coordinator_id, department_id, district_id, seccional_number, estimated_votes, responsible_name, responsible_user_id, notes, custom_fields_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const r of snap.vote_projections || []) {
        insVp.run(r.id, r.coordinator_id, r.department_id, r.district_id, r.seccional_number, r.estimated_votes, r.responsible_name, r.responsible_user_id, r.notes, r.custom_fields_json, r.created_at, r.updated_at);
      }

      const insEv = db.prepare(
        `INSERT INTO agenda_events (id, title, event_type, event_date, start_time, end_time, department_id, district_id, seccional_number, location, responsible, participants, description, notes, reminder_minutes, status, custom_fields_json, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const r of snap.agenda_events || []) {
        insEv.run(r.id, r.title, r.event_type, r.event_date, r.start_time, r.end_time, r.department_id, r.district_id, r.seccional_number, r.location, r.responsible, r.participants, r.description, r.notes, r.reminder_minutes, r.status, r.custom_fields_json, r.created_by, r.created_at, r.updated_at);
      }

      const insAct = db.prepare(`INSERT INTO activities (id, event_id, summary, attendance_count, outcomes, logged_by, logged_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);
      for (const r of snap.activities || []) insAct.run(r.id, r.event_id, r.summary, r.attendance_count, r.outcomes, r.logged_by, r.logged_at);
    });

    restoreTx();
    logAudit(req.user!.id, req.user!.username, 'RESTAURAR', 'sistema', 'restore', 'Restauración completa desde copia de seguridad');
    res.json({ ok: true });
  });
}
