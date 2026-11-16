import { Edit3, Plus, Power, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { ConfirmModal } from '../components/ConfirmModal';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../lib/api';

export const TerritorialPage: React.FC = () => {
  const { departments, districts, seccionales, settings, hasPermission, refreshTerritorial, notify } = useApp();
  const canManage = hasPermission('territorial:manage');

  const [tab, setTab] = useState<'departments' | 'districts' | 'seccionales'>('departments');

  // Dept form
  const [deptCode, setDeptCode] = useState('');
  const [deptName, setDeptName] = useState('');
  const [editDeptId, setEditDeptId] = useState<number | null>(null);

  // District form
  const [distDeptId, setDistDeptId] = useState('');
  const [distName, setDistName] = useState('');
  const [editDistId, setEditDistId] = useState<number | null>(null);
  const [distFilterDept, setDistFilterDept] = useState('');

  // Seccional form
  const [seccDeptId, setSeccDeptId] = useState('');
  const [seccDistId, setSeccDistId] = useState('');
  const [seccNum, setSeccNum] = useState('');
  const [seccName, setSeccName] = useState('');
  const [editSeccId, setEditSeccId] = useState<number | null>(null);
  const [seccFilterDept, setSeccFilterDept] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<{ type: 'departments' | 'districts' | 'seccionales'; id: number; label: string } | null>(null);

  const seccFormDistricts = useMemo(
    () => (seccDeptId ? districts.filter((d) => d.department_id === Number(seccDeptId)) : []),
    [districts, seccDeptId]
  );

  const deptMap = useMemo(() => Object.fromEntries(departments.map((d) => [d.id, d.name])), [departments]);
  const distMap = useMemo(() => Object.fromEntries(districts.map((d) => [d.id, d.name])), [districts]);

  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editDeptId) {
        await apiFetch(`/api/territorial/departments/${editDeptId}`, {
          method: 'PUT',
          body: JSON.stringify({ code: deptCode, name: deptName }),
        });
        notify('Departamento actualizado.');
      } else {
        await apiFetch('/api/territorial/departments', {
          method: 'POST',
          body: JSON.stringify({ code: deptCode || '18', name: deptName, active: true }),
        });
        notify('Departamento agregado.');
      }
      setDeptCode('');
      setDeptName('');
      setEditDeptId(null);
      await refreshTerritorial();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Error al guardar departamento.', 'error');
    }
  };

  const handleSaveDistrict = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editDistId) {
        await apiFetch(`/api/territorial/districts/${editDistId}`, {
          method: 'PUT',
          body: JSON.stringify({ department_id: Number(distDeptId), name: distName }),
        });
        notify('Distrito actualizado.');
      } else {
        await apiFetch('/api/territorial/districts', {
          method: 'POST',
          body: JSON.stringify({ department_id: Number(distDeptId), name: distName, active: true }),
        });
        notify('Distrito agregado.');
      }
      setDistName('');
      setEditDistId(null);
      await refreshTerritorial();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Error al guardar distrito.', 'error');
    }
  };

  const handleSaveSeccional = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        department_id: Number(seccDeptId),
        district_id: Number(seccDistId),
        number: Number(seccNum),
        name: seccName,
        active: true,
      };
      if (editSeccId) {
        await apiFetch(`/api/territorial/seccionales/${editSeccId}`, { method: 'PUT', body: JSON.stringify(payload) });
        notify('Seccional actualizada.');
      } else {
        await apiFetch('/api/territorial/seccionales', { method: 'POST', body: JSON.stringify(payload) });
        notify('Seccional agregada.');
      }
      setSeccNum('');
      setSeccName('');
      setEditSeccId(null);
      await refreshTerritorial();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Error al guardar seccional.', 'error');
    }
  };

  const toggleActive = async (type: 'departments' | 'districts' | 'seccionales', id: number, currentActive: number) => {
    try {
      await apiFetch(`/api/territorial/${type}/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ active: currentActive === 1 ? 0 : 1 }),
      });
      await refreshTerritorial();
      notify('Estado actualizado.');
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Error al actualizar estado.', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/territorial/${deleteTarget.type}/${deleteTarget.id}`, { method: 'DELETE' });
      notify('Elemento eliminado.');
      setDeleteTarget(null);
      await refreshTerritorial();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'No se pudo eliminar.', 'error');
      setDeleteTarget(null);
    }
  };

  const visibleDistricts = distFilterDept
    ? districts.filter((d) => d.department_id === Number(distFilterDept))
    : districts;

  const visibleSeccionales = seccFilterDept
    ? seccionales.filter((s) => s.department_id === Number(seccFilterDept))
    : seccionales;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Configuración Territorial</h1>
        <p className="text-sm text-slate-600 mt-0.5">
          Administración de los 18 departamentos de Paraguay, distritos y seccionales vinculadas
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-xl w-fit">
        {[
          { key: 'departments', label: `Departamentos (${departments.length})` },
          { key: 'districts', label: `Distritos (${districts.length})` },
          { key: 'seccionales', label: `Seccionales (${seccionales.length})` },
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

      {/* Departamentos */}
      {tab === 'departments' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {canManage && (
            <form onSubmit={handleSaveDept} className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-5 space-y-4 h-fit">
              <h2 className="text-sm font-semibold text-slate-900">
                {editDeptId ? 'Editar Departamento' : 'Agregar Departamento'}
              </h2>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Código</label>
                <input
                  type="text"
                  value={deptCode}
                  onChange={(e) => setDeptCode(e.target.value)}
                  placeholder="Ej: 18"
                  className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre del Departamento *</label>
                <input
                  type="text"
                  required
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  placeholder="Nombre oficial"
                  className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  style={{ backgroundColor: settings.primary_color }}
                  className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white"
                >
                  <Plus className="h-4 w-4" />
                  <span>{editDeptId ? 'Guardar Cambios' : 'Agregar'}</span>
                </button>
                {editDeptId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditDeptId(null);
                      setDeptCode('');
                      setDeptName('');
                    }}
                    className="rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          )}

          <div className={`${canManage ? 'lg:col-span-8' : 'lg:col-span-12'} rounded-xl border border-slate-200 bg-white overflow-hidden`}>
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Departamento</th>
                  <th className="py-3 px-4">Estado</th>
                  {canManage && <th className="py-3 px-4 text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {departments.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-500">{d.code}</td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">{d.name}</td>
                    <td className="py-2.5 px-4 text-xs">
                      <span className={d.active ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                        {d.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    {canManage && (
                      <td className="py-2.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleActive('departments', d.id, d.active)}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                            title="Activar / Desactivar"
                          >
                            <Power className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditDeptId(d.id);
                              setDeptCode(d.code);
                              setDeptName(d.name);
                            }}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                            title="Editar"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ type: 'departments', id: d.id, label: d.name })}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-700"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Distritos */}
      {tab === 'districts' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {canManage && (
            <form onSubmit={handleSaveDistrict} className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-5 space-y-4 h-fit">
              <h2 className="text-sm font-semibold text-slate-900">
                {editDistId ? 'Editar Distrito' : 'Agregar Distrito'}
              </h2>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Departamento *</label>
                <select
                  required
                  value={distDeptId}
                  onChange={(e) => setDistDeptId(e.target.value)}
                  className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="">Seleccionar departamento</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre del Distrito *</label>
                <input
                  type="text"
                  required
                  value={distName}
                  onChange={(e) => setDistName(e.target.value)}
                  className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  style={{ backgroundColor: settings.primary_color }}
                  className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white"
                >
                  <Plus className="h-4 w-4" />
                  <span>{editDistId ? 'Guardar Cambios' : 'Agregar Distrito'}</span>
                </button>
                {editDistId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditDistId(null);
                      setDistName('');
                    }}
                    className="rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          )}

          <div className={`${canManage ? 'lg:col-span-8' : 'lg:col-span-12'} rounded-xl border border-slate-200 bg-white overflow-hidden`}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-700">Filtrar por Departamento</span>
              <select
                value={distFilterDept}
                onChange={(e) => setDistFilterDept(e.target.value)}
                className="min-h-[36px] rounded-lg border border-slate-300 px-3 py-1 text-xs bg-white"
              >
                <option value="">Todos los departamentos</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="max-h-[520px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Distrito</th>
                    <th className="py-3 px-4">Departamento</th>
                    <th className="py-3 px-4">Estado</th>
                    {canManage && <th className="py-3 px-4 text-right">Acciones</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleDistricts.map((dis) => (
                    <tr key={dis.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-medium text-slate-900">{dis.name}</td>
                      <td className="py-2.5 px-4 text-slate-600">{deptMap[dis.department_id]}</td>
                      <td className="py-2.5 px-4 text-xs">
                        <span className={dis.active ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                          {dis.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      {canManage && (
                        <td className="py-2.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => toggleActive('districts', dis.id, dis.active)}
                              className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                            >
                              <Power className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditDistId(dis.id);
                                setDistDeptId(String(dis.department_id));
                                setDistName(dis.name);
                              }}
                              className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget({ type: 'districts', id: dis.id, label: dis.name })}
                              className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Seccionales */}
      {tab === 'seccionales' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {canManage && (
            <form onSubmit={handleSaveSeccional} className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-5 space-y-4 h-fit">
              <h2 className="text-sm font-semibold text-slate-900">
                {editSeccId ? 'Editar Seccional' : 'Agregar Seccional'}
              </h2>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Departamento *</label>
                <select
                  required
                  value={seccDeptId}
                  onChange={(e) => {
                    setSeccDeptId(e.target.value);
                    setSeccDistId('');
                  }}
                  className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="">Seleccionar departamento</option>
                  {departments.map((d) => (
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
                  value={seccDistId}
                  onChange={(e) => setSeccDistId(e.target.value)}
                  className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="">Seleccionar distrito</option>
                  {seccFormDistricts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Número de Seccional *</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={seccNum}
                  onChange={(e) => setSeccNum(e.target.value)}
                  placeholder="Ej: 14"
                  className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre o Descripción (Opcional)</label>
                <input
                  type="text"
                  value={seccName}
                  onChange={(e) => setSeccName(e.target.value)}
                  placeholder="Ej: Seccional N° 14 - Sajonia"
                  className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  style={{ backgroundColor: settings.primary_color }}
                  className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white"
                >
                  <Plus className="h-4 w-4" />
                  <span>{editSeccId ? 'Guardar Cambios' : 'Agregar Seccional'}</span>
                </button>
                {editSeccId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditSeccId(null);
                      setSeccNum('');
                      setSeccName('');
                    }}
                    className="rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          )}

          <div className={`${canManage ? 'lg:col-span-8' : 'lg:col-span-12'} rounded-xl border border-slate-200 bg-white overflow-hidden`}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-700">Filtrar por Departamento</span>
              <select
                value={seccFilterDept}
                onChange={(e) => setSeccFilterDept(e.target.value)}
                className="min-h-[36px] rounded-lg border border-slate-300 px-3 py-1 text-xs bg-white"
              >
                <option value="">Todos los departamentos</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="max-h-[520px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">N° Seccional</th>
                    <th className="py-3 px-4">Descripción</th>
                    <th className="py-3 px-4">Departamento / Distrito</th>
                    <th className="py-3 px-4">Estado</th>
                    {canManage && <th className="py-3 px-4 text-right">Acciones</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleSeccionales.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-900">N° {s.number}</td>
                      <td className="py-2.5 px-4 text-slate-700">{s.name || '—'}</td>
                      <td className="py-2.5 px-4 text-slate-600 text-xs">
                        {deptMap[s.department_id]} · {distMap[s.district_id]}
                      </td>
                      <td className="py-2.5 px-4 text-xs">
                        <span className={s.active ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                          {s.active ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      {canManage && (
                        <td className="py-2.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => toggleActive('seccionales', s.id, s.active)}
                              className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                            >
                              <Power className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditSeccId(s.id);
                                setSeccDeptId(String(s.department_id));
                                setSeccDistId(String(s.district_id));
                                setSeccNum(String(s.number));
                                setSeccName(s.name || '');
                              }}
                              className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget({ type: 'seccionales', id: s.id, label: `Seccional N° ${s.number}` })}
                              className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Eliminar Elemento Territorial"
        message={`¿Desea eliminar "${deleteTarget?.label}"? Si existen registros vinculados en coordinadores, jóvenes o mujeres, deberá reasignarlos primero.`}
        confirmLabel="Eliminar"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
