import { BookmarkPlus, Eye, FileSpreadsheet, FileText, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../context/AppContext';
import { apiFetch, formatDisplayDate, formatNumber } from '../lib/api';
import { exportTableToExcel, exportTableToPDF } from '../lib/export';

type ReportType =
  | 'coordinators'
  | 'youth'
  | 'women'
  | 'onp'
  | 'projections_general'
  | 'projections_dept'
  | 'projections_district'
  | 'projections_seccional';

const REPORT_TYPES: { key: ReportType; label: string }[] = [
  { key: 'coordinators', label: 'Coordinadores (Listado y Filtros)' },
  { key: 'youth', label: 'Jóvenes (Listado y Filtros)' },
  { key: 'women', label: 'Mujeres (Listado y Filtros)' },
  { key: 'onp', label: 'ONP · Organizaciones No Políticas (Ascendente)' },
  { key: 'projections_general', label: 'Proyección de Votos · Detalle por Coordinador' },
  { key: 'projections_dept', label: 'Proyección de Votos · Comparación por Departamento' },
  { key: 'projections_district', label: 'Proyección de Votos · Comparación por Distrito' },
  { key: 'projections_seccional', label: 'Proyección de Votos · Resumen por Seccional' },
];

const COLUMNS_BY_TYPE: Record<ReportType, { key: string; label: string }[]> = {
  coordinators: [
    { key: 'first_name', label: 'Nombres' },
    { key: 'last_name', label: 'Apellidos' },
    { key: 'ci', label: 'C.I.' },
    { key: 'department_name', label: 'Departamento' },
    { key: 'district_name', label: 'Distrito' },
    { key: 'seccional_number', label: 'Seccional' },
    { key: 'phone', label: 'Teléfono' },
    { key: 'registered_at', label: 'Fecha Registro' },
    { key: 'notes', label: 'Observaciones' },
  ],
  youth: [
    { key: 'first_name', label: 'Nombres' },
    { key: 'last_name', label: 'Apellidos' },
    { key: 'ci', label: 'C.I.' },
    { key: 'department_name', label: 'Departamento' },
    { key: 'district_name', label: 'Distrito' },
    { key: 'seccional_number', label: 'Seccional' },
    { key: 'phone', label: 'Teléfono' },
    { key: 'registered_at', label: 'Fecha Registro' },
  ],
  women: [
    { key: 'first_name', label: 'Nombres' },
    { key: 'last_name', label: 'Apellidos' },
    { key: 'ci', label: 'C.I.' },
    { key: 'department_name', label: 'Departamento' },
    { key: 'district_name', label: 'Distrito' },
    { key: 'seccional_number', label: 'Seccional' },
    { key: 'phone', label: 'Teléfono' },
    { key: 'registered_at', label: 'Fecha Registro' },
  ],
  onp: [
    { key: 'full_name', label: 'Nombres y Apellidos' },
    { key: 'phone', label: 'Teléfono' },
    { key: 'organization', label: 'Organización / Institución' },
    { key: 'registered_at', label: 'Fecha Registro' },
    { key: 'notes', label: 'Observaciones' },
  ],
  projections_general: [
    { key: 'first_name', label: 'Nombres' },
    { key: 'last_name', label: 'Apellidos' },
    { key: 'department_name', label: 'Departamento' },
    { key: 'district_name', label: 'Distrito' },
    { key: 'seccional_number', label: 'Seccional' },
    { key: 'estimated_votes', label: 'Votos Estimados' },
    { key: 'responsible_name', label: 'Responsable' },
    { key: 'updated_at', label: 'Actualización' },
  ],
  projections_dept: [
    { key: 'department_name', label: 'Departamento' },
    { key: 'total_coordinadores', label: 'Registros' },
    { key: 'estimated_votes', label: 'Votos Estimados' },
  ],
  projections_district: [
    { key: 'department_name', label: 'Departamento' },
    { key: 'district_name', label: 'Distrito' },
    { key: 'total_coordinadores', label: 'Registros' },
    { key: 'estimated_votes', label: 'Votos Estimados' },
  ],
  projections_seccional: [
    { key: 'department_name', label: 'Departamento' },
    { key: 'district_name', label: 'Distrito' },
    { key: 'seccional_number', label: 'Seccional' },
    { key: 'total_coordinadores', label: 'Registros' },
    { key: 'estimated_votes', label: 'Votos Estimados' },
  ],
};

interface SavedReport {
  id: number;
  title: string;
  report_type: ReportType;
  filters_json: string;
  columns_json: string;
  generated_by: string;
}

export const ReportsPage: React.FC = () => {
  const { departments, districts, settings, hasPermission, notify } = useApp();

  const [reportType, setReportType] = useState<ReportType>('coordinators');
  const [departmentId, setDepartmentId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [seccionalNumber, setSeccionalNumber] = useState('');
  const [onpOrganization, setOnpOrganization] = useState('');
  const [onpSortBy, setOnpSortBy] = useState<'full_name' | 'organization' | 'id'>('full_name');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedCols, setSelectedCols] = useState<string[]>(COLUMNS_BY_TYPE.coordinators.map((c) => c.key));
  const [includeSubtotals, setIncludeSubtotals] = useState(true);
  const [includeCharts, setIncludeCharts] = useState(true);

  const [previewData, setPreviewData] = useState<{
    rows: Record<string, unknown>[];
    subtotals: { label: string; count: number }[];
    totalCount: number;
    totalVotes: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [presetTitle, setPresetTitle] = useState('');

  const availableColumns = COLUMNS_BY_TYPE[reportType];
  const filterDistricts = useMemo(
    () => (departmentId ? districts.filter((d) => d.department_id === Number(departmentId)) : districts),
    [districts, departmentId]
  );

  const loadSaved = useCallback(async () => {
    try {
      const list = await apiFetch<SavedReport[]>('/api/reports/saved');
      setSavedReports(list);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  const runPreview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{
        rows: Record<string, unknown>[];
        subtotals: { label: string; count: number }[];
        totalCount: number;
        totalVotes: number | null;
      }>('/api/reports/preview', {
        method: 'POST',
        body: JSON.stringify({
          reportType,
          department_id: departmentId || null,
          district_id: districtId || null,
          seccional_number: seccionalNumber || null,
          organization: onpOrganization || null,
          sort_by: onpSortBy,
          date_from: dateFrom || null,
          date_to: dateTo || null,
        }),
      });
      setPreviewData(res);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Error al generar vista preliminar.', 'error');
    } finally {
      setLoading(false);
    }
  }, [reportType, departmentId, districtId, seccionalNumber, onpOrganization, onpSortBy, dateFrom, dateTo, notify]);

  useEffect(() => {
    runPreview();
  }, [runPreview]);

  const handleTypeChange = (next: ReportType) => {
    setReportType(next);
    setSelectedCols(COLUMNS_BY_TYPE[next].map((c) => c.key));
  };

  const toggleCol = (key: string) => {
    setSelectedCols((prev) =>
      prev.includes(key) ? (prev.length > 1 ? prev.filter((k) => k !== key) : prev) : [...prev, key]
    );
  };

  const activeColumnDefs = availableColumns.filter((c) => selectedCols.includes(c.key));
  const reportLabel = REPORT_TYPES.find((r) => r.key === reportType)?.label || 'Informe';

  const handleDownloadPDF = async () => {
    if (!previewData) return;
    const summaryLines: string[] = [`Total de registros: ${formatNumber(previewData.totalCount)}`];
    if (previewData.totalVotes !== null) {
      summaryLines.push(`Total general de votos estimados (proyección): ${formatNumber(previewData.totalVotes)}`);
    }
    if (includeSubtotals && previewData.subtotals.length > 0) {
      summaryLines.push(
        `Subtotales: ${previewData.subtotals.map((s) => `${s.label}: ${formatNumber(s.count)}`).join(' | ')}`
      );
    }

    const numberedColumns = [{ key: 'row_num', label: 'N°' }, ...activeColumnDefs];

    await exportTableToPDF({
      filename: `informe-${reportType}-${new Date().toISOString().slice(0, 10)}`,
      title: reportLabel,
      subtitle: `${settings.organization_name} · Documento configurado (${settings.document_format})`,
      settings,
      columns: numberedColumns,
      rows: previewData.rows.map((r, idx) => ({
        row_num: idx + 1,
        ...r,
        registered_at: r.registered_at ? formatDisplayDate(String(r.registered_at), settings.date_format) : '',
        updated_at: r.updated_at ? formatDisplayDate(String(r.updated_at), settings.date_format) : '',
        estimated_votes: r.estimated_votes !== undefined ? formatNumber(Number(r.estimated_votes)) : '',
      })),
      summaryLines,
    });
    notify('Informe PDF descargado correctamente.');
  };

  const handleDownloadExcel = () => {
    if (!previewData) return;
    const numberedColumns = [{ key: 'row_num', label: 'N°' }, ...activeColumnDefs];
    exportTableToExcel(
      `informe-${reportType}-${new Date().toISOString().slice(0, 10)}`,
      reportLabel,
      numberedColumns,
      previewData.rows.map((r, idx) => ({
        row_num: idx + 1,
        ...r,
        registered_at: r.registered_at ? formatDisplayDate(String(r.registered_at), settings.date_format) : '',
        updated_at: r.updated_at ? formatDisplayDate(String(r.updated_at), settings.date_format) : '',
      }))
    );
    notify('Informe Excel descargado correctamente.');
  };

  const handleSavePreset = async () => {
    if (!presetTitle.trim()) return;
    await apiFetch('/api/reports/saved', {
      method: 'POST',
      body: JSON.stringify({
        title: presetTitle.trim(),
        report_type: reportType,
        filters: { departmentId, districtId, seccionalNumber, dateFrom, dateTo },
        columns: selectedCols,
      }),
    });
    setPresetTitle('');
    await loadSaved();
    notify('Configuración de informe guardada.');
  };

  const canExport = hasPermission('reports:export');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Centro de Reportes e Informes</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Generación de reportes dinámicos con filtros combinados, columnas configurables, vista preliminar, PDF y Excel
          </p>
        </div>

        {canExport && previewData && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadExcel}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
              <span>Descargar Excel</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPDF}
              style={{ backgroundColor: settings.primary_color }}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white hover:opacity-95"
            >
              <FileText className="h-4 w-4" />
              <span>Descargar PDF</span>
            </button>
          </div>
        )}
      </div>

      {/* Report Builder Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Parámetros del Informe</h2>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de Reporte</label>
              <select
                value={reportType}
                onChange={(e) => handleTypeChange(e.target.value as ReportType)}
                className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                {REPORT_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {reportType === 'onp' ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Filtrar por Organización / Institución
                  </label>
                  <input
                    type="text"
                    value={onpOrganization}
                    onChange={(e) => setOnpOrganization(e.target.value)}
                    placeholder="Todas las organizaciones..."
                    className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Ordenamiento Ascendente</label>
                  <select
                    value={onpSortBy}
                    onChange={(e) => setOnpSortBy(e.target.value as 'full_name' | 'organization' | 'id')}
                    className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="full_name">Nombres y Apellidos (A → Z)</option>
                    <option value="organization">Organización / Institución (A → Z)</option>
                    <option value="id">Orden de Registro (1 → N)</option>
                  </select>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Departamento</label>
                  <select
                    value={departmentId}
                    onChange={(e) => {
                      setDepartmentId(e.target.value);
                      setDistrictId('');
                    }}
                    className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Todos los departamentos</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Distrito</label>
                  <select
                    value={districtId}
                    onChange={(e) => setDistrictId(e.target.value)}
                    className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Todos los distritos</option>
                    {filterDistricts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Seccional N°</label>
                  <input
                    type="number"
                    value={seccionalNumber}
                    onChange={(e) => setSeccionalNumber(e.target.value)}
                    placeholder="Todas"
                    className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
              </>
            )}

            {['coordinators', 'youth', 'women', 'onp'].includes(reportType) && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Desde</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full min-h-[38px] rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Hasta</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full min-h-[38px] rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-slate-100">
              <div className="text-xs font-semibold text-slate-700 mb-2">Columnas a Incluir</div>
              <div className="grid grid-cols-2 gap-1.5">
                {availableColumns.map((col) => (
                  <label key={col.key} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCols.includes(col.key)}
                      onChange={() => toggleCol(col.key)}
                      className="h-3.5 w-3.5 rounded border-slate-300"
                    />
                    <span className="truncate">{col.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSubtotals}
                  onChange={(e) => setIncludeSubtotals(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300"
                />
                <span>Mostrar totales y subtotales</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCharts}
                  onChange={(e) => setIncludeCharts(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300"
                />
                <span>Incluir gráfico comparativo en vista preliminar</span>
              </label>
            </div>

            <div className="pt-3 border-t border-slate-100 flex gap-2">
              <input
                type="text"
                value={presetTitle}
                onChange={(e) => setPresetTitle(e.target.value)}
                placeholder="Nombre para guardar filtro..."
                className="flex-1 min-h-[36px] rounded-lg border border-slate-300 px-2.5 text-xs"
              />
              <button
                type="button"
                onClick={handleSavePreset}
                className="min-h-[36px] inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <BookmarkPlus className="h-3.5 w-3.5" />
                <span>Guardar</span>
              </button>
            </div>
          </div>

          {savedReports.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold text-slate-900 mb-2">Informes Guardados</div>
              <div className="space-y-1.5">
                {savedReports.map((sr) => (
                  <div key={sr.id} className="flex items-center justify-between gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        const f = JSON.parse(sr.filters_json || '{}');
                        setReportType(sr.report_type);
                        setDepartmentId(f.departmentId || '');
                        setDistrictId(f.districtId || '');
                        setSeccionalNumber(f.seccionalNumber || '');
                        setDateFrom(f.dateFrom || '');
                        setDateTo(f.dateTo || '');
                        setSelectedCols(JSON.parse(sr.columns_json || '[]'));
                      }}
                      className="text-left font-medium text-slate-700 hover:underline truncate"
                    >
                      {sr.title}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/reports/saved/${sr.id}`, { method: 'DELETE' });
                        loadSaved();
                      }}
                      className="text-slate-400 hover:text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Live Document Preview */}
        <div className="lg:col-span-8">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <Eye className="h-4 w-4" />
                <span>Vista Preliminar del Informe</span>
              </div>
              <span className="text-xs text-slate-500">
                Formato {settings.document_format} · {settings.date_format}
              </span>
            </div>

            <div className="p-6 space-y-5">
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
                <h3 className="text-lg font-bold text-slate-900">{reportLabel}</h3>
                <p className="text-xs text-slate-500">
                  Total de registros: <strong className="font-mono">{formatNumber(previewData?.totalCount || 0)}</strong>
                  {previewData?.totalVotes !== null && previewData?.totalVotes !== undefined && (
                    <>
                      {' '}
                      · Total votos estimados (proyección):{' '}
                      <strong className="font-mono">{formatNumber(previewData.totalVotes)}</strong>
                    </>
                  )}
                </p>
              </div>

              {includeCharts && previewData && previewData.subtotals.length > 0 && (
                <div className="h-52 border border-slate-100 rounded-lg p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={previewData.subtotals}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill={settings.primary_color} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {loading ? (
                <div className="py-10 text-center text-sm text-slate-500">Generando informe...</div>
              ) : !previewData || previewData.rows.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">No hay registros para este criterio.</div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                        <th className="py-2.5 px-3 whitespace-nowrap text-right w-12">N°</th>
                        {activeColumnDefs.map((col) => (
                          <th key={col.key} className="py-2.5 px-3 whitespace-nowrap">
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewData.rows.slice(0, 50).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70">
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-500 font-semibold">
                            {idx + 1}
                          </td>
                          {activeColumnDefs.map((col) => {
                            let val = row[col.key];
                            if (col.key === 'registered_at' || col.key === 'updated_at') {
                              val = formatDisplayDate(String(val || ''), settings.date_format);
                            } else if (col.key === 'estimated_votes') {
                              val = formatNumber(Number(val || 0));
                            }
                            return (
                              <td key={col.key} className="py-2 px-3 text-slate-700">
                                {String(val ?? '—')}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {includeSubtotals && previewData && previewData.subtotals.length > 0 && (
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700">
                  <span className="font-semibold text-slate-900">
                    {reportType === 'onp'
                      ? 'Subtotales por Organización / Institución: '
                      : 'Subtotales por Departamento: '}
                  </span>
                  {previewData.subtotals.map((s) => `${s.label} (${formatNumber(s.count)})`).join(' · ')}
                </div>
              )}

              <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-[11px] text-slate-500">
                <span>{settings.footer_text}</span>
                <span>Página 1 de 1</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
