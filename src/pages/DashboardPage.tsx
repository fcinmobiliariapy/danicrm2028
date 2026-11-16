import { CalendarDays, FileSpreadsheet, Plus, UserCheck, Vote } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { apiFetch, formatDisplayDate, formatNumber } from '../lib/api';
import { PageKey } from '../types';

interface DashboardData {
  kpis: {
    totalCoordinators: number;
    totalYouth: number;
    totalWomen: number;
    totalOnp: number;
    totalDepartments: number;
    totalDistricts: number;
    totalSeccionales: number;
    totalEstimatedVotes: number;
    scheduledMeetings: number;
  };
  upcomingEvents: {
    id: number;
    title: string;
    event_type: string;
    event_date: string;
    start_time: string;
    department_name?: string;
    district_name?: string;
    location: string;
  }[];
  recentRecords: {
    tipo: string;
    id: number;
    first_name: string;
    last_name: string;
    ci: string;
    seccional_number: number;
    department_name: string;
    district_name: string;
    registered_at: string;
  }[];
  charts: {
    byDepartment: {
      name: string;
      coordinadores: number;
      jovenes: number;
      mujeres: number;
      votos_estimados: number;
    }[];
    byDistrict: {
      name: string;
      department_name: string;
      total_estructura: number;
      votos_estimados: number;
    }[];
    bySeccional: {
      seccional_number: number;
      district_name: string;
      votos_estimados: number;
      coordinadores: number;
    }[];
  };
}

export const DashboardPage: React.FC<{ onNavigate: (p: PageKey) => void }> = ({ onNavigate }) => {
  const { settings, hasPermission } = useApp();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiFetch<DashboardData>('/api/dashboard');
        if (active) setData(res);
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : 'Error al cargar indicadores.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-white border border-slate-200" />
          ))}
        </div>
        <div className="h-80 rounded-xl bg-white border border-slate-200" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        {error || 'No se pudieron cargar los datos del panel principal.'}
      </div>
    );
  }

  const kpis = [
    { label: 'Coordinadores Registrados', value: formatNumber(data.kpis.totalCoordinators), page: 'coordinators' as PageKey },
    { label: 'Jóvenes Registrados', value: formatNumber(data.kpis.totalYouth), page: 'youth' as PageKey },
    { label: 'Mujeres Registradas', value: formatNumber(data.kpis.totalWomen), page: 'women' as PageKey },
    { label: 'Referentes ONP', value: formatNumber(data.kpis.totalOnp || 0), page: 'onp' as PageKey },
    { label: 'Votos Estimados (Proyección)', value: formatNumber(data.kpis.totalEstimatedVotes), page: 'projections' as PageKey, note: 'Estimación' },
    { label: 'Departamentos Activos', value: formatNumber(data.kpis.totalDepartments), page: 'territorial' as PageKey },
    { label: 'Distritos Habilitados', value: formatNumber(data.kpis.totalDistricts), page: 'territorial' as PageKey },
    { label: 'Seccionales Configuradas', value: formatNumber(data.kpis.totalSeccionales), page: 'territorial' as PageKey },
    { label: 'Reuniones Programadas', value: formatNumber(data.kpis.scheduledMeetings), page: 'agenda' as PageKey },
  ];

  const deptChartData = data.charts.byDepartment.filter(
    (d) => d.coordinadores + d.jovenes + d.mujeres + d.votos_estimados > 0
  );

  return (
    <div className="space-y-6">
      {/* Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Panel Principal de Campaña
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            {settings.organization_name} · Indicadores en tiempo real
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasPermission('coordinators:create') && (
            <button
              type="button"
              onClick={() => onNavigate('coordinators')}
              style={{ backgroundColor: settings.primary_color }}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white hover:opacity-95 whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>Nuevo Coordinador</span>
            </button>
          )}
          {hasPermission('projections:create') && (
            <button
              type="button"
              onClick={() => onNavigate('projections')}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Vote className="h-4 w-4" />
              <span>Cargar Proyección</span>
            </button>
          )}
          {hasPermission('agenda:create') && (
            <button
              type="button"
              onClick={() => onNavigate('agenda')}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <CalendarDays className="h-4 w-4" />
              <span>Agendar Actividad</span>
            </button>
          )}
          {hasPermission('reports:view') && (
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Reportes</span>
            </button>
          )}
        </div>
      </div>

      {/* 9 KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        {kpis.map((k) => (
          <button
            key={k.label}
            type="button"
            onClick={() => onNavigate(k.page)}
            className="text-left rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300 transition-colors"
          >
            <div className="text-xs font-medium text-slate-500 truncate">{k.label}</div>
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">{k.value}</span>
              {k.note && <span className="text-[11px] font-medium text-amber-700">{k.note}</span>}
            </div>
          </button>
        ))}
      </div>

      {/* Charts Grid 1: Structure by Dept & Vote Projections by Dept */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Estructura por Departamento</h2>
              <p className="text-xs text-slate-500">Coordinadores, jóvenes y mujeres registrados</p>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptChartData} margin={{ top: 8, right: 12, left: -12, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} interval={0} angle={-18} textAnchor="end" height={48} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="coordinadores" name="Coordinadores" fill={settings.primary_color || '#1E3A8A'} radius={[4, 4, 0, 0]} />
                <Bar dataKey="jovenes" name="Jóvenes" fill="#0284C7" radius={[4, 4, 0, 0]} />
                <Bar dataKey="mujeres" name="Mujeres" fill={settings.secondary_color || '#B91C1C'} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Proyección de Votos por Departamento</h2>
              <p className="text-xs text-slate-500">Estimaciones proyectadas (no votos confirmados)</p>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptChartData} margin={{ top: 8, right: 12, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} interval={0} angle={-18} textAnchor="end" height={48} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip formatter={(val: unknown) => [formatNumber(Number(val)), 'Votos estimados']} />
                <Bar dataKey="votos_estimados" name="Votos estimados" fill="#D97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Charts Grid 2: District Distribution & Seccional Projections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">Distribución Territorial por Distrito</h2>
          <p className="text-xs text-slate-500 mb-4">Estructura registrada y votos estimados por distrito</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.byDistrict} margin={{ top: 8, right: 12, left: -12, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} interval={0} angle={-22} textAnchor="end" height={54} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="votos_estimados" name="Votos estimados" fill={settings.primary_color || '#1E3A8A'} radius={[4, 4, 0, 0]} />
                <Bar dataKey="total_estructura" name="Integrantes" fill="#16A34A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">Proyección de Votos por Seccional</h2>
          <p className="text-xs text-slate-500 mb-4">Principales seccionales ordenadas por estimación</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.charts.bySeccional.map((s) => ({
                  ...s,
                  label: `Secc. ${s.seccional_number}`,
                }))}
                margin={{ top: 8, right: 12, left: 0, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip formatter={(val: unknown) => [formatNumber(Number(val)), 'Votos estimados']} />
                <Bar dataKey="votos_estimados" name="Votos estimados" fill={settings.secondary_color || '#B91C1C'} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Bottom Split: Upcoming Activities & Recent Registrations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900">Próximas Actividades</h2>
            <button
              type="button"
              onClick={() => onNavigate('agenda')}
              className="text-xs font-semibold text-slate-700 hover:underline"
            >
              Ver agenda completa
            </button>
          </div>
          {data.upcomingEvents.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No hay actividades programadas.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.upcomingEvents.map((ev) => (
                <div key={ev.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{ev.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span>{ev.event_type}</span>
                      <span aria-hidden="true">·</span>
                      <span>{ev.department_name || 'General'}</span>
                      {ev.location && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{ev.location}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-mono tabular-nums font-semibold text-slate-900">
                      {formatDisplayDate(ev.event_date, settings.date_format)}
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-slate-500">{ev.start_time}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900">Últimos Registros Ingresados</h2>
            <UserCheck className="h-4 w-4 text-slate-400" />
          </div>
          <div className="divide-y divide-slate-100">
            {data.recentRecords.map((r) => (
              <div key={`${r.tipo}-${r.id}`} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">
                    {r.first_name} {r.last_name}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-1.5">
                    <span className="font-semibold text-slate-700">{r.tipo}</span>
                    <span aria-hidden="true">·</span>
                    <span>{r.department_name} / {r.district_name}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">Secc. {r.seccional_number}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-mono tabular-nums text-slate-700">C.I. {r.ci}</div>
                  <div className="text-[11px] font-mono tabular-nums text-slate-400">
                    {formatDisplayDate(r.registered_at, settings.date_format)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
