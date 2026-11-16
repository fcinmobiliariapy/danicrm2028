import {
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
import { exportIndividualFichaPDF, exportTableToExcel, exportTableToPDF } from '../lib/export';
import { PersonRecord } from '../types';

interface PeopleModulePageProps {
  moduleKey: 'coordinators' | 'youth' | 'women';
  title: string;
  singularLabel: string;
  description: string;
}

interface PeopleResponse {
  items: PersonRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  locationSummary: { department_name: string; district_name: string; total: number }[];
  canViewSensitive: boolean;
}

export const PeopleModulePage: React.FC<PeopleModulePageProps> = ({
  moduleKey,
  title,
  singularLabel,
  description,
}) => {
  const { departments, districts, seccionales, customFields, settings, hasPermission, notify } = useApp();

  const moduleCustomFields = useMemo(
    () => customFields.filter((f) => f.module === moduleKey && f.active === 1),
    [customFields, moduleKey]
  );

  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterDist, setFilterDist] = useState('');
  const [filterSecc, setFilterSecc] = useState('');
  const [page, setPage] = useState(1);

  const [data, setData] = useState<PeopleResponse>({
    items: [],
    total: 0,
    page: 1,
    limit: 12,
    totalPages: 1,
    locationSummary: [],
    canViewSensitive: true,
  });
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PersonRecord | null>(null);
  const [viewing, setViewing] = useState<PersonRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PersonRecord | null>(null);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [ci, setCi] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [seccionalNumber, setSeccionalNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [registeredAt, setRegisteredAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(true);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const filterDistricts = useMemo(
    () => (filterDept ? districts.filter((d) => d.department_id === Number(filterDept)) : districts),
    [districts, filterDept]
  );

  const formDistricts = useMemo(
    () => (departmentId ? districts.filter((d) => d.department_id === Number(departmentId) && d.active === 1) : []),
    [districts, departmentId]
  );

  const formSeccionales = useMemo(
    () =>
      districtId
        ? seccionales.filter((s) => s.district_id === Number(districtId) && s.active === 1)
        : [],
    [seccionales, districtId]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        limit: '12',
      });
      if (search.trim()) qs.set('search', search.trim());
      if (filterDept) qs.set('department_id', filterDept);
      if (filterDist) qs.set('district_id', filterDist);
      if (filterSecc.trim()) qs.set('seccional_number', filterSecc.trim());

      const res = await apiFetch<PeopleResponse>(`/api/people/${moduleKey}?${qs.toString()}`);
      setData(res);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Error al cargar registros.', 'error');
    } finally {
      setLoading(false);
    }
  }, [moduleKey, page, search, filterDept, filterDist, filterSecc, notify]);

  useEffect(() => {
    setPage(1);
    setFilterDept('');
    setFilterDist('');
    setFilterSecc('');
    setSearch('');
  }, [moduleKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = () => {
    setEditing(null);
    setFirstName('');
    setLastName('');
    setCi('');
    const firstDept = departments.find((d) => d.active === 1);
    const defaultDeptId = firstDept ? String(firstDept.id) : '';
    const firstDist = districts.find((d) => d.department_id === Number(defaultDeptId) && d.active === 1);
    setDepartmentId(defaultDeptId);
    setDistrictId(firstDist ? String(firstDist.id) : '');
    setSeccionalNumber('');
    setPhone('');
    setRegisteredAt(new Date().toISOString().slice(0, 10));
    setNotes('');
    setConsentAccepted(true);
    setCustomValues({});
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (rec: PersonRecord) => {
    setEditing(rec);
    setFirstName(rec.first_name);
    setLastName(rec.last_name);
    setCi(rec.ci_raw || rec.ci);
    setDepartmentId(String(rec.department_id));
    setDistrictId(String(rec.district_id));
    setSeccionalNumber(String(rec.seccional_number));
    setPhone(rec.phone);
    setRegisteredAt(rec.registered_at.slice(0, 10));
    setNotes(rec.notes || '');
    setConsentAccepted(!!rec.consent_accepted);
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
        first_name: firstName,
        last_name: lastName,
        ci,
        department_id: Number(departmentId),
        district_id: Number(districtId),
        seccional_number: Number(seccionalNumber),
        phone,
        registered_at: registeredAt,
        notes,
        consent_accepted: consentAccepted,
        custom_fields: customValues,
      };
      if (editing) {
        await apiFetch(`/api/people/${moduleKey}/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        notify(`${singularLabel} actualizado correctamente.`);
      } else {
        await apiFetch(`/api/people/${moduleKey}`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        notify(`${singularLabel} registrado correctamente.`);
      }
      setModalOpen(false);
      await loadData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el registro.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/people/${moduleKey}/${deleteTarget.id}`, { method: 'DELETE' });
      notify(`${singularLabel} eliminado del sistema.`);
      setDeleteTarget(null);
      await loadData();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'No se pudo eliminar.', 'error');
    }
  };

  const fetchAllFiltered = async () => {
    const qs = new URLSearchParams({ page: '1', limit: '200' });
    if (search.trim()) qs.set('search', search.trim());
    if (filterDept) qs.set('department_id', filterDept);
    if (filterDist) qs.set('district_id', filterDist);
    if (filterSecc.trim()) qs.set('seccional_number', filterSecc.trim());
    const res = await apiFetch<PeopleResponse>(`/api/people/${moduleKey}?${qs.toString()}`);
    return res.items;
  };

  const handleExportExcel = async () => {
    const rows = await fetchAllFiltered();
    const cols = [
      { key: 'row_num', label: 'N°' },
      { key: 'first_name', label: 'Nombres' },
      { key: 'last_name', label: 'Apellidos' },
      { key: 'ci', label: 'C.I.' },
      { key: 'department_name', label: 'Departamento' },
      { key: 'district_name', label: 'Distrito' },
      { key: 'seccional_number', label: 'Seccional' },
      { key: 'phone', label: 'Teléfono' },
      { key: 'registered_at', label: 'Fecha Registro' },
      ...moduleCustomFields.map((cf) => ({ key: cf.field_key, label: cf.label })),
    ];
    exportTableToExcel(
      `listado-${moduleKey}`,
      title,
      cols,
      rows.map((r, idx) => ({
        row_num: idx + 1,
        ...r,
        registered_at: formatDisplayDate(r.registered_at, settings.date_format),
        ...(r.custom_fields || {}),
      }))
    );
    notify('Archivo Excel generado y descargado.');
  };

  const handleExportPDF = async () => {
    const rows = await fetchAllFiltered();
    const cols = [
      { key: 'row_num', label: 'N°' },
      { key: 'nombre_completo', label: 'Nombres y Apellidos' },
      { key: 'ci', label: 'C.I.' },
      { key: 'department_name', label: 'Departamento' },
      { key: 'district_name', label: 'Distrito' },
      { key: 'seccional_number', label: 'Secc.' },
      { key: 'phone', label: 'Teléfono' },
      { key: 'registered_at', label: 'Registro' },
    ];
    await exportTableToPDF({
      filename: `reporte-${moduleKey}`,
      title: `Listado de ${title}`,
      subtitle: `Total de registros incluidos: ${formatNumber(rows.length)}`,
      settings,
      columns: cols,
      rows: rows.map((r, idx) => ({
        row_num: idx + 1,
        ...r,
        nombre_completo: `${r.first_name} ${r.last_name}`,
        registered_at: formatDisplayDate(r.registered_at, settings.date_format),
      })),
      summaryLines: [`Total general de ${title.toLowerCase()}: ${formatNumber(rows.length)}`],
    });
    notify('Reporte PDF generado y descargado.');
  };

  const canCreate = hasPermission(`${moduleKey}:create`);
  const canEdit = hasPermission(`${moduleKey}:edit`);
  const canDelete = hasPermission(`${moduleKey}:delete`);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
          <p className="text-sm text-slate-600 mt-0.5">{description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
            <span>Excel</span>
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
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
              <span>Registrar {singularLabel}</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por nombre, apellido o C.I."
              className="w-full min-h-[42px] rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
            />
          </div>

          <select
            value={filterDept}
            onChange={(e) => {
              setFilterDept(e.target.value);
              setFilterDist('');
              setPage(1);
            }}
            className="min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
          >
            <option value="">Todos los departamentos</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <select
            value={filterDist}
            onChange={(e) => {
              setFilterDist(e.target.value);
              setPage(1);
            }}
            className="min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
          >
            <option value="">Todos los distritos</option>
            {filterDistricts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <input
            type="number"
            value={filterSecc}
            onChange={(e) => {
              setFilterSecc(e.target.value);
              setPage(1);
            }}
            placeholder="Seccional N°"
            className="min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono tabular-nums focus:border-slate-900 focus:outline-none"
          />
        </div>

        {/* Location totals summary */}
        {data.locationSummary.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
            <span className="font-semibold text-slate-900">Totales por ubicación:</span>
            {data.locationSummary.map((loc, idx) => (
              <span key={`${loc.department_name}-${loc.district_name}-${idx}`}>
                {loc.district_name} ({loc.department_name}):{' '}
                <strong className="font-mono tabular-nums text-slate-900">{loc.total}</strong>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Data Table (Desktop) & Card List (Mobile) */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Cargando registros...</div>
        ) : data.items.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-700">No se encontraron registros con los filtros aplicados.</p>
            {canCreate && (
              <button
                type="button"
                onClick={openCreate}
                style={{ backgroundColor: settings.primary_color }}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white"
              >
                <Plus className="h-4 w-4" />
                <span>Registrar primer {singularLabel.toLowerCase()}</span>
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Nombres y Apellidos</th>
                    <th className="py-3 px-4">C.I.</th>
                    <th className="py-3 px-4">Departamento / Distrito</th>
                    <th className="py-3 px-4 text-right">Seccional</th>
                    <th className="py-3 px-4">Teléfono</th>
                    <th className="py-3 px-4">Registro</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {data.items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {item.first_name} {item.last_name}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-700">{item.ci}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {item.department_name} · {item.district_name}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {item.seccional_number}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-600">{item.phone}</td>
                      <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-500">
                        {formatDisplayDate(item.registered_at, settings.date_format)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setViewing(item)}
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
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Tap List */}
            <div className="md:hidden divide-y divide-slate-100">
              {data.items.map((item) => (
                <div key={item.id} className="p-4 flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setViewing(item)}
                    className="text-left min-w-0 flex-1"
                  >
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {item.first_name} {item.last_name}
                    </div>
                    <div className="mt-1 text-xs text-slate-600 flex flex-wrap items-center gap-x-2">
                      <span className="font-mono tabular-nums">C.I. {item.ci}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.district_name}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">Secc. {item.seccional_number}</span>
                    </div>
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
              ))}
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
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl my-8">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-base font-semibold text-slate-900">
                {editing ? `Editar ${singularLabel}` : `Registrar Nuevo ${singularLabel}`}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nombres *</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Apellidos *</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Cédula de Identidad (C.I.) *</label>
                  <input
                    type="text"
                    required
                    value={ci}
                    onChange={(e) => setCi(e.target.value)}
                    placeholder="Ej: 3456120"
                    className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono *</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ej: 0981 452 110"
                    className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Departamento *</label>
                  <select
                    required
                    value={departmentId}
                    onChange={(e) => {
                      const nextDept = e.target.value;
                      setDepartmentId(nextDept);
                      const firstDist = districts.find(
                        (d) => d.department_id === Number(nextDept) && d.active === 1
                      );
                      setDistrictId(firstDist ? String(firstDist.id) : '');
                    }}
                    className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Seleccionar departamento</option>
                    {departments
                      .filter((d) => d.active === 1)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Distrito *</label>
                  <select
                    required
                    value={districtId}
                    onChange={(e) => setDistrictId(e.target.value)}
                    className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Seleccionar distrito</option>
                    {formDistricts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Seccional (Numérico) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    list="seccionales-list"
                    value={seccionalNumber}
                    onChange={(e) => setSeccionalNumber(e.target.value)}
                    placeholder="Ej: 14"
                    className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums"
                  />
                  <datalist id="seccionales-list">
                    {formSeccionales.map((s) => (
                      <option key={s.id} value={s.number}>
                        {s.name || `Seccional ${s.number}`}
                      </option>
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha de Registro *</label>
                  <input
                    type="date"
                    required
                    value={registeredAt}
                    onChange={(e) => setRegisteredAt(e.target.value)}
                    className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>

              {/* Dynamic Custom Fields */}
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

              <label className="flex items-start gap-2.5 text-xs text-slate-600 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={consentAccepted}
                  onChange={(e) => setConsentAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                />
                <span>
                  El titular autoriza el registro de sus datos personales (C.I. y teléfono) exclusivamente para fines
                  de organización territorial de la campaña, con derecho a corrección o eliminación.
                </span>
              </label>

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
                <h3 className="text-base font-semibold text-slate-900">Ficha Individual de {singularLabel}</h3>
                <p className="text-xs text-slate-500">Registro N° {viewing.id}</p>
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
              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                <div>
                  <div className="text-xs text-slate-500">Nombres y Apellidos</div>
                  <div className="font-semibold text-slate-900">
                    {viewing.first_name} {viewing.last_name}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Cédula de Identidad</div>
                  <div className="font-mono tabular-nums font-semibold text-slate-900">{viewing.ci}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Departamento</div>
                  <div className="text-slate-900">{viewing.department_name}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Distrito</div>
                  <div className="text-slate-900">{viewing.district_name}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Seccional</div>
                  <div className="font-mono tabular-nums font-semibold text-slate-900">N° {viewing.seccional_number}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Teléfono</div>
                  <div className="font-mono tabular-nums text-slate-900">{viewing.phone}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Fecha de Registro</div>
                  <div className="font-mono tabular-nums text-slate-900">
                    {formatDisplayDate(viewing.registered_at, settings.date_format)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Consentimiento</div>
                  <div className="text-emerald-700 font-medium">
                    {viewing.consent_accepted ? 'Verificado' : 'Pendiente'}
                  </div>
                </div>
              </div>

              {moduleCustomFields.length > 0 && (
                <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                  {moduleCustomFields.map((cf) => (
                    <div key={cf.id}>
                      <div className="text-xs text-slate-500">{cf.label}</div>
                      <div className="text-slate-900">{viewing.custom_fields?.[cf.field_key] || '—'}</div>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <div className="text-xs text-slate-500">Observaciones</div>
                <div className="mt-1 text-slate-700">{viewing.notes || 'Sin observaciones registradas.'}</div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => exportIndividualFichaPDF(singularLabel, settings, viewing, moduleCustomFields)}
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

      <ConfirmModal
        open={!!deleteTarget}
        title={`Eliminar ${singularLabel}`}
        message={`¿Está seguro de eliminar el registro de ${deleteTarget?.first_name} ${deleteTarget?.last_name} (C.I. ${deleteTarget?.ci})? Esta acción quedará registrada en el historial de auditoría.`}
        confirmLabel="Eliminar Registro"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
