import {
  ArrowDown,
  ArrowUp,
  Database,
  Download,
  Edit3,
  Palette,
  Plus,
  Save,
  Shield,
  Sliders,
  Trash2,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { ConfirmModal } from '../components/ConfirmModal';
import { useApp } from '../context/AppContext';
import { apiFetch, formatDisplayDate } from '../lib/api';
import { CustomField, SystemSettings } from '../types';

const THEME_PRESETS: {
  id: string;
  label: string;
  values: Partial<SystemSettings>;
}[] = [
  {
    id: 'institutional',
    label: 'Institucional Dani Centurión',
    values: {
      theme_mode: 'light',
      primary_color: '#1E3A8A',
      secondary_color: '#B91C1C',
      background_color: '#F8FAFC',
      surface_color: '#FFFFFF',
      text_color: '#0F172A',
    },
  },
  {
    id: 'graphite',
    label: 'Ejecutivo Grafito',
    values: {
      theme_mode: 'light',
      primary_color: '#0F172A',
      secondary_color: '#D97706',
      background_color: '#F1F5F9',
      surface_color: '#FFFFFF',
      text_color: '#0F172A',
    },
  },
  {
    id: 'emerald',
    label: 'Territorial Esmeralda',
    values: {
      theme_mode: 'light',
      primary_color: '#065F46',
      secondary_color: '#B45309',
      background_color: '#F4F7F5',
      surface_color: '#FFFFFF',
      text_color: '#0F172A',
    },
  },
  {
    id: 'night',
    label: 'Modo Oscuro Nocturno',
    values: {
      theme_mode: 'dark',
      primary_color: '#2563EB',
      secondary_color: '#DC2626',
      background_color: '#0F172A',
      surface_color: '#1E293B',
      text_color: '#F8FAFC',
    },
  },
];

const FONT_OPTIONS = [
  { value: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans (Moderna Geométrica)' },
  { value: 'Public Sans', label: 'Public Sans (Institucional Clara)' },
  { value: 'Outfit', label: 'Outfit (Contemporánea)' },
  { value: 'DM Sans', label: 'DM Sans (Ejecutiva)' },
  { value: 'Manrope', label: 'Manrope (Editorial Compacta)' },
  { value: 'Lora', label: 'Lora (Clásica Serif)' },
  { value: 'Source Serif 4', label: 'Source Serif 4 (Documental Serif)' },
];

interface RoleDef {
  id: number;
  slug: string;
  name: string;
  description: string;
}

interface PermDef {
  id: number;
  key: string;
  module: string;
  action: string;
  label: string;
}

interface AdminUser {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role_id: number;
  role_slug: string;
  role_name: string;
  active: number;
  last_login_at: string | null;
  custom_permissions: Record<string, boolean>;
}

interface AuditLogEntry {
  id: number;
  username: string;
  action: string;
  module: string;
  entity_id: string;
  details: string;
  created_at: string;
}

export const AdminPage: React.FC = () => {
  const { settings, refreshSettings, refreshCustomFields, refreshTerritorial, applyThemePreview, notify } = useApp();
  const [tab, setTab] = useState<'general' | 'fields' | 'users' | 'security'>('general');

  // General settings state
  const [formSettings, setFormSettings] = useState<SystemSettings>(settings);
  const [savingSettings, setSavingSettings] = useState(false);

  const updateThemeField = (patch: Partial<SystemSettings>) => {
    setFormSettings((prev) => {
      const next = { ...prev, ...patch };
      applyThemePreview(next);
      return next;
    });
  };

  // Custom fields state
  const [fieldModule, setFieldModule] = useState<CustomField['module']>('coordinators');
  const [allFields, setAllFields] = useState<CustomField[]>([]);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<CustomField['field_type']>('text');
  const [newFieldReq, setNewFieldReq] = useState(false);
  const [newFieldOptions, setNewFieldOptions] = useState('');

  // Users & Roles state
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<RoleDef[]>([]);
  const [permissions, setPermissions] = useState<PermDef[]>([]);
  const [rolePerms, setRolePerms] = useState<{ role_id: number; permission_id: number }[]>([]);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [uUsername, setUUsername] = useState('');
  const [uFullName, setUFullName] = useState('');
  const [uEmail, setUEmail] = useState('');
  const [uPassword, setUPassword] = useState('');
  const [uRoleId, setURoleId] = useState('');
  const [uActive, setUActive] = useState(true);
  const [uCustomPerms, setUCustomPerms] = useState<Record<string, boolean>>({});
  const [deleteUserTarget, setDeleteUserTarget] = useState<AdminUser | null>(null);

  // Audit & Backup state
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditSearch, setAuditSearch] = useState('');

  useEffect(() => {
    setFormSettings(settings);
  }, [settings]);

  const loadAllFields = useCallback(async () => {
    const res = await apiFetch<CustomField[]>('/api/custom-fields?all=1');
    setAllFields(res);
  }, []);

  const loadUsersAndRoles = useCallback(async () => {
    const [u, rp] = await Promise.all([
      apiFetch<AdminUser[]>('/api/admin/users'),
      apiFetch<{ roles: RoleDef[]; permissions: PermDef[]; rolePermissions: { role_id: number; permission_id: number }[] }>(
        '/api/admin/roles'
      ),
    ]);
    setUsers(u);
    setRoles(rp.roles);
    setPermissions(rp.permissions);
    setRolePerms(rp.rolePermissions);
  }, []);

  const loadAudit = useCallback(async () => {
    const res = await apiFetch<AuditLogEntry[]>(
      `/api/admin/audit-logs?search=${encodeURIComponent(auditSearch)}`
    );
    setAuditLogs(res);
  }, [auditSearch]);

  useEffect(() => {
    if (tab === 'fields') loadAllFields();
    if (tab === 'users') loadUsersAndRoles();
    if (tab === 'security') loadAudit();
  }, [tab, loadAllFields, loadUsersAndRoles, loadAudit]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(formSettings),
      });
      await refreshSettings();
      notify('Configuración general actualizada y aplicada.');
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Error al guardar configuración.', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleImageUpload = (field: 'logo_url' | 'institutional_image_url', file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFormSettings((prev) => ({ ...prev, [field]: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateField = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/custom-fields', {
        method: 'POST',
        body: JSON.stringify({
          module: fieldModule,
          label: newFieldLabel,
          field_type: newFieldType,
          required: newFieldReq,
          options: newFieldOptions
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      setNewFieldLabel('');
      setNewFieldOptions('');
      setNewFieldReq(false);
      await Promise.all([loadAllFields(), refreshCustomFields()]);
      notify('Campo personalizado agregado al módulo.');
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Error al crear campo.', 'error');
    }
  };

  const handleReorderField = async (fields: CustomField[], idx: number, dir: -1 | 1) => {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= fields.length) return;
    const a = fields[idx];
    const b = fields[targetIdx];
    await Promise.all([
      apiFetch(`/api/custom-fields/${a.id}`, { method: 'PUT', body: JSON.stringify({ sort_order: b.sort_order }) }),
      apiFetch(`/api/custom-fields/${b.id}`, { method: 'PUT', body: JSON.stringify({ sort_order: a.sort_order }) }),
    ]);
    await Promise.all([loadAllFields(), refreshCustomFields()]);
  };

  const openCreateUser = () => {
    setEditingUser(null);
    setUUsername('');
    setUFullName('');
    setUEmail('');
    setUPassword('');
    setURoleId(roles[2]?.id ? String(roles[2].id) : String(roles[0]?.id || ''));
    setUActive(true);
    setUCustomPerms({});
    setUserModalOpen(true);
  };

  const openEditUser = (u: AdminUser) => {
    setEditingUser(u);
    setUUsername(u.username);
    setUFullName(u.full_name);
    setUEmail(u.email || '');
    setUPassword('');
    setURoleId(String(u.role_id));
    setUActive(!!u.active);
    setUCustomPerms(u.custom_permissions || {});
    setUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        username: uUsername,
        full_name: uFullName,
        email: uEmail,
        password: uPassword,
        role_id: Number(uRoleId),
        active: uActive,
        custom_permissions: uCustomPerms,
      };
      if (editingUser) {
        await apiFetch(`/api/admin/users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        notify('Usuario y permisos actualizados.');
      } else {
        await apiFetch('/api/admin/users', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        notify('Usuario creado correctamente.');
      }
      setUserModalOpen(false);
      await loadUsersAndRoles();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Error al guardar usuario.', 'error');
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const data = await apiFetch<Record<string, unknown>>('/api/admin/backup');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `respaldo-crm-politico-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      notify('Copia de seguridad descargada.');
      loadAudit();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Error al generar respaldo.', 'error');
    }
  };

  const handleRestoreBackup = async (file?: File) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      await apiFetch('/api/admin/restore', {
        method: 'POST',
        body: JSON.stringify(parsed),
      });
      await Promise.all([refreshTerritorial(), refreshCustomFields(), loadAudit()]);
      notify('Base de datos restaurada correctamente desde la copia de seguridad.');
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Archivo de respaldo inválido.', 'error');
    }
  };

  const moduleFields = allFields.filter((f) => f.module === fieldModule);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Panel de Administración General</h1>
        <p className="text-sm text-slate-600 mt-0.5">
          Personalización integral de marca, formularios dinámicos, usuarios, permisos, auditoría y copias de seguridad
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-xl w-fit">
        {[
          { key: 'general', label: 'Configuración General', icon: Sliders },
          { key: 'fields', label: 'Campos Personalizados', icon: Plus },
          { key: 'users', label: 'Usuarios y Permisos', icon: Shield },
          { key: 'security', label: 'Auditoría y Respaldos', icon: Database },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key as typeof tab)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                tab === t.key ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: General Settings */}
      {tab === 'general' && (
        <form onSubmit={handleSaveSettings} className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre de la Plataforma</label>
              <input
                type="text"
                value={formSettings.platform_name}
                onChange={(e) => setFormSettings({ ...formSettings, platform_name: e.target.value })}
                className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre de la Organización</label>
              <input
                type="text"
                value={formSettings.organization_name}
                onChange={(e) => setFormSettings({ ...formSettings, organization_name: e.target.value })}
                className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Referencia de Campaña</label>
              <input
                type="text"
                value={formSettings.campaign_reference}
                onChange={(e) => setFormSettings({ ...formSettings, campaign_reference: e.target.value })}
                className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Formato de Documentos y Fechas</label>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={formSettings.document_format}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, document_format: e.target.value as 'A4' | 'LETTER' })
                  }
                  className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="A4">A4 (Estándar)</option>
                  <option value="LETTER">Carta (Letter)</option>
                </select>
                <select
                  value={formSettings.date_format}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, date_format: e.target.value as 'DD/MM/YYYY' | 'YYYY-MM-DD' })
                  }
                  className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="DD/MM/YYYY">DD/MM/AAAA</option>
                  <option value="YYYY-MM-DD">AAAA-MM-DD</option>
                </select>
              </div>
            </div>

            {/* Apariencia y Tema de la Plataforma */}
            <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-slate-700" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    Apariencia, Colores y Tipografía del Sistema
                  </h3>
                </div>
                <span className="text-xs text-slate-500">Vista previa instantánea · Guarde para confirmar</span>
              </div>

              {/* 1-Click Presets */}
              <div>
                <div className="text-xs font-semibold text-slate-700 mb-2">Temas Preestablecidos</div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  {THEME_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => updateThemeField(preset.values)}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium text-slate-800 hover:border-slate-400 transition-colors"
                    >
                      <span
                        className="h-4 w-4 rounded-full shrink-0 border border-slate-300"
                        style={{ backgroundColor: preset.values.primary_color }}
                      />
                      <span
                        className="h-4 w-4 rounded-full shrink-0 border border-slate-300 -ml-3"
                        style={{ backgroundColor: preset.values.secondary_color }}
                      />
                      <span className="truncate">{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme Colors */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  { key: 'primary_color', label: 'Color Principal' },
                  { key: 'secondary_color', label: 'Color Secundario' },
                  { key: 'background_color', label: 'Fondo General' },
                  { key: 'surface_color', label: 'Tarjetas / Paneles' },
                  { key: 'text_color', label: 'Texto Principal' },
                ].map((c) => {
                  const val = String(formSettings[c.key as keyof SystemSettings] || '#FFFFFF');
                  return (
                    <div key={c.key}>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">{c.label}</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={val}
                          onChange={(e) =>
                            updateThemeField({ [c.key]: e.target.value } as Partial<SystemSettings>)
                          }
                          className="h-9 w-10 rounded border border-slate-300 cursor-pointer shrink-0"
                        />
                        <input
                          type="text"
                          value={val}
                          onChange={(e) =>
                            updateThemeField({ [c.key]: e.target.value } as Partial<SystemSettings>)
                          }
                          className="w-full min-h-[36px] rounded-lg border border-slate-300 bg-white px-2 text-xs font-mono"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Mode, Font Family, Font Size Scale, Border Radius */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Modo de Tema</label>
                  <select
                    value={formSettings.theme_mode}
                    onChange={(e) => {
                      const mode = e.target.value as 'light' | 'dark' | 'custom';
                      if (mode === 'dark') {
                        updateThemeField({
                          theme_mode: 'dark',
                          background_color: '#0F172A',
                          surface_color: '#1E293B',
                          text_color: '#F8FAFC',
                        });
                      } else if (mode === 'light') {
                        updateThemeField({
                          theme_mode: 'light',
                          background_color: '#F8FAFC',
                          surface_color: '#FFFFFF',
                          text_color: '#0F172A',
                        });
                      } else {
                        updateThemeField({ theme_mode: 'custom' });
                      }
                    }}
                    className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="light">Claro (Estándar)</option>
                    <option value="dark">Oscuro</option>
                    <option value="custom">Personalizado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de Letra (Tipografía)</label>
                  <select
                    value={formSettings.font_family}
                    onChange={(e) => updateThemeField({ font_family: e.target.value })}
                    className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tamaño de Letra</label>
                  <select
                    value={formSettings.font_size_scale}
                    onChange={(e) =>
                      updateThemeField({ font_size_scale: e.target.value as 'compact' | 'normal' | 'large' })
                    }
                    className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="compact">Compacto</option>
                    <option value="normal">Normal (Estándar)</option>
                    <option value="large">Grande (Mayor lectura)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Estilo de Bordes</label>
                  <select
                    value={formSettings.border_radius}
                    onChange={(e) =>
                      updateThemeField({ border_radius: e.target.value as 'sharp' | 'rounded' | 'soft' })
                    }
                    className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="sharp">Recto (Ejecutivo)</option>
                    <option value="rounded">Redondeado (Estándar)</option>
                    <option value="soft">Suave (Amplio)</option>
                  </select>
                </div>
              </div>

              {/* Live Preview Box */}
              <div
                style={{
                  backgroundColor: formSettings.surface_color,
                  color: formSettings.text_color,
                  fontFamily: `"${formSettings.font_family}", system-ui, sans-serif`,
                  borderRadius:
                    formSettings.border_radius === 'sharp'
                      ? '4px'
                      : formSettings.border_radius === 'soft'
                      ? '18px'
                      : '12px',
                }}
                className="border border-slate-300 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="text-sm font-bold">
                    Vista Previa: {formSettings.platform_name}
                  </div>
                  <div className="text-xs opacity-75">
                    Tipografía activa: {formSettings.font_family} · Escala: {formSettings.font_size_scale}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    style={{ backgroundColor: formSettings.primary_color }}
                    className="px-3 py-1.5 rounded-md text-xs font-semibold text-white"
                  >
                    Botón Principal
                  </span>
                  <span
                    style={{ backgroundColor: formSettings.secondary_color }}
                    className="px-3 py-1.5 rounded-md text-xs font-semibold text-white"
                  >
                    Acento
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Logotipo Institucional</label>
              <div className="flex items-center gap-3">
                <img
                  src={formSettings.logo_url}
                  alt="Logo"
                  referrerPolicy="no-referrer"
                  className="h-11 w-11 rounded-lg object-cover border border-slate-200 shrink-0"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload('logo_url', e.target.files?.[0])}
                  className="text-xs text-slate-600"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Imagen Institucional</label>
              <div className="flex items-center gap-3">
                <img
                  src={formSettings.institutional_image_url}
                  alt="Banner"
                  referrerPolicy="no-referrer"
                  className="h-11 w-16 rounded-lg object-cover border border-slate-200 shrink-0"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload('institutional_image_url', e.target.files?.[0])}
                  className="text-xs text-slate-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Cabecera de Documentos</label>
              <input
                type="text"
                value={formSettings.header_text}
                onChange={(e) => setFormSettings({ ...formSettings, header_text: e.target.value })}
                className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Pie de Página de Documentos</label>
              <input
                type="text"
                value={formSettings.footer_text}
                onChange={(e) => setFormSettings({ ...formSettings, footer_text: e.target.value })}
                className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Texto Institucional</label>
              <textarea
                rows={2}
                value={formSettings.institutional_text}
                onChange={(e) => setFormSettings({ ...formSettings, institutional_text: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono de Contacto</label>
              <input
                type="text"
                value={formSettings.contact_phone}
                onChange={(e) => setFormSettings({ ...formSettings, contact_phone: e.target.value })}
                className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Correo de Contacto</label>
              <input
                type="email"
                value={formSettings.contact_email}
                onChange={(e) => setFormSettings({ ...formSettings, contact_email: e.target.value })}
                className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Dirección Institucional</label>
              <input
                type="text"
                value={formSettings.contact_address}
                onChange={(e) => setFormSettings({ ...formSettings, contact_address: e.target.value })}
                className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-200">
            <button
              type="submit"
              disabled={savingSettings}
              style={{ backgroundColor: formSettings.primary_color }}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white hover:opacity-95"
            >
              <Save className="h-4 w-4" />
              <span>{savingSettings ? 'Guardando...' : 'Guardar Configuración General'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Custom Fields */}
      {tab === 'fields' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleCreateField} className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-5 space-y-4 h-fit">
            <h2 className="text-sm font-semibold text-slate-900">Agregar Campo Personalizado</h2>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Módulo Destino</label>
              <select
                value={fieldModule}
                onChange={(e) => setFieldModule(e.target.value as CustomField['module'])}
                className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="coordinators">Coordinadores</option>
                <option value="youth">Jóvenes</option>
                <option value="women">Mujeres</option>
                <option value="onp">ONP (Organización No Política)</option>
                <option value="projections">Proyección de Votos</option>
                <option value="agenda">Agenda</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Etiqueta del Campo *</label>
              <input
                type="text"
                required
                value={newFieldLabel}
                onChange={(e) => setNewFieldLabel(e.target.value)}
                placeholder="Ej: Local de Votación"
                className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de Campo</label>
              <select
                value={newFieldType}
                onChange={(e) => setNewFieldType(e.target.value as CustomField['field_type'])}
                className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="text">Texto corto</option>
                <option value="number">Numérico</option>
                <option value="select">Lista desplegable</option>
                <option value="date">Fecha</option>
                <option value="textarea">Texto largo</option>
              </select>
            </div>
            {newFieldType === 'select' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Opciones (separadas por coma)
                </label>
                <input
                  type="text"
                  value={newFieldOptions}
                  onChange={(e) => setNewFieldOptions(e.target.value)}
                  placeholder="Opción 1, Opción 2, Opción 3"
                  className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            )}
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={newFieldReq}
                onChange={(e) => setNewFieldReq(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span>Campo obligatorio</span>
            </label>
            <button
              type="submit"
              style={{ backgroundColor: settings.primary_color }}
              className="w-full min-h-[40px] rounded-lg px-4 py-2 text-xs font-semibold text-white"
            >
              Agregar Campo
            </button>
          </form>

          <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                Campos Configurados ({moduleFields.length})
              </h2>
              <span className="text-xs text-slate-500">Se aplican automáticamente en formularios y reportes</span>
            </div>
            {moduleFields.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">
                No hay campos personalizados creados para este módulo.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {moduleFields.map((cf, idx) => (
                  <div key={cf.id} className="p-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{cf.label}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <span>Tipo: {cf.field_type}</span>
                        <span aria-hidden="true">·</span>
                        <span>{cf.required ? 'Obligatorio' : 'Opcional'}</span>
                        <span aria-hidden="true">·</span>
                        <span className={cf.active ? 'text-emerald-700 font-medium' : 'text-slate-400'}>
                          {cf.active ? 'Activo' : 'Desactivado'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleReorderField(moduleFields, idx, -1)}
                        className="h-8 w-8 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100"
                        title="Subir"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReorderField(moduleFields, idx, 1)}
                        className="h-8 w-8 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100"
                        title="Bajar"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/custom-fields/${cf.id}`, {
                            method: 'PUT',
                            body: JSON.stringify({ active: cf.active ? 0 : 1 }),
                          });
                          await Promise.all([loadAllFields(), refreshCustomFields()]);
                        }}
                        className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        {cf.active ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/custom-fields/${cf.id}`, { method: 'DELETE' });
                          await Promise.all([loadAllFields(), refreshCustomFields()]);
                          notify('Campo eliminado.');
                        }}
                        className="h-8 w-8 flex items-center justify-center rounded text-slate-500 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Users & Permissions */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Usuarios, Roles y Permisos Individuales</h2>
            <button
              type="button"
              onClick={openCreateUser}
              style={{ backgroundColor: settings.primary_color }}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white"
            >
              <UserPlus className="h-4 w-4" />
              <span>Crear Usuario</span>
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Usuario</th>
                    <th className="py-3 px-4">Nombre Completo</th>
                    <th className="py-3 px-4">Rol</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4">Último Acceso</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900">{u.username}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{u.full_name}</div>
                        <div className="text-xs text-slate-500">{u.email || '—'}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{u.role_name}</td>
                      <td className="py-3 px-4 text-xs">
                        <span className={u.active ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'}>
                          {u.active ? 'Activo' : 'Suspendido'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-slate-500">
                        {u.last_login_at ? formatDisplayDate(u.last_login_at, settings.date_format) : 'Sin acceso'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditUser(u)}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                            title="Editar usuario y permisos"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteUserTarget(u)}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-700"
                            title="Eliminar usuario"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Audit & Backups */}
      {tab === 'security' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Copia de Seguridad Completa</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Descarga un respaldo íntegro de todas las tablas relacionales en formato JSON verificable.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadBackup}
                style={{ backgroundColor: settings.primary_color }}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white shrink-0"
              >
                <Download className="h-4 w-4" />
                <span>Descargar Respaldo</span>
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Recuperación de Datos</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Restaura un respaldo previo mediante transacción atómica segura.
                </p>
              </div>
              <label className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shrink-0">
                <Upload className="h-4 w-4" />
                <span>Restaurar Archivo</span>
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => handleRestoreBackup(e.target.files?.[0])}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Historial de Auditoría de Modificaciones</h3>
                <p className="text-xs text-slate-500">Registro inmutable de usuario, fecha, módulo y acción realizada</p>
              </div>
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Filtrar por usuario, acción o detalle..."
                className="min-h-[38px] rounded-lg border border-slate-300 px-3 py-1.5 text-xs w-full sm:w-64"
              />
            </div>
            <div className="max-h-[460px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                    <th className="py-2.5 px-4">Fecha / Hora</th>
                    <th className="py-2.5 px-4">Usuario</th>
                    <th className="py-2.5 px-4">Módulo</th>
                    <th className="py-2.5 px-4">Acción</th>
                    <th className="py-2.5 px-4">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">{l.created_at}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{l.username}</td>
                      <td className="py-2.5 px-4 text-slate-600">{l.module}</td>
                      <td className="py-2.5 px-4 font-mono font-semibold text-slate-800">{l.action}</td>
                      <td className="py-2.5 px-4 text-slate-600">{l.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* User Modal */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl my-8">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-base font-semibold text-slate-900">
                {editingUser ? `Editar Usuario: ${editingUser.username}` : 'Crear Nuevo Usuario'}
              </h3>
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                className="h-9 w-9 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre de Usuario *</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingUser}
                    value={uUsername}
                    onChange={(e) => setUUsername(e.target.value)}
                    className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre Completo *</label>
                  <input
                    type="text"
                    required
                    value={uFullName}
                    onChange={(e) => setUFullName(e.target.value)}
                    className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    value={uEmail}
                    onChange={(e) => setUEmail(e.target.value)}
                    className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {editingUser ? 'Nueva Contraseña (dejar vacío para mantener)' : 'Contraseña *'}
                  </label>
                  <input
                    type="password"
                    required={!editingUser}
                    minLength={6}
                    value={uPassword}
                    onChange={(e) => setUPassword(e.target.value)}
                    className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Rol Asignado *</label>
                  <select
                    value={uRoleId}
                    onChange={(e) => setURoleId(e.target.value)}
                    className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={uActive}
                      onChange={(e) => setUActive(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span>Usuario habilitado para ingresar</span>
                  </label>
                </div>
              </div>

              {/* Granular Individual Permission Overrides */}
              <div className="pt-3 border-t border-slate-200">
                <div className="text-xs font-semibold text-slate-900 mb-2">
                  Permisos Individuales por Módulo (Sobrescriben el rol base si se modifican)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto border border-slate-200 rounded-lg p-3 bg-slate-50">
                  {permissions.map((p) => {
                    const roleHas = rolePerms.some(
                      (rp) => rp.role_id === Number(uRoleId) && rp.permission_id === p.id
                    );
                    const effective =
                      uCustomPerms[p.key] !== undefined ? uCustomPerms[p.key] : roleHas;
                    return (
                      <label key={p.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={effective}
                          onChange={(e) =>
                            setUCustomPerms((prev) => ({ ...prev, [p.key]: e.target.checked }))
                          }
                          className="h-3.5 w-3.5 rounded border-slate-300"
                        />
                        <span>{p.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: settings.primary_color }}
                  className="rounded-lg px-5 py-2 text-sm font-semibold text-white"
                >
                  Guardar Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteUserTarget}
        title="Eliminar Usuario"
        message={`¿Está seguro de eliminar al usuario "${deleteUserTarget?.username}"?`}
        confirmLabel="Eliminar Usuario"
        onConfirm={async () => {
          if (!deleteUserTarget) return;
          try {
            await apiFetch(`/api/admin/users/${deleteUserTarget.id}`, { method: 'DELETE' });
            notify('Usuario eliminado.');
            setDeleteUserTarget(null);
            await loadUsersAndRoles();
          } catch (err: unknown) {
            notify(err instanceof Error ? err.message : 'Error al eliminar.', 'error');
            setDeleteUserTarget(null);
          }
        }}
        onCancel={() => setDeleteUserTarget(null)}
      />
    </div>
  );
};
