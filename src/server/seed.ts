import { hashPassword } from './auth.js';
import { db } from './db.js';

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

export async function seedDatabase() {
  const settingsRes = await db.execute(`SELECT COUNT(*) AS c FROM system_settings`);
  const settingsCount = Number(settingsRes.rows[0]?.c || 0);

  if (settingsCount === 0) {
    await db.execute({
      sql: `INSERT INTO system_settings (id, platform_name, organization_name, campaign_reference) VALUES (1, ?, ?, ?)`,
      args: [
        'CRM Político – Gestión Territorial',
        'Comando Territorial Dani Centurión 2018',
        'DANI CENTURIÓN 2018',
      ],
    });
  }

  const roleRes = await db.execute(`SELECT COUNT(*) AS c FROM roles`);
  const roleCount = Number(roleRes.rows[0]?.c || 0);

  if (roleCount === 0) {
    await db.batch([
      {
        sql: `INSERT INTO roles (slug, name, description, is_system) VALUES (?, ?, ?, 1)`,
        args: ['super_admin', 'Administrador principal', 'Acceso total, configuración general, usuarios, permisos y respaldos.'],
      },
      {
        sql: `INSERT INTO roles (slug, name, description, is_system) VALUES (?, ?, ?, 1)`,
        args: ['admin', 'Administrador', 'Gestión operativa completa de módulos autorizados y generación de informes.'],
      },
      {
        sql: `INSERT INTO roles (slug, name, description, is_system) VALUES (?, ?, ?, 1)`,
        args: ['coordinator', 'Coordinador', 'Carga y consulta de coordinadores, jóvenes, mujeres, proyecciones y agenda.'],
      },
      {
        sql: `INSERT INTO roles (slug, name, description, is_system) VALUES (?, ?, ?, 1)`,
        args: ['viewer', 'Usuario de consulta', 'Solo lectura en módulos autorizados con protección de datos sensibles.'],
      },
    ], 'write');

    await db.batch(
      ALL_PERMISSIONS.map((p) => ({
        sql: `INSERT INTO permissions (key, module, action, label) VALUES (?, ?, ?, ?)`,
        args: [p.key, p.module, p.action, p.label],
      })),
      'write'
    );

    const rolesRes = await db.execute(`SELECT id, slug FROM roles`);
    const permsRes = await db.execute(`SELECT id, key FROM permissions`);
    const roles = rolesRes.rows as unknown as { id: number; slug: string }[];
    const perms = permsRes.rows as unknown as { id: number; key: string }[];

    const rpStatements: { sql: string; args: (number | string)[] }[] = [];

    for (const role of roles) {
      for (const perm of perms) {
        if (role.slug === 'super_admin') {
          rpStatements.push({ sql: `INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, args: [role.id, perm.id] });
        } else if (role.slug === 'admin') {
          if (perm.key !== 'admin:manage') {
            rpStatements.push({ sql: `INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, args: [role.id, perm.id] });
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
          if (allowed.includes(perm.key)) {
            rpStatements.push({ sql: `INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, args: [role.id, perm.id] });
          }
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
          if (allowed.includes(perm.key)) {
            rpStatements.push({ sql: `INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, args: [role.id, perm.id] });
          }
        }
      }
    }

    if (rpStatements.length > 0) {
      await db.batch(rpStatements, 'write');
    }

    // Crear usuario administrador inicial si no existe
    const superAdmin = roles.find((r) => r.slug === 'super_admin');
    if (superAdmin) {
      const passwordHash = await hashPassword('admin123');
      await db.execute({
        sql: `INSERT OR IGNORE INTO users (username, full_name, email, password_hash, role_id, active) VALUES (?, ?, ?, ?, ?, 1)`,
        args: ['admin', 'Administrador General', 'admin@danicrm.py', passwordHash, superAdmin.id],
      });
    }
  }

  // Sembrar Departamentos y Distritos si está vacío
  const deptRes = await db.execute(`SELECT COUNT(*) AS c FROM departments`);
