import {
  Bell,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Edit3,
  Eye,
  FileText,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ConfirmModal } from '../components/ConfirmModal';
import { useApp } from '../context/AppContext';
import { apiFetch, formatDisplayDate } from '../lib/api';
import { exportAgendaPDF, exportSingleEventPDF } from '../lib/export';
import { AgendaEvent } from '../types';

const EVENT_TYPES = [
  'Reuniones políticas',
  'Audiencias',
  'Actividades parlamentarias',
  'Reuniones con coordinadores',
  'Actividades territoriales',
  'Eventos especiales',
  'Reuniones institucionales',
  'Otros eventos personalizables',
];

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export const AgendaPage: React.FC = () => {
  const { departments, districts, settings, hasPermission, notify } = useApp();

  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [cursorDate, setCursorDate] = useState(() => new Date('2026-11-16T12:00:00'));

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AgendaEvent | null>(null);
  const [previewMode, setPreviewMode] = useState<{ title: string; rangeLabel: string; events: AgendaEvent[] } | null>(null);
  const [followUpEvent, setFollowUpEvent] = useState<AgendaEvent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AgendaEvent | null>(null);

  // Event form
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState(EVENT_TYPES[0]);
  const [eventDate, setEventDate] = useState('2026-11-17');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('11:00');
  const [departmentId, setDepartmentId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [seccionalNumber, setSeccionalNumber] = useState('');
  const [location, setLocation] = useState('');
  const [responsible, setResponsible] = useState('');
  const [participants, setParticipants] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [reminderMinutes, setReminderMinutes] = useState('60');
  const [status, setStatus] = useState<'programado' | 'realizado' | 'cancelado'>('programado');

  // Follow-up form
  const [actSummary, setActSummary] = useState('');
  const [actAttendance, setActAttendance] = useState('0');
  const [actOutcomes, setActOutcomes] = useState('');
  const [actStatus, setActStatus] = useState<'programado' | 'realizado' | 'cancelado'>('realizado');

  const formDistricts = useMemo(
    () => (departmentId ? districts.filter((d) => d.department_id === Number(departmentId)) : []),
    [districts, departmentId]
  );

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set('search', search.trim());
      if (filterType) qs.set('event_type', filterType);
      const res = await apiFetch<AgendaEvent[]>(`/api/agenda?${qs.toString()}`);
      setEvents(res);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Error al cargar agenda.', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, filterType, notify]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const upcomingReminders = useMemo(
    () => events.filter((e) => e.status === 'programado' && e.reminder_minutes > 0).slice(0, 3),
    [events]
  );

  const isoDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const monthDays = useMemo(() => {
    const y = cursorDate.getFullYear();
    const m = cursorDate.getMonth();
    const firstDay = new Date(y, m, 1);
    const startWeekday = (firstDay.getDay() + 6) % 7; // Monday = 0
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells: { dateStr: string; dayNum: number; inMonth: boolean }[] = [];
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = new Date(y, m, -i);
      cells.push({ dateStr: isoDate(d), dayNum: d.getDate(), inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(y, m, d);
      cells.push({ dateStr: isoDate(dt), dayNum: d, inMonth: true });
    }
    while (cells.length % 7 !== 0) {
      const dt = new Date(y, m + 1, cells.length - (startWeekday + daysInMonth) + 1);
      cells.push({ dateStr: isoDate(dt), dayNum: dt.getDate(), inMonth: false });
    }
    return cells;
  }, [cursorDate]);

  const weekDays = useMemo(() => {
    const d = new Date(cursorDate);
    const weekday = (d.getDay() + 6) % 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - weekday);
    return Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(monday);
      dt.setDate(monday.getDate() + i);
      return { dateStr: isoDate(dt), label: dt.toLocaleDateString('es-PY', { weekday: 'short', day: 'numeric', month: 'short' }) };
    });
  }, [cursorDate]);

  const currentDayStr = isoDate(cursorDate);

  const shiftPeriod = (dir: -1 | 1) => {
    const next = new Date(cursorDate);
    if (viewMode === 'month') next.setMonth(next.getMonth() + dir);
    else if (viewMode === 'week') next.setDate(next.getDate() + dir * 7);
    else next.setDate(next.getDate() + dir);
    setCursorDate(next);
  };

  const openCreate = (preDate?: string) => {
    setEditing(null);
    setTitle('');
    setEventType(EVENT_TYPES[0]);
    setEventDate(preDate || currentDayStr);
    setStartTime('09:00');
    setEndTime('11:00');
    setDepartmentId('');
    setDistrictId('');
    setSeccionalNumber('');
    setLocation('');
    setResponsible('');
    setParticipants('');
    setDescription('');
    setNotes('');
    setReminderMinutes('60');
    setStatus('programado');
    setModalOpen(true);
  };

  const openEdit = (ev: AgendaEvent) => {
    setEditing(ev);
    setTitle(ev.title);
    setEventType(ev.event_type);
    setEventDate(ev.event_date);
    setStartTime(ev.start_time);
    setEndTime(ev.end_time);
    setDepartmentId(ev.department_id ? String(ev.department_id) : '');
    setDistrictId(ev.district_id ? String(ev.district_id) : '');
    setSeccionalNumber(ev.seccional_number ? String(ev.seccional_number) : '');
    setLocation(ev.location || '');
    setResponsible(ev.responsible || '');
    setParticipants(ev.participants || '');
    setDescription(ev.description || '');
    setNotes(ev.notes || '');
    setReminderMinutes(String(ev.reminder_minutes ?? 60));
    setStatus(ev.status);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        title,
        event_type: eventType,
        event_date: eventDate,
        start_time: startTime,
        end_time: endTime,
        department_id: departmentId ? Number(departmentId) : null,
        district_id: districtId ? Number(districtId) : null,
        seccional_number: seccionalNumber ? Number(seccionalNumber) : null,
        location,
        responsible,
        participants,
        description,
        notes,
        reminder_minutes: Number(reminderMinutes || 60),
        status,
      };
      if (editing) {
        await apiFetch(`/api/agenda/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        notify('Actividad actualizada.');
      } else {
        await apiFetch('/api/agenda', { method: 'POST', body: JSON.stringify(payload) });
        notify('Actividad programada en la agenda.');
      }
      setModalOpen(false);
      await loadEvents();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Error al guardar actividad.', 'error');
    }
  };

  const handleSaveFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpEvent) return;
    try {
      await apiFetch(`/api/agenda/${followUpEvent.id}/activity`, {
        method: 'POST',
        body: JSON.stringify({
          summary: actSummary,
          attendance_count: Number(actAttendance || 0),
          outcomes: actOutcomes,
          status: actStatus,
        }),
      });
      notify('Seguimiento de actividad guardado.');
      setFollowUpEvent(null);
      await loadEvents();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Error al registrar seguimiento.', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/agenda/${deleteTarget.id}`, { method: 'DELETE' });
      notify('Evento eliminado de la agenda.');
      setDeleteTarget(null);
      await loadEvents();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Error al eliminar.', 'error');
    }
  };

  const openAgendaDocPreview = (scope: 'daily' | 'weekly' | 'monthly' | 'meetings') => {
    if (scope === 'daily') {
      const list = events.filter((e) => e.event_date === currentDayStr);
      setPreviewMode({
        title: 'Agenda Diaria de Actividades',
        rangeLabel: `Fecha: ${formatDisplayDate(currentDayStr, settings.date_format)}`,
        events: list,
      });
    } else if (scope === 'weekly') {
      const start = weekDays[0].dateStr;
      const end = weekDays[6].dateStr;
      const list = events.filter((e) => e.event_date >= start && e.event_date <= end);
      setPreviewMode({
        title: 'Agenda Semanal de Actividades',
        rangeLabel: `Del ${formatDisplayDate(start, settings.date_format)} al ${formatDisplayDate(end, settings.date_format)}`,
        events: list,
      });
    } else if (scope === 'monthly') {
      const ym = `${cursorDate.getFullYear()}-${String(cursorDate.getMonth() + 1).padStart(2, '0')}`;
      const list = events.filter((e) => e.event_date.startsWith(ym));
      setPreviewMode({
        title: `Agenda Mensual · ${MONTHS_ES[cursorDate.getMonth()]} ${cursorDate.getFullYear()}`,
        rangeLabel: `Mes completo de ${MONTHS_ES[cursorDate.getMonth()]}`,
        events: list,
      });
    } else {
      const list = events.filter((e) =>
        ['Reuniones políticas', 'Audiencias', 'Reuniones con coordinadores', 'Reuniones institucionales'].includes(e.event_type)
      );
      setPreviewMode({
        title: 'Listado de Reuniones y Audiencias',
        rangeLabel: 'Compromisos de reuniones y audiencias registradas',
        events: list,
      });
    }
  };

  const canCreate = hasPermission('agenda:create');
  const canEdit = hasPermission('agenda:edit');
  const canDelete = hasPermission('agenda:delete');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Agenda y Calendario</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Organización de reuniones, audiencias, agenda parlamentaria y actividades territoriales
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openAgendaDocPreview('daily')}
            className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Agenda Diaria PDF
          </button>
          <button
            type="button"
            onClick={() => openAgendaDocPreview('weekly')}
            className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Semanal PDF
          </button>
          <button
            type="button"
            onClick={() => openAgendaDocPreview('monthly')}
            className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Mensual PDF
          </button>
          <button
            type="button"
            onClick={() => openAgendaDocPreview('meetings')}
            className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Reuniones y Audiencias
          </button>
          {canCreate && (
            <button
              type="button"
              onClick={() => openCreate()}
              style={{ backgroundColor: settings.primary_color }}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white hover:opacity-95"
            >
              <Plus className="h-4 w-4" />
              <span>Nueva Actividad</span>
            </button>
          )}
        </div>
      </div>

      {/* Reminders Banner */}
      {upcomingReminders.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-slate-700">
            <Bell className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              <strong>Próximos recordatorios activos:</strong>{' '}
              {upcomingReminders
                .map(
                  (r) =>
                    `${r.title} (${formatDisplayDate(r.event_date, settings.date_format)} ${r.start_time}, aviso ${r.reminder_minutes} min antes)`
                )
                .join(' · ')}
            </span>
          </div>
        </div>
      )}

      {/* Controls: View Switcher + Search + Type Filter */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['month', 'week', 'day'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setViewMode(m)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === m ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m === 'month' ? 'Mensual' : m === 'week' ? 'Semanal' : 'Diaria'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => shiftPeriod(-1)}
              className="h-9 w-9 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="px-3 text-sm font-semibold text-slate-900 min-w-[160px] text-center">
              {viewMode === 'month'
                ? `${MONTHS_ES[cursorDate.getMonth()]} ${cursorDate.getFullYear()}`
                : viewMode === 'week'
                ? `Semana ${formatDisplayDate(weekDays[0].dateStr, settings.date_format)}`
                : formatDisplayDate(currentDayStr, settings.date_format)}
            </div>
            <button
              type="button"
              onClick={() => shiftPeriod(1)}
              className="h-9 w-9 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar actividad, lugar o responsable..."
              className="w-full sm:w-64 min-h-[40px] rounded-lg border border-slate-300 pl-9 pr-3 py-1.5 text-sm"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="min-h-[40px] rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white"
          >
            <option value="">Todos los tipos</option>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Calendar View */}
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Cargando calendario...
        </div>
      ) : viewMode === 'month' ? (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold text-slate-600 py-2.5">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
            {monthDays.map((cell) => {
              const dayEvents = events.filter((e) => e.event_date === cell.dateStr);
              const isSelected = cell.dateStr === currentDayStr;
              return (
                <div
                  key={cell.dateStr}
                  onClick={() => setCursorDate(new Date(`${cell.dateStr}T12:00:00`))}
                  className={`min-h-[96px] sm:min-h-[116px] p-1.5 sm:p-2 cursor-pointer transition-colors ${
                    cell.inMonth ? 'bg-white' : 'bg-slate-50/70 text-slate-400'
                  } ${isSelected ? 'ring-1 ring-inset ring-slate-900' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono tabular-nums font-semibold">{cell.dayNum}</span>
                    {canCreate && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openCreate(cell.dateStr);
                        }}
                        className="h-5 w-5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center text-xs"
                        title="Agregar aquí"
                      >
                        +
                      </button>
                    )}
                  </div>
                  <div className="mt-1 space-y-1">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(ev);
                        }}
                        style={{ backgroundColor: settings.primary_color }}
                        className="w-full text-left rounded px-1.5 py-0.5 text-[10px] sm:text-[11px] font-medium text-white truncate block"
                      >
                        {ev.start_time} {ev.title}
                      </button>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] font-semibold text-slate-500 px-1">
                        +{dayEvents.length - 3} más
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : viewMode === 'week' ? (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {weekDays.map((wd) => {
            const list = events.filter((e) => e.event_date === wd.dateStr);
            return (
              <div key={wd.dateStr} className="rounded-xl border border-slate-200 bg-white p-3 flex flex-col">
                <div className="text-xs font-semibold text-slate-900 pb-2 border-b border-slate-100 flex items-center justify-between">
                  <span className="capitalize">{wd.label}</span>
                  {canCreate && (
                    <button
                      type="button"
                      onClick={() => openCreate(wd.dateStr)}
                      className="text-xs text-slate-500 hover:text-slate-900"
                    >
                      +
                    </button>
                  )}
                </div>
                <div className="mt-2 space-y-2 flex-1">
                  {list.length === 0 ? (
                    <p className="text-[11px] text-slate-400 py-2">Sin actividades</p>
                  ) : (
                    list.map((ev) => (
                      <div key={ev.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
                        <div className="font-mono text-[11px] text-slate-600">
                          {ev.start_time} - {ev.end_time}
                        </div>
                        <div className="font-semibold text-slate-900 mt-0.5">{ev.title}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{ev.event_type}</div>
                        <div className="mt-2 flex items-center gap-2">
                          <button type="button" onClick={() => openEdit(ev)} className="text-[11px] font-semibold text-slate-700 hover:underline">
                            Editar
                          </button>
                          <button type="button" onClick={() => exportSingleEventPDF(settings, ev)} className="text-[11px] text-slate-600 hover:underline">
                            PDF
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">
              Agenda del Día · {formatDisplayDate(currentDayStr, settings.date_format)}
            </h2>
            {canCreate && (
              <button
                type="button"
                onClick={() => openCreate(currentDayStr)}
                className="text-xs font-semibold text-slate-700 hover:underline"
              >
                + Agregar actividad en este día
              </button>
            )}
          </div>
          {events.filter((e) => e.event_date === currentDayStr).length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No hay actividades programadas para este día.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {events
                .filter((e) => e.event_date === currentDayStr)
                .map((ev) => (
                  <div key={ev.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-mono tabular-nums text-slate-500">
                        {ev.start_time} - {ev.end_time} · {ev.event_type}
                      </div>
                      <div className="text-base font-semibold text-slate-900 mt-0.5">{ev.title}</div>
                      <div className="text-xs text-slate-600 mt-1">
                        {ev.location || 'Lugar por confirmar'} · Responsable: {ev.responsible || '—'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => exportSingleEventPDF(settings, ev)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Informe PDF
                      </button>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => openEdit(ev)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Editar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Full Commitments List */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Listado Completo de Compromisos y Actividades</h2>
          <span className="text-xs font-mono tabular-nums text-slate-500">{events.length} actividades</span>
        </div>
        <div className="divide-y divide-slate-100">
          {events.map((ev) => (
            <div key={ev.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/70">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono tabular-nums font-semibold text-slate-900">
                    {formatDisplayDate(ev.event_date, settings.date_format)} ({ev.start_time} - {ev.end_time})
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{ev.event_type}</span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={`font-semibold ${
                      ev.status === 'realizado'
                        ? 'text-emerald-700'
                        : ev.status === 'cancelado'
                        ? 'text-red-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {ev.status.toUpperCase()}
                  </span>
                </div>
                <div className="text-sm font-semibold text-slate-900 mt-1">{ev.title}</div>
                <div className="text-xs text-slate-600 mt-0.5">
                  {[ev.department_name, ev.district_name, ev.seccional_number ? `Secc. ${ev.seccional_number}` : '', ev.location]
                    .filter(Boolean)
                    .join(' · ')}{' '}
                  {ev.responsible ? `· Resp.: ${ev.responsible}` : ''}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => exportSingleEventPDF(settings, ev)}
                  className="min-h-[36px] inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  title="Informe individual PDF"
                >
                  <FileText className="h-3.5 w-3.5 text-red-700" />
                  <span>Informe PDF</span>
                </button>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setFollowUpEvent(ev);
                      setActSummary(ev.activity_summary || '');
                      setActAttendance(String(ev.attendance_count ?? 0));
                      setActOutcomes(ev.activity_outcomes || '');
                      setActStatus(ev.status);
                    }}
                    className="min-h-[36px] inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <ClipboardCheck className="h-3.5 w-3.5 text-emerald-700" />
                    <span>Acta</span>
                  </button>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => openEdit(ev)}
                    className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                    title="Editar"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(ev)}
                    className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Create / Edit Event Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl my-8">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-base font-semibold text-slate-900">
                {editing ? 'Editar Actividad en Agenda' : 'Programar Nueva Actividad'}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Título de la actividad *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de actividad *</label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    {EVENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha *</label>
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Hora de inicio *</label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Hora de finalización *</label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Departamento</label>
                  <select
                    value={departmentId}
                    onChange={(e) => {
                      setDepartmentId(e.target.value);
                      setDistrictId('');
                    }}
                    className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="">General / Sin departamento</option>
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Seccional N°</label>
                  <input
                    type="number"
                    value={seccionalNumber}
                    onChange={(e) => setSeccionalNumber(e.target.value)}
                    className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Lugar</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Responsable</label>
                  <input
                    type="text"
                    value={responsible}
                    onChange={(e) => setResponsible(e.target.value)}
                    className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Recordatorio (minutos antes)</label>
                  <select
                    value={reminderMinutes}
                    onChange={(e) => setReminderMinutes(e.target.value)}
                    className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="0">Sin recordatorio</option>
                    <option value="15">15 minutos antes</option>
                    <option value="30">30 minutos antes</option>
                    <option value="60">1 hora antes</option>
                    <option value="180">3 horas antes</option>
                    <option value="1440">24 horas antes</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Participantes</label>
                  <input
                    type="text"
                    value={participants}
                    onChange={(e) => setParticipants(e.target.value)}
                    className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Descripción</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Observaciones</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
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
                  style={{ backgroundColor: settings.primary_color }}
                  className="min-h-[42px] rounded-lg px-5 py-2 text-sm font-semibold text-white"
                >
                  {editing ? 'Guardar Cambios' : 'Crear Actividad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Activity Follow-Up Modal */}
      {followUpEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-base font-semibold text-slate-900">Seguimiento y Acta de Actividad</h3>
              <button
                type="button"
                onClick={() => setFollowUpEvent(null)}
                className="h-9 w-9 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveFollowUp} className="p-6 space-y-4">
              <div className="text-sm font-semibold text-slate-900">{followUpEvent.title}</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Estado</label>
                  <select
                    value={actStatus}
                    onChange={(e) => setActStatus(e.target.value as 'programado' | 'realizado' | 'cancelado')}
                    className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="programado">Programado</option>
                    <option value="realizado">Realizado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Asistencia Total</label>
                  <input
                    type="number"
                    min={0}
                    value={actAttendance}
                    onChange={(e) => setActAttendance(e.target.value)}
                    className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Resumen de Ejecución</label>
                <textarea
                  rows={2}
                  value={actSummary}
                  onChange={(e) => setActSummary(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Acuerdos y Conclusiones</label>
                <textarea
                  rows={2}
                  value={actOutcomes}
                  onChange={(e) => setActOutcomes(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFollowUpEvent(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: settings.primary_color }}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
                >
                  Guardar Acta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {previewMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white shadow-xl my-8 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-slate-600" />
                <h3 className="text-base font-semibold text-slate-900">Vista Preliminar de Documento</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewMode(null)}
                className="h-9 w-9 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4">
              {/* Simulated Institutional Header */}
              <div
                style={{ backgroundColor: settings.primary_color }}
                className="rounded-lg p-4 text-white flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={settings.logo_url}
                    alt={settings.organization_name}
                    referrerPolicy="no-referrer"
                    className="h-12 w-12 rounded-md object-cover bg-white p-0.5"
                  />
                  <div>
                    <div className="text-sm font-bold">{settings.organization_name}</div>
                    <div className="text-xs opacity-90">{settings.header_text}</div>
                  </div>
                </div>
                <div className="text-right text-xs opacity-90">
                  <div>Formato: {settings.document_format}</div>
                  <div>{formatDisplayDate(new Date().toISOString().slice(0, 10), settings.date_format)}</div>
                </div>
              </div>

              <div>
                <h4 className="text-lg font-bold text-slate-900">{previewMode.title}</h4>
                <p className="text-xs text-slate-500">{previewMode.rangeLabel}</p>
              </div>

              {previewMode.events.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">No hay actividades en el rango seleccionado.</p>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-100 text-slate-700 font-semibold">
                      <th className="py-2 px-3">Fecha</th>
                      <th className="py-2 px-3">Horario</th>
                      <th className="py-2 px-3">Tipo</th>
                      <th className="py-2 px-3">Actividad</th>
                      <th className="py-2 px-3">Lugar</th>
                      <th className="py-2 px-3">Responsable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {previewMode.events.map((ev) => (
                      <tr key={ev.id}>
                        <td className="py-2 px-3 font-mono">{formatDisplayDate(ev.event_date, settings.date_format)}</td>
                        <td className="py-2 px-3 font-mono">{ev.start_time} - {ev.end_time}</td>
                        <td className="py-2 px-3">{ev.event_type}</td>
                        <td className="py-2 px-3 font-medium text-slate-900">{ev.title}</td>
                        <td className="py-2 px-3">{ev.location || ev.department_name || '—'}</td>
                        <td className="py-2 px-3">{ev.responsible || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-[11px] text-slate-500">
                <span>{settings.footer_text}</span>
                <span>Página 1 de 1</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 bg-slate-50">
              <button
                type="button"
                onClick={() => setPreviewMode(null)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={async () => {
                  await exportAgendaPDF({
                    filename: `agenda-${Date.now()}`,
                    title: previewMode.title,
                    rangeLabel: previewMode.rangeLabel,
                    settings,
                    events: previewMode.events,
                  });
                  notify('Agenda exportada en PDF.');
                }}
                style={{ backgroundColor: settings.primary_color }}
                className="inline-flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-semibold text-white"
              >
                <FileText className="h-4 w-4" />
                <span>Descargar PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Eliminar Actividad"
        message={`¿Confirma eliminar la actividad "${deleteTarget?.title}" de la agenda?`}
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
