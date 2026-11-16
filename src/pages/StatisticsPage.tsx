import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../context/AppContext';
import { apiFetch, formatNumber } from '../lib/api';

interface ModuleStats {
  total: number;
  coveredDepartments: number;
  coveredDistricts: number;
  coveredSeccionales: number;
  byDept: {
    name: string;
    count: number;
    pct: number;
    districts_covered: number;
    seccionales_covered: number;
  }[];
  byDist: {
    name: string;
    department_name: string;
    count: number;
    pct: number;
    seccionales_covered: number;
  }[];
  bySecc: {
    seccional: number;
    district_name: string;
    department_name: string;
    count: number;
    pct: number;
  }[];
}

interface StatsResponse {
  territorialTotals: {
    totalActiveDepts: number;
    totalActiveDistricts: number;
    totalActiveSeccionales: number;
    coveredDepartments: number;
    coveredDistricts: number;
    coveredSeccionales: number;
  };
  coordinators: ModuleStats;
  youth: ModuleStats;
  women: ModuleStats;
  votes: {
    total: number;
    coveredDepartments: number;
    coveredDistricts: number;
    coveredSeccionales: number;
    coordinatorsCovered: number;
    byDept: {
      name: string;
      votes: number;
      records: number;
      coordinators_count: number;
      districts_covered: number;
      seccionales_covered: number;
      pct: number;
    }[];
    byDist: {
      name: string;
      department_name: string;
      votes: number;
      records: number;
      coordinators_count: number;
      seccionales_covered: number;
    }[];
    bySecc: {
      seccional: number;
      department_name: string;
      district_name: string;
      votes: number;
      coordinators_count: number;
    }[];
  };
}

export const StatisticsPage: React.FC = () => {
  const { departments, districts, settings } = useApp();
  const [tab, setTab] = useState<'coordinators' | 'youth' | 'women' | 'votes'>('coordinators');
  const [coordView, setCoordView] = useState<'dept' | 'dist' | 'secc'>('dept');
  const [departmentId, setDepartmentId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const filterDistricts = useMemo(
    () => (departmentId ? districts.filter((d) => d.department_id === Number(departmentId)) : districts),
    [districts, departmentId]
  );

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (departmentId) qs.set('department_id', departmentId);
      if (districtId) qs.set('district_id', districtId);
      const res = await apiFetch<StatsResponse>(`/api/statistics?${qs.toString()}`);
      setStats(res);
    } finally {
      setLoading(false);
    }
  }, [departmentId, districtId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const currentModule = tab !== 'votes' && stats ? stats[tab] : null;
  const moduleLabel =
    tab === 'coordinators' ? 'Coordinadores' : tab === 'youth' ? 'Jóvenes' : 'Mujeres';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Módulo de Estadísticas</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Cobertura territorial integral, cantidad de coordinadores discriminada y rankings dinámicos
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(e.target.value);
              setDistrictId('');
            }}
            className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
          >
            <option value="">Todos los departamentos</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            value={districtId}
            onChange={(e) => setDistrictId(e.target.value)}
            className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
          >
            <option value="">Todos los distritos</option>
            {filterDistricts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Global Territorial Coverage Summary */}
      {stats && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <h2 className="text-sm font-semibold text-slate-900">
              Cobertura Territorial General de la Campaña
            </h2>
            <span className="text-xs text-slate-500">
              Alcance consolidado de coordinadores, jóvenes, mujeres y proyecciones
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-medium text-slate-500">Departamentos Cubiertos</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                  {formatNumber(stats.territorialTotals.coveredDepartments)}
                </span>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  de {formatNumber(stats.territorialTotals.totalActiveDepts)} activos
                </span>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-medium text-slate-500">Distritos Cubiertos</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                  {formatNumber(stats.territorialTotals.coveredDistricts)}
                </span>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  de {formatNumber(stats.territorialTotals.totalActiveDistricts)} activos
                </span>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-medium text-slate-500">Seccionales Cubiertas</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                  {formatNumber(stats.territorialTotals.coveredSeccionales)}
                </span>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  de {formatNumber(stats.territorialTotals.totalActiveSeccionales)} activas
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Module Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-xl w-fit">
        {[
          { key: 'coordinators', label: 'Coordinadores' },
          { key: 'youth', label: 'Jóvenes' },
          { key: 'women', label: 'Mujeres' },
          { key: 'votes', label: 'Proyección de Votos' },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key as typeof tab)}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              tab === t.key ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading || !stats ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Calculando estadísticas...
        </div>
      ) : tab !== 'votes' && currentModule ? (
        <div className="space-y-6">
          {/* 4 Module Coverage KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Total {moduleLabel}</div>
              <div className="mt-1 text-3xl font-bold font-mono tabular-nums text-slate-900">
                {formatNumber(currentModule.total)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Departamentos Cubiertos</div>
              <div className="mt-1 text-3xl font-bold font-mono tabular-nums text-slate-900">
                {formatNumber(currentModule.coveredDepartments)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Distritos Cubiertos</div>
              <div className="mt-1 text-3xl font-bold font-mono tabular-nums text-slate-900">
                {formatNumber(currentModule.coveredDistricts)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Seccionales Cubiertas</div>
              <div className="mt-1 text-3xl font-bold font-mono tabular-nums text-slate-900">
                {formatNumber(currentModule.coveredSeccionales)}
              </div>
            </div>
          </div>

          {/* Dedicated Discriminated Breakdown View */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Cantidad de {moduleLabel} Discriminado
                </h2>
                <p className="text-xs text-slate-500">
                  Desglose detallado con cobertura por departamento, distrito y seccional
                </p>
              </div>
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 w-fit">
                {[
                  { key: 'dept', label: 'Por Departamento' },
                  { key: 'dist', label: 'Por Distrito' },
                  { key: 'secc', label: 'Por Seccional' },
                ].map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => setCoordView(v.key as typeof coordView)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      coordView === v.key ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              {coordView === 'dept' && (
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                      <th className="py-2.5 px-3 text-right w-12">N°</th>
                      <th className="py-2.5 px-3">Departamento</th>
                      <th className="py-2.5 px-3 text-right">Cantidad ({moduleLabel})</th>
                      <th className="py-2.5 px-3 text-right">Participación</th>
                      <th className="py-2.5 px-3 text-right">Distritos Cubiertos</th>
                      <th className="py-2.5 px-3 text-right">Seccionales Cubiertas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentModule.byDept.map((d, idx) => (
                      <tr key={d.name} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-500">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">{d.name}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                          {formatNumber(d.count)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">{d.pct}%</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                          {formatNumber(d.districts_covered)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                          {formatNumber(d.seccionales_covered)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {coordView === 'dist' && (
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                      <th className="py-2.5 px-3 text-right w-12">N°</th>
                      <th className="py-2.5 px-3">Distrito</th>
                      <th className="py-2.5 px-3">Departamento</th>
                      <th className="py-2.5 px-3 text-right">Cantidad ({moduleLabel})</th>
                      <th className="py-2.5 px-3 text-right">Participación</th>
                      <th className="py-2.5 px-3 text-right">Seccionales Cubiertas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentModule.byDist.map((d, idx) => (
                      <tr key={`${d.department_name}-${d.name}`} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-500">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">{d.name}</td>
                        <td className="py-2.5 px-3 text-slate-600">{d.department_name}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                          {formatNumber(d.count)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">{d.pct}%</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                          {formatNumber(d.seccionales_covered)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {coordView === 'secc' && (
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                      <th className="py-2.5 px-3 text-right w-12">N°</th>
                      <th className="py-2.5 px-3">Seccional</th>
                      <th className="py-2.5 px-3">Distrito</th>
                      <th className="py-2.5 px-3">Departamento</th>
                      <th className="py-2.5 px-3 text-right">Cantidad ({moduleLabel})</th>
                      <th className="py-2.5 px-3 text-right">Participación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentModule.bySecc.map((s, idx) => (
                      <tr key={`${s.seccional}-${s.district_name}`} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-500">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">Secc. {s.seccional}</td>
                        <td className="py-2.5 px-3 text-slate-700">{s.district_name}</td>
                        <td className="py-2.5 px-3 text-slate-600">{s.department_name}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                          {formatNumber(s.count)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">{s.pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-base font-semibold text-slate-900 mb-4">Distribución por Departamento</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={currentModule.byDept}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" name="Cantidad" fill={settings.primary_color} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-base font-semibold text-slate-900 mb-4">Distribución por Distrito</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={currentModule.byDist.slice(0, 12)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" name="Cantidad" fill={settings.secondary_color} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Total Votos Estimados</div>
              <div className="mt-1 text-3xl font-bold font-mono tabular-nums text-slate-900">
                {formatNumber(stats.votes.total)}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {formatNumber(stats.votes.coordinatorsCovered)} coordinadores asignados
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Departamentos Cubiertos</div>
              <div className="mt-1 text-3xl font-bold font-mono tabular-nums text-slate-900">
                {formatNumber(stats.votes.coveredDepartments)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Distritos Cubiertos</div>
              <div className="mt-1 text-3xl font-bold font-mono tabular-nums text-slate-900">
                {formatNumber(stats.votes.coveredDistricts)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Seccionales Cubiertas</div>
              <div className="mt-1 text-3xl font-bold font-mono tabular-nums text-slate-900">
                {formatNumber(stats.votes.coveredSeccionales)}
              </div>
            </div>
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Comparativa de Votos Estimados por Departamento</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.votes.byDept}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(val: unknown) => [formatNumber(Number(val)), 'Votos estimados']} />
                  <Bar dataKey="votes" fill={settings.secondary_color} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Ranking Territorial por Cantidad Estimada</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th className="py-2">N°</th>
                    <th className="py-2">Departamento / Distrito</th>
                    <th className="py-2 text-right">Seccional</th>
                    <th className="py-2 text-right">Coordinadores</th>
                    <th className="py-2 text-right">Votos Estimados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.votes.bySecc.map((r, i) => (
                    <tr key={`${r.seccional}-${r.district_name}`}>
                      <td className="py-2.5 font-mono text-slate-500">{i + 1}</td>
                      <td className="py-2.5 font-medium text-slate-900">
                        {r.department_name} · {r.district_name}
                      </td>
                      <td className="py-2.5 text-right font-mono">Secc. {r.seccional}</td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-slate-700">
                        {formatNumber(r.coordinators_count)}
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums font-bold text-slate-900">
                        {formatNumber(r.votes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
