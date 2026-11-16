import {
  ArrowUpAZ,
  Building2,
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  FileText,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ConfirmModal } from '../components/ConfirmModal';
import { useApp } from '../context/AppContext';
import { apiFetch, formatDisplayDate, formatNumber } from '../lib/api';
import { exportTableToExcel, exportTableToPDF } from '../lib/export';
import { OnpRecord } from '../types';

interface OnpResponse {
  items: OnpRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  organizations: { organization: string; total: number }[];
  canViewSensitive: boolean;
}

export const OnpPage: React.FC = () => {
  const { customFields, settings, hasPermission, notify } = useApp();

  const moduleCustomFields = useMemo(
    () => customFields.filter((f) => f.module === 'onp' && f.active === 1),
    [customFields]
  );

  const [search, setSearch] = useState('');
  const [filterOrg, setFilterOrg] = useState('');
  const [sortBy, setSortBy] = useState<'full_name' | 'organization' | 'id'>('full_name');
  const [page, setPage] = useState(1);

  const [data, setData] = useState<OnpResponse>({
    items: [],
    total: 0,
    page: 1,
    limit: 15,
    totalPages: 1,
    organizations: [],
    canViewSensitive: true,
  });
  const [loading, setLoading] = useState(true);

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<OnpRecord | null>(null);
  const [viewing, setViewing] = useState<{ record: OnpRecord; num: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OnpRecord | null>(null);

  // Report Preview Modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState<OnpRecord[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [organization, setOrganization] = useState('');
  const [registeredAt, setRegisteredAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        limit: '15',
        sort_by: sortBy,
      });
      if (search.trim()) qs.set('search', search.trim());
      if (filterOrg) qs.set('organization', filterOrg);
      const res = await apiFetch<OnpResponse>(`/api/onp?${qs.toString()}`);
      setData(res);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Error al cargar registros ONP.', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, search, filterOrg, notify]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const fetchAllAscending = async (): Promise<OnpRecord[]> => {
    const qs = new URLSearchParams({
      page: '1',
      limit: '500',
      sort_by: sortBy,
    });
    if (search.trim()) qs.set('search', search.trim());
    if (filterOrg) qs.set('organization', filterOrg);
    const res = await apiFetch<OnpResponse>(`/api/onp?${qs.toString()}`);
    return res.items;
  };

  const openPreviewReport = async () => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const rows = await fetchAllAscending();
      setPreviewRows(rows);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'No se pudo generar la vista previa.', 'error');
    } finally {
      setPreviewLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setFullName('');
    setPhone('');
    setOrganization('');
    setRegisteredAt(new Date().toISOString().slice(0, 10));
    setNotes('');
    setCustomValues({});
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (rec: OnpRecord) => {
    setEditing(rec);
    setFullName(rec.full_name);
    setPhone(rec.phone_raw || rec.phone);
    setOrganization(rec.organization);
    setRegisteredAt((rec.registered_at || new Date().toISOString()).slice(0, 10));
    setNotes(rec.notes || '');
    const cv: Record<string, string> = {};
    for (const [k, v] of Object.entries(rec.custom_fields || {})) {
      cv[k] = String(v ?? '');
    }
    setCustomValues(cv);
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    for (const cf of moduleCustomFields) {
      if (cf.required && !String(customValues[cf.field_key] || '').trim()) {
        setFormError(`El campo personalizado "${cf.label}" es obligatorio.`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        full_name: fullName,
        phone,
        organization,
        registered_at: registeredAt,
        notes,
        custom_fields: customValues,
      };
      if (editing) {
        await apiFetch(`/api/onp/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        notify('Registro ONP actualizado correctamente.');
      } else {
        await apiFetch('/api/onp', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        notify('Registro ONP agregado correctamente.');
      }
      setModalOpen(false);
      await loadData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el registro ONP.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/onp/${deleteTarget.id}`, { method: 'DELETE' });
      notify('Registro ONP eliminado.');
      setDeleteTarget(null);
      await loadData();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'No se pudo eliminar.', 'error');
    }
  };

  const handleExportExcel = async (preloadedRows?: OnpRecord[]) => {
    const rows = preloadedRows || (await fetchAllAscending());
    const cols = [
      { key: 'row_num', label: 'N°' },
      { key: 'full_name', label: 'Nombres y Apellidos' },
      { key: 'phone', label: 'Teléfono' },
      { key: 'organization', label: 'Organización / Institución' },
      { key: 'registered_at', label: 'Fecha Registro' },
      { key: 'notes', label: 'Observaciones' },
      ...moduleCustomFields.map((cf) => ({ key: cf.field_key, label: cf.label })),
    ];
    exportTableToExcel(
      `reporte-onp-${new Date().toISOString().slice(0, 10)}`,
      'ONP',
      cols,
      rows.map((r, idx) => ({
        row_num: idx + 1,
        ...r,
        registered_at: formatDisplayDate(r.registered_at, settings.date_format),
        ...(r.custom_fields || {}),
      }))
    );
    notify('Reporte Excel de ONP generado en orden ascendente.');
  };

  const handleExportPDF = async (preloadedRows?: OnpRecord[]) => {
    const rows = preloadedRows || (await fetchAllAscending());
    const cols = [
      { key: 'row_num', label: 'N°' },
      { key: 'full_name', label: 'Nombres y Apellidos' },
      { key: 'phone', label: 'Teléfono' },
      { key: 'organization', label: 'Organización / Institución' },
      { key: 'registered_at', label: 'Registro' },
    ];
    const sortLabel =
      sortBy === 'organization'
        ? 'Organización / Institución (A-Z)'
        : sortBy === 'id'
        ? 'Orden de Registro (Ascendente)'
        : 'Nombres y Apellidos (A-Z)';

    await exportTableToPDF({
      filename: `reporte-onp-${new Date().toISOString().slice(0, 10)}`,
      title: 'Reporte de Organizaciones No Políticas (ONP)',
      subtitle: `Orden ascendente: ${sortLabel} · Total de registros: ${formatNumber(rows.length)}`,
      settings,
      columns: cols,
      rows: rows.map((r, idx) => ({
        row_num: idx + 1,
        ...r,
        registered_at: formatDisplayDate(r.registered_at, settings.date_format),
      })),
      summaryLines: [
        `Total de referentes ONP incluidos: ${formatNumber(rows.length)}`,
        `Total de organizaciones/instituciones distintas: ${formatNumber(new Set(rows.map((r) => r.organization)).size)}`,
      ],
    });
    notify('Reporte PDF de ONP generado en orden ascendente.');
  };

  const handleExportSinglePDF = async (rec: OnpRecord, num: number) => {
    const rows = [
      { campo: 'N° de Orden', valor: String(num) },
      { campo: 'Nombres y Apellidos', valor: rec.full_name },
      { campo: 'Teléfono', valor: rec.phone },
      { campo: 'Organización / Institución', valor: rec.organization },
      { campo: 'Fecha de Registro', valor: formatDisplayDate(rec.registered_at, settings.date_format) },
      { campo: 'Observaciones', valor: rec.notes || 'Sin observaciones' },
      ...moduleCustomFields.map((cf) => ({
        campo: cf.label,
        valor: String(rec.custom_fields?.[cf.field_key] ?? '—'),
      })),
    ];
    await exportTableToPDF({
      filename: `ficha-onp-${rec.id}`,
      title: 'Ficha Individual ONP (Organización No Política)',
      subtitle: `${rec.full_name} · ${rec.organization}`,
      settings,
      columns: [
        { key: 'campo', label: 'Campo' },
        { key: 'valor', label: 'Información Registrada' },
      ],
      rows,
      orientation: 'portrait',
    });
  };

  const canCreate = hasPermission('onp:create');
  const canEdit = hasPermission('onp:edit');
  const canDelete = hasPermission('onp:delete');
  const startIndex = (page - 1) * data.limit;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Módulo ONP · Organizaciones No Políticas
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Registro de referentes sociales, gremiales y comunitarios · Listado ordenado y enumerado en ascendente
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openPreviewReport}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Eye className="h-4 w-4 text-slate-700" />
            <span>Vista Previa Reporte</span>
          </button>
          <button
            type="button"
            onClick={() => handleExportExcel()}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
            <span>Excel</span>
          </button>
          <button
            type="button"
            onClick={() => handleExportPDF()}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <FileText className="h-4 w-4 text-red-700" />
            <span>PDF</span>
          </button>
          {canCreate && (
            <button
              type="button"
              onClick={openCreate}
              style={{ backgroundColor: settings.primary_color }}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white hover:opacity-95 whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>Registrar ONP</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">Total Referentes ONP</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatNumber(data.total)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">Organizaciones / Instituciones</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatNumber(data.organizations.length)}
          </div>
        </div>
        <div className="col-span-2 sm:col-span-1 rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-medium text-slate-500">Ordenamiento Activo</div>
            <div className="mt-1 text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <ArrowUpAZ className="h-4 w-4 text-slate-600" />
              <span>Ascendente (1 → N)</span>
            </div>
          </div>
          <Building2 className="h-5 w-5 text-slate-400 shrink-0" />
        </div>
      </div>

      {/* Search, Filter & Ascending Sort Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="lg:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por nombres y apellidos, teléfono u organización/institución..."
            className="w-full min-h-[42px] rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
          />
        </div>

        <select
          value={filterOrg}
          onChange={(e) => {
            setFilterOrg(e.target.value);
            setPage(1);
          }}
          className="min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
        >
          <option value="">Todas las organizaciones ({data.organizations.length})</option>
          {data.organizations.map((org) => (
            <option key={org.organization} value={org.organization}>
              {org.organization} ({org.total})
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => {
            setSortBy(e.target.value as 'full_name' | 'organization' | 'id');
            setPage(1);
          }}
          aria-label="Orden ascendente"
          className="min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
        >
          <option value="full_name">Orden Ascendente: Nombres (A → Z)</option>
          <option value="organization">Orden Ascendente: Organización (A → Z)</option>
          <option value="id">Orden Ascendente: Registro (1 → N)</option>
        </select>
      </div>

      {/* Data Table (Desktop) & Card List (Mobile) */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Cargando registros ONP...</div>
        ) : data.items.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-700">No se encontraron registros ONP con los filtros aplicados.</p>
            {canCreate && (
              <button
                type="button"
                onClick={openCreate}
                style={{ backgroundColor: settings.primary_color }}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white"
              >
                <Plus className="h-4 w-4" />
                <span>Registrar primer contacto ONP</span>
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4 text-right w-14">N°</th>
                    <th className="py-3 px-4">Nombres y Apellidos</th>
                    <th className="py-3 px-4">Teléfono</th>
                    <th className="py-3 px-4">Organización / Institución</th>
                    <th className="py-3 px-4">Registro</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {data.items.map((item, idx) => {
                    const rowNum = startIndex + idx + 1;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-500">
                          {rowNum}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">{item.full_name}</td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-700">{item.phone}</td>
                        <td className="py-3 px-4 text-slate-700">{item.organization}</td>
                        <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-500">
                          {formatDisplayDate(item.registered_at, settings.date_format)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setViewing({ record: item, num: rowNum })}
                              className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                              title="Consultar ficha"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => openEdit(item)}
                                className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                title="Editar"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(item)}
                                className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-700"
                                title="Eliminar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Tap List */}
            <div className="md:hidden divide-y divide-slate-100">
              {data.items.map((item, idx) => {
                const rowNum = startIndex + idx + 1;
                return (
                  <div key={item.id} className="p-4 flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setViewing({ record: item, num: rowNum })}
                      className="text-left min-w-0 flex-1"
                    >
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        <span className="font-mono tabular-nums text-slate-500 mr-1.5">#{rowNum}</span>
                        {item.full_name}
                      </div>
                      <div className="mt-1 text-xs text-slate-600 truncate">{item.organization}</div>
                      <div className="mt-0.5 text-xs font-mono tabular-nums text-slate-500">{item.phone}</div>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                          aria-label="Editar"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="border-t border-slate-200 px-4 py-3 flex items-center justify-between text-xs text-slate-600">
              <span>
                Mostrando <strong className="font-mono tabular-nums">{data.items.length}</strong> de{' '}
                <strong className="font-mono tabular-nums">{formatNumber(data.total)}</strong> registros
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="min-h-[36px] rounded-md border border-slate-200 px-3 py-1 font-medium disabled:opacity-40 hover:bg-slate-50"
                >
                  Anterior
                </button>
                <span className="font-mono tabular-nums">
                  {page} / {data.totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  className="min-h-[36px] rounded-md border border-slate-200 px-3 py-1 font-medium disabled:opacity-40 hover:bg-slate-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-xl my-8">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-base font-semibold text-slate-900">
                {editing ? 'Editar Registro ONP' : 'Registrar en ONP (Organización No Política)'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="h-9 w-9 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nombres y Apellidos *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ej: Alberto Ramón Benítez"
                  className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono *</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ej: 0981 312 450"
                    className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha de Registro</label>
                  <input
                    type="date"
                    value={registeredAt}
                    onChange={(e) => setRegisteredAt(e.target.value)}
                    className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Organización / Institución *
                </label>
                <input
                  type="text"
                  required
                  list="onp-organizations-list"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="Ej: Comisión Vecinal, Club Deportivo, Fundación, Gremio..."
                  className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <datalist id="onp-organizations-list">
                  {data.organizations.map((org) => (
                    <option key={org.organization} value={org.organization} />
                  ))}
                </datalist>
              </div>

              {moduleCustomFields.length > 0 && (
                <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {moduleCustomFields.map((cf) => {
                    const opts = (() => {
                      try {
                        return JSON.parse(cf.options_json || '[]') as string[];
                      } catch {
                        return [];
                      }
                    })();
                    return (
                      <div key={cf.id} className={cf.field_type === 'textarea' ? 'sm:col-span-2' : ''}>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          {cf.label} {cf.required ? '*' : ''}
                        </label>
                        {cf.field_type === 'select' ? (
                          <select
                            required={!!cf.required}
                            value={customValues[cf.field_key] || ''}
                            onChange={(e) =>
                              setCustomValues((prev) => ({ ...prev, [cf.field_key]: e.target.value }))
                            }
                            className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                          >
                            <option value="">Seleccionar...</option>
                            {opts.map((o) => (
                              <option key={o} value={o}>
                                {o}
                              </option>
                            ))}
                          </select>
                        ) : cf.field_type === 'textarea' ? (
                          <textarea
                            rows={2}
                            required={!!cf.required}
                            value={customValues[cf.field_key] || ''}
                            onChange={(e) =>
                              setCustomValues((prev) => ({ ...prev, [cf.field_key]: e.target.value }))
                            }
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          />
                        ) : (
                          <input
                            type={cf.field_type}
                            required={!!cf.required}
                            value={customValues[cf.field_key] || ''}
                            onChange={(e) =>
                              setCustomValues((prev) => ({ ...prev, [cf.field_key]: e.target.value }))
                            }
                            className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Observaciones</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="min-h-[42px] rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ backgroundColor: settings.primary_color }}
                  className="min-h-[42px] rounded-lg px-5 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
                >
                  {saving ? 'Guardando...' : editing ? 'Guardar Cambios' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Individual Ficha Modal */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Ficha Individual ONP</h3>
                <p className="text-xs text-slate-500">Orden N° {viewing.num}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewing(null)}
                className="h-9 w-9 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-3 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                <div className="sm:col-span-2">
                  <div className="text-xs text-slate-500">Nombres y Apellidos</div>
                  <div className="font-semibold text-slate-900">{viewing.record.full_name}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Teléfono</div>
                  <div className="font-mono tabular-nums font-semibold text-slate-900">{viewing.record.phone}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Fecha de Registro</div>
                  <div className="font-mono tabular-nums text-slate-900">
                    {formatDisplayDate(viewing.record.registered_at, settings.date_format)}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-xs text-slate-500">Organización / Institución</div>
                  <div className="font-medium text-slate-900">{viewing.record.organization}</div>
                </div>
              </div>

              {moduleCustomFields.length > 0 && (
                <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                  {moduleCustomFields.map((cf) => (
                    <div key={cf.id}>
                      <div className="text-xs text-slate-500">{cf.label}</div>
                      <div className="text-slate-900">{viewing.record.custom_fields?.[cf.field_key] || '—'}</div>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <div className="text-xs text-slate-500">Observaciones</div>
                <div className="mt-1 text-slate-700">{viewing.record.notes || 'Sin observaciones registradas.'}</div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => handleExportSinglePDF(viewing.record, viewing.num)}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                <span>Descargar Ficha PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setViewing(null)}
                style={{ backgroundColor: settings.primary_color }}
                className="min-h-[40px] rounded-lg px-4 py-2 text-xs font-semibold text-white"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Preview Modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white shadow-2xl my-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Eye className="h-4 w-4" />
                <span>Vista Previa de Reporte · Organizaciones No Políticas (ONP)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExportExcel(previewRows)}
                  className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportPDF(previewRows)}
                  style={{ backgroundColor: settings.primary_color }}
                  className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white hover:opacity-95"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Descargar PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  className="h-9 w-9 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/70"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5 max-h-[78vh] overflow-y-auto">
              {/* Institutional Header */}
              <div
                style={{ backgroundColor: settings.primary_color }}
                className="rounded-lg p-4 text-white flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={settings.logo_url}
                    alt={settings.organization_name}
                    referrerPolicy="no-referrer"
                    className="h-11 w-11 rounded-md object-cover bg-white p-0.5"
                  />
                  <div>
                    <div className="text-sm font-bold">{settings.organization_name}</div>
                    <div className="text-xs opacity-90">{settings.header_text}</div>
                  </div>
                </div>
                <div className="text-right text-xs opacity-90 font-mono">
                  {formatDisplayDate(new Date().toISOString().slice(0, 10), settings.date_format)}
                </div>
              </div>

              <div>
                <h4 className="text-base font-bold text-slate-900">
                  Listado de Referentes de Organizaciones No Políticas (ONP)
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ordenado y enumerado en forma ascendente · Total:{' '}
                  <strong className="font-mono">{formatNumber(previewRows.length)}</strong> registros
                </p>
              </div>

              {previewLoading ? (
                <div className="py-10 text-center text-sm text-slate-500">Generando vista previa...</div>
              ) : previewRows.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">No hay registros para mostrar.</div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                        <th className="py-2.5 px-3 text-right w-12">N°</th>
                        <th className="py-2.5 px-3">Nombres y Apellidos</th>
                        <th className="py-2.5 px-3">Teléfono</th>
                        <th className="py-2.5 px-3">Organización / Institución</th>
                        <th className="py-2.5 px-3">Registro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewRows.map((row, idx) => (
                        <tr key={row.id} className="hover:bg-slate-50/70">
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-500 font-semibold">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3 font-medium text-slate-900">{row.full_name}</td>
                          <td className="py-2 px-3 font-mono tabular-nums text-slate-700">{row.phone}</td>
                          <td className="py-2 px-3 text-slate-700">{row.organization}</td>
                          <td className="py-2 px-3 font-mono tabular-nums text-slate-500">
                            {formatDisplayDate(row.registered_at, settings.date_format)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-[11px] text-slate-500">
                <span>{settings.footer_text}</span>
                <span>Formato {settings.document_format}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Eliminar Registro ONP"
        message={`¿Está seguro de eliminar el registro de ${deleteTarget?.full_name} (${deleteTarget?.organization})?`}
        confirmLabel="Eliminar Registro"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
