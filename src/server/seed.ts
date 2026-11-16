import { hashPassword } from './auth.ts';
import { db } from './db.ts';

const PARAGUAY_DEPARTMENTS = [
  { code: '00', name: 'Capital' },
  { code: '01', name: 'Concepción' },
  { code: '02', name: 'San Pedro' },
  { code: '03', name: 'Cordillera' },
  { code: '04', name: 'Guairá' },
  { code: '05', name: 'Caaguazú' },
  { code: '06', name: 'Caazapá' },
  { code: '07', name: 'Itapúa' },
  { code: '08', name: 'Misiones' },
  { code: '09', name: 'Paraguarí' },
  { code: '10', name: 'Alto Paraná' },
  { code: '11', name: 'Central' },
  { code: '12', name: 'Ñeembucú' },
  { code: '13', name: 'Amambay' },
  { code: '14', name: 'Canindeyú' },
  { code: '15', name: 'Presidente Hayes' },
  { code: '16', name: 'Alto Paraguay' },
  { code: '17', name: 'Boquerón' },
];

const INITIAL_DISTRICTS: Record<string, string[]> = {
  Capital: ['Asunción'],
  Concepción: ['Concepción', 'Horqueta', 'Loreto', 'Yby Yaú'],
  'San Pedro': ['San Pedro de Ycuamandyyú', 'Santa Rosa del Aguaray', 'San Estanislao'],
  Cordillera: ['Caacupé', 'Tobatí', 'Piribebuy', 'Eusebio Ayala'],
  Guairá: ['Villarrica', 'Independencia', 'Mbocayaty'],
  Caaguazú: ['Coronel Oviedo', 'Caaguazú', 'J. Eulogio Estigarribia'],
  Caazapá: ['Caazapá', 'San Juan Nepomuceno', 'Yuty'],
  Itapúa: ['Encarnación', 'Cambyretá', 'Hohenau', 'Tomás Romero Pereira'],
  Misiones: ['San Juan Bautista', 'San Ignacio', 'Ayolas'],
  Paraguarí: ['Paraguarí', 'Carapeguá', 'Yaguarón'],
  'Alto Paraná': ['Ciudad del Este', 'Hernandarias', 'Presidente Franco', 'Minga Guazú'],
  Central: [
    'San Lorenzo',
    'Luque',
    'Fernando de la Mora',
    'Lambaré',
    'Capiatá',
    'Mariano Roque Alonso',
    'Ñemby',
    'Villa Elisa',
  ],
  Ñeembucú: ['Pilar', 'Alberdi'],
  Amambay: ['Pedro Juan Caballero', 'Bella Vista Norte'],
  Canindeyú: ['Salto del Guairá', 'Curuguaty'],
  'Presidente Hayes': ['Villa Hayes', 'Benjamín Aceval'],
  'Alto Paraguay': ['Fuerte Olimpo', 'Puerto Casado'],
  Boquerón: ['Filadelfia', 'Loma Plata', 'Mariscal Estigarribia'],
};

const ALL_PERMISSIONS = [
  { key: 'dashboard:view', module: 'dashboard', action: 'view', label: 'Ver Panel Principal' },
  { key: 'coordinators:view', module: 'coordinators', action: 'view', label: 'Ver Coordinadores' },
  { key: 'coordinators:create', module: 'coordinators', action: 'create', label: 'Registrar Coordinadores' },
  { key: 'coordinators:edit', module: 'coordinators', action: 'edit', label: 'Editar Coordinadores' },
  { key: 'coordinators:delete', module: 'coordinators', action: 'delete', label: 'Eliminar Coordinadores' },
  { key: 'youth:view', module: 'youth', action: 'view', label: 'Ver Jóvenes' },
  { key: 'youth:create', module: 'youth', action: 'create', label: 'Registrar Jóvenes' },
  { key: 'youth:edit', module: 'youth', action: 'edit', label: 'Editar Jóvenes' },
  { key: 'youth:delete', module: 'youth', action: 'delete', label: 'Eliminar Jóvenes' },
  { key: 'women:view', module: 'women', action: 'view', label: 'Ver Mujeres' },
  { key: 'women:create', module: 'women', action: 'create', label: 'Registrar Mujeres' },
  { key: 'women:edit', module: 'women', action: 'edit', label: 'Editar Mujeres' },
  { key: 'women:delete', module: 'women', action: 'delete', label: 'Eliminar Mujeres' },
  { key: 'onp:view', module: 'onp', action: 'view', label: 'Ver ONP (Organización No Política)' },
  { key: 'onp:create', module: 'onp', action: 'create', label: 'Registrar en ONP' },
  { key: 'onp:edit', module: 'onp', action: 'edit', label: 'Editar Registros ONP' },
  { key: 'onp:delete', module: 'onp', action: 'delete', label: 'Eliminar Registros ONP' },
  { key: 'projections:view', module: 'projections', action: 'view', label: 'Ver Proyección de Votos' },
  { key: 'projections:create', module: 'projections', action: 'create', label: 'Registrar Proyección' },
  { key: 'projections:edit', module: 'projections', action: 'edit', label: 'Editar Proyección' },
  { key: 'projections:delete', module: 'projections', action: 'delete', label: 'Eliminar Proyección' },
  { key: 'agenda:view', module: 'agenda', action: 'view', label: 'Ver Agenda y Calendario' },
  { key: 'agenda:create', module: 'agenda', action: 'create', label: 'Crear Eventos en Agenda' },
  { key: 'agenda:edit', module: 'agenda', action: 'edit', label: 'Editar Agenda' },
  { key: 'agenda:delete', module: 'agenda', action: 'delete', label: 'Eliminar Eventos' },
  { key: 'reports:view', module: 'reports', action: 'view', label: 'Ver Centro de Reportes' },
  { key: 'reports:export', module: 'reports', action: 'export', label: 'Exportar PDF y Excel' },
  { key: 'statistics:view', module: 'statistics', action: 'view', label: 'Ver Estadísticas' },
  { key: 'territorial:view', module: 'territorial', action: 'view', label: 'Ver Configuración Territorial' },
  { key: 'territorial:manage', module: 'territorial', action: 'manage', label: 'Administrar Deptos/Distritos/Seccionales' },
  { key: 'admin:manage', module: 'admin', action: 'manage', label: 'Acceso al Panel de Administración General' },
  { key: 'sensitive_data:view', module: 'sensitive_data', action: 'view', label: 'Ver C.I. y Teléfonos Completos' },
];

export function seedDatabase() {
  const settingsCount = (db.prepare(`SELECT COUNT(*) AS c FROM system_settings`).get() as { c: number }).c;
  if (settingsCount === 0) {
    db.prepare(
      `INSERT INTO system_settings (id, platform_name, organization_name, campaign_reference) VALUES (1, ?, ?, ?)`
    ).run(
      'CRM Político – Gestión Territorial',
      'Comando Territorial Dani Centurión 2018',
      'DANI CENTURIÓN 2018'
    );
  }

  const roleCount = (db.prepare(`SELECT COUNT(*) AS c FROM roles`).get() as { c: number }).c;
  if (roleCount === 0) {
    const insertRole = db.prepare(`INSERT INTO roles (slug, name, description, is_system) VALUES (?, ?, ?, 1)`);
    insertRole.run('super_admin', 'Administrador principal', 'Acceso total, configuración general, usuarios, permisos y respaldos.');
    insertRole.run('admin', 'Administrador', 'Gestión operativa completa de módulos autorizados y generación de informes.');
    insertRole.run('coordinator', 'Coordinador', 'Carga y consulta de coordinadores, jóvenes, mujeres, proyecciones y agenda.');
    insertRole.run('viewer', 'Usuario de consulta', 'Solo lectura en módulos autorizados con protección de datos sensibles.');

    const insertPerm = db.prepare(`INSERT INTO permissions (key, module, action, label) VALUES (?, ?, ?, ?)`);
    for (const p of ALL_PERMISSIONS) {
      insertPerm.run(p.key, p.module, p.action, p.label);
    }

    const roles = db.prepare(`SELECT id, slug FROM roles`).all() as { id: number; slug: string }[];
    const perms = db.prepare(`SELECT id, key FROM permissions`).all() as { id: number; key: string }[];
    const rpInsert = db.prepare(`INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)`);

    for (const role of roles) {
      for (const perm of perms) {
        if (role.slug === 'super_admin') {
          rpInsert.run(role.id, perm.id);
        } else if (role.slug === 'admin') {
          if (perm.key !== 'admin:manage') {
            rpInsert.run(role.id, perm.id);
          }
        } else if (role.slug === 'coordinator') {
          const allowed = [
            'dashboard:view',
            'coordinators:view', 'coordinators:create', 'coordinators:edit',
            'youth:view', 'youth:create', 'youth:edit',
            'women:view', 'women:create', 'women:edit',
            'onp:view', 'onp:create', 'onp:edit',
            'projections:view', 'projections:create', 'projections:edit',
            'agenda:view', 'agenda:create', 'agenda:edit',
            'reports:view', 'reports:export',
            'statistics:view', 'territorial:view', 'sensitive_data:view',
          ];
          if (allowed.includes(perm.key)) rpInsert.run(role.id, perm.id);
        } else if (role.slug === 'viewer') {
          const allowed = [
            'dashboard:view',
            'coordinators:view',
            'youth:view',
            'women:view',
            'onp:view',
            'projections:view',
            'agenda:view',
            'reports:view',
            'statistics:view',
            'territorial:view',
          ];
          if (allowed.includes(perm.key)) rpInsert.run(role.id, perm.id);
        }
      }
    }
  } else {
    // Ensure newly added permissions (like ONP) are synced into existing DBs
    const insertPerm = db.prepare(`INSERT OR IGNORE INTO permissions (key, module, action, label) VALUES (?, ?, ?, ?)`);
    for (const p of ALL_PERMISSIONS) {
      insertPerm.run(p.key, p.module, p.action, p.label);
    }
    const roles = db.prepare(`SELECT id, slug FROM roles`).all() as { id: number; slug: string }[];
    const onpPerms = db.prepare(`SELECT id, key FROM permissions WHERE module = 'onp'`).all() as {
      id: number;
      key: string;
    }[];
    const rpInsert = db.prepare(`INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`);
    for (const role of roles) {
      for (const perm of onpPerms) {
        if (role.slug === 'super_admin' || role.slug === 'admin') {
          rpInsert.run(role.id, perm.id);
        } else if (role.slug === 'coordinator' && ['onp:view', 'onp:create', 'onp:edit'].includes(perm.key)) {
          rpInsert.run(role.id, perm.id);
        } else if (role.slug === 'viewer' && perm.key === 'onp:view') {
          rpInsert.run(role.id, perm.id);
        }
      }
    }
  }

  const usersCount = (db.prepare(`SELECT COUNT(*) AS c FROM users`).get() as { c: number }).c;
  if (usersCount === 0) {
    const roleMap = Object.fromEntries(
      (db.prepare(`SELECT id, slug FROM roles`).all() as { id: number; slug: string }[]).map((r) => [r.slug, r.id])
    );
    const insUser = db.prepare(
      `INSERT INTO users (username, full_name, email, password_hash, role_id, active) VALUES (?, ?, ?, ?, ?, 1)`
    );
    insUser.run('admin', 'Dani Centurión · Dirección General', 'dcenturionpy@gmail.com', hashPassword('Dani2018!'), roleMap.super_admin);
    insUser.run('operador', 'Carlos Benítez · Administración', 'administracion@danicenturion2018.org.py', hashPassword('Admin2018!'), roleMap.admin);
    insUser.run('coordinador', 'Marcos Galeano · Coordinador Capital', 'coordinacion@danicenturion2018.org.py', hashPassword('Coord2018!'), roleMap.coordinator);
    insUser.run('consulta', 'Analista Territorial', 'consulta@danicenturion2018.org.py', hashPassword('Consulta2018!'), roleMap.viewer);
  }

  const deptCount = (db.prepare(`SELECT COUNT(*) AS c FROM departments`).get() as { c: number }).c;
  if (deptCount === 0) {
    const insDept = db.prepare(`INSERT INTO departments (code, name, active) VALUES (?, ?, 1)`);
    const insDist = db.prepare(`INSERT INTO districts (department_id, name, active) VALUES (?, ?, 1)`);
    const insSecc = db.prepare(`INSERT INTO seccionales (department_id, district_id, number, name, active) VALUES (?, ?, ?, ?, 1)`);

    for (const d of PARAGUAY_DEPARTMENTS) {
      const info = insDept.run(d.code, d.name);
      const deptId = Number(info.lastInsertRowid);
      const districts = INITIAL_DISTRICTS[d.name] || [d.name];
      districts.forEach((distName, idx) => {
        const dInfo = insDist.run(deptId, distName);
        const distId = Number(dInfo.lastInsertRowid);
        if (d.name === 'Capital') {
          [1, 3, 5, 7, 10, 12, 14, 18, 21, 24, 30, 35, 42].forEach((n) => {
            insSecc.run(deptId, distId, n, `Seccional Colorada N° ${n} - Asunción`);
          });
        } else {
          const base = Number(d.code) * 20 + idx * 5 + 1;
          insSecc.run(deptId, distId, base, `Seccional N° ${base} - ${distName}`);
          insSecc.run(deptId, distId, base + 1, `Seccional N° ${base + 1} - ${distName}`);
        }
      });
    }
  }

  const coordCount = (db.prepare(`SELECT COUNT(*) AS c FROM coordinators`).get() as { c: number }).c;
  if (coordCount === 0) {
    const getLoc = (deptName: string, distName: string) => {
      const row = db
        .prepare(
          `SELECT dep.id AS department_id, dis.id AS district_id
           FROM departments dep
           JOIN districts dis ON dis.department_id = dep.id
           WHERE dep.name = ? AND dis.name = ?`
        )
        .get(deptName, distName) as { department_id: number; district_id: number };
      return row;
    };

    const capital = getLoc('Capital', 'Asunción');
    const sanLorenzo = getLoc('Central', 'San Lorenzo');
    const luque = getLoc('Central', 'Luque');
    const lambare = getLoc('Central', 'Lambaré');
    const fdoMora = getLoc('Central', 'Fernando de la Mora');
    const cde = getLoc('Alto Paraná', 'Ciudad del Este');
    const encarnacion = getLoc('Itapúa', 'Encarnación');
    const caacupe = getLoc('Cordillera', 'Caacupé');
    const oviedo = getLoc('Caaguazú', 'Coronel Oviedo');

    const insCoord = db.prepare(
      `INSERT INTO coordinators (first_name, last_name, ci, department_id, district_id, seccional_number, phone, registered_at, notes, consent_accepted, custom_fields_json, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 1)`
    );

    const seedCoords = [
      ['Marcos Antonio', 'Galeano Villalba', '3456120', capital.department_id, capital.district_id, 14, '0981 452 110', '2026-10-02', 'Referente de barrio Sajonia con equipo completo de mesa.', '{"zona_electoral":"Sajonia Norte"}'],
      ['derlis Ramón', 'Aquino Paredes', '2984512', capital.department_id, capital.district_id, 7, '0971 234 890', '2026-10-04', 'Coordinación territorial Zona Obrero.', '{"zona_electoral":"Barrio Obrero"}'],
      ['Claudia Mabel', 'Bogado Duarte', '4120987', capital.department_id, capital.district_id, 21, '0982 678 331', '2026-10-06', 'Equipo logístico de movilización y día D.', '{"zona_electoral":"Villa Morra"}'],
      ['Hugo César', 'Martínez Rojas', '3211450', capital.department_id, capital.district_id, 30, '0984 510 229', '2026-10-08', 'Enlace con comisiones vecinales de Zeballos Cué.', '{"zona_electoral":"Zeballos Cué"}'],
      ['Néstor Fabián', 'González Vera', '3890112', sanLorenzo.department_id, sanLorenzo.district_id, 221, '0981 902 441', '2026-10-10', 'Coordinador distrital zona universitaria.', '{"zona_electoral":"Centro San Lorenzo"}'],
      ['Patricia Beatriz', 'Fleitas Cáceres', '4312789', luque.department_id, luque.district_id, 226, '0985 334 118', '2026-10-12', 'Estructura territorial Cuarto Barrio.', '{"zona_electoral":"Cuarto Barrio"}'],
      ['Óscar Eduardo', 'Salinas Gómez', '2789034', lambare.department_id, lambare.district_id, 236, '0972 441 780', '2026-10-15', 'Red de referentes en Valle Apuá.', '{"zona_electoral":"Valle Apuá"}'],
      ['Lourdes Lorena', 'Benítez Ortiz', '3998123', fdoMora.department_id, fdoMora.district_id, 231, '0983 115 622', '2026-10-17', 'Zona Norte Fernando de la Mora.', '{"zona_electoral":"Zona Norte"}'],
      ['Rodrigo Javier', 'Mendoza Silva', '3654890', cde.department_id, cde.district_id, 201, '0983 770 405', '2026-10-20', 'Coordinador regional Alto Paraná.', '{"zona_electoral":"Microcentro CDE"}'],
      ['Silvia Carolina', 'Núñez Ayala', '4450129', encarnacion.department_id, encarnacion.district_id, 141, '0985 881 204', '2026-10-24', 'Estructura circuito centro y San Isidro.', '{"zona_electoral":"San Isidro"}'],
      ['Gustavo Adolfo', 'Riquelme Sosa', '3112098', caacupe.department_id, caacupe.district_id, 61, '0971 660 512', '2026-10-28', 'Enlace departamental Cordillera.', '{"zona_electoral":"Centro Caacupé"}'],
      ['Víctor Manuel', 'Ferreira López', '3509876', oviedo.department_id, oviedo.district_id, 101, '0981 309 740', '2026-11-01', 'Referente de base Coronel Oviedo.', '{"zona_electoral":"Centro Oviedo"}'],
    ];

    const coordIds: { id: number; dept: number; dist: number; secc: number; name: string }[] = [];
    for (const c of seedCoords) {
      const capFirst = String(c[0]).charAt(0).toUpperCase() + String(c[0]).slice(1);
      const info = insCoord.run(capFirst, c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8], c[9]);
      coordIds.push({
        id: Number(info.lastInsertRowid),
        dept: Number(c[3]),
        dist: Number(c[4]),
        secc: Number(c[5]),
        name: `${capFirst} ${c[1]}`,
      });
    }

    const insYouth = db.prepare(
      `INSERT INTO youth_members (first_name, last_name, ci, department_id, district_id, seccional_number, phone, registered_at, notes, consent_accepted, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`
    );
    const seedYouth = [
      ['Lucas Gabriel', 'Pereira Domínguez', '5120345', capital.department_id, capital.district_id, 14, '0986 211 409', '2026-10-05', 'Juventud universitaria UNA · Redes y brigadas.'],
      ['Sofía Belén', 'Centurión Morales', '5432890', capital.department_id, capital.district_id, 7, '0981 742 310', '2026-10-09', 'Coordinación juvenil cultural Barrio Obrero.'],
      ['Matías Alejandro', 'Cabrera Ruiz', '5612904', sanLorenzo.department_id, sanLorenzo.district_id, 221, '0972 885 120', '2026-10-14', 'Voluntariado territorial San Lorenzo.'],
      ['Camila Montserrat', 'Rolón Giménez', '5349012', luque.department_id, luque.district_id, 226, '0984 319 044', '2026-10-18', 'Equipo de comunicación digital Luque.'],
      ['Tobías Ezequiel', 'Amarilla Franco', '5789231', cde.department_id, cde.district_id, 201, '0983 612 998', '2026-10-22', 'Jóvenes emprendedores Alto Paraná.'],
      ['Valentina Jazmín', 'Ibarra Escobar', '5501874', encarnacion.department_id, encarnacion.district_id, 141, '0985 410 733', '2026-10-27', 'Promoción juvenil Encarnación.'],
      ['Nicolás Andrés', 'Valdez Cardozo', '5290441', lambare.department_id, lambare.district_id, 236, '0971 504 218', '2026-11-02', 'Brigada de contacto vecinal Lambaré.'],
      ['Andrea Celeste', 'Delvalle Torres', '5410982', capital.department_id, capital.district_id, 21, '0982 904 115', '2026-11-05', 'Juventud profesional Villa Morra.'],
    ];
    for (const y of seedYouth) insYouth.run(...y);

    const insWomen = db.prepare(
      `INSERT INTO women_members (first_name, last_name, ci, department_id, district_id, seccional_number, phone, registered_at, notes, consent_accepted, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`
    );
    const seedWomen = [
      ['María Teresa', 'Alvarenga de Ortiz', '2450198', capital.department_id, capital.district_id, 14, '0981 554 209', '2026-10-03', 'Lideresa de comisiones de mujeres en Sajonia.'],
      ['Rossana Elizabeth', 'Gamarra Villalba', '3340912', capital.department_id, capital.district_id, 30, '0982 310 884', '2026-10-07', 'Red de mujeres emprendedoras Zeballos Cué.'],
      ['Gladys Beatriz', 'Maidana Cuevas', '2890145', sanLorenzo.department_id, sanLorenzo.district_id, 221, '0971 440 912', '2026-10-13', 'Coordinación femenina San Lorenzo.'],
      ['Norma Alicia', 'Paredes Barrios', '3109845', luque.department_id, luque.district_id, 226, '0984 712 330', '2026-10-16', 'Comisión solidaria de mujeres Luque.'],
      ['Zulma Raquel', 'Insaurralde Vega', '3782019', fdoMora.department_id, fdoMora.district_id, 231, '0983 220 419', '2026-10-21', 'Organización territorial Fernando de la Mora.'],
      ['Verónica Soledad', 'Báez Acosta', '4012983', cde.department_id, cde.district_id, 201, '0985 901 664', '2026-10-25', 'Red de mujeres Alto Paraná.'],
      ['Mirta Graciela', 'Cantero Medina', '2678110', caacupe.department_id, caacupe.district_id, 61, '0972 301 552', '2026-10-30', 'Referente distrital Caacupé.'],
      ['Lorena Patricia', 'Samaniego León', '3901284', encarnacion.department_id, encarnacion.district_id, 141, '0981 662 840', '2026-11-04', 'Mesa de trabajo de mujeres Itapúa.'],
    ];
    for (const w of seedWomen) insWomen.run(...w);

    const insProj = db.prepare(
      `INSERT INTO vote_projections (coordinator_id, department_id, district_id, seccional_number, estimated_votes, responsible_name, responsible_user_id, notes, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`
    );
    const estVotes = [1450, 980, 1120, 860, 1620, 1290, 940, 870, 1840, 1320, 740, 910];
    coordIds.forEach((c, i) => {
      insProj.run(
        c.id,
        c.dept,
        c.dist,
        c.secc,
        estVotes[i] || 750,
        'Dani Centurión · Dirección General',
        `Estimación territorial relevada con equipo de Seccional N° ${c.secc}.`,
        '2026-11-12 10:30:00'
      );
    });

    const insEvent = db.prepare(
      `INSERT INTO agenda_events (title, event_type, event_date, start_time, end_time, department_id, district_id, seccional_number, location, responsible, participants, description, notes, reminder_minutes, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 60, ?, 1)`
    );
    const seedEvents = [
      ['Plenaria Territorial de Coordinadores Capital', 'Reuniones con coordinadores', '2026-11-17', '18:30', '20:30', capital.department_id, capital.district_id, 14, 'Sede Central · Av. España 1240', 'Dani Centurión', 'Coordinadores de Seccionales 1 a 45', 'Revisión de metas territoriales, verificación de padrones de referentes y cronograma semanal.', 'Confirmar asistencia 24h antes.', 'programado'],
      ['Audiencia con Comisiones Vecinales de San Lorenzo', 'Audiencias', '2026-11-18', '09:30', '11:30', sanLorenzo.department_id, sanLorenzo.district_id, 221, 'Local Seccional N° 221', 'Néstor Fabián González', 'Presidentes de comisiones vecinales y equipo distrital', 'Recepción de propuestas de infraestructura comunitaria y agenda social.', 'Llevar carpeta técnica.', 'programado'],
      ['Mesa Legislativa y Agenda Parlamentaria', 'Actividades parlamentarias', '2026-11-19', '10:00', '12:00', capital.department_id, capital.district_id, 7, 'Congreso Nacional · Sala Bicameral', 'Dani Centurión', 'Equipo parlamentario y asesores jurídicos', 'Análisis de proyectos prioritarios y agenda de comisiones.', 'Preparar resumen ejecutivo.', 'programado'],
      ['Encuentro Departamental de Mujeres Líderes', 'Eventos especiales', '2026-11-21', '16:00', '18:30', luque.department_id, luque.district_id, 226, 'Centro Cultural Luqueño', 'Norma Alicia Paredes', 'Estructura de Mujeres de Central y Capital', 'Jornada de capacitación en liderazgo territorial y organización de bases.', 'Confirmado audio y logística.', 'programado'],
      ['Caminata y Visita Territorial Seccional N° 21', 'Actividades territoriales', '2026-11-23', '08:30', '12:00', capital.department_id, capital.district_id, 21, 'Plaza Villa Morra · Punto de encuentro', 'Claudia Mabel Bogado', 'Jóvenes, mujeres y coordinadores de zona', 'Recorrido casa por casa y relevamiento de proyección territorial.', 'Distribuir materiales institucionales.', 'programado'],
      ['Reunión Política Regional Alto Paraná', 'Reuniones políticas', '2026-11-25', '19:00', '21:00', cde.department_id, cde.district_id, 201, 'Hotel Casino Acaray · Salón Paraná', 'Rodrigo Javier Mendoza', 'Coordinadores distritales de Alto Paraná', 'Evaluación de avance organizativo y consolidación de seccionales.', 'Transmisión interna para referentes.', 'programado'],
    ];
    for (const ev of seedEvents) {
      const res = insEvent.run(...ev);
      db.prepare(`INSERT INTO activities (event_id, summary, attendance_count, outcomes, logged_by) VALUES (?, ?, ?, ?, ?)`).run(
        Number(res.lastInsertRowid),
        'Actividad planificada en calendario oficial de campaña.',
        0,
        'Pendiente de ejecución.',
        'admin'
      );
    }

    const insField = db.prepare(
      `INSERT INTO custom_fields (module, field_key, label, field_type, required, active, sort_order, options_json)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
    );
    insField.run('coordinators', 'zona_electoral', 'Zona o Barrio de Referencia', 'text', 0, 1, '[]');
    insField.run('coordinators', 'disponibilidad_movilizacion', 'Disponibilidad de Movilización', 'select', 0, 2, JSON.stringify(['Vehículo propio', 'Motocicleta', 'Transporte coordinado', 'Sin movilidad']));
    insField.run('youth', 'area_interes', 'Área de Militancia Juvenil', 'select', 0, 1, JSON.stringify(['Redes y Comunicación', 'Brigada Territorial', 'Universitarios', 'Deporte y Cultura']));
    insField.run('women', 'comision_trabajo', 'Comisión de Trabajo', 'select', 0, 1, JSON.stringify(['Emprendedoras', 'Acción Social', 'Organización Electoral', 'Capacitación']));

    db.prepare(`INSERT INTO audit_logs (user_id, username, action, module, entity_id, details) VALUES (1, 'admin', 'SEED_INICIAL', 'sistema', '1', 'Inicialización de plataforma CRM Político DANI CENTURIÓN 2018 con 18 departamentos y datos base.')`).run();
  }

  const onpCount = (db.prepare(`SELECT COUNT(*) AS c FROM onp_members`).get() as { c: number }).c;
  if (onpCount === 0) {
    const insOnp = db.prepare(
      `INSERT INTO onp_members (full_name, phone, organization, registered_at, notes, created_by) VALUES (?, ?, ?, ?, ?, 1)`
    );
    const seedOnp = [
      ['Alberto Ramón Benítez', '0981 312 450', 'Comisión Vecinal Sajonia Unida', '2026-10-08', 'Presidente de comisión vecinal de infraestructura barrial.'],
      ['Beatriz Elena Villalba', '0982 645 190', 'Asociación de Feriantes del Mercado 4', '2026-10-12', 'Coordinación gremial de trabajadores independientes.'],
      ['Carlos Alberto Giménez', '0971 520 884', 'Club Deportivo Juventud Obrera', '2026-10-15', 'Dirigente deportivo y promotor de actividades comunitarias.'],
      ['Diana Paola Cáceres', '0984 219 770', 'Fundación Manos Solidarias Paraguay', '2026-10-19', 'Enlace social de asistencia educativa y jornadas médicas.'],
      ['Eduardo José Franco', '0983 410 662', 'Junta de Saneamiento San Lorenzo Norte', '2026-10-24', 'Referente de gestión comunitaria de agua potable.'],
      ['Fátima Concepción Núñez', '0985 773 108', 'Cooperativa Multiactiva La Paz Ltda.', '2026-10-29', 'Representante del consejo de educación cooperativa.'],
      ['Gustavo Enrique Vera', '0972 904 335', 'Asociación de Comerciantes de Luque', '2026-11-03', 'Enlace con pymes y emprendedores locales.'],
      ['Helena María Domínguez', '0981 882 514', 'Red de Voluntarios Ambientales Asunción', '2026-11-07', 'Coordinadora de jornadas de arborización y limpieza.'],
    ];
    for (const o of seedOnp) insOnp.run(...o);
  }
}
