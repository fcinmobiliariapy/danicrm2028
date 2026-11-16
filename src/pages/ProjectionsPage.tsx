import {
  AlertCircle,
  Edit3,
  FileSpreadsheet,
  FileText,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ConfirmModal } from '../components/ConfirmModal';
import { useApp } from '../context/AppContext';
import { apiFetch, formatDisplayDate, formatNumber } from '../lib/api';
import { exportTableToExcel, exportTableToPDF } from '../lib/export';
import { VoteProjection } from '../types';

interface CoordinatorHit {
  id: number;
  first_name: string;
  last_name: string;
  ci: string;
  department_id: number;
  district_id: number;
  seccional_number: number;
  department_name: string;
  district_name: string;
}

interface ProjectionsResponse {
  items: VoteProjection[];
  byDepartment: { id: number; name: string; total_votes: number; records_count: number }[];
  byDistrict: { id: number; name: string; department_name: string; total_votes: number; records_count: number }[];
  bySeccional: { seccional_number: number; department_name: string; district_name: string; total_votes: number; records_count: number }[];
  grandTotal: number;
}

const PIE_COLORS = ['#1E3A8A', '#B91C1C', '#D97706', '#0284C7', '#16A34A', '#475569', '#0F766E'];

export const ProjectionsPage: React.FC = () => {
  const { user, departments, districts, settings, hasPermission, notify } = useApp();

  const [data, setData] = useState<ProjectionsResponse>({
    items: [],
    byDepartment: [],
    byDistrict: [],
    bySeccional: [],
    grandTotal: 0,
  });
  const [loading, setLoading] = useState(true);

  const [filterDept, setFilterDept] = useState('');
  const [filterDist, setFilterDist] = useState('');
  const [filterSecc, setFilterSecc] = useState('');
  const [search, setSearch] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<VoteProjection | null>(null);
  const [coordQuery, setCoordQuery] = useState('');
  const [coordResults, setCoordResults] = useState<CoordinatorHit[]>([]);
  const [selectedCoord, setSelectedCoord] = useState<CoordinatorHit | null>(null);
  const [estimatedVotes, setEstimatedVotes] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<VoteProjection | null>(null);

  const filterDistricts = useMemo(
    () => (filterDept ? districts.filter((d) => d.department_id === Number(filterDept)) : districts),
    [districts, filterDept]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filterDept) qs.set('department_id', filterDept);
      if (filterDist) qs.set('district_id', filterDist);
      if (filterSecc.trim()) qs.set('seccional_number', filterSecc.trim());
      if (search.trim()) qs.set('search', search.trim());
      const res = await apiFetch<ProjectionsResponse>(`/api/projections?${qs.toString()}`);
      setData(res);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Error al cargar proyecciones.', 'error');
    } finally {
      setLoading(false);
    }
  }, [filterDept, filterDist, filterSecc, search, notify]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!modalOpen || editing) return;
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch<CoordinatorHit[]>(
          `/api/people/coordinators/search?q=${encodeURIComponent(coordQuery.trim())}`
        );
        setCoordResults(res);
      } catch {
        setCoordResults([]);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [coordQuery, modalOpen, editing]);

  const openCreate = () => {
    setEditing(null);
    setCoordQuery('');
    setSelectedCoord(null);
    setEstimatedVotes('');
    setResponsibleName(user?.full_name || '');
    setNotes('');
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (vp: VoteProjection) => {
    setEditing(vp);
    setSelectedCoord({
      id: vp.coordinator_id,
      first_name: vp.first_name,
      last_name: vp.last_name,
      ci: vp.ci,
      department_id: vp.department_id,
      district_id: vp.district_id,
      seccional_number: vp.seccional_number,
      department_name: vp.department_name,
      district_name: vp.district_name,
    });
    setEstimatedVotes(String(vp.estimated_votes));
    setResponsibleName(vp.responsible_name);
    setNotes(vp.notes || '');
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!selectedCoord) {
      setFormError('Busque y seleccione un coordinador válido.');
      return;
    }
    const votesNum = Number(estimatedVotes);
    if (isNaN(votesNum) || votesNum < 0) {
      setFormError('Ingrese una cantidad numérica válida de votos estimados.');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await apiFetch(`/api/projections/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            estimated_votes: votesNum,
            responsible_name: responsibleName,
            notes,
          }),
        });
        notify('Proyección de votos actualizada.');
      } else {
        await apiFetch('/api/projections', {
          method: 'POST',
          body: JSON.stringify({
            coordinator_id: selectedCoord.id,
            estimated_votes: votesNum,
            responsible_name: responsibleName,
            notes,
          }),
        });
        notify('Proyección de votos registrada.');
      }
      setModalOpen(false);
      await loadData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar la proyección.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/projections/${deleteTarget.id}`, { method: 'DELETE' });
      notify('Proyección eliminada.');
      setDeleteTarget(null);
      await loadData();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Error al eliminar.', 'error');
    }
  };

  const handleExportExcel = () => {
    exportTableToExcel(
      'proyeccion-votos-estimados',
      'Proyección de Votos',
      [
        { key: 'row_num', label: 'N°' },
        { key: 'coordinador', label: 'Coordinador' },
        { key: 'ci', label: 'C.I.' },
        { key: 'department_name', label: 'Departamento' },
        { key: 'district_name', label: 'Distrito' },
        { key: 'seccional_number', label: 'Seccional' },
        { key: 'estimated_votes', label: 'Votos Estimados (Proyección)' },
        { key: 'responsible_name', label: 'Responsable' },
        { key: 'updated_at', label: 'Actualización' },
      ],
      data.items.map((r, idx) => ({
        row_num: idx + 1,
        ...r,
        coordinador: `${r.first_name} ${r.last_name}`,
        updated_at: formatDisplayDate(r.updated_at, settings.date_format),
      }))
    );
    notify('Excel de proyecciones descargado.');
  };

  const handleExportPDF = async () => {
    await exportTableToPDF({
      filename: 'proyeccion-votos-estimados',
      title: 'Reporte de Proyección de Votos Estimados',
      subtitle: 'Estimaciones territoriales por coordinador (no representan votos confirmados)',
      settings,
      columns: [
        { key: 'row_num', label: 'N°' },
        { key: 'coordinador', label: 'Coordinador' },
        { key: 'department_name', label: 'Departamento' },
        { key: 'district_name', label: 'Distrito' },
        { key: 'seccional_number', label: 'Secc.' },
        { key: 'estimated_votes_fmt', label: 'Votos Estimados' },
        { key: 'responsible_name', label: 'Responsable' },
        { key: 'updated_fmt', label: 'Actualizado' },
      ],
      rows: data.items.map((r, idx) => ({
        row_num: idx + 1,
        ...r,
        coordinador: `${r.first_name} ${r.last_name}`,
        estimated_votes_fmt: formatNumber(r.estimated_votes),
        updated_fmt: formatDisplayDate(r.updated_at, settings.date_format),
      })),
      summaryLines: [
        `Total general de votos estimados (proyección): ${formatNumber(data.grandTotal)}`,
        `Total de registros sin duplicación: ${formatNumber(data.items.length)}`,
      ],
    });
    notify('PDF de proyecciones descargado.');
  };

  const canCreate = hasPermission('projections:create');
  const canEdit = hasPermission('projections:edit');
  const canDelete = hasPermission('projections:delete');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Proyección de Votos</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Estimaciones territoriales vinculadas a coordinadores · Control estricto anti-duplicación
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
            <span>Excel</span>
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <FileText className="h-4 w-4 text-red-700" />
            <span>PDF</span>
          </button>
          {canCreate && (
            <button
              type="button"
              onClick={openCreate}
              style={{ backgroundColor: settings.primary_color }}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white hover:opacity-95"
            >
              <Plus className="h-4 w-4" />
              <span>Nueva Proyección</span>
            </button>
          )}
        </div>
      </div>

      {/* Explicit Estimation Disclaimer */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3 text-xs text-amber-900">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" />
        <div>
          <strong>Nota metodológica:</strong> Todos los valores de este módulo corresponden a{' '}
          <strong>estimaciones proyectadas</strong> de intención y movilización territorial, y no representan votos
          confirmados ni resultados escrutados. Cada registro posee identificador único por coordinador y responsable
          para evitar duplicaciones en los totales.
        </div>
      </div>

      {/* Totals Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">Total General Estimado</div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatNumber(data.grandTotal)}
          </div>
          <div className="mt-1 text-[11px] text-amber-700 font-medium">Votos estimados</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">Departamentos con Proyección</div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatNumber(data.byDepartment.length)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Cobertura departamental</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">Distritos con Proyección</div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatNumber(data.byDistrict.length)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Cobertura distrital</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">Seccionales con Proyección</div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatNumber(data.bySeccional.length)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Registros únicos: {data.items.length}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar coordinador, C.I., responsable o seccional..."
            className="w-full min-h-[42px] rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <select
          value={filterDept}
          onChange={(e) => {
            setFilterDept(e.target.value);
            setFilterDist('');
          }}
          className="min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
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
          onChange={(e) => setFilterDist(e.target.value)}
          className="min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
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
          onChange={(e) => setFilterSecc(e.target.value)}
          placeholder="Seccional N°"
          className="min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums"
        />
      </div>

      {/* Charts: Bar by Dept, Bar by District, Bar by Seccional, Pie Territorial */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">Votos Estimados por Departamento</h2>
          <div className="h-64 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byDepartment} margin={{ top: 8, right: 12, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} interval={0} angle={-15} textAnchor="end" height={45} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip formatter={(val: unknown) => [formatNumber(Number(val)), 'Votos estimados']} />
                <Bar dataKey="total_votes" fill={settings.primary_color || '#1E3A8A'} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">Distribución Territorial (Circular)</h2>
          <div className="h-64 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.byDepartment}
                  dataKey="total_votes"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={84}
                  label={(entry) => `${entry.name}: ${formatNumber(entry.value)}`}
                >
                  {data.byDepartment.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: unknown) => [formatNumber(Number(val)), 'Votos estimados']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">Votos Estimados por Distrito</h2>
          <div className="h-64 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byDistrict.slice(0, 12)} margin={{ top: 8, right: 12, left: 0, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip formatter={(val: unknown) => [formatNumber(Number(val)), 'Votos estimados']} />
                <Bar dataKey="total_votes" fill="#0284C7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">Votos Estimados por Seccional</h2>
          <div className="h-64 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.bySeccional.slice(0, 12).map((s) => ({ ...s, label: `Secc. ${s.seccional_number}` }))}
                margin={{ top: 8, right: 12, left: 0, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip formatter={(val: unknown) => [formatNumber(Number(val)), 'Votos estimados']} />
                <Bar dataKey="total_votes" fill={settings.secondary_color || '#B91C1C'} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Comparative Table by District & Seccional */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Detalle de Proyecciones por Coordinador</h2>
            <p className="text-xs text-slate-500">Cada registro muestra fecha de actualización y responsable</p>
          </div>
          <div className="text-sm font-mono tabular-nums font-bold text-slate-900">
            Total: {formatNumber(data.grandTotal)} votos estimados
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Cargando proyecciones...</div>
        ) : data.items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No existen proyecciones registradas para los filtros seleccionados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Coordinador</th>
                  <th className="py-3 px-4">Departamento / Distrito</th>
                  <th className="py-3 px-4 text-right">Seccional</th>
                  <th className="py-3 px-4 text-right">Votos Estimados</th>
                  <th className="py-3 px-4">Responsable</th>
                  <th className="py-3 px-4">Actualización</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {data.items.map((vp) => (
                  <tr key={vp.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">
                        {vp.first_name} {vp.last_name}
                      </div>
                      <div className="text-xs font-mono tabular-nums text-slate-500">C.I. {vp.ci}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {vp.department_name} · {vp.district_name}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {vp.seccional_number}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                      {formatNumber(vp.estimated_votes)}
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs">{vp.responsible_name}</td>
                    <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-500">
                      {formatDisplayDate(vp.updated_at, settings.date_format)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => openEdit(vp)}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            title="Editar proyección"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(vp)}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-700"
                            title="Eliminar proyección"
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
        )}
      </div>

      {/* Create / Edit Projection Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-xl my-8">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-base font-semibold text-slate-900">
                {editing ? 'Actualizar Proyección de Votos' : 'Registrar Proyección de Votos'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="h-9 w-9 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
                  {formError}
                </div>
              )}

              {!editing && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Buscar Coordinador (Nombre, Apellido, C.I. o Seccional) *
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={coordQuery}
                      onChange={(e) => setCoordQuery(e.target.value)}
                      placeholder="Escriba nombre, apellido, C.I. o número de seccional..."
                      className="w-full min-h-[42px] rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm"
                    />
                  </div>
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                    {coordResults.length === 0 ? (
                      <div className="p-3 text-xs text-slate-500">Sin coincidencias</div>
                    ) : (
                      coordResults.map((c) => {
                        const isSel = selectedCoord?.id === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setSelectedCoord(c)}
                            className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 ${
                              isSel ? 'bg-slate-100 font-semibold' : ''
                            }`}
                          >
                            <span>
                              {c.first_name} {c.last_name} · C.I. {c.ci}
                            </span>
                            <span className="font-mono text-slate-500">
                              {c.district_name} · Secc. {c.seccional_number}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {selectedCoord && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">Coordinador:</span>{' '}
                    <strong className="text-slate-900">
                      {selectedCoord.first_name} {selectedCoord.last_name}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Departamento:</span>{' '}
                    <strong className="text-slate-900">{selectedCoord.department_name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Distrito:</span>{' '}
                    <strong className="text-slate-900">{selectedCoord.district_name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Seccional:</span>{' '}
                    <strong className="font-mono text-slate-900">N° {selectedCoord.seccional_number}</strong>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cantidad de Votos Estimados *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={estimatedVotes}
                    onChange={(e) => setEstimatedVotes(e.target.value)}
                    placeholder="Ej: 1200"
                    className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Responsable del Registro *
                  </label>
                  <input
                    type="text"
                    required
                    value={responsibleName}
                    onChange={(e) => setResponsibleName(e.target.value)}
                    className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

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
                  className="min-h-[42px] rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ backgroundColor: settings.primary_color }}
                  className="min-h-[42px] rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? 'Guardando...' : editing ? 'Actualizar Proyección' : 'Guardar Proyección'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Eliminar Proyección de Votos"
        message={`¿Desea eliminar la proyección de ${deleteTarget?.first_name} ${deleteTarget?.last_name} (${formatNumber(deleteTarget?.estimated_votes)} votos estimados)?`}
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
